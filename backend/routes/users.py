from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime
from pydantic import BaseModel, Field

from database import get_db
from models.user import UserUpdate, UserOut, SubscriptionPlan
from middleware.auth_middleware import get_current_user
from passlib.context import CryptContext


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)


class SubscriptionUpgradeRequest(BaseModel):
    plan: str
    razorpay_payment_id: str = ""
    razorpay_order_id: str = ""
    razorpay_signature: str = ""

_pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def _oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=422, detail="Invalid ID format")

router = APIRouter()

import logging
logger = logging.getLogger(__name__)

SUBSCRIPTION_PRICES = {
    SubscriptionPlan.free: 0,
    SubscriptionPlan.starter: 199,
    SubscriptionPlan.plus: 499,
    SubscriptionPlan.advocate_starter: 999,
    SubscriptionPlan.advocate_pro: 2499,
    SubscriptionPlan.advocate_firm: 6999,
    # legacy
    SubscriptionPlan.basic: 499,
    SubscriptionPlan.business: 2999,
    SubscriptionPlan.pro: 1499,
}

FREE_QUERY_LIMIT = 5


def user_to_out(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    doc.pop("hashed_password", None)
    return doc


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"_id": _oid(current_user["user_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user_to_out(user)


@router.put("/me")
async def update_me(payload: UserUpdate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    await db.users.update_one(
        {"_id": _oid(current_user["user_id"])},
        {"$set": update_data},
    )
    user = await db.users.find_one({"_id": _oid(current_user["user_id"])})
    return user_to_out(user)


@router.post("/me/subscription")
async def upgrade_subscription(payload: SubscriptionUpgradeRequest, current_user: dict = Depends(get_current_user)):
    """
    Update the authenticated user's subscription plan in the DB.
    Requires a verified Razorpay payment (payment_id + order_id + signature).
    Free downgrades are allowed without payment proof.
    Payment credentials are accepted as JSON body (never as URL params).
    """
    import hmac as _hmac, hashlib as _hashlib
    from config import settings as _s

    valid_plans = [p.value for p in SubscriptionPlan]
    if payload.plan not in valid_plans:
        raise HTTPException(status_code=400, detail=f"Invalid plan. Valid values: {valid_plans}")

    price = SUBSCRIPTION_PRICES.get(payload.plan, 0)

    # Paid plans MUST supply a verified Razorpay signature
    if price > 0:
        msg = f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}".encode()
        expected = _hmac.new(_s.razorpay_key_secret.encode(), msg, _hashlib.sha256).hexdigest()
        if not _hmac.compare_digest(expected, payload.razorpay_signature):
            raise HTTPException(status_code=400, detail="Invalid payment signature — subscription not updated")

    db = get_db()
    await db.users.update_one(
        {"_id": _oid(current_user["user_id"])},
        {"$set": {
            "subscription_plan": payload.plan,
            "subscription_updated_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }},
    )
    logger.info("Subscription updated: user=%s plan=%s price_inr=%s", current_user["user_id"], payload.plan, price)
    return {"message": f"Subscription updated to {payload.plan}", "plan": payload.plan, "price_inr": price}


@router.post("/me/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    from models.user import UserCreate
    # Validate new password strength via the same model validator
    try:
        UserCreate(name="x", email="x@x.com", password=payload.new_password)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))

    db = get_db()
    user = await db.users.find_one({"_id": _oid(current_user["user_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not _pwd_context.verify(payload.current_password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    new_hashed = _pwd_context.hash(payload.new_password)
    await db.users.update_one(
        {"_id": _oid(current_user["user_id"])},
        {"$set": {"hashed_password": new_hashed, "updated_at": datetime.utcnow()}},
    )
    logger.info(f"Password changed for user={current_user['user_id']}")
    return {"message": "Password updated successfully"}


@router.get("/me/query-limit")
async def get_query_limit(current_user: dict = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"_id": _oid(current_user["user_id"])})
    plan = user.get("subscription_plan", "free")
    count = user.get("ai_query_count", 0)
    limit = FREE_QUERY_LIMIT if plan == "free" else -1  # -1 = unlimited
    return {"plan": plan, "used": count, "limit": limit, "remaining": max(0, limit - count) if limit != -1 else -1}
