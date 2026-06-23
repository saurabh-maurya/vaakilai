"""
G11 — IP Portfolio Management
Track patents, trademarks, copyrights, and designs.
Renewal reminders, status updates, and agent assignments.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
from enum import Enum

from database import get_db
from middleware.auth_middleware import get_current_user, require_lawyer_pro

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Enums ──────────────────────────────────────────────────────────────────────

class IPType(str, Enum):
    PATENT      = "patent"
    TRADEMARK   = "trademark"
    COPYRIGHT   = "copyright"
    DESIGN      = "design"
    TRADE_SECRET = "trade_secret"
    GI_TAG      = "gi_tag"


class IPStatus(str, Enum):
    FILED       = "filed"
    PENDING     = "pending"
    EXAMINATION = "examination"
    PUBLISHED   = "published"
    OPPOSED     = "opposed"
    GRANTED     = "granted"
    REGISTERED  = "registered"
    RENEWED     = "renewed"
    ABANDONED   = "abandoned"
    EXPIRED     = "expired"
    LAPSED      = "lapsed"


# ── Models ─────────────────────────────────────────────────────────────────────

class IPAssetCreate(BaseModel):
    title: str
    ip_type: IPType
    application_number: Optional[str] = None
    registration_number: Optional[str] = None
    filing_date: Optional[str] = None
    registration_date: Optional[str] = None
    expiry_date: Optional[str] = None
    renewal_due_date: Optional[str] = None
    status: IPStatus = IPStatus.PENDING
    owner_name: str = ""
    inventor_names: List[str] = Field(default_factory=list)
    classes: List[str] = Field(default_factory=list, description="Trademark Nice classes or patent IPC codes")
    jurisdiction: str = "India"
    agent_name: Optional[str] = None
    agent_email: Optional[str] = None
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    client_id: Optional[str] = None
    case_id: Optional[str] = None


class IPAssetUpdate(BaseModel):
    title: Optional[str] = None
    application_number: Optional[str] = None
    registration_number: Optional[str] = None
    filing_date: Optional[str] = None
    registration_date: Optional[str] = None
    expiry_date: Optional[str] = None
    renewal_due_date: Optional[str] = None
    status: Optional[IPStatus] = None
    owner_name: Optional[str] = None
    agent_name: Optional[str] = None
    agent_email: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None


class IPAction(BaseModel):
    action: str = Field(..., description="e.g. 'Filed response to examination report'")
    action_date: str
    notes: str = ""
    document_ref: Optional[str] = None


def _doc_out(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


def _days_until(date_str: Optional[str]) -> Optional[int]:
    if not date_str:
        return None
    try:
        target = datetime.fromisoformat(date_str)
        return (target - datetime.utcnow()).days
    except Exception:
        return None


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/", status_code=201)
async def create_ip_asset(
    payload: IPAssetCreate,
    current_user: dict = Depends(require_lawyer_pro()),
):
    """
    Add a new IP asset to the portfolio.
    Actions log is initialised empty; add entries via /actions endpoint.
    """
    db = get_db()
    now = datetime.utcnow().isoformat()
    doc = {
        **payload.model_dump(),
        "lawyer_id": current_user["user_id"],
        "actions": [],   # prosecution action log (responses, renewals, etc.)
        "created_at": now,
        "updated_at": now,
    }
    result = await db.ip_assets.insert_one(doc)
    logger.info(f"IP asset created: {result.inserted_id} type={payload.ip_type} title='{payload.title}'")
    return {"id": str(result.inserted_id)}


@router.get("/")
async def list_ip_assets(
    ip_type: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    client_id: Optional[str] = Query(default=None),
    renewing_days: Optional[int] = Query(default=None, description="Assets with renewal due within N days"),
    current_user: dict = Depends(require_lawyer_pro()),
):
    db = get_db()
    query: dict = {"lawyer_id": current_user["user_id"]}
    if ip_type:
        query["ip_type"] = ip_type
    if status:
        query["status"] = status
    if client_id:
        query["client_id"] = client_id

    cursor = db.ip_assets.find(query).sort("created_at", -1)
    docs = [_doc_out(d) async for d in cursor]

    for doc in docs:
        doc["days_until_renewal"] = _days_until(doc.get("renewal_due_date"))
        doc["days_until_expiry"] = _days_until(doc.get("expiry_date"))

    if renewing_days is not None:
        docs = [
            d for d in docs
            if d.get("days_until_renewal") is not None and 0 <= d["days_until_renewal"] <= renewing_days
        ]

    return {"assets": docs, "total": len(docs)}


@router.get("/renewals")
async def get_upcoming_renewals(
    days: int = Query(default=60),
    current_user: dict = Depends(require_lawyer_pro()),
):
    """Assets with renewal due within N days — for alerts."""
    db = get_db()
    cursor = db.ip_assets.find({"lawyer_id": current_user["user_id"], "renewal_due_date": {"$ne": None}})
    docs = [_doc_out(d) async for d in cursor]
    due = []
    for doc in docs:
        d = _days_until(doc.get("renewal_due_date"))
        if d is not None and 0 <= d <= days:
            doc["days_until_renewal"] = d
            due.append(doc)
    due.sort(key=lambda x: x["days_until_renewal"])
    return {"renewals": due, "total": len(due), "within_days": days}


@router.get("/{asset_id}")
async def get_ip_asset(
    asset_id: str,
    current_user: dict = Depends(require_lawyer_pro()),
):
    db = get_db()
    try:
        oid = ObjectId(asset_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid asset ID")
    doc = await db.ip_assets.find_one({"_id": oid, "lawyer_id": current_user["user_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="IP asset not found")
    doc = _doc_out(doc)
    doc["days_until_renewal"] = _days_until(doc.get("renewal_due_date"))
    doc["days_until_expiry"] = _days_until(doc.get("expiry_date"))
    return doc


@router.patch("/{asset_id}")
async def update_ip_asset(
    asset_id: str,
    payload: IPAssetUpdate,
    current_user: dict = Depends(require_lawyer_pro()),
):
    db = get_db()
    try:
        oid = ObjectId(asset_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid asset ID")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.utcnow().isoformat()
    result = await db.ip_assets.update_one(
        {"_id": oid, "lawyer_id": current_user["user_id"]},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="IP asset not found")
    return {"updated": True}


@router.delete("/{asset_id}", status_code=204)
async def delete_ip_asset(
    asset_id: str,
    current_user: dict = Depends(require_lawyer_pro()),
):
    db = get_db()
    try:
        oid = ObjectId(asset_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid asset ID")
    result = await db.ip_assets.delete_one({"_id": oid, "lawyer_id": current_user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="IP asset not found")


@router.post("/{asset_id}/actions", status_code=201)
async def add_action(
    asset_id: str,
    payload: IPAction,
    current_user: dict = Depends(require_lawyer_pro()),
):
    db = get_db()
    try:
        oid = ObjectId(asset_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid asset ID")
    action = {**payload.model_dump(), "logged_at": datetime.utcnow().isoformat()}
    result = await db.ip_assets.update_one(
        {"_id": oid, "lawyer_id": current_user["user_id"]},
        {"$push": {"actions": action}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="IP asset not found")
    return {"added": True}


@router.get("/stats/summary")
async def ip_stats(current_user: dict = Depends(require_lawyer_pro())):
    db = get_db()
    pipeline = [
        {"$match": {"lawyer_id": current_user["user_id"]}},
        {"$group": {"_id": "$ip_type", "count": {"$sum": 1}, "statuses": {"$push": "$status"}}},
    ]
    cursor = db.ip_assets.aggregate(pipeline)
    stats = {doc["_id"]: {"count": doc["count"]} async for doc in cursor}
    return {"by_type": stats}
