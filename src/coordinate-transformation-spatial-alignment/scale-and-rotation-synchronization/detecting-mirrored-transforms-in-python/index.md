---
title: "Detecting Mirrored Transforms in Python"
description: "A reflection fits control points as well as a rotation does. Detect it with the determinant, repair the SVD solve, and assert handedness before you apply it."
slug: "detecting-mirrored-transforms-in-python"
breadcrumb:
  - label: "Coordinate Transformation & Spatial Alignment"
    url: "/coordinate-transformation-spatial-alignment/"
  - label: "Scale and Rotation Synchronization"
    url: "/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/"
  - label: "Detecting Mirrored Transforms in Python"
    url: "/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/detecting-mirrored-transforms-in-python/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Detecting Mirrored Transforms in Python",
      "description": "A reflection fits control points as well as a rotation does. Detect it with the determinant, repair the SVD solve, and assert handedness before you apply it.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/detecting-mirrored-transforms-in-python/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Coordinate Transformation & Spatial Alignment", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/"},
        {"@type": "ListItem", "position": 2, "name": "Scale and Rotation Synchronization", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/"},
        {"@type": "ListItem", "position": 3, "name": "Detecting Mirrored Transforms in Python", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/detecting-mirrored-transforms-in-python/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Detect and repair a mirrored transform",
      "description": "Compute the determinant of the rotation block, repair the SVD solve when it is negative, and assert handedness before the transform is applied.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Compute the determinant", "text": "Take the determinant of the rotation block, which is positive one for a rotation and negative one for a reflection."},
        {"@type": "HowToStep", "position": 2, "name": "Repair inside the solve", "text": "Negate the last column of the right singular vectors and recompute, rather than flipping an axis afterwards."},
        {"@type": "HowToStep", "position": 3, "name": "Assert handedness on the result", "text": "Check the determinant again after the repair and fail rather than warn if it is still negative."},
        {"@type": "HowToStep", "position": 4, "name": "Verify with an asymmetric feature", "text": "Confirm against a feature whose mirror image is distinguishable, since symmetric control layouts cannot reveal a reflection."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How does a reflection get into a solve at all?",
          "acceptedAnswer": {"@type": "Answer", "text": "From the singular value decomposition. The product of the singular vector matrices is orthogonal, which means its determinant is plus or minus one — a rotation or a reflection. Nothing in the decomposition constrains it to the former, so with certain point configurations, particularly near-planar ones in a 3D solve, the naive product comes out as a reflection."}
        },
        {
          "@type": "Question",
          "name": "Why do the residuals not reveal it?",
          "acceptedAnswer": {"@type": "Answer", "text": "Because a reflection can fit the control points exactly. If the points are symmetric about the mirror plane, or nearly so, the reflected transform maps them onto their targets just as well as the rotation would. The residual measures distance to the targets, and the reflection achieves the same distances — so it reports success."}
        },
        {
          "@type": "Question",
          "name": "Can I just flip a coordinate afterwards?",
          "acceptedAnswer": {"@type": "Answer", "text": "No. Negating an axis on the output produces a different transform from the correct one unless the mirror plane happens to be that axis plane. Repair it inside the decomposition by negating the last column of the right singular vectors and recomputing, which yields the best proper rotation for the same correspondences."}
        }
      ]
    }
  ]
}
</script>

# Detecting Mirrored Transforms in Python

A reflection satisfies a least-squares control-point fit as well as a rotation does, so residuals will not find it. The determinant will: it is exactly plus one for a rotation and exactly minus one for a reflection. Check it, repair the fault inside the singular value decomposition rather than by flipping an axis afterwards, and assert handedness before the transform touches production geometry. This page is part of [Scale and Rotation Synchronization](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/).

## Where the Reflection Comes From

The standard solve forms the cross-covariance matrix of the two centred point sets, decomposes it, and takes the product of the singular vector matrices as the rotation. That product is orthogonal — its columns are unit length and mutually perpendicular — which is necessary for a rotation and not sufficient. An orthogonal matrix has determinant plus or minus one, and only the positive case is a rotation. The negative case is a reflection: a transform that preserves every distance and reverses handedness.

<!-- fig:mir-determinant -->
<svg viewBox="-20 -20 414 156.1" role="img" aria-label="Orthogonality admits both rotations and reflections; the determinant separates them at plus or minus one" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>The one number that separates a rotation from a reflection</title>
  <desc>Three properties of the matrix the decomposition returns. Orthogonality is guaranteed and is not enough: it admits both rotations and reflections. The determinant separates them exactly, and it is a single cheap computation. Distances are preserved either way, which is why every distance-based statistic reports success.</desc>
  <defs>
    <marker id="mr1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="mr1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="414" height="156.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="172.9" height="92" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.5"/>
  <text x="14" y="16" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">Rᵀ R  =  I</text>
  <line x1="178.9" y1="12.9" x2="210.9" y2="12.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="218.9" y="16" font-size="9.5" fill="currentColor" fill-opacity="0.78">orthogonal — true of both</text>
  <text x="14" y="35" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">det(R)  =  +1</text>
  <line x1="178.9" y1="31.9" x2="210.9" y2="31.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="218.9" y="35" font-size="9.5" fill="currentColor" fill-opacity="0.78">a proper rotation</text>
  <text x="14" y="54" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">det(R)  =  −1</text>
  <line x1="178.9" y1="50.9" x2="210.9" y2="50.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="218.9" y="54" font-size="9.5" fill="currentColor" fill-opacity="0.78">a reflection — handedness reversed</text>
  <text x="14" y="73" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">‖Rx − Ry‖  =  ‖x − y‖</text>
  <line x1="178.9" y1="69.9" x2="210.9" y2="69.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="218.9" y="73" font-size="9.5" fill="currentColor" fill-opacity="0.78">distances preserved either way</text>
  <text x="0" y="114" font-size="9.5" fill="currentColor" fill-opacity="0.7">The last line is why residuals never find it.</text>
</svg>
<!-- /fig:mir-determinant -->

Configurations that provoke it are common in this domain. Control points along a road, points on a single building facade, or any near-planar layout in a three-dimensional solve leave the out-of-plane direction poorly determined, and the decomposition is free to resolve it either way.

The consequence in a model is that everything is the right size and in the right place, and left is right. A staircase turns the wrong way, a road crosses to the wrong side, and a text label reads backwards — findings that are obvious in a rendering and invisible in a residual table.

## Production-Ready Script

{% raw %}
```python
# numpy>=1.24, Python 3.9+
from __future__ import annotations

from dataclasses import dataclass
import numpy as np


class HandednessError(ValueError):
    pass


@dataclass(frozen=True)
class Similarity:
    rotation: np.ndarray      # (d, d), determinant +1
    scale: float
    translation: np.ndarray   # (d,)

    def apply(self, points: np.ndarray) -> np.ndarray:
        p = np.asarray(points, dtype=float)
        return self.scale * (p @ self.rotation.T) + self.translation


def is_reflection(rotation: np.ndarray, *, tol: float = 1e-8) -> bool:
    """A proper rotation has determinant +1; a reflection has -1."""
    det = float(np.linalg.det(np.asarray(rotation, dtype=float)))
    if abs(abs(det) - 1.0) > 1e-6:
        raise HandednessError(f"matrix is not orthogonal (det={det:.6g})")
    return det < 0


def solve_similarity(source: np.ndarray, target: np.ndarray,
                     *, allow_scale: bool = True) -> Similarity:
    """Umeyama solve with the reflection guard applied INSIDE the decomposition."""
    a = np.asarray(source, dtype=float)
    b = np.asarray(target, dtype=float)
    if a.shape != b.shape or a.ndim != 2:
        raise ValueError("source and target must be matching (n, d) arrays")
    n, d = a.shape
    if n < d + 1:
        raise ValueError(f"{n} points cannot determine a {d}-dimensional similarity")

    ca, cb = a.mean(axis=0), b.mean(axis=0)
    A, B = a - ca, b - cb
    H = A.T @ B / n
    U, S, Vt = np.linalg.svd(H)

    # The guard: build a correction that flips the LAST singular direction when
    # the naive product would be a reflection. Flipping an output axis instead
    # gives a different transform unless the mirror plane happens to align.
    D = np.eye(d)
    if np.linalg.det(U @ Vt) < 0:
        D[-1, -1] = -1.0
    R = (U @ D @ Vt).T

    if is_reflection(R):
        raise HandednessError("reflection survived the correction — check for collinear points")

    var_a = (A ** 2).sum() / n
    scale = float((S * np.diag(D)).sum() / var_a) if allow_scale else 1.0
    t = cb - scale * (R @ ca)
    return Similarity(rotation=R, scale=scale, translation=t)


def assert_right_handed(transform: Similarity) -> None:
    """Call before the transform touches production geometry."""
    if is_reflection(transform.rotation):
        raise HandednessError(
            "transform is a reflection — geometry would be mirrored with no residual penalty"
        )


if __name__ == "__main__":
    src = np.array([[0.0, 0.0], [10.0, 0.0], [10.0, 6.0], [0.0, 6.0]])
    dst = src @ np.array([[0.0, -1.0], [1.0, 0.0]]).T + np.array([100.0, 50.0])
    fit = solve_similarity(src, dst)
    assert_right_handed(fit)
    print("det:", round(float(np.linalg.det(fit.rotation)), 9), "scale:", round(fit.scale, 6))
```
{% endraw %}

<!-- fig:mir-repair-inside -->
<svg viewBox="-20 -20 574 194.1" role="img" aria-label="Negating an output axis is not equivalent to correcting the decomposition, which yields the best proper rotation" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:574px;display:block;margin:1.5rem auto;">
  <title>Repairing inside the decomposition, not after it</title>
  <desc>Two ways of removing a reflection. Negating an output axis afterwards produces a different transform from the correct one unless the mirror plane happens to coincide with that axis plane. Negating the last column inside the decomposition and recomputing yields the best proper rotation for the same correspondences, which is the standard result.</desc>
  <defs>
    <marker id="mr2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="mr2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="574" height="194.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="252" height="130" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4" stroke-dasharray="5 4"/>
  <text x="126" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Flip an axis afterwards</text>
  <line x1="14" y1="33" x2="238" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="16" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— a different transform</text>
  <text x="16" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— correct only by coincidence</text>
  <text x="16" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— residuals get worse</text>
  <text x="16" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— hides the real cause</text>
  <rect x="282" y="0" width="252" height="130" rx="6" fill="currentColor" fill-opacity="0.11" stroke="currentColor" stroke-width="1.9"/>
  <text x="408" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Correct in the decomposition</text>
  <line x1="296" y1="33" x2="520" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="298" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— negate the last singular direction</text>
  <text x="298" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— recompute the product</text>
  <text x="298" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— best proper rotation</text>
  <text x="298" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— the standard result</text>
  <text x="267" y="152" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">The correction belongs where the ambiguity arose.</text>
</svg>
<!-- /fig:mir-repair-inside -->

**Key implementation notes:**

- The correction matrix `D` is applied inside the product, which is the standard Umeyama result. This yields the best *proper* rotation for the correspondences rather than a rotation plus an unrelated axis flip.
- `is_reflection` first checks orthogonality. A determinant far from ±1 means the matrix is not a rotation at all — usually a sign that the inputs were degenerate — and that is a different error worth distinguishing.
- The scale uses the corrected singular values, so a mirrored configuration does not produce a scale that silently absorbs the correction.
- `assert_right_handed` exists as a separate call so it can be used as a gate on a transform obtained from anywhere, not only from this solver.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `numpy` | `>=1.24` | `linalg.svd`, `linalg.det` |
| Dimensions | 2D and 3D | the code is dimension-agnostic |
| Minimum points | `d + 1` | more, and non-degenerate, in practice |
| Scale | optional | disable where scale is survey truth |
| Output | proper rotation | guaranteed by the guard |

## Fallback Strategies

**1. The reflection survives the correction.** Points are collinear or coplanar to within numerical noise. Add control points off the line or plane; no algebra fixes an unobserved direction.

<!-- fig:mir-provoking-layouts -->
<svg viewBox="-48 -20.8 434.8 270.9" role="img" aria-label="Collinear control leaves a direction unobserved and admits a reflection; spread control does not" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:435px;display:block;margin:1.5rem auto;">
  <title>The layouts that leave handedness unobserved</title>
  <desc>Two control point layouts on the same site. Points strung along a road leave the direction perpendicular to that line poorly determined, so the decomposition is free to resolve it either way and a reflection costs nothing. Points bracketing the site observe every direction, and the ambiguity does not arise.</desc>
  <defs>
    <marker id="mr3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="mr3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-48" y="-20.8" width="434.8" height="270.9" fill="var(--color-surface)"/>
  <rect x="34" y="12" width="330" height="174" rx="4" fill="none" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="34" y1="186" x2="364" y2="186" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <line x1="34" y1="12" x2="34" y2="186" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <text x="199" y="208" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.7">Easting (m)</text>
  <text x="26" y="99" text-anchor="end" font-size="9.5" fill="currentColor" fill-opacity="0.7">Northing (m)</text>
  <polyline points="34,162.8 138.4,159 242.9,155.1 347.3,151.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-opacity="0.6" stroke-dasharray="5 4"/>
  <circle cx="34" cy="162.8" r="3.4" fill="currentColor" fill-opacity="0.55"/>
  <circle cx="138.4" cy="159" r="3.4" fill="currentColor" fill-opacity="0.55"/>
  <circle cx="242.9" cy="155.1" r="3.4" fill="currentColor" fill-opacity="0.55"/>
  <circle cx="347.3" cy="151.2" r="3.4" fill="currentColor" fill-opacity="0.55"/>
  <text x="131.4" y="175" text-anchor="end" font-size="9.5" fill="currentColor" fill-opacity="0.85">collinear</text>
  <polyline points="38.2,186 364,174.4 326.4,16 63.2,31.5 38.2,186" fill="none" stroke="currentColor" stroke-width="2" stroke-opacity="0.95"/>
  <circle cx="38.2" cy="186" r="2.8" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="364" cy="174.4" r="2.8" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="326.4" cy="16" r="2.8" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="63.2" cy="31.5" r="2.8" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="38.2" cy="186" r="2.8" fill="currentColor" fill-opacity="0.95"/>
  <text x="319.4" y="6" text-anchor="end" font-size="9.5" fill="currentColor" fill-opacity="0.85">spread</text>
  <text x="34" y="228" font-size="9.5" fill="currentColor" fill-opacity="0.7">No algebra recovers a direction the control never observed.</text>
</svg>
<!-- /fig:mir-provoking-layouts -->

**2. The determinant is not near ±1.** The inputs are degenerate or contain a duplicate point. Deduplicate and check the conditioning before solving.

**3. Residuals are excellent and the model looks mirrored.** Exactly this fault. Check the determinant rather than re-examining the residuals, which will keep reporting success.

**4. Only symmetric control is available.** A symmetric layout cannot distinguish the two solutions from geometry alone. Verify against an asymmetric feature — a doorway, a chainage direction, a text label — and record which feature was used.

**5. The transform came from elsewhere.** Registration libraries do not all guard against this. Apply `assert_right_handed` to any transform before it reaches production geometry, whatever produced it.

## FAQ

<details>
<summary><strong>How does a reflection get into a solve at all?</strong></summary>

From the singular value decomposition. The product of the singular vector matrices is orthogonal, which means its determinant is plus or minus one — a rotation or a reflection. Nothing in the decomposition constrains it to the former, so with certain point configurations, particularly near-planar ones in a 3D solve, the naive product comes out as a reflection.

</details>

<details>
<summary><strong>Why do the residuals not reveal it?</strong></summary>

Because a reflection can fit the control points exactly. If the points are symmetric about the mirror plane, or nearly so, the reflected transform maps them onto their targets just as well as the rotation would. The residual measures distance to the targets, and the reflection achieves the same distances — so it reports success.

</details>

<details>
<summary><strong>Can I just flip a coordinate afterwards?</strong></summary>

No. Negating an axis on the output produces a different transform from the correct one unless the mirror plane happens to be that axis plane. Repair it inside the decomposition by negating the last column of the right singular vectors and recomputing, which yields the best proper rotation for the same correspondences.

</details>

---

## Related Pages

- [Scale and Rotation Synchronization](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/) — parent reference on the similarity solve and its degrees of freedom
- [Aligning BIM Models with GIS Survey Data](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/aligning-bim-models-with-gis-survey-data/) — the SVD pipeline this guard belongs inside
- [Computing RMSE for Control Point Alignment in Python](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/computing-rmse-for-control-point-alignment-in-python/) — the measurement that will not catch this fault on its own
