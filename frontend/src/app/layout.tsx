import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Biopharmer — DMD Intelligence Terminal',
  description: 'Biotech investing platform with multi-agent clinical diligence',
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
