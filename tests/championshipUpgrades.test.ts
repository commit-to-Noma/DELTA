import { describe, it, expect } from 'vitest';
// @ts-ignore JS resolvers
import { validateCustomAction, applyCustomActions } from '../src/simulation/customSandbox';
// @ts-ignore
import { isFloodIncidentText, buildProactiveComment, handleIssueCreatedTrigger } from '../src/resolvers/proactiveTrigger.js';
// @ts-ignore
import { validateGovernanceSettings, getGovernanceSettings, saveGovernanceSettings, createSampleFloodIncident } from '../src/resolvers/governanceSettings.js';
// @ts-ignore
import { fetchRelatedContext, fetchTeamworkGraphContext } from '../src/resolvers/teamworkGraph.js';
// @ts-ignore
import { __resetInMemoryStore } from '../src/resolvers/decisionStorage.js';
import { createHydraulicConfigFromCatchmentTestHelper } from './helpers/customConfigHelper';
// @ts-ignore
import { executeCustomSandboxAsync } from '../src/simulation/customSandbox';
import { loadBostonCatchment } from '../src/data/catchmentLoader';

describe('Upgrade 1: custom sandbox validation', () => {
  it('rejects out-of-grid and clamps strength', () => {
    expect(() => validateCustomAction({ type: 'PUMP', row: 99, col: 0, strength: 2 })).toThrow();
    expect(validateCustomAction({ type: 'PUMP', row: 1, col: 2, strength: 99 }).strength).toBe(4);
    expect(validateCustomAction({ type: 'BARRIER', row: 1, col: 2, strength: 0.5 }).type).toBe('BARRIER');
  });
  it('pump adds a sink and barrier raises elevation', () => {
    const base = createHydraulicConfigFromCatchmentTestHelper();
    const out = applyCustomActions(base as any, [validateCustomAction({ type: 'PUMP', row: 2, col: 3, strength: 2 }), validateCustomAction({ type: 'BARRIER', row: 2, col: 3, strength: 0.5 })]);
    expect(out.drainageInlets?.some(i => i.inletId?.startsWith('SANDBOX-PUMP'))).toBe(true);
    expect(out.elevation[2 * 64 + 3]).toBeGreaterThan(base.elevation[2 * 64 + 3]);
  });
  it('runs the real solver for a short custom pump scenario', async () => {
    const profile: any = { id: 'sandbox-test-1h', durationSeconds: 3600, durationHours: 1, totalRainfallMm: 50, hyetographHours: [{ hourIndex: 0, rateMmPerHour: 50 }] };
    const r = await executeCustomSandboxAsync(loadBostonCatchment(), profile, [], [{ id: 'custom-pump-30-30', row: 30, col: 30, type: 'PUMP', strength: 2 }], 1);
    expect(r.custom.waterDepth.length).toBe(4096);
    expect(Number.isFinite(r.delta.avoidedVolumeM3)).toBe(true);
    expect(r.summary).toContain('custom sandbox');
  }, 120000);
});

describe('Upgrade 2: proactive trigger', () => {
  it('detects flood terms only', () => { expect(isFloodIncidentText('Culvert blocked, flooding')).toBe(true); expect(isFloodIncidentText('Printer broken')).toBe(false); });
  it('comment is honest when NO_RUN', () => { const adf = buildProactiveComment({ status: 'NO_RUN' }); expect(JSON.stringify(adf)).toContain('No stored DELTA simulation run'); });
  it('posts once and dedupes, ignores non-flood', async () => {
    __resetInMemoryStore();
    let calls = 0; const client = { requestJira: async () => { calls++; return {}; } };
    const ev = { issue: { key: 'PLAT-42', fields: { summary: 'Flood at culvert' } } };
    expect((await handleIssueCreatedTrigger(ev, { customJiraClient: client, simulationStatus: { status: 'NO_RUN' } })).status).toBe('COMMENTED');
    expect((await handleIssueCreatedTrigger(ev, { customJiraClient: client, simulationStatus: { status: 'NO_RUN' } })).status).toBe('ALREADY_COMMENTED');
    expect(calls).toBe(1);
    expect((await handleIssueCreatedTrigger({ issue: { key: 'PLAT-43', fields: { summary: 'New laptop' } } }, { customJiraClient: client })).status).toBe('IGNORED_NOT_FLOOD');
  });
});

describe('Upgrade 4: governance settings + seed', () => {
  it('validates and persists settings', async () => {
    __resetInMemoryStore();
    const s = validateGovernanceSettings({ commanderRole: ' Incident Commanders ', confluenceSpaceKey: 'ops space', proactiveTriggerEnabled: false });
    expect(s.confluenceSpaceKey).toBe('OPSSPACE'); expect(s.proactiveTriggerEnabled).toBe(false);
    await saveGovernanceSettings(s); expect((await getGovernanceSettings()).data.confluenceSpaceKey).toBe('OPSSPACE');
  });
  it('seed searches before creating and reuses existing', async () => {
    __resetInMemoryStore();
    let created = 0;
    const client = { requestJira: async (url: string) => { if (url.includes('/search/')) return { issues: created ? [{ key: 'PLAT-9' }] : [] }; created++; return { key: 'PLAT-9' }; } };
    const ctx = { extension: { project: { key: 'PLAT' } } };
    expect((await createSampleFloodIncident({}, { customJiraClient: client, context: ctx })).status).toBe('CREATED');
    expect((await createSampleFloodIncident({}, { customJiraClient: client, context: ctx })).status).toBe('EXISTING');
    expect(created).toBe(1);
  });
});

describe('Upgrade 3: related context is honest offline', () => {
  it('returns UNAVAILABLE, not fabricated nodes, without clients/runtime', async () => {
    const twg = await fetchTeamworkGraphContext({}); expect(twg.liveStatus).toBe('TWG_UNAVAILABLE'); expect(twg.nodes).toEqual([]);
    const rel = await fetchRelatedContext('PLAT', {}); expect(rel.liveStatus).toContain('UNAVAILABLE'); expect(Array.isArray(rel.nodes)).toBe(true);
  });
  it('surfaces injected Confluence runbooks', async () => {
    const rel = await fetchRelatedContext('PLAT', { customConfluenceClient: { search: async () => [{ id: '1', title: 'Flood runbook', url: 'https://example/wiki/1' }] } });
    expect(rel.nodes.some((n: any) => n.type === 'RUNBOOK')).toBe(true);
  });
});
