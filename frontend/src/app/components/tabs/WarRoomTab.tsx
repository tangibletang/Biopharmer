'use client'

import { useEffect, useState } from 'react'
import type { Ticker, TranscriptMessage, WarRoomResponse, SynthesisOutput } from '../../types'
import { displayTicker } from '../../types'
import type { PersistedResearch } from '../../page'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface Props {
  ticker: Ticker
  saved?: PersistedResearch
  onSave?: (state: PersistedResearch) => void
  onSynthesis?: (ticker: Ticker, actionableMetric: string) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const USER_PERSONAS = [
  'Clinical Mechanism Analyst',
  'Quantitative Value Investor',
  'Regulatory Hawk',
  'Competitive Intelligence Analyst',
  'Risk-Arbitrage Trader',
]

const STARTER_PILLS = [
  'Compare delivery toxicity between $DYNE and $RNA exon-skipping programs',
  'What FDA label risks could re-rate $SRPT given its accelerated approval history?',
  'How does $WVE micro-dystrophin differentiate vs. gene therapy peers on durability?',
]

const STATUS_MESSAGES = [
  'Orchestrator is wiring debate angles…',
  'Explorers drafting theses using mechanism data and pgvector peers…',
  'Calling openFDA for adverse event signals…',
  'Critics stress-testing explorer logic…',
  'Steering agent generating persona-matched directions…',
  'Synthesizer distilling the debate…',
  'Packaging your research…',
]

// ── Role config ───────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { border: string; bg: string; label: string; labelColor: string }> = {
  orchestrator: {
    border: 'border-accent/30',
    bg: 'bg-accent/5',
    label: 'Orchestrator',
    labelColor: 'text-accent',
  },
  explorer: {
    border: 'border-positive/25',
    bg: 'bg-positive/5',
    label: 'Explorer',
    labelColor: 'text-positive',
  },
  critic: {
    border: 'border-negative/25',
    bg: 'bg-negative/5',
    label: 'Critic',
    labelColor: 'text-negative',
  },
}

// ── Phase derivation from saved result ────────────────────────────────────────

type UIPhase = 'idle' | 'loading' | 'paused' | 'complete'

function derivePhase(result: WarRoomResponse | null | undefined): Exclude<UIPhase, 'loading'> {
  if (!result) return 'idle'
  return result.status === 'complete' ? 'complete' : 'paused'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusPulse({ tick }: { tick: number }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-accent/40 bg-canvas/80 p-6 animate-war-glow">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(88,166,255,0.12),transparent_55%)]" />
      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          {[0, 1, 2].map(i => (
            <span key={i} className="h-2 w-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${i * 140}ms` }} />
          ))}
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Agents active</span>
        </div>
        <p key={tick} className="text-sm text-[#e6edf3] font-mono min-h-[2.5rem] leading-relaxed">
          {STATUS_MESSAGES[tick % STATUS_MESSAGES.length]}
        </p>
        <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-border">
          <div className="h-full w-[28%] rounded-full bg-gradient-to-r from-accent/20 via-accent to-accent/60 animate-war-bar" />
        </div>
        <p className="mt-3 text-[10px] text-muted">Models may take 30–90s per iteration.</p>
      </div>
    </div>
  )
}

function AgentCard({ message }: { message: TranscriptMessage }) {
  const cfg = ROLE_CONFIG[message.role] ?? {
    border: 'border-border', bg: 'bg-surface', label: message.role, labelColor: 'text-muted',
  }
  return (
    <div className={`rounded-lg border ${cfg.border} ${cfg.bg} px-4 py-3`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${cfg.labelColor}`}>
          {cfg.label}
        </span>
        <span className="text-[10px] text-muted">— {message.agent}</span>
      </div>
      <p className="text-xs text-[#c9d1d9] leading-relaxed whitespace-pre-wrap">{message.content}</p>
    </div>
  )
}

function RoundGroup({ iter, msgs }: { iter: number; msgs: TranscriptMessage[] }) {
  const [open, setOpen] = useState(false)
  const orchestratorMsgs = msgs.filter(m => m.role === 'orchestrator')
  const agentMsgs = msgs.filter(m => m.role !== 'orchestrator')

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          Round {iter + 1}
        </span>
        <div className="flex-1 border-t border-border" />
      </div>
      <div className="space-y-2">
        {orchestratorMsgs.map((m, i) => <AgentCard key={i} message={m} />)}
        {agentMsgs.length > 0 && (
          <>
            <button
              onClick={() => setOpen(o => !o)}
              className="text-[10px] text-accent hover:text-[#79b8ff] transition-colors py-1 flex items-center gap-1.5"
            >
              <span>{open ? '▾' : '▸'}</span>
              {open ? 'Hide' : `Show ${agentMsgs.length} agent response${agentMsgs.length !== 1 ? 's' : ''}`}
            </button>
            {open && (
              <div className="space-y-2">
                {agentMsgs.map((m, i) => <AgentCard key={i} message={m} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function TranscriptBody({ messages }: { messages: TranscriptMessage[] }) {
  if (!messages.length) return null

  const byIteration = messages.reduce<Record<number, TranscriptMessage[]>>((acc, m) => {
    const k = m.iteration
    if (!acc[k]) acc[k] = []
    acc[k].push(m)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {Object.entries(byIteration).map(([iter, msgs]) => (
        <RoundGroup key={iter} iter={Number(iter)} msgs={msgs} />
      ))}
    </div>
  )
}

function SynthesisPanel({ synthesis }: { synthesis: SynthesisOutput }) {
  return (
    <div className="bg-surface border border-accent/40 rounded-lg overflow-hidden shadow-[0_0_0_1px_rgba(88,166,255,0.06)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-accent">Research synthesis</span>
        <span className="text-[10px] text-muted ml-auto">AI-generated · Not financial advice</span>
      </div>

      {/* Research summary */}
      <div className="px-5 py-4 border-b border-border">
        <p className="text-xs text-[#e6edf3] leading-relaxed">{synthesis.research_summary}</p>
      </div>

      {/* Key findings + Investor considerations */}
      <div className="grid grid-cols-2 divide-x divide-border">
        <div className="px-5 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-3">Key findings</div>
          <ul className="space-y-2">
            {synthesis.key_findings.map((f, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-accent shrink-0 mt-0.5">·</span>
                <span className="text-xs text-[#c9d1d9] leading-relaxed">{f}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="px-5 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-3">As an investor</div>
          <ul className="space-y-2">
            {synthesis.investor_considerations.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-accent shrink-0 mt-0.5">→</span>
                <span className="text-xs text-[#c9d1d9] leading-relaxed">{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Watch list */}
      {synthesis.watch_list && (
        <div className="px-5 py-3 border-t border-border bg-accent/5 flex items-start gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-accent shrink-0 pt-0.5">Watch</span>
          <p className="text-xs text-[#e6edf3] font-medium leading-relaxed">{synthesis.watch_list}</p>
        </div>
      )}
    </div>
  )
}

function InterimSummaryCard({ summary }: { summary: string }) {
  if (!summary) return null
  return (
    <div className="bg-surface border border-accent/20 rounded-lg px-5 py-4 flex gap-3">
      <span className="text-accent shrink-0 text-[10px] font-semibold uppercase tracking-widest pt-0.5">Round summary</span>
      <p className="text-xs text-[#c9d1d9] leading-relaxed">{summary}</p>
    </div>
  )
}

function SteeringSection({
  result, onSubmit, loading,
}: {
  result: WarRoomResponse
  onSubmit: (directive: string) => void
  loading: boolean
}) {
  const [directive, setDirective] = useState('')
  const pills = result.suggested_directions ?? []
  const submit = (text: string) => { if (!loading) onSubmit(text) }

  return (
    <div className="bg-surface border border-accent/40 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-block h-2 w-2 rounded-full bg-accent animate-war-blink" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-accent">
          Round {result.iterations_completed} of {result.max_iterations} — steer the next round
        </span>
      </div>

      {pills.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {pills.map((pill, i) => (
            <button
              key={i}
              onClick={() => submit(pill)}
              disabled={loading}
              className={[
                'text-left text-xs px-3 py-2 rounded border transition-colors',
                loading
                  ? 'border-border text-muted cursor-not-allowed'
                  : 'border-accent/35 text-accent hover:bg-accent/10',
              ].join(' ')}
            >
              <span className="text-muted mr-2 text-[10px]">{i + 1}.</span>{pill}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={directive}
          onChange={e => setDirective(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && directive.trim() && submit(directive.trim())}
          placeholder="Or type a custom directive…"
          disabled={loading}
          className="flex-1 bg-canvas border border-border rounded px-3 py-2 text-xs text-[#e6edf3] placeholder-muted focus:outline-none focus:border-accent/60"
        />
        <button
          onClick={() => directive.trim() ? submit(directive.trim()) : submit('')}
          disabled={loading}
          className={[
            'px-4 py-2 rounded text-xs font-semibold transition-all shrink-0',
            loading ? 'bg-accent/30 text-accent/60 cursor-not-allowed' : 'bg-accent text-canvas hover:bg-[#79b8ff]',
          ].join(' ')}
        >
          {loading ? 'Running…' : directive.trim() ? 'Send →' : 'Continue →'}
        </button>
      </div>
    </div>
  )
}

function ConfigForm({
  focus, setFocus,
  persona, setPersona,
  maxIter, setMaxIter,
  onRun, disabled,
}: {
  focus: string; setFocus: (v: string) => void
  persona: string; setPersona: (v: string) => void
  maxIter: number; setMaxIter: (v: number) => void
  onRun: (f?: string) => void
  disabled: boolean
}) {
  return (
    <div className="space-y-4">
      {/* Persona + iterations row */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-40">
          <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Persona</label>
          <select
            value={persona}
            onChange={e => setPersona(e.target.value)}
            disabled={disabled}
            className="w-full bg-canvas border border-border rounded px-3 py-2 text-xs text-[#e6edf3] focus:outline-none focus:border-accent/60"
          >
            {USER_PERSONAS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="w-28">
          <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Iterations</label>
          <input
            type="number" min={1} max={5} value={maxIter}
            onChange={e => setMaxIter(Number(e.target.value))}
            disabled={disabled}
            className="w-full bg-canvas border border-border rounded px-2 py-2 text-xs text-[#e6edf3]"
          />
        </div>
      </div>

      {/* Starter pills */}
      <div className="flex flex-wrap gap-2">
        {STARTER_PILLS.map(pill => (
          <button
            key={pill}
            onClick={() => { setFocus(pill); onRun(pill) }}
            disabled={disabled}
            className="text-[11px] text-accent border border-accent/30 rounded-full px-3 py-1 hover:bg-accent/10 transition-colors"
          >
            {pill}
          </button>
        ))}
      </div>

      {/* Focus input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={focus}
          onChange={e => setFocus(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onRun()}
          placeholder="What should the agents research? (Enter to run)"
          disabled={disabled}
          className="flex-1 bg-canvas border border-border rounded px-3 py-2 text-xs text-[#e6edf3] placeholder-muted focus:outline-none focus:border-accent/60"
        />
        <button
          onClick={() => onRun()}
          disabled={disabled || !focus.trim()}
          className={[
            'px-4 py-2 rounded text-xs font-semibold transition-all shrink-0',
            disabled || !focus.trim()
              ? 'bg-accent/30 text-accent/60 cursor-not-allowed'
              : 'bg-accent text-canvas hover:bg-[#79b8ff]',
          ].join(' ')}
        >
          Run research
        </button>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function WarRoomTab({ ticker, saved, onSave, onSynthesis }: Props) {
  const [focus, setFocus]           = useState(saved?.focus ?? '')
  const [persona, setPersona]       = useState(USER_PERSONAS[0])
  const [maxIter, setMaxIter]       = useState(2)
  const [phase, setPhase]           = useState<UIPhase>(derivePhase(saved?.result))
  const [result, setResult]         = useState<WarRoomResponse | null>(saved?.result ?? null)
  const [statusTick, setStatusTick] = useState(0)
  const [error, setError]           = useState<string | null>(null)

  // When ticker changes, restore that ticker's saved state
  useEffect(() => {
    setResult(saved?.result ?? null)
    setFocus(saved?.focus ?? '')
    setPhase(derivePhase(saved?.result))
    setError(null)
  }, [ticker])                          // eslint-disable-line react-hooks/exhaustive-deps

  const persist = (r: WarRoomResponse | null, f: string) => {
    onSave?.({ result: r, focus: f })
  }

  const startTicker = () =>
    window.setInterval(() => setStatusTick(t => (t + 1) % STATUS_MESSAGES.length), 2200)

  const handleStart = async (overrideFocus?: string) => {
    const userFocus = (overrideFocus ?? focus).trim()
    if (!userFocus) return
    setPhase('loading')
    setError(null)
    setResult(null)
    const tickId = startTicker()
    try {
      const res = await fetch(`${API}/api/diligence/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, user_focus: userFocus, user_persona: persona, max_iterations: maxIter }),
      })
      if (!res.ok) throw new Error(`${res.status} — ${await res.text()}`)
      const data: WarRoomResponse = await res.json()
      setResult(data)
      setPhase(data.status === 'complete' ? 'complete' : 'paused')
      persist(data, userFocus)
      if (data.status === 'complete' && data.synthesis?.watch_list) {
        onSynthesis?.(ticker, data.synthesis.watch_list)
      }
    } catch (e) {
      setError(String(e))
      setPhase('idle')
    } finally {
      clearInterval(tickId)
    }
  }

  const handleResume = async (directive: string) => {
    if (!result) return
    setPhase('loading')
    setError(null)
    const tickId = startTicker()
    try {
      const res = await fetch(`${API}/api/diligence/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_id: result.thread_id, human_directive: directive }),
      })
      if (!res.ok) throw new Error(`${res.status} — ${await res.text()}`)
      const data: WarRoomResponse = await res.json()
      setResult(data)
      setPhase(data.status === 'complete' ? 'complete' : 'paused')
      persist(data, focus)
      if (data.status === 'complete' && data.synthesis?.watch_list) {
        onSynthesis?.(ticker, data.synthesis.watch_list)
      }
    } catch (e) {
      setError(String(e))
      setPhase('paused')
    } finally {
      clearInterval(tickId)
    }
  }

  const handleReset = () => {
    setPhase('idle')
    setResult(null)
    setFocus('')
    setError(null)
    persist(null, '')
  }

  const isLoading = phase === 'loading'

  return (
    <div className="max-w-4xl space-y-5">

      {/* ── Config panel — always visible when idle or complete ── */}
      {(phase === 'idle' || phase === 'complete') && (
        <div className="bg-surface border border-border rounded-lg p-5">
          {phase === 'complete' && result ? (
            // Compact header when results exist
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Research question</p>
                <p className="text-sm text-[#e6edf3] font-medium">{focus}</p>
                <p className="text-[10px] text-muted mt-1">
                  {persona} · {result.iterations_completed} iteration{result.iterations_completed !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => { setPhase('idle') }}
                  className="text-xs px-3 py-1.5 rounded border border-border text-muted hover:text-[#e6edf3] hover:border-accent/40 transition-colors"
                >
                  New research
                </button>
                <button
                  onClick={handleReset}
                  className="text-xs px-3 py-1.5 rounded border border-border text-muted hover:text-negative/80 hover:border-negative/40 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          ) : (
            <ConfigForm
              focus={focus} setFocus={setFocus}
              persona={persona} setPersona={setPersona}
              maxIter={maxIter} setMaxIter={setMaxIter}
              onRun={handleStart}
              disabled={isLoading}
            />
          )}
        </div>
      )}

      {/* ── Loading ── */}
      {phase === 'loading' && <StatusPulse tick={statusTick} />}

      {/* ── Error ── */}
      {error && (
        <div className="bg-negative/10 border border-negative/30 rounded-lg p-4">
          <p className="text-negative text-xs font-semibold mb-1">Research failed</p>
          <p className="text-xs text-muted">{error}</p>
          <button onClick={() => setPhase(result ? 'paused' : 'idle')} className="mt-2 text-xs text-accent underline">
            Dismiss
          </button>
        </div>
      )}

      {/* ── Synthesis — top of results, shown when complete ── */}
      {phase === 'complete' && result?.synthesis && (
        <SynthesisPanel synthesis={result.synthesis} />
      )}

      {/* ── Interim summary + steering — shown ABOVE transcript when paused ── */}
      {phase === 'paused' && result && (
        <>
          {result.interim_summary && (
            <InterimSummaryCard summary={result.interim_summary} />
          )}
          <SteeringSection result={result} onSubmit={handleResume} loading={isLoading} />
        </>
      )}

      {/* ── Transcript — the debate, rounds collapsed to orchestrator by default ── */}
      {result && result.transcript.length > 0 && phase !== 'loading' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xs font-semibold text-[#e6edf3] uppercase tracking-wider">
              Debate transcript
            </h2>
            <span className="text-[10px] text-muted">
              {result.transcript.length} messages · ${displayTicker(ticker)}
            </span>
          </div>
          <TranscriptBody messages={result.transcript} />
        </div>
      )}
    </div>
  )
}
