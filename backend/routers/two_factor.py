from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete
from sqlalchemy.orm import Session
from starlette import status

from backend.database import RecoveryCode, User
from backend.deps import get_current_user, get_db, redis_client
from backend.schemas.auth import CodeIn
from backend.services.auth.two_factor import check_code, encrypt, make_recovery_codes, new_secret, otpauth_uri

router = APIRouter(prefix="/auth/2fa", tags=["two-factor"])

TOTP_LIMIT = 5
TOTP_LOCKOUT = 10 * 60

@router.post("/totp/start")
async def totp_start(user: User = Depends(get_current_user)):
    if user.totp_enabled:
        raise HTTPException(409, "Authenticator is already on.")

    secret = new_secret()
    await redis_client.save_totp_pending(user.id, secret)
    return {"secret": secret, "otpauth_uri": otpauth_uri(secret, user.email)}


@router.post("/totp/confirm")
async def totp_confirm(body: CodeIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if await redis_client.hit(f"totp_confirm_{user.id}", TOTP_LIMIT, TOTP_LOCKOUT):
        raise HTTPException(429, "Too many tries. Wait a few minutes and start again.")

    secret = await redis_client.get(f"totp_confirm_{user.id}")
    if not secret:
        raise HTTPException(410, "Setup expired. Start again.")
    if not await check_code(user.id, secret, body.code):
        raise HTTPException(400, "Code didn't match.")

    codes, hashes = make_recovery_codes()
    db.execute(delete(RecoveryCode).where(RecoveryCode.user_id == user.id)) # Clear any old codes in case user had any previously
    db.add_all(RecoveryCode(user_id=user.id, code_hash=h) for h in hashes)

    user.totp_secret = encrypt(secret)
    user.totp_enabled = True
    db.commit()

    await redis_client.delete(user.id)