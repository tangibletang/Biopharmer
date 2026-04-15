'use client'

import { useState } from 'react'
import type { Ticker, WarRoomResponse } from './types'
import { displayTicker } from './types'
import Sidebar from './components/Sidebar'
import TimelineTab from './components/tabs/TimelineTab'
import ProximityMapTab from './components/tabs/ProximityMapTab'
import WarRoomTab from './components/tabs/WarRoomTab'

type Tab = 'timeline' | 'proximity' | 'research'

const TABS: { id: Tab; label: string }[] = [
  { id: 'timeline',  label: 'Timeline' },
  { id: 'proximity', label: 'Proximity Map' },
  { id: 'research',  label: 'The Research Pharm' },
]

// Persisted state per ticker — survives tab switches within the session
export interface PersistedResearch {
  result: WarRoomResponse | null
  focus: string
}

export default function Home() {
  const [ticker, setTicker] = useState<Ticker>('SRPT')
  const [activeTab, setTab] = useState<Tab>('timeline')

  // Actionable catalyst from last completed research, keyed by ticker (shown in sidebar)
  const [catalysts, setCatalysts] = useState<Partial<Record<Ticker, string>>>({})

  // Full research state per ticker — so switching tabs never loses work
  const [researchByTicker, setResearchByTicker] = useState<Partial<Record<Ticker, PersistedResearch>>>({})

  const handleSynthesis = (t: Ticker, catalyst: string) => {
    setCatalysts(prev => ({ ...prev, [t]: catalyst }))
  }

  const handleResearchSave = (t: Ticker, state: PersistedResearch) => {
    setResearchByTicker(prev => ({ ...prev, [t]: state }))
  }

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <Sidebar
        selected={ticker}
        onSelect={(t) => setTicker(t)}
        catalysts={catalysts}
      />

      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center gap-4 px-6 py-3 border-b border-border bg-surface shrink-0">
          <span className="text-xs text-muted uppercase tracking-widest">DMD Intelligence Terminal</span>
          <span className="ml-auto text-xs text-muted">v0.1 MVP</span>
        </header>

        <div className="flex items-baseline gap-3 px-6 py-4 border-b border-border shrink-0">
          <h1 className="text-2xl font-bold tracking-tight text-[#e6edf3]">${displayTicker(ticker)}</h1>
          <span className="text-sm text-muted">Duchenne Muscular Dystrophy universe</span>
        </div>

        <nav className="flex gap-1 px-6 pt-3 border-b border-border bg-canvas shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={[
                'px-4 py-2 text-xs rounded-t transition-colors',
                activeTab === tab.id
                  ? 'bg-surface text-[#e6edf3] border border-b-0 border-border'
                  : 'text-muted hover:text-[#e6edf3]',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <main className="flex-1 overflow-auto bg-canvas p-6">
          {activeTab === 'timeline'  && <TimelineTab ticker={ticker} />}
          {activeTab === 'proximity' && <ProximityMapTab ticker={ticker} />}
          {activeTab === 'research'  && (
            <WarRoomTab
              ticker={ticker}
              saved={researchByTicker[ticker]}
              onSave={(state) => handleResearchSave(ticker, state)}
              onSynthesis={handleSynthesis}
            />
          )}
        </main>
      </div>
    </div>
  )
}
