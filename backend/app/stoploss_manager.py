"""
Stop-loss manager — places SL-M buy orders after confirming entry fills.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from . import dhan_service

logger = logging.getLogger(__name__)

# Maximum wait time (seconds) for order fill confirmation
MAX_FILL_WAIT = 30
POLL_INTERVAL = 2


def place_stop_losses(
    client_id: str,
    access_token: str,
    entry_legs: list[dict[str, Any]],
    sl_percent: float,
    quantity: int,
    exchange_segment: str,
) -> list[dict[str, Any]]:
    """
    For each entry leg:
      1. Wait for the entry order to be FILLED.
      2. Fetch the executed average price.
      3. Calculate SL trigger = avg_price * (1 + sl_percent / 100).
      4. Place a SL-M BUY order.

    Returns a list of SL order result dicts.
    """
    sl_results: list[dict[str, Any]] = []

    for leg in entry_legs:
        order_id = leg.get("order_id")
        if not order_id:
            sl_results.append({
                "leg": leg.get("leg", "?"),
                "strike": leg.get("strike", 0),
                "status": "SKIPPED",
                "message": "Entry order had no order_id — skipping SL",
            })
            continue

        # ---- Step 1: Wait for fill ----
        avg_price = _wait_for_fill(client_id, access_token, order_id)
        if avg_price is None:
            sl_results.append({
                "leg": leg.get("leg", "?"),
                "strike": leg.get("strike", 0),
                "status": "SKIPPED",
                "message": f"Entry order {order_id} not filled within {MAX_FILL_WAIT}s",
            })
            continue

        # ---- Step 2: Calculate SL trigger ----
        sl_trigger = round(avg_price * (1 + sl_percent / 100), 2)

        logger.info(
            "SL for %s %s: avg_price=%.2f, sl_pct=%.1f%%, trigger=%.2f",
            leg.get("leg"), leg.get("strike"), avg_price, sl_percent, sl_trigger,
        )

        # ---- Step 3: Place SL-M BUY order ----
        security_id = leg.get("security_id", "")
        sl_resp = dhan_service.place_sl_buy_order(
            client_id=client_id,
            access_token=access_token,
            security_id=security_id,
            exchange_segment=exchange_segment,
            quantity=quantity,
            trigger_price=sl_trigger,
            tag=f"sl_{leg.get('leg', '').lower()}",
        )

        sl_results.append({
            "leg": leg.get("leg", "?"),
            "strike": leg.get("strike", 0),
            "trigger_price": sl_trigger,
            "avg_entry_price": avg_price,
            "order_id": sl_resp.get("order_id"),
            "status": sl_resp.get("status", "UNKNOWN"),
            "message": sl_resp.get("message", ""),
        })

    return sl_results


def _wait_for_fill(
    client_id: str,
    access_token: str,
    order_id: str,
) -> float | None:
    """
    Poll the order status until it is TRADED/FILLED or timeout.

    Returns the average traded price, or None if not filled in time.
    """
    elapsed = 0.0
    while elapsed < MAX_FILL_WAIT:
        detail = dhan_service.get_order_detail(client_id, access_token, order_id)
        status = (
            detail.get("orderStatus")
            or detail.get("status")
            or ""
        ).upper()

        if status in ("TRADED", "FILLED", "COMPLETE"):
            avg = detail.get("averageTradedPrice") or detail.get("avgPrice") or detail.get("price")
            if avg:
                return float(avg)
            # Filled but can't read price — return 0 and skip SL
            logger.warning("Order %s filled but avgPrice missing: %s", order_id, detail)
            return None

        if status in ("REJECTED", "CANCELLED", "FAILED"):
            logger.warning("Order %s terminal status: %s", order_id, status)
            return None

        time.sleep(POLL_INTERVAL)
        elapsed += POLL_INTERVAL

    logger.warning("Order %s not filled after %.0fs", order_id, MAX_FILL_WAIT)
    return None
