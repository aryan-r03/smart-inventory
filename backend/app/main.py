from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.db.session import engine
from app.db.base import Base
from app.api.routes import (
    auth, inventory, analytics, procurement,
    alerts, predictions, users, qr, chatbot,
)
from app.services.scheduler import setup_scheduler

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    sched = setup_scheduler()
    yield
    sched.shutdown(wait=False)
    await engine.dispose()


app = FastAPI(
    title="LabTrack – Smart Inventory API",
    description="AI-powered inventory management for college labs and libraries",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.include_router(auth.router,        prefix="/api/auth",        tags=["Authentication"])
app.include_router(users.router,       prefix="/api/users",       tags=["Users"])
app.include_router(inventory.router,   prefix="/api/inventory",   tags=["Inventory"])
app.include_router(analytics.router,   prefix="/api/analytics",   tags=["Analytics"])
app.include_router(procurement.router, prefix="/api/procurement",  tags=["Procurement"])
app.include_router(alerts.router,      prefix="/api/alerts",      tags=["Alerts"])
app.include_router(predictions.router, prefix="/api/predictions",  tags=["Predictions"])
app.include_router(qr.router,          prefix="/api/qr",          tags=["QR Codes"])
app.include_router(chatbot.router,     prefix="/api/ai",          tags=["AI Chatbot"])


@app.get("/api/health", tags=["System"])
async def health_check():
    return {"status": "healthy", "version": "1.0.0", "scheduler": "running"}
