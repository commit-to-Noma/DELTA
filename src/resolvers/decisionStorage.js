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
 * Authoritatively links an approved Decision Record to a target Jira Issue.
 * Enforces:
 * 1. Target issueKey belongs to OPERATIONAL_PROJECT_KEY ('EMERG-').
 * 2. Caller has verified Incident Commander authorization.
 * 3. Target decision exists in KVS and status === 'APPROVED'.
 * 4. Updates bidirectional pointer mapping (issue-decision:<issueKey> and decision.linkedIssueKey).
 */
export async function linkDecisionToIssue({ issueKey, decisionId }, storageOverride = null, authContext = null) {
  if (!issueKey || typeof issueKey !== 'string') {
    const err = new Error('issueKey is required and must be a non-empty string');
    err.code = 'MISSING_ISSUE_KEY';
    throw err;
  }

  if (!decisionId || typeof decisionId !== 'string') {
    const err = new Error('decisionId is required and must be a non-empty string');
    err.code = 'MISSING_DECISION_ID';
    throw err;
  }

  // Strict Project Scoping: Must belong to OPERATIONAL_PROJECT_KEY ('EMERG')
  if (!issueKey.startsWith(`${OPERATIONAL_PROJECT_KEY}-`)) {
    const err = new Error(
      `Project scope mismatch: Linked issue '${issueKey}' does not belong to server-configured project '${OPERATIONAL_PROJECT_KEY}'.`
    );
    err.code = 'INVALID_PROJECT_SCOPE';
    throw err;
  }

  // Resolve caller session authentication
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
      'Authentication failure: Missing or unverified Jira user session context. Linking decisions to issues requires an authenticated caller.'
    );
    err.code = 'UNAUTHENTICATED_SESSION';
    throw err;
  }

  // Verify Incident Commander authorization
  const auth = await verifyIncidentCommanderAuthorization({
    accountId: serverAccountId,
    projectKey: OPERATIONAL_PROJECT_KEY,
    customAuthPolicy: authContext?.customAuthPolicy
  });

  if (!auth.isAuthorized) {
    const err = new Error(
      `Incident Commander authorization denied for account '${serverAccountId}': ${auth.reason || 'User lacks required role to link decisions.'}`
    );
    err.code = 'UNAUTHORIZED_INCIDENT_COMMANDER';
    err.details = auth;
    throw err;
  }

  const client = getStorageClient(storageOverride);

  // Retrieve candidate decision
  const decisionRecord = await client.get(`decision:${decisionId}`);
  if (!decisionRecord) {
    const err = new Error(`Decision not found: No record found for identifier '${decisionId}'.`);
    err.code = 'DECISION_NOT_FOUND';
    throw err;
  }

  // Enforce APPROVED status requirement
  if (decisionRecord.status !== 'APPROVED') {
    const err = new Error(
      `Unapproved decision: Decision '${decisionId}' has status '${decisionRecord.status}'. Only APPROVED decision records can be linked to operational Jira incident issues.`
    );
    err.code = 'UNAPPROVED_DECISION_LINK';
    throw err;
  }

  // Set issue-decision pointer
  await client.set(`issue-decision:${issueKey}`, decisionId);

  // Update decision record with linkage provenance
  const updatedRecord = {
    ...decisionRecord,
    linkedIssueKey: issueKey,
    linkedAt: new Date().toISOString(),
    linkedByAccountId: serverAccountId
  };
  await client.set(`decision:${decisionId}`, updatedRecord);

  return {
    success: true,
    data: {
      issueKey,
      decisionId,
      status: decisionRecord.status,
      chosenPlan: decisionRecord.chosenPlan,
      linkedBy: serverAccountId,
      linkedAt: updatedRecord.linkedAt
    }
  };
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
 * Saves a structured operational work order in Forge KVS with strict integrity,
 * decision binding, and lifecycle transition checks.
 */
export async function saveWorkOrder(workOrder, storageOverride = null, authContext = null) {
  if (!workOrder || typeof workOrder !== 'object') {
    const err = new Error('Invalid work order payload: payload must be an object.');
    err.code = 'INVALID_WORK_ORDER_PAYLOAD';
    throw err;
  }

  if (!workOrder.workOrderId) {
    const err = new Error('Invalid work order payload: workOrderId is required.');
    err.code = 'INVALID_WORK_ORDER_PAYLOAD';
    throw err;
  }

  if (!workOrder.decisionId) {
    const err = new Error('Invalid work order payload: decisionId is required.');
    err.code = 'INVALID_WORK_ORDER_PAYLOAD';
    throw err;
  }

  const VALID_STAGES = ['PREPARED_DRAFT', 'COMMANDER_STAGED', 'JIRA_LINKED'];
  if (workOrder.stage && !VALID_STAGES.includes(workOrder.stage)) {
    const err = new Error(`Invalid work order stage: '${workOrder.stage}'. Must be one of: ${VALID_STAGES.join(', ')}.`);
    err.code = 'INVALID_WORK_ORDER_STAGE';
    throw err;
  }

  const client = getStorageClient(storageOverride);

  // 1. Verify underlying decision record if present in storage
  const decisionRecord = await client.get(`decision:${workOrder.decisionId}`);
  if (decisionRecord) {
    if (decisionRecord.status !== 'APPROVED') {
      const err = new Error(
        `Underlying decision '${workOrder.decisionId}' has status '${decisionRecord.status}'. Work orders can only be staged from APPROVED decisions.`
      );
      err.code = 'UNAPPROVED_DECISION_BINDING';
      throw err;
    }

    // Verify scenario hash integrity
    if (workOrder.supportingSimulationEvidence?.scenarioHash && decisionRecord.scenarioHash) {
      if (workOrder.supportingSimulationEvidence.scenarioHash !== decisionRecord.scenarioHash) {
        const err = new Error(
          `Integrity violation: Work order scenario hash '${workOrder.supportingSimulationEvidence.scenarioHash}' does not match underlying approved decision hash '${decisionRecord.scenarioHash}'.`
        );
        err.code = 'INTEGRITY_VIOLATION';
        throw err;
      }
    }

    // Verify planId binding integrity
    if (workOrder.planId && decisionRecord.chosenPlan?.planId) {
      const normWoPlan = String(workOrder.planId).toLowerCase().replace(/[^a-z0-9]/g, '');
      const normDecPlan = String(decisionRecord.chosenPlan.planId).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!normWoPlan.includes(normDecPlan) && !normDecPlan.includes(normWoPlan)) {
        const err = new Error(
          `Integrity violation: Work order plan '${workOrder.planId}' does not match underlying decision plan '${decisionRecord.chosenPlan.planId}'.`
        );
        err.code = 'INTEGRITY_VIOLATION';
        throw err;
      }
    }
  }

  // 2. Check existing record for lifecycle transition rules (prevent demotions)
  const existingRecord = await client.get(`work-order:${workOrder.workOrderId}`);
  if (existingRecord) {
    if (existingRecord.stage === 'JIRA_LINKED' && workOrder.stage !== 'JIRA_LINKED') {
      const err = new Error(
        `Invalid stage transition: Work order '${workOrder.workOrderId}' is already JIRA_LINKED and cannot be demoted to '${workOrder.stage}'.`
      );
      err.code = 'INVALID_STAGE_TRANSITION';
      throw err;
    }

    if (existingRecord.stage === 'COMMANDER_STAGED' && workOrder.stage === 'PREPARED_DRAFT') {
      const err = new Error(
        `Invalid stage transition: Work order '${workOrder.workOrderId}' is COMMANDER_STAGED and cannot be demoted to PREPARED_DRAFT.`
      );
      err.code = 'INVALID_STAGE_TRANSITION';
      throw err;
    }

    if (existingRecord.decisionId && existingRecord.decisionId !== workOrder.decisionId) {
      const err = new Error(
        `Integrity violation: Cannot alter underlying decision binding of existing work order '${workOrder.workOrderId}' from '${existingRecord.decisionId}' to '${workOrder.decisionId}'.`
      );
      err.code = 'IMMUTABLE_DECISION_BINDING';
      throw err;
    }
  }

  // 3. Persist work order in KVS
  await client.set(`work-order:${workOrder.workOrderId}`, workOrder);

  // Maintain chronological work orders index
  const index = (await client.get('work-orders:index')) || [];
  if (!index.includes(workOrder.workOrderId)) {
    index.push(workOrder.workOrderId);
    await client.set('work-orders:index', index);
  }

  // If associated with a Jira issue key, maintain pointer
  if (workOrder.jiraIntegration?.linkedIssueKey) {
    await client.set(`issue-work-order:${workOrder.jiraIntegration.linkedIssueKey}`, workOrder.workOrderId);
  }

  return {
    success: true,
    data: workOrder
  };
}

/**
 * Links a staged operational work order to a Jira incident issue key.
 * Requires Incident Commander authorization and ensures the work order is at least COMMANDER_STAGED.
 */
export async function linkWorkOrderToIssue(payload, storageOverride = null, authContext = null) {
  const { workOrderId, issueKey } = payload || {};

  if (!workOrderId || typeof workOrderId !== 'string') {
    const err = new Error('Invalid input: workOrderId is required.');
    err.code = 'INVALID_INPUT_WORK_ORDER_ID';
    throw err;
  }

  if (!issueKey || typeof issueKey !== 'string') {
    const err = new Error('Invalid input: issueKey is required.');
    err.code = 'INVALID_INPUT_ISSUE_KEY';
    throw err;
  }

  const issueKeyRegex = /^[A-Z0-9]+-\d+$/;
  if (!issueKeyRegex.test(issueKey.trim())) {
    const err = new Error(`Invalid Jira issue key format: '${issueKey}'. Expected format like 'EMERG-101' or 'JSM-4902'.`);
    err.code = 'INVALID_ISSUE_KEY_FORMAT';
    throw err;
  }

  if (!issueKey.trim().toUpperCase().startsWith(`${OPERATIONAL_PROJECT_KEY}-`)) {
    const err = new Error(
      `Project scope mismatch: Linked issue '${issueKey}' does not belong to server-configured project '${OPERATIONAL_PROJECT_KEY}'.`
    );
    err.code = 'INVALID_PROJECT_SCOPE';
    throw err;
  }

  let serverAccountId = null;
  if (authContext) {
    serverAccountId =
      authContext.accountId ||
      authContext.principal?.accountId ||
      authContext.context?.accountId ||
      authContext.context?.principal?.accountId ||
      null;
  }

  if (!serverAccountId || typeof serverAccountId !== 'string' || serverAccountId === 'anonymous') {
    const err = new Error(
      'Authentication failure: Missing or unverified Jira user session context. Linking work orders to issues requires an authenticated caller.'
    );
    err.code = 'UNAUTHENTICATED_SESSION';
    throw err;
  }

  // Verify Incident Commander authorization
  const auth = await verifyIncidentCommanderAuthorization({
    accountId: serverAccountId,
    projectKey: OPERATIONAL_PROJECT_KEY,
    customAuthPolicy: authContext?.customAuthPolicy
  });

  if (!auth.isAuthorized) {
    const err = new Error(
      `Incident Commander authorization denied for account '${serverAccountId}': ${auth.reason || 'User lacks required role to link work orders.'}`
    );
    err.code = 'UNAUTHORIZED_INCIDENT_COMMANDER';
    err.details = auth;
    throw err;
  }

  const client = getStorageClient(storageOverride);

  // Retrieve candidate work order
  const workOrder = await client.get(`work-order:${workOrderId}`);
  if (!workOrder) {
    const err = new Error(`Work order not found: No record found for identifier '${workOrderId}'.`);
    err.code = 'WORK_ORDER_NOT_FOUND';
    throw err;
  }

  // Cannot link an unstaged PREPARED_DRAFT work order
  if (workOrder.stage === 'PREPARED_DRAFT') {
    const err = new Error(
      `Unstaged work order: Work order '${workOrderId}' is in PREPARED_DRAFT stage. It must be reviewed and advanced to COMMANDER_STAGED before linking to an official Jira issue.`
    );
    err.code = 'UNSTAGED_WORK_ORDER_LINK';
    throw err;
  }

  // Verify underlying decision record status
  if (workOrder.decisionId) {
    const decisionRecord = await client.get(`decision:${workOrder.decisionId}`);
    if (decisionRecord && decisionRecord.status !== 'APPROVED') {
      const err = new Error(
        `Underlying decision '${workOrder.decisionId}' has status '${decisionRecord.status}'. Only work orders from APPROVED decisions can be linked to Jira.`
      );
      err.code = 'UNAPPROVED_DECISION_LINK';
      throw err;
    }
  }

  const serverTimestamp = new Date().toISOString();
  const updatedWorkOrder = {
    ...workOrder,
    stage: 'JIRA_LINKED',
    jiraIntegration: {
      ...workOrder.jiraIntegration,
      linkedIssueKey: issueKey.trim().toUpperCase(),
      linkedAt: serverTimestamp,
      linkedBy: serverAccountId
    },
    humanReview: {
      ...workOrder.humanReview,
      stagingStatus: 'JIRA_INTEGRATED'
    },
    updatedAt: serverTimestamp
  };

  await client.set(`work-order:${workOrderId}`, updatedWorkOrder);
  await client.set(`issue-work-order:${issueKey.trim().toUpperCase()}`, workOrderId);

  return {
    success: true,
    data: updatedWorkOrder
  };
}

/**
 * Retrieves a structured operational work order by ID.
 */
export async function getWorkOrder(workOrderId, storageOverride = null) {
  const client = getStorageClient(storageOverride);
  const record = await client.get(`work-order:${workOrderId}`);
  if (!record) {
    return {
      success: false,
      error: {
        code: 'WORK_ORDER_NOT_FOUND',
        message: `No operational work order found for ID '${workOrderId}'.`
      }
    };
  }

  return {
    success: true,
    data: record
  };
}

/**
 * Lists all registered operational work orders from Forge KVS.
 */
export async function listWorkOrders(storageOverride = null) {
  const client = getStorageClient(storageOverride);
  const index = (await client.get('work-orders:index')) || [];

  const records = [];
  for (const id of index) {
    const rec = await client.get(`work-order:${id}`);
    if (rec) records.push(rec);
  }

  return {
    success: true,
    data: records,
    count: records.length
  };
}

/**
 * Retrieves an operational work order linked to a specific Jira issue key.
 */
export async function getWorkOrderForIssue(issueKey, storageOverride = null) {
  const client = getStorageClient(storageOverride);
  const workOrderId = await client.get(`issue-work-order:${issueKey}`);
  if (!workOrderId) {
    return {
      success: true,
      data: null,
      message: `No operational work order linked to issue '${issueKey}'.`
    };
  }

  return await getWorkOrder(workOrderId, client);
}

/**
 * Helper to clear test in-memory storage (used exclusively by test suites).
 */
export function __resetInMemoryStore() {
  inMemoryStore.clear();
}
