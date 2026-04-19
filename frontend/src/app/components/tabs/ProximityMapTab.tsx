'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import type { Ticker, Milestone } from '../../types'
import { displayTicker } from '../../types'
import { TICKER_DATA, TICKER_COLORS, ALL_TICKERS } from '../../mockData'

// ── Constants ──────────────────────────────────────────────────────────────────

const TODAY = '2026-04-15'

const TYPE_COLOR = {
  positive: '#3fb950',
  negative: '#f85149',
  neutral:  '#58a6ff',
} as const

// ── Theme-aware chart colors ──────────────────────────────────────────────────

function useChartColors() {
  const [colors, setColors] = useState({ grid: '#30363d', tick: '#8b949e' })

  useEffect(() => {
    const read = () => {
      const s = getComputedStyle(document.documentElement)
      setColors({
        grid: s.getPropertyValue('--border').trim() || '#30363d',
        tick: s.getPropertyValue('--muted').trim() || '#8b949e',
      })
    }
    read()
    const obs = new MutationObserver(read)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  return colors
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Normalise price series to % change from first data point. */
function normalizePrices(prices: { date: string; price: number }[]) {
  if (!prices.length) return []
  const base = prices[0].price
  return prices.map(p => ({
    date: p.date,
    pct: Math.round(((p.price - base) / base) * 1000) / 10,
  }))
}

function formatDate(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function formatDateLong(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function monthsFromNow(iso: string): number {
  const ms = new Date(iso + 'T12:00:00').getTime() - new Date(TODAY + 'T12:00:00').getTime()
  return ms / (1000 * 60 * 60 * 24 * 30)
}

function urgencyLabel(iso: string): { label: string; color: string } {
  const m = monthsFromNow(iso)
  if (m < 0) return { label: 'Past', color: 'text-muted' }
  if (m < 3)  return { label: '< 3 months', color: 'text-negative' }
  if (m < 9)  return { label: '< 9 months', color: 'text-[#ffa657]' }
  if (m < 18) return { label: '< 18 months', color: 'text-accent' }
  return { label: '2027+', color: 'text-muted' }
}

// Build the merged chart data: one object per date with a key per ticker
function buildChartData(visibleTickers: Ticker[]) {
  const dateSet: Record<string, true> = {}
  const normalised: Record<Ticker, Map<string, number>> = {} as Record<Ticker, Map<string, number>>

  for (const t of visibleTickers) {
    const norm = normalizePrices(TICKER_DATA[t].prices)
    normalised[t] = new Map(norm.map(p => [p.date, p.pct]))
    norm.forEach(p => { dateSet[p.date] = true })
  }

  const sorted = Object.keys(dateSet).sort()
  return sorted.map(date => {
    const point: Record<string, string | number> = { date }
    for (const t of visibleTickers) {
      const v = normalised[t].get(date)
      if (v !== undefined) point[t] = v
    }
    return point
  })
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function EventCard({ ticker, milestone, onClose }: {
  ticker: Ticker
  milestone: Milestone
  onClose: () => void
}) {
  const color = TICKER_COLORS[ticker]
  const isFuture = milestone.date > TODAY
  return (
    <div className="bg-surface border border-border rounded-lg p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 inline-block w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: TYPE_COLOR[milestone.type] }}
          />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-primary">{milestone.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                isFuture
                  ? 'border-accent/30 text-accent bg-accent/10'
                  : 'border-border text-muted'
              }`}>
                {isFuture ? 'Projected' : 'Historical'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-semibold" style={{ color }}>
                ${displayTicker(ticker)}
              </span>
              <span className="text-[10px] text-muted">{formatDateLong(milestone.date)}</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="text-muted hover:text-primary text-lg leading-none shrink-0">×</button>
      </div>
      <p className="text-xs text-secondary leading-relaxed border-l-2 pl-3" style={{ borderColor: color }}>
        {milestone.detail}
      </p>
    </div>
  )
}

// Single event row in the feed
function EventRow({ ticker, milestone, isSelected, onClick }: {
  ticker: Ticker
  milestone: Milestone
  isSelected: boolean
  onClick: () => void
}) {
  const color = TICKER_COLORS[ticker]
  const isFuture = milestone.date > TODAY
  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left flex items-start gap-3 px-4 py-2.5 rounded transition-colors',
        isSelected ? 'bg-surface ring-1 ring-border' : 'hover:bg-surface/50',
      ].join(' ')}
    >
      <span
        className={`mt-1 shrink-0 w-2 h-2 rounded-full ${isFuture ? 'ring-1 ring-offset-1 ring-offset-canvas' : ''}`}
        style={{
          backgroundColor: isFuture ? 'transparent' : TYPE_COLOR[milestone.type],
          borderColor: TYPE_COLOR[milestone.type],
          ...(isFuture ? { border: `1.5px solid ${TYPE_COLOR[milestone.type]}` } : {}),
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[10px] font-bold shrink-0" style={{ color }}>
            ${displayTicker(ticker)}
          </span>
          <span className="text-xs text-primary truncate">{milestone.label}</span>
        </div>
        <span className="text-[10px] text-muted">{formatDate(milestone.date)}</span>
      </div>
      <span className="text-[10px] text-muted shrink-0 hidden sm:inline">
        {isFuture ? '→' : ''}
      </span>
    </button>
  )
}

// ── Custom recharts tooltip ────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded px-3 py-2 text-[11px] space-y-1">
      <div className="text-muted mb-1">{label ? formatDate(label) : ''}</div>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span style={{ color: p.color }} className="font-semibold">${p.name}</span>
          <span className={p.value >= 0 ? 'text-positive' : 'text-negative'}>
            {p.value >= 0 ? '+' : ''}{p.value.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props { ticker: Ticker }

export default function ProximityMapTab({ ticker }: Props) {
  const [visibleTickers, setVisibleTickers] = useState<Ticker[]>(ALL_TICKERS)
  const [selectedEvent, setSelectedEvent] = useState<{ ticker: Ticker; milestone: Milestone } | null>(null)
  const [eventFilter, setEventFilter] = useState<'all' | 'historical' | 'projected'>('all')
  const [highlightTicker, setHighlightTicker] = useState<Ticker | null>(null)
  const chartColors = useChartColors()

  // Toggle a ticker's price line
  const toggleTicker = (t: Ticker) => {
    setVisibleTickers(prev => {
      const isVisible = prev.includes(t)
      if (isVisible && prev.length === 1) return prev // keep at least one
      return isVisible ? prev.filter(x => x !== t) : [...prev, t]
    })
  }

  // All events across all tickers, sorted by date
  const allEvents = useMemo(() => {
    const events: { ticker: Ticker; milestone: Milestone }[] = []
    for (const t of ALL_TICKERS) {
      for (const m of TICKER_DATA[t].milestones) {
        if (eventFilter === 'historical' && m.category !== 'historical') continue
        if (eventFilter === 'projected'  && m.category !== 'projected')  continue
        events.push({ ticker: t, milestone: m })
      }
    }
    return events.sort((a, b) => a.milestone.date.localeCompare(b.milestone.date))
  }, [eventFilter])

  // Upcoming catalysts only (projected, future)
  const upcomingCatalysts = useMemo(() => {
    const events: { ticker: Ticker; milestone: Milestone }[] = []
    for (const t of ALL_TICKERS) {
      for (const m of TICKER_DATA[t].milestones) {
        if (m.category === 'projected' && m.date >= TODAY) {
          events.push({ ticker: t, milestone: m })
        }
      }
    }
    return events.sort((a, b) => a.milestone.date.localeCompare(b.milestone.date))
  }, [])

  // Chart data
  const chartData = useMemo(
    () => buildChartData(visibleTickers),
    [visibleTickers],
  )

  // Reference lines for the selected event on the chart
  const refLineDate = selectedEvent?.milestone.date

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-sm font-semibold text-primary">Competitive Timeline</h2>
          <p className="text-xs text-muted mt-0.5">
            Normalised to % change from Jan 2024 — click any event to see details
          </p>
        </div>
        {/* Ticker toggles */}
        <div className="flex gap-1.5">
          {ALL_TICKERS.map(t => (
            <button
              key={t}
              onClick={() => toggleTicker(t)}
              onMouseEnter={() => setHighlightTicker(t)}
              onMouseLeave={() => setHighlightTicker(null)}
              className={[
                'text-[11px] font-bold px-2.5 py-1 rounded border transition-all',
                visibleTickers.includes(t)
                  ? 'border-transparent'
                  : 'opacity-30 border-border text-muted',
              ].join(' ')}
              style={visibleTickers.includes(t) ? { color: TICKER_COLORS[t], borderColor: TICKER_COLORS[t] + '50', backgroundColor: TICKER_COLORS[t] + '15' } : {}}
            >
              ${displayTicker(t)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Price chart ── */}
      <div className="bg-surface border border-border rounded-lg p-5">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 6" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fill: chartColors.tick, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={11}
              />
              <YAxis
                tickFormatter={v => `${v >= 0 ? '+' : ''}${v}%`}
                tick={{ fill: chartColors.tick, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip content={<ChartTooltip />} />
              {/* Selected-event reference line */}
              {refLineDate && (
                <ReferenceLine
                  x={refLineDate}
                  stroke={TICKER_COLORS[selectedEvent!.ticker]}
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
              )}
              {visibleTickers.map(t => (
                <Line
                  key={t}
                  type="monotone"
                  dataKey={t}
                  name={displayTicker(t)}
                  stroke={TICKER_COLORS[t]}
                  strokeWidth={highlightTicker === null || highlightTicker === t ? 2 : 1}
                  dot={false}
                  connectNulls
                  opacity={highlightTicker === null || highlightTicker === t ? 1 : 0.25}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-muted mt-2">% change from each ticker's first available price · Jan 2024 baseline</p>
      </div>

      {/* ── Selected event detail ── */}
      {selectedEvent && (
        <EventCard
          ticker={selectedEvent.ticker}
          milestone={selectedEvent.milestone}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {/* ── Upcoming catalysts ── */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <span className="text-xs font-semibold text-primary">Upcoming catalysts</span>
          <span className="text-[10px] text-muted">{upcomingCatalysts.length} events projected</span>
        </div>
        <div className="divide-y divide-border/50">
          {upcomingCatalysts.map((e, i) => {
            const { label, color } = urgencyLabel(e.milestone.date)
            const isSelected = selectedEvent?.ticker === e.ticker && selectedEvent?.milestone.date === e.milestone.date
            return (
              <div key={i} className="flex items-stretch">
                {/* Urgency stripe */}
                <div className="w-1 shrink-0" style={{ backgroundColor: TICKER_COLORS[e.ticker] + '60' }} />
                <div className="flex-1">
                  <EventRow
                    ticker={e.ticker}
                    milestone={e.milestone}
                    isSelected={isSelected}
                    onClick={() => setSelectedEvent(isSelected ? null : e)}
                  />
                </div>
                <div className="flex items-center pr-4">
                  <span className={`text-[10px] ${color}`}>{label}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Full event feed ── */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <span className="text-xs font-semibold text-primary">Event feed</span>
          <div className="flex gap-1">
            {(['all', 'historical', 'projected'] as const).map(f => (
              <button
                key={f}
                onClick={() => setEventFilter(f)}
                className={[
                  'text-[10px] px-2.5 py-1 rounded transition-colors capitalize',
                  eventFilter === f
                    ? 'bg-accent/15 text-accent border border-accent/30'
                    : 'text-muted hover:text-primary border border-transparent',
                ].join(' ')}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto divide-y divide-border/30">
          {allEvents.map((e, i) => {
            const isSelected = selectedEvent?.ticker === e.ticker && selectedEvent?.milestone.date === e.milestone.date
            return (
              <EventRow
                key={i}
                ticker={e.ticker}
                milestone={e.milestone}
                isSelected={isSelected}
                onClick={() => setSelectedEvent(isSelected ? null : e)}
              />
            )
          })}
        </div>
      </div>

    </div>
  )
}
