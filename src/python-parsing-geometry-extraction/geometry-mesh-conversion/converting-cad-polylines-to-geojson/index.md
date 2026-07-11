---
title: "Converting CAD Polylines to GeoJSON with Python"
description: "Step-by-step guide to extracting LWPOLYLINE and POLYLINE entities from DXF files, validating topology with Shapely, reprojecting with GeoPandas, and serializing RFC 7946-compliant GeoJSON."
slug: "converting-cad-polylines-to-geojson"
type: "long_tail"
breadcrumb:
  - label: "Python Parsing & Geometry Extraction"
    url: "/python-parsing-geometry-extraction/"
  - label: "Geometry Mesh Conversion"
    url: "/python-parsing-geometry-extraction/geometry-mesh-conversion/"
  - label: "Converting CAD Polylines to GeoJSON"
    url: "/python-parsing-geometry-extraction/geometry-mesh-conversion/converting-cad-polylines-to-geojson/"
datePublished: "2025-02-14"
dateModified: "2026-06-24"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Converting CAD Polylines to GeoJSON with Python",
      "description": "Step-by-step guide to extracting LWPOLYLINE and POLYLINE entities from DXF files, validating topology with Shapely, reprojecting with GeoPandas, and serializing RFC 7946-compliant GeoJSON.",
      "datePublished": "2025-02-14",
      "dateModified": "2026-06-24",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Python Parsing & Geometry Extraction", "item": "https://cad-gis-bim-interop.org/python-parsing-geometry-extraction/"},
        {"@type": "ListItem", "position": 2, "name": "Geometry Mesh Conversion", "item": "https://cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/"},
        {"@type": "ListItem", "position": 3, "name": "Converting CAD Polylines to GeoJSON", "item": "https://cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/converting-cad-polylines-to-geojson/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Converting CAD Polylines to GeoJSON with Python",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Parse the DXF file with ezdxf", "text": "Open the DXF file with ezdxf.readfile() and iterate modelspace entities, filtering for LWPOLYLINE and POLYLINE types."},
        {"@type": "HowToStep", "position": 2, "name": "Extract vertices per entity type", "text": "Use entity.get_points('xy') for LWPOLYLINE and iterate entity.vertices for legacy 3D POLYLINE, checking the closed flag on each."},
        {"@type": "HowToStep", "position": 3, "name": "Validate topology with Shapely", "text": "Construct LineString or Polygon geometries and call make_valid() before CRS transformation to eliminate self-intersections and degenerate rings."},
        {"@type": "HowToStep", "position": 4, "name": "Reproject to WGS84", "text": "Build a GeoDataFrame with the declared source CRS, then call to_crs('EPSG:4326') to apply datum shifts and enforce axis ordering."},
        {"@type": "HowToStep", "position": 5, "name": "Serialize to RFC 7946 GeoJSON", "text": "Call gdf.to_file(output_path, driver='GeoJSON') to produce a standards-compliant FeatureCollection."}
      ]
    }
  ]
}
</script>

# Converting CAD Polylines to GeoJSON with Python

Converting CAD polylines to GeoJSON requires extracting vertex arrays from DXF entities, normalizing coordinate precision, validating topology, and serializing into RFC 7946-compliant `FeatureCollection` objects. The most reliable Python stack combines `ezdxf` for low-level DXF parsing, `shapely` for topology repair, and `geopandas` for CRS transformation and export. For proprietary DWG inputs, pre-convert to DXF using the ODA File Converter or GDAL's DXF driver before execution. This page is part of the [Geometry Mesh Conversion](/python-parsing-geometry-extraction/geometry-mesh-conversion/) workflow within the broader [Python Parsing & Geometry Extraction](/python-parsing-geometry-extraction/) pipeline.

## How DXF Handles Polyline Entities

DXF stores linework as parametric entities rather than raw coordinate arrays. Understanding which entity type you are dealing with is the first decision point in any extraction pipeline.

<svg viewBox="0 0 720 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="DXF polyline entity type decision tree: LWPOLYLINE vs POLYLINE extraction paths" style="width:100%;max-width:720px;display:block;margin:1.5rem auto;">
  <title>DXF polyline entity type decision tree</title>
  <desc>Decision diagram showing how LWPOLYLINE and POLYLINE entities differ in vertex access method, Z support, and closure detection, converging on a shared Shapely geometry construction step.</desc>
  <!-- background -->
  <rect width="720" height="320" rx="8" fill="none"/>
  <!-- entry node -->
  <rect x="270" y="14" width="180" height="40" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="360" y="39" text-anchor="middle" font-size="13" fill="currentColor" font-family="sans-serif">DXF Entity</text>
  <!-- decision diamond -->
  <polygon points="360,74 450,114 360,154 270,114" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="360" y="110" text-anchor="middle" font-size="12" fill="currentColor" font-family="sans-serif">dxftype()?</text>
  <text x="360" y="126" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">entity type</text>
  <!-- arrow from entry to diamond -->
  <line x1="360" y1="54" x2="360" y2="74" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <!-- LWPOLYLINE branch -->
  <rect x="60" y="168" width="210" height="64" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="165" y="188" text-anchor="middle" font-size="12" fill="currentColor" font-family="sans-serif" font-weight="bold">LWPOLYLINE</text>
  <text x="165" y="206" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">get_points("xy") → (x,y)</text>
  <text x="165" y="222" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">entity.closed → bool</text>
  <!-- POLYLINE branch -->
  <rect x="450" y="168" width="210" height="64" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="555" y="188" text-anchor="middle" font-size="12" fill="currentColor" font-family="sans-serif" font-weight="bold">POLYLINE (3D)</text>
  <text x="555" y="206" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">entity.vertices → xyz</text>
  <text x="555" y="222" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">dxf.flags &amp; 1 → closed</text>
  <!-- arrows from diamond to branches -->
  <line x1="270" y1="114" x2="165" y2="168" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="195" y="148" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">LWPOLYLINE</text>
  <line x1="450" y1="114" x2="555" y2="168" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="528" y="148" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">POLYLINE</text>
  <!-- merge node -->
  <rect x="240" y="258" width="240" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="360" y="276" text-anchor="middle" font-size="12" fill="currentColor" font-family="sans-serif">Shapely LineString</text>
  <text x="360" y="293" text-anchor="middle" font-size="12" fill="currentColor" font-family="sans-serif">or Polygon geometry</text>
  <!-- arrows to merge -->
  <line x1="165" y1="232" x2="270" y2="258" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <line x1="555" y1="232" x2="450" y2="258" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <!-- arrowhead marker -->
  <defs>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor"/>
    </marker>
  </defs>
</svg>

**`LWPOLYLINE` (lightweight, 2D):** introduced in DXF R14 as a space-efficient replacement for the older `POLYLINE` entity. Each vertex is stored as a `(x, y, bulge, start_width, end_width)` tuple. `entity.get_points(format="xy")` strips bulge and width data, returning plain `(x, y)` pairs. Closure state is a direct boolean attribute: `entity.closed`. Because this entity type stores no Z coordinate, pipelines that need elevation must inject a constant `z=0.0` or source elevation from a separate attribute.

**`POLYLINE` (legacy, 3D):** maintains explicit vertex objects under `entity.vertices`, each carrying `dxf.location` as an `(x, y, z)` `Vec3`. The closed flag lives in the `dxf.flags` bitmask: `bool(entity.dxf.flags & 1)` returns `True` for closed loops. This type appears frequently in drawings exported from older AutoCAD releases, Civil 3D alignments, and some surveying software.

**Bulge values and arc segments:** `LWPOLYLINE` encodes circular arc segments as a scalar "bulge" per vertex segment. `get_points("xy")` silently discards bulge values, returning only chord endpoints. For drawings containing curved road centrelines or property boundary arcs, use `ezdxf.math.bulge_to_arc()` to tessellate each bulge segment into intermediate points before constructing the `LineString`.

## Production-Ready Script

The script below handles both entity types, repairs topology, reprojects to WGS84, and writes a standards-compliant GeoJSON file. It requires Python 3.9+ and the library versions noted in the comments.

```python
# ezdxf>=1.1.0, geopandas>=0.14.0, shapely>=2.0.0, pyproj>=3.4.0
import sys
import ezdxf
import geopandas as gpd
from shapely.geometry import LineString, Polygon
from shapely.validation import make_valid
from pyproj import CRS, exceptions as proj_exc


def cad_polylines_to_geojson(
    dxf_path: str,
    output_path: str,
    source_crs: str,
    target_crs: str = "EPSG:4326",
) -> int:
    """
    Extract CAD polylines from a DXF file, validate topology, reproject,
    and write an RFC 7946 GeoJSON FeatureCollection.

    Returns the number of features written.
    Raises RuntimeError on fatal parse failures.
    Raises ValueError if no valid polyline geometries are found.
    """
    # Validate CRS strings before touching the DXF — fail fast on bad input
    try:
        src = CRS.from_user_input(source_crs)
        tgt = CRS.from_user_input(target_crs)
    except proj_exc.CRSError as e:
        raise ValueError(f"Invalid CRS: {e}") from e

    try:
        doc = ezdxf.readfile(dxf_path)
    except ezdxf.DXFStructureError as e:
        raise RuntimeError(f"DXF structure error: {e}") from e
    except Exception as e:
        raise RuntimeError(f"DXF parse failed: {e}") from e

    msp = doc.modelspace()
    geometries: list = []
    records: list = []

    for entity in msp:
        if entity.dxftype() not in ("LWPOLYLINE", "POLYLINE"):
            continue

        handle = entity.dxf.handle  # preserve for error logging

        try:
            if entity.dxftype() == "LWPOLYLINE":
                # format="xy" strips bulge + width; pad Z for 3D pipelines
                pts = [(p[0], p[1], 0.0) for p in entity.get_points("xy")]
                is_closed = entity.closed
            else:
                # Legacy POLYLINE: vertices carry explicit XYZ locations
                pts = [
                    (v.dxf.location.x, v.dxf.location.y, v.dxf.location.z)
                    for v in entity.vertices
                ]
                is_closed = bool(entity.dxf.get("flags", 0) & 1)

            if len(pts) < 2:
                print(
                    f"Warning: skipping {handle} — fewer than 2 vertices",
                    file=sys.stderr,
                )
                continue

            # Closed + ≥3 points → area boundary; otherwise → open linework
            geom = Polygon(pts) if (is_closed and len(pts) >= 3) else LineString(pts)

            # Repair topology BEFORE CRS transformation to prevent pyproj errors
            if not geom.is_valid:
                geom = make_valid(geom)

            geometries.append(geom)
            records.append(
                {
                    "layer": entity.dxf.layer,
                    "cad_type": entity.dxftype(),
                    "closed": is_closed,
                    "handle": handle,
                    "vertex_count": len(pts),
                }
            )

        except Exception as e:
            print(f"Warning: skipping {handle}: {e}", file=sys.stderr)

    if not geometries:
        raise ValueError("No valid polyline geometries extracted from DXF.")

    gdf = gpd.GeoDataFrame(records, geometry=geometries, crs=src)

    if src != tgt:
        gdf = gdf.to_crs(tgt)

    gdf.to_file(output_path, driver="GeoJSON")
    print(f"Exported {len(gdf)} features → {output_path}")
    return len(gdf)


if __name__ == "__main__":
    # Example: python script.py survey.dxf out.geojson EPSG:27700
    import argparse

    parser = argparse.ArgumentParser(description="Convert DXF polylines to GeoJSON.")
    parser.add_argument("dxf", help="Input DXF file path")
    parser.add_argument("geojson", help="Output GeoJSON file path")
    parser.add_argument("source_crs", help="Source CRS (e.g. EPSG:27700)")
    parser.add_argument("--target-crs", default="EPSG:4326")
    args = parser.parse_args()

    cad_polylines_to_geojson(
        args.dxf, args.geojson, args.source_crs, args.target_crs
    )
```

Key implementation notes:

- **CRS validation before file I/O.** `pyproj.CRS.from_user_input()` is called before opening the DXF. A bad CRS string crashes here with a clear message rather than deep inside a `to_crs()` call after processing thousands of entities.
- **`format="xy"` is mandatory on `get_points()`.** Omitting the argument returns raw tuples including bulge and width fields. `LineString` and `Polygon` constructors will raise a `ValueError` or silently embed extra dimensions if given those expanded tuples.
- **Topology repair precedes reprojection.** `make_valid()` resolves self-intersecting rings, collapses zero-area polygons, and snaps floating-point drift. Running it after reprojection can amplify projection-induced precision errors.
- **`geopandas.to_crs()` handles axis ordering automatically.** RFC 7946 mandates `[longitude, latitude]` order. `pyproj` 3.4+ enforces this for `EPSG:4326`; earlier versions required an explicit `always_xy=True` transformer.
- **Skipped entity handles are logged to stderr.** Each warning includes the DXF handle, enabling direct reconciliation with source drawings in AutoCAD or BricsCAD.

## Compatibility Matrix

| Component | Supported Range | Notes |
|-----------|----------------|-------|
| Python | 3.9 – 3.12 | f-string syntax requires 3.6+; `list[...]` type hints require 3.9+ |
| ezdxf | ≥ 1.1.0 | `get_points(format=...)` API stabilized in 1.0; R12–R2018 DXF supported |
| shapely | ≥ 2.0.0 | `make_valid()` signature changed in 2.0; 1.x API differs |
| geopandas | ≥ 0.14.0 | Requires shapely 2.x; earlier versions used shapely 1.x internally |
| pyproj | ≥ 3.4.0 | Thread-safety improvements in 3.4; `CRS.from_user_input()` since 2.2 |
| DXF versions | R12 – R2018 | `LWPOLYLINE` only exists from R14 onward; R12 files use `POLYLINE` only |
| OS | Linux, macOS, Windows | No platform-specific code; file paths should use `pathlib.Path` on Windows |

## Fallback Strategies and Troubleshooting

**1. DXF file fails to open with `DXFStructureError`.**
The file may be a binary DWG masquerading with a `.dxf` extension, or have a truncated entity table from an aborted export. Verify the file header: the first few bytes of a valid ASCII DXF read `0\nSECTION`. For genuine DWG files, convert first using `ezdxf.recover.readfile()` for recoverable ASCII DXFs, or ODA File Converter for binary DWG. See [Understanding DWG Version Compatibility](/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/understanding-dwg-version-compatibility/) for binary format pitfalls.

**2. Coordinates land thousands of kilometres from the expected location.**
The most common cause is an undeclared or wrong source CRS. A local state-plane drawing in `EPSG:27700` (British National Grid) interpreted as `EPSG:4326` will project to coordinates in the Pacific Ocean. Inspect `$INSUNITS` and `$MEASUREMENT` in the DXF header — see [How to Parse DXF Headers with Python](/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/how-to-parse-dxf-headers-with-python/) for extraction code. Cross-check against a known control point before bulk export.

**3. Output GeoJSON contains `GeometryCollection` instead of `Polygon` or `LineString`.**
`make_valid()` on a severely self-intersecting polygon can return a `GeometryCollection` mixing points, lines, and polygons. Filter with `geom.geoms` after repair and retain only `Polygon` and `MultiPolygon` types if the downstream GIS tool does not accept mixed-geometry collections. The `shapely.ops.unary_union()` call on filtered parts often reconstitutes a clean geometry.

**4. Arc-based boundaries appear as straight chord segments.**
`get_points("xy")` discards bulge values. For roads, property boundaries, and site plans with curved edges this is a silent lossy conversion. Use `ezdxf.math.bulge_to_arc()` per vertex segment and tessellate each arc to a configurable chord-length tolerance (typically 0.1 m for survey data). This is a known limitation documented in the [Geometry Mesh Conversion](/python-parsing-geometry-extraction/geometry-mesh-conversion/) cluster.

**5. Memory exhaustion on large DXF exports (> 500 MB).**
Avoid `list(msp)` — it materializes the entire modelspace into memory. Iterate `msp` as a generator and apply a layer filter early:

```python
# ezdxf>=1.1.0
TARGET_LAYERS = {"BOUNDARY", "SURVEY", "ROAD_CL"}
for entity in msp.query("LWPOLYLINE POLYLINE"):
    if entity.dxf.layer not in TARGET_LAYERS:
        continue
    # process entity
```

`msp.query("LWPOLYLINE POLYLINE")` uses ezdxf's internal entity index and avoids iterating non-polyline entities entirely, which in large civil drawings can be the majority of the file.

---

## Related Pages

- [Geometry Mesh Conversion](/python-parsing-geometry-extraction/geometry-mesh-conversion/) — parent cluster covering triangulation, coordinate normalization, and mesh export strategies
- [Python Parsing & Geometry Extraction](/python-parsing-geometry-extraction/) — top-level pipeline covering ezdxf, ifcopenshell, and pydwg integration patterns
- [Reading 3D Solids with ezdxf Python](/python-parsing-geometry-extraction/ezdxf-deep-dive/reading-3d-solids-with-ezdxf-python/) — sibling guide covering ACIS/SAT body extraction from DXF
- [How to Parse DXF Headers with Python](/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/how-to-parse-dxf-headers-with-python/) — cross-pillar reference for reading `$INSUNITS` and CRS metadata from DXF headers
- [Converting CAD Local Coordinates to EPSG:4326](/coordinate-transformation-spatial-alignment/crs-normalization-workflows/converting-cad-local-coordinates-to-epsg4326/) — CRS reprojection patterns for survey and site-plan datasets
