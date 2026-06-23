from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum


class CaseStatus(str, Enum):
    active = "active"
    pending = "pending"
    closed = "closed"
    on_hold = "on_hold"


class CaseCreate(BaseModel):
    title: str
    client_id: str
    case_type: str
    court: Optional[str] = None
    case_number: Optional[str] = None
    ecourts_case_id: Optional[str] = None
    description: Optional[str] = None
    filed_date: Optional[str] = None
    next_hearing_date: Optional[str] = None


class CaseUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[CaseStatus] = None
    court: Optional[str] = None
    case_number: Optional[str] = None
    description: Optional[str] = None
    next_hearing_date: Optional[str] = None


class HearingCreate(BaseModel):
    date: str
    purpose: Optional[str] = None
    court_room: Optional[str] = None
    notes: Optional[str] = None


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assignee_id: Optional[str] = None
    due_date: Optional[str] = None
    priority: str = "medium"


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[str] = None


class CaseDB(BaseModel):
    lawyer_id: str
    client_id: str
    title: str
    case_type: str
    court: Optional[str] = None
    case_number: Optional[str] = None
    ecourts_case_id: Optional[str] = None
    description: Optional[str] = None
    status: CaseStatus = CaseStatus.active
    filed_date: Optional[str] = None
    next_hearing_date: Optional[str] = None
    hearings: List[dict] = []
    tasks: List[dict] = []
    timeline: List[dict] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
