import re
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .database import Direction, FollowUp, Lead, LeadStage, Message, Company
from .knowledge import BusinessKnowledge
from .llm import LLMGateway
from .schemas import ProcessResult, ReplyDecision
from .sms import SMSGateway

import uuid

STOP_WORDS = {"stop", "stopall", "unsubscribe", "cancel", "end", "quit"}
START_WORDS = {"start", "unstop", "yes"}
HIGH_RISK = re.compile(r"\b(fire|smoke|gas leak|carbon monoxide|sparks|medical emergency)\b", re.I)


class ConversationService:
    def __init__(self, llm: LLMGateway, sms: SMSGateway, knowledge: BusinessKnowledge):
        self.llm = llm
        self.sms = sms
        self.knowledge = knowledge
        self.settings = get_settings()

    async def start(self, db: Session, lead: Lead) -> ProcessResult:
        if lead.opted_out or not lead.consent_to_sms:
            return ProcessResult(
                lead_id=lead.id, action="ignored", reason="Documented SMS consent is required"
            )
        prior_outbound = db.scalar(select(Message).where(
            Message.lead_id == lead.id, Message.direction == Direction.OUTBOUND
        ))
        if prior_outbound:
            return ProcessResult(
                lead_id=lead.id, action="duplicate", reason="Conversation was already started"
            )
        greeting = f"Hi{f' {lead.first_name}' if lead.first_name else ''}, this is {self.knowledge.name}. How can we help? Reply STOP to opt out."
        company_twilio_phone = lead.company.twilio_number
        receipt = await self.sms.send(lead.phone, company_twilio_phone, greeting)
        db.add(Message(
            lead_id=lead.id, direction=Direction.OUTBOUND, body=greeting,
            provider_id=receipt.provider_id, intent="initial_outreach", confidence="high",
        ))
        lead.stage = LeadStage.CONTACTED
        db.add(FollowUp(
            lead_id=lead.id,
            due_at=datetime.now(timezone.utc) + timedelta(hours=24),
            reason="No-response check-in after initial outreach",
        ))
        db.commit()
        return ProcessResult(lead_id=lead.id, action="replied", reply=greeting)

    async def receive(
        self, db: Session, company: Company, phone: str, body: str, provider_id: str | None = None
    ) -> ProcessResult:
        normalized = body.strip()
        lead = db.scalar(select(Lead).where(Lead.phone == phone, Lead.company_id == company.id))
        if lead is None:
            lead = Lead(phone=phone, source="inbound_demo", consent_to_sms=True, company_id=company.id, company=company)
            db.add(lead)
            db.flush()

        if provider_id and db.scalar(select(Message).where(Message.provider_id == provider_id)):
            return ProcessResult(lead_id=lead.id, action="duplicate", reason="Provider event already processed")

        incoming = Message(
            lead_id=lead.id, direction=Direction.INBOUND, body=normalized, provider_id=provider_id
        )
        db.add(incoming)

        command = normalized.lower().strip(" .!?,")
        if command in STOP_WORDS:
            lead.opted_out = True
            lead.consent_to_sms = False
            lead.stage = LeadStage.DO_NOT_CONTACT
            self._cancel_followups(db, lead.id)
            db.commit()
            return ProcessResult(lead_id=lead.id, action="opted_out")
        if command in START_WORDS:
            lead.opted_out = False
            lead.consent_to_sms = True

        if lead.opted_out or not lead.consent_to_sms:
            db.commit()
            return ProcessResult(lead_id=lead.id, action="ignored", reason="Lead may not be messaged")

        if HIGH_RISK.search(normalized):
            decision = ReplyDecision(
                reply="Please move to a safe location and call 911 or the appropriate utility emergency line now. I’m flagging this for our team, but don’t wait for a text reply.",
                intent="emergency", confidence="high", lead_stage=LeadStage.ENGAGED,
                needs_human=True, human_reason="Potential immediate safety emergency.",
            )
        else:
            history = list(db.scalars(
                select(Message).where(Message.lead_id == lead.id)
                .order_by(Message.created_at.desc()).limit(self.settings.history_limit)
            ))[::-1]
            try:
                decision = await self.llm.decide(lead, history, self.knowledge)
            except Exception as exc:
                lead.human_required = True
                db.add(Message(
                    lead_id=lead.id, direction=Direction.INTERNAL,
                    body=f"LLM failure; no automated reply sent: {type(exc).__name__}",
                ))
                db.commit()
                return ProcessResult(
                    lead_id=lead.id, action="human_handoff",
                    reason="No safe structured model response",
                )

        self._apply_decision(db, lead, decision)
        company_twilio_phone = lead.company.twilio_number
        receipt = await self.sms.send(lead.phone, company_twilio_phone, decision.reply)
        db.add(Message(
            lead_id=lead.id, direction=Direction.OUTBOUND, body=decision.reply,
            provider_id=receipt.provider_id, intent=decision.intent, confidence=decision.confidence,
        ))
        if decision.follow_up_hours and not decision.needs_human:
            db.add(FollowUp(
                lead_id=lead.id,
                due_at=datetime.now(timezone.utc) + timedelta(hours=decision.follow_up_hours),
                reason=f"Model-suggested follow-up after {decision.intent}",
            ))
        db.commit()
        return ProcessResult(
            lead_id=lead.id,
            action="human_handoff" if decision.needs_human else "replied",
            reply=decision.reply,
            reason=decision.human_reason,
        )

    def _apply_decision(self, db: Session, lead: Lead, decision: ReplyDecision) -> None:
        lead.stage = decision.lead_stage
        lead.last_intent = decision.intent
        lead.human_required = decision.needs_human
        if decision.intent == "not_interested":
            lead.stage = LeadStage.NURTURE
            self._cancel_followups(db, lead.id)
        if decision.needs_human:
            db.add(Message(
                lead_id=lead.id, direction=Direction.INTERNAL,
                body=f"Human handoff: {decision.human_reason or 'model requested review'}",
            ))

    @staticmethod
    def _cancel_followups(db: Session, lead_id: uuid.UUID) -> None:
        for item in db.scalars(select(FollowUp).where(
            FollowUp.lead_id == lead_id, FollowUp.status == "pending"
        )):
            item.status = "cancelled"
