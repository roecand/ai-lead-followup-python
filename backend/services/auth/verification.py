from fastapi import HTTPException
from sqlalchemy import update, UUID
from sqlalchemy.orm import Session

import secrets
import hmac
import hashlib

from datetime import datetime, timezone

from backend.database import User, RecoveryCode
from backend.deps import redis_client

from backend.core.config import get_settings
from backend.integrations.mailer import send_code_email
from backend.services.auth.two_factor import hash_recovery_code

MAX_CODES_PER_HOUR = 8
CODE_WINDOW_SECONDS = 60 * 60


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

    try:
        await send_code_email(email, code)
    except Exception:
        await redis_client.delete_code(email)
        raise HTTPException(502, "Couldn't send the email. Try again.")

    await redis_client.start_cooldown(email)


async def check_verification_code(email: str, code: str) -> dict:
    """Returns the pending signup if the code is right, otherwise raises."""
    pending = await redis_client.get_pending(email)
    if not pending:
        await redis_client.delete_code(email)
        raise HTTPException(410, "Session expired, please return to signup and try again.")

    # Have user restart process
    if await redis_client.too_many_attempts(email):
        await redis_client.delete_code(email)
        raise HTTPException(429, "Too many attempts. Request a new code.")

    stored_code = await redis_client.get_code(email)
    if not stored_code:
        raise HTTPException(400, "Code expired, please return to signup and try again.")
    if not code_matches(email, code, stored_code):
        raise HTTPException(400, "Invalid code")

    return pending


def _login_code_key(user_id) -> str:
    return f"login_code_{user_id}"


def _login_tries_key(user_id) -> str:
    return f"login_code_tries_{user_id}"


async def issue_login_code(user: User) -> None:
    user_id = str(user.id)
    if await redis_client.hit(f"login_code_sent_{user_id}", redis_client.MAX_CODES_PER_HOUR, redis_client.CODE_LOCKOUT_SECONDS):
        raise HTTPException(429, "Too many codes requested. Try again later.")

    code = generate_code()
    await redis_client.save_login_code(user_id, hash_code(user.email, code))

    try:
        await send_code_email(user.email, code)
    except Exception:
        await redis_client.delete_login_code(user_id)
        raise HTTPException(502, "Couldn't send the email. Try again.")


async def check_login_code(user: User, submitted: str) -> bool:
    user_id = str(user.id)
    stored = await redis_client.get_login_code(user_id)
    if not stored:
        return False

    if await redis_client.too_many_login_code_attempts(user_id):
        await redis_client.delete_login_code(user_id)
        raise HTTPException(429, "Too many attempts. Sign in again for a new code.")

    if not code_matches(user.email, submitted, stored):
        return False

    # One use only
    await redis_client.delete_login_code(user_id)
    return True

async def check_recovery_code(user: User, code: str, db: Session) -> None:
    if await redis_client.hit(f"recovery_try_{user.id}", redis_client.TOTP_LIMIT, redis_client.TOTP_LOCKOUT):
        raise HTTPException(429, "Too many tries. Wait a few minutes and try again.")

    used = db.execute(
        update(RecoveryCode)
        .where(
            RecoveryCode.user_id == user.id,
            RecoveryCode.code_hash == hash_recovery_code(code),
            RecoveryCode.used_at.is_(None),
        )
        .values(used_at=datetime.now(timezone.utc))
        .returning(RecoveryCode.id)
    ).scalar_one_or_none()

    if used is None:
        db.rollback()
        raise HTTPException(400, "Invalid recovery code")