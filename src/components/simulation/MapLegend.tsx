import React from 'react';
const BANDS = [
  { color: 'rgba(220,38,38,.95)', label: '≥ 60cm: Deep Inundation' }, { color: 'rgba(249,115,22,.88)', label: '30–60cm: Substantial Inundation' },
  { color: 'rgba(37,99,235,.82)', label: '15–30cm: Moderate Ponding' }, { color: 'rgba(56,189,248,.65)', label: '5–15cm: Shallow Surface Water' },
  { color: 'rgba(14,165,233,.30)', label: '< 5cm: Surface Wetting / Sheen' }];
const DELTA = [{ color: 'rgba(16,185,129,.85)', label: 'Avoided Volume (Plan)' }, { color: 'rgba(245,158,11,.85)', label: 'Deflected Ponding' }, { color: 'rgba(148,163,184,.30)', label: 'Unchanged Domain' }];
export const MapLegend: React.FC<{ viewMode?: 'standard' | 'delta' }> = ({ viewMode = 'standard' }) => (
  <div data-testid="docked-map-legend" className="flex flex-wrap items-center gap-x-4 gap-y-1.5 bg-onyx-950 border border-onyx-800 rounded px-3 py-2 text-[10px] font-mono">
    <span className="font-bold text-safety-orange">{viewMode === 'delta' ? 'DELTA: AVOIDED FLOOD' : 'DELTA SCREENING DEPTHS'}</span>
    {(viewMode === 'delta' ? DELTA : BANDS).map((b) => (
      <span key={b.label} className="inline-flex items-center gap-1.5 text-storm-200"><span className="inline-block w-2.5 h-2 rounded-sm" style={{ background: b.color }} />{b.label}</span>))}
    {viewMode !== 'delta' && <><span className="text-storm-400">ROADS: <span className="text-emerald-400">■&lt;15cm</span> <span className="text-amber-400">■15-30cm</span> <span className="text-red-400">■≥30cm</span></span><span className="text-sky-300">✚ Hospital: Campus Monitored</span><span className="text-storm-500">* Model screening tiers. Field access unverified.</span></>}
    {viewMode === 'delta' && <span className="text-storm-500">Shows depth reduction vs baseline</span>}
  </div>);
