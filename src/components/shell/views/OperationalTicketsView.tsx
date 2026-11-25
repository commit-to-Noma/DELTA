import React, { useState, useEffect } from 'react';
import { 
  Ticket, 
  Clock, 
  ExternalLink, 
  MapPin, 
  User,
  Radio,
  CheckCircle2
} from 'lucide-react';

interface JsmTicket {
  id: string;
  key: string;
  summary: string;
  priority: 'P1_CRITICAL' | 'P2_HIGH' | 'P3_MEDIUM';
  status: 'DISPATCHED' | 'IN_PROGRESS' | 'COMPLETED';
  decisionRef: string;
  assignee: string;
  location: string;
  timeRemaining: string;
  isLiveDispatched?: boolean;
}

const DEFAULT_TICKETS: JsmTicket[] = [
  {
    id: 't-01',
    key: 'JSM-4902',
    summary: 'Emergency Culvert Clearance — North Canal Outfall 14 & Pump Deployment',
    priority: 'P1_CRITICAL',
    status: 'IN_PROGRESS',
    decisionRef: 'DEC-2026-081',
    assignee: 'Municipal Utility Crew #04 (Lead: T. Henderson)',
    location: '42.3601° N, 71.0589° W (North Basin Siphon)',
    timeRemaining: '24m SLA',
  },
  {
    id: 't-02',
    key: 'JSM-4889',
    summary: 'Pre-emptive Sluice Gate Aperture Expansion #02',
    priority: 'P2_HIGH',
    status: 'COMPLETED',
    decisionRef: 'DEC-2026-080',
    assignee: 'SCADA Automation Service (Automated Outfall)',
    location: '42.3550° N, 71.0620° W (Estuary Control)',
    timeRemaining: 'Resolved on SLA',
  },
];

export const OperationalTicketsView: React.FC = () => {
  const [tickets, setTickets] = useState<JsmTicket[]>(DEFAULT_TICKETS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('delta_operational_tickets');
      if (stored) {
        const parsed: JsmTicket[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Prepend newly dispatched tickets to the list
          const combined = [...parsed, ...DEFAULT_TICKETS.filter(dt => !parsed.some(pt => pt.key === dt.key))];
          setTickets(combined);
        }
      }
    } catch {
      // Fallback to defaults
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Notice */}
      <div className="bg-onyx-900 border-l-4 border-cyan-500 p-4 rounded-r border-y border-r border-onyx-800 flex items-start gap-3">
        <Ticket className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs font-mono text-storm-300 space-y-1">
          <div className="font-bold text-storm-100 uppercase tracking-wider">
            JIRA SERVICE MANAGEMENT OPERATIONAL QUEUE
          </div>
          <p className="text-storm-300 font-sans">
            Approved decisions become real work in Jira, not screenshots. Field crews receive geolocation coordinates, equipment requirements, and SLA countdowns directly inside Atlassian.
          </p>
        </div>
      </div>

      {/* Ticket List */}
      <div className="bg-onyx-900 rounded-lg border border-onyx-800 overflow-hidden shadow-tactical font-mono text-xs">
        <div className="p-4 bg-onyx-950 border-b border-onyx-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="font-bold text-storm-100 uppercase">
              ACTIVE FIELD DISPATCH QUEUE ({tickets.length} TICKETS)
            </span>
          </div>
          <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            LIVE JIRA SYNC ACTIVE
          </span>
        </div>

        <div className="divide-y divide-onyx-800">
          {tickets.map((t) => (
            <div 
              key={t.id} 
              className={`p-5 space-y-3 transition-colors ${
                t.isLiveDispatched 
                  ? 'bg-emerald-950/20 border-l-4 border-emerald-500' 
                  : 'hover:bg-onyx-850/50'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-cyan-400 font-bold text-sm flex items-center gap-1.5">
                    {t.key}
                    <ExternalLink className="w-3.5 h-3.5 text-storm-500" />
                  </span>
                  <span className="px-2 py-0.5 rounded bg-red-950/80 border border-red-800 text-red-400 text-[10px] font-bold">
                    {t.priority.replace(/_/g, ' ')}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    t.isLiveDispatched 
                      ? 'bg-emerald-950 border border-emerald-700 text-emerald-300' 
                      : 'bg-onyx-950 border border-onyx-800 text-storm-300'
                  }`}>
                    {t.status.replace(/_/g, ' ')}
                  </span>
                  {t.isLiveDispatched && (
                    <span className="px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 text-[9px] font-bold animate-pulse">
                      DISPATCHED JUST NOW
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-bold">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{t.timeRemaining}</span>
                </div>
              </div>

              <div className="font-sans text-sm text-storm-100 font-semibold">
                {t.summary}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-[11px] text-storm-300">
                <div className="bg-onyx-950 p-2.5 rounded border border-onyx-800 flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-storm-500 flex-shrink-0" />
                  <span className="truncate">{t.assignee}</span>
                </div>

                <div className="bg-onyx-950 p-2.5 rounded border border-onyx-800 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-safety-orange flex-shrink-0" />
                  <span className="truncate">{t.location}</span>
                </div>

                <div className="bg-onyx-950 p-2.5 rounded border border-onyx-800 flex items-center justify-between">
                  <span className="text-storm-500 uppercase text-[9px]">LINKED DECISION</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {t.decisionRef}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
