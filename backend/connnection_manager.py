import uuid
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.active: dict[uuid.UUID, set[WebSocket]] = {}

    async def connect(self, company_id: uuid.UUID, ws: WebSocket) -> None:
        await ws.accept()
        self.active.setdefault(company_id, set()).add(ws)

    def disconnect(self, company_id: uuid.UUID, ws: WebSocket) -> None:
        self.active.get(company_id, set()).discard(ws)

    async def broadcast(self, company_id: uuid.UUID, payload: dict) -> None:
        for ws in self.active.get(company_id, set()):
            try:
                await ws.send_json(payload)
            except Exception:
                # the connection is dead but we haven't heard about it yet, clean it up now
                self.disconnect(company_id, ws)


manager: ConnectionManager = ConnectionManager()