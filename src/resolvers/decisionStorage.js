/**
 * DELTA Decision Record Storage Engine
 * 
 * Implements immutable, append-only Key-Value Store (KVS) records for human-approved
 * hydraulic mitigation plans. Once written, a Decision Record (DEC-XXXX) cannot be
 * modified or overwritten, satisfying critical infrastructure provenance requirements.
 */

import { kvs as forgeKvs } from '@forge/kvs';

// Fallback in-memory map for environments where Forge KVS runtime fetch bridge is not bound (e.g. unit tests, local preview)
const inMemoryStore = new Map();

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
 * Validates the schema of a Decision Record candidate.
 */
export function validateDecisionPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid decision payload: payload must be a non-null object');
  }

  if (!payload.decisionId || typeof payload.decisionId !== 'string' || !/^DEC-[A-Za-z0-9-_]+$/.test(payload.decisionId)) {
    errors.push('decisionId must be a non-empty string starting with "DEC-"');
  }
  if (!payload.scenarioHash || typeof payload.scenarioHash !== 'string') {
    errors.push('scenarioHash must be a non-empty cryptographic/reproducible hash string');
  }
  if (!payload.baselineStorm || typeof payload.baselineStorm !== 'string') {
    errors.push('baselineStorm must specify the benchmark storm event');
  }
  if (!payload.chosenPlan || typeof payload.chosenPlan !== 'object') {
    errors.push('chosenPlan must be an object with planId, name, and tradeOffSummary');
  } else {
    if (!payload.chosenPlan.planId) errors.push('chosenPlan.planId is required');
    if (!payload.chosenPlan.name) errors.push('chosenPlan.name is required');
  }
  if (!payload.humanApprover || typeof payload.humanApprover !== 'object') {
    errors.push('humanApprover must be an object with displayName, role, and approvalTimestamp');
  } else {
    if (!payload.humanApprover.displayName) errors.push('humanApprover.displayName is required');
    if (!payload.humanApprover.role) errors.push('humanApprover.role is required');
    if (!payload.humanApprover.approvalTimestamp) errors.push('humanApprover.approvalTimestamp is required');
  }
  if (!payload.physicalMetrics || typeof payload.physicalMetrics !== 'object') {
    errors.push('physicalMetrics must be an object detailing hydrodynamic outcomes');
  }

  if (errors.length > 0) {
    const err = new Error(`Decision record validation failed: ${errors.join('; ')}`);
    err.code = 'INVALID_DECISION_PAYLOAD';
    err.details = errors;
    throw err;
  }
}

/**
 * Stores an immutable Decision Record into Forge KVS.
 * Rejects with an error if the record ID already exists (append-only enforcement).
 */
export async function recordDecision(payload, storageOverride = null) {
  validateDecisionPayload(payload);
  const client = getStorageClient(storageOverride);

  const storageKey = `decision:${payload.decisionId}`;
  
  // Immutability Check: Do not allow overwriting an existing record
  const existing = await client.get(storageKey);
  if (existing) {
    const err = new Error(`Immutable record violation: Decision '${payload.decisionId}' already exists and cannot be modified or overwritten.`);
    err.code = 'RECORD_IMMUTABLE_CONFLICT';
    throw err;
  }

  const record = {
    ...payload,
    status: payload.status || 'APPROVED',
    createdAt: new Date().toISOString(),
    schemaVersion: '1.0.0'
  };

  await client.set(storageKey, record);

  // Update index of all decision records
  const indexKey = 'decisions:index';
  const index = (await client.get(indexKey)) || [];
  if (!index.includes(payload.decisionId)) {
    index.push(payload.decisionId);
    await client.set(indexKey, index);
  }

  // If associated with a Jira Issue, link the issue to this decision
  if (payload.linkedIssueKey) {
    await client.set(`issue-decision:${payload.linkedIssueKey}`, payload.decisionId);
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
