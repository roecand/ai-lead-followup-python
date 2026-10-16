import uuid
from datetime import datetime, timezone
from sqlalchemy.exc import IntegrityError

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.database import User, Invite
from backend.deps import get_db, redis_client
from backend.schemas import SignupRequest, VerifyRequest
from backend.core.security import pwd_context
from backend.schemas.auth import ResendCode
from backend.services.auth.sessions import start_session
from backend.services.auth.verification import issue_code, code_matches, check_verification_code

router = APIRouter(prefix="/auth", tags=["auth"])


def _create_user_from_invite(db: Session, email: str, pending: dict) -> User:
    invite = db.scalar(
        select(Invite)
        .where(
            Invite.id == uuid.UUID(pending["invite_id"]),
            Invite.used_at.is_(None),
            Invite.expires_at > datetime.now(timezone.utc),
        )
        .with_for_update()
    )
    if not invite:
        raise HTTPException(400, "Invite expired or was already used.")

    user = User(
        email=email,
        company_id=invite.company_id,
        hashed_password=pending["password_hash"],
        name=pending["name"],
        role=invite.role,
    )

    try:
        db.add(user)
        db.flush()
        invite.used_by = user.id
        invite.used_at = datetime.now(timezone.utc)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "An account with that email already exists. Try signing in.")
    return user


@router.post("/signup", status_code=201)
async def auth_signup(signup_request: SignupRequest, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    invite = db.scalar(select(Invite)
                       .where(
                Invite.join_code == signup_request.join_code,
                            Invite.email == signup_request.email.strip().lower(),
                            Invite.used_at.is_(None),
                            Invite.expires_at > now,
                        )
    )

    if not invite:
        raise HTTPException(400, "Invalid code or email, or the invite has expired.")

    email = invite.email

    user_exists = db.scalar(select(User).where(User.email == email))
    if user_exists:
        raise HTTPException(400, "Email already registered.")


    pending = dict(
        name=signup_request.name,
        password_hash=pwd_context.hash(signup_request.password),
        invite_id=str(invite.id),
    )

    await redis_client.save_pending(email, pending)
    await issue_code(email)


@router.post("/verify-email", status_code=204)
async def auth_verify_email(verify_request : VerifyRequest, response: Response, db: Session = Depends(get_db)):
    email = verify_request.email.strip().lower()

    pending = await check_verification_code(email, verify_request.code)
    user = _create_user_from_invite(db, email, pending)

    await redis_client.delete_pending(email)
    start_session(db, response, user)



@router.post("/resend-code", status_code=201)
async def resend_code(payload: ResendCode):
    email = payload.email.strip().lower()

    pending = await redis_client.get_pending(email)
    if not pending:
        await redis_client.delete_code(email)
        raise HTTPException(410, "Session expired, please return to signup and try again.")

    if await redis_client.cooldown_active(email):
        raise HTTPException(429, "Cooldown still active, wait 30 seconds before requesting a new code.")

    await issue_code(email)
