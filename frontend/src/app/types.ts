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

export interface DiligenceResponse {
  ticker: string
  steps: DiligenceStep[]
  synthesis: SynthesisOutput
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
