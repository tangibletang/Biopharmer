'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ResearchSessionDetail } from '../../types'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const ROLE_STYLES: Record<string, string> = {
  explorer: 'border-accent/40 bg-accent/5',
  critic:   'border-negative/35 bg-negative/5',
  merger:   'border-positive/35 bg-positive/5',
  system:   'border-border',
}

export default function ResearchTab() {
  const [question, setQuestion]   = useState('')
  const [parallelism, setParallelism] = useState(3)
  const [sessionId, setSessionId]   = useState<string | null>(null)
  const [detail, setDetail]         = useState<ResearchSessionDetail | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const fetchSession = useCallback(async (id: string) => {
    const res = await fetch(`${API}/api/research/sessions/${id}`)
    if (!res.ok) throw new Error(await res.text())
    const data: ResearchSessionDetail = await res.json()
    setDetail(data)
    if (data.status === 'completed' || data.status === 'failed') {
      stopPoll()
      setSubmitting(false)
    }
  }, [stopPoll])

  useEffect(() => {
    if (!sessionId) return
    fetchSession(sessionId).catch(e => {
      setError(String(e))
      stopPoll()
      setSubmitting(false)
    })
    pollRef.current = setInterval(() => {
      fetchSession(sessionId).catch(e => setError(String(e)))
    }, 2500)
    return () => stopPoll()
  }, [sessionId, fetchSession, stopPoll])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setDetail(null)
    setSessionId(null)
    setSubmitting(true)
    try {
      const res = await fetch(`${API}/api/research/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          parallelism,
          max_rounds: 1,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const { id } = (await res.json()) as { id: string; status: string }
      setSessionId(id)
    } catch (err) {
      setError(String(err))
      setSubmitting(false)
    }
  }

  const ranked = detail?.final_output?.ranked_directions
  const synthesisNote = detail?.final_output?.synthesis_note

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-surface border border-border rounded-lg p-6">
        <h2 className="text-sm font-semibold text-[#e6edf3] mb-1">Research ideation (Option A)</h2>
        <p className="text-xs text-muted mb-4">
          Parallel explorers propose directions; a critic attacks each branch; a synthesizer ranks outcomes.
          Open-ended questions — not tied to the sidebar ticker.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Research question</label>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              rows={4}
              minLength={8}
              required
              placeholder="e.g. What biomarkers best predict exon-skipping response in ambulatory DMD patients?"
              className="w-full bg-canvas border border-border rounded px-3 py-2 text-xs text-[#e6edf3] placeholder:text-muted focus:outline-none focus:border-accent/60"
            />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Parallel branches</label>
              <input
                type="number"
                min={1}
                max={5}
                value={parallelism}
                onChange={e => setParallelism(Number(e.target.value))}
                className="w-20 bg-canvas border border-border rounded px-2 py-1.5 text-xs text-[#e6edf3]"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || question.trim().length < 8}
              className="px-4 py-2 text-xs font-semibold rounded bg-accent text-[#0d1117] disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
            >
              {submitting ? 'Running…' : 'Run parallel ideation'}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="bg-negative/10 border border-negative/30 rounded-lg p-4 text-xs text-negative">
          {error}
        </div>
      )}

      {detail && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted">Session</span>
            <code className="text-[10px] text-accent">{detail.id.slice(0, 8)}…</code>
            <span
              className={[
                'ml-2 px-2 py-0.5 rounded text-[10px] uppercase',
                detail.status === 'completed' ? 'bg-positive/15 text-positive' : '',
                detail.status === 'failed' ? 'bg-negative/15 text-negative' : '',
                detail.status === 'running' || detail.status === 'pending' ? 'bg-accent/15 text-accent' : '',
              ].join(' ')}
            >
              {detail.status}
            </span>
          </div>

          {detail.status === 'failed' && detail.error_message && (
            <div className="text-xs text-negative border border-negative/30 rounded p-3">{detail.error_message}</div>
          )}

          {ranked && ranked.length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-5">
              <h3 className="text-xs font-semibold text-[#e6edf3] mb-3">Ranked directions</h3>
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
              {synthesisNote && (
                <p className="text-xs text-muted mt-4 pt-4 border-t border-border">{synthesisNote}</p>
              )}
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-[#e6edf3]">Branch trace</h3>
            {detail.threads.map(t => (
              <div key={t.id} className="bg-surface border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-2 border-b border-border text-xs font-medium text-[#e6edf3]">
                  {t.label}
                </div>
                <div className="px-4 py-3 space-y-3">
                  {t.messages.map((m, i) => (
                    <div
                      key={i}
                      className={[
                        'rounded border px-3 py-2 text-xs',
                        ROLE_STYLES[m.role] ?? 'border-border',
                      ].join(' ')}
                    >
                      <div className="flex justify-between gap-2 mb-1 text-[10px] text-muted uppercase tracking-wide">
                        <span>{m.role}</span>
                        {m.agent_name && <span>{m.agent_name}</span>}
                      </div>
                      <pre className="whitespace-pre-wrap font-mono text-[11px] text-[#e6edf3]/95 leading-relaxed">
                        {m.content}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
