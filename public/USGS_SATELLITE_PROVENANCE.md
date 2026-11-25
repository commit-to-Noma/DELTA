# USGS Satellite Still Imagery — Provenance & Georeferencing

## 1. Dataset Overview

This document records the provenance, coordinate reference system, geographic extent, and registration parameters for the bundled static satellite still: `public/usgs_satellite_still.png`.

| Attribute | Specification |
| :--- | :--- |
| **Source Agency** | United States Geological Survey (USGS) — The National Map |
| **Map Service** | USGSImageryOnly (TNM Imagery Only) |
| **Export Service Endpoint** | `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/export` |
| **Retrieval Date** | 2026-11-25 |
| **Authoritative CRS** | NAD83 / Massachusetts Mainland (EPSG:26986) |
| **Derived Geographic CRS** | WGS 84 (EPSG:4326) |
| **Raster Format** | PNG (8-bit colormap, non-interlaced) |
| **Pixel Dimensions** | 1024 × 1024 pixels |
| **Spatial Resolution** | 1.5625 meters / pixel (16.0 pixels per 25.0m DEM grid cell) |
| **License / Rights** | U.S. Government Public Domain (17 U.S.C. § 105) |

---

## 2. Spatial Registration Bounds

The image was exported natively in the authoritative projected coordinate system of the DELTA elevation raster: **EPSG:26986 (Massachusetts Mainland, Meters)**.

### Projected Bounding Box (EPSG:26986)
- **$X_{\min}$ (West)**: `231650.0 m`
- **$X_{\max}$ (East)**: `233250.0 m`
- **$Y_{\min}$ (South)**: `897900.0 m`
- **$Y_{\max}$ (North)**: `899500.0 m`
- **Width**: `1600.0 m` (64 cells × 25.0 m)
- **Height**: `1600.0 m` (64 cells × 25.0 m)

### Corresponding WGS84 Geographic Extent (EPSG:4326)
Calculated using DELTA's Lambert Conformal Conic geodesy engine (`projectedToLatLon`):
- **South-West Corner ($X_{\min}, Y_{\min}$)**:
  - Latitude: $42.330950^\circ\text{ N}$
  - Longitude: $-71.115978^\circ\text{ W}$
- **North-East Corner ($X_{\max}, Y_{\max}$)**:
  - Latitude: $42.345287^\circ\text{ N}$
  - Longitude: $-71.096473^\circ\text{ W}$

---

## 3. Query Parameters

```
https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/export?bbox=231650.0,897900.0,233250.0,899500.0&bboxSR=26986&imageSR=26986&size=1024,1024&format=png&f=image
```

Because `bboxSR` and `imageSR` are both specified as `26986`, the exported imagery is rectified directly against the Massachusetts State Plane planar grid without reprojection distortion, establishing exact 1:1 cell-to-pixel alignment with the 64×64 elevation model.
