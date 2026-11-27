/**
 * Forge Resolver & Rovo Action Handler Integration Test Suite
 * Asserts dual-compatibility with Custom UI Bridge, Rovo Agent Actions,
 * and immutable Forge KVS Decision Record storage.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  handler,
  recordDecision,
  getDecision,
  listDecisions,
  getDecisionForIssue,
  validateDecisionPayload,
  saveSimulationRun,
  getSimulationStatus,
  saveInterventionsEvaluation,
  evaluateInterventions,
  __resetInMemoryStore
} from '../src/resolvers/index.js';

describe('Forge Resolver & Rovo Action Handler Suite', () => {
  beforeEach(() => {
    __resetInMemoryStore();
  });

  const SAMPLE_DECISION = {
    decisionId: 'DEC-2026-0001',
    scenarioHash: 'sha256-a9f4c3b2184e9071b6',
    baselineStorm: 'NOAA Atlas 14 100-Year 6-Hour Design Event (122.0 mm total depth)',
    chosenPlan: {
      planId: 'plan-beta',
      name: 'Plan Beta: Clear Brookline Avenue Culvert & Deploy High-Capacity Pump #1',
      tradeOffSummary: 'Prevents backwater surge along Brookline Ave and Francis St by restoring culvert conveyance to 12.5 m³/s.'
    },
    humanApprover: {
      accountId: 'qm:commander-vance',
      displayName: 'Captain J. Vance',
      role: 'Incident Commander',
      approvalTimestamp: '2026-11-25T08:00:00.000Z'
    },
    physicalMetrics: {
      peakInundationDepthM: 0.114,
      waterBalanceError: '< 1e-10',
      criticalAccessRoutesPassable: ['Francis St Ambulance Bay', 'Fenwood Rd Route'],
      affectedFacilities: ["Brigham and Women's Hospital"]
    },
    linkedIssueKey: 'EMERG-101'
  };

  it('TEST-RES-01: Handles Custom UI bridge invoke for getSimulationStatus (returns NO_RUN when uninitialized)', async () => {
    const event = {
      call: {
        functionKey: 'getSimulationStatus',
        payload: {},
        jobId: 'job-123'
      },
      context: {
        cloudId: 'test-cloud-id'
      }
    };

    const res = await handler(event, {});
    expect(res).toBeDefined();
    expect(res.status).toBe('NO_RUN');
    expect(res.message).toContain('No simulation run recorded');
  });

  it('TEST-RES-02: Handles Custom UI bridge invoke for evaluateInterventions (returns NO_RUN when Phase 3 unexecuted)', async () => {
    const event = {
      call: {
        functionKey: 'evaluateInterventions',
        payload: {},
        jobId: 'job-124'
      },
      context: {}
    };

    const res = await handler(event, {});
    expect(res).toBeDefined();
    expect(res.status).toBe('NO_RUN');
    expect(res.message).toContain('No multi-scenario intervention evaluation recorded');
  });

  it('TEST-RES-03: Handles Rovo action invocation for get-simulation-status (truth gate: NO_RUN without hardcoded literals)', async () => {
    const rovoEvent = {
      action: {
        key: 'get-simulation-status'
      },
      payload: {}
    };

    const res = await handler(rovoEvent, {});
    expect(res.success).toBe(true);
    expect(res.status).toBe('NO_RUN');
    expect(res.data).toBeUndefined();
  });

  it('TEST-RES-04: Returns real solver metrics when a simulation run has been saved', async () => {
    const realRun = {
      sector: 'Boston Longwood Medical Area (EPSG:26986)',
      gridDimensions: '64x64 regular Cartesian (25m cell, 2.56 km²)',
      stormId: '50-year',
      elapsedSimulationSeconds: 7200,
      totalWaterVolumeM3: 18450.2,
      totalDrainedM3: 4210.8,
      relativeConservationError: '< 1e-10',
      maxWaterDepthM: 0.28,
      impassableRoadsCount: 3,
      atRiskFacilities: ["Brigham and Women's Hospital"]
    };

    await saveSimulationRun(realRun);

    const rovoEvent = {
      action: {
        key: 'get-simulation-status'
      },
      payload: {}
    };

    const res = await handler(rovoEvent, {});
    expect(res.success).toBe(true);
    expect(res.status).toBe('COMPLETED_RUN');
    expect(res.data.maxWaterDepthM).toBe(0.28);
    expect(res.data.impassableRoadsCount).toBe(3);
    expect(res.data.atRiskFacilities).toContain("Brigham and Women's Hospital");
  });


  it('TEST-RES-05: Returns structured error on invalid/unrecognized action key without throwing or exposing stack traces', async () => {
    const maliciousEvent = {
      action: {
        key: 'approve-and-dispatch-dam-release'
      },
      payload: { bypassAuth: true }
    };

    const res = await handler(maliciousEvent, {});
    expect(res.success).toBe(false);
    expect(res.error.code).toBe('UNRECOGNIZED_ACTION');
    expect(res.error.supportedActions).toContain('get-simulation-status');
  });

  it('TEST-RES-05b: Resolves the real Forge Rovo event shape (context.moduleKey, no action field)', async () => {
    // Live-captured shape: event = { context: { moduleKey }, orgId, contextToken }
    const res = await handler({ context: { moduleKey: 'get-simulation-status' }, orgId: 'org-1', contextToken: 'x' }, {});
    expect(res.success).toBe(true);
    expect(res.status).toBe('NO_RUN');
  });

  it('TEST-RES-05c: Reads Rovo inputs from top-level event fields (event.decisionId)', async () => {
    const res = await handler({ decisionId: 'DEC-DOES-NOT-EXIST', context: { moduleKey: 'get-decision-record' } }, {});
    expect(res.success).toBe(false);
    expect(res.error.code).not.toBe('UNRECOGNIZED_ACTION');
  });

  it('TEST-RES-06: Confirms no API keys, tokens, or credentials exposed in payloads', async () => {
    const statusRes = await handler({ action: { key: 'get-simulation-status' } }, {});
    const evalRes = await handler({ action: { key: 'evaluate-interventions' } }, {});

    const statusStr = JSON.stringify(statusRes);
    const evalStr = JSON.stringify(evalRes);

    for (const forbidden of ['token', 'secret', 'password', 'bearer', 'authorization', 'apiKey', 'ATATT']) {
      expect(statusStr.toLowerCase()).not.toContain(forbidden);
      expect(evalStr.toLowerCase()).not.toContain(forbidden);
    }
  });

  const TEST_SERVER_AUTH = {
    accountId: 'qm:commander-vance',
    principal: { accountId: 'qm:commander-vance' }
  };

  it('TEST-KVS-01: Successfully creates immutable Decision Record in KVS', async () => {
    const res = await recordDecision(SAMPLE_DECISION, null, TEST_SERVER_AUTH);
    expect(res.success).toBe(true);
    expect(res.data.decisionId).toBe('DEC-2026-0001');
    expect(res.data.status).toBe('APPROVED');
    expect(res.data.createdAt).toBeDefined();

    // Verify retrievable via getDecision
    const retrieved = await getDecision('DEC-2026-0001');
    expect(retrieved.success).toBe(true);
    expect(retrieved.data.chosenPlan.planId).toBe('plan-beta');
    expect(retrieved.data.humanApprover.displayName).toBe('Captain J. Vance');
  });

  it('TEST-KVS-02: Rejects overwriting an existing Decision Record (append-only immutability)', async () => {
    await recordDecision(SAMPLE_DECISION, null, TEST_SERVER_AUTH);

    // Attempt to tamper with or overwrite existing record
    const tampered = {
      ...SAMPLE_DECISION,
      chosenPlan: {
        ...SAMPLE_DECISION.chosenPlan,
        name: 'Tampered Plan: Malicious Disruption'
      }
    };

    await expect(recordDecision(tampered, null, TEST_SERVER_AUTH)).rejects.toThrow(/Immutable record violation/);

    // Verify original record is unchanged
    const intact = await getDecision('DEC-2026-0001');
    expect(intact.data.chosenPlan.name).toBe('Plan Beta: Clear Brookline Avenue Culvert & Deploy High-Capacity Pump #1');
  });

  it('TEST-KVS-03: Rejects invalid decision payloads missing required fields', async () => {
    expect(() => validateDecisionPayload({})).toThrow(/decisionId must be a non-empty string/);
    expect(() => validateDecisionPayload({ decisionId: 'INVALID-ID' })).toThrow(/starting with "DEC-"/);
    expect(() => validateDecisionPayload({ decisionId: 'DEC-123' })).toThrow(/scenarioHash/);
    expect(() => validateDecisionPayload({
      decisionId: 'DEC-123',
      scenarioHash: 'hash',
      baselineStorm: 'storm'
    })).toThrow(/chosenPlan/);
  });

  it('TEST-KVS-04: Links Decision Record to Jira Issue and retrieves by issue key', async () => {
    await recordDecision(SAMPLE_DECISION, null, TEST_SERVER_AUTH);

    const issueRec = await getDecisionForIssue('EMERG-101');
    expect(issueRec.success).toBe(true);
    expect(issueRec.data.decisionId).toBe('DEC-2026-0001');
    expect(issueRec.data.linkedIssueKey).toBe('EMERG-101');

    // Missing issue returns error code
    const missing = await getDecisionForIssue('EMERG-999');
    expect(missing.success).toBe(false);
    expect(missing.error.code).toBe('NO_DECISION_FOR_ISSUE');
  });

  it('TEST-KVS-05: Lists all decisions in chronological order', async () => {
    await recordDecision(SAMPLE_DECISION, null, TEST_SERVER_AUTH);
    await recordDecision({
      ...SAMPLE_DECISION,
      decisionId: 'DEC-2026-0002',
      linkedIssueKey: 'EMERG-102'
    }, null, TEST_SERVER_AUTH);

    const list = await listDecisions();
    expect(list.success).toBe(true);
    expect(list.count).toBe(2);
    expect(list.data.map((d: any) => d.decisionId)).toEqual(['DEC-2026-0001', 'DEC-2026-0002']);
  });

  it('TEST-KVS-06: Custom UI bridge invokes recordDecision, getDecision, and listDecisions', async () => {
    const recordBridgeCall = {
      call: {
        functionKey: 'recordDecision',
        payload: SAMPLE_DECISION
      },
      context: TEST_SERVER_AUTH
    };
    const recordRes = await handler(recordBridgeCall, TEST_SERVER_AUTH);
    expect(recordRes.success).toBe(true);
    expect(recordRes.data.decisionId).toBe('DEC-2026-0001');

    const getBridgeCall = {
      call: {
        functionKey: 'getDecision',
        payload: { decisionId: 'DEC-2026-0001' }
      }
    };
    const getRes = await handler(getBridgeCall, {});
    expect(getRes.success).toBe(true);
    expect(getRes.data.decisionId).toBe('DEC-2026-0001');

    const listBridgeCall = {
      call: {
        functionKey: 'listDecisions',
        payload: {}
      }
    };
    const listRes = await handler(listBridgeCall, {});
    expect(listRes.success).toBe(true);
    expect(listRes.count).toBe(1);
  });
});
