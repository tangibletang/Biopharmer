'use client'

import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { Ticker, Milestone } from '../../types'
import { TICKER_DATA } from '../../mockData'
import MilestoneModal from '../MilestoneModal'

interface Props { ticker: Ticker }

type View = 'historical' | 'projected'

// ── Custom milestone dot on the price chart ────────────────────────────────
function MilestoneDot(props: {
  cx?: number; cy?: number; payload?: { date: string }
  milestoneMap: Map<string, Milestone>
  onClickMilestone: (m: Milestone) => void
}) {
  const { cx = 0, cy = 0, payload, milestoneMap, onClickMilestone } = props
  if (!payload) return null
  const milestone = milestoneMap.get(payload.date)
  if (!milestone) return <circle cx={cx} cy={cy} r={2} fill="#30363d" />

  const fill =
    milestone.type === 'positive' ? '#3fb950' :
    milestone.type === 'negative' ? '#f85149' : '#58a6ff'

  return (
    <circle
      cx={cx} cy={cy} r={7}
      fill={fill} stroke="#0d1117" strokeWidth={2}
      style={{ cursor: 'pointer' }}
      onClick={() => onClickMilestone(milestone)}
    />
  )
}

// ── Chart tooltip ──────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, milestoneMap }: {
  active?: boolean
  payload?: Array<{ payload: { date: string; price: number } }>
  milestoneMap: Map<string, Milestone>
}) {
  if (!active || !payload?.length) return null
  const { date, price } = payload[0].payload
  const milestone = milestoneMap.get(date)
  return (
    <div className="bg-surface border border-border rounded p-3 text-xs shadow-xl">
      <div className="text-muted mb-1">{date}</div>
      <div className="text-[#e6edf3] font-semibold">${price.toFixed(2)}</div>
      {milestone && (
        <div className="mt-1.5 pt-1.5 border-t border-border text-[11px] max-w-[200px] leading-snug text-muted">
          {milestone.label}
        </div>
      )}
    </div>
  )
}

// ── Projected forward timeline ─────────────────────────────────────────────
function ProjectedTimeline({
  milestones,
  onSelect,
}: {
  milestones: Milestone[]
  onSelect: (m: Milestone) => void
}) {
  const sorted = [...milestones].sort((a, b) => a.date.localeCompare(b.date))

  // Group by year
  const byYear = sorted.reduce<Record<string, Milestone[]>>((acc, m) => {
    const year = m.date.slice(0, 4)
    ;(acc[year] ??= []).push(m)
    return acc
  }, {})

  return (
    <div className="space-y-8">
      {Object.entries(byYear).map(([year, events]) => (
        <div key={year}>
          {/* Year header */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-bold text-accent tracking-widest">{year}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Events */}
          <div className="relative pl-6">
            {/* Vertical spine */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

            <div className="space-y-5">
              {events.map((m, i) => {
                const dotColor =
                  m.type === 'positive' ? 'bg-positive border-positive/40' :
                  m.type === 'negative' ? 'bg-negative border-negative/40' :
                                          'bg-accent border-accent/40'
                const badgeColor =
                  m.type === 'positive' ? 'bg-positive/10 text-positive border-positive/20' :
                  m.type === 'negative' ? 'bg-negative/10 text-negative border-negative/20' :
                                          'bg-accent/10 text-accent border-accent/20'
                return (
                  <button
                    key={i}
                    onClick={() => onSelect(m)}
                    className="relative w-full text-left group"
                  >
                    {/* Dot on spine */}
                    <span className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 ${dotColor} ring-2 ring-canvas`} />

                    <div className="bg-surface border border-border rounded-lg p-4 hover:border-accent/40 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <span className="text-sm font-semibold text-[#e6edf3] group-hover:text-accent transition-colors leading-snug">
                          {m.label}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded border shrink-0 ${badgeColor}`}>
                          {m.type.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted mb-2 font-mono">{m.date}</div>
                      <p className="text-xs text-[#8b949e] leading-relaxed line-clamp-2">
                        {m.detail}
                      </p>
                      <div className="mt-2 text-[10px] text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                        Click for full detail →
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function TimelineTab({ ticker }: Props) {
  const [view, setView]                       = useState<View>('historical')
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null)

  const data        = TICKER_DATA[ticker]
  const historical  = data.milestones.filter(m => m.category === 'historical')
  const projected   = data.milestones.filter(m => m.category === 'projected')
  const milestoneMap = new Map(historical.map(m => [m.date, m]))

  const priceMin = Math.min(...data.prices.map(p => p.price))
  const priceMax = Math.max(...data.prices.map(p => p.price))
  const padding  = (priceMax - priceMin) * 0.08

  return (
    <div className="space-y-5">

      {/* ── Toggle ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 bg-surface border border-border rounded-lg w-fit">
        {(['historical', 'projected'] as View[]).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={[
              'px-4 py-1.5 rounded text-xs font-semibold transition-all',
              view === v
                ? v === 'historical'
                  ? 'bg-[#1f2937] text-[#e6edf3] shadow-sm'
                  : 'bg-accent text-canvas shadow-sm'
                : 'text-muted hover:text-[#e6edf3]',
            ].join(' ')}
          >
            {v === 'historical' ? '◷ Historical' : '◈ Projected'}
          </button>
        ))}
        <span className="ml-2 pr-2 text-[10px] text-muted">
          {view === 'historical'
            ? `${historical.length} events · 2024–2025`
            : `${projected.length} upcoming · 2026–2027`}
        </span>
      </div>

      {/* ── Historical view: price chart + catalyst log ────────────────── */}
      {view === 'historical' && (
        <>
          <div className="bg-surface border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-[#e6edf3]">
                ${ticker} — 2024 Price & Clinical Milestones
              </h2>
              <span className="text-xs text-muted">Weekly close · Mock data</span>
            </div>
            <p className="text-xs text-muted mb-6">
              Click a coloured dot to view the clinical event detail.
            </p>

            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={data.prices} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false} axisLine={false}
                  tick={{ fill: '#8b949e', fontSize: 10 }}
                  tickFormatter={d => {
                    const [, month, day] = d.split('-')
                    return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+month-1]} ${+day}`
                  }}
                  interval={7}
                />
                <YAxis
                  domain={[priceMin - padding, priceMax + padding]}
                  tickLine={false} axisLine={false}
                  tick={{ fill: '#8b949e', fontSize: 10 }}
                  tickFormatter={v => `$${v.toFixed(0)}`}
                  width={48}
                />
                <Tooltip
                  content={<ChartTooltip milestoneMap={milestoneMap} />}
                  cursor={{ stroke: '#30363d', strokeWidth: 1 }}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke={data.color}
                  strokeWidth={2}
                  dot={(props: { cx?: number; cy?: number; payload?: { date: string } }) => (
                    <MilestoneDot
                      key={props.payload?.date}
                      {...props}
                      milestoneMap={milestoneMap}
                      onClickMilestone={setSelectedMilestone}
                    />
                  )}
                  activeDot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Catalyst log */}
          <div className="bg-surface border border-border rounded-lg p-5">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">
              Historical Catalyst Log
            </h3>
            <div className="space-y-2">
              {historical.map(m => {
                const dotColor =
                  m.type === 'positive' ? 'bg-positive' :
                  m.type === 'negative' ? 'bg-negative' : 'bg-accent'
                return (
                  <button
                    key={m.date}
                    onClick={() => setSelectedMilestone(m)}
                    className="w-full text-left flex gap-3 items-start hover:bg-[#1c2128] rounded p-2 -mx-2 transition-colors group"
                  >
                    <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0 mt-1`} />
                    <div>
                      <div className="text-xs text-[#e6edf3] group-hover:text-accent transition-colors">{m.label}</div>
                      <div className="text-[10px] text-muted mt-0.5">{m.date}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Projected view: forward timeline ──────────────────────────── */}
      {view === 'projected' && (
        <div className="bg-surface border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-[#e6edf3]">
              ${ticker} — Upcoming Catalysts
            </h2>
            <span className="text-xs text-muted">Click any event for full detail</span>
          </div>
          <p className="text-xs text-muted mb-6">
            Forward-looking events based on company guidance and trial timelines. All dates are estimates.
          </p>
          <ProjectedTimeline milestones={projected} onSelect={setSelectedMilestone} />
        </div>
      )}

      {selectedMilestone && (
        <MilestoneModal
          milestone={selectedMilestone}
          onClose={() => setSelectedMilestone(null)}
        />
      )}
    </div>
  )
}
