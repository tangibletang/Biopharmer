import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
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
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
