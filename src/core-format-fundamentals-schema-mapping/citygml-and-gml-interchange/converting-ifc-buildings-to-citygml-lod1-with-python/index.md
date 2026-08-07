---
title: "Converting IFC Buildings to CityGML LoD1 with Python"
description: "Generalise an IFC building into a CityGML LoD1 solid in Python: derive the footprint, resolve a single representative height, emit a valid prismatic solid, and carry the identifier so the city object can be matched back."
slug: "converting-ifc-buildings-to-citygml-lod1-with-python"
breadcrumb:
  - label: "Core Format Fundamentals & Schema Mapping"
    url: "/core-format-fundamentals-schema-mapping/"
  - label: "CityGML and GML Interchange"
    url: "/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/"
  - label: "Converting IFC Buildings to CityGML LoD1 with Python"
    url: "/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/converting-ifc-buildings-to-citygml-lod1-with-python/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Converting IFC Buildings to CityGML LoD1 with Python",
      "description": "Generalise an IFC building into a CityGML LoD1 solid in Python: derive the footprint, resolve a single representative height, emit a valid prismatic solid, and carry the identifier so the city object can be matched back.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/converting-ifc-buildings-to-citygml-lod1-with-python/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Core Format Fundamentals & Schema Mapping", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/"},
        {"@type": "ListItem", "position": 2, "name": "CityGML and GML Interchange", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/"},
        {"@type": "ListItem", "position": 3, "name": "Converting IFC Buildings to CityGML LoD1 with Python", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/converting-ifc-buildings-to-citygml-lod1-with-python/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Convert an IFC building to a CityGML LoD1 solid",
      "description": "Derive the footprint from the model, resolve one representative height, build the prismatic solid, and write it as a city object with a stable identifier.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Evaluate the building envelope", "text": "Compile the geometry of the building elements in world coordinates and union their projections into a single footprint."},
        {"@type": "HowToStep", "position": 2, "name": "Resolve one representative height", "text": "Choose the height that LoD1 declares, normally the eaves or the roof height above the terrain intersection, and record which was used."},
        {"@type": "HowToStep", "position": 3, "name": "Extrude to a prismatic solid", "text": "Build the solid from the footprint ring, a translated copy of it and the connecting side faces, with consistent outward orientation."},
        {"@type": "HowToStep", "position": 4, "name": "Emit the city object", "text": "Write a Building feature with a lod1Solid property, a gml:id carried from the IFC GlobalId, and the source coordinate reference system named."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Which height should LoD1 use?",
          "acceptedAnswer": {"@type": "Answer", "text": "Whichever your consumer expects, stated explicitly. The common choices are the eaves height and the maximum roof height, and they differ by metres on a pitched roof. CityGML has an attribute for measured height, so record which definition was applied rather than leaving the number unqualified — a shadow study and a volume calculation want different answers."}
        },
        {
          "@type": "Question",
          "name": "Do I need the whole IFC model to produce LoD1?",
          "acceptedAnswer": {"@type": "Answer", "text": "No, and evaluating all of it is the slow way. The envelope elements — external walls, roofs, slabs — determine the footprint and height. Filtering to those classes before compiling geometry typically cuts the work by an order of magnitude on a detailed model."}
        },
        {
          "@type": "Question",
          "name": "Why does my extruded solid fail validation?",
          "acceptedAnswer": {"@type": "Answer", "text": "Usually ring orientation. A prismatic solid needs consistently outward-facing surfaces, and a footprint ring taken straight from a union may be clockwise or counter-clockwise depending on the geometry it came from. Normalise the ring winding before building the side faces, and orient the top and bottom caps to match."}
        }
      ]
    }
  ]
}
</script>

# Converting IFC Buildings to CityGML LoD1 with Python

To convert an IFC building to CityGML LoD1, union the projected footprints of its envelope elements into one polygon, resolve a single representative height, and extrude the footprint into a prismatic solid carrying the IFC identifier. LoD1 is a deliberate generalisation: everything the design model knows about assemblies, materials and systems is discarded, and what remains is a block with a height and an identity. This page is part of the [CityGML and GML Interchange](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/) reference.

## How the Generalisation Works

LoD1 declares that the geometry is a prism: a footprint extruded to one height, with a flat top. That declaration is a claim about the data, so the conversion's job is to produce geometry the claim is true of, not to preserve as much of the source as possible.

<!-- fig:lod1-generalisation -->
<svg viewBox="-20 -33.5 581.8 101.7" role="img" aria-label="Footprint, representative height, extrusion and carried identity — the four stages of an LoD1 generalisation" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:582px;display:block;margin:1.5rem auto;">
  <title>Three decisions turn a model into a level-one solid</title>
  <desc>Four stages. Envelope elements are compiled and projected into a single footprint; one representative height is chosen and recorded; the footprint is extruded into a prism; the identifier is carried across so the city object can be reconciled with the model. Everything the design model knew about assemblies, materials and systems is discarded deliberately.</desc>
  <defs>
    <marker id="l11-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="l11-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-33.5" width="581.8" height="101.7" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="133.9" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="66.9" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Envelope elements</text>
  <text x="66.9" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">walls, roofs, slabs</text>
  <rect x="167.9" y="0" width="99.7" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="217.7" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">One footprint</text>
  <text x="217.7" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">principal mass</text>
  <rect x="301.5" y="0" width="118.6" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="360.8" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Prism</text>
  <text x="360.8" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">flat top by definition</text>
  <rect x="454.2" y="0" width="87.6" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="498" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">City object</text>
  <text x="498" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">reconcilable</text>
  <line x1="133.9" y1="24.1" x2="167.9" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#l11-a)"/>
  <text x="150.9" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">project + union</text>
  <line x1="267.5" y1="24.1" x2="301.5" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#l11-a)"/>
  <text x="284.5" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">choose a height</text>
  <line x1="420.2" y1="24.1" x2="454.2" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#l11-a)"/>
  <text x="437.2" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">carry GlobalId</text>
</svg>
<!-- /fig:lod1-generalisation -->

Three decisions do all the work. The **footprint** comes from projecting the envelope elements and unioning the result — the same operation described in [Extracting IFC Wall Geometries to Shapely](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/extracting-ifc-wall-geometries-to-shapely/), applied to the building rather than to one element. The **height** is a choice between eaves and ridge, and the two differ by metres on any pitched roof, so it must be recorded rather than assumed. The **identity** is carried from the IFC `GlobalId`, which is what allows a city object to be reconciled with the model it came from.

## Production-Ready Script

{% raw %}
```python
# ifcopenshell>=0.7.0, shapely>=2.0, numpy>=1.24, lxml>=4.9, Python 3.9+
from __future__ import annotations

from dataclasses import dataclass
import numpy as np
import ifcopenshell
import ifcopenshell.geom
from shapely.geometry import Polygon
from shapely.ops import unary_union
from shapely.geometry.polygon import orient

ENVELOPE = ("IfcWall", "IfcWallStandardCase", "IfcRoof", "IfcSlab", "IfcCurtainWall")


@dataclass(frozen=True)
class Lod1Building:
    global_id: str
    footprint: Polygon
    base_z: float
    height: float
    height_definition: str          # "eaves" | "ridge" — recorded, never implied


def _settings():
    s = ifcopenshell.geom.settings()
    s.set(s.USE_WORLD_COORDS, True)     # compose the placement chain in the kernel
    return s


def envelope_footprint(model, building, settings) -> tuple[Polygon, float, float]:
    """Union the projected envelope elements; return footprint, base and top Z."""
    polys, zmin, zmax = [], np.inf, -np.inf
    for cls in ENVELOPE:
        for el in model.by_type(cls):
            if not el.Representation:
                continue
            try:
                shape = ifcopenshell.geom.create_shape(settings, el)
            except RuntimeError:
                continue                      # unsupported representation — counted upstream
            v = np.array(shape.geometry.verts).reshape(-1, 3)
            f = np.array(shape.geometry.faces).reshape(-1, 3)
            zmin, zmax = min(zmin, v[:, 2].min()), max(zmax, v[:, 2].max())
            for tri in v[f][:, :, :2]:        # project each triangle to plan
                p = Polygon(tri)
                if p.is_valid and p.area > 1e-9:
                    polys.append(p)
    if not polys:
        raise ValueError("no envelope geometry produced a projectable face")
    merged = unary_union(polys)
    if merged.geom_type == "MultiPolygon":
        merged = max(merged.geoms, key=lambda g: g.area)   # the principal mass
    return orient(merged, sign=1.0), float(zmin), float(zmax)


def to_lod1(ifc_path: str, height_definition: str = "ridge") -> list[Lod1Building]:
    model = ifcopenshell.open(ifc_path)
    settings = _settings()
    out = []
    for building in model.by_type("IfcBuilding"):
        footprint, zmin, zmax = envelope_footprint(model, building, settings)
        out.append(Lod1Building(
            global_id=building.GlobalId,
            footprint=footprint,
            base_z=zmin,
            height=zmax - zmin,
            height_definition=height_definition,
        ))
    return out


def prism_surfaces(b: Lod1Building) -> list[list[tuple[float, float, float]]]:
    """Bottom, top and side faces of the LoD1 solid, consistently oriented."""
    ring = list(b.footprint.exterior.coords)
    z0, z1 = b.base_z, b.base_z + b.height
    bottom = [(x, y, z0) for x, y in ring][::-1]      # downward-facing
    top = [(x, y, z1) for x, y in ring]
    sides = []
    for (x0, y0), (x1, y1) in zip(ring, ring[1:]):
        sides.append([(x0, y0, z0), (x1, y1, z0), (x1, y1, z1), (x0, y0, z1), (x0, y0, z0)])
    return [bottom, top, *sides]


if __name__ == "__main__":
    for b in to_lod1("model.ifc"):
        print(f"{b.global_id}: area {b.footprint.area:.1f} m2, "
              f"height {b.height:.2f} m ({b.height_definition})")
```
{% endraw %}

<!-- fig:lod1-height-choice -->
<svg viewBox="-20 -20 558 194.1" role="img" aria-label="Eaves and ridge heights differ by metres on a pitched roof and suit different analyses" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:558px;display:block;margin:1.5rem auto;">
  <title>Eaves height against ridge height</title>
  <desc>Two defensible answers to the question a level-one solid has to settle, and what each is right for. The eaves height understates volume and is what a facade or daylight study wants; the ridge height overstates footprint volume and is what a visibility or obstruction study wants. On a pitched roof they differ by metres, so the number is meaningless without the definition attached.</desc>
  <defs>
    <marker id="l12-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="l12-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="558" height="194.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="244" height="130" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="122" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Eaves height</text>
  <line x1="14" y1="33" x2="230" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="16" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— top of the wall plane</text>
  <text x="16" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— understates volume</text>
  <text x="16" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— suits daylight and facade work</text>
  <text x="16" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— closer to the occupied envelope</text>
  <rect x="274" y="0" width="244" height="130" rx="6" fill="currentColor" fill-opacity="0.11" stroke="currentColor" stroke-width="1.9"/>
  <text x="396" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Ridge height</text>
  <line x1="288" y1="33" x2="504" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="290" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— highest point of the roof</text>
  <text x="290" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— overstates volume</text>
  <text x="290" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— suits visibility and obstruction</text>
  <text x="290" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— what a planner usually means</text>
  <text x="259" y="152" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">Record which definition was applied — a height without it is not a measurement.</text>
</svg>
<!-- /fig:lod1-height-choice -->

**Key implementation notes:**

- `USE_WORLD_COORDS` composes the placement chain in the kernel. Without it every element mesh arrives in its own local frame and the union merges walls that are nowhere near each other.
- Degenerate projections are dropped before the union. Vertical faces project to zero-area slivers, and unioning those is both slow and a source of invalid results.
- Selecting the largest polygon from a multi-part union takes the principal mass. Where outbuildings should be separate city objects, split rather than select — but do it deliberately.
- `orient(..., sign=1.0)` normalises the exterior ring to counter-clockwise so the side faces come out consistently. Skipping this is the usual cause of a solid that fails validation.
- `height_definition` travels with the object. A height without its definition is not a measurement.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `ifcopenshell` | `>=0.7.0` | `USE_WORLD_COORDS` and `create_shape` stable |
| IFC schema | IFC2X3, IFC4, IFC4X3 | envelope class names differ slightly across releases |
| `shapely` | `>=2.0` | `unary_union`, `orient` |
| CityGML target | 1.0, 2.0, 3.0 | `lod1Solid` present in all three |
| Coordinate system | projected | LoD1 extrusion assumes a metric vertical axis |

## Fallback Strategies

**1. The union produces several disjoint parts.** A site with detached structures modelled as one building. Decide whether they are separate city objects — usually they are — and emit one per part rather than silently taking the largest.

<!-- fig:lod1-footprint -->
<svg viewBox="-48 -8 471.2 268.1" role="img" aria-label="The unioned projection of the envelope elements forms the base of the LoD1 prism" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:471px;display:block;margin:1.5rem auto;">
  <title>The projected footprint that becomes the prism base</title>
  <desc>The outline produced by projecting the envelope elements of an L-shaped building and unioning the result. It is the base of the extruded prism and the only horizontal information a level-one solid carries. Where the union produces several disjoint parts, each is normally a separate city object rather than a fragment to discard.</desc>
  <defs>
    <marker id="l13-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="l13-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-48" y="-8" width="471.2" height="268.1" fill="var(--color-surface)"/>
  <rect x="34" y="12" width="290" height="184" rx="4" fill="none" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="34" y1="196" x2="324" y2="196" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <line x1="34" y1="12" x2="34" y2="196" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <text x="179" y="218" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.7">Easting (m, local)</text>
  <text x="26" y="104" text-anchor="end" font-size="9.5" fill="currentColor" fill-opacity="0.7">Northing (m)</text>
  <polyline points="34,196 324,196 324,94.8 205.4,94.8 205.4,16 34,16 34,196" fill="none" stroke="currentColor" stroke-width="2" stroke-opacity="0.95"/>
  <circle cx="34" cy="196" r="3.4" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="324" cy="196" r="3.4" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="324" cy="94.8" r="3.4" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="205.4" cy="94.8" r="3.4" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="205.4" cy="16" r="3.4" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="34" cy="16" r="3.4" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="34" cy="196" r="3.4" fill="currentColor" fill-opacity="0.95"/>
  <text x="198.4" y="84.8" text-anchor="end" font-size="9.5" fill="currentColor" fill-opacity="0.85">footprint</text>
  <text x="34" y="238" font-size="9.5" fill="currentColor" fill-opacity="0.7">Ring winding is normalised before extrusion, or the side faces come out inconsistent.</text>
</svg>
<!-- /fig:lod1-footprint -->

**2. Height comes out absurd.** A model containing a site or terrain element inside the envelope class list drags `zmin` down to ground level several metres below the building base. Restrict the class list, or compute the base from the lowest slab rather than from all geometry.

**3. Elements with no geometry.** Counted and skipped in the loop above, but a building where most elements skip produces a footprint that is a fragment. Assert a minimum yield ratio before accepting the result, as described in the parent section on [Python Parsing & Geometry Extraction](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/).

**4. The model is not georeferenced.** The resulting city object sits at model coordinates near the origin. Resolve the georeferencing first; a CityGML file with no meaningful coordinates is not usable as a city model.

**5. Curved facades.** The projection produces a many-vertex ring that is faithful and unwieldy. Simplify to a tolerance appropriate to LoD1 — decimetres, not millimetres — before extruding, and record the tolerance applied.

## FAQ

<details>
<summary><strong>Which height should LoD1 use?</strong></summary>

Whichever your consumer expects, stated explicitly. The common choices are the eaves height and the maximum roof height, and they differ by metres on a pitched roof. CityGML has an attribute for measured height, so record which definition was applied rather than leaving the number unqualified — a shadow study and a volume calculation want different answers.

</details>

<details>
<summary><strong>Do I need the whole IFC model to produce LoD1?</strong></summary>

No, and evaluating all of it is the slow way. The envelope elements — external walls, roofs, slabs — determine the footprint and height. Filtering to those classes before compiling geometry typically cuts the work by an order of magnitude on a detailed model.

</details>

<details>
<summary><strong>Why does my extruded solid fail validation?</strong></summary>

Usually ring orientation. A prismatic solid needs consistently outward-facing surfaces, and a footprint ring taken straight from a union may be clockwise or counter-clockwise depending on the geometry it came from. Normalise the ring winding before building the side faces, and orient the top and bottom caps to match.

</details>

---

## Related Pages

- [CityGML and GML Interchange](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/) — parent reference on the level-of-detail model and GML geometry
- [Parsing CityGML with lxml and Shapely](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/parsing-citygml-with-lxml-and-shapely/) — the reading counterpart to this writing guide
- [Extracting IFC Wall Geometries to Shapely](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/extracting-ifc-wall-geometries-to-shapely/) — the footprint extraction this conversion builds on
