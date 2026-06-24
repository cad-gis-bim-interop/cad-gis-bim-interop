---
title: "Converting CAD Local Coordinates to EPSG:4326"
description: "Step-by-step Python pipeline using pyproj and numpy to convert arbitrary CAD site-grid coordinates to WGS84 (EPSG:4326) via a two-stage similarity transform and reprojection."
slug: "converting-cad-local-coordinates-to-epsg4326"
type: "long_tail"
breadcrumb:
  - label: "Coordinate Transformation & Spatial Alignment"
    url: "/coordinate-transformation-spatial-alignment/"
  - label: "CRS Normalization Workflows"
    url: "/coordinate-transformation-spatial-alignment/crs-normalization-workflows/"
  - label: "Converting CAD Local Coordinates to EPSG:4326"
    url: "/coordinate-transformation-spatial-alignment/crs-normalization-workflows/converting-cad-local-coordinates-to-epsg4326/"
datePublished: "2025-01-15"
dateModified: "2026-06-24"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Converting CAD Local Coordinates to EPSG:4326",
      "description": "Step-by-step Python pipeline using pyproj and numpy to convert arbitrary CAD site-grid coordinates to WGS84 (EPSG:4326) via a two-stage similarity transform and reprojection.",
      "datePublished": "2025-01-15",
      "dateModified": "2026-06-24",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Coordinate Transformation & Spatial Alignment", "item": "https://cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/"},
        {"@type": "ListItem", "position": 2, "name": "CRS Normalization Workflows", "item": "https://cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/"},
        {"@type": "ListItem", "position": 3, "name": "Converting CAD Local Coordinates to EPSG:4326", "item": "https://cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/converting-cad-local-coordinates-to-epsg4326/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Converting CAD Local Coordinates to EPSG:4326",
      "description": "Two-stage pipeline: solve a 2D similarity transform to map CAD site-grid coordinates into a known projected CRS, then reproject to WGS84 geographic coordinates.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Identify an intermediate projected CRS for your region", "text": "Choose a UTM zone, State Plane system, or national grid appropriate to your site. Control points must be defined in this PCS, not in raw WGS84."},
        {"@type": "HowToStep", "position": 2, "name": "Collect non-collinear control points", "text": "Acquire at least two (preferably four or more) CAD (X, Y) coordinates with matching real-world PCS coordinates from survey control, GPS observations, or GNSS monument data."},
        {"@type": "HowToStep", "position": 3, "name": "Solve the 2D similarity transform", "text": "Use least-squares SVD decomposition to recover the scale, rotation, and translation that best maps CAD coordinates onto the projected CRS."},
        {"@type": "HowToStep", "position": 4, "name": "Apply the transform and reproject to EPSG:4326", "text": "Map all CAD points through the similarity transform, then use pyproj.Transformer with always_xy=True to convert from the intermediate PCS to WGS84 longitude/latitude."},
        {"@type": "HowToStep", "position": 5, "name": "Validate with control-point residuals", "text": "Back-project control points through the pipeline and compute RMSE. Survey-grade work targets sub-centimetre residuals; values above 0.1 m indicate unit mismatches or mis-identified points."}
      ]
    }
  ]
}
</script>

# Converting CAD Local Coordinates to EPSG:4326

Converting CAD local coordinates to EPSG:4326 requires a deterministic two-stage pipeline: first, map the arbitrary CAD site grid to a known projected coordinate system (PCS) using a 2D similarity (Helmert) transform, then reproject those planar coordinates to geographic WGS84 via `pyproj`. This page is a hands-on implementation reference within the [CRS Normalization Workflows](/coordinate-transformation-spatial-alignment/crs-normalization-workflows/) topic — read that page first for environment setup, library version pinning, and broader pipeline context. The critical prerequisite is at least two non-collinear control points that tie CAD `(X, Y)` values to real-world projected coordinates. Without survey control or embedded georeferencing metadata, the transformation is mathematically indeterminate.

## How pyproj and numpy Handle CAD-to-WGS84 Conversion

CAD files (DWG and DXF) have no native concept of a coordinate reference system. They store raw numeric values relative to an arbitrary site origin chosen by the drafter. The pipeline bridges this gap in two mathematically distinct stages, and it is important to understand why both stages are necessary.

### Stage 1 — Similarity Transform (CAD grid → projected CRS)

A 2D similarity transform has four degrees of freedom: uniform scale, rotation angle, and two translation components. It preserves shape and relative distances, making it the correct model for survey-grade CAD registration when no shear or independent-axis distortion exists. The transform is written as:

$$
\begin{pmatrix} E \\ N \end{pmatrix} = s \cdot \mathbf{R} \begin{pmatrix} X_{cad} \\ Y_{cad} \end{pmatrix} + \begin{pmatrix} t_x \\ t_y \end{pmatrix}
$$

where `s` is the uniform scale factor, **R** is a 2×2 rotation matrix, and `(t_x, t_y)` is the translation in PCS units. Solving for these four unknowns requires a minimum of two control points; over-determined systems (N > 2) are solved with SVD-based least squares, which minimises the sum of squared residuals across all pairs.

### Stage 2 — Map Projection (projected CRS → EPSG:4326)

Once coordinates live in a known projected CRS such as UTM or State Plane, `pyproj.Transformer` handles the non-linear map projection to WGS84 geographic coordinates. This second stage is emphatically **not** a linear transform — applying a rotation-scale-translate directly to geographic degree values ignores Earth's curvature and introduces errors measured in tens of metres or more.

The diagram below illustrates the complete data flow:

<svg viewBox="0 0 760 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Two-stage CAD to EPSG:4326 pipeline diagram" style="width:100%;max-width:760px;display:block;margin:1.5rem auto">
  <title>Two-stage CAD to EPSG:4326 pipeline</title>
  <desc>Data flows from CAD local coordinates through a similarity transform into a regional projected CRS, then through a pyproj map projection into WGS84 EPSG:4326 geographic coordinates.</desc>
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor"/>
    </marker>
  </defs>
  <!-- Box 1: CAD local coords -->
  <rect x="10" y="60" width="160" height="80" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="90" y="96" text-anchor="middle" font-size="13" fill="currentColor" font-family="sans-serif">CAD Local Grid</text>
  <text x="90" y="114" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif" opacity="0.75">(X, Y) — arbitrary origin</text>
  <!-- Arrow 1 -->
  <line x1="170" y1="100" x2="248" y2="100" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <text x="209" y="88" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif">Similarity</text>
  <text x="209" y="101" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif">transform</text>
  <text x="209" y="114" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif">(SVD)</text>
  <!-- Box 2: Projected CRS -->
  <rect x="250" y="60" width="200" height="80" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="350" y="96" text-anchor="middle" font-size="13" fill="currentColor" font-family="sans-serif">Projected CRS</text>
  <text x="350" y="114" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif" opacity="0.75">e.g. UTM / State Plane</text>
  <!-- Arrow 2 -->
  <line x1="450" y1="100" x2="528" y2="100" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <text x="489" y="88" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif">pyproj</text>
  <text x="489" y="101" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif">Transformer</text>
  <text x="489" y="114" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif">(always_xy)</text>
  <!-- Box 3: WGS84 -->
  <rect x="530" y="60" width="220" height="80" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="640" y="96" text-anchor="middle" font-size="13" fill="currentColor" font-family="sans-serif">EPSG:4326 WGS84</text>
  <text x="640" y="114" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif" opacity="0.75">(lon, lat) geographic</text>
  <!-- Control points annotation -->
  <text x="90" y="170" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">&#8593; &#8805;2 control points</text>
  <text x="350" y="170" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">known (E, N) in PCS</text>
  <text x="640" y="170" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">validate with RMSE</text>
</svg>

**Key constraints to verify before writing any code:**

- **CAD unit ambiguity.** DWG/DXF files store raw numerics with no embedded unit metadata. A coordinate of `1000.0` could represent millimetres, inches, or metres. Mismatched units produce 25.4× or 1000× spatial offsets that look plausible until overlay with real geodata exposes them. Confirm the drawing's intended unit scale from `$INSUNITS` in the DXF header or from project documentation before sourcing control points. The [DXF Entity Structure Breakdown](/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/) covers header variable parsing in detail.
- **Axis order enforcement.** `pyproj` 2.0+ follows CRS axis definitions strictly. EPSG:4326 defines its axes as `(latitude, longitude)`. Initialising `Transformer` without `always_xy=True` silently inverts your output pairs.
- **Vertical datum.** EPSG:4326 is strictly 2D horizontal. If elevation accuracy matters, target `EPSG:4979` (3D WGS84) and chain a geoid correction via a `pyproj` vertical pipeline.
- **PROJ engine version.** `pyproj>=3.0` is required for modern grid-shift access and to avoid the deprecated `+init=epsg:` syntax. Verify with `pyproj.proj_version_str`.

## Production-Ready Script

The script below is self-contained and handles an arbitrary number of CAD points. Copy it into a project module and adjust `PCS_EPSG` to match your site's regional projected CRS. Comments reference minimum library versions.

```python
# pyproj>=3.4.0, numpy>=1.24.0, Python 3.9+
from __future__ import annotations

import numpy as np
from pyproj import Transformer
from typing import List, Tuple, Union


def compute_similarity_transform(
    src_pts: np.ndarray,
    dst_pts: np.ndarray,
) -> Tuple[float, np.ndarray, np.ndarray]:
    """Solve 2D similarity transform (scale, rotation, translation) via SVD.

    Args:
        src_pts: (N, 2) array of CAD control-point coordinates.
        dst_pts: (N, 2) array of matching real-world PCS coordinates.

    Returns:
        scale: uniform scale factor (dst units per src unit).
        R: (2, 2) rotation matrix.
        translation: (2,) translation vector in dst units.

    Raises:
        ValueError: If fewer than two points are supplied or arrays are mismatched.
    """
    src = np.asarray(src_pts, dtype=np.float64)
    dst = np.asarray(dst_pts, dtype=np.float64)

    if src.shape[0] < 2 or src.shape != dst.shape:
        raise ValueError(
            f"Require at least 2 matching control points; "
            f"got src={src.shape}, dst={dst.shape}."
        )

    # Centre both point sets to remove the translation component
    src_mean, dst_mean = src.mean(axis=0), dst.mean(axis=0)
    src_c, dst_c = src - src_mean, dst - dst_mean

    # Recover rotation via SVD of the cross-covariance matrix
    cov = src_c.T @ dst_c
    U, _, Vt = np.linalg.svd(cov)
    R = U @ Vt

    # Correct reflections (det = -1 indicates a reflection, not a rotation)
    if np.linalg.det(R) < 0:
        Vt[-1, :] *= -1
        R = U @ Vt

    # Uniform scale = ratio of cross-covariance trace to src variance
    scale = np.trace(cov @ R.T) / np.sum(src_c ** 2)

    # Translation: dst_mean = scale * R @ src_mean + t
    translation = dst_mean - scale * (src_mean @ R)

    return scale, R, translation


def validate_transform(
    control_cad: np.ndarray,
    control_pcs: np.ndarray,
    scale: float,
    R: np.ndarray,
    translation: np.ndarray,
) -> float:
    """Return RMSE in PCS units between predicted and known control positions."""
    predicted = (control_cad @ R.T) * scale + translation
    residuals = predicted - control_pcs
    rmse = float(np.sqrt(np.mean(residuals ** 2)))
    return rmse


def cad_to_epsg4326(
    cad_coords: Union[List[Tuple[float, float]], np.ndarray],
    control_cad: np.ndarray,
    control_pcs: np.ndarray,
    pcs_epsg: int = 32633,
    rmse_warn_threshold: float = 0.1,
) -> np.ndarray:
    """Convert CAD local coordinates to EPSG:4326 (WGS84) via an intermediate PCS.

    Args:
        cad_coords:  Array-like of (x, y) points in the CAD local grid.
        control_cad: (N, 2) CAD coordinates of survey control points.
        control_pcs: (N, 2) matching coordinates in the intermediate PCS.
        pcs_epsg:    EPSG code for the intermediate projected CRS (default: UTM 33N).
        rmse_warn_threshold: Print a warning if control-point RMSE exceeds this value
                             in PCS metres.

    Returns:
        (M, 2) array of (longitude, latitude) in EPSG:4326 decimal degrees.
    """
    ctrl_cad = np.asarray(control_cad, dtype=np.float64)
    ctrl_pcs = np.asarray(control_pcs, dtype=np.float64)

    # Solve the similarity transform
    scale, R, translation = compute_similarity_transform(ctrl_cad, ctrl_pcs)

    # Report residuals before committing to the transform
    rmse = validate_transform(ctrl_cad, ctrl_pcs, scale, R, translation)
    if rmse > rmse_warn_threshold:
        print(
            f"[WARN] Control-point RMSE = {rmse:.4f} m exceeds threshold "
            f"({rmse_warn_threshold} m). Check for unit mismatches or "
            f"mis-identified control points."
        )
    else:
        print(f"[INFO] Control-point RMSE = {rmse:.6f} m — transform accepted.")

    # Apply the similarity transform to all input points
    cad_arr = np.asarray(cad_coords, dtype=np.float64)
    if cad_arr.ndim == 1:
        cad_arr = cad_arr.reshape(1, -1)
    pcs_coords = (cad_arr @ R.T) * scale + translation

    # Reproject from the intermediate PCS to EPSG:4326
    # always_xy=True guarantees (longitude, latitude) output regardless of
    # the axis order defined in the CRS authority record.
    transformer = Transformer.from_crs(
        f"EPSG:{pcs_epsg}",
        "EPSG:4326",
        always_xy=True,
    )
    lon, lat = transformer.transform(pcs_coords[:, 0], pcs_coords[:, 1])

    return np.column_stack((lon, lat))


# ---------------------------------------------------------------------------
# Usage example
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # Survey control: CAD drawing units are metres, site CRS is UTM Zone 33N
    # Replace with real GPS / total-station observations from your project.
    ctrl_cad_pts = np.array([
        [1000.0, 2000.0],   # station A in CAD
        [5000.0, 2000.0],   # station B in CAD
        [1000.0, 6000.0],   # station C in CAD
        [5000.0, 6000.0],   # station D in CAD
    ])
    ctrl_pcs_pts = np.array([
        [364500.0, 5621000.0],  # station A in UTM 33N (easting, northing)
        [368500.0, 5621000.0],  # station B
        [364500.0, 5625000.0],  # station C
        [368500.0, 5625000.0],  # station D
    ])

    # Points to convert (e.g. centroids of CAD geometry entities)
    cad_points = np.array([
        [2500.0, 3000.0],
        [3500.0, 4500.0],
    ])

    result = cad_to_epsg4326(
        cad_points,
        ctrl_cad_pts,
        ctrl_pcs_pts,
        pcs_epsg=32633,
    )

    for (lon, lat) in result:
        print(f"  lon={lon:.7f}°  lat={lat:.7f}°")
```

**Key implementation notes:**

- `compute_similarity_transform` centres both point clouds before decomposition. This removes numerical conditioning issues that arise when site coordinates are in the millions-of-metres range typical of UTM eastings.
- The reflection check (`det(R) < 0`) prevents a mirrored solution that SVD can produce when control points are nearly collinear in one axis. A reflected transform gives visually plausible RMSE but inverts geometry east-west or north-south.
- `Transformer.from_crs` with string `"EPSG:4326"` uses the authority record's native axis order internally but the `always_xy=True` flag forces the output array columns to be `(easting/longitude, northing/latitude)` — matching the GeoJSON and shapefile convention.
- For 3D output, extend `pcs_coords` to a third column by passing CAD `Z` through the same scale factor (valid when horizontal and vertical drawing units are the same), then target `"EPSG:4979"` (WGS84 3D) in the `Transformer`.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| Python | 3.9 – 3.13 | 3.10+ recommended for `pyproj` 3.6+ compatibility |
| pyproj | 3.4.0 – 3.7.x | 3.4+ required for `Transformer.from_crs` authority-code lookup |
| PROJ (C library) | 7.2 – 9.x | 8.0+ for NTv2 / NADCON5 grid-shift support |
| numpy | 1.24 – 2.x | 2.0 changes buffer protocol; test `svd` output shape |
| DXF source | R12 – R2025 (AC1009 – AC1032) | Unit scale from `$INSUNITS` header; read with `ezdxf>=1.1.0` |
| DWG source | R14 – 2025 | ODA File Converter or `pydwg` for binary DWG; then standard pipeline |
| OS | Linux, macOS, Windows | PROJ data path (`PROJ_LIB`) must be set correctly on Windows |

## Fallback Strategies and Troubleshooting

**1. Collinear control points — transform becomes degenerate**

If all control points lie on a single straight line, the SVD decomposition cannot distinguish rotation from reflection and the recovered scale is unreliable. The symptom is a geometrically plausible-looking RMSE (because residuals along the line are small) combined with large positional errors perpendicular to it. Fix: add at least one control point well off the primary axis — ideally near a corner of the site perimeter.

**2. Unit mismatch between CAD and control observations**

A 1000× spatial offset after applying the transform almost always indicates that the drawing is in millimetres while control-point coordinates are in metres (or vice versa). The similarity transform absorbs the unit error into the scale factor, so visual inspection alone may not reveal it; check that `scale` is close to `1.0` (or the expected ratio of drawing units to PCS units). Read `$INSUNITS` from the DXF header with `ezdxf` to confirm:

```python
import ezdxf  # ezdxf>=1.1.0
doc = ezdxf.readfile("site_plan.dxf")
insunits = doc.header.get("$INSUNITS", 0)
# 2 = feet, 4 = mm, 6 = m; 0 = undefined
print(f"$INSUNITS = {insunits}")
```

**3. Mixed datums in control observations**

CAD drawings sometimes reference a local site grid while the surveyor's GPS control is in NAD83, ETRS89, or a national realization of WGS84 rather than the broadcast WGS84 ensemble. Applying the similarity transform without accounting for the datum shift introduces a systematic offset of up to several metres. Use `pyproj.CRS.from_epsg(your_pcs_epsg).to_wkt()` to confirm the datum and, if necessary, build a compound transformation string using the PROJ pipeline syntax:

```python
from pyproj import Transformer
# Example: from ETRS89 / UTM 32N (EPSG:25832) to WGS84 (EPSG:4326)
t = Transformer.from_crs("EPSG:25832", "EPSG:4326", always_xy=True)
```

**4. High RMSE that does not improve with more control points**

When RMSE remains elevated after adding well-distributed control points, the CAD drawing itself may be non-uniformly distorted — a common problem with drawings that were digitised from paper scans or assembled from multiple survey campaigns. A similarity transform cannot model independent-axis scaling, shear, or rubber-sheeting. In this case, consider a thin-plate-spline warp using `scipy.interpolate.RBFInterpolator` as a fallback for the first stage. This sacrifices the shape-preservation guarantee but achieves sub-pixel registration accuracy across the drawing extent.

**5. PROJ network errors when fetching shift grids at runtime**

Grid-based datum shifts (e.g., NADCON5 for CONUS, OSTN15 for GB National Grid) require external `.tif` grid files that `pyproj` may attempt to download from `cdn.proj.org` at runtime. In air-gapped or containerised environments this fails silently and falls back to an approximate transform. Pre-download grids using `pyproj.sync()` and set `PROJ_NETWORK=OFF` to enforce local-only resolution:

```python
import pyproj
# Run once to populate the PROJ data directory
pyproj.sync.get_transform_grid_list(area_of_use="USA")
```

For broader guidance on datum handling and validation across mixed-format ingestion pipelines, see [Scale and Rotation Synchronization](/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/) and the unit-conversion considerations in [Unit Conversion Pipelines](/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/).

---

## Related Pages

- [CRS Normalization Workflows](/coordinate-transformation-spatial-alignment/crs-normalization-workflows/) — parent topic: full pipeline from CRS detection through validation and export
- [Coordinate Transformation & Spatial Alignment](/coordinate-transformation-spatial-alignment/) — domain overview covering datum alignment, unit conversion, and layer mapping
- [Scale and Rotation Synchronization](/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/) — aligning BIM models and CAD drawings that share the same site but differ in orientation or scale
- [Aligning BIM Models with GIS Survey Data](/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/aligning-bim-models-with-gis-survey-data/) — end-to-end workflow combining IFC georeferencing with the Helmert approach used here
- [DXF Entity Structure Breakdown](/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/) — parsing DXF headers and `$INSUNITS` to confirm drawing units before transformation
