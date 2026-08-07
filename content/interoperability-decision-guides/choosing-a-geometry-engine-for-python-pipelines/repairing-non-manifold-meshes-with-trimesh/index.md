---
title: "Repairing Non-Manifold Meshes with trimesh"
description: "Diagnose and repair CAD-derived meshes in Python with trimesh: choosing a merge tolerance, fixing winding and normals, filling holes, and knowing when a mesh is beyond repair rather than nearly fixed."
slug: "repairing-non-manifold-meshes-with-trimesh"
breadcrumb:
  - label: "Interoperability Decision Guides"
    url: "/interoperability-decision-guides/"
  - label: "Choosing a Geometry Engine for Python Pipelines"
    url: "/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/"
  - label: "Repairing Non-Manifold Meshes with trimesh"
    url: "/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/repairing-non-manifold-meshes-with-trimesh/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Repairing Non-Manifold Meshes with trimesh",
      "description": "Diagnose and repair CAD-derived meshes in Python with trimesh: choosing a merge tolerance, fixing winding and normals, filling holes, and knowing when a mesh is beyond repair rather than nearly fixed.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/repairing-non-manifold-meshes-with-trimesh/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Interoperability Decision Guides", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/"},
        {"@type": "ListItem", "position": 2, "name": "Choosing a Geometry Engine for Python Pipelines", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/"},
        {"@type": "ListItem", "position": 3, "name": "Repairing Non-Manifold Meshes with trimesh", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/repairing-non-manifold-meshes-with-trimesh/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Repair a non-manifold CAD-derived mesh with trimesh",
      "description": "Diagnose what is actually wrong, merge vertices at a justified tolerance, fix winding and normals, fill remaining holes, and verify with volume and watertightness.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Diagnose before repairing", "text": "Record watertightness, winding consistency, the count of boundary edges and the volume sign so the repair can be checked against a known starting point."},
        {"@type": "HowToStep", "position": 2, "name": "Merge vertices at a justified tolerance", "text": "Choose a merge distance larger than the numerical noise and smaller than the shortest real edge, and record it."},
        {"@type": "HowToStep", "position": 3, "name": "Fix winding and normals", "text": "Make face winding consistent and orient the normals outward before any volume-based check is meaningful."},
        {"@type": "HowToStep", "position": 4, "name": "Fill the remaining holes", "text": "Fill only what remains after merging, because holes that were really duplicate vertices should not be filled with new geometry."},
        {"@type": "HowToStep", "position": 5, "name": "Verify against the diagnosis", "text": "Confirm watertightness, a positive volume and a plausible volume magnitude before accepting the repair."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What merge tolerance should I use?",
          "acceptedAnswer": {"@type": "Answer", "text": "Larger than the numerical noise in the source and smaller than the shortest edge you need to keep. A CAD export in metres typically has noise around 1e-9 and edges no shorter than a millimetre, which leaves a wide safe range — 1e-6 to 1e-5 metres is usual. Too tight leaves duplicate vertices and the mesh never closes; too loose collapses short edges into degenerate faces."}
        },
        {
          "@type": "Question",
          "name": "Why is my volume negative?",
          "acceptedAnswer": {"@type": "Answer", "text": "Inverted normals. Volume is computed from the signed contributions of the faces, so a consistently inward-facing mesh reports the negative of its true volume. Fix the winding and orient the normals outward first; a negative volume is a normals diagnosis rather than a geometry one."}
        },
        {
          "@type": "Question",
          "name": "When should I give up on a repair?",
          "acceptedAnswer": {"@type": "Answer", "text": "When filling holes would invent geometry rather than close gaps. A mesh missing whole faces — a solid exported without its underside, say — can be made watertight by a hole filler, and the result is a confident fabrication. Set a limit on the total area filled relative to the surface area, and reject beyond it."}
        }
      ]
    }
  ]
}
</script>

# Repairing Non-Manifold Meshes with trimesh

A CAD-derived mesh is usually broken in one of three specific ways — duplicate vertices leaving hairline gaps, inconsistent face winding, or genuinely missing faces — and the repair differs for each. Diagnose first, merge at a tolerance you can justify, fix winding before checking volume, and fill holes last and sparingly. This page belongs to [Choosing a Geometry Engine for Python Pipelines](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/).

## Three Different Faults With One Symptom

`is_watertight` returning `False` is the symptom, and it has distinct causes that call for different repairs.

<!-- fig:tm-three-faults -->
<svg viewBox="-20 -20 449.8 184.1" role="img" aria-label="Duplicate vertices, inconsistent winding and missing faces all report as not watertight and need different repairs" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:450px;display:block;margin:1.5rem auto;">
  <title>One symptom, three faults, three repairs</title>
  <desc>Three reasons a mesh reports as not watertight, the signature that distinguishes each, and the repair it needs. They call for different actions and the order matters: filling holes before merging closes gaps that a merge would have removed, adding geometry the source never lacked.</desc>
  <defs>
    <marker id="tm1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="tm1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="449.8" height="184.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="409.8" height="122" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="409.8" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">Fault</text>
  <text x="209.5" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Signature</text>
  <line x1="291.3" y1="0" x2="291.3" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="350.5" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Repair</text>
  <line x1="127.8" y1="0" x2="127.8" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="409.8" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">Duplicate vertices</text>
  <text x="209.5" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">every edge is a boundary edge</text>
  <text x="350.5" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">merge at a tolerance</text>
  <line x1="0" y1="62" x2="409.8" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">Inconsistent winding</text>
  <text x="209.5" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">closed but volume is negative</text>
  <text x="350.5" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">fix normals</text>
  <line x1="0" y1="92" x2="409.8" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">Missing faces</text>
  <text x="209.5" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">merging changes nothing</text>
  <text x="350.5" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">fill — or reject</text>
  <text x="0" y="142" font-size="9.5" fill="currentColor" fill-opacity="0.7">Merge, orient, then fill. The other orders invent geometry.</text>
</svg>
<!-- /fig:tm-three-faults -->

**Duplicate vertices.** Every face carries its own copy of each corner, and copies that differ in the last few decimal places do not merge. The mesh has no gaps in any visual sense, and every edge is a boundary edge because no two faces share a vertex index. This is the dominant fault in anything derived from a face-soup format such as `3DFACE`, and merging fixes it completely.

**Inconsistent winding.** Faces share vertices correctly but disagree about which side is out. The mesh may be topologically closed and still report a negative or nonsensical volume, and any operation depending on inside-versus-outside is unreliable. This is a normals fix, not a topology fix.

**Missing faces.** The source genuinely does not contain part of the surface. No amount of merging closes it, and a hole filler will close it by inventing geometry — which is sometimes right and always worth knowing about.

Doing them in the wrong order wastes effort: filling holes before merging fills gaps that were never really there, adding faces that a merge would have made unnecessary.

## Production-Ready Script

{% raw %}
```python
# trimesh>=4.0, numpy>=1.24, Python 3.9+
from __future__ import annotations

from dataclasses import dataclass, asdict
import numpy as np
import trimesh


@dataclass(frozen=True)
class MeshDiagnosis:
    vertices: int
    faces: int
    watertight: bool
    winding_consistent: bool
    boundary_edges: int
    volume: float

    @property
    def duplicate_vertex_suspected(self) -> bool:
        # Every edge a boundary edge is the signature of an unmerged face soup.
        return self.boundary_edges > 0 and not self.watertight


def diagnose(mesh: trimesh.Trimesh) -> MeshDiagnosis:
    edges = mesh.edges_sorted
    _, counts = np.unique(edges, axis=0, return_counts=True)
    return MeshDiagnosis(
        vertices=len(mesh.vertices),
        faces=len(mesh.faces),
        watertight=bool(mesh.is_watertight),
        winding_consistent=bool(mesh.is_winding_consistent),
        boundary_edges=int((counts == 1).sum()),
        volume=float(mesh.volume) if mesh.is_watertight else float("nan"),
    )


def repair(
    mesh: trimesh.Trimesh,
    *,
    merge_tol: float = 1e-6,
    max_filled_area_ratio: float = 0.02,
) -> tuple[trimesh.Trimesh, dict]:
    """Merge, orient, then fill — in that order — and report what each stage did."""
    before = diagnose(mesh)
    work = mesh.copy()

    work.merge_vertices(merge_tex=False, merge_norm=False, digits_vertex=None)
    trimesh.constants.tol.merge = merge_tol
    work.remove_duplicate_faces()
    work.remove_degenerate_faces()
    after_merge = diagnose(work)

    work.fix_normals()                      # consistent winding, outward orientation
    after_orient = diagnose(work)

    area_before = float(work.area)
    if not work.is_watertight:
        trimesh.repair.fill_holes(work)
    filled_ratio = (float(work.area) - area_before) / area_before if area_before else 0.0
    if filled_ratio > max_filled_area_ratio:
        raise ValueError(
            f"hole filling added {filled_ratio:.1%} of the surface area — "
            "the source is missing faces, not merely unmerged"
        )

    final = diagnose(work)
    if not final.watertight:
        raise ValueError("mesh is still not watertight after merge, orient and fill")
    if final.volume <= 0:
        raise ValueError(f"volume is {final.volume:.6g} — normals are still inverted")

    return work, {
        "before": asdict(before),
        "after_merge": asdict(after_merge),
        "after_orient": asdict(after_orient),
        "final": asdict(final),
        "merge_tol": merge_tol,
        "filled_area_ratio": filled_ratio,
    }


if __name__ == "__main__":
    mesh = trimesh.load("model.obj", process=False)   # process=False: diagnose the ORIGINAL
    fixed, report = repair(mesh)
    print(report["before"]["boundary_edges"], "->", report["final"]["boundary_edges"])
```
{% endraw %}

<!-- fig:tm-tolerance-window -->
<svg viewBox="-20 -20 524.6 154.1" role="img" aria-label="A merge tolerance must exceed the numerical noise and stay below the shortest real edge" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:525px;display:block;margin:1.5rem auto;">
  <title>The window a merge tolerance has to sit in</title>
  <desc>Three lengths on the same scale for a typical CAD export in metres. The numerical noise left by the authoring application sets the floor, and the shortest edge that must survive sets the ceiling. Any tolerance between them merges duplicates without collapsing real geometry, which is a wide and comfortable window once the two bounds are known.</desc>
  <defs>
    <marker id="tm2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="tm2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="524.6" height="154.1" fill="var(--color-surface)"/>
  <text x="130.2" y="11.5" text-anchor="end" font-size="10.5" fill="currentColor" fill-opacity="0.9">numerical noise (floor)</text>
  <rect x="140.2" y="0" width="2" height="16" rx="3" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <text x="150.2" y="11.5" font-size="10" fill="currentColor" fill-opacity="0.85">0 m</text>
  <text x="130.2" y="41.5" text-anchor="end" font-size="10.5" fill="currentColor" fill-opacity="0.9">typical tolerance</text>
  <rect x="140.2" y="30" width="2" height="16" rx="3" fill="currentColor" fill-opacity="0.42" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.9"/>
  <text x="150.2" y="41.5" font-size="10" font-weight="600" fill="currentColor" fill-opacity="0.85">0 m</text>
  <text x="130.2" y="71.5" text-anchor="end" font-size="10.5" fill="currentColor" fill-opacity="0.9">shortest real edge (ceiling)</text>
  <rect x="140.2" y="60" width="300" height="16" rx="3" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <text x="448.2" y="71.5" font-size="10" fill="currentColor" fill-opacity="0.85">0.001 m</text>
  <line x1="140.2" y1="78" x2="440.2" y2="78" stroke="currentColor" stroke-width="1" stroke-opacity="0.35"/>
  <text x="140.2" y="93" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.6">0</text>
  <text x="440.2" y="93" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.6">0.001</text>
  <text x="0" y="112" font-size="9.5" fill="currentColor" fill-opacity="0.7">Below the floor nothing merges; above the ceiling real edges collapse into degenerate faces.</text>
</svg>
<!-- /fig:tm-tolerance-window -->

**Key implementation notes:**

- `process=False` on load is important when diagnosing. The default processing merges vertices on import, which repairs the fault before you can measure it.
- The stages run in order — merge, orient, fill — and each is diagnosed, so the report says which stage actually fixed the mesh.
- The filled-area ratio is a guard against confident fabrication. A mesh that needs 20% of its area invented was not broken, it was incomplete.
- Volume is only meaningful once the mesh is watertight and oriented, which is why it is checked last.
- The merge tolerance is a parameter and it is recorded in the report. A repair whose tolerance is unknown is not reproducible.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `trimesh` | `>=4.0` | `repair.fill_holes`, `fix_normals` |
| `numpy` | `>=1.24` | edge counting |
| Input formats | OBJ, STL, PLY, glTF | load with `process=False` to diagnose faithfully |
| Boolean backend | optional | not required by this repair |
| Coordinate range | shifted to a local origin | large coordinates degrade the merge |

## Fallback Strategies

**1. Still not watertight after merging.** Either the tolerance is too tight for the source noise, or faces are genuinely missing. Raise the tolerance by an order of magnitude once; if the boundary edge count barely moves, it is missing faces.

<!-- fig:tm-fill-guard -->
<svg viewBox="-20 -20 313.1 216.2" role="img" aria-label="Filling a small area is repair; filling a large area fabricates geometry the source never contained" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>The guard between a repair and a fabrication</title>
  <desc>A branch on how much surface area hole filling added. A small addition closes the gaps a merge could not, which is repair. A large one means the source was missing whole faces, and closing it produces a confident invention — a watertight solid whose underside was never modelled. The threshold turns that distinction into a rule.</desc>
  <defs>
    <marker id="tm3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="tm3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="313.1" height="216.2" fill="var(--color-surface)"/>
  <polygon points="136.6,0 233.1,31 136.6,62 40,31" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-width="1.6"/>
  <text x="136.6" y="35" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">Area added by hole filling?</text>
  <rect x="0" y="128" width="122.6" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="61.3" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Repair</text>
  <text x="61.3" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">accept</text>
  <path d="M 136.6 62 L 136.6 92 L 61.3 92 L 61.3 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#tm3-a)" stroke-linejoin="round"/>
  <text x="61.3" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">under 2%</text>
  <rect x="150.6" y="128" width="122.6" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="211.8" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Fabrication</text>
  <text x="211.8" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">reject, fix the source</text>
  <path d="M 136.6 62 L 136.6 92 L 211.8 92 L 211.8 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#tm3-a)" stroke-linejoin="round"/>
  <text x="211.8" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">over 2%</text>
</svg>
<!-- /fig:tm-fill-guard -->

**2. Merging collapsed real edges.** The tolerance exceeded the shortest genuine edge, producing degenerate faces. Reduce it and re-run from the original mesh rather than from the damaged one.

**3. Volume is negative after `fix_normals`.** The mesh has separate components with opposing orientation — common when several solids were exported into one file. Split into connected components, repair each, and recombine.

**4. Fill added far too much area.** Reject, as the script does. Go back to the source: a solid exported without its underside is an export configuration problem, not a mesh problem.

**5. Repair succeeds but downstream still complains.** Tolerance is per engine and the engines do not agree. Re-validate on the receiving side rather than trusting this verdict, as the parent page describes.

## FAQ

<details>
<summary><strong>What merge tolerance should I use?</strong></summary>

Larger than the numerical noise in the source and smaller than the shortest edge you need to keep. A CAD export in metres typically has noise around 1e-9 and edges no shorter than a millimetre, which leaves a wide safe range — 1e-6 to 1e-5 metres is usual. Too tight leaves duplicate vertices and the mesh never closes; too loose collapses short edges into degenerate faces.

</details>

<details>
<summary><strong>Why is my volume negative?</strong></summary>

Inverted normals. Volume is computed from the signed contributions of the faces, so a consistently inward-facing mesh reports the negative of its true volume. Fix the winding and orient the normals outward first; a negative volume is a normals diagnosis rather than a geometry one.

</details>

<details>
<summary><strong>When should I give up on a repair?</strong></summary>

When filling holes would invent geometry rather than close gaps. A mesh missing whole faces — a solid exported without its underside, say — can be made watertight by a hole filler, and the result is a confident fabrication. Set a limit on the total area filled relative to the surface area, and reject beyond it.

</details>

---

## Related Pages

- [Choosing a Geometry Engine for Python Pipelines](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/) — parent reference on which engine answers which question
- [Converting 3DFACE Entities to OBJ Meshes](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/converting-3dface-entities-to-obj-meshes/) — the welding problem this repair continues
- [Geometry Mesh Conversion](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/) — the stage-boundary assertions a repaired mesh must satisfy
