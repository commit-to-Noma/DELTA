# DELTA — Boston Longwood & Muddy River Catchment: Geographic Dataset & Provenance Specification

## 1. Catchment Overview & Rationale

DELTA grounds its 2D overland flow hydraulic solver and incident response engine in a high-density, real-world urban medical corridor: the **Longwood Medical Area (LMA) and Muddy River corridor** in Boston and Brookline, Massachusetts.

### Why this catchment was selected:
1. **Critical Infrastructure Concentration**: Hosts five of the world's leading healthcare institutions:
   - **Brigham and Women's Hospital** (Level 1 Trauma Center, Mass General Brigham)
   - **Boston Children's Hospital** (Pediatric Level 1 Trauma Center)
   - **Beth Israel Deaconess Medical Center - West Campus** (Level 1 Trauma Center)
   - **Beth Israel Deaconess Medical Center - East Campus** (Inpatient and specialty care)
   - **Dana-Farber Cancer Institute** (Comprehensive Cancer Center)
2. **Documented Flood Vulnerability**: The Longwood area is located immediately adjacent to the Muddy River, a winding tributary of the Charles River within Frederick Law Olmsted's historic Emerald Necklace park system. The catchment experienced severe flooding during historical storm events (notably the catastrophic October 1996 flood, which submerged the MBTA Green Line and threatened regional healthcare continuity).
3. **Complex Urban Hydrology**: Steep topographic relief on the southern ridge (Mission Hill, elevation $>46\text{ m}$) discharges stormwater rapidly northward into the low-lying glacial basin and river corridor (elevation $<1\text{ m}$), creating severe surface ponding at critical transportation choke points (Brookline Avenue, Francis Street, Riverway).

---

## 2. Spatial Reference & Computational Grid Specification

| Parameter | Specification | Notes |
| :--- | :--- | :--- |
| **Grid Dimensions** | $64 \times 64$ regular Cartesian grid | Total $4,096$ computational cells |
| **Spatial Resolution** | $\Delta x = 25.0\text{ m}$, $\Delta y = 25.0\text{ m}$ | Strictly square cells; cell area: $625.0\text{ m}^2$ |
| **Domain Extents** | $1.60\text{ km} \times 1.60\text{ km}$ ($2.56\text{ km}^2$) | Regular bounding metric domain |
| **Authoritative Projected CRS** | **NAD83 / Massachusetts Mainland (EPSG:26986)** | Statutory metric conformal projection (Lambert Conformal Conic 2SP) |
| **Projected Bounds** | $X \in [231,650.0\text{ m}, 233,250.0\text{ m}]$<br>$Y \in [897,900.0\text{ m}, 899,500.0\text{ m}]$ | Width $= 1,600.0\text{ m}$, Height $= 1,600.0\text{ m}$ |
| **Derived Geographic Corners** | **NW**: $42.345353^\circ\text{N}, -71.115891^\circ\text{W}$<br>**NE**: $42.345286^\circ\text{N}, -71.096472^\circ\text{W}$<br>**SW**: $42.330949^\circ\text{N}, -71.115978^\circ\text{W}$<br>**SE**: $42.330882^\circ\text{N}, -71.096564^\circ\text{W}$ | Calculated via rigorous inverse Lambert Conformal Conic geodesy |
| **Grid Orientation** | Row 0 = North ($Y = 899,500\text{ m}$), Row 63 = South ($Y = 897,900\text{ m}$)<br>Col 0 = West ($X = 231,650\text{ m}$), Col 63 = East ($X = 233,250\text{ m}$) | Staggered cell-edge indexing for donor-cell flux calculation |
| **Alternative CRS** | **WGS 84 / UTM Zone 19N (EPSG:32619)** | Metric transverse Mercator |
| **Vertical Datum** | **NAVD88 (Meters)** | North American Vertical Datum of 1988 |

---

## 3. Data Provenance & Authoritative Sources

### 3.1 Digital Elevation Model (DEM)
- **Source**: **USGS 3D Elevation Program (3DEP)** 1-meter Bare Earth Digital Elevation Model.
- **Provider**: U.S. Geological Survey / National Geospatial Program.
- **Data Product**: High-resolution LiDAR-derived bare-earth elevation raster.
- **Acquisition Endpoint**: USGS 3DEP ImageServer REST API (`https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage`).
- **Target Spatial Reference**: **EPSG:26986** (`bboxSR=26986&imageSR=26986`).
- **Resampling Method**: Bilinear spatial aggregation downsampled directly in projected meters from the 1-meter source LiDAR to the $25.0\text{ m} \times 25.0\text{ m}$ square computational grid.
- **Observed Elevation Extremes**:
  - Minimum elevation: **$0.24\text{ m}$** (Muddy River channel / Back Bay Fens entrance at north boundary).
  - Maximum elevation: **$46.16\text{ m}$** (Mission Hill crest).
  - Mean elevation: **$8.24\text{ m}$**.
- **License**: **U.S. Public Domain** (U.S. Government work).

### 3.2 Built Infrastructure & Critical Facilities
- **Source**: **OpenStreetMap (OSM)** via Overpass API query.
- **Query Timestamp**: 2026-11-24.
- **Coordinate Projection**: All node coordinates projected from WGS 84 $(\text{lat}, \text{lon})$ to EPSG:26986 planar coordinates $(X, Y)$ using exact Lambert Conformal Conic geodesy equations.
- **Elements Extracted**:
  - $5$ primary hospital complexes with verified OSM node/way/relation IDs.
  - $117$ critical road segments along emergency access corridors clipped strictly to the $1,600\text{ m} \times 1,600\text{ m}$ domain.
- **License**: **Open Database License (ODbL 1.0)**.
- **Attribution Notice**: *Contains information from OpenStreetMap, which is made available here under the Open Database License (ODbL).*

### 3.3 Meteorology & Design Precipitation
- **Source**: **NOAA Atlas 14**, Volume 10, Version 3 (Precipitation-Frequency Atlas of the United States: Northeastern States).
- **Location**: Boston Longwood station ($42.338^\circ\text{N}, -71.106^\circ\text{W}$).
- **Synthetic Design Events**:
  - **10-Year 6-Hour Storm**: Total depth $78.5\text{ mm}$, peak intensity $42.0\text{ mm/h}$ (10% Annual Exceedance Probability).
  - **50-Year 6-Hour Storm**: Total depth $104.2\text{ mm}$, peak intensity $56.5\text{ mm/h}$ (2% Annual Exceedance Probability).
  - **100-Year 6-Hour Storm**: Total depth $122.0\text{ mm}$, peak intensity $68.0\text{ mm/h}$ (1% Annual Exceedance Probability).
- **License**: **U.S. Public Domain**.

---

## 4. Rigorous Distinction Between Fact and Model

In strict accordance with `HACKATHON_GUIDELINES.md` and `DESIGN.md`, DELTA maintains an explicit, unblurred boundary between empirically measured ground truth and engineering simulation assumptions:

| Component | Status | Source / Basis | Treatment in Application |
| :--- | :--- | :--- | :--- |
| **Topography ($z_i$)** | **Measured Ground Truth** | USGS 3DEP 1m LiDAR | Stored in `elevationMatrix`; displayed as actual ground surface elevation. |
| **Hospital Coordinates & Footprints** | **Measured Ground Truth** | OpenStreetMap (ODbL) | Sourced directly from OSM ways and relations (`isMeasuredLocation: true`). |
| **Road Network Geometry** | **Measured Ground Truth** | OpenStreetMap (ODbL) | Real street centerlines projected into EPSG:26986 and clipped (`isRealGeometry: true`). |
| **Culvert & Sump Inflow Capacities** | **Modeled Assumption** | Literature-based representative capacities | Modeled as point sinks with explicit default design capacities (`isModelledAssumption: true`). Not measured BWSC SCADA telemetry. Capacities are adjustable in the UI. |
| **Infiltration Capacity** | **Modeled Assumption** | Green-Ampt representative urban values | Parameterized as uniform or zone-based loss rates ($2.0$ to $5.0\text{ mm/h}$). |
| **Overland Roughness (Manning $n$)** | **Calibrated Parameter** | Literature standard for dense urban streetscapes | Set to $n = 0.025\text{ s}\cdot\text{m}^{-1/3}$ (asphalt and concrete with street furniture). |
| **Rainfall Hyetographs** | **Synthetic Design Event** | NOAA Atlas 14 precipitation frequency statistics | Modeled temporal distribution applied uniformly or spatially across the domain. |

---

## 5. Modelled Drainage Infrastructure Inventory

Municipal storm sewer pipe networks are highly complex, sub-surface, and proprietary (Boston Water and Sewer Commission reports over 30,000 catch basins citywide). In DELTA, subterranean conveyance is represented using a **culvert sink abstraction**, aggregating localized overland drainage into discrete point sinks with clearly documented, user-adjustable assumptions:

1. **`CULVERT-01-BROOKLINE` (Brookline Avenue Muddy River Culvert)**
   - *Projected Location*: $[X = 232,302.1\text{ m}, Y = 899,074.9\text{ m}]$ ($42.3415^\circ\text{N}, -71.1080^\circ\text{W}$).
   - *Grid Cell*: `[17, 26]` (index `1114`).
   - *Design Capacity*: $12.5\text{ m}^3/\text{s}$ (Adjustable planning assumption).
   - *Rationale*: Represents the major hydraulic culvert transition where Muddy River passes beneath Brookline Avenue into the Fenway conduit.
2. **`CULVERT-02-FENWAY-CHOKE` (Fenway Emerald Necklace Choke Point)**
   - *Projected Location*: $[X = 232,713.1\text{ m}, Y = 899,298.9\text{ m}]$ ($42.3435^\circ\text{N}, -71.1030^\circ\text{W}$).
   - *Grid Cell*: `[8, 42]` (index `554`).
   - *Design Capacity*: $8.0\text{ m}^3/\text{s}$ (Adjustable planning assumption).
   - *Rationale*: Historic hydraulic restriction point subject to debris accumulation and backwater effects during major overland runoff events.
3. **`DRAIN-03-LONGWOOD-WEST` (Assumed Overland Sump Inflow - Longwood Low Basin)**
   - *Projected Location*: $[X = 232,222.5\text{ m}, Y = 898,463.6\text{ m}]$ ($42.3360^\circ\text{N}, -71.1090^\circ\text{W}$).
   - *Grid Cell*: `[41, 22]` (index `2646`).
   - *Design Capacity*: $4.5\text{ m}^3/\text{s}$ (Adjustable planning assumption).
   - *Rationale*: Generic assumed municipal drainage sink representing localized gravity catch basin aggregation in the Longwood low basin. Not a documented municipal pump station. Capacity is an adjustable planning-level assumption.

---

## 6. Software Architecture & Hydraulic Solver Integration

The dataset is loaded and coupled to the hydraulic solver via `src/data/catchmentLoader.ts`:

```typescript
import { loadBostonCatchment, createHydraulicConfigFromCatchment } from './catchmentLoader.ts';
import { createHydraulicState, stepHydraulics } from '../simulation/hydraulicSolver.ts';

// 1. Load packaged Boston dataset
const dataset = loadBostonCatchment();

// 2. Convert to HydraulicGridConfig (flattens 64x64 elevation matrix, binds drainage inlets)
const config = createHydraulicConfigFromCatchment(dataset, {
  manningN: 0.025,
  defaultInfiltrationMmPerHour: 2.0,
  openBoundaries: 'muddy_river_outlet',
});

// 3. Initialize simulation state (water depth, mass accounting)
let state = createHydraulicState(config);

// 4. Advance simulation through time
state = stepHydraulics(state, {
  dtMacroSeconds: 2.0,
  rainfallRateMmPerHour: 50.0,
});
```

---

## 7. Automated Validation & Verification Suite

The dataset is verified by automated tests in `tests/bostonDataset.test.ts`:
- **`TEST-DATA-01`**: Strict projected grid dimensions ($64 \times 64$, $\Delta x = \Delta y = 25.0\text{ m}$, area $= 2.56\text{ km}^2$, width/height $= 1,600.0\text{ m}$).
- **`TEST-DATA-02`**: Finite elevation range ($0.24\text{ m} \le z \le 46.16\text{ m}$, 4096 cells, no NaN/Inf).
- **`TEST-DATA-03`**: 5 critical hospital facilities with verified OSM IDs and projected $[X, Y]$ containment.
- **`TEST-DATA-04`**: 117 critical access road segments with projected $[X, Y]$ coordinates and elevation profiles.
- **`TEST-DATA-05`**: Drainage infrastructure explicitly tagged with `isModelledAssumption: true` and projected coordinates.
- **`TEST-DATA-06`**: Legal licensing and attribution compliance for USGS, OSM ODbL, and NOAA.
- **`TEST-DATA-07`**: Lambert Conformal Conic geodesy roundtrip fidelity between WGS 84 $(\text{lat}, \text{lon})$ and projected $(X, Y)$ with error $< 10^{-7}$ degrees.
- **`TEST-DATA-08`**: Direct execution with `hydraulicSolver.ts` maintaining mass conservation error $< 10^{-10}$.
