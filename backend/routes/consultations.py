from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from bson import ObjectId
from datetime import datetime
from typing import Dict, List

from database import get_db
from models.consultation import ConsultationCreate, ConsultationDB, MessageCreate, ReviewCreate
from middleware.auth_middleware import get_current_user
from config import settings

router = APIRouter()

# In-memory WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active: Dict[str, List[WebSocket]] = {}

    async def connect(self, consultation_id: str, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(consultation_id, []).append(ws)

    def disconnect(self, consultation_id: str, ws: WebSocket):
        if consultation_id in self.active:
            self.active[consultation_id].remove(ws)

    async def broadcast(self, consultation_id: str, message: dict):
        for ws in self.active.get(consultation_id, []):
            await ws.send_json(message)


manager = ConnectionManager()


def doc_out(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.post("/", status_code=201)
async def book_consultation(payload: ConsultationCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    lawyer = await db.lawyer_profiles.find_one({"_id": ObjectId(payload.lawyer_id)})
    if not lawyer:
        raise HTTPException(status_code=404, detail="Lawyer not found")

    consult = ConsultationDB(
        consumer_id=current_user["user_id"],
        **payload.model_dump(),
    ).model_dump()
    result = await db.consultations.insert_one(consult)

    # Add timeline event
    await db.consultations.update_one(
        {"_id": result.inserted_id},
        {"$push": {"timeline": {"event": "Consultation booked", "timestamp": datetime.utcnow().isoformat()}}},
    )
    return {"id": str(result.inserted_id), "message": "Consultation booked. Awaiting payment."}


@router.get("/{consultation_id}")
async def get_consultation(consultation_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await db.consultations.find_one({"_id": ObjectId(consultation_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Consultation not found")
    return doc_out(doc)


@router.get("/")
async def list_consultations(current_user: dict = Depends(get_current_user)):
    db = get_db()
    role = current_user["role"]
    uid = current_user["user_id"]

    if role == "lawyer":
        query = {"lawyer_id": uid}
    else:
        query = {"consumer_id": uid}

    cursor = db.consultations.find(query).sort("created_at", -1).limit(50)
    results = []
    async for doc in cursor:
        results.append(doc_out(doc))
    return results


@router.put("/{consultation_id}/status")
async def update_status(consultation_id: str, status: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    await db.consultations.update_one(
        {"_id": ObjectId(consultation_id)},
        {"$set": {"status": status, "updated_at": datetime.utcnow()},
         "$push": {"timeline": {"event": f"Status changed to {status}", "timestamp": datetime.utcnow().isoformat()}}},
    )
    return {"message": f"Status updated to {status}"}


@router.post("/{consultation_id}/video-room")
async def create_video_room(consultation_id: str, current_user: dict = Depends(get_current_user)):
    # In production: create Twilio Video Room
    room_name = f"vakilai-{consultation_id}"
    await get_db().consultations.update_one(
        {"_id": ObjectId(consultation_id)},
        {"$set": {"video_room_sid": room_name}},
    )
    return {"room_name": room_name, "token": f"mock-video-token-{consultation_id}"}


@router.post("/{consultation_id}/messages")
async def send_message(
    consultation_id: str,
    payload: MessageCreate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    message = {
        "sender_id": current_user["user_id"],
        "content": payload.content,
        "message_type": payload.message_type,
        "timestamp": datetime.utcnow().isoformat(),
    }
    await db.consultations.update_one(
        {"_id": ObjectId(consultation_id)},
        {"$push": {"messages": message}},
    )
    await manager.broadcast(consultation_id, message)
    return message


@router.websocket("/{consultation_id}/ws")
async def websocket_chat(consultation_id: str, ws: WebSocket, token: str = ""):
    # Validate JWT before accepting the WebSocket connection
    if not token:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = payload.get("sub")
        if not user_id:
            await ws.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except JWTError:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Verify user belongs to this consultation
    db = get_db()
    consult = await db.consultations.find_one({"_id": ObjectId(consultation_id)})
    if not consult or user_id not in (consult.get("consumer_id"), consult.get("lawyer_id")):
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(consultation_id, ws)
    try:
        while True:
            data = await ws.receive_json()
            msg = {"sender_id": user_id, "content": data.get("content", ""), "timestamp": datetime.utcnow().isoformat()}
            await db.consultations.update_one(
                {"_id": ObjectId(consultation_id)}, {"$push": {"messages": msg}}
            )
            await manager.broadcast(consultation_id, msg)
    except WebSocketDisconnect:
        manager.disconnect(consultation_id, ws)


@router.post("/{consultation_id}/review")
async def submit_review(consultation_id: str, payload: ReviewCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    consult = await db.consultations.find_one({"_id": ObjectId(consultation_id)})
    if not consult:
        raise HTTPException(status_code=404, detail="Consultation not found")

    review = {"rating": payload.rating, "comment": payload.comment, "reviewer_id": current_user["user_id"], "created_at": datetime.utcnow().isoformat()}
    await db.consultations.update_one({"_id": ObjectId(consultation_id)}, {"$set": {"review": review}})

    # Update lawyer average rating
    lawyer_id = consult["lawyer_id"]
    pipeline = [
        {"$match": {"lawyer_id": lawyer_id, "review": {"$exists": True}}},
        {"$group": {"_id": None, "avg_rating": {"$avg": "$review.rating"}, "count": {"$sum": 1}}},
    ]
    async for row in db.consultations.aggregate(pipeline):
        await db.lawyer_profiles.update_one(
            {"user_id": lawyer_id},
            {"$set": {"rating": round(row["avg_rating"], 1), "total_reviews": row["count"]}},
        )
    return {"message": "Review submitted"}
