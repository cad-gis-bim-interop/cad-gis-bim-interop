---
title: "ifcopenshell Workflow: IFC Parsing & BIM Geometry Extraction in Python"
description: "A production guide to ifcopenshell: environment setup, geometry extraction, coordinate transformation, edge cases and memory management for BIM-to-GIS work."
slug: "ifcopenshell-workflow"
breadcrumb:
  - label: "Python Parsing & Geometry Extraction"
    url: "/python-parsing-geometry-extraction/"
  - label: "ifcopenshell Workflow"
    url: "/python-parsing-geometry-extraction/ifcopenshell-workflow/"
datePublished: "2024-11-01"
dateModified: "2026-06-24"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "ifcopenshell Workflow: IFC Parsing & BIM Geometry Extraction in Python",
      "description": "A production guide to ifcopenshell: environment setup, geometry extraction, coordinate transformation, edge cases and memory management for BIM-to-GIS work.",
      "datePublished": "2024-11-01",
      "dateModified": "2026-06-24",
      "author": {"@type": "Organization", "name": "CAD-GIS-BIM Interop"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Python Parsing & Geometry Extraction", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/"},
        {"@type": "ListItem", "position": 2, "name": "ifcopenshell Workflow", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "ifcopenshell Workflow: IFC Parsing & BIM Geometry Extraction in Python",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Install dependencies and validate IFC schema version"},
        {"@type": "HowToStep", "position": 2, "name": "Open the IFC file and inspect project-level context"},
        {"@type": "HowToStep", "position": 3, "name": "Configure ifcopenshell.geom settings for tessellation"},
        {"@type": "HowToStep", "position": 4, "name": "Extract and triangulate geometry per IfcProduct"},
        {"@type": "HowToStep", "position": 5, "name": "Apply local placement matrices and project to target CRS"},
        {"@type": "HowToStep", "position": 6, "name": "Serialize to GeoJSON, OBJ, or 3D Tiles"},
        {"@type": "HowToStep", "position": 7, "name": "Validate output geometry and run topology assertions"}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Does ifcopenshell support both IFC2x3 and IFC4?",
          "acceptedAnswer": {"@type": "Answer", "text": "Yes. ifcopenshell auto-detects the schema from the FILE_SCHEMA header token. Most APIs work identically, but IFC4 introduces IfcFacetedBrep and IfcAdvancedBrep types absent from IFC2x3, so check the schema string before dispatching geometry extraction logic."}
        },
        {
          "@type": "Question",
          "name": "Why does ifcopenshell.geom.create_shape raise RuntimeError for some products?",
          "acceptedAnswer": {"@type": "Answer", "text": "Parametric representations that contain zero-area faces, degenerate edges, or broken boolean trees fail OpenCASCADE's BRep validation. Wrap every create_shape call in a try/except RuntimeError block, log the GlobalId and Name, and skip the product rather than aborting the batch."}
        },
        {
          "@type": "Question",
          "name": "How do I determine the IFC file's native unit (meters vs. millimeters)?",
          "acceptedAnswer": {"@type": "Answer", "text": "Read ifc_file.by_type('IfcUnitAssignment')[0]. Iterate its Units attribute for IfcSIUnit entries with UnitType='LENGTHUNIT'. A Prefix of None with Name='METRE' means meters; a Prefix of 'MILLI' means millimeters. Apply the corresponding scale factor before any CRS transformation."}
        },
        {
          "@type": "Question",
          "name": "What is the recommended approach for extracting property sets (Psets)?",
          "acceptedAnswer": {"@type": "Answer", "text": "Use ifcopenshell.util.element.get_psets(product) rather than manually traversing IsDefinedBy relationships. This helper returns a nested dict keyed by Pset name, flattening both IfcPropertySingleValue and IfcPropertyEnumeratedValue into plain Python types suitable for JSON serialization."}
        },
        {
          "@type": "Question",
          "name": "Can ifcopenshell handle federated (multi-model) IFC files?",
          "acceptedAnswer": {"@type": "Answer", "text": "Native federated IFC is not a single file format — federation is a host-tool concept. In Python, open each constituent IFC separately, extract geometry independently, then merge spatial hierarchies by matching on GlobalId or by applying a common coordinate origin. Use ifcopenshell.util.geolocation to read georeferencing anchors per file."}
        }
      ]
    }
  ]
}
</script>

# ifcopenshell Workflow: IFC Parsing & BIM Geometry Extraction in Python

`ifcopenshell` is the primary open-source Python library for reading, writing, and tessellating Industry Foundation Classes (IFC) files — the open BIM exchange format maintained by buildingSMART International. As part of the [Python Parsing & Geometry Extraction](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/) pipeline, the ifcopenshell workflow occupies the ingestion and geometry compilation stages: it opens IFC deliverables, resolves parametric representations to triangulated meshes via OpenCASCADE, and hands off georeferenced geometry to downstream GIS or visualization systems.

This page covers the full production workflow: environment setup, architectural internals, step-by-step extraction, named edge cases, validation strategies, memory management, and a FAQ drawn from real integration failures.

---

## Prerequisites

- **Python 3.9 or higher** — type hints and `pathlib` are used throughout.
- **ifcopenshell 0.7.x** (`pip install ifcopenshell`) — ships with a bundled OpenCASCADE binary; no separate C++ compilation is required on standard platforms.
- **numpy ≥ 1.24** (`pip install numpy`) — vertex and face arrays are returned as raw Python lists that must be reshaped into numpy arrays for vectorized processing.
- **pyproj ≥ 3.5** (`pip install pyproj`) — PROJ 9 backend required for accurate datum-aware CRS transformations.
- **shapely ≥ 2.0** (`pip install shapely`) — for footprint extraction and spatial predicates. See [Extracting IFC Wall Geometries to Shapely](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/extracting-ifc-wall-geometries-to-shapely/) for optimized polygonization routines.
- **Assumed knowledge:** familiarity with the IFC spatial hierarchy (`IfcProject` → `IfcSite` → `IfcBuilding` → `IfcBuildingStorey`), basic understanding of homogeneous 4×4 transformation matrices, and awareness that IFC geometry is parametric (it must be compiled, not read directly).

Install all dependencies together:

```bash
# ifcopenshell>=0.7.0 numpy>=1.24.0 pyproj>=3.5.0 shapely>=2.0.0
pip install ifcopenshell numpy pyproj shapely
```

---

## Architectural Overview

### How ifcopenshell Compiles IFC Geometry

<!-- fig:ifcos-representation-kinds -->
<svg viewBox="-20 -20 680.5 254" role="img" aria-label="Swept solids, boolean results, faceted B-reps and mapped representations — the IFC representation kinds and their evaluation cost" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:681px;display:block;margin:1.5rem auto;">
  <title>The representation kinds a compiler has to evaluate</title>
  <desc>Four ways IFC describes the same kind of solid, in rough order of evaluation cost. A swept area solid is a profile and a direction; a boolean result is a tree of operations on other solids; a faceted representation is already explicit; and a mapped representation is a reference to geometry defined once and placed many times. A pipeline that handles only the first silently loses whatever the model expressed with the others.</desc>
  <defs>
    <marker id="ios1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ios1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="680.5" height="254" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="540" height="46" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="16" y="21" font-size="11.5" font-weight="600" fill="currentColor">IfcFacetedBrep</text>
  <text x="16" y="35" font-size="9.5" fill="currentColor" fill-opacity="0.72">already explicit faces</text>
  <text x="524" y="26.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">cheapest</text>
  <rect x="0" y="56" width="540" height="46" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="16" y="77" font-size="11.5" font-weight="600" fill="currentColor">IfcMappedItem</text>
  <text x="16" y="91" font-size="9.5" fill="currentColor" fill-opacity="0.72">a placement of shared geometry</text>
  <text x="524" y="82.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">evaluate once</text>
  <rect x="0" y="112" width="540" height="46" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="16" y="133" font-size="11.5" font-weight="600" fill="currentColor">IfcExtrudedAreaSolid</text>
  <text x="16" y="147" font-size="9.5" fill="currentColor" fill-opacity="0.72">profile swept along a direction</text>
  <text x="524" y="138.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">common</text>
  <rect x="0" y="168" width="540" height="46" rx="6" fill="currentColor" fill-opacity="0.14" stroke="currentColor" stroke-width="2"/>
  <text x="16" y="189" font-size="11.5" font-weight="600" fill="currentColor">IfcBooleanResult</text>
  <text x="16" y="203" font-size="9.5" fill="currentColor" fill-opacity="0.72">a tree of solid operations</text>
  <text x="524" y="194.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">most expensive</text>
  <line x1="566" y1="2" x2="566" y2="212" stroke="currentColor" stroke-width="1.4" stroke-opacity="0.6" marker-end="url(#ios1-a)"/>
  <text x="574" y="107" font-size="9.5" fill="currentColor" fill-opacity="0.7">evaluation cost</text>
</svg>
<!-- /fig:ifcos-representation-kinds -->

IFC stores geometry as parametric descriptions: extruded area profiles, swept solids, constructive solid geometry (CSG) trees, and boolean operations. None of these representations are ready-made mesh data — they must be compiled. `ifcopenshell.geom` delegates this compilation to OpenCASCADE Technology (OCCT), a C++ solid modelling kernel, which evaluates the parametric tree and produces a triangulated BRep (boundary representation) surface.

The key internal objects are:

- `IfcRepresentation` — the container that references one or more `IfcRepresentationItem` shapes (extruded profiles, mapped items, boolean results).
- `IfcLocalPlacement` — a recursive 4×4 matrix chain encoding position, rotation, and scale relative to the parent entity's coordinate system.
- `IfcGeometricRepresentationContext` — defines the coordinate dimensionality (2D/3D), precision, and world-coordinate origin.

The `ifcopenshell.geom.create_shape()` function resolves this entire chain: it traverses the placement hierarchy, composes the transformation matrices, evaluates the geometry, applies unit scale, and returns a compiled `Shape` object whose `.geometry` attribute holds flat vertex and face index lists.

### IFC Schema Compatibility

| Schema | Token in FILE_SCHEMA | Notable geometry types | ifcopenshell support |
|--------|---------------------|----------------------|---------------------|
| IFC2x3 | `IFC2X3` | IfcExtrudedAreaSolid, IfcFacetedBrep | Full |
| IFC4 | `IFC4` | + IfcAdvancedBrep, IfcTriangulatedFaceSet | Full |
| IFC4x1 | `IFC4X1` | Alignment geometry (IfcAlignmentCurve) | Partial |
| IFC4x3 | `IFC4X3` | Civil/infrastructure extensions | Partial (0.7+) |

Always read the schema token from `ifc_file.schema` before dispatching geometry logic; IFC4x3 alignment types require explicit handling not present in the standard `geom` pipeline.

---

## Architectural Data-Flow Diagram

<svg viewBox="0 0 720 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ifcopenshell pipeline data flow from IFC file through ingestion, geometry compilation, coordinate transformation, and serialization to output formats" style="width:100%;max-width:720px;height:auto;display:block;margin:2rem auto;">
  <title>ifcopenshell Pipeline Data Flow</title>
  <desc>Flowchart showing the four stages of the ifcopenshell workflow: IFC File ingestion, Geometry Compilation via OpenCASCADE, Coordinate Transformation via pyproj, and Serialization to GeoJSON/OBJ/3D Tiles.</desc>
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" opacity="0.6"/>
    </marker>
  </defs>
  <rect x="0" y="0" width="720" height="420" fill="var(--color-surface)"/>
  <!-- Stage 1: IFC File -->
  <rect x="20" y="30" width="160" height="64" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
  <text x="100" y="57" text-anchor="middle" font-size="13" font-weight="600" fill="currentColor">IFC File</text>
  <text x="100" y="75" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.7">.ifc / .ifczip</text>
  <text x="100" y="90" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.6">IFC2x3 · IFC4 · IFC4x3</text>
  <!-- Arrow 1 -->
  <line x1="180" y1="62" x2="228" y2="62" stroke="currentColor" stroke-width="1.5" opacity="0.5" marker-end="url(#arrowhead)"/>
  <!-- Stage 2: Ingestion -->
  <rect x="230" y="30" width="160" height="64" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
  <text x="310" y="52" text-anchor="middle" font-size="13" font-weight="600" fill="currentColor">Ingestion</text>
  <text x="310" y="68" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.7">ifcopenshell.open()</text>
  <text x="310" y="84" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.6">schema · units · CRS anchor</text>
  <!-- Arrow 2 -->
  <line x1="390" y1="62" x2="438" y2="62" stroke="currentColor" stroke-width="1.5" opacity="0.5" marker-end="url(#arrowhead)"/>
  <!-- Stage 3: Geometry Compilation -->
  <rect x="440" y="30" width="160" height="64" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
  <text x="520" y="52" text-anchor="middle" font-size="13" font-weight="600" fill="currentColor">Geometry Compilation</text>
  <text x="520" y="68" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.7">ifcopenshell.geom</text>
  <text x="520" y="84" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.6">OpenCASCADE tessellation</text>
  <!-- Down arrow from Geometry Compilation -->
  <line x1="520" y1="94" x2="520" y2="158" stroke="currentColor" stroke-width="1.5" opacity="0.5" marker-end="url(#arrowhead)"/>
  <!-- Stage 4: Coordinate Transformation -->
  <rect x="440" y="160" width="160" height="64" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
  <text x="520" y="182" text-anchor="middle" font-size="13" font-weight="600" fill="currentColor">CRS Transformation</text>
  <text x="520" y="198" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.7">placement matrix × pyproj</text>
  <text x="520" y="214" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.6">local → georeferenced</text>
  <!-- Left arrow from CRS Transformation -->
  <line x1="440" y1="192" x2="392" y2="192" stroke="currentColor" stroke-width="1.5" opacity="0.5" marker-end="url(#arrowhead)"/>
  <!-- Stage 5: Serialization -->
  <rect x="230" y="160" width="160" height="64" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
  <text x="310" y="182" text-anchor="middle" font-size="13" font-weight="600" fill="currentColor">Serialization</text>
  <text x="310" y="198" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.7">GeoJSON · OBJ · 3D Tiles</text>
  <text x="310" y="214" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.6">+ Pset attributes as properties</text>
  <!-- Down arrow from Serialization -->
  <line x1="310" y1="224" x2="310" y2="278" stroke="currentColor" stroke-width="1.5" opacity="0.5" marker-end="url(#arrowhead)"/>
  <!-- Output boxes row -->
  <rect x="40" y="280" width="120" height="50" rx="5" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.35"/>
  <text x="100" y="302" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor">GeoJSON</text>
  <text x="100" y="318" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.6">Web mapping / PostGIS</text>
  <rect x="180" y="280" width="120" height="50" rx="5" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.35"/>
  <text x="240" y="302" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor">OBJ / glTF</text>
  <text x="240" y="318" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.6">3D viewers / CAD</text>
  <rect x="320" y="280" width="120" height="50" rx="5" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.35"/>
  <text x="380" y="302" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor">3D Tiles</text>
  <text x="380" y="318" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.6">Cesium / infrastructure</text>
  <rect x="460" y="280" width="120" height="50" rx="5" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.35"/>
  <text x="520" y="302" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor">Shapely</text>
  <text x="520" y="318" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.6">Footprints / spatial ops</text>
  <!-- Branch lines from serialization to output boxes -->
  <line x1="310" y1="278" x2="100" y2="280" stroke="currentColor" stroke-width="1" opacity="0.35"/>
  <line x1="310" y1="278" x2="240" y2="280" stroke="currentColor" stroke-width="1" opacity="0.35"/>
  <line x1="310" y1="278" x2="380" y2="280" stroke="currentColor" stroke-width="1" opacity="0.35"/>
  <line x1="310" y1="278" x2="520" y2="280" stroke="currentColor" stroke-width="1" opacity="0.35"/>
  <!-- Side note: error path -->
  <rect x="20" y="160" width="150" height="64" rx="6" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="5,4" opacity="0.3"/>
  <text x="95" y="182" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor" opacity="0.7">Error Isolation</text>
  <text x="95" y="198" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.6">RuntimeError → skip</text>
  <text x="95" y="213" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.6">log GlobalId + Name</text>
  <line x1="440" y1="192" x2="390" y2="192" stroke="currentColor" stroke-width="1" opacity="0.3"/>
  <line x1="230" y1="192" x2="170" y2="192" stroke="currentColor" stroke-width="1" stroke-dasharray="4,3" opacity="0.3" marker-end="url(#arrowhead)"/>
  <!-- Caption -->
  <text x="360" y="410" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.5">ifcopenshell pipeline: ingestion → compilation → CRS transformation → serialization</text>
</svg>

---

## Step-by-Step Implementation

### Step 1 — Open the File and Inspect Project Context

```python
# ifcopenshell>=0.7.0
import ifcopenshell
import ifcopenshell.util.unit
from pathlib import Path

def open_ifc(path: Path):
    ifc = ifcopenshell.open(str(path))
    schema = ifc.schema          # 'IFC2X3', 'IFC4', 'IFC4X3', etc.
    unit_scale = ifcopenshell.util.unit.calculate_unit_scale(ifc)
    # unit_scale converts native units to meters; 0.001 means file is in mm
    return ifc, schema, unit_scale
```

`calculate_unit_scale` reads `IfcUnitAssignment` and returns a float that converts the file's native length unit to meters. Apply this scalar to all extracted vertex arrays before CRS projection.

### Step 2 — Enumerate the Spatial Hierarchy

```python
def get_spatial_tree(ifc):
    """Return a flat list of (storey_name, [products]) pairs."""
    result = []
    for storey in ifc.by_type("IfcBuildingStorey"):
        products = [
            p for p in ifc.by_type("IfcProduct")
            if getattr(p, "ObjectPlacement", None) is not None
        ]
        result.append((storey.Name or "unnamed", products))
    return result
```

Processing by `IfcBuildingStorey` enables chunked extraction (see Performance & Scale below) and produces spatially coherent output tiles.

### Step 3 — Configure the Geometry Settings

```python
import ifcopenshell.geom

def make_settings(use_world_coords: bool = True) -> ifcopenshell.geom.settings:
    # ifcopenshell>=0.7.0
    s = ifcopenshell.geom.settings()
    s.set(s.USE_WORLD_COORDS, use_world_coords)     # bake placement matrices in
    s.set(s.SEW_SHELLS, True)                        # watertight meshes
    s.set(s.INCLUDE_CURVES, False)                   # skip 2D annotation geometry
    s.set(s.EXCLUDE_SOLIDS_AND_SURFACES, False)      # keep solid bodies
    return s
```

`USE_WORLD_COORDS` is the single most impactful flag: when `True`, OpenCASCADE applies every `IfcLocalPlacement` matrix in the hierarchy and returns vertices in project world coordinates, eliminating the need for manual matrix composition in most pipelines.

### Step 4 — Extract and Triangulate Geometry

```python
import numpy as np

def extract_geometry(ifc_file, product, settings):
    """
    Returns (vertices: np.ndarray shape (N,3), faces: np.ndarray shape (M,3))
    or None if the product has no valid solid geometry.
    """
    try:
        shape = ifcopenshell.geom.create_shape(settings, product)
    except RuntimeError as exc:
        gid = getattr(product, "GlobalId", "?")
        name = getattr(product, "Name", "?")
        print(f"[SKIP] {gid} ({name}): {exc}")
        return None

    verts = np.array(shape.geometry.verts, dtype=np.float64).reshape(-1, 3)
    faces = np.array(shape.geometry.faces, dtype=np.int32).reshape(-1, 3)
    return verts, faces
```

The vertex array is flat (`[x0,y0,z0, x1,y1,z1, ...]`), so the `.reshape(-1, 3)` call is mandatory. Face indices are zero-based.

### Step 5 — Apply Unit Scale and Project to Target CRS

```python
import pyproj

def project_vertices(
    verts: np.ndarray,
    unit_scale: float,
    source_crs: str = "EPSG:32633",
    target_crs: str = "EPSG:4326",
) -> np.ndarray:
    # Apply unit conversion (mm → m if unit_scale=0.001)
    verts = verts * unit_scale

    transformer = pyproj.Transformer.from_crs(
        source_crs, target_crs, always_xy=True
    )
    x, y, z = transformer.transform(verts[:, 0], verts[:, 1], verts[:, 2])
    return np.column_stack([x, y, z])
```

`always_xy=True` prevents axis-order surprises when the source CRS uses a latitude-first convention (common with legacy EPSG codes). See [Converting CAD Local Coordinates to EPSG:4326](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/converting-cad-local-coordinates-to-epsg4326/) for a worked example with real survey data.

### Step 6 — Extract Property Sets and Serialize to GeoJSON

```python
import json
import ifcopenshell.util.element

def product_to_geojson_feature(product, verts, faces):
    psets = ifcopenshell.util.element.get_psets(product)
    # Flatten to a single dict; last writer wins on key collisions
    attributes = {}
    for pset_name, pset_values in psets.items():
        for k, v in pset_values.items():
            attributes[f"{pset_name}.{k}"] = v

    # Build a minimal footprint polygon from the lowest Z vertices
    min_z = verts[:, 2].min()
    floor_mask = verts[:, 2] < min_z + 0.1
    floor_verts = verts[floor_mask]
    from shapely.geometry import MultiPoint, mapping
    if len(floor_verts) >= 3:
        footprint = MultiPoint(floor_verts[:, :2]).convex_hull
        geom = mapping(footprint)
    else:
        geom = {"type": "Point", "coordinates": verts[0, :2].tolist()}

    return {
        "type": "Feature",
        "geometry": geom,
        "properties": {
            "GlobalId": product.GlobalId,
            "Name": product.Name,
            "Type": product.is_a(),
            **attributes,
        },
    }
```

---

## Edge Cases & Gotchas

### 1. Unit Scale Not Applied

<!-- fig:ifcos-unit-trap -->
<svg viewBox="-20 -33.5 488.6 125.8" role="img" aria-label="An unapplied IfcUnitAssignment leaves vertices in the authoring unit, so a metre-assuming consumer shrinks the model a thousandfold" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:489px;display:block;margin:1.5rem auto;">
  <title>How a millimetre model becomes a millimetre-scale building</title>
  <desc>The chain that produces the classic thousandfold error. The model declares its length unit on the project entity; the geometry settings decide whether the compiler applies it; if the unit is not applied, the returned vertices are raw numbers in the authoring unit; and a consumer that assumes metres draws a ten-metre wall one centimetre long. Nothing raises at any stage.</desc>
  <defs>
    <marker id="ios2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ios2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-33.5" width="488.6" height="125.8" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="130.8" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="65.4" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">IfcUnitAssignment</text>
  <text x="65.4" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">declares millimetres</text>
  <rect x="164.8" y="0" width="118.7" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="224.1" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Raw vertices</text>
  <text x="224.1" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">in the authoring unit</text>
  <rect x="317.5" y="0" width="131" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="383" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">10 m wall → 0.01 m</text>
  <text x="383" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">nothing raised</text>
  <line x1="130.8" y1="24.1" x2="164.8" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#ios2-a)"/>
  <text x="147.8" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">not applied</text>
  <line x1="283.5" y1="24.1" x2="317.5" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#ios2-a)"/>
  <text x="300.5" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">consumed as metres</text>
  <text x="0" y="70.2" font-size="9.5" fill="currentColor" fill-opacity="0.7">Read the unit assignment and assert the model extents before trusting any geometry.</text>
</svg>
<!-- /fig:ifcos-unit-trap -->

**Symptom:** Extracted buildings appear at millimeter scale (a 10m wall becomes 0.01m). **Root cause:** The file was authored in millimeters but `unit_scale` was never applied. **Fix:** Always call `ifcopenshell.util.unit.calculate_unit_scale(ifc)` and multiply vertex arrays before projection. Never assume meters.

```python
# ifcopenshell>=0.7.0
unit_scale = ifcopenshell.util.unit.calculate_unit_scale(ifc)
verts = verts * unit_scale  # convert to meters before pyproj
```

### 2. Missing Geometric Representation Context

**Symptom:** `create_shape` raises `RuntimeError: No geometric representation found`. **Root cause:** Some IFC products (space boundaries, annotation elements, type definitions) carry no body geometry. **Fix:** Filter before extraction using `product.Representation is not None`.

```python
geometric_products = [
    p for p in ifc.by_type("IfcProduct")
    if p.Representation is not None
]
```

### 3. Duplicate Global IDs in Federated Files

**Symptom:** Post-merge GeoJSON contains features with identical `GlobalId` values from two separate design disciplines. **Root cause:** GlobalId uniqueness is only guaranteed within a single IFC file, not across federated models. **Fix:** Prefix the GlobalId with a short file hash when merging.

```python
import hashlib
file_tag = hashlib.md5(str(path).encode()).hexdigest()[:6]
unique_id = f"{file_tag}_{product.GlobalId}"
```

### 4. USE_WORLD_COORDS and Nested Mapped Items

**Symptom:** Geometry for repeated components (structural columns, windows) appears at the origin instead of their placed positions. **Root cause:** `IfcMappedItem` references share a single compiled shape; when `USE_WORLD_COORDS=True`, the per-instance placement is baked in, but some ifcopenshell builds handle mapped items inconsistently. **Fix:** Use `ifcopenshell.geom.iterator` with `include_openings=False` for batch processing — it handles all placement types correctly including mapped items.

```python
# ifcopenshell>=0.7.0 — handles mapped items correctly
iterator = ifcopenshell.geom.iterator(settings, ifc, multiprocessing=True)
if iterator.initialize():
    while True:
        shape = iterator.get()
        process_shape(shape)
        if not iterator.next():
            break
```

### 5. Memory Exhaustion on Large Files (>500MB)

**Symptom:** Python process killed by OOM after processing several hundred products. **Root cause:** OpenCASCADE allocates native C++ heap that Python's garbage collector cannot reclaim. **Fix:** Use subprocess isolation — spawn a worker process per storey, serialize results to disk, terminate the process. This forces OS-level reclamation of the OCCT heap. See Performance & Scale below.

### 6. CRS Anchor Not Read From File

**Symptom:** Extracted geometry lands in the correct shape but at the wrong geographic location. **Root cause:** IFC4x1+ files may embed a georeferencing anchor via `IfcMapConversion` and `IfcProjectedCRS`. Ignoring these means the file's local origin is treated as `(0,0,0)` in the source CRS. **Fix:** Read the map conversion before projecting.

```python
# ifcopenshell>=0.7.0
import ifcopenshell.util.geolocation

crs_info = ifcopenshell.util.geolocation.get_crs(ifc)
# crs_info may contain authority (e.g. 'EPSG:32633') and offset
```

---

## Validation & Testing

Geometry extraction errors are silent by default — `create_shape` either succeeds or raises. Build explicit assertions to catch precision loss and topology failures before they propagate downstream.

```python
# ifcopenshell>=0.7.0 numpy>=1.24.0
import numpy as np

def validate_mesh(verts: np.ndarray, faces: np.ndarray, product_id: str):
    assert verts.ndim == 2 and verts.shape[1] == 3, \
        f"{product_id}: unexpected vertex shape {verts.shape}"
    assert faces.ndim == 2 and faces.shape[1] == 3, \
        f"{product_id}: unexpected face shape {faces.shape}"
    assert faces.max() < len(verts), \
        f"{product_id}: face index {faces.max()} out of range (nverts={len(verts)})"

    # Check bounding box is not degenerate
    bbox_size = verts.max(axis=0) - verts.min(axis=0)
    if bbox_size.max() < 1e-6:
        raise ValueError(f"{product_id}: zero-volume bounding box — likely unit scale error")

    # Check for NaN/Inf vertices
    if not np.isfinite(verts).all():
        raise ValueError(f"{product_id}: non-finite vertex coordinates detected")
```

Add a control-point check for CRS transformation: take one known anchor point from the IFC file's site geometry, project it independently, and assert that the transformed coordinates match a surveyed reference within an acceptable tolerance (typically 0.05m for infrastructure projects).

```python
def test_crs_transform(ifc, transformer, reference_xy, tolerance=0.05):
    # reference_xy: known (lon, lat) from survey control point
    site = ifc.by_type("IfcSite")[0]
    ref_lat = site.RefLatitude
    ref_lon = site.RefLongitude
    if ref_lat and ref_lon:
        projected = transformer.transform(ref_lon[0], ref_lat[0])
        dist = np.hypot(projected[0] - reference_xy[0], projected[1] - reference_xy[1])
        assert dist < tolerance, f"CRS anchor mismatch: {dist:.4f}m > {tolerance}m"
```

---

## Performance & Scale

### Iterator-Based Batch Processing

For files with thousands of products, `ifcopenshell.geom.create_shape` called in a loop pays per-call overhead for shape cache lookups. The `ifcopenshell.geom.iterator` API batches products, enables multi-core compilation, and handles mapped item instantiation correctly.

```python
# ifcopenshell>=0.7.0
import multiprocessing

def batch_extract(ifc_path: str, output_path: str):
    ifc = ifcopenshell.open(ifc_path)
    settings = make_settings(use_world_coords=True)
    iterator = ifcopenshell.geom.iterator(
        settings, ifc,
        multiprocessing=multiprocessing.cpu_count()
    )
    features = []
    if iterator.initialize():
        while True:
            shape = iterator.get()
            verts = np.array(shape.geometry.verts, dtype=np.float64).reshape(-1, 3)
            faces = np.array(shape.geometry.faces, dtype=np.int32).reshape(-1, 3)
            # ... project and serialize
            features.append({"id": shape.guid, "nverts": len(verts)})
            if not iterator.next():
                break
    return features
```

### Subprocess Isolation for Memory Safety

OpenCASCADE native heap does not cooperate with Python's `gc.collect()`. For pipelines processing hundreds of IFC files in a daemon, spawn a dedicated worker process per file using `multiprocessing.Process`. When the process terminates, the OS reclaims all OCCT allocations unconditionally.

```python
# ifcopenshell>=0.7.0 — subprocess isolation pattern
import multiprocessing
import json

def _worker(ifc_path, result_queue):
    ifc = ifcopenshell.open(ifc_path)
    unit_scale = ifcopenshell.util.unit.calculate_unit_scale(ifc)
    settings = make_settings()
    features = []
    for product in ifc.by_type("IfcBuildingElement"):
        result = extract_geometry(ifc, product, settings)
        if result:
            verts, faces = result
            verts = verts * unit_scale
            features.append({"id": product.GlobalId, "nverts": len(verts)})
    result_queue.put(features)

def safe_extract(ifc_path: str):
    q = multiprocessing.Queue()
    p = multiprocessing.Process(target=_worker, args=(ifc_path, q))
    p.start()
    p.join()          # OS reclaims OCCT heap on process exit
    return q.get() if not q.empty() else []
```

### Memory Budget Guidelines

| File size | Expected products | Recommended strategy |
|-----------|-----------------|---------------------|
| < 100MB | < 5,000 | Direct `create_shape` in-process |
| 100–500MB | 5,000–50,000 | `geom.iterator` with multiprocessing |
| 500MB–2GB | 50,000–200,000 | Subprocess isolation per storey chunk |
| > 2GB | > 200,000 | Split file with `ifcpatch`, process chunks independently |

---

## FAQ

<details>
<summary><strong>Does ifcopenshell support both IFC2x3 and IFC4?</strong></summary>

Yes. `ifcopenshell` auto-detects the schema from the `FILE_SCHEMA` header token and exposes it via `ifc.schema`. Most geometry APIs work identically across both schemas. The primary difference is that IFC4 introduces `IfcFacetedBrep` and `IfcAdvancedBrep` types that do not exist in IFC2x3 — check `ifc.schema` before branching on geometry type.

</details>

<details>
<summary><strong>Why does <code>ifcopenshell.geom.create_shape</code> raise <code>RuntimeError</code> for some products?</strong></summary>

Parametric representations that contain zero-area faces, degenerate edges, or broken boolean trees fail OpenCASCADE's BRep validation. This is common with structural elements authored in Revit using complex void families. Wrap every `create_shape` call in `try/except RuntimeError`, log the `GlobalId` and `Name`, and skip the product rather than aborting the batch.

</details>

<details>
<summary><strong>How do I determine the IFC file's native unit?</strong></summary>

Use `ifcopenshell.util.unit.calculate_unit_scale(ifc)` — it returns a float that converts native units to meters. A value of `1.0` means the file is already in meters; `0.001` means millimeters. Alternatively, inspect `ifc.by_type("IfcUnitAssignment")[0]` directly and look for `IfcSIUnit` entries where `UnitType == 'LENGTHUNIT'`.

</details>

<details>
<summary><strong>What is the best way to extract property sets (Psets)?</strong></summary>

Use `ifcopenshell.util.element.get_psets(product)` rather than manually traversing `IsDefinedBy` relationships. This helper returns a nested `dict` keyed by Pset name, flattening both `IfcPropertySingleValue` and `IfcPropertyEnumeratedValue` into plain Python types. The result is directly JSON-serializable without further processing.

</details>

<details>
<summary><strong>Can ifcopenshell handle federated (multi-model) IFC files?</strong></summary>

Federated IFC is not a single file format — federation is a host-application concept. In Python, open each constituent file separately with `ifcopenshell.open()`, extract geometry independently, and merge spatial hierarchies by matching on `GlobalId` or by applying a shared coordinate origin from `IfcMapConversion`. Prefix `GlobalId` values with a per-file hash to avoid collisions.

</details>

---

## Related Pages

- [Python Parsing & Geometry Extraction](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/) — parent overview of the full parsing pipeline for IFC, DXF, and DWG formats.
- [Extracting IFC Wall Geometries to Shapely](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/extracting-ifc-wall-geometries-to-shapely/) — optimized projection and polygonization routines for building footprints.
- [ezdxf Deep Dive](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/) — production DXF parsing patterns using a sibling Python library; shared architectural patterns apply.
- [pydwg Integration](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/) — legacy DWG format access from Python; relevant when IFC deliverables are unavailable.
- [Converting CAD Local Coordinates to EPSG:4326](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/converting-cad-local-coordinates-to-epsg4326/) — worked CRS transformation example that pairs directly with the vertex projection step above.
