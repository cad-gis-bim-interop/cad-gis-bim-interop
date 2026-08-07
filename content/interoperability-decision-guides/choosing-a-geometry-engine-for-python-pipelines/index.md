---
title: "Choosing a Geometry Engine for Python Pipelines"
description: "Shapely, trimesh and OpenCASCADE solve different problems. Compare them on dimensionality, failure behaviour and deployment weight, and pick the one you need."
slug: "choosing-a-geometry-engine-for-python-pipelines"
breadcrumb:
  - label: "Interoperability Decision Guides"
    url: "/interoperability-decision-guides/"
  - label: "Choosing a Geometry Engine for Python Pipelines"
    url: "/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Choosing a Geometry Engine for Python Pipelines",
      "description": "Shapely, trimesh and OpenCASCADE solve different problems. Compare them on dimensionality, failure behaviour and deployment weight, and pick the one you need.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Interoperability Decision Guides", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/"},
        {"@type": "ListItem", "position": 2, "name": "Choosing a Geometry Engine for Python Pipelines", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Choose a geometry engine for a CAD, GIS or BIM pipeline",
      "description": "Establish the dimensionality the work needs, decide whether exactness or robustness matters more, weigh the deployment cost, and confirm the failure behaviour is one the pipeline can act on.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Establish the dimensionality", "text": "Decide whether the operations are planar, surface-mesh or solid, because that single question eliminates two of the three engines."},
        {"@type": "HowToStep", "position": 2, "name": "Decide exactness against robustness", "text": "Choose between a kernel that models exact curved geometry and a library that works on approximations but rarely refuses to answer."},
        {"@type": "HowToStep", "position": 3, "name": "Weigh the deployment cost", "text": "Compare wheel size, native dependencies and container build time, since a kernel adds hundreds of megabytes to every image."},
        {"@type": "HowToStep", "position": 4, "name": "Check the failure behaviour", "text": "Confirm the engine reports failure in a form the pipeline can act on rather than returning geometry that is subtly wrong."},
        {"@type": "HowToStep", "position": 5, "name": "Test on real inputs", "text": "Run the candidate against a fixture set drawn from real deliveries, because engine differences appear on degenerate input rather than on clean input."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Can I just use Shapely for everything?",
          "acceptedAnswer": {"@type": "Answer", "text": "Only if everything is planar. Shapely is two-dimensional: it will carry a Z ordinate through an operation but no predicate or constructive operation considers it, so a union of two 3D polygons is computed in plan. For footprints, buffers, overlays and topology that is exactly right and extremely fast. For anything where the third dimension participates in the answer, it silently gives you the plan answer."}
        },
        {
          "@type": "Question",
          "name": "When is OpenCASCADE actually necessary?",
          "acceptedAnswer": {"@type": "Answer", "text": "When the geometry is a solid with curved faces and the operation has to respect them. Boolean operations on B-rep solids, exact filleting, and evaluating a parametric IFC representation to its true surface all need a real kernel. If the pipeline only ever consumes triangulated output, the kernel work has already been done by whatever produced the mesh, and carrying the kernel is cost without benefit."}
        },
        {
          "@type": "Question",
          "name": "Why does a boolean operation fail on geometry that looks fine?",
          "acceptedAnswer": {"@type": "Answer", "text": "Almost always because the input is invalid in a way that is not visible: a self-intersecting ring, a mesh with duplicated vertices that leave hairline gaps, or coplanar faces that overlap. Boolean algorithms assume valid, manifold input and have no obligation to detect that they did not get it. Validate and repair first, and the failure rate drops sharply."}
        },
        {
          "@type": "Question",
          "name": "How much does a geometry kernel add to a container image?",
          "acceptedAnswer": {"@type": "Answer", "text": "Hundreds of megabytes, in practice. A pure-Python planar library is a few megabytes; a mesh library with numerical dependencies is tens; a full B-rep kernel with its own numerics is a large multiple of that. On a fleet that scales out, this shows up as image pull time on every cold start, which is a real operational cost rather than a disk-space nicety."}
        },
        {
          "@type": "Question",
          "name": "Can I mix engines in one pipeline?",
          "acceptedAnswer": {"@type": "Answer", "text": "Yes, and it is often the right design — evaluate solids with a kernel at the point of ingestion, then work in a mesh or planar library everywhere downstream. The rule that keeps it manageable is that geometry crosses an engine boundary in a neutral representation, such as a vertex and index array or well-known binary, rather than as engine-specific objects. That keeps the boundary explicit and each engine replaceable."}
        }
      ]
    }
  ]
}
</script>

# Choosing a Geometry Engine for Python Pipelines

A geometry engine is the library that answers questions about shapes — do these overlap, what is their union, is this solid closed — and choosing one is a decision the rest of a pipeline is built on top of. It belongs in the [Interoperability Decision Guides](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/) because, like the read-route and storage decisions alongside it, it is cheap to make deliberately and expensive to revisit.

The choice is usually made by accident. A pipeline starts with footprints, reaches for the planar library everyone uses, and works well until the day a requirement arrives that has a third dimension in it. At that point the question is not which engine is best but which engine the existing code can be moved to, and the answer is often "none of them without a rewrite". Making the decision explicitly, once, costs an afternoon.

## Prerequisites

- **Python 3.9+**.
- A clear statement of the geometric operations the pipeline performs. Not the formats — the *operations*. "Buffer a centreline and find what it intersects" and "subtract a void from a solid" are different decisions.
- Willingness to measure. Engine comparisons on clean synthetic geometry are uninformative; the differences appear on real deliveries.

{% raw %}
```bash
# Install whichever candidates are in scope; they coexist happily.
pip install "shapely>=2.0" "trimesh>=4.0" "numpy>=1.24"
pip install "pythonocc-core>=7.7"   # the B-rep kernel — large
```
{% endraw %}

## Architectural Overview

The three candidates are not competitors so much as answers to different questions, and the question that separates them is dimensionality.

<!-- fig:ge-dimensionality -->
<svg viewBox="-20 -20 498.3 216.2" role="img" aria-label="Planar work, mesh work and exact solid work point at three different geometry engines" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:498px;display:block;margin:1.5rem auto;">
  <title>Dimensionality eliminates two of the three engines</title>
  <desc>A three-way branch on what the operations actually work on. Planar operations belong to a two-dimensional library; operations on triangulated surfaces belong to a mesh library; operations that must respect exact curved solids need a boundary-representation kernel. One requirement from the third branch decides the whole pipeline.</desc>
  <defs>
    <marker id="ge1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ge1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="498.3" height="216.2" fill="var(--color-surface)"/>
  <polygon points="229.2,0 342.8,31 229.2,62 115.5,31" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-width="1.6"/>
  <text x="229.2" y="35" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">What do the operations work on?</text>
  <rect x="0" y="128" width="134.1" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="67.1" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Shapely</text>
  <text x="67.1" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">planar, robust, small</text>
  <path d="M 229.2 62 L 229.2 92 L 67.1 92 L 67.1 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#ge1-a)" stroke-linejoin="round"/>
  <text x="67.1" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">plan geometry</text>
  <rect x="162.1" y="128" width="134.1" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="229.2" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">trimesh</text>
  <text x="229.2" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">approximate, moderate</text>
  <path d="M 229.2 62 L 229.2 92 L 229.2 92 L 229.2 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#ge1-a)" stroke-linejoin="round"/>
  <text x="229.2" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">triangle meshes</text>
  <rect x="324.2" y="128" width="134.1" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="391.3" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">OpenCASCADE</text>
  <text x="391.3" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">exact, heavy</text>
  <path d="M 229.2 62 L 229.2 92 L 391.3 92 L 391.3 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#ge1-a)" stroke-linejoin="round"/>
  <text x="391.3" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">exact solids</text>
</svg>
<!-- /fig:ge-dimensionality -->

**Shapely** is a planar geometry library over GEOS. Its predicates and constructive operations — intersects, contains, union, difference, buffer — operate in two dimensions, and it is fast, robust and extremely well understood. It will hold a Z ordinate and carry it through, but no operation considers it. The consequence worth internalising is that the union of two 3D polygons is computed in plan; the answer is correct for the question it asked, which is not necessarily the question you asked.

**trimesh** is a triangle-mesh library. It works on explicit vertices and faces, and it answers the questions a mesh has: is this watertight, what is its volume, do these two meshes intersect, what does this look like after decimation. Its boolean support depends on an optional backend, and its numerical world is approximate by construction, because everything is already triangulated.

**OpenCASCADE**, reached from Python through `pythonocc`, is a boundary-representation kernel. It models exact curved surfaces — cylinders, tori, NURBS — and performs boolean operations on solids without triangulating first. It is what IfcOpenShell uses internally to evaluate parametric IFC geometry into meshes. It is also, by a wide margin, the heaviest dependency of the three.

| Property | Shapely | trimesh | OpenCASCADE |
|---|---|---|---|
| Dimensionality | planar (2D) | surface mesh (3D) | solid B-rep (3D) |
| Curved geometry | approximated | triangulated | exact |
| Boolean operations | robust, planar | backend-dependent | full, on solids |
| Validity model | OGC simple features | manifold mesh | topological solid |
| Deployment weight | small | moderate | large |
| Typical failure | raises on invalid input | returns a broken mesh | raises or returns null shape |

That last row is the one most worth reading carefully, because failure behaviour determines what a pipeline can do about a problem. An engine that raises gives you a file name and a stack trace. An engine that returns a mesh which is subtly non-manifold gives you a dataset and a complaint six weeks later.

## Step-by-Step Implementation

### 1. Classify the operations, not the formats

<!-- fig:ge-boundary -->
<svg viewBox="-20 -33.5 413.1 125.8" role="img" aria-label="Passing a vertex and index array between stages keeps each geometry engine replaceable at one adapter" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>A neutral representation at each engine boundary</title>
  <desc>Three stages joined by a neutral form. A kernel evaluates exact solids at ingestion and emits a vertex and index array; downstream stages work in a mesh or planar library on that array; the final stage serialises it. Passing engine-native objects between stages couples every stage to the engine, whereas passing arrays couples them only to a shape.</desc>
  <defs>
    <marker id="ge2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ge2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-33.5" width="413.1" height="125.8" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="83.4" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="41.7" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Kernel</text>
  <text x="41.7" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">exact solids</text>
  <rect x="117.4" y="0" width="133.5" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="184.2" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Mesh / planar work</text>
  <text x="184.2" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">engine-agnostic</text>
  <rect x="284.9" y="0" width="88.2" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="329" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Serialise</text>
  <text x="329" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">target format</text>
  <line x1="83.4" y1="24.1" x2="117.4" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#ge2-a)"/>
  <text x="100.4" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">vertices + faces</text>
  <line x1="250.9" y1="24.1" x2="284.9" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#ge2-a)"/>
  <text x="267.9" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">vertices + faces</text>
  <text x="0" y="70.2" font-size="9.5" fill="currentColor" fill-opacity="0.7">Swap an engine at one adapter instead of everywhere it was imported.</text>
</svg>
<!-- /fig:ge-boundary -->

{% raw %}
```python
# Python 3.9+
PLANAR = {"buffer", "overlay", "footprint_union", "point_in_polygon", "topology_repair"}
MESH   = {"watertight_check", "volume", "decimate", "mesh_boolean", "normals"}
SOLID  = {"exact_boolean", "fillet", "evaluate_parametric", "section_curve"}

def engine_for(operations: set[str]) -> str:
    if operations & SOLID:
        return "opencascade"
    if operations & MESH:
        return "trimesh"
    if operations <= PLANAR:
        return "shapely"
    raise ValueError(f"unclassified operations: {sorted(operations - PLANAR - MESH - SOLID)}")
```
{% endraw %}

Ordering the tests from heaviest requirement downward is deliberate: one exact-boolean requirement decides the whole pipeline, and discovering that after the planar code is written is the expensive path.

### 2. Test exactness against robustness on your own data

The decision between an exact kernel and an approximating library is usually presented as accuracy, and in practice it is about failure rate. A kernel gives an exact answer or refuses; a mesh library gives an approximate answer nearly always. Which is preferable depends on whether a wrong-but-plausible answer is worse than no answer, and in an automated pipeline it usually is.

{% raw %}
```python
# trimesh>=4.0, numpy>=1.24
def boolean_or_report(a, b):
    """Attempt a mesh boolean and report rather than trusting the result."""
    try:
        result = a.difference(b)
    except Exception as exc:
        return None, f"boolean raised: {exc}"
    if not result.is_watertight:
        return None, "boolean produced a non-watertight result — treat as failed"
    if result.volume > a.volume + 1e-9:
        return None, "difference increased the volume — inverted normals in an input"
    return result, "ok"
```
{% endraw %}

Both post-conditions are cheap and both catch results that the library was perfectly willing to return.

### 3. Weigh the deployment cost honestly

A geometry kernel is not a library, it is a runtime. Measure what it adds to the container image and to cold-start time on the platform you actually deploy to, and weigh that against how often the kernel-only operations occur. A pipeline that needs an exact boolean on one percent of its input can often route that one percent to a separate service and keep the common path light — a design that is only available if the decision is made before the coupling exists.

### 4. Establish a neutral representation at engine boundaries

{% raw %}
```python
# numpy>=1.24
from dataclasses import dataclass
import numpy as np

@dataclass(frozen=True)
class Mesh:
    """The neutral form geometry takes when it crosses an engine boundary."""
    vertices: np.ndarray      # (n, 3) float64
    faces: np.ndarray         # (m, 3) int32, indices into vertices

    def __post_init__(self):
        if self.vertices.ndim != 2 or self.vertices.shape[1] != 3:
            raise ValueError("vertices must be (n, 3)")
        if self.faces.max(initial=-1) >= len(self.vertices):
            raise ValueError("face index out of range")
```
{% endraw %}

Passing engine-native objects between stages couples every stage to the engine. Passing a vertex-and-index array couples them to a shape, and swapping an engine becomes a change at two adapters rather than everywhere.

### 5. Validate before you compute, always

Every engine assumes valid input and none of them is obliged to check. The single highest-yield practice across all three is to validate and repair at the boundary rather than to debug a failure inside the operation:

{% raw %}
```python
# shapely>=2.0
from shapely.validation import make_valid, explain_validity

def clean(geom):
    if geom.is_valid:
        return geom
    reason = explain_validity(geom)
    repaired = make_valid(geom)
    if repaired.is_empty:
        raise ValueError(f"unrepairable geometry: {reason}")
    return repaired
```
{% endraw %}

## Edge Cases and Gotchas

**Planar operations on 3D input.** Shapely accepts coordinates with a Z ordinate and returns results with one, which makes it look three-dimensional. It is not: two polygons at different elevations intersect in plan. Any pipeline where elevation separates features — floors of a building, a bridge over a road — is silently answering the wrong question.

<!-- fig:ge-failure-behaviour -->
<svg viewBox="-20 -20 464.1 184.1" role="img" aria-label="Shapely raises, trimesh can return a broken mesh, and OpenCASCADE raises or returns a null shape" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:464px;display:block;margin:1.5rem auto;">
  <title>How each engine tells you it failed</title>
  <desc>The three engines compared on failure behaviour, which is what decides whether a pipeline can act on a problem. A library that raises gives a file name and a stack trace; one that returns a subtly broken result gives a dataset and a complaint weeks later. The kernel does both, which is why its results have to be tested for nullity as well as caught.</desc>
  <defs>
    <marker id="ge3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ge3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="464.1" height="184.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="424.1" height="122" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="424.1" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">Engine</text>
  <text x="154.7" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">On invalid input</text>
  <line x1="205.4" y1="0" x2="205.4" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="259.4" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">On failure</text>
  <line x1="313.4" y1="0" x2="313.4" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="368.7" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Detectable?</text>
  <line x1="103.9" y1="0" x2="103.9" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="424.1" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">Shapely</text>
  <text x="154.7" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">raises</text>
  <text x="259.4" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">exception</text>
  <text x="368.7" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">yes</text>
  <line x1="0" y1="62" x2="424.1" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">trimesh</text>
  <text x="154.7" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">often proceeds</text>
  <text x="259.4" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">broken mesh</text>
  <text x="368.7" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">only by post-check</text>
  <line x1="0" y1="92" x2="424.1" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">OpenCASCADE</text>
  <text x="154.7" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">undefined</text>
  <text x="259.4" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">raise or null shape</text>
  <text x="368.7" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">test for null</text>
  <text x="0" y="142" font-size="9.5" fill="currentColor" fill-opacity="0.7">A wrong-but-plausible result is worse in a pipeline than no result at all.</text>
</svg>
<!-- /fig:ge-failure-behaviour -->

**Mesh booleans need a backend and quietly change behaviour without one.** trimesh's boolean support depends on an optional native backend. A container built without it degrades to a different code path or refuses, and the difference between development and production is a dependency nobody declared. Assert the backend is present at start-up rather than discovering it on first use.

**Kernel operations return null shapes.** OpenCASCADE signals failure by returning an empty or null shape as often as by raising. Code that assumes a result and reads its faces gets zero faces, which flows onward as an element with no geometry. Check the result is non-null before using it.

**Tolerance is per engine and not shared.** Each engine has its own notion of when two coordinates are the same point, and they do not agree. Geometry that is watertight under one engine's tolerance can be non-manifold under another's. Where geometry crosses an engine boundary, re-validate on the receiving side rather than trusting the sender's verdict.

**Coordinate magnitude degrades everything.** All three engines lose robustness at full projected coordinates, and the symptom is intermittent boolean failure that moves around as the input changes. Shift to a local origin before computing, as with every other stage in this pipeline.

**Version pinning matters more than usual.** Geometry libraries change numerical behaviour between releases, and a repair that succeeded under one version can fail under the next without any API change to signal it. Pin the engine and its native dependency, and treat an engine upgrade as a change requiring the fixture suite to be re-run.

## Validation and Testing

The fixture set is the deliverable of this decision. Assemble geometry drawn from real deliveries that has already caused trouble — a self-intersecting site boundary, a mesh with a hairline gap, a solid with coplanar faces — and assert the chosen engine's behaviour on all of it.

{% raw %}
```python
# pytest, shapely>=2.0, trimesh>=4.0
import pytest

@pytest.mark.parametrize("fixture", ["self_intersecting_boundary", "hairline_gap_mesh",
                                     "coplanar_faces_solid", "degenerate_sliver"])
def test_engine_either_succeeds_or_reports(fixture, load_fixture):
    geom = load_fixture(fixture)
    result, status = boolean_or_report(geom.a, geom.b)
    # The contract is not "always succeeds" — it is "never silently wrong".
    assert result is not None or status != "ok"

def test_planar_engine_is_not_used_for_elevated_features(load_fixture):
    lower, upper = load_fixture("stacked_floors")
    # These footprints coincide in plan and are 3 m apart in Z.
    assert lower.intersects(upper), "Shapely is planar — this SHOULD intersect"
    # ...which is why the pipeline must not use a planar engine here.
```
{% endraw %}

The second test asserts a property that looks like a bug, and documents it as a constraint. That is the useful form for a decision like this one: the test does not fail when the engine behaves as designed, it fails when someone changes the engine and the assumption stops holding.

## Performance and Scale

Performance differences between these engines are large but rarely the deciding factor, because the operations are not interchangeable in the first place. Where they do compete — a planar overlay that could be done as a mesh operation, say — the planar library wins by an order of magnitude, and the reason is worth knowing: it is operating on far less data, since a footprint is a handful of coordinates and the equivalent mesh is thousands of triangles.

Three practices matter more than engine choice for throughput.

**Reduce before you compute.** Simplifying a polygon to the tolerance the answer needs, or decimating a mesh to the density the question requires, is almost always faster than computing on the full-resolution input and simplifying afterwards. The exception is where simplification would change the answer — a topological overlay, for instance — and that exception should be a deliberate note in the code.

**Index spatially before pairwise work.** Any operation that compares every feature against every other is quadratic and will dominate at scale. An STR-tree over the candidates, queried per feature, turns the comparison count from millions into thousands, and every one of these engines pairs with one.

**Parallelise per feature, not per operation.** Geometry operations are usually not internally parallel, but features are independent. A process pool over features scales linearly until memory or the engine's own thread-safety becomes the constraint — check the latter, since not every native backend is safe to call from several threads in one process.

## FAQ

<details>
<summary><strong>Can I just use Shapely for everything?</strong></summary>

Only if everything is planar. Shapely is two-dimensional: it will carry a Z ordinate through an operation but no predicate or constructive operation considers it, so a union of two 3D polygons is computed in plan. For footprints, buffers, overlays and topology that is exactly right and extremely fast. For anything where the third dimension participates in the answer, it silently gives you the plan answer.

</details>

<details>
<summary><strong>When is OpenCASCADE actually necessary?</strong></summary>

When the geometry is a solid with curved faces and the operation has to respect them. Boolean operations on B-rep solids, exact filleting, and evaluating a parametric IFC representation to its true surface all need a real kernel. If the pipeline only ever consumes triangulated output, the kernel work has already been done by whatever produced the mesh, and carrying the kernel is cost without benefit.

</details>

<details>
<summary><strong>Why does a boolean operation fail on geometry that looks fine?</strong></summary>

Almost always because the input is invalid in a way that is not visible: a self-intersecting ring, a mesh with duplicated vertices that leave hairline gaps, or coplanar faces that overlap. Boolean algorithms assume valid, manifold input and have no obligation to detect that they did not get it. Validate and repair first, and the failure rate drops sharply.

</details>

<details>
<summary><strong>How much does a geometry kernel add to a container image?</strong></summary>

Hundreds of megabytes, in practice. A pure-Python planar library is a few megabytes; a mesh library with numerical dependencies is tens; a full B-rep kernel with its own numerics is a large multiple of that. On a fleet that scales out, this shows up as image pull time on every cold start, which is a real operational cost rather than a disk-space nicety.

</details>

<details>
<summary><strong>Can I mix engines in one pipeline?</strong></summary>

Yes, and it is often the right design — evaluate solids with a kernel at the point of ingestion, then work in a mesh or planar library everywhere downstream. The rule that keeps it manageable is that geometry crosses an engine boundary in a neutral representation, such as a vertex and index array or well-known binary, rather than as engine-specific objects. That keeps the boundary explicit and each engine replaceable.

</details>

---

## Related Pages

- [Interoperability Decision Guides](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/) — the section framing library, format and storage decisions
- [Geometry Mesh Conversion](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/) — the mesh workflows a chosen engine has to serve
- [Choosing ezdxf, pydwg, or ODA for Production](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-ezdxf-pydwg-or-oda-for-production/) — the read-route decision that precedes this one
- [ifcopenshell Workflow](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/) — where a B-rep kernel is already in the dependency tree
- [Triangulating CAD Polygons with Earcut in Python](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/triangulating-cad-polygons-with-earcut-in-python/) — the narrow, dependency-free alternative to a general engine
