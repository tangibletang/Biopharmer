import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agents.trading_agent import (
    TRADING_TICKERS,
    run_signal_analysis,
    run_with_execution,
)
from app.alpaca_client import AlpacaClient

router = APIRouter()
_alpaca = AlpacaClient()


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class SignalResult(BaseModel):
    ticker: str
    signal: str
    rsi: float
    ma20: float
    current_price: float
    avg_volume_20d: float
    today_volume: float
    catalyst_within_7d: bool
    rationale: str
    timestamp: str


class SignalsResponse(BaseModel):
    signals: list[SignalResult]


class ExecuteRequest(BaseModel):
    confirm: bool = False


class ExecuteResponse(BaseModel):
    ticker: str
    signal: str
    rationale: str
    status: str
    order_id: str | None = None
    notional: float | None = None
    message: str


class PortfolioPosition(BaseModel):
    symbol: str
    qty: float
    market_value: float
    avg_entry_price: float
    unrealized_pl: float
    unrealized_plpc: float
    current_price: float


class PortfolioResponse(BaseModel):
    portfolio_value: float
    cash: float
    positions: list[PortfolioPosition]
    recent_trades: list[dict]
    account_mode: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/trading/signals", response_model=SignalsResponse)
async def get_signals():
    """Run signal analysis for all trading tickers. No side effects."""
    try:
        results = await asyncio.gather(
            *[run_signal_analysis(t) for t in TRADING_TICKERS]
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    now = datetime.now(timezone.utc).isoformat()
    signals = [
        SignalResult(
            ticker=r["ticker"],
            signal=r["signal"],
            rsi=r["rsi"],
            ma20=r["ma20"],
            current_price=r["current_price"],
            avg_volume_20d=r["avg_volume_20d"],
            today_volume=r["today_volume"],
            catalyst_within_7d=r["catalyst_within_7d"],
            rationale=r["rationale"],
            timestamp=now,
        )
        for r in results
    ]
    return SignalsResponse(signals=signals)


@router.post("/trading/execute/{ticker}", response_model=ExecuteResponse)
async def execute_trade(ticker: str, body: ExecuteRequest):
    """Execute a trade for a single ticker. Requires confirm=true."""
    ticker = ticker.upper()
    if ticker not in TRADING_TICKERS:
        raise HTTPException(status_code=404, detail=f"Ticker {ticker} not in trading universe")

    if not body.confirm:
        # Dry run — return signal without placing an order
        result = await run_signal_analysis(ticker)
        return ExecuteResponse(
            ticker=ticker,
            signal=result["signal"],
            rationale=result["rationale"],
            status="dry_run",
            message="Set confirm=true to place a real order.",
        )

    try:
        result = await run_with_execution(ticker)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    exec_result = result.get("execute_result", {})
    signal = result["signal"]

    if signal == "HOLD" or exec_result.get("status") == "skipped":
        return ExecuteResponse(
            ticker=ticker,
            signal=signal,
            rationale=result["rationale"],
            status="skipped",
            message=exec_result.get("reason", "Signal is HOLD — no order placed."),
        )

    return ExecuteResponse(
        ticker=ticker,
        signal=signal,
        rationale=result["rationale"],
        status="executed",
        order_id=exec_result.get("id"),
        notional=exec_result.get("notional"),
        message=f"Order submitted: {signal} {ticker}",
    )


@router.get("/trading/portfolio", response_model=PortfolioResponse)
async def get_portfolio():
    """Return current Alpaca portfolio state."""
    try:
        data = _alpaca.get_portfolio()
        trades = _alpaca.get_recent_trades()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    positions = [PortfolioPosition(**p) for p in data["positions"]]
    return PortfolioResponse(
        portfolio_value=data["portfolio_value"],
        cash=data["cash"],
        positions=positions,
        recent_trades=trades,
        account_mode=data["account_mode"],
    )
