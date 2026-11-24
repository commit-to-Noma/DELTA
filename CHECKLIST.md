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
- [x] **0.5.4 Spike A (Forge Custom UI & Manifest)**: Defined `manifest.yml` with `jira:projectPage`, nodejs22.x runtime, and validated via `forge lint`. *(Committed: 7009de2)*
- [x] **0.5.5 Spike B (Rovo Agent & Actions)**: Declared `rovo:agent` and `rovo:action` modules in `manifest.yml` and authored resolver handler in `src/resolvers/index.ts`. *(Committed: 7009de2)*

---

## [x] Phase 1: Deterministic 64×64 Hydraulic Simulation Engine
- [x] **1.1 Core Mathematical Model**: Implemented 2D mass-conserving staggered overland flow solver with adaptive CFL/diffusive sub-stepping in `src/simulation/hydraulicSolver.ts`.
- [x] **1.2 Water Balance Test Suite**: Authored 10 independent verification tests in `tests/hydraulicSolver.test.ts`, expanded to 17 tests covering numerical edge cases and mass conservation ($< 10^{-10}$). All 17 tests passing.
- [x] **1.3 Bundled Real Catchment Dataset**: Packaged static 64×64 elevation matrix from USGS 3DEP 1m LiDAR and infrastructure vectors from OpenStreetMap (5 hospital complexes, 135 road segments) for Boston Longwood & Muddy River catchment in `src/data/bostonLongwoodCatchment.json`. Implemented `src/data/catchmentLoader.ts` with CRS metadata, coordinate conversions, and hydraulic solver adapter. Authored 8 automated tests in `tests/bostonDataset.test.ts` (total 25/25 tests passing). Documented authoritative provenance, licenses (ODbL 1.0, USGS Public Domain, NOAA Atlas 14), and fact vs. model boundaries in `BOSTON_DATASET_PROVENANCE.md`.
- [ ] **1.4 Canvas Integration**: Connect simulation state array to the canvas visualizer and storm hydrograph scrubber.

---

## [ ] Phase 2: Dynamic Disruption & In-Flight Replanning
- [ ] **2.1 Disruption State Manager**: Model culvert debris blockages, road washouts, and pump failures.
- [ ] **2.2 Live Recalculation Engine**: Recompute downstream water depths and hospital artery accessibility in real time when disruptions occur.
- [ ] **2.3 Replanning Explanation Generator**: Formulate causal rationale detailing why recommendations shifted.

---

## [ ] Phase 3: Intervention Planner & Fair Baseline Comparison
- [ ] **3.1 Candidate Plan Scenarios**: Define structured mitigation interventions (sandbagging, culvert clearing, mobile pumps).
- [ ] **3.2 Normalized Scoring Matrix**: Simulate every candidate against the identical baseline storm; compute delta inundation and ambulance delay metrics.

---

## [ ] Phase 4: Atlassian Rovo Agent Integration
- [ ] **4.1 Tool Resolver Wiring**: Connect Rovo actions (`get-simulation-status`, `evaluate-interventions`) to the live simulation state.
- [ ] **4.2 Causal Explanations**: Verify Rovo delivers plain-language physics explanations without hallucinating or overriding deterministic results.

---

## [ ] Phase 5: Immutable Decision Records & Forge Storage
- [ ] **5.1 Append-Only Ledger Schema**: Design cryptographic hash signature for decision blocks (storm parameters + chosen plan + authorizing officer).
- [ ] **5.2 Forge Storage Persistence**: Persist Decision Records using `@forge/api` storage with browser fallback.

---

## [ ] Phase 6: Jira Service Management Field Dispatch
- [ ] **6.1 JSM Issue Payload Generator**: Transform approved Decision Records into field dispatch tickets with coordinates and SLAs.
- [ ] **6.2 Forge REST API Dispatcher**: Dispatch to JSM Service Desk API with `write:jira-work` scope.

---

## [ ] Phase 7: Hackathon Deliverables & Video
- [ ] **7.1 Video Walkthrough Script (< 5:00 min)**: Problem -> Single Storm -> Disruption Replan -> Human Approval -> JSM Ticket.
- [ ] **7.2 Installation & Testing Instructions**: Zero-friction setup guide for Codegeist judges.
- [ ] **7.3 Devpost Submission Copy**: Complete submission text covering all 5 judging criteria.
