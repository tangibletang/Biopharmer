"""
GET /api/prices/{ticker}

Daily adjusted closes: **Alpha Vantage** when ``ALPHA_VANTAGE_API_KEY`` is set,
else **Yahoo Finance** (yfinance).
"""

from fastapi import APIRouter, HTTPException, Query

from app.models import PricesResponse, StockPricePoint
from app.prices_provider import fetch_prices
from app.yahoo_prices import yahoo_symbol_for

router = APIRouter()

VALID = {"DYNE", "SRPT", "WVE"}

ALLOWED_PERIODS = frozenset({"1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "ytd", "max"})


@router.get("/prices/{ticker}", response_model=PricesResponse)
async def get_prices(
    ticker: str,
    period: str = Query(
        "2y",
        description="Lookback window for daily closes.",
    ),
):
    ticker = ticker.upper()
    if ticker not in VALID:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown ticker. Valid: {sorted(VALID)}",
        )
    if period not in ALLOWED_PERIODS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid period. Allowed: {sorted(ALLOWED_PERIODS)}",
        )

    try:
        rows, provider, currency = fetch_prices(ticker, period)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"Price fetch failed: {e!s}",
        ) from e

    if not rows:
        raise HTTPException(status_code=502, detail="Empty price series from provider.")

    sym = yahoo_symbol_for(ticker)
    src = "alpha_vantage" if provider == "alpha_vantage" else "yahoo_finance"

    return PricesResponse(
        ticker=ticker,
        yahoo_symbol=sym,
        provider=provider,
        source=src,
        interval="1d",
        period=period,
        currency=currency,
        prices=[StockPricePoint(**r) for r in rows],
    )
