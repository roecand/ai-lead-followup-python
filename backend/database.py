from datetime import datetime, timezone, timedelta
from enum import Enum

from sqlalchemy import Boolean, DateTime, Enum as SqlEnum, ForeignKey, String, Text, UniqueConstraint, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker

import uuid
from sqlalchemy.dialects.postgresql import UUID

from backend.core.config import get_settings

import secrets

def generate_join_code() -> str:
    return secrets.token_urlsafe(8)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class LeadStage(str, Enum):
    NEW = "new"
    CONTACTED = "contacted"
    ENGAGED = "engaged"
    QUALIFIED = "qualified"
    BOOKED = "booked"
    NURTURE = "nurture"
    CLOSED = "closed"
    DO_NOT_CONTACT = "do_not_contact"


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone: Mapped[str] = mapped_column(String(32), index=True)
    first_name: Mapped[str | None] = mapped_column(String(120))
    source: Mapped[str] = mapped_column(String(120), default="unknown")
    stage: Mapped[LeadStage] = mapped_column(SqlEnum(LeadStage), default=LeadStage.NEW)
    consent_to_sms: Mapped[bool] = mapped_column(Boolean, default=False)
    opted_out: Mapped[bool] = mapped_column(Boolean, default=False)
    human_required: Mapped[bool] = mapped_column(Boolean, default=False)
    last_intent: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    ai_paused: Mapped[bool] = mapped_column(Boolean, default=False)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), index=True)

    company: Mapped["Company"] = relationship(back_populates="leads")
    messages: Mapped[list["Message"]] = relationship(back_populates="lead", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("company_id", "phone", name="uq_lead_company_phone"),
    )


class Author(str, Enum):
    CUSTOMER = "customer"
    ASSISTANT = "assistant"
    STAFF = "staff"
    SYSTEM = "system"

class Direction(str, Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"
    INTERNAL = "internal"


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("leads.id"), index=True)
    direction: Mapped[Direction] = mapped_column(SqlEnum(Direction))
    body: Mapped[str] = mapped_column(Text)
    provider_id: Mapped[str | None] = mapped_column(String(160), unique=True)
    intent: Mapped[str | None] = mapped_column(String(80))
    confidence: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    author: Mapped[Author] = mapped_column(SqlEnum(Author), default=Author.ASSISTANT)

    lead: Mapped[Lead] = relationship(back_populates="messages")


class FollowUp(Base):
    __tablename__ = "followups"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("leads.id"), index=True)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    reason: Mapped[str] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(30), default="pending", index=True)
    attempts: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(160))
    twilio_number: Mapped[str] = mapped_column(String(32), unique=True)
    timezone: Mapped[str] = mapped_column(String(60), default="America/Los_Angeles")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    users: Mapped[list["User"]] = relationship(back_populates="company")
    leads: Mapped[list["Lead"]] = relationship(back_populates="company")
    invites: Mapped[list["Invite"]] = relationship(back_populates="company")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(160))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    role: Mapped[str] = mapped_column(String(30), default="staff")  # owner / staff, room to grow

    company: Mapped[Company] = relationship(back_populates="users")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    token: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Invite(Base):
    __tablename__ = "invites"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"), index=True)
    email: Mapped[str] = mapped_column(String(255), index=True)  # save lowercase, not unique
    join_code: Mapped[str] = mapped_column(String(20), unique=True, index=True, default=generate_join_code)
    role: Mapped[str] = mapped_column(String(30), default="staff")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: utcnow() + timedelta(days=7))

    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    used_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))

    company: Mapped["Company"] = relationship(back_populates="invites")



settings = get_settings()
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)



def create_schema() -> None:
    Base.metadata.create_all(engine)

