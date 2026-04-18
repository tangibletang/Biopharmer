'use client'

import { useEffect, useState } from 'react'
import type { Ticker } from '../types'
import { displayTicker } from '../types'
import { ALL_TICKERS, COMPANY_NAMES, TICKER_COLORS, CLINICAL_DATA } from '../mockData'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

interface PriceSummary {
  price: number
  change: number  // absolute
  changePct: number
}

/** Last close vs prior daily close (1D %); uses 1mo daily series, skips intraday rows if present. */
async function fetchPriceSummary(ticker: string): Promise<PriceSummary | null> {
  try {
    const res = await fetch(`${API}/api/prices/${ticker}?period=1mo`)
    if (!res.ok) return null
    const data = await res.json()
    const raw: { date: string; price: number }[] = data.prices ?? []
    const daily = raw.filter(p => !String(p.date).includes(' '))
    const series = daily.length >= 2 ? daily : raw
    if (series.length < 2) return null
    const latest = series[series.length - 1].price
    const prev   = series[series.length - 2].price
    if (prev === 0) return null
    return {
      price:     latest,
      change:    latest - prev,
      changePct: ((latest - prev) / prev) * 100,
    }
  } catch {
    return null
  }
}

interface Props {
  selected: Ticker
  onSelect: (t: Ticker) => void
  catalysts?: Partial<Record<Ticker, string>>
}

export default function Sidebar({ selected, onSelect, catalysts = {} }: Props) {
  const [prices, setPrices] = useState<Partial<Record<Ticker, PriceSummary>>>({})

  // Fetch prices for all tickers on mount
  useEffect(() => {
    for (const t of ALL_TICKERS) {
      fetchPriceSummary(t).then(summary => {
        if (summary) setPrices(prev => ({ ...prev, [t]: summary }))
      })
    }
  }, [])

  return (
    <aside className="w-60 shrink-0 flex flex-col border-r border-border bg-surface overflow-y-auto">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-border">
        <a href="/" className="block">
          <div className="text-accent text-sm font-bold tracking-wider hover:text-accent/80 transition-colors">
            BIOPHARMER
          </div>
          <div className="text-muted text-[10px] mt-0.5 uppercase tracking-wide">DMD Micro-Universe</div>
        </a>
      </div>

      {/* Ticker list */}
      <nav className="flex flex-col gap-1 p-2 mt-1">
        {ALL_TICKERS.map(t => {
          const isActive = t === selected
          const summary  = prices[t]
          const clinical = CLINICAL_DATA[t]
          const positive = summary && summary.changePct >= 0

          return (
            <button
              key={t}
              onClick={() => onSelect(t)}
              className={[
                'w-full text-left rounded-lg px-3 py-3 transition-colors group',
                isActive
                  ? 'bg-[#1f2937] ring-1 ring-border'
                  : 'hover:bg-[#1c2128]',
              ].join(' ')}
            >
              {/* Top row: ticker + price */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: TICKER_COLORS[t] }}
                  />
                  <span
                    className="text-sm font-bold font-mono"
                    style={{ color: isActive ? TICKER_COLORS[t] : '#e6edf3' }}
                  >
                    ${displayTicker(t)}
                  </span>
                </div>

                {/* Live price */}
                {summary ? (
                  <span
                    className="text-xs font-mono font-semibold"
                    style={{ color: isActive ? TICKER_COLORS[t] : '#e6edf3' }}
                  >
                    ${summary.price.toFixed(2)}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted/40">—</span>
                )}
              </div>

              {/* Company name + day change */}
              <div className="flex items-center justify-between mt-1 pl-4">
                <div className="text-[10px] text-muted leading-tight">{COMPANY_NAMES[t]}</div>
                {summary && (
                  <span className={['text-[10px] font-mono inline-flex items-center gap-1', positive ? 'text-positive' : 'text-negative'].join(' ')}>
                    <span className="text-muted/80">1D</span>
                    <span>{positive ? '+' : ''}{summary.changePct.toFixed(2)}%</span>
                  </span>
                )}
              </div>

              {/* Clinical mini-metrics (active only) */}
              {isActive && (
                <div className="mt-2.5 pl-4 flex flex-col gap-0.5 border-t border-border/40 pt-2">
                  <Metric label="Emax" value={`${clinical.emax_pct}%`}  color="text-positive" />
                  <Metric label="t½"   value={`${clinical.half_life_days}d`} color="text-accent" />
                  <Metric label="AE3+" value={`${clinical.grade_3_ae_pct}%`} color="text-negative" />
                </div>
              )}

              {/* AI catalyst one-liner */}
              {catalysts[t] && (
                <div className="mt-2 pl-4">
                  <p className="text-[10px] text-accent/80 leading-snug line-clamp-2">
                    → {catalysts[t]}
                  </p>
                </div>
              )}
            </button>
          )
        })}
      </nav>

      {/* Legend */}
      <div className="mt-auto p-4 border-t border-border">
        <div className="text-[10px] text-muted space-y-1.5">
          <div className="flex gap-2 items-center">
            <span className="w-2 h-2 rounded-full bg-positive shrink-0" />
            <span>Positive catalyst</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="w-2 h-2 rounded-full bg-negative shrink-0" />
            <span>Negative catalyst</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
            <span>Neutral event</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between text-[10px]">
      <span className="text-muted">{label}</span>
      <span className={color}>{value}</span>
    </div>
  )
}
