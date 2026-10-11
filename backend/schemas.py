from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from .database import Direction, LeadStage
import uuid

class LeadCreate(BaseModel):
    phone: str
    first_name: str | None = None
    source: str = "manual_demo"
    consent_to_sms: bool = True


class DemoInbound(BaseModel):
    phone: str
    company_phone: str
    body: str
    provider_id: str | None = None


class ReplyDecision(BaseModel):
    reply: str = Field(max_length=320)
    intent: Literal[
        "greeting", "service_question", "pricing", "availability", "booking",
        "not_interested", "complaint", "emergency", "unknown"
    ]
    confidence: Literal["high", "medium", "low"]
    lead_stage: LeadStage
    needs_human: bool
    human_reason: str | None = None
    follow_up_hours: int | None = Field(default=None, ge=1, le=720)

    @field_validator("reply")
    @classmethod
    def clean_reply(cls, value: str) -> str:
        return " ".join(value.split()).strip()


class LeadView(BaseModel):
    id: uuid.UUID
    phone: str
    first_name: str | None
    source: str
    stage: LeadStage
    consent_to_sms: bool
    opted_out: bool
    human_required: bool
    last_intent: str | None
    created_at: datetime
    ai_paused: bool

    model_config = {"from_attributes": True}


class MessageView(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID
    direction: Direction
    body: str
    intent: str | None
    confidence: str | None
    created_at: datetime
    author: str | None

    model_config = {"from_attributes": True}


class SendMessageRequest(BaseModel):
    body: str

class ProcessResult(BaseModel):
    lead_id: uuid.UUID
    action: Literal["replied", "opted_out", "duplicate", "human_handoff", "ignored"]
    reply: str | None = None
    reason: str | None = None

class LoginRequest(BaseModel):
    email: str
    password: str
    remember: bool = False

class SignupRequest(BaseModel):
    email: str
    password: str
    join_code: str

class CreateCompany(BaseModel):
    name: str
    twilio_number: str
    timezone: str = "America/Los_Angeles"

class SetAiPaused(BaseModel):
    paused: bool


class LeadCountSummary(BaseModel):
    new_today: int
    new_week: int


class GHLInboundPayload(BaseModel):
    """TEMPORARY: shape of the custom JSON body configured in the GHL workflow's
    webhook action. Delete alongside the GHL gateway."""
    to: str
    phone: str
    message: str
    message_id: str | None = None

class DashboardSummary(BaseModel):
    new_leads_today: int
    new_leads_week: int
    new_leads_prev_week: int
    new_leads_by_day: list[int]
    active_conversations: int
    ai_paused_count: int
    booked_week: int
    ai_replies_week: int
    staff_replies_week: int
    first_reply_seconds: float | None


class HandoffItem(BaseModel):
    lead: LeadView
    reason: str | None
    waiting_since: datetime


class FollowUpItem(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID
    lead_name: str
    due_at: datetime
    reason: str
    status: str


class LastMessage(BaseModel):
    body: str
    author: str
    direction: Direction
    created_at: datetime


class RecentItem(BaseModel):
    lead: LeadView
    last_message: LastMessage | None


class DashboardData(BaseModel):
    summary: DashboardSummary
    stage_counts: dict[str, int]
    handoffs: list[HandoffItem]
    followups: list[FollowUpItem]
    recent: list[RecentItem]