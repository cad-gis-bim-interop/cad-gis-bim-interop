# Extracting IFC Wall Geometries to Shapely: A Production-Ready Pipeline

Extracting IFC wall geometries to Shapely requires projecting 3D B-Rep or SweptSolid representations onto a 2D plane, resolving mesh topology, and constructing valid `Polygon` or `MultiPolygon` objects. The most reliable pipeline uses `ifcopenshell` to resolve native IFC geometry, extracts vertex/face arrays, projects them to a target axis (typically Z=0 for floor plans), and passes the resulting coordinate sequences to Shapely. You must explicitly handle invalid rings, self-intersections, and IFC2x3 vs IFC4 representation differences before feeding geometries into GIS/CAD workflows.

## Prerequisites & Environment Setup

| Component | Requirement |
|-----------|-------------|
| **Python** | 3.9–3.12 (3.8 is end-of-life as of October 2024) |
| **Core Libraries** | `ifcopenshell>=0.8.0`, `shapely>=2.0.0`, `numpy>=1.24.0` |
| **OS** | Linux/macOS/Windows (precompiled geometry kernel; no external CAD dependencies) |
| **Geometry Kernel** | OpenCASCADE (bundled with `ifcopenshell-python`) |

Install dependencies via pip:
```bash
pip install ifcopenshell shapely numpy
```

## Core Extraction Pipeline

The extraction process follows a deterministic sequence. Understanding each stage prevents downstream topology failures when integrating with spatial databases or CAD renderers.

1. **Model Loading & Query**: Parse the IFC file and filter `IfcWall` (or `IfcWallStandardCase`) entities. Avoid recursive type traversal unless you explicitly need `IfcProxy` or legacy classifications.
2. **Geometry Settings Configuration**: Enable world coordinates, disable material application, and exclude curves. This forces the kernel to return pure mesh data, which is optimal for 2D projection.
3. **Mesh Extraction**: Retrieve flattened vertex arrays and face index lists. IFC geometry is typically triangulated during tessellation, meaning each face contains exactly three vertex indices.
4. **Axis Projection**: Drop the target axis (usually Z for plan views) and map remaining coordinates to `(x, y)` tuples. Maintain consistent winding order to preserve interior/exterior ring orientation.
5. **Topology Assembly**: Convert projected triangles to Shapely polygons, merge overlapping faces using `unary_union`, and run validation routines to repair self-intersections or collapsed rings.

This workflow aligns with established [ifcopenshell Workflow](/python-parsing-geometry-extraction/ifcopenshell-workflow/) patterns, ensuring deterministic output across different authoring platforms.

## Complete Working Implementation

The following script handles projection, validation, and merging in a single pass. It is optimized for batch processing and includes explicit error routing.

```python
import ifcopenshell
import ifcopenshell.geom
import ifcopenshell.util.shape
from shapely.geometry import Polygon, MultiPolygon
import shapely
import shapely.ops
import numpy as np

def extract_walls_to_shapely(
    ifc_path: str, 
    projection_axis: str = "Z", 
    min_area: float = 0.001
) -> list[dict]:
    """Extract IfcWall geometries and convert them to validated Shapely Polygons."""
    model = ifcopenshell.open(ifc_path)
    walls = model.by_type("IfcWall")
    results = []

    # Configure geometry kernel for pure mesh extraction
    settings = ifcopenshell.geom.settings()
    settings.set(settings.USE_WORLD_COORDS, True)
    settings.set(settings.EXCLUDE_SOLIDS_AND_SURFACES, False)
    settings.set(settings.INCLUDE_CURVES, False)
    settings.set(settings.APPLY_DEFAULT_MATERIALS, False)

    axis_map = {"X": 0, "Y": 1, "Z": 2}
    proj_idx = axis_map.get(projection_axis.upper(), 2)
    other_axes = [i for i in range(3) if i != proj_idx]

    for wall in walls:
        try:
            shape = ifcopenshell.geom.create_shape(settings, wall)
            verts = np.array(ifcopenshell.util.shape.get_vertices(shape)).reshape(-1, 3)
            faces = ifcopenshell.util.shape.get_faces(shape)

            polygons = []
            for face in faces:
                # Project 3D vertices to 2D plane
                coords = [(verts[i][other_axes[0]], verts[i][other_axes[1]]) for i in face]
                try:
                    poly = Polygon(coords)
                    if poly.is_valid and poly.area > min_area:
                        polygons.append(poly)
                except Exception:
                    continue

            if polygons:
                # Merge adjacent triangles into coherent wall footprints
                merged_geom = shapely.ops.unary_union(polygons)
                # Ensure valid topology for GIS/CAD consumption
                valid_geom = shapely.make_valid(merged_geom)
                results.append({
                    "id": wall.GlobalId,
                    "geometry": valid_geom,
                    "status": "success"
                })
            else:
                results.append({
                    "id": wall.GlobalId,
                    "geometry": None,
                    "status": "no_faces"
                })
        except Exception as e:
            results.append({
                "id": wall.GlobalId,
                "geometry": None,
                "status": "error",
                "message": str(e)
            })

    return results
```

## Critical Validation & Edge Cases

Raw IFC geometry rarely translates cleanly to 2D without intervention. Production deployments must account for three primary failure modes:

### 1. Triangulation vs. Original Polygons
`ifcopenshell` tessellates complex solids into triangles by default. When projecting, adjacent triangles share edges but may produce sliver polygons or micro-gaps. Using `shapely.ops.unary_union` resolves these boundaries automatically. For strict footprint extraction, consider filtering by face normal direction to exclude vertical or sloped surfaces before projection.

### 2. IFC2x3 vs. IFC4 Representation Mapping
Legacy IFC2x3 files frequently use `IfcExtrudedAreaSolid` or `IfcSweptDiskSolid` with implicit sweep paths. IFC4 introduces `IfcSurfaceCurveSweptAreaSolid` and explicit B-Rep definitions. The geometry kernel abstracts these differences, but coordinate precision varies. Always normalize units (IFC defaults to meters) and apply a tolerance threshold (`min_area`) to discard projection artifacts. Refer to the official [IFC specification](https://standards.buildingsmart.org/IFC/DEV/IFC4_2/FINAL/HTML/) for entity mapping details.

### 3. Self-Intersections & Invalid Rings
Walls with complex openings, intersecting cores, or non-planar base curves often produce invalid Shapely geometries after projection. The `shapely.make_valid()` routine repairs most topological defects by snapping vertices and splitting overlapping segments. For strict GIS compliance, run `is_valid` checks post-merge and log failures for manual review. Detailed validation strategies are documented in the [Shapely manual](https://shapely.readthedocs.io/en/stable/manual.html).

## Integration Notes for GIS/CAD Workflows

Once validated, export geometries using `shapely.to_wkt()` or `shapely.to_geojson()` for direct ingestion into PostGIS, QGIS, or CAD plugins. Maintain the `GlobalId` as a persistent foreign key to preserve BIM-to-GIS traceability. When scaling to full-model extraction, batch geometry creation in chunks of 500–1,000 elements to manage OpenCASCADE memory overhead. For advanced filtering, combine this pipeline with [Python Parsing & Geometry Extraction](/python-parsing-geometry-extraction/) utilities to isolate structural, architectural, or MEP-specific wall classifications before spatial processing.