"""
Resolve daily prices: prefer Alpha Vantage when ``ALPHA_VANTAGE_API_KEY`` is set,
otherwise Yahoo Finance (yfinance). Same US listing symbols for both.

Free Alpha Vantage keys only return ~100 trading days (compact). For longer
``period`` values we use Yahoo so the chart matches the requested window.
"""

from __future__ import annotations

import logging
import os
from typing import Any

from app.alpha_vantage_prices import (
    compact_covers_period,
    fetch_daily_compact,
    filter_by_period,
)
from app.yahoo_prices import fetch_daily_closes, fetch_info_currency, yahoo_symbol_for

log = logging.getLogger(__name__)


def fetch_prices(
    ticker: str,
    period: str,
) -> tuple[list[dict[str, Any]], str, str | None]:
    """
    Returns (price rows, provider_id, currency).

    provider_id: ``alpha_vantage`` | ``yahoo_finance``
    """
    sym = yahoo_symbol_for(ticker)
    key = (os.environ.get("ALPHA_VANTAGE_API_KEY") or "").strip()

    if key:
        try:
            full = fetch_daily_compact(sym, key)
            if compact_covers_period(full, period):
                rows = filter_by_period(full, period)
                if rows:
                    return rows, "alpha_vantage", "USD"
            log.info(
                "Alpha Vantage compact history too short for period=%s (%s), using Yahoo",
                period,
                sym,
            )
        except Exception as e:  # noqa: BLE001
            log.warning("Alpha Vantage failed for %s, falling back to Yahoo: %s", sym, e)

    rows = fetch_daily_closes(sym, period=period)
    currency = fetch_info_currency(sym)
    return rows, "yahoo_finance", currency
