import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import Author, Direction, Lead, Message, User
from ..dependencies import get_current_user, get_db, sms_gateway
from ..schemas import LeadCreate, LeadView, MessageView, SendMessageRequest, SetAiPaused

router = APIRouter(tags=["leads"])


@router.post("/leads", response_model=LeadView, status_code=201)
def create_lead(payload: LeadCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Lead:
    existing = db.scalar(select(Lead).where(Lead.phone == payload.phone, Lead.company_id == user.company_id))
    if existing:
        raise HTTPException(409, "A lead with this phone already exists")
    lead = Lead(**payload.model_dump(), company_id=user.company_id)
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


@router.get("/company/leads", response_model=list[LeadView])
def list_leads(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[Lead]:
    return list(db.scalars(
        select(Lead).where(Lead.company_id == user.company_id).order_by(Lead.updated_at.desc())
    ))


@router.get("/handoffs", response_model=list[LeadView])
def handoff_queue(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[Lead]:
    return list(db.scalars(
        select(Lead).where(Lead.human_required.is_(True), Lead.company_id == user.company_id).order_by(Lead.updated_at)
    ))


@router.get("/leads/{lead_id}/messages", response_model=list[MessageView])
def get_conversation(lead_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[Message]:
    lead = db.get(Lead, lead_id)
    if not lead or lead.company_id != user.company_id:
        raise HTTPException(404, "Lead not found")
    return list(db.scalars(
        select(Message).where(Message.lead_id == lead_id).order_by(Message.created_at)
    ))


@router.post("/leads/{lead_id}/messages", response_model=MessageView, status_code=201)
async def send_staff_message(lead_id: uuid.UUID, payload: SendMessageRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Message:
    lead = db.get(Lead, lead_id)
    if not lead or lead.company_id != user.company_id:
        raise HTTPException(404, "Lead not found")
    if lead.opted_out or not lead.consent_to_sms:
        raise HTTPException(409, "This lead may not be messaged")

    if not lead.ai_paused:
        lead.ai_paused = True
        lead.human_required = False
        db.add(Message(lead_id=lead_id, direction=Direction.INTERNAL, author=Author.SYSTEM,
                       body="You took over. The assistant won't reply here until you hand it back."))

    # Need to add retry if message fails to send and sent, delivered, read, and failed receipts later
    receipt = await sms_gateway.send(lead.phone, lead.company.twilio_number, payload.body)

    message = Message(lead_id=lead_id, direction=Direction.OUTBOUND, body=payload.body,
                      provider_id=receipt.provider_id, author=Author.STAFF)
    db.add(message)
    db.commit()
    db.refresh(message)

    return message


@router.post("/leads/{lead_id}/ai", status_code=204)
def pause_ai(lead_id: uuid.UUID, payload: SetAiPaused, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    lead = db.scalar(select(Lead).where(Lead.id == lead_id))
    if not lead or lead.company_id != user.company_id:
        raise HTTPException(404, "Lead not found")

    lead.ai_paused = payload.paused
    db.commit()


@router.post("/leads/{lead_id}/resolve", response_model=LeadView)
def resolve_handoff(lead_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Lead:
    lead = db.get(Lead, lead_id)
    if not lead or lead.company_id != user.company_id:
        raise HTTPException(404, "Lead not found")

    lead.human_required = False
    db.commit()
    db.refresh(lead)

    return lead