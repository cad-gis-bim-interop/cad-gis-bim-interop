---
title: "Tessellating SPLINE Entities with ezdxf"
description: "How to tessellate DXF SPLINE entities with ezdxf in Python: flatten NURBS at a sag tolerance, use the BSpline construction tool, and export clean polylines."
slug: "tessellating-splines-with-ezdxf-in-python"
breadcrumb:
  - label: "Python Parsing & Geometry Extraction"
    url: "/python-parsing-geometry-extraction/"
  - label: "ezdxf Deep Dive"
    url: "/python-parsing-geometry-extraction/ezdxf-deep-dive/"
  - label: "Tessellating SPLINE Entities with ezdxf"
    url: "/python-parsing-geometry-extraction/ezdxf-deep-dive/tessellating-splines-with-ezdxf-in-python/"
datePublished: "2026-07-11"
dateModified: "2026-07-11"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Tessellating SPLINE Entities with ezdxf",
      "description": "How to tessellate DXF SPLINE entities with ezdxf in Python: flatten NURBS at a sag tolerance, use the BSpline construction tool, and export clean polylines.",
      "datePublished": "2026-07-11",
      "dateModified": "2026-07-11",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/tessellating-splines-with-ezdxf-in-python/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Python Parsing & Geometry Extraction", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/"},
        {"@type": "ListItem", "position": 2, "name": "ezdxf Deep Dive", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/"},
        {"@type": "ListItem", "position": 3, "name": "Tessellating SPLINE Entities with ezdxf", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/tessellating-splines-with-ezdxf-in-python/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Tessellating SPLINE Entities with ezdxf",
      "description": "Query SPLINE entities from a DXF file and convert their NURBS definition into polyline vertices at a controlled sag tolerance.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Query SPLINE entities", "text": "Open the DXF with ezdxf.readfile() and call msp.query('SPLINE') to collect all spline entities from modelspace."},
        {"@type": "HowToStep", "position": 2, "name": "Read the NURBS definition", "text": "Inspect entity.dxf.degree, entity.control_points, entity.knots, and entity.weights to understand the curve before tessellation."},
        {"@type": "HowToStep", "position": 3, "name": "Flatten at a sag tolerance", "text": "Call entity.flattening(distance) to yield adaptive Vec3 points whose maximum deviation from the true curve never exceeds distance."},
        {"@type": "HowToStep", "position": 4, "name": "Export polyline vertices", "text": "Collect the flattened points into a vertex array per spline for downstream mesh, GeoJSON, or Shapely conversion."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What does the distance argument of spline.flattening mean?",
          "acceptedAnswer": {"@type": "Answer", "text": "distance is the maximum allowed deviation (the sag or sagitta) between the true spline and the straight segments approximating it, expressed in drawing units. ezdxf subdivides adaptively so that no chord ever departs from the curve by more than distance, adding points only where curvature demands them."}
        },
        {
          "@type": "Question",
          "name": "What is the difference between fit points and control points on a SPLINE?",
          "acceptedAnswer": {"@type": "Answer", "text": "Fit points are coordinates the curve passes through exactly; control points are the weighted NURBS hull that defines the curve but which it generally does not touch. A SPLINE may store one, the other, or both. When control points are present, tessellate from them via the construction tool; fit points alone require interpolation, which ezdxf handles internally."}
        },
        {
          "@type": "Question",
          "name": "Does ezdxf handle rational (weighted) splines?",
          "acceptedAnswer": {"@type": "Answer", "text": "Yes. When entity.weights is non-empty the spline is rational, and both entity.flattening() and the construction_tool() BSpline honour the weights when evaluating the curve. If weights are absent the spline is non-rational and all control points carry an implicit weight of 1.0."}
        },
        {
          "@type": "Question",
          "name": "How do I tessellate a closed or periodic spline?",
          "acceptedAnswer": {"@type": "Answer", "text": "Read entity.closed. ezdxf.flattening() already traverses the full periodic curve, so no manual wrap-around is needed. When assembling a closed ring for a polygon consumer, append the first tessellated point to the end so the ring is explicitly closed."}
        }
      ]
    }
  ]
}
</script>

# Tessellating SPLINE Entities with ezdxf

To tessellate a DXF `SPLINE` with `ezdxf`, call `entity.flattening(distance)`, which returns adaptive `Vec3` points whose maximum deviation from the true curve never exceeds `distance` drawing units. A `SPLINE` is stored as a NURBS curve — control points, a knot vector, optional weights, and a degree — not as an explicit list of vertices, so any GIS or mesh consumer needs it converted into a polyline first. `ezdxf` evaluates the NURBS mathematics for you, either through the entity's own `flattening()` method or through the `BSpline` object returned by `entity.construction_tool()`. This page is part of the [ezdxf Deep Dive](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/) reference and shares its tolerance-driven flattening model with [extracting LWPOLYLINE vertices](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/extracting-lwpolyline-vertices-with-ezdxf/), where bulge arcs are flattened the same way.

## How ezdxf Handles SPLINE Tessellation

A `SPLINE` entity encodes a Non-Uniform Rational B-Spline. Its definition lives in four `ezdxf` attributes: `entity.dxf.degree` (the polynomial degree, commonly 3), `entity.control_points` (the defining hull), `entity.knots` (the non-decreasing knot vector that parameterises the curve), and `entity.weights` (per-control-point weights that make the curve rational when present). A separate list, `entity.fit_points`, holds coordinates the curve is required to pass through; a spline may be defined by control points, by fit points, or by both.

Because the curve is a continuous mathematical object, there is no single "correct" vertex list — you choose a fidelity. `ezdxf` offers two adaptive routes. The direct route, `entity.flattening(distance, segments=4)`, walks the curve and subdivides recursively until the straight chord between successive samples deviates from the true curve by no more than `distance`; `segments` sets the minimum samples per knot span so that low-curvature spans still get a baseline resolution. The lower-level route, `entity.construction_tool()`, returns an `ezdxf.math.BSpline` you can drive directly with `.flattening(distance)` for the same sag-bounded output or `.approximate(n)` for a fixed count of `n` evenly parameterised points.

<svg viewBox="8 35 643 160" role="img" aria-label="A SPLINE NURBS definition of control points, knots, weights and degree is evaluated by ezdxf flattening at a sag tolerance to produce adaptive polyline vertices" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:700px;display:block;margin:1.5rem auto;">
  <title>SPLINE Tessellation at a Sag Tolerance</title>
  <desc>Diagram showing a NURBS spline defined by control points, a knot vector, weights and a degree, passed through the ezdxf flattening evaluator with a sag distance, producing an adaptive polyline that samples more densely where curvature is high.</desc>
  <defs>
    <marker id="spar" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" opacity="0.7"/>
    </marker>
  </defs>
  <rect x="8" y="35" width="643" height="160" fill="var(--color-surface)"/>
  <rect x="24" y="70" width="150" height="86" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="99" y="92" text-anchor="middle" font-size="11" fill="currentColor">NURBS input</text>
  <text x="99" y="110" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">control points</text>
  <text x="99" y="126" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">knots, weights</text>
  <text x="99" y="142" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">degree</text>
  <line x1="174" y1="113" x2="232" y2="113" stroke="currentColor" stroke-width="1.5" marker-end="url(#spar)"/>
  <rect x="234" y="82" width="170" height="62" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.85"/>
  <text x="319" y="104" text-anchor="middle" font-size="11" fill="currentColor">flattening(distance)</text>
  <text x="319" y="122" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">adaptive subdivision</text>
  <text x="319" y="138" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">sag &lt;= distance</text>
  <line x1="404" y1="113" x2="462" y2="113" stroke="currentColor" stroke-width="1.5" marker-end="url(#spar)"/>
  <text x="560" y="60" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">dense in high curvature</text>
  <path d="M470,150 Q500,150 520,132 Q548,108 566,96 Q596,78 632,78" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.85"/>
  <circle cx="470" cy="150" r="2.6" fill="currentColor"/>
  <circle cx="512" cy="137" r="2.6" fill="currentColor"/>
  <circle cx="528" cy="127" r="2.6" fill="currentColor"/>
  <circle cx="548" cy="108" r="2.6" fill="currentColor"/>
  <circle cx="566" cy="96" r="2.6" fill="currentColor"/>
  <circle cx="598" cy="84" r="2.6" fill="currentColor"/>
  <circle cx="632" cy="78" r="2.6" fill="currentColor"/>
  <text x="551" y="176" text-anchor="middle" font-size="10" fill="currentColor">tessellated polyline vertices</text>
</svg>

What `ezdxf` does *not* do is guess a tolerance for you or clean up degenerate inputs. A `distance` chosen without regard to the drawing's units produces either a coarse chord approximation or a runaway vertex count. Splines that carry only fit points, zero-length control hulls, or duplicate knots still evaluate, but the result may collapse to a point or a straight line — cases you must detect, not assume away.

## Production-Ready Script

The script tessellates every `SPLINE` in a DXF at a configurable sag tolerance, inspects the NURBS definition for reporting, and returns one vertex array per spline suitable for [conversion of CAD polylines to GeoJSON](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/converting-cad-polylines-to-geojson/) or a mesh pipeline.

```python
# ezdxf>=1.1.0, Python 3.9+
import ezdxf
from typing import List, Dict, Any

def tessellate_splines(
    dxf_path: str,
    sag_tolerance: float = 0.05,
    min_segments: int = 4,
) -> List[Dict[str, Any]]:
    """Tessellate all SPLINE entities in a DXF into polyline vertex arrays.

    ``sag_tolerance`` is the maximum deviation between the true NURBS curve and
    the approximating line segments, in drawing units. ``min_segments`` sets a
    floor on samples per knot span so gentle curves still get baseline detail.
    """
    doc = ezdxf.readfile(dxf_path)
    msp = doc.modelspace()

    results: List[Dict[str, Any]] = []
    for spline in msp.query("SPLINE"):
        # flattening() yields Vec3 points at an adaptive, sag-bounded density.
        points = [tuple(p) for p in spline.flattening(sag_tolerance,
                                                       segments=min_segments)]

        # A closed/periodic spline: make the ring explicit for polygon consumers.
        if spline.closed and len(points) >= 3 and points[0] != points[-1]:
            points.append(points[0])

        # weights present -> rational NURBS; absent -> all weights implicitly 1.0
        weights = list(spline.weights)

        results.append({
            "handle": spline.dxf.handle,
            "layer": spline.dxf.layer,
            "degree": spline.dxf.degree,
            "closed": bool(spline.closed),
            "rational": len(weights) > 0,
            "n_control_points": len(spline.control_points),
            "n_fit_points": len(spline.fit_points),
            "vertex_count": len(points),
            "coordinates": points,   # list of (x, y, z) tuples
        })

    return results

if __name__ == "__main__":
    for s in tessellate_splines("input.dxf", sag_tolerance=0.05):
        flavour = "rational" if s["rational"] else "non-rational"
        print(f"{s['handle']}: degree {s['degree']} {flavour} spline "
              f"-> {s['vertex_count']} vertices on layer {s['layer']}")
```

<!-- fig:spline-sag-tradeoff -->
<svg viewBox="-0.6 -8 408 258.1" role="img" aria-label="The same spline tessellated coarsely and finely — the sag tolerance trades vertex count against deviation from the true curve" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>The same curve at two sag tolerances</title>
  <desc>One cubic curve sampled twice. The coarse sampling uses few vertices and visibly cuts the corners where curvature is highest; the fine sampling follows the curve closely at several times the vertex count. The tolerance is a budget, not a quality setting: it trades vertices for deviation, and the right value depends on the drawing units the coordinates are in.</desc>
  <defs>
    <marker id="spl1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="spl1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-0.6" y="-8" width="408" height="258.1" fill="var(--color-surface)"/>
  <rect x="34" y="12" width="350" height="174" rx="4" fill="none" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="34" y1="186" x2="384" y2="186" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <line x1="34" y1="12" x2="34" y2="186" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <text x="209" y="208" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.7">X (drawing units)</text>
  <text x="26" y="99" text-anchor="end" font-size="9.5" fill="currentColor" fill-opacity="0.7">Y</text>
  <polyline points="34,186 86.8,59 156.1,79.6 233.9,146.8 312.5,159.3 384,16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-opacity="0.6" stroke-dasharray="6 4"/>
  <circle cx="34" cy="186" r="3.4" fill="currentColor" fill-opacity="0.55"/>
  <circle cx="86.8" cy="59" r="3.4" fill="currentColor" fill-opacity="0.55"/>
  <circle cx="156.1" cy="79.6" r="3.4" fill="currentColor" fill-opacity="0.55"/>
  <circle cx="233.9" cy="146.8" r="3.4" fill="currentColor" fill-opacity="0.55"/>
  <circle cx="312.5" cy="159.3" r="3.4" fill="currentColor" fill-opacity="0.55"/>
  <circle cx="384" cy="16" r="3.4" fill="currentColor" fill-opacity="0.55"/>
  <text x="149.1" y="95.6" text-anchor="end" font-size="9.5" fill="currentColor" fill-opacity="0.85">coarse</text>
  <polyline points="34,186 41.9,148 50.5,117.3 59.8,93.4 69.7,75.8 80.2,63.7 91.3,56.8 102.9,54.3 115,55.7 127.4,60.4 140.3,67.9 153.4,77.5 166.9,88.8 180.5,101 194.4,113.8 208.4,126.3 222.6,138.2 236.8,148.8 251,157.6 265.1,163.9 279.2,167.2 293.2,166.9 307,162.4 320.6,153.2 334,138.7 347.1,118.3 359.8,91.4 372.1,57.5 384,16" fill="none" stroke="currentColor" stroke-width="2" stroke-opacity="0.95"/>
  <text x="272.2" y="157.2" text-anchor="end" font-size="9.5" fill="currentColor" fill-opacity="0.85">fine</text>
  <text x="34" y="228" font-size="9.5" fill="currentColor" fill-opacity="0.7">A tolerance far below the coordinate scale turns one arc into thousands of points.</text>
</svg>
<!-- /fig:spline-sag-tradeoff -->

**Key implementation notes:**

- `spline.flattening(sag_tolerance, segments=...)` is the primary entry point. It returns `Vec3` objects; wrap them in `tuple()` for plain coordinate output.
- The `sag_tolerance` (the `distance` argument) is a maximum *deviation*, not a segment count. Halving it roughly quadruples vertices in curved regions while leaving straight regions untouched.
- `spline.weights` is empty for non-rational splines. Testing its length is a reliable way to report whether the curve is rational without touching the knot vector.
- `spline.control_points` and `spline.fit_points` can both be populated. `flattening()` evaluates the actual curve regardless of which representation drives it, so you do not choose between them for tessellation.
- Closed splines are periodic; `flattening()` already covers the full loop. Append the first point only to make the ring explicit for a `Polygon`.

## Compatibility Matrix

| Component | Supported Range | Notes |
|---|---|---|
| `ezdxf` version | `>=1.1.0` | `SPLINE.flattening()` and `construction_tool()` are stable and recommended at 1.1.0+. |
| Python | `3.9+` | Uses `typing` generics and f-strings only. |
| DXF format | `R2000` (`AC1015`) — `R2018` (`AC1032`) | `SPLINE` supported across the full range. |
| Curve type | Rational + non-rational | `weights` present => rational; honoured by `flattening()` and `BSpline`. |
| Degree | Any (commonly 3) | Read from `entity.dxf.degree`; higher degrees tessellate identically. |
| Closed / periodic | Supported | `flattening()` traverses the periodic curve; check `entity.closed`. |

For the group-code-level view of how control points (`10`), knots (`40`), and weights (`41`) are stored on a `SPLINE`, see the [DXF Entity Structure Breakdown](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/).

## Fallback Strategies

**1. Choosing sag tolerance versus segment count**

<!-- fig:spline-nurbs-parts -->
<svg viewBox="-20 -20 459 156.1" role="img" aria-label="Degree, control points, knot vector and weights — the four parts of a SPLINE entity NURBS definition" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:459px;display:block;margin:1.5rem auto;">
  <title>The four attributes that define a SPLINE</title>
  <desc>The parts of the NURBS definition a spline entity carries, and what each governs. Degree fixes the polynomial order; the control points shape the curve without generally lying on it; the knot vector distributes parameter space and is where a corrupt export usually shows; and the weights make the curve rational, which is how exact conic sections are represented.</desc>
  <defs>
    <marker id="spl2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="spl2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="459" height="156.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="207.4" height="92" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.5"/>
  <text x="14" y="16" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">dxf.degree      3</text>
  <line x1="213.4" y1="12.9" x2="245.4" y2="12.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="253.4" y="16" font-size="9.5" fill="currentColor" fill-opacity="0.78">polynomial order — 3 is near-universal</text>
  <text x="14" y="35" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">control_points  n</text>
  <line x1="213.4" y1="31.9" x2="245.4" y2="31.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="253.4" y="35" font-size="9.5" fill="currentColor" fill-opacity="0.78">shape the curve; generally not on it</text>
  <text x="14" y="54" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">knots           n+degree+1</text>
  <line x1="213.4" y1="50.9" x2="245.4" y2="50.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="253.4" y="54" font-size="9.5" fill="currentColor" fill-opacity="0.78">a wrong count is a corrupt export</text>
  <text x="14" y="73" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">weights         optional</text>
  <line x1="213.4" y1="69.9" x2="245.4" y2="69.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="253.4" y="73" font-size="9.5" fill="currentColor" fill-opacity="0.78">present ⇒ rational ⇒ exact conics</text>
  <text x="0" y="114" font-size="9.5" fill="currentColor" fill-opacity="0.7">A knot count that does not satisfy the identity is the first thing to check on a failed tessellation.</text>
</svg>
<!-- /fig:spline-nurbs-parts -->

Prefer a sag tolerance over a fixed segment count whenever geometric fidelity matters. `flattening(distance)` adapts to curvature, so tight bends get more points and straight runs get fewer. Reach for `construction_tool().approximate(n)` only when a downstream consumer requires a *fixed* number of vertices per curve regardless of shape (some GPU buffers and fixed-stride formats do). Set `distance` as a fraction of the smallest feature you care about — for metre-unit survey data, `0.05` (5 cm) is a sensible default.

**2. Rational versus non-rational splines**

Do not reconstruct the curve yourself from control points assuming unit weights — a rational spline (non-empty `weights`) will be wrong if you ignore them. Always tessellate through `flattening()` or the `BSpline` returned by `construction_tool()`, both of which apply weights correctly. Use `len(spline.weights) > 0` to record which curves are rational for audit.

**3. Periodic and closed splines**

A closed spline wraps around; its start and end coincide by construction. `flattening()` returns the full loop, so no manual seam handling is needed. When building a polygon ring, append the first point to close it explicitly and validate the result with Shapely before treating it as an area.

**4. Degenerate or zero-length splines**

Splines with fewer control points than `degree + 1`, coincident control points, or a collapsed knot vector can flatten to a single point or a straight line. Guard against silent emptiness:

```python
pts = [tuple(p) for p in spline.flattening(sag_tolerance)]
if len(pts) < 2:
    # Degenerate spline: log the handle and skip rather than emit a bad vertex.
    print(f"Degenerate SPLINE {spline.dxf.handle}: {len(pts)} point(s)")
```

**5. Fit-point-only splines from other CAD tools**

Some exporters write a `SPLINE` with fit points but an empty or minimal control-point hull. `flattening()` still evaluates it, but if you see `n_control_points == 0` alongside populated `fit_points`, record it — a few exotic writers omit the interpolated hull, and confirming the tessellation visually is worthwhile before trusting the geometry in a [coordinate transformation and alignment](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/aligning-bim-models-with-gis-survey-data/) step.

## FAQ

<details>
<summary><strong>What does the distance argument of spline.flattening mean?</strong></summary>

`distance` is the maximum allowed deviation (the sag or sagitta) between the true spline and the straight segments approximating it, expressed in drawing units. `ezdxf` subdivides adaptively so that no chord ever departs from the curve by more than `distance`, adding points only where curvature demands them.

</details>

<details>
<summary><strong>What is the difference between fit points and control points on a SPLINE?</strong></summary>

Fit points are coordinates the curve passes through exactly; control points are the weighted NURBS hull that defines the curve but which it generally does not touch. A `SPLINE` may store one, the other, or both. When control points are present, tessellate from them via the construction tool; fit points alone require interpolation, which `ezdxf` handles internally.

</details>

<details>
<summary><strong>Does ezdxf handle rational (weighted) splines?</strong></summary>

Yes. When `entity.weights` is non-empty the spline is rational, and both `entity.flattening()` and the `construction_tool()` `BSpline` honour the weights when evaluating the curve. If weights are absent the spline is non-rational and all control points carry an implicit weight of `1.0`.

</details>

<details>
<summary><strong>How do I tessellate a closed or periodic spline?</strong></summary>

Read `entity.closed`. `ezdxf.flattening()` already traverses the full periodic curve, so no manual wrap-around is needed. When assembling a closed ring for a polygon consumer, append the first tessellated point to the end so the ring is explicitly closed.

</details>

---

## Related Pages

- [ezdxf Deep Dive: Production-Grade DXF Parsing](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/) — parent reference covering entity traversal and geometry extraction
- [Extracting LWPOLYLINE Vertices with ezdxf](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/extracting-lwpolyline-vertices-with-ezdxf/) — the same sag-tolerance flattening applied to bulge arcs
- [Reading 3D Solids with ezdxf Python](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/reading-3d-solids-with-ezdxf-python/) — sibling workflow for `3DSOLID` ACIS payloads
- [Converting CAD Polylines to GeoJSON](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/converting-cad-polylines-to-geojson/) — writing tessellated spline vertices as GIS features
- [Aligning BIM Models with GIS Survey Data](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/aligning-bim-models-with-gis-survey-data/) — aligning the coordinates produced after tessellation with GIS survey control
