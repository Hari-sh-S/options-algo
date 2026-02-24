"""
Scheduler routes — add, list, and cancel scheduled execution jobs.
Auto square-off scheduling and P&L history retrieval.

Uses Firebase auth to identify the user, stores UID in the job
so credentials can be resolved from Firestore at execution time.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field

from ..models import (
    ScheduleRequest,
    ScheduledJobResponse,
    JobsListResponse,
    GenericResponse,
)
from ..scheduler import (
    add_scheduled_job, list_jobs, cancel_job,
    schedule_auto_squareoff, cancel_auto_squareoff, get_auto_squareoff_status,
)


router = APIRouter(prefix="/api/scheduler", tags=["Scheduler"])


def _get_uid(authorization: str | None) -> str:
    """Extract and verify the Bearer token, return UID."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization[len("Bearer "):]
    from ..firebase_auth import verify_id_token
    try:
        decoded = verify_id_token(token)
        return decoded["uid"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired Firebase token")


@router.post("/add", response_model=ScheduledJobResponse)
async def schedule_job(req: ScheduleRequest, authorization: Optional[str] = Header(None)):
    """Schedule a strategy execution at a specific time."""
    uid = _get_uid(authorization)

    try:
        result = add_scheduled_job(
            execute_at=req.execute_at,
            uid=uid,
            strategy=req.strategy,
            index=req.index,
            expiry=req.expiry,
            lots=req.lots,
            sl_percent=req.sl_percent,
            mode=req.mode,
            target_premium=req.target_premium,
            spot_percent=req.spot_percent,
        )
        return ScheduledJobResponse(**result)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/jobs", response_model=JobsListResponse)
async def get_jobs():
    """List all pending scheduled jobs."""
    jobs = list_jobs()
    return JobsListResponse(
        jobs=[ScheduledJobResponse(**j) for j in jobs]
    )


@router.delete("/cancel/{job_id}", response_model=GenericResponse)
async def cancel_scheduled_job(job_id: str):
    """Cancel a scheduled job by its ID."""
    if cancel_job(job_id):
        return GenericResponse(success=True, message=f"Job {job_id} cancelled")
    raise HTTPException(status_code=404, detail=f"Job {job_id} not found")


# ---------------------------------------------------------------------------
# Auto Square-Off
# ---------------------------------------------------------------------------

class AutoSquareoffRequest(BaseModel):
    squareoff_time: str = Field(..., description="Time to square off, e.g. '15:15:00'")


@router.post("/auto-squareoff")
async def set_auto_squareoff(
    req: AutoSquareoffRequest,
    authorization: Optional[str] = Header(None),
):
    """Schedule automatic square-off at a specific time."""
    uid = _get_uid(authorization)
    result = schedule_auto_squareoff(uid, req.squareoff_time)
    return {"success": True, **result}


@router.get("/auto-squareoff")
async def get_auto_squareoff(authorization: Optional[str] = Header(None)):
    """Get current auto square-off status."""
    uid = _get_uid(authorization)
    status = get_auto_squareoff_status(uid)
    return {"active": bool(status), **(status or {})}


@router.delete("/auto-squareoff")
async def delete_auto_squareoff(authorization: Optional[str] = Header(None)):
    """Cancel the auto square-off."""
    uid = _get_uid(authorization)
    cancelled = cancel_auto_squareoff(uid)
    return GenericResponse(
        success=cancelled,
        message="Auto square-off cancelled" if cancelled else "No auto square-off was scheduled",
    )


# ---------------------------------------------------------------------------
# P&L History
# ---------------------------------------------------------------------------

@router.get("/paper-history")
async def get_paper_history(authorization: Optional[str] = Header(None)):
    """Get paper trading P&L history for the last 30 days."""
    uid = _get_uid(authorization)

    from ..firebase_auth import _db as db

    try:
        docs = (
            db.collection("paper_history")
            .document(uid)
            .collection("days")
            .order_by("date", direction="DESCENDING")
            .limit(30)
            .stream()
        )
        days = [doc.to_dict() for doc in docs]
    except Exception:
        days = []

    # Compute aggregate stats
    total_pnl = sum(d.get("total_pnl", 0) for d in days)
    total_trades = sum(d.get("num_trades", 0) for d in days)
    winning_days = len([d for d in days if d.get("total_pnl", 0) > 0])
    losing_days = len([d for d in days if d.get("total_pnl", 0) < 0])

    return {
        "days": days,
        "stats": {
            "total_pnl": round(total_pnl, 2),
            "total_trades": total_trades,
            "total_days": len(days),
            "winning_days": winning_days,
            "losing_days": losing_days,
            "win_rate": round(winning_days / max(len(days), 1) * 100, 1),
            "best_day": max((d.get("total_pnl", 0) for d in days), default=0),
            "worst_day": min((d.get("total_pnl", 0) for d in days), default=0),
        },
    }
