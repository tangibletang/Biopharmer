'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { Ticker, Milestone, PricesResponse } from '../../types'
import { displayTicker } from '../../types'
import { TICKER_DATA, ALL_TICKERS } from '../../mockData'
import MilestoneModal from '../MilestoneModal'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const DMD_TICKERS = new Set<string>(ALL_TICKERS)
const EMPTY_TICKER_DATA = {
  milestones: [] as Milestone[],
  prices: [] as { date: string; price: number }[],
  color: '#58a6ff',
}

// ── Period config ─────────────────────────────────────────────────────────────
const PERIODS = [
  { label: '3M',  value: '3mo' },
  { label: '6M',  value: '6mo' },
  { label: 'YTD', value: 'ytd' },
  { label: '1Y',  value: '1y'  },
  { label: '2Y',  value: '2y'  },
  { label: '5Y',  value: '5y'  },
  { label: 'MAX', value: 'max' },
] as const

type PeriodValue = typeof PERIODS[number]['value']

type Filter = 'all' | 'historical' | 'projected'

const TYPE_COLOR = {
  positive: '#3fb950',
  negative: '#f85149',
  neutral:  '#58a6ff',
} as const

// ── Timeline geometry ─────────────────────────────────────────────────────────
const TW     = 2900
const PAD    = 80
const SH     = 400
const SY     = 196
const DR     = 7
const CH     = 52
const CW     = 152
const CARD_H = 112

const T_START = new Date('2024-01-01')
const T_END   = new Date('2028-01-01')
const T_SPAN  = (T_END.getTime() - T_START.getTime()) / 86400000

function localDateISO(d: Date): string {
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function dx(dateStr: string): number {
  const days = (new Date(dateStr + 'T12:00:00').getTime() - T_START.getTime()) / 86400000
  return PAD + (days / T_SPAN) * (TW - PAD * 2)
}

function priceProviderLabel(provider: string | undefined): string {
  return provider === 'alpha_vantage' ? 'Alpha Vantage' : 'Yahoo Finance'
}

// ── Chart sub-components ──────────────────────────────────────────────────────

/** Map each historical milestone to the closest trading date in the price series (within 6 days). */
function milestoneMapForSeries(historical: Milestone[], seriesDates: string[]): Map<string, Milestone> {
  const out = new Map<string, Milestone>()
  if (!seriesDates.length) return out
  for (const ms of historical) {
    const t = new Date(`${ms.date}T12:00:00`).getTime()
    let best: string | null = null
    let bestD = Infinity
    for (const d of seriesDates) {
      const dt = Math.abs(new Date(`${d}T12:00:00`).getTime() - t)
      if (dt < bestD) { bestD = dt; best = d }
    }
    if (best != null && bestD <= 6 * 86400000) out.set(best, ms)
  }
  return out
}

function MilestoneDot(props: {
  cx?: number; cy?: number; payload?: { date: string }
  mmap: Map<string, Milestone>
  onOpen: (m: Milestone) => void
}) {
  const { cx = 0, cy = 0, payload, mmap, onOpen } = props
  if (!payload) return null
  const m = mmap.get(payload.date)
  if (!m) return <circle cx={cx} cy={cy} r={2} fill="#21262d" />
  return (
    <circle
      cx={cx} cy={cy} r={7}
      fill={TYPE_COLOR[m.type]} stroke="#0d1117" strokeWidth={2}
      style={{ cursor: 'pointer' }}
      onClick={() => onOpen(m)}
    />
  )
}

function ChartTip({ active, payload, mmap }: {
  active?: boolean
  payload?: Array<{ payload: { date: string; price: number } }>
  mmap: Map<string, Milestone>
}) {
  if (!active || !payload?.length) return null
  const { date, price } = payload[0].payload
  const m = mmap.get(date)
  return (
    <div className="bg-surface border border-border rounded p-3 text-xs shadow-xl">
      <div className="text-muted mb-1">{date}</div>
      <div className="text-[#e6edf3] font-semibold">${price.toFixed(2)}</div>
      {m && (
        <div className="mt-1.5 pt-1.5 border-t border-border text-[11px] max-w-[200px] leading-snug text-muted">
          {m.label}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TimelineTab({ ticker }: { ticker: string }) {
  const [period, setPeriod]       = useState<PeriodValue>('2y')
  const [filter, setFilter]       = useState<Filter>('all')
  const [selected, setSelected]   = useState<Milestone | null>(null)
  const [yahooPrices, setYahooPrices] = useState<PricesResponse | null>(null)
  const [pricesLoading, setPricesLoading] = useState(false)
  const [pricesError, setPricesError]     = useState<string | null>(null)
  const timelineScrollRef = useRef<HTMLDivElement>(null)
  const [todayStr, setTodayStr]   = useState<string | null>(null)

  // Client-only today (avoids hydration mismatch)
  useEffect(() => { setTodayStr(localDateISO(new Date())) }, [])

  // Fetch prices whenever ticker or period changes
  useEffect(() => {
    let cancelled = false
    setPricesLoading(true)
    setPricesError(null)
    setYahooPrices(null)
    fetch(`${API}/api/prices/${ticker}?period=${period}`)
      .then(async res => {
        if (!res.ok) throw new Error((await res.text()) || `${res.status}`)
        return res.json() as Promise<PricesResponse>
      })
      .then(data => { if (!cancelled && data.prices?.length) setYahooPrices(data) })
      .catch(e   => { if (!cancelled) setPricesError(String(e)) })
      .finally(() => { if (!cancelled) setPricesLoading(false) })
    return () => { cancelled = true }
  }, [ticker, period])

  // Center timeline on today
  const todayX = todayStr ? dx(todayStr) : null
  useLayoutEffect(() => {
    if (todayX == null) return
    const el = timelineScrollRef.current
    if (!el) return
    const center = () => {
      const cw  = el.clientWidth
      const max = Math.max(0, el.scrollWidth - cw)
      el.scrollLeft = Math.max(0, Math.min(todayX - cw / 2, max))
    }
    center()
    requestAnimationFrame(center)
  }, [ticker, todayX])

  const todayLegend = useMemo(() => {
    const d = new Date()
    return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()] + ' ' + d.getFullYear()
  }, [])

  // Data
  const data       = DMD_TICKERS.has(ticker) ? TICKER_DATA[ticker as Ticker] : EMPTY_TICKER_DATA
  const historical = data.milestones.filter((m: Milestone) => m.category === 'historical')
  const projected  = data.milestones.filter((m: Milestone) => m.category === 'projected')

  const chartPrices = yahooPrices?.prices?.length ? yahooPrices.prices : data.prices
  const seriesDates = chartPrices.map(p => p.date)
  const mmap = yahooPrices?.prices?.length
    ? milestoneMapForSeries(historical, seriesDates)
    : new Map(historical.map(m => [m.date, m]))

  const priceMin = chartPrices.length ? Math.min(...chartPrices.map(p => p.price)) : 0
  const priceMax = chartPrices.length ? Math.max(...chartPrices.map(p => p.price)) : 1
  const ppad     = Math.max((priceMax - priceMin) * 0.08, 0.01)

  // Latest price + day change for header
  const latestPrice = chartPrices.length ? chartPrices[chartPrices.length - 1].price : null
  const prevPrice   = chartPrices.length > 1 ? chartPrices[chartPrices.length - 2].price : null
  const dayChange   = latestPrice != null && prevPrice != null ? latestPrice - prevPrice : null
  const dayChangePct = dayChange != null && prevPrice ? (dayChange / prevPrice) * 100 : null

  function opa(cat: 'historical' | 'projected') {
    return filter === 'all' || filter === cat ? 1 : 0.18
  }

  return (
    <div className="space-y-4">

      {/* ══ 1. PRICE CHART ════════════════════════════════════════════════════ */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">

        {/* Chart header */}
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
          <div>
            <div className="flex items-baseline gap-3">
              <span className="text-lg font-bold font-mono text-[#e6edf3]">
                ${displayTicker(ticker)}
              </span>
              {latestPrice != null && (
                <>
                  <span className="text-xl font-semibold font-mono text-[#e6edf3]">
                    ${latestPrice.toFixed(2)}
                  </span>
                  {dayChange != null && dayChangePct != null && (
                    <span className={[
                      'text-sm font-mono',
                      dayChange >= 0 ? 'text-positive' : 'text-negative',
                    ].join(' ')}>
                      {dayChange >= 0 ? '+' : ''}{dayChange.toFixed(2)} ({dayChange >= 0 ? '+' : ''}{dayChangePct.toFixed(2)}%)
                    </span>
                  )}
                </>
              )}
              {pricesLoading && (
                <span className="text-xs text-muted animate-pulse">loading…</span>
              )}
            </div>
            <div className="text-[10px] text-muted mt-0.5">
              {yahooPrices
                ? `${yahooPrices.yahoo_symbol} · ${priceProviderLabel(yahooPrices.provider)} · ${chartPrices.length} days`
                : pricesError
                  ? 'Live prices unavailable — showing embedded data'
                  : 'Embedded weekly sample'}
              {yahooPrices?.currency ? ` · ${yahooPrices.currency}` : ''}
            </div>
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-0.5 p-0.5 bg-canvas border border-border rounded-lg shrink-0">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={[
                  'px-2.5 py-1.5 rounded text-[11px] font-semibold transition-all',
                  period === p.value
                    ? 'bg-[#1f2937] text-[#e6edf3]'
                    : 'text-muted hover:text-[#e6edf3]',
                ].join(' ')}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart body */}
        <div className="px-2 pb-4">
          {chartPrices.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartPrices} margin={{ top: 5, right: 20, bottom: 0, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
                <XAxis
                  dataKey="date" tickLine={false} axisLine={false}
                  tick={{ fill: '#8b949e', fontSize: 10 }}
                  tickFormatter={d => {
                    const [yr, mo] = d.split('-')
                    const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+mo - 1]
                    return mo === '01' ? `${month} '${yr.slice(2)}` : month
                  }}
                  minTickGap={32}
                />
                <YAxis
                  domain={[priceMin - ppad, priceMax + ppad]}
                  tickLine={false} axisLine={false}
                  tick={{ fill: '#8b949e', fontSize: 10 }}
                  tickFormatter={v => `$${v.toFixed(0)}`}
                  width={48}
                />
                {todayStr && seriesDates.includes(todayStr) && (
                  <ReferenceLine x={todayStr} stroke="#58a6ff" strokeDasharray="4 3" strokeOpacity={0.5} />
                )}
                <Tooltip
                  content={<ChartTip mmap={mmap} />}
                  cursor={{ stroke: '#30363d', strokeWidth: 1 }}
                />
                <Line
                  type="monotone" dataKey="price"
                  stroke={data.color} strokeWidth={2}
                  dot={(p: { cx?: number; cy?: number; payload?: { date: string } }) => (
                    <MilestoneDot key={p.payload?.date} {...p} mmap={mmap} onOpen={setSelected} />
                  )}
                  activeDot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex items-center justify-center">
              <span className="text-xs text-muted">
                {pricesLoading ? 'Loading prices…' : 'No price data available'}
              </span>
            </div>
          )}
        </div>

        <div className="px-5 pb-3 text-[10px] text-muted">
          Colored dots on the chart are historical catalyst events — click to view analysis
        </div>
      </div>

      {/* ══ 2. CATALYST TIMELINE ══════════════════════════════════════════════ */}
      <div className="bg-surface border border-border rounded-lg p-4">

        {/* Filter + count row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1 p-1 bg-canvas border border-border rounded-lg">
            {(['all', 'historical', 'projected'] as Filter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={[
                  'px-3 py-1.5 rounded text-xs font-semibold transition-all',
                  filter === f
                    ? f === 'projected' ? 'bg-accent text-canvas' : 'bg-[#1f2937] text-[#e6edf3]'
                    : 'text-muted hover:text-[#e6edf3]',
                ].join(' ')}
              >
                {f === 'all' ? 'All Events' : f === 'historical' ? '◷ Historical' : '◈ Projected'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 text-[10px] text-muted">
            <span>{historical.length} historical · {projected.length} projected</span>
            <span className="text-accent">↔ scroll · centered on today</span>
          </div>
        </div>

        {/* Scrollable timeline */}
        <div
          ref={timelineScrollRef}
          className="overflow-x-auto overflow-y-hidden scroll-smooth"
          style={{ cursor: 'grab' }}
        >
          <div style={{ width: TW, height: SH, position: 'relative', flexShrink: 0 }}>

            <svg
              width={TW} height={SH}
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
            >
              {/* Spine */}
              <line x1={PAD / 2} y1={SY} x2={TW - PAD / 2} y2={SY} stroke="#30363d" strokeWidth={1} />

              {/* Year ticks + labels */}
              {['2024','2025','2026','2027'].map(y => {
                const x  = dx(`${y}-07-01`)
                const x0 = dx(`${y}-01-01`)
                return (
                  <g key={y}>
                    <line x1={x0} y1={SY - 10} x2={x0} y2={SY + 10} stroke="#484f58" strokeWidth={1} />
                    <text x={x} y={SY + 28} textAnchor="middle" fill="#484f58"
                      fontSize={11} fontFamily="ui-monospace,monospace" fontWeight="600">
                      {y}
                    </text>
                  </g>
                )
              })}
              <line x1={dx('2028-01-01')} y1={SY - 6} x2={dx('2028-01-01')} y2={SY + 6} stroke="#484f58" strokeWidth={1} />

              {/* Today marker */}
              {todayX != null && (
                <g>
                  <line x1={todayX} y1={SY - 80} x2={todayX} y2={SY + 80}
                    stroke="#58a6ff" strokeWidth={1.5} strokeDasharray="5 3" strokeOpacity={0.55} />
                  <rect x={todayX - 20} y={SY - 97} width={40} height={18} rx={4} fill="#58a6ff" fillOpacity={0.12} />
                  <text x={todayX} y={SY - 84} textAnchor="middle" fill="#58a6ff"
                    fontSize={9} fontFamily="ui-monospace,monospace" fontWeight="700" letterSpacing="1">
                    TODAY
                  </text>
                </g>
              )}

              {/* Historical dots + connectors */}
              {historical.map((m, i) => {
                const x = dx(m.date)
                const col = TYPE_COLOR[m.type]
                return (
                  <g key={i}
                    style={{ opacity: opa('historical'), transition: 'opacity 0.2s', pointerEvents: 'all', cursor: 'pointer' }}
                    onClick={() => setSelected(m)}>
                    <line x1={x} y1={SY - DR - 2} x2={x} y2={SY - DR - CH} stroke={col} strokeWidth={1} strokeOpacity={0.35} />
                    <circle cx={x} cy={SY} r={DR} fill={col} stroke="#161b22" strokeWidth={2} />
                  </g>
                )
              })}

              {/* Projected dots + connectors (below spine, dashed) */}
              {projected.map((m, i) => {
                const x = dx(m.date)
                const col = TYPE_COLOR[m.type]
                return (
                  <g key={i}
                    style={{ opacity: opa('projected'), transition: 'opacity 0.2s', pointerEvents: 'all', cursor: 'pointer' }}
                    onClick={() => setSelected(m)}>
                    <line x1={x} y1={SY + DR + 2} x2={x} y2={SY + DR + CH} stroke={col} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.35} />
                    <circle cx={x} cy={SY} r={DR} fill="#161b22" stroke={col} strokeWidth={2} strokeDasharray="4 2" />
                  </g>
                )
              })}
            </svg>

            {/* Historical event cards (above spine) */}
            {historical.map((m, i) => {
              const x = dx(m.date)
              const col = TYPE_COLOR[m.type]
              return (
                <button key={i} onClick={() => setSelected(m)}
                  style={{
                    position: 'absolute', left: x - CW / 2, top: SY - DR - CH - 4 - CARD_H,
                    width: CW, height: CARD_H,
                    opacity: opa('historical'), transition: 'opacity 0.2s',
                  }}
                  className="text-left bg-canvas border border-border rounded-lg p-2.5 hover:border-positive/50 group transition-colors"
                >
                  <div className="text-[9px] font-mono text-muted mb-1 tabular-nums">{m.date}</div>
                  <div className="text-[11px] font-semibold text-[#e6edf3] leading-tight group-hover:text-accent transition-colors"
                    style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {m.label}
                  </div>
                  <div className="mt-2" style={{ width: 20, height: 2, backgroundColor: col, borderRadius: 1 }} />
                </button>
              )
            })}

            {/* Projected event cards (below spine, dashed) */}
            {projected.map((m, i) => {
              const x = dx(m.date)
              const col = TYPE_COLOR[m.type]
              return (
                <button key={i} onClick={() => setSelected(m)}
                  style={{
                    position: 'absolute', left: x - CW / 2, top: SY + DR + CH + 6,
                    width: CW, height: CARD_H,
                    opacity: opa('projected'), transition: 'opacity 0.2s',
                  }}
                  className="text-left bg-canvas border border-dashed border-border rounded-lg p-2.5 hover:border-accent/50 group transition-colors"
                >
                  <div className="flex items-center gap-1 mb-1">
                    <div className="text-[9px] font-mono text-muted tabular-nums">{m.date}</div>
                    <span className="text-[8px] text-muted border border-border rounded px-1 ml-auto">est.</span>
                  </div>
                  <div className="text-[11px] font-semibold text-[#e6edf3] leading-tight group-hover:text-accent transition-colors"
                    style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {m.label}
                  </div>
                  <div className="mt-2" style={{ width: 20, height: 2, backgroundColor: col, borderRadius: 1, opacity: 0.55 }} />
                </button>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-border text-[10px] text-muted">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-positive inline-block" />Positive</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-negative inline-block" />Negative</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-accent inline-block" />Neutral</span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border-2 border-muted inline-block" style={{ borderStyle: 'dashed' }} />
            Projected (est.)
          </span>
          <span className="flex items-center gap-1.5 ml-auto text-accent">
            <span className="w-0.5 h-3 bg-accent opacity-60 inline-block" />TODAY · {todayLegend}
          </span>
        </div>
      </div>

      {/* ══ 3. PROJECTED DETAIL LIST (when projected filter active) ══════════ */}
      {filter === 'projected' && projected.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-5">
          <h3 className="text-xs font-semibold text-muted uppercase tracking-widest mb-4">
            Upcoming Catalysts — Detail
          </h3>
          <div className="space-y-3">
            {projected.map((m, i) => {
              const badgeCls =
                m.type === 'positive' ? 'bg-positive/10 text-positive border-positive/20' :
                m.type === 'negative' ? 'bg-negative/10 text-negative border-negative/20' :
                                        'bg-accent/10 text-accent border-accent/20'
              return (
                <button key={i} onClick={() => setSelected(m)}
                  className="w-full text-left bg-canvas border border-dashed border-border rounded-lg p-4 hover:border-accent/40 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <span className="text-sm font-semibold text-[#e6edf3] group-hover:text-accent transition-colors leading-snug">
                      {m.label}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded border shrink-0 ${badgeCls}`}>
                      {m.type.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted font-mono mb-2">{m.date} · est.</div>
                  <p className="text-xs text-[#8b949e] leading-relaxed line-clamp-2">{m.detail}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {selected && <MilestoneModal milestone={selected} ticker={ticker} onClose={() => setSelected(null)} />}
    </div>
  )
}
