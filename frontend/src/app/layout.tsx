import type { Metadata } from 'next'
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import './globals.css'
import { ThemeToggle } from './components/ThemeToggle'

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Biopharmer — Biotech investing & DMD catalysts',
  description:
    'Catalysts, comps, and prices for biotech investors — live DMD coverage with timelines, competitive view, and AI research.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${plexSans.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Inline script: apply saved theme before first paint to avoid flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.remove('dark');}else{document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="bg-canvas text-primary font-sans antialiased">
        {children}
        <ThemeToggle />
      </body>
    </html>
  )
}
