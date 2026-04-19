# Biopharmer

During my internship at Dyne Therapeutics, I realized that applying rigorous scientific research could give an edge in biotech investing. With my Roth IRA contribution, I performed very well on an investment simply informed by a literature review I participated in. It reinforced a simple thesis: if the science is good, the company has a good chance of succeeding.

In biotech, valuations swing violently based on clinical milestones and data readouts—yet most investors sit on the sidelines because the necessary information is scattered, siloed, or trapped behind paywalls. You shouldn't have to hunt down papers on PubMed or subscribe to 10 free trials to track upcoming events, stock prices, and potential market warnings.

Biopharmer consolidates this workflow into a single research workspace. Users get a live price timeline with clinical milestones, a mechanism similarity map, and the **Research Barn**—a multi-agent diligence engine where adversarial AI agents independently research, debate, and critique each other's findings on any ticker, pulling from PubMed, openFDA, and pgvector-ranked scientific peers.

Currently built around a live Duchenne muscular dystrophy (DMD) coverage slice (DYNE, SRPT, WVE).

> **Note** See [SUBMISSION.md](SUBMISSION.md) for how the Research Barn answers the Option A brief—agent roles, tools, human-in-the-loop controls, and code pointers.

---

## Tech stack

| Layer | Choices |
|-------|---------|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Recharts |
| **Backend** | FastAPI (Python); async agent pipeline with in-memory thread sessions |
| **Data & ML** | Supabase Postgres + pgvector for embedding similarity; OpenAI chat + embeddings |
| **Market data** | yfinance (Yahoo Finance) for daily prices; optional Alpha Vantage when configured |

Secrets stay in `.env` / `.env.local` (not committed). Full API and schema details are in [`backend/README.md`](backend/README.md).

---

## Repository layout

```
backend/    # FastAPI app, agents, Supabase access, price providers
frontend/   # Next.js UI
docs/       # Roadmaps and design notes
```

---

## Quick start (local)

1. **Backend:** see [backend/README.md](backend/README.md) — Python venv, `pip install -r requirements.txt`, configure `.env`, `uvicorn app.main:app --reload`.
2. **Frontend:** `cd frontend && npm install && npm run dev` — UI at `http://localhost:3000`, API URL via `NEXT_PUBLIC_API_URL` in `.env.local`.

---

## Disclaimer

Biopharmer is a research and education tool. It does not provide financial, investment, or medical advice. AI-generated outputs can be wrong; always verify material facts against primary sources and professional counsel.
