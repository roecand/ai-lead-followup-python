from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request
from fastapi.responses import Response, JSONResponse
from sqlalchemy import select, delete
from sqlalchemy.orm import Session

from ..database import RefreshToken, User
from ..dependencies import client_ip, get_db, redis_client
from ..schemas import LoginRequest
from ..security import ACCESS_TOKEN_MINUTES, create_access_token, create_refresh_token, pwd_context

router = APIRouter(prefix="/auth", tags=["auth"])

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


def clear_auth_cookies(res: Response) -> Response:
    for key in ("token", "refresh_token"):
        res.delete_cookie(key=key, httponly=True, secure=True, samesite="lax")
    return res


def unauthorized(detail: str) -> JSONResponse:
    return clear_auth_cookies(JSONResponse(status_code=401, content={"detail": detail}))


@router.post("/login", status_code=204)
async def auth_login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)) -> None:
    email_key = f"login_fail:email:{payload.email.strip().lower()}"
    ip_key = f"login_fail:ip:{client_ip(request)}"

    email_limit_hit = await redis_client.check_login(email_key, redis_client.MAX_FAILS_PER_EMAIL)
    ip_limit_hit = await redis_client.check_login(ip_key, redis_client.MAX_FAILS_PER_IP)

    if email_limit_hit or ip_limit_hit:
        raise HTTPException(429, "Too many login attempts. Try again later.")

    user = db.scalar(select(User).where(User.email == payload.email))

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
async def auth_logout(response: Response, db: Session = Depends(get_db), refresh_token: str | None = Cookie(default=None)):
    if refresh_token:
        db.execute(delete(RefreshToken).where(RefreshToken.token == refresh_token))
        db.commit()

    return clear_auth_cookies(Response(status_code=204))