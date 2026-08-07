---
title: "Computing Boolean Operations on CAD Footprints with Shapely"
description: "Union, difference and intersection on CAD-derived footprints in Python: repairing rings before the operation, choosing between unary_union and pairwise merging, and handling the multi-part results a CAD source produces."
slug: "computing-boolean-operations-on-cad-footprints-with-shapely"
breadcrumb:
  - label: "Interoperability Decision Guides"
    url: "/interoperability-decision-guides/"
  - label: "Choosing a Geometry Engine for Python Pipelines"
    url: "/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/"
  - label: "Computing Boolean Operations on CAD Footprints with Shapely"
    url: "/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/computing-boolean-operations-on-cad-footprints-with-shapely/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Computing Boolean Operations on CAD Footprints with Shapely",
      "description": "Union, difference and intersection on CAD-derived footprints in Python: repairing rings before the operation, choosing between unary_union and pairwise merging, and handling the multi-part results a CAD source produces.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/computing-boolean-operations-on-cad-footprints-with-shapely/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Interoperability Decision Guides", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/"},
        {"@type": "ListItem", "position": 2, "name": "Choosing a Geometry Engine for Python Pipelines", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/"},
        {"@type": "ListItem", "position": 3, "name": "Computing Boolean Operations on CAD Footprints with Shapely", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/computing-boolean-operations-on-cad-footprints-with-shapely/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Perform boolean operations on CAD-derived footprints with Shapely",
      "description": "Validate and repair the input rings, shift to a local origin, run the operation with unary_union rather than pairwise merging, and normalise the multi-part result.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Validate and repair every ring", "text": "Check each polygon and repair it before the operation, since a boolean on invalid input either raises or returns a plausible wrong answer."},
        {"@type": "HowToStep", "position": 2, "name": "Shift to a local origin", "text": "Subtract a common origin so the arithmetic happens at small magnitudes where the predicates are most robust."},
        {"@type": "HowToStep", "position": 3, "name": "Union with unary_union", "text": "Merge the whole collection in one call rather than folding pairwise, which is both slower and more prone to intermediate invalidity."},
        {"@type": "HowToStep", "position": 4, "name": "Normalise the result", "text": "Handle the multi-part and empty results a CAD source produces rather than assuming a single polygon."},
        {"@type": "HowToStep", "position": 5, "name": "Restore the origin", "text": "Translate the result back so the output is in the coordinate system the input was in."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Why does unary_union beat folding with union in a loop?",
          "acceptedAnswer": {"@type": "Answer", "text": "Because it merges the whole collection with one pass over a spatially indexed structure, whereas a fold performs n operations on progressively larger intermediate geometries. The fold is slower by a wide margin at scale, and every intermediate is an opportunity for a validity problem to compound. Reach for the fold only when you need the intermediates."}
        },
        {
          "@type": "Question",
          "name": "Does Shapely consider Z in a union?",
          "acceptedAnswer": {"@type": "Answer", "text": "No. Shapely is planar: it will carry a Z ordinate through and it will not use it in any predicate or constructive operation. Two footprints at different elevations union in plan. Where elevation separates the features — floors of a building, a bridge over a road — a planar engine is answering a different question from the one you asked."}
        },
        {
          "@type": "Question",
          "name": "What should I do with a GeometryCollection result?",
          "acceptedAnswer": {"@type": "Answer", "text": "Decide deliberately rather than indexing into it. A collection appears when an operation produces mixed dimensionality — a polygon plus a line where two shapes touch along an edge. Filter to the dimension you want, and treat the presence of lower-dimensional parts as a signal that the input rings were touching rather than overlapping."}
        }
      ]
    }
  ]
}
</script>

# Computing Boolean Operations on CAD Footprints with Shapely

To union, difference or intersect CAD-derived footprints reliably, repair every ring before the operation, shift the coordinates to a local origin, use a single collection-wide call rather than a pairwise fold, and handle the multi-part results a CAD source will produce. Boolean algorithms assume valid input and are not obliged to detect that they did not get it. This page is part of [Choosing a Geometry Engine for Python Pipelines](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/).

## Why CAD Input Breaks Boolean Operations

Geometry that came from a drawing arrives with three properties the algorithms dislike.

<!-- fig:shp-three-properties -->
<svg viewBox="-20 -20 419.5 184.1" role="img" aria-label="Invalid rings, large coordinates and near-coincident vertices — what each does to a boolean and how to remove it" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>Three properties of CAD geometry and their remedies</title>
  <desc>The three characteristics of drawing-derived geometry that boolean algorithms dislike, what each produces, and the step that removes it. All three are cheap to fix at the boundary and expensive to diagnose inside an operation, which is the argument for validating before computing rather than catching afterwards.</desc>
  <defs>
    <marker id="sh1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="sh1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="419.5" height="184.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="379.5" height="122" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="379.5" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">Property</text>
  <text x="209.3" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Produces</text>
  <line x1="262.6" y1="0" x2="262.6" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="321.1" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Remedy</text>
  <line x1="156.1" y1="0" x2="156.1" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="379.5" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">Self-intersecting ring</text>
  <text x="209.3" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">undefined interior</text>
  <text x="321.1" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">validate and repair</text>
  <line x1="0" y1="62" x2="379.5" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">Full projected coordinates</text>
  <text x="209.3" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">precision loss</text>
  <text x="321.1" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">shift to a local origin</text>
  <line x1="0" y1="92" x2="379.5" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">Near-coincident vertices</text>
  <text x="209.3" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">nanometre slivers</text>
  <text x="321.1" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">filter by area</text>
  <text x="0" y="142" font-size="9.5" fill="currentColor" fill-opacity="0.7">Each is one line at the boundary and a long afternoon inside a GEOS exception.</text>
</svg>
<!-- /fig:shp-three-properties -->

**Rings are frequently not simple.** A closed polyline drafted by a person can cross itself, double back, or repeat a vertex, and none of that is visible at drawing scale. A self-intersecting ring has no well-defined interior, so an operation on it has no well-defined answer.

**Coordinates are large.** Full projected easting and northing values put the arithmetic at seven significant figures before the decimal point, where the numerical margins that make the predicates robust are proportionally much smaller. Shifting to a local origin costs one subtraction and moves the whole computation into a range where it behaves.

**Vertices are nearly coincident rather than coincident.** Two footprints that share an edge in the drawing usually share it to within a micron rather than exactly, which produces slivers — zero-width polygons a few nanometres across — in the output. They are valid geometry and they are noise.

## Production-Ready Script

{% raw %}
```python
# shapely>=2.0, numpy>=1.24, Python 3.9+
from __future__ import annotations

from dataclasses import dataclass
import numpy as np
from shapely.geometry import Polygon, MultiPolygon
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union
from shapely.validation import make_valid, explain_validity
from shapely.affinity import translate


@dataclass(frozen=True)
class MergeReport:
    inputs: int
    repaired: int
    dropped: int
    parts_out: int


def _clean(poly: Polygon) -> BaseGeometry | None:
    """Repair a ring, or report it unusable. Never returns invalid geometry."""
    if poly.is_empty or poly.area <= 0:
        return None
    if poly.is_valid:
        return poly
    fixed = make_valid(poly)
    if fixed.is_empty:
        return None
    return fixed


def merge_footprints(
    polygons: list[Polygon], *, sliver_area: float = 1e-6
) -> tuple[BaseGeometry, MergeReport]:
    """Union a collection of CAD footprints, robustly."""
    if not polygons:
        raise ValueError("nothing to merge")

    # A common local origin keeps the arithmetic at small magnitudes.
    all_coords = np.vstack([np.array(p.exterior.coords) for p in polygons if not p.is_empty])
    ox, oy = all_coords.mean(axis=0)

    cleaned, repaired, dropped = [], 0, 0
    for p in polygons:
        shifted = translate(p, xoff=-ox, yoff=-oy)
        was_valid = shifted.is_valid
        fixed = _clean(shifted)
        if fixed is None:
            dropped += 1
            continue
        if not was_valid:
            repaired += 1
        cleaned.append(fixed)

    if not cleaned:
        raise ValueError("every input polygon was empty or unrepairable")

    merged = unary_union(cleaned)          # one pass, not a pairwise fold

    # Drop slivers produced by near-coincident edges.
    if isinstance(merged, MultiPolygon):
        keep = [g for g in merged.geoms if g.area > sliver_area]
        merged = MultiPolygon(keep) if len(keep) > 1 else (keep[0] if keep else merged)

    parts = len(merged.geoms) if hasattr(merged, "geoms") else 1
    return translate(merged, xoff=ox, yoff=oy), MergeReport(
        inputs=len(polygons), repaired=repaired, dropped=dropped, parts_out=parts)


def difference_with_report(a: Polygon, b: Polygon) -> BaseGeometry:
    """Difference with the post-condition a boolean will not check for you."""
    for name, g in (("a", a), ("b", b)):
        if not g.is_valid:
            raise ValueError(f"{name} is invalid: {explain_validity(g)}")
    result = a.difference(b)
    if result.area > a.area + 1e-9:
        raise ValueError("difference increased the area — check ring orientation")
    return result


if __name__ == "__main__":
    merged, report = merge_footprints([...])
    print(report, merged.geom_type)
```
{% endraw %}

<!-- fig:shp-union-strategy -->
<svg viewBox="-20 -20 570 194.1" role="img" aria-label="A pairwise union fold is slower and compounds invalidity; a single collection-wide union avoids both" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:570px;display:block;margin:1.5rem auto;">
  <title>Folding pairwise against merging the collection</title>
  <desc>Two ways of unioning a set of footprints. Folding performs one operation per input on a progressively larger intermediate, and every intermediate is an opportunity for a validity problem to compound. Merging the collection in one call works over a spatially indexed structure and produces no intermediates at all.</desc>
  <defs>
    <marker id="sh2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="sh2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="570" height="194.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="250" height="130" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4" stroke-dasharray="5 4"/>
  <text x="125" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Fold with union()</text>
  <line x1="14" y1="33" x2="236" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="16" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— n operations</text>
  <text x="16" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— intermediates grow</text>
  <text x="16" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— invalidity compounds</text>
  <text x="16" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— slow at scale</text>
  <rect x="280" y="0" width="250" height="130" rx="6" fill="currentColor" fill-opacity="0.11" stroke="currentColor" stroke-width="1.9"/>
  <text x="405" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">unary_union()</text>
  <line x1="294" y1="33" x2="516" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="296" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— one call over the collection</text>
  <text x="296" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— spatially indexed internally</text>
  <text x="296" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— no intermediates</text>
  <text x="296" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— the default</text>
  <text x="265" y="152" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">Fold only when you actually need the intermediates.</text>
</svg>
<!-- /fig:shp-union-strategy -->

**Key implementation notes:**

- Validation happens before every operation, and repair is counted. A run that repaired 300 of 400 inputs is telling you something about the source drawing that a silent repair would hide.
- The origin shift is applied to the inputs and reversed on the output, so the caller sees no difference except robustness.
- `unary_union` merges the whole collection at once. The pairwise fold is the common first implementation and is markedly slower and less robust at scale.
- Sliver filtering uses an area threshold rather than a buffer trick, because a zero-buffer round trip is itself a source of new invalidity.
- The area post-condition on `difference` is three lines and catches a class of orientation bug the operation will not report.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `shapely` | `>=2.0` | `make_valid`, vectorised predicates, GEOS 3.10+ |
| GEOS | `>=3.10` | `make_valid` behaviour and robustness improvements |
| `numpy` | `>=1.24` | origin computation |
| Dimensionality | planar only | Z is carried, never considered |
| Input | `Polygon` with closed rings | closure is the caller's responsibility |

## Fallback Strategies

**1. `TopologyException` from GEOS.** Almost always invalid input that slipped past validation, or coordinates large enough to lose precision. Confirm the origin shift is applied and that every input passed `_clean`.

<!-- fig:shp-planar-warning -->
<svg viewBox="-20 -20 317.3 216.2" role="img" aria-label="A planar engine is correct where features share a plane and answers a different question where elevation separates them" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>When a planar engine is answering a different question</title>
  <desc>A branch on whether elevation participates in the answer. Where the features genuinely lie in one plane, a planar library is fast, robust and correct. Where elevation separates them — floors of a building, a bridge over a road — the planar result is a correct answer to a question about plan, and the question asked was about space.</desc>
  <defs>
    <marker id="sh3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="sh3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="317.3" height="216.2" fill="var(--color-surface)"/>
  <polygon points="138.7,0 266.5,31 138.7,62 10.9,31" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-width="1.6"/>
  <text x="138.7" y="35" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">Does elevation separate the features?</text>
  <rect x="0" y="128" width="124.7" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="62.3" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Shapely</text>
  <text x="62.3" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">fast and correct</text>
  <path d="M 138.7 62 L 138.7 92 L 62.3 92 L 62.3 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#sh3-a)" stroke-linejoin="round"/>
  <text x="62.3" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">no</text>
  <rect x="152.7" y="128" width="124.7" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="215" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">A 3D engine</text>
  <text x="215" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">plan answer is wrong</text>
  <path d="M 138.7 62 L 138.7 92 L 215 92 L 215 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#sh3-a)" stroke-linejoin="round"/>
  <text x="215" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">yes</text>
</svg>
<!-- /fig:shp-planar-warning -->

**2. The union result is a `GeometryCollection`.** Inputs touch along edges rather than overlapping, producing lines alongside polygons. Filter to polygons, and treat the collection as a signal that the drawing's edges are coincident-ish rather than shared.

**3. Slivers survive the filter.** The threshold is too small for the coordinate scale. Set it relative to the smallest meaningful feature area rather than to an absolute constant.

**4. Everything merges into one shape.** Footprints at different elevations, unioned in plan. This is Shapely working correctly on the wrong question — see the parent page for when a planar engine is the wrong choice.

**5. The result has fewer parts than expected.** Near-coincident edges bridged features that are separate in reality. Snap the inputs to a deliberate tolerance grid before merging, so the bridging is a decision rather than an accident of precision.

## FAQ

<details>
<summary><strong>Why does unary_union beat folding with union in a loop?</strong></summary>

Because it merges the whole collection with one pass over a spatially indexed structure, whereas a fold performs n operations on progressively larger intermediate geometries. The fold is slower by a wide margin at scale, and every intermediate is an opportunity for a validity problem to compound. Reach for the fold only when you need the intermediates.

</details>

<details>
<summary><strong>Does Shapely consider Z in a union?</strong></summary>

No. Shapely is planar: it will carry a Z ordinate through and it will not use it in any predicate or constructive operation. Two footprints at different elevations union in plan. Where elevation separates the features — floors of a building, a bridge over a road — a planar engine is answering a different question from the one you asked.

</details>

<details>
<summary><strong>What should I do with a GeometryCollection result?</strong></summary>

Decide deliberately rather than indexing into it. A collection appears when an operation produces mixed dimensionality — a polygon plus a line where two shapes touch along an edge. Filter to the dimension you want, and treat the presence of lower-dimensional parts as a signal that the input rings were touching rather than overlapping.

</details>

---

## Related Pages

- [Choosing a Geometry Engine for Python Pipelines](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/) — parent reference comparing the planar, mesh and solid engines
- [Converting CAD Polylines to GeoJSON with Python](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/converting-cad-polylines-to-geojson/) — where the footprints these operations consume come from
- [Repairing Non-Manifold Meshes with trimesh](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/repairing-non-manifold-meshes-with-trimesh/) — the three-dimensional counterpart to ring repair
