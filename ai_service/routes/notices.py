"""
Notice Drafting API — advocate-facing legal notice generator.

Runs strictly on the LOCAL AI tool (Ollama). Sensitive client/party details in
notice drafts are never sent to Claude or any hosted API. If the local model is
offline, drafting returns 503 rather than falling back to a cloud provider.

POST /ai/notices/draft   — draft a formal legal notice
GET  /ai/notices/status  — local model availability + supported notice types
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional

from middleware.auth_middleware import require_pro_plan
from agents.notice_agent import draft_notice, NOTICE_TYPES, LocalModelUnavailable
from llm import describe as describe_llm

logger = logging.getLogger(__name__)
router = APIRouter()


class NoticeDraftRequest(BaseModel):
    notice_type: str = Field(..., description="One of the supported notice types (see /status)")
    sender_name: str = Field(..., min_length=2, description="Client / addressor name")
    recipient_name: str = Field(..., min_length=2, description="Noticee / addressee name")
    facts: str = Field(..., min_length=30, description="Facts / background of the dispute")
    demand: str = Field(..., min_length=5, description="Relief / demand sought")
    compliance_days: int = Field(15, ge=1, le=90, description="Days given to comply")
    sender_details: Optional[str] = Field("", description="Client address / other details")
    recipient_details: Optional[str] = Field("", description="Recipient address / other details")
    advocate_name: Optional[str] = Field("", description="Issuing advocate's name")
    extra_instructions: Optional[str] = Field("", description="Additional drafting instructions")


@router.get("/status")
async def notices_status(current_user: dict = Depends(require_pro_plan)):
    b = describe_llm()  # active provider chain (Aalap → Claude → Groq → …)
    ready = b["ready"]
    chain = b.get("chain", [])
    msg = (
        f"AI ready — provider chain: {' → '.join(chain)}."
        if ready
        else "No AI provider configured — set one of ANTHROPIC_API_KEY / GROQ_API_KEY / "
             "GEMINI_API_KEY / HOSTED_LLM_API_KEY in ai_service/.env."
    )
    return {
        "ready": ready,
        "chain": chain,
        "active": chain[0] if chain else None,
        "uses_claude": b.get("uses_claude", False),
        "notice_types": [{"value": k, "description": v} for k, v in NOTICE_TYPES.items()],
        "message": msg,
    }


@router.post("/draft")
async def draft(req: NoticeDraftRequest, current_user: dict = Depends(require_pro_plan)):
    """Draft a formal legal notice using the local Ollama model only."""
    if req.notice_type not in NOTICE_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown notice_type '{req.notice_type}'. Allowed: {sorted(NOTICE_TYPES)}",
        )
    try:
        return await draft_notice(
            notice_type=req.notice_type,
            sender_name=req.sender_name,
            recipient_name=req.recipient_name,
            facts=req.facts,
            demand=req.demand,
            compliance_days=req.compliance_days,
            sender_details=req.sender_details or "",
            recipient_details=req.recipient_details or "",
            advocate_name=req.advocate_name or "",
            extra_instructions=req.extra_instructions or "",
        )
    except LocalModelUnavailable as e:
        # Local model offline — do NOT fall back to a cloud provider.
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Notice drafting failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
