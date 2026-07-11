---
title: "Batch Converting IFC to GeoJSON with ifcopenshell"
description: "Evaluate IFC geometry with ifcopenshell.geom, project each element to a 2D footprint with shapely, attach GlobalId and property sets, and write RFC 7946 GeoJSON across a folder in parallel."
slug: "batch-converting-ifc-to-geojson-with-ifcopenshell"
type: "long_tail"
breadcrumb:
  - label: "Python Parsing & Geometry Extraction"
    url: "/python-parsing-geometry-extraction/"
  - label: "ifcopenshell Workflow"
    url: "/python-parsing-geometry-extraction/ifcopenshell-workflow/"
  - label: "Batch Converting IFC to GeoJSON with ifcopenshell"
    url: "/python-parsing-geometry-extraction/ifcopenshell-workflow/batch-converting-ifc-to-geojson-with-ifcopenshell/"
datePublished: "2026-07-11"
dateModified: "2026-07-11"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Batch Converting IFC to GeoJSON with ifcopenshell",
      "description": "Evaluate IFC geometry with ifcopenshell.geom, project each element to a 2D footprint with shapely, attach GlobalId and property sets, and write RFC 7946 GeoJSON across a folder in parallel.",
      "datePublished": "2026-07-11",
      "dateModified": "2026-07-11",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/batch-converting-ifc-to-geojson-with-ifcopenshell/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Python Parsing & Geometry Extraction", "item": "https://cad-gis-bim-interop.org/python-parsing-geometry-extraction/"},
        {"@type": "ListItem", "position": 2, "name": "ifcopenshell Workflow", "item": "https://cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/"},
        {"@type": "ListItem", "position": 3, "name": "Batch Converting IFC to GeoJSON with ifcopenshell", "item": "https://cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/batch-converting-ifc-to-geojson-with-ifcopenshell/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Batch Converting IFC to GeoJSON with ifcopenshell",
      "description": "Convert IFC element geometry to 2D GeoJSON footprints across a directory of files.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Configure the geometry kernel", "text": "Create ifcopenshell.geom settings with USE_WORLD_COORDS enabled so vertices arrive in project world coordinates."},
        {"@type": "HowToStep", "position": 2, "name": "Evaluate geometry per element", "text": "Iterate elements with ifcopenshell.geom.iterator and read flat vertex and face arrays."},
        {"@type": "HowToStep", "position": 3, "name": "Project to a 2D footprint", "text": "Drop the Z axis, build a shapely Polygon per triangle, union them with unary_union, and simplify the result."},
        {"@type": "HowToStep", "position": 4, "name": "Attach attributes", "text": "Set GlobalId and selected property set values as feature properties."},
        {"@type": "HowToStep", "position": 5, "name": "Write and batch", "text": "Serialize an RFC 7946 FeatureCollection per file, then drive a whole folder with a multiprocessing pool."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Is GeoJSON from IFC valid without reprojection?",
          "acceptedAnswer": {"@type": "Answer", "text": "RFC 7946 mandates WGS84 longitude/latitude. IFC world coordinates are local or projected engineering meters, so a strict RFC 7946 reader will misplace them. Either reproject to EPSG:4326 before writing or document a non-default CRS and treat the output as GeoJSON-shaped rather than RFC 7946 compliant."}
        },
        {
          "@type": "Question",
          "name": "Why do some elements produce no footprint?",
          "acceptedAnswer": {"@type": "Answer", "text": "Elements such as spaces, annotations, and type objects carry no body representation, so create_shape raises or the iterator skips them. Others tessellate only into vertical faces that collapse to a line when Z is dropped. Skip the first case and detect the degenerate second case by checking polygon area."}
        },
        {
          "@type": "Question",
          "name": "Should I use convex hull or triangle union for footprints?",
          "acceptedAnswer": {"@type": "Answer", "text": "Union of the projected triangles preserves concavities, courtyards, and L-shapes, which convex hull erases. Use unary_union of the triangle polygons for faithful footprints and reserve convex hull for a fast bounding approximation when exact shape does not matter."}
        }
      ]
    }
  ]
}
</script>

# Batch Converting IFC to GeoJSON with ifcopenshell

The direct answer: evaluate each element's geometry with `ifcopenshell.geom` under `USE_WORLD_COORDS`, project the triangulated mesh onto the XY plane, union the projected triangles into one `shapely` footprint, attach the element's `GlobalId` and chosen property values, and emit an RFC 7946 `FeatureCollection`. Wrap that per-file routine in a `multiprocessing` pool to sweep a directory. The one non-negotiable caveat is coordinate reference: IFC world coordinates are engineering meters, not WGS84, so a CRS step belongs in the pipeline. This task sits alongside the other geometry routines in the [ifcopenshell Workflow](/python-parsing-geometry-extraction/ifcopenshell-workflow/) guide.

---

## How ifcopenshell Produces Footprints

IFC geometry is parametric — extruded profiles, swept solids, boolean cuts — and must be compiled before it is anything you can project. `ifcopenshell.geom` hands that compilation to the bundled OpenCASCADE kernel, which returns a triangulated boundary mesh as two flat arrays: `verts` (`[x0,y0,z0, x1,y1,z1, ...]`) and `faces` (zero-based triangle indices). With `USE_WORLD_COORDS` enabled, every `IfcLocalPlacement` matrix in the element's hierarchy is already baked in, so vertices land in the project's world coordinate system without manual matrix composition.

A GeoJSON footprint is a 2D polygon, so the mesh has to be flattened. The reliable route is: build one `shapely.geometry.Polygon` from each triangle's XY coordinates, discard the degenerate ones (vertical faces collapse to zero-area slivers when Z is dropped), then `shapely.ops.unary_union` the survivors into a single `Polygon` or `MultiPolygon`. A final `.simplify(tolerance)` removes the tessellation noise that would otherwise bloat the output with thousands of near-collinear vertices.

What this pipeline does **not** give you for free:

- **A correct CRS.** OpenCASCADE emits the numbers stored in the file. If the model is georeferenced you must apply that georeferencing; if it is not, the footprint sits in local engineering space. Neither is WGS84.
- **Watertight 2D topology.** `unary_union` merges overlapping triangles, but self-touching rings can survive. Repair with `shapely.make_valid()` before serializing.
- **Interior voids automatically.** Courtyards and shafts appear only if the projected triangles actually leave a hole; a coarse tessellation can fill them in.

<svg viewBox="0 0 720 210" role="img" aria-label="Pipeline from IFC element mesh through 2D projection and triangle union to a GeoJSON feature, with a CRS branch feeding reprojection" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:720px;display:block;margin:1.5rem auto;">
  <title>IFC element to GeoJSON footprint pipeline</title>
  <desc>An IFC element is tessellated to a mesh, projected to the XY plane, its triangles are unioned and simplified into a footprint, reprojected using the file CRS, and written as a GeoJSON feature with GlobalId and property attributes.</desc>
  <defs>
    <marker id="gj-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" opacity="0.6"/>
    </marker>
  </defs>
  <rect x="6"   y="66" width="120" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
  <rect x="156" y="66" width="120" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
  <rect x="306" y="66" width="124" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
  <rect x="460" y="66" width="120" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
  <rect x="610" y="66" width="104" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
  <text x="66"  y="88"  text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">Mesh</text>
  <text x="66"  y="104" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.65">verts + faces</text>
  <text x="216" y="88"  text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">Project XY</text>
  <text x="216" y="104" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.65">drop Z axis</text>
  <text x="368" y="88"  text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">Union</text>
  <text x="368" y="104" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.65">simplify</text>
  <text x="520" y="88"  text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">Reproject</text>
  <text x="520" y="104" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.65">to EPSG</text>
  <text x="662" y="88"  text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">Feature</text>
  <text x="662" y="104" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.65">+ props</text>
  <line x1="126" y1="92" x2="152" y2="92" stroke="currentColor" stroke-width="1.5" opacity="0.55" marker-end="url(#gj-arrow)"/>
  <line x1="276" y1="92" x2="302" y2="92" stroke="currentColor" stroke-width="1.5" opacity="0.55" marker-end="url(#gj-arrow)"/>
  <line x1="430" y1="92" x2="456" y2="92" stroke="currentColor" stroke-width="1.5" opacity="0.55" marker-end="url(#gj-arrow)"/>
  <line x1="580" y1="92" x2="606" y2="92" stroke="currentColor" stroke-width="1.5" opacity="0.55" marker-end="url(#gj-arrow)"/>
  <rect x="460" y="150" width="120" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="5,4" opacity="0.4"/>
  <text x="520" y="170" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor" opacity="0.8">IfcMapConversion</text>
  <text x="520" y="185" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.6">source CRS + offset</text>
  <line x1="520" y1="150" x2="520" y2="122" stroke="currentColor" stroke-width="1" stroke-dasharray="4,3" opacity="0.45" marker-end="url(#gj-arrow)"/>
  <text x="360" y="200" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.5">the reproject stage needs the file's georeferencing to reach a real-world CRS</text>
</svg>

## Production-Ready Script

Two functions: `ifc_to_features` converts one file to a list of GeoJSON features, and `batch_folder` drives a directory in parallel. Geometry is read through `ifcopenshell.geom.iterator`, which multiprocesses tessellation internally and handles mapped items correctly. Property attributes reuse the `get_psets` helper covered in [Extracting IFC Property Sets with ifcopenshell](/python-parsing-geometry-extraction/ifcopenshell-workflow/extracting-ifc-property-sets-with-ifcopenshell/).

```python
# ifcopenshell>=0.8.0, shapely>=2.0.0, numpy>=1.24.0, Python 3.9+
import ifcopenshell
import ifcopenshell.geom
import ifcopenshell.util.element
import shapely
import shapely.ops
from shapely.geometry import Polygon, mapping
import numpy as np
import json
import os
import glob
from concurrent.futures import ProcessPoolExecutor
from typing import Optional


def _footprint_from_mesh(verts: np.ndarray, faces: np.ndarray,
                         min_area: float = 1e-4,
                         simplify_tol: float = 0.02) -> Optional[dict]:
    """Project a triangulated mesh to XY and return a GeoJSON geometry dict."""
    tris = []
    for a, b, c in faces:
        coords = [
            (float(verts[a][0]), float(verts[a][1])),
            (float(verts[b][0]), float(verts[b][1])),
            (float(verts[c][0]), float(verts[c][1])),
        ]
        poly = Polygon(coords)
        # Vertical faces collapse to ~zero area when Z is dropped; drop them.
        if poly.is_valid and poly.area > min_area:
            tris.append(poly)

    if not tris:
        return None

    merged = shapely.make_valid(shapely.ops.unary_union(tris))
    if simplify_tol > 0:
        merged = merged.simplify(simplify_tol, preserve_topology=True)
    if merged.is_empty:
        return None
    return mapping(merged)


def ifc_to_features(ifc_path: str, prop_keys: tuple = ("Pset_WallCommon.IsExternal",)) -> list[dict]:
    """Convert one IFC file to a list of RFC 7946 GeoJSON features."""
    model = ifcopenshell.open(ifc_path)

    settings = ifcopenshell.geom.settings()
    settings.set(settings.USE_WORLD_COORDS, True)
    settings.set(settings.INCLUDE_CURVES, False)

    iterator = ifcopenshell.geom.iterator(settings, model)
    features: list[dict] = []
    if not iterator.initialize():
        return features

    while True:
        shape = iterator.get()
        element = model.by_guid(shape.guid)

        verts = np.array(shape.geometry.verts, dtype=np.float64).reshape(-1, 3)
        faces = np.array(shape.geometry.faces, dtype=np.int32).reshape(-1, 3)
        geom = _footprint_from_mesh(verts, faces)

        if geom is not None:
            # Flatten only the property keys we want as feature properties.
            psets = ifcopenshell.util.element.get_psets(element)
            props = {"GlobalId": shape.guid, "IfcType": element.is_a(),
                     "Name": getattr(element, "Name", None)}
            for key in prop_keys:
                set_name, _, prop = key.partition(".")
                props[key] = psets.get(set_name, {}).get(prop)

            features.append({"type": "Feature", "geometry": geom, "properties": props})

        if not iterator.next():
            break

    return features


def convert_file(args: tuple) -> tuple:
    """Worker: convert one file and write its own FeatureCollection."""
    ifc_path, out_dir = args
    try:
        feats = ifc_to_features(ifc_path)
        fc = {"type": "FeatureCollection", "features": feats}
        out_path = os.path.join(
            out_dir, os.path.splitext(os.path.basename(ifc_path))[0] + ".geojson"
        )
        with open(out_path, "w", encoding="utf-8") as fh:
            json.dump(fc, fh, default=str)
        return (ifc_path, len(feats), None)
    except Exception as exc:  # keep one bad file from killing the batch
        return (ifc_path, 0, str(exc))


def batch_folder(in_dir: str, out_dir: str, workers: int = 4) -> None:
    os.makedirs(out_dir, exist_ok=True)
    jobs = [(p, out_dir) for p in glob.glob(os.path.join(in_dir, "*.ifc"))]
    # One OS process per file forces the OpenCASCADE heap to be reclaimed on exit.
    with ProcessPoolExecutor(max_workers=workers) as pool:
        for ifc_path, n, err in pool.map(convert_file, jobs):
            status = f"{n} features" if err is None else f"ERROR: {err}"
            print(f"{os.path.basename(ifc_path)}: {status}")


if __name__ == "__main__":
    batch_folder("ifc_in", "geojson_out", workers=4)
```

Key implementation notes:

- One OS process per file (`ProcessPoolExecutor`) is deliberate memory hygiene. OpenCASCADE allocates a native C++ heap that Python's garbage collector cannot reclaim; letting each worker process exit returns that memory to the OS unconditionally.
- `_footprint_from_mesh` filters by area before unioning. Skipping this leaves vertical wall and column faces as zero-area slivers that make `unary_union` slow and can produce invalid rings.
- `.simplify(tolerance, preserve_topology=True)` collapses tessellation noise while keeping the polygon valid. Tune `simplify_tol` to your unit scale — `0.02` is 2 cm in a metric model and is usually below survey tolerance.
- `model.by_guid(shape.guid)` re-associates the compiled shape with its IFC element so property sets and the class name can be read. The iterator yields geometry, not entities.

The features here carry raw world coordinates. Before they are map-ready they must be reprojected — read the file's georeferencing with [Reading IFC Georeferencing with ifcopenshell](/python-parsing-geometry-extraction/ifcopenshell-workflow/reading-ifc-georeferencing-with-ifcopenshell/), then apply the CRS step described in [Converting CAD Local Coordinates to EPSG:4326](/coordinate-transformation-spatial-alignment/crs-normalization-workflows/converting-cad-local-coordinates-to-epsg4326/).

## Compatibility Matrix

| Component | Supported Range | Notes |
|-----------|-----------------|-------|
| Python | 3.9 – 3.12 | `concurrent.futures` and builtin generics are used throughout |
| ifcopenshell | ≥ 0.8.0 | `geom.iterator` and `settings.USE_WORLD_COORDS` are stable since 0.7.0; 0.8.0 recommended for IFC4x3 body types |
| Shapely | ≥ 2.0.0 | `shapely.make_valid()` as a top-level function requires ≥ 2.0; on 1.8.x use `shapely.validation.make_valid` |
| NumPy | ≥ 1.24.0 | Only for vertex/face reshape; any 1.x ≥ 1.20 works in practice |
| GeoJSON target | RFC 7946 | Strictly WGS84; local/projected output is GeoJSON-shaped but not RFC 7946 compliant until reprojected |
| IFC schema | IFC2x3, IFC4, IFC4x3 | Georeferencing anchors differ by schema — see the georeferencing guide linked above |

## Fallback Strategies

**1. Elements with no geometry raise or yield empty meshes**

Spaces, annotations, grids, and type objects carry no body representation. The iterator skips most, but guard the mesh read so an empty array never reaches `unary_union`:

```python
if verts.size == 0 or faces.size == 0:
    continue
```

**2. Footprints are non-planar or self-overlapping**

A sloped roof projects to overlapping triangles whose union self-touches. Always route the merged geometry through `shapely.make_valid()` (already in the script) and, if a strict reader still rejects it, buffer by zero: `merged = merged.buffer(0)`.

**3. Coordinate magnitudes are huge and precision degrades**

Projected national grids place origins hundreds of kilometers away, so vertices carry seven or eight significant digits before the decimal and float precision suffers after simplification. Subtract a per-file local origin before geometry ops, then add it back after reprojection:

```python
origin = verts.mean(axis=0)
verts_local = verts - origin  # keep magnitudes small for shapely
```

**4. Output lands in the wrong place on the map**

The footprint shape is correct but geographically displaced because the file's `IfcMapConversion` eastings/northings offset was never applied. Read it and translate before writing GeoJSON — the dedicated georeferencing routine handles IFC2x3 fallbacks too. For pure unit issues (millimeter models), scale first with [Converting DXF Millimeters to Meters Before pyproj Reprojection](/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/converting-dxf-millimeters-to-meters-before-pyproj-reprojection/), whose scaling logic applies equally to IFC vertex arrays.

**5. Large models exhaust memory mid-batch**

Cap worker count to your core budget and stream features to disk per file rather than accumulating one giant collection. The per-file `FeatureCollection` in the script already does this; for a single merged output, write newline-delimited GeoJSON features and concatenate afterward instead of holding them all in RAM.

## FAQ

<details>
<summary><strong>Is GeoJSON from IFC valid without reprojection?</strong></summary>

RFC 7946 mandates WGS84 longitude/latitude. IFC world coordinates are local or projected engineering meters, so a strict RFC 7946 reader will misplace them. Either reproject to EPSG:4326 before writing or document a non-default CRS and treat the output as GeoJSON-shaped rather than RFC 7946 compliant.

</details>

<details>
<summary><strong>Why do some elements produce no footprint?</strong></summary>

Elements such as spaces, annotations, and type objects carry no body representation, so `create_shape` raises or the iterator skips them. Others tessellate only into vertical faces that collapse to a line when Z is dropped. Skip the first case and detect the degenerate second case by checking polygon area.

</details>

<details>
<summary><strong>Should I use convex hull or triangle union for footprints?</strong></summary>

Union of the projected triangles preserves concavities, courtyards, and L-shapes, which convex hull erases. Use `unary_union` of the triangle polygons for faithful footprints and reserve convex hull for a fast bounding approximation when exact shape does not matter.

</details>

---

## Related Pages

- [ifcopenshell Workflow](/python-parsing-geometry-extraction/ifcopenshell-workflow/) — parent guide to geometry compilation, iteration, and serialization with ifcopenshell
- [Reading IFC Georeferencing with ifcopenshell](/python-parsing-geometry-extraction/ifcopenshell-workflow/reading-ifc-georeferencing-with-ifcopenshell/) — read IfcMapConversion and IfcProjectedCRS so the footprints land in real-world coordinates
- [Extracting IFC Property Sets with ifcopenshell](/python-parsing-geometry-extraction/ifcopenshell-workflow/extracting-ifc-property-sets-with-ifcopenshell/) — source the attributes attached to each GeoJSON feature
- [Converting CAD Local Coordinates to EPSG:4326](/coordinate-transformation-spatial-alignment/crs-normalization-workflows/converting-cad-local-coordinates-to-epsg4326/) — the CRS transformation step that follows footprint extraction
