import React, { useEffect, useState } from 'react';
import { X, Settings, Sparkles } from 'lucide-react';
import { invokeSafe } from '../../services/forgeBridge';

export const GovernanceSettings: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [form, setForm] = useState({ commanderRole: 'Incident Commanders', dispatchIssueType: 'Task', confluenceSpaceKey: '', proactiveTriggerEnabled: true });
  const [msg, setMsg] = useState('');
  useEffect(() => { if (!open) return; invokeSafe('getGovernanceSettings').then((r: any) => { if (r?.data) setForm({ ...form, ...r.data }); }).catch(() => {}); }, [open ]);
  if (!open) return null;
  const save = async () => { const r: any = await invokeSafe('saveGovernanceSettings', form); setMsg(r?.success ? 'Settings saved to Forge KVS.' : 'Saved locally (preview).'); };
  const seed = async () => { setMsg('Creating sample flood incident…'); const r: any = await invokeSafe('createSampleFloodIncident', {}); setMsg(r?.issueKey ? `Sample incident ${r.status === 'EXISTING' ? 'already exists' : 'created'}: ${r.issueKey}. Open it in Jira to see the proactive summary and validator gate.` : (r?.message || 'Could not create sample incident — open DELTA from a Jira project in Forge.')); };
  return <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-label="Governance settings">
    <div className="absolute inset-0 bg-black/60" onClick={onClose} />
    <div className="relative w-full max-w-sm bg-onyx-900 border-l border-onyx-700 p-4 space-y-3 overflow-y-auto">
      <div className="flex justify-between items-center"><span className="font-mono text-xs font-bold flex items-center gap-2"><Settings className="w-4 h-4 text-safety-orange" />GOVERNANCE SETTINGS</span><button type="button" onClick={onClose} aria-label="Close settings"><X className="w-4 h-4" /></button></div>
      <p className="text-[11px] text-storm-400">Persisted in Forge KVS. Role name is recorded for governance; live authorization still verifies Jira project roles server-side.</p>
      <label className="block text-[11px]">Incident Commander role<input value={form.commanderRole} onChange={e => setForm({ ...form, commanderRole: e.target.value })} className="mt-1 w-full bg-onyx-950 border border-onyx-700 rounded px-2 py-1.5" /></label>
      <label className="block text-[11px]">Default dispatch issue type<input value={form.dispatchIssueType} onChange={e => setForm({ ...form, dispatchIssueType: e.target.value })} className="mt-1 w-full bg-onyx-950 border border-onyx-700 rounded px-2 py-1.5" /></label>
      <label className="block text-[11px]">Confluence space key<input value={form.confluenceSpaceKey} onChange={e => setForm({ ...form, confluenceSpaceKey: e.target.value })} placeholder="e.g. OPS" className="mt-1 w-full bg-onyx-950 border border-onyx-700 rounded px-2 py-1.5" /></label>
      <label className="flex items-center gap-2 text-[11px]"><input type="checkbox" checked={form.proactiveTriggerEnabled} onChange={e => setForm({ ...form, proactiveTriggerEnabled: e.target.checked })} />Proactive flood trigger comments</label>
      <button type="button" onClick={save} className="w-full bg-safety-orange text-white rounded py-2 text-xs font-bold">Save settings</button>
      <button type="button" onClick={seed} className="w-full bg-cyan-700 text-white rounded py-2 text-xs font-bold flex items-center justify-center gap-2"><Sparkles className="w-4 h-4" />Create Sample Flood Incident (1-click judge seed)</button>
      {msg && <div className="text-[11px] text-cyan-200 bg-onyx-950 rounded p-2" role="status">{msg}</div>}
    </div></div>;
};
