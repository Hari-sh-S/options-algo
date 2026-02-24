"""
Paper trading service — simulates order execution without touching Dhan API.

Architecture:
  - In-memory cache (_cache dict) for fast reads (every 5s position poll)
  - Firestore for persistence (survives deploys/restarts)
  - On first read: load from Firestore → cache (1 read per server start)
  - On writes: update cache + write to Firestore
  - Auto-clears at start of next trading day (IST)
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any

from .config import IST

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory cache: {uid: {"date": "YYYY-MM-DD", "positions": [...], "orders": [...]}}
# ---------------------------------------------------------------------------
_cache: dict[str, dict] = {}
_loaded_from_firestore: set[str] = set()  # track which UIDs have been loaded


# ---------------------------------------------------------------------------
# Firestore helpers (only used for persistence, not polling)
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


def _empty_data() -> dict:
    return {"date": _today_key(), "positions": [], "orders": []}


def _ensure_loaded(uid: str) -> None:
    """Load from Firestore into cache on first access. Only reads once per server lifetime."""
    if uid in _loaded_from_firestore:
        return  # already loaded, no Firestore read

    try:
        doc = _collection(uid).get()
        if doc.exists:
            data = doc.to_dict()
            stored_date = data.get("date", "")

            # Auto-clear if positions are from a previous day
            if stored_date != _today_key():
                logger.info("📄 PAPER: Clearing stale positions from %s (today=%s)", stored_date, _today_key())
                _collection(uid).delete()
                _cache[uid] = _empty_data()
            else:
                _cache[uid] = data
                logger.info("📄 PAPER: Loaded %d positions from Firestore for uid=%s", len(data.get("positions", [])), uid[:8])
        else:
            _cache[uid] = _empty_data()
    except Exception as exc:
        logger.warning("📄 PAPER: Firestore load failed for uid=%s: %s", uid[:8], exc)
        if uid not in _cache:
            _cache[uid] = _empty_data()

    _loaded_from_firestore.add(uid)


def _get_data(uid: str) -> dict:
    """Get cached data for a user (loads from Firestore on first call)."""
    _ensure_loaded(uid)
    data = _cache.get(uid, _empty_data())

    # Day rollover check (server running across midnight)
    if data.get("date", "") != _today_key():
        logger.info("📄 PAPER: Day rollover — clearing positions")
        data = _empty_data()
        _cache[uid] = data
        _persist(uid)

    return data


def _persist(uid: str) -> None:
    """Write current cache to Firestore (background, fire-and-forget)."""
    try:
        data = _cache.get(uid, _empty_data())
        data["date"] = _today_key()
        _collection(uid).set(data)
    except Exception as exc:
        logger.warning("📄 PAPER: Firestore write failed: %s", exc)


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

    if uid:
        data = _get_data(uid)
        data["orders"].append(order)
        data["positions"].append(position)
        _cache[uid] = data
        _persist(uid)  # write to Firestore
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
        data = _get_data(uid)
        data["orders"].append(order)
        _cache[uid] = data
        _persist(uid)

    logger.info(f"📄 PAPER SL order: qty={quantity} trigger={trigger_price} → {order_id}")

    return {
        "status": "success",
        "data": {"orderId": order_id, "orderStatus": "PENDING"},
        "remarks": f"Paper SL placed: {order_id}",
    }


def get_positions(uid: str = "") -> list[dict[str, Any]]:
    """Return all simulated positions (from cache — no Firestore read)."""
    if uid:
        data = _get_data(uid)
        return list(data.get("positions", []))
    return []


def get_orders(uid: str = "") -> list[dict[str, Any]]:
    """Return all simulated orders."""
    if uid:
        data = _get_data(uid)
        return list(data.get("orders", []))
    return []


def square_off_all(uid: str = "") -> dict[str, Any]:
    """Clear all paper positions."""
    if uid:
        data = _get_data(uid)
        count = len(data.get("positions", []))
        data["positions"] = []
        _cache[uid] = data
        _persist(uid)
    else:
        count = 0
    logger.info(f"📄 PAPER: Squared off {count} simulated position(s)")
    return {"success": True, "squared_off": count}


def reset(uid: str = "") -> None:
    """Clear all paper trading data."""
    if uid:
        _cache.pop(uid, None)
        _loaded_from_firestore.discard(uid)
        _collection(uid).delete()
    logger.info("📄 PAPER: Ledger reset")
