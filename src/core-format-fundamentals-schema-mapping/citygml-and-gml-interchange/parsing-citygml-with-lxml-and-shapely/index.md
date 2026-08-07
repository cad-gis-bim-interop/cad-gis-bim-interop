---
title: "Parsing CityGML with lxml and Shapely"
description: "Read CityGML without loading the whole tree: namespace-aware iterparse, decoding gml:posList, honouring srsDimension and axis order, and building polygons."
slug: "parsing-citygml-with-lxml-and-shapely"
breadcrumb:
  - label: "Core Format Fundamentals & Schema Mapping"
    url: "/core-format-fundamentals-schema-mapping/"
  - label: "CityGML and GML Interchange"
    url: "/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/"
  - label: "Parsing CityGML with lxml and Shapely"
    url: "/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/parsing-citygml-with-lxml-and-shapely/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Parsing CityGML with lxml and Shapely",
      "description": "Read CityGML without loading the whole tree: namespace-aware iterparse, decoding gml:posList, honouring srsDimension and axis order, and building polygons.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/parsing-citygml-with-lxml-and-shapely/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Core Format Fundamentals & Schema Mapping", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/"},
        {"@type": "ListItem", "position": 2, "name": "CityGML and GML Interchange", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/"},
        {"@type": "ListItem", "position": 3, "name": "Parsing CityGML with lxml and Shapely", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/parsing-citygml-with-lxml-and-shapely/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Parse a CityGML file into Shapely geometry",
      "description": "Detect the namespace, iterate features incrementally, decode coordinate lists with the declared dimension, apply the axis order the CRS implies, and build validated polygons.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Detect the namespace from the root", "text": "Read the root element namespace to select the correct version-specific namespace map before any XPath is evaluated."},
        {"@type": "HowToStep", "position": 2, "name": "Iterate features incrementally", "text": "Use iterparse on the feature element and clear each subtree so memory stays proportional to one feature rather than to the file."},
        {"@type": "HowToStep", "position": 3, "name": "Decode posList with srsDimension", "text": "Split the coordinate text and group it by the declared dimension rather than assuming three ordinates per position."},
        {"@type": "HowToStep", "position": 4, "name": "Apply the axis order", "text": "Swap the first two ordinates when the declared coordinate reference system puts latitude or northing first."},
        {"@type": "HowToStep", "position": 5, "name": "Assemble and validate polygons", "text": "Build exterior and interior rings into a polygon and repair it before it enters any downstream operation."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Why does iterparse still run out of memory?",
          "acceptedAnswer": {"@type": "Answer", "text": "Because clearing an element releases its own subtree but not its already-processed siblings, which the parent keeps referencing. Delete the preceding siblings inside the loop as well. Without that one extra step, memory grows exactly as it would with a full DOM parse."}
        },
        {
          "@type": "Question",
          "name": "Do I need to handle gml:coordinates as well as gml:posList?",
          "acceptedAnswer": {"@type": "Answer", "text": "For older files, yes. gml:coordinates is the deprecated form and uses configurable separators — a comma between ordinates and whitespace between tuples, by default. Files produced by older tooling still use it, so a reader intended for real deliveries should handle both and prefer posList where both appear."}
        },
        {
          "@type": "Question",
          "name": "Should I validate every polygon?",
          "acceptedAnswer": {"@type": "Answer", "text": "Yes, at the boundary. Validation is cheap relative to anything you will do with the geometry afterwards, and an invalid ring entering a union or an overlay produces either an exception deep inside an engine or a plausible wrong answer. Repair at the point of parsing, where the feature identifier is still in scope to name in the error."}
        }
      ]
    }
  ]
}
</script>

# Parsing CityGML with lxml and Shapely

To parse CityGML, select a namespace map from the file's root element, iterate features with `iterparse` while clearing processed subtrees, decode each `gml:posList` using its declared `srsDimension`, and assemble the rings into validated Shapely polygons. The two mistakes that account for most first attempts are unqualified XPath, which matches nothing, and a hard-coded coordinate stride, which reads interleaved nonsense. This page sits under [CityGML and GML Interchange](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/).

## How the Format Resists a Naive Read

Three properties of the format shape the parser.

<!-- fig:cgparse-namespaces -->
<svg viewBox="-20 -20 458 137.1" role="img" aria-label="An unqualified XPath and a wrong-version namespace map both return an empty result in CityGML" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:458px;display:block;margin:1.5rem auto;">
  <title>Why an unqualified path matches nothing</title>
  <desc>The same query in three forms. The unqualified path matches no element because every element in the document is namespaced. The qualified path with a namespace map for the document version matches them all. A map for a different CityGML release matches none, and returns the same empty result as the unqualified form.</desc>
  <defs>
    <marker id="cp1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="cp1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="458" height="137.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="221.2" height="73" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.5"/>
  <text x="14" y="16" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">.//Building</text>
  <line x1="227.2" y1="12.9" x2="259.2" y2="12.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="267.2" y="16" font-size="9.5" fill="currentColor" fill-opacity="0.78">matches nothing — no namespace</text>
  <text x="14" y="35" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">.//bldg:Building  +  2.0 map</text>
  <line x1="227.2" y1="31.9" x2="259.2" y2="31.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="267.2" y="35" font-size="9.5" fill="currentColor" fill-opacity="0.78">matches, on a 2.0 document</text>
  <text x="14" y="54" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">.//bldg:Building  +  1.0 map</text>
  <line x1="227.2" y1="50.9" x2="259.2" y2="50.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="267.2" y="54" font-size="9.5" fill="currentColor" fill-opacity="0.78">matches nothing on that document</text>
  <text x="0" y="95" font-size="9.5" fill="currentColor" fill-opacity="0.7">All three return an empty list; only one of them is a query problem you can see.</text>
</svg>
<!-- /fig:cgparse-namespaces -->

**Namespaces are mandatory and version-specific.** Every element belongs to a namespace, and the URIs differ between CityGML 1.0, 2.0 and 3.0. An XPath without a namespace map matches nothing, and a map for the wrong version matches nothing either — in both cases returning an empty result rather than an error, which sends people to inspect the file.

**Coordinates arrive as text with a declared dimension.** A `gml:posList` is whitespace-separated numbers, and the `srsDimension` attribute says whether to group them in twos or threes. Assuming three on a two-dimensional list produces coordinates built from ordinates of successive points: numeric, parseable, meaningless.

**Axis order follows the declared CRS.** GML honours the authority axis order, so a geographic system yields latitude first. Shapely, GeoJSON and every downstream consumer expect the opposite. The swap has to happen once, driven by the declared `srsName`, rather than being applied by feel.

## Production-Ready Script

{% raw %}
```python
# lxml>=4.9, shapely>=2.0, pyproj>=3.5, Python 3.9+
from __future__ import annotations

from dataclasses import dataclass
from lxml import etree
from pyproj import CRS
from shapely.geometry import Polygon
from shapely.validation import make_valid

GML = "http://www.opengis.net/gml"
NS_BY_CORE = {
    "http://www.opengis.net/citygml/2.0": {"bldg": "http://www.opengis.net/citygml/building/2.0"},
    "http://www.opengis.net/citygml/1.0": {"bldg": "http://www.opengis.net/citygml/building/1.0"},
}


@dataclass(frozen=True)
class CityFeature:
    gml_id: str
    polygons: list[Polygon]


def namespaces(path: str) -> dict:
    """Version detection: read only the root element."""
    for _, root in etree.iterparse(path, events=("start",)):
        uri = etree.QName(root).namespace
        ns = NS_BY_CORE.get(uri)
        if ns is None:
            raise ValueError(f"unmapped CityGML namespace {uri!r}")
        return {**ns, "gml": GML}
    raise ValueError("empty document")


def axis_swap_needed(srs_name: str | None) -> bool:
    if not srs_name:
        return False
    first = CRS.from_user_input(srs_name).axis_info[0].abbrev.lower()
    return first in {"lat", "n"}


def decode_pos_list(el, swap: bool) -> list[tuple[float, float]]:
    dim = int(el.get("srsDimension", "3"))
    vals = [float(v) for v in (el.text or "").split()]
    if not vals or len(vals) % dim:
        raise ValueError(f"posList of {len(vals)} values is not a multiple of {dim}")
    pts = [(vals[i], vals[i + 1]) for i in range(0, len(vals), dim)]
    return [(y, x) for x, y in pts] if swap else pts


def polygons_of(element, ns: dict, swap: bool) -> list[Polygon]:
    out = []
    for poly_el in element.findall(f".//{{{GML}}}Polygon"):
        ext = poly_el.find(f".//{{{GML}}}exterior//{{{GML}}}posList")
        if ext is None:
            continue
        holes = [decode_pos_list(h, swap) for h in
                 poly_el.findall(f".//{{{GML}}}interior//{{{GML}}}posList")]
        poly = Polygon(decode_pos_list(ext, swap), holes)
        if not poly.is_valid:
            poly = make_valid(poly)
        if not poly.is_empty:
            out.append(poly)
    return out


def iter_buildings(path: str):
    """Incremental, namespace-aware, memory-bounded."""
    ns = namespaces(path)
    swap = None
    tag = f"{{{ns['bldg']}}}Building"
    for _, el in etree.iterparse(path, events=("end",), tag=tag):
        if swap is None:
            srs = el.get("srsName") or _inherited_srs(el)
            swap = axis_swap_needed(srs)
        gml_id = el.get(f"{{{GML}}}id")
        if not gml_id:
            raise ValueError("city object without a gml:id — output cannot be reconciled")
        yield CityFeature(gml_id, polygons_of(el, ns, swap))
        el.clear()
        while el.getprevious() is not None:
            del el.getparent()[0]              # release processed siblings


def _inherited_srs(el) -> str | None:
    node = el
    while node is not None:
        srs = node.get("srsName")
        if srs:
            return srs
        node = node.getparent()
    return None


if __name__ == "__main__":
    for feature in iter_buildings("city.gml"):
        total = sum(p.area for p in feature.polygons)
        print(f"{feature.gml_id}: {len(feature.polygons)} surface(s), {total:.1f} m2")
```
{% endraw %}

<!-- fig:cgparse-iterparse -->
<svg viewBox="-20 -20 586 194.1" role="img" aria-label="Clearing an element during iterparse is not enough; the processed siblings must be deleted from the parent too" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:586px;display:block;margin:1.5rem auto;">
  <title>Why clearing an element is not enough</title>
  <desc>Two incremental-parse loops. Clearing each element releases its own subtree but leaves it attached to its parent, which therefore accumulates every feature already processed — so memory grows exactly as it would with a full parse. Deleting the preceding siblings as well releases them, and peak memory becomes one feature rather than the document.</desc>
  <defs>
    <marker id="cp2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="cp2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="586" height="194.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="258" height="130" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4" stroke-dasharray="5 4"/>
  <text x="129" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">element.clear() only</text>
  <line x1="14" y1="33" x2="244" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="16" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— own subtree released</text>
  <text x="16" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— parent still holds every sibling</text>
  <text x="16" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— memory grows with the file</text>
  <text x="16" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— looks like iterparse is broken</text>
  <rect x="288" y="0" width="258" height="130" rx="6" fill="currentColor" fill-opacity="0.11" stroke="currentColor" stroke-width="1.9"/>
  <text x="417" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">clear() + delete siblings</text>
  <line x1="302" y1="33" x2="532" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="304" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— own subtree released</text>
  <text x="304" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— processed siblings released</text>
  <text x="304" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— peak memory is one feature</text>
  <text x="304" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— the intended behaviour</text>
  <text x="273" y="152" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">The extra two lines are the difference between bounded and unbounded.</text>
</svg>
<!-- /fig:cgparse-iterparse -->

**Key implementation notes:**

- The sibling deletion inside `iter_buildings` is what makes `iterparse` bounded. Clearing the element alone is not enough — the parent keeps every processed sibling alive.
- `srsName` is looked up on the feature and then inherited from ancestors, because it is normally declared once on an enclosing envelope rather than per feature.
- The axis decision is made once and reused. Testing per ring would be correct and would spend the whole parse in `pyproj`.
- Missing `gml:id` raises. A feature that cannot be reconciled with its source is not usable output, however good its geometry.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `lxml` | `>=4.9` | `iterparse` with a tag filter |
| CityGML | 1.0, 2.0 as mapped | add the 3.0 URIs to `NS_BY_CORE` to extend |
| `shapely` | `>=2.0` | `make_valid` |
| `pyproj` | `>=3.5` | axis order introspection |
| Coordinate encoding | `gml:posList` | `gml:coordinates` needs the deprecated-form branch |

## Fallback Strategies

**1. No features found.** Almost always the namespace map. Print the root namespace and compare it against `NS_BY_CORE`; a 3.0 file against a 2.0 map yields exactly this symptom.

<!-- fig:cgparse-axis -->
<svg viewBox="-20 -20 277.1 216.2" role="img" aria-label="Swap the first two ordinates when the declared CRS is geographic; a projected CRS needs no swap" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>Deciding the axis swap from the declared system</title>
  <desc>A branch on what the coordinate reference system named in the document declares. A geographic system puts latitude first, which is the reverse of what geometry libraries expect, so the first two ordinates are swapped. A projected system is easting then northing and needs none. Deciding by inspection instead breaks whichever case currently looks right.</desc>
  <defs>
    <marker id="cp3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="cp3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="277.1" height="216.2" fill="var(--color-surface)"/>
  <polygon points="118.5,0 223.3,31 118.5,62 13.8,31" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-width="1.6"/>
  <text x="118.5" y="35" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">What does srsName declare?</text>
  <rect x="0" y="128" width="104.5" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="52.3" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Swap</text>
  <text x="52.3" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">lat, lon → x, y</text>
  <path d="M 118.5 62 L 118.5 92 L 52.3 92 L 52.3 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#cp3-a)" stroke-linejoin="round"/>
  <text x="52.3" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">geographic</text>
  <rect x="132.5" y="128" width="104.5" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="184.8" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">No swap</text>
  <text x="184.8" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">easting, northing</text>
  <path d="M 118.5 62 L 118.5 92 L 184.8 92 L 184.8 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#cp3-a)" stroke-linejoin="round"/>
  <text x="184.8" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">projected</text>
</svg>
<!-- /fig:cgparse-axis -->

**2. Coordinates in the wrong hemisphere.** Axis order. Confirm what `srsName` declares rather than swapping until the map looks right, because a swap applied to a projected system breaks a file that was previously correct.

**3. `srsDimension` absent.** The default in the code above is three, which matches most CityGML. Where a producer omits the attribute on two-dimensional data, the stride is wrong for the whole file — assert that the resulting coordinate count is plausible for the feature.

**4. Deprecated `gml:coordinates`.** Older exports use it, with a comma between ordinates. Add a branch that splits on the declared separators; the rest of the pipeline is unchanged.

**5. Enormous single features.** A terrain surface can be one feature with millions of vertices, and `iterparse` bounds memory per feature rather than within one. Where a single feature does not fit, the file needs tiling before parsing rather than a better parser.

## FAQ

<details>
<summary><strong>Why does iterparse still run out of memory?</strong></summary>

Because clearing an element releases its own subtree but not its already-processed siblings, which the parent keeps referencing. Delete the preceding siblings inside the loop as well. Without that one extra step, memory grows exactly as it would with a full DOM parse.

</details>

<details>
<summary><strong>Do I need to handle gml:coordinates as well as gml:posList?</strong></summary>

For older files, yes. `gml:coordinates` is the deprecated form and uses configurable separators — a comma between ordinates and whitespace between tuples, by default. Files produced by older tooling still use it, so a reader intended for real deliveries should handle both and prefer `posList` where both appear.

</details>

<details>
<summary><strong>Should I validate every polygon?</strong></summary>

Yes, at the boundary. Validation is cheap relative to anything you will do with the geometry afterwards, and an invalid ring entering a union or an overlay produces either an exception deep inside an engine or a plausible wrong answer. Repair at the point of parsing, where the feature identifier is still in scope to name in the error.

</details>

---

## Related Pages

- [CityGML and GML Interchange](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/) — parent reference on levels of detail and the GML geometry model
- [Converting IFC Buildings to CityGML LoD1 with Python](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/converting-ifc-buildings-to-citygml-lod1-with-python/) — the writing counterpart to this reading guide
- [Mapping GML Geometry to PostGIS with OGR](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/mapping-gml-geometry-to-postgis-with-ogr/) — where the parsed features usually go next
