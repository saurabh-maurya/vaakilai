"""
Legal Tasks API — powered by Aalap (OpenNyAI Mistral 7B).

POST /ai/legal-tasks/argument-builder   — generate petitioner + respondent arguments
POST /ai/legal-tasks/issue-spotter      — identify legal issues from case facts
POST /ai/legal-tasks/event-timeline     — extract chronological event timeline
POST /ai/legal-tasks/statute-breakdown  — break statute into ingredients/elements
GET  /ai/legal-tasks/status             — shows Aalap enable/disable status
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from middleware.auth_middleware import require_pro_plan
from pydantic import BaseModel, Field
from typing import Optional

from agents.aalap_agent import (
    generate_arguments,
    spot_issues,
    extract_event_timeline,
    breakdown_statute,
)
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Request / Response models ─────────────────────────────────────────────────

class ArgumentBuilderRequest(BaseModel):
    case_facts: str = Field(..., min_length=50, description="Detailed case facts")
    issues: Optional[str] = Field("", description="Legal issues (optional — will be auto-spotted if blank)")
    statutes: Optional[str] = Field("", description="Relevant statutes/sections (optional)")
    practice_area: Optional[str] = Field("", description="Area of law (e.g. Criminal, Contract)")


class IssueSpotterRequest(BaseModel):
    case_facts: str = Field(..., min_length=50, description="Case facts or dispute description")
    practice_area: Optional[str] = Field("", description="Area of law")
    court: Optional[str] = Field("", description="Court where matter is filed")


class EventTimelineRequest(BaseModel):
    case_description: str = Field(..., min_length=30, description="Case description, FIR text, or facts")
    source_type: Optional[str] = Field("case", description="'case' or 'fir'")


class StatuteBreakdownRequest(BaseModel):
    statute_text: str = Field(..., min_length=20, description="Full text of the statute section")
    statute_name: Optional[str] = Field("", description="E.g. 'Section 420 IPC' or 'Article 21 Constitution'")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/status")
async def legal_tasks_status(current_user: dict = Depends(require_pro_plan)):
    return {
        "aalap_enabled": settings.aalap_enabled,
        "aalap_model": settings.aalap_model,
        "fallback_provider": settings.ai_provider,
        "hf_token_set": bool(settings.huggingface_api_token),
        "message": (
            f"Routing to Aalap ({settings.aalap_model}) via HuggingFace Inference API"
            if settings.aalap_enabled
            else f"Aalap disabled — using {settings.ai_provider} provider as fallback. "
                 "Set AALAP_ENABLED=true in .env to enable Aalap."
        ),
    }


@router.post("/argument-builder")
async def argument_builder(req: ArgumentBuilderRequest, current_user: dict = Depends(require_pro_plan)):
    """
    Generate structured petitioner arguments and respondent counter-arguments.
    Powered by Aalap when enabled, general LLM otherwise.
    """
    try:
        result = await generate_arguments(
            case_facts=req.case_facts,
            issues=req.issues or "",
            statutes=req.statutes or "",
            practice_area=req.practice_area or "",
        )
        return result
    except Exception as e:
        logger.error(f"Argument builder failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/issue-spotter")
async def issue_spotter(req: IssueSpotterRequest, current_user: dict = Depends(require_pro_plan)):
    """
    Identify key legal issues from case facts.
    """
    try:
        result = await spot_issues(
            case_facts=req.case_facts,
            practice_area=req.practice_area or "",
            court=req.court or "",
        )
        return result
    except Exception as e:
        logger.error(f"Issue spotter failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/event-timeline")
async def event_timeline(req: EventTimelineRequest, current_user: dict = Depends(require_pro_plan)):
    """
    Extract chronological event timeline from case description or FIR.
    """
    try:
        result = await extract_event_timeline(
            case_description=req.case_description,
            source_type=req.source_type or "case",
        )
        return result
    except Exception as e:
        logger.error(f"Event timeline extraction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/statute-breakdown")
async def statute_breakdown(req: StatuteBreakdownRequest, current_user: dict = Depends(require_pro_plan)):
    """
    Break a statute/section into ingredients, burden of proof, exceptions, and punishment.
    """
    try:
        result = await breakdown_statute(
            statute_text=req.statute_text,
            statute_name=req.statute_name or "",
        )
        return result
    except Exception as e:
        logger.error(f"Statute breakdown failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
