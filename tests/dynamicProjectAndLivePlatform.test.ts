import { describe, it, expect, beforeEach } from 'vitest';
import { verifyIncidentCommanderAuthorization } from '../src/resolvers/authPolicy.js';
import { recordDecision, __resetInMemoryStore } from '../src/resolvers/decisionStorage.js';
import { validateTransition } from '../src/resolvers/workflowValidator.js';
import { queryTeamworkGraph } from '../src/resolvers/teamworkGraph.js';
import { publishAuditToConfluence } from '../src/resolvers/confluenceAudit.js';

function roleClient(roles: Record<string, number>, actors: Record<number, any[]>, groups: string[] = []) {
  return {
    async requestJira(url: string) {
      if (url.endsWith('/role')) return Object.fromEntries(Object.entries(roles).map(([k, id]) => [k, `https://x/rest/api/3/project/DEMO/role/${id}`]));
      const m = url.match(/\/role\/(\d+)/);
      if (m) { const id = Number(m[1]); const name = Object.keys(roles).find(k => roles[k] === id); return { name, actors: actors[id] || [] }; }
      if (url.includes('/user/groups')) return groups.map(name => ({ name }));
      return {};
    }
  };
}
const userActor = (accountId: string) => ({ type: 'atlassian-user-role-actor', actorUser: { accountId } });

describe('Dynamic project binding, Admin fallback, TWG & Confluence', () => {
  beforeEach(() => __resetInMemoryStore());

  it('Admin fallback authorizes only when no Incident Commanders role exists', async () => {
    const client = roleClient({ Administrators: 2 }, { 2: [userActor('qm:alice')] });
    const res: any = await verifyIncidentCommanderAuthorization({ accountId: 'qm:alice', projectKey: 'DEMO', customJiraClient: client });
    expect(res.isAuthorized).toBe(true); expect(res.fallback).toBe(true); expect(res.role).toBe('Administrators');
  });

  it('Admin does NOT substitute when Incident Commanders role exists', async () => {
    const client = roleClient({ 'Incident Commanders': 1, Administrators: 2 }, { 1: [userActor('qm:boss')], 2: [userActor('qm:alice')] });
    const res: any = await verifyIncidentCommanderAuthorization({ accountId: 'qm:alice', projectKey: 'DEMO', customJiraClient: client });
    expect(res.isAuthorized).toBe(false);
  });

  it('Verified group membership authorizes Incident Commanders', async () => {
    const client = roleClient({ 'Incident Commanders': 1 }, { 1: [{ type: 'atlassian-group-role-actor', actorGroup: { name: 'commanders' } }] }, ['commanders']);
    const res: any = await verifyIncidentCommanderAuthorization({ accountId: 'qm:alice', projectKey: 'DEMO', customJiraClient: client });
    expect(res.isAuthorized).toBe(true); expect(res.authorizedVia).toBe('group');
  });

  it('recordDecision binds to trusted Forge project DEMO, not a hard-coded key', async () => {
    const res: any = await recordDecision({
      decisionId: 'DEC-DEMO-1', scenarioHash: 'hash-1', status: 'APPROVED', linkedIssueKey: 'DEMO-12',
      chosenPlan: { planId: 'plan-beta', name: 'Plan Beta' }, engineeringRationale: 'Approved based on deterministic solver output.',
      humanApprover: { accountId: 'qm:commander-demo', displayName: 'Cmdr Demo' }
    }, null, { accountId: 'qm:commander-demo', context: { extension: { project: { key: 'DEMO', id: '10099' } } } });
    expect(res.success).toBe(true); expect(res.data.projectKey).toBe('DEMO'); expect(res.data.projectId).toBe('10099');
  });

  it('workflow validator blocks a decision bound to a different project', async () => {
    const storage = {
      async get(k: string) {
        if (k === 'issue-decision:DEMO-55') return 'DEC-X';
        if (k === 'decision:DEC-X') return { decisionId: 'DEC-X', status: 'APPROVED', projectKey: 'EMERG', humanApprover: { displayName: 'Cmdr', role: 'Incident Commander' } };
        return undefined;
      },
      async set() {}, async delete() {}
    };
    const res: any = await validateTransition({ issue: { key: 'DEMO-55' }, transition: { to: 'Dispatched' } }, storage);
    expect(res.result).toBe(false); expect(res.errorMessage).toContain('does not match');
  });

  it('queryTeamworkGraph returns live Jira nodes alongside spatial nodes, no fabricated mock IDs', async () => {
    const customJiraClient = { async requestJira() { return { issues: [{ key: 'DEMO-9', fields: { summary: 'Dispatch culvert crew', status: { name: 'To Do' }, labels: ['delta-dispatch'] } }] }; } };
    const res: any = await queryTeamworkGraph(null, { projectKey: 'DEMO', customJiraClient });
    expect(res.success).toBe(true);
    expect(res.nodes.some((n: any) => n.id === 'ISSUE-DEMO-9' && n.type === 'DISPATCH_WORK_ORDER')).toBe(true);
    expect(JSON.stringify(res)).not.toContain('EMERG-101'); expect(JSON.stringify(res)).not.toContain('4903');
    expect(res.nodes.some((n: any) => n.id === 'FACILITY-BWH')).toBe(true);
  });

  it('Confluence audit export is explicit and fails closed outside Forge', async () => {
    await recordDecision({
      decisionId: 'DEC-CONF-1', scenarioHash: 'hash-2', status: 'APPROVED', linkedIssueKey: 'DEMO-20',
      chosenPlan: { planId: 'plan-beta', name: 'Plan Beta' }, engineeringRationale: 'Approved based on deterministic solver output.', humanApprover: { accountId: 'qm:commander-demo', displayName: 'Cmdr Demo' }
    }, null, { accountId: 'qm:commander-demo' });
    const ok: any = await publishAuditToConfluence({ decisionId: 'DEC-CONF-1', spaceKey: 'OPS' }, { customConfluenceClient: { async createPage() { return { id: '123', _links: { webui: '/wiki/pages/123' } }; } } });
    expect(ok.success).toBe(true); expect(ok.pageId).toBe('123');
    await expect(publishAuditToConfluence({ decisionId: 'DEC-CONF-1', spaceKey: 'OPS' }, {})).rejects.toThrow(/requires a Forge runtime/);
  });
});
