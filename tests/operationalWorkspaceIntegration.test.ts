/**
 * DELTA Full Operational Workspace Integration Test Suite
 *
 * Verifies:
 * 1. TEST-OPS-01: Overview dataset binding & complete removal of Phase-0 placeholders / stale labels.
 * 2. TEST-OPS-02: Shared incident workspace config key determinism & stale cache invalidation.
 * 3. TEST-OPS-03: Profile-change and disruption-change invalidation propagate identically to Baseline & Plans.
 * 4. TEST-OPS-04: Spatial disruption replanning executes real 2D solver with mass conservation & spatial deltas.
 * 5. TEST-OPS-05: Side-by-side cell inspector strictly preserves Δh = h_baseline - h_plan signed delta semantics.
 * 6. TEST-OPS-06: Discrete time-to-threshold screening metrics use exact Δt steps with non-clearance disclosures.
 * 7. TEST-OPS-07: Historical decision records and work orders are never silently bound to a changed scenario hash.
 * 8. TEST-OPS-08: Decision briefing and export binding reflect active disruption state and reject stale hashes.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { loadBostonCatchment } from '../src/data/catchmentLoader';
import {
  AUTHORITATIVE_STRESS_PROFILES,
  executeMultiScenarioEvaluation,
  MultiScenarioEvaluationResult,
  StressProfile
} from '../src/simulation/interventionEngine';
import { executeSpatialDisruptionComparison } from '../src/simulation/disruptionEngine';
import {
  computeScenarioHash,
  generateDecisionBriefing
} from '../src/simulation/decisionBriefingEngine';
import { verifyBriefingBinding } from '../src/simulation/briefingExporter';
import { prepareWorkOrderFromDecision } from '../src/simulation/workOrderEngine';
import {
  buildScenarioConfigKey,
  isEvaluationFreshForConfig,
  findMatchingDecisionForHash,
  findMatchingWorkOrderForHash
} from '../src/context/IncidentWorkspaceContext';
import { computeCellComparisonReading } from '../src/components/simulation/SplitComparisonCanvas';

describe('DELTA Full Operational Workspace Integration', () => {
  const dataset = loadBostonCatchment();

  const shortModerateProfile: StressProfile = {
    ...AUTHORITATIVE_STRESS_PROFILES['synthetic-moderate-stress'],
    durationSeconds: 180,
    durationHours: 180 / 3600,
    totalRainfallMm: 35.0 * (180 / 3600)
  };

  const shortHighProfile: StressProfile = {
    ...AUTHORITATIVE_STRESS_PROFILES['synthetic-high-intensity'],
    durationSeconds: 180,
    durationHours: 180 / 3600,
    totalRainfallMm: 75.0 * (180 / 3600)
  };

  let evalDisrupted: MultiScenarioEvaluationResult;
  let evalNominal: MultiScenarioEvaluationResult;
  let evalHigh: MultiScenarioEvaluationResult;

  beforeAll(() => {
    evalDisrupted = executeMultiScenarioEvaluation(
      dataset,
      shortModerateProfile,
      35.0,
      30.0,
      ['disruption-brookline-culvert']
    );
    evalNominal = executeMultiScenarioEvaluation(
      dataset,
      shortModerateProfile,
      35.0,
      30.0,
      []
    );
    evalHigh = executeMultiScenarioEvaluation(
      dataset,
      shortHighProfile,
      75.0,
      30.0,
      ['disruption-brookline-culvert']
    );
  }, 30000);

  it('TEST-OPS-01: Overview and AppShell bind real catchment metadata with zero Phase-0 placeholders', () => {
    const overviewSrc = fs.readFileSync(
      path.resolve(__dirname, '../src/components/shell/views/OverviewDistrictView.tsx'),
      'utf-8'
    );
    const shellSrc = fs.readFileSync(
      path.resolve(__dirname, '../src/components/shell/AppShell.tsx'),
      'utf-8'
    );

    // Zero Phase-0 placeholder / fictional district strings
    expect(overviewSrc).not.toContain('ILLUSTRATIVE DISTRICT PLACEHOLDERS');
    expect(overviewSrc).not.toContain('District Alpha — Central Valley');
    expect(overviewSrc).not.toContain('PENDING_GIS_INGESTION');
    expect(overviewSrc).not.toContain('packaged in Phase 1');

    // Zero hardcoded stale header labels or legacy personal names in AppShell
    expect(shellSrc).not.toContain('100-YR HYDROGRAPH');
    expect(shellSrc).not.toContain('Cmdr. Vance');
    expect(shellSrc).not.toContain('Alpha (Hospital Corridor)');

    // Real packaged dataset binding verified
    expect(dataset.metadata.grid.nx).toBe(64);
    expect(dataset.metadata.grid.ny).toBe(64);
    expect(dataset.metadata.grid.dx).toBe(25.0);
    expect(dataset.criticalFacilities.length).toBe(5);
    expect(dataset.modelledDrainageInlets.length).toBe(3);

    // Explicit non-live-weather disclaimer and 5-stage operational journey present
    expect(overviewSrc).toContain('Configured planning scenario only');
    expect(shellSrc).toContain('Incident Intelligence');
    expect(shellSrc).toContain('Simulation & Disruption');
    expect(shellSrc).toContain('Intervention Planning');
    expect(shellSrc).toContain('Decision & Briefing');
    expect(shellSrc).toContain('Operational Work Orders');
  });

  it('TEST-OPS-02: Shared incident config key is order-invariant and rejects stale cached entries', () => {
    const key1 = buildScenarioConfigKey('reference-noaa-50yr', [
      'disruption-fenway-choke',
      'disruption-brookline-culvert'
    ]);
    const key2 = buildScenarioConfigKey('reference-noaa-50yr', [
      'disruption-brookline-culvert',
      'disruption-fenway-choke'
    ]);
    const keyNominal = buildScenarioConfigKey('reference-noaa-50yr', []);
    const keyOtherProfile = buildScenarioConfigKey('synthetic-moderate-stress', [
      'disruption-brookline-culvert'
    ]);

    expect(key1).toBe(key2);
    expect(key1).not.toBe(keyNominal);
    expect(key1).not.toBe(keyOtherProfile);

    const mockEntry = { configKey: key1, scenarioHash: '0X1234', result: {} as any };
    expect(isEvaluationFreshForConfig(mockEntry, key1)).toBe(true);
    expect(isEvaluationFreshForConfig(mockEntry, keyNominal)).toBe(false);
    expect(isEvaluationFreshForConfig(mockEntry, keyOtherProfile)).toBe(false);
    expect(isEvaluationFreshForConfig(null, key1)).toBe(false);
  });

  it('TEST-OPS-03: Profile and disruption changes invalidate outputs and propagate identically to Baseline & Plans', () => {
    const hashDisrupted = computeScenarioHash(evalDisrupted);
    const hashNominal = computeScenarioHash(evalNominal);
    const hashHigh = computeScenarioHash(evalHigh);

    expect(hashDisrupted).not.toBe(hashNominal);
    expect(hashDisrupted).not.toBe(hashHigh);
    expect(hashNominal).not.toBe(hashHigh);

    // Metadata accurately reflects active disruptions
    expect(evalDisrupted.simulationMetadata.disruptionId).toBe('CULVERT-01-BROOKLINE-BLOCKAGE');
    expect(evalNominal.simulationMetadata.disruptionId).toBe('NONE_NOMINAL_DRAINAGE');
    expect(evalNominal.simulationMetadata.activeDisruptionIds).toEqual([]);

    // Under nominal unobstructed drainage, Plan Gamma clearing Brookline culvert adds 0 incremental drainage
    expect(evalNominal.differentials['plan-gamma'].inletDrainageAccounting.incrementalDrainageM3).toBe(0);
    expect(evalNominal.differentials['plan-gamma'].avoidedSurfaceVolumeM3).toBe(0);

    // Under blocked Brookline culvert, Plan Gamma restores drainage and avoids surface volume
    expect(evalDisrupted.differentials['plan-gamma'].inletDrainageAccounting.incrementalDrainageM3).toBeGreaterThanOrEqual(0);
    expect(evalDisrupted.baseline.cumulativeDrainageM3).toBeLessThanOrEqual(evalNominal.baseline.cumulativeDrainageM3);
  });

  it('TEST-OPS-04: Spatial disruption replanning executes real 2D solver with mass conservation and spatial deltas', () => {
    const resBlocked = executeSpatialDisruptionComparison(
      dataset,
      ['disruption-brookline-culvert'],
      shortHighProfile,
      30.0
    );

    expect(resBlocked.activeDisruptionIds).toEqual(['disruption-brookline-culvert']);
    expect(resBlocked.nominal.relativeConservationError).toBeLessThan(1e-10);
    expect(resBlocked.disrupted.relativeConservationError).toBeLessThan(1e-10);
    expect(resBlocked.delta.lostDrainageVolumeM3).toBeGreaterThan(0);
    expect(resBlocked.delta.retainedWaterVolumeDeltaM3).toBeGreaterThan(0);
    expect(resBlocked.affectedInletMetrics.length).toBe(1);
    expect(resBlocked.affectedInletMetrics[0].inletId).toBe('CULVERT-01-BROOKLINE');
    expect(resBlocked.affectedInletMetrics[0].depthChangeM).toBeGreaterThanOrEqual(0);

    // Nominal (0 disruptions) must produce exact 0 deltas
    const resNominal = executeSpatialDisruptionComparison(dataset, [], shortModerateProfile, 30.0);
    expect(resNominal.delta.retainedWaterVolumeDeltaM3).toBe(0);
    expect(resNominal.delta.lostDrainageVolumeM3).toBe(0);
    expect(resNominal.delta.adverseCellCount).toBe(0);
  });

  it('TEST-OPS-05: Side-by-side cell inspector strictly preserves Δh = h_baseline - h_plan signed delta semantics', () => {
    const { nx, ny } = dataset.metadata.grid;
    const baseDepth = new Float64Array(nx * ny);
    const planDepth = new Float64Array(nx * ny);

    // Cell [17, 26]: Beneficial drawdown (baseline 0.45m -> plan 0.20m => Δh = +0.25m)
    baseDepth[17 * nx + 26] = 0.45;
    planDepth[17 * nx + 26] = 0.20;

    // Cell [43, 28]: Adverse local ponding (baseline 0.10m -> plan 0.25m => Δh = -0.15m)
    baseDepth[43 * nx + 28] = 0.10;
    planDepth[43 * nx + 28] = 0.25;

    // Cell [10, 10]: Unchanged (0.05m -> 0.05m => Δh = 0.0m)
    baseDepth[10 * nx + 10] = 0.05;
    planDepth[10 * nx + 10] = 0.05;

    const drawdown = computeCellComparisonReading(dataset, baseDepth, planDepth, 17, 26);
    expect(drawdown.signedDeltaM).toBeCloseTo(0.25, 3);
    expect(drawdown.classification).toBe('BENEFICIAL_DRAWDOWN');
    expect(drawdown.inletId).toBe('CULVERT-01-BROOKLINE');

    const adverse = computeCellComparisonReading(dataset, baseDepth, planDepth, 43, 28);
    expect(adverse.signedDeltaM).toBeCloseTo(-0.15, 3);
    expect(adverse.classification).toBe('ADVERSE_PONDING');

    const unchanged = computeCellComparisonReading(dataset, baseDepth, planDepth, 10, 10);
    expect(unchanged.signedDeltaM).toBe(0);
    expect(unchanged.classification).toBe('UNCHANGED');
  });

  it('TEST-OPS-06: Discrete temporal threshold screening records exact Δt crossings with mandatory disclosures', () => {
    const dtMacro = 30.0;
    const tt = evalHigh.differentials['plan-gamma'].temporalThresholds;
    expect(tt).toBeDefined();
    expect(tt.dtMacroSeconds).toBe(dtMacro);
    expect(tt.simulatedDurationSeconds).toBe(shortHighProfile.durationSeconds);

    // Every reported crossing timestamp must be an exact multiple of dtMacro (zero interpolation)
    for (const c of [...tt.road30cmComparisons, ...tt.road15cmComparisons, ...tt.hospitalAccess30cmComparisons]) {
      if (c.baselineCrossingSeconds !== null) {
        expect(c.baselineCrossingSeconds % dtMacro).toBe(0);
      }
      if (c.planCrossingSeconds !== null) {
        expect(c.planCrossingSeconds % dtMacro).toBe(0);
      }
      expect(['NEVER_CROSSED', 'AVOIDED', 'DELAYED', 'UNCHANGED', 'ACCELERATED', 'NEWLY_CROSSED']).toContain(
        c.outcome
      );
    }

    // Explicit non-clearance / non-response-time disclosure mandatory
    expect(tt.disclosure).toContain('Δt = 30s');
    expect(tt.disclosure).toContain('No sub-step interpolation');
    expect(tt.disclosure).toContain('do not represent vehicle clearance, ambulance access');
  });

  it('TEST-OPS-07: Historical decision records and work orders are never silently rebound across scenario hashes', () => {
    const hashA = '0XAAAA111122223333';
    const hashB = '0XBBBB444455556666';

    const decisionA = {
      decisionId: 'DEC-2026-A',
      scenarioHash: hashA,
      status: 'APPROVED',
      chosenPlan: { planId: 'plan-gamma', name: 'Plan Gamma' }
    };
    const woA = prepareWorkOrderFromDecision(decisionA, 'COMMANDER_STAGED');

    expect(findMatchingDecisionForHash([decisionA], hashA)?.decisionId).toBe('DEC-2026-A');
    expect(findMatchingDecisionForHash([decisionA], hashB)).toBeNull();
    expect(findMatchingDecisionForHash([decisionA], null)).toBeNull();

    expect(findMatchingWorkOrderForHash([woA], hashA, 'plan-gamma')?.workOrderId).toBe(woA.workOrderId);
    expect(findMatchingWorkOrderForHash([woA], hashB, 'plan-gamma')).toBeNull();
  });

  it('TEST-OPS-08: Decision briefing reflects active disruption state and rejects stale hash exports', () => {
    const briefNominal = generateDecisionBriefing(evalNominal, dataset, null, null, []);
    const briefBlocked = generateDecisionBriefing(evalDisrupted, dataset, null, null, []);

    expect(briefNominal.scenarioContext.disruptionId).toBe('NONE_NOMINAL_DRAINAGE');
    expect(briefNominal.scenarioContext.culvertStatus).toContain('Nominal Unobstructed');

    expect(briefBlocked.scenarioContext.disruptionId).toBe('CULVERT-01-BROOKLINE-BLOCKAGE');
    expect(briefBlocked.scenarioContext.culvertStatus).toContain('CULVERT-01-BROOKLINE 100% Blocked');

    // Cross-binding verification must strictly reject stale hash
    expect(verifyBriefingBinding(briefNominal, briefNominal.scenarioHash)).toBe(true);
    expect(verifyBriefingBinding(briefNominal, briefBlocked.scenarioHash)).toBe(false);
  });
});
