from __future__ import annotations

import os
from datetime import date, datetime, timedelta
from typing import TypedDict

import pandas as pd
import yfinance as yf
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph

from app.alpaca_client import AlpacaClient
from app.database import fetch_one

load_dotenv()

_llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.2,
    api_key=os.environ["OPENAI_API_KEY"],
)

_alpaca = AlpacaClient()

# Ticker mapping: internal key → Yahoo Finance symbol → Alpaca symbol
TRADING_TICKERS = ["DYNE", "SRPT", "WVE"]
YAHOO_SYMBOL_MAP = {"DYNE": "DYN", "SRPT": "SRPT", "WVE": "WVE"}
ALPACA_SYMBOL_MAP = {"DYNE": "DYN", "SRPT": "SRPT", "WVE": "WVE"}

# $20 budget split across 3 tickers
NOTIONAL_PER_TICKER = 6.50


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

class TradingAgentState(TypedDict):
    ticker: str
    prices: list[float]
    volumes: list[float]
    current_price: float
    rsi: float
    ma20: float
    avg_volume_20d: float
    today_volume: float
    catalyst_within_7d: bool
    catalyst_text: str
    signal: str               # BUY | SELL | HOLD
    rationale: str
    execute: bool
    execute_result: dict


# ---------------------------------------------------------------------------
# Node: fetch_prices
# ---------------------------------------------------------------------------

def fetch_prices(state: TradingAgentState) -> dict:
    yahoo_sym = YAHOO_SYMBOL_MAP.get(state["ticker"], state["ticker"])
    hist = yf.Ticker(yahoo_sym).history(period="3mo")
    closes = hist["Close"].tolist()
    volumes = hist["Volume"].tolist()
    current_price = closes[-1] if closes else 0.0
    return {
        "prices": closes,
        "volumes": volumes,
        "current_price": round(current_price, 4),
    }


# ---------------------------------------------------------------------------
# Node: compute_signals
# ---------------------------------------------------------------------------

def compute_signals(state: TradingAgentState) -> dict:
    prices = state["prices"]
    volumes = state["volumes"]

    if len(prices) < 21:
        return {"rsi": 50.0, "ma20": 0.0, "avg_volume_20d": 0.0,
                "today_volume": 0.0, "signal": "HOLD"}

    series = pd.Series(prices)
    delta = series.diff()
    gains = delta.clip(lower=0).rolling(14).mean()
    losses = (-delta.clip(upper=0)).rolling(14).mean()
    rs = gains / losses.replace(0, float("nan"))
    rsi_series = 100 - (100 / (1 + rs))
    rsi = round(float(rsi_series.iloc[-1]), 2)

    ma20 = round(float(series.tail(20).mean()), 4)

    vol_series = pd.Series(volumes)
    avg_vol_20d = float(vol_series.tail(20).mean())
    today_vol = float(vol_series.iloc[-1])

    current = state["current_price"]
    volume_surge = today_vol > 1.5 * avg_vol_20d

    if rsi < 40 and volume_surge:
        signal = "BUY"
    elif rsi > 60 or current < ma20 * 0.92:
        signal = "SELL"
    else:
        signal = "HOLD"

    return {
        "rsi": rsi,
        "ma20": ma20,
        "avg_volume_20d": round(avg_vol_20d, 0),
        "today_volume": round(today_vol, 0),
        "signal": signal,
    }


# ---------------------------------------------------------------------------
# Node: scan_catalysts
# ---------------------------------------------------------------------------

def scan_catalysts(state: TradingAgentState) -> dict:
    row = fetch_one(
        "SELECT audit_text FROM clinical_metrics WHERE ticker = %s",
        (state["ticker"],),
    )
    audit = row["audit_text"] if row else ""

    # Simple heuristic: look for forward-looking date keywords in audit text
    today = date.today()
    horizon = today + timedelta(days=7)
    catalyst_within_7d = False

    keywords = ["upcoming", "expected", "anticipated", "readout", "decision",
                "pdufa", "nda", "bla", "phase 3 results", "interim"]
    audit_lower = audit.lower()
    has_keyword = any(kw in audit_lower for kw in keywords)

    # If audit mentions near-term event and signal is HOLD → upgrade to BUY
    signal = state["signal"]
    if has_keyword and signal == "HOLD":
        catalyst_within_7d = True
        signal = "BUY"

    return {
        "catalyst_within_7d": catalyst_within_7d,
        "catalyst_text": audit[:500] if audit else "",
        "signal": signal,
    }


# ---------------------------------------------------------------------------
# Node: trading_advisor
# ---------------------------------------------------------------------------

async def trading_advisor(state: TradingAgentState) -> dict:
    ticker = state["ticker"]
    today = date.today().isoformat()

    prompt = (
        f"Ticker: {ticker} | Date: {today}\n"
        f"Signal: {state['signal']}\n"
        f"RSI(14): {state['rsi']} | 20d MA: ${state['ma20']:.2f} | "
        f"Price: ${state['current_price']:.2f}\n"
        f"Volume today: {state['today_volume']:,.0f} vs 20d avg: {state['avg_volume_20d']:,.0f}\n"
        f"Catalyst context: {state['catalyst_text'] or 'None available'}\n\n"
        "Write exactly 2 sentences of rationale for this recommendation.\n"
        "Sentence 1: explain the technical setup (RSI, volume, price vs MA).\n"
        "Sentence 2: reference one specific clinical catalyst or risk from the context."
    )

    response = await _llm.ainvoke([
        SystemMessage(content=(
            "You are a quantitative biotech trader. Be precise and brief. "
            "No disclaimers. No markdown. Plain text only."
        )),
        HumanMessage(content=prompt),
    ])

    return {"rationale": response.content.strip()}


# ---------------------------------------------------------------------------
# Node: execute_order
# ---------------------------------------------------------------------------

def execute_order(state: TradingAgentState) -> dict:
    if not state.get("execute"):
        return {"execute_result": {}}

    signal = state["signal"]
    if signal == "HOLD":
        return {"execute_result": {"status": "skipped", "reason": "signal is HOLD"}}

    alpaca_sym = ALPACA_SYMBOL_MAP.get(state["ticker"], state["ticker"])

    if signal == "BUY":
        fractionable = _alpaca.is_fractionable(alpaca_sym)
        if fractionable:
            result = _alpaca.submit_order(alpaca_sym, "buy", NOTIONAL_PER_TICKER)
        else:
            result = _alpaca.submit_order_qty(alpaca_sym, "buy", 1)
        return {"execute_result": result}

    if signal == "SELL":
        position = _alpaca.get_position(alpaca_sym)
        if not position:
            return {"execute_result": {"status": "skipped", "reason": "no open position"}}
        qty = float(position["qty"])
        result = _alpaca.submit_order_qty(alpaca_sym, "sell", qty)
        return {"execute_result": result}

    return {"execute_result": {}}


# ---------------------------------------------------------------------------
# Graph assembly
# ---------------------------------------------------------------------------

def _build_trading_graph():
    graph = StateGraph(TradingAgentState)

    graph.add_node("fetch_prices", fetch_prices)
    graph.add_node("compute_signals", compute_signals)
    graph.add_node("scan_catalysts", scan_catalysts)
    graph.add_node("trading_advisor", trading_advisor)
    graph.add_node("execute_order", execute_order)

    graph.set_entry_point("fetch_prices")
    graph.add_edge("fetch_prices", "compute_signals")
    graph.add_edge("compute_signals", "scan_catalysts")
    graph.add_edge("scan_catalysts", "trading_advisor")
    graph.add_edge("trading_advisor", "execute_order")
    graph.add_edge("execute_order", END)

    return graph.compile()


_trading_graph = _build_trading_graph()


def _initial_state(ticker: str, execute: bool = False) -> TradingAgentState:
    return TradingAgentState(
        ticker=ticker.upper(),
        prices=[],
        volumes=[],
        current_price=0.0,
        rsi=50.0,
        ma20=0.0,
        avg_volume_20d=0.0,
        today_volume=0.0,
        catalyst_within_7d=False,
        catalyst_text="",
        signal="HOLD",
        rationale="",
        execute=execute,
        execute_result={},
    )


async def run_signal_analysis(ticker: str) -> dict:
    state = await _trading_graph.ainvoke(_initial_state(ticker, execute=False))
    return dict(state)


async def run_with_execution(ticker: str) -> dict:
    state = await _trading_graph.ainvoke(_initial_state(ticker, execute=True))
    return dict(state)
