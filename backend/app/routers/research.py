"""
POST /api/research/sessions — start Option A parallel ideation run (background).
GET  /api/research/sessions/{id} — poll session + threads + messages.
"""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.agents.research_ideation import run_pipeline
from app import research_db
from app.models import ResearchSessionCreate, ResearchSessionCreateResponse, ResearchSessionDetail

router = APIRouter()


def _run_pipeline_sync(session_id: str) -> None:
    asyncio.run(run_pipeline(session_id))


@router.post("/research/sessions", response_model=ResearchSessionCreateResponse)
async def create_research_session(
    body: ResearchSessionCreate,
    background_tasks: BackgroundTasks,
):
    config = {
        "parallelism": body.parallelism,
        "max_rounds": body.max_rounds,
    }
    q = body.question.strip()
    sid = research_db.create_session(q, config)
    background_tasks.add_task(_run_pipeline_sync, sid)
    return ResearchSessionCreateResponse(id=sid, status="pending")


@router.get("/research/sessions/{session_id}", response_model=ResearchSessionDetail)
async def get_research_session(session_id: str):
    detail = research_db.get_session_detail(session_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Session not found.")
    # Normalize for Pydantic (UUID / datetimes already JSON-friendly via FastAPI)
    return ResearchSessionDetail.model_validate(_detail_to_response(detail))


def _detail_to_response(detail: dict) -> dict:
    """Ensure final_output and config are dicts; normalize message metadata."""
    import json

    out = dict(detail)
    fo = out.get("final_output")
    if isinstance(fo, str):
        try:
            out["final_output"] = json.loads(fo)
        except json.JSONDecodeError:
            out["final_output"] = None
    cfg = out.get("config")
    if isinstance(cfg, str):
        out["config"] = json.loads(cfg)
    if out.get("config") is None:
        out["config"] = {}
    for t in out.get("threads") or []:
        for m in t.get("messages") or []:
            if m.get("metadata") is None:
                m["metadata"] = {}
    return out
