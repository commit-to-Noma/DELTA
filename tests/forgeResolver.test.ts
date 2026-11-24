/**
 * Forge Resolver & Rovo Action Handler Integration Test Suite
 * Asserts dual-compatibility with Custom UI Bridge and Rovo Agent Actions.
 */

import { describe, it, expect } from 'vitest';
import { handler } from '../src/resolvers/index.js';

describe('Forge Resolver & Rovo Action Handler Suite', () => {
  it('TEST-RES-01: Handles Custom UI bridge invoke for getSimulationStatus', async () => {
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
    expect(res.sector).toContain('Boston Longwood');
    expect(res.gridDimensions).toContain('64x64');
    expect(res.monitoredFacilities.length).toBe(5);
    expect(res.waterBalance.relativeConservationError).toBe('< 1e-10');
  });

  it('TEST-RES-02: Handles Custom UI bridge invoke for evaluateInterventions', async () => {
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
    expect(res.evaluatedAgainstStorm).toContain('NOAA Atlas 14');
    expect(res.candidates.length).toBe(2);
    expect(res.candidates[0].planId).toBe('plan-beta');
    expect(res.candidates[0].approvalRequired).toBe('Human Incident Commander');
  });

  it('TEST-RES-03: Handles Rovo action invocation for get-simulation-status', async () => {
    const rovoEvent = {
      action: {
        key: 'get-simulation-status'
      },
      payload: {}
    };

    const res = await handler(rovoEvent, {});
    expect(res.success).toBe(true);
    expect(res.data.status).toBe('NOMINAL_BASELINE');
    expect(res.data.monitoredFacilities).toContain("Brigham and Women's Hospital");
  });

  it('TEST-RES-04: Handles Rovo action invocation for evaluate-interventions', async () => {
    const rovoEvent = {
      action: {
        key: 'evaluate-interventions'
      },
      payload: {}
    };

    const res = await handler(rovoEvent, {});
    expect(res.success).toBe(true);
    expect(res.data.candidates.length).toBe(2);
    expect(res.data.candidates[0].approvalRequired).toBe('Human Incident Commander');
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
    expect(res.error.supportedActions).toEqual(['get-simulation-status', 'evaluate-interventions']);
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
});
