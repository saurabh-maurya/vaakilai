"""
Lok Adalat / ODR (Online Dispute Resolution).
- If ODR_PROVIDER_API_KEY is set: full Presolv360/SAMA integration
- Else: AI preparation wizard + download option
"""

import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import httpx
from bson import ObjectId

from database import get_db
from middleware.auth_middleware import get_current_user
from config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

AI_SERVICE_URL = "http://localhost:8001"

ODR_MATTER_TYPES = [
    "Motor Accident Claim", "Consumer Dispute", "Cheque Bounce (Sec 138 NI Act)",
    "Matrimonial Property Dispute", "Labour Dispute", "Banking / Loan Recovery",
    "Commercial Contract Dispute", "Landlord-Tenant Dispute", "Insurance Claim",
    "Medical Negligence", "Neighbourhood Dispute", "Other",
]


class ODRCaseRequest(BaseModel):
    matter_type: str
    claimant_name: str
    respondent_name: str
    dispute_summary: str
    claim_amount: Optional[float] = None
    preferred_platform: str = "lok_adalat"   # lok_adalat | presolv360 | sama
    documents: list[str] = []  # S3 URLs of supporting documents


class ODRWizardRequest(BaseModel):
    matter_type: str
    dispute_summary: str
    claimant_position: str
    desired_outcome: str
    claim_amount: Optional[float] = None


async def _generate_odr_prep(data: ODRWizardRequest) -> dict:
    """Call AI service to generate ODR preparation materials."""
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{AI_SERVICE_URL}/ai/consult",
                json={
                    "query": (
                        f"I need to file a {data.matter_type} dispute for ODR/Lok Adalat. "
                        f"Dispute: {data.dispute_summary}. "
                        f"My position: {data.claimant_position}. "
                        f"Desired outcome: {data.desired_outcome}. "
                        f"Claim amount: ₹{data.claim_amount or 'Not specified'}. "
                        "Please provide: 1) Position paper summary 2) Key legal arguments "
                        "3) BATNA (Best Alternative To Negotiated Agreement) 4) Suggested settlement range "
                        "5) Documents to submit. Format clearly."
                    ),
                    "practice_area": data.matter_type,
                },
            )
            if resp.status_code == 200:
                ai_data = resp.json()
                return {"ai_analysis": ai_data.get("answer", ""), "citations": ai_data.get("citations", [])}
    except Exception as e:
        logger.error(f"AI prep generation failed: {e}")
    return {"ai_analysis": "Unable to generate analysis. Please try again.", "citations": []}


async def _submit_to_odr_provider(case_data: dict) -> dict:
    """Submit to ODR provider if API key is configured."""
    if not settings.odr_provider_api_key:
        return {"submitted": False, "reason": "ODR provider not configured"}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{settings.odr_provider_url}/cases",
                headers={"Authorization": f"Bearer {settings.odr_provider_api_key}"},
                json=case_data,
            )
            if resp.status_code in (200, 201):
                return {"submitted": True, "provider_reference": resp.json().get("case_id")}
            return {"submitted": False, "reason": resp.text}
    except Exception as e:
        logger.error(f"ODR provider submission failed: {e}")
        return {"submitted": False, "reason": str(e)}


@router.get("/matter-types")
async def list_matter_types():
    return {"types": ODR_MATTER_TYPES}


@router.post("/prepare")
async def prepare_odr_case(
    body: ODRWizardRequest,
    current_user: dict = Depends(get_current_user),
):
    """Generate AI-powered ODR preparation materials."""
    ai_prep = await _generate_odr_prep(body)
    return {
        "matter_type": body.matter_type,
        "ai_analysis": ai_prep["ai_analysis"],
        "citations": ai_prep["citations"],
        "platforms": [
            {"name": "Lok Adalat", "url": "https://nalsa.gov.in", "cost": "Free"},
            {"name": "Presolv360", "url": "https://presolv360.com", "cost": "Nominal fee"},
            {"name": "SAMA", "url": "https://sama.co.in", "cost": "Nominal fee"},
        ],
        "odr_integration": bool(settings.odr_provider_api_key),
    }


@router.post("/submit")
async def submit_odr_case(
    body: ODRCaseRequest,
    current_user: dict = Depends(get_current_user),
):
    """Submit ODR case — full integration if API key set, else save for manual filing."""
    db = get_db()

    doc = {
        "user_id": str(current_user["sub"]),
        **body.model_dump(),
        "status": "draft",
        "created_at": datetime.utcnow(),
    }

    # Try full ODR provider integration
    if settings.odr_provider_api_key:
        provider_result = await _submit_to_odr_provider(body.model_dump())
        doc["provider_reference"] = provider_result.get("provider_reference")
        doc["status"] = "submitted" if provider_result["submitted"] else "draft"
        doc["provider_response"] = provider_result
    else:
        doc["provider_response"] = {
            "submitted": False,
            "reason": "Manual filing required",
            "instructions": (
                "Download your prepared case file and file manually at:\n"
                "• Lok Adalat: Contact your nearest District Legal Services Authority\n"
                "• Presolv360: Visit presolv360.com and upload your case documents\n"
                "• SAMA: Visit sama.co.in for online mediation"
            ),
        }

    result = await db.odr_cases.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return doc


@router.get("/my")
async def my_odr_cases(current_user: dict = Depends(get_current_user)):
    db = get_db()
    cases = []
    async for doc in db.odr_cases.find({"user_id": str(current_user["sub"])}).sort("created_at", -1):
        doc["id"] = str(doc.pop("_id"))
        cases.append(doc)
    return {"cases": cases, "total": len(cases)}
