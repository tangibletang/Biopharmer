"""
POST /api/compare

Quick AI-powered side-by-side comparison of two DMD tickers.
Uses gpt-4o-mini for speed — distinct from the full War Room debate.
Returns headline, key_differences, and investment_angle.
"""

from __future__ import annotations

import json
import os

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.database import fetch_one
from app.models import CompareRequest, CompareResponse

load_dotenv()

router = APIRouter()

VALID_TICKERS = {"DYNE", "RNA", "SRPT", "WVE"}

_llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.2,
    api_key=os.environ["OPENAI_API_KEY"],
)


def _fetch_ticker_data(ticker: str) -> dict:
    row = fetch_one(
        """
        SELECT m.ticker, m.company_name,
               c.emax_pct, c.grade_3_ae_pct, c.approval_stage,
               c.mechanism_class, c.eligible_patient_pct, c.audit_text
        FROM dmd_mechanisms m
        JOIN clinical_metrics c ON c.ticker = m.ticker
        WHERE m.ticker = %s
        """,
        (ticker,),
    )
    if not row:
        raise HTTPException(status_code=404, detail=f"Ticker '{ticker}' not found.")
    return dict(row)


@router.post("/compare", response_model=CompareResponse)
async def quick_compare(body: CompareRequest):
    base = body.base_ticker.upper()
    comp = body.compare_ticker.upper()

    if base not in VALID_TICKERS:
        raise HTTPException(status_code=400, detail=f"Invalid base ticker: {base}")
    if comp not in VALID_TICKERS:
        raise HTTPException(status_code=400, detail=f"Invalid compare ticker: {comp}")
    if base == comp:
        raise HTTPException(status_code=400, detail="base_ticker and compare_ticker must differ.")

    base_data = _fetch_ticker_data(base)
    comp_data = _fetch_ticker_data(comp)

    schema = (
        '{"headline": "one sentence capturing the core investment distinction",'
        '"key_differences": ["3 specific factual differences that matter to an investor"],'
        '"investment_angle": "1-2 sentences on which investor profile each might suit and why"}'
    )

    def _fmt(d: dict) -> str:
        return (
            f"${d['ticker']} — {d['company_name']}\n"
            f"  Mechanism: {d['mechanism_class']} | Stage: {d['approval_stage']}\n"
            f"  Efficacy: {d['emax_pct']}% dystrophin | Safety: {d['grade_3_ae_pct']}% Grade 3+ AE\n"
            f"  Addressable patients: ~{d['eligible_patient_pct']}% of DMD\n"
            f"  Context: {(d['audit_text'] or '')[:450]}"
        )

    resp = _llm.invoke([
        SystemMessage(content=(
            "You are a biotech equity analyst. Compare two DMD programs directly from an "
            "investment perspective. Be factual and specific — cite actual numbers, mechanisms, "
            "and regulatory events. Do not use generic biotech commentary. "
            f"Return only a JSON object matching this schema:\n{schema}\n"
            "No markdown, no preamble, just the JSON."
        )),
        HumanMessage(content=(
            f"Program A:\n{_fmt(base_data)}\n\n"
            f"Program B:\n{_fmt(comp_data)}\n\n"
            "Generate the comparison JSON."
        )),
    ])

    raw = resp.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = {
            "headline": raw[:200],
            "key_differences": [],
            "investment_angle": "",
        }

    return CompareResponse(
        headline=str(parsed.get("headline", "")),
        key_differences=parsed.get("key_differences", []) if isinstance(parsed.get("key_differences"), list) else [],
        investment_angle=str(parsed.get("investment_angle", "")),
    )
