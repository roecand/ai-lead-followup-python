from pathlib import Path

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.database import Base, FollowUp, Lead, LeadStage, Message
from app.knowledge import BusinessKnowledge
from app.llm import DemoGateway
from app.service import ConversationService
from app.sms import ConsoleSMS


@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine, expire_on_commit=False)() as session:
        yield session


@pytest.fixture
def service():
    knowledge = BusinessKnowledge.model_validate_json(
        Path("business.example.json").read_text(encoding="utf-8")
    )
    return ConversationService(DemoGateway(), ConsoleSMS(), knowledge)


@pytest.mark.asyncio
async def test_unknown_question_escalates_instead_of_inventing(db, service):
    result = await service.receive(db, "+17025550101", "Do you repair geothermal compressors?")
    lead = db.get(Lead, result.lead_id)
    assert result.action == "human_handoff"
    assert lead.human_required is True


@pytest.mark.asyncio
async def test_stop_opts_out_and_cancels_followups(db, service):
    lead = Lead(phone="+17025550102", consent_to_sms=True)
    db.add(lead)
    db.flush()
    db.add(FollowUp(lead_id=lead.id, due_at=lead.created_at, reason="test"))
    db.commit()

    result = await service.receive(db, lead.phone, "STOP", "SM-stop-1")
    db.refresh(lead)
    followup = db.scalar(select(FollowUp).where(FollowUp.lead_id == lead.id))
    assert result.action == "opted_out"
    assert lead.stage == LeadStage.DO_NOT_CONTACT
    assert lead.opted_out is True
    assert followup.status == "cancelled"


@pytest.mark.asyncio
async def test_provider_event_is_idempotent(db, service):
    first = await service.receive(db, "+17025550103", "How much is a repair call?", "SM-123")
    count_after_first = len(list(db.scalars(select(Message).where(Message.lead_id == first.lead_id))))
    second = await service.receive(db, "+17025550103", "How much is a repair call?", "SM-123")
    messages = list(db.scalars(select(Message).where(Message.lead_id == first.lead_id)))
    assert second.action == "duplicate"
    assert len(messages) == count_after_first


@pytest.mark.asyncio
async def test_high_risk_message_uses_deterministic_safety_reply(db, service):
    result = await service.receive(db, "+17025550104", "I smell a gas leak by the unit")
    assert result.action == "human_handoff"
    assert "911" in result.reply


@pytest.mark.asyncio
async def test_initial_outreach_requires_consent_and_only_sends_once(db, service):
    lead = Lead(phone="+17025550105", first_name="Taylor", consent_to_sms=True)
    db.add(lead)
    db.commit()
    first = await service.start(db, lead)
    second = await service.start(db, lead)
    assert first.action == "replied"
    assert "Taylor" in first.reply
    assert second.action == "duplicate"
    assert len(list(db.scalars(select(FollowUp).where(FollowUp.lead_id == lead.id)))) == 1
