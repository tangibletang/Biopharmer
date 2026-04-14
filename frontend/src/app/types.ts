export type Ticker = 'DYNE' | 'RNA' | 'SRPT' | 'WVE'

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

export interface DiligenceStep {
  step: string
  status: string
  output: string
}

export interface SynthesisOutput {
  bull_case: string
  bear_case: string
  actionable_metric: string
}

export interface ParallelBranch {
  label: string
  explorer: string
  critic: string
}

export interface RankedDirectionItem {
  rank: number
  title: string
  rationale: string
  key_risks: string
  next_step: string
}

export interface DiligenceResponse {
  ticker: string
  steps: DiligenceStep[]
  synthesis: SynthesisOutput
  parallel_branches: ParallelBranch[]
  ranked_directions: RankedDirectionItem[]
  synthesis_note: string | null
}

export interface StockPoint {
  date: string
  price: number
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
