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

/** /api/research/sessions — Option A ideation */
export interface ResearchMessage {
  role: string
  agent_name: string | null
  content: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface ResearchThread {
  id: string
  label: string
  status: string
  sort_order: number
  created_at: string
  messages: ResearchMessage[]
}

export interface RankedDirection {
  rank: number
  title: string
  rationale: string
  key_risks: string
  next_step: string
}

export interface ResearchFinalOutput {
  ranked_directions?: RankedDirection[]
  synthesis_note?: string
  parse_error?: boolean
}

export interface ResearchSessionDetail {
  id: string
  question: string
  status: string
  config: Record<string, unknown>
  error_message: string | null
  final_output: ResearchFinalOutput | null
  created_at: string
  updated_at: string
  threads: ResearchThread[]
}
