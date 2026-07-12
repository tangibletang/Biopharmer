"""Offline DMD context used when Postgres/pgvector is unavailable."""

from __future__ import annotations

FALLBACK_COMPANIES: dict[str, dict] = {
    "DYNE": {
        "company_name": "Dyne Therapeutics",
        "mechanism_text": (
            "Dyne Therapeutics uses its proprietary FORCE™ platform — an antibody-oligonucleotide "
            "conjugate (AOC) that leverages the transferrin receptor 1 (TfR1) to ferry antisense "
            "oligonucleotides (ASOs) into muscle tissue. For Duchenne Muscular Dystrophy (DMD), "
            "z-rostudirsen (formerly DYNE-251) is designed to skip exon 51 of the dystrophin "
            "pre-mRNA, restoring a truncated but partially functional dystrophin protein."
        ),
        "clinical": {
            "emax_pct": 8.72,
            "half_life_days": 28.0,
            "grade_3_ae_pct": 6.2,
            "audit_text": (
                "Z-rostudirsen (DYNE-251, exon 51 skip). DELIVER REC met primary endpoint — "
                "5.46% muscle content-adjusted dystrophin at 6 months (p<0.0001). BTD Aug 2025. "
                "BLA submitted May 26, 2026 for accelerated approval; Priority Review requested; "
                "Phase 3 FORZETTO confirmatory trial underway. Potential U.S. launch Q1 2027."
            ),
        },
    },
    "SRPT": {
        "company_name": "Sarepta Therapeutics",
        "mechanism_text": (
            "Sarepta Therapeutics employs an AAVrh74 recombinant adeno-associated virus vector to "
            "deliver a microdystrophin transgene (delandistrogene moxeparvovec, marketed as "
            "ELEVIDYS). A single IV infusion targets skeletal and cardiac muscle. The AAVrh74 "
            "capsid has been associated with fatal acute liver failure leading to a boxed warning "
            "and ambulatory-only label."
        ),
        "clinical": {
            "emax_pct": 28.1,
            "half_life_days": 365.0,
            "grade_3_ae_pct": 12.4,
            "audit_text": (
                "ELEVIDYS approved; EMBARK 3-year durability positive (Jan 2026). Three acute "
                "liver-failure deaths in 2025 → boxed warning Nov 2025 and ambulatory-only label. "
                "Commercial run-rate stabilizing; EXPEDITION long-term follow-up ongoing."
            ),
        },
    },
    "WVE": {
        "company_name": "Wave Life Sciences",
        "mechanism_text": (
            "Wave Life Sciences uses stereopure oligonucleotides with controlled phosphorothioate "
            "backbone stereochemistry (PRISM™). WVE-N531 is a stereopure ASO for exon 53 skipping "
            "in DMD, designed for high-affinity target engagement with a cleaner safety profile "
            "than racemic ASOs."
        ),
        "clinical": {
            "emax_pct": 9.0,
            "half_life_days": 14.0,
            "grade_3_ae_pct": 0.0,
            "audit_text": (
                "WVE-N531 FORWARD-53 Ph2: 24-week mean dystrophin 9.0%, 48-week 7.8% with functional "
                "benefit and zero SAEs. FDA confirmed accelerated-approval pathway; NDA expected "
                "in 2026. WVE-007 obesity program spiked Dec 2025 then crashed Mar 2026."
            ),
        },
    },
}


def fallback_context(ticker: str) -> dict:
    t = ticker.upper()
    company = FALLBACK_COMPANIES.get(t)
    if not company:
        return {
            "mechanism_text": "Mechanism unknown.",
            "company_name": t,
            "clinical_data": {},
            "peers": [],
        }

    peers = []
    for peer_ticker, peer in FALLBACK_COMPANIES.items():
        if peer_ticker == t:
            continue
        c = peer["clinical"]
        peers.append(
            {
                "ticker": peer_ticker,
                "company_name": peer["company_name"],
                "mechanism_text": peer["mechanism_text"],
                "similarity": 0.72,
                "emax_pct": c["emax_pct"],
                "half_life_days": c["half_life_days"],
                "grade_3_ae_pct": c["grade_3_ae_pct"],
                "audit_text": c["audit_text"],
            }
        )

    return {
        "mechanism_text": company["mechanism_text"],
        "company_name": company["company_name"],
        "clinical_data": dict(company["clinical"]),
        "peers": peers,
    }
