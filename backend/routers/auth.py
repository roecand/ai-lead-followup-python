import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy import select, delete
from sqlalchemy.orm import Session
from starlette.responses import JSONResponse

from backend.database import RefreshToken, User
from backend.deps import client_ip, get_db, redis_client
from backend.integrations.redis_client import RedisClient
from backend.schemas import LoginRequest
from backend.core.security import create_refresh_token, pwd_context
from backend.schemas.auth import CodeIn
from backend.services.auth.sessions import set_auth_cookies, unauthorized, clear_auth_cookies, start_session
from backend.services.auth.two_factor import second_factor_method, decrypt, check_code

router = APIRouter(prefix="/auth", tags=["auth"])

MAX_FAILS_PER_EMAIL = 5
MAX_FAILS_PER_IP = 20
LOGIN_LOCKOUT_SECONDS = 15 * 60


@router.post("/login")
async def auth_login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> JSONResponse:
    lower_case_email = payload.email.strip().lower()
    email_key = RedisClient.email_key(lower_case_email)
    ip_key = RedisClient.ip_key(client_ip(request))

    email_limit_hit = await redis_client.hit(email_key, MAX_FAILS_PER_EMAIL, LOGIN_LOCKOUT_SECONDS)
    ip_limit_hit = await redis_client.hit(ip_key, MAX_FAILS_PER_IP, LOGIN_LOCKOUT_SECONDS)

    if email_limit_hit or ip_limit_hit:
        raise HTTPException(429, "Too many login attempts. Try again later.")

    user = db.scalar(select(User).where(User.email == lower_case_email))

    if not user or not pwd_context.verify(payload.password, user.hashed_password):
        raise HTTPException(401, "Invalid email or password")

    method = second_factor_method(user)
    challenge = secrets.token_urlsafe(32)
    await redis_client.save_login_challenge(challenge, str(user.id))

    # if method == "email":
    #     await issue_code(...)  # sends the emailed code, you build this with the gateway
    json_response = JSONResponse({"method": method})
    json_response.set_cookie(
        key="login_challenge",
        value=challenge,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=redis_client.LOGIN_CHALLENGE_TTL_SECONDS,
        path="/auth/login/2fa"
    )

    return json_response


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


@router.post("/login/2fa", status_code=204)
async def auth_2fa(body: CodeIn, request: Request, response: Response, login_challenge: str | None = Cookie(default=None), db: Session = Depends(get_db)):
    if not login_challenge:
        raise HTTPException(410, "Login expired. Sign in again.")

    user_id = await redis_client.get_login_challenge(login_challenge)

    if not user_id:
        raise HTTPException(410, "Login expired. Sign in again.")

    fail_key = f"login_2fa_fail_{user_id}"
    if await redis_client.hit(fail_key, redis_client.TOTP_LIMIT, redis_client.TOTP_LOCKOUT): # Use same values as totp
        raise HTTPException(429, "Too many login attempts")

    user_id = uuid.UUID(user_id)
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(410, "Login expired. Sign in again.")

    if user.totp_enabled:
        secret = decrypt(user.totp_secret_enc)

        if not await check_code(user_id, secret, body.code):
            raise HTTPException(400, "Invalid code")
    else:
        # Later email code varification
        raise HTTPException(501, "Email codes are not available yet")

    email_key = RedisClient.email_key(user.email.lower())
    ip_key = RedisClient.ip_key(client_ip(request))

    await redis_client.delete_login_challenge(login_challenge)
    await redis_client.delete(fail_key)
    await redis_client.delete(RedisClient.email_key(user.email.lower()))
    await redis_client.delete(RedisClient.ip_key(client_ip(request)))

    response.delete_cookie("login_challenge", path="/auth/login/2fa")
    start_session(db, response, user)
