"""
GET /api/diligence/{ticker}

Triggers the LangGraph Multi-Agent War Room for the given ticker.
Returns each agent's step output plus the Synthesizer's final JSON.
"""

from fastapi import APIRouter, HTTPException

from app.agents.war_room import run_war_room
from app.models import DiligenceResponse, DiligenceStep, SynthesisOutput

router = APIRouter()

VALID_TICKERS = {"DYNE", "RNA", "SRPT", "WVE"}


@router.get("/diligence/{ticker}", response_model=DiligenceResponse)
async def get_diligence(ticker: str):
    ticker = ticker.upper()

    if ticker not in VALID_TICKERS:
        raise HTTPException(
            status_code=404,
            detail=f"Ticker '{ticker}' not in DMD micro-universe. Valid tickers: {sorted(VALID_TICKERS)}",
        )

    final_state = await run_war_room(ticker)

    steps = [
        DiligenceStep(
            step="biologist",
            status="complete",
            output=final_state.get("biologist_analysis", ""),
        ),
        DiligenceStep(
            step="toxicologist",
            status="complete",
            output=final_state.get("toxicologist_challenge", ""),
        ),
        DiligenceStep(
            step="synthesizer",
            status="complete",
            output="Synthesis complete — see structured output below.",
        ),
    ]

    raw_synthesis = final_state.get("synthesis", {})
    synthesis = SynthesisOutput(
        bull_case=raw_synthesis.get("bull_case", ""),
        bear_case=raw_synthesis.get("bear_case", ""),
        actionable_metric=raw_synthesis.get("actionable_metric", ""),
    )

    return DiligenceResponse(ticker=ticker, steps=steps, synthesis=synthesis)
