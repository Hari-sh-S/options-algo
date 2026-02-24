"""
Order execution routes — execute strategies, view positions, square off.

SECURITY: Credentials are read from Firestore via Firebase ID token.
Fallback: if Authorization header is absent, credentials from POST body are used
(for backward compatibility / local development).
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Header

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


def _resolve_credentials(
    body_creds: Credentials | None,
    authorization: str | None,
) -> tuple[str, str]:
    """Resolve Dhan credentials from Firebase token (preferred) or request body (fallback)."""
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

    # Fallback: credentials from request body
    if body_creds and body_creds.client_id and body_creds.access_token:
        return body_creds.client_id, body_creds.access_token

    raise HTTPException(status_code=401, detail="Authentication required")


@router.post("/execute", response_model=ExecuteResponse)
async def execute_order(req: ExecuteRequest, authorization: Optional[str] = Header(None)):
    """Execute a strategy immediately (live or paper)."""
    try:
        client_id, access_token = _resolve_credentials(req, authorization)

        result = execute_strategy(
            client_id=client_id,
            access_token=access_token,
            strategy=req.strategy,
            index=req.index,
            expiry=req.expiry,
            lots=req.lots,
            sl_percent=req.sl_percent,
            target_premium=req.target_premium,
            spot_percent=req.spot_percent,
            mode=req.mode,
        )

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
    except HTTPException:
        raise
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

import logging

logger = logging.getLogger(__name__)


def _refresh_paper_ltps(
    paper_pos: list[dict],
    client_id: str,
    access_token: str,
) -> None:
    """
    Batch-fetch live LTPs for paper positions and update them in-place.
    Groups security IDs by exchange segment to minimize API calls.
    """
    from collections import defaultdict

    # Group security IDs by exchange segment
    seg_groups: dict[str, list[int]] = defaultdict(list)
    for pos in paper_pos:
        sec_id = pos.get("securityId")
        seg = pos.get("exchangeSegment", "NSE_FNO")
        if sec_id:
            try:
                seg_groups[seg].append(int(sec_id))
            except (ValueError, TypeError):
                continue

    if not seg_groups:
        return

    # Fetch LTPs in batches (one call per exchange segment)
    all_ltps: dict[int, float] = {}
    for seg, sec_ids in seg_groups.items():
        try:
            batch = dhan_service.fetch_ltps_batch(client_id, access_token, sec_ids, seg)
            all_ltps.update(batch)
        except Exception as exc:
            logger.warning("Failed to refresh paper LTPs for segment %s: %s", seg, exc)

    # Update each paper position with live data
    for pos in paper_pos:
        sec_id = pos.get("securityId")
        if not sec_id:
            continue
        try:
            sid = int(sec_id)
        except (ValueError, TypeError):
            continue

        live_ltp = all_ltps.get(sid)
        if live_ltp and live_ltp > 0:
            pos["ltp"] = live_ltp
            # P&L for short positions: (entry - current) × qty
            cost = float(pos.get("costPrice", 0) or pos.get("sellAvg", 0) or 0)
            net_qty = pos.get("netQty", 0)
            if cost > 0 and net_qty != 0:
                # For short (negative qty): profit when LTP < cost
                pos["unrealizedProfit"] = round((cost - live_ltp) * abs(net_qty), 2)


@router.post("/positions", response_model=PositionsResponse)
async def get_positions(
    req: Credentials | None = None,
    authorization: Optional[str] = Header(None),
):
    """Fetch all open positions with P&L."""
    try:
        client_id, access_token = _resolve_credentials(req, authorization)

        paper_pos = paper_service.get_positions()
        raw_positions = dhan_service.get_positions(client_id, access_token) if client_id else []

        # ── Refresh paper position LTPs with live market data ──
        if paper_pos and client_id and access_token:
            _refresh_paper_ltps(paper_pos, client_id, access_token)

        all_positions = list(raw_positions) + list(paper_pos)

        positions: list[PositionItem] = []
        total_pnl = 0.0

        for pos in all_positions:
            net_qty = pos.get("netQty") or (pos.get("buyQty", 0) - pos.get("sellQty", 0))
            if net_qty == 0:
                continue

            pnl = pos.get("realizedProfit", 0) + pos.get("unrealizedProfit", 0)
            total_pnl += pnl

            # Resolve average price: costPrice > buyAvg/sellAvg > dayBuyAvg/daySellAvg
            avg = float(pos.get("costPrice", 0) or 0)
            if avg == 0:
                if net_qty > 0:
                    avg = float(pos.get("buyAvg", 0) or pos.get("dayBuyAvg", 0) or 0)
                else:
                    avg = float(pos.get("sellAvg", 0) or pos.get("daySellAvg", 0) or 0)

            # Resolve LTP
            ltp = float(
                pos.get("ltp", 0)
                or pos.get("lastPrice", 0)
                or pos.get("last_traded_price", 0)
                or 0
            )

            positions.append(
                PositionItem(
                    security_id=str(pos.get("securityId", "")),
                    symbol=pos.get("tradingSymbol", pos.get("trading_symbol", "")),
                    option_type=pos.get("optionType", ""),
                    strike_price=float(pos.get("strikePrice", 0)),
                    quantity=int(net_qty),
                    avg_price=round(avg, 2),
                    ltp=round(ltp, 2),
                    pnl=round(pnl, 2),
                    product_type=pos.get("productType", ""),
                )
            )

        return PositionsResponse(
            success=True,
            positions=positions,
            total_pnl=round(total_pnl, 2),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/square-off", response_model=GenericResponse)
async def square_off(
    req: SquareOffRequest | None = None,
    authorization: Optional[str] = Header(None),
):
    """Square off all open positions and cancel pending orders."""
    client_id, access_token = _resolve_credentials(req, authorization)

    # Square off paper positions
    paper_result = paper_service.square_off_all()
    paper_count = paper_result.get("squared_off", 0)

    # Square off live positions
    live_count = 0
    if client_id and access_token:
        result = dhan_service.square_off_all(client_id, access_token)
        if result.get("success"):
            live_count = result.get("squared_off", 0)
        elif not paper_count:
            raise HTTPException(status_code=500, detail=result.get("error", "Square-off failed"))

    total = paper_count + live_count
    return GenericResponse(
        success=True,
        message=f"Squared off {total} position(s) ({paper_count} paper, {live_count} live)",
    )
