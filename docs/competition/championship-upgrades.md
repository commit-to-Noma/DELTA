# DELTA Championship Upgrades — 1st-Place Plan (Nov 28 → Dec 20)

Rule: every upgrade boosts a 20% rubric criterion without muddying the Golden Journey
(Intelligence → Simulation → Interventions → Decision → Confluence → Dispatch → Validator).

Devpost: **Codegeist 2026: Build with context. Ship with confidence** (codegeist2026.devpost.com) — deadline **Dec 22, 2026, 10:00pm GMT+2**.
Prizes: 1st $15,000 + Team 2027; bonuses $1,500 each (Rovo/MCP, TWG, Marketplace, Best in EMEA/APAC).
Special judge: Adam Moore, Product Lead, Rovo MCP & Rovo Skills: *“fits seamlessly into how people already work”.*

## The 5 upgrades

| # | Upgrade | Criterion | Status in code |
|---|---|---|---|
| 1 | Click-Anywhere Sandbox: tool (Pump/Barrier/Blockage) + strength + rainfall ×0.5–1.5, click any 64×64 cell, real solver delta, Undo/Clear/Reset Golden Journey | Tech (#1 tiebreaker) | `customSandbox.ts`, context sandbox state, FloodSimulationView panel + canvas markers |
| 2 | Proactive trigger `avi:jira:created:issue` (flood terms only, deduped, honest NO_RUN text) + issue-panel flood-impact snapshot (peak/storage/avoided, decision, Ops Center link) | Design + Impact | `proactiveTrigger.js`, manifest trigger, `getSimulationSnapshotForPanel`, IssuePanel snapshot card |
| 3 | Real Teamwork Graph: GraphQL search (best-effort, TWG_UNAVAILABLE honest), Confluence runbooks, Compass owners, labeled-Jira history, `query-related-context` Rovo action | Innovation + TWG $1,500 | `teamworkGraph.js`, manifest action/scopes |
| 4 | Governance Settings drawer (KVS: commander role, dispatch type, Confluence space, trigger on/off) + 1-click Create Sample Flood Incident (search-before-create) | Design + Marketplace $1,500 | `governanceSettings.js`, GovernanceSettings.tsx, AppShell header |
| 5 | External `rovo:mcp` proof: live tools list, SKILL.md with exact tool keys, `scripts/verify-rovo-mcp.mjs` 20s-clip checklist | Tech + Rovo/MCP $1,500 | `mcp/SKILL.md`, script; live external call still needs a user-OAuth MCP session — record it, do not fake it |

## Our added improvements
- Truth-gate sweep: removed hardcoded EMERG-101 panel defaults, auth now fails closed with no trusted project (no EMERG fallback), SKILL.md no longer invents avoided volumes.
- Judge-friction cuts: Reset Golden Journey 1-click, sandbox results labelled “screening representation”, trigger dedupe so judges don't get duplicate comments.
- Demo integrity: stored NOAA run ranks **Plan Beta** — script/demo must say Beta, never “Gamma wins”.
- Validator gotcha documented everywhere: seed/sample issues need a linked approved decision or the Dispatched/Resolved gate correctly blocks.

## 3-week schedule
- **Week 1 (Nov 28–Dec 4):** 4-click live verification on one-atlas (Approve→Confluence→Dispatch→Sub-task), ship Upgrades 1+2, rerun tests, deploy development, click-test sandbox + trigger on a fresh sample incident.
- **Week 2 (Dec 5–Dec 11):** Upgrades 3–5, record external MCP clip, `forge deploy -e production`, freeze features Dec 11.
- **Week 3 (Dec 12–Dec 19):** Forge Sharing Link on a clean site, Marketplace review ticket, README screenshots, 4:15–4:45 Golden Journey video, Devpost draft.
- **Dec 20 buffer:** incognito-check every public link (YouTube, GitHub, Sharing Link, Marketplace ticket), submit 48h early.

## Judge seed (30 seconds on a fresh site)
1. Install via Sharing Link → open DELTA Engine (any project; no EMERG dependency).
2. Header → Settings → **Create Sample Flood Incident** (creates/reuses `[DELTA Sample]…`).
3. Open that issue: proactive DELTA comment + issue panel snapshot should appear.
4. Run Golden Journey in DELTA Engine, approve, link decision, then Dispatch/Confluence/validator test.
