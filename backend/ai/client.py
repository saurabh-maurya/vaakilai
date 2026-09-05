"""
Centralized client for all backend → ai_service (VaakilAI AI microservice) calls.

Every AI feature in the backend is an HTTP call to the ai_service (port 8001).
Previously those calls were scattered across routes (whatsapp, odr, documents,
marketplace, analytics), each rebuilding the URL, timeout and auth headers by
hand — and inconsistently (odr.py hardcoded localhost and skipped the internal
key). This module is the single place that talks to ai_service:

    from ai import client as ai_client
    data = await ai_client.consult(query="...", language="en")

Conventions:
- Base URL always comes from settings.ai_service_url (no hardcoded hosts).
- The internal service-to-service key (X-Internal-Key) is attached automatically
  whenever settings.internal_service_key is set.
- On any failure (non-2xx or network error) each function returns None and logs;
  callers keep their own user-facing fallback. OCR is fire-and-forget.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from config import settings

logger = logging.getLogger(__name__)


def _headers() -> dict:
    headers = {}
    if settings.internal_service_key:
        headers["X-Internal-Key"] = settings.internal_service_key
    return headers


def _url(path: str) -> str:
    return f"{settings.ai_service_url.rstrip('/')}{path}"


async def _post(path: str, payload: dict, *, timeout: float) -> Optional[dict]:
    """POST JSON to ai_service. Returns parsed dict on 2xx, else None."""
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(_url(path), json=payload, headers=_headers())
            if resp.status_code == 200:
                return resp.json()
            logger.warning("ai_service POST %s returned HTTP %s", path, resp.status_code)
    except Exception as exc:  # noqa: BLE001 - callers handle the None fallback
        logger.error("ai_service POST %s failed: %s", path, exc)
    return None


async def _get(path: str, *, timeout: float) -> Optional[dict]:
    """GET from ai_service. Returns parsed dict on 2xx, else None."""
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(_url(path), headers=_headers())
            if resp.status_code == 200:
                return resp.json()
            logger.warning("ai_service GET %s returned HTTP %s", path, resp.status_code)
    except Exception as exc:  # noqa: BLE001 - callers handle the None fallback
        logger.error("ai_service GET %s failed: %s", path, exc)
    return None


# ── Feature endpoints ────────────────────────────────────────────────────────

async def consult(
    query: str,
    *,
    language: Optional[str] = None,
    conversation_history: Optional[list] = None,
    practice_area: Optional[str] = None,
    timeout: float = 30.0,
) -> Optional[dict]:
    """POST /ai/consult — legal Q&A. Only non-None fields are sent."""
    payload: dict[str, Any] = {"query": query}
    if language is not None:
        payload["language"] = language
    if conversation_history is not None:
        payload["conversation_history"] = conversation_history
    if practice_area is not None:
        payload["practice_area"] = practice_area
    return await _post("/ai/consult", payload, timeout=timeout)


async def ocr_document(document_id: str, grid_uri: str, *, timeout: float = 5.0) -> Optional[dict]:
    """POST /ai/documents/ocr — fire-and-forget OCR trigger.

    KNOWN GAP: ai_service currently exposes no OCR endpoint (only
    /ai/documents/generate and /ai/documents/review). This call returns None
    until an OCR route is implemented server-side. Kept here so the trigger
    works automatically once that endpoint exists. See tests/contract.py.
    """
    return await _post(
        "/ai/documents/ocr",
        {"document_id": document_id, "grid_uri": grid_uri},
        timeout=timeout,
    )


async def match_score(
    case_description: str,
    lawyer_id: str,
    *,
    lawyer_profile: Optional[dict] = None,
    timeout: float = 10.0,
) -> Optional[dict]:
    """POST /ai/match/score — score ONE lawyer against a case.

    ai_service returns {"score": 0-1, "reason": "..."} for a single lawyer.
    To rank a list of lawyers, the caller must fetch candidate profiles and
    call this once per candidate (see tests/contract.py → KNOWN GAP for the
    marketplace list-matching flow that still needs building).
    """
    return await _post(
        "/ai/match/score",
        {
            "case_description": case_description,
            "lawyer_id": lawyer_id,
            "lawyer_profile": lawyer_profile,
        },
        timeout=timeout,
    )


async def case_complexity(
    case_facts: str,
    *,
    practice_area: Optional[str] = None,
    timeout: float = 10.0,
) -> Optional[dict]:
    """POST /ai/match/complexity — case complexity / tier recommendation.

    ai_service field is `case_description`; we accept `case_facts` (the backend's
    name) and map it.
    """
    return await _post(
        "/ai/match/complexity",
        {"case_description": case_facts, "practice_area": practice_area},
        timeout=timeout,
    )


async def predict_outcome(
    *,
    case_type: str,
    jurisdiction: Optional[str],
    facts_summary: str,
    judge_id: Optional[str] = None,
    timeout: float = 10.0,
) -> Optional[dict]:
    """POST /ai/predict — case outcome prediction.

    ai_service PredictRequest fields are case_facts / practice_area / court.
    Map the backend's fields onto them (judge_id has no server-side slot yet).
    """
    return await _post(
        "/ai/predict",
        {
            "case_facts": facts_summary,
            "practice_area": case_type or "",
            "court": jurisdiction or "",
        },
        timeout=timeout,
    )


async def judge_insights(judge_id: str, *, timeout: float = 10.0) -> Optional[dict]:
    """POST /ai/judge-analytics/judge — judge analytics.

    ai_service expects a JudgeAnalyticsRequest with `judge_name` (POST, not GET).
    The backend only has a judge id/slug; we pass it as judge_name. NOTE: the
    server does best-effort name matching, so results are only meaningful when
    the id is (or resembles) the judge's name.
    """
    return await _post(
        "/ai/judge-analytics/judge",
        {"judge_name": judge_id},
        timeout=timeout,
    )
