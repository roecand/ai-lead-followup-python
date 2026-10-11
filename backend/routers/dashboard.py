from datetime import datetime, timedelta, timezone
from statistics import median
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import Author, Direction, FollowUp, Lead, LeadStage, Message, User
from ..dependencies import get_current_user, get_db
from ..schemas import (
    DashboardData,
    DashboardSummary,
    FollowUpItem,
    HandoffItem,
    LastMessage,
    LeadView,
    RecentItem,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

RECENT_LIMIT = 8
FOLLOWUP_LIMIT = 8
HANDOFF_PREFIX = "Human handoff: "  # written by ConversationService._apply_decision


def _utc(dt: datetime) -> datetime:
    """SQLite hands back naive datetimes. Treat those as UTC so comparisons work."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _handoff_reason(note: str | None) -> str | None:
    """Turn the internal system note left at handoff time into a line for a business owner."""
    if not note:
        return None
    if note.startswith(HANDOFF_PREFIX):
        return note[len(HANDOFF_PREFIX):].strip() or None
    if note.startswith("LLM failure"):
        return "The assistant couldn't come up with a safe reply"
    if note.startswith("SMS send failed"):
        return "The assistant's reply failed to send"
    return None  # frontend falls back to last_intent


@router.get("/summary", response_model=DashboardData)
def dashboard_summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> DashboardData:
    company_id = user.company_id
    tz = ZoneInfo(user.company.timezone)

    today_local = datetime.now(tz).replace(hour=0, minute=0, second=0, microsecond=0)
    week_start_local = today_local - timedelta(days=6)
    today_start = today_local.astimezone(timezone.utc)
    week_start = week_start_local.astimezone(timezone.utc)
    prev_week_start = (week_start_local - timedelta(days=7)).astimezone(timezone.utc)

    # --- New leads, daily bars, booked
    # Two weeks of leads is a small set, so bucket by local day in Python.
    # That keeps it working the same on Postgres and SQLite.
    new_today = new_week = new_prev = booked_week = 0
    by_day = [0] * 7
    rows = db.execute(
        select(Lead.created_at, Lead.stage).where(
            Lead.company_id == company_id,
            Lead.created_at >= prev_week_start,
        )
    ).all()
    for created_at, stage in rows:
        created = _utc(created_at)
        if created < week_start:
            new_prev += 1
            continue
        new_week += 1
        day = (created.astimezone(tz).date() - week_start_local.date()).days
        if 0 <= day < 7:
            by_day[day] += 1
        if created >= today_start:
            new_today += 1
        if stage == LeadStage.BOOKED:
            booked_week += 1

    # --- Active and paused
    active = db.scalar(
        select(func.count(func.distinct(Message.lead_id)))
        .join(Lead, Lead.id == Message.lead_id)
        .where(
            Lead.company_id == company_id,
            Message.created_at >= week_start,
            Message.direction != Direction.INTERNAL,
        )
    ) or 0

    paused = db.scalar(
        select(func.count()).select_from(Lead).where(
            Lead.company_id == company_id,
            Lead.ai_paused.is_(True),
            Lead.opted_out.is_(False),
        )
    ) or 0

    # --- Replies by who sent them
    reply_counts = dict(db.execute(
        select(Message.author, func.count())
        .join(Lead, Lead.id == Message.lead_id)
        .where(
            Lead.company_id == company_id,
            Message.direction == Direction.OUTBOUND,
            Message.created_at >= week_start,
        )
        .group_by(Message.author)
    ).all())

    # --- First reply time
    # For each lead: their first inbound text, then the first outbound message
    # after it. Only leads whose first text landed this week count.
    first_in = (
        select(Message.lead_id, func.min(Message.created_at).label("first_at"))
        .join(Lead, Lead.id == Message.lead_id)
        .where(Lead.company_id == company_id, Message.direction == Direction.INBOUND)
        .group_by(Message.lead_id)
        .subquery()
    )
    reply_at = (
        select(func.min(Message.created_at))
        .where(
            Message.lead_id == first_in.c.lead_id,
            Message.direction == Direction.OUTBOUND,
            Message.created_at > first_in.c.first_at,
        )
        .correlate(first_in)
        .scalar_subquery()
    )
    waits = [
        (_utc(replied) - _utc(asked)).total_seconds()
        for asked, replied in db.execute(
            select(first_in.c.first_at, reply_at).where(first_in.c.first_at >= week_start)
        ).all()
        if replied is not None
    ]

    summary = DashboardSummary(
        new_leads_today=new_today,
        new_leads_week=new_week,
        new_leads_prev_week=new_prev,
        new_leads_by_day=by_day,
        active_conversations=active,
        ai_paused_count=paused,
        booked_week=booked_week,
        ai_replies_week=reply_counts.get(Author.ASSISTANT, 0),
        staff_replies_week=reply_counts.get(Author.STAFF, 0),
        first_reply_seconds=round(median(waits), 1) if waits else None,
    )

    # --- Stage counts
    stage_counts = {
        stage.value: count
        for stage, count in db.execute(
            select(Lead.stage, func.count()).where(Lead.company_id == company_id).group_by(Lead.stage)
        ).all()
    }

    # --- Waiting on a person
    # The reason and the time come from the internal note the service writes
    # when it hands off. Handoff lists are short, so one lookup per lead is fine.
    handoffs = []
    for lead in db.scalars(
        select(Lead).where(
            Lead.company_id == company_id,
            Lead.human_required.is_(True),
            Lead.opted_out.is_(False),
        )
    ):
        note = db.scalar(
            select(Message)
            .where(Message.lead_id == lead.id, Message.direction == Direction.INTERNAL)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        handoffs.append(HandoffItem(
            lead=LeadView.model_validate(lead),
            reason=_handoff_reason(note.body if note else None),
            waiting_since=_utc(note.created_at if note else lead.updated_at),
        ))

    # --- Next follow-ups
    followups = [
        FollowUpItem(
            id=fu.id,
            lead_id=fu.lead_id,
            lead_name=lead.first_name or lead.phone,
            due_at=_utc(fu.due_at),
            reason=fu.reason,
            status=fu.status,
        )
        for fu, lead in db.execute(
            select(FollowUp, Lead)
            .join(Lead, Lead.id == FollowUp.lead_id)
            .where(Lead.company_id == company_id, FollowUp.status == "pending")
            .order_by(FollowUp.due_at)
            .limit(FOLLOWUP_LIMIT)
        ).all()
    ]

    # --- Recent conversations
    # Latest real (non-internal) message per lead, newest leads first.
    latest = (
        select(Message.lead_id, func.max(Message.created_at).label("last_at"))
        .join(Lead, Lead.id == Message.lead_id)
        .where(Lead.company_id == company_id, Message.direction != Direction.INTERNAL)
        .group_by(Message.lead_id)
        .order_by(func.max(Message.created_at).desc())
        .limit(RECENT_LIMIT)
        .subquery()
    )
    recent: list[RecentItem] = []
    seen = set()
    for lead, msg in db.execute(
        select(Lead, Message)
        .join(latest, latest.c.lead_id == Lead.id)
        .join(Message, (Message.lead_id == latest.c.lead_id) & (Message.created_at == latest.c.last_at))
        .where(Message.direction != Direction.INTERNAL)
        .order_by(latest.c.last_at.desc())
    ).all():
        if lead.id in seen:  # two messages with the exact same timestamp
            continue
        seen.add(lead.id)
        recent.append(RecentItem(
            lead=LeadView.model_validate(lead),
            last_message=LastMessage(
                body=msg.body,
                author=msg.author.value,
                direction=msg.direction,
                created_at=_utc(msg.created_at),
            ),
        ))

    return DashboardData(
        summary=summary,
        stage_counts=stage_counts,
        handoffs=handoffs,
        followups=followups,
        recent=recent,
    )
