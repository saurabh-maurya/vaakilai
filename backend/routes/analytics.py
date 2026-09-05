import re
from fastapi import APIRouter, Depends, Query
from bson import ObjectId
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel, Field

from database import get_db
from middleware.auth_middleware import get_current_user, require_pro_plan
from ai import client as ai_client

_SAFE_ID = re.compile(r"^[\w\-]{1,100}$")

router = APIRouter()


@router.get("/litigation")
async def litigation_analytics(current_user: dict = Depends(require_pro_plan)):
    db = get_db()
    lid = current_user["user_id"]
    pipeline = [
        {"$match": {"lawyer_id": lid}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
        }},
    ]
    status_counts = {}
    async for row in db.cases.aggregate(pipeline):
        status_counts[row["_id"]] = row["count"]

    total = sum(status_counts.values())
    closed = status_counts.get("closed", 0)
    win_rate = round((closed / total * 100), 1) if total else 0

    by_type_pipeline = [
        {"$match": {"lawyer_id": lid}},
        {"$group": {"_id": "$case_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    by_type = []
    async for row in db.cases.aggregate(by_type_pipeline):
        by_type.append({"case_type": row["_id"], "count": row["count"]})

    return {
        "total_cases": total,
        "status_breakdown": status_counts,
        "win_rate_pct": win_rate,
        "by_case_type": by_type,
    }


@router.get("/growth")
async def growth_dashboard(current_user: dict = Depends(require_pro_plan)):
    db = get_db()
    lid = current_user["user_id"]
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0)

    clients_this_month = await db.clients.count_documents({
        "lawyer_id": lid,
        "created_at": {"$gte": month_start},
    })
    cases_this_month = await db.cases.count_documents({
        "lawyer_id": lid,
        "created_at": {"$gte": month_start},
    })
    total_clients = await db.clients.count_documents({"lawyer_id": lid})
    total_cases = await db.cases.count_documents({"lawyer_id": lid})

    revenue_pipeline = [
        {"$match": {"lawyer_id": lid, "created_at": {"$gte": month_start}, "status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}},
    ]
    revenue_this_month = 0
    async for row in db.invoices.aggregate(revenue_pipeline):
        revenue_this_month = row["total"]

    return {
        "this_month": {
            "new_clients": clients_this_month,
            "new_cases": cases_this_month,
            "revenue_inr": revenue_this_month,
        },
        "totals": {
            "clients": total_clients,
            "cases": total_cases,
        },
    }


class PredictOutcomeRequest(BaseModel):
    case_type: str = Field(..., min_length=1, max_length=200)
    jurisdiction: str = Field(..., min_length=1, max_length=100)
    facts_summary: str = Field(..., min_length=10, max_length=5000)
    judge_id: Optional[str] = Field(None, max_length=100)


@router.post("/predict-outcome")
async def predict_outcome(
    payload: PredictOutcomeRequest,
    current_user: dict = Depends(require_pro_plan),
):
    return await ai_client.predict_outcome(
        case_type=payload.case_type,
        jurisdiction=payload.jurisdiction,
        facts_summary=payload.facts_summary,
        judge_id=payload.judge_id,
    ) or {"probability": 0.5, "confidence": 0.3, "factors": [], "message": "AI service unavailable"}


@router.get("/judges/{judge_id}")
async def judge_insights(judge_id: str, current_user: dict = Depends(require_pro_plan)):
    if not _SAFE_ID.match(judge_id):
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="Invalid judge_id format")
    return await ai_client.judge_insights(judge_id) or {"message": "Judge insights unavailable"}
