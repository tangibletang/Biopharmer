"""Pydantic response models for the Biopharmer API."""

from datetime import datetime

from pydantic import BaseModel, Field


# ── /api/peers/{ticker} ────────────────────────────────────────────────────

class ClinicalSnapshot(BaseModel):
    emax_pct: float
    half_life_days: float
    grade_3_ae_pct: float
    audit_text: str


class PeerResult(BaseModel):
    ticker: str
    company_name: str
    similarity: float          # cosine similarity [0, 1]; higher = more similar
    clinical: ClinicalSnapshot


class PeersResponse(BaseModel):
    base_ticker: str
    peers: list[PeerResult]


# ── /api/diligence/{ticker} ────────────────────────────────────────────────

class DiligenceStep(BaseModel):
    step: str                  # "biologist" | "toxicologist" | "synthesizer"
    status: str                # "complete"
    output: str                # raw LLM analysis for that step


class SynthesisOutput(BaseModel):
    bull_case: str
    bear_case: str
    actionable_metric: str


class DiligenceResponse(BaseModel):
    ticker: str
    steps: list[DiligenceStep]
    synthesis: SynthesisOutput


# ── /api/research/sessions (Option A Phase 1) ─────────────────────────────────

class ResearchSessionCreate(BaseModel):
    question: str = Field(..., min_length=8, max_length=8000)
    parallelism: int = Field(3, ge=1, le=5)
    max_rounds: int = Field(1, ge=1, le=3)


class ResearchMessageOut(BaseModel):
    role: str
    agent_name: str | None = None
    content: str
    metadata: dict = Field(default_factory=dict)
    created_at: datetime


class ResearchThreadOut(BaseModel):
    id: str
    label: str
    status: str
    sort_order: int
    created_at: datetime
    messages: list[ResearchMessageOut]


class ResearchSessionDetail(BaseModel):
    id: str
    question: str
    status: str
    config: dict = Field(default_factory=dict)
    error_message: str | None = None
    final_output: dict | None = None
    created_at: datetime
    updated_at: datetime
    threads: list[ResearchThreadOut]


class ResearchSessionCreateResponse(BaseModel):
    id: str
    status: str
