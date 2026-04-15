'use client'

import type { SynthesisOutput } from '../types'

interface Props {
  synthesis: SynthesisOutput
  ticker: string
}

export default function BullBearMatrix({ synthesis, ticker }: Props) {
  return (
    <div className="space-y-4">
      {/* Research summary */}
      <div className="bg-surface border border-border rounded-lg p-5">
        <p className="text-sm text-[#c9d1d9] leading-relaxed">{synthesis.research_summary}</p>
      </div>

      {/* Key findings / Investor considerations */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-positive/5 border border-positive/20 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-positive text-xs font-semibold uppercase tracking-widest">Key findings</span>
          </div>
          <ul className="space-y-1">
            {synthesis.key_findings.map((f, i) => (
              <li key={i} className="text-sm text-[#c9d1d9] leading-relaxed">· {f}</li>
            ))}
          </ul>
        </div>
        <div className="bg-accent/5 border border-accent/20 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-accent text-xs font-semibold uppercase tracking-widest">As an investor</span>
            <span className="text-[10px] text-muted border border-border rounded px-1.5 py-0.5">${ticker}</span>
          </div>
          <ul className="space-y-1">
            {synthesis.investor_considerations.map((c, i) => (
              <li key={i} className="text-sm text-[#c9d1d9] leading-relaxed">→ {c}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Watch list */}
      <div className="bg-accent/5 border border-accent/30 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-accent text-xs font-semibold uppercase tracking-widest">Watch</span>
        </div>
        <p className="text-sm text-[#e6edf3] font-medium leading-relaxed">{synthesis.watch_list}</p>
      </div>
    </div>
  )
}
