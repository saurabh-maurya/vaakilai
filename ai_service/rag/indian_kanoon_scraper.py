"""
Indian Kanoon scraper — fetches judgment metadata + text.
Uses indiankanoon.org search API (free, no key needed).
Rate-limited to be polite to the server.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import re
from typing import List, Optional

import httpx

logger = logging.getLogger(__name__)

IK_SEARCH_URL = "https://indiankanoon.org/search/"
IK_DOC_URL = "https://indiankanoon.org/doc/"


async def search_indian_kanoon(query: str, page_num: int = 0, max_results: int = 10) -> List[dict]:
    """Search Indian Kanoon and return structured case list."""
    params = {
        "formInput": query,
        "pagenum": page_num,
        "type": "judgments",
    }
    headers = {
        "User-Agent": "VakilAI Legal Research Bot (legal research aggregator)",
        "Accept": "application/json",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.get(IK_SEARCH_URL, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            logger.error(f"Indian Kanoon search failed: {e}")
            return []

    cases = []
    for doc in data.get("docs", [])[:max_results]:
        case = _parse_ik_doc(doc)
        if case:
            cases.append(case)
    return cases


async def fetch_case_full_text(doc_id: str) -> Optional[str]:
    """Fetch full judgment text from Indian Kanoon."""
    headers = {
        "User-Agent": "VakilAI Legal Research Bot",
        "Accept": "application/json",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.get(f"{IK_DOC_URL}{doc_id}/", headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return data.get("doc", "")
        except Exception as e:
            logger.error(f"Indian Kanoon fetch failed for {doc_id}: {e}")
            return None


def _parse_ik_doc(doc: dict) -> Optional[dict]:
    """Parse Indian Kanoon API doc into VakilAI case format."""
    title = doc.get("title", "").strip()
    if not title:
        return None

    doc_id = str(doc.get("tid", ""))
    citation = doc.get("citation", "")
    court = doc.get("docsource", "")
    year = _extract_year(doc.get("publishdate", ""))
    headline = _clean_html(doc.get("headline", ""))
    author = doc.get("author", "")

    practice_areas = _infer_practice_areas(title + " " + headline)

    return {
        "id": f"ik_{doc_id}",
        "source": "indian_kanoon",
        "ik_doc_id": doc_id,
        "title": title,
        "citation": citation,
        "court": court,
        "year": year,
        "author": author,
        "summary": headline[:500] if headline else "",
        "key_points": "",        # populated by AI extraction
        "decision": "",          # populated by AI extraction
        "full_text": "",         # populated on demand
        "practice_areas": practice_areas,
        "url": f"https://indiankanoon.org/doc/{doc_id}/",
    }


def _clean_html(text: str) -> str:
    return re.sub(r"<[^>]+>", " ", text).strip()


def _extract_year(date_str: str) -> int:
    match = re.search(r"\b(19|20)\d{2}\b", date_str)
    return int(match.group()) if match else 0


def _infer_practice_areas(text: str) -> List[str]:
    text_lower = text.lower()
    area_keywords = {
        "Criminal Law": ["ipc", "crpc", "murder", "theft", "bail", "criminal", "accused"],
        "Family Law": ["divorce", "matrimonial", "custody", "maintenance", "hindu marriage"],
        "Property Law": ["property", "land", "transfer", "registration", "rent"],
        "Contract Law": ["contract", "agreement", "breach", "specific performance"],
        "Consumer Protection": ["consumer", "deficiency", "service", "complaint"],
        "Labour Law": ["labour", "employment", "workman", "factory", "wages"],
        "Constitutional Law": ["fundamental rights", "article", "constitution", "writ", "habeas"],
        "Taxation": ["income tax", "gst", "customs", "assessment", "tax"],
        "Corporate Law": ["company", "shareholder", "director", "sebi", "merger"],
        "Banking Law": ["bank", "loan", "npa", "recovery", "sarfaesi"],
    }
    found = []
    for area, keywords in area_keywords.items():
        if any(kw in text_lower for kw in keywords):
            found.append(area)
    return found[:3] if found else ["General"]


async def bulk_scrape(queries: List[str], cases_per_query: int = 5) -> List[dict]:
    """Scrape multiple queries and return deduplicated cases."""
    all_cases = []
    seen_ids = set()
    for query in queries:
        await asyncio.sleep(1)  # be polite
        cases = await search_indian_kanoon(query, max_results=cases_per_query)
        for case in cases:
            if case["id"] not in seen_ids:
                seen_ids.add(case["id"])
                all_cases.append(case)
    return all_cases
