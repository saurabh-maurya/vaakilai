"""
Video consultation via Jitsi Meet (100% free, no account needed).
Generates room names and tokens. Optionally supports private Jitsi deployment.
"""

import hashlib
import secrets
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from database import get_db
from middleware.auth_middleware import get_current_user
from config import settings

router = APIRouter()


def _generate_room_name(consultation_id: str) -> str:
    """Generate a unique, hard-to-guess Jitsi room name."""
    h = hashlib.sha256(f"vakilai-{consultation_id}-{secrets.token_hex(4)}".encode()).hexdigest()[:16]
    return f"vakilai-{h}"


class CreateRoomRequest(BaseModel):
    consultation_id: str


@router.post("/room")
async def create_video_room(
    body: CreateRoomRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a Jitsi video room for a consultation."""
    db = get_db()

    # Check existing room
    existing = await db.video_rooms.find_one({"consultation_id": body.consultation_id})
    if existing:
        existing["id"] = str(existing.pop("_id"))
        return existing

    room_name = _generate_room_name(body.consultation_id)
    jitsi_domain = settings.jitsi_domain
    room_url = f"https://{jitsi_domain}/{room_name}"

    doc = {
        "consultation_id": body.consultation_id,
        "room_name": room_name,
        "room_url": room_url,
        "jitsi_domain": jitsi_domain,
        "created_by": str(current_user["sub"]),
        "created_at": datetime.utcnow(),
        "status": "active",
    }
    result = await db.video_rooms.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return doc


@router.get("/room/{consultation_id}")
async def get_video_room(
    consultation_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    room = await db.video_rooms.find_one({"consultation_id": consultation_id})
    if not room:
        raise HTTPException(404, "No video room found for this consultation")
    room["id"] = str(room.pop("_id"))
    return room


@router.delete("/room/{consultation_id}")
async def end_video_room(
    consultation_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    await db.video_rooms.update_one(
        {"consultation_id": consultation_id},
        {"$set": {"status": "ended", "ended_at": datetime.utcnow()}},
    )
    return {"message": "Video room ended"}


@router.get("/config")
async def jitsi_config():
    """Return Jitsi configuration for frontend."""
    return {
        "domain": settings.jitsi_domain,
        "app_id": settings.jitsi_app_id or None,
        "free": not bool(settings.jitsi_app_id),
    }
