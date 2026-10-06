from fastapi import APIRouter, Depends, Form, HTTPException, Request
from datetime import datetime, timedelta, timezone
from fastapi.responses import Response
from sqlalchemy import func, select, case
from sqlalchemy.orm import Session
from twilio.request_validator import RequestValidator
from zoneinfo import ZoneInfo

from ..config import get_settings
from ..database import Company, Lead, User
from ..dependencies import get_db, service, get_current_user
from ..schemas import LeadCountSummary

router = APIRouter(prefix="/data", tags=["data"])


@router.get("/lead_count/week_and_day", status_code=200)
async def index(db: Session = Depends(service.get_db), user: User = Depends(get_current_user)):
    tz = ZoneInfo(user.company.timezone)
    now_local = datetime.now(tz)

    date_now = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = date_now - timedelta(days=date_now.weekday())

    today_case = case((Lead.created_at >= date_now, 1), else_=0)
    week_case = case((Lead.created_at >= week_start, 1), else_=0)

    new_today, new_week = db.execute(
        select(func.sum(today_case), func.sum(week_case)).where(
            Lead.company_id == user.company_id,
            Lead.created_at >= week_start,
        )
    ).one()

    return LeadCountSummary(new_today=new_today or 0, new_week=new_week or 0)