from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import logging
from jwt.exceptions import InvalidTokenError
from typing import Optional
from bson import ObjectId
from bson.errors import InvalidId

from config import settings

logger = logging.getLogger(__name__)
_IS_PRODUCTION = settings.app_env == "production"

# auto_error=False allows cookie fallback
security = HTTPBearer(auto_error=False)

COOKIE_NAME = "vk_session"

# Plans that unlock pro/lawyer-tier AI features (must match backend definition)
PRO_PLANS = frozenset({
    "advocate_starter", "advocate_pro", "advocate_firm",
    "pro", "business",  # legacy aliases
})


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    # Internal service-to-service calls bypass user-JWT validation.
    if getattr(request.state, "is_internal", False):
        return {"user_id": "internal", "role": "internal", "email": None, "_token": None}

    # 1. Prefer httpOnly session cookie
    token = request.cookies.get(COOKIE_NAME)

    # 2. Fall back to Authorization: Bearer header
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

    # Check shared token blacklist (same MongoDB as backend)
    from main import get_db as _get_db
    db = _get_db()
    if db is None:
        if _IS_PRODUCTION:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service temporarily unavailable",
            )
    elif await db.token_blacklist.find_one({"token": token}):
        logger.warning("Revoked token used: user_id=%s", user_id)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")

    return {"user_id": user_id, "role": role, "email": payload.get("email"), "_token": token}


def require_plan(*plans: str):
    """
    Server-side subscription plan enforcement for AI service routes.
    Raises 403 if the user's plan is not in the allowed set.
    Admin and internal service roles always bypass plan checks.
    """
    allowed = frozenset(plans)

    async def checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] in ("admin", "internal"):
            return current_user
        from main import get_db as _get_db
        db = _get_db()
        if db is None:
            # Fail closed in production; allow in dev without DB
            if _IS_PRODUCTION:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Authorization service temporarily unavailable",
                )
            return current_user
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


require_pro_plan = require_plan(*PRO_PLANS)
