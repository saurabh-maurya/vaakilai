"""
Compliance Tracker — Individual + Corporate.
Tracks court deadlines, limitation periods, MCA/GST/SEBI due dates.
"""

from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from database import get_db
from middleware.auth_middleware import get_current_user

router = APIRouter()

# Pre-defined compliance templates
CORPORATE_TEMPLATES = [
    {"name": "GSTR-1 (Monthly)", "category": "GST", "frequency": "monthly", "day_of_month": 11},
    {"name": "GSTR-3B (Monthly)", "category": "GST", "frequency": "monthly", "day_of_month": 20},
    {"name": "TDS Return (Quarterly)", "category": "Income Tax", "frequency": "quarterly", "months": [7, 10, 1, 4], "day": 31},
    {"name": "MCA Annual Return (MGT-7)", "category": "MCA", "frequency": "annual", "month": 11, "day": 29},
    {"name": "Financial Statement (AOC-4)", "category": "MCA", "frequency": "annual", "month": 10, "day": 29},
    {"name": "Advance Tax Q1", "category": "Income Tax", "frequency": "annual", "month": 6, "day": 15},
    {"name": "Advance Tax Q2", "category": "Income Tax", "frequency": "annual", "month": 9, "day": 15},
    {"name": "Advance Tax Q3", "category": "Income Tax", "frequency": "annual", "month": 12, "day": 15},
    {"name": "Advance Tax Q4", "category": "Income Tax", "frequency": "annual", "month": 3, "day": 15},
]

LIMITATION_PERIODS = {
    "Civil suit (money recovery)": 3,
    "Consumer complaint": 2,
    "Cheque bounce (Section 138)": 1,
    "Service matter": 3,
    "Motor accident claim": 3,
    "Writ petition": 3,
    "Appeal to High Court": 3,
    "Appeal to Supreme Court": 3,
    "Labour dispute": 3,
    "Tax appeal": 2,
}


class ComplianceItemCreate(BaseModel):
    name: str
    category: str           # GST | MCA | Income Tax | Court | Limitation | Custom
    due_date: str           # ISO date string
    description: str = ""
    client_id: Optional[str] = None
    case_id: Optional[str] = None
    reminder_days: List[int] = [30, 7, 1]  # days before due date to remind


class LimitationCalcRequest(BaseModel):
    cause_of_action: str
    incident_date: str  # ISO date
    matter_type: str


@router.post("/items")
async def create_compliance_item(
    body: ComplianceItemCreate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    doc = {
        **body.model_dump(),
        "user_id": str(current_user["sub"]),
        "status": "pending",
        "created_at": datetime.utcnow(),
    }
    result = await db.compliance_items.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return doc


@router.get("/items")
async def list_compliance_items(
    category: str = "",
    status: str = "",
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query: dict = {"user_id": str(current_user["sub"])}
    if category:
        query["category"] = category
    if status:
        query["status"] = status

    items = []
    async for doc in db.compliance_items.find(query).sort("due_date", 1):
        doc["id"] = str(doc.pop("_id"))
        # Add days_remaining
        try:
            due = datetime.fromisoformat(doc["due_date"])
            doc["days_remaining"] = (due - datetime.utcnow()).days
        except Exception:
            doc["days_remaining"] = None
        items.append(doc)
    return {"items": items, "total": len(items)}


@router.get("/upcoming")
async def upcoming_deadlines(
    days: int = 30,
    current_user: dict = Depends(get_current_user),
):
    """Get compliance items due within N days."""
    db = get_db()
    cutoff = (datetime.utcnow() + timedelta(days=days)).isoformat()
    now = datetime.utcnow().isoformat()

    items = []
    async for doc in db.compliance_items.find({
        "user_id": str(current_user["sub"]),
        "due_date": {"$gte": now, "$lte": cutoff},
        "status": {"$ne": "completed"},
    }).sort("due_date", 1):
        doc["id"] = str(doc.pop("_id"))
        due = datetime.fromisoformat(doc["due_date"])
        doc["days_remaining"] = (due - datetime.utcnow()).days
        items.append(doc)
    return {"items": items, "total": len(items), "window_days": days}


@router.patch("/items/{item_id}/complete")
async def mark_complete(
    item_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    result = await db.compliance_items.update_one(
        {"_id": ObjectId(item_id), "user_id": str(current_user["sub"])},
        {"$set": {"status": "completed", "completed_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Item not found")
    return {"message": "Marked as completed"}


@router.post("/corporate/setup")
async def setup_corporate_compliance(
    company_name: str,
    financial_year_start: str = "04",  # month as 2-digit string
    current_user: dict = Depends(get_current_user),
):
    """Auto-generate corporate compliance calendar for a company."""
    db = get_db()
    now = datetime.utcnow()
    year = now.year
    created = []

    for template in CORPORATE_TEMPLATES:
        # Calculate next due date based on template
        if template["frequency"] == "monthly":
            month = now.month if now.day < template["day_of_month"] else now.month + 1
            if month > 12:
                month = 1
                year = now.year + 1
            try:
                due_date = datetime(year, month, template["day_of_month"])
            except ValueError:
                continue
        elif template["frequency"] == "annual":
            due_month = template.get("month", 3)
            due_day = template.get("day", 31)
            due_year = year if now.month <= due_month else year + 1
            try:
                due_date = datetime(due_year, due_month, due_day)
            except ValueError:
                continue
        else:
            continue

        doc = {
            "user_id": str(current_user["sub"]),
            "name": f"{template['name']} — {company_name}",
            "category": template["category"],
            "due_date": due_date.isoformat(),
            "description": f"Auto-generated for {company_name}",
            "status": "pending",
            "reminder_days": [30, 7, 1],
            "created_at": now,
        }
        result = await db.compliance_items.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        created.append(doc)

    return {"created": len(created), "items": created}


@router.post("/limitation")
async def calculate_limitation(body: LimitationCalcRequest):
    """Calculate limitation period for a legal matter."""
    years = LIMITATION_PERIODS.get(body.matter_type, 3)
    try:
        incident = datetime.fromisoformat(body.incident_date)
        expiry = incident.replace(year=incident.year + years)
        days_left = (expiry - datetime.utcnow()).days
        return {
            "matter_type": body.matter_type,
            "incident_date": body.incident_date,
            "limitation_years": years,
            "expiry_date": expiry.date().isoformat(),
            "days_remaining": days_left,
            "status": "active" if days_left > 0 else "expired",
            "warning": days_left < 30 if days_left > 0 else None,
        }
    except Exception as e:
        raise HTTPException(400, f"Invalid date: {e}")


@router.get("/limitation/types")
async def limitation_types():
    return {"types": list(LIMITATION_PERIODS.keys())}
