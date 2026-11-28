import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  RefreshCw, 
  ExternalLink, 
  Link as LinkIcon, 
  CheckCircle2, 
  Waves, 
  FileText,
  Info,
  ShieldCheck,
  Lock,
  CheckSquare,
  Square,
  Ticket
} from 'lucide-react';
import { invokeSafe, getContextSafe } from '../../services/forgeBridge';
import { 
  OperationalWorkOrder, 
  prepareWorkOrderFromDecision, 
  getStoredWorkOrders, 
  saveStoredWorkOrder
} from '../../simulation/workOrderEngine';
import { buildPanelDecisionSummary, issuePanelState, storedConfluenceAuditUrl } from '../../simulation/phase2Ux';

interface IssuePanelProps {
  initialIssueKey?: string;
  onOpenFullApp?: () => void;
}

interface LinkedDecision {
  decisionId: string;
  schemaVersion?: string;
  status: string;
  scenarioHash?: string;
  chosenPlan: {
    planId: string;
    name: string;
    type?: string;
    tradeOffSummary?: string;
  };
  humanApprover?: {
    displayName: string;
    role: string;
    accountId?: string;
    authorizationPolicy?: string;
    approvalTimestamp?: string;
  };
  engineeringRationale?: string;
  notes?: string;
  createdAt?: string;
  differentialMetrics?: {
    avoidedSurfaceVolumeM3?: number;
    peakDepthReductionM?: number;
    protectedRoadCount?: number;
    protectedRoadNames?: string[];
  };
  linkedIssueKey?: string;
  linkedAt?: string;
}

export const IssuePanel: React.FC<IssuePanelProps> = ({ initialIssueKey, onOpenFullApp }) => {
  const [issueKey, setIssueKey] = useState<string>(initialIssueKey || '');
  const [snapshot, setSnapshot] = useState<any>(null);
  useEffect(() => { invokeSafe('getSimulationSnapshotForPanel').then((r: any) => setSnapshot(r)).catch(() => setSnapshot(null)); }, []);
  const [linkedDecision, setLinkedDecision] = useState<LinkedDecision | null>(null);
  const [linkedWorkOrder, setLinkedWorkOrder] = useState<OperationalWorkOrder | null>(null);
  const [availableDecisions, setAvailableDecisions] = useState<LinkedDecision[]>([]);
  const [selectedDecisionId, setSelectedDecisionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLinking, setIsLinking] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState<boolean>(false);
  const [panelRationale, setPanelRationale] = useState<string>(
    "Plan Gamma is selected for controlled validation because the simulation indicates a 22 m³ reduction in surface water storage under the specified Brookline culvert blockage scenario. The intervention restores the culvert's nominal design capacity of 12.5 m³/s. These results are screening-model outputs and do not establish real-world flood protection or guarantee hospital access. This approval is for development-environment validation only."
  );

  // 1. Resolve active issueKey from Forge context or prop
  useEffect(() => {
    async function resolveContext() {
      if (!initialIssueKey) {
        try {
          const ctx = await getContextSafe();
          const key = ctx?.extension?.issue?.key;
          if (key) {
            setIssueKey(key);
          }
        } catch (e) {
          console.warn('[DELTA] IssuePanel context resolution notice:', e);
        }
      }
    }
    resolveContext();
  }, [initialIssueKey]);

  // 2. Fetch linked decision and operational work order for this issue
  const fetchLinkedDecision = async (targetKey: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res: any = await invokeSafe('getDecisionForIssue', { issueKey: targetKey });
      if (res && res.success && res.data) {
        setLinkedDecision(res.data);

        // Fetch associated work order
        try {
          const woRes: any = await invokeSafe('getWorkOrderForIssue', { issueKey: targetKey });
          if (woRes && woRes.success && woRes.data) {
            setLinkedWorkOrder(woRes.data);
          } else {
            // Check local store
            const stored = getStoredWorkOrders();
            const matched = stored.find(w => w.jiraIntegration?.linkedIssueKey === targetKey || w.decisionId === res.data.decisionId);
            if (matched) {
              setLinkedWorkOrder(matched);
            } else {
              const draft = prepareWorkOrderFromDecision(res.data, 'COMMANDER_STAGED');
              setLinkedWorkOrder(draft);
            }
          }
        } catch {
          const draft = prepareWorkOrderFromDecision(res.data, 'COMMANDER_STAGED');
          setLinkedWorkOrder(draft);
        }
      } else {
        setLinkedDecision(null);
        setLinkedWorkOrder(null);
        // If no decision linked, fetch available approved decisions for linking
        fetchAvailableDecisions();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to retrieve linked decision record.');
      setLinkedDecision(null);
      setLinkedWorkOrder(null);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Fetch available approved decisions for linking
  const fetchAvailableDecisions = async () => {
    try {
      const res: any = await invokeSafe('listDecisions');
      if (res && res.success && Array.isArray(res.data)) {
        const approved = res.data.filter((d: any) => d.status === 'APPROVED');
        setAvailableDecisions(approved);
        if (approved.length > 0 && !selectedDecisionId) {
          setSelectedDecisionId(approved[0].decisionId);
        }
      }
    } catch (e) {
      console.warn('[DELTA] Could not fetch available decisions:', e);
    }
  };

  useEffect(() => {
    if (issueKey) {
      fetchLinkedDecision(issueKey);
    }
  }, [issueKey]);

  // 4. Authorized link action
  const handleLinkDecision = async () => {
    if (!selectedDecisionId) return;
    setIsLinking(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res: any = await invokeSafe('linkDecisionToIssue', {
        issueKey,
        decisionId: selectedDecisionId
      });

      if (res && res.success) {
        setSuccessMessage(`Successfully linked decision ${selectedDecisionId} to issue ${issueKey}!`);
        // Also stage and save the operational work order for this issue
        const targetDec = availableDecisions.find(d => d.decisionId === selectedDecisionId);
        if (targetDec) {
          const wo = prepareWorkOrderFromDecision(targetDec, 'JIRA_LINKED');
          wo.jiraIntegration.linkedIssueKey = issueKey;
          wo.jiraIntegration.linkedAt = new Date().toISOString();
          saveStoredWorkOrder(wo);
          invokeSafe('saveWorkOrder', { workOrder: wo }).catch(() => {});
        }
        await fetchLinkedDecision(issueKey);
      } else {
        setErrorMessage(res?.error?.message || 'Server rejected decision link authorization.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || String(err));
    } finally {
      setIsLinking(false);
    }
  };

  // 5. Authorize and record Plan Gamma decision with real solver metrics directly from panel
  const handleApproveAndRecord = async () => {
    setIsSubmittingDecision(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload = {
      chosenPlan: {
        planId: 'plan-gamma',
        name: 'Plan Gamma: Emergency High-Pressure Culvert Jetting (Clear Choke Point)',
        type: 'CULVERT_JETTING'
      },
      scenarioHash: 'sha256:f0a73115e28a69b7f0dcfbbfe52182597bf8862c482d302b9c50154f488c9a47',
      canonicalScenario: {
        stormId: '50-year',
        stormDepthMm: 104.2,
        cellResolutionM: 25.0,
        durationHours: 6.0,
        gridDimensions: '64x64',
        infiltrationRateMmPerHour: 2.0,
        manningN: 0.025,
        sector: 'Boston Longwood Medical Area & Muddy River Catchment (EPSG:26986)'
      },
      baselineMetrics: {
        currentStorageM3: 41433,
        maxWaterDepthM: 0.619,
        impassableRoadCount: 0
      },
      interventionMetrics: {
        currentStorageM3: 41411,
        maxWaterDepthM: 0.619,
        impassableRoadCount: 0
      },
      differentialMetrics: {
        avoidedSurfaceVolumeM3: 22,
        peakDepthReductionM: 0.0,
        protectedRoadCount: 0,
        protectedRoadNames: []
      },
      engineeringRationale: panelRationale.trim(),
      schemaVersion: '2.0.0',
      humanApprover: {
        displayName: 'Incident Commander',
        role: 'Incident Commander'
      }
    };

    try {
      const res: any = await invokeSafe('recordDecision', payload);
      if (res && res.success && res.data) {
        const newDecisionId = res.data.decisionId;
        setSuccessMessage(`Decision ${newDecisionId} committed to Forge KVS! Now linking to ${issueKey}...`);

        const linkRes: any = await invokeSafe('linkDecisionToIssue', {
          issueKey,
          decisionId: newDecisionId
        });

        if (linkRes && linkRes.success) {
          setSuccessMessage(`Successfully authorized and linked decision ${newDecisionId} to issue ${issueKey}!`);
          // Also stage and save the operational work order for this issue
          const wo = prepareWorkOrderFromDecision(res.data, 'JIRA_LINKED');
          wo.jiraIntegration.linkedIssueKey = issueKey;
          wo.jiraIntegration.linkedAt = new Date().toISOString();
          saveStoredWorkOrder(wo);
          invokeSafe('saveWorkOrder', { workOrder: wo }).catch(() => {});
          await fetchLinkedDecision(issueKey);
        } else {
          setErrorMessage(linkRes?.error?.message || 'Decision recorded in KVS but link authorization failed.');
          await fetchAvailableDecisions();
        }
      } else {
        setErrorMessage(res?.error?.message || 'Server rejected decision record authorization.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || String(err));
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const panelState = issuePanelState({ issueKey, isLoading, linkedDecision });
  const panelSummary = buildPanelDecisionSummary(linkedDecision);
  const confluenceAuditUrl = storedConfluenceAuditUrl();

  const rationale = linkedDecision?.engineeringRationale || linkedDecision?.notes || linkedDecision?.chosenPlan?.tradeOffSummary;
  const avoidedVol = linkedDecision?.differentialMetrics?.avoidedSurfaceVolumeM3;
  const depthDelta = linkedDecision?.differentialMetrics?.peakDepthReductionM;
  const protectedRoads = linkedDecision?.differentialMetrics?.protectedRoadNames;

  return (
    <div className="bg-onyx-950 text-storm-100 border border-onyx-800 rounded-lg p-4 font-mono text-xs space-y-4 shadow-tactical">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-onyx-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-safety-muted text-safety-orange border border-safety-orange/40">
            <Waves className="w-4 h-4 text-safety-orange" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-wide text-storm-100 flex items-center gap-2">
              <span>DELTA HYDRAULIC DECISION CONTEXT</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-onyx-900 border border-onyx-700 text-storm-300">
                {issueKey}
              </span>
            </div>
            <div className="text-[10px] text-storm-400 font-mono">
              2D Diffusive-Wave Hydrodynamic Screening Ledger
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLinkedDecision(issueKey)}
            disabled={isLoading}
            className="px-2.5 py-1 rounded bg-onyx-900 hover:bg-onyx-850 text-storm-300 border border-onyx-700 flex items-center gap-1 transition-colors text-[11px]"
            title="Refresh decision context"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span>REFRESH</span>
          </button>

          {onOpenFullApp && (
            <button
              onClick={onOpenFullApp}
              className="px-2.5 py-1 rounded bg-onyx-900 hover:bg-onyx-850 text-safety-orange border border-safety-orange/40 flex items-center gap-1 transition-colors text-[11px] font-bold"
            >
              <span>DELTA ENGINE</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Status Messages */}
      {errorMessage && (
        <div className="p-3 rounded bg-red-950/80 border border-red-800 text-red-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">OPERATION REJECTED:</div>
            <div className="text-[11px]">{errorMessage}</div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-3 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="p-3 rounded-lg bg-onyx-900 border border-cyan-800/60 space-y-1 text-[11px]" data-testid="flood-impact-snapshot">
        <div className="font-bold text-white uppercase tracking-wider">Live catchment risk summary · Flood-impact snapshot</div>
        {snapshot?.simulation?.data ? (
          <div className="grid grid-cols-3 gap-2 font-mono">
            <span>Peak depth<br /><strong className="text-cyan-300">{snapshot.simulation.data.maxWaterDepthM ?? '—'} m</strong></span>
            <span>Storage<br /><strong className="text-cyan-300">{Math.round(snapshot.simulation.data.currentStorageM3 || 0).toLocaleString()} m³</strong></span>
            <span>Avoided (eval)<br /><strong className="text-emerald-300">{snapshot.evaluation?.data?.differentials?.['plan-gamma']?.avoidedSurfaceVolumeM3 != null ? `${Math.round(snapshot.evaluation.data.differentials['plan-gamma'].avoidedSurfaceVolumeM3).toLocaleString()} m³` : 'Run Phase 3'}</strong></span>
          </div>
        ) : <div className="text-storm-400">No stored simulation run yet — open DELTA Engine and run the Golden Journey.</div>}
        <div className="flex gap-3 pt-1">
          {linkedDecision && <span className="text-storm-300">Decision: {linkedDecision.decisionId}</span>}
          <span className="text-storm-500">Confluence audit link appears on the Decision &amp; Briefing screen after Publish.</span>
          {onOpenFullApp && <button type="button" onClick={onOpenFullApp} className="text-safety-orange underline">Open Ops Center (DELTA Engine)</button>}
        </div>
      </div>

      {!issueKey ? <div className="p-3 rounded bg-onyx-900 border border-onyx-700 text-storm-300 text-[11px]">Open this panel from a real Jira issue to load its linked decision.</div> : isLoading ? (
        <div className="p-6 text-center text-storm-400 space-y-2">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-safety-orange" />
          <div>Querying Forge KVS for issue-linked decision records...</div>
        </div>
      ) : linkedDecision ? (
        /* State A: Decision Record Linked */
        <div className="space-y-3.5">
          {/* Card Summary Header */}
          <div className="p-3 rounded-lg bg-onyx-900 border border-emerald-700/60 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold text-sm">{linkedDecision.decisionId}</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-600 font-bold">
                  {linkedDecision.status}
                </span>
                {linkedDecision.schemaVersion && (
                  <span className="px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 text-[9px]">
                    v{linkedDecision.schemaVersion}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-storm-400">
                {linkedDecision.createdAt ? new Date(linkedDecision.createdAt).toLocaleString() : 'Timestamp Recorded'}
              </div>
            </div>

            <div className="font-sans text-sm text-storm-100 font-bold pt-1">
              {linkedDecision.chosenPlan?.name}
            </div>

            {/* Differential Outcomes Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-onyx-800 text-[11px]">
              <div className="bg-onyx-950 p-2 rounded border border-onyx-800">
                <span className="text-storm-400 block text-[9px] uppercase">AVOIDED FLOOD VOLUME</span>
                <span className="text-emerald-400 font-bold">
                  {avoidedVol !== undefined ? `+${avoidedVol.toLocaleString()} m³` : 'Evaluated'}
                </span>
              </div>

              <div className="bg-onyx-950 p-2 rounded border border-onyx-800">
                <span className="text-storm-400 block text-[9px] uppercase">PEAK DEPTH DELTA</span>
                <span className="text-emerald-400 font-bold">
                  {depthDelta !== undefined ? `-${depthDelta.toFixed(3)} m` : 'Evaluated'}
                </span>
              </div>

              <div className="bg-onyx-950 p-2 rounded border border-onyx-800 col-span-2 sm:col-span-1">
                <span className="text-storm-400 block text-[9px] uppercase">RESTORED CORRIDORS</span>
                <span className="text-storm-200 font-bold">
                  {protectedRoads && protectedRoads.length > 0 ? `${protectedRoads.length} restored` : 'Maintained'}
                </span>
              </div>
            </div>

            {protectedRoads && protectedRoads.length > 0 && (
              <div className="text-[10px] text-storm-400 pt-1">
                <span className="text-storm-500 font-bold">Passable corridors:</span> {protectedRoads.join(', ')}
              </div>
            )}
          </div>

          {/* Decision + Metrics + Confluence + Dispatch card (Phase 2) */}
          {panelSummary && (
            <div className="p-3 rounded-lg bg-onyx-900 border border-cyan-800/70 space-y-2" data-testid="panel-dispatch-card" data-panel-state={panelState}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-[11px] uppercase tracking-wider text-storm-100">Decision · {panelSummary.decisionId}</span>
                <span className="text-[10px] text-storm-400">Signed: {panelSummary.approver}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-storm-300">
                {panelSummary.metrics.map((m) => (
                  <span key={m.label}>{m.label}: <strong className="text-emerald-300">{m.value}</strong></span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                {confluenceAuditUrl ? (
                  <a href={confluenceAuditUrl} target="_blank" rel="noreferrer" className="text-cyan-300 underline font-bold">Confluence audit page</a>
                ) : (
                  <span className="text-storm-400">Confluence audit link appears after Publish in Step 03/04.</span>
                )}
                {linkedWorkOrder ? (
                  <span className="text-storm-200">Dispatch: <strong>{linkedWorkOrder.workOrderId}</strong> · {linkedWorkOrder.stage.replace(/_/g, ' ')}</span>
                ) : (
                  <span className="text-storm-400">Dispatch: work order stages after approval.</span>
                )}
                {onOpenFullApp && (
                  <button type="button" onClick={onOpenFullApp} className="text-safety-orange underline font-bold">Open Ops Center</button>
                )}
              </div>
            </div>
          )}

          {/* Human Engineering Rationale Callout */}
          {rationale && (
            <div className="bg-onyx-900 p-3 rounded border border-onyx-800 space-y-1">
              <div className="text-[10px] font-bold text-safety-orange uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>HUMAN ENGINEERING RATIONALE</span>
              </div>
              <p className="font-sans text-xs text-storm-200 italic leading-relaxed">
                "{rationale}"
              </p>
            </div>
          )}

          {/* Provenance & Authorizing Officer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-storm-300">
            <div className="bg-onyx-900 p-2.5 rounded border border-onyx-800">
              <span className="text-storm-500 block text-[9px] uppercase">AUTHORIZING OFFICER</span>
              <span className="text-storm-200 font-bold">
                {linkedDecision.humanApprover?.displayName || 'Incident Commander'} [{linkedDecision.humanApprover?.role || 'Incident Commander'}]
              </span>
              <span className="text-storm-500 block text-[9px] pt-0.5">
                Auth: {linkedDecision.humanApprover?.authorizationPolicy || 'Jira Project Role: Incident Commander'}
              </span>
            </div>

            <div className="bg-onyx-900 p-2.5 rounded border border-onyx-800">
              <span className="text-storm-500 block text-[9px] uppercase">CANONICAL SCENARIO HASH</span>
              <code className="text-purple-300 font-mono text-[10px] break-all block pt-0.5">
                {linkedDecision.scenarioHash || 'sha256:unspecified'}
              </code>
            </div>
          </div>

          {/* Staged Operational Work Order (Workstream 4A) */}
          {linkedWorkOrder && (
            <div className="bg-onyx-900 rounded-lg p-3.5 border border-cyan-800/80 space-y-3">
              <div className="flex items-center justify-between border-b border-onyx-800 pb-2">
                <div className="flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-xs text-storm-100 uppercase tracking-wider">
                    STAGED OPERATIONAL WORK ORDER: {linkedWorkOrder.workOrderId}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-red-950/80 border border-red-800 text-red-300 text-[9px] font-bold">
                    {linkedWorkOrder.urgency.replace(/_/g, ' ')}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 text-[9px] font-bold">
                    {linkedWorkOrder.stage.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {/* Provenance Classification Pills */}
              <div className="flex flex-wrap gap-1.5 text-[9px] font-mono">
                <span className="px-1.5 py-0.5 rounded bg-purple-950 border border-purple-700 text-purple-300 font-bold">
                  LOCATION: {linkedWorkOrder.targetLocation?.locationClassification?.replace(/_/g, ' ') || 'PLANNING ASSUMPTION'}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-amber-950 border border-amber-700 text-amber-300 font-bold">
                  INGRESS: UNVERIFIED ROUTE
                </span>
                <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-cyan-300 font-bold">
                  EVIDENCE: DERIVED (2D SOLVER)
                </span>
              </div>

              {/* Target Site Coordinates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                <div className="bg-onyx-950 p-2 rounded border border-onyx-800">
                  <span className="text-storm-500 block uppercase">TARGET SITE &amp; RETICLE</span>
                  <span className="text-storm-200 font-bold block truncate">{linkedWorkOrder.targetLocation.name}</span>
                  <span className="text-cyan-400 font-mono block">Grid Cell: [{linkedWorkOrder.targetLocation.gridCell[0]}, {linkedWorkOrder.targetLocation.gridCell[1]}]</span>
                </div>

                <div className="bg-onyx-950 p-2 rounded border border-onyx-800">
                  <span className="text-storm-500 block uppercase">GEODETIC / STATE PLANE</span>
                  <span className="text-storm-200 font-mono block">
                    {linkedWorkOrder.targetLocation.wgs84.lat.toFixed(5)}°N, {Math.abs(linkedWorkOrder.targetLocation.wgs84.lon).toFixed(5)}°W
                  </span>
                  <span className="text-purple-300 font-mono block">
                    EPSG:26986: ({linkedWorkOrder.targetLocation.projected.x.toFixed(1)}, {linkedWorkOrder.targetLocation.projected.y.toFixed(1)})
                  </span>
                </div>
              </div>

              {/* Adverse Consequence Callout (Plan Alpha) */}
              {linkedWorkOrder.adverseConsequenceAnalysis?.hasAdverseImpact && (
                <div className="bg-amber-950/40 p-2.5 rounded border border-amber-800/60 text-[10.5px] space-y-1">
                  <div className="text-amber-300 font-bold uppercase text-[9.5px] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>LOCALIZED ADVERSE FLOODWATER DEFLECTION WARNING</span>
                  </div>
                  <p className="text-storm-200 font-sans leading-relaxed">
                    {linkedWorkOrder.adverseConsequenceAnalysis.description}
                  </p>
                </div>
              )}

              {/* Solver Abstraction Disclosure (Plan Gamma / Beta) */}
              {linkedWorkOrder.supportingSimulationEvidence?.solverAbstractionNotice && (
                <div className="bg-onyx-950 p-2 rounded border border-cyan-900/50 flex items-start gap-1.5 text-[10px] text-cyan-200/90 font-mono">
                  <Info className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-cyan-300 uppercase">SOLVER NOTICE:</strong>{' '}
                    {linkedWorkOrder.supportingSimulationEvidence.solverAbstractionNotice}
                  </div>
                </div>
              )}

              {/* Access Route & Equipment Considerations */}
              <div className="bg-onyx-950 p-2 rounded border border-onyx-800 text-[10px] space-y-1">
                <div>
                  <span className="text-storm-500 font-bold uppercase">INGRESS ROUTE: </span>
                  <span className="text-emerald-300 font-mono">{linkedWorkOrder.targetLocation.accessCorridor}</span>
                </div>
                <div>
                  <span className="text-storm-500 font-bold uppercase">CREW SIZING ESTIMATE: </span>
                  <span className="text-storm-200">{linkedWorkOrder.crewRequirement}</span>
                </div>
                <div className="pt-1 flex flex-wrap gap-1">
                  {linkedWorkOrder.tacticalEquipment.slice(0, 3).map((eq, i) => (
                    <span key={i} className="px-1.5 py-0.5 bg-onyx-900 border border-onyx-700 rounded text-[9px] text-storm-300">
                      {eq}
                    </span>
                  ))}
                  {linkedWorkOrder.tacticalEquipment.length > 3 && (
                    <span className="px-1.5 py-0.5 bg-onyx-900 border border-onyx-700 rounded text-[9px] text-storm-400">
                      +{linkedWorkOrder.tacticalEquipment.length - 3} more planning units
                    </span>
                  )}
                </div>
              </div>

              {/* Protocol Checklist Summary */}
              <div className="space-y-1 text-[10px]">
                <div className="flex items-center justify-between text-storm-400 font-bold uppercase">
                  <span>TACTICAL PLANNING PROTOCOL ({linkedWorkOrder.operationalTasks.filter(t => t.isCompleted).length}/{linkedWorkOrder.operationalTasks.length} REVIEWED):</span>
                  <span className="text-amber-400 text-[9px]">PLANNING REVIEW ONLY</span>
                </div>
                <div className="space-y-1">
                  {linkedWorkOrder.operationalTasks.slice(0, 3).map((t) => (
                    <div key={t.stepNumber} className="flex items-center gap-1.5 text-storm-300 bg-onyx-950 p-1.5 rounded border border-onyx-800">
                      {t.isCompleted ? <CheckSquare className="w-3 h-3 text-emerald-400" /> : <Square className="w-3 h-3 text-storm-500" />}
                      <span className="font-bold text-storm-400">Step {t.stepNumber}:</span>
                      <span className="truncate">{t.title}</span>
                    </div>
                  ))}
                </div>
                <div className="text-[9px] text-storm-500 italic pt-0.5">
                  * Desk-side operational review checklist. Does NOT represent physical field execution.
                </div>
              </div>

              {/* Live Dispatch Safety Boundary Callout */}
              <div className="bg-onyx-950 p-2 rounded border border-amber-900/50 flex items-start gap-2 text-[10px] text-amber-300 font-mono">
                <Lock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-200">LIVE_DISPATCH_LOCKED:</strong> Autonomous live ticket dispatch is locked by server safety policy. Requires verbal Incident Commander radio order.
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* State B: No Decision Linked Yet */
        <div className="p-4 rounded-lg bg-onyx-900 border border-amber-900/60 space-y-3.5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-amber-300 uppercase">NO DECISION RECORD LINKED</div>
              <p className="text-storm-300 text-[11px] font-sans pt-0.5">
                This Jira incident issue is not currently linked to an approved DELTA mitigation decision in Forge KVS.
                Review the live catchment risk summary above, then link a decision or open the Ops Center to run the storm.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2" data-testid="unlinked-ctas">
            {availableDecisions.length > 0 && selectedDecisionId && (
              <button type="button" onClick={handleLinkDecision} disabled={isLinking} className="px-3 py-1.5 rounded bg-safety-orange hover:bg-safety-hover disabled:opacity-50 text-white font-bold text-[11px]">
                {isLinking ? 'Linking…' : 'Link Decision'}
              </button>
            )}
            {onOpenFullApp && (
              <button type="button" onClick={onOpenFullApp} className="px-3 py-1.5 rounded bg-onyx-950 border border-safety-orange/50 text-safety-orange font-bold text-[11px]">
                Open Ops Center
              </button>
            )}
          </div>

          {availableDecisions.length > 0 ? (
            <div className="pt-2 border-t border-onyx-800 space-y-2.5">
              <div className="text-[11px] font-bold text-storm-200">
                LINK AN AUTHORIZED DECISION RECORD:
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selectedDecisionId}
                  onChange={(e) => setSelectedDecisionId(e.target.value)}
                  className="bg-onyx-950 border border-onyx-700 rounded px-2.5 py-1.5 text-xs text-storm-100 flex-1 focus:outline-none focus:border-safety-orange"
                >
                  {availableDecisions.map((d) => (
                    <option key={d.decisionId} value={d.decisionId}>
                      {d.decisionId} — {d.chosenPlan.name} ({d.humanApprover?.displayName || 'Commander'})
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleLinkDecision}
                  disabled={isLinking || !selectedDecisionId}
                  className="px-3.5 py-1.5 rounded bg-safety-orange hover:bg-safety-hover disabled:opacity-50 text-white font-bold flex items-center justify-center gap-1.5 transition-colors shadow-tactical whitespace-nowrap"
                >
                  <LinkIcon className={`w-3.5 h-3.5 ${isLinking ? 'animate-spin' : ''}`} />
                  <span>{isLinking ? 'LINKING...' : 'LINK TO THIS ISSUE'}</span>
                </button>
              </div>
              <div className="text-[10px] text-storm-500 font-mono">
                * Requires Incident Commander authority. Binds issue-decision relationship in Forge KVS.
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t border-onyx-800 space-y-3">
              <div className="text-[11px] font-bold text-storm-200 uppercase flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-safety-orange" />
                <span>AUTHORIZE SCREENING MITIGATION DECISION FOR {issueKey}:</span>
              </div>
              <div className="bg-onyx-950 p-3 rounded border border-onyx-800 space-y-2 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-storm-400">SELECTED INTERVENTION:</span>
                  <span className="text-emerald-400 font-bold">Plan Gamma: Emergency Culvert Jetting</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-onyx-900">
                  <div><span className="text-storm-500">AVOIDED STORAGE:</span> <strong className="text-storm-200">+22 m³</strong></div>
                  <div><span className="text-storm-500">RESTORED CONVEYANCE:</span> <strong className="text-storm-200">12.5 m³/s</strong></div>
                  <div className="col-span-2"><span className="text-storm-500">SCENARIO HASH:</span> <code className="text-purple-300 font-mono text-[9px] break-all block pt-0.5">sha256:f0a73115e28a69b7f0dcfbbfe52182597bf8862c482d302b9c50154f488c9a47</code></div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-storm-400 font-bold block">
                  INCIDENT COMMANDER ENGINEERING RATIONALE:
                </label>
                <textarea
                  value={panelRationale}
                  onChange={(e) => setPanelRationale(e.target.value)}
                  rows={2}
                  className="w-full bg-onyx-950 border border-onyx-700 rounded p-2 text-storm-100 text-xs font-sans focus:outline-none focus:border-safety-orange leading-relaxed"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleApproveAndRecord}
                  disabled={isSubmittingDecision || panelRationale.trim().length < 5}
                  className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-1.5 transition-colors text-xs flex-1 shadow-tactical"
                >
                  <ShieldCheck className={`w-3.5 h-3.5 ${isSubmittingDecision ? 'animate-spin' : ''}`} />
                  <span>{isSubmittingDecision ? 'AUTHORIZING & LINKING...' : 'AUTHORIZE & LINK PLAN GAMMA TO THIS ISSUE'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Model Limitations Notice (Truth Gate) */}
      <div className="p-2.5 rounded bg-onyx-900/60 border border-onyx-800 flex items-start gap-2 text-[10px] text-storm-400">
        <Info className="w-3.5 h-3.5 text-storm-500 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-storm-300">SCIENTIFIC SCREENING NOTICE:</span> 2D diffusive-wave screening model (25 m cells). Planning-level decision support for municipal coordination, not an official hydrodynamic floodway determination or live automated emergency dispatch.
        </div>
      </div>
    </div>
  );
};
