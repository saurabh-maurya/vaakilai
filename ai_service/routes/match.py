from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from slowapi import Limiter
from slowapi.util import get_remote_address

from agents.matching_agent import score_lawyer_match, assess_case_complexity
from middleware.auth_middleware import get_current_user

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


class MatchScoreRequest(BaseModel):
    case_description: str = Field(..., min_length=10, max_length=3000)
    lawyer_id: str = Field(..., max_length=100)
    lawyer_profile: Optional[Dict[str, Any]] = None


class ComplexityRequest(BaseModel):
    case_description: str = Field(..., min_length=10, max_length=3000)
    practice_area: Optional[str] = Field(None, max_length=100)


@router.post("/score")
@limiter.limit("30/minute")
async def match_score(request: Request, payload: MatchScoreRequest, current_user: dict = Depends(get_current_user)):
    profile = payload.lawyer_profile or {"id": payload.lawyer_id}
    result = await score_lawyer_match(payload.case_description, profile)
    return result


@router.post("/complexity")
@limiter.limit("30/minute")
async def case_complexity(request: Request, payload: ComplexityRequest, current_user: dict = Depends(get_current_user)):
    result = await assess_case_complexity(payload.case_description, payload.practice_area)
    return result
