from pydantic import BaseModel, Field
from typing import Optional
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


class InvoiceCreate(BaseModel):
    client_id: str
    case_id: Optional[str] = None
    line_items: list
    notes: Optional[str] = None


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
