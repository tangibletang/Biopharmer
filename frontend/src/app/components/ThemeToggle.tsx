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

  // Avoid hydration mismatch — render nothing until client mounts
  if (!mounted) return null

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="fixed bottom-5 right-5 z-50 w-9 h-9 flex items-center justify-center rounded-full bg-surface border border-border text-muted hover:text-primary hover:border-accent/40 transition-all shadow-lg text-base select-none"
    >
      {isDark ? '☀' : '☽'}
    </button>
  )
}
