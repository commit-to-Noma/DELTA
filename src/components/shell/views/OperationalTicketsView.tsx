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
  ArrowRight
} from 'lucide-react';
import { 
  OperationalWorkOrder, 
  WorkOrderStage, 
  getStoredWorkOrders, 
  saveStoredWorkOrder, 
  linkWorkOrderToIssue 
} from '../../../simulation/workOrderEngine';
import { invokeSafe } from '../../../services/forgeBridge';

export const OperationalTicketsView: React.FC = () => {
  const [workOrders, setWorkOrders] = useState<OperationalWorkOrder[]>([]);
  const [selectedStage, setSelectedStage] = useState<'ALL' | WorkOrderStage>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [linkInputMap, setLinkInputMap] = useState<Record<string, string>>({});
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Load stored work orders on mount
  useEffect(() => {
    refreshWorkOrders();
  }, []);

  const refreshWorkOrders = async () => {
    // 1. Get locally stored/seed work orders
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
    }
  };

  // Toggle task completion
  const handleToggleTask = (workOrderId: string, stepNumber: number) => {
    const updated = workOrders.map((wo) => {
      if (wo.workOrderId !== workOrderId) return wo;
      const updatedTasks = wo.operationalTasks.map((task) => {
        if (task.stepNumber !== stepNumber) return task;
        return { ...task, isCompleted: !task.isCompleted };
      });
      const newWo = { ...wo, operationalTasks: updatedTasks, updatedAt: new Date().toISOString() };
      saveStoredWorkOrder(newWo);
      invokeSafe('saveWorkOrder', { workOrder: newWo }).catch(() => {});
      return newWo;
    });
    setWorkOrders(updated);
  };

  // Stage work order for Commander review
  const handleAdvanceToStaged = async (wo: OperationalWorkOrder) => {
    const updated: OperationalWorkOrder = {
      ...wo,
      stage: 'COMMANDER_STAGED',
      humanReview: {
        ...wo.humanReview,
        reviewedAt: new Date().toISOString()
      },
      updatedAt: new Date().toISOString()
    };
    saveStoredWorkOrder(updated);
    setWorkOrders(prev => prev.map(w => w.workOrderId === updated.workOrderId ? updated : w));
    setActionNotice(`Work order ${wo.workOrderId} advanced to COMMANDER_STAGED! Ready for Jira ticket assignment.`);
    try {
      await invokeSafe('saveWorkOrder', { workOrder: updated });
    } catch {}
    setTimeout(() => setActionNotice(null), 5000);
  };

  // Bind work order to Jira issue key
  const handleBindJiraIssue = async (wo: OperationalWorkOrder) => {
    const issueKey = (linkInputMap[wo.workOrderId] || 'JSM-4902').trim().toUpperCase();
    if (!issueKey) return;

    const updated = linkWorkOrderToIssue(wo.workOrderId, issueKey);
    if (updated) {
      setWorkOrders(prev => prev.map(w => w.workOrderId === updated.workOrderId ? updated : w));
      setActionNotice(`Work order ${wo.workOrderId} bound to Jira issue ${issueKey}!`);
      try {
        await invokeSafe('saveWorkOrder', { workOrder: updated });
      } catch {}
      setTimeout(() => setActionNotice(null), 5000);
    }
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

  return (
    <div className="space-y-6">
      {/* Notice Banner */}
      <div className="bg-onyx-900 border-l-4 border-cyan-500 p-4 rounded-r border-y border-r border-onyx-800 flex items-start gap-3">
        <Ticket className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs font-mono text-storm-300 space-y-1">
          <div className="font-bold text-storm-100 uppercase tracking-wider flex items-center gap-2">
            <span>OPERATIONAL WORK ORDERS & JSM FIELD DISPATCH QUEUE</span>
            <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-cyan-300 text-[10px]">
              WORKSTREAM 4 VERIFIED
            </span>
          </div>
          <p className="text-storm-300 font-sans">
            Approved hydrodynamic mitigation decisions transition through rigorous operational staging: from <strong>PREPARED DRAFT</strong> (surveyed coordinates, equipment specifications, and tactical checklists) to <strong>COMMANDER STAGED</strong> and <strong>JIRA LINKED</strong>.
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
        {filteredWorkOrders.length === 0 ? (
          <div className="p-8 text-center bg-onyx-900 border border-onyx-800 rounded-lg text-storm-400 font-mono text-xs">
            No operational work orders found matching the selected filter criteria.
          </div>
        ) : (
          filteredWorkOrders.map((wo) => {
            const completedCount = wo.operationalTasks.filter(t => t.isCompleted).length;
            const totalTasks = wo.operationalTasks.length;
            const progressPct = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

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
                  </div>
                </div>

                <div className="p-5 space-y-4 text-xs">
                  {/* Plan Name & Strategic Rationale */}
                  <div>
                    <h3 className="text-sm font-bold text-storm-100 font-sans">
                      {wo.planName}
                    </h3>
                    <p className="text-storm-300 font-sans text-xs pt-1 leading-relaxed">
                      {wo.priorityRationale}
                    </p>
                  </div>

                  {/* Target Coordinates and Ingress Grid */}
                  <div className="bg-onyx-950 rounded-lg p-3.5 border border-onyx-800 space-y-2.5">
                    <div className="flex items-center justify-between text-storm-400 font-bold text-[10px] uppercase tracking-wider border-b border-onyx-850 pb-1.5">
                      <span className="flex items-center gap-1.5 text-cyan-400">
                        <MapPin className="w-3.5 h-3.5 text-safety-orange" />
                        AUTHORITATIVE SITE GEOLOCATION & CORRIDOR
                      </span>
                      <span className="text-storm-500">
                        GRID CELL: [{wo.targetLocation.gridCell[0]}, {wo.targetLocation.gridCell[1]}]
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 text-[11px]">
                      <div className="bg-onyx-900/80 p-2 rounded border border-onyx-800">
                        <span className="text-storm-500 block text-[9px] uppercase">TARGET FACILITY</span>
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
                        <span className="text-storm-500 block text-[9px] uppercase">ACCESS CORRIDOR</span>
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
                      <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        <span>TACTICAL CREW REQUIREMENT</span>
                      </div>
                      <div className="text-xs text-storm-200 font-sans">
                        {wo.crewRequirement}
                      </div>
                    </div>

                    <div className="bg-onyx-950 p-3 rounded-lg border border-onyx-800 space-y-1.5">
                      <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5" />
                        <span>DEPLOYED HEAVY EQUIPMENT & GEAR</span>
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

                  {/* Tactical Task Protocol Checklist */}
                  <div className="bg-onyx-950 rounded-lg p-3.5 border border-onyx-800 space-y-2.5">
                    <div className="flex items-center justify-between text-storm-400 font-bold text-[10px] uppercase tracking-wider border-b border-onyx-850 pb-1.5">
                      <span className="flex items-center gap-1.5 text-storm-200">
                        <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                        CHRONOLOGICAL OPERATIONAL TASK PROTOCOL ({completedCount}/{totalTasks} VERIFIED)
                      </span>
                      <span className="text-cyan-400">{progressPct}% EXECUTED</span>
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
                              <span className={`font-bold text-xs ${t.isCompleted ? 'line-through text-storm-400' : 'text-storm-100'}`}>
                                {t.title}
                              </span>
                            </div>

                            <p className="text-[11px] font-sans text-storm-300 leading-relaxed">
                              {t.instruction}
                            </p>

                            {t.safetyCaution && (
                              <div className="mt-1 p-1.5 rounded bg-amber-950/40 border border-amber-800/60 text-[10px] text-amber-300 flex items-start gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                                <span><strong>SAFETY CAUTION:</strong> {t.safetyCaution}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
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
                        INCIDENT COMMANDER AUTHORIZATION:
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
                    </div>

                    {/* Safety Notice / Truth Gate */}
                    <div className="flex items-center gap-1.5 text-[10px] text-storm-400 bg-onyx-950 px-2.5 py-1 rounded border border-onyx-800">
                      <Lock className="w-3 h-3 text-amber-400 flex-shrink-0" />
                      <span>{wo.jiraIntegration.dispatchStatus}: Server lock active (manual dispatch required)</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};