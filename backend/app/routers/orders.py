"""
Order execution routes — execute strategies, view positions, square off.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException

from ..config import IST, LOT_SIZES
from ..models import (
    ExecuteRequest,
    ExecuteResponse,
    OrderLeg,
    PositionItem,
    PositionsResponse,
    SquareOffRequest,
    GenericResponse,
    Credentials,
)
from ..strategy_engine import execute_strategy
from .. import dhan_service

router = APIRouter(prefix="/api/orders", tags=["Orders"])


@router.post("/execute", response_model=ExecuteResponse)
async def execute_order(req: ExecuteRequest):
    """Execute a strategy immediately."""
    try:
        result = execute_strategy(
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

        # Map result legs to OrderLeg schema (defensively coerce types)
        legs = [
            OrderLeg(
                leg=str(l.get("leg", "?")),
                strike=float(l.get("strike", 0)),
                premium=l.get("premium"),
                order_id=l.get("order_id"),
                status=str(l.get("status", "UNKNOWN")),
                message=str(l.get("message") or ""),
            )
            for l in result.get("legs", [])
        ]

        sl_legs = [
            OrderLeg(
                leg=str(l.get("leg", "?")),
                strike=float(l.get("strike", 0)),
                premium=l.get("trigger_price"),
                order_id=l.get("order_id"),
                status=str(l.get("status", "UNKNOWN")),
                message=str(l.get("message") or ""),
            )
            for l in result.get("sl_legs", [])
        ]

        return ExecuteResponse(
            success=result.get("success", False),
            strategy=result.get("strategy", req.strategy.value),
            index=result.get("index", req.index.value),
            expiry=result.get("expiry", req.expiry),
            legs=legs,
            sl_legs=sl_legs,
            error=result.get("error"),
        )
    except Exception as exc:
        return ExecuteResponse(
            success=False,
            strategy=req.strategy.value,
            index=req.index.value,
            expiry=req.expiry,
            legs=[],
            sl_legs=[],
            error=str(exc),
        )


@router.get("/positions", response_model=PositionsResponse)
async def get_positions(client_id: str, access_token: str):
    """Fetch all open positions with P&L."""
    try:
        raw_positions = dhan_service.get_positions(client_id, access_token)

        positions: list[PositionItem] = []
        total_pnl = 0.0

        for pos in raw_positions:
            net_qty = pos.get("netQty") or (pos.get("buyQty", 0) - pos.get("sellQty", 0))
            if net_qty == 0:
                continue

            pnl = pos.get("realizedProfit", 0) + pos.get("unrealizedProfit", 0)
            total_pnl += pnl

            positions.append(
                PositionItem(
                    security_id=str(pos.get("securityId", "")),
                    symbol=pos.get("tradingSymbol", pos.get("trading_symbol", "")),
                    option_type=pos.get("optionType", ""),
                    strike_price=float(pos.get("strikePrice", 0)),
                    quantity=int(net_qty),
                    avg_price=float(pos.get("costPrice", pos.get("avgPrice", 0))),
                    ltp=float(pos.get("ltp", pos.get("lastPrice", 0))),
                    pnl=round(pnl, 2),
                    product_type=pos.get("productType", ""),
                )
            )

        return PositionsResponse(
            success=True,
            positions=positions,
            total_pnl=round(total_pnl, 2),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/square-off", response_model=GenericResponse)
async def square_off(req: SquareOffRequest):
    """Square off all open positions and cancel pending orders."""
    result = dhan_service.square_off_all(req.client_id, req.access_token)
    if result.get("success"):
        return GenericResponse(
            success=True,
            message=f"Squared off {result.get('squared_off', 0)} position(s)",
        )
    raise HTTPException(status_code=500, detail=result.get("error", "Square-off failed"))
