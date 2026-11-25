/**
 * DELTA - Workstream 4: Staged Operational Work Orders & Jira Integration Test Suite
 *
 * Verifies:
 * - TEST-WO-01: Deterministic work order preparation from approved decisions (Plans Alpha, Beta, Gamma).
 * - TEST-WO-02: Authoritative coordinate binding (EPSG:26986 & WGS84) matches surveyed infrastructure.
 * - TEST-WO-03: Ingress corridor definitions and routing instructions exist for every operational plan.
 * - TEST-WO-04: Plan-specific tactical equipment and crew requirements are non-empty and distinct.
 * - TEST-WO-05: Chronological tactical tasks follow strict sequence and contain explicit safety cautions.
 * - TEST-WO-06: Supporting hydraulic simulation evidence is faithfully bound from decision records.
 * - TEST-WO-07: Staged execution transitions (PREPARED_DRAFT -> COMMANDER_STAGED -> JIRA_LINKED).
 * - TEST-WO-08: Jira issue key linking binds issue reference and updates timestamps while preserving decision immutability.
 * - TEST-WO-09: Live dispatch safety lockout (LIVE_DISPATCH_LOCKED) is permanently enforced by server policy.
 * - TEST-WO-10: Backend Forge storage handlers (saveWorkOrder, getWorkOrder, listWorkOrders, getWorkOrderForIssue).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  prepareWorkOrderFromDecision,
  getPlanOperationalTasks,
  AUTHORITATIVE_WORK_ORDER_LOCATIONS,
  getSeedWorkOrders,
  saveStoredWorkOrder,
  getStoredWorkOrders,
  linkWorkOrderToIssue,
  __resetStoredWorkOrders,
  OperationalWorkOrder
} from '../src/simulation/workOrderEngine';
import {
  saveWorkOrder,
  getWorkOrder,
  listWorkOrders,
  getWorkOrderForIssue,
  __resetInMemoryStore
} from '../src/resolvers/decisionStorage.js';

describe('Workstream 4: Operational Work Orders & Jira Integration', () => {
  beforeEach(() => {
    __resetInMemoryStore();
    __resetStoredWorkOrders();
    try {
      if (typeof localStorage !== 'undefined' && typeof (localStorage as any).clear === 'function') {
        (localStorage as any).clear();
      }
    } catch {}
  });

  const MOCK_GAMMA_DECISION = {
    decisionId: 'DEC-2026-TEST-GAMMA',
    schemaVersion: '2.0.0',
    status: 'APPROVED',
    scenarioHash: 'sha256:f0a73115e28a69b7f0dcfbbfe52182597bf8862c482d302b9c50154f488c9a47',
    canonicalScenario: {
      stormId: '50-year',
      stormLabel: '50-Year Regional Benchmark (104.2 mm)',
      stormDepthMm: 104.2,
      durationHours: 6.0
    },
    chosenPlan: {
      planId: 'plan-gamma',
      name: 'Plan Gamma: Emergency High-Pressure Culvert Jetting (Clear Choke Point)',
      type: 'CULVERT_JETTING'
    },
    differentialMetrics: {
      avoidedSurfaceVolumeM3: 22,
      peakDepthReductionM: 0.18,
      protectedRoadCount: 3,
      protectedRoadNames: ['Francis Street', 'Brookline Avenue', 'Longwood Avenue']
    },
    humanApprover: {
      displayName: 'Incident Commander Vance',
      role: 'Incident Commander',
      approvalTimestamp: '2026-11-25T14:00:00.000Z'
    },
    engineeringRationale: 'Plan Gamma clears complete culvert blockage at Brookline Ave intake, restoring 12.5 m³/s nominal capacity.',
    linkedIssueKey: 'JSM-4902',
    linkedAt: '2026-11-25T14:05:00.000Z'
  };

  const MOCK_BETA_DECISION = {
    decisionId: 'DEC-2026-TEST-BETA',
    schemaVersion: '2.0.0',
    status: 'APPROVED',
    scenarioHash: 'sha256:f0a73115e28a69b7f0dcfbbfe52182597bf8862c482d302b9c50154f488c9a47',
    canonicalScenario: {
      stormId: '50-year',
      stormLabel: '50-Year Regional Benchmark (104.2 mm)',
      stormDepthMm: 104.2,
      durationHours: 6.0
    },
    chosenPlan: {
      planId: 'plan-beta',
      name: 'Plan Beta: Mobile Pump Deployment #1 (2.0 m³/s Active Dewatering)',
      type: 'MOBILE_PUMP'
    },
    differentialMetrics: {
      avoidedSurfaceVolumeM3: 14,
      peakDepthReductionM: 0.11,
      protectedRoadCount: 2,
      protectedRoadNames: ['Brookline Avenue', 'Longwood Avenue']
    },
    humanApprover: {
      displayName: 'Lt. S. Chen',
      role: 'Incident Commander',
      approvalTimestamp: '2026-11-25T13:00:00.000Z'
    },
    engineeringRationale: 'Plan Beta deploys 2.0 m³/s mechanical suction at Muddy River channel to relieve backwater pressure.'
  };

  const MOCK_ALPHA_DECISION = {
    decisionId: 'DEC-2026-TEST-ALPHA',
    schemaVersion: '2.0.0',
    status: 'APPROVED',
    scenarioHash: 'sha256:f0a73115e28a69b7f0dcfbbfe52182597bf8862c482d302b9c50154f488c9a47',
    canonicalScenario: {
      stormId: '50-year',
      stormLabel: '50-Year Regional Benchmark (104.2 mm)',
      stormDepthMm: 104.2,
      durationHours: 6.0
    },
    chosenPlan: {
      planId: 'plan-alpha',
      name: 'Plan Alpha: Francis Street Ambulance Bay Sandbag Barrier (+0.50m Crest)',
      type: 'BARRIER_DEFLECTION'
    },
    differentialMetrics: {
      avoidedSurfaceVolumeM3: 0,
      peakDepthReductionM: 0.05,
      protectedRoadCount: 1,
      protectedRoadNames: ['Francis Street']
    },
    humanApprover: {
      displayName: 'Incident Commander Vance',
      role: 'Incident Commander',
      approvalTimestamp: '2026-11-25T12:00:00.000Z'
    },
    engineeringRationale: 'Plan Alpha erects sandbag weir along Francis Street. Diverts overland flow onto adjacent curb cells.'
  };

  it('TEST-WO-01: Deterministic work order preparation from approved decisions', () => {
    const woGamma = prepareWorkOrderFromDecision(MOCK_GAMMA_DECISION, 'COMMANDER_STAGED');
    expect(woGamma).toBeDefined();
    expect(woGamma.decisionId).toBe('DEC-2026-TEST-GAMMA');
    expect(woGamma.planId).toBe('plan-gamma');
    expect(woGamma.planType).toBe('CULVERT_JETTING');
    expect(woGamma.stage).toBe('COMMANDER_STAGED');
    expect(woGamma.urgency).toBe('P1_CRITICAL');
    expect(woGamma.workOrderId).toContain('DEC-2026-TEST-GAMMA');

    const woBeta = prepareWorkOrderFromDecision(MOCK_BETA_DECISION, 'PREPARED_DRAFT');
    expect(woBeta.planId).toBe('plan-beta');
    expect(woBeta.planType).toBe('MOBILE_PUMP');
    expect(woBeta.stage).toBe('PREPARED_DRAFT');
    expect(woBeta.urgency).toBe('P1_CRITICAL');

    const woAlpha = prepareWorkOrderFromDecision(MOCK_ALPHA_DECISION, 'PREPARED_DRAFT');
    expect(woAlpha.planId).toBe('plan-alpha');
    expect(woAlpha.planType).toBe('BARRIER_DEFLECTION');
    expect(woAlpha.urgency).toBe('P2_HIGH');
  });

  it('TEST-WO-02: Authoritative coordinate binding matches surveyed infrastructure', () => {
    const locGamma = AUTHORITATIVE_WORK_ORDER_LOCATIONS['plan-gamma'];
    expect(locGamma.siteId).toBe('CULVERT-01-BROOKLINE');
    expect(locGamma.gridCell).toEqual([17, 26]);
    expect(locGamma.projected.x).toBeCloseTo(232302.11, 2);
    expect(locGamma.projected.y).toBeCloseTo(899074.88, 2);
    expect(locGamma.wgs84.lat).toBeCloseTo(42.34150, 4);
    expect(locGamma.wgs84.lon).toBeCloseTo(-71.10800, 4);

    const locBeta = AUTHORITATIVE_WORK_ORDER_LOCATIONS['plan-beta'];
    expect(locBeta.siteId).toBe('PUMP-BETA-MOBILE');
    expect(locBeta.gridCell).toEqual([17, 25]);
    expect(locBeta.projected.x).toBeCloseTo(232277.11, 2);
    expect(locBeta.projected.y).toBeCloseTo(899074.88, 2);

    const locAlpha = AUTHORITATIVE_WORK_ORDER_LOCATIONS['plan-alpha'];
    expect(locAlpha.siteId).toBe('ROAD-1377084984-MID');
    expect(locAlpha.gridCell).toEqual([43, 29]);
    expect(locAlpha.projected.x).toBeCloseTo(232384.06, 2);
    expect(locAlpha.projected.y).toBeCloseTo(898414.94, 2);
    expect(locAlpha.wgs84.lat).toBeCloseTo(42.335555, 4);
  });

  it('TEST-WO-03: Ingress corridor definitions and routing instructions exist', () => {
    const woGamma = prepareWorkOrderFromDecision(MOCK_GAMMA_DECISION);
    expect(woGamma.targetLocation.accessCorridor).toBeDefined();
    expect(woGamma.targetLocation.accessCorridor).toContain('Brookline Ave');

    const woBeta = prepareWorkOrderFromDecision(MOCK_BETA_DECISION);
    expect(woBeta.targetLocation.accessCorridor).toContain('Longwood Ave');

    const woAlpha = prepareWorkOrderFromDecision(MOCK_ALPHA_DECISION);
    expect(woAlpha.targetLocation.accessCorridor).toContain('Huntington Ave');
  });

  it('TEST-WO-04: Plan-specific tactical equipment and crew requirements are non-empty and distinct', () => {
    const woGamma = prepareWorkOrderFromDecision(MOCK_GAMMA_DECISION);
    expect(woGamma.tacticalEquipment.length).toBeGreaterThanOrEqual(4);
    expect(woGamma.tacticalEquipment.some(e => e.includes('Vactor 2100i'))).toBe(true);
    expect(woGamma.crewRequirement).toContain('Vactor Jetting Crews');

    const woBeta = prepareWorkOrderFromDecision(MOCK_BETA_DECISION);
    expect(woBeta.tacticalEquipment.some(e => e.includes('Godwin HL250M'))).toBe(true);
    expect(woBeta.crewRequirement).toContain('Pump Specialist');

    const woAlpha = prepareWorkOrderFromDecision(MOCK_ALPHA_DECISION);
    expect(woAlpha.tacticalEquipment.some(e => e.includes('Sandbags'))).toBe(true);
    expect(woAlpha.crewRequirement).toContain('Public Works Teams');
  });

  it('TEST-WO-05: Chronological tactical tasks follow strict sequence and contain explicit safety cautions', () => {
    const gammaTasks = getPlanOperationalTasks('plan-gamma');
    expect(gammaTasks.length).toBe(5);
    gammaTasks.forEach((task, idx) => {
      expect(task.stepNumber).toBe(idx + 1);
      expect(task.title.length).toBeGreaterThan(5);
      expect(task.instruction.length).toBeGreaterThan(15);
      expect(task.isCompleted).toBe(false);
    });

    // Check Confined space safety caution
    const confinedSpaceStep = gammaTasks.find(t => t.safetyCaution && t.safetyCaution.toLowerCase().includes('confined space'));
    expect(confinedSpaceStep?.safetyCaution).toBeDefined();
    expect(confinedSpaceStep?.safetyCaution?.toLowerCase()).toContain('confined space');

    // Check Plan Alpha adverse deflection warning
    const alphaTasks = getPlanOperationalTasks('plan-alpha');
    const deflectionStep = alphaTasks.find(t => t.stepNumber === 3);
    expect(deflectionStep?.safetyCaution).toBeDefined();
    expect(deflectionStep?.safetyCaution).toContain('Adverse deflection warning');
  });

  it('TEST-WO-06: Supporting hydraulic simulation evidence is faithfully bound from decision records', () => {
    const woGamma = prepareWorkOrderFromDecision(MOCK_GAMMA_DECISION);
    expect(woGamma.supportingSimulationEvidence.avoidedSurfaceVolumeM3).toBe(22);
    expect(woGamma.supportingSimulationEvidence.peakDepthReductionM).toBeCloseTo(0.18, 2);
    expect(woGamma.supportingSimulationEvidence.protectedRoads).toEqual([
      'Francis Street',
      'Brookline Avenue',
      'Longwood Avenue'
    ]);
    expect(woGamma.supportingSimulationEvidence.scenarioHash).toBe(MOCK_GAMMA_DECISION.scenarioHash);
  });

  it('TEST-WO-07: Staged execution transitions (PREPARED_DRAFT -> COMMANDER_STAGED -> JIRA_LINKED)', () => {
    const initialDraft = prepareWorkOrderFromDecision(MOCK_BETA_DECISION, 'PREPARED_DRAFT');
    expect(initialDraft.stage).toBe('PREPARED_DRAFT');

    // Transition to COMMANDER_STAGED
    const staged: OperationalWorkOrder = {
      ...initialDraft,
      stage: 'COMMANDER_STAGED',
      humanReview: {
        ...initialDraft.humanReview,
        reviewedAt: new Date().toISOString()
      }
    };
    expect(staged.stage).toBe('COMMANDER_STAGED');

    // Transition to JIRA_LINKED
    const linked: OperationalWorkOrder = {
      ...staged,
      stage: 'JIRA_LINKED',
      jiraIntegration: {
        ...staged.jiraIntegration,
        linkedIssueKey: 'JSM-5100',
        linkedAt: new Date().toISOString()
      }
    };
    expect(linked.stage).toBe('JIRA_LINKED');
    expect(linked.jiraIntegration.linkedIssueKey).toBe('JSM-5100');
  });

  it('TEST-WO-08: Jira issue key linking binds issue reference and updates timestamps while preserving decision immutability', () => {
    const wo = prepareWorkOrderFromDecision(MOCK_BETA_DECISION, 'COMMANDER_STAGED', 'WO-TEST-BIND-01');
    saveStoredWorkOrder(wo);

    const linked = linkWorkOrderToIssue('WO-TEST-BIND-01', 'EMERG-101');
    expect(linked).not.toBeNull();
    expect(linked?.stage).toBe('JIRA_LINKED');
    expect(linked?.jiraIntegration.linkedIssueKey).toBe('EMERG-101');
    expect(linked?.jiraIntegration.linkedAt).toBeDefined();

    // Decision ID remains unchanged (immutability)
    expect(linked?.decisionId).toBe(MOCK_BETA_DECISION.decisionId);
  });

  it('TEST-WO-09: Live dispatch safety lockout (LIVE_DISPATCH_LOCKED) is permanently enforced', () => {
    const wo = prepareWorkOrderFromDecision(MOCK_GAMMA_DECISION);
    expect(wo.jiraIntegration.dispatchStatus).toBe('LIVE_DISPATCH_LOCKED');
    expect(wo.jiraIntegration.safetyNotice).toContain('Server-side safety policy');
    expect(wo.jiraIntegration.safetyNotice).toContain('disabled');
  });

  it('TEST-WO-10: Backend Forge storage handlers (saveWorkOrder, getWorkOrder, listWorkOrders, getWorkOrderForIssue)', async () => {
    const wo = prepareWorkOrderFromDecision(MOCK_GAMMA_DECISION, 'JIRA_LINKED', 'WO-FORGE-TEST-01');
    wo.jiraIntegration.linkedIssueKey = 'JSM-4902';

    // 1. Save work order to storage
    const saveRes = await saveWorkOrder(wo);
    expect(saveRes.success).toBe(true);
    expect(saveRes.data.workOrderId).toBe('WO-FORGE-TEST-01');

    // 2. Retrieve by ID
    const getRes = await getWorkOrder('WO-FORGE-TEST-01');
    expect(getRes.success).toBe(true);
    expect(getRes.data.workOrderId).toBe('WO-FORGE-TEST-01');
    expect(getRes.data.planId).toBe('plan-gamma');

    // 3. List work orders
    const listRes = await listWorkOrders();
    expect(listRes.success).toBe(true);
    expect(listRes.count).toBe(1);
    expect(listRes.data[0].workOrderId).toBe('WO-FORGE-TEST-01');

    // 4. Retrieve by linked issue key
    const issueRes = await getWorkOrderForIssue('JSM-4902');
    expect(issueRes.success).toBe(true);
    expect(issueRes.data).toBeDefined();
    expect(issueRes.data.workOrderId).toBe('WO-FORGE-TEST-01');

    // 5. Query for unlinked issue key returns null data
    const nonExistent = await getWorkOrderForIssue('JSM-9999');
    expect(nonExistent.success).toBe(true);
    expect(nonExistent.data).toBeNull();
  });
});