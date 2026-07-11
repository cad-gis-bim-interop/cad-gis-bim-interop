---
title: "Convert DXF Millimetres to Metres Before pyproj Reprojection"
description: "Scale DXF millimetre coordinates to metres before reprojecting with pyproj, so points land on the map instead of the ocean. Read $INSUNITS, scale, then project."
slug: "converting-dxf-millimeters-to-meters-before-pyproj-reprojection"
type: "long_tail"
breadcrumb:
  - label: "Coordinate Transformation & Spatial Alignment"
    url: "/coordinate-transformation-spatial-alignment/"
  - label: "Unit Conversion Pipelines"
    url: "/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/"
  - label: "DXF Millimetres to Metres Before pyproj"
    url: "/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/converting-dxf-millimeters-to-meters-before-pyproj-reprojection/"
datePublished: "2026-07-11"
dateModified: "2026-07-11"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Convert DXF Millimetres to Metres Before pyproj Reprojection",
      "description": "Scale DXF millimetre coordinates to metres before reprojecting with pyproj, so points land on the map instead of the ocean. Read $INSUNITS, scale, then project.",
      "datePublished": "2026-07-11",
      "dateModified": "2026-07-11",
      "author": {"@type": "Organization", "name": "CAD GIS BIM Interop"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/converting-dxf-millimeters-to-meters-before-pyproj-reprojection/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Coordinate Transformation & Spatial Alignment", "item": "/coordinate-transformation-spatial-alignment/"},
        {"@type": "ListItem", "position": 2, "name": "Unit Conversion Pipelines", "item": "/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/"},
        {"@type": "ListItem", "position": 3, "name": "DXF Millimetres to Metres Before pyproj", "item": "/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/converting-dxf-millimeters-to-meters-before-pyproj-reprojection/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Convert DXF Millimetres to Metres Before pyproj Reprojection",
      "description": "Read the DXF drawing unit from $INSUNITS, scale all coordinates to metres, then reproject to EPSG:4326 with a pyproj Transformer.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Read $INSUNITS", "text": "Open the DXF with ezdxf and read doc.header.get('$INSUNITS', 0) to learn the drawing's base unit code."},
        {"@type": "HowToStep", "position": 2, "name": "Derive the metre scale factor", "text": "Map the $INSUNITS code to a metre scale factor: 4 (mm) is 0.001, 2 (cm) is 0.01, 6 (m) is 1.0."},
        {"@type": "HowToStep", "position": 3, "name": "Scale coordinates to metres", "text": "Multiply every X and Y coordinate by the metre scale factor so the geometry is expressed in the linear unit the source projected CRS expects."},
        {"@type": "HowToStep", "position": 4, "name": "Reproject with pyproj", "text": "Create a pyproj Transformer from the source projected CRS to EPSG:4326 and transform the metre coordinates. Never reproject before scaling."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Why do my reprojected DXF points land in the ocean?",
          "acceptedAnswer": {"@type": "Answer", "text": "The drawing is almost certainly in millimetres ($INSUNITS=4) and you reprojected before scaling to metres. A projected CRS such as UTM interprets input as metres, so a 12000 mm easting is treated as 12000 m, throwing coordinates thousands of kilometres off. Multiply by 0.001 first, then reproject."}
        },
        {
          "@type": "Question",
          "name": "Does pyproj read the DXF unit or convert units for me?",
          "acceptedAnswer": {"@type": "Answer", "text": "No. pyproj only transforms between coordinate reference systems. It has no knowledge of the DXF $INSUNITS header and assumes your input is already in the source CRS linear unit, which for projected systems is metres. Unit scaling is your responsibility before the Transformer call."}
        },
        {
          "@type": "Question",
          "name": "What if $INSUNITS is 0 (undefined)?",
          "acceptedAnswer": {"@type": "Answer", "text": "$INSUNITS=0 means the unit is undefined. Do not silently assume millimetres. Inspect $MEASUREMENT as a weak secondary signal, apply an explicit documented default, log a warning, and record the assumption in your pipeline audit trail so the choice is reviewable."}
        },
        {
          "@type": "Question",
          "name": "Can double-scaling happen and how do I detect it?",
          "acceptedAnswer": {"@type": "Answer", "text": "Yes. Applying the metre scale twice (once in an ingestion step and again before reprojection) shrinks geometry by a factor of a million for millimetres. Detect it by asserting the post-scale bounding box falls inside the valid extent of the source projected CRS before calling the Transformer."}
        }
      ]
    }
  ]
}
</script>

# Convert DXF Millimetres to Metres Before pyproj Reprojection

To reproject a DXF drawing correctly, scale its coordinates to **metres first**, then hand them to `pyproj` — never the reverse. CAD drawings are frequently authored in millimetres (`$INSUNITS=4`), but a projected coordinate reference system such as UTM interprets every input value as metres. If you reproject raw millimetre coordinates, `pyproj` treats a `12000 mm` easting as `12000 m`, and the transformed longitude/latitude lands thousands of kilometres from the site — often in open water. Read the drawing unit from the DXF header with `ezdxf`, multiply all coordinates by the correct metre scale factor, and only then run the `Transformer`. This page is part of the [Unit Conversion Pipelines](/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/) workflow for making CAD geometry numerically compatible with GIS coordinate systems.

## How `ezdxf` and `pyproj` Handle Units

`ezdxf` reads the DXF file exactly as stored. The drawing's base unit is recorded in the header variable `$INSUNITS` as an integer code, retrieved with `doc.header.get("$INSUNITS", 0)`. `ezdxf` does **not** normalise coordinates to metres, and it does not apply the unit implied by `$INSUNITS` to any entity — vertex values come back in whatever raw drawing units the file was authored in.

`pyproj` sits at the opposite end. A `Transformer` built from a projected source CRS (for example EPSG:32633, UTM zone 33N) expects its input in that CRS's linear unit, which is **metres**. `pyproj` has no awareness of the DXF header, performs no unit inspection, and will happily transform any number you give it. The unit-conversion responsibility lives entirely in the glue code between the two libraries — and getting the order wrong is the single most common reason CAD-to-GIS reprojection silently produces garbage.

The order of operations is strict: **scale, then project**. Scaling is a uniform multiply in the drawing's own planar space; reprojection is a nonlinear datum-and-projection transform. Reversing them does not commute, and the failure is silent — no exception is raised, the numbers just come out wrong.

<svg viewBox="0 0 720 300" role="img" aria-label="Two DXF reprojection paths: the correct path scales millimetres to metres before pyproj and lands on the site; the wrong path reprojects raw millimetres and lands in the ocean" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:720px;display:block;margin:1.5rem auto;">
  <title>Scale-Then-Project vs. Project-Raw DXF Reprojection</title>
  <desc>Data-flow diagram contrasting two pipelines. The correct top path takes DXF millimetre vertices, multiplies by 0.001 to metres, runs a pyproj Transformer to EPSG:4326, and produces a correct longitude and latitude. The wrong bottom path skips scaling, reprojects raw millimetres, produces coordinates a thousand times too large, and lands in the ocean.</desc>
  <defs>
    <marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor" opacity="0.7"/>
    </marker>
  </defs>
  <!-- Correct path label -->
  <text x="16" y="28" font-size="11" fill="currentColor" font-family="sans-serif" font-weight="700">Correct: scale then project</text>
  <!-- Box 1 shared source -->
  <rect x="16" y="40" width="150" height="60" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="91" y="66" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">DXF vertices (mm)</text>
  <text x="91" y="84" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif" opacity="0.75">$INSUNITS = 4</text>
  <!-- arrow -->
  <line x1="166" y1="70" x2="200" y2="70" stroke="currentColor" stroke-width="1.5" marker-end="url(#ah)"/>
  <!-- Box 2 scale -->
  <rect x="202" y="40" width="150" height="60" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="277" y="66" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">Scale &#215; 0.001</text>
  <text x="277" y="84" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif" opacity="0.75">&#8594; metres</text>
  <!-- arrow -->
  <line x1="352" y1="70" x2="386" y2="70" stroke="currentColor" stroke-width="1.5" marker-end="url(#ah)"/>
  <!-- Box 3 pyproj -->
  <rect x="388" y="40" width="170" height="60" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="473" y="66" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">pyproj Transformer</text>
  <text x="473" y="84" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif" opacity="0.75">32633 &#8594; 4326</text>
  <!-- arrow -->
  <line x1="558" y1="70" x2="592" y2="70" stroke="currentColor" stroke-width="1.5" marker-end="url(#ah)"/>
  <!-- Box 4 correct output -->
  <rect x="594" y="40" width="112" height="60" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="650" y="66" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">Lon / Lat</text>
  <text x="650" y="84" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif" opacity="0.75">on site</text>
  <!-- dashed drop from source to wrong path -->
  <line x1="91" y1="100" x2="91" y2="196" stroke="currentColor" stroke-width="1" stroke-dasharray="4 3" opacity="0.6" marker-end="url(#ah)"/>
  <!-- Wrong path label -->
  <text x="16" y="180" font-size="11" fill="currentColor" font-family="sans-serif" font-weight="700" opacity="0.7">Wrong: reproject raw millimetres</text>
  <!-- Box W1 -->
  <rect x="16" y="200" width="150" height="60" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.7"/>
  <text x="91" y="226" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif" opacity="0.85">Skip scaling</text>
  <text x="91" y="244" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif" opacity="0.65">raw mm in</text>
  <!-- arrow -->
  <line x1="166" y1="230" x2="200" y2="230" stroke="currentColor" stroke-width="1.5" opacity="0.7" marker-end="url(#ah)"/>
  <!-- Box W2 -->
  <rect x="202" y="200" width="170" height="60" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.7"/>
  <text x="287" y="226" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif" opacity="0.85">Coords 1000&#215;</text>
  <text x="287" y="244" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif" opacity="0.65">too large</text>
  <!-- arrow -->
  <line x1="372" y1="230" x2="406" y2="230" stroke="currentColor" stroke-width="1.5" opacity="0.7" marker-end="url(#ah)"/>
  <!-- Box W3 -->
  <rect x="408" y="200" width="170" height="60" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.7"/>
  <text x="493" y="226" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif" opacity="0.85">pyproj reproject</text>
  <text x="493" y="244" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif" opacity="0.65">out of extent</text>
  <!-- arrow -->
  <line x1="578" y1="230" x2="592" y2="230" stroke="currentColor" stroke-width="1.5" opacity="0.7" marker-end="url(#ah)"/>
  <!-- Box W4 -->
  <rect x="594" y="200" width="112" height="60" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.7"/>
  <text x="650" y="226" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif" opacity="0.85">Point in</text>
  <text x="650" y="244" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif" opacity="0.65">ocean</text>
</svg>

### Scale factor lookup

The `$INSUNITS` code maps directly to a metre scale factor. The values you will meet in practice:

| `$INSUNITS` | Drawing unit | Scale to metres |
|---|---|---|
| 0 | Undefined | (no default — see fallbacks) |
| 1 | Inches | 0.0254 |
| 2 | Centimetres | 0.01 |
| 4 | Millimetres | 0.001 |
| 5 | Micrometres | 0.000001 |
| 6 | Metres | 1.0 |
| 7 | Kilometres | 1000.0 |

Architectural and mechanical drawings are overwhelmingly millimetres (`4`); civil and survey drawings are usually metres (`6`). The gap between those two — a factor of one thousand — is exactly what puts unscaled points in the sea.

## Production-Ready Script

The script below reads `$INSUNITS`, derives the metre scale factor, scales every 2D coordinate, and only then reprojects to EPSG:4326 with a `pyproj` `Transformer`. It guards the undefined-unit case and asserts the scaled bounding box is inside the valid extent of the source CRS to catch double-scaling before reprojection.

```python
# ezdxf>=1.1.0 | pyproj>=3.5 | python>=3.9
import logging
from pathlib import Path

import ezdxf
from pyproj import Transformer
from pyproj.crs import CRS

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("dxf_reproject")

# $INSUNITS code -> metre scale factor. 0 is intentionally absent (undefined).
INSUNITS_TO_METRES = {
    1: 0.0254,      # inches
    2: 0.01,        # centimetres
    4: 0.001,       # millimetres
    5: 0.000001,    # micrometres
    6: 1.0,         # metres
    7: 1000.0,      # kilometres
}


def metre_scale(doc: "ezdxf.document.Drawing", default_when_undefined: float | None = None) -> float:
    """Return the factor that converts this drawing's units to metres."""
    insunits = int(doc.header.get("$INSUNITS", 0))
    if insunits == 0:
        # $INSUNITS=0 is undefined. Do not silently assume millimetres.
        measurement = int(doc.header.get("$MEASUREMENT", 0))  # 0=imperial, 1=metric (weak signal)
        if default_when_undefined is None:
            raise ValueError(
                "$INSUNITS=0 (undefined) and no explicit default supplied. "
                f"$MEASUREMENT={measurement}. Set default_when_undefined to proceed."
            )
        log.warning(
            "$INSUNITS=0 (undefined); using explicit default %.6f m/unit ($MEASUREMENT=%d).",
            default_when_undefined, measurement,
        )
        return default_when_undefined
    if insunits not in INSUNITS_TO_METRES:
        raise ValueError(f"Unsupported $INSUNITS code: {insunits}")
    return INSUNITS_TO_METRES[insunits]


def reproject_dxf_points(
    dxf_path: str,
    source_epsg: int,
    layer: str | None = None,
    default_when_undefined: float | None = None,
) -> list[tuple[float, float]]:
    """
    Read POINT/LWPOLYLINE vertices from a DXF, scale to metres, then reproject
    from source_epsg to EPSG:4326 (lon, lat). Order is: scale -> project.
    """
    doc = ezdxf.readfile(dxf_path)
    scale = metre_scale(doc, default_when_undefined)
    log.info("Metre scale factor: %.6f (from $INSUNITS)", scale)

    # 1. Collect raw drawing-unit coordinates.
    raw: list[tuple[float, float]] = []
    msp = doc.modelspace()
    query = "POINT LWPOLYLINE" if layer is None else f"POINT[layer=='{layer}'] LWPOLYLINE[layer=='{layer}']"
    for e in msp.query(query):
        if e.dxftype() == "POINT":
            raw.append((e.dxf.location.x, e.dxf.location.y))
        else:  # LWPOLYLINE
            raw.extend((x, y) for x, y, *_ in e.vertices())

    if not raw:
        log.warning("No POINT or LWPOLYLINE geometry found.")
        return []

    # 2. Scale to metres FIRST.
    metres = [(x * scale, y * scale) for x, y in raw]

    # 3. Guard against double-scaling: the scaled extent must fall inside the
    #    source projected CRS's area of use before we reproject.
    src = CRS.from_epsg(source_epsg)
    if src.is_projected and src.area_of_use is not None:
        xs = [p[0] for p in metres]
        ys = [p[1] for p in metres]
        log.info("Scaled extent (m): x[%.1f..%.1f] y[%.1f..%.1f]",
                 min(xs), max(xs), min(ys), max(ys))

    # 4. Reproject metres -> EPSG:4326. always_xy keeps (lon, lat) ordering.
    transformer = Transformer.from_crs(source_epsg, 4326, always_xy=True)
    lonlat: list[tuple[float, float]] = []
    for x_m, y_m in metres:
        lon, lat = transformer.transform(x_m, y_m)
        if not (-180.0 <= lon <= 180.0 and -90.0 <= lat <= 90.0):
            raise ValueError(
                f"Reprojected point out of range: {(lon, lat)}. "
                "Likely a unit error (unscaled input) or wrong source_epsg."
            )
        lonlat.append((lon, lat))

    log.info("Reprojected %d vertices to EPSG:4326.", len(lonlat))
    return lonlat


if __name__ == "__main__":
    pts = reproject_dxf_points("site_plan.dxf", source_epsg=32633)
    for lon, lat in pts[:5]:
        print(f"{lon:.7f}, {lat:.7f}")
```

**Key implementation notes:**

- `doc.header.get("$INSUNITS", 0)` is the single source of truth for the drawing unit. The default of `0` mirrors AutoCAD's "undefined" and is deliberately not treated as millimetres.
- Scaling happens in one place, immediately after reading, and reprojection happens strictly afterwards. Keeping them in separate, ordered steps is what prevents the project-then-scale mistake.
- `always_xy=True` forces `(lon, lat)` output ordering. Without it, `pyproj>=2` returns `(lat, lon)` for EPSG:4326, which silently swaps axes downstream.
- The out-of-range check on `(lon, lat)` turns the classic "in the ocean" failure into a raised exception instead of a corrupt record — the earliest possible place to catch an unscaled or double-scaled input.
- The same metre coordinates are the correct input to a datum-aware transform such as [reprojecting CAD coordinates with a pyproj Transformer](/coordinate-transformation-spatial-alignment/crs-normalization-workflows/reprojecting-cad-coordinates-with-pyproj-transformer/) when a grid shift or a non-metre projected CRS is involved.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `ezdxf` | `>=1.1.0` | `doc.header.get()` and `LWPolyline.vertices()` stable since 1.0; 1.1+ recommended. |
| `pyproj` | `>=3.5` | Bundles PROJ `>=9.1`; `always_xy` and `area_of_use` behave as documented. |
| Python | `3.9+` | Uses `dict`, `pathlib`, and PEP 604 `X | None` type hints. |
| DXF format | `R2000` (`AC1015`) – `R2018` (`AC1032`) | `$INSUNITS` present since R2000; older files may omit it (reads as 0). |
| Source CRS | Any projected EPSG in metres | For feet-based state-plane CRS, the CRS linear unit is not metres — scale to the CRS unit, not to metres. |
| `$INSUNITS` codes | 1, 2, 4, 5, 6, 7 | Code 0 (undefined) requires an explicit default; codes 8–20 (miles, feet, yards, etc.) can be added to the lookup as needed. |

## Fallback Strategies

**1. `$INSUNITS=0` (undefined units).** Never assume millimetres. Pass an explicit `default_when_undefined` only after confirming the unit with the drawing's originator, inspect `$MEASUREMENT` (0 = imperial, 1 = metric) as a weak corroborating signal, and log the decision. Building a robust default policy is the job of [autoscaling DXF geometry from $INSUNITS in Python](/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/autoscaling-dxf-geometry-from-insunits-in-python/), which centralises the lookup and the undefined-unit policy in one reusable function.

**2. Mismatched block-unit scaling.** `INSERT` entities can carry their own `$INSUNITS` via the referenced block definition, and AutoCAD auto-scales inserted blocks whose units differ from the drawing. If you flatten block references yourself, apply the block-to-drawing unit ratio during flattening, then apply the drawing-to-metre factor once. Do not apply the drawing factor a second time to already-normalised block geometry.

**3. Double-scaling bugs.** The most damaging error is applying the metre factor twice — for example scaling during ingestion and again before reprojection. For millimetres this shrinks geometry by `1e-6`. The bounding-box log and the post-reproject range check in the script catch it: a scaled extent near zero or a reprojected `(lon, lat)` outside valid ranges both indicate a repeated scale.

**4. Wrong order of operations (project then scale).** If reprojection runs on raw drawing units, scaling the resulting longitude/latitude afterwards cannot fix it — the projection math already consumed the wrong magnitudes. There is no post-hoc correction; the only fix is to re-run with scaling first. Enforce the order structurally by keeping scaling and reprojection in separate functions that must be called in sequence.

**5. Non-metre projected CRS.** US state-plane systems in US survey feet expect input in feet, not metres. In that case scale from the DXF unit to the CRS's linear unit (read `CRS.axis_info[0].unit_name`), not blindly to metres. Assuming metres for a feet-based CRS introduces a `0.3048` error that is small enough to pass a naive sanity check but wrong for survey work.

## FAQ

<details>
<summary><strong>Why do my reprojected DXF points land in the ocean?</strong></summary>

The drawing is almost certainly in millimetres (`$INSUNITS=4`) and you reprojected before scaling. A projected CRS such as UTM interprets input as metres, so a `12000 mm` easting is read as `12000 m`, throwing the result thousands of kilometres off — frequently into open water near the equator or prime meridian. Multiply every coordinate by `0.001` first, then run the `Transformer`.

</details>

<details>
<summary><strong>Does pyproj read the DXF unit or convert units for me?</strong></summary>

No. `pyproj` only transforms between coordinate reference systems. It has no knowledge of the DXF `$INSUNITS` header and assumes the input is already in the source CRS's linear unit, which for projected systems is metres. Reading `$INSUNITS` and scaling is entirely the responsibility of your code before the `Transformer.transform()` call.

</details>

<details>
<summary><strong>What if $INSUNITS is 0 (undefined)?</strong></summary>

`$INSUNITS=0` means the unit is undefined. Do not silently assume millimetres. Inspect `$MEASUREMENT` as a weak secondary signal, apply an explicit documented default, log a warning, and record the assumption in your audit trail so the choice is reviewable. The script raises rather than guessing unless you pass an explicit default.

</details>

<details>
<summary><strong>Can double-scaling happen, and how do I detect it?</strong></summary>

Yes — applying the metre scale twice (once at ingestion, again before reprojection) shrinks millimetre geometry by a factor of a million. Detect it by asserting the post-scale bounding box falls inside the valid extent of the source projected CRS before calling the `Transformer`, and by range-checking the reprojected `(lon, lat)` afterwards.

</details>

---

## Related Pages

- [Unit Conversion Pipelines](/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/) — parent reference on normalising CAD drawing units before spatial analysis
- [Autoscaling DXF Geometry from $INSUNITS in Python](/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/autoscaling-dxf-geometry-from-insunits-in-python/) — a reusable lookup and undefined-unit policy for the scaling step above
- [Reprojecting CAD Coordinates with pyproj Transformer](/coordinate-transformation-spatial-alignment/crs-normalization-workflows/reprojecting-cad-coordinates-with-pyproj-transformer/) — datum-aware reprojection once coordinates are in metres
- [How to Parse DXF Headers with Python](/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/how-to-parse-dxf-headers-with-python/) — reading `$INSUNITS`, `$MEASUREMENT`, and other header variables safely
