---
title: "Aligning a Point Cloud to a BIM Model with ICP"
description: "Register a laser scan against a BIM model: why ICP refines rather than georeferences, disabling scale, and measuring the fit on surfaces held out of the solve."
slug: "aligning-a-point-cloud-to-a-bim-model-with-icp"
breadcrumb:
  - label: "Python Parsing & Geometry Extraction"
    url: "/python-parsing-geometry-extraction/"
  - label: "Point Cloud and Reality Capture Integration"
    url: "/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/"
  - label: "Aligning a Point Cloud to a BIM Model with ICP"
    url: "/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/aligning-a-point-cloud-to-a-bim-model-with-icp/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Aligning a Point Cloud to a BIM Model with ICP",
      "description": "Register a laser scan against a BIM model: why ICP refines rather than georeferences, disabling scale, and measuring the fit on surfaces held out of the solve.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/aligning-a-point-cloud-to-a-bim-model-with-icp/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Python Parsing & Geometry Extraction", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/"},
        {"@type": "ListItem", "position": 2, "name": "Point Cloud and Reality Capture Integration", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/"},
        {"@type": "ListItem", "position": 3, "name": "Aligning a Point Cloud to a BIM Model with ICP", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/aligning-a-point-cloud-to-a-bim-model-with-icp/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Register a point cloud against a BIM model with ICP",
      "description": "Start from a coarse georeferenced alignment, downsample both inputs, run a rigid ICP with a decreasing correspondence distance, and measure the residual on held-out surfaces.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Start from a coarse alignment", "text": "Place the cloud approximately using survey control or the scanner positioning, because ICP refines an alignment rather than finding one."},
        {"@type": "HowToStep", "position": 2, "name": "Downsample both inputs equally", "text": "Voxel-downsample the cloud and sample the model surfaces to a comparable density so correspondences are not biased by density."},
        {"@type": "HowToStep", "position": 3, "name": "Run rigid ICP", "text": "Estimate a transform with scaling disabled, since scale is survey truth and letting it float hides genuine dimensional discrepancies."},
        {"@type": "HowToStep", "position": 4, "name": "Decrease the correspondence distance", "text": "Run several passes with a shrinking maximum correspondence distance so the fit tightens without being captured by distant outliers early on."},
        {"@type": "HowToStep", "position": 5, "name": "Measure on held-out surfaces", "text": "Compute the residual against surfaces excluded from the registration so the reported fit is not measured on what it optimised."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Why must scaling be disabled?",
          "acceptedAnswer": {"@type": "Answer", "text": "Because scale between a scan and a design model is meaningful. Both are metric, so a genuine scale difference means something is wrong — a unit error, or a real dimensional discrepancy on site. Allowing the fit to scale lets it absorb that discrepancy and report an excellent alignment, which converts the finding you wanted into a number nobody sees."}
        },
        {
          "@type": "Question",
          "name": "How close does the initial alignment need to be?",
          "acceptedAnswer": {"@type": "Answer", "text": "Close enough that corresponding surfaces are nearer to each other than to non-corresponding ones — roughly, within half the spacing of repeating features. In a building with a 3 m storey height, an initial error above about 1.5 m risks converging one floor out, and the result looks superb because floors do resemble each other."}
        },
        {
          "@type": "Question",
          "name": "What residual should I expect?",
          "acceptedAnswer": {"@type": "Answer", "text": "It depends on what is being compared, not on the algorithm. Against as-built structure the residual reflects construction tolerance, typically 5–25 mm on cast elements. Against design geometry it also includes everything built differently from the model, which is usually the point of the exercise — a large localised residual is a finding rather than a failure."}
        }
      ]
    }
  ]
}
</script>

# Aligning a Point Cloud to a BIM Model with ICP

Iterative closest point registration refines an alignment that is already approximately correct, so the workflow is: georeference the cloud from survey control, sample both inputs to a comparable density, run a rigid ICP with scaling disabled and a decreasing correspondence distance, then measure the residual on surfaces the solve never saw. Using ICP to *find* an alignment rather than to refine one is the mistake this page exists to prevent. It belongs to [Point Cloud and Reality Capture Integration](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/).

## How ICP Converges, and What It Cannot Do

ICP alternates two steps. It pairs each source point with the nearest point in the target, then solves for the rigid transform that minimises the summed squared distance between those pairs, and repeats. Both steps are local: correspondences are nearest neighbours, and the solve is a closed-form least squares over the current pairing.

<!-- fig:icp-local-convergence -->
<svg viewBox="-48 -8 417.1 278.1" role="img" aria-label="ICP removes the small residual rotation and translation left after georeferencing, not a large placement error" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>The residual ICP is there to take up</title>
  <desc>Two outlines of the same structure. The model is the design geometry; the scan is the same structure as measured, displaced by a small rotation and translation left over after georeferencing. That displacement is what iterative closest point removes. A displacement much larger than this is not a residual and ICP will not reliably find the right correspondence for it.</desc>
  <defs>
    <marker id="ic1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ic1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-48" y="-8" width="417.1" height="278.1" fill="var(--color-surface)"/>
  <rect x="34" y="12" width="310" height="194" rx="4" fill="none" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="34" y1="206" x2="344" y2="206" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <line x1="34" y1="12" x2="34" y2="206" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <text x="189" y="228" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.7">Easting (m, local)</text>
  <text x="26" y="109" text-anchor="end" font-size="9.5" fill="currentColor" fill-opacity="0.7">Northing (m)</text>
  <polyline points="34,198.5 330.5,198.5 330.5,82.4 152.6,82.4 152.6,16 34,16 34,198.5" fill="none" stroke="currentColor" stroke-width="2" stroke-opacity="0.95"/>
  <circle cx="34" cy="198.5" r="3.4" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="330.5" cy="198.5" r="3.4" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="330.5" cy="82.4" r="3.4" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="152.6" cy="82.4" r="3.4" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="152.6" cy="16" r="3.4" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="34" cy="16" r="3.4" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="34" cy="198.5" r="3.4" fill="currentColor" fill-opacity="0.95"/>
  <text x="323.5" y="72.4" text-anchor="end" font-size="9.5" fill="currentColor" fill-opacity="0.85">model</text>
  <polyline points="47.8,206 344,194.7 337.7,78.7 160,85.4 156.4,19.1 38,23.7 47.8,206" fill="none" stroke="currentColor" stroke-width="1.4" stroke-opacity="0.6" stroke-dasharray="5 4"/>
  <circle cx="47.8" cy="206" r="2.8" fill="currentColor" fill-opacity="0.55"/>
  <circle cx="344" cy="194.7" r="2.8" fill="currentColor" fill-opacity="0.55"/>
  <circle cx="337.7" cy="78.7" r="2.8" fill="currentColor" fill-opacity="0.55"/>
  <circle cx="160" cy="85.4" r="2.8" fill="currentColor" fill-opacity="0.55"/>
  <circle cx="156.4" cy="19.1" r="2.8" fill="currentColor" fill-opacity="0.55"/>
  <circle cx="38" cy="23.7" r="2.8" fill="currentColor" fill-opacity="0.55"/>
  <circle cx="47.8" cy="206" r="2.8" fill="currentColor" fill-opacity="0.55"/>
  <text x="149.4" y="35.1" text-anchor="end" font-size="9.5" fill="currentColor" fill-opacity="0.85">scan</text>
  <text x="34" y="248" font-size="9.5" fill="currentColor" fill-opacity="0.7">Rotation 2.6°, translation 1.4 m — refinable. Metres and a storey are not.</text>
</svg>
<!-- /fig:icp-local-convergence -->

That locality is the whole behaviour. If the initial placement pairs a scanned floor with the model's floor, the algorithm converges on the right answer. If it pairs it with the floor above, the algorithm converges just as confidently on an answer that is one storey out — and reports a low residual, because floors genuinely do match floors.

It also has no notion of a coordinate reference system. It minimises distance, nothing else. Georeferencing comes from survey control or from the scanner's own positioning; ICP takes up the residual between a georeferenced cloud and a model, which is typically decimetres, not the metres or kilometres that georeferencing spans.

## Production-Ready Script

{% raw %}
```python
# open3d>=0.17, numpy>=1.24, Python 3.9+
from __future__ import annotations

from dataclasses import dataclass
import numpy as np
import open3d as o3d


@dataclass(frozen=True)
class Registration:
    transform: np.ndarray        # 4x4 rigid
    inlier_rmse: float
    fitness: float               # fraction of source points with a correspondence
    passes: tuple[float, ...]    # the correspondence distances used


def _pcd(xyz: np.ndarray) -> o3d.geometry.PointCloud:
    p = o3d.geometry.PointCloud()
    p.points = o3d.utility.Vector3dVector(np.asarray(xyz, dtype=float))
    return p


def register(
    scan_xyz: np.ndarray,
    model_xyz: np.ndarray,
    *,
    voxel_m: float = 0.05,
    distances: tuple[float, ...] = (0.50, 0.20, 0.08),
    initial: np.ndarray | None = None,
) -> Registration:
    """Rigid ICP refinement with a shrinking correspondence distance."""
    # Work near the origin: single-precision kernels lose resolution at full
    # projected coordinates, and the shift is exactly reversible.
    origin = np.asarray(scan_xyz, dtype=float).mean(axis=0)
    scan = _pcd(np.asarray(scan_xyz) - origin).voxel_down_sample(voxel_m)
    model = _pcd(np.asarray(model_xyz) - origin).voxel_down_sample(voxel_m)

    T = np.eye(4) if initial is None else np.array(initial, dtype=float)
    estimator = o3d.pipelines.registration.TransformationEstimationPointToPoint(
        with_scaling=False)          # scale is survey truth, never a free parameter
    result = None
    for max_corr in distances:
        result = o3d.pipelines.registration.registration_icp(
            scan, model, max_corr, T, estimator,
            o3d.pipelines.registration.ICPConvergenceCriteria(max_iteration=60),
        )
        T = result.transformation

    # Undo the origin shift so the transform applies to the original coordinates.
    shift = np.eye(4); shift[:3, 3] = origin
    unshift = np.eye(4); unshift[:3, 3] = -origin
    return Registration(
        transform=shift @ np.asarray(T) @ unshift,
        inlier_rmse=float(result.inlier_rmse),
        fitness=float(result.fitness),
        passes=distances,
    )


def apply(transform: np.ndarray, xyz: np.ndarray) -> np.ndarray:
    pts = np.asarray(xyz, dtype=float)
    homogeneous = np.column_stack((pts, np.ones(len(pts))))
    return (homogeneous @ np.asarray(transform).T)[:, :3]


def residual_on_holdout(transform, holdout_scan, holdout_model) -> dict:
    """Fit measured on surfaces the registration never saw."""
    from scipy.spatial import cKDTree
    moved = apply(transform, holdout_scan)
    d, _ = cKDTree(np.asarray(holdout_model)).query(moved)
    return {"rmse": float(np.sqrt((d ** 2).mean())),
            "p95": float(np.percentile(d, 95)),
            "max": float(d.max())}
```
{% endraw %}

<!-- fig:icp-scaling-off -->
<svg viewBox="-20 -20 578 194.1" role="img" aria-label="Allowing ICP to fit scale absorbs genuine dimensional discrepancies and reports an excellent fit" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:578px;display:block;margin:1.5rem auto;">
  <title>What happens when the fit is allowed to scale</title>
  <desc>Two configurations of the same registration. With scaling enabled the optimiser can absorb a genuine dimensional difference between the scan and the model into a scale factor, and then reports an excellent fit — converting the finding into a number nobody looks at. With scaling disabled that difference stays in the residual, where it is visible.</desc>
  <defs>
    <marker id="ic2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ic2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="578" height="194.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="254" height="130" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4" stroke-dasharray="5 4"/>
  <text x="127" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">with_scaling=True</text>
  <line x1="14" y1="33" x2="240" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="16" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— scale is a free parameter</text>
  <text x="16" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— absorbs unit errors</text>
  <text x="16" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— absorbs as-built discrepancy</text>
  <text x="16" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— reports a superb fit</text>
  <rect x="284" y="0" width="254" height="130" rx="6" fill="currentColor" fill-opacity="0.11" stroke="currentColor" stroke-width="1.9"/>
  <text x="411" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">with_scaling=False</text>
  <line x1="298" y1="33" x2="524" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="300" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— rigid transform only</text>
  <text x="300" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— unit errors stay visible</text>
  <text x="300" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— discrepancy stays in the residual</text>
  <text x="300" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— the residual means something</text>
  <text x="269" y="152" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">Both are metric — a scale difference is a finding, not a parameter.</text>
</svg>
<!-- /fig:icp-scaling-off -->

**Key implementation notes:**

- `with_scaling=False` is the single most consequential argument on the page.
- The correspondence distance shrinks across passes. Starting tight risks discarding correct correspondences that are initially far apart; staying loose lets distant outliers pull the solution.
- Both inputs are shifted to a common local origin before the solve and the transform is un-shifted afterwards, so the returned matrix applies directly to projected coordinates without the precision loss of working there.
- `fitness` is reported alongside the RMSE. A very low RMSE with a fitness of 0.05 means an excellent fit to five per cent of the cloud, which is not an alignment.
- The residual function takes explicitly held-out geometry. Measuring on the registration input reports how well the optimiser optimised.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `open3d` | `>=0.17` | `registration_icp`, `voxel_down_sample` |
| `numpy` | `>=1.24` | matrix composition and application |
| `scipy` | `>=1.10` | `cKDTree` for the residual measurement |
| Input | `(n, 3)` float64 arrays | model sampled from surfaces, not vertices only |
| Initial alignment | within ~half the feature spacing | required — ICP does not georeference |

## Fallback Strategies

**1. Converged one storey out.** The classic failure. Tighten the initial alignment, or constrain the vertical component by fixing Z from a known level and solving only in plan.

<!-- fig:icp-passes -->
<svg viewBox="-20 -20 445.6 154.1" role="img" aria-label="Correspondence distance shrinks across passes from 0.5 metres to 0.08 metres as the alignment tightens" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:446px;display:block;margin:1.5rem auto;">
  <title>The shrinking correspondence distance across passes</title>
  <desc>The maximum correspondence distance used in each successive registration pass. A generous first pass lets distant but correct correspondences participate; each subsequent pass tightens, excluding outliers as the alignment improves. Starting tight discards correct pairs that were initially far apart; staying loose lets outliers pull the solution.</desc>
  <defs>
    <marker id="ic3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ic3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="445.6" height="154.1" fill="var(--color-surface)"/>
  <text x="82.2" y="11.5" text-anchor="end" font-size="10.5" fill="currentColor" fill-opacity="0.9">pass 1 — coarse</text>
  <rect x="92.2" y="0" width="280" height="16" rx="3" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <text x="380.2" y="11.5" font-size="10" fill="currentColor" fill-opacity="0.85">0.5 m</text>
  <text x="82.2" y="41.5" text-anchor="end" font-size="10.5" fill="currentColor" fill-opacity="0.9">pass 2 — closing</text>
  <rect x="92.2" y="30" width="112" height="16" rx="3" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <text x="212.2" y="41.5" font-size="10" fill="currentColor" fill-opacity="0.85">0.2 m</text>
  <text x="82.2" y="71.5" text-anchor="end" font-size="10.5" fill="currentColor" fill-opacity="0.9">pass 3 — final</text>
  <rect x="92.2" y="60" width="44.8" height="16" rx="3" fill="currentColor" fill-opacity="0.42" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.9"/>
  <text x="145" y="71.5" font-size="10" font-weight="600" fill="currentColor" fill-opacity="0.85">0.08 m</text>
  <line x1="92.2" y1="78" x2="372.2" y2="78" stroke="currentColor" stroke-width="1" stroke-opacity="0.35"/>
  <text x="92.2" y="93" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.6">0</text>
  <text x="372.2" y="93" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.6">0.5</text>
  <text x="0" y="112" font-size="9.5" fill="currentColor" fill-opacity="0.7">One tight pass from a rough start converges on the wrong correspondences.</text>
</svg>
<!-- /fig:icp-passes -->

**2. Fitness is very low.** Little of the scan has a correspondence — usually because the model covers a subset of what was scanned, or vice versa. Clip both to their common extent before registering; see [Clipping Point Clouds to CAD Boundaries in Python](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/clipping-point-clouds-to-cad-boundaries-in-python/).

**3. The result drifts between runs.** Voxel downsampling is deterministic for a fixed voxel size but the sampling of model surfaces may not be. Seed or cache the model sampling so a re-run is comparable.

**4. Residual is uniform and vertical.** Not an alignment problem — a vertical datum problem. The cloud is on ellipsoidal height and the model is not. Resolve the height systems first.

**5. Registration is slow.** The cost is dominated by nearest-neighbour queries, which scale with point count. Downsample harder for the coarse passes and only tighten the density for the final one.

## FAQ

<details>
<summary><strong>Why must scaling be disabled?</strong></summary>

Because scale between a scan and a design model is meaningful. Both are metric, so a genuine scale difference means something is wrong — a unit error, or a real dimensional discrepancy on site. Allowing the fit to scale lets it absorb that discrepancy and report an excellent alignment, which converts the finding you wanted into a number nobody sees.

</details>

<details>
<summary><strong>How close does the initial alignment need to be?</strong></summary>

Close enough that corresponding surfaces are nearer to each other than to non-corresponding ones — roughly, within half the spacing of repeating features. In a building with a 3 m storey height, an initial error above about 1.5 m risks converging one floor out, and the result looks superb because floors do resemble each other.

</details>

<details>
<summary><strong>What residual should I expect?</strong></summary>

It depends on what is being compared, not on the algorithm. Against as-built structure the residual reflects construction tolerance, typically 5–25 mm on cast elements. Against design geometry it also includes everything built differently from the model, which is usually the point of the exercise — a large localised residual is a finding rather than a failure.

</details>

---

## Related Pages

- [Point Cloud and Reality Capture Integration](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/) — parent reference on reading, decimating and georeferencing a cloud
- [Scale and Rotation Synchronization](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/) — the closed-form similarity solve ICP refines the result of
- [Reading LAS and LAZ Files with laspy](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/reading-las-and-laz-files-with-laspy/) — getting the cloud into memory before registering it
