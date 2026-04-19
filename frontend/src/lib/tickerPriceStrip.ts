import type { StockPoint } from '@/app/types'

export interface TickerStripPriceSummary {
  price: number
  changePct: number
  change: number
}

/**
 * Price + % for the Research Barn / sidebar strip: **last two daily closes** from `6mo`
 * (prior session vs last completed session). Matches typical “day over day” on the strip.
 * Intraday `1d` is not used here — the Timeline 1D chart header uses a separate anchor fix.
 */
export async function fetchTickerStripPriceSummary(
  apiBase: string,
  ticker: string,
): Promise<TickerStripPriceSummary | null> {
  const base = apiBase.replace(/\/$/, '')

  try {
    const res = await fetch(`${base}/api/prices/${encodeURIComponent(ticker)}?period=6mo`)
    if (!res.ok) return null
    const data = await res.json()
    const raw: StockPoint[] = data.prices ?? []
    const dailyOnly = raw.filter(p => !String(p.date).includes(' '))
    const series = dailyOnly.length >= 2 ? dailyOnly : raw
    if (series.length < 2) return null
    const prev = series[series.length - 2].price
    const last = series[series.length - 1].price
    if (prev === 0) return null
    return {
      price: last,
      change: last - prev,
      changePct: ((last - prev) / prev) * 100,
    }
  } catch {
    return null
  }
}
