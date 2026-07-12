'use client'

import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('theme')
    const dark = saved ? saved === 'dark' : true
    setIsDark(dark)
  }, [])

  const toggle = () => {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  if (!mounted) return null

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className="fixed top-3 right-4 z-50 flex h-8 w-8 items-center justify-center rounded-lg
                 bg-surface border border-border shadow-sm cursor-pointer select-none
                 text-sm text-muted
                 hover:text-primary hover:border-accent/50 hover:bg-surface-raised
                 transition-all duration-150"
    >
      <span className="leading-none" aria-hidden>
        {isDark ? '☀' : '☽'}
      </span>
    </button>
  )
}
