"""
Ticker-scoped War Room: load mechanism + clinical + peers, then parallel investment debate.
"""

from __future__ import annotations

from app.agents.parallel_debate import run_parallel_investment_debate
from app.agents.war_room import search_scientific_peers
from app.database import fetch_one

# Personas tuned for stock diligence (not open research)
TICKER_WAR_PERSONAS: list[tuple[str, str]] = [
    (
        "Mechanism & efficacy",
        "You are a biotech equity analyst focused on whether the biology supports the clinical and commercial thesis. "
        "Tie claims to trial data and mechanism of action.",
    ),
    (
        "Clinical & regulatory",
        "You focus on trial design, endpoints, FDA/regulatory path, and label risk for this program.",
    ),
    (
        "Competitive & differentiation",
        "You compare this company to closest scientific peers and the broader exon-skipping / DMD landscape.",
    ),
    (
        "Safety & execution",
        "You stress safety signals, tolerability, manufacturing, and team execution risk.",
    ),
    (
        "Valuation & catalysts",
        "You frame what the market is pricing in and what binary events or metrics would re-rate the stock.",
    ),
]


def _load_context(ticker: str) -> dict:
    row = fetch_one(
        "SELECT mechanism_text, company_name FROM dmd_mechanisms WHERE ticker = %s",
        (ticker,),
    )
    mechanism_text = row["mechanism_text"] if row else "Mechanism unknown."
    company_name = row["company_name"] if row else ticker

    clinical = fetch_one(
        """SELECT emax_pct, half_life_days, grade_3_ae_pct, audit_text
           FROM clinical_metrics WHERE ticker = %s""",
        (ticker,),
    )
    clinical_data = dict(clinical) if clinical else {}
    peers = search_scientific_peers(ticker)

    return {
        "mechanism_text": mechanism_text,
        "company_name": company_name,
        "clinical_data": clinical_data,
        "peers": peers,
    }


def _build_question(ticker: str, ctx: dict) -> str:
    cd = ctx["clinical_data"]
    peers_lines = []
    for p in ctx["peers"]:
        peers_lines.append(
            f"  • {p['ticker']} ({p['company_name']}): similarity={float(p['similarity']):.3f}; "
            f"Emax={p['emax_pct']}%; t½={p['half_life_days']}d; Grade3+ AE={p['grade_3_ae_pct']}%"
        )
    peers_block = "\n".join(peers_lines) if peers_lines else "  (none)"
    audit = (cd.get("audit_text") or "")[:1200]

    return (
        f"Stock: ${ticker} — {ctx['company_name']}\n"
        f"Duchenne muscular dystrophy (DMD) micro-universe diligence.\n\n"
        f"Mechanism (summary):\n{ctx['mechanism_text']}\n\n"
        f"Clinical snapshot: Emax {cd.get('emax_pct')}% of normal dystrophin; "
        f"t½ {cd.get('half_life_days')} days; Grade 3+ AE {cd.get('grade_3_ae_pct')}%.\n\n"
        f"Trial / audit notes:\n{audit}\n\n"
        f"Closest scientific peers (embedding similarity):\n{peers_block}\n\n"
        "Produce investment-relevant angles: each branch should help a portfolio manager "
        "decide whether to own, avoid, or size this name versus peers."
    )


async def run_ticker_war_room(ticker: str, parallelism: int = 3) -> dict:
    """
    Returns dict with keys: parallel_branches, merged (ranked_directions, synthesis_note, bull_case, ...),
    and raw fields for API mapping.
    """
    ticker = ticker.upper()
    ctx = _load_context(ticker)
    question = _build_question(ticker, ctx)
    n = min(max(parallelism, 1), 5)
    branches, merged = await run_parallel_investment_debate(
        question,
        n,
        TICKER_WAR_PERSONAS,
    )

    out_branches = []
    for b in branches:
        out_branches.append(
            {
                "label": b["label"],
                "explorer": b["explorer"],
                "critic": b["critic"],
            }
        )

    return {
        "ticker": ticker,
        "context": ctx,
        "parallel_branches": out_branches,
        "merged": merged,
    }
