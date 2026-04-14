'use client'

import { useState, useRef } from 'react'
import type { Ticker, DiligenceResponse } from '../../types'
import BullBearMatrix from '../BullBearMatrix'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const STEP_LABELS = [
  { key: 'biologist',   pending: 'Biologist analyzing mechanism…',    done: 'Biologist — efficacy analysis complete' },
  { key: 'toxicologist', pending: 'Toxicologist challenging safety…',  done: 'Toxicologist — risk challenge complete' },
  { key: 'synthesizer', pending: 'Synthesizer distilling findings…',   done: 'Synthesizer — report ready' },
]

interface Props { ticker: Ticker }

type StepStatus = 'idle' | 'running' | 'done'

export default function WarRoomTab({ ticker }: Props) {
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(['idle', 'idle', 'idle'])
  const [result, setResult]             = useState<DiligenceResponse | null>(null)
  const [error, setError]               = useState<string | null>(null)
  const [running, setRunning]           = useState(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }

  const handleRun = async () => {
    clearTimers()
    setRunning(true)
    setError(null)
    setResult(null)
    setStepStatuses(['running', 'idle', 'idle'])

    // Animate step indicators while awaiting the API response
    timersRef.current.push(setTimeout(() => setStepStatuses(['running', 'running', 'idle']),  3500))
    timersRef.current.push(setTimeout(() => setStepStatuses(['running', 'running', 'running']), 7000))

    try {
      const res = await fetch(`${API}/api/diligence/${ticker}`)
      if (!res.ok) throw new Error(`${res.status} — ${await res.text()}`)
      const data: DiligenceResponse = await res.json()

      clearTimers()
      setStepStatuses(['done', 'done', 'done'])
      setResult(data)
    } catch (e) {
      clearTimers()
      setError(String(e))
      setStepStatuses(['idle', 'idle', 'idle'])
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header card */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-sm font-semibold text-[#e6edf3] mb-1">
          Multi-Agent War Room — ${ticker}
        </h2>
        <p className="text-xs text-muted mb-5">
          Three AI agents debate the investment case. The Biologist defends efficacy, the
          Toxicologist challenges safety, and the Synthesizer distills their friction into
          an actionable bull/bear summary.
        </p>

        {/* Agent pipeline visualization */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          {['Biologist', 'Toxicologist', 'Synthesizer'].map((name, i) => {
            const status = stepStatuses[i]
            return (
              <div key={name} className="flex items-center gap-2 shrink-0">
                <div
                  className={[
                    'flex items-center gap-2 rounded px-3 py-2 border text-xs transition-all',
                    status === 'done'    ? 'border-positive/40 bg-positive/5 text-positive' :
                    status === 'running' ? 'border-accent/40 bg-accent/5 text-accent'       :
                                          'border-border bg-canvas text-muted',
                  ].join(' ')}
                >
                  {status === 'running' && <Spinner />}
                  {status === 'done'    && <span>✓</span>}
                  {status === 'idle'    && <span className="w-3.5 h-3.5 rounded-full border border-current opacity-40" />}
                  <span>{name}</span>
                </div>
                {i < 2 && <span className="text-border">→</span>}
              </div>
            )
          })}
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
          {running ? 'Analyzing…' : result ? `Re-run Analysis` : `Run Analysis — $${ticker}`}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-negative/10 border border-negative/30 rounded-lg p-5 text-sm">
          <p className="text-negative font-semibold mb-1">Analysis failed</p>
          <p className="text-xs text-muted">{error}</p>
          <p className="text-xs text-muted mt-1">Ensure the FastAPI backend is running on port 8000 and your OPENAI_API_KEY is set.</p>
        </div>
      )}

      {/* Step outputs */}
      {result && (
        <div className="space-y-3">
          {result.steps.map(step => (
            <div key={step.step} className="bg-surface border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-positive text-xs">✓</span>
                <span className="text-xs font-semibold uppercase tracking-widest text-muted">
                  {step.step}
                </span>
              </div>
              {step.output !== 'Synthesis complete — see structured output below.' && (
                <p className="text-sm text-[#c9d1d9] leading-relaxed">{step.output}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bull/Bear matrix */}
      {result?.synthesis && (
        <div className="bg-surface border border-border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-5">
            <h3 className="text-sm font-semibold text-[#e6edf3]">Synthesis Report</h3>
            <span className="text-[10px] text-muted border border-border rounded px-1.5 py-0.5 ml-auto">
              AI-generated · Not financial advice
            </span>
          </div>
          <BullBearMatrix synthesis={result.synthesis} ticker={ticker} />
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <svg
      className="animate-spin w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}
