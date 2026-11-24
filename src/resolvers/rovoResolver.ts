/**
 * Atlassian Rovo Action Resolver for DELTA
 * Handles rovo:action tool invocations from the DELTA Rovo virtual agent.
 * Strictly deterministic: Rovo queries simulation state and explanations;
 * it never mutates operational state or authorizes interventions.
 */

export interface RovoActionInvocation {
  actionKey: string;
  parameters: Record<string, unknown>;
}

export interface SimulationStatusResponse {
  sector: string;
  status: string;
  activeDisruptions: number;
  inflowM3PerHour: number;
  projectedWaterDepthCm: number;
  hospitalArteryStatus: string;
}

export interface CandidatePlanResponse {
  planId: string;
  name: string;
  inundationReduction: string;
  hospitalDelayMinutes: number;
  confidence: number;
  tradeOffSummary: string;
}

/**
 * Resolver entry point for rovo:action modules declared in manifest.yml
 */
export async function handler(event: { action?: { key: string }; payload?: Record<string, unknown> }) {
  const actionKey = event?.action?.key || 'unknown';

  switch (actionKey) {
    case 'get-simulation-status':
      return {
        sector: 'District Alpha (Hospital Corridor Catchment)',
        status: 'NOMINAL_BASELINE',
        activeDisruptions: 0,
        inflowM3PerHour: 14250,
        projectedWaterDepthCm: 11.4,
        hospitalArteryStatus: 'PASSABLE',
      } satisfies SimulationStatusResponse;

    case 'evaluate-interventions':
      return {
        evaluatedAgainstStorm: 'Standardized 100-Year Hydrograph (360 min)',
        candidates: [
          {
            planId: 'plan-beta',
            name: 'Plan Beta: Clear North Canal Culvert (Outfall 14) & Deploy Pump #1',
            inundationReduction: '-46.2%',
            hospitalDelayMinutes: 2.1,
            confidence: 0.948,
            tradeOffSummary: 'Prevents backwater rise along emergency route by siphoning discharge into retention basin.',
          },
          {
            planId: 'plan-alpha',
            name: 'Plan Alpha: Sandbag Perimeter along St. Jude Emergency Artery',
            inundationReduction: '-22.5%',
            hospitalDelayMinutes: 8.4,
            confidence: 0.821,
            tradeOffSummary: 'Deflects surface water locally but increases downstream pooling near commercial zone.',
          },
        ] satisfies CandidatePlanResponse[],
      };

    default:
      return {
        error: `Unrecognized action key: ${actionKey}`,
        supportedActions: ['get-simulation-status', 'evaluate-interventions'],
      };
  }
}
