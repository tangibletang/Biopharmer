"""
Iterative War Room endpoints.

POST /api/diligence/start   — Start a new debate thread
POST /api/diligence/resume  — Resume a paused thread with a human directive
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException

from app.agents.iterative_war_room import USER_PERSONAS, resume_war_room, start_war_room
from app.models import (
    SynthesisOutput,
    TranscriptMessage,
    WarRoomResponse,
    WarRoomResumeRequest,
    WarRoomStartRequest,
)

router = APIRouter()

VALID_TICKERS = {"DYNE", "RNA", "SRPT", "WVE"}


def _coerce_response(raw: dict) -> WarRoomResponse:
    """Convert the raw state dict from the graph into a validated response model."""
    synthesis = None
    if raw.get("synthesis"):
        s = raw["synthesis"]
        synthesis = SynthesisOutput(
            research_summary=str(s.get("research_summary", "")),
            key_findings=s.get("key_findings") if isinstance(s.get("key_findings"), list) else [],
            investor_considerations=s.get("investor_considerations") if isinstance(s.get("investor_considerations"), list) else [],
            watch_list=str(s.get("watch_list", "")),
        )

    transcript = [
        TranscriptMessage(
            role=m.get("role", ""),
            agent=m.get("agent", ""),
            content=m.get("content", ""),
            iteration=m.get("iteration", 0),
        )
        for m in raw.get("transcript", [])
    ]

    return WarRoomResponse(
        thread_id=raw["thread_id"],
        status=raw["status"],
        ticker=raw["ticker"],
        iterations_completed=raw["iterations_completed"],
        max_iterations=raw["max_iterations"],
        transcript=transcript,
        suggested_directions=raw.get("suggested_directions", []),
        interim_summary=raw.get("interim_summary", ""),
        synthesis=synthesis,
    )


@router.get("/diligence/personas")
async def get_personas():
    """Return the available user personas for the war room."""
    return {"personas": USER_PERSONAS}


@router.post("/diligence/start", response_model=WarRoomResponse)
async def start_diligence(body: WarRoomStartRequest):
    ticker = body.ticker.upper()
    if ticker not in VALID_TICKERS:
        raise HTTPException(
            status_code=404,
            detail=f"Ticker '{ticker}' not in DMD micro-universe. Valid: {sorted(VALID_TICKERS)}",
        )

    thread_id = str(uuid.uuid4())
    try:
        raw = await start_war_room(
            ticker=ticker,
            user_focus=body.user_focus,
            thread_id=thread_id,
            user_persona=body.user_persona,
            max_iterations=body.max_iterations,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return _coerce_response(raw)


@router.post("/diligence/resume", response_model=WarRoomResponse)
async def resume_diligence(body: WarRoomResumeRequest):
    if not body.thread_id:
        raise HTTPException(status_code=400, detail="thread_id is required.")
    try:
        raw = await resume_war_room(
            thread_id=body.thread_id,
            human_directive=body.human_directive,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return _coerce_response(raw)
