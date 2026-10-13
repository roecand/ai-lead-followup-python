import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy.exc import IntegrityError
from typing import TypeVar

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request
from fastapi.responses import Response, JSONResponse
from sqlalchemy import select, delete
from sqlalchemy.orm import Session

import secrets
import hmac
import hashlib

from backend.database import RefreshToken, User, Invite
from backend.deps import client_ip, get_db, redis_client
from backend.schemas import LoginRequest, SignupRequest, VerifyRequest
from backend.core.security import ACCESS_TOKEN_MINUTES, create_access_token, create_refresh_token, pwd_context
from backend.core.config import get_settings
from backend.schemas.auth import ResendCode

router = APIRouter(prefix="/auth", tags=["auth"])

MAX_FAILS_PER_EMAIL = 5
MAX_FAILS_PER_IP = 20
LOGIN_LOCKOUT_SECONDS = 15 * 60

MAX_CODES_PER_HOUR = 8
CODE_WINDOW_SECONDS = 60 * 60

R = TypeVar("R", bound=Response)

def set_auth_cookies(response: Response, user_id, refresh_value: str, expires_at: datetime) -> None:
    response.set_cookie(
        key="token",
        value=create_access_token(user_id),
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=ACCESS_TOKEN_MINUTES * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_value,
        httponly=True,
        secure=True,
        samesite="lax",
        expires=expires_at,
    )


def clear_auth_cookies(res: R) -> R:
    for key in ("token", "refresh_token"):
        res.delete_cookie(key=key, httponly=True, secure=True, samesite="lax")
    return res


def unauthorized(detail: str) -> JSONResponse:
    return clear_auth_cookies(JSONResponse(status_code=401, content={"detail": detail}))


def generate_code() -> str:
    return f"{secrets.randbelow(10**6):06d}"


def hash_code(email: str, code: str) -> str:
    secret = get_settings().verification_secret.encode()
    message = f"{email}|{code}".encode()
    return hmac.new(secret, message, hashlib.sha256).hexdigest()


def code_matches(email: str, submitted: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_code(email, submitted), stored_hash)


async def issue_code(email: str) -> None:
    if await redis_client.hit(f"code_sent:{email}", MAX_CODES_PER_HOUR, CODE_WINDOW_SECONDS):
        raise HTTPException(429, "Too many codes requested. Try again later.")

    code = generate_code()
    await redis_client.save_code(email, hash_code(email, code))
    await redis_client.start_cooldown(email)
    print(code)  # the email gateway call replaces this later


@router.post("/login", status_code=204)
async def auth_login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)) -> None:
    lower_case_email = payload.email.strip().lower()
    email_key = f"login_fail:email:{lower_case_email}"
    ip_key = f"login_fail:ip:{client_ip(request)}"

    email_limit_hit = await redis_client.hit(email_key, MAX_FAILS_PER_EMAIL, LOGIN_LOCKOUT_SECONDS)
    ip_limit_hit = await redis_client.hit(ip_key, MAX_FAILS_PER_IP, LOGIN_LOCKOUT_SECONDS)

    if email_limit_hit or ip_limit_hit:
        raise HTTPException(429, "Too many login attempts. Try again later.")

    user = db.scalar(select(User).where(User.email == lower_case_email))

    if not user or not pwd_context.verify(payload.password, user.hashed_password):
        raise HTTPException(401, "Invalid email or password")

    await redis_client.delete(email_key)
    await redis_client.delete(ip_key)

    db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.expires_at < datetime.now(timezone.utc)))

    refresh_lifetime = timedelta(days=30) if payload.remember else timedelta(days=1)
    refresh_value = create_refresh_token()
    refresh_expires = datetime.now(timezone.utc) + refresh_lifetime

    db.add(RefreshToken(user_id=user.id, token=refresh_value, expires_at=refresh_expires))
    db.commit()

    set_auth_cookies(response, user.id, refresh_value, refresh_expires)


@router.post("/refresh", status_code=204)
async def auth_refresh(response: Response, db: Session = Depends(get_db), refresh_token: str | None = Cookie(default=None)):
    if not refresh_token:
        return unauthorized("No refresh token provided")

    stored = db.scalar(select(RefreshToken).where(RefreshToken.token == refresh_token))
    now = datetime.now(timezone.utc)

    if not stored:
        return unauthorized("Refresh token invalid")

    user_id = stored.user_id
    expires_at = stored.expires_at

    if expires_at < now:
        db.execute(delete(RefreshToken).where(RefreshToken.user_id == user_id, RefreshToken.expires_at < now))
        db.commit()
        return unauthorized("Refresh token expired")

    new_refresh_value = create_refresh_token()
    db.delete(stored)
    db.add(RefreshToken(user_id=stored.user_id, token=new_refresh_value, expires_at=stored.expires_at))
    db.commit()

    set_auth_cookies(response, user_id, new_refresh_value, expires_at)

    return None

@router.post("/logout", status_code=204)
async def auth_logout(db: Session = Depends(get_db), refresh_token: str | None = Cookie(default=None)):
    if refresh_token:
        db.execute(delete(RefreshToken).where(RefreshToken.token == refresh_token))
        db.commit()

    return clear_auth_cookies(Response(status_code=204))

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
async def auth_verify_email(verify_request : VerifyRequest, db: Session = Depends(get_db)):
    email = verify_request.email.strip().lower()
    code = verify_request.code

    pending = await redis_client.get_pending(email)
    if not pending:
        await redis_client.delete_code(email)
        raise HTTPException(410, "Session expired, please return to signup and try again.")

    too_many_attempts = await redis_client.too_many_attempts(email)

    # Have user restart process
    if too_many_attempts:
        await redis_client.delete_code(email)
        raise HTTPException(429, "Too many attempts. Request a new code.")

    stored_code = await redis_client.get_code(email)

    if not stored_code:
        raise HTTPException(400, "Code expired, please return to signup and try again.")

    if not code_matches(email, code, stored_code):
        raise HTTPException(400, "Invalid code")


    invite_id = uuid.UUID(pending["invite_id"])
    hashed_password = pending["password_hash"]
    name = pending["name"]

    invite = db.scalar(
        select(Invite)
        .where(
            Invite.id == invite_id,
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
        hashed_password=hashed_password,
        name=name,
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

    await redis_client.delete_pending(email)


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

