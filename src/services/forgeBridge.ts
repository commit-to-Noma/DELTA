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

  if (functionKey === 'getDecisionForIssue') {
    const issueKey = payload?.issueKey || payload;
    try {
      const stored = localStorage.getItem('delta_local_decisions');
      const list = stored ? JSON.parse(stored) : [];
      const found = list.find((d: any) => d.linkedIssueKey === issueKey);
      if (found) {
        return { success: true, data: found };
      }
      return { success: false, error: { code: 'NO_DECISION_FOR_ISSUE', message: `No approved decision record has been linked to Jira issue '${issueKey}'.` } };
    } catch {
      return { success: false, error: { code: 'NO_DECISION_FOR_ISSUE', message: 'Failed to access local store' } };
    }
  }

  if (functionKey === 'linkDecisionToIssue') {
    const { issueKey, decisionId } = payload || {};
    try {
      const stored = localStorage.getItem('delta_local_decisions');
      const list = stored ? JSON.parse(stored) : [];
      const item = list.find((d: any) => d.decisionId === decisionId);
      if (!item) {
        return { success: false, error: { code: 'DECISION_NOT_FOUND', message: `No record found for identifier '${decisionId}'.` } };
      }
      item.linkedIssueKey = issueKey;
      item.linkedAt = new Date().toISOString();
      localStorage.setItem('delta_local_decisions', JSON.stringify(list));
      return { success: true, data: { issueKey, decisionId, status: item.status, chosenPlan: item.chosenPlan } };
    } catch (e: any) {
      return { success: false, error: { code: 'LINK_FAILED', message: e?.message || String(e) } };
    }
  }

  return { success: true, data: null };
}

/**
 * Returns Forge view context (e.g. extension type, issue key) safely in both
 * live Forge Custom UI iframes and standalone preview.
 */
export async function getContextSafe(): Promise<any> {
  const isRunningInIframe = typeof window !== 'undefined' && window.parent !== window;
  if (isRunningInIframe) {
    try {
      const bridge = await import('@forge/bridge');
      if (bridge.view && typeof bridge.view.getContext === 'function') {
        const ctx = await bridge.view.getContext();
        if (ctx) return ctx;
      }
    } catch (e) {
      console.warn('[DELTA] Forge view.getContext unavailable:', e);
    }
  }

  // Standalone browser preview parameters
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const isPanel = params?.get('view') === 'panel';
  const issueKey = params?.get('issue') || 'EMERG-101';

  return {
    extension: {
      type: isPanel ? 'jira:issuePanel' : 'jira:projectPage',
      issue: {
        key: issueKey,
        id: '10001'
      }
    }
  };
}
