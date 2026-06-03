---
title: "Converting CAD Polylines to GeoJSON in Python"
description: "Converting CAD polylines to GeoJSON requires extracting vertex arrays from DXF/DWG entities, normalizing coordinate precision, and serializing them into RFC…"
---
# Converting CAD Polylines to GeoJSON: Production-Ready Python Pipeline

Converting CAD polylines to GeoJSON requires extracting vertex arrays from DXF/DWG entities, normalizing coordinate precision, and serializing them into RFC 7946-compliant `FeatureCollection` objects. The most reliable Python stack combines `ezdxf` for low-level DXF parsing, `shapely` for topology validation, and `geopandas` for CRS transformation and export. For proprietary DWG inputs, pre-convert to DXF using the [ODA File Converter](https://www.opendesign.com/guestfiles/oda_file_converter) or [GDAL’s DXF driver](https://gdal.org/drivers/vector/dxf.html) before execution. This pipeline bypasses vendor lock-in while preserving spatial integrity across AEC interoperability workflows.

## Architecture & Format Constraints

CAD formats store geometry as parametric entities rather than explicit coordinate arrays. `LWPOLYLINE` (lightweight) stores vertices as flat `(x, y)` tuples with optional elevation flags, while legacy `POLYLINE` entities maintain explicit 3D vertex objects. Both require explicit closure detection (`flags & 1`) to distinguish between open linework and area boundaries.

When scaling this workflow into broader [Geometry Mesh Conversion](/python-parsing-geometry-extraction/geometry-mesh-conversion/) pipelines, maintain strict separation between parsing, validation, and serialization stages. This modular approach prevents memory bloat and enables targeted error recovery when processing multi-megabyte survey exports or BIM-derived site plans.

## Core Pipeline Implementation

The foundation of any reliable [Python Parsing & Geometry Extraction](/python-parsing-geometry-extraction/) routine must handle mixed entity types, repair self-intersections, and enforce WGS84 ordering before export. The script below implements a production-grade extraction loop:

```python
import ezdxf
import geopandas as gpd
from shapely.geometry import LineString, Polygon
from shapely.validation import make_valid
import sys

def cad_polylines_to_geojson(
    dxf_path: str,
    output_path: str,
    source_crs: str,
    target_crs: str = "EPSG:4326"
) -> None:
    """Extract CAD polylines, transform CRS, and export as valid GeoJSON."""
    try:
        doc = ezdxf.readfile(dxf_path)
    except Exception as e:
        raise RuntimeError(f"DXF parse failed: {e}") from e

    msp = doc.modelspace()
    geometries = []
    properties = []

    for entity in msp:
        if entity.dxftype() not in ("LWPOLYLINE", "POLYLINE"):
            continue

        try:
            # Extract vertices safely
            if entity.dxftype() == "LWPOLYLINE":
                pts = entity.get_points()
                points = [(p[0], p[1], p[2] if len(p) > 2 else 0.0) for p in pts]
            else:
                points = [(v.dxf.location.x, v.dxf.location.y, v.dxf.location.z) 
                          for v in entity.vertices]

            if len(points) < 2:
                continue

            # Determine closure state
            is_closed = bool(entity.dxf.get("flags", 0) & 1)

            if is_closed and len(points) >= 3:
                geom = Polygon(points)
            else:
                geom = LineString(points)

            # Repair topology
            if not geom.is_valid:
                geom = make_valid(geom)

            geometries.append(geom)
            properties.append({
                "layer": entity.dxf.layer,
                "cad_type": entity.dxftype(),
                "closed": is_closed,
                "handle": entity.dxf.handle,
                "vertex_count": len(points)
            })
        except Exception as e:
            print(f"Warning: Skipping {entity.dxf.handle}: {e}", file=sys.stderr)

    if not geometries:
        raise ValueError("No valid polylines extracted from DXF.")

    # Build, transform, and export
    gdf = gpd.GeoDataFrame(properties, geometry=geometries, crs=source_crs)
    if source_crs != target_crs:
        gdf = gdf.to_crs(target_crs)

    gdf.to_file(output_path, driver="GeoJSON")
    print(f"Exported {len(gdf)} features to {output_path}")
```

## Execution Breakdown

### 1. Entity Parsing & Vertex Extraction
The parser filters the modelspace for `LWPOLYLINE` and `POLYLINE` types. Lightweight entities return compact coordinate tuples, while legacy polylines require iterating through `.vertices`. Both branches normalize to `(x, y, z)` triples to preserve survey-grade elevation data. Entities with fewer than two vertices are discarded as malformed.

### 2. Topology Validation
CAD drawings frequently contain self-intersecting boundaries, duplicate nodes, or unclosed loops labeled as closed. `shapely.validation.make_valid()` resolves these by splitting overlapping rings, collapsing zero-area polygons, and snapping floating-point drift. This step is mandatory before CRS transformation to prevent `pyproj` projection errors.

### 3. CRS Transformation
GeoJSON strictly requires WGS84 (`EPSG:4326`) with `[longitude, latitude, altitude]` axis ordering. `geopandas.GeoDataFrame.to_crs()` handles datum shifts, ellipsoid corrections, and axis reordering automatically. Always declare the source CRS explicitly; assuming `EPSG:4326` for local state plane or UTM datasets will produce coordinates shifted by thousands of kilometers.

### 4. RFC 7946 Serialization
The `to_file(driver="GeoJSON")` method serializes the `GeoDataFrame` into a standards-compliant `FeatureCollection`. It strips internal pandas indices, formats numeric precision to 7 decimal places, and enforces the required `type`, `features`, and `properties` hierarchy. For compliance verification, validate outputs against the [RFC 7946 GeoJSON Specification](https://datatracker.ietf.org/doc/html/rfc7946).

## Handling Edge Cases & Scale

| Challenge | Mitigation Strategy |
|-----------|---------------------|
| **Floating-point drift** | Round coordinates to 6–8 decimals post-transformation. CAD tolerances rarely exceed 0.001m. |
| **Massive DXF files (>500MB)** | Use `ezdxf`'s `iterdxf()` iterator or chunk by layer. Avoid loading entire modelspace into memory. |
| **Mixed 2D/3D geometries** | GeoJSON supports 3D coordinates natively. Drop Z only if downstream GIS tools explicitly require 2D. |
| **Attribute bloat** | Filter `properties` dict before `GeoDataFrame` creation. Export only `layer`, `handle`, and `cad_type` to keep payloads lean. |
| **Invalid CRS strings** | Validate with `pyproj.CRS.from_user_input()` before transformation. Catch `CRSError` early. |

For infrastructure platform teams integrating this into CI/CD pipelines, wrap the extraction function in a retry loop with exponential backoff. DXF files generated from third-party converters occasionally contain truncated entity tables or malformed binary headers. Logging skipped handles (`entity.dxf.handle`) enables rapid reconciliation with source CAD files.

When deploying at scale, consider parallelizing by layer or spatial partition. `geopandas` supports `dask-geopandas` for out-of-core operations, and `pyproj` thread-safety improves significantly in versions ≥3.4. Always benchmark transformation overhead against I/O latency; CRS conversion typically consumes 60–80% of total runtime on large datasets.

This pipeline delivers deterministic, standards-compliant outputs suitable for web mapping, spatial analysis, and automated compliance checking. By decoupling parsing from transformation and enforcing strict topology validation, teams eliminate format drift and maintain audit-ready geospatial assets across the AEC lifecycle.