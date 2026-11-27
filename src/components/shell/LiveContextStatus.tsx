import React, { useEffect, useState } from 'react';
import { getContextSafe, invokeSafe } from '../../services/forgeBridge';

/** Compact live Atlassian context pill: active project, auth, and KVS sync status. */
export const LiveContextStatus: React.FC = () => {
  const [projectKey, setProjectKey] = useState<string | null>(null);
  const [authLabel, setAuthLabel] = useState('Preview');
  const [kvsLabel, setKvsLabel] = useState('KVS …');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const ctx = await getContextSafe();
        if (!alive) return;
        setProjectKey(ctx?.extension?.project?.key || ctx?.extension?.issue?.key?.split('-')[0] || null);
        setAuthLabel(ctx?.accountId ? 'Auth ✓' : 'Preview');
      } catch { /* standalone preview */ }
      try {
        const res: any = await invokeSafe('getSimulationStatus');
        if (!alive) return;
        setKvsLabel(res?.status === 'COMPLETED_RUN' ? 'KVS Synced' : 'KVS Ready');
      } catch { if (alive) setKvsLabel('KVS Local'); }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded bg-onyx-950 border border-onyx-800 text-[10px] font-mono text-storm-400" title="Live Atlassian context">
      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
      <span className="text-storm-200">{projectKey ? `Project ${projectKey}` : 'Project —'}</span>
      <span>·</span><span>{authLabel}</span>
      <span>·</span><span>{kvsLabel}</span>
    </div>
  );
};
