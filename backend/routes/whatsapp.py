"""
WhatsApp webhook handler (Twilio skeleton).
Set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN in .env to activate.
Forwards messages to the AI consultation service.
"""

import hmac
import hashlib
import logging
import re
from urllib.parse import urlencode

# Prompt injection patterns — mirrors ai_service/routes/consult.py
_INJECTION_PATTERNS = re.compile(
    r"(ignore\s+(previous|above|all|prior)\s+instructions?"
    r"|you\s+are\s+now\s+"
    r"|system\s*prompt"
    r"|jailbreak"
    r"|pretend\s+you\s+are"
    r"|act\s+as\s+(a\s+)?(different|new|unrestricted)"
    r"|disregard\s+(all\s+)?(previous|prior|above)"
    r"|override\s+(your\s+)?(instructions?|guidelines?)"
    r"|forget\s+(your\s+)?(instructions?|training))",
    re.IGNORECASE,
)

MAX_WHATSAPP_BODY = 1000  # chars — Twilio sends max ~1600 but we cap earlier


def _sanitize_whatsapp_body(body: str) -> str | None:
    """Return sanitized body or None if it contains injection patterns."""
    body = body.strip()[:MAX_WHATSAPP_BODY]
    if _INJECTION_PATTERNS.search(body):
        return None
    return body

import httpx
from fastapi import APIRouter, Depends, Request, Response, HTTPException
from fastapi.responses import PlainTextResponse

from config import settings
from middleware.auth_middleware import require_admin as _require_admin

router = APIRouter()
logger = logging.getLogger(__name__)


def _verify_twilio_signature(request_url: str, post_params: dict, signature: str) -> bool:
    """Verify Twilio webhook signature."""
    if not settings.twilio_auth_token:
        # No Twilio token configured — reject all incoming webhooks to prevent
        # unauthenticated callers from triggering AI queries.
        return False
    sorted_params = sorted(post_params.items())
    s = request_url + "".join(k + v for k, v in sorted_params)
    computed = hmac.new(
        settings.twilio_auth_token.encode("utf-8"),
        s.encode("utf-8"),
        hashlib.sha1,  # nosec B324 — HMAC-SHA1 is mandated by Twilio's webhook signature protocol
    ).digest()
    import base64
    return base64.b64encode(computed).decode() == signature


async def _send_whatsapp_reply(to: str, body: str):
    """Send WhatsApp message via Twilio REST API."""
    if not settings.twilio_account_sid or not settings.twilio_auth_token:
        logger.info(f"[WhatsApp Mock] To: {to} | Message: {body[:100]}")
        return

    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json"
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            auth=(settings.twilio_account_sid, settings.twilio_auth_token),
            data={"From": settings.twilio_whatsapp_number, "To": to, "Body": body},
        )
        if resp.status_code >= 400:
            logger.error(f"Twilio send failed: {resp.text}")


async def _get_ai_response(message: str, from_number: str) -> str:
    """Call VakilAI AI service consultation endpoint (service-to-service with internal key)."""
    try:
        headers = {}
        if settings.internal_service_key:
            headers["X-Internal-Key"] = settings.internal_service_key
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{settings.ai_service_url}/ai/consult",
                json={"query": message, "language": "en", "conversation_history": []},
                headers=headers,
            )
            if resp.status_code == 200:
                data = resp.json()
                answer = data.get("answer", "")
                confidence = data.get("confidence", 0)
                conf_label = "High" if confidence > 0.8 else "Medium" if confidence > 0.6 else "Low"
                return (
                    f"{answer[:1000]}\n\n"
                    f"_Confidence: {conf_label} | VakilAI Legal Assistant_\n"
                    "_This is AI-generated information, not legal advice._"
                )
    except Exception as e:
        logger.error(f"AI service call failed: {e}")
    return (
        "Sorry, I'm unable to process your query right now. "
        "Please visit vakilai.com or try again later.\n\n"
        "_VakilAI Legal Assistant_"
    )


@router.post("/webhook")
async def whatsapp_webhook(request: Request):
    """Receive incoming WhatsApp messages from Twilio."""
    form = await request.form()
    params = dict(form)

    # Verify signature
    sig = request.headers.get("X-Twilio-Signature", "")
    if not _verify_twilio_signature(str(request.url), params, sig):
        raise HTTPException(403, "Invalid Twilio signature")

    from_number = params.get("From", "")
    body = params.get("Body", "").strip()
    # Hash the phone number before logging to avoid storing PII (PDPB compliance)
    phone_hash = hashlib.sha256(from_number.encode()).hexdigest()[:12]
    logger.info("WhatsApp message received", extra={"phone_hash": phone_hash, "body_len": len(body)})

    if not body:
        return PlainTextResponse("", status_code=200)

    # Sanitize for prompt injection before any processing
    safe_body = _sanitize_whatsapp_body(body)
    if safe_body is None:
        logger.warning(
            "Prompt injection attempt via WhatsApp",
            extra={"phone_hash": phone_hash, "body_len": len(body)},
        )
        await _send_whatsapp_reply(
            from_number,
            "Sorry, your message could not be processed. Please ask a genuine legal question.",
        )
        return Response(
            content='<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
            media_type="application/xml",
        )

    # Handle commands
    if safe_body.lower() in ("hi", "hello", "help", "start"):
        reply = (
            "Welcome to VakilAI — India's Legal AI Assistant!\n\n"
            "Send me your legal question in English and I'll help you understand your rights.\n\n"
            "Examples:\n"
            "• What are my rights if arrested?\n"
            "• How to file consumer complaint?\n"
            "• What is Section 498A IPC?\n\n"
            "_For professional legal advice, visit vakilai.com to connect with a verified lawyer._"
        )
    else:
        reply = await _get_ai_response(safe_body, from_number)

    await _send_whatsapp_reply(from_number, reply)

    # Return TwiML (empty — we already sent via API)
    return Response(
        content='<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        media_type="application/xml",
    )


@router.get("/status")
async def whatsapp_status(current_user: dict = Depends(_require_admin)):
    """Check WhatsApp integration status. Admin only — exposes Twilio config."""
    configured = bool(settings.twilio_account_sid and settings.twilio_auth_token)
    return {
        "configured": configured,
        "number": settings.twilio_whatsapp_number if configured else None,
        "mode": "live" if configured else "skeleton (add TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN to .env)",
    }
