---
title: "Evaluating B-Rep Solids with OpenCASCADE in Python"
description: "Work with boundary-representation solids in Python through pythonocc: checking a shape before using it, tessellating to a controlled deflection, running a solid boolean, and detecting the null shapes the kernel returns on failure."
slug: "evaluating-brep-solids-with-opencascade-in-python"
breadcrumb:
  - label: "Interoperability Decision Guides"
    url: "/interoperability-decision-guides/"
  - label: "Choosing a Geometry Engine for Python Pipelines"
    url: "/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/"
  - label: "Evaluating B-Rep Solids with OpenCASCADE in Python"
    url: "/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/evaluating-brep-solids-with-opencascade-in-python/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Evaluating B-Rep Solids with OpenCASCADE in Python",
      "description": "Work with boundary-representation solids in Python through pythonocc: checking a shape before using it, tessellating to a controlled deflection, running a solid boolean, and detecting the null shapes the kernel returns on failure.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/evaluating-brep-solids-with-opencascade-in-python/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Interoperability Decision Guides", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/"},
        {"@type": "ListItem", "position": 2, "name": "Choosing a Geometry Engine for Python Pipelines", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/"},
        {"@type": "ListItem", "position": 3, "name": "Evaluating B-Rep Solids with OpenCASCADE in Python", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/evaluating-brep-solids-with-opencascade-in-python/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Evaluate a B-rep solid with OpenCASCADE from Python",
      "description": "Validate the shape, run the boolean, check for a null or invalid result, tessellate at a chosen deflection, and extract the triangulation.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Check the shape before using it", "text": "Run the kernel analyser on the input and reject invalid shapes rather than passing them to an operation that assumes validity."},
        {"@type": "HowToStep", "position": 2, "name": "Run the boolean", "text": "Perform the cut, fuse or common operation through the kernel algorithm rather than on a triangulated approximation."},
        {"@type": "HowToStep", "position": 3, "name": "Detect null and invalid results", "text": "Test the result for nullity and validity, since the kernel signals failure by returning an empty shape as often as by raising."},
        {"@type": "HowToStep", "position": 4, "name": "Tessellate at a controlled deflection", "text": "Mesh the shape with an explicit linear deflection so the vertex count and the surface error are both known."},
        {"@type": "HowToStep", "position": 5, "name": "Extract the triangulation", "text": "Walk the faces and read the triangulation into vertex and index arrays for the rest of the pipeline."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How does OpenCASCADE signal that an operation failed?",
          "acceptedAnswer": {"@type": "Answer", "text": "Inconsistently, which is the practical problem. It may raise, it may return a null shape, or it may return a shape that is topologically invalid. Code that assumes a result and reads its faces gets zero faces from a null shape, and that flows onward as an element with no geometry. Test the result for nullity and run the analyser on it before using it."}
        },
        {
          "@type": "Question",
          "name": "What does the linear deflection actually control?",
          "acceptedAnswer": {"@type": "Answer", "text": "The maximum distance between the tessellated surface and the true surface — the same idea as a sag tolerance on a curve, applied to a face. It trades vertex count against fidelity, and it is in model units, so a value chosen for a model in metres is a thousand times tighter on the same model in millimetres."}
        },
        {
          "@type": "Question",
          "name": "Do I need OpenCASCADE if I already use ifcopenshell?",
          "acceptedAnswer": {"@type": "Answer", "text": "You already have it — the geometry kernel behind ifcopenshell is OpenCASCADE. What you may not have is direct access to it. If your pipeline only consumes the triangulated output ifcopenshell produces, the kernel work is already done and reaching for the kernel directly adds nothing. Use it directly when you need exact solids rather than meshes."}
        }
      ]
    }
  ]
}
</script>

# Evaluating B-Rep Solids with OpenCASCADE in Python

A boundary-representation kernel models exact curved surfaces and performs boolean operations on solids without triangulating first, which is what makes it necessary for exact solid work and expensive for everything else. Check the shape, run the operation, test the result for nullity as well as for exceptions, then tessellate at a deflection you chose. This page belongs to [Choosing a Geometry Engine for Python Pipelines](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/).

## What a Kernel Does Differently

A mesh library approximates a cylinder with triangles and then computes on the triangles. A kernel keeps the cylinder as a cylinder — a surface with an axis and a radius — and computes intersections analytically. The difference shows up in three places.

<!-- fig:occ-exact-vs-mesh -->
<svg viewBox="-20 -20 578 194.1" role="img" aria-label="A B-rep kernel keeps a cylinder exact; a mesh library approximates it and compounds the approximation" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:578px;display:block;margin:1.5rem auto;">
  <title>What the kernel keeps that a mesh library discards</title>
  <desc>Two representations of the same cylindrical wall. The kernel holds it as a surface with an axis and a radius, so a cut through it produces a true circular edge that can be cut again without accumulating error. A mesh library holds an approximation, so every operation compounds the approximation already made.</desc>
  <defs>
    <marker id="oc1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="oc1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="578" height="194.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="254" height="130" rx="6" fill="currentColor" fill-opacity="0.11" stroke="currentColor" stroke-width="1.9"/>
  <text x="127" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">B-rep kernel</text>
  <line x1="14" y1="33" x2="240" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="16" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— cylinder stays a cylinder</text>
  <text x="16" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— exact circular cut edges</text>
  <text x="16" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— cuttable again without drift</text>
  <text x="16" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— fails rather than approximates</text>
  <rect x="284" y="0" width="254" height="130" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="411" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Mesh library</text>
  <line x1="298" y1="33" x2="524" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="300" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— triangulated up front</text>
  <text x="300" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— polygonal cut edges</text>
  <text x="300" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— error compounds per operation</text>
  <text x="300" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— nearly always returns something</text>
  <text x="269" y="152" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">Exactness is worth its deployment weight only when operations chain.</text>
</svg>
<!-- /fig:occ-exact-vs-mesh -->

**Exactness.** A cut through a cylindrical wall produces a true circular edge rather than a polygonal approximation of one, so the result can be cut again without accumulating approximation error.

**Failure behaviour.** A mesh boolean nearly always returns something; a kernel boolean returns an exact answer or fails. In an automated pipeline that is usually preferable, because a wrong-but-plausible mesh is harder to detect than a null result. The complication is that the kernel's failure signalling is not uniform: it raises sometimes and returns a null or invalid shape other times, so both have to be checked.

**Tessellation as a separate, controlled step.** Because the kernel holds exact surfaces, meshing is something you ask for with an explicit tolerance rather than something you inherit. The linear deflection is in model units and behaves exactly like the sag tolerance described in [Tessellating SPLINE Entities with ezdxf](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/tessellating-splines-with-ezdxf-in-python/).

## Production-Ready Script

{% raw %}
```python
# pythonocc-core>=7.7, numpy>=1.24, Python 3.9+
from __future__ import annotations

from dataclasses import dataclass
import numpy as np

from OCC.Core.BRepAlgoAPI import BRepAlgoAPI_Cut, BRepAlgoAPI_Fuse
from OCC.Core.BRepCheck import BRepCheck_Analyzer
from OCC.Core.BRepMesh import BRepMesh_IncrementalMesh
from OCC.Core.BRep import BRep_Tool
from OCC.Core.TopAbs import TopAbs_FACE
from OCC.Core.TopExp import TopExp_Explorer
from OCC.Core.TopLoc import TopLoc_Location
from OCC.Core.TopoDS import topods


class KernelError(RuntimeError):
    pass


@dataclass(frozen=True)
class Tessellation:
    vertices: np.ndarray      # (n, 3)
    faces: np.ndarray         # (m, 3) indices
    deflection: float


def require_valid(shape, what: str):
    """The kernel does not check its inputs — so we do."""
    if shape is None or shape.IsNull():
        raise KernelError(f"{what} is a null shape")
    if not BRepCheck_Analyzer(shape).IsValid():
        raise KernelError(f"{what} is topologically invalid")
    return shape


def cut(solid, tool):
    """Solid subtraction with the post-conditions the kernel will not assert."""
    require_valid(solid, "solid")
    require_valid(tool, "tool")
    algo = BRepAlgoAPI_Cut(solid, tool)
    algo.Build()
    if not algo.IsDone():
        raise KernelError("cut did not complete")
    return require_valid(algo.Shape(), "cut result")


def fuse(a, b):
    require_valid(a, "a")
    require_valid(b, "b")
    algo = BRepAlgoAPI_Fuse(a, b)
    algo.Build()
    if not algo.IsDone():
        raise KernelError("fuse did not complete")
    return require_valid(algo.Shape(), "fuse result")


def tessellate(shape, deflection: float = 0.01, angular: float = 0.5) -> Tessellation:
    """Mesh at an explicit linear deflection, in MODEL UNITS."""
    require_valid(shape, "shape to tessellate")
    BRepMesh_IncrementalMesh(shape, deflection, False, angular, True)

    verts: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int]] = []
    explorer = TopExp_Explorer(shape, TopAbs_FACE)
    while explorer.More():
        face = topods.Face(explorer.Current())
        location = TopLoc_Location()
        triangulation = BRep_Tool.Triangulation(face, location)
        if triangulation is None:
            explorer.Next()
            continue                       # a face the mesher could not handle
        transform = location.Transformation()
        base = len(verts)
        for i in range(1, triangulation.NbNodes() + 1):
            p = triangulation.Node(i).Transformed(transform)
            verts.append((p.X(), p.Y(), p.Z()))
        for i in range(1, triangulation.NbTriangles() + 1):
            a, b, c = triangulation.Triangle(i).Get()
            faces.append((base + a - 1, base + b - 1, base + c - 1))
        explorer.Next()

    if not faces:
        raise KernelError("tessellation produced no triangles")
    return Tessellation(np.array(verts, dtype=float),
                        np.array(faces, dtype=np.int32), deflection)
```
{% endraw %}

<!-- fig:occ-check-both-ends -->
<svg viewBox="-45 -20 454.8 310.8" role="img" aria-label="Validate both inputs, run the operation, check completion, then validate the result before using it" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:455px;display:block;margin:1.5rem auto;">
  <title>Checking the inputs and the result</title>
  <desc>Four stages around one operation. Both inputs are analysed before the operation, because the kernel does not check them. The algorithm is asked whether it completed. The result is tested for nullity and analysed again, because an algorithm can report completion and return an invalid or empty shape. Only then is the result usable.</desc>
  <defs>
    <marker id="oc2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="oc2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-45" y="-20" width="454.8" height="310.8" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="258" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="129" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Validate the inputs</text>
  <text x="129" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">the kernel will not</text>
  <circle cx="-14" cy="24.1" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="27.6" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">1</text>
  <text x="276" y="27.6" font-size="9.5" fill="currentColor" fill-opacity="0.75">null and topology checks</text>
  <rect x="0" y="74.2" width="258" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="129" y="94.5" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Run the algorithm</text>
  <text x="129" y="108.2" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">cut, fuse, common</text>
  <circle cx="-14" cy="98.3" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="101.8" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">2</text>
  <text x="276" y="101.8" font-size="9.5" fill="currentColor" fill-opacity="0.75">may raise</text>
  <rect x="0" y="148.4" width="258" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="129" y="168.7" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Check completion</text>
  <text x="129" y="182.4" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">IsDone()</text>
  <circle cx="-14" cy="172.5" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="176" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">3</text>
  <text x="276" y="176" font-size="9.5" fill="currentColor" fill-opacity="0.75">separate from nullity</text>
  <rect x="0" y="222.6" width="258" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="129" y="242.9" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Validate the result</text>
  <text x="129" y="256.6" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">null? invalid?</text>
  <circle cx="-14" cy="246.7" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="250.2" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">4</text>
  <text x="276" y="250.2" font-size="9.5" fill="currentColor" fill-opacity="0.75">completion is not success</text>
  <line x1="129" y1="48.2" x2="129" y2="74.2" stroke="currentColor" stroke-width="1.4" marker-end="url(#oc2-a)"/>
  <line x1="129" y1="122.4" x2="129" y2="148.4" stroke="currentColor" stroke-width="1.4" marker-end="url(#oc2-a)"/>
  <line x1="129" y1="196.6" x2="129" y2="222.6" stroke="currentColor" stroke-width="1.4" marker-end="url(#oc2-a)"/>
</svg>
<!-- /fig:occ-check-both-ends -->

**Key implementation notes:**

- `require_valid` is applied to inputs *and* to results. Checking only the inputs misses the failure mode where the operation completes and returns something invalid.
- `IsDone` and nullity are separate checks. An algorithm can report completion and return a null shape.
- Faces whose triangulation is absent are skipped and would be worth counting; a shape where most faces skip has tessellated in name only.
- Vertex indices are rebased per face because each face carries its own node numbering. Getting this wrong produces a mesh whose triangles reference the wrong vertices — visually chaotic, and a common first bug.
- The deflection is recorded on the result, because a mesh without its tolerance cannot be compared with another one.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `pythonocc-core` | `>=7.7` | `Triangulation` node API changed in 7.x |
| OpenCASCADE | 7.6+ | bundled with the wheel |
| `numpy` | `>=1.24` | array assembly |
| Deployment | large image | hundreds of megabytes; measure cold start |
| Thread safety | not guaranteed | parallelise across processes, not threads |

## Fallback Strategies

**1. A boolean returns a null shape.** Validate both inputs first; the usual cause is an invalid solid the kernel accepted. Where the inputs are valid, try healing the shape before the operation rather than repeating it.

<!-- fig:occ-deflection -->
<svg viewBox="-20 -20 351.2 184.1" role="img" aria-label="A fixed linear deflection value gives wildly different real tolerances depending on the model unit" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>Linear deflection is in model units</title>
  <desc>The same deflection value applied to models authored in three different units, with the real-world tolerance each produces. The value is a distance in the model coordinate system, so a constant chosen for a model in metres is a thousand times tighter on the same geometry in millimetres — and produces a thousandfold triangle count.</desc>
  <defs>
    <marker id="oc3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="oc3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="351.2" height="184.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="279.6" height="122" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="279.6" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">Model unit</text>
  <text x="133.6" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">deflection 0.01</text>
  <line x1="182.6" y1="0" x2="182.6" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="231.1" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Triangle count</text>
  <line x1="84.7" y1="0" x2="84.7" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="279.6" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">metres</text>
  <text x="133.6" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">10 mm</text>
  <text x="231.1" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">reasonable</text>
  <line x1="0" y1="62" x2="279.6" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">centimetres</text>
  <text x="133.6" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">0.1 mm</text>
  <text x="231.1" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">high</text>
  <line x1="0" y1="92" x2="279.6" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">millimetres</text>
  <text x="133.6" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">0.01 mm</text>
  <text x="231.1" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">unusable</text>
  <text x="0" y="142" font-size="9.5" fill="currentColor" fill-opacity="0.7">Derive the deflection from the resolved model unit, never as a constant.</text>
</svg>
<!-- /fig:occ-deflection -->

**2. Tessellation produces very few triangles.** The deflection is large relative to the model units — a value chosen for metres applied to a model in millimetres. Derive it from the resolved model unit rather than hard-coding it.

**3. Tessellation is enormous.** The converse. Cap the resulting triangle count and re-mesh at a coarser deflection when the cap is exceeded, so one pathological face cannot produce a million triangles.

**4. Faces missing from the mesh.** Some faces failed to triangulate. Count them; a handful on a complex shape is normal, a majority means the shape needs healing.

**5. Intermittent failures under parallelism.** The kernel is not reliably thread-safe. Use a process pool rather than threads.

## FAQ

<details>
<summary><strong>How does OpenCASCADE signal that an operation failed?</strong></summary>

Inconsistently, which is the practical problem. It may raise, it may return a null shape, or it may return a shape that is topologically invalid. Code that assumes a result and reads its faces gets zero faces from a null shape, and that flows onward as an element with no geometry. Test the result for nullity and run the analyser on it before using it.

</details>

<details>
<summary><strong>What does the linear deflection actually control?</strong></summary>

The maximum distance between the tessellated surface and the true surface — the same idea as a sag tolerance on a curve, applied to a face. It trades vertex count against fidelity, and it is in model units, so a value chosen for a model in metres is a thousand times tighter on the same model in millimetres.

</details>

<details>
<summary><strong>Do I need OpenCASCADE if I already use ifcopenshell?</strong></summary>

You already have it — the geometry kernel behind ifcopenshell is OpenCASCADE. What you may not have is direct access to it. If your pipeline only consumes the triangulated output ifcopenshell produces, the kernel work is already done and reaching for the kernel directly adds nothing. Use it directly when you need exact solids rather than meshes.

</details>

---

## Related Pages

- [Choosing a Geometry Engine for Python Pipelines](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/) — parent reference on when a kernel is worth its deployment weight
- [ifcopenshell Workflow](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/) — the library that already wraps this kernel for IFC
- [Reading 3D Solids with ezdxf Python](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/reading-3d-solids-with-ezdxf-python/) — where a DXF solid payload stops and a kernel would have to start
