"""
Scheduler routes — add, list, and cancel scheduled execution jobs.

Uses Firebase auth to identify the user, stores UID in the job
so credentials can be resolved from Firestore at execution time.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Header

from ..models import (
    ScheduleRequest,
    ScheduledJobResponse,
    JobsListResponse,
    GenericResponse,
)
from ..scheduler import add_scheduled_job, list_jobs, cancel_job


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
