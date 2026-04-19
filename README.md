# Biopharmer

**Biopharmer** is a research workspace for **biotech investing**: fund analysts, serious retail investors, and anyone who needs to connect **market behavior** to **mechanism-level science** without jumping between terminals, PDFs, and scattered databases. The product is built around a **live Duchenne muscular dystrophy (DMD) coverage slice** (four names, timelines, prices) and a **multi-agent diligence loop**—the **Research Barn**—that runs structured debate, critique, and synthesis on whatever you ask about a ticker.

---

## Option A — Multi-agent system for scientific ideation (how this repo answers the brief)

The product is designed against **Option A**: *multiple agents collaborating on a research problem—generating ideas, critiquing each other, and converging on something useful.* The user poses a **question**; agents **explore independently**, **challenge each other’s reasoning**, and the system **distills** the conversation into **structured, actionable** output. **Think debate, not consensus**—the value is **friction between perspectives**, not a single smoothed summary.

**Scope tradeoff (same architecture, different domain):** Example prompts in the brief are *open-ended research* (“novel loss functions for small language models”, “approaches to causal inference in sparse time-series data”). Biopharmer **narrows the question space** to **investable biotech diligence** on a **ticker** in the DMD slice, so every run is grounded in **Postgres context, embeddings, and market-adjacent tools**—the same *orchestration pattern*, with **investment questions** instead of arbitrary ML theory. Example Research Barn questions in that spirit:

- *“What would change my mind on regulatory risk for SRPT’s label before the next data cut?”*
- *“How does DYNE’s exon-51 story compare to RNA’s AOC path on durability evidence—not headlines?”*
- *“If PRECISION-DMD disappoints, what’s left of the bull case on mechanism alone?”*

| What Option A asks for | What matters | How Biopharmer delivers |
|------------------------|--------------|-------------------------|
| **Real multi-agent orchestration** — not sequential prompting dressed up as agents | Independent branches, real parallelism, distinct roles | Each round: **orchestrator** → **three parallel explorers** (`asyncio.gather`) → **two parallel critics** → steering generator → optional **synthesizer**—not one chain-of-thought pretending to be a committee. |
| **Visible, legible agent activity** | The user can follow what’s happening | **Transcript** with `role`, named `agent`, and **iteration**; UI shows per-round debate before the next steer. |
| **Output that is specific and useful** — not generic summaries | Grounded, ranked or structured, actionable | **Schema-constrained synthesis** (summary, findings, investor considerations, watch item); prompts force **ticker + research question** alignment; **pgvector + clinical_metrics + tools** reduce generic fluff. |
| **Human intervention** — steer, pin, kill threads | Scientist/investor steers without redeploying prompts | **Shipped:** steer via **suggested pills**, **custom directive**, **continue-as-is**, **persona**, **max iterations**, same **`thread_id`** across resumes. **Not yet:** **pin / kill** individual branches—see [`docs/OPTION_A_ROADMAP.md`](docs/OPTION_A_ROADMAP.md). |

---

## The Research Barn: why the agent loop is the product

The Research Barn is not a chat sidebar. It is an **iterative, human-steered diligence engine** that sits at the center of Biopharmer’s value: you bring a **research question** and an **investor persona**, and the system runs **repeatable rounds** of orchestrated debate until you hit your iteration limit—then it delivers a **structured synthesis** (summary, key findings, investor considerations, one forward **watch item**).

**What one “round” does**

1. **Context load** — Pulls mechanism text, company name, clinical metrics, and **pgvector-ranked scientific peers** from Postgres for the chosen ticker.
2. **Orchestrator** — Reads your question (and any **steering** you added after a prior round), tailors angles to your **persona**, and posts **2–3 combative debate angles** to the transcript.
3. **Explorers (parallel)** — Up to **three** specialist explorers run **concurrently** (`asyncio.gather`). Each picks an angle aligned with its role and may call **tools** (see below). Their outputs are appended to the transcript as distinct voices.
4. **Critics (parallel)** — **Two** adversarial critics attack the explorers’ logic for that round—missing data, regulatory risk, competition, valuation sensitivity—also in parallel.
5. **Steering prep** — A fast model produces an **interim summary** of the round and **three suggested “next move” directives** (clickable pills in the UI) aligned with your persona.
6. **Human checkpoint** — The run **pauses**. You choose how the next round should go: **continue as-is** (let the orchestrator improvise), pick a **suggested direction**, or type a **custom directive**. The backend resumes the same **thread** with your choice via `POST /api/diligence/resume`.
7. **Synthesis** — After the configured number of rounds completes, a **synthesizer** turns the full transcript plus context into **JSON**: research summary, key findings, investor-stance considerations, and a single **watch list** line—grounded in what was actually argued, not generic company copy.

So the “loop” is: **orchestrate → explore (tools) → criticize → summarize & suggest → *you steer* → repeat → synthesize.** Friction is intentional: you see **who said what**, you **inject judgment between rounds**, and the final output is **schema-shaped** for diligence, not a single blob of consensus.

---

## Agents and roles (who shows up in the transcript)

| Role | Job |
|------|-----|
| **Orchestrator** | Frames 2–3 pointed debate angles for the round, respecting your persona and any human steering. |
| **Explorers** | Three parallel specialists (from a fixed roster—e.g. mechanism & efficacy, clinical & regulatory, competitive landscape, safety & execution, valuation & catalysts—**three run per round**). They defend one angle each with tool-backed evidence when useful. |
| **Critics** | Two parallel **skeptical buy-side** voices that stress-test the explorers’ arguments for the same round. |
| **Steering / routing (fast model)** | Compresses the round into a short **interim summary** and drafts **three steering pills** for the UI. |
| **Synthesizer** | After the last round, produces the final **structured** research output tied to your **research question**. |

**User-facing personas** (selected in the UI) shape how the orchestrator and steering options are phrased—e.g. clinical depth vs. regulatory vs. risk-arb—so the same ticker can be run with different **lenses**.

---

## Tools the explorers can use

Explorers share a tool-bound model (`gpt-4o` with tools). Available today:

| Tool | Purpose |
|------|---------|
| **`pgvector_peers`** | Returns the closest **scientific peers** for the DMD ticker from **cosine similarity** over mechanism embeddings—similarity score plus key **clinical_metrics** fields (e.g. Emax, half-life, Grade 3+ AE rate) so debate stays comparable to your database. |
| **`openfda_adverse_events`** | Queries **openFDA** drug/event data for a compound name—seriousness and reaction lines—when safety grounding matters. |

Tools are invoked **only when they add evidence**; the prompt discourages tool spam. Domain grounding still comes from the **pre-loaded context block** (mechanism + clinical table + peer list) on every round.

---

## Human-in-the-loop: what you control

- **Before a run:** **Ticker** (DMD universe), **research question**, **persona**, and **max iterations** (how many full orchestrator→explorer→critic cycles before automatic synthesis).
- **Between rounds:** **Steering**—use a suggested pill, type a custom directive, or **continue as-is** (empty directive) so the orchestrator sets the next angles without a specific instruction.
- **Thread continuity:** Each run has a **`thread_id`**; resume calls attach your steering to that thread so the transcript stays one continuous debate.

Full **pin / kill / fork**-style controls are discussed in [`docs/OPTION_A_ROADMAP.md`](docs/OPTION_A_ROADMAP.md); the shipped MVP is this **narrow loop + visible transcript + steering**.

---

## Code pointers (Option A implementation)

The iterative loop lives in [`backend/app/agents/iterative_war_room.py`](backend/app/agents/iterative_war_room.py). The HTTP API is [`backend/app/routers/diligence.py`](backend/app/routers/diligence.py): `POST /api/diligence/start`, `POST /api/diligence/resume`, `GET /api/diligence/personas`. **Session state** is **in-memory** keyed by `thread_id`—see [`backend/README.md`](backend/README.md) for deploy caveats.

---

## Product vision

Biopharmer bridges **financial markets** and **clinical science** in one place: price and milestones on a **timeline**, peer similarity on a **map**, and **diligence** in the Research Barn—so “what should I believe about this name?” is answerable from **structured data, embeddings, and recorded multi-agent reasoning**, not a single generic chat turn.

---

## Tech stack

| Layer | Choices |
|--------|--------|
| **Frontend** | [Next.js](https://nextjs.org/) 14 (App Router), React 18, TypeScript, Tailwind CSS, [Recharts](https://recharts.org/) for charts and timeline visuals |
| **Backend** | [FastAPI](https://fastapi.tiangolo.com/) (Python); agent loop implemented as **async node pipeline** with in-memory thread sessions (see `iterative_war_room.py`) |
| **Data & ML** | [Supabase](https://supabase.com/) Postgres with **[pgvector](https://github.com/pgvector/pgvector)** for embedding similarity; OpenAI chat + embeddings |
| **Market data** | [yfinance](https://github.com/ranaroussi/yfinance) (Yahoo) for daily prices; optional [Alpha Vantage](https://www.alphavantage.co/) when configured (see `backend/README.md`) |

Secrets stay in **`.env` / `.env.local`** (not committed). API and schema details live in **`backend/README.md`** and **`backend/schema.sql`**.

---

## Repository layout

```
backend/    # FastAPI app, agents, Supabase access, price providers
frontend/   # Next.js UI
docs/       # Roadmaps and design notes (e.g. OPTION_A_ROADMAP.md)
```

---

## Quick start (local)

1. **Backend:** see [backend/README.md](backend/README.md) — Python venv, `pip install -r requirements.txt`, configure `.env`, run `uvicorn`.
2. **Frontend:** `cd frontend && npm install && npm run dev` — default UI at `http://localhost:3000`, API URL via `NEXT_PUBLIC_API_URL` in `.env.local`.

---

## Disclaimer

Biopharmer is a **research and education** tool. It does not provide financial, investment, or medical advice. AI-generated outputs can be wrong; always verify material facts against primary sources and professional counsel.
