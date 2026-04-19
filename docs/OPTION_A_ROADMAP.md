# Option A — Multi-Agent Scientific Ideation (Roadmap)

**Intent:** User poses an open research question; multiple agents explore in parallel, critique each other’s reasoning, and the system surfaces **ranked, actionable directions** — debate with friction, not a single linear summary.

**Principles:** visible agent activity, specific outputs, optional human steering (steer / pin / kill).

This document is the execution plan. It builds on the existing stack: **FastAPI**, **LangGraph**, **Postgres/Supabase**, **Next.js**, **OpenAI** (and any other APIs you plug in behind adapters).

---

## Current state (shipped)

Aligned with the **Option A** brief in the root [`README.md`](../README.md) (*question → parallel exploration → critique → distill; debate not consensus; human steer*).

| Area | Today |
|------|--------|
| **Orchestration** | **Iterative Research Barn** in [`backend/app/agents/iterative_war_room.py`](../backend/app/agents/iterative_war_room.py): `load_context` → **orchestrator** → **parallel explorers** → **parallel critics** → **steering options** → pause; repeat; then **synthesizer** when `max_iterations` reached. |
| **Input** | User **research question** + **ticker** (DMD universe) + **persona** + **max iterations** — not open-ended arXiv topics; intentional scope tradeoff for grounding. |
| **Parallelism** | **Yes** — `asyncio.gather` for explorers and for critics each round. |
| **Persistence** | **In-process** `_sessions` keyed by `thread_id` (lost on API restart). No DB-backed `research_sessions` writes yet. |
| **UI** | **Research Barn** tab: transcript, interim summary, steering pills, run/resume. Timeline + map elsewhere. |
| **APIs** | `POST /api/diligence/start`, `POST /api/diligence/resume`, `GET /api/diligence/personas`. Explorers use **tools**: `pgvector_peers`, `openfda_adverse_events`. |

**Legacy note:** Older docs referred to `GET /api/diligence/{ticker}` and `parallel_debate.py`; those paths are **not** the current implementation.

---

## Target architecture (concise)

1. **Session-centric API** — `POST /sessions` (research question + options) → `GET /sessions/{id}` / SSE or poll for **events**.
2. **Orchestration** — LangGraph (or subgraphs): parallel **explorer** branches → per-branch **critic** → optional **debate rounds** → **merger/judge** producing ranked outputs.
3. **Persistence** — Tables: `research_sessions`, `threads` (hypotheses/branches), `messages` (agent turns, role, payload, parent id), optional `human_actions`.
4. **Tool layer** — Thin adapters (`embed`, `retrieve`, `llm_complete`, `external_api_x`) so swapping providers does not rewrite the graph.
5. **Frontend** — Run inspector: question → branches → timeline of messages; controls for steer / pin / kill (phased).

---

## Phase 1 — Observable parallel run (MVP of “real” multi-agent)

**Goal:** Prove parallel exploration + inspectable trace; **debate-shaped** output.

**Status:** **Delivered** in the **iterative Research Barn** (`iterative_war_room.py` + `POST /api/diligence/start` / `resume`). Each *round* runs parallel explorers and parallel critics; final **synthesis JSON** replaces the older single-shot “merger matrix” shape.

**Backend**

- [x] Parallel **explorers** (specialist personas) → parallel **critics** → round **interim summary** + **three steering directions** → user **resume** with steering.
- [x] **Structured synthesis** after last round: `research_summary`, `key_findings`, `investor_considerations`, `watch_list`.
- [ ] Optional: persisted session IDs + SSE if you want async UX without polling.

**Frontend**

- [x] **Research Barn** — transcript, steering UI, synthesis panel.

**Legacy:** `research_sessions` / `research_threads` / `research_messages` in `schema.sql` are optional; nothing in the current app writes to them.

**Done when:** A user can submit a **research question** on a ticker and see **parallel agent turns**, **friction** between explorers and critics, and a **structured** final output—with **full message history** in the API response. *(Met for ticker-scoped diligence; open-ended ML-style questions are a non-goal for this product.)*

---

## Phase 2 — Debate loop (friction, not one shot)

**Goal:** Iterative critique; optional escalation when disagreement or uncertainty is high.

**Status:** **Partially met** — the Research Barn already runs **multiple rounds** (`max_iterations`) with **orchestrator → explorers → critics** each time and **human steering** between rounds. Remaining Phase 2 ideas:

- **Conditional edges** (e.g. second round only if a “judge” score is below threshold) — not implemented; every run does full rounds up to `max_iterations`.
- **Persisted** `messages` with **round** index in Postgres — not implemented (in-memory only).

**Done when (stretch):** Round boundaries and optional conditional branching are **durable** in DB and visible in an inspector UI.

---

## Phase 3 — Human-in-the-loop

**Goal:** Scientist steers without redeploying prompts.

- `POST /api/research/sessions/{id}/steer` — body: `{ "instruction": str }` — inject as next human/system message and **resume** graph from checkpoint.
- `POST .../pin` / `.../kill` — update `threads.status` (`pinned` / `cancelled`); merger **must** include pinned threads; killed threads excluded from synthesis.
- UI: text box “Steer”, buttons Pin/Kill on thread cards; show injected steering in timeline.

**Done when:** A mid-run instruction visibly changes downstream outputs; pinned thread always appears in final ranking path.

---

## Phase 4 — Quality, eval, and adapters

**Goal:** Specific, non-generic outputs; swappable backends.

- **Rubric** in merger/judge prompts (explicit criteria: falsifiability, next experiment, evidence gap).
- **Eval set:** small JSONL of questions + human rubric scores; optional LLM-as-judge with spot checks.
- **Tool registry:** interface `Tool(name, invoke)`; register OpenAI, pgvector retrieval, future APIs; graph only calls registry.
- **Cost guards:** max tokens, max parallel branches, timeout per node.

**Done when:** Regression script can run N golden questions and compare scores week over week.

---

## Phase 5 — Product hardening

- Auth (if multi-user): session ownership.
- Rate limits and idempotency keys on `POST /sessions`.
- Observability: structured logs per `session_id` / `thread_id`.
- Docs: operator runbook + prompt version pinning (git hash or table column).

---

## Milestone order (recommended)

1. **Phase 1** — highest leverage: parallel + persistence + UI trace + ranked JSON.
2. **Phase 4 (partial)** — tool registry + rubric early so outputs don’t stay generic.
3. **Phase 2** — debate rounds once traces are stable.
4. **Phase 3** — steering once users can see threads.
5. **Phase 5** — as you approach external testers.

---

## Non-goals (initially)

- Full autonomous web browsing without citations guardrails.
- **Open-ended** “scientific ideation” prompts with no ticker/DB grounding (e.g. generic ML theory)—the **architecture** matches Option A; the **domain** is **biotech diligence** by design ([`README.md`](../README.md)).
- Further Option A work: **durable** session store, **pin/kill** threads, SSE—see Phase 3–5.

---

## Success metrics (pick 2–3 and track)

- User can name **which agent** said what for a given run (legibility).
- Ranked outputs score higher than baseline single-shot on a **blind** specificity rubric.
- Time-to-first useful direction (wall clock) under a defined cap.

---

## References (in-repo)

- **Iterative Research Barn (Option A loop):** `backend/app/agents/iterative_war_room.py`
- **Peer search helper (embeddings):** `backend/app/agents/war_room.py`
- **Peers API:** `backend/app/routers/peers.py`, `backend/seed.py`
- **Product baseline:** `project_spec.md`

