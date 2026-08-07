---
title: "Converting 3DFACE Entities to OBJ Meshes"
description: "Read DXF 3DFACE corner points with ezdxf, deduplicate a shared vertex list with tolerance, and emit 1-indexed Wavefront OBJ meshes with quad handling."
slug: "converting-3dface-entities-to-obj-meshes"
breadcrumb:
  - label: "Python Parsing & Geometry Extraction"
    url: "/python-parsing-geometry-extraction/"
  - label: "Geometry Mesh Conversion"
    url: "/python-parsing-geometry-extraction/geometry-mesh-conversion/"
  - label: "Converting 3DFACE Entities to OBJ Meshes"
    url: "/python-parsing-geometry-extraction/geometry-mesh-conversion/converting-3dface-entities-to-obj-meshes/"
datePublished: "2026-07-11"
dateModified: "2026-07-11"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Converting 3DFACE Entities to OBJ Meshes",
      "description": "Read DXF 3DFACE corner points with ezdxf, deduplicate a shared vertex list with tolerance, and emit 1-indexed Wavefront OBJ meshes with quad handling.",
      "datePublished": "2026-07-11",
      "dateModified": "2026-07-11",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Python Parsing & Geometry Extraction", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/"},
        {"@type": "ListItem", "position": 2, "name": "Geometry Mesh Conversion", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/"},
        {"@type": "ListItem", "position": 3, "name": "Converting 3DFACE Entities to OBJ Meshes", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/converting-3dface-entities-to-obj-meshes/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Converting 3DFACE Entities to OBJ Meshes",
      "description": "Extract 3DFACE corner points from a DXF file, build a shared deduplicated vertex list, and write a Wavefront OBJ mesh.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Query 3DFACE entities", "text": "Load the DXF with ezdxf.readfile() and query modelspace for 3DFACE entities, reading corner points vtx0 through vtx3."},
        {"@type": "HowToStep", "position": 2, "name": "Detect triangle vs quad", "text": "When vtx2 equals vtx3 the face is a triangle; otherwise it is a quad. Collapse repeated consecutive corners so the face carries only unique vertices."},
        {"@type": "HowToStep", "position": 3, "name": "Deduplicate vertices", "text": "Round each corner coordinate to a tolerance and use a dictionary keyed by the rounded tuple to build one shared vertex list with stable indices."},
        {"@type": "HowToStep", "position": 4, "name": "Shift to a local origin", "text": "Subtract the bounding-box minimum from every vertex so large survey coordinates do not overflow single-precision OBJ consumers."},
        {"@type": "HowToStep", "position": 5, "name": "Write Wavefront OBJ", "text": "Emit v lines for the vertex list and f lines with 1-indexed vertex references for each face."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How do I tell a triangular 3DFACE from a quad?",
          "acceptedAnswer": {"@type": "Answer", "text": "A DXF 3DFACE always stores four corner points, vtx0 through vtx3. When the fourth corner equals the third (vtx3 == vtx2), the entity is a triangle padded to four points. Compare the corners after tolerance rounding and collapse repeated consecutive vertices to recover the true triangle or quad."}
        },
        {
          "@type": "Question",
          "name": "Why are OBJ face indices off by one?",
          "acceptedAnswer": {"@type": "Answer", "text": "Wavefront OBJ vertex indices are 1-based, not 0-based. When you build a zero-based vertex list in Python, add one to every index before writing f lines, or every face will reference the wrong vertex and viewers will render scrambled geometry."}
        },
        {
          "@type": "Question",
          "name": "Do I need to triangulate 3DFACE quads for OBJ?",
          "acceptedAnswer": {"@type": "Answer", "text": "No. The OBJ format accepts polygonal faces including quads, so a four-corner 3DFACE can be written as a single f line with four indices. Triangulate only if the downstream consumer requires triangles, in which case split the quad into two triangles sharing a diagonal."}
        },
        {
          "@type": "Question",
          "name": "How do I handle 3DFACE meshes with huge coordinate values?",
          "acceptedAnswer": {"@type": "Answer", "text": "Survey-referenced DXF files place geometry at full state-plane or UTM coordinates, which lose precision when an OBJ viewer stores positions as 32-bit floats. Subtract the bounding-box minimum from every vertex to move the mesh to a local origin and record that offset so the geometry can be georeferenced later."}
        }
      ]
    }
  ]
}
</script>

# Converting 3DFACE Entities to OBJ Meshes

A DXF `3DFACE` entity stores up to four corner points and nothing else — no shared vertex table, no connectivity — so converting a drawing full of them into a compact Wavefront OBJ mesh means reading `vtx0` through `vtx3`, deduplicating coincident corners into a shared vertex list, and emitting 1-indexed `f` lines. The reliable Python route is `ezdxf` for entity access plus a dictionary keyed on rounded coordinate tuples for the dedup. This page is part of the [Geometry Mesh Conversion](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/) workflow inside the wider [Python Parsing & Geometry Extraction](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/) pipeline, and it sits alongside [Triangulating CAD Polygons with Earcut in Python](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/triangulating-cad-polygons-with-earcut-in-python/), which handles the ringed faces that `3DFACE` never encodes.

## How ezdxf Handles 3DFACE Corner Points

`3DFACE` is DXF's simplest surface primitive: a single planar (or near-planar) facet defined by three or four points. `ezdxf` exposes them as `entity.dxf.vtx0`, `vtx1`, `vtx2`, and `vtx3`, each a `Vec3` with `.x`, `.y`, `.z` attributes. There is always a `vtx3`; a triangular face is stored as a quad whose fourth corner repeats the third, so **`vtx3 == vtx2` is the triangle signal**. Detecting that collapse is the difference between a clean triangle and a zero-area sliver in the output.

`ezdxf` reads the corner coordinates verbatim and does not merge shared edges between adjacent faces. A wall exported as fifty `3DFACE` entities yields two hundred corner points even though the true vertex count is far lower. Deduplication is your job, and it must be tolerance-based: exporters round coordinates inconsistently, so two corners that are geometrically the same point can differ in the last decimal place. A dictionary keyed on the coordinate tuple rounded to a fixed number of decimals gives each unique location one stable index.

<!-- fig:face-no-connectivity -->
<svg viewBox="-20 -20 594 194.1" role="img" aria-label="A 3DFACE has no shared vertex table, no edge connectivity and no consistent winding — everything an OBJ mesh requires" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:594px;display:block;margin:1.5rem auto;">
  <title>What a soup of 3DFACE entities is missing</title>
  <desc>A DXF face carries up to four corner points and nothing else. There is no shared vertex table, so a corner touched by six faces is stored six times; there is no edge list, so nothing records that two faces are neighbours; and winding is per face, so normals do not agree. An OBJ mesh needs all three, which is why the conversion is a welding problem rather than a translation.</desc>
  <defs>
    <marker id="f3d1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="f3d1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="594" height="194.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="262" height="130" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4" stroke-dasharray="5 4"/>
  <text x="131" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">3DFACE as stored</text>
  <line x1="14" y1="33" x2="248" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="16" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— 3 or 4 corners, standalone</text>
  <text x="16" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— a shared corner stored per face</text>
  <text x="16" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— no edge or neighbour record</text>
  <text x="16" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— winding decided per face</text>
  <rect x="292" y="0" width="262" height="130" rx="6" fill="currentColor" fill-opacity="0.11" stroke="currentColor" stroke-width="1.9"/>
  <text x="423" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">What OBJ needs</text>
  <line x1="306" y1="33" x2="540" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="308" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— one vertex table</text>
  <text x="308" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— faces indexing into it</text>
  <text x="308" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— shared edges implied by indices</text>
  <text x="308" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— consistent outward normals</text>
  <text x="277" y="152" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">The conversion is vertex welding plus winding repair, not a format rewrite.</text>
</svg>
<!-- /fig:face-no-connectivity -->

<svg viewBox="0 0 700 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="3DFACE to OBJ pipeline: query 3DFACE entities, read four corner points, deduplicate corners into a shared vertex list with a rounded-tuple dictionary, then write 1-indexed OBJ v and f lines" style="width:100%;max-width:700px;display:block;margin:1.5rem auto;">
  <title>3DFACE to Wavefront OBJ Conversion Pipeline</title>
  <desc>Left to right: ezdxf queries 3DFACE entities; each entity yields corners vtx0 to vtx3; corners are rounded and deduplicated through a dictionary into a shared vertex list with stable indices; the result is written as OBJ v lines and 1-indexed f lines.</desc>
  <defs>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor"/>
    </marker>
  </defs>
  <rect x="0" y="0" width="700" height="250" fill="var(--color-surface)"/>
  <rect x="10" y="88" width="140" height="66" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="80" y="116" text-anchor="middle" font-size="12" fill="currentColor" font-weight="600">3DFACE query</text>
  <text x="80" y="136" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.75">msp.query("3DFACE")</text>
  <line x1="152" y1="121" x2="190" y2="121" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <rect x="192" y="80" width="150" height="82" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="267" y="104" text-anchor="middle" font-size="12" fill="currentColor" font-weight="600">corners</text>
  <text x="267" y="124" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.8">vtx0 . vtx1 . vtx2 . vtx3</text>
  <text x="267" y="144" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.75">vtx3 == vtx2 = triangle</text>
  <line x1="344" y1="121" x2="382" y2="121" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <rect x="384" y="80" width="158" height="82" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="463" y="104" text-anchor="middle" font-size="12" fill="currentColor" font-weight="600">dedup</text>
  <text x="463" y="124" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.8">dict[round(x,y,z)]</text>
  <text x="463" y="144" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.75">shared vertex list</text>
  <line x1="544" y1="121" x2="582" y2="121" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <rect x="584" y="88" width="106" height="66" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="637" y="112" text-anchor="middle" font-size="12" fill="currentColor" font-weight="600">.obj</text>
  <text x="637" y="132" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.75">v / f (1-indexed)</text>
  <text x="350" y="40" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.7">POLYFACE and MESH follow a separate path</text>
  <rect x="230" y="196" width="240" height="40" rx="6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="4 3"/>
  <text x="350" y="220" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.8">large origin - shift to local origin first</text>
</svg>

Two related entities need a different route. `POLYFACE` (a `POLYLINE` variant with `is_poly_face_mesh` true) and `MESH` already carry an indexed vertex/face structure through `entity.vertices` and face-record subentities, so you read their topology directly instead of deduplicating loose corners. Mixing them into the `3DFACE` path double-counts vertices. Keep the query narrow: `msp.query("3DFACE")`.

## Production-Ready Script

The script reads every `3DFACE`, deduplicates corners with a tolerance dictionary, collapses padded triangles, shifts the mesh to a local origin, and writes a valid OBJ file.

```python
# ezdxf>=1.1.0, Python 3.9+
from __future__ import annotations

import sys
from pathlib import Path

import ezdxf


def faces_to_obj(dxf_path: str, obj_path: str, ndigits: int = 6) -> int:
    """Convert all DXF 3DFACE entities to a Wavefront OBJ mesh.

    Deduplicates shared corners within 10**-ndigits tolerance, collapses
    padded triangles, and shifts geometry to a local origin. Returns the
    number of faces written. Raises RuntimeError on parse failure.
    """
    try:
        doc = ezdxf.readfile(dxf_path)
    except (IOError, ezdxf.DXFStructureError) as exc:
        raise RuntimeError(f"Cannot read DXF: {exc}") from exc

    msp = doc.modelspace()

    vertex_index: dict[tuple, int] = {}
    vertices: list[tuple[float, float, float]] = []
    faces: list[list[int]] = []

    def intern(vec) -> int:
        """Return a stable 0-based index for a corner, deduplicating by tolerance."""
        key = (round(vec.x, ndigits), round(vec.y, ndigits), round(vec.z, ndigits))
        idx = vertex_index.get(key)
        if idx is None:
            idx = len(vertices)
            vertex_index[key] = idx
            vertices.append(key)
        return idx

    for face in msp.query("3DFACE"):
        corners = [face.dxf.vtx0, face.dxf.vtx1, face.dxf.vtx2, face.dxf.vtx3]
        indices = [intern(c) for c in corners]

        # Collapse repeated consecutive corners (padded triangles, coincident pts).
        unique: list[int] = []
        for i in indices:
            if not unique or unique[-1] != i:
                unique.append(i)
        if len(unique) > 1 and unique[0] == unique[-1]:
            unique.pop()  # wrap-around duplicate

        if len(unique) < 3:
            # Degenerate face collapsed to a line or point — skip it.
            continue
        faces.append(unique)

    if not faces:
        raise RuntimeError("No usable 3DFACE geometry found in modelspace.")

    # Shift to a local origin so large survey coordinates keep OBJ precision.
    min_x = min(v[0] for v in vertices)
    min_y = min(v[1] for v in vertices)
    min_z = min(v[2] for v in vertices)

    lines: list[str] = [
        f"# Generated from {Path(dxf_path).name} — {len(faces)} faces",
        f"# local-origin offset: {min_x} {min_y} {min_z}",
    ]
    for x, y, z in vertices:
        lines.append(f"v {x - min_x:.6f} {y - min_y:.6f} {z - min_z:.6f}")
    for face in faces:
        # OBJ face indices are 1-based.
        lines.append("f " + " ".join(str(i + 1) for i in face))

    Path(obj_path).write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {len(vertices)} vertices and {len(faces)} faces to {obj_path}")
    return len(faces)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python faces_to_obj.py <input.dxf> <output.obj>")
        sys.exit(1)
    faces_to_obj(sys.argv[1], sys.argv[2])
```

Key implementation notes:

- **`vtx3 == vtx2` collapses to a triangle automatically** because both corners resolve to the same deduplicated index, and the consecutive-duplicate pass drops the repeat. You never special-case triangles explicitly.
- **OBJ indices are 1-based.** The `f` line writer adds `1` to every 0-based Python index. Forgetting this shifts the entire mesh and is the single most common cause of scrambled OBJ output.
- **Quads stay quads.** OBJ supports polygonal faces, so a genuine four-corner `3DFACE` is written as `f a b c d`. Split into two triangles only when the consumer demands it.
- **Tolerance rounding is coarse on purpose.** `ndigits=6` merges corners within one micron for metre-unit drawings. Raise it for millimetre CAD or lower it for survey data; matching the tolerance to the drawing's units prevents both over-merging and duplicate vertices.
- **Local-origin shift preserves precision.** Subtracting the bounding-box minimum keeps OBJ coordinates small; record the offset in a comment so the mesh can be georeferenced later — the same concern that drives coordinate handling across [CRS Normalization Workflows](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/).

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| Python | 3.9 – 3.12 | `dict[...]` / `list[...]` hints need `from __future__ import annotations` on 3.9. |
| `ezdxf` | ≥ 1.1.0 | `vtx0`–`vtx3` and `dxf.invisible` stable since 1.0; `query("3DFACE")` unchanged. |
| DXF versions | R12 – R2018 | `3DFACE` exists in every DXF version; no version-specific corner handling. |
| Wavefront OBJ | 1.0 | Vertex-only mesh; add `vn`/`vt` lines separately if normals or UVs are required. |
| OS | Linux, macOS, Windows | Pure Python; use `pathlib.Path` for cross-platform file paths. |

For the entity's exact group-code layout, see the [Autodesk DXF 3DFACE reference](https://help.autodesk.com/view/OARX/2024/ENU/?guid=GUID-747865D9-4F1B-4F73-9C4B-2A5A7A8B5A0A), and cross-check against the group-code taxonomy in the [DXF Entity Structure Breakdown](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/).

## Fallback Strategies

`3DFACE` conversion fails on four recurring defects. Address them in order.

<!-- fig:face-weld-pipeline -->
<svg viewBox="-45 -20 499.6 385" role="img" aria-label="Quantise corners, build the vertex table, collapse padded quads, shift to a local origin, then write faces as indices" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:500px;display:block;margin:1.5rem auto;">
  <title>The welding pipeline that produces a usable mesh</title>
  <desc>Five stages. Corners are quantised onto a tolerance grid so near-coincident points collapse to one key; the quantised keys become a vertex table; degenerate faces whose fourth corner repeats the third are collapsed to triangles; the mesh is shifted to a local origin so coordinates stay in a range floating-point can carry; and the result is written with faces indexing the table.</desc>
  <defs>
    <marker id="f3d2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="f3d2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-45" y="-20" width="499.6" height="385" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="266" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="133" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Quantise corners</text>
  <text x="133" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">onto a tolerance grid</text>
  <circle cx="-14" cy="24.1" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="27.6" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">1</text>
  <text x="284" y="27.6" font-size="9.5" fill="currentColor" fill-opacity="0.75">the tolerance is the whole decision</text>
  <rect x="0" y="74.2" width="266" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="133" y="94.5" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Build the vertex table</text>
  <text x="133" y="108.2" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">one entry per key</text>
  <circle cx="-14" cy="98.3" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="101.8" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">2</text>
  <text x="284" y="101.8" font-size="9.5" fill="currentColor" fill-opacity="0.75">six copies become one</text>
  <rect x="0" y="148.4" width="266" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="133" y="168.7" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Collapse padded quads</text>
  <text x="133" y="182.4" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">4th corner repeats the 3rd</text>
  <circle cx="-14" cy="172.5" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="176" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">3</text>
  <text x="284" y="176" font-size="9.5" fill="currentColor" fill-opacity="0.75">DXF pads triangles this way</text>
  <rect x="0" y="222.6" width="266" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="133" y="242.9" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Shift to a local origin</text>
  <text x="133" y="256.6" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">subtract the centroid</text>
  <circle cx="-14" cy="246.7" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="250.2" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">4</text>
  <text x="284" y="250.2" font-size="9.5" fill="currentColor" fill-opacity="0.75">keeps float32 usable</text>
  <rect x="0" y="296.8" width="266" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="133" y="317.1" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Write indexed faces</text>
  <text x="133" y="330.8" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">OBJ f statements</text>
  <circle cx="-14" cy="320.9" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="324.4" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">5</text>
  <text x="284" y="324.4" font-size="9.5" fill="currentColor" fill-opacity="0.75">indices, not coordinates</text>
  <line x1="133" y1="48.2" x2="133" y2="74.2" stroke="currentColor" stroke-width="1.4" marker-end="url(#f3d2-a)"/>
  <line x1="133" y1="122.4" x2="133" y2="148.4" stroke="currentColor" stroke-width="1.4" marker-end="url(#f3d2-a)"/>
  <line x1="133" y1="196.6" x2="133" y2="222.6" stroke="currentColor" stroke-width="1.4" marker-end="url(#f3d2-a)"/>
  <line x1="133" y1="270.8" x2="133" y2="296.8" stroke="currentColor" stroke-width="1.4" marker-end="url(#f3d2-a)"/>
</svg>
<!-- /fig:face-weld-pipeline -->

**1. Degenerate quads and slivers.** A face whose four corners collapse to fewer than three unique points is a line or a dot. The consecutive-duplicate pass in the script drops these, but near-degenerate quads — three near-collinear corners plus one real point — survive as slivers. After building the mesh, discard faces whose Newell-normal magnitude is below a threshold, or run `trimesh.Trimesh(...).remove_degenerate_faces()` if you route the result through `trimesh`.

**2. Coincident vertices from inconsistent rounding.** Two adjacent faces that should share an edge may store corners differing at the eighth decimal. If seams appear in the mesh, the dedup tolerance is too tight. Raise `ndigits` conservatively (for example from 6 to 4 for metre units) until adjacent faces share indices — but not so far that distinct features merge.

**3. Winding consistency.** `3DFACE` corner order is not guaranteed to be consistent across a drawing, so exported normals may point in mixed directions. OBJ itself stores no per-face normal, but downstream renderers compute them from winding. Normalize after import with `trimesh.repair.fix_winding(mesh)` (BFS winding propagation) rather than trying to reorder corners in the DXF.

**4. Very large coordinate origins.** Files referenced to a survey datum place geometry at coordinates in the millions. When an OBJ viewer stores positions as 32-bit floats, that magnitude leaves only centimetre precision. The local-origin shift in the script handles the common case; for assemblies spanning multiple tiles, compute a single shared offset across all files so the meshes stay aligned — the same discipline documented in [Understanding DWG Version Compatibility](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/understanding-dwg-version-compatibility/) for cross-file coordinate consistency.

One more attribute is worth reading: `face.dxf.invisible` is a bitmask marking which of the four edges are hidden in the CAD viewport. It does not affect geometry, so OBJ export ignores it, but if you later reconstruct wireframe display you can test bits 1–8 to reproduce the original edge visibility.

## FAQ

<details>
<summary><strong>How do I tell a triangular 3DFACE from a quad?</strong></summary>

A DXF `3DFACE` always stores four corner points, `vtx0` through `vtx3`. When the fourth corner equals the third (`vtx3 == vtx2`), the entity is a triangle padded to four points. Compare the corners after tolerance rounding and collapse repeated consecutive vertices to recover the true triangle or quad — the deduplication step does this automatically because both corners map to the same index.

</details>

<details>
<summary><strong>Why are OBJ face indices off by one?</strong></summary>

Wavefront OBJ vertex indices are 1-based, not 0-based. When you build a zero-based vertex list in Python, add one to every index before writing `f` lines, or every face will reference the wrong vertex and viewers will render scrambled geometry. The script does this with `str(i + 1)` in the face-writing loop.

</details>

<details>
<summary><strong>Do I need to triangulate 3DFACE quads for OBJ?</strong></summary>

No. The OBJ format accepts polygonal faces including quads, so a four-corner `3DFACE` can be written as a single `f` line with four indices. Triangulate only if the downstream consumer requires triangles, in which case split the quad into two triangles sharing a diagonal (`a b c` and `a c d`).

</details>

<details>
<summary><strong>How do I handle 3DFACE meshes with huge coordinate values?</strong></summary>

Survey-referenced DXF files place geometry at full state-plane or UTM coordinates, which lose precision when an OBJ viewer stores positions as 32-bit floats. Subtract the bounding-box minimum from every vertex to move the mesh to a local origin and record that offset in a comment or sidecar file so the geometry can be georeferenced again later.

</details>

---

## Related Pages

- [Geometry Mesh Conversion](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/) — parent workflow covering vertex deduplication, normal repair, and mesh export formats
- [Triangulating CAD Polygons with Earcut in Python](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/triangulating-cad-polygons-with-earcut-in-python/) — sibling guide for ringed faces with holes that `3DFACE` cannot represent
- [Converting CAD Polylines to GeoJSON](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/converting-cad-polylines-to-geojson/) — sibling guide for 2D linework extraction from the same DXF sources
- [Python Parsing & Geometry Extraction](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/) — top-level pipeline covering ingestion, extraction, and serialization stages
- [DXF Entity Structure Breakdown](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/) — cross-topic reference for the group-code layout behind `3DFACE` corner storage
