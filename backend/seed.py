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
    id                   bigserial primary key,
    ticker               text not null references dmd_mechanisms(ticker) on delete cascade,
    emax_pct             numeric(5,2),   -- peak dystrophin restoration (% of normal)
    half_life_days       numeric(6,2),   -- serum/tissue half-life in days
    grade_3_ae_pct       numeric(5,2),   -- rate of Grade ≥3 adverse events (%)
    audit_text           text,
    approval_stage       text,           -- Phase 2 | BLA Pending | Pre-BLA | Approved
    mechanism_class      text,           -- ASO | AOC | Gene Therapy
    eligible_patient_pct numeric(5,2)    -- % of DMD patients this drug can treat
);

-- Add new columns if table was already created without them (idempotent)
alter table clinical_metrics add column if not exists approval_stage       text;
alter table clinical_metrics add column if not exists mechanism_class      text;
alter table clinical_metrics add column if not exists eligible_patient_pct numeric(5,2);
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
            "z-rostudirsen (formerly DYNE-251) is designed to skip exon 51 of the dystrophin "
            "pre-mRNA, restoring a truncated but partially functional dystrophin protein. The "
            "TfR1-mediated internalization achieves muscle uptake orders of magnitude above free "
            "ASO, enabling therapeutically meaningful exon skipping with systemic dosing. The same "
            "FORCE platform underlies z-basivarsen for myotonic dystrophy type 1 (DM1), validating "
            "the cross-indication applicability of TfR1-targeted oligonucleotide delivery."
        ),
        "clinical": {
            "emax_pct": 8.72,
            "half_life_days": 28.0,
            "grade_3_ae_pct": 6.2,
            "approval_stage": "BLA Pending",
            "mechanism_class": "AOC",
            "eligible_patient_pct": 13.0,
            "audit_text": (
                "Z-rostudirsen (DYNE-251, exon 51 skip). DELIVER Ph1/2 Registrational Expansion "
                "Cohort (REC, 20 mg/kg Q4W, n=32): primary endpoint met — mean dystrophin 5.46% "
                "of normal at 6 months (muscle content-adjusted, p<0.0001), 7-fold change from "
                "baseline; mean 8.72% unadjusted by muscle content at 6 months. Unprecedented "
                "and sustained functional improvement across NSAA, 10MWT, and PODCI through 24 "
                "months. Grade 3+ AE rate 6.2%; primary SAE was transient LFT elevation (n=1, "
                "resolved). FDA Breakthrough Therapy Designation granted August 2025. BLA "
                "submission for accelerated approval on track Q2 2026. Cash $1.1B at YE2025."
            ),
        },
    },
    {
        "ticker": "RNA",
        "company_name": "Avidity Biosciences (acquired by Novartis)",
        "mechanism_text": (
            "Avidity Biosciences' Antibody Oligonucleotide Conjugate (AOC) platform exploits TfR1 "
            "for muscle-selective delivery of siRNA and ASO payloads. Del-zota (delpacibart "
            "zotadirsen, AOC 1044) targets exon 44-amenable DMD mutations (~8% of patients). The "
            "anti-TfR1 monoclonal antibody concentrates the oligonucleotide payload in skeletal "
            "and cardiac muscle, bypassing the RES filtration that limits naked oligo delivery. "
            "Avidity's platform also produced del-desiran for DM1, whose full results were "
            "published in the New England Journal of Medicine in 2024. Novartis acquired Avidity "
            "for $72/share ($12B) in October 2025; deal closed February 2026. Del-zota and del-"
            "desiran are now being developed within Novartis."
        ),
        "clinical": {
            "emax_pct": 25.0,
            "half_life_days": 21.0,
            "grade_3_ae_pct": 4.8,
            "approval_stage": "Pre-BLA",
            "mechanism_class": "AOC",
            "eligible_patient_pct": 7.0,
            "audit_text": (
                "Del-zota (AOC 1044, exon 44 skip). EXPLORE44 Ph1/2 (n=enrolled ongoing): "
                "1-year data (August 2025) showed mean 25% dystrophin of normal with near-"
                "normalization of serum creatine kinase (80%+ reduction) and functional "
                "improvements versus natural history. Breakthrough Therapy Designation. "
                "Pre-BLA meeting with FDA completed October 2025 confirming accelerated approval "
                "pathway. Grade 3+ AE rate 4.8% (infusion-related reactions). Novartis BLA "
                "submission planned 2026. Avidity acquired by Novartis for $72/share in Feb 2026."
            ),
        },
    },
    {
        "ticker": "SRPT",
        "company_name": "Sarepta Therapeutics",
        "mechanism_text": (
            "Sarepta Therapeutics employs an AAVrh74 recombinant adeno-associated virus vector to "
            "deliver a microdystrophin transgene (delandistrogene moxeparvovec, marketed as "
            "ELEVIDYS). The micro-dystrophin construct retains the actin-binding N-terminus, "
            "central rod domain spectrin-like repeats, and the C-terminus, omitting non-essential "
            "central rod repeats to fit within the ~4.7 kb AAV cargo limit. A single IV infusion "
            "targets skeletal and cardiac muscle via the natural tropism of rh74. Unlike exon-"
            "skipping ASOs, this gene therapy is mutation-agnostic and provides persistent "
            "transgene expression without repeat dosing. However, the AAVrh74 capsid has been "
            "associated with fatal acute liver failure in three patients across multiple Sarepta "
            "gene therapy programs (2025), leading to FDA-mandated label restrictions."
        ),
        "clinical": {
            "emax_pct": 28.1,
            "half_life_days": 365.0,  # effectively permanent (single dose)
            "grade_3_ae_pct": 12.4,
            "approval_stage": "Approved",
            "mechanism_class": "Gene Therapy",
            "eligible_patient_pct": 40.0,
            "audit_text": (
                "ELEVIDYS (delandistrogene moxeparvovec). FDA accelerated approval June 2023; "
                "label expanded to ambulatory ages 4+ in June 2024. EMBARK Ph3 (n=125): micro-"
                "dystrophin 28.1% of normal at week 52; NSAA +2.6 vs +1.9 placebo (p=0.07, "
                "missed primary). EMBARK Part 2 positive (Jan 2025); 3-year durability positive "
                "(Jan 2026). CRITICAL SAFETY EVENTS: Three patients died from acute liver failure "
                "in 2025 (March, June, July). FDA requested distribution suspension and placed "
                "clinical trials on hold (July 2025). FDA approved boxed warning for acute serious "
                "liver injury/acute liver failure (Nov 2025). Indication NARROWED to ambulatory "
                "patients only — non-ambulatory use no longer licensed. Grade 3+ AE rate 12.4%. "
                "FY2025 ELEVIDYS revenue significantly below pre-crisis estimates due to safety "
                "overhang and label restriction."
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
            "all stereopure configurations to identify the optimal stereoisomer for each target. "
            "For DMD, WVE-N531 is a stereopure ASO for exon 53 skipping. Controlled backbone "
            "chemistry reduces non-specific protein binding (a driver of hepatotoxicity) while "
            "maintaining high-affinity target engagement. Wave also has WVE-007, an experimental "
            "GLP-1 complement drug for obesity that uses the same stereopure chemistry to address "
            "muscle-mass loss seen with semaglutide/tirzepatide — a pivot that created significant "
            "stock volatility in late 2025 and early 2026."
        ),
        "clinical": {
            "emax_pct": 9.0,
            "half_life_days": 14.0,
            "grade_3_ae_pct": 0.0,
            "approval_stage": "Phase 2",
            "mechanism_class": "ASO",
            "eligible_patient_pct": 10.0,
            "audit_text": (
                "WVE-N531 (exon 53 skip). FORWARD-53 Ph2 (n=11, exon 53 amenable): 24-week mean "
                "dystrophin 9.0% of normal (range 4.6–13.9%) and 5.5% unadjusted (western blot). "
                "48-week mean 7.8% (muscle content-adjusted), stable vs week 24; 88% of boys "
                "above 5% threshold. Significant functional benefit and reversal of muscle damage "
                "at 48 weeks. Grade 3+ AE rate: 0% — all treatment-related AEs were mild (4 "
                "events in 3 participants); zero serious adverse events; zero discontinuations; "
                "best-in-class tolerability profile in the DMD exon-skipping class. FDA confirmed "
                "accelerated approval pathway. NDA submission planned 2026. WVE-007 (obesity): "
                "200mg dose 9.4% visceral fat reduction (Phase 1 INLIGHT); 400mg dose failed "
                "0.9% weight loss (March 2026), stock fell 56%."
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
            "ticker":                company["ticker"],
            "emax_pct":              c["emax_pct"],
            "half_life_days":        c["half_life_days"],
            "grade_3_ae_pct":        c["grade_3_ae_pct"],
            "audit_text":            c["audit_text"],
            "approval_stage":        c["approval_stage"],
            "mechanism_class":       c["mechanism_class"],
            "eligible_patient_pct":  c["eligible_patient_pct"],
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
