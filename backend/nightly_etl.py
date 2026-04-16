"""
nightly_etl.py — Standalone ETL script for Parkinson's sector (Phase 2 preview)

Fetches recent PubMed abstracts for a hardcoded list of Parkinson's-adjacent tickers,
generates OpenAI embeddings for each abstract, and prints the final JSON to stdout.

NOT integrated into the main server yet — run directly:
    python nightly_etl.py

Requirements (add to requirements.txt when integrating):
    httpx
    openai
    python-dotenv

Env vars needed (same .env as the main app):
    OPENAI_API_KEY
"""

import asyncio
import json
import os
import xml.etree.ElementTree as ET
from datetime import date

import httpx
from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

TICKERS = ["ABBV", "NVS"]  # AbbVie (ABBV) and Novartis (NVS) — Parkinson's programs

# Map ticker → a PubMed search query targeting the company's Parkinson's pipeline
TICKER_QUERIES: dict[str, str] = {
    "ABBV": "AbbVie Parkinson's disease alpha-synuclein ABBV-0805",
    "NVS":  "Novartis Parkinson's disease ofatumumab neurodegeneration",
}

PUBMED_ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
PUBMED_EFETCH  = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
MAX_RESULTS    = 3   # abstracts per ticker — small for demo purposes
EMBEDDING_MODEL = "text-embedding-3-small"

# ---------------------------------------------------------------------------
# PubMed helpers
# ---------------------------------------------------------------------------

async def search_pubmed(client: httpx.AsyncClient, query: str) -> list[str]:
    """Return a list of PubMed IDs matching `query`."""
    resp = await client.get(
        PUBMED_ESEARCH,
        params={
            "db":      "pubmed",
            "term":    query,
            "retmax":  MAX_RESULTS,
            "retmode": "json",
            "sort":    "relevance",
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    return data.get("esearchresult", {}).get("idlist", [])


async def fetch_abstracts(client: httpx.AsyncClient, pmids: list[str]) -> list[dict]:
    """Fetch article metadata + abstract text for a list of PubMed IDs."""
    if not pmids:
        return []

    resp = await client.get(
        PUBMED_EFETCH,
        params={
            "db":      "pubmed",
            "id":      ",".join(pmids),
            "retmode": "xml",
            "rettype": "abstract",
        },
        timeout=20,
    )
    resp.raise_for_status()

    root = ET.fromstring(resp.text)
    articles = []

    for article_node in root.findall(".//PubmedArticle"):
        pmid_node    = article_node.find(".//PMID")
        title_node   = article_node.find(".//ArticleTitle")
        abstract_node = article_node.find(".//AbstractText")
        journal_node = article_node.find(".//Journal/Title")
        year_node    = article_node.find(".//PubDate/Year")

        pmid     = pmid_node.text     if pmid_node     is not None else "unknown"
        title    = title_node.text    if title_node    is not None else ""
        abstract = abstract_node.text if abstract_node is not None else ""
        journal  = journal_node.text  if journal_node  is not None else ""
        year     = year_node.text     if year_node     is not None else ""

        if abstract:  # skip articles with no abstract
            articles.append({
                "pmid":     pmid,
                "title":    title,
                "abstract": abstract,
                "journal":  journal,
                "year":     year,
            })

    return articles


# ---------------------------------------------------------------------------
# Embedding
# ---------------------------------------------------------------------------

async def embed_texts(openai: AsyncOpenAI, texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a list of texts in one API call."""
    if not texts:
        return []
    response = await openai.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts,
    )
    return [item.embedding for item in response.data]


# ---------------------------------------------------------------------------
# Main ETL
# ---------------------------------------------------------------------------

async def run_etl() -> list[dict]:
    openai_client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    output_records: list[dict] = []

    async with httpx.AsyncClient() as http:
        for ticker in TICKERS:
            query = TICKER_QUERIES[ticker]
            print(f"[{ticker}] Searching PubMed: {query!r}")

            pmids = await search_pubmed(http, query)
            print(f"[{ticker}] Found {len(pmids)} PMID(s): {pmids}")

            articles = await fetch_abstracts(http, pmids)
            print(f"[{ticker}] Fetched {len(articles)} abstract(s) with text")

            if not articles:
                continue

            # Embed all abstracts for this ticker in one batch call
            texts = [a["abstract"] for a in articles]
            embeddings = await embed_texts(openai_client, texts)

            for article, embedding in zip(articles, embeddings):
                record = {
                    "ticker":         ticker,
                    "sector":         "neurology",
                    "disease":        "parkinsons",
                    "pmid":           article["pmid"],
                    "title":          article["title"],
                    "abstract":       article["abstract"],
                    "journal":        article["journal"],
                    "year":           article["year"],
                    "embedding_model": EMBEDDING_MODEL,
                    "embedding_dims": len(embedding),
                    "embedding":      embedding,
                    "etl_date":       date.today().isoformat(),
                }
                output_records.append(record)

    return output_records


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    records = asyncio.run(run_etl())

    # Pretty-print JSON to terminal (omit full embedding vector for readability)
    display_records = []
    for r in records:
        display = dict(r)
        vec = display.pop("embedding", [])
        display["embedding_preview"] = vec[:6]   # first 6 dims as a sanity check
        display_records.append(display)

    print("\n" + "=" * 60)
    print(f"ETL COMPLETE — {len(records)} record(s) ready for Supabase ingestion")
    print("=" * 60)
    print(json.dumps(display_records, indent=2))
