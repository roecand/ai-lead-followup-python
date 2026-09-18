# seed_demo_data.py
"""
One-shot seed script for local testing.
...
"""

import asyncio

from passlib.context import CryptContext
from sqlalchemy import delete

from .database import Company, FollowUp, Lead, Message, RefreshToken, SessionLocal, User, create_schema
from .knowledge import load_knowledge
from .llm import build_gateway
from .service import ConversationService
from .sms import build_sms_gateway

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

PASSWORD = "password123"


def _wipe_all(db) -> None:
    """Deletes every row from every app table, in FK-safe order.

    Local/dev only — there's no confirmation prompt, this is meant to
    run against a throwaway database, not anything with real data.
    """
    db.execute(delete(Message))
    db.execute(delete(FollowUp))
    db.execute(delete(Lead))
    db.execute(delete(RefreshToken))
    db.execute(delete(User))
    db.execute(delete(Company))
    db.commit()


async def main() -> None:
    create_schema()

    with SessionLocal() as db:
        _wipe_all(db)

    service = ConversationService(build_gateway(), build_sms_gateway(), load_knowledge())

    with SessionLocal() as db:
        # ---- Companies -----------------------------------------------------
        acme = Company(name="Acme Plumbing", twilio_number="+15550001111")
        greenstar = Company(name="Green Star Electric", twilio_number="+15550002222")
        db.add_all([acme, greenstar])
        db.commit()
        db.refresh(acme)
        db.refresh(greenstar)

        # ---- Users -----------------------------------------------------------
        # alice + bob share a company on purpose, to test that two accounts
        # on the same company see the same lead list.
        alice = User(
            email="alice@acme.test",
            hashed_password=pwd_context.hash(PASSWORD),
            company=acme,
            role="owner",
        )
        bob = User(
            email="bob@acme.test",
            hashed_password=pwd_context.hash(PASSWORD),
            company=acme,
            role="staff",
        )
        carol = User(
            email="carol@greenstar.test",
            hashed_password=pwd_context.hash(PASSWORD),
            company=greenstar,
            role="owner",
        )
        db.add_all([alice, bob, carol])
        db.commit()

        # ---- Leads -------------------------------------------------------
        jordan = Lead(phone="+17025551234", first_name="Jordan", company=acme, consent_to_sms=True)
        priya = Lead(phone="+17025555678", first_name="Priya", company=greenstar, consent_to_sms=True)

        # Same phone number, two different companies — the edge case the
        # (company_id, phone) composite unique constraint exists for.
        shared_at_acme = Lead(phone="+17025559999", first_name="Sam", company=acme, consent_to_sms=True)
        shared_at_greenstar = Lead(phone="+17025559999", first_name="Sam", company=greenstar, consent_to_sms=True)

        db.add_all([jordan, priya, shared_at_acme, shared_at_greenstar])
        db.commit()
        for lead in (jordan, priya, shared_at_acme, shared_at_greenstar):
            db.refresh(lead)

        # ---- Conversations -------------------------------------------------
        await service.start(db, jordan)
        await service.receive(db, acme, jordan.phone, "How much for a water heater install?")

        await service.start(db, priya)
        await service.receive(db, greenstar, priya.phone, "Do you do panel upgrades?")

        await service.start(db, shared_at_acme)
        await service.receive(db, acme, shared_at_acme.phone, "Hi, need a quote for a leak")

        await service.start(db, shared_at_greenstar)
        await service.receive(db, greenstar, shared_at_greenstar.phone, "Hi, need an electrician too")

    print("Seed complete.\n")
    print(f"  Acme Plumbing        id={acme.id}  join_code={acme.join_code}  number={acme.twilio_number}")
    print(f"  Green Star Electric  id={greenstar.id}  join_code={greenstar.join_code}  number={greenstar.twilio_number}\n")
    print(f"  alice@acme.test / {PASSWORD}       -> Acme Plumbing")
    print(f"  bob@acme.test   / {PASSWORD}       -> Acme Plumbing (same company as alice)")
    print(f"  carol@greenstar.test / {PASSWORD}  -> Green Star Electric\n")
    print(f"  Shared phone +17025559999 seeded under BOTH companies as separate leads —")
    print(f"  check /company/leads for each returns its own copy with its own history.")


if __name__ == "__main__":
    asyncio.run(main())