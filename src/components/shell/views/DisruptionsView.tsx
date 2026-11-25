import React, { useState, useMemo, useEffect, useTransition } from 'react';
import { 
  AlertOctagon, 
  RefreshCw, 
  CheckCircle2, 
  RotateCcw, 
  Sliders, 
  Sparkles,
  TrendingUp,
  Hospital,
  AlertTriangle,
  Layers
} from 'lucide-react';
import { loadBostonCatchment } from '../../../data/catchmentLoader';
import { 
  AUTHORITATIVE_DISRUPTIONS, 
  executeDisruptionRecalculation, 
  DisruptionRecalculationResult,
  DisruptionScenario
} from '../../../simulation/disruptionEngine';

export const DisruptionsView: React.FC = () => {
  const dataset = useMemo(() => loadBostonCatchment(), []);
  const [selectedDisruptionId, setSelectedDisruptionId] = useState<string>('disruption-brookline-culvert');
  const [isDisruptionActive, setIsDisruptionActive] = useState<boolean>(false);
  const [recalcResult, setRecalcResult] = useState<DisruptionRecalculationResult | null>(null);
  const [isComputing, setIsComputing] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  // Run solver recalculation when disruption is triggered
  useEffect(() => {
    if (!isDisruptionActive) {
      setRecalcResult(null);
      return;
    }

    setIsComputing(true);
    // Execute deterministic 2D recalculation in a transition
    const timer = setTimeout(() => {
      startTransition(() => {
        const result = executeDisruptionRecalculation(
          dataset,
          selectedDisruptionId,
          3600, // 1-hour storm propagation
          35.0  // 35 mm/h design burst
        );
        setRecalcResult(result);
        setIsComputing(false);
      });
    }, 50);

    return () => clearTimeout(timer);
  }, [dataset, isDisruptionActive, selectedDisruptionId]);

  const handleToggleDisruption = (disruption: DisruptionScenario) => {
    if (selectedDisruptionId === disruption.id && isDisruptionActive) {
      setIsDisruptionActive(false);
    } else {
      setSelectedDisruptionId(disruption.id);
      setIsDisruptionActive(true);
    }
  };

  const handleResetDisruptions = () => {
    setIsDisruptionActive(false);
    setRecalcResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-onyx-900 border-l-4 border-safety-orange p-4 rounded-r border-y border-r border-onyx-800 flex items-start gap-3">
        <AlertOctagon className="w-5 h-5 text-safety-orange flex-shrink-0 mt-0.5" />
        <div className="text-xs font-mono text-storm-300 space-y-1">
          <div className="font-bold text-storm-100 uppercase tracking-wider flex items-center gap-2">
            <span>DYNAMIC DISRUPTION & IN-FLIGHT REPLANNING // 2D HYDRODYNAMIC REACTOR</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-onyx-800 text-storm-300 border border-onyx-700">
              PHASE 2 OPERATIONAL
            </span>
          </div>
          <p className="text-storm-300 font-sans">
            Injecting physical mid-storm disruptions reruns the 2D diffusive-wave overland flow solver across the 64×64 Boston Longwood catchment. 
            When culverts clog or roads flood, DELTA recalculates flood propagation, evaluates emergency corridor passability, and derives causal replanning justifications.
          </p>
        </div>
      </div>

      {/* Disruption Control & Recalculation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Tactical Injections */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-lg text-storm-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-safety-orange" />
              <span>Authoritative Disruption Scenarios</span>
            </h3>

            {isDisruptionActive && (
              <button
                onClick={handleResetDisruptions}
                className="flex items-center gap-1.5 text-xs font-mono text-storm-400 hover:text-storm-200 bg-onyx-900 px-2.5 py-1 rounded border border-onyx-800 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>RESTORE NOMINAL BASELINE</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            {AUTHORITATIVE_DISRUPTIONS.map((d) => {
              const isSelected = selectedDisruptionId === d.id && isDisruptionActive;
              return (
                <div
                  key={d.id}
                  className={`p-5 rounded border transition-all ${
                    isSelected
                      ? 'bg-safety-muted border-safety-orange shadow-safety'
                      : 'bg-onyx-900 border-onyx-800 hover:border-onyx-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[10px] text-storm-400">
                      TARGET: {d.targetInletId} ([{d.gridCell[0]}, {d.gridCell[1]}])
                    </span>
                    <button
                      onClick={() => handleToggleDisruption(d)}
                      className={`font-mono text-xs px-3 py-1 rounded transition-colors ${
                        isSelected
                          ? 'bg-safety-orange text-white font-bold'
                          : 'bg-onyx-800 text-storm-300 hover:bg-onyx-700 border border-onyx-700'
                      }`}
                    >
                      {isSelected ? 'ACTIVE DISRUPTION' : 'INJECT DISRUPTION'}
                    </button>
                  </div>

                  <h4 className="font-display font-bold text-base text-storm-100 mb-1">
                    {d.name}
                  </h4>
                  <p className="text-xs text-storm-300 font-sans mb-3">{d.description}</p>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-onyx-950 p-2.5 rounded border border-onyx-800">
                    <div>
                      <span className="text-[10px] text-storm-500 block">NOMINAL CONVEYANCE</span>
                      <span className="text-storm-200 font-bold">{d.nominalCapacityM3PerSec.toFixed(1)} m³/s</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-storm-500 block">DISRUPTED CONVEYANCE</span>
                      <span className="text-safety-orange font-bold">
                        {d.effectiveCapacityM3PerSec.toFixed(1)} m³/s (-{Math.round(d.blockageRatio * 100)}%)
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Real-time Recomputed Impact Panel */}
        <div className="lg:col-span-6 bg-onyx-900 rounded border border-onyx-800 p-5 shadow-tactical flex flex-col justify-between font-mono text-xs space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-onyx-800 text-storm-400">
              <span className="font-bold text-storm-200 uppercase flex items-center gap-2">
                <Layers className="w-4 h-4 text-safety-orange" />
                <span>2D HYDRODYNAMIC RECALCULATION</span>
              </span>
              <span className={isDisruptionActive ? 'text-safety-orange font-bold animate-pulse' : 'text-emerald-400 font-bold'}>
                {isComputing ? 'SOLVER COMPUTING...' : isDisruptionActive ? 'DISRUPTION PROPAGATED' : 'BASELINE NOMINAL'}
              </span>
            </div>

            {!isDisruptionActive ? (
              <div className="p-10 text-center text-storm-500 font-sans space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500/40 mx-auto" />
                <div className="font-bold text-storm-200 text-sm">Nominal Baseline State Active</div>
                <p className="text-xs text-storm-400 max-w-md mx-auto">
                  All municipal culverts operating at 100% design capacity. Click <strong>INJECT DISRUPTION</strong> on any scenario to run the 2D hydraulic solver and observe physical backwater propagation and route replanning.
                </p>
              </div>
            ) : isComputing ? (
              <div className="p-12 text-center text-storm-400 font-mono space-y-3">
                <RefreshCw className="w-8 h-8 text-safety-orange animate-spin mx-auto" />
                <div className="font-bold text-storm-100">RUNNING 2D DIFFUSIVE-WAVE SOLVER</div>
                <div className="text-[11px] text-storm-500">
                  Advancing 3,600s storm across 64×64 grid with adaptive sub-stepping...
                </div>
              </div>
            ) : recalcResult ? (
              <div className="space-y-4 pt-3">
                {/* Physical Hydraulic Deltas */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <div className="bg-onyx-950 p-2.5 rounded border border-onyx-800">
                    <span className="text-[9px] text-storm-500 uppercase block font-bold">RETAINED SURFACE WATER</span>
                    <span className="text-safety-orange text-sm font-bold flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      +{recalcResult.delta.retainedWaterVolumeDeltaM3.toLocaleString()} m³
                    </span>
                  </div>

                  <div className="bg-onyx-950 p-2.5 rounded border border-onyx-800">
                    <span className="text-[9px] text-storm-500 uppercase block font-bold">CHOKE DEPTH DELTA</span>
                    <span className="text-amber-400 text-sm font-bold">
                      +{(recalcResult.delta.chokePointWaterDepthDeltaM * 100).toFixed(1)} cm
                    </span>
                  </div>

                  <div className="bg-onyx-950 p-2.5 rounded border border-onyx-800 col-span-2 md:col-span-1">
                    <span className="text-[9px] text-storm-500 uppercase block font-bold">NEW IMPASSABLE ROADS</span>
                    <span className={`text-sm font-bold ${recalcResult.delta.newlyImpassableRoads.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {recalcResult.delta.newlyImpassableRoads.length} Segment(s)
                    </span>
                  </div>
                </div>

                {/* Critical Hospital Access Re-evaluation */}
                <div className="bg-onyx-950 p-3.5 rounded border border-onyx-800 space-y-2">
                  <div className="flex items-center justify-between text-storm-300 font-bold text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <Hospital className="w-3.5 h-3.5 text-blue-400" />
                      <span>HOSPITAL ACCESS PERIMETERS</span>
                    </span>
                    <span className="text-storm-500 text-[10px]">THRESHOLD: 0.30m PASSABILITY</span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {recalcResult.disrupted.hospitals.map((h) => (
                      <div key={h.name} className="flex items-center justify-between text-[11px] py-1 border-b border-onyx-900 last:border-0">
                        <span className="text-storm-200">{h.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-storm-400 font-mono">{h.waterDepthM.toFixed(3)}m</span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            h.status === 'ISOLATED_INUNDATION'
                              ? 'bg-red-950 text-red-400 border border-red-800'
                              : h.status === 'CAUTION_PERIMETER_PONDING'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          }`}>
                            {h.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Physics-Derived Causal Explanation */}
                <div className="bg-onyx-950 p-3.5 rounded border border-safety-orange/40 space-y-2">
                  <div className="flex items-center gap-1.5 text-safety-orange font-bold text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>CAUSAL ENGINEERING JUSTIFICATION (PHYSICS-DERIVED)</span>
                  </div>
                  <p className="text-storm-200 font-sans text-xs leading-relaxed">
                    {recalcResult.causalExplanation}
                  </p>
                </div>

                {/* Rovo Replan Recommendation */}
                <div className="bg-purple-950/40 border border-purple-800/60 p-3.5 rounded space-y-2">
                  <div className="flex items-center gap-1.5 text-purple-300 font-bold text-[11px]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>ROVO IN-FLIGHT REPLAN RECOMMENDATION</span>
                  </div>
                  <div className="text-storm-100 font-bold text-xs">
                    {recalcResult.replanRecommendation.prioritizedIntervention}
                  </div>
                  <p className="text-storm-300 font-sans text-xs leading-relaxed">
                    {recalcResult.replanRecommendation.engineeringRationale}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="pt-3 border-t border-onyx-800 text-[10px] text-storm-500 flex items-center justify-between">
            <span>SOLVER: 2D DIFFUSIVE WAVE (EPSG:26986)</span>
            <span>MASS CONSERVATION &lt; 1e-10</span>
          </div>
        </div>
      </div>
    </div>
  );
};
