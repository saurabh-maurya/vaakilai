"""
BCI Lawyer Verification.
Manual KYC flow + basic scraper check for states with digital records.
"""

import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
import httpx
from bson import ObjectId

from database import get_db
from middleware.auth_middleware import get_current_user
from services.storage_service import upload_to_s3 as upload_file

router = APIRouter()
logger = logging.getLogger(__name__)

# States with online enrollment lookup
SUPPORTED_STATES = {
    "delhi": "https://delhibarcouncil.com/bcd/enrolment_index.php",
    "rajasthan": "https://barcouncilofrajasthan.org/enrolment/status",
    "maharashtra": "https://bcmg.in/advocate-search",
}


class VerificationRequest(BaseModel):
    enrollment_number: str
    state_bar_council: str   # e.g. "Delhi", "Maharashtra"
    year_of_enrollment: int
    full_name: str


async def _check_state_bar_council(enrollment_number: str, state: str) -> Optional[dict]:
    """Attempt automated check for supported states."""
    state_key = state.lower().replace(" ", "")
    if state_key not in SUPPORTED_STATES:
        return None
    # Automated check would go here — returning None for now as HTML scraping
    # varies by site and requires maintenance. Admin manual review is the fallback.
    return None


@router.post("/submit")
async def submit_verification(
    enrollment_number: str = Form(...),
    state_bar_council: str = Form(...),
    year_of_enrollment: int = Form(...),
    full_name: str = Form(...),
    certificate: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Submit BCI verification request with enrollment certificate upload."""
    db = get_db()
    user_id = str(current_user["user_id"])

    # Check for existing pending/approved request
    existing = await db.verifications.find_one({"user_id": user_id, "status": {"$in": ["pending", "approved"]}})
    if existing:
        return {
            "message": "Verification request already exists",
            "status": existing["status"],
            "id": str(existing["_id"]),
        }

    # Upload certificate to S3
    cert_bytes = await certificate.read()
    if len(cert_bytes) > 5 * 1024 * 1024:
        raise HTTPException(400, "Certificate file too large (max 5MB)")

    cert_url = ""
    try:
        cert_url = await upload_file(
            cert_bytes,
            f"verifications/{user_id}/{certificate.filename}",
            certificate.content_type or "application/pdf",
        )
    except Exception as e:
        logger.error(f"Certificate upload failed: {e}")

    # Try automated state check
    auto_result = await _check_state_bar_council(enrollment_number, state_bar_council)

    doc = {
        "user_id": user_id,
        "enrollment_number": enrollment_number,
        "state_bar_council": state_bar_council,
        "year_of_enrollment": year_of_enrollment,
        "full_name": full_name,
        "certificate_url": cert_url,
        "auto_check_result": auto_result,
        "status": "approved" if auto_result and auto_result.get("verified") else "pending",
        "reviewed_by": None,
        "reviewed_at": None,
        "created_at": datetime.utcnow(),
    }

    result = await db.verifications.insert_one(doc)

    # If auto-approved, update lawyer profile
    if doc["status"] == "approved":
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"bci_verified": True, "enrollment_number": enrollment_number}},
        )

    return {
        "id": str(result.inserted_id),
        "status": doc["status"],
        "message": "Auto-approved via state bar council check." if doc["status"] == "approved"
                   else "Verification submitted. Admin will review within 2 business days.",
    }


@router.get("/status")
async def my_verification_status(current_user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await db.verifications.find_one(
        {"user_id": str(current_user["user_id"])},
        sort=[("created_at", -1)],
    )
    if not doc:
        return {"status": "not_submitted", "is_verified": False}
    return {
        "status": doc["status"],
        "is_verified": doc["status"] == "approved",
        "enrollment_number": doc.get("enrollment_number"),
        "state_bar_council": doc.get("state_bar_council"),
        "submitted_at": doc.get("created_at"),
        "reviewed_at": doc.get("reviewed_at"),
    }


# ── Admin routes ──────────────────────────────────────────────────────────────

@router.get("/admin/pending")
async def admin_list_pending(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin",):
        raise HTTPException(403, "Admin only")
    db = get_db()
    items = []
    async for doc in db.verifications.find({"status": "pending"}).sort("created_at", 1):
        doc["id"] = str(doc.pop("_id"))
        items.append(doc)
    return {"items": items, "total": len(items)}


@router.patch("/admin/{verification_id}/approve")
async def admin_approve(
    verification_id: str,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") not in ("admin",):
        raise HTTPException(403, "Admin only")
    db = get_db()
    doc = await db.verifications.find_one({"_id": ObjectId(verification_id)})
    if not doc:
        raise HTTPException(404, "Verification not found")

    await db.verifications.update_one(
        {"_id": ObjectId(verification_id)},
        {"$set": {"status": "approved", "reviewed_by": str(current_user["user_id"]), "reviewed_at": datetime.utcnow()}},
    )
    await db.users.update_one(
        {"_id": ObjectId(doc["user_id"])},
        {"$set": {"bci_verified": True, "enrollment_number": doc.get("enrollment_number")}},
    )
    return {"message": "Verification approved"}


@router.patch("/admin/{verification_id}/reject")
async def admin_reject(
    verification_id: str,
    reason: str = "",
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") not in ("admin",):
        raise HTTPException(403, "Admin only")
    db = get_db()
    await db.verifications.update_one(
        {"_id": ObjectId(verification_id)},
        {"$set": {"status": "rejected", "rejection_reason": reason, "reviewed_by": str(current_user["user_id"]), "reviewed_at": datetime.utcnow()}},
    )
    return {"message": "Verification rejected"}
