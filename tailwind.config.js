/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 60% Storm Grey / Technical Neutrals
        storm: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
        },
        // 30% Matte Onyx / Dark Panels & Structural Contrast
        onyx: {
          950: '#0A0D12',
          900: '#10151C',
          850: '#161D27',
          800: '#1E2734',
          700: '#2A3648',
          600: '#3B4B61',
        },
        // 10% Safety Orange / Operational Interventions & Flood Warnings
        safety: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          400: '#FB923C',
          500: '#F97316',
          orange: '#FF5E1E',
          hover: '#E04B0F',
          dark: '#C23C07',
          muted: 'rgba(255, 94, 30, 0.14)',
          border: 'rgba(255, 94, 30, 0.35)',
        },
        // Technical Hydrology & Terrain accents
        hydro: {
          500: '#0284C7',
          600: '#0369A1',
          glow: 'rgba(2, 132, 199, 0.25)',
        },
        terrain: {
          contour: 'rgba(148, 163, 184, 0.15)',
          grid: 'rgba(255, 255, 255, 0.05)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'monospace'],
        display: ['Space Grotesk', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'tactical': '0 2px 10px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.06)',
        'safety': '0 0 20px rgba(255, 94, 30, 0.25), 0 0 0 1px rgba(255, 94, 30, 0.4)',
      },
      backgroundImage: {
        'topo-pattern': "radial-gradient(circle at 50% 50%, rgba(255,94,30,0.03) 0%, transparent 60%)",
        'grid-pattern': "linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)",
      }
    },
  },
  plugins: [],
}
