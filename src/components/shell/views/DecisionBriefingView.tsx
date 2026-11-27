/**
 * DELTA Stage 04: Decision & Briefing Workspace
 *
 * Synchronized directly with IncidentWorkspaceContext so briefings, trade-offs,
 * cross-scenario stress matrices, and exports are strictly bound to the active
 * rainfall profile, active drainage disruptions, and active scenario hash.
 *
 * Unifies:
 * 1. Executive & Baseline Hazard Assessment
 * 2. Comparative Mitigation Strategies (Alpha, Beta, Gamma) & Adverse Deflections
 * 3. Cross-Scenario Robustness Matrix (across all 4 profiles under current disruption state)
 * 4. Governance Binding & Staged Work Orders (preserving historical immutability)
 * 5. Decision Records & Immutable Approval Ledger (DecisionRecordsView)
 */

import React, { useState, useMemo } from 'react';
import {
  FileText,
  ShieldCheck,
  AlertTriangle,
  Download,
  Copy,
  Printer,
  Compass,
  Lock,
  ArrowRight,
  Layers,
  Sparkles,
  BarChart3,
  Ticket,
  Check,
  Info,
  RefreshCw,
  AlertOctagon
} from 'lucide-react';
import { AUTHORITATIVE_STRESS_PROFILES } from '../../../simulation/interventionEngine';
import {
  generateDecisionBriefing,
  getOrComputeCrossProfileMatrix,
  DecisionBriefing,
  CrossProfileMatrixEntry
} from '../../../simulation/decisionBriefingEngine';
import {
  exportBriefingToMarkdown,
  exportBriefingToHtml,
  downloadBriefingFile,
  copyBriefingToClipboard,
  verifyBriefingBinding
} from '../../../simulation/briefingExporter';
import { useIncidentWorkspace } from '../../../context/IncidentWorkspaceContext';
import { DecisionRecordsView } from './DecisionRecordsView';

interface DecisionBriefingViewProps {
  onNavigateToTab?: (tab: 'overview' | 'simulation' | 'interventions' | 'decisions' | 'tickets') => void;
}

export const DecisionBriefingView: React.FC<DecisionBriefingViewProps> = ({
  onNavigateToTab
}) => {
  const {
    dataset,
    setActiveStage,
    activeProfileId,
    setActiveProfileId,
    activeDisruptionIds,
    activeDisruptions,
    evaluationResult,
    isComputingEvaluation,
    activeScenarioHash,
    activeDecisionForScenario,
    latestHistoricalDecision,
    activeWorkOrderForScenario
  } = useIncidentWorkspace();

  const [activeSubTab, setActiveSubTab] = useState<
    'executive' | 'interventions' | 'robustness' | 'governance' | 'records'
  >('executive');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Compute cross-profile matrix keyed strictly to activeDisruptionIds
  const crossProfileMatrix: CrossProfileMatrixEntry[] = useMemo(() => {
    return getOrComputeCrossProfileMatrix(dataset, 30.0, 240.0, activeDisruptionIds);
  }, [dataset, activeDisruptionIds]);

  // Generate briefing strictly from fresh shared evaluationResult (never stale data)
  const briefing: DecisionBriefing | null = useMemo(() => {
    if (!evaluationResult) return null;
    return generateDecisionBriefing(
      evaluationResult,
      dataset,
      activeDecisionForScenario,
      activeWorkOrderForScenario,
      crossProfileMatrix
    );
  }, [evaluationResult, dataset, activeDecisionForScenario, activeWorkOrderForScenario, crossProfileMatrix]);

  const isExportSafe = Boolean(
    briefing && activeScenarioHash && !isComputingEvaluation && verifyBriefingBinding(briefing, activeScenarioHash)
  );

  const navigate = (stage: 'intelligence' | 'simulation' | 'interventions' | 'operations') => {
    setActiveStage(stage);
    if (onNavigateToTab) {
      if (stage === 'intelligence') onNavigateToTab('overview');
      else if (stage === 'operations') onNavigateToTab('tickets');
      else onNavigateToTab(stage);
    }
  };

  // Export Handlers (strictly guarded by verifyBriefingBinding)
  const handleCopyMarkdown = async () => {
    if (!briefing || !activeScenarioHash || !verifyBriefingBinding(briefing, activeScenarioHash)) return;
    const md = exportBriefingToMarkdown(briefing);
    const ok = await copyBriefingToClipboard(md);
    if (ok) {
      setCopyFeedback('Markdown copied to clipboard');
      setTimeout(() => setCopyFeedback(null), 3000);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!briefing || !activeScenarioHash || !verifyBriefingBinding(briefing, activeScenarioHash)) return;
    const md = exportBriefingToMarkdown(briefing);
    downloadBriefingFile(`DELTA_Briefing_${briefing.briefingId}.md`, md, 'text/markdown');
  };

  const handleDownloadHtml = () => {
    if (!briefing || !activeScenarioHash || !verifyBriefingBinding(briefing, activeScenarioHash)) return;
    const html = exportBriefingToHtml(briefing);
    downloadBriefingFile(`DELTA_Briefing_${briefing.briefingId}.html`, html, 'text/html');
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Compact Top Briefing Header */}
      <div className="bg-onyx-900 border border-onyx-800 rounded px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-2 py-0.5 rounded bg-safety-orange/20 border border-safety-orange/40 text-safety-orange font-mono text-[11px] font-bold uppercase">
              {briefing ? `Directive ${briefing.briefingId}` : 'Computing Directive'}
            </span>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-safety-orange" />
              Decision Briefing &amp; Approval Ledger
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] font-mono text-storm-400">
            <span>SCENARIO HASH:</span>
            <span className="text-cyan-300 font-bold bg-onyx-950 px-1.5 py-0.5 rounded border border-onyx-800">
              {activeScenarioHash || 'Recalculating...'}
            </span>
            <span>·</span>
            <span
              className={
                activeDisruptions.length > 0 ? 'text-safety-orange' : 'text-emerald-300'
              }
            >
              {activeDisruptions.length > 0
                ? `${activeDisruptions.length} Active Disruption(s)`
                : 'Nominal Drainage'}
            </span>
          </div>
        </div>

        {/* Synchronized Export Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {copyFeedback && (
            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              {copyFeedback}
            </span>
          )}

          <button
            type="button"
            disabled={!isExportSafe}
            onClick={handleCopyMarkdown}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-onyx-800 hover:bg-onyx-700 disabled:opacity-40 text-storm-200 text-[11px] font-mono border border-onyx-700 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy .MD
          </button>

          <button
            type="button"
            disabled={!isExportSafe}
            onClick={handleDownloadMarkdown}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-onyx-800 hover:bg-onyx-700 disabled:opacity-40 text-storm-200 text-[11px] font-mono border border-onyx-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export .MD
          </button>

          <button
            type="button"
            disabled={!isExportSafe}
            onClick={handleDownloadHtml}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-onyx-800 hover:bg-onyx-700 disabled:opacity-40 text-storm-200 font-mono text-[11px] border border-onyx-700 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Export HTML
          </button>

          {activeDecisionForScenario ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300 font-mono text-[11px] font-bold">
              <Check className="w-3.5 h-3.5" />
              Approved: {activeDecisionForScenario.decisionId || activeDecisionForScenario.id}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => navigate('interventions')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-safety-orange hover:bg-orange-600 text-white font-mono text-[11px] font-bold transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Approve Decision → (Step 03)
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Mandatory Permanent Dispatch Lockout Strip */}
      <div className="bg-red-950/35 border border-red-900/60 rounded px-3.5 py-2 flex items-center justify-between text-[11px] text-red-200 font-mono">
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <span>
            <strong>LIVE DISPATCH LOCKED:</strong> DELTA operates in decision-support and commander-staging mode only. No live crews or automated field dispatch occur.
          </span>
        </div>
      </div>

      {/* Synchronized Scenario Selector + Section Tabs */}
      <div className="bg-onyx-900 border border-onyx-800 rounded px-3.5 py-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono text-storm-400 uppercase flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            Profile:
          </span>
          <select
            aria-label="Briefing rainfall profile"
            value={activeProfileId}
            onChange={(e) => setActiveProfileId(e.target.value)}
            className="bg-onyx-950 border border-onyx-700 text-[11px] font-mono text-storm-100 rounded px-2.5 py-1 focus:outline-none focus:border-safety-orange"
          >
            {Object.values(AUTHORITATIVE_STRESS_PROFILES).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => navigate('simulation')}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-onyx-950 border border-onyx-700 hover:border-safety-orange text-[10px] font-mono text-storm-300"
          >
            <AlertOctagon className="w-3 h-3 text-safety-orange" />
            <span>
              {activeDisruptions.length > 0
                ? activeDisruptions.map((d) => d.targetInletId).join(', ')
                : 'Nominal Drainage'}
            </span>
          </button>
        </div>

        {/* Sub-Tabs including full Decision Records Ledger */}
        <div className="flex flex-wrap items-center gap-1 bg-onyx-950 p-1 rounded border border-onyx-800 text-[11px] font-mono">
          {[
            { id: 'executive', label: '1. Executive & Hazard' },
            { id: 'interventions', label: '2. Interventions' },
            { id: 'robustness', label: '3. Stress Matrix' },
            { id: 'governance', label: '4. Governance Binding' },
            { id: 'records', label: '5. Decision Records' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeSubTab === tab.id
                  ? 'bg-onyx-800 text-white font-bold'
                  : 'text-storm-400 hover:text-storm-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recalculation Guard State */}
      {activeSubTab !== 'records' && (isComputingEvaluation || !briefing) ? (
        <div className="flex-1 bg-onyx-900 border border-onyx-800 rounded p-8 flex items-center justify-center">
          <div className="flex items-center gap-2.5 text-xs font-mono text-cyan-300">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Synchronizing Decision Briefing with active 2D hydraulic solver scenario...</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* SUBTAB 1: EXECUTIVE & BASELINE HAZARD */}
          {activeSubTab === 'executive' && briefing && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-onyx-900 border border-onyx-800 rounded p-3.5">
                  <span className="text-[10px] font-mono text-storm-400 uppercase block">
                    Scenario Screening Posture
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        briefing.incidentPosture === 'CRITICAL_HAZARD'
                          ? 'bg-red-500'
                          : briefing.incidentPosture === 'STAGED_MITIGATION'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                    />
                    <span className="text-lg font-bold font-mono text-white">
                      {briefing.incidentPosture.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="bg-onyx-900 border border-onyx-800 rounded p-3.5">
                  <span className="text-[10px] font-mono text-storm-400 uppercase block">
                    Baseline Surface Volume
                  </span>
                  <span className="text-xl font-bold font-mono text-red-400 mt-1 block">
                    {briefing.baselineAssessment.totalSurfaceVolumeM3.toLocaleString()} m³
                  </span>
                </div>

                <div className="bg-onyx-900 border border-onyx-800 rounded p-3.5">
                  <span className="text-[10px] font-mono text-storm-400 uppercase block">
                    Peak Depth &amp; Extent
                  </span>
                  <span className="text-xl font-bold font-mono text-amber-400 mt-1 block">
                    {(briefing.baselineAssessment.peakDepthM * 100).toFixed(1)} cm
                    <span className="text-xs text-storm-400 ml-1.5 font-normal">
                      ({(briefing.baselineAssessment.inundatedAreaM2 / 10000).toFixed(1)} ha)
                    </span>
                  </span>
                </div>

                <div className="bg-onyx-900 border border-onyx-800 rounded p-3.5">
                  <span className="text-[10px] font-mono text-storm-400 uppercase block">
                    Roads ≥30cm (Screening)
                  </span>
                  <span className="text-xl font-bold font-mono text-red-400 mt-1 block">
                    {briefing.baselineAssessment.impassableRoadCount} Corridors
                  </span>
                </div>
              </div>

              {/* Hospital Accessibility Matrix */}
              <div className="bg-onyx-900 border border-onyx-800 rounded p-4">
                <div className="flex items-center justify-between pb-2.5 border-b border-onyx-800 mb-3">
                  <h3 className="text-xs font-bold font-mono text-storm-100 uppercase tracking-wider flex items-center gap-2">
                    <Compass className="w-4 h-4 text-cyan-400" />
                    Critical Healthcare Access Screenings (5 Packaged Campuses)
                  </h3>
                  <span className="text-[11px] font-mono text-storm-400">
                    {briefing.baselineAssessment.compromisedHospitalCount} of {briefing.baselineAssessment.hospitals.length} screened at-risk
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-onyx-800 text-storm-400 uppercase text-[10px]">
                        <th className="py-2 px-3">Hospital Facility</th>
                        <th className="py-2 px-3">Campus Elev</th>
                        <th className="py-2 px-3">Standing Depth</th>
                        <th className="py-2 px-3">Screening Status</th>
                        <th className="py-2 px-3">Corridors ≥30cm</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-onyx-850">
                      {briefing.baselineAssessment.hospitals.map((h) => (
                        <tr key={h.name} className="hover:bg-onyx-850/40">
                          <td className="py-2 px-3 font-semibold text-white">{h.name}</td>
                          <td className="py-2 px-3 text-storm-300">{h.campusElevationM}m</td>
                          <td className="py-2 px-3 text-emerald-400">
                            {(h.standingWaterDepthM * 100).toFixed(1)} cm
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                h.overallStatus === 'FULLY_ACCESSIBLE'
                                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/60'
                                  : h.overallStatus === 'CAUTION_ACCESS_RESTRICTED'
                                  ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-700/60'
                                  : 'bg-amber-950/60 text-amber-300 border border-amber-700/60'
                              }`}
                            >
                              {h.overallStatus.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-storm-300">
                            {h.compromisedCorridors.length > 0 ? (
                              <span className="text-red-400 font-semibold">
                                {h.compromisedCorridors.join(', ')}
                              </span>
                            ) : (
                              <span className="text-storm-400">None (&lt;30cm)</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Cross-Stage Progression Buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => navigate('simulation')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-onyx-900 border border-onyx-700 hover:border-cyan-500 text-xs font-mono text-cyan-300"
                >
                  <Compass className="w-3.5 h-3.5" />
                  Inspect Simulation &amp; Disruption Map
                </button>
                <button
                  type="button"
                  onClick={() => navigate('interventions')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-onyx-900 border border-onyx-700 hover:border-safety-orange text-xs font-mono text-safety-orange"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  Open Side-by-Side Comparison
                </button>
                <button
                  type="button"
                  onClick={() => navigate('operations')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-safety-orange hover:bg-orange-600 text-xs font-mono font-bold text-white"
                >
                  <Ticket className="w-3.5 h-3.5" />
                  Proceed to Operational Work Orders
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* SUBTAB 2: COMPARATIVE INTERVENTIONS */}
          {activeSubTab === 'interventions' && briefing && (
            <div className="space-y-4">
              <div className="bg-onyx-900 border border-safety-orange/50 rounded p-4">
                <div className="flex items-center gap-2 text-xs font-mono text-safety-orange font-bold uppercase">
                  <Sparkles className="w-4 h-4" />
                  Objective Screening Rank #1: {briefing.recommendation.recommendedPlanName}
                </div>
                <p className="text-xs text-storm-200 mt-1.5 leading-relaxed">
                  {briefing.recommendation.rationale}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {briefing.interventionComparisons.map((plan) => (
                  <div
                    key={plan.planId}
                    className={`bg-onyx-900 rounded p-4 border flex flex-col justify-between ${
                      plan.planId === briefing.recommendation.recommendedPlanId
                        ? 'border-emerald-500/70'
                        : 'border-onyx-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-onyx-950 border border-onyx-800 text-storm-400">
                          {plan.planType.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-onyx-950 border border-onyx-700 text-storm-200 font-bold">
                          {plan.classification}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white mt-2">{plan.planName}</h4>
                      <div className="grid grid-cols-2 gap-2 my-3 pt-2 border-t border-onyx-800 font-mono text-xs">
                        <div>
                          <span className="text-[9px] text-storm-400 uppercase block">Avoided Storage</span>
                          <span className="text-emerald-400 font-bold">
                            {plan.avoidedSurfaceStorageM3 >= 0 ? '+' : ''}
                            {plan.avoidedSurfaceStorageM3.toLocaleString()} m³
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-storm-400 uppercase block">Peak Depth Δ</span>
                          <span className="text-white font-bold">
                            -{(plan.peakDepthReductionM * 100).toFixed(1)} cm
                          </span>
                        </div>
                      </div>

                      {plan.hasAdverseDeflection && (
                        <div className="bg-amber-950/40 border border-amber-700/60 rounded p-2 text-[11px] text-amber-200 mb-3">
                          <div className="flex items-center gap-1 font-mono font-bold text-amber-300 text-[10px]">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Adverse Local Ponding (+{(plan.maxAdverseDepthIncreaseM * 100).toFixed(1)}cm on {plan.adverseCellCount} cells)
                          </div>
                        </div>
                      )}

                      <div className="space-y-1 text-[11px] text-storm-300">
                        {plan.operationalTradeOffs.map((to, idx) => (
                          <div key={idx}>• {to}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUBTAB 3: CROSS-SCENARIO ROBUSTNESS MATRIX */}
          {activeSubTab === 'robustness' && briefing && (
            <div className="bg-onyx-900 border border-onyx-800 rounded p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-onyx-800">
                <div>
                  <h3 className="text-xs font-bold font-mono text-white uppercase">
                    Cross-Scenario Stress Matrix ({briefing.scenarioContext.disruptionId})
                  </h3>
                  <p className="text-[11px] text-amber-300 mt-0.5">
                    {briefing.crossScenarioRobustness.exploratoryNotice}
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-onyx-800 text-storm-400 uppercase text-[10px]">
                      <th className="py-2 px-3">Rainfall Profile</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3">Plan Alpha</th>
                      <th className="py-2 px-3">Plan Beta</th>
                      <th className="py-2 px-3">Plan Gamma</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-onyx-850">
                    {briefing.crossScenarioRobustness.matrix.map((row) => (
                      <tr key={row.profileId}>
                        <td className="py-2.5 px-3 text-white font-semibold">
                          {row.profileName.split('(')[0].trim()}
                        </td>
                        <td className="py-2.5 px-3 text-storm-300">
                          {row.isRegionalBenchmark ? 'NOAA Benchmark' : 'Synthetic Stress'}
                        </td>
                        <td className="py-2.5 px-3">
                          <div>{row.plans['plan-alpha'].avoidedStorageM3.toLocaleString()} m³</div>
                          <div className="text-[10px] text-amber-400">{row.plans['plan-alpha'].classification}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div>{row.plans['plan-beta'].avoidedStorageM3.toLocaleString()} m³</div>
                          <div className="text-[10px] text-cyan-400">{row.plans['plan-beta'].classification}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="text-emerald-400 font-bold">
                            {row.plans['plan-gamma'].avoidedStorageM3.toLocaleString()} m³
                          </div>
                          <div className="text-[10px] text-emerald-400">{row.plans['plan-gamma'].classification}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUBTAB 4: GOVERNANCE BINDING & DISCLOSURES */}
          {activeSubTab === 'governance' && briefing && (
            <div className="space-y-4">
              {!activeDecisionForScenario && latestHistoricalDecision && (
                <div className="bg-amber-950/35 border border-amber-700/60 rounded p-3 text-xs font-mono text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>
                    Historical decision <strong>{latestHistoricalDecision.decisionId || latestHistoricalDecision.id}</strong> belongs to a different scenario hash and is preserved immutably without being bound to the currently active scenario ({activeScenarioHash}).
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-onyx-900 border border-onyx-800 rounded p-4 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between border-b border-onyx-800 pb-2">
                    <span className="font-bold text-white uppercase flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Active Scenario Decision Binding
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-onyx-950 border border-onyx-700 text-storm-300">
                      {briefing.governanceAndStaging.hasActiveDecision ? 'BOUND' : 'NONE FOR ACTIVE HASH'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-storm-400">Decision ID:</span>
                    <span className="text-white font-bold">{briefing.governanceAndStaging.decisionId || 'None'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-storm-400">Authority:</span>
                    <span className="text-storm-200">{briefing.governanceAndStaging.approvedBy || 'Duty Incident Commander'}</span>
                  </div>
                  <div className="pt-2 border-t border-onyx-800">
                    <button
                      type="button"
                      onClick={() => setActiveSubTab('records')}
                      className="text-safety-orange hover:text-white font-bold inline-flex items-center gap-1"
                    >
                      Open Immutable Decision Records Ledger <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="bg-onyx-900 border border-onyx-800 rounded p-4 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between border-b border-onyx-800 pb-2">
                    <span className="font-bold text-white uppercase flex items-center gap-1.5">
                      <Ticket className="w-4 h-4 text-cyan-400" />
                      Scenario Work Order Binding
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-onyx-950 border border-onyx-700 text-storm-300">
                      {briefing.governanceAndStaging.workOrderStage || 'NONE'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-storm-400">Work Order ID:</span>
                    <span className="text-white font-bold">{briefing.governanceAndStaging.workOrderId || 'None bound'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-storm-400">Linked Jira Issue:</span>
                    <span className="text-safety-orange font-bold">{briefing.governanceAndStaging.linkedJiraIssueKey || 'None'}</span>
                  </div>
                  <div className="pt-2 border-t border-onyx-800">
                    <button
                      type="button"
                      onClick={() => navigate('operations')}
                      className="text-safety-orange hover:text-white font-bold inline-flex items-center gap-1"
                    >
                      Manage Staged Work Orders <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-onyx-900 border border-onyx-800 rounded p-4 space-y-2">
                <h4 className="text-xs font-bold font-mono text-storm-300 uppercase flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-storm-400" />
                  Technical Limitations &amp; Engineering Disclosures
                </h4>
                <ul className="space-y-1.5 text-xs text-storm-300">
                  {briefing.limitationsAndDisclosures.map((lim, idx) => (
                    <li key={idx}>• {lim}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* SUBTAB 5: FULL IMMUTABLE DECISION RECORDS LEDGER */}
          {activeSubTab === 'records' && (
            <DecisionRecordsView onNavigateToTickets={() => navigate('operations')} />
          )}
        </div>
      )}
    </div>
  );
};
