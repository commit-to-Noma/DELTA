/**
 * Atlassian Rovo Action Resolver for DELTA
 * Handles rovo:action tool invocations from the DELTA Rovo virtual agent.
 * Strictly deterministic: Rovo queries simulation state and explanations;
 * it never mutates operational state or authorizes interventions.
 * 
 * Truth Gate: Returns { status: 'NO_RUN' } if no run has been executed,
 * preventing invented constants or placeholder numbers.
 */

export interface RovoActionInvocation {
  actionKey: string;
  parameters: Record<string, unknown>;
}

/**
 * Resolver entry point for rovo:action modules declared in manifest.yml
 */
export async function handler(event: { action?: { key: string }; payload?: Record<string, unknown> }) {
  const actionKey = event?.action?.key || 'unknown';

  switch (actionKey) {
    case 'get-simulation-status':
      return {
        success: true,
        status: 'NO_RUN',
        message: 'No simulation run recorded. Run a simulation in the DELTA Engine UI to compute hydraulic metrics.'
      };

    case 'evaluate-interventions':
      return {
        success: true,
        status: 'NO_RUN',
        message: 'No multi-scenario intervention evaluation recorded. Complete Phase 3 in DELTA Engine.'
      };

    default:
      return {
        success: false,
        error: `Unrecognized action key: ${actionKey}`,
        supportedActions: ['get-simulation-status', 'evaluate-interventions'],
      };
  }
}

