/**
 * DELTA - Task 0.7.3.1: Architectural Remediation Regression Test Suite
 *
 * Verifies:
 * 1. Simulation persistence schema validation, size limits, and caller authentication.
 * 2. Canonical scenario hashing, deterministic integrity, and client mismatch rejection.
 * 3. Structured status handling for missing, malformed, stale, and completed runs.
 * 4. Dormant intervention evaluation resolver.
 * 5. Satellite imagery georeferencing alignment against EPSG:26986 bounds.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  saveSimulationRun,
  saveSimulationSnapshot,
  normalizeSimulationSnapshot,
  getSimulationStatus,
  saveInterventionsEvaluation,
  evaluateInterventions,
  validateSimulationRunPayload,
  computeCanonicalScenarioHash,
  validateSimulationRecordIntegrity,
  isRecordStale,
  __resetInMemoryStore,
  getStorageClient,
  SIMULATION_RUN_KEY
} from '../src/resolvers/index.js';
import { loadBostonCatchment } from '../src/data/catchmentLoader';
import { projectedToLatLon } from '../src/resolvers/coordinates.js';

describe('Task 0.7.3.1 Architectural Remediation Suite', () => {
  beforeEach(() => {
    __resetInMemoryStore();
  });

  const VALID_RUN_SUMMARY = {
    sector: 'Boston Longwood Medical Area & Muddy River Catchment (EPSG:26986)',
    stormId: '50-year',
    stormLabel: 'NOAA Atlas 14 50-Yr (104.2 mm total)',
    elapsedSimulationSeconds: 3600,
    cumulativeRainfallMm: 29.7,
    currentRainfallMmPerHour: 34.9,
    totalWaterVolumeM3: 45200,
    currentStorageM3: 38100,
    totalDrainedM3: 7100,
    maxWaterDepthM: 0.185,
    impassableRoadsCount: 2,
    atRiskFacilities: ["Brigham and Women's Hospital"],
    durationHours: 6.0,
    stormDepthMm: 104.2
  };

  const VALID_USER_AUTH = {
    accountId: 'qm:regular-project-engineer',
    principal: { accountId: 'qm:regular-project-engineer' }
  };

  describe('1. Simulation Persistence Security & Caller Auth', () => {
    it('TEST-SEC-01: Rejects empty, null, or non-object payloads', async () => {
      expect(() => validateSimulationRunPayload({})).toThrow(/sector must be a string/);
      expect(() => validateSimulationRunPayload(null)).toThrow(/non-null object/);
      expect(() => validateSimulationRunPayload([])).toThrow(/non-null object/);
      expect(() => validateSimulationRunPayload("string")).toThrow(/non-null object/);
    });

    it('TEST-SEC-02: Rejects payloads with missing or out-of-bound physics values', async () => {
      const negativeTime = { ...VALID_RUN_SUMMARY, elapsedSimulationSeconds: -10 };
      expect(() => validateSimulationRunPayload(negativeTime)).toThrow(/elapsedSimulationSeconds must be a finite number between 0 and 86,400/);

      const excessiveDepth = { ...VALID_RUN_SUMMARY, maxWaterDepthM: 120.0 };
      expect(() => validateSimulationRunPayload(excessiveDepth)).toThrow(/maxWaterDepthM must be a non-negative finite depth between 0 and 50/);

      const negativeVolume = { ...VALID_RUN_SUMMARY, totalWaterVolumeM3: -500 };
      expect(() => validateSimulationRunPayload(negativeVolume)).toThrow(/totalWaterVolumeM3 must be a non-negative finite volume/);
    });

    it('TEST-SEC-03: Rejects oversized simulation payloads (> 64 KB)', async () => {
      const hugeString = 'X'.repeat(70000);
      const bloatedPayload = {
        ...VALID_RUN_SUMMARY,
        oversizedPayloadField: hugeString
      };
      expect(() => validateSimulationRunPayload(bloatedPayload)).toThrow(/exceeds maximum permitted size/);
    });

    it('TEST-SEC-04: Rejects anonymous or unauthenticated sessions', async () => {
      const unauthContext = { accountId: 'anonymous' };
      await expect(saveSimulationRun(VALID_RUN_SUMMARY, null, unauthContext)).rejects.toThrow(
        /Missing or unverified Jira user session/
      );
    });

    it('TEST-SEC-05: Allows authenticated project engineer without requiring Incident Commander role', async () => {
      const res = await saveSimulationRun(VALID_RUN_SUMMARY, null, VALID_USER_AUTH);
      expect(res.success).toBe(true);
      expect(res.data.savedByAccountId).toBe('qm:regular-project-engineer');
      expect(res.data.savedAt).toBeDefined();
    });
  });

  describe('1b. saveSimulationSnapshot (UI invoke key)', () => {
    it('persists a UI snapshot payload and makes it readable via getSimulationStatus', async () => {
      const res = await saveSimulationSnapshot({
        profileId: 'reference-noaa-50yr', activeDisruptionIds: ['disruption-brookline-culvert'],
        elapsedSeconds: 7200, peakDepthM: 0.42, currentStorageM3: 51000, timestamp: new Date().toISOString()
      }, null, VALID_USER_AUTH);
      expect(res.success).toBe(true);
      expect(res.data.stormId).toBe('reference-noaa-50yr');
      expect(res.data.maxWaterDepthM).toBe(0.42);
      const status = await getSimulationStatus();
      expect(status.status).toBe('COMPLETED_RUN');
      expect(status.data.maxWaterDepthM).toBe(0.42);
    });

    it('normalizes unsafe profile ids into a valid stormId', () => {
      expect(normalizeSimulationSnapshot({ profileId: 'a/b c', peakDepthM: 1 }).stormId).toBe('a-b-c');
    });

    it('every invoke key used by the UI is defined in the resolver', () => {
      const uiFiles = ['src/context/IncidentWorkspaceContext.tsx','src/components/shell/views/DecisionRecordsView.tsx','src/components/shell/views/OperationalTicketsView.tsx','src/components/shell/views/InterventionsView.tsx','src/components/shell/views/FloodSimulationView.tsx','src/components/jira/IssuePanel.tsx'];
      const keys = new Set<string>();
      for (const f of uiFiles) { const src = fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8'); for (const m of src.matchAll(/invoke(?:Safe)?\(\s*'([^']+)'/g)) keys.add(m[1]); }
      const resolverSrc = fs.readFileSync(path.resolve(__dirname, '../src/resolvers/index.js'), 'utf8');
      const defined = new Set([...resolverSrc.matchAll(/resolver\.define\('([^']+)'/g)].map((m: any) => m[1]));
      expect([...keys].filter(k => !defined.has(k))).toEqual([]);
    });
  });

  describe('2. Canonical Scenario Hashing & Integrity', () => {
    it('TEST-INT-01: Computes deterministic canonical scenario hash server-side', () => {
      const hash1 = computeCanonicalScenarioHash({ stormId: '50-year', manningN: 0.025 });
      const hash2 = computeCanonicalScenarioHash({ stormId: '50-year', manningN: 0.025 });
      expect(hash1.scenarioHash).toBe(hash2.scenarioHash);
      expect(hash1.scenarioHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('TEST-INT-02: Rejects client-supplied scenarioHash that mismatches server computation', async () => {
      const tampered = {
        ...VALID_RUN_SUMMARY,
        scenarioHash: 'sha256:fake-hash-0000000000000000000000000000000000000000000000000000000000000000'
      };
      await expect(saveSimulationRun(tampered, null, VALID_USER_AUTH)).rejects.toThrow(
        /Scenario integrity failure/
      );
    });

    it('TEST-INT-03: Persists authoritative canonical scenario and hash with record', async () => {
      const res = await saveSimulationRun(VALID_RUN_SUMMARY, null, VALID_USER_AUTH);
      expect(res.data.scenarioHash).toBeDefined();
      expect(res.data.canonicalScenario).toBeDefined();
      expect(res.data.canonicalScenario.stormId).toBe('50-year');
    });
  });

  describe('3. Record Staleness & Malformed Record Guards', () => {
    it('TEST-STALE-01: Returns NO_RUN when KVS has no record', async () => {
      const status = await getSimulationStatus();
      expect(status.success).toBe(true);
      expect(status.status).toBe('NO_RUN');
    });

    it('TEST-STALE-02: Returns MALFORMED_RUN when record is empty {} or partial', async () => {
      const client = getStorageClient();
      await client.set(SIMULATION_RUN_KEY, {});

      const status = await getSimulationStatus();
      expect(status.success).toBe(true);
      expect(status.status).toBe('MALFORMED_RUN');
      expect(status.message).toContain('malformed');
    });

    it('TEST-STALE-03: Returns STALE_RUN when record timestamp exceeds staleness threshold', async () => {
      const client = getStorageClient();
      const oldDate = new Date(Date.now() - 48 * 3600 * 1000).toISOString(); // 48h old
      await client.set(SIMULATION_RUN_KEY, {
        ...VALID_RUN_SUMMARY,
        scenarioHash: 'sha256:test',
        savedAt: oldDate
      });

      const status = await getSimulationStatus(null, 24 * 3600 * 1000); // 24h threshold
      expect(status.success).toBe(true);
      expect(status.status).toBe('STALE_RUN');
      expect(status.ageHours).toBeGreaterThanOrEqual(47);
      expect(status.data).toBeDefined();
    });

    it('TEST-STALE-04: Returns COMPLETED_RUN when record is valid and fresh', async () => {
      await saveSimulationRun(VALID_RUN_SUMMARY, null, VALID_USER_AUTH);
      const status = await getSimulationStatus();
      expect(status.success).toBe(true);
      expect(status.status).toBe('COMPLETED_RUN');
      expect(status.ageHours).toBeLessThan(1);
      expect(status.data.stormId).toBe('50-year');
    });
  });

  describe('4. Dormant Intervention Resolver', () => {
    it('TEST-RESOLV-01: saveInterventionsEvaluation returns explicit dormant status', async () => {
      const res = await saveInterventionsEvaluation();
      expect(res.success).toBe(false);
      expect(res.status).toBe('DORMANT_NEEDS_PHASE_3');
      expect(res.message).toContain('dormant');
    });

    it('TEST-RESOLV-02: evaluateInterventions returns NO_RUN when uninitialized', async () => {
      const res = await evaluateInterventions();
      expect(res.success).toBe(true);
      expect(res.status).toBe('NO_RUN');
    });
  });

  describe('5. Satellite Georeferencing & Bounds Alignment', () => {
    it('TEST-GEO-01: Verifies exact DEM bounds in EPSG:26986 and derived EPSG:4326 extents', () => {
      const dataset = loadBostonCatchment();
      const { xmin, xmax, ymin, ymax, widthM, heightM } = dataset.metadata.spatialReference.projectedBounds;

      expect(xmin).toBe(231650.0);
      expect(xmax).toBe(233250.0);
      expect(ymin).toBe(897900.0);
      expect(ymax).toBe(899500.0);
      expect(widthM).toBe(1600.0);
      expect(heightM).toBe(1600.0);

      const sw = projectedToLatLon(xmin, ymin);
      const ne = projectedToLatLon(xmax, ymax);

      expect(sw.lat).toBeCloseTo(42.33095, 4);
      expect(sw.lon).toBeCloseTo(-71.11598, 4);
      expect(ne.lat).toBeCloseTo(42.34529, 4);
      expect(ne.lon).toBeCloseTo(-71.09647, 4);
    });
  });
});
