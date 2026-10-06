"""Company-wide KPIs for the dashboard overview."""

import uuid
from datetime import date, datetime, timedelta, timezone
from statistics import median
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import Author, Company, Direction, Lead, LeadStage, Message

SPARK_DAYS_ALL_TIME = 30  # daily chart length when the range is "all time"


def _aware(dt: datetime) -> datetime:
    # SQLite hands back naive datetimes; everything is stored in UTC.
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def company_stats(db: Session, company_id: uuid.UUID, days: int, now: datetime | None = None) -> dict:
    """KPIs for the last `days` days (0 = all time).

    "Booked" counts leads created in the range that are now booked; there is no booked-at
    timestamp yet. "First reply" is the median wait between a lead's first inbound text in the
    range and the next outbound message (AI or staff).
    """
    now = now or datetime.now(timezone.utc)
    since = now - timedelta(days=days) if days else None
    prev_since = now - timedelta(days=2 * days) if days else None

    company = db.get(Company, company_id)
    tz = ZoneInfo(company.timezone if company else "UTC")

    in_company = Lead.company_id == company_id

    # Leads
    lead_q = select(Lead.created_at, Lead.stage).where(in_company)
    if prev_since is not None:
        lead_q = lead_q.where(Lead.created_at >= prev_since)
    lead_rows = [(_aware(c), s) for c, s in db.execute(lead_q)]
    current = [(c, s) for c, s in lead_rows if since is None or c >= since]
    new_leads = len(current)
    new_leads_prev = len(lead_rows) - new_leads if days else None
    booked = sum(1 for _, s in current if s == LeadStage.BOOKED)

    # Daily new leads, bucketed by the company's local calendar day
    spark_len = days or SPARK_DAYS_ALL_TIME
    today: date = now.astimezone(tz).date()
    by_day = [0] * spark_len
    for c, _ in current:
        offset = (today - c.astimezone(tz).date()).days
        if 0 <= offset < spark_len:
            by_day[spark_len - 1 - offset] += 1

    # Replies by author
    reply_q = (
        select(Message.author, func.count())
        .join(Lead, Message.lead_id == Lead.id)
        .where(in_company, Message.direction == Direction.OUTBOUND)
        .group_by(Message.author)
    )
    if since is not None:
        reply_q = reply_q.where(Message.created_at >= since)
    replies = {author: n for author, n in db.execute(reply_q)}

    # First reply: each lead's first inbound in range -> the next outbound after it
    first_in_q = (
        select(Message.lead_id, func.min(Message.created_at).label("t"))
        .join(Lead, Message.lead_id == Lead.id)
        .where(in_company, Message.direction == Direction.INBOUND)
        .group_by(Message.lead_id)
    )
    if since is not None:
        first_in_q = first_in_q.where(Message.created_at >= since)
    first_in = first_in_q.subquery()
    next_out = (
        select(func.min(Message.created_at))
        .where(
            Message.lead_id == first_in.c.lead_id,
            Message.direction == Direction.OUTBOUND,
            Message.created_at > first_in.c.t,
        )
        .correlate(first_in)
        .scalar_subquery()
    )
    waits = [
        (_aware(out) - _aware(t_in)).total_seconds()
        for t_in, out in db.execute(select(first_in.c.t, next_out))
        if out is not None
    ]

    return {
        "range_days": days,
        "new_leads": new_leads,
        "new_leads_prev": new_leads_prev,
        "new_leads_by_day": by_day,
        "booked": booked,
        "ai_replies": replies.get(Author.ASSISTANT, 0),
        "staff_replies": replies.get(Author.STAFF, 0),
        "first_reply_seconds": median(waits) if waits else None,
        "first_reply_samples": len(waits),
    }
