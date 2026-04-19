# Biopharmer — Backend

FastAPI service for **peer similarity**, **prices**, **universe/compare** helpers, **milestone AI analysis**, and the **Research Barn** — an iterative multi-agent diligence loop (`POST /api/diligence/start` + `POST /api/diligence/resume`). For product context (agents, tools, human steering), see the root [README.md](../README.md).

---

## Running the API

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

Interactive docs: http://localhost:8000/docs

### Environment

Copy [`.env.example`](.env.example) to `.env` and set:

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | Yes (API + seed) | Chat + embeddings for agents and milestone analysis |
| `DATABASE_URL` | Yes (API) | Direct Postgres URL for psycopg2 — peers, mechanisms, clinical metrics |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | Yes (seed only) | Supabase client used by [`seed.py`](seed.py) for RPC/inserts |
| `ALPHA_VANTAGE_API_KEY` | No | If set, prices try Alpha Vantage first; otherwise Yahoo via yfinance |

---

### HTTP endpoints (mounted in `app.main`)

All API routes are under `/api` except **`GET /health`**.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness: `{ "status": "ok", "service": "biopharmer-api" }` |
| GET | `/api/peers/{ticker}` | pgvector cosine-similarity peers + clinical metrics for DMD tickers |
| GET | `/api/universe` | Universe listing for hub/compare flows |
| POST | `/api/compare` | Side-by-side comparison payload (see OpenAPI schema) |
| GET | `/api/diligence/personas` | JSON list of **user personas** for the Research Barn UI |
| POST | `/api/diligence/start` | **Start** a Research Barn thread: ticker, research question, persona, max iterations |
| POST | `/api/diligence/resume` | **Continue** a paused thread with optional human steering (`human_directive`; empty = “continue as-is”) |
| GET | `/api/prices/{ticker}` | Daily prices (`period` query; Alpha Vantage when configured, else Yahoo — see below) |
| POST | `/api/milestone/analyze` | Short AI analysis for a single milestone (timeline modal) |

**Valid DMD tickers** for diligence and peers: `DYNE`, `SRPT`, `WVE`.

**Removed / not shipped:** there is no `GET /api/diligence/{ticker}` parallel-debate endpoint; diligence is **only** the iterative start/resume flow in [`app/agents/iterative_war_room.py`](app/agents/iterative_war_room.py).

---

### Research Barn API (request / response)

**`POST /api/diligence/start`** — body (`application/json`):

| Field | Type | Notes |
|-------|------|--------|
| `ticker` | string | One of `DYNE`, `RNA`, `SRPT`, `WVE` |
| `user_focus` | string | Investor’s research question |
| `user_persona` | string | Optional; default `"Clinical Mechanism Analyst"`; must be one of the strings returned by `/api/diligence/personas` |
| `max_iterations` | int | Default `2`, range `1–5` — full orchestrator→explorer→critic rounds before synthesis |

**`POST /api/diligence/resume`** — body:

| Field | Type | Notes |
|-------|------|--------|
| `thread_id` | string | From the prior `WarRoomResponse` |
| `human_directive` | string | Optional; use `""` to continue without a specific steer |

**Response** (`WarRoomResponse`): `thread_id`, `status` (`paused` | `complete`), `ticker`, `iterations_completed`, `max_iterations`, `transcript`, `suggested_directions`, `interim_summary`, and `synthesis` (populated when complete).

**Operational note:** Thread state is held **in memory** on the API process (`_sessions` in `iterative_war_room.py`). A **server restart** drops paused threads—clients should treat `thread_id` as best-effort until you add external persistence.

### Explorer tools

Explorers share a `gpt-4o` model with tool-calling enabled. Three tools are available; the prompt instructs explorers to use them only when they add concrete evidence.

| Tool | External API | What it returns |
|------|-------------|-----------------|
| `pgvector_peers` | Internal Postgres | Cosine-similarity peers for the ticker — similarity score, Emax %, half-life, Grade 3+ AE rate |
| `openfda_adverse_events` | [openFDA](https://open.fda.gov/apis/drug/event/) | Adverse event reports for a drug or compound name — seriousness flag and MedDRA reaction terms |
| `clinicaltrials_lookup` | [ClinicalTrials.gov v2 API](https://clinicaltrials.gov/data-api/api) | Trial phase, status, enrollment, primary completion date, primary endpoint, and sponsor — no API key required |

---

### Prices

`GET /api/prices/{ticker}?period=...`

- **Alpha Vantage** when `ALPHA_VANTAGE_API_KEY` is set (subject to free-tier limits); otherwise **Yahoo Finance** via [yfinance](https://github.com/ranaroussi/yfinance).
- `DYNE` maps to **`DYN`** on Yahoo (see `YAHOO_SYMBOLS` in [`app/yahoo_prices.py`](app/yahoo_prices.py)).
- For long ranges (`2y`, `5y`, `max`, …), Yahoo is typically used. On error or rate limits, behavior falls back as implemented in [`app/routers/prices.py`](app/routers/prices.py).

Uses the same DB context as peers for ticker validation where applicable.

---

## Phase 1 — Database setup and seed

### Prerequisites

- Python 3.11+ recommended (project tested with modern 3.x)
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

   Paste the contents of [`schema.sql`](schema.sql) into the Supabase SQL editor and execute.

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
     → Embedding SRPT (Sarepta Therapeutics) … done
     → Embedding WVE (Wave Life Sciences) … done

   [3/3] Seeding clinical_metrics …
     → DYNE … done
     → SRPT … done
     → WVE … done

   ============================================================
   Seed complete. Tables populated:
     • dmd_mechanisms  — 3 rows with 1536-dim embeddings
     • clinical_metrics — 3 rows with mock Phase 1/2 data
   ============================================================
   ```

### Schema overview

```
dmd_mechanisms
  id             bigserial PK
  ticker         text UNIQUE          -- DYNE | SRPT | WVE
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

The `embedding` column is indexed with `ivfflat` (cosine ops) for peer-similarity queries used by `/api/peers` and by explorer tools in the Research Barn.

---

## Admin / ETL (optional)

[`app/routers/etl.py`](app/routers/etl.py) defines ingestion helpers; it is **not** mounted in [`app/main.py`](app/main.py) in the default app. Wire it only if you extend the app to expose those routes.
