"""
GET /api/universe

Returns all DMD micro-universe tickers with their full clinical snapshots.
Used by the proximity map scatter plot — no similarity scoring, just raw data.
"""

from fastapi import APIRouter, HTTPException

from app.database import fetch_all
from app.models import ClinicalSnapshot, UniverseResponse, UniverseTicker

router = APIRouter()


@router.get("/universe", response_model=UniverseResponse)
async def get_universe():
    sql = """
        SELECT
            m.ticker,
            m.company_name,
            c.emax_pct,
            c.half_life_days,
            c.grade_3_ae_pct,
            c.audit_text,
            c.approval_stage,
            c.mechanism_class,
            c.eligible_patient_pct
        FROM dmd_mechanisms m
        JOIN clinical_metrics c ON c.ticker = m.ticker
        ORDER BY m.ticker;
    """
    rows = fetch_all(sql, ())

    if not rows:
        raise HTTPException(
            status_code=503,
            detail="No tickers found in database. Run seed.py first.",
        )

    tickers = [
        UniverseTicker(
            ticker=r["ticker"],
            company_name=r["company_name"],
            clinical=ClinicalSnapshot(
                emax_pct=float(r["emax_pct"]),
                half_life_days=float(r["half_life_days"]),
                grade_3_ae_pct=float(r["grade_3_ae_pct"]),
                audit_text=r["audit_text"] or "",
                approval_stage=r["approval_stage"] or "",
                mechanism_class=r["mechanism_class"] or "",
                eligible_patient_pct=float(r["eligible_patient_pct"] or 0),
            ),
        )
        for r in rows
    ]

    return UniverseResponse(tickers=tickers)
