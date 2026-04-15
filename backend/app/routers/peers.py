"""
GET /api/peers/{ticker}

Returns the 3 closest scientific peers in the DMD micro-universe using
pgvector cosine similarity on mechanism embeddings, along with their
full clinical snapshot.
"""

from fastapi import APIRouter, HTTPException

from app.database import fetch_all, fetch_one
from app.models import ClinicalSnapshot, PeerResult, PeersResponse

router = APIRouter()

VALID_TICKERS = {"DYNE", "RNA", "SRPT", "WVE"}


@router.get("/peers/{ticker}", response_model=PeersResponse)
async def get_peers(ticker: str):
    ticker = ticker.upper()

    if ticker not in VALID_TICKERS:
        raise HTTPException(
            status_code=404,
            detail=f"Ticker '{ticker}' not in DMD micro-universe. Valid tickers: {sorted(VALID_TICKERS)}",
        )

    # Verify the ticker has an embedding
    base = fetch_one(
        "SELECT id FROM dmd_mechanisms WHERE ticker = %s",
        (ticker,),
    )
    if not base:
        raise HTTPException(
            status_code=404,
            detail=f"Ticker '{ticker}' not found in database. Run seed.py first.",
        )

    # pgvector cosine similarity query
    # 1 - (a <=> b) converts distance [0,2] → similarity [−1,1]; for unit vectors [0,1]
    sql = """
        WITH base AS (
            SELECT embedding
            FROM   dmd_mechanisms
            WHERE  ticker = %s
        )
        SELECT
            m.ticker,
            m.company_name,
            1 - (m.embedding <=> base.embedding) AS similarity,
            c.emax_pct,
            c.half_life_days,
            c.grade_3_ae_pct,
            c.audit_text,
            c.approval_stage,
            c.mechanism_class,
            c.eligible_patient_pct
        FROM   dmd_mechanisms m
        JOIN   clinical_metrics c ON c.ticker = m.ticker
        CROSS  JOIN base
        WHERE  m.ticker != %s
        ORDER  BY m.embedding <=> base.embedding
        LIMIT  3;
    """

    rows = fetch_all(sql, (ticker, ticker))

    peers = [
        PeerResult(
            ticker=r["ticker"],
            company_name=r["company_name"],
            similarity=float(r["similarity"]),
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

    return PeersResponse(base_ticker=ticker, peers=peers)
