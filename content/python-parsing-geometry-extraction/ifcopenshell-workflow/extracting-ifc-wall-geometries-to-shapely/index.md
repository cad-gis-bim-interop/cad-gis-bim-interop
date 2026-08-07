---
title: "Extracting IFC Wall Geometries to Shapely"
description: "Project IFC wall geometry onto the horizontal plane with ifcopenshell, convert it to valid Shapely polygons, and feed the result into GIS and CAD pipelines."
slug: "extracting-ifc-wall-geometries-to-shapely"
breadcrumb:
  - label: "Python Parsing & Geometry Extraction"
    url: "/python-parsing-geometry-extraction/"
  - label: "IfcOpenShell Workflow"
    url: "/python-parsing-geometry-extraction/ifcopenshell-workflow/"
  - label: "Extracting IFC Wall Geometries to Shapely"
    url: "/python-parsing-geometry-extraction/ifcopenshell-workflow/extracting-ifc-wall-geometries-to-shapely/"
datePublished: "2025-06-01"
dateModified: "2026-06-24"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Extracting IFC Wall Geometries to Shapely",
      "description": "Project IFC wall geometry onto the horizontal plane with ifcopenshell, convert it to valid Shapely polygons, and feed the result into GIS and CAD pipelines.",
      "datePublished": "2025-06-01",
      "dateModified": "2026-06-24",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Python Parsing & Geometry Extraction", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/"},
        {"@type": "ListItem", "position": 2, "name": "IfcOpenShell Workflow", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/"},
        {"@type": "ListItem", "position": 3, "name": "Extracting IFC Wall Geometries to Shapely", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/extracting-ifc-wall-geometries-to-shapely/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Extracting IFC Wall Geometries to Shapely",
      "description": "Project IFC wall geometry to 2D Shapely Polygons using ifcopenshell and numpy.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Load the IFC model and query IfcWall entities", "text": "Open the IFC file with ifcopenshell.open() and call model.by_type('IfcWall') to retrieve all wall elements."},
        {"@type": "HowToStep", "position": 2, "name": "Configure geometry settings", "text": "Set USE_WORLD_COORDS, disable INCLUDE_CURVES, and disable APPLY_DEFAULT_MATERIALS to obtain pure mesh data from the OpenCASCADE kernel."},
        {"@type": "HowToStep", "position": 3, "name": "Extract vertex and face arrays", "text": "Call ifcopenshell.geom.create_shape() then retrieve vertices and faces via ifcopenshell.util.shape helpers."},
        {"@type": "HowToStep", "position": 4, "name": "Project to 2D and build Shapely Polygons", "text": "Drop the Z axis, map each triangulated face to a Shapely Polygon, and filter by minimum area to discard projection artifacts."},
        {"@type": "HowToStep", "position": 5, "name": "Merge and validate", "text": "Use shapely.ops.unary_union to merge adjacent triangles, then call shapely.make_valid() to repair self-intersections before exporting."}
      ]
    }
  ]
}
</script>

# Extracting IFC Wall Geometries to Shapely

The direct answer: open the IFC file with `ifcopenshell`, configure the geometry kernel to return world-coordinate meshes, project each triangulated face to the XY plane, build `Polygon` objects from the resulting coordinate pairs, merge adjacent triangles with `shapely.ops.unary_union`, and repair topology with `shapely.make_valid()`. The full pipeline runs in pure Python with no external CAD software. For the broader context of working with IFC geometry at scale, see the [IfcOpenShell Workflow](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/) guide.

---

## How IfcOpenShell Handles Wall Geometry

IfcOpenShell delegates geometry resolution to the **OpenCASCADE (OCCT)** kernel, which is bundled with the `ifcopenshell-python` wheel. When you call `ifcopenshell.geom.create_shape()`, OCCT reads the wall's native representation — `IfcExtrudedAreaSolid`, `IfcFacetedBrep`, or a B-Rep body — evaluates any nested boolean operations (openings for doors and windows), and tessellates the result into a triangulated mesh. The `ifcopenshell.util.shape` helpers then expose that mesh as flat numpy-compatible arrays.

What the API does **not** do automatically:

<!-- fig:wall-world-coords -->
<svg viewBox="-20 -20 586 194.1" role="img" aria-label="Without USE_WORLD_COORDS each mesh is in its own local frame; with it the kernel composes the placement chain" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:586px;display:block;margin:1.5rem auto;">
  <title>What the world-coordinates setting changes</title>
  <desc>The same wall evaluated with and without world coordinates. Without the setting, each mesh comes back in the product's own local frame and the placement chain — storey, building, site — has to be composed and applied by hand for every element. With it, the kernel composes the chain and returns vertices already in the model's coordinate system, which is what any spatial union needs.</desc>
  <defs>
    <marker id="wal1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="wal1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="586" height="194.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="258" height="130" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4" stroke-dasharray="5 4"/>
  <text x="129" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Local coordinates</text>
  <line x1="14" y1="33" x2="244" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="16" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— mesh in the product frame</text>
  <text x="16" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— placement chain applied by hand</text>
  <text x="16" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— walls stack at the origin</text>
  <text x="16" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— a union merges unrelated walls</text>
  <rect x="288" y="0" width="258" height="130" rx="6" fill="currentColor" fill-opacity="0.11" stroke="currentColor" stroke-width="1.9"/>
  <text x="417" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">USE_WORLD_COORDS</text>
  <line x1="302" y1="33" x2="532" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="304" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— kernel composes the chain</text>
  <text x="304" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— vertices in the model frame</text>
  <text x="304" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— walls sit where they belong</text>
  <text x="304" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— union means what you expect</text>
  <text x="273" y="152" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">Everything lands at the origin without it — and a union of everything is one shape.</text>
</svg>
<!-- /fig:wall-world-coords -->

- It does not project 3D geometry to 2D. That step belongs entirely to your code.
- It does not guarantee topologically valid 2D polygons after projection. Vertical or near-vertical triangles collapse to degenerate lines when you drop the Z coordinate.
- It does not distinguish between IFC2x3 `IfcWallStandardCase` and IFC4 `IfcWall` at the shape-creation level — both go through the same OCCT pipeline, but unit and precision defaults differ between schema versions.

The diagram below shows the data-flow from IFC file to validated Shapely geometry.

<svg viewBox="-12 44 744 106" role="img" aria-label="Data-flow diagram: IFC file through IfcOpenShell geometry kernel to validated Shapely Polygon" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:720px;display:block;margin:1.5rem auto;font-family:inherit;">
  <title>IFC wall geometry extraction pipeline</title>
  <desc>Five sequential stages: IFC File → OCCT Tessellation → Vertex/Face Arrays → 2D Projection → Shapely Polygon (validated)</desc>
  <defs>
    <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" opacity="0.6"/>
    </marker>
  </defs>
  <rect x="-12" y="44" width="744" height="106" fill="var(--color-surface)"/>
  <!-- Stage boxes -->
  <rect x="4"   y="60" width="116" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>
  <rect x="152" y="60" width="116" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>
  <rect x="300" y="60" width="120" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>
  <rect x="452" y="60" width="116" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>
  <rect x="600" y="60" width="116" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>
  <!-- Labels -->
  <text x="62"  y="82"  text-anchor="middle" font-size="11" fill="currentColor" opacity="0.9" font-weight="600">IFC File</text>
  <text x="62"  y="98"  text-anchor="middle" font-size="10" fill="currentColor" opacity="0.65">IfcWall entities</text>
  <text x="210" y="82"  text-anchor="middle" font-size="11" fill="currentColor" opacity="0.9" font-weight="600">OCCT Kernel</text>
  <text x="210" y="98"  text-anchor="middle" font-size="10" fill="currentColor" opacity="0.65">tessellation</text>
  <text x="360" y="82"  text-anchor="middle" font-size="11" fill="currentColor" opacity="0.9" font-weight="600">Mesh Arrays</text>
  <text x="360" y="98"  text-anchor="middle" font-size="10" fill="currentColor" opacity="0.65">verts + faces</text>
  <text x="510" y="82"  text-anchor="middle" font-size="11" fill="currentColor" opacity="0.9" font-weight="600">2D Projection</text>
  <text x="510" y="98"  text-anchor="middle" font-size="10" fill="currentColor" opacity="0.65">drop Z axis</text>
  <text x="658" y="82"  text-anchor="middle" font-size="11" fill="currentColor" opacity="0.9" font-weight="600">Shapely</text>
  <text x="658" y="98"  text-anchor="middle" font-size="10" fill="currentColor" opacity="0.65">Polygon (valid)</text>
  <!-- Arrows -->
  <line x1="120" y1="86" x2="148" y2="86" stroke="currentColor" stroke-width="1.5" opacity="0.55" marker-end="url(#arrowhead)"/>
  <line x1="268" y1="86" x2="296" y2="86" stroke="currentColor" stroke-width="1.5" opacity="0.55" marker-end="url(#arrowhead)"/>
  <line x1="420" y1="86" x2="448" y2="86" stroke="currentColor" stroke-width="1.5" opacity="0.55" marker-end="url(#arrowhead)"/>
  <line x1="568" y1="86" x2="596" y2="86" stroke="currentColor" stroke-width="1.5" opacity="0.55" marker-end="url(#arrowhead)"/>
  <!-- Step labels below -->
  <text x="62"  y="132" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.5">Step 1</text>
  <text x="210" y="132" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.5">Step 2</text>
  <text x="360" y="132" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.5">Step 3</text>
  <text x="510" y="132" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.5">Step 4</text>
  <text x="658" y="132" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.5">Step 5</text>
</svg>

The extraction process follows five deterministic steps:

1. **Model loading and query** — parse the IFC file and filter `IfcWall` (and optionally `IfcWallStandardCase`) entities. Avoid recursive type traversal unless you explicitly need `IfcProxy` or legacy classifications.
2. **Geometry settings configuration** — enable world coordinates, disable curve inclusion, and disable material application so the kernel returns pure mesh data.
3. **Mesh extraction** — retrieve flattened vertex arrays and face index lists. OCCT tessellates complex solids into triangles, so each face contains exactly three vertex indices.
4. **Axis projection** — drop the target axis (Z for floor-plan views) and map the remaining coordinates to `(x, y)` tuples, maintaining consistent winding order.
5. **Topology assembly** — convert projected triangles to Shapely polygons, merge with `unary_union`, and repair with `make_valid`.

## Production-Ready Script

The script below handles projection, validation, and merging in a single pass. It is structured for batch processing and includes explicit per-element error routing so a single corrupt wall does not abort the run.

```python
# ifcopenshell>=0.8.0, shapely>=2.0.0, numpy>=1.24.0
import ifcopenshell
import ifcopenshell.geom
import ifcopenshell.util.shape
from shapely.geometry import Polygon, MultiPolygon
import shapely
import shapely.ops
import numpy as np
from typing import Literal


def extract_walls_to_shapely(
    ifc_path: str,
    projection_axis: Literal["X", "Y", "Z"] = "Z",
    min_area: float = 0.001,
    include_standard_case: bool = True,
) -> list[dict]:
    """
    Extract IfcWall (and optionally IfcWallStandardCase) geometries and
    convert them to validated Shapely Polygon / MultiPolygon objects.

    Returns a list of dicts with keys:
        id        (str)  GlobalId of the wall element
        name      (str)  Name attribute, may be None
        geometry  (Polygon | MultiPolygon | None)
        status    (str)  "success" | "no_faces" | "error"
        message   (str)  present only when status == "error"
    """
    model = ifcopenshell.open(ifc_path)

    # Collect wall types — IfcWallStandardCase is a subtype of IfcWall in
    # IFC2x3; IFC4 merges them, but both strings remain valid to query.
    entity_types = ["IfcWall"]
    if include_standard_case:
        entity_types.append("IfcWallStandardCase")

    walls = []
    seen_ids: set[str] = set()
    for etype in entity_types:
        for w in model.by_type(etype):
            if w.GlobalId not in seen_ids:
                walls.append(w)
                seen_ids.add(w.GlobalId)

    # Configure geometry kernel: world coordinates, mesh-only output.
    settings = ifcopenshell.geom.settings()
    settings.set(settings.USE_WORLD_COORDS, True)
    settings.set(settings.EXCLUDE_SOLIDS_AND_SURFACES, False)
    settings.set(settings.INCLUDE_CURVES, False)
    settings.set(settings.APPLY_DEFAULT_MATERIALS, False)

    axis_map = {"X": 0, "Y": 1, "Z": 2}
    proj_idx = axis_map[projection_axis.upper()]
    other_axes = [i for i in range(3) if i != proj_idx]

    results: list[dict] = []

    for wall in walls:
        try:
            shape = ifcopenshell.geom.create_shape(settings, wall)
            # get_vertices returns a flat list; reshape to (N, 3)
            verts = np.array(
                ifcopenshell.util.shape.get_vertices(shape)
            ).reshape(-1, 3)
            faces = ifcopenshell.util.shape.get_faces(shape)

            polygons: list[Polygon] = []
            for face in faces:
                # Project each triangle vertex to the 2D plane
                coords = [
                    (float(verts[i][other_axes[0]]),
                     float(verts[i][other_axes[1]]))
                    for i in face
                ]
                try:
                    poly = Polygon(coords)
                    if poly.is_valid and poly.area > min_area:
                        polygons.append(poly)
                except Exception:
                    # Degenerate triangle (e.g. all vertices collinear)
                    continue

            if not polygons:
                results.append({
                    "id": wall.GlobalId,
                    "name": getattr(wall, "Name", None),
                    "geometry": None,
                    "status": "no_faces",
                })
                continue

            # Merge adjacent triangles into a coherent wall footprint
            merged = shapely.ops.unary_union(polygons)
            # Repair self-intersections produced by projection
            valid_geom = shapely.make_valid(merged)

            results.append({
                "id": wall.GlobalId,
                "name": getattr(wall, "Name", None),
                "geometry": valid_geom,
                "status": "success",
            })

        except Exception as exc:
            results.append({
                "id": wall.GlobalId,
                "name": getattr(wall, "Name", None),
                "geometry": None,
                "status": "error",
                "message": str(exc),
            })

    return results


# ── Usage ──────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import json

    walls = extract_walls_to_shapely("model.ifc", projection_axis="Z")

    success = [w for w in walls if w["status"] == "success"]
    errors  = [w for w in walls if w["status"] == "error"]

    print(f"Extracted {len(success)} walls, {len(errors)} errors")

    # Export to GeoJSON for PostGIS / QGIS ingestion
    features = []
    for w in success:
        features.append({
            "type": "Feature",
            "properties": {"globalId": w["id"], "name": w["name"]},
            "geometry": shapely.to_geojson(w["geometry"])
                        if hasattr(shapely, "to_geojson")
                        else w["geometry"].__geo_interface__,
        })

    with open("walls.geojson", "w") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f)
```

Key implementation notes:

- `USE_WORLD_COORDS` applies the element's placement transform before tessellation, so all vertices arrive in the model's global coordinate system. Omitting this flag returns geometry in the element's local frame, breaking multi-wall spatial queries.
- The `min_area` threshold (default `0.001` m²) discards near-degenerate triangles that arise when vertical wall faces are projected flat. Adjust for your model's unit convention (IFC defaults to metres).
- `shapely.make_valid()` was added in Shapely 1.8 and stabilised in 2.0. It repairs the most common projection artefacts: self-touching rings, inward spikes, and zero-width slivers that `unary_union` does not fully eliminate.
- Store `GlobalId` as the foreign key in any downstream spatial database. It is the only stable cross-tool identifier that survives round-trips through Revit, ArchiCAD, and IFC exporters.

For handling the mesh arrays themselves in more complex scenarios — including normal-direction filtering to isolate horizontal versus vertical faces — see [Geometry & Mesh Conversion](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/).

## Compatibility Matrix

| Component | Supported Range | Notes |
|-----------|-----------------|-------|
| Python | 3.9 – 3.12 | Python 3.8 reached end-of-life October 2024 |
| ifcopenshell | ≥ 0.8.0 | Earlier releases lack `ifcopenshell.util.shape`; `get_vertices` / `get_faces` API stabilised in 0.7.0 |
| Shapely | ≥ 2.0.0 | `shapely.make_valid()` as a top-level function requires ≥ 2.0; use `shapely.validation.make_valid()` on 1.8.x |
| NumPy | ≥ 1.24.0 | Used only for vertex reshape; any NumPy 1.x ≥ 1.20 works in practice |
| IFC schema | IFC2x3, IFC4, IFC4x3 | IFC2x3 `IfcWallStandardCase` is handled identically by OCCT; IFC4x3 `IfcWall` with `IfcAdvancedBrepWithVoids` requires ≥ 0.8.0 |
| OS | Linux, macOS, Windows | OCCT kernel is bundled; no external CAD dependencies |
| Memory | ~200 MB per 1,000 walls | OpenCASCADE caches tessellation state; process in batches of 500 – 1,000 for large models |

## Fallback Strategies / Troubleshooting

**1. `create_shape` raises `RuntimeError: No geometry for element`**

<!-- fig:wall-projection-order -->
<svg viewBox="-45 -20 457.2 310.8" role="img" aria-label="Read triangles, project to plan, drop degenerate projections, then union into one polygon" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:457px;display:block;margin:1.5rem auto;">
  <title>Projecting a wall mesh down to a plan polygon</title>
  <desc>Four stages. The triangle list is read from the compiled mesh, each triangle is projected onto the horizontal plane, degenerate projections — triangles that were vertical and collapse to a line — are dropped, and what remains is unioned into one polygon. Dropping the degenerate triangles before the union is what keeps the union from failing on zero-area input.</desc>
  <defs>
    <marker id="wal2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="wal2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-45" y="-20" width="457.2" height="310.8" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="262" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="131" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Read triangles</text>
  <text x="131" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">from the compiled mesh</text>
  <circle cx="-14" cy="24.1" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="27.6" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">1</text>
  <text x="280" y="27.6" font-size="9.5" fill="currentColor" fill-opacity="0.75">flat vertex + index arrays</text>
  <rect x="0" y="74.2" width="262" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="131" y="94.5" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Project to plan</text>
  <text x="131" y="108.2" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">drop Z</text>
  <circle cx="-14" cy="98.3" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="101.8" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">2</text>
  <text x="280" y="101.8" font-size="9.5" fill="currentColor" fill-opacity="0.75">vertical faces collapse</text>
  <rect x="0" y="148.4" width="262" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="131" y="168.7" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Drop degenerates</text>
  <text x="131" y="182.4" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">zero-area projections</text>
  <circle cx="-14" cy="172.5" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="176" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">3</text>
  <text x="280" y="176" font-size="9.5" fill="currentColor" fill-opacity="0.75">before the union, not after</text>
  <rect x="0" y="222.6" width="262" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="131" y="242.9" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Union</text>
  <text x="131" y="256.6" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">one wall footprint</text>
  <circle cx="-14" cy="246.7" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="250.2" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">4</text>
  <text x="280" y="250.2" font-size="9.5" fill="currentColor" fill-opacity="0.75">the expensive stage</text>
  <line x1="131" y1="48.2" x2="131" y2="74.2" stroke="currentColor" stroke-width="1.4" marker-end="url(#wal2-a)"/>
  <line x1="131" y1="122.4" x2="131" y2="148.4" stroke="currentColor" stroke-width="1.4" marker-end="url(#wal2-a)"/>
  <line x1="131" y1="196.6" x2="131" y2="222.6" stroke="currentColor" stroke-width="1.4" marker-end="url(#wal2-a)"/>
</svg>
<!-- /fig:wall-projection-order -->

The wall entity has no body representation — common in early-stage Revit exports where walls exist as schedule objects without 3D geometry. Filter before processing:

```python
from ifcopenshell.util.element import get_psets

def has_body_representation(wall) -> bool:
    if not wall.Representation:
        return False
    return any(
        rep.RepresentationIdentifier == "Body"
        for rep in wall.Representation.Representations
    )

walls = [w for w in model.by_type("IfcWall") if has_body_representation(w)]
```

**2. Projected polygons produce only `LineString` or `Point` geometries**

All tessellation triangles lie in a vertical plane — the wall is perfectly perpendicular to your projection axis. Switch the projection axis or pre-filter by face normal:

```python
def face_normal(verts, face):
    """Compute the unit normal of a triangular face."""
    v0, v1, v2 = [verts[i] for i in face]
    edge1 = v1 - v0
    edge2 = v2 - v0
    n = np.cross(edge1, edge2)
    length = np.linalg.norm(n)
    return n / length if length > 1e-10 else np.zeros(3)

# Keep only faces with a significant Z component (near-horizontal)
horizontal_faces = [
    f for f in faces
    if abs(face_normal(verts, f)[2]) > 0.5
]
```

**3. Unit mismatch — wall footprints are 1,000× too large or too small**

IFC files default to metres, but older Revit and ArchiCAD exports embed millimetres without a proper `IfcSIUnit` declaration. Check the project unit and apply a scale factor:

```python
from ifcopenshell.util.unit import calculate_unit_assignment

unit_scale = calculate_unit_assignment(model, "LENGTHUNIT")
# unit_scale == 0.001 when the file uses millimetres
verts = verts * unit_scale
```

**4. `shapely.make_valid` returns a `GeometryCollection` instead of a `Polygon`**

This happens when the merged geometry contains disconnected components (e.g. wall openings split a wall into multiple segments). Extract only polygon-type members:

```python
from shapely.geometry import GeometryCollection

def extract_polygons(geom):
    if geom.is_empty:
        return None
    if isinstance(geom, (Polygon, MultiPolygon)):
        return geom
    if isinstance(geom, GeometryCollection):
        polys = [g for g in geom.geoms if isinstance(g, (Polygon, MultiPolygon))]
        return shapely.ops.unary_union(polys) if polys else None
    return None
```

**5. Memory exhaustion on models with thousands of walls**

Process in batches and release the OCCT shape cache after each batch:

```python
BATCH_SIZE = 500

for i in range(0, len(walls), BATCH_SIZE):
    batch = walls[i : i + BATCH_SIZE]
    batch_results = [process_wall(w, settings, other_axes, min_area) for w in batch]
    # write batch_results to database here, then let the batch go out of scope
```

For coordinate-system alignment after extraction — projecting the resulting Shapely geometries into a real-world CRS — refer to [Converting CAD Local Coordinates to EPSG:4326](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/converting-cad-local-coordinates-to-epsg4326/).

---

## Related Pages

- [IfcOpenShell Workflow](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/) — parent guide covering the full ifcopenshell API surface for IFC parsing and geometry access
- [Geometry & Mesh Conversion](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/) — techniques for working with tessellated mesh arrays, face normals, and polygon topology
- [Converting CAD Polylines to GeoJSON](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/converting-cad-polylines-to-geojson/) — sibling workflow for vector geometry export from DXF/DWG sources
- [Python Parsing & Geometry Extraction](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/) — overview of the full geometry-extraction pipeline across IFC, DXF, and DWG formats
