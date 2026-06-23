import boto3
import httpx
import logging
from config import settings

logger = logging.getLogger(__name__)


def _mask_phone(phone: str) -> str:
    """Mask phone number for logging — DPDP Act compliance."""
    if not phone or len(phone) < 5:
        return "***"
    return phone[:3] + "****" + phone[-2:]


async def send_sms(phone: str, message: str) -> dict:
    """Send SMS via AWS SNS."""
    try:
        sns = boto3.client(
            "sns",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )
        response = sns.publish(PhoneNumber=phone, Message=message)
        logger.info("SMS sent to %s: %s", _mask_phone(phone), response["MessageId"])
        return {"status": "sent", "message_id": response["MessageId"]}
    except Exception as e:
        logger.error("SMS failed for %s: %s", _mask_phone(phone), type(e).__name__)
        return {"status": "failed", "error": str(e)}


async def send_email(to_email: str, subject: str, body: str, html_body: str = None) -> dict:
    """Send email via AWS SES."""
    try:
        ses = boto3.client(
            "ses",
            region_name=settings.aws_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )
        body_content = {"Text": {"Data": body}}
        if html_body:
            body_content["Html"] = {"Data": html_body}

        response = ses.send_email(
            Source="noreply@vakilai.in",
            Destination={"ToAddresses": [to_email]},
            Message={"Subject": {"Data": subject}, "Body": body_content},
        )
        logger.info("Email sent: %s", response["MessageId"])
        return {"status": "sent", "message_id": response["MessageId"]}
    except Exception as e:
        logger.error("Email send failed: %s", type(e).__name__)
        return {"status": "failed", "error": str(e)}


async def send_whatsapp(phone: str, message: str) -> dict:
    """Send WhatsApp message via Meta Business API."""
    try:
        url = f"https://graph.facebook.com/v18.0/{settings.whatsapp_phone_id}/messages"
        headers = {"Authorization": f"Bearer {settings.whatsapp_api_token}", "Content-Type": "application/json"}
        payload = {
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "text",
            "text": {"body": message},
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, headers=headers, timeout=10.0)
            resp.raise_for_status()
        logger.info("WhatsApp sent to %s", _mask_phone(phone))
        return {"status": "sent"}
    except Exception as e:
        logger.error("WhatsApp failed for %s: %s", _mask_phone(phone), type(e).__name__)
        return {"status": "failed", "error": str(e)}


async def notify_hearing_reminder(lawyer_phone: str, client_phone: str, case_title: str, date: str):
    msg = f"VakilAI Reminder: Hearing for '{case_title}' is scheduled on {date}. Please be prepared."
    await send_sms(lawyer_phone, msg)
    await send_whatsapp(lawyer_phone, msg)
    await send_sms(client_phone, msg)


async def notify_consultation_booked(lawyer_phone: str, consumer_name: str, scheduled_at: str):
    msg = f"VakilAI: New consultation booked by {consumer_name} on {scheduled_at}. Please log in to confirm."
    await send_whatsapp(lawyer_phone, msg)
    await send_sms(lawyer_phone, msg)
