from datetime import datetime, timezone

from sqlalchemy import select

from .database import Direction, FollowUp, Lead, Message, SessionLocal
from .sms import SMSGateway

MAX_FOLLOWUP_ATTEMPTS = 3

async def run_due_followups(sms: SMSGateway) -> int:
    """Conservative example: fixed template, eligibility rechecked at send time."""
    sent = 0
    with SessionLocal() as db:
        due = list(db.scalars(select(FollowUp).where(
            FollowUp.status == "pending", FollowUp.due_at <= datetime.now(timezone.utc)
        )))
        for item in due:
            lead = db.get(Lead, item.lead_id)
            if not lead or lead.opted_out or not lead.consent_to_sms or lead.human_required:
                item.status = "cancelled"
                continue
            body = f"Just checking in—would you like the booking link, or is there a question I can help with? Reply STOP to opt out."
            try:
                company_twilio_phone = lead.company.twilio_number
                receipt = await sms.send(lead.phone, company_twilio_phone, body)
            except Exception as e:
                item.attempts += 1
                if item.attempts >= MAX_FOLLOWUP_ATTEMPTS:
                    item.status = "failed"
                continue

            db.add(Message(
                lead_id=lead.id, direction=Direction.OUTBOUND,
                body=body, provider_id=receipt.provider_id, intent="follow_up",
            ))
            item.status = "sent"
            sent += 1
        db.commit()
    return sent

