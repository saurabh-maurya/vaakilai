"""
Indian Kanoon scraper — fetches judgment metadata + text.
indiankanoon.org has no free JSON API; /search/ and /doc/ both return HTML
(their paid api.indiankanoon.org is the only JSON endpoint), so this parses
the public HTML pages with BeautifulSoup.
Rate-limited to be polite to the server.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import re
from typing import List, Optional

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

IK_SEARCH_URL = "https://indiankanoon.org/search/"
IK_DOC_URL = "https://indiankanoon.org/doc/"

_DOC_ID_RE = re.compile(r"/doc(?:fragment)?/(\d+)/")


async def search_indian_kanoon(query: str, page_num: int = 0, max_results: int = 10) -> List[dict]:
    """Search Indian Kanoon and return structured case list."""
    params = {
        "formInput": query,
        "pagenum": page_num,
        "type": "judgments",
    }
    headers = {
        "User-Agent": "VakilAI Legal Research Bot (legal research aggregator)",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.get(IK_SEARCH_URL, params=params, headers=headers)
            resp.raise_for_status()
            html = resp.text
        except Exception as e:
            logger.error(f"Indian Kanoon search failed: {e}")
            return []

    cases = []
    for article in BeautifulSoup(html, "html.parser").select("article.result")[:max_results]:
        case = _parse_ik_result(article)
        if case:
            cases.append(case)
    return cases


async def fetch_case_full_text(doc_id: str) -> Optional[str]:
    """Fetch full judgment text from Indian Kanoon."""
    headers = {
        "User-Agent": "VakilAI Legal Research Bot",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.get(f"{IK_DOC_URL}{doc_id}/", headers=headers)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            pre = soup.select_one("pre[id^='pre_']") or soup.select_one("div.judgments")
            return pre.get_text("\n").strip() if pre else None
        except Exception as e:
            logger.error(f"Indian Kanoon fetch failed for {doc_id}: {e}")
            return None


def _parse_ik_result(article) -> Optional[dict]:
    """Parse one <article class="result"> block from an Indian Kanoon search page."""
    title_link = article.select_one("h4.result_title a")
    if not title_link:
        return None
    title = title_link.get_text(strip=True)
    if not title:
        return None

    href = title_link.get("href", "")
    id_match = _DOC_ID_RE.search(href)
    if not id_match:
        return None
    doc_id = id_match.group(1)

    court = article.select_one(".docsource")
    court = court.get_text(strip=True) if court else ""
    headline = article.select_one(".headline")
    headline = headline.get_text(" ", strip=True) if headline else ""
    year = _extract_year(title)

    practice_areas = _infer_practice_areas(title + " " + headline)

    return {
        "id": f"ik_{doc_id}",
        "source": "indian_kanoon",
        "ik_doc_id": doc_id,
        "title": title,
        "citation": "",
        "court": court,
        "year": year,
        "author": "",
        "summary": headline[:500] if headline else "",
        "key_points": "",        # populated by AI extraction
        "decision": "",          # populated by AI extraction
        "full_text": "",         # populated on demand
        "practice_areas": practice_areas,
        "url": f"https://indiankanoon.org/doc/{doc_id}/",
    }


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
