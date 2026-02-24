"""
Paper trading service — simulates order execution without touching Dhan API.

Keeps an in-memory ledger of simulated positions and P&L.
Uses real market data (spot prices, option chain) but fake order placement.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any, Optional

from .config import IST

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory paper ledger
# ---------------------------------------------------------------------------

_paper_positions: list[dict[str, Any]] = []
_paper_orders: list[dict[str, Any]] = []


def place_sell_order(
    security_id: str,
    exchange_segment: str,
    quantity: int,
    order_type: str = "MARKET",
    price: float = 0.0,
    trigger_price: float = 0.0,
    product_type: str = "INTRADAY",
    tag: str = "",
    premium: float = 0.0,
    symbol: str = "",
    **kwargs: Any,
) -> dict[str, Any]:
    """Simulate a SELL order — log it and return a fake order response."""
    order_id = f"PAPER-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.now(IST).isoformat()

    order = {
        "order_id": order_id,
        "security_id": security_id,
        "symbol": symbol,
        "exchange_segment": exchange_segment,
        "quantity": quantity,
        "price": premium or price,
        "trigger_price": trigger_price,
        "product_type": product_type,
        "tag": tag,
        "side": "SELL",
        "status": "TRADED",
        "timestamp": now,
    }
    _paper_orders.append(order)

    # Add to positions
    _paper_positions.append({
        "securityId": security_id,
        "tradingSymbol": symbol or f"SIM-{security_id}",
        "optionType": tag.split("-")[0] if "-" in tag else "",
        "strikePrice": 0,
        "netQty": -quantity,  # sold
        "buyQty": 0,
        "sellQty": quantity,
        "costPrice": premium or price,
        "sellAvg": premium or price,
        "ltp": premium or price,
        "realizedProfit": 0,
        "unrealizedProfit": 0,
        "productType": product_type,
        "exchangeSegment": exchange_segment,
        "is_paper": True,
    })

    logger.info(f"📄 PAPER sell order: {symbol} qty={quantity} premium={premium} → {order_id}")

    return {
        "status": "success",
        "data": {"orderId": order_id, "orderStatus": "TRADED"},
        "remarks": f"Paper trade executed: {order_id}",
    }


def place_sl_buy_order(
    security_id: str,
    exchange_segment: str,
    quantity: int,
    trigger_price: float,
    product_type: str = "INTRADAY",
    tag: str = "",
    **kwargs: Any,
) -> dict[str, Any]:
    """Simulate a SL-M BUY order."""
    order_id = f"PAPER-SL-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.now(IST).isoformat()

    order = {
        "order_id": order_id,
        "security_id": security_id,
        "exchange_segment": exchange_segment,
        "quantity": quantity,
        "trigger_price": trigger_price,
        "product_type": product_type,
        "tag": tag,
        "side": "BUY",
        "order_type": "SL-M",
        "status": "PENDING",
        "timestamp": now,
    }
    _paper_orders.append(order)

    logger.info(f"📄 PAPER SL order: qty={quantity} trigger={trigger_price} → {order_id}")

    return {
        "status": "success",
        "data": {"orderId": order_id, "orderStatus": "PENDING"},
        "remarks": f"Paper SL placed: {order_id}",
    }


def get_positions() -> list[dict[str, Any]]:
    """Return all simulated positions."""
    return list(_paper_positions)


def get_orders() -> list[dict[str, Any]]:
    """Return all simulated orders."""
    return list(_paper_orders)


def square_off_all() -> dict[str, Any]:
    """Clear all paper positions."""
    count = len(_paper_positions)
    _paper_positions.clear()
    _paper_orders.clear()
    logger.info(f"📄 PAPER: Squared off {count} simulated position(s)")
    return {"success": True, "squared_off": count}


def reset() -> None:
    """Clear all paper trading data."""
    _paper_positions.clear()
    _paper_orders.clear()
    logger.info("📄 PAPER: Ledger reset")
