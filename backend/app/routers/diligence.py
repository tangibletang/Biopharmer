"""
GET /api/diligence/{ticker}

Parallel investment War Room: mechanism + clinical + peers → N explorer branches,
each critiqued, then merged into bull/bear + ranked directions.
"""

from fastapi import APIRouter, HTTPException, Query

from app.agents.ticker_war_room import run_ticker_war_room
from app.models import (
    DiligenceResponse,
    DiligenceStep,
    ParallelBranch,
    RankedDirectionItem,
    SynthesisOutput,
)

router = APIRouter()

VALID_TICKERS = {"DYNE", "RNA", "SRPT", "WVE"}


@router.get("/diligence/{ticker}", response_model=DiligenceResponse)
async def get_diligence(
    ticker: str,
    parallelism: int = Query(3, ge=1, le=5, description="Number of parallel explorer–critic branches"),
):
    ticker = ticker.upper()

    if ticker not in VALID_TICKERS:
        raise HTTPException(
            status_code=404,
            detail=f"Ticker '{ticker}' not in DMD micro-universe. Valid tickers: {sorted(VALID_TICKERS)}",
        )

    result = await run_ticker_war_room(ticker, parallelism=parallelism)
    merged = result["merged"]
    branches_raw = result["parallel_branches"]

    synthesis = SynthesisOutput(
        bull_case=str(merged.get("bull_case", "")),
        bear_case=str(merged.get("bear_case", "")),
        actionable_metric=str(merged.get("actionable_metric", "")),
    )

    ranked_raw = merged.get("ranked_directions") or []
    ranked: list[RankedDirectionItem] = []
    for i, r in enumerate(ranked_raw):
        if not isinstance(r, dict):
            continue
        ranked.append(
            RankedDirectionItem(
                rank=int(r.get("rank", i + 1)),
                title=str(r.get("title", "")),
                rationale=str(r.get("rationale", "")),
                key_risks=str(r.get("key_risks", "")),
                next_step=str(r.get("next_step", "")),
            )
        )

    steps = [
        DiligenceStep(
            step="parallel_war_room",
            status="complete",
            output=(
                f"Parallel stock diligence for ${ticker}: {len(branches_raw)} investment angles "
                "with explorer → critic rounds, grounded in your mechanism text, clinical metrics, "
                "and pgvector peer matches."
            ),
        ),
    ]

    return DiligenceResponse(
        ticker=ticker,
        steps=steps,
        synthesis=synthesis,
        parallel_branches=[ParallelBranch(**b) for b in branches_raw],
        ranked_directions=ranked,
        synthesis_note=merged.get("synthesis_note") if isinstance(merged.get("synthesis_note"), str) else None,
    )
