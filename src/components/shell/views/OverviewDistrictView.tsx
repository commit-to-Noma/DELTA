/**
 * DELTA Stage 01: Incident Intelligence Workspace
 *
 * Production map-first briefing for the packaged Boston Longwood Medical Area /
 * Muddy River catchment (EPSG:26986, 1600m × 1600m, 64×64 grid, 25.0m cells).
 *
 * Consumes shared IncidentWorkspaceContext directly so rainfall profile selection,
 * active drainage disruptions, and asset inspection synchronize across all stages.
 * Explicitly distinguishes the selected simulation scenario from live observed weather.
 */

import React, { useMemo, useState } from 'react';
import {
  MapPin,
  ArrowRight,
  CloudRain,
  AlertOctagon,
  Hospital,
  Route,
  Droplets,
  Compass,
  RefreshCw,
  Info
} from 'lucide-react';
import { useIncidentWorkspace } from '../../../context/IncidentWorkspaceContext';
import { AUTHORITATIVE_STRESS_PROFILES, plainStormHint, plainStormLabel } from '../../../simulation/interventionEngine';
import { StageIntro } from '../../common/StageIntro';
import { DataModelSpecsDrawer } from '../../common/DataModelSpecsDrawer';
import {
  GeographicSimulationCanvas,
  CellHoverInfo
} from '../../simulation/GeographicSimulationCanvas';
import { CanvasLayerDock } from '../../simulation/CanvasLayerDock';
import { MapLegend } from '../../simulation/MapLegend';

interface OverviewDistrictViewProps {
  onNavigateToSimulation?: () => void;
}

export const OverviewDistrictView: React.FC<OverviewDistrictViewProps> = ({
  onNavigateToSimulation
}) => {
  const {
    dataset,
    setActiveStage,
    activeProfileId,
    activeProfile,
    setActiveProfileId,
    activeDisruptions,
    evaluationResult,
    isComputingEvaluation,
    activeScenarioHash,
    workOrders,
    canvasLayers,
    toggleCanvasLayer,
    selectedCell,
    setSelectedCell,
    selectedFacilityId,
    setSelectedFacilityId,
    selectedRoadId,
    setSelectedRoadId
  } = useIncidentWorkspace();

  const [hoveredCell, setHoveredCell] = useState<CellHoverInfo | null>(null);
  const [clickedCell, setClickedCell] = useState<CellHoverInfo | null>(null);

  const { nx, ny, dx, totalAreaKm2 } = dataset.metadata.grid;
  const { minElevationM, maxElevationM, meanElevationM } = dataset.metadata.elevationStatistics;
  const bounds = dataset.metadata.spatialReference.projectedBounds;

  // Use baseline water depth from shared solver evaluation when ready, else dry bare-earth terrain
  const zeroDepth = useMemo(() => new Float64Array(nx * ny), [nx, ny]);
  const previewWaterDepth = evaluationResult?.baseline.waterDepth ?? zeroDepth;

  const activeInspectorCell = hoveredCell || clickedCell;
  const primaryArterialsCount = useMemo(
    () => dataset.criticalRoads.filter((r) => r.highwayType === 'primary' || r.criticalForHospitalAccess).length,
    [dataset.criticalRoads]
  );

  const handleEnterSimulation = () => {
    if (onNavigateToSimulation) {
      onNavigateToSimulation();
    } else {
      setActiveStage('simulation');
    }
  };

  const handleSelectFacilityFromList = (facilityId: string, gridCell: [number, number]) => {
    setSelectedFacilityId(facilityId);
    setSelectedRoadId(null);
    setSelectedCell({ row: gridCell[0], col: gridCell[1] });
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      <StageIntro subtitle="Look at the map, pick a storm, then enter the simulation to see which hospital roads flood." />
      {/* Compact Top Catchment & Scenario Summary Strip */}
      <div className="bg-onyx-900 border border-onyx-800 rounded px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-safety-orange flex-shrink-0" />
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">
                {dataset.catchmentName}
              </h1>
              <p className="text-[11px] text-storm-300">
                Five hospitals beside the Muddy River floodplain — one storm can cut their access roads.
              </p>
            </div>
          </div>

          <div className="hidden xl:block h-6 w-[1px] bg-onyx-800" />

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
            <span className="px-2 py-0.5 rounded bg-onyx-950 border border-onyx-800 text-cyan-300">
              {dataset.criticalFacilities.length} Medical Campuses
            </span>
            <span className="px-2 py-0.5 rounded bg-onyx-950 border border-onyx-800 text-storm-300">
              {dataset.criticalRoads.length} Road Segments
            </span>
            <span className="px-2 py-0.5 rounded bg-onyx-950 border border-onyx-800 text-amber-300">
              {dataset.modelledDrainageInlets.length} Modelled Inlets
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleEnterSimulation}
          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-safety-orange hover:bg-orange-600 text-white text-xs font-mono font-bold tracking-wide transition-colors"
        >
          <span>Enter Simulation &amp; Disruption</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Map-First Command Grid (Dominant Map Viewport + Contextual Inspector Rail) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 flex-1 min-h-0">
        {/* Dominant Geospatial Map Viewport (8 / 12 cols) */}
        <div className="xl:col-span-8 flex flex-col gap-2 bg-onyx-900 border border-onyx-800 rounded p-2.5 min-h-[520px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CanvasLayerDock
              activeLayers={canvasLayers}
              onToggleLayer={toggleCanvasLayer}
              visibleKeys={['satellite', 'terrain', 'contours', 'water', 'roads', 'facilities', 'drainage', 'workOrders', 'legend']}
              compact
            />

            <div className="flex items-center gap-2 text-[10px] font-mono text-storm-400">
              {isComputingEvaluation ? (
                <span className="flex items-center gap-1.5 text-cyan-300">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Updating baseline depth preview...
                </span>
              ) : evaluationResult ? (
                <span className="px-2 py-0.5 rounded bg-onyx-950 border border-onyx-800 text-storm-300">
                  Preview: Baseline Depth ({evaluationResult.baseline.maxWaterDepthM.toFixed(2)}m peak)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-onyx-950 border border-onyx-800 text-storm-400">
                  Bare-Earth Catchment Preview
                </span>
              )}
            </div>
          </div>

          {/* Interactive Geospatial Canvas */}
          <div className="relative flex-1 min-h-[440px] bg-onyx-950 rounded border border-onyx-800 overflow-hidden">
            <GeographicSimulationCanvas
              dataset={dataset}
              waterDepth={previewWaterDepth}
              viewMode="standard"
              activeLayers={canvasLayers}
              selectedCell={selectedCell}
              selectedFacilityId={selectedFacilityId}
              selectedRoadId={selectedRoadId}
              stagedWorkOrders={workOrders}
              onCellHover={setHoveredCell}
              onCellClick={(info) => {
                setClickedCell(info);
                setSelectedCell({ row: info.row, col: info.col });
              }}
              onSelectFacility={(fac) => setSelectedFacilityId(fac ? fac.facilityId : null)}
              onSelectRoad={(road) => setSelectedRoadId(road ? road.roadId : null)}
            />

            {/* Compact Floating Coordinate & Cell Telemetry Footer */}
            <div className="absolute bottom-2 left-2 bg-onyx-950/90 border border-onyx-800 rounded px-2.5 py-1.5 text-[10px] font-mono text-storm-300 pointer-events-none max-w-[65%]">
              {activeInspectorCell ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span className="text-safety-orange font-bold">
                    CELL [{activeInspectorCell.row}, {activeInspectorCell.col}]
                  </span>
                  <span>
                    {activeInspectorCell.lat.toFixed(5)}°N, {activeInspectorCell.lon.toFixed(5)}°W
                  </span>
                  <span>Elev: {activeInspectorCell.elevationM.toFixed(2)}m</span>
                  <span className="text-cyan-300">
                    Depth: {(activeInspectorCell.waterDepthM * 100).toFixed(1)} cm
                  </span>
                  {activeInspectorCell.facility && (
                    <span className="text-white font-semibold">
                      {activeInspectorCell.facility.name}
                    </span>
                  )}
                  {activeInspectorCell.roadName && (
                    <span className="text-amber-300">{activeInspectorCell.roadName}</span>
                  )}
                  {activeInspectorCell.drainageInlet && (
                    <span className="text-safety-orange">
                      Inlet: {activeInspectorCell.drainageInlet.inletId}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-storm-400">
                  Hover or click any cell, hospital, road corridor, or drainage inlet to inspect catchment geometry.
                </span>
              )}
            </div>
          </div>
          {canvasLayers.legend !== false && <MapLegend viewMode="standard" />}
        </div>

        {/* Right Contextual Scenario & Infrastructure Rail (4 / 12 cols) */}
        <div className="xl:col-span-4 flex flex-col gap-3 overflow-y-auto pr-0.5">
          {/* 1. Selected Simulation Scenario (Explicitly distinguished from live observed weather) */}
          <div className="bg-onyx-900 border border-onyx-800 rounded p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-storm-200 flex items-center gap-1.5">
                <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
                Selected Simulation Scenario
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${
                  activeProfile.type === 'REGIONAL_NOAA_BENCHMARK'
                    ? 'bg-cyan-950/70 border-cyan-700/60 text-cyan-300'
                    : 'bg-safety-orange/15 border-safety-orange/40 text-safety-orange'
                }`}
              >
                {activeProfile.type === 'REGIONAL_NOAA_BENCHMARK' ? 'Regional NOAA Benchmark' : 'Synthetic Stress Input'}
              </span>
            </div>

            <div className="text-[10px] font-mono text-storm-400 bg-onyx-950 border border-onyx-800 rounded px-2.5 py-1.5 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 text-storm-400 flex-shrink-0 mt-0.5" />
              <span>
                Configured planning scenario only — not a live weather alert, real-time gauge feed, or observed flood condition.
              </span>
            </div>

            <select
              aria-label="Selected rainfall profile"
              value={activeProfileId}
              onChange={(e) => setActiveProfileId(e.target.value)}
              className="w-full bg-onyx-950 border border-onyx-700 rounded px-2.5 py-1.5 text-xs font-mono text-storm-100 focus:outline-none focus:border-safety-orange"
            >
              {Object.values(AUTHORITATIVE_STRESS_PROFILES).map((p) => (
                <option key={p.id} value={p.id}>
                  {plainStormLabel(p)} — {p.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-cyan-200">{plainStormHint(activeProfile)}</p>

            <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
              <div className="bg-onyx-950 border border-onyx-800 rounded p-2">
                <span className="text-[9px] text-storm-400 uppercase block">Total Depth</span>
                <span className="text-white font-bold">{activeProfile.totalRainfallMm.toFixed(1)} mm</span>
              </div>
              <div className="bg-onyx-950 border border-onyx-800 rounded p-2">
                <span className="text-[9px] text-storm-400 uppercase block">Duration</span>
                <span className="text-white font-bold">{activeProfile.durationHours.toFixed(1)} hr</span>
              </div>
              <div className="bg-onyx-950 border border-onyx-800 rounded p-2">
                <span className="text-[9px] text-storm-400 uppercase block">Scenario Hash</span>
                <span className="text-cyan-300 font-bold truncate block">
                  {activeScenarioHash ? activeScenarioHash.slice(0, 10) : 'Computing...'}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-storm-300 leading-relaxed">
              {activeProfile.provenance}
            </p>
          </div>

          {/* 2. Active Disruption State */}
          <div className="bg-onyx-900 border border-onyx-800 rounded p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-storm-200 flex items-center gap-1.5">
                <AlertOctagon className="w-3.5 h-3.5 text-safety-orange" />
                Active Disruption State
              </span>
              <button
                type="button"
                onClick={handleEnterSimulation}
                className="text-[10px] font-mono text-safety-orange hover:text-white underline"
              >
                Configure in Stage 02
              </button>
            </div>

            {activeDisruptions.length === 0 ? (
              <div className="text-xs font-mono text-emerald-300 bg-emerald-950/30 border border-emerald-800/50 rounded px-2.5 py-2">
                Nominal Drainage — 0 active drainage disruptions configured.
              </div>
            ) : (
              <div className="space-y-1.5">
                {activeDisruptions.map((d) => (
                  <div
                    key={d.id}
                    className="bg-safety-orange/10 border border-safety-orange/40 rounded px-2.5 py-1.5 text-[11px]"
                  >
                    <div className="flex items-center justify-between font-mono font-bold text-safety-orange">
                      <span>{d.targetInletId}</span>
                      <span>{Math.round(d.blockageRatio * 100)}% Blocked</span>
                    </div>
                    <div className="text-storm-300 mt-0.5">{d.name}</div>
                    {d.plainConsequence && <div className="text-storm-200 mt-0.5">{d.plainConsequence}</div>}
                    <div className="text-[10px] font-mono text-storm-400 mt-0.5">
                      Cell [{d.gridCell[0]}, {d.gridCell[1]}] · {d.nominalCapacityM3PerSec} → {d.effectiveCapacityM3PerSec} m³/s modelled sink
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Packaged Critical Infrastructure Inventory */}
          <div className="bg-onyx-900 border border-onyx-800 rounded p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-storm-200 flex items-center gap-1.5">
                <Hospital className="w-3.5 h-3.5 text-cyan-400" />
                Packaged Medical Facilities ({dataset.criticalFacilities.length})
              </span>
              <span className="text-[10px] font-mono text-storm-400">OSM Sourced</span>
            </div>

            <div className="space-y-1">
              {dataset.criticalFacilities.map((fac) => {
                const isSelected = selectedFacilityId === fac.facilityId;
                const baselineHosp = evaluationResult?.baseline.hospitals.find((h) => h.name === fac.name);
                return (
                  <button
                    key={fac.facilityId}
                    type="button"
                    onClick={() => handleSelectFacilityFromList(fac.facilityId, fac.gridCell)}
                    className={`w-full text-left px-2.5 py-1.5 rounded border text-[11px] transition-colors flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-onyx-800 border-safety-orange text-white'
                        : 'bg-onyx-950/70 border-onyx-850 text-storm-200 hover:border-onyx-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{fac.name}</div>
                      <div className="text-[10px] font-mono text-storm-400">
                        Cell [{fac.gridCell[0]}, {fac.gridCell[1]}] · Elev {dataset.elevationMatrix[fac.gridCell[0]][fac.gridCell[1]].toFixed(1)}m
                      </div>
                    </div>
                    {baselineHosp && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold flex-shrink-0 ${
                          baselineHosp.status === 'ACCESSIBLE'
                            ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60'
                            : baselineHosp.status === 'CAUTION_PERIMETER_PONDING'
                            ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-800/60'
                            : 'bg-amber-950/70 text-amber-300 border border-amber-700/60'
                        }`}
                      >
                        {baselineHosp.status === 'ACCESSIBLE'
                          ? 'SCREENED <15cm'
                          : baselineHosp.status === 'CAUTION_PERIMETER_PONDING'
                          ? 'CAUTION 15–30cm'
                          : 'CORRIDOR ≥30cm'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Road & Drainage Summary */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-onyx-800 text-[11px]">
              <div className="bg-onyx-950 border border-onyx-800 rounded p-2">
                <div className="flex items-center gap-1 font-mono text-[10px] text-storm-400 uppercase">
                  <Route className="w-3 h-3 text-storm-300" />
                  Road Network
                </div>
                <div className="font-mono font-bold text-white mt-0.5">
                  {dataset.criticalRoads.length} Segments
                </div>
                <div className="text-[10px] text-storm-400">
                  {primaryArterialsCount} hospital-linked corridors
                </div>
              </div>
              <div className="bg-onyx-950 border border-onyx-800 rounded p-2">
                <div className="flex items-center gap-1 font-mono text-[10px] text-storm-400 uppercase">
                  <Droplets className="w-3 h-3 text-cyan-400" />
                  Drainage Nodes
                </div>
                <div className="font-mono font-bold text-white mt-0.5">
                  {dataset.modelledDrainageInlets.length} Point Sinks
                </div>
                <div className="text-[10px] text-amber-300/90">
                  Modelled assumptions
                </div>
              </div>
            </div>
          </div>

          {/* 4. Collapsible Data & Model Specs drawer (engineering strings moved here, nothing deleted) */}
          <DataModelSpecsDrawer
            items={[
              { label: 'Catchment', value: `${dataset.catchmentName} · ${bounds.widthM}m × ${bounds.heightM}m (${nx}×${ny} @ ${dx.toFixed(1)}m) · ${totalAreaKm2} km²` },
              { label: 'Coordinate System', value: dataset.metadata.spatialReference.authoritativeProjectedCRS },
              { label: 'Elevation (DEM)', value: `${minElevationM.toFixed(1)}m – ${maxElevationM.toFixed(1)}m NAVD88 · Mean ${meanElevationM.toFixed(2)}m` },
              { label: 'Topography', value: dataset.attribution.topography },
              { label: 'Infrastructure', value: dataset.attribution.infrastructure },
              { label: 'Rainfall Provenance', value: activeProfile.provenance },
              { label: 'Drainage Abstraction', value: 'CULVERT-01-BROOKLINE is modelled as an exploratory road-deck point sink on cell [17, 26] (12.5 m³/s screening heuristic), not a coupled 1D culvert barrel.' }
            ]}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-storm-400 pt-1">
              <Compass className="w-3 h-3" />
              <span>Screening outputs require field reconnaissance before any operational dispatch.</span>
            </div>
          </DataModelSpecsDrawer>
        </div>
      </div>
    </div>
  );
};
