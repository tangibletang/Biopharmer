"""Pydantic response models for the Biopharmer API."""

from pydantic import BaseModel, Field


# ── /api/peers/{ticker} ────────────────────────────────────────────────────

class ClinicalSnapshot(BaseModel):
    emax_pct: float
    half_life_days: float
    grade_3_ae_pct: float
    audit_text: str
    approval_stage: str = ""        # Phase 2 | BLA Pending | Pre-BLA | Approved
    mechanism_class: str = ""       # ASO | AOC | Gene Therapy
    eligible_patient_pct: float = 0.0  # % of DMD patients eligible


class PeerResult(BaseModel):
    ticker: str
    company_name: str
    similarity: float          # cosine similarity [0, 1]; higher = more similar
    clinical: ClinicalSnapshot


class PeersResponse(BaseModel):
    base_ticker: str
    peers: list[PeerResult]


# ── /api/universe ─────────────────────────────────────────────────────────────

class UniverseTicker(BaseModel):
    ticker: str
    company_name: str
    clinical: ClinicalSnapshot


class UniverseResponse(BaseModel):
    tickers: list[UniverseTicker]


# ── /api/compare ──────────────────────────────────────────────────────────────

class CompareRequest(BaseModel):
    base_ticker: str
    compare_ticker: str


class CompareResponse(BaseModel):
    headline: str
    key_differences: list[str] = Field(default_factory=list)
    investment_angle: str


# ── /api/diligence — Iterative War Room ───────────────────────────────────────

class WarRoomStartRequest(BaseModel):
    ticker: str
    user_focus: str
    user_persona: str = "Clinical Mechanism Analyst"
    max_iterations: int = Field(default=2, ge=1, le=5)


class WarRoomResumeRequest(BaseModel):
    thread_id: str
    human_directive: str = ""


class TranscriptMessage(BaseModel):
    role: str          # orchestrator | explorer | critic
    agent: str
    content: str
    iteration: int = 0


class SynthesisOutput(BaseModel):
    research_summary: str
    key_findings: list[str] = Field(default_factory=list)
    investor_considerations: list[str] = Field(default_factory=list)
    watch_list: str


class WarRoomResponse(BaseModel):
    thread_id: str
    status: str                              # "paused" | "complete"
    ticker: str
    iterations_completed: int
    max_iterations: int
    transcript: list[TranscriptMessage] = Field(default_factory=list)
    suggested_directions: list[str] = Field(default_factory=list)
    interim_summary: str = ""
    synthesis: SynthesisOutput | None = None


# ── /api/prices/{ticker} (Alpha Vantage preferred, else Yahoo via yfinance) ─

class StockPricePoint(BaseModel):
    date: str
    price: float


class PricesResponse(BaseModel):
    ticker: str
    yahoo_symbol: str = Field(
        description="Listing symbol passed to the provider (e.g. DYNE → DYN).",
    )
    provider: str = Field(
        description="Which backend filled the series: alpha_vantage or yahoo_finance.",
    )
    source: str
    interval: str
    period: str
    currency: str | None = None
    prices: list[StockPricePoint]
