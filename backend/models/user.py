from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    consumer = "consumer"
    lawyer = "lawyer"
    firm_admin = "firm_admin"
    client_portal = "client_portal"
    admin = "admin"


class SubscriptionPlan(str, Enum):
    # Individual plans
    free = "free"
    starter = "starter"           # ₹199/mo individual
    plus = "plus"                  # ₹499/mo individual
    # Advocate / Firm plans
    advocate_starter = "advocate_starter"   # ₹999/mo
    advocate_pro = "advocate_pro"           # ₹2,499/mo
    advocate_firm = "advocate_firm"         # ₹6,999/mo
    # Legacy aliases (kept for backward compat)
    basic = "basic"
    business = "business"
    pro = "pro"


class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=20)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        if not any(c in "!@#$%^&*()_+-=[]{}|;':\",./<>?" for c in v):
            raise ValueError("Password must contain at least one special character")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    mfa_code: Optional[str] = Field(None, min_length=6, max_length=8)


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    language_preference: Optional[str] = "en"
    state: Optional[str] = None


class UserDB(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    hashed_password: str
    role: UserRole = UserRole.consumer
    subscription_plan: SubscriptionPlan = SubscriptionPlan.free
    ai_query_count: int = 0
    ai_query_reset_date: Optional[datetime] = None
    language_preference: str = "en"
    state: Optional[str] = None
    is_active: bool = True
    mfa_enabled: bool = False
    mfa_secret: Optional[str] = None       # TOTP secret — never exposed in UserOut
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    role: UserRole
    subscription_plan: SubscriptionPlan
    language_preference: str
    state: Optional[str] = None
    is_active: bool
    mfa_enabled: bool = False
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class AuthResponse(BaseModel):
    """
    Response for login/register/refresh endpoints.
    The JWT is delivered as an httpOnly cookie — NOT returned in the body
    to minimise XSS exposure surface.
    """
    token_type: str = "bearer"
    user: UserOut
