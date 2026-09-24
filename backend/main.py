from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import create_schema
from .dependencies import sms_gateway
from .services.followups import run_due_followups
from .routers import admin, auth, leads, webhooks, ws

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(_: FastAPI):
    create_schema()
    scheduler.add_job(run_due_followups, "interval", minutes=1, args=[sms_gateway], max_instances=1)
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(
    title="AI Lead Follow-up Reference Build",
    version="0.1.0",
    description="A safe proof-of-concept, not production-ready messaging software.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "mode": "demonstration"}


app.include_router(auth.router)
app.include_router(leads.router)
app.include_router(admin.router)
app.include_router(webhooks.router)
app.include_router(ws.router)