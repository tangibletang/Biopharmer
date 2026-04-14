"""
Fetch historical OHLC from Yahoo Finance via yfinance (unofficial; no API key).

Maps in-app micro-universe tickers to Yahoo symbols where they differ.
"""

from __future__ import annotations

from typing import Any

# In-app key → Yahoo Finance symbol (official listing)
YAHOO_SYMBOLS: dict[str, str] = {
    "DYNE": "DYNE",
    # Avidity Biosciences trades under AVDL (NASDAQ); "RNA" is the in-app shorthand.
    "RNA": "AVDL",
    "SRPT": "SRPT",
    "WVE": "WVE",
}


def yahoo_symbol_for(ticker: str) -> str:
    t = ticker.upper()
    if t not in YAHOO_SYMBOLS:
        raise KeyError(t)
    return YAHOO_SYMBOLS[t]


def fetch_daily_closes(yahoo_symbol: str, *, period: str = "2y") -> list[dict[str, Any]]:
    """
    Daily adjusted close series. ``period`` is yfinance-compatible: 1d,5d,1mo,3mo,6mo,1y,2y,5y,ytd,max
    """
    import yfinance as yf

    t = yf.Ticker(yahoo_symbol)
    hist = t.history(period=period, interval="1d", auto_adjust=True)
    if hist.empty:
        raise ValueError(f"No price history returned for {yahoo_symbol}")

    out: list[dict[str, Any]] = []
    for idx, row in hist.iterrows():
        d = idx.strftime("%Y-%m-%d") if hasattr(idx, "strftime") else str(idx)[:10]
        close = float(row["Close"])
        out.append({"date": d, "price": round(close, 4)})
    return out


def fetch_info_currency(yahoo_symbol: str) -> str | None:
    try:
        import yfinance as yf

        info = yf.Ticker(yahoo_symbol).info
        c = info.get("currency")
        return str(c) if c else None
    except Exception:  # noqa: BLE001
        return None
