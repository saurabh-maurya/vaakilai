from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from typing import Optional, Dict
from slowapi import Limiter
from slowapi.util import get_remote_address

from agents.document_agent import run_generate, run_review
from middleware.auth_middleware import require_pro_plan

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

MAX_TEXT_LEN = 50_000


class GenerateRequest(BaseModel):
    template_id: str = Field(..., max_length=100)
    fields: Dict[str, str] = {}
    jurisdiction: Optional[str] = Field("India", max_length=100)


class ReviewRequest(BaseModel):
    document_text: str = Field(..., min_length=10, max_length=MAX_TEXT_LEN)


@router.post("/generate")
@limiter.limit("10/minute")
async def generate_document(request: Request, payload: GenerateRequest, current_user: dict = Depends(require_pro_plan)):
    result = await run_generate(payload.template_id, payload.fields)
    return result


@router.post("/review")
@limiter.limit("10/minute")
async def review_document(request: Request, payload: ReviewRequest, current_user: dict = Depends(require_pro_plan)):
    result = await run_review(payload.document_text)
    return result
