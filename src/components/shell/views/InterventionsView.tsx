/**
 * DELTA Stage 03: Intervention Planning Workspace
 *
 * Map-first comparative decision lab evaluating Plan Alpha (Francis St Barrier),
 * Plan Beta (Mobile Pump #1), and Plan Gamma (Brookline Culvert Jetting) against
 * an identical baseline under the shared active rainfall profile and active disruptions.
 *
 * Features:
 * - Synchronized Side-by-Side, Comparison Curtain, and Signed Δh Overlay canvas modes
 * - Shared cell inspector displaying Baseline depth, Plan depth, and signed Δh = h_baseline - h_plan
 * - Honest adverse local ponding warnings (e.g., Plan Alpha surcharge)
 * - Discrete solver-derived temporal threshold screening (with explicit Δt resolution disclosure)
 * - Human Commander Decision Authorization bound strictly to the active scenario
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  X,
  Lock,
  CloudRain,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  Droplets
} from 'lucide-react';
import {
  AUTHORITATIVE_INTERVENTIONS,
  AUTHORITATIVE_STRESS_PROFILES,
  EffectivenessClassification,
  InterventionDefinition,
  plainStormHint,
  plainStormLabel
} from '../../../simulation/interventionEngine';
import { StageIntro } from '../../common/StageIntro';
import { useIncidentWorkspace, PlanId } from '../../../context/IncidentWorkspaceContext';
import { invokeSafe } from '../../../services/forgeBridge';
import {
  SplitComparisonCanvas,
  ComparisonViewMode
} from '../../simulation/SplitComparisonCanvas';
import { CanvasLayerDock } from '../../simulation/CanvasLayerDock';
import { prepareWorkOrderFromDecision, saveStoredWorkOrder } from '../../../simulation/workOrderEngine';

interface InterventionsViewProps {
  onNavigateToDecisions?: () => void;
}

function formatSecondsCompact(seconds: number | null): string {
  if (seconds === null) return 'Never';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  }
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export const InterventionsView: React.FC<InterventionsViewProps> = ({
  onNavigateToDecisions
}) => {
  const {
    dataset,
    setActiveStage,
    activeProfileId,
    activeProfile,
    setActiveProfileId,
    activeDisruptionIds,
    activeDisruptions,
    selectedPlanId,
    setSelectedPlanId,
    evaluationResult,
    isComputingEvaluation,
    evaluationError,
    activeScenarioHash,
    recomputeActiveScenario,
    workOrders,
    canvasLayers,
    toggleCanvasLayer,
    selectedCell,
    setSelectedCell,
    selectedRoadId,
    setSelectedRoadId,
    selectedFacilityId,
    setSelectedFacilityId,
    registerNewDecision,
    refreshGovernanceRecords
  } = useIncidentWorkspace();

  const [comparisonMode, setComparisonMode] = useState<ComparisonViewMode>('side-by-side');
  const [showFullComparisonDrawer, setShowFullComparisonDrawer] = useState<boolean>(false);
  const [showTemporalSection, setShowTemporalSection] = useState<boolean>(true);

  // Commander Approval Modal State
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState<boolean>(false);
  const [engineeringRationale, setEngineeringRationale] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [approvedRecord, setApprovedRecord] = useState<any | null>(null);
  const [publishToConfluence, setPublishToConfluence] = useState<boolean>(false);
  const [confluenceNotice, setConfluenceNotice] = useState<string | null>(null);
  const [confluenceSpaceKey, setConfluenceSpaceKey] = useState<string>('');
  const [confluencePageUrl, setConfluencePageUrl] = useState<string | null>(null);

  const selectedPlanDef: InterventionDefinition = AUTHORITATIVE_INTERVENTIONS[selectedPlanId];
  const selectedDiff = evaluationResult?.differentials[selectedPlanId] || null;
  const selectedPlanMetrics = evaluationResult
    ? selectedPlanId === 'plan-alpha'
      ? evaluationResult.planAlpha
      : selectedPlanId === 'plan-beta'
      ? evaluationResult.planBeta
      : evaluationResult.planGamma
    : null;

  // Keep default engineering rationale synchronized with selected plan + active profile + disruptions
  useEffect(() => {
    const disruptionLabel =
      activeDisruptions.length === 0
        ? 'nominal unobstructed drainage'
        : activeDisruptions.map((d) => d.targetInletId).join(', ') + ' disruption(s)';

    if (selectedPlanId === 'plan-gamma') {
      setEngineeringRationale(
        `Plan Gamma (Emergency Culvert Jetting) evaluated under ${activeProfile.name} with ${disruptionLabel}. ` +
        `Models clearing CULVERT-01-BROOKLINE to 12.5 m³/s nominal heuristic capacity. ` +
        `Disclosed limitation: culvert is represented as a road-deck point sink at cell [17, 26] (7.51m NAVD88), not a coupled 1D barrel.`
      );
    } else if (selectedPlanId === 'plan-beta') {
      setEngineeringRationale(
        `Plan Beta (Mobile Pump #1) evaluated under ${activeProfile.name} with ${disruptionLabel}. ` +
        `Models a 2.0 m³/s mass-conserving point suction sink at retention channel [17, 25], subject to physical inflow capacity limits.`
      );
    } else {
      setEngineeringRationale(
        `Plan Alpha (Francis St Barrier) evaluated under ${activeProfile.name} with ${disruptionLabel}. ` +
        `Models +0.50m surface crest barriers along Francis St cells. Evaluation explicitly acknowledges localized adverse deflection ponding on adjacent cells without reducing catchment-wide storage.`
      );
    }
  }, [selectedPlanId, activeProfile.name, activeDisruptions]);

  const renderClassificationBadge = (classification: EffectivenessClassification) => {
    switch (classification) {
      case 'ADVERSE_LOCAL_DEFLECTION':
        return (
          <span className="px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-600/70 text-[9px] font-mono font-bold">
            ADVERSE DEFLECTION
          </span>
        );
      case 'CAPACITY_CONSTRAINED':
        return (
          <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-700/70 text-[9px] font-mono font-bold">
            CAPACITY CONSTRAINED
          </span>
        );
      case 'MEASURABLE_BENEFIT':
        return (
          <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/70 text-[9px] font-mono font-bold">
            MEASURABLE BENEFIT
          </span>
        );
      case 'NEGLIGIBLE_IMPACT':
        return (
          <span className="px-1.5 py-0.5 rounded bg-onyx-800 text-storm-300 border border-onyx-700 text-[9px] font-mono font-bold">
            NEGLIGIBLE IMPACT
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.5 rounded bg-onyx-800 text-storm-400 border border-onyx-700 text-[9px] font-mono font-bold">
            INCONCLUSIVE
          </span>
        );
    }
  };

  const planShortLabel =
    selectedPlanId === 'plan-alpha'
      ? 'Plan Alpha (Barrier)'
      : selectedPlanId === 'plan-beta'
      ? 'Plan Beta (Mobile Pump)'
      : 'Plan Gamma (Culvert Jetting)';

  const handleProceedToBriefing = () => {
    if (onNavigateToDecisions) onNavigateToDecisions();
    else setActiveStage('briefing');
  };

  const handleConfirmDecision = async () => {
    if (!evaluationResult || !selectedDiff || !selectedPlanMetrics || !activeScenarioHash) return;
    setIsSubmitting(true);
    setApprovalError(null);

    const payload = {
      chosenPlan: {
        planId: selectedPlanDef.id,
        name: selectedPlanDef.name,
        type: selectedPlanDef.type
      },
      canonicalScenario: {
        stormId: activeProfile.id,
        stormLabel: activeProfile.name,
        stormDepthMm: activeProfile.totalRainfallMm,
        durationHours: activeProfile.durationHours,
        disruptionId: evaluationResult.simulationMetadata.disruptionId,
        activeDisruptionIds: evaluationResult.simulationMetadata.activeDisruptionIds,
        briefingScenarioHash: activeScenarioHash,
        cellResolutionM: 25.0,
        gridDimensions: '64x64',
        infiltrationRateMmPerHour: 2.0,
        manningN: 0.025,
        sector: 'Boston Longwood Medical Area & Muddy River Catchment (EPSG:26986)',
        provenance: activeProfile.provenance
      },
      baselineMetrics: {
        currentStorageM3: evaluationResult.baseline.currentStorageM3,
        maxWaterDepthM: evaluationResult.baseline.maxWaterDepthM,
        impassableRoadCount: evaluationResult.baseline.impassableRoadCount
      },
      interventionMetrics: {
        currentStorageM3: selectedPlanMetrics.currentStorageM3,
        maxWaterDepthM: selectedPlanMetrics.maxWaterDepthM,
        impassableRoadCount: selectedPlanMetrics.impassableRoadCount
      },
      differentialMetrics: {
        avoidedSurfaceVolumeM3: selectedDiff.avoidedSurfaceVolumeM3,
        peakDepthReductionM: selectedDiff.peakDepthReductionM,
        protectedRoadCount: selectedDiff.protectedRoadCount,
        protectedRoadNames: selectedDiff.protectedRoadNames
      },
      engineeringRationale: engineeringRationale.trim(),
      schemaVersion: '2.0.0',
      humanApprover: {
        displayName: 'Duty Incident Commander',
        role: 'Incident Commander'
      }
    };

    try {
      const res: any = await invokeSafe('recordDecision', payload);
      if (res && res.success) {
        const saved = res.data || res.record || {
          ...payload,
          decisionId: `DEC-${activeScenarioHash.replace('0X', '').slice(0, 8)}`,
          scenarioHash: activeScenarioHash,
          status: 'APPROVED',
          createdAt: new Date().toISOString()
        };
        setApprovedRecord(saved);
        if (publishToConfluence) {
          try {
            const pub: any = await invokeSafe('publishAuditToConfluence', { decisionId: saved.decisionId, spaceKey: confluenceSpaceKey.trim() || undefined });
            if (pub?.success) { setConfluencePageUrl(pub.pageUrl || null); setConfluenceNotice(`Audit page published to Confluence space ${pub.spaceKey || confluenceSpaceKey || '(auto-discovered)'}${pub.pageId ? ` (page ${pub.pageId})` : ''}.`); } else setConfluenceNotice(pub?.error?.message || pub?.message || 'Confluence audit export was not completed (requires Forge Confluence access).');
          } catch { setConfluenceNotice('Confluence audit export was not completed (requires Forge Confluence access).'); }
        }
        registerNewDecision(saved);
        // Stage a real work order bound to the server-saved decision so Step 05
        // dispatch operates on a decisionId that actually exists in KVS.
        try {
          const staged = { ...prepareWorkOrderFromDecision(saved, 'COMMANDER_STAGED'), stage: 'COMMANDER_STAGED' as const, updatedAt: new Date().toISOString() };
          saveStoredWorkOrder(staged);
          await invokeSafe('saveWorkOrder', staged);
        } catch { /* decision is saved; work order can still be staged from Decision Records */ }
        await refreshGovernanceRecords();
        setIsApprovalModalOpen(false);
      } else {
        setApprovalError(res?.error?.message || res?.message || 'Server rejected decision record approval.');
      }
    } catch (err: any) {
      setApprovalError(err?.message || String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      <StageIntro subtitle="Compare the three fixes side by side, pick the one that keeps hospital roads open, then approve it." />
      {/* Compact Top Scenario & Plan Selection Strip */}
      <div className="bg-onyx-900 border border-onyx-800 rounded px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Synchronized Rainfall Profile */}
          <div className="flex items-center gap-1.5">
            <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
            <select
              aria-label="Intervention evaluation rainfall profile"
              value={activeProfileId}
              onChange={(e) => setActiveProfileId(e.target.value)}
              disabled={isComputingEvaluation}
              className="bg-onyx-950 border border-onyx-700 rounded px-2 py-1 text-[11px] font-mono text-storm-100 focus:outline-none focus:border-safety-orange max-w-[260px]"
            >
              {Object.values(AUTHORITATIVE_STRESS_PROFILES).map((p) => (
                <option key={p.id} value={p.id}>
                  {plainStormLabel(p)} — {p.name}
                </option>
              ))}
            </select>
            <span className="hidden 2xl:inline text-[10px] text-cyan-200 max-w-[200px]">{plainStormHint(activeProfile)}</span>
          </div>

          {/* Active Disruption State Pill (Linked to Stage 02) */}
          <button
            type="button"
            onClick={() => setActiveStage('simulation')}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-mono transition-colors ${
              activeDisruptionIds.length > 0
                ? 'bg-safety-orange/15 border-safety-orange/40 text-safety-orange hover:border-safety-orange'
                : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300 hover:border-emerald-600'
            }`}
            title="Edit drainage disruption configuration in Stage 02"
          >
            <AlertOctagon className="w-3 h-3" />
            <span>
              {activeDisruptionIds.length > 0
                ? `${activeDisruptionIds.length} Disruption(s) Applied`
                : 'Nominal Drainage (0 Disruptions)'}
            </span>
          </button>

          <button
            type="button"
            onClick={recomputeActiveScenario}
            disabled={isComputingEvaluation}
            className="p-1.5 rounded bg-onyx-950 hover:bg-onyx-800 border border-onyx-700 text-storm-300 disabled:opacity-50"
            title="Recompute baseline and all 3 plans"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isComputingEvaluation ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!evaluationResult || isComputingEvaluation}
            onClick={() => {
              setApprovalError(null);
              setIsApprovalModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-safety-orange hover:bg-orange-600 text-white text-[11px] font-mono font-bold transition-colors disabled:opacity-50"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Approve Decision — {selectedPlanId.replace('plan-', 'Plan ').toUpperCase()}</span>
          </button>

          <button
            type="button"
            onClick={handleProceedToBriefing}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-onyx-800 hover:bg-onyx-700 border border-onyx-700 text-white text-xs font-mono font-bold transition-colors"
          >
            <span>Decision &amp; Briefing</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Candidate Plan Selector Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {(['plan-alpha', 'plan-beta', 'plan-gamma'] as PlanId[]).map((pid) => {
          const def = AUTHORITATIVE_INTERVENTIONS[pid];
          const diff = evaluationResult?.differentials[pid];
          const isSelected = selectedPlanId === pid;
          const isRecommended = evaluationResult?.ranking.recommendedPlanId === pid;

          return (
            <button
              key={pid}
              type="button"
              onClick={() => setSelectedPlanId(pid)}
              className={`text-left px-3 py-2 rounded border transition-colors ${
                isSelected
                  ? 'bg-onyx-850 border-safety-orange ring-1 ring-safety-orange/40'
                  : 'bg-onyx-900 border-onyx-800 hover:border-onyx-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-white truncate">
                  {def.name.split(':')[0]}
                </span>
                <div className="flex items-center gap-1">
                  {isRecommended && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60 text-[9px] font-mono font-bold">
                      RANK #1
                    </span>
                  )}
                  {diff && renderClassificationBadge(diff.classification)}
                </div>
              </div>
              <div className="text-[11px] text-storm-300 truncate mt-0.5">
                {def.name.split(':')[1]?.trim() || def.targetInfrastructure}
              </div>
              {diff ? (
                <div className="flex items-center justify-between gap-2 mt-1.5 text-[10px] font-mono">
                  <span className={diff.avoidedSurfaceVolumeM3 > 0 ? 'text-emerald-400 font-bold' : 'text-storm-400'}>
                    {diff.avoidedSurfaceVolumeM3 >= 0 ? '+' : ''}
                    {diff.avoidedSurfaceVolumeM3.toLocaleString()} m³ avoided
                  </span>
                  <span className={diff.spatialDeflection.adverseCellCount > 0 ? 'text-amber-300 font-bold' : 'text-storm-400'}>
                    {diff.spatialDeflection.adverseCellCount > 0
                      ? `⚠ +${(diff.spatialDeflection.maxAdverseDepthIncreaseM * 100).toFixed(1)}cm rise (${diff.spatialDeflection.adverseCellCount} cells)`
                      : '0 adverse cells'}
                  </span>
                </div>
              ) : (
                <div className="text-[10px] font-mono text-storm-500 mt-1.5">Computing...</div>
              )}
            </button>
          );
        })}
      </div>

      {/* Confirmation Banner after Approval */}
      {approvedRecord && (
        <div className="bg-emerald-950/40 border border-emerald-700/60 rounded px-3.5 py-2 flex items-center justify-between gap-3 text-xs font-mono text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>
              Decision <strong>{approvedRecord.decisionId}</strong> recorded for{' '}
              <strong>{approvedRecord.chosenPlan?.name}</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={handleProceedToBriefing}
            className="text-emerald-300 hover:text-white underline font-bold"
          >
            Inspect in Decision &amp; Briefing →
          </button>
        </div>
      )}

      {confluenceNotice && (
        <div className="bg-cyan-950/40 border border-cyan-700/60 rounded px-3.5 py-2 text-xs font-mono text-cyan-200">
          {confluenceNotice}{' '}
          {confluencePageUrl && <a href={confluencePageUrl} target="_blank" rel="noreferrer" className="underline font-bold text-cyan-300">Open audit page</a>}
        </div>
      )}

      {evaluationError && (
        <div className="bg-red-950/50 border border-red-700 rounded px-3.5 py-2 text-xs font-mono text-red-200">
          Solver Error: {evaluationError}
        </div>
      )}

      {/* Main Map-First Comparison Grid (8 / 12 Dominant Side-by-Side Map + 4 / 12 Contextual Evidence Rail) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 flex-1 min-h-0">
        {/* Dominant Side-by-Side / Curtain Comparison Viewport */}
        <div className="xl:col-span-8 flex flex-col gap-2 bg-onyx-900 border border-onyx-800 rounded p-2.5 min-h-[540px]">
          <CanvasLayerDock
            activeLayers={canvasLayers}
            onToggleLayer={toggleCanvasLayer}
            compact
          />

          {isComputingEvaluation || !evaluationResult || !selectedPlanMetrics ? (
            <div className="flex-1 min-h-[430px] bg-onyx-950 rounded border border-onyx-800 flex items-center justify-center">
              <div className="flex items-center gap-2.5 text-xs font-mono text-cyan-300">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Executing identical-storm 2D solver for Baseline, Alpha, Beta, and Gamma — first run for a setup can take about a minute; results are cached after that.</span>
              </div>
            </div>
          ) : (
            <SplitComparisonCanvas
              dataset={dataset}
              baselineWaterDepth={evaluationResult.baseline.waterDepth}
              planWaterDepth={selectedPlanMetrics.waterDepth}
              planShortLabel={planShortLabel}
              baselineLabel={
                activeDisruptionIds.length > 0
                  ? 'Baseline (Impaired Drainage)'
                  : 'Baseline (Nominal Drainage)'
              }
              activeLayers={canvasLayers}
              comparisonMode={comparisonMode}
              onChangeComparisonMode={setComparisonMode}
              selectedCell={selectedCell}
              selectedRoadId={selectedRoadId}
              selectedFacilityId={selectedFacilityId}
              stagedWorkOrders={workOrders}
              activePlanId={selectedPlanId}
              onSelectCell={setSelectedCell}
              onSelectRoad={(road) => setSelectedRoadId(road ? road.roadId : null)}
              onSelectFacility={(fac) => setSelectedFacilityId(fac ? fac.facilityId : null)}
            />
          )}
        </div>

        {/* Right Contextual Differential & Temporal Threshold Rail */}
        <div className="xl:col-span-4 flex flex-col gap-3 overflow-y-auto pr-0.5">
          {/* 1. Selected Plan Differential Telemetry */}
          {selectedDiff && (
            <div className="bg-onyx-900 border border-onyx-800 rounded p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                  {planShortLabel} Differentials
                </span>
                {renderClassificationBadge(selectedDiff.classification)}
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="bg-onyx-950 border border-onyx-800 rounded p-2">
                  <span className="text-[9px] text-storm-400 uppercase block">Avoided Storage</span>
                  <span className="text-sm font-bold text-emerald-400">
                    {selectedDiff.avoidedSurfaceVolumeM3 >= 0 ? '+' : ''}
                    {selectedDiff.avoidedSurfaceVolumeM3.toLocaleString()} m³
                  </span>
                </div>
                <div className="bg-onyx-950 border border-onyx-800 rounded p-2">
                  <span className="text-[9px] text-storm-400 uppercase block">Peak Depth Δ</span>
                  <span className="text-sm font-bold text-white">
                    {selectedDiff.peakDepthReductionM >= 0 ? '-' : '+'}
                    {(Math.abs(selectedDiff.peakDepthReductionM) * 100).toFixed(1)} cm
                  </span>
                </div>
                <div className="bg-onyx-950 border border-onyx-800 rounded p-2">
                  <span className="text-[9px] text-storm-400 uppercase block">Intervention Sink</span>
                  <span className="text-sm font-bold text-cyan-300">
                    {selectedDiff.inletDrainageAccounting.interventionSinkExtractionM3.toLocaleString()} m³
                  </span>
                </div>
                <div className="bg-onyx-950 border border-onyx-800 rounded p-2">
                  <span className="text-[9px] text-storm-400 uppercase block">Net Road Screening Δ</span>
                  <span className="text-sm font-bold text-storm-100">
                    {selectedDiff.roadTransitions.netProtectedRoadCount >= 0 ? '+' : ''}
                    {selectedDiff.roadTransitions.netProtectedRoadCount} corridors
                  </span>
                </div>
              </div>

              {/* Drainage Attribution Breakdown */}
              <div className="text-[10px] font-mono text-storm-400 bg-onyx-950 border border-onyx-800 rounded px-2.5 py-1.5 space-y-0.5">
                <div>
                  Background Inlets: <span className="text-storm-200">{selectedDiff.inletDrainageAccounting.backgroundInletDrainageM3.toLocaleString()} m³</span>
                </div>
                <div>
                  Incremental Drainage vs Baseline:{' '}
                  <span className="text-cyan-300">
                    {selectedDiff.inletDrainageAccounting.incrementalDrainageM3 >= 0 ? '+' : ''}
                    {selectedDiff.inletDrainageAccounting.incrementalDrainageM3.toLocaleString()} m³
                  </span>
                </div>
              </div>

              {/* Explicit Improved & Worsened Road Transitions */}
              {(selectedDiff.roadTransitions.improvedRoadNames.length > 0 ||
                selectedDiff.roadTransitions.worsenedRoadNames.length > 0) && (
                <div className="space-y-1 text-[10px] font-mono">
                  {selectedDiff.roadTransitions.improvedRoadNames.length > 0 && (
                    <div className="text-emerald-300 bg-emerald-950/30 border border-emerald-800/50 rounded px-2 py-1">
                      Below 30cm screening tier: {selectedDiff.roadTransitions.improvedRoadNames.join(', ')}
                    </div>
                  )}
                  {selectedDiff.roadTransitions.worsenedRoadNames.length > 0 && (
                    <div className="text-red-300 bg-red-950/30 border border-red-800/50 rounded px-2 py-1">
                      Worsened to ≥30cm: {selectedDiff.roadTransitions.worsenedRoadNames.join(', ')}
                    </div>
                  )}
                </div>
              )}

              {/* Prominent Adverse Local Ponding Disclosure */}
              {selectedDiff.spatialDeflection.adverseCellCount > 0 && (
                <div className="bg-amber-950/40 border border-amber-600/70 rounded p-2.5 text-[11px] text-amber-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-mono font-bold text-amber-300 text-[10px] uppercase">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Adverse Local Ponding Trade-Off
                  </div>
                  <p className="leading-snug">
                    Produces <strong>+{(selectedDiff.spatialDeflection.maxAdverseDepthIncreaseM * 100).toFixed(1)} cm</strong> additional water on{' '}
                    <strong>{selectedDiff.spatialDeflection.adverseCellCount} adjacent cells</strong> ({selectedDiff.spatialDeflection.adverseAreaM2.toLocaleString()} m², deflected volume{' '}
                    {selectedDiff.spatialDeflection.deflectedVolumeM3.toLocaleString()} m³).
                  </p>
                </div>
              )}

              <p className="text-[11px] text-storm-300 leading-relaxed">
                {selectedDiff.classificationRationale}
              </p>
            </div>
          )}

          {/* 2. Discrete Time-to-Threshold Screening Analysis (Strictly Solver-Derived) */}
          {selectedDiff?.temporalThresholds && (
            <div className="bg-onyx-900 border border-onyx-800 rounded">
              <button
                type="button"
                onClick={() => setShowTemporalSection((v) => !v)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between text-[11px] font-mono text-storm-200 hover:text-white"
              >
                <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  Screening Threshold Timing (Δt={selectedDiff.temporalThresholds.dtMacroSeconds}s)
                </span>
                {showTemporalSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showTemporalSection && (
                <div className="px-3.5 pb-3 pt-1 border-t border-onyx-800 space-y-2 text-[11px]">
                  <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
                    <div className="bg-onyx-950 border border-onyx-800 rounded p-1.5 text-center">
                      <span className="text-storm-400 block">Avoided ≥30cm</span>
                      <span className="text-emerald-400 font-bold text-xs">
                        {selectedDiff.temporalThresholds.avoided30cmRoadCount}
                      </span>
                    </div>
                    <div className="bg-onyx-950 border border-onyx-800 rounded p-1.5 text-center">
                      <span className="text-storm-400 block">Delayed ≥30cm</span>
                      <span className="text-cyan-300 font-bold text-xs">
                        {selectedDiff.temporalThresholds.delayed30cmRoadCount}
                      </span>
                    </div>
                    <div className="bg-onyx-950 border border-onyx-800 rounded p-1.5 text-center">
                      <span className="text-storm-400 block">Earlier/New</span>
                      <span className="text-amber-300 font-bold text-xs">
                        {selectedDiff.temporalThresholds.acceleratedOrNewlyCrossed30cmRoadCount}
                      </span>
                    </div>
                  </div>

                  {selectedDiff.temporalThresholds.road30cmComparisons.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto space-y-1 font-mono text-[10px]">
                      {selectedDiff.temporalThresholds.road30cmComparisons.slice(0, 8).map((c) => (
                        <div
                          key={c.assetId}
                          className="flex items-center justify-between gap-2 bg-onyx-950 border border-onyx-850 rounded px-2 py-1"
                        >
                          <span className="text-storm-200 truncate">{c.assetName}</span>
                          <span className="flex-shrink-0 text-right">
                            <span className="text-storm-400">
                              {formatSecondsCompact(c.baselineCrossingSeconds)} → {formatSecondsCompact(c.planCrossingSeconds)}
                            </span>{' '}
                            <span
                              className={`font-bold ${
                                c.outcome === 'AVOIDED'
                                  ? 'text-emerald-400'
                                  : c.outcome === 'DELAYED'
                                  ? 'text-cyan-300'
                                  : c.outcome === 'ACCELERATED' || c.outcome === 'NEWLY_CROSSED'
                                  ? 'text-amber-300'
                                  : 'text-storm-400'
                              }`}
                            >
                              [{c.outcome === 'DELAYED' && c.deltaSeconds ? `+${formatSecondsCompact(c.deltaSeconds)}` : c.outcome}]
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] font-mono text-storm-400 bg-onyx-950 border border-onyx-850 rounded px-2.5 py-2">
                      No critical road segments crossed the 30 cm screening tier during this simulated horizon.
                    </div>
                  )}

                  <p className="text-[10px] text-storm-400 leading-snug">
                    {selectedDiff.temporalThresholds.disclosure}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 3. Collapsible Full 3-Plan Evidence & Model Limitations Drawer */}
          <div className="bg-onyx-900 border border-onyx-800 rounded">
            <button
              type="button"
              onClick={() => setShowFullComparisonDrawer((v) => !v)}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-[11px] font-mono text-storm-300 hover:text-white"
            >
              <span className="font-bold uppercase tracking-wider">
                Comparative Evidence &amp; Limitations
              </span>
              {showFullComparisonDrawer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showFullComparisonDrawer && evaluationResult && (
              <div className="px-3.5 pb-3 pt-1 border-t border-onyx-800 space-y-2 text-[11px] text-storm-300">
                <div className="text-[10px] font-mono text-amber-300">
                  Screening Threshold Disclosure: DELTA uses a ≥50 m³ avoided-storage screening threshold (not an empirical statutory standard).
                </div>
                <div className="space-y-1">
                  {evaluationResult.comparison.keyFindings.map((f, idx) => (
                    <div key={idx} className="text-[11px] text-storm-300">
                      • {f}
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-storm-400 pt-1 border-t border-onyx-800">
                  Culvert CULVERT-01-BROOKLINE is modelled as a road-deck point sink on cell [17, 26] (12.5 m³/s screening heuristic).
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Human Commander Decision Authorization Modal */}
      {isApprovalModalOpen && evaluationResult && selectedDiff && (
        <div className="fixed inset-0 z-50 bg-onyx-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-onyx-900 border border-onyx-700 rounded-lg max-w-xl w-full p-5 space-y-4 font-mono text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-onyx-800 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <ShieldCheck className="w-5 h-5 text-safety-orange" />
                <span>Approve Decision &amp; Record It</span>
              </div>
              <button
                type="button"
                onClick={() => setIsApprovalModalOpen(false)}
                className="text-storm-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {approvalError && (
              <div className="bg-red-950/60 border border-red-700 rounded p-2.5 text-red-200 text-[11px]">
                {approvalError}
              </div>
            )}

            <div className="bg-onyx-950 border border-onyx-800 rounded p-3 space-y-1.5 text-[11px]">
              <div className="text-white font-bold">{selectedPlanDef.name}</div>
              <div className="text-storm-300">Profile: {activeProfile.name}</div>
              <div className="text-storm-400">
                Disruptions: {evaluationResult.simulationMetadata.disruptionId} · Hash:{' '}
                <span className="text-cyan-300">{activeScenarioHash}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1.5">
                <div>
                  <span className="text-storm-500 block">Avoided Volume</span>
                  <span className="text-emerald-400 font-bold">
                    +{selectedDiff.avoidedSurfaceVolumeM3.toLocaleString()} m³
                  </span>
                </div>
                <div>
                  <span className="text-storm-500 block">Peak Depth Δ</span>
                  <span className="text-white font-bold">
                    -{(selectedDiff.peakDepthReductionM * 100).toFixed(1)} cm
                  </span>
                </div>
                <div>
                  <span className="text-storm-500 block">Adverse Cells</span>
                  <span className="text-amber-300 font-bold">
                    {selectedDiff.spatialDeflection.adverseCellCount}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-[11px] text-storm-300">
                <input type="checkbox" checked={publishToConfluence} onChange={(e) => setPublishToConfluence(e.target.checked)} />
                <span>Publish audit page to Confluence (opt-in, OFF by default)</span>
              </label>
              {publishToConfluence && (
                <input type="text" value={confluenceSpaceKey} onChange={(e) => setConfluenceSpaceKey(e.target.value)} placeholder="Space key (optional — first available space is auto-discovered)" aria-label="Confluence space key (optional)" className="w-full bg-onyx-950 border border-onyx-700 rounded px-2.5 py-1.5 text-[11px] text-storm-100 placeholder-storm-500 focus:outline-none focus:border-cyan-500" />
              )}
              {confluenceNotice && <div className="text-[11px] text-cyan-300">{confluenceNotice}</div>}
            </div>

            <div className="space-y-1">
              <label className="block text-storm-300 font-bold text-[11px]">
                Engineering Rationale &amp; Justification <span className="text-red-400">*</span>
              </label>
              <textarea
                value={engineeringRationale}
                onChange={(e) => setEngineeringRationale(e.target.value)}
                rows={4}
                className="w-full bg-onyx-950 border border-onyx-700 rounded p-2.5 text-storm-100 text-xs font-sans focus:outline-none focus:border-safety-orange"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-onyx-800">
              <button
                type="button"
                onClick={() => setIsApprovalModalOpen(false)}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 rounded bg-onyx-800 hover:bg-onyx-700 text-storm-300 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || engineeringRationale.trim().length < 5}
                onClick={handleConfirmDecision}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-safety-orange hover:bg-orange-600 disabled:opacity-50 text-white font-bold"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Recording...' : 'Confirm & Record Decision'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
