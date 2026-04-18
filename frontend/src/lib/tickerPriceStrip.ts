import type { StockPoint } from '@/app/types'

export interface TickerStripPriceSummary {
  price: number
  changePct: number
  change: number
}

/**
 * Price + one-day-style % for the war-room / sidebar strip.
 *
 * 1) Same window as Timeline "1D": `period=1d` intraday (5m bars) — % = (last − first) / first,
 *    matching the chart span the user sees when they pick 1D.
 * 2) If that series is too short (pre-market, API oddity), use the last two **daily** closes from `6mo`
 *    (close-to-close over the last completed session vs prior session).
 */
export async function fetchTickerStripPriceSummary(
  apiBase: string,
  ticker: string,
): Promise<TickerStripPriceSummary | null> {
  const base = apiBase.replace(/\/$/, '')

  const load = async (period: string): Promise<StockPoint[] | null> => {
    try {
      const res = await fetch(`${base}/api/prices/${encodeURIComponent(ticker)}?period=${period}`)
      if (!res.ok) return null
      const data = await res.json()
      return data.prices ?? []
    } catch {
      return null
    }
  }

  const oneDay = await load('1d')
  if (oneDay && oneDay.length >= 2) {
    const first = oneDay[0].price
    const last  = oneDay[oneDay.length - 1].price
    if (first !== 0) {
      return {
        price: last,
        change: last - first,
        changePct: ((last - first) / first) * 100,
      }
    }
  }

  const long = await load('6mo')
  if (!long?.length) return null
  const dailyOnly = long.filter(p => !String(p.date).includes(' '))
  const series = dailyOnly.length >= 2 ? dailyOnly : long
  if (series.length < 2) return null
  const prev = series[series.length - 2].price
  const last = series[series.length - 1].price
  if (prev === 0) return null
  return {
    price: last,
    change: last - prev,
    changePct: ((last - prev) / prev) * 100,
  }
}
