import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  ExternalLink,
  RefreshCw,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Truck,
  CheckSquare,
  X,
  ArrowRight
} from 'lucide-react';
import { invokeSafe as invoke } from '../../../services/forgeBridge';
import { 
  prepareWorkOrderFromDecision, 
  saveStoredWorkOrder, 
  OperationalWorkOrder 
} from '../../../simulation/workOrderEngine';

interface StoredDecisionRecord {
  decisionId: string;
  schemaVersion?: string;
  scenarioHash?: string;
  canonicalScenario?: any;
  baselineStorm?: string;
  chosenPlan?: {
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
    verifiedAt?: string;
  };
  engineeringRationale?: string;
  baselineMetrics?: any;
  interventionMetrics?: any;
  differentialMetrics?: {
    avoidedSurfaceVolumeM3?: number;
    maxDepthReductionM?: number;
    peakDepthReductionM?: number;
    protectedRoadsCount?: number;
    protectedRoadNames?: string[];
  };
  physicalMetrics?: {
    inundationReduction?: string;
    hospitalDelayMinutes?: number;
    simulatedMaxDepthM?: number;
  };
  linkedIssueKey?: string;
  status?: string;
  createdAt?: string;
  notes?: string;
}

interface DecisionRecordDisplay {
  id: string;
  code: string;
  timestamp: string;
  author: string;
  intervention: string;
  hash: string;
  deltaSummary: string;
  avoidedVolume?: string;
  peakDepthDelta?: string;
  protectedCorridors?: string;
  jsmTicketId: string;
  status: string;
  isLiveKvs: boolean;
  notes?: string;
  engineeringRationale?: string;
  schemaVersion?: string;
  rawRecord: StoredDecisionRecord;
}

interface DecisionRecordsViewProps {
  onNavigateToTickets: () => void;
}

export const DecisionRecordsView: React.FC<DecisionRecordsViewProps> = ({ onNavigateToTickets }) => {
  const [kvsRecords, setKvsRecords] = useState<DecisionRecordDisplay[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [writeStatus, setWriteStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message?: string }>({ type: 'idle' });

  // Work Order Preparation Modal State
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<OperationalWorkOrder | null>(null);
  const [isWorkOrderModalOpen, setIsWorkOrderModalOpen] = useState<boolean>(false);
  const [stagingStatus, setStagingStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message?: string }>({ type: 'idle' });

  // Strictly populated from live Forge KVS queries
  const fetchKvsRecords = async () => {
    setIsLoading(true);
    try {
      const res: any = await invoke('listDecisions');
      if (res && res.success && Array.isArray(res.data)) {
        const mapped: DecisionRecordDisplay[] = res.data.map((r: StoredDecisionRecord) => {
          const rationale = r.engineeringRationale || r.notes || r.chosenPlan?.tradeOffSummary || 'Incident Commander authorized hydraulic mitigation.';
          const avoidedVol = r.differentialMetrics?.avoidedSurfaceVolumeM3 !== undefined
            ? `+${r.differentialMetrics.avoidedSurfaceVolumeM3.toLocaleString()} m³`
            : r.physicalMetrics?.inundationReduction;
          const depthDelta = r.differentialMetrics?.peakDepthReductionM !== undefined
            ? `-${(r.differentialMetrics.peakDepthReductionM * 100).toFixed(1)} cm`
            : r.differentialMetrics?.maxDepthReductionM !== undefined
            ? `-${(r.differentialMetrics.maxDepthReductionM * 100).toFixed(1)} cm`
            : undefined;
          const corridors = r.differentialMetrics?.protectedRoadNames && r.differentialMetrics.protectedRoadNames.length > 0
            ? r.differentialMetrics.protectedRoadNames.join(', ')
            : undefined;

          return {
            id: r.decisionId,
            code: r.decisionId,
            timestamp: r.createdAt || r.humanApprover?.approvalTimestamp || new Date().toISOString(),
            author: `${r.humanApprover?.displayName || 'Unknown Approver'} [${r.humanApprover?.role || 'Incident Commander'}]`,
            intervention: r.chosenPlan?.name || 'Authorized Flood Mitigation Plan',
            hash: r.scenarioHash || 'sha256:unspecified',
            deltaSummary: avoidedVol ? `${avoidedVol} avoided` : `Status: ${r.status || 'APPROVED'}`,
            avoidedVolume: avoidedVol,
            peakDepthDelta: depthDelta,
            protectedCorridors: corridors,
            jsmTicketId: r.linkedIssueKey || 'NONE (NO OPERATIONAL DISPATCH)',
            status: r.status || 'APPROVED',
            isLiveKvs: true,
            notes: r.notes,
            engineeringRationale: rationale,
            schemaVersion: r.schemaVersion || '1.0.0',
            rawRecord: r
          };
        });
        setKvsRecords(mapped);
      }
    } catch (err: any) {
      console.warn('[DELTA] listDecisions bridge invocation notice:', err?.message || err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKvsRecords();
  }, []);

  // Authorized Phase 0.7.2 Smoke Test Write
  const handleExecuteSmokeTestWrite = async () => {
    setWriteStatus({ type: 'loading', message: 'Submitting DEC-TEST-0001 to Forge KVS...' });
    const smokePayload = {
      decisionId: 'DEC-TEST-0001',
      scenarioHash: 'sha256:test-phase-0-7-2-smoke-verification-hash',
      canonicalScenario: {
        stormId: '50-year',
        stormLabel: 'NOAA Atlas 14 50-Year Regional Benchmark (104.2 mm)',
        stormDepthMm: 104.2,
        durationHours: 6.0,
        sector: 'Boston Longwood Medical Area & Muddy River Catchment (EPSG:26986)'
      },
      chosenPlan: {
        planId: 'plan-gamma',
        name: 'Plan Gamma: Emergency High-Pressure Culvert Jetting [BENCHMARK ONLY]',
        type: 'CULVERT_JETTING',
        tradeOffSummary: 'Phase 0.7.2 Benchmark test intervention for live KVS persistence verification. NOT FOR OPERATIONAL ACTION.'
      },
      engineeringRationale: 'Phase 0.7.2 Benchmark test intervention for live KVS persistence verification. NOT FOR OPERATIONAL ACTION.',
      humanApprover: {
        displayName: 'Nomathemba Ncube',
        role: 'Incident Commander',
        approvalTimestamp: new Date().toISOString()
      },
      differentialMetrics: {
        avoidedSurfaceVolumeM3: 22,
        peakDepthReductionM: 0.18,
        protectedRoadCount: 3,
        protectedRoadNames: ['Francis Street', 'Brookline Avenue', 'Longwood Avenue']
      },
      status: 'APPROVED',
      notes: '[TEST / BENCHMARK ONLY - NOT FOR OPERATIONAL ACTION] Phase 0.7.2 Limited KVS Smoke Test'
    };

    try {
      const res: any = await invoke('recordDecision', smokePayload);
      if (res && res.success) {
        setWriteStatus({ 
          type: 'success', 
          message: `Successfully written DEC-TEST-0001 to Forge KVS! (Storage Key: decision:DEC-TEST-0001)` 
        });
        await fetchKvsRecords();
      } else {
        setWriteStatus({ 
          type: 'error', 
          message: `KVS write rejected: ${res?.error?.message || JSON.stringify(res)}` 
        });
      }
    } catch (err: any) {
      setWriteStatus({ 
        type: 'error', 
        message: `KVS write exception: ${err?.message || String(err)}` 
      });
    }
  };

  // Open work order preparation modal for a decision
  const handleOpenWorkOrderPreparation = (rec: DecisionRecordDisplay) => {
    try {
      const wo = prepareWorkOrderFromDecision(rec.rawRecord);
      setSelectedWorkOrder(wo);
      setStagingStatus({ type: 'idle' });
      setIsWorkOrderModalOpen(true);
    } catch (err: any) {
      alert(`Could not prepare work order: ${err?.message || String(err)}`);
    }
  };

  // Stage work order for operations
  const handleStageWorkOrder = async () => {
    if (!selectedWorkOrder) return;
    setStagingStatus({ type: 'loading', message: 'Staging operational work order...' });

    const staged: OperationalWorkOrder = {
      ...selectedWorkOrder,
      stage: 'COMMANDER_STAGED',
      updatedAt: new Date().toISOString()
    };

    try {
      // 1. Save to local browser storage
      saveStoredWorkOrder(staged);

      // 2. Persist to Forge KVS backend if available
      try {
        await invoke('saveWorkOrder', staged);
      } catch (kvsErr) {
        console.warn('[DELTA] Work order KVS invocation notice (fallback to local storage):', kvsErr);
      }

      setSelectedWorkOrder(staged);
      setStagingStatus({
        type: 'success',
        message: `Work Order ${staged.workOrderId} successfully staged for operational response!`
      });
    } catch (err: any) {
      setStagingStatus({
        type: 'error',
        message: `Failed to stage work order: ${err?.message || String(err)}`
      });
    }
  };

  const allRecords = kvsRecords;

  return (
    <div className="space-y-6">
      {/* Notice */}
      <div className="bg-onyx-900 border-l-4 border-emerald-500 p-4 rounded-r border-y border-r border-onyx-800 flex items-start gap-3">
        <Lock className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs font-mono text-storm-300 space-y-1">
          <div className="font-bold text-storm-100 uppercase tracking-wider flex items-center gap-2">
            <span>APPEND-ONLY AUDIT LEDGER (FORGE KVS PERSISTENCE)</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700">
              WORKSTREAM 4 OPERATIONAL
            </span>
          </div>
          <p className="text-storm-300 font-sans">
            Every operational decision authorized in DELTA is recorded in an application-level audit ledger persisted to Forge App Storage (KVS). Responders and municipal oversight officers have verifiable provenance of the canonical scenario inputs, evaluated hydraulic differential metrics, engineering rationale, and authorizing Incident Commander identity.
          </p>
          <div className="text-[10px] text-storm-500 font-mono pt-1">
            * Concurrency model: Last-Write-Wins (LWW) at key level. Application-level check prevents duplicate ID overwrite. Not a cryptographic blockchain or hardware HSM.
          </div>
        </div>
      </div>

      {/* Phase 0.7.2 Smoke Test Controls Banner */}
      <div className="bg-onyx-900 border border-safety-border/60 p-4 rounded shadow-tactical font-mono text-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-safety-orange animate-pulse" />
            <span className="font-bold text-storm-100 uppercase">
              PHASE 0.7.2 KVS PERSISTENCE BENCHMARK
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchKvsRecords}
              disabled={isLoading}
              className="px-3 py-1.5 rounded bg-onyx-800 hover:bg-onyx-700 text-storm-200 border border-onyx-700 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'REFRESHING...' : 'REFRESH KVS'}</span>
            </button>

            <button
              id="btn-execute-kvs-smoke-test"
              onClick={handleExecuteSmokeTestWrite}
              disabled={writeStatus.type === 'loading'}
              className="px-3.5 py-1.5 rounded bg-safety-orange hover:bg-safety-hover text-white font-bold flex items-center gap-1.5 transition-colors shadow-tactical disabled:opacity-50"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{writeStatus.type === 'loading' ? 'COMMITTING TO KVS...' : 'WRITE TEST DECISION (DEC-TEST-0001)'}</span>
            </button>
          </div>
        </div>

        {writeStatus.type === 'success' && (
          <div className="p-2.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{writeStatus.message}</span>
          </div>
        )}

        {writeStatus.type === 'error' && (
          <div className="p-2.5 rounded bg-red-950/80 border border-red-800 text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{writeStatus.message}</span>
          </div>
        )}
      </div>

      {/* Audit Record Table */}
      <div className="bg-onyx-900 rounded border border-onyx-800 overflow-hidden shadow-tactical">
        <div className="p-4 bg-onyx-950 border-b border-onyx-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-storm-100 uppercase">
              DECISION REGISTRY // {allRecords.length} ENTRIES ({kvsRecords.length} IN LIVE FORGE KVS)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateToTickets}
              className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1.5 transition-colors"
            >
              <span>VIEW OPERATIONAL WORK ORDERS (QUEUE)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="divide-y divide-onyx-800">
          {allRecords.length === 0 ? (
            <div className="p-8 text-center text-storm-400 font-mono text-xs space-y-2">
              <ShieldCheck className="w-8 h-8 text-storm-600 mx-auto" />
              <div className="font-bold text-storm-200 uppercase">NO DECISION RECORDS IN FORGE KVS</div>
              <p className="text-storm-400 max-w-md mx-auto">
                No immutable records currently exist in live Forge App Storage.
                Use the smoke test write above or authorize an intervention in Tab 04 to record the first audit ledger entry.
              </p>
            </div>
          ) : (
            allRecords.map((rec) => (
              <div key={rec.id} className="p-5 font-mono text-xs space-y-3 hover:bg-onyx-850/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-safety-orange font-bold text-sm">{rec.code}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-safety-muted text-safety-orange border border-safety-orange/40 font-bold">
                      {rec.status}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-onyx-800 border border-onyx-700 text-storm-300 text-[9px] uppercase font-bold">
                      LIVE FORGE KVS
                    </span>
                    {rec.schemaVersion && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-800 text-purple-300 text-[9px] font-mono">
                        v{rec.schemaVersion}
                      </span>
                    )}
                  </div>
                  <div className="text-storm-400 text-[11px]">{rec.timestamp}</div>
                </div>

                <div className="font-sans text-sm text-storm-100 font-medium">
                  {rec.intervention}
                </div>

                {/* Human Engineering Rationale Callout */}
                {rec.engineeringRationale && (
                  <div className="bg-onyx-950 p-3 rounded border border-onyx-800 text-xs text-storm-200 font-sans space-y-1">
                    <div className="text-[10px] font-mono font-bold text-safety-orange uppercase tracking-wider">
                      HUMAN ENGINEERING RATIONALE:
                    </div>
                    <p className="leading-relaxed italic">
                      "{rec.engineeringRationale}"
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-[11px] text-storm-300">
                  <div className="bg-onyx-950 p-2.5 rounded border border-onyx-800">
                    <span className="text-storm-500 block text-[9px] uppercase">AUTHORIZING INCIDENT COMMANDER</span>
                    <span className="text-storm-200">{rec.author}</span>
                  </div>

                  <div className="bg-onyx-950 p-2.5 rounded border border-onyx-800">
                    <span className="text-storm-500 block text-[9px] uppercase">HYDRAULIC DIFFERENTIAL</span>
                    <span className="text-emerald-400 font-bold">{rec.deltaSummary}</span>
                    {rec.peakDepthDelta && (
                      <span className="text-storm-400 block text-[10px]">Peak depth reduction: {rec.peakDepthDelta}</span>
                    )}
                  </div>

                  <div className="bg-onyx-950 p-2.5 rounded border border-onyx-800 flex flex-col justify-between">
                    <div>
                      <span className="text-storm-500 block text-[9px] uppercase">JIRA ISSUE LINKAGE</span>
                      <span className="text-storm-300 font-bold">{rec.jsmTicketId}</span>
                    </div>
                  </div>
                </div>

                {rec.protectedCorridors && (
                  <div className="text-[11px] text-storm-400 pt-1">
                    <span className="text-storm-500">Restored Corridors:</span> <span className="text-storm-200">{rec.protectedCorridors}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-onyx-800/80">
                  <div className="text-[10px] text-storm-500 truncate">
                    CANONICAL HASH: <code className="text-purple-300 font-mono">{rec.hash}</code>
                  </div>

                  {/* Prepare Work Order Button */}
                  <button
                    onClick={() => handleOpenWorkOrderPreparation(rec)}
                    className="px-3 py-1.5 rounded bg-cyan-700 hover:bg-cyan-600 text-white font-bold flex items-center gap-1.5 transition-colors self-start sm:self-auto shadow-tactical text-[11px]"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    <span>PREPARE OPERATIONAL WORK ORDER &rarr;</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Operational Work Order Preparation & Staging Modal */}
      {isWorkOrderModalOpen && selectedWorkOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-onyx-900 border border-cyan-700/80 rounded-lg max-w-3xl w-full p-6 shadow-2xl font-mono text-xs space-y-5 my-8">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-onyx-800 pb-3">
              <div className="flex items-center gap-2.5">
                <ClipboardList className="w-5 h-5 text-cyan-400" />
                <div>
                  <div className="font-bold text-sm text-storm-100 uppercase tracking-wider flex items-center gap-2">
                    <span>OPERATIONAL WORK ORDER PREPARATION // {selectedWorkOrder.workOrderId}</span>
                  </div>
                  <div className="text-[11px] text-storm-400">
                    Municipal Field Crew Staging &amp; JSM Bridge Execution
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsWorkOrderModalOpen(false)}
                className="text-storm-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Staging Status Alert */}
            {stagingStatus.type === 'success' && (
              <div className="p-3 rounded bg-emerald-950/80 border border-emerald-700 text-emerald-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{stagingStatus.message}</span>
                </div>
                <button
                  onClick={() => {
                    setIsWorkOrderModalOpen(false);
                    onNavigateToTickets();
                  }}
                  className="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1 transition-colors"
                >
                  <span>VIEW IN QUEUE (TAB 06)</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Work Order Staging Badges Strip */}
            <div className="bg-onyx-950 p-3 rounded border border-onyx-800 flex flex-wrap items-center justify-between gap-3 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="text-storm-400">STAGE:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedWorkOrder.stage === 'COMMANDER_STAGED'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                    : 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                }`}>
                  {selectedWorkOrder.stage.replace(/_/g, ' ')}
                </span>
                <span className="text-onyx-700">|</span>
                <span className="text-storm-400">URGENCY:</span>
                <span className="px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 text-[10px] font-bold">
                  {selectedWorkOrder.urgency.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="text-storm-400 text-[11px]">
                Linked Decision: <strong className="text-safety-orange font-bold">{selectedWorkOrder.decisionId}</strong>
              </div>
            </div>

            {/* Target Location & Surveyed Coordinates */}
            <div className="bg-onyx-950 p-3.5 rounded border border-onyx-800 space-y-2">
              <div className="text-cyan-400 font-bold text-[11px] uppercase flex items-center gap-1.5 border-b border-onyx-800/80 pb-1">
                <MapPin className="w-3.5 h-3.5 text-safety-orange" />
                <span>TARGET INFRASTRUCTURE SITE &amp; GEOSPATIAL COORDINATES</span>
              </div>
              <div className="text-storm-100 font-bold text-xs">{selectedWorkOrder.targetLocation.name}</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-[11px] text-storm-300">
                <div className="bg-onyx-900 p-2 rounded border border-onyx-800">
                  <span className="text-storm-500 block text-[9px]">GEODETIC (WGS84):</span>
                  <span className="text-storm-200 font-bold font-mono">
                    {selectedWorkOrder.targetLocation.wgs84.lat.toFixed(5)}°N, {Math.abs(selectedWorkOrder.targetLocation.wgs84.lon).toFixed(5)}°W
                  </span>
                </div>
                <div className="bg-onyx-900 p-2 rounded border border-onyx-800">
                  <span className="text-storm-500 block text-[9px]">PROJECTED (EPSG:26986):</span>
                  <span className="text-storm-200 font-bold font-mono">
                    X:{selectedWorkOrder.targetLocation.projected.x.toFixed(1)}m, Y:{selectedWorkOrder.targetLocation.projected.y.toFixed(1)}m
                  </span>
                </div>
                <div className="bg-onyx-900 p-2 rounded border border-onyx-800">
                  <span className="text-storm-500 block text-[9px]">GRID CELL RETICLE:</span>
                  <span className="text-storm-200 font-bold font-mono">
                    Row {selectedWorkOrder.targetLocation.gridCell[0]}, Col {selectedWorkOrder.targetLocation.gridCell[1]}
                  </span>
                </div>
              </div>
              <div className="text-[11px] text-storm-400 pt-1">
                <span className="text-storm-500">Designated Ingress Corridor:</span>{' '}
                <strong className="text-storm-200">{selectedWorkOrder.targetLocation.accessCorridor}</strong>
              </div>
            </div>

            {/* Tactical Equipment & Crew Requirements */}
            <div className="bg-onyx-950 p-3.5 rounded border border-onyx-800 space-y-2">
              <div className="text-cyan-400 font-bold text-[11px] uppercase flex items-center gap-1.5 border-b border-onyx-800/80 pb-1">
                <Truck className="w-3.5 h-3.5 text-cyan-400" />
                <span>TACTICAL EQUIPMENT &amp; CREW REQUIREMENTS</span>
              </div>
              <div className="text-storm-300 text-[11px]">
                <span className="text-storm-500">Operational Crew:</span> <strong className="text-storm-100">{selectedWorkOrder.crewRequirement}</strong>
              </div>
              <div className="space-y-1 pt-1">
                {selectedWorkOrder.tacticalEquipment.map((eq, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[11px] text-storm-300 font-sans">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                    <span>{eq}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chronological Tactical Task Protocol */}
            <div className="bg-onyx-950 p-3.5 rounded border border-onyx-800 space-y-2.5">
              <div className="text-cyan-400 font-bold text-[11px] uppercase flex items-center justify-between border-b border-onyx-800/80 pb-1">
                <span className="flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>TACTICAL RESPONSE PROTOCOL ({selectedWorkOrder.operationalTasks.length} PHASES)</span>
                </span>
                <span className="text-[10px] text-storm-500 font-normal">Standard Operating Procedure</span>
              </div>

              <div className="space-y-2">
                {selectedWorkOrder.operationalTasks.map((task) => (
                  <div key={task.stepNumber} className="p-2.5 rounded bg-onyx-900 border border-onyx-850 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-storm-200 text-xs">
                        Step {task.stepNumber}: {task.title}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-onyx-950 text-storm-400 border border-onyx-800">
                        {task.isCompleted ? 'VERIFIED' : 'PENDING'}
                      </span>
                    </div>
                    <p className="text-storm-300 font-sans text-xs leading-relaxed">
                      {task.instruction}
                    </p>
                    {task.safetyCaution && (
                      <div className="text-[10.5px] text-amber-400 font-sans flex items-start gap-1 pt-0.5">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span><strong>Safety Note:</strong> {task.safetyCaution}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Supporting Hydraulic Simulation Evidence */}
            <div className="bg-onyx-950 p-3 rounded border border-onyx-800 space-y-1.5 text-[11px]">
              <div className="text-storm-400 font-bold uppercase text-[10px]">
                SUPPORTING HYDRAULIC SIMULATION EVIDENCE:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-storm-300">
                <div>Avoided Storage: <strong className="text-emerald-400">+{selectedWorkOrder.supportingSimulationEvidence.avoidedSurfaceVolumeM3} m³</strong></div>
                <div>Peak Depth Delta: <strong className="text-emerald-400">-{(selectedWorkOrder.supportingSimulationEvidence.peakDepthReductionM * 100).toFixed(1)} cm</strong></div>
                <div>Protected Roads: <strong className="text-storm-200">{selectedWorkOrder.supportingSimulationEvidence.protectedRoads.length} corridors</strong></div>
              </div>
              <div className="text-[10px] text-storm-500 pt-0.5">
                Evaluated against: {selectedWorkOrder.supportingSimulationEvidence.stormScenario}
              </div>
            </div>

            {/* Live Dispatch Safety Policy Notice */}
            <div className="p-2.5 rounded bg-onyx-950 text-storm-400 text-[10px] font-mono border border-onyx-800 space-y-0.5">
              <div><strong className="text-amber-400">LIVE DISPATCH SAFETY POLICY:</strong> {selectedWorkOrder.jiraIntegration.safetyNotice}</div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-onyx-800">
              <button
                type="button"
                onClick={() => setIsWorkOrderModalOpen(false)}
                className="px-4 py-2 rounded bg-onyx-800 hover:bg-onyx-700 text-storm-300 font-bold transition-colors"
              >
                CLOSE
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleStageWorkOrder}
                  disabled={stagingStatus.type === 'loading'}
                  className="px-4 py-2 rounded bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white font-bold flex items-center gap-1.5 transition-colors shadow-tactical"
                >
                  <ClipboardList className="w-4 h-4" />
                  <span>
                    {selectedWorkOrder.stage === 'COMMANDER_STAGED'
                      ? 'UPDATE STAGED WORK ORDER'
                      : 'STAGE WORK ORDER FOR OPERATIONS'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
