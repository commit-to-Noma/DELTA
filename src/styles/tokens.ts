/**
 * DELTA Design System Tokens
 * Strict adherence to 60/30/10 Rule & Reviewer's Decision:
 * 60% Storm Grey (#3C434B) / Technical Workspace Backgrounds
 * 30% Matte Onyx (#14171A) / Panels, Map Frame, Structural Baseline
 * 10% Safety Orange (#FF6B1A) / Actionable Decisions & Changed States ONLY
 * Text: Bone (#E8E6E1)
 * Map Data Only: Water Blues (#BFE3F0 to #1F7FA8 to #0F3F5E)
 * Hazards: Cross-hatching & Map-Confined Tactical Red (#EF4444)
 */

export const DELTA_TOKENS = {
  colors: {
    // 60% Storm Grey Background Base
    storm: {
      bg: '#3C434B', // Core background
      50: '#F8FAFC',
      100: '#E8E6E1', // Bone text
      200: '#CBD5E1',
      300: '#94A3B8',
      400: '#64748B',
      500: '#475569',
      600: '#3C434B', // Main storm grey
      700: '#2F353C',
    },
    // 30% Matte Onyx (Structural Shell, Panels, Frame)
    onyx: {
      panel: '#14171A', // Core matte onyx
      950: '#0E1012',
      900: '#14171A', // Panels, map-sheet frame, navigation
      850: '#1C2126', // Cards, inspection panels
      800: '#252B32', // Panel dividers, structural borders
      700: '#343C46', // Interactive borders
      600: '#444E5A',
    },
    // 10% Safety Orange (Action & Changed State ONLY)
    safety: {
      orange: '#FF6B1A',
      hover: '#E55A0F',
      dark: '#C74A08',
      muted: 'rgba(255, 107, 26, 0.12)',
      border: 'rgba(255, 107, 26, 0.35)',
      glow: '0 0 15px rgba(255, 107, 26, 0.3)',
    },
    // Text Primary
    text: {
      bone: '#E8E6E1',
      muted: '#94A3B8',
      dim: '#64748B',
    },
    // Hydrology & Water Color Ramps (Map Only)
    hydro: {
      shallow: '#BFE3F0',
      medium: '#1F7FA8',
      deep: '#0F3F5E',
      muted: 'rgba(31, 127, 168, 0.15)',
      border: 'rgba(31, 127, 168, 0.4)',
    },
    // Operational & Map Hazard Status (Hazards = Red/Hatching, NOT Orange)
    hazard: {
      red: '#EF4444',
      darkRed: '#991B1B',
      border: 'rgba(239, 68, 68, 0.4)',
    },
    status: {
      nominal: '#10B981', // Green
      warning: '#F59E0B', // Amber
      critical: '#EF4444', // Red (Confined to hazards/impassable)
      actionRequired: '#FF6B1A', // Safety Orange for actionable trigger
      offline: '#64748B',
    }
  },
  typography: {
    display: 'font-display tracking-tight font-semibold',
    heading: 'font-display tracking-tight font-medium',
    mono: 'font-mono text-xs tracking-wider uppercase',
    body: 'font-sans text-sm text-[#E8E6E1] antialiased',
  },
  elevation: {
    panel: 'bg-[#14171A] border border-[#252B32] shadow-tactical',
    card: 'bg-[#1C2126] border border-[#252B32]/80 shadow-tactical',
    activeCard: 'bg-[#1C2126] border border-[#FF6B1A]/40 shadow-safety',
  }
} as const;
