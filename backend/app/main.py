"""
Biopharmer FastAPI application entry point.

Run with:
    uvicorn app.main:app --reload --port 8000
"""

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import peers, diligence, prices

app = FastAPI(
    title="Biopharmer API",
    description=(
        "Biotech investing platform — contextualizes financial data with "
        "biological mechanisms and multi-agent clinical diligence."
    ),
    version="0.1.0",
)

# ── CORS (allow the Next.js dev server and any Vercel preview URL) ──────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ─────────────────────────────────────────────────────────────────
app.include_router(peers.router,     prefix="/api", tags=["peers"])
app.include_router(diligence.router, prefix="/api", tags=["diligence"])
app.include_router(prices.router,   prefix="/api", tags=["prices"])


# ── Health check ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok", "service": "biopharmer-api"}
