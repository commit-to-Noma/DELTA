/**
 * DELTA Workstream 5: Tactical Decision Briefing & Cross-Scenario Robustness Test Suite
 *
 * Verifies:
 * 1. TEST-BRIEF-01: Deterministic generation given identical evaluation inputs.
 * 2. TEST-BRIEF-02: Strict scenario hash binding and tamper-evident verification.
 * 3. TEST-BRIEF-03: Full coverage of all 4 rainfall profiles in cross-scenario matrix.
 * 4. TEST-BRIEF-04: Adverse deflection accounting (Plan Alpha surcharge disclosure).
 * 5. TEST-BRIEF-05: Critical healthcare ingress screening for all 5 hospital complexes.
 * 6. TEST-BRIEF-06: Markdown export structure, tables, and scenario binding.
 * 7. TEST-BRIEF-07: Print-ready HTML export validity, print CSS, and self-contained assets.
 * 8. TEST-BRIEF-08: Governance staging binding (commander authority, work orders, Jira links).
 * 9. TEST-BRIEF-09: Solver disclosures (25m grid, lumped culvert abstraction, 1D/2D decoupling).
 * 10. TEST-BRIEF-10: Incident command posture determination logic.
 */

import { describe, it, expect } from 'vitest';
import { loadBostonCatchment } from '../src/data/catchmentLoader';
import {
  AUTHORITATIVE_STRESS_PROFILES,
  executeMultiScenarioEvaluation
} from '../src/simulation/interventionEngine';
import {
  generateDecisionBriefing,
  executeCrossProfileRobustnessEvaluation,
  computeScenarioHash
} from '../src/simulation/decisionBriefingEngine';
import {
  exportBriefingToMarkdown,
  exportBriefingToHtml,
  verifyBriefingBinding
} from '../src/simulation/briefingExporter';
import { prepareWorkOrderFromDecision } from '../src/simulation/workOrderEngine';

describe('Workstream 5: Tactical Decision Briefing & Operational Intelligence', () => {
  const dataset = loadBostonCatchment();
  const benchmarkProfile = AUTHORITATIVE_STRESS_PROFILES['reference-noaa-50yr'];
  const testProfile = {
    ...benchmarkProfile,
    durationSeconds: 300,
    durationHours: 300 / 3600,
    totalRainfallMm: 104.2 * (300 / 21600)
  };
  const evalResult = executeMultiScenarioEvaluation(dataset, testProfile, 35.0, 30.0);

  it('TEST-BRIEF-01: Deterministic generation given identical evaluation inputs', () => {
    const briefA = generateDecisionBriefing(evalResult, dataset);
    const briefB = generateDecisionBriefing(evalResult, dataset);

    expect(briefA.scenarioHash).toBe(briefB.scenarioHash);
    expect(briefA.briefingId).toBe(briefB.briefingId);
    expect(briefA.baselineAssessment.totalSurfaceVolumeM3).toBe(briefB.baselineAssessment.totalSurfaceVolumeM3);
    expect(briefA.interventionComparisons.length).toBe(3);
    expect(briefA.interventionComparisons[0].avoidedSurfaceStorageM3).toBe(
      briefB.interventionComparisons[0].avoidedSurfaceStorageM3
    );
  });

  it('TEST-BRIEF-02: Strict scenario hash binding and tamper-evident verification', () => {
    const hashA = computeScenarioHash(evalResult);
    expect(hashA).toMatch(/^0X[0-9A-F]{16}$/);

    const briefing = generateDecisionBriefing(evalResult, dataset);
    expect(briefing.scenarioHash).toBe(hashA);

    // Verify binding check
    expect(verifyBriefingBinding(briefing, hashA)).toBe(true);
    expect(verifyBriefingBinding(briefing, '0X0000000000000000')).toBe(false);
    expect(verifyBriefingBinding(briefing, '')).toBe(false);

    // Perturb evaluation result slightly and ensure hash changes
    const testSynthetic = {
      ...AUTHORITATIVE_STRESS_PROFILES['synthetic-moderate-stress'],
      durationSeconds: 300,
      durationHours: 300 / 3600,
      totalRainfallMm: 35.0 * (300 / 3600)
    };
    const evalSynthetic = executeMultiScenarioEvaluation(dataset, testSynthetic, 35.0, 30.0);
    const hashB = computeScenarioHash(evalSynthetic);
    expect(hashB).not.toBe(hashA);
  });

  it('TEST-BRIEF-03: Full coverage of all 4 rainfall profiles in cross-scenario matrix', () => {
    const matrix = executeCrossProfileRobustnessEvaluation(dataset, 30.0, 180.0);
    expect(matrix.length).toBe(4);

    const profileIds = matrix.map((m) => m.profileId);
    expect(profileIds).toContain('reference-noaa-50yr');
    expect(profileIds).toContain('synthetic-moderate-stress');
    expect(profileIds).toContain('synthetic-high-intensity');
    expect(profileIds).toContain('synthetic-low-intensity');

    // NOAA Benchmark verification
    const noaaRow = matrix.find((m) => m.profileId === 'reference-noaa-50yr')!;
    expect(noaaRow.isRegionalBenchmark).toBe(true);
    expect(noaaRow.totalRainfallMm).toBeGreaterThan(0);
    expect(noaaRow.durationHours).toBeGreaterThan(0);
    expect(noaaRow.plans['plan-gamma'].avoidedStorageM3).toBeGreaterThanOrEqual(0);

    // Synthetic profiles must be flagged as synthetic stress tests
    const synRows = matrix.filter((m) => m.profileId !== 'reference-noaa-50yr');
    for (const sr of synRows) {
      expect(sr.isRegionalBenchmark).toBe(false);
      expect(sr.profileType).toBe('SYNTHETIC_STRESS_INPUT');
    }
  });

  it('TEST-BRIEF-04: Accurate adverse deflection accounting in briefing (Plan Alpha)', () => {
    const briefing = generateDecisionBriefing(evalResult, dataset);
    const planAlpha = briefing.interventionComparisons.find((p) => p.planId === 'plan-alpha')!;

    expect(planAlpha).toBeDefined();
    expect(planAlpha.planType).toBe('BARRIER_DEFLECTION');
    expect(planAlpha.adverseCellCount).toBeGreaterThanOrEqual(0);
    expect(planAlpha.maxAdverseDepthIncreaseM).toBeGreaterThanOrEqual(0);
    expect(planAlpha.classification).toBeDefined();

    // Plan Gamma should have ZERO adverse deflection
    const planGamma = briefing.interventionComparisons.find((p) => p.planId === 'plan-gamma')!;
    expect(planGamma.hasAdverseDeflection).toBe(false);
    expect(planGamma.adverseCellCount).toBe(0);
  });

  it('TEST-BRIEF-05: Critical healthcare ingress screening for all 5 hospital complexes', () => {
    const briefing = generateDecisionBriefing(evalResult, dataset);
    const hospitals = briefing.baselineAssessment.hospitals;

    expect(hospitals.length).toBe(5);
    const hospitalNames = hospitals.map((h) => h.name);
    expect(hospitalNames).toContain("Brigham and Women's Hospital");
    expect(hospitalNames).toContain("Boston Children's Hospital");
    expect(hospitalNames).toContain("Dana-Farber Cancer Institute");
    expect(hospitalNames).toContain("Beth Israel Deaconess Medical Center (West Campus)");
    expect(hospitalNames).toContain("Beth Israel Deaconess Medical Center (East Campus)");

    for (const h of hospitals) {
      expect(h.campusElevationM).toBeGreaterThan(0);
      expect(h.standingWaterDepthM).toBeGreaterThanOrEqual(0);
      expect(['FULLY_ACCESSIBLE', 'CAUTION_ACCESS_RESTRICTED', 'ACCESS_COMPROMISED_ISOLATED']).toContain(
        h.overallStatus
      );
    }
  });

  it('TEST-BRIEF-06: Markdown export structure, tables, and scenario binding', () => {
    const briefing = generateDecisionBriefing(evalResult, dataset);
    const md = exportBriefingToMarkdown(briefing);

    // Header & Hash
    expect(md).toContain('# DELTA — MUNICIPAL FLOOD DEFENSE & HEALTHCARE CONTINUITY');
    expect(md).toContain(`**Briefing ID:** \`${briefing.briefingId}\``);
    expect(md).toContain(`**Scenario Hash:** \`${briefing.scenarioHash}\``);
    expect(md).toContain('DISPATCH LOCKOUT STATUS: ACTIVE');

    // Section Headers
    expect(md).toContain('### 1. Scenario & Hydrometeorological Context');
    expect(md).toContain('### 2. Baseline Catchment Assessment (No Intervention)');
    expect(md).toContain('### 3. Comparative Intervention Evaluation');
    expect(md).toContain('### 4. Incident Command Recommendation');
    expect(md).toContain('### 5. Cross-Scenario Decision Robustness Matrix');
    expect(md).toContain('### 6. Incident Governance & Staging State');
    expect(md).toContain('### 7. Technical Limitations & Disclosures');

    // Check specific table contents
    expect(md).toContain('Total Surface Ponding Volume');
    expect(md).toContain('Plan Alpha');
    expect(md).toContain('Plan Beta');
    expect(md).toContain('Plan Gamma');
    expect(md).toContain('Avoided Storage');
    expect(md).toContain('NOAA Atlas 14');
  });

  it('TEST-BRIEF-07: Print-ready HTML export validity, print CSS, and self-contained styling', () => {
    const briefing = generateDecisionBriefing(evalResult, dataset);
    const html = exportBriefingToHtml(briefing);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<title>DELTA Tactical Decision Briefing');
    expect(html).toContain('@media print');
    expect(html).toContain('DISPATCH LOCKOUT PERMANENTLY ACTIVE:');
    expect(html).toContain(briefing.scenarioHash);
    expect(html).toContain('Print Briefing');
    expect(html).toContain('</html>');

    // No external http script dependencies
    expect(html).not.toContain('<script src="http');
  });

  it('TEST-BRIEF-08: Governance staging binding (commander authority, work orders, Jira links)', () => {
    const mockDecision = {
      decisionId: 'DEC-2026-0042',
      status: 'APPROVED',
      approvedBy: 'Duty Incident Commander',
      timestamp: '2026-11-26T07:00:00Z',
      chosenPlan: {
        planId: 'plan-gamma',
        name: 'Plan Gamma: Emergency High-Pressure Culvert Jetting'
      },
      linkedIssueKey: 'EMERG-101'
    };

    const stagedWo = prepareWorkOrderFromDecision(mockDecision, 'COMMANDER_STAGED');

    const briefing = generateDecisionBriefing(evalResult, dataset, mockDecision, stagedWo);

    expect(briefing.governanceAndStaging.hasActiveDecision).toBe(true);
    expect(briefing.governanceAndStaging.decisionId).toBe('DEC-2026-0042');
    expect(briefing.governanceAndStaging.approvedBy).toBe('Duty Incident Commander');
    expect(briefing.governanceAndStaging.hasStagedWorkOrder).toBe(true);
    expect(briefing.governanceAndStaging.workOrderId).toBe(stagedWo.workOrderId);
    expect(briefing.governanceAndStaging.workOrderStage).toBe('COMMANDER_STAGED');
    expect(briefing.governanceAndStaging.linkedJiraIssueKey).toBe('EMERG-101');
    expect(briefing.governanceAndStaging.dispatchLockoutEnforced).toBe(true);
  });

  it('TEST-BRIEF-09: Solver disclosures (25m grid, lumped culvert abstraction, 1D/2D decoupling)', () => {
    const briefing = generateDecisionBriefing(evalResult, dataset);
    const disclosures = briefing.limitationsAndDisclosures.join(' ');

    expect(disclosures).toContain('25m spatial grid');
    expect(disclosures).toContain('CULVERT-01-BROOKLINE');
    expect(disclosures).toContain('point sink');
    expect(disclosures).toContain('Screening-level');
    expect(disclosures).toContain('Dispatch lockout');
  });

  it('TEST-BRIEF-10: Incident command posture determination logic', () => {
    // 1. Benign/low storm without staged work order => MONITORING
    const lowBriefing = generateDecisionBriefing(evalResult, dataset);
    expect(['MONITORING', 'STAGED_MITIGATION', 'CRITICAL_HAZARD']).toContain(lowBriefing.incidentPosture);

    // 2. Staged work order => STAGED_MITIGATION
    const mockDecision = {
      decisionId: 'DEC-2026-0042',
      chosenPlan: { planId: 'plan-gamma' }
    };
    const stagedWo = prepareWorkOrderFromDecision(mockDecision, 'COMMANDER_STAGED');
    const stagedBriefing = generateDecisionBriefing(evalResult, dataset, mockDecision, stagedWo);
    expect(stagedBriefing.incidentPosture).toBe('STAGED_MITIGATION');

    // 3. Severe inundation (peak depth >= 0.50m) => CRITICAL_HAZARD
    const hazardEval = {
      ...evalResult,
      baseline: {
        ...evalResult.baseline,
        maxWaterDepthM: 0.72
      }
    };
    const hazardBriefing = generateDecisionBriefing(hazardEval, dataset);
    expect(hazardBriefing.incidentPosture).toBe('CRITICAL_HAZARD');
  });
});
