import api, { route } from '@forge/api';
import { getStorageClient } from './decisionStorage.js';
import { resolveTrustedProject, projectKeyFromIssueKey } from './projectContext.js';

export const GOVERNANCE_SETTINGS_KEY = 'governance:settings';
export const DEFAULT_GOVERNANCE_SETTINGS = { commanderRole: 'Incident Commanders', dispatchIssueType: 'Task', confluenceSpaceKey: '', proactiveTriggerEnabled: true };
const clean = (v, max, fallback) => { const s = typeof v === 'string' ? v.trim().slice(0, max) : ''; return s || fallback; };
export function validateGovernanceSettings(input = {}) {
  return { commanderRole: clean(input.commanderRole, 80, DEFAULT_GOVERNANCE_SETTINGS.commanderRole), dispatchIssueType: clean(input.dispatchIssueType, 40, 'Task'), confluenceSpaceKey: clean(input.confluenceSpaceKey, 40, '').toUpperCase().replace(/[^A-Z0-9]/g, ''), proactiveTriggerEnabled: input.proactiveTriggerEnabled !== false };
}
export async function getGovernanceSettings(storageOverride = null) { const c = getStorageClient(storageOverride); const s = await c.get(GOVERNANCE_SETTINGS_KEY); return { success: true, data: { ...DEFAULT_GOVERNANCE_SETTINGS, ...(s || {}) } }; }
export async function saveGovernanceSettings(input = {}, storageOverride = null) { const data = validateGovernanceSettings(input); const c = getStorageClient(storageOverride); await c.set(GOVERNANCE_SETTINGS_KEY, { ...data, updatedAt: new Date().toISOString() }); return { success: true, data }; }
function hasForgeRuntime() { return typeof globalThis !== 'undefined' && (typeof globalThis.__forge_fetch__ === 'function' || typeof globalThis.__forge_local_fetch__ === 'function'); }
{}export async function createSampleFloodIncident(payload = {}, options = {}) {
  const trusted = resolveTrustedProject(options.context || null);
  const projectKey = trusted.projectKey || projectKeyFromIssueKey(payload.issueKey) || (typeof payload.projectKey === 'string' ? payload.projectKey.trim().toUpperCase() : null);
  if (!projectKey) return { success: false, status: 'NO_PROJECT', message: 'No trusted project could be resolved. Open DELTA from a Jira project and retry.' };
  const jql = `project = "${projectKey}" AND labels = "delta-sample" ORDER BY created DESC`;
  let existing = [];
  if (options.customJiraClient?.requestJira) { const r = await options.customJiraClient.requestJira('/rest/api/3/search/jql', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ jql, maxResults: 5, fields: ['summary'] }) }); existing = Array.isArray(r?.issues) ? r.issues : []; }
  else if (hasForgeRuntime()) { const resp = await api.asApp().requestJira(route`/rest/api/3/search/jql`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ jql, maxResults: 5, fields: ['summary'] }) }); if (resp.ok) existing = (await resp.json()).issues || []; }
  else return { success: false, status: 'OFFLINE_NO_FORGE_RUNTIME', message: 'Sample incident creation requires the Forge runtime.' };
  if (existing.length) return { success: true, status: 'EXISTING', issueKey: existing[0].key, projectKey };
  const settings = (await getGovernanceSettings(options.storageOverride || null)).data;
  const body = { fields: { project: { key: projectKey }, summary: '[DELTA Sample] Flood incident — Brookline culvert blockage', issuetype: { name: settings.dispatchIssueType || 'Task' }, labels: ['delta-sample', 'delta-flood'], description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sample flood incident created from DELTA Governance Settings for judge/demo validation. It should trigger the DELTA proactive summary and can be used for the workflow-validator gate test. Screening context only.' }] }] } } };
  let created;
  if (options.customJiraClient?.requestJira) created = await options.customJiraClient.requestJira('/rest/api/3/issue', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  else { const resp = await api.asApp().requestJira(route`/rest/api/3/issue`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!resp.ok) return { success: false, status: `CREATE_FAILED_${resp.status}`, projectKey }; created = await resp.json(); }
  console.info('[DELTA] createSampleFloodIncident', { projectKey, issueKey: created?.key || null });
  return { success: true, status: 'CREATED', issueKey: created?.key || null, projectKey };
}
