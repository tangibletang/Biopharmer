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
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="fixed top-3.5 right-5 z-50 flex items-center gap-2 px-3 py-1.5 rounded-lg
                 bg-surface border border-border shadow-sm cursor-pointer select-none
                 text-xs font-medium text-muted
                 hover:text-primary hover:border-accent/50 hover:bg-surface-raised
                 transition-all duration-150"
    >
      <span className="text-sm leading-none">{isDark ? '☀' : '☽'}</span>
      <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
    </button>
  )
}
