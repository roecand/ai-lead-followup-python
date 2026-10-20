import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from urllib.parse import quote

from backend.core.config import get_settings
from backend.database import Invite, User
from backend.deps import get_current_user, get_db, redis_client
from backend.integrations.mailer import send_invite_email
from backend.schemas.team import InviteCreate, InviteView

router = APIRouter(prefix="/team", tags=["team"])
log = logging.getLogger(__name__)

# Which roles each role may hand out. Keep in step with ASSIGNABLE in
# frontend/src/features/team/team.ts
ASSIGNABLE: dict[str, set[str]] = {
    "admin": {"staff", "owner", "admin"},
    "owner": {"staff", "owner"},
    "staff": set(),
}

INVITES_PER_HOUR = 20
INVITE_WINDOW_SECONDS = 60 * 60


@router.post("/invites", response_model=InviteView, status_code=201)
async def create_invite(payload: InviteCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> InviteView:
    # Any role not in the table, including staff, gets an empty set.
    if payload.role not in ASSIGNABLE.get(user.role, set()):
        raise HTTPException(403, "You can't give that role.")

    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(409, "That email already has an account.")

    if await redis_client.hit(f"invite_limit:{user.id}", INVITES_PER_HOUR, INVITE_WINDOW_SECONDS):
        raise HTTPException(429, "Too many invites. Try again later.")

    # Only the newest code for this email should work in this company.
    db.execute(
        delete(Invite).where(
            Invite.company_id == user.company_id,
            Invite.email == payload.email,
            Invite.used_at.is_(None),
        )
    )

    # The company always comes from the signed-in user, never the request.
    invite = Invite(company_id=user.company_id, email=payload.email, role=payload.role)
    db.add(invite)
    db.commit()

    link = f"{get_settings().frontend_url.rstrip('/')}/signup?code={invite.join_code}&email={quote(invite.email)}"

    try:
        await send_invite_email(invite.email, user.company.name, user.name, link, invite.join_code)
    except Exception:
        # The invite still exists. The Team page shows the link so it can be sent by hand.
        log.exception("Invite email to %s failed", invite.email)

    return InviteView(
        email=invite.email,
        role=invite.role,
        expires_at=invite.expires_at,
        join_code=invite.join_code,
    )