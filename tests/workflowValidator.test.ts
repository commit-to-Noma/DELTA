/**
 * Jira Workflow Validator Gate Test Suite
 * 
 * Verifies proactive gating logic: transitions are blocked when no approved
 * Decision Record exists in KVS, and allowed when an Incident Commander has
 * approved a deterministic hydraulic plan.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { validateTransition, handler, GATE_ERROR_MESSAGES } from '../src/resolvers/workflowValidator.js';
import { recordDecision, __resetInMemoryStore } from '../src/resolvers/decisionStorage.js';

describe('Jira Workflow Validator Gate Suite', () => {
  beforeEach(() => {
    __resetInMemoryStore();
  });

  const SAMPLE_APPROVED_DECISION = {
    decisionId: 'DEC-2026-0088',
    scenarioHash: 'hash-887766',
    baselineStorm: 'NOAA Atlas 14 100-Year Event',
    chosenPlan: {
      planId: 'plan-beta',
      name: 'Plan Beta: Clear Brookline Culvert'
    },
    humanApprover: {
      displayName: 'Battalion Chief M. Ramos',
      role: 'Incident Commander',
      approvalTimestamp: '2026-11-25T08:30:00.000Z'
    },
    physicalMetrics: {
      peakInundationDepthCm: 14.2
    },
    status: 'APPROVED',
    linkedIssueKey: 'EMERG-200'
  };

  it('TEST-VAL-01: Blocks transition when issue has no linked Decision Record in KVS', async () => {
    const event = {
      issue: {
        id: '10020',
        key: 'EMERG-999'
      },
      transition: {
        id: '31',
        name: 'Dispatch Teams',
        to: 'Dispatched'
      }
    };

    const res = await validateTransition(event);
    expect(res.result).toBe(false);
    expect(res.errorMessage).toBe(GATE_ERROR_MESSAGES.NO_DECISION_RECORD('EMERG-999'));
    expect(res.errorMessage).toContain('cannot transition without an approved mitigation plan');
  });

  it('TEST-VAL-02: Allows transition when issue has a verified APPROVED Decision Record', async () => {
    await recordDecision(SAMPLE_APPROVED_DECISION);

    const event = {
      issue: {
        id: '10020',
        key: 'EMERG-200'
      },
      transition: {
        id: '31',
        name: 'Dispatch Teams',
        to: 'Dispatched'
      }
    };

    const res = await validateTransition(event);
    expect(res.result).toBe(true);
    expect(res.errorMessage).toBeUndefined();
  });

  it('TEST-VAL-03: Blocks transition if Decision Record status is not APPROVED', async () => {
    await recordDecision({
      ...SAMPLE_APPROVED_DECISION,
      decisionId: 'DEC-2026-0089',
      status: 'SUPERSEDED',
      linkedIssueKey: 'EMERG-201'
    });

    const event = {
      issue: { key: 'EMERG-201' },
      transition: { to: 'Dispatched' }
    };

    const res = await validateTransition(event);
    expect(res.result).toBe(false);
    expect(res.errorMessage).toContain("has status 'SUPERSEDED'");
  });

  it('TEST-VAL-04: Blocks transition if Decision Record lacks human approver signature', async () => {
    // Malformed/bypassed record with empty approver
    const storageMock = {
      store: new Map([
        ['issue-decision:EMERG-202', 'DEC-ANON'],
        ['decision:DEC-ANON', {
          decisionId: 'DEC-ANON',
          status: 'APPROVED',
          humanApprover: {} // missing displayName and role
        }]
      ]),
      async get(key: string) { return this.store.get(key); },
      async set(key: string, val: any) { this.store.set(key, val); },
      async delete(key: string) { this.store.delete(key); }
    };

    const event = {
      issue: { key: 'EMERG-202' },
      transition: { to: 'Dispatched' }
    };

    const res = await validateTransition(event, storageMock);
    expect(res.result).toBe(false);
    expect(res.errorMessage).toBe(GATE_ERROR_MESSAGES.MISSING_APPROVER('EMERG-202'));
  });

  it('TEST-VAL-05: Blocks transition cleanly when event is malformed without issue key', async () => {
    const res = await validateTransition({});
    expect(res.result).toBe(false);
    expect(res.errorMessage).toContain('missing valid Jira issue key');
  });

  it('TEST-VAL-06: Forge handler entrypoint catches unexpected exceptions safely', async () => {
    const errorStorage = {
      async get() { throw new Error('KVS Connection Failure'); }
    };

    const res = await handler({ issue: { key: 'EMERG-ERR' } }, {});
    expect(res.result).toBe(false);
    expect(res.errorMessage).toContain('DELTA Gate');
  });
});
