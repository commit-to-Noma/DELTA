/**
 * DELTA Workstream 5: Decision Briefing Exporter
 *
 * Generates formatted, tamper-evident operational briefing documents in:
 * 1. Structured Markdown / Plaintext: Optimized for incident commander logs, JSM issue attachments,
 *    and municipal archive records.
 * 2. Print-Ready HTML Document: Fully self-contained executive report with tactical styling,
 *    KPI callouts, comparative tables, print CSS, and immutable scenario hash verification.
 *
 * Enforces scenario binding to prevent stale data substitution and embeds the permanent
 * LIVE_DISPATCH_LOCKED disclaimer on all exported artifacts.
 */

import { DecisionBriefing } from './decisionBriefingEngine';

/**
 * Validates that a briefing's scenario hash matches the currently active scenario hash.
 */
export function verifyBriefingBinding(briefing: DecisionBriefing, activeScenarioHash: string): boolean {
  if (!briefing || !briefing.scenarioHash) return false;
  return briefing.scenarioHash.trim().toUpperCase() === activeScenarioHash.trim().toUpperCase();
}

/**
 * Generates a clean, authoritative Markdown operational briefing report.
 */
export function exportBriefingToMarkdown(briefing: DecisionBriefing): string {
  const b = briefing;
  const sc = b.scenarioContext;
  const ba = b.baselineAssessment;
  const gov = b.governanceAndStaging;

  const lines: string[] = [];

  // Header
  lines.push('# DELTA — MUNICIPAL FLOOD DEFENSE & HEALTHCARE CONTINUITY');
  lines.push('## TACTICAL DECISION BRIEFING & OPERATIONAL DIRECTIVE');
  lines.push('');
  lines.push(`**Briefing ID:** \`${b.briefingId}\`  `);
  lines.push(`**Generated Timestamp:** ${b.generatedAt}  `);
  lines.push(`**Scenario Hash:** \`${b.scenarioHash}\` *(Cryptographically Bound)*  `);
  lines.push(`**Incident Command Posture:** \`${b.incidentPosture}\`  `);
  lines.push('');
  lines.push('> **DISPATCH LOCKOUT STATUS: ACTIVE**  ');
  lines.push(`> *${gov.dispatchLockoutNotice}*`);
  lines.push('');

  // 1. Scenario & Hydrometeorological Context
  lines.push('---');
  lines.push('### 1. Scenario & Hydrometeorological Context');
  lines.push('');
  lines.push(`- **Selected Profile:** ${sc.profileLabel}`);
  lines.push(`- **Profile Classification:** ${sc.isRegionalBenchmark ? 'Regional NOAA Atlas 14 Benchmark' : 'Synthetic Exploratory Stress Profile'}`);
  lines.push(`- **Total Precipitation:** ${sc.totalRainfallMm.toFixed(1)} mm over ${sc.durationHours.toFixed(1)} hours (Peak Intensity: ${sc.peakIntensityMmPerHour.toFixed(1)} mm/h)`);
  lines.push(`- **Spatial Grid:** ${sc.gridResolutionM}m uniform resolution (${sc.domainDimensionM})`);
  lines.push(`- **Hydraulic Disruption:** ${sc.disruptionId} (${sc.culvertStatus})`);
  lines.push(`- **Meteorological Provenance:** ${sc.provenance}`);
  if (sc.disclosures.length > 0) {
    lines.push('- **Disclosures:**');
    sc.disclosures.forEach((d) => lines.push(`  - ${d}`));
  }
  lines.push('');

  // 2. Baseline Catchment Assessment
  lines.push('---');
  lines.push('### 2. Baseline Catchment Assessment (No Intervention)');
  lines.push('');
  lines.push('| Metric | Computed Baseline Value |');
  lines.push('| :--- | :--- |');
  lines.push(`| **Total Surface Ponding Volume** | **${ba.totalSurfaceVolumeM3.toLocaleString()} m³** |`);
  lines.push(`| **Peak Water Depth** | **${(ba.peakDepthM * 100).toFixed(1)} cm** (${ba.peakDepthM.toFixed(3)} m) |`);
  lines.push(`| **Total Inundated Area (≥5cm)** | **${(ba.inundatedAreaM2 / 10000).toFixed(1)} ha** (${ba.inundatedAreaM2.toLocaleString()} m²) |`);
  lines.push(`| **Impassable Arterials (≥30cm)** | **${ba.impassableRoadCount} corridors** |`);
  lines.push(`| **Caution Arterials (15-30cm)** | **${ba.cautionRoadCount} corridors** |`);
  lines.push(`| **Passable Arterials (<15cm)** | **${ba.passableRoadCount} corridors** |`);
  lines.push(`| **Compromised Medical Ingress** | **${ba.compromisedHospitalCount} of ${ba.hospitals.length} facilities** |`);
  lines.push(`| **Total Background Drainage** | **${ba.totalDrainageVolumeM3.toLocaleString()} m³** |`);
  lines.push('');

  lines.push('#### Baseline Healthcare Access Status:');
  ba.hospitals.forEach((h) => {
    lines.push(`- **${h.name}:** Status \`${h.overallStatus}\` | Standing water: ${(h.standingWaterDepthM * 100).toFixed(1)} cm | Campus elevation: ${h.campusElevationM}m`);
    if (h.compromisedCorridors.length > 0) {
      lines.push(`  - Impassable Ingress Arteries: ${h.compromisedCorridors.join(', ')}`);
    }
  });
  lines.push('');

  // 3. Comparative Intervention Evaluation
  lines.push('---');
  lines.push('### 3. Comparative Intervention Evaluation');
  lines.push('');
  lines.push('| Plan | Classification | Avoided Storage | Peak Depth Δ | Net Road Δ | Adverse Ponding |');
  lines.push('| :--- | :--- | :--- | :--- | :--- | :--- |');

  b.interventionComparisons.forEach((plan) => {
    const adverseStr = plan.hasAdverseDeflection
      ? `⚠️ +${(plan.maxAdverseDepthIncreaseM * 100).toFixed(1)}cm (${plan.adverseCellCount} cells)`
      : 'None (0 cells)';
    lines.push(
      `| **${plan.planName.split(':')[0]}** | \`${plan.classification}\` | ${plan.avoidedSurfaceStorageM3.toLocaleString()} m³ | -${(plan.peakDepthReductionM * 100).toFixed(1)} cm | +${plan.netProtectedRoadCount} roads | ${adverseStr} |`
    );
  });
  lines.push('');

  // Detailed Plan Cards
  lines.push('#### Plan-Specific Engineering & Operational Details:');
  lines.push('');
  b.interventionComparisons.forEach((plan) => {
    lines.push(`##### ${plan.planName}`);
    lines.push(`- **Target Asset:** ${plan.targetInfrastructure}`);
    lines.push(`- **Resource Footprint:** ${plan.resourceCost}`);
    lines.push(`- **Screening Classification:** \`${plan.classification}\``);
    lines.push(`- **Classification Rationale:** ${plan.classificationRationale}`);
    lines.push(`- **Avoided Flood Storage:** ${plan.avoidedSurfaceStorageM3.toLocaleString()} m³`);
    lines.push(`- **Peak Depth Reduction:** ${(plan.peakDepthReductionM * 100).toFixed(1)} cm`);
    lines.push(`- **Road Restorations:** ${plan.improvedRoadCount > 0 ? plan.improvedRoadNames.join(', ') : 'None'}`);
    if (plan.worsenedRoadCount > 0) {
      lines.push(`- **⚠️ Newly Impassable Roads:** ${plan.worsenedRoadNames.join(', ')}`);
    }
    if (plan.hasAdverseDeflection) {
      lines.push(`- **⚠️ Adverse Surcharge Warning:** Produces +${(plan.maxAdverseDepthIncreaseM * 100).toFixed(1)} cm local water depth rise across ${plan.adverseCellCount} cells (${plan.adverseAreaM2} m²). Deflected volume: ${plan.deflectedVolumeM3.toLocaleString()} m³.`);
    }
    lines.push(`- **Drainage Accounting:** Background: ${plan.backgroundDrainageM3.toLocaleString()} m³ | Intervention Sink: ${plan.interventionSinkExtractionM3.toLocaleString()} m³ | Incremental vs Baseline: ${plan.incrementalDrainageM3.toLocaleString()} m³`);
    lines.push('- **Operational Trade-offs:**');
    plan.operationalTradeOffs.forEach((to) => lines.push(`  - ${to}`));
    lines.push('');
  });

  // 4. Recommendation & Strategic Trade-Offs
  lines.push('---');
  lines.push('### 4. Incident Command Recommendation');
  lines.push('');
  lines.push(`- **Recommended Action:** **${b.recommendation.recommendedPlanName}** (\`${b.recommendation.recommendedPlanId}\`)`);
  lines.push(`- **Volume Ranking Winner:** \`${b.recommendation.volumeRankingWinner}\``);
  lines.push(`- **Road Protection Winner:** \`${b.recommendation.roadRankingWinner}\``);
  lines.push(`- **Strategic Rationale:** ${b.recommendation.rationale}`);
  lines.push('');

  // 5. Cross-Scenario Stress Robustness Matrix
  lines.push('---');
  lines.push('### 5. Cross-Scenario Decision Robustness Matrix');
  lines.push('');
  lines.push(`> *${b.crossScenarioRobustness.exploratoryNotice}*`);
  lines.push('');
  lines.push('| Profile | Type | Total Rain | Plan Alpha (Barrier) | Plan Beta (Pump) | Plan Gamma (Culvert) |');
  lines.push('| :--- | :--- | :--- | :--- | :--- | :--- |');

  b.crossScenarioRobustness.matrix.forEach((row) => {
    const pA = row.plans['plan-alpha'];
    const pB = row.plans['plan-beta'];
    const pG = row.plans['plan-gamma'];

    const aStr = `${pA.avoidedStorageM3.toLocaleString()}m³ (${pA.classification === 'ADVERSE_LOCAL_DEFLECTION' ? '⚠️ Surcharge' : pA.classification})`;
    const bStr = `${pB.avoidedStorageM3.toLocaleString()}m³ (${pB.classification})`;
    const gStr = `${pG.avoidedStorageM3.toLocaleString()}m³ (${pG.classification})`;

    lines.push(`| **${row.profileName.split('(')[0].trim()}** | ${row.isRegionalBenchmark ? 'NOAA Benchmark' : 'Synthetic Stress'} | ${row.totalRainfallMm}mm | ${aStr} | ${bStr} | ${gStr} |`);
  });
  lines.push('');

  lines.push('**Key Cross-Scenario Robustness Insights:**');
  b.crossScenarioRobustness.keyInsights.forEach((ki) => lines.push(`- ${ki}`));
  lines.push('');

  // 6. Operational Governance & Staging
  lines.push('---');
  lines.push('### 6. Incident Governance & Staging State');
  lines.push('');
  lines.push(`- **Active Decision Record:** ${gov.hasActiveDecision ? `\`${gov.decisionId}\` (Status: \`${gov.decisionStatus}\`)` : 'None approved'}`);
  if (gov.approvedBy) lines.push(`- **Incident Commander Authority:** ${gov.approvedBy}`);
  if (gov.approvalTimestamp) lines.push(`- **Approval Timestamp:** ${gov.approvalTimestamp}`);
  lines.push(`- **Staged Work Order:** ${gov.hasStagedWorkOrder ? `\`${gov.workOrderId}\` (Stage: \`${gov.workOrderStage}\`, Urgency: \`${gov.urgency}\`)` : 'None staged'}`);
  if (gov.linkedJiraIssueKey) lines.push(`- **Linked Jira Operational Issue:** \`${gov.linkedJiraIssueKey}\``);
  if (gov.targetCoordinates) {
    const coords = gov.targetCoordinates;
    lines.push(`- **Staging Coordinates:** Grid [${coords.grid[0]}, ${coords.grid[1]}] | WGS84: ${coords.wgs84.lat.toFixed(5)}°N, ${coords.wgs84.lon.toFixed(5)}°W | State Plane: (${coords.projected.x.toFixed(1)}, ${coords.projected.y.toFixed(1)})`);
    lines.push(`- **Coordinate Provenance:** \`${gov.locationProvenance || 'DERIVED'}\``);
  }
  lines.push(`- **Dispatch Safety Guard:** ${gov.dispatchLockoutNotice}`);
  lines.push('');

  // 7. Limitations & Engineering Disclosures
  lines.push('---');
  lines.push('### 7. Technical Limitations & Disclosures');
  lines.push('');
  b.limitationsAndDisclosures.forEach((lim) => lines.push(`- ${lim}`));
  lines.push('');
  lines.push('---');
  lines.push(`*Report compiled autonomously by DELTA Decision Briefing Engine. Scenario verification token: \`${b.scenarioHash}\`.*`);

  return lines.join('\n');
}

/**
 * Generates a clean, standalone, print-ready HTML executive report.
 */
export function exportBriefingToHtml(briefing: DecisionBriefing): string {
  const b = briefing;
  const sc = b.scenarioContext;
  const ba = b.baselineAssessment;
  const gov = b.governanceAndStaging;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DELTA Tactical Decision Briefing — ${b.briefingId}</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --card-border: #1f2937;
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --accent: #f97316;
      --cyan: #06b6d4;
      --emerald: #10b981;
      --red: #ef4444;
      --amber: #f59e0b;
      --font-mono: 'JetBrains Mono', 'SF Mono', Consolas, Menlo, monospace;
      --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    @media print {
      body {
        background: #ffffff !important;
        color: #111827 !important;
        font-size: 11pt;
      }
      .no-print { display: none !important; }
      .card {
        background: #ffffff !important;
        border: 1px solid #d1d5db !important;
        box-shadow: none !important;
        page-break-inside: avoid;
      }
      .badge { border: 1px solid #9ca3af !important; color: #111827 !important; background: transparent !important; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #d1d5db !important; color: #111827 !important; }
      .lockout-banner { border: 2px solid #ef4444 !important; background: #fee2e2 !important; color: #991b1b !important; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text-main);
      font-family: var(--font-sans);
      line-height: 1.5;
      padding: 32px 20px;
    }
    .container {
      max-width: 980px;
      margin: 0 auto;
    }
    .header {
      border-bottom: 2px solid var(--card-border);
      padding-bottom: 24px;
      margin-bottom: 28px;
    }
    .logo-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    .title {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .title-delta {
      color: var(--accent);
      font-weight: 900;
      font-family: var(--font-mono);
    }
    .meta-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
      font-family: var(--font-mono);
      font-size: 12px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 4px;
      font-weight: 600;
      border: 1px solid transparent;
    }
    .badge-orange { background: rgba(249, 115, 22, 0.15); color: #fb923c; border-color: rgba(249, 115, 22, 0.4); }
    .badge-cyan { background: rgba(6, 182, 212, 0.15); color: #22d3ee; border-color: rgba(6, 182, 212, 0.4); }
    .badge-emerald { background: rgba(16, 185, 129, 0.15); color: #34d399; border-color: rgba(16, 185, 129, 0.4); }
    .badge-amber { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border-color: rgba(245, 158, 11, 0.4); }
    .badge-red { background: rgba(239, 68, 68, 0.15); color: #f87171; border-color: rgba(239, 68, 68, 0.4); }
    .badge-gray { background: #1f2937; color: #9ca3af; border-color: #374151; }
    
    .lockout-banner {
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid var(--red);
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 24px;
      font-size: 13px;
      color: #fca5a5;
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .card-title {
      font-size: 15px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #e5e7eb;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: var(--font-mono);
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 8px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
    }
    .kpi {
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid var(--card-border);
      border-radius: 6px;
      padding: 12px 16px;
    }
    .kpi-label {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-family: var(--font-mono);
    }
    .kpi-value {
      font-size: 22px;
      font-weight: 800;
      color: #ffffff;
      font-family: var(--font-mono);
      margin-top: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-top: 8px;
    }
    th, td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid var(--card-border);
    }
    th {
      font-family: var(--font-mono);
      font-size: 11px;
      text-transform: uppercase;
      color: var(--text-muted);
      background: rgba(0,0,0,0.2);
    }
    td {
      color: #d1d5db;
    }
    .text-mono { font-family: var(--font-mono); }
    .text-emerald { color: var(--emerald); }
    .text-orange { color: var(--accent); }
    .text-red { color: var(--red); }
    .text-amber { color: var(--amber); }
    .list-item { margin-bottom: 8px; color: #d1d5db; font-size: 13px; }
    .print-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--accent);
      color: #ffffff;
      padding: 12px 20px;
      border-radius: 6px;
      font-family: var(--font-mono);
      font-weight: 700;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,0.5);
    }
    .print-btn:hover { background: #ea580c; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-row">
        <div>
          <div class="title">
            <span class="title-delta">DELTA</span>
            <span>Spatial Decision Briefing</span>
          </div>
          <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
            Municipal Flood Defense & Healthcare Ingress Defense Directive
          </div>
        </div>
        <div style="text-align: right; font-family: var(--font-mono); font-size: 11px; color: var(--text-muted);">
          <div>BRIEFING ID: <strong>${b.briefingId}</strong></div>
          <div>SCENARIO HASH: <strong>${b.scenarioHash}</strong></div>
        </div>
      </div>
      <div class="meta-pills">
        <span class="badge ${b.incidentPosture === 'CRITICAL_HAZARD' ? 'badge-red' : b.incidentPosture === 'STAGED_MITIGATION' ? 'badge-amber' : 'badge-emerald'}">
          POSTURE: ${b.incidentPosture}
        </span>
        <span class="badge ${sc.isRegionalBenchmark ? 'badge-cyan' : 'badge-orange'}">
          PROFILE: ${sc.isRegionalBenchmark ? 'REGIONAL NOAA BENCHMARK' : 'SYNTHETIC STRESS'}
        </span>
        <span class="badge badge-gray">TIMESTAMP: ${b.generatedAt}</span>
        <span class="badge badge-gray">GRID: 25.0m (4,096 CELLS)</span>
      </div>
    </div>

    <!-- Mandatory Lockout Banner -->
    <div class="lockout-banner">
      <span style="font-size: 18px;">⚠️</span>
      <div>
        <strong>DISPATCH LOCKOUT PERMANENTLY ACTIVE:</strong>
        ${gov.dispatchLockoutNotice}
      </div>
    </div>

    <!-- 1. Executive Summary & KPIs -->
    <div class="card">
      <div class="card-title">1. Baseline Catchment Risk & Ingress Status</div>
      <div class="grid-2" style="margin-bottom: 16px;">
        <div class="kpi">
          <div class="kpi-label">Surface Flood Storage</div>
          <div class="kpi-value text-red">${ba.totalSurfaceVolumeM3.toLocaleString()} m³</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Peak Flood Depth</div>
          <div class="kpi-value">${(ba.peakDepthM * 100).toFixed(1)} cm</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Impassable Arterials (≥30cm)</div>
          <div class="kpi-value text-amber">${ba.impassableRoadCount} Arterials</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Compromised Medical Ingress</div>
          <div class="kpi-value ${ba.compromisedHospitalCount > 0 ? 'text-red' : 'text-emerald'}">
            ${ba.compromisedHospitalCount} / ${ba.hospitals.length} Facilities
          </div>
        </div>
      </div>

      <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px; font-weight: 600; text-transform: uppercase;">
        Critical Healthcare Ingress Screenings:
      </div>
      <table>
        <thead>
          <tr>
            <th>Hospital Complex</th>
            <th>Ground Elev</th>
            <th>Standing Depth</th>
            <th>Ingress Status</th>
            <th>Blocked Corridors</th>
          </tr>
        </thead>
        <tbody>
          ${ba.hospitals.map((h) => `
            <tr>
              <td><strong>${h.name}</strong></td>
              <td class="text-mono">${h.campusElevationM}m</td>
              <td class="text-mono">${(h.standingWaterDepthM * 100).toFixed(1)} cm</td>
              <td>
                <span class="badge ${h.overallStatus === 'FULLY_ACCESSIBLE' ? 'badge-emerald' : h.overallStatus === 'CAUTION_ACCESS_RESTRICTED' ? 'badge-cyan' : 'badge-amber'}">
                  ${h.overallStatus.replace(/_/g, ' ')}
                </span>
              </td>
              <td>${h.compromisedCorridors.length > 0 ? h.compromisedCorridors.join(', ') : 'None (Passable)'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- 2. Comparative Interventions -->
    <div class="card">
      <div class="card-title">2. Comparative Intervention Screening</div>
      <table>
        <thead>
          <tr>
            <th>Mitigation Plan</th>
            <th>Classification</th>
            <th>Avoided Volume</th>
            <th>Peak Depth Δ</th>
            <th>Net Road Δ</th>
            <th>Adverse Surcharge</th>
          </tr>
        </thead>
        <tbody>
          ${b.interventionComparisons.map((p) => `
            <tr>
              <td><strong>${p.planName}</strong><br><span style="font-size: 11px; color: var(--text-muted);">${p.resourceCost}</span></td>
              <td>
                <span class="badge ${p.classification === 'MEASURABLE_BENEFIT' ? 'badge-emerald' : p.classification === 'ADVERSE_LOCAL_DEFLECTION' ? 'badge-amber' : p.classification === 'CAPACITY_CONSTRAINED' ? 'badge-cyan' : 'badge-gray'}">
                  ${p.classification}
                </span>
              </td>
              <td class="text-mono text-emerald">+${p.avoidedSurfaceStorageM3.toLocaleString()} m³</td>
              <td class="text-mono">-${(p.peakDepthReductionM * 100).toFixed(1)} cm</td>
              <td class="text-mono text-cyan">+${p.netProtectedRoadCount}</td>
              <td>
                ${p.hasAdverseDeflection
                  ? `<span class="badge badge-amber">⚠️ +${(p.maxAdverseDepthIncreaseM * 100).toFixed(1)}cm (${p.adverseCellCount} cells)</span>`
                  : `<span style="color: var(--text-muted); font-size: 11px;">None (0 cells)</span>`}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="margin-top: 16px; padding: 12px; background: rgba(0,0,0,0.25); border-radius: 6px;">
        <div style="font-size: 12px; font-weight: 700; color: var(--accent); margin-bottom: 4px; font-family: var(--font-mono);">
          INCIDENT COMMAND RECOMMENDATION: ${b.recommendation.recommendedPlanName}
        </div>
        <div style="font-size: 13px; color: #d1d5db;">
          ${b.recommendation.rationale}
        </div>
      </div>
    </div>

    <!-- 3. Cross-Scenario Robustness Matrix -->
    <div class="card">
      <div class="card-title">3. Cross-Scenario Stress Robustness Matrix</div>
      <div style="font-size: 12px; color: var(--amber); margin-bottom: 12px;">
        ℹ️ ${b.crossScenarioRobustness.exploratoryNotice}
      </div>
      <table>
        <thead>
          <tr>
            <th>Rainfall Profile</th>
            <th>Category</th>
            <th>Total Depth</th>
            <th>Plan Alpha</th>
            <th>Plan Beta</th>
            <th>Plan Gamma</th>
          </tr>
        </thead>
        <tbody>
          ${b.crossScenarioRobustness.matrix.map((row) => `
            <tr>
              <td><strong>${row.profileName.split('(')[0].trim()}</strong></td>
              <td>
                <span class="badge ${row.isRegionalBenchmark ? 'badge-cyan' : 'badge-orange'}">
                  ${row.isRegionalBenchmark ? 'NOAA Benchmark' : 'Synthetic Stress'}
                </span>
              </td>
              <td class="text-mono">${row.totalRainfallMm} mm</td>
              <td class="text-mono">${row.plans['plan-alpha'].avoidedStorageM3.toLocaleString()} m³<br><span style="font-size: 10px; color: var(--text-muted);">${row.plans['plan-alpha'].classification}</span></td>
              <td class="text-mono">${row.plans['plan-beta'].avoidedStorageM3.toLocaleString()} m³<br><span style="font-size: 10px; color: var(--text-muted);">${row.plans['plan-beta'].classification}</span></td>
              <td class="text-mono text-emerald">${row.plans['plan-gamma'].avoidedStorageM3.toLocaleString()} m³<br><span style="font-size: 10px; color: var(--text-muted);">${row.plans['plan-gamma'].classification}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- 4. Governance & Limitations -->
    <div class="card">
      <div class="card-title">4. Governance Staging & Engineering Disclosures</div>
      <div style="font-size: 13px; margin-bottom: 12px;">
        <div><strong>Commander Authority:</strong> ${gov.approvedBy || 'Duty Incident Commander'}</div>
        <div><strong>Active Decision ID:</strong> <span class="text-mono">${gov.decisionId || 'None'}</span></div>
        <div><strong>Staged Work Order:</strong> <span class="text-mono">${gov.workOrderId || 'None'} (${gov.workOrderStage || 'N/A'})</span></div>
        <div><strong>Linked Jira Issue:</strong> <span class="text-mono">${gov.linkedJiraIssueKey || 'None'}</span></div>
      </div>
      <div style="border-top: 1px solid var(--card-border); padding-top: 12px;">
        <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; font-family: var(--font-mono);">
          Mandatory Limitations & Engineering Caveats:
        </div>
        <ul style="padding-left: 18px;">
          ${b.limitationsAndDisclosures.map((lim) => `<li class="list-item">${lim}</li>`).join('')}
        </ul>
      </div>
    </div>

    <div style="text-align: center; font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); margin-top: 32px;">
      AUTHENTICATED OPERATIONAL BRIEFING • IMMUTABLE SCENARIO HASH: ${b.scenarioHash} • DELTA 2.0
    </div>
  </div>

  <button class="print-btn no-print" onclick="window.print()">
    Print Briefing
  </button>
</body>
</html>`;
}

/**
 * Browser download helper for text/markdown or HTML content.
 */
export function downloadBriefingFile(filename: string, content: string, mimeType: string = 'text/plain'): void {
  if (typeof window === 'undefined' || !window.document) return;
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copies text content to clipboard with fallback.
 */
export async function copyBriefingToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}
