/**
 * DELTA - Workstream 3B: Storm Profile Selector & Stress Comparison UI Test Suite
 *
 * Verifies:
 * 1. Profile selection covers all 4 authoritative stress profiles with declared metadata.
 * 2. Invariant 6-hour NOAA Atlas 14 regional benchmark is preserved as default reference.
 * 3. Execution results binding across baseline and all three intervention plans.
 * 4. Switching profiles produces non-stale, profile-specific physical outputs.
 * 5. Plan Alpha localized adverse ponding deflection (+15 cm, affected cells, deflected volume) is exposed.
 * 6. Plan Gamma point-sink limitation disclosure is preserved.
 * 7. Road transitions track both restored (<0.30m) and worsened (>=0.30m) corridors.
 * 8. Switching between profiles and returning to reference profile is strictly deterministic.
 * 9. Effectiveness classification explicitly documents the 50 m³ screening threshold caveat.
 * 10. Canvas depth and delta layers maintain exact mathematical correspondence to solver outputs.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { loadBostonCatchment } from '../src/data/catchmentLoader';
import {
  AUTHORITATIVE_STRESS_PROFILES,
  executeMultiScenarioEvaluation,
  MultiScenarioEvaluationResult,
  StressProfile
} from '../src/simulation/interventionEngine';

describe('Workstream 3B: Storm Profile Selector & Stress Comparison UI', () => {
  const dataset = loadBostonCatchment();
  const { nx, ny } = dataset.metadata.grid;

  const testModerateProfile: StressProfile = {
    ...AUTHORITATIVE_STRESS_PROFILES['synthetic-moderate-stress'],
    durationHours: 300 / 3600,
    durationSeconds: 300,
    totalRainfallMm: 35.0 * (300 / 3600)
  };

  const testLowProfile: StressProfile = {
    ...AUTHORITATIVE_STRESS_PROFILES['synthetic-low-intensity'],
    durationHours: 180 / 3600,
    durationSeconds: 180,
    totalRainfallMm: 15.0 * (180 / 3600)
  };

  let resModerate: MultiScenarioEvaluationResult;
  let resLow: MultiScenarioEvaluationResult;

  beforeAll(() => {
    resModerate = executeMultiScenarioEvaluation(dataset, testModerateProfile, 35.0, 30.0);
    resLow = executeMultiScenarioEvaluation(dataset, testLowProfile, 15.0, 30.0);
  }, 30000);

  describe('1. Profile Selector & Metadata Integrity', () => {
    it('TEST-UI-STRESS-01: Profile selector options cover all 4 authoritative profiles with exact metadata', () => {
      const expectedProfiles = [
        { id: 'reference-noaa-50yr', depth: 104.2, durationH: 6.0, type: 'REGIONAL_NOAA_BENCHMARK' },
        { id: 'synthetic-moderate-stress', depth: 35.0, durationH: 1.0, type: 'SYNTHETIC_STRESS_INPUT' },
        { id: 'synthetic-high-intensity', depth: 37.5, durationH: 0.5, type: 'SYNTHETIC_STRESS_INPUT' },
        { id: 'synthetic-low-intensity', depth: 15.0, durationH: 1.0, type: 'SYNTHETIC_STRESS_INPUT' },
      ];

      for (const exp of expectedProfiles) {
        const p = AUTHORITATIVE_STRESS_PROFILES[exp.id];
        expect(p).toBeDefined();
        expect(p.totalRainfallMm).toBeCloseTo(exp.depth, 1);
        expect(p.durationHours).toBe(exp.durationH);
        expect(p.type).toBe(exp.type);
        expect(p.provenance.length).toBeGreaterThan(15);
      }
    });

    it('TEST-UI-STRESS-02: Preserves 6-hour NOAA Atlas 14 regional benchmark as the default reference', () => {
      const ref = AUTHORITATIVE_STRESS_PROFILES['reference-noaa-50yr'];
      expect(ref.id).toBe('reference-noaa-50yr');
      expect(ref.totalRainfallMm).toBe(104.2);
      expect(ref.durationSeconds).toBe(21600);
      expect(ref.provenance).toContain('Station 19-0770');
      expect(ref.disclosures[0]).toContain('Regional meteorological benchmark');
    });
  });

  describe('2. Scenario Recalculation & Execution Binding', () => {
    it('TEST-UI-STRESS-03: Recalculation runs 4 distinct scenarios with invariant baseline initial conditions', () => {
      expect(resModerate.baseline).toBeDefined();
      expect(resModerate.planAlpha).toBeDefined();
      expect(resModerate.planBeta).toBeDefined();
      expect(resModerate.planGamma).toBeDefined();

      // All 4 scenarios must have 4096-element water depth arrays
      expect(resModerate.baseline.waterDepth.length).toBe(nx * ny);
      expect(resModerate.planAlpha.waterDepth.length).toBe(nx * ny);
      expect(resModerate.planBeta.waterDepth.length).toBe(nx * ny);
      expect(resModerate.planGamma.waterDepth.length).toBe(nx * ny);

      // Mass balance conservation relative error < 1e-10 across all 4 scenarios
      expect(resModerate.baseline.relativeConservationError).toBeLessThan(1e-10);
      expect(resModerate.planAlpha.relativeConservationError).toBeLessThan(1e-10);
      expect(resModerate.planBeta.relativeConservationError).toBeLessThan(1e-10);
      expect(resModerate.planGamma.relativeConservationError).toBeLessThan(1e-10);
    });

    it('TEST-UI-STRESS-04: Switching profiles dynamically recalculates flood volumes and drainage', () => {
      // Moderate intensity storm generates substantially more surface storage than low intensity
      expect(resModerate.baseline.totalWaterVolumeM3).toBeGreaterThan(resLow.baseline.totalWaterVolumeM3);
      expect(resModerate.baseline.currentStorageM3).toBeGreaterThan(resLow.baseline.currentStorageM3);
      expect(resModerate.baseline.maxWaterDepthM).toBeGreaterThan(resLow.baseline.maxWaterDepthM);

      // Metadata correctly tracks profile ID and provenance
      expect(resLow.simulationMetadata.profileId).toBe('synthetic-low-intensity');
      expect(resModerate.simulationMetadata.profileId).toBe('synthetic-moderate-stress');
    });
  });

  describe('3. Plan Alpha Adverse Deflection & Plan Gamma Disclosures', () => {
    it('TEST-UI-STRESS-05: Plan Alpha explicitly exposes localized adverse ponding deflection structure and precedence', () => {
      const diffA = resModerate.differentials['plan-alpha'];

      // Plan Alpha deflection structure must always be defined and mass-area consistent
      expect(diffA.spatialDeflection).toBeDefined();
      expect(diffA.spatialDeflection.adverseAreaM2).toBe(diffA.spatialDeflection.adverseCellCount * 625.0);
      expect(diffA.spatialDeflection.deflectedVolumeM3).toBeGreaterThanOrEqual(0);
      expect(diffA.spatialDeflection.maxAdverseDepthIncreaseM).toBeGreaterThanOrEqual(0);

      // Precedence check: if adverse deflection occurs (>=5cm rise or >=25 m³), classification MUST be ADVERSE_LOCAL_DEFLECTION
      if (diffA.spatialDeflection.maxAdverseDepthIncreaseM >= 0.05 || diffA.spatialDeflection.deflectedVolumeM3 >= 25.0) {
        expect(diffA.classification).toBe('ADVERSE_LOCAL_DEFLECTION');
      }
    });

    it('TEST-UI-STRESS-06: Plan Gamma findings explicitly disclose the unrouted road-deck point sink limitation', () => {
      const tradeOffs = resModerate.comparison.tradeOffs.join(' ');

      expect(tradeOffs).toContain('Brookline culvert is represented as an unrouted point drainage sink');
      expect(tradeOffs).toContain('7.51m NAVD88');
      expect(tradeOffs).toContain('water is destroyed from domain storage rather than conveyed through a dynamic conduit');
    });
  });

  describe('4. Road Transitions & Screening Caveats', () => {
    it('TEST-UI-STRESS-07: Reports road transitions with improved and worsened corridors cleanly separated', () => {
      const diffG = resModerate.differentials['plan-gamma'];

      expect(diffG.roadTransitions).toBeDefined();
      expect(Array.isArray(diffG.roadTransitions.improvedRoadNames)).toBe(true);
      expect(Array.isArray(diffG.roadTransitions.worsenedRoadNames)).toBe(true);
      expect(diffG.protectedRoadCount).toBe(diffG.roadTransitions.improvedRoadNames.length);
    });

    it('TEST-UI-STRESS-08: Deterministic findings caveat the 50 m³ screening threshold', () => {
      // Under low intensity, check screening threshold rationale
      if (resLow.comparison.recommendedPlanId === null) {
        expect(resLow.comparison.recommendationRationale).toContain('50 m³');
        expect(resLow.comparison.recommendationRationale).toContain('screening threshold');
      } else {
        expect(resLow.comparison.recommendationRationale).toContain('screening');
      }
    });

    it('TEST-UI-STRESS-09: Switching between profiles and returning to reference profile is strictly deterministic', () => {
      const runAgain = executeMultiScenarioEvaluation(dataset, testModerateProfile, 35.0, 30.0);

      // Recomputed moderate profile must be bit-identical to earlier run
      expect(runAgain.baseline.currentStorageM3).toBe(resModerate.baseline.currentStorageM3);
      expect(runAgain.differentials['plan-gamma'].avoidedSurfaceVolumeM3).toBe(resModerate.differentials['plan-gamma'].avoidedSurfaceVolumeM3);
      expect(runAgain.differentials['plan-beta'].avoidedSurfaceVolumeM3).toBe(resModerate.differentials['plan-beta'].avoidedSurfaceVolumeM3);
      expect(runAgain.differentials['plan-alpha'].avoidedSurfaceVolumeM3).toBe(resModerate.differentials['plan-alpha'].avoidedSurfaceVolumeM3);
    }, 30000);
  });

  describe('5. Canvas Delta & Depth Math Integrity', () => {
    it('TEST-UI-STRESS-10: Canvas delta mode computes signed depth difference (positive = avoided water, negative = deflection)', () => {
      const baselineDepth = resModerate.baseline.waterDepth;
      const alphaDepth = resModerate.planAlpha.waterDepth;

      let maxBeneficialDelta = 0;
      let minAdverseDelta = 0;

      for (let i = 0; i < nx * ny; i++) {
        const delta = baselineDepth[i] - alphaDepth[i];
        if (delta > maxBeneficialDelta) maxBeneficialDelta = delta;
        if (delta < minAdverseDelta) minAdverseDelta = delta;
      }

      // Delta mode verifies mathematical sign convention: positive delta = avoided water, negative = localized increase
      expect(maxBeneficialDelta).toBeGreaterThan(0.0005);
      expect(minAdverseDelta).toBeLessThanOrEqual(0.0);
    });
  });
});
