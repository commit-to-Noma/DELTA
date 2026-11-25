import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  RefreshCw, 
  ExternalLink, 
  Link as LinkIcon, 
  CheckCircle2, 
  Waves, 
  FileText,
  Info
} from 'lucide-react';
import { invokeSafe, getContextSafe } from '../../services/forgeBridge';

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
  const [issueKey, setIssueKey] = useState<string>(initialIssueKey || 'EMERG-101');
  const [linkedDecision, setLinkedDecision] = useState<LinkedDecision | null>(null);
  const [availableDecisions, setAvailableDecisions] = useState<LinkedDecision[]>([]);
  const [selectedDecisionId, setSelectedDecisionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLinking, setIsLinking] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  // 2. Fetch linked decision for this issue
  const fetchLinkedDecision = async (targetKey: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res: any = await invokeSafe('getDecisionForIssue', { issueKey: targetKey });
      if (res && res.success && res.data) {
        setLinkedDecision(res.data);
      } else {
        setLinkedDecision(null);
        // If no decision linked, fetch available approved decisions for linking
        fetchAvailableDecisions();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to retrieve linked decision record.');
      setLinkedDecision(null);
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

      {isLoading ? (
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
              </p>
            </div>
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
            <div className="text-[11px] text-storm-400 font-sans border-t border-onyx-800 pt-2">
              No approved decision records found in Forge KVS. Open the <strong>DELTA Engine</strong> in the project sidebar to run a simulation and authorize an intervention.
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
