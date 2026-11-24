import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  ExternalLink
} from 'lucide-react';

interface DecisionRecord {
  id: string;
  code: string;
  timestamp: string;
  author: string;
  intervention: string;
  hash: string;
  deltaSummary: string;
  jsmTicketId: string;
  status: 'COMMITTED_IMMUTABLE';
}

interface DecisionRecordsViewProps {
  onNavigateToTickets: () => void;
}

export const DecisionRecordsView: React.FC<DecisionRecordsViewProps> = ({ onNavigateToTickets }) => {
  const [records] = useState<DecisionRecord[]>([
    {
      id: 'rec-01',
      code: 'DEC-2026-081',
      timestamp: '2026-11-24T07:18:22Z',
      author: 'Commander J. Vance (Incident Lead)',
      intervention: 'Plan Beta (Clear North Canal Culvert & Deploy Pump #1)',
      hash: 'sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
      deltaSummary: '-46.2% Inundation • Hospital delay reduced to 2.1m',
      jsmTicketId: 'JSM-4902',
      status: 'COMMITTED_IMMUTABLE',
    },
    {
      id: 'rec-02',
      code: 'DEC-2026-080',
      timestamp: '2026-11-23T19:42:05Z',
      author: 'Deputy Lead M. Chen',
      intervention: 'Plan Delta (Pre-emptive Retention Gate Release)',
      hash: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      deltaSummary: '-18.0% Inundation • Basin level stabilized at 82%',
      jsmTicketId: 'JSM-4889',
      status: 'COMMITTED_IMMUTABLE',
    },
  ]);

  return (
    <div className="space-y-6">
      {/* Notice */}
      <div className="bg-onyx-900 border-l-4 border-emerald-500 p-4 rounded-r border-y border-r border-onyx-800 flex items-start gap-3">
        <Lock className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs font-mono text-storm-300 space-y-1">
          <div className="font-bold text-storm-100 uppercase tracking-wider">
            APPEND-ONLY IMMUTABLE AUDIT LEDGER
          </div>
          <p className="text-storm-300 font-sans">
            Every operational decision authorized in DELTA is signed and stored as an immutable audit record. In the event of post-incident municipal inquiries, responders have cryptographic proof of the simulation parameters, physical justification, and authorizing commander.
          </p>
        </div>
      </div>

      {/* Audit Record Table */}
      <div className="bg-onyx-900 rounded border border-onyx-800 overflow-hidden shadow-tactical">
        <div className="p-4 bg-onyx-950 border-b border-onyx-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-storm-100 uppercase">
              DECISION REGISTRY SCHEMA // {records.length} COMMITTED SPEC ENTRIES
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
          {records.map((rec) => (
            <div key={rec.id} className="p-5 font-mono text-xs space-y-3 hover:bg-onyx-850/50 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-safety-orange font-bold text-sm">{rec.code}</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-[10px]">
                    {rec.status}
                  </span>
                </div>
                <div className="text-storm-400 text-[11px]">{rec.timestamp}</div>
              </div>

              <div className="font-sans text-sm text-storm-100 font-medium">
                {rec.intervention}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-[11px] text-storm-300">
                <div className="bg-onyx-950 p-2.5 rounded border border-onyx-800">
                  <span className="text-storm-500 block text-[9px] uppercase">AUTHORIZING OFFICER</span>
                  <span className="text-storm-200">{rec.author}</span>
                </div>

                <div className="bg-onyx-950 p-2.5 rounded border border-onyx-800">
                  <span className="text-storm-500 block text-[9px] uppercase">HYDRAULIC DELTA</span>
                  <span className="text-emerald-400 font-bold">{rec.deltaSummary}</span>
                </div>

                <div className="bg-onyx-950 p-2.5 rounded border border-onyx-800">
                  <span className="text-storm-500 block text-[9px] uppercase">JSM TICKET</span>
                  <span className="text-safety-orange font-bold flex items-center gap-1">
                    {rec.jsmTicketId}
                  </span>
                </div>
              </div>

              <div className="text-[10px] text-storm-500 truncate pt-1">
                HASH: {rec.hash}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
