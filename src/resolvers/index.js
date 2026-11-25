import Resolver from '@forge/resolver';
import {
  recordDecision,
  getDecision,
  getDecisionForIssue,
  listDecisions,
  validateDecisionPayload,
  getStorageClient,
  __resetInMemoryStore
} from './decisionStorage.js';
import {
  createDispatchTicket,
  buildDispatchAdfDescription
} from './jsmDispatcher.js';
import {
  resolveDispatchLocation,
  validateAndReconcileLocation,
  latLonToProjected,
  projectedToLatLon,
  AUTHORITATIVE_INTERVENTION_LOCATIONS,
  CATCHMENT_BOUNDS
} from './coordinates.js';

export {
  recordDecision,
  getDecision,
  getDecisionForIssue,
  listDecisions,
  validateDecisionPayload,
  getStorageClient,
  __resetInMemoryStore,
  createDispatchTicket,
  buildDispatchAdfDescription,
  resolveDispatchLocation,
  validateAndReconcileLocation,
  latLonToProjected,
  projectedToLatLon,
  AUTHORITATIVE_INTERVENTION_LOCATIONS,
  CATCHMENT_BOUNDS
};

const resolver = new Resolver();

export const SIMULATION_RUN_KEY = 'simulation:latest-run';
export const INTERVENTIONS_EVAL_KEY = 'simulation:latest-interventions';

/**
 * Persists the latest real simulation run summary into Forge KVS.
 */
export async function saveSimulationRun(summary, storageOverride = null) {
  const client = getStorageClient(storageOverride);
  const record = {
    ...summary,
    savedAt: new Date().toISOString()
  };
  await client.set(SIMULATION_RUN_KEY, record);
  return { success: true, data: record };
}

/**
 * Retrieves the latest real simulation run summary.
 * Returns { success: true, status: 'NO_RUN' } if no run has been executed yet,
 * strictly preventing invented literals or placeholder numbers.
 */
export async function getSimulationStatus(storageOverride = null) {
  const client = getStorageClient(storageOverride);
  const run = await client.get(SIMULATION_RUN_KEY);
  if (!run) {
    return {
      success: true,
      status: 'NO_RUN',
      message: 'No simulation run recorded. Run a simulation in the DELTA Engine UI to compute hydraulic metrics.'
    };
  }
  return {
    success: true,
    status: 'COMPLETED_RUN',
    data: run
  };
}

/**
 * Persists evaluated candidate interventions from a solver run.
 */
export async function saveInterventionsEvaluation(evaluation, storageOverride = null) {
  const client = getStorageClient(storageOverride);
  const record = {
    ...evaluation,
    savedAt: new Date().toISOString()
  };
  await client.set(INTERVENTIONS_EVAL_KEY, record);
  return { success: true, data: record };
}

/**
 * Retrieves candidate interventions evaluated against the baseline storm.
 * Returns { success: true, status: 'NO_RUN' } if Phase 3 multi-plan evaluation
 * has not been executed yet.
 */
export async function evaluateInterventions(storageOverride = null) {
  const client = getStorageClient(storageOverride);
  const evalData = await client.get(INTERVENTIONS_EVAL_KEY);
  if (!evalData) {
    return {
      success: true,
      status: 'NO_RUN',
      message: 'No multi-scenario intervention evaluation recorded. Complete Phase 3 in DELTA Engine.'
    };
  }
  return {
    success: true,
    status: 'COMPLETED_EVALUATION',
    data: evalData
  };
}

// Register for Custom UI bridge calls (camelCase and kebab-case)
resolver.define('getSimulationStatus', async () => await getSimulationStatus());
resolver.define('get-simulation-status', async () => await getSimulationStatus());
resolver.define('evaluateInterventions', async () => await evaluateInterventions());
resolver.define('evaluate-interventions', async () => await evaluateInterventions());
resolver.define('saveSimulationRun', async (req) => await saveSimulationRun(req?.payload || req));
resolver.define('saveInterventionsEvaluation', async (req) => await saveInterventionsEvaluation(req?.payload || req));


// Decision Record KVS operations (Custom UI Bridge)
resolver.define('recordDecision', async (req) => {
  const payload = req?.payload || req;
  return await recordDecision(payload, null, req?.context);
});

resolver.define('getDecision', async (req) => {
  const decisionId = req?.payload?.decisionId || req?.payload || req?.decisionId;
  return await getDecision(decisionId);
});

resolver.define('listDecisions', async () => {
  return await listDecisions();
});

resolver.define('getDecisionForIssue', async (req) => {
  const issueKey = req?.payload?.issueKey || req?.payload || req?.issueKey;
  return await getDecisionForIssue(issueKey);
});

// JSM Field Dispatch Ticket Creation (Custom UI Bridge)
resolver.define('createDispatchTicket', async (req) => {
  const payload = req?.payload || req;
  return await createDispatchTicket(payload, {
    caller: req?.context?.accountId || req?.context?.principal?.accountId,
    context: req?.context
  });
});

resolver.define('dispatchFieldTeam', async (req) => {
  const payload = req?.payload || req;
  return await createDispatchTicket(payload, {
    caller: req?.context?.accountId || req?.context?.principal?.accountId,
    context: req?.context
  });
});

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
  const payload = event?.payload || {};

  switch (actionKey) {
    case 'get-simulation-status':
    case 'getSimulationStatus':
      return await getSimulationStatus();

    case 'evaluate-interventions':
    case 'evaluateInterventions':
      return await evaluateInterventions();

    case 'save-simulation-run':
    case 'saveSimulationRun':
      return await saveSimulationRun(payload);


    case 'get-decision-record':
    case 'getDecisionRecord':
    case 'getDecision':
      return await getDecision(payload.decisionId);

    case 'list-decision-records':
    case 'listDecisions':
      return await listDecisions();

    case 'record-decision':
    case 'recordDecision':
      return await recordDecision(payload, null, context);

    case 'dispatch-field-team':
    case 'createDispatchTicket':
      return await createDispatchTicket(payload, {
        caller: context?.accountId || context?.principal?.accountId,
        context
      });

    default:
      return {
        success: false,
        error: {
          code: 'UNRECOGNIZED_ACTION',
          message: `Action key '${actionKey}' is not supported by DELTA Hydraulic Advisor.`,
          supportedActions: [
            'get-simulation-status',
            'evaluate-interventions',
            'get-decision-record',
            'list-decision-records',
            'record-decision',
            'dispatch-field-team'
          ]
        }
      };
  }
}
