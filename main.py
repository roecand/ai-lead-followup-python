from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import Depends, FastAPI, Form, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import Lead, Message, SessionLocal, create_schema
from .followups import run_due_followups
from .knowledge import load_knowledge
from .llm import build_gateway
from .schemas import DemoInbound, LeadCreate, LeadView, MessageView, ProcessResult
from .service import ConversationService
from .sms import build_sms_gateway

sms_gateway = build_sms_gateway()
service = ConversationService(build_gateway(), sms_gateway, load_knowledge())
scheduler = AsyncIOScheduler()


def get_db():
    with SessionLocal() as db:
        yield db


@asynccontextmanager
async def lifespan(_: FastAPI):
    create_schema()
    scheduler.add_job(run_due_followups, "interval", minutes=1, args=[sms_gateway], max_instances=1)
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(
    title="AI Lead Follow-up Reference Build",
    version="0.1.0",
    description="A safe proof-of-concept, not production-ready messaging software.",
    lifespan=lifespan,
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "mode": "demonstration"}


@app.post("/leads", response_model=LeadView, status_code=201)
def create_lead(payload: LeadCreate, db: Session = Depends(get_db)) -> Lead:
    existing = db.scalar(select(Lead).where(Lead.phone == payload.phone))
    if existing:
        raise HTTPException(409, "A lead with this phone already exists")
    lead = Lead(**payload.model_dump())
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


@app.get("/leads/{lead_id}", response_model=LeadView)
def get_lead(lead_id: int, db: Session = Depends(get_db)) -> Lead:
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    return lead


@app.get("/leads/{lead_id}/messages", response_model=list[MessageView])
def get_conversation(lead_id: int, db: Session = Depends(get_db)) -> list[Message]:
    if not db.get(Lead, lead_id):
        raise HTTPException(404, "Lead not found")
    return list(db.scalars(
        select(Message).where(Message.lead_id == lead_id).order_by(Message.created_at)
    ))


@app.post("/leads/{lead_id}/start", response_model=ProcessResult)
async def start_conversation(lead_id: int, db: Session = Depends(get_db)) -> ProcessResult:
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    return await service.start(db, lead)


@app.get("/handoffs", response_model=list[LeadView])
def handoff_queue(db: Session = Depends(get_db)) -> list[Lead]:
    return list(db.scalars(
        select(Lead).where(Lead.human_required.is_(True)).order_by(Lead.updated_at)
    ))


@app.post("/demo/inbound", response_model=ProcessResult)
async def demo_inbound(payload: DemoInbound, db: Session = Depends(get_db)) -> ProcessResult:
    return await service.receive(db, payload.phone, payload.body, payload.provider_id)


@app.post("/webhooks/twilio/inbound")
async def twilio_inbound(
    From: str = Form(...), Body: str = Form(...), MessageSid: str = Form(...),
    db: Session = Depends(get_db),
) -> Response:
    # Production TODO: validate Twilio's X-Twilio-Signature before processing.
    await service.receive(db, From, Body, MessageSid)
    return Response(content="<Response></Response>", media_type="application/xml")


@app.post("/admin/run-followups")
async def trigger_followups() -> dict[str, int]:
    # Production TODO: protect this route with admin authentication.
    return {"sent": await run_due_followups(sms_gateway)}
