import api, { route } from '@forge/api';
import { getDecision } from './decisionStorage.js';

function hasForgeRuntime() {
  return typeof globalThis !== 'undefined' && (typeof globalThis.__forge_fetch__ === 'function' || typeof globalThis.__forge_local_fetch__ === 'function');
}

export function buildAuditStorageHtml(decision) {
  const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<h1>DELTA Decision Audit ${esc(decision.decisionId)}</h1><p>Project: ${esc(decision.projectKey || '')}</p><p>Status: ${esc(decision.status)}</p><p>Plan: ${esc(decision.chosenPlan?.name)}</p><p>Approver: ${esc(decision.humanApprover?.displayName)} (${esc(decision.humanApprover?.role)})</p><p>Scenario hash: ${esc(decision.scenarioHash)}</p><p>Rationale: ${esc(decision.engineeringRationale)}</p>`;
}

/** Opt-in only: callers (UI checkbox, OFF by default) must explicitly invoke this. */
export async function publishAuditToConfluence(payload = {}, options = {}) {
  const { decisionId, spaceKey } = payload;
  if (!decisionId) { const e = new Error('decisionId is required'); e.code = 'MISSING_DECISION_ID'; throw e; }
  if (!spaceKey || typeof spaceKey !== 'string') { const e = new Error('Confluence spaceKey is required for audit export'); e.code = 'MISSING_SPACE_KEY'; throw e; }
  const decisionResult = await getDecision(decisionId, options.storageOverride || null);
  if (!decisionResult.success || !decisionResult.data) { const e = new Error(`Decision Record '${decisionId}' was not found`); e.code = 'DECISION_NOT_FOUND'; throw e; }
  const decision = decisionResult.data;
  const body = { type: 'page', title: `DELTA Decision Audit ${decision.decisionId}`, space: { key: spaceKey }, body: { storage: { value: buildAuditStorageHtml(decision), representation: 'storage' } } };
  let result;
  if (typeof options.customConfluenceClient?.requestConfluence === 'function') {
    result = await options.customConfluenceClient.requestConfluence('/wiki/rest/api/content', { method: 'POST', body });
  } else if (typeof options.customConfluenceClient?.createPage === 'function') {
    result = await options.customConfluenceClient.createPage(body);
  } else if (hasForgeRuntime()) {
    const resp = await api.asApp().requestConfluence(route`/wiki/rest/api/content`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!resp.ok) { const e = new Error(`Confluence API failed with HTTP ${resp.status}: ${await resp.text()}`); e.code = 'CONFLUENCE_API_FAILURE'; throw e; }
    result = await resp.json();
  } else {
    const e = new Error('Confluence audit export requires a Forge runtime with Confluence access. No page was created outside Forge.'); e.code = 'CONFLUENCE_UNAVAILABLE_OUTSIDE_FORGE'; throw e;
  }
  if (!result?.id) { const e = new Error('Confluence did not return a created page id. Export cannot be confirmed.'); e.code = 'CONFLUENCE_API_FAILURE'; throw e; }
  return { success: true, pageId: result.id, pageUrl: result._links?.webui || null, links: result._links || null, decisionId, spaceKey };
}
