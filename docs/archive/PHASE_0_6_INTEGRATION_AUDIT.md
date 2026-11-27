# DELTA — Phase 0.6: Operational Integration Audit

**Date:** 2026-11-25  
**Audit Scope:** Codebase at commit containing deployed version 2.5.0  
**Audit Type:** Read-Only Technical Architecture & Spatial Integrity Verification  
**Auditor:** DELTA Technical Audit Team (Pro Architecture Review)

---

## Executive Summary

This audit assesses the operational readiness of DELTA’s core integration loop following the deployment of version 2.5.0 to Atlassian Forge development environment (`nomathembancube2005.atlassian.net`). 

While all 57 automated tests pass and Forge deployment succeeded with "Runs on Atlassian" eligibility, **the integrations are not yet operationally complete end-to-end**. The audit identified two critical technical defects requiring immediate remediation before live operational use:
1. **Material Spatial Coordinate Distortion in JSM Dispatcher:** The field dispatch order generator emits placeholder coordinates that lie **3.7 kilometres south and 150 metres east outside the computational grid domain**, completely detached from the actual Muddy River Brookline Avenue culvert dataset.
2. **Scientific Terminology Drift:** Recent documentation inappropriately referred to the solver as a *"2D Saint-Venant solver"*. Code inspection confirms the implementation is an explicit **2D Diffusive-Wave (zero-inertia) approximation with Manning resistance**.

Furthermore, all 23 integration tests (KVS, Workflow Validator, JSM Dispatcher) currently run against **in-memory fallbacks or mock API clients**. None have executed against live Atlassian Cloud services.

---

## 1. Geographic Coordinate Integrity Audit

### 1.1 Dataset Coordinate System & Bounds
The authoritative dataset specification in [bostonLongwoodCatchment.json](file:///Users/nomat/Projects/DELTA/src/data/bostonLongwoodCatchment.json#L24-L45) defines:
- **Projected CRS:** NAD83 / Massachusetts Mainland (EPSG:26986)
- **Domain Extent:** Exactly 1,600 m × 1,600 m ($64 \times 64$ grid at $\Delta x = \Delta y = 25.0\text{ m}$)
- **Projected Bounds:**
  - Easting ($X$): `231,650.0 m` to `233,250.0 m`
  - Northing ($Y$): `897,900.0 m` to `899,500.0 m`
- **Geographic Envelope (WGS84):**
  - Latitude: `42.330883° N` to `42.345354° N`
  - Longitude: `-71.115978° W` to `-71.096473° W`

### 1.2 Discrepancy Investigation: JSM Dispatcher
In [jsmDispatcher.js](file:///Users/nomat/Projects/DELTA/src/resolvers/jsmDispatcher.js#L76) and [tests/jsmDispatcher.test.ts](file:///Users/nomat/Projects/DELTA/tests/jsmDispatcher.test.ts#L51), the target coordinates for Plan Beta (Muddy River Brookline Ave Culvert) were reported as:
- **Reported Easting:** `233,400 m`
- **Reported Northing:** `894,200 m`
- **Reported WGS84:** `42.33890° N, 71.10980° W`
- **Reported Grid Cell:** `[Row 28, Col 42]`

#### Root Cause Analysis:
1. **Out of Domain by 3.7 km:**
   - Maximum dataset Northing is `899,500 m`; minimum is `897,900 m`.
   - The Northing `894,200 m` is **$3,700\text{ m}$ (3.7 km) south** of the computational catchment (falling in southern Roxbury / Dorchester).
   - The Easting `233,400 m` is **$150\text{ m}$ east** of the domain's eastern boundary (`233,250 m`).
2. **Coordinate Mismatch (WGS84 vs EPSG:26986):**
   - The reported geodetic coordinate `42.33890° N, 71.10980° W` projects in Massachusetts Mainland (EPSG:26986) to approximately Easting `232,155 m`, Northing `898,740 m` (near BIDMC East Campus). It does **not** project to $X=233,400, Y=894,200$.
3. **Contradiction with Authoritative Dataset Inlets:**
   - In `bostonLongwoodCatchment.json`, the real inlet `CULVERT-01-BROOKLINE` (*Brookline Avenue Muddy River Culvert Inflow*) is explicitly measured at:
     - **Projected:** $X = 232,302.11\text{ m}$, $Y = 899,074.88\text{ m}$
     - **Geodetic:** Lat $42.34150^\circ\text{ N}$, Lon $-71.10800^\circ\text{ W}$
     - **Grid Index:** Cell `[Row 17, Col 26]` (linear index 1114)
4. **Origin of Error:**
   - In `src/resolvers/jsmDispatcher.js` line 76, a synthetic string fallback `'Easting: 233,400 m, Northing: 894,200 m'` was authored as a placeholder in the ADF template and subsequently copied into the test fixture `SAMPLE_ORDER`. No dynamic lookup against `bostonLongwoodCatchment.json` was wired.

---

## 2. Hydraulic Solver Mathematical Formulation Audit

### 2.1 Code Inspection of `src/simulation/hydraulicSolver.ts`
Inspection of the solver implementation in [hydraulicSolver.ts](file:///Users/nomat/Projects/DELTA/src/simulation/hydraulicSolver.ts#L1-L360) reveals:

1. **Continuity Equation (Mass Conservation):**
   $$\frac{\partial h}{\partial t} + \frac{\partial q_x}{\partial x} + \frac{\partial q_y}{\partial y} = R - I - D$$
   where $R$ is uniform rainfall intensity, $I$ is localized infiltration, and $D$ is localized sink abstraction.
2. **Momentum Treatment (Flux Formulation):**
   - The solver **omits** the local acceleration term $\frac{\partial \mathbf{u}}{\partial t}$.
   - The solver **omits** the convective acceleration terms $\mathbf{u} \cdot \nabla \mathbf{u}$.
   - The friction slope $S_f$ is approximated purely by the free surface gradient (hydrostatic head difference):
     $$S_{f,x} = -\frac{\partial \eta}{\partial x} = -\frac{\partial (z + h)}{\partial x}$$
   - Face fluxes are calculated via Manning’s equation on staggered faces:
     $$v_x = \frac{1}{n} h_{\text{flow}}^{2/3} \sqrt{\frac{|\Delta \eta|}{\Delta x}} \cdot \text{sgn}(\Delta \eta)$$
     $$Q_x = v_x \cdot (\Delta x \cdot h_{\text{flow}}) = \frac{1}{n} \Delta x \cdot h_{\text{flow}}^{5/3} \sqrt{\frac{|\Delta \eta|}{\Delta x}} \cdot \text{sgn}(\Delta \eta)$$
3. **Stability & Flux Limiting:**
   - Employs an adaptive sub-stepping routine combining a parabolic diffusive limit ($\Delta t \le \frac{\Delta x^2}{8 D}$) and an advective Courant-Friedrichs-Lewy (CFL) condition ($\Delta t \le \frac{0.5 \Delta x}{\sqrt{g h} + 1.0}$).
   - Employs a two-pass donor-cell scaling factor $\alpha = \min\left(1.0, \frac{h_c \Delta x^2}{\sum Q_{\text{out}} \Delta t}\right)$ preventing water depths from becoming negative ($h \ge 0$).

### 2.2 Mathematical Classification & Terminology
- **Implemented Model:** **2D Diffusive-Wave Overland Flow Solver** (also known as a *Zero-Inertia Approximation* to shallow water flow) with Manning boundary resistance and cell-centered finite-volume flux limiting.
- **Why It Is Not 2D Saint-Venant:** Full 2D Saint-Venant (Shallow Water Equations) requires solving the coupled hyperbolic system of depth-averaged Navier-Stokes equations including momentum advection, shock tracking, and wave propagation. Claiming Saint-Venant mischaracterizes the physics.
- **Mandated Terminology:**
  - ✅ **Approved:** *"2D Mass-Conserving Diffusive-Wave Hydrodynamic Overland Flow Solver"* or *"2D Diffusive-Wave Hydraulic Solver"*.
  - ❌ **Prohibited:** *"2D Saint-Venant Solver"*, *"Full Dynamic Wave Navier-Stokes"*.

---

## 3. Forge Key-Value Storage (KVS) Audit

### 3.1 Code Inspection of `src/resolvers/decisionStorage.js`
- **Imports:** Correctly imports `{ kvs as forgeKvs } from '@forge/kvs'` ([decisionStorage.js](file:///Users/nomat/Projects/DELTA/src/resolvers/decisionStorage.js#L9)).
- **Runtime Environment Switch:**
  ```javascript
  const hasForgeRuntime = typeof globalThis !== 'undefined' && 
    (typeof globalThis.__forge_fetch__ === 'function' || typeof globalThis.__forge_local_fetch__ === 'function');
  if (hasForgeRuntime) return forgeKvs;
  return inMemoryStore;
  ```
- **Live vs Mock Assessment:**
  - In Vitest test suites (`tests/forgeResolver.test.ts`), `globalThis.__forge_fetch__` is `undefined`. Consequently, **100% of the 6 KVS unit tests ran against the local in-memory Map**.
  - No Decision Record has yet been read from or written to the live Atlassian Cloud KVS instance.

### 3.2 Immutability, Authorization & Concurrency Vulnerabilities
1. **Unauthenticated Write Surface:**
   `recordDecision()` validates structural fields (`decisionId`, `humanApprover`, etc.) but performs **zero authorization checks**. It does not verify `context.accountId`, nor does it check whether the invoking user possesses Jira Project Administrator or Incident Commander privileges. An arbitrary caller can submit an approval record with synthetic approver names.
2. **Check-Then-Set Concurrency Race:**
   ```javascript
   const existing = await client.get(storageKey);
   if (existing) throw new Error(...);
   await client.set(storageKey, record);
   ```
   Under concurrent invocations with identical IDs, both requests could pass the `get()` check before either executes `set()`. In Forge KVS, atomic conditional updates require transactional primitives or version locks.
3. **Application-Level vs Storage-Level Immutability:**
   The append-only behavior is enforced purely in application logic within `recordDecision()`. The underlying Forge KVS scope (`storage:app`) permits deletion and mutation. It is not an append-only cryptographic ledger.

---

## 4. Jira Workflow Validator Gate Audit

### 4.1 Configuration & Compatibility
- **Manifest:** [manifest.yml](file:///Users/nomat/Projects/DELTA/manifest.yml#L6-L10) declares:
  ```yaml
  jira:workflowValidator:
    - key: delta-decision-record-validator
      name: DELTA Decision Record Approval Gate
      description: Blocks issue transitions to Dispatched or Resolved unless an approved DELTA Decision Record is linked in Forge KVS.
      function: workflow-validator
  ```
- **Function Key Length:** `workflow-validator` is 18 characters (well within Forge’s 23-character limit).
- **Fail-Closed Architecture:** [workflowValidator.js](file:///Users/nomat/Projects/DELTA/src/resolvers/workflowValidator.js#L75-L87) catches runtime exceptions and returns `{ result: false, errorMessage: '...' }`, preventing unauthorized transitions if KVS is unreachable.

### 4.2 Reality of Workflow Enforcement
- **Crucial Atlassian Platform Limitation:** Declaring a `jira:workflowValidator` in `manifest.yml` and deploying it **does not activate it in any Jira project**.
- In Jira Cloud, a workflow validator only executes if a Jira Administrator opens the Project Workflow Editor, selects a specific workflow transition (e.g. *In Review → Dispatched*), adds the "DELTA Decision Record Approval Gate" validator, and publishes the workflow draft.
- **Testing Reality:** All 6 validator tests in [tests/workflowValidator.test.ts](file:///Users/nomat/Projects/DELTA/tests/workflowValidator.test.ts) invoked JavaScript function exports with mocked event objects. **Zero transitions have been validated in live Jira**.

---

## 5. Jira Service Management (JSM) Field Dispatcher Audit

### 5.1 Request Implementation & Scopes
- **File:** [jsmDispatcher.js](file:///Users/nomat/Projects/DELTA/src/resolvers/jsmDispatcher.js#L140-L165)
- **API Method:** Uses `api.asApp().requestJira(route`/rest/api/3/issue`, ...)` with `write:jira-work` scope.
- **Document Format:** Constructing valid Atlassian Document Format (ADF) with headings, bold metadata, and lists.

### 5.2 Critical Dispatch Defects
1. **Hardcoded Fallback Coordinates:**
   As uncovered in Section 1, fallback text points to $X=233,400, Y=894,200$, 3.7 km away from the actual culvert.
2. **Missing JSM Project Compatibility Check:**
   The code defaults to `project: { key: 'EMERG' }`. If project `EMERG` does not exist on the target Jira site, Jira Cloud returns HTTP 400 Bad Request. The dispatcher does not dynamically inspect available Jira/JSM projects or accept dynamic project configuration.
3. **No Idempotency / Duplicate-Dispatch Protection:**
   `createDispatchTicket()` checks that the Decision Record exists in KVS, but **does not check whether that Decision Record has already been dispatched**. Multiple clicks or network retries will spawn multiple distinct Jira tickets for the same intervention plan.
4. **Live Execution Status:**
   Tests in `tests/jsmDispatcher.test.ts` utilized an in-memory mock client or offline simulation fallback. **Zero real Jira tickets have been created**.

---

## 6. Integration Evidence Classification Matrix

| Integration Component | Implemented in Source | Unit-Tested | Deployed (v2.5.0) | Live-Tested in Jira | Current Operational Status |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Hydraulic Solver (2D Diffusive Wave)** | ✅ Yes | ✅ Yes (20 tests) | ✅ Yes | N/A (Frontend/Canvas) | **Operationally Validated** (Deterministic, mass-conserving) |
| **Projected Catchment Data (EPSG:26986)** | ✅ Yes | ✅ Yes (8 tests) | ✅ Yes | N/A (Data layer) | **Operationally Validated** (Grid alignment confirmed) |
| **Canvas Integration & Overlays** | ✅ Yes | ✅ Yes (6 tests) | ✅ Yes | ⚠️ Dev Server only | **Locally Validated** (Requires live Custom UI iframe smoke test) |
| **Forge KVS Storage Engine** | ✅ Yes | ✅ Yes (6 mock tests) | ✅ Yes | ❌ No | **Code Deployed; Live Storage Unverified** |
| **Immutable Append-Only Records** | ✅ Yes | ✅ Yes (In-memory) | ✅ Yes | ❌ No | **Application-level guard only; Auth missing** |
| **Jira Workflow Validator Gate** | ✅ Yes | ✅ Yes (6 mock tests) | ✅ Yes | ❌ No | **Declared & Deployed; Not bound to Jira workflow** |
| **JSM Field Dispatch Ticket Creator** | ✅ Yes | ✅ Yes (5 mock tests) | ✅ Yes | ❌ No | **Defective coordinates; Duplicate protection missing** |
| **Atlassian Rovo Agent & Actions** | ✅ Yes | ✅ Yes (Resolver tests) | ✅ Yes | ❌ Blocked | **Unavailable** (Tenant Rovo unprovisioned) |

---

## 7. Required Prioritized Fixes

### Priority 1: Geographic Dispatch Coordinate Correction (Immediate)
- Update `jsmDispatcher.js` to extract target location directly from `bostonLongwoodCatchment.json` based on the chosen plan:
  - Plan Beta (Brookline Ave Culvert):
    - Name: `Brookline Avenue Muddy River Culvert Inflow`
    - EPSG:26986: `Easting: 232,302 m, Northing: 899,075 m`
    - WGS84: `42.34150° N, 71.10800° W`
    - Grid Cell: `[Row 17, Col 26]`
- Remove all out-of-domain placeholder strings (`233,400 m`, `894,200 m`).

### Priority 2: Dispatch Idempotency & Duplicate Protection
- In `decisionStorage.js` and `jsmDispatcher.js`, update the Decision Record status to `DISPATCHED` upon ticket creation and record `dispatchedIssueKey`.
- Reject subsequent dispatch calls for the same `decisionId` with `ALREADY_DISPATCHED`.

### Priority 3: Dynamic Jira Project Selection
- Replace hardcoded `'EMERG'` with dynamic resolution from active Jira context or project lookup (`GET /rest/api/3/project/search`).

### Priority 4: Standardize Hydraulic Terminology Across Docs
- Scrub any references to *"2D Saint-Venant"* across all markdown, source comments, and UI headers.
- Standardize on *"2D Mass-Conserving Diffusive-Wave Hydrodynamic Solver"*.

### Priority 5: Human Approver Authentication
- Bind the `humanApprover` identity in `recordDecision` to the active Jira context `context.accountId` via `@forge/bridge` or Forge resolver context.

---

## 8. Manual Jira Verification Test Plan

Before claiming end-to-end integration, the following 4 manual tests must be executed directly on the live Jira site (`nomathembancube2005.atlassian.net`):

1. **Test M-1: Custom UI Page Smoke Test**
   - Navigate to Jira project page → Open DELTA Custom UI.
   - Verify that canvas loads, elevation differentiation displays, and hospital badges align without console errors.
2. **Test M-2: Live KVS Decision Record Persistence**
   - Click "APPROVE PLAN BETA" in the DELTA Custom UI.
   - Verify that resolver successfully executes `kvs.set()` and returns a `DEC-XXXX` record in Forge logs (`forge logs -e development`).
   - Refresh the page and verify that `listDecisions()` retrieves the committed record from live Forge KVS.
3. **Test M-3: Live Jira Workflow Validator Gate**
   - Create a test Jira issue in a test project.
   - In Jira Project Settings → Workflows, edit the active workflow and add `DELTA Decision Record Approval Gate` to the transition to `Done` or `Dispatched`.
   - Attempt to transition the issue without an approved decision record. Confirm that Jira displays the DELTA blocking message.
   - Link the approved `DEC-XXXX` record and re-attempt the transition. Confirm that Jira permits the transition.
4. **Test M-4: Live JSM Dispatch Ticket Creation**
   - From the DELTA UI, trigger field dispatch for the approved decision.
   - Inspect Jira to verify that a real issue is created with correct ADF formatting and exact coordinates (`232,302 m, 899,075 m`).
