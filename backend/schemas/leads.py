from datetime import datetime

from pydantic import BaseModel

from backend.database import Direction, LeadStage
import uuid


class LeadCreate(BaseModel):
    phone: str
    first_name: str | None = None
    source: str = "manual_demo"
    consent_to_sms: bool = True


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


class SetAiPaused(BaseModel):
    paused: bool