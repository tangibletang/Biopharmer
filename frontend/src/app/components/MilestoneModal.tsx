'use client'

import { useEffect, useState } from 'react'
import type { Milestone } from '../types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface Props {
  milestone: Milestone
  ticker: string
  onClose: () => void
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

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-3 bg-border rounded w-3/4" />
      <div className="h-3 bg-border rounded w-full" />
      <div className="h-3 bg-border rounded w-5/6" />
    </div>
  )
}

export default function MilestoneModal({ milestone, ticker, onClose }: Props) {
  const styles = TYPE_STYLES[milestone.type]
  const [analysis, setAnalysis] = useState<MilestoneAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setAnalysis(null)
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
      .then(data => { if (!cancelled) setAnalysis(data) })
      .catch(e => { if (!cancelled) setError(String(e)) })

    return () => { cancelled = true }
  }, [ticker, milestone.label, milestone.date, retryKey])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg mx-4 bg-surface border border-border rounded-lg shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
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

        {/* AI analysis */}
        <div className="border-t border-border bg-canvas/60 px-6 py-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-accent">
              AI Analysis
            </span>
            {!analysis && !error && (
              <span className="text-[10px] text-muted animate-pulse">loading… (may take ~10s)</span>
            )}
          </div>

          {/* Loading */}
          {!analysis && !error && <Skeleton />}

          {/* Error */}
          {error && (
            <div className="space-y-2">
              <p className="text-xs text-muted italic">Analysis failed.</p>
              <p className="text-[10px] font-mono text-negative/80 bg-negative/5 border border-negative/20 rounded px-2 py-1.5 break-all">{error}</p>
              <button
                onClick={() => setRetryKey(k => k + 1)}
                className="text-xs px-3 py-1.5 rounded border border-accent/40 text-accent hover:bg-accent/10 transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {/* Content */}
          {analysis && (
            <div className="space-y-4">
              {/* Severity badge */}
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-semibold px-2.5 py-1 rounded border ${SEVERITY_STYLES[analysis.severity] ?? SEVERITY_STYLES.Meaningful}`}>
                  {analysis.severity.toUpperCase()}
                </span>
                <span className="text-xs text-muted">{analysis.severity_rationale}</span>
              </div>

              {/* Explanation */}
              <div>
                <div className="text-[10px] text-muted uppercase tracking-wider mb-1">What this means</div>
                <p className="text-sm text-[#c9d1d9] leading-relaxed">{analysis.explanation}</p>
              </div>

              {/* Peer precedent */}
              <div>
                <div className="text-[10px] text-muted uppercase tracking-wider mb-1">Peer precedent</div>
                <p className="text-xs text-[#c9d1d9] leading-relaxed italic">{analysis.peer_precedent}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border flex justify-between items-center">
          <span className="text-[10px] text-muted">AI-generated · Not financial advice</span>
          <button
            onClick={onClose}
            className="text-xs text-muted hover:text-[#e6edf3] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
