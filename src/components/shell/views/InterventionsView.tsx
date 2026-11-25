import React, { useState, useMemo, useEffect, useTransition } from 'react';
import { 
  BarChart3, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight,
  TrendingDown,
  Layers,
  RefreshCw,
  Waves,
  Info
} from 'lucide-react';
import { loadBostonCatchment } from '../../../data/catchmentLoader';
import { 
  AUTHORITATIVE_INTERVENTIONS, 
  executeMultiScenarioEvaluation, 
  MultiScenarioEvaluationResult,
  InterventionDefinition,
  HospitalImprovement
} from '../../../simulation/interventionEngine';

interface InterventionsViewProps {
  onNavigateToDecisions?: () => void;
}

export const InterventionsView: React.FC<InterventionsViewProps> = ({ onNavigateToDecisions }) => {
  const dataset = useMemo(() => loadBostonCatchment(), []);
  const [selectedPlanId, setSelectedPlanId] = useState<'plan-alpha' | 'plan-beta' | 'plan-gamma'>('plan-gamma');
  const [evaluationResult, setEvaluationResult] = useState<MultiScenarioEvaluationResult | null>(null);
  const [isRunningEvaluation, setIsRunningEvaluation] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  // Run solver evaluation across all 4 scenarios (Baseline + 3 Plans)
  const handleRunEvaluation = () => {
    setIsRunningEvaluation(true);
    const timer = setTimeout(() => {
      startTransition(() => {
        // Runs 1-hour storm progression at 35 mm/h design burst
        const result = executeMultiScenarioEvaluation(dataset, 1800, 35.0);
        setEvaluationResult(result);
        setIsRunningEvaluation(false);
      });
    }, 50);
    return () => clearTimeout(timer);
  };

  // Run automatically on first mount
  useEffect(() => {
    handleRunEvaluation();
  }, [dataset]);

  const selectedPlanDef: InterventionDefinition = AUTHORITATIVE_INTERVENTIONS[selectedPlanId];
  const selectedDiff = evaluationResult?.differentials[selectedPlanId];
  const selectedPlanMetrics = evaluationResult
    ? selectedPlanId === 'plan-alpha'
      ? evaluationResult.planAlpha
      : selectedPlanId === 'plan-beta'
      ? evaluationResult.planBeta
      : evaluationResult.planGamma
    : null;

  return (
    <div className="space-y-6">
      {/* Top Banner & Scientific Screening Notice */}
      <div className="bg-onyx-900 border-l-4 border-safety-orange p-4 rounded-r border-y border-r border-onyx-800 flex items-start gap-3">
        <Info className="w-5 h-5 text-safety-orange flex-shrink-0 mt-0.5" />
        <div className="text-xs font-mono text-storm-300 space-y-1">
          <div className="font-bold text-storm-100 uppercase tracking-wider flex items-center gap-2">
            <span>MULTI-SCENARIO INTERVENTION PLANNER // 2D DIFFUSIVE-WAVE SOLVER PIPELINE</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-onyx-800 text-storm-300 border border-onyx-700">
              PHASE 3 OPERATIONAL
            </span>
          </div>
          <p className="text-storm-300 font-sans">
            Every candidate intervention is simulated against an <strong>invariant baseline storm</strong> (NOAA Atlas 14 50-Year Design Burst) and identical initial conditions.
            Comparative metrics (avoided surface flood volume, peak depth reduction, protected road corridors) are derived strictly from 2D solver outputs.
          </p>
          <div className="text-[11px] text-amber-300 font-mono pt-1">
            * Screening simulation model results for municipal decision support. Not field-calibrated engineering survey predictions.
          </div>
        </div>
      </div>

      {/* Solver Execution Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-onyx-900 p-4 rounded border border-onyx-800 font-mono text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-onyx-950 border border-onyx-800 text-storm-300">
            <Waves className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="font-bold text-storm-100">INVARIANT BASELINE: 50-YEAR STORM (35 mm/h BURST, 1800s)</div>
            <div className="text-storm-400 text-[11px]">Catchment: Boston Longwood (EPSG:26986) • Choked Culvert Emergency</div>
          </div>
        </div>

        <button
          onClick={handleRunEvaluation}
          disabled={isRunningEvaluation}
          className="px-4 py-2 rounded bg-safety-orange hover:bg-safety-hover text-white font-bold flex items-center gap-2 transition-colors disabled:opacity-50 shadow-tactical"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRunningEvaluation ? 'animate-spin' : ''}`} />
          <span>{isRunningEvaluation ? 'SOLVER RUNNING (4 SCENARIOS)...' : 'RERUN COMPARATIVE SOLVER'}</span>
        </button>
      </div>

      {/* 4-Scenario Comparative Matrix Grid */}
      {evaluationResult ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* 1. Baseline */}
          <div className="bg-onyx-900 p-4 rounded border border-onyx-800 font-mono text-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-onyx-800">
              <span className="font-bold text-storm-300 uppercase">1. BASELINE</span>
              <span className="px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-800 text-[10px]">
                UNMITIGATED
              </span>
            </div>
            <div className="text-sm font-bold text-storm-100">Emergency Choked State</div>
            <div className="text-[11px] text-storm-400 font-sans">
              Brookline culvert blocked. No active interventions deployed.
            </div>

            <div className="space-y-1.5 pt-2 text-[11px]">
              <div className="flex justify-between text-storm-400">
                <span>SURFACE STORAGE:</span>
                <span className="text-storm-100 font-bold">{evaluationResult.baseline.currentStorageM3.toLocaleString()} m³</span>
              </div>
              <div className="flex justify-between text-storm-400">
                <span>MAX WATER DEPTH:</span>
                <span className="text-storm-100 font-bold">{evaluationResult.baseline.maxWaterDepthM.toFixed(3)} m</span>
              </div>
              <div className="flex justify-between text-storm-400">
                <span>IMPASSABLE ROADS:</span>
                <span className="text-red-400 font-bold">{evaluationResult.baseline.impassableRoadCount}</span>
              </div>
              <div className="flex justify-between text-storm-400">
                <span>AT-RISK HOSPITALS:</span>
                <span className="text-red-400 font-bold">{evaluationResult.baseline.atRiskHospitalCount}</span>
              </div>
            </div>
          </div>

          {/* 2. Plan Alpha */}
          <div 
            onClick={() => setSelectedPlanId('plan-alpha')}
            className={`p-4 rounded border cursor-pointer font-mono text-xs space-y-3 transition-all ${
              selectedPlanId === 'plan-alpha'
                ? 'bg-onyx-850 border-safety-orange shadow-safety'
                : 'bg-onyx-900 border-onyx-800 hover:border-onyx-700'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-onyx-800">
              <span className="font-bold text-storm-300 uppercase">2. PLAN ALPHA</span>
              <span className="px-1.5 py-0.5 rounded bg-onyx-800 text-storm-300 text-[10px]">
                DEFLECTION
              </span>
            </div>
            <div className="text-sm font-bold text-storm-100">Rapid Sandbag Barrier</div>
            <div className="text-[11px] text-storm-400 font-sans">
              +0.50m crest on Francis St curb perimeter.
            </div>

            <div className="space-y-1.5 pt-2 text-[11px]">
              <div className="flex justify-between text-storm-400">
                <span>AVOIDED STORAGE:</span>
                <span className="text-storm-200 font-bold">
                  {evaluationResult.differentials.planAlpha.avoidedSurfaceVolumeM3 > 0 ? '+' : ''}
                  {evaluationResult.differentials.planAlpha.avoidedSurfaceVolumeM3.toLocaleString()} m³
                </span>
              </div>
              <div className="flex justify-between text-storm-400">
                <span>PEAK DEPTH Δ:</span>
                <span className="text-storm-200 font-bold">
                  {evaluationResult.differentials.planAlpha.peakDepthReductionM.toFixed(3)} m
                </span>
              </div>
              <div className="flex justify-between text-storm-400">
                <span>ROADS PROTECTED:</span>
                <span className="text-emerald-400 font-bold">
                  {evaluationResult.differentials.planAlpha.protectedRoadCount}
                </span>
              </div>
              <div className="flex justify-between text-storm-400">
                <span>HOSPITAL IMPROVEMENTS:</span>
                <span className="text-storm-200 font-bold">
                  {evaluationResult.differentials.planAlpha.improvedHospitalCount}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Plan Beta */}
          <div 
            onClick={() => setSelectedPlanId('plan-beta')}
            className={`p-4 rounded border cursor-pointer font-mono text-xs space-y-3 transition-all ${
              selectedPlanId === 'plan-beta'
                ? 'bg-onyx-850 border-safety-orange shadow-safety'
                : 'bg-onyx-900 border-onyx-800 hover:border-onyx-700'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-onyx-800">
              <span className="font-bold text-storm-300 uppercase">3. PLAN BETA</span>
              <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 text-[10px]">
                ACTIVE PUMP
              </span>
            </div>
            <div className="text-sm font-bold text-storm-100">Mobile Pump #1</div>
            <div className="text-[11px] text-storm-400 font-sans">
              2.0 m³/s active suction sink in retention basin.
            </div>

            <div className="space-y-1.5 pt-2 text-[11px]">
              <div className="flex justify-between text-storm-400">
                <span>AVOIDED STORAGE:</span>
                <span className="text-safety-orange font-bold">
                  +{evaluationResult.differentials.planBeta.avoidedSurfaceVolumeM3.toLocaleString()} m³
                </span>
              </div>
              <div className="flex justify-between text-storm-400">
                <span>PEAK DEPTH Δ:</span>
                <span className="text-storm-200 font-bold">
                  {evaluationResult.differentials.planBeta.peakDepthReductionM.toFixed(3)} m
                </span>
              </div>
              <div className="flex justify-between text-storm-400">
                <span>ROADS PROTECTED:</span>
                <span className="text-emerald-400 font-bold">
                  {evaluationResult.differentials.planBeta.protectedRoadCount}
                </span>
              </div>
              <div className="flex justify-between text-storm-400">
                <span>HOSPITAL IMPROVEMENTS:</span>
                <span className="text-storm-200 font-bold">
                  {evaluationResult.differentials.planBeta.improvedHospitalCount}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Plan Gamma */}
          <div 
            onClick={() => setSelectedPlanId('plan-gamma')}
            className={`p-4 rounded border cursor-pointer font-mono text-xs space-y-3 transition-all ${
              selectedPlanId === 'plan-gamma'
                ? 'bg-onyx-850 border-safety-orange shadow-safety'
                : 'bg-onyx-900 border-onyx-800 hover:border-onyx-700'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-onyx-800">
              <span className="font-bold text-storm-300 uppercase">4. PLAN GAMMA</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px]">
                CULVERT JET
              </span>
            </div>
            <div className="text-sm font-bold text-storm-100">Culvert Jetting Truck</div>
            <div className="text-[11px] text-storm-400 font-sans">
              Restores Brookline culvert to 12.5 m³/s.
            </div>

            <div className="space-y-1.5 pt-2 text-[11px]">
              <div className="flex justify-between text-storm-400">
                <span>AVOIDED STORAGE:</span>
                <span className="text-emerald-400 font-bold">
                  +{evaluationResult.differentials.planGamma.avoidedSurfaceVolumeM3.toLocaleString()} m³
                </span>
              </div>
              <div className="flex justify-between text-storm-400">
                <span>PEAK DEPTH Δ:</span>
                <span className="text-storm-200 font-bold">
                  {evaluationResult.differentials.planGamma.peakDepthReductionM.toFixed(3)} m
                </span>
              </div>
              <div className="flex justify-between text-storm-400">
                <span>ROADS PROTECTED:</span>
                <span className="text-emerald-400 font-bold">
                  {evaluationResult.differentials.planGamma.protectedRoadCount}
                </span>
              </div>
              <div className="flex justify-between text-storm-400">
                <span>HOSPITAL IMPROVEMENTS:</span>
                <span className="text-storm-200 font-bold">
                  {evaluationResult.differentials.planGamma.improvedHospitalCount}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
                    {selectedPlanDef.physicalParameters.pumpCapacityM3PerSec.toFixed(1)} m³/s (Mass-Conserving Sink)
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
                    <span>+{selectedDiff.avoidedSurfaceVolumeM3.toLocaleString()} m³</span>
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

              {/* Protected Roads Callout */}
              <div className="bg-onyx-950 p-3.5 rounded border border-onyx-800 space-y-1.5">
                <div className="flex items-center justify-between text-storm-400 text-[11px]">
                  <span>PROTECTED CRITICAL CORRIDORS:</span>
                  <span className="text-emerald-400 font-bold">{selectedDiff.protectedRoadCount} Segments</span>
                </div>
                {selectedDiff.protectedRoadNames.length > 0 ? (
                  <div className="text-[11px] text-storm-300">
                    Restored to passable (&lt; 0.30m): {selectedDiff.protectedRoadNames.join(', ')}
                  </div>
                ) : (
                  <div className="text-[11px] text-storm-500">
                    No impassable corridors were restored below the 0.30m threshold under this configuration.
                  </div>
                )}
              </div>

              {/* Model Invariance & Ranking Summary */}
              <div className="bg-purple-950/40 border border-purple-800/60 p-3.5 rounded space-y-2">
                <div className="flex items-center gap-1.5 text-purple-300 font-bold text-[11px]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>MODEL RANKING & RECOMMENDATION</span>
                </div>
                <div className="text-storm-100 font-bold text-xs">
                  {selectedPlanId === evaluationResult.ranking.recommendedPlanId ? 'RECOMMENDED OPTION: ' : 'ALTERNATIVE OPTION: '}
                  {selectedPlanDef.name}
                </div>
                <p className="text-storm-300 font-sans text-xs leading-relaxed">
                  {evaluationResult.ranking.recommendationRationale}
                </p>
              </div>
            </div>

            {/* Action Button: Navigate to Decision Governance (Phase 4 bridge) */}
            <div className="pt-4 border-t border-onyx-800 space-y-2">
              <button
                onClick={onNavigateToDecisions}
                className="w-full flex items-center justify-center gap-2 bg-safety-orange hover:bg-safety-hover text-white font-mono text-xs font-bold py-3 px-4 rounded transition-colors shadow-tactical"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>SELECT {selectedPlanDef.id.toUpperCase()} FOR INCIDENT COMMANDER REVIEW</span>
              </button>
              <div className="text-[10px] text-storm-500 text-center font-mono">
                Advances selected physical plan metrics to immutable Decision Record governance.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
