"""
Order execution routes — execute strategies, view positions, square off.

SECURITY: Credentials are sent in POST body only (never in URL query params).
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
from .. import paper_service

router = APIRouter(prefix="/api/orders", tags=["Orders"])


@router.post("/execute", response_model=ExecuteResponse)
async def execute_order(req: ExecuteRequest):
    """Execute a strategy immediately (live or paper)."""
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
            mode=req.mode,
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
            mode=result.get("mode", req.mode),
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
            mode=req.mode,
            legs=[],
            sl_legs=[],
            error=str(exc),
        )


@router.post("/positions", response_model=PositionsResponse)
async def get_positions(req: Credentials):
    """Fetch all open positions with P&L.

    Changed from GET to POST to keep credentials out of URL query params.
    """
    try:
        # Check for paper positions first
        paper_pos = paper_service.get_positions()
        raw_positions = dhan_service.get_positions(req.client_id, req.access_token) if req.client_id else []

        # Combine real + paper positions
        all_positions = list(raw_positions) + list(paper_pos)

        positions: list[PositionItem] = []
        total_pnl = 0.0

        for pos in all_positions:
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
    # Square off paper positions
    paper_result = paper_service.square_off_all()
    paper_count = paper_result.get("squared_off", 0)

    # Square off live positions
    live_count = 0
    if req.client_id and req.access_token:
        result = dhan_service.square_off_all(req.client_id, req.access_token)
        if result.get("success"):
            live_count = result.get("squared_off", 0)
        elif not paper_count:
            raise HTTPException(status_code=500, detail=result.get("error", "Square-off failed"))

    total = paper_count + live_count
    return GenericResponse(
        success=True,
        message=f"Squared off {total} position(s) ({paper_count} paper, {live_count} live)",
    )
