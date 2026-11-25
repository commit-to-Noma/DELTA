# DELTA — Brookline Culvert Hydraulic Formulation Review (Workstream 1D)

> **Document Type**: Scientific & Hydraulic Engineering Formulation Review  
> **Status**: COMPLETED METHODOLOGY SPECIFICATION (INVESTIGATION ONLY — NO CODE MODIFIED)  
> **Date**: 2026-11-25  
> **Target Subsystem**: `CULVERT-01-BROOKLINE` (Coupled 1D/2D Culvert Link Formulation)  
> **Authoritative References**:  
> - FHWA Hydraulic Design Series Number 5 (HDS-5): *Hydraulic Design of Highway Culverts* (Third Edition, 2012)  
> - USACE EM 1110-2-1602: *Hydraulic Design of Reservoir Outlets and Culvert Conduits*  
> - USACE New England District: *Muddy River Flood Risk Management Project (Phase 1 As-Built Notices)*  
> - CIRIA C689: *Culvert Design and Operation Guide*  

---

## 1. Executive Summary & Purpose

This review addresses the technical limitations identified in the Workstream 1C parameterisation report. Specifically, it establishes:

1. **A rigorous, recognized culvert hydraulic formulation** based on Federal Highway Administration (FHWA HDS-5) and USACE methods, separating inlet control from outlet control and handling tailwater submergence.
2. **A formal parameter provenance taxonomy** that rigorously separates verified source facts from derived calculations and screening assumptions.
3. **A physically defensible blockage formulation** based on entrance contraction and head loss mechanics.
4. **The conditions under which a simplified coupled-link model is scientifically defensible** within a 25-meter grid screening model.

---

## 2. Rigorous Parameter Classification Taxonomy

To ensure absolute engineering credibility and prevent unverified assumptions from being presented as as-built facts, all model parameters are formally classified into three provenance categories:

### Provenance Classification Table

| Parameter | Provenance Level | Value / Range | Basis & Data Source | Limitations & Assumptions |
| :--- | :---: | :--- | :--- | :--- |
| **Structure Type** | **VERIFIED** | Reinforced Precast Concrete Box Culvert | USACE New England District Muddy River Phase 1 contract and public notices. | Replaced legacy twin 72-inch corrugated pipes. |
| **Height ($D$)** | **VERIFIED** | $10\text{ ft}$ ($3.05\text{ m}$) | USACE Phase 1 project documents; MMOC oversight reports. | Interior vertical rise. |
| **Width ($W$)** | **VERIFIED** | $24\text{ ft}$ ($7.32\text{ m}$) | USACE Phase 1 project documents; MMOC oversight reports. | Interior horizontal span. |
| **Cross-Section Area ($A$)** | **DERIVED** | $22.33\text{ m}²$ | Computed: $3.05\text{ m} \times 7.32\text{ m}$. | Exact geometric product of verified $H$ and $W$. |
| **Macro Flow Path** | **VERIFIED** | Riverway $\to$ Daylighted Channel $\to$ Brookline Ave $\to$ Upper Fens Pond | USACE environmental filings, OSM hydrography. | General direction confirmed south-to-north. |
| **Barrel Length ($L$)** | **DERIVED APPROXIMATION** | $\approx 35\text{ m}$ (range: $30 - 45\text{ m}$) | Inferred from OpenStreetMap roadway right-of-way width of Brookline Avenue. | **Not verified as-built.** Plan and profile contract sheets are not public open data. |
| **Inlet Portal Cell** | **DISCRETIZATION APPROXIMATION** | `[15, 24]` ($25\text{ m}$ cell) | Best intersecting 25m cell in DEM channel thalweg south of road embankment. | Represents a $625\text{ m}²$ discrete footprint, not a sub-meter point coordinate. |
| **Outlet Portal Cell** | **DISCRETIZATION APPROXIMATION** | `[14, 25]` ($25\text{ m}$ cell) | Best intersecting 25m cell in daylighted channel north of road embankment. | Spatial discretization artifact. |
| **Invert Levels ($z_{\text{inv,in}}, z_{\text{inv,out}}$)** | **UNVERIFIED SCREENING ASSUMPTION** | Approximated as DEM channel elevations ($0.61\text{ m}, 0.59\text{ m}$) | USGS 1m LiDAR downsampled to 25m bare-earth DEM. | **AS-BUILT INVERT UNKNOWN.** DEM represents surface mud/water, not buried culvert floor. |
| **Barrel Roughness ($n$)** | **LITERATURE STANDARD** | $n = 0.013\text{ s}\cdot\text{m}^{-1/3}$ | Literature standard for smooth precast concrete box culverts (Chow, 1959; FHWA HDS-5). | Standard hydraulic engineering convention. |
| **Entrance Loss ($K_e$)** | **LITERATURE STANDARD** | $K_e = 0.5$ | FHWA HDS-5 Table A.1 for square-edged headwalls with 30° to 75° wingwalls. | Standard convention. |
| **Nominal Capacity ($12.5\text{ m}³/s$)** | **SCREENING HEURISTIC** | $12.5\text{ m}³/s$ | Corresponds to unsubmerged weir entrance flow under $h_{\text{headwater}} \approx 1.0\text{ m}$. | **NOT a fixed constant.** Real discharge varies dynamically with headwater and tailwater. |
| **Blockage Physics ($\beta$)** | **SCREENING ABSTRACTION** | $\beta \in [0.0, 1.0]$ | Parameterized fractional reduction in effective entrance area. | Debris geometry varies in practice; standard planning model representation. |

---

## 3. Recognized Culvert Hydraulics: FHWA HDS-5 Governing Regimes

In standard civil engineering hydraulics (FHWA HDS-5 / USACE EM 1110-2-1602), flow through a culvert is governed at any instant by the **minimum** of inlet control and outlet control:
$$Q = \min\left(Q_{\text{inlet\_control}}, Q_{\text{outlet\_control}}\right)$$

### 3.1 Inlet Control Formulation
Inlet control occurs when the entrance geometry restricts discharge while the barrel is capable of conveying more flow. Tailwater does not submerge the inlet.

1. **Unsubmerged Flow ($HW \le 1.2 D = 3.66\text{ m}$)**:
   The entrance behaves as a broad-crested weir. Under standard FHWA HDS-5 Form 1 weir formulation:
   $$Q_{\text{in,unsub}} = C_w \cdot W_{\text{eff}} \cdot h_{\text{in}}^{3/2}$$
   where:
   - $W_{\text{eff}} = W \cdot (1 - \beta) = 7.32 \cdot (1 - \beta)\text{ m}$
   - $C_w \approx 1.70\text{ m}^{1/2}/\text{s}$ (broad-crested concrete entrance)
   - $h_{\text{in}} = \max(0, \eta_{\text{in}} - z_{\text{inv,in}})$

2. **Submerged Flow ($HW > 1.2 D = 3.66\text{ m}$)**:
   When headwater submerges the top of the 10-foot box, the entrance transitions to orifice flow:
   $$Q_{\text{in,sub}} = C_d \cdot A_{\text{eff}} \cdot \sqrt{2g \left(h_{\text{in}} - \frac{D}{2}\right)}$$
   where $C_d \approx 0.62$ and $A_{\text{eff}} = A \cdot (1 - \beta) = 22.33 \cdot (1 - \beta)\text{ m}²$.

### 3.2 Outlet Control Formulation
Outlet control occurs when barrel friction, culvert length, or downstream tailwater submergence governs discharge.

From the total energy equation:
$$\eta_{\text{in}} - \eta_{\text{out}} = H_L = h_{\text{entrance}} + h_{\text{friction}} + h_{\text{exit}}$$
$$H_L = \left(K_e + \frac{29.16 \cdot n^2 \cdot L}{R^{4/3}} + 1.0\right) \frac{V^2}{2g}$$

Solving for velocity $V$ and discharge $Q$:
$$Q_{\text{out\_control}} = A_{\text{eff}} \cdot \sqrt{\frac{2g \cdot |\eta_{\text{in}} - \eta_{\text{out}}|}{1.0 + K_e(\beta) + \frac{29.16 \cdot n^2 \cdot L}{R^{4/3}}}}$$
where:
- $L \approx 35.4\text{ m}$ (barrel length across roadway right-of-way)
- $R = \frac{A}{P} = \frac{22.33\text{ m}²}{20.74\text{ m}} = 1.077\text{ m}$ (hydraulic radius flowing full)
- $K_e(\beta) = 0.5 + K_{\text{debris}}(\beta)$

---

## 4. Reverse Flow, Tailwater Submergence & Numerical Stability

A robust coupled-link model between cell $i$ (inlet `[15, 24]`) and cell $j$ (outlet `[14, 25]`) must handle water surface elevation gradients cleanly without numerical chattering or abrupt cut-offs:

### 4.1 Directional Gradient & Reverse Flow
Let $\Delta \eta = \eta_i - \eta_j = (z_i + h_i) - (z_j + h_j)$.

1. **Normal Flow ($\Delta \eta > 0$)**:
   Water flows gravitationally from south to north ($i \to j$). The donor cell is $i$.
2. **Reverse Flow ($\Delta \eta < 0$)**:
   If a flash surge or downstream obstruction raises the daylighted Fenway water level higher than the upstream Riverway pool ($\eta_j > \eta_i$), water must physically backflow southward ($j \to i$). The donor cell becomes $j$.
3. **Static Balance ($\Delta \eta = 0$)**:
   $Q = 0$.

### 4.2 Unified Continuous Transfer Formulation
To prevent non-physical discontinuous jumps when $\Delta \eta \to 0$, the flow rate is modulated by a smooth head-difference scaling factor:
$$Q_{\text{link}} = \text{sign}(\Delta \eta) \cdot (1 - \beta) \cdot \min\left(Q_{\text{inlet}}, Q_{\text{outlet\_control}}\right)$$

### 4.3 Donor-Cell Volume Conservation Constraint
To unconditionally guarantee that neither cell develops negative water depth ($h \ge 0$ invariant), the volume transferred during an adaptive solver sub-step $dt_{\text{sub}}$ is limited by donor volume:
$$V_{\text{donor\_available}} = h_{\text{donor}} \cdot A_{\text{cell}} = h_{\text{donor}} \cdot (625\text{ m}²)$$
$$V_{\text{transfer}} = \min\left(|Q_{\text{link}}| \cdot dt_{\text{sub}}, V_{\text{donor\_available}}\right)$$

If $\Delta \eta > 0$:
$$h_i \leftarrow h_i - \frac{V_{\text{transfer}}}{A_{\text{cell}}}, \quad h_j \leftarrow h_j + \frac{V_{\text{transfer}}}{A_{\text{cell}}}$$
If $\Delta \eta < 0$:
$$h_j \leftarrow h_j - \frac{V_{\text{transfer}}}{A_{\text{cell}}}, \quad h_i \leftarrow h_i + \frac{V_{\text{transfer}}}{A_{\text{cell}}}$$

### Mathematical Properties:
- **Zero Loss / Zero Creation**: $\Delta V_{\text{catchment}} = -V_{\text{transfer}} + V_{\text{transfer}} \equiv 0$.
- **Downstream Water Tracking**: Cleared floodwater remains in the 2D surface channel, advancing through rows 13, 12, 10, 8 toward the northern domain weir.

---

## 5. Debris Blockage Mechanics

In municipal operations, debris blockage is not a static friction coefficient; it is a physical constriction at the culvert headwall trash rack.

### Bounded Blockage Model:
1. **Effective Width**: $W_{\text{eff}} = W \cdot (1 - \beta)$
2. **Effective Area**: $A_{\text{eff}} = A \cdot (1 - \beta)$
3. **Debris Head Loss Increment**:
   Under outlet control, contraction through the debris matrix adds a form head loss:
   $$K_{\text{debris}}(\beta) = \left(\frac{\beta}{1 - \beta}\right)^2$$
   - When $\beta = 0.0$ (unblocked / Plan Gamma): $K_{\text{debris}} = 0$, $A_{\text{eff}} = A$, full capacity available.
   - When $\beta = 0.5$ (50% blocked): $A_{\text{eff}} = 0.5 A$, $K_{\text{debris}} = 1.0$.
   - When $\beta = 1.0$ (100% blocked / Baseline): $A_{\text{eff}} = 0$, $Q_{\text{link}} = 0$.

---

## 6. Assessment: Is a Coupled-Link Model Defensible?

### Objective Finding:
A coupled 1D/2D culvert link **IS DEFENSIVE AND SCIENTIFICALLY SOUND**, provided that:

1. **It is explicitly labelled as a "Topographically Aligned Conceptual Conduit Link"**:
   - The verified facts are clearly stated: USACE Phase 1 box culvert ($10\text{ ft} \times 24\text{ ft}$), general alignment beneath Brookline Avenue.
   - The derived approximations are clearly acknowledged: $35.4\text{ m}$ barrel length based on roadway width, 25m cell discretization.
   - The unverified parameters are explicitly disclosed: invert elevations are approximated using the bare-earth LiDAR channel bed rather than unreleased structural as-builts.
2. **It eliminates the artificial 7-meter elevation dam artifact**:
   - Transferring water from `[15, 24]` to `[14, 25]` reflects the actual physical crossing beneath the road embankment.
3. **It eliminates the unrouted water destruction flaw**:
   - Water cleared by Plan Gamma is not deleted; it continues downstream into the daylighted Fenway channel, where its true interaction with downstream storage and boundary outfalls is simulated.

---

## 7. Required Regression Test Suite

Prior to any production deployment, the coupled conduit implementation must be verified against these five automated tests:

1. **`TEST-CONDUIT-EXACT-MASS-CONSERVATION`**:
   Execute 180 macro-steps. Assert that $\sum (\Delta h_i + \Delta h_j) \cdot A_{\text{cell}} \equiv 0$ and domain-wide mass balance residual $< 10^{-11}\text{ m}³$.
2. **`TEST-CONDUIT-ZERO-TRANSFER-UNDER-BLOCKAGE`**:
   Set $\beta = 1.0$. Assert that $Q_{\text{link}} \equiv 0$ at every sub-step regardless of headwater depth.
3. **`TEST-CONDUIT-REVERSE-FLOW-BALANCE`**:
   Artificially set $h_j > h_i + (z_i - z_j)$. Assert that $Q_{\text{link}}$ transfers water from $j \to i$ smoothly without instability.
4. **`TEST-CONDUIT-WEIR-ORIFICE-TRANSITION`**:
   Assert that under $h_{\text{in}} = 1.0\text{ m}$, unblocked discharge evaluates to $12.44\text{ m}³/s \pm 0.2\text{ m}³/s$, matching the FHWA broad-crested weir rating.
5. **`TEST-CONDUIT-DOWNSTREAM-CHANNEL-ARRIVAL`**:
   Assert that water transferring through the conduit increases downstream daylighted channel depth at row 14, col 25, verifying true hydrodynamic continuity.

---

> **Status Summary**:  
> Formulation review complete.  
> Standard FHWA HDS-5 and USACE equations derived.  
> Parameter provenance classified into Verified, Derived, and Assumed tiers.  
> **No production code, coordinates, or displayed metrics were modified.**  
> Awaiting user review and authorization.
