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
          bg: '#3C434B',
          50: '#F8FAFC',
          100: '#E8E6E1', // Bone text
          200: '#CBD5E1',
          300: '#94A3B8',
          400: '#64748B',
          500: '#475569',
          600: '#3C434B',
          700: '#2F353C',
        },
        // 30% Matte Onyx / Dark Panels & Structural Contrast
        onyx: {
          panel: '#14171A',
          950: '#0E1012',
          900: '#14171A',
          850: '#1C2126',
          800: '#252B32',
          700: '#343C46',
          600: '#444E5A',
        },
        // 10% Safety Orange / Actionable Interventions ONLY
        safety: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          400: '#FB923C',
          500: '#FF6B1A',
          orange: '#FF6B1A',
          hover: '#E55A0F',
          dark: '#C74A08',
          muted: 'rgba(255, 107, 26, 0.14)',
          border: 'rgba(255, 107, 26, 0.35)',
        },
        bone: '#E8E6E1',
        hazard: {
          red: '#EF4444',
          darkRed: '#991B1B',
          border: 'rgba(239, 68, 68, 0.4)',
        },
        // Technical Hydrology & Terrain accents
        hydro: {
          shallow: '#BFE3F0',
          medium: '#1F7FA8',
          deep: '#0F3F5E',
          500: '#1F7FA8',
          600: '#0F3F5E',
          glow: 'rgba(31, 127, 168, 0.25)',
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
