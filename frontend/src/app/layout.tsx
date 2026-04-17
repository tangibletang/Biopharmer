import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Biopharmer — Biotech investing & DMD catalysts',
  description:
    'Catalysts, comps, and prices for biotech investors — live DMD coverage with timelines, competitive view, and AI research.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-canvas text-[#e6edf3] font-mono antialiased">
        {children}
      </body>
    </html>
  )
}
