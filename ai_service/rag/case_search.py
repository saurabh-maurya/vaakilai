"""
RAG case search — semantic search over FAISS + AI-generated summaries.
"""

from __future__ import annotations

import json
import logging
import re
from typing import List, Optional

from .vector_store import case_store
from providers.factory import get_llm_provider

logger = logging.getLogger(__name__)


async def search_cases(
    query: str,
    k: int = 10,
    practice_area: str = "",
    year_from: int = 0,
    year_to: int = 0,
) -> dict:
    """
    Semantic search over indexed cases.
    Returns: { results: [...], ai_summary: str, total: int }
    Each result has: id, title, citation, court, year, summary,
                     key_points, decision, relevance_score, url
    """
    raw_results = await case_store.search(query, k=min(k * 2, 50))

    # Filter by practice area / year
    filtered = []
    for r in raw_results:
        if practice_area and practice_area.lower() not in [a.lower() for a in r.get("practice_areas", [])]:
            continue
        if year_from and r.get("year", 0) < year_from:
            continue
        if year_to and r.get("year", 0) > year_to:
            continue
        filtered.append(r)

    results = filtered[:k]

    # If cases are missing key_points / decision, extract them via AI
    results = await _enrich_results(results, query)

    # Generate overall AI summary across all results
    ai_summary = await _generate_search_summary(query, results)

    return {
        "query": query,
        "total": len(results),
        "results": results,
        "ai_summary": ai_summary,
    }


async def get_case_by_id(case_id: str) -> Optional[dict]:
    """Return full case detail + AI analysis."""
    case = case_store.get_by_id(case_id)
    if not case:
        return None
    if not case.get("key_points") or not case.get("decision"):
        case = await _extract_key_info(case)
    return case


async def search_within_case(case_id: str, query: str) -> dict:
    """AI-powered search within a single case's full text."""
    case = case_store.get_by_id(case_id)
    if not case or not case.get("full_text"):
        return {"answer": "Case text not available.", "excerpts": []}

    full_text = case["full_text"]
    provider = get_llm_provider()
    messages = [
        {
            "role": "system",
            "content": (
                "You are a legal document analyst. Answer the user's question based ONLY on the "
                "provided court judgment text. Quote relevant excerpts. Be precise and cite paragraph numbers if visible."
            ),
        },
        {
            "role": "user",
            "content": f"Judgment text:\n\n{full_text[:6000]}\n\n---\n\nQuestion: {query}",
        },
    ]
    answer = await provider.complete(messages, max_tokens=1024)

    # Extract relevant excerpts
    excerpts = _extract_relevant_excerpts(full_text, query, max_excerpts=3)
    return {"answer": answer, "excerpts": excerpts}


async def _enrich_results(results: List[dict], query: str) -> List[dict]:
    """Fill in missing key_points + decision for cases that need it."""
    enriched = []
    provider = get_llm_provider()
    for case in results:
        if not case.get("key_points") or not case.get("decision"):
            text = case.get("full_text") or case.get("summary", "")
            if text:
                extracted = await _extract_key_info_from_text(text[:3000], case.get("title", ""), provider)
                case = {**case, **extracted}
        enriched.append(case)
    return enriched


async def _extract_key_info(case: dict) -> dict:
    provider = get_llm_provider()
    text = case.get("full_text") or case.get("summary", "")
    extracted = await _extract_key_info_from_text(text[:3000], case.get("title", ""), provider)
    return {**case, **extracted}


async def _extract_key_info_from_text(text: str, title: str, provider) -> dict:
    messages = [
        {
            "role": "system",
            "content": (
                "Extract from this Indian court judgment: "
                "1) key_points: 3-5 bullet points of key legal principles established "
                "2) decision: the final verdict/outcome in 1-2 sentences. "
                "Return JSON: {\"key_points\": \"• point1\\n• point2\", \"decision\": \"...\"}"
            ),
        },
        {"role": "user", "content": f"Title: {title}\n\nText: {text}"},
    ]
    try:
        result = await provider.complete(messages, max_tokens=512, temperature=0.1)
        match = re.search(r"\{.*\}", result, re.DOTALL)
        if match:
            return json.loads(match.group())
    except Exception as e:
        logger.error(f"Key info extraction failed: {e}")
    return {"key_points": "", "decision": ""}


async def _generate_search_summary(query: str, results: List[dict]) -> str:
    if not results:
        return "No relevant cases found in the database for your query."
    provider = get_llm_provider()
    case_titles = "\n".join(f"- {r.get('title', '')} ({r.get('year', '')})" for r in results[:5])
    messages = [
        {
            "role": "system",
            "content": (
                "You are a senior Indian legal researcher. Briefly summarize what these cases collectively establish "
                "regarding the legal question. 2-3 sentences. Mention key legal principles."
            ),
        },
        {"role": "user", "content": f"Legal query: {query}\n\nRelevant cases found:\n{case_titles}"},
    ]
    try:
        return await provider.complete(messages, max_tokens=300, temperature=0.3)
    except Exception as e:
        logger.error(f"Summary generation failed: {e}")
        return f"Found {len(results)} relevant cases for your query."


def _extract_relevant_excerpts(text: str, query: str, max_excerpts: int = 3) -> List[str]:
    """Simple keyword-based excerpt extraction."""
    query_words = set(query.lower().split())
    sentences = re.split(r"(?<=[.!?])\s+", text)
    scored = []
    for sent in sentences:
        sent_words = set(sent.lower().split())
        score = len(query_words & sent_words)
        if score > 0 and len(sent) > 50:
            scored.append((score, sent.strip()))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [s[1] for s in scored[:max_excerpts]]
