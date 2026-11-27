import api, { route } from '@forge/api';
import { getDecision } from './decisionStorage.js';

function hasForgeRuntime() {
  return typeof globalThis !== 'undefined' && (typeof globalThis.__forge_fetch__ === 'function' || typeof globalThis.__forge_local_fetch__ === 'function');
}

export function buildAuditStorageHtml(decision) {
  const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<h1>DELTA Decision Audit ${esc(decision.decisionId)}</h1><p>Project: ${esc(decision.projectKey || '')}</p><p>Status: ${esc(decision.status)}</p><p>Plan: ${esc(decision.chosenPlan?.name)}</p><p>Approver: ${esc(decision.humanApprover?.displayName)} (${esc(decision.humanApprover?.role)})</p><p>Scenario hash: ${esc(decision.scenarioHash)}</p><p>Rationale: ${esc(decision.engineeringRationale)}</p>`;
}

async function listSpaces(options) {
  const client = options.customConfluenceClient;
  if (typeof client?.listSpaces === 'function') return await client.listSpaces();
  if (typeof client?.requestConfluence === 'function') {
    const data = await client.requestConfluence('/wiki/api/v2/spaces?limit=5', { method: 'GET' });
    return data?.results || data?.values || [];
  }
  if (hasForgeRuntime()) {
    const resp = await api.asApp().requestConfluence(route`/wiki/api/v2/spaces?limit=5`);
    if (!resp.ok) throw new Error(`Confluence space discovery failed with HTTP ${resp.status}: ${await resp.text()}`);
    const data = await resp.json();
    return data?.results || data?.values || [];
  }
  return null;
}

async function createPage(body, options) {
  const client = options.customConfluenceClient;
  if (typeof client?.requestConfluence === 'function') return await client.requestConfluence('/wiki/rest/api/content', { method: 'POST', body });
  if (typeof client?.createPage === 'function') return await client.createPage(body);
  if (hasForgeRuntime()) {
    const resp = await api.asApp().requestConfluence(route`/wiki/rest/api/content`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!resp.ok) { const e = new Error(`Confluence API failed with HTTP ${resp.status}: ${await resp.text()}`); e.code = 'CONFLUENCE_API_FAILURE'; throw e; }
    return await resp.json();
  }
  const e = new Error('Confluence audit export requires a Forge runtime with Confluence access. No page was created outside Forge.'); e.code = 'CONFLUENCE_UNAVAILABLE_OUTSIDE_FORGE'; throw e;
}

const spaceKeyOf = (s) => s?.key || s?.spaceKey || null;

/** Opt-in only: callers (UI checkbox, OFF by default) must explicitly invoke this. Space key is optional: a missing/unknown key (e.g. DELTA on a fresh demo site) falls back to the first available space. */
export async function publishAuditToConfluence(payload = {}, options = {}) {
  const { decisionId } = payload;
  if (!decisionId) { const e = new Error('decisionId is required'); e.code = 'MISSING_DECISION_ID'; throw e; }
  const decisionResult = await getDecision(decisionId, options.storageOverride || null);
  if (!decisionResult.success || !decisionResult.data) { const e = new Error(`Decision Record '${decisionId}' was not found`); e.code = 'DECISION_NOT_FOUND'; throw e; }
  const decision = decisionResult.data;

  let resolvedSpaceKey = typeof payload.spaceKey === 'string' && payload.spaceKey.trim() ? payload.spaceKey.trim() : null;
  let spaceDiscovered = false;
  let spaces = null;
  try { spaces = await listSpaces(options); } catch { spaces = null; }
  if (Array.isArray(spaces) && spaces.length > 0) {
    if (!resolvedSpaceKey || !spaces.some(s => spaceKeyOf(s) === resolvedSpaceKey)) {
      resolvedSpaceKey = spaceKeyOf(spaces[0]);
      spaceDiscovered = true;
    }
  }
  if (!resolvedSpaceKey) {
    const e = new Error('No Confluence space available for audit export: provide a space key in the approval form, or create a Confluence space on this site first.'); e.code = 'CONFLUENCE_NO_SPACE_AVAILABLE'; throw e;
  }

  const makeBody = (key) => ({ type: 'page', title: `DELTA Decision Audit ${decision.decisionId}`, space: { key }, body: { storage: { value: buildAuditStorageHtml(decision), representation: 'storage' } } });
  let result;
  try {
    result = await createPage(makeBody(resolvedSpaceKey), options);
  } catch (err) {
    // Provided/default key may not exist on this site (e.g. DELTA): discover and retry once.
    if (!spaceDiscovered && /404|space/i.test(err.message || '')) {
      let discovered = null;
      try { discovered = await listSpaces(options); } catch { discovered = null; }
      const fallbackKey = Array.isArray(discovered) && discovered.length ? spaceKeyOf(discovered[0]) : null;
      if (!fallbackKey || fallbackKey === resolvedSpaceKey) throw err;
      result = await createPage(makeBody(fallbackKey), options);
      resolvedSpaceKey = fallbackKey; spaceDiscovered = true;
    } else throw err;
  }
  if (!result?.id) { const e = new Error('Confluence did not return a created page id. Export cannot be confirmed.'); e.code = 'CONFLUENCE_API_FAILURE'; throw e; }
  return { success: true, pageId: result.id, pageUrl: result._links?.webui || null, links: result._links || null, decisionId, spaceKey: resolvedSpaceKey, spaceDiscovered };
}
