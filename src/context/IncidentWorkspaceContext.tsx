/**
 * DELTA Shared Incident Workspace State Architecture
 *
 * Single source of truth coordinating:
 * - Packaged Boston Longwood / Muddy River catchment dataset
 * - Selected rainfall profile (NOAA regional benchmark or synthetic stress profile)
 * - Active drainage disruption configuration
 * - Selected intervention plan (Alpha, Beta, Gamma)
 * - Solver-backed multi-scenario evaluation & spatial disruption recalculation
 * - Immutable scenario hash binding & stale-result invalidation
 * - Synchronized decision records & staged operational work orders
 * - Workspace stage navigation & map selection state
 *
 * Strict Integrity Guarantee:
 * Changing the rainfall profile or disruption configuration immediately invalidates
 * dependent cached outputs and triggers fresh solver execution. Historical decision
 * records and work orders are preserved immutably and never silently rebound to a
 * different scenario hash.
 */

import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef
} from 'react';
import { BostonCatchmentDataset, loadBostonCatchment } from '../data/catchmentLoader';
import {
  AUTHORITATIVE_STRESS_PROFILES,
  executeMultiScenarioEvaluationAsync,
  MultiScenarioEvaluationResult,
  StressProfile
} from '../simulation/interventionEngine';
import {
  AUTHORITATIVE_DISRUPTIONS,
  DisruptionScenario,
  executeSpatialDisruptionComparisonAsync,
  SpatialDisruptionComparisonResult
} from '../simulation/disruptionEngine';
import { computeScenarioHash } from '../simulation/decisionBriefingEngine';
import {
  getStoredWorkOrders,
  OperationalWorkOrder
} from '../simulation/workOrderEngine';
import { invokeSafe } from '../services/forgeBridge';
import type { CanvasLayerVisibility } from '../components/simulation/GeographicSimulationCanvas';

export type WorkspaceStage =
  | 'intelligence'
  | 'simulation'
  | 'interventions'
  | 'briefing'
  | 'operations'
  | 'issue-panel';

export type PlanId = 'plan-alpha' | 'plan-beta' | 'plan-gamma';

export interface CachedEvaluationEntry {
  configKey: string;
  scenarioHash: string;
  result: MultiScenarioEvaluationResult;
}

export interface CachedDisruptionEntry {
  configKey: string;
  result: SpatialDisruptionComparisonResult;
}

/**
 * Deterministic key identifying the exact rainfall + disruption input configuration.
 */
export function buildScenarioConfigKey(profileId: string, activeDisruptionIds: string[]): string {
  const sorted = Array.from(new Set(activeDisruptionIds)).sort();
  return `${profileId}::${sorted.join(',') || 'NOMINAL'}`;
}

/**
 * Verifies that a cached evaluation strictly matches the active configuration key.
 */
export function isEvaluationFreshForConfig(
  entry: CachedEvaluationEntry | null | undefined,
  activeConfigKey: string
): boolean {
  return Boolean(entry && entry.configKey === activeConfigKey);
}

/**
 * Returns the decision bound to the exact active scenario hash, without mutating
 * or falsely binding historical decisions from different scenarios.
 */
export function findMatchingDecisionForHash(
  decisions: any[],
  activeScenarioHash: string | null
): any | null {
  if (!activeScenarioHash || !Array.isArray(decisions)) return null;
  const normalized = activeScenarioHash.trim().toUpperCase();
  return (
    decisions.find((d) => {
      const h1 = (d?.scenarioHash || '').toString().trim().toUpperCase();
      const h2 = (d?.canonicalScenario?.briefingScenarioHash || d?.canonicalScenario?.scenarioHash || '')
        .toString()
        .trim()
        .toUpperCase();
      return h1 === normalized || h2 === normalized;
    }) || null
  );
}

/**
 * Returns the work order bound to the exact active scenario hash (and optionally plan).
 */
export function findMatchingWorkOrderForHash(
  workOrders: OperationalWorkOrder[],
  activeScenarioHash: string | null,
  preferredPlanId?: PlanId
): OperationalWorkOrder | null {
  if (!activeScenarioHash || !Array.isArray(workOrders)) return null;
  const normalized = activeScenarioHash.trim().toUpperCase();
  const matching = workOrders.filter(
    (wo) => (wo.supportingSimulationEvidence?.scenarioHash || '').trim().toUpperCase() === normalized
  );
  if (matching.length === 0) return null;
  if (preferredPlanId) {
    const exactPlan = matching.find((wo) => wo.planId === preferredPlanId);
    if (exactPlan) return exactPlan;
  }
  return matching[0];
}

export interface IncidentWorkspaceContextValue {
  // Static authoritative dataset
  dataset: BostonCatchmentDataset;

  // Navigation stage
  activeStage: WorkspaceStage;
  setActiveStage: (stage: WorkspaceStage) => void;

  // Active scenario configuration (single source of truth)
  activeProfileId: string;
  activeProfile: StressProfile;
  setActiveProfileId: (profileId: string) => void;

  activeDisruptionIds: string[];
  activeDisruptions: DisruptionScenario[];
  toggleDisruption: (disruptionId: string) => void;
  setActiveDisruptionIds: (ids: string[]) => void;
  clearAllDisruptions: () => void;

  selectedPlanId: PlanId;
  setSelectedPlanId: (planId: PlanId) => void;

  // Active configuration identity & computation state
  scenarioConfigKey: string;
  activeScenarioHash: string | null;
  isComputingEvaluation: boolean;
  evaluationError: string | null;
  evaluationResult: MultiScenarioEvaluationResult | null;
  recomputeActiveScenario: () => void;

  // Spatial disruption comparison synchronized with active profile + disruptions
  isComputingDisruption: boolean;
  disruptionComparison: SpatialDisruptionComparisonResult | null;
  ensureDisruptionComparison: () => void;

  // Governance & Operational Work Orders (preserving historical immutability)
  decisions: any[];
  workOrders: OperationalWorkOrder[];
  activeDecisionForScenario: any | null;
  latestHistoricalDecision: any | null;
  activeWorkOrderForScenario: OperationalWorkOrder | null;
  refreshGovernanceRecords: () => Promise<void>;
  registerNewDecision: (decision: any) => void;

  // Shared Map Layer & Selection State
  canvasLayers: CanvasLayerVisibility;
  toggleCanvasLayer: (layer: keyof CanvasLayerVisibility) => void;
  setCanvasLayers: React.Dispatch<React.SetStateAction<CanvasLayerVisibility>>;
  selectedCell: { row: number; col: number } | null;
  setSelectedCell: (cell: { row: number; col: number } | null) => void;
  selectedRoadId: string | null;
  setSelectedRoadId: (id: string | null) => void;
  selectedFacilityId: string | null;
  setSelectedFacilityId: (id: string | null) => void;
  selectedWorkOrderId: string | null;
  setSelectedWorkOrderId: (id: string | null) => void;
}

const IncidentWorkspaceContext = createContext<IncidentWorkspaceContextValue | null>(null);

export const IncidentWorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dataset = useMemo(() => loadBostonCatchment(), []);

  // 1. Operational Journey Stage
  const [activeStage, setActiveStage] = useState<WorkspaceStage>('intelligence');

  // 2. Scenario Configuration State (Single Source of Truth)
  const [activeProfileId, setActiveProfileIdState] = useState<string>('reference-noaa-50yr');
  const [activeDisruptionIds, setActiveDisruptionIdsState] = useState<string[]>([
    'disruption-brookline-culvert'
  ]);
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>('plan-gamma');

  // 3. Strictly Keyed Solver Caches (prevents stale cross-scenario reads)
  const evaluationCacheRef = useRef<Map<string, CachedEvaluationEntry>>(new Map());
  const disruptionCacheRef = useRef<Map<string, CachedDisruptionEntry>>(new Map());
  const disruptionInFlightRef = useRef<Set<string>>(new Set());

  const [currentEvaluationEntry, setCurrentEvaluationEntry] = useState<CachedEvaluationEntry | null>(null);
  const [isComputingEvaluation, setIsComputingEvaluation] = useState<boolean>(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);

  const [currentDisruptionEntry, setCurrentDisruptionEntry] = useState<CachedDisruptionEntry | null>(null);
  const [isComputingDisruption, setIsComputingDisruption] = useState<boolean>(false);

  // 4. Governance & Operational Records
  const [decisions, setDecisions] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<OperationalWorkOrder[]>(() => getStoredWorkOrders());

  // 5. Shared Map Layers & Feature Selection
  const [canvasLayers, setCanvasLayers] = useState<CanvasLayerVisibility>({
    satellite: true,
    terrain: false,
    contours: false,
    water: true,
    vectors: false,
    roads: true,
    facilities: true,
    drainage: true,
    workOrders: true,
    adversePonding: true,
    legend: true
  });
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [selectedRoadId, setSelectedRoadId] = useState<string | null>(null);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);

  const activeProfile: StressProfile =
    AUTHORITATIVE_STRESS_PROFILES[activeProfileId] || AUTHORITATIVE_STRESS_PROFILES['reference-noaa-50yr'];

  const activeDisruptions: DisruptionScenario[] = useMemo(
    () =>
      activeDisruptionIds
        .map((id) => AUTHORITATIVE_DISRUPTIONS.find((d) => d.id === id))
        .filter((d): d is DisruptionScenario => Boolean(d)),
    [activeDisruptionIds]
  );

  const scenarioConfigKey = useMemo(
    () => buildScenarioConfigKey(activeProfileId, activeDisruptionIds),
    [activeProfileId, activeDisruptionIds]
  );

  // Strict freshness guard: never expose an evaluation that does not match scenarioConfigKey
  const evaluationResult = isEvaluationFreshForConfig(currentEvaluationEntry, scenarioConfigKey)
    ? currentEvaluationEntry!.result
    : null;

  const activeScenarioHash = isEvaluationFreshForConfig(currentEvaluationEntry, scenarioConfigKey)
    ? currentEvaluationEntry!.scenarioHash
    : null;

  const disruptionComparison =
    currentDisruptionEntry && currentDisruptionEntry.configKey === scenarioConfigKey
      ? currentDisruptionEntry.result
      : null;

  // Deterministic solver execution for active profile + disruptions
  const runEvaluationForActiveConfig = useCallback(
    (forceRecompute = false) => {
      const targetKey = buildScenarioConfigKey(activeProfileId, activeDisruptionIds);

      if (!forceRecompute) {
        const cached = evaluationCacheRef.current.get(targetKey);
        if (cached) {
          setCurrentEvaluationEntry(cached);
          setIsComputingEvaluation(false);
          setEvaluationError(null);
          return;
        }
      }

      // Immediately clear stale entry so consumers cannot read mismatched scenario results
      setCurrentEvaluationEntry((prev) => (prev && prev.configKey === targetKey ? prev : null));
      setIsComputingEvaluation(true);
      setEvaluationError(null);

      const profile =
        AUTHORITATIVE_STRESS_PROFILES[activeProfileId] || AUTHORITATIVE_STRESS_PROFILES['reference-noaa-50yr'];
      const disruptionIdsCopy = [...activeDisruptionIds];

      let cancelled = false;
      // Chunked async solver: yields between step batches so the Forge iframe main thread stays responsive.
      (async () => {
        try {
          const dtMacro = profile.durationSeconds > 7200 ? 60.0 : 20.0;
          const result = await executeMultiScenarioEvaluationAsync(
            dataset,
            profile,
            profile.rainfallIntensityMmPerHour ?? profile.totalRainfallMm / profile.durationHours,
            dtMacro,
            disruptionIdsCopy
          );
          if (cancelled) return;
          const hash = computeScenarioHash(result);
          const entry: CachedEvaluationEntry = { configKey: targetKey, scenarioHash: hash, result };
          evaluationCacheRef.current.set(targetKey, entry);
          setCurrentEvaluationEntry(entry);
        } catch (err: any) {
          if (!cancelled) setEvaluationError(err?.message || 'Hydraulic evaluation failed');
        } finally {
          if (!cancelled) setIsComputingEvaluation(false);
        }
      })();

      return () => { cancelled = true; };
    },
    [activeProfileId, activeDisruptionIds, dataset]
  );

  // Compute evaluation lazily on stages that need it — never eagerly on initial load,
  // so the Forge project page renders immediately inside its iframe.
  useEffect(() => {
    if (!['interventions', 'briefing', 'operations'].includes(activeStage)) return;
    const cleanup = runEvaluationForActiveConfig(false);
    return () => {
      if (cleanup) cleanup();
    };
  }, [runEvaluationForActiveConfig, activeStage]);

  // Compute spatial disruption comparison (Nominal vs Disrupted) strictly under active profile + disruptions
  const ensureDisruptionComparison = useCallback(() => {
    const targetKey = buildScenarioConfigKey(activeProfileId, activeDisruptionIds);
    const cached = disruptionCacheRef.current.get(targetKey);
    if (cached) {
      setCurrentDisruptionEntry(cached);
      setIsComputingDisruption(false);
      return;
    }

    if (disruptionInFlightRef.current.has(targetKey)) return;
    disruptionInFlightRef.current.add(targetKey);
    setCurrentDisruptionEntry((prev) => (prev && prev.configKey === targetKey ? prev : null));
    setIsComputingDisruption(true);

    const profile =
      AUTHORITATIVE_STRESS_PROFILES[activeProfileId] || AUTHORITATIVE_STRESS_PROFILES['reference-noaa-50yr'];
    const disruptionIdsCopy = [...activeDisruptionIds];

    (async () => {
      try {
        const dtMacro = profile.durationSeconds > 7200 ? 60.0 : 20.0;
        const result = await executeSpatialDisruptionComparisonAsync(
          dataset,
          disruptionIdsCopy,
          profile,
          dtMacro
        );
        const entry: CachedDisruptionEntry = { configKey: targetKey, result };
        disruptionCacheRef.current.set(targetKey, entry);
        setCurrentDisruptionEntry(entry);
      } finally {
        disruptionInFlightRef.current.delete(targetKey);
        setIsComputingDisruption(false);
      }
    })();
  }, [activeProfileId, activeDisruptionIds, dataset]);

  // Keep disruption comparison synchronized when user is viewing Simulation & Disruption
  useEffect(() => {
    if (activeStage === 'simulation') {
      ensureDisruptionComparison();
    } else {
      // Ensure stale disruption entry is invalidated if config changed while on another stage
      setCurrentDisruptionEntry((prev) => (prev && prev.configKey === scenarioConfigKey ? prev : null));
    }
  }, [activeStage, scenarioConfigKey, ensureDisruptionComparison]);

  // Load & merge Forge KVS + local governance records
  const refreshGovernanceRecords = useCallback(async () => {
    const localWos = getStoredWorkOrders();
    let mergedWos = [...localWos];

    try {
      const woRes: any = await invokeSafe('listWorkOrders');
      if (woRes && woRes.success && Array.isArray(woRes.data)) {
        const forgeWos = woRes.data as OperationalWorkOrder[];
        mergedWos = [...forgeWos];
        for (const loc of localWos) {
          if (!mergedWos.some((m) => m.workOrderId === loc.workOrderId)) {
            mergedWos.push(loc);
          }
        }
      }
    } catch {
      // Standalone browser mode fallback
    }
    setWorkOrders(mergedWos);

    try {
      const decRes: any = await invokeSafe('listDecisions');
      if (decRes && decRes.success && Array.isArray(decRes.decisions)) {
        setDecisions(decRes.decisions);
      } else if (decRes && decRes.success && Array.isArray(decRes.data)) {
        setDecisions(decRes.data);
      }
    } catch {
      // Standalone browser mode fallback
    }
  }, []);

  useEffect(() => {
    refreshGovernanceRecords();
  }, [refreshGovernanceRecords]);

  const registerNewDecision = useCallback((decision: any) => {
    if (!decision) return;
    setDecisions((prev) => {
      const id = decision.decisionId || decision.id;
      const filtered = prev.filter((d) => (d.decisionId || d.id) !== id);
      return [decision, ...filtered];
    });
  }, []);

  // Configuration mutation handlers (with explicit invalidation)
  const setActiveProfileId = useCallback((profileId: string) => {
    if (!AUTHORITATIVE_STRESS_PROFILES[profileId]) return;
    setActiveProfileIdState(profileId);
  }, []);

  const setActiveDisruptionIds = useCallback((ids: string[]) => {
    const valid = Array.from(
      new Set(ids.filter((id) => AUTHORITATIVE_DISRUPTIONS.some((d) => d.id === id)))
    ).sort();
    setActiveDisruptionIdsState(valid);
  }, []);

  const toggleDisruption = useCallback((disruptionId: string) => {
    if (!AUTHORITATIVE_DISRUPTIONS.some((d) => d.id === disruptionId)) return;
    setActiveDisruptionIdsState((prev) => {
      if (prev.includes(disruptionId)) {
        return prev.filter((id) => id !== disruptionId);
      }
      return [...prev, disruptionId].sort();
    });
  }, []);

  const clearAllDisruptions = useCallback(() => {
    setActiveDisruptionIdsState([]);
  }, []);

  const toggleCanvasLayer = useCallback((layer: keyof CanvasLayerVisibility) => {
    setCanvasLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  const recomputeActiveScenario = useCallback(() => {
    evaluationCacheRef.current.delete(scenarioConfigKey);
    disruptionCacheRef.current.delete(scenarioConfigKey);
    runEvaluationForActiveConfig(true);
    if (activeStage === 'simulation') {
      ensureDisruptionComparison();
    }
  }, [scenarioConfigKey, runEvaluationForActiveConfig, activeStage, ensureDisruptionComparison]);

  const activeDecisionForScenario = useMemo(
    () => findMatchingDecisionForHash(decisions, activeScenarioHash),
    [decisions, activeScenarioHash]
  );

  const latestHistoricalDecision = decisions.length > 0 ? decisions[0] : null;

  const activeWorkOrderForScenario = useMemo(
    () => findMatchingWorkOrderForHash(workOrders, activeScenarioHash, selectedPlanId),
    [workOrders, activeScenarioHash, selectedPlanId]
  );

  const value: IncidentWorkspaceContextValue = {
    dataset,
    activeStage,
    setActiveStage,
    activeProfileId,
    activeProfile,
    setActiveProfileId,
    activeDisruptionIds,
    activeDisruptions,
    toggleDisruption,
    setActiveDisruptionIds,
    clearAllDisruptions,
    selectedPlanId,
    setSelectedPlanId,
    scenarioConfigKey,
    activeScenarioHash,
    isComputingEvaluation,
    evaluationError,
    evaluationResult,
    recomputeActiveScenario,
    isComputingDisruption,
    disruptionComparison,
    ensureDisruptionComparison,
    decisions,
    workOrders,
    activeDecisionForScenario,
    latestHistoricalDecision,
    activeWorkOrderForScenario,
    refreshGovernanceRecords,
    registerNewDecision,
    canvasLayers,
    toggleCanvasLayer,
    setCanvasLayers,
    selectedCell,
    setSelectedCell,
    selectedRoadId,
    setSelectedRoadId,
    selectedFacilityId,
    setSelectedFacilityId,
    selectedWorkOrderId,
    setSelectedWorkOrderId
  };

  return (
    <IncidentWorkspaceContext.Provider value={value}>
      {children}
    </IncidentWorkspaceContext.Provider>
  );
};

export function useIncidentWorkspace(): IncidentWorkspaceContextValue {
  const ctx = useContext(IncidentWorkspaceContext);
  if (!ctx) {
    throw new Error('useIncidentWorkspace must be used within an IncidentWorkspaceProvider');
  }
  return ctx;
}
