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
  prices:     [] as { date: string; price: number }[],
  color:      '#58a6ff',
}

const PERIODS = [
  { label: '1D',  value: '1d'  },
  { label: '5D',  value: '5d'  },
  { label: '1M',  value: '1mo' },
  { label: '6M',  value: '6mo' },
  { label: 'YTD', value: 'ytd' },
  { label: '1Y',  value: '1y'  },
  { label: '5Y',  value: '5y'  },
] as const
type PeriodValue = typeof PERIODS[number]['value']

type Filter = 'all' | 'historical' | 'projected'
type HoverSrc = 'chart' | 'timeline' | null

const TYPE_COLOR = {
  positive: '#3fb950',
  negative: '#f85149',
  neutral:  '#58a6ff',
} as const

// ── Timeline geometry ─────────────────────────────────────────────────────────
const TW     = 2900
const PAD    = 80
const SH     = 380
const SY     = 186
const DR     = 7
const CH     = 48
const CW     = 148
const CARD_H = 108

const T_START = new Date('2024-01-01')
const T_END   = new Date('2028-01-01')
const T_SPAN  = (T_END.getTime() - T_START.getTime()) / 86400000

function localDateISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function dx(s: string) {
  return PAD + ((new Date(s+'T12:00:00').getTime() - T_START.getTime()) / 86400000 / T_SPAN) * (TW - PAD * 2)
}
function priceProviderLabel(p?: string) {
  return p === 'alpha_vantage' ? 'Alpha Vantage' : 'Yahoo Finance'
}

function milestoneMapForSeries(milestones: Milestone[], seriesDates: string[]): Map<string, Milestone> {
  const out = new Map<string, Milestone>()
  if (!seriesDates.length) return out
  for (const ms of milestones) {
    const t = new Date(`${ms.date}T12:00:00`).getTime()
    let best: string | null = null, bestD = Infinity
    for (const d of seriesDates) {
      const dt = Math.abs(new Date(`${d}T12:00:00`).getTime() - t)
      if (dt < bestD) { bestD = dt; best = d }
    }
    if (best != null && bestD <= 6 * 86400000) out.set(best, ms)
  }
  return out
}

// ── Chart dot with hover glow ─────────────────────────────────────────────────
// NOTE: No mouse handlers here — hover is detected at the LineChart level via
// onMouseMove to avoid a re-mount loop (dot re-mounts on state change → fires
// onMouseLeave → clears hover before SVG timeline can react).
function MilestoneDot(props: {
  cx?: number; cy?: number
  payload?: { date: string }
  mmap: Map<string, Milestone>
  hovered: string | null
  onOpen: (m: Milestone) => void
}) {
  const { cx = 0, cy = 0, payload, mmap, hovered, onOpen } = props
  if (!payload) return null
  const m = mmap.get(payload.date)
  if (!m) return <circle cx={cx} cy={cy} r={2} fill="#21262d" />
  const col   = TYPE_COLOR[m.type]
  const isHot = hovered === m.label
  return (
    <g style={{ cursor: 'pointer' }} onClick={() => onOpen(m)}>
      {isHot && <circle cx={cx} cy={cy} r={16} fill={col} fillOpacity={0.12} />}
      {isHot && <circle cx={cx} cy={cy} r={11} fill={col} fillOpacity={0.18} />}
      <circle cx={cx} cy={cy} r={isHot ? 8 : 6} fill={col} stroke="#0d1117" strokeWidth={2} />
    </g>
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
      {m && <div className="mt-1.5 pt-1.5 border-t border-border text-[11px] max-w-[180px] leading-snug text-muted">{m.label}</div>}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TimelineTab({ ticker }: { ticker: string }) {
  const [period, setPeriod]     = useState<PeriodValue>('1y')
  const [filter, setFilter]     = useState<Filter>('all')
  const [selected, setSelected] = useState<Milestone | null>(null)
  const [hovered, setHovered]   = useState<string | null>(null)
  const [yahooPrices, setYahooPrices]     = useState<PricesResponse | null>(null)
  const [pricesLoading, setPricesLoading] = useState(false)
  const [pricesError, setPricesError]     = useState<string | null>(null)
  const timelineScrollRef = useRef<HTMLDivElement>(null)
  const [todayStr, setTodayStr] = useState<string | null>(null)

  const setHover = (label: string | null, src: HoverSrc) => setHovered(label)

  useEffect(() => { setTodayStr(localDateISO(new Date())) }, [])

  useEffect(() => {
    let cancelled = false
    setPricesLoading(true); setPricesError(null); setYahooPrices(null)
    fetch(`${API}/api/prices/${ticker}?period=${period}`)
      .then(async r => { if (!r.ok) throw new Error(await r.text()); return r.json() as Promise<PricesResponse> })
      .then(d  => { if (!cancelled && d.prices?.length) setYahooPrices(d) })
      .catch(e => { if (!cancelled) setPricesError(String(e)) })
      .finally(() => { if (!cancelled) setPricesLoading(false) })
    return () => { cancelled = true }
  }, [ticker, period])

  const todayX = todayStr ? dx(todayStr) : null
  useLayoutEffect(() => {
    if (todayX == null) return
    const el = timelineScrollRef.current
    if (!el) return
    const center = () => {
      el.scrollLeft = Math.max(0, Math.min(todayX - el.clientWidth / 2, el.scrollWidth - el.clientWidth))
    }
    center(); requestAnimationFrame(center)
  }, [ticker, todayX])

  const todayLegend = useMemo(() => {
    const d = new Date()
    return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()] + ' ' + d.getFullYear()
  }, [])

  const data       = DMD_TICKERS.has(ticker) ? TICKER_DATA[ticker as Ticker] : EMPTY_TICKER_DATA
  const historical = data.milestones.filter((m: Milestone) => m.category === 'historical')
  const projected  = data.milestones.filter((m: Milestone) => m.category === 'projected')
  const chartPrices = yahooPrices?.prices?.length ? yahooPrices.prices : data.prices
  const seriesDates = chartPrices.map(p => p.date)
  // Intraday series (1D/5D) have "YYYY-MM-DD HH:MM" dates — milestone dots don't apply
  const isIntraday  = seriesDates.length > 0 && seriesDates[0].includes(' ')
  const mmap = (yahooPrices?.prices?.length && !isIntraday)
    ? milestoneMapForSeries(historical, seriesDates)
    : isIntraday
      ? new Map<string, Milestone>()
      : new Map(historical.map(m => [m.date, m]))

  // Inverse map for chart reference line when hovering from timeline
  const labelToDate = useMemo(() => {
    const out = new Map<string, string>()
    mmap.forEach((ms, date) => out.set(ms.label, date))
    return out
  }, [mmap])
  const hoveredChartDate = hovered ? labelToDate.get(hovered) : undefined

  const priceMin = chartPrices.length ? Math.min(...chartPrices.map(p => p.price)) : 0
  const priceMax = chartPrices.length ? Math.max(...chartPrices.map(p => p.price)) : 1
  const ppad     = Math.max((priceMax - priceMin) * 0.08, 0.01)
  const latestPrice  = chartPrices.at(-1)?.price ?? null
  const prevPrice    = chartPrices.at(-2)?.price ?? null
  const dayChange    = latestPrice != null && prevPrice != null ? latestPrice - prevPrice : null
  const dayChangePct = dayChange != null && prevPrice ? (dayChange / prevPrice) * 100 : null

  function opa(cat: 'historical' | 'projected') {
    return filter === 'all' || filter === cat ? 1 : 0.18
  }

  return (
    <div className="space-y-3">

      {/* ── Price chart ───────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
          <div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-base font-bold font-mono text-[#e6edf3]">${displayTicker(ticker)}</span>
              {latestPrice != null && (
                <>
                  <span className="text-lg font-semibold font-mono text-[#e6edf3]">${latestPrice.toFixed(2)}</span>
                  {dayChange != null && dayChangePct != null && (
                    <span className={['text-xs font-mono', dayChange >= 0 ? 'text-positive' : 'text-negative'].join(' ')}>
                      {dayChange >= 0 ? '+' : ''}{dayChange.toFixed(2)} ({dayChange >= 0 ? '+' : ''}{dayChangePct.toFixed(2)}%)
                    </span>
                  )}
                </>
              )}
              {pricesLoading && <span className="text-[10px] text-muted animate-pulse">loading…</span>}
            </div>
            <div className="text-[10px] text-muted mt-0.5">
              {yahooPrices ? `${yahooPrices.yahoo_symbol} · ${priceProviderLabel(yahooPrices.provider)} · ${chartPrices.length} days` : pricesError ? 'Showing embedded data' : 'Embedded sample'}
              {yahooPrices?.currency ? ` · ${yahooPrices.currency}` : ''}
            </div>
          </div>
          <div className="flex gap-0.5 p-0.5 bg-canvas border border-border rounded-lg shrink-0">
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value)}
                className={['px-2 py-1 rounded text-[10px] font-semibold transition-all',
                  period === p.value ? 'bg-[#1f2937] text-[#e6edf3]' : 'text-muted hover:text-[#e6edf3]',
                ].join(' ')}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-1 pb-3">
          {chartPrices.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={chartPrices}
                margin={{ top: 4, right: 16, bottom: 0, left: 6 }}
                onMouseMove={(state) => {
                  const date = (state?.activePayload?.[0]?.payload as { date?: string } | undefined)?.date
                  const m = date ? mmap.get(date) : undefined
                  setHover(m?.label ?? null, 'chart')
                }}
                onMouseLeave={() => setHover(null, null)}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false}
                  tick={{ fill: '#8b949e', fontSize: 9 }}
                  tickFormatter={d => {
                    if (d.includes(' ')) {
                      // Intraday: "2024-01-15 09:30"
                      const [datePart, timePart] = d.split(' ')
                      if (period === '1d') return timePart.slice(0, 5)
                      const day = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(datePart + 'T12:00:00').getDay()]
                      return `${day} ${timePart.slice(0, 5)}`
                    }
                    const [yr, mo] = d.split('-')
                    const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+mo-1]
                    return mo === '01' ? `${month} '${yr.slice(2)}` : month
                  }}
                  minTickGap={32}
                />
                <YAxis domain={[priceMin - ppad, priceMax + ppad]}
                  tickLine={false} axisLine={false}
                  tick={{ fill: '#8b949e', fontSize: 9 }}
                  tickFormatter={v => `$${v.toFixed(0)}`}
                  width={44}
                />
                {todayStr && seriesDates.includes(todayStr) && (
                  <ReferenceLine x={todayStr} stroke="#58a6ff" strokeDasharray="4 3" strokeOpacity={0.4} />
                )}
                <ReferenceLine
                  x={hoveredChartDate ?? ''}
                  stroke={hoveredChartDate ? TYPE_COLOR[mmap.get(hoveredChartDate)?.type ?? 'neutral'] : 'transparent'}
                  strokeWidth={1.5}
                  strokeOpacity={hoveredChartDate ? 0.8 : 0}
                  ifOverflow="hidden"
                />
                <Tooltip content={<ChartTip mmap={mmap} />} cursor={{ stroke: '#30363d', strokeWidth: 1 }} />
                <Line type="monotone" dataKey="price" stroke={data.color} strokeWidth={1.5}
                  isAnimationActive={false}
                  dot={(p: { cx?: number; cy?: number; payload?: { date: string } }) => (
                    <MilestoneDot key={p.payload?.date} {...p}
                      mmap={mmap} hovered={hovered}
                      onOpen={setSelected}
                    />
                  )}
                  activeDot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center">
              <span className="text-xs text-muted">{pricesLoading ? 'Loading…' : 'No price data'}</span>
            </div>
          )}
        </div>
        <div className="px-4 pb-2.5 text-[10px] text-muted">
          Hover colored dots to link with the timeline below · click to open analysis
        </div>
      </div>

      {/* ── Catalyst Timeline ─────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1 p-1 bg-canvas border border-border rounded-lg">
            {(['all', 'historical', 'projected'] as Filter[]).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={['px-3 py-1.5 rounded text-xs font-semibold transition-all',
                  filter === f ? (f === 'projected' ? 'bg-accent text-canvas' : 'bg-[#1f2937] text-[#e6edf3]') : 'text-muted hover:text-[#e6edf3]',
                ].join(' ')}>
                {f === 'all' ? 'All Events' : f === 'historical' ? '◷ Historical' : '◈ Projected'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted">
            <span>{historical.length} historical · {projected.length} projected</span>
            <span className="text-accent">↔ scroll · centered on today</span>
          </div>
        </div>

        <div ref={timelineScrollRef} className="overflow-x-auto overflow-y-hidden scroll-smooth" style={{ cursor: 'grab' }}>
          <div style={{ width: TW, height: SH, position: 'relative', flexShrink: 0 }}>

            <svg width={TW} height={SH}
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
              <line x1={PAD/2} y1={SY} x2={TW-PAD/2} y2={SY} stroke="#30363d" strokeWidth={1} />

              {['2024','2025','2026','2027'].map(y => (
                <g key={y}>
                  <line x1={dx(`${y}-01-01`)} y1={SY-10} x2={dx(`${y}-01-01`)} y2={SY+10} stroke="#484f58" strokeWidth={1} />
                  <text x={dx(`${y}-07-01`)} y={SY+28} textAnchor="middle" fill="#484f58"
                    fontSize={11} fontFamily="ui-monospace,monospace" fontWeight="600">{y}</text>
                </g>
              ))}
              <line x1={dx('2028-01-01')} y1={SY-6} x2={dx('2028-01-01')} y2={SY+6} stroke="#484f58" strokeWidth={1} />

              {todayX != null && (
                <g>
                  <line x1={todayX} y1={SY-80} x2={todayX} y2={SY+80}
                    stroke="#58a6ff" strokeWidth={1.5} strokeDasharray="5 3" strokeOpacity={0.55} />
                  <rect x={todayX-20} y={SY-97} width={40} height={18} rx={4} fill="#58a6ff" fillOpacity={0.12} />
                  <text x={todayX} y={SY-84} textAnchor="middle" fill="#58a6ff"
                    fontSize={9} fontFamily="ui-monospace,monospace" fontWeight="700" letterSpacing="1">TODAY</text>
                </g>
              )}

              {historical.map((m, i) => {
                const x = dx(m.date), col = TYPE_COLOR[m.type], isHot = hovered === m.label
                return (
                  <g key={i} style={{ opacity: opa('historical'), transition: 'opacity 0.2s', pointerEvents: 'all', cursor: 'pointer' }}
                    onMouseEnter={() => setHover(m.label, 'timeline')}
                    onMouseLeave={() => setHover(null, null)}
                    onClick={() => setSelected(m)}>
                    <line x1={x} y1={SY-DR-2} x2={x} y2={SY-DR-CH} stroke={col} strokeWidth={1} strokeOpacity={0.35} />
                    {isHot && <circle cx={x} cy={SY} r={DR+9} fill={col} fillOpacity={0.15} />}
                    <circle cx={x} cy={SY} r={isHot ? DR+2 : DR} fill={col} stroke="#161b22" strokeWidth={2} />
                  </g>
                )
              })}

              {projected.map((m, i) => {
                const x = dx(m.date), col = TYPE_COLOR[m.type], isHot = hovered === m.label
                return (
                  <g key={i} style={{ opacity: opa('projected'), transition: 'opacity 0.2s', pointerEvents: 'all', cursor: 'pointer' }}
                    onMouseEnter={() => setHover(m.label, 'timeline')}
                    onMouseLeave={() => setHover(null, null)}
                    onClick={() => setSelected(m)}>
                    <line x1={x} y1={SY+DR+2} x2={x} y2={SY+DR+CH} stroke={col} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.35} />
                    {isHot && <circle cx={x} cy={SY} r={DR+9} fill={col} fillOpacity={0.15} />}
                    <circle cx={x} cy={SY} r={isHot ? DR+2 : DR} fill="#161b22" stroke={col} strokeWidth={isHot ? 2.5 : 2} strokeDasharray="4 2" />
                  </g>
                )
              })}
            </svg>

            {historical.map((m, i) => {
              const x = dx(m.date), col = TYPE_COLOR[m.type], isHot = hovered === m.label
              return (
                <button key={i} onClick={() => setSelected(m)}
                  onMouseEnter={() => setHover(m.label, 'timeline')}
                  onMouseLeave={() => setHover(null, null)}
                  style={{
                    position: 'absolute', left: x - CW/2, top: SY - DR - CH - 4 - CARD_H,
                    width: CW, height: CARD_H, opacity: opa('historical'), transition: 'all 0.15s',
                    borderColor: isHot ? col+'80' : undefined,
                    backgroundColor: isHot ? col+'0f' : undefined,
                    boxShadow: isHot ? `0 0 12px ${col}30` : undefined,
                  }}
                  className="text-left bg-canvas border border-border rounded-lg p-2.5"
                >
                  <div className="text-[9px] font-mono text-muted mb-1">{m.date}</div>
                  <div className="text-[11px] font-semibold text-[#e6edf3] leading-tight"
                    style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {m.label}
                  </div>
                  <div className="mt-2" style={{ width: 20, height: 2, backgroundColor: col, borderRadius: 1 }} />
                </button>
              )
            })}

            {projected.map((m, i) => {
              const x = dx(m.date), col = TYPE_COLOR[m.type], isHot = hovered === m.label
              return (
                <button key={i} onClick={() => setSelected(m)}
                  onMouseEnter={() => setHover(m.label, 'timeline')}
                  onMouseLeave={() => setHover(null, null)}
                  style={{
                    position: 'absolute', left: x - CW/2, top: SY + DR + CH + 6,
                    width: CW, height: CARD_H, opacity: opa('projected'), transition: 'all 0.15s',
                    borderColor: isHot ? col+'80' : undefined,
                    backgroundColor: isHot ? col+'0f' : undefined,
                    boxShadow: isHot ? `0 0 12px ${col}30` : undefined,
                  }}
                  className="text-left bg-canvas border border-dashed border-border rounded-lg p-2.5"
                >
                  <div className="flex items-center gap-1 mb-1">
                    <div className="text-[9px] font-mono text-muted">{m.date}</div>
                    <span className="text-[8px] text-muted border border-border rounded px-1 ml-auto">est.</span>
                  </div>
                  <div className="text-[11px] font-semibold text-[#e6edf3] leading-tight"
                    style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {m.label}
                  </div>
                  <div className="mt-2" style={{ width: 20, height: 2, backgroundColor: col, borderRadius: 1, opacity: 0.55 }} />
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-border text-[10px] text-muted">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-positive inline-block" />Positive</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-negative inline-block" />Negative</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-accent inline-block" />Neutral</span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border-2 border-muted inline-block" style={{ borderStyle: 'dashed' }} />Projected
          </span>
          <span className="flex items-center gap-1.5 ml-auto text-accent">
            <span className="w-0.5 h-3 bg-accent opacity-60 inline-block" />TODAY · {todayLegend}
          </span>
        </div>
      </div>

      {selected && <MilestoneModal milestone={selected} ticker={ticker} onClose={() => setSelected(null)} />}
    </div>
  )
}
