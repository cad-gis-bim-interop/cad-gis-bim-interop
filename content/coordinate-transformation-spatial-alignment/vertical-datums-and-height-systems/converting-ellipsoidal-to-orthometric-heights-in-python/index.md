---
title: "Converting Ellipsoidal to Orthometric Heights in Python"
description: "Convert GNSS ellipsoidal heights to orthometric heights with pyproj: build a compound CRS, pass z through the transformer, confirm which geoid grid was used, and validate against a levelled benchmark."
slug: "converting-ellipsoidal-to-orthometric-heights-in-python"
breadcrumb:
  - label: "Coordinate Transformation & Spatial Alignment"
    url: "/coordinate-transformation-spatial-alignment/"
  - label: "Vertical Datums and Height Systems"
    url: "/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/"
  - label: "Converting Ellipsoidal to Orthometric Heights in Python"
    url: "/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/converting-ellipsoidal-to-orthometric-heights-in-python/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Converting Ellipsoidal to Orthometric Heights in Python",
      "description": "Convert GNSS ellipsoidal heights to orthometric heights with pyproj: build a compound CRS, pass z through the transformer, confirm which geoid grid was used, and validate against a levelled benchmark.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/converting-ellipsoidal-to-orthometric-heights-in-python/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Coordinate Transformation & Spatial Alignment", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/"},
        {"@type": "ListItem", "position": 2, "name": "Vertical Datums and Height Systems", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/"},
        {"@type": "ListItem", "position": 3, "name": "Converting Ellipsoidal to Orthometric Heights in Python", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/converting-ellipsoidal-to-orthometric-heights-in-python/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Convert ellipsoidal heights to orthometric heights in Python",
      "description": "Pair each side of the transformation with an explicit vertical CRS, transform in three dimensions, confirm the geoid grid, and check the result against a benchmark.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Confirm the source is ellipsoidal", "text": "Establish that the input heights have not already been geoid-corrected by the survey processing software, because applying the correction twice shifts by twice the separation."},
        {"@type": "HowToStep", "position": 2, "name": "Build compound CRS definitions", "text": "Create source and target coordinate reference systems that each pair a horizontal CRS with an explicit vertical CRS."},
        {"@type": "HowToStep", "position": 3, "name": "Transform with z", "text": "Call transform with the z argument so PROJ selects a vertical operation instead of passing the height through unchanged."},
        {"@type": "HowToStep", "position": 4, "name": "Confirm the grid actually used", "text": "Inspect the operation the transformer selected and assert that the expected national geoid grid was available rather than a global fallback."},
        {"@type": "HowToStep", "position": 5, "name": "Validate against a benchmark", "text": "Transform a levelled benchmark and compare the resulting orthometric height against its published value."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How do I know whether my heights are already orthometric?",
          "acceptedAnswer": {"@type": "Answer", "text": "Ask the survey processing configuration, not the file. Most GNSS post-processing software can output either, and the choice is a setting rather than something recorded in a .csv or a LAS header. The rough magnitude check is that the geoid separation in a given region is a known number — if your heights differ from nearby mapped ground levels by approximately that number, they are ellipsoidal."}
        },
        {
          "@type": "Question",
          "name": "Why is my converted height out by exactly twice the separation?",
          "acceptedAnswer": {"@type": "Answer", "text": "You have applied the correction to data that was already corrected, or you have used a separation with the wrong sign. Both produce an error of 2N. Check the source first: a double correction is far more common than a sign error, because processing software applies the correction by default."}
        },
        {
          "@type": "Question",
          "name": "Does the conversion need to be per point?",
          "acceptedAnswer": {"@type": "Answer", "text": "Yes, for anything survey-grade. The geoid separation varies across a site, and a single value applied to a whole dataset is correct only at the point it was sampled. For a small site the variation may be below tolerance, but that is a decision to make from the numbers rather than an assumption to build in."}
        }
      ]
    }
  ]
}
</script>

# Converting Ellipsoidal to Orthometric Heights in Python

To convert an ellipsoidal height to an orthometric one in Python, build both sides of the transformation as compound coordinate reference systems and pass `z` to `Transformer.transform`. PROJ then selects a vertical transformation, looks up the geoid separation for that horizontal position, and returns the orthometric height. Omit either the compound definition or the `z` argument and the height comes back exactly as it went in, with no error raised. This page is part of the [Vertical Datums and Height Systems](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/) reference.

## How pyproj Decides to Transform a Height

A `Transformer` is built from two coordinate reference systems, and it can only perform operations those systems describe. Two horizontal definitions describe no vertical relationship, so a transformer built from them has no vertical operation to apply. It is not ignoring the height — it was never given a reason to change it.

<!-- fig:e2o-relation -->
<svg viewBox="-20 -20 379.3 156.1" role="img" aria-label="Ellipsoidal height minus geoid separation gives orthometric height, with the separation looked up per position" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>The relation between the two heights</title>
  <desc>The identity that governs the conversion, with one worked position. The ellipsoidal height is what a satellite receiver reports; the geoid separation is looked up for that horizontal position; the orthometric height is their difference. Because the separation is a function of position, the conversion is per point rather than a constant offset.</desc>
  <defs>
    <marker id="e2o1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="e2o1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="379.3" height="156.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="124.6" height="92" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.5"/>
  <text x="14" y="16" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">h  =  H  +  N</text>
  <line x1="130.6" y1="12.9" x2="162.6" y2="12.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="170.6" y="16" font-size="9.5" fill="currentColor" fill-opacity="0.78">the governing identity</text>
  <text x="14" y="35" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">h  =  96.412 m</text>
  <line x1="130.6" y1="31.9" x2="162.6" y2="31.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="170.6" y="35" font-size="9.5" fill="currentColor" fill-opacity="0.78">ellipsoidal — what GNSS reports</text>
  <text x="14" y="54" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">N  =  49.102 m</text>
  <line x1="130.6" y1="50.9" x2="162.6" y2="50.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="170.6" y="54" font-size="9.5" fill="currentColor" fill-opacity="0.78">separation, interpolated from the grid</text>
  <text x="14" y="73" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">H  =  47.310 m</text>
  <line x1="130.6" y1="69.9" x2="162.6" y2="69.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="170.6" y="73" font-size="9.5" fill="currentColor" fill-opacity="0.78">orthometric — what levelling measures</text>
  <text x="0" y="114" font-size="9.5" fill="currentColor" fill-opacity="0.7">N is a function of position, so this is a per-point conversion, not an offset.</text>
</svg>
<!-- /fig:e2o-relation -->

A compound CRS supplies that reason. It pairs a horizontal CRS with a vertical one, and PROJ's operation search then includes vertical transformations: geoid grid interpolations, datum offsets, or a combination. The selected operation is what applies the separation.

The other half of the mechanism is the grid itself. A national geoid model is a raster of separation values, distributed separately from PROJ. When it is present the interpolation is centimetre-level; when it is absent PROJ may fall back to a coarse global model and still return an answer. This is the single most important thing to verify, because the fallback is silent and the difference is metres.

## Production-Ready Script

{% raw %}
```python
# pyproj>=3.5.0 (PROJ 9.x), numpy>=1.24, Python 3.9+
from __future__ import annotations

import numpy as np
from pyproj import CRS, Transformer


class VerticalTransformError(RuntimeError):
    """Raised when the transformation is not actually three-dimensional."""


def build_vertical_transformer(
    src_epsg: int,
    dst_horizontal_epsg: int,
    dst_vertical_epsg: int,
    *,
    require_grid: bool = True,
) -> Transformer:
    """Transformer from a 3D geographic CRS to a compound projected + vertical CRS.

    src_epsg must be a 3D CRS (ellipsoidal height), e.g. 4937 for ETRS89.
    """
    src = CRS.from_epsg(src_epsg)
    dst = CRS.from_string(f"EPSG:{dst_horizontal_epsg}+{dst_vertical_epsg}")

    if len(src.axis_info) < 3:
        raise VerticalTransformError(
            f"EPSG:{src_epsg} is 2D — use the 3D realisation, or z will pass through"
        )
    if not dst.is_compound:
        raise VerticalTransformError("destination is not a compound CRS")

    transformer = Transformer.from_crs(src, dst, always_xy=True)

    if require_grid:
        op = transformer.get_last_used_operation() if hasattr(
            transformer, "get_last_used_operation") else None
        # The operation is only resolved after a first transform on some PROJ builds,
        # so probe with a representative coordinate inside the grid's extent.
        transformer.transform(0.0, 51.5, 0.0)
        _assert_grids_available(transformer)

    return transformer


def _assert_grids_available(transformer: Transformer) -> None:
    op = transformer.get_last_used_operation()
    missing = [g.short_name for g in op.grids if not g.available]
    if missing:
        raise VerticalTransformError(
            f"geoid grid(s) not installed: {', '.join(missing)} — "
            "PROJ would fall back to a coarse global model"
        )


def to_orthometric(
    transformer: Transformer,
    lon: np.ndarray,
    lat: np.ndarray,
    h_ellipsoidal: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Ellipsoidal height -> orthometric height, vectorised over whole arrays."""
    east, north, H = transformer.transform(
        np.asarray(lon, dtype=float),
        np.asarray(lat, dtype=float),
        np.asarray(h_ellipsoidal, dtype=float),
    )
    separation = np.asarray(h_ellipsoidal) - np.asarray(H)
    if np.allclose(separation, 0.0):
        raise VerticalTransformError(
            "separation is zero everywhere — the transform is horizontal"
        )
    return np.asarray(east), np.asarray(north), np.asarray(H)


if __name__ == "__main__":
    t = build_vertical_transformer(4937, 27700, 5701)   # ETRS89 3D -> BNG + ODN
    lon = np.array([-1.54785, -1.54600])
    lat = np.array([53.80139, 53.80200])
    h = np.array([96.412, 97.001])
    e, n, H = to_orthometric(t, lon, lat, h)
    for i in range(len(H)):
        print(f"h={h[i]:.3f}  ->  H={H[i]:.3f}  (N={h[i] - H[i]:.3f} m)")
```
{% endraw %}

<!-- fig:e2o-compound -->
<svg viewBox="-20 -33.5 504.9 101.7" role="img" aria-label="A compound CRS lets the PROJ operation search find a vertical transformation and interpolate a geoid grid" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:505px;display:block;margin:1.5rem auto;">
  <title>What a compound CRS gives the operation search</title>
  <desc>Three stages. Pairing a horizontal system with an explicit vertical one produces a compound definition; PROJ then includes vertical transformations in its operation search and selects one; the selected operation interpolates a geoid grid to produce the separation. Without the compound definition the search has nothing vertical to find.</desc>
  <defs>
    <marker id="e2o2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="e2o2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-33.5" width="504.9" height="101.7" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="139.7" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="69.9" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Horizontal + vertical</text>
  <text x="69.9" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">a compound CRS</text>
  <rect x="173.7" y="0" width="126.3" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="236.9" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Vertical operation</text>
  <text x="236.9" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">selected by PROJ</text>
  <rect x="334" y="0" width="130.9" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="399.5" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Separation applied</text>
  <text x="399.5" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">orthometric height</text>
  <line x1="139.7" y1="24.1" x2="173.7" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#e2o2-a)"/>
  <text x="156.7" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">operation search</text>
  <line x1="300" y1="24.1" x2="334" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#e2o2-a)"/>
  <text x="317" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">interpolate</text>
</svg>
<!-- /fig:e2o-compound -->

**Key implementation notes:**

- `build_vertical_transformer` refuses a 2D source rather than transforming it. That refusal is the whole value of the function: a 2D source is the failure this page exists to prevent.
- The zero-separation assertion in `to_orthometric` is a second, independent guard. It catches the case where the definitions look right but the operation PROJ chose does nothing vertical.
- `always_xy=True` is set for the same reason as in any horizontal transformation — it fixes the argument order to longitude, latitude regardless of the authority axis order.
- Whole arrays are passed to `transform`. The grid interpolation is vectorised internally; per-point calls spend their time in the Python loop.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `pyproj` | `>=3.5.0` | `get_last_used_operation` and grid availability reporting |
| PROJ | `9.x` | earlier releases handle compound CRS selection less consistently |
| Source CRS | any 3D geographic or geocentric | 2D realisations are rejected by the builder |
| Target CRS | compound horizontal + vertical | e.g. `EPSG:27700+5701`, `EPSG:25832+5783` |
| Geoid grids | national or global | install at image build time; `PROJ_NETWORK=OFF` in production |
| Array input | numpy arrays of equal length | broadcasting is not applied — shapes must match |

## Fallback Strategies

**1. The source is already orthometric.** Applying this conversion produces an error of exactly `2N`. There is no way to detect it from the numbers alone at a single point, but a dataset whose heights differ from local mapped ground levels by roughly the known regional separation is the signature. Record the height system per source, as described on the parent page, rather than inferring it.

<!-- fig:e2o-double -->
<svg viewBox="-20 -20 405.6 184.1" role="img" aria-label="Double correction, sign error and a horizontal transform produce offsets of 2N, 2N and N respectively" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>Three errors that all look like a vertical offset</title>
  <desc>Three distinct faults and the magnitude each produces. A correction applied to already-corrected data and a sign error both produce an error of exactly twice the separation and are indistinguishable from the numbers alone; a transform that was horizontal produces an error of exactly the separation. Knowing the magnitudes is what turns an offset into a diagnosis.</desc>
  <defs>
    <marker id="e2o3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="e2o3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="405.6" height="184.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="365.6" height="122" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="365.6" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">Fault</text>
  <text x="156.2" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Magnitude</text>
  <line x1="194.5" y1="0" x2="194.5" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="280.1" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Distinguishing evidence</text>
  <line x1="117.8" y1="0" x2="117.8" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="365.6" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">Already corrected</text>
  <text x="156.2" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">2N</text>
  <text x="280.1" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">the survey processing settings</text>
  <line x1="0" y1="62" x2="365.6" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">Sign convention</text>
  <text x="156.2" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">2N</text>
  <text x="280.1" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">a benchmark comparison</text>
  <line x1="0" y1="92" x2="365.6" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">Transform was 2D</text>
  <text x="156.2" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">N</text>
  <text x="280.1" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">input height returned unchanged</text>
  <text x="0" y="142" font-size="9.5" fill="currentColor" fill-opacity="0.7">Two of the three are the same magnitude — only the benchmark separates them.</text>
</svg>
<!-- /fig:e2o-double -->

**2. No national grid installed.** `_assert_grids_available` raises. Install the grid package at image build time and set `PROJ_NETWORK=OFF` so a missing grid is an error rather than a runtime download that may or may not succeed.

**3. Points outside the grid extent.** A national grid covers a bounded area. Points outside it transform through whatever fallback PROJ finds, which for a site near a border may silently switch model partway through a dataset. Assert the input bounding box against the grid extent before transforming.

**4. Mixed vertical datums in one dataset.** A merged deliverable can contain sections on different vertical datums. There is no way for one transformer to handle this correctly. Split the dataset by source, transform each with its own transformer, and merge afterwards.

**5. Heights that are already project-datum values.** A CAD or BIM elevation is not an ellipsoidal height and this conversion does not apply to it. Resolve the project offset first — see [Reconciling BIM Project Elevation with a National Datum](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/reconciling-bim-project-elevation-with-a-national-datum/) — and only then treat the values as national-datum heights.

## FAQ

<details>
<summary><strong>How do I know whether my heights are already orthometric?</strong></summary>

Ask the survey processing configuration, not the file. Most GNSS post-processing software can output either, and the choice is a setting rather than something recorded in a `.csv` or a LAS header. The rough magnitude check is that the geoid separation in a given region is a known number — if your heights differ from nearby mapped ground levels by approximately that number, they are ellipsoidal.

</details>

<details>
<summary><strong>Why is my converted height out by exactly twice the separation?</strong></summary>

You have applied the correction to data that was already corrected, or you have used a separation with the wrong sign. Both produce an error of `2N`. Check the source first: a double correction is far more common than a sign error, because processing software applies the correction by default.

</details>

<details>
<summary><strong>Does the conversion need to be per point?</strong></summary>

Yes, for anything survey-grade. The geoid separation varies across a site, and a single value applied to a whole dataset is correct only at the point it was sampled. For a small site the variation may be below tolerance, but that is a decision to make from the numbers rather than an assumption to build in.

</details>

---

## Related Pages

- [Vertical Datums and Height Systems](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/) — parent reference on the three surfaces a height can be measured from
- [Applying a Geoid Model with pyproj](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/applying-a-geoid-model-with-pyproj/) — sibling guide on installing, pinning and verifying the grid this conversion depends on
- [Reprojecting CAD Coordinates with pyproj Transformer](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/reprojecting-cad-coordinates-with-pyproj-transformer/) — the horizontal transformer whose caching rules apply here too
