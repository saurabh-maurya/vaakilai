from fastapi import APIRouter, Depends
from bson import ObjectId
from datetime import datetime

from database import get_db
from middleware.auth_middleware import get_current_user
from services.notification_service import send_sms, send_email, send_whatsapp

router = APIRouter()


@router.get("/")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.notifications.find(
        {"user_id": current_user["user_id"]}
    ).sort("created_at", -1).limit(50)
    results = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        results.append(doc)
    return results


@router.post("/{notification_id}/read")
async def mark_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    await db.notifications.update_one(
        {"_id": ObjectId(notification_id)},
        {"$set": {"read": True, "read_at": datetime.utcnow()}},
    )
    return {"message": "Marked as read"}


@router.post("/test-sms")
async def test_sms(phone: str, message: str, current_user: dict = Depends(get_current_user)):
    result = await send_sms(phone, message)
    return result


@router.post("/test-email")
async def test_email(to_email: str, subject: str, body: str, current_user: dict = Depends(get_current_user)):
    result = await send_email(to_email, subject, body)
    return result
