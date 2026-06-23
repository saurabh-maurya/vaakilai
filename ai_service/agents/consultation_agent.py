"""
ConsultationAgent — LangGraph-based multi-step legal consultation agent.

Graph:
  classify_query → retrieve_context → generate_answer → score_confidence → finalize

State flows through a TypedDict so every node can read / update shared data.
"""

from __future__ import annotations

import asyncio
import json
import re
from typing import Any, AsyncIterator, TypedDict

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END

from config import settings

# ── Prompt injection guard ────────────────────────────────────────────────────

_INJECTION_PATTERNS = re.compile(
    r"(ignore\s+(previous|prior|above|all)\s+(instructions?|prompt|context)|"
    r"you\s+are\s+now|system\s*:\s*|act\s+as\s+(?!a\s+lawyer)|"
    r"jailbreak|DAN\s+mode|forget\s+(everything|all)|"
    r"reveal\s+(your\s+)?(system\s+)?prompt|print\s+(your\s+)?instructions)",
    re.IGNORECASE,
)

_MAX_QUERY_LEN = 2000


def _sanitize_query(query: str) -> str:
    """Strip leading/trailing whitespace, cap length, and reject obvious injection attempts."""
    query = query.strip()[:_MAX_QUERY_LEN]
    if _INJECTION_PATTERNS.search(query):
        raise ValueError("Query contains disallowed content.")
    return query


# ── Shared state schema ──────────────────────────────────────────────────────

class ConsultState(TypedDict, total=False):
    query: str
    jurisdiction: str
    practice_area: str
    language: str
    conversation_history: list[dict]
    # Intermediate
    classified_area: str
    retrieved_context: str
    citations: list[dict]
    # Output
    answer: str
    confidence: float
    disclaimer: str


# ── LLM setup ────────────────────────────────────────────────────────────────

def get_llm(streaming: bool = False) -> ChatAnthropic:
    return ChatAnthropic(
        model=settings.model_name,
        api_key=settings.anthropic_api_key,
        streaming=streaming,
        max_tokens=2048,
        temperature=0.2,
    )


# ── Node: Classify query ──────────────────────────────────────────────────────

async def classify_query(state: ConsultState) -> ConsultState:
    """Identify practice area if not already provided."""
    # Sanitize query before it enters the LLM pipeline
    sanitized = _sanitize_query(state.get("query", ""))
    state = {**state, "query": sanitized}
    if state.get("practice_area"):
        return {**state, "classified_area": state["practice_area"]}

    llm = get_llm()
    response = await llm.ainvoke([
        SystemMessage(content="""You are a legal classification expert for Indian law.
Given a legal query, identify the primary practice area from:
Family Law, Property & Real Estate, Criminal Law, Consumer Protection,
Labour & Employment, Corporate & Business, Intellectual Property, Taxation,
Banking & Finance, Immigration, Cyber Law, Constitutional Law, Contract Law.
Respond with ONLY the practice area name."""),
        HumanMessage(content=state["query"]),
    ])
    return {**state, "classified_area": response.content.strip()}


# ── Node: Retrieve context ────────────────────────────────────────────────────

async def retrieve_context(state: ConsultState) -> ConsultState:
    """
    Retrieve relevant judgments/statutes from Pinecone vector DB.
    Falls back to LLM knowledge if Pinecone is not configured.
    """
    try:
        from pinecone import Pinecone  # type: ignore
        pc = Pinecone(api_key=settings.pinecone_api_key)
        index = pc.Index(settings.pinecone_index_name)

        # Embed query
        llm = get_llm()
        embed_response = await llm.ainvoke([
            HumanMessage(content=f"Summarize for embedding: {state['query']}")
        ])
        # In production use a proper embedding model
        # For now use LLM to craft context from its knowledge
        context_response = await llm.ainvoke([
            SystemMessage(content="List 3 relevant Indian legal cases/statutes for this query. Format as JSON array with fields: title, citation, court, year, summary."),
            HumanMessage(content=state["query"]),
        ])
        try:
            citations = json.loads(context_response.content)
        except json.JSONDecodeError:
            citations = []

        return {**state, "retrieved_context": context_response.content, "citations": citations}

    except Exception:
        # Fallback: LLM generates relevant context from training knowledge
        llm = get_llm()
        response = await llm.ainvoke([
            SystemMessage(content="""You are an expert in Indian law. For the given query, identify 2-3 highly relevant legal provisions, cases or statutes.
Return JSON array: [{"id":"1","title":"...","citation":"...","court":"Supreme Court/HC/etc","year":YYYY,"summary":"..."}]
Return ONLY the JSON array."""),
            HumanMessage(content=state["query"]),
        ])
        try:
            # Extract JSON from response
            content = response.content.strip()
            match = re.search(r'\[.*\]', content, re.DOTALL)
            citations = json.loads(match.group()) if match else []
        except Exception:
            citations = []

        return {**state, "retrieved_context": response.content, "citations": citations}


# ── Node: Generate answer ─────────────────────────────────────────────────────

async def generate_answer(state: ConsultState) -> ConsultState:
    """Generate the main legal guidance response."""
    jurisdiction = state.get("jurisdiction") or "India (general)"
    practice_area = state.get("classified_area") or "General Legal"
    context = state.get("retrieved_context") or ""
    history = state.get("conversation_history") or []
    language = state.get("language") or "en"

    lang_instruction = "" if language == "en" else f"Respond in {language}."

    system_prompt = f"""You are VakilAI, an expert AI legal assistant specialising in Indian law.

Practice area: {practice_area}
Jurisdiction: {jurisdiction}

Relevant legal context:
{context}

Guidelines:
- Provide accurate, jurisdiction-aware legal information
- Structure your response clearly with relevant sections
- Reference specific statutes, sections, and cases where applicable
- Be empathetic and plain-language
- Mention limitations and recommend consulting an advocate for specific situations
- Do NOT fabricate case citations; only cite what is in the context
{lang_instruction}"""

    messages = [SystemMessage(content=system_prompt)]
    for msg in history[-6:]:  # last 6 messages for context
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        else:
            from langchain_core.messages import AIMessage
            messages.append(AIMessage(content=msg["content"]))
    messages.append(HumanMessage(content=state["query"]))

    llm = get_llm()
    response = await llm.ainvoke(messages)
    return {**state, "answer": response.content}


# ── Node: Score confidence ─────────────────────────────────────────────────────

async def score_confidence(state: ConsultState) -> ConsultState:
    """Score the confidence of the generated answer."""
    llm = get_llm()
    response = await llm.ainvoke([
        SystemMessage(content="""Rate the confidence (0.0-1.0) of this legal answer for Indian law.
Consider: specificity of query, quality of legal citations, clarity of applicable law.
Return ONLY a decimal number like 0.82"""),
        HumanMessage(content=f"Query: {state['query']}\n\nAnswer: {state['answer']}"),
    ])
    try:
        confidence = float(response.content.strip())
        confidence = max(0.0, min(1.0, confidence))
    except ValueError:
        confidence = 0.65

    return {**state, "confidence": confidence}


# ── Node: Finalize ────────────────────────────────────────────────────────────

async def finalize(state: ConsultState) -> ConsultState:
    disclaimer = (
        "This is AI-generated legal information for educational purposes only. "
        "It does not constitute legal advice. Please consult a qualified advocate "
        "before taking any legal action."
    )
    return {**state, "disclaimer": disclaimer}


# ── Build graph ───────────────────────────────────────────────────────────────

def build_consultation_graph() -> StateGraph:
    graph = StateGraph(ConsultState)

    graph.add_node("classify", classify_query)
    graph.add_node("retrieve", retrieve_context)
    graph.add_node("generate", generate_answer)
    graph.add_node("score_conf", score_confidence)
    graph.add_node("complete", finalize)

    graph.set_entry_point("classify")
    graph.add_edge("classify", "retrieve")
    graph.add_edge("retrieve", "generate")
    graph.add_edge("generate", "score_conf")
    graph.add_edge("score_conf", "complete")
    graph.add_edge("complete", END)

    return graph.compile()


# Compiled graph instance (singleton)
consultation_graph = build_consultation_graph()


# ── Streaming runner ──────────────────────────────────────────────────────────

async def stream_consultation(
    query: str,
    jurisdiction: str = "",
    practice_area: str = "",
    language: str = "en",
    conversation_history: list[dict] | None = None,
) -> AsyncIterator[dict]:
    """
    Run the consultation graph and stream chunks as SSE-compatible dicts.
    Yields dicts: {"type": "content|citations|confidence|done|error", "data": ...}
    """
    initial_state: ConsultState = {
        "query": query,
        "jurisdiction": jurisdiction,
        "practice_area": practice_area,
        "language": language,
        "conversation_history": conversation_history or [],
    }

    try:
        # For actual streaming of the answer token-by-token, we run the
        # classify+retrieve steps first, then stream the answer generation.

        # Step 1: classify + retrieve (non-streaming)
        classified = await classify_query(initial_state)
        with_context = await retrieve_context(classified)

        # Step 2: stream answer generation
        jurisdiction_str = jurisdiction or "India (general)"
        practice_area_str = with_context.get("classified_area") or "General Legal"
        context = with_context.get("retrieved_context") or ""
        history = conversation_history or []

        system_prompt = f"""You are VakilAI, an expert AI legal assistant specialising in Indian law.
Practice area: {practice_area_str}
Jurisdiction: {jurisdiction_str}
Relevant legal context:
{context}
Provide accurate, jurisdiction-aware legal information with citations where available."""

        messages_payload = [SystemMessage(content=system_prompt)]
        for msg in history[-6:]:
            if msg["role"] == "user":
                messages_payload.append(HumanMessage(content=msg["content"]))
            else:
                from langchain_core.messages import AIMessage
                messages_payload.append(AIMessage(content=msg["content"]))
        messages_payload.append(HumanMessage(content=query))

        stream_llm = get_llm(streaming=True)
        full_answer = ""

        async for chunk in stream_llm.astream(messages_payload):
            token = chunk.content if hasattr(chunk, "content") else str(chunk)
            if token:
                full_answer += token
                yield {"type": "content", "data": token}

        # Step 3: score confidence (non-streaming)
        scored_state = await score_confidence({**with_context, "answer": full_answer})
        confidence = scored_state.get("confidence", 0.7)

        # Emit citations
        citations = with_context.get("citations") or []
        if citations:
            yield {"type": "citations", "data": citations}

        # Emit confidence
        yield {"type": "confidence", "data": confidence}

        # Done
        yield {"type": "done", "data": None}

    except Exception as e:
        yield {"type": "error", "data": str(e)}
