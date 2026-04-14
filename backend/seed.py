"""
Phase 1 Seed Script — Biopharmer MVP
Initializes the pgvector schema and populates the DMD micro-universe
(DYNE, RNA, SRPT, WVE) with mechanism embeddings and mock clinical metrics.

Usage:
    cp .env.example .env          # fill in your keys
    pip install -r requirements.txt
    python seed.py
"""

import os
import sys
import json
from dotenv import load_dotenv
from openai import OpenAI
from supabase import create_client, Client

load_dotenv()

OPENAI_API_KEY   = os.environ["OPENAI_API_KEY"]
SUPABASE_URL     = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

openai_client: OpenAI = OpenAI(api_key=OPENAI_API_KEY)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ---------------------------------------------------------------------------
# Schema DDL
# ---------------------------------------------------------------------------

DDL = """
-- Enable pgvector (safe to run multiple times)
create extension if not exists vector;

-- Core mechanism table
create table if not exists dmd_mechanisms (
    id           bigserial primary key,
    ticker       text unique not null,
    company_name text not null,
    mechanism_text text not null,
    embedding    vector(1536)
);

-- Clinical metrics table (1-to-1 with dmd_mechanisms)
create table if not exists clinical_metrics (
    id              bigserial primary key,
    ticker          text not null references dmd_mechanisms(ticker) on delete cascade,
    emax_pct        numeric(5,2),   -- peak dystrophin restoration (% of normal)
    half_life_days  numeric(6,2),   -- serum/tissue half-life in days
    grade_3_ae_pct  numeric(5,2),   -- rate of Grade ≥3 adverse events (%)
    audit_text      text
);
"""

# ---------------------------------------------------------------------------
# DMD micro-universe data
# ---------------------------------------------------------------------------

COMPANIES = [
    {
        "ticker": "DYNE",
        "company_name": "Dyne Therapeutics",
        "mechanism_text": (
            "Dyne Therapeutics uses its proprietary FORCE™ platform — an antibody-oligonucleotide "
            "conjugate (AOC) that leverages the transferrin receptor 1 (TfR1) to ferry antisense "
            "oligonucleotides (ASOs) into muscle tissue. For Duchenne Muscular Dystrophy (DMD), "
            "DYNE-251 is designed to skip exon 51 of the dystrophin pre-mRNA, restoring a truncated "
            "but partially functional dystrophin protein. The TfR1-mediated internalization achieves "
            "muscle uptake orders of magnitude above free ASO, potentially enabling exon skipping "
            "at therapeutically meaningful levels with systemic dosing."
        ),
        "clinical": {
            "emax_pct": 18.5,
            "half_life_days": 28.0,
            "grade_3_ae_pct": 6.2,
            "audit_text": (
                "DYNE-251 DELIVER Ph1/2 interim (n=20): mean dystrophin at week 24 = 18.5% of normal "
                "(western blot). Primary SAE: transient LFT elevation (Grade 3, n=1, resolved). "
                "Muscle TfR1 target engagement confirmed by biopsy. Ongoing dose-escalation cohort "
                "targeting >20% dystrophin floor."
            ),
        },
    },
    {
        "ticker": "RNA",
        "company_name": "Avidity Biosciences",
        "mechanism_text": (
            "Avidity Biosciences' Antibody Oligonucleotide Conjugate (AOC) platform also exploits "
            "TfR1 for muscle-selective delivery of siRNA and ASO payloads. AOC 1001 (del-zota) "
            "targets myotonic dystrophy type 1 (DM1), but the platform architecture is directly "
            "applicable to DMD exon skipping. The anti-TfR1 monoclonal antibody acts as a GPS to "
            "concentrate the oligonucleotide payload in skeletal and cardiac muscle, bypassing the "
            "RES filtration that limits naked oligo delivery. Avidity reports 10–50× muscle "
            "concentration advantage over unconjugated ASOs in preclinical models."
        ),
        "clinical": {
            "emax_pct": 14.0,
            "half_life_days": 21.0,
            "grade_3_ae_pct": 4.8,
            "audit_text": (
                "AOC 1001 (DM1) MARINA Ph1/2 (n=40): statistically significant MBNL1 nuclear "
                "foci reduction at week 16. Grade 3 AE rate 4.8% (infusion-related reactions, n=2). "
                "Cross-platform inference: DMD AOC preclinical data show exon 45-skip dystrophin "
                "at 14% of normal in mdx mouse at 3 mg/kg. IND for DMD indication expected 2025."
            ),
        },
    },
    {
        "ticker": "SRPT",
        "company_name": "Sarepta Therapeutics",
        "mechanism_text": (
            "Sarepta Therapeutics employs an AAVrh74 recombinant adeno-associated virus vector to "
            "deliver a microdystrophin transgene (SRP-9001 / delandistrogene moxeparvovec, "
            "marketed as ELEVIDYS). The micro-dystrophin construct retains the actin-binding N-"
            "terminus, central rod domain spectrin-like repeats, and the C-terminus, omitting "
            "non-essential central rod repeats to fit within the ~4.7 kb AAV cargo limit. A single "
            "IV infusion targets skeletal and cardiac muscle via the natural tropism of rh74. "
            "Unlike exon-skipping ASOs, this gene therapy is mutation-agnostic and provides "
            "persistent transgene expression without repeat dosing."
        ),
        "clinical": {
            "emax_pct": 28.1,
            "half_life_days": 365.0,  # effectively permanent (single dose)
            "grade_3_ae_pct": 12.4,
            "audit_text": (
                "ELEVIDYS FDA accelerated approval (June 2023, ages 4–5). EMBARK Ph3 (n=125): "
                "micro-dystrophin expression 28.1% of normal at week 52; NSAA score +2.6 vs +1.9 "
                "placebo (p=0.07, missed primary). Grade 3+ AEs 12.4%: hepatic enzyme elevations "
                "managed with prophylactic steroids. No deaths. Complement activation and "
                "thrombotic microangiopathy (TMA) reported in 1 patient."
            ),
        },
    },
    {
        "ticker": "WVE",
        "company_name": "Wave Life Sciences",
        "mechanism_text": (
            "Wave Life Sciences uses stereopure oligonucleotides — synthetic nucleic acids with "
            "precisely controlled phosphorothioate backbone stereochemistry at each chiral center. "
            "Unlike conventional ASOs that are racemic mixtures, Wave's PRISM™ platform screens "
            "all stereopure configurations to identify the stereoisomer with optimal potency, "
            "protein binding, and tolerability for each target. For DMD, WVE-N531 is a stereopure "
            "ASO designed for exon 53 skipping. Controlled backbone chemistry is hypothesized to "
            "reduce non-specific protein binding (a driver of hepatotoxicity) while maintaining "
            "high-affinity target engagement, potentially unlocking a safer therapeutic index."
        ),
        "clinical": {
            "emax_pct": 9.8,
            "half_life_days": 14.0,
            "grade_3_ae_pct": 3.1,
            "audit_text": (
                "WVE-N531 WAVELENGTH Ph1/2 (n=18, exon 53 amenable): mean dystrophin 9.8% of "
                "normal at week 24 (mass spectrometry). Best responder: 21.3%. Grade 3 AE rate "
                "3.1% — lowest in class, supporting stereopure tolerability hypothesis. "
                "Ongoing dose-optimization cohort; partnered with GSK for manufacturing scale-up."
            ),
        },
    },
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def embed(text: str) -> list[float]:
    """Generate a 1536-dim embedding via text-embedding-3-small."""
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    return response.data[0].embedding


def run_ddl(sql: str) -> None:
    """Execute raw DDL via the Supabase PostgREST RPC escape hatch."""
    # supabase-py doesn't expose raw DDL directly; we use the postgres function
    # `exec_sql` or rely on the REST API. For DDL we call via rpc if available,
    # otherwise we print instructions.
    try:
        # Try via rpc exec_sql (works if the function exists in the DB)
        supabase.rpc("exec_sql", {"sql": sql}).execute()
        print("  DDL executed via RPC.")
    except Exception as e:  # noqa: BLE001
        print(
            f"\n[WARNING] Could not auto-run DDL via RPC: {e}\n"
            "Please run the following SQL manually in the Supabase SQL editor:\n"
            "─" * 60
        )
        print(sql)
        print("─" * 60)
        print("Then re-run this script to seed the data.\n")


def upsert_mechanism(company: dict, vector: list[float]) -> None:
    supabase.table("dmd_mechanisms").upsert(
        {
            "ticker":        company["ticker"],
            "company_name":  company["company_name"],
            "mechanism_text": company["mechanism_text"],
            "embedding":     vector,
        },
        on_conflict="ticker",
    ).execute()


def upsert_clinical(company: dict) -> None:
    c = company["clinical"]
    supabase.table("clinical_metrics").upsert(
        {
            "ticker":         company["ticker"],
            "emax_pct":       c["emax_pct"],
            "half_life_days": c["half_life_days"],
            "grade_3_ae_pct": c["grade_3_ae_pct"],
            "audit_text":     c["audit_text"],
        },
        on_conflict="ticker",
    ).execute()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("=" * 60)
    print("Biopharmer — Phase 1 Seed Script")
    print("=" * 60)

    # 1. Schema
    print("\n[1/3] Applying schema DDL …")
    run_ddl(DDL)

    # 2. Embed + upsert mechanisms
    print("\n[2/3] Generating embeddings and seeding dmd_mechanisms …")
    for company in COMPANIES:
        ticker = company["ticker"]
        print(f"  → Embedding {ticker} ({company['company_name']}) …", end=" ", flush=True)
        vector = embed(company["mechanism_text"])
        upsert_mechanism(company, vector)
        print("done")

    # 3. Seed clinical metrics
    print("\n[3/3] Seeding clinical_metrics …")
    for company in COMPANIES:
        ticker = company["ticker"]
        print(f"  → {ticker} …", end=" ", flush=True)
        upsert_clinical(company)
        print("done")

    print("\n" + "=" * 60)
    print("Seed complete. Tables populated:")
    print("  • dmd_mechanisms  — 4 rows with 1536-dim embeddings")
    print("  • clinical_metrics — 4 rows with mock Phase 1/2 data")
    print("=" * 60)


if __name__ == "__main__":
    main()
