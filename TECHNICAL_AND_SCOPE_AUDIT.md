# DELTA — Technical & Scope Audit

**Audit Date**: November 2026  
**Auditor**: Antigravity  
**Context**: Pre-Phase 1 Technical and Scope Audit before Forge & Hydrology Implementation  

---

## 1. Verified Working Functionality

| Subsystem | Implemented Component | Working Verification |
|---|---|---|
| **Visual Identity & Tokens** | `src/styles/tokens.ts`, `tailwind.config.js` | 60/30/10 rule enforced. Storm Grey neutral surfaces, Matte Onyx structural panels, Safety Orange restrained accents, Hydrological Blue vectors. Zero generic gradients or glassmorphism. |
| **Topographic Canvas Engine** | `src/components/terrain/TerrainContourCanvas.tsx` | 60 FPS HTML5 canvas computing 2D elevation isolines, fluid streamline vectors, elevation probe, coordinate crosshairs (`WGS84 / UTM-31N`, `1.0m DEM`). |
| **Tactical Application Shell** | `src/components/shell/AppShell.tsx` | Navigable operational shell with collapsible sidebar and 6 distinct views. Verified with 0 JS console errors. |
| **Interactive Feature Workbench** | `src/components/landing/InteractiveFeatureWorkbench.tsx` | 5 interactive subsystem tabs (`MOD-01` to `MOD-05`) with live replanning demonstration. |
| **Audit Ledger View** | `src/components/shell/views/DecisionRecordsView.tsx` | Append-only audit record schema displaying cryptographically hashed decision blocks. |
| **Operational Ticket Queue** | `src/components/shell/views/OperationalTicketsView.tsx` | Jira Service Management issue schema preview with coordinates, priorities, and SLA timers. |
| **Build & Git Pipeline** | `package.json`, Vite, TypeScript | Zero build/lint errors (`tsc -b && vite build` in < 2s). Local git initialized and synced to `https://github.com/commit-to-Noma/DELTA`. |

---

## 2. Interface Labels & Data Integrity Audit

To prevent misrepresenting synthetic data as live field telemetry or real operational records, the following labels must be strictly qualified:

| Location | Current Label | Remediation Required |
|---|---|---|
| `FloodSimulationView.tsx` | `REALTIME FEEDS` | Replace with `SYNTHETIC SENSOR FEEDS (MODEL SPECIFICATION)` |
| `FloodSimulationView.tsx` | `14,250 m³/hr Inflow` | Label as `SIMULATED HYDROGRAPH INFLOW` |
| `FloodSimulationView.tsx` | `78.4% Nominal` | Label as `MODELED DRAINAGE EFFICIENCY` |
| `FloodSimulationView.tsx` | `11.4 cm (Passable)` | Label as `PROJECTED WATER DEPTH` |
| `DecisionRecordsView.tsx` | `DECISION REGISTRY` | Add subtitle: `DEMO AUDIT LEDGER SCHEMA (SPECIFICATION ONLY)` |
| `OperationalTicketsView.tsx` | `ACTIVE FIELD DISPATCH TICKETS` | Add subtitle: `JSM DISPATCH SCHEMA PREVIEW (UNCONNECTED)` |

---

## 3. Scope & Entry Point Alignment

* **Issue Identified**: `App.tsx` defaulted to the marketing landing page (`currentMode = 'landing'`).
* **Correction**: The Atlassian Forge application entry point must open directly into the **operational application shell** (`'app'`). The marketing landing page should be accessible via an explicit route/parameter (`?view=landing`) or a top-bar toggle, but must never stand between an incident commander and the simulation workspace.

---

## 4. Platform Feasibility Audit (Atlassian Forge, Rovo, JSM, Storage)

### A. Forge Custom UI
* **Feasibility**: High.
* **Mechanism**: `manifest.yml` module `jira:projectPage` or `jira:issuePanel` with `resource: build` pointing to our Vite production build (`dist/`).
* **Constraint**: `@forge/bridge` handles context passing (project ID, issue key). No external network egress required.

### B. Atlassian Rovo Modules (`rovo:agent`, `rovo:action`)
* **Feasibility**: High.
* **Mechanism**:
  * `rovo:agent` defines the virtual incident commander assistant.
  * `rovo:action` exposes deterministic simulation tools (e.g., `calculate_flood_interventions`, `get_corridor_water_depth`).
  * Action resolvers run on Forge runtime as isolated functions (`@forge/resolver`).
* **Non-Negotiable**: AI never approves or dispatches; it purely calls the deterministic action to explain the physical trade-off to the human commander.

### C. Forge Storage (Append-Only Decision Ledger)
* **Feasibility**: High.
* **Mechanism**: `@forge/api` `storage.set()` and `storage.query()`.
* **Constraint**: 32KB per value limit, ideal for serialized JSON Decision Records containing storm parameters, chosen intervention, water balance delta, and authorizing officer hash.

### D. Jira Service Management (JSM) Ticket Creation
* **Feasibility**: High.
* **Mechanism**: `api.asApp().requestJira('/rest/api/3/issue', ...)` or JSM Service Desk API `/rest/servicedeskapi/request`.
* **Permissions**: Requires Forge manifest scopes `write:jira-work`, `read:jira-work`.

---

## 5. Smallest Set of Technical Feasibility Spikes

1. **Spike A (Forge Custom UI & Manifest Harness)**:
   - Create valid `manifest.yml` in project root declaring `jira:projectPage` pointing to `dist`.
   - Verify `forge lint` passes without module errors.
2. **Spike B (Rovo Agent Action Resolver Specification)**:
   - Define `rovo:agent` and `rovo:action` in `manifest.yml` with simulated input/output schemas.
   - Implement Forge resolver function handling action payloads.
3. **Spike C (Forge Storage Mock/Contract Test)**:
   - Define TypeScript schema for `DecisionRecord` and create a storage adapter compatible with `@forge/api` storage API and browser local fallback.
4. **Spike D (JSM Dispatch Payload Contract)**:
   - Create strongly-typed JSM payload generator translating an approved Decision Record into an issue payload.

---

## 6. Real-Geography Scope Reconciliation

* **Question**: Should DELTA use real geographical data or purely synthetic terrain?
* **Scope Evaluation**:
  * Attempting live ingestion of external GIS servers during a hackathon introduces network dependencies, API keys, rate limits, and failure modes for judges.
  * *Optimal Approved Architecture*: **Pre-processed Bundled District Geometry**.
    - Represent ONE real, named municipal catchment (e.g. an urban medical hub catchment).
    - Source road network and hospital footprint from **OpenStreetMap** (ODbL open data).
    - Source topographic elevation from public DEM (Copernicus / USGS 30m or 1m LiDAR).
    - Pre-process offline into a bundled static JSON grid (e.g. 64×64 elevation matrix + vector graph of road segments and culvert nodes).
    - Rainfall remains a standardized 100-year storm hydrograph (simulated).
    - Drainage assumptions (inlet capacities, outfalls) are explicitly documented in the interface.
  * **Result**: Zero runtime GIS dependencies, 100% reproducible for judges, legitimate geographical topography, full license compliance.

---

## 7. Risks to Hackathon Submission

1. **Judge Environment Installation Failure**: If Forge manifest permissions or backend tunnels fail, judges cannot test. *(Mitigation: keep simulation compute client-side in Custom UI; use Forge backend only for storage and JSM ticket creation).*
2. **AI Hallucination in Simulation**: If an LLM is used to calculate flood water, it violates the non-negotiable principles and ruins credibility. *(Mitigation: strict boundary—deterministic solver computes; Rovo only reads and explains).*
3. **Video Presentation Complexity**: Pitching too many features in under 5 minutes. *(Mitigation: focus video strictly on: One Storm → One Fix → Live Disruption Replan → Human Approval → JSM Ticket).*

---

## 8. Prioritised Implementation Sequence

1. **Step 1**: Fix interface label ambiguities (qualify all synthetic/model data) and adjust `App.tsx` entry point to load the operational shell directly.
2. **Step 2 (Spike A)**: Implement Forge Custom UI `manifest.yml` and resolver harness.
3. **Step 3 (Spike B)**: Implement Rovo Agent (`rovo:agent`) and action (`rovo:action`) manifest module declarations.
4. **Step 4**: Implement the 64×64 mass-conserving hydraulic solver with automated water-balance unit tests.
5. **Step 5**: Package the bundled real catchment dataset (OSM road vectors + elevation matrix).
6. **Step 6 (Spike C & D)**: Implement Forge Storage Decision Record persistence and JSM ticket creation payloads.
