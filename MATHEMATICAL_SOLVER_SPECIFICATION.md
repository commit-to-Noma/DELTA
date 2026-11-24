# DELTA — Mathematical Hydraulic Solver Specification

> **Version**: 2.0 (Rigorous Mathematical Review)  
> **Status**: Approved Specification for Implementation  

---

## 1. Dimensional Consistency & Parameter Definitions

The overland flow model employs the 2D diffusive wave approximation derived from the 2D shallow water equations under the assumption that friction and pressure forces dominate local and convective acceleration.

### Term-by-Term Dimensional Verification:

| Variable | Notation | SI Units | Description |
|---|---|---|---|
| **Cell Dimensions** | $\Delta x, \Delta y$ | $\text{m}$ | Regular Cartesian cell spatial resolution ($\Delta x = \Delta y = 25.0\text{ m}$). |
| **Cell Area** | $A_c$ | $\text{m}^2$ | Surface area of a computational cell: $A_c = \Delta x \cdot \Delta y = 625.0\text{ m}^2$. |
| **Bed Elevation** | $z$ | $\text{m}$ | Topographic ground elevation above vertical datum (DEM). |
| **Water Depth** | $h$ | $\text{m}$ | Height of water layer above ground surface ($h \ge 0$). |
| **Water Surface Elevation** | $\eta$ | $\text{m}$ | Hydraulic head / piezometric surface: $\eta = z + h$. |
| **Flow-Face Width** | $W$ | $\text{m}$ | Width of the interface between adjacent cells ($W = \Delta x = 25.0\text{ m}$). |
| **Effective Flow Depth** | $h_f$ | $\text{m}$ | Depth of water conveying flow across the shared face. |
| **Hydraulic Gradient** | $S_f$ | $\text{m/m}$ (dimensionless) | Piezometric gradient driving flow: $S_f = \frac{\eta_1 - \eta_2}{\Delta x}$. |
| **Manning's Roughness** | $n$ | $\text{s} \cdot \text{m}^{-1/3}$ | Empirical hydraulic boundary resistance coefficient. |
| **Flow Velocity** | $u$ | $\text{m/s}$ | Mean flow velocity across the face. |
| **Discharge Rate** | $Q$ | $\text{m}^3/\text{s}$ | Volumetric flow rate across the face. |
| **Volume Transferred** | $\Delta V$ | $\text{m}^3$ | Integrated water volume transferred over time $\Delta t$: $\Delta V = Q \cdot \Delta t$. |

### Velocity Dimensional Check:
$$u = \frac{1}{n} \cdot R_h^{2/3} \cdot S_f^{1/2}$$
For shallow overland flow, hydraulic radius $R_h \approx h_f$.
$$\text{Units of } u = \frac{1}{\text{s} \cdot \text{m}^{-1/3}} \cdot [\text{m}]^{2/3} \cdot \left[\frac{\text{m}}{\text{m}}\right]^{1/2} = \left[\frac{\text{m}^{1/3}}{\text{s}}\right] \cdot \left[\text{m}^{2/3}\right] \cdot [1] = \left[\frac{\text{m}^{(1/3 + 2/3)}}{\text{s}}\right] = \left[\frac{\text{m}}{\text{s}}\right] \quad \text{(Consistent)}$$

### Discharge Dimensional Check:
$$Q = u \cdot A_{\text{flow}} = u \cdot (W \cdot h_f) = \left(\frac{1}{n} h_f^{2/3} S_f^{1/2}\right) \cdot (\Delta x \cdot h_f) = \frac{\Delta x}{n} \cdot h_f^{5/3} \cdot S_f^{1/2}$$
$$\text{Units of } Q = [\text{m/s}] \cdot [\text{m}^2] = \left[\frac{\text{m}^3}{\text{s}}\right] \quad \text{(Consistent)}$$

---

## 2. Staggered Face-Based Discretization & Pairwise Symmetry

To guarantee that internal mass is neither created nor destroyed, flux calculations must be strictly **face-centered** (staggered grid) rather than cell-centered.

```
          (i, j+1)
             |
             |   Face Y(i, j+1/2): Q_y[i, j]
             v
(i-1, j) -------- (i, j) -------- (i+1, j)
         Face X(i-1/2, j)  Face X(i+1/2, j)
             |
             |   Face Y(i, j-1/2): Q_y[i, j-1]
             v
          (i, j-1)
```

1. **Face Arrays**:
   - Horizontal X-Faces: $F_x[i, j]$ between cell $(i, j)$ and $(i+1, j)$, for $0 \le i < N_x - 1, 0 \le j < N_y$.
   - Vertical Y-Faces: $F_y[i, j]$ between cell $(i, j)$ and $(i, j+1)$, for $0 \le i < N_x, 0 \le j < N_y - 1$.
2. **Single Evaluation Rule**:
   Every internal face flux is evaluated **exactly once** per timestep.
   Oriented convention:
   - $Q_x[i, j] > 0$ denotes flow in the $+x$ direction (from cell $(i, j)$ into cell $(i+1, j)$).
   - $Q_y[i, j] > 0$ denotes flow in the $+y$ direction (from cell $(i, j)$ into cell $(i, j+1)$).
3. **Equal & Opposite Updates**:
   For any horizontal face between cell $A=(i, j)$ and cell $B=(i+1, j)$ with flux $Q_x$:
   $$\Delta V_A \leftarrow \Delta V_A - Q_x \cdot \Delta t$$
   $$\Delta V_B \leftarrow \Delta V_B + Q_x \cdot \Delta t$$
   Because the same numerical value $Q_x \cdot \Delta t$ is subtracted from $A$ and added to $B$, the sum of all internal updates is **identically zero**.

---

## 3. Numerical Stability & Adaptive Time-Stepping (Parabolic vs. Hyperbolic Limits)

The diffusive wave equation is a non-linear parabolic diffusion equation:
$$\frac{\partial h}{\partial t} = \nabla \cdot (D \nabla \eta)$$
where the non-linear diffusion coefficient is:
$$D = \frac{1}{n} \frac{h_f^{5/3}}{\sqrt{|S_f| + \epsilon_S}}$$
where $\epsilon_S = 10^{-4}$ prevents singularity when $S_f \to 0$.

### Why a Fixed 2.0-Second Timestep is Unstable:
For an explicit scheme, stability requires:
$$\Delta t \le \Delta t_{\text{diff}} = \frac{\Delta x^2}{4 D_{\max}}$$
- For $h_f = 0.6\text{ m}$, $n = 0.025$, $S_f = 0.005$:
  $$D = \frac{0.6^{5/3}}{0.025 \sqrt{0.005}} \approx \frac{0.426}{0.00177} \approx 240\text{ m}^2/\text{s}$$
  $$\Delta t_{\text{diff}} = \frac{25^2}{4 \times 240} = \frac{625}{960} \approx 0.65\text{ seconds}!$$
A fixed $\Delta t = 2.0\text{ s}$ violates this criterion and will produce numerical oscillations and explosive instability.

### Corrected Adaptive Timestep Formulation:
We compute the stable substep $\delta t$ at each iteration:
$$\delta t = \min\left( \Delta t_{\text{max\_substep}}, \frac{C_{\text{diff}} \Delta x^2}{4 \max(D + \epsilon)}, \frac{C_{\text{CFL}} \Delta x}{\sqrt{g h_{\max}} + u_{\max}} \right)$$
where:
- Safety coefficient $C_{\text{diff}} = 0.5$
- Advective safety coefficient $C_{\text{CFL}} = 0.5$
- $\Delta t_{\text{max\_substep}} = 0.5\text{ s}$
- Total step $\Delta t_{\text{macro}} = 2.0\text{ s}$ is advanced using $N_{\text{sub}} = \lceil \Delta t_{\text{macro}} / \delta t \rceil$ stable sub-iterations.

---

## 4. Complete Water Volume Accounting Formulation

Every water transaction must be tracked as a cumulative volume in cubic meters ($\text{m}^3$):

$$V_{\text{balance\_error}} = \left| V_{\text{stored}}(t) - \left[ V_{\text{initial}} + V_{\text{rain\_cum}}(t) - V_{\text{infil\_cum}}(t) - V_{\text{drain\_cum}}(t) - V_{\text{boundary\_cum}}(t) \right] \right|$$

Where:
1. **Stored Water Volume**:
   $$V_{\text{stored}}(t) = \sum_{i=0}^{N_x-1} \sum_{j=0}^{N_y-1} h_{i,j}^t \cdot A_c \quad [\text{m}^3]$$
2. **Rainfall Volume**:
   At each substep $\delta t$:
   $$\Delta V_{\text{rain}} = \sum_{i,j} \left( \frac{R(t)}{3.6 \times 10^6} \cdot A_c \cdot \delta t \right) \quad [\text{m}^3]$$
   $$V_{\text{rain\_cum}}(t) = \sum \Delta V_{\text{rain}}$$
3. **Infiltration Volume**:
   $$\Delta V_{\text{infil}} = \sum_{i,j} \min\left( f_{\text{infil}}(i,j) \cdot A_c \cdot \delta t, V_{i,j}^t \right) \quad [\text{m}^3]$$
   $$V_{\text{infil\_cum}}(t) = \sum \Delta V_{\text{infil}}$$
4. **Drainage Removal Volume**:
   $$\Delta V_{\text{drain}} = \sum_{(i_d, j_d)} \min\left( Q_{\text{cap}}(i_d, j_d) \cdot (1 - \beta) \cdot \delta t, V_{i_d, j_d}^t \right) \quad [\text{m}^3]$$
   $$V_{\text{drain\_cum}}(t) = \sum \Delta V_{\text{drain}}$$
5. **Boundary Outflow Volume**:
   $$\Delta V_{\text{boundary}} = \sum_{\text{open boundary faces}} Q_{\text{boundary}} \cdot \delta t \quad [\text{m}^3]$$
   $$V_{\text{boundary\_cum}}(t) = \sum \Delta V_{\text{boundary}}$$

---

## 5. Non-Negative Depth Limiter with Pairwise Symmetry

A major failure mode in explicit solvers is that multiple outgoing faces can collectively demand more water than a cell contains, causing $h^{t+\delta t} < 0$.

### The Consistent Two-Pass Limiter:

1. **Pass 1: Compute Unconstrained Face Fluxes**:
   For every internal face, compute $Q^*$:
   $$Q^* = \text{sign}(\eta_1 - \eta_2) \cdot \frac{\Delta x}{n} \cdot h_f^{5/3} \cdot \sqrt{\frac{|\eta_1 - \eta_2|}{\Delta x}}$$
   where $h_f = \max(0, \max(\eta_1, \eta_2) - \max(z_1, z_2))$.
2. **Pass 2: Determine Donor Cell Outflow Demand**:
   For each cell $k=(i,j)$, sum all fluxes directed **outward** from cell $k$:
   $$V_{\text{demand}}(k) = \sum_{F \in \text{OutFaces}(k)} |Q_F^*| \cdot \delta t$$
   Available volume in cell $k$: $V_{\text{avail}}(k) = h_k \cdot A_c$.
   Cell scaling factor:
   $$\alpha_k = \begin{cases} 1.0 & \text{if } V_{\text{demand}}(k) \le V_{\text{avail}}(k) \\ \frac{V_{\text{avail}}(k)}{V_{\text{demand}}(k)} & \text{if } V_{\text{demand}}(k) > V_{\text{avail}}(k) \end{cases}$$
   where $0 \le \alpha_k \le 1.0$.
3. **Pass 3: Apply Donor Factor to Shared Face**:
   Every face has exactly one donor cell (the higher $\eta$ cell).
   Actual face flux:
   $$Q_F = \alpha_{\text{donor}} \cdot Q_F^*$$
4. **Pass 4: Apply Equal and Opposite Transfer**:
   $$V_{\text{donor}} \leftarrow V_{\text{donor}} - Q_F \cdot \delta t$$
   $$V_{\text{receiver}} \leftarrow V_{\text{receiver}} + Q_F \cdot \delta t$$

**Mathematical Proof of Guarantees**:
- Total volume leaving cell $k$: $\sum_{F} Q_F \delta t = \alpha_k \sum |Q_F^*| \delta t \le V_{\text{avail}}(k)$.
- Therefore, $V_k \ge 0$ unconditionally.
- Receiver gains exactly $Q_F \delta t$. Pairwise symmetry is strict. Global mass is conserved.

---

## 6. Boundary Conditions

1. **Closed Boundary (Default / Perimeter Wall)**:
   All boundary faces on the outer perimeter ($i=-1/2$, $i=N_x-1/2$, $j=-1/2$, $j=N_y-1/2$) have $Q = 0$.
   No water enters or exits through closed boundaries.
2. **Open Boundary (Free Outfall / River Discharge)**:
   Designated cells along the perimeter (e.g. the downstream Muddy River exit at the north-east domain corner) are flagged as open outfalls:
   $$Q_{\text{boundary}} = \frac{\Delta x}{n} \cdot h_{\text{cell}}^{5/3} \cdot \sqrt{S_{\text{outfall}}}$$
   Water volume leaving through this face is removed from the cell and accumulated into $V_{\text{boundary\_cum}}$.

---

## 7. Determinism, Reproducibility & Failure Handling

1. **Pure Functional State Transitions**:
   The solver is pure: `stepHydraulics(state, inputs) -> nextState`. No external global state or side effects.
2. **Float64 Precision**:
   All depth, volume, and elevation arrays use standard IEEE 754 `Float64Array`.
3. **Zero Stochasticity**:
   The solver executes zero calls to `Math.random()`. Identical initial state + identical rainfall hydrograph yields bit-identical results.
4. **Numerical Guardrails**:
   - If any cell exhibits $h < 0$, it triggers an immediate assertion failure in tests.
   - If any cell encounters `NaN` or `Infinity`, execution halts immediately with a `NumericalInstabilityError` reporting the cell coordinate, depth, and timestep.

---

## 8. Test Suite Specification (10 Independent Verification Tests)

| Test ID | Test Name | Purpose / Physical Scenario | Acceptance Criteria |
|---|---|---|---|
| **TEST-01** | *Water Conservation with Rainfall* | Flat impermeable domain subjected to 6 hours of varying rainfall hydrograph; zero boundaries. | $\frac{\|V_{\text{stored}} - V_{\text{rain}}\|}{V_{\text{rain}}} < 10^{-10}$ |
| **TEST-02** | *Water Conservation with Infiltration* | Domain with varying soil infiltration rates. | $\frac{\|V_{\text{stored}} - (V_{\text{rain}} - V_{\text{infil}})\|}{V_{\text{rain}}} < 10^{-10}$ |
| **TEST-03** | *Water Conservation with Drainage Outfalls* | Domain with culvert drainage nodes actively shedding runoff. | $\frac{\|V_{\text{stored}} - (V_{\text{rain}} - V_{\text{drain}})\|}{V_{\text{rain}}} < 10^{-10}$ |
| **TEST-04** | *Water Conservation with Open Boundary* | Slope draining water across an open boundary cell. | $\frac{\|V_{\text{stored}} - (V_{\text{initial}} - V_{\text{boundary}})\|}{V_{\text{initial}}} < 10^{-10}$ |
| **TEST-05** | *Downhill Flow Direction* | Linear inclined plane with initial water block at crest. | $100\%$ of flux moves in $-z$ direction; zero uphill flux. |
| **TEST-06** | *Flat Terrain Uniform Accumulation* | Horizontal plane with uniform rainfall. | Standard deviation of water depth across all cells is $0.0$ ($\sigma_h < 10^{-12}\text{ m}$). |
| **TEST-07** | *Non-Negative Water Depth Guarantee* | Extreme steep cliff (50m vertical drop) with dry downstream cells. | $\min_{i,j}(h_{i,j}) \ge 0.0$ at all timesteps. |
| **TEST-08** | *No-Flow Quiescent Equilibrium* | Depression lake filled to flat water surface elevation with zero rain. | All face fluxes $|Q| < 10^{-12}\text{ m}^3/\text{s}$. Depth remains static. |
| **TEST-09** | *Deterministic Bit-for-Bit Reproducibility* | Two consecutive runs of 500 steps with identical inputs. | `Array.every((v, i) => v === run2[i])` is strictly `true`. |
| **TEST-10** | *Demanding Storm Stress & Stability* | Torrential cloudburst ($250\text{ mm/hr}$ peak rainfall) on rugged terrain. | Solver completes without `NaN`, water balance error $< 10^{-9}$. |
