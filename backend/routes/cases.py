from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime

from database import get_db
from models.case import CaseCreate, CaseUpdate, CaseDB, HearingCreate, TaskCreate, TaskUpdate
from middleware.auth_middleware import get_current_user, require_lawyer

router = APIRouter()


def _oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=422, detail="Invalid ID format")


def doc_out(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


async def _get_case_owned(db, case_id: str, user_id: str, role: str) -> dict:
    """Fetch a case and verify the requesting user has access to it."""
    query = {"_id": _oid(case_id)}
    if role != "admin":
        query["$or"] = [{"lawyer_id": user_id}, {"client_id": user_id}]
    doc = await db.cases.find_one(query)
    if not doc:
        raise HTTPException(status_code=404, detail="Case not found")
    return doc


@router.post("/", status_code=201)
async def create_case(payload: CaseCreate, current_user: dict = Depends(require_lawyer)):
    db = get_db()
    case = CaseDB(lawyer_id=current_user["user_id"], **payload.model_dump()).model_dump()
    case["timeline"].append({"event": "Case created", "timestamp": datetime.utcnow().isoformat()})
    result = await db.cases.insert_one(case)
    return {"id": str(result.inserted_id)}


@router.get("/")
async def list_cases(status: str = None, current_user: dict = Depends(require_lawyer)):
    db = get_db()
    query = {"lawyer_id": current_user["user_id"]}
    if status:
        query["status"] = status
    cursor = db.cases.find(query).sort("next_hearing_date", 1)
    results = []
    async for doc in cursor:
        results.append(doc_out(doc))
    return results


@router.get("/{case_id}")
async def get_case(case_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await _get_case_owned(db, case_id, current_user["user_id"], current_user["role"])
    return doc_out(doc)


@router.put("/{case_id}")
async def update_case(case_id: str, payload: CaseUpdate, current_user: dict = Depends(require_lawyer)):
    db = get_db()
    existing = await db.cases.find_one({"_id": _oid(case_id), "lawyer_id": current_user["user_id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Case not found")
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    update["updated_at"] = datetime.utcnow()
    await db.cases.update_one({"_id": _oid(case_id)}, {"$set": update})
    return {"message": "Case updated"}


@router.delete("/{case_id}")
async def delete_case(case_id: str, current_user: dict = Depends(require_lawyer)):
    db = get_db()
    existing = await db.cases.find_one({"_id": _oid(case_id), "lawyer_id": current_user["user_id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Case not found")
    await db.cases.update_one({"_id": _oid(case_id)}, {"$set": {"status": "closed"}})
    return {"message": "Case closed"}


# --- Hearings ---
@router.post("/{case_id}/hearings", status_code=201)
async def add_hearing(case_id: str, payload: HearingCreate, current_user: dict = Depends(require_lawyer)):
    db = get_db()
    # Verify ownership
    existing = await db.cases.find_one({"_id": _oid(case_id), "lawyer_id": current_user["user_id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Case not found")
    hearing = {**payload.model_dump(), "id": str(ObjectId()), "created_at": datetime.utcnow().isoformat()}
    await db.cases.update_one(
        {"_id": _oid(case_id)},
        {
            "$push": {"hearings": hearing},
            "$set": {"next_hearing_date": payload.date, "updated_at": datetime.utcnow()},
        },
    )
    return hearing


@router.get("/{case_id}/hearings")
async def get_hearings(case_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    # Ownership check — raises 404 if user has no access
    doc = await _get_case_owned(db, case_id, current_user["user_id"], current_user["role"])
    return doc.get("hearings", [])


# --- Tasks ---
@router.post("/{case_id}/tasks", status_code=201)
async def add_task(case_id: str, payload: TaskCreate, current_user: dict = Depends(require_lawyer)):
    db = get_db()
    existing = await db.cases.find_one({"_id": _oid(case_id), "lawyer_id": current_user["user_id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Case not found")
    task = {**payload.model_dump(), "id": str(ObjectId()), "status": "pending", "created_at": datetime.utcnow().isoformat()}
    await db.cases.update_one({"_id": _oid(case_id)}, {"$push": {"tasks": task}})
    return task


@router.put("/{case_id}/tasks/{task_id}")
async def update_task(
    case_id: str,
    task_id: str,
    payload: TaskUpdate,
    current_user: dict = Depends(require_lawyer),
):
    db = get_db()
    update_data = {f"tasks.$.{k}": v for k, v in payload.model_dump().items() if v is not None}
    await db.cases.update_one(
        {"_id": _oid(case_id), "tasks.id": task_id, "lawyer_id": current_user["user_id"]},
        {"$set": update_data},
    )
    return {"message": "Task updated"}


# --- Files ---
@router.get("/{case_id}/files")
async def get_case_files(case_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    # Ownership check — raises 404 if user has no access to this case
    await _get_case_owned(db, case_id, current_user["user_id"], current_user["role"])
    cursor = db.documents.find({"case_id": case_id, "user_id": current_user["user_id"]}).sort("created_at", -1)
    results = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        results.append(doc)
    return results


# --- Timeline ---
@router.get("/{case_id}/timeline")
async def get_timeline(case_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    # Ownership check
    doc = await _get_case_owned(db, case_id, current_user["user_id"], current_user["role"])
    return sorted(doc.get("timeline", []), key=lambda x: x.get("timestamp", ""), reverse=True)


# --- eCourts sync (stub) ---
@router.post("/sync-ecourts")
async def sync_ecourts(current_user: dict = Depends(require_lawyer)):
    return {"message": "eCourts sync triggered", "synced": 0}
