# DELTA — Task 0.7.3.1 Remediation Report: Architectural Remediation

**Remediation Baseline**: Commit `0fb566d`  
**Execution Context**: Strict pause maintained. Code and unit/integration tests only. Zero deployments, zero live KVS writes, zero Jira ticket modifications, zero workflow validator bindings, immutable dispatch killswitch active.  
**Test Suite Verification**: **100 / 100 tests passing** across 7 test files.  
**Build & Lint Verification**: `npm run build` clean (zero TypeScript errors); `forge lint` reported **No issues found**.

---

## 1. Summary of Remediated Defects

| Work Item | Defect Identified | Remediation Implemented | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **A. Simulation Persistence Security** | `saveSimulationRun` lacked payload schema validation, bounds checks, size limits, and caller authorization. | Implemented `validateSimulationRunPayload` in `src/resolvers/simulationValidation.js` validating types, ranges (elapsed time 0–86,400s, max depth 0–50m, non-negative volumes), and 64 KB payload size limit. Enforced server-side caller session authentication in `src/resolvers/index.js` (fails closed on unauthenticated or anonymous callers). | `TEST-SEC-01`, `TEST-SEC-02`, `TEST-SEC-03`, `TEST-SEC-04`, `TEST-SEC-05` |
| **B. Scenario Integrity** | `summary` lacked canonical scenario identity and relied on unverified client payloads without server hashing. | Implemented `computeCanonicalScenarioHash` in `src/resolvers/simulationValidation.js` calculating deterministic SHA-256 hashes from canonical scenario keys. Server validates client-supplied hash if present, rejecting mismatches with `SCENARIO_HASH_MISMATCH`, and binds server-computed hash and `canonicalScenario` to the stored record. | `TEST-INT-01`, `TEST-INT-02`, `TEST-INT-03` |
| **C. Record Staleness & Malformed Guards** | Empty `{}` or partial records returned as `COMPLETED_RUN`; no staleness policy or TTL check. | Hardened `getSimulationStatus` in `src/resolvers/index.js` with structured status enumeration: `NO_RUN` (absent), `MALFORMED_RUN` (empty/partial), `STALE_RUN` (> 24h old with `ageHours`), and `COMPLETED_RUN` (fresh). | `TEST-STALE-01`, `TEST-STALE-02`, `TEST-STALE-03`, `TEST-STALE-04` |
| **D. Dormant Intervention Resolver** | `saveInterventionsEvaluation` was an orphan resolver without clear operational status. | Marked `saveInterventionsEvaluation` explicitly dormant, returning `{ success: false, status: 'DORMANT_NEEDS_PHASE_3' }`. `evaluateInterventions` returns `{ status: 'NO_RUN' }` without invented numbers. | `TEST-RESOLV-01`, `TEST-RESOLV-02` |
| **E. Satellite Georeferencing & Lifecycle** | Bundled imagery had ~100m–160m spatial registration error; `img.onload` mutated ref without triggering React canvas redraw. | Re-exported `public/usgs_satellite_still.png` natively in EPSG:26986 Massachusetts Mainland bounds ($X: [231650, 233250], Y: [897900, 899500]$), establishing exact 1:1 cell-to-pixel alignment. Documented in `public/USGS_SATELLITE_PROVENANCE.md`. Switched canvas to `useState<HTMLImageElement | null>` triggering immediate redraw on load. | `TEST-GEO-01`, `USGS_SATELLITE_PROVENANCE.md`, `GeographicSimulationCanvas.tsx` |
| **F. Offline Messaging Accuracy** | UI reported `'SAVED LOCALLY (OFFLINE)'` without actual local persistence. | Updated `handleSaveRunTelemetry` in `src/components/shell/views/FloodSimulationView.tsx` to report `'SAVED TO FORGE KVS'`, `'SAVE FAILED (<reason>)'`, or `'BRIDGE UNAVAILABLE (NOT PERSISTED)'`. | `FloodSimulationView.tsx` |

---

## 2. Detailed Technical Implementation

### 2.1 Simulation Persistence Security & Canonical Hashing (`src/resolvers/simulationValidation.js`)
A dedicated module was added to isolate telemetry validation, scenario hashing, and record integrity:
- **`MAX_SIMULATION_PAYLOAD_BYTES`**: 65,536 bytes (64 KB) maximum serialized JSON size guard.
- **`DEFAULT_STALENESS_THRESHOLD_MS`**: 24 hours ($86,400,000\text{ ms}$).
- **`computeCanonicalScenarioHash(inputs)`**: Deterministically sorts scenario keys (`cellResolutionM`, `durationHours`, `gridDimensions`, `infiltrationRateMmPerHour`, `manningN`, `sector`, `stormDepthMm`, `stormId`), serializes to canonical JSON, and hashes with SHA-256 (`sha256:...`).
- **`validateSimulationRunPayload(payload)`**: Asserts non-null object, checks size bounds, verifies required sector, stormId, numeric bounds ($0 \le t \le 86400$, $0 \le d \le 50\text{ m}$, $V \ge 0$), and facilities array limit ($\le 100$).
- **`validateSimulationRecordIntegrity(record)`**: Ensures retrieved KVS record contains all mandatory fields (`stormId`, `elapsedSimulationSeconds`, `maxWaterDepthM`, `totalWaterVolumeM3`, `savedAt`, `scenarioHash`).

### 2.2 Resolver Layer Hardening (`src/resolvers/index.js`)
- **`saveSimulationRun`**:
  1. Verifies caller identity: extracts `serverAccountId` from invocation context. In production, unauthenticated or anonymous calls reject with `UNAUTHENTICATED_SESSION`. (Distinguishes user read/write from Incident Commander approval authority).
  2. Runs `validateSimulationRunPayload(summary)`.
  3. Computes server-side canonical scenario hash. Rejects client-supplied hash mismatch with `SCENARIO_HASH_MISMATCH`.
  4. Stores record with `scenarioHash`, `canonicalScenario`, `savedByAccountId`, `savedAt`, and `schemaVersion: '1.1.0'`.
- **`getSimulationStatus`**:
  1. If record is absent: returns `{ success: true, status: 'NO_RUN' }`.
  2. If record fails integrity (e.g. `{}`): returns `{ success: true, status: 'MALFORMED_RUN' }`.
  3. If record is older than threshold: returns `{ success: true, status: 'STALE_RUN', ageHours, savedAt, data: run }`.
  4. If record is fresh: returns `{ success: true, status: 'COMPLETED_RUN', ageHours, data: run }`.
- **`saveInterventionsEvaluation`**:
  - Explicitly dormant: returns `{ success: false, status: 'DORMANT_NEEDS_PHASE_3' }`.

### 2.3 Satellite Georeferencing & Provenance
- Re-downloaded `public/usgs_satellite_still.png` via USGS The National Map Imagery Only export service using native projected bounding parameters:
  `bbox=231650.0,897900.0,233250.0,899500.0&bboxSR=26986&imageSR=26986&size=1024,1024&format=png&f=image`
- Created `public/USGS_SATELLITE_PROVENANCE.md` detailing endpoint, date, CRS (EPSG:26986), derived WGS84 coordinates ($42.330950^\circ\text{ N}, -71.115978^\circ\text{ W}$ to $42.345287^\circ\text{ N}, -71.096473^\circ\text{ W}$), 1.5625m/pixel resolution, and U.S. Government Public Domain license.
- Refactored `GeographicSimulationCanvas.tsx` to store `satelliteImage` in React state (`useState<HTMLImageElement | null>`), added to canvas draw dependency array, ensuring instant render upon load.

### 2.4 Offline Messaging Accuracy
In `src/components/shell/views/FloodSimulationView.tsx`:
- Removed inaccurate `'SAVED LOCALLY (OFFLINE)'` claim.
- Replaced with:
  - Success: `'SAVED TO FORGE KVS'`
  - Bridge error / Local preview: `'BRIDGE UNAVAILABLE (NOT PERSISTED)'`
  - Rejection: `'SAVE FAILED (<reason>)'`

---

## 3. Regression Test Suite Results

Test command: `npm test`  
All 7 test suites passed cleanly in 1.42s:

1. `tests/workflowValidator.test.ts` (6 tests) — PASS
2. `tests/forgeResolver.test.ts` (12 tests) — PASS
3. `tests/architecturalRemediation.test.ts` (15 tests) — PASS
4. `tests/canvasIntegration.test.ts` (6 tests) — PASS
5. `tests/jsmDispatcher.test.ts` (33 tests) — PASS
6. `tests/bostonDataset.test.ts` (8 tests) — PASS
7. `tests/hydraulicSolver.test.ts` (20 tests) — PASS

**Total: 100 / 100 tests passing.**

---

## 4. Build and Lint Verification

- **TypeScript & Vite Build**: `tsc -b && vite build` passed cleanly in 3.00s.
- **Forge Lint**: `PATH="/Users/nomat/.node22/bin:$PATH" forge lint` reported **No issues found**.

---

## 5. Residual Risks & Limitations

1. **Non-Atomic KVS Overwrites**:
   - `saveSimulationRun` writes to `simulation:latest-run`. While caller authentication and payload validation prevent corrupt or unauthorized data, simultaneous simulation saves from two browser sessions would result in a last-write-wins outcome. This is appropriate for an ephemeral telemetry cache, but distinct from append-only Decision Records.
2. **Deployed Cloud Discrepancy**:
   - The deployed version 2.8.0 on Atlassian Cloud remains frozen and out of sync with commits `0fb566d` and the current remediation commit. It should only be updated once authorized for deployment.
3. **Phase 2 & Phase 3 Dependencies**:
   - Multi-scenario intervention comparisons remain dormant until Phase 2 (disruption/replanning) and Phase 3 (multi-scenario differential solver) are implemented.
