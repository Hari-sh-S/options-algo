"""
Strategy engine — computes strikes and executes the three option-selling strategies.

Each strategy function:
  1. Reads live market data
  2. Determines the correct strikes
  3. Places SELL orders for both legs (live or paper)
  4. Returns structured results for the stop-loss manager
"""

from __future__ import annotations

import logging
from typing import Any

from .config import (
    EXCHANGE_SEGMENTS,
    LOT_SIZES,
    STRIKE_GAPS,
    IndexName,
    StrategyType,
)
from . import dhan_service
from . import paper_service

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public dispatcher
# ---------------------------------------------------------------------------

def execute_strategy(
    client_id: str,
    access_token: str,
    strategy: StrategyType,
    index: IndexName,
    expiry: str,
    lots: int,
    sl_percent: float,
    target_premium: float | None = None,
    spot_percent: float | None = None,
    mode: str = "live",
    uid: str = "",
) -> dict[str, Any]:
    """
    Dispatch to the appropriate strategy, execute orders, then hand off to
    the stop-loss manager.

    mode: "live" (real Dhan orders) or "paper" (simulated)
    """
    quantity = lots * LOT_SIZES[index]
    exchange_segment = EXCHANGE_SEGMENTS[index]
    is_paper = mode == "paper"

    logger.info(
        "Executing %s [%s] | index=%s expiry=%s lots=%d qty=%d sl=%.1f%%",
        strategy, mode.upper(), index, expiry, lots, quantity, sl_percent,
    )

    try:
        if strategy == StrategyType.SHORT_STRADDLE:
            result = _short_straddle(client_id, access_token, index, expiry, quantity, exchange_segment, is_paper, uid=uid)
        elif strategy == StrategyType.PREMIUM_BASED:
            if target_premium is None:
                return _error("target_premium is required for Premium Based strategy")
            result = _premium_based(client_id, access_token, index, expiry, quantity, exchange_segment, target_premium, is_paper, uid=uid)
        elif strategy == StrategyType.SPOT_STRANGLE:
            if spot_percent is None:
                return _error("spot_percent is required for Spot Based Strangle strategy")
            result = _spot_strangle(client_id, access_token, index, expiry, quantity, exchange_segment, spot_percent, is_paper, uid=uid)
        else:
            return _error(f"Unknown strategy: {strategy}")

        # Add metadata
        result["strategy"] = strategy.value
        result["index"] = index.value
        result["expiry"] = expiry
        result["quantity"] = quantity
        result["mode"] = mode

        # Place stop-loss orders if entry legs were successful
        if result.get("success") and sl_percent > 0:
            if is_paper:
                # Paper SL orders
                sl_result = []
                for leg in result.get("legs", []):
                    premium = leg.get("premium", 0) or 0
                    trigger = round(premium * (1 + sl_percent / 100), 2)
                    sl_resp = paper_service.place_sl_buy_order(
                        security_id=leg.get("security_id", ""),
                        exchange_segment=exchange_segment,
                        quantity=quantity,
                        trigger_price=trigger,
                        tag=f"sl_{leg.get('leg', '').lower()}",
                        uid=uid,
                    )
                    parsed = dhan_service._parse_order_response(sl_resp)
                    parsed["leg"] = f"SL-{leg.get('leg', '?')}"
                    parsed["strike"] = leg.get("strike", 0)
                    parsed["trigger_price"] = trigger
                    sl_result.append(parsed)
                result["sl_legs"] = sl_result
            else:
                from .stoploss_manager import place_stop_losses
                sl_result = place_stop_losses(
                    client_id=client_id,
                    access_token=access_token,
                    entry_legs=result.get("legs", []),
                    sl_percent=sl_percent,
                    quantity=quantity,
                    exchange_segment=exchange_segment,
                )
                result["sl_legs"] = sl_result

        return result

    except Exception as exc:
        logger.exception("Strategy execution failed")
        return _error(str(exc))


# ---------------------------------------------------------------------------
# Strategy implementations
# ---------------------------------------------------------------------------

def _short_straddle(
    client_id: str,
    access_token: str,
    index: IndexName,
    expiry: str,
    quantity: int,
    exchange_segment: str,
    is_paper: bool = False,
    uid: str = "",
) -> dict[str, Any]:
    """
    Short Straddle: Sell ATM CE + ATM PE at the same strike.
    """
    spot = dhan_service.get_spot_price(client_id, access_token, index)
    strike_gap = STRIKE_GAPS[index]
    atm_strike = round(spot / strike_gap) * strike_gap

    logger.info("Short Straddle: spot=%.2f, ATM strike=%d", spot, atm_strike)

    # Find security IDs from master
    ce_sec_id, pe_sec_id, ce_sym, pe_sym = _find_option_pair(index, expiry, atm_strike)

    # Fetch live LTPs for paper positions — single batch API call
    ce_ltp = 0.0
    pe_ltp = 0.0
    if is_paper:
        seg = EXCHANGE_SEGMENTS[index]
        ltps = dhan_service.fetch_ltps_batch(client_id, access_token, [int(ce_sec_id), int(pe_sec_id)], seg)
        ce_ltp = ltps.get(int(ce_sec_id), 0.0)
        pe_ltp = ltps.get(int(pe_sec_id), 0.0)
        logger.info("Paper straddle LTPs — CE: %.2f, PE: %.2f", ce_ltp, pe_ltp)

    legs = []

    # Sell CE
    if is_paper:
        ce_resp = dhan_service._parse_order_response(paper_service.place_sell_order(
            security_id=ce_sec_id, exchange_segment=exchange_segment, quantity=quantity, tag="straddle_ce", symbol=ce_sym, premium=ce_ltp, uid=uid,
        ))
    else:
        ce_resp = dhan_service.place_sell_order(
            client_id, access_token, ce_sec_id, exchange_segment, quantity, tag="straddle_ce"
        )
    legs.append({
        "leg": "CE",
        "strike": atm_strike,
        "security_id": ce_sec_id,
        "symbol": ce_sym,
        "order_id": ce_resp.get("order_id"),
        "status": ce_resp.get("status", "UNKNOWN"),
        "message": ce_resp.get("message", ""),
    })

    # Sell PE
    if is_paper:
        pe_resp = dhan_service._parse_order_response(paper_service.place_sell_order(
            security_id=pe_sec_id, exchange_segment=exchange_segment, quantity=quantity, tag="straddle_pe", symbol=pe_sym, premium=pe_ltp, uid=uid,
        ))
    else:
        pe_resp = dhan_service.place_sell_order(
            client_id, access_token, pe_sec_id, exchange_segment, quantity, tag="straddle_pe"
        )
    legs.append({
        "leg": "PE",
        "strike": atm_strike,
        "security_id": pe_sec_id,
        "symbol": pe_sym,
        "order_id": pe_resp.get("order_id"),
        "status": pe_resp.get("status", "UNKNOWN"),
        "message": pe_resp.get("message", ""),
    })

    success = all(l.get("order_id") for l in legs)
    return {"success": success, "legs": legs, "spot": spot}


def _premium_based(
    client_id: str,
    access_token: str,
    index: IndexName,
    expiry: str,
    quantity: int,
    exchange_segment: str,
    target_premium: float,
    is_paper: bool = False,
    uid: str = "",
) -> dict[str, Any]:
    """
    Premium Based: Scan the option chain and pick CE & PE whose LTP is
    closest to the target premium, then sell both.
    """
    chain = dhan_service.get_option_chain(client_id, access_token, index, expiry)

    if not chain:
        return _error("Option chain is empty — verify expiry and data")

    # Find CE closest to target premium
    best_ce = min(chain, key=lambda r: abs((r["ce_ltp"] or 9999) - target_premium))
    best_pe = min(chain, key=lambda r: abs((r["pe_ltp"] or 9999) - target_premium))

    logger.info(
        "Premium Based: target=%.2f | CE strike=%d ltp=%.2f | PE strike=%d ltp=%.2f",
        target_premium, best_ce["strike"], best_ce["ce_ltp"], best_pe["strike"], best_pe["pe_ltp"],
    )

    legs = []

    # Sell CE
    if is_paper:
        ce_resp = dhan_service._parse_order_response(paper_service.place_sell_order(
            security_id=best_ce["ce_security_id"], exchange_segment=exchange_segment, quantity=quantity,
            tag="premium_ce", symbol=best_ce.get("ce_symbol", ""), premium=best_ce["ce_ltp"], uid=uid,
        ))
    else:
        ce_resp = dhan_service.place_sell_order(
            client_id, access_token, best_ce["ce_security_id"], exchange_segment, quantity, tag="premium_ce"
        )
    legs.append({
        "leg": "CE",
        "strike": best_ce["strike"],
        "security_id": best_ce["ce_security_id"],
        "symbol": best_ce.get("ce_symbol", ""),
        "premium": best_ce["ce_ltp"],
        "order_id": ce_resp.get("order_id"),
        "status": ce_resp.get("status", "UNKNOWN"),
        "message": ce_resp.get("message", ""),
    })

    # Sell PE
    if is_paper:
        pe_resp = dhan_service._parse_order_response(paper_service.place_sell_order(
            security_id=best_pe["pe_security_id"], exchange_segment=exchange_segment, quantity=quantity,
            tag="premium_pe", symbol=best_pe.get("pe_symbol", ""), premium=best_pe["pe_ltp"], uid=uid,
        ))
    else:
        pe_resp = dhan_service.place_sell_order(
            client_id, access_token, best_pe["pe_security_id"], exchange_segment, quantity, tag="premium_pe"
        )
    legs.append({
        "leg": "PE",
        "strike": best_pe["strike"],
        "security_id": best_pe["pe_security_id"],
        "symbol": best_pe.get("pe_symbol", ""),
        "premium": best_pe["pe_ltp"],
        "order_id": pe_resp.get("order_id"),
        "status": pe_resp.get("status", "UNKNOWN"),
        "message": pe_resp.get("message", ""),
    })

    success = all(l.get("order_id") for l in legs)
    return {"success": success, "legs": legs, "target_premium": target_premium}


def _spot_strangle(
    client_id: str,
    access_token: str,
    index: IndexName,
    expiry: str,
    quantity: int,
    exchange_segment: str,
    spot_percent: float,
    is_paper: bool = False,
    uid: str = "",
) -> dict[str, Any]:
    """
    Spot Based Strangle: Select OTM strikes at ±X% from spot, then sell both.
    """
    spot = dhan_service.get_spot_price(client_id, access_token, index)
    strike_gap = STRIKE_GAPS[index]

    ce_target = spot * (1 + spot_percent / 100)
    pe_target = spot * (1 - spot_percent / 100)

    ce_strike = round(ce_target / strike_gap) * strike_gap
    pe_strike = round(pe_target / strike_gap) * strike_gap

    # Ensure they are OTM (CE above spot, PE below spot)
    if ce_strike <= spot:
        ce_strike += strike_gap
    if pe_strike >= spot:
        pe_strike -= strike_gap

    logger.info(
        "Spot Strangle: spot=%.2f, pct=%.1f%% | CE strike=%d, PE strike=%d",
        spot, spot_percent, ce_strike, pe_strike,
    )

    ce_sec_id, _, ce_sym, _ = _find_option_pair(index, expiry, ce_strike)
    _, pe_sec_id, _, pe_sym = _find_option_pair(index, expiry, pe_strike)

    # Fetch live LTPs for paper positions — single batch API call
    ce_ltp = 0.0
    pe_ltp = 0.0
    if is_paper:
        seg = EXCHANGE_SEGMENTS[index]
        ltps = dhan_service.fetch_ltps_batch(client_id, access_token, [int(ce_sec_id), int(pe_sec_id)], seg)
        ce_ltp = ltps.get(int(ce_sec_id), 0.0)
        pe_ltp = ltps.get(int(pe_sec_id), 0.0)
        logger.info("Paper strangle LTPs — CE: %.2f, PE: %.2f", ce_ltp, pe_ltp)

    legs = []

    # Sell OTM CE
    if is_paper:
        ce_resp = dhan_service._parse_order_response(paper_service.place_sell_order(
            security_id=ce_sec_id, exchange_segment=exchange_segment, quantity=quantity, tag="strangle_ce", symbol=ce_sym, premium=ce_ltp, uid=uid,
        ))
    else:
        ce_resp = dhan_service.place_sell_order(
            client_id, access_token, ce_sec_id, exchange_segment, quantity, tag="strangle_ce"
        )
    legs.append({
        "leg": "CE",
        "strike": ce_strike,
        "security_id": ce_sec_id,
        "symbol": ce_sym,
        "order_id": ce_resp.get("order_id"),
        "status": ce_resp.get("status", "UNKNOWN"),
        "message": ce_resp.get("message", ""),
    })

    # Sell OTM PE
    if is_paper:
        pe_resp = dhan_service._parse_order_response(paper_service.place_sell_order(
            security_id=pe_sec_id, exchange_segment=exchange_segment, quantity=quantity, tag="strangle_pe", symbol=pe_sym, premium=pe_ltp, uid=uid,
        ))
    else:
        pe_resp = dhan_service.place_sell_order(
            client_id, access_token, pe_sec_id, exchange_segment, quantity, tag="strangle_pe"
        )
    legs.append({
        "leg": "PE",
        "strike": pe_strike,
        "security_id": pe_sec_id,
        "symbol": pe_sym,
        "order_id": pe_resp.get("order_id"),
        "status": pe_resp.get("status", "UNKNOWN"),
        "message": pe_resp.get("message", ""),
    })

    success = all(l.get("order_id") for l in legs)
    return {"success": success, "legs": legs, "spot": spot, "spot_percent": spot_percent}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _find_option_pair(
    index: IndexName, expiry: str, strike: int
) -> tuple[str, str, str, str]:
    """
    Look up CE and PE security IDs for a given strike from the master data.

    Returns: (ce_security_id, pe_security_id, ce_symbol, pe_symbol)
    """
    import pandas as pd
    df = dhan_service._ensure_master()

    sym_prefix = "NIFTY" if index == IndexName.NIFTY else "SENSEX"

    exp_date = pd.to_datetime(expiry).date()

    mask = (
        df["SEM_TRADING_SYMBOL"].str.startswith(sym_prefix, na=False)
        & df["SEM_INSTRUMENT_NAME"].isin(["OPTIDX", "OPTSTK"])
    )
    filtered = df.loc[mask].copy()
    filtered["_exp"] = pd.to_datetime(filtered["SEM_EXPIRY_DATE"], errors="coerce").dt.date
    filtered["_strike"] = pd.to_numeric(filtered["SEM_STRIKE_PRICE"], errors="coerce")
    filtered = filtered[(filtered["_exp"] == exp_date) & (filtered["_strike"] == strike)]

    ce_rows = filtered[filtered["SEM_OPTION_TYPE"] == "CE"]
    pe_rows = filtered[filtered["SEM_OPTION_TYPE"] == "PE"]

    if ce_rows.empty or pe_rows.empty:
        raise ValueError(
            f"Could not find option instruments for {sym_prefix} {strike} expiry {expiry}"
        )

    ce_row = ce_rows.iloc[0]
    pe_row = pe_rows.iloc[0]

    return (
        str(int(ce_row["SEM_SMST_SECURITY_ID"])),
        str(int(pe_row["SEM_SMST_SECURITY_ID"])),
        str(ce_row.get("SEM_TRADING_SYMBOL", "")),
        str(pe_row.get("SEM_TRADING_SYMBOL", "")),
    )


def _error(msg: str) -> dict[str, Any]:
    return {"success": False, "error": msg, "legs": [], "sl_legs": []}
