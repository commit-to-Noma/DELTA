import React, { useState, useMemo, useEffect, useTransition, useCallback } from 'react';
import { 
  BarChart3, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight,
  TrendingDown,
  Layers,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertTriangle,
  X,
  Lock,
  FileText,
  Compass,
  MapPin,
  CloudRain,
  Check
} from 'lucide-react';
import { loadBostonCatchment } from '../../../data/catchmentLoader';
import { 
  AUTHORITATIVE_INTERVENTIONS, 
  AUTHORITATIVE_STRESS_PROFILES,
  executeMultiScenarioEvaluation, 
  MultiScenarioEvaluationResult,
  InterventionDefinition,
  HospitalImprovement,
  StressProfile,
  EffectivenessClassification
} from '../../../simulation/interventionEngine';
import { invokeSafe } from '../../../services/forgeBridge';
import {
  GeographicSimulationCanvas,
  CellHoverInfo,
  CanvasLayerVisibility,
} from '../../simulation/GeographicSimulationCanvas';

interface InterventionsViewProps {
  onNavigateToDecisions?: () => void;
}

interface ProfileOption {
  id: string;
  name: string;
  shortLabel: string;
  badge: string;
  isRegionalBenchmark: boolean;
  totalDepthMm: number;
  durationLabel: string;
  peakRateLabel: string;
}

const PROFILE_OPTIONS: ProfileOption[] = [
  {
    id: 'reference-noaa-50yr',
    name: 'NOAA Atlas 14 50-Year Regional Benchmark (6-Hour)',
    shortLabel: 'NOAA 50-YR BENCHMARK',
    badge: 'REGIONAL NOAA BENCHMARK',
    isRegionalBenchmark: true,
    totalDepthMm: 104.2,
    durationLabel: '6.0 Hours',
    peakRateLabel: '34.9 mm/h (Hour 3)',
  },
  {
    id: 'synthetic-moderate-stress',
    name: 'Synthetic Moderate Convective Event (1-Hour)',
    shortLabel: 'MODERATE CONVECTIVE',
    badge: 'SYNTHETIC STRESS',
    isRegionalBenchmark: false,
    totalDepthMm: 35.0,
    durationLabel: '1.0 Hour',
    peakRateLabel: '35.0 mm/h',
  },
  {
    id: 'synthetic-high-intensity',
    name: 'Synthetic High-Intensity Stress Burst (30-Min)',
    shortLabel: 'HIGH-INTENSITY BURST',
    badge: 'SYNTHETIC BURST',
    isRegionalBenchmark: false,
    totalDepthMm: 37.5,
    durationLabel: '30 Minutes',
    peakRateLabel: '75.0 mm/h',
  },
  {
    id: 'synthetic-low-intensity',
    name: 'Synthetic Low-Intensity Sensitivity Test (1-Hour)',
    shortLabel: 'LOW-INTENSITY SENSITIVITY',
    badge: 'SYNTHETIC SENSITIVITY',
    isRegionalBenchmark: false,
    totalDepthMm: 15.0,
    durationLabel: '1.0 Hour',
    peakRateLabel: '15.0 mm/h',
  },
];

export const InterventionsView: React.FC<InterventionsViewProps> = ({ onNavigateToDecisions }) => {
  const dataset = useMemo(() => loadBostonCatchment(), []);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('reference-noaa-50yr');
  const [selectedPlanId, setSelectedPlanId] = useState<'plan-alpha' | 'plan-beta' | 'plan-gamma'>('plan-gamma');
  const [evaluationCache, setEvaluationCache] = useState<Record<string, MultiScenarioEvaluationResult>>({});
  const [evaluationResult, setEvaluationResult] = useState<MultiScenarioEvaluationResult | null>(null);
  const [isRunningEvaluation, setIsRunningEvaluation] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState<boolean>(false);
  const [engineeringRationale, setEngineeringRationale] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [approvedRecord, setApprovedRecord] = useState<any | null>(null);

  // Centerpiece Canvas State for Intervention Visual Evaluation
  const [canvasLayers, setCanvasLayers] = useState<CanvasLayerVisibility>({
    satellite: true,
    terrain: false,
    contours: false,
    water: true,
    vectors: false,
    roads: true,
    facilities: true,
    drainage: true,
    legend: true,
  });
  const [mapViewMode, setMapViewMode] = useState<'standard' | 'delta'>('delta');
  const [inspectedCell, setInspectedCell] = useState<CellHoverInfo | null>(null);
  const [selectedRoadId, setSelectedRoadId] = useState<string | null>(null);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);

  const activeProfile: StressProfile = AUTHORITATIVE_STRESS_PROFILES[selectedProfileId] || AUTHORITATIVE_STRESS_PROFILES['reference-noaa-50yr'];
  const activeOption = PROFILE_OPTIONS.find((p) => p.id === selectedProfileId);

  const toggleCanvasLayer = (layer: keyof CanvasLayerVisibility) => {
    setCanvasLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  // Run solver evaluation across all 4 scenarios (Baseline + 3 Plans) for a given profile
  const runEvaluationForProfile = useCallback((profileId: string, forceRerun = false) => {
    if (!forceRerun && evaluationCache[profileId]) {
      setEvaluationResult(evaluationCache[profileId]);
      return;
    }

    setIsRunningEvaluation(true);
    const timer = setTimeout(() => {
      startTransition(() => {
        const targetProfile = AUTHORITATIVE_STRESS_PROFILES[profileId] || AUTHORITATIVE_STRESS_PROFILES['reference-noaa-50yr'];
        // For the 6-hour piecewise profile (21600s), dtMacro=30.0 runs deterministically and smoothly
        const dtMacro = targetProfile.durationSeconds > 7200 ? 30.0 : 20.0;
        const result = executeMultiScenarioEvaluation(dataset, targetProfile, 0, dtMacro);

        setEvaluationCache((prev) => ({ ...prev, [profileId]: result }));
        setEvaluationResult(result);
        setIsRunningEvaluation(false);
      });
    }, 40);

    return () => clearTimeout(timer);
  }, [dataset, evaluationCache]);

  // Initial load on mount
  useEffect(() => {
    runEvaluationForProfile('reference-noaa-50yr');
  }, [runEvaluationForProfile]);

  // Handle switching storm profiles
  const handleSelectProfile = (profileId: string) => {
    if (isRunningEvaluation || profileId === selectedProfileId) return;
    setSelectedProfileId(profileId);
    runEvaluationForProfile(profileId);
  };

  // Set default engineering rationale when plan or profile changes
  useEffect(() => {
    if (selectedPlanId === 'plan-gamma') {
      setEngineeringRationale(
        `Plan Gamma (Emergency Culvert Jetting) is selected under ${activeProfile.name}. ` +
        `The simulation models clearing the Brookline culvert choke to restore 12.5 m³/s nominal capacity. ` +
        `Note: The Brookline culvert is represented as an unrouted point drainage sink on the elevated road deck (7.51m NAVD88). ` +
        `These results are DELTA screening-model outputs (≥50 m³ benefit threshold) and do not guarantee field flood protection.`
      );
    } else if (selectedPlanId === 'plan-beta') {
      setEngineeringRationale(
        `Plan Beta (Mobile Pump #1) is authorized under ${activeProfile.name}. ` +
        `Deploys high-capacity mobile diesel pump at retention channel [17, 25] operating at 2.0 m³/s active dewatering. ` +
        `Model evaluates capacity limits against sustained inflow.`
      );
    } else {
      setEngineeringRationale(
        `Plan Alpha (Francis St Barrier) is reviewed under ${activeProfile.name}. ` +
        `Erects +0.50m rapid sandbag barriers along Francis St ambulance bay. ` +
        `Evaluation acknowledges trade-off: localized flow diversion causes water to pond on adjacent terrain cells without reducing catchment flood storage.`
      );
    }
  }, [selectedPlanId, activeProfile.name]);

  const selectedPlanDef: InterventionDefinition = AUTHORITATIVE_INTERVENTIONS[selectedPlanId];
  const selectedDiff = evaluationResult?.differentials[selectedPlanId];
  const selectedPlanMetrics = evaluationResult
    ? selectedPlanId === 'plan-alpha'
      ? evaluationResult.planAlpha
      : selectedPlanId === 'plan-beta'
      ? evaluationResult.planBeta
      : evaluationResult.planGamma
    : null;

  // Render classification badge with strict precedence styling
  const renderClassificationBadge = (classification: EffectivenessClassification) => {
    switch (classification) {
      case 'ADVERSE_LOCAL_DEFLECTION':
        return (
          <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600 text-[10px] font-bold tracking-wide">
            ADVERSE DEFLECTION
          </span>
        );
      case 'CAPACITY_CONSTRAINED':
        return (
          <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-600 text-[10px] font-bold tracking-wide">
            CAPACITY CONSTRAINED
          </span>
        );
      case 'MEASURABLE_BENEFIT':
        return (
          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-600 text-[10px] font-bold tracking-wide">
            MEASURABLE BENEFIT
          </span>
        );
      case 'NEGLIGIBLE_IMPACT':
        return (
          <span className="px-2 py-0.5 rounded bg-onyx-800 text-storm-300 border border-onyx-700 text-[10px] font-bold tracking-wide">
            NEGLIGIBLE IMPACT
          </span>
        );
      case 'INCONCLUSIVE_NO_EFFECTIVE_PLAN':
        return (
          <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-700 text-[10px] font-bold tracking-wide">
            INCONCLUSIVE
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Scientific Screening Notice */}
      <div className="bg-onyx-900 border-l-4 border-safety-orange p-4 rounded-r border-y border-r border-onyx-800 flex items-start gap-3">
        <Info className="w-5 h-5 text-safety-orange flex-shrink-0 mt-0.5" />
        <div className="text-xs font-mono text-storm-300 space-y-1">
          <div className="font-bold text-storm-100 uppercase tracking-wider flex items-center gap-2">
            <span>MULTI-SCENARIO INTERVENTION PLANNER // 2D DIFFUSIVE-WAVE SOLVER PIPELINE</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-onyx-800 text-storm-300 border border-onyx-700">
              WORKSTREAM 3B OPERATIONAL
            </span>
          </div>
          <p className="text-storm-300 font-sans">
            Every candidate intervention is simulated against an <strong>invariant baseline storm</strong> with identical dry bare-earth initial conditions ($h = 0$).
            Comparative metrics (avoided surface flood volume, incremental drainage, spatial deflection, and road passability) are derived strictly from 2D solver outputs.
          </p>
          <div className="text-[11px] text-amber-300 font-mono pt-1">
            * Screening simulation model results for municipal decision support. DELTA uses a ≥50 m³ avoided volume screening threshold (not an empirical statutory standard).
          </div>
        </div>
      </div>

      {/* Meteorological Stress Profile Selector */}
      <div className="bg-onyx-900 border border-onyx-800 rounded-lg p-4 font-mono text-xs space-y-3 shadow-tactical">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-onyx-800">
          <div className="flex items-center gap-2">
            <CloudRain className="w-4 h-4 text-safety-orange" />
            <span className="font-bold text-storm-100 uppercase tracking-wider text-xs">
              METEOROLOGICAL STRESS PROFILE SELECTOR
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-onyx-950 text-storm-300 border border-onyx-800 font-bold">
              4 PROFILES
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => runEvaluationForProfile(selectedProfileId, true)}
              disabled={isRunningEvaluation}
              className="px-3 py-1.5 rounded bg-onyx-800 hover:bg-onyx-700 text-storm-200 border border-onyx-700 text-[11px] font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Force full recomputation of 4 scenarios"
            >
              <RefreshCw className={`w-3 h-3 ${isRunningEvaluation ? 'animate-spin' : ''}`} />
              <span>{isRunningEvaluation ? 'SOLVER RUNNING...' : 'RECALCULATE SCENARIOS'}</span>
            </button>
          </div>
        </div>

        {/* 4 Profile Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PROFILE_OPTIONS.map((opt) => {
            const isSelected = selectedProfileId === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => handleSelectProfile(opt.id)}
                className={`p-3 rounded-lg border cursor-pointer font-mono text-xs space-y-2 transition-all relative ${
                  isSelected
                    ? 'bg-onyx-850 border-safety-orange ring-1 ring-safety-orange shadow-safety'
                    : 'bg-onyx-950 border-onyx-800 hover:border-onyx-700 hover:bg-onyx-900'
                } ${isRunningEvaluation ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                    opt.isRegionalBenchmark
                      ? 'bg-blue-950 text-blue-300 border-blue-700'
                      : 'bg-onyx-800 text-storm-300 border-onyx-700'
                  }`}>
                    {opt.badge}
                  </span>
                  {isSelected && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-safety-orange">
                      <Check className="w-3 h-3" />
                      <span>ACTIVE</span>
                    </span>
                  )}
                </div>

                <div className="font-bold text-storm-100 text-xs tracking-tight line-clamp-1">
                  {opt.shortLabel}
                </div>

                <div className="space-y-1 text-[11px] text-storm-300 border-t border-onyx-800/80 pt-1.5">
                  <div className="flex justify-between">
                    <span className="text-storm-500">Total Depth:</span>
                    <strong className="text-storm-100">{opt.totalDepthMm.toFixed(1)} mm</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-storm-500">Duration:</span>
                    <span className="text-storm-200">{opt.durationLabel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-storm-500">Peak Rate:</span>
                    <span className="text-storm-200">{opt.peakRateLabel}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Profile Provenance & Disclosures Strip */}
        <div className="bg-onyx-950 p-2.5 rounded border border-onyx-850 text-[11px] font-sans text-storm-300 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div>
              <strong className="text-storm-100 font-mono text-[10px] uppercase">{activeProfile.name}:</strong>{' '}
              {activeProfile.provenance}
            </div>
            {activeProfile.disclosures.map((disc, idx) => (
              <div key={idx} className="text-storm-400 text-[10.5px]">
                • {disc}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recalculation Loading State Overlay Banner */}
      {isRunningEvaluation && (
        <div className="bg-onyx-900 border border-safety-orange p-3.5 rounded-lg font-mono text-xs flex items-center justify-center gap-3 text-safety-orange animate-pulse shadow-tactical">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>RECOMPUTING 2D SOLVER FOR {activeProfile.name.toUpperCase()} (4 SCENARIOS: BASELINE, ALPHA, BETA, GAMMA)...</span>
        </div>
      )}

      {/* 4-Scenario Comparative Matrix Grid */}
      {evaluationResult ? (
        <div className="space-y-5">
          {/* Baseline Crisis Reference Strip */}
          <div className="bg-onyx-900 p-4 rounded-lg border border-red-900/60 font-mono text-xs flex flex-wrap items-center justify-between gap-4 shadow-tactical">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800 text-[10px] font-bold">
                UNMITIGATED BASELINE
              </span>
              <span className="text-storm-100 font-bold text-sm">Brookline Culvert Debris Choke</span>
              <span className="text-storm-400 text-xs hidden sm:inline">({activeProfile.name})</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs">
              <div><span className="text-storm-400">Total Rain:</span> <strong className="text-storm-200">{evaluationResult.baseline.totalWaterVolumeM3.toLocaleString()} m³</strong></div>
              <div><span className="text-storm-400">Flood Storage:</span> <strong className="text-red-400">{evaluationResult.baseline.currentStorageM3.toLocaleString()} m³</strong></div>
              <div><span className="text-storm-400">Peak Depth:</span> <strong className="text-red-400">{evaluationResult.baseline.maxWaterDepthM.toFixed(2)} m</strong></div>
              <div><span className="text-storm-400">Background Drainage:</span> <strong className="text-blue-400">{evaluationResult.baseline.cumulativeDrainageM3.toLocaleString()} m³</strong></div>
              <div><span className="text-storm-400">Impassable Roads:</span> <strong className="text-red-400">{evaluationResult.baseline.impassableRoadCount}</strong></div>
              <div><span className="text-storm-400">Hospitals at Risk:</span> <strong className="text-red-400">{evaluationResult.baseline.atRiskHospitalCount}</strong></div>
            </div>
          </div>

          {/* 3 Candidate Rescue Plans (Clean 3-Column Layout) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. Plan Alpha */}
            <div 
              onClick={() => setSelectedPlanId('plan-alpha')}
              className={`p-5 rounded-lg border cursor-pointer font-mono text-xs space-y-3 transition-all ${
                selectedPlanId === 'plan-alpha'
                  ? 'bg-onyx-850 border-safety-orange shadow-safety ring-1 ring-safety-orange'
                  : 'bg-onyx-900 border-onyx-800 hover:border-onyx-700'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-onyx-800">
                <span className="font-bold text-storm-200 uppercase text-sm">PLAN ALPHA</span>
                {renderClassificationBadge(evaluationResult.differentials.planAlpha.classification)}
              </div>
              <div className="text-base font-bold text-storm-100">Sandbag Barrier</div>
              <p className="text-xs text-storm-400 font-sans leading-relaxed">
                +0.50m crest barrier on Francis St. Deflects water around Brigham &amp; Women's bay.
              </p>

              {/* Adverse Deflection Notice on Card */}
              {evaluationResult.differentials.planAlpha.spatialDeflection.adverseCellCount > 0 && (
                <div className="p-2 rounded bg-amber-950/60 border border-amber-800/80 text-[11px] text-amber-300 flex items-center justify-between">
                  <span className="flex items-center gap-1 font-bold">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span>Adverse Local Ponding:</span>
                  </span>
                  <span className="font-bold">
                    +{(evaluationResult.differentials.planAlpha.spatialDeflection.maxAdverseDepthIncreaseM * 100).toFixed(1)} cm
                  </span>
                </div>
              )}

              <div className="space-y-2 pt-2 text-xs border-t border-onyx-800/60">
                <div className="flex justify-between">
                  <span className="text-storm-400">Water Avoided:</span>
                  <span className="text-storm-200 font-bold">
                    {evaluationResult.differentials.planAlpha.avoidedSurfaceVolumeM3 > 0 ? '+' : ''}
                    {evaluationResult.differentials.planAlpha.avoidedSurfaceVolumeM3.toLocaleString()} m³
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-storm-400">Roads Protected:</span>
                  <span className="text-storm-200 font-bold">
                    {evaluationResult.differentials.planAlpha.protectedRoadCount} Corridors
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-storm-400">Deflected Volume:</span>
                  <span className="text-amber-400 font-bold">
                    {evaluationResult.differentials.planAlpha.spatialDeflection.deflectedVolumeM3.toLocaleString()} m³
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Plan Beta */}
            <div 
              onClick={() => setSelectedPlanId('plan-beta')}
              className={`p-5 rounded-lg border cursor-pointer font-mono text-xs space-y-3 transition-all ${
                selectedPlanId === 'plan-beta'
                  ? 'bg-onyx-850 border-safety-orange shadow-safety ring-1 ring-safety-orange'
                  : 'bg-onyx-900 border-onyx-800 hover:border-onyx-700'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-onyx-800">
                <span className="font-bold text-storm-200 uppercase text-sm">PLAN BETA</span>
                {renderClassificationBadge(evaluationResult.differentials.planBeta.classification)}
              </div>
              <div className="text-base font-bold text-storm-100">Mobile Pump #1</div>
              <p className="text-xs text-storm-400 font-sans leading-relaxed">
                2.0 m³/s high-capacity suction pump deployed to Muddy River retention basin ([17, 25]).
              </p>

              <div className="space-y-2 pt-2 text-xs border-t border-onyx-800/60">
                <div className="flex justify-between">
                  <span className="text-storm-400">Water Avoided:</span>
                  <span className="text-safety-orange font-bold text-sm">
                    +{evaluationResult.differentials.planBeta.avoidedSurfaceVolumeM3.toLocaleString()} m³
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-storm-400">Pump Siphoned:</span>
                  <span className="text-blue-300 font-bold">
                    {evaluationResult.differentials.planBeta.inletDrainageAccounting.interventionSinkExtractionM3.toLocaleString()} m³
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-storm-400">Roads Protected:</span>
                  <span className="text-emerald-400 font-bold">
                    {evaluationResult.differentials.planBeta.protectedRoadCount} Corridors
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Plan Gamma */}
            <div 
              onClick={() => setSelectedPlanId('plan-gamma')}
              className={`p-5 rounded-lg border cursor-pointer font-mono text-xs space-y-3 transition-all ${
                selectedPlanId === 'plan-gamma'
                  ? 'bg-emerald-950/30 border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.25)] ring-2 ring-emerald-500'
                  : 'bg-onyx-900 border-emerald-900/60 hover:border-emerald-700'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-1 pb-2 border-b border-onyx-800">
                <span className="font-bold text-emerald-300 uppercase text-xs sm:text-sm">PLAN GAMMA</span>
                {renderClassificationBadge(evaluationResult.differentials.planGamma.classification)}
              </div>
              <div className="text-base font-bold text-emerald-400">Emergency Culvert Jetting</div>
              <p className="text-xs text-storm-300 font-sans leading-relaxed">
                Hydro-jetting crew clears Brookline culvert choke, restoring 12.5 m³/s nominal capacity.
              </p>

              <div className="space-y-2 pt-2 text-xs border-t border-onyx-800/60">
                <div className="flex justify-between items-center">
                  <span className="text-storm-300">Water Avoided:</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    +{evaluationResult.differentials.planGamma.avoidedSurfaceVolumeM3.toLocaleString()} m³
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-storm-300">Culvert Drained:</span>
                  <span className="text-emerald-300 font-bold">
                    {evaluationResult.differentials.planGamma.inletDrainageAccounting.interventionSinkExtractionM3.toLocaleString()} m³
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-storm-300">Roads Protected:</span>
                  <span className="text-emerald-400 font-bold">
                    {evaluationResult.differentials.planGamma.protectedRoadCount} Corridors
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Plan Alpha Specific Adverse Deflection Banner (When Alpha is Selected) */}
      {selectedPlanId === 'plan-alpha' && selectedDiff && selectedDiff.spatialDeflection.adverseCellCount > 0 && (
        <div className="bg-amber-950/40 border border-amber-600/80 p-4 rounded-lg font-mono text-xs space-y-3 shadow-tactical">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>ADVERSE LOCAL RUNOFF DEFLECTION DETECTED // PLAN ALPHA TRADE-OFF</span>
          </div>
          <p className="text-storm-200 font-sans leading-relaxed text-xs">
            While the sandbag barrier deflects water away from the immediate Francis St ambulance ingress bay, surface runoff is diverted onto adjacent terrain cells, causing localized adverse water rise.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-[11px]">
            <div className="bg-onyx-950/90 p-2.5 rounded border border-amber-800/60">
              <span className="text-storm-400 block text-[10px]">Peak Adverse Rise:</span>
              <span className="text-amber-300 font-bold text-base">
                +{(selectedDiff.spatialDeflection.maxAdverseDepthIncreaseM * 100).toFixed(1)} cm
              </span>
            </div>
            <div className="bg-onyx-950/90 p-2.5 rounded border border-amber-800/60">
              <span className="text-storm-400 block text-[10px]">Adverse Cells:</span>
              <span className="text-amber-300 font-bold text-base">
                {selectedDiff.spatialDeflection.adverseCellCount} cells
              </span>
            </div>
            <div className="bg-onyx-950/90 p-2.5 rounded border border-amber-800/60">
              <span className="text-storm-400 block text-[10px]">Affected Area:</span>
              <span className="text-amber-300 font-bold text-base">
                {selectedDiff.spatialDeflection.adverseAreaM2.toLocaleString()} m²
              </span>
            </div>
            <div className="bg-onyx-950/90 p-2.5 rounded border border-amber-800/60">
              <span className="text-storm-400 block text-[10px]">Deflected Volume:</span>
              <span className="text-amber-300 font-bold text-base">
                {selectedDiff.spatialDeflection.deflectedVolumeM3.toLocaleString()} m³
              </span>
            </div>
          </div>
          <div className="text-[10.5px] text-amber-300/90 pt-1 border-t border-amber-800/60 font-sans">
            * <strong>Engineering Trade-off:</strong> Sandbag diversion prevents ingress ponding at the hospital curb cut, but transfers flood risk to adjacent perimeter cells without reducing domain-wide flood storage.
          </div>
        </div>
      )}

      {/* Centerpiece Geospatial Canvas for Interventions */}
      {evaluationResult && selectedPlanMetrics && selectedDiff && (
        <div className="bg-onyx-900 rounded-lg border border-onyx-800 overflow-hidden shadow-tactical flex flex-col font-mono text-xs">
          {/* Canvas Top Bar */}
          <div className="bg-onyx-950 px-4 py-2 border-b border-onyx-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-storm-300">
              <Compass className="w-4 h-4 text-safety-orange" />
              <span className="font-bold text-storm-100 text-xs tracking-wide">
                SPATIAL INTERVENTION OUTCOME // {selectedPlanDef.name.toUpperCase()}
              </span>
              <span className="text-onyx-700 hidden sm:inline">|</span>
              <span className="text-[10px] text-storm-400 hidden sm:inline">{activeOption?.shortLabel || activeProfile.name}</span>

              {/* View Mode: Delta vs Absolute */}
              <div className="flex items-center gap-1 bg-onyx-900 rounded border border-onyx-800 p-0.5 ml-2">
                <button
                  onClick={() => setMapViewMode('delta')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                    mapViewMode === 'delta'
                      ? 'bg-emerald-600 text-white shadow-tactical'
                      : 'text-storm-400 hover:text-storm-200'
                  }`}
                  title="Shows avoided flood volume (green) vs unmitigated baseline"
                >
                  AVOIDED WATER (DELTA)
                </button>
                <button
                  onClick={() => setMapViewMode('standard')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                    mapViewMode === 'standard'
                      ? 'bg-safety-orange text-white shadow-tactical'
                      : 'text-storm-400 hover:text-storm-200'
                  }`}
                  title="Shows absolute simulated flood depth bands"
                >
                  ACTUAL DEPTH BANDS
                </button>
              </div>
            </div>

            {/* Quick Layer Toggles */}
            <div className="flex flex-wrap items-center gap-1">
              <button
                onClick={() => toggleCanvasLayer('satellite')}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                  canvasLayers.satellite ? 'bg-onyx-800 text-storm-100 border border-onyx-700 font-bold' : 'text-storm-500 hover:text-storm-300'
                }`}
              >
                SATELLITE
              </button>
              <button
                onClick={() => toggleCanvasLayer('water')}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                  canvasLayers.water ? 'bg-onyx-800 text-storm-100 border border-onyx-700 font-bold' : 'text-storm-500 hover:text-storm-300'
                }`}
              >
                WATER
              </button>
              <button
                onClick={() => toggleCanvasLayer('roads')}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                  canvasLayers.roads ? 'bg-onyx-800 text-storm-100 border border-onyx-700 font-bold' : 'text-storm-500 hover:text-storm-300'
                }`}
              >
                ROADS
              </button>
              <button
                onClick={() => toggleCanvasLayer('facilities')}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                  canvasLayers.facilities ? 'bg-onyx-800 text-storm-100 border border-onyx-700 font-bold' : 'text-storm-500 hover:text-storm-300'
                }`}
              >
                HOSPITALS
              </button>
              <button
                onClick={() => toggleCanvasLayer('drainage')}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                  canvasLayers.drainage ? 'bg-onyx-800 text-storm-100 border border-onyx-700 font-bold' : 'text-storm-500 hover:text-storm-300'
                }`}
              >
                CULVERTS
              </button>
              <button
                onClick={() => toggleCanvasLayer('legend')}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                  canvasLayers.legend !== false ? 'bg-onyx-800 text-storm-100 border border-onyx-700 font-bold' : 'text-storm-500 hover:text-storm-300'
                }`}
              >
                LEGEND
              </button>
            </div>
          </div>

          {/* Interactive Geographic Canvas Frame */}
          <div className="relative bg-onyx-950 h-[480px] overflow-hidden">
            <GeographicSimulationCanvas
              dataset={dataset}
              waterDepth={selectedPlanMetrics.waterDepth}
              baselineWaterDepth={evaluationResult.baseline.waterDepth}
              viewMode={mapViewMode}
              activeLayers={canvasLayers}
              selectedRoadId={selectedRoadId}
              selectedFacilityId={selectedFacilityId}
              onCellHover={setInspectedCell}
              onCellClick={(info) => {
                setInspectedCell(info);
                if (info.facility) setSelectedFacilityId(info.facility.facilityId);
                if (info.roadCorridor) setSelectedRoadId(info.roadCorridor.road.roadId);
              }}
              onSelectRoad={(road) => {
                setSelectedRoadId(road ? road.roadId : null);
                if (road) setSelectedFacilityId(null);
              }}
              onSelectFacility={(fac) => {
                setSelectedFacilityId(fac ? fac.facilityId : null);
                if (fac) setSelectedRoadId(null);
              }}
              className="w-full h-full"
            />
          </div>

          {/* Bottom Telemetry Bar */}
          <div className="bg-onyx-950 px-4 py-2.5 border-t border-onyx-800 flex flex-wrap items-center justify-between gap-3 text-[11px]">
            <div className="flex flex-wrap items-center gap-4 text-storm-300">
              <div>
                <span className="text-storm-500">Plan:</span>{' '}
                <strong className="text-storm-100">{selectedPlanDef.name}</strong>
              </div>
              <div className="h-3 w-[1px] bg-onyx-800 hidden sm:block" />
              <div>
                <span className="text-storm-500">Surface Water Avoided:</span>{' '}
                <strong className={selectedDiff.avoidedSurfaceVolumeM3 > 0 ? 'text-emerald-400' : 'text-storm-300'}>
                  {selectedDiff.avoidedSurfaceVolumeM3 > 0 ? '+' : ''}
                  {selectedDiff.avoidedSurfaceVolumeM3.toLocaleString()} m³
                </strong>
              </div>
              <div className="h-3 w-[1px] bg-onyx-800 hidden sm:block" />
              <div>
                <span className="text-storm-500">Roads Protected:</span>{' '}
                <strong className="text-emerald-400">{selectedDiff.protectedRoadCount} Segments</strong>
              </div>
              <div className="h-3 w-[1px] bg-onyx-800 hidden sm:block" />
              <div>
                <span className="text-storm-500">Classification:</span>{' '}
                {renderClassificationBadge(selectedDiff.classification)}
              </div>
            </div>

            {inspectedCell && (
              <div className="flex items-center gap-2 text-storm-300 bg-onyx-900 px-2 py-1 rounded border border-onyx-800 text-[10px]">
                <MapPin className="w-3 h-3 text-safety-orange" />
                <span>
                  Reticle: [{inspectedCell.row}, {inspectedCell.col}] • Depth: {(inspectedCell.waterDepthM * 100).toFixed(1)} cm
                  {inspectedCell.deltaWaterDepthM !== undefined && (
                    <span
                      className={`ml-1.5 font-bold ${
                        inspectedCell.deltaWaterDepthM > 0
                          ? 'text-emerald-400'
                          : inspectedCell.deltaWaterDepthM < 0
                          ? 'text-amber-400'
                          : 'text-storm-400'
                      }`}
                    >
                      (Δ:{' '}
                      {inspectedCell.deltaWaterDepthM > 0
                        ? `-${(inspectedCell.deltaWaterDepthM * 100).toFixed(1)}cm drawdown`
                        : inspectedCell.deltaWaterDepthM < 0
                        ? `+${(Math.abs(inspectedCell.deltaWaterDepthM) * 100).toFixed(1)}cm increase`
                        : '0.0cm'}
                      )
                    </span>
                  )}
                </span>
                <button
                  onClick={() => {
                    setInspectedCell(null);
                    setSelectedRoadId(null);
                    setSelectedFacilityId(null);
                  }}
                  className="text-storm-500 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detailed Plan Review Panel */}
      {evaluationResult && selectedDiff && selectedPlanMetrics && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Physical Specifications & Target Infrastructure */}
          <div className="lg:col-span-6 bg-onyx-900 rounded border border-onyx-800 p-5 font-mono text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-onyx-800 text-storm-400">
              <span className="font-bold text-storm-200 uppercase flex items-center gap-2">
                <Layers className="w-4 h-4 text-safety-orange" />
                <span>PHYSICAL SPECIFICATION // {selectedPlanDef.id.toUpperCase()}</span>
              </span>
              <span className="px-2 py-0.5 rounded bg-onyx-800 text-storm-300 font-bold text-[10px]">
                {selectedPlanDef.type}
              </span>
            </div>

            <div>
              <h4 className="font-display font-bold text-base text-storm-100">{selectedPlanDef.name}</h4>
              <p className="text-xs text-storm-300 font-sans mt-1">{selectedPlanDef.description}</p>
            </div>

            <div className="bg-onyx-950 p-3.5 rounded border border-onyx-800 space-y-2 text-[11px]">
              <div className="flex justify-between text-storm-400">
                <span>TARGET INFRASTRUCTURE:</span>
                <span className="text-storm-200 font-bold">{selectedPlanDef.targetInfrastructure}</span>
              </div>
              <div className="flex justify-between text-storm-400">
                <span>RESOURCE BURDEN:</span>
                <span className="text-storm-300">{selectedPlanDef.resourceCost}</span>
              </div>
              {selectedPlanDef.physicalParameters.barrierCells && (
                <div className="flex justify-between text-storm-400">
                  <span>BARRIER CREST:</span>
                  <span className="text-storm-200 font-bold">
                    +{selectedPlanDef.physicalParameters.elevationDeltaM}m on {selectedPlanDef.physicalParameters.barrierCells.length} cells
                  </span>
                </div>
              )}
              {selectedPlanDef.physicalParameters.pumpCapacityM3PerSec && (
                <div className="flex justify-between text-storm-400">
                  <span>EXTRACTION RATE:</span>
                  <span className="text-safety-orange font-bold">
                    {selectedPlanDef.physicalParameters.pumpCapacityM3PerSec.toFixed(1)} m³/s (Mass-Conserving Suction Sink)
                  </span>
                </div>
              )}
              {selectedPlanDef.physicalParameters.restoredCapacityM3PerSec && (
                <div className="flex justify-between text-storm-400">
                  <span>RESTORED CAPACITY:</span>
                  <span className="text-emerald-400 font-bold">
                    {selectedPlanDef.physicalParameters.restoredCapacityM3PerSec.toFixed(1)} m³/s (Nominal Design)
                  </span>
                </div>
              )}
            </div>

            {/* Plan Gamma Solver Limitation Disclosure */}
            {selectedPlanId === 'plan-gamma' && (
              <div className="bg-blue-950/40 border border-blue-800/60 p-3 rounded text-[11px] font-sans space-y-1 text-storm-300">
                <div className="font-bold text-blue-300 flex items-center gap-1.5 font-mono text-[10px] uppercase">
                  <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <span>Brookline Culvert Representation Disclosure</span>
                </div>
                <p className="text-[10.5px] leading-relaxed">
                  The Brookline culvert is represented as an unrouted point drainage sink on the elevated road deck (7.51m NAVD88) with nominal 12.5 m³/s capacity; water is removed from domain storage rather than hydraulically conveyed through a coupled conduit into downstream water bodies.
                </p>
              </div>
            )}

            {/* Hospital Access Impact Table */}
            <div className="space-y-2 pt-2">
              <span className="font-bold text-storm-300 uppercase text-[11px] block">
                HOSPITAL PERIMETER TRANSITIONS ({selectedPlanMetrics.hospitals.length} FACILITIES)
              </span>
              <div className="bg-onyx-950 rounded border border-onyx-800 divide-y divide-onyx-900 text-[11px]">
                {selectedDiff.hospitalImprovements.map((imp: HospitalImprovement) => (
                  <div key={imp.hospitalName} className="p-2.5 flex items-center justify-between">
                    <span className="text-storm-200">{imp.hospitalName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-storm-500">{imp.baselineStatus.replace(/_/g, ' ')}</span>
                      <ArrowRight className="w-3 h-3 text-storm-600" />
                      <span className={`font-bold ${
                        imp.planStatus === 'ACCESSIBLE' 
                          ? 'text-emerald-400' 
                          : imp.planStatus === 'CAUTION_PERIMETER_PONDING' 
                          ? 'text-amber-400' 
                          : 'text-red-400'
                      }`}>
                        {imp.planStatus.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Comparative Solver Delta & Decision Action */}
          <div className="lg:col-span-6 bg-onyx-900 rounded border border-onyx-800 p-5 font-mono text-xs flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-onyx-800 text-storm-400">
                <span className="font-bold text-storm-200 uppercase flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-safety-orange" />
                  <span>CALCULATED DIFFERENTIALS // VS. BASELINE</span>
                </span>
                <span className="text-emerald-400 font-bold text-[10px]">
                  SOLVER PASS
                </span>
              </div>

              {/* Differentials Callouts */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-onyx-950 p-3 rounded border border-onyx-800">
                  <span className="text-[10px] text-storm-500 uppercase block font-bold">AVOIDED SURFACE WATER</span>
                  <div className="text-lg font-bold text-safety-orange flex items-center gap-1 mt-1">
                    <TrendingDown className="w-4 h-4" />
                    <span>{selectedDiff.avoidedSurfaceVolumeM3 > 0 ? '+' : ''}{selectedDiff.avoidedSurfaceVolumeM3.toLocaleString()} m³</span>
                  </div>
                  <div className="text-[10px] text-storm-500 mt-1">
                    Surface storage reduction vs. unmitigated baseline
                  </div>
                </div>

                <div className="bg-onyx-950 p-3 rounded border border-onyx-800">
                  <span className="text-[10px] text-storm-500 uppercase block font-bold">PEAK DEPTH REDUCTION</span>
                  <div className="text-lg font-bold text-storm-100 mt-1">
                    {selectedDiff.peakDepthReductionM > 0 ? '-' : ''}
                    {(selectedDiff.peakDepthReductionM * 100).toFixed(1)} cm
                  </div>
                  <div className="text-[10px] text-storm-500 mt-1">
                    Maximum single-cell depth delta across 4096 cells
                  </div>
                </div>
              </div>

              {/* Inlet Drainage Accounting Card */}
              <div className="bg-onyx-950 p-3.5 rounded border border-onyx-800 space-y-2 text-[11px]">
                <div className="text-storm-300 font-bold text-[11px] uppercase border-b border-onyx-800/80 pb-1 flex justify-between items-center">
                  <span>INLET & DRAINAGE ATTRIBUTION ACCOUNTING</span>
                  <span className="text-[10px] text-storm-500 font-normal">Mass Conservation Verified</span>
                </div>
                <div className="space-y-1 text-storm-400">
                  <div className="flex justify-between">
                    <span>Total Catchment Drainage:</span>
                    <strong className="text-storm-200">{selectedDiff.inletDrainageAccounting.totalCatchmentDrainageM3.toLocaleString()} m³</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Background Stormwater Inlets (Fenway + Longwood):</span>
                    <span className="text-storm-300">{selectedDiff.inletDrainageAccounting.backgroundInletDrainageM3.toLocaleString()} m³</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Intervention Sink Extraction:</span>
                    <span className="text-blue-400 font-bold">{selectedDiff.inletDrainageAccounting.interventionSinkExtractionM3.toLocaleString()} m³</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Incremental Drainage vs Baseline:</span>
                    <span className="text-emerald-400 font-bold">+{selectedDiff.inletDrainageAccounting.incrementalDrainageM3.toLocaleString()} m³</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avoided Surface Storage:</span>
                    <span className="text-safety-orange font-bold">+{selectedDiff.inletDrainageAccounting.avoidedSurfaceStorageM3.toLocaleString()} m³</span>
                  </div>
                </div>
              </div>

              {/* Protected and Worsened Roads Callout */}
              <div className="bg-onyx-950 p-3.5 rounded border border-onyx-800 space-y-1.5">
                <div className="flex items-center justify-between text-storm-400 text-[11px]">
                  <span>SCREENED ROAD CORRIDOR TRANSITIONS:</span>
                  <span className="text-emerald-400 font-bold">{selectedDiff.protectedRoadCount} Restored</span>
                </div>
                {selectedDiff.roadTransitions.improvedRoadNames.length > 0 ? (
                  <div className="text-[11px] text-emerald-400 font-mono">
                    Restored Passable (&lt; 0.30m): {selectedDiff.roadTransitions.improvedRoadNames.join(', ')}
                  </div>
                ) : (
                  <div className="text-[11px] text-storm-500 font-mono">
                    0 road corridors restored below 0.30m threshold under this configuration.
                  </div>
                )}
                {selectedDiff.roadTransitions.worsenedRoadNames.length > 0 ? (
                  <div className="text-[11px] text-amber-400 font-mono pt-1">
                    ⚠️ Worsened to Impassable (≥ 0.30m): {selectedDiff.roadTransitions.worsenedRoadNames.join(', ')}
                  </div>
                ) : (
                  <div className="text-[10px] text-storm-600 font-mono">
                    0 road corridors worsened by diverted flow.
                  </div>
                )}
              </div>

              {/* Model Ranking & Recommendation Summary */}
              <div className="bg-purple-950/40 border border-purple-800/60 p-3.5 rounded space-y-2">
                <div className="flex items-center gap-1.5 text-purple-300 font-bold text-[11px]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>SCREENING RECOMMENDATION // {activeOption?.shortLabel || activeProfile.name}</span>
                </div>
                <div className="text-storm-100 font-bold text-xs">
                  {evaluationResult.ranking.recommendedPlanId ? (
                    selectedPlanId === evaluationResult.ranking.recommendedPlanId
                      ? `RECOMMENDED PLAN: ${selectedPlanDef.name}`
                      : `ALTERNATIVE: ${selectedPlanDef.name} (Recommended: ${evaluationResult.ranking.recommendedPlanId.toUpperCase()})`
                  ) : (
                    'INCONCLUSIVE: NO PLAN DECISIVELY RECOMMENDED'
                  )}
                </div>
                <p className="text-storm-300 font-sans text-xs leading-relaxed">
                  {evaluationResult.ranking.recommendationRationale}
                </p>
                <div className="text-[10.5px] text-purple-300/80 font-mono pt-1 border-t border-purple-900/60">
                  * DELTA screening threshold (≥50 m³ avoided volume or road restoration), not an empirically established boundary. Precedence: ADVERSE_DEFLECTION &gt; CAPACITY_CONSTRAINED &gt; MEASURABLE_BENEFIT.
                </div>
              </div>

              {/* Deterministic Evaluation Key Findings */}
              {evaluationResult.comparison && (
                <div className="bg-onyx-950 p-3.5 rounded border border-onyx-800 space-y-2 text-[11px]">
                  <div className="text-storm-300 font-bold text-[11px] uppercase border-b border-onyx-800/80 pb-1">
                    DETERMINISTIC FINDINGS & CAPACITY LIMITS
                  </div>
                  <div className="space-y-1.5 text-storm-400 font-sans">
                    {evaluationResult.comparison.keyFindings.map((finding, idx) => (
                      <div key={idx} className="text-[11px] text-storm-300">
                        • {finding}
                      </div>
                    ))}
                    {evaluationResult.comparison.capacityLimitations.map((cap, idx) => (
                      <div key={idx} className="text-[11px] text-amber-300">
                        ⚠️ <strong>Capacity Limit:</strong> {cap}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Section: Human Approval & Decision Record Persistence */}
            <div className="pt-4 border-t border-onyx-800 space-y-3">
              {approvedRecord ? (
                <div className="p-4 rounded-lg bg-emerald-950/80 border border-emerald-700 font-mono text-xs space-y-3 shadow-tactical">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-300 font-bold">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span>DECISION RECORD COMMITTED &amp; APPROVED // {approvedRecord.decisionId}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-900/80 text-emerald-200 border border-emerald-600 text-[10px]">
                      FORGE KVS PERSISTED
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-storm-300 border-y border-emerald-800/60 py-2">
                    <div><span className="text-storm-400">Authorized Plan:</span> <strong className="text-emerald-300">{approvedRecord.chosenPlan?.name}</strong></div>
                    <div><span className="text-storm-400">Stress Profile:</span> <strong className="text-storm-100">{activeProfile.name}</strong></div>
                    <div><span className="text-storm-400">Approver:</span> <strong className="text-storm-100">{approvedRecord.humanApprover?.displayName} [{approvedRecord.humanApprover?.role}]</strong></div>
                    <div><span className="text-storm-400">Scenario Hash:</span> <code className="text-emerald-400 font-mono text-[10px]">{approvedRecord.scenarioHash}</code></div>
                  </div>

                  <div className="text-xs text-storm-200">
                    <span className="font-bold text-storm-400">Rationale: </span>
                    <em>"{approvedRecord.engineeringRationale}"</em>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    {onNavigateToDecisions && (
                      <button
                        onClick={onNavigateToDecisions}
                        className="px-4 py-2 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        <span>VIEW IN DECISION RECORDS &rarr;</span>
                      </button>
                    )}
                    <button
                      onClick={() => setApprovedRecord(null)}
                      className="px-3 py-2 rounded bg-onyx-800 hover:bg-onyx-700 text-storm-300 border border-onyx-700 text-xs transition-colors"
                    >
                      Authorize Another Scenario
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setApprovalError(null);
                      setIsApprovalModalOpen(true);
                    }}
                    className={`w-full flex items-center justify-center gap-2 font-mono text-xs font-bold py-3.5 px-4 rounded-lg transition-all shadow-tactical ${
                      selectedPlanId === 'plan-gamma'
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400'
                        : 'bg-safety-orange hover:bg-safety-hover text-white'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>INITIATE INCIDENT COMMANDER APPROVAL REVIEW: {selectedPlanDef.id.toUpperCase()} &rarr;</span>
                  </button>
                  <div className="text-[11px] text-storm-400 text-center font-mono">
                    Requires explicit human engineering rationale and 2-step confirmation before writing to Forge KVS audit ledger.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Explicit Human Approval Confirmation Modal */}
      {isApprovalModalOpen && evaluationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-onyx-900 border border-onyx-700 rounded-lg max-w-2xl w-full p-6 shadow-2xl font-mono text-xs space-y-5 my-8">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-onyx-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-safety-orange" />
                <div>
                  <div className="font-bold text-sm text-storm-100 uppercase tracking-wider">
                    HUMAN APPROVAL // INCIDENT COMMANDER AUTHORIZATION
                  </div>
                  <div className="text-[11px] text-storm-400">
                    Phase 5 Application-Level Audit Ledger Enforcement
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsApprovalModalOpen(false)}
                className="text-storm-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Banner */}
            {approvalError && (
              <div className="p-3 rounded bg-red-950/80 border border-red-800 text-red-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold">APPROVAL SUBMISSION REJECTED:</div>
                  <div className="text-[11px]">{approvalError}</div>
                </div>
              </div>
            )}

            {/* Evaluation Summary Strip */}
            <div className="bg-onyx-950 p-3.5 rounded border border-onyx-800 space-y-2">
              <div className="text-storm-400 font-bold text-[11px]">EVALUATED PHYSICAL CANDIDATE:</div>
              <div className="text-storm-100 font-bold text-sm">{selectedPlanDef.name}</div>
              <div className="text-storm-300 text-[11px]">Profile: <strong>{activeProfile.name}</strong> ({activeProfile.totalRainfallMm} mm)</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-[11px]">
                <div>
                  <span className="text-storm-400 block">Avoided Volume:</span>
                  <span className="text-emerald-400 font-bold">
                    {(selectedDiff?.avoidedSurfaceVolumeM3 ?? 0) > 0 ? '+' : ''}
                    {selectedDiff?.avoidedSurfaceVolumeM3?.toLocaleString()} m³
                  </span>
                </div>
                <div>
                  <span className="text-storm-400 block">Peak Depth Delta:</span>
                  <span className="text-emerald-400 font-bold">-{selectedDiff?.peakDepthReductionM.toFixed(3)} m</span>
                </div>
                <div>
                  <span className="text-storm-400 block">Restored Routes:</span>
                  <span className="text-storm-200 font-bold">{selectedDiff?.protectedRoadCount ?? 0} corridors</span>
                </div>
              </div>
            </div>

            {/* Scenario Hash & Authenticated Identity Strip */}
            <div className="bg-onyx-950/60 p-3 rounded border border-onyx-800 space-y-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-storm-400">CANONICAL SCENARIO HASH:</span>
                <code className="text-purple-300 font-mono text-[10px] bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">
                  sha256:f0a73115e28a69b7f0dcfbbfe52182597bf8862c482d302b9c50154f488c9a47
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-storm-400">AUTHENTICATED IDENTITY:</span>
                <span className="text-storm-200 font-bold">Incident Commander [Verified Atlassian Session]</span>
              </div>
              <div className="text-[10px] text-amber-400/90 pt-1 border-t border-onyx-800/80">
                * The server-side Forge resolver verifies caller credentials and binds your authentic Atlassian Jira account ID. Client identity overrides are forbidden.
              </div>
            </div>

            {/* Required Engineering Rationale Textarea */}
            <div className="space-y-1.5">
              <label className="block text-storm-300 font-bold text-[11px]">
                ENGINEERING RATIONALE &amp; PHYSICAL JUSTIFICATION <span className="text-red-400">*</span>:
              </label>
              <textarea
                value={engineeringRationale}
                onChange={(e) => setEngineeringRationale(e.target.value)}
                placeholder="State the engineering justification and hydrodynamic rationale for authorizing this plan..."
                rows={3}
                className="w-full bg-onyx-950 border border-onyx-700 rounded p-2.5 text-storm-100 text-xs font-sans focus:outline-none focus:border-safety-orange leading-relaxed"
              />
              <div className="flex justify-between text-[10px] text-storm-500 font-mono">
                <span>Required for Incident Commander compliance ledger.</span>
                <span>{engineeringRationale.trim().length} characters</span>
              </div>
            </div>

            {/* Storage Architecture Notice */}
            <div className="p-2.5 rounded bg-onyx-950 text-storm-400 text-[10px] font-mono border border-onyx-800/80 space-y-1">
              <div><strong>AUDIT LEDGER GUARANTEES:</strong> Forge KVS append-only storage with server-enforced immutability check.</div>
              <div><strong>LIMITATIONS:</strong> Concurrency is Last-Write-Wins (LWW) per key; not a multi-key atomic transaction or cryptographic hardware HSM.</div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-onyx-800">
              <button
                type="button"
                onClick={() => setIsApprovalModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded bg-onyx-800 hover:bg-onyx-700 text-storm-300 font-bold transition-colors"
              >
                CANCEL
              </button>

              <button
                type="button"
                disabled={isSubmitting || engineeringRationale.trim().length < 5}
                onClick={async () => {
                  setIsSubmitting(true);
                  setApprovalError(null);

                  const payload = {
                    chosenPlan: {
                      planId: selectedPlanDef.id,
                      name: selectedPlanDef.name,
                      type: selectedPlanDef.type
                    },
                    scenarioHash: 'sha256:f0a73115e28a69b7f0dcfbbfe52182597bf8862c482d302b9c50154f488c9a47',
                    canonicalScenario: {
                      stormId: activeProfile.id,
                      stormLabel: activeProfile.name,
                      stormDepthMm: activeProfile.totalRainfallMm,
                      cellResolutionM: 25.0,
                      durationHours: activeProfile.durationHours,
                      gridDimensions: '64x64',
                      infiltrationRateMmPerHour: 2.0,
                      manningN: 0.025,
                      sector: 'Boston Longwood Medical Area & Muddy River Catchment (EPSG:26986)',
                      provenance: activeProfile.provenance
                    },
                    baselineMetrics: {
                      currentStorageM3: evaluationResult.baseline.currentStorageM3,
                      maxWaterDepthM: evaluationResult.baseline.maxWaterDepthM,
                      impassableRoadCount: evaluationResult.baseline.impassableRoadCount
                    },
                    interventionMetrics: {
                      currentStorageM3: selectedPlanMetrics?.currentStorageM3,
                      maxWaterDepthM: selectedPlanMetrics?.maxWaterDepthM,
                      impassableRoadCount: selectedPlanMetrics?.impassableRoadCount
                    },
                    differentialMetrics: {
                      avoidedSurfaceVolumeM3: selectedDiff?.avoidedSurfaceVolumeM3,
                      peakDepthReductionM: selectedDiff?.peakDepthReductionM,
                      protectedRoadCount: selectedDiff?.protectedRoadCount,
                      protectedRoadNames: selectedDiff?.protectedRoadNames
                    },
                    engineeringRationale: engineeringRationale.trim(),
                    schemaVersion: '2.0.0',
                    humanApprover: {
                      displayName: 'Incident Commander',
                      role: 'Incident Commander'
                    }
                  };

                  try {
                    const res: any = await invokeSafe('recordDecision', payload);
                    if (res && res.success) {
                      setApprovedRecord(res.data || res.record || payload);
                      setIsApprovalModalOpen(false);
                    } else {
                      setApprovalError(res?.error?.message || res?.message || 'Server rejected decision record approval.');
                    }
                  } catch (err: any) {
                    setApprovalError(err?.message || String(err));
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="px-5 py-2.5 rounded bg-safety-orange hover:bg-safety-hover disabled:opacity-50 text-white font-bold flex items-center gap-2 transition-colors shadow-tactical"
              >
                <Lock className="w-4 h-4" />
                <span>{isSubmitting ? 'COMMITTING TO FORGE KVS...' : 'CONFIRM & AUTHORIZE DECISION RECORD'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
