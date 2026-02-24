"""
Dhan API service layer — thin wrapper around the dhanhq SDK.

Every public method accepts client credentials so they are scoped per-request
(sent from the frontend).
"""

from __future__ import annotations

import logging
import os
import time as _time
from datetime import date
from typing import Any, Optional

import httpx
import pandas as pd
from dhanhq import dhanhq as Dhan  # SDK class: dhanhq.dhanhq

from .config import (
    EXCHANGE_SEGMENTS,
    INSTRUMENT_MASTER_URL,
    IST,
    LOT_SIZES,
    MASTER_CSV_PATH,
    STRIKE_GAPS,
    UNDERLYING_SECURITY_IDS,
    IndexName,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Cached master dataframe (in-memory, refreshed via /update-data)
# ---------------------------------------------------------------------------
_master_df: Optional[pd.DataFrame] = None


def _get_dhan(client_id: str, access_token: str) -> Dhan:
    """Create a fresh Dhan client from per-request credentials."""
    return Dhan(client_id, access_token)


# ----------------------------- Master CSV ---------------------------------

def download_master(client_id: str, access_token: str) -> dict[str, Any]:
    """
    Download the daily instrument master CSV from Dhan, cache it locally
    and in-memory.
    """
    global _master_df
    try:
        logger.info("Downloading instrument master from %s", INSTRUMENT_MASTER_URL)
        resp = httpx.get(INSTRUMENT_MASTER_URL, timeout=60)
        resp.raise_for_status()

        with open(MASTER_CSV_PATH, "wb") as f:
            f.write(resp.content)

        _master_df = pd.read_csv(MASTER_CSV_PATH, low_memory=False)
        logger.info("Master CSV loaded: %d rows", len(_master_df))

        # Quick auth check — try fetching fund limits
        dhan = _get_dhan(client_id, access_token)
        fund_resp = dhan.get_fund_limits()
        auth_ok = fund_resp.get("status", "") != "failure"

        return {
            "success": True,
            "rows": len(_master_df),
            "auth_valid": auth_ok,
        }
    except Exception as exc:
        logger.exception("Failed to download master CSV")
        return {"success": False, "error": str(exc)}


def _ensure_master() -> pd.DataFrame:
    """Return cached master DF or load from disk."""
    global _master_df
    if _master_df is not None:
        return _master_df
    if os.path.exists(MASTER_CSV_PATH):
        _master_df = pd.read_csv(MASTER_CSV_PATH, low_memory=False)
        return _master_df
    raise RuntimeError(
        "Instrument master not loaded. Click 'Update Data' first."
    )


# ----------------------------- Expiries -----------------------------------

def get_expiries(index: IndexName) -> list[str]:
    """Return sorted list of upcoming expiry date strings for the index."""
    df = _ensure_master()

    sym_filter = "NIFTY" if index == IndexName.NIFTY else "SENSEX"

    mask = (
        df["SEM_TRADING_SYMBOL"].str.startswith(sym_filter, na=False)
        & df["SEM_INSTRUMENT_NAME"].isin(["OPTIDX", "OPTSTK"])
    )
    filtered = df.loc[mask]

    if filtered.empty:
        # Fallback — less strict
        mask = (
            df["SEM_TRADING_SYMBOL"].str.contains(sym_filter, case=False, na=False)
            & df["SEM_INSTRUMENT_NAME"].str.contains("OPT", case=False, na=False)
        )
        filtered = df.loc[mask]

    if "SEM_EXPIRY_DATE" not in filtered.columns:
        return []

    today = date.today()
    expiries: set[str] = set()
    for raw in filtered["SEM_EXPIRY_DATE"].dropna().unique():
        try:
            exp_date = pd.to_datetime(raw).date()
            if exp_date >= today:
                expiries.add(exp_date.isoformat())
        except Exception:
            continue

    return sorted(expiries)


# ----------------------------- Spot Price ---------------------------------


def _extract_ltp_from_quote(resp: Any) -> float | None:
    """
    Recursively extract `last_price` from Dhan's deeply-nested quote response.

    Actual structure:
        resp = {
            "status": "success",
            "data": {
                "data": {
                    "IDX_I": {
                        "13": { "last_price": 25682.75, ... }
                    }
                },
                "status": "success"
            }
        }
    """
    if not isinstance(resp, dict):
        return None

    # Check if this dict itself has a price field
    for key in ("last_price", "LTP", "ltp"):
        val = resp.get(key)
        if val is not None and val != 0:
            return float(val)

    # Recurse into nested dicts
    for val in resp.values():
        if isinstance(val, dict):
            result = _extract_ltp_from_quote(val)
            if result is not None:
                return result

    return None


def get_spot_price(client_id: str, access_token: str, index: IndexName) -> float:
    """Fetch the real-time spot price (LTP) for the underlying index."""
    dhan = _get_dhan(client_id, access_token)
    sec_id = UNDERLYING_SECURITY_IDS[index]

    # Dhan quote_data expects: { "EXCHANGE_SEGMENT": [security_id, ...] }
    # For index spot: IDX_I segment
    exchange_key = Dhan.INDEX  # "IDX_I"

    try:
        resp = dhan.quote_data({exchange_key: [sec_id]})
        ltp = _extract_ltp_from_quote(resp)
        if ltp is not None:
            return ltp
        raise ValueError(f"Could not find last_price in response: {resp}")
    except Exception as exc:
        logger.exception("Failed to fetch spot price for %s", index)
        raise


# ----------------------------- Option Chain --------------------------------

def get_option_chain(
    client_id: str,
    access_token: str,
    index: IndexName,
    expiry: str,
) -> list[dict[str, Any]]:
    """
    Build an option chain from the master data + live LTPs.

    Returns a list of dicts:
      strike, ce_security_id, pe_security_id, ce_ltp, pe_ltp, ce_symbol, pe_symbol
    """
    df = _ensure_master()
    dhan = _get_dhan(client_id, access_token)

    sym_prefix = "NIFTY" if index == IndexName.NIFTY else "SENSEX"
    seg = EXCHANGE_SEGMENTS[index]  # "NSE_FNO" or "BSE_FNO"
    exp_date = pd.to_datetime(expiry).date()

    # Filter master for this index + expiry
    mask = (
        df["SEM_TRADING_SYMBOL"].str.startswith(sym_prefix, na=False)
        & df["SEM_INSTRUMENT_NAME"].isin(["OPTIDX", "OPTSTK"])
    )
    filtered = df.loc[mask].copy()
    filtered["_exp"] = pd.to_datetime(filtered["SEM_EXPIRY_DATE"], errors="coerce").dt.date
    filtered = filtered[filtered["_exp"] == exp_date]

    if filtered.empty:
        logger.warning("No instruments found for %s expiry %s", index, expiry)
        return []

    ce_df = filtered[filtered["SEM_OPTION_TYPE"] == "CE"].copy()
    pe_df = filtered[filtered["SEM_OPTION_TYPE"] == "PE"].copy()
    ce_df["_strike"] = pd.to_numeric(ce_df["SEM_STRIKE_PRICE"], errors="coerce")
    pe_df["_strike"] = pd.to_numeric(pe_df["SEM_STRIKE_PRICE"], errors="coerce")

    common_strikes = sorted(
        set(ce_df["_strike"].dropna().unique()) & set(pe_df["_strike"].dropna().unique())
    )

    chain: list[dict[str, Any]] = []
    for strike in common_strikes:
        ce_row = ce_df[ce_df["_strike"] == strike].iloc[0]
        pe_row = pe_df[pe_df["_strike"] == strike].iloc[0]

        ce_sec_id = str(int(ce_row["SEM_SMST_SECURITY_ID"]))
        pe_sec_id = str(int(pe_row["SEM_SMST_SECURITY_ID"]))

        ce_ltp = _fetch_ltp(dhan, int(ce_row["SEM_SMST_SECURITY_ID"]), seg)
        pe_ltp = _fetch_ltp(dhan, int(pe_row["SEM_SMST_SECURITY_ID"]), seg)

        chain.append({
            "strike": int(strike),
            "ce_security_id": ce_sec_id,
            "pe_security_id": pe_sec_id,
            "ce_ltp": ce_ltp,
            "pe_ltp": pe_ltp,
            "ce_symbol": ce_row.get("SEM_TRADING_SYMBOL", ""),
            "pe_symbol": pe_row.get("SEM_TRADING_SYMBOL", ""),
        })

    return chain


def _fetch_ltp(dhan: Dhan, security_id: int, exchange_segment: str) -> float:
    """Fetch the LTP for a single security, with retry."""
    for attempt in range(3):
        try:
            resp = dhan.quote_data({exchange_segment: [security_id]})
            ltp = _extract_ltp_from_quote(resp)
            if ltp is not None:
                return ltp
            return 0.0
        except Exception:
            if attempt < 2:
                _time.sleep(0.5)
            else:
                logger.warning("LTP fetch failed for %s after 3 attempts", security_id)
                return 0.0
    return 0.0


def fetch_ltps_batch(
    client_id: str,
    access_token: str,
    security_ids: list[int],
    exchange_segment: str,
) -> dict[int, float]:
    """
    Fetch LTPs for multiple security IDs in a single API call.

    Returns a dict of {security_id: ltp}.
    This avoids rate limiting from multiple sequential calls.
    """
    dhan = _get_dhan(client_id, access_token)
    result: dict[int, float] = {sid: 0.0 for sid in security_ids}

    for attempt in range(3):
        try:
            resp = dhan.quote_data({exchange_segment: security_ids})
            logger.debug("Batch quote response: %s", resp)

            # Navigate to the data dict
            data = resp
            if isinstance(data, dict):
                data = data.get("data", data)
            if isinstance(data, dict):
                data = data.get("data", data)

            # Extract LTP for each security ID
            if isinstance(data, dict):
                for seg_key, seg_data in data.items():
                    if isinstance(seg_data, dict):
                        for sid_str, quote in seg_data.items():
                            try:
                                sid = int(sid_str)
                                if sid in result and isinstance(quote, dict):
                                    for key in ("last_price", "LTP", "ltp"):
                                        val = quote.get(key)
                                        if val is not None and val != 0:
                                            result[sid] = float(val)
                                            break
                            except (ValueError, TypeError):
                                continue

            # If all prices found, return
            if all(v > 0 for v in result.values()):
                return result

            # If only partial, try individual calls for missing ones
            if attempt == 2:
                for sid in security_ids:
                    if result[sid] == 0.0:
                        result[sid] = _fetch_ltp(dhan, sid, exchange_segment)
                return result

        except Exception as exc:
            logger.warning("Batch LTP fetch attempt %d failed: %s", attempt + 1, exc)
            if attempt < 2:
                _time.sleep(0.5)

    return result


# ----------------------------- Order Placement ----------------------------

def place_sell_order(
    client_id: str,
    access_token: str,
    security_id: str,
    exchange_segment: str,
    quantity: int,
    order_type: str = "MARKET",
    price: float = 0.0,
    trigger_price: float = 0.0,
    product_type: str = "INTRADAY",
    tag: str = "",
) -> dict[str, Any]:
    """Place a SELL order via Dhan."""
    dhan = _get_dhan(client_id, access_token)
    try:
        resp = dhan.place_order(
            security_id=security_id,
            exchange_segment=exchange_segment,
            transaction_type=Dhan.SELL,
            quantity=quantity,
            order_type=order_type,
            product_type=product_type,
            price=price,
            trigger_price=trigger_price,
            tag=tag,
        )
        logger.info("Sell order response: %s", resp)
        return _parse_order_response(resp)
    except Exception as exc:
        logger.exception("Sell order failed for security %s", security_id)
        return {"order_id": None, "status": "FAILED", "message": str(exc)}


def place_sl_buy_order(
    client_id: str,
    access_token: str,
    security_id: str,
    exchange_segment: str,
    quantity: int,
    trigger_price: float,
    product_type: str = "INTRADAY",
    tag: str = "",
) -> dict[str, Any]:
    """Place a Stop-Loss Market (SL-M) BUY order."""
    dhan = _get_dhan(client_id, access_token)
    try:
        resp = dhan.place_order(
            security_id=security_id,
            exchange_segment=exchange_segment,
            transaction_type=Dhan.BUY,
            quantity=quantity,
            order_type=Dhan.SLM,  # "STOP_LOSS_MARKET"
            product_type=product_type,
            price=0,
            trigger_price=trigger_price,
            tag=tag,
        )
        logger.info("SL order response: %s", resp)
        return _parse_order_response(resp)
    except Exception as exc:
        logger.exception("SL order failed for security %s", security_id)
        return {"order_id": None, "status": "FAILED", "message": str(exc)}


def _parse_order_response(resp: Any) -> dict[str, Any]:
    """Normalise the Dhan SDK order response into a stable dict."""
    if isinstance(resp, dict):
        order_id = (
            resp.get("orderId")
            or resp.get("order_id")
            or resp.get("data", {}).get("orderId")
        )
        status = resp.get("orderStatus") or resp.get("status") or "UNKNOWN"

        # remarks can be a dict or a string — always normalise to string
        remarks = resp.get("remarks") or resp.get("message") or ""
        if isinstance(remarks, dict):
            remarks = remarks.get("error_message") or str(remarks)
        message = str(remarks)

        return {
            "order_id": str(order_id) if order_id else None,
            "status": status,
            "message": message,
        }
    return {"order_id": None, "status": "UNKNOWN", "message": str(resp)}


# ----------------------------- Positions ----------------------------------

def get_positions(client_id: str, access_token: str) -> list[dict[str, Any]]:
    """Retrieve all open positions from Dhan."""
    dhan = _get_dhan(client_id, access_token)
    try:
        resp = dhan.get_positions()
        if isinstance(resp, dict):
            positions = resp.get("data", [])
            if isinstance(positions, list):
                return positions
        return []
    except Exception:
        logger.exception("Failed to fetch positions")
        return []


def get_order_detail(
    client_id: str, access_token: str, order_id: str,
) -> dict[str, Any]:
    """Get detail/status of a specific order."""
    dhan = _get_dhan(client_id, access_token)
    try:
        resp = dhan.get_order_by_id(order_id)
        if isinstance(resp, dict):
            return resp.get("data", resp)
        return {}
    except Exception as exc:
        logger.exception("Failed to get order detail for %s", order_id)
        return {"error": str(exc)}


# ----------------------------- Square Off ---------------------------------

def square_off_all(client_id: str, access_token: str) -> dict[str, Any]:
    """
    Square off all open positions by placing opposite market orders.
    Also cancels any pending SL orders first.
    """
    dhan = _get_dhan(client_id, access_token)
    results: list[dict[str, Any]] = []

    try:
        # Cancel all pending orders first
        orders_resp = dhan.get_order_list()
        if isinstance(orders_resp, dict):
            orders = orders_resp.get("data", [])
            if isinstance(orders, list):
                for order in orders:
                    status = (order.get("orderStatus") or "").upper()
                    if status in ("PENDING", "TRANSIT", "TRIGGER_PENDING"):
                        try:
                            dhan.cancel_order(order["orderId"])
                            logger.info("Cancelled order %s", order["orderId"])
                        except Exception:
                            pass

        # Now square off positions
        positions = get_positions(client_id, access_token)
        for pos in positions:
            qty = pos.get("netQty") or (pos.get("buyQty", 0) - pos.get("sellQty", 0))
            if qty == 0:
                continue

            sec_id = pos.get("securityId") or pos.get("security_id")
            exchange = pos.get("exchangeSegment") or pos.get("exchange_segment", Dhan.FNO)
            txn_type = Dhan.BUY if qty < 0 else Dhan.SELL
            abs_qty = abs(qty)

            try:
                resp = dhan.place_order(
                    security_id=str(sec_id),
                    exchange_segment=exchange,
                    transaction_type=txn_type,
                    quantity=abs_qty,
                    order_type=Dhan.MARKET,
                    product_type=pos.get("productType", Dhan.INTRA),
                    price=0,
                )
                results.append(_parse_order_response(resp))
            except Exception as exc:
                results.append({"order_id": None, "status": "FAILED", "message": str(exc)})

        return {"success": True, "squared_off": len(results), "details": results}
    except Exception as exc:
        logger.exception("Square-off failed")
        return {"success": False, "error": str(exc)}
