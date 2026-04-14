# Project: Biopharmer
**Objective:** Build an MVP for a biotech investing platform that contextualizes financial data with underlying biological mechanisms and multi-agent clinical diligence.

## 1. Technical Stack (Strict Constraints)
* **Frontend:** Next.js 14 (App Router) with Tailwind CSS.
* **Charting:** D3.js (used STRICTLY for math/scales/svg paths, React manages the DOM) and Recharts (for standard charts).
* **Backend:** FastAPI (Python) with async endpoints.
* **Database:** PostgreSQL with `pgvector` extension (hosted on Supabase).
* **AI/Orchestration:** LangGraph (for multi-agent state management) and direct OpenAI API calls.
* **Async/Caching:** Celery + Redis (configured for backend task queues, though mocked for this MVP).

## 2. Product Scope (The Duchenne Muscular Dystrophy "Micro-Universe")
To ensure high-fidelity responses without live-scraping rate limits, the MVP is constrained to a 4-company micro-universe: $DYNE, $RNA, $SRPT, and $WVE.

## Phase 1: Database & Seed Script
**Goal:** Initialize the vector database and populate the micro-universe.
1. Create a Python script (`seed.py`) using the `supabase` and `openai` clients.
2. Ensure the Supabase database has the `vector` extension enabled.
3. Create two tables:
   * `dmd_mechanisms`: `id`, `ticker` (unique), `company_name`, `mechanism_text`, `embedding` (vector 1536).
   * `clinical_metrics`: `ticker` (FK to dmd_mechanisms), `emax_pct`, `half_life_days`, `grade_3_ae_pct`, `audit_text`.
4. The script should embed mechanism descriptions for DYNE (AOC platform), RNA (AOC targeting TfR1), SRPT (AAVrh74 viral vector), and WVE (stereopure oligonucleotides) using `text-embedding-3-small`, and push the vectors and mock clinical metrics to the database.

## Phase 2: FastAPI Backend & LangGraph Agents
**Goal:** Build the API layer and the Multi-Agent War Room.
1. **API Setup:** Initialize FastAPI with CORS enabled for the Next.js frontend.
2. **Feature 2 Endpoint (`/api/peers/{ticker}`):** * Write a `pgvector` cosine similarity SQL query (`<=>`). 
   * Given a ticker, return its closest scientific peers and their clinical metrics from the DB.
3. **Feature 3 Endpoint (`/api/diligence/{ticker}`):**
   * Build a LangGraph state graph with three agents:
     * **Biologist Agent:** Defends the theoretical efficacy. Tool: `search_scientific_peers` (queries the pgvector DB).
     * **Toxicologist Agent:** Challenges safety. Tool: `search_adverse_events` (mocked to return Grade 3 AE data from the clinical table).
     * **Synthesizer Agent:** Distills the friction into a JSON object: `{"bull_case": "", "bear_case": "", "actionable_metric": ""}`.
   * Expose an endpoint that triggers this graph and returns the synthesized JSON.

## Phase 3: Next.js Frontend UI
**Goal:** Build the unified dashboard.
1. **Layout:** A professional, dark-mode financial terminal UI. A sidebar for ticker search and a main content area with three tabs (Timeline, Proximity Map, Diligence).
2. **Feature 1 (Timeline Tab):** Use Recharts to render a mock stock line chart for the selected ticker. Overlay clickable milestone markers that trigger a modal explaining the clinical event.
3. **Feature 2 (Proximity Map Tab):** Use D3.js `forceSimulation` to render a network graph of the companies. Nodes are pulled closer based on the similarity scores fetched from `/api/peers`. Clicking a node opens a Recharts Radar Chart comparing its `emax_pct`, `half_life_days`, and `grade_3_ae_pct` against the base ticker. Include an "Audit" button to display the `audit_text`.
4. **Feature 3 (War Room Tab):** A UI to trigger the `/api/diligence` endpoint. Show a loading state with steps ("Biologist analyzing...", "Toxicologist challenging..."). Render the final Synthesizer JSON output in a clean Bull vs. Bear matrix component.

## Option A (parallel War Room)

Parallel explorer/critic/synthesis for the **selected ticker** is implemented via `GET /api/diligence/{ticker}` (see `docs/OPTION_A_ROADMAP.md` for future session persistence and steering).
