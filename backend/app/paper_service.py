"""
Paper trading service — simulates order execution without touching Dhan API.

Keeps positions in Firestore (keyed by user UID) so they survive server
restarts and deployments.  Positions created today are kept until
the next calendar day (IST), then auto-cleared.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, date
from typing import Any

from .config import IST

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Firestore helpers
# ---------------------------------------------------------------------------

def _db():
    """Lazy import so firebase_admin is only loaded when needed."""
    from .firebase_auth import _db as db
    return db


def _collection(uid: str):
    """Return the Firestore document reference for a user's paper data."""
    return _db().collection("paper_trading").document(uid)


def _today_key() -> str:
    """Return today's date in IST as YYYY-MM-DD."""
    return datetime.now(IST).strftime("%Y-%m-%d")


def _load(uid: str) -> dict:
    """Load paper trading data from Firestore, auto-clearing if stale."""
    doc = _collection(uid).get()
    if not doc.exists:
        return {"date": _today_key(), "positions": [], "orders": []}

    data = doc.to_dict()
    stored_date = data.get("date", "")

    # Auto-clear if positions are from a previous day
    if stored_date != _today_key():
        logger.info("📄 PAPER: Clearing stale positions from %s (today=%s)", stored_date, _today_key())
        _collection(uid).delete()
        return {"date": _today_key(), "positions": [], "orders": []}

    return data


def _save(uid: str, data: dict) -> None:
    """Save paper trading data to Firestore."""
    data["date"] = _today_key()
    _collection(uid).set(data)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

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
    uid: str = "",
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

    position = {
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
    }

    # Persist to Firestore if UID is provided
    if uid:
        data = _load(uid)
        data["orders"].append(order)
        data["positions"].append(position)
        _save(uid, data)
    else:
        logger.warning("📄 PAPER sell order without UID — position won't persist")

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
    uid: str = "",
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

    if uid:
        data = _load(uid)
        data["orders"].append(order)
        _save(uid, data)

    logger.info(f"📄 PAPER SL order: qty={quantity} trigger={trigger_price} → {order_id}")

    return {
        "status": "success",
        "data": {"orderId": order_id, "orderStatus": "PENDING"},
        "remarks": f"Paper SL placed: {order_id}",
    }


def get_positions(uid: str = "") -> list[dict[str, Any]]:
    """Return all simulated positions (from Firestore if UID provided)."""
    if uid:
        data = _load(uid)
        return list(data.get("positions", []))
    return []


def get_orders(uid: str = "") -> list[dict[str, Any]]:
    """Return all simulated orders."""
    if uid:
        data = _load(uid)
        return list(data.get("orders", []))
    return []


def square_off_all(uid: str = "") -> dict[str, Any]:
    """Clear all paper positions."""
    if uid:
        data = _load(uid)
        count = len(data.get("positions", []))
        data["positions"] = []
        _save(uid, data)
    else:
        count = 0
    logger.info(f"📄 PAPER: Squared off {count} simulated position(s)")
    return {"success": True, "squared_off": count}


def reset(uid: str = "") -> None:
    """Clear all paper trading data."""
    if uid:
        _collection(uid).delete()
    logger.info("📄 PAPER: Ledger reset")
