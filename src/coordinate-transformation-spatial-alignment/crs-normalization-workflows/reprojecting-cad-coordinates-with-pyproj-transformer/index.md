---
title: "Reprojecting CAD Coordinates with pyproj Transformer"
description: "Reproject CAD point arrays with pyproj Transformer: always_xy axis handling, vectorized numpy transforms, cached thread-safe transformers, and automatic UTM zone selection."
slug: "reprojecting-cad-coordinates-with-pyproj-transformer"
breadcrumb:
  - label: "Coordinate Transformation & Spatial Alignment"
    url: "/coordinate-transformation-spatial-alignment/"
  - label: "CRS Normalization Workflows"
    url: "/coordinate-transformation-spatial-alignment/crs-normalization-workflows/"
  - label: "Reprojecting CAD Coordinates with pyproj Transformer"
    url: "/coordinate-transformation-spatial-alignment/crs-normalization-workflows/reprojecting-cad-coordinates-with-pyproj-transformer/"
datePublished: "2026-07-11"
dateModified: "2026-07-11"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Reprojecting CAD Coordinates with pyproj Transformer",
      "description": "Reproject CAD point arrays with pyproj Transformer: always_xy axis handling, vectorized numpy transforms, cached thread-safe transformers, and automatic UTM zone selection.",
      "datePublished": "2026-07-11",
      "dateModified": "2026-07-11",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Coordinate Transformation & Spatial Alignment", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/"},
        {"@type": "ListItem", "position": 2, "name": "CRS Normalization Workflows", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/"},
        {"@type": "ListItem", "position": 3, "name": "Reprojecting CAD Coordinates with pyproj Transformer", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/reprojecting-cad-coordinates-with-pyproj-transformer/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Reprojecting CAD Coordinates with pyproj Transformer",
      "description": "Build a fast, correct reprojection routine for CAD point arrays using a single cached pyproj Transformer with always_xy axis handling.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Confirm the source CRS and units", "text": "Verify the CAD data is in a known projected CRS and in metres before reprojecting; scale non-metre drawings first."},
        {"@type": "HowToStep", "position": 2, "name": "Create one Transformer with always_xy=True", "text": "Build a single Transformer.from_crs(src, dst, always_xy=True) so coordinate order is (x, y) / (lon, lat) regardless of CRS axis definitions, and reuse it for all points."},
        {"@type": "HowToStep", "position": 3, "name": "Transform arrays, not points", "text": "Pass numpy arrays of x and y into transformer.transform for vectorized reprojection instead of looping over individual coordinates."},
        {"@type": "HowToStep", "position": 4, "name": "Validate with a control point and bounding box", "text": "Reproject a known control point and confirm the output bounding box falls inside the destination CRS domain; drop any non-finite results from out-of-area inputs."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Why must I pass always_xy=True to pyproj Transformer?",
          "acceptedAnswer": {"@type": "Answer", "text": "Since pyproj 2.0 the library honours each CRS's authority-defined axis order. EPSG:4326 defines its axes as (latitude, longitude), so without always_xy=True the transform returns (lat, lon) — the reverse of the (x, y) / (lon, lat) order that GeoJSON, shapefiles, and CAD tooling expect. Setting always_xy=True forces easting/longitude first and northing/latitude second on both input and output."}
        },
        {
          "@type": "Question",
          "name": "Should I create a new Transformer for each point?",
          "acceptedAnswer": {"@type": "Answer", "text": "No. Building a Transformer is comparatively expensive because it resolves the CRS pair and selects an operation. Create one Transformer per source-destination pair and reuse it for every point or array. Transformer instances are thread-safe for the transform call, so a single cached instance can serve many worker threads."}
        },
        {
          "@type": "Question",
          "name": "Why do some reprojected points come back as inf?",
          "acceptedAnswer": {"@type": "Answer", "text": "PROJ returns inf (or HUGE_VAL) for coordinates that fall outside the valid domain of the source or destination projection — for example a point far outside a UTM zone. Filter results with numpy.isfinite and log the offending inputs rather than writing infinite coordinates into a spatial database, where they corrupt indexes and bounding boxes."}
        },
        {
          "@type": "Question",
          "name": "How do I pick the right UTM zone for CAD data?",
          "acceptedAnswer": {"@type": "Answer", "text": "Compute an approximate longitude and latitude for the site centroid, then choose the UTM zone as floor((lon + 180) / 6) + 1, with EPSG 326NN for the northern hemisphere and 327NN for the southern. pyproj.database.query_utm_crs_info returns the exact EPSG code for a bounding box, which is more robust near zone boundaries."}
        }
      ]
    }
  ]
}
</script>

# Reprojecting CAD Coordinates with pyproj Transformer

To reproject CAD coordinates in Python, build a single `pyproj.Transformer.from_crs(src, dst, always_xy=True)`, then call `.transform(x, y)` on numpy arrays of the whole point set at once. The `always_xy=True` flag is mandatory: it guarantees `(easting/longitude, northing/latitude)` order regardless of how the CRS authority defines its axes, which is the difference between correct output and silently swapped coordinates. This page is an implementation reference within the [CRS Normalization Workflows](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/) topic. It assumes the CAD data already sits in a known projected CRS and in metres — if it does not, resolve that first, because reprojection cannot fix an unknown datum or a millimetre-scale drawing.

## How pyproj Transformer Handles Reprojection

`pyproj.Transformer` wraps a PROJ coordinate operation: given a source and destination CRS, PROJ selects a concrete pipeline (projection, datum shift, and any grid corrections) and evaluates it. Two properties of that design govern how you should use it.

First, **axis order follows the CRS authority**, not intuition. `EPSG:4326` is officially latitude-first. Since `pyproj` 2.0 the library respects this, so a naive `Transformer.from_crs("EPSG:25832", "EPSG:4326")` returns `(lat, lon)`. Every CAD, GeoJSON, and shapefile toolchain expects `(x, y)` / `(lon, lat)`. Passing `always_xy=True` normalises both input and output to that traditional order, eliminating an entire class of "my points landed in the wrong hemisphere" bugs.

<!-- fig:pyproj-build-once -->
<svg viewBox="-20 -20 576 286" role="img" aria-label="Building a pyproj Transformer compiles a PROJ pipeline once; every transform call after that reuses it on whole arrays" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:576px;display:block;margin:1.5rem auto;">
  <title>Why the Transformer is built once and reused</title>
  <desc>A call sequence. Constructing a Transformer makes PROJ search its database, select a coordinate operation and compile a pipeline — the expensive part. Each subsequent transform call reuses that compiled pipeline on whole numpy arrays. Rebuilding the Transformer inside the loop repeats the database search for every chunk.</desc>
  <defs>
    <marker id="ppj-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ppj-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="576" height="286" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="164" height="34" rx="6" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-width="1.4"/>
  <text x="82" y="21" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">pipeline</text>
  <line x1="82" y1="34" x2="82" y2="246" stroke="currentColor" stroke-width="1" stroke-opacity="0.28" stroke-dasharray="4 4"/>
  <rect x="186" y="0" width="164" height="34" rx="6" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-width="1.4"/>
  <text x="268" y="21" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">pyproj.Transformer</text>
  <line x1="268" y1="34" x2="268" y2="246" stroke="currentColor" stroke-width="1" stroke-opacity="0.28" stroke-dasharray="4 4"/>
  <rect x="372" y="0" width="164" height="34" rx="6" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-width="1.4"/>
  <text x="454" y="21" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">PROJ database</text>
  <line x1="454" y1="34" x2="454" y2="246" stroke="currentColor" stroke-width="1" stroke-opacity="0.28" stroke-dasharray="4 4"/>
  <line x1="82" y1="60" x2="268" y2="60" stroke="currentColor" stroke-width="1.3" marker-end="url(#ppj-a)"/>
  <text x="175" y="53" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.8">from_crs(src, dst, always_xy=True)</text>
  <line x1="268" y1="100" x2="454" y2="100" stroke="currentColor" stroke-width="1.3" marker-end="url(#ppj-a)"/>
  <text x="361" y="93" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.8">search operations</text>
  <line x1="454" y1="140" x2="268" y2="140" stroke="currentColor" stroke-width="1.3" stroke-dasharray="5 4" marker-end="url(#ppj-o)"/>
  <text x="361" y="133" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.8">compiled pipeline</text>
  <line x1="82" y1="180" x2="268" y2="180" stroke="currentColor" stroke-width="1.3" marker-end="url(#ppj-a)"/>
  <text x="175" y="173" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.8">transform(x_chunk, y_chunk)</text>
  <line x1="268" y1="220" x2="82" y2="220" stroke="currentColor" stroke-width="1.3" stroke-dasharray="5 4" marker-end="url(#ppj-o)"/>
  <text x="175" y="213" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.8">reprojected arrays</text>
</svg>
<!-- /fig:pyproj-build-once -->

Second, **the Transformer is a reusable, thread-safe object**. Constructing it resolves the CRS pair and selects an operation — work you do not want to repeat per point. Build it once, cache it, and call `.transform()` as many times as you like, including from multiple threads. The `.transform()` call also accepts numpy arrays directly, dispatching the whole batch into PROJ in a single C call rather than paying Python-loop overhead per coordinate.

<svg viewBox="-10 56 780 159" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="CAD reprojection flow: projected CAD point arrays in metres pass through one cached always_xy Transformer, are transformed as vectorized numpy arrays, filtered for finite values, and validated against a control point and bounding box" style="width:100%;max-width:760px;display:block;margin:1.5rem auto;">
  <title>Vectorized CAD Reprojection with a Cached pyproj Transformer</title>
  <desc>CAD point arrays in a projected CRS enter a single cached Transformer created with always_xy=True. The transformer processes the whole numpy array in one vectorized call, non-finite out-of-area results are filtered, and the output is validated against a control point and a bounding-box domain check before writing WGS84 longitude and latitude.</desc>
  <defs>
    <marker id="parrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor"/>
    </marker>
  </defs>
  <rect x="-10" y="56" width="780" height="159" fill="var(--color-surface)"/>
  <rect x="6" y="80" width="168" height="72" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="90" y="110" text-anchor="middle" font-size="11" fill="currentColor" font-family="system-ui,sans-serif">CAD point arrays</text>
  <text x="90" y="128" text-anchor="middle" font-size="10" fill="currentColor" font-family="system-ui,sans-serif" opacity="0.75">EPSG:25832, metres</text>
  <line x1="174" y1="116" x2="214" y2="116" stroke="currentColor" stroke-width="1.5" marker-end="url(#parrow)"/>
  <rect x="218" y="72" width="184" height="88" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="310" y="100" text-anchor="middle" font-size="11" fill="currentColor" font-family="system-ui,sans-serif">Cached Transformer</text>
  <text x="310" y="118" text-anchor="middle" font-size="10" fill="currentColor" font-family="system-ui,sans-serif" opacity="0.8">always_xy=True</text>
  <text x="310" y="136" text-anchor="middle" font-size="10" fill="currentColor" font-family="system-ui,sans-serif" opacity="0.8">vectorized numpy</text>
  <line x1="402" y1="116" x2="442" y2="116" stroke="currentColor" stroke-width="1.5" marker-end="url(#parrow)"/>
  <text x="422" y="104" text-anchor="middle" font-size="9" fill="currentColor" font-family="system-ui,sans-serif" opacity="0.8">isfinite</text>
  <rect x="446" y="80" width="150" height="72" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="521" y="110" text-anchor="middle" font-size="11" fill="currentColor" font-family="system-ui,sans-serif">Validate</text>
  <text x="521" y="128" text-anchor="middle" font-size="10" fill="currentColor" font-family="system-ui,sans-serif" opacity="0.75">control + bbox</text>
  <line x1="596" y1="116" x2="636" y2="116" stroke="currentColor" stroke-width="1.5" marker-end="url(#parrow)"/>
  <rect x="640" y="80" width="114" height="72" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="697" y="110" text-anchor="middle" font-size="11" fill="currentColor" font-family="system-ui,sans-serif">EPSG:4326</text>
  <text x="697" y="128" text-anchor="middle" font-size="10" fill="currentColor" font-family="system-ui,sans-serif" opacity="0.75">(lon, lat)</text>
  <text x="310" y="196" text-anchor="middle" font-size="9" fill="currentColor" font-family="system-ui,sans-serif" opacity="0.6">one Transformer built once, reused across every batch and thread</text>
</svg>

`pyproj` does not read CAD files or infer their CRS — it only transforms coordinates you hand it. Establishing that the source CRS is correct, and that the geometry is in metres, is a precondition handled upstream. What `pyproj` guarantees is a correct, datum-aware mapping between two known CRSs.

## Production-Ready Script

The script reprojects arrays of CAD points from a projected CRS (`EPSG:25832`, ETRS89 / UTM 32N) to `EPSG:4326`, in memory-bounded chunks, using one cached Transformer. It also includes a helper that auto-selects the appropriate WGS84 UTM CRS for a site.

```python
# pyproj>=3.5.0, numpy>=1.24.0, Python 3.9+
from __future__ import annotations

from functools import lru_cache

import numpy as np
from pyproj import Transformer
from pyproj.aoi import AreaOfInterest
from pyproj.database import query_utm_crs_info


@lru_cache(maxsize=64)
def get_transformer(src: str, dst: str) -> Transformer:
    """Return a cached, thread-safe Transformer for a CRS pair.

    Cached so repeated calls with the same CRS pair reuse one instance
    rather than re-resolving the operation on every batch.
    """
    return Transformer.from_crs(src, dst, always_xy=True)


def reproject_points(
    xy: np.ndarray,
    src_crs: str,
    dst_crs: str = "EPSG:4326",
    chunk_size: int = 500_000,
) -> np.ndarray:
    """Reproject an (N, 2) array of (x, y) coordinates.

    Args:
        xy:       (N, 2) array of coordinates in src_crs (x/easting, y/northing).
        src_crs:  Source CRS, e.g. "EPSG:25832". Must be a known projected CRS.
        dst_crs:  Destination CRS. Defaults to WGS84 geographic.
        chunk_size: Rows processed per PROJ call to bound peak memory.

    Returns:
        (N, 2) array in dst_crs order (lon, lat for EPSG:4326). Out-of-domain
        inputs yield non-finite rows; the caller should filter with isfinite.
    """
    xy = np.atleast_2d(np.asarray(xy, dtype=np.float64))
    if xy.shape[1] != 2:
        raise ValueError(f"Expected (N, 2) array, got shape {xy.shape}.")

    transformer = get_transformer(src_crs, dst_crs)
    out = np.empty_like(xy)
    for start in range(0, xy.shape[0], chunk_size):
        stop = start + chunk_size
        x_out, y_out = transformer.transform(
            xy[start:stop, 0], xy[start:stop, 1]
        )
        out[start:stop, 0] = x_out
        out[start:stop, 1] = y_out
    return out


def finite_mask(xy: np.ndarray) -> np.ndarray:
    """Boolean mask of rows with all-finite coordinates (drops PROJ inf/nan)."""
    return np.isfinite(xy).all(axis=1)


def auto_utm_crs(lon: float, lat: float) -> str:
    """Return the WGS84 UTM EPSG code for a site's approximate lon/lat.

    Uses pyproj's CRS database for a robust result near zone boundaries;
    falls back to the standard zone formula if the query returns nothing.
    """
    utm_list = query_utm_crs_info(
        datum_name="WGS 84",
        area_of_interest=AreaOfInterest(
            west_lon_degree=lon, south_lat_degree=lat,
            east_lon_degree=lon, north_lat_degree=lat,
        ),
    )
    if utm_list:
        return f"EPSG:{utm_list[0].code}"
    zone = int((lon + 180.0) // 6.0) + 1
    return f"EPSG:{(32600 if lat >= 0 else 32700) + zone}"


if __name__ == "__main__":
    # CAD points already in ETRS89 / UTM 32N (metres). Replace with real data.
    cad_xy = np.array([
        [500000.0, 5570000.0],
        [500250.5, 5570180.2],
        [499800.0, 5569920.7],
    ])

    lonlat = reproject_points(cad_xy, "EPSG:25832", "EPSG:4326")

    mask = finite_mask(lonlat)
    if not mask.all():
        print(f"[WARN] Dropped {(~mask).sum()} out-of-domain point(s).")
    lonlat = lonlat[mask]

    # Validate: reprojected extent must sit inside the destination domain.
    lon_min, lat_min = lonlat.min(axis=0)
    lon_max, lat_max = lonlat.max(axis=0)
    assert -180.0 <= lon_min and lon_max <= 180.0, "Longitude out of range"
    assert -90.0 <= lat_min and lat_max <= 90.0, "Latitude out of range"

    print("Site centroid CRS:", auto_utm_crs(float(lonlat[:, 0].mean()),
                                             float(lonlat[:, 1].mean())))
    for lon, lat in lonlat:
        print(f"  lon={lon:.7f}  lat={lat:.7f}")
```

**Key implementation notes:**

- `get_transformer` is wrapped in `lru_cache`, so a pipeline that reprojects thousands of batches with the same CRS pair pays the construction cost once. The cached instance is safe to call from multiple worker threads.
- `reproject_points` passes numpy arrays straight into `transformer.transform`. This is the vectorized path — PROJ processes the whole chunk in one call. Never loop `transform(x, y)` per coordinate; that is orders of magnitude slower.
- `chunk_size` bounds peak memory for very large point clouds (millions of vertices from survey drawings) without changing results. Tune it to your worker's memory budget.
- `auto_utm_crs` prefers `query_utm_crs_info`, which consults the PROJ CRS database and is correct at zone edges, and falls back to the closed-form zone formula only if the query yields nothing.
- The bounding-box asserts are a cheap regression guard: if a datum or axis mistake creeps in, reprojected coordinates leave the valid longitude/latitude range and the run fails loudly instead of writing garbage.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| Python | 3.9 – 3.13 | Uses `functools.lru_cache` and numpy broadcasting only. |
| pyproj | 3.5.0 – 3.7.x | `always_xy`, `TransformerGroup`, and `query_utm_crs_info` all stable in 3.x. |
| PROJ (C library) | 8.0 – 9.x | 8.0+ for NTv2/geoid grid-shift access; verify grid presence via `pyproj.datadir`. |
| numpy | 1.24 – 2.x | Vectorized `transform` accepts 1-D arrays of any length. |
| Source CRS | Any projected CRS in metres | Non-metre drawings must be scaled first; unknown datum cannot be reprojected. |
| Destination CRS | EPSG:4326 and projected CRSs | For 3D output, add a Z array and target a 3D CRS such as EPSG:4979. |

## Fallback Strategies

**1. Swapped coordinates from axis-order defaults**

<!-- fig:pyproj-api-choices -->
<svg viewBox="-20 -20 510.8 214.1" role="img" aria-label="Transformer.from_crs versus the deprecated transform function versus per-call Proj objects, compared on axis order, caching, array support and status" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:511px;display:block;margin:1.5rem auto;">
  <title>Three pyproj reprojection APIs compared</title>
  <desc>A comparison of the modern Transformer.from_crs API, the deprecated module-level transform function, and constructing a Proj object per call, across axis-order handling, whether the coordinate operation is cached, whether numpy arrays are accepted whole, and current support status.</desc>
  <defs>
    <marker id="ppj2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ppj2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="510.8" height="214.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="470.8" height="152" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="470.8" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">Behaviour</text>
  <text x="195.5" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Transformer.from_crs</text>
  <line x1="263.6" y1="0" x2="263.6" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="321.2" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">pyproj.transform()</text>
  <line x1="378.8" y1="0" x2="378.8" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="424.8" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Proj() per call</text>
  <line x1="127.4" y1="0" x2="127.4" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="470.8" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">Axis order control</text>
  <text x="195.5" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">always_xy flag</text>
  <text x="321.2" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">always_xy flag</text>
  <text x="424.8" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">implicit</text>
  <line x1="0" y1="62" x2="470.8" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">Operation cached</text>
  <text x="195.5" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">yes, on the object</text>
  <text x="321.2" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">no</text>
  <text x="424.8" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">no</text>
  <line x1="0" y1="92" x2="470.8" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">Whole numpy arrays</text>
  <text x="195.5" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">yes</text>
  <text x="321.2" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">yes</text>
  <text x="424.8" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">element-wise</text>
  <line x1="0" y1="122" x2="470.8" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="140.5" font-size="10.5" font-weight="600" fill="currentColor">Status</text>
  <text x="195.5" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">current</text>
  <text x="321.2" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">deprecated</text>
  <text x="424.8" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">legacy</text>
  <text x="0" y="172" font-size="9.5" fill="currentColor" fill-opacity="0.7">One Transformer per CRS pair, hoisted out of the loop, is the whole optimisation.</text>
</svg>
<!-- /fig:pyproj-api-choices -->

If reprojected points appear mirrored across the equator or land at impossible latitudes, `always_xy=True` was omitted and `pyproj` returned `(lat, lon)`. Set the flag on every `Transformer.from_crs` call. There is no downside for `(x, y)` toolchains, and it makes input and output order explicit and identical.

**2. Missing datum-shift grids degrade accuracy silently**

When the source-to-destination operation needs an NTv2 or geoid grid that is not installed, PROJ falls back to a lower-accuracy operation without raising an error. Inspect the available operations and their accuracy with `TransformerGroup`, and pick deliberately:

```python
# pyproj>=3.5.0
from pyproj.transformer import TransformerGroup

tg = TransformerGroup("EPSG:25832", "EPSG:4326", always_xy=True)
for t in tg.transformers:
    print(t.description, "| accuracy(m):", t.accuracy)
if tg.unavailable_operations:
    print("Missing grids:", len(tg.unavailable_operations))
    # tg.download_grids(verbose=True)  # fetch when network access is allowed
```

Confirm the active grid search path with `import pyproj; print(pyproj.datadir.get_data_dir())`, and pre-stage grids in air-gapped deployments.

**3. Out-of-area points return inf or nan**

A point far outside the source or destination projection domain (for example an outlier CAD vertex, or data from the wrong UTM zone) reprojects to `inf`. Writing that into PostGIS corrupts the layer's bounding box and spatial index. Always filter with the `finite_mask` helper and log the dropped inputs for review rather than passing them downstream.

**4. Per-point Transformer creation — the performance anti-pattern**

Calling `Transformer.from_crs(...)` inside the loop that processes each coordinate re-resolves the CRS pair and re-selects an operation on every iteration, which can dominate runtime by two or three orders of magnitude. Build the Transformer once (cache it, as above) and pass arrays. This single change routinely turns a multi-minute reprojection of a large survey drawing into a sub-second one.

**5. Reprojecting before units are metres**

`pyproj` assumes projected coordinates are in the CRS's linear unit — metres for UTM. A DXF drawing authored in millimetres passed straight into `EPSG:25832` is off by a factor of 1000 and lands far outside the zone, returning `inf`. Normalise units first; the [Unit Conversion Pipelines](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/) topic covers reading `$INSUNITS` and scaling geometry to metres before any reprojection.

For the datum-parameter side of alignment — when the source is not a registered CRS but a set of published transform parameters — see [Applying a Helmert 7-Parameter Transform in Python](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/applying-helmert-7-parameter-transform-in-python/). Once points are in WGS84, serialise them with [Converting CAD Polylines to GeoJSON](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/converting-cad-polylines-to-geojson/).

## FAQ

<details>
<summary><strong>Why must I pass always_xy=True to pyproj Transformer?</strong></summary>

Since `pyproj` 2.0 the library honours each CRS's authority-defined axis order. `EPSG:4326` defines its axes as `(latitude, longitude)`, so without `always_xy=True` the transform returns `(lat, lon)` — the reverse of the `(x, y)` / `(lon, lat)` order that GeoJSON, shapefiles, and CAD tooling expect. Setting `always_xy=True` forces easting/longitude first and northing/latitude second on both input and output.

</details>

<details>
<summary><strong>Should I create a new Transformer for each point?</strong></summary>

No. Building a Transformer resolves the CRS pair and selects a coordinate operation, which is comparatively expensive. Create one Transformer per source-destination pair and reuse it for every point or array — the example caches it with `lru_cache`. Transformer instances are safe to call from multiple threads, so one cached instance can serve a whole worker pool.

</details>

<details>
<summary><strong>Why do some reprojected points come back as inf?</strong></summary>

PROJ returns `inf` for coordinates outside the valid domain of the source or destination projection — for instance a vertex far outside its UTM zone, or data mislabelled with the wrong source CRS. Filter results with `numpy.isfinite` and log the offending inputs. Never write infinite coordinates into a spatial database, where they poison bounding boxes and spatial indexes.

</details>

<details>
<summary><strong>How do I pick the right UTM zone for CAD data?</strong></summary>

Estimate the site centroid's longitude and latitude, then use `pyproj.database.query_utm_crs_info` with a small area of interest to get the exact EPSG code — it is robust at zone boundaries. The closed-form fallback is `zone = floor((lon + 180) / 6) + 1`, with EPSG `326NN` in the northern hemisphere and `327NN` in the southern. The `auto_utm_crs` helper in the script combines both.

</details>

---

## Related Pages

- [CRS Normalization Workflows](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/) — parent topic: full pipeline from CRS detection through reprojection and validation
- [Applying a Helmert 7-Parameter Transform in Python](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/applying-helmert-7-parameter-transform-in-python/) — datum-shift parameters for cases where the source is not a registered CRS
- [Converting CAD Local Coordinates to EPSG:4326](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/converting-cad-local-coordinates-to-epsg4326/) — the upstream step that registers an arbitrary CAD grid to a projected CRS from survey control
- [Unit Conversion Pipelines](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/) — scaling CAD geometry to metres before any reprojection
- [Converting CAD Polylines to GeoJSON](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/converting-cad-polylines-to-geojson/) — serialising reprojected WGS84 geometry for GIS consumption
