'use client'

import type { SynthesisOutput } from '../types'

interface Props {
  synthesis: SynthesisOutput
  ticker: string
}

export default function BullBearMatrix({ synthesis, ticker }: Props) {
  return (
    <div className="space-y-4">
      {/* Bull / Bear columns */}
      <div className="grid grid-cols-2 gap-4">
        {/* Bull case */}
        <div className="bg-positive/5 border border-positive/20 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-positive text-base">▲</span>
            <span className="text-positive text-xs font-semibold uppercase tracking-widest">Bull Case</span>
          </div>
          <p className="text-sm text-[#c9d1d9] leading-relaxed">{synthesis.bull_case}</p>
        </div>

        {/* Bear case */}
        <div className="bg-negative/5 border border-negative/20 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-negative text-base">▼</span>
            <span className="text-negative text-xs font-semibold uppercase tracking-widest">Bear Case</span>
          </div>
          <p className="text-sm text-[#c9d1d9] leading-relaxed">{synthesis.bear_case}</p>
        </div>
      </div>

      {/* Actionable metric */}
      <div className="bg-accent/5 border border-accent/30 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-accent text-xs font-semibold uppercase tracking-widest">Actionable Metric</span>
          <span className="text-[10px] text-muted border border-border rounded px-1.5 py-0.5">${ticker}</span>
        </div>
        <p className="text-sm text-[#e6edf3] font-medium leading-relaxed">{synthesis.actionable_metric}</p>
      </div>
    </div>
  )
}
