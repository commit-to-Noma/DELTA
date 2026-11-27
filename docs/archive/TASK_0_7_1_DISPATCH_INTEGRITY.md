# DELTA — Task 0.7.1: Dispatch Integrity & Idempotency Correction

**Date:** 2026-11-25  
**Status:** Completed & Deployed (v2.6.0)  
**Branch:** `main`  
**Automated Tests:** 67 / 67 passing (15 dedicated dispatch & coordinate tests)

---

## 1. Context & Objectives

During the **Phase 0.6 Operational Integration Audit** (`PHASE_0_6_INTEGRATION_AUDIT.md`), two critical defects were uncovered in DELTA's dispatch pipeline:
1. **Material Spatial Coordinate Distortion:** The JSM field dispatcher emitted placeholder coordinates (`Easting: 233,400 m, Northing: 894,200 m`) lying **3.7 km south and 150 m east outside the computational grid domain**, completely detached from the actual Boston Longwood catchment.
2. **Missing Dispatch Idempotency & Concurrency Protection:** Multiple clicks or network retries could spawn duplicate Jira incident tickets for the same intervention plan, and client-submitted approver identities were trusted without server authentication.

**Task 0.7.1** completely remedies these defects by introducing an authoritative coordinate projection and domain-validation engine, strict dispatch idempotency with concurrent lease locking, and server-side approver authentication.

---

## 2. Technical Implementation Details

### 2.1 Coordinate Integrity Engine (`src/resolvers/coordinates.js`)
A dedicated geospatial module was implemented in [coordinates.js](file:///Users/nomat/Projects/DELTA/src/resolvers/coordinates.js):

- **Zero Hardcoded Fallback Coordinates:** Completely eliminated all synthetic strings (`233,400 m`, `894,200 m`).
- **Authoritative Dataset Derivation:** Locations are strictly derived from the selected intervention plan:
  - **Plan Beta (Culvert Clearing & Pumping):** Resolves to `CULVERT-01-BROOKLINE` (*Brookline Avenue Muddy River Culvert Inflow*):
    - EPSG:26986: $X = 232,302.11\text{ m}$, $Y = 899,074.88\text{ m}$
    - WGS84: $42.34150^\circ\text{ N}, -71.10800^\circ\text{ W}$
    - Grid Cell: `[Row 17, Col 26]`
  - **Plan Alpha (Deployable Flood Barrier):** Resolves to `FAC-01-BWH` (*Francis Street Ambulance Route / BWH*):
    - EPSG:26986: $X = 232,387.58\text{ m}$, $Y = 898,408.81\text{ m}$
    - WGS84: $42.33550^\circ\text{ N}, -71.10700^\circ\text{ W}$
    - Grid Cell: `[Row 43, Col 29]`
  - **No Silent Substitution:** Unrecognized plans without authoritative locations throw a typed error (`MISSING_TARGET_LOCATION`). The Brookline culvert is **never** silently substituted for other interventions.
- **Mathematical Consistency & Bounds Validation:**
  - Forward ($(\text{lat}, \text{lon}) \to (X, Y)$) and inverse ($(X, Y) \to (\text{lat}, \text{lon})$) projections strictly follow Lambert Conformal Conic (2SP) with GRS80 ellipsoid parameters matching EPSG:26986.
  - If both coordinate systems are supplied, Euclidean distance must be $\le 50.0\text{ m}$; discrepancies trigger `COORDINATE_INCONSISTENCY`.
  - Coordinates outside the $1,600\text{ m} \times 1,600\text{ m}$ domain ($X \in [231650, 233250], Y \in [897900, 899500]$) trigger `OUT_OF_BOUNDS_COORDINATES`.

### 2.2 Dispatch Idempotency & Safe State Machine (`src/resolvers/jsmDispatcher.js`)
The dispatcher in [jsmDispatcher.js](file:///Users/nomat/Projects/DELTA/src/resolvers/jsmDispatcher.js) enforces a robust state machine:

1. **Approved Decision Requirement:** Only decisions with `status === 'APPROVED'` can initiate a dispatch. Unapproved or superseded decisions reject with `UNAPPROVED_DECISION_DISPATCH`.
2. **Stable Idempotency Key:** Uses `dispatch-record:${decisionId}:${planId}` stored in Forge KVS.
3. **Duplicate Prevention:** If an issue has already been dispatched for this plan, subsequent dispatch calls return the existing ticket metadata immediately (`isExisting: true`), preventing duplicate Jira ticket creation.
4. **Concurrent Lease Locking:** Before calling the Jira REST API, an `IN_PROGRESS` lease with timestamp is written. Concurrent calls within the 60-second lease window are rejected with `DISPATCH_IN_PROGRESS`.
5. **Jira Failure Cleanup:** If Jira REST API returns an error (e.g. HTTP 400 invalid project), the in-flight lease is deleted so future attempts can succeed once resolved.
6. **Partial Failure Resilience (Jira Success / KVS Failure):** If Jira creates the ticket but KVS fails to persist the index, the dispatcher catches the storage exception, logs a warning, and returns the created ticket key to the caller (`kvsSyncWarning: true`). The ticket is **never** lost, and blind retries are prevented.

### 2.3 Server-Side Identity Verification (`src/resolvers/decisionStorage.js`)
To prevent client-side approver forgery:
- In [decisionStorage.js](file:///Users/nomat/Projects/DELTA/src/resolvers/decisionStorage.js#L112-L130), `recordDecision()` binds `humanApprover.accountId` directly to the server invocation context (`context.accountId`).
- If a client attempts to submit an arbitrary `accountId` differing from the authenticated Jira session, the server throws `APPROVER_IDENTITY_MISMATCH`.
- Dispatch requests without an authenticated caller identity reject with `UNAUTHORIZED_DISPATCH`.

---

## 3. Automated Test Suite Verification

All 67 tests across 6 test suites pass cleanly (`npm test`):

```
 ✓ tests/workflowValidator.test.ts (6 tests)
 ✓ tests/forgeResolver.test.ts (12 tests)
 ✓ tests/jsmDispatcher.test.ts (15 tests)
 ✓ tests/canvasIntegration.test.ts (6 tests)
 ✓ tests/bostonDataset.test.ts (8 tests)
 ✓ tests/hydraulicSolver.test.ts (20 tests)

Test Files  6 passed (6)
     Tests  67 passed (67)
```

### Dedicated Dispatch & Coordinate Tests (`tests/jsmDispatcher.test.ts`):
- `TEST-COORD-01`: Derives exact Brookline Culvert coordinates for Plan Beta ($X: 232302.11, Y: 899074.88$, Cell `[17, 26]`).
- `TEST-COORD-02`: Derives Francis St / BWH coordinates for Plan Alpha ($X: 232387.58, Y: 898408.81$, Cell `[43, 29]`) and confirms no culvert substitution.
- `TEST-COORD-03`: Rejects unrecognized plan without explicit location (`MISSING_TARGET_LOCATION`).
- `TEST-COORD-04`: Rejects out-of-domain coordinates (including the audited defect coordinates $X=233400, Y=894200$).
- `TEST-COORD-05`: Rejects mathematically inconsistent WGS84 and EPSG:26986 coordinates (> 50m drift).
- `TEST-COORD-06`: Automatically forward-projects WGS84 to EPSG:26986 when only WGS84 is provided.
- `TEST-COORD-07`: Automatically inverse-projects EPSG:26986 to WGS84 when only projected is provided.
- `TEST-COORD-08`: Confirms zero synthetic or hardcoded coordinates exist in generated ADF.
- `TEST-IDEMP-01`: Rejects dispatch if Decision Record status is not APPROVED.
- `TEST-IDEMP-02`: Rejects dispatch when caller is anonymous/unauthenticated.
- `TEST-IDEMP-03`: Repeated dispatch returns existing ticket reference without duplicate creation.
- `TEST-IDEMP-04`: Rejects concurrent dispatch while in-flight lease is active.
- `TEST-IDEMP-05`: Cleans up in-progress lease when Jira API call fails.
- `TEST-IDEMP-06`: Preserves Jira ticket and returns `kvsSyncWarning` if KVS write fails after creation.
- `TEST-AUTH-01`: Enforces server-side approver verification during decision recording.

---

## 4. Test Demarcation: Mocked vs. Live Execution

| Component | Tested Logic | Execution Environment | Status |
| :--- | :--- | :--- | :--- |
| **Coordinate Projection** | Forward & inverse Lambert conformal conic equations | Node.js (Vitest) | **Mathematically Verified** |
| **Catchment Bounds** | $1,600\text{ m} \times 1,600\text{ m}$ boundary validation | Node.js (Vitest) | **Empirically Verified** |
| **Idempotency Logic** | In-flight lease locking, state transitions, duplicate prevention | In-memory KVS adapter (Vitest) | **Logic Verified (Mocked Storage)** |
| **Jira REST API v3 Payload** | ADF structure, summary, fields | In-memory Mock Jira client | **Format Verified (Mocked Jira)** |
| **Live Jira Dispatch** | Actual issue creation on `nomathembancube2005.atlassian.net` | Live Jira Cloud Site | **Pending Phase 0.7.5 Live Smoke Test** |
| **Live KVS Persistence** | Real Forge storage reads/writes on AWS DynamoDB backend | Live Forge Development App | **Pending Phase 0.7.3 Live Smoke Test** |

---

## 5. Deployment Status

- **App Version:** `2.6.0` deployed to `development` environment.
- **Compliance:** **Eligible for Runs on Atlassian program**, 0 lint warnings.
- **Installation:** Up-to-date on `nomathembancube2005.atlassian.net` (Jira).
