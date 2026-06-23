"""
G13 — Citation Graph / Citator
Track case citations: which cases cite a given case, and which cases it cites.
Supports manual entry and bulk import; AI-powered via search endpoint.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
from enum import Enum

from database import get_db
from middleware.auth_middleware import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Enums / Constants ─────────────────────────────────────────────────────────

class TreatmentType(str, Enum):
    FOLLOWED        = "followed"
    DISTINGUISHED   = "distinguished"
    OVERRULED       = "overruled"
    APPROVED        = "approved"
    DOUBTED         = "doubted"
    EXPLAINED       = "explained"
    REFERRED        = "referred"
    NOT_FOLLOWED    = "not_followed"


# ── Models ─────────────────────────────────────────────────────────────────────

class CitationCreate(BaseModel):
    # The case being cited (the anchor)
    cited_case_name: str = Field(..., description="e.g. 'Maneka Gandhi v. Union of India'")
    cited_case_citation: str = Field(..., description="e.g. 'AIR 1978 SC 597'")
    cited_year: Optional[int] = None
    cited_court: Optional[str] = None

    # The citing case (the one that refers to the anchor)
    citing_case_name: str = Field(..., description="e.g. 'KS Puttaswamy v. Union of India'")
    citing_case_citation: str = Field(default="")
    citing_year: Optional[int] = None
    citing_court: Optional[str] = None

    treatment: TreatmentType = TreatmentType.REFERRED
    paragraph_ref: Optional[str] = None   # e.g. "para 42"
    context: Optional[str] = None         # brief note on why cited
    tags: List[str] = Field(default_factory=list)


class CitationSearch(BaseModel):
    case_name: str = Field(..., min_length=2, description="Case name to look up in citation graph")
    direction: str = Field(default="both", description="citing|cited_by|both")


def _doc_out(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


# ── Treatment badge colours (returned for UI) ─────────────────────────────────

TREATMENT_COLORS = {
    "followed":      "green",
    "approved":      "green",
    "referred":      "blue",
    "explained":     "blue",
    "distinguished": "yellow",
    "doubted":       "yellow",
    "not_followed":  "red",
    "overruled":     "red",
}


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/", status_code=201)
async def add_citation(
    payload: CitationCreate,
    current_user: dict = Depends(get_current_user),
):
    """
    Record a citation relationship between two cases.
    treatment_color is pre-computed for fast UI rendering.
    """
    db = get_db()
    now = datetime.utcnow().isoformat()
    doc = {
        **payload.model_dump(),
        "added_by": current_user["user_id"],
        "created_at": now,
        # Pre-compute UI color so the frontend doesn't need a color mapping table
        "treatment_color": TREATMENT_COLORS.get(payload.treatment, "blue"),
    }
    result = await db.citations.insert_one(doc)
    logger.info(f"Citation added: {payload.cited_case_name} ← {payload.citing_case_name} ({payload.treatment})")
    return {"id": str(result.inserted_id)}


@router.get("/")
async def list_citations(
    case_name: Optional[str] = Query(default=None, description="Filter by cited OR citing case name"),
    treatment: Optional[str] = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {"added_by": current_user["user_id"]}
    if case_name:
        query["$or"] = [
            {"cited_case_name": {"$regex": case_name, "$options": "i"}},
            {"citing_case_name": {"$regex": case_name, "$options": "i"}},
        ]
    if treatment:
        query["treatment"] = treatment

    cursor = db.citations.find(query).sort("created_at", -1)
    docs = [_doc_out(d) async for d in cursor]
    return {"citations": docs, "total": len(docs)}


@router.post("/search")
async def search_citation_graph(
    payload: CitationSearch,
    current_user: dict = Depends(get_current_user),
):
    """
    Build a citation graph for a given case name.
    Returns cases that CITE this case (cited_by) and cases THIS case cites (citing).
    """
    db = get_db()
    base = {"added_by": current_user["user_id"]}
    name_regex = {"$regex": payload.case_name, "$options": "i"}

    cited_by: list = []     # cases that cite the anchor
    citing: list = []       # cases the anchor cites

    if payload.direction in ("cited_by", "both"):
        cursor = db.citations.find({**base, "cited_case_name": name_regex})
        cited_by = [_doc_out(d) async for d in cursor]

    if payload.direction in ("citing", "both"):
        cursor = db.citations.find({**base, "citing_case_name": name_regex})
        citing = [_doc_out(d) async for d in cursor]

    return {
        "case_name": payload.case_name,
        "cited_by": cited_by,
        "citing": citing,
        "total_cited_by": len(cited_by),
        "total_citing": len(citing),
    }


@router.get("/{citation_id}")
async def get_citation(
    citation_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    try:
        oid = ObjectId(citation_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid citation ID")
    doc = await db.citations.find_one({"_id": oid, "added_by": current_user["user_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Citation not found")
    return _doc_out(doc)


@router.delete("/{citation_id}", status_code=204)
async def delete_citation(
    citation_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    try:
        oid = ObjectId(citation_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid citation ID")
    result = await db.citations.delete_one({"_id": oid, "added_by": current_user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Citation not found")


@router.get("/stats/treatments")
async def treatment_stats(current_user: dict = Depends(get_current_user)):
    """Breakdown of citation treatments for this user's library."""
    db = get_db()
    pipeline = [
        {"$match": {"added_by": current_user["user_id"]}},
        {"$group": {"_id": "$treatment", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    cursor = db.citations.aggregate(pipeline)
    stats = [{"treatment": d["_id"], "count": d["count"], "color": TREATMENT_COLORS.get(d["_id"], "blue")} async for d in cursor]
    return {"stats": stats}
