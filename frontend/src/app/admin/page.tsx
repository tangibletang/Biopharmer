'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

type Sector = 'neurology' | 'oncology' | 'cardiometabolic'
type PipelineStatus = 'idle' | 'running' | 'success' | 'error'

const SECTORS: { value: Sector; label: string; companies: string }[] = [
  { value: 'neurology',      label: 'Neurology',      companies: 'BIIB · NVS · ABBV' },
  { value: 'oncology',       label: 'Oncology',       companies: 'MRK · AZN' },
  { value: 'cardiometabolic',label: 'Cardiometabolic',companies: 'LLY · NVO' },
]

const PIPELINE_STEPS = [
  'Fetching PubMed abstracts...',
  'Running LLM extraction (structured outputs)...',
  'Generating pgvector embeddings...',
  'Writing vectors to Supabase...',
]

interface IngestResult {
  sector: string
  ingested: number
  companies: string[]
}

export default function AdminPage() {
  const router = useRouter()
  const [sector, setSector]     = useState<Sector>('neurology')
  const [status, setStatus]     = useState<PipelineStatus>('idle')
  const [stepIdx, setStepIdx]   = useState(0)
  const [result, setResult]     = useState<IngestResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast]       = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cycle through steps while running
  useEffect(() => {
    if (status === 'running') {
      setStepIdx(0)
      timerRef.current = setInterval(() => {
        setStepIdx(prev => Math.min(prev + 1, PIPELINE_STEPS.length - 1))
      }, 3200)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [status])

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(false), 4000)
      return () => clearTimeout(t)
    }
  }, [toast])

  const handleIngest = async () => {
    setStatus('running')
    setResult(null)
    setErrorMsg('')

    try {
      const resp = await fetch(`${API}/api/etl/ingest`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sector }),
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }))
        throw new Error(err.detail ?? 'Ingestion failed')
      }

      const data: IngestResult = await resp.json()
      setResult(data)
      setStatus('success')
      setToast(true)
    } catch (e: unknown) {
      setStatus('error')
      setErrorMsg(e instanceof Error ? e.message : 'Unknown error')
    }
  }

  const selectedSector = SECTORS.find(s => s.value === sector)!

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-border bg-surface">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="text-xs text-muted hover:text-[#e6edf3] transition-colors tracking-widest uppercase"
          >
            ← Hub
          </button>
          <span className="text-xs text-[#30363d]">|</span>
          <span className="text-xs font-semibold tracking-widest uppercase text-[#e6edf3]">
            Data Pipeline Control Center
          </span>
        </div>
        <span className="text-xs text-muted">Admin</span>
      </header>

      <div className="flex-1 flex items-start justify-center px-8 py-12">
        <div className="w-full max-w-xl flex flex-col gap-6">

          {/* Title block */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#e6edf3]">
              On-Demand ETL Ingestion
            </h1>
            <p className="mt-1 text-sm text-muted">
              Trigger the PubMed → LLM → pgvector pipeline for a new disease sector.
            </p>
          </div>

          {/* Config card */}
          <div className="rounded-lg border border-border bg-surface p-6 flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted uppercase tracking-widest">
                Target Sector
              </label>
              <select
                value={sector}
                onChange={e => setSector(e.target.value as Sector)}
                disabled={status === 'running'}
                className="bg-canvas border border-border rounded-md px-3 py-2 text-sm text-[#e6edf3] focus:outline-none focus:border-accent disabled:opacity-50"
              >
                {SECTORS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <span className="text-xs text-[#484f58]">
                Companies: {selectedSector.companies}
              </span>
            </div>

            {/* Pipeline steps preview */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted uppercase tracking-widest">Pipeline Stages</span>
              <div className="flex flex-col gap-1">
                {PIPELINE_STEPS.map((step, i) => {
                  const isActive  = status === 'running' && i === stepIdx
                  const isDone    = status === 'success' || (status === 'running' && i < stepIdx)
                  const isPending = !isActive && !isDone

                  return (
                    <div key={i} className="flex items-center gap-2 py-0.5">
                      <span className={[
                        'w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors',
                        isActive  ? 'bg-accent animate-pulse'    : '',
                        isDone    ? 'bg-positive'                 : '',
                        isPending ? 'bg-[#30363d]'               : '',
                      ].join(' ')} />
                      <span className={[
                        'text-xs transition-colors',
                        isActive  ? 'text-[#e6edf3]' : '',
                        isDone    ? 'text-positive'   : '',
                        isPending ? 'text-[#484f58]'  : '',
                      ].join(' ')}>
                        {step}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Error */}
            {status === 'error' && errorMsg && (
              <div className="rounded-md border border-negative/30 bg-negative/10 px-4 py-3">
                <p className="text-xs text-negative">{errorMsg}</p>
              </div>
            )}

            {/* Result */}
            {status === 'success' && result && (
              <div className="rounded-md border border-positive/30 bg-positive/10 px-4 py-3 flex flex-col gap-1">
                <span className="text-xs font-semibold text-positive uppercase tracking-wide">
                  Ingestion Complete
                </span>
                <span className="text-xs text-muted">
                  {result.ingested} compan{result.ingested === 1 ? 'y' : 'ies'} vectorized:{' '}
                  <span className="text-[#e6edf3]">{result.companies.join(', ')}</span>
                </span>
              </div>
            )}

            {/* Trigger button */}
            <button
              onClick={handleIngest}
              disabled={status === 'running'}
              className={[
                'w-full py-2.5 rounded-md text-sm font-semibold transition-colors',
                status === 'running'
                  ? 'bg-accent/20 text-accent/50 cursor-not-allowed'
                  : 'bg-accent text-[#0d1117] hover:bg-[#79c0ff]',
              ].join(' ')}
            >
              {status === 'running' ? 'Pipeline Running...' : 'Trigger Ingestion'}
            </button>
          </div>

          {/* Sector inventory */}
          <div className="rounded-lg border border-border bg-surface p-5 flex flex-col gap-3">
            <span className="text-xs text-muted uppercase tracking-widest">Sector Registry</span>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Genetic Diseases (DMD)', status: 'live',   badge: 'LIVE' },
                { label: 'Neurology',              status: 'ready',  badge: 'READY' },
                { label: 'Oncology',               status: 'ready',  badge: 'READY' },
                { label: 'Cardiometabolic',        status: 'ready',  badge: 'READY' },
              ].map(row => (
                <div key={row.label} className="flex flex-col gap-1 rounded-md border border-border p-3">
                  <span className={[
                    'text-xs font-semibold uppercase tracking-widest',
                    row.status === 'live' ? 'text-positive' : 'text-[#484f58]',
                  ].join(' ')}>
                    {row.badge}
                  </span>
                  <span className="text-xs text-muted leading-tight">{row.label}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Toast */}
      <div className={[
        'fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border border-positive/40 bg-surface px-5 py-3 shadow-xl transition-all duration-300',
        toast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none',
      ].join(' ')}>
        <span className="w-2 h-2 rounded-full bg-positive animate-pulse flex-shrink-0" />
        <span className="text-sm text-[#e6edf3]">
          Sector successfully vectorized.
        </span>
      </div>
    </div>
  )
}
