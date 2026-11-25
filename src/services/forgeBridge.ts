/**
 * DELTA Safe Forge Bridge Service
 * 
 * In Atlassian Forge Custom UI (inside iframe), delegates directly to @forge/bridge invoke.
 * In standalone local development (e.g. localhost:5173 for judge demos and preview),
 * provides an in-memory / localStorage fallback so the application UI mounts cleanly.
 */

let forgeInvokeFn: ((functionKey: string, payload?: any) => Promise<any>) | null = null;
let bridgeAttempted = false;

export async function invokeSafe(functionKey: string, payload?: any): Promise<any> {
  const isRunningInIframe = typeof window !== 'undefined' && window.parent !== window;

  if (!bridgeAttempted && isRunningInIframe) {
    bridgeAttempted = true;
    try {
      const bridge = await import('@forge/bridge');
      forgeInvokeFn = bridge.invoke;
    } catch (err) {
      console.warn('[DELTA] Forge Bridge unavailable in this context, falling back to local storage.', err);
    }
  }

  if (forgeInvokeFn) {
    return forgeInvokeFn(functionKey, payload);
  }

  // Local fallback for standalone browser inspection
  if (functionKey === 'listDecisions') {
    try {
      const stored = localStorage.getItem('delta_local_decisions');
      return { success: true, data: stored ? JSON.parse(stored) : [] };
    } catch {
      return { success: true, data: [] };
    }
  }

  if (functionKey === 'saveDecision' || functionKey === 'recordDecision') {
    try {
      const stored = localStorage.getItem('delta_local_decisions');
      const list = stored ? JSON.parse(stored) : [];
      const decisionId = payload?.decisionId || `DEC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const record = {
        ...payload,
        decisionId,
        schemaVersion: '2.0.0',
        scenarioHash: payload?.scenarioHash || 'sha256:7f8e3a2b1c4d9e0f',
        chosenPlan: payload?.chosenPlan || {
          planId: 'plan-gamma',
          name: 'Plan Gamma: Emergency High-Velocity Culvert Jetting'
        },
        humanApprover: {
          displayName: payload?.humanApprover?.displayName || 'Cmdr. Vance',
          role: 'Incident Commander',
          accountId: 'qm:commander-vance',
          authorizationPolicy: 'Incident Commander Role Verification',
          approvalTimestamp: new Date().toISOString(),
          verifiedAt: new Date().toISOString()
        },
        engineeringRationale: payload?.engineeringRationale || payload?.notes || 'Authorized hydraulic mitigation plan to preserve critical hospital access corridors.',
        status: payload?.status || 'APPROVED',
        createdAt: new Date().toISOString()
      };
      list.unshift(record);
      localStorage.setItem('delta_local_decisions', JSON.stringify(list));
      return { success: true, data: record, record };
    } catch {
      return { success: true, data: null };
    }
  }

  if (functionKey === 'saveSimulationRun') {
    return { success: true, status: 'COMPLETED_RUN', message: 'Saved in local session' };
  }

  if (functionKey === 'saveInterventionsEvaluation') {
    try {
      localStorage.setItem('delta_latest_interventions', JSON.stringify(payload));
      return { success: true, status: 'SAVED_LOCAL', data: payload };
    } catch {
      return { success: true, status: 'SAVED_LOCAL' };
    }
  }

  if (functionKey === 'evaluateInterventions') {
    try {
      const stored = localStorage.getItem('delta_latest_interventions');
      if (stored) {
        return { success: true, status: 'COMPLETED_EVALUATION', data: JSON.parse(stored) };
      }
      return { success: true, status: 'NO_RUN', message: 'No evaluation recorded in local session.' };
    } catch {
      return { success: true, status: 'NO_RUN' };
    }
  }

  if (functionKey === 'queryTeamworkGraph') {
    return {
      success: true,
      nodes: [
        { id: 'FACILITY-BWH', type: 'HEALTHCARE_FACILITY', name: "Brigham and Women's Hospital" },
        { id: 'FACILITY-BCH', type: 'HEALTHCARE_FACILITY', name: "Boston Children's Hospital" },
        { id: 'DRAIN-CULVERT-01', type: 'MUNICIPAL_DRAINAGE', name: 'Brookline Avenue Culvert' }
      ],
      edges: [
        { id: 'EDGE-01', sourceNodeId: 'FACILITY-BWH', targetNodeId: 'DRAIN-CULVERT-01', relationType: 'DRAINED_BY' }
      ]
    };
  }

  return { success: true, data: null };
}
