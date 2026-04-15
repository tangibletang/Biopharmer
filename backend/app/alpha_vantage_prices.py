"""
Daily closes from Alpha Vantage (official HTTP API).

Free API keys only support ``TIME_SERIES_DAILY`` with ``outputsize=compact``
(~100 trading days). ``TIME_SERIES_DAILY_ADJUSTED`` and ``outputsize=full``
are premium — see https://www.alphavantage.co/documentation/

Use ``ALPHA_VANTAGE_API_KEY`` in .env; callers should fall back to Yahoo when
history is shorter than the requested period or on error.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any

import httpx

log = logging.getLogger(__name__)

AV_URL = "https://www.alphavantage.co/query"


def fetch_daily_compact(symbol: str, api_key: str) -> list[dict[str, Any]]:
    """
    Last ~100 trading days (free tier). ``TIME_SERIES_DAILY`` + ``compact``.
    """
    r = httpx.get(
        AV_URL,
        params={
            "function": "TIME_SERIES_DAILY",
            "symbol": symbol,
            "outputsize": "compact",
            "apikey": api_key,
        },
        timeout=60.0,
    )
    r.raise_for_status()
    data = r.json()

    if err := data.get("Error Message"):
        raise ValueError(f"Alpha Vantage: {err}")
    if note := data.get("Note"):
        raise ValueError(f"Alpha Vantage rate limit or throttle: {note}")
    if info := data.get("Information"):
        raise ValueError(f"Alpha Vantage: {info}")

    series = data.get("Time Series (Daily)")
    if not series:
        raise ValueError(f"Alpha Vantage: no time series in response (keys={list(data.keys())})")

    rows: list[dict[str, Any]] = []
    for date_str in sorted(series.keys()):
        ohlc = series[date_str]
        close = ohlc.get("4. close") or ohlc.get("1. open")
        rows.append({"date": date_str, "price": round(float(close), 4)})
    return rows


def filter_by_period(rows: list[dict[str, Any]], period: str) -> list[dict[str, Any]]:
    """Trim sorted-ascending rows to the requested lookback."""
    if not rows or period == "max":
        return rows

    today = date.today()
    if period == "ytd":
        cutoff = date(today.year, 1, 1)
    else:
        days_map = {
            "3mo": 92,
            "6mo": 183,
            "1y": 365,
            "2y": 730,
            "5y": 1825,
        }
        if period not in days_map:
            return rows
        cutoff = today - timedelta(days=days_map[period])

    cutoff_s = cutoff.isoformat()
    return [r for r in rows if r["date"] >= cutoff_s]


def period_earliest_needed_iso(period: str) -> str | None:
    """
    First calendar date we need history for. None means “long history” (e.g. max)
    which free-tier compact cannot satisfy.
    """
    today = date.today()
    if period == "max":
        return None
    if period == "ytd":
        return date(today.year, 1, 1).isoformat()
    days_map = {
        "3mo": 92,
        "6mo": 183,
        "1y": 365,
        "2y": 730,
        "5y": 1825,
    }
    if period not in days_map:
        return None
    return (today - timedelta(days=days_map[period])).isoformat()


def compact_covers_period(rows: list[dict[str, Any]], period: str) -> bool:
    """True if the series starts on or before the lookback start (full window)."""
    if not rows:
        return False
    need_from = period_earliest_needed_iso(period)
    if need_from is None:
        return False
    return rows[0]["date"] <= need_from
