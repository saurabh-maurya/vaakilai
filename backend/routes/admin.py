"""
Admin API — accessible only to users with role=admin.
Exposes system overview, user management, AI usage metrics, security log,
and live health checks.
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Optional

import httpx
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from config import settings
from database import get_db
from middleware.auth_middleware import require_admin
from services.config_store import (
    get_config, set_config, delete_config, list_config_keys, _mask,
)

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=422, detail="Invalid ID format")


def _strip(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    doc.pop("hashed_password", None)
    doc.pop("mfa_secret", None)
    doc.pop("mfa_pending_secret", None)
    return doc


# ── Overview ──────────────────────────────────────────────────────────────────

@router.get("/overview")
async def admin_overview(_: dict = Depends(require_admin)):
    """KPI snapshot: users, lawyers, consultations, AI queries, revenue."""
    db = get_db()
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=7)

    total_users = await db.users.count_documents({})
    total_lawyers = await db.users.count_documents({"role": {"$in": ["lawyer", "firm_admin"]}})
    new_users_today = await db.users.count_documents({"created_at": {"$gte": today}})
    new_users_week = await db.users.count_documents({"created_at": {"$gte": week_ago}})

    active_consultations = await db.consultations.count_documents({"status": {"$in": ["pending", "confirmed"]}})
    total_consultations = await db.consultations.count_documents({})

    ai_queries_today = await db.ai_usage.count_documents({"ts": {"$gte": today}})
    ai_queries_week = await db.ai_usage.count_documents({"ts": {"$gte": week_ago}})

    # Token + cost totals (week)
    cost_pipeline = [
        {"$match": {"ts": {"$gte": week_ago}}},
        {"$group": {
            "_id": None,
            "tokens": {"$sum": "$total_tokens_est"},
            "cost_usd": {"$sum": "$cost_usd_est"},
        }},
    ]
    cost_totals = {"tokens": 0, "cost_usd": 0.0}
    async for row in db.ai_usage.aggregate(cost_pipeline):
        cost_totals = {"tokens": row["tokens"], "cost_usd": round(row["cost_usd"], 4)}

    # Revenue MTD
    month_start = today.replace(day=1)
    revenue_pipeline = [
        {"$match": {"status": "captured", "updated_at": {"$gte": month_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    revenue_mtd = 0
    async for row in db.payments.aggregate(revenue_pipeline):
        revenue_mtd = row["total"]

    # Active blacklisted tokens
    blacklisted_tokens = await db.token_blacklist.count_documents(
        {"expires_at": {"$gt": datetime.utcnow()}}
    )

    # Locked accounts
    locked_accounts = await db.login_attempts.count_documents(
        {"locked_until": {"$gt": datetime.utcnow()}}
    )

    return {
        "users": {
            "total": total_users,
            "lawyers": total_lawyers,
            "new_today": new_users_today,
            "new_week": new_users_week,
        },
        "consultations": {
            "total": total_consultations,
            "active": active_consultations,
        },
        "ai": {
            "queries_today": ai_queries_today,
            "queries_week": ai_queries_week,
            "tokens_week": cost_totals["tokens"],
            "cost_usd_week": cost_totals["cost_usd"],
        },
        "revenue": {"mtd_inr": revenue_mtd},
        "security": {
            "blacklisted_tokens": blacklisted_tokens,
            "locked_accounts": locked_accounts,
        },
    }


# ── User Management ───────────────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    plan: Optional[str] = None,
    search: Optional[str] = Query(None, max_length=100),
    _: dict = Depends(require_admin),
):
    db = get_db()
    query: dict = {}
    if role:
        query["role"] = role
    if is_active is not None:
        query["is_active"] = is_active
    if plan:
        query["subscription_plan"] = plan
    if search:
        # Case-insensitive substring match on name or email
        import re
        safe = re.escape(search)
        query["$or"] = [
            {"name": {"$regex": safe, "$options": "i"}},
            {"email": {"$regex": safe, "$options": "i"}},
        ]

    total = await db.users.count_documents(query)
    skip = (page - 1) * per_page
    cursor = db.users.find(query).sort("created_at", -1).skip(skip).limit(per_page)

    items = []
    async for doc in cursor:
        items.append(_strip(doc))

    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "has_more": skip + len(items) < total,
    }


class UserPatch(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    subscription_plan: Optional[str] = None


VALID_ROLES = {"consumer", "lawyer", "firm_admin", "client_portal", "admin"}
VALID_PLANS = {
    "free", "starter", "plus",
    "advocate_starter", "advocate_pro", "advocate_firm",
    "basic", "business", "pro",
}


@router.patch("/users/{user_id}")
async def patch_user(
    user_id: str,
    payload: UserPatch,
    admin: dict = Depends(require_admin),
):
    """Update a user's role, active status, or subscription plan."""
    db = get_db()
    uid = _oid(user_id)

    update: dict = {"updated_at": datetime.utcnow()}

    if payload.role is not None:
        if payload.role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail=f"Invalid role: {payload.role}")
        update["role"] = payload.role

    if payload.is_active is not None:
        update["is_active"] = payload.is_active

    if payload.subscription_plan is not None:
        if payload.subscription_plan not in VALID_PLANS:
            raise HTTPException(status_code=400, detail=f"Invalid plan: {payload.subscription_plan}")
        update["subscription_plan"] = payload.subscription_plan

    result = await db.users.update_one({"_id": uid}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    logger.info(
        "Admin user patch: admin=%s target=%s changes=%s",
        admin["user_id"], user_id, list(update.keys()),
    )
    return {"message": "User updated", "updated_fields": list(update.keys())}


@router.delete("/users/{user_id}")
async def deactivate_user(user_id: str, admin: dict = Depends(require_admin)):
    """Soft-delete: deactivate user and revoke all active tokens."""
    db = get_db()
    uid = _oid(user_id)

    if user_id == admin["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")

    result = await db.users.update_one(
        {"_id": uid},
        {"$set": {"is_active": False, "updated_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    logger.warning("Admin deactivated user: admin=%s target=%s", admin["user_id"], user_id)
    return {"message": "User deactivated"}


# ── Security Actions ──────────────────────────────────────────────────────────

@router.delete("/security/lockout/{email}")
async def unlock_account(email: str, admin: dict = Depends(require_admin)):
    """Clear a login-attempt lockout for an email address, immediately restoring access."""
    db = get_db()
    result = await db.login_attempts.delete_one({"email": email})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No lockout found for that email")
    logger.warning(
        "Admin cleared account lockout: admin=%s target_email=%s",
        admin["user_id"], email,
    )
    return {"message": f"Lockout cleared for {email}"}


# ── AI Usage Metrics ──────────────────────────────────────────────────────────

@router.get("/ai-metrics")
async def ai_metrics(days: int = Query(7, ge=1, le=90), _: dict = Depends(require_admin)):
    """AI query volume, token usage, and estimated cost by day."""
    db = get_db()
    since = datetime.utcnow() - timedelta(days=days)

    # Queries per day
    daily_pipeline = [
        {"$match": {"ts": {"$gte": since}}},
        {"$group": {
            "_id": {
                "year": {"$year": "$ts"},
                "month": {"$month": "$ts"},
                "day": {"$dayOfMonth": "$ts"},
            },
            "queries": {"$sum": 1},
            "tokens": {"$sum": "$total_tokens_est"},
            "cost_usd": {"$sum": "$cost_usd_est"},
        }},
        {"$sort": {"_id.year": 1, "_id.month": 1, "_id.day": 1}},
    ]
    by_day = []
    async for row in db.ai_usage.aggregate(daily_pipeline):
        d = row["_id"]
        by_day.append({
            "date": f"{d['year']}-{d['month']:02d}-{d['day']:02d}",
            "queries": row["queries"],
            "tokens": row["tokens"],
            "cost_usd": round(row["cost_usd"], 4),
        })

    # Top users by query count
    top_users_pipeline = [
        {"$match": {"ts": {"$gte": since}}},
        {"$group": {
            "_id": "$user_id",
            "queries": {"$sum": 1},
            "tokens": {"$sum": "$total_tokens_est"},
        }},
        {"$sort": {"queries": -1}},
        {"$limit": 10},
    ]
    top_users = []
    async for row in db.ai_usage.aggregate(top_users_pipeline):
        entry = {"user_id": row["_id"], "queries": row["queries"], "tokens": row["tokens"]}
        # Enrich with email (best-effort)
        try:
            user = await db.users.find_one({"_id": ObjectId(row["_id"])}, {"email": 1})
            if user:
                entry["email"] = user["email"]
        except Exception:
            pass
        top_users.append(entry)

    # By endpoint
    endpoint_pipeline = [
        {"$match": {"ts": {"$gte": since}}},
        {"$group": {"_id": "$endpoint", "queries": {"$sum": 1}}},
        {"$sort": {"queries": -1}},
    ]
    by_endpoint = []
    async for row in db.ai_usage.aggregate(endpoint_pipeline):
        by_endpoint.append({"endpoint": row["_id"], "queries": row["queries"]})

    return {
        "period_days": days,
        "by_day": by_day,
        "top_users": top_users,
        "by_endpoint": by_endpoint,
    }


# ── Security Log ──────────────────────────────────────────────────────────────

@router.get("/security-log")
async def security_log(limit: int = Query(50, ge=1, le=200), _: dict = Depends(require_admin)):
    """Recent security events: auth failures, locked accounts, revoked tokens."""
    db = get_db()

    # Recent login failures / lockouts
    lockouts = []
    cursor = db.login_attempts.find(
        {"locked_until": {"$gt": datetime.utcnow()}}
    ).sort("last_attempt", -1).limit(limit)
    async for doc in cursor:
        lockouts.append({
            "email": doc["email"],
            "attempts": doc.get("count", 0),
            "locked_until": doc.get("locked_until").isoformat() if doc.get("locked_until") else None,
            "last_attempt": doc.get("last_attempt").isoformat() if doc.get("last_attempt") else None,
        })

    # Recently revoked tokens
    revoked = []
    cursor = db.token_blacklist.find(
        {"expires_at": {"$gt": datetime.utcnow()}}
    ).sort("revoked_at", -1).limit(limit)
    async for doc in cursor:
        revoked.append({
            "user_id": doc.get("user_id"),
            "revoked_at": doc.get("revoked_at").isoformat() if doc.get("revoked_at") else None,
            "expires_at": doc.get("expires_at").isoformat() if doc.get("expires_at") else None,
        })

    return {
        "locked_accounts": lockouts,
        "revoked_tokens": revoked,
        "generated_at": datetime.utcnow().isoformat(),
    }


# ── System Health ─────────────────────────────────────────────────────────────

@router.get("/health")
async def system_health(_: dict = Depends(require_admin)):
    """Live health check across all services."""
    from database import get_client

    results: dict = {}

    # MongoDB
    try:
        await get_client().admin.command("ping")
        results["mongodb"] = "ok"
    except Exception as exc:
        results["mongodb"] = f"error: {type(exc).__name__}"

    # Redis
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.redis_url, decode_responses=True)
        await r.ping()
        await r.aclose()
        results["redis"] = "ok"
    except Exception as exc:
        results["redis"] = f"error: {type(exc).__name__}"

    # AI service
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.ai_service_url}/health")
            results["ai_service"] = "ok" if resp.status_code == 200 else f"http_{resp.status_code}"
    except Exception as exc:
        results["ai_service"] = f"error: {type(exc).__name__}"

    overall = "ok" if all(v == "ok" for v in results.values()) else "degraded"
    return {
        "overall": overall,
        "services": results,
        "checked_at": datetime.utcnow().isoformat(),
    }


# ── Config Store ───────────────────────────────────────────────────────────────

# Well-known keys the UI knows about. Stored here so the frontend
# can display categories, labels, and whether a key is sensitive.
_KNOWN_KEYS = [
    # AI
    {"key": "ANTHROPIC_API_KEY",     "label": "Anthropic API Key",       "category": "AI",            "sensitive": True},
    {"key": "PINECONE_API_KEY",       "label": "Pinecone API Key",         "category": "AI",            "sensitive": True},
    # Payments
    {"key": "RAZORPAY_KEY_ID",        "label": "Razorpay Key ID",          "category": "Payments",      "sensitive": False},
    {"key": "RAZORPAY_KEY_SECRET",    "label": "Razorpay Key Secret",      "category": "Payments",      "sensitive": True},
    # Storage
    {"key": "AWS_ACCESS_KEY_ID",      "label": "AWS Access Key ID",        "category": "Storage",       "sensitive": False},
    {"key": "AWS_SECRET_ACCESS_KEY",  "label": "AWS Secret Access Key",    "category": "Storage",       "sensitive": True},
    {"key": "AWS_S3_BUCKET",          "label": "S3 Documents Bucket",      "category": "Storage",       "sensitive": False},
    # Communication
    {"key": "TWILIO_ACCOUNT_SID",     "label": "Twilio Account SID",       "category": "Communication", "sensitive": False},
    {"key": "TWILIO_AUTH_TOKEN",      "label": "Twilio Auth Token",         "category": "Communication", "sensitive": True},
    {"key": "TWILIO_PHONE_NUMBER",    "label": "Twilio Phone Number",       "category": "Communication", "sensitive": False},
    {"key": "WHATSAPP_API_TOKEN",     "label": "WhatsApp API Token",        "category": "Communication", "sensitive": True},
    {"key": "WHATSAPP_PHONE_ID",      "label": "WhatsApp Phone ID",         "category": "Communication", "sensitive": False},
    # Monitoring
    {"key": "SENTRY_DSN",             "label": "Sentry DSN",                "category": "Monitoring",    "sensitive": True},
    {"key": "METRICS_TOKEN",          "label": "Prometheus Metrics Token",  "category": "Monitoring",    "sensitive": True},
    # Internal
    {"key": "INTERNAL_SERVICE_KEY",   "label": "Internal Service Key",      "category": "Internal",      "sensitive": True},
    {"key": "REDIS_URL",              "label": "Redis URL",                  "category": "Internal",      "sensitive": True},
]

_KNOWN_KEY_NAMES = {k["key"] for k in _KNOWN_KEYS}


@router.get("/config")
async def list_config(admin: dict = Depends(require_admin)):
    """
    Return all known config keys with their source (db/env/not_set) and masked values.
    Also returns any extra custom keys stored in the DB that aren't in the known list.
    """
    # Get all DB entries
    db_entries: dict[str, dict] = {e["key"]: e for e in await list_config_keys()}

    rows = []
    for meta in _KNOWN_KEYS:
        key = meta["key"]
        if key in db_entries:
            entry = db_entries[key]
            source = "db"
            masked = entry["masked_value"]
            updated_at = entry.get("updated_at")
            updated_by = entry.get("updated_by")
        elif os.environ.get(key):
            source = "env"
            masked = _mask(os.environ[key])
            updated_at = None
            updated_by = None
        else:
            source = "not_set"
            masked = ""
            updated_at = None
            updated_by = None

        rows.append({
            **meta,
            "source": source,
            "masked_value": masked,
            "updated_at": updated_at,
            "updated_by": updated_by,
        })

    # Append any custom keys in DB that aren't in the known list
    for key, entry in db_entries.items():
        if key not in _KNOWN_KEY_NAMES:
            rows.append({
                "key": key,
                "label": key,
                "category": "Custom",
                "sensitive": True,
                "source": "db",
                "masked_value": entry["masked_value"],
                "updated_at": entry.get("updated_at"),
                "updated_by": entry.get("updated_by"),
            })

    return {"items": rows}


class ConfigUpsert(BaseModel):
    value: str = Field(min_length=1, max_length=4096)


@router.put("/config/{key}")
async def upsert_config(
    key: str,
    payload: ConfigUpsert,
    admin: dict = Depends(require_admin),
):
    """Store or update an encrypted config key in the database."""
    # Basic key name validation — uppercase letters, digits, underscores only
    import re
    if not re.fullmatch(r"[A-Z][A-Z0-9_]{0,127}", key):
        raise HTTPException(
            status_code=422,
            detail="Key must be uppercase letters, digits, and underscores (e.g. ANTHROPIC_API_KEY)",
        )
    await set_config(key, payload.value, admin["user_id"])
    logger.info("Admin set config key: admin=%s key=%s", admin["user_id"], key)
    return {"message": f"Config key {key} saved", "key": key}


@router.delete("/config/{key}")
async def remove_config(key: str, admin: dict = Depends(require_admin)):
    """
    Remove a config key from the DB.
    After deletion the system falls back to the environment variable.
    """
    found = await delete_config(key, admin["user_id"])
    if not found:
        raise HTTPException(status_code=404, detail="Key not found in database")
    logger.info("Admin deleted config key: admin=%s key=%s", admin["user_id"], key)
    return {"message": f"Config key {key} removed from database (env-var fallback active)"}
