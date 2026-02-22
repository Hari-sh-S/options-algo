"""
Market data routes — spot prices, expiries, instrument master, market status.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException

from ..config import IST, MARKET_CLOSE, MARKET_OPEN, IndexName
from ..models import (
    ExpiriesResponse,
    MarketStatusResponse,
    SpotPriceResponse,
    UpdateDataRequest,
    GenericResponse,
    Credentials,
)
from .. import dhan_service

router = APIRouter(prefix="/api/market", tags=["Market"])


@router.post("/update-data", response_model=GenericResponse)
async def update_data(req: UpdateDataRequest):
    """Download / refresh the daily instrument master CSV."""
    result = dhan_service.download_master(req.client_id, req.access_token)
    if result.get("success"):
        return GenericResponse(
            success=True,
            message=f"Master data loaded ({result.get('rows', 0)} instruments). Auth valid: {result.get('auth_valid', False)}",
        )
    raise HTTPException(status_code=500, detail=result.get("error", "Unknown error"))


@router.get("/expiries", response_model=ExpiriesResponse)
async def get_expiries(index: IndexName):
    """Return upcoming expiry dates for the selected index."""
    try:
        expiries = dhan_service.get_expiries(index)
        return ExpiriesResponse(index=index.value, expiries=expiries)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/spot", response_model=SpotPriceResponse)
async def get_spot(req: Credentials, index: IndexName):
    """Fetch the real-time spot (LTP) for an index.

    Changed from GET to POST to keep credentials out of URL.
    """
    try:
        ltp = dhan_service.get_spot_price(req.client_id, req.access_token, index)
        return SpotPriceResponse(
            index=index.value,
            ltp=ltp,
            timestamp=datetime.now(IST).isoformat(),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/status", response_model=MarketStatusResponse)
async def market_status():
    """Return whether the market is open/closed and the current IST time."""
    now = datetime.now(IST)
    current_time_only = now.time()
    weekday = now.weekday()  # 0=Mon … 6=Sun

    is_open = (
        weekday < 5
        and MARKET_OPEN <= current_time_only <= MARKET_CLOSE
    )

    return MarketStatusResponse(
        is_open=is_open,
        current_time=now.strftime("%H:%M:%S"),
        status_label="MARKET OPEN" if is_open else "MARKET CLOSED",
    )
