"""
POST /api/milestone/analyze

Single-shot gpt-4o call that explains a milestone event in the context of
the ticker's mechanism, full trial history, and pgvector peers.
Returns explanation, severity rating, and peer precedent.
"""

from __future__ import annotations

import json
import os
from datetime import date

from fastapi import APIRouter, HTTPException
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel

from app.agents.war_room import search_scientific_peers
from app.database import fetch_one

router = APIRouter()

_llm = ChatOpenAI(
    model="gpt-4o",
    temperature=0.2,
    api_key=os.environ["OPENAI_API_KEY"],
)

VALID_TICKERS = {"DYNE", "RNA", "SRPT", "WVE"}


# ── Request / Response ─────────────────────────────────────────────────────────

class MilestoneAnalyzeRequest(BaseModel):
    ticker: str
    label: str
    date: str
    detail: str
    type: str      # positive | negative | neutral
    category: str  # historical | projected


class MilestoneAnalysis(BaseModel):
    explanation: str        # what this event means mechanistically and commercially
    severity: str           # Critical | Meaningful | Noise
    severity_rationale: str # one sentence
    peer_precedent: str     # what happened at closest peer in a similar event


# ── Endpoint ───────────────────────────────────────────────────────────────────

@router.post("/milestone/analyze", response_model=MilestoneAnalysis)
async def analyze_milestone(body: MilestoneAnalyzeRequest):
    ticker = body.ticker.upper()
    if ticker not in VALID_TICKERS:
        raise HTTPException(
            status_code=404,
            detail=f"Ticker '{ticker}' not in DMD micro-universe.",
        )

    # Load context — degrade gracefully if DB is unavailable
    try:
        row = fetch_one(
            "SELECT mechanism_text, company_name FROM dmd_mechanisms WHERE ticker = %s",
            (ticker,),
        )
    except Exception:
        row = None
    mechanism_text = row["mechanism_text"] if row else "Mechanism unknown."
    company_name = row["company_name"] if row else ticker

    try:
        clinical = fetch_one(
            "SELECT audit_text FROM clinical_metrics WHERE ticker = %s",
            (ticker,),
        )
    except Exception:
        clinical = None
    audit_text = (clinical["audit_text"] if clinical else "") or ""

    try:
        peers = search_scientific_peers(ticker)
    except Exception:
        peers = []
    peers_block = "\n".join(
        f"  • {p['ticker']} ({p['company_name']}): similarity={float(p['similarity']):.3f}, "
        f"Emax={p['emax_pct']}%, Grade3+AE={p['grade_3_ae_pct']}%, "
        f"history: {str(p.get('audit_text', ''))[:200]}"
        for p in peers
    ) or "  (none)"

    today = date.today().isoformat()
    schema = (
        '{"explanation":"str","severity":"Critical|Meaningful|Noise",'
        '"severity_rationale":"str","peer_precedent":"str"}'
    )

    resp = _llm.invoke([
        SystemMessage(content=(
            f"Today is {today}. You are a senior biotech investment analyst. "
            "Analyze a single clinical or regulatory milestone for a DMD drug program. "
            "Return only valid JSON matching this schema exactly — no markdown, no code fences:\n"
            f"{schema}\n\n"
            "Severity definitions:\n"
            "  Critical  — program-defining event, likely moves stock >15%\n"
            "  Meaningful — changes program trajectory but not existential\n"
            "  Noise      — routine update, market likely already pricing in\n\n"
            "For peer_precedent: cite what happened at a peer company (from the peer data provided) "
            "when a mechanistically or regulatorily similar event occurred. "
            "If no direct precedent exists, write exactly: No direct precedent in this peer set."
        )),
        HumanMessage(content=(
            f"Company: {company_name} (${ticker})\n"
            f"Milestone: {body.label}\n"
            f"Date: {body.date} | Type: {body.type} | Category: {body.category}\n"
            f"Detail: {body.detail}\n\n"
            f"Drug mechanism:\n{mechanism_text}\n\n"
            f"Full trial & regulatory history:\n{audit_text}\n\n"
            f"Closest scientific peers:\n{peers_block}\n\n"
            "Analyze this milestone."
        )),
    ])

    raw = resp.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="LLM returned unparseable JSON.")

    return MilestoneAnalysis(
        explanation=str(data.get("explanation", "")),
        severity=str(data.get("severity", "Meaningful")),
        severity_rationale=str(data.get("severity_rationale", "")),
        peer_precedent=str(data.get("peer_precedent", "")),
    )
