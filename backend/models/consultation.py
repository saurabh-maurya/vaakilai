from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ConsultationType(str, Enum):
    video = "video"
    chat = "chat"
    phone = "phone"
    in_person = "in_person"
    document_review = "document_review"


class ConsultationStatus(str, Enum):
    pending = "pending"
    confirmed = "confirmed"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"
    disputed = "disputed"


class ConsultationCreate(BaseModel):
    lawyer_id: str
    consultation_type: ConsultationType
    scheduled_at: str           # ISO datetime string
    duration_minutes: int = 60
    legal_issue_summary: str
    practice_area: Optional[str] = None
    jurisdiction: Optional[str] = None
    document_url: Optional[str] = None  # for document_review type


class MessageCreate(BaseModel):
    content: str
    message_type: str = "text"  # text | file | system


class ReviewCreate(BaseModel):
    rating: int  # 1-5
    comment: Optional[str] = None


class ConsultationDB(BaseModel):
    consumer_id: str
    lawyer_id: str
    consultation_type: ConsultationType
    scheduled_at: str
    duration_minutes: int = 60
    legal_issue_summary: str
    practice_area: Optional[str] = None
    jurisdiction: Optional[str] = None
    status: ConsultationStatus = ConsultationStatus.pending
    payment_id: Optional[str] = None
    escrow_status: str = "pending"  # pending | held | released | refunded
    video_room_sid: Optional[str] = None
    messages: List[dict] = []
    review: Optional[dict] = None
    document_url: Optional[str] = None
    ai_context: Optional[str] = None    # pre-filled from AI chat
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
