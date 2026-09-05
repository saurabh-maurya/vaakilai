from fastapi import APIRouter, HTTPException, Depends, Query
from bson import ObjectId
from datetime import datetime

from database import get_db
from models.lawyer import LawyerProfileCreate, LawyerProfileUpdate, LawyerProfileDB, LawyerSearchFilters, AvailabilitySlot
from middleware.auth_middleware import get_current_user, require_lawyer
from ai import client as ai_client

router = APIRouter()


def doc_out(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.post("/lawyers/onboard")
async def onboard_lawyer(payload: LawyerProfileCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    existing = await db.lawyer_profiles.find_one({"user_id": current_user["user_id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Lawyer profile already exists")

    profile = LawyerProfileDB(user_id=current_user["user_id"], **payload.model_dump()).model_dump()
    result = await db.lawyer_profiles.insert_one(profile)

    # Upgrade user role to lawyer
    await db.users.update_one(
        {"_id": ObjectId(current_user["user_id"])},
        {"$set": {"role": "lawyer", "updated_at": datetime.utcnow()}},
    )
    return {"id": str(result.inserted_id), "message": "Lawyer profile created. Verification in progress."}


@router.get("/lawyers/{lawyer_id}")
async def get_lawyer(lawyer_id: str):
    db = get_db()
    doc = await db.lawyer_profiles.find_one({"_id": ObjectId(lawyer_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Lawyer not found")
    return doc_out(doc)


@router.put("/lawyers/{lawyer_id}/profile")
async def update_lawyer(lawyer_id: str, payload: LawyerProfileUpdate, current_user: dict = Depends(require_lawyer)):
    db = get_db()
    # Lawyers can only update their own profile; admins can update any
    query = {"_id": ObjectId(lawyer_id)}
    if current_user["role"] != "admin":
        query["user_id"] = current_user["user_id"]
    existing = await db.lawyer_profiles.find_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="Lawyer profile not found")
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    await db.lawyer_profiles.update_one({"_id": ObjectId(lawyer_id)}, {"$set": update_data})
    return {"message": "Profile updated"}


@router.get("/search")
async def search_lawyers(
    practice_area: str = Query(None),
    city: str = Query(None),
    language: str = Query(None),
    max_fee: float = Query(None),
    min_rating: float = Query(None),
    q: str = Query(None),
    page: int = 1,
    limit: int = 20,
):
    db = get_db()
    query: dict = {"verification_status": "verified"}
    if practice_area:
        query["practice_areas"] = {"$in": [practice_area]}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if language:
        query["languages"] = {"$in": [language]}
    if max_fee:
        query["consultation_fee_per_session"] = {"$lte": max_fee}
    if min_rating:
        query["rating"] = {"$gte": min_rating}
    if q:
        query["$text"] = {"$search": q}

    cursor = db.lawyer_profiles.find(query).sort("rating", -1).skip((page - 1) * limit).limit(limit)
    results = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        results.append(doc)
    total = await db.lawyer_profiles.count_documents(query)
    return {"results": results, "total": total, "page": page, "limit": limit}


@router.post("/match")
async def ai_match_lawyers(
    legal_issue: str,
    jurisdiction: str = None,
    budget: float = None,
    language: str = None,
    current_user: dict = Depends(get_current_user),
):
    # ai_service scores ONE lawyer per call, so build a candidate pool from the DB
    # (verified lawyers, best-rated first) and score each against the case.
    # TODO: use jurisdiction/budget/language to pre-filter the candidate pool.
    db = get_db()
    candidates = []
    cursor = db.lawyer_profiles.find({"verification_status": "verified"}).sort("rating", -1).limit(8)
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        candidates.append(doc)

    scored = []
    for doc in candidates:
        res = await ai_client.match_score(legal_issue, doc["id"], lawyer_profile=doc)
        if res is not None:
            doc["match_score"] = res.get("score", 0)
            doc["match_reasoning"] = res.get("reason", "")
            scored.append(doc)

    ai_assisted = bool(scored)
    if scored:
        scored.sort(key=lambda d: d.get("match_score", 0), reverse=True)
        results = scored[:5]
    else:
        # Fallback: top-rated verified lawyers (AI unavailable)
        results = candidates[:5]
        for doc in results:
            doc["match_score"] = 0.0

    return {"lawyers": results, "ai_assisted": ai_assisted}


@router.get("/lawyers/{lawyer_id}/availability")
async def get_availability(lawyer_id: str):
    db = get_db()
    doc = await db.lawyer_profiles.find_one({"_id": ObjectId(lawyer_id)}, {"availability_slots": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Lawyer not found")
    return {"slots": doc.get("availability_slots", [])}


@router.put("/lawyers/{lawyer_id}/availability")
async def set_availability(
    lawyer_id: str,
    slots: list[AvailabilitySlot],
    current_user: dict = Depends(require_lawyer),
):
    db = get_db()
    query = {"_id": ObjectId(lawyer_id)}
    if current_user["role"] != "admin":
        query["user_id"] = current_user["user_id"]
    existing = await db.lawyer_profiles.find_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="Lawyer profile not found")
    await db.lawyer_profiles.update_one(
        {"_id": ObjectId(lawyer_id)},
        {"$set": {"availability_slots": [s.model_dump() for s in slots], "updated_at": datetime.utcnow()}},
    )
    return {"message": "Availability updated"}


@router.post("/complexity-score")
async def complexity_score(case_facts: str, practice_area: str = None):
    return await ai_client.case_complexity(case_facts, practice_area=practice_area) or {
        "complexity_level": "moderate",
        "recommended_tier": "mid",
        "reasoning": "AI service unavailable",
    }
