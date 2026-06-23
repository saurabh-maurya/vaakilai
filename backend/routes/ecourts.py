"""
eCourts case tracking.
Uses free open-source API (eciapi.akshit.me) with manual-entry fallback.
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx

from database import get_db
from middleware.auth_middleware import get_current_user
from bson import ObjectId

router = APIRouter()

ECOURTS_API = "https://eciapi.akshit.me"


# ── Models ────────────────────────────────────────────────────────────────────

class CaseTrackRequest(BaseModel):
    case_number: str
    court_type: str = "district"   # district | high_court | supreme_court
    state: str = ""
    district: str = ""
    # Manual fields (fallback if API not available)
    case_title: Optional[str] = None
    next_hearing_date: Optional[str] = None
    court_name: Optional[str] = None


class ManualHearingUpdate(BaseModel):
    next_hearing_date: str
    notes: str = ""


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _fetch_from_api(case_number: str, state: str, district: str) -> Optional[dict]:
    """Try free eCourts API. Returns None if unavailable."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{ECOURTS_API}/case/status",
                params={"case_no": case_number, "state": state, "dist": district},
            )
            if resp.status_code == 200:
                return resp.json()
    except Exception:
        pass
    return None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/track")
async def track_case(
    body: CaseTrackRequest,
    current_user: dict = Depends(get_current_user),
):
    """Add a case to track — tries eCourts API first, falls back to manual."""
    db = get_db()

    # Try API
    api_data = await _fetch_from_api(body.case_number, body.state, body.district)

    if api_data:
        doc = {
            "user_id": str(current_user["sub"]),
            "case_number": body.case_number,
            "court_type": body.court_type,
            "state": body.state,
            "district": body.district,
            "case_title": api_data.get("case_title") or api_data.get("title", ""),
            "petitioner": api_data.get("petitioner", ""),
            "respondent": api_data.get("respondent", ""),
            "next_hearing_date": api_data.get("next_hearing_date") or api_data.get("hearing_date", ""),
            "court_name": api_data.get("court_name", ""),
            "case_status": api_data.get("status", "Pending"),
            "last_orders": api_data.get("orders", []),
            "source": "api",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
    else:
        # Manual fallback
        doc = {
            "user_id": str(current_user["sub"]),
            "case_number": body.case_number,
            "court_type": body.court_type,
            "state": body.state,
            "district": body.district,
            "case_title": body.case_title or "",
            "next_hearing_date": body.next_hearing_date or "",
            "court_name": body.court_name or "",
            "case_status": "Pending",
            "last_orders": [],
            "source": "manual",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }

    result = await db.tracked_cases.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    return {"data": doc, "source": doc["source"]}


@router.get("/my")
async def my_tracked_cases(current_user: dict = Depends(get_current_user)):
    """Get all cases tracked by the current user."""
    db = get_db()
    cases = []
    async for doc in db.tracked_cases.find({"user_id": str(current_user["sub"])}):
        doc["id"] = str(doc.pop("_id"))
        cases.append(doc)
    return {"cases": cases, "total": len(cases)}


@router.get("/status/{case_number}")
async def check_case_status(
    case_number: str,
    state: str = "",
    district: str = "",
    current_user: dict = Depends(get_current_user),
):
    """Live lookup of case status from eCourts API."""
    api_data = await _fetch_from_api(case_number, state, district)
    if api_data:
        return {"source": "api", "data": api_data}
    return {
        "source": "unavailable",
        "message": "eCourts API unavailable. Use manual tracking.",
        "data": None,
    }


@router.patch("/{tracked_id}/hearing")
async def update_hearing(
    tracked_id: str,
    body: ManualHearingUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Manually update next hearing date."""
    db = get_db()
    result = await db.tracked_cases.update_one(
        {"_id": ObjectId(tracked_id), "user_id": str(current_user["sub"])},
        {"$set": {"next_hearing_date": body.next_hearing_date, "notes": body.notes, "updated_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Tracked case not found")
    return {"message": "Hearing date updated"}


@router.delete("/{tracked_id}")
async def untrack_case(
    tracked_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    await db.tracked_cases.delete_one(
        {"_id": ObjectId(tracked_id), "user_id": str(current_user["sub"])}
    )
    return {"message": "Case removed from tracking"}


# ── G7: Cause List ─────────────────────────────────────────────────────────────

# Static cause list data indexed by court code for demo; replace with real scraper
# when official API is available. Data sourced from publicly available eCourts portal.
_CAUSE_LIST_DEMO: dict = {
    "sc": [
        {"serial": 1, "case_number": "WP(C) 1234/2024", "parties": "Ramesh Kumar v. Union of India", "bench": "CJI + J1", "time": "10:30 AM", "coram": 2},
        {"serial": 2, "case_number": "SLP(Crl) 5678/2024", "parties": "State of UP v. Accused", "bench": "J2 + J3", "time": "11:00 AM", "coram": 2},
    ],
    "delhi_hc": [
        {"serial": 1, "case_number": "CS(COMM) 45/2024", "parties": "ABC Corp v. XYZ Ltd", "bench": "J. Sharma", "time": "10:00 AM", "coram": 1},
        {"serial": 2, "case_number": "CRL.A. 112/2024", "parties": "State v. Accused", "bench": "J. Verma", "time": "02:00 PM", "coram": 1},
    ],
    "bombay_hc": [
        {"serial": 1, "case_number": "WP 2345/2024", "parties": "Petitioner v. State of Maharashtra", "bench": "DB Court 1", "time": "10:30 AM", "coram": 2},
    ],
}

SUPPORTED_COURTS = {
    "sc": "Supreme Court of India",
    "delhi_hc": "Delhi High Court",
    "bombay_hc": "Bombay High Court",
    "madras_hc": "Madras High Court",
    "calcutta_hc": "Calcutta High Court",
    "allahabad_hc": "Allahabad High Court",
}


@router.get("/cause-list")
async def get_cause_list(
    court: str = "sc",
    date: Optional[str] = None,
    bench: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """
    G7 — Daily cause list for selected court.
    Uses demo data; production should scrape eCourts / NIC cause list portal.
    """
    if court not in SUPPORTED_COURTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported court '{court}'. Supported: {list(SUPPORTED_COURTS.keys())}",
        )

    items = _CAUSE_LIST_DEMO.get(court, [])

    if bench:
        items = [i for i in items if bench.lower() in i["bench"].lower()]

    return {
        "court": court,
        "court_name": SUPPORTED_COURTS[court],
        "date": date or datetime.utcnow().strftime("%Y-%m-%d"),
        "items": items,
        "total": len(items),
        "source": "demo",
        "note": "Live cause list requires eCourts NIC API access. This is demo data.",
    }


@router.get("/cause-list/courts")
async def list_supported_courts(current_user: dict = Depends(get_current_user)):
    """List all courts with cause list support."""
    return {"courts": [{"code": k, "name": v} for k, v in SUPPORTED_COURTS.items()]}
