---
title: "CityGML and GML Interchange"
description: "Parse and produce CityGML and GML in Python: the level-of-detail model, namespaced geometry primitives with lxml, and mapping an IFC building into a city model."
slug: "citygml-and-gml-interchange"
breadcrumb:
  - label: "Core Format Fundamentals & Schema Mapping"
    url: "/core-format-fundamentals-schema-mapping/"
  - label: "CityGML and GML Interchange"
    url: "/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "CityGML and GML Interchange",
      "description": "Parse and produce CityGML and GML in Python: the level-of-detail model, namespaced geometry primitives with lxml, and mapping an IFC building into a city model.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Core Format Fundamentals & Schema Mapping", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/"},
        {"@type": "ListItem", "position": 2, "name": "CityGML and GML Interchange", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Read and write CityGML in a Python interoperability pipeline",
      "description": "Establish the CityGML version and level of detail, parse namespaced GML geometry, map it into a Shapely representation, and write features back out with stable identifiers.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Establish version and level of detail", "text": "Read the root element namespace to determine whether the file is CityGML 1.0, 2.0 or 3.0, and inspect which LoD geometry properties are populated."},
        {"@type": "HowToStep", "position": 2, "name": "Parse with namespace-aware XPath", "text": "Use lxml with an explicit namespace map, because every CityGML element is namespaced and an unqualified XPath matches nothing."},
        {"@type": "HowToStep", "position": 3, "name": "Decode GML geometry primitives", "text": "Convert posList and pos coordinate strings into coordinate tuples, honouring srsDimension and the axis order the declared srsName implies."},
        {"@type": "HowToStep", "position": 4, "name": "Map surfaces to Shapely polygons", "text": "Assemble exterior and interior LinearRings into polygons, and drop the vertical faces when a footprint rather than a solid is required."},
        {"@type": "HowToStep", "position": 5, "name": "Write features with stable identifiers", "text": "Emit city objects carrying a gml:id derived from the source identifier so the output can be re-matched against the model it came from."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How is CityGML different from IFC?",
          "acceptedAnswer": {"@type": "Answer", "text": "They model different things at different scales. IFC describes how a building is put together — components, assemblies, systems and their relationships — for design and construction. CityGML describes how objects sit in a city, with generalised geometry at a declared level of detail and thematic classification for analysis. Converting IFC to CityGML is a deliberate generalisation, not a translation: most of the assembly detail has no destination."}
        },
        {
          "@type": "Question",
          "name": "What does the level of detail actually control?",
          "acceptedAnswer": {"@type": "Answer", "text": "It declares how much geometric generalisation the geometry has undergone. LoD0 is a footprint or a roof-edge polygon; LoD1 is a prismatic block extruded to a single height; LoD2 adds a differentiated roof shape and outer installations; LoD3 adds openings such as windows and doors; LoD4 adds interior structure. It is a statement about the source data, so a pipeline that extrudes a footprint to a height should declare LoD1 even if the source model was far more detailed."}
        },
        {
          "@type": "Question",
          "name": "Why does my XPath find nothing in a CityGML file?",
          "acceptedAnswer": {"@type": "Answer", "text": "Because every element is namespaced and an unqualified XPath does not match a namespaced element. Build an explicit namespace map and qualify every step of the path. The namespace URIs also differ between CityGML versions, so a map hard-coded for 2.0 finds nothing in a 3.0 file — read the root element and select the map from it."}
        },
        {
          "@type": "Question",
          "name": "Does GML use latitude-longitude or easting-northing order?",
          "acceptedAnswer": {"@type": "Answer", "text": "It follows the axis order of the coordinate reference system named in the srsName attribute, which for a geographic CRS such as EPSG:4326 is latitude then longitude. That is the opposite of what Shapely, GeoJSON and most geometry code expect, so coordinates read from a GML posList must be swapped when the declared CRS is geographic. A projected CRS is easting then northing and needs no swap."}
        },
        {
          "@type": "Question",
          "name": "Can I round-trip CityGML through my pipeline without loss?",
          "acceptedAnswer": {"@type": "Answer", "text": "Only if you carry the thematic attributes and identifiers alongside the geometry. The gml:id of each city object and the values of its thematic attributes are what let an output be matched back to its source; drop them and the round trip produces geometrically similar features that cannot be reconciled with anything. Treat identifiers as part of the geometry record, not as metadata."}
        }
      ]
    }
  ]
}
</script>

# CityGML and GML Interchange

CityGML is the open standard for representing objects in a city — buildings, terrain, transport, vegetation — as thematically classified features with geometry at a declared level of generalisation, and reading or producing it in Python is where a building model becomes a city object. It belongs to the [Core Format Fundamentals & Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/) section because everything difficult about it is a schema question rather than a geometry one.

The difficulty is not parsing XML. It is that CityGML asks a question the source data usually cannot answer: at what level of detail is this geometry, and what is this object *thematically*? A design model knows it contains a wall; it does not know whether the wall is part of a building whose LoD2 envelope should include it. Getting that mapping wrong produces a file that validates against the schema and is useless for analysis, which is the worst of both outcomes.

## Prerequisites

- **Python 3.9+**.
- **`lxml>=4.9`** — the parser used throughout, for its XPath and namespace support. The standard library's `ElementTree` can read these files but its XPath subset makes real CityGML traversal painful.
- **`shapely>=2.0`** for the geometry representation on the Python side.
- **`pyproj>=3.5`** where the source and target coordinate reference systems differ.
- Familiarity with XML namespaces. Every element in a CityGML document is namespaced, and this is the single most common reason a first attempt returns nothing.

{% raw %}
```bash
# lxml>=4.9  shapely>=2.0  pyproj>=3.5
pip install "lxml>=4.9" "shapely>=2.0" "pyproj>=3.5"
```
{% endraw %}

## Architectural Overview

A CityGML document is a GML feature collection. GML supplies the geometry primitives and the feature machinery; CityGML supplies the thematic modules — Building, Transportation, Vegetation, Relief and others — that classify what those geometries represent.

<!-- fig:cg-lod-ladder -->
<svg viewBox="-20 -20 580 254" role="img" aria-label="CityGML LoD0 to LoD3 and what each level claims about how generalised the geometry is" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:580px;display:block;margin:1.5rem auto;">
  <title>What each level of detail claims about the geometry</title>
  <desc>The CityGML levels of detail as claims about generalisation. Level zero is a footprint, level one a prism extruded to a single height, level two adds a differentiated roof and outer installations, level three adds openings. The level is a statement about the data, so a footprint extruded to a height should declare level one however detailed the source model was.</desc>
  <defs>
    <marker id="cg1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="cg1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="580" height="254" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="540" height="46" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="16" y="21" font-size="11.5" font-weight="600" fill="currentColor">LoD3</text>
  <text x="16" y="35" font-size="9.5" fill="currentColor" fill-opacity="0.72">openings — windows and doors</text>
  <text x="524" y="26.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">façade detail</text>
  <rect x="0" y="56" width="540" height="46" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="16" y="77" font-size="11.5" font-weight="600" fill="currentColor">LoD2</text>
  <text x="16" y="91" font-size="9.5" fill="currentColor" fill-opacity="0.72">differentiated roof and outer installations</text>
  <text x="524" y="82.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">roof shape</text>
  <rect x="0" y="112" width="540" height="46" rx="6" fill="currentColor" fill-opacity="0.14" stroke="currentColor" stroke-width="2"/>
  <text x="16" y="133" font-size="11.5" font-weight="600" fill="currentColor">LoD1</text>
  <text x="16" y="147" font-size="9.5" fill="currentColor" fill-opacity="0.72">prism extruded to one height</text>
  <text x="524" y="138.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">block</text>
  <rect x="0" y="168" width="540" height="46" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="16" y="189" font-size="11.5" font-weight="600" fill="currentColor">LoD0</text>
  <text x="16" y="203" font-size="9.5" fill="currentColor" fill-opacity="0.72">footprint or roof-edge polygon</text>
  <text x="524" y="194.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">2D</text>
</svg>
<!-- /fig:cg-lod-ladder -->

Three properties of that structure govern how it is parsed.

**Everything is namespaced, and the namespaces are version-specific.** The CityGML core, the Building module and GML itself each have their own URI, and those URIs change between CityGML 1.0, 2.0 and 3.0. A namespace map is therefore not boilerplate; it is version detection.

| CityGML version | Core namespace | Notable change |
|---|---|---|
| 1.0 | `.../citygml/1.0` | original release |
| 2.0 | `.../citygml/2.0` | tunnel and bridge modules |
| 3.0 | `.../citygml/3.0` | space concept; LoD4 replaced by interior spaces |

**Geometry is expressed as GML primitives, not as coordinate arrays.** A surface is a `gml:Polygon` whose exterior is a `gml:LinearRing` whose points arrive as a whitespace-separated `gml:posList`, with an `srsDimension` attribute saying whether the values come in twos or threes. There is no shortcut to a coordinate list; the nesting is the format.

**The level of detail is declared per geometry property, not per file.** A single building can carry an LoD0 footprint and an LoD2 solid simultaneously, in different properties. A parser that takes the first geometry it finds is picking a generalisation level at random.

The mapping into a Python pipeline therefore has three jobs: select a namespace map from the file's version, walk from city objects down to the geometry property at the level of detail you want, and decode the coordinate strings into something Shapely can hold.

## Step-by-Step Implementation

### 1. Detect the version and build the namespace map

<!-- fig:cg-nesting -->
<svg viewBox="-20 -33.5 505.3 101.7" role="img" aria-label="Building, LoD property, polygon, linear ring, posList — the nesting a CityGML parser has to walk" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:505px;display:block;margin:1.5rem auto;">
  <title>The nesting between a city object and a coordinate list</title>
  <desc>Four levels of nesting separate a city object from the numbers a parser wants. The building carries a level-of-detail geometry property, which holds a surface, whose exterior is a linear ring, whose points arrive as a whitespace-separated coordinate list with a declared dimension. There is no shortcut through this — the nesting is the format.</desc>
  <defs>
    <marker id="cg2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="cg2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-33.5" width="505.3" height="101.7" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="84.2" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="42.1" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Building</text>
  <text x="42.1" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">a city object</text>
  <rect x="118.2" y="0" width="72.8" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="154.6" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Polygon</text>
  <text x="154.6" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">a surface</text>
  <rect x="225" y="0" width="88.8" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="269.4" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">LinearRing</text>
  <text x="269.4" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">a boundary</text>
  <rect x="347.8" y="0" width="117.6" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="406.6" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Coordinates</text>
  <text x="406.6" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">srsDimension apart</text>
  <line x1="84.2" y1="24.1" x2="118.2" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#cg2-a)"/>
  <text x="101.2" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">lod2Solid</text>
  <line x1="191" y1="24.1" x2="225" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#cg2-a)"/>
  <text x="208" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">exterior</text>
  <line x1="313.8" y1="24.1" x2="347.8" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#cg2-a)"/>
  <text x="330.8" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">posList</text>
</svg>
<!-- /fig:cg-nesting -->

{% raw %}
```python
# lxml>=4.9
from lxml import etree

GML = "http://www.opengis.net/gml"

NS_BY_VERSION = {
    "http://www.opengis.net/citygml/2.0": {
        "core": "http://www.opengis.net/citygml/2.0",
        "bldg": "http://www.opengis.net/citygml/building/2.0",
        "gml": GML,
    },
    "http://www.opengis.net/citygml/1.0": {
        "core": "http://www.opengis.net/citygml/1.0",
        "bldg": "http://www.opengis.net/citygml/building/1.0",
        "gml": GML,
    },
}

def open_citygml(path: str):
    tree = etree.parse(path)
    root = tree.getroot()
    uri = etree.QName(root).namespace
    ns = NS_BY_VERSION.get(uri)
    if ns is None:
        raise ValueError(f"unmapped CityGML namespace {uri!r} — refusing to guess")
    return tree, ns
```
{% endraw %}

Refusing an unknown namespace rather than falling back is deliberate. A fallback map produces a parse that finds no buildings, which reads exactly like an empty file.

### 2. Walk from city objects to the level of detail you want

{% raw %}
```python
# lxml>=4.9
LOD_PROPERTIES = ["lod2Solid", "lod2MultiSurface", "lod1Solid", "lod0FootPrint"]

def buildings(tree, ns):
    return tree.findall(".//bldg:Building", namespaces=ns)

def preferred_geometry(building, ns):
    """Return (lod_name, element) for the most detailed geometry present."""
    for prop in LOD_PROPERTIES:
        found = building.find(f"bldg:{prop}", namespaces=ns)
        if found is not None:
            return prop, found
    return None, None
```
{% endraw %}

The order of `LOD_PROPERTIES` is a policy decision and belongs in configuration, not in a parser. A visualisation pipeline wants the most detailed geometry available; a footprint pipeline wants LoD0 even when LoD2 exists, because extracting a footprint from a solid is work it does not need to do.

### 3. Decode GML coordinate strings

{% raw %}
```python
# lxml>=4.9, shapely>=2.0
from shapely.geometry import Polygon

def ring_coords(ring_el, ns):
    """A gml:LinearRing -> a list of (x, y) tuples."""
    pos_list = ring_el.find(".//gml:posList", namespaces=ns)
    if pos_list is None:
        raise ValueError("LinearRing without a posList")
    dim = int(pos_list.get("srsDimension", "3"))
    values = [float(v) for v in pos_list.text.split()]
    if len(values) % dim:
        raise ValueError(f"posList length {len(values)} is not a multiple of {dim}")
    pts = [tuple(values[i:i + dim]) for i in range(0, len(values), dim)]
    return [(p[0], p[1]) for p in pts]          # drop Z for a planar footprint

def polygon_from_surface(surface_el, ns) -> Polygon:
    exterior = surface_el.find(".//gml:exterior//gml:LinearRing", namespaces=ns)
    interiors = surface_el.findall(".//gml:interior//gml:LinearRing", namespaces=ns)
    return Polygon(ring_coords(exterior, ns),
                   [ring_coords(i, ns) for i in interiors])
```
{% endraw %}

### 4. Handle axis order before anything else touches the coordinates

The `srsName` attribute names the coordinate reference system, and GML follows that system's declared axis order. For a geographic CRS that is latitude then longitude — the reverse of what `Polygon` above assumes.

{% raw %}
```python
# pyproj>=3.5
from pyproj import CRS

def needs_axis_swap(srs_name: str) -> bool:
    """True when the declared CRS puts latitude/northing first."""
    crs = CRS.from_user_input(srs_name)
    first = crs.axis_info[0].abbrev.lower()
    return first in {"lat", "n"}
```
{% endraw %}

Read `srsName` from the outermost element that declares it and apply the decision once, rather than testing per ring.

### 5. Preserve identity on the way out

{% raw %}
```python
# lxml>=4.9
def city_object_id(el, ns) -> str:
    gml_id = el.get(f"{{{ns['gml']}}}id")
    if not gml_id:
        raise ValueError("city object without a gml:id — output cannot be reconciled")
    return gml_id
```
{% endraw %}

An output whose features cannot be matched back to their source is a dead end: a discrepancy found later cannot be attributed to an object. Treat the identifier as required rather than optional, and carry it into whatever the pipeline writes.

## Edge Cases and Gotchas

**Unqualified XPath matches nothing.** The most common first failure. `.//Building` finds no elements in a namespaced document; `.//bldg:Building` with a namespace map finds them all. The symptom is an empty result rather than an error, which sends people looking at the file instead of the query.

<!-- fig:cg-two-traps -->
<svg viewBox="-20 -20 438.4 214.1" role="img" aria-label="Unqualified XPath and a wrong-version namespace map both return an empty parse rather than an error" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:438px;display:block;margin:1.5rem auto;">
  <title>The two failures that produce an empty parse</title>
  <desc>Two mistakes that return nothing rather than raising, what each looks like, and how to tell them apart. An unqualified XPath finds no elements because every element is namespaced; a namespace map for the wrong CityGML release finds none for the same reason. Both present as an empty result, which sends people to inspect the file rather than the query.</desc>
  <defs>
    <marker id="cg3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="cg3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="438.4" height="214.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="398.4" height="152" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="398.4" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">Mistake</text>
  <text x="193.4" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Symptom</text>
  <line x1="250.6" y1="0" x2="250.6" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="324.5" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">How to tell</text>
  <line x1="136.2" y1="0" x2="136.2" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="398.4" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">Unqualified XPath</text>
  <text x="193.4" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">no elements found</text>
  <text x="324.5" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">the path has no prefix</text>
  <line x1="0" y1="62" x2="398.4" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">Wrong version map</text>
  <text x="193.4" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">no elements found</text>
  <text x="324.5" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">root namespace ≠ map key</text>
  <line x1="0" y1="92" x2="398.4" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">Wrong srsDimension</text>
  <text x="193.4" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">garbled coordinates</text>
  <text x="324.5" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">implausible ring area</text>
  <line x1="0" y1="122" x2="398.4" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="140.5" font-size="10.5" font-weight="600" fill="currentColor">Unswapped axis order</text>
  <text x="193.4" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">wrong hemisphere</text>
  <text x="324.5" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">srsName is geographic</text>
  <text x="0" y="172" font-size="9.5" fill="currentColor" fill-opacity="0.7">Only the last two produce visible geometry — the first two look like an empty file.</text>
</svg>
<!-- /fig:cg-two-traps -->

**`srsDimension` is not always three.** A `posList` may be two-dimensional, and a parser that hard-codes a stride of three reads coordinates that are interleaved nonsense — still numeric, still parseable, geometrically meaningless. Read the attribute.

**Solids include vertical faces.** Projecting an LoD2 solid to a footprint by dropping Z produces the wall faces as degenerate zero-area polygons alongside the roof and floor. Filter degenerate results before the union, exactly as when [extracting IFC wall geometries to Shapely](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/extracting-ifc-wall-geometries-to-shapely/).

**Ring orientation is not guaranteed.** CityGML surfaces carry an orientation through their boundary composition rather than through winding, so rings arrive in either direction. Normalise winding before treating a ring as a polygon boundary, or hole detection becomes unreliable.

**Generic attributes hide in a separate module.** Thematic attributes defined by a producer rather than by the standard live in `gen:stringAttribute` and its siblings, not as elements on the feature. A pipeline reading only the standard attributes silently drops everything the producer added — which, in practice, is usually the part the client cares about.

**CityGML 3.0 restructures level of detail.** LoD4 no longer exists; interior structure is modelled through spaces instead. Code written against 2.0's LoD4 property finds nothing in a 3.0 file and reports the building as having no interior.

## Validation and Testing

The assertions worth writing are about identity and generalisation, because geometry errors in this format tend to be visible and schema errors do not.

{% raw %}
```python
# pytest, lxml>=4.9, shapely>=2.0
def test_every_building_has_an_id_and_geometry(citygml_path):
    tree, ns = open_citygml(citygml_path)
    bs = buildings(tree, ns)
    assert bs, "no buildings parsed — check the namespace map"
    for b in bs:
        assert city_object_id(b, ns)
        lod, geom = preferred_geometry(b, ns)
        assert geom is not None, f"{city_object_id(b, ns)} has no geometry at any LoD"

def test_footprints_are_valid_and_plausible(citygml_path):
    tree, ns = open_citygml(citygml_path)
    for b in buildings(tree, ns):
        _, geom_el = preferred_geometry(b, ns)
        for surface in geom_el.findall(".//gml:Polygon", namespaces=ns):
            poly = polygon_from_surface(surface, ns)
            assert poly.is_valid, city_object_id(b, ns)
            assert 1.0 < poly.area < 1e6, "implausible footprint area"
```
{% endraw %}

The area bound is doing real work: it catches an axis swap, an unapplied unit and a coordinate stride error at once, because all three produce areas that are absurd rather than merely wrong.

## Performance and Scale

City-scale CityGML files reach hundreds of megabytes, and a full DOM parse of one holds the entire tree in memory at several times the file size. For anything beyond a district, parse incrementally and release each feature as it is consumed:

{% raw %}
```python
# lxml>=4.9
def iter_buildings(path: str, bldg_ns: str):
    context = etree.iterparse(path, events=("end",), tag=f"{{{bldg_ns}}}Building")
    for _, element in context:
        yield element
        element.clear()                       # release this subtree
        while element.getprevious() is not None:
            del element.getparent()[0]        # release the already-processed siblings
```
{% endraw %}

The sibling deletion is the part that is easy to omit and the part that matters: without it the parent accumulates every element already processed, and memory grows exactly as it would have with a full parse.

Beyond parsing, the expensive stage is geometry assembly rather than XML traversal — polygon construction and union dominate once features are in Shapely. Where only footprints are needed, prefer the LoD0 property when it exists rather than projecting a solid, and where the whole city is being processed, partition by tile and process tiles in separate processes; the work is embarrassingly parallel because city objects are independent.

## FAQ

<details>
<summary><strong>How is CityGML different from IFC?</strong></summary>

They model different things at different scales. IFC describes how a building is put together — components, assemblies, systems and their relationships — for design and construction. CityGML describes how objects sit in a city, with generalised geometry at a declared level of detail and thematic classification for analysis. Converting IFC to CityGML is a deliberate generalisation, not a translation: most of the assembly detail has no destination.

</details>

<details>
<summary><strong>What does the level of detail actually control?</strong></summary>

It declares how much geometric generalisation the geometry has undergone. LoD0 is a footprint or a roof-edge polygon; LoD1 is a prismatic block extruded to a single height; LoD2 adds a differentiated roof shape and outer installations; LoD3 adds openings such as windows and doors; LoD4 adds interior structure. It is a statement about the source data, so a pipeline that extrudes a footprint to a height should declare LoD1 even if the source model was far more detailed.

</details>

<details>
<summary><strong>Why does my XPath find nothing in a CityGML file?</strong></summary>

Because every element is namespaced and an unqualified XPath does not match a namespaced element. Build an explicit namespace map and qualify every step of the path. The namespace URIs also differ between CityGML versions, so a map hard-coded for 2.0 finds nothing in a 3.0 file — read the root element and select the map from it.

</details>

<details>
<summary><strong>Does GML use latitude-longitude or easting-northing order?</strong></summary>

It follows the axis order of the coordinate reference system named in the srsName attribute, which for a geographic CRS such as EPSG:4326 is latitude then longitude. That is the opposite of what Shapely, GeoJSON and most geometry code expect, so coordinates read from a GML posList must be swapped when the declared CRS is geographic. A projected CRS is easting then northing and needs no swap.

</details>

<details>
<summary><strong>Can I round-trip CityGML through my pipeline without loss?</strong></summary>

Only if you carry the thematic attributes and identifiers alongside the geometry. The gml:id of each city object and the values of its thematic attributes are what let an output be matched back to its source; drop them and the round trip produces geometrically similar features that cannot be reconciled with anything. Treat identifiers as part of the geometry record, not as metadata.

</details>

---

## Related Pages

- [Core Format Fundamentals & Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/) — the parent section on how each format encodes geometry and meaning
- [IFC4x3 Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/) — the building-scale schema a city model generalises from
- [Metadata Extraction Strategies](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/) — the attribute side of the same mapping problem
- [DXF vs IFC for GIS Ingestion](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/dxf-vs-ifc-for-gis-ingestion/) — choosing the interchange representation before this mapping is written
- [GeoPackage vs PostGIS for CAD Output](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/geopackage-vs-postgis-for-cad-output/) — where the parsed city objects are usually stored
