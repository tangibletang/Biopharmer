# Biopharmer — Backend

## Phase 2 — Running the API

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

Interactive docs: http://localhost:8000/docs

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/peers/{ticker}` | pgvector cosine-similarity peer search + clinical metrics |
| GET | `/api/diligence/{ticker}` | Parallel War Room — explorer/critic branches per ticker + synthesis (query `parallelism=1–5`, default 3) |
| GET | `/api/prices/{ticker}` | Daily adjusted closes: **Alpha Vantage** when `ALPHA_VANTAGE_API_KEY` is set, otherwise **Yahoo Finance** via [yfinance](https://github.com/ranaroussi/yfinance) (query `period`: `3mo` … `max`, default `2y`; response includes `provider`) |

Valid tickers: `DYNE`, `RNA`, `SRPT`, `WVE`

**Prices:** `RNA` maps to listing symbol **`AVDL`** (Avidity Biosciences). A free Alpha Vantage key only gets **~100 trading days** (`TIME_SERIES_DAILY` compact) and **premium-only** endpoints (e.g. adjusted daily, `outputsize=full`) are not used — for **`2y`** (default), **`5y`**, **`max`**, etc., the API uses Yahoo. On error, rate limits, or missing key, Yahoo is used (unofficial; use lightly).

Uses mechanism text, `clinical_metrics`, and pgvector peers from the same DB as `/api/peers`.

---

## Phase 1 Setup

### Prerequisites
- Python 3.11+
- A Supabase project with the `vector` extension available
- An OpenAI API key

### Steps

1. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your actual keys
   ```

3. **Apply the schema** (run once in the Supabase SQL editor)
   ```
   Paste the contents of schema.sql into the Supabase SQL editor and execute.
   ```
   This creates `dmd_mechanisms`, `clinical_metrics`, the IVFFlat index, and the `exec_sql` helper RPC.

4. **Run the seed script**
   ```bash
   python seed.py
   ```
   Expected output:
   ```
   ============================================================
   Biopharmer — Phase 1 Seed Script
   ============================================================

   [1/3] Applying schema DDL …
     DDL executed via RPC.

   [2/3] Generating embeddings and seeding dmd_mechanisms …
     → Embedding DYNE (Dyne Therapeutics) … done
     → Embedding RNA (Avidity Biosciences) … done
     → Embedding SRPT (Sarepta Therapeutics) … done
     → Embedding WVE (Wave Life Sciences) … done

   [3/3] Seeding clinical_metrics …
     → DYNE … done
     → RNA … done
     → SRPT … done
     → WVE … done

   ============================================================
   Seed complete. Tables populated:
     • dmd_mechanisms   — 4 rows with 1536-dim embeddings
     • clinical_metrics — 4 rows with mock Phase 1/2 data
   ============================================================
   ```

### Schema Overview

```
dmd_mechanisms
  id             bigserial PK
  ticker         text UNIQUE          -- DYNE | RNA | SRPT | WVE
  company_name   text
  mechanism_text text                 -- full mechanism description
  embedding      vector(1536)         -- text-embedding-3-small

clinical_metrics
  id              bigserial PK
  ticker          text FK → dmd_mechanisms.ticker
  emax_pct        numeric             -- peak dystrophin restoration (%)
  half_life_days  numeric             -- serum/tissue half-life (days)
  grade_3_ae_pct  numeric             -- Grade ≥3 adverse event rate (%)
  audit_text      text                -- clinical trial summary
```

The `embedding` column is indexed with `ivfflat` (cosine ops) for the peer-similarity queries in Phase 2.
