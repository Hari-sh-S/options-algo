"""
Pydantic request / response schemas for the Options Execution Portal.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .config import IndexName, StrategyType


# ---------------------------------------------------------------------------
# Credentials (sent per-request from the frontend)
# ---------------------------------------------------------------------------

class Credentials(BaseModel):
    client_id: str = Field(..., description="Dhan Client ID")
    access_token: str = Field(..., description="Dhan Access Token")


# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------

class UpdateDataRequest(Credentials):
    """Download / refresh the instrument master CSV."""
    pass


class FetchExpiriesRequest(BaseModel):
    index: IndexName


class ExecuteRequest(Credentials):
    strategy: StrategyType
    index: IndexName
    expiry: str = Field(..., description="Expiry date string, e.g. '2026-02-20'")
    lots: int = Field(ge=1, description="Number of lots")
    sl_percent: float = Field(ge=0, description="Stop-loss percentage (e.g. 30 means 30%)")

    # Strategy-specific optional fields
    target_premium: Optional[float] = Field(
        None, description="Target premium for Premium Based strategy"
    )
    spot_percent: Optional[float] = Field(
        None, description="OTM percentage for Spot Based Strangle (e.g. 1.0 = 1%)"
    )


class ScheduleRequest(ExecuteRequest):
    """Same as ExecuteRequest but with a scheduled time."""
    execute_at: str = Field(
        ..., description="ISO time string for scheduled execution, e.g. '10:53:00'"
    )


class SquareOffRequest(Credentials):
    """Square off all open positions."""
    pass


class CancelJobRequest(BaseModel):
    job_id: str


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------

class OrderLeg(BaseModel):
    leg: str = Field(..., description="CE or PE")
    strike: int
    premium: Optional[float] = None
    order_id: Optional[str] = None
    status: str = "PENDING"
    message: Optional[str] = None


class ExecuteResponse(BaseModel):
    success: bool
    strategy: str
    index: str
    expiry: str
    legs: list[OrderLeg] = []
    sl_legs: list[OrderLeg] = []
    error: Optional[str] = None


class PositionItem(BaseModel):
    security_id: str
    symbol: str
    option_type: str = ""
    strike_price: float = 0.0
    quantity: int = 0
    avg_price: float = 0.0
    ltp: float = 0.0
    pnl: float = 0.0
    product_type: str = ""


class PositionsResponse(BaseModel):
    success: bool
    positions: list[PositionItem] = []
    total_pnl: float = 0.0
    error: Optional[str] = None


class MarketStatusResponse(BaseModel):
    is_open: bool
    current_time: str
    status_label: str  # "MARKET OPEN" or "MARKET CLOSED"


class SpotPriceResponse(BaseModel):
    index: str
    ltp: float
    timestamp: str


class ExpiriesResponse(BaseModel):
    index: str
    expiries: list[str]


class ScheduledJobResponse(BaseModel):
    job_id: str
    execute_at: str
    strategy: str
    index: str
    expiry: str
    lots: int


class JobsListResponse(BaseModel):
    jobs: list[ScheduledJobResponse]


class GenericResponse(BaseModel):
    success: bool
    message: str
