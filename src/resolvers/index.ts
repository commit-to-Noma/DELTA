import Resolver from '@forge/resolver';

const resolver = new Resolver();

/**
 * Resolves simulation status for both Custom UI and Rovo action queries
 */
resolver.define('getSimulationStatus', async () => {
  return {
    sector: 'District Alpha (Hospital Corridor Catchment)',
    status: 'NOMINAL_BASELINE',
    activeDisruptions: 0,
    inflowM3PerHour: 14250,
    projectedWaterDepthCm: 11.4,
    hospitalArteryStatus: 'PASSABLE',
  };
});

/**
 * Compares candidate interventions against the baseline storm
 */
resolver.define('evaluateInterventions', async () => {
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
    ],
  };
});

export const handler = resolver.getDefinitions();
