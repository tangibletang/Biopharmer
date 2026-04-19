# Biopharmer — Option A Submission

## How this repo answers the brief

The brief asks for *multiple agents collaborating on a research problem—generating ideas, critiquing each other, and converging on something useful.* The user poses a **question**; agents **explore independently**, **challenge each other's reasoning**, and the system **distills** the conversation into **structured, actionable** output.


| What Option A asks for | How Biopharmer delivers |
|------------------------|------------------------|
| Real multi-agent orchestration | Each round: orchestrator → three parallel explorers (`asyncio.gather`) → two parallel critics → steering generator → optional synthesizer. |
| Visible, legible agent activity | Transcript with `role`, named `agent`, and `iteration`; UI shows per-round debate before the next steer. |
| Output that is specific and useful | Schema-constrained synthesis (summary, findings, investor considerations, watch item); prompts force ticker + research question alignment; pgvector + clinical_metrics + tools reduce generic fluff. |
| Human intervention — steer, pin, kill threads | Shipped: steer via suggested pills, custom directive, continue-as-is, persona, max iterations, same `thread_id` across resumes. Planned: pin / kill individual branches—see [`docs/OPTION_A_ROADMAP.md`](docs/OPTION_A_ROADMAP.md). |

---


## The Research Barn: why the agent loop is the product

The Research Barn is an **iterative, human-steered diligence engine**: you bring a **research question** and an **investor persona**, and the system runs **repeatable rounds** of orchestrated debate until you hit your iteration limit—then it delivers a **structured synthesis** (summary, key findings, investor considerations, one forward watch item).

**What one "round" does**

1. **Context load** — Pulls mechanism text, clinical metrics, and pgvector-ranked scientific peers from Postgres for the chosen ticker.
2. **Orchestrator** — Reads your question (and any steering from a prior round), tailors angles to your persona, posts 2–3 combative debate angles to the transcript.
3. **Explorers (parallel)** — Up to three specialist explorers run concurrently (`asyncio.gather`). Each picks an angle aligned with its role and may call tools. Their outputs are appended as distinct voices.
4. **Critics (parallel)** — Two adversarial critics attack the explorers' logic—missing data, regulatory risk, competition, valuation sensitivity—also in parallel.
5. **Steering prep** — A fast model produces an interim summary and three suggested "next move" directives (clickable pills in the UI) aligned with your persona.
6. **Human checkpoint** — The run **pauses**. You continue as-is, pick a suggested direction, or type a custom directive. The backend resumes the same thread via `POST /api/diligence/resume`.
7. **Synthesis** — After all rounds complete, a synthesizer turns the full transcript into JSON: research summary, key findings, investor-stance considerations, and a single watch-list line—grounded in what was actually argued.

Loop: **orchestrate → explore (tools) → criticize → summarize & suggest → *you steer* → repeat → synthesize.**

---

## Agents and roles

| Role | Job |
|------|-----|
| **Orchestrator** | Frames 2–3 pointed debate angles for the round, respecting your persona and any human steering. |
| **Explorers** | Three parallel specialists (drawn from: mechanism & efficacy, clinical & regulatory, competitive landscape, safety & execution, valuation & catalysts). They defend one angle each with tool-backed evidence when useful. |
| **Critics** | Two parallel skeptical buy-side voices that stress-test the explorers' arguments for the same round. |
| **Steering / routing** | Compresses the round into a short interim summary and drafts three steering pills for the UI. |
| **Synthesizer** | After the last round, produces the final structured research output tied to your research question. |

User-facing personas (Clinical Analyst, Regulatory Hawk, Investor) shape how the orchestrator and steering options are phrased so the same ticker can be run with different lenses.

---

## Tools the explorers can use

Explorers share a tool-bound model (`gpt-4o` with tools):

| Tool | Purpose |
|------|---------|
| **`pgvector_peers`** | Returns the closest scientific peers for the DMD ticker from cosine similarity over mechanism embeddings—similarity score plus key clinical_metrics fields (Emax, half-life, Grade 3+ AE rate). |
| **`openfda_adverse_events`** | Queries openFDA drug/event data for a compound name—seriousness and reaction lines—when safety grounding matters. |
| **`clinicaltrials_lookup`** | Searches ClinicalTrials.gov for trials matching a drug name, compound, or company. Returns trial phase, status, enrollment, primary completion date, primary endpoint, and sponsor—grounding claims about readout timelines and trial design in primary source data. |

Tools are invoked only when they add evidence; the prompt discourages tool spam. Domain grounding also comes from a pre-loaded context block (mechanism + clinical table + peer list) on every round.

---

## Human-in-the-loop controls

- **Before a run:** Ticker (DMD universe), research question, persona, and max iterations.
- **Between rounds:** Steering—use a suggested pill, type a custom directive, or continue as-is.
- **Thread continuity:** Each run has a `thread_id`; resume calls attach your steering to that thread so the transcript stays one continuous debate.

Pin / kill / fork controls are discussed in [`docs/OPTION_A_ROADMAP.md`](docs/OPTION_A_ROADMAP.md); the shipped MVP is the narrow loop + visible transcript + steering.

---

## Code pointers

| What | Where |
|------|-------|
| Agent loop | [`backend/app/agents/iterative_war_room.py`](backend/app/agents/iterative_war_room.py) |
| HTTP endpoints | [`backend/app/routers/diligence.py`](backend/app/routers/diligence.py) — `POST /api/diligence/start`, `POST /api/diligence/resume`, `GET /api/diligence/personas` |
| Response models | [`backend/app/models.py`](backend/app/models.py) |
| Roadmap / phase plan | [`docs/OPTION_A_ROADMAP.md`](docs/OPTION_A_ROADMAP.md) |
| Backend API reference | [`backend/README.md`](backend/README.md) |

Session state is in-memory keyed by `thread_id`—see [`backend/README.md`](backend/README.md) for deploy caveats.
