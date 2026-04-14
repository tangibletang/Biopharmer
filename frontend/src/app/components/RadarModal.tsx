'use client'

import { useState } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend, Tooltip,
} from 'recharts'
import type { ClinicalSnapshot } from '../types'

interface Props {
  baseTicker: string
  baseClinical: ClinicalSnapshot
  peerTicker: string
  peerClinical: ClinicalSnapshot
  similarity?: number
  onClose: () => void
}

// Normalize metrics to a 0–100 score for the radar axes
function normalizeEfficacy(v: number)   { return Math.min((v / 30) * 100, 100) }
function normalizeDurability(v: number) { return Math.min((Math.log(v + 1) / Math.log(366)) * 100, 100) }
function normalizeSafety(v: number)     { return Math.max(100 - (v / 15) * 100, 0) }

function buildRadarData(base: ClinicalSnapshot, peer: ClinicalSnapshot, baseTicker: string, peerTicker: string) {
  return [
    {
      metric: 'Efficacy',
      [baseTicker]: +normalizeEfficacy(base.emax_pct).toFixed(1),
      [peerTicker]: +normalizeEfficacy(peer.emax_pct).toFixed(1),
    },
    {
      metric: 'Durability',
      [baseTicker]: +normalizeDurability(base.half_life_days).toFixed(1),
      [peerTicker]: +normalizeDurability(peer.half_life_days).toFixed(1),
    },
    {
      metric: 'Safety',
      [baseTicker]: +normalizeSafety(base.grade_3_ae_pct).toFixed(1),
      [peerTicker]: +normalizeSafety(peer.grade_3_ae_pct).toFixed(1),
    },
  ]
}

export default function RadarModal({
  baseTicker, baseClinical,
  peerTicker, peerClinical,
  similarity, onClose,
}: Props) {
  const [showAudit, setShowAudit] = useState(false)
  const data = buildRadarData(baseClinical, peerClinical, baseTicker, peerTicker)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl mx-4 bg-surface border border-border rounded-lg p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-[#e6edf3]">
            ${baseTicker} vs ${peerTicker}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-[#e6edf3] text-lg leading-none">×</button>
        </div>
        {similarity !== undefined && (
          <p className="text-xs text-muted mb-4">
            Mechanism similarity: <span className="text-accent">{(similarity * 100).toFixed(1)}%</span>
          </p>
        )}

        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: 'Emax (% dystrophin)', base: `${baseClinical.emax_pct}%`, peer: `${peerClinical.emax_pct}%` },
            { label: 'Half-life (days)',     base: `${baseClinical.half_life_days}d`, peer: `${peerClinical.half_life_days}d` },
            { label: 'Grade 3+ AE rate',    base: `${baseClinical.grade_3_ae_pct}%`, peer: `${peerClinical.grade_3_ae_pct}%` },
          ].map(m => (
            <div key={m.label} className="bg-canvas rounded p-3 border border-border">
              <div className="text-[10px] text-muted mb-1">{m.label}</div>
              <div className="flex justify-between text-xs">
                <span className="text-accent">${baseTicker}: <strong>{m.base}</strong></span>
                <span className="text-[#e6edf3]">${peerTicker}: <strong>{m.peer}</strong></span>
              </div>
            </div>
          ))}
        </div>

        {/* Radar chart — D3 math for scale, Recharts for render */}
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
              <PolarGrid stroke="#30363d" />
              <PolarAngleAxis
                dataKey="metric"
                tick={{ fill: '#8b949e', fontSize: 11 }}
              />
              <Radar
                name={`$${baseTicker}`}
                dataKey={baseTicker}
                stroke="#58a6ff"
                fill="#58a6ff"
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Radar
                name={`$${peerTicker}`}
                dataKey={peerTicker}
                stroke="#ffa657"
                fill="#ffa657"
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px', color: '#8b949e' }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#161b22', border: '1px solid #30363d', fontSize: '11px' }}
                formatter={(v: number, name: string) => [`${v}/100`, name]}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Audit button + text */}
        <div className="mt-4 pt-4 border-t border-border">
          <button
            onClick={() => setShowAudit(v => !v)}
            className="text-xs text-accent hover:text-[#79b8ff] transition-colors"
          >
            {showAudit ? '▲ Hide' : '▼ Show'} {`$${peerTicker}`} audit trail
          </button>
          {showAudit && (
            <p className="mt-3 text-xs text-[#c9d1d9] leading-relaxed border-l-2 border-accent pl-3">
              {peerClinical.audit_text}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
