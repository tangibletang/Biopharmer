"""
POST /api/etl/ingest     — PubMed + ClinicalTrials.gov → LLM extraction → pgvector upsert
GET  /api/milestones/{ticker} — Return stored milestones for any ticker
"""

import asyncio
import json
import os
import xml.etree.ElementTree as ET
from datetime import date as date_cls
from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from app.database import get_conn, fetch_all

router = APIRouter()

# ── Sector → company roster ───────────────────────────────────────────────────

SectorKey = Literal["neurology", "oncology", "cardiometabolic"]

SECTOR_COMPANIES: dict[str, list[dict]] = {
    "neurology": [
        {
            "ticker": "BIIB",
            "company_name": "Biogen",
            "query": "Biogen lecanemab Alzheimer disease amyloid clinical trial 2023 2024",
        },
        {
            "ticker": "NVS",
            "company_name": "Novartis",
            "query": "Novartis Parkinson disease neurodegeneration synuclein clinical",
        },
        {
            "ticker": "ABBV",
            "company_name": "AbbVie",
            "query": "AbbVie ABBV-0805 alpha-synuclein Parkinson disease clinical trial",
        },
    ],
    "oncology": [
        {
            "ticker": "MRK",
            "company_name": "Merck",
            "query": "Merck pembrolizumab Keytruda solid tumor PD-1 clinical trial",
        },
        {
            "ticker": "AZN",
            "company_name": "AstraZeneca",
            "query": "AstraZeneca durvalumab solid tumor PD-L1 clinical efficacy",
        },
    ],
    "cardiometabolic": [
        {
            "ticker": "LLY",
            "company_name": "Eli Lilly",
            "query": "Eli Lilly tirzepatide GLP-1 GIP obesity diabetes clinical trial",
        },
        {
            "ticker": "NVO",
            "company_name": "Novo Nordisk",
            "query": "Novo Nordisk semaglutide Ozempic Wegovy GLP-1 cardiovascular clinical",
        },
    ],
}

PUBMED_ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
PUBMED_EFETCH  = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
MAX_ABSTRACTS  = 3
EMBEDDING_MODEL = "text-embedding-3-small"


# ── Request / Response models ─────────────────────────────────────────────────

class IngestRequest(BaseModel):
    sector: SectorKey


class IngestResponse(BaseModel):
    sector: str
    ingested: int
    companies: list[str]


# ── LLM structured-output schema ──────────────────────────────────────────────

class ExtractedMechanism(BaseModel):
    mechanism_text: str = Field(
        description=(
            "2-4 sentence technical summary of the drug's mechanism of action, "
            "target pathway, and differentiated approach."
        )
    )
    emax_pct: float = Field(
        description=(
            "Peak therapeutic effect as a percentage (e.g. tumour reduction %, "
            "biomarker reduction %, or functional improvement %). "
            "Use 0.0 if not applicable or not reported."
        )
    )
    half_life_days: float = Field(
        description=(
            "Drug or antibody serum half-life in days. "
            "Convert hours to days if needed. Use 0.0 if not reported."
        )
    )
    grade_3_ae_pct: float = Field(
        description=(
            "Percentage of patients experiencing Grade ≥3 adverse events in the "
            "reported trial. Use 0.0 if not reported."
        )
    )
    audit_text: str = Field(
        description=(
            "One-sentence analyst note: key risk or catalytic event for this asset "
            "based solely on the provided abstracts."
        )
    )


# ── PubMed helpers ────────────────────────────────────────────────────────────

async def _pubmed_get(client: httpx.AsyncClient, url: str, params: dict) -> httpx.Response:
    """GET with automatic retry on 429."""
    for attempt in range(4):
        resp = await client.get(url, params=params, timeout=20)
        if resp.status_code != 429:
            return resp
        wait = 2 ** attempt
        await asyncio.sleep(wait)
    resp.raise_for_status()
    return resp


async def _search_pubmed(client: httpx.AsyncClient, query: str) -> list[str]:
    resp = await _pubmed_get(client, PUBMED_ESEARCH, {
        "db": "pubmed", "term": query,
        "retmax": MAX_ABSTRACTS, "retmode": "json", "sort": "relevance",
    })
    resp.raise_for_status()
    return resp.json().get("esearchresult", {}).get("idlist", [])


async def _fetch_abstracts(client: httpx.AsyncClient, pmids: list[str]) -> str:
    if not pmids:
        return ""
    resp = await _pubmed_get(client, PUBMED_EFETCH, {
        "db": "pubmed", "id": ",".join(pmids), "retmode": "xml", "rettype": "abstract",
    })
    resp.raise_for_status()
    root = ET.fromstring(resp.text)
    chunks: list[str] = []
    for node in root.findall(".//AbstractText"):
        if node.text:
            chunks.append(node.text.strip())
    return "\n\n".join(chunks)


async def _fetch_company_abstracts(
    http: httpx.AsyncClient, company: dict
) -> tuple[dict, str]:
    """Fetch and return (company_meta, combined_abstract_text)."""
    pmids = await _search_pubmed(http, company["query"])
    await asyncio.sleep(0.4)   # pause between search and fetch for same company
    text  = await _fetch_abstracts(http, pmids)
    return company, text


# ── LLM extraction ────────────────────────────────────────────────────────────

async def _extract_mechanism(
    openai: AsyncOpenAI, company: dict, abstract_text: str, sector: str
) -> ExtractedMechanism:
    system_prompt = (
        "You are a senior biotech analyst. Extract structured clinical data from "
        "PubMed abstracts for investment-grade analysis. If a metric is not "
        "directly reported, provide a reasonable estimate based on the drug class "
        "and available data, noting 'estimated' in audit_text. Never leave floats "
        "as null — default to 0.0 only if truly inapplicable."
    )
    user_prompt = (
        f"Company: {company['company_name']} ({company['ticker']})\n"
        f"Sector: {sector}\n\n"
        f"PubMed abstracts:\n{abstract_text or 'No abstracts available — use known public data for this drug class.'}\n\n"
        "Return the structured clinical extraction."
    )

    response = await openai.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        response_format=ExtractedMechanism,
        temperature=0.1,
    )
    return response.choices[0].message.parsed


# ── DB upsert ─────────────────────────────────────────────────────────────────

def _upsert_company(
    company: dict,
    sector: str,
    extracted: ExtractedMechanism,
    embedding: list[float],
) -> None:
    vec_str = "[" + ",".join(str(x) for x in embedding) + "]"

    with get_conn() as conn:
        with conn.cursor() as cur:
            # Upsert into the universal mechanism table
            cur.execute(
                """
                INSERT INTO dmd_mechanisms
                    (ticker, company_name, mechanism_text, embedding, sector)
                VALUES (%s, %s, %s, %s::vector, %s)
                ON CONFLICT (ticker) DO UPDATE SET
                    company_name   = EXCLUDED.company_name,
                    mechanism_text = EXCLUDED.mechanism_text,
                    embedding      = EXCLUDED.embedding,
                    sector         = EXCLUDED.sector
                """,
                (
                    company["ticker"],
                    company["company_name"],
                    extracted.mechanism_text,
                    vec_str,
                    sector,
                ),
            )

            # Upsert clinical metrics
            cur.execute(
                """
                INSERT INTO clinical_metrics
                    (ticker, emax_pct, half_life_days, grade_3_ae_pct, audit_text)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (ticker) DO UPDATE SET
                    emax_pct       = EXCLUDED.emax_pct,
                    half_life_days = EXCLUDED.half_life_days,
                    grade_3_ae_pct = EXCLUDED.grade_3_ae_pct,
                    audit_text     = EXCLUDED.audit_text
                """,
                (
                    company["ticker"],
                    extracted.emax_pct,
                    extracted.half_life_days,
                    extracted.grade_3_ae_pct,
                    extracted.audit_text,
                ),
            )


# ── ClinicalTrials.gov helpers ────────────────────────────────────────────────

CT_API = "https://clinicaltrials.gov/api/v2/studies"

# Sector → disease search term for ClinicalTrials.gov
SECTOR_CONDITION: dict[str, str] = {
    "neurology":       "Alzheimer OR Parkinson",
    "oncology":        "solid tumor OR non-small cell lung cancer OR colorectal cancer",
    "cardiometabolic": "obesity OR type 2 diabetes OR cardiovascular",
}

# Company name → ClinicalTrials.gov sponsor search term
SPONSOR_SEARCH: dict[str, str] = {
    "BIIB": "Biogen",
    "NVS":  "Novartis",
    "ABBV": "AbbVie",
    "MRK":  "Merck",
    "AZN":  "AstraZeneca",
    "LLY":  "Eli Lilly",
    "NVO":  "Novo Nordisk",
}


async def _fetch_clinical_trials(
    http: httpx.AsyncClient, company: dict, sector: str
) -> list[dict]:
    """Fetch up to 8 relevant trials from ClinicalTrials.gov for a company."""
    sponsor = SPONSOR_SEARCH.get(company["ticker"], company["company_name"])
    condition = SECTOR_CONDITION.get(sector, "")

    params = {
        "query.lead":  sponsor,
        "query.cond":  condition,
        "fields":      "NCTId,BriefTitle,StartDate,PrimaryCompletionDate,OverallStatus,Phase",
        "pageSize":    8,
        "format":      "json",
    }
    try:
        resp = await http.get(CT_API, params=params, timeout=15)
        if resp.status_code != 200:
            return []
        data = resp.json()
        studies = data.get("studies", [])
        out = []
        for s in studies:
            proto = s.get("protocolSection", {})
            id_mod = proto.get("identificationModule", {})
            status_mod = proto.get("statusModule", {})
            design_mod = proto.get("designModule", {})
            out.append({
                "nct_id":       id_mod.get("nctId", ""),
                "title":        id_mod.get("briefTitle", ""),
                "start_date":   status_mod.get("startDateStruct", {}).get("date", ""),
                "completion":   status_mod.get("primaryCompletionDateStruct", {}).get("date", ""),
                "status":       status_mod.get("overallStatus", ""),
                "phase":        design_mod.get("phases", [""])[0] if design_mod.get("phases") else "",
            })
        return out
    except Exception:
        return []


# ── Milestone LLM extraction ──────────────────────────────────────────────────

class MilestoneItem(BaseModel):
    date: str = Field(description="YYYY-MM-DD format. Estimate month-end if only year/month known.")
    label: str = Field(description="Short title for the timeline card, max 10 words.")
    detail: str = Field(description="1-2 sentence investor-focused explanation of the event.")
    type: Literal["positive", "negative", "neutral"] = Field(
        description="positive=efficacy/approval win, negative=safety/failure, neutral=enrollment/filing"
    )
    category: Literal["historical", "projected"] = Field(
        description=f"historical if the date is before {date_cls.today().isoformat()}, else projected"
    )


class MilestoneList(BaseModel):
    milestones: list[MilestoneItem]


async def _generate_milestones(
    openai: AsyncOpenAI, company: dict, trials: list[dict], sector: str
) -> list[MilestoneItem]:
    """
    Hybrid milestone generation:
      Call 1 — LLM training knowledge → historical events (accurate dates for well-known companies)
      Call 2 — ClinicalTrials.gov upcoming completions → projected events
    Results are deduplicated and merged.
    """
    today = date_cls.today().isoformat()
    trials_text = json.dumps(trials, indent=2) if trials else "No trial data available."

    # ── Call 1: Historical milestones from LLM training knowledge ─────────────
    historical_task = openai.beta.chat.completions.parse(
        model="gpt-4o",          # use the stronger model — accuracy matters for real dates
        messages=[
            {
                "role": "system",
                "content": (
                    f"Today is {today}. You are a senior biotech investment analyst with deep "
                    "knowledge of clinical trial history. Generate historical clinical milestones "
                    "for the given company using your training knowledge — do NOT make up events. "
                    "Only include events you are confident actually occurred with real dates. "
                    "Focus on: key drug approvals, major Phase 2/3 trial readouts, FDA filing "
                    "acceptances, significant safety signals, partnership deals, and label expansions. "
                    "Use exact dates (YYYY-MM-DD) where known; estimate to last day of month if "
                    "only year/month is known. Only include events before " + today + ". "
                    "Aim for 6-10 milestones covering the past 5-8 years."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Company: {company['company_name']} ({company['ticker']})\n"
                    f"Sector focus: {sector}\n\n"
                    "Generate the historical milestone list for their key programs in this sector."
                ),
            },
        ],
        response_format=MilestoneList,
        temperature=0.1,
    )

    # ── Call 2: Projected milestones from LLM pipeline knowledge + CT.gov ────
    projected_task = openai.beta.chat.completions.parse(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": (
                    f"Today is {today}. You are a senior biotech investment analyst. "
                    "Generate upcoming projected clinical milestones for this company using "
                    "your knowledge of their pipeline AND the ClinicalTrials.gov data provided. "
                    "Include: expected Phase 2/3 readouts, anticipated FDA filings, label "
                    "expansion decisions, and major trial completion windows. "
                    "ALL dates must be strictly after " + today + " — do not include past events. "
                    "If you are unsure of a date, estimate to the end of the most likely quarter. "
                    "Aim for 4-6 projected milestones spanning the next 2-3 years."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Company: {company['company_name']} ({company['ticker']})\n"
                    f"Sector: {sector}\n\n"
                    f"ClinicalTrials.gov data (use completion dates as anchors):\n{trials_text}\n\n"
                    "Generate projected milestones only — all dates must be after " + today + "."
                ),
            },
        ],
        response_format=MilestoneList,
        temperature=0.2,
    )

    hist_resp, proj_resp = await asyncio.gather(historical_task, projected_task)

    historical = hist_resp.choices[0].message.parsed.milestones
    projected  = proj_resp.choices[0].message.parsed.milestones

    # Hard-enforce categories — don't trust LLM to get past/future right
    for m in historical:
        m.category = "historical"
    for m in projected:
        m.category = "projected"

    # Drop any projected milestone whose date is actually in the past
    projected = [m for m in projected if m.date >= today]

    # Deduplicate by label similarity (simple: exact label match)
    seen_labels: set[str] = set()
    merged: list[MilestoneItem] = []
    for m in historical + projected:
        key = m.label.lower().strip()[:60]
        if key not in seen_labels:
            seen_labels.add(key)
            merged.append(m)

    return merged


def _upsert_milestones(ticker: str, milestones: list[MilestoneItem]) -> None:
    if not milestones:
        return
    with get_conn() as conn:
        with conn.cursor() as cur:
            # Clear old milestones for this ticker before re-inserting
            cur.execute("DELETE FROM milestones WHERE ticker = %s", (ticker,))
            for m in milestones:
                cur.execute(
                    """
                    INSERT INTO milestones (ticker, date, label, detail, type, category, source)
                    VALUES (%s, %s, %s, %s, %s, %s, 'clinicaltrials_gov')
                    """,
                    (ticker, m.date, m.label, m.detail, m.type, m.category),
                )


# ── GET /api/milestones/{ticker} ──────────────────────────────────────────────

class MilestoneRow(BaseModel):
    date: str
    label: str
    detail: str
    type: str
    category: str
    source: str


class MilestonesResponse(BaseModel):
    ticker: str
    milestones: list[MilestoneRow]


@router.get("/milestones/{ticker}", response_model=MilestonesResponse)
async def get_milestones(ticker: str):
    ticker = ticker.upper()
    rows = fetch_all(
        "SELECT date, label, detail, type, category, source FROM milestones WHERE ticker = %s ORDER BY date",
        (ticker,),
    )
    return MilestonesResponse(
        ticker=ticker,
        milestones=[MilestoneRow(**r) for r in rows],
    )


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/etl/ingest", response_model=IngestResponse)
async def ingest_sector(body: IngestRequest):
    sector = body.sector

    if sector not in SECTOR_COMPANIES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown sector '{sector}'. Valid: {list(SECTOR_COMPANIES)}",
        )

    companies = SECTOR_COMPANIES[sector]
    openai_client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])

    # ── 1. Fetch PubMed abstracts + ClinicalTrials data (sequential, rate-safe) ─
    async with httpx.AsyncClient() as http:
        fetch_results: list[tuple[dict, str]] = []
        trials_by_ticker: dict[str, list[dict]] = {}
        for c in companies:
            pubmed_result = await _fetch_company_abstracts(http, c)
            fetch_results.append(pubmed_result)
            await asyncio.sleep(0.5)
            trials = await _fetch_clinical_trials(http, c, sector)
            trials_by_ticker[c["ticker"]] = trials
            await asyncio.sleep(0.3)

    # ── 2. LLM: mechanism extraction + milestone generation (concurrent) ──────
    extract_tasks = [
        _extract_mechanism(openai_client, company, text, sector)
        for company, text in fetch_results
    ]
    milestone_tasks = [
        _generate_milestones(openai_client, company, trials_by_ticker[company["ticker"]], sector)
        for company, _ in fetch_results
    ]
    extracted_list: list[ExtractedMechanism]
    milestone_results: list[list[MilestoneItem]]
    extracted_list, milestone_results = await asyncio.gather(  # type: ignore[assignment]
        asyncio.gather(*extract_tasks),
        asyncio.gather(*milestone_tasks),
    )

    # ── 3. Embed all mechanism_text strings in one batch call ─────────────────
    texts_to_embed = [e.mechanism_text for e in extracted_list]
    embed_response = await openai_client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts_to_embed,
    )
    embeddings = [item.embedding for item in embed_response.data]

    # ── 4. Upsert mechanism, clinical metrics, and milestones to Supabase ─────
    ingested_companies: list[str] = []
    for (company, _), extracted, embedding, milestones in zip(
        fetch_results, extracted_list, embeddings, milestone_results
    ):
        _upsert_company(company, sector, extracted, embedding)
        _upsert_milestones(company["ticker"], milestones)
        ingested_companies.append(company["ticker"])

    return IngestResponse(
        sector=sector,
        ingested=len(ingested_companies),
        companies=ingested_companies,
    )
