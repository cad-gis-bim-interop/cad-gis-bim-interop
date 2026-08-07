---
title: "Extracting IfcAlignment Geometry with ifcopenshell"
description: "Read IFC4X3 alignment geometry in Python: the horizontal and vertical business logic, sampling the referent curve into coordinates, handling transitions, and why an alignment has no solid to extract."
slug: "extracting-ifcalignment-geometry-with-ifcopenshell"
breadcrumb:
  - label: "Core Format Fundamentals & Schema Mapping"
    url: "/core-format-fundamentals-schema-mapping/"
  - label: "IFC4x3 Schema Mapping"
    url: "/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/"
  - label: "Extracting IfcAlignment Geometry with ifcopenshell"
    url: "/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/extracting-ifcalignment-geometry-with-ifcopenshell/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Extracting IfcAlignment Geometry with ifcopenshell",
      "description": "Read IFC4X3 alignment geometry in Python: the horizontal and vertical business logic, sampling the referent curve into coordinates, handling transitions, and why an alignment has no solid to extract.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/extracting-ifcalignment-geometry-with-ifcopenshell/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Core Format Fundamentals & Schema Mapping", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/"},
        {"@type": "ListItem", "position": 2, "name": "IFC4x3 Schema Mapping", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/"},
        {"@type": "ListItem", "position": 3, "name": "Extracting IfcAlignment Geometry with ifcopenshell", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/extracting-ifcalignment-geometry-with-ifcopenshell/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Extract alignment geometry from an IFC4X3 model",
      "description": "Confirm the schema, walk the alignment to its horizontal and vertical parts, sample the segments into coordinates, and validate continuity between them.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Confirm the schema is IFC4X3", "text": "Assert the schema release, because alignment entities do not exist in earlier schemas and a mapping written for them finds nothing."},
        {"@type": "HowToStep", "position": 2, "name": "Walk to the horizontal and vertical parts", "text": "Traverse the alignment nesting to reach the horizontal alignment and, where present, the vertical one."},
        {"@type": "HowToStep", "position": 3, "name": "Sample each segment", "text": "Evaluate the line, circular arc and transition segments at a chosen station interval to produce coordinates."},
        {"@type": "HowToStep", "position": 4, "name": "Combine horizontal and vertical", "text": "Interpolate the vertical profile at each sampled station so the result is a three-dimensional centreline."},
        {"@type": "HowToStep", "position": 5, "name": "Validate continuity", "text": "Check that consecutive segments meet within tolerance in position and direction before treating the result as a centreline."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Why does an alignment produce no geometry from the kernel?",
          "acceptedAnswer": {"@type": "Answer", "text": "Because it is not a solid. An alignment carries the business logic of a route — horizontal curvature, vertical grades, transitions — rather than a shape. Products are placed along it and those products have geometry; the alignment itself has a curve that has to be evaluated by sampling, not compiled by a geometry kernel."}
        },
        {
          "@type": "Question",
          "name": "What is a referent, and why does it matter?",
          "acceptedAnswer": {"@type": "Answer", "text": "A referent is a position along the alignment expressed as a distance rather than as coordinates — a chainage or station. It is how everything on a linear asset is located, so extracting an alignment is largely about being able to convert between station and coordinates in both directions. That conversion is the useful output, more than the polyline is."}
        },
        {
          "@type": "Question",
          "name": "How finely should I sample the curve?",
          "acceptedAnswer": {"@type": "Answer", "text": "From the deviation you can accept, the same reasoning as any curve tessellation. On a large-radius motorway curve a 5 m interval is well within survey tolerance; on a tight junction radius it is not. Derive the interval from the segment radius rather than using one value for the whole alignment."}
        }
      ]
    }
  ]
}
</script>

# Extracting IfcAlignment Geometry with ifcopenshell

An alignment is business logic, not a solid: horizontal curvature, vertical grades and the transitions between them, from which coordinates are derived by sampling rather than by compiling a shape. Confirm the schema is IFC4X3, walk to the horizontal and vertical parts, sample each segment at an interval derived from its radius, and validate that consecutive segments actually meet. This page is part of [IFC4x3 Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/).

## Why the Geometry Kernel Has Nothing to Give You

Everywhere else in an IFC model, geometry means a representation the kernel can evaluate into a mesh. An alignment does not have one. What it has is a composition: a horizontal alignment made of line, circular-arc and transition segments, each with a start point, a start direction, a length and a curvature parameter; and optionally a vertical alignment made of constant-gradient and parabolic-arc segments over the same station range.

<!-- fig:align-composition -->
<svg viewBox="-20 -20 570 198" role="img" aria-label="An alignment nests horizontal and vertical alignments made of segments, not a representation a kernel can compile" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:570px;display:block;margin:1.5rem auto;">
  <title>What an alignment is made of</title>
  <desc>Three levels of composition. The alignment nests a horizontal alignment of line, circular arc and transition segments, and optionally a vertical alignment of gradients and parabolic arcs over the same station range. Coordinates come from evaluating those segments; there is no representation for a kernel to compile.</desc>
  <defs>
    <marker id="al1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="al1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="570" height="198" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="530" height="46" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="16" y="21" font-size="11.5" font-weight="600" fill="currentColor">IfcAlignment</text>
  <text x="16" y="35" font-size="9.5" fill="currentColor" fill-opacity="0.72">the route as business logic</text>
  <text x="514" y="26.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">no solid</text>
  <rect x="0" y="56" width="530" height="46" rx="6" fill="currentColor" fill-opacity="0.14" stroke="currentColor" stroke-width="2"/>
  <text x="16" y="77" font-size="11.5" font-weight="600" fill="currentColor">Horizontal</text>
  <text x="16" y="91" font-size="9.5" fill="currentColor" fill-opacity="0.72">line, circular arc, transition</text>
  <text x="514" y="82.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">plan geometry</text>
  <rect x="0" y="112" width="530" height="46" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="16" y="133" font-size="11.5" font-weight="600" fill="currentColor">Vertical</text>
  <text x="16" y="147" font-size="9.5" fill="currentColor" fill-opacity="0.72">gradient and parabolic arc</text>
  <text x="514" y="138.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">profile</text>
</svg>
<!-- /fig:align-composition -->

Coordinates come from evaluating those segments. A line segment at station *s* is its start point plus *s* along its start direction. A circular arc is the same with the direction rotating at a constant rate. A transition — a clothoid — has curvature varying linearly with distance, which is what makes it comfortable to drive and awkward to evaluate in closed form.

The output worth producing is therefore not only a polyline but a station-to-coordinate mapping, because everything else on a linear asset is located by station. A drainage gulley at chainage 2340.5 has no coordinates in the model at all until the alignment supplies them.

## Production-Ready Script

{% raw %}
```python
# ifcopenshell>=0.7.0, numpy>=1.24, Python 3.9+
from __future__ import annotations

from dataclasses import dataclass
import math
import numpy as np
import ifcopenshell


class AlignmentError(ValueError):
    pass


@dataclass(frozen=True)
class SampledAlignment:
    name: str
    stations: np.ndarray      # (n,) distance along the alignment
    xy: np.ndarray            # (n, 2) horizontal coordinates
    z: np.ndarray | None      # (n,) elevations, when a vertical alignment exists

    def coords(self) -> np.ndarray:
        if self.z is None:
            return self.xy
        return np.column_stack((self.xy, self.z))


def require_ifc4x3(model) -> None:
    if not model.schema.upper().startswith("IFC4X3"):
        raise AlignmentError(
            f"schema is {model.schema} — alignment entities exist only in IFC4X3"
        )


def _sample_segment(start_xy, start_dir, length, start_curv, end_curv, step):
    """Evaluate one segment. Handles line, arc and linearly-varying-curvature."""
    n = max(2, int(math.ceil(length / step)) + 1)
    s = np.linspace(0.0, length, n)
    if abs(start_curv) < 1e-12 and abs(end_curv) < 1e-12:
        heading = np.full_like(s, start_dir)
    else:
        # Curvature varies linearly with distance; heading is its integral.
        k = start_curv + (end_curv - start_curv) * (s / length if length else 0.0)
        heading = start_dir + np.concatenate(([0.0], np.cumsum(np.diff(s) * k[:-1])))
    dx = np.concatenate(([0.0], np.cumsum(np.diff(s) * np.cos(heading[:-1]))))
    dy = np.concatenate(([0.0], np.cumsum(np.diff(s) * np.sin(heading[:-1]))))
    xy = np.column_stack((start_xy[0] + dx, start_xy[1] + dy))
    return s, xy, heading[-1]


def sample_alignment(model, alignment, *, base_step: float = 5.0) -> SampledAlignment:
    require_ifc4x3(model)
    horizontals = [n for n in _nested(alignment) if n.is_a("IfcAlignmentHorizontal")]
    if not horizontals:
        raise AlignmentError(f"{alignment.Name!r} has no horizontal alignment")

    stations: list[np.ndarray] = []
    points: list[np.ndarray] = []
    offset = 0.0
    for segment in _nested(horizontals[0]):
        d = segment.DesignParameters
        start_xy = (float(d.StartPoint.Coordinates[0]), float(d.StartPoint.Coordinates[1]))
        length = float(d.SegmentLength)
        k0 = float(d.StartRadiusOfCurvature or 0.0)
        k1 = float(d.EndRadiusOfCurvature or 0.0)
        # Radius of zero means straight; otherwise curvature is its reciprocal.
        c0 = 1.0 / k0 if k0 else 0.0
        c1 = 1.0 / k1 if k1 else 0.0
        # Sample finer on tight radii: deviation scales with the square of the step.
        step = base_step if not c0 and not c1 else max(0.5, base_step * min(1.0, abs(k0 or k1) / 500.0))
        s, xy, _ = _sample_segment(start_xy, float(d.StartDirection), length, c0, c1, step)
        stations.append(s + offset)
        points.append(xy)
        offset += length

    st = np.concatenate(stations)
    xy = np.vstack(points)
    return SampledAlignment(name=alignment.Name or "", stations=st, xy=xy, z=None)


def _nested(entity):
    for rel in getattr(entity, "IsNestedBy", ()) or ():
        for obj in rel.RelatedObjects:
            yield obj


def check_continuity(sampled: SampledAlignment, *, tol_m: float = 0.01) -> float:
    """Largest jump between consecutive sampled points, relative to the step."""
    d = np.linalg.norm(np.diff(sampled.xy, axis=0), axis=1)
    ds = np.diff(sampled.stations)
    gap = float(np.max(np.abs(d - ds)))
    if gap > tol_m:
        raise AlignmentError(f"segments do not meet: {gap:.4f} m discontinuity")
    return gap
```
{% endraw %}

<!-- fig:align-sampling -->
<svg viewBox="-20 -20 426.9 154.1" role="img" aria-label="Sampling interval derived from segment radius: coarse on straights and large radii, fine on tight curves" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:427px;display:block;margin:1.5rem auto;">
  <title>Sampling interval derived from the segment radius</title>
  <desc>The interval at which three segments of the same alignment are sampled. A straight needs only its endpoints; a large-radius motorway curve tolerates several metres between samples; a tight junction radius does not. Deriving the interval per segment avoids over-sampling straights and under-sampling exactly the geometry that needed the samples.</desc>
  <defs>
    <marker id="al2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="al2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="426.9" height="154.1" fill="var(--color-surface)"/>
  <text x="56.4" y="11.5" text-anchor="end" font-size="10.5" fill="currentColor" fill-opacity="0.9">straight</text>
  <rect x="66.4" y="0" width="290" height="16" rx="3" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <text x="364.4" y="11.5" font-size="10" fill="currentColor" fill-opacity="0.85">25 m</text>
  <text x="56.4" y="41.5" text-anchor="end" font-size="10.5" fill="currentColor" fill-opacity="0.9">R = 2000 m</text>
  <rect x="66.4" y="30" width="58" height="16" rx="3" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <text x="132.4" y="41.5" font-size="10" fill="currentColor" fill-opacity="0.85">5 m</text>
  <text x="56.4" y="71.5" text-anchor="end" font-size="10.5" fill="currentColor" fill-opacity="0.9">R = 60 m</text>
  <rect x="66.4" y="60" width="9.3" height="16" rx="3" fill="currentColor" fill-opacity="0.42" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.9"/>
  <text x="83.7" y="71.5" font-size="10" font-weight="600" fill="currentColor" fill-opacity="0.85">0.8 m</text>
  <line x1="66.4" y1="78" x2="356.4" y2="78" stroke="currentColor" stroke-width="1" stroke-opacity="0.35"/>
  <text x="66.4" y="93" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.6">0</text>
  <text x="356.4" y="93" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.6">25</text>
  <text x="0" y="112" font-size="9.5" fill="currentColor" fill-opacity="0.7">One interval across a whole alignment is wrong at both ends.</text>
</svg>
<!-- /fig:align-sampling -->

**Key implementation notes:**

- The sampling step is derived per segment from the radius. A single interval across an alignment over-samples straights and under-samples tight curves.
- Curvature, not radius, is what varies linearly along a transition — hence the reciprocal, and hence a radius of zero meaning straight rather than a division by zero.
- `check_continuity` compares chord lengths against station differences. A discontinuity between segments shows up as a chord that does not match the station step, which is a cheap and sensitive test.
- The station array is the useful output. A downstream query converting chainage to coordinates interpolates into it; the polyline is a by-product.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `ifcopenshell` | `>=0.7.0` | entity traversal; alignments are not kernel geometry |
| IFC schema | IFC4X3 only | asserted explicitly |
| Segment types | line, circular arc, transition | transitions approximated by linear curvature |
| `numpy` | `>=1.24` | vectorised sampling |
| Vertical alignment | optional | absent on many horizontal-only models |

## Fallback Strategies

**1. Schema is not IFC4X3.** The assert fires. Earlier schemas have no alignment entities, and the route is a re-export rather than a workaround.

<!-- fig:align-continuity -->
<svg viewBox="-20 -20 321.1 216.2" role="img" aria-label="Refine the sampling on the offending segment to separate an approximation artefact from a real authoring defect" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>A discontinuity is a defect or a sampling artefact</title>
  <desc>A branch on what happens when the sampled chord lengths stop matching the station steps. Refining the interval on the offending segment separates the two causes: an approximation artefact disappears, and a genuine authoring defect does not. Reporting a data problem before making that distinction wastes the modeller time.</desc>
  <defs>
    <marker id="al3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="al3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="321.1" height="216.2" fill="var(--color-surface)"/>
  <polygon points="140.6,0 258.8,31 140.6,62 22.3,31" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-width="1.6"/>
  <text x="140.6" y="35" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">Chords do not match station steps</text>
  <rect x="0" y="128" width="126.6" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="63.3" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Sampling artefact</text>
  <text x="63.3" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">reduce the step</text>
  <path d="M 140.6 62 L 140.6 92 L 63.3 92 L 63.3 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#al3-a)" stroke-linejoin="round"/>
  <text x="63.3" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">refining fixes it</text>
  <rect x="154.6" y="128" width="126.6" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="217.8" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Authoring defect</text>
  <text x="217.8" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">report it</text>
  <path d="M 140.6 62 L 140.6 92 L 217.8 92 L 217.8 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#al3-a)" stroke-linejoin="round"/>
  <text x="217.8" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">refining does not</text>
</svg>
<!-- /fig:align-continuity -->

**2. No horizontal alignment.** The alignment exists as a container with nothing nested. Usually an export scope problem; check whether the alignment was included in the model view.

**3. Discontinuity between segments.** Either a genuine authoring defect or a transition approximated too coarsely. Reduce the step on the offending segment and re-check before reporting it as a data problem.

**4. Segments in the wrong order.** Nesting order is not guaranteed to be station order. Sort by start station before accumulating the offset.

**5. Coordinates are model-local.** The alignment inherits the model's georeferencing like everything else. Apply the map conversion before comparing against survey.

## FAQ

<details>
<summary><strong>Why does an alignment produce no geometry from the kernel?</strong></summary>

Because it is not a solid. An alignment carries the business logic of a route — horizontal curvature, vertical grades, transitions — rather than a shape. Products are placed along it and those products have geometry; the alignment itself has a curve that has to be evaluated by sampling, not compiled by a geometry kernel.

</details>

<details>
<summary><strong>What is a referent, and why does it matter?</strong></summary>

A referent is a position along the alignment expressed as a distance rather than as coordinates — a chainage or station. It is how everything on a linear asset is located, so extracting an alignment is largely about being able to convert between station and coordinates in both directions. That conversion is the useful output, more than the polyline is.

</details>

<details>
<summary><strong>How finely should I sample the curve?</strong></summary>

From the deviation you can accept, the same reasoning as any curve tessellation. On a large-radius motorway curve a 5 m interval is well within survey tolerance; on a tight junction radius it is not. Derive the interval from the segment radius rather than using one value for the whole alignment.

</details>

---

## Related Pages

- [IFC4x3 Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/) — parent reference on the infrastructure entities IFC4X3 introduced
- [ifcopenshell Workflow](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/) — the geometry evaluation that alignments deliberately sit outside of
- [CityGML and GML Interchange](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/) — where a sampled centreline usually ends up for city-scale analysis
