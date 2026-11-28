import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { AUTHORITATIVE_STRESS_PROFILES, plainStormHint, plainStormLabel } from '../src/simulation/interventionEngine';
import { AUTHORITATIVE_DISRUPTIONS } from '../src/simulation/disruptionEngine';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');

describe('Phase 0 UX quick wins', () => {
  it('plain storm labels cover all profiles with impact hints', () => {
    expect(plainStormLabel(AUTHORITATIVE_STRESS_PROFILES['synthetic-low-intensity'])).toBe('Light · 15 mm/h');
    expect(plainStormLabel(AUTHORITATIVE_STRESS_PROFILES['synthetic-moderate-stress'])).toBe('Moderate · 35 mm/h');
    expect(plainStormLabel(AUTHORITATIVE_STRESS_PROFILES['synthetic-high-intensity'])).toBe('Severe · 75 mm/h');
    expect(plainStormLabel(AUTHORITATIVE_STRESS_PROFILES['reference-noaa-50yr'])).toBe('50-Year Storm · 104 mm');
    for (const p of Object.values(AUTHORITATIVE_STRESS_PROFILES)) expect(plainStormHint(p).length).toBeGreaterThan(10);
  });

  it('every disruption has a plain-English consequence', () => {
    for (const d of AUTHORITATIVE_DISRUPTIONS) expect(d.plainConsequence && d.plainConsequence.length > 10).toBe(true);
    expect(AUTHORITATIVE_DISRUPTIONS[0].plainConsequence).toContain('Brigham');
  });

  it('nav is deduped, specs drawer and sandbox bounding are present', () => {
    expect(read('src/components/shell/AppShell.tsx')).not.toContain('Compact Stage Progression Rail');
    expect(read('src/components/shell/views/OverviewDistrictView.tsx')).toContain('DataModelSpecsDrawer');
    expect(read('src/components/common/DataModelSpecsDrawer.tsx')).toContain('Data &amp; Model Specs');
    const flood = read('src/components/shell/views/FloodSimulationView.tsx');
    expect(flood).toContain('latest ${Math.min(3, customActions.length)}');
    expect(flood).toContain('Clear all');
    expect(flood.indexOf('No sandbox result yet')).toBeLessThan(flood.indexOf('customActions.length > 0'));
  });

  it('manifest declares Rovo conversation starters and every stage has a What-to-do subtitle', () => {
    expect(read('manifest.yml')).toContain('conversationStarters:');
    for (const f of ['OverviewDistrictView', 'FloodSimulationView', 'InterventionsView', 'DecisionBriefingView', 'OperationalTicketsView']) {
      expect(read(`src/components/shell/views/${f}.tsx`)).toContain('StageIntro');
    }
  });
});
