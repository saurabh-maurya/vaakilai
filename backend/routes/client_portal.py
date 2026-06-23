"""
Client Portal — read-only access for clients to their own matters.
Separate 'client' role with limited permissions.
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from bson import ObjectId

from database import get_db
from middleware.auth_middleware import get_current_user

router = APIRouter()


class ClientInviteRequest(BaseModel):
    client_email: str
    client_name: str
    case_id: Optional[str] = None
    message: str = ""


class ClientMessageRequest(BaseModel):
    case_id: str
    message: str


@router.get("/dashboard")
async def client_dashboard(current_user: dict = Depends(get_current_user)):
    """Client's view of their matters."""
    db = get_db()
    client_email = current_user.get("email", "")

    # Find cases where this client is linked
    cases = []
    async for doc in db.cases.find({"client_email": client_email}):
        doc["id"] = str(doc.pop("_id"))
        # Strip sensitive internal fields
        doc.pop("internal_notes", None)
        doc.pop("billing_rate", None)
        cases.append(doc)

    # Find consultations
    consultations = []
    async for doc in db.consultations.find({"consumer_id": str(current_user["sub"])}).sort("created_at", -1).limit(10):
        doc["id"] = str(doc.pop("_id"))
        consultations.append(doc)

    # Upcoming hearings
    upcoming_hearings = [
        c for c in cases
        if c.get("next_hearing_date") and c["next_hearing_date"] >= datetime.utcnow().isoformat()
    ]

    return {
        "cases": cases,
        "consultations": consultations,
        "upcoming_hearings": upcoming_hearings[:5],
        "total_cases": len(cases),
    }


@router.get("/cases")
async def client_cases(current_user: dict = Depends(get_current_user)):
    db = get_db()
    cases = []
    async for doc in db.cases.find({"client_email": current_user.get("email")}):
        doc["id"] = str(doc.pop("_id"))
        doc.pop("internal_notes", None)
        doc.pop("billing_rate", None)
        cases.append(doc)
    return {"cases": cases}


@router.get("/cases/{case_id}")
async def client_case_detail(
    case_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    doc = await db.cases.find_one({
        "_id": ObjectId(case_id),
        "client_email": current_user.get("email"),
    })
    if not doc:
        raise HTTPException(404, "Case not found or access denied")
    doc["id"] = str(doc.pop("_id"))
    doc.pop("internal_notes", None)
    doc.pop("billing_rate", None)
    return doc


@router.get("/documents/{case_id}")
async def client_case_documents(
    case_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Client can view documents shared for their case."""
    db = get_db()
    # Verify access
    case = await db.cases.find_one({
        "_id": ObjectId(case_id),
        "client_email": current_user.get("email"),
    })
    if not case:
        raise HTTPException(404, "Case not found or access denied")

    docs = []
    async for doc in db.documents.find({"case_id": case_id, "shared_with_client": True}):
        doc["id"] = str(doc.pop("_id"))
        docs.append(doc)
    return {"documents": docs}


@router.post("/messages")
async def send_message_to_lawyer(
    body: ClientMessageRequest,
    current_user: dict = Depends(get_current_user),
):
    """Client sends a message to their lawyer."""
    db = get_db()
    case = await db.cases.find_one({
        "_id": ObjectId(body.case_id),
        "client_email": current_user.get("email"),
    })
    if not case:
        raise HTTPException(404, "Case not found or access denied")

    msg = {
        "case_id": body.case_id,
        "from_user_id": str(current_user["sub"]),
        "from_email": current_user.get("email"),
        "from_role": "client",
        "message": body.message,
        "created_at": datetime.utcnow(),
        "read": False,
    }
    result = await db.case_messages.insert_one(msg)
    msg["id"] = str(result.inserted_id)
    return msg


@router.get("/messages/{case_id}")
async def get_case_messages(
    case_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    case = await db.cases.find_one({
        "_id": ObjectId(case_id),
        "client_email": current_user.get("email"),
    })
    if not case:
        raise HTTPException(404, "Case not found or access denied")

    msgs = []
    async for msg in db.case_messages.find({"case_id": case_id}).sort("created_at", 1):
        msg["id"] = str(msg.pop("_id"))
        msgs.append(msg)
    return {"messages": msgs}


# ── Lawyer invites client ──────────────────────────────────────────────────────

@router.post("/invite")
async def invite_client(
    body: ClientInviteRequest,
    current_user: dict = Depends(get_current_user),
):
    """Lawyer sends client an invitation to the portal."""
    if current_user.get("role") not in ("lawyer", "firm_admin", "admin"):
        raise HTTPException(403, "Only lawyers can invite clients")

    db = get_db()
    invite = {
        "lawyer_id": str(current_user["sub"]),
        "client_email": body.client_email,
        "client_name": body.client_name,
        "case_id": body.case_id,
        "message": body.message,
        "status": "pending",
        "created_at": datetime.utcnow(),
    }
    result = await db.client_invites.insert_one(invite)
    # TODO: Send email to client_email with portal link
    return {
        "id": str(result.inserted_id),
        "message": f"Invitation created for {body.client_email}. Email integration pending.",
    }
