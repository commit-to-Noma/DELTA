/**
 * DELTA - Phase 6: Jira Issue Panel & Issue Linkage Verification Test Suite
 * 
 * Verifies:
 * 1. Retrieval of linked decision record for a Jira issue key via getDecisionForIssue.
 * 2. Graceful return when an issue has no linked decision (NO_DECISION_FOR_ISSUE).
 * 3. Authorized linking of an approved decision to a Jira issue via linkDecisionToIssue.
 * 4. Rejection of linking by unauthenticated callers (UNAUTHENTICATED_SESSION).
 * 5. Rejection of linking by callers lacking Incident Commander role (UNAUTHORIZED_INCIDENT_COMMANDER).
 * 6. Rejection of linking a non-existent decision (DECISION_NOT_FOUND).
 * 7. Rejection of linking an unapproved or rejected decision (UNAPPROVED_DECISION_LINK).
 * 8. Dynamic project scoping enforcement (trusted Forge project mismatch yields INVALID_PROJECT_SCOPE).
 * 9. Custom UI Bridge invocation handling for getDecisionForIssue and linkDecisionToIssue.
 * 10. Bidirectional relationship preservation (issue-decision index and decision.linkedIssueKey).
 * 11. Preserving decision record immutability, metrics, and scenario hash upon issue linkage.
 * 12. Manifest verification of jira:issuePanel module configuration.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  recordDecision,
  getDecision,
  getDecisionForIssue,
  linkDecisionToIssue,
  listDecisions,
  __resetInMemoryStore
} from '../src/resolvers/decisionStorage.js';
import { handler } from '../src/resolvers/index.js';

describe('Phase 6: Jira Issue Panel & Linkage Verification Suite', () => {
  beforeEach(() => {
    __resetInMemoryStore();
  });

  const COMMANDER_AUTH = {
    accountId: 'qm:commander-vance',
    principal: { accountId: 'qm:commander-vance' },
    role: 'Incident Commander'
  };

  const NON_COMMANDER_AUTH = {
    accountId: 'user-civilian-analyst',
    principal: { accountId: 'user-civilian-analyst' },
    role: 'Analyst'
  };

  const APPROVED_DECISION_PAYLOAD = {
    decisionId: 'DEC-2026-0601',
    schemaVersion: '2.0.0',
    scenarioHash: 'sha256:7f8e3a2b1c4d9e0f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f',
    chosenPlan: {
      planId: 'plan-gamma',
      name: 'Plan Gamma: Emergency High-Velocity Culvert Jetting',
      type: 'culvert_jetting'
    },
    engineeringRationale: 'Authorized emergency jetting to clear Muddy River Brookline culvert obstruction and restore Francis Street hospital corridor passability.',
    status: 'APPROVED',
    baselineMetrics: {
      currentStorageM3: 38250,
      maxWaterDepthM: 0.285,
      impassableRoadCount: 3
    },
    interventionMetrics: {
      currentStorageM3: 26830,
      maxWaterDepthM: 0.165,
      impassableRoadCount: 1
    },
    differentialMetrics: {
      avoidedSurfaceVolumeM3: 11420,
      peakDepthReductionM: 0.120,
      protectedRoadCount: 2,
      protectedRoadNames: ['Francis St (Ambulance Bay Route)', 'Fenwood Rd']
    },
    humanApprover: {
      displayName: 'Cmdr. Vance'
    }
  };

  // TEST 1: Retrieve linked decision for an issue
  it('TEST-PANEL-01: Retrieves linked decision record for an issue key', async () => {
    // Record with linkedIssueKey
    await recordDecision({
      ...APPROVED_DECISION_PAYLOAD,
      linkedIssueKey: 'EMERG-101'
    }, null, COMMANDER_AUTH);

    const res = await getDecisionForIssue('EMERG-101');
    expect(res.success).toBe(true);
    expect(res.data.decisionId).toBe('DEC-2026-0601');
    expect(res.data.chosenPlan.planId).toBe('plan-gamma');
    expect(res.data.differentialMetrics.avoidedSurfaceVolumeM3).toBe(11420);
  });

  // TEST 2: Gracefully handles unlinked issue
  it('TEST-PANEL-02: Returns structured NO_DECISION_FOR_ISSUE when issue has no linked decision', async () => {
    const res = await getDecisionForIssue('EMERG-999');
    expect(res.success).toBe(false);
    expect(res.error.code).toBe('NO_DECISION_FOR_ISSUE');
    expect(res.error.message).toContain('No approved decision record has been linked');
  });

  // TEST 3: Authorized linking of an approved decision to an issue
  it('TEST-PANEL-03: Authoritatively links an approved decision to a Jira issue key', async () => {
    // Record decision without prior issue link
    await recordDecision(APPROVED_DECISION_PAYLOAD, null, COMMANDER_AUTH);

    const linkRes = await linkDecisionToIssue({
      issueKey: 'EMERG-202',
      decisionId: 'DEC-2026-0601'
    }, null, COMMANDER_AUTH);

    expect(linkRes.success).toBe(true);
    expect(linkRes.data.issueKey).toBe('EMERG-202');
    expect(linkRes.data.decisionId).toBe('DEC-2026-0601');

    // Verify retrievable via getDecisionForIssue
    const retrieved = await getDecisionForIssue('EMERG-202');
    expect(retrieved.success).toBe(true);
    expect(retrieved.data.decisionId).toBe('DEC-2026-0601');
    expect(retrieved.data.linkedIssueKey).toBe('EMERG-202');
  });

  // TEST 4: Rejection of linking by unauthenticated caller
  it('TEST-PANEL-04: Rejects linking attempt by unauthenticated caller with UNAUTHENTICATED_SESSION', async () => {
    await recordDecision(APPROVED_DECISION_PAYLOAD, null, COMMANDER_AUTH);

    await expect(linkDecisionToIssue({
      issueKey: 'EMERG-202',
      decisionId: 'DEC-2026-0601'
    }, null, null)).rejects.toThrow(/Authentication failure/);

    await expect(linkDecisionToIssue({
      issueKey: 'EMERG-202',
      decisionId: 'DEC-2026-0601'
    }, null, {})).rejects.toThrow(/Authentication failure/);
  });

  // TEST 5: Rejection of linking by non-Incident-Commander user
  it('TEST-PANEL-05: Rejects linking attempt by user without Incident Commander authority', async () => {
    await recordDecision(APPROVED_DECISION_PAYLOAD, null, COMMANDER_AUTH);

    await expect(linkDecisionToIssue({
      issueKey: 'EMERG-202',
      decisionId: 'DEC-2026-0601'
    }, null, NON_COMMANDER_AUTH)).rejects.toThrow(/Incident Commander authorization denied/);
  });

  // TEST 6: Rejection of linking a non-existent decision
  it('TEST-PANEL-06: Rejects linking non-existent decision ID with DECISION_NOT_FOUND', async () => {
    await expect(linkDecisionToIssue({
      issueKey: 'EMERG-202',
      decisionId: 'DEC-DOES-NOT-EXIST'
    }, null, COMMANDER_AUTH)).rejects.toThrow(/Decision not found/);
  });

  // TEST 7: Rejection of linking an unapproved/rejected decision
  it('TEST-PANEL-07: Rejects linking an unapproved decision with UNAPPROVED_DECISION_LINK', async () => {
    await recordDecision({
      ...APPROVED_DECISION_PAYLOAD,
      decisionId: 'DEC-REJECTED-01',
      status: 'REJECTED_BY_COMMANDER'
    }, null, COMMANDER_AUTH);

    await expect(linkDecisionToIssue({
      issueKey: 'EMERG-202',
      decisionId: 'DEC-REJECTED-01'
    }, null, COMMANDER_AUTH)).rejects.toThrow(/Only APPROVED decision records can be linked/);
  });

  // TEST 8: Strict project scoping enforcement
  it('TEST-PANEL-08: Rejects linking when issue project differs from trusted Forge project', async () => {
    await recordDecision(APPROVED_DECISION_PAYLOAD, null, COMMANDER_AUTH);
    const trustedAuth = { ...COMMANDER_AUTH, context: { extension: { project: { key: 'EMERG' } } } };
    await expect(linkDecisionToIssue({
      issueKey: 'PROJ-101',
      decisionId: 'DEC-2026-0601'
    }, null, trustedAuth)).rejects.toThrow(/Project scope mismatch/);
  });

  // TEST 9: Custom UI Bridge invocation handling
  it('TEST-PANEL-09: Custom UI bridge invokes getDecisionForIssue and linkDecisionToIssue gracefully', async () => {
    await recordDecision({
      ...APPROVED_DECISION_PAYLOAD,
      linkedIssueKey: 'EMERG-105'
    }, null, COMMANDER_AUTH);

    // Call getDecisionForIssue via bridge event
    const getBridgeEvent = {
      call: {
        functionKey: 'getDecisionForIssue',
        payload: { issueKey: 'EMERG-105' }
      },
      context: COMMANDER_AUTH
    };

    const getRes = await handler(getBridgeEvent, COMMANDER_AUTH);
    expect(getRes.success).toBe(true);
    expect(getRes.data.decisionId).toBe('DEC-2026-0601');

    // Call linkDecisionToIssue via bridge event
    const linkBridgeEvent = {
      call: {
        functionKey: 'linkDecisionToIssue',
        payload: {
          issueKey: 'EMERG-106',
          decisionId: 'DEC-2026-0601'
        }
      },
      context: COMMANDER_AUTH
    };

    const linkRes = await handler(linkBridgeEvent, COMMANDER_AUTH);
    expect(linkRes.success).toBe(true);
    expect(linkRes.data.issueKey).toBe('EMERG-106');
  });

  // TEST 10: Bidirectional relationship preservation
  it('TEST-PANEL-10: Preserves bidirectional relationship between issue pointer and decision record', async () => {
    await recordDecision(APPROVED_DECISION_PAYLOAD, null, COMMANDER_AUTH);

    await linkDecisionToIssue({
      issueKey: 'EMERG-303',
      decisionId: 'DEC-2026-0601'
    }, null, COMMANDER_AUTH);

    // Retrieve via issue key
    const byIssue = await getDecisionForIssue('EMERG-303');
    expect(byIssue.data.decisionId).toBe('DEC-2026-0601');
    expect(byIssue.data.linkedIssueKey).toBe('EMERG-303');
    expect(byIssue.data.linkedAt).toBeDefined();

    // Retrieve via decision ID
    const byId = await getDecision('DEC-2026-0601');
    expect(byId.data.linkedIssueKey).toBe('EMERG-303');
  });

  // TEST 11: Immutability and physical metrics preservation
  it('TEST-PANEL-11: Linking to an issue preserves original scenario hash, rationale, and metrics', async () => {
    await recordDecision(APPROVED_DECISION_PAYLOAD, null, COMMANDER_AUTH);

    await linkDecisionToIssue({
      issueKey: 'EMERG-304',
      decisionId: 'DEC-2026-0601'
    }, null, COMMANDER_AUTH);

    const rec = await getDecision('DEC-2026-0601');
    expect(rec.data.scenarioHash).toBe(APPROVED_DECISION_PAYLOAD.scenarioHash);
    expect(rec.data.engineeringRationale).toBe(APPROVED_DECISION_PAYLOAD.engineeringRationale);
    expect(rec.data.differentialMetrics.avoidedSurfaceVolumeM3).toBe(11420);
    expect(rec.data.differentialMetrics.peakDepthReductionM).toBe(0.120);
  });

  // TEST 12: Manifest verification of jira:issuePanel
  it('TEST-PANEL-12: manifest.yml declares jira:issuePanel module bound to main-ui and rovo-action-handler', () => {
    const manifestPath = path.resolve(__dirname, '../manifest.yml');
    const rawYaml = fs.readFileSync(manifestPath, 'utf8');

    expect(rawYaml).toContain('jira:issuePanel:');
    expect(rawYaml).toContain('key: delta-decision-issue-panel');
    expect(rawYaml).toContain('title: DELTA Flood Mitigation Decision');
    expect(rawYaml).toContain('resource: main-ui');
    expect(rawYaml).toContain('function: rovo-action-handler');
  });
});
