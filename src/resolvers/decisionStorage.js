/**
 * DELTA Decision Record Storage Engine (Phase 5 Version 2.0.0)
 * 
 * ============================================================================
 * STORAGE ARCHITECTURE & CONCURRENCY MODEL SPECIFICATION
 * ============================================================================
 * 
 * 1. STORAGE ENGINE:
 *    - Backed by Atlassian Forge App Storage Key-Value Store (@forge/kvs).
 *    - In unit tests and standalone browser preview, uses an isolated in-memory
 *      Map client with identical asynchronous semantics.
 * 
 * 2. KEY SPACE & ACCESS PATTERNS:
 *    - `decision:<decisionId>`: Individual immutable decision record object.
 *    - `decisions:index`: Array of all registered decision IDs in chronological order.
 *    - `issue-decision:<issueKey>`: Pointer index mapping Jira Issue key -> decision ID.
 * 
 * 3. APPLICATION-LEVEL IMMUTABILITY:
 *    - Immutability is enforced at the application/resolver layer:
 *      Before writing a record to `decision:<decisionId>`, the client reads the key.
 *      If a record already exists, the write is aborted with code `RECORD_IMMUTABLE_CONFLICT`.
 *    - IMPORTANT DISCLAIMER (TRUTH GATE): This is an application-level audit ledger.
 *      It does NOT claim cryptographic blockchain immutability, hardware HSM signing,
 *      or tamper-proof physical storage.
 * 
 * 4. CONCURRENCY & LIMITATIONS:
 *    - Forge KVS operates on a Last-Write-Wins (LWW) key-level concurrency model.
 *    - Forge KVS does NOT provide multi-key distributed atomic transactions or
 *      compare-and-swap (CAS) primitives.
 *    - Failure mode: If the server terminates after writing `decision:<decisionId>`
 *      but before updating `decisions:index`, the individual record remains
 *      authoritatively retrievable via `getDecision(decisionId)`.
 * 
 * 5. SECURITY & CALLER IDENTITY BINDING:
 *    - Caller identity is derived strictly from trusted server-side execution context
 *      (`authContext.accountId` / `context.accountId`).
 *    - Client-supplied identity overrides are explicitly rejected (`APPROVER_AUTHENTICATION_MISMATCH`).
 *    - Caller role is verified against project-level Incident Commander policy.
 * ============================================================================
 */

import { kvs as forgeKvs } from '@forge/kvs';
import {
  verifyIncidentCommanderAuthorization,
  AUTHORIZATION_POLICY_NAME,
  OPERATIONAL_PROJECT_KEY
} from './authPolicy.js';
import { computeCanonicalScenarioHash } from './simulationValidation.js';

// Fallback in-memory map for environments where Forge KVS runtime fetch bridge is not bound (e.g. unit tests, local preview)
const inMemoryStore = new Map();

/**
 * Permitted intervention plans from the evaluated physical catalog.
 */
export const VALID_INTERVENTION_PLAN_IDS = ['plan-alpha', 'plan-beta', 'plan-gamma'];

/**
 * Returns the active storage client.
 * Uses Forge KVS in live Atlassian runtime; falls back to in-memory store in test/preview.
 */
export function getStorageClient(customClient = null) {
  if (customClient) return customClient;
  
  // Detect whether Forge runtime fetch is available
  const hasForgeRuntime = typeof globalThis !== 'undefined' && 
    (typeof globalThis.__forge_fetch__ === 'function' || typeof globalThis.__forge_local_fetch__ === 'function');
    
  if (hasForgeRuntime) {
    return forgeKvs;
  }

  return {
    async get(key) {
      return inMemoryStore.has(key) ? inMemoryStore.get(key) : undefined;
    },
    async set(key, value) {
      inMemoryStore.set(key, value);
    },
    async delete(key) {
      inMemoryStore.delete(key);
    },
    _isInMemory: true
  };
}

/**
 * Validates the schema and physical parameters of a Decision Record candidate.
 */
export function validateDecisionPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    const err = new Error('Invalid decision payload: payload must be a non-null object');
    err.code = 'INVALID_DECISION_PAYLOAD';
    throw err;
  }

  // decisionId: required string matching format
  if (!payload.decisionId || typeof payload.decisionId !== 'string' || !/^DEC-[A-Za-z0-9-_]+$/.test(payload.decisionId)) {
    errors.push('decisionId must be a non-empty string starting with "DEC-"');
  }

  // scenarioHash: required non-empty string
  if (!payload.scenarioHash || typeof payload.scenarioHash !== 'string' || payload.scenarioHash.trim().length === 0) {
    errors.push('scenarioHash must be a non-empty cryptographic/reproducible hash string');
  }

  // chosenPlan: required object
  if (!payload.chosenPlan || typeof payload.chosenPlan !== 'object' || Array.isArray(payload.chosenPlan)) {
    errors.push('chosenPlan must be an object specifying the chosen intervention');
  } else {
    if (!payload.chosenPlan.planId || typeof payload.chosenPlan.planId !== 'string') {
      errors.push('chosenPlan.planId is required');
    } else if (!VALID_INTERVENTION_PLAN_IDS.includes(payload.chosenPlan.planId)) {
      const err = new Error(`Invalid intervention plan: '${payload.chosenPlan.planId}' is not in the evaluated catalog (${VALID_INTERVENTION_PLAN_IDS.join(', ')}).`);
      err.code = 'INVALID_CHOSEN_PLAN';
      throw err;
    }
    if (!payload.chosenPlan.name || typeof payload.chosenPlan.name !== 'string' || payload.chosenPlan.name.trim().length === 0) {
      errors.push('chosenPlan.name is required');
    }
  }

  // humanApprover: if supplied by client, validate format (though server derives certified identity)
  if (payload.humanApprover !== undefined && payload.humanApprover !== null) {
    if (typeof payload.humanApprover !== 'object' || Array.isArray(payload.humanApprover)) {
      errors.push('humanApprover must be an object');
    }
  }

  // engineeringRationale: required human approval justification in Phase 5
  const rationale = payload.engineeringRationale || payload.notes || payload.chosenPlan?.tradeOffSummary;
  const isLegacyV1 = payload.baselineStorm && payload.schemaVersion !== '2.0.0' && payload.engineeringRationale === undefined;

  if (!isLegacyV1) {
    if (!rationale || typeof rationale !== 'string' || rationale.trim().length === 0) {
      errors.push('Human engineering rationale is required for Incident Commander approval (missing engineeringRationale)');
    }
  }

  // Scenario integrity re-validation if canonicalScenario is supplied
  if (payload.canonicalScenario && typeof payload.canonicalScenario === 'object') {
    const { scenarioHash: recomputedHash } = computeCanonicalScenarioHash(payload.canonicalScenario);
    if (payload.scenarioHash && payload.scenarioHash !== recomputedHash) {
      const err = new Error(
        `Scenario integrity failure: Client-supplied scenarioHash ('${payload.scenarioHash}') does not match canonical recomputed hash ('${recomputedHash}').`
      );
      err.code = 'SCENARIO_HASH_MISMATCH';
      throw err;
    }
  }

  if (errors.length > 0) {
    const err = new Error(`Decision record validation failed: ${errors.join('; ')}`);
    const isOnlyRationale = errors.length === 1 && errors[0].includes('engineeringRationale');
    err.code = isOnlyRationale ? 'MISSING_RATIONALE' : 'INVALID_DECISION_PAYLOAD';
    err.details = errors;
    throw err;
  }
}

/**
 * Stores an immutable Decision Record into Forge KVS.
 * Rejects with RECORD_IMMUTABLE_CONFLICT if the record ID already exists (append-only enforcement).
 * 
 * Enforces server-side authorization: requires explicit Incident Commander authority.
 */
export async function recordDecision(payload, storageOverride = null, authContext = null) {
  // 1. Resolve Server-side Authorization & Identity Binding (Strict Forge invocation context object)
  let serverAccountId = null;
  if (authContext && typeof authContext === 'object') {
    serverAccountId =
      authContext.accountId ||
      authContext.principal?.accountId ||
      authContext.context?.accountId ||
      authContext.context?.principal?.accountId ||
      null;
  }

  if (!serverAccountId || typeof serverAccountId !== 'string' || serverAccountId === 'anonymous') {
    const err = new Error(
      'Authentication failure: Missing or unverified Jira user identity in server invocation context. Client-provided account IDs are strictly rejected.'
    );
    err.code = 'UNAUTHENTICATED_SESSION';
    throw err;
  }

  // Reject client-supplied approver identity spoofing
  const clientAccountId = payload?.humanApprover?.accountId;
  if (clientAccountId && clientAccountId !== serverAccountId) {
    const err = new Error(
      `Approver authentication mismatch: Client humanApprover accountId ('${clientAccountId}') does not match authenticated server session accountId ('${serverAccountId}').`
    );
    err.code = 'APPROVER_AUTHENTICATION_MISMATCH';
    throw err;
  }

  // 2. Strict Project Scoping: Must be OPERATIONAL_PROJECT_KEY ('EMERG')
  if (payload?.linkedIssueKey && !payload.linkedIssueKey.startsWith(`${OPERATIONAL_PROJECT_KEY}-`)) {
    const err = new Error(
      `Project scope mismatch: Linked issue '${payload.linkedIssueKey}' does not belong to server-configured project '${OPERATIONAL_PROJECT_KEY}'. Client attempts to override project key are forbidden.`
    );
    err.code = 'INVALID_PROJECT_SCOPE';
    throw err;
  }

  // 3. Server-generated decisionId if omitted by client
  const decisionId = payload?.decisionId || `DEC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const payloadToValidate = payload?.decisionId ? payload : { ...payload, decisionId };

  // 4. Schema & Canonical Scenario Validation
  validateDecisionPayload(payloadToValidate);

  const client = getStorageClient(storageOverride);
  const storageKey = `decision:${decisionId}`;
  
  // 5. Immutability Check: Do not allow overwriting an existing record
  const existing = await client.get(storageKey);
  if (existing) {
    const err = new Error(`Immutable record violation: Decision '${decisionId}' already exists and cannot be modified or overwritten.`);
    err.code = 'RECORD_IMMUTABLE_CONFLICT';
    throw err;
  }

  // 6. Verify Incident Commander Authorization Policy
  const auth = await verifyIncidentCommanderAuthorization({
    accountId: serverAccountId,
    projectKey: OPERATIONAL_PROJECT_KEY,
    customAuthPolicy: authContext?.customAuthPolicy
  });

  if (!auth.isAuthorized) {
    const err = new Error(
      `Incident Commander authorization denied for account '${serverAccountId}': ${auth.reason || 'User lacks required role.'}`
    );
    err.code = 'UNAUTHORIZED_INCIDENT_COMMANDER';
    err.details = auth;
    throw err;
  }

  // 7. Enforce Server-Certified Approver Identity (Client cannot spoof role or timestamp)
  const serverTimestamp = new Date().toISOString();
  const verifiedApprover = {
    displayName: payload.humanApprover?.displayName || 'Incident Commander',
    accountId: serverAccountId,
    role: 'Incident Commander',
    authorizationPolicy: auth.policy || AUTHORIZATION_POLICY_NAME,
    approvalTimestamp: serverTimestamp,
    verifiedAt: serverTimestamp
  };

  const engineeringRationale = payload.engineeringRationale || payload.notes || payload.chosenPlan?.tradeOffSummary || '';

  // Canonical scenario computation if not already bound
  let canonicalScenario = payload.canonicalScenario;
  let authoritativeHash = payload.scenarioHash;
  if (canonicalScenario) {
    const canonicalRes = computeCanonicalScenarioHash(canonicalScenario);
    canonicalScenario = canonicalRes.canonicalScenario;
    authoritativeHash = canonicalRes.scenarioHash;
  }

  // 8. Build Authoritative Phase 5 Record
  const record = {
    ...payload,
    decisionId,
    schemaVersion: payload.schemaVersion || '2.0.0',
    status: payload.status || 'APPROVED',
    createdAt: serverTimestamp,
    humanApprover: verifiedApprover,
    engineeringRationale,
    scenarioHash: authoritativeHash,
    canonicalScenario: canonicalScenario || null,
    chosenPlan: {
      ...payload.chosenPlan,
      planId: payload.chosenPlan.planId,
      name: payload.chosenPlan.name
    },
    baselineMetrics: payload.baselineMetrics || payload.physicalMetrics || null,
    interventionMetrics: payload.interventionMetrics || null,
    differentialMetrics: payload.differentialMetrics || null,
    evaluationReference: payload.evaluationReference || payload.scenarioId || null
  };

  // 9. Persist to Forge KVS
  await client.set(storageKey, record);

  // 10. Update decisions:index
  const indexKey = 'decisions:index';
  const index = (await client.get(indexKey)) || [];
  if (!index.includes(decisionId)) {
    index.push(decisionId);
    await client.set(indexKey, index);
  }

  // 11. Optional Jira issue linking
  if (payload.linkedIssueKey) {
    await client.set(`issue-decision:${payload.linkedIssueKey}`, decisionId);
  }

  return {
    success: true,
    data: record
  };
}

/**
 * Retrieves a Decision Record by its decisionId.
 */
export async function getDecision(decisionId, storageOverride = null) {
  if (!decisionId) {
    return { success: false, error: { code: 'MISSING_ID', message: 'decisionId is required' } };
  }
  const client = getStorageClient(storageOverride);
  const record = await client.get(`decision:${decisionId}`);

  if (!record) {
    return {
      success: false,
      error: {
        code: 'DECISION_NOT_FOUND',
        message: `No decision record found for identifier '${decisionId}'.`
      }
    };
  }

  return {
    success: true,
    data: record
  };
}

/**
 * Retrieves the Decision Record associated with a specific Jira Issue Key.
 */
export async function getDecisionForIssue(issueKey, storageOverride = null) {
  if (!issueKey) {
    return { success: false, error: { code: 'MISSING_ISSUE_KEY', message: 'issueKey is required' } };
  }
  const client = getStorageClient(storageOverride);
  const decisionId = await client.get(`issue-decision:${issueKey}`);

  if (!decisionId) {
    return {
      success: false,
      error: {
        code: 'NO_DECISION_FOR_ISSUE',
        message: `No approved decision record has been linked to Jira issue '${issueKey}'.`
      }
    };
  }

  return await getDecision(decisionId, client);
}

/**
 * Lists all recorded decision identifiers and summaries.
 */
export async function listDecisions(storageOverride = null) {
  const client = getStorageClient(storageOverride);
  const index = (await client.get('decisions:index')) || [];
  
  const records = [];
  for (const id of index) {
    const rec = await client.get(`decision:${id}`);
    if (rec) records.push(rec);
  }

  return {
    success: true,
    data: records,
    count: records.length
  };
}

/**
 * Helper to clear test in-memory storage (used exclusively by test suites).
 */
export function __resetInMemoryStore() {
  inMemoryStore.clear();
}
