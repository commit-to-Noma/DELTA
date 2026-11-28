import api, { route } from '@forge/api';
import { getStorageClient } from './decisionStorage.js';
{}

const FLOOD_TERMS = ['flood', 'drainage', 'culvert', 'stormwater', 'pump', 'sewer surcharge', 'muddy river', 'brookline'];
export function isFloodIncidentText(text = '') { const t = String(text).toLowerCase(); return FLOOD_TERMS.some(term => t.includes(term)); }
export function buildProactiveComment(status) {
  const d = status?.data;
  const lines = d ? `Latest DELTA screening run: ${d.stormLabel || d.stormId || 'stored run'}; storage ${Math.round(d.currentStorageM3 || 0).toLocaleString()} m³; peak depth ${d.maxWaterDepthM ?? '—'} m; disruptions: ${(d.activeDisruptionIds || []).join(', ') || 'none recorded'}.` : 'No stored DELTA simulation run yet — open DELTA Engine and run the Golden Journey simulation for computed metrics.';
  return { type: 'doc', version: 1, content: [{ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'DELTA proactive flood-risk summary' }] }, { type: 'paragraph', content: [{ type: 'text', text: lines }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Screening-model output only; a human Incident Commander must approve any decision. Open the DELTA Engine project page for the full map, interventions, and decision workflow.' }] }] };
}
function hasForgeRuntime() { return typeof globalThis !== 'undefined' && (typeof globalThis.__forge_fetch__ === 'function' || typeof globalThis.__forge_local_fetch__ === 'function'); }

export async function handleIssueCreatedTrigger(event, options = {}) {
  const issue = event?.issue || event?.payload?.issue || {};
  const issueKey = issue.key || event?.issueKey;
  const summary = issue.fields?.summary || issue.summary || '';
  const descriptionText = typeof issue.fields?.description === 'string' ? issue.fields.description : '';
  if (!issueKey) return { success: false, status: 'NO_ISSUE' };
  if (!isFloodIncidentText(`${summary} ${descriptionText}`)) return { success: true, status: 'IGNORED_NOT_FLOOD', issueKey };
  try { const { getGovernanceSettings } = await import('./governanceSettings.js'); const s = await getGovernanceSettings(options.storageOverride || null); if (s?.data?.proactiveTriggerEnabled === false) return { success: true, status: 'DISABLED_BY_SETTINGS', issueKey }; } catch { /* default enabled */ }
  const client = getStorageClient(options.storageOverride || null);
  const dedupKey = `proactive-trigger:${issueKey}`;
  if (await client.get(dedupKey)) return { success: true, status: 'ALREADY_COMMENTED', issueKey };
  let status = options.simulationStatus;
  if (!status) { try { const mod = await import('./index.js'); status = await mod.getSimulationStatus(options.storageOverride || null); } catch { status = { status: 'NO_RUN' }; } }
  const adf = buildProactiveComment(status);
  if (options.customJiraClient?.requestJira) {
    await options.customJiraClient.requestJira(`/rest/api/3/issue/${issueKey}/comment`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ body: adf }) });
  } else if (hasForgeRuntime()) {
    const resp = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/comment`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ body: adf }) });
    if (!resp.ok) return { success: false, status: `COMMENT_FAILED_${resp.status}`, issueKey };
  } else return { success: false, status: 'OFFLINE_NO_FORGE_RUNTIME', issueKey };
  await client.set(dedupKey, { issueKey, commentedAt: new Date().toISOString(), simulationStatus: status?.status || null });
  console.info('[DELTA] proactiveTrigger', { issueKey, status: 'COMMENTED' });
  return { success: true, status: 'COMMENTED', issueKey };
}
export async function proactiveTriggerHandler(event, context) { try { return await handleIssueCreatedTrigger(event || {}); } catch (e) { console.error('[DELTA] proactiveTrigger failed', e?.message); return { success: false, status: 'ERROR', message: e?.message }; } }
export const handler = proactiveTriggerHandler;
