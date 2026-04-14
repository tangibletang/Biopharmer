'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import type { Ticker, PeersResponse, PeerResult } from '../../types'
import { ALL_TICKERS, TICKER_COLORS, COMPANY_NAMES, CLINICAL_DATA } from '../../mockData'
import RadarModal from '../RadarModal'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const SVG_W = 620
const SVG_H = 400

interface SimNode extends d3.SimulationNodeDatum {
  id: Ticker
  isBase: boolean
}

interface RawLink {
  source: string
  target: string
  similarity: number
}

interface Props { ticker: Ticker }

export default function ProximityMapTab({ ticker }: Props) {
  const [peersData, setPeersData]     = useState<PeersResponse | null>(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(new Map())
  const [renderedLinks, setRenderedLinks] = useState<RawLink[]>([])
  const [selectedPeer, setSelectedPeer]   = useState<PeerResult | null>(null)
  const simRef = useRef<d3.Simulation<SimNode, undefined> | null>(null)

  // ── Fetch peers ────────────────────────────────────────────────────────────
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

  // ── Run D3 force simulation ────────────────────────────────────────────────
  useEffect(() => {
    if (!peersData) return
    if (simRef.current) simRef.current.stop()

    const nodes: SimNode[] = ALL_TICKERS.map(t => ({
      id: t,
      isBase: t === ticker,
      // Scatter initial positions around center so force has work to do
      x: SVG_W / 2 + (Math.random() - 0.5) * 160,
      y: SVG_H / 2 + (Math.random() - 0.5) * 160,
    }))

    const links: RawLink[] = peersData.peers.map(p => ({
      source: ticker,
      target: p.ticker,
      similarity: p.similarity,
    }))

    // D3 handles ONLY the physics math — React renders the SVG
    const sim = d3.forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3.forceLink<SimNode, RawLink>(links as d3.SimulationLinkDatum<SimNode>[])
          .id(d => d.id)
          .strength(d => (d as unknown as RawLink).similarity * 0.6)
          .distance(d => Math.max(100, (1 - (d as unknown as RawLink).similarity) * 280)),
      )
      .force('charge', d3.forceManyBody<SimNode>().strength(-200))
      .force('center', d3.forceCenter<SimNode>(SVG_W / 2, SVG_H / 2))
      .force('collision', d3.forceCollide<SimNode>(58))
      .stop()

    // Run synchronously to convergence — fast for 4 nodes
    for (let i = 0; i < 300; i++) sim.tick()

    setNodePositions(new Map(nodes.map(n => [n.id, { x: n.x ?? SVG_W / 2, y: n.y ?? SVG_H / 2 }])))
    setRenderedLinks(links)
    simRef.current = sim
  }, [ticker, peersData])

  const handleNodeClick = useCallback((id: string) => {
    if (id === ticker) return
    const peer = peersData?.peers.find(p => p.ticker === id) ?? null
    setSelectedPeer(peer)
  }, [ticker, peersData])

  // ── Render ─────────────────────────────────────────────────────────────────

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

  return (
    <div className="space-y-6">
      {/* Force graph */}
      <div className="bg-surface border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-[#e6edf3]">Scientific Proximity Network</h2>
          <span className="text-xs text-muted">Cosine similarity on mechanism embeddings</span>
        </div>
        <p className="text-xs text-muted mb-4">
          Edge thickness = similarity score. Click a peer node to compare clinical metrics.
        </p>

        {/* D3 physics drives layout; React renders the SVG */}
        <svg
          width="100%"
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="rounded"
          style={{ background: '#0d1117' }}
        >
          {/* Links */}
          {renderedLinks.map(link => {
            const src = nodePositions.get(link.source)
            const tgt = nodePositions.get(link.target)
            if (!src || !tgt) return null
            return (
              <line
                key={`${link.source}-${link.target}`}
                x1={src.x} y1={src.y}
                x2={tgt.x} y2={tgt.y}
                stroke="#58a6ff"
                strokeWidth={link.similarity * 5}
                strokeOpacity={0.3 + link.similarity * 0.4}
              />
            )
          })}

          {/* Similarity labels on links */}
          {renderedLinks.map(link => {
            const src = nodePositions.get(link.source)
            const tgt = nodePositions.get(link.target)
            if (!src || !tgt) return null
            const mx = (src.x + tgt.x) / 2
            const my = (src.y + tgt.y) / 2
            return (
              <text
                key={`label-${link.source}-${link.target}`}
                x={mx} y={my}
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
            const color  = TICKER_COLORS[t]
            const r      = isBase ? 44 : 34
            const isPeer = peersData.peers.some(p => p.ticker === t)
            return (
              <g
                key={t}
                transform={`translate(${pos.x},${pos.y})`}
                style={{ cursor: isBase ? 'default' : 'pointer' }}
                onClick={() => handleNodeClick(t)}
              >
                {/* Glow ring for base */}
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
                  dy={isPeer ? -5 : 0}
                >
                  {t}
                </text>
                {isPeer && (
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    dy={9}
                    fill="#8b949e"
                    fontSize={9}
                  >
                    click to compare
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Peer cards */}
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
                ${peer.ticker}
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

      {/* Radar modal */}
      {selectedPeer && (
        <RadarModal
          baseTicker={ticker}
          baseClinical={CLINICAL_DATA[ticker]}
          peerTicker={selectedPeer.ticker}
          peerClinical={selectedPeer.clinical}
          similarity={selectedPeer.similarity}
          onClose={() => setSelectedPeer(null)}
        />
      )}
    </div>
  )
}
