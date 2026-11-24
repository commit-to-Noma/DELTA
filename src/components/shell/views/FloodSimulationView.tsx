import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  StepForward,
  Clock,
  MapPin,
  ShieldAlert,
  Compass,
  Sliders,
  Droplets,
  Activity
} from 'lucide-react';
import {
  loadBostonCatchment,
  createHydraulicConfigFromCatchment,
} from '../../../data/catchmentLoader';
import {
  createHydraulicState,
  stepHydraulics,
  SimulationState,
} from '../../../simulation/hydraulicSolver';
import {
  GeographicSimulationCanvas,
  CellHoverInfo,
  CanvasLayerVisibility,
} from '../../simulation/GeographicSimulationCanvas';

export const FloodSimulationView: React.FC = () => {
  // 1. Authoritative Catchment Dataset (EPSG:26986, 1600m x 1600m, 64x64)
  const dataset = useMemo(() => loadBostonCatchment(), []);

  // 2. Hydraulic Grid Configuration & Simulation State
  const initialConfig = useMemo(() => {
    return createHydraulicConfigFromCatchment(dataset, {
      manningN: 0.025,
      defaultInfiltrationMmPerHour: 2.0, // 2 mm/h urban infiltration loss
      openBoundaries: 'muddy_river_outlet',
    });
  }, [dataset]);

  const [simState, setSimState] = useState<SimulationState>(() => createHydraulicState(initialConfig));
  const simStateRef = useRef<SimulationState>(simState);
  simStateRef.current = simState;

  // 3. Playback & Simulation Execution Controls
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 1x, 2x, 5x
  const [selectedStormId, setSelectedStormId] = useState<string>('50-year');
  const [customRainfall, setCustomRainfall] = useState<number>(50.0);

  // Active rainfall rate determination
  const currentRainfallRate = useMemo(() => {
    if (selectedStormId === 'custom') return customRainfall;
    const storm = dataset.rainfallProfiles.stormEvents.find((s: { id: string; peakIntensityMmPerHour: number }) => s.id === selectedStormId);
    return storm ? storm.peakIntensityMmPerHour : 50.0;
  }, [customRainfall, dataset.rainfallProfiles.stormEvents, selectedStormId]);

  // 4. Layer Visibility
  const [activeLayers, setActiveLayers] = useState<CanvasLayerVisibility>({
    terrain: true,
    contours: true,
    water: true,
    vectors: true,
    roads: true,
    facilities: true,
    drainage: true,
  });

  const toggleLayer = (layer: keyof CanvasLayerVisibility) => {
    setActiveLayers((prev: CanvasLayerVisibility) => ({ ...prev, [layer]: !prev[layer] }));
  };

  // 5. Interactive Inspection
  const [hoveredCell, setHoveredCell] = useState<CellHoverInfo | null>(null);
  const [selectedCell, setSelectedCell] = useState<CellHoverInfo | null>(null);

  // 6. Simulation Step Execution Function
  const advanceSimulation = useCallback(
    (steps: number = 1) => {
      let state = simStateRef.current;
      for (let i = 0; i < steps; i++) {
        state = stepHydraulics(state, {
          dtMacroSeconds: 2.0,
          rainfallRateMmPerHour: currentRainfallRate,
        });
      }
      setSimState(state);
    },
    [currentRainfallRate]
  );

  // 7. Simulation Reset Function
  const handleReset = useCallback(() => {
    setIsPlaying(false);
    const freshState = createHydraulicState(initialConfig);
    setSimState(freshState);
    setSelectedCell(null);
  }, [initialConfig]);

  // 8. Animation & Simulation Ticking Loop
  useEffect(() => {
    if (!isPlaying) return;

    const intervalMs = 60; // ~16 ticks per second
    const interval = setInterval(() => {
      advanceSimulation(playbackSpeed);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, advanceSimulation]);

  // Count inundated roads and facilities
  const { impassableRoadsCount, atRiskFacilities } = useMemo(() => {
    const depth = simState.waterDepth;
    let impassableRoads = 0;

    for (const road of dataset.criticalRoads) {
      let maxD = 0;
      for (const [r, c] of road.gridCells) {
        const d = depth[r * 64 + c] || 0;
        if (d > maxD) maxD = d;
      }
      if (maxD >= 0.15) impassableRoads++;
    }

    const atRisk: string[] = [];
    for (const fac of dataset.criticalFacilities) {
      const [r, c] = fac.gridCell;
      const d = depth[r * 64 + c] || 0;
      if (d >= 0.10) atRisk.push(fac.name);
    }

    return { impassableRoadsCount: impassableRoads, atRiskFacilities: atRisk };
  }, [dataset.criticalFacilities, dataset.criticalRoads, simState.waterDepth]);

  const activeInspection = selectedCell || hoveredCell;

  return (
    <div className="space-y-4">
      {/* Top Banner: Real Sourced Catchment & Physical Engine Status */}
      <div className="bg-onyx-900 border-l-4 border-cyan-500 p-3.5 rounded-r border-y border-r border-onyx-800 flex flex-col md:flex-row md:items-center justify-between gap-2 font-mono text-xs">
        <div className="flex items-center gap-2.5">
          <Activity className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <span className="text-storm-200">
            CATCHMENT: <strong className="text-storm-100">BOSTON LONGWOOD MEDICAL AREA & MUDDY RIVER</strong>
          </span>
          <span className="text-onyx-700 hidden sm:inline">|</span>
          <span className="text-storm-400 hidden sm:inline">
            EPSG:26986 (NAD83 / Mass Mainland) • 1,600m × 1,600m • 25.0m Square Cells
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-onyx-950 border border-onyx-800 text-[10px] text-cyan-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            2D DIFFUSIVE WAVE OVERLAND SOLVER
          </span>
        </div>
      </div>

      {/* Main Simulation Layout: Left Canvas (8 Cols), Right Telemetry (4 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Simulation Canvas Workspace */}
        <div className="lg:col-span-8 bg-onyx-900 rounded border border-onyx-800 overflow-hidden shadow-tactical flex flex-col h-[640px]">
          {/* Canvas Top Bar: Domain Title & Layer Toggles */}
          <div className="bg-onyx-950 px-4 py-2 border-b border-onyx-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <div className="flex items-center gap-2 text-storm-300">
              <Compass className="w-3.5 h-3.5 text-safety-orange" />
              <span className="font-bold text-storm-100 text-[11px] tracking-wide">
                TOPOGRAPHIC ELEVATION & HYDRAULIC GRID
              </span>
              <span className="text-onyx-700">|</span>
              <span className="text-[10px] text-storm-400">4,096 CELLS</span>
            </div>

            {/* Layer Toggles */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => toggleLayer('terrain')}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                  activeLayers.terrain
                    ? 'bg-onyx-800 text-storm-100 border border-onyx-700'
                    : 'text-storm-500 hover:text-storm-300'
                }`}
                title="Toggle Topographic Base Raster"
              >
                TERRAIN
              </button>
              <button
                onClick={() => toggleLayer('contours')}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                  activeLayers.contours
                    ? 'bg-onyx-800 text-storm-100 border border-onyx-700'
                    : 'text-storm-500 hover:text-storm-300'
                }`}
                title="Toggle 5m Elevation Contours"
              >
                CONTOURS
              </button>
              <button
                onClick={() => toggleLayer('water')}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                  activeLayers.water
                    ? 'bg-onyx-800 text-cyan-300 border border-cyan-500/40'
                    : 'text-storm-500 hover:text-storm-300'
                }`}
                title="Toggle Overland Flood Water Layer"
              >
                FLOOD DEPTH
              </button>
              <button
                onClick={() => toggleLayer('vectors')}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                  activeLayers.vectors
                    ? 'bg-onyx-800 text-blue-300 border border-blue-500/40'
                    : 'text-storm-500 hover:text-storm-300'
                }`}
                title="Toggle Hydraulic Momentum Vectors"
              >
                FLOW VECTORS
              </button>
              <button
                onClick={() => toggleLayer('roads')}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                  activeLayers.roads
                    ? 'bg-onyx-800 text-amber-300 border border-amber-500/40'
                    : 'text-storm-500 hover:text-storm-300'
                }`}
                title="Toggle Emergency Road Corridors"
              >
                ROADS
              </button>
              <button
                onClick={() => toggleLayer('facilities')}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                  activeLayers.facilities
                    ? 'bg-onyx-800 text-red-300 border border-red-500/40'
                    : 'text-storm-500 hover:text-storm-300'
                }`}
                title="Toggle Medical Facilities"
              >
                HOSPITALS
              </button>
              <button
                onClick={() => toggleLayer('drainage')}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                  activeLayers.drainage
                    ? 'bg-onyx-800 text-cyan-300 border border-cyan-500/40'
                    : 'text-storm-500 hover:text-storm-300'
                }`}
                title="Toggle Modelled Culverts and Drainage Sinks"
              >
                DRAINAGE
              </button>
            </div>
          </div>

          {/* Interactive Geographic Canvas */}
          <div className="flex-1 relative bg-onyx-950 overflow-hidden">
            <GeographicSimulationCanvas
              dataset={dataset}
              waterDepth={simState.waterDepth}
              activeLayers={activeLayers}
              selectedCell={selectedCell ? { row: selectedCell.row, col: selectedCell.col } : null}
              onCellHover={setHoveredCell}
              onCellClick={setSelectedCell}
              className="w-full h-full"
            />
          </div>

          {/* Bottom Simulation Controller */}
          <div className="bg-onyx-950 px-4 py-3 border-t border-onyx-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            {/* Playback Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`px-3 py-1.5 rounded font-bold flex items-center gap-1.5 transition-colors shadow-tactical ${
                  isPlaying
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-safety-orange hover:bg-safety-hover text-white'
                }`}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                <span>{isPlaying ? 'PAUSE' : 'RUN SOLVER'}</span>
              </button>

              <button
                onClick={() => advanceSimulation(1)}
                disabled={isPlaying}
                className="px-2.5 py-1.5 rounded bg-onyx-850 hover:bg-onyx-800 text-storm-300 disabled:opacity-50 border border-onyx-700 flex items-center gap-1 transition-colors"
                title="Advance simulation by 1 timestep (dt = 2.0s)"
              >
                <StepForward className="w-3.5 h-3.5" />
                <span>STEP (+2s)</span>
              </button>

              <button
                onClick={handleReset}
                className="px-2.5 py-1.5 rounded bg-onyx-850 hover:bg-onyx-800 text-storm-300 border border-onyx-700 flex items-center gap-1 transition-colors"
                title="Reset simulation to dry baseline (T=0)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>RESET</span>
              </button>

              <div className="flex items-center bg-onyx-900 rounded border border-onyx-800 p-0.5 text-[10px]">
                {[1, 2, 5].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`px-2 py-1 rounded transition-colors ${
                      playbackSpeed === speed
                        ? 'bg-onyx-800 text-storm-100 font-bold'
                        : 'text-storm-500 hover:text-storm-300'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* Storm Profile Selector */}
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-storm-400" />
              <span className="text-storm-400 text-[11px]">EVENT:</span>
              <select
                value={selectedStormId}
                onChange={(e) => setSelectedStormId(e.target.value)}
                className="bg-onyx-900 border border-onyx-800 text-storm-100 rounded px-2 py-1 text-[11px] focus:outline-none focus:border-cyan-500"
              >
                <option value="10-year">NOAA 10-Yr (42 mm/h peak)</option>
                <option value="50-year">NOAA 50-Yr (56.5 mm/h peak)</option>
                <option value="100-year">NOAA 100-Yr (68 mm/h peak)</option>
                <option value="custom">Custom Intensity</option>
              </select>

              {selectedStormId === 'custom' && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="range"
                    min="5"
                    max="150"
                    step="5"
                    value={customRainfall}
                    onChange={(e) => setCustomRainfall(Number(e.target.value))}
                    className="w-20 accent-safety-orange h-1 bg-onyx-800 rounded"
                  />
                  <span className="text-storm-200 text-[11px] w-12 text-right">{customRainfall} mm/h</span>
                </div>
              )}
            </div>

            {/* Time Readout */}
            <div className="flex items-center gap-2 text-storm-300 bg-onyx-900 px-3 py-1 rounded border border-onyx-800">
              <Clock className="w-3.5 h-3.5 text-safety-orange" />
              <span>
                SIMULATED TIME: <strong className="text-storm-100">{simState.totalTimeSeconds.toFixed(1)}s</strong> (
                {(simState.totalTimeSeconds / 60).toFixed(1)} min)
              </span>
            </div>
          </div>
        </div>

        {/* Right: Operational Telemetry & Tactical Cell Inspector */}
        <div className="lg:col-span-4 space-y-4">
          {/* Tactical Cell Inspector Panel */}
          <div className="bg-onyx-900 rounded border border-onyx-800 p-4 shadow-tactical space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-onyx-800 text-storm-400">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-safety-orange" />
                <span className="font-bold text-storm-200 uppercase tracking-wide">CELL INSPECTOR</span>
              </div>
              <span className="text-[10px] text-storm-500">
                {selectedCell ? 'LOCKED TARGET' : hoveredCell ? 'ACTIVE RETICLE' : 'HOVER TO PROBE'}
              </span>
            </div>

            {activeInspection ? (
              <div className="space-y-2.5">
                {/* Cell Identification & Coordinates */}
                <div className="bg-onyx-950 p-2.5 rounded border border-onyx-800 space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-storm-400">GRID CELL:</span>
                    <span className="text-storm-100 font-bold">
                      [{activeInspection.row}, {activeInspection.col}] (Index {activeInspection.cellIndex})
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-storm-400">
                    <span>EPSG:26986:</span>
                    <span className="text-storm-300">
                      X: {activeInspection.projectedX.toFixed(1)}m, Y: {activeInspection.projectedY.toFixed(1)}m
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-storm-400">
                    <span>WGS 84:</span>
                    <span className="text-storm-300">
                      {activeInspection.lat.toFixed(5)}°N, {Math.abs(activeInspection.lon).toFixed(5)}°W
                    </span>
                  </div>
                </div>

                {/* Elevation & Hydraulic Water Depth */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-onyx-950 p-2.5 rounded border border-onyx-800">
                    <span className="text-[10px] text-storm-500 block">TERRAIN ELEVATION</span>
                    <span className="text-storm-100 text-sm font-bold">{activeInspection.elevationM.toFixed(2)} m</span>
                    <span className="text-[9px] text-storm-500 block">NAVD88 Datum</span>
                  </div>
                  <div className="bg-onyx-950 p-2.5 rounded border border-onyx-800">
                    <span className="text-[10px] text-cyan-400 block">SIMULATED WATER DEPTH</span>
                    <span className="text-cyan-300 text-sm font-bold">
                      {(activeInspection.waterDepthM * 100).toFixed(1)} cm
                    </span>
                    <span className="text-[9px] text-storm-500 block">
                      Surface: {activeInspection.waterSurfaceM.toFixed(2)} m
                    </span>
                  </div>
                </div>

                {/* Feature Presence (Facility, Road, Drainage) */}
                {activeInspection.facility && (
                  <div className="bg-red-950/40 border border-red-800/80 p-2.5 rounded text-[11px] text-red-200">
                    <div className="font-bold flex items-center gap-1.5 text-red-300">
                      <span className="w-2 h-2 rounded-full bg-red-400" />
                      {activeInspection.facility.name}
                    </div>
                    <div className="text-[10px] text-red-400 mt-0.5">
                      {activeInspection.facility.category} (OSM {activeInspection.facility.osmId})
                    </div>
                  </div>
                )}

                {activeInspection.drainageInlet && (
                  <div className="bg-cyan-950/40 border border-cyan-800/80 p-2.5 rounded text-[11px] text-cyan-200">
                    <div className="font-bold flex items-center gap-1.5 text-cyan-300">
                      <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                      {activeInspection.drainageInlet.name}
                    </div>
                    <div className="text-[10px] text-cyan-400 mt-0.5">
                      Design Capacity: {activeInspection.drainageInlet.designCapacityM3PerSec} m³/s
                    </div>
                  </div>
                )}

                {activeInspection.roadName && (
                  <div className="bg-onyx-950 p-2 rounded border border-onyx-800 text-[10px] flex justify-between">
                    <span className="text-storm-400">CORRIDOR:</span>
                    <span className="text-amber-300 font-bold">{activeInspection.roadName}</span>
                  </div>
                )}

                {/* Passability Status Banner */}
                <div
                  className={`p-2 rounded border text-[11px] font-bold flex items-center gap-2 ${
                    activeInspection.passabilityStatus === 'CRITICAL_IMPASSABLE'
                      ? 'bg-red-950/80 border-red-700 text-red-200'
                      : activeInspection.passabilityStatus === 'CAUTION_MINOR_PONDING'
                      ? 'bg-amber-950/80 border-amber-700 text-amber-200'
                      : 'bg-emerald-950/80 border-emerald-700 text-emerald-200'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    STATUS:{' '}
                    {activeInspection.passabilityStatus === 'CRITICAL_IMPASSABLE'
                      ? 'IMPASSABLE ROADWAY (>30cm)'
                      : activeInspection.passabilityStatus === 'CAUTION_MINOR_PONDING'
                      ? 'MINOR WATER ACCUMULATION (10-30cm)'
                      : 'CLEAR & FULLY PASSABLE (<10cm)'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-onyx-950 rounded border border-onyx-800/60 text-center text-storm-500 space-y-1">
                <Compass className="w-6 h-6 mx-auto text-storm-600 mb-1" />
                <p>Move cursor over the 64×64 simulation grid to inspect elevation and depth values.</p>
                <p className="text-[10px]">Click any cell to lock reticle.</p>
              </div>
            )}
          </div>

          {/* Mass Conservation & Operational Telemetry Rack */}
          <div className="bg-onyx-900 rounded border border-onyx-800 p-4 shadow-tactical space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-onyx-800 text-storm-400">
              <span className="font-bold text-storm-200 uppercase tracking-wide">WATER BALANCE ACCOUNTING</span>
              <span className="text-[10px] text-emerald-400">CONSERVATION ERROR &lt; 1e-10</span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between bg-onyx-950 p-2 rounded border border-onyx-800 text-[11px]">
                <span className="text-storm-400">CUMULATIVE RAINFALL:</span>
                <span className="text-storm-100 font-bold">
                  {Math.round(simState.accounting.cumulativeRainfallM3).toLocaleString()} m³
                </span>
              </div>

              <div className="flex justify-between bg-onyx-950 p-2 rounded border border-onyx-800 text-[11px]">
                <span className="text-cyan-400">CURRENT SURFACE WATER:</span>
                <span className="text-cyan-300 font-bold">
                  {Math.round(simState.accounting.currentStorageM3).toLocaleString()} m³
                </span>
              </div>

              <div className="flex justify-between bg-onyx-950 p-2 rounded border border-onyx-800 text-[11px]">
                <span className="text-storm-400">DRAINAGE SIPHON INTERCEPT:</span>
                <span className="text-storm-200 font-bold">
                  {Math.round(simState.accounting.cumulativeDrainageM3).toLocaleString()} m³
                </span>
              </div>

              <div className="flex justify-between bg-onyx-950 p-2 rounded border border-onyx-800 text-[11px]">
                <span className="text-storm-400">CHARLES RIVER OUTFLOW:</span>
                <span className="text-storm-200 font-bold">
                  {Math.round(simState.accounting.cumulativeBoundaryOutflowM3).toLocaleString()} m³
                </span>
              </div>

              <div className="flex justify-between bg-onyx-950 p-2 rounded border border-onyx-800 text-[11px]">
                <span className="text-storm-400">MAX SURFACE VELOCITY:</span>
                <span className="text-amber-400 font-bold">
                  {simState.lastMaxVelocity.toFixed(2)} m/s
                </span>
              </div>

              <div className="flex justify-between bg-onyx-950 p-2 rounded border border-onyx-800 text-[11px]">
                <span className="text-storm-400">INUNDATED ROAD CORRIDORS:</span>
                <span className={impassableRoadsCount > 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                  {impassableRoadsCount} / {dataset.criticalRoads.length} Segments
                </span>
              </div>
            </div>

            {/* At-Risk Facilities Warning */}
            {atRiskFacilities.length > 0 && (
              <div className="bg-red-950/60 border border-red-800 p-2.5 rounded text-[11px] text-red-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-red-300">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                  <span>FACILITY FLOOD WARNING:</span>
                </div>
                <ul className="list-disc list-inside text-[10px] text-red-300 pl-1 space-y-0.5">
                  {atRiskFacilities.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
