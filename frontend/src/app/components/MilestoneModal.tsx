'use client'

import type { Milestone } from '../types'

interface Props {
  milestone: Milestone
  onClose: () => void
}

const TYPE_STYLES = {
  positive: { dot: 'bg-positive', badge: 'bg-positive/10 text-positive border-positive/30', label: 'POSITIVE' },
  negative: { dot: 'bg-negative', badge: 'bg-negative/10 text-negative border-negative/30', label: 'NEGATIVE' },
  neutral:  { dot: 'bg-accent',   badge: 'bg-accent/10 text-accent border-accent/30',       label: 'NEUTRAL'  },
}

export default function MilestoneModal({ milestone, onClose }: Props) {
  const styles = TYPE_STYLES[milestone.type]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg mx-4 bg-surface border border-border rounded-lg p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${styles.dot} shrink-0 mt-0.5`} />
            <span className="text-[#e6edf3] font-semibold text-sm leading-snug">
              {milestone.label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-[#e6edf3] transition-colors shrink-0 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Date + type badge */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-muted">{milestone.date}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded border ${styles.badge}`}>
            {styles.label}
          </span>
        </div>

        {/* Body */}
        <p className="text-sm text-[#c9d1d9] leading-relaxed">
          {milestone.detail}
        </p>

        {/* Footer */}
        <div className="mt-5 pt-4 border-t border-border">
          <button
            onClick={onClose}
            className="text-xs text-muted hover:text-[#e6edf3] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
