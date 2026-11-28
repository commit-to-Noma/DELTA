/**
 * DELTA Stage 02: Simulation & Disruption Workspace
 *
 * Map-first operational stage unifying:
 * 1. Spatial Disruption Replanning: Toggle real drainage disruptions (Brookline Culvert,
 *    Fenway Choke, Longwood Sump) under the shared active rainfall profile and inspect
 *    genuine 2D solver depth changes, inlet drainage losses, and road screening changes.
 * 2. Live Hydraulic Progression: Step-by-step interactive 2D diffusive-wave playback
 *    under the exact same active rainfall profile and disruption configuration.
 *
 * Every rainfall or disruption change updates shared IncidentWorkspaceContext so
 * Stage 03 (Intervention Planning) and Stage 04 (Decision & Briefing) stay strictly synchronized.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  StepForward,
  AlertOctagon,
  ArrowRight,
  RefreshCw,
  Droplets,
  Save,
  ChevronDown,
  ChevronUp,
  Activity,
  CloudRain,
  CheckCircle2,
  Route,
  Hospital
} from 'lucide-react';
import { invokeSafe as invoke } from '../../../services/forgeBridge';
import { createHydraulicConfigFromCatchment } from '../../../data/catchmentLoader';
import {
  createHydraulicState,
  stepHydraulics,
  SimulationState
} from '../../../simulation/hydraulicSolver';
import { AUTHORITATIVE_DISRUPTIONS } from '../../../simulation/disruptionEngine';
import {
  AUTHORITATIVE_STRESS_PROFILES,
  getRainfallRateAtElapsed
} from '../../../simulation/interventionEngine';
import { useIncidentWorkspace } from '../../../context/IncidentWorkspaceContext';
import {
  GeographicSimulationCanvas,
  CellHoverInfo
} from '../../simulation/GeographicSimulationCanvas';
import { CanvasLayerDock } from '../../simulation/CanvasLayerDock';

export const FloodSimulationView: React.FC = () => {
  const {
    dataset,
    setActiveStage,
    activeProfileId,
    activeProfile,
    setActiveProfileId,
    activeDisruptionIds,
    activeDisruptions,
    toggleDisruption,
    clearAllDisruptions,
    disruptionComparison,
    isComputingDisruption,
    ensureDisruptionComparison,
    workOrders,
    canvasLayers,
    toggleCanvasLayer,
    selectedCell,
    setSelectedCell,
    selectedRoadId,
    setSelectedRoadId,
    selectedFacilityId,
    setSelectedFacilityId,
    customActions, addCustomAction, removeCustomAction, undoCustomAction, clearCustomActions,
    sandboxRainfallScale, setSandboxRainfallScale, sandboxResult, isComputingSandbox, resetGoldenJourney
  } = useIncidentWorkspace();
  const [sandboxEnabled, setSandboxEnabled] = useState(false);
  const [sandboxTool, setSandboxTool] = useState<'PUMP' | 'BARRIER' | 'BLOCKAGE'>('PUMP');
  const [sandboxStrength, setSandboxStrength] = useState(2);

  const { nx, ny } = dataset.metadata.grid;

  // Stage 02 sub-mode: Full-Scenario Spatial Disruption Analysis vs. Live Step-by-Step Progression
  const [stageMode, setStageMode] = useState<'disruption-analysis' | 'live-playback'>('disruption-analysis');
  const [mapDisplayMode, setMapDisplayMode] = useState<'standard' | 'delta'>('standard');
  const [hoveredCell, setHoveredCell] = useState<CellHoverInfo | null>(null);
  const [clickedCell, setClickedCell] = useState<CellHoverInfo | null>(null);
  const [showEngineeringDrawer, setShowEngineeringDrawer] = useState<boolean>(false);

  // Live Progression Playback State (strictly bound to activeProfile + activeDisruptionIds)
  const liveHydraulicConfig = useMemo(() => {
    const cfg = createHydraulicConfigFromCatchment(dataset, {
      manningN: 0.025,
      defaultInfiltrationMmPerHour: 2.0,
      openBoundaries: 'muddy_river_outlet'
    });
    if (cfg.drainageInlets && activeDisruptions.length > 0) {
      cfg.drainageInlets = cfg.drainageInlets.map((inlet) => {
        const matched = activeDisruptions.find(
          (d) => d.gridCell[0] * nx + d.gridCell[1] === inlet.index || d.targetInletId === inlet.inletId
        );
        return matched ? { ...inlet, blockageRatio: matched.blockageRatio } : { ...inlet };
      });
    }
    return cfg;
  }, [dataset, activeDisruptions, nx]);

  const [simState, setSimState] = useState<SimulationState>(() => createHydraulicState(liveHydraulicConfig));
  const simStateRef = useRef<SimulationState>(simState);
  simStateRef.current = simState;

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(2);
  const [saveTelemetryStatus, setSaveTelemetryStatus] = useState<string | null>(null);

  // Reset live playback cleanly whenever active profile or disruption configuration changes
  useEffect(() => {
    setIsPlaying(false);
    const fresh = createHydraulicState(liveHydraulicConfig);
    setSimState(fresh);
    simStateRef.current = fresh;
  }, [liveHydraulicConfig, activeProfileId]);

  // Ensure spatial disruption comparison is computed
  useEffect(() => {
    ensureDisruptionComparison();
  }, [ensureDisruptionComparison]);

  const advanceSimulation = useCallback(
    (steps: number = 1) => {
      let state = simStateRef.current;
      for (let i = 0; i < steps; i++) {
        if (state.totalTimeSeconds >= activeProfile.durationSeconds) {
          setIsPlaying(false);
          break;
        }
        const rate = getRainfallRateAtElapsed(activeProfile, state.totalTimeSeconds);
        state = stepHydraulics(state, {
          dtMacroSeconds: 10.0,
          rainfallRateMmPerHour: rate
        });
      }
      setSimState(state);
    },
    [activeProfile]
  );

  useEffect(() => {
    if (!isPlaying || stageMode !== 'live-playback') return;
    const interval = setInterval(() => {
      advanceSimulation(playbackSpeed);
    }, 80);
    return () => clearInterval(interval);
  }, [isPlaying, stageMode, playbackSpeed, advanceSimulation]);

  const handleResetPlayback = () => {
    setIsPlaying(false);
    setSimState(createHydraulicState(liveHydraulicConfig));
  };

  const handleSaveSnapshot = async () => {
    setSaveTelemetryStatus('Saving...');
    try {
      const activeDepth =
        stageMode === 'disruption-analysis' && disruptionComparison
          ? disruptionComparison.disrupted.waterDepth
          : simState.waterDepth;
      let peak = 0;
      for (let i = 0; i < activeDepth.length; i++) {
        if (activeDepth[i] > peak) peak = activeDepth[i];
      }
      const res: any = await invoke('saveSimulationSnapshot', {
        profileId: activeProfile.id,
        activeDisruptionIds,
        elapsedSeconds:
          stageMode === 'disruption-analysis'
            ? activeProfile.durationSeconds
            : simState.totalTimeSeconds,
        peakDepthM: Math.round(peak * 1000) / 1000,
        currentStorageM3:
          stageMode === 'disruption-analysis' && disruptionComparison
            ? disruptionComparison.disrupted.currentStorageM3
            : Math.round(simState.accounting.currentStorageM3),
        timestamp: new Date().toISOString()
      });
      setSaveTelemetryStatus(res?.success ? 'Snapshot saved' : 'Saved locally');
    } catch {
      setSaveTelemetryStatus('Saved locally');
    }
    setTimeout(() => setSaveTelemetryStatus(null), 2500);
  };

  // Water arrays bound to the canvas
  const zeroDepth = useMemo(() => new Float64Array(nx * ny), [nx, ny]);
  const canvasWaterDepth =
    sandboxEnabled && sandboxResult
      ? sandboxResult.custom.waterDepth
      : stageMode === 'disruption-analysis'
      ? disruptionComparison?.disrupted.waterDepth ?? zeroDepth
      : simState.waterDepth;

  // In Disruption Analysis Delta mode, pass nominal unobstructed depth as baseline:
  // delta = h_nominal - h_disrupted -> negative values show water depth INCREASE caused by disruption!
  const canvasBaselineDepth =
    stageMode === 'disruption-analysis' && disruptionComparison
      ? disruptionComparison.nominal.waterDepth
      : null;

  const effectiveCanvasViewMode: 'standard' | 'delta' =
    stageMode === 'disruption-analysis' ? mapDisplayMode : 'standard';

  const inspectorCell = hoveredCell || clickedCell;

  // Compute live peak depth when in playback mode
  const livePeakDepthM = useMemo(() => {
    let maxD = 0;
    for (let i = 0; i < simState.waterDepth.length; i++) {
      if (simState.waterDepth[i] > maxD) maxD = simState.waterDepth[i];
    }
    return maxD;
  }, [simState.waterDepth]);

  const currentLiveRate = getRainfallRateAtElapsed(activeProfile, simState.totalTimeSeconds);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Compact Command Controls Bar */}
      <div className="bg-onyx-900 border border-onyx-800 rounded px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Mode Switch */}
          <div className="inline-flex bg-onyx-950 border border-onyx-800 rounded p-0.5 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setStageMode('disruption-analysis');
              }}
              className={`px-2.5 py-1 rounded transition-colors ${
                stageMode === 'disruption-analysis'
                  ? 'bg-onyx-800 text-white font-bold'
                  : 'text-storm-400 hover:text-storm-200'
              }`}
            >
              Spatial Disruption Replanning
            </button>
            <button
              type="button"
              onClick={() => setStageMode('live-playback')}
              className={`px-2.5 py-1 rounded transition-colors ${
                stageMode === 'live-playback'
                  ? 'bg-onyx-800 text-white font-bold'
                  : 'text-storm-400 hover:text-storm-200'
              }`}
            >
              Live Solver Progression
            </button>
          </div>

          {/* Synchronized Rainfall Profile Selector */}
          <div className="flex items-center gap-1.5">
            <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
            <select
              aria-label="Active storm profile"
              value={activeProfileId}
              onChange={(e) => setActiveProfileId(e.target.value)}
              className="bg-onyx-950 border border-onyx-700 rounded px-2 py-1 text-[11px] font-mono text-storm-100 focus:outline-none focus:border-safety-orange max-w-[270px]"
            >
              {Object.values(AUTHORITATIVE_STRESS_PROFILES).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveSnapshot}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-onyx-950 hover:bg-onyx-800 border border-onyx-700 text-[11px] font-mono text-storm-200 transition-colors"
          >
            <Save className="w-3.5 h-3.5 text-storm-400" />
            <span>{saveTelemetryStatus || 'Save Snapshot'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStage('interventions')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-safety-orange hover:bg-orange-600 text-white text-xs font-mono font-bold transition-colors"
          >
            <span>Compare Interventions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Map-First Operational Split (8 / 12 Dominant Map + 4 / 12 Disruption & Inspector Rail) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 flex-1 min-h-0">
        {/* Dominant Geospatial Map Viewport */}
        <div className="xl:col-span-8 flex flex-col gap-2 bg-onyx-900 border border-onyx-800 rounded p-2.5 min-h-[540px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CanvasLayerDock
              activeLayers={canvasLayers}
              onToggleLayer={toggleCanvasLayer}
              compact
            />

            {stageMode === 'disruption-analysis' ? (
              <div className="inline-flex bg-onyx-950 border border-onyx-800 rounded p-0.5 text-[10px] font-mono">
                <button
                  type="button"
                  onClick={() => setMapDisplayMode('standard')}
                  className={`px-2 py-0.5 rounded ${
                    mapDisplayMode === 'standard'
                      ? 'bg-cyan-950/90 text-cyan-200 font-bold border border-cyan-700/60'
                      : 'text-storm-400 hover:text-storm-200'
                  }`}
                >
                  Disrupted Depth
                </button>
                <button
                  type="button"
                  onClick={() => setMapDisplayMode('delta')}
                  className={`px-2 py-0.5 rounded ${
                    mapDisplayMode === 'delta'
                      ? 'bg-amber-950/90 text-amber-200 font-bold border border-amber-700/60'
                      : 'text-storm-400 hover:text-storm-200'
                  }`}
                >
                  Nominal vs Disrupted Δh
                </button>
              </div>
            ) : (
              /* Compact Live Playback Transport Bar */
              <div className="flex items-center gap-1.5 bg-onyx-950 border border-onyx-800 rounded px-2 py-1 text-[10px] font-mono">
                <button
                  type="button"
                  onClick={() => setIsPlaying((p) => !p)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold ${
                    isPlaying
                      ? 'bg-amber-600 text-white'
                      : 'bg-emerald-700 hover:bg-emerald-600 text-white'
                  }`}
                >
                  {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => advanceSimulation(1)}
                  className="p-1 rounded bg-onyx-800 hover:bg-onyx-700 text-storm-200"
                  title="Step +10s"
                >
                  <StepForward className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={handleResetPlayback}
                  className="p-1 rounded bg-onyx-800 hover:bg-onyx-700 text-storm-200"
                  title="Reset simulation"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
                <select
                  aria-label="Playback speed"
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                  className="bg-onyx-900 border border-onyx-700 rounded px-1.5 py-0.5 text-[10px] text-storm-200"
                >
                  <option value={1}>1x</option>
                  <option value={2}>2x</option>
                  <option value={5}>5x</option>
                </select>
                <span className="text-cyan-300 pl-1">
                  T+{Math.round(simState.totalTimeSeconds)}s / {activeProfile.durationSeconds}s
                </span>
                <span className="text-storm-400">({currentLiveRate.toFixed(1)} mm/h)</span>
              </div>
            )}
          </div>

          {/* Interactive Geospatial Canvas */}
          <div className="relative flex-1 min-h-[450px] bg-onyx-950 rounded border border-onyx-800 overflow-hidden">
            {stageMode === 'disruption-analysis' && isComputingDisruption && (
              <div className="absolute inset-0 z-20 bg-onyx-950/75 flex items-center justify-center">
                <div className="bg-onyx-900 border border-onyx-700 rounded px-4 py-3 flex items-center gap-2.5 text-xs font-mono text-cyan-300">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Recalculating 2D hydraulic solver — first run for a setup can take about a minute; results are cached after that...</span>
                </div>
              </div>
            )}

            <GeographicSimulationCanvas
              dataset={dataset}
              waterDepth={canvasWaterDepth}
              baselineWaterDepth={canvasBaselineDepth}
              viewMode={effectiveCanvasViewMode}
              activeLayers={canvasLayers}
              selectedCell={selectedCell}
              selectedRoadId={selectedRoadId}
              selectedFacilityId={selectedFacilityId}
              stagedWorkOrders={workOrders}
              customActions={customActions}
              onCellHover={setHoveredCell}
              onCellClick={(info) => {
                setClickedCell(info);
                setSelectedCell({ row: info.row, col: info.col });
                if (sandboxEnabled) addCustomAction({ id: `custom-${sandboxTool.toLowerCase()}-${info.row}-${info.col}`, row: info.row, col: info.col, type: sandboxTool, strength: sandboxStrength });
              }}
              onSelectFacility={(fac) => setSelectedFacilityId(fac ? fac.facilityId : null)}
              onSelectRoad={(road) => setSelectedRoadId(road ? road.roadId : null)}
            />

            {/* Bottom-Left Floating Cell Telemetry */}
            <div className="absolute bottom-2 left-2 bg-onyx-950/92 border border-onyx-800 rounded px-2.5 py-1.5 text-[10px] font-mono text-storm-200 pointer-events-none max-w-[68%]">
              {inspectorCell ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span className="text-safety-orange font-bold">
                    [{inspectorCell.row}, {inspectorCell.col}]
                  </span>
                  <span>Elev: {inspectorCell.elevationM.toFixed(2)}m</span>
                  <span className="text-cyan-300 font-semibold">
                    Depth: {(inspectorCell.waterDepthM * 100).toFixed(1)} cm
                  </span>
                  {stageMode === 'disruption-analysis' && inspectorCell.deltaWaterDepthM !== undefined && (
                    <span
                      className={
                        inspectorCell.deltaWaterDepthM < -0.005
                          ? 'text-amber-300 font-bold'
                          : inspectorCell.deltaWaterDepthM > 0.005
                          ? 'text-emerald-300 font-bold'
                          : 'text-storm-400'
                      }
                    >
                      {inspectorCell.deltaWaterDepthM < -0.005
                        ? `Disruption Rise: +${(Math.abs(inspectorCell.deltaWaterDepthM) * 100).toFixed(1)} cm`
                        : inspectorCell.deltaWaterDepthM > 0.005
                        ? `Drawdown: -${(inspectorCell.deltaWaterDepthM * 100).toFixed(1)} cm`
                        : 'Δ 0.0 cm'}
                    </span>
                  )}
                  {inspectorCell.roadName && <span className="text-white">{inspectorCell.roadName}</span>}
                  {inspectorCell.facility && <span className="text-cyan-200">{inspectorCell.facility.name}</span>}
                  {inspectorCell.drainageInlet && (
                    <span className="text-safety-orange">{inspectorCell.drainageInlet.inletId}</span>
                  )}
                </div>
              ) : (
                <span className="text-storm-400">
                  Inspect any grid cell, drainage inlet, road corridor, or medical campus on the map.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Contextual Disruption Controls & Telemetry Rail */}
        <div className="xl:col-span-4 flex flex-col gap-3 overflow-y-auto pr-0.5">
          <div className="bg-onyx-900 border border-cyan-800/60 rounded p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-white">Click-Anywhere Sandbox</span>
              <button type="button" onClick={() => setSandboxEnabled(v => !v)} aria-pressed={sandboxEnabled} className={`px-2 py-1 rounded text-[10px] font-mono font-bold ${sandboxEnabled ? 'bg-cyan-600 text-white' : 'bg-onyx-800 text-storm-300'}`}>{sandboxEnabled ? 'ON — click map' : 'OFF'}</button>
            </div>
            <p className="text-[11px] text-storm-400 leading-snug">Golden Journey stays 1-click above. Turn sandbox ON, pick a tool, then click any map cell. Pump = point sink, barrier = raised cells, blockage = raised impermeable block (screening representations).</p>
            <div className="flex gap-1.5" role="group" aria-label="Sandbox tool">
              {(['PUMP', 'BARRIER', 'BLOCKAGE'] as const).map(t => (
                <button key={t} type="button" onClick={() => { setSandboxTool(t); setSandboxStrength(t === 'PUMP' ? 2 : t === 'BARRIER' ? 0.5 : 0.4); }} className={`px-2 py-1 rounded text-[10px] font-mono ${sandboxTool === t ? 'bg-safety-orange text-white font-bold' : 'bg-onyx-950 text-storm-300 border border-onyx-700'}`}>{t}</button>
              ))}
            </div>
            <label className="block text-[10px] font-mono text-storm-400">Strength: {sandboxStrength} <input type="range" min={sandboxTool === 'PUMP' ? 0.5 : 0.2} max={sandboxTool === 'PUMP' ? 4 : sandboxTool === 'BARRIER' ? 1 : 0.6} step={0.1} value={sandboxStrength} onChange={e => setSandboxStrength(Number(e.target.value))} className="w-full" aria-label="Sandbox strength" /></label>
            <label className="block text-[10px] font-mono text-storm-400">Rainfall ×{sandboxRainfallScale.toFixed(1)} <input type="range" min={0.5} max={1.5} step={0.1} value={sandboxRainfallScale} onChange={e => setSandboxRainfallScale(Number(e.target.value))} className="w-full" aria-label="Sandbox rainfall scale" /></label>
            {customActions.length > 0 && <div className="space-y-1">{customActions.map(a => <div key={a.id} className="flex justify-between text-[10px] font-mono bg-onyx-950 rounded px-2 py-1"><span>{a.type} [{a.row},{a.col}] · {a.strength}</span><button type="button" onClick={() => removeCustomAction(a.id)} className="text-red-300">Remove</button></div>)}</div>}
            <div className="flex gap-2 text-[10px] font-mono">
              <button type="button" onClick={undoCustomAction} className="underline text-storm-300">Undo</button>
              <button type="button" onClick={clearCustomActions} className="underline text-storm-300">Clear sandbox</button>
              <button type="button" onClick={resetGoldenJourney} className="underline text-cyan-300">Reset Golden Journey</button>
            </div>
            <div className="text-[11px] font-mono text-cyan-200" role="status">{isComputingSandbox ? 'Sandbox recalculating on the 2D solver (can take about a minute first time)…' : sandboxResult ? sandboxResult.summary : 'No sandbox result yet.'}</div>
          </div>
          {/* 1. Physical Drainage Disruption Configuration (Synchronized across entire app) */}
          <div className="bg-onyx-900 border border-onyx-800 rounded p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                <AlertOctagon className="w-3.5 h-3.5 text-safety-orange" />
                Drainage Disruptions ({activeDisruptionIds.length})
              </span>
              {activeDisruptionIds.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllDisruptions}
                  className="text-[10px] font-mono text-storm-400 hover:text-white underline"
                >
                  Clear to Nominal
                </button>
              )}
            </div>

            <p className="text-[11px] text-storm-400 leading-snug">
              Toggling a disruption reruns the 2D hydraulic solver and automatically propagates to Intervention Planning and Decision Briefing.
            </p>

            <div className="space-y-1.5">
              {AUTHORITATIVE_DISRUPTIONS.map((d) => {
                const isActive = activeDisruptionIds.includes(d.id);
                const inletDelta = disruptionComparison?.affectedInletMetrics.find(
                  (m) => m.disruptionId === d.id
                );
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDisruption(d.id)}
                    aria-pressed={isActive}
                    className={`w-full text-left p-2.5 rounded border transition-colors ${
                      isActive
                        ? 'bg-safety-orange/12 border-safety-orange text-white'
                        : 'bg-onyx-950 border-onyx-800 text-storm-300 hover:border-onyx-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                      <span className="font-bold flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isActive ? 'bg-safety-orange' : 'bg-storm-600'
                          }`}
                        />
                        {d.targetInletId}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          isActive
                            ? 'bg-safety-orange/25 text-safety-orange'
                            : 'bg-onyx-900 text-storm-500'
                        }`}
                      >
                        {isActive ? `${Math.round(d.blockageRatio * 100)}% BLOCKED` : 'NOMINAL'}
                      </span>
                    </div>
                    <div className="text-[11px] text-storm-300 mt-1">{d.name}</div>
                    <div className="text-[10px] font-mono text-storm-400 mt-1 flex flex-wrap gap-x-2">
                      <span>Cell [{d.gridCell[0]}, {d.gridCell[1]}]</span>
                      <span>
                        Cap: {d.nominalCapacityM3PerSec} → {isActive ? d.effectiveCapacityM3PerSec : d.nominalCapacityM3PerSec} m³/s
                      </span>
                      {inletDelta && (
                        <span className="text-amber-300 font-semibold">
                          Δh: {inletDelta.depthChangeM >= 0 ? '+' : ''}
                          {(inletDelta.depthChangeM * 100).toFixed(1)}cm · -{inletDelta.drainageLossM3.toLocaleString()} m³
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Computed Solver Impact Summary */}
          {stageMode === 'disruption-analysis' && disruptionComparison ? (
            <div className="bg-onyx-900 border border-onyx-800 rounded p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-storm-200 flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                  Solver Impact vs. Nominal
                </span>
                <span className="text-[10px] font-mono text-storm-400">
                  Δt={disruptionComparison.dtMacroSeconds}s
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="bg-onyx-950 border border-onyx-800 rounded p-2">
                  <span className="text-[9px] text-storm-400 uppercase block">Surface Storage Δ</span>
                  <span
                    className={`text-sm font-bold ${
                      disruptionComparison.delta.retainedWaterVolumeDeltaM3 > 0
                        ? 'text-amber-300'
                        : 'text-emerald-300'
                    }`}
                  >
                    {disruptionComparison.delta.retainedWaterVolumeDeltaM3 >= 0 ? '+' : ''}
                    {disruptionComparison.delta.retainedWaterVolumeDeltaM3.toLocaleString()} m³
                  </span>
                </div>
                <div className="bg-onyx-950 border border-onyx-800 rounded p-2">
                  <span className="text-[9px] text-storm-400 uppercase block">Lost Inlet Drainage</span>
                  <span className="text-sm font-bold text-safety-orange">
                    {disruptionComparison.delta.lostDrainageVolumeM3.toLocaleString()} m³
                  </span>
                </div>
                <div className="bg-onyx-950 border border-onyx-800 rounded p-2">
                  <span className="text-[9px] text-storm-400 uppercase block">Adverse Rise (≥1cm)</span>
                  <span className="text-sm font-bold text-amber-300">
                    {disruptionComparison.delta.adverseCellCount} cells (+{(disruptionComparison.delta.peakAdverseDepthRiseM * 100).toFixed(1)}cm)
                  </span>
                </div>
                <div className="bg-onyx-950 border border-onyx-800 rounded p-2">
                  <span className="text-[9px] text-storm-400 uppercase block">Beneficial Drop (≥1cm)</span>
                  <span className="text-sm font-bold text-emerald-300">
                    {disruptionComparison.delta.beneficialCellCount} cells (-{(disruptionComparison.delta.peakBeneficialDrawdownM * 100).toFixed(1)}cm)
                  </span>
                </div>
              </div>

              {/* Road & Hospital Screening Changes */}
              <div className="space-y-1.5 pt-2 border-t border-onyx-800 text-[11px]">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-storm-400 flex items-center gap-1">
                    <Route className="w-3 h-3" />
                    Roads ≥30cm (Screening):
                  </span>
                  <span className="text-white font-bold">
                    {disruptionComparison.nominal.impassableRoadCount} → {disruptionComparison.disrupted.impassableRoadCount}
                    {disruptionComparison.delta.newlyImpassableRoads.length > 0 && (
                      <span className="text-red-400 ml-1">
                        (+{disruptionComparison.delta.newlyImpassableRoads.length} new)
                      </span>
                    )}
                  </span>
                </div>

                {disruptionComparison.delta.newlyImpassableRoads.length > 0 && (
                  <div className="text-[10px] font-mono text-red-300 bg-red-950/30 border border-red-900/50 rounded px-2 py-1">
                    Newly ≥30cm: {disruptionComparison.delta.newlyImpassableRoads.map((r) => r.name).join(', ')}
                  </div>
                )}

                <div className="flex items-center justify-between font-mono">
                  <span className="text-storm-400 flex items-center gap-1">
                    <Hospital className="w-3 h-3" />
                    Hospitals Screened At-Risk:
                  </span>
                  <span className="text-white font-bold">
                    {disruptionComparison.nominal.atRiskHospitalCount} → {disruptionComparison.disrupted.atRiskHospitalCount} / 5
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-storm-300 leading-relaxed pt-1 border-t border-onyx-800">
                {disruptionComparison.causalSummary}
              </p>
            </div>
          ) : stageMode === 'live-playback' ? (
            <div className="bg-onyx-900 border border-onyx-800 rounded p-3.5 space-y-2 text-[11px] font-mono">
              <div className="flex items-center justify-between text-storm-200 font-bold uppercase">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  Live Progression Telemetry
                </span>
                <span className="text-cyan-300">T+{Math.round(simState.totalTimeSeconds)}s</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-onyx-950 border border-onyx-800 rounded p-2">
                  <span className="text-[9px] text-storm-400 uppercase block">Surface Storage</span>
                  <span className="text-white font-bold">
                    {Math.round(simState.accounting.currentStorageM3).toLocaleString()} m³
                  </span>
                </div>
                <div className="bg-onyx-950 border border-onyx-800 rounded p-2">
                  <span className="text-[9px] text-storm-400 uppercase block">Peak Depth</span>
                  <span className="text-cyan-300 font-bold">{(livePeakDepthM * 100).toFixed(1)} cm</span>
                </div>
                <div className="bg-onyx-950 border border-onyx-800 rounded p-2">
                  <span className="text-[9px] text-storm-400 uppercase block">Cumulative Rain</span>
                  <span className="text-storm-200 font-bold">
                    {Math.round(simState.accounting.cumulativeRainfallM3).toLocaleString()} m³
                  </span>
                </div>
                <div className="bg-onyx-950 border border-onyx-800 rounded p-2">
                  <span className="text-[9px] text-storm-400 uppercase block">Inlet Drainage</span>
                  <span className="text-emerald-300 font-bold">
                    {Math.round(simState.accounting.cumulativeDrainageM3).toLocaleString()} m³
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {/* 3. Selected Asset Inspector */}
          {inspectorCell && (inspectorCell.hospitalExposure || inspectorCell.roadCorridor) && (
            <div className="bg-onyx-900 border border-onyx-800 rounded p-3.5 space-y-2 text-[11px]">
              <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-safety-orange">
                Contextual Asset Inspector
              </div>
              {inspectorCell.hospitalExposure && (
                <div className="space-y-1">
                  <div className="font-bold text-white">{inspectorCell.hospitalExposure.facility.name}</div>
                  <div className="text-storm-300">{inspectorCell.hospitalExposure.summaryText}</div>
                </div>
              )}
              {inspectorCell.roadCorridor && (
                <div className="space-y-1">
                  <div className="font-bold text-white">{inspectorCell.roadCorridor.road.name}</div>
                  <div className="font-mono text-[10px] text-storm-300">
                    Max Depth: {(inspectorCell.roadCorridor.maxDepthM * 100).toFixed(1)} cm · Screening Tier:{' '}
                    <span className="font-bold text-amber-300">{inspectorCell.roadCorridor.passability}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. Collapsible Mass Balance & Disclosures Drawer */}
          <div className="bg-onyx-900 border border-onyx-800 rounded">
            <button
              type="button"
              onClick={() => setShowEngineeringDrawer((v) => !v)}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-[11px] font-mono text-storm-300 hover:text-white"
            >
              <span className="flex items-center gap-1.5 uppercase tracking-wider font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Mass Balance &amp; Solver Disclosures
              </span>
              {showEngineeringDrawer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showEngineeringDrawer && (
              <div className="px-3.5 pb-3 pt-1 border-t border-onyx-800 space-y-1.5 text-[11px] text-storm-300">
                <div className="font-mono text-[10px] text-emerald-300">
                  Mass Conservation Relative Error:{' '}
                  {(
                    (stageMode === 'disruption-analysis' && disruptionComparison
                      ? disruptionComparison.disrupted.relativeConservationError
                      : simState.accounting.relativeError) * 100
                  ).toExponential(2)}
                  %
                </div>
                <p>
                  All depth maps and disruption deltas originate strictly from the 2D diffusive-wave overland flow solver on the 25m USGS DEM grid.
                </p>
                <p>
                  CULVERT-01-BROOKLINE is represented as an unrouted road-deck point sink on cell [17, 26] (12.5 m³/s heuristic); results are screening outputs, not field-verified conveyance curves.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
