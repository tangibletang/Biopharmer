import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      keyframes: {
        'war-glow': {
          '0%, 100%': { boxShadow: '0 0 0 1px rgba(88, 166, 255, 0.15)', opacity: '0.85' },
          '50%': { boxShadow: '0 0 24px rgba(88, 166, 255, 0.28)', opacity: '1' },
        },
        'war-bar': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' },
        },
        'war-blink': {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'war-glow': 'war-glow 2.8s ease-in-out infinite',
        'war-bar': 'war-bar 1.8s ease-in-out infinite',
        'war-blink': 'war-blink 1.2s ease-in-out infinite',
      },
      colors: {
        canvas:   '#0d1117',
        surface:  '#161b22',
        border:   '#30363d',
        accent:   '#58a6ff',
        positive: '#3fb950',
        negative: '#f85149',
        muted:    '#8b949e',
      },
      fontFamily: {
        sans: ['var(--font-plex-sans)', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
