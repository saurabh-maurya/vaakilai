import hmac
import hashlib
from fastapi import APIRouter, HTTPException, Depends, Request
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime
from pydantic import BaseModel as _PydanticBase

from database import get_db
from models.payment import PaymentCreate, EscrowRelease, InvoiceCreate, TimeEntryCreate, ExpenseCreate, PaymentDB
from middleware.auth_middleware import get_current_user, require_lawyer
from config import settings
from services.payment_service import create_razorpay_order, generate_invoice_pdf

router = APIRouter()

GST_RATE = 0.18
PLATFORM_COMMISSION = 0.15  # 15%


def _oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=422, detail="Invalid ID format")


def doc_out(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.post("/checkout")
async def create_checkout(payload: PaymentCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    consult = await db.consultations.find_one({"_id": _oid(payload.consultation_id)})
    if not consult:
        raise HTTPException(status_code=404, detail="Consultation not found")

    # Only the consumer who owns this consultation may initiate payment
    if consult.get("consumer_id") != current_user["user_id"] and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorised to pay for this consultation")

    gst = round(payload.amount * GST_RATE, 2)
    total = round(payload.amount + gst, 2)
    commission = round(payload.amount * PLATFORM_COMMISSION, 2)
    lawyer_payout = round(payload.amount - commission, 2)

    order = await create_razorpay_order(total)

    payment = PaymentDB(
        user_id=current_user["user_id"],
        consultation_id=payload.consultation_id,
        amount=payload.amount,
        gst_amount=gst,
        commission_amount=commission,
        lawyer_payout=lawyer_payout,
        razorpay_order_id=order.get("id"),
    ).model_dump()

    result = await db.payments.insert_one(payment)
    return {
        "payment_id": str(result.inserted_id),
        "razorpay_order_id": order.get("id"),
        "amount_inr": total,
        "razorpay_key": settings.razorpay_key_id,
    }


class PaymentVerifyRequest(_PydanticBase):
    payment_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@router.post("/verify")
async def verify_payment(
    payload: PaymentVerifyRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    payment = await db.payments.find_one({"_id": _oid(payload.payment_id), "user_id": current_user["user_id"]})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    # Verify Razorpay HMAC-SHA256 signature
    order_id = payment.get("razorpay_order_id", "")
    message = f"{order_id}|{payload.razorpay_payment_id}".encode()
    expected_signature = hmac.new(
        settings.razorpay_key_secret.encode(),
        message,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected_signature, payload.razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    await db.payments.update_one(
        {"_id": _oid(payload.payment_id)},
        {"$set": {
            "status": "captured",
            "escrow_held": True,
            "razorpay_payment_id": payload.razorpay_payment_id,
            "updated_at": datetime.utcnow(),
        }},
    )
    await db.consultations.update_one(
        {"_id": _oid(payment["consultation_id"])},
        {"$set": {"payment_id": payload.payment_id, "escrow_status": "held", "status": "confirmed"}},
    )
    return {"message": "Payment verified. Escrow held."}


@router.post("/escrow/release")
async def release_escrow(payload: EscrowRelease, current_user: dict = Depends(get_current_user)):
    db = get_db()
    consult = await db.consultations.find_one({"_id": _oid(payload.consultation_id)})
    if not consult:
        raise HTTPException(status_code=404, detail="Consultation not found")

    # Only the consumer who requested the consultation or an admin may release escrow
    uid = current_user["user_id"]
    role = current_user["role"]
    if role != "admin" and consult.get("consumer_id") != uid:
        raise HTTPException(status_code=403, detail="Not authorised to release escrow for this consultation")

    payment = await db.payments.find_one({"consultation_id": payload.consultation_id})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    await db.payments.update_one(
        {"_id": payment["_id"]},
        {"$set": {"escrow_released": True, "status": "captured", "updated_at": datetime.utcnow()}},
    )
    await db.consultations.update_one(
        {"_id": _oid(payload.consultation_id)},
        {"$set": {"escrow_status": "released", "status": "completed"}},
    )

    invoice_url = await generate_invoice_pdf(payment, consult)
    await db.payments.update_one({"_id": payment["_id"]}, {"$set": {"invoice_url": invoice_url}})

    return {"message": "Escrow released to lawyer", "invoice_url": invoice_url}


@router.get("/{payment_id}")
async def get_payment(payment_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await db.payments.find_one({"_id": _oid(payment_id), "user_id": current_user["user_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return doc_out(doc)


# --- Time Entries ---
@router.post("/time-entries", status_code=201)
async def create_time_entry(payload: TimeEntryCreate, current_user: dict = Depends(require_lawyer)):
    db = get_db()
    entry = payload.model_dump()
    entry["lawyer_id"] = current_user["user_id"]
    entry["created_at"] = datetime.utcnow()
    result = await db.time_entries.insert_one(entry)
    return {"id": str(result.inserted_id)}


@router.get("/time-entries")
async def get_time_entries(case_id: str = None, current_user: dict = Depends(require_lawyer)):
    db = get_db()
    query = {"lawyer_id": current_user["user_id"]}
    if case_id:
        query["case_id"] = case_id
    cursor = db.time_entries.find(query).sort("created_at", -1)
    results = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        results.append(doc)
    return results


# --- Invoices ---
@router.post("/invoices", status_code=201)
async def create_invoice(payload: InvoiceCreate, current_user: dict = Depends(require_lawyer)):
    db = get_db()
    subtotal = sum(item.get("amount", 0) for item in payload.line_items)
    gst = round(subtotal * GST_RATE, 2)
    invoice = {
        **payload.model_dump(),
        "lawyer_id": current_user["user_id"],
        "subtotal": subtotal,
        "gst_amount": gst,
        "total": subtotal + gst,
        "status": "draft",
        "created_at": datetime.utcnow(),
    }
    result = await db.invoices.insert_one(invoice)
    return {"id": str(result.inserted_id)}


@router.get("/invoices")
async def list_invoices(status: str = None, current_user: dict = Depends(require_lawyer)):
    db = get_db()
    query = {"lawyer_id": current_user["user_id"]}
    if status:
        query["status"] = status
    cursor = db.invoices.find(query).sort("created_at", -1)
    results = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        results.append(doc)
    return results


# --- Expenses ---
@router.post("/expenses", status_code=201)
async def create_expense(payload: ExpenseCreate, current_user: dict = Depends(require_lawyer)):
    db = get_db()
    expense = {**payload.model_dump(), "lawyer_id": current_user["user_id"], "created_at": datetime.utcnow()}
    result = await db.expenses.insert_one(expense)
    return {"id": str(result.inserted_id)}


@router.get("/analytics/profitability")
async def profitability(current_user: dict = Depends(require_lawyer)):
    db = get_db()
    lid = current_user["user_id"]
    revenue_pipeline = [
        {"$match": {"lawyer_id": lid}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}},
    ]
    revenue = 0
    async for row in db.invoices.aggregate(revenue_pipeline):
        revenue = row["total"]

    expenses_pipeline = [
        {"$match": {"lawyer_id": lid}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    expenses = 0
    async for row in db.expenses.aggregate(expenses_pipeline):
        expenses = row["total"]

    return {"revenue_inr": revenue, "expenses_inr": expenses, "profit_inr": revenue - expenses}
