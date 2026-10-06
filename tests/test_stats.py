import os
from datetime import datetime, timedelta, timezone

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test")
os.environ.setdefault("ADMIN_SECRET", "test")

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Author, Base, Company, Direction, Lead, LeadStage, Message
from backend.services.stats import company_stats

NOW = datetime(2026, 10, 6, 18, 0, tzinfo=timezone.utc)  # 11:00 in Las Vegas


@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine, expire_on_commit=False)() as session:
        yield session


def ago(**kw):
    return NOW - timedelta(**kw)


def msg(lead, direction, author, when):
    return Message(lead_id=lead.id, direction=direction, author=author, body="x", created_at=when)


def seed(db):
    co = Company(name="Summit", twilio_number="+17025550199", timezone="America/Los_Angeles")
    other = Company(name="Other", twilio_number="+17025550100")
    db.add_all([co, other])
    db.flush()

    a = Lead(phone="+1", company_id=co.id, stage=LeadStage.BOOKED, created_at=ago(days=1))
    b = Lead(phone="+2", company_id=co.id, stage=LeadStage.ENGAGED, created_at=ago(days=3))
    old = Lead(phone="+3", company_id=co.id, stage=LeadStage.BOOKED, created_at=ago(days=10))
    foreign = Lead(phone="+4", company_id=other.id, stage=LeadStage.BOOKED, created_at=ago(hours=2))
    db.add_all([a, b, old, foreign])
    db.flush()

    db.add_all([
        # a: AI replies after 30s, staff follows up later
        msg(a, Direction.INBOUND, Author.CUSTOMER, ago(hours=5)),
        msg(a, Direction.OUTBOUND, Author.ASSISTANT, ago(hours=5) + timedelta(seconds=30)),
        msg(a, Direction.OUTBOUND, Author.STAFF, ago(hours=4)),
        # b: reply after 90s
        msg(b, Direction.INBOUND, Author.CUSTOMER, ago(days=2)),
        msg(b, Direction.OUTBOUND, Author.ASSISTANT, ago(days=2) + timedelta(seconds=90)),
        # old: activity outside a 7-day window
        msg(old, Direction.INBOUND, Author.CUSTOMER, ago(days=9)),
        msg(old, Direction.OUTBOUND, Author.ASSISTANT, ago(days=9) + timedelta(seconds=600)),
        # another company's traffic must never be counted
        msg(foreign, Direction.INBOUND, Author.CUSTOMER, ago(hours=1)),
        msg(foreign, Direction.OUTBOUND, Author.ASSISTANT, ago(hours=1) + timedelta(seconds=5)),
    ])
    db.commit()
    return co


def test_seven_day_window(db):
    co = seed(db)
    s = company_stats(db, co.id, 7, now=NOW)
    assert s["new_leads"] == 2
    assert s["new_leads_prev"] == 1
    assert s["booked"] == 1
    assert s["ai_replies"] == 2
    assert s["staff_replies"] == 1
    assert s["first_reply_seconds"] == 60  # median of 30s and 90s
    assert s["first_reply_samples"] == 2
    assert len(s["new_leads_by_day"]) == 7
    assert sum(s["new_leads_by_day"]) == 2


def test_all_time(db):
    co = seed(db)
    s = company_stats(db, co.id, 0, now=NOW)
    assert s["new_leads"] == 3
    assert s["new_leads_prev"] is None
    assert s["booked"] == 2
    assert s["ai_replies"] == 3
    assert s["first_reply_seconds"] == 90  # median of 30, 90, 600
    assert len(s["new_leads_by_day"]) == 30


def test_days_bucket_by_company_timezone(db):
    co = seed(db)
    # 03:00 UTC on Oct 6 is still Oct 5 in Las Vegas, so it lands in "yesterday"
    lead = Lead(phone="+5", company_id=co.id, created_at=datetime(2026, 10, 6, 3, 0, tzinfo=timezone.utc))
    db.add(lead)
    db.commit()
    s = company_stats(db, co.id, 7, now=NOW)
    assert s["new_leads_by_day"][-1] == 0  # today (Oct 6 local) has nothing
    assert s["new_leads_by_day"][-2] == 2  # Oct 5 local: lead a + the late-night lead


def test_empty_company(db):
    co = Company(name="Empty", twilio_number="+17025550111")
    db.add(co)
    db.commit()
    s = company_stats(db, co.id, 30, now=NOW)
    assert s["new_leads"] == 0
    assert s["first_reply_seconds"] is None
    assert s["new_leads_by_day"] == [0] * 30
