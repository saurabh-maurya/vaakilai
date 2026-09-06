from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum


class CaseStatus(str, Enum):
    active = "active"
    pending = "pending"
    closed = "closed"
    on_hold = "on_hold"
    appealed = "appealed"


class CaseCreate(BaseModel):
    """Mirrors the fields the case-management UI actually collects.

    ``client_id``/``case_type``/``filed_date``/``next_hearing_date`` are kept as
    optional legacy aliases so older callers keep working.
    """
    title: str
    client_name: Optional[str] = None
    client_id: Optional[str] = None
    practice_area: Optional[str] = None
    case_type: Optional[str] = None  # legacy alias for practice_area
    court: Optional[str] = None
    judge: Optional[str] = None
    case_number: Optional[str] = None
    ecourts_case_id: Optional[str] = None
    description: Optional[str] = None
    status: CaseStatus = CaseStatus.pending
    filing_date: Optional[str] = None
    filed_date: Optional[str] = None  # legacy alias for filing_date
    next_hearing: Optional[str] = None
    next_hearing_date: Optional[str] = None  # legacy alias for next_hearing


class CaseUpdate(BaseModel):
    title: Optional[str] = None
    client_name: Optional[str] = None
    practice_area: Optional[str] = None
    status: Optional[CaseStatus] = None
    court: Optional[str] = None
    judge: Optional[str] = None
    case_number: Optional[str] = None
    description: Optional[str] = None
    filing_date: Optional[str] = None
    next_hearing: Optional[str] = None


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
    # Stored schema keeps the canonical field names (``case_type``,
    # ``filed_date``, ``next_hearing_date``) that the rest of the backend
    # (clients, analytics, client-portal, ecourts) reads. The cases route maps
    # these to/from the UI names (``practice_area``, ``filing_date``,
    # ``next_hearing``). ``use_enum_values`` stores ``status`` as a plain string
    # so it round-trips cleanly through MongoDB and JSON.
    model_config = {"use_enum_values": True}

    lawyer_id: str
    client_id: str = ""
    client_name: str = ""
    title: str
    case_type: str = ""
    court: Optional[str] = None
    judge: Optional[str] = None
    case_number: Optional[str] = None
    ecourts_case_id: Optional[str] = None
    description: Optional[str] = None
    status: CaseStatus = CaseStatus.pending
    filed_date: Optional[str] = None
    next_hearing_date: Optional[str] = None
    documents_count: int = 0
    tasks_pending: int = 0
    hearings: List[dict] = []
    tasks: List[dict] = []
    timeline: List[dict] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
