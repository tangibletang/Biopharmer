# Option A — Multi-Agent Scientific Ideation (Roadmap)

**Intent:** User poses an open research question; multiple agents explore in parallel, critique each other’s reasoning, and the system surfaces **ranked, actionable directions** — debate with friction, not a single linear summary.

**Principles:** visible agent activity, specific outputs, optional human steering (steer / pin / kill).

This document is the execution plan. It builds on the existing stack: **FastAPI**, **LangGraph**, **Postgres/Supabase**, **Next.js**, **OpenAI** (and any other APIs you plug in behind adapters).

---

## Current state (baseline)


| Area          | Today                                                                         |
| ------------- | ----------------------------------------------------------------------------- |
| Orchestration | Single linear graph: `fetch_context` → biologist → toxicologist → synthesizer |
| Input         | Fixed **ticker** diligence, not free-form research questions                  |
| Parallelism   | None (strictly sequential LLM steps)                                          |
| Persistence   | No session/thread store for runs                                              |
| UI            | War Room shows final steps + JSON, not a full trace or branches               |
| APIs          | OpenAI + DB; “any API” is possible but not formalized as **tool adapters**    |


---

## Target architecture (concise)

1. **Session-centric API** — `POST /sessions` (research question + options) → `GET /sessions/{id}` / SSE or poll for **events**.
2. **Orchestration** — LangGraph (or subgraphs): parallel **explorer** branches → per-branch **critic** → optional **debate rounds** → **merger/judge** producing ranked outputs.
3. **Persistence** — Tables: `research_sessions`, `threads` (hypotheses/branches), `messages` (agent turns, role, payload, parent id), optional `human_actions`.
4. **Tool layer** — Thin adapters (`embed`, `retrieve`, `llm_complete`, `external_api_x`) so swapping providers does not rewrite the graph.
5. **Frontend** — Run inspector: question → branches → timeline of messages; controls for steer / pin / kill (phased).

---

## Phase 1 — Observable parallel run (MVP of “real” multi-agent)

**Goal:** Prove parallel exploration + inspectable trace without full human-in-the-loop.

**Status:** Implemented — tables in `schema.sql` (Option A section), pipeline in `backend/app/agents/research_ideation.py`, API in `backend/app/routers/research.py`, **Research** tab in the Next.js app.

**Backend**

- [x] Postgres: `research_sessions`, `research_threads`, `research_messages`.
- [x] `POST /api/research/sessions` — `{ question, parallelism, max_rounds }` → `{ id, status: pending }`; work runs in FastAPI `BackgroundTasks` + `asyncio`.
- [x] Parallel **explorers** (rotating personas) → parallel **critics** → **merger** JSON (`ranked_directions`, `synthesis_note`).
- [x] `GET /api/research/sessions/{id}` — session + threads + messages + `final_output`.
- [ ] Optional: `GET /api/research/sessions/{id}/stream` (SSE).

**Frontend**

- [x] **Research** tab — question form, parallel branches (1–5), poll until complete/failed, branch trace + ranked output.

**Done when:** A user can submit one open-ended question and see **N parallel threads** and a **structured ranked output**, with full message history in the API response.

---

## Phase 2 — Debate loop (friction, not one shot)

**Goal:** Iterative critique; optional escalation when disagreement or uncertainty is high.

- Graph extension: `propose` → `attack` → `defend` → `judge` (or 2 rounds max), with **conditional edges** (e.g. only second round if judge confidence below threshold).
- Store **round** index on `messages`.
- Judge outputs: scores per thread (specificity, novelty, risk) — feed merger.

**Done when:** At least one run uses **multiple rounds** and persisted messages show round boundaries.

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
- Replacing the existing **ticker War Room** — keep it; Option A is a **new surface** (`/api/research/...`) until you decide to merge UX.

---

## Success metrics (pick 2–3 and track)

- User can name **which agent** said what for a given run (legibility).
- Ranked outputs score higher than baseline single-shot on a **blind** specificity rubric.
- Time-to-first useful direction (wall clock) under a defined cap.

---

## References (in-repo)

- Existing War Room graph: `backend/app/agents/war_room.py`
- Peers / embeddings (retrieval pattern): `backend/app/routers/peers.py`, `backend/seed.py`
- Product baseline: `project_spec.md`

