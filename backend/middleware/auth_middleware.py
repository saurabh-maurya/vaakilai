from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import logging
from jwt.exceptions import InvalidTokenError
from datetime import datetime, timedelta
from typing import Optional
from bson import ObjectId
from bson.errors import InvalidId
from config import settings
from database import get_db

logger = logging.getLogger(__name__)

# auto_error=False so we can fall back to cookie when no Bearer header is present
security = HTTPBearer(auto_error=False)

# Plans that unlock pro/lawyer-tier AI features
PRO_PLANS = frozenset({
    "advocate_starter", "advocate_pro", "advocate_firm",
    "pro", "business",  # legacy aliases
})


def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    # 1. Prefer httpOnly session cookie (not readable by JavaScript)
    token = request.cookies.get("vk_session")

    # 2. Fall back to Authorization: Bearer header (e.g. server-to-server calls)
    if not token and credentials:
        token = credentials.credentials

    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id: str = payload.get("sub")
        role: str = payload.get("role")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except InvalidTokenError as exc:
        logger.warning("JWT validation failed: %s ip=%s", exc, request.client.host if request.client else "unknown")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    # Check token blacklist (revoked on logout)
    db = get_db()
    if await db.token_blacklist.find_one({"token": token}):
        logger.warning("Revoked token used: user_id=%s", user_id)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")

    # Pass the raw token so logout can blacklist it
    return {"user_id": user_id, "role": role, "email": payload.get("email"), "_token": token}


def require_role(*roles):
    async def checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user
    return checker


def require_plan(*plans: str):
    """
    Server-side subscription plan enforcement.
    Raises 403 if the user's plan is not in the allowed set.
    Admin role always bypasses plan checks.
    """
    allowed = frozenset(plans)

    async def checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] == "admin":
            return current_user
        db = get_db()
        try:
            uid = ObjectId(current_user["user_id"])
        except (InvalidId, TypeError):
            raise HTTPException(status_code=422, detail="Invalid user ID")
        user = await db.users.find_one({"_id": uid}, {"subscription_plan": 1})
        plan = user.get("subscription_plan", "free") if user else "free"
        if plan not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This feature requires a plan upgrade. "
                       f"Required: {sorted(allowed)}. Current: {plan}.",
            )
        return {**current_user, "subscription_plan": plan}

    return checker


require_lawyer = require_role("lawyer", "firm_admin", "admin")
require_admin = require_role("admin")
require_consumer = require_role("consumer", "admin")
require_pro_plan = require_plan(*PRO_PLANS)


def require_lawyer_pro():
    """Combined: must be a verified lawyer AND have a pro subscription plan."""
    async def checker(current_user: dict = Depends(get_current_user)):
        role = current_user["role"]
        if role not in ("lawyer", "firm_admin", "admin"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        if role == "admin":
            return current_user
        db = get_db()
        try:
            uid = ObjectId(current_user["user_id"])
        except (InvalidId, TypeError):
            raise HTTPException(status_code=422, detail="Invalid user ID")
        user = await db.users.find_one({"_id": uid}, {"subscription_plan": 1})
        plan = user.get("subscription_plan", "free") if user else "free"
        if plan not in PRO_PLANS:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This feature requires a pro advocate plan. Current plan: {plan}.",
            )
        return {**current_user, "subscription_plan": plan}
    return checker
