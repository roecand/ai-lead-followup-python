import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException
from passlib.context import CryptContext

from .config import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ACCESS_TOKEN_MINUTES = 30


def create_access_token(user_id) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES)
    return jwt.encode(
        {"user_id": str(user_id), "exp": expires_at},
        get_settings().jwt_secret,
        algorithm="HS256",
    )


def create_refresh_token() -> str:
    return secrets.token_hex(32)


def decode_access_token(token: str | None) -> dict:
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        return jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Expired token")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


def try_decode_access_token(token: str | None) -> dict | None:
    if not token:
        return None
    try:
        return jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        return None