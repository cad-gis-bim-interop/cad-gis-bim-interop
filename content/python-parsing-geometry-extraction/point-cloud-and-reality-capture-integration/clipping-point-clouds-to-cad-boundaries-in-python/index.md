---
title: "Clipping Point Clouds to CAD Boundaries in Python"
description: "Clip a LAS or LAZ cloud to a CAD site boundary: extract the polygon from DXF, prefilter by bounding box, test containment per chunk, and write a valid file."
slug: "clipping-point-clouds-to-cad-boundaries-in-python"
breadcrumb:
  - label: "Python Parsing & Geometry Extraction"
    url: "/python-parsing-geometry-extraction/"
  - label: "Point Cloud and Reality Capture Integration"
    url: "/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/"
  - label: "Clipping Point Clouds to CAD Boundaries in Python"
    url: "/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/clipping-point-clouds-to-cad-boundaries-in-python/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Clipping Point Clouds to CAD Boundaries in Python",
      "description": "Clip a LAS or LAZ cloud to a CAD site boundary: extract the polygon from DXF, prefilter by bounding box, test containment per chunk, and write a valid file.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/clipping-point-clouds-to-cad-boundaries-in-python/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Python Parsing & Geometry Extraction", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/"},
        {"@type": "ListItem", "position": 2, "name": "Point Cloud and Reality Capture Integration", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/"},
        {"@type": "ListItem", "position": 3, "name": "Clipping Point Clouds to CAD Boundaries in Python", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/clipping-point-clouds-to-cad-boundaries-in-python/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Clip a point cloud to a CAD boundary",
      "description": "Read the boundary polygon from the drawing, reconcile the coordinate systems, prefilter chunks by bounding box, test the survivors against the polygon, and write the result with its header preserved.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Extract the boundary polygon", "text": "Read the closed polyline from the drawing, flatten any arcs, and close the ring explicitly before building a polygon."},
        {"@type": "HowToStep", "position": 2, "name": "Reconcile the coordinate systems", "text": "Scale the drawing to metres and reproject it to the cloud coordinate reference system, or the clip removes everything."},
        {"@type": "HowToStep", "position": 3, "name": "Prefilter by bounding box", "text": "Discard points outside the polygon envelope with a cheap array comparison before any point-in-polygon work."},
        {"@type": "HowToStep", "position": 4, "name": "Test the survivors", "text": "Run a vectorised containment test on the points that passed the envelope filter."},
        {"@type": "HowToStep", "position": 5, "name": "Write with the header preserved", "text": "Write the retained points into a new file carrying the source header so scale, offset and coordinate metadata survive."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Why does my clip return zero points?",
          "acceptedAnswer": {"@type": "Answer", "text": "Almost always a coordinate mismatch. The drawing is in millimetres on a site grid and the cloud is in metres on a projected CRS, so the boundary polygon sits a few metres from the origin while the cloud is half a million metres away. Print both bounding boxes before clipping; the discrepancy is immediately obvious and never subtle."}
        },
        {
          "@type": "Question",
          "name": "Is a bounding-box prefilter worth it?",
          "acceptedAnswer": {"@type": "Answer", "text": "Substantially. Point-in-polygon is far more expensive per point than four array comparisons, and on a typical site the envelope discards most of an airborne tile before the polygon test runs at all. The prefilter is exact — it never discards a point inside the polygon — so it costs nothing in correctness."}
        },
        {
          "@type": "Question",
          "name": "How do I keep the classification and intensity?",
          "acceptedAnswer": {"@type": "Answer", "text": "Clip the point records rather than a coordinate array. laspy lets you index the chunk's point record with a boolean mask, which keeps every dimension the format carries. Extracting XYZ into a numpy array and writing that back produces a file with geometry and nothing else."}
        }
      ]
    }
  ]
}
</script>

# Clipping Point Clouds to CAD Boundaries in Python

To clip a point cloud to a CAD site boundary, read the closed polyline from the drawing, bring it into the cloud's coordinate system, then stream the cloud in chunks applying a bounding-box prefilter followed by a vectorised point-in-polygon test, writing survivors into a new file that inherits the source header. Nearly every failure here is a coordinate-system mismatch rather than a geometry problem. This page is part of [Point Cloud and Reality Capture Integration](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/).

## How the Two Coordinate Worlds Meet

A site boundary in a drawing is a closed `LWPOLYLINE` in drawing units on a site grid. A point cloud is metres on a projected coordinate reference system. Between them sit the two transformations this site covers at length: a unit scale from the drawing header, and a reprojection from the site grid onto the projection.

<!-- fig:clip-transform-the-polygon -->
<svg viewBox="-20 -33.5 419 125.8" role="img" aria-label="Scale and reproject the boundary polygon into the cloud CRS rather than transforming the cloud" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>Transform the boundary, not the cloud</title>
  <desc>Three stages applied to thirty vertices rather than to a hundred million points. The drawing polyline is scaled from drawing units to metres, reprojected from the site grid onto the cloud coordinate system, and used as the clip boundary. Moving the cloud to meet the polygon instead is orders of magnitude more work and loses precision on the way.</desc>
  <defs>
    <marker id="cl1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="cl1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-33.5" width="419" height="125.8" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="126.7" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="63.3" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Boundary polyline</text>
  <text x="63.3" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">drawing units</text>
  <rect x="160.7" y="0" width="96.2" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="208.8" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Metres</text>
  <text x="208.8" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">on the site grid</text>
  <rect x="290.8" y="0" width="88.2" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="334.9" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Cloud CRS</text>
  <text x="334.9" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">ready to clip</text>
  <line x1="126.7" y1="24.1" x2="160.7" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#cl1-a)"/>
  <text x="143.7" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">scale</text>
  <line x1="256.8" y1="24.1" x2="290.8" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#cl1-a)"/>
  <text x="273.8" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">reproject</text>
  <text x="0" y="70.2" font-size="9.5" fill="currentColor" fill-opacity="0.7">Thirty vertices transformed instead of a hundred million points.</text>
</svg>
<!-- /fig:clip-transform-the-polygon -->

Both have to be applied to the *boundary*, not to the cloud. Transforming a hundred million points to meet a polygon is orders of magnitude more expensive than transforming a polygon of thirty vertices to meet the points, and it loses precision in the process.

The boundary also has to be a valid ring before it can test anything. A closed polyline stores closure as a flag rather than as a repeated coordinate, and it may carry bulge arcs that must be flattened. Both are covered in [Extracting LWPOLYLINE Vertices with ezdxf](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/extracting-lwpolyline-vertices-with-ezdxf/); the clip inherits them.

## Production-Ready Script

{% raw %}
```python
# laspy[lazrs]>=2.5, ezdxf>=1.1.0, shapely>=2.0, pyproj>=3.5, numpy>=1.24
from __future__ import annotations

import numpy as np
import laspy
import ezdxf
from shapely.geometry import Polygon
from shapely import contains_xy
from pyproj import Transformer

INSUNITS_TO_M = {1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1.0, 7: 1000.0}


def boundary_polygon(dxf_path: str, layer: str, dst_epsg: int, src_epsg: int,
                     *, sag: float = 0.02) -> Polygon:
    """The largest closed polyline on that layer, in the cloud CRS, in metres."""
    doc = ezdxf.readfile(dxf_path)
    code = doc.header.get("$INSUNITS", 0)
    if code not in INSUNITS_TO_M:
        raise ValueError(f"$INSUNITS={code} is undefined — resolve the unit explicitly")
    scale = INSUNITS_TO_M[code]

    best: Polygon | None = None
    for pl in doc.modelspace().query(f'LWPOLYLINE[layer=="{layer}"]'):
        if not pl.closed:
            continue
        pts = [(v.x * scale, v.y * scale) for v in pl.flattening(distance=sag / scale)]
        if len(pts) < 3:
            continue
        ring = Polygon(pts)
        if best is None or ring.area > best.area:
            best = ring
    if best is None:
        raise ValueError(f"no closed polyline found on layer {layer!r}")

    t = Transformer.from_crs(src_epsg, dst_epsg, always_xy=True)
    x, y = t.transform(*np.array(best.exterior.coords).T)
    return Polygon(np.column_stack((x, y)))


def clip(las_path: str, out_path: str, poly: Polygon, *, chunk: int = 2_000_000) -> dict:
    minx, miny, maxx, maxy = poly.bounds
    kept = seen = 0
    with laspy.open(las_path) as reader:
        header = reader.header
        with laspy.open(out_path, mode="w", header=header) as writer:
            for points in reader.chunk_iterator(chunk):
                seen += len(points)
                x, y = np.asarray(points.x), np.asarray(points.y)
                # Cheap exact prefilter: the envelope never excludes an inside point.
                envelope = (x >= minx) & (x <= maxx) & (y >= miny) & (y <= maxy)
                if not envelope.any():
                    continue
                mask = np.zeros(len(points), dtype=bool)
                mask[envelope] = contains_xy(poly, x[envelope], y[envelope])
                if mask.any():
                    writer.write_points(points[mask])   # keeps every dimension
                    kept += int(mask.sum())
    return {"read": seen, "written": kept, "retained": kept / seen if seen else 0.0}


if __name__ == "__main__":
    poly = boundary_polygon("site.dxf", layer="SITE-BOUNDARY",
                            dst_epsg=27700, src_epsg=27700)
    print(clip("survey.laz", "survey_clipped.laz", poly))
```
{% endraw %}

<!-- fig:clip-prefilter -->
<svg viewBox="-20 -20 319.8 216.2" role="img" aria-label="A bounding-box comparison discards most points before the expensive point-in-polygon test, without ever excluding an inside point" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>The envelope prefilter is exact and nearly free</title>
  <desc>A two-stage test per chunk. Four array comparisons against the polygon envelope discard most points on a typical tile, and because the envelope contains the polygon the filter never excludes a point that is inside it. Only the survivors reach the containment test, which is far more expensive per point.</desc>
  <defs>
    <marker id="cl2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="cl2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="319.8" height="216.2" fill="var(--color-surface)"/>
  <polygon points="139.9,0 243.5,31 139.9,62 36.3,31" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-width="1.6"/>
  <text x="139.9" y="35" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">Inside the polygon envelope?</text>
  <rect x="0" y="128" width="125.9" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="63" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Discard</text>
  <text x="63" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">four comparisons</text>
  <path d="M 139.9 62 L 139.9 92 L 63 92 L 63 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#cl2-a)" stroke-linejoin="round"/>
  <text x="63" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">no</text>
  <rect x="153.9" y="128" width="125.9" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="216.9" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Test containment</text>
  <text x="216.9" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">vectorised predicate</text>
  <path d="M 139.9 62 L 139.9 92 L 216.9 92 L 216.9 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#cl2-a)" stroke-linejoin="round"/>
  <text x="216.9" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">yes</text>
</svg>
<!-- /fig:clip-prefilter -->

**Key implementation notes:**

- `points[mask]` indexes the point *record*, so classification, intensity, return number and colour all survive. Rebuilding from an XYZ array silently discards them.
- The writer is opened with the source header, so scale, offset and the coordinate reference system carry into the output.
- `contains_xy` is Shapely 2's vectorised predicate — one call for an entire array rather than a Python loop over points.
- The bounding-box prefilter is applied first and the polygon test only to survivors. It is exact, so this is pure saving.
- The retention ratio is returned. A clip that retains 0.02% is usually a coordinate mismatch rather than a small site.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `laspy` | `>=2.5` | chunked read and write, point-record indexing |
| `ezdxf` | `>=1.1.0` | `flattening` for bulge arcs |
| `shapely` | `>=2.0` | `contains_xy` vectorised predicate |
| `pyproj` | `>=3.5` | boundary reprojection |
| Output format | LAS or LAZ | LAZ output needs the compression backend |

## Fallback Strategies

**1. Zero points retained.** Print `poly.bounds` against the cloud header bounds. A site-grid polygon near the origin against a projected cloud is the usual answer, and it is visible at a glance.

<!-- fig:clip-zero-retained -->
<svg viewBox="-20 -20 523.6 137.1" role="img" aria-label="Printing the polygon bounds against the cloud bounds makes a coordinate mismatch immediately visible" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:524px;display:block;margin:1.5rem auto;">
  <title>What a coordinate mismatch looks like in the bounds</title>
  <desc>The two bounding boxes printed side by side when a clip retains nothing. The boundary polygon sits near the drawing origin in millimetre-scale numbers while the cloud sits at full projected coordinates. The mismatch is not subtle, and printing both bounds resolves in one line what otherwise looks like a geometry problem.</desc>
  <defs>
    <marker id="cl3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="cl3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="523.6" height="137.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="338.5" height="73" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.5"/>
  <text x="14" y="16" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">polygon  x 0 … 84210     y 0 … 51900</text>
  <line x1="344.5" y1="12.9" x2="376.5" y2="12.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="384.5" y="16" font-size="9.5" fill="currentColor" fill-opacity="0.78">site grid, millimetres</text>
  <text x="14" y="35" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">cloud    x 432100 … 432420  y 511890 … 512140</text>
  <line x1="344.5" y1="31.9" x2="376.5" y2="31.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="384.5" y="35" font-size="9.5" fill="currentColor" fill-opacity="0.78">projected, metres</text>
  <text x="14" y="54" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">overlap  none</text>
  <line x1="344.5" y1="50.9" x2="376.5" y2="50.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="384.5" y="54" font-size="9.5" fill="currentColor" fill-opacity="0.78">the clip retains nothing</text>
  <text x="0" y="95" font-size="9.5" fill="currentColor" fill-opacity="0.7">Print both before suspecting the boundary geometry.</text>
</svg>
<!-- /fig:clip-zero-retained -->

**2. `$INSUNITS` is 0.** The code raises rather than guessing. Resolve the drawing unit explicitly — the policy is set out in [Autoscaling DXF Geometry from $INSUNITS in Python](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/autoscaling-dxf-geometry-from-insunits-in-python/).

**3. The boundary is not closed.** A drafted boundary is frequently several open polylines that visually meet. Merge them into a ring before polygonising, and reject the result if it does not close within tolerance rather than silently taking the largest fragment.

**4. Holes in the boundary.** Exclusion zones drawn as separate rings inside the site boundary are not automatically holes. Build the polygon with explicit interior rings, or the clip retains points inside them.

**5. Output is much larger than expected.** LAZ output written without a compression backend falls back to LAS. Assert the output extension against the driver actually used.

## FAQ

<details>
<summary><strong>Why does my clip return zero points?</strong></summary>

Almost always a coordinate mismatch. The drawing is in millimetres on a site grid and the cloud is in metres on a projected CRS, so the boundary polygon sits a few metres from the origin while the cloud is half a million metres away. Print both bounding boxes before clipping; the discrepancy is immediately obvious and never subtle.

</details>

<details>
<summary><strong>Is a bounding-box prefilter worth it?</strong></summary>

Substantially. Point-in-polygon is far more expensive per point than four array comparisons, and on a typical site the envelope discards most of an airborne tile before the polygon test runs at all. The prefilter is exact — it never discards a point inside the polygon — so it costs nothing in correctness.

</details>

<details>
<summary><strong>How do I keep the classification and intensity?</strong></summary>

Clip the point records rather than a coordinate array. `laspy` lets you index the chunk's point record with a boolean mask, which keeps every dimension the format carries. Extracting XYZ into a numpy array and writing that back produces a file with geometry and nothing else.

</details>

---

## Related Pages

- [Point Cloud and Reality Capture Integration](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/) — parent reference on coordinate metadata and density
- [Reading LAS and LAZ Files with laspy](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/reading-las-and-laz-files-with-laspy/) — the chunked read this clip is built on
- [Extracting LWPOLYLINE Vertices with ezdxf](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/extracting-lwpolyline-vertices-with-ezdxf/) — reading the boundary polyline out of the drawing
