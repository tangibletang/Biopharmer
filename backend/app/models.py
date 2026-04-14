"""Pydantic response models for the Biopharmer API."""

from pydantic import BaseModel


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
