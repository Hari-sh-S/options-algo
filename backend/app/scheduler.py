"""
APScheduler integration for the "Execute Later" feature.

Jobs are stored in-memory (sufficient for single-instance deployment).
Each scheduled job re-evaluates live market conditions at trigger time.

Credentials are resolved from Firestore using the user's UID at execution
time, ensuring the latest access token is always used.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta
from typing import Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.memory import MemoryJobStore

from .config import IST, StrategyType, IndexName
from .strategy_engine import execute_strategy

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Singleton scheduler instance
# ---------------------------------------------------------------------------
_scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler(
            jobstores={"default": MemoryJobStore()},
            timezone=IST,
        )
    return _scheduler


def start_scheduler() -> None:
    sched = get_scheduler()
    if not sched.running:
        sched.start()
        logger.info("APScheduler started")


def shutdown_scheduler() -> None:
    sched = get_scheduler()
    if sched.running:
        sched.shutdown(wait=False)
        logger.info("APScheduler shut down")


# ---------------------------------------------------------------------------
# Job management
# ---------------------------------------------------------------------------

def add_scheduled_job(
    execute_at: str,
    uid: str,
    strategy: StrategyType,
    index: IndexName,
    expiry: str,
    lots: int,
    sl_percent: float,
    mode: str = "live",
    target_premium: float | None = None,
    spot_percent: float | None = None,
) -> dict[str, Any]:
    """
    Schedule a strategy execution at a specific time today.

    ``execute_at`` is expected as an ISO time string, e.g. "10:53:00".
    ``uid`` is the Firebase user ID, used to resolve credentials at execution time.
    """
    sched = get_scheduler()
    job_id = f"job_{uuid.uuid4().hex[:8]}"

    # Parse time and build datetime for today in IST
    run_time_parts = execute_at.split(":")
    hour = int(run_time_parts[0])
    minute = int(run_time_parts[1])
    second = int(run_time_parts[2]) if len(run_time_parts) > 2 else 0
    now = datetime.now(IST)
    run_dt = now.replace(hour=hour, minute=minute, second=second, microsecond=0)

    # If the time has already passed today, schedule for tomorrow
    if run_dt <= now:
        run_dt += timedelta(days=1)

    sched.add_job(
        func=_execute_scheduled,
        trigger="date",
        run_date=run_dt,
        id=job_id,
        kwargs={
            "uid": uid,
            "strategy": strategy,
            "index": index,
            "expiry": expiry,
            "lots": lots,
            "sl_percent": sl_percent,
            "mode": mode,
            "target_premium": target_premium,
            "spot_percent": spot_percent,
        },
        replace_existing=True,
    )

    logger.info("Scheduled job %s at %s for user %s", job_id, run_dt.isoformat(), uid)

    return {
        "job_id": job_id,
        "execute_at": run_dt.isoformat(),
        "strategy": strategy.value,
        "index": index.value,
        "expiry": expiry,
        "lots": lots,
    }


def list_jobs() -> list[dict[str, Any]]:
    """Return all pending scheduled jobs."""
    sched = get_scheduler()
    jobs = sched.get_jobs()
    result = []
    for job in jobs:
        kwargs = job.kwargs or {}
        strategy = kwargs.get("strategy", "")
        index = kwargs.get("index", "")
        # Handle enum values
        if hasattr(strategy, "value"):
            strategy = strategy.value
        if hasattr(index, "value"):
            index = index.value
        result.append({
            "job_id": job.id,
            "execute_at": str(job.next_run_time) if job.next_run_time else "",
            "strategy": strategy,
            "index": index,
            "expiry": kwargs.get("expiry", ""),
            "lots": kwargs.get("lots", 0),
        })
    return result


def cancel_job(job_id: str) -> bool:
    """Remove a scheduled job. Returns True if the job existed."""
    sched = get_scheduler()
    try:
        sched.remove_job(job_id)
        logger.info("Cancelled job %s", job_id)
        return True
    except Exception:
        logger.warning("Job %s not found for cancellation", job_id)
        return False


# ---------------------------------------------------------------------------
# Internal: the function that APScheduler invokes at the scheduled time
# ---------------------------------------------------------------------------

def _execute_scheduled(
    uid: str,
    strategy: StrategyType,
    index: IndexName,
    expiry: str,
    lots: int,
    sl_percent: float,
    mode: str = "live",
    target_premium: float | None = None,
    spot_percent: float | None = None,
) -> None:
    """
    Called by APScheduler at the scheduled time.
    Resolves credentials from Firestore using user UID, then executes.
    """
    logger.info(
        "⏰ Scheduled job triggered: %s %s lots=%d uid=%s",
        strategy, index, lots, uid,
    )

    # Resolve credentials from Firestore
    from .firebase_auth import get_user_credentials

    creds = get_user_credentials(uid)
    if not creds or not creds.get("client_id") or not creds.get("access_token"):
        logger.error("❌ No credentials found for user %s — cannot execute scheduled job", uid)
        return

    result = execute_strategy(
        client_id=creds["client_id"],
        access_token=creds["access_token"],
        strategy=strategy,
        index=index,
        expiry=expiry,
        lots=lots,
        sl_percent=sl_percent,
        target_premium=target_premium,
        spot_percent=spot_percent,
        mode=mode,
        uid=uid,
    )
    logger.info("Scheduled job result: success=%s, %s", result.get("success"), result)
