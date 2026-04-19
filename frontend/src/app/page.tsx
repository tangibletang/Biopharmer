'use client'

// ── Biopharmer Hub ────────────────────────────────────────────────────────────
// Landing page: DMD is the live, featured universe. Other sectors are in-progress.

const DMD_COMPANIES = [
  { ticker: 'SRPT', name: 'Sarepta',  color: '#d2a8ff' },
  { ticker: 'DYN',  name: 'Dyne',     color: '#58a6ff' },
  { ticker: 'RNA',  name: 'Avidity',  color: '#3fb950' },
  { ticker: 'WVE',  name: 'Wave',     color: '#ffa657' },
]

const COMING_SOON = [
  {
    id: 'neurology',
    label: 'Neurology',
    sub: "Alzheimer's · Parkinson's",
    companies: ['BIIB', 'NVS', 'ABBV'],
    color: '#58a6ff',
  },
  {
    id: 'oncology',
    label: 'Oncology',
    sub: 'Solid Tumors · Immuno-Oncology',
    companies: ['MRK', 'AZN', 'BMY'],
    color: '#f78166',
  },
  {
    id: 'cardiometabolic',
    label: 'Cardiometabolic',
    sub: 'GLP-1s · SGLT2i · PCSK9',
    companies: ['LLY', 'NVO', 'AMGN'],
    color: '#d2a8ff',
  },
]

export default function HubPage() {
  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-border bg-surface/60 backdrop-blur-sm">
        <div>
          <span className="text-accent font-bold tracking-[0.2em] text-sm">BIOPHARMER</span>
          <span className="ml-3 text-[10px] text-muted">Biotech investing</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse" />
          <span className="text-[10px] text-muted">DMD live · more soon</span>
        </div>
      </header>

      {/* Hero */}
      <div className="px-8 pt-14 pb-10 max-w-5xl mx-auto w-full">
        <p className="text-[10px] text-accent uppercase tracking-[0.25em] mb-3">For biotech investors</p>
        <h1 className="text-4xl font-bold tracking-tight text-[#e6edf3] leading-tight">
          See catalysts, comps, and prices<br />
          <span className="text-muted font-normal">in one place.</span>
        </h1>
        <p className="mt-4 text-sm text-muted max-w-md leading-relaxed">
          Live DMD coverage today: clinical milestones, a competitive view across four names,
          live prices, and AI research when you want to go deeper — built for investment decisions, not jargon.
        </p>
      </div>

      {/* Cards grid */}
      <div className="px-8 pb-16 max-w-5xl mx-auto w-full grid grid-cols-3 gap-5">

        {/* ── DMD card (spans full width top row) ─────────────────────────── */}
        <a
          href="/research-barn?sector=dmd"
          className="col-span-3 group relative rounded-xl border border-[#3fb950]/40 bg-surface
                     hover:border-[#3fb950]/70 hover:bg-[#161b22] transition-all duration-200
                     shadow-[0_0_30px_rgba(63,185,80,0.08)] hover:shadow-[0_0_40px_rgba(63,185,80,0.14)]
                     overflow-hidden"
        >
          {/* Subtle green gradient top strip */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#3fb950]/60 to-transparent" />

          <div className="flex items-start justify-between p-7 pb-5">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-positive/15 text-positive border border-positive/30 uppercase tracking-widest">
                  Live
                </span>
                <span className="text-[10px] text-muted">Genetic disease</span>
              </div>
              <h2 className="text-2xl font-bold text-[#e6edf3] mt-2 tracking-tight">
                DMD
              </h2>
              <p className="text-[11px] text-muted/90 mt-0.5">Duchenne muscular dystrophy</p>
              <p className="text-sm text-muted mt-2 max-w-sm leading-relaxed">
                Four public names, 50+ catalysts, live prices — plus timelines and AI diligence so you can follow what matters for the trade.
              </p>
            </div>

            <div className="shrink-0 text-right">
              <div className="text-[10px] text-muted mb-3 uppercase tracking-wider">Coverage</div>
              <div className="flex flex-col gap-1.5">
                {DMD_COMPANIES.map(c => (
                  <div key={c.ticker} className="flex items-center gap-2 justify-end">
                    <span className="text-[11px] text-muted">{c.name}</span>
                    <span
                      className="text-xs font-bold font-mono px-1.5 py-0.5 rounded"
                      style={{ color: c.color, backgroundColor: c.color + '18' }}
                    >
                      ${c.ticker}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Feature pills */}
          <div className="px-7 pb-5 flex items-center gap-3">
            <FeaturePill label="Clinical Timeline" />
            <FeaturePill label="Competitive Overview" />
            <FeaturePill label="AI Research" />
            <FeaturePill label="Live Prices" />
          </div>

          {/* CTA footer */}
          <div className="px-7 py-4 border-t border-border/60 flex items-center justify-between">
            <span className="text-xs text-muted">
              4 companies · 50+ milestones · real-time data
            </span>
            <span className="text-xs font-semibold text-positive group-hover:translate-x-0.5 transition-transform duration-150">
              Open workspace →
            </span>
          </div>
        </a>

        {/* ── Coming-soon sector cards ──────────────────────────────────────── */}
        {COMING_SOON.map(s => (
          <ComingSoonCard key={s.id} sector={s} />
        ))}
      </div>

      {/* Footer */}
      <div className="mt-auto px-8 py-5 border-t border-border text-center">
        <p className="text-[10px] text-muted/50 uppercase tracking-widest">
          Biopharmer · Not financial advice
        </p>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FeaturePill({ label }: { label: string }) {
  return (
    <span className="text-[10px] text-muted border border-border rounded-full px-2.5 py-0.5 uppercase tracking-wider">
      {label}
    </span>
  )
}

function ComingSoonCard({
  sector,
}: {
  sector: { id: string; label: string; sub: string; companies: string[]; color: string }
}) {
  return (
    <div className="relative rounded-xl border border-border bg-surface/40 overflow-hidden select-none opacity-60">
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px opacity-40"
        style={{ background: `linear-gradient(to right, transparent, ${sector.color}, transparent)` }}
      />

      <div className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-border/40 text-muted border border-border uppercase tracking-widest">
            In Progress
          </span>
        </div>

        <h3
          className="text-lg font-bold tracking-tight"
          style={{ color: sector.color + 'cc' }}
        >
          {sector.label}
        </h3>
        <p className="text-[11px] text-muted mt-0.5 leading-snug">{sector.sub}</p>

        <div className="flex flex-wrap gap-1.5 mt-4">
          {sector.companies.map(t => (
            <span
              key={t}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded text-muted border border-border/60"
            >
              ${t}
            </span>
          ))}
        </div>
      </div>

      <div className="px-6 py-3 border-t border-border/40">
        <span className="text-[10px] text-muted/60 uppercase tracking-widest">Coming Soon</span>
      </div>

      {/* Full overlay lock */}
      <div className="absolute inset-0 cursor-not-allowed" />
    </div>
  )
}
