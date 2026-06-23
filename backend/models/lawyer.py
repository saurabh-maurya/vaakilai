from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class VerificationStatus(str, Enum):
    pending = "pending"
    verified = "verified"
    rejected = "rejected"


class LawyerProfileCreate(BaseModel):
    bar_council_number: str
    name: str
    bio: Optional[str] = None
    practice_areas: List[str] = []
    courts: List[str] = []
    experience_years: int = 0
    city: str
    state: str
    languages: List[str] = ["en"]
    consultation_fee_per_hour: float = 500.0
    consultation_fee_per_session: float = 300.0


class AvailabilitySlot(BaseModel):
    date: str        # YYYY-MM-DD
    start_time: str  # HH:MM
    end_time: str
    is_booked: bool = False


class LawyerProfileUpdate(BaseModel):
    bio: Optional[str] = None
    practice_areas: Optional[List[str]] = None
    courts: Optional[List[str]] = None
    experience_years: Optional[int] = None
    city: Optional[str] = None
    languages: Optional[List[str]] = None
    consultation_fee_per_hour: Optional[float] = None
    consultation_fee_per_session: Optional[float] = None


class LawyerProfileDB(BaseModel):
    user_id: str
    bar_council_number: str
    name: str
    bio: Optional[str] = None
    practice_areas: List[str] = []
    courts: List[str] = []
    experience_years: int = 0
    city: str
    state: str
    languages: List[str] = ["en"]
    consultation_fee_per_hour: float = 500.0
    consultation_fee_per_session: float = 300.0
    rating: float = 0.0
    total_reviews: int = 0
    total_consultations: int = 0
    verification_status: VerificationStatus = VerificationStatus.pending
    digilocker_verified: bool = False
    availability_slots: List[AvailabilitySlot] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class LawyerSearchFilters(BaseModel):
    practice_area: Optional[str] = None
    city: Optional[str] = None
    language: Optional[str] = None
    max_fee: Optional[float] = None
    min_rating: Optional[float] = None
    min_experience: Optional[int] = None
