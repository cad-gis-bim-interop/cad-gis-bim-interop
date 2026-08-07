---
title: "DXF vs IFC for GIS Ingestion: Choosing the Interchange Format"
description: "A decision guide comparing DXF and IFC as the interchange format feeding a GIS pipeline — semantic richness, georeferencing, geometry fidelity, parse cost, and tooling."
slug: "dxf-vs-ifc-for-gis-ingestion"
breadcrumb:
  - label: "Interoperability Decision Guides"
    url: "/interoperability-decision-guides/"
  - label: "DXF vs IFC for GIS Ingestion"
    url: "/interoperability-decision-guides/dxf-vs-ifc-for-gis-ingestion/"
datePublished: "2026-07-11"
dateModified: "2026-07-11"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "DXF vs IFC for GIS Ingestion: Choosing the Interchange Format",
      "description": "A decision guide comparing DXF and IFC as the interchange format feeding a GIS pipeline — semantic richness, georeferencing, geometry fidelity, parse cost, and tooling.",
      "datePublished": "2026-07-11",
      "dateModified": "2026-07-11",
      "author": {"@type": "Organization", "name": "CAD GIS BIM Interop"},
      "publisher": {"@type": "Organization", "name": "CAD GIS BIM Interop", "url": "https://www.cad-gis-bim-interop.org"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Interoperability Decision Guides", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/"},
        {"@type": "ListItem", "position": 2, "name": "DXF vs IFC for GIS Ingestion", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/dxf-vs-ifc-for-gis-ingestion/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Ingest DXF or IFC into a GIS Pipeline",
      "description": "Decide between DXF and IFC as the interchange format, then extract geometry and attributes into a GIS store using ezdxf, ifcopenshell, and shapely.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Classify the source", "text": "Determine whether the source is 2D survey/linework (favours DXF) or a semantically attributed BIM model (favours IFC)."},
        {"@type": "HowToStep", "position": 2, "name": "Ingest DXF geometry", "text": "Open the DXF with ezdxf, iterate LWPOLYLINE and LINE entities, and convert vertices to shapely geometries or GeoJSON features."},
        {"@type": "HowToStep", "position": 3, "name": "Ingest IFC geometry", "text": "Open the IFC with ifcopenshell, evaluate product representations with ifcopenshell.geom, and project meshes to 2D footprints with attributes."},
        {"@type": "HowToStep", "position": 4, "name": "Normalise and load", "text": "Apply unit scale and CRS reprojection, validate geometry, and write to a GeoPackage or PostGIS store."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Does DXF carry a coordinate reference system?",
          "acceptedAnswer": {"@type": "Answer", "text": "No. A DXF file stores coordinates in local drawing units with no embedded CRS. The $INSUNITS header records the base unit but not the projection or datum. You must supply the CRS out of band — from a survey control sheet, a sidecar file, or a georeferencing block — before reprojecting into a GIS coordinate system."}
        },
        {
          "@type": "Question",
          "name": "Can IFC store georeferencing?",
          "acceptedAnswer": {"@type": "Answer", "text": "Yes. IFC4 and IFC4X3 define IfcMapConversion and IfcProjectedCRS, which record the EPSG code, eastings/northings offset, scale, and rotation to true north. When these entities are populated, an IFC model carries enough information to place its geometry directly into a projected CRS without external control data."}
        },
        {
          "@type": "Question",
          "name": "Which format is faster to parse for a GIS pipeline?",
          "acceptedAnswer": {"@type": "Answer", "text": "DXF is dramatically cheaper. Reading DXF vertices is a direct memory access with no geometry evaluation. IFC requires evaluating parametric representations — swept solids, boolean operations, B-Reps — into explicit meshes through a geometry kernel, which is CPU-bound and can be one to two orders of magnitude slower per element."}
        },
        {
          "@type": "Question",
          "name": "When should I convert IFC to DXF instead of ingesting IFC directly?",
          "acceptedAnswer": {"@type": "Answer", "text": "Convert IFC to DXF only when the downstream GIS toolchain accepts DXF exclusively and you cannot run a Python IFC parser in the pipeline. The conversion discards semantic attributes unless you carry them into layer names or XDATA, so ingest IFC directly whenever the toolchain supports it."}
        }
      ]
    }
  ]
}
</script>

# DXF vs IFC for GIS Ingestion: Choosing the Interchange Format

Choosing between DXF and IFC as the interchange format that feeds a GIS pipeline is one of the first architectural decisions in any CAD/BIM-to-GIS integration, and it determines how much semantic and spatial fidelity survives ingestion.

This guide sits within the [Interoperability Decision Guides](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/) section and frames the choice as an engineering trade-off, not a format preference. DXF is a geometry-centric interchange format: it carries entities, layers, and coordinates but no building semantics and no coordinate reference system. IFC is a semantic, parametric model: it carries typed building elements, property sets, and — when authored correctly — embedded georeferencing, at the cost of a heavier file and an expensive geometry-evaluation step. The right answer depends on what your source actually is and what your GIS store needs to hold. Survey deliverables and 2D linework almost always arrive as DXF and belong on the DXF route; attributed BIM assets that must land in GIS with their identity and properties intact belong on the IFC route.

Both routes converge on the same destination — a spatially indexed GIS store — but they diverge sharply in how they extract geometry, how they recover attributes, and how much CPU they burn doing it.

<svg viewBox="0 0 776 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Two ingestion routes converging on a GIS store: a DXF route through ezdxf to shapely, and an IFC route through ifcopenshell to footprints, both passing a shared normalisation stage" style="width:100%;max-width:776px;display:block;margin:1.5rem auto;">
  <title>DXF and IFC Ingestion Routes Converging on a GIS Store</title>
  <desc>Diagram showing two parallel ingestion routes. The DXF route flows from a DXF input through ezdxf-to-shapely extraction. The IFC route flows from an IFC input through ifcopenshell geometry evaluation to footprints. Both routes feed a shared normalisation stage applying unit scale and CRS reprojection, which loads a GIS store such as PostGIS or GeoPackage.</desc>
  <defs>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor" opacity="0.6"/>
    </marker>
  </defs>
  <rect x="0" y="0" width="776" height="260" fill="var(--color-surface)"/>
  <!-- Sources -->
  <rect x="24" y="40" width="150" height="64" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
  <text x="99" y="70" text-anchor="middle" font-size="12" fill="currentColor" font-family="sans-serif" font-weight="600">DXF input</text>
  <text x="99" y="90" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">2D survey / linework</text>
  <rect x="24" y="176" width="150" height="64" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
  <text x="99" y="206" text-anchor="middle" font-size="12" fill="currentColor" font-family="sans-serif" font-weight="600">IFC input</text>
  <text x="99" y="226" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">attributed BIM model</text>
  <!-- Parsers -->
  <rect x="214" y="40" width="176" height="64" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
  <text x="302" y="70" text-anchor="middle" font-size="12" fill="currentColor" font-family="sans-serif" font-weight="600">ezdxf → shapely</text>
  <text x="302" y="90" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">read entity vertices</text>
  <rect x="214" y="176" width="176" height="64" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
  <text x="302" y="206" text-anchor="middle" font-size="12" fill="currentColor" font-family="sans-serif" font-weight="600">ifcopenshell.geom</text>
  <text x="302" y="226" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">mesh → footprint</text>
  <!-- Normalise -->
  <rect x="430" y="96" width="150" height="88" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.55"/>
  <text x="505" y="128" text-anchor="middle" font-size="12" fill="currentColor" font-family="sans-serif" font-weight="600">Normalise</text>
  <text x="505" y="148" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">unit scale</text>
  <text x="505" y="164" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">CRS reproject</text>
  <!-- GIS store -->
  <rect x="620" y="96" width="132" height="88" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.55"/>
  <text x="686" y="128" text-anchor="middle" font-size="12" fill="currentColor" font-family="sans-serif" font-weight="600">GIS store</text>
  <text x="686" y="148" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">PostGIS /</text>
  <text x="686" y="164" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">GeoPackage</text>
  <!-- Arrows -->
  <line x1="174" y1="72" x2="210" y2="72" stroke="currentColor" stroke-width="1.5" opacity="0.5" marker-end="url(#arr)"/>
  <line x1="174" y1="208" x2="210" y2="208" stroke="currentColor" stroke-width="1.5" opacity="0.5" marker-end="url(#arr)"/>
  <line x1="390" y1="72" x2="428" y2="120" stroke="currentColor" stroke-width="1.5" opacity="0.5" marker-end="url(#arr)"/>
  <line x1="390" y1="208" x2="428" y2="162" stroke="currentColor" stroke-width="1.5" opacity="0.5" marker-end="url(#arr)"/>
  <line x1="580" y1="140" x2="616" y2="140" stroke="currentColor" stroke-width="1.5" opacity="0.5" marker-end="url(#arr)"/>
</svg>

## Prerequisites

Before building either ingestion route, confirm the following:

- **Python 3.9+** — type hints, `pathlib`, and dataclasses are used throughout. `# python>=3.9`
- **ezdxf ≥ 1.1.0** — install with `pip install "ezdxf>=1.1.0"` for the DXF route.
- **ifcopenshell ≥ 0.8.0** — install with `pip install "ifcopenshell>=0.8.0"` for the IFC route; it bundles the geometry kernel used by `ifcopenshell.geom`.
- **shapely ≥ 2.0** — install with `pip install "shapely>=2.0"` for geometry construction and validation.
- **pyproj ≥ 3.4** — required for the shared CRS reprojection stage.
- **Knowledge of the source data model** — you need to know whether your input is discrete 2D linework or a semantically typed building model. The [DXF Entity Structure Breakdown](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/) and the [IFC4X3 Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/) document the two data models this guide compares.

## Architectural Overview

The two formats differ at the level of what a "feature" even is. In DXF, a feature is a geometric entity — a polyline, a line, a circle — tagged with a layer name and, optionally, block attributes or XDATA. There is no notion of a wall, a door, or a parcel; those meanings live only in layer-naming conventions that vary by drafter. In IFC, a feature is a typed object — `IfcWall`, `IfcSlab`, `IfcSpace` — with a stable global identifier, a class, and property sets, whose geometry is a parametric representation that must be evaluated before you can read a single coordinate.

That distinction cascades into every downstream concern:

<!-- fig:dxfifc-what-is-a-feature -->
<svg viewBox="-20 -20 590 194.1" role="img" aria-label="A DXF feature is an entity classified by layer-name convention; an IFC feature is a typed product classified by the schema" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:590px;display:block;margin:1.5rem auto;">
  <title>What counts as a feature in each format</title>
  <desc>The two formats disagree about what the unit of data is. In DXF a feature is a geometric entity whose meaning lives in its layer name, so classification is a string convention. In IFC a feature is a typed product with an explicit class, relationships and property sets, so classification is in the schema. That difference decides how much of the ingestion is parsing and how much is convention-guessing.</desc>
  <defs>
    <marker id="dvi1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="dvi1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="590" height="194.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="260" height="130" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="130" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">DXF: a geometric entity</text>
  <line x1="14" y1="33" x2="246" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="16" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— class lives in the layer name</text>
  <text x="16" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— convention, not schema</text>
  <text x="16" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— cheap to read, cheap to break</text>
  <text x="16" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— no units beyond $INSUNITS</text>
  <rect x="290" y="0" width="260" height="130" rx="6" fill="currentColor" fill-opacity="0.11" stroke="currentColor" stroke-width="1.9"/>
  <text x="420" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">IFC: a typed product</text>
  <line x1="304" y1="33" x2="536" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="306" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— class is in the schema</text>
  <text x="306" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— relationships and psets attached</text>
  <text x="306" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— expensive to evaluate</text>
  <text x="306" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— units and CRS declared</text>
  <text x="275" y="152" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">DXF ingestion is mostly convention handling; IFC ingestion is mostly geometry evaluation.</text>
</svg>
<!-- /fig:dxfifc-what-is-a-feature -->

| Dimension | DXF | IFC |
|-----------|-----|-----|
| Data model | Geometry entities + layers | Typed semantic objects + relationships |
| Semantic richness | None (layer-name conventions only) | High (`IfcWall`, property sets, classifications) |
| Georeferencing | None; `$INSUNITS` gives units only | `IfcMapConversion` + `IfcProjectedCRS` when authored |
| Geometry fidelity | Exact stored coordinates, 2D-centric | Exact parametric B-Rep, full 3D |
| Parse cost | Very low — direct coordinate read | High — kernel evaluates each representation |
| File size | Compact for equivalent linework | Large; carries semantics + geometry |
| Stable IDs | Entity handles (per-file, volatile) | `GlobalId` GUIDs (stable across exports) |
| Tooling maturity | Mature: `ezdxf`, GDAL DXF driver | Mature: `ifcopenshell`; heavier dependency |
| Typical source | Survey, cadastral, 2D CAD | Architectural / MEP / structural BIM |

**Version compatibility for the two routes:**

| Component | Supported range | Notes |
|---|---|---|
| `ezdxf` | `>=1.1.0` | Reads DXF R12–R2018; direct vertex access. |
| `ifcopenshell` | `>=0.8.0` | Reads IFC2X3, IFC4, IFC4X3; bundles geometry kernel. |
| `shapely` | `>=2.0` | GEOS-backed; vectorised geometry ops. |
| `pyproj` | `>=3.4` | PROJ bindings for the shared reprojection stage. |
| IFC georeferencing | IFC4 / IFC4X3 | `IfcMapConversion` requires IFC4+; IFC2X3 lacks it. |

`ezdxf` reads exactly what the DXF file stores and evaluates nothing — deterministic and fast. `ifcopenshell.geom` evaluates parametric definitions into meshes on demand, which is where both the value (true 3D geometry with semantics) and the cost (CPU-bound triangulation) of the IFC route come from.

## Step-by-Step Implementation

### 1. Classify the source and pick the route

<!-- fig:dxfifc-route-by-input -->
<svg viewBox="-20 -20 354.7 216.2" role="img" aria-label="Route 2D survey linework through DXF and a coordinated model with property sets through IFC — choose by deliverable, not format preference" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>Choosing the route from what the deliverable actually is</title>
  <desc>A branch on the nature of the deliverable rather than on format preference. Two-dimensional survey and cadastral linework carries its meaning in layer names and belongs on the DXF route. A coordinated model whose value is its typed products and property sets belongs on the IFC route. Choosing by format preference rather than by deliverable is what produces pipelines that fight their own input.</desc>
  <defs>
    <marker id="dvi2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="dvi2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="354.7" height="216.2" fill="var(--color-surface)"/>
  <polygon points="157.3,0 252.3,31 157.3,62 62.3,31" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-width="1.6"/>
  <text x="157.3" y="35" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">What is the deliverable?</text>
  <rect x="0" y="128" width="143.3" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="71.7" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">DXF route</text>
  <text x="71.7" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">layer-name classification</text>
  <path d="M 157.3 62 L 157.3 92 L 71.7 92 L 71.7 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#dvi2-a)" stroke-linejoin="round"/>
  <text x="71.7" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">2D linework</text>
  <rect x="171.3" y="128" width="143.3" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="243" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">IFC route</text>
  <text x="243" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">typed products + psets</text>
  <path d="M 157.3 62 L 157.3 92 L 243 92 L 243 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#dvi2-a)" stroke-linejoin="round"/>
  <text x="243" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">coordinated model</text>
</svg>
<!-- /fig:dxfifc-route-by-input -->

Before writing extraction code, classify the input. A survey or cadastral deliverable is 2D linework with meaning encoded in layer names — route it through DXF. A building model exported from Revit, ArchiCAD, or Tekla carries typed elements and properties you want to preserve — route it through IFC. The decision is about information content, not file extension.

```python
# python>=3.9
from pathlib import Path

def choose_route(path: Path) -> str:
    """Return 'dxf' or 'ifc' based on suffix; the semantic decision
    is made upstream by whoever classifies the deliverable."""
    suffix = path.suffix.lower()
    if suffix == ".dxf":
        return "dxf"   # geometry-centric: survey / 2D linework
    if suffix == ".ifc":
        return "ifc"   # semantic: attributed BIM assets
    raise ValueError(f"Unsupported interchange format: {suffix!r}")
```

### 2. Ingest DXF geometry with ezdxf and shapely

On the DXF route, iterate the modelspace, read vertices directly, and build shapely geometries. There is no geometry evaluation — vertices are read as stored. Carry the layer name across as the only available attribute.

```python
# ezdxf>=1.1.0 | shapely>=2.0 | python>=3.9
import ezdxf
from shapely.geometry import LineString, Polygon, mapping

def dxf_to_features(dxf_path: str, unit_scale: float = 1.0) -> list[dict]:
    """Extract LWPOLYLINE/LINE entities as GeoJSON-like features.
    unit_scale converts drawing units to metres (from $INSUNITS)."""
    doc = ezdxf.readfile(dxf_path)
    msp = doc.modelspace()
    features: list[dict] = []

    for e in msp.query("LWPOLYLINE"):
        pts = [(x * unit_scale, y * unit_scale) for x, y, *_ in e.get_points()]
        if e.closed and len(pts) >= 3:
            geom = Polygon(pts)
        else:
            geom = LineString(pts)
        features.append({
            "geometry": mapping(geom),
            "properties": {"layer": e.dxf.layer, "handle": e.dxf.handle},
        })

    for e in msp.query("LINE"):
        start = (e.dxf.start.x * unit_scale, e.dxf.start.y * unit_scale)
        end = (e.dxf.end.x * unit_scale, e.dxf.end.y * unit_scale)
        features.append({
            "geometry": mapping(LineString([start, end])),
            "properties": {"layer": e.dxf.layer, "handle": e.dxf.handle},
        })

    return features
```

The `$INSUNITS` header is the only unit signal DXF gives you; there is no CRS. The full traversal and block-flattening machinery — critical for real survey files with nested `INSERT` references — is documented in the [ezdxf Deep Dive](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/), and the conversion of raw polylines into RFC 7946 GeoJSON is covered in [Converting CAD Polylines to GeoJSON](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/converting-cad-polylines-to-geojson/).

### 3. Ingest IFC geometry with ifcopenshell

On the IFC route, evaluate each product's representation into a mesh, then project the mesh to a 2D footprint for the GIS store. This is where semantics survive: every feature keeps its `GlobalId`, class, and name.

```python
# ifcopenshell>=0.8.0 | shapely>=2.0 | python>=3.9
import ifcopenshell
import ifcopenshell.geom
import numpy as np
from shapely.geometry import Polygon, MultiPoint

def ifc_to_footprints(ifc_path: str, ifc_class: str = "IfcBuildingElement"):
    """Yield (GlobalId, ifc_class, name, footprint_polygon) for each product.
    The footprint is the 2D convex hull of the world-coordinate mesh vertices."""
    model = ifcopenshell.open(ifc_path)
    settings = ifcopenshell.geom.settings()
    settings.set(settings.USE_WORLD_COORDS, True)

    for product in model.by_type(ifc_class):
        if not product.Representation:
            continue
        try:
            shape = ifcopenshell.geom.create_shape(settings, product)
        except RuntimeError:
            continue  # unsupported representation — log and skip
        verts = np.array(shape.geometry.verts).reshape(-1, 3)
        xy = verts[:, :2]
        footprint = MultiPoint(xy).convex_hull
        if isinstance(footprint, Polygon):
            yield (
                product.GlobalId,
                product.is_a(),
                getattr(product, "Name", None),
                footprint,
            )
```

The convex hull is a deliberate simplification for footprint extraction; for accurate wall outlines that respect concavity, evaluate the representation and slice at a Z plane, as shown in [Extracting IFC Wall Geometries to Shapely](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/extracting-ifc-wall-geometries-to-shapely/). The complete geometry-settings and property-set traversal lives in the [ifcopenshell Workflow](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/).

### 4. Normalise units and CRS, then load

Both routes feed a shared normalisation stage. DXF geometry arrives in scaled local units with no CRS and must be georeferenced from external control. IFC geometry arrives in metres and — if `IfcMapConversion` is populated — already carries the offset and rotation needed to place it in a projected CRS.

```python
# pyproj>=3.4 | shapely>=2.0 | python>=3.9
from pyproj import Transformer
from shapely.ops import transform as shp_transform

def reproject(geom, src_epsg: int, dst_epsg: int):
    """Reproject a shapely geometry between CRSs. always_xy avoids
    lon/lat axis-order surprises."""
    tf = Transformer.from_crs(src_epsg, dst_epsg, always_xy=True)
    return shp_transform(lambda xs, ys, zs=None: tf.transform(xs, ys), geom)
```

Deriving the source CRS for DXF — including datum shifts and control-point alignment — is the subject of the [CRS Normalization Workflows](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/) section. Whichever route produced the geometry, the loaded output is a spatially indexed GIS store.

## Edge Cases & Gotchas

### DXF has no CRS — never assume one

A DXF file's `$INSUNITS` records the base unit (millimetres, metres, feet) but nothing about projection or datum. Ingesting DXF coordinates directly into a GIS layer tagged EPSG:4326 places every feature near the origin off the coast of West Africa. Always attach the CRS from an external source before reprojection:

```python
if src_epsg is None:
    raise ValueError("DXF carries no CRS; supply src_epsg from survey control.")
```

### IFC georeferencing may be absent or partial

`IfcMapConversion` is optional and frequently omitted by exporters. Check for it before trusting IFC coordinates as georeferenced:

```python
# ifcopenshell>=0.8.0
conversions = model.by_type("IfcMapConversion")
if not conversions:
    logging.warning("No IfcMapConversion; treat IFC coords as local, not projected.")
```

### Unsupported IFC representations silently vanish

`ifcopenshell.geom.create_shape()` raises `RuntimeError` on representations the kernel cannot evaluate. Without a guard, those elements disappear from the output with no error. Catch, log the `GlobalId`, and count skips so a CI gate can fail on excessive loss.

### DXF layer names are the only semantics you get

Because DXF has no object typing, a wall and a property boundary can share a layer if the drafter was careless. Do not infer feature class from geometry; map it from layer names using an explicit, reviewed lookup. This mapping problem is the subject of [Layer Mapping Logic](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/).

### Z coordinates behave differently across routes

IFC geometry is natively 3D; footprint extraction discards Z deliberately. DXF may store 2D `LWPOLYLINE` (no Z) or 3D entities. Decide the target dimension early — a mixed-dimension GIS layer rejects inserts in strict PostGIS configurations.

## Validation & Testing

Validate feature counts and geometry validity for both routes against known-good fixtures before committing to storage:

```python
# ezdxf>=1.1.0 | ifcopenshell>=0.8.0 | shapely>=2.0 | python>=3.9
from shapely.geometry import shape

def test_dxf_route_produces_valid_geometry():
    feats = dxf_to_features("tests/fixtures/survey.dxf", unit_scale=0.001)
    assert len(feats) == 42, "Expected 42 features from survey fixture"
    for f in feats:
        assert shape(f["geometry"]).is_valid

def test_ifc_route_preserves_globalids():
    ids = [gid for gid, *_ in ifc_to_footprints("tests/fixtures/building.ifc")]
    assert len(ids) == len(set(ids)), "GlobalIds must be unique per product"
    assert all(len(gid) == 22 for gid in ids), "IFC GUIDs are 22-char base64"
```

Curate fixtures that exercise the failure modes above: a DXF with `$INSUNITS=0`, an IFC without `IfcMapConversion`, and an IFC containing at least one representation the kernel cannot evaluate.

## Performance & Scale

The parse-cost gap between the two routes dominates capacity planning. DXF extraction is I/O-bound and reads vertices directly; a 200 MB survey DXF streams through `ezdxf` in seconds using generator traversal. IFC extraction is CPU-bound: every `create_shape()` call triangulates a parametric representation, and a large federated model with hundreds of thousands of elements can take minutes to hours.

For the DXF route, use generator-based iteration (`for e in msp.query(...)`) rather than `list(msp)` to keep memory flat on large files. For the IFC route, use `ifcopenshell.geom.iterator` with multiple worker threads to parallelise mesh evaluation, and filter by `ifc_class` before evaluating so you never triangulate elements you will discard:

```python
# ifcopenshell>=0.8.0 — parallel geometry evaluation
import multiprocessing
import ifcopenshell.geom

settings = ifcopenshell.geom.settings()
settings.set(settings.USE_WORLD_COORDS, True)
it = ifcopenshell.geom.iterator(
    settings, model, multiprocessing.cpu_count(),
    include=model.by_type("IfcSlab"),
)
if it.initialize():
    while True:
        shape = it.get()
        # process shape.geometry.verts here
        if not it.next():
            break
```

For repeated ingestion of the same federated model, cache evaluated footprints keyed by `GlobalId` so unchanged elements skip re-evaluation. Batch converted features into the GIS store in transactions of a few thousand rows to amortise index maintenance. When the downstream toolchain cannot run an IFC parser at all, the fallback is to pre-convert — covered in [Converting IFC to DXF as a GIS Fallback](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/dxf-vs-ifc-for-gis-ingestion/converting-ifc-to-dxf-as-a-gis-fallback/).

## FAQ

<details>
<summary><strong>Does DXF carry a coordinate reference system?</strong></summary>

No. A DXF file stores coordinates in local drawing units with no embedded CRS. The `$INSUNITS` header records the base unit but not the projection or datum. You must supply the CRS out of band — from a survey control sheet, a sidecar file, or a georeferencing block — before reprojecting into a GIS coordinate system.

</details>

<details>
<summary><strong>Can IFC store georeferencing?</strong></summary>

Yes. IFC4 and IFC4X3 define `IfcMapConversion` and `IfcProjectedCRS`, which record the EPSG code, eastings/northings offset, scale, and rotation to true north. When these entities are populated, an IFC model carries enough information to place its geometry directly into a projected CRS without external control data.

</details>

<details>
<summary><strong>Which format is faster to parse for a GIS pipeline?</strong></summary>

DXF is dramatically cheaper. Reading DXF vertices is a direct memory access with no geometry evaluation. IFC requires evaluating parametric representations — swept solids, boolean operations, B-Reps — into explicit meshes through a geometry kernel, which is CPU-bound and can be one to two orders of magnitude slower per element.

</details>

<details>
<summary><strong>When should I convert IFC to DXF instead of ingesting IFC directly?</strong></summary>

Convert IFC to DXF only when the downstream GIS toolchain accepts DXF exclusively and you cannot run a Python IFC parser in the pipeline. The conversion discards semantic attributes unless you carry them into layer names or XDATA, so ingest IFC directly whenever the toolchain supports it.

</details>

---

## Related Pages

- [Interoperability Decision Guides](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/) — the section overview framing format and library trade-offs for CAD/BIM-to-GIS pipelines
- [Converting IFC to DXF as a GIS Fallback](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/dxf-vs-ifc-for-gis-ingestion/converting-ifc-to-dxf-as-a-gis-fallback/) — when the toolchain only accepts DXF, evaluate IFC geometry and write entities with ezdxf
- [Choosing ezdxf, pydwg, or ODA for Production](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-ezdxf-pydwg-or-oda-for-production/) — selecting the DXF/DWG parsing stack that feeds the DXF route
- [GeoPackage vs PostGIS for CAD Output](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/geopackage-vs-postgis-for-cad-output/) — choosing the storage target both routes converge on
- [DXF Entity Structure Breakdown](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/) — the group-code data model behind the DXF route
- [IFC4X3 Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/) — the semantic schema behind the IFC route
- [ifcopenshell Workflow](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/) — geometry evaluation and property-set extraction for IFC ingestion
