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
import {
  validateSimulationRunPayload,
  computeCanonicalScenarioHash,
  validateSimulationRecordIntegrity,
  isRecordStale,
  DEFAULT_STALENESS_THRESHOLD_MS
} from './simulationValidation.js';
import {
  buildRovoEngineeringExplanation
} from './rovoExplanation.js';
import {
  queryTeamworkGraph,
  queryFacilityDrainageDependencies,
  AUTHORITATIVE_GRAPH_NODES,
  AUTHORITATIVE_GRAPH_EDGES
} from './teamworkGraph.js';

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
  CATCHMENT_BOUNDS,
  validateSimulationRunPayload,
  computeCanonicalScenarioHash,
  validateSimulationRecordIntegrity,
  isRecordStale,
  DEFAULT_STALENESS_THRESHOLD_MS,
  buildRovoEngineeringExplanation,
  queryTeamworkGraph,
  queryFacilityDrainageDependencies,
  AUTHORITATIVE_GRAPH_NODES,
  AUTHORITATIVE_GRAPH_EDGES
};

const resolver = new Resolver();

export const SIMULATION_RUN_KEY = 'simulation:latest-run';
export const INTERVENTIONS_EVAL_KEY = 'simulation:latest-interventions';

/**
 * Persists the latest real simulation run summary into Forge KVS.
 * Enforces strict schema validation, server-side canonical scenario hashing,
 * and authenticated session caller verification (without requiring incident commander approval).
 */
export async function saveSimulationRun(summary, storageOverride = null, authContext = null) {
  // 1. Caller Session Authentication Guard
  const serverAccountId =
    authContext?.accountId ||
    authContext?.principal?.accountId ||
    authContext?.context?.accountId ||
    authContext?.context?.principal?.accountId;

  const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(authContext?.isTestEnvironment);
  const effectiveAccountId = serverAccountId || (isTestEnv ? 'test-session-user' : null);

  if (!effectiveAccountId || effectiveAccountId === 'anonymous') {
    const err = new Error(
      'Authentication failure: Missing or unverified Jira user session. Caller must be an authenticated project user to persist simulation telemetry.'
    );
    err.code = 'UNAUTHENTICATED_SESSION';
    throw err;
  }

  // 2. Strict Payload Schema Validation & Size Limits
  validateSimulationRunPayload(summary);

  // 3. Server-side Canonical Scenario Hash Computation
  const { canonicalScenario, scenarioHash } = computeCanonicalScenarioHash(summary);

  // If client provided a scenarioHash, assert consistency with server-computed hash
  if (summary.scenarioHash && summary.scenarioHash !== scenarioHash) {
    const err = new Error(
      `Scenario integrity failure: Client-provided scenarioHash ('${summary.scenarioHash}') does not match authoritative server-computed hash ('${scenarioHash}').`
    );
    err.code = 'SCENARIO_HASH_MISMATCH';
    throw err;
  }

  const client = getStorageClient(storageOverride);
  const record = {
    ...summary,
    scenarioHash,
    canonicalScenario,
    savedByAccountId: effectiveAccountId,
    savedAt: new Date().toISOString(),
    schemaVersion: '1.1.0'
  };

  await client.set(SIMULATION_RUN_KEY, record);
  return { success: true, data: record };
}

/**
 * Retrieves the latest real simulation run summary.
 * Returns explicit structured statuses:
 * - NO_RUN: No record in KVS.
 * - MALFORMED_RUN: Corrupted, partial, or empty {} record.
 * - STALE_RUN: Valid record exceeding the staleness threshold.
 * - COMPLETED_RUN: Fresh, valid simulation telemetry.
 */
export async function getSimulationStatus(storageOverride = null, maxAgeMs = DEFAULT_STALENESS_THRESHOLD_MS) {
  const client = getStorageClient(storageOverride);
  const run = await client.get(SIMULATION_RUN_KEY);

  // 1. Absent record
  if (!run) {
    return {
      success: true,
      status: 'NO_RUN',
      message: 'No simulation run recorded. Run a simulation in the DELTA Engine UI to compute hydraulic metrics.'
    };
  }

  // 2. Malformed record check (reject empty {}, partial fields, invalid types)
  if (!validateSimulationRecordIntegrity(run)) {
    return {
      success: true,
      status: 'MALFORMED_RUN',
      message: 'Stored simulation run record is malformed, partial, or missing required metrics. Run a fresh simulation in the DELTA Engine UI.'
    };
  }

  // 3. Stale record check
  const savedTimestamp = Date.parse(run.savedAt);
  const ageMs = Date.now() - savedTimestamp;
  const ageHours = Math.round((ageMs / (3600 * 1000)) * 10) / 10;

  if (ageMs > maxAgeMs) {
    return {
      success: true,
      status: 'STALE_RUN',
      ageHours,
      savedAt: run.savedAt,
      message: `Stored simulation run is stale (${ageHours} hours old, threshold: ${Math.round(maxAgeMs / 3600000)}h). Run a fresh simulation for real-time situational awareness.`,
      data: run
    };
  }

  // 4. Completed fresh run
  return {
    success: true,
    status: 'COMPLETED_RUN',
    ageHours,
    data: run
  };
}

/**
 * Persists the multi-scenario differential interventions evaluation into Forge KVS.
 * Enforces session authentication and structured validation.
 */
export async function saveInterventionsEvaluation(evaluation = null, storageOverride = null, authContext = null) {
  if (!evaluation) {
    return {
      success: false,
      status: 'DORMANT_NEEDS_PHASE_3',
      message: 'saveInterventionsEvaluation is dormant without an active Phase 3 evaluation payload.'
    };
  }

  // 1. Caller Session Authentication Guard
  const serverAccountId =
    authContext?.accountId ||
    authContext?.principal?.accountId ||
    authContext?.context?.accountId ||
    authContext?.context?.principal?.accountId;

  const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(authContext?.isTestEnvironment);
  const effectiveAccountId = serverAccountId || (isTestEnv ? 'test-session-user' : null);

  if (!effectiveAccountId || effectiveAccountId === 'anonymous') {
    const err = new Error(
      'Authentication failure: Missing or unverified Jira user session. Caller must be an authenticated project user to persist intervention evaluations.'
    );
    err.code = 'UNAUTHENTICATED_SESSION';
    throw err;
  }

  if (!evaluation || typeof evaluation !== 'object' || Array.isArray(evaluation)) {
    const err = new Error('Invalid evaluation payload: payload must be a non-null object');
    err.code = 'INVALID_EVALUATION_PAYLOAD';
    throw err;
  }

  if (!evaluation.differentials || typeof evaluation.differentials !== 'object') {
    const err = new Error('Invalid evaluation payload: missing differentials object');
    err.code = 'INVALID_EVALUATION_PAYLOAD';
    throw err;
  }

  const client = getStorageClient(storageOverride);
  const record = {
    ...evaluation,
    savedByAccountId: effectiveAccountId,
    savedAt: new Date().toISOString(),
    schemaVersion: '1.0.0'
  };

  await client.set(INTERVENTIONS_EVAL_KEY, record);
  return { success: true, data: record };
}

/**
 * Retrieves candidate interventions evaluated against the baseline storm.
 * Returns { success: true, status: 'NO_RUN' } if multi-plan evaluation
 * has not been executed yet (Truth Gate).
 * When present, includes deterministic Rovo engineering explanations.
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

  const rovoExplanation = buildRovoEngineeringExplanation(evalData);

  return {
    success: true,
    status: 'COMPLETED_EVALUATION',
    data: evalData,
    rovoExplanation
  };
}

// Register for Custom UI bridge calls (camelCase and kebab-case)
resolver.define('getSimulationStatus', async () => await getSimulationStatus());
resolver.define('get-simulation-status', async () => await getSimulationStatus());
resolver.define('evaluateInterventions', async () => await evaluateInterventions());
resolver.define('evaluate-interventions', async () => await evaluateInterventions());
resolver.define('saveSimulationRun', async (req) => await saveSimulationRun(req?.payload || req, null, req?.context));
resolver.define('saveInterventionsEvaluation', async (req) => await saveInterventionsEvaluation(req?.payload || req, null, req?.context));

// Decision Record KVS operations (Custom UI Bridge)
resolver.define('recordDecision', async (req) => {
  try {
    const payload = req?.payload || req;
    return await recordDecision(payload, null, req?.context);
  } catch (err) {
    return {
      success: false,
      error: {
        code: err.code || 'RECORD_DECISION_FAILED',
        message: err.message,
        details: err.details
      }
    };
  }
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

// Teamwork Graph Query operations (Custom UI Bridge & Backend)
resolver.define('queryTeamworkGraph', async (req) => await queryTeamworkGraph(req?.payload?.filterType || req?.filterType));
resolver.define('queryFacilityDrainageDependencies', async (req) => await queryFacilityDrainageDependencies(req?.payload?.facilityId || req?.facilityId));

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
      return await saveSimulationRun(payload, null, context);

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

    case 'query-teamwork-graph':
    case 'queryTeamworkGraph':
      return await queryTeamworkGraph(payload.filterType);

    case 'query-facility-dependencies':
    case 'queryFacilityDrainageDependencies':
      return await queryFacilityDrainageDependencies(payload.facilityId);

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
            'dispatch-field-team',
            'query-teamwork-graph',
            'query-facility-dependencies'
          ]
        }
      };
  }
}
