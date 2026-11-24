# DELTA — Technical Uncertainties Resolution & Solver Specification

> **Status**: Approved Pre-Implementation Technical Blueprint  
> **Target Audience**: Codegeist 2026 Submission Review & Development Team  

---

## 1. Forge & Rovo Integration Validation Status

| Subsystem | Empirical Test Run | Actual Status | Blocker / Requirement |
|---|---|---|---|
| **Forge Manifest (`manifest.yml`)** | `forge lint` (local schema pass) | **Syntax Verified** | Document structure is valid for Node.js 22.x runtime. |
| **Forge Cloud Linting** | `forge lint --verbose` | **Blocked on Auth** | Exit code 1: `Error: Not logged in`. Forge CLI requires an authenticated Atlassian session (`forge login`) to validate scopes against a tenant. |
| **Custom UI Deployment** | Not yet executed | **Pending `forge login`** | Requires `forge deploy` targeting a provisioned development site. |
| **Jira Site Installation** | Not yet executed | **Pending Dev Site** | Requires `forge site provision` or existing developer tenant URL (`forge install`). |
| **Rovo Agent (`delta-incident-agent`)** | Manifest declared | **Pending Deployment** | Declared in `manifest.yml`. Requires deployment to appear in Jira Rovo Chat. |
| **Rovo Actions & Resolvers** | Code written in `src/resolvers/index.ts` | **Code Ready, Untested Live** | Handlers for `getSimulationStatus` and `evaluateInterventions` authored. Live end-to-end invocation awaits cloud deployment. |

### Required Action for User Intervention:
To test the live Forge deployment and Rovo chat integration:
1. Run `forge login` in your terminal with your Atlassian account email and API token ([https://id.atlassian.com/manage/api-tokens](https://id.atlassian.com/manage/api-tokens)).
2. Run `forge site provision` to provision your 90-day free Codegeist developer site.
3. Run `forge install --demo-site`.

---

## 2. Decision Record Architecture & Auditability

### Critical Architectural Principle:
**Forge Storage is NOT inherently immutable or tamper-proof.** It is a standard cloud key-value store. Immutability and audit integrity must be enforced mathematically and procedurally at the application and schema layer.

### Record Schema:
```typescript
export interface DecisionRecord {
  // Identifiers
  recordId: string;               // Format: DEC-<YYYYMMDD>-<UUIDv4>
  sequenceNumber: number;         // Monotonically increasing index (0, 1, 2...)
  previousRecordHash: string;     // SHA-256 hash of the preceding record (cryptographic chain)
  recordHash: string;             // SHA-256 hash of this record's canonical payload

  // Timestamps & Actors
  timestamp: string;              // ISO-8601 UTC timestamp of human authorization
  approver: {
    accountId: string;            // Atlassian Account ID
    displayName: string;
    email: string;
    operationalRole: string;      // e.g. "Incident Commander"
  };

  // Simulation Context
  simulationReference: {
    catchmentId: string;          // e.g. "boston-longwood-muddy-river"
    stormProfileId: string;       // e.g. "noaa-atlas-14-100yr-6hr"
    stormDurationMinutes: number; // 360 min
    peakIntensityMmPerHour: number;
    elevationModelId: string;     // "USGS-3DEP-1M-MUDDY-RIVER"
    solverVersion: string;        // "DELTA-Hydrology-v1.0"
    randomSeed: number;           // For exact numerical reproducibility
  };

  // Scenario Injections Active at Decision Time
  activeDisruptions: Array<{
    assetId: string;              // e.g. "culvert-muddy-outfall-14"
    type: 'CULVERT_BLOCKAGE' | 'ROAD_WASHOUT' | 'PUMP_TRIP';
    capacityReductionPct: number; // 0 to 100%
    injectionTimeMinutes: number;
  }>;

  // Selected Intervention & Justification
  selectedIntervention: {
    planId: string;               // e.g. "INT-02-CANAL"
    planName: string;
    specificActions: Array<{
      actionType: 'CLEAR_DEBRIS' | 'DEPLOY_BARRIER' | 'DEPLOY_PUMP';
      targetAssetId: string;
      parameters: Record<string, unknown>;
    }>;
  };

  // Quantitative Evidence (Calculated Deltas vs. Do-Nothing Baseline)
  evaluatedMetrics: {
    baselinePeakInundationM3: number;
    planPeakInundationM3: number;
    netInundationDeltaM3: number;
    netInundationDeltaPct: number;
    hospitalCorridors: Record<string, {
      corridorName: string;
      baselineImpassableMinutes: number;
      planImpassableMinutes: number;
      peakWaterDepthCm: number;
      status: 'PASSABLE' | 'AT_RISK' | 'IMPASSABLE';
    }>;
  };

  // Assumptions & Attributions
  evidenceAndAssumptions: {
    rainfallSource: string;       // "NOAA Atlas 14 Vol 10 Precipitation Frequency"
    drainageAssumptionNote: string; // "Culvert gravity capacity modeled per Manning's n=0.024"
    inundationThresholdCm: number;// 25.0 cm emergency vehicle limit
  };

  // Operational Dispatch Linkage
  linkedJsmTicket: {
    issueKey: string;             // e.g. "JSM-4902"
    issueId: string;
    dispatchTimestamp: string;
    queueName: string;
  } | null;
}
```

### Storage Implementation & Tamper-Evident Mechanics:
1. **Append-Only Restriction**: The storage adapter exposes `appendRecord(record)`. It checks that `record.sequenceNumber === lastSequenceNumber + 1` and that `record.previousRecordHash === lastRecord.recordHash`.
2. **Rejection of Modification/Deletion**: Any request to modify or delete a key with the `record:DEC-*` prefix returns an explicit `MUTATION_PROHIBITED` error.
3. **Audit Verification Function (`verifyAuditChain()`)**:
   - Iterates through all records in sequence.
   - Computes the canonical SHA-256 hash of each record.
   - Confirms that `recordHash` matches the computed hash.
   - Confirms that `previousRecordHash` matches the preceding record's `recordHash`.
   - If any record was altered, truncated, or removed out-of-band in Forge Storage, `verifyAuditChain()` immediately flags the break and identifies the tampered sequence number.
4. **Sufficiency**: This provides forensic tamper-evidence without external blockchain infrastructure.

---

## 3. Real-World Geography Recommendation: Boston Longwood & Muddy River Catchment

### Why This Catchment:
- **Demonstration Value**: The **Longwood Medical Area (LMA)** is a globally renowned healthcare hub comprising Brigham and Women's Hospital, Boston Children's Hospital, Beth Israel Deaconess, and Harvard Medical School.
- **Physical Flooding Reality**: The adjacent **Muddy River** is a historic flood hazard that severely inundated the Green Line subway and threatened emergency hospital access in October 1996 and March 2010.
- **Scale**: A $1.6\text{ km} \times 1.6\text{ km}$ ($2.56\text{ km}^2$) bounding box captures the Muddy River basin, Fenway culvert constriction, Brookline Avenue, and the Longwood Medical Center.

### Dataset Specifications & Citations:
1. **Topography (Elevation)**:
   - Source: **USGS 3DEP (3D Elevation Program) 1-meter LiDAR Digital Elevation Model (DEM)** via MassGIS.
   - Resolution: 1.0m horizontal, sub-10cm vertical accuracy.
   - Downsampled to 64×64 regular grid ($25\text{ m} \times 25\text{ m}$ per cell).
   - License: Public Domain (US Federal Government).
2. **Roads & Critical Infrastructure**:
   - Source: **OpenStreetMap (OSM)**.
   - Features: Primary/secondary roads (Brookline Ave, Park Dr, Riverway), hospital emergency entrance footprints, bridges, and culvert locations.
   - CRS: Projected into **NAD83 / Massachusetts Mainland (EPSG:26986)** or **WGS 84 / UTM Zone 19N (EPSG:32619)**.
   - License: Open Data Commons Open Database License (ODbL). Attribution: *© OpenStreetMap contributors*.
3. **Precipitation Frequency (Rainfall Evidence)**:
   - Source: **NOAA Atlas 14, Volume 10, Version 3** (Station: Boston, MA, Lat: 42.34°N, Lon: 71.10°W).
   - Documented 100-Year (1% AEP) Storm Depth:
     - 6-hour duration: $122\text{ mm}$ ($4.80\text{ inches}$).
     - Peak 1-hour intensity: $68\text{ mm/hr}$ ($2.68\text{ inches/hr}$).
   - **Data Integrity**: Rainfall is simulated using this published hydrograph. Drainage capacities are explicitly labeled as *modeled assumptions*.

---

## 4. Corrected Mathematical Hydraulic Solver Specification

### A. Domain & Discretization
* **Grid**: 2D regular Cartesian grid of size $N_x \times N_y = 64 \times 64$ cells.
* **Cell Dimensions**: $\Delta x = \Delta y = 25.0\text{ m}$.
* **Cell Surface Area**: $A_c = \Delta x \times \Delta y = 625.0\text{ m}^2$.
* **Total Basin Area**: $A_{\text{total}} = 64 \times 64 \times 625 = 2,560,000\text{ m}^2$ ($2.56\text{ km}^2$).
* **Primary Cell Variables**:
  * $z_{i,j}\text{ [m]}$: Static bed elevation from DEM.
  * $h_{i,j}^t\text{ [m]}$: Water depth in cell $(i,j)$ at time $t$ ($h_{i,j}^t \ge 0$).
  * $\eta_{i,j}^t = z_{i,j} + h_{i,j}^t\text{ [m]}$: Total water surface elevation.
  * $V_{i,j}^t = h_{i,j}^t \cdot A_c\text{ [m}^3\text{]}$: Water volume stored in cell $(i,j)$.

### B. Conservation of Mass (Cell Continuity)
For cell $(i,j)$ over time step $\Delta t$:
$$V_{i,j}^{t+\Delta t} = V_{i,j}^t + \Delta t \left( \sum Q_{\text{in}, i,j}^t - \sum Q_{\text{out}, i,j}^t + Q_{\text{rain}, i,j}^t - Q_{\text{infil}, i,j}^t - Q_{\text{drain}, i,j}^t \right)$$

All terms are rates in $\text{m}^3/\text{s}$, yielding volumes in $\text{m}^3$ when multiplied by $\Delta t$.

### C. Overland Inter-Cell Flux Calculation (2D Diffusive Wave)
Between adjacent cell $k=(i,j)$ and neighbor $m \in \mathcal{N}(k)$ ($N, S, E, W$):
1. **Water Surface Slope**:
   $$S_{k,m} = \frac{\eta_k^t - \eta_m^t}{\Delta x}$$
   Flow occurs only if $\eta_k^t > \eta_m^t$ ($S_{k,m} > 0$). If $\eta_k^t \le \eta_m^t$, $Q_{k \to m}^* = 0$.
2. **Effective Flow Depth**:
   $$h_{\text{flow}} = \max\left(0, \eta_k^t - \max(z_k, z_m)\right)$$
3. **Manning's Flow Rate**:
   $$Q_{k \to m}^* = \frac{\Delta x}{n} \cdot h_{\text{flow}}^{5/3} \cdot \sqrt{S_{k,m}}$$
   where $n$ is Manning's roughness coefficient ($n = 0.020$ for paved asphalt, $n = 0.040$ for vegetative banks).
4. **Non-Negative Depth Flux Limiter**:
   To guarantee $h_{i,j}^{t+\Delta t} \ge 0$ unconditionally:
   $$\alpha_k = \min\left(1, \frac{V_k^t}{\sum_{m} Q_{k \to m}^* \Delta t + \epsilon}\right)$$
   Actual flux: $Q_{k \to m} = \alpha_k \cdot Q_{k \to m}^*$.

### D. Rainfall, Infiltration & Drainage Inflows/Outflows
1. **Rainfall Input**:
   $$Q_{\text{rain}, i,j}^t = \frac{I_{\text{rain}}(t)}{3.6 \times 10^6} \cdot A_c\text{ [m}^3/\text{s]}$$
   where $I_{\text{rain}}(t)$ is the NOAA Atlas 14 hydrograph intensity in $\text{mm/hr}$.
2. **Infiltration**:
   $$Q_{\text{infil}, i,j}^t = \min\left( f_{\text{soil}} \cdot (1 - f_{\text{imp}, i,j}) \cdot A_c, \frac{V_{i,j}^t}{\Delta t} \right)$$
   where $f_{\text{imp}}$ is the impervious surface fraction ($0.85$ for roads, $0.20$ for parks).
3. **Drainage Inlets / Culvert Outfalls**:
   At designated culvert cells $(i_d, j_d)$:
   $$Q_{\text{drain}, i_d, j_d}^t = \min\left( Q_{\text{capacity}} \cdot (1 - \text{blockageRatio}), \frac{V_{i_d, j_d}^t}{\Delta t} \right)$$

### E. Global Water Balance & Conservation Law
At any step $t$, the discrete conservation equation must be satisfied:
$$V_{\text{storage}}(t) = V_{\text{storage}}(0) + V_{\text{rain,cum}}(t) - V_{\text{infil,cum}}(t) - V_{\text{drain,cum}}(t) - V_{\text{boundary,cum}}(t)$$
where:
$$V_{\text{storage}}(t) = \sum_{i=0}^{63}\sum_{j=0}^{63} h_{i,j}^t \cdot A_c$$

**Invariant Test Criterion**:
$$\frac{\left| V_{\text{storage}}(t) - \text{ExpectedVolume}(t) \right|}{\max\left(1.0, V_{\text{rain,cum}}(t)\right)} < 10^{-6}$$

### F. Stability Constraints
* **Time Step**: $\Delta t = 2.0\text{ seconds}$.
* **CFL Criterion Check**:
  $$\text{CFL} = \frac{\sqrt{g \cdot h_{\max}} \cdot \Delta t}{\Delta x} \le 0.5$$
  For $h_{\max} = 1.5\text{ m}$, $\sqrt{9.81 \times 1.5} \approx 3.84\text{ m/s}$. $\text{CFL} = \frac{3.84 \times 2.0}{25.0} = 0.307 < 0.5$ (Unconditionally stable).

---

## 5. Automated Unit Test Suite Requirements

1. **Test 1: Absolute Mass Conservation Invariant**: Run 180 simulation steps with arbitrary rain and zero outfalls; assert total stored water matches integrated rainfall within $10^{-6}$ relative error.
2. **Test 2: Non-Negative Water Depth Guarantee**: Verify that $h_{i,j}^t \ge 0$ for all cells, even under extreme steep gradients.
3. **Test 3: Gravitational Downhill Vector**: Assert that water on an inclined plane flows strictly from higher elevation to lower elevation.
4. **Test 4: Flat Plane Invariant**: Assert that rain falling on a perfectly horizontal, impermeable plane accumulates uniformly with zero lateral flux.
5. **Test 5: Deterministic Reproducibility**: Verify that identical random seeds and storm inputs produce bit-identical elevation and depth arrays.
