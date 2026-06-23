"""
G4 — Legal News Feed
Aggregates RSS from Bar & Bench and LiveLaw; cached in-process for 15 min.
Falls back to static curated links if feeds are unreachable.
"""

import logging
from fastapi import APIRouter, Query
from typing import Optional
import httpx
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
import asyncio

logger = logging.getLogger(__name__)
router = APIRouter()

# ── RSS sources ────────────────────────────────────────────────────────────────

RSS_SOURCES = [
    {"name": "Bar & Bench",  "url": "https://www.barandbench.com/feed", "category": "general"},
    {"name": "LiveLaw",      "url": "https://www.livelaw.in/rss",       "category": "general"},
    {"name": "SCC Online",   "url": "https://www.scconline.com/blog/feed/", "category": "research"},
]

FALLBACK_ARTICLES = [
    {
        "id": "f1",
        "title": "Supreme Court upholds Right to Privacy as Fundamental Right",
        "source": "Bar & Bench",
        "category": "constitutional",
        "published_at": "2024-12-01T10:00:00Z",
        "url": "https://www.barandbench.com",
        "summary": "Nine-judge bench unanimously holds privacy is intrinsic to life and liberty under Article 21.",
        "tags": ["Supreme Court", "Fundamental Rights", "Article 21"],
    },
    {
        "id": "f2",
        "title": "BNS 2023: Key changes from IPC explained",
        "source": "LiveLaw",
        "category": "legislation",
        "published_at": "2024-07-01T08:00:00Z",
        "url": "https://www.livelaw.in",
        "summary": "Bharatiya Nyaya Sanhita replaces IPC from 1 July 2024 — key differences for practitioners.",
        "tags": ["BNS", "IPC", "Criminal Law"],
    },
    {
        "id": "f3",
        "title": "SEBI tightens disclosure norms for listed companies",
        "source": "Bar & Bench",
        "category": "corporate",
        "published_at": "2024-11-15T09:30:00Z",
        "url": "https://www.barandbench.com",
        "summary": "SEBI circular mandates real-time disclosure of material events within 24 hours.",
        "tags": ["SEBI", "Corporate Law", "Compliance"],
    },
    {
        "id": "f4",
        "title": "Delhi HC: WhatsApp messages admissible as secondary evidence",
        "source": "LiveLaw",
        "category": "technology",
        "published_at": "2024-10-20T11:00:00Z",
        "url": "https://www.livelaw.in",
        "summary": "Delhi High Court holds that WhatsApp screenshots are admissible if certified under Section 65B of the Evidence Act.",
        "tags": ["Evidence", "Technology Law", "Delhi HC"],
    },
    {
        "id": "f5",
        "title": "Consumer courts get new powers under CPA 2019 amendments",
        "source": "Bar & Bench",
        "category": "consumer",
        "published_at": "2024-09-10T07:00:00Z",
        "url": "https://www.barandbench.com",
        "summary": "Amended Consumer Protection Act empowers NCDRC to call for records from lower forums suo motu.",
        "tags": ["Consumer Law", "CPA 2019", "NCDRC"],
    },
]

# ── In-process cache ────────────────────────────────────────────────────────────

_cache: dict = {"articles": [], "fetched_at": None}
CACHE_TTL = timedelta(minutes=15)


def _parse_rss(xml_text: str, source_name: str, category: str) -> list[dict]:
    articles = []
    try:
        root = ET.fromstring(xml_text)
        channel = root.find("channel")
        if channel is None:
            return articles
        items = channel.findall("item")[:10]
        for idx, item in enumerate(items):
            title_el = item.find("title")
            link_el  = item.find("link")
            pub_el   = item.find("pubDate")
            desc_el  = item.find("description")
            title   = title_el.text.strip()  if title_el  is not None else ""
            link    = link_el.text.strip()   if link_el   is not None else ""
            pub     = pub_el.text.strip()    if pub_el    is not None else ""
            summary = desc_el.text.strip()   if desc_el   is not None else ""
            # strip HTML tags from summary
            summary = summary[:300].replace("<p>", "").replace("</p>", "").replace("<br/>", " ")
            articles.append({
                "id": f"{source_name[:3].lower()}{idx}",
                "title": title,
                "source": source_name,
                "category": category,
                "published_at": pub,
                "url": link,
                "summary": summary,
                "tags": [],
            })
    except Exception:
        pass
    return articles


async def _fetch_all_feeds() -> list[dict]:
    """Concurrently fetch all RSS feeds and parse them. Returns empty list on total failure."""
    articles: list[dict] = []
    async with httpx.AsyncClient(timeout=8) as client:
        tasks = [client.get(s["url"]) for s in RSS_SOURCES]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for i, res in enumerate(results):
            if isinstance(res, Exception):
                logger.warning(f"RSS fetch failed for {RSS_SOURCES[i]['name']}: {res}")
                continue
            if res.status_code == 200:
                parsed = _parse_rss(res.text, RSS_SOURCES[i]["name"], RSS_SOURCES[i]["category"])
                articles.extend(parsed)
                logger.debug(f"Fetched {len(parsed)} articles from {RSS_SOURCES[i]['name']}")
            else:
                logger.warning(f"RSS source {RSS_SOURCES[i]['name']} returned HTTP {res.status_code}")
    return articles


async def _get_articles() -> list[dict]:
    """
    Return cached articles if fresh, otherwise re-fetch.
    Falls back to static FALLBACK_ARTICLES if all feeds fail.
    """
    now = datetime.utcnow()
    if _cache["articles"] and _cache["fetched_at"] and (now - _cache["fetched_at"]) < CACHE_TTL:
        logger.debug("Returning cached news articles")
        return _cache["articles"]
    try:
        logger.info("Fetching fresh legal news from RSS feeds")
        articles = await _fetch_all_feeds()
        if articles:
            _cache["articles"] = articles
            _cache["fetched_at"] = now
            logger.info(f"News cache updated: {len(articles)} articles")
            return articles
    except Exception as e:
        logger.error(f"News fetch error: {e}")
    # Feeds unavailable — serve curated fallback articles
    logger.warning("Using fallback articles (RSS feeds unreachable)")
    return FALLBACK_ARTICLES


# ── Endpoints ────────────────────────────────────────────────────────────────

VALID_CATEGORIES = {"general", "constitutional", "corporate", "technology", "consumer", "criminal", "legislation", "research", "all"}


@router.get("/")
async def get_news(
    category: Optional[str] = Query(default="all"),
    limit: int = Query(default=20, ge=1, le=50),
    q: Optional[str] = Query(default=None, description="Search keyword"),
):
    """Fetch aggregated legal news from Bar & Bench and LiveLaw."""
    articles = await _get_articles()

    if category and category != "all":
        articles = [a for a in articles if a.get("category") == category]

    if q:
        q_lower = q.lower()
        articles = [
            a for a in articles
            if q_lower in a["title"].lower() or q_lower in a.get("summary", "").lower()
        ]

    return {
        "articles": articles[:limit],
        "total": len(articles),
        "cached": _cache["fetched_at"].isoformat() + "Z" if _cache["fetched_at"] else None,
        "sources": [s["name"] for s in RSS_SOURCES],
    }


@router.get("/categories")
async def get_categories():
    """Available news categories."""
    return {"categories": sorted(VALID_CATEGORIES - {"all"})}


@router.get("/trending")
async def get_trending(limit: int = Query(default=5, ge=1, le=10)):
    """Top N most recent articles (proxy for trending)."""
    articles = await _get_articles()
    return {"trending": articles[:limit]}
