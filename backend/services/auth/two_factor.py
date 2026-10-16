import hashlib
import hmac
import secrets
from datetime import datetime, timezone
import uuid

import pyotp
from cryptography.fernet import Fernet

from backend.core.config import get_settings
from backend.deps import redis_client

ISSUER = "Meridiem"
_fernet = Fernet(get_settings().twofa_encryption_key)


def new_secret() -> str:
    return pyotp.random_base32()


def otpauth_uri(secret: str, email: str) -> str:
    pyotp.TOTP(secret).provisioning_uri(email=email, issuer_name=ISSUER)


def encrypt(text: str) -> str:
    return _fernet.encrypt(text.encode()).decode()


async def check_code(user_id:  uuid.UUID, secret: str, code: str) -> bool:
    code = code.strip().replace(" ", "")
    if not(code.isdigit() and len(code) == 6):
        return False

    totp = pyotp.TOTP(secret)
    now = datetime.now(timezone.utc)
    step = int(now.timestamp()) // 30

    for offset in (-1, 0, 1):
        if hmac.compare_digest(totp.at(now, offset), code):
            return await redis_client.claim_totp_step(user_id, step + offset)
    return False


def hash_recovery_code(code: str) -> str:
    return hashlib.sha256(code.replace("-", "").lower().encode()).hexdigest()


def make_recovery_codes(count: int = 10) -> tuple[list[str], list[str]]:
    codes = [f"{secrets.token_hex(3)}-{secrets.token_hex(3)}" for _ in range(count)]
    return codes, [hash_recovery_code(c) for c in codes]
