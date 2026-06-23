import html
import json
import re
import asyncio
import logging
from fastapi import APIRouter, Query, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address
from typing import Optional, List, Any
from datetime import datetime
from bson import ObjectId

_log = logging.getLogger(__name__)

from agents.consultation_agent import stream_consultation, consultation_graph, ConsultState
from middleware.auth_middleware import get_current_user

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

MAX_QUERY_LEN = 2000
FREE_DAILY_LIMIT = 5

# ── Prompt injection patterns ─────────────────────────────────────────────────
_INJECTION_PATTERNS = re.compile(
    r"(ignore\s+(previous|above|all|prior)\s+instructions?"
    r"|you\s+are\s+now\s+"
    r"|system\s*prompt"
    r"|jailbreak"
    r"|pretend\s+you\s+are"
    r"|act\s+as\s+(a\s+)?(different|new|unrestricted)"
    r"|disregard\s+(all\s+)?(previous|prior|above)"
    r"|override\s+(your\s+)?(instructions?|guidelines?)"
    r"|forget\s+(your\s+)?(instructions?|training))",
    re.IGNORECASE,
)


def _sanitize_query(query: str) -> str:
    if _INJECTION_PATTERNS.search(query):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query contains disallowed content. Please rephrase your legal question.",
        )
    return query.strip()


# Patterns that must never appear in LLM output returned to clients
_DANGEROUS_OUTPUT_RE = re.compile(
    r"<script[\s\S]*?>[\s\S]*?</script>|"
    r"javascript\s*:|"
    r"on\w+\s*=\s*['\"][^'\"]*['\"]",
    re.IGNORECASE,
)


def _sanitize_llm_output(text: str) -> str:
    """Strip dangerous HTML/JS patterns from LLM-generated text (defence-in-depth)."""
    if not text:
        return text
    return _DANGEROUS_OUTPUT_RE.sub("", text)


# ── Structured output schema (AI6) ────────────────────────────────────────────

class _ConsultOutput(BaseModel):
    """Pydantic schema enforced on every LLM response before it leaves the service."""
    answer: str = Field(default="", max_length=12000)
    citations: List[Any] = Field(default_factory=list, max_length=20)
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    practice_area: str = Field(default="", max_length=200)
    disclaimer: str = Field(default="", max_length=2000)


def _validate_output(raw: dict) -> dict:
    """Validate and sanitize LLM result dict against _ConsultOutput schema."""
    try:
        validated = _ConsultOutput(
            answer=_sanitize_llm_output(str(raw.get("answer", ""))),
            citations=[c for c in raw.get("citations", []) if isinstance(c, dict)][:20],
            confidence=max(0.0, min(1.0, float(raw.get("confidence", 0.5)))),
            practice_area=str(raw.get("classified_area", ""))[:200],
            disclaimer=_sanitize_llm_output(str(raw.get("disclaimer", ""))),
        )
        return validated.model_dump()
    except Exception as exc:
        _log.warning("Consultation output validation failed: %s", exc)
        return {
            "answer": "I was unable to process your request safely. Please try again.",
            "citations": [],
            "confidence": 0.0,
            "practice_area": "",
            "disclaimer": "Response validation failed. This is a safe fallback.",
        }


# ── AI usage telemetry (AI7) ──────────────────────────────────────────────────

async def _record_usage(user_id: str, query: str, answer: str, endpoint: str) -> None:
    """Persist AI usage metrics for cost monitoring and abuse detection."""
    from main import get_db as _get_db
    db = _get_db()
    if db is None:
        return
    # Rough token estimates (4 chars ≈ 1 token)
    input_tok = len(query) // 4
    output_tok = len(answer) // 4
    try:
        await db.ai_usage.insert_one({
            "user_id": user_id,
            "endpoint": endpoint,
            "input_tokens_est": input_tok,
            "output_tokens_est": output_tok,
            "total_tokens_est": input_tok + output_tok,
            # Rough USD cost at ~$3/M input + $15/M output (Sonnet pricing)
            "cost_usd_est": round((input_tok * 3 + output_tok * 15) / 1_000_000, 6),
            "ts": datetime.utcnow(),
        })
    except Exception as exc:
        _log.debug("AI usage record failed: %s", exc)


async def _enforce_query_limit(user_id: str) -> None:
    """Enforce free-plan daily AI query limit using the shared MongoDB."""
    from main import get_db as _get_db
    from config import settings as _settings
    db = _get_db()
    if db is None:
        # Fail-closed in production — deny free-tier queries when DB is unreachable.
        # In development, allow queries to proceed without DB.
        if _settings.app_env == "production":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Query limit service temporarily unavailable. Please try again shortly.",
            )
        return

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return

    plan = user.get("subscription_plan", "free")
    if plan != "free":
        return  # Paid plans have no daily limit

    count = user.get("ai_query_count", 0)
    reset_date = user.get("ai_query_reset_date")
    today = datetime.utcnow().date()

    # Reset counter at the start of each day
    if reset_date is None or (hasattr(reset_date, "date") and reset_date.date() < today):
        count = 0
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"ai_query_count": 0, "ai_query_reset_date": datetime.utcnow()}},
        )

    if count >= FREE_DAILY_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily AI query limit reached ({FREE_DAILY_LIMIT}/day on free plan). Upgrade to continue.",
        )

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$inc": {"ai_query_count": 1}},
    )


# ── Models ────────────────────────────────────────────────────────────────────

_ALLOWED_ROLES = {"user", "assistant"}


class ConversationMessage(BaseModel):
    role: str
    content: str = Field(..., max_length=4000)

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in _ALLOWED_ROLES:
            raise ValueError(f"Invalid role '{v}'. Must be one of: {sorted(_ALLOWED_ROLES)}")
        return v


MAX_HISTORY_ITEMS = 20  # cap conversation context to prevent token-cost abuse


class ConsultRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=MAX_QUERY_LEN)
    jurisdiction: Optional[str] = Field("", max_length=100)
    practice_area: Optional[str] = Field("", max_length=100)
    language: Optional[str] = Field("en", max_length=10)
    conversation_history: Optional[List[ConversationMessage]] = Field(default=[], max_length=MAX_HISTORY_ITEMS)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/stream")
@limiter.limit("30/minute")
async def consult_stream(
    request: Request,
    query: str = Query(..., description="Legal question", max_length=MAX_QUERY_LEN),
    jurisdiction: str = Query("", description="State or jurisdiction", max_length=100),
    practice_area: str = Query("", description="Practice area", max_length=100),
    language: str = Query("en", description="Response language", max_length=10),
    current_user: dict = Depends(get_current_user),
):
    """
    SSE streaming endpoint for AI consultation.
    Each event is a JSON chunk with fields: type, data
    """
    safe_query = _sanitize_query(query)
    await _enforce_query_limit(current_user["user_id"])

    async def event_generator():
        try:
            async for chunk in stream_consultation(
                query=safe_query,
                jurisdiction=jurisdiction,
                practice_area=practice_area,
                language=language,
            ):
                yield f"data: {json.dumps(chunk)}\n\n"
                await asyncio.sleep(0)  # yield control to event loop
        except HTTPException:
            raise
        except Exception as e:
            import logging as _log
            _log.getLogger(__name__).error("Consultation stream error: %s", e, exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'data': 'An error occurred. Please try again.'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("")
@limiter.limit("20/minute")
async def consult_sync(request: Request, payload: ConsultRequest, current_user: dict = Depends(get_current_user)):
    """
    Synchronous (non-streaming) consultation endpoint.
    Runs the full LangGraph consultation pipeline and returns the result.
    """
    safe_query = _sanitize_query(payload.query)
    await _enforce_query_limit(current_user["user_id"])

    history = [{"role": m.role, "content": m.content} for m in (payload.conversation_history or [])]

    initial_state: ConsultState = {
        "query": safe_query,
        "jurisdiction": payload.jurisdiction or "",
        "practice_area": payload.practice_area or "",
        "language": payload.language or "en",
        "conversation_history": history,
    }

    result = await consultation_graph.ainvoke(initial_state)

    # AI6: validate + sanitize structured output
    out = _validate_output(result)

    # AI7: async usage telemetry (fire-and-forget — never blocks the response)
    asyncio.ensure_future(
        _record_usage(current_user["user_id"], safe_query, out["answer"], "sync")
    )

    return out
