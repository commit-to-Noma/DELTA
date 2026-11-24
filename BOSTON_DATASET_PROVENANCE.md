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
3. **Complex Urban Hydrology**: Steep topographic relief on the southern ridge (Parker Hill, elevation $>64\text{ m}$) discharges stormwater rapidly northward into the low-lying glacial basin and river corridor (elevation $<1\text{ m}$), creating severe surface ponding at critical transportation choke points (Brookline Avenue, Francis Street, Riverway).

---

## 2. Spatial Reference & Computational Grid Specification

| Parameter | Specification | Notes |
| :--- | :--- | :--- |
| **Grid Dimensions** | $64 \times 64$ regular Cartesian grid | Total $4,096$ computational cells |
| **Spatial Resolution** | $\Delta x = 25.0\text{ m}$, $\Delta y = 25.0\text{ m}$ | Cell area: $625.0\text{ m}^2$ |
| **Domain Extents** | $1.60\text{ km} \times 1.60\text{ km}$ ($2.56\text{ km}^2$) | Regular bounding domain |
| **Bounding Box (WGS 84)** | South: $42.3297^\circ\text{N}$, North: $42.3493^\circ\text{N}$<br>West: $-71.1158^\circ\text{W}$, East: $-71.0962^\circ\text{W}$ | Latitude span: $\approx 2.18\text{ km}$ (projected $1.6\text{ km}$ computational frame) |
| **Grid Orientation** | Row 0 = North ($42.3493^\circ\text{N}$), Row 63 = South ($42.3297^\circ\text{N}$)<br>Col 0 = West ($-71.1158^\circ\text{W}$), Col 63 = East ($-71.0962^\circ\text{W}$) | Staggered cell-edge indexing for donor-cell flux calculation |
| **Projected CRS** | **NAD83 / Massachusetts Mainland (EPSG:26986)** | Primary legal and engineering CRS for MassGIS |
| **Alternative CRS** | **WGS 84 / UTM Zone 19N (EPSG:32619)** | Global conformal projection for metric interoperability |
| **Vertical Datum** | **NAVD88 (Meters)** | North American Vertical Datum of 1988 |

---

## 3. Data Provenance & Authoritative Sources

### 3.1 Digital Elevation Model (DEM)
- **Source**: **USGS 3D Elevation Program (3DEP)** 1-meter Bare Earth Digital Elevation Model.
- **Provider**: U.S. Geological Survey / National Geospatial Program.
- **Data Product**: High-resolution LiDAR-derived bare-earth elevation raster.
- **Acquisition Endpoint**: USGS 3DEP ImageServer REST API (`https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer`).
- **Resampling Method**: Bilinear spatial aggregation downsampled from the 1-meter source raster to the $25.0\text{ m}$ computational grid.
- **Observed Elevation Extremes**:
  - Minimum elevation: **$0.33\text{ m}$** (Muddy River channel / Back Bay Fens entrance at north boundary).
  - Maximum elevation: **$64.11\text{ m}$** (Parker Hill crest in southern Mission Hill district).
  - Mean elevation: **$8.89\text{ m}$**.
- **License**: **U.S. Public Domain** (U.S. Government work).

### 3.2 Built Infrastructure & Critical Facilities
- **Source**: **OpenStreetMap (OSM)** via Overpass API query.
- **Query Timestamp**: 2026-11-24.
- **Elements Extracted**:
  - $5$ primary hospital complexes with verified OSM node/way/relation IDs.
  - $135$ critical road segments along emergency access corridors (Brookline Avenue, Riverway, Longwood Avenue, Francis Street, Avenue Louis Pasteur, Boylston Street, Beacon Street, Park Drive).
- **License**: **Open Database License (ODbL 1.0)**.
- **Attribution Notice**: *Contains information from OpenStreetMap, which is made available here under the Open Database License (ODbL).*

### 3.3 Meteorology & Design Precipitation
- **Source**: **NOAA Atlas 14**, Volume 10, Version 3 (Precipitation-Frequency Atlas of the United States: Northeastern States).
- **Location**: Boston Longwood station ($42.338^\circ\text{N}, -71.106^\circ\text{W}$).
- **Synthetic Design Events**:
  - **10-Year 6-Hour Storm**: Total depth $78.5\text{ mm}$, peak intensity $42.0\text{ mm/h}$.
  - **50-Year 6-Hour Storm**: Total depth $104.2\text{ mm}$, peak intensity $56.5\text{ mm/h}$.
  - **100-Year 6-Hour Storm**: Total depth $122.0\text{ mm}$, peak intensity $68.0\text{ mm/h}$.
- **License**: **U.S. Public Domain**.

---

## 4. Rigorous Distinction Between Fact and Model

In strict accordance with `HACKATHON_GUIDELINES.md` and `DESIGN.md`, DELTA maintains an explicit, unblurred boundary between empirically measured ground truth and engineering simulation assumptions:

| Component | Status | Source / Basis | Treatment in Application |
| :--- | :--- | :--- | :--- |
| **Topography ($z_i$)** | **Measured Ground Truth** | USGS 3DEP 1m LiDAR | Stored in `elevationMatrix`; displayed as actual ground surface elevation. |
| **Hospital Coordinates & Footprints** | **Measured Ground Truth** | OpenStreetMap (ODbL) | Sourced directly from OSM ways and relations (`isMeasuredLocation: true`). |
| **Road Network Geometry** | **Measured Ground Truth** | OpenStreetMap (ODbL) | Real street centerlines mapped to grid cells (`isRealGeometry: true`). |
| **Culvert & Sump Inflow Capacities** | **Modeled Assumption** | Boston Water and Sewer Commission (BWSC) reports | Modeled as point sinks with explicit default design capacities (`isModelledAssumption: true`). |
| **Infiltration Capacity** | **Modeled Assumption** | Green-Ampt representative urban values | Parameterized as uniform or zone-based loss rates ($2.0$ to $5.0\text{ mm/h}$). |
| **Overland Roughness (Manning $n$)** | **Calibrated Parameter** | Literature standard for dense urban streetscapes | Set to $n = 0.025\text{ s}\cdot\text{m}^{-1/3}$ (asphalt and concrete with street furniture). |
| **Rainfall Hyetographs** | **Synthetic Design Event** | NOAA Atlas 14 precipitation frequency statistics | Modeled temporal distribution applied uniformly or spatially across the domain. |

---

## 5. Modelled Drainage Infrastructure Inventory

Because subsurface municipal storm sewer networks are proprietary, security-sensitive, and not continuously measured in real time, DELTA represents municipal drainage as discrete point sinks with clearly documented modeling rationales:

1. **`CULVERT-01-BROOKLINE` (Brookline Avenue Muddy River Culvert)**
   - *Location*: $[42.3415^\circ\text{N}, -71.1080^\circ\text{W}]$ (Grid cell `[25, 25]`, index `1625`).
   - *Design Capacity*: $12.5\text{ m}^3/\text{s}$.
   - *Rationale*: Represents the major hydraulic culvert transition where the Muddy River passes beneath Brookline Avenue into the Fenway conduit.
2. **`CULVERT-02-FENWAY-CHOKE` (Fenway Emerald Necklace Choke Point)**
   - *Location*: $[42.3435^\circ\text{N}, -71.1030^\circ\text{W}]$ (Grid cell `[18, 41]`, index `1193`).
   - *Design Capacity*: $8.0\text{ m}^3/\text{s}$.
   - *Rationale*: Historic hydraulic restriction point subject to debris accumulation and backwater effects during major overland runoff events.
3. **`DRAIN-03-LONGWOOD-WEST` (Longwood West Storm Drainage Sump)**
   - *Location*: $[42.3360^\circ\text{N}, -71.1090^\circ\text{W}]$ (Grid cell `[43, 22]`, index `2774`).
   - *Design Capacity*: $4.5\text{ m}^3/\text{s}$.
   - *Rationale*: Modeled retention sump and pump station protecting the low-elevation ambulance approach to Brigham and Women's Hospital.

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
- **`TEST-DATA-01`**: Strict grid dimensions ($64 \times 64$, $\Delta x = \Delta y = 25.0\text{ m}$, area $= 2.56\text{ km}^2$).
- **`TEST-DATA-02`**: Finite elevation range ($0.33\text{ m} \le z \le 64.11\text{ m}$, 4096 cells, no NaN/Inf).
- **`TEST-DATA-03`**: 5 critical hospital facilities with verified OSM IDs and bounding box containment.
- **`TEST-DATA-04`**: 135 critical access road segments with valid node geometries and elevation profiles.
- **`TEST-DATA-05`**: Drainage infrastructure explicitly tagged with `isModelledAssumption: true`.
- **`TEST-DATA-06`**: Legal licensing and attribution compliance for USGS, OSM ODbL, and NOAA.
- **`TEST-DATA-07`**: Coordinate transformation roundtrip fidelity between WGS 84 $(\text{lat}, \text{lon})$ and computational grid indices $(\text{row}, \text{col})$.
- **`TEST-DATA-08`**: Direct execution with `hydraulicSolver.ts` maintaining mass conservation error $< 10^{-10}$.
