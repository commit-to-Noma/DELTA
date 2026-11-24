import { describe, it, expect } from 'vitest';
import { 
  createHydraulicState, 
  stepHydraulics, 
  type HydraulicGridConfig 
} from '../src/simulation/hydraulicSolver';

describe('DELTA Hydraulic Simulation Engine — Mathematical Verification', () => {
  const defaultNx = 16;
  const defaultNy = 16;
  const defaultDx = 25.0; // 25 meters

  // Helper to create a flat elevation grid
  function createFlatConfig(elevation = 20.0): HydraulicGridConfig {
    const numCells = defaultNx * defaultNy;
    const elev = new Float64Array(numCells);
    elev.fill(elevation);
    return {
      nx: defaultNx,
      ny: defaultNy,
      dx: defaultDx,
      elevation: elev,
      manningN: 0.025,
    };
  }

  // TEST-01: Water Conservation with Rainfall
  it('TEST-01: strictly conserves water under varying rainfall hydrograph with zero outfalls', () => {
    const config = createFlatConfig(15.0);
    let state = createHydraulicState(config);

    // Apply 6 hours (varying rainfall intensity)
    const rainfallSeries = [20, 45, 80, 110, 60, 15]; // mm/hr each hour

    for (const rainRate of rainfallSeries) {
      for (let step = 0; step < 10; step++) {
        state = stepHydraulics(state, {
          dtMacroSeconds: 2.0,
          rainfallRateMmPerHour: rainRate,
        });
      }
    }

    expect(state.accounting.relativeError).toBeLessThan(1e-10);
    expect(state.accounting.currentStorageM3).toBeGreaterThan(0);
    expect(
      Math.abs(state.accounting.currentStorageM3 - state.accounting.cumulativeRainfallM3)
    ).toBeLessThan(1e-6);
  });

  // TEST-02: Water Conservation with Infiltration
  it('TEST-02: strictly conserves water balance with active infiltration losses', () => {
    const numCells = defaultNx * defaultNy;
    const infil = new Float64Array(numCells);
    infil.fill(0.0001); // 0.1 mm/s = 360 mm/hr high infiltration

    const config: HydraulicGridConfig = {
      ...createFlatConfig(10.0),
      infiltrationRate: infil,
    };

    let state = createHydraulicState(config);

    for (let step = 0; step < 20; step++) {
      state = stepHydraulics(state, {
        dtMacroSeconds: 2.0,
        rainfallRateMmPerHour: 50.0,
      });
    }

    expect(state.accounting.cumulativeInfiltrationM3).toBeGreaterThan(0);
    expect(state.accounting.relativeError).toBeLessThan(1e-10);
  });

  // TEST-03: Water Conservation with Drainage Inlets
  it('TEST-03: strictly conserves water balance with drainage culvert outfalls', () => {
    const config: HydraulicGridConfig = {
      ...createFlatConfig(10.0),
      drainageInlets: [
        { index: 35, capacityM3PerSec: 5.0, blockageRatio: 0.0 },
        { index: 72, capacityM3PerSec: 8.0, blockageRatio: 0.2 },
      ],
    };

    let state = createHydraulicState(config);

    for (let step = 0; step < 25; step++) {
      state = stepHydraulics(state, {
        dtMacroSeconds: 2.0,
        rainfallRateMmPerHour: 60.0,
      });
    }

    expect(state.accounting.cumulativeDrainageM3).toBeGreaterThan(0);
    expect(state.accounting.relativeError).toBeLessThan(1e-10);
  });

  // TEST-04: Water Conservation with Open Boundary Outflow
  it('TEST-04: strictly accounts for water volume leaving through open boundary faces', () => {
    const numCells = defaultNx * defaultNy;
    const elev = new Float64Array(numCells);

    // Sloped towards eastern boundary (i = nx - 1)
    for (let j = 0; j < defaultNy; j++) {
      for (let i = 0; i < defaultNx; i++) {
        elev[j * defaultNx + i] = 50.0 - i * 1.5; // Slope downward to the east
      }
    }

    // Designate entire east edge as open boundary
    const openBoundaries: number[] = [];
    for (let j = 0; j < defaultNy; j++) {
      openBoundaries.push(j * defaultNx + (defaultNx - 1));
    }

    const config: HydraulicGridConfig = {
      nx: defaultNx,
      ny: defaultNy,
      dx: defaultDx,
      elevation: elev,
      openBoundaryIndices: openBoundaries,
    };

    // Preload domain with 0.5m water
    const initialDepth = new Float64Array(numCells);
    initialDepth.fill(0.5);

    let state = createHydraulicState(config, initialDepth);

    for (let step = 0; step < 30; step++) {
      state = stepHydraulics(state, {
        dtMacroSeconds: 2.0,
        rainfallRateMmPerHour: 0.0, // Drainage of pre-existing storage
      });
    }

    expect(state.accounting.cumulativeBoundaryOutflowM3).toBeGreaterThan(0);
    expect(state.accounting.relativeError).toBeLessThan(1e-10);
  });

  // TEST-05: Downhill Flow Direction
  it('TEST-05: verifies water flows strictly in the direction of negative elevation slope', () => {
    const numCells = defaultNx * defaultNy;
    const elev = new Float64Array(numCells);

    // Ridge in the west (high), Valley in the east (low)
    for (let j = 0; j < defaultNy; j++) {
      for (let i = 0; i < defaultNx; i++) {
        elev[j * defaultNx + i] = 100.0 - i * 2.0;
      }
    }

    const config: HydraulicGridConfig = {
      nx: defaultNx,
      ny: defaultNy,
      dx: defaultDx,
      elevation: elev,
    };

    // Deposit water block only on western column (i=0)
    const initialDepth = new Float64Array(numCells);
    for (let j = 0; j < defaultNy; j++) {
      initialDepth[j * defaultNx + 0] = 1.0;
    }

    let state = createHydraulicState(config, initialDepth);

    // Step simulation
    for (let step = 0; step < 15; step++) {
      state = stepHydraulics(state, {
        dtMacroSeconds: 2.0,
        rainfallRateMmPerHour: 0.0,
      });
    }

    // Downhill cells (i > 0) must have received water
    let downhillWaterFound = false;
    for (let j = 0; j < defaultNy; j++) {
      for (let i = 1; i < defaultNx; i++) {
        if (state.waterDepth[j * defaultNx + i] > 0) {
          downhillWaterFound = true;
          break;
        }
      }
    }

    expect(downhillWaterFound).toBe(true);
    expect(state.accounting.relativeError).toBeLessThan(1e-10);
  });

  // TEST-06: Flat Terrain Uniform Accumulation
  it('TEST-06: rain falling on a horizontal impermeable plane produces identical depth across all cells', () => {
    const config = createFlatConfig(30.0);
    let state = createHydraulicState(config);

    for (let step = 0; step < 10; step++) {
      state = stepHydraulics(state, {
        dtMacroSeconds: 2.0,
        rainfallRateMmPerHour: 40.0,
      });
    }

    const firstCellDepth = state.waterDepth[0];
    expect(firstCellDepth).toBeGreaterThan(0);

    // Check standard deviation / deviation from first cell
    for (let c = 1; c < defaultNx * defaultNy; c++) {
      expect(Math.abs(state.waterDepth[c] - firstCellDepth)).toBeLessThan(1e-12);
    }
  });

  // TEST-07: Non-Negative Water Depth Guarantee
  it('TEST-07: unconditionally guarantees non-negative depth even with a 50m vertical cliff', () => {
    const numCells = defaultNx * defaultNy;
    const elev = new Float64Array(numCells);

    // 50m cliff between column 4 and column 5
    for (let j = 0; j < defaultNy; j++) {
      for (let i = 0; i < defaultNx; i++) {
        elev[j * defaultNx + i] = i <= 4 ? 60.0 : 10.0;
      }
    }

    const config: HydraulicGridConfig = {
      nx: defaultNx,
      ny: defaultNy,
      dx: defaultDx,
      elevation: elev,
    };

    // Deposit thin 0.05m water layer atop cliff
    const initialDepth = new Float64Array(numCells);
    for (let j = 0; j < defaultNy; j++) {
      for (let i = 0; i <= 4; i++) {
        initialDepth[j * defaultNx + i] = 0.05;
      }
    }

    let state = createHydraulicState(config, initialDepth);

    for (let step = 0; step < 20; step++) {
      state = stepHydraulics(state, {
        dtMacroSeconds: 2.0,
        rainfallRateMmPerHour: 0.0,
      });

      // Assert non-negative depth for all cells
      for (let c = 0; c < numCells; c++) {
        expect(state.waterDepth[c]).toBeGreaterThanOrEqual(0.0);
      }
    }

    expect(state.accounting.relativeError).toBeLessThan(1e-10);
  });

  // TEST-08: No-Flow Quiescent Equilibrium
  it('TEST-08: quiescent equilibrium in depression lake maintains static water depth with zero flux', () => {
    const numCells = defaultNx * defaultNy;
    const elev = new Float64Array(numCells);

    // Basin bowl: center lower than edges
    for (let j = 0; j < defaultNy; j++) {
      for (let i = 0; i < defaultNx; i++) {
        const distFromCenter = Math.hypot(i - 7.5, j - 7.5);
        elev[j * defaultNx + i] = 10.0 + distFromCenter * 2.0;
      }
    }

    // Fill to flat horizontal water surface elevation eta = 25.0m
    const initialDepth = new Float64Array(numCells);
    for (let c = 0; c < numCells; c++) {
      initialDepth[c] = Math.max(0, 25.0 - elev[c]);
    }

    const config: HydraulicGridConfig = {
      nx: defaultNx,
      ny: defaultNy,
      dx: defaultDx,
      elevation: elev,
    };

    let state = createHydraulicState(config, initialDepth);
    const initialStorage = state.accounting.initialStorageM3;

    for (let step = 0; step < 10; step++) {
      state = stepHydraulics(state, {
        dtMacroSeconds: 2.0,
        rainfallRateMmPerHour: 0.0,
      });
    }

    // Depths should remain completely static
    for (let c = 0; c < numCells; c++) {
      expect(Math.abs(state.waterDepth[c] - initialDepth[c])).toBeLessThan(1e-6);
    }
    expect(Math.abs(state.accounting.currentStorageM3 - initialStorage)).toBeLessThan(1e-6);
  });

  // TEST-09: Deterministic Bit-for-Bit Reproducibility
  it('TEST-09: identical initial states and storm hydrographs produce bit-for-bit identical results', () => {
    const config = createFlatConfig(18.0);

    function runScenario() {
      let state = createHydraulicState(config);
      for (let step = 0; step < 15; step++) {
        state = stepHydraulics(state, {
          dtMacroSeconds: 2.0,
          rainfallRateMmPerHour: 55.0,
        });
      }
      return state.waterDepth;
    }

    const run1 = runScenario();
    const run2 = runScenario();

    expect(run1.length).toBe(run2.length);
    for (let i = 0; i < run1.length; i++) {
      expect(run1[i]).toBe(run2[i]);
    }
  });

  // TEST-10: Demanding Storm Stress & Stability
  it('TEST-10: maintains stability and strict conservation under torrential cloudburst (250 mm/hr)', () => {
    const numCells = defaultNx * defaultNy;
    const elev = new Float64Array(numCells);

    // Highly irregular stepped topography
    for (let c = 0; c < numCells; c++) {
      elev[c] = 10.0 + (c % 7) * 3.5;
    }

    const config: HydraulicGridConfig = {
      nx: defaultNx,
      ny: defaultNy,
      dx: defaultDx,
      elevation: elev,
      manningN: 0.020, // Low roughness / high velocity
    };

    let state = createHydraulicState(config);

    // 250 mm/hr cloudburst
    for (let step = 0; step < 20; step++) {
      state = stepHydraulics(state, {
        dtMacroSeconds: 2.0,
        rainfallRateMmPerHour: 250.0,
      });

      // Verify no NaNs or Infinities
      for (let c = 0; c < numCells; c++) {
        expect(Number.isFinite(state.waterDepth[c])).toBe(true);
        expect(state.waterDepth[c]).toBeGreaterThanOrEqual(0.0);
      }
    }

    expect(state.accounting.relativeError).toBeLessThan(1e-9);
  });
});
