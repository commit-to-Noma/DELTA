/**
 * DELTA Design System Tokens
 * Strict adherence to 60/30/10 Rule:
 * 60% Storm Grey / Light Neutral Surface Accents
 * 30% Matte Onyx / Dark Structural Panels, Navigation & Technical Baselines
 * 10% Safety Orange / Operational Interventions & Flood Warnings
 */

export const DELTA_TOKENS = {
  colors: {
    // 60% Storm Grey & Neutral Slate
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
    // 30% Matte Onyx (Structural Shell & Spatial Layout)
    onyx: {
      950: '#0A0D12', // Background base
      900: '#10151C', // Navigation, sidebar, header
      850: '#161D27', // Cards, inspection panels
      800: '#1E2734', // Panel dividers, structural borders
      700: '#2A3648', // Interactive hover / active state borders
      600: '#3B4B61', // Tertiary borders
    },
    // 10% Safety Orange (Action, Replanning Trigger, Alert)
    safety: {
      orange: '#FF5E1E',
      hover: '#E04B0F',
      dark: '#C23C07',
      muted: 'rgba(255, 94, 30, 0.12)',
      border: 'rgba(255, 94, 30, 0.35)',
      glow: '0 0 15px rgba(255, 94, 30, 0.3)',
    },
    // Hydrology & Environmental Accents
    hydro: {
      500: '#0284C7',
      600: '#0369A1',
      muted: 'rgba(2, 132, 199, 0.12)',
      border: 'rgba(2, 132, 199, 0.35)',
    },
    // Telemetry Status
    status: {
      nominal: '#10B981', // Green
      warning: '#F59E0B', // Amber
      critical: '#FF5E1E', // Safety Orange
      offline: '#64748B', // Slate
    }
  },
  typography: {
    display: 'font-display tracking-tight font-semibold',
    heading: 'font-display tracking-tight font-medium',
    mono: 'font-mono text-xs tracking-wider uppercase',
    body: 'font-sans text-sm antialiased',
  },
  elevation: {
    panel: 'bg-onyx-900 border border-onyx-800 shadow-tactical',
    card: 'bg-onyx-850 border border-onyx-800/80 shadow-tactical',
    activeCard: 'bg-onyx-850 border border-safety-border shadow-safety',
  }
} as const;
