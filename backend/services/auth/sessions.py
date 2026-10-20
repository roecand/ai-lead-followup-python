from datetime import datetime, timedelta, timezone

from fastapi.responses import Response, JSONResponse
from sqlalchemy import delete
from sqlalchemy.orm import Session
from typing import TypeVar

from backend.database import RefreshToken, User
from backend.core.security import ACCESS_TOKEN_MINUTES, create_access_token, create_refresh_token


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


def start_session(db: Session, response: Response, user: User, remember: bool = False) -> None:
    now = datetime.now(timezone.utc)
    db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.expires_at < now))

    refresh_value = create_refresh_token()
    refresh_expires = now + (timedelta(days=30) if remember else timedelta(days=1))

    db.add(RefreshToken(user_id=user.id, token=refresh_value, expires_at=refresh_expires))
    db.commit()

    set_auth_cookies(response, user.id, refresh_value, refresh_expires)


def clear_auth_cookies(res: R) -> R:
    for key in ("token", "refresh_token"):
        res.delete_cookie(key=key, httponly=True, secure=True, samesite="lax")
    return res


def unauthorized(detail: str) -> JSONResponse:
    return clear_auth_cookies(JSONResponse(status_code=401, content={"detail": detail}))