'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Ticker, PersistedResearch } from '../types'
import { displayTicker } from '../types'
import { ALL_TICKERS, COMPANY_NAMES, TICKER_COLORS } from '../mockData'
import TimelineTab from '../components/tabs/TimelineTab'
import ProximityMapTab from '../components/tabs/ProximityMapTab'
import WarRoomTab from '../components/tabs/WarRoomTab'
import { fetchTickerStripPriceSummary } from '@/lib/tickerPriceStrip'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ── Price helpers ─────────────────────────────────────────────────────────────

type PriceSummary = NonNullable<Awaited<ReturnType<typeof fetchTickerStripPriceSummary>>>

// ── Sector config ─────────────────────────────────────────────────────────────

interface SectorCompany {
  ticker: string
  name: string
  color: string
}

interface SectorConfig {
  label: string
  universe: string
  companies: SectorCompany[]
  accentColor: string
}

const SECTOR_CONFIG: Record<string, SectorConfig> = {
  dmd: {
    label: 'Genetic Diseases',
    universe: 'DMD · live coverage',
    companies: [],   // DMD uses ALL_TICKERS from mockData
    accentColor: '#3fb950',
  },
  neurology: {
    label: 'Neurology',
    universe: "Alzheimer's · Parkinson's",
    companies: [
      { ticker: 'BIIB', name: 'Biogen',   color: '#58a6ff' },
      { ticker: 'NVS',  name: 'Novartis', color: '#79c0ff' },
      { ticker: 'ABBV', name: 'AbbVie',   color: '#a5d6ff' },
    ],
    accentColor: '#58a6ff',
  },
  oncology: {
    label: 'Oncology',
    universe: 'Solid Tumors',
    companies: [
      { ticker: 'MRK', name: 'Merck',        color: '#f78166' },
      { ticker: 'AZN', name: 'AstraZeneca',  color: '#ffa198' },
    ],
    accentColor: '#f78166',
  },
  cardiometabolic: {
    label: 'Cardiometabolic',
    universe: 'GLP-1s',
    companies: [
      { ticker: 'LLY', name: 'Eli Lilly',    color: '#d2a8ff' },
      { ticker: 'NVO', name: 'Novo Nordisk', color: '#e2c5ff' },
    ],
    accentColor: '#d2a8ff',
  },
}

// ── DMD Company Strip ────────────────────────────────────────────────────────
// Prominent horizontal selector showing all 4 tickers with live prices

function DmdCompanyStrip({
  selected,
  onSelect,
  catalysts,
}: {
  selected: Ticker
  onSelect: (t: Ticker) => void
  catalysts: Partial<Record<Ticker, string>>
}) {
  const [prices, setPrices] = useState<Partial<Record<Ticker, PriceSummary>>>({})

  useEffect(() => {
    for (const t of ALL_TICKERS) {
      fetchTickerStripPriceSummary(API, t).then(s => {
        if (s) setPrices(prev => ({ ...prev, [t]: s }))
      })
    }
  }, [])

  return (
    <div className="grid grid-cols-4 gap-2 px-6 py-2.5 border-b border-border bg-surface/40 shrink-0">
      {ALL_TICKERS.map(t => {
        const isActive = t === selected
        const summary  = prices[t]
        const positive = !summary || summary.changePct >= 0
        const color    = TICKER_COLORS[t]

        return (
          <button
            key={t}
            onClick={() => onSelect(t)}
            className={[
              'relative rounded-lg px-3 py-2 text-left transition-all duration-150 border',
              isActive
                ? 'bg-[#161b22] border-border shadow-sm'
                : 'bg-canvas border-transparent hover:bg-[#161b22] hover:border-border/60',
            ].join(' ')}
            style={isActive ? { borderColor: color + '60' } : {}}
          >
            {isActive && (
              <div className="absolute top-0 left-3 right-3 h-0.5 rounded-full" style={{ backgroundColor: color }} />
            )}

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-sm font-bold font-mono" style={{ color: isActive ? color : '#c9d1d9' }}>
                  ${displayTicker(t)}
                </span>
              </div>
              {summary ? (
                <div className="text-right shrink-0">
                  <div className="text-xs font-mono font-semibold" style={{ color: isActive ? color : '#e6edf3' }}>
                    ${summary.price.toFixed(2)}
                  </div>
                  <div className={['text-[10px] font-mono', positive ? 'text-positive' : 'text-negative'].join(' ')}>
                    {positive ? '+' : ''}{summary.changePct.toFixed(2)}%
                  </div>
                </div>
              ) : (
                <span className="text-[10px] text-muted/40">—</span>
              )}
            </div>

            <div className="text-[10px] text-muted mt-0.5 pl-3.5 truncate">{COMPANY_NAMES[t]}</div>

            {catalysts[t] && (
              <div className="mt-1 pl-3.5">
                <p className="text-[10px] leading-snug line-clamp-1" style={{ color: color + 'cc' }}>
                  → {catalysts[t]}
                </p>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}


// ── Non-DMD Sidebar ───────────────────────────────────────────────────────────

function SectorSidebar({
  companies,
  selected,
  onSelect,
  accentColor,
  sectorLabel,
  catalysts,
}: {
  companies: SectorCompany[]
  selected: string
  onSelect: (t: string) => void
  accentColor: string
  sectorLabel: string
  catalysts: Record<string, string>
}) {
  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-border bg-surface overflow-y-auto">
      <div className="px-4 py-4 border-b border-border">
        <div className="text-sm font-bold tracking-wider" style={{ color: accentColor }}>
          BIOPHARMER
        </div>
        <div className="text-muted text-[10px] mt-0.5 uppercase tracking-wide">{sectorLabel}</div>
      </div>

      <nav className="flex flex-col gap-1 p-2 mt-1">
        {companies.map(c => {
          const isActive = c.ticker === selected
          return (
            <button
              key={c.ticker}
              onClick={() => onSelect(c.ticker)}
              className={[
                'w-full text-left rounded px-3 py-3 transition-colors',
                isActive ? 'bg-[#1f2937] ring-1 ring-border' : 'hover:bg-[#1c2128]',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <span className="text-sm font-bold font-mono" style={{ color: isActive ? c.color : '#e6edf3' }}>
                  ${c.ticker}
                </span>
              </div>
              <div className="text-[10px] text-muted mt-0.5 pl-3.5 leading-tight">{c.name}</div>
              {catalysts[c.ticker] && (
                <div className="mt-2 pl-3.5">
                  <p className="text-[10px] leading-snug line-clamp-2" style={{ color: accentColor + 'cc' }}>
                    → {catalysts[c.ticker]}
                  </p>
                </div>
              )}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto p-4 border-t border-border">
        <div className="text-[10px] text-muted space-y-1">
          <div className="flex gap-2 items-center">
            <span className="w-2 h-2 rounded-full bg-positive shrink-0" />
            <span>Positive catalyst</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="w-2 h-2 rounded-full bg-negative shrink-0" />
            <span>Negative catalyst</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ── DMD company-level tabs ────────────────────────────────────────────────────

type DmdMode = 'company' | 'competitive'
type DmdTab  = 'timeline' | 'research'

const DMD_TABS: { id: DmdTab; label: string }[] = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'research', label: 'The Research Barn' },
]

// ── Main content (reads searchParams) ────────────────────────────────────────

function ResearchBarnContent() {
  const searchParams = useSearchParams()
  const rawSector    = searchParams.get('sector') ?? 'dmd'
  const sector       = rawSector in SECTOR_CONFIG ? rawSector : 'dmd'
  const config       = SECTOR_CONFIG[sector]

  // DMD state
  const [dmdMode, setDmdMode]           = useState<DmdMode>('company')
  const [dmdTicker, setDmdTicker]       = useState<Ticker>('SRPT')
  const [dmdTab, setDmdTab]             = useState<DmdTab>('timeline')
  const [dmdCatalysts, setDmdCatalysts] = useState<Partial<Record<Ticker, string>>>({})
  const [dmdResearch, setDmdResearch]   = useState<Partial<Record<Ticker, PersistedResearch>>>({})
  const [dmdPrefillFocus, setDmdPrefillFocus] = useState<string | undefined>(undefined)
  const [dmdPrefillVersion, setDmdPrefillVersion] = useState(0)

  // Non-DMD state
  const defaultTicker = config.companies[0]?.ticker ?? 'BIIB'
  const [sectorTicker, setSectorTicker]       = useState(defaultTicker)
  const [sectorTab, setSectorTab]             = useState<'timeline' | 'research'>('timeline')
  const [sectorCatalysts, setSectorCatalysts] = useState<Record<string, string>>({})
  const [sectorResearch, setSectorResearch]   = useState<Record<string, PersistedResearch>>({})
  const [sectorPrefillFocus, setSectorPrefillFocus] = useState<string | undefined>(undefined)
  const [sectorPrefillVersion, setSectorPrefillVersion] = useState(0)

  const isDmd = sector === 'dmd'

  // ── Render: DMD ─────────────────────────────────────────────────────────────
  if (isDmd) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-canvas">

        {/* Top bar — mode toggle lives here */}
        <header className="flex items-center gap-4 px-6 py-3 border-b border-border bg-surface shrink-0">
          <a href="/" className="text-xs text-muted hover:text-[#e6edf3] transition-colors tracking-widest uppercase shrink-0">
            ← Hub
          </a>

          {/* Mode toggle — prominent, centered */}
          <div className="flex items-center gap-1 p-1 bg-canvas border border-border rounded-lg mx-auto">
            <button
              onClick={() => setDmdMode('company')}
              className={[
                'px-4 py-1.5 rounded text-xs font-semibold transition-all',
                dmdMode === 'company'
                  ? 'bg-surface text-[#e6edf3] shadow-sm'
                  : 'text-muted hover:text-[#e6edf3]',
              ].join(' ')}
            >
              Company View
            </button>
            <button
              onClick={() => setDmdMode('competitive')}
              className={[
                'px-4 py-1.5 rounded text-xs font-semibold transition-all',
                dmdMode === 'competitive'
                  ? 'bg-[#1f2937] text-accent shadow-sm border border-border'
                  : 'text-muted hover:text-[#e6edf3]',
              ].join(' ')}
            >
              ⊞ Competitive Overview
            </button>
          </div>

          <span className="text-xs text-muted shrink-0">v0.1 MVP</span>
        </header>

        {/* ── Competitive mode: full screen ── */}
        {dmdMode === 'competitive' && (
          <main className="flex-1 overflow-auto bg-canvas p-6">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-[#e6edf3]">DMD — competitive timeline</h2>
              <p className="text-xs text-muted mt-0.5">Four names on one axis · click an event for context</p>
            </div>
            <ProximityMapTab ticker={dmdTicker} />
          </main>
        )}

        {/* ── Company mode: strip + per-company tabs ── */}
        {dmdMode === 'company' && (
          <>
            <DmdCompanyStrip
              selected={dmdTicker}
              onSelect={setDmdTicker}
              catalysts={dmdCatalysts}
            />

            <div className="flex items-baseline gap-3 px-6 py-3 border-b border-border bg-canvas shrink-0">
              <h1 className="text-xl font-bold font-mono tracking-tight text-[#e6edf3]">${displayTicker(dmdTicker)}</h1>
              <span className="text-xs text-muted">DMD · live coverage</span>
            </div>

            <nav className="flex gap-1 px-6 pt-3 border-b border-border bg-canvas shrink-0">
              {DMD_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setDmdTab(tab.id)}
                  className={[
                    'px-4 py-2 text-xs rounded-t transition-colors',
                    dmdTab === tab.id
                      ? 'bg-surface text-[#e6edf3] border border-b-0 border-border'
                      : 'text-muted hover:text-[#e6edf3]',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <main className="flex-1 overflow-auto bg-canvas p-6">
              {dmdTab === 'timeline' && (
                <TimelineTab
                  ticker={dmdTicker}
                  onInvestigate={(focus) => {
                    setDmdPrefillFocus(focus)
                    setDmdPrefillVersion(v => v + 1)
                    setDmdTab('research')
                  }}
                />
              )}
              {dmdTab === 'research' && (
                <WarRoomTab
                  key={`${dmdTicker}-p${dmdPrefillVersion}`}
                  ticker={dmdTicker}
                  saved={dmdResearch[dmdTicker]}
                  onSave={(state) => setDmdResearch(prev => ({ ...prev, [dmdTicker]: state }))}
                  onSynthesis={(t, catalyst) => setDmdCatalysts(prev => ({ ...prev, [t as Ticker]: catalyst }))}
                  prefillFocus={dmdPrefillFocus}
                />
              )}
            </main>
          </>
        )}
      </div>
    )
  }

  // ── Render: Non-DMD sector ──────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <SectorSidebar
        companies={config.companies}
        selected={sectorTicker}
        onSelect={setSectorTicker}
        accentColor={config.accentColor}
        sectorLabel={config.label}
        catalysts={sectorCatalysts}
      />

      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center gap-4 px-6 py-3 border-b border-border bg-surface shrink-0">
          <a href="/" className="text-xs text-muted hover:text-[#e6edf3] transition-colors tracking-widest uppercase">
            ← Hub
          </a>
          <span className="text-xs text-muted" style={{ color: config.accentColor }}>
            {config.label} · coming soon
          </span>
          <span className="ml-auto text-xs text-muted">v0.2</span>
        </header>

        <div className="flex items-baseline gap-3 px-6 py-4 border-b border-border shrink-0">
          <h1 className="text-2xl font-bold font-mono tracking-tight text-[#e6edf3]">${sectorTicker}</h1>
          <span className="text-sm text-muted">{config.universe}</span>
        </div>

        <nav className="flex gap-1 px-6 pt-3 border-b border-border bg-canvas shrink-0">
          {(['timeline', 'research'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setSectorTab(tab)}
              className={[
                'px-4 py-2 text-xs rounded-t transition-colors',
                sectorTab === tab
                  ? 'bg-surface text-[#e6edf3] border border-b-0 border-border'
                  : 'text-muted hover:text-[#e6edf3]',
              ].join(' ')}
            >
              {tab === 'timeline' ? 'Timeline' : 'The Research Barn'}
            </button>
          ))}
        </nav>

        <main className="flex-1 overflow-auto bg-canvas p-6">
          {sectorTab === 'timeline' && (
            <TimelineTab
              ticker={sectorTicker}
              onInvestigate={(focus) => {
                setSectorPrefillFocus(focus)
                setSectorPrefillVersion(v => v + 1)
                setSectorTab('research')
              }}
            />
          )}
          {sectorTab === 'research' && (
            <WarRoomTab
              key={`${sectorTicker}-p${sectorPrefillVersion}`}
              ticker={sectorTicker}
              saved={sectorResearch[sectorTicker]}
              onSave={(state) => setSectorResearch(prev => ({ ...prev, [sectorTicker]: state }))}
              onSynthesis={(t, catalyst) => setSectorCatalysts(prev => ({ ...prev, [t]: catalyst }))}
              prefillFocus={sectorPrefillFocus}
            />
          )}
        </main>
      </div>
    </div>
  )
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function ResearchBarnPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-canvas">
        <span className="text-xs text-muted uppercase tracking-widest animate-pulse">Loading terminal…</span>
      </div>
    }>
      <ResearchBarnContent />
    </Suspense>
  )
}
