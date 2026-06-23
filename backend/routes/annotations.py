"""
G9 — Case Annotations
Per-lawyer private annotations on any case (eCourts case or internal case).
Supports tags, highlights, and nested threads.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId

from database import get_db
from middleware.auth_middleware import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Models ─────────────────────────────────────────────────────────────────────

class AnnotationCreate(BaseModel):
    case_ref: str = Field(..., description="Internal case_id OR eCourts case number")
    ref_type: str = Field(default="internal", description="internal | ecourts | external")
    text: str = Field(..., min_length=1)
    quote: Optional[str] = None        # highlighted text excerpt
    page_ref: Optional[str] = None     # e.g. "para 12" or "page 4"
    tags: List[str] = Field(default_factory=list)
    color: str = Field(default="yellow", description="yellow|green|blue|red|purple")
    is_private: bool = True


class AnnotationUpdate(BaseModel):
    text: Optional[str] = None
    tags: Optional[List[str]] = None
    color: Optional[str] = None
    is_private: Optional[bool] = None


class ThreadReply(BaseModel):
    text: str = Field(..., min_length=1)


def _doc_out(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/", status_code=201)
async def create_annotation(
    payload: AnnotationCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new annotation on a case reference."""
    db = get_db()
    now = datetime.utcnow().isoformat()
    doc = {
        **payload.model_dump(),
        "lawyer_id": current_user["user_id"],
        "created_at": now,
        "updated_at": now,
        "replies": [],  # thread replies added via /reply endpoint
    }
    result = await db.annotations.insert_one(doc)
    logger.info(f"Annotation created: {result.inserted_id} on case_ref={payload.case_ref}")
    return {"id": str(result.inserted_id), "created_at": now}


@router.get("/")
async def list_annotations(
    case_ref: Optional[str] = Query(default=None),
    tag: Optional[str] = Query(default=None),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {"lawyer_id": current_user["user_id"]}
    if case_ref:
        query["case_ref"] = case_ref
    if tag:
        query["tags"] = tag
    cursor = db.annotations.find(query).sort("created_at", -1)
    docs = [_doc_out(d) async for d in cursor]
    return {"annotations": docs, "total": len(docs)}


@router.get("/{annotation_id}")
async def get_annotation(
    annotation_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    try:
        oid = ObjectId(annotation_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid annotation ID")
    doc = await db.annotations.find_one({"_id": oid, "lawyer_id": current_user["user_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Annotation not found")
    return _doc_out(doc)


@router.patch("/{annotation_id}")
async def update_annotation(
    annotation_id: str,
    payload: AnnotationUpdate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    try:
        oid = ObjectId(annotation_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid annotation ID")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.utcnow().isoformat()
    result = await db.annotations.update_one(
        {"_id": oid, "lawyer_id": current_user["user_id"]},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Annotation not found")
    return {"updated": True}


@router.delete("/{annotation_id}", status_code=204)
async def delete_annotation(
    annotation_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    try:
        oid = ObjectId(annotation_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid annotation ID")
    result = await db.annotations.delete_one(
        {"_id": oid, "lawyer_id": current_user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Annotation not found")


@router.post("/{annotation_id}/reply", status_code=201)
async def add_reply(
    annotation_id: str,
    payload: ThreadReply,
    current_user: dict = Depends(get_current_user),
):
    """Add a threaded reply to an existing annotation."""
    db = get_db()
    try:
        oid = ObjectId(annotation_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid annotation ID")
    reply = {
        "author_id": current_user["user_id"],
        "text": payload.text,
        "created_at": datetime.utcnow().isoformat(),
    }
    result = await db.annotations.update_one(
        {"_id": oid, "lawyer_id": current_user["user_id"]},
        {"$push": {"replies": reply}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Annotation not found")
    return {"replied": True}


@router.get("/tags/all")
async def get_all_tags(current_user: dict = Depends(get_current_user)):
    """List all unique tags used by this lawyer."""
    db = get_db()
    pipeline = [
        {"$match": {"lawyer_id": current_user["user_id"]}},
        {"$unwind": "$tags"},
        {"$group": {"_id": "$tags"}},
        {"$sort": {"_id": 1}},
    ]
    cursor = db.annotations.aggregate(pipeline)
    tags = [doc["_id"] async for doc in cursor]
    return {"tags": tags}
