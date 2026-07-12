'use client'

import { useEffect, useState, useCallback } from 'react'
import { displayTicker } from '../../types'
import { TICKER_COLORS, COMPANY_NAMES } from '../../mockData'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TradingSignal = 'BUY' | 'SELL' | 'HOLD'

interface SignalResult {
  ticker: string
  signal: TradingSignal
  rsi: number
  ma20: number
  current_price: number
  avg_volume_20d: number
  today_volume: number
  catalyst_within_7d: boolean
  rationale: string
  timestamp: string
}

interface PortfolioPosition {
  symbol: string
  qty: number
  market_value: number
  avg_entry_price: number
  unrealized_pl: number
  unrealized_plpc: number
  current_price: number
}

interface Portfolio {
  portfolio_value: number
  cash: number
  positions: PortfolioPosition[]
  recent_trades: TradeRecord[]
  account_mode: 'paper' | 'live'
}

interface TradeRecord {
  id?: string
  symbol: string
  side: string
  qty?: number
  notional?: number
  filled_avg_price?: number
  filled_at?: string
  status: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SIGNAL_STYLES: Record<TradingSignal, string> = {
  BUY:  'bg-positive/15 text-positive border border-positive/40',
  SELL: 'bg-negative/15 text-negative border border-negative/40',
  HOLD: 'bg-surface text-secondary border border-border',
}

function fmt$(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
}

function fmtPct(n: number) {
  const pct = (n * 100).toFixed(2)
  return `${n >= 0 ? '+' : ''}${pct}%`
}

function fmtVol(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SignalCard({
  result,
  onExecute,
  executing,
}: {
  result: SignalResult
  onExecute: (ticker: string) => void
  executing: string | null
}) {
  const color = TICKER_COLORS[result.ticker as keyof typeof TICKER_COLORS] ?? '#888'
  const volSurge = result.today_volume > result.avg_volume_20d * 1.5
  const isExecuting = executing === result.ticker

  return (
    <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-sm font-bold font-mono" style={{ color }}>
              ${displayTicker(result.ticker)}
            </span>
            {result.catalyst_within_7d && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-medium">
                CATALYST
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted mt-0.5 pl-3.5">
            {COMPANY_NAMES[result.ticker as keyof typeof COMPANY_NAMES] ?? result.ticker}
          </div>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${SIGNAL_STYLES[result.signal]}`}>
          {result.signal}
        </span>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono">
        <div className="flex justify-between">
          <span className="text-muted">RSI(14)</span>
          <span className={result.rsi < 40 ? 'text-positive' : result.rsi > 60 ? 'text-negative' : 'text-primary'}>
            {result.rsi.toFixed(1)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Price</span>
          <span className="text-primary">{fmt$(result.current_price)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">20d MA</span>
          <span className="text-primary">{fmt$(result.ma20)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Volume</span>
          <span className={volSurge ? 'text-positive' : 'text-primary'}>
            {fmtVol(result.today_volume)}{volSurge ? ' ↑' : ''}
          </span>
        </div>
      </div>

      {/* Rationale */}
      <p className="text-[11px] text-secondary leading-relaxed border-t border-border pt-3">
        {result.rationale || 'Generating rationale…'}
      </p>

      {/* Execute button */}
      {result.signal !== 'HOLD' && (
        <button
          onClick={() => {
            if (confirm(`Place a ${result.signal} order for $${displayTicker(result.ticker)}?\n\nThis will execute a real ${result.signal === 'BUY' ? '$6.50 notional buy' : 'full position sell'} via Alpaca.`)) {
              onExecute(result.ticker)
            }
          }}
          disabled={isExecuting}
          className={[
            'w-full text-xs font-semibold py-2 rounded-lg transition-all',
            result.signal === 'BUY'
              ? 'bg-positive/20 text-positive hover:bg-positive/30 border border-positive/40'
              : 'bg-negative/20 text-negative hover:bg-negative/30 border border-negative/40',
            isExecuting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          ].join(' ')}
        >
          {isExecuting ? 'Placing order…' : `Execute ${result.signal}`}
        </button>
      )}
    </div>
  )
}

function PortfolioSection({ portfolio }: { portfolio: Portfolio | null }) {
  if (!portfolio) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
        Loading portfolio…
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-4">
      {/* Summary row */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted mb-0.5">Portfolio Value</div>
          <div className="text-2xl font-mono font-bold text-primary">{fmt$(portfolio.portfolio_value)}</div>
          <div className="text-xs text-secondary mt-0.5">Cash available: {fmt$(portfolio.cash)}</div>
        </div>
        <span className={[
          'text-xs font-bold px-2.5 py-1 rounded-md border',
          portfolio.account_mode === 'live'
            ? 'bg-positive/15 text-positive border-positive/40'
            : 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        ].join(' ')}>
          {portfolio.account_mode.toUpperCase()}
        </span>
      </div>

      {/* Positions table */}
      {portfolio.positions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-muted border-b border-border">
                <th className="text-left pb-1.5">Symbol</th>
                <th className="text-right pb-1.5">Qty</th>
                <th className="text-right pb-1.5">Entry</th>
                <th className="text-right pb-1.5">Current</th>
                <th className="text-right pb-1.5">P&L $</th>
                <th className="text-right pb-1.5">P&L %</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.positions.map(pos => (
                <tr key={pos.symbol} className="border-b border-border/40">
                  <td className="py-1.5 text-primary font-bold">{pos.symbol}</td>
                  <td className="py-1.5 text-right text-secondary">{pos.qty.toFixed(4)}</td>
                  <td className="py-1.5 text-right text-secondary">{fmt$(pos.avg_entry_price)}</td>
                  <td className="py-1.5 text-right text-primary">{fmt$(pos.current_price)}</td>
                  <td className={`py-1.5 text-right ${pos.unrealized_pl >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {fmt$(pos.unrealized_pl)}
                  </td>
                  <td className={`py-1.5 text-right ${pos.unrealized_plpc >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {fmtPct(pos.unrealized_plpc)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-xs text-muted text-center py-2">No open positions</div>
      )}
    </div>
  )
}

function TradeHistory({ trades }: { trades: TradeRecord[] }) {
  if (!trades || trades.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4 text-center text-xs text-muted">
        No trade history yet
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-xs font-semibold text-secondary mb-3">Trade History</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-muted border-b border-border">
              <th className="text-left pb-1.5">Time</th>
              <th className="text-left pb-1.5">Symbol</th>
              <th className="text-left pb-1.5">Side</th>
              <th className="text-right pb-1.5">Fill $</th>
              <th className="text-right pb-1.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {trades.slice(0, 20).map((t, i) => (
              <tr
                key={t.id ?? i}
                className={`border-b border-border/40 border-l-2 ${t.side === 'buy' ? 'border-l-positive/50' : 'border-l-negative/50'}`}
              >
                <td className="py-1.5 text-muted">
                  {t.filled_at ? new Date(t.filled_at).toLocaleTimeString() : '—'}
                </td>
                <td className="py-1.5 text-primary font-bold">{t.symbol}</td>
                <td className={`py-1.5 uppercase font-bold ${t.side === 'buy' ? 'text-positive' : 'text-negative'}`}>
                  {t.side}
                </td>
                <td className="py-1.5 text-right text-secondary">
                  {t.filled_avg_price ? fmt$(t.filled_avg_price) : '—'}
                </td>
                <td className="py-1.5 text-right text-muted">{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TradingTab() {
  const [signals, setSignals] = useState<SignalResult[]>([])
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [loadingSignals, setLoadingSignals] = useState(true)
  const [executing, setExecuting] = useState<string | null>(null)
  const [execMessage, setExecMessage] = useState<string | null>(null)
  const [marketOpen, setMarketOpen] = useState<boolean | null>(null)

  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/trading/signals`)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setSignals(data.signals)
    } catch {
      // silently keep stale data
    } finally {
      setLoadingSignals(false)
    }
  }, [])

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/trading/portfolio`)
      if (!res.ok) throw new Error(await res.text())
      const data: Portfolio = await res.json()
      setPortfolio(data)
    } catch {
      // silently keep stale data
    }
  }, [])

  useEffect(() => {
    fetchSignals()
    fetchPortfolio()

    // Check market hours (9:30–16:00 ET)
    const now = new Date()
    const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const h = et.getHours(), m = et.getMinutes()
    const open = (h > 9 || (h === 9 && m >= 30)) && h < 16 && et.getDay() >= 1 && et.getDay() <= 5
    setMarketOpen(open)

    const sigInterval = setInterval(fetchSignals, 60_000)
    const portInterval = setInterval(fetchPortfolio, 30_000)
    return () => { clearInterval(sigInterval); clearInterval(portInterval) }
  }, [fetchSignals, fetchPortfolio])

  const handleExecute = async (ticker: string) => {
    setExecuting(ticker)
    setExecMessage(null)
    try {
      const res = await fetch(`${API}/api/trading/execute/${ticker}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        setExecMessage(`Error: ${data.detail ?? 'Unknown error'}`)
      } else {
        setExecMessage(`${data.status === 'executed' ? '✓' : '—'} ${data.message}`)
        await fetchPortfolio()
      }
    } catch (e) {
      setExecMessage('Network error — check backend is running')
    } finally {
      setExecuting(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-4 overflow-y-auto">

      {/* Market status banner */}
      {marketOpen === false && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-400">
          Market closed — orders placed now will not fill until 9:30 AM ET on the next trading day.
        </div>
      )}

      {/* Execute feedback */}
      {execMessage && (
        <div className="rounded-lg border border-border bg-surface px-4 py-2.5 text-xs text-secondary">
          {execMessage}
        </div>
      )}

      {/* Signals section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-secondary uppercase tracking-wider">AI Signals</span>
          <span className="text-[10px] text-muted">Refreshes every 60s</span>
        </div>

        {loadingSignals ? (
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="rounded-xl border border-border bg-surface p-4 h-40 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {signals.map(s => (
              <SignalCard
                key={s.ticker}
                result={s}
                onExecute={handleExecute}
                executing={executing}
              />
            ))}
          </div>
        )}
      </div>

      {/* Portfolio section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-secondary uppercase tracking-wider">Portfolio</span>
          <span className="text-[10px] text-muted">Refreshes every 30s</span>
        </div>
        <PortfolioSection portfolio={portfolio} />
      </div>

      {/* Trade history */}
      <TradeHistory trades={portfolio?.recent_trades ?? []} />
    </div>
  )
}
