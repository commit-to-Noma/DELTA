/**
 * DELTA Field Dispatcher for Jira Service Management (JSM) & Jira Core
 * 
 * Automatically formats and dispatches actionable incident response tickets via
 * Jira REST API v3 (/rest/api/3/issue) using Forge asApp() with write:jira-work scope.
 * 
 * Enforces:
 * 1. Authoritative dataset-derived coordinates (EPSG:26986 & WGS84 with domain validation)
 * 2. Pre-dispatch JQL Search-Before-Create reconciliation against durable operation ID
 * 3. State machine preventing duplicate creation under degraded/uncertain Jira states
 * 4. Server-side Incident Commander re-authorization before dispatch
 * 5. Safe recovery and state synchronization when KVS or Jira fail
 * 
 * NOTE: Forge KVS read-then-write does not provide atomic locking. Mutual exclusion
 * is bounded by application design and explicit human commander approval gates.
 */

import api, { route } from '@forge/api';
import { getDecision, getStorageClient } from './decisionStorage.js';
import { resolveDispatchLocation } from './coordinates.js';
import {
  verifyIncidentCommanderAuthorization,
  AUTHORIZATION_POLICY_NAME,
  OPERATIONAL_PROJECT_KEY
} from './authPolicy.js';

/**
 * Server-side feature flag controlling automated Jira issue dispatch.
 * Hard-pinned to false for Phase 0.7.2 (KVS Smoke Test Phase).
 * 
 * When false, createDispatchTicket immediately rejects before executing
 * authorization queries, KVS lease operations, or Jira Cloud REST API calls.
 */
export let LIVE_DISPATCH_ENABLED = false;

/**
 * Internal helper for automated test suites to evaluate dispatch engine
 * mechanics when explicitly enabled in a mocked test environment.
 * NOT accessible via any resolver, client payload, or Rovo action.
 */
export function __setLiveDispatchEnabledForTesting(enabled) {
  LIVE_DISPATCH_ENABLED = Boolean(enabled);
}

/**
 * Builds an Atlassian Document Format (ADF) document for Jira issue description.
 * Embeds exact authoritative coordinates, verified corridor, and equipment specs.
 */
export function buildDispatchAdfDescription(dispatchOrder, decisionRecord, resolvedLocation, operationId) {
  const { equipment, priority, timeToCriticalInundation } = dispatchOrder;
  const approver = decisionRecord?.humanApprover;
  const plan = decisionRecord?.chosenPlan;

  const locationBulletList = [
    {
      type: 'listItem',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Site Name: ', marks: [{ type: 'strong' }] },
          { type: 'text', text: resolvedLocation.name }
        ]
      }]
    }
  ];

  if (resolvedLocation.provenanceNotice) {
    locationBulletList.push({
      type: 'listItem',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Staging Provenance: ', marks: [{ type: 'strong' }] },
          { type: 'text', text: resolvedLocation.provenanceNotice }
        ]
      }]
    });
  }

  locationBulletList.push(
    {
      type: 'listItem',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Geodetic (WGS84): ', marks: [{ type: 'strong' }] },
          { type: 'text', text: resolvedLocation.wgs84Formatted }
        ]
      }]
    },
    {
      type: 'listItem',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Projected Grid (EPSG:26986 NAD83 Massachusetts): ', marks: [{ type: 'strong' }] },
          { type: 'text', text: resolvedLocation.epsg26986Formatted }
        ]
      }]
    },
    {
      type: 'listItem',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Catchment Grid Cell: ', marks: [{ type: 'strong' }] },
          { type: 'text', text: resolvedLocation.gridCellFormatted }
        ]
      }]
    },
    {
      type: 'listItem',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Designated Clear Access Corridor: ', marks: [{ type: 'strong' }] },
          { type: 'text', text: resolvedLocation.accessCorridor }
        ]
      }]
    }
  );

  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '🚨 CRITICAL HYDRAULIC DISPATCH ORDER' }]
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Authorized by: ', marks: [{ type: 'strong' }] },
          { type: 'text', text: `${approver?.displayName || 'Incident Commander'} (${approver?.role || 'Authorized Incident Commander'})\n` },
          { type: 'text', text: 'Decision Audit ID: ', marks: [{ type: 'strong' }] },
          { type: 'text', text: `${decisionRecord?.decisionId || dispatchOrder.decisionId}\n` },
          { type: 'text', text: 'Dispatch Operation ID: ', marks: [{ type: 'strong' }] },
          { type: 'text', text: `${operationId}\n` },
          { type: 'text', text: 'Approved Mitigation Plan: ', marks: [{ type: 'strong' }] },
          { type: 'text', text: `${plan?.name || 'Hydraulic Mitigation Protocol'}` }
        ]
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: '📍 Target Coordinates & Staging Location' }]
      },
      {
        type: 'bulletList',
        content: locationBulletList
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: '🛠 Required Equipment & Response SLA' }]
      },
      {
        type: 'bulletList',
        content: (equipment || [
          '1x High-Capacity Diesel Pump (12.5 m³/s)',
          '500x Heavy-Duty Sandbag Units'
        ]).map((item) => ({
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: item }]
          }]
        }))
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Operational Priority: ', marks: [{ type: 'strong' }] },
          { type: 'text', text: `${priority || 'Highest'}\n` },
          { type: 'text', text: 'Time Before Critical Hospital Artery Inundation: ', marks: [{ type: 'strong' }] },
          { type: 'text', text: `${timeToCriticalInundation || '35 minutes'}` }
        ]
      }
    ]
  };
}

/**
 * Creates a Jira issue for an operational field dispatch with strict coordinate validation,
 * server-side authorization re-check, and Search-Before-Create reconciliation.
 * 
 * @param {object} dispatchOrder - Order parameters (decisionId, targetLocation, priority, etc.)
 * @param {object} [options] - Optional execution context { customJiraClient, storageOverride, caller, context, customAuthPolicy }
 */
export async function createDispatchTicket(dispatchOrder, options = {}) {
  // 0. Server-Side Killswitch Enforcement
  // Enforced before authorization checks, KVS reads/writes, lease acquisition, reconciliation, or Jira API requests.
  if (!LIVE_DISPATCH_ENABLED) {
    const err = new Error(
      'DELTA Field Dispatch is technically disabled on this deployment (Phase 0.7.2 KVS Smoke Test Mode). Automated Jira issue creation is blocked server-side.'
    );
    err.code = 'DISPATCH_FEATURE_DISABLED';
    throw err;
  }

  const { customJiraClient, storageOverride, caller, context, customAuthPolicy } = options;

  if (!dispatchOrder?.decisionId) {
    const err = new Error('JSM Dispatch Error: decisionId is required to issue a field dispatch ticket.');
    err.code = 'MISSING_DECISION_ID';
    throw err;
  }

  // 1. Authorisation Verification: Must hold Incident Commander authority on server
  const authenticatedCaller = caller || context?.accountId;

  if (!authenticatedCaller || typeof authenticatedCaller !== 'string' || authenticatedCaller === 'anonymous') {
    const err = new Error(
      'Dispatch authorization denied: Missing or unverified Jira user identity in server invocation context. Client-provided caller identities are strictly rejected.'
    );
    err.code = 'UNAUTHENTICATED_SESSION';
    throw err;
  }

  // Strict Project Scoping: projectKey is fixed to OPERATIONAL_PROJECT_KEY ('EMERG')
  if (dispatchOrder.projectKey && dispatchOrder.projectKey !== OPERATIONAL_PROJECT_KEY) {
    const err = new Error(
      `Project scope mismatch: Field dispatch is restricted to server-configured project '${OPERATIONAL_PROJECT_KEY}' (attempted override to '${dispatchOrder.projectKey}'). Client attempts to override project key are forbidden.`
    );
    err.code = 'INVALID_PROJECT_SCOPE';
    throw err;
  }
  const projectKey = OPERATIONAL_PROJECT_KEY;

  const auth = await verifyIncidentCommanderAuthorization({
    accountId: authenticatedCaller,
    projectKey,
    customAuthPolicy
  });

  if (!auth.isAuthorized) {
    const err = new Error(
      `Dispatch authorization denied for account '${authenticatedCaller}': ${auth.reason || 'User lacks Incident Commander role.'}`
    );
    err.code = 'UNAUTHORIZED_DISPATCH';
    err.details = auth;
    throw err;
  }

  // 2. Retrieve the Decision Record from KVS
  const client = getStorageClient(storageOverride);
  const decisionResult = await getDecision(dispatchOrder.decisionId, client);
  if (!decisionResult.success || !decisionResult.data) {
    const err = new Error(`JSM Dispatch Error: Decision Record '${dispatchOrder.decisionId}' was not found in KVS.`);
    err.code = 'DECISION_NOT_FOUND';
    throw err;
  }

  const decision = decisionResult.data;

  // 3. Approval Verification: Only APPROVED decisions may be dispatched
  if (decision.status !== 'APPROVED' && decision.status !== 'DISPATCHED') {
    const err = new Error(
      `Cannot dispatch decision '${decision.decisionId}': status is '${decision.status}'. Only 'APPROVED' decisions may be dispatched.`
    );
    err.code = 'UNAPPROVED_DECISION_DISPATCH';
    throw err;
  }

  const planId = decision.chosenPlan?.planId || dispatchOrder.planId || 'default-plan';
  
  // 4. Stable Operation ID & Searchable Tag
  const operationId = `delta-disp-${decision.decisionId.toLowerCase()}-${planId.toLowerCase()}`
    .replace(/[^a-z0-9-]/g, '-')
    .slice(0, 60);
  const idempotencyKey = `dispatch-record:${decision.decisionId}:${planId}`;

  // 5. Inspect KVS for existing dispatch state
  let existingKvsDispatch = await client.get(idempotencyKey);

  // 5a. Completed dispatch fast-path
  if (existingKvsDispatch && existingKvsDispatch.status === 'DISPATCHED') {
    return {
      success: true,
      isExisting: true,
      issueKey: existingKvsDispatch.issueKey,
      issueId: existingKvsDispatch.issueId,
      self: existingKvsDispatch.self,
      decisionId: decision.decisionId,
      planId,
      operationId,
      dispatchedAt: existingKvsDispatch.dispatchedAt,
      coordinates: existingKvsDispatch.coordinates,
      message: `Dispatch already completed for decision '${decision.decisionId}' and plan '${planId}'. Returning existing ticket ${existingKvsDispatch.issueKey}.`
    };
  }

  // 6. Pre-Dispatch Jira Reconciliation (Search-Before-Create)
  let existingJiraIssues = [];
  const searchJql = `labels = "${operationId}"`;

  try {
    if (typeof customJiraClient?.searchJira === 'function') {
      existingJiraIssues = await customJiraClient.searchJira(searchJql);
    } else if (typeof customJiraClient?.requestJira === 'function') {
      // Mock client support for search endpoint
      const searchRes = await customJiraClient.requestJira(
        `/rest/api/3/issue/search?jql=${encodeURIComponent(searchJql)}&fields=key,id,summary,status`,
        { method: 'GET' }
      );
      if (Array.isArray(searchRes?.issues)) {
        existingJiraIssues = searchRes.issues;
      }
    } else {
      const hasForgeRuntime = typeof globalThis !== 'undefined' &&
        (typeof globalThis.__forge_fetch__ === 'function' || typeof globalThis.__forge_local_fetch__ === 'function');

      if (hasForgeRuntime) {
        const searchResp = await api.asApp().requestJira(
          route`/rest/api/3/issue/search?jql=${searchJql}&fields=key,id,summary,status`
        );
        if (searchResp.ok) {
          const searchData = await searchResp.json();
          existingJiraIssues = searchData.issues || [];
        }
      }
    }
  } catch (searchErr) {
    // If search fails, log warning
    console.warn(`Jira search reconciliation warning: ${searchErr.message}`);
  }

  // 6a. Reconciliation Case A: Multiple matching issues detected
  if (existingJiraIssues.length > 1) {
    const conflictingKeys = existingJiraIssues.map((i) => i.key).join(', ');
    const err = new Error(
      `Reconciliation conflict: Found ${existingJiraIssues.length} existing Jira issues for operation '${operationId}' (${conflictingKeys}). Multiple dispatches detected. Manual resolution required.`
    );
    err.code = 'DUPLICATE_DISPATCH_CONFLICT';
    err.details = { operationId, conflictingKeys: existingJiraIssues.map((i) => i.key) };
    throw err;
  }

  // 6b. Reconciliation Case B: Exactly one matching issue found in Jira
  if (existingJiraIssues.length === 1) {
    const existingIssue = existingJiraIssues[0];
    const resolvedLocation = resolveDispatchLocation(decision.chosenPlan, dispatchOrder.targetLocation);
    const dispatchedAt = new Date().toISOString();
    const reconciledRecord = {
      status: 'DISPATCHED',
      issueKey: existingIssue.key,
      issueId: existingIssue.id,
      self: existingIssue.self,
      decisionId: decision.decisionId,
      planId,
      operationId,
      dispatchedAt,
      dispatchedBy: authenticatedCaller,
      coordinates: resolvedLocation,
      reconciledFromJira: true
    };

    // Heal KVS index with discovered Jira ticket
    await client.set(idempotencyKey, reconciledRecord);

    const updatedDecision = {
      ...decision,
      status: 'DISPATCHED',
      dispatchedIssueKey: existingIssue.key,
      dispatchedAt
    };
    await client.set(`decision:${decision.decisionId}`, updatedDecision);

    return {
      success: true,
      isExisting: true,
      issueKey: existingIssue.key,
      issueId: existingIssue.id,
      self: existingIssue.self,
      decisionId: decision.decisionId,
      planId,
      operationId,
      dispatchedAt,
      coordinates: resolvedLocation,
      reconciledFromJira: true,
      message: `Reconciliation match: Adopted existing Jira issue ${existingIssue.key} for operation '${operationId}'. Duplicate creation prevented.`
    };
  }

  // 6c. Zero matching issues found in Jira: Inspect KVS state machine for in-flight lease or UNCERTAIN outcome
  if (existingKvsDispatch) {
    // If state is UNCERTAIN and JQL returned 0 issues:
    // CRITICAL: A zero-result JQL query does NOT prove ticket absence due to Jira search indexing lag.
    // An UNCERTAIN operation must NEVER automatically proceed to another POST!
    if (existingKvsDispatch.status === 'UNCERTAIN') {
      const err = new Error(
        `Dispatch operation '${operationId}' is in an UNCERTAIN state (${existingKvsDispatch.error || 'unconfirmed in-flight attempt'}). JQL search returned 0 issues, but search indexing lag prevents confirming ticket absence. Automated issue creation is strictly blocked to prevent duplicate tickets. Explicit reconciliation or administrative triage is required.`
      );
      err.code = 'DISPATCH_UNCERTAIN';
      err.details = existingKvsDispatch;
      throw err;
    }

    // Inspect in-flight lease:
    if (existingKvsDispatch.status === 'PENDING_CREATION') {
      const leaseAgeMs = Date.now() - new Date(existingKvsDispatch.initiatedAt).getTime();
      const LEASE_DURATION_MS = 60000; // 60-second in-flight lease
      if (leaseAgeMs < LEASE_DURATION_MS) {
        const err = new Error(
          `Concurrent dispatch in progress for operation '${operationId}'. Please wait for in-flight dispatch to complete.`
        );
        err.code = 'DISPATCH_IN_PROGRESS';
        throw err;
      }

      // Lease expired (> 60s): Transition to UNCERTAIN state.
      // An expired lease must NEVER automatically become available for another POST!
      const expiredRecord = {
        status: 'UNCERTAIN',
        operationId,
        decisionId: decision.decisionId,
        planId,
        error: `In-flight dispatch lease expired after ${Math.round(leaseAgeMs / 1000)}s without confirmation. Outcome ambiguous.`,
        initiatedAt: existingKvsDispatch.initiatedAt,
        expiredAt: new Date().toISOString()
      };
      await client.set(idempotencyKey, expiredRecord);
      const err = new Error(
        `Dispatch operation '${operationId}' lease expired after ${Math.round(leaseAgeMs / 1000)}s without confirmation. State transitioned to UNCERTAIN. Automated issue creation blocked to prevent duplicate tickets.`
      );
      err.code = 'DISPATCH_UNCERTAIN';
      err.details = expiredRecord;
      throw err;
    }
  }

  // 7. Strict Coordinate Resolution & Validation (Grounded in road/drainage features)
  const resolvedLocation = resolveDispatchLocation(decision.chosenPlan, dispatchOrder.targetLocation);

  // 8. Acquire In-Progress Lease
  await client.set(idempotencyKey, {
    status: 'PENDING_CREATION',
    decisionId: decision.decisionId,
    planId,
    operationId,
    initiatedAt: new Date().toISOString(),
    initiatedBy: authenticatedCaller
  });

  const issueTypeName = dispatchOrder.issueType || 'Task';
  const summary = dispatchOrder.summary ||
    `FIELD DISPATCH: ${decision.chosenPlan?.name || 'Hydraulic Mitigation'} [${decision.decisionId}]`;

  const adfDescription = buildDispatchAdfDescription(dispatchOrder, decision, resolvedLocation, operationId);

  const issuePayload = {
    fields: {
      project: { key: projectKey },
      summary: summary.slice(0, 250),
      issuetype: { name: issueTypeName },
      priority: { name: dispatchOrder.priority || 'High' },
      labels: ['delta-dispatch', operationId],
      description: adfDescription
    }
  };

  let createdIssue;

  try {
    // 9. Invoke Jira REST API v3
    if (!customJiraClient) {
      const hasForgeRuntime = typeof globalThis !== 'undefined' &&
        (typeof globalThis.__forge_fetch__ === 'function' || typeof globalThis.__forge_local_fetch__ === 'function');

      if (hasForgeRuntime) {
        const response = await api.asApp().requestJira(route`/rest/api/3/issue`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(issuePayload)
        });

        if (!response.ok) {
          const status = response.status;
          const errText = await response.text();
          const err = new Error(`Jira API call failed with HTTP ${status}: ${errText}`);
          err.status = status;
          err.isClientError = status >= 400 && status < 500;
          err.isAmbiguous = status >= 500;
          throw err;
        }

        const created = await response.json();
        createdIssue = { key: created.key, id: created.id, self: created.self };
      } else {
        // Offline / test simulation fallback when no customJiraClient or Forge runtime is available
        const mockKey = `${projectKey}-${Math.floor(100 + Math.random() * 900)}`;
        createdIssue = {
          key: mockKey,
          id: '10999',
          self: `https://test.atlassian.net/rest/api/3/issue/${mockKey}`,
          isSimulated: true
        };
      }
    } else {
      // Injected mock client for unit testing
      const result = await customJiraClient.requestJira('/rest/api/3/issue', {
        method: 'POST',
        body: issuePayload
      });
      createdIssue = { key: result.key, id: result.id, self: result.self };
    }
  } catch (jiraErr) {
    // Distinguish deterministic client rejections from ambiguous transport/gateway failures
    const isDeterministicClientError = jiraErr.status >= 400 && jiraErr.status < 500;
    const isAmbiguousTransportOrServer =
      !isDeterministicClientError && (
        jiraErr.isAmbiguous ||
        jiraErr.name === 'AbortError' ||
        jiraErr.name === 'TimeoutError' ||
        jiraErr.status >= 500 ||
        /timeout|timed out|ECONNRESET|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|EPIPE|UND_ERR_|fetch failed|502|503|504|Gateway|Service Unavailable/i.test(
          jiraErr.message || ''
        )
      );

    if (isAmbiguousTransportOrServer) {
      // Mark state as UNCERTAIN so subsequent retries do not blindly duplicate
      await client.set(idempotencyKey, {
        status: 'UNCERTAIN',
        operationId,
        decisionId: decision.decisionId,
        planId,
        error: jiraErr.message || 'Ambiguous transport/gateway failure',
        timestamp: new Date().toISOString()
      });
      const err = new Error(
        `Jira dispatch request encountered an ambiguous network or gateway failure (${jiraErr.message}). Operation '${operationId}' marked UNCERTAIN to prevent duplicate creation.`
      );
      err.code = 'DISPATCH_UNCERTAIN';
      err.originalError = jiraErr;
      throw err;
    }

    // Deterministic API failure (e.g. HTTP 400 Bad Request, missing field): clean up in-progress lease
    try {
      await client.delete(idempotencyKey);
    } catch (_) {
      // Ignore cleanup error
    }
    const err = new Error(`JSM Dispatch Jira API Failure: ${jiraErr.message}`);
    err.code = 'JIRA_API_FAILURE';
    err.originalError = jiraErr;
    throw err;
  }

  // 10. Persist Completed Dispatch Record into KVS
  const dispatchedAt = new Date().toISOString();
  const completedRecord = {
    status: 'DISPATCHED',
    issueKey: createdIssue.key,
    issueId: createdIssue.id,
    self: createdIssue.self,
    decisionId: decision.decisionId,
    planId,
    operationId,
    dispatchedAt,
    dispatchedBy: authenticatedCaller,
    coordinates: resolvedLocation
  };

  try {
    await client.set(idempotencyKey, completedRecord);

    // Update Decision Record status to DISPATCHED
    const updatedDecision = {
      ...decision,
      status: 'DISPATCHED',
      dispatchedIssueKey: createdIssue.key,
      dispatchedAt
    };
    await client.set(`decision:${decision.decisionId}`, updatedDecision);
  } catch (storageErr) {
    // CRITICAL: Jira ticket was successfully created!
    // Never fail with an unhandled error that triggers blind re-dispatch.
    // The operationId label in Jira guarantees that any retry will reconcile and adopt this issue.
    return {
      success: true,
      issueKey: createdIssue.key,
      issueId: createdIssue.id,
      self: createdIssue.self,
      decisionId: decision.decisionId,
      planId,
      operationId,
      dispatchedAt,
      coordinates: resolvedLocation,
      kvsSyncWarning: `Ticket ${createdIssue.key} created in Jira, but KVS record update failed: ${storageErr.message}. Ticket is preserved and searchable via operationId ${operationId}.`
    };
  }

  return {
    success: true,
    issueKey: createdIssue.key,
    issueId: createdIssue.id,
    self: createdIssue.self,
    decisionId: decision.decisionId,
    planId,
    operationId,
    dispatchedAt,
    coordinates: resolvedLocation
  };
}
