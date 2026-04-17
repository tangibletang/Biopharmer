'use client'

import { useState } from 'react'
import type { Milestone } from '../types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface Props {
  milestone: Milestone
  ticker: string
  onClose: () => void
  onInvestigate?: (focus: string) => void
}

interface MilestoneAnalysis {
  explanation: string
  severity: 'Critical' | 'Meaningful' | 'Noise'
  severity_rationale: string
  peer_precedent: string
}

const TYPE_STYLES = {
  positive: { dot: 'bg-positive', badge: 'bg-positive/10 text-positive border-positive/30', label: 'POSITIVE' },
  negative: { dot: 'bg-negative', badge: 'bg-negative/10 text-negative border-negative/30', label: 'NEGATIVE' },
  neutral:  { dot: 'bg-accent',   badge: 'bg-accent/10 text-accent border-accent/30',       label: 'NEUTRAL'  },
}

const SEVERITY_STYLES = {
  Critical:   'bg-negative/10 text-negative border-negative/40',
  Meaningful: 'bg-[#e3b341]/10 text-[#e3b341] border-[#e3b341]/40',
  Noise:      'bg-muted/10 text-muted border-border',
}

function buildResearchAngles(milestone: Milestone, ticker: string) {
  const { label, detail, type, category } = milestone
  const outcome = type === 'positive' ? 'positive' : type === 'negative' ? 'negative' : 'mixed'
  const isProjected = category === 'projected'
  const tense = isProjected ? 'upcoming' : 'recent'

  // Detect event class from label keywords to sharpen questions
  const l = label.toLowerCase()
  const isTrialResult   = /trial|phase|data|readout|result|endpoint|efficacy|embark|precision/i.test(l)
  const isFdaAction     = /fda|nda|bla|pdufa|approval|label|indication|accelerated|pma/i.test(l)
  const isSafety        = /safety|ae|adverse|toxicity|death|liver|fatal|hold|pause/i.test(l)
  const isCommercial    = /launch|revenue|sales|market|commercial|prescription|reimburs/i.test(l)
  const isPartnership   = /partner|collaborat|licens|deal|acqui|merge/i.test(l)

  // Angle 1 — precedent, shaped by event class
  let precedentQ: string
  if (isFdaAction)
    precedentQ = `At peer DMD companies, what happened after a similar FDA ${outcome} decision — specifically ${label}? How did label language, PMR commitments, or restrictions play out, and what was the stock and commercial impact?`
  else if (isTrialResult)
    precedentQ = `When DMD peers reported ${outcome} trial data at a comparable stage — similar to "${label}" — what did regulators accept as sufficient evidence, and how did the stock react in the months following?`
  else if (isSafety)
    precedentQ = `What precedent exists in DMD or broader gene therapy for safety events like "${label}"? How did the FDA respond, did programs recover, and what conditions were attached to continued development?`
  else if (isCommercial)
    precedentQ = `How have peer DMD launches unfolded commercially after events like "${label}"? What does real-world uptake, payer coverage, and reimbursement timelines look like?`
  else
    precedentQ = `At peer DMD companies, what happened after a comparable ${outcome} event — "${label}"? What were the downstream regulatory, clinical, and market consequences?`

  // Angle 2 — what to expect next, shaped by projected vs historical
  let nextQ: string
  if (isProjected)
    nextQ = `$${ticker} has an upcoming event: "${label}" — ${detail} What are the realistic bull and bear scenarios, and what specific data points or regulatory signals should investors watch ahead of this?`
  else if (isFdaAction)
    nextQ = `Following "${label}" for $${ticker}, what are the most likely next regulatory moves — label expansions, post-market requirements, or competitive responses from peers — and on what timeline?`
  else if (isTrialResult)
    nextQ = `After the "${label}" outcome — ${detail.slice(0, 120)} — what does the regulatory path forward look like for $${ticker}? NDA filing, confirmatory trial, or label amendment?`
  else
    nextQ = `Following "${label}" for $${ticker}, what are the most actionable next milestones investors should monitor? Consider regulatory timelines, competitive responses, and any clinical follow-on data expected.`

  // Angle 3 — materiality, always specific to the detail
  const materiality = detail.length > 80 ? detail.slice(0, 120) + '…' : detail
  const materialQ = `How material is "${label}" to $${ticker}'s commercial trajectory? Specifically: ${materiality} — does this change the peak sales ceiling, addressable patient population, or competitive positioning versus DYNE, RNA, and WVE?`

  return [
    { label: 'What is the precedent?',           question: precedentQ  },
    { label: `What happens next for $${ticker}?`, question: nextQ       },
    { label: 'How material is this?',             question: materialQ   },
  ]
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-3 bg-border rounded w-3/4" />
      <div className="h-3 bg-border rounded w-full" />
      <div className="h-3 bg-border rounded w-5/6" />
    </div>
  )
}

export default function MilestoneModal({ milestone, ticker, onClose, onInvestigate }: Props) {
  const styles = TYPE_STYLES[milestone.type]
  const [mode, setMode] = useState<'choice' | 'summary'>('choice')
  const [analysis, setAnalysis] = useState<MilestoneAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const researchAngles = buildResearchAngles(milestone, ticker)

  const loadSummary = () => {
    setMode('summary')
    setLoading(true)
    setError(null)

    fetch(`${API}/api/milestone/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticker,
        label: milestone.label,
        date: milestone.date,
        detail: milestone.detail,
        type: milestone.type,
        category: milestone.category,
      }),
    })
      .then(async res => {
        if (!res.ok) {
          const body = await res.text().catch(() => res.statusText)
          throw new Error(`${res.status} — ${body}`)
        }
        return res.json() as Promise<MilestoneAnalysis>
      })
      .then(data => { setAnalysis(data); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg mx-4 bg-surface border border-border rounded-lg shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header — always shown */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${styles.dot} shrink-0 mt-0.5`} />
              <span className="text-[#e6edf3] font-semibold text-sm leading-snug">
                {milestone.label}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-muted hover:text-[#e6edf3] transition-colors shrink-0 text-lg leading-none"
            >
              ×
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">{milestone.date}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded border ${styles.badge}`}>
              {styles.label}
            </span>
            <span className="text-[10px] text-muted border border-border rounded px-2 py-0.5">
              {milestone.category}
            </span>
          </div>

          <p className="mt-3 text-sm text-[#c9d1d9] leading-relaxed">
            {milestone.detail}
          </p>
        </div>

        {/* Body — choice or summary */}
        <div className="border-t border-border bg-canvas/60 px-6 py-5">

          {mode === 'choice' && (
            <div className="space-y-3">
              {/* Quick summary */}
              <button
                onClick={loadSummary}
                className="w-full text-left rounded-lg border border-border hover:border-accent/40 bg-surface hover:bg-surface/80 px-4 py-3.5 transition-colors group"
              >
                <div className="text-xs font-semibold text-[#e6edf3] mb-0.5 group-hover:text-accent transition-colors">
                  Quick summary
                </div>
                <div className="text-[11px] text-muted leading-snug">
                  Severity rating, what this means, and peer precedent — in ~10s
                </div>
              </button>

              {/* Research angles */}
              {onInvestigate && (
                <div className="space-y-1.5">
                  <div className="text-[10px] text-muted uppercase tracking-wider px-1 pt-1">
                    Deep research in the Research Pharm
                  </div>
                  {researchAngles.map((angle) => (
                    <button
                      key={angle.label}
                      onClick={() => { onInvestigate(angle.question); onClose() }}
                      className="w-full text-left rounded-lg border border-accent/20 hover:border-accent/50 hover:bg-accent/5 px-4 py-3 transition-colors group"
                    >
                      <div className="text-xs font-medium text-accent mb-0.5">
                        {angle.label} →
                      </div>
                      <div className="text-[11px] text-muted leading-snug line-clamp-2">
                        {angle.question}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === 'summary' && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-accent">
                  AI Analysis
                </span>
                {loading && (
                  <span className="text-[10px] text-muted animate-pulse">loading… (may take ~10s)</span>
                )}
                <button
                  onClick={() => setMode('choice')}
                  className="ml-auto text-[10px] text-muted hover:text-[#e6edf3] transition-colors"
                >
                  ← back
                </button>
              </div>

              {loading && <Skeleton />}

              {error && (
                <div className="space-y-2">
                  <p className="text-xs text-muted italic">Analysis failed.</p>
                  <p className="text-[10px] font-mono text-negative/80 bg-negative/5 border border-negative/20 rounded px-2 py-1.5 break-all">{error}</p>
                  <button
                    onClick={loadSummary}
                    className="text-xs px-3 py-1.5 rounded border border-accent/40 text-accent hover:bg-accent/10 transition-colors"
                  >
                    Try again
                  </button>
                </div>
              )}

              {analysis && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded border ${SEVERITY_STYLES[analysis.severity] ?? SEVERITY_STYLES.Meaningful}`}>
                      {analysis.severity.toUpperCase()}
                    </span>
                    <span className="text-xs text-muted">{analysis.severity_rationale}</span>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted uppercase tracking-wider mb-1">What this means</div>
                    <p className="text-sm text-[#c9d1d9] leading-relaxed">{analysis.explanation}</p>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted uppercase tracking-wider mb-1">Peer precedent</div>
                    <p className="text-xs text-[#c9d1d9] leading-relaxed italic">{analysis.peer_precedent}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border flex justify-between items-center">
          <span className="text-[10px] text-muted">AI-generated · Not financial advice</span>
          <button onClick={onClose} className="text-xs text-muted hover:text-[#e6edf3] transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
