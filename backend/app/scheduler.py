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


# ---------------------------------------------------------------------------
# Auto Square-Off
# ---------------------------------------------------------------------------
AUTO_SQUAREOFF_JOB_ID = "auto_squareoff_{uid}"


def schedule_auto_squareoff(
    uid: str,
    squareoff_time: str,
) -> dict[str, Any]:
    """
    Schedule automatic square-off of all positions at a specific time.

    ``squareoff_time`` is expected as "HH:MM:SS" (IST), e.g. "15:15:00".
    """
    sched = get_scheduler()
    job_id = AUTO_SQUAREOFF_JOB_ID.format(uid=uid[:8])

    # Parse time
    parts = squareoff_time.split(":")
    hour = int(parts[0])
    minute = int(parts[1])
    second = int(parts[2]) if len(parts) > 2 else 0
    now = datetime.now(IST)
    run_dt = now.replace(hour=hour, minute=minute, second=second, microsecond=0)

    if run_dt <= now:
        run_dt += timedelta(days=1)

    sched.add_job(
        func=_execute_auto_squareoff,
        trigger="date",
        run_date=run_dt,
        id=job_id,
        kwargs={"uid": uid},
        replace_existing=True,
    )

    logger.info("🕐 Auto square-off scheduled at %s for uid=%s", run_dt.isoformat(), uid[:8])

    return {
        "job_id": job_id,
        "squareoff_at": run_dt.isoformat(),
    }


def cancel_auto_squareoff(uid: str) -> bool:
    """Cancel the auto square-off job for a user."""
    sched = get_scheduler()
    job_id = AUTO_SQUAREOFF_JOB_ID.format(uid=uid[:8])
    try:
        sched.remove_job(job_id)
        logger.info("🕐 Auto square-off cancelled for uid=%s", uid[:8])
        return True
    except Exception:
        return False


def get_auto_squareoff_status(uid: str) -> dict[str, Any] | None:
    """Get the auto square-off schedule for a user, if any."""
    sched = get_scheduler()
    job_id = AUTO_SQUAREOFF_JOB_ID.format(uid=uid[:8])
    try:
        job = sched.get_job(job_id)
        if job and job.next_run_time:
            return {
                "job_id": job_id,
                "squareoff_at": str(job.next_run_time),
                "active": True,
            }
    except Exception:
        pass
    return None


def _execute_auto_squareoff(uid: str) -> None:
    """
    Called by APScheduler at the scheduled time.
    Squares off all positions (paper + live) and saves daily P&L.
    """
    logger.info("🕐 Auto square-off triggered for uid=%s", uid[:8])

    from .firebase_auth import get_user_credentials
    from . import paper_service
    from . import dhan_service

    # Get current paper positions P&L before squaring off
    paper_positions = paper_service.get_positions(uid=uid)
    paper_pnl = 0.0

    # Calculate final P&L using live LTPs
    creds = get_user_credentials(uid)
    if creds and creds.get("client_id") and creds.get("access_token"):
        client_id = creds["client_id"]
        access_token = creds["access_token"]

        # Refresh paper LTPs one last time
        if paper_positions:
            from collections import defaultdict
            seg_groups: dict[str, list[int]] = defaultdict(list)
            for pos in paper_positions:
                sec_id = pos.get("securityId")
                seg = pos.get("exchangeSegment", "NSE_FNO")
                if sec_id:
                    try:
                        seg_groups[seg].append(int(sec_id))
                    except (ValueError, TypeError):
                        continue

            all_ltps: dict[int, float] = {}
            for seg, sec_ids in seg_groups.items():
                try:
                    batch = dhan_service.fetch_ltps_batch(client_id, access_token, sec_ids, seg)
                    all_ltps.update(batch)
                except Exception:
                    pass

            for pos in paper_positions:
                sec_id = pos.get("securityId")
                if not sec_id:
                    continue
                try:
                    sid = int(sec_id)
                except (ValueError, TypeError):
                    continue
                live_ltp = all_ltps.get(sid, 0.0)
                if live_ltp > 0:
                    cost = float(pos.get("costPrice", 0) or 0)
                    net_qty = pos.get("netQty", 0)
                    if cost > 0 and net_qty != 0:
                        pnl = round((cost - live_ltp) * abs(net_qty), 2)
                        paper_pnl += pnl

        # Square off live positions
        dhan_service.square_off_all(client_id, access_token)

    # Save daily P&L summary before clearing
    _save_daily_summary(uid, paper_positions, paper_pnl)

    # Square off paper positions
    paper_service.square_off_all(uid=uid)

    logger.info("🕐 Auto square-off complete for uid=%s | Paper P&L: %.2f", uid[:8], paper_pnl)


def _save_daily_summary(uid: str, positions: list[dict], total_pnl: float) -> None:
    """Save today's P&L summary to Firestore history."""
    from .firebase_auth import _db as db

    today = datetime.now(IST).strftime("%Y-%m-%d")

    trades = []
    for pos in positions:
        cost = float(pos.get("costPrice", 0) or 0)
        ltp = float(pos.get("ltp", 0) or 0)
        net_qty = pos.get("netQty", 0)
        pnl = round((cost - ltp) * abs(net_qty), 2) if cost > 0 and net_qty != 0 else 0

        trades.append({
            "symbol": pos.get("tradingSymbol", ""),
            "entry_price": cost,
            "exit_price": ltp,
            "quantity": net_qty,
            "pnl": pnl,
        })

    summary = {
        "date": today,
        "total_pnl": round(total_pnl, 2),
        "num_trades": len(trades),
        "winning_trades": len([t for t in trades if t["pnl"] > 0]),
        "losing_trades": len([t for t in trades if t["pnl"] < 0]),
        "best_trade": max((t["pnl"] for t in trades), default=0),
        "worst_trade": min((t["pnl"] for t in trades), default=0),
        "trades": trades,
        "timestamp": datetime.now(IST).isoformat(),
    }

    try:
        db.collection("paper_history").document(uid).collection("days").document(today).set(summary)
        logger.info("📊 Saved daily P&L summary for uid=%s: ₹%.2f", uid[:8], total_pnl)
    except Exception as exc:
        logger.warning("Failed to save daily summary: %s", exc)

