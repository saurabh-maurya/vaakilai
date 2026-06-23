"""
RAG Case Search routes.
GET  /ai/cases/search          — semantic search
GET  /ai/cases/{id}            — full case detail
POST /ai/cases/{id}/search     — AI search within a case
POST /ai/cases/index/url       — index cases from Indian Kanoon by query
POST /ai/cases/index/upload    — index uploaded PDF
GET  /ai/cases/stats           — index stats
"""

import logging
from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Depends
from middleware.auth_middleware import get_current_user
from pydantic import BaseModel

from rag.case_search import search_cases, get_case_by_id, search_within_case
from rag.vector_store import case_store
from rag.indian_kanoon_scraper import bulk_scrape
from rag.pdf_indexer import build_case_from_pdf, ai_extract_case_metadata
from providers.factory import get_llm_provider

router = APIRouter()
logger = logging.getLogger(__name__)


class IndexByQueryRequest(BaseModel):
    queries: list[str]
    cases_per_query: int = 5


class CaseSearchRequest(BaseModel):
    query: str


@router.get("/search")
async def search(
    q: str = Query(..., description="Search query"),
    k: int = Query(10, ge=1, le=50),
    practice_area: str = Query(""),
    year_from: int = Query(0),
    year_to: int = Query(0),
):
    if not q.strip():
        raise HTTPException(400, "Query cannot be empty")
    results = await search_cases(q, k=k, practice_area=practice_area, year_from=year_from, year_to=year_to)
    return results


@router.get("/stats")
async def stats(current_user: dict = Depends(get_current_user)):
    return {
        "total_cases": case_store.total_cases(),
        "index_path": case_store.index_path,
    }


@router.get("/{case_id}")
async def get_case(case_id: str, current_user: dict = Depends(get_current_user)):
    case = await get_case_by_id(case_id)
    if not case:
        raise HTTPException(404, "Case not found")
    return case


@router.post("/{case_id}/search")
async def search_in_case(case_id: str, body: CaseSearchRequest, current_user: dict = Depends(get_current_user)):
    result = await search_within_case(case_id, body.query)
    return result


@router.post("/index/url")
async def index_from_indian_kanoon(body: IndexByQueryRequest, current_user: dict = Depends(get_current_user)):
    """Scrape Indian Kanoon and index cases into FAISS."""
    cases = await bulk_scrape(body.queries, cases_per_query=body.cases_per_query)
    if not cases:
        return {"indexed": 0, "message": "No cases found"}
    count = await case_store.add_cases(cases)
    return {"indexed": count, "total": case_store.total_cases()}


@router.post("/index/upload")
async def index_uploaded_pdf(file: UploadFile = File(...)):
    """Upload a judgment PDF and index it."""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(400, "Only PDF files accepted")

    pdf_bytes = await file.read()
    if len(pdf_bytes) > 10 * 1024 * 1024:
        raise HTTPException(400, "PDF too large (max 10MB)")

    # Build case dict from PDF
    case = build_case_from_pdf(pdf_bytes, file.filename, uploader_id="admin")

    # Enrich with AI metadata
    provider = get_llm_provider()
    metadata = await ai_extract_case_metadata(case["full_text"], provider)
    if metadata:
        case.update({k: v for k, v in metadata.items() if v})

    count = await case_store.add_cases([case])
    return {"indexed": count, "case_id": case["id"], "title": case.get("title", "")}
