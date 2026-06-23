"""
G8 — Contract Lifecycle Management (CLM)
Track contracts: drafting → review → signing → active → expired/renewed.
Supports clause extraction, expiry reminders, and version history.
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

class ContractStatus(str, Enum):
    DRAFT       = "draft"
    UNDER_REVIEW = "under_review"
    PENDING_SIGN = "pending_sign"
    ACTIVE      = "active"
    EXPIRED     = "expired"
    TERMINATED  = "terminated"
    RENEWED     = "renewed"


class ContractType(str, Enum):
    NDA             = "nda"
    EMPLOYMENT      = "employment"
    SERVICE         = "service"
    LEASE           = "lease"
    PARTNERSHIP     = "partnership"
    SHAREHOLDER     = "shareholder"
    VENDOR          = "vendor"
    LOAN            = "loan"
    IP_ASSIGNMENT   = "ip_assignment"
    OTHER           = "other"


# ── Models ─────────────────────────────────────────────────────────────────────

class ContractCreate(BaseModel):
    title: str
    contract_type: ContractType = ContractType.OTHER
    parties: List[str] = Field(default_factory=list, description="List of party names")
    value: Optional[float] = None          # contract value in INR
    currency: str = "INR"
    start_date: Optional[str] = None       # ISO date string
    end_date: Optional[str] = None         # ISO date string
    auto_renew: bool = False
    notice_period_days: int = 30           # days before expiry to alert
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    case_id: Optional[str] = None          # link to internal case


class ContractUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[ContractStatus] = None
    parties: Optional[List[str]] = None
    value: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    auto_renew: Optional[bool] = None
    notice_period_days: Optional[int] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None


class ClauseNote(BaseModel):
    clause_title: str
    clause_text: str
    risk_level: str = Field(default="medium", description="low|medium|high")
    notes: str = ""


class ContractMilestone(BaseModel):
    title: str
    due_date: str
    description: str = ""


def _doc_out(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


def _days_until(date_str: str) -> Optional[int]:
    try:
        target = datetime.fromisoformat(date_str)
        return (target - datetime.utcnow()).days
    except Exception:
        return None


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/", status_code=201)
async def create_contract(
    payload: ContractCreate,
    current_user: dict = Depends(require_lawyer_pro()),
):
    """
    Create a new contract record in DRAFT status.
    Version history and clause vault are initialised empty.
    """
    db = get_db()
    now = datetime.utcnow().isoformat()
    doc = {
        **payload.model_dump(),
        "lawyer_id": current_user["user_id"],
        "status": ContractStatus.DRAFT,
        "version": 1,                # incremented on each update
        "version_history": [],       # snapshots of previous versions
        "clauses": [],               # extracted/annotated clauses
        "milestones": [],            # key contractual milestones
        "created_at": now,
        "updated_at": now,
    }
    result = await db.contracts.insert_one(doc)
    logger.info(f"Contract created: {result.inserted_id} title='{payload.title}' by lawyer={current_user['user_id']}")
    return {"id": str(result.inserted_id), "status": "draft"}


@router.get("/")
async def list_contracts(
    status: Optional[str] = Query(default=None),
    contract_type: Optional[str] = Query(default=None),
    expiring_days: Optional[int] = Query(default=None, description="Show contracts expiring within N days"),
    current_user: dict = Depends(require_lawyer_pro()),
):
    db = get_db()
    query: dict = {"lawyer_id": current_user["user_id"]}
    if status:
        query["status"] = status
    if contract_type:
        query["contract_type"] = contract_type

    cursor = db.contracts.find(query).sort("created_at", -1)
    docs = [_doc_out(d) async for d in cursor]

    # Add computed fields
    for doc in docs:
        if doc.get("end_date"):
            doc["days_until_expiry"] = _days_until(doc["end_date"])
        else:
            doc["days_until_expiry"] = None

    if expiring_days is not None:
        docs = [
            d for d in docs
            if d.get("days_until_expiry") is not None and 0 <= d["days_until_expiry"] <= expiring_days
        ]

    return {"contracts": docs, "total": len(docs)}


@router.get("/expiring")
async def get_expiring_contracts(
    days: int = Query(default=30),
    current_user: dict = Depends(require_lawyer_pro()),
):
    """Contracts expiring within N days — for dashboard alerts."""
    db = get_db()
    cursor = db.contracts.find({
        "lawyer_id": current_user["user_id"],
        "status": ContractStatus.ACTIVE,
        "end_date": {"$ne": None},
    })
    docs = [_doc_out(d) async for d in cursor]
    expiring = []
    for doc in docs:
        d = _days_until(doc.get("end_date", ""))
        if d is not None and 0 <= d <= days:
            doc["days_until_expiry"] = d
            expiring.append(doc)
    expiring.sort(key=lambda x: x["days_until_expiry"])
    return {"expiring": expiring, "total": len(expiring), "within_days": days}


@router.get("/{contract_id}")
async def get_contract(
    contract_id: str,
    current_user: dict = Depends(require_lawyer_pro()),
):
    db = get_db()
    try:
        oid = ObjectId(contract_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid contract ID")
    doc = await db.contracts.find_one({"_id": oid, "lawyer_id": current_user["user_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Contract not found")
    doc = _doc_out(doc)
    if doc.get("end_date"):
        doc["days_until_expiry"] = _days_until(doc["end_date"])
    return doc


@router.patch("/{contract_id}")
async def update_contract(
    contract_id: str,
    payload: ContractUpdate,
    current_user: dict = Depends(require_lawyer_pro()),
):
    db = get_db()
    try:
        oid = ObjectId(contract_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid contract ID")

    existing = await db.contracts.find_one({"_id": oid, "lawyer_id": current_user["user_id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Contract not found")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.utcnow().isoformat()

    # Bump version and save snapshot
    new_version = existing.get("version", 1) + 1
    snapshot = {
        "version": existing.get("version", 1),
        "snapshot_at": existing.get("updated_at"),
        "status": existing.get("status"),
    }
    await db.contracts.update_one(
        {"_id": oid},
        {
            "$set": {**updates, "version": new_version},
            "$push": {"version_history": snapshot},
        },
    )
    return {"updated": True, "version": new_version}


@router.delete("/{contract_id}", status_code=204)
async def delete_contract(
    contract_id: str,
    current_user: dict = Depends(require_lawyer_pro()),
):
    db = get_db()
    try:
        oid = ObjectId(contract_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid contract ID")
    result = await db.contracts.delete_one({"_id": oid, "lawyer_id": current_user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contract not found")


@router.post("/{contract_id}/clauses", status_code=201)
async def add_clause(
    contract_id: str,
    payload: ClauseNote,
    current_user: dict = Depends(require_lawyer_pro()),
):
    db = get_db()
    try:
        oid = ObjectId(contract_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid contract ID")
    clause = {**payload.model_dump(), "added_at": datetime.utcnow().isoformat()}
    result = await db.contracts.update_one(
        {"_id": oid, "lawyer_id": current_user["user_id"]},
        {"$push": {"clauses": clause}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Contract not found")
    return {"added": True}


@router.post("/{contract_id}/milestones", status_code=201)
async def add_milestone(
    contract_id: str,
    payload: ContractMilestone,
    current_user: dict = Depends(require_lawyer_pro()),
):
    db = get_db()
    try:
        oid = ObjectId(contract_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid contract ID")
    milestone = {**payload.model_dump(), "completed": False, "added_at": datetime.utcnow().isoformat()}
    result = await db.contracts.update_one(
        {"_id": oid, "lawyer_id": current_user["user_id"]},
        {"$push": {"milestones": milestone}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Contract not found")
    return {"added": True}


@router.get("/stats/summary")
async def contract_stats(current_user: dict = Depends(require_lawyer_pro())):
    """Dashboard stats for contracts."""
    db = get_db()
    pipeline = [
        {"$match": {"lawyer_id": current_user["user_id"]}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}, "total_value": {"$sum": "$value"}}},
    ]
    cursor = db.contracts.aggregate(pipeline)
    stats = {doc["_id"]: {"count": doc["count"], "value": doc.get("total_value", 0)} async for doc in cursor}
    return {"stats": stats}
