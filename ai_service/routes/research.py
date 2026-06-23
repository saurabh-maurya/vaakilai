from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from slowapi import Limiter
from slowapi.util import get_remote_address

from agents.research_agent import search_judgments, find_precedents, generate_research_memo
from middleware.auth_middleware import require_pro_plan

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    court: Optional[str] = Field(None, max_length=100)
    year_from: Optional[int] = None
    practice_area: Optional[str] = Field(None, max_length=100)


class PrecedentRequest(BaseModel):
    facts: str = Field(..., min_length=10, max_length=5000)
    practice_area: str = Field("", max_length=100)


class MemoRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=500)
    judgment_ids: List[str] = Field(default=[], max_length=20)


@router.post("/search")
@limiter.limit("20/minute")
async def research_search(request: Request, payload: SearchRequest, current_user: dict = Depends(require_pro_plan)):
    results = await search_judgments(
        query=payload.query,
        court=payload.court,
        year_from=payload.year_from,
        practice_area=payload.practice_area,
    )
    return results


@router.post("/precedents")
@limiter.limit("10/minute")
async def precedent_finder(request: Request, payload: PrecedentRequest, current_user: dict = Depends(require_pro_plan)):
    results = await find_precedents(payload.facts, payload.practice_area)
    return results


@router.post("/memo")
@limiter.limit("5/minute")
async def research_memo(request: Request, payload: MemoRequest, current_user: dict = Depends(require_pro_plan)):
    memo = await generate_research_memo(payload.topic, payload.judgment_ids)
    return {"memo": memo}
