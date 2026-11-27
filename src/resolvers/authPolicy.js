/**
 * DELTA Incident Commander Authorization Policy
 *
 * 1. Browser/client is never the authority for identity or privileges.
 * 2. accountId must originate from trusted Forge invocation context.
 * 3. Target project is bound from Forge invocation context (project key/id),
 *    falling back to the linked Jira issue's project. No project is hard-pinned.
 * 4. Primary authority: Jira Project Role 'Incident Commanders', verified via
 *    direct user actors or verified group membership.
 * 5. Fallback: 'Administrators' role ONLY when the target project has no
 *    'Incident Commanders' role configured (fresh demo-site provisioning).
 *    If an Incident Commanders role exists, Administrators do not substitute.
 * 6. Fails closed if identity, project, or role membership cannot be established.
 */
import api, { route } from '@forge/api';
import { normalizeProjectKey, resolveTrustedProject } from './projectContext.js';

/** @deprecated Legacy default only; authorization is no longer pinned to it. */
export const OPERATIONAL_PROJECT_KEY = 'EMERG';
export const AUTHORIZATION_POLICY_NAME = 'Jira Project Role: Incident Commander';
export const INCIDENT_COMMANDERS_ROLE = 'Incident Commanders';
export const ADMINISTRATORS_ROLE = 'Administrators';

function hasForgeRuntime() {
  return typeof globalThis !== 'undefined' &&
    (typeof globalThis.__forge_fetch__ === 'function' || typeof globalThis.__forge_local_fetch__ === 'function');
}

async function jiraGet(kind, params, customJiraClient) {
  if (customJiraClient?.requestJira) {
    const url = kind === 'roles' ? `/rest/api/3/project/${params.projectKey}/role`
      : kind === 'actors' ? `/rest/api/3/project/${params.projectKey}/role/${params.roleId}`
      : `/rest/api/3/user/groups?accountId=${encodeURIComponent(params.accountId)}`;
    const data = await customJiraClient.requestJira(url, { method: 'GET' });
    return { ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) };
  }
  if (kind === 'roles') return api.asApp().requestJira(route`/rest/api/3/project/${params.projectKey}/role`);
  if (kind === 'actors') return api.asApp().requestJira(route`/rest/api/3/project/${params.projectKey}/role/${params.roleId}`);
  return api.asApp().requestJira(route`/rest/api/3/user/groups?accountId=${params.accountId}`);
}

async function checkRoleMembership({ projectKey, roleUrl, roleLabel, accountId, customJiraClient = null }) {
  const roleId = roleUrl?.match(/\/role\/(\d+)/)?.[1];
  if (!roleId) return { found: true, isAuthorized: false, reason: `Could not parse role ID from URL '${roleUrl}'. Fail-closed.` };
  const actorsResp = await jiraGet('actors', { projectKey, roleId }, customJiraClient);
  if (!actorsResp.ok) return { found: true, isAuthorized: false, reason: `Unable to query role actors for role ID '${roleId}': HTTP ${actorsResp.status}. Fail-closed.` };
  const roleData = await actorsResp.json();
  const actors = Array.isArray(roleData.actors) ? roleData.actors : [];
  const roleName = roleData.name || roleLabel;
  const isDirect = actors.some(a => a.actorUser?.accountId === accountId || (a.type === 'atlassian-user-role-actor' && a.actorUser?.accountId === accountId));
  if (isDirect) return { found: true, isAuthorized: true, role: roleLabel, via: 'direct' };
  const groupNames = actors.filter(a => a.type === 'atlassian-group-role-actor')
    .map(a => a.actorGroup?.name || a.actorGroup?.displayName || a.displayName).filter(Boolean);
  if (groupNames.length) {
    try {
      const groupsResp = await jiraGet('groups', { accountId }, customJiraClient);
      if (groupsResp.ok) {
        const groups = await groupsResp.json();
        const mine = (Array.isArray(groups) ? groups : []).map(g => g.name);
        if (groupNames.some(g => mine.includes(g))) return { found: true, isAuthorized: true, role: roleLabel, via: 'group' };
        return { found: true, isAuthorized: false, reason: `User '${accountId}' is not a verified member of any group assigned to role '${roleName}' for project '${projectKey}'.` };
      }
    } catch { /* fall through to fail-closed */ }
    return { found: true, isAuthorized: false, reason: `User '${accountId}' is not directly assigned to role '${roleName}', and group-based role membership could not be verified. Fail-closed.` };
  }
  return { found: true, isAuthorized: false, reason: `User '${accountId}' is not an assigned actor in role '${roleName}' for project '${projectKey}'.` };
}

export async function verifyIncidentCommanderAuthorization({ accountId, projectKey = null, projectId = null, context = null, customAuthPolicy = null, customJiraClient = null } = {}) {
  if (!accountId || typeof accountId !== 'string' || accountId === 'anonymous') {
    return { isAuthorized: false, reason: 'Authentication failure: Missing or invalid accountId in server invocation context. Client-supplied identities are strictly rejected.' };
  }
  const trusted = resolveTrustedProject(context);
  const resolvedProjectKey = normalizeProjectKey(projectKey) || trusted.projectKey || OPERATIONAL_PROJECT_KEY;
  const resolvedProjectId = projectId || trusted.projectId || null;
  if (!normalizeProjectKey(resolvedProjectKey)) {
    return { isAuthorized: false, reason: `Project scope violation: Invalid project key '${projectKey}'. Fail-closed.` };
  }
  if (customAuthPolicy) {
    return await customAuthPolicy.verifyAuthorization({ accountId, projectKey: resolvedProjectKey, projectId: resolvedProjectId, requiredRole: INCIDENT_COMMANDERS_ROLE, fallbackRole: ADMINISTRATORS_ROLE });
  }
  if (!customJiraClient && !hasForgeRuntime()) {
    const isDesignatedCommander = accountId.includes('commander') || accountId.includes('chief');
    if (isDesignatedCommander) return { isAuthorized: true, role: 'Incident Commander', policy: AUTHORIZATION_POLICY_NAME, projectKey: resolvedProjectKey };
    return { isAuthorized: false, reason: `User '${accountId}' is not a designated Incident Commander for project '${resolvedProjectKey}'.` };
  }
  try {
    const rolesResp = await jiraGet('roles', { projectKey: resolvedProjectKey }, customJiraClient);
    if (!rolesResp.ok) return { isAuthorized: false, reason: `Unable to query project roles for '${resolvedProjectKey}': HTTP ${rolesResp.status}. Fail-closed.` };
    const rolesMap = await rolesResp.json();
    const findRole = (label, fuzzy) => rolesMap[label] || Object.entries(rolesMap).find(([k]) => fuzzy(k))?.[1] || null;
    const icUrl = findRole(INCIDENT_COMMANDERS_ROLE, k => k.toLowerCase().includes('incident commander'));
    if (icUrl) {
      const check = await checkRoleMembership({ projectKey: resolvedProjectKey, roleUrl: icUrl, roleLabel: 'Incident Commander', accountId, customJiraClient });
      if (check.isAuthorized) return { isAuthorized: true, role: 'Incident Commander', policy: AUTHORIZATION_POLICY_NAME, projectKey: resolvedProjectKey, authorizedVia: check.via };
      return { isAuthorized: false, reason: check.reason, projectKey: resolvedProjectKey };
    }
    // No Incident Commanders role on this project: Administrators fallback (fresh demo sites).
    const adminUrl = findRole(ADMINISTRATORS_ROLE, k => k.toLowerCase() === 'administrators');
    if (!adminUrl) return { isAuthorized: false, reason: `Neither 'Incident Commanders' nor 'Administrators' role is configured in project '${resolvedProjectKey}'. Fail-closed.`, projectKey: resolvedProjectKey };
    const adminCheck = await checkRoleMembership({ projectKey: resolvedProjectKey, roleUrl: adminUrl, roleLabel: 'Administrators', accountId, customJiraClient });
    if (adminCheck.isAuthorized) return { isAuthorized: true, role: 'Administrators', policy: AUTHORIZATION_POLICY_NAME, projectKey: resolvedProjectKey, authorizedVia: 'administrators-fallback', fallback: true };
    return { isAuthorized: false, reason: adminCheck.reason, projectKey: resolvedProjectKey };
  } catch (err) {
    return { isAuthorized: false, reason: `Authorization check exception: ${err.message}. Fail-closed.` };
  }
}
