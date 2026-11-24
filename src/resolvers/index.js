import Resolver from '@forge/resolver';

const resolver = new Resolver();

// Data payload definitions
const NOMINAL_SIMULATION_STATUS = {
  sector: 'Boston Longwood Medical Area & Muddy River Catchment',
  gridDimensions: '64x64 regular Cartesian (25m cell, 2.56 km²)',
  status: 'NOMINAL_BASELINE',
  activeDisruptions: 0,
  inflowM3PerHour: 14250,
  projectedWaterDepthCm: 11.4,
  hospitalArteryStatus: 'PASSABLE',
  monitoredFacilities: [
    "Brigham and Women's Hospital",
    "Boston Children's Hospital",
    "Beth Israel Deaconess Medical Center (West Campus)",
    "Beth Israel Deaconess Medical Center (East Campus)",
    "Dana-Farber Cancer Institute"
  ],
  waterBalance: {
    relativeConservationError: '< 1e-10',
    modeledDrainageInlets: 3,
    openBoundaryOutlet: 'Muddy River North Conduit'
  }
};

const CANDIDATE_INTERVENTIONS = {
  evaluatedAgainstStorm: 'NOAA Atlas 14 100-Year 6-Hour Design Event (122.0 mm total depth)',
  candidates: [
    {
      planId: 'plan-beta',
      name: 'Plan Beta: Clear Brookline Avenue Culvert & Deploy High-Capacity Pump #1',
      inundationReduction: '-46.2%',
      hospitalDelayMinutes: 2.1,
      confidence: 0.948,
      tradeOffSummary: 'Prevents backwater surge along Brookline Ave and Francis St by restoring culvert conveyance to 12.5 m³/s.',
      operationalRisk: 'LOW',
      approvalRequired: 'Human Incident Commander'
    },
    {
      planId: 'plan-alpha',
      name: 'Plan Alpha: Rapid Deployable Barrier along Francis St Ambulance Route',
      inundationReduction: '-22.5%',
      hospitalDelayMinutes: 8.4,
      confidence: 0.821,
      tradeOffSummary: 'Deflects overland sheet flow locally from BWH entrance, but increases ponding depth in adjacent parking structures by 6 cm.',
      operationalRisk: 'MEDIUM',
      approvalRequired: 'Human Incident Commander'
    }
  ]
};

// Register for Custom UI bridge calls (camelCase and kebab-case)
resolver.define('getSimulationStatus', async () => NOMINAL_SIMULATION_STATUS);
resolver.define('get-simulation-status', async () => NOMINAL_SIMULATION_STATUS);
resolver.define('evaluateInterventions', async () => CANDIDATE_INTERVENTIONS);
resolver.define('evaluate-interventions', async () => CANDIDATE_INTERVENTIONS);

const customUiHandler = resolver.getDefinitions();

/**
 * Universal Handler supporting both:
 * 1. Custom UI Bridge invocations (via @forge/bridge invoke())
 * 2. Rovo Agent Action invocations (via rovo:action modules in manifest.yml)
 */
export async function handler(event, context) {
  // Case A: Custom UI bridge call
  if (event?.call && event.call.functionKey) {
    return await customUiHandler(event, context);
  }

  // Case B: Rovo Action or direct backend call
  const actionKey = event?.action?.key || event?.actionKey || event?.key || 'unknown';

  switch (actionKey) {
    case 'get-simulation-status':
    case 'getSimulationStatus':
      return {
        success: true,
        data: NOMINAL_SIMULATION_STATUS
      };

    case 'evaluate-interventions':
    case 'evaluateInterventions':
      return {
        success: true,
        data: CANDIDATE_INTERVENTIONS
      };

    default:
      return {
        success: false,
        error: {
          code: 'UNRECOGNIZED_ACTION',
          message: `Action key '${actionKey}' is not supported by DELTA Hydraulic Advisor.`,
          supportedActions: ['get-simulation-status', 'evaluate-interventions']
        }
      };
  }
}
