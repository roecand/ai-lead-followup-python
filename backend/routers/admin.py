import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.database import Company, Lead, User
from backend.deps import get_db, require_admin_key, service, sms_gateway
from backend.services.followups import run_due_followups
from backend.schemas import CreateCompany, DemoInbound, ProcessResult, SignupRequest
from backend.core.security import pwd_context

router = APIRouter(tags=["admin"], dependencies=[Depends(require_admin_key)])

#
# @router.post("/admin/insert_user", status_code=204)
# async def insert_user(payload: SignupRequest, db: Session = Depends(get_db)) -> None:
#     existing_user = db.scalar(select(User).where(User.email == payload.email))
#     if existing_user:
#         raise HTTPException(409, "User with this email already exists")
#
#     company = db.scalar(select(Company).where(Company.join_code == payload.join_code))
#     if not company:
#         raise HTTPException(409, "Code is either expired or the company was never registered. Check your code or contact an admin to get your company registered.")
#
#     user = User(
#         email=payload.email,
#         hashed_password=pwd_context.hash(payload.password),
#         company=company,
#         name=payload.name,
#     )
#     db.add(user)
#     db.commit()
#     db.refresh(user)


@router.post("/admin/run-followups")
async def trigger_followups() -> dict[str, int]:
    return {"sent": await run_due_followups(sms_gateway)}


@router.post("/leads/{lead_id}/start", response_model=ProcessResult)
async def start_conversation(lead_id: uuid.UUID, db: Session = Depends(get_db)) -> ProcessResult:
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    return await service.start(db, lead)


@router.post("/demo/inbound", response_model=ProcessResult)
async def demo_inbound(payload: DemoInbound, db: Session = Depends(get_db)) -> ProcessResult:
    company = db.scalar(select(Company).where(Company.twilio_number == payload.company_phone))
    if company is None:
        raise HTTPException(404, "No company is registered for this number")
    return await service.receive(db, company, payload.phone, payload.body, payload.provider_id)