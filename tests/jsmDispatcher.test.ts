/**
 * Jira Service Management (JSM) & Field Dispatch Integration Test Suite
 * 
 * TASK 0.7.1.1 VERIFICATION SUITE:
 * - Authoritative dataset coordinate derivation (Brookline Culvert & Francis St / OSM Way 1377084984)
 * - WGS84 & EPSG:26986 mathematical consistency & domain bounds enforcement (<= 25m tolerance)
 * - Elimination of synthetic/hardcoded fallback coordinates and hospital centroid conflation
 * - Server-side authorization enforcement (Incident Commander project role)
 * - Approver authentication mismatch detection (server session vs client payload)
 * - Dispatch idempotency & Search-Before-Create JQL reconciliation
 * - Duplicate dispatch conflict fail-closed handling
 * - Timeout uncertain-outcome tracking (DISPATCH_UNCERTAIN)
 * - Post-creation KVS failure tolerance and reconciliation recovery
 * 
 * NOTE: These tests verify application logic with mock Jira API and in-memory KVS.
 * Live Jira Cloud execution tests are demarcated separately.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createDispatchTicket, buildDispatchAdfDescription } from '../src/resolvers/jsmDispatcher.js';
import {
  resolveDispatchLocation,
  validateAndReconcileLocation,
  latLonToProjected,
  projectedToLatLon,
  AUTHORITATIVE_INTERVENTION_LOCATIONS,
  CATCHMENT_BOUNDS
} from '../src/resolvers/coordinates.js';
import { recordDecision, getDecision, __resetInMemoryStore } from '../src/resolvers/decisionStorage.js';

describe('Task 0.7.1.1: Dispatch Integrity, Authorization & Reconciliation Suite', () => {
  beforeEach(() => {
    __resetInMemoryStore();
  });

  const SAMPLE_APPROVED_DECISION_BETA = {
    decisionId: 'DEC-2026-0050',
    scenarioHash: 'hash-abc12345',
    baselineStorm: 'NOAA Atlas 14 100-Year 6-Hour Event (122.0 mm total depth)',
    chosenPlan: {
      planId: 'plan-beta',
      name: 'Plan Beta: Clear Brookline Avenue Culvert & Deploy High-Capacity Pump #1',
      inundationReduction: '-46.2%',
      hospitalDelayMinutes: 2.1,
      confidence: 0.948,
      tradeOffSummary: 'Restores culvert conveyance to 12.5 m³/s.'
    },
    humanApprover: {
      accountId: 'qm:839b15ba-58cd-4b57-b8aa-f9b9e6ce67cd:user-commander-1',
      displayName: 'Captain Sarah Connor',
      role: 'Incident Commander',
      approvalTimestamp: '2026-11-25T08:45:00.000Z'
    },
    physicalMetrics: {
      peakInundationDepthCm: 11.4
    },
    status: 'APPROVED',
    linkedIssueKey: 'EMERG-300'
  };

  const SAMPLE_APPROVED_DECISION_ALPHA = {
    decisionId: 'DEC-2026-0051',
    scenarioHash: 'hash-def67890',
    baselineStorm: 'NOAA Atlas 14 100-Year 6-Hour Event',
    chosenPlan: {
      planId: 'plan-alpha',
      name: 'Plan Alpha: Rapid Deployable Barrier along Francis St Ambulance Route',
      inundationReduction: '-22.5%',
      hospitalDelayMinutes: 8.4,
      confidence: 0.821,
      tradeOffSummary: 'Deflects overland flow from BWH entrance.'
    },
    humanApprover: {
      accountId: 'qm:user-chief-martinez',
      displayName: 'Chief R. Martinez',
      role: 'Incident Commander',
      approvalTimestamp: '2026-11-25T08:50:00.000Z'
    },
    physicalMetrics: {
      peakInundationDepthCm: 14.8
    },
    status: 'APPROVED',
    linkedIssueKey: 'EMERG-301'
  };

  const AUTH_OPTIONS = {
    caller: 'qm:839b15ba-58cd-4b57-b8aa-f9b9e6ce67cd:user-commander-1'
  };

  // -------------------------------------------------------------
  // Part A: Coordinate Integrity & Dataset Derivation
  // -------------------------------------------------------------
  it('TEST-COORD-01: Derives exact Brookline Culvert coordinates for Plan Beta from dataset', () => {
    const loc = resolveDispatchLocation(SAMPLE_APPROVED_DECISION_BETA.chosenPlan);
    expect(loc.name).toBe('Brookline Avenue Muddy River Culvert Inflow');
    expect(loc.epsg26986.x).toBe(232302.11);
    expect(loc.epsg26986.y).toBe(899074.88);
    expect(loc.wgs84.lat).toBe(42.34150);
    expect(loc.wgs84.lon).toBe(-71.10800);
    expect(loc.gridCell).toEqual([17, 26]);
    expect(loc.epsg26986Formatted).toContain('232,302.11 m');
    expect(loc.epsg26986Formatted).toContain('899,074.88 m');
    expect(loc.wgs84Formatted).toBe('42.34150° N, 71.10800° W');
    expect(loc.gridCellFormatted).toBe('[Row 17, Col 26]');
  });

  it('TEST-COORD-02: Derives Francis St road feature coordinates for Plan Alpha (ROAD-1377084984) and rejects hospital centroid', () => {
    const loc = resolveDispatchLocation(SAMPLE_APPROVED_DECISION_ALPHA.chosenPlan);
    expect(loc.name).toContain('Francis Street');
    expect(loc.featureType).toBe('road_segment');
    expect(loc.featureId).toBe('ROAD-1377084984');
    expect(loc.epsg26986.x).toBe(232384.06);
    expect(loc.epsg26986.y).toBe(898414.94);
    expect(loc.wgs84.lat).toBe(42.33556);
    expect(loc.wgs84.lon).toBe(-71.10704);
    expect(loc.gridCell).toEqual([43, 29]);
    // Assert it is completely distinct from the Brookline culvert location and hospital building centroid
    expect(loc.epsg26986.x).not.toBe(232302.11);
    expect(loc.epsg26986.x).not.toBe(232387.58); // BWH building centroid
    expect(loc.gridCell).not.toEqual([17, 26]);
  });

  it('TEST-COORD-03: Rejects unrecognized plan without explicit location with UNRESOLVED_INTERVENTION_LOCATION', () => {
    const unknownPlan = { planId: 'plan-custom-unknown', name: 'Plan Custom' };
    expect(() => resolveDispatchLocation(unknownPlan)).toThrow(/Unresolved intervention location/);
  });

  it('TEST-COORD-04: Rejects out-of-domain coordinates (including the audited defect coordinates)', () => {
    // Audited defect coordinates: Easting 233,400 m (outside xmax 233,250), Northing 894,200 m (outside ymin 897,900)
    const defectiveLoc = {
      name: 'Audited Defect Location',
      epsg26986: { x: 233400.0, y: 894200.0 }
    };
    expect(() => validateAndReconcileLocation(defectiveLoc)).toThrow(/Out of bounds coordinates/);
  });

  it('TEST-COORD-05: Rejects mathematically inconsistent WGS84 and EPSG:26986 coordinates (> 25m drift)', () => {
    const inconsistentLoc = {
      name: 'Mismatched Location',
      wgs84: { lat: 42.34150, lon: -71.10800 }, // Culvert location (~X: 232302, Y: 899075)
      epsg26986: { x: 232800.0, y: 898500.0 }   // Over 700m away in Fenway!
    };
    expect(() => validateAndReconcileLocation(inconsistentLoc)).toThrow(/Coordinate inconsistency/);
  });

  it('TEST-COORD-06: Automatically forward projects WGS84 to EPSG:26986 when only WGS84 is provided', () => {
    const geoOnly = {
      name: 'GPS Field Marker',
      wgs84: { lat: 42.34150, lon: -71.10800 }
    };
    const reconciled = validateAndReconcileLocation(geoOnly);
    expect(reconciled.epsg26986.x).toBeCloseTo(232302.11, 0);
    expect(reconciled.epsg26986.y).toBeCloseTo(899074.88, 0);
    expect(reconciled.gridCell).toEqual([17, 26]);
  });

  it('TEST-COORD-07: Automatically inverse projects EPSG:26986 to WGS84 when only projected is provided', () => {
    const projOnly = {
      name: 'Grid Staging Station',
      epsg26986: { x: 232302.11, y: 899074.88 }
    };
    const reconciled = validateAndReconcileLocation(projOnly);
    expect(reconciled.wgs84.lat).toBeCloseTo(42.34150, 4);
    expect(reconciled.wgs84.lon).toBeCloseTo(-71.10800, 4);
  });

  it('TEST-COORD-08: Confirms zero synthetic or hardcoded coordinates exist in generated ADF', () => {
    const loc = resolveDispatchLocation(SAMPLE_APPROVED_DECISION_BETA.chosenPlan);
    const adf = buildDispatchAdfDescription(
      { decisionId: 'DEC-2026-0050', priority: 'Highest' },
      SAMPLE_APPROVED_DECISION_BETA,
      loc,
      'delta-disp-dec-2026-0050-plan-beta'
    );
    const jsonStr = JSON.stringify(adf);

    // Old defect strings must NEVER appear
    expect(jsonStr).not.toContain('233,400');
    expect(jsonStr).not.toContain('894,200');

    // Authoritative strings must appear
    expect(jsonStr).toContain('42.34150° N, 71.10800° W');
    expect(jsonStr).toContain('Easting: 232,302.11 m, Northing: 899,074.88 m');
    expect(jsonStr).toContain('[Row 17, Col 26]');
    expect(jsonStr).toContain('Brookline Avenue Muddy River Culvert Inflow');
    expect(jsonStr).toContain('delta-disp-dec-2026-0050-plan-beta');
  });

  // -------------------------------------------------------------
  // Part B: Idempotency, Concurrency, and Recovery
  // -------------------------------------------------------------
  it('TEST-IDEMP-01: Rejects dispatch if Decision Record status is not APPROVED', async () => {
    await recordDecision({
      ...SAMPLE_APPROVED_DECISION_BETA,
      decisionId: 'DEC-2026-0099',
      status: 'SUPERSEDED'
    });

    await expect(createDispatchTicket({ decisionId: 'DEC-2026-0099' }, AUTH_OPTIONS))
      .rejects.toThrow(/Only 'APPROVED' decisions may be dispatched/);
  });

  it('TEST-IDEMP-02: Rejects dispatch when caller is anonymous/unauthenticated', async () => {
    await recordDecision(SAMPLE_APPROVED_DECISION_BETA);

    // Calling without caller or context
    await expect(createDispatchTicket({ decisionId: 'DEC-2026-0050' }))
      .rejects.toThrow(/Dispatch authorization denied for account 'anonymous'/);
  });

  it('TEST-IDEMP-03: Repeated dispatch returns existing ticket reference without duplicate creation', async () => {
    await recordDecision(SAMPLE_APPROVED_DECISION_BETA);

    let apiInvocationCount = 0;
    const mockJiraClient = {
      async requestJira(path: string) {
        if (typeof path === 'string' && path.includes('/search')) {
          return { issues: [] };
        }
        apiInvocationCount++;
        return {
          id: '10888',
          key: 'EMERG-700',
          self: 'https://nomathembancube2005.atlassian.net/rest/api/3/issue/10888'
        };
      }
    };

    // First dispatch invocation
    const firstResult = await createDispatchTicket(
      { decisionId: 'DEC-2026-0050' },
      { ...AUTH_OPTIONS, customJiraClient: mockJiraClient }
    );
    expect(firstResult.success).toBe(true);
    expect(firstResult.issueKey).toBe('EMERG-700');
    expect(firstResult.isExisting).toBeUndefined();
    expect(apiInvocationCount).toBe(1);

    // Second dispatch invocation for same decision and plan
    const secondResult = await createDispatchTicket(
      { decisionId: 'DEC-2026-0050' },
      { ...AUTH_OPTIONS, customJiraClient: mockJiraClient }
    );
    expect(secondResult.success).toBe(true);
    expect(secondResult.isExisting).toBe(true);
    expect(secondResult.issueKey).toBe('EMERG-700');
    expect(secondResult.message).toContain('Returning existing ticket EMERG-700');
    // Jira API must NOT have been called a second time
    expect(apiInvocationCount).toBe(1);

    // Verify Decision Record in KVS was updated to DISPATCHED
    const updatedRec = await getDecision('DEC-2026-0050');
    expect(updatedRec.data.status).toBe('DISPATCHED');
    expect(updatedRec.data.dispatchedIssueKey).toBe('EMERG-700');
  });

  it('TEST-IDEMP-04: Rejects concurrent dispatch while in-flight lease is active', async () => {
    await recordDecision(SAMPLE_APPROVED_DECISION_BETA);

    const slowJiraClient = {
      async requestJira(path: string) {
        if (typeof path === 'string' && path.includes('/search')) {
          return { issues: [] };
        }
        // Simulate a slow in-flight request
        await new Promise((r) => setTimeout(r, 60));
        return { id: '10999', key: 'EMERG-701' };
      }
    };

    // Start first dispatch (runs asynchronously, acquires lease, and pauses in slowJiraClient)
    const firstDispatchPromise = createDispatchTicket(
      { decisionId: 'DEC-2026-0050' },
      { ...AUTH_OPTIONS, customJiraClient: slowJiraClient }
    );

    // Small delay to ensure the first dispatch has acquired the IN_PROGRESS lease
    await new Promise((r) => setTimeout(r, 10));

    // Immediately attempt concurrent second dispatch
    await expect(
      createDispatchTicket(
        { decisionId: 'DEC-2026-0050' },
        { ...AUTH_OPTIONS, customJiraClient: slowJiraClient }
      )
    ).rejects.toThrow(/Concurrent dispatch in progress/);

    await firstDispatchPromise;
  });

  it('TEST-IDEMP-05: Cleans up in-progress lease when Jira API call fails', async () => {
    await recordDecision(SAMPLE_APPROVED_DECISION_BETA);

    const failingJiraClient = {
      async requestJira(path: string) {
        if (typeof path === 'string' && path.includes('/search')) {
          return { issues: [] };
        }
        throw new Error('HTTP 400 Bad Request: Project EMERG does not exist');
      }
    };

    await expect(
      createDispatchTicket(
        { decisionId: 'DEC-2026-0050' },
        { ...AUTH_OPTIONS, customJiraClient: failingJiraClient }
      )
    ).rejects.toThrow(/JSM Dispatch Jira API Failure/);

    // Now retry with a working client: lease should be clean, not stuck in IN_PROGRESS
    const workingJiraClient = {
      async requestJira(path: string) {
        if (typeof path === 'string' && path.includes('/search')) {
          return { issues: [] };
        }
        return { id: '10555', key: 'EMERG-702' };
      }
    };

    const retryResult = await createDispatchTicket(
      { decisionId: 'DEC-2026-0050' },
      { ...AUTH_OPTIONS, customJiraClient: workingJiraClient }
    );
    expect(retryResult.success).toBe(true);
    expect(retryResult.issueKey).toBe('EMERG-702');
  });

  it('TEST-IDEMP-06: Preserves Jira ticket and returns kvsSyncWarning if KVS write fails after creation', async () => {
    const workingJiraClient = {
      async requestJira(path: string) {
        if (typeof path === 'string' && path.includes('/search')) {
          return { issues: [] };
        }
        return { id: '10555', key: 'EMERG-703', self: 'https://test/issue/10555' };
      }
    };

    // Storage client where get succeeds, first set (lease) succeeds, but post-creation commit fails
    const store = new Map();
    const failingStorageClient = {
      async get(key: string) { return store.get(key); },
      async set(key: string, val: any) {
        if (key.startsWith('dispatch-record:') && val.status === 'DISPATCHED') {
          // Post-creation commit throws
          throw new Error('KVS Network Timeout during persistence');
        }
        store.set(key, val);
      },
      async delete(key: string) { store.delete(key); }
    };

    // Seed the approved decision into the custom storage client
    await recordDecision(SAMPLE_APPROVED_DECISION_BETA, failingStorageClient);

    const result = await createDispatchTicket(
      { decisionId: 'DEC-2026-0050' },
      { ...AUTH_OPTIONS, customJiraClient: workingJiraClient, storageOverride: failingStorageClient }
    );

    // Ticket must NOT be lost, and caller must be informed of warning
    expect(result.success).toBe(true);
    expect(result.issueKey).toBe('EMERG-703');
    expect(result.kvsSyncWarning).toContain('KVS record update failed');
  });

  it('TEST-IDEMP-07: Search-Before-Create reconciles and adopts single existing Jira ticket', async () => {
    await recordDecision(SAMPLE_APPROVED_DECISION_BETA);

    let createCalled = false;
    const reconcilingJiraClient = {
      async searchJira(jql: string) {
        expect(jql).toContain('delta-disp-dec-2026-0050-plan-beta');
        return [{
          id: '10888',
          key: 'EMERG-800',
          self: 'https://test/issue/10888'
        }];
      },
      async requestJira() {
        createCalled = true;
        return { id: '10999', key: 'EMERG-WRONG' };
      }
    };

    const result = await createDispatchTicket(
      { decisionId: 'DEC-2026-0050' },
      { ...AUTH_OPTIONS, customJiraClient: reconcilingJiraClient }
    );

    expect(result.success).toBe(true);
    expect(result.issueKey).toBe('EMERG-800');
    expect(result.isExisting).toBe(true);
    expect(result.reconciledFromJira).toBe(true);
    expect(result.message).toContain('Adopted existing Jira issue EMERG-800');
    expect(createCalled).toBe(false);

    // Verify Decision Record was healed in KVS
    const updated = await getDecision('DEC-2026-0050');
    expect(updated.data.status).toBe('DISPATCHED');
    expect(updated.data.dispatchedIssueKey).toBe('EMERG-800');
  });

  it('TEST-IDEMP-08: Search-Before-Create fails closed with DUPLICATE_DISPATCH_CONFLICT on multiple tickets', async () => {
    await recordDecision(SAMPLE_APPROVED_DECISION_BETA);

    const conflictingJiraClient = {
      async searchJira() {
        return [
          { id: '10001', key: 'EMERG-801' },
          { id: '10002', key: 'EMERG-802' }
        ];
      }
    };

    await expect(
      createDispatchTicket(
        { decisionId: 'DEC-2026-0050' },
        { ...AUTH_OPTIONS, customJiraClient: conflictingJiraClient }
      )
    ).rejects.toThrow(/Reconciliation conflict: Found 2 existing Jira issues/);
  });

  it('TEST-IDEMP-09: Request timeout marks status UNCERTAIN and blocks automated blind retry', async () => {
    await recordDecision(SAMPLE_APPROVED_DECISION_BETA);

    const timingOutClient = {
      async searchJira() { return []; },
      async requestJira() {
        const timeoutErr = new Error('ETIMEDOUT: Connection to Jira Cloud timed out after 30000ms');
        timeoutErr.name = 'TimeoutError';
        throw timeoutErr;
      }
    };

    await expect(
      createDispatchTicket(
        { decisionId: 'DEC-2026-0050' },
        { ...AUTH_OPTIONS, customJiraClient: timingOutClient }
      )
    ).rejects.toThrow(/Jira dispatch request timed out with uncertain creation outcome/);

    // Second call without reconciliation: must be rejected with DISPATCH_UNCERTAIN
    const secondClient = {
      async searchJira() { return []; },
      async requestJira() {
        return { id: '10999', key: 'EMERG-SHOULD-NOT-BE-CREATED' };
      }
    };

    await expect(
      createDispatchTicket(
        { decisionId: 'DEC-2026-0050' },
        { ...AUTH_OPTIONS, customJiraClient: secondClient }
      )
    ).rejects.toThrow(/ended with an uncertain outcome/);
  });

  it('TEST-IDEMP-10: Recovers from KVS failure via JQL search reconciliation on retry', async () => {
    // 1. First run creates ticket in Jira, but KVS persistence fails
    const store = new Map();
    const flakyStorage = {
      async get(key: string) { return store.get(key); },
      async set(key: string, val: any) {
        if (key.startsWith('dispatch-record:') && val.status === 'DISPATCHED') {
          throw new Error('KVS Network Disruption');
        }
        store.set(key, val);
      },
      async delete(key: string) { store.delete(key); }
    };

    await recordDecision(SAMPLE_APPROVED_DECISION_BETA, flakyStorage);

    const jiraStore = new Map<string, any>();
    const durableJiraClient = {
      async searchJira(jql: string) {
        const results: any[] = [];
        for (const [key, issue] of jiraStore.entries()) {
          if (issue.labels?.some((l: string) => jql.includes(l))) {
            results.push(issue);
          }
        }
        return results;
      },
      async requestJira(path: string, opts: any) {
        if (path === '/rest/api/3/issue') {
          const issue = {
            id: '10777',
            key: 'EMERG-777',
            self: 'https://test/issue/10777',
            labels: opts.body.fields.labels
          };
          jiraStore.set('EMERG-777', issue);
          return issue;
        }
        throw new Error(`Unexpected path ${path}`);
      }
    };

    // Initial dispatch: Jira ticket created, but KVS sync fails
    const firstRes = await createDispatchTicket(
      { decisionId: 'DEC-2026-0050' },
      { ...AUTH_OPTIONS, customJiraClient: durableJiraClient, storageOverride: flakyStorage }
    );
    expect(firstRes.success).toBe(true);
    expect(firstRes.issueKey).toBe('EMERG-777');
    expect(firstRes.kvsSyncWarning).toBeDefined();

    // Now storage is healed
    const healedStorage = {
      async get(key: string) { return store.get(key); },
      async set(key: string, val: any) { store.set(key, val); },
      async delete(key: string) { store.delete(key); }
    };

    // Retry dispatch: Search-Before-Create must find EMERG-777 in Jira and adopt it without duplicate creation
    const retryRes = await createDispatchTicket(
      { decisionId: 'DEC-2026-0050' },
      { ...AUTH_OPTIONS, customJiraClient: durableJiraClient, storageOverride: healedStorage }
    );
    expect(retryRes.success).toBe(true);
    expect(retryRes.issueKey).toBe('EMERG-777');
    expect(retryRes.reconciledFromJira).toBe(true);
    expect(jiraStore.size).toBe(1); // Still exactly one ticket in Jira!
  });

  // -------------------------------------------------------------
  // Part C: Server-Side Authorization Policy Enforcement
  // -------------------------------------------------------------
  it('TEST-AUTH-01: Enforces server-side approver verification during decision recording', async () => {
    const maliciousPayload = {
      ...SAMPLE_APPROVED_DECISION_BETA,
      decisionId: 'DEC-2026-0077',
      humanApprover: {
        accountId: 'attacker-account-id',
        displayName: 'Attacker Impersonating Commander',
        role: 'Incident Commander',
        approvalTimestamp: '2026-11-25T09:00:00.000Z'
      }
    };

    // Authenticated session context from Forge server
    const serverAuthContext = {
      accountId: 'legitimate-jira-user-account-id'
    };

    await expect(
      recordDecision(maliciousPayload, null, serverAuthContext)
    ).rejects.toThrow(/Approver authentication mismatch/);
  });

  it('TEST-AUTH-02: Rejects decision approval from user without Incident Commander role', async () => {
    const unauthorizedDecision = {
      ...SAMPLE_APPROVED_DECISION_BETA,
      decisionId: 'DEC-2026-0078',
      humanApprover: {
        accountId: 'user-regular-staff',
        displayName: 'Junior Clerk',
        role: 'Staff Member',
        approvalTimestamp: '2026-11-25T09:00:00.000Z'
      }
    };

    await expect(
      recordDecision(unauthorizedDecision)
    ).rejects.toThrow(/Incident Commander authorization denied/);
  });

  it('TEST-AUTH-03: Rejects dispatch attempt from user without Incident Commander role', async () => {
    await recordDecision(SAMPLE_APPROVED_DECISION_BETA);

    const unauthorizedCallerOptions = {
      caller: 'user-unauthorized-staff'
    };

    await expect(
      createDispatchTicket({ decisionId: 'DEC-2026-0050' }, unauthorizedCallerOptions)
    ).rejects.toThrow(/Dispatch authorization denied for account 'user-unauthorized-staff'/);
  });

  it('TEST-AUTH-04: Successfully records decision and dispatches when caller is an authorized Incident Commander', async () => {
    const authorizedCommanderDecision = {
      ...SAMPLE_APPROVED_DECISION_BETA,
      decisionId: 'DEC-2026-0079',
      humanApprover: {
        accountId: 'qm:commander-shephard',
        displayName: 'Commander Shephard',
        role: 'Incident Commander',
        approvalTimestamp: '2026-11-25T09:05:00.000Z'
      }
    };

    const recordResult = await recordDecision(authorizedCommanderDecision);
    expect(recordResult.success).toBe(true);
    expect(recordResult.data.humanApprover.role).toBe('Incident Commander');
    expect(recordResult.data.humanApprover.authorizationPolicy).toBe('Jira Project Role: Incident Commander');

    const workingJiraClient = {
      async searchJira() { return []; },
      async requestJira() {
        return { id: '10999', key: 'EMERG-999' };
      }
    };

    const dispatchResult = await createDispatchTicket(
      { decisionId: 'DEC-2026-0079' },
      { caller: 'qm:commander-shephard', customJiraClient: workingJiraClient }
    );
    expect(dispatchResult.success).toBe(true);
    expect(dispatchResult.issueKey).toBe('EMERG-999');
  });
});
