/**
 * Boston Catchment Dataset Validation & Integration Test Suite
 * Asserts structural integrity, real geographic provenance compliance,
 * coordinate consistency, and direct hydraulic solver coupling.
 */

import { describe, it, expect } from 'vitest';
import {
  loadBostonCatchment,
  createHydraulicConfigFromCatchment,
  latLonToGrid,
  gridToLatLon,
} from '../src/data/catchmentLoader.ts';
import { createHydraulicState, stepHydraulics } from '../src/simulation/hydraulicSolver.ts';

describe('Boston Longwood & Muddy River Catchment Dataset Integrity', () => {
  const dataset = loadBostonCatchment();

  it('TEST-DATA-01: Grid dimensions and cell counts match 64x64 specification', () => {
    const { nx, ny, dx, dy, cellAreaM2, totalAreaKm2 } = dataset.metadata.grid;
    expect(nx).toBe(64);
    expect(ny).toBe(64);
    expect(dx).toBe(25.0);
    expect(dy).toBe(25.0);
    expect(cellAreaM2).toBe(625.0);
    expect(totalAreaKm2).toBe(2.56);

    // Elevation matrix structure
    expect(dataset.elevationMatrix.length).toBe(64);
    for (let r = 0; r < 64; r++) {
      expect(dataset.elevationMatrix[r].length).toBe(64);
    }
  });

  it('TEST-DATA-02: Elevation statistics reflect real USGS 3DEP topography without NaN or Inf', () => {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let finiteCount = 0;

    for (let r = 0; r < 64; r++) {
      for (let c = 0; c < 64; c++) {
        const z = dataset.elevationMatrix[r][c];
        expect(Number.isFinite(z)).toBe(true);
        if (z < min) min = z;
        if (z > max) max = z;
        sum += z;
        finiteCount++;
      }
    }

    expect(finiteCount).toBe(4096);
    expect(min).toBeGreaterThan(0.3); // Near Muddy River / Charles River base
    expect(min).toBeLessThan(1.0);
    expect(max).toBeGreaterThan(60.0); // Parker Hill summit
    expect(max).toBeLessThan(70.0);

    const mean = sum / 4096;
    expect(mean).toBeGreaterThan(7.0);
    expect(mean).toBeLessThan(11.0);

    // Match metadata stats within float rounding
    expect(dataset.metadata.elevationStatistics.minElevationM).toBeCloseTo(min, 1);
    expect(dataset.metadata.elevationStatistics.maxElevationM).toBeCloseTo(max, 1);
  });

  it('TEST-DATA-03: Critical medical facilities exist with verified OpenStreetMap IDs and valid bounds', () => {
    const facilities = dataset.criticalFacilities;
    expect(facilities.length).toBe(5);

    const expectedFacilities = [
      "Brigham and Women's Hospital",
      "Boston Children's Hospital",
      "Beth Israel Deaconess Medical Center (West Campus)",
      "Beth Israel Deaconess Medical Center (East Campus)",
      "Dana-Farber Cancer Institute",
    ];

    for (const name of expectedFacilities) {
      const fac = facilities.find((f) => f.name === name);
      expect(fac).toBeDefined();
      expect(fac!.osmId).toBeGreaterThan(0);
      expect(fac!.isMeasuredLocation).toBe(true);
      expect(['way', 'relation']).toContain(fac!.osmType);

      // Verify grid coordinates within [0, 63]
      const [r, c] = fac!.gridCell;
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(64);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(64);

      // Verify lat/lon within bounding box
      const bounds = dataset.metadata.geographicBounds;
      expect(fac!.location.lat).toBeGreaterThanOrEqual(bounds.south);
      expect(fac!.location.lat).toBeLessThanOrEqual(bounds.north);
      expect(fac!.location.lon).toBeGreaterThanOrEqual(bounds.west);
      expect(fac!.location.lon).toBeLessThanOrEqual(bounds.east);
    }
  });

  it('TEST-DATA-04: Critical access roads are extracted with valid geometries and elevation profiles', () => {
    const roads = dataset.criticalRoads;
    expect(roads.length).toBeGreaterThan(50);

    const arterialNames = roads.map((r) => r.name);
    expect(arterialNames).toContain('Brookline Avenue');
    expect(arterialNames).toContain('Longwood Avenue');

    for (const road of roads) {
      expect(road.osmId).toBeGreaterThan(0);
      expect(road.gridCells.length).toBeGreaterThan(0);
      expect(road.elevationProfileM.length).toBe(road.gridCells.length);

      for (let i = 0; i < road.gridCells.length; i++) {
        const [r, c] = road.gridCells[i];
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThan(64);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThan(64);

        // Profile elevation should match elevation matrix cell
        expect(road.elevationProfileM[i]).toBe(dataset.elevationMatrix[r][c]);
      }
    }
  });

  it('TEST-DATA-05: Modelled drainage explicitly marked as synthetic assumptions', () => {
    const drainage = dataset.modelledDrainageInlets;
    expect(drainage.length).toBe(3);

    for (const inlet of drainage) {
      expect(inlet.isModelledAssumption).toBe(true);
      expect(inlet.designCapacityM3PerSec).toBeGreaterThan(0);
      expect(inlet.modellingRationale.length).toBeGreaterThan(15);
      const [r, c] = inlet.gridCell;
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(64);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(64);
      expect(inlet.gridIndex).toBe(r * 64 + c);
    }
  });

  it('TEST-DATA-06: Provenance, license, and attribution fields strictly populated', () => {
    expect(dataset.license.topography).toContain('USGS');
    expect(dataset.license.infrastructure).toContain('OpenStreetMap');
    expect(dataset.license.infrastructure).toContain('ODbL');
    expect(dataset.attribution.topography).toContain('USGS 3D Elevation Program');
    expect(dataset.attribution.meteorology).toContain('NOAA Atlas 14');
    expect(dataset.metadata.spatialReference.projectedCRS).toBe('NAD83 / Massachusetts Mainland (EPSG:26986)');
  });

  it('TEST-DATA-07: Coordinate transform functions map accurately between lat/lon and grid indices', () => {
    const bounds = dataset.metadata.geographicBounds;

    // NW corner (lat = north, lon = west) should map to row 0, col 0
    const nw = latLonToGrid(bounds.north - 0.0001, bounds.west + 0.0001, bounds, 64, 64);
    expect(nw.row).toBe(0);
    expect(nw.col).toBe(0);
    expect(nw.cellIndex).toBe(0);

    // SE corner (lat = south, lon = east) should map to row 63, col 63
    const se = latLonToGrid(bounds.south + 0.0001, bounds.east - 0.0001, bounds, 64, 64);
    expect(se.row).toBe(63);
    expect(se.col).toBe(63);
    expect(se.cellIndex).toBe(63 * 64 + 63);

    // Center cell roundtrip
    const centerCellLatLon = gridToLatLon(32, 32, bounds, 64, 64);
    const roundtrip = latLonToGrid(centerCellLatLon.lat, centerCellLatLon.lon, bounds, 64, 64);
    expect(roundtrip.row).toBe(32);
    expect(roundtrip.col).toBe(32);
  });
});

describe('Boston Dataset Hydraulic Solver Integration', () => {
  it('TEST-DATA-08: Converts to HydraulicGridConfig and steps solver with conservation < 1e-10', () => {
    const dataset = loadBostonCatchment();
    const config = createHydraulicConfigFromCatchment(dataset, {
      manningN: 0.025,
      defaultInfiltrationMmPerHour: 2.0, // 2 mm/h
      openBoundaries: 'muddy_river_outlet',
    });

    expect(config.nx).toBe(64);
    expect(config.ny).toBe(64);
    expect(config.dx).toBe(25.0);
    expect(config.elevation.length).toBe(4096);
    expect(config.drainageInlets?.length).toBe(3);
    expect(config.openBoundaryIndices?.length).toBe(9); // cols 40..48 on row 0

    let state = createHydraulicState(config);
    expect(state.accounting.initialStorageM3).toBe(0);

    // Run 10 macro steps of 2.0s with 50 mm/h rain (approx NOAA 50-year storm peak)
    for (let step = 0; step < 10; step++) {
      state = stepHydraulics(state, {
        dtMacroSeconds: 2.0,
        rainfallRateMmPerHour: 50.0,
      });
    }

    expect(state.totalTimeSeconds).toBe(20.0);
    expect(state.accounting.cumulativeRainfallM3).toBeGreaterThan(0);
    expect(state.accounting.relativeError).toBeLessThan(1e-10);

    // Total water in system + losses must equal cumulative rainfall
    const calculatedTotal =
      state.accounting.currentStorageM3 +
      state.accounting.cumulativeInfiltrationM3 +
      state.accounting.cumulativeDrainageM3 +
      state.accounting.cumulativeBoundaryOutflowM3;

    expect(calculatedTotal).toBeCloseTo(state.accounting.cumulativeRainfallM3, 5);
  });
});
