---
title: "Extracting LWPOLYLINE Vertices with ezdxf"
description: "How to extract LWPOLYLINE vertices with ezdxf in Python: read xyb points, decode bulge arcs, flatten arcs to line segments, and handle OCS elevation."
slug: "extracting-lwpolyline-vertices-with-ezdxf"
breadcrumb:
  - label: "Python Parsing & Geometry Extraction"
    url: "/python-parsing-geometry-extraction/"
  - label: "ezdxf Deep Dive"
    url: "/python-parsing-geometry-extraction/ezdxf-deep-dive/"
  - label: "Extracting LWPOLYLINE Vertices with ezdxf"
    url: "/python-parsing-geometry-extraction/ezdxf-deep-dive/extracting-lwpolyline-vertices-with-ezdxf/"
datePublished: "2026-07-11"
dateModified: "2026-07-11"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Extracting LWPOLYLINE Vertices with ezdxf",
      "description": "How to extract LWPOLYLINE vertices with ezdxf in Python: read xyb points, decode bulge arcs, flatten arcs to line segments, and handle OCS elevation.",
      "datePublished": "2026-07-11",
      "dateModified": "2026-07-11",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/extracting-lwpolyline-vertices-with-ezdxf/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Python Parsing & Geometry Extraction", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/"},
        {"@type": "ListItem", "position": 2, "name": "ezdxf Deep Dive", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/"},
        {"@type": "ListItem", "position": 3, "name": "Extracting LWPOLYLINE Vertices with ezdxf", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/extracting-lwpolyline-vertices-with-ezdxf/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Extracting LWPOLYLINE Vertices with ezdxf",
      "description": "Query LWPOLYLINE entities from a DXF file, read bulge-aware vertices, flatten arc segments, and export closed and open rings as coordinate lists.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Query LWPOLYLINE entities", "text": "Open the DXF with ezdxf.readfile() and call msp.query('LWPOLYLINE') to collect all lightweight polylines from modelspace."},
        {"@type": "HowToStep", "position": 2, "name": "Read points with bulge", "text": "Call entity.get_points(format='xyb') to obtain (x, y, bulge) tuples that preserve the arc encoding of each segment."},
        {"@type": "HowToStep", "position": 3, "name": "Flatten arcs to line segments", "text": "Use entity.flattening(distance) to yield Vec3 points that approximate bulge arcs at a chosen maximum deviation."},
        {"@type": "HowToStep", "position": 4, "name": "Handle closure and elevation", "text": "Read entity.closed and dxf.elevation, and apply the entity OCS via entity.ocs() when the extrusion vector is non-default."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is a bulge value in an LWPOLYLINE?",
          "acceptedAnswer": {"@type": "Answer", "text": "The bulge is the tangent of one quarter of the included angle of the arc segment between two vertices. A bulge of 0 means a straight segment; a positive bulge curves counter-clockwise and a negative bulge clockwise. Convert a bulge to an explicit arc with ezdxf.math.bulge_to_arc(start, end, bulge), or flatten the whole polyline with entity.flattening(distance)."}
        },
        {
          "@type": "Question",
          "name": "Does LWPOLYLINE store 3D coordinates?",
          "acceptedAnswer": {"@type": "Answer", "text": "No. LWPOLYLINE is a lightweight 2D entity. All vertices share a single Z value stored in dxf.elevation, and the plane orientation is defined by the extrusion vector (OCS). Use entity.ocs().to_wcs() to convert elevation-plus-2D coordinates into world coordinates when the extrusion is not the default (0, 0, 1)."}
        },
        {
          "@type": "Question",
          "name": "How do I control the vertex count when flattening arcs?",
          "acceptedAnswer": {"@type": "Answer", "text": "entity.flattening(distance) takes a maximum chord-to-arc deviation (sagitta) in drawing units. A smaller distance produces more vertices and a closer approximation; a larger distance produces fewer vertices. Tune this value against your coordinate units so that a circular arc does not explode into hundreds of thousands of points on large survey drawings."}
        },
        {
          "@type": "Question",
          "name": "Why is the last vertex missing from a closed LWPOLYLINE?",
          "acceptedAnswer": {"@type": "Answer", "text": "A closed LWPOLYLINE does not repeat its first point as a final vertex; the closing segment is implied by entity.closed being True. When building a Shapely Polygon or a GeoJSON ring, append a copy of the first coordinate so the ring is explicitly closed."}
        }
      ]
    }
  ]
}
</script>

# Extracting LWPOLYLINE Vertices with ezdxf

To extract `LWPOLYLINE` vertices with `ezdxf`, query the entities from modelspace and call `entity.get_points(format="xyb")` for raw `(x, y, bulge)` tuples, or `entity.flattening(distance)` when you need every arc segment resolved into straight line segments. `LWPOLYLINE` is a lightweight 2D polyline: all its vertices lie on a single plane defined by `dxf.elevation` and the extrusion vector, and curved segments are encoded not as extra points but as *bulge* values on the preceding vertex. Getting a correct coordinate list therefore means deciding whether you want the raw control points or a flattened approximation, and whether you need to lift the 2D coordinates back into world space. This page is part of the [ezdxf Deep Dive](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/) reference on production-grade DXF parsing.

## How ezdxf Handles LWPOLYLINE Vertices

An `LWPOLYLINE` (group code entity type `LWPOLYLINE`) stores its vertices as a compact array rather than as individual `VERTEX` sub-entities the way the legacy heavyweight `POLYLINE` does. Each vertex carries up to five values: `x`, `y`, `start_width`, `end_width`, and `bulge`. `ezdxf` exposes these through `entity.get_points(format=...)`, where the `format` string selects which fields you receive per point — `"xy"` for plain coordinates, `"xyb"` for coordinates plus bulge, or `"xyseb"` for the full record.

The bulge is the mechanism that makes `LWPOLYLINE` able to represent arcs without additional entities. A bulge of `0` denotes a straight segment to the next vertex; a non-zero bulge is the tangent of one quarter of the arc's included angle. Because the arc geometry is implicit, a naive extraction that reads only `x` and `y` will silently convert every arc into a chord — a common and hard-to-spot source of area and length error in downstream GIS.

`ezdxf` gives you two ways to resolve bulges. For a single segment, `ezdxf.math.bulge_to_arc(start_point, end_point, bulge)` returns `(center, start_angle, end_angle, radius)`, letting you reconstruct the arc analytically. For the whole entity, `entity.flattening(distance)` yields `Vec3` points where each arc has been subdivided so that the maximum deviation between the true arc and the approximating chords never exceeds `distance` (the sagitta, in drawing units). The diagram below shows the two routes.

<svg viewBox="0 0 700 250" role="img" aria-label="Two extraction routes for an LWPOLYLINE: raw xyb points preserve bulges, while flattening resolves arcs into line segments at a chosen deviation" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:700px;display:block;margin:1.5rem auto;">
  <title>LWPOLYLINE Vertex Extraction Routes</title>
  <desc>Diagram contrasting two ezdxf extraction paths for an LWPOLYLINE. The raw path calls get_points with format xyb and keeps bulge values for exact arcs. The flattening path calls flattening with a deviation distance and returns line segments approximating each arc.</desc>
  <defs>
    <marker id="lwarr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" opacity="0.7"/>
    </marker>
  </defs>
  <rect x="0" y="0" width="700" height="250" fill="var(--color-surface)"/>
  <rect x="270" y="14" width="160" height="48" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="350" y="34" text-anchor="middle" font-size="12" fill="currentColor">LWPOLYLINE</text>
  <text x="350" y="51" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">vertices + bulge</text>
  <line x1="310" y1="62" x2="180" y2="96" stroke="currentColor" stroke-width="1.5" marker-end="url(#lwarr)"/>
  <line x1="390" y1="62" x2="520" y2="96" stroke="currentColor" stroke-width="1.5" marker-end="url(#lwarr)"/>
  <rect x="40" y="100" width="272" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.85"/>
  <text x="176" y="121" text-anchor="middle" font-size="11" fill="currentColor">get_points(format="xyb")</text>
  <text x="176" y="139" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">exact control points, bulge kept</text>
  <rect x="388" y="100" width="272" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.85"/>
  <text x="524" y="121" text-anchor="middle" font-size="11" fill="currentColor">flattening(distance)</text>
  <text x="524" y="139" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">arcs -&gt; line segments</text>
  <line x1="176" y1="152" x2="176" y2="188" stroke="currentColor" stroke-width="1.5" marker-end="url(#lwarr)"/>
  <line x1="524" y1="152" x2="524" y2="188" stroke="currentColor" stroke-width="1.5" marker-end="url(#lwarr)"/>
  <rect x="40" y="192" width="272" height="46" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
  <text x="176" y="212" text-anchor="middle" font-size="10" fill="currentColor">reconstruct arc via bulge_to_arc</text>
  <text x="176" y="228" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">exact radius and centre</text>
  <rect x="388" y="192" width="272" height="46" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
  <text x="524" y="212" text-anchor="middle" font-size="10" fill="currentColor">GIS-ready coordinate list</text>
  <text x="524" y="228" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">bounded vertex count</text>
</svg>

What `ezdxf` does *not* do automatically is project the 2D coordinates into world coordinates. `LWPOLYLINE` is stored in the Object Coordinate System (OCS): its `x`/`y` values are planar, its single `Z` is `dxf.elevation`, and its plane orientation is the `dxf.extrusion` vector. When the extrusion is the default `(0, 0, 1)`, OCS and WCS coincide and you can use the 2D coordinates directly. When it is anything else — common for polylines drawn on a rotated UCS — you must lift each point with `entity.ocs().to_wcs((x, y, elevation))` to get true world coordinates. It also does not apply `dxf.const_width` to geometry; that value is a rendering width, not a vertex offset.

## Production-Ready Script

The script below queries every `LWPOLYLINE`, chooses raw or flattened extraction based on whether the entity actually contains arcs, lifts coordinates through the OCS when needed, and returns a list of coordinate lists ready for [conversion of CAD polylines to GeoJSON](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/converting-cad-polylines-to-geojson/) or Shapely.

```python
# ezdxf>=1.1.0, Python 3.9+
import ezdxf
from ezdxf.math import Vec3
from typing import List, Dict, Any

def extract_lwpolylines(
    dxf_path: str,
    flatten_distance: float = 0.01,
) -> List[Dict[str, Any]]:
    """Extract LWPOLYLINE vertices from a DXF file.

    Arc segments (non-zero bulge) are flattened to line segments so that the
    chord-to-arc deviation never exceeds ``flatten_distance`` (drawing units).
    Straight-only polylines skip flattening to keep exact control points.
    Coordinates are returned in world coordinates (WCS).
    """
    doc = ezdxf.readfile(dxf_path)
    msp = doc.modelspace()

    results: List[Dict[str, Any]] = []
    for pl in msp.query("LWPOLYLINE"):
        elevation = pl.dxf.elevation                 # single Z for all vertices
        ocs = pl.ocs()                               # OCS -> WCS helper

        # (x, y, bulge) per vertex; bulge encodes the arc to the NEXT vertex.
        raw_points = pl.get_points(format="xyb")
        has_arc = any(abs(bulge) > 1e-12 for _, _, bulge in raw_points)

        if has_arc:
            # flattening() yields Vec3 in the entity's own plane (OCS space),
            # resolving every arc at the requested max deviation (sagitta).
            planar_pts = list(pl.flattening(distance=flatten_distance))
        else:
            planar_pts = [Vec3(x, y, elevation) for x, y, _ in raw_points]

        # Lift planar OCS points into world coordinates. When the extrusion is
        # the default (0, 0, 1) this is an identity transform.
        wcs_pts = [tuple(ocs.to_wcs(p)) for p in planar_pts]

        # A closed LWPOLYLINE does not repeat its first point; close it here
        # so the ring is explicit for polygon consumers.
        if pl.closed and len(wcs_pts) >= 3 and wcs_pts[0] != wcs_pts[-1]:
            wcs_pts.append(wcs_pts[0])

        results.append({
            "handle": pl.dxf.handle,
            "layer": pl.dxf.layer,
            "closed": bool(pl.closed),
            "elevation": elevation,
            "vertex_count": len(wcs_pts),
            "coordinates": wcs_pts,   # list of (x, y, z) tuples in WCS
        })

    return results

if __name__ == "__main__":
    for poly in extract_lwpolylines("input.dxf", flatten_distance=0.02):
        kind = "ring" if poly["closed"] else "path"
        print(f"{poly['handle']}: {poly['vertex_count']} pts "
              f"({kind}) on layer {poly['layer']}")
```

<!-- fig:lwpoly-bulge-flattening -->
<svg viewBox="-0.6 -8 427.5 248.1" role="img" aria-label="A bulge segment read as a chord versus the same segment flattened into short line segments that follow the arc" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:428px;display:block;margin:1.5rem auto;">
  <title>What a bulge encodes, and what flattening returns</title>
  <desc>One arc segment between two vertices, carrying a bulge of 0.5. The straight chord is what an extractor that reads only x and y produces. The subdivided polyline is what flattening returns: a chain of short segments none of which departs from the true arc by more than the requested sag tolerance. The area between the chord and the arc is the error a naive read introduces on every curved segment.</desc>
  <defs>
    <marker id="lwp1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="lwp1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-0.6" y="-8" width="427.5" height="248.1" fill="var(--color-surface)"/>
  <rect x="34" y="12" width="350" height="164" rx="4" fill="none" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="34" y1="176" x2="384" y2="176" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <line x1="34" y1="12" x2="34" y2="176" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <text x="209" y="198" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.7">X (drawing units)</text>
  <text x="26" y="94" text-anchor="end" font-size="9.5" fill="currentColor" fill-opacity="0.7">Y</text>
  <polyline points="34,16 384,16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-opacity="0.6" stroke-dasharray="6 4"/>
  <circle cx="34" cy="16" r="3.4" fill="currentColor" fill-opacity="0.55"/>
  <circle cx="384" cy="16" r="3.4" fill="currentColor" fill-opacity="0.55"/>
  <text x="41" y="32" font-size="9.5" fill="currentColor" fill-opacity="0.85">chord only</text>
  <polyline points="34,16 56.3,62.4 82.2,102 111.2,133.8 142.5,157 175.3,171.2 209,176 242.7,171.2 275.5,157 306.8,133.8 335.8,102 361.7,62.4 384,16" fill="none" stroke="currentColor" stroke-width="2" stroke-opacity="0.95"/>
  <circle cx="34" cy="16" r="2.8" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="56.3" cy="62.4" r="2.8" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="82.2" cy="102" r="2.8" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="111.2" cy="133.8" r="2.8" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="142.5" cy="157" r="2.8" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="175.3" cy="171.2" r="2.8" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="209" cy="176" r="2.8" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="242.7" cy="171.2" r="2.8" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="275.5" cy="157" r="2.8" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="306.8" cy="133.8" r="2.8" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="335.8" cy="102" r="2.8" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="361.7" cy="62.4" r="2.8" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="384" cy="16" r="2.8" fill="currentColor" fill-opacity="0.95"/>
  <text x="202" y="166" text-anchor="end" font-size="9.5" fill="currentColor" fill-opacity="0.85">flattening()</text>
  <text x="34" y="218" font-size="9.5" fill="currentColor" fill-opacity="0.7">Two vertices and a bulge of 0.5 — the arc is implicit, and reading x/y alone discards it.</text>
</svg>
<!-- /fig:lwpoly-bulge-flattening -->

**Key implementation notes:**

- `get_points(format="xyb")` returns `(x, y, bulge)` tuples. The bulge belongs to the segment leading to the *next* vertex, so the final vertex of an open polyline always has a bulge of `0`.
- `flattening(distance)` yields `Vec3` and is the correct tool when any bulge is non-zero. Skipping it on straight polylines preserves exact control points and avoids inserting redundant collinear vertices.
- `pl.ocs().to_wcs(point)` lifts planar OCS coordinates into world space. Omitting this step corrupts geometry whenever `dxf.extrusion` is not `(0, 0, 1)`.
- A closed polyline is closed by the `closed` flag, not by a duplicated final vertex. Append the first coordinate explicitly before building a `Polygon` or GeoJSON ring.
- `dxf.const_width` and per-vertex `start_width`/`end_width` are display widths; they never move a vertex and should not be added to coordinates.

## Compatibility Matrix

| Component | Supported Range | Notes |
|---|---|---|
| `ezdxf` version | `>=1.0.0` | `flattening()` and `get_points()` stable since 0.16; `>=1.1.0` recommended. |
| Python | `3.9+` | Uses `typing` generics and f-strings only. |
| DXF format | `R2000` (`AC1015`) — `R2018` (`AC1032`) | `LWPOLYLINE` introduced in R14; fully supported across this range. |
| Bulge decoding | All arcs | `ezdxf.math.bulge_to_arc` and `flattening()` cover circular arc segments; no elliptical bulges exist. |
| OCS handling | Any extrusion | Use `entity.ocs().to_wcs()`; identity when extrusion is `(0, 0, 1)`. |
| Elevation | Single Z | All vertices share `dxf.elevation`; there is no per-vertex Z. |

For the storage-level view of how these vertices are encoded as group codes `10`/`20`/`42`, see the [DXF Entity Structure Breakdown](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/).

## Fallback Strategies

Real-world drawings break naive extractors in predictable ways. Handle these scenarios in order.

<!-- fig:lwpoly-ocs-lift -->
<svg viewBox="-20 -33.5 466.1 125.8" role="img" aria-label="Planar OCS vertices plus elevation and extrusion become world coordinates through the entity OCS transform" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:466px;display:block;margin:1.5rem auto;">
  <title>Lifting planar OCS coordinates into world space</title>
  <desc>Three stages. The stored vertices are two-dimensional and live in the entity's own plane, whose orientation is the extrusion vector and whose height is the elevation. Applying the object coordinate system transform lifts them into world coordinates. Where the extrusion is the default the transform is the identity, which is why the step is so easy to omit and so damaging when the extrusion is not.</desc>
  <defs>
    <marker id="lwp2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="lwp2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-33.5" width="466.1" height="125.8" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="120" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="60" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">(x, y) + elevation</text>
  <text x="60" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">planar, in the entity</text>
  <rect x="154" y="0" width="120.2" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="214.1" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Extrusion vector</text>
  <text x="214.1" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">defines the plane</text>
  <rect x="308.2" y="0" width="117.9" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="367.1" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">(X, Y, Z) world</text>
  <text x="367.1" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">placeable geometry</text>
  <line x1="120" y1="24.1" x2="154" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#lwp2-a)"/>
  <text x="137" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">ocs().to_wcs()</text>
  <line x1="274.2" y1="24.1" x2="308.2" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#lwp2-a)"/>
  <text x="291.2" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">apply</text>
  <text x="0" y="70.2" font-size="9.5" fill="currentColor" fill-opacity="0.7">Identity when the extrusion is (0, 0, 1) — which is why omitting it passes every default-case test.</text>
</svg>
<!-- /fig:lwpoly-ocs-lift -->

**1. Mixed line and arc segments in one polyline**

A single `LWPOLYLINE` frequently interleaves straight and curved segments — for example a rounded property boundary. Do not branch per segment by hand. Test whether *any* bulge is non-zero and, if so, route the whole entity through `flattening()`. This keeps straight runs as exact two-point segments while subdividing only the arcs, because `flattening()` emits a single segment where the bulge is zero.

**2. Self-intersecting or degenerate rings**

Closed polylines exported from CAD are not guaranteed to be simple (non-self-intersecting) polygons. Before treating a closed ring as a `Polygon`, validate it with Shapely and repair if necessary:

```python
# shapely>=2.0
from shapely.geometry import Polygon
from shapely.validation import make_valid

ring = Polygon([(x, y) for x, y, *_ in poly["coordinates"]])
if not ring.is_valid:
    ring = make_valid(ring)   # may return a MultiPolygon
```

**3. Explosive vertex counts from tight tolerances**

A `flatten_distance` far smaller than the coordinate units — for example `0.001` on a drawing measured in millimetres with metre-scale arcs — can turn one arc into tens of thousands of points. Tune `flatten_distance` relative to the drawing's `$INSUNITS` scale, and log any entity whose flattened vertex count exceeds a ceiling (say 5,000) so oversized rings are reviewed rather than silently written.

**4. Closed versus open ambiguity**

Never infer closure from coincident first and last coordinates; a legitimately open polyline can end where it began. Read `entity.closed` as the single source of truth, and only then decide whether to build a `Polygon` (closed) or a `LineString` (open).

**5. Non-default OCS on rotated drawings**

Polylines drawn on a rotated UCS store an extrusion vector other than `(0, 0, 1)`. If your output geometry appears mirrored or rotated, confirm you are calling `entity.ocs().to_wcs()` on every point rather than reading raw `x`/`y`. This is the single most common cause of "the shape is right but placed wrong" bugs when moving CAD polylines into a mapping stack.

## FAQ

<details>
<summary><strong>What is a bulge value in an LWPOLYLINE?</strong></summary>

The bulge is the tangent of one quarter of the included angle of the arc segment between two vertices. A bulge of `0` means a straight segment; a positive bulge curves counter-clockwise and a negative bulge clockwise. Convert a bulge to an explicit arc with `ezdxf.math.bulge_to_arc(start, end, bulge)`, or flatten the whole polyline with `entity.flattening(distance)`.

</details>

<details>
<summary><strong>Does LWPOLYLINE store 3D coordinates?</strong></summary>

No. `LWPOLYLINE` is a lightweight 2D entity. All vertices share a single Z value stored in `dxf.elevation`, and the plane orientation is defined by the extrusion vector (OCS). Use `entity.ocs().to_wcs()` to convert elevation-plus-2D coordinates into world coordinates when the extrusion is not the default `(0, 0, 1)`.

</details>

<details>
<summary><strong>How do I control the vertex count when flattening arcs?</strong></summary>

`entity.flattening(distance)` takes a maximum chord-to-arc deviation (sagitta) in drawing units. A smaller `distance` produces more vertices and a closer approximation; a larger `distance` produces fewer vertices. Tune this value against your coordinate units so that a circular arc does not explode into hundreds of thousands of points on large survey drawings.

</details>

<details>
<summary><strong>Why is the last vertex missing from a closed LWPOLYLINE?</strong></summary>

A closed `LWPOLYLINE` does not repeat its first point as a final vertex; the closing segment is implied by `entity.closed` being `True`. When building a Shapely `Polygon` or a GeoJSON ring, append a copy of the first coordinate so the ring is explicitly closed.

</details>

---

## Related Pages

- [ezdxf Deep Dive: Production-Grade DXF Parsing](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/) — parent reference covering entity traversal, block resolution, and memory-efficient DXF processing
- [Tessellating SPLINE Entities with ezdxf](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/tessellating-splines-with-ezdxf-in-python/) — the same flattening tolerance approach applied to NURBS curves
- [Reading 3D Solids with ezdxf Python](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/reading-3d-solids-with-ezdxf-python/) — sibling workflow for `3DSOLID` ACIS payloads that polylines cannot represent
- [Converting CAD Polylines to GeoJSON](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/converting-cad-polylines-to-geojson/) — turning the extracted coordinate lists into GIS-ready features
- [DXF Entity Structure Breakdown](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/) — group code taxonomy that governs how `LWPOLYLINE` vertices and bulges are stored
