from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum


class PaymentStatus(str, Enum):
    created = "created"
    authorized = "authorized"
    captured = "captured"
    refunded = "refunded"
    failed = "failed"


class PaymentCreate(BaseModel):
    consultation_id: str
    amount: float           # in INR
    currency: str = "INR"


class EscrowRelease(BaseModel):
    consultation_id: str
    reason: Optional[str] = None


class PaymentDB(BaseModel):
    user_id: str
    consultation_id: str
    amount: float
    currency: str = "INR"
    gst_amount: float = 0.0
    commission_amount: float = 0.0
    lawyer_payout: float = 0.0
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    status: PaymentStatus = PaymentStatus.created
    escrow_held: bool = False
    escrow_released: bool = False
    invoice_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class InvoiceLineItem(BaseModel):
    description: str
    hours: Optional[float] = None
    rate: Optional[float] = None
    amount: float = 0.0


class InvoiceCreate(BaseModel):
    client_name: str
    client_email: Optional[EmailStr] = None
    client_id: Optional[str] = None
    case_id: Optional[str] = None
    items: List[InvoiceLineItem]
    gst_rate: float = 0.18
    due_date: Optional[str] = None
    notes: Optional[str] = None
    status: str = "draft"  # "draft" or "sent"


class InvoiceSendRequest(BaseModel):
    to_email: EmailStr


class TimeEntryCreate(BaseModel):
    case_id: str
    description: str
    duration_minutes: int
    billable: bool = True
    rate_per_hour: Optional[float] = None


class ExpenseCreate(BaseModel):
    case_id: str
    description: str
    amount: float
    category: str
    receipt_url: Optional[str] = None
