from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import Depends, FastAPI, Form, HTTPException, Cookie, Header, WebSocket, WebSocketDisconnect, WebSocketException, Request
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import select
from sqlalchemy.orm import Session
import uuid

import jwt
import secrets
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext

from .config import get_settings
from .database import Lead, Message, SessionLocal, create_schema, User, RefreshToken, Company, Direction, Author
from .followups import run_due_followups
from .knowledge import load_knowledge
from .llm import build_gateway
from .schemas import (
    DemoInbound,
    LeadCreate,
    LeadView,
    MessageView,
    ProcessResult,
    LoginRequest,
    SignupRequest,
    CreateCompany,
    SetAiPaused,
    SendMessageRequest,
    GHLInboundPayload, # Temporary for testing
)
from .service import ConversationService
from .sms import build_sms_gateway
from .connnection_manager import manager
from .ratelimit import RedisClient


sms_gateway = build_sms_gateway()
service = ConversationService(build_gateway(), sms_gateway, load_knowledge())
scheduler = AsyncIOScheduler()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
redis_client = RedisClient()


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# INTERNAL
@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "mode": "demonstration"}


def decode_access_token(token: str | None) -> dict:
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        return jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Expired token")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


def try_decode_access_token(token: str | None) -> dict:
    if not token:
        return None
    try:
        return jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
    except:
        return None


def get_current_user(db: Session = Depends(get_db), token: str | None = Cookie(default=None)) -> User:
    payload = decode_access_token(token)
    user = db.get(User, uuid.UUID(payload["user_id"]))
    if not user:
        raise HTTPException(401, "User not found")
    return user

def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, db: Session = Depends(get_db), token: str = Cookie(default=None)) -> None:
    payload = try_decode_access_token(token)
    user = db.get(User, uuid.UUID(payload["user_id"])) if payload else None
    if not user:
        await websocket.close(code=4401)
        return

    await manager.connect(user.company_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user.company_id, websocket)

# TEMPORARY: inbound bridge for GoHighLevel testing. Fed by a GHL Workflow's
# "Webhook" action (Trigger: Customer Replied), not a native GHL app webhook —
# GHL doesn't sign these, so a shared secret in the query string is the only
# check we have. Delete this route when GHL testing is done.
import re

def _normalize_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if len(digits) == 10:
        digits = "1" + digits
    return f"+{digits}"


@app.post("/webhooks/ghl/inbound")
async def ghl_inbound(request: Request, token: str, db: Session = Depends(get_db)) -> Response:
    settings = get_settings()
    if not settings.ghl_webhook_secret or token != settings.ghl_webhook_secret:
        raise HTTPException(403, "Not authorized")

    raw = await request.json()
    custom = raw.get("customData", {})

    to = custom.get("to")
    message_body = custom.get("message") or (raw.get("message") or {}).get("body")
    phone_source = raw.get("phone") or custom.get("phone")
    message_id = custom.get("message_id") or None  # "" -> None

    if not to or not message_body or not phone_source:
        raise HTTPException(422, "Missing to/phone/message in webhook payload")

    phone = _normalize_phone(phone_source)

    company = db.scalar(select(Company).where(Company.twilio_number == to))
    if company is None:
        raise HTTPException(404, "No company is registered for this number")

    await service.receive(db, company, phone, message_body, message_id)
    return Response(status_code=204)


@app.post("/auth/login", status_code=204)
async def auth_login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)) -> None:
    email_key = f"login_fail:email:{payload.email.strip().lower()}"
    ip_key = f"login_fail:ip:{client_ip(request)}"

    email_limit_hit = await redis_client.check_login(email_key, redis_client.MAX_FAILS_PER_EMAIL)
    ip_limit_hit = await redis_client.check_login(ip_key, redis_client.MAX_FAILS_PER_IP)

    if email_limit_hit or ip_limit_hit:
        raise HTTPException(429, "Too many login attempts. Try again later.")

    user = db.scalar(select(User).where(User.email == payload.email))

    if not user or not pwd_context.verify(payload.password, user.hashed_password):
        raise HTTPException(401, "Invalid email or password")

    await redis_client.delete(email_key)
    await redis_client.delete(ip_key)

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
    access_token = jwt.encode(
        {"user_id": str(user.id), "exp": expires_at},
        get_settings().jwt_secret,
        algorithm="HS256",
    )

    refresh_lifetime = timedelta(days=30) if payload.remember else timedelta(days=1)
    refresh_value = secrets.token_hex(32)
    refresh_expires = datetime.now(timezone.utc) + refresh_lifetime

    db.add(RefreshToken(user_id=user.id, token=refresh_value, expires_at=refresh_expires,))
    db.commit()

    response.set_cookie(
        key="token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=1800,
    )

    response.set_cookie(
        key="refresh_token",
        value=refresh_value,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=int(refresh_lifetime.total_seconds()),
    )

@app.post("/auth/refresh", status_code=204)
async def auth_refresh(response: Response, db: Session = Depends(get_db), refresh_token: str | None = Cookie(default=None)) -> None:
    if not refresh_token:
        raise HTTPException(401, "No refresh token provided")

    stored = db.scalar(select(RefreshToken).where(RefreshToken.token == refresh_token))

    if not stored or stored.expires_at < datetime.now(timezone.utc):
        if stored:
            db.delete(stored)
            db.commit()
        raise HTTPException(401, "Refresh token invalid or expired")

    new_access_epires = datetime.now(timezone.utc) + timedelta(minutes=30)
    new_access_token = jwt.encode(
        {"user_id": str(stored.user_id), "exp": new_access_epires},
        get_settings().jwt_secret,
        algorithm="HS256",
    )

    response.set_cookie(
        key="token",
        value=new_access_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=1800,
    )


def require_admin_key(x_admin_key: str = Header(...)) -> None:
    if x_admin_key != get_settings().admin_secret:
        raise HTTPException(403, "Not authorized")

# Only admin can create an account for a client right now, though no admin checks are in place atm
# INTERNAL
@app.post("/admin/insert_user", status_code=204)
async def insert_user(payload: SignupRequest, db: Session = Depends(get_db), _: None = Depends(require_admin_key)) -> None:
    existing_user = db.scalar(select(User).where(User.email == payload.email))

    if existing_user:
        raise HTTPException(409, "User with this email already exists")

    company = db.scalar(select(Company).where(Company.join_code == payload.join_code))

    if not company:
        raise HTTPException(409, "Code is either expired or the company was never registered. Check your code or contact an admin to get your company registered.")

    user = User(
        email=payload.email,
        hashed_password=pwd_context.hash(payload.password),
        company=company,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

# INTERNAL
@app.post("/admin/create_company", status_code=201)
async def create_company(payload: CreateCompany, db: Session = Depends(get_db), _: None = Depends(require_admin_key)) -> dict:
    existing = db.scalar(select(Company).where(Company.twilio_number == payload.twilio_number))
    if existing:
        raise HTTPException(409, "Company with this twilio number already exists")

    company = Company(name=payload.name, twilio_number=payload.twilio_number, timezone=payload.timezone)

    db.add(company)
    db.commit()
    db.refresh(company)

    return {"id": str(company.id), "name": company.name, "join_code": company.join_code, "twilio_number": company.twilio_number}

# INTERNAL
# Runs the follow up script
@app.post("/admin/run-followups")
async def trigger_followups(_: None = Depends(require_admin_key)) -> dict[str, int]:
    # Production TODO: protect this route with admin authentication.
    return {"sent": await run_due_followups(sms_gateway)}


# Create lead, INTERNAL, temp
@app.post("/leads", response_model=LeadView, status_code=201)
def create_lead(payload: LeadCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Lead:
    existing = db.scalar(select(Lead).where(Lead.phone == payload.phone, Lead.company_id == user.company_id))
    if existing:
        raise HTTPException(409, "A lead with this phone already exists")
    lead = Lead(**payload.model_dump(), company_id=user.company_id)
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


@app.get("/company/leads", response_model=list[LeadView])
def list_leads(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[Lead]:
    return list(db.scalars(
        select(Lead).where(Lead.company_id == user.company_id).order_by(Lead.updated_at.desc())
    ))


# Gets leads where human interjection is needed
@app.get("/handoffs", response_model=list[LeadView])
def handoff_queue(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[Lead]:
    return list(db.scalars(
        select(Lead).where(Lead.human_required.is_(True), Lead.company_id == user.company_id).order_by(Lead.updated_at)
    ))


# Gets conversation between lead given the lead_id
@app.get("/leads/{lead_id}/messages", response_model=list[MessageView])
def get_conversation(lead_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[Message]:
    lead = db.get(Lead, lead_id)
    if not lead or lead.company_id != user.company_id:
        raise HTTPException(404, "Lead not found")
    return list(db.scalars(
        select(Message).where(Message.lead_id == lead_id).order_by(Message.created_at)
    ))

@app.post("/leads/{lead_id}/messages", response_model=MessageView, status_code=201)
async def send_staff_message(lead_id:uuid.UUID, payload: SendMessageRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Message:
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

    # Need to add retry if message fails to send and sent, delivered, read, and failed reciepts later
    receipt = await sms_gateway.send(lead.phone, lead.company.twilio_number, payload.body)

    message = Message(lead_id=lead_id, direction=Direction.OUTBOUND, body=payload.body,
                      provider_id=receipt.provider_id, author=Author.STAFF)
    db.add(message)
    db.commit()
    db.refresh(message)

    return message


# Sends first outbound message
# INTERNAL
@app.post("/leads/{lead_id}/start", response_model=ProcessResult)
async def start_conversation(lead_id: uuid.UUID, db: Session = Depends(get_db), _: None = Depends(require_admin_key)) -> ProcessResult:
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    return await service.start(db, lead)


@app.post("/leads/{lead_id}/ai", status_code=204)
def pause_ai(lead_id: uuid.UUID, payload: SetAiPaused, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    lead = db.scalar(select(Lead).where(Lead.id == lead_id))
    if not lead or lead.company_id != user.company_id:
        raise HTTPException(404, "Lead not found")

    lead.ai_paused = payload.paused

    db.commit()

@app.post("/leads/{lead_id}/resolve", response_model=LeadView)
def resolve_handoff(lead_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Lead:
    lead = db.get(Lead, lead_id)
    if not lead or lead.company_id != user.company_id:
        raise HTTPException(404, "Lead not found")

    lead.human_required = False
    db.commit()
    db.refresh(lead)

    return lead


# Simulates inbound message, INTERNAL
@app.post("/demo/inbound", response_model=ProcessResult)
async def demo_inbound(payload: DemoInbound, db: Session = Depends(get_db), _: None = Depends(require_admin_key)) -> ProcessResult:
    company = db.scalar(select(Company).where(Company.twilio_number == payload.company_phone))
    if company is None:
        raise HTTPException(404, "No company is registered for this number")
    return await service.receive(db, company, payload.phone, payload.body, payload.provider_id)


# Twilio inbound
@app.post("/webhooks/twilio/inbound")
async def twilio_inbound(From: str = Form(...), To: str = Form(...), Body: str = Form(...), MessageSid: str = Form(...), db: Session = Depends(get_db),) -> Response:
    company = db.scalar(select(Company).where(Company.twilio_number == To))
    if company is None:
        raise HTTPException(404, "No company is registered for this number")
    # Production TODO: validate Twilio's X-Twilio-Signature before processing.
    await service.receive(db, company, From, Body, MessageSid)
    return Response(content="<Response></Response>", media_type="application/xml")