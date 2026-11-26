/**
 * DELTA - Workstream 4A: Operational Work Orders Credibility & Provenance Test Suite
 *
 * Verifies:
 * - TEST-WO-01: Deterministic work order preparation from approved decisions (Plans Alpha, Beta, Gamma).
 * - TEST-WO-02: Authoritative coordinate binding matches surveyed infrastructure with road-deck abstraction disclosure.
 * - TEST-WO-03: Ingress corridor definitions and routing instructions exist with unverified route disclosures.
 * - TEST-WO-04: Plan-specific tactical equipment and crew requirements are non-empty, distinct, and without fictional names.
 * - TEST-WO-05: Chronological tactical tasks follow strict sequence and contain explicit safety cautions.
 * - TEST-WO-06: Supporting hydraulic simulation evidence is faithfully bound from decision records.
 * - TEST-WO-07: Staged execution transitions (PREPARED_DRAFT -> COMMANDER_STAGED -> JIRA_LINKED).
 * - TEST-WO-08: Jira issue key linking binds issue reference and updates timestamps while preserving decision immutability.
 * - TEST-WO-09: Live dispatch safety lockout (LIVE_DISPATCH_LOCKED) is permanently enforced by server policy.
 * - TEST-WO-10: Backend Forge storage handlers (saveWorkOrder, getWorkOrder, listWorkOrders, getWorkOrderForIssue).
 * - TEST-WO-11: Work order provenance manifest data model and classifications (SOURCE_VERIFIED, DERIVED, PLANNING_ASSUMPTION, UNVERIFIED).
 * - TEST-WO-12: Plan Alpha adverse deflection surcharge accounting (+15cm ponding on neighboring cells).
 * - TEST-WO-13: Plan Gamma culvert road-deck sink abstraction disclosure (12.5 m³/s nominal heuristic, not surveyed inverts).
 * - TEST-WO-14: Plan Beta mobile dewatering planning constraints and performance disclaimers.
 * - TEST-WO-15: Server-side lifecycle integrity & invalid transition prevention (cannot demote or alter decision binding).
 * - TEST-WO-16: Server-side linkWorkOrderToIssue authorization and staging validation (rejects unstaged drafts).
 * - TEST-WO-17: Checklist review semantics (desk-side review vs physical verification).
 * - TEST-WO-18: Traceability and non-fabrication of field deployment (no fictional names, valid decisions only).
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
  recordDecision,
  saveWorkOrder,
  linkWorkOrderToIssue as serverLinkWorkOrderToIssue,
  getWorkOrder,
  listWorkOrders,
  getWorkOrderForIssue,
  __resetInMemoryStore
} from '../src/resolvers/decisionStorage.js';

describe('Workstream 4A: Operational Work Orders & Provenance Architecture', () => {
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
      stormLabel: '50-Year Regional Benchmark (104.2 mm / 6hr)',
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
      displayName: 'Duty Incident Commander',
      role: 'Incident Commander',
      approvalTimestamp: '2026-11-25T14:00:00.000Z'
    },
    engineeringRationale: 'Plan Gamma clears complete culvert blockage at Brookline Ave intake, restoring 12.5 m³/s nominal capacity under 2D screening model.',
    linkedIssueKey: 'EMERG-101',
    linkedAt: '2026-11-25T14:05:00.000Z'
  };

  const MOCK_BETA_DECISION = {
    decisionId: 'DEC-2026-TEST-BETA',
    schemaVersion: '2.0.0',
    status: 'APPROVED',
    scenarioHash: 'sha256:f0a73115e28a69b7f0dcfbbfe52182597bf8862c482d302b9c50154f488c9a47',
    canonicalScenario: {
      stormId: '50-year',
      stormLabel: '50-Year Regional Benchmark (104.2 mm / 6hr)',
      stormDepthMm: 104.2,
      durationHours: 6.0
    },
    chosenPlan: {
      planId: 'plan-beta',
      name: 'Plan Beta: Mobile Pump Deployment (2.0 m³/s Active Dewatering)',
      type: 'MOBILE_PUMP'
    },
    differentialMetrics: {
      avoidedSurfaceVolumeM3: 14,
      peakDepthReductionM: 0.11,
      protectedRoadCount: 2,
      protectedRoadNames: ['Brookline Avenue', 'Longwood Avenue']
    },
    humanApprover: {
      displayName: 'Duty Incident Commander',
      role: 'Incident Commander',
      approvalTimestamp: '2026-11-25T13:00:00.000Z'
    },
    engineeringRationale: 'Plan Beta deploys 2.0 m³/s mechanical suction at Muddy River channel to relieve backwater surcharge.'
  };

  const MOCK_ALPHA_DECISION = {
    decisionId: 'DEC-2026-TEST-ALPHA',
    schemaVersion: '2.0.0',
    status: 'APPROVED',
    scenarioHash: 'sha256:f0a73115e28a69b7f0dcfbbfe52182597bf8862c482d302b9c50154f488c9a47',
    canonicalScenario: {
      stormId: '50-year',
      stormLabel: '50-Year Regional Benchmark (104.2 mm / 6hr)',
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
      displayName: 'Duty Incident Commander',
      role: 'Incident Commander',
      approvalTimestamp: '2026-11-25T12:00:00.000Z'
    },
    engineeringRationale: 'Plan Alpha erects sandbag weir along Francis Street. Diverts overland flow onto adjacent curb cells.'
  };

  const AUTHENTICATED_COMMANDER_AUTH = {
    accountId: 'qm:duty-commander',
    principal: { accountId: 'qm:duty-commander' },
    role: 'Incident Commander'
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

  it('TEST-WO-02: Authoritative coordinate binding matches surveyed infrastructure with road-deck abstraction disclosure', () => {
    const locGamma = AUTHORITATIVE_WORK_ORDER_LOCATIONS['plan-gamma'];
    expect(locGamma.siteId).toBe('CULVERT-01-BROOKLINE');
    expect(locGamma.gridCell).toEqual([17, 26]);
    expect(locGamma.projected.x).toBeCloseTo(232302.11, 2);
    expect(locGamma.projected.y).toBeCloseTo(899074.88, 2);
    expect(locGamma.wgs84.lat).toBeCloseTo(42.34150, 4);
    expect(locGamma.wgs84.lon).toBeCloseTo(-71.10800, 4);
    expect(locGamma.isRoadDeckAbstraction).toBe(true);
    expect(locGamma.provenanceNotice).toContain('NOT surveyed culvert invert or portal coordinates');

    const locBeta = AUTHORITATIVE_WORK_ORDER_LOCATIONS['plan-beta'];
    expect(locBeta.siteId).toBe('PUMP-BETA-MOBILE');
    expect(locBeta.gridCell).toEqual([17, 25]);
    expect(locBeta.projected.x).toBeCloseTo(232277.11, 2);
    expect(locBeta.projected.y).toBeCloseTo(899074.88, 2);
    expect(locBeta.locationClassification).toBe('DERIVED');

    const locAlpha = AUTHORITATIVE_WORK_ORDER_LOCATIONS['plan-alpha'];
    expect(locAlpha.siteId).toBe('ROAD-1377084984-MID');
    expect(locAlpha.gridCell).toEqual([43, 29]);
    expect(locAlpha.projected.x).toBeCloseTo(232384.06, 2);
    expect(locAlpha.projected.y).toBeCloseTo(898414.94, 2);
    expect(locAlpha.provenanceNotice).toContain('OpenStreetMap');
  });

  it('TEST-WO-03: Ingress corridor definitions and routing instructions exist with unverified route disclosures', () => {
    const woGamma = prepareWorkOrderFromDecision(MOCK_GAMMA_DECISION);
    expect(woGamma.targetLocation.accessCorridor).toBeDefined();
    expect(woGamma.targetLocation.accessCorridor).toContain('Brookline Ave');
    expect(woGamma.provenanceManifest.ingressCorridor.classification).toBe('UNVERIFIED');
    expect(woGamma.provenanceManifest.ingressCorridor.disclosure).toContain('NOT been verified as passable');

    const woBeta = prepareWorkOrderFromDecision(MOCK_BETA_DECISION);
    expect(woBeta.targetLocation.accessCorridor).toContain('Longwood Ave');

    const woAlpha = prepareWorkOrderFromDecision(MOCK_ALPHA_DECISION);
    expect(woAlpha.targetLocation.accessCorridor).toContain('Huntington Ave');
  });

  it('TEST-WO-04: Plan-specific tactical equipment and crew requirements are non-empty, distinct, and without fictional names', () => {
    const woGamma = prepareWorkOrderFromDecision(MOCK_GAMMA_DECISION);
    expect(woGamma.tacticalEquipment.length).toBeGreaterThanOrEqual(4);
    expect(woGamma.crewRequirement).toContain('Municipal Drainage Response Team');
    expect(woGamma.crewRequirement).not.toContain('Henderson');
    expect(woGamma.crewRequirement).not.toContain('Vance');

    const woBeta = prepareWorkOrderFromDecision(MOCK_BETA_DECISION);
    expect(woBeta.crewRequirement).toContain('Mechanical Dewatering');
    expect(woBeta.crewRequirement).not.toContain("O'Connor");

    const woAlpha = prepareWorkOrderFromDecision(MOCK_ALPHA_DECISION);
    expect(woAlpha.crewRequirement).toContain('Public Works Staging Team');
    expect(woAlpha.crewRequirement).not.toContain('Kowalski');
  });

  it('TEST-WO-05: Chronological tactical tasks follow strict sequence and contain explicit safety cautions', () => {
    const gammaTasks = getPlanOperationalTasks('plan-gamma');
    expect(gammaTasks.length).toBe(5);
    gammaTasks.forEach((task, idx) => {
      expect(task.stepNumber).toBe(idx + 1);
      expect(task.title.length).toBeGreaterThan(5);
      expect(task.instruction.length).toBeGreaterThan(15);
      expect(task.isCompleted).toBe(false);
      expect(task.reviewStatus).toBe('PENDING_REVIEW');
      expect(task.verificationNotice).toContain('Does NOT indicate field execution');
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
    expect(woGamma.supportingSimulationEvidence.solverAbstractionNotice).toContain('lumped conduit / point sink');
  });

  it('TEST-WO-07: Staged execution transitions (PREPARED_DRAFT -> COMMANDER_STAGED -> JIRA_LINKED)', () => {
    const initialDraft = prepareWorkOrderFromDecision(MOCK_BETA_DECISION, 'PREPARED_DRAFT');
    expect(initialDraft.stage).toBe('PREPARED_DRAFT');
    expect(initialDraft.humanReview.stagingStatus).toBe('UNREVIEWED_DRAFT');

    // Transition to COMMANDER_STAGED
    const staged: OperationalWorkOrder = {
      ...initialDraft,
      stage: 'COMMANDER_STAGED',
      humanReview: {
        ...initialDraft.humanReview,
        reviewedAt: new Date().toISOString(),
        stagingStatus: 'STAGED_BY_COMMANDER'
      }
    };
    expect(staged.stage).toBe('COMMANDER_STAGED');
    expect(staged.humanReview.stagingStatus).toBe('STAGED_BY_COMMANDER');

    // Transition to JIRA_LINKED
    const linked: OperationalWorkOrder = {
      ...staged,
      stage: 'JIRA_LINKED',
      jiraIntegration: {
        ...staged.jiraIntegration,
        linkedIssueKey: 'JSM-5100',
        linkedAt: new Date().toISOString()
      },
      humanReview: {
        ...staged.humanReview,
        stagingStatus: 'JIRA_INTEGRATED'
      }
    };
    expect(linked.stage).toBe('JIRA_LINKED');
    expect(linked.jiraIntegration.linkedIssueKey).toBe('JSM-5100');
    expect(linked.humanReview.stagingStatus).toBe('JIRA_INTEGRATED');
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

  it('TEST-WO-11: Work order provenance manifest data model and classifications', () => {
    const wo = prepareWorkOrderFromDecision(MOCK_GAMMA_DECISION);
    expect(wo.provenanceManifest).toBeDefined();
    const manifest = wo.provenanceManifest;

    // Must distinguish all 4 classifications
    expect(manifest.targetLocation.classification).toBe('PLANNING_ASSUMPTION');
    expect(manifest.ingressCorridor.classification).toBe('UNVERIFIED');
    expect(manifest.tacticalEquipment.classification).toBe('PLANNING_ASSUMPTION');
    expect(manifest.avoidedStorageVolume.classification).toBe('DERIVED');
    expect(manifest.avoidedStorageVolume.derivationMethod).toContain('2D Diffusive-Wave');

    // Every record contains required disclosure text
    expect(manifest.targetLocation.disclosure.length).toBeGreaterThan(20);
    expect(manifest.ingressCorridor.disclosure.length).toBeGreaterThan(20);
    expect(manifest.hydraulicCapacityOrSink.disclosure.length).toBeGreaterThan(20);
  });

  it('TEST-WO-12: Plan Alpha adverse deflection surcharge accounting', () => {
    const woAlpha = prepareWorkOrderFromDecision(MOCK_ALPHA_DECISION);
    expect(woAlpha.adverseConsequenceAnalysis).toBeDefined();
    expect(woAlpha.adverseConsequenceAnalysis?.hasAdverseImpact).toBe(true);
    expect(woAlpha.adverseConsequenceAnalysis?.adverseDepthIncreaseM).toBe(0.15);
    expect(woAlpha.adverseConsequenceAnalysis?.affectedCells).toEqual([[43, 28], [44, 29]]);
    expect(woAlpha.adverseConsequenceAnalysis?.description).toContain('deflected away from the Francis Street ambulance bay');
    expect(woAlpha.provenanceManifest.adverseConsequences.classification).toBe('DERIVED');
  });

  it('TEST-WO-13: Plan Gamma culvert road-deck sink abstraction disclosure', () => {
    const woGamma = prepareWorkOrderFromDecision(MOCK_GAMMA_DECISION);
    expect(woGamma.targetLocation.isRoadDeckAbstraction).toBe(true);
    expect(woGamma.targetLocation.provenanceNotice).toContain('NOT surveyed culvert invert or portal coordinates');
    expect(woGamma.planningAssumptions.some(a => a.includes('lumped point sink on road-deck cell [17, 26]'))).toBe(true);
    expect(woGamma.provenanceManifest.hydraulicCapacityOrSink.disclosure).toContain('exploratory planning heuristic');
  });

  it('TEST-WO-14: Plan Beta mobile dewatering planning constraints', () => {
    const woBeta = prepareWorkOrderFromDecision(MOCK_BETA_DECISION);
    expect(woBeta.provenanceManifest.hydraulicCapacityOrSink.classification).toBe('PLANNING_ASSUMPTION');
    expect(woBeta.operationalConstraints.some(c => c.includes('Secondary fuel containment berm'))).toBe(true);
    expect(woBeta.operationalConstraints.some(c => c.includes('suction strainer must be suspended'))).toBe(true);
  });

  it('TEST-WO-15: Server-side lifecycle integrity & invalid transition prevention', async () => {
    // Record approved decision first in KVS
    const decRes = await recordDecision(MOCK_BETA_DECISION, null, AUTHENTICATED_COMMANDER_AUTH);
    expect(decRes.success).toBe(true);

    const validBetaWo = prepareWorkOrderFromDecision(MOCK_BETA_DECISION, 'COMMANDER_STAGED', 'WO-LIFECYCLE-01');
    const saveRes = await saveWorkOrder(validBetaWo);
    expect(saveRes.success).toBe(true);

    // 1. Attempt to demote COMMANDER_STAGED to PREPARED_DRAFT
    const demotedDraft = { ...validBetaWo, stage: 'PREPARED_DRAFT' as const };
    await expect(saveWorkOrder(demotedDraft)).rejects.toThrow(/Invalid stage transition/);

    // 2. Advance to JIRA_LINKED
    const linkedWo = { ...validBetaWo, stage: 'JIRA_LINKED' as const };
    await saveWorkOrder(linkedWo);

    // 3. Attempt to demote JIRA_LINKED to COMMANDER_STAGED
    const demotedStaged = { ...linkedWo, stage: 'COMMANDER_STAGED' as const };
    await expect(saveWorkOrder(demotedStaged)).rejects.toThrow(/cannot be demoted/);

    // 4. Attempt to alter decision binding on existing work order
    const tamperedDecisionWo = { ...linkedWo, decisionId: 'DEC-TAMPERED-999' };
    await expect(saveWorkOrder(tamperedDecisionWo)).rejects.toThrow(/Cannot alter underlying decision binding/);

    // 5. Attempt to tamper with scenario hash
    const tamperedHashWo = {
      ...prepareWorkOrderFromDecision(MOCK_BETA_DECISION, 'PREPARED_DRAFT', 'WO-TAMPER-HASH'),
      supportingSimulationEvidence: {
        ...validBetaWo.supportingSimulationEvidence,
        scenarioHash: 'sha256:spoofed-fake-hash'
      }
    };
    await expect(saveWorkOrder(tamperedHashWo)).rejects.toThrow(/Integrity violation.*scenario hash/);
  });

  it('TEST-WO-16: Server-side linkWorkOrderToIssue authorization and staging validation', async () => {
    // Record approved decision
    await recordDecision(MOCK_GAMMA_DECISION, null, AUTHENTICATED_COMMANDER_AUTH);

    // 1. Prepare unstaged draft
    const draftWo = prepareWorkOrderFromDecision(MOCK_GAMMA_DECISION, 'PREPARED_DRAFT', 'WO-AUTH-TEST-01');
    await saveWorkOrder(draftWo);

    // 2. Attempting to link unstaged draft fails
    await expect(serverLinkWorkOrderToIssue({
      workOrderId: 'WO-AUTH-TEST-01',
      issueKey: 'EMERG-101'
    }, null, AUTHENTICATED_COMMANDER_AUTH)).rejects.toThrow(/must be reviewed and advanced to COMMANDER_STAGED/);

    // 3. Advance to COMMANDER_STAGED
    const stagedWo = { ...draftWo, stage: 'COMMANDER_STAGED' as const };
    await saveWorkOrder(stagedWo);

    // 4. Unauthenticated caller rejected
    const unauthContext = { accountId: '' };
    await expect(serverLinkWorkOrderToIssue({
      workOrderId: 'WO-AUTH-TEST-01',
      issueKey: 'EMERG-101'
    }, null, unauthContext)).rejects.toThrow(/Authentication failure/);

    // 5. Authorized commander link succeeds
    const linkRes = await serverLinkWorkOrderToIssue({
      workOrderId: 'WO-AUTH-TEST-01',
      issueKey: 'EMERG-101'
    }, null, AUTHENTICATED_COMMANDER_AUTH);

    expect(linkRes.success).toBe(true);
    expect(linkRes.data.stage).toBe('JIRA_LINKED');
    expect(linkRes.data.jiraIntegration.linkedIssueKey).toBe('EMERG-101');
  });

  it('TEST-WO-17: Checklist review semantics (desk-side review vs physical verification)', () => {
    const wo = prepareWorkOrderFromDecision(MOCK_GAMMA_DECISION);
    expect(wo.humanReview.stagingNotice).toContain('Does not constitute field dispatch or physical authorization');

    wo.operationalTasks.forEach((task) => {
      expect(task.verificationNotice).toContain('Operational planning review only');
    });
  });

  it('TEST-WO-18: Traceability and non-fabrication of field deployment', () => {
    const seeds = getSeedWorkOrders();
    expect(seeds.length).toBe(3);

    // Ensure all seed work orders have valid approved decision IDs
    seeds.forEach((seed) => {
      expect(seed.decisionId).toMatch(/^DEC-2026-\d{3}$/);
      expect(seed.provenanceManifest).toBeDefined();
      expect(seed.humanReview.reviewedBy).not.toContain('Vance');
      expect(seed.humanReview.reviewedBy).not.toContain('Henderson');
      expect(seed.crewRequirement).not.toContain('Kowalski');
      expect(seed.crewRequirement).not.toContain("O'Connor");
    });
  });
});
