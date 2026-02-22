"""
Scheduler routes — add, list, and cancel scheduled execution jobs.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..models import (
    ScheduleRequest,
    ScheduledJobResponse,
    JobsListResponse,
    CancelJobRequest,
    GenericResponse,
)
from ..scheduler import add_scheduled_job, list_jobs, cancel_job

router = APIRouter(prefix="/api/scheduler", tags=["Scheduler"])


@router.post("/add", response_model=ScheduledJobResponse)
async def schedule_job(req: ScheduleRequest):
    """Schedule a strategy execution at a specific time."""
    try:
        result = add_scheduled_job(
            execute_at=req.execute_at,
            client_id=req.client_id,
            access_token=req.access_token,
            strategy=req.strategy,
            index=req.index,
            expiry=req.expiry,
            lots=req.lots,
            sl_percent=req.sl_percent,
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
