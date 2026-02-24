"""
Market data routes — spot prices, expiries, instrument master, market status.

SECURITY: Credentials are read from Firestore via Firebase ID token.
Fallback: credentials from POST body for backward compatibility.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Header

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


def _resolve_credentials(
    body_creds: Credentials | None,
    authorization: str | None,
) -> tuple[str, str]:
    """Resolve Dhan credentials from Firebase token (preferred) or request body."""
    if authorization and authorization.startswith("Bearer "):
        from ..firebase_auth import verify_id_token, get_user_credentials

        token = authorization[len("Bearer "):]
        try:
            decoded = verify_id_token(token)
            uid = decoded["uid"]
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        creds = get_user_credentials(uid)
        if not creds or not creds.get("client_id"):
            raise HTTPException(
                status_code=400,
                detail="No API credentials saved. Go to API Credentials tab to save them.",
            )
        return creds["client_id"], creds["access_token"]

    if body_creds and body_creds.client_id and body_creds.access_token:
        return body_creds.client_id, body_creds.access_token

    raise HTTPException(status_code=401, detail="Authentication required")


@router.post("/update-data", response_model=GenericResponse)
async def update_data(
    req: UpdateDataRequest | None = None,
    authorization: Optional[str] = Header(None),
):
    """Download / refresh the daily instrument master CSV."""
    client_id, access_token = _resolve_credentials(req, authorization)
    result = dhan_service.download_master(client_id, access_token)
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
async def get_spot(
    index: IndexName,
    req: Credentials | None = None,
    authorization: Optional[str] = Header(None),
):
    """Fetch the real-time spot (LTP) for an index."""
    try:
        client_id, access_token = _resolve_credentials(req, authorization)
        ltp = dhan_service.get_spot_price(client_id, access_token, index)
        return SpotPriceResponse(
            index=index.value,
            ltp=ltp,
            timestamp=datetime.now(IST).isoformat(),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/status", response_model=MarketStatusResponse)
async def market_status():
    """Return whether the market is open/closed and the current IST time."""
    now = datetime.now(IST)
    current_time_only = now.time()
    weekday = now.weekday()

    is_open = (
        weekday < 5
        and MARKET_OPEN <= current_time_only <= MARKET_CLOSE
    )

    return MarketStatusResponse(
        is_open=is_open,
        current_time=now.strftime("%H:%M:%S"),
        status_label="MARKET OPEN" if is_open else "MARKET CLOSED",
    )
