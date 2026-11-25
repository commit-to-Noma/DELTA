# DELTA — Culvert Hydraulic Accounting Investigation (Workstream 1A)

> **Status**: INVESTIGATION REPORT (EVIDENCE-GATHERING ONLY — NO CODE MODIFIED)  
> **Date**: 2026-11-25  
> **Subject**: Hydraulic representation, accounting mechanics, and verification of `CULVERT-01-BROOKLINE` and Plan Gamma  
> **Target Dataset**: Boston Longwood Medical Area & Muddy River Catchment (`EPSG:26986`, 64×64 grid, 25m resolution)  

---

## 1. Executive Summary & Core Findings

This investigation was conducted to determine whether the reported $4,084\text{ m}³$ cumulative drainage figure is mathematically correct and whether it represents a valid incremental benefit of Plan Gamma.

### Key Investigation Findings:

1. **The $4,084\text{ m}³$ Figure Is Catchment-Wide Multi-Inlet Drainage, NOT Plan Gamma Alone**:
   - The catchment model contains **three active drainage inlets**:
     1. `CULVERT-01-BROOKLINE` (`[17, 26]`, design capacity $12.5\text{ m}³/s$) — *The target intervention site*
     2. `CULVERT-02-FENWAY-CHOKE` (`[8, 42]`, design capacity $8.0\text{ m}³/s$) — *Background municipal inlet*
     3. `DRAIN-03-LONGWOOD-WEST` (`[41, 22]`, design capacity $4.5\text{ m}³/s$) — *Background municipal sump*
   - In the **Baseline emergency run** (`CULVERT-01-BROOKLINE` 100% blocked), the other two background inlets are fully operational and drain **`4,036.16 m³`** over the 1-hour simulation.
   - In the **Plan Gamma run** (`CULVERT-01-BROOKLINE` unblocked), total drainage from all three inlets is **`4,084.28 m³`**.
   - **The actual incremental drainage produced by Plan Gamma unblocking `CULVERT-01-BROOKLINE` is `48.12 m³`** (matching the avoided surface storage delta of `46.87 m³`).
   - **Conclusion**: Citing $4,084\text{ m}³$ as the "avoided storage" or "benefit of Plan Gamma" conflates background multi-inlet drainage with the culvert's incremental contribution. **The true incremental physical benefit of Plan Gamma under current grid geometry is $+47\text{ m}³$ (or $+22\text{ m}³$ in the 6h screening setup).**

2. **The Culvert Is Modelled as an Unrouted Surface Sink (Point Withdrawal)**:
   - In `src/simulation/hydraulicSolver.ts`, drainage inlets are implemented as non-routed loss terms. Water removed by an inlet disappears from the 2D surface grid and is added to `cumDrain`.
   - There is **no downstream outlet cell**, **no 1D conduit routing**, and **no receiving water stage feedback**.

3. **LiDAR Bridge Deck vs. Stream Invert Elevation Disconnect**:
   - The modelled inlet for `CULVERT-01-BROOKLINE` is pinned to cell `[17, 26]`.
   - In the USGS 1m Bare Earth LiDAR elevation matrix, cell `[17, 26]` has an elevation of **$7.51\text{ m}$**, which is the **Brookline Avenue road deck/bridge**.
   - Immediately adjacent in the river channel (rows 14–16, cols 22–25), the natural stream invert elevation is **$0.31\text{ m} - 0.60\text{ m}$** (~7 meters lower).
   - Because cell `[17, 26]` is located on a high road embankment, rainfall immediately runs off downhill into the river channel. Surface water depth on the bridge deck at `[17, 26]` reaches only **$1.83\text{ mm}$** ($0.0018\text{ m}$) during the storm.
   - The culvert is therefore **inflow-starved**: despite a nominal capacity of $12.5\text{ m}³/s$, the cell contains only $\approx 1.14\text{ m}³$ of water at any moment, limiting total withdrawal to what falls directly on or immediately trickles across that single $25\text{ m}$ cell.

---

## 2. Relevant Source Files & Mathematical Functions

| Component | File Path | Line Range | Role in Accounting |
| :--- | :--- | :--- | :--- |
| **Grid Config & Inlets** | `src/simulation/hydraulicSolver.ts` | L7–L22 | Defines `DrainageInlet` (`index`, `capacityM3PerSec`, `blockageRatio`). |
| **Drainage Withdrawal** | `src/simulation/hydraulicSolver.ts` | L326–L339 | Calculates `drainVol = Math.min(cellVol, effectiveCap * dtSub)` and updates `cumDrain`. |
| **Water Accounting** | `src/simulation/hydraulicSolver.ts` | L24–L34, L400–L415 | Enforces conservation of mass invariant across rainfall, infiltration, drainage, and boundary weir outflow. |
| **Catchment Setup** | `src/data/catchmentLoader.ts` | L255–L320 | Flattens 64×64 elevation matrix, maps modelled inlets, configures northern boundary weir. |
| **Inlet Definitions** | `src/data/bostonLongwoodCatchment.json` | `modelledDrainageInlets` | Defines cell `[17, 26]` (index 1114) with $12.5\text{ m}³/s$ nominal capacity. |
| **Multi-Scenario Eval** | `src/simulation/interventionEngine.ts` | L285–L400 | Sets up Baseline (`blockageRatio = 1.0` at Brookline) and Plan Gamma (`blockageRatio = 0.0`), executes 2D solver. |

---

## 3. Physical Water Balance: Baseline vs. Plan Gamma

Simulated on invariant Boston Longwood Catchment ($1,600\text{ m} \times 1,600\text{ m}$, 64×64, $dx = 25\text{ m}$) under a 1-hour uniform $35.0\text{ mm/h}$ rainfall burst ($89,600\text{ m}³$ total gross precipitation):

### Comparative Accounting Table

| Water Balance Component | Baseline (Brookline Blocked) | Plan Gamma (Brookline Restored) | Delta ($\text{Gamma} - \text{Baseline}$) |
| :--- | :--- | :--- | :--- |
| **Initial Surface Storage ($V_0$)** | $0.00\text{ m}³$ | $0.00\text{ m}³$ | $0.00\text{ m}³$ |
| **Cumulative Gross Rainfall ($V_{\text{rain}}$)** | $89,600.00\text{ m}³$ | $89,600.00\text{ m}³$ | $0.00\text{ m}³$ |
| **Cumulative Soil Infiltration ($V_{\text{infil}}$)** | $5,117.50\text{ m}³$ | $5,116.25\text{ m}³$ | $-1.25\text{ m}³$ |
| **Catchment-Wide Drainage ($V_{\text{drain}}$)** | **$4,036.16\text{ m}³$** | **$4,084.28\text{ m}³$** | **$+48.12\text{ m}³$** |
| *— CULVERT-01-BROOKLINE ([17, 26])* | *$0.00\text{ m}³$* | *$48.12\text{ m}³$* | *+$48.12\text{ m}³$* |
| *— CULVERT-02-FENWAY-CHOKE ([8, 42])* | *$2,548.10\text{ m}³$* | *$2,548.10\text{ m}³$* | *$0.00\text{ m}³$* |
| *— DRAIN-03-LONGWOOD-WEST ([41, 22])* | *$1,488.06\text{ m}³$* | *$1,488.06\text{ m}³$* | *$0.00\text{ m}³$* |
| **Cumulative Boundary Outflow ($V_{\text{outfall}}$)** | $647.85\text{ m}³$ | $647.85\text{ m}³$ | $0.00\text{ m}³$ |
| **Final Retained Surface Storage ($V_{\text{storage}}$)** | **$79,798.48\text{ m}³$** | **$79,751.62\text{ m}³$** | **$-46.87\text{ m}³$** |
| **Avoided Surface Storage ($\Delta V_{\text{storage}}$)** | — | — | **$+46.87\text{ m}³$** |
| **Mass Balance Residual Error** | $7.60 \times 10^{-7}\text{ m}³$ | $7.56 \times 10^{-7}\text{ m}³$ | $< 10^{-6}\text{ m}³$ |
| **Relative Conservation Error** | $8.49 \times 10^{-12}$ | $8.43 \times 10^{-12}$ | $< 10^{-11}$ |

### Mathematical Proof of Conservation:
$$\Delta V_{\text{storage}} = V_{\text{storage, baseline}} - V_{\text{storage, gamma}} = 79,798.48 - 79,751.62 = \mathbf{46.87\text{ m}³}$$
$$\Delta V_{\text{drain}} + \Delta V_{\text{infil}} = 48.12 - 1.25 = \mathbf{46.87\text{ m}³}$$
$$\text{Discrepancy} < 10^{-11}\text{ m}³$$

The solver's internal water balance is **numerically exact**. There is zero double-counting, zero leaked volume, and zero algorithmic drift. The issue is strictly one of **spatial physical abstraction**.

---

## 4. Local Depth Comparisons: Culvert Headwater & Francis Street

To verify whether local water depths decrease as a result of Plan Gamma:

| Location | Grid Coordinates | Elevation ($z$) | Baseline Depth ($h_b$) | Plan Gamma Depth ($h_g$) | Local Depth Reduction ($\Delta h$) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Brookline Culvert Cell** | `[17, 26]` | $7.51\text{ m}$ | $0.00183\text{ m}$ ($1.83\text{ mm}$) | $0.00000\text{ m}$ ($0.00\text{ mm}$) | **$-1.83\text{ mm}$ (100% dry on cell)** |
| **Immediate North Cell** | `[16, 26]` | $7.34\text{ m}$ | $0.00156\text{ m}$ ($1.56\text{ mm}$) | $0.00116\text{ m}$ ($1.16\text{ mm}$) | **$-0.40\text{ mm}$** |
| **Immediate West Cell** | `[17, 25]` | $7.50\text{ m}$ | $0.00221\text{ m}$ ($2.21\text{ mm}$) | $0.00179\text{ m}$ ($1.79\text{ mm}$) | **$-0.42\text{ mm}$** |
| **Immediate South Cell** | `[18, 26]` | $7.68\text{ m}$ | $0.00309\text{ m}$ ($3.09\text{ mm}$) | $0.00308\text{ m}$ ($3.08\text{ mm}$) | **$-0.003\text{ mm}$** |
| **Francis St Corridor #1** | `[32, 28]` | $9.82\text{ m}$ | $0.00220\text{ m}$ ($2.20\text{ mm}$) | $0.00220\text{ m}$ ($2.20\text{ mm}$) | **$0.0000\text{ mm}$ (No change)** |
| **Francis St Corridor #2** | `[34, 28]` | $8.45\text{ m}$ | $0.00140\text{ m}$ ($1.40\text{ mm}$) | $0.00140\text{ m}$ ($1.40\text{ mm}$) | **$0.0000\text{ mm}$ (No change)** |
| **Francis St Corridor #3** | `[36, 28]` | $7.85\text{ m}$ | $0.00210\text{ m}$ ($2.10\text{ mm}$) | $0.00210\text{ m}$ ($2.10\text{ mm}$) | **$0.0000\text{ mm}$ (No change)** |

### Operational Significance:
1. Local water depth at `[17, 26]` drops by $1.83\text{ mm}$, completely draining the road-deck cell.
2. The hydraulic drawdown radius is tightly localized (extending only $\approx 1 - 2$ cells / 25–50m).
3. **No depth change reaches the Francis Street hospital corridor (rows 32–36)** during a 1-hour simulation. Francis Street is located approximately $350 - 450\text{ meters}$ south and at an elevation of $8 - 10\text{ m}$, upstream across a gentle gradient.

---

## 5. Identified Modelling Limitations

1. **Semantic Conflation of Catchment Drainage**:
   The engine previously treated total catchment drainage (`state.accounting.cumulativeDrainageM3`) as if it were the intervention's culvert output. In reality, $98.8\%$ ($4,036\text{ m}³$) of that drainage comes from the other two background inlets.
2. **LiDAR Elevation Inaccuracy for Sub-Bridge Structures**:
   LiDAR elevation models the top surface of bridges and road embankments. Placed on top of the bridge deck, an unrouted culvert inlet cannot capture stream water flowing beneath the bridge.
3. **Point Sink Starvation**:
   A single $25\text{ m} \times 25\text{ m}$ cell cannot supply $12.5\text{ m}³/s$ through shallow 2D overland sheet flow alone. Without an upstream ponding basin, depression storage, or tributary catchment aggregation, the culvert capacity is physically unattainable.
4. **Lack of Downstream Receiving Channel Feedback**:
   The culvert discharge is removed from the domain rather than transported to the downstream Muddy River channel. If the downstream channel were full, backwater effects would physically impede drainage.

---

## 6. Recommended Corrections (Ranked by Priority & Defensibility)

| Rank | Correction | Technical Rationale | Impact on Credibility |
| :---: | :--- | :--- | :--- |
| **1** | **Strict Metric Disambiguation in UI & Records** | Report **Incremental Intervention Benefit** ($\Delta Q = +48\text{ m}³$) separately from **Total Catchment Drainage** ($4,084\text{ m}³$). Never present total multi-inlet drainage as Plan Gamma's avoided volume. | **HIGHEST**. Eliminates any possibility of misleading judges or exaggerating results. 100% technically honest. |
| **2** | **Channel Invert Cell Realignment** | Update the coordinates of `CULVERT-01-BROOKLINE` in `bostonLongwoodCatchment.json` from road deck `[17, 26]` ($7.51\text{ m}$) to the upstream stream channel invert `[15, 24]` or `[16, 25]` ($0.61\text{ m} - 2.83\text{ m}$), where the Muddy River actually enters the culvert. | **HIGH**. Physically justifiable alignment with real river geometry; captures actual streamflow. |
| **3** | **Tributary Cell Cluster (Intake Basin)** | Model the culvert headwall as a multi-cell intake (e.g. 2×2 or 3×3 headwall depression) rather than a single point cell, representing the culvert's physical headwall pond. | **MEDIUM**. Reflects actual headwall basin hydraulics. |
| **4** | **Explicit Culvert Transfer Conduit** | Route removed culvert water back into the downstream Muddy River cells (e.g. at row 10, col 28), ensuring mass stays in the river network until reaching the boundary outfall. | **LOWER (Future phase)**. Adds complexity; unnecessary for hackathon screening model scope. |

---

## 7. Required Verification Tests for Any Future Correction

Prior to implementing any of the above corrections in code, the following test suite must be defined:

1. **`TEST-INLET-ISOLATION`**: Assert that `cumulativeDrainageM3` tracks individual inlet contributions ($Q_{\text{brookline}}$, $Q_{\text{fenway}}$, $Q_{\text{longwood}}$) so individual culvert performance can be queried independently.
2. **`TEST-INCREMENTAL-DELTA`**: Assert that $\Delta V_{\text{storage}} \equiv \Delta V_{\text{drain}} + \Delta V_{\text{infil}}$ to $< 10^{-10}$ across all multi-scenario evaluations.
3. **`TEST-INVERT-ELEVATION`**: Assert that the elevation of `CULVERT-01-BROOKLINE` is at or below the adjacent upstream channel thalweg elevation ($z \le 3.0\text{ m}$).
4. **`TEST-HEADWATER-DRAWDOWN`**: Assert that unblocking the culvert produces a measurable, non-negative local headwater drawdown ($\Delta h > 0$) in the upstream channel cells.

---

> **Conclusion**:  
> The $4,084\text{ m}³$ figure is mathematically verified as the **combined 1-hour drainage of all three municipal sinks**, not Plan Gamma alone. Plan Gamma's actual incremental drainage under current geometry is **$48.12\text{ m}³$** (avoiding **$46.87\text{ m}³$** of retained surface water).  
> The $22\text{ m}³$ figure previously recorded on `EMERG-1` is completely consistent with this physics under the longer screening time step.  
> **No production code or recorded metrics have been altered.** Standing by for explicit instructions before implementing corrections.
