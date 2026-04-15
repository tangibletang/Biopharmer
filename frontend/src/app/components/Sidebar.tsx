'use client'

import type { Ticker } from '../types'
import { displayTicker } from '../types'
import { ALL_TICKERS, COMPANY_NAMES, TICKER_COLORS, CLINICAL_DATA } from '../mockData'

interface Props {
  selected: Ticker
  onSelect: (t: Ticker) => void
  catalysts?: Partial<Record<Ticker, string>>
}

export default function Sidebar({ selected, onSelect, catalysts = {} }: Props) {
  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-border bg-surface overflow-y-auto">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-border">
        <div className="text-accent text-sm font-bold tracking-wider">BIOPHARMER</div>
        <div className="text-muted text-[10px] mt-0.5">DMD MICRO-UNIVERSE</div>
      </div>

      {/* Ticker list */}
      <nav className="flex flex-col gap-1 p-2 mt-1">
        {ALL_TICKERS.map(t => {
          const isActive = t === selected
          const clinical = CLINICAL_DATA[t]
          return (
            <button
              key={t}
              onClick={() => onSelect(t)}
              className={[
                'w-full text-left rounded px-3 py-3 transition-colors group',
                isActive
                  ? 'bg-[#1f2937] ring-1 ring-border'
                  : 'hover:bg-[#1c2128]',
              ].join(' ')}
            >
              {/* Ticker row */}
              <div className="flex items-center gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: TICKER_COLORS[t] }}
                />
                <span
                  className="text-sm font-bold"
                  style={{ color: isActive ? TICKER_COLORS[t] : '#e6edf3' }}
                >
                  ${displayTicker(t)}
                </span>
              </div>

              {/* Company name */}
              <div className="text-[10px] text-muted mt-0.5 pl-3.5 leading-tight">
                {COMPANY_NAMES[t]}
              </div>

              {/* Mini metrics */}
              {isActive && (
                <div className="mt-2 pl-3.5 flex flex-col gap-0.5">
                  <Metric label="Emax" value={`${clinical.emax_pct}%`} color="text-positive" />
                  <Metric label="t½"   value={`${clinical.half_life_days}d`} color="text-accent" />
                  <Metric label="AE3+"  value={`${clinical.grade_3_ae_pct}%`} color="text-negative" />
                </div>
              )}

              {/* AI catalyst one-liner — shown for all tickers once research has run */}
              {catalysts[t] && (
                <div className="mt-2 pl-3.5">
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
        <div className="text-[10px] text-muted space-y-1">
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
