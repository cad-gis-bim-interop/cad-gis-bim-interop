---
title: "Scale and Rotation Synchronization in CAD/GIS/BIM Python Pipelines"
description: "How to compute and apply SVD-based similarity transformations that resolve unit-scale mismatches and angular misalignments when merging CAD, GIS, and BIM datasets in Python."
slug: "scale-and-rotation-synchronization"
breadcrumb:
  - label: "Coordinate Transformation & Spatial Alignment"
    url: "/coordinate-transformation-spatial-alignment/"
  - label: "Scale and Rotation Synchronization"
    url: "/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/"
datePublished: "2024-03-01"
dateModified: "2026-06-24"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Scale and Rotation Synchronization in CAD/GIS/BIM Python Pipelines",
      "description": "How to compute and apply SVD-based similarity transformations that resolve unit-scale mismatches and angular misalignments when merging CAD, GIS, and BIM datasets in Python.",
      "datePublished": "2024-03-01",
      "dateModified": "2026-06-24",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Coordinate Transformation & Spatial Alignment",
          "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Scale and Rotation Synchronization",
          "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/"
        }
      ]
    },
    {
      "@type": "HowTo",
      "name": "Compute a Similarity Transformation for CAD/GIS/BIM Alignment",
      "description": "Step-by-step procedure to extract control points, compute uniform scale and optimal rotation via SVD, and apply the resulting similarity transform across multi-discipline spatial datasets.",
      "step": [
        {"@type": "HowToStep", "name": "Extract and validate control points", "text": "Parse matching coordinate pairs from source and target datasets, validate non-collinearity, and filter near-duplicate points."},
        {"@type": "HowToStep", "name": "Normalize to centroid", "text": "Subtract each point set's geometric centroid to decouple translation from rotation and scale."},
        {"@type": "HowToStep", "name": "Compute uniform scale factor", "text": "Derive the RMS-distance ratio between centered target and source point clouds."},
        {"@type": "HowToStep", "name": "Derive rotation matrix via SVD", "text": "Decompose the cross-covariance matrix H = X^T Y and assemble R = V U^T, correcting for reflections."},
        {"@type": "HowToStep", "name": "Assemble translation vector", "text": "Compute t = tgt_centroid − s · R · src_centroid to anchor the transform to the target space."},
        {"@type": "HowToStep", "name": "Validate residuals against project tolerances", "text": "Compute per-point residuals and RMSE; reject or flag datasets that exceed the tolerance threshold."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Why does my rotation matrix have determinant −1 after SVD?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "A determinant of −1 means SVD returned an improper rotation (a reflection). Fix it by negating the last row of Vt before computing R = Vt.T @ U.T. Always assert np.isclose(np.linalg.det(R), 1.0) after correction."
          }
        },
        {
          "@type": "Question",
          "name": "Can I apply a similarity transform across different map projections?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "No — always reproject both datasets into a common local Cartesian system (e.g., a UTM zone) before computing the transform. Mixing geographic and projected coordinates introduces angular distortion that corrupts the scale factor."
          }
        },
        {
          "@type": "Question",
          "name": "How many control points do I need for a reliable result?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "A minimum of three non-collinear points is required to solve the 2D similarity problem. In practice, use 6–12 well-distributed control points and exclude outliers via iterative RANSAC before the final SVD solve."
          }
        },
        {
          "@type": "Question",
          "name": "Does uniform scale handle DXF INSUNITS mismatches automatically?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "No. The similarity transform computes scale empirically from control-point distances, so a DXF drawn in millimeters whose $INSUNITS header flag is missing or wrong will absorb the 1000× mismatch into the scale factor — masking the root cause. Always normalise units via your Unit Conversion Pipeline before computing the transform."
          }
        },
        {
          "@type": "Question",
          "name": "Can I reuse one transform matrix across the entire dataset?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes, provided the dataset has a single consistent spatial reference. Cache (R, s, t) after solving, then call apply_transform() on every geometry array. Recomputing per feature is wasteful and may introduce floating-point divergence across large feature sets."
          }
        }
      ]
    }
  ]
}
</script>

# Scale and Rotation Synchronization in CAD/GIS/BIM Python Pipelines

Scale and rotation synchronization is the process of computing a uniform similarity transformation — combining a scale factor, a rotation matrix, and a translation vector — that brings heterogeneous spatial datasets onto a common geometric baseline without distorting intrinsic shape. It is a mandatory stage in the [Coordinate Transformation & Spatial Alignment](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/) pipeline whenever CAD drawings, GIS exports, or BIM models are merged in a single automated workflow.

Each authoring environment makes independent choices about linear units (millimetres, feet, survey feet, metres), angular orientation (project north vs. grid north vs. true north), and local coordinate origins. Without a principled synchronization step, these mismatches accumulate into misaligned building footprints, skewed structural grids, broken topology, and silent spatial-query failures. The SVD-based similarity transform described here eliminates all three classes of error in one mathematically sound operation.

---

<svg viewBox="-6 54 672 157" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Similarity transformation pipeline: source geometry flows through centroid normalization, SVD decomposition, and transform application to produce aligned geometry" style="width:100%;max-width:720px;display:block;margin:1.5rem auto;">
  <title>Similarity Transformation Pipeline</title>
  <desc>Flow diagram showing source geometry entering centroid normalization, then SVD decomposition producing scale s and rotation R, then translation assembly, then transform application, finally producing aligned geometry with residual validation.</desc>
  <defs>
    <marker id="arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <path d="M0,0 L8,3 L0,6 Z" fill="currentColor"/>
    </marker>
  </defs>
  <rect x="-6" y="54" width="672" height="157" fill="var(--color-surface)"/>
  <!-- Boxes -->
  <rect x="10"  y="70" width="110" height="50" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="160" y="70" width="130" height="50" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="340" y="70" width="130" height="50" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="520" y="70" width="130" height="50" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <!-- Labels inside boxes -->
  <text x="65"  y="91"  text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">Source</text>
  <text x="65"  y="106" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">Geometry</text>
  <text x="225" y="88"  text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">Centroid</text>
  <text x="225" y="103" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">Normalization</text>
  <text x="225" y="114" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">+ scale factor</text>
  <text x="405" y="88"  text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">SVD →  R, s, t</text>
  <text x="405" y="103" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">reflection fix</text>
  <text x="585" y="91"  text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">Aligned</text>
  <text x="585" y="106" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">Geometry</text>
  <!-- Arrows -->
  <line x1="120" y1="95" x2="158" y2="95" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <line x1="290" y1="95" x2="338" y2="95" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <line x1="470" y1="95" x2="518" y2="95" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <!-- Validation feedback arc -->
  <path d="M650,120 Q650,175 405,175 Q225,175 160,155" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="4 3" marker-end="url(#arr)" opacity="0.6"/>
  <text x="405" y="193" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">RMSE &gt; threshold → reject / re-examine control points</text>
</svg>

## Prerequisites

Before implementing synchronization logic, confirm the following are in place:

- **Python 3.9+** with `numpy>=1.24` and `scipy>=1.10`
- **`pyproj>=3.4`** installed for CRS normalization upstream of this step (`pip install pyproj`)
- **Projected coordinate system** — all input geometries must be in a common local Cartesian CRS (e.g., a UTM zone) to avoid angular distortion; execute [CRS Normalization Workflows](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/) first if your sources carry mixed projections
- **Minimum three non-collinear control points** shared between source and target coordinate spaces; six or more are strongly recommended for production use
- **Consistent linear units** across both datasets — resolve unit mismatches via your [Unit Conversion Pipelines](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/) before this step; embedding a raw unit mismatch into the scale factor hides the root cause and makes debugging harder
- **Extracted geometric primitives** from source formats (DXF, IFC, GeoJSON, Shapefile) stored as NumPy arrays

Control points must represent stable, high-precision features: survey monuments, structural grid intersections, or permanent utility nodes. Avoid transient design elements, temporary construction markers, or features subject to iterative modeling tolerance stacking.

## Architectural Overview

A similarity transformation in the plane (or in 3-space) is defined by four parameters: a uniform scale factor $s$, a rotation matrix $R \in SO(n)$, and a translation vector $t$. The transformation maps source coordinates $\mathbf{X}$ to target coordinates $\mathbf{Y}$:

$$\mathbf{Y} = s \cdot R \cdot \mathbf{X} + t$$

<!-- fig:srs-parameter-count -->
<svg viewBox="-20 -20 467.8 244.1" role="img" aria-label="A planar similarity transform has four unknowns and needs two control points; a spatial one has seven and needs three non-collinear points" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:468px;display:block;margin:1.5rem auto;">
  <title>Degrees of freedom in a planar and a spatial similarity transform</title>
  <desc>A comparison of the two-dimensional and three-dimensional similarity transform. The plane has one scale, one rotation angle and two translation components, four unknowns in total, so two well-spread control points already determine it. Three-space has one scale, three rotation angles and three translations, seven unknowns, needing three non-collinear control points.</desc>
  <defs>
    <marker id="srs1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="srs1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="467.8" height="244.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="309" height="182" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="309" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">Parameter</text>
  <text x="180.2" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">2D (plane)</text>
  <line x1="217.8" y1="0" x2="217.8" y2="182" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="263.4" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">3D (space)</text>
  <line x1="142.6" y1="0" x2="142.6" y2="182" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="309" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">Uniform scale s</text>
  <text x="180.2" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">1</text>
  <text x="263.4" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">1</text>
  <line x1="0" y1="62" x2="309" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">Rotation R</text>
  <text x="180.2" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">1 angle</text>
  <text x="263.4" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">3 angles</text>
  <line x1="0" y1="92" x2="309" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">Translation t</text>
  <text x="180.2" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">2</text>
  <text x="263.4" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">3</text>
  <line x1="0" y1="122" x2="309" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="140.5" font-size="10.5" font-weight="600" fill="currentColor">Unknowns</text>
  <text x="180.2" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">4</text>
  <text x="263.4" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">7</text>
  <line x1="0" y1="152" x2="309" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="170.5" font-size="10.5" font-weight="600" fill="currentColor">Minimum control points</text>
  <text x="180.2" y="170.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">2</text>
  <text x="263.4" y="170.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">3 non-collinear</text>
  <text x="0" y="202" font-size="9.5" fill="currentColor" fill-opacity="0.7">Anything beyond these counts is an affine or a projective fit, and will absorb survey error as shear.</text>
</svg>
<!-- /fig:srs-parameter-count -->

The uniform scale constraint is what distinguishes a similarity transform from a general affine transform. It preserves angles and relative distances — the two properties that BIM authoring standards and CAD drafting conventions depend on for component sizing and clearance validation.

Computing $s$ and $R$ optimally is an instance of the **Orthogonal Procrustes problem**, solved by centering both point clouds at their respective centroids and then applying Singular Value Decomposition (SVD) to the cross-covariance matrix. SVD is guaranteed to produce a proper rotation (determinant $+1$) after a single reflection-check step, making it numerically stable even for near-degenerate control-point configurations.

### Compatibility and library versions

| Component | Supported range | Notes |
|---|---|---|
| Python | 3.9 – 3.12 | f-string formatting, type hints |
| `numpy` | 1.24 – 2.x | `np.linalg.svd`, `np.linalg.det` |
| `scipy` | 1.10+ | optional; `scipy.spatial.procrustes` as reference |
| `pyproj` | 3.4+ | required upstream for CRS normalization |
| Input dimensionality | 2D or 3D | code below handles both; 3D needs ≥ 4 non-coplanar points |

## Step-by-Step Implementation

### 1. Extract and validate control points

Parse source and target datasets to isolate matching coordinate pairs. Store them as $N \times 2$ or $N \times 3$ NumPy arrays. Verify $N \geq 3$ and confirm non-collinearity. Near-identical or collinear points destabilize the covariance calculation.

```python
# numpy>=1.24
import numpy as np
from numpy.linalg import svd, det
from typing import Tuple

def validate_control_points(
    src: np.ndarray,
    tgt: np.ndarray,
    collinearity_tol: float = 1e-6
) -> None:
    """Raises ValueError if control points are insufficient or collinear."""
    if src.shape != tgt.shape:
        raise ValueError("Source and target arrays must have identical shape.")
    if src.shape[0] < 3:
        raise ValueError("At least 3 matching control points required.")
    if src.shape[1] == 2:
        v1 = src[1] - src[0]
        v2 = src[2] - src[0]
        cross = abs(v1[0] * v2[1] - v1[1] * v2[0])
        if cross < collinearity_tol:
            raise ValueError("Source control points are collinear; add a non-collinear point.")
```

### 2. Centroid normalization and scale factor

Centering both point sets at their respective centroids decouples translation from the rotation-scale computation. The uniform scale factor $s$ is the ratio of RMS distances from the centroid in the target set versus the source set.

```python
# numpy>=1.24
def _center_and_scale(src: np.ndarray, tgt: np.ndarray):
    src_c = src.mean(axis=0)
    tgt_c = tgt.mean(axis=0)
    X = src - src_c
    Y = tgt - tgt_c
    rms_src = np.sqrt(np.sum(X ** 2))
    rms_tgt = np.sqrt(np.sum(Y ** 2))
    if rms_src == 0.0:
        raise ValueError("Source control points are coincident; cannot compute scale.")
    s = rms_tgt / rms_src
    return X, Y, src_c, tgt_c, s
```

### 3. Rotation via SVD and reflection correction

The cross-covariance matrix $H = X^T Y$ encodes the angular relationship between the centered point clouds. SVD decomposes $H = U \Sigma V^T$; the optimal rotation is $R = V U^T$. When $\det(R) = -1$, negate the last row of $V^T$ before multiplying.

```python
# numpy>=1.24
def _rotation_svd(X: np.ndarray, Y: np.ndarray) -> np.ndarray:
    H = X.T @ Y
    U, _, Vt = svd(H)
    R = Vt.T @ U.T
    if det(R) < 0:
        Vt[-1, :] *= -1
        R = Vt.T @ U.T
    assert np.isclose(det(R), 1.0), "Rotation matrix is improper after correction."
    return R
```

### 4. Assemble the full transform and compute residuals

Once $s$ and $R$ are known, the translation vector anchors the scaled, rotated geometry to the target coordinate space. Per-point residuals quantify the quality of the fit.

```python
# numpy>=1.24
def compute_similarity_transform(
    source_pts: np.ndarray,
    target_pts: np.ndarray,
    collinearity_tol: float = 1e-6,
) -> Tuple[np.ndarray, float, np.ndarray, np.ndarray]:
    """
    Compute uniform scale, rotation, and translation for a similarity transform.

    Returns
    -------
    R : (n, n) rotation matrix
    s : float — uniform scale factor (target / source units)
    t : (n,) translation vector
    residuals : (N,) per-control-point residual distances
    """
    validate_control_points(source_pts, target_pts, collinearity_tol)
    X, Y, src_c, tgt_c, s = _center_and_scale(source_pts, target_pts)
    R = _rotation_svd(X, Y)
    t = tgt_c - s * (R @ src_c)
    transformed = s * (source_pts @ R.T) + t
    residuals = np.linalg.norm(transformed - target_pts, axis=1)
    return R, s, t, residuals


def apply_transform(
    geometry: np.ndarray,
    R: np.ndarray,
    s: float,
    t: np.ndarray,
) -> np.ndarray:
    """Apply a precomputed similarity transform to an arbitrary geometry array."""
    return s * (geometry @ R.T) + t
```

### 5. Pipeline integration

Apply the transform immediately after format parsing and unit standardization, before topology reconstruction or spatial indexing. Cache `(R, s, t)` and call `apply_transform()` uniformly across all feature classes in the dataset to maintain internal consistency.

```python
# numpy>=1.24 | pyproj>=3.4
import json

def run_alignment_pipeline(
    source_geom: np.ndarray,
    source_ctrl: np.ndarray,
    target_ctrl: np.ndarray,
    rmse_threshold: float = 0.05,  # metres
) -> dict:
    R, s, t, residuals = compute_similarity_transform(source_ctrl, target_ctrl)
    rmse = float(np.sqrt(np.mean(residuals ** 2)))
    if rmse > rmse_threshold:
        raise RuntimeError(
            f"Alignment RMSE {rmse:.4f}m exceeds threshold {rmse_threshold}m. "
            "Review control point quality."
        )
    aligned = apply_transform(source_geom, R, s, t)
    return {
        "aligned_geometry": aligned,
        "scale": float(s),
        "rotation_matrix": R.tolist(),
        "translation": t.tolist(),
        "rmse_m": rmse,
        "max_residual_m": float(residuals.max()),
    }
```

## Edge Cases and Gotchas

### Collinear control points — singular covariance matrix

<!-- fig:srs-conditioning -->
<svg viewBox="-48 -20.8 441.1 280.9" role="img" aria-label="Control points strung along one line leave the rotation indeterminate; points spread around the site condition the solve" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:441px;display:block;margin:1.5rem auto;">
  <title>Well-conditioned versus rank-deficient control point layouts</title>
  <desc>Two control point sets plotted on the same site. The collinear set lies along a single road centreline; its cross-covariance matrix is rank deficient, the smallest singular value collapses toward zero and the rotation about that line is indeterminate. The spread set brackets the site, so all singular values are comparable and the solve is stable.</desc>
  <defs>
    <marker id="srs2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="srs2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-48" y="-20.8" width="441.1" height="280.9" fill="var(--color-surface)"/>
  <rect x="34" y="12" width="330" height="184" rx="4" fill="none" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="34" y1="196" x2="364" y2="196" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <line x1="34" y1="12" x2="34" y2="196" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <text x="199" y="218" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.7">Easting (m)</text>
  <text x="26" y="104" text-anchor="end" font-size="9.5" fill="currentColor" fill-opacity="0.7">Northing (m)</text>
  <polyline points="34,171.5 138.4,167.4 242.9,163.3 347.3,159.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-opacity="0.6" stroke-dasharray="5 4"/>
  <circle cx="34" cy="171.5" r="3.4" fill="currentColor" fill-opacity="0.55"/>
  <circle cx="138.4" cy="167.4" r="3.4" fill="currentColor" fill-opacity="0.55"/>
  <circle cx="242.9" cy="163.3" r="3.4" fill="currentColor" fill-opacity="0.55"/>
  <circle cx="347.3" cy="159.2" r="3.4" fill="currentColor" fill-opacity="0.55"/>
  <text x="131.4" y="183.4" text-anchor="end" font-size="9.5" fill="currentColor" fill-opacity="0.85">collinear</text>
  <polyline points="38.2,196 364,183.7 326.4,16 63.2,32.4 38.2,196" fill="none" stroke="currentColor" stroke-width="2" stroke-opacity="0.95"/>
  <circle cx="38.2" cy="196" r="2.8" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="364" cy="183.7" r="2.8" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="326.4" cy="16" r="2.8" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="63.2" cy="32.4" r="2.8" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="38.2" cy="196" r="2.8" fill="currentColor" fill-opacity="0.95"/>
  <text x="319.4" y="6" text-anchor="end" font-size="9.5" fill="currentColor" fill-opacity="0.85">spread</text>
  <text x="34" y="238" font-size="9.5" fill="currentColor" fill-opacity="0.7">A near-zero singular value is the warning; check it before trusting the rotation.</text>
</svg>
<!-- /fig:srs-conditioning -->

All control points aligned along a single axis produce a rank-deficient $H$ matrix, causing SVD to return a near-zero singular value and an indeterminate rotation. The validation function above catches this, but watch for near-collinearity when points are derived from a single corridor feature (e.g., a road centreline). Add off-axis check points from survey monuments or grid corners.

### Reflection artifact after SVD

When the source and target coordinate systems have opposite handedness (e.g., one uses a right-handed XY plane and the other a left-handed one), the raw SVD rotation will have $\det(R) = -1$, producing mirrored geometry. The `_rotation_svd` function above corrects this. Always assert `np.isclose(det(R), 1.0)` in production before applying the transform to bulk geometry.

### Unit mismatch absorbed into scale factor

A DXF file drawn in millimetres whose `$INSUNITS` header flag is absent or incorrect will present coordinates 1000× larger than expected in metres. The similarity transform will absorb this 1000× ratio into $s$, making the transform appear valid while masking the actual data defect. Always normalize units explicitly via [Unit Conversion Pipelines](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/) before extracting control points.

### Mixed projection inputs

Attempting synchronization across datasets in different map projections (e.g., one in EPSG:32632 UTM and another in a local arbitrary grid) will fold projection distortion into both the scale factor and the rotation matrix. Execute [CRS Normalization Workflows](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/) first to project everything into a shared local Cartesian system.

### BIM millimetre precision vs. GIS centimetre rounding

BIM authoring tools use millimetre-precision floating-point arithmetic; GIS survey exports often carry centimetre-level rounding. After applying the synchronization transform, execute a secondary coordinate rounding pass aligned to the target system's precision standard. Do not round before the transform — precision loss in control points degrades the SVD solve.

### Datum shift hidden inside control points

If control points were collected in different survey epochs or against different geoid models, the transform will fit those points but carry a systematic error across all others. Always confirm that source and target control points share a common datum and epoch, and include independent check points — points excluded from the Procrustes solve — in the residual report.

## Validation and Testing

Post-transform validation has two layers: residual analysis on the control points used for the solve, and independent check-point verification on points excluded from the solve.

```python
# numpy>=1.24
def validate_transform(
    R: np.ndarray,
    s: float,
    t: np.ndarray,
    check_src: np.ndarray,
    check_tgt: np.ndarray,
    rmse_threshold: float = 0.05,
    max_residual_threshold: float = 0.10,
) -> dict:
    """
    Validate a precomputed transform against independent check points
    that were NOT used in the SVD solve.
    """
    predicted = apply_transform(check_src, R, s, t)
    residuals = np.linalg.norm(predicted - check_tgt, axis=1)
    rmse = float(np.sqrt(np.mean(residuals ** 2)))
    max_res = float(residuals.max())
    passed = rmse <= rmse_threshold and max_res <= max_residual_threshold
    return {
        "passed": passed,
        "rmse_m": rmse,
        "max_residual_m": max_res,
        "per_point_residuals": residuals.tolist(),
    }


def test_similarity_transform_identity():
    """Unit test: identity transform returns near-zero residuals."""
    pts = np.array([[0.0, 0.0], [1.0, 0.0], [0.0, 1.0], [1.0, 1.0]])
    R, s, t, residuals = compute_similarity_transform(pts, pts)
    assert np.allclose(R, np.eye(2), atol=1e-10), "Expected identity rotation."
    assert np.isclose(s, 1.0, atol=1e-10), "Expected unit scale."
    assert np.allclose(residuals, 0.0, atol=1e-10), "Expected zero residuals."


def test_similarity_transform_known_scale():
    """Unit test: 2× uniform scale is recovered correctly."""
    src = np.array([[0.0, 0.0], [10.0, 0.0], [0.0, 10.0]])
    tgt = src * 2.0
    R, s, t, residuals = compute_similarity_transform(src, tgt)
    assert np.isclose(s, 2.0, atol=1e-9), f"Expected scale 2.0, got {s}."
    assert residuals.max() < 1e-9
```

Typical tolerance thresholds by use case:

| Use case | RMSE target | Max residual |
|---|---|---|
| Site planning / GIS overlay | ≤ 50 mm | ≤ 100 mm |
| Structural BIM coordination | ≤ 5 mm | ≤ 10 mm |
| Cadastral / legal boundary | ≤ 20 mm | ≤ 40 mm |
| Digital twin / as-built | ≤ 10 mm | ≤ 25 mm |

## Performance and Scale

For pipelines processing thousands of project files or dense point clouds:

**Vectorize geometry application.** `apply_transform()` already operates on the full `(N, d)` array in one NumPy call. Never loop over individual points.

**Cache the transform parameters.** Compute `(R, s, t)` once per dataset and serialise it as JSON alongside the source file. Re-running the SVD solve per feature class is unnecessary and introduces floating-point divergence.

**Chunked processing for large meshes.** When transforming mesh vertex arrays that exceed available RAM, process in chunks of 500 000 rows using a generator:

```python
# numpy>=1.24
def apply_transform_chunked(
    geometry_path: str,
    R: np.ndarray,
    s: float,
    t: np.ndarray,
    chunk_size: int = 500_000,
):
    """Yield transformed chunks from a memory-mapped vertex array."""
    verts = np.load(geometry_path, mmap_mode="r")
    for i in range(0, len(verts), chunk_size):
        chunk = verts[i : i + chunk_size]
        yield apply_transform(chunk, R, s, t)
```

**RANSAC for noisy control points.** When control points come from automated feature matching rather than surveyed monuments, wrap the SVD solve in a RANSAC loop that randomly samples minimal sets of three points, evaluates inlier count against the full set, and selects the hypothesis with the most inliers before running the final SVD on all inliers. This prevents a single mismatched pair from corrupting the entire transform.

## FAQ

<details>
<summary><strong>Why does my rotation matrix have determinant −1 after SVD?</strong></summary>

A determinant of −1 indicates an improper rotation — a reflection combined with rotation. This happens when SVD finds a solution that minimises error by mirroring the geometry. Fix it by negating the last row of `Vt` before computing `R = Vt.T @ U.T`. Always assert `np.isclose(np.linalg.det(R), 1.0)` in production.
</details>

<details>
<summary><strong>Can I apply a similarity transform across different map projections?</strong></summary>

No. Always reproject both datasets into a common local Cartesian system (e.g., UTM zone, State Plane, or a custom local projection) before computing the transform. Mixing geographic coordinates (degrees) with projected coordinates (metres) introduces angular distortion that corrupts both the scale factor and the rotation matrix.
</details>

<details>
<summary><strong>How many control points do I need?</strong></summary>

Three non-collinear points are the mathematical minimum for a 2D similarity problem. In practice, use 6–12 well-distributed points and apply a RANSAC pre-filter to remove outliers. More points improve least-squares stability and allow robust residual statistics. For 3D transforms, you need at least four non-coplanar points.
</details>

<details>
<summary><strong>Does this transform handle DXF INSUNITS mismatches automatically?</strong></summary>

No. The similarity transform computes scale empirically from control-point distances. A DXF drawn in millimetres whose `$INSUNITS` header is absent or wrong will absorb the 1000× mismatch into $s$, masking the root cause. Normalise units through your [Unit Conversion Pipelines](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/) before computing the transform.
</details>

<details>
<summary><strong>Can I reuse one transform matrix across the entire dataset?</strong></summary>

Yes — and you should. Provided the dataset has a single consistent spatial reference, compute `(R, s, t)` once, serialise it, and apply it uniformly to every geometry array. Recomputing per feature is wasteful and can introduce floating-point divergence when control points are re-sampled.
</details>

---

## Related Pages

- [Coordinate Transformation & Spatial Alignment](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/) — parent pipeline overview
- [CRS Normalization Workflows](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/) — required upstream step: project all inputs into a common Cartesian space before synchronization
- [Unit Conversion Pipelines](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/) — resolve DXF, IFC, and survey unit mismatches before control-point extraction
- [Layer Mapping Logic](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/) — downstream step: attribute aligned geometry to discipline-specific layers
- [Aligning BIM Models with GIS Survey Data](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/aligning-bim-models-with-gis-survey-data/) — applied walkthrough using this transform for Revit-to-GIS alignment
- [Computing RMSE for Control Point Alignment in Python](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/computing-rmse-for-control-point-alignment-in-python/) — measuring a fit on check points held back from it, and acting on the maximum
- [Detecting Mirrored Transforms in Python](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/detecting-mirrored-transforms-in-python/) — the reflection that fits control points perfectly and mirrors the model
