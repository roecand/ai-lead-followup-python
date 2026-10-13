from datetime import datetime

from pydantic import BaseModel
import uuid

from backend.database import Direction
from .leads import LeadView

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