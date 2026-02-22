"""
APScheduler integration for the "Execute Later" feature.

Jobs are stored in-memory (sufficient for single-instance deployment).
Each scheduled job re-evaluates live market conditions at trigger time.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
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
    client_id: str,
    access_token: str,
    strategy: StrategyType,
    index: IndexName,
    expiry: str,
    lots: int,
    sl_percent: float,
    target_premium: float | None = None,
    spot_percent: float | None = None,
) -> dict[str, Any]:
    """
    Schedule a strategy execution at a specific time today.

    ``execute_at`` is expected as an ISO time string, e.g. "10:53:00".
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
        from datetime import timedelta
        run_dt += timedelta(days=1)

    sched.add_job(
        func=_execute_scheduled,
        trigger="date",
        run_date=run_dt,
        id=job_id,
        kwargs={
            "client_id": client_id,
            "access_token": access_token,
            "strategy": strategy,
            "index": index,
            "expiry": expiry,
            "lots": lots,
            "sl_percent": sl_percent,
            "target_premium": target_premium,
            "spot_percent": spot_percent,
        },
        replace_existing=True,
    )

    logger.info("Scheduled job %s at %s", job_id, run_dt.isoformat())

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
        result.append({
            "job_id": job.id,
            "execute_at": str(job.next_run_time) if job.next_run_time else "",
            "strategy": kwargs.get("strategy", ""),
            "index": kwargs.get("index", ""),
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
    client_id: str,
    access_token: str,
    strategy: StrategyType,
    index: IndexName,
    expiry: str,
    lots: int,
    sl_percent: float,
    target_premium: float | None = None,
    spot_percent: float | None = None,
) -> None:
    """
    Called by APScheduler at the scheduled time.  Re-evaluates live market
    conditions and executes the strategy.
    """
    logger.info(
        "⏰ Scheduled job triggered: %s %s lots=%d",
        strategy, index, lots,
    )
    result = execute_strategy(
        client_id=client_id,
        access_token=access_token,
        strategy=strategy,
        index=index,
        expiry=expiry,
        lots=lots,
        sl_percent=sl_percent,
        target_premium=target_premium,
        spot_percent=spot_percent,
    )
    logger.info("Scheduled job result: %s", result)
