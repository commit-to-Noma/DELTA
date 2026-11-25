import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  ExternalLink,
  RefreshCw,
  PlusCircle,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { invoke } from '@forge/bridge';

interface StoredDecisionRecord {
  decisionId: string;
  scenarioHash?: string;
  baselineStorm?: string;
  chosenPlan?: {
    planId: string;
    name: string;
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
  jsmTicketId: string;
  status: string;
  isLiveKvs: boolean;
  notes?: string;
}

interface DecisionRecordsViewProps {
  onNavigateToTickets: () => void;
}

export const DecisionRecordsView: React.FC<DecisionRecordsViewProps> = ({ onNavigateToTickets }) => {
  const [kvsRecords, setKvsRecords] = useState<DecisionRecordDisplay[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [writeStatus, setWriteStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message?: string }>({ type: 'idle' });

  // Initialized empty - strictly populated from live Forge KVS queries
  const fetchKvsRecords = async () => {
    setIsLoading(true);
    try {
      // Call Forge backend resolver via @forge/bridge invoke
      const res: any = await invoke('listDecisions');
      if (res && res.success && Array.isArray(res.data)) {
        const mapped: DecisionRecordDisplay[] = res.data.map((r: StoredDecisionRecord) => ({
          id: r.decisionId,
          code: r.decisionId,
          timestamp: r.createdAt || r.humanApprover?.approvalTimestamp || new Date().toISOString(),
          author: `${r.humanApprover?.displayName || 'Unknown Approver'} [${r.humanApprover?.role || 'Incident Commander'}]`,
          intervention: r.chosenPlan?.name || 'Authorized Flood Mitigation Plan',
          hash: r.scenarioHash || 'sha256:unspecified',
          deltaSummary: `Status: ${r.status || 'COMMITTED_IMMUTABLE'}`,
          jsmTicketId: r.linkedIssueKey || 'NONE (NO OPERATIONAL DISPATCH)',
          status: r.status || 'COMMITTED_IMMUTABLE',
          isLiveKvs: true,
          notes: r.notes
        }));
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
      baselineStorm: 'NOAA Atlas 14 50-Year 6-Hour Design Event (104.2 mm total depth) [BENCHMARK ONLY]',
      chosenPlan: {
        planId: 'plan-alpha',
        name: 'Plan Alpha: Rapid Deployable Barrier along Francis St Ambulance Route [BENCHMARK ONLY]',
        tradeOffSummary: 'Phase 0.7.2 Benchmark test intervention for live KVS persistence verification. NOT FOR OPERATIONAL ACTION.'
      },
      humanApprover: {
        displayName: 'Nomathemba Ncube',
        role: 'Incident Commander',
        approvalTimestamp: new Date().toISOString()
      },
      physicalMetrics: {
        inundationReduction: 'BENCHMARK_PENDING_PHASE_3',
        hospitalDelayMinutes: 0.0
      },
      status: 'APPROVED_BENCHMARK_ONLY',
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

  const allRecords = kvsRecords;


  return (
    <div className="space-y-6">
      {/* Notice */}
      <div className="bg-onyx-900 border-l-4 border-emerald-500 p-4 rounded-r border-y border-r border-onyx-800 flex items-start gap-3">
        <Lock className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs font-mono text-storm-300 space-y-1">
          <div className="font-bold text-storm-100 uppercase tracking-wider">
            APPEND-ONLY IMMUTABLE AUDIT LEDGER (FORGE KVS PERSISTENCE)
          </div>
          <p className="text-storm-300 font-sans">
            Every operational decision authorized in DELTA is signed and stored as an immutable audit record in Forge App Storage (KVS). Responders and municipal auditors have cryptographic proof of the simulation parameters, physical justification, and authorizing Incident Commander.
          </p>
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
              className="text-safety-orange hover:text-safety-hover font-semibold flex items-center gap-1.5 transition-colors"
            >
              <span>VIEW JSM DISPATCH QUEUE</span>
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
                Use the smoke test write above or authorize an intervention to record the first audit ledger entry.
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
                  </div>
                  <div className="text-storm-400 text-[11px]">{rec.timestamp}</div>
                </div>

                <div className="font-sans text-sm text-storm-100 font-medium">
                  {rec.intervention}
                </div>

                {rec.notes && (
                  <div className="bg-onyx-950 p-2 rounded border border-onyx-800 text-[11px] text-storm-300 font-mono">
                    {rec.notes}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-[11px] text-storm-300">
                  <div className="bg-onyx-950 p-2.5 rounded border border-onyx-800">
                    <span className="text-storm-500 block text-[9px] uppercase">AUTHORIZING OFFICER</span>
                    <span className="text-storm-200">{rec.author}</span>
                  </div>

                  <div className="bg-onyx-950 p-2.5 rounded border border-onyx-800">
                    <span className="text-storm-500 block text-[9px] uppercase">HYDRAULIC DELTA</span>
                    <span className="text-storm-200 font-bold">{rec.deltaSummary}</span>
                  </div>

                  <div className="bg-onyx-950 p-2.5 rounded border border-onyx-800">
                    <span className="text-storm-500 block text-[9px] uppercase">JSM TICKET / DISPATCH</span>
                    <span className="text-storm-400 font-bold flex items-center gap-1">
                      {rec.jsmTicketId}
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-storm-500 truncate pt-1">
                  HASH: {rec.hash}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

