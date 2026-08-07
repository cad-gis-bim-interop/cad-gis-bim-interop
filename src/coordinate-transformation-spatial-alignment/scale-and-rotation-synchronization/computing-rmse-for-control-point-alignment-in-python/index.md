---
title: "Computing RMSE for Control Point Alignment in Python"
description: "Measure an alignment properly: hold out check points, report the maximum alongside the RMSE, identify the worst residual, and turn the numbers into a pass or fail the pipeline can act on."
slug: "computing-rmse-for-control-point-alignment-in-python"
breadcrumb:
  - label: "Coordinate Transformation & Spatial Alignment"
    url: "/coordinate-transformation-spatial-alignment/"
  - label: "Scale and Rotation Synchronization"
    url: "/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/"
  - label: "Computing RMSE for Control Point Alignment in Python"
    url: "/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/computing-rmse-for-control-point-alignment-in-python/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Computing RMSE for Control Point Alignment in Python",
      "description": "Measure an alignment properly: hold out check points, report the maximum alongside the RMSE, identify the worst residual, and turn the numbers into a pass or fail the pipeline can act on.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/computing-rmse-for-control-point-alignment-in-python/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Coordinate Transformation & Spatial Alignment", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/"},
        {"@type": "ListItem", "position": 2, "name": "Scale and Rotation Synchronization", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/"},
        {"@type": "ListItem", "position": 3, "name": "Computing RMSE for Control Point Alignment in Python", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/computing-rmse-for-control-point-alignment-in-python/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Measure a control point alignment with RMSE and check points",
      "description": "Split the control points, fit on one subset, measure on the other, and report the maximum residual alongside the RMSE as a pass or fail.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Split control from check points", "text": "Reserve a subset of surveyed points that the fit never sees, because residuals on fitted points are optimistic by construction."},
        {"@type": "HowToStep", "position": 2, "name": "Fit on the control subset", "text": "Solve the transform using only the control subset so the check points remain independent evidence."},
        {"@type": "HowToStep", "position": 3, "name": "Measure residuals on the check subset", "text": "Transform the check points and compute the distance from each to its surveyed position."},
        {"@type": "HowToStep", "position": 4, "name": "Report maximum with RMSE", "text": "Report the maximum residual and which point produced it, because an average hides the single mismatched point that usually causes it."},
        {"@type": "HowToStep", "position": 5, "name": "Turn the numbers into a verdict", "text": "Compare both statistics against the tolerance for the asset class and fail the run rather than annotating it."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Why is RMSE on the fitted points misleading?",
          "acceptedAnswer": {"@type": "Answer", "text": "Because the fit minimised exactly that quantity. With the minimum number of points the residual on them is zero regardless of whether the transform is right, and with a few more it is still the number the solver drove down. It measures how well the optimiser optimised, not how well the transform predicts. Only points excluded from the fit are evidence."}
        },
        {
          "@type": "Question",
          "name": "How many points should I hold back?",
          "acceptedAnswer": {"@type": "Answer", "text": "At least a third, and never fewer than two more than the minimum the solve requires. With three control points and no check points a planar solve is exactly determined and reports a perfect fit on anything. The holdout is what converts the fit from an assertion into a measurement."}
        },
        {
          "@type": "Question",
          "name": "What does a large maximum with a small RMSE mean?",
          "acceptedAnswer": {"@type": "Answer", "text": "Almost always one mismatched point — the same physical monument identified differently in the two datasets, or a transcription error in a point number. Report the index of the worst residual; that single number usually resolves the investigation in minutes."}
        }
      ]
    }
  ]
}
</script>

# Computing RMSE for Control Point Alignment in Python

To measure an alignment honestly, split the surveyed points into a control subset used for the fit and a check subset the fit never sees, transform the check points, and report the maximum residual and its index alongside the root-mean-square error. An RMSE computed on the points that were fitted is a measure of the optimiser, not of the transform. This page is part of [Scale and Rotation Synchronization](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/).

## Why the Split Matters More Than the Statistic

A similarity transform in the plane has four unknowns and in three-space seven. Given exactly the minimum number of points, the solve reproduces them exactly and the residual is zero — whether or not the correspondences were right, whether or not one point was mislabelled, whether or not the two datasets are on the same datum at all.

<!-- fig:rmse-holdout -->
<svg viewBox="-48 -8 478 268.1" role="img" aria-label="Control points fit the transform; check points excluded from the fit are what measures it" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:478px;display:block;margin:1.5rem auto;">
  <title>Control points and the check points held back from the fit</title>
  <desc>One site with two point sets. The control points are used to solve the transform; the check points are excluded from it and used only to measure. A residual on the control points reports how well the optimiser minimised what it was minimising; only the check points measure whether the transform predicts.</desc>
  <defs>
    <marker id="rm1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="rm1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-48" y="-8" width="478" height="268.1" fill="var(--color-surface)"/>
  <rect x="34" y="12" width="330" height="184" rx="4" fill="none" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="34" y1="196" x2="364" y2="196" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <line x1="34" y1="12" x2="34" y2="196" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <text x="199" y="218" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.7">Easting (m)</text>
  <text x="26" y="104" text-anchor="end" font-size="9.5" fill="currentColor" fill-opacity="0.7">Northing (m)</text>
  <circle cx="34" cy="196" r="3.4" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="364" cy="183.7" r="3.4" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="325.9" cy="16" r="3.4" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="59.4" cy="32.4" r="3.4" fill="currentColor" fill-opacity="0.95"/>
  <text x="357" y="173.7" text-anchor="end" font-size="9.5" fill="currentColor" fill-opacity="0.85">control</text>
  <circle cx="190.5" cy="130.5" r="2.8" fill="currentColor" fill-opacity="0.55"/>
  <circle cx="131.3" cy="69.2" r="2.8" fill="currentColor" fill-opacity="0.55"/>
  <circle cx="279.4" cy="93.7" r="2.8" fill="currentColor" fill-opacity="0.55"/>
  <text x="124.3" y="85.2" text-anchor="end" font-size="9.5" fill="currentColor" fill-opacity="0.85">check</text>
  <text x="34" y="238" font-size="9.5" fill="currentColor" fill-opacity="0.7">With the minimum number of points a fit is exact on them, whatever it does elsewhere.</text>
</svg>
<!-- /fig:rmse-holdout -->

Adding points reduces that effect without removing it. The solver is still minimising the residual on those points, so their residual remains the quantity that was optimised rather than an independent test. Only a point excluded from the fit measures prediction.

The second half of the argument is about which statistic to act on. The root-mean-square error describes the bulk and is the number usually quoted. The maximum describes the worst case and is the number that identifies problems, because the characteristic failure in this domain is not general imprecision but a single mismatched point — the same monument identified as two different points in the two datasets. A set with an RMSE of 0.03 m and a maximum of 0.42 m is not a slightly imprecise transform; it is a good transform with one bad correspondence, and the average conceals exactly the observation that finds it.

## Production-Ready Script

{% raw %}
```python
# numpy>=1.24, Python 3.9+
from __future__ import annotations

from dataclasses import dataclass
import numpy as np


@dataclass(frozen=True)
class ResidualReport:
    n_control: int
    n_check: int
    rmse: float
    mean: float
    p95: float
    maximum: float
    worst_index: int
    passed: bool
    tolerance: float

    def summary(self) -> str:
        verdict = "PASS" if self.passed else "FAIL"
        return (f"{verdict}  rmse={self.rmse:.4f} m  max={self.maximum:.4f} m "
                f"(check point {self.worst_index})  tol={self.tolerance:.3f} m")


def split_control_check(points: np.ndarray, *, holdout: float = 0.34, seed: int = 0):
    """Deterministic split — the same points every run, so results compare."""
    n = len(points)
    rng = np.random.default_rng(seed)
    idx = rng.permutation(n)
    n_check = max(2, int(round(n * holdout)))
    if n - n_check < 3:
        raise ValueError(f"{n} points is too few to both fit and check")
    return idx[n_check:], idx[:n_check]        # control, check


def residuals(transformed: np.ndarray, surveyed: np.ndarray) -> np.ndarray:
    a = np.asarray(transformed, dtype=float)
    b = np.asarray(surveyed, dtype=float)
    if a.shape != b.shape:
        raise ValueError(f"shape mismatch {a.shape} vs {b.shape}")
    return np.linalg.norm(a - b, axis=1)


def report(
    transformed_check: np.ndarray,
    surveyed_check: np.ndarray,
    *,
    n_control: int,
    tolerance_m: float,
) -> ResidualReport:
    d = residuals(transformed_check, surveyed_check)
    worst = int(d.argmax())
    return ResidualReport(
        n_control=n_control,
        n_check=int(d.size),
        rmse=float(np.sqrt((d ** 2).mean())),
        mean=float(d.mean()),
        p95=float(np.percentile(d, 95)),
        maximum=float(d[worst]),
        worst_index=worst,
        # Both statistics have to clear: the bulk AND the worst case.
        passed=bool(np.sqrt((d ** 2).mean()) <= tolerance_m and d[worst] <= tolerance_m * 2),
        tolerance=tolerance_m,
    )


if __name__ == "__main__":
    surveyed = np.array([[...]])          # (n, 2) or (n, 3) surveyed positions
    local = np.array([[...]])             # the same points in the source frame
    control_idx, check_idx = split_control_check(surveyed)
    # fit(...) on local[control_idx] -> surveyed[control_idx], then:
    # moved = apply(fit, local[check_idx])
    # print(report(moved, surveyed[check_idx],
    #              n_control=len(control_idx), tolerance_m=0.05).summary())
```
{% endraw %}

<!-- fig:rmse-max-matters -->
<svg viewBox="-20 -20 452.4 244.1" role="img" aria-label="Six small residuals and one large one give an acceptable RMSE while concealing a mismatched point" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:452px;display:block;margin:1.5rem auto;">
  <title>Why the maximum is reported alongside the mean</title>
  <desc>Residuals on seven check points from one fit. Six sit at a few centimetres and one at forty; the root-mean-square error over all seven is comfortably inside a survey tolerance and conceals exactly the observation that identifies the problem. The characteristic failure here is one mismatched correspondence, not general imprecision.</desc>
  <defs>
    <marker id="rm2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="rm2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="452.4" height="244.1" fill="var(--color-surface)"/>
  <text x="66.2" y="11.5" text-anchor="end" font-size="10.5" fill="currentColor" fill-opacity="0.9">check point 1</text>
  <rect x="76.2" y="0" width="14.8" height="16" rx="3" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <text x="99" y="11.5" font-size="10" fill="currentColor" fill-opacity="0.85">0.021 m</text>
  <text x="66.2" y="41.5" text-anchor="end" font-size="10.5" fill="currentColor" fill-opacity="0.9">check point 2</text>
  <rect x="76.2" y="30" width="23.9" height="16" rx="3" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <text x="108.2" y="41.5" font-size="10" fill="currentColor" fill-opacity="0.85">0.034 m</text>
  <text x="66.2" y="71.5" text-anchor="end" font-size="10.5" fill="currentColor" fill-opacity="0.9">check point 3</text>
  <rect x="76.2" y="60" width="19.7" height="16" rx="3" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <text x="103.9" y="71.5" font-size="10" fill="currentColor" fill-opacity="0.85">0.028 m</text>
  <text x="66.2" y="101.5" text-anchor="end" font-size="10.5" fill="currentColor" fill-opacity="0.9">check point 4</text>
  <rect x="76.2" y="90" width="290" height="16" rx="3" fill="currentColor" fill-opacity="0.42" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.9"/>
  <text x="374.2" y="101.5" font-size="10" font-weight="600" fill="currentColor" fill-opacity="0.85">0.412 m</text>
  <text x="66.2" y="131.5" text-anchor="end" font-size="10.5" fill="currentColor" fill-opacity="0.9">check point 5</text>
  <rect x="76.2" y="120" width="13.4" height="16" rx="3" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <text x="97.6" y="131.5" font-size="10" fill="currentColor" fill-opacity="0.85">0.019 m</text>
  <text x="66.2" y="161.5" text-anchor="end" font-size="10.5" fill="currentColor" fill-opacity="0.9">check point 6</text>
  <rect x="76.2" y="150" width="21.8" height="16" rx="3" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <text x="106" y="161.5" font-size="10" fill="currentColor" fill-opacity="0.85">0.031 m</text>
  <line x1="76.2" y1="168" x2="366.2" y2="168" stroke="currentColor" stroke-width="1" stroke-opacity="0.35"/>
  <text x="76.2" y="183" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.6">0</text>
  <text x="366.2" y="183" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.6">0.412</text>
  <text x="0" y="202" font-size="9.5" fill="currentColor" fill-opacity="0.7">RMSE 0.17 m, maximum 0.41 m — one point, not a tolerance problem.</text>
</svg>
<!-- /fig:rmse-max-matters -->

**Key implementation notes:**

- The split is seeded, so two runs on the same data compare. An unseeded split makes every re-run a different measurement.
- `passed` requires both the RMSE and the maximum to clear, with a wider allowance on the maximum. A single criterion on either alone lets through the failure the other catches.
- `worst_index` is returned rather than just the value, because the index is what an investigation needs.
- The split refuses to leave fewer than three points for the fit. A degenerate fit reports a beautiful residual.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `numpy` | `>=1.24` | `default_rng`, `linalg.norm` |
| Input | `(n, 2)` or `(n, 3)` | planar or spatial; the code is dimension-agnostic |
| Minimum points | 5 planar, 6 spatial | three to fit plus two to check, at least |
| Tolerance | per asset class | 0.05 m survey-grade, 0.5 m mapping |
| Determinism | seeded split | required for run-to-run comparison |

## Fallback Strategies

**1. Too few points to split.** Fit on all of them and state plainly that the residual is not independent evidence. Do not report it as a validation.

<!-- fig:rmse-shapes -->
<svg viewBox="-20 -20 504.5 214.1" role="img" aria-label="One outlier, uniform residuals, residuals growing with distance, or a good fit with wrong geometry — four diagnoses" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:505px;display:block;margin:1.5rem auto;">
  <title>What the shape of the residuals tells you</title>
  <desc>Four residual patterns and the fault each one indicates. The distribution is more informative than any single statistic: one outlier is a correspondence problem, uniformity is systematic, growth with distance is scale, and a good fit with visibly wrong geometry is a reflection that no residual will reveal.</desc>
  <defs>
    <marker id="rm3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="rm3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="504.5" height="214.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="464.5" height="152" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="464.5" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">Pattern</text>
  <text x="227.5" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Diagnosis</text>
  <line x1="310" y1="0" x2="310" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="387.3" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Next step</text>
  <line x1="145" y1="0" x2="145" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="464.5" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">One large, rest small</text>
  <text x="227.5" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">a mismatched correspondence</text>
  <text x="387.3" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">refit without that point</text>
  <line x1="0" y1="62" x2="464.5" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">All large and similar</text>
  <text x="227.5" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">datum, unit or vertical offset</text>
  <text x="387.3" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">check the declarations</text>
  <line x1="0" y1="92" x2="464.5" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">Growing with distance</text>
  <text x="227.5" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">scale error</text>
  <text x="387.3" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">was scale a free parameter?</text>
  <line x1="0" y1="122" x2="464.5" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="140.5" font-size="10.5" font-weight="600" fill="currentColor">Small, model still wrong</text>
  <text x="227.5" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">reflection</text>
  <text x="387.3" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">check det(R)</text>
  <text x="0" y="172" font-size="9.5" fill="currentColor" fill-opacity="0.7">The distribution diagnoses; the single number only passes or fails.</text>
</svg>
<!-- /fig:rmse-shapes -->

**2. Maximum far above the RMSE.** One mismatched correspondence. Inspect the point named by `worst_index`, refit without it, and see whether the maximum drops to the bulk level — if it does, the point was the problem.

**3. Every residual is large and similar.** Not a correspondence problem but a systematic one: a datum difference, a unit error or an unapplied vertical offset. The uniformity is the diagnosis.

**4. Residuals grow with distance from the centroid.** A scale error. Check whether the solve was allowed to fit scale, and whether it should have been.

**5. The RMSE passes and the model is visibly wrong.** Check for a mirrored transform — a reflection fits control points as well as a rotation does. That is the subject of the [sibling guide on detecting mirrored transforms](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/detecting-mirrored-transforms-in-python/).

## FAQ

<details>
<summary><strong>Why is RMSE on the fitted points misleading?</strong></summary>

Because the fit minimised exactly that quantity. With the minimum number of points the residual on them is zero regardless of whether the transform is right, and with a few more it is still the number the solver drove down. It measures how well the optimiser optimised, not how well the transform predicts. Only points excluded from the fit are evidence.

</details>

<details>
<summary><strong>How many points should I hold back?</strong></summary>

At least a third, and never fewer than two more than the minimum the solve requires. With three control points and no check points a planar solve is exactly determined and reports a perfect fit on anything. The holdout is what converts the fit from an assertion into a measurement.

</details>

<details>
<summary><strong>What does a large maximum with a small RMSE mean?</strong></summary>

Almost always one mismatched point — the same physical monument identified differently in the two datasets, or a transcription error in a point number. Report the index of the worst residual; that single number usually resolves the investigation in minutes.

</details>

---

## Related Pages

- [Scale and Rotation Synchronization](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/) — parent reference on the similarity solve these residuals measure
- [Aligning BIM Models with GIS Survey Data](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/aligning-bim-models-with-gis-survey-data/) — the SVD solve this measurement is applied to
- [Detecting Mirrored Transforms in Python](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/detecting-mirrored-transforms-in-python/) — a fault that produces a good RMSE and a wrong model
