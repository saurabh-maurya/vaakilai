from fastapi import APIRouter, HTTPException, status, Depends, Request, Response
from passlib.context import CryptContext
from slowapi import Limiter
from slowapi.util import get_remote_address
from datetime import datetime, timedelta
from bson import ObjectId
import pyotp
import qrcode
import qrcode.image.svg
import io
import base64

from config import settings
from database import get_db
from models.user import UserCreate, UserLogin, UserDB, UserOut, TokenResponse, AuthResponse, SubscriptionPlan, UserRole
from middleware.auth_middleware import create_access_token, get_current_user

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15
COOKIE_NAME = "vk_session"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def user_to_out(doc: dict) -> UserOut:
    return UserOut(
        id=str(doc["_id"]),
        name=doc["name"],
        email=doc["email"],
        phone=doc.get("phone"),
        role=doc["role"],
        subscription_plan=doc.get("subscription_plan", SubscriptionPlan.free),
        language_preference=doc.get("language_preference", "en"),
        state=doc.get("state"),
        is_active=doc.get("is_active", True),
        mfa_enabled=doc.get("mfa_enabled", False),
        created_at=doc["created_at"],
    )


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=not settings.debug,   # HTTPS-only in production
        samesite="strict",
        max_age=settings.jwt_expire_minutes * 60,
        path="/",
    )


def _clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(key=COOKIE_NAME, path="/", samesite="strict")


async def _check_lockout(db, email: str) -> None:
    record = await db.login_attempts.find_one({"email": email})
    if not record:
        return
    locked_until = record.get("locked_until")
    if locked_until and locked_until > datetime.utcnow():
        remaining = int((locked_until - datetime.utcnow()).total_seconds() // 60) + 1
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Account temporarily locked. Try again in {remaining} minute(s).",
        )


async def _record_failed_attempt(db, email: str) -> None:
    now = datetime.utcnow()
    result = await db.login_attempts.find_one_and_update(
        {"email": email},
        {"$inc": {"count": 1}, "$set": {"last_attempt": now}},
        upsert=True,
        return_document=True,
    )
    count = (result.get("count") or 0) + 1 if result else 1
    if count >= MAX_FAILED_ATTEMPTS:
        await db.login_attempts.update_one(
            {"email": email},
            {"$set": {"locked_until": now + timedelta(minutes=LOCKOUT_MINUTES)}},
        )


async def _clear_attempts(db, email: str) -> None:
    await db.login_attempts.delete_one({"email": email})


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, response: Response, payload: UserCreate):
    db = get_db()
    if await db.users.find_one({"email": payload.email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    user_doc = UserDB(
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        hashed_password=hash_password(payload.password),
        role=UserRole.consumer,  # always force consumer — role escalation via admin workflow only
    ).model_dump(exclude_none=True)

    result = await db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id

    token = create_access_token({
        "sub": str(result.inserted_id),
        "email": payload.email,
        "role": UserRole.consumer,
    })
    _set_auth_cookie(response, token)
    # Token is in the httpOnly cookie — not returned in the body
    return AuthResponse(user=user_to_out(user_doc))


@router.post("/login", response_model=AuthResponse)
@limiter.limit("10/minute")
async def login(request: Request, response: Response, payload: UserLogin):
    db = get_db()

    # Lockout check before touching user record (prevents enumeration via timing)
    await _check_lockout(db, payload.email)

    user = await db.users.find_one({"email": payload.email})
    if not user or not verify_password(payload.password, user["hashed_password"]):
        await _record_failed_attempt(db, payload.email)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account deactivated")

    # MFA check — if the user has MFA enabled, validate the TOTP code
    if user.get("mfa_enabled") and user.get("mfa_secret"):
        if not payload.mfa_code:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="mfa_required",
            )
        totp = pyotp.TOTP(user["mfa_secret"])
        if not totp.verify(payload.mfa_code, valid_window=1):
            await _record_failed_attempt(db, payload.email)
            raise HTTPException(status_code=401, detail="Invalid MFA code")

    await _clear_attempts(db, payload.email)

    token = create_access_token({
        "sub": str(user["_id"]),
        "email": user["email"],
        "role": user["role"],
    })
    _set_auth_cookie(response, token)
    # Token is in the httpOnly cookie — not returned in the body
    return AuthResponse(user=user_to_out(user))


@router.post("/refresh")
async def refresh_token(request: Request, response: Response, current_user: dict = Depends(get_current_user)):
    db = get_db()
    # Blacklist the old token before issuing a new one (rotation)
    old_token = current_user.get("_token")
    if old_token:
        await db.token_blacklist.insert_one({
            "token": old_token,
            "user_id": current_user["user_id"],
            "revoked_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes),
        })

    new_token = create_access_token({
        "sub": current_user["user_id"],
        "email": current_user.get("email"),
        "role": current_user["role"],
    })
    _set_auth_cookie(response, new_token)
    # New token delivered via httpOnly cookie — body contains no sensitive data
    return {"token_type": "bearer"}


@router.post("/logout")
async def logout(response: Response, current_user: dict = Depends(get_current_user)):
    db = get_db()
    token = current_user.get("_token")
    if token:
        await db.token_blacklist.insert_one({
            "token": token,
            "user_id": current_user["user_id"],
            "revoked_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes),
        })
    _clear_auth_cookie(response)
    return {"message": "Logged out successfully"}


# ── MFA (TOTP) Endpoints ──────────────────────────────────────────────────────

@router.get("/mfa/setup")
@limiter.limit("5/minute")
async def mfa_setup(request: Request, current_user: dict = Depends(get_current_user)):
    """
    Generate a fresh TOTP secret and return a QR code (SVG data URI) for
    the user to scan with their authenticator app.  Call /mfa/enable to
    activate after verifying the first code.
    """
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    email = current_user.get("email", "user")
    provisioning_uri = totp.provisioning_uri(name=email, issuer_name="VakilAI")

    # Generate QR code as base64-encoded PNG
    qr = qrcode.make(provisioning_uri)
    buf = io.BytesIO()
    qr.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode()

    # Store the pending secret (not yet active until /mfa/enable is called)
    db = get_db()
    from bson import ObjectId
    from bson.errors import InvalidId
    try:
        uid = ObjectId(current_user["user_id"])
    except (InvalidId, TypeError):
        raise HTTPException(status_code=422, detail="Invalid user ID")
    await db.users.update_one({"_id": uid}, {"$set": {"mfa_pending_secret": secret}})

    return {
        "secret": secret,
        "qr_code": f"data:image/png;base64,{qr_b64}",
        "provisioning_uri": provisioning_uri,
        "instructions": "Scan the QR code with Google Authenticator or Authy, then call POST /auth/mfa/enable with a valid code.",
    }


from pydantic import BaseModel as _BaseModel

class MfaCodeRequest(_BaseModel):
    code: str


@router.post("/mfa/enable")
@limiter.limit("5/minute")
async def mfa_enable(request: Request, payload: MfaCodeRequest, current_user: dict = Depends(get_current_user)):
    """Verify the first TOTP code and activate MFA for the account."""
    db = get_db()
    from bson import ObjectId
    from bson.errors import InvalidId
    try:
        uid = ObjectId(current_user["user_id"])
    except (InvalidId, TypeError):
        raise HTTPException(status_code=422, detail="Invalid user ID")

    user = await db.users.find_one({"_id": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    pending_secret = user.get("mfa_pending_secret")
    if not pending_secret:
        raise HTTPException(status_code=400, detail="No pending MFA setup found. Call GET /auth/mfa/setup first.")

    totp = pyotp.TOTP(pending_secret)
    if not totp.verify(payload.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid TOTP code")

    await db.users.update_one(
        {"_id": uid},
        {"$set": {"mfa_enabled": True, "mfa_secret": pending_secret}, "$unset": {"mfa_pending_secret": ""}},
    )
    return {"message": "MFA enabled successfully"}


@router.post("/mfa/disable")
@limiter.limit("5/minute")
async def mfa_disable(request: Request, payload: MfaCodeRequest, current_user: dict = Depends(get_current_user)):
    """Disable MFA after verifying the current TOTP code."""
    db = get_db()
    from bson import ObjectId
    from bson.errors import InvalidId
    try:
        uid = ObjectId(current_user["user_id"])
    except (InvalidId, TypeError):
        raise HTTPException(status_code=422, detail="Invalid user ID")

    user = await db.users.find_one({"_id": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.get("mfa_enabled"):
        raise HTTPException(status_code=400, detail="MFA is not enabled on this account")

    totp = pyotp.TOTP(user["mfa_secret"])
    if not totp.verify(payload.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid TOTP code")

    await db.users.update_one(
        {"_id": uid},
        {"$set": {"mfa_enabled": False}, "$unset": {"mfa_secret": "", "mfa_pending_secret": ""}},
    )
    return {"message": "MFA disabled successfully"}
