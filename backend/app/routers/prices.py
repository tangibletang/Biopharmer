"""
GET /api/prices/{ticker}

Daily adjusted closes from Yahoo Finance (yfinance). For use by the Timeline chart.
"""

from fastapi import APIRouter, HTTPException, Query

from app.models import PricesResponse, StockPricePoint
from app.yahoo_prices import fetch_daily_closes, fetch_info_currency, yahoo_symbol_for

router = APIRouter()

VALID = {"DYNE", "RNA", "SRPT", "WVE"}

# yfinance history ``period`` values we expose (daily bars)
ALLOWED_PERIODS = frozenset({"3mo", "6mo", "1y", "2y", "5y", "ytd", "max"})


@router.get("/prices/{ticker}", response_model=PricesResponse)
async def get_prices(
    ticker: str,
    period: str = Query(
        "2y",
        description="Lookback window for daily closes (Yahoo/yfinance).",
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
    ysym = yahoo_symbol_for(ticker)
    try:
        rows = fetch_daily_closes(ysym, period=period)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"Yahoo Finance fetch failed: {e!s}",
        ) from e

    if not rows:
        raise HTTPException(status_code=502, detail="Empty price series from provider.")

    currency = fetch_info_currency(ysym)

    return PricesResponse(
        ticker=ticker,
        yahoo_symbol=ysym,
        source="yahoo_finance",
        interval="1d",
        period=period,
        currency=currency,
        prices=[StockPricePoint(**r) for r in rows],
    )
