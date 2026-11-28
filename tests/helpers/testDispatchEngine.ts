/**
 * Isolated Test-Only Dispatch Engine Harness
 * 
 * TASK 0.7.1.6 TEST ISOLATION HARNESS:
 * This module lives exclusively within the tests/ directory and is NEVER bundled
 * into the production Atlassian Forge application runtime.
 * 
 * It enables unit testing of the dispatch state machine (JQL Search-Before-Create,
 * lease expiry to UNCERTAIN, HTTP 502/503 uncertainty classification, and KVS healing)
 * without weakening or placing mutable setters in the production resolver module.
 */

import api, { route } from '@forge/api';
import { getDecision, getStorageClient } from '../../src/resolvers/decisionStorage.js';
import { resolveDispatchLocation } from '../../src/resolvers/coordinates.js';
import { verifyIncidentCommanderAuthorization } from '../../src/resolvers/authPolicy.js';
import { buildDispatchAdfDescription } from '../../src/resolvers/jsmDispatcher.js';

export async function createTestDispatchTicket(dispatchOrder: any, options: any = {}) {
  const { customJiraClient, storageOverride, caller, context, customAuthPolicy } = options;

  if (!dispatchOrder?.decisionId) {
    const err: any = new Error('JSM Dispatch Error: decisionId is required to issue a field dispatch ticket.');
    err.code = 'MISSING_DECISION_ID';
    throw err;
  }

  // 1. Authorisation Verification: Must hold Incident Commander authority on server
  const authenticatedCaller = caller || context?.accountId;

  if (!authenticatedCaller || typeof authenticatedCaller !== 'string' || authenticatedCaller === 'anonymous') {
    const err: any = new Error(
      'Dispatch authorization denied: Missing or unverified Jira user identity in server invocation context. Client-provided caller identities are strictly rejected.'
    );
    err.code = 'UNAUTHENTICATED_SESSION';
    throw err;
  }

  // Dynamic project: peek the decision first so auth is scoped to its bound project (mirrors production).
  const peekClient = getStorageClient(storageOverride);
  const peekDecision = await getDecision(dispatchOrder.decisionId, peekClient);
  const derivedProject = (peekDecision as any)?.data?.projectKey || (peekDecision as any)?.data?.linkedIssueKey?.split('-')[0] || dispatchOrder.projectKey || null;

  const auth = await verifyIncidentCommanderAuthorization({
    accountId: authenticatedCaller,
    projectKey: derivedProject || undefined,
    customAuthPolicy
  });

  if (!auth.isAuthorized) {
    const err: any = new Error(
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
    const err: any = new Error(`JSM Dispatch Error: Decision Record '${dispatchOrder.decisionId}' was not found in KVS.`);
    err.code = 'DECISION_NOT_FOUND';
    throw err;
  }

  const decision = decisionResult.data;
  const resolvedProjectKey = (decision as any).projectKey || (decision as any).linkedIssueKey?.split('-')[0] || dispatchOrder.projectKey || 'EMERG';
  if (dispatchOrder.projectKey && dispatchOrder.projectKey !== resolvedProjectKey) {
    const err: any = new Error(`Project scope mismatch: Field dispatch is bound to project '${resolvedProjectKey}' (attempted override to '${dispatchOrder.projectKey}').`);
    err.code = 'INVALID_PROJECT_SCOPE'; throw err;
  }

  // 3. Approval Verification: Only APPROVED decisions may be dispatched
  if (decision.status !== 'APPROVED' && decision.status !== 'DISPATCHED') {
    const err: any = new Error(
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
  let existingJiraIssues: any[] = [];
  const searchJql = `labels = "${operationId}"`;

  try {
    if (typeof customJiraClient?.searchJira === 'function') {
      existingJiraIssues = await customJiraClient.searchJira(searchJql);
    } else if (typeof customJiraClient?.requestJira === 'function') {
      const searchRes = await customJiraClient.requestJira('/rest/api/3/search/jql', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ jql: searchJql, maxResults: 50, fields: ['summary', 'status', 'priority', 'issuetype', 'created'] })
      });
      if (Array.isArray(searchRes?.issues)) {
        existingJiraIssues = searchRes.issues;
      }
    } else {
      const hasForgeRuntime = typeof globalThis !== 'undefined' &&
        (typeof (globalThis as any).__forge_fetch__ === 'function' || typeof (globalThis as any).__forge_local_fetch__ === 'function');

      if (hasForgeRuntime) {
        const searchResp = await api.asApp().requestJira(route`/rest/api/3/search/jql`, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ jql: searchJql, maxResults: 50, fields: ['summary', 'status', 'priority', 'issuetype', 'created'] })
        });
        if (searchResp.ok) {
          const searchData = await searchResp.json();
          existingJiraIssues = searchData.issues || [];
        }
      }
    }
  } catch (searchErr: any) {
    console.warn(`Jira search reconciliation warning: ${searchErr.message}`);
  }

  // 6a. Reconciliation Case A: Multiple matching issues detected
  if (existingJiraIssues.length > 1) {
    const conflictingKeys = existingJiraIssues.map((i: any) => i.key).join(', ');
    const err: any = new Error(
      `Reconciliation conflict: Found ${existingJiraIssues.length} existing Jira issues for operation '${operationId}' (${conflictingKeys}). Multiple dispatches detected. Manual resolution required.`
    );
    err.code = 'DUPLICATE_DISPATCH_CONFLICT';
    err.details = { operationId, conflictingKeys: existingJiraIssues.map((i: any) => i.key) };
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

  // 6c. Zero matching issues found in Jira
  if (existingKvsDispatch) {
    if (existingKvsDispatch.status === 'UNCERTAIN') {
      const err: any = new Error(
        `Dispatch operation '${operationId}' is in an UNCERTAIN state (${existingKvsDispatch.error || 'unconfirmed in-flight attempt'}). JQL search returned 0 issues, but search indexing lag prevents confirming ticket absence. Automated issue creation is strictly blocked to prevent duplicate tickets. Explicit reconciliation or administrative triage is required.`
      );
      err.code = 'DISPATCH_UNCERTAIN';
      err.details = existingKvsDispatch;
      throw err;
    }

    if (existingKvsDispatch.status === 'PENDING_CREATION') {
      const leaseAgeMs = Date.now() - new Date(existingKvsDispatch.initiatedAt).getTime();
      const LEASE_DURATION_MS = 60000;
      if (leaseAgeMs < LEASE_DURATION_MS) {
        const err: any = new Error(
          `Concurrent dispatch in progress for operation '${operationId}'. Please wait for in-flight dispatch to complete.`
        );
        err.code = 'DISPATCH_IN_PROGRESS';
        throw err;
      }

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
      const err: any = new Error(
        `Dispatch operation '${operationId}' lease expired after ${Math.round(leaseAgeMs / 1000)}s without confirmation. State transitioned to UNCERTAIN. Automated issue creation blocked to prevent duplicate tickets.`
      );
      err.code = 'DISPATCH_UNCERTAIN';
      err.details = expiredRecord;
      throw err;
    }
  }

  // 7. Strict Coordinate Resolution & Validation
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
      project: { key: resolvedProjectKey },
      summary: summary.slice(0, 250),
      issuetype: { name: issueTypeName },
      priority: { name: dispatchOrder.priority || 'High' },
      labels: ['delta-dispatch', operationId],
      description: adfDescription
    }
  };

  let createdIssue: any;

  try {
    // 9. Invoke Jira REST API v3
    if (!customJiraClient) {
      const hasForgeRuntime = typeof globalThis !== 'undefined' &&
        (typeof (globalThis as any).__forge_fetch__ === 'function' || typeof (globalThis as any).__forge_local_fetch__ === 'function');

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
          const err: any = new Error(`Jira API call failed with HTTP ${status}: ${errText}`);
          err.status = status;
          err.isClientError = status >= 400 && status < 500;
          err.isAmbiguous = status >= 500;
          throw err;
        }

        const created = await response.json();
        createdIssue = { key: created.key, id: created.id, self: created.self };
      } else {
        const err: any = new Error('Live dispatch requires a Forge runtime with Jira access. No Jira issue was created outside Forge.');
        err.code = 'DISPATCH_UNAVAILABLE_OUTSIDE_FORGE'; throw err;
      }
    } else {
      const result = await customJiraClient.requestJira('/rest/api/3/issue', {
        method: 'POST',
        body: issuePayload
      });
      createdIssue = { key: result.key, id: result.id, self: result.self };
    }
  } catch (jiraErr: any) {
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
      await client.set(idempotencyKey, {
        status: 'UNCERTAIN',
        operationId,
        decisionId: decision.decisionId,
        planId,
        error: jiraErr.message || 'Ambiguous transport/gateway failure',
        timestamp: new Date().toISOString()
      });
      const err: any = new Error(
        `Jira dispatch request encountered an ambiguous network or gateway failure (${jiraErr.message}). Operation '${operationId}' marked UNCERTAIN to prevent duplicate creation.`
      );
      err.code = 'DISPATCH_UNCERTAIN';
      err.originalError = jiraErr;
      throw err;
    }

    try {
      await client.delete(idempotencyKey);
    } catch (_) {}
    const err: any = new Error(`JSM Dispatch Jira API Failure: ${jiraErr.message}`);
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

    const updatedDecision = {
      ...decision,
      status: 'DISPATCHED',
      dispatchedIssueKey: createdIssue.key,
      dispatchedAt
    };
    await client.set(`decision:${decision.decisionId}`, updatedDecision);
  } catch (storageErr: any) {
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
