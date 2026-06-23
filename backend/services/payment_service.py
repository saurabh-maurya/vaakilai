import logging
from config import settings

logger = logging.getLogger(__name__)

# razorpay 1.4.1 uses pkg_resources which is absent in Python 3.12+.
# Import lazily so the server starts even without razorpay configured.
try:
    import razorpay as _razorpay
    _RAZORPAY_AVAILABLE = True
except Exception:
    _razorpay = None
    _RAZORPAY_AVAILABLE = False
    logger.warning("razorpay package unavailable — payment orders will use mock mode.")


def get_razorpay_client():
    if not _RAZORPAY_AVAILABLE:
        return None
    return _razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))


async def create_razorpay_order(amount_inr: float) -> dict:
    """Create a Razorpay order. Amount in INR (paise internally)."""
    try:
        client = get_razorpay_client()
        order = client.order.create({
            "amount": int(amount_inr * 100),  # paise
            "currency": "INR",
            "receipt": f"vakilai_{id(amount_inr)}",
            "payment_capture": 1,
        })
        return order
    except Exception as e:
        logger.error(f"Razorpay order creation failed: {e}")
        # Return mock for dev environment
        return {"id": f"order_mock_{int(amount_inr)}", "amount": int(amount_inr * 100), "currency": "INR"}


async def generate_invoice_pdf(payment: dict, consultation: dict) -> str:
    """Generate a GST-compliant invoice PDF and upload to S3."""
    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A4
        import io
        from services.storage_service import upload_to_s3

        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        # Header
        c.setFont("Helvetica-Bold", 18)
        c.drawString(50, height - 60, "VakilAI Legal Services")
        c.setFont("Helvetica", 10)
        c.drawString(50, height - 80, "GSTIN: 29AAAAA0000A1Z5 | PAN: AAAAA0000A")
        c.drawString(50, height - 95, "support@vakilai.in | vakilai.in")

        c.line(50, height - 110, width - 50, height - 110)

        c.setFont("Helvetica-Bold", 14)
        c.drawString(50, height - 140, "TAX INVOICE")

        c.setFont("Helvetica", 10)
        c.drawString(50, height - 165, f"Consultation ID: {payment.get('consultation_id', 'N/A')}")
        c.drawString(50, height - 180, f"Payment ID: {payment.get('razorpay_payment_id', 'N/A')}")

        y = height - 220
        c.setFont("Helvetica-Bold", 10)
        c.drawString(50, y, "Description")
        c.drawString(350, y, "Amount (INR)")
        c.line(50, y - 5, width - 50, y - 5)

        y -= 25
        c.setFont("Helvetica", 10)
        c.drawString(50, y, f"Legal Consultation — {consultation.get('consultation_type', 'General')}")
        c.drawString(350, y, f"₹{payment.get('amount', 0):.2f}")

        y -= 20
        c.drawString(50, y, "GST @ 18%")
        c.drawString(350, y, f"₹{payment.get('gst_amount', 0):.2f}")

        y -= 5
        c.line(50, y, width - 50, y)
        y -= 20

        c.setFont("Helvetica-Bold", 10)
        c.drawString(50, y, "Total Amount")
        total = payment.get("amount", 0) + payment.get("gst_amount", 0)
        c.drawString(350, y, f"₹{total:.2f}")

        y -= 40
        c.setFont("Helvetica", 9)
        c.drawString(50, y, "This is a computer-generated invoice and does not require a signature.")
        c.drawString(50, y - 15, "VakilAI AI-generated guidance is for informational purposes only and does not constitute legal advice.")

        c.save()
        pdf_bytes = buffer.getvalue()

        s3_key = f"invoices/{payment.get('consultation_id', 'unknown')}.pdf"
        url = await upload_to_s3(pdf_bytes, s3_key, "application/pdf", bucket="vakilai-invoices")
        return url
    except Exception as e:
        logger.error(f"Invoice generation failed: {e}")
        return ""
