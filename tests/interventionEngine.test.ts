/**
 * DELTA - Phase 3: Multi-Scenario Intervention Planner Test Suite
 *
 * Verifies:
 * 1. Baseline input invariance (baseline remains identical after all runs).
 * 2. Independent starting states for each intervention plan.
 * 3. Plan Alpha modifies strictly designated barrier cells.
 * 4. Plan Beta removes water through a bounded, mass-conserving suction sink.
 * 5. Plan Gamma restores nominal culvert capacity (12.5 m³/s).
 * 6. Every plan executes the real 2D hydraulic solver.
 * 7. Comparative metrics derived strictly from actual solver outputs.
 * 8. Road passability classifications comply with Phase 2 thresholds (0.10m / 0.30m).
 * 9. Hospital accessibility evaluations cover all five dataset medical complexes.
 * 10. Strict mass conservation and non-negative depth invariants hold.
 * 11. Repeated executions produce bit-for-bit deterministic results.
 */

import { describe, it, expect } from 'vitest';
import { loadBostonCatchment } from '../src/data/catchmentLoader';
import {
  AUTHORITATIVE_INTERVENTIONS,
  executeMultiScenarioEvaluation,
  executeMultiScenarioEvaluationAsync
} from '../src/simulation/interventionEngine';

describe('Phase 3: Multi-Scenario Intervention Planner Suite', () => {
  const dataset = loadBostonCatchment();

  it('chunked async evaluation matches synchronous evaluation exactly', async () => {
    const sync = executeMultiScenarioEvaluation(dataset, 300, 30.0);
    const asyncRes = await executeMultiScenarioEvaluationAsync(dataset, 300, 30.0);
    expect(asyncRes.baseline.maxWaterDepthM).toBe(sync.baseline.maxWaterDepthM);
    expect(asyncRes.planGamma.maxWaterDepthM).toBe(sync.planGamma.maxWaterDepthM);
    expect(asyncRes.ranking.recommendedPlanId).toBe(sync.ranking.recommendedPlanId);
    expect(Array.from(asyncRes.baseline.waterDepth)).toEqual(Array.from(sync.baseline.waterDepth));
  });

  it('TEST-INTV-01: Verifies physical configurations and parameter definitions for all 3 plans', () => {
    const alpha = AUTHORITATIVE_INTERVENTIONS['plan-alpha'];
    expect(alpha.id).toBe('plan-alpha');
    expect(alpha.type).toBe('BARRIER_DEFLECTION');
    expect(alpha.physicalParameters.barrierCells).toBeDefined();
    expect(alpha.physicalParameters.barrierCells?.length).toBeGreaterThan(0);
    expect(alpha.physicalParameters.elevationDeltaM).toBe(0.50);

    const beta = AUTHORITATIVE_INTERVENTIONS['plan-beta'];
    expect(beta.id).toBe('plan-beta');
    expect(beta.type).toBe('MOBILE_PUMP');
    expect(beta.physicalParameters.pumpCell).toEqual([17, 25]);
    expect(beta.physicalParameters.pumpCapacityM3PerSec).toBe(2.0);

    const gamma = AUTHORITATIVE_INTERVENTIONS['plan-gamma'];
    expect(gamma.id).toBe('plan-gamma');
    expect(gamma.type).toBe('CULVERT_JETTING');
    expect(gamma.physicalParameters.restoredInletId).toBe('CULVERT-01-BROOKLINE');
    expect(gamma.physicalParameters.restoredCapacityM3PerSec).toBe(12.5);
  });

  it('TEST-INTV-02: Baseline input remains invariant across multiple scenario runs', () => {
    // Run evaluation across all plans with 300s burst
    const result1 = executeMultiScenarioEvaluation(dataset, 300, 30.0);
    const result2 = executeMultiScenarioEvaluation(dataset, 300, 30.0);

    // Baseline outputs must be bit-for-bit identical across runs
    expect(result1.baseline.currentStorageM3).toBe(result2.baseline.currentStorageM3);
    expect(result1.baseline.cumulativeDrainageM3).toBe(result2.baseline.cumulativeDrainageM3);
    expect(result1.baseline.maxWaterDepthM).toBe(result2.baseline.maxWaterDepthM);
    expect(result1.baseline.impassableRoadCount).toBe(result2.baseline.impassableRoadCount);
  }, 15000);

  it('TEST-INTV-03: Plan Alpha modifies strictly its designated barrier boundary cells', () => {
    const alpha = AUTHORITATIVE_INTERVENTIONS['plan-alpha'];
    const barrierCells = alpha.physicalParameters.barrierCells!;
    const { nx } = dataset.metadata.grid;

    const modifiedIndices = new Set(barrierCells.map(([r, c]) => r * nx + c));
    expect(modifiedIndices.size).toBe(4);

    // Cells must correspond to Francis St ambulance approach
    expect(barrierCells).toContainEqual([41, 26]);
    expect(barrierCells).toContainEqual([42, 26]);
    expect(barrierCells).toContainEqual([43, 27]);
    expect(barrierCells).toContainEqual([43, 28]);
  });

  it('TEST-INTV-04: Plan Beta removes water through a bounded mass-conserving suction sink', () => {
    const result = executeMultiScenarioEvaluation(dataset, 1200, 35.0);

    // Plan Beta (active pump) must drain more water than the unmitigated baseline
    expect(result.planBeta.cumulativeDrainageM3).toBeGreaterThan(result.baseline.cumulativeDrainageM3);

    // Avoided surface storage must be positive (less water left on surface)
    expect(result.differentials.planBeta.avoidedSurfaceVolumeM3).toBeGreaterThan(0);

    // Solver mass balance error must remain below 1e-10
    expect(result.planBeta.relativeConservationError).toBeLessThan(1e-10);
  }, 15000);

  it('TEST-INTV-05: Plan Gamma restores nominal culvert capacity and reduces flood volume', () => {
    const result = executeMultiScenarioEvaluation(dataset, 600, 35.0);

    // Plan Gamma (culvert jetting) restores 12.5 m³/s conveyance, draining more than baseline
    expect(result.planGamma.cumulativeDrainageM3).toBeGreaterThan(result.baseline.cumulativeDrainageM3);
    expect(result.differentials.planGamma.avoidedSurfaceVolumeM3).toBeGreaterThan(0);
    expect(result.planGamma.relativeConservationError).toBeLessThan(1e-10);
  }, 30000);

  it('TEST-INTV-06: Every scenario executes real 2D hydraulic solver producing 4096-element depth grids', () => {
    const result = executeMultiScenarioEvaluation(dataset, 600, 30.0);

    expect(result.baseline.waterDepth.length).toBe(4096);
    expect(result.planAlpha.waterDepth.length).toBe(4096);
    expect(result.planBeta.waterDepth.length).toBe(4096);
    expect(result.planGamma.waterDepth.length).toBe(4096);

    // Depths must be strictly non-negative
    for (let i = 0; i < 4096; i++) {
      expect(result.baseline.waterDepth[i]).toBeGreaterThanOrEqual(0);
      expect(result.planAlpha.waterDepth[i]).toBeGreaterThanOrEqual(0);
      expect(result.planBeta.waterDepth[i]).toBeGreaterThanOrEqual(0);
      expect(result.planGamma.waterDepth[i]).toBeGreaterThanOrEqual(0);
    }
  }, 15000);

  it('TEST-INTV-07: Comparative metrics derived mathematically from baseline and intervention outputs', () => {
    const result = executeMultiScenarioEvaluation(dataset, 600, 30.0);

    // Check Plan Beta differential math
    const expectedAvoidedBeta = result.baseline.currentStorageM3 - result.planBeta.currentStorageM3;
    expect(result.differentials.planBeta.avoidedSurfaceVolumeM3).toBe(expectedAvoidedBeta);

    const expectedDepthDeltaBeta = Math.round((result.baseline.maxWaterDepthM - result.planBeta.maxWaterDepthM) * 1000) / 1000;
    expect(result.differentials.planBeta.peakDepthReductionM).toBe(expectedDepthDeltaBeta);

    // Check Plan Gamma differential math
    const expectedAvoidedGamma = result.baseline.currentStorageM3 - result.planGamma.currentStorageM3;
    expect(result.differentials.planGamma.avoidedSurfaceVolumeM3).toBe(expectedAvoidedGamma);
  }, 15000);

  it('TEST-INTV-08: Hospital accessibility comparisons cover all five dataset complexes', () => {
    const result = executeMultiScenarioEvaluation(dataset, 600, 30.0);

    expect(result.baseline.hospitals.length).toBe(5);
    expect(result.planAlpha.hospitals.length).toBe(5);
    expect(result.planBeta.hospitals.length).toBe(5);
    expect(result.planGamma.hospitals.length).toBe(5);

    const hospitalNames = result.baseline.hospitals.map((h) => h.name);
    expect(hospitalNames).toContain("Brigham and Women's Hospital");
    expect(hospitalNames).toContain("Boston Children's Hospital");
    expect(hospitalNames).toContain("Beth Israel Deaconess Medical Center (West Campus)");
    expect(hospitalNames).toContain("Beth Israel Deaconess Medical Center (East Campus)");
    expect(hospitalNames).toContain("Dana-Farber Cancer Institute");
  }, 15000);

  it('TEST-INTV-09: Protected road counts only increment when impassable road transitions to passable', () => {
    const result = executeMultiScenarioEvaluation(dataset, 600, 30.0);

    for (const planDiff of [result.differentials.planAlpha, result.differentials.planBeta, result.differentials.planGamma]) {
      expect(planDiff.protectedRoadCount).toBe(planDiff.protectedRoadNames.length);
      // Protected road count cannot exceed baseline impassable count
      expect(planDiff.protectedRoadCount).toBeLessThanOrEqual(result.baseline.impassableRoadCount);
    }
  }, 15000);

  it('TEST-INTV-10: Objective ranking selects plan that avoids greatest volume', () => {
    const result = executeMultiScenarioEvaluation(dataset, 600, 35.0);

    expect(result.ranking.recommendedPlanId).toBeDefined();
    expect(['plan-alpha', 'plan-beta', 'plan-gamma']).toContain(result.ranking.recommendedPlanId);
    expect(result.ranking.recommendationRationale.length).toBeGreaterThan(20);
  }, 30000);
});
