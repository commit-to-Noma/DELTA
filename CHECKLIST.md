# DELTA — Production Roadmap & Milestone Checklist

> **Rule**: Every task must be verified with automated tests and/or build verification, and committed immediately to GitHub to guarantee zero regressions.

---

## [x] Phase 0: Visual Identity & Interactive Shell
- [x] **0.1 Design System & 60/30/10 Tokens**: Storm Grey, Matte Onyx, Safety Orange, Hydrological Blue defined in `src/styles/tokens.ts` and `tailwind.config.js`. *(Committed: 5d35c85)*
- [x] **0.2 Interactive Canvas Engine**: 60 FPS HTML5 topographic contour generator with flow vectors and coordinate readouts in `TerrainContourCanvas.tsx`. *(Committed: 5d35c85)*
- [x] **0.3 Interactive Landing Page**: 6 modular sections with live replanning demo and Atlassian tech stack rationale. *(Committed: 5d35c85)*
- [x] **0.4 Tactical Application Shell**: Navigable 6-workspace shell in `AppShell.tsx` with collapsible navigation. *(Committed: 5d35c85)*
- [x] **0.5 Verification & QA**: `npm run build` passing with 0 errors; browser QA verified with 0 console errors. *(Committed: 5d35c85)*

---

## [x] Phase 0.5: Technical & Scope Audit & Feasibility Spikes
- [x] **0.5.1 Technical & Scope Audit**: Formulated and committed `TECHNICAL_AND_SCOPE_AUDIT.md`. *(Committed: fdb6fd5)*
- [x] **0.5.2 Data Integrity Labels**: Calibrated all synthetic data indicators across `FloodSimulationView.tsx`, `DecisionRecordsView.tsx`, and `OperationalTicketsView.tsx`. *(Committed: fdb6fd5)*
- [x] **0.5.3 Forge Entry Point Alignment**: Configured `src/App.tsx` to default directly into the operational application shell, keeping the landing page accessible via `?view=landing`. *(Committed: fdb6fd5)*
- [x] **0.5.4 Spike A (Forge Custom UI & Manifest)**: Defined `manifest.yml` with `jira:projectPage`, nodejs22.x runtime. Registered app (`7c4b604a-2340-4df7-8c0a-8fd8e44b7a12`), deployed to development, and installed onto live Jira tenant `nomathembancube2005.atlassian.net`.
- [x] **0.5.5 Spike B (Rovo Agent & Actions)**: Declared `rovo:agent` and `action` modules with `actionVerb: GET`, verified with 0 lint errors, and deployed resolver handler in `src/resolvers/index.js`.

---

## [x] Phase 1: Deterministic 64×64 Hydraulic Simulation Engine
- [x] **1.1 Core Mathematical Model**: Implemented 2D mass-conserving staggered overland flow solver with adaptive CFL/diffusive sub-stepping in `src/simulation/hydraulicSolver.ts`.
- [x] **1.2 Water Balance Test Suite**: Authored 10 independent verification tests in `tests/hydraulicSolver.test.ts`, expanded to 17 tests covering numerical edge cases and mass conservation ($< 10^{-10}$). All 17 tests passing.
- [x] **1.3 Bundled Real Catchment Dataset**: Packaged static 64×64 elevation matrix from USGS 3DEP 1m LiDAR and infrastructure vectors from OpenStreetMap (5 hospital complexes, 135 road segments) for Boston Longwood & Muddy River catchment in `src/data/bostonLongwoodCatchment.json`. Implemented `src/data/catchmentLoader.ts` with CRS metadata, coordinate conversions, and hydraulic solver adapter. Authored 8 automated tests in `tests/bostonDataset.test.ts` (total 25/25 tests passing). Documented authoritative provenance, licenses (ODbL 1.0, USGS Public Domain, NOAA Atlas 14), and fact vs. model boundaries in `BOSTON_DATASET_PROVENANCE.md`.
- [x] **1.3.1 Geographic Dataset Integrity Audit**: Conducted independent technical audit across USGS DEM binary structure, OSM facilities/roads, CRS projection scaling, NOAA Atlas 14 hydrographs, and legal licensing in `BOSTON_DATASET_INTEGRITY_AUDIT.md`.
- [x] **1.3.2 Live Forge Integration Smoke Test**: Deployed version 2.1.0 to development and verified installation on `nomathembancube2005.atlassian.net`. Hardened dual-mode resolver handler in `src/resolvers/index.js` for Custom UI bridge and Rovo actions, verified with 6 automated tests in `tests/forgeResolver.test.ts` (31/31 suite tests passing). Documented findings in `FORGE_INTEGRATION_SMOKE_TEST.md`.
- [x] **1.3.3 Geographic Grid Projection & Alignment Correction**: Corrected 26% north-south aspect ratio distortion. Sourced genuine 1,600m × 1,600m DEM in EPSG:26986 (NAD83 / Massachusetts Mainland) from USGS 3DEP with 25.0m square cells. Integrated closed-form Lambert Conformal Conic geodesy engine in `src/data/catchmentLoader.ts`. Re-projected all 5 hospitals and 117 clipped roads. Verified with 8 dataset tests (31/31 suite tests passing). Documented in `BOSTON_GRID_PROJECTION_CORRECTION.md`.
- [x] **1.4 Canvas Integration**: Built high-DPI `GeographicSimulationCanvas.tsx` rendering the authoritative 64×64 Boston Longwood catchment with strict 1:1 aspect ratio ($1,600\text{ m} \times 1,600\text{ m}$, EPSG:26986). Overlayed 5 hospitals, 117 clipped emergency road corridors, 3 drainage inlets, metric scale bar, and North compass. Coupled live simulation loop to 2D diffusive-wave hydraulic solver (`stepHydraulics`), rendering computed water depths and hydraulic gradient velocity vectors. Integrated storm event selector (NOAA 10-yr, 50-yr, 100-yr, custom slider), playback controls (Run/Pause, Step +2s, Reset, 1x/2x/5x), interactive cell inspector, and live mass balance accounting. Authored 6 automated integration tests in `tests/canvasIntegration.test.ts` (37/37 suite tests passing). Documented in `TASK_1_4_CANVAS_INTEGRATION.md`.

---

## [ ] Phase 2: Dynamic Disruption & In-Flight Replanning
- [ ] **2.1 Disruption State Manager**: Model culvert debris blockages (e.g. 80% loss of Muddy River gravity inlet capacity), emergency road closures, and localized pump failures with explicit before/after delta states.
- [ ] **2.2 Live 2D Recalculation Engine**: Recompute downstream overland flood propagation and emergency hospital artery accessibility in real-time ($< 50\text{ms}$ sub-stepping) using the diffusive-wave solver.
- [ ] **2.3 Causal Replanning Engine**: Automatically compute changes in critical hospital ingress/egress routes and generate clear, deterministic engineering justifications for why initial plans failed.

---

## [ ] Phase 3: Multi-Scenario Intervention Planner & Fair Baseline Comparison
- [ ] **3.1 Candidate Plan Scenarios**: Define structured mitigation interventions (Plan A: Sandbag dyking on Brookline Ave; Plan B: High-capacity mobile pumps discharging to Muddy River; Plan C: Emergency vacuum culvert jetting).
- [ ] **3.2 Normalized Scoring Matrix**: Simulate every candidate intervention against the identical NOAA Atlas 14 baseline storm; compute quantitative metrics: avoided flood volume ($\text{m}^3$), ambulance response delay avoided ($\text{min}$), deployment hours, and equipment cost.
- [ ] **3.3 Interactive Trade-Off Visualizer**: Multi-scenario comparison panel allowing the incident commander to toggle candidate interventions and inspect comparative water depth profiles.

---

## [ ] Phase 4: Atlassian Rovo Agent & Teamwork Graph Integration
- [ ] **4.1 Rovo Action Resolvers**: Connect Rovo actions (`get-simulation-status`, `evaluate-interventions`) to live simulation state in `src/resolvers/index.js`.
- [ ] **4.2 Deterministic Physics Explanations**: Verify Rovo delivers explainable, plain-language hydraulic rationale (e.g. explaining why mobile pumping de-risks hospital access while sandbagging diverts water toward BIDMC East) without hallucinating numbers.
- [ ] **4.3 Teamwork Graph API Querying**: Ingest and link critical medical facilities, municipal drainage infrastructure, and historical flood incident issues via Teamwork Graph in preview.
- [ ] **4.4 Model Context Protocol (MCP) Tool Exposure**: Author `skill.md` and expose hydraulic solver inspection tools via Forge MCP for developer and agentic workflows.

---

## [ ] Phase 5: Append-Only Decision Records & Forge Storage
- [ ] **5.1 Append-Only Ledger Schema**: Design auditable record schema (unique ID `DEC-XXXX`, scenario hash, baseline storm, chosen plan, physical metrics, human authorizing officer, timestamp) labelled "Append-only by application design".
- [ ] **5.2 Forge KVS Storage Persistence**: Persist Decision Records using `@forge/api` Key-Value Storage (`storage.set`, `storage.get`) with zero external database dependencies for 100% data residency compliance.
- [ ] **5.3 Human-in-the-Loop Approval Gate**: Implement strict human authorization step preventing autonomous execution; only an authorized incident commander can sign and commit a decision block.

---

## [ ] Phase 6: Proactive Jira Workflow Gate, Issue Panel & JSM Field Dispatch
- [ ] **6.1 Jira Issue Glance & Panel**: Add `jira:issuePanel` and `jira:issueGlance` to `manifest.yml` to display live flood risk, passability status, and active decision records directly inside Jira incident issues.
- [ ] **6.2 Proactive Workflow Gate (Condition/Validator)**: Implement Forge Workflow Validator that actively blocks Jira incident transitions to `Dispatched` or `Resolved` unless an Approved Decision Record exists in Forge Storage.
- [ ] **6.3 Jira Service Management Dispatcher**: Automatically generate field crew dispatch tickets in JSM containing exact EPSG:26986 & WGS84 coordinates, equipment requirements, and priority SLAs.
- [ ] **6.4 Automated Confluence Incident Runbook**: Publish complete post-incident engineering runbook to Confluence via `requestConfluence` with full hydraulic telemetry, scenario comparison tables, and human sign-off audit trail.

---

## [ ] Phase 7: Marketplace Listing, Video & Devpost Submission
- [ ] **7.1 "Golden Journey" Demo Video (< 5:00 min)**: Produce high-energy, narrative-driven video on YouTube demonstrating the complete crisis cycle (Pre-storm baseline -> Culvert blockage -> Real-time solver replan -> Multi-scenario comparison -> Rovo audit -> Human approval -> Proactive workflow gate -> JSM dispatch -> Confluence runbook). Publicly visible, no copyrighted music.
- [ ] **7.2 Marketplace Early Submission & Review Ticket**: Package app for Atlassian Marketplace, submit early for listing review, and obtain the Marketplace Review Ticket Link required by Devpost for the $1,500 Bonus Prize.
- [ ] **7.3 Sharable Forge Installation Link & Sandbox Guide**: Generate public installation link via Forge app distribution (`developer.atlassian.com/platform/forge/distribute-your-apps`); author step-by-step testing instructions for judges verifying clean installation on fresh demo sites.
- [ ] **7.4 Devpost Submission Form Completion**: Finalize Devpost text covering all 5 judging criteria (Technological Implementation 20%, Design 20%, Impact 20%, Innovation 20%, Presentation 20%), category selection (Specialized Industries), and bonus prize declarations before December 22, 2026 @ 12:00pm PST.
