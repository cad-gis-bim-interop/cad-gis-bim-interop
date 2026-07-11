---
title: "Rotating CAD Geometry to True North in Python"
description: "Rotate DXF geometry from CAD project north to true or grid north using $NORTHDIRECTION or a survey bearing, with a numpy 2D rotation about the base point."
slug: "rotating-cad-geometry-to-true-north-in-python"
breadcrumb:
  - label: "Coordinate Transformation & Spatial Alignment"
    url: "/coordinate-transformation-spatial-alignment/"
  - label: "Scale and Rotation Synchronization"
    url: "/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/"
  - label: "Rotating CAD Geometry to True North"
    url: "/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/rotating-cad-geometry-to-true-north-in-python/"
datePublished: "2026-07-11"
dateModified: "2026-07-11"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Rotating CAD Geometry to True North in Python",
      "description": "Rotate DXF geometry from CAD project north to true or grid north using $NORTHDIRECTION or a survey bearing, with a numpy 2D rotation about the base point.",
      "datePublished": "2026-07-11",
      "dateModified": "2026-07-11",
      "author": {"@type": "Organization", "name": "CAD GIS BIM Interop"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/rotating-cad-geometry-to-true-north-in-python/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Coordinate Transformation & Spatial Alignment", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/"},
        {"@type": "ListItem", "position": 2, "name": "Scale and Rotation Synchronization", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/"},
        {"@type": "ListItem", "position": 3, "name": "Rotating CAD Geometry to True North", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/rotating-cad-geometry-to-true-north-in-python/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Rotate CAD Geometry to True North in Python",
      "description": "Derive the rotation angle from $NORTHDIRECTION or a documented bearing, build a 2D rotation matrix, and rotate all vertices about the survey base point.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Determine the rotation angle", "text": "Read $NORTHDIRECTION (radians in the UCS) from the DXF header, or use a documented survey bearing, to compute the angle theta from project north to true north."},
        {"@type": "HowToStep", "position": 2, "name": "Choose the rotation centre", "text": "Rotate about the survey base point (the shared control point), not the arbitrary drawing origin, so the geometry stays registered to the control network."},
        {"@type": "HowToStep", "position": 3, "name": "Build the rotation matrix", "text": "Construct the 2D rotation matrix from cos(theta) and sin(theta) with numpy, respecting counter-clockwise-positive convention."},
        {"@type": "HowToStep", "position": 4, "name": "Rotate and translate", "text": "Subtract the base point, apply the rotation matrix, add the base point back, then translate to the GIS control coordinate."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Is $NORTHDIRECTION in degrees or radians?",
          "acceptedAnswer": {"@type": "Answer", "text": "$NORTHDIRECTION is stored in radians and measured in the drawing's UCS. numpy trigonometric functions also take radians, so no conversion is needed if you read it directly. If you instead work from a survey bearing given in degrees, convert with numpy.radians before building the rotation matrix."}
        },
        {
          "@type": "Question",
          "name": "Should I rotate about the origin or the base point?",
          "acceptedAnswer": {"@type": "Answer", "text": "Rotate about the survey base point, the shared control point common to the CAD drawing and the GIS control network. Rotating about the arbitrary drawing origin swings geometry through a large arc and destroys registration. Subtract the base point, rotate, then add it back."}
        },
        {
          "@type": "Question",
          "name": "What is the difference between true north and grid north?",
          "acceptedAnswer": {"@type": "Answer", "text": "True north points to the geographic pole; grid north follows the projection's northing axis. They differ by the grid convergence angle, which varies with location and can reach several degrees away from a projection's central meridian. Decide explicitly which north your target CRS uses and apply convergence if you need true north."}
        },
        {
          "@type": "Question",
          "name": "Why is my geometry rotated the wrong way?",
          "acceptedAnswer": {"@type": "Answer", "text": "The sign of the angle is inverted. The standard 2D rotation matrix rotates counter-clockwise for positive theta, but bearings are measured clockwise from north. To rotate from project north to a clockwise bearing, negate the angle. Verify by checking a known point lands where expected after rotation."}
        }
      ]
    }
  ]
}
</script>

# Rotating CAD Geometry to True North in Python

CAD drawings are usually drafted around a convenient **project north** that does not match **true** or **grid north**; the difference is a survey rotation angle that must be applied before the geometry can be aligned with GIS data. To correct it in Python, derive the angle from the DXF header variable `$NORTHDIRECTION` (stored in radians, measured in the UCS) or from a documented survey bearing, build a 2D rotation matrix with `numpy`, and rotate every vertex about the survey **base point** rather than the drawing origin. This page is part of the [Scale and Rotation Synchronization](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/) workflow, and it handles the rotational component that must be resolved before or alongside translation when [aligning BIM models with GIS survey data](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/aligning-bim-models-with-gis-survey-data/).

## How CAD North Differs From True North

A CAD drawing has its own internal orientation. Drafters align plans to the sheet or to a dominant building face, so "up" on the drawing — project north — is an arbitrary direction. True north (toward the geographic pole) and grid north (the northing axis of the target map projection) are fixed by geodesy and cartography. The angle between project north and the north you want to align to is the rotation you must apply.

DXF records the drawing's north reference in the header variable `$NORTHDIRECTION`, an angle in **radians** measured in the current UCS. Reading it with `doc.header.get("$NORTHDIRECTION", 0.0)` gives you the angle of the north direction; the rotation needed to bring project north onto the UCS Y axis is derived from it. When `$NORTHDIRECTION` is absent or unreliable, fall back to a documented survey bearing supplied by the surveyor — for example "grid north is 12.5° clockwise from project north".

The rotation itself is a rigid 2D transform about a chosen centre. For a point $(x, y)$ rotated by angle $\theta$ about the base point $(x_0, y_0)$:

$$
\begin{bmatrix} x' \\ y' \end{bmatrix} =
\begin{bmatrix} \cos\theta & -\sin\theta \\ \sin\theta & \cos\theta \end{bmatrix}
\begin{bmatrix} x - x_0 \\ y - y_0 \end{bmatrix} +
\begin{bmatrix} x_0 \\ y_0 \end{bmatrix}
$$

The matrix as written rotates **counter-clockwise** for positive $\theta$, the mathematical convention `numpy` expects. Survey bearings are measured **clockwise** from north, so a clockwise bearing must be negated before it goes into this matrix — the single most common source of a mirrored result.

<svg viewBox="0 0 660 300" role="img" aria-label="Diagram of a survey rotation: project north points straight up from the base point, true north is offset by angle theta, and a building footprint is rotated about the base point to align with true north" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:660px;display:block;margin:1.5rem auto;">
  <title>Rotating a Footprint from Project North to True North</title>
  <desc>A base point at lower left has a project-north arrow pointing straight up and a true-north arrow offset clockwise by the survey angle theta. A dashed building footprint aligned to project north is shown rotated by theta into a solid footprint aligned to true north about the base point.</desc>
  <defs>
    <marker id="na" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor"/>
    </marker>
  </defs>
  <!-- Base point -->
  <circle cx="150" cy="240" r="5" fill="currentColor"/>
  <text x="150" y="266" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">base point (x0, y0)</text>
  <!-- Project north arrow (straight up) -->
  <line x1="150" y1="240" x2="150" y2="70" stroke="currentColor" stroke-width="1.5" marker-end="url(#na)"/>
  <text x="150" y="58" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">Project North</text>
  <!-- True north arrow (rotated clockwise ~22 deg) -->
  <line x1="150" y1="240" x2="214" y2="82" stroke="currentColor" stroke-width="1.5" opacity="0.7" marker-end="url(#na)"/>
  <text x="238" y="76" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif" opacity="0.8">True North</text>
  <!-- theta arc -->
  <path d="M150,110 A130,130 0 0,1 179,116" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.7"/>
  <text x="182" y="108" font-size="12" fill="currentColor" font-family="sans-serif" opacity="0.85">&#952;</text>
  <!-- Footprint aligned to project north (dashed) -->
  <rect x="360" y="150" width="120" height="70" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="5 4" opacity="0.55"/>
  <text x="420" y="140" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">before (project north)</text>
  <!-- Footprint rotated (solid, rotate about a point) -->
  <g transform="rotate(22 560 200)">
    <rect x="500" y="165" width="120" height="70" fill="none" stroke="currentColor" stroke-width="1.6"/>
  </g>
  <text x="560" y="262" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif">after (true north)</text>
  <!-- rotate arrow between footprints -->
  <path d="M485,205 A60,60 0 0,1 495,183" fill="none" stroke="currentColor" stroke-width="1.3" opacity="0.7" marker-end="url(#na)"/>
</svg>

## Production-Ready Script

The script reads `$NORTHDIRECTION` (or accepts an explicit bearing in degrees), builds the rotation matrix with `numpy`, and rotates all `LWPOLYLINE`, `LINE`, and `POINT` vertices about a supplied base point. It vectorises the rotation with a single matrix multiply and can optionally translate the rotated geometry onto a GIS control coordinate.

```python
# ezdxf>=1.1.0 | numpy>=1.24 | python>=3.9
from __future__ import annotations

import logging
import numpy as np
import ezdxf
from ezdxf.document import Drawing

log = logging.getLogger("dxf_true_north")


def rotation_angle(
    doc: Drawing,
    survey_bearing_deg: float | None = None,
    bearing_clockwise: bool = True,
) -> float:
    """
    Return the counter-clockwise rotation angle (radians) to apply.
    Priority: explicit survey_bearing_deg, else $NORTHDIRECTION (radians, UCS).
    A clockwise bearing is negated to match numpy's CCW-positive convention.
    """
    if survey_bearing_deg is not None:
        theta = np.radians(survey_bearing_deg)
        return -theta if bearing_clockwise else theta

    # $NORTHDIRECTION is already in radians, measured in the UCS.
    north = float(doc.header.get("$NORTHDIRECTION", 0.0))
    if north == 0.0:
        log.warning("$NORTHDIRECTION=0 and no survey_bearing_deg supplied; "
                    "no rotation will be applied. Confirm the drawing's north.")
    # Rotating project north onto the Y axis is a CCW rotation by -north.
    return -north


def rotation_matrix(theta: float) -> np.ndarray:
    """Standard 2D CCW rotation matrix for angle theta (radians)."""
    c, s = np.cos(theta), np.sin(theta)
    return np.array([[c, -s], [s, c]])


def rotate_points(
    points: np.ndarray,
    theta: float,
    base_point: tuple[float, float],
    translate_to: tuple[float, float] | None = None,
) -> np.ndarray:
    """
    Rotate an (N, 2) array about base_point by theta radians, then optionally
    translate the base point onto translate_to (a GIS control coordinate).
    """
    base = np.asarray(base_point, dtype=float)
    r = rotation_matrix(theta)
    # (R @ (P - base).T).T + base  -> rotate about the base point
    rotated = (r @ (points - base).T).T + base
    if translate_to is not None:
        rotated = rotated + (np.asarray(translate_to, dtype=float) - base)
    return rotated


def rotate_document_to_true_north(
    dxf_path: str,
    base_point: tuple[float, float],
    survey_bearing_deg: float | None = None,
    translate_to: tuple[float, float] | None = None,
) -> dict[str, list[np.ndarray]]:
    """
    Read a DXF, compute the rotation angle, and return rotated vertex arrays
    per entity handle for POINT, LINE, and LWPOLYLINE geometry.
    """
    doc = ezdxf.readfile(dxf_path)
    theta = rotation_angle(doc, survey_bearing_deg=survey_bearing_deg)
    log.info("Rotation angle: %.6f rad (%.4f deg) about base %s.",
             theta, np.degrees(theta), base_point)

    out: dict[str, list[np.ndarray]] = {}
    for e in doc.modelspace().query("POINT LINE LWPOLYLINE"):
        if e.dxftype() == "POINT":
            pts = np.array([[e.dxf.location.x, e.dxf.location.y]])
        elif e.dxftype() == "LINE":
            pts = np.array([[e.dxf.start.x, e.dxf.start.y],
                            [e.dxf.end.x, e.dxf.end.y]])
        else:  # LWPOLYLINE
            pts = np.array([[x, y] for x, y, *_ in e.vertices()])
        if pts.size == 0:
            continue
        out[e.dxf.handle] = [rotate_points(pts, theta, base_point, translate_to)]
    return out


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    # Base point is the shared control point; bearing from the surveyor (deg, clockwise).
    result = rotate_document_to_true_north(
        "site.dxf",
        base_point=(1000.0, 2000.0),
        survey_bearing_deg=12.5,
        translate_to=(556000.0, 172000.0),  # e.g. easting/northing control coord
    )
    for handle, arrays in list(result.items())[:3]:
        print(handle, arrays[0].round(3).tolist())
```

**Key implementation notes:**

- `rotation_angle()` centralises the degrees-vs-radians and clockwise-vs-counter-clockwise decisions. `$NORTHDIRECTION` is already radians, so it is used directly; a survey bearing in degrees is converted and negated for the clockwise convention.
- Rotation is about `base_point`, applied by subtracting it, multiplying by the matrix, then adding it back — exactly the matrix expression above. This keeps the shared control point fixed.
- The `numpy` matrix multiply `r @ (points - base).T` rotates all vertices in one vectorised operation, which matters for drawings with hundreds of thousands of vertices.
- `translate_to` composes the rotation with a translation onto the GIS control coordinate, so rotation and registration happen in one pass — the combined operation used when aligning to a survey network.
- Reading `$NORTHDIRECTION` safely alongside other header variables is covered by [how to parse DXF headers with Python](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/how-to-parse-dxf-headers-with-python/).

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `ezdxf` | `>=1.1.0` | `doc.header.get()`, `LWPolyline.vertices()`, `LINE`/`POINT` DXF attributes stable since 1.0. |
| `numpy` | `>=1.24` | Any modern 1.x/2.x works; the code uses only core array ops and trig. |
| Python | `3.9+` | Uses `from __future__ import annotations` and PEP 604 hints. |
| DXF format | `R2000` (`AC1015`) – `R2018` (`AC1032`) | `$NORTHDIRECTION` present since R2000; defaults to 0.0 if omitted. |
| Angle source | `$NORTHDIRECTION` or survey bearing | Header value is radians (UCS); supplied bearings are degrees and clockwise unless configured otherwise. |
| North reference | True or grid north | For grid north, apply the projection convergence angle separately (see fallbacks). |

## Fallback Strategies

**1. Radians vs. degrees.** `$NORTHDIRECTION` and `numpy` trig are both radians; survey bearings are almost always quoted in degrees. Convert once with `np.radians()` at the boundary and keep everything internal in radians. Mixing the two produces rotations off by a factor of ~57.

**2. Rotation centre (base point vs. origin).** Always rotate about the shared survey base point, not the drawing origin. Rotating about the origin swings distant geometry through a huge arc and breaks registration to the control network. If the base point is unknown, request it from the surveyor before proceeding.

**3. Grid vs. true north (convergence).** True north and grid north differ by the projection's grid convergence, which grows with distance from the central meridian and can exceed a couple of degrees. If your target CRS uses grid north, add or subtract the convergence angle for the site before rotating; otherwise a true-north rotation leaves a residual skew against the map grid.

**4. Sign and clockwise-vs-counter-clockwise.** The rotation matrix is counter-clockwise-positive, but bearings are clockwise-from-north. A wrong sign mirrors the geometry. Negate clockwise bearings (as `rotation_angle()` does) and verify by checking that one known point lands where the survey says it should after rotation.

**5. Composing rotation with translation order.** When both rotating and translating to a control coordinate, rotate about the base point first, then translate. Reversing the order rotates the already-translated large coordinates about the base point and displaces everything. Keep the base-point rotation and the final translation as distinct, ordered steps.

## FAQ

<details>
<summary><strong>Is $NORTHDIRECTION in degrees or radians?</strong></summary>

`$NORTHDIRECTION` is stored in radians and measured in the drawing's UCS. `numpy` trigonometric functions also take radians, so no conversion is needed when you read it directly. If you instead work from a survey bearing given in degrees, convert with `numpy.radians()` before building the rotation matrix.

</details>

<details>
<summary><strong>Should I rotate about the origin or the base point?</strong></summary>

Rotate about the survey base point — the shared control point common to the CAD drawing and the GIS control network. Rotating about the arbitrary drawing origin swings geometry through a large arc and destroys registration. Subtract the base point, apply the rotation, then add it back.

</details>

<details>
<summary><strong>What is the difference between true north and grid north?</strong></summary>

True north points to the geographic pole; grid north follows the projection's northing axis. They differ by the grid convergence angle, which varies with location and can reach several degrees away from a projection's central meridian. Decide explicitly which north your target CRS uses and apply convergence if you need true north.

</details>

<details>
<summary><strong>Why is my geometry rotated the wrong way?</strong></summary>

The sign of the angle is inverted. The standard 2D rotation matrix rotates counter-clockwise for positive `theta`, but bearings are measured clockwise from north. To rotate from project north to a clockwise bearing, negate the angle. Verify by checking that a known point lands where expected after rotation.

</details>

---

## Related Pages

- [Scale and Rotation Synchronization](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/) — parent reference on aligning CAD scale and orientation to GIS coordinate systems
- [Aligning BIM Models with GIS Survey Data](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/aligning-bim-models-with-gis-survey-data/) — full rotate-and-translate registration against a survey control network
- [Reprojecting CAD Coordinates with pyproj Transformer](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/reprojecting-cad-coordinates-with-pyproj-transformer/) — reprojecting the true-north-aligned geometry into a target CRS
- [How to Parse DXF Headers with Python](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/how-to-parse-dxf-headers-with-python/) — reading `$NORTHDIRECTION` and related header variables
