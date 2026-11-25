# DELTA — Task 1.4: Real-World Geographic Canvas Integration Report

**Project**: DELTA (Decision Engine for Local Terrain & Action)  
**Track**: Codegeist 2026 — Specialized Industries  
**Stage**: Phase 1 — Hydraulic Engine & Geographic Domain Integration  
**Status**: COMPLETE & VERIFIED  
**Date**: November 2026  
**Reference Git Commit**: `e4d1b82` (incorporating Task 1.4 canvas coupling)

---

## 1. Executive Summary

Task 1.4 establishes the first end-to-end operational integration connecting the authoritative **Boston Longwood Medical Area & Muddy River catchment dataset (v2.0.0, EPSG:26986)** to the **2D mass-conserving diffusive-wave hydraulic simulation engine** within a high-performance, responsive HTML5 Canvas interface.

Prior to Task 1.4:
- The hydraulic solver had undergone independent mathematical auditing and verified numerical consistency (`tests/hydraulicSolver.test.ts`, 17 tests).
- The geographic dataset had been audited, corrected, and re-projected to EPSG:26986 with exact $25.0\text{ m} \times 25.0\text{ m}$ square cells across a $1,600\text{ m} \times 1,600\text{ m}$ physical domain (`tests/bostonDataset.test.ts`, 8 tests).
- The Forge Custom UI shell and Rovo action resolvers had been deployed and smoke-tested on live Jira (`tests/forgeResolver.test.ts`, 6 tests).

Task 1.4 bridges these subsystems into the operational **`FloodSimulationView`** using the **`GeographicSimulationCanvas`** component:
1. **Zero Aspect Ratio Distortion**: Strict $1:1$ square physical-to-display bounding preserves the $1,600\text{ m} \times 1,600\text{ m}$ domain without horizontal or vertical stretching on any viewport.
2. **Authoritative Infrastructure Overlays**: Real OpenStreetMap hospital footprints (5 facilities), emergency road access corridors (117 clipped segments), and modelled drainage inlets (3 gravity culverts) are mapped directly onto computational cells.
3. **Live Solver Coupling**: The canvas directly renders computed overland water depths from the solver's `Float64Array(4096)`, advancing dynamically via `stepHydraulics()` at $\Delta t_{\text{macro}} = 2.0\text{ s}$ per tick.
4. **Hydraulic Velocity Field**: Downhill hydraulic gradients ($-\nabla \eta = -\nabla (z + h)$) are visualized as directional flow vectors over inundated cells.
5. **Interactive Cell Inspector & Reticle**: Hovering or clicking any cell inspects projected coordinates ($X, Y$ in EPSG:26986), WGS84 lat/lon, ground elevation ($z$), simulated water depth ($h$), total water surface elevation ($\eta$), infrastructure names, and road passability status.
6. **Water Accounting Telemetry**: Live mass-conservation rack displays active storage, cumulative rainfall, infiltration, drainage, boundary outflow, and relative error ($< 10^{-10}$).

---

## 2. Architecture & File Structure

```
src/
├── components/
│   ├── shell/
│   │   └── views/
│   │       └── FloodSimulationView.tsx      # Operational simulation view & controls
│   └── simulation/
│       └── GeographicSimulationCanvas.tsx   # Canvas 2D engine & spatial hit-tester
├── data/
│   ├── bostonLongwoodCatchment.json         # Authoritative EPSG:26986 dataset (v2.0.0)
│   └── catchmentLoader.ts                  # Loader, LCC geodesy, and grid indexing
└── simulation/
    └── hydraulicSolver.ts                  # 2D Diffusive-wave solver engine

tests/
├── bostonDataset.test.ts                   # 8 dataset & geodesy tests
├── canvasIntegration.test.ts               # 6 canvas & solver integration tests
├── forgeResolver.test.ts                   # 6 Forge/Rovo action tests
└── hydraulicSolver.test.ts                 # 17 numerical solver tests
```

---

## 3. Core Implementation Details

### 3.1. Aspect Ratio Preservation & High-DPI Rendering
The computational grid comprises $64 \times 64$ cells with $\Delta x = \Delta y = 25.0\text{ m}$, representing an exact $1,600.0\text{ m} \times 1,600.0\text{ m}$ square bounding box in EPSG:26986:
- $X \in [231650.0, 233250.0]\text{ m}$
- $Y \in [897900.0, 899500.0]\text{ m}$

To prevent the spatial distortion identified during the Task 1.3 audit, `GeographicSimulationCanvas.tsx` calculates a strictly square viewport regardless of the container's width or height:
```typescript
const dpr = window.devicePixelRatio || 1;
canvas.width = width * dpr;
canvas.height = height * dpr;
ctx.scale(dpr, dpr);

const padding = 28;
const availableWidth = width - padding * 2;
const availableHeight = height - padding * 2;
const displaySize = Math.max(100, Math.min(availableWidth, availableHeight));

const originX = Math.floor((width - displaySize) / 2);
const originY = Math.floor((height - displaySize) / 2);
const cellSize = displaySize / nx;
```
Both horizontal and vertical dimensions scale uniformly by $S = \text{displaySize} / 1600.0\text{ px/m}$.

### 3.2. Coordinate Mapping & Cell Hit-Testing
A bi-directional transformation connects screen pixels, grid indices, projected coordinates, and geographic coordinates:

1. **Screen Pixel $(px, py) \to$ Grid Cell $(row, col)$**:
   $$\text{relX} = px - \text{originX}, \quad \text{relY} = py - \text{originY}$$
   $$\text{col} = \lfloor \text{relX} / \text{cellSize} \rfloor, \quad \text{row} = \lfloor \text{relY} / \text{cellSize} \rfloor$$
2. **Grid Cell $(row, col) \to$ EPSG:26986 $(X, Y)$**:
   $$X = X_{\min} + (col + 0.5) \cdot \Delta x$$
   $$Y = Y_{\max} - (row + 0.5) \cdot \Delta y$$
3. **EPSG:26986 $(X, Y) \to$ WGS84 $(\text{lat}, \text{lon})$**:
   Calculated in real-time via the closed-form Lambert Conformal Conic (2SP) projection formula in `catchmentLoader.ts`.

### 3.3. Layered Visualization Stack
The canvas renders seven distinct, toggleable visual layers in order of topological depth:
1. **Terrain Hypsometry**: Continuous elevation color ramp from deep onyx/slate ($z = 3.2\text{ m}$ in the Muddy River basin) to granite slate ($z = 32.1\text{ m}$ on Parker Hill).
2. **Topographic Contours**: 5-meter index contour lines delineating steep valley walls and localized depressions.
3. **Dynamic Flood Water**: Overland water depth rendered from `waterDepth: Float64Array(4096)`:
   - $h < 0.02\text{ m}$: Below display threshold (dry terrain visible).
   - $0.02\text{ m} \le h < 0.10\text{ m}$: Shallow sheet flow (`rgba(56, 189, 248, 0.42)`).
   - $0.10\text{ m} \le h < 0.30\text{ m}$: Moderate ponding (`rgba(2, 132, 199, 0.65)`).
   - $0.30\text{ m} \le h < 0.60\text{ m}$: Impassable flood (`rgba(3, 105, 161, 0.82)` with orange warning borders).
   - $h \ge 0.60\text{ m}$: Severe submersion (`rgba(8, 47, 73, 0.92)`).
4. **Hydraulic Velocity Field**: Sampled vectors pointing downhill along the local hydraulic surface gradient:
   $$\vec{S}_f = -\left( \frac{\partial \eta}{\partial x}\hat{i} + \frac{\partial \eta}{\partial y}\hat{j} \right)$$
5. **Emergency Road Network**: Sourced OSM primary and secondary corridors (Brookline Ave, Longwood Ave, etc.) with road passability highlights.
6. **Critical Facilities**: Red cross badges and labels for Brigham and Women's Hospital, Boston Children's Hospital, BIDMC West & East, and Dana-Farber.
7. **Drainage Infrastructure**: Circular culvert symbols indicating modelled storm sewer capacity ($Q_{\text{design}}$).
8. **Cartographic Accoutrements**: Metric scale bar ($400\text{ m}$) and True North orientation compass.

### 3.4. Hydraulic Solver Coupling & Playback Loop
The simulation loop is managed in `FloodSimulationView.tsx` with high temporal stability:
- **Solver Step**: `stepHydraulics(state, { dtMacroSeconds: 2.0, rainfallRateMmPerHour })`
- **Sub-stepping**: The hydraulic engine internally adaptively subdivides each 2-second macro-timestep into CFL-stable sub-steps ($\Delta t_{\text{sub}} \le 0.5\text{ s}$).
- **Playback Rates**: Configurable at 1x, 2x, or 5x speed via `setInterval` ticking at 60ms intervals.
- **Controls**: Run / Pause / Step (+2s) / Reset.
- **Rainfall Forcing**: Switchable between NOAA Atlas 14 events (10-yr: $42.0\text{ mm/h}$, 50-yr: $56.5\text{ mm/h}$, 100-yr: $68.0\text{ mm/h}$) or a custom slider ($0 - 150\text{ mm/h}$).

---

## 4. Verification & Test Suite

The test suite was executed across all 4 test files:

```bash
$ npm test
✓ tests/forgeResolver.test.ts (6 tests)
✓ tests/canvasIntegration.test.ts (6 tests)
✓ tests/bostonDataset.test.ts (8 tests)
✓ tests/hydraulicSolver.test.ts (17 tests)

Test Files  4 passed (4)
     Tests  37 passed (37)
```

### Canvas Integration Tests (`tests/canvasIntegration.test.ts`)
| Test ID | Objective | Status |
|---|---|---|
| `TEST-CANVAS-01` | Strict 1:1 aspect ratio across rectangular viewports ($800\times600$, $1920\times1080$, etc.) | **PASS** |
| `TEST-CANVAS-02` | Bi-directional screen-to-geographic mapping and cell hit-testing accuracy | **PASS** |
| `TEST-CANVAS-03` | Spatial indexing of all 5 critical medical facilities within valid $[0, 63]$ grid bounds | **PASS** |
| `TEST-CANVAS-04` | Indexing and coordinate validation of 3 drainage inlets and 117 clipped road segments | **PASS** |
| `TEST-CANVAS-05` | Dynamic hydraulic solver advancing and road passability threshold classification | **PASS** |
| `TEST-CANVAS-06` | Mass conservation preservation under live solver-canvas coupling ($\Delta V_{\text{rel}} < 10^{-10}$) | **PASS** |

### Production Build Verification
```bash
$ npm run build
vite v6.4.6 building for production...
✓ 2164 modules transformed.
dist/index.html                   0.96 kB │ gzip:   0.54 kB
dist/assets/index-CtzwyK5F.css   31.58 kB │ gzip:   6.43 kB
dist/assets/index-BN5aRkwu.js   418.92 kB │ gzip: 114.08 kB
✓ built in 2.12s
```

---

## 5. UI Separation & Scope Boundary

In strict compliance with project architecture:
1. **Landing Page (`HeroSection.tsx`)**: Continues to render `TerrainContourCanvas` for visual atmospheric presentation.
2. **Operations Center (`FloodSimulationView.tsx`)**: Hosts the newly developed `GeographicSimulationCanvas` for authoritative, data-driven hydraulic simulation.
3. **No External Mapping Dependencies**: Implemented in pure Canvas 2D without Google Maps, Leaflet, or Mapbox API dependencies, maintaining complete sandbox compliance for Atlassian Forge.

---

## 6. Conclusion & Next Step

Task 1.4 is complete and fully verified. The geographic canvas renders the real $1,600\text{ m} \times 1,600\text{ m}$ Boston Longwood catchment, overlays all critical assets, and couples seamlessly with the 2D hydraulic solver with zero aspect ratio distortion.

**Ready for Task 1.5: Hydraulic Performance Profiling & Optimization** (awaiting user review).
