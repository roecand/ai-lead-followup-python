from fastapi import HTTPException

import secrets
import hmac
import hashlib

from backend.deps import redis_client

from backend.core.config import get_settings


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
    await redis_client.start_cooldown(email)
    print(code)  # the email gateway call replaces this later


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