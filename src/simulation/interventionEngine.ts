/**
 * DELTA Phase 3: Multi-Scenario Intervention Planner
 *
 * Implements deterministic, solver-backed comparison of three physical interventions
 * against an identical baseline storm and catchment state:
 * - Plan Alpha: Deployable Barriers / Sandbags (+0.50m crest elevation on Francis St perimeter)
 * - Plan Beta: Mobile High-Capacity Pump #1 (2.0 m³/s active suction sink in low-lying retention basin)
 * - Plan Gamma: Emergency Culvert Jetting (restores CULVERT-01-BROOKLINE to 12.5 m³/s nominal capacity)
 *
 * Guarantees Baseline Invariance: Every plan executes against an independent clone
 * of the identical baseline state and storm configuration.
 *
 * Computes honest comparative metrics: avoided surface flood volume, peak depth reduction,
 * protected roads, and hospital accessibility transitions. Zero fabricated transit delays.
 */

import {
  BostonCatchmentDataset,
  createHydraulicConfigFromCatchment
} from '../data/catchmentLoader';
import {
  createHydraulicState,
  stepHydraulics,
  HydraulicGridConfig,
  DrainageInlet
} from './hydraulicSolver';
import {
  AUTHORITATIVE_DISRUPTIONS,
  evaluateHospitalAccess,
  evaluateRoadPassability,
  HospitalImpact,
  RoadPassabilityImpact
} from './disruptionEngine';

export interface AssetThresholdCrossing {
  assetId: string;
  assetName: string;
  assetType: 'ROAD' | 'HOSPITAL_ACCESS';
  firstCrossing15cmSeconds: number | null;
  firstCrossing30cmSeconds: number | null;
  peakDepthM: number;
}

export type ThresholdComparisonOutcome =
  | 'NEVER_CROSSED'
  | 'AVOIDED'
  | 'DELAYED'
  | 'UNCHANGED'
  | 'ACCELERATED'
  | 'NEWLY_CROSSED';

export interface AssetThresholdComparison {
  assetId: string;
  assetName: string;
  assetType: 'ROAD' | 'HOSPITAL_ACCESS';
  thresholdM: 0.15 | 0.30;
  baselineCrossingSeconds: number | null;
  planCrossingSeconds: number | null;
  deltaSeconds: number | null; // plan - baseline when both cross (+ = delayed, - = accelerated)
  outcome: ThresholdComparisonOutcome;
}

export interface TemporalThresholdSummary {
  dtMacroSeconds: number;
  simulatedDurationSeconds: number;
  road30cmComparisons: AssetThresholdComparison[];
  road15cmComparisons: AssetThresholdComparison[];
  hospitalAccess30cmComparisons: AssetThresholdComparison[];
  avoided30cmRoadCount: number;
  delayed30cmRoadCount: number;
  acceleratedOrNewlyCrossed30cmRoadCount: number;
  disclosure: string;
}

export interface InterventionDefinition {
  id: 'plan-alpha' | 'plan-beta' | 'plan-gamma';
  name: string;
  type: 'BARRIER_DEFLECTION' | 'MOBILE_PUMP' | 'CULVERT_JETTING';
  resourceCost: string;
  targetInfrastructure: string;
  description: string;
  physicalParameters: {
    barrierCells?: [number, number][];
    elevationDeltaM?: number;
    pumpCell?: [number, number];
    pumpCapacityM3PerSec?: number;
    restoredInletId?: string;
    restoredCapacityM3PerSec?: number;
  };
}

export interface ScenarioRunMetrics {
  scenarioId: string;
  name: string;
  totalWaterVolumeM3: number;
  cumulativeDrainageM3: number;
  cumulativeInfiltrationM3: number;
  cumulativeBoundaryOutflowM3: number;
  massBalanceErrorM3: number;
  currentStorageM3: number;
  maxWaterDepthM: number;
  impassableRoadCount: number;
  atRiskHospitalCount: number;
  hospitals: HospitalImpact[];
  roads: RoadPassabilityImpact[];
  waterDepth: Float64Array;
  relativeConservationError: number;
  drainageByInletId: Record<string, number>;
  dtMacroSeconds: number;
  roadThresholdCrossings: AssetThresholdCrossing[];
  hospitalAccessCrossings: AssetThresholdCrossing[];
}

export interface HospitalImprovement {
  hospitalName: string;
  baselineStatus: HospitalImpact['status'];
  planStatus: HospitalImpact['status'];
  transition: 'ISOLATED_TO_CAUTION' | 'ISOLATED_TO_ACCESSIBLE' | 'CAUTION_TO_ACCESSIBLE' | 'UNCHANGED';
}

export type EffectivenessClassification =
  | 'ADVERSE_LOCAL_DEFLECTION'
  | 'CAPACITY_CONSTRAINED'
  | 'MEASURABLE_BENEFIT'
  | 'NEGLIGIBLE_IMPACT'
  | 'INCONCLUSIVE_NO_EFFECTIVE_PLAN';

export interface SpatialDeflectionMetrics {
  adverseCellCount: number; // Cells where deltaWaterDepthM < -0.01m (plan has >1cm more water than baseline)
  adverseAreaM2: number;    // adverseCellCount * 625 m²
  maxAdverseDepthIncreaseM: number; // Max local water rise caused by plan (m)
  deflectedVolumeM3: number; // Integrated volume of deflected water on adverse cells (m³)
}

export interface InletDrainageAccounting {
  totalCatchmentDrainageM3: number;
  backgroundInletDrainageM3: number; // Fenway choke + Longwood sump
  interventionSinkExtractionM3: number; // Mobile pump at [17,25] or culvert point sink at [17,26]
  incrementalDrainageM3: number; // plan total drainage minus baseline total drainage
  avoidedSurfaceStorageM3: number; // baseline currentStorage minus plan currentStorage
}

export interface RoadTransitionSummary {
  improvedRoadNames: string[]; // Transitioned from IMPASSABLE (>=30cm) to PASSABLE/CAUTION (<30cm)
  worsenedRoadNames: string[]; // Transitioned from PASSABLE/CAUTION to IMPASSABLE (>=30cm)
  netProtectedRoadCount: number; // improved - worsened
}

export interface PlanDifferential {
  planId: string;
  name: string;
  avoidedSurfaceVolumeM3: number; // V_baseline - V_plan (+ indicates surface volume reduced)
  peakDepthReductionM: number;   // d_max,baseline - d_max,plan (+ indicates peak lowered)
  protectedRoadCount: number;     // Roads transitioning from IMPASSABLE to PASSABLE
  protectedRoadNames: string[];
  roadTransitions: RoadTransitionSummary;
  hospitalImprovements: HospitalImprovement[];
  improvedHospitalCount: number;
  spatialDeflection: SpatialDeflectionMetrics;
  inletDrainageAccounting: InletDrainageAccounting;
  temporalThresholds: TemporalThresholdSummary;
  classification: EffectivenessClassification;
  classificationRationale: string;
}

export interface StressProfile {
  id: string;
  name: string;
  type: 'REGIONAL_NOAA_BENCHMARK' | 'SYNTHETIC_STRESS_INPUT';
  durationHours: number;
  durationSeconds: number;
  totalRainfallMm: number;
  rainfallIntensityMmPerHour?: number;
  hyetographHours?: { hourIndex: number; startHour: number; endHour: number; depthMm: number; rateMmPerHour: number }[];
  initialConditionsDescription: string;
  provenance: string;
  disclosures: string[];
}

export interface EvidenceBasedComparison {
  keyFindings: string[];
  tradeOffs: string[];
  capacityLimitations: string[];
  overallAssessment: string;
  recommendedPlanId: string | null;
  recommendationRationale: string;
}

export interface MultiScenarioEvaluationResult {
  baseline: ScenarioRunMetrics;
  planAlpha: ScenarioRunMetrics;
  planBeta: ScenarioRunMetrics;
  planGamma: ScenarioRunMetrics;
  differentials: {
    'plan-alpha': PlanDifferential;
    'plan-beta': PlanDifferential;
    'plan-gamma': PlanDifferential;
    planAlpha: PlanDifferential;
    planBeta: PlanDifferential;
    planGamma: PlanDifferential;
  };
  ranking: {
    mostVolumeAvoided: string;
    mostRoadsProtected: string;
    recommendedPlanId: string;
    recommendationRationale: string;
  };
  comparison: EvidenceBasedComparison;
  simulationMetadata: {
    profileId: string;
    profileLabel: string;
    profileType: 'REGIONAL_NOAA_BENCHMARK' | 'SYNTHETIC_STRESS_INPUT';
    stormId: string;
    stormLabel: string;
    simulatedDurationSeconds: number;
    dtMacroSeconds: number;
    rainfallIntensityMmPerHour: number;
    totalRainfallMm: number;
    disruptionId: string;
    activeDisruptionIds: string[];
    activeDisruptionLabels: string[];
    timestamp: string;
    provenance: string;
    disclosures: string[];
  };
}

/**
 * Authoritative physical parameter definitions for the 3 candidate interventions.
 */
export const AUTHORITATIVE_INTERVENTIONS: Record<'plan-alpha' | 'plan-beta' | 'plan-gamma', InterventionDefinition> = {
  'plan-alpha': {
    id: 'plan-alpha',
    name: 'Plan Alpha: Rapid Deployable Barrier along Francis St Ambulance Route',
    type: 'BARRIER_DEFLECTION',
    resourceCost: '3 Tactical Crews • 1,200 Rapid Sandbags',
    targetInfrastructure: 'Francis St Ambulance Bay Corridor (OSM Way 1377084984)',
    description: 'Erects a temporary +0.50m crest deflection barrier along curb cuts fronting the Brigham & Women\'s ambulance ingress to divert overland sheet flow.',
    physicalParameters: {
      barrierCells: [
        [41, 26],
        [42, 26],
        [43, 27],
        [43, 28]
      ],
      elevationDeltaM: 0.50
    }
  },
  'plan-beta': {
    id: 'plan-beta',
    name: 'Plan Beta: Deploy High-Capacity Mobile Pump #1 at Retention Basin',
    type: 'MOBILE_PUMP',
    resourceCost: '1 Crew • 1 Godwin HL250M High-Capacity Mobile Pump',
    targetInfrastructure: 'Muddy River / Brookline Ave Retention Channel ([17, 25])',
    description: 'Deploys a mobile diesel suction pump at the low-lying retention channel feeding the hospital corridor, actively siphoning 2.0 m³/s.',
    physicalParameters: {
      pumpCell: [17, 25],
      pumpCapacityM3PerSec: 2.0
    }
  },
  'plan-gamma': {
    id: 'plan-gamma',
    name: 'Plan Gamma: Emergency High-Pressure Culvert Jetting (Clear Choke Point)',
    type: 'CULVERT_JETTING',
    resourceCost: '2 Municipal Vactor Jetting Trucks • 1 Dive Team',
    targetInfrastructure: 'Brookline Ave Muddy River Culvert Inflow (CULVERT-01-BROOKLINE)',
    description: 'Applies high-pressure hydro-jetting to clear debris lodged in the Brookline culvert grating, restoring gravitational capacity to 12.5 m³/s.',
    physicalParameters: {
      restoredInletId: 'CULVERT-01-BROOKLINE',
      restoredCapacityM3PerSec: 12.5
    }
  }
};

/**
 * Authoritative Library of Rainfall Stress Profiles.
 * Includes 1 Regional NOAA Atlas 14 Benchmark (Reference Case) and 3 Synthetic Exploratory Stress Profiles.
 */
export const AUTHORITATIVE_STRESS_PROFILES: Record<string, StressProfile> = {
  'reference-noaa-50yr': {
    id: 'reference-noaa-50yr',
    name: 'NOAA Atlas 14 50-Year 6-Hour Regional Benchmark (Station 19-0770, 104.2 mm)',
    type: 'REGIONAL_NOAA_BENCHMARK',
    durationHours: 6.0,
    durationSeconds: 21600,
    totalRainfallMm: 104.2,
    hyetographHours: [
      { hourIndex: 0, startHour: 0, endHour: 1, depthMm: 9.8944, rateMmPerHour: 9.8944 },
      { hourIndex: 1, startHour: 1, endHour: 2, depthMm: 19.7887, rateMmPerHour: 19.7887 },
      { hourIndex: 2, startHour: 2, endHour: 3, depthMm: 34.9392, rateMmPerHour: 34.9392 },
      { hourIndex: 3, startHour: 3, endHour: 4, depthMm: 23.4991, rateMmPerHour: 23.4991 },
      { hourIndex: 4, startHour: 4, endHour: 5, depthMm: 11.1312, rateMmPerHour: 11.1312 },
      { hourIndex: 5, startHour: 5, endHour: 6, depthMm: 4.9474, rateMmPerHour: 4.9474 }
    ],
    initialConditionsDescription: 'Dry bare-earth terrain (initial water depth h = 0.0 m across all 4096 cells)',
    provenance: 'NOAA Atlas 14 Volume 10 Version 3 point precipitation frequency estimate for Boston Logan Airport (Station 19-0770, 42.3606°N, -71.0106°W), approximately 3 km northeast of the Longwood catchment.',
    disclosures: [
      'Regional meteorological benchmark: derived from Boston Logan Station 19-0770 data (~3 km NE of Longwood). Provided as a regional comparison benchmark, not a localized catchment-specific rainfall frequency curve.',
      'Discrete 6-hour temporal distribution normalized so that hourly depths sum exactly to 104.2 mm (peak intensity 34.9 mm/h in Hour 3).'
    ]
  },
  'synthetic-low-intensity': {
    id: 'synthetic-low-intensity',
    name: 'Synthetic Low-Intensity Stress (15 mm/h, 1 Hour, 15.0 mm Total)',
    type: 'SYNTHETIC_STRESS_INPUT',
    durationHours: 1.0,
    durationSeconds: 3600,
    totalRainfallMm: 15.0,
    rainfallIntensityMmPerHour: 15.0,
    initialConditionsDescription: 'Dry bare-earth terrain (initial water depth h = 0.0 m across all 4096 cells)',
    provenance: 'Synthetic exploratory stress profile representing steady light-to-moderate precipitation.',
    disclosures: [
      'Synthetic stress scenario: constant 15.0 mm/h rate over 1.0 hour. Not derived from frequency statistics or return-period data.',
      'Used to test the lower sensitivity threshold where surface ponding may be insufficient for interventions to provide measurable benefit.'
    ]
  },
  'synthetic-moderate-stress': {
    id: 'synthetic-moderate-stress',
    name: 'Synthetic Moderate Stress (35 mm/h, 1 Hour, 35.0 mm Total)',
    type: 'SYNTHETIC_STRESS_INPUT',
    durationHours: 1.0,
    durationSeconds: 3600,
    totalRainfallMm: 35.0,
    rainfallIntensityMmPerHour: 35.0,
    initialConditionsDescription: 'Dry bare-earth terrain (initial water depth h = 0.0 m across all 4096 cells)',
    provenance: 'Synthetic exploratory stress profile testing arterial ponding and localized road passability thresholds.',
    disclosures: [
      'Synthetic stress scenario: constant 35.0 mm/h rate over 1.0 hour. Not an officially calibrated municipal design burst.',
      'Used to evaluate performance under intermediate overland sheet flow and compare mobile pump removal against culvert point-sink drainage.'
    ]
  },
  'synthetic-high-intensity': {
    id: 'synthetic-high-intensity',
    name: 'Synthetic High-Intensity Stress (75 mm/h, 30 Min, 37.5 mm Total)',
    type: 'SYNTHETIC_STRESS_INPUT',
    durationHours: 0.5,
    durationSeconds: 1800,
    totalRainfallMm: 37.5,
    rainfallIntensityMmPerHour: 75.0,
    initialConditionsDescription: 'Dry bare-earth terrain (initial water depth h = 0.0 m across all 4096 cells)',
    provenance: 'Synthetic exploratory overload stress profile testing hydraulic capacity constraints and barrier surcharge.',
    disclosures: [
      'Synthetic stress scenario: constant 75.0 mm/h rate over 30 minutes. Not an official cloudburst event.',
      'Used to test operational boundaries where mobile pumps (2.0 m³/s) become capacity-constrained against high overland inflow.'
    ]
  }
};

const PLAIN_STORM_BY_ID: Record<string, { label: string; hint: string }> = {
  'synthetic-low-intensity': { label: 'Light · 15 mm/h', hint: 'Light rain — minor ponding, most roads stay passable.' },
  'synthetic-moderate-stress': { label: 'Moderate · 35 mm/h', hint: 'Moderate rain — low spots and hospital access roads can pond.' },
  'synthetic-high-intensity': { label: 'Severe · 75 mm/h', hint: 'Severe burst — rapid ponding, some corridors may become impassable.' },
  'reference-noaa-50yr': { label: '50-Year Storm · 104 mm', hint: '50-year benchmark (NOAA) — worst-case planning storm, deep widespread flooding.' }
};

export function plainStormLabel(profile: Pick<StressProfile, 'id' | 'totalRainfallMm' | 'rainfallIntensityMmPerHour'>): string {
  const known = PLAIN_STORM_BY_ID[profile.id];
  if (known) return known.label;
  const rate = profile.rainfallIntensityMmPerHour ?? profile.totalRainfallMm;
  return `${rate.toFixed(0)} mm/h · ${profile.totalRainfallMm.toFixed(0)} mm total`;
}

export function plainStormHint(profile: Pick<StressProfile, 'id'>): string {
  return PLAIN_STORM_BY_ID[profile.id]?.hint ?? 'Planning scenario — watch low-lying hospital access roads first.';
}

/**
 * Computes instantaneous rainfall intensity (mm/h) at a specific elapsed simulation time.
 */
export function getRainfallRateAtElapsed(profile: StressProfile, elapsedSeconds: number): number {
  if (elapsedSeconds >= profile.durationSeconds) return 0.0;
  if (profile.hyetographHours && profile.hyetographHours.length > 0) {
    const hourIdx = Math.min(
      profile.hyetographHours.length - 1,
      Math.floor(elapsedSeconds / 3600)
    );
    return profile.hyetographHours[hourIdx].rateMmPerHour;
  }
  return profile.rainfallIntensityMmPerHour ?? (profile.totalRainfallMm / profile.durationHours);
}

/**
 * Executes a single simulation run given a configuration and stress profile.
 * Records discrete time-to-threshold crossings at exact macro-step intervals (dtMacro)
 * without sub-step interpolation.
 */
function* runSingleScenarioSteps(
  dataset: BostonCatchmentDataset,
  config: HydraulicGridConfig,
  scenarioId: string,
  scenarioName: string,
  profile: StressProfile,
  dtMacro: number = 20.0
): Generator<void, ScenarioRunMetrics, void> {
  const { nx } = dataset.metadata.grid;
  let state = createHydraulicState(config);
  const numSteps = Math.max(1, Math.floor(profile.durationSeconds / dtMacro));

  // Pre-index road and hospital-access cells for fast discrete threshold observation
  const roadCellIndices = dataset.criticalRoads.map((road) =>
    road.gridCells.map(([r, c]) => r * nx + c)
  );
  const roadFirst15: (number | null)[] = new Array(dataset.criticalRoads.length).fill(null);
  const roadFirst30: (number | null)[] = new Array(dataset.criticalRoads.length).fill(null);
  const roadPeakDepth: number[] = new Array(dataset.criticalRoads.length).fill(0);

  const hospitalAccessIndices = dataset.criticalFacilities.map((fac) => {
    const idxSet = new Set<number>();
    for (const arteryName of fac.accessArteries) {
      for (const road of dataset.criticalRoads) {
        if (
          road.name.toLowerCase().includes(arteryName.toLowerCase()) ||
          arteryName.toLowerCase().includes(road.name.toLowerCase())
        ) {
          for (const [rr, cc] of road.gridCells) {
            idxSet.add(rr * nx + cc);
          }
        }
      }
    }
    return Array.from(idxSet);
  });
  const hospFirst15: (number | null)[] = new Array(dataset.criticalFacilities.length).fill(null);
  const hospFirst30: (number | null)[] = new Array(dataset.criticalFacilities.length).fill(null);
  const hospPeakDepth: number[] = new Array(dataset.criticalFacilities.length).fill(0);

  for (let s = 0; s < numSteps; s++) {
    const elapsed = s * dtMacro;
    const currentRate = getRainfallRateAtElapsed(profile, elapsed);
    state = stepHydraulics(state, {
      dtMacroSeconds: dtMacro,
      rainfallRateMmPerHour: currentRate
    });

    const elapsedAfterStep = (s + 1) * dtMacro;
    const hArr = state.waterDepth;

    // Sample discrete road screening threshold crossings
    for (let rIdx = 0; rIdx < roadCellIndices.length; rIdx++) {
      const cells = roadCellIndices[rIdx];
      let maxD = 0;
      for (let k = 0; k < cells.length; k++) {
        const d = hArr[cells[k]] || 0;
        if (d > maxD) maxD = d;
      }
      if (maxD > roadPeakDepth[rIdx]) roadPeakDepth[rIdx] = maxD;
      if (roadFirst15[rIdx] === null && maxD >= 0.15) roadFirst15[rIdx] = elapsedAfterStep;
      if (roadFirst30[rIdx] === null && maxD >= 0.30) roadFirst30[rIdx] = elapsedAfterStep;
    }

    // Sample discrete hospital access corridor threshold crossings
    for (let hIdx = 0; hIdx < hospitalAccessIndices.length; hIdx++) {
      const cells = hospitalAccessIndices[hIdx];
      let maxD = 0;
      for (let k = 0; k < cells.length; k++) {
        const d = hArr[cells[k]] || 0;
        if (d > maxD) maxD = d;
      }
      if (maxD > hospPeakDepth[hIdx]) hospPeakDepth[hIdx] = maxD;
      if (hospFirst15[hIdx] === null && maxD >= 0.15) hospFirst15[hIdx] = elapsedAfterStep;
      if (hospFirst30[hIdx] === null && maxD >= 0.30) hospFirst30[hIdx] = elapsedAfterStep;
    }
    if (s % 20 === 19) yield;
  }

  // Max depth across domain
  let maxWaterDepthM = 0;
  for (let i = 0; i < state.waterDepth.length; i++) {
    if (state.waterDepth[i] > maxWaterDepthM) {
      maxWaterDepthM = state.waterDepth[i];
    }
  }

  const hospitals = evaluateHospitalAccess(dataset, state.waterDepth);
  const roads = evaluateRoadPassability(dataset, state.waterDepth);

  const impassableRoadCount = roads.filter((r) => r.status === 'CRITICAL_IMPASSABLE').length;
  const atRiskHospitalCount = hospitals.filter((h) => h.status !== 'ACCESSIBLE').length;

  const roadThresholdCrossings: AssetThresholdCrossing[] = dataset.criticalRoads.map((road, idx) => ({
    assetId: road.roadId,
    assetName: road.name,
    assetType: 'ROAD',
    firstCrossing15cmSeconds: roadFirst15[idx],
    firstCrossing30cmSeconds: roadFirst30[idx],
    peakDepthM: Math.round(roadPeakDepth[idx] * 1000) / 1000
  }));

  const hospitalAccessCrossings: AssetThresholdCrossing[] = dataset.criticalFacilities.map((fac, idx) => ({
    assetId: fac.facilityId,
    assetName: fac.name,
    assetType: 'HOSPITAL_ACCESS',
    firstCrossing15cmSeconds: hospFirst15[idx],
    firstCrossing30cmSeconds: hospFirst30[idx],
    peakDepthM: Math.round(hospPeakDepth[idx] * 1000) / 1000
  }));

  return {
    scenarioId,
    name: scenarioName,
    totalWaterVolumeM3: Math.round(state.accounting.cumulativeRainfallM3),
    cumulativeDrainageM3: Math.round(state.accounting.cumulativeDrainageM3),
    cumulativeInfiltrationM3: Math.round(state.accounting.cumulativeInfiltrationM3),
    cumulativeBoundaryOutflowM3: Math.round(state.accounting.cumulativeBoundaryOutflowM3),
    massBalanceErrorM3: state.accounting.massBalanceErrorM3,
    currentStorageM3: Math.round(state.accounting.currentStorageM3),
    maxWaterDepthM: Math.round(maxWaterDepthM * 1000) / 1000,
    impassableRoadCount,
    atRiskHospitalCount,
    hospitals,
    roads,
    waterDepth: state.waterDepth,
    relativeConservationError: state.accounting.relativeError,
    drainageByInletId: state.accounting.drainageByInletId || {},
    dtMacroSeconds: dtMacro,
    roadThresholdCrossings,
    hospitalAccessCrossings
  };
}

function classifyThresholdComparison(
  baselineSeconds: number | null,
  planSeconds: number | null
): { outcome: ThresholdComparisonOutcome; deltaSeconds: number | null } {
  if (baselineSeconds === null && planSeconds === null) {
    return { outcome: 'NEVER_CROSSED', deltaSeconds: null };
  }
  if (baselineSeconds !== null && planSeconds === null) {
    return { outcome: 'AVOIDED', deltaSeconds: null };
  }
  if (baselineSeconds === null && planSeconds !== null) {
    return { outcome: 'NEWLY_CROSSED', deltaSeconds: null };
  }
  const delta = (planSeconds as number) - (baselineSeconds as number);
  if (delta > 0) return { outcome: 'DELAYED', deltaSeconds: delta };
  if (delta < 0) return { outcome: 'ACCELERATED', deltaSeconds: delta };
  return { outcome: 'UNCHANGED', deltaSeconds: 0 };
}

function buildTemporalThresholdSummary(
  baseline: ScenarioRunMetrics,
  plan: ScenarioRunMetrics,
  profile: StressProfile
): TemporalThresholdSummary {
  const dtMacroSeconds = baseline.dtMacroSeconds || 20.0;
  const baseRoadMap = new Map<string, AssetThresholdCrossing>();
  for (const rc of baseline.roadThresholdCrossings || []) {
    baseRoadMap.set(rc.assetId, rc);
  }

  const road30cmComparisons: AssetThresholdComparison[] = [];
  const road15cmComparisons: AssetThresholdComparison[] = [];

  for (const pr of plan.roadThresholdCrossings || []) {
    const br = baseRoadMap.get(pr.assetId);
    if (!br) continue;

    const c30 = classifyThresholdComparison(br.firstCrossing30cmSeconds, pr.firstCrossing30cmSeconds);
    if (c30.outcome !== 'NEVER_CROSSED') {
      road30cmComparisons.push({
        assetId: pr.assetId,
        assetName: pr.assetName,
        assetType: 'ROAD',
        thresholdM: 0.30,
        baselineCrossingSeconds: br.firstCrossing30cmSeconds,
        planCrossingSeconds: pr.firstCrossing30cmSeconds,
        deltaSeconds: c30.deltaSeconds,
        outcome: c30.outcome
      });
    }

    const c15 = classifyThresholdComparison(br.firstCrossing15cmSeconds, pr.firstCrossing15cmSeconds);
    if (c15.outcome !== 'NEVER_CROSSED') {
      road15cmComparisons.push({
        assetId: pr.assetId,
        assetName: pr.assetName,
        assetType: 'ROAD',
        thresholdM: 0.15,
        baselineCrossingSeconds: br.firstCrossing15cmSeconds,
        planCrossingSeconds: pr.firstCrossing15cmSeconds,
        deltaSeconds: c15.deltaSeconds,
        outcome: c15.outcome
      });
    }
  }

  const baseHospMap = new Map<string, AssetThresholdCrossing>();
  for (const hc of baseline.hospitalAccessCrossings || []) {
    baseHospMap.set(hc.assetId, hc);
  }

  const hospitalAccess30cmComparisons: AssetThresholdComparison[] = (plan.hospitalAccessCrossings || []).map((ph) => {
    const bh = baseHospMap.get(ph.assetId);
    const baseSec = bh ? bh.firstCrossing30cmSeconds : null;
    const c30 = classifyThresholdComparison(baseSec, ph.firstCrossing30cmSeconds);
    return {
      assetId: ph.assetId,
      assetName: ph.assetName,
      assetType: 'HOSPITAL_ACCESS',
      thresholdM: 0.30,
      baselineCrossingSeconds: baseSec,
      planCrossingSeconds: ph.firstCrossing30cmSeconds,
      deltaSeconds: c30.deltaSeconds,
      outcome: c30.outcome
    };
  });

  const avoided30cmRoadCount = road30cmComparisons.filter((c) => c.outcome === 'AVOIDED').length;
  const delayed30cmRoadCount = road30cmComparisons.filter((c) => c.outcome === 'DELAYED').length;
  const acceleratedOrNewlyCrossed30cmRoadCount = road30cmComparisons.filter(
    (c) => c.outcome === 'ACCELERATED' || c.outcome === 'NEWLY_CROSSED'
  ).length;

  return {
    dtMacroSeconds,
    simulatedDurationSeconds: profile.durationSeconds,
    road30cmComparisons,
    road15cmComparisons,
    hospitalAccess30cmComparisons,
    avoided30cmRoadCount,
    delayed30cmRoadCount,
    acceleratedOrNewlyCrossed30cmRoadCount,
    disclosure:
      `Discrete threshold-crossing times sampled at Δt = ${dtMacroSeconds}s solver macro-step intervals across 25m screening cells ` +
      `(15cm / 30cm depth screening tiers) over ${profile.durationSeconds}s. No sub-step interpolation is performed. ` +
      `These screening metrics do not represent vehicle clearance, ambulance access, road travel time, or real-world response windows.`
  };
}

/**
 * Computes comparative differential metrics between a baseline and an intervention.
 */
function computePlanDifferential(
  baseline: ScenarioRunMetrics,
  plan: ScenarioRunMetrics,
  planDef: InterventionDefinition,
  profile: StressProfile
): PlanDifferential {
  const cellArea = 625.0; // 25m * 25m

  // A. Avoided surface flood volume: V_baseline - V_plan
  const avoidedSurfaceVolumeM3 = Math.round(baseline.currentStorageM3 - plan.currentStorageM3);

  // B. Peak depth reduction: d_max,baseline - d_max,plan
  const peakDepthReductionM = Math.round((baseline.maxWaterDepthM - plan.maxWaterDepthM) * 1000) / 1000;

  // C. Road passability transitions (both improved and worsened)
  const baselineRoadMap = new Map<string, RoadPassabilityImpact>();
  for (const r of baseline.roads) {
    baselineRoadMap.set(r.roadId, r);
  }

  const improvedRoadNames: string[] = [];
  const worsenedRoadNames: string[] = [];

  for (const pr of plan.roads) {
    const br = baselineRoadMap.get(pr.roadId);
    if (!br) continue;
    const baseImpassable = br.status === 'CRITICAL_IMPASSABLE';
    const planImpassable = pr.status === 'CRITICAL_IMPASSABLE';

    if (baseImpassable && !planImpassable) {
      improvedRoadNames.push(pr.name);
    } else if (!baseImpassable && planImpassable) {
      worsenedRoadNames.push(pr.name);
    }
  }

  const protectedRoadCount = improvedRoadNames.length;
  const netProtectedRoadCount = improvedRoadNames.length - worsenedRoadNames.length;

  const roadTransitions: RoadTransitionSummary = {
    improvedRoadNames,
    worsenedRoadNames,
    netProtectedRoadCount
  };

  // D. Hospital improvements: transitions between status levels
  const hospitalImprovements: HospitalImprovement[] = [];
  let improvedHospitalCount = 0;

  for (let i = 0; i < baseline.hospitals.length; i++) {
    const baseH = baseline.hospitals[i];
    const planH = plan.hospitals[i];

    let transition: HospitalImprovement['transition'] = 'UNCHANGED';
    if (baseH.status === 'ISOLATED_INUNDATION' && planH.status === 'CAUTION_PERIMETER_PONDING') {
      transition = 'ISOLATED_TO_CAUTION';
      improvedHospitalCount++;
    } else if (baseH.status === 'ISOLATED_INUNDATION' && planH.status === 'ACCESSIBLE') {
      transition = 'ISOLATED_TO_ACCESSIBLE';
      improvedHospitalCount++;
    } else if (baseH.status === 'CAUTION_PERIMETER_PONDING' && planH.status === 'ACCESSIBLE') {
      transition = 'CAUTION_TO_ACCESSIBLE';
      improvedHospitalCount++;
    }

    hospitalImprovements.push({
      hospitalName: baseH.name,
      baselineStatus: baseH.status,
      planStatus: planH.status,
      transition
    });
  }

  // E. Spatial deflection accounting (Local adverse increases: delta < -0.01m)
  let adverseCellCount = 0;
  let maxAdverseDepthIncreaseM = 0;
  let deflectedVolumeM3 = 0;

  for (let i = 0; i < baseline.waterDepth.length; i++) {
    const baseD = baseline.waterDepth[i];
    const planD = plan.waterDepth[i];
    const delta = baseD - planD; // positive: drawdown; negative: local increase

    if (delta < -0.01) {
      adverseCellCount++;
      const adverseRise = -delta;
      if (adverseRise > maxAdverseDepthIncreaseM) {
        maxAdverseDepthIncreaseM = adverseRise;
      }
      deflectedVolumeM3 += adverseRise * cellArea;
    }
  }

  const spatialDeflection: SpatialDeflectionMetrics = {
    adverseCellCount,
    adverseAreaM2: adverseCellCount * cellArea,
    maxAdverseDepthIncreaseM: Math.round(maxAdverseDepthIncreaseM * 1000) / 1000,
    deflectedVolumeM3: Math.round(deflectedVolumeM3)
  };

  // F. Inlet-Specific Drainage Accounting
  const totalCatchmentDrainageM3 = Math.round(plan.cumulativeDrainageM3);
  const planInlets = plan.drainageByInletId || {};
  const fenwayDrain = planInlets['CULVERT-02-FENWAY-CHOKE'] || 0;
  const longwoodDrain = planInlets['DRAIN-03-LONGWOOD-WEST'] || 0;
  const backgroundInletDrainageM3 = Math.round(fenwayDrain + longwoodDrain);

  let interventionSinkExtractionM3 = 0;
  if (planDef.id === 'plan-beta') {
    interventionSinkExtractionM3 = Math.round(planInlets['PUMP-BETA-MOBILE'] || 0);
  } else if (planDef.id === 'plan-gamma') {
    interventionSinkExtractionM3 = Math.round(planInlets['CULVERT-01-BROOKLINE'] || 0);
  }

  const incrementalDrainageM3 = Math.round(plan.cumulativeDrainageM3 - baseline.cumulativeDrainageM3);
  const avoidedSurfaceStorageM3 = avoidedSurfaceVolumeM3;

  const inletDrainageAccounting: InletDrainageAccounting = {
    totalCatchmentDrainageM3,
    backgroundInletDrainageM3,
    interventionSinkExtractionM3,
    incrementalDrainageM3,
    avoidedSurfaceStorageM3
  };

  // G. Effectiveness Classification (Strict Precedence Order)
  let classification: EffectivenessClassification = 'INCONCLUSIVE_NO_EFFECTIVE_PLAN';
  let classificationRationale = '';

  // 1. ADVERSE_LOCAL_DEFLECTION (Precedence 1)
  if (
    (spatialDeflection.maxAdverseDepthIncreaseM >= 0.05 && spatialDeflection.adverseCellCount >= 2) ||
    spatialDeflection.deflectedVolumeM3 >= 25.0 ||
    worsenedRoadNames.length > 0
  ) {
    classification = 'ADVERSE_LOCAL_DEFLECTION';
    classificationRationale =
      `DELTA Screening Criteria: Plan produces adverse localized ponding: ${spatialDeflection.adverseCellCount} cells show water depth increase ` +
      `(peak rise: +${(spatialDeflection.maxAdverseDepthIncreaseM * 100).toFixed(1)} cm, deflected volume: ${spatialDeflection.deflectedVolumeM3.toLocaleString()} m³)` +
      (worsenedRoadNames.length > 0 ? `, rendering ${worsenedRoadNames.join(', ')} newly impassable` : '') +
      ` with net storage reduction of ${avoidedSurfaceVolumeM3.toLocaleString()} m³.`;
  }
  // 2. CAPACITY_CONSTRAINED (Precedence 2)
  else if (
    planDef.id === 'plan-beta' &&
    interventionSinkExtractionM3 > 0 &&
    interventionSinkExtractionM3 >= 0.85 * (planDef.physicalParameters.pumpCapacityM3PerSec || 2.0) * profile.durationSeconds &&
    plan.waterDepth[17 * 64 + 25] >= 0.15
  ) {
    classification = 'CAPACITY_CONSTRAINED';
    classificationRationale =
      `DELTA Screening Criteria: Modelled mobile pump operating near nominal extraction capacity ` +
      `(${interventionSinkExtractionM3.toLocaleString()} m³ drawn, ${((interventionSinkExtractionM3 / (2.0 * profile.durationSeconds)) * 100).toFixed(1)}% of theoretical maximum) ` +
      `while local water continues accumulating at suction coordinate [17, 25] (${(plan.waterDepth[17 * 64 + 25] * 100).toFixed(1)} cm depth).`;
  }
  // 3. MEASURABLE_BENEFIT (Precedence 3)
  else if (
    avoidedSurfaceVolumeM3 >= 50.0 ||
    improvedRoadNames.length > 0 ||
    peakDepthReductionM >= 0.05
  ) {
    classification = 'MEASURABLE_BENEFIT';
    classificationRationale =
      `DELTA Screening Criteria: Plan provides measurable benefit: avoids ${avoidedSurfaceVolumeM3.toLocaleString()} m³ surface storage ` +
      (improvedRoadNames.length > 0 ? `and restores passability on ${improvedRoadNames.join(', ')} ` : '') +
      (peakDepthReductionM >= 0.01 ? `(peak domain depth reduced by ${(peakDepthReductionM * 100).toFixed(1)} cm).` : '.');
  }
  // 4. NEGLIGIBLE_IMPACT (Precedence 4)
  else if (
    Math.abs(avoidedSurfaceVolumeM3) < 10.0 &&
    improvedRoadNames.length === 0 &&
    worsenedRoadNames.length === 0 &&
    spatialDeflection.adverseCellCount === 0
  ) {
    classification = 'NEGLIGIBLE_IMPACT';
    classificationRationale =
      `DELTA Screening Criteria: Plan yields negligible impact under this profile: avoided surface storage is ${avoidedSurfaceVolumeM3} m³ ` +
      `with 0 road passability transitions and 0 hospital ingress changes.`;
  }
  // 5. INCONCLUSIVE (Precedence 5)
  else {
    classification = 'INCONCLUSIVE_NO_EFFECTIVE_PLAN';
    classificationRationale =
      `DELTA Screening Criteria: Comparative results are inconclusive under this profile: avoided storage is ${avoidedSurfaceVolumeM3} m³ ` +
      `with no decisive passability improvement or volume reduction.`;
  }

  const temporalThresholds = buildTemporalThresholdSummary(baseline, plan, profile);

  return {
    planId: planDef.id,
    name: planDef.name,
    avoidedSurfaceVolumeM3,
    peakDepthReductionM,
    protectedRoadCount,
    protectedRoadNames: improvedRoadNames,
    roadTransitions,
    hospitalImprovements,
    improvedHospitalCount,
    spatialDeflection,
    inletDrainageAccounting,
    temporalThresholds,
    classification,
    classificationRationale
  };
}

/**
 * Deterministically generates evidence-based comparative findings from actual computed scenario outputs.
 */
export function generateEvidenceBasedFindings(
  baseline: ScenarioRunMetrics,
  _plans: {
    alpha: ScenarioRunMetrics;
    beta: ScenarioRunMetrics;
    gamma: ScenarioRunMetrics;
  },
  differentials: {
    alpha: PlanDifferential;
    beta: PlanDifferential;
    gamma: PlanDifferential;
  },
  profile: StressProfile
): EvidenceBasedComparison {
  const keyFindings: string[] = [];
  const tradeOffs: string[] = [];
  const capacityLimitations: string[] = [];

  const { alpha: diffA, beta: diffB, gamma: diffG } = differentials;

  // Overview context from baseline
  keyFindings.push(
    `Catchment Baseline: Under ${profile.name}, unmitigated catchment accumulates ${baseline.currentStorageM3.toLocaleString()} m³ surface storage ` +
    `(total rain input: ${baseline.totalWaterVolumeM3.toLocaleString()} m³) with ${baseline.cumulativeDrainageM3.toLocaleString()} m³ drained through background stormwater inlets.`
  );

  // 1. Plan Alpha Analysis
  if (diffA.spatialDeflection.adverseCellCount > 0) {
    keyFindings.push(
      `Plan Alpha (Francis St Barrier): Deflects surface runoff, causing localized depth increases on ${diffA.spatialDeflection.adverseCellCount} cells ` +
      `(peak adverse rise: +${(diffA.spatialDeflection.maxAdverseDepthIncreaseM * 100).toFixed(1)} cm, deflected volume: ${diffA.spatialDeflection.deflectedVolumeM3.toLocaleString()} m³) ` +
      `while yielding ${diffA.avoidedSurfaceVolumeM3.toLocaleString()} m³ net catchment storage reduction.`
    );
    tradeOffs.push(
      `Plan Alpha creates local flow diversion: water prevented from entering immediate curb cuts ponds on adjacent terrain cells without reducing domain-wide water.`
    );
  } else {
    keyFindings.push(
      `Plan Alpha (Francis St Barrier): Yields negligible spatial effect under ${profile.name} (avoided storage: ${diffA.avoidedSurfaceVolumeM3} m³).`
    );
    tradeOffs.push(
      `Plan Alpha Trade-off: Local sandbag barrier does not reduce domain-wide flood storage (avoided storage: ${diffA.avoidedSurfaceVolumeM3} m³).`
    );
  }

  // 2. Plan Beta Analysis
  keyFindings.push(
    `Plan Beta (Mobile Pump #1): Extracted ${diffB.inletDrainageAccounting.interventionSinkExtractionM3.toLocaleString()} m³ from suction cell [17, 25], ` +
    `reducing domain storage by ${diffB.avoidedSurfaceVolumeM3.toLocaleString()} m³ ` +
    `(incremental drainage over baseline: ${diffB.inletDrainageAccounting.incrementalDrainageM3.toLocaleString()} m³).`
  );
  if (diffB.classification === 'CAPACITY_CONSTRAINED') {
    capacityLimitations.push(
      `Plan Beta: Modelled pump extraction (2.0 m³/s) operates at capacity while water continues accumulating, indicating hydraulic inflow exceeds pumping capacity under this intensity.`
    );
  }

  // 3. Plan Gamma Analysis
  keyFindings.push(
    `Plan Gamma (Culvert Jetting): Modelled unrouted point drainage sink at [17, 26] extracted ${diffG.inletDrainageAccounting.interventionSinkExtractionM3.toLocaleString()} m³ ` +
    `at nominal 12.5 m³/s capacity, reducing domain surface storage by ${diffG.avoidedSurfaceVolumeM3.toLocaleString()} m³ ` +
    `(incremental drainage over baseline: ${diffG.inletDrainageAccounting.incrementalDrainageM3.toLocaleString()} m³).`
  );
  tradeOffs.push(
    `Plan Gamma Solver Limitation: The Brookline culvert is represented as an unrouted point drainage sink on the elevated road deck (7.51m NAVD88); water is destroyed from domain storage rather than conveyed through a dynamic conduit into downstream basins.`
  );

  // 4. Recommendation Determination
  // Select candidate with MEASURABLE_BENEFIT and highest volume avoided without ADVERSE_LOCAL_DEFLECTION
  const candidates = [diffA, diffB, diffG].filter((d) => d.classification === 'MEASURABLE_BENEFIT');

  let recommendedPlanId: string | null = null;
  let recommendationRationale = '';
  let overallAssessment = '';

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.avoidedSurfaceVolumeM3 - a.avoidedSurfaceVolumeM3);
    recommendedPlanId = candidates[0].planId;
    const best = candidates[0];
    recommendationRationale =
      `Recommended Plan: ${best.name}. Under ${profile.name}, this plan achieves the greatest measured screening benefit ` +
      `(${best.avoidedSurfaceVolumeM3.toLocaleString()} m³ avoided surface storage, ${best.protectedRoadCount} protected road corridors) ` +
      `without triggering adverse localized deflection thresholds.`;
    overallAssessment =
      `Differential evaluation demonstrates distinct physical regimes: ${best.name} provides the most measurable benefit under ${profile.name}.`;
  } else {
    // No plan qualified as MEASURABLE_BENEFIT
    recommendedPlanId = null;
    recommendationRationale =
      `Inconclusive / No Recommended Plan: Under ${profile.name}, none of the three candidate interventions ` +
      `achieved the DELTA screening threshold for measurable benefit (≥50 m³ avoided volume or road restoration) without adverse deflection penalties.`;
    overallAssessment =
      `Under constrained or low-intensity conditions, simulated interventions exhibit negligible impact or adverse local trade-offs. No municipal intervention is decisively warranted under these screening parameters.`;
  }

  return {
    keyFindings,
    tradeOffs,
    capacityLimitations,
    overallAssessment,
    recommendedPlanId,
    recommendationRationale
  };
}

/**
 * Executes Multi-Scenario Intervention Evaluation across an authoritative or custom stress profile.
 * Runs Baseline and all 3 Plans from an invariant, independent clone of the initial state.
 */
export function* executeMultiScenarioEvaluationSteps(
  dataset: BostonCatchmentDataset,
  simulatedSecondsOrProfile: number | StressProfile | string = 3600,
  rainfallRateMmPerHour: number = 35.0,
  dtMacro: number = 20.0,
  activeDisruptionIds: string[] = ['disruption-brookline-culvert']
): Generator<void, MultiScenarioEvaluationResult, void> {
  const { nx } = dataset.metadata.grid;

  // Resolve stress profile
  let profile: StressProfile;
  if (typeof simulatedSecondsOrProfile === 'string') {
    profile = AUTHORITATIVE_STRESS_PROFILES[simulatedSecondsOrProfile] || AUTHORITATIVE_STRESS_PROFILES['synthetic-moderate-stress'];
  } else if (typeof simulatedSecondsOrProfile === 'object') {
    profile = simulatedSecondsOrProfile;
  } else {
    // Legacy numeric duration invocation
    const durationSeconds = simulatedSecondsOrProfile;
    profile = {
      id: `custom-${durationSeconds}s-${rainfallRateMmPerHour}mmh`,
      name: `Synthetic Stress (${rainfallRateMmPerHour} mm/h, ${(durationSeconds / 3600).toFixed(1)}h)`,
      type: 'SYNTHETIC_STRESS_INPUT',
      durationHours: durationSeconds / 3600,
      durationSeconds,
      totalRainfallMm: Math.round((rainfallRateMmPerHour * (durationSeconds / 3600)) * 10) / 10,
      rainfallIntensityMmPerHour: rainfallRateMmPerHour,
      initialConditionsDescription: 'Dry bare-earth terrain (h = 0.0 m across all 4096 cells)',
      provenance: 'Configured scenario run',
      disclosures: ['Synthetic exploratory stress input']
    };
  }

  // Resolve active physical disruptions identically for baseline and all 3 plans
  const normalizedDisruptionIds = Array.from(new Set(activeDisruptionIds)).sort();
  const activeDisruptions = normalizedDisruptionIds
    .map((id) => AUTHORITATIVE_DISRUPTIONS.find((d) => d.id === id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));

  const disruptionIdString =
    normalizedDisruptionIds.length === 0
      ? 'NONE_NOMINAL_DRAINAGE'
      : normalizedDisruptionIds.length === 1 && normalizedDisruptionIds[0] === 'disruption-brookline-culvert'
      ? 'CULVERT-01-BROOKLINE-BLOCKAGE'
      : normalizedDisruptionIds.join('+');

  // 1. Construct Authoritative Invariant Baseline Configuration
  const baseDisruptedConfig = createHydraulicConfigFromCatchment(dataset, {
    manningN: 0.025,
    defaultInfiltrationMmPerHour: 2.0,
    openBoundaries: 'muddy_river_outlet'
  });

  // Apply active disruptions strictly to designated drainage inlets
  if (baseDisruptedConfig.drainageInlets && activeDisruptions.length > 0) {
    baseDisruptedConfig.drainageInlets = baseDisruptedConfig.drainageInlets.map((inlet) => {
      const matched = activeDisruptions.find(
        (d) => d.gridCell[0] * nx + d.gridCell[1] === inlet.index || d.targetInletId === inlet.inletId
      );
      if (matched) {
        return { ...inlet, blockageRatio: matched.blockageRatio, inletId: matched.targetInletId };
      }
      return { ...inlet };
    });
  }

  // Run Baseline Scenario
  const baselineLabel =
    activeDisruptions.length === 0
      ? 'Baseline: Unmitigated Nominal Drainage'
      : `Baseline: Unmitigated (${activeDisruptions.map((d) => d.targetInletId).join(', ')} Impaired)`;

  const baseline = yield* runSingleScenarioSteps(
    dataset,
    baseDisruptedConfig,
    'baseline-emergency',
    baselineLabel,
    profile,
    dtMacro
  );

  // 2. Construct Plan Alpha (Deployable Sandbag Barrier: +0.50m crest along Francis St cells)
  const alphaConfig: HydraulicGridConfig = {
    ...baseDisruptedConfig,
    elevation: new Float64Array(baseDisruptedConfig.elevation), // Independent copy
    drainageInlets: baseDisruptedConfig.drainageInlets ? [...baseDisruptedConfig.drainageInlets] : []
  };

  const alphaDef = AUTHORITATIVE_INTERVENTIONS['plan-alpha'];
  if (alphaDef.physicalParameters.barrierCells) {
    for (const [r, c] of alphaDef.physicalParameters.barrierCells) {
      const idx = r * nx + c;
      alphaConfig.elevation[idx] += (alphaDef.physicalParameters.elevationDeltaM || 0.50);
    }
  }

  const planAlpha = yield* runSingleScenarioSteps(
    dataset,
    alphaConfig,
    'plan-alpha',
    alphaDef.name,
    profile,
    dtMacro
  );

  // 3. Construct Plan Beta (Mobile Pump #1: 2.0 m³/s active suction sink at [17, 25])
  const betaDef = AUTHORITATIVE_INTERVENTIONS['plan-beta'];
  const pumpCell = betaDef.physicalParameters.pumpCell || [17, 25];
  const pumpIndex = pumpCell[0] * nx + pumpCell[1];

  const betaInlets: DrainageInlet[] = baseDisruptedConfig.drainageInlets
    ? baseDisruptedConfig.drainageInlets.map((i) => ({ ...i }))
    : [];

  // Add mobile suction pump with explicit inletId
  betaInlets.push({
    index: pumpIndex,
    capacityM3PerSec: betaDef.physicalParameters.pumpCapacityM3PerSec || 2.0,
    blockageRatio: 0.0, // 100% operational
    inletId: 'PUMP-BETA-MOBILE'
  });

  const betaConfig: HydraulicGridConfig = {
    ...baseDisruptedConfig,
    elevation: new Float64Array(baseDisruptedConfig.elevation), // Independent copy
    drainageInlets: betaInlets
  };

  const planBeta = yield* runSingleScenarioSteps(
    dataset,
    betaConfig,
    'plan-beta',
    betaDef.name,
    profile,
    dtMacro
  );

  // 4. Construct Plan Gamma (Emergency Culvert Jetting: Restores CULVERT-01-BROOKLINE to 12.5 m³/s)
  const gammaDef = AUTHORITATIVE_INTERVENTIONS['plan-gamma'];
  const gammaInlets: DrainageInlet[] = baseDisruptedConfig.drainageInlets
    ? baseDisruptedConfig.drainageInlets.map((inlet) => {
        if (inlet.index === 17 * nx + 26) {
          // Fully clear the culvert
          return {
            ...inlet,
            capacityM3PerSec: gammaDef.physicalParameters.restoredCapacityM3PerSec || 12.5,
            blockageRatio: 0.0,
            inletId: 'CULVERT-01-BROOKLINE'
          };
        }
        return { ...inlet };
      })
    : [];

  const gammaConfig: HydraulicGridConfig = {
    ...baseDisruptedConfig,
    elevation: new Float64Array(baseDisruptedConfig.elevation), // Independent copy
    drainageInlets: gammaInlets
  };

  const planGamma = yield* runSingleScenarioSteps(
    dataset,
    gammaConfig,
    'plan-gamma',
    gammaDef.name,
    profile,
    dtMacro
  );

  // 5. Compute Comparative Differentials
  const diffAlpha = computePlanDifferential(baseline, planAlpha, alphaDef, profile);
  const diffBeta = computePlanDifferential(baseline, planBeta, betaDef, profile);
  const diffGamma = computePlanDifferential(baseline, planGamma, gammaDef, profile);

  // 6. Evidence-Based Comparative Analysis
  const comparison = generateEvidenceBasedFindings(
    baseline,
    { alpha: planAlpha, beta: planBeta, gamma: planGamma },
    { alpha: diffAlpha, beta: diffBeta, gamma: diffGamma },
    profile
  );

  // Ranking compatibility mapping
  const plans = [diffAlpha, diffBeta, diffGamma];
  const sortedByVolume = [...plans].sort((a, b) => b.avoidedSurfaceVolumeM3 - a.avoidedSurfaceVolumeM3);
  const sortedByRoads = [...plans].sort((a, b) => b.protectedRoadCount - a.protectedRoadCount);

  return {
    baseline,
    planAlpha,
    planBeta,
    planGamma,
    differentials: {
      'plan-alpha': diffAlpha,
      'plan-beta': diffBeta,
      'plan-gamma': diffGamma,
      planAlpha: diffAlpha,
      planBeta: diffBeta,
      planGamma: diffGamma
    },
    ranking: {
      mostVolumeAvoided: sortedByVolume[0].planId,
      mostRoadsProtected: sortedByRoads[0].planId,
      recommendedPlanId: comparison.recommendedPlanId || sortedByVolume[0].planId,
      recommendationRationale: comparison.recommendationRationale
    },
    comparison,
    simulationMetadata: {
      profileId: profile.id,
      profileLabel: profile.name,
      profileType: profile.type,
      stormId: profile.id,
      stormLabel: profile.name,
      simulatedDurationSeconds: profile.durationSeconds,
      dtMacroSeconds: dtMacro,
      rainfallIntensityMmPerHour: profile.rainfallIntensityMmPerHour ?? (profile.totalRainfallMm / profile.durationHours),
      totalRainfallMm: profile.totalRainfallMm,
      disruptionId: disruptionIdString,
      activeDisruptionIds: normalizedDisruptionIds,
      activeDisruptionLabels: activeDisruptions.map((d) => d.name),
      timestamp: new Date().toISOString(),
      provenance: profile.provenance,
      disclosures: profile.disclosures
    }
  };
}

export function executeMultiScenarioEvaluation(
  dataset: BostonCatchmentDataset,
  simulatedSecondsOrProfile: number | StressProfile | string = 3600,
  rainfallRateMmPerHour: number = 35.0,
  dtMacro: number = 20.0,
  activeDisruptionIds: string[] = ['disruption-brookline-culvert']
): MultiScenarioEvaluationResult {
  const gen = executeMultiScenarioEvaluationSteps(dataset, simulatedSecondsOrProfile, rainfallRateMmPerHour, dtMacro, activeDisruptionIds);
  let step = gen.next();
  while (!step.done) step = gen.next();
  return step.value;
}

/** Chunked variant: yields to the event loop between solver step batches so Forge iframes stay responsive. */
export async function executeMultiScenarioEvaluationAsync(
  dataset: BostonCatchmentDataset,
  simulatedSecondsOrProfile: number | StressProfile | string = 3600,
  rainfallRateMmPerHour: number = 35.0,
  dtMacro: number = 20.0,
  activeDisruptionIds: string[] = ['disruption-brookline-culvert']
): Promise<MultiScenarioEvaluationResult> {
  const gen = executeMultiScenarioEvaluationSteps(dataset, simulatedSecondsOrProfile, rainfallRateMmPerHour, dtMacro, activeDisruptionIds);
  let step = gen.next();
  while (!step.done) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    step = gen.next();
  }
  return step.value;
}
