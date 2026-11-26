/**
 * DELTA Workstream 5: Decision Briefing View
 *
 * Dedicated executive & operational decision briefing view integrated into AppShell.
 * Provides:
 * 1. Incident Command Posture & Hydrometeorological Context
 * 2. Baseline Catchment Risk & Critical Healthcare Access Ingress Matrix
 * 3. Comparative Intervention Evaluation (Alpha, Beta, Gamma) with Honest Adverse Deflection Warnings
 * 4. Cross-Scenario Decision Robustness Matrix across all 4 Rainfall Profiles
 * 5. Incident Governance & Staged Work Order Operational Binding
 * 6. Export Engine (Markdown copy/download & print-ready HTML generation)
 * 7. Seamless Cross-Navigation to Map, Interventions, Decisions, and Tickets
 */

import React, { useState, useMemo, useEffect } from 'react';
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
  Info
} from 'lucide-react';
import { loadBostonCatchment } from '../../../data/catchmentLoader';
import {
  AUTHORITATIVE_STRESS_PROFILES,
  executeMultiScenarioEvaluation,
  MultiScenarioEvaluationResult
} from '../../../simulation/interventionEngine';
import {
  generateDecisionBriefing,
  executeCrossProfileRobustnessEvaluation,
  DecisionBriefing,
  CrossProfileMatrixEntry
} from '../../../simulation/decisionBriefingEngine';
import {
  exportBriefingToMarkdown,
  exportBriefingToHtml,
  downloadBriefingFile,
  copyBriefingToClipboard
} from '../../../simulation/briefingExporter';
import {
  getStoredWorkOrders,
  OperationalWorkOrder
} from '../../../simulation/workOrderEngine';
import { invokeSafe } from '../../../services/forgeBridge';

interface DecisionBriefingViewProps {
  onNavigateToTab?: (tab: 'overview' | 'simulation' | 'interventions' | 'decisions' | 'tickets') => void;
  selectedPlanId?: 'plan-alpha' | 'plan-beta' | 'plan-gamma';
}

export const DecisionBriefingView: React.FC<DecisionBriefingViewProps> = ({
  onNavigateToTab,
  selectedPlanId = 'plan-gamma'
}) => {
  const dataset = useMemo(() => loadBostonCatchment(), []);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('reference-noaa-50yr');
  const [activeSubTab, setActiveSubTab] = useState<'executive' | 'interventions' | 'robustness' | 'governance'>('executive');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [activeDecision, setActiveDecision] = useState<any | null>(null);
  const [stagedWorkOrders, setStagedWorkOrders] = useState<OperationalWorkOrder[]>([]);

  // Load latest decisions and work orders from Forge / local storage
  useEffect(() => {
    let isMounted = true;
    const fetchGovernance = async () => {
      // 1. Local work orders
      const localWos = getStoredWorkOrders();
      if (isMounted) setStagedWorkOrders(localWos);

      // 2. Forge work orders
      try {
        const res: any = await invokeSafe('listWorkOrders');
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          if (isMounted) {
            const merged = [...res.data];
            for (const loc of localWos) {
              if (!merged.some((m) => m.workOrderId === loc.workOrderId)) merged.push(loc);
            }
            setStagedWorkOrders(merged);
          }
        }
      } catch {
        // Fallback to local
      }

      // 3. Forge decisions
      try {
        const decRes: any = await invokeSafe('getDecisions');
        if (decRes && decRes.success && Array.isArray(decRes.data) && decRes.data.length > 0) {
          if (isMounted) setActiveDecision(decRes.data[0]);
        }
      } catch {
        // Fallback
      }
    };

    fetchGovernance();
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute evaluation for active profile
  const activeProfile = AUTHORITATIVE_STRESS_PROFILES[selectedProfileId] || AUTHORITATIVE_STRESS_PROFILES['reference-noaa-50yr'];

  const evaluationResult: MultiScenarioEvaluationResult = useMemo(() => {
    return executeMultiScenarioEvaluation(dataset, activeProfile);
  }, [dataset, activeProfile]);

  // Compute cross-profile matrix once
  const crossProfileMatrix: CrossProfileMatrixEntry[] = useMemo(() => {
    return executeCrossProfileRobustnessEvaluation(dataset);
  }, [dataset]);

  // Find active staged work order matching selected plan
  const matchedWorkOrder = useMemo(() => {
    return stagedWorkOrders.find((w) => w.planId === selectedPlanId) || stagedWorkOrders[0] || null;
  }, [stagedWorkOrders, selectedPlanId]);

  // Generate briefing
  const briefing: DecisionBriefing = useMemo(() => {
    return generateDecisionBriefing(
      evaluationResult,
      dataset,
      activeDecision,
      matchedWorkOrder,
      crossProfileMatrix
    );
  }, [evaluationResult, dataset, activeDecision, matchedWorkOrder, crossProfileMatrix]);

  // Export Handlers
  const handleCopyMarkdown = async () => {
    const md = exportBriefingToMarkdown(briefing);
    const ok = await copyBriefingToClipboard(md);
    if (ok) {
      setCopyFeedback('Markdown copied to clipboard');
      setTimeout(() => setCopyFeedback(null), 3000);
    }
  };

  const handleDownloadMarkdown = () => {
    const md = exportBriefingToMarkdown(briefing);
    downloadBriefingFile(`DELTA_Briefing_${briefing.briefingId}.md`, md, 'text/markdown');
  };

  const handlePrintOrDownloadHtml = () => {
    const html = exportBriefingToHtml(briefing);
    downloadBriefingFile(`DELTA_Briefing_${briefing.briefingId}.html`, html, 'text/html');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-onyx-950 text-storm-100 overflow-y-auto font-sans selection:bg-safety-orange selection:text-white">
      {/* Top Briefing Header */}
      <div className="bg-onyx-900 border-b border-onyx-800 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded bg-safety-orange/20 border border-safety-orange/40 text-safety-orange font-mono text-xs font-bold uppercase tracking-wider">
              Directive {briefing.briefingId}
            </span>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-safety-orange" />
              Tactical Decision Briefing
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs font-mono text-storm-400">
            <span>SCENARIO HASH:</span>
            <span className="text-storm-200 font-bold bg-onyx-950 px-1.5 py-0.5 rounded border border-onyx-800">
              {briefing.scenarioHash}
            </span>
            <span>•</span>
            <span className="text-storm-300">
              {new Date(briefing.generatedAt).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Action Controls & Exporters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {copyFeedback && (
            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1 animate-pulse">
              <Check className="w-3.5 h-3.5" />
              {copyFeedback}
            </span>
          )}

          <button
            onClick={handleCopyMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-onyx-800 hover:bg-onyx-700 text-storm-200 text-xs font-mono border border-onyx-700 transition-colors"
            title="Copy structured Markdown report to clipboard"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy Markdown
          </button>

          <button
            onClick={handleDownloadMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-onyx-800 hover:bg-onyx-700 text-storm-200 text-xs font-mono border border-onyx-700 transition-colors"
            title="Download structured Markdown file"
          >
            <Download className="w-3.5 h-3.5" />
            Export .MD
          </button>

          <button
            onClick={handlePrintOrDownloadHtml}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-safety-orange hover:bg-safety-orange/90 text-white font-mono text-xs font-bold shadow-sm transition-colors"
            title="Download self-contained, print-ready HTML executive report"
          >
            <Printer className="w-3.5 h-3.5" />
            Export HTML Report
          </button>
        </div>
      </div>

      {/* Mandatory Lockout Banner */}
      <div className="bg-red-950/40 border-b border-red-900/60 px-6 py-2.5 flex items-center justify-between text-xs text-red-200 font-mono">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span>
            <strong>PERMANENT DISPATCH LOCKOUT ACTIVE:</strong> {briefing.governanceAndStaging.dispatchLockoutNotice}
          </span>
        </div>
        <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-red-900/60 border border-red-700/60 text-[10px] text-red-100 uppercase tracking-widest font-bold">
          LOCKOUT ENFORCED
        </span>
      </div>

      {/* Profile Selector & Sub-Navigation */}
      <div className="bg-onyx-900/80 border-b border-onyx-800 px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Rainfall Profile Selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-storm-400 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            Active Profile:
          </span>
          <select
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
            className="bg-onyx-950 border border-onyx-700 text-xs font-mono text-storm-100 rounded px-3 py-1.5 focus:outline-none focus:border-safety-orange"
          >
            <option value="reference-noaa-50yr">
              NOAA Atlas 14 Benchmark (50-Yr 6-Hr, 104.2mm)
            </option>
            <option value="synthetic-moderate-stress">
              Synthetic Moderate Convective (1-Hr, 35.0mm)
            </option>
            <option value="synthetic-high-intensity">
              Synthetic High-Intensity Burst (30-Min, 37.5mm)
            </option>
            <option value="synthetic-low-intensity">
              Synthetic Low-Intensity Sensitivity (1-Hr, 15.0mm)
            </option>
          </select>

          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${
              briefing.scenarioContext.isRegionalBenchmark
                ? 'bg-cyan-950/60 border-cyan-700/60 text-cyan-300'
                : 'bg-safety-orange/20 border-safety-orange/40 text-safety-orange'
            }`}
          >
            {briefing.scenarioContext.isRegionalBenchmark ? 'REGIONAL NOAA BENCHMARK' : 'SYNTHETIC STRESS'}
          </span>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-1 bg-onyx-950 p-1 rounded border border-onyx-800 text-xs font-mono">
          <button
            onClick={() => setActiveSubTab('executive')}
            className={`px-3 py-1 rounded transition-colors ${
              activeSubTab === 'executive'
                ? 'bg-onyx-800 text-white font-bold'
                : 'text-storm-400 hover:text-storm-200'
            }`}
          >
            1. Executive & Hazard
          </button>
          <button
            onClick={() => setActiveSubTab('interventions')}
            className={`px-3 py-1 rounded transition-colors ${
              activeSubTab === 'interventions'
                ? 'bg-onyx-800 text-white font-bold'
                : 'text-storm-400 hover:text-storm-200'
            }`}
          >
            2. Interventions
          </button>
          <button
            onClick={() => setActiveSubTab('robustness')}
            className={`px-3 py-1 rounded transition-colors ${
              activeSubTab === 'robustness'
                ? 'bg-onyx-800 text-white font-bold'
                : 'text-storm-400 hover:text-storm-200'
            }`}
          >
            3. Stress Matrix
          </button>
          <button
            onClick={() => setActiveSubTab('governance')}
            className={`px-3 py-1 rounded transition-colors ${
              activeSubTab === 'governance'
                ? 'bg-onyx-800 text-white font-bold'
                : 'text-storm-400 hover:text-storm-200'
            }`}
          >
            4. Governance & Tickets
          </button>
        </div>
      </div>

      {/* Main Briefing Content */}
      <div className="flex-1 p-6 space-y-6 max-w-7xl w-full mx-auto">
        {/* SUBTAB 1: EXECUTIVE & BASELINE HAZARD */}
        {activeSubTab === 'executive' && (
          <div className="space-y-6">
            {/* Top Posture Banner */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-onyx-900 border border-onyx-800 rounded-lg p-4">
                <span className="text-[11px] font-mono text-storm-400 uppercase tracking-wider block">
                  Incident Posture
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      briefing.incidentPosture === 'CRITICAL_HAZARD'
                        ? 'bg-red-500 animate-pulse'
                        : briefing.incidentPosture === 'STAGED_MITIGATION'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                  />
                  <span className="text-xl font-bold font-mono text-white">
                    {briefing.incidentPosture.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="bg-onyx-900 border border-onyx-800 rounded-lg p-4">
                <span className="text-[11px] font-mono text-storm-400 uppercase tracking-wider block">
                  Surface Water Storage
                </span>
                <span className="text-2xl font-bold font-mono text-red-400 mt-1 block">
                  {briefing.baselineAssessment.totalSurfaceVolumeM3.toLocaleString()} m³
                </span>
              </div>

              <div className="bg-onyx-900 border border-onyx-800 rounded-lg p-4">
                <span className="text-[11px] font-mono text-storm-400 uppercase tracking-wider block">
                  Peak Depth & Extent
                </span>
                <span className="text-2xl font-bold font-mono text-amber-400 mt-1 block">
                  {(briefing.baselineAssessment.peakDepthM * 100).toFixed(1)} cm
                  <span className="text-xs text-storm-400 ml-1.5 font-normal">
                    ({(briefing.baselineAssessment.inundatedAreaM2 / 10000).toFixed(1)} ha)
                  </span>
                </span>
              </div>

              <div className="bg-onyx-900 border border-onyx-800 rounded-lg p-4">
                <span className="text-[11px] font-mono text-storm-400 uppercase tracking-wider block">
                  Impassable Arterials
                </span>
                <span className="text-2xl font-bold font-mono text-red-400 mt-1 block">
                  {briefing.baselineAssessment.impassableRoadCount} Corridors
                  <span className="text-xs text-storm-400 ml-1.5 font-normal">
                    (≥30cm)
                  </span>
                </span>
              </div>
            </div>

            {/* Hospital Accessibility Matrix */}
            <div className="bg-onyx-900 border border-onyx-800 rounded-lg p-5">
              <div className="flex items-center justify-between pb-3 border-b border-onyx-800 mb-4">
                <div>
                  <h3 className="text-sm font-bold font-mono text-storm-100 uppercase tracking-wider flex items-center gap-2">
                    <Compass className="w-4 h-4 text-cyan-400" />
                    Critical Healthcare Ingress Screenings
                  </h3>
                  <p className="text-xs text-storm-400 mt-0.5">
                    Evaluates physical 2D depth at campus ground elevation vs surrounding arterial access corridors.
                  </p>
                </div>
                <span className="text-xs font-mono text-storm-400">
                  {briefing.baselineAssessment.compromisedHospitalCount} of {briefing.baselineAssessment.hospitals.length} at risk
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-onyx-800 text-storm-400 uppercase text-[11px]">
                      <th className="py-2.5 px-3">Hospital Facility</th>
                      <th className="py-2.5 px-3">Campus Elev</th>
                      <th className="py-2.5 px-3">Standing Water</th>
                      <th className="py-2.5 px-3">Ingress Status</th>
                      <th className="py-2.5 px-3">Screened Blockages (≥30cm)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-onyx-850">
                    {briefing.baselineAssessment.hospitals.map((h) => (
                      <tr key={h.name} className="hover:bg-onyx-850/50">
                        <td className="py-2.5 px-3 font-semibold text-white">
                          {h.name}
                        </td>
                        <td className="py-2.5 px-3 text-storm-300">
                          {h.campusElevationM}m
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={
                              h.standingWaterDepthM >= 0.05
                                ? 'text-amber-400 font-bold'
                                : 'text-emerald-400'
                            }
                          >
                            {(h.standingWaterDepthM * 100).toFixed(1)} cm
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
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
                        <td className="py-2.5 px-3 text-storm-300">
                          {h.compromisedCorridors.length > 0 ? (
                            <span className="text-red-400 font-semibold">
                              {h.compromisedCorridors.join(', ')}
                            </span>
                          ) : (
                            <span className="text-storm-400">All corridors passable (&lt;30cm)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick Action Navigation Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => onNavigateToTab?.('simulation')}
                className="flex items-center gap-2 px-4 py-2 rounded bg-onyx-900 border border-onyx-700 hover:border-cyan-500 text-xs font-mono text-cyan-300 hover:text-white transition-colors"
              >
                <Compass className="w-4 h-4" />
                Inspect Catchment Map & Layers
              </button>
              <button
                onClick={() => onNavigateToTab?.('interventions')}
                className="flex items-center gap-2 px-4 py-2 rounded bg-onyx-900 border border-onyx-700 hover:border-safety-orange text-xs font-mono text-safety-orange hover:text-white transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                Compare Physical Interventions
              </button>
              <button
                onClick={() => onNavigateToTab?.('tickets')}
                className="flex items-center gap-2 px-4 py-2 rounded bg-onyx-900 border border-onyx-700 hover:border-emerald-500 text-xs font-mono text-emerald-300 hover:text-white transition-colors"
              >
                <Ticket className="w-4 h-4" />
                View Staged Operational Tickets
              </button>
            </div>
          </div>
        )}

        {/* SUBTAB 2: COMPARATIVE INTERVENTIONS */}
        {activeSubTab === 'interventions' && (
          <div className="space-y-6">
            {/* Recommendation Callout */}
            <div className="bg-onyx-900 border border-safety-orange/50 rounded-lg p-5">
              <div className="flex items-center gap-2 text-xs font-mono text-safety-orange font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                Incident Commander Recommendation: {briefing.recommendation.recommendedPlanName}
              </div>
              <p className="text-sm text-storm-200 mt-2 leading-relaxed">
                {briefing.recommendation.rationale}
              </p>
              <div className="flex items-center gap-4 mt-3 text-xs font-mono text-storm-400">
                <span>Volume Winner: <strong className="text-white">{briefing.recommendation.volumeRankingWinner}</strong></span>
                <span>•</span>
                <span>Road Restoration Winner: <strong className="text-white">{briefing.recommendation.roadRankingWinner}</strong></span>
              </div>
            </div>

            {/* Plan Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {briefing.interventionComparisons.map((plan) => (
                <div
                  key={plan.planId}
                  className={`bg-onyx-900 rounded-lg p-5 border flex flex-col justify-between ${
                    plan.planId === briefing.recommendation.recommendedPlanId
                      ? 'border-emerald-500/70 shadow-lg shadow-emerald-950/20'
                      : 'border-onyx-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-onyx-950 border border-onyx-800 text-storm-400 uppercase">
                        {plan.planType.replace('_', ' ')}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase border ${
                          plan.classification === 'MEASURABLE_BENEFIT'
                            ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                            : plan.classification === 'ADVERSE_LOCAL_DEFLECTION'
                            ? 'bg-amber-950/60 border-amber-700/60 text-amber-300'
                            : plan.classification === 'CAPACITY_CONSTRAINED'
                            ? 'bg-cyan-950/60 border-cyan-700/60 text-cyan-300'
                            : 'bg-onyx-950 border-onyx-800 text-storm-400'
                        }`}
                      >
                        {plan.classification}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-white mt-2 leading-snug">
                      {plan.planName}
                    </h4>
                    <p className="text-xs text-storm-400 font-mono mt-1">
                      {plan.resourceCost}
                    </p>

                    {/* KPIs */}
                    <div className="grid grid-cols-2 gap-3 my-4 pt-3 border-t border-onyx-800">
                      <div>
                        <span className="text-[10px] font-mono text-storm-400 uppercase block">
                          Avoided Storage
                        </span>
                        <span className="text-lg font-bold font-mono text-emerald-400">
                          +{plan.avoidedSurfaceStorageM3.toLocaleString()} m³
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-storm-400 uppercase block">
                          Peak Depth Δ
                        </span>
                        <span className="text-lg font-bold font-mono text-white">
                          -{(plan.peakDepthReductionM * 100).toFixed(1)} cm
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-storm-400 uppercase block">
                          Roads Protected
                        </span>
                        <span className="text-sm font-bold font-mono text-cyan-300">
                          +{plan.netProtectedRoadCount} Corridors
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-storm-400 uppercase block">
                          Extraction Sink
                        </span>
                        <span className="text-sm font-bold font-mono text-storm-200">
                          {plan.interventionSinkExtractionM3.toLocaleString()} m³
                        </span>
                      </div>
                    </div>

                    {/* Adverse Deflection Surcharge Notice */}
                    {plan.hasAdverseDeflection && (
                      <div className="bg-amber-950/40 border border-amber-700/60 rounded p-2.5 text-xs text-amber-200 mb-4">
                        <div className="flex items-center gap-1.5 font-bold font-mono text-amber-300">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                          Adverse Surcharge Warning
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed">
                          Produces +{(plan.maxAdverseDepthIncreaseM * 100).toFixed(1)} cm local water rise on {plan.adverseCellCount} cells ({plan.adverseAreaM2} m²). Deflected volume: {plan.deflectedVolumeM3.toLocaleString()} m³.
                        </p>
                      </div>
                    )}

                    {/* Operational Trade-Offs */}
                    <div className="text-xs text-storm-300 space-y-1.5">
                      <span className="font-mono text-[10px] text-storm-400 uppercase block font-bold">
                        Key Trade-Offs:
                      </span>
                      {plan.operationalTradeOffs.map((to, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[11px] text-storm-300">
                          <span className="text-safety-orange">•</span>
                          <span>{to}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-onyx-800 flex justify-between items-center text-xs font-mono">
                    <span className="text-storm-400">{plan.targetInfrastructure.split('(')[0]}</span>
                    <button
                      onClick={() => onNavigateToTab?.('interventions')}
                      className="text-safety-orange hover:text-white flex items-center gap-1 font-bold"
                    >
                      Inspect Plan
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBTAB 3: CROSS-SCENARIO ROBUSTNESS MATRIX */}
        {activeSubTab === 'robustness' && (
          <div className="space-y-6">
            <div className="bg-onyx-900 border border-onyx-800 rounded-lg p-5">
              <div className="flex items-center justify-between pb-3 border-b border-onyx-800 mb-4">
                <div>
                  <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-safety-orange" />
                    Cross-Scenario Decision Robustness Matrix
                  </h3>
                  <p className="text-xs text-amber-300 mt-0.5">
                    ℹ️ {briefing.crossScenarioRobustness.exploratoryNotice}
                  </p>
                </div>
                <span className="text-xs font-mono text-storm-400">
                  {briefing.crossScenarioRobustness.profilesEvaluatedCount} Evaluated Profiles
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-onyx-800 text-storm-400 uppercase text-[11px]">
                      <th className="py-2.5 px-3">Rainfall Stress Profile</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Total Depth</th>
                      <th className="py-2.5 px-3">Plan Alpha (Barrier)</th>
                      <th className="py-2.5 px-3">Plan Beta (Pump)</th>
                      <th className="py-2.5 px-3">Plan Gamma (Culvert)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-onyx-850">
                    {briefing.crossScenarioRobustness.matrix.map((row) => (
                      <tr key={row.profileId} className="hover:bg-onyx-850/50">
                        <td className="py-3 px-3 font-semibold text-white">
                          {row.profileName.split('(')[0].trim()}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              row.isRegionalBenchmark
                                ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-700/60'
                                : 'bg-safety-orange/20 text-safety-orange border border-safety-orange/40'
                            }`}
                          >
                            {row.isRegionalBenchmark ? 'NOAA Benchmark' : 'Synthetic Stress'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-storm-200">
                          {row.totalRainfallMm} mm
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-storm-200">
                            {row.plans['plan-alpha'].avoidedStorageM3.toLocaleString()} m³
                          </div>
                          <div className="text-[10px] text-amber-400">
                            {row.plans['plan-alpha'].classification === 'ADVERSE_LOCAL_DEFLECTION'
                              ? '⚠️ Surcharge'
                              : row.plans['plan-alpha'].classification}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-storm-200">
                            {row.plans['plan-beta'].avoidedStorageM3.toLocaleString()} m³
                          </div>
                          <div className="text-[10px] text-cyan-400">
                            {row.plans['plan-beta'].classification}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-emerald-400">
                            +{row.plans['plan-gamma'].avoidedStorageM3.toLocaleString()} m³
                          </div>
                          <div className="text-[10px] text-emerald-400">
                            {row.plans['plan-gamma'].classification}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Robustness Key Insights */}
            <div className="bg-onyx-900 border border-onyx-800 rounded-lg p-5">
              <h4 className="text-xs font-bold font-mono text-storm-300 uppercase tracking-wider mb-3">
                Key Robustness Takeaways
              </h4>
              <div className="space-y-2">
                {briefing.crossScenarioRobustness.keyInsights.map((insight, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-storm-300">
                    <span className="text-cyan-400 font-mono">[{idx + 1}]</span>
                    <span>{insight}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 4: GOVERNANCE & TICKETS */}
        {activeSubTab === 'governance' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Active Decision Card */}
              <div className="bg-onyx-900 border border-onyx-800 rounded-lg p-5">
                <div className="flex items-center justify-between pb-3 border-b border-onyx-800 mb-3">
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Human Decision Record
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/60 text-emerald-300">
                    {briefing.governanceAndStaging.hasActiveDecision ? 'RECORDED' : 'UNRECORDED'}
                  </span>
                </div>

                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-storm-400">Decision ID:</span>
                    <span className="text-storm-200 font-bold">{briefing.governanceAndStaging.decisionId || 'None'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-storm-400">Incident Commander:</span>
                    <span className="text-storm-200">{briefing.governanceAndStaging.approvedBy || 'Duty Incident Commander'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-storm-400">Approval Timestamp:</span>
                    <span className="text-storm-300">{briefing.governanceAndStaging.approvalTimestamp || 'Pending'}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-onyx-800">
                  <button
                    onClick={() => onNavigateToTab?.('decisions')}
                    className="text-xs font-mono text-safety-orange hover:text-white flex items-center gap-1.5 font-bold"
                  >
                    View Decision Records Tab
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Staged Work Order Card */}
              <div className="bg-onyx-900 border border-onyx-800 rounded-lg p-5">
                <div className="flex items-center justify-between pb-3 border-b border-onyx-800 mb-3">
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Ticket className="w-4 h-4 text-cyan-400" />
                    Staged Operational Work Order
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-700/60 text-cyan-300">
                    {briefing.governanceAndStaging.workOrderStage || 'N/A'}
                  </span>
                </div>

                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-storm-400">Work Order ID:</span>
                    <span className="text-storm-200 font-bold">{briefing.governanceAndStaging.workOrderId || 'None staged'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-storm-400">Urgency:</span>
                    <span className="text-storm-200">{briefing.governanceAndStaging.urgency || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-storm-400">Linked Jira Issue:</span>
                    <span className="text-safety-orange font-bold">{briefing.governanceAndStaging.linkedJiraIssueKey || 'None linked'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-storm-400">Target Location Provenance:</span>
                    <span className="text-cyan-300 font-bold">{briefing.governanceAndStaging.locationProvenance || 'DERIVED'}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-onyx-800">
                  <button
                    onClick={() => onNavigateToTab?.('tickets')}
                    className="text-xs font-mono text-safety-orange hover:text-white flex items-center gap-1.5 font-bold"
                  >
                    View Operational Tickets Queue
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Technical Disclosures */}
            <div className="bg-onyx-900 border border-onyx-800 rounded-lg p-5">
              <h4 className="text-xs font-bold font-mono text-storm-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-storm-400" />
                Technical Disclosures & Limitations
              </h4>
              <ul className="space-y-2">
                {briefing.limitationsAndDisclosures.map((lim, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-storm-300">
                    <span className="text-safety-orange font-mono">•</span>
                    <span>{lim}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
