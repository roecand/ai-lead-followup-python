import uuid

from fastapi import Cookie, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from .config import get_settings
from .database import SessionLocal, User
from .services.knowledge import load_knowledge
from .services.llm import build_gateway
from .services.ratelimit import RedisClient
from .security import decode_access_token
from .services.service import ConversationService
from .services.sms import build_sms_gateway


sms_gateway = build_sms_gateway()
service = ConversationService(build_gateway(), sms_gateway, load_knowledge())
redis_client = RedisClient()


def get_db():
    with SessionLocal() as db:
        yield db


def get_current_user(db: Session = Depends(get_db), token: str | None = Cookie(default=None)) -> User:
    payload = decode_access_token(token)
    user = db.get(User, uuid.UUID(payload["user_id"]))
    if not user:
        raise HTTPException(401, "User not found")
    return user


def require_admin_key(x_admin_key: str = Header(...)) -> None:
    if x_admin_key != get_settings().admin_secret:
        raise HTTPException(403, "Not authorized")


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"