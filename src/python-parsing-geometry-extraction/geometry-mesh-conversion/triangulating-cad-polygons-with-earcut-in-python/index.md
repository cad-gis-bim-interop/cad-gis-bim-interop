---
title: "Triangulating CAD Polygons with Earcut in Python"
description: "Triangulate CAD faces with holes into render-ready triangles using mapbox_earcut and ezdxf, with Shapely validity checks, winding normalization, and degenerate-vertex fallbacks."
slug: "triangulating-cad-polygons-with-earcut-in-python"
breadcrumb:
  - label: "Python Parsing & Geometry Extraction"
    url: "/python-parsing-geometry-extraction/"
  - label: "Geometry Mesh Conversion"
    url: "/python-parsing-geometry-extraction/geometry-mesh-conversion/"
  - label: "Triangulating CAD Polygons with Earcut"
    url: "/python-parsing-geometry-extraction/geometry-mesh-conversion/triangulating-cad-polygons-with-earcut-in-python/"
datePublished: "2026-07-11"
dateModified: "2026-07-11"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Triangulating CAD Polygons with Earcut in Python",
      "description": "Triangulate CAD faces with holes into render-ready triangles using mapbox_earcut and ezdxf, with Shapely validity checks, winding normalization, and degenerate-vertex fallbacks.",
      "datePublished": "2026-07-11",
      "dateModified": "2026-07-11",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Python Parsing & Geometry Extraction", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/"},
        {"@type": "ListItem", "position": 2, "name": "Geometry Mesh Conversion", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/"},
        {"@type": "ListItem", "position": 3, "name": "Triangulating CAD Polygons with Earcut", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/triangulating-cad-polygons-with-earcut-in-python/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Triangulating CAD Polygons with Earcut in Python",
      "description": "Convert a CAD face expressed as an outer ring with holes into a triangle index list using Shapely validation and mapbox_earcut.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Validate rings with Shapely", "text": "Build a Shapely Polygon from the outer ring and holes, then repair it with make_valid() so self-touching or degenerate rings are resolved before triangulation."},
        {"@type": "HowToStep", "position": 2, "name": "Normalize winding order", "text": "Orient the exterior ring counter-clockwise and interior rings clockwise so the resulting triangles carry consistent outward-facing normals."},
        {"@type": "HowToStep", "position": 3, "name": "Flatten to vertices and ring end indices", "text": "Concatenate all ring coordinates into one float64 array and record the cumulative end index of each ring for the ring_end_indices argument."},
        {"@type": "HowToStep", "position": 4, "name": "Run mapbox_earcut", "text": "Call mapbox_earcut.triangulate_float64(verts, ring_end_indices) to get a flat array of vertex indices, then reshape to triangles."},
        {"@type": "HowToStep", "position": 5, "name": "Build a mesh", "text": "Lift the 2D vertices back to 3D and optionally construct a trimesh.Trimesh from the vertex and face arrays for export."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Does mapbox_earcut require a specific winding order for holes?",
          "acceptedAnswer": {"@type": "Answer", "text": "The algorithm identifies rings by the ring_end_indices argument rather than by winding, so the first ring is always treated as the outer boundary and the rest as holes. Winding still governs the orientation of the output triangles, so normalize the exterior counter-clockwise and holes clockwise when downstream consumers depend on outward-facing normals."}
        },
        {
          "@type": "Question",
          "name": "What does triangulate_float64 return?",
          "acceptedAnswer": {"@type": "Answer", "text": "It returns a flat NumPy uint32 array of vertex indices into the input vertex array. Every three consecutive indices form one triangle, so reshape the array to (-1, 3) to obtain the face list."}
        },
        {
          "@type": "Question",
          "name": "Should I use mapbox_earcut or ezdxf's triangulation helper?",
          "acceptedAnswer": {"@type": "Answer", "text": "They wrap the same algorithm. Use mapbox_earcut.triangulate_float64 for vectorized NumPy pipelines that produce index buffers for WebGL or trimesh. Use ezdxf.math.triangulation.mapbox_earcut_2d when you are already inside ezdxf and want triangles returned as Vec2 tuples without managing ring index arrays."}
        },
        {
          "@type": "Question",
          "name": "Why do my triangles overlap or invert after triangulation?",
          "acceptedAnswer": {"@type": "Answer", "text": "Overlapping or inverted triangles usually mean the input ring was self-intersecting or a hole was not fully contained inside the exterior. Run Shapely make_valid() and verify polygon.is_valid before triangulating, and confirm hole rings sit inside the exterior boundary rather than crossing it."}
        }
      ]
    }
  ]
}
</script>

# Triangulating CAD Polygons with Earcut in Python

CAD faces arrive as closed rings — an outer boundary plus zero or more interior holes — that must be decomposed into triangles before they can enter a mesh, a glTF buffer, or a WebGL draw call. The most robust Python route is ear-clipping triangulation: `mapbox_earcut.triangulate_float64(verts, ring_end_indices)` turns a flat vertex array and a set of ring boundaries into a triangle index list, handling concave outlines and holes that naive fan triangulation corrupts. This page is part of the [Geometry Mesh Conversion](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/) workflow within the broader [Python Parsing & Geometry Extraction](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/) pipeline, and it pairs directly with [Converting CAD Polylines to GeoJSON](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/converting-cad-polylines-to-geojson/), which produces the closed rings this stage consumes.

## How Earcut Handles CAD Polygons with Holes

Ear-clipping repeatedly removes "ears" — triangles formed by three consecutive vertices that contain no other vertex — until the polygon is fully triangulated. The `mapbox_earcut` package binds the same z-order-optimized C++ implementation that powers Mapbox GL, so it stays fast on the thousand-vertex outlines that hatch boundaries and building footprints produce. It accepts a single flattened vertex array and a list of **ring end indices**: the cumulative vertex count at which each ring ends. The first ring is always the exterior; every subsequent ring is treated as a hole.

Critically, earcut identifies holes by position in `ring_end_indices`, not by winding direction. Winding still matters for the *output*: the triangle vertex order it emits follows the input, so an exterior ring wound clockwise yields inward-facing normals. For meshes destined for a renderer that back-face culls, normalize orientation first — exterior counter-clockwise, holes clockwise.

<!-- fig:earcut-input-layout -->
<svg viewBox="-20 -20 448.1 175.1" role="img" aria-label="Earcut takes one flat coordinate array plus hole start indices counted in vertices, not array elements" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:448px;display:block;margin:1.5rem auto;">
  <title>How rings and holes are flattened into earcut input</title>
  <desc>The input layout the algorithm expects. All rings are concatenated into one flat coordinate array, and a separate list of hole indices marks the position at which each interior ring begins. The indices are in vertices, not in array elements, which is the off-by-two that produces a triangulation whose holes are in the wrong place.</desc>
  <defs>
    <marker id="ear1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ear1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="448.1" height="175.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="228.1" height="111" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.5"/>
  <text x="14" y="16" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">vertices  [x0,y0, x1,y1, … ]</text>
  <line x1="234.1" y1="12.9" x2="266.1" y2="12.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="274.1" y="16" font-size="9.5" fill="currentColor" fill-opacity="0.78">every ring, concatenated</text>
  <text x="14" y="35" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">exterior  vertices 0 … 5</text>
  <line x1="234.1" y1="31.9" x2="266.1" y2="31.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="274.1" y="35" font-size="9.5" fill="currentColor" fill-opacity="0.78">always first</text>
  <text x="14" y="54" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">hole 1    starts at vertex 6</text>
  <line x1="234.1" y1="50.9" x2="266.1" y2="50.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="274.1" y="54" font-size="9.5" fill="currentColor" fill-opacity="0.78">index in VERTICES, not floats</text>
  <text x="14" y="73" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">hole 2    starts at vertex 10</text>
  <text x="14" y="92" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">hole_idx  [6, 10]</text>
  <line x1="234.1" y1="88.9" x2="266.1" y2="88.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="274.1" y="92" font-size="9.5" fill="currentColor" fill-opacity="0.78">passed alongside the flat array</text>
  <text x="0" y="133" font-size="9.5" fill="currentColor" fill-opacity="0.7">Counting the index in array elements rather than vertices puts every hole in the wrong ring.</text>
</svg>
<!-- /fig:earcut-input-layout -->

The diagram below shows the flattening step that most implementations get wrong: rings are concatenated head-to-tail into one buffer, and only the boundary offsets are handed to earcut.

<svg viewBox="-2 -3 704 251" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Earcut input assembly: an outer ring and hole ring are flattened into one vertex array with ring end indices, passed to triangulate_float64, and reshaped into a triangle index list" style="width:100%;max-width:700px;display:block;margin:1.5rem auto;">
  <title>Assembling Earcut Input from CAD Rings</title>
  <desc>An outer boundary ring and an interior hole ring are validated by Shapely, concatenated into a single float64 vertex array with cumulative ring end indices, passed to triangulate_float64, and reshaped into an N by 3 triangle index list.</desc>
  <defs>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor"/>
    </marker>
  </defs>
  <rect x="-2" y="-3" width="704" height="251" fill="var(--color-surface)"/>
  <!-- Stage 1: rings -->
  <rect x="14" y="30" width="180" height="120" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="104" y="24" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.7">CAD face rings</text>
  <rect x="40" y="52" width="128" height="76" rx="3" fill="none" stroke="currentColor" stroke-width="1.3"/>
  <rect x="78" y="74" width="52" height="32" rx="2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="4 3"/>
  <text x="104" y="146" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.7">outer + hole</text>
  <!-- arrow -->
  <line x1="196" y1="90" x2="236" y2="90" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <!-- Stage 2: flatten -->
  <rect x="240" y="40" width="196" height="100" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="338" y="66" text-anchor="middle" font-size="11" fill="currentColor">verts (N x 2) float64</text>
  <text x="338" y="88" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.8">outer pts then hole pts</text>
  <text x="338" y="112" text-anchor="middle" font-size="11" fill="currentColor">ring_end_indices</text>
  <text x="338" y="128" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.8">[4, 8]</text>
  <!-- arrow -->
  <line x1="338" y1="140" x2="338" y2="182" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <!-- Stage 3: earcut -->
  <rect x="228" y="184" width="220" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="338" y="204" text-anchor="middle" font-size="11" fill="currentColor">triangulate_float64()</text>
  <text x="338" y="220" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.8">flat uint32 index array</text>
  <!-- arrow right to reshape -->
  <line x1="448" y1="206" x2="488" y2="206" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <!-- Stage 4: triangles -->
  <rect x="490" y="180" width="196" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="588" y="202" text-anchor="middle" font-size="11" fill="currentColor">reshape(-1, 3)</text>
  <text x="588" y="220" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.8">triangle index list</text>
  <!-- shapely gate note -->
  <rect x="470" y="44" width="216" height="92" rx="6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="4 3"/>
  <text x="578" y="70" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.85">Shapely gate</text>
  <text x="578" y="92" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">is_valid + make_valid</text>
  <text x="578" y="112" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">orient exterior CCW,</text>
  <text x="578" y="126" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">holes CW</text>
  <line x1="470" y1="90" x2="438" y2="90" stroke="currentColor" stroke-width="1.2" stroke-dasharray="4 3" marker-end="url(#arr)"/>
</svg>

`ezdxf` ships the same algorithm through `ezdxf.math.triangulation.mapbox_earcut_2d(exterior, holes=None)`, which returns triangles as 3-tuples of `Vec2` objects — convenient when you are already traversing DXF entities and do not want to manage NumPy index buffers. Note that in current `ezdxf` (1.x) this function lives in the `ezdxf.math.triangulation` submodule and is not re-exported at `ezdxf.math` top level, and there is no separate `ear_clipping_2d` helper. What earcut does **not** do is validate topology: it will happily triangulate a self-intersecting bow-tie ring into overlapping triangles. Validity is your responsibility, and that is where `shapely` earns its place.

## Production-Ready Script

The script takes an exterior ring and a list of hole rings, repairs them with `shapely`, normalizes winding, flattens to the earcut input layout, triangulates, and optionally returns a `trimesh.Trimesh`.

```python
# mapbox_earcut>=1.0.0, ezdxf>=1.1.0, shapely>=2.0.0, numpy>=1.24.0, Python 3.9+
# trimesh>=4.0.0 is optional (only for the mesh return path)
from __future__ import annotations

import numpy as np
import mapbox_earcut as earcut
from shapely.geometry import Polygon
from shapely.geometry.polygon import orient
from shapely.validation import make_valid


def triangulate_face(
    exterior: list[tuple[float, float]],
    holes: list[list[tuple[float, float]]] | None = None,
    z: float = 0.0,
    as_trimesh: bool = False,
):
    """Triangulate a CAD face (outer ring + holes) into vertices and faces.

    Returns (vertices Nx3 float64, faces Mx3 int64). If as_trimesh is True,
    returns a trimesh.Trimesh instead. Raises ValueError on empty or
    non-triangulable input.
    """
    holes = holes or []

    # 1. Validate and repair the ring set BEFORE triangulation.
    poly = Polygon(exterior, holes)
    if not poly.is_valid:
        repaired = make_valid(poly)
        # make_valid can return a MultiPolygon or GeometryCollection;
        # keep the largest polygon component as the face boundary.
        poly = _largest_polygon(repaired)
    if poly.is_empty or poly.area == 0.0:
        raise ValueError("Face has zero area after validity repair.")

    # 2. Normalize winding: exterior CCW (sign=1.0), interiors CW.
    poly = orient(poly, sign=1.0)

    # 3. Flatten rings into one vertex array + cumulative ring end indices.
    rings = [list(poly.exterior.coords)[:-1]]  # drop the closing duplicate
    rings += [list(r.coords)[:-1] for r in poly.interiors]

    verts_2d = np.array(
        [pt for ring in rings for pt in ring], dtype=np.float64
    )
    ring_end_indices = np.cumsum([len(r) for r in rings]).astype(np.uint32)

    if len(verts_2d) < 3:
        raise ValueError("Fewer than three vertices; nothing to triangulate.")

    # 4. Ear-clip. Result is a flat uint32 array; every 3 entries = 1 triangle.
    tri_index = earcut.triangulate_float64(verts_2d, ring_end_indices)
    if tri_index.size == 0:
        raise ValueError("Earcut produced no triangles (degenerate ring).")
    faces = tri_index.reshape(-1, 3).astype(np.int64)

    # 5. Lift back to 3D.
    verts_3d = np.column_stack([verts_2d, np.full(len(verts_2d), z)])

    if as_trimesh:
        import trimesh  # deferred import so the core path has no hard dep
        return trimesh.Trimesh(vertices=verts_3d, faces=faces, process=False)
    return verts_3d, faces


def _largest_polygon(geom) -> Polygon:
    """Return the largest Polygon component from a repaired geometry."""
    if geom.geom_type == "Polygon":
        return geom
    polys = [g for g in getattr(geom, "geoms", []) if g.geom_type == "Polygon"]
    if not polys:
        raise ValueError("Repair produced no polygonal geometry.")
    return max(polys, key=lambda g: g.area)


if __name__ == "__main__":
    # Square 10x10 with a central 4x4 hole.
    outer = [(0, 0), (10, 0), (10, 10), (0, 10)]
    hole = [(3, 3), (7, 3), (7, 7), (3, 7)]
    verts, faces = triangulate_face(outer, [hole])
    print(f"{len(verts)} vertices, {len(faces)} triangles")
    print(faces)
```

Key implementation notes:

- **`triangulate_float64` needs float64 input.** Passing a `float32` array raises a type error from the binding. Build the vertex array with `dtype=np.float64` explicitly; DXF coordinates are doubles, so this also avoids silent precision loss.
- **`ring_end_indices` are cumulative and exclusive.** For a 4-vertex outer ring and a 4-vertex hole, the array is `[4, 8]`, not `[0, 4]` or `[3, 7]`. Use `np.cumsum` over per-ring vertex counts and never include the ring's closing duplicate point.
- **Drop the closing coordinate.** Shapely rings repeat the first point at the end; earcut expects open rings, so `coords[:-1]` prevents a zero-length final edge that becomes a degenerate ear.
- **Winding sets the output normal.** `shapely.geometry.polygon.orient(poly, sign=1.0)` forces a counter-clockwise exterior and clockwise holes, so the reshaped faces have consistent, outward-facing winding for `trimesh.fix_normals()` or glTF back-face culling.
- **`process=False` on `trimesh.Trimesh`** keeps earcut's topology intact instead of letting trimesh re-merge vertices, which matters when you later map per-vertex attributes back to source ring indices.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| Python | 3.9 – 3.12 | `list[...]` and `X | None` hints require `from __future__ import annotations` on 3.9. |
| `mapbox_earcut` | ≥ 1.0.0 | `triangulate_float64` / `triangulate_float32` stable; float64 recommended for CAD doubles. |
| `ezdxf` | ≥ 1.1.0 | `mapbox_earcut_2d` lives in `ezdxf.math.triangulation`; not exported at `ezdxf.math` top level. |
| `shapely` | ≥ 2.0.0 | `make_valid()` and `orient()` are 2.x APIs; 1.x signatures differ. |
| `numpy` | ≥ 1.24.0 | `np.column_stack`, `np.cumsum` unchanged; any 1.20+ works in practice. |
| `trimesh` | ≥ 4.0.0 (optional) | Only imported on the mesh return path; core triangulation has no trimesh dependency. |

For the algorithm's guarantees and limits, see the [Mapbox earcut reference](https://github.com/mapbox/earcut), whose "not guaranteed correct but always acceptable" contract is worth reading before relying on it for survey-grade areas.

## Fallback Strategies

Earcut failures in production trace to four recurring ring defects. Handle them in this order.

<!-- fig:earcut-ring-defects -->
<svg viewBox="-20 -20 510.7 216.2" role="img" aria-label="Validate and repair a ring before triangulating — earcut returns a wrong result rather than an error on invalid input" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:511px;display:block;margin:1.5rem auto;">
  <title>Repairing a ring before triangulating it</title>
  <desc>A branch taken before the algorithm is called at all. A ring that is valid triangulates directly. A ring that is self-intersecting, has the wrong winding or repeats its closing coordinate is repaired first — the algorithm assumes simple, correctly wound input and returns a plausible but wrong triangulation rather than an error when that assumption fails.</desc>
  <defs>
    <marker id="ear2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ear2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="510.7" height="216.2" fill="var(--color-surface)"/>
  <polygon points="235.4,0 366.2,31 235.4,62 104.5,31" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-width="1.6"/>
  <text x="235.4" y="35" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">Is the ring simple and correctly wound?</text>
  <rect x="0" y="128" width="138.2" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="69.1" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Triangulate</text>
  <text x="69.1" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">directly</text>
  <path d="M 235.4 62 L 235.4 92 L 69.1 92 L 69.1 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#ear2-a)" stroke-linejoin="round"/>
  <text x="69.1" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">valid</text>
  <rect x="166.2" y="128" width="138.2" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="235.4" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">make_valid</text>
  <text x="235.4" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">may split the ring</text>
  <path d="M 235.4 62 L 235.4 92 L 235.4 92 L 235.4 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#ear2-a)" stroke-linejoin="round"/>
  <text x="235.4" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">self-intersecting</text>
  <rect x="332.5" y="128" width="138.2" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="401.6" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Reverse</text>
  <text x="401.6" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">exterior CCW, holes CW</text>
  <path d="M 235.4 62 L 235.4 92 L 401.6 92 L 401.6 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#ear2-a)" stroke-linejoin="round"/>
  <text x="401.6" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">wrong winding</text>
</svg>
<!-- /fig:earcut-ring-defects -->

**1. Invalid or self-touching exterior rings.** A ring that touches itself at a single vertex (a "pinch") is invalid, and earcut will emit overlapping triangles. Detect with `polygon.is_valid` and repair with `make_valid()`. Because `make_valid` can split a pinched ring into a `MultiPolygon`, keep the largest component (as `_largest_polygon` does) or triangulate each part separately when both carry real area.

**2. Wrong hole orientation or containment.** If a hole ring is not fully inside the exterior — a common artifact when DWG hatch islands are exported with a shifted origin — the Shapely `Polygon` constructor still builds an object, but the triangulation is meaningless. Assert containment with `poly.exterior.contains(Polygon(hole))` before flattening, and drop or log holes that fail. Orientation itself is normalized by `orient()`, so never rely on the source file's winding.

**3. Collinear or degenerate vertices.** Three collinear points contribute a zero-area ear that earcut skips, but long runs of near-collinear survey vertices inflate the ear search. Simplify with `poly.simplify(tolerance, preserve_topology=True)` using a tolerance below your feature resolution (for example `1e-4` m for architectural work) to strip redundant vertices before triangulation.

**4. Precision snapping for near-coincident points.** Vertices that differ by sub-micron amounts create slivers that pass `is_valid` yet produce needle triangles. Snap coordinates to a grid before building the polygon:

```python
# numpy>=1.24.0
def snap(coords, tol: float = 1e-6):
    """Round ring coordinates to a tolerance grid to collapse near-duplicates."""
    arr = np.asarray(coords, dtype=np.float64)
    return np.round(arr / tol) * tol
```

This mirrors the tolerance-based vertex snapping used across the [Python Parsing & Geometry Extraction](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/) pipeline and keeps earcut output free of zero-area faces that would later fail `trimesh.is_watertight`.

## FAQ

<details>
<summary><strong>Does mapbox_earcut require a specific winding order for holes?</strong></summary>

The algorithm identifies rings by the `ring_end_indices` argument rather than by winding, so the first ring is always treated as the outer boundary and the rest as holes. Winding still governs the orientation of the output triangles, so normalize the exterior counter-clockwise and holes clockwise with `shapely.geometry.polygon.orient(poly, sign=1.0)` when downstream consumers depend on outward-facing normals.

</details>

<details>
<summary><strong>What does triangulate_float64 return?</strong></summary>

It returns a flat NumPy `uint32` array of vertex indices into the input vertex array. Every three consecutive indices form one triangle, so reshape the array to `(-1, 3)` to obtain the face list. The indices reference the flattened vertex buffer you passed in, which is why the ring order and `ring_end_indices` must match that buffer exactly.

</details>

<details>
<summary><strong>Should I use mapbox_earcut or ezdxf's triangulation helper?</strong></summary>

They wrap the same underlying algorithm. Use `mapbox_earcut.triangulate_float64` for vectorized NumPy pipelines that produce index buffers for WebGL or `trimesh`. Use `ezdxf.math.triangulation.mapbox_earcut_2d` when you are already inside `ezdxf` and want triangles returned directly as `Vec2` tuples without assembling ring index arrays yourself.

</details>

<details>
<summary><strong>Why do my triangles overlap or invert after triangulation?</strong></summary>

Overlapping or inverted triangles usually mean the input ring was self-intersecting or a hole was not fully contained inside the exterior. Run `make_valid()` and verify `polygon.is_valid` before triangulating, and confirm hole rings sit inside the exterior boundary rather than crossing it. Inverted normals specifically indicate a clockwise exterior — re-run `orient()`.

</details>

---

## Related Pages

- [Geometry Mesh Conversion](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/) — parent workflow covering coordinate normalization, topology repair, and mesh export that surrounds this triangulation step
- [Converting CAD Polylines to GeoJSON](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/converting-cad-polylines-to-geojson/) — sibling guide that extracts the closed `LWPOLYLINE` rings this page triangulates
- [Converting 3DFACE Entities to OBJ Meshes](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/converting-3dface-entities-to-obj-meshes/) — sibling guide for the already-faceted DXF geometry that needs no ear-clipping
- [Python Parsing & Geometry Extraction](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/) — top-level pipeline covering DXF, IFC, and DWG ingestion feeding this mesh stage
- [Reading 3D Solids with ezdxf Python](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/reading-3d-solids-with-ezdxf-python/) — cross-topic reference for the parametric solids that must be faceted before triangulation applies
