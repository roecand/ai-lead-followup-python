from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete
from sqlalchemy.orm import Session

from backend.database import RecoveryCode, User
from backend.deps import get_current_user, get_db, redis_client
from backend.schemas.auth import CodeIn
from backend.services.auth.two_factor import check_code, encrypt, make_recovery_codes, new_secret, otpauth_uri, \
    second_factor_method, decrypt
from backend.services.auth.verification import check_recovery_code

router = APIRouter(prefix="/auth/2fa", tags=["two-factor"])

async def _check_totp(user: User, secret: str, code: str) -> None:
    if await redis_client.hit(f"totp_confirm_{user.id}", redis_client.TOTP_LIMIT, redis_client.TOTP_LOCKOUT):
        raise HTTPException(429, "Too many tries. Wait a few minutes and start again.")
    if not await check_code(user.id, secret, code):
        raise HTTPException(400, "Code didn't match.")

@router.post("/totp/start")
async def totp_start(user: User = Depends(get_current_user)):
    if user.totp_enabled:
        raise HTTPException(409, "Authenticator is already on.")

    secret = new_secret()
    await redis_client.save_totp_pending(user.id, secret)
    return {"secret": secret, "otpauth_uri": otpauth_uri(secret, user.email)}


@router.post("/totp/confirm")
async def totp_confirm(body: CodeIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    secret = await redis_client.get_totp_pending(user.id)
    if not secret:
        raise HTTPException(410, "Setup expired. Start again.")
    await _check_totp(user, secret, body.code)

    codes, hashes = make_recovery_codes()
    db.execute(delete(RecoveryCode).where(RecoveryCode.user_id == user.id)) # Clear any old codes in case user had any previously
    db.add_all(RecoveryCode(user_id=user.id, code_hash=h) for h in hashes)

    user.totp_secret_enc = encrypt(secret)
    user.totp_enabled = True
    db.commit()

    await redis_client.delete_totp_pending(user.id)
    return {"recovery_codes": codes}


@router.get("")
async def two_factor_status(user: User = Depends(get_current_user)):
    return {"method": second_factor_method(user)}


@router.post("/totp/disable")
async def two_factor_disable(body: CodeIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    if not user.totp_enabled:
        raise HTTPException(409, "Authenticator is already off.")

    code = body.code.strip().replace(" ", "").replace("-", "")

    if len(code) == 6:
        await _check_totp(user, decrypt(user.totp_secret_enc), code)
    elif len(code) == 20:
        await check_recovery_code(user, code, db)
    else:
        raise HTTPException(400, "Invalid code.")

    db.execute(delete(RecoveryCode).where(RecoveryCode.user_id == user.id)) # Clear all codes for user
    user.totp_secret_enc = None
    user.totp_enabled = False
    db.commit()
