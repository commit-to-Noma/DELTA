/**
 * Jira Service Management (JSM) & Field Dispatch Integration Test Suite
 * 
 * TASK 0.7.1.3 VERIFICATION SUITE (MOCKED INTEGRATION TESTS):
 * All tests in this file execute against local in-memory storage mocks and
 * injected mock Jira REST API clients. No live Jira Cloud API calls are performed.
 * 
 * Verifications:
 * - Server-controlled operational project key ('EMERG') enforcement
 * - Strict server session identity verification (rejection of forged client account IDs)
 * - Incident Commander role enforcement & group-based actor fail-closed policy
 * - Expired in-flight lease transition to UNCERTAIN (prevention of search lag duplicate POSTs)
 * - UNCERTAIN state blocking on zero JQL results
 * - Ambiguous transport/gateway (HTTP 502/503) error classification vs deterministic HTTP 400
 * - JQL Search-Before-Create single ticket adoption and multiple ticket conflict detection
 * - Modelled staging point provenance for Plan Alpha (derived from OSM Way 1377084984 midpoint)
 * - Preserved Plan Beta verified culvert coordinates
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as jsmDispatcherModule from '../src/resolvers/jsmDispatcher.js';
import {
  createDispatchTicket,
  buildDispatchAdfDescription
} from '../src/resolvers/jsmDispatcher.js';
import { handler } from '../src/resolvers/index.js';
import { createTestDispatchTicket } from './helpers/testDispatchEngine.js';
import {
  resolveDispatchLocation,
  validateAndReconcileLocation,
  latLonToProjected,
  projectedToLatLon,
  AUTHORITATIVE_INTERVENTION_LOCATIONS,
  CATCHMENT_BOUNDS
} from '../src/resolvers/coordinates.js';
import { recordDecision, getDecision, __resetInMemoryStore } from '../src/resolvers/decisionStorage.js';
import { OPERATIONAL_PROJECT_KEY } from '../src/resolvers/authPolicy.js';
import { SOURCED_ROAD_FEATURE_1377084984 } from '../src/data/interventionSites.js';

describe('Task 0.7.1.3: Hardened Authorization, Uncertainty & Provenance Suite (Mocked)', () => {
  beforeEach(() => {
    __resetInMemoryStore();
  });

  const COMMANDER_AUTH = {
    accountId: 'qm:839b15ba-58cd-4b57-b8aa-f9b9e6ce67cd:user-commander-1'
  };

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
  // Part A: Coordinate Integrity, Dataset Derivation & Provenance
  // -------------------------------------------------------------
  it('TEST-COORD-01: [Mocked] Derives exact Brookline Culvert coordinates for Plan Beta from dataset', () => {
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

  it('TEST-COORD-02: [Mocked] Derives Plan Alpha location from intermediate centerline vertex (Node 1) of OSM Way 1377084984', () => {
    const loc = resolveDispatchLocation(SAMPLE_APPROVED_DECISION_ALPHA.chosenPlan);
    expect(loc.name).toContain('Modelled Staging Point: Francis Street');
    expect(loc.featureType).toBe('road_segment');
    expect(loc.featureId).toBe('ROAD-1377084984');
    expect(loc.isModelledStagingPoint).toBe(true);
    expect(loc.provenanceNotice).toContain('intermediate centerline vertex (Node 1)');
    expect(loc.provenanceNotice).toContain('Does not constitute a surveyed physical barrier foundation');
    expect(loc.epsg26986.x).toBe(232384.06);
    expect(loc.epsg26986.y).toBe(898414.94);
    expect(loc.wgs84.lat).toBe(42.33556);
    expect(loc.wgs84.lon).toBe(-71.10704);
    expect(loc.gridCell).toEqual([43, 29]);
    // Verify agreement with lightweight sourced road feature geometry
    expect(loc.epsg26986.x).toBe(SOURCED_ROAD_FEATURE_1377084984.projectedCoordinates[1].x);
    expect(loc.epsg26986.y).toBe(SOURCED_ROAD_FEATURE_1377084984.projectedCoordinates[1].y);
  });

  it('TEST-COORD-03: [Mocked] Rejects unrecognized plan without explicit location with UNRESOLVED_INTERVENTION_LOCATION', () => {
    const unknownPlan = { planId: 'plan-custom-unknown', name: 'Plan Custom' };
    expect(() => resolveDispatchLocation(unknownPlan)).toThrow(/Unresolved intervention location/);
  });

  it('TEST-COORD-04: [Mocked] Rejects out-of-domain coordinates', () => {
    const defectiveLoc = {
      name: 'Audited Defect Location',
      epsg26986: { x: 233400.0, y: 894200.0 }
    };
    expect(() => validateAndReconcileLocation(defectiveLoc)).toThrow(/Out of bounds coordinates/);
  });

  it('TEST-COORD-05: [Mocked] Rejects mathematically inconsistent WGS84 and EPSG:26986 coordinates (> 25m drift)', () => {
    const inconsistentLoc = {
      name: 'Mismatched Location',
      wgs84: { lat: 42.34150, lon: -71.10800 },
      epsg26986: { x: 232800.0, y: 898500.0 }
    };
    expect(() => validateAndReconcileLocation(inconsistentLoc)).toThrow(/Coordinate inconsistency/);
  });

  it('TEST-COORD-06: [Mocked] Forward projects WGS84 to EPSG:26986 when only WGS84 is provided', () => {
    const geoOnly = {
      name: 'GPS Field Marker',
      wgs84: { lat: 42.34150, lon: -71.10800 }
    };
    const reconciled = validateAndReconcileLocation(geoOnly);
    expect(reconciled.epsg26986.x).toBeCloseTo(232302.11, 0);
    expect(reconciled.epsg26986.y).toBeCloseTo(899074.88, 0);
    expect(reconciled.gridCell).toEqual([17, 26]);
  });

  it('TEST-COORD-07: [Mocked] Inverse projects EPSG:26986 to WGS84 when only projected is provided', () => {
    const projOnly = {
      name: 'Grid Staging Station',
      epsg26986: { x: 232302.11, y: 899074.88 }
    };
    const reconciled = validateAndReconcileLocation(projOnly);
    expect(reconciled.wgs84.lat).toBeCloseTo(42.34150, 4);
    expect(reconciled.wgs84.lon).toBeCloseTo(-71.10800, 4);
  });

  it('TEST-COORD-08: [Mocked] Embeds modelled staging provenance notice in generated ADF document', () => {
    const loc = resolveDispatchLocation(SAMPLE_APPROVED_DECISION_ALPHA.chosenPlan);
    const adf = buildDispatchAdfDescription(
      { decisionId: 'DEC-2026-0051', priority: 'Highest' },
      SAMPLE_APPROVED_DECISION_ALPHA,
      loc,
      'delta-disp-dec-2026-0051-plan-alpha'
    );
    const jsonStr = JSON.stringify(adf);

    expect(jsonStr).toContain('Modelled Staging Point: Francis Street');
    expect(jsonStr).toContain('Staging Provenance:');
    expect(jsonStr).toContain('Does not constitute a surveyed physical barrier foundation');
    expect(jsonStr).not.toContain('233,400');
    expect(jsonStr).not.toContain('894,200');
  });

  // -------------------------------------------------------------
  // Part B: Server-Side Dispatch Killswitch Enforcement (Phase 0.7.2)
  // -------------------------------------------------------------
  it('TEST-KILLSWITCH-01: [Mocked] Direct createDispatchTicket invocation is blocked when dispatch is disabled', async () => {
    await recordDecision(SAMPLE_APPROVED_DECISION_BETA, null, COMMANDER_AUTH);

    let thrownError: any;
    try {
      await createDispatchTicket({ decisionId: 'DEC-2026-0050' }, AUTH_OPTIONS);
    } catch (err: any) {
      thrownError = err;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError.code).toBe('DISPATCH_FEATURE_DISABLED');
    expect(thrownError.message).toContain('DELTA Field Dispatch is technically disabled');
  });

  it('TEST-KILLSWITCH-02: [Mocked] Exposed resolver bridge and Rovo entry points are blocked when dispatch is disabled', async () => {
    await recordDecision(SAMPLE_APPROVED_DECISION_BETA, null, COMMANDER_AUTH);

    // 1. Custom UI bridge createDispatchTicket
    const bridgeCall1 = {
      call: {
        functionKey: 'createDispatchTicket',
        payload: { decisionId: 'DEC-2026-0050' }
      },
      context: COMMANDER_AUTH
    };
    await expect(handler(bridgeCall1, COMMANDER_AUTH)).rejects.toThrow(/DELTA Field Dispatch is technically disabled/);

    // 2. Custom UI bridge dispatchFieldTeam
    const bridgeCall2 = {
      call: {
        functionKey: 'dispatchFieldTeam',
        payload: { decisionId: 'DEC-2026-0050' }
      },
      context: COMMANDER_AUTH
    };
    await expect(handler(bridgeCall2, COMMANDER_AUTH)).rejects.toThrow(/DELTA Field Dispatch is technically disabled/);

    // 3. Rovo action / backend dispatch-field-team
    const rovoCall = {
      action: { key: 'dispatch-field-team' },
      payload: { decisionId: 'DEC-2026-0050' }
    };
    await expect(handler(rovoCall, COMMANDER_AUTH)).rejects.toThrow(/DELTA Field Dispatch is technically disabled/);
  });

  it('TEST-KILLSWITCH-03: [Mocked] No KVS lease is acquired and no Jira request is made when dispatch is disabled', async () => {
    await recordDecision(SAMPLE_APPROVED_DECISION_BETA, null, COMMANDER_AUTH);

    let kvsSetCalled = false;
    let jiraRequestCalled = false;

    const monitoredStorage = {
      async get(key: string) { return undefined; },
      async set(key: string, val: any) { kvsSetCalled = true; },
      async delete(key: string) {}
    };

    const monitoredJiraClient = {
      async searchJira() { return []; },
      async requestJira() { jiraRequestCalled = true; return {}; }
    };

    let thrownErr: any;
    try {
      await createDispatchTicket(
        { decisionId: 'DEC-2026-0050' },
        { ...AUTH_OPTIONS, storageOverride: monitoredStorage, customJiraClient: monitoredJiraClient }
      );
    } catch (err: any) {
      thrownErr = err;
    }

    expect(thrownErr).toBeDefined();
    expect(thrownErr.code).toBe('DISPATCH_FEATURE_DISABLED');
    expect(thrownErr.message).toContain('DELTA Field Dispatch is technically disabled');

    // Strictly assert zero side-effects
    expect(kvsSetCalled).toBe(false);
    expect(jiraRequestCalled).toBe(false);
  });

  it('TEST-KILLSWITCH-04: [Mocked] Static verification that production jsmDispatcher exports zero setters and no mutable flags', () => {
    // 1. Verify exact export surface of production resolver module
    const exportedKeys = Object.keys(jsmDispatcherModule).sort();
    expect(exportedKeys).toEqual(['buildDispatchAdfDescription', 'createDispatchTicket']);

    // 2. Assert LIVE_DISPATCH_ENABLED is NOT exported
    expect((jsmDispatcherModule as any).LIVE_DISPATCH_ENABLED).toBeUndefined();

    // 3. Assert no setter or override function exists
    expect((jsmDispatcherModule as any).__setLiveDispatchEnabledForTesting).toBeUndefined();
    expect((jsmDispatcherModule as any).setLiveDispatchEnabled).toBeUndefined();
  });

  // -------------------------------------------------------------
  // Part C: Hardened Authorization & Project Scope Enforcement
  // -------------------------------------------------------------
  it('TEST-AUTH-01: [Mocked] Rejects client attempt to override operational project key during decision approval', async () => {
    const tamperingPayload = {
      ...SAMPLE_APPROVED_DECISION_BETA,
      decisionId: 'DEC-2026-0060',
      linkedIssueKey: 'HACK-100' // Client attempts to bind to outside project
    };

    await expect(
      recordDecision(tamperingPayload, null, COMMANDER_AUTH)
    ).rejects.toThrow(/Project scope mismatch/);
  });

  it('TEST-AUTH-03: [Mocked] Rejects approval when server session identity is missing even if client provides accountId', async () => {
    // Calling recordDecision with empty server context {} (missing trusted accountId)
    await expect(
      recordDecision(SAMPLE_APPROVED_DECISION_BETA, null, {})
    ).rejects.toThrow(/Authentication failure: Missing or unverified Jira user identity/);
  });

  it('TEST-AUTH-05: [Mocked] Enforces server-side approver verification (client vs server session mismatch)', async () => {
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

    await expect(
      recordDecision(maliciousPayload, null, { accountId: 'legitimate-jira-user-account-id' })
    ).rejects.toThrow(/Approver authentication mismatch/);
  });

  it('TEST-AUTH-06: [Mocked] Rejects decision approval from user without Incident Commander role', async () => {
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
      recordDecision(unauthorizedDecision, null, { accountId: 'user-regular-staff' })
    ).rejects.toThrow(/Incident Commander authorization denied/);
  });

  it('TEST-AUTH-09: [Mocked] Fails closed when Jira Project Role API call fails', async () => {
    const apiFailingPolicy = {
      async verifyAuthorization() {
        return {
          isAuthorized: false,
          reason: "Unable to query project roles for 'EMERG': HTTP 403 Forbidden. Fail-closed."
        };
      }
    };

    const payload = {
      ...SAMPLE_APPROVED_DECISION_BETA,
      decisionId: 'DEC-2026-0081',
      humanApprover: {
        ...SAMPLE_APPROVED_DECISION_BETA.humanApprover,
        accountId: 'qm:commander-shephard'
      }
    };

    await expect(
      recordDecision(payload, null, {
        accountId: 'qm:commander-shephard',
        customAuthPolicy: apiFailingPolicy
      })
    ).rejects.toThrow(/HTTP 403 Forbidden\. Fail-closed/);
  });

  it('TEST-AUTH-10: [Mocked] Fails closed when user is assigned to role via group rather than direct user assignment', async () => {
    const groupOnlyPolicy = {
      async verifyAuthorization() {
        return {
          isAuthorized: false,
          reason: "User is not directly assigned to role 'Incident Commanders'. DELTA requires direct user assignment in Project Settings; group-based role assignments cannot be verified under current permissions and fail closed for critical municipal command."
        };
      }
    };

    const payload = {
      ...SAMPLE_APPROVED_DECISION_BETA,
      decisionId: 'DEC-2026-0082',
      humanApprover: {
        ...SAMPLE_APPROVED_DECISION_BETA.humanApprover,
        accountId: 'qm:user-in-group'
      }
    };

    await expect(
      recordDecision(payload, null, {
        accountId: 'qm:user-in-group',
        customAuthPolicy: groupOnlyPolicy
      })
    ).rejects.toThrow(/group-based role assignments cannot be verified.*fail closed/);
  });

  it('TEST-AUTH-11: [Mocked] Rejects raw string account ID in authContext (requires trusted Forge context object)', async () => {
    // Attempting to pass a raw string 'qm:user-commander-1' instead of an object { accountId: '...' }
    await expect(
      recordDecision(SAMPLE_APPROVED_DECISION_BETA, null, 'qm:839b15ba-58cd-4b57-b8aa-f9b9e6ce67cd:user-commander-1' as any)
    ).rejects.toThrow(/Authentication failure: Missing or unverified Jira user identity/);
  });

  // -------------------------------------------------------------
  // Part D: Isolated Dispatch Engine Mechanics & Recovery Suite (Test-Only Harness)
  // -------------------------------------------------------------
  describe('Part D: Isolated Dispatch Engine Mechanics & Recovery Suite (Test-Only Harness)', () => {
    it('TEST-AUTH-02: [Mocked] Rejects client attempt to override projectKey during field dispatch', async () => {
      await recordDecision(SAMPLE_APPROVED_DECISION_BETA, null, COMMANDER_AUTH);

      const orderWithTamperedProject = {
        decisionId: 'DEC-2026-0050',
        projectKey: 'UNAUTHORIZED_PROJECT'
      };

      await expect(
        createTestDispatchTicket(orderWithTamperedProject, AUTH_OPTIONS)
      ).rejects.toThrow(/Project scope mismatch/);
    });

    it('TEST-AUTH-04: [Mocked] Rejects dispatch when server session identity is missing even if client provides caller in payload', async () => {
      await recordDecision(SAMPLE_APPROVED_DECISION_BETA, null, COMMANDER_AUTH);

      // Caller is omitted from server context; client attempts to pass caller in order payload
      await expect(
        createTestDispatchTicket({ decisionId: 'DEC-2026-0050', caller: 'forged-caller-id' }, {})
      ).rejects.toThrow(/Dispatch authorization denied: Missing or unverified Jira user identity/);
    });

    it('TEST-AUTH-07: [Mocked] Rejects dispatch attempt from user without Incident Commander role', async () => {
      await recordDecision(SAMPLE_APPROVED_DECISION_BETA, null, COMMANDER_AUTH);

      await expect(
        createTestDispatchTicket({ decisionId: 'DEC-2026-0050' }, { caller: 'user-unauthorized-staff' })
      ).rejects.toThrow(/Dispatch authorization denied for account 'user-unauthorized-staff'/);
    });

    it('TEST-AUTH-08: [Mocked] Successfully approves and dispatches when caller is an authorized Incident Commander', async () => {
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

      const recordResult = await recordDecision(authorizedCommanderDecision, null, { accountId: 'qm:commander-shephard' });
      expect(recordResult.success).toBe(true);
      expect(recordResult.data.humanApprover.role).toBe('Incident Commander');
      expect(recordResult.data.humanApprover.authorizationPolicy).toBe('Jira Project Role: Incident Commander');

      const workingJiraClient = {
        async searchJira() { return []; },
        async requestJira() { return { id: '10999', key: 'EMERG-999' }; }
      };

      const dispatchResult = await createTestDispatchTicket(
        { decisionId: 'DEC-2026-0079' },
        { caller: 'qm:commander-shephard', customJiraClient: workingJiraClient }
      );
      expect(dispatchResult.success).toBe(true);
      expect(dispatchResult.issueKey).toBe('EMERG-999');
    });

  // -------------------------------------------------------------
  // Part C: Dispatch Idempotency, Uncertainty & Search Lag Recovery
  // -------------------------------------------------------------
  it('TEST-IDEMP-01: [Mocked] Rejects dispatch if Decision Record status is not APPROVED', async () => {
    await recordDecision({
      ...SAMPLE_APPROVED_DECISION_BETA,
      decisionId: 'DEC-2026-0099',
      status: 'SUPERSEDED'
    }, null, COMMANDER_AUTH);

    await expect(createTestDispatchTicket({ decisionId: 'DEC-2026-0099' }, AUTH_OPTIONS))
      .rejects.toThrow(/Only 'APPROVED' decisions may be dispatched/);
  });

  it('TEST-IDEMP-02: [Mocked] Repeated dispatch returns existing ticket reference without duplicate creation', async () => {
    await recordDecision(SAMPLE_APPROVED_DECISION_BETA, null, COMMANDER_AUTH);

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
          self: 'https://test/issue/10888'
        };
      }
    };

    const firstResult = await createTestDispatchTicket(
      { decisionId: 'DEC-2026-0050' },
      { ...AUTH_OPTIONS, customJiraClient: mockJiraClient }
    );
    expect(firstResult.success).toBe(true);
    expect(firstResult.issueKey).toBe('EMERG-700');
    expect(firstResult.isExisting).toBeUndefined();
    expect(apiInvocationCount).toBe(1);

    const secondResult = await createTestDispatchTicket(
      { decisionId: 'DEC-2026-0050' },
      { ...AUTH_OPTIONS, customJiraClient: mockJiraClient }
    );
    expect(secondResult.success).toBe(true);
    expect(secondResult.isExisting).toBe(true);
    expect(secondResult.issueKey).toBe('EMERG-700');
    expect(apiInvocationCount).toBe(1); // No second POST call
  });

  it('TEST-IDEMP-03: [Mocked] Rejects concurrent dispatch while in-flight lease is active (< 60s)', async () => {
    await recordDecision(SAMPLE_APPROVED_DECISION_BETA, null, COMMANDER_AUTH);

    const slowJiraClient = {
      async requestJira(path: string) {
        if (typeof path === 'string' && path.includes('/search')) return { issues: [] };
        await new Promise((r) => setTimeout(r, 60));
        return { id: '10999', key: 'EMERG-701' };
      }
    };

    const firstDispatchPromise = createTestDispatchTicket(
      { decisionId: 'DEC-2026-0050' },
      { ...AUTH_OPTIONS, customJiraClient: slowJiraClient }
    );

    await new Promise((r) => setTimeout(r, 10));

    await expect(
      createTestDispatchTicket(
        { decisionId: 'DEC-2026-0050' },
        { ...AUTH_OPTIONS, customJiraClient: slowJiraClient }
      )
    ).rejects.toThrow(/Concurrent dispatch in progress/);

    await firstDispatchPromise;
  });

  it('TEST-IDEMP-04: [Mocked] Expired in-flight lease (> 60s) transitions to UNCERTAIN and blocks automated POST on retry', async () => {
    const store = new Map();
    const storageClient = {
      async get(key: string) { return store.get(key); },
      async set(key: string, val: any) { store.set(key, val); },
      async delete(key: string) { store.delete(key); }
    };

    await recordDecision(SAMPLE_APPROVED_DECISION_BETA, storageClient, COMMANDER_AUTH);

    // Simulate an abandoned/stuck in-flight lease initiated 75 seconds ago
    const expiredTimestamp = new Date(Date.now() - 75000).toISOString();
    await storageClient.set('dispatch-record:DEC-2026-0050:plan-beta', {
      status: 'PENDING_CREATION',
      decisionId: 'DEC-2026-0050',
      planId: 'plan-beta',
      operationId: 'delta-disp-dec-2026-0050-plan-beta',
      initiatedAt: expiredTimestamp,
      initiatedBy: 'qm:839b15ba-58cd-4b57-b8aa-f9b9e6ce67cd:user-commander-1'
    });

    let postAttempted = false;
    const searchLagClient = {
      // Simulate search index lag: JQL returns 0 results even if issue was created
      async searchJira() { return []; },
      async requestJira() {
        postAttempted = true;
        return { id: '10999', key: 'EMERG-SHOULD-NEVER-BE-CREATED' };
      }
    };

    // Retry invocation must transition to UNCERTAIN and FAIL CLOSED, never issuing a POST
    await expect(
      createTestDispatchTicket(
        { decisionId: 'DEC-2026-0050' },
        { ...AUTH_OPTIONS, customJiraClient: searchLagClient, storageOverride: storageClient }
      )
    ).rejects.toThrow(/lease expired after.*State transitioned to UNCERTAIN.*Automated issue creation blocked/);

    expect(postAttempted).toBe(false);

    // Verify KVS was updated to UNCERTAIN
    const state = await storageClient.get('dispatch-record:DEC-2026-0050:plan-beta');
    expect(state.status).toBe('UNCERTAIN');
    expect(state.error).toContain('lease expired');
  });

  it('TEST-IDEMP-05: [Mocked] Ambiguous HTTP 502/503 gateway error marks UNCERTAIN and blocks subsequent automated retries', async () => {
    const store = new Map();
    const storageClient = {
      async get(key: string) { return store.get(key); },
      async set(key: string, val: any) { store.set(key, val); },
      async delete(key: string) { store.delete(key); }
    };

    await recordDecision(SAMPLE_APPROVED_DECISION_BETA, storageClient, COMMANDER_AUTH);

    const gatewayErrorClient = {
      async searchJira() { return []; },
      async requestJira() {
        const err = new Error('HTTP 502 Bad Gateway: Cloudflare / AWS edge connection dropped');
        (err as any).status = 502;
        throw err;
      }
    };

    // First attempt: encounters 502 -> marks UNCERTAIN in KVS
    await expect(
      createTestDispatchTicket(
        { decisionId: 'DEC-2026-0050' },
        { ...AUTH_OPTIONS, customJiraClient: gatewayErrorClient, storageOverride: storageClient }
      )
    ).rejects.toThrow(/ambiguous network or gateway failure/);

    const savedState = await storageClient.get('dispatch-record:DEC-2026-0050:plan-beta');
    expect(savedState.status).toBe('UNCERTAIN');

    // Second automated retry while JQL returns 0 (due to index lag): must reject with DISPATCH_UNCERTAIN
    let secondPostAttempted = false;
    const retryClient = {
      async searchJira() { return []; },
      async requestJira() {
        secondPostAttempted = true;
        return { id: '10999', key: 'EMERG-SHOULD-NOT-POST' };
      }
    };

    await expect(
      createTestDispatchTicket(
        { decisionId: 'DEC-2026-0050' },
        { ...AUTH_OPTIONS, customJiraClient: retryClient, storageOverride: storageClient }
      )
    ).rejects.toThrow(/is in an UNCERTAIN state/);

    expect(secondPostAttempted).toBe(false);
  });

  it('TEST-IDEMP-06: [Mocked] Deterministic client error (HTTP 400) cleans up lease and allows safe retry', async () => {
    await recordDecision(SAMPLE_APPROVED_DECISION_BETA, null, COMMANDER_AUTH);

    const failingClient = {
      async searchJira() { return []; },
      async requestJira() {
        const err = new Error('HTTP 400 Bad Request: Invalid field payload schema');
        (err as any).status = 400;
        throw err;
      }
    };

    await expect(
      createTestDispatchTicket(
        { decisionId: 'DEC-2026-0050' },
        { ...AUTH_OPTIONS, customJiraClient: failingClient }
      )
    ).rejects.toThrow(/JSM Dispatch Jira API Failure/);

    // Working client on retry: lease was cleanly removed, safe to proceed
    const workingClient = {
      async searchJira() { return []; },
      async requestJira() { return { id: '10555', key: 'EMERG-705' }; }
    };

    const retryResult = await createTestDispatchTicket(
      { decisionId: 'DEC-2026-0050' },
      { ...AUTH_OPTIONS, customJiraClient: workingClient }
    );
    expect(retryResult.success).toBe(true);
    expect(retryResult.issueKey).toBe('EMERG-705');
  });

  it('TEST-IDEMP-07: [Mocked] JQL Search-Before-Create reconciles and adopts single existing Jira ticket', async () => {
    await recordDecision(SAMPLE_APPROVED_DECISION_BETA, null, COMMANDER_AUTH);

    let createCalled = false;
    const reconcilingClient = {
      async searchJira(jql: string) {
        expect(jql).toContain('delta-disp-dec-2026-0050-plan-beta');
        return [{ id: '10888', key: 'EMERG-800', self: 'https://test/issue/10888' }];
      },
      async requestJira() {
        createCalled = true;
        return { id: '10999', key: 'EMERG-WRONG' };
      }
    };

    const result = await createTestDispatchTicket(
      { decisionId: 'DEC-2026-0050' },
      { ...AUTH_OPTIONS, customJiraClient: reconcilingClient }
    );

    expect(result.success).toBe(true);
    expect(result.issueKey).toBe('EMERG-800');
    expect(result.isExisting).toBe(true);
    expect(result.reconciledFromJira).toBe(true);
    expect(createCalled).toBe(false);

    const updated = await getDecision('DEC-2026-0050');
    expect(updated.data.status).toBe('DISPATCHED');
    expect(updated.data.dispatchedIssueKey).toBe('EMERG-800');
  });

  it('TEST-IDEMP-08: [Mocked] JQL Search-Before-Create fails closed with DUPLICATE_DISPATCH_CONFLICT on multiple tickets', async () => {
    await recordDecision(SAMPLE_APPROVED_DECISION_BETA, null, COMMANDER_AUTH);

    const conflictingClient = {
      async searchJira() {
        return [
          { id: '10001', key: 'EMERG-801' },
          { id: '10002', key: 'EMERG-802' }
        ];
      }
    };

    await expect(
      createTestDispatchTicket(
        { decisionId: 'DEC-2026-0050' },
        { ...AUTH_OPTIONS, customJiraClient: conflictingClient }
      )
    ).rejects.toThrow(/Reconciliation conflict: Found 2 existing Jira issues/);
  });

  it('TEST-IDEMP-09: [Mocked] Preserves Jira ticket and returns kvsSyncWarning if KVS write fails after creation', async () => {
    const workingJiraClient = {
      async searchJira() { return []; },
      async requestJira() { return { id: '10555', key: 'EMERG-703', self: 'https://test/issue/10555' }; }
    };

    const store = new Map();
    const failingStorageClient = {
      async get(key: string) { return store.get(key); },
      async set(key: string, val: any) {
        if (key.startsWith('dispatch-record:') && val.status === 'DISPATCHED') {
          throw new Error('KVS Network Timeout during persistence');
        }
        store.set(key, val);
      },
      async delete(key: string) { store.delete(key); }
    };

    await recordDecision(SAMPLE_APPROVED_DECISION_BETA, failingStorageClient, COMMANDER_AUTH);

    const result = await createTestDispatchTicket(
      { decisionId: 'DEC-2026-0050' },
      { ...AUTH_OPTIONS, customJiraClient: workingJiraClient, storageOverride: failingStorageClient }
    );

    expect(result.success).toBe(true);
    expect(result.issueKey).toBe('EMERG-703');
    expect(result.kvsSyncWarning).toContain('KVS record update failed');
  });

  it('TEST-IDEMP-10: [Mocked] Recovers from KVS failure via JQL search reconciliation on retry without duplicate ticket', async () => {
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

    await recordDecision(SAMPLE_APPROVED_DECISION_BETA, flakyStorage, COMMANDER_AUTH);

    const jiraStore = new Map<string, any>();
    const durableJiraClient = {
      async searchJira(jql: string) {
        const results: any[] = [];
        for (const [, issue] of jiraStore.entries()) {
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

    // First run creates ticket in Jira, KVS sync fails
    const firstRes = await createTestDispatchTicket(
      { decisionId: 'DEC-2026-0050' },
      { ...AUTH_OPTIONS, customJiraClient: durableJiraClient, storageOverride: flakyStorage }
    );
    expect(firstRes.success).toBe(true);
    expect(firstRes.issueKey).toBe('EMERG-777');
    expect(firstRes.kvsSyncWarning).toBeDefined();

    // Healed storage on retry: JQL search finds EMERG-777 and adopts without duplicate creation
    const healedStorage = {
      async get(key: string) { return store.get(key); },
      async set(key: string, val: any) { store.set(key, val); },
      async delete(key: string) { store.delete(key); }
    };

    const retryRes = await createTestDispatchTicket(
      { decisionId: 'DEC-2026-0050' },
      { ...AUTH_OPTIONS, customJiraClient: durableJiraClient, storageOverride: healedStorage }
    );
    expect(retryRes.success).toBe(true);
    expect(retryRes.issueKey).toBe('EMERG-777');
    expect(retryRes.reconciledFromJira).toBe(true);
    expect(jiraStore.size).toBe(1); // Exactly one ticket created!
  });
});
});
