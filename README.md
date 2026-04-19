# Biopharmer

**Live demo:** https://biopharmer.vercel.app/

During my internship at Dyne Therapeutics, I realized that applying rigorous scientific research could give an edge in biotech investing. Using my Roth IRA, I performed very well on an investment simply informed by a literature review I participated in. It reinforced a simple thesis: if the science is good, the company has a good chance of succeeding.

Typically, casual stock investors (a lot of college students) will invest in companies they know or are familiar with. Think: Apple, Amazon, or Meta. Most people don't interact with biotech companies in their everyday lives. Additionally, biotech stock prices tend to swing violently based on clinical milestones and data readouts. Combined with the fact that clinical trial news, upcoming milestones, and drug development for biotech companies is often scattered or trapped behind paywalls, biotech investing becomes daunting and tedious.

I made Biopharmer targeted towards casual investors with some minor biology/biotech domain knowledge that they can use to make investment decisions.

Biopharmer consolidates this workflow into a single research workspace. I believe you shouldn't have to hunt down papers on PubMed or subscribe to 10 free trials to track upcoming events, stock prices, and potential market warnings. Users get a live price timeline with clinical milestones and a mechanism similarity map. At its core is the Research Barn: a multi-agent diligence engine where adversarial AI agents independently research, debate, and critique each other's findings on any ticker. With tools allowing agents to pull from PubMed, openFDA, and pgvector-ranked scientific peers, it acts as a strategy board to synthesize complex data and strip away the uncertainty.

Currently built around a live Duchenne muscular dystrophy (DMD) coverage slice (DYNE, SRPT, WVE).

> **Note:** See [SUBMISSION.md](SUBMISSION.md) for how the Research Barn answers the Option A brief—agent roles, tools, human-in-the-loop controls, and code pointers.

---

## Tech stack

| Layer | Choices |
|-------|---------|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Recharts — hosted on [Vercel](https://vercel.com/) |
| **Backend** | FastAPI (Python); async agent pipeline with in-memory thread sessions — hosted on [Railway](https://railway.app/) |
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
