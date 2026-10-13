from typing import Literal

from pydantic import BaseModel, Field, field_validator

from ..database import LeadStage
import uuid

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


class ProcessResult(BaseModel):
    lead_id: uuid.UUID
    action: Literal["replied", "opted_out", "duplicate", "human_handoff", "ignored"]
    reply: str | None = None
    reason: str | None = None