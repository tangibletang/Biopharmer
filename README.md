# Biopharmer

**Biopharmer** is a research terminal for **biotech investing**: fund analysts, serious retail investors, and anyone who needs to connect **market behavior** to **mechanism-level science** without jumping between terminals, PDFs, and scattered databases. It is built as an MVP around a small **Duchenne muscular dystrophy (DMD)** micro-universe so responses stay grounded and fast.

---

## Take-home alignment — Option A: Multi-agent scientific ideation

This repository is a working prototype for **Option A** from the brief: *multiple agents collaborating on a problem—generating ideas, critiquing each other, and converging on ranked, actionable output with visible friction, not fake consensus.*

| Criterion | How Biopharmer implements it |
|-----------|------------------------------|
| **Real multi-agent orchestration** | The **War Room** pipeline is **not** one long chain of prompts. It runs **N parallel explorer agents** (distinct investment personas), then **N parallel critic passes**—each critic only sees its paired explorer—then a **merger** model that produces structured JSON (`ranked_directions`, bull/bear, actionable metric). Concurrency is **async `asyncio.gather`** over independent LLM calls (`backend/app/agents/parallel_debate.py`), so branches truly run in parallel up to API limits. |
| **Visible, legible activity** | The **War Room** tab surfaces **per-branch explorer + critic text**, then **ranked directions** and **synthesis** first—users can read what each “agent” argued and how friction was resolved. |
| **Specific, useful output** | Merger output is **schema-constrained** (ranked theses, risks, next step, bull/bear, one forward **actionable metric**), grounded in a **ticker-specific brief** built from DB mechanism text, clinical metrics, and peer list—not a generic summary. |
| **Human intervention** | Users **choose parallelism** (`parallelism=1–5`) and the **ticker** (the “question” is effectively *diligence on this name in the DMD universe*). Full **steer / pin / kill thread** controls are specified in [`docs/OPTION_A_ROADMAP.md`](docs/OPTION_A_ROADMAP.md) (Phase 3) but are **not** shipped in this MVP—judgment call: ship narrow parallel debate + trace first. |

**What this adds beyond a generic multi-agent demo**

- **Domain grounding:** Embeddings + **pgvector** peers and **clinical_metrics** in Postgres seed every run—so “debate” is about a **real company thesis**, not an abstract prompt.
- **Integrated context:** **Timeline** (price + milestones) and **Proximity Map** (mechanism similarity) sit beside War Room so finance and biology stay in one terminal.
- **Narrow scope on purpose:** The “research question” is **ticker-scoped DMD diligence** rather than open-ended arXiv-style ideation—trading breadth for depth and inspectability within a **4-hour–style** slice.

---

## Product vision

Biopharmer is meant to bridge **financial markets** and **clinical science** in one place. Price moves are shown next to the trial readouts, regulatory events, and mechanism context that plausibly drove them—so “why did the stock move?” becomes answerable from **structured data and embeddings**, not guesswork. Scientific peers are discovered with **vector similarity** over mechanism text, then compared on **standardized clinical metrics**. A **multi-agent “War Room”** runs structured exploration and critique over each name’s thesis, then synthesizes bull/bear angles and ranked directions—useful for **institutional-style risk framing** (what could break the story, and what to watch next), not for trading signals.

Together, that satisfies the core criteria we care about: **verifiable catalyst–price context**, **quantitative peer comparison**, and **debate-style diligence** grounded in your database and models—not generic chat.

---

## Tech stack

| Layer | Choices |
|--------|--------|
| **Frontend** | [Next.js](https://nextjs.org/) 14 (App Router), React 18, TypeScript, Tailwind CSS, [Recharts](https://recharts.org/) for charts and timeline visuals |
| **Backend** | [FastAPI](https://fastapi.tiangolo.com/) (Python), [LangGraph](https://github.com/langchain-ai/langgraph) / LangChain for agent workflows |
| **Data & ML** | [Supabase](https://supabase.com/) Postgres with **[pgvector](https://github.com/pgvector/pgvector)** for embedding similarity; OpenAI embeddings + chat models |
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
