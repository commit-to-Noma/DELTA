/**
 * DELTA Disruption & In-Flight Replanning Engine (Phase 2)
 *
 * Simulates dynamic physical disruptions against the Boston Longwood & Muddy River
 * catchment model using the 2D diffusive-wave hydraulic solver:
 * 1. Mid-storm culvert debris blockage (e.g. 80% loss at CULVERT-01-BROOKLINE).
 * 2. Real-time solver recalculation comparing baseline vs. disrupted conditions.
 * 3. Physical road network & hospital corridor passability re-evaluation.
 * 4. Deterministic, physics-derived causal engineering explanations.
 */

import {
  BostonCatchmentDataset,
  createHydraulicConfigFromCatchment
} from '../data/catchmentLoader';
import {
  createHydraulicState,
  stepHydraulics,
  SimulationState,
  HydraulicGridConfig
} from './hydraulicSolver';

export interface DisruptionScenario {
  id: string;
  name: string;
  type: 'CULVERT_BLOCKAGE' | 'ROAD_CLOSURE' | 'PUMP_TRIP';
  targetInletId: string;
  targetName: string;
  gridCell: [number, number];
  blockageRatio: number; // 0.0 (open) to 1.0 (fully blocked)
  description: string;
  nominalCapacityM3PerSec: number;
  effectiveCapacityM3PerSec: number;
}

export interface HospitalAccessRouteDetail {
  roadName: string;
  maxDepthM: number;
  status: 'PASSABLE' | 'CAUTION' | 'IMPASSABLE';
}

export interface HospitalImpact {
  name: string;
  gridCell: [number, number];
  waterDepthM: number;
  status: 'ACCESSIBLE' | 'CAUTION_PERIMETER_PONDING' | 'ISOLATED_INUNDATION';
  campusGroundElevationM?: number;
  buildingStandingWaterDepthM?: number;
  perimeterMaxDepthM?: number;
  accessRoutesStatus?: HospitalAccessRouteDetail[];
  overallRoutePassability?: 'PASSABLE' | 'CAUTION' | 'IMPASSABLE';
  accessStatusDescription?: string;
}

export interface RoadPassabilityImpact {
  roadId: string;
  name: string;
  maxDepthM: number;
  status: 'DRY_PASSABLE' | 'CAUTION_MINOR_PONDING' | 'CRITICAL_IMPASSABLE';
  newlyImpassable: boolean;
  averageDepthM?: number;
  passableCellCount?: number;
  cautionCellCount?: number;
  impassableCellCount?: number;
  totalCellCount?: number;
}

export interface DisruptionRecalculationResult {
  disruption: DisruptionScenario;
  simulatedTimeSeconds: number;
  baseline: {
    cumulativeDrainageM3: number;
    currentStorageM3: number;
    maxWaterDepthM: number;
    chokePointDepthM: number;
    impassableRoadCount: number;
    atRiskHospitalCount: number;
    hospitals: HospitalImpact[];
  };
  disrupted: {
    cumulativeDrainageM3: number;
    currentStorageM3: number;
    maxWaterDepthM: number;
    chokePointDepthM: number;
    impassableRoadCount: number;
    atRiskHospitalCount: number;
    hospitals: HospitalImpact[];
  };
  delta: {
    retainedWaterVolumeDeltaM3: number; // +extra water trapped on surface
    chokePointWaterDepthDeltaM: number; // +depth rise at the culvert
    maxWaterDepthDeltaM: number;
    newlyImpassableRoads: RoadPassabilityImpact[];
    newlyAtRiskHospitals: string[];
  };
  causalExplanation: string;
  replanRecommendation: {
    tacticalShift: string;
    prioritizedIntervention: string;
    engineeringRationale: string;
  };
  disruptedDepthArray: Float64Array;
  baselineDepthArray: Float64Array;
}

/**
 * Authoritative catalogue of physical disruptions grounded in the Longwood catchment.
 */
export const AUTHORITATIVE_DISRUPTIONS: DisruptionScenario[] = [
  {
    id: 'disruption-brookline-culvert',
    name: 'Brookline Avenue Culvert (Muddy River) Debris Blockage',
    type: 'CULVERT_BLOCKAGE',
    targetInletId: 'CULVERT-01-BROOKLINE',
    targetName: 'Brookline Avenue Muddy River Culvert Inflow',
    gridCell: [17, 26],
    blockageRatio: 1.0, // 100% complete debris choke
    nominalCapacityM3PerSec: 12.5,
    effectiveCapacityM3PerSec: 0.0,
    description: 'Upstream urban debris and fallen limbs choke the Brookline Avenue conduit grating, cutting off 100% of gravitational culvert conveyance.'
  },
  {
    id: 'disruption-fenway-choke',
    name: 'Fenway Emerald Necklace Choke Point Constriction',
    type: 'CULVERT_BLOCKAGE',
    targetInletId: 'CULVERT-02-FENWAY-CHOKE',
    targetName: 'Fenway Emerald Necklace Choke Point',
    gridCell: [8, 42],
    blockageRatio: 0.75, // 75% constriction
    nominalCapacityM3PerSec: 8.0,
    effectiveCapacityM3PerSec: 2.0,
    description: 'Backwater constriction along the Fenway channel neck restricts discharge conveyance into the lower Charles basin to 2.0 m³/s.'
  },
  {
    id: 'disruption-sump-loss',
    name: 'Longwood Low Basin Sump Inflow Loss',
    type: 'PUMP_TRIP',
    targetInletId: 'DRAIN-03-LONGWOOD-WEST',
    targetName: 'Assumed Overland Sump Inflow (Longwood Low Basin)',
    gridCell: [41, 22],
    blockageRatio: 1.0, // 100% loss
    nominalCapacityM3PerSec: 4.5,
    effectiveCapacityM3PerSec: 0.0,
    description: 'Total loss of gravity catch basin conveyance in the southern Longwood depression, trapping 100% of local surface runoff.'
  }
];

/**
 * Evaluates passability of hospital access nodes based on depth grid.
 * Clearly separates structural building flooding from access road compromise.
 */
export function evaluateHospitalAccess(
  dataset: BostonCatchmentDataset,
  waterDepth: Float64Array
): HospitalImpact[] {
  const { nx, ny } = dataset.metadata.grid;

  return dataset.criticalFacilities.map((fac) => {
    const [r, c] = fac.gridCell;
    const depthM = waterDepth[r * nx + c] || 0;
    const campusElev = dataset.elevationMatrix[r]?.[c] ?? 0;

    // Check perimeter 8-neighborhood
    let perimeterMax = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < ny && nc >= 0 && nc < nx) {
          const pd = waterDepth[nr * nx + nc] || 0;
          if (pd > perimeterMax) perimeterMax = pd;
        }
      }
    }

    // Check named access arteries
    const accessRoutesStatus: HospitalAccessRouteDetail[] = fac.accessArteries.map((arteryName) => {
      let arteryMaxDepth = 0;
      for (const road of dataset.criticalRoads) {
        if (road.name.toLowerCase().includes(arteryName.toLowerCase()) || arteryName.toLowerCase().includes(road.name.toLowerCase())) {
          for (const [rr, cc] of road.gridCells) {
            const rd = waterDepth[rr * nx + cc] || 0;
            if (rd > arteryMaxDepth) arteryMaxDepth = rd;
          }
        }
      }
      let routeStatus: HospitalAccessRouteDetail['status'] = 'PASSABLE';
      if (arteryMaxDepth >= 0.30) {
        routeStatus = 'IMPASSABLE';
      } else if (arteryMaxDepth >= 0.15) {
        routeStatus = 'CAUTION';
      }
      return {
        roadName: arteryName,
        maxDepthM: Math.round(arteryMaxDepth * 1000) / 1000,
        status: routeStatus,
      };
    });

    const hasImpassableRoute = accessRoutesStatus.some((r) => r.status === 'IMPASSABLE');
    const hasCautionRoute = accessRoutesStatus.some((r) => r.status === 'CAUTION');

    let overallRoutePassability: HospitalImpact['overallRoutePassability'] = 'PASSABLE';
    if (hasImpassableRoute) {
      overallRoutePassability = 'IMPASSABLE';
    } else if (hasCautionRoute) {
      overallRoutePassability = 'CAUTION';
    }

    // Determine status (preserving existing test expectations where depthM >= 0.30 triggers ISOLATED_INUNDATION)
    let status: HospitalImpact['status'] = 'ACCESSIBLE';
    if (depthM >= 0.30 || hasImpassableRoute) {
      status = 'ISOLATED_INUNDATION';
    } else if (depthM >= 0.10 || hasCautionRoute || perimeterMax >= 0.15) {
      status = 'CAUTION_PERIMETER_PONDING';
    }

    // Descriptive engineering note
    let accessStatusDescription = 'Campus ground structurally dry (elev ' + campusElev.toFixed(1) + 'm). All screened ingress corridors below 15cm depth threshold (operational vehicular access unverified).';
    if (depthM >= 0.30) {
      accessStatusDescription = `Severe direct flooding at facility coordinate (${(depthM * 100).toFixed(1)} cm). High screening risk.`;
    } else if (hasImpassableRoute) {
      const blockedRoads = accessRoutesStatus.filter((r) => r.status === 'IMPASSABLE').map((r) => r.roadName).join(', ');
      accessStatusDescription = `Campus ground structurally dry (${(depthM * 100).toFixed(1)} cm water, elev ${campusElev.toFixed(1)}m). Screened access corridor exceeds 30cm depth threshold: ${blockedRoads}. Rerouting indicated (real-world transit unverified).`;
    } else if (hasCautionRoute) {
      accessStatusDescription = `Campus ground structurally dry; minor ponding on screened ingress corridors (15-30 cm). Operational screening caution.`;
    }

    return {
      name: fac.name,
      gridCell: fac.gridCell,
      waterDepthM: Math.round(depthM * 1000) / 1000,
      status,
      campusGroundElevationM: Math.round(campusElev * 100) / 100,
      buildingStandingWaterDepthM: Math.round(depthM * 1000) / 1000,
      perimeterMaxDepthM: Math.round(perimeterMax * 1000) / 1000,
      accessRoutesStatus,
      overallRoutePassability,
      accessStatusDescription,
    };
  });
}

/**
 * Evaluates road passability across critical emergency corridors with cell-by-cell breakdown.
 */
export function evaluateRoadPassability(
  dataset: BostonCatchmentDataset,
  waterDepth: Float64Array,
  baselineImpassableSet?: Set<string>
): RoadPassabilityImpact[] {
  const { nx } = dataset.metadata.grid;
  const impacts: RoadPassabilityImpact[] = [];

  for (const road of dataset.criticalRoads) {
    let maxDepth = 0;
    let sumDepth = 0;
    let passableCount = 0;
    let cautionCount = 0;
    let impassableCount = 0;

    for (const [r, c] of road.gridCells) {
      const d = waterDepth[r * nx + c] || 0;
      if (d > maxDepth) maxDepth = d;
      sumDepth += d;

      if (d >= 0.30) impassableCount++;
      else if (d >= 0.15) cautionCount++;
      else passableCount++;
    }

    const totalCells = road.gridCells.length;
    const avgDepth = totalCells > 0 ? sumDepth / totalCells : 0;

    let status: RoadPassabilityImpact['status'] = 'DRY_PASSABLE';
    if (maxDepth >= 0.30) {
      status = 'CRITICAL_IMPASSABLE';
    } else if (maxDepth >= 0.10) {
      status = 'CAUTION_MINOR_PONDING';
    }

    const isNewlyImpassable = status === 'CRITICAL_IMPASSABLE' && (!baselineImpassableSet || !baselineImpassableSet.has(road.roadId));

    impacts.push({
      roadId: road.roadId,
      name: road.name,
      maxDepthM: Math.round(maxDepth * 1000) / 1000,
      status,
      newlyImpassable: isNewlyImpassable,
      averageDepthM: Math.round(avgDepth * 1000) / 1000,
      passableCellCount: passableCount,
      cautionCellCount: cautionCount,
      impassableCellCount: impassableCount,
      totalCellCount: totalCells,
    });
  }

  return impacts;
}

/**
 * Runs the 2D hydraulic solver to compare a nominal baseline storm vs. a disrupted scenario.
 * Executes genuine hydrodynamic recalculation with adaptive sub-stepping.
 */
export function executeDisruptionRecalculation(
  dataset: BostonCatchmentDataset,
  disruptionId: string = 'disruption-brookline-culvert',
  simulatedSeconds: number = 3600, // 1 hour storm progression
  rainfallRateMmPerHour: number = 35.0 // peak intensity
): DisruptionRecalculationResult {
  const disruption = AUTHORITATIVE_DISRUPTIONS.find((d) => d.id === disruptionId) || AUTHORITATIVE_DISRUPTIONS[0];

  // 1. Build Baseline Configuration (Nominal drainage, 0% blockage)
  const baselineConfig: HydraulicGridConfig = createHydraulicConfigFromCatchment(dataset, {
    manningN: 0.025,
    defaultInfiltrationMmPerHour: 2.0,
    openBoundaries: 'muddy_river_outlet'
  });

  // 2. Build Disrupted Configuration (Injected blockage ratio)
  const disruptedConfig: HydraulicGridConfig = createHydraulicConfigFromCatchment(dataset, {
    manningN: 0.025,
    defaultInfiltrationMmPerHour: 2.0,
    openBoundaries: 'muddy_river_outlet'
  });

  // Apply disruption to the matching drainage inlet
  if (disruptedConfig.drainageInlets) {
    disruptedConfig.drainageInlets = disruptedConfig.drainageInlets.map((inlet) => {
      const [r, c] = disruption.gridCell;
      const targetIndex = r * dataset.metadata.grid.nx + c;
      if (inlet.index === targetIndex) {
        return {
          ...inlet,
          blockageRatio: disruption.blockageRatio
        };
      }
      return inlet;
    });
  }

  // 3. Step Baseline State
  let baselineState: SimulationState = createHydraulicState(baselineConfig);
  // Step in 20-second macro steps to advance physical wave propagation efficiently
  const dtMacro = 20.0;
  const numSteps = Math.max(1, Math.floor(simulatedSeconds / dtMacro));

  for (let s = 0; s < numSteps; s++) {
    baselineState = stepHydraulics(baselineState, {
      dtMacroSeconds: dtMacro,
      rainfallRateMmPerHour
    });
  }

  // 4. Step Disrupted State under identical rain conditions
  let disruptedState: SimulationState = createHydraulicState(disruptedConfig);
  for (let s = 0; s < numSteps; s++) {
    disruptedState = stepHydraulics(disruptedState, {
      dtMacroSeconds: dtMacro,
      rainfallRateMmPerHour
    });
  }

  const { nx } = dataset.metadata.grid;
  const [chokeR, chokeC] = disruption.gridCell;
  const chokeIdx = chokeR * nx + chokeC;

  const baselineChokeDepth = baselineState.waterDepth[chokeIdx] || 0;
  const disruptedChokeDepth = disruptedState.waterDepth[chokeIdx] || 0;

  // Max depths across grid
  let baselineMaxDepth = 0;
  let disruptedMaxDepth = 0;
  for (let i = 0; i < baselineState.waterDepth.length; i++) {
    if (baselineState.waterDepth[i] > baselineMaxDepth) baselineMaxDepth = baselineState.waterDepth[i];
    if (disruptedState.waterDepth[i] > disruptedMaxDepth) disruptedMaxDepth = disruptedState.waterDepth[i];
  }

  // Evaluate impacts
  const baselineHospitals = evaluateHospitalAccess(dataset, baselineState.waterDepth);
  const disruptedHospitals = evaluateHospitalAccess(dataset, disruptedState.waterDepth);

  const baselineRoadImpacts = evaluateRoadPassability(dataset, baselineState.waterDepth);
  const baselineImpassableIds = new Set(
    baselineRoadImpacts.filter((r) => r.status === 'CRITICAL_IMPASSABLE').map((r) => r.roadId)
  );

  const disruptedRoadImpacts = evaluateRoadPassability(dataset, disruptedState.waterDepth, baselineImpassableIds);
  const newlyImpassableRoads = disruptedRoadImpacts.filter((r) => r.newlyImpassable);

  const newlyAtRiskHospitals = disruptedHospitals
    .filter((h, idx) => h.status !== 'ACCESSIBLE' && baselineHospitals[idx].status === 'ACCESSIBLE')
    .map((h) => h.name);

  // Compute physical deltas
  const retainedDeltaM3 = Math.round(
    disruptedState.accounting.currentStorageM3 - baselineState.accounting.currentStorageM3
  );
  const chokeDepthDeltaM = Math.round((disruptedChokeDepth - baselineChokeDepth) * 1000) / 1000;
  const maxDepthDeltaM = Math.round((disruptedMaxDepth - baselineMaxDepth) * 1000) / 1000;

  // Generate deterministic, physics-based causal explanation (Zero hardcoded numbers)
  const lostConveyanceM3S = (disruption.nominalCapacityM3PerSec - disruption.effectiveCapacityM3PerSec).toFixed(1);
  const retainedDeltaFormatted = retainedDeltaM3.toLocaleString();
  const chokeDeltaCm = (chokeDepthDeltaM * 100).toFixed(1);

  const causalExplanation = 
    `A ${Math.round(disruption.blockageRatio * 100)}% capacity reduction occurred at ${disruption.targetName} ` +
    `([${disruption.gridCell[0]}, ${disruption.gridCell[1]}]), cutting conveyance by ${lostConveyanceM3S} m³/s ` +
    `(from ${disruption.nominalCapacityM3PerSec.toFixed(1)} to ${disruption.effectiveCapacityM3PerSec.toFixed(1)} m³/s). ` +
    `Over ${simulatedSeconds}s of rainfall, this obstruction trapped ${retainedDeltaFormatted} m³ of excess stormwater ` +
    `on the surface, driving a ${chokeDeltaCm} cm backwater depth rise at the culvert headwall. ` +
    (newlyImpassableRoads.length > 0 
      ? `The resulting overland flood wave severed ${newlyImpassableRoads.length} critical road corridor(s) (including ${newlyImpassableRoads[0].name}), ` +
        `compromising access to ${newlyAtRiskHospitals.length > 0 ? newlyAtRiskHospitals.join(', ') : "key medical facilities"}.`
      : `Water pooled across local low points without severing major arteries.`);

  const replanRecommendation = {
    tacticalShift: 'PIVOT_TO_CULVERT_CLEARANCE_AND_ACTIVE_PUMPING',
    prioritizedIntervention: 'Plan Beta (Clear Brookline Culvert & Deploy Mobile High-Capacity Pump #1)',
    engineeringRationale: 
      `Passive perimeter sandbagging (Plan Alpha) cannot mitigate the ${retainedDeltaFormatted} m³ surface backwater surge ` +
      `caused by culvert obstruction. Direct clearance of ${disruption.targetInletId} and high-capacity suction deployment ` +
      `is physically required to restore gravity conveyance and lower flood stages below the 0.30m impassability threshold.`
  };

  return {
    disruption,
    simulatedTimeSeconds: simulatedSeconds,
    baseline: {
      cumulativeDrainageM3: Math.round(baselineState.accounting.cumulativeDrainageM3),
      currentStorageM3: Math.round(baselineState.accounting.currentStorageM3),
      maxWaterDepthM: Math.round(baselineMaxDepth * 1000) / 1000,
      chokePointDepthM: Math.round(baselineChokeDepth * 1000) / 1000,
      impassableRoadCount: baselineRoadImpacts.filter((r) => r.status === 'CRITICAL_IMPASSABLE').length,
      atRiskHospitalCount: baselineHospitals.filter((h) => h.status !== 'ACCESSIBLE').length,
      hospitals: baselineHospitals
    },
    disrupted: {
      cumulativeDrainageM3: Math.round(disruptedState.accounting.cumulativeDrainageM3),
      currentStorageM3: Math.round(disruptedState.accounting.currentStorageM3),
      maxWaterDepthM: Math.round(disruptedMaxDepth * 1000) / 1000,
      chokePointDepthM: Math.round(disruptedChokeDepth * 1000) / 1000,
      impassableRoadCount: disruptedRoadImpacts.filter((r) => r.status === 'CRITICAL_IMPASSABLE').length,
      atRiskHospitalCount: disruptedHospitals.filter((h) => h.status !== 'ACCESSIBLE').length,
      hospitals: disruptedHospitals
    },
    delta: {
      retainedWaterVolumeDeltaM3: retainedDeltaM3,
      chokePointWaterDepthDeltaM: chokeDepthDeltaM,
      maxWaterDepthDeltaM: maxDepthDeltaM,
      newlyImpassableRoads,
      newlyAtRiskHospitals
    },
    causalExplanation,
    replanRecommendation,
    disruptedDepthArray: disruptedState.waterDepth,
    baselineDepthArray: baselineState.waterDepth
  };
}
