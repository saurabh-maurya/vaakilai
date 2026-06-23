from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from datetime import datetime
from pydantic import BaseModel
from typing import Optional

from database import get_db
from middleware.auth_middleware import get_current_user, require_lawyer

router = APIRouter()


class ClientCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None


class UpdateMessage(BaseModel):
    message: str
    channel: str = "whatsapp"  # whatsapp | email | sms


def doc_out(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.post("/", status_code=201)
async def create_client(payload: ClientCreate, current_user: dict = Depends(require_lawyer)):
    db = get_db()
    client = {
        **payload.model_dump(),
        "lawyer_id": current_user["user_id"],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = await db.clients.insert_one(client)
    return {"id": str(result.inserted_id)}


@router.get("/")
async def list_clients(current_user: dict = Depends(require_lawyer)):
    db = get_db()
    cursor = db.clients.find({"lawyer_id": current_user["user_id"]}).sort("name", 1)
    results = []
    async for doc in cursor:
        results.append(doc_out(doc))
    return results


@router.get("/{client_id}")
async def get_client(client_id: str, current_user: dict = Depends(require_lawyer)):
    db = get_db()
    doc = await db.clients.find_one({"_id": ObjectId(client_id), "lawyer_id": current_user["user_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Client not found")
    return doc_out(doc)


@router.put("/{client_id}")
async def update_client(client_id: str, payload: ClientUpdate, current_user: dict = Depends(require_lawyer)):
    db = get_db()
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    update["updated_at"] = datetime.utcnow()
    await db.clients.update_one({"_id": ObjectId(client_id)}, {"$set": update})
    return {"message": "Client updated"}


@router.get("/{client_id}/cases")
async def get_client_cases(client_id: str, current_user: dict = Depends(require_lawyer)):
    db = get_db()
    cursor = db.cases.find({"client_id": client_id, "lawyer_id": current_user["user_id"]})
    results = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        results.append(doc)
    return results


@router.post("/{client_id}/updates")
async def send_client_update(client_id: str, payload: UpdateMessage, current_user: dict = Depends(require_lawyer)):
    db = get_db()
    client = await db.clients.find_one({"_id": ObjectId(client_id)})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    log = {
        "client_id": client_id,
        "lawyer_id": current_user["user_id"],
        "message": payload.message,
        "channel": payload.channel,
        "status": "sent",
        "sent_at": datetime.utcnow(),
    }
    await db.communication_logs.insert_one(log)

    # In production: dispatch via notification service
    return {"message": "Update sent to client", "channel": payload.channel}


# --- Client portal (scoped to own cases) ---
@router.get("/portal/cases")
async def client_portal_cases(current_user: dict = Depends(get_current_user)):
    db = get_db()
    # Find client record linked to this user
    client = await db.clients.find_one({"user_id": current_user["user_id"]})
    if not client:
        return []
    cursor = db.cases.find({"client_id": str(client["_id"])})
    results = []
    async for doc in cursor:
        # Expose only safe fields to client
        results.append({
            "id": str(doc["_id"]),
            "title": doc["title"],
            "status": doc["status"],
            "next_hearing_date": doc.get("next_hearing_date"),
            "case_type": doc["case_type"],
        })
    return results
