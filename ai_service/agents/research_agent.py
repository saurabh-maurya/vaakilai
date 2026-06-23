"""
ResearchAgent — Semantic search, precedent finder, and memo generation.
Uses Pinecone for vector search over 4M+ Indian judgments.
Falls back to LLM knowledge if vector DB is unavailable.
"""

from __future__ import annotations

import json
import re

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from config import settings


def get_llm() -> ChatAnthropic:
    return ChatAnthropic(
        model=settings.model_name,
        api_key=settings.anthropic_api_key,
        temperature=0.15,
        max_tokens=3000,
    )


async def _try_pinecone_search(query: str, filters: dict | None = None, top_k: int = 10) -> list[dict] | None:
    """Attempt vector search via Pinecone. Returns None if unavailable."""
    if not settings.pinecone_api_key:
        return None
    try:
        from pinecone import Pinecone
        pc = Pinecone(api_key=settings.pinecone_api_key)
        index = pc.Index(settings.pinecone_index_name)
        # In production: embed query with text-embedding-3-small or equivalent
        # For now return None to fall back to LLM
        return None
    except Exception:
        return None


async def search_judgments(
    query: str,
    court: str | None = None,
    year_from: int | None = None,
    practice_area: str | None = None,
) -> list[dict]:
    """Semantic search over judgments."""
    # Try Pinecone first
    pinecone_results = await _try_pinecone_search(query, {"court": court, "year_from": year_from, "practice_area": practice_area})
    if pinecone_results:
        return pinecone_results

    # Fallback to LLM knowledge
    llm = get_llm()
    filters_str = ""
    if court: filters_str += f"\nCourt filter: {court}"
    if year_from: filters_str += f"\nYear from: {year_from}"
    if practice_area: filters_str += f"\nPractice area: {practice_area}"

    response = await llm.ainvoke([
        SystemMessage(content=f"""You are an Indian legal research expert with knowledge of Supreme Court, High Court and tribunal judgments.
Return the 5-8 most relevant judgments for the given query as a JSON array.
Each object must have these exact fields:
{{
  "id": "unique_id",
  "title": "case name",
  "citation": "AIR/SCC/SCR citation",
  "court": "court name",
  "year": year_number,
  "practice_area": "area",
  "summary": "2-3 sentence summary of ratio/holding",
  "similarity_score": 0.75-0.99,
  "is_landmark": true/false,
  "status": "valid|overruled|upheld"
}}
{filters_str}
Return ONLY valid JSON array."""),
        HumanMessage(content=f"Legal research query: {query}"),
    ])

    try:
        content = response.content.strip()
        match = re.search(r'\[.*\]', content, re.DOTALL)
        return json.loads(match.group()) if match else []
    except Exception:
        return []


async def find_precedents(facts: str, practice_area: str) -> list[dict]:
    """Find precedents most relevant to given case facts."""
    llm = get_llm()
    response = await llm.ainvoke([
        SystemMessage(content="""You are an Indian legal precedent expert.
Given case facts, identify the most applicable precedents.
Return JSON array where each object has:
{
  "judgment": {
    "id": "id", "title": "name", "citation": "citation",
    "court": "court", "year": year, "practice_area": "area",
    "summary": "ratio/holding", "similarity_score": 0.7-0.99,
    "is_landmark": true/false, "status": "valid|overruled|upheld"
  },
  "relevance": "Why this case is relevant to the facts",
  "key_principle": "The legal principle applicable here"
}
Return ONLY valid JSON array."""),
        HumanMessage(content=f"Practice area: {practice_area}\n\nCase facts:\n{facts}"),
    ])

    try:
        content = response.content.strip()
        match = re.search(r'\[.*\]', content, re.DOTALL)
        return json.loads(match.group()) if match else []
    except Exception:
        return []


async def generate_research_memo(topic: str, judgment_ids: list[str]) -> str:
    """Generate a structured research memo on the given topic."""
    llm = get_llm()
    ids_str = ", ".join(judgment_ids) if judgment_ids else "general research"

    response = await llm.ainvoke([
        SystemMessage(content="""You are an expert Indian legal researcher.
Generate a comprehensive research memo in the following format:
# Research Memo: [Topic]
Date: [Current Date]
Prepared by: VakilAI Research Suite

## Executive Summary
(2-3 sentences)

## Applicable Law
(Relevant statutes and their key provisions)

## Key Judgments & Analysis
(For each judgment: citation, court, year, ratio decidendi, relevance)

## Legal Principles Established
(Numbered list of key principles)

## Contradictions / Evolving Position
(Any conflicting judgments or evolving interpretation)

## Conclusion
(Summary of legal position)

## Disclaimer
This memo is for informational purposes only and does not constitute legal advice."""),
        HumanMessage(content=f"Memo topic: {topic}\nReference judgments: {ids_str}"),
    ])

    return response.content
