'use client'

import { useEffect, useState } from 'react'
import type { Ticker, DiligenceResponse } from '../../types'
import { displayTicker } from '../../types'
import BullBearMatrix from '../BullBearMatrix'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface Props { ticker: Ticker }

const ROLE_STYLES: Record<string, string> = {
  explorer: 'border-accent/40 bg-accent/5',
  critic:   'border-negative/35 bg-negative/5',
}

function runningMessages(parallelism: number): string[] {
  const n = Math.min(Math.max(parallelism, 1), 5)
  return [
    `Wiring ${n} parallel explorer${n > 1 ? 's' : ''} to OpenAI…`,
    'Pulling mechanism text, clinical metrics & pgvector peers from Postgres…',
    'Explorers drafting investment angles (mechanism, clinical, competition…)…',
    'Critics stress-testing each branch for gaps and overreach…',
    'Synthesizer merging into ranked thesis + bull / bear / catalyst…',
    'Almost there — packaging your report…',
  ]
}

export default function WarRoomTab({ ticker }: Props) {
  const [parallelism, setParallelism] = useState(3)
  const [result, setResult]       = useState<DiligenceResponse | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [running, setRunning]     = useState(false)
  const [runTick, setRunTick]     = useState(0)

  useEffect(() => {
    if (!running) return
    const msgs = runningMessages(parallelism)
    const id = window.setInterval(() => {
      setRunTick(t => (t + 1) % msgs.length)
    }, 2400)
    return () => clearInterval(id)
  }, [running, parallelism])

  useEffect(() => {
    if (running) setRunTick(0)
  }, [running])

  const handleRun = async () => {
    setRunning(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch(
        `${API}/api/diligence/${ticker}?parallelism=${parallelism}`,
      )
      if (!res.ok) throw new Error(`${res.status} — ${await res.text()}`)
      const data: DiligenceResponse = await res.json()
      setResult(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setRunning(false)
    }
  }

  const branches = result?.parallel_branches ?? []
  const ranked = result?.ranked_directions ?? []
  const msgs = runningMessages(parallelism)
  const statusLine = msgs[runTick % msgs.length]

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-sm font-semibold text-[#e6edf3] mb-1">
          War Room — ${displayTicker(ticker)}
        </h2>
        <p className="text-xs text-muted mb-5">
          Stock-focused diligence for the selected ticker: parallel investment angles explore the thesis from
          different lenses (mechanism, clinical, competition, etc.), each branch gets a critic pass, then a
          synthesizer merges into ranked directions plus bull / bear / catalyst — all grounded in your DB
          mechanism text, clinical metrics, and pgvector peers.
        </p>

        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div>
            <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Parallel branches</label>
            <input
              type="number"
              min={1}
              max={5}
              value={parallelism}
              onChange={e => setParallelism(Number(e.target.value))}
              disabled={running}
              className="w-20 bg-canvas border border-border rounded px-2 py-1.5 text-xs text-[#e6edf3]"
            />
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted pb-1">
            <span className="px-2 py-1 rounded border border-border">Explorers</span>
            <span>→</span>
            <span className="px-2 py-1 rounded border border-border">Critics</span>
            <span>→</span>
            <span className="px-2 py-1 rounded border border-border">Synthesis</span>
          </div>
        </div>

        <button
          onClick={handleRun}
          disabled={running}
          className={[
            'px-5 py-2.5 rounded text-sm font-semibold transition-all',
            running
              ? 'bg-accent/30 text-accent/60 cursor-not-allowed'
              : 'bg-accent text-canvas hover:bg-[#79b8ff]',
          ].join(' ')}
        >
          {running ? 'Running…' : result ? `Re-run — $${displayTicker(ticker)}` : `Run War Room — $${displayTicker(ticker)}`}
        </button>
      </div>

      {/* Live run animation */}
      {running && (
        <div
          className="relative overflow-hidden rounded-lg border border-accent/40 bg-canvas/80 p-6 animate-war-glow"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(88,166,255,0.12),transparent_55%)]" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="h-2 w-2 rounded-full bg-accent animate-bounce"
                    style={{ animationDelay: `${i * 140}ms` }}
                  />
                ))}
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                War room active
              </span>
            </div>
            <p
              key={runTick}
              className="text-sm text-[#e6edf3] leading-relaxed min-h-[3rem] font-mono transition-opacity duration-300"
            >
              {statusLine}
            </p>
            <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-border">
              <div className="h-full w-[28%] rounded-full bg-gradient-to-r from-accent/20 via-accent to-accent/60 animate-war-bar" />
            </div>
            <p className="mt-3 text-[10px] text-muted flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-positive animate-war-blink" />
              Models may take 30–90s — status cycles while you wait.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-negative/10 border border-negative/30 rounded-lg p-5 text-sm">
          <p className="text-negative font-semibold mb-1">Analysis failed</p>
          <p className="text-xs text-muted">{error}</p>
          <p className="text-xs text-muted mt-1">Ensure the FastAPI backend is running and OPENAI_API_KEY is set.</p>
        </div>
      )}

      {result && (
        <>
          {/* 1 — Synthesis first (most important) */}
          {result.synthesis && (
            <div className="bg-surface border border-accent/50 rounded-lg p-6 shadow-[0_0_0_1px_rgba(88,166,255,0.08)]">
              <div className="flex items-center gap-2 mb-5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-accent">Primary</span>
                <h3 className="text-sm font-semibold text-[#e6edf3]">Synthesis report</h3>
                <span className="text-[10px] text-muted border border-border rounded px-1.5 py-0.5 ml-auto">
                  AI-generated · Not financial advice
                </span>
              </div>
              <BullBearMatrix synthesis={result.synthesis} ticker={displayTicker(ticker)} />
            </div>
          )}

          {/* 2 — Ranked directions */}
          {ranked.length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-6">
              <h3 className="text-sm font-semibold text-[#e6edf3] mb-4">Ranked directions</h3>
              <ol className="space-y-4">
                {ranked.map((d, i) => (
                  <li key={i} className="border-l-2 border-accent/50 pl-4">
                    <div className="text-sm font-semibold text-[#e6edf3]">
                      {d.rank}. {d.title}
                    </div>
                    <p className="text-xs text-muted mt-1">{d.rationale}</p>
                    <p className="text-xs text-negative/90 mt-1">Risks: {d.key_risks}</p>
                    <p className="text-xs text-positive/90 mt-1">Next step: {d.next_step}</p>
                  </li>
                ))}
              </ol>
              {result.synthesis_note && (
                <p className="text-xs text-muted mt-4 pt-4 border-t border-border">{result.synthesis_note}</p>
              )}
            </div>
          )}

          {/* 3 — Pipeline summary */}
          {result.steps.map(step => (
            <div key={step.step} className="bg-surface border border-border rounded-lg p-5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">{step.step}</span>
              <p className="text-sm text-[#c9d1d9] leading-relaxed mt-2">{step.output}</p>
            </div>
          ))}

          {/* 4 — Branch trace (detail) */}
          {branches.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted mb-3">Branch trace</h3>
              <div className="space-y-3">
                {branches.map((b, i) => (
                  <div key={i} className="bg-surface border border-border rounded-lg overflow-hidden">
                    <div className="px-4 py-2 border-b border-border text-xs font-medium text-[#e6edf3]">
                      {b.label}
                    </div>
                    <div className="px-4 py-3 space-y-3">
                      <div className={['rounded border px-3 py-2 text-xs', ROLE_STYLES.explorer].join(' ')}>
                        <div className="text-[10px] text-muted uppercase mb-1">Explorer</div>
                        <pre className="whitespace-pre-wrap font-mono text-[11px] text-[#e6edf3]/95 leading-relaxed">
                          {b.explorer}
                        </pre>
                      </div>
                      <div className={['rounded border px-3 py-2 text-xs', ROLE_STYLES.critic].join(' ')}>
                        <div className="text-[10px] text-muted uppercase mb-1">Critic</div>
                        <pre className="whitespace-pre-wrap font-mono text-[11px] text-[#e6edf3]/95 leading-relaxed">
                          {b.critic}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
