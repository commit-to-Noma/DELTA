/**
 * Click-anywhere sandbox: judge-placed custom actions on the real 2D solver.
 * Pump = point sink inlet, Barrier = raised cells, Blockage = raised impermeable
 * block (elevation up, infiltration off). All are screening representations,
 * labelled as such in the UI — never presented as surveyed engineering.
 */
import { BostonCatchmentDataset, createHydraulicConfigFromCatchment } from '../data/catchmentLoader';
import { createHydraulicState, stepHydraulics, HydraulicGridConfig, SimulationState } from './hydraulicSolver';
import { AUTHORITATIVE_DISRUPTIONS } from './disruptionEngine';
import type { RainfallScheduleInput } from './disruptionEngine';

export type CustomActionType = 'PUMP' | 'BARRIER' | 'BLOCKAGE';
export interface CustomAction { id: string; row: number; col: number; type: CustomActionType; strength: number; }
export interface CustomSandboxResult {
  actions: CustomAction[]; rainfallScale: number; profileId: string;
  baseline: { currentStorageM3: number; maxWaterDepthM: number; waterDepth: Float64Array };
  custom: { currentStorageM3: number; maxWaterDepthM: number; waterDepth: Float64Array };
  delta: { avoidedVolumeM3: number; peakDepthDeltaM: number; adverseCellCount: number; beneficialCellCount: number; peakAdverseRiseM: number };
  summary: string;
}

export const CUSTOM_ACTION_LIMITS: Record<CustomActionType, { min: number; max: number; unit: string; label: string }> = {
  PUMP: { min: 0.5, max: 4, unit: 'm³/s sink', label: 'Mobile pump' },
  BARRIER: { min: 0.2, max: 1, unit: 'm crest', label: 'Deployable barrier' },
  BLOCKAGE: { min: 0.3, max: 0.6, unit: 'm block', label: 'Debris blockage' },
};

export function validateCustomAction(a: Partial<CustomAction>, nx = 64, ny = 64): CustomAction {
  if (!a || !['PUMP', 'BARRIER', 'BLOCKAGE'].includes(a.type as string)) throw new Error('Custom action type must be PUMP, BARRIER or BLOCKAGE');
  const row = Math.round(Number(a.row)); const col = Math.round(Number(a.col));
  if (!Number.isFinite(row) || !Number.isFinite(col) || row < 0 || col < 0 || row >= ny || col >= nx) throw new Error(`Custom action cell [${a.row}, ${a.col}] is outside the ${nx}×${ny} grid`);
  const lim = CUSTOM_ACTION_LIMITS[a.type as CustomActionType];
  const strength = Math.min(lim.max, Math.max(lim.min, Number(a.strength) || lim.min));
  return { id: a.id || `custom-${a.type!.toLowerCase()}-${row}-${col}`, row, col, type: a.type as CustomActionType, strength: Math.round(strength * 100) / 100 };
}

export function applyCustomActions(config: HydraulicGridConfig, actions: CustomAction[]): HydraulicGridConfig {
  const elevation = new Float64Array(config.elevation);
  const infiltrationRate = config.infiltrationRate ? new Float64Array(config.infiltrationRate) : undefined;
  const drainageInlets = (config.drainageInlets || []).map(i => ({ ...i }));
  for (const a of actions) {
    const idx = a.row * config.nx + a.col;
    if (a.type === 'PUMP') drainageInlets.push({ index: idx, capacityM3PerSec: a.strength, blockageRatio: 0, inletId: `SANDBOX-PUMP-${a.row}-${a.col}` });
    if (a.type === 'BARRIER') { for (let dc = -1; dc <= 1; dc++) { const c = a.col + dc; if (c >= 0 && c < config.nx) elevation[a.row * config.nx + c] += a.strength; } }
    if (a.type === 'BLOCKAGE') { elevation[idx] += a.strength; if (infiltrationRate) infiltrationRate[idx] = 0; }
  }
  return { ...config, elevation, infiltrationRate, drainageInlets };
}

function coarsen(config: HydraulicGridConfig, f: number): HydraulicGridConfig {
  const nx = Math.floor(config.nx / f), ny = Math.floor(config.ny / f);
  const elevation = new Float64Array(nx * ny); const infiltrationRate = config.infiltrationRate ? new Float64Array(nx * ny) : undefined;
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) { let e = 0, inf = 0; for (let dr = 0; dr < f; dr++) for (let dc = 0; dc < f; dc++) { const s = (r * f + dr) * config.nx + (c * f + dc); e += config.elevation[s] || 0; if (infiltrationRate && config.infiltrationRate) inf += config.infiltrationRate[s] || 0; } elevation[r * nx + c] = e / (f * f); if (infiltrationRate) infiltrationRate[r * nx + c] = inf / (f * f); }
  const remap = (i: number) => Math.floor(Math.floor(i / config.nx) / f) * nx + Math.floor((i % config.nx) / f);
  return { ...config, nx, ny, dx: config.dx * f, elevation, infiltrationRate, drainageInlets: (config.drainageInlets || []).map(i => ({ ...i, index: remap(i.index) })), openBoundaryIndices: [...new Set((config.openBoundaryIndices || []).map(remap))] };
}
function upsample(depth: Float64Array, nx: number, ny: number, f: number): Float64Array { const cnx = Math.floor(nx / f); const out = new Float64Array(nx * ny); for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) out[r * nx + c] = depth[Math.floor(r / f) * cnx + Math.floor(c / f)] || 0; return out; }
function rateAt(p: RainfallScheduleInput, t: number, scale: number): number { if (t >= p.durationSeconds) return 0; if (p.hyetographHours?.length) return (p.hyetographHours[Math.min(p.hyetographHours.length - 1, Math.floor(t / 3600))].rateMmPerHour) * scale; return (p.rainfallIntensityMmPerHour ?? p.totalRainfallMm / Math.max(p.durationHours, 1e-6)) * scale; }

export async function executeCustomSandboxAsync(dataset: BostonCatchmentDataset, profile: RainfallScheduleInput, activeDisruptionIds: string[], actions: CustomAction[], rainfallScale = 1): Promise<CustomSandboxResult> {
  const valid = actions.map(a => validateCustomAction(a, dataset.metadata.grid.nx, dataset.metadata.grid.ny));
  const scale = Math.min(1.5, Math.max(0.5, Number(rainfallScale) || 1));
  const { nx, ny } = dataset.metadata.grid;
  const base = createHydraulicConfigFromCatchment(dataset, { manningN: 0.025, defaultInfiltrationMmPerHour: 2.0, openBoundaries: 'muddy_river_outlet' });
  const disruptions = activeDisruptionIds.map(id => AUTHORITATIVE_DISRUPTIONS.find(d => d.id === id)).filter(Boolean) as typeof AUTHORITATIVE_DISRUPTIONS;
  if (base.drainageInlets && disruptions.length) base.drainageInlets = base.drainageInlets.map(inlet => { const m = disruptions.find(d => d!.gridCell[0] * nx + d!.gridCell[1] === inlet.index || d!.targetInletId === inlet.inletId); return m ? { ...inlet, blockageRatio: m.blockageRatio } : { ...inlet }; });
  const f = nx >= 64 ? 2 : 1;
  const run = async (cfg: HydraulicGridConfig) => {
    const solveCfg = f > 1 ? coarsen(cfg, f) : cfg; let s: SimulationState = createHydraulicState(solveCfg);
    const steps = Math.max(1, Math.floor(profile.durationSeconds / 60));
    for (let i = 0; i < steps; i++) { s = stepHydraulics(s, { dtMacroSeconds: 60, rainfallRateMmPerHour: rateAt(profile, i * 60, scale), maxSubStepSeconds: 5 }); if (i % 20 === 19) await new Promise(r => setTimeout(r, 0)); }
    const depth = f > 1 ? upsample(s.waterDepth, nx, ny, f) : s.waterDepth; let peak = 0; for (let i = 0; i < depth.length; i++) if (depth[i] > peak) peak = depth[i];
    return { currentStorageM3: Math.round(s.accounting.currentStorageM3), maxWaterDepthM: Math.round(peak * 1000) / 1000, waterDepth: depth };
  };
  const baseline = await run(base); const custom = await run(applyCustomActions(base, valid));
  let adverse = 0, beneficial = 0, peakRise = 0;
  for (let i = 0; i < baseline.waterDepth.length; i++) { const d = custom.waterDepth[i] - baseline.waterDepth[i]; if (d >= 0.01) { adverse++; if (d > peakRise) peakRise = d; } else if (d <= -0.01) beneficial++; }
  const avoided = baseline.currentStorageM3 - custom.currentStorageM3;
  return { actions: valid, rainfallScale: scale, profileId: profile.id, baseline, custom, delta: { avoidedVolumeM3: avoided, peakDepthDeltaM: Math.round((custom.maxWaterDepthM - baseline.maxWaterDepthM) * 1000) / 1000, adverseCellCount: adverse, beneficialCellCount: beneficial, peakAdverseRiseM: Math.round(peakRise * 1000) / 1000 }, summary: valid.length ? `${valid.length} custom sandbox action(s) at rainfall ×${scale}: ${avoided >= 0 ? `${avoided.toLocaleString()} m³ avoided` : `${Math.abs(avoided).toLocaleString()} m³ additional storage (adverse)`}, ${adverse} adverse cell(s) ≥1 cm. Screening representation only.` : 'No custom actions placed.' };
}
