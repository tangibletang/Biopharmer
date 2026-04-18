"""
Fetch historical OHLC from Yahoo Finance via yfinance (unofficial; no API key).

Maps in-app micro-universe tickers to Yahoo symbols where they differ.
"""

from __future__ import annotations

from typing import Any

# In-app key → Yahoo Finance symbol (official listing)
YAHOO_SYMBOLS: dict[str, str] = {
    # Dyne Therapeutics trades as DYN on Nasdaq; DYNE returns no series on Yahoo.
    "DYNE": "DYN",
    # Avidity Biosciences trades as RNA on NASDAQ — no remapping needed.
    "RNA": "RNA",
    "SRPT": "SRPT",
    "WVE": "WVE",
    # Neurology
    "BIIB": "BIIB",
    "NVS":  "NVS",
    "ABBV": "ABBV",
    # Oncology
    "MRK": "MRK",
    "AZN": "AZN",
    # Cardiometabolic
    "LLY": "LLY",
    "NVO": "NVO",
}

# Intraday interval per short period
_INTRADAY_INTERVAL: dict[str, str] = {
    "1d": "5m",
    "5d": "1h",
}


def yahoo_symbol_for(ticker: str) -> str:
    """Return the Yahoo Finance symbol for a ticker; falls back to the ticker itself."""
    t = ticker.upper()
    return YAHOO_SYMBOLS.get(t, t)


def fetch_daily_closes(yahoo_symbol: str, *, period: str = "2y") -> list[dict[str, Any]]:
    """
    Price series for the given period.
    Short periods (1d, 5d) use intraday intervals; all others use daily closes.
    Date strings: "YYYY-MM-DD" for daily, "YYYY-MM-DD HH:MM" for intraday.
    """
    import yfinance as yf

    interval = _INTRADAY_INTERVAL.get(period, "1d")
    t = yf.Ticker(yahoo_symbol)
    hist = t.history(period=period, interval=interval, auto_adjust=True)
    if hist.empty:
        raise ValueError(f"No price history returned for {yahoo_symbol}")

    out: list[dict[str, Any]] = []
    for idx, row in hist.iterrows():
        if hasattr(idx, "strftime"):
            d = idx.strftime("%Y-%m-%d %H:%M") if interval != "1d" else idx.strftime("%Y-%m-%d")
        else:
            d = str(idx)[:16] if interval != "1d" else str(idx)[:10]
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
