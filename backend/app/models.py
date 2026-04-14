"""Pydantic response models for the Biopharmer API."""

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
    step: str
    status: str                # "complete"
    output: str                # human-readable summary for this step


class SynthesisOutput(BaseModel):
    bull_case: str
    bear_case: str
    actionable_metric: str


class ParallelBranch(BaseModel):
    label: str
    explorer: str
    critic: str


class RankedDirectionItem(BaseModel):
    rank: int = 0
    title: str = ""
    rationale: str = ""
    key_risks: str = ""
    next_step: str = ""


class DiligenceResponse(BaseModel):
    ticker: str
    steps: list[DiligenceStep]
    synthesis: SynthesisOutput
    parallel_branches: list[ParallelBranch] = Field(default_factory=list)
    ranked_directions: list[RankedDirectionItem] = Field(default_factory=list)
    synthesis_note: str | None = None
