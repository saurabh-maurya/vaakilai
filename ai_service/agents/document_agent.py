"""
DocumentAgent — Handles document generation and review via LangGraph.
"""

from __future__ import annotations

import json
import re
from typing import TypedDict

# Characters / sequences that are common prompt injection vectors
_INJECTION_PATTERN = re.compile(
    r"(ignore (previous|above|all) instructions?|you are now|act as|system prompt|<\|im_start\|>|\[INST\]|###\s*Instruction)",
    re.IGNORECASE,
)
_MAX_FIELD_LEN = 500


def _sanitize_field(value: str) -> str:
    """Strip prompt injection attempts from user-supplied document fields."""
    value = value[:_MAX_FIELD_LEN]
    if _INJECTION_PATTERN.search(value):
        raise ValueError("Field contains disallowed content.")
    # Remove angle brackets to prevent HTML/template injection in generated docs
    value = value.replace("<", "&lt;").replace(">", "&gt;")
    return value

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END

from config import settings


class DocumentGenState(TypedDict, total=False):
    template_id: str
    template_name: str
    fields: dict[str, str]
    jurisdiction: str
    # Output
    document_content: str
    download_url: str | None


class DocumentReviewState(TypedDict, total=False):
    document_text: str
    # Output
    risks: list[dict]
    suggestions: list[dict]
    summary: str
    risk_score: int


def get_llm() -> ChatAnthropic:
    return ChatAnthropic(
        model=settings.model_name,
        api_key=settings.anthropic_api_key,
        temperature=0.1,
        max_tokens=4096,
    )


TEMPLATE_PROMPTS = {
    "rent-agreement": "residential rental/lease agreement",
    "sale-deed": "property sale deed",
    "nda": "Non-Disclosure Agreement (NDA)",
    "appointment-letter": "employee appointment letter",
    "termination-letter": "employee termination letter",
    "partnership-deed": "business partnership deed",
    "mou": "Memorandum of Understanding (MOU)",
    "legal-notice": "formal legal notice letter",
    "demand-notice": "payment demand notice",
    "consumer-complaint": "consumer complaint to NCDRC/district forum",
    "vendor-agreement": "vendor/supplier agreement",
}


# ── Generate nodes ─────────────────────────────────────────────────────────────

async def validate_fields(state: DocumentGenState) -> DocumentGenState:
    """Ensure required fields are present; set defaults."""
    fields = state.get("fields") or {}
    if "jurisdiction" not in fields:
        fields["jurisdiction"] = "India"
    return {**state, "fields": fields}


async def generate_document(state: DocumentGenState) -> DocumentGenState:
    llm = get_llm()
    template_id = state.get("template_id", "legal-notice")
    template_desc = TEMPLATE_PROMPTS.get(template_id, template_id.replace("-", " "))
    fields = state.get("fields") or {}

    # Sanitize all user-supplied field values before embedding in the prompt
    sanitized_fields = {}
    for k, v in fields.items():
        if v:
            try:
                sanitized_fields[str(k)[:50]] = _sanitize_field(str(v))
            except ValueError:
                pass  # skip injected fields silently

    field_str = "\n".join(f"- {k}: {v}" for k, v in sanitized_fields.items())

    response = await llm.ainvoke([
        SystemMessage(content=f"""You are an expert Indian legal document drafter.
Generate a complete, legally sound {template_desc} compliant with Indian law.
Use the provided field values. Include all standard clauses.
Format with proper sections, numbering, and legal language.
Include signature blocks and date fields."""),
        HumanMessage(content=f"Document type: {template_desc}\n\nProvided details:\n{field_str}\n\nGenerate the complete document:"),
    ])

    return {**state, "document_content": response.content, "download_url": None}


async def build_gen_graph() -> StateGraph:
    graph = StateGraph(DocumentGenState)
    graph.add_node("validate", validate_fields)
    graph.add_node("generate", generate_document)
    graph.set_entry_point("validate")
    graph.add_edge("validate", "generate")
    graph.add_edge("generate", END)
    return graph.compile()


# ── Review nodes ───────────────────────────────────────────────────────────────

async def analyse_risks(state: DocumentReviewState) -> DocumentReviewState:
    llm = get_llm()
    response = await llm.ainvoke([
        SystemMessage(content="""You are an expert Indian legal document reviewer.
Analyse the document for risky, unfair, or non-compliant clauses.
Return JSON:
{
  "risks": [{"severity": "high|medium|low", "clause": "clause ref or name", "explanation": "why it's risky"}],
  "suggestions": [{"clause": "clause ref", "suggestion": "what to change"}],
  "summary": "2-3 sentence executive summary",
  "risk_score": 0-100
}
Return ONLY valid JSON."""),
        HumanMessage(content=f"Document to review:\n\n{state['document_text'][:8000]}"),
    ])

    try:
        content = response.content.strip()
        match = re.search(r'\{.*\}', content, re.DOTALL)
        data = json.loads(match.group()) if match else {}
    except Exception:
        data = {
            "risks": [{"severity": "medium", "clause": "Unable to parse", "explanation": "Please try again."}],
            "suggestions": [],
            "summary": "Document review completed with limited analysis.",
            "risk_score": 50,
        }

    return {
        **state,
        "risks": data.get("risks", []),
        "suggestions": data.get("suggestions", []),
        "summary": data.get("summary", ""),
        "risk_score": data.get("risk_score", 50),
    }


# ── Public API ────────────────────────────────────────────────────────────────

async def run_generate(template_id: str, fields: dict[str, str]) -> dict:
    gen_graph = await build_gen_graph()
    state: DocumentGenState = {"template_id": template_id, "fields": fields}
    result = await gen_graph.ainvoke(state)
    return {"content": result.get("document_content", ""), "download_url": result.get("download_url")}


async def run_review(document_text: str) -> dict:
    state: DocumentReviewState = {"document_text": document_text}
    result = await analyse_risks(state)
    return {
        "risks": result.get("risks", []),
        "suggestions": result.get("suggestions", []),
        "summary": result.get("summary", ""),
        "risk_score": result.get("risk_score", 50),
    }
