export type Ticker = 'DYNE' | 'RNA' | 'SRPT' | 'WVE'

/** Nasdaq-style symbol for UI labels (Dyne is **DYN**). API paths still use the in-app id `DYNE`. */
export function displayTicker(t: Ticker | string): string {
  return t === 'DYNE' ? 'DYN' : t
}

export interface ClinicalSnapshot {
  emax_pct: number
  half_life_days: number
  grade_3_ae_pct: number
  audit_text: string
}

export interface PeerResult {
  ticker: string
  company_name: string
  similarity: number
  clinical: ClinicalSnapshot
}

export interface PeersResponse {
  base_ticker: string
  peers: PeerResult[]
}

// ── Iterative War Room ────────────────────────────────────────────────────────

export interface WarRoomStartRequest {
  ticker: string
  user_focus: string
  user_persona: string
  max_iterations: number
}

export interface WarRoomResumeRequest {
  thread_id: string
  human_directive: string
}

export interface TranscriptMessage {
  role: 'orchestrator' | 'explorer' | 'critic'
  agent: string
  content: string
  iteration: number
}

export interface SynthesisOutput {
  research_summary: string
  key_findings: string[]
  investor_considerations: string[]
  watch_list: string
}

export interface WarRoomResponse {
  thread_id: string
  status: 'paused' | 'complete'
  ticker: string
  iterations_completed: number
  max_iterations: number
  transcript: TranscriptMessage[]
  suggested_directions: string[]
  interim_summary: string
  synthesis: SynthesisOutput | null
}

export interface StockPoint {
  date: string
  price: number
}

/** GET /api/prices/{ticker} */
export interface PricesResponse {
  ticker: string
  yahoo_symbol: string
  /** alpha_vantage | yahoo_finance */
  provider: string
  source: string
  interval: string
  period: string
  currency: string | null
  prices: StockPoint[]
}

export interface Milestone {
  date: string
  label: string
  detail: string
  type: 'positive' | 'negative' | 'neutral'
  category: 'historical' | 'projected'
}

export interface TickerMeta {
  ticker: Ticker
  company_name: string
  color: string
  prices: StockPoint[]
  milestones: Milestone[]
}
