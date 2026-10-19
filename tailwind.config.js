/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0A0E0D',
          elevated: '#141A16',
          surface: '#1A221D',
          hover: '#222C26',
          border: '#1E2822',
          subtle: '#2A372F',
        },
        signal: {
          lime: '#D5FF70',
          'lime-dim': 'rgba(213, 255, 112, 0.15)',
          'lime-glow': 'rgba(213, 255, 112, 0.35)',
        },
        text: {
          primary: '#F0F0E8',
          secondary: '#A7B3AA',
          muted: '#68776E',
        },
        sage: {
          DEFAULT: '#53645A',
          dim: '#37433C',
          light: '#72887B',
        },
        coral: {
          DEFAULT: '#FF795E',
          dim: 'rgba(255, 121, 94, 0.15)',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'signal-glow': '0 0 20px -2px rgba(213, 255, 112, 0.25)',
        'signal-glow-sm': '0 0 10px -1px rgba(213, 255, 112, 0.2)',
        'coral-glow': '0 0 15px -2px rgba(255, 121, 94, 0.25)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 20s linear infinite',
      },
    },
  },
  plugins: [],
}
