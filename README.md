# Biopharmer

**Biopharmer** is a research terminal for **biotech investing**: fund analysts, serious retail investors, and anyone who needs to connect **market behavior** to **mechanism-level science** without jumping between terminals, PDFs, and scattered databases. It is built as an MVP around a small **Duchenne muscular dystrophy (DMD)** micro-universe so responses stay grounded and fast.

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
