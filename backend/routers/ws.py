import uuid

from fastapi import APIRouter, Cookie, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from backend.services.connection_manager import manager
from ..database import User
from ..dependencies import get_db
from ..security import try_decode_access_token

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, db: Session = Depends(get_db), token: str = Cookie(default=None)) -> None:
    payload = try_decode_access_token(token)
    user = db.get(User, uuid.UUID(payload["user_id"])) if payload else None
    if not user:
        await websocket.close(code=4401)
        return

    await manager.connect(user.company_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user.company_id, websocket)