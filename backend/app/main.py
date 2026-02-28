"""
Options Execution Portal — FastAPI application entry point.

Run in development:
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .scheduler import start_scheduler, shutdown_scheduler
from .routers import market, orders
from .routers import scheduler as scheduler_router
from .routers import credentials as credentials_router
from .routers import auth as auth_router

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)

# ---------------------------------------------------------------------------
# Lifespan — start/stop APScheduler with the app
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    shutdown_scheduler()


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Options Execution Portal",
    description="Automated options trading backend for the Dhan brokerage API.",
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS — configurable via CORS_ORIGINS env var (comma-separated)
# ---------------------------------------------------------------------------
_default_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://optioni.web.app",
    "https://optioni.firebaseapp.com",
]
_env_origins = os.environ.get("CORS_ORIGINS", "")
_origins = [o.strip() for o in _env_origins.split(",") if o.strip()] if _env_origins else _default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Mount routers
# ---------------------------------------------------------------------------
app.include_router(market.router)
app.include_router(orders.router)
app.include_router(scheduler_router.router)
app.include_router(credentials_router.router)
app.include_router(auth_router.router)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "service": "Options Execution Portal Backend"}


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy"}
