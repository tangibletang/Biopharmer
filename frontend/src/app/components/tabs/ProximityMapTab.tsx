'use client'

import { useMemo, useCallback, useState, useEffect } from 'react'
import type { Ticker, PeersResponse, PeerResult } from '../../types'
import { displayTicker } from '../../types'
import { ALL_TICKERS, TICKER_COLORS, CLINICAL_DATA } from '../../mockData'
import RadarModal from '../RadarModal'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const SVG_W = 680
const SVG_H = 420

interface RawLink {
  source: string
  target: string
  similarity: number
}

interface Props { ticker: Ticker }

/** Hub at center; peers on a ring with radius ∝ (1 − similarity). Orphans sit outside the peer ring. */
function computeHubLayout(
  base: Ticker,
  peers: PeerResult[],
  svgW: number,
  svgH: number,
): { nodePositions: Map<string, { x: number; y: number }>; renderedLinks: RawLink[] } {
  const cx = svgW / 2
  const cy = svgH / 2
  const rMin = 92
  const rMax = 142
  const orphanR = 168

  const sortedPeers = [...peers].sort((a, b) => b.similarity - a.similarity)
  const n = sortedPeers.length
  const peerSet = new Set(sortedPeers.map(p => p.ticker))

  const positions = new Map<string, { x: number; y: number }>()
  positions.set(base, { x: cx, y: cy })

  for (let i = 0; i < n; i++) {
    const p = sortedPeers[i]
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(n, 1)
    const r = rMin + (1 - p.similarity) * (rMax - rMin)
    positions.set(p.ticker, {
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
    })
  }

  for (const t of ALL_TICKERS) {
    if (t === base || peerSet.has(t)) continue
    const angle = Math.PI / 2
    positions.set(t, {
      x: cx + Math.cos(angle) * orphanR,
      y: cy + Math.sin(angle) * orphanR,
    })
  }

  const links: RawLink[] = sortedPeers.map(p => ({
    source: base,
    target: p.ticker,
    similarity: p.similarity,
  }))

  return { nodePositions: positions, renderedLinks: links }
}

export default function ProximityMapTab({ ticker }: Props) {
  const [peersData, setPeersData] = useState<PeersResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeer, setSelectedPeer] = useState<PeerResult | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setPeersData(null)

    fetch(`${API}/api/peers/${ticker}`)
      .then(r => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
        return r.json() as Promise<PeersResponse>
      })
      .then(setPeersData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [ticker])

  const { nodePositions, renderedLinks } = useMemo(
    () =>
      peersData
        ? computeHubLayout(ticker, peersData.peers, SVG_W, SVG_H)
        : { nodePositions: new Map<string, { x: number; y: number }>(), renderedLinks: [] as RawLink[] },
    [ticker, peersData],
  )

  const handleNodeClick = useCallback(
    (id: string) => {
      if (id === ticker) return
      const peer = peersData?.peers.find(p => p.ticker === id) ?? null
      setSelectedPeer(peer)
    },
    [ticker, peersData],
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted text-sm">
        <span className="animate-pulse">Querying pgvector similarity index…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-negative/10 border border-negative/30 rounded-lg p-6 text-sm text-negative">
        <p className="font-semibold mb-1">API error</p>
        <p className="text-xs text-muted">{error}</p>
        <p className="text-xs text-muted mt-2">Make sure the FastAPI backend is running on port 8000.</p>
      </div>
    )
  }

  if (!peersData) return null

  const cx = SVG_W / 2
  const cy = SVG_H / 2
  const guideRadii = [72, 112, 152]

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-[#e6edf3]">Scientific Proximity Network</h2>
          <span className="text-xs text-muted">Cosine similarity on mechanism embeddings</span>
        </div>
        <p className="text-xs text-muted mb-4">
          Hub layout: selected ticker at center, peers on a ring (closer = more similar). Edge thickness = similarity
          score. Click a peer node to compare clinical metrics.
        </p>

        <svg
          width="100%"
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="rounded"
          role="img"
          aria-label={`Scientific proximity network centered on ${displayTicker(ticker)}`}
          style={{ background: '#0d1117' }}
        >
          <title>Scientific proximity network for {displayTicker(ticker)}</title>
          <desc>
            Hub layout: {displayTicker(ticker)} at center, peers on a ring by similarity; edges show embedding cosine similarity.
          </desc>

          {/* Light structure only — same palette as rest of app */}
          <g aria-hidden stroke="#30363d" fill="none" opacity={0.45}>
            {guideRadii.map((r, i) => (
              <circle key={r} cx={cx} cy={cy} r={r} strokeWidth={1} strokeDasharray={i === 1 ? '4 8' : '2 5'} />
            ))}
          </g>

          {/* Links — flat accent blue like the original force graph */}
          {renderedLinks.map(link => {
            const src = nodePositions.get(link.source)
            const tgt = nodePositions.get(link.target)
            if (!src || !tgt) return null
            return (
              <line
                key={`${link.source}-${link.target}`}
                x1={src.x}
                y1={src.y}
                x2={tgt.x}
                y2={tgt.y}
                stroke="#58a6ff"
                strokeWidth={link.similarity * 5}
                strokeOpacity={0.3 + link.similarity * 0.4}
              />
            )
          })}

          {/* Similarity % (plain text, matches original) */}
          {renderedLinks.map(link => {
            const src = nodePositions.get(link.source)
            const tgt = nodePositions.get(link.target)
            if (!src || !tgt) return null
            const mx = (src.x + tgt.x) / 2
            const my = (src.y + tgt.y) / 2
            return (
              <text
                key={`label-${link.source}-${link.target}`}
                x={mx}
                y={my}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#8b949e"
                fontSize={10}
              >
                {(link.similarity * 100).toFixed(1)}%
              </text>
            )
          })}

          {/* Nodes */}
          {ALL_TICKERS.map(t => {
            const pos = nodePositions.get(t)
            if (!pos) return null
            const isBase = t === ticker
            const color = TICKER_COLORS[t]
            const r = isBase ? 44 : 34
            const isPeer = peersData.peers.some(p => p.ticker === t)
            return (
              <g
                key={t}
                transform={`translate(${pos.x},${pos.y})`}
                style={{ cursor: isBase ? 'default' : isPeer ? 'pointer' : 'default' }}
                onClick={() => handleNodeClick(t)}
              >
                {isBase && (
                  <circle r={r + 8} fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.25} />
                )}
                <circle
                  r={r}
                  fill={isBase ? color : '#161b22'}
                  stroke={color}
                  strokeWidth={isBase ? 0 : 2}
                  opacity={isPeer || isBase ? 1 : 0.4}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={isBase ? '#0d1117' : color}
                  fontSize={isBase ? 13 : 11}
                  fontWeight="bold"
                  dy={!isBase && isPeer ? -5 : !isBase && !isPeer ? -4 : 0}
                >
                  {displayTicker(t)}
                </text>
                {isPeer && !isBase && (
                  <text textAnchor="middle" dominantBaseline="middle" dy={9} fill="#8b949e" fontSize={9}>
                    click to compare
                  </text>
                )}
                {!isPeer && !isBase && (
                  <text textAnchor="middle" dominantBaseline="middle" dy={10} fill="#6e7681" fontSize={8}>
                    not in top-3 peers
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {peersData.peers.map(peer => (
          <div
            key={peer.ticker}
            className="bg-surface border border-border rounded-lg p-4 cursor-pointer hover:border-accent/50 transition-colors"
            onClick={() => setSelectedPeer(peer)}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TICKER_COLORS[peer.ticker as Ticker] }} />
              <span className="text-sm font-semibold" style={{ color: TICKER_COLORS[peer.ticker as Ticker] }}>
                ${displayTicker(peer.ticker)}
              </span>
              <span className="ml-auto text-[10px] text-muted border border-border rounded px-1.5 py-0.5">
                {(peer.similarity * 100).toFixed(1)}% similar
              </span>
            </div>
            <div className="text-[10px] text-muted mb-3">{peer.company_name}</div>
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted">Emax</span>
                <span className="text-positive">{peer.clinical.emax_pct}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">t½</span>
                <span className="text-accent">{peer.clinical.half_life_days}d</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Grade 3+ AE</span>
                <span className="text-negative">{peer.clinical.grade_3_ae_pct}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedPeer && (
        <RadarModal
          baseTicker={displayTicker(ticker)}
          baseClinical={CLINICAL_DATA[ticker]}
          peerTicker={displayTicker(selectedPeer.ticker)}
          peerClinical={selectedPeer.clinical}
          similarity={selectedPeer.similarity}
          onClose={() => setSelectedPeer(null)}
        />
      )}
    </div>
  )
}
