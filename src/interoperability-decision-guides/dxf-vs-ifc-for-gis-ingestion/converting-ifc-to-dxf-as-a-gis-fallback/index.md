---
title: "Converting IFC to DXF as a GIS Fallback in Python"
description: "Convert IFC to DXF when a GIS toolchain accepts only DXF: evaluate geometry with ifcopenshell and write footprints with ezdxf, preserving IDs in layers."
slug: "converting-ifc-to-dxf-as-a-gis-fallback"
breadcrumb:
  - label: "Interoperability Decision Guides"
    url: "/interoperability-decision-guides/"
  - label: "DXF vs IFC for GIS Ingestion"
    url: "/interoperability-decision-guides/dxf-vs-ifc-for-gis-ingestion/"
  - label: "Converting IFC to DXF as a GIS Fallback"
    url: "/interoperability-decision-guides/dxf-vs-ifc-for-gis-ingestion/converting-ifc-to-dxf-as-a-gis-fallback/"
datePublished: "2026-07-11"
dateModified: "2026-07-11"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Converting IFC to DXF as a GIS Fallback in Python",
      "description": "Convert IFC to DXF when a GIS toolchain accepts only DXF: evaluate geometry with ifcopenshell and write footprints with ezdxf, preserving IDs in layers.",
      "datePublished": "2026-07-11",
      "dateModified": "2026-07-11",
      "author": {"@type": "Organization", "name": "CAD GIS BIM Interop"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/dxf-vs-ifc-for-gis-ingestion/converting-ifc-to-dxf-as-a-gis-fallback/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Interoperability Decision Guides", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/"},
        {"@type": "ListItem", "position": 2, "name": "DXF vs IFC for GIS Ingestion", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/dxf-vs-ifc-for-gis-ingestion/"},
        {"@type": "ListItem", "position": 3, "name": "Converting IFC to DXF as a GIS Fallback", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/dxf-vs-ifc-for-gis-ingestion/converting-ifc-to-dxf-as-a-gis-fallback/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Convert IFC to DXF as a GIS Fallback",
      "description": "Evaluate IFC product geometry with ifcopenshell.geom and write footprints and meshes to DXF with ezdxf, preserving GlobalId and name into layer names and XDATA.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Open the IFC and configure geometry settings", "text": "Load the IFC model with ifcopenshell.open and set USE_WORLD_COORDS so evaluated meshes are placed in model coordinates."},
        {"@type": "HowToStep", "position": 2, "name": "Create the DXF document", "text": "Create a new DXF document with ezdxf.new() and obtain the modelspace to receive converted entities."},
        {"@type": "HowToStep", "position": 3, "name": "Evaluate and write geometry", "text": "For each product, evaluate its shape, then write a footprint LWPOLYLINE and a full MESH entity, tagging the layer with the class and GlobalId."},
        {"@type": "HowToStep", "position": 4, "name": "Attach attributes and save", "text": "Store GlobalId and Name as XDATA on each entity, then save the DXF for the DXF-only GIS toolchain."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What semantics are lost when converting IFC to DXF?",
          "acceptedAnswer": {"@type": "Answer", "text": "Everything the IFC schema encodes as typed objects and relationships: element classes, property sets, quantity sets, spatial containment, and classification references. DXF has no object model, so these survive only if you serialise them into layer names, XDATA, or block attributes, and even then they become opaque strings rather than queryable structure."}
        },
        {
          "@type": "Question",
          "name": "Should I export footprints or full meshes to DXF?",
          "acceptedAnswer": {"@type": "Answer", "text": "Export footprints when the GIS toolchain works in 2D — parcels, coverage maps, planning overlays — because a 2D LWPOLYLINE is what those tools index. Export full meshes with add_mesh only when the target genuinely consumes 3D DXF geometry, which is rare in GIS. When unsure, write footprints and keep the mesh export behind a flag."}
        },
        {
          "@type": "Question",
          "name": "How do I preserve the IFC GlobalId in DXF?",
          "acceptedAnswer": {"@type": "Answer", "text": "Two mechanisms: encode it in the layer name (for example IfcWall_1a2B3c) so it survives any DXF reader, and attach it as XDATA under a registered application id so it survives round-trips through XDATA-aware tools. Layer names are the more portable of the two because every DXF consumer preserves them."}
        }
      ]
    }
  ]
}
</script>

# Converting IFC to DXF as a GIS Fallback in Python

To convert IFC to DXF as a fallback, evaluate each IFC product's geometry with `ifcopenshell.geom`, then write the resulting vertices to a new DXF document with `ezdxf` — a footprint `LWPOLYLINE` for 2D toolchains, a `MESH` entity for 3D — and carry the `GlobalId` and name into layer names or XDATA so identity survives the loss of semantics. This is a deliberate downgrade, appropriate only when the receiving GIS toolchain accepts DXF exclusively and cannot run a Python IFC parser. When you can ingest IFC directly, do so; the trade-offs are laid out in the [DXF vs IFC for GIS Ingestion](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/dxf-vs-ifc-for-gis-ingestion/) guide.

## How ifcopenshell and ezdxf Handle the Conversion

The conversion bridges two libraries with opposite jobs. `ifcopenshell.geom.create_shape()` reads a parametric IFC representation and evaluates it into an explicit triangulated mesh — a flat `verts` array of XYZ triples and a `faces` array of vertex indices, expressed in world coordinates when `USE_WORLD_COORDS` is set. `ezdxf` then writes those explicit primitives into DXF entities: `add_lwpolyline` for a 2D footprint ring, `add_polyline3d` for a 3D polyline, or `add_mesh` for a full faceted surface.

Neither library does the semantic bridging for you. IFC's typed objects, property sets, and relationships have no DXF equivalent, so the conversion is lossy by construction. What `ezdxf` gives you to preserve identity is the layer name and XDATA — free-form string attachments keyed by a registered application id. Use them deliberately: the layer name is the most portable carrier because every DXF consumer preserves it, while XDATA survives only through XDATA-aware readers.

<!-- fig:ifc2dxf-libraries -->
<svg viewBox="-20 -33.5 477 125.8" role="img" aria-label="IfcOpenShell evaluates parametric IFC into a mesh and ezdxf writes explicit geometry — the mesh is the only shared representation" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:477px;display:block;margin:1.5rem auto;">
  <title>Two libraries with opposite jobs, joined at the mesh</title>
  <desc>The conversion joins a geometry kernel to a writer. IfcOpenShell evaluates a parametric IFC representation into an explicit triangulated mesh; ezdxf writes explicit geometry into a tagged DXF. The mesh is the only thing they share, which is why everything semantic about the IFC product has to be carried across as layer names and attributes rather than as structure.</desc>
  <defs>
    <marker id="i2d1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="i2d1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-33.5" width="477" height="125.8" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="93.8" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="46.9" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">IFC product</text>
  <text x="46.9" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">parametric</text>
  <rect x="127.8" y="0" width="131.7" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="193.6" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Triangulated mesh</text>
  <text x="193.6" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">explicit vertices</text>
  <rect x="293.5" y="0" width="143.5" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="365.2" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">DXF entities</text>
  <text x="365.2" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">LWPOLYLINE on a layer</text>
  <line x1="93.8" y1="24.1" x2="127.8" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#i2d1-a)"/>
  <text x="110.8" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">create_shape</text>
  <line x1="259.5" y1="24.1" x2="293.5" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#i2d1-a)"/>
  <text x="276.5" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">project + write</text>
  <text x="0" y="70.2" font-size="9.5" fill="currentColor" fill-opacity="0.7">Everything the product knew about itself has to survive as a layer name or an attribute.</text>
</svg>
<!-- /fig:ifc2dxf-libraries -->

The value of doing this in code rather than a GUI export is control over exactly which representation you keep. Writing a full mesh for every wall produces a DXF that a 2D GIS tool cannot use and that bloats to hundreds of megabytes; writing a footprint keeps the file small and directly indexable. The [ifcopenshell Workflow](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/) covers the geometry-settings object in depth.

## Production-Ready Script

The following script converts an IFC model to a DXF file. For each building element it evaluates the mesh, writes a 2D footprint `LWPOLYLINE` on a layer named after the element class and `GlobalId`, optionally writes a full `MESH`, and attaches `GlobalId` and `Name` as XDATA.

```python
# ifcopenshell>=0.8.0 | ezdxf>=1.1.0 | shapely>=2.0 | python>=3.9
import re
import ifcopenshell
import ifcopenshell.geom
import numpy as np
import ezdxf
from shapely.geometry import MultiPoint, Polygon

APPID = "IFC2DXF"  # registered XDATA application id

def _safe_layer(ifc_class: str, global_id: str) -> str:
    """DXF layer names forbid a few characters; sanitise and tag with the GUID."""
    stem = f"{ifc_class}_{global_id}"
    return re.sub(r'[<>/\\":;?*|=`,]', "_", stem)[:255]

def convert_ifc_to_dxf(
    ifc_path: str,
    dxf_path: str,
    ifc_class: str = "IfcBuildingElement",
    write_mesh: bool = False,
) -> int:
    """Convert IFC products to DXF footprints (+ optional meshes).
    Returns the number of products written."""
    model = ifcopenshell.open(ifc_path)
    settings = ifcopenshell.geom.settings()
    settings.set(settings.USE_WORLD_COORDS, True)

    doc = ezdxf.new("R2018")          # AC1032 — modern DXF for MESH support
    doc.appids.add(APPID)             # register the XDATA application id once
    msp = doc.modelspace()

    written = 0
    for product in model.by_type(ifc_class):
        if not product.Representation:
            continue
        try:
            shape = ifcopenshell.geom.create_shape(settings, product)
        except RuntimeError:
            continue  # unsupported representation — skip, do not abort the file

        verts = np.array(shape.geometry.verts, dtype=float).reshape(-1, 3)
        faces = np.array(shape.geometry.faces, dtype=int).reshape(-1, 3)
        if len(verts) == 0:
            continue

        layer = _safe_layer(product.is_a(), product.GlobalId)
        name = getattr(product, "Name", None) or ""

        # 2D footprint: convex hull of the XY projection
        hull = MultiPoint(verts[:, :2]).convex_hull
        if isinstance(hull, Polygon):
            ring = list(hull.exterior.coords)
            lw = msp.add_lwpolyline(ring, close=True, dxfattribs={"layer": layer})
            lw.set_xdata(APPID, [(1000, product.GlobalId), (1000, name)])

        # Optional full 3D mesh
        if write_mesh and len(faces) > 0:
            mesh = msp.add_mesh(dxfattribs={"layer": layer})
            with mesh.edit_data() as data:
                data.vertices = [tuple(v) for v in verts]
                data.faces = [tuple(f) for f in faces]
            mesh.set_xdata(APPID, [(1000, product.GlobalId), (1000, name)])

        written += 1

    doc.saveas(dxf_path)
    return written

if __name__ == "__main__":
    n = convert_ifc_to_dxf("building.ifc", "building.dxf", write_mesh=False)
    print(f"Wrote {n} products to DXF")
```

<!-- fig:ifc2dxf-what-is-lost -->
<svg viewBox="-20 -20 570 194.1" role="img" aria-label="Geometry and layer-encoded classification survive an IFC to DXF downgrade; the product hierarchy, property sets and georeferencing do not" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:570px;display:block;margin:1.5rem auto;">
  <title>What survives the downgrade and what does not</title>
  <desc>Two columns listing what the DXF still carries after the conversion and what only existed in the IFC. Geometry and a classification encoded in the layer name survive. The typed product hierarchy, property sets, material assignments and the georeferencing that made the model placeable do not, unless they are deliberately re-encoded on the way out.</desc>
  <defs>
    <marker id="i2d2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="i2d2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="570" height="194.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="250" height="130" rx="6" fill="currentColor" fill-opacity="0.11" stroke="currentColor" stroke-width="1.9"/>
  <text x="125" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Survives</text>
  <line x1="14" y1="33" x2="236" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="16" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— footprint and mesh geometry</text>
  <text x="16" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— class encoded in the layer name</text>
  <text x="16" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— a chosen attribute in XDATA</text>
  <text x="16" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— placement, if written explicitly</text>
  <rect x="280" y="0" width="250" height="130" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4" stroke-dasharray="5 4"/>
  <text x="405" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Lost unless re-encoded</text>
  <line x1="294" y1="33" x2="516" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="296" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— typed product hierarchy</text>
  <text x="296" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— property and quantity sets</text>
  <text x="296" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— material assignments</text>
  <text x="296" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— IfcMapConversion georeferencing</text>
  <text x="265" y="152" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">A fallback, not an equivalence — decide what to re-encode before converting.</text>
</svg>
<!-- /fig:ifc2dxf-what-is-lost -->

**Key implementation notes:**

- `ezdxf.new("R2018")` selects DXF version AC1032; the `MESH` entity requires R2000 or later, so do not target R12 if you intend to write meshes.
- `USE_WORLD_COORDS` places evaluated geometry in model coordinates, so no manual placement-matrix multiplication is needed before writing to DXF.
- The `RuntimeError` guard around `create_shape()` skips representations the kernel cannot evaluate instead of aborting the whole conversion — the same isolation pattern the direct-ingestion route uses.
- `doc.appids.add(APPID)` must run once before any `set_xdata` call; writing XDATA under an unregistered application id raises `DXFValueError`.
- XDATA group code `1000` stores strings; keep each value under 255 bytes or split across multiple `1000` records.
- For accurate (non-convex) footprints, replace the convex hull with a Z-plane slice of the mesh — see the wall-outline technique linked below.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `ifcopenshell` | `>=0.8.0` | Bundles the geometry kernel used by `create_shape`. |
| `ezdxf` | `>=1.1.0` | `add_mesh`, `add_lwpolyline`, `add_polyline3d`, XDATA API. |
| `shapely` | `>=2.0` | Convex hull / footprint construction. |
| DXF target version | `R2000`–`R2018` | `MESH` needs R2000+; `R2018` (AC1032) recommended. |
| IFC schema | IFC2X3 / IFC4 / IFC4X3 | Georeferencing carries only from IFC4+. |
| Units | Model native | IFC length unit is usually metres; verify before writing. |

## Fallback Strategies

Convert defensively — the IFC-to-DXF downgrade fails in predictable ways, and each has a concrete mitigation.

<!-- fig:ifc2dxf-failure-modes -->
<svg viewBox="-20 -20 504.5 214.1" role="img" aria-label="Missing geometry, unit mismatch, huge coordinates and mesh explosion — the four recurring IFC to DXF conversion failures" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:505px;display:block;margin:1.5rem auto;">
  <title>How the downgrade fails, and what each failure looks like</title>
  <desc>Four recurring failures of an IFC-to-DXF conversion, the symptom each produces in the output, and the mitigation. All four produce a DXF that opens cleanly, which is why the conversion has to be checked against entity counts and extents rather than against whether it raised.</desc>
  <defs>
    <marker id="i2d3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="i2d3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="504.5" height="214.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="464.5" height="152" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="464.5" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">Failure</text>
  <text x="233.6" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Symptom in the DXF</text>
  <line x1="311.1" y1="0" x2="311.1" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="387.8" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Mitigation</text>
  <line x1="156.1" y1="0" x2="156.1" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="464.5" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">Element has no geometry</text>
  <text x="233.6" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">silently absent</text>
  <text x="387.8" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">count in vs out, per class</text>
  <line x1="0" y1="62" x2="464.5" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">Unit assignment ignored</text>
  <text x="233.6" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">1 000× extents</text>
  <text x="387.8" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">read IfcUnitAssignment first</text>
  <line x1="0" y1="92" x2="464.5" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">Full projected coordinates</text>
  <text x="233.6" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">precision loss far from origin</text>
  <text x="387.8" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">write a local origin + offset</text>
  <line x1="0" y1="122" x2="464.5" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="140.5" font-size="10.5" font-weight="600" fill="currentColor">Every face written</text>
  <text x="233.6" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">unusable entity counts</text>
  <text x="387.8" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">project to a footprint</text>
  <text x="0" y="172" font-size="9.5" fill="currentColor" fill-opacity="0.7">Each of these produces a DXF that opens — verify counts and extents, not exit status.</text>
</svg>
<!-- /fig:ifc2dxf-failure-modes -->

**1. Choose footprint over mesh by default**

Most GIS toolchains that demand DXF are 2D. Writing full meshes produces geometry those tools silently ignore while inflating file size. Default to footprint `LWPOLYLINE` output and expose mesh export behind an explicit `write_mesh=True` flag used only when the target consumes 3D DXF.

**2. Carry attributes through layers first, XDATA second**

Encode the element class and `GlobalId` in the layer name (`IfcWall_1a2B3c...`) because every DXF reader preserves layers, and attach the full property payload as XDATA for readers that support it. If you must preserve richer attributes, write them as block attributes (`ATTRIB`) on an `INSERT`, which more GIS tools surface than XDATA. The layer-to-feature-class mapping on the receiving side is covered in [Layer Mapping Logic](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/).

**3. Resolve units and CRS before writing**

IFC lengths are usually metres, but always read the project length unit rather than assuming it. DXF has no CRS field, so if the IFC carried `IfcMapConversion` georeferencing, apply the offset and rotation to the vertices before writing — the DXF will otherwise land in local coordinates with the georeferencing lost. Reprojection into a target CRS is covered in [CRS Normalization Workflows](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/).

**4. Stream huge models instead of buffering**

A federated model can hold hundreds of thousands of elements. Do not accumulate all entities in memory before saving; write footprints as you evaluate, and for very large jobs split output across multiple DXF files by storey or by class. Use `ifcopenshell.geom.iterator` with multiple worker threads to keep mesh evaluation from becoming the bottleneck.

**5. Degrade gracefully on empty geometry**

Products with a `Representation` can still yield zero vertices (annotation-only or void elements). Guard on `len(verts) == 0` and skip rather than writing a degenerate zero-area polyline that corrupts the downstream spatial index.

## FAQ

<details>
<summary><strong>What semantics are lost when converting IFC to DXF?</strong></summary>

Everything the IFC schema encodes as typed objects and relationships: element classes, property sets, quantity sets, spatial containment, and classification references. DXF has no object model, so these survive only if you serialise them into layer names, XDATA, or block attributes, and even then they become opaque strings rather than queryable structure.

</details>

<details>
<summary><strong>Should I export footprints or full meshes to DXF?</strong></summary>

Export footprints when the GIS toolchain works in 2D — parcels, coverage maps, planning overlays — because a 2D `LWPOLYLINE` is what those tools index. Export full meshes with `add_mesh` only when the target genuinely consumes 3D DXF geometry, which is rare in GIS. When unsure, write footprints and keep the mesh export behind a flag.

</details>

<details>
<summary><strong>How do I preserve the IFC GlobalId in DXF?</strong></summary>

Two mechanisms: encode it in the layer name (for example `IfcWall_1a2B3c`) so it survives any DXF reader, and attach it as XDATA under a registered application id so it survives round-trips through XDATA-aware tools. Layer names are the more portable of the two because every DXF consumer preserves them.

</details>

---

## Related Pages

- [DXF vs IFC for GIS Ingestion](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/dxf-vs-ifc-for-gis-ingestion/) — the decision guide that frames when this fallback is warranted
- [Converting CAD Polylines to GeoJSON](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/converting-cad-polylines-to-geojson/) — the reverse direction, turning the DXF footprints produced here into GIS-ready GeoJSON
- [Extracting IFC Wall Geometries to Shapely](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/extracting-ifc-wall-geometries-to-shapely/) — accurate, non-convex footprint extraction by slicing evaluated IFC meshes
- [ifcopenshell Workflow](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/) — geometry-settings configuration and property-set traversal for IFC
