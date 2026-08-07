---
title: "Applying a Helmert 7-Parameter Transform in Python"
description: "Implement the Bursa-Wolf seven-parameter datum transform in Python with numpy and pyproj: translations, arc-second rotations, ppm scale and conventions."
slug: "applying-helmert-7-parameter-transform-in-python"
breadcrumb:
  - label: "Coordinate Transformation & Spatial Alignment"
    url: "/coordinate-transformation-spatial-alignment/"
  - label: "CRS Normalization Workflows"
    url: "/coordinate-transformation-spatial-alignment/crs-normalization-workflows/"
  - label: "Applying a Helmert 7-Parameter Transform in Python"
    url: "/coordinate-transformation-spatial-alignment/crs-normalization-workflows/applying-helmert-7-parameter-transform-in-python/"
datePublished: "2026-07-11"
dateModified: "2026-07-11"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Applying a Helmert 7-Parameter Transform in Python",
      "description": "Implement the Bursa-Wolf seven-parameter datum transform in Python with numpy and pyproj: translations, arc-second rotations, ppm scale and conventions.",
      "datePublished": "2026-07-11",
      "dateModified": "2026-07-11",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Coordinate Transformation & Spatial Alignment", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/"},
        {"@type": "ListItem", "position": 2, "name": "CRS Normalization Workflows", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/"},
        {"@type": "ListItem", "position": 3, "name": "Applying a Helmert 7-Parameter Transform in Python", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/applying-helmert-7-parameter-transform-in-python/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Applying a Helmert 7-Parameter Transform in Python",
      "description": "Convert geocentric coordinates between datums using the Bursa-Wolf 7-parameter similarity transform, implemented with numpy and validated against a pyproj helmert pipeline.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Convert geographic coordinates to geocentric ECEF", "text": "Project latitude, longitude, and ellipsoidal height on the source datum into Earth-Centred Earth-Fixed X, Y, Z metres using the source ellipsoid."},
        {"@type": "HowToStep", "position": 2, "name": "Assemble the seven parameters", "text": "Collect three translations in metres, three rotations in arc-seconds, and one scale factor in parts-per-million, all referenced to a documented convention (position_vector or coordinate_frame)."},
        {"@type": "HowToStep", "position": 3, "name": "Apply the similarity transform", "text": "Compute X' = T + (1 + s) * R * X, converting arc-seconds to radians and ppm to a unitless factor, with the small-angle rotation matrix for the chosen convention."},
        {"@type": "HowToStep", "position": 4, "name": "Convert back to geographic and validate", "text": "Transform the target ECEF coordinates back to latitude and longitude on the target ellipsoid, then compare against an independent pyproj helmert pipeline on a control point."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is the difference between the position_vector and coordinate_frame conventions?",
          "acceptedAnswer": {"@type": "Answer", "text": "Both describe the same 7-parameter transform but define the sign of the three rotation parameters in opposite ways. position_vector (EPSG method 1033, Bursa-Wolf) rotates the position vector; coordinate_frame (EPSG method 1032) rotates the reference frame. To switch between them, negate rx, ry, and rz. Using the wrong convention produces an error of a few metres that is easy to mistake for noise."}
        },
        {
          "@type": "Question",
          "name": "Can I apply a Helmert transform directly to latitude and longitude?",
          "acceptedAnswer": {"@type": "Answer", "text": "No. The 7-parameter transform is defined on geocentric Cartesian (ECEF) coordinates in metres. You must convert geographic coordinates to ECEF on the source ellipsoid first, apply the transform, then convert the result back to geographic on the target ellipsoid. Applying the parameters to degrees is meaningless and produces gross errors."}
        },
        {
          "@type": "Question",
          "name": "In what units are the Helmert rotation and scale parameters expressed?",
          "acceptedAnswer": {"@type": "Answer", "text": "Published parameter sets give translations in metres, rotations in arc-seconds, and scale in parts-per-million. Convert arc-seconds to radians (multiply by pi / 648000) and ppm to a unitless factor (multiply by 1e-6, then add 1) before assembling the rotation matrix and scale term. PROJ handles these conversions internally when you pass raw arc-seconds and ppm to the helmert operation."}
        },
        {
          "@type": "Question",
          "name": "When should I use a datum grid shift instead of a 7-parameter Helmert?",
          "acceptedAnswer": {"@type": "Answer", "text": "A single 7-parameter transform models a rigid similarity between two datums and typically achieves decimetre to metre accuracy over a country-sized area. When survey-grade (centimetre) accuracy is required, use a published NTv2 or geoid grid (for example OSTN15 for Great Britain), which captures the local distortions a rigid transform cannot. pyproj selects grid-based operations automatically when the grids are installed."}
        }
      ]
    }
  ]
}
</script>

# Applying a Helmert 7-Parameter Transform in Python

The Helmert 7-parameter transform (also called the Bursa-Wolf similarity transform) maps geocentric coordinates from one datum to another using three translations, three rotations, and a single scale factor. The core equation is `X' = T + (1 + s)·R·X`, evaluated on Earth-Centred Earth-Fixed (ECEF) Cartesian coordinates — never on raw latitude and longitude. This page is an implementation reference within the [CRS Normalization Workflows](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/) topic; read that first for environment setup and version pinning. Below, two independent implementations — a transparent `numpy` version and a `pyproj` helmert pipeline — are cross-validated on a control point so you can trust the parameters before pushing them into a production alignment job.

## How the 7-Parameter Transform Works

A datum is defined by an ellipsoid and its position and orientation relative to the Earth's centre of mass. Two datums — say a national realization and WGS84 — differ by a small rigid motion: a shift of origin, a tiny rotation about each axis, and a scale difference of a few parts-per-million. The 7-parameter transform captures exactly this rigid similarity. It cannot model local distortion, which is why survey authorities publish grid shifts for high-accuracy work.

The transform is defined on geocentric ECEF coordinates, so the full workflow has three stages: convert source geographic coordinates to ECEF using the source ellipsoid, apply the seven parameters, then convert the target ECEF back to geographic on the target ellipsoid. The rotations are small (typically under a few arc-seconds), so the exact rotation matrix is replaced by its small-angle linearisation.

<!-- fig:helmert-ecef-sandwich -->
<svg viewBox="-20 -33.5 514.5 125.8" role="img" aria-label="The Helmert transform operates only on geocentric XYZ, so a datum conversion converts geodetic coordinates to ECEF first and back afterwards" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:515px;display:block;margin:1.5rem auto;">
  <title>Where the Helmert transform sits in a datum conversion</title>
  <desc>A four-stage chain. Geodetic latitude, longitude and height on the source datum are converted to geocentric ECEF XYZ on the source ellipsoid; the seven-parameter similarity transform maps those XYZ values onto the WGS84 geocentric frame; the result is converted back to geodetic coordinates on the WGS84 ellipsoid. The transform itself only ever operates on Cartesian XYZ.</desc>
  <defs>
    <marker id="hel1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="hel1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-33.5" width="514.5" height="125.8" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="90.8" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="45.4" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">φ, λ, h</text>
  <text x="45.4" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">source datum</text>
  <rect x="124.8" y="0" width="99.8" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="174.6" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">X, Y, Z</text>
  <text x="174.6" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">source ellipsoid</text>
  <rect x="258.5" y="0" width="113.1" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="315.1" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">X', Y', Z'</text>
  <text x="315.1" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">WGS84 geocentric</text>
  <rect x="405.6" y="0" width="68.8" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="440" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">φ', λ', h'</text>
  <text x="440" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">WGS84</text>
  <line x1="90.8" y1="24.1" x2="124.8" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#hel1-a)"/>
  <text x="107.8" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">geodetic → ECEF</text>
  <line x1="224.5" y1="24.1" x2="258.5" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#hel1-a)"/>
  <text x="241.5" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">7 parameters</text>
  <line x1="371.6" y1="24.1" x2="405.6" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#hel1-a)"/>
  <text x="388.6" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">ECEF → geodetic</text>
  <text x="0" y="70.2" font-size="9.5" fill="currentColor" fill-opacity="0.7">The similarity transform never sees an angle — only Cartesian metres.</text>
</svg>
<!-- /fig:helmert-ecef-sandwich -->

$$
\begin{pmatrix} X' \\ Y' \\ Z' \end{pmatrix}
= \begin{pmatrix} t_x \\ t_y \\ t_z \end{pmatrix}
+ (1 + s)\,\mathbf{R}\begin{pmatrix} X \\ Y \\ Z \end{pmatrix}
$$

Here `(t_x, t_y, t_z)` are the translations in metres, `s` is the scale expressed as a unitless factor (a value given in ppm is multiplied by $10^{-6}$), and $\mathbf{R}$ is the small-angle rotation matrix built from `r_x, r_y, r_z` in radians:

$$
\mathbf{R} =
\begin{pmatrix}
1 & -r_z & r_y \\
r_z & 1 & -r_x \\
-r_y & r_x & 1
\end{pmatrix}
$$

This is the **position_vector** convention (EPSG method 1033). The **coordinate_frame** convention (EPSG method 1032) flips the sign of every off-diagonal rotation term — equivalently, it negates `r_x, r_y, r_z`. The magnitude of the rotations is identical; only their sign differs. A parameter set is meaningless without its convention label, and mixing them is the single most common source of a few-metre systematic error.

<svg viewBox="-10 34 752 192" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Helmert datum transform pipeline: source geographic to ECEF, seven-parameter similarity transform, then ECEF back to WGS84 geographic" style="width:100%;max-width:760px;display:block;margin:1.5rem auto;">
  <title>Helmert 7-Parameter Datum Transform Pipeline</title>
  <desc>Data flows from source-datum geographic coordinates through a cartesian conversion into geocentric ECEF metres, through the seven-parameter similarity transform, back through an inverse cartesian conversion into WGS84 geographic coordinates. Below the flow, the governing equation is shown.</desc>
  <defs>
    <marker id="harrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor"/>
    </marker>
  </defs>
  <rect x="-10" y="34" width="752" height="192" fill="var(--color-surface)"/>
  <rect x="6" y="70" width="150" height="70" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="81" y="100" text-anchor="middle" font-size="11" fill="currentColor" font-family="system-ui,sans-serif">Source datum</text>
  <text x="81" y="118" text-anchor="middle" font-size="10" fill="currentColor" font-family="system-ui,sans-serif" opacity="0.75">geographic (&#966;, &#955;, h)</text>
  <line x1="156" y1="105" x2="192" y2="105" stroke="currentColor" stroke-width="1.5" marker-end="url(#harrow)"/>
  <text x="176" y="60" text-anchor="middle" font-size="9" fill="currentColor" font-family="system-ui,sans-serif" opacity="0.8">+proj=cart</text>
  <rect x="196" y="70" width="150" height="70" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="271" y="100" text-anchor="middle" font-size="11" fill="currentColor" font-family="system-ui,sans-serif">ECEF X, Y, Z</text>
  <text x="271" y="118" text-anchor="middle" font-size="10" fill="currentColor" font-family="system-ui,sans-serif" opacity="0.75">source, metres</text>
  <line x1="346" y1="105" x2="382" y2="105" stroke="currentColor" stroke-width="1.5" marker-end="url(#harrow)"/>
  <text x="364" y="60" text-anchor="middle" font-size="9" fill="currentColor" font-family="system-ui,sans-serif" opacity="0.8">7-param helmert</text>
  <rect x="386" y="70" width="150" height="70" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="461" y="100" text-anchor="middle" font-size="11" fill="currentColor" font-family="system-ui,sans-serif">ECEF X', Y', Z'</text>
  <text x="461" y="118" text-anchor="middle" font-size="10" fill="currentColor" font-family="system-ui,sans-serif" opacity="0.75">WGS84, metres</text>
  <line x1="536" y1="105" x2="572" y2="105" stroke="currentColor" stroke-width="1.5" marker-end="url(#harrow)"/>
  <text x="554" y="60" text-anchor="middle" font-size="9" fill="currentColor" font-family="system-ui,sans-serif" opacity="0.8">+inv +proj=cart</text>
  <rect x="576" y="70" width="150" height="70" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="651" y="100" text-anchor="middle" font-size="11" fill="currentColor" font-family="system-ui,sans-serif">WGS84</text>
  <text x="651" y="118" text-anchor="middle" font-size="10" fill="currentColor" font-family="system-ui,sans-serif" opacity="0.75">geographic (lon, lat)</text>
  <text x="366" y="190" text-anchor="middle" font-size="12" fill="currentColor" font-family="system-ui,sans-serif" opacity="0.85">X' = T + (1 + s) &#183; R &#183; X</text>
  <text x="366" y="208" text-anchor="middle" font-size="9" fill="currentColor" font-family="system-ui,sans-serif" opacity="0.6">rotations in arc-seconds, scale in ppm, applied in ECEF</text>
</svg>

`pyproj` (through the PROJ engine) implements the transform as a `+proj=helmert` operation and handles the arc-second and ppm conversions internally. The `numpy` version below makes every step explicit so you can audit the sign convention and unit handling yourself, then confirms it matches PROJ to sub-millimetre agreement.

## Production-Ready Script

The script converts a geographic control point on a source datum to WGS84 two ways: a hand-written `numpy` Helmert on ECEF coordinates, and a `pyproj` helmert pipeline. It then confirms the two agree, which validates both the parameters and the convention.

```python
# numpy>=1.24.0, pyproj>=3.5.0, Python 3.9+
from __future__ import annotations

import numpy as np
from pyproj import Transformer

ARCSEC_TO_RAD = np.pi / 648000.0  # pi / (180 * 3600)


def geodetic_to_ecef(lon, lat, h, a: float, f: float) -> np.ndarray:
    """Geographic (deg, deg, m) -> geocentric ECEF (m) on the given ellipsoid."""
    lon = np.radians(np.asarray(lon, dtype=np.float64))
    lat = np.radians(np.asarray(lat, dtype=np.float64))
    h = np.asarray(h, dtype=np.float64)
    e2 = f * (2.0 - f)                      # first eccentricity squared
    n = a / np.sqrt(1.0 - e2 * np.sin(lat) ** 2)  # prime vertical radius
    x = (n + h) * np.cos(lat) * np.cos(lon)
    y = (n + h) * np.cos(lat) * np.sin(lon)
    z = (n * (1.0 - e2) + h) * np.sin(lat)
    return np.column_stack((x, y, z))


def ecef_to_geodetic(xyz: np.ndarray, a: float, f: float):
    """Geocentric ECEF (m) -> geographic (deg, deg, m); Bowring iteration."""
    xyz = np.atleast_2d(np.asarray(xyz, dtype=np.float64))
    x, y, z = xyz[:, 0], xyz[:, 1], xyz[:, 2]
    e2 = f * (2.0 - f)
    b = a * (1.0 - f)
    p = np.hypot(x, y)
    lat = np.arctan2(z, p * (1.0 - e2))     # initial guess
    for _ in range(6):                      # converges in <5 for terrestrial data
        n = a / np.sqrt(1.0 - e2 * np.sin(lat) ** 2)
        h = p / np.cos(lat) - n
        lat = np.arctan2(z, p * (1.0 - e2 * n / (n + h)))
    lon = np.arctan2(y, x)
    n = a / np.sqrt(1.0 - e2 * np.sin(lat) ** 2)
    h = p / np.cos(lat) - n
    return np.degrees(lon), np.degrees(lat), h


def helmert_7param(
    xyz: np.ndarray,
    tx: float, ty: float, tz: float,
    rx: float, ry: float, rz: float,   # arc-seconds
    s: float,                          # ppm
    convention: str = "position_vector",
) -> np.ndarray:
    """Apply the 7-parameter similarity transform to ECEF coordinates (N, 3)."""
    xyz = np.atleast_2d(np.asarray(xyz, dtype=np.float64))
    rx, ry, rz = (v * ARCSEC_TO_RAD for v in (rx, ry, rz))
    scale = 1.0 + s * 1e-6
    if convention == "position_vector":
        r = np.array([[1.0, -rz, ry], [rz, 1.0, -rx], [-ry, rx, 1.0]])
    elif convention == "coordinate_frame":
        r = np.array([[1.0, rz, -ry], [-rz, 1.0, rx], [ry, -rx, 1.0]])
    else:
        raise ValueError(f"Unknown convention: {convention!r}")
    t = np.array([tx, ty, tz])
    return t + scale * (xyz @ r.T)


if __name__ == "__main__":
    # Illustrative parameters: a national datum -> WGS84, position_vector.
    # Always take the values (and convention) from an authoritative registry.
    TX, TY, TZ = -446.448, 125.157, -542.060      # metres
    RX, RY, RZ = -0.1502, -0.2470, -0.8421        # arc-seconds
    S = 20.4894                                    # ppm
    # Source ellipsoid (Airy 1830) and target ellipsoid (WGS84 / GRS80-like).
    SRC_A, SRC_F = 6377563.396, 1.0 / 299.3249646
    WGS_A, WGS_F = 6378137.0, 1.0 / 298.257223563

    # A control point expressed on the source datum.
    lon0, lat0, h0 = -1.54700, 55.00000, 100.0

    # --- (a) numpy path: geographic -> ECEF -> Helmert -> geographic ---
    src_ecef = geodetic_to_ecef(lon0, lat0, h0, SRC_A, SRC_F)
    dst_ecef_np = helmert_7param(src_ecef, TX, TY, TZ, RX, RY, RZ, S,
                                 convention="position_vector")
    lon_np, lat_np, h_np = ecef_to_geodetic(dst_ecef_np, WGS_A, WGS_F)

    # --- (b) pyproj path: a helmert pipeline operating directly on ECEF ---
    # PROJ takes rotations in arc-seconds and scale in ppm as given.
    pipeline = (
        f"+proj=pipeline +step +proj=helmert "
        f"+x={TX} +y={TY} +z={TZ} +rx={RX} +ry={RY} +rz={RZ} +s={S} "
        f"+convention=position_vector"
    )
    ecef_tf = Transformer.from_pipeline(pipeline)
    dst_ecef_pj = np.column_stack(
        ecef_tf.transform(src_ecef[:, 0], src_ecef[:, 1], src_ecef[:, 2])
    )

    residual = np.linalg.norm(dst_ecef_np - dst_ecef_pj)
    print(f"numpy vs pyproj ECEF agreement: {residual * 1e3:.4f} mm")
    print(f"WGS84 control point: lon={lon_np[0]:.8f}  lat={lat_np[0]:.8f}")
    assert residual < 1e-3, "numpy and pyproj disagree — check convention/units"
```

**Key implementation notes:**

- `geodetic_to_ecef` and `ecef_to_geodetic` use each datum's own ellipsoid — the source ellipsoid going in, the target ellipsoid coming out. Using WGS84 on both ends silently discards the ellipsoid difference and biases height.
- The `numpy` rotation matrix is written for both conventions in one place. Flip `convention` and the off-diagonal signs flip — the exact behaviour PROJ applies internally.
- The `pyproj` pipeline is deliberately *ECEF-in, ECEF-out* so it isolates the Helmert step for direct numerical comparison. In production you would prepend `+step +proj=cart +ellps=<src>` and append `+step +inv +proj=cart +ellps=WGS84` to accept and return geographic coordinates.
- The `assert` at the end is the validation: sub-millimetre agreement on ECEF confirms the parameters, the arc-second conversion, and the convention are all consistent. If it fires, the convention is the first thing to check.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| Python | 3.9 – 3.13 | Uses `from __future__ import annotations`; no 3.10-only syntax. |
| pyproj | 3.5.0 – 3.7.x | `Transformer.from_pipeline` and `+proj=helmert` stable since 3.x; 3.5+ recommended for current PROJ. |
| PROJ (C library) | 8.0 – 9.x | 9.x ships broader NTv2/geoid grid coverage for grid-based alternatives. |
| numpy | 1.24 – 2.x | Only `svd`-free linear algebra and broadcasting are used. |
| Convention | position_vector / coordinate_frame | Must match the source of the parameters; PROJ requires it explicitly. |
| Parameter units | metres / arc-seconds / ppm | PROJ consumes arc-seconds and ppm directly; the numpy path converts them. |

## Fallback Strategies

**1. Convention sign confusion (position_vector vs coordinate_frame)**

<!-- fig:helmert-sign-conventions -->
<svg viewBox="-20 -20 570 194.1" role="img" aria-label="Position-vector and coordinate-frame Helmert conventions differ only by the sign of the three rotation terms, and mixing them leaves a metre-scale residual" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:570px;display:block;margin:1.5rem auto;">
  <title>Position-vector versus coordinate-frame rotation conventions</title>
  <desc>Two panels contrasting the two rotation sign conventions used by published Helmert parameter sets. The position-vector convention rotates the point about the axes; the coordinate-frame convention rotates the axes about the point, which negates all three rotation terms. Using a parameter set under the wrong convention leaves a metre-scale residual that scales with distance from the origin.</desc>
  <defs>
    <marker id="hel2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="hel2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="570" height="194.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="250" height="130" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="125" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">position_vector (EPSG 9606)</text>
  <line x1="14" y1="33" x2="236" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="16" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— rotates the POINT about the axes</text>
  <text x="16" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— rx, ry, rz as published</text>
  <text x="16" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— PROJ: +convention=position_vector</text>
  <text x="16" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— used by most EPSG transformations</text>
  <rect x="280" y="0" width="250" height="130" rx="6" fill="currentColor" fill-opacity="0.11" stroke="currentColor" stroke-width="1.9"/>
  <text x="405" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">coordinate_frame (EPSG 9607)</text>
  <line x1="294" y1="33" x2="516" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="296" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— rotates the AXES about the point</text>
  <text x="296" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— rx, ry, rz all negated</text>
  <text x="296" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— PROJ: +convention=coordinate_frame</text>
  <text x="296" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— common in national grid documents</text>
  <text x="265" y="152" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">Same numbers, opposite signs — the residual grows with distance from the geocentre.</text>
</svg>
<!-- /fig:helmert-sign-conventions -->

A result that is offset by a consistent few metres — same direction for every point — almost always means the rotation signs are inverted. Registries and vendors disagree on which convention they publish, and some omit the label. If you only have one set of rotations, test both: negate `r_x, r_y, r_z` and re-run against a known control point. The correct convention drives the control-point residual toward zero; the wrong one leaves a stubborn systematic bias.

**2. Rotations left in arc-seconds (or degrees) instead of radians**

In the `numpy` path the rotation terms must be radians. An arc-second is about `4.85e-6` rad, so forgetting the `ARCSEC_TO_RAD` factor scales the rotation by ~206265 and throws points thousands of kilometres. PROJ avoids this by consuming arc-seconds directly — do not "pre-convert" values you pass to `+rx/+ry/+rz`, or you will double-apply the factor.

**3. Applying the transform to geographic coordinates**

The parameters are defined in ECEF metres. Passing degrees of latitude and longitude into `helmert_7param` produces nonsense. Always run the cartesian conversion first. When in doubt, sanity-check that your ECEF magnitudes are on the order of `6.4e6` metres before the Helmert step.

**4. Ellipsoid mismatch on the return conversion**

The inverse cartesian step must use the *target* ellipsoid. A common bug is reusing the source ellipsoid for both directions, which leaves a height error of tens of metres and a small horizontal shift. Keep the source and target ellipsoid parameters in separate, clearly named constants — as in the script — and pass the right pair to each conversion.

**5. Prefer a datum grid shift for survey-grade accuracy**

A single 7-parameter transform is a rigid model; it cannot absorb the local, non-linear distortion between datums that survey networks exhibit. Over a country it is typically accurate to a few decimetres. When you need centimetres, use a published NTv2 or geoid grid (for example OSTN15 for Great Britain, or the appropriate NADCON/NTv2 grid for North America). `pyproj` will select a grid-based operation automatically when the grids are installed — see the pyproj-based reprojection covered in [Reprojecting CAD Coordinates with pyproj Transformer](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/reprojecting-cad-coordinates-with-pyproj-transformer/), and confirm grid availability with `pyproj.datadir`.

For the georeferencing metadata that supplies these parameters in a BIM context, see [Reading IFC Georeferencing with ifcopenshell](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/reading-ifc-georeferencing-with-ifcopenshell/), and for the simpler 2D case where survey control replaces published datum parameters, see [Converting CAD Local Coordinates to EPSG:4326](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/converting-cad-local-coordinates-to-epsg4326/).

## FAQ

<details>
<summary><strong>What is the difference between the position_vector and coordinate_frame conventions?</strong></summary>

Both describe the same physical 7-parameter transform but define the sign of the three rotation parameters in opposite ways. `position_vector` (EPSG method 1033, the classic Bursa-Wolf form) rotates the position vector; `coordinate_frame` (EPSG method 1032) rotates the reference frame. To convert a parameter set from one to the other, negate `r_x`, `r_y`, and `r_z` — the translations and scale are unchanged. Using the wrong convention produces a consistent error of a few metres.

</details>

<details>
<summary><strong>Can I apply a Helmert transform directly to latitude and longitude?</strong></summary>

No. The transform is defined on geocentric Cartesian (ECEF) coordinates in metres. Convert geographic coordinates to ECEF on the source ellipsoid, apply the seven parameters, then convert the target ECEF back to geographic on the target ellipsoid. Applying the parameters to angular degrees is dimensionally meaningless and produces gross errors.

</details>

<details>
<summary><strong>In what units are the rotation and scale parameters expressed?</strong></summary>

Published sets give translations in metres, rotations in arc-seconds, and scale in parts-per-million. In a hand-written implementation, convert arc-seconds to radians (multiply by `pi / 648000`) and ppm to a unitless factor (`1 + s * 1e-6`). PROJ performs both conversions internally, so pass raw arc-seconds and ppm straight to `+rx/+ry/+rz` and `+s`.

</details>

<details>
<summary><strong>When should I use a datum grid shift instead of a 7-parameter Helmert?</strong></summary>

Use a grid when you need survey-grade accuracy. A rigid 7-parameter transform models a similarity between two datums and reaches decimetre-to-metre accuracy over a country-sized area. NTv2 and geoid grids (such as OSTN15 for Great Britain) capture the local distortion a rigid transform cannot, achieving centimetre accuracy. `pyproj` picks a grid-based operation automatically when the required grids are present in its data directory.

</details>

---

## Related Pages

- [CRS Normalization Workflows](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/) — parent topic: full pipeline from CRS detection through datum transformation and validation
- [Reprojecting CAD Coordinates with pyproj Transformer](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/reprojecting-cad-coordinates-with-pyproj-transformer/) — vectorized reprojection and automatic operation selection once the datum is resolved
- [Converting CAD Local Coordinates to EPSG:4326](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/converting-cad-local-coordinates-to-epsg4326/) — the 2D survey-control counterpart when no published datum parameters exist
- [Reading IFC Georeferencing with ifcopenshell](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/reading-ifc-georeferencing-with-ifcopenshell/) — extracting the datum and map-conversion metadata that feed these parameters
- [Coordinate Transformation & Spatial Alignment](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/) — domain overview covering datum alignment, unit conversion, and layer mapping
