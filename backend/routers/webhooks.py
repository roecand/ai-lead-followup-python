import re

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session
from twilio.request_validator import RequestValidator

from ..config import get_settings
from ..database import Company
from ..dependencies import get_db, service

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _normalize_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if len(digits) == 10:
        digits = "1" + digits
    return f"+{digits}"


# TEMPORARY inbound bridge for GoHighLevel testing. Fed by a GHL Workflow
# Webhook action (Trigger is Customer Replied), not a native GHL app webhook.
# GHL does not sign these, so a shared secret in the query string is the only
# check we have. Delete this route when GHL testing is done.
@router.post("/ghl/inbound")
async def ghl_inbound(request: Request, token: str, db: Session = Depends(get_db)) -> Response:
    settings = get_settings()
    if not settings.ghl_webhook_secret or token != settings.ghl_webhook_secret:
        raise HTTPException(403, "Not authorized")

    raw = await request.json()
    custom = raw.get("customData", {})

    to = custom.get("to")
    message_body = custom.get("message") or (raw.get("message") or {}).get("body")
    phone_source = raw.get("phone") or custom.get("phone")
    message_id = custom.get("message_id") or None

    if not to or not message_body or not phone_source:
        raise HTTPException(422, "Missing to/phone/message in webhook payload")

    phone = _normalize_phone(phone_source)

    company = db.scalar(select(Company).where(Company.twilio_number == to))
    if company is None:
        raise HTTPException(404, "No company is registered for this number")

    await service.receive(db, company, phone, message_body, message_id)
    return Response(status_code=204)


@router.post("/webhooks/twilio/inbound")
async def twilio_inbound(request: Request, db: Session = Depends(get_db)) -> Response:
    settings = get_settings()
    if not settings.twilio_auth_token:
        raise HTTPException(403, "Webhook not configured")  # fail closed

    form = await request.form()
    signature = request.headers.get("X-Twilio-Signature", "")
    url = settings.public_base_url.rstrip("/") + request.url.path

    if not RequestValidator(settings.twilio_auth_token).validate(url, dict(form), signature):
        raise HTTPException(403, "Invalid signature")

    to, sender = form.get("To"), form.get("From")
    body, sid = form.get("Body"), form.get("MessageSid")
    if not (to and sender and body and sid):
        raise HTTPException(422, "Missing fields")

    company = db.scalar(select(Company).where(Company.twilio_number == to))
    if company is None:
        raise HTTPException(404, "No company is registered for this number")

    await service.receive(db, company, sender, body, sid)
    return Response(content="<Response></Response>", media_type="application/xml")