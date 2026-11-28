import React, { useState, useEffect } from 'react';
import { 
  Ticket, 
  Clock, 
  ExternalLink, 
  MapPin, 
  User, 
  CheckCircle2, 
  ShieldCheck, 
  Lock, 
  AlertTriangle, 
  Wrench, 
  CheckSquare, 
  Square, 
  Navigation, 
  FileText, 
  Search, 
  Link as LinkIcon,
  Layers,
  ArrowRight,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { 
  OperationalWorkOrder, 
  WorkOrderStage, 
  getStoredWorkOrders, 
  saveStoredWorkOrder, 
  linkWorkOrderToIssue 
} from '../../../simulation/workOrderEngine';
import { invokeSafe } from '../../../services/forgeBridge';
import { useIncidentWorkspace } from '../../../context/IncidentWorkspaceContext';
import { StageIntro } from '../../common/StageIntro';
import { Accordion } from '../../common/Accordion';
import { isDemoWorkOrder, partitionWorkOrders } from '../../../simulation/phase2Ux';

export const OperationalTicketsView: React.FC = () => {
  const {
    refreshGovernanceRecords,
    setSelectedCell,
    setSelectedPlanId,
    setSelectedWorkOrderId,
    setActiveStage
  } = useIncidentWorkspace();
  const [workOrders, setWorkOrders] = useState<OperationalWorkOrder[]>([]);
  const [selectedStage, setSelectedStage] = useState<'ALL' | WorkOrderStage>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [linkInputMap, setLinkInputMap] = useState<Record<string, string>>({});
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [expandedProvenanceIds, setExpandedProvenanceIds] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dispatchedLinks, setDispatchedLinks] = useState<Record<string, { issueKey: string; issueUrl?: string }>>({});
  const [dispatchState, setDispatchState] = useState<Record<string, { status: 'working' | 'error' | 'success'; message: string }>>({});
  const handleDispatchLive = async (wo: OperationalWorkOrder) => {
    setDispatchState(prev => ({ ...prev, [wo.workOrderId]: { status: 'working', message: 'Contacting Jira…' } }));
    setActionNotice(`Dispatching live Jira issue for ${wo.workOrderId}…`);
    try {
      const res: any = await invokeSafe('createDispatchTicket', { decisionId: wo.decisionId });
      if (res?.success && res.issueKey) {
        setDispatchedLinks(prev => ({ ...prev, [wo.workOrderId]: { issueKey: res.issueKey, issueUrl: res.issueUrl || res.self } }));
        setDispatchState(prev => ({ ...prev, [wo.workOrderId]: { status: 'success', message: `Created ${res.issueKey}` } }));
        setActionNotice(`Live Jira issue ${res.issueKey} created for ${wo.workOrderId}.`);
        setTimeout(() => setActionNotice(null), 12000);
      } else {
        const raw = res?.error?.message || res?.message || '';
        const friendly = /not found/i.test(raw)
          ? 'This work order is a demo seed — its decision was never approved on the server, so there is nothing to dispatch. Go to Step 03 → Approve Decision (a real work order is created automatically), then come back and dispatch that one. (Nothing was created.)'
          : raw || 'Live dispatch requires Forge Jira access; no ticket was created.';
        setDispatchState(prev => ({ ...prev, [wo.workOrderId]: { status: 'error', message: friendly } }));
        setActionNotice(friendly);
      }
    } catch (e: any) {
      const msg = e?.message || 'Live dispatch failed; no ticket confirmed.';
      setDispatchState(prev => ({ ...prev, [wo.workOrderId]: { status: 'error', message: msg } }));
      setActionNotice(msg);
    }
  };

  // Load stored work orders on mount
  useEffect(() => {
    refreshWorkOrders();
  }, []);

  const refreshWorkOrders = async () => {
    setIsLoading(true);
    // 1. Get locally stored work orders
    const local = getStoredWorkOrders();
    setWorkOrders(local);

    // 2. Fetch from Forge KVS if in Forge environment
    try {
      const res: any = await invokeSafe('listWorkOrders');
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        // Merge Forge work orders with local
        const merged = [...res.data];
        for (const loc of local) {
          if (!merged.some(m => m.workOrderId === loc.workOrderId)) {
            merged.push(loc);
          }
        }
        setWorkOrders(merged);
      }
    } catch {
      // In standalone browser mode, fallback cleanly to local state
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle provenance disclosure drawer
  const toggleProvenance = (workOrderId: string) => {
    setExpandedProvenanceIds(prev => ({
      ...prev,
      [workOrderId]: !prev[workOrderId]
    }));
  };

  // Toggle task desk-side review check
  const handleToggleTask = (workOrderId: string, stepNumber: number) => {
    const updated = workOrders.map((wo) => {
      if (wo.workOrderId !== workOrderId) return wo;
      const updatedTasks = wo.operationalTasks.map((task) => {
        if (task.stepNumber !== stepNumber) return task;
        const nextState = !task.isCompleted;
        return { 
          ...task, 
          isCompleted: nextState,
          reviewStatus: nextState ? ('REVIEWED_FOR_STAGING' as const) : ('PENDING_REVIEW' as const)
        };
      });
      const newWo: OperationalWorkOrder = { 
        ...wo, 
        operationalTasks: updatedTasks, 
        updatedAt: new Date().toISOString() 
      };
      saveStoredWorkOrder(newWo);
      invokeSafe('saveWorkOrder', { workOrder: newWo }).catch(() => {});
      return newWo;
    });
    setWorkOrders(updated);
  };

  // Advance work order to COMMANDER_STAGED
  const handleAdvanceToStaged = async (wo: OperationalWorkOrder) => {
    const updated: OperationalWorkOrder = {
      ...wo,
      stage: 'COMMANDER_STAGED',
      humanReview: {
        ...wo.humanReview,
        reviewedAt: new Date().toISOString(),
        stagingStatus: 'STAGED_BY_COMMANDER',
        stagingNotice: 'Staged by Duty Incident Commander for operational resource planning. Does NOT authorize field dispatch.'
      },
      updatedAt: new Date().toISOString()
    };
    saveStoredWorkOrder(updated);
    setWorkOrders(prev => prev.map(w => w.workOrderId === updated.workOrderId ? updated : w));
    setActionNotice(`Work order ${wo.workOrderId} advanced to COMMANDER_STAGED. Ready for Jira ticket assignment.`);
    try {
      await invokeSafe('saveWorkOrder', { workOrder: updated });
    } catch {}
    await refreshGovernanceRecords();
    setTimeout(() => setActionNotice(null), 5000);
  };

  // Bind work order to Jira issue key
  const handleBindJiraIssue = async (wo: OperationalWorkOrder) => {
    const issueKey = (linkInputMap[wo.workOrderId] || 'EMERG-101').trim().toUpperCase();
    if (!issueKey) return;

    try {
      const serverRes: any = await invokeSafe('linkWorkOrderToIssue', {
        workOrderId: wo.workOrderId,
        issueKey
      });

      if (serverRes && serverRes.success && serverRes.data) {
        saveStoredWorkOrder(serverRes.data);
        setWorkOrders(prev => prev.map(w => w.workOrderId === serverRes.data.workOrderId ? serverRes.data : w));
        setActionNotice(`Work order ${wo.workOrderId} linked to Jira incident ${issueKey}!`);
      } else {
        // Fallback local update
        const updated = linkWorkOrderToIssue(wo.workOrderId, issueKey);
        if (updated) {
          setWorkOrders(prev => prev.map(w => w.workOrderId === updated.workOrderId ? updated : w));
          setActionNotice(`Work order ${wo.workOrderId} bound to Jira issue ${issueKey}!`);
        }
      }
    } catch {
      const updated = linkWorkOrderToIssue(wo.workOrderId, issueKey);
      if (updated) {
        setWorkOrders(prev => prev.map(w => w.workOrderId === updated.workOrderId ? updated : w));
        setActionNotice(`Work order ${wo.workOrderId} bound to Jira issue ${issueKey}!`);
      }
    }
    await refreshGovernanceRecords();
    setTimeout(() => setActionNotice(null), 5000);
  };

  const handleLocateOnMap = (wo: OperationalWorkOrder) => {
    const [row, col] = wo.targetLocation.gridCell;
    setSelectedPlanId(wo.planId);
    setSelectedWorkOrderId(wo.workOrderId);
    setSelectedCell({ row, col });
    setActiveStage('interventions');
  };

  // Filtered work orders
  const filteredWorkOrders = workOrders.filter((wo) => {
    if (selectedStage !== 'ALL' && wo.stage !== selectedStage) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = wo.workOrderId.toLowerCase().includes(q);
      const matchPlan = wo.planName.toLowerCase().includes(q);
      const matchSite = wo.targetLocation.name.toLowerCase().includes(q);
      const matchDecision = wo.decisionId.toLowerCase().includes(q);
      const matchIssue = (wo.jiraIntegration?.linkedIssueKey || '').toLowerCase().includes(q);
      return matchId || matchPlan || matchSite || matchDecision || matchIssue;
    }
    return true;
  });

  const countDraft = workOrders.filter(w => w.stage === 'PREPARED_DRAFT').length;
  const countStaged = workOrders.filter(w => w.stage === 'COMMANDER_STAGED').length;
  const countLinked = workOrders.filter(w => w.stage === 'JIRA_LINKED').length;

  const renderWorkOrderCard = (wo: OperationalWorkOrder) => {
            const reviewedCount = wo.operationalTasks.filter(t => t.isCompleted).length;
            const totalTasks = wo.operationalTasks.length;
            const progressPct = totalTasks > 0 ? Math.round((reviewedCount / totalTasks) * 100) : 0;
            const isProvenanceOpen = !!expandedProvenanceIds[wo.workOrderId];

            return (
              <div
                key={wo.workOrderId}
                className={`bg-onyx-900 rounded-lg border transition-all overflow-hidden shadow-tactical font-mono ${
                  wo.stage === 'JIRA_LINKED'
                    ? 'border-emerald-800/80 bg-gradient-to-b from-onyx-900 to-emerald-950/10'
                    : wo.stage === 'COMMANDER_STAGED'
                    ? 'border-amber-700/80 bg-gradient-to-b from-onyx-900 to-amber-950/10'
                    : 'border-onyx-800'
                }`}
              >
                {/* Work Order Top Bar */}
                <div className="p-4 bg-onyx-950 border-b border-onyx-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-cyan-400 font-bold text-sm tracking-wider flex items-center gap-1.5">
                      <Ticket className="w-4 h-4 text-cyan-400" />
                      {wo.workOrderId}
                    </span>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      wo.urgency === 'P1_CRITICAL'
                        ? 'bg-red-950/90 border border-red-700 text-red-300'
                        : 'bg-amber-950/90 border border-amber-700 text-amber-300'
                    }`}>
                      {wo.urgency.replace('_', ' ')}
                    </span>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                      wo.stage === 'JIRA_LINKED'
                        ? 'bg-emerald-950 border border-emerald-600 text-emerald-300'
                        : wo.stage === 'COMMANDER_STAGED'
                        ? 'bg-amber-950 border border-amber-600 text-amber-300'
                        : 'bg-slate-900 border border-slate-700 text-slate-300'
                    }`}>
                      {wo.stage === 'JIRA_LINKED' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                      {wo.stage === 'COMMANDER_STAGED' && <ShieldCheck className="w-3 h-3 text-amber-400" />}
                      {wo.stage === 'PREPARED_DRAFT' && <FileText className="w-3 h-3 text-slate-400" />}
                      {wo.stage.replace('_', ' ')}
                    </span>

                    {wo.jiraIntegration?.linkedIssueKey && (
                      <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-cyan-300 text-[10px] font-bold flex items-center gap-1">
                        <LinkIcon className="w-3 h-3 text-cyan-400" />
                        JIRA: {wo.jiraIntegration.linkedIssueKey}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-storm-400 text-xs">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-storm-500" />
                      {new Date(wo.createdAt).toLocaleDateString()} {new Date(wo.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-storm-600">|</span>
                    <span className="text-storm-300">
                      DECISION: <strong className="text-storm-100">{wo.decisionId}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleLocateOnMap(wo)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-onyx-950 border border-onyx-700 hover:border-safety-orange text-[10px] font-mono text-cyan-300 hover:text-white transition-colors"
                    >
                      <MapPin className="w-3 h-3 text-safety-orange" />
                      <span>Locate [{wo.targetLocation.gridCell[0]}, {wo.targetLocation.gridCell[1]}] on Map</span>
                    </button>
                  </div>
                </div>

                <div className="p-5 space-y-4 text-xs">
                  {/* Compact action summary (Phase 2) */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px]" data-testid="work-order-compact-summary">
                    <span className="px-2 py-1 rounded bg-onyx-900 border border-onyx-700 text-storm-200"><MapPin className="w-3 h-3 inline mr-1 text-safety-orange" />Target Site: <strong>{wo.targetLocation.name}</strong></span>
                    <span className="px-2 py-1 rounded bg-onyx-900 border border-onyx-700 text-storm-200"><Wrench className="w-3 h-3 inline mr-1 text-cyan-400" />Equipment: {wo.tacticalEquipment.length} item{wo.tacticalEquipment.length === 1 ? '' : 's'}{wo.tacticalEquipment.length > 0 ? ` — ${wo.tacticalEquipment.slice(0, 2).join(', ')}` : ''}</span>
                    {wo.jiraIntegration?.linkedIssueKey ? (
                      <a href={`#/issue/${wo.jiraIntegration.linkedIssueKey}`} className="px-2 py-1 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 font-bold underline">{wo.jiraIntegration.linkedIssueKey}</a>
                    ) : isDemoWorkOrder(wo) ? (
                      <span className="px-2 py-1 rounded bg-onyx-800 border border-onyx-700 text-storm-400 font-bold">Demo example</span>
                    ) : wo.stage === 'PREPARED_DRAFT' ? (
                      <span className="px-2 py-1 rounded bg-onyx-800 border border-onyx-700 text-storm-300 font-bold">Stage for commander review to dispatch</span>
                    ) : (
                      <button type="button" onClick={() => handleDispatchLive(wo)} disabled={dispatchState[wo.workOrderId]?.status === 'working'} className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold">{dispatchState[wo.workOrderId]?.status === 'working' ? 'DISPATCHING…' : 'Dispatch Live Jira Issue'}</button>
                    )}
                  </div>
                  {/* Plan Name & Strategic Rationale */}
                  <div>
                    <h3 className="text-sm font-bold text-storm-100 font-sans">
                      {wo.planName}
                    </h3>
                    <p className="text-storm-300 font-sans text-xs pt-1 leading-relaxed">
                      {wo.priorityRationale}
                    </p>
                  </div>

                  {/* Provenance Strip & Toggle */}
                  <div className="bg-onyx-950 p-2.5 rounded border border-onyx-800 flex flex-wrap items-center justify-between gap-2 text-[10.5px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-storm-500 uppercase font-bold text-[9.5px]">PROVENANCE CLASSIFICATIONS:</span>
                      <span className="px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-700 text-purple-300 text-[9px] font-bold">
                        LOCATION: {wo.targetLocation.locationClassification.replace(/_/g, ' ')}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-700 text-amber-300 text-[9px] font-bold">
                        INGRESS: UNVERIFIED
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-700 text-cyan-300 text-[9px] font-bold">
                        EVIDENCE: DERIVED (2D SOLVER)
                      </span>
                    </div>

                    <button
                      onClick={() => toggleProvenance(wo.workOrderId)}
                      className="text-cyan-400 hover:text-cyan-300 text-[10.5px] font-bold flex items-center gap-1 transition-colors"
                    >
                      <Info className="w-3 h-3 text-cyan-400" />
                      <span>{isProvenanceOpen ? 'HIDE PROVENANCE MANIFEST' : 'INSPECT PROVENANCE MANIFEST'}</span>
                      {isProvenanceOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Provenance Manifest Disclosure Drawer */}
                  {isProvenanceOpen && wo.provenanceManifest && (
                    <div className="p-3.5 bg-onyx-950/90 rounded border border-cyan-900/60 space-y-2.5 text-[11px] font-mono animate-fadeIn">
                      <div className="text-cyan-300 font-bold uppercase text-[10px] flex items-center gap-1.5 border-b border-onyx-800 pb-1">
                        <Layers className="w-3.5 h-3.5 text-cyan-400" />
                        <span>OPERATIONAL EVIDENCE &amp; PROVENANCE ARCHITECTURE MANIFEST</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        <div className="bg-onyx-900 p-2 rounded border border-onyx-800 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-storm-400 font-bold uppercase text-[10px]">1. Location Placement</span>
                            <span className="px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800 text-[9px]">
                              {wo.provenanceManifest.targetLocation.classification}
                            </span>
                          </div>
                          <p className="text-storm-300 text-[10px] font-sans">
                            {wo.provenanceManifest.targetLocation.disclosure}
                          </p>
                        </div>

                        <div className="bg-onyx-900 p-2 rounded border border-onyx-800 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-storm-400 font-bold uppercase text-[10px]">2. Access Ingress</span>
                            <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[9px]">
                              {wo.provenanceManifest.ingressCorridor.classification}
                            </span>
                          </div>
                          <p className="text-storm-300 text-[10px] font-sans">
                            {wo.provenanceManifest.ingressCorridor.disclosure}
                          </p>
                        </div>

                        <div className="bg-onyx-900 p-2 rounded border border-onyx-800 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-storm-400 font-bold uppercase text-[10px]">3. Hydraulic Rate / Sink</span>
                            <span className="px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800 text-[9px]">
                              {wo.provenanceManifest.hydraulicCapacityOrSink.classification}
                            </span>
                          </div>
                          <p className="text-storm-300 text-[10px] font-sans">
                            {wo.provenanceManifest.hydraulicCapacityOrSink.disclosure}
                          </p>
                        </div>

                        <div className="bg-onyx-900 p-2 rounded border border-onyx-800 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-storm-400 font-bold uppercase text-[10px]">4. Adverse Consequences</span>
                            <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[9px]">
                              {wo.provenanceManifest.adverseConsequences.classification}
                            </span>
                          </div>
                          <p className="text-storm-300 text-[10px] font-sans">
                            {wo.provenanceManifest.adverseConsequences.disclosure}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Plan Alpha Adverse Deflection Warning */}
                  {wo.adverseConsequenceAnalysis?.hasAdverseImpact && (
                    <div className="bg-amber-950/40 p-3 rounded border border-amber-700/70 space-y-1 text-xs">
                      <div className="text-amber-300 font-bold uppercase text-[10px] flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>LOCALIZED ADVERSE FLOODWATER DEFLECTION WARNING</span>
                        <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-700 text-[9px]">DERIVED</span>
                      </div>
                      <p className="text-storm-200 font-sans leading-relaxed">
                        {wo.adverseConsequenceAnalysis.description}
                      </p>
                      {wo.adverseConsequenceAnalysis.mitigationRecommendation && (
                        <div className="text-[11px] text-amber-200/90 font-sans pt-0.5">
                          <strong>Mitigation Recommendation:</strong> {wo.adverseConsequenceAnalysis.mitigationRecommendation}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Plan Gamma / Beta Solver Abstraction Disclosure */}
                  {wo.supportingSimulationEvidence?.solverAbstractionNotice && (
                    <div className="bg-onyx-950 p-2.5 rounded border border-cyan-900/50 flex items-start gap-2 text-[10.5px] text-cyan-200/90">
                      <Info className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-cyan-300 uppercase">SOLVER ABSTRACTION DISCLOSURE:</strong>{' '}
                        {wo.supportingSimulationEvidence.solverAbstractionNotice}
                      </div>
                    </div>
                  )}

                  {/* Target Coordinates and Ingress Grid */}
                  <div className="bg-onyx-950 rounded-lg p-3.5 border border-onyx-800 space-y-2.5">
                    <div className="flex items-center justify-between text-storm-400 font-bold text-[10px] uppercase tracking-wider border-b border-onyx-850 pb-1.5">
                      <span className="flex items-center gap-1.5 text-cyan-400">
                        <MapPin className="w-3.5 h-3.5 text-safety-orange" />
                        TARGET FACILITY &amp; GEOSPATIAL COORDINATES
                      </span>
                      <span className="text-storm-500">
                        GRID CELL: [{wo.targetLocation.gridCell[0]}, {wo.targetLocation.gridCell[1]}]
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 text-[11px]">
                      <div className="bg-onyx-900/80 p-2 rounded border border-onyx-800">
                        <span className="text-storm-500 block text-[9px] uppercase">TARGET SITE</span>
                        <span className="text-storm-200 font-bold block truncate" title={wo.targetLocation.name}>
                          {wo.targetLocation.name}
                        </span>
                      </div>

                      <div className="bg-onyx-900/80 p-2 rounded border border-onyx-800">
                        <span className="text-storm-500 block text-[9px] uppercase">WGS84 GEODETIC</span>
                        <span className="text-cyan-300 font-mono font-bold block">
                          {wo.targetLocation.wgs84.lat.toFixed(5)}°N, {Math.abs(wo.targetLocation.wgs84.lon).toFixed(5)}°W
                        </span>
                      </div>

                      <div className="bg-onyx-900/80 p-2 rounded border border-onyx-800">
                        <span className="text-storm-500 block text-[9px] uppercase">EPSG:26986 STATE PLANE</span>
                        <span className="text-purple-300 font-mono font-bold block">
                          X: {wo.targetLocation.projected.x.toFixed(2)}, Y: {wo.targetLocation.projected.y.toFixed(2)}
                        </span>
                      </div>

                      <div className="bg-onyx-900/80 p-2 rounded border border-onyx-800">
                        <span className="text-storm-500 block text-[9px] uppercase">INGRESS ROUTE</span>
                        <span className="text-emerald-300 font-mono font-bold block truncate" title={wo.targetLocation.accessCorridor}>
                          <Navigation className="w-3 h-3 inline mr-1 text-emerald-400" />
                          {wo.targetLocation.accessCorridor}
                        </span>
                      </div>
                    </div>

                    {wo.targetLocation.provenanceNotice && (
                      <div className="text-[10px] text-storm-400 italic pt-0.5">
                        * {wo.targetLocation.provenanceNotice}
                      </div>
                    )}
                  </div>

                  {/* Tactical Equipment & Crew Requirements */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-onyx-950 p-3 rounded-lg border border-onyx-800 space-y-1.5">
                      <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" />
                          <span>TACTICAL CREW SIZING CONSIDERATION</span>
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800 text-[8.5px]">PLANNING ASSUMPTION</span>
                      </div>
                      <div className="text-xs text-storm-200 font-sans">
                        {wo.crewRequirement}
                      </div>
                    </div>

                    <div className="bg-onyx-950 p-3 rounded-lg border border-onyx-800 space-y-1.5">
                      <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Wrench className="w-3.5 h-3.5" />
                          <span>EQUIPMENT PLANNING CONSIDERATIONS</span>
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800 text-[8.5px]">PLANNING ASSUMPTION</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {wo.tacticalEquipment.map((eq, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-onyx-900 border border-onyx-700 rounded text-[10px] text-storm-300">
                            {eq}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Chronological Tactical Task Protocol Checklist */}
                  <div className="bg-onyx-950 rounded-lg p-3.5 border border-onyx-800 space-y-2.5">
                    <div className="flex items-center justify-between text-storm-400 font-bold text-[10px] uppercase tracking-wider border-b border-onyx-850 pb-1.5">
                      <span className="flex items-center gap-1.5 text-storm-200">
                        <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                        OPERATIONAL PLANNING REVIEW CHECKLIST ({reviewedCount}/{totalTasks} REVIEWED)
                      </span>
                      <span className="text-cyan-400">{progressPct}% STAGING COMPLETE</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-onyx-900 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          progressPct === 100 ? 'bg-emerald-500' : 'bg-cyan-500'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>

                    <div className="space-y-2 pt-1">
                      {wo.operationalTasks.map((t) => (
                        <div
                          key={t.stepNumber}
                          onClick={() => handleToggleTask(wo.workOrderId, t.stepNumber)}
                          className={`p-2.5 rounded border transition-colors cursor-pointer flex items-start gap-2.5 ${
                            t.isCompleted 
                              ? 'bg-emerald-950/20 border-emerald-800/60 text-storm-200' 
                              : 'bg-onyx-900/80 border-onyx-800 hover:bg-onyx-850/60 text-storm-300'
                          }`}
                        >
                          <button
                            type="button"
                            className="mt-0.5 text-cyan-400 hover:text-cyan-300 flex-shrink-0"
                          >
                            {t.isCompleted ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Square className="w-4 h-4 text-storm-500" />
                            )}
                          </button>

                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-onyx-950 border border-onyx-700 rounded text-storm-400">
                                STEP {t.stepNumber}
                              </span>
                              <span className={`font-bold text-xs ${t.isCompleted ? 'text-emerald-300' : 'text-storm-100'}`}>
                                {t.title}
                              </span>
                            </div>

                            <p className="text-[11px] font-sans text-storm-300 leading-relaxed">
                              {t.instruction}
                            </p>

                            {t.safetyCaution && (
                              <div className="mt-1 p-1.5 rounded bg-amber-950/40 border border-amber-800/60 text-[10px] text-amber-300 flex items-start gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                                <span><strong>SAFETY NOTE:</strong> {t.safetyCaution}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="text-[10px] text-storm-500 italic pt-1">
                      * Note: Checkbox indicates desk-side operational planning review for staging. Does NOT represent physical field execution or safety certification.
                    </div>
                  </div>

                  {/* Supporting Hydraulic Simulation Evidence */}
                  <div className="bg-onyx-950 p-3 rounded-lg border border-onyx-800 space-y-2">
                    <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        SUPPORTING HYDRAULIC SIMULATION EVIDENCE
                      </span>
                      <span className="text-storm-500 font-mono text-[9px]">
                        HASH: {wo.supportingSimulationEvidence.scenarioHash.slice(0, 15)}...
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                      <div className="p-2 bg-onyx-900 rounded border border-onyx-800">
                        <span className="text-storm-500 block uppercase">AVOIDED STORAGE</span>
                        <strong className="text-emerald-400 text-xs">+{wo.supportingSimulationEvidence.avoidedSurfaceVolumeM3} m³</strong>
                      </div>

                      <div className="p-2 bg-onyx-900 rounded border border-onyx-800">
                        <span className="text-storm-500 block uppercase">PEAK DEPTH REDUCTION</span>
                        <strong className="text-cyan-300 text-xs">{wo.supportingSimulationEvidence.peakDepthReductionM.toFixed(2)} m</strong>
                      </div>

                      <div className="p-2 bg-onyx-900 rounded border border-onyx-800">
                        <span className="text-storm-500 block uppercase">STORM PROFILE</span>
                        <strong className="text-storm-200 truncate block">{wo.supportingSimulationEvidence.stormScenario}</strong>
                      </div>

                      <div className="p-2 bg-onyx-900 rounded border border-onyx-800">
                        <span className="text-storm-500 block uppercase">PROTECTED CORRIDORS</span>
                        <strong className="text-storm-200 truncate block">
                          {wo.supportingSimulationEvidence.protectedRoads.join(', ')}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Incident Commander Review & Decision Linkage */}
                  <div className="bg-onyx-950 p-3 rounded-lg border border-onyx-800 space-y-1.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px]">
                      <span className="text-storm-400 font-bold uppercase flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-safety-orange" />
                        DECISION AUTHORIZATION PROVENANCE:
                      </span>
                      <span className="text-storm-200 font-bold">
                        {wo.humanReview.reviewedBy} [{wo.humanReview.role}]
                      </span>
                    </div>
                    <p className="text-xs font-sans text-storm-300 italic">
                      "{wo.humanReview.engineeringRationale}"
                    </p>
                  </div>

                  {/* Staged Execution & Jira Linking Bar */}
                  <div className="pt-2 border-t border-onyx-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      {wo.stage === 'PREPARED_DRAFT' && (
                        <button
                          onClick={() => handleAdvanceToStaged(wo)}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold text-xs flex items-center gap-1.5 transition-colors shadow-tactical"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>STAGE FOR COMMANDER REVIEW</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}

                      {wo.stage === 'COMMANDER_STAGED' && (
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <input
                            type="text"
                            value={linkInputMap[wo.workOrderId] || ''}
                            onChange={(e) => setLinkInputMap({ ...linkInputMap, [wo.workOrderId]: e.target.value })}
                            placeholder="Jira Issue Key (e.g. JSM-4902)"
                            className="bg-onyx-950 border border-onyx-700 rounded px-2.5 py-1 text-xs text-storm-100 placeholder-storm-600 focus:outline-none focus:border-cyan-500 w-48 font-mono"
                          />
                          <button
                            onClick={() => handleBindJiraIssue(wo)}
                            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold text-xs flex items-center gap-1.5 transition-colors shadow-tactical whitespace-nowrap"
                          >
                            <LinkIcon className="w-3.5 h-3.5" />
                            <span>BIND TO JIRA ISSUE</span>
                          </button>
                        </div>
                      )}

                      {wo.stage === 'JIRA_LINKED' && (
                        <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>ACTIVE JIRA BINDING: {wo.jiraIntegration?.linkedIssueKey}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-storm-500" />
                        </div>
                      )}
                      {(wo.stage === 'COMMANDER_STAGED' || wo.stage === 'JIRA_LINKED') && (
                        ['DEC-2026-079', 'DEC-2026-080', 'DEC-2026-081'].includes(wo.decisionId)
                          ? <span className="px-3 py-1 rounded bg-onyx-800 border border-onyx-700 text-storm-400 font-bold text-xs whitespace-nowrap">Demo example — approve in Step 03 to create a dispatchable work order</span>
                          : <button onClick={() => handleDispatchLive(wo)} disabled={dispatchState[wo.workOrderId]?.status === 'working'} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded font-bold text-xs whitespace-nowrap">{dispatchState[wo.workOrderId]?.status === 'working' ? 'DISPATCHING…' : 'DISPATCH LIVE JIRA ISSUE'}</button>
                      )}
                      {dispatchState[wo.workOrderId] && (
                        <span className={`text-xs font-bold ${dispatchState[wo.workOrderId].status === 'error' ? 'text-red-300' : dispatchState[wo.workOrderId].status === 'success' ? 'text-emerald-300' : 'text-cyan-300'}`}>{dispatchState[wo.workOrderId].message}</span>
                      )}
                      {dispatchedLinks[wo.workOrderId] && (
                        dispatchedLinks[wo.workOrderId].issueUrl
                          ? <a href={dispatchedLinks[wo.workOrderId].issueUrl} target="_blank" rel="noreferrer" className="text-cyan-300 underline font-bold text-xs">{dispatchedLinks[wo.workOrderId].issueKey}</a>
                          : <span className="text-emerald-300 font-bold text-xs">{dispatchedLinks[wo.workOrderId].issueKey}</span>
                      )}
                    </div>

                    {/* Safety Notice / Truth Gate */}
                    <div className="flex items-center gap-1.5 text-[10px] text-storm-400 bg-onyx-950 px-2.5 py-1 rounded border border-onyx-800">
                      <Lock className="w-3 h-3 text-amber-400 flex-shrink-0" />
                      <span>{dispatchedLinks[wo.workOrderId] ? `Dispatched: ${dispatchedLinks[wo.workOrderId].issueKey}` : `${wo.jiraIntegration.dispatchStatus}: Human-triggered live dispatch available`}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StageIntro subtitle="Turn an approved decision into a work order, stage it, then dispatch it to Jira." />
        <button type="button" onClick={() => setActiveStage('interventions')} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-safety-orange hover:bg-orange-600 text-white text-xs font-mono font-bold">
          Approve a new decision <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* Notice Banner */}
      <div className="bg-onyx-900 border-l-4 border-cyan-500 p-4 rounded-r border-y border-r border-onyx-800 flex items-start gap-3">
        <Ticket className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs font-mono text-storm-300 space-y-1">
          <div className="font-bold text-storm-100 uppercase tracking-wider flex items-center gap-2">
            <span>OPERATIONAL WORK ORDERS &amp; JSM STAGING QUEUE</span>
            <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-cyan-300 text-[10px]">
              WORKSTREAM 4A VERIFIED
            </span>
          </div>
          <p className="text-storm-300 font-sans">
            Approved hydrodynamic mitigation decisions transition through rigorous operational staging: from <strong>PREPARED DRAFT</strong> to <strong>COMMANDER STAGED</strong> and <strong>JIRA LINKED</strong>. Every operational claim explicitly distinguishes between <em>Source-Verified</em>, <em>Derived</em>, <em>Planning Assumptions</em>, and <em>Unverified</em> content.
          </p>
          <p className="text-amber-300 font-sans">
            Demo seed cards (DEC-2026-080/081, e.g. JSM-4902) are illustrative staging examples — they are <strong>not</strong> live Jira tickets. Real work orders appear only after you approve a decision in Step 03 and dispatch.
          </p>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-700 rounded text-xs font-mono text-emerald-200 flex items-center gap-2 shadow-tactical">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-onyx-900 p-3 rounded-lg border border-onyx-800 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs shadow-tactical">
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setSelectedStage('ALL')}
            className={`px-3 py-1.5 rounded transition-colors text-[11px] font-bold ${
              selectedStage === 'ALL'
                ? 'bg-cyan-600 text-white shadow-tactical'
                : 'bg-onyx-950 text-storm-300 hover:bg-onyx-850 border border-onyx-800'
            }`}
          >
            ALL ({workOrders.length})
          </button>
          <button
            onClick={() => setSelectedStage('PREPARED_DRAFT')}
            className={`px-3 py-1.5 rounded transition-colors text-[11px] font-bold ${
              selectedStage === 'PREPARED_DRAFT'
                ? 'bg-slate-600 text-white shadow-tactical'
                : 'bg-onyx-950 text-storm-300 hover:bg-onyx-850 border border-onyx-800'
            }`}
          >
            DRAFT ({countDraft})
          </button>
          <button
            onClick={() => setSelectedStage('COMMANDER_STAGED')}
            className={`px-3 py-1.5 rounded transition-colors text-[11px] font-bold ${
              selectedStage === 'COMMANDER_STAGED'
                ? 'bg-amber-600 text-white shadow-tactical'
                : 'bg-onyx-950 text-storm-300 hover:bg-onyx-850 border border-onyx-800'
            }`}
          >
            STAGED ({countStaged})
          </button>
          <button
            onClick={() => setSelectedStage('JIRA_LINKED')}
            className={`px-3 py-1.5 rounded transition-colors text-[11px] font-bold ${
              selectedStage === 'JIRA_LINKED'
                ? 'bg-emerald-600 text-white shadow-tactical'
                : 'bg-onyx-950 text-storm-300 hover:bg-onyx-850 border border-onyx-800'
            }`}
          >
            JIRA LINKED ({countLinked})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-storm-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search site, ID, or issue..."
            className="w-full bg-onyx-950 border border-onyx-700 rounded pl-8 pr-3 py-1.5 text-xs text-storm-100 placeholder-storm-600 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Work Orders List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="p-8 text-center bg-onyx-900 border border-onyx-800 rounded-lg text-storm-400 font-mono text-xs">
            Loading staged operational work orders...
          </div>
        ) : filteredWorkOrders.length === 0 ? (
          <div className="p-8 text-center bg-onyx-900 border border-onyx-800 rounded-lg text-storm-400 font-mono text-xs space-y-2">
            <p>No operational work orders found matching the selected filter criteria.</p>
            <p className="text-[11px] text-storm-500">
              Work orders are prepared from approved mitigation decisions in Tab 05 (Decision Records).
            </p>
          </div>
        ) : (
          (() => {
            const { real, demo } = partitionWorkOrders(filteredWorkOrders);
            return (
              <>
                {real.length === 0 && (
                  <div className="p-6 text-center bg-onyx-900 border border-onyx-800 rounded-lg text-storm-400 font-mono text-xs">No real work orders yet — approve a decision in Step 03 to create one, then dispatch it here.</div>
                )}
                {real.map((wo) => renderWorkOrderCard(wo))}
                {demo.length > 0 && (
                  <Accordion title={`Example Templates (${demo.length})`} testId="example-templates">
                    <div className="space-y-4 pt-2">{demo.map((wo) => renderWorkOrderCard(wo))}</div>
                  </Accordion>
                )}
              </>
            );
          })()
        )}
      </div>
    </div>
  );
};