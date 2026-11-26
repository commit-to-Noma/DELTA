/**
 * DELTA Synchronized Side-by-Side & Curtain Comparison Canvas
 *
 * Compares Baseline vs. Selected Intervention under identical storm, geometry,
 * initial conditions, and disruption state.
 *
 * Preserves the authoritative signed delta convention:
 *   Δh = h_baseline - h_plan
 *   - Positive (+): Local drawdown (beneficial floodwater reduction)
 *   - Negative (-): Additional water under intervention (adverse local ponding)
 */

import React, { useState, useMemo } from 'react';
import { Columns, SlidersHorizontal, Layers, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { BostonCatchmentDataset, CriticalFacility, RoadSegment } from '../../data/catchmentLoader';
import { gridToLatLon } from '../../data/catchmentLoader';
import type { OperationalWorkOrder } from '../../simulation/workOrderEngine';
import {
  GeographicSimulationCanvas,
  CanvasLayerVisibility,
  CellHoverInfo
} from './GeographicSimulationCanvas';

export type ComparisonViewMode = 'side-by-side' | 'curtain' | 'delta';

export interface SharedCellDeltaReading {
  row: number;
  col: number;
  lat: number;
  lon: number;
  elevationM: number;
  baselineDepthM: number;
  planDepthM: number;
  signedDeltaM: number; // h_baseline - h_plan (+ drawdown, - adverse rise)
  classification: 'BENEFICIAL_DRAWDOWN' | 'ADVERSE_PONDING' | 'UNCHANGED';
  roadName?: string;
  facilityName?: string;
  inletId?: string;
}

/**
 * Pure deterministic helper computing exact signed cell comparison reading.
 * Exported for unit testing of Δh = h_baseline - h_plan semantics.
 */
export function computeCellComparisonReading(
  dataset: BostonCatchmentDataset,
  baselineDepth: Float64Array,
  planDepth: Float64Array,
  row: number,
  col: number
): SharedCellDeltaReading {
  const { nx } = dataset.metadata.grid;
  const idx = row * nx + col;
  const baseD = baselineDepth[idx] || 0;
  const planD = planDepth[idx] || 0;
  const signedDeltaM = Math.round((baseD - planD) * 1000) / 1000;
  const { lat, lon } = gridToLatLon(row, col);
  const elevationM = dataset.elevationMatrix[row]?.[col] ?? 0;

  let classification: SharedCellDeltaReading['classification'] = 'UNCHANGED';
  if (signedDeltaM >= 0.01) classification = 'BENEFICIAL_DRAWDOWN';
  else if (signedDeltaM <= -0.01) classification = 'ADVERSE_PONDING';

  const facility = dataset.criticalFacilities.find((f) => f.gridCell[0] === row && f.gridCell[1] === col);
  const inlet = dataset.modelledDrainageInlets.find((d) => d.gridCell[0] === row && d.gridCell[1] === col);
  const road = dataset.criticalRoads.find((r) => r.gridCells.some(([rr, cc]) => rr === row && cc === col));

  return {
    row,
    col,
    lat: Math.round(lat * 100000) / 100000,
    lon: Math.round(lon * 100000) / 100000,
    elevationM: Math.round(elevationM * 100) / 100,
    baselineDepthM: Math.round(baseD * 1000) / 1000,
    planDepthM: Math.round(planD * 1000) / 1000,
    signedDeltaM,
    classification,
    roadName: road?.name,
    facilityName: facility?.name,
    inletId: inlet?.inletId
  };
}

interface SplitComparisonCanvasProps {
  dataset: BostonCatchmentDataset;
  baselineWaterDepth: Float64Array;
  planWaterDepth: Float64Array;
  planShortLabel: string;
  baselineLabel?: string;
  activeLayers: CanvasLayerVisibility;
  comparisonMode: ComparisonViewMode;
  onChangeComparisonMode: (mode: ComparisonViewMode) => void;
  selectedCell: { row: number; col: number } | null;
  selectedRoadId: string | null;
  selectedFacilityId: string | null;
  stagedWorkOrders?: OperationalWorkOrder[];
  activePlanId?: 'plan-alpha' | 'plan-beta' | 'plan-gamma' | null;
  onSelectCell: (cell: { row: number; col: number } | null) => void;
  onSelectRoad: (road: RoadSegment | null) => void;
  onSelectFacility: (facility: CriticalFacility | null) => void;
}

export const SplitComparisonCanvas: React.FC<SplitComparisonCanvasProps> = ({
  dataset,
  baselineWaterDepth,
  planWaterDepth,
  planShortLabel,
  baselineLabel = 'Baseline (No Intervention)',
  activeLayers,
  comparisonMode,
  onChangeComparisonMode,
  selectedCell,
  selectedRoadId,
  selectedFacilityId,
  stagedWorkOrders = [],
  activePlanId = null,
  onSelectCell,
  onSelectRoad,
  onSelectFacility
}) => {
  const [syncedHover, setSyncedHover] = useState<{ row: number; col: number } | null>(null);
  const [curtainPercent, setCurtainPercent] = useState<number>(50);

  const activeCellCoords = syncedHover || selectedCell;

  const cellReading: SharedCellDeltaReading | null = useMemo(() => {
    if (!activeCellCoords) return null;
    return computeCellComparisonReading(
      dataset,
      baselineWaterDepth,
      planWaterDepth,
      activeCellCoords.row,
      activeCellCoords.col
    );
  }, [activeCellCoords, dataset, baselineWaterDepth, planWaterDepth]);

  const handleHover = (info: CellHoverInfo | null) => {
    setSyncedHover(info ? { row: info.row, col: info.col } : null);
  };

  const handleClick = (info: CellHoverInfo) => {
    onSelectCell({ row: info.row, col: info.col });
  };

  // Synced reticle coordinate shown on both sides
  const syncedReticleCell = syncedHover || selectedCell;

  return (
    <div className="flex flex-col gap-2 flex-1 min-h-0">
      {/* Mode Selector Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex bg-onyx-950 border border-onyx-800 rounded p-0.5 text-[10px] font-mono">
          <button
            type="button"
            onClick={() => onChangeComparisonMode('side-by-side')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
              comparisonMode === 'side-by-side'
                ? 'bg-onyx-800 text-white font-bold'
                : 'text-storm-400 hover:text-storm-200'
            }`}
          >
            <Columns className="w-3 h-3 text-cyan-400" />
            <span>Side-by-Side</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeComparisonMode('curtain')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
              comparisonMode === 'curtain'
                ? 'bg-onyx-800 text-white font-bold'
                : 'text-storm-400 hover:text-storm-200'
            }`}
          >
            <SlidersHorizontal className="w-3 h-3 text-safety-orange" />
            <span>Comparison Curtain</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeComparisonMode('delta')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
              comparisonMode === 'delta'
                ? 'bg-onyx-800 text-white font-bold'
                : 'text-storm-400 hover:text-storm-200'
            }`}
          >
            <Layers className="w-3 h-3 text-emerald-400" />
            <span>Signed Δh Overlay</span>
          </button>
        </div>

        <div className="text-[10px] font-mono text-storm-400">
          Convention: <span className="text-storm-200">Δh = h_baseline − h_plan</span>{' '}
          (<span className="text-emerald-400">+ drawdown</span> · <span className="text-amber-400">− adverse ponding</span>)
        </div>
      </div>

      {/* Viewport Area */}
      {comparisonMode === 'side-by-side' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 flex-1 min-h-[430px]">
          {/* Left: Baseline */}
          <div className="relative bg-onyx-950 rounded border border-onyx-800 overflow-hidden flex flex-col min-h-[380px]">
            <div className="px-2.5 py-1 bg-onyx-900/90 border-b border-onyx-800 flex items-center justify-between text-[10px] font-mono">
              <span className="font-bold text-storm-200 uppercase tracking-wider">
                {baselineLabel}
              </span>
              <span className="text-storm-400">IDENTICAL STORM &amp; DISRUPTIONS</span>
            </div>
            <div className="flex-1 relative min-h-[340px]">
              <GeographicSimulationCanvas
                dataset={dataset}
                waterDepth={baselineWaterDepth}
                viewMode="standard"
                activeLayers={{ ...activeLayers, workOrders: false, adversePonding: false, legend: false }}
                selectedCell={syncedReticleCell}
                selectedRoadId={selectedRoadId}
                selectedFacilityId={selectedFacilityId}
                onCellHover={handleHover}
                onCellClick={handleClick}
                onSelectRoad={onSelectRoad}
                onSelectFacility={onSelectFacility}
              />
            </div>
          </div>

          {/* Right: Selected Plan */}
          <div className="relative bg-onyx-950 rounded border border-cyan-900/60 overflow-hidden flex flex-col min-h-[380px]">
            <div className="px-2.5 py-1 bg-onyx-900/90 border-b border-onyx-800 flex items-center justify-between text-[10px] font-mono">
              <span className="font-bold text-cyan-300 uppercase tracking-wider">
                {planShortLabel}
              </span>
              <span className="text-amber-300">Adverse Rise Hatched</span>
            </div>
            <div className="flex-1 relative min-h-[340px]">
              <GeographicSimulationCanvas
                dataset={dataset}
                waterDepth={planWaterDepth}
                baselineWaterDepth={baselineWaterDepth}
                viewMode="standard"
                activeLayers={activeLayers}
                selectedCell={syncedReticleCell}
                selectedRoadId={selectedRoadId}
                selectedFacilityId={selectedFacilityId}
                stagedWorkOrders={stagedWorkOrders}
                activePlanId={activePlanId}
                onCellHover={handleHover}
                onCellClick={handleClick}
                onSelectRoad={onSelectRoad}
                onSelectFacility={onSelectFacility}
              />
            </div>
          </div>
        </div>
      )}

      {comparisonMode === 'curtain' && (
        <div className="flex flex-col gap-2 flex-1 min-h-[430px]">
          <div className="relative flex-1 min-h-[390px] bg-onyx-950 rounded border border-onyx-800 overflow-hidden">
            {/* Base Layer: Selected Intervention Plan (Full width, visible on right side of curtain) */}
            <div className="absolute inset-0">
              <GeographicSimulationCanvas
                dataset={dataset}
                waterDepth={planWaterDepth}
                baselineWaterDepth={baselineWaterDepth}
                viewMode="standard"
                activeLayers={activeLayers}
                selectedCell={syncedReticleCell}
                selectedRoadId={selectedRoadId}
                selectedFacilityId={selectedFacilityId}
                stagedWorkOrders={stagedWorkOrders}
                activePlanId={activePlanId}
                onCellHover={handleHover}
                onCellClick={handleClick}
                onSelectRoad={onSelectRoad}
                onSelectFacility={onSelectFacility}
              />
            </div>

            {/* Clipped Overlay: Baseline (Visible from 0% to curtainPercent%) */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ clipPath: `inset(0 ${100 - curtainPercent}% 0 0)` }}
            >
              <GeographicSimulationCanvas
                dataset={dataset}
                waterDepth={baselineWaterDepth}
                viewMode="standard"
                activeLayers={{ ...activeLayers, workOrders: false, adversePonding: false, legend: false }}
                selectedCell={syncedReticleCell}
                selectedRoadId={selectedRoadId}
                selectedFacilityId={selectedFacilityId}
              />
            </div>

            {/* Vertical Divider Line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-safety-orange pointer-events-none z-10"
              style={{ left: `${curtainPercent}%` }}
            />

            {/* Corner Labels */}
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-onyx-950/90 border border-onyx-700 text-[10px] font-mono text-storm-200 pointer-events-none z-10">
              LEFT: {baselineLabel}
            </div>
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-onyx-950/90 border border-cyan-700/70 text-[10px] font-mono text-cyan-200 pointer-events-none z-10">
              RIGHT: {planShortLabel}
            </div>
          </div>

          {/* Curtain Slider Control */}
          <div className="flex items-center gap-3 bg-onyx-950 border border-onyx-800 rounded px-3 py-1.5 text-[10px] font-mono">
            <span className="text-storm-400">Baseline ({curtainPercent}%)</span>
            <input
              type="range"
              aria-label="Baseline versus intervention curtain slider"
              min={0}
              max={100}
              value={curtainPercent}
              onChange={(e) => setCurtainPercent(Number(e.target.value))}
              className="flex-1 accent-safety-orange cursor-pointer"
            />
            <span className="text-cyan-300">{planShortLabel} ({100 - curtainPercent}%)</span>
          </div>
        </div>
      )}

      {comparisonMode === 'delta' && (
        <div className="relative flex-1 min-h-[430px] bg-onyx-950 rounded border border-onyx-800 overflow-hidden">
          <GeographicSimulationCanvas
            dataset={dataset}
            waterDepth={planWaterDepth}
            baselineWaterDepth={baselineWaterDepth}
            viewMode="delta"
            activeLayers={activeLayers}
            selectedCell={syncedReticleCell}
            selectedRoadId={selectedRoadId}
            selectedFacilityId={selectedFacilityId}
            stagedWorkOrders={stagedWorkOrders}
            activePlanId={activePlanId}
            onCellHover={handleHover}
            onCellClick={handleClick}
            onSelectRoad={onSelectRoad}
            onSelectFacility={onSelectFacility}
          />
        </div>
      )}

      {/* Shared Synchronized Cell Inspector Bar */}
      <div className="bg-onyx-950 border border-onyx-800 rounded px-3 py-2 text-[11px] font-mono">
        {cellReading ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-safety-orange font-bold">
                CELL [{cellReading.row}, {cellReading.col}]
              </span>
              <span className="text-storm-400">
                Elev {cellReading.elevationM.toFixed(2)}m
              </span>
              <span className="text-storm-200">
                Baseline: <strong>{(cellReading.baselineDepthM * 100).toFixed(1)} cm</strong>
              </span>
              <span className="text-cyan-300">
                {planShortLabel}: <strong>{(cellReading.planDepthM * 100).toFixed(1)} cm</strong>
              </span>
              {cellReading.facilityName && (
                <span className="text-white font-semibold">{cellReading.facilityName}</span>
              )}
              {cellReading.roadName && (
                <span className="text-storm-300">{cellReading.roadName}</span>
              )}
              {cellReading.inletId && (
                <span className="text-safety-orange">{cellReading.inletId}</span>
              )}
            </div>

            {/* Explicit Signed Difference Badge */}
            <div>
              {cellReading.classification === 'BENEFICIAL_DRAWDOWN' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 font-bold">
                  <CheckCircle2 className="w-3 h-3" />
                  Δh = +{(cellReading.signedDeltaM * 100).toFixed(1)} cm (Local Drawdown)
                </span>
              ) : cellReading.classification === 'ADVERSE_PONDING' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/80 border border-amber-600/80 text-amber-300 font-bold">
                  <AlertTriangle className="w-3 h-3" />
                  Δh = {(cellReading.signedDeltaM * 100).toFixed(1)} cm ({(Math.abs(cellReading.signedDeltaM) * 100).toFixed(1)} cm MORE water under plan)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-onyx-900 border border-onyx-700 text-storm-400">
                  Δh = {(cellReading.signedDeltaM * 100).toFixed(1)} cm (No material change)
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="text-storm-400">
            Hover or click any cell on either map to inspect synchronized Baseline depth, Intervention depth, and signed Δh = h_baseline − h_plan.
          </div>
        )}
      </div>
    </div>
  );
};
