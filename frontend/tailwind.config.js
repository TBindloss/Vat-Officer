/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aviation: {
          bg: 'var(--aviation-bg)',
          surface: 'rgb(var(--aviation-surface-rgb) / <alpha-value>)',
          'surface-light': 'rgb(var(--aviation-surface-light-rgb) / <alpha-value>)',
          border: 'rgb(var(--aviation-border-rgb) / <alpha-value>)',
          text: 'var(--aviation-text)',
          'text-secondary': 'rgb(var(--aviation-text-secondary-rgb) / <alpha-value>)',
          accent: 'rgb(var(--aviation-accent-rgb) / <alpha-value>)',
          'accent-hover': 'var(--aviation-accent-hover)',
          success: 'var(--aviation-success)',
          danger: 'var(--aviation-danger)',
          highlight: 'var(--aviation-highlight)',
          'highlight-border': 'var(--aviation-highlight-border)',
          'nav-bg': 'var(--aviation-nav-bg)',
          'nav-text': 'var(--aviation-nav-text)',
          'nav-text-secondary': 'var(--aviation-nav-text-secondary)',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
        sans: ['DM Sans', 'system-ui', 'sans-serif']
      }
    },
  },
  plugins: [],
}
