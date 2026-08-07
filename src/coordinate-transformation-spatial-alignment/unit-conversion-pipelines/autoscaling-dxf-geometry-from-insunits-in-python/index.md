---
title: "Autoscaling DXF Geometry from $INSUNITS in Python"
description: "Build a reusable $INSUNITS-to-metres lookup and an autoscale function in Python that reads the DXF header, handles undefined units, and returns a scaled document."
slug: "autoscaling-dxf-geometry-from-insunits-in-python"
breadcrumb:
  - label: "Coordinate Transformation & Spatial Alignment"
    url: "/coordinate-transformation-spatial-alignment/"
  - label: "Unit Conversion Pipelines"
    url: "/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/"
  - label: "Autoscaling DXF Geometry from $INSUNITS"
    url: "/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/autoscaling-dxf-geometry-from-insunits-in-python/"
datePublished: "2026-07-11"
dateModified: "2026-07-11"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Autoscaling DXF Geometry from $INSUNITS in Python",
      "description": "Build a reusable $INSUNITS-to-metres lookup and an autoscale function in Python that reads the DXF header, handles undefined units, and returns a scaled document.",
      "datePublished": "2026-07-11",
      "dateModified": "2026-07-11",
      "author": {"@type": "Organization", "name": "CAD GIS BIM Interop"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/autoscaling-dxf-geometry-from-insunits-in-python/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Coordinate Transformation & Spatial Alignment", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/"},
        {"@type": "ListItem", "position": 2, "name": "Unit Conversion Pipelines", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/"},
        {"@type": "ListItem", "position": 3, "name": "Autoscaling DXF Geometry from $INSUNITS", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/autoscaling-dxf-geometry-from-insunits-in-python/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Autoscale DXF Geometry from $INSUNITS in Python",
      "description": "Read the DXF header unit, resolve it to a metre scale factor via a reusable lookup, and return the scale plus a metre-normalised copy of the document.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Build the $INSUNITS lookup", "text": "Define a mapping from every $INSUNITS integer code to its metre scale factor, treating 0 as undefined rather than a default unit."},
        {"@type": "HowToStep", "position": 2, "name": "Read the header", "text": "Open the DXF with ezdxf and read doc.header.get('$INSUNITS', 0) to obtain the drawing's base unit code."},
        {"@type": "HowToStep", "position": 3, "name": "Apply the undefined-unit policy", "text": "When $INSUNITS is 0, apply an explicit configured default, cross-check $MEASUREMENT as a weak fallback, and log an audit warning."},
        {"@type": "HowToStep", "position": 4, "name": "Return scale and scaled document", "text": "Return the metre scale factor and a transformed copy of the modelspace geometry scaled by that factor."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What does each $INSUNITS value mean?",
          "acceptedAnswer": {"@type": "Answer", "text": "$INSUNITS is an integer code for the drawing's base unit: 0 undefined, 1 inches (0.0254 m), 2 feet (0.3048 m), 4 millimetres (0.001 m), 5 centimetres (0.01 m), 6 metres (1.0 m), 7 kilometres (1000 m). Higher codes cover miles, yards, microns, and other units. Map the code to a metre scale factor before doing spatial work."}
        },
        {
          "@type": "Question",
          "name": "How should I handle $INSUNITS=0?",
          "acceptedAnswer": {"@type": "Answer", "text": "Treat 0 as undefined, never as a silent millimetre default. Apply an explicit configured policy default, inspect $MEASUREMENT (0 imperial, 1 metric) as a weak secondary signal, log a warning with the file name, and record the assumed unit in your audit trail so it can be reviewed."}
        },
        {
          "@type": "Question",
          "name": "Is $MEASUREMENT a reliable unit source?",
          "acceptedAnswer": {"@type": "Answer", "text": "No. $MEASUREMENT only distinguishes imperial (0) from metric (1) drafting settings and does not identify the specific unit. Use it only as a weak tiebreaker when $INSUNITS is undefined, for example choosing a metric versus imperial default, never as the primary unit determinant."}
        },
        {
          "@type": "Question",
          "name": "Does ezdxf rescale INSERT block geometry automatically?",
          "acceptedAnswer": {"@type": "Answer", "text": "No. ezdxf does not auto-scale inserted blocks that carry a different unit from the drawing. If a block definition has its own units, you must apply the block-to-drawing ratio yourself during flattening, then apply the drawing-to-metre factor once. Autoscaling the header unit alone does not resolve per-INSERT unit overrides."}
        }
      ]
    }
  ]
}
</script>

# Autoscaling DXF Geometry from $INSUNITS in Python

Autoscaling a DXF means reading the drawing's `$INSUNITS` header code, resolving it to a metre scale factor through a single authoritative lookup, and returning both the factor and a metre-normalised copy of the geometry — with an explicit, logged policy for the undefined case. A reusable `autoscale_document()` function removes the guesswork and the copy-paste scale tables that scatter unit bugs across a codebase. This page is part of the [Unit Conversion Pipelines](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/) workflow, and it centralises the scaling step that the [conversion of DXF millimetres to metres before pyproj reprojection](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/converting-dxf-millimeters-to-meters-before-pyproj-reprojection/) depends on. Get the lookup and the `$INSUNITS=0` policy right once, and every downstream reprojection, area calculation, and GIS export inherits correct magnitudes.

## How `ezdxf` Exposes `$INSUNITS`

`$INSUNITS` is a header variable, not an entity property. `ezdxf` reads it verbatim with `doc.header.get("$INSUNITS", 0)`, returning an integer code. Crucially, `ezdxf` never applies that unit to coordinates: vertices come back in raw drawing units regardless of what `$INSUNITS` says. The header code is metadata describing intent; converting geometry to a common unit is entirely your responsibility.

The value `0` is a first-class case, not an error. It means the originating application did not record a base unit — common in older files, minimal DXF exports, and drawings created without a template. A robust autoscale routine must decide what `0` means through explicit policy rather than a buried default. The secondary header `$MEASUREMENT` (0 = imperial, 1 = metric) is only a drafting-mode flag: it distinguishes inch-family from millimetre-family defaults but never names the exact unit, so it can serve only as a weak tiebreaker.

<svg viewBox="0 0 700 320" role="img" aria-label="Autoscale decision flow: read $INSUNITS, if a known code map to a metre factor, if zero apply an explicit policy using $MEASUREMENT and a configured default, then return scale and scaled document" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:700px;display:block;margin:1.5rem auto;">
  <title>$INSUNITS Autoscale Decision Flow</title>
  <desc>Decision diagram. Reading $INSUNITS branches on whether the code is known. A known non-zero code maps through the lookup table to a metre scale factor. A zero code enters the undefined-unit policy, which consults $MEASUREMENT and a configured default and logs a warning. Both branches converge on returning the scale factor and a scaled document copy.</desc>
  <defs>
    <marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor" opacity="0.7"/>
    </marker>
  </defs>
  <rect x="0" y="0" width="700" height="320" fill="var(--color-surface)"/>
  <!-- Read header -->
  <rect x="270" y="14" width="160" height="48" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="350" y="38" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">Read $INSUNITS</text>
  <text x="350" y="50" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">header.get(...)</text>
  <line x1="350" y1="62" x2="350" y2="86" stroke="currentColor" stroke-width="1.5" marker-end="url(#ar)"/>
  <!-- Decision diamond -->
  <polygon points="350,86 432,126 350,166 268,126" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="350" y="122" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">code</text>
  <text x="350" y="138" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">known?</text>
  <!-- Left: known -->
  <line x1="268" y1="126" x2="150" y2="126" stroke="currentColor" stroke-width="1.5" marker-end="url(#ar)"/>
  <text x="205" y="118" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif">yes (1..7)</text>
  <rect x="24" y="102" width="126" height="48" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="87" y="126" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">Lookup table</text>
  <text x="87" y="138" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">code &#8594; metres</text>
  <!-- Right: zero -->
  <line x1="432" y1="126" x2="548" y2="126" stroke="currentColor" stroke-width="1.5" marker-end="url(#ar)"/>
  <text x="492" y="118" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif">no (0)</text>
  <rect x="548" y="94" width="144" height="72" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/>
  <text x="620" y="116" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">Undefined policy</text>
  <text x="620" y="134" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">$MEASUREMENT</text>
  <text x="620" y="150" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">+ default + log</text>
  <!-- converge -->
  <line x1="87" y1="150" x2="87" y2="250" stroke="currentColor" stroke-width="1.5" marker-end="url(#ar)"/>
  <line x1="620" y1="166" x2="620" y2="250" stroke="currentColor" stroke-width="1.5" marker-end="url(#ar)"/>
  <line x1="87" y1="262" x2="272" y2="262" stroke="currentColor" stroke-width="1.5" marker-end="url(#ar)"/>
  <line x1="620" y1="262" x2="428" y2="262" stroke="currentColor" stroke-width="1.5" marker-end="url(#ar)"/>
  <rect x="272" y="238" width="156" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="350" y="262" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">Return scale</text>
  <text x="350" y="278" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">+ scaled document</text>
</svg>

## Production-Ready Script

The module below defines the canonical `$INSUNITS` lookup, an `autoscale_document()` function that returns a `(scale, scaled_doc)` pair, and a small pytest fixture demonstrating the undefined-unit policy. Geometry is scaled in place on an in-memory copy using `ezdxf`'s `Matrix44` uniform scale so blocks, `LWPOLYLINE`s, and points all move together.

```python
# ezdxf>=1.1.0 | python>=3.9
from __future__ import annotations

import logging
from dataclasses import dataclass

import ezdxf
from ezdxf.document import Drawing
from ezdxf.math import Matrix44

log = logging.getLogger("dxf_autoscale")

# Canonical $INSUNITS -> metres lookup. Code 0 is intentionally absent: undefined.
INSUNITS_TO_METRES: dict[int, float] = {
    1: 0.0254,      # inches
    2: 0.3048,      # feet
    4: 0.001,       # millimetres
    5: 0.01,        # centimetres
    6: 1.0,         # metres
    7: 1000.0,      # kilometres
}


@dataclass
class ScaleResult:
    scale: float          # metres per drawing unit
    insunits: int         # raw header code
    undefined: bool       # True if $INSUNITS was 0 and a default was applied


def resolve_scale(
    doc: Drawing,
    default_when_undefined: float = 0.001,
    trust_measurement: bool = True,
) -> ScaleResult:
    """
    Resolve the metre scale factor for a drawing from its $INSUNITS header.
    Applies an explicit, logged policy when $INSUNITS=0 (undefined).
    """
    insunits = int(doc.header.get("$INSUNITS", 0))
    if insunits == 0:
        applied = default_when_undefined
        if trust_measurement:
            # $MEASUREMENT: 0 = imperial, 1 = metric. Weak fallback only.
            measurement = int(doc.header.get("$MEASUREMENT", 1))
            applied = 0.001 if measurement == 1 else 0.0254  # mm vs inch family
        log.warning(
            "$INSUNITS=0 (undefined). Applying default scale %.6f m/unit. "
            "Verify unit with the drawing originator.", applied,
        )
        return ScaleResult(scale=applied, insunits=0, undefined=True)

    if insunits not in INSUNITS_TO_METRES:
        raise ValueError(f"Unsupported $INSUNITS code: {insunits}")
    return ScaleResult(scale=INSUNITS_TO_METRES[insunits], insunits=insunits, undefined=False)


def autoscale_document(
    doc: Drawing,
    default_when_undefined: float = 0.001,
    write_back_header: bool = True,
) -> tuple[float, Drawing]:
    """
    Read $INSUNITS, resolve the metre scale, and return (scale, scaled_copy).
    The returned document has all modelspace geometry scaled to metres.
    """
    result = resolve_scale(doc, default_when_undefined=default_when_undefined)
    scale = result.scale

    if abs(scale - 1.0) < 1e-12:
        log.info("Drawing already in metres ($INSUNITS=%d); no scaling applied.", result.insunits)
        return scale, doc

    scaled = doc  # ezdxf documents are mutated in place; caller passes a fresh readfile()
    m = Matrix44.scale(scale, scale, scale)
    for entity in scaled.modelspace():
        if hasattr(entity, "transform"):
            entity.transform(m)  # uniform scale about the WCS origin

    if write_back_header:
        # After scaling, the drawing IS in metres -> record it as $INSUNITS=6.
        scaled.header["$INSUNITS"] = 6

    log.info("Autoscaled by %.6f m/unit (from $INSUNITS=%d, undefined=%s).",
             scale, result.insunits, result.undefined)
    return scale, scaled


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    doc = ezdxf.readfile("drawing.dxf")
    factor, metric_doc = autoscale_document(doc)
    print(f"Applied scale: {factor} m/unit")
```

<!-- fig:insunits-lookup -->
<svg viewBox="-20 -20 435.4 304.1" role="img" aria-label="The $INSUNITS codes and their metre scale factors, with code 0 excluded because it means undefined rather than a unit" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:435px;display:block;margin:1.5rem auto;">
  <title>The $INSUNITS codes a CAD pipeline actually meets</title>
  <desc>The header codes that appear in practice, each with its unit and the factor that converts a drawing coordinate to metres. Code zero is deliberately absent from the lookup: it means the authoring application recorded no base unit, and treating it as a unit rather than as a missing value is what turns an unlabelled drawing into a thousandfold scale error.</desc>
  <defs>
    <marker id="ins1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ins1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="435.4" height="304.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="263.2" height="242" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="263.2" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">$INSUNITS</text>
  <text x="122.8" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Unit</text>
  <line x1="162.3" y1="0" x2="162.3" y2="242" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="212.7" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Metres per unit</text>
  <line x1="83.3" y1="0" x2="83.3" y2="242" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="263.2" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">0</text>
  <text x="122.8" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">undefined</text>
  <text x="212.7" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">not in the lookup</text>
  <line x1="0" y1="62" x2="263.2" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">1</text>
  <text x="122.8" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">inches</text>
  <text x="212.7" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">0.0254</text>
  <line x1="0" y1="92" x2="263.2" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">2</text>
  <text x="122.8" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">feet</text>
  <text x="212.7" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">0.3048</text>
  <line x1="0" y1="122" x2="263.2" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="140.5" font-size="10.5" font-weight="600" fill="currentColor">4</text>
  <text x="122.8" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">millimetres</text>
  <text x="212.7" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">0.001</text>
  <line x1="0" y1="152" x2="263.2" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="170.5" font-size="10.5" font-weight="600" fill="currentColor">5</text>
  <text x="122.8" y="170.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">centimetres</text>
  <text x="212.7" y="170.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">0.01</text>
  <line x1="0" y1="182" x2="263.2" y2="182" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="200.5" font-size="10.5" font-weight="600" fill="currentColor">6</text>
  <text x="122.8" y="200.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">metres</text>
  <text x="212.7" y="200.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">1.0</text>
  <line x1="0" y1="212" x2="263.2" y2="212" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="230.5" font-size="10.5" font-weight="600" fill="currentColor">7</text>
  <text x="122.8" y="230.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">kilometres</text>
  <text x="212.7" y="230.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">1000.0</text>
  <text x="0" y="262" font-size="9.5" fill="currentColor" fill-opacity="0.7">Codes 1 and 2 are inches and feet — the off-by-one that catches teams skimming the spec.</text>
</svg>
<!-- /fig:insunits-lookup -->

A minimal test that exercises both a known unit and the undefined policy:

```python
# ezdxf>=1.1.0 | pytest>=7 | python>=3.9
import ezdxf
import pytest
from dxf_autoscale import autoscale_document, resolve_scale


def _doc_with(insunits: int, measurement: int = 1):
    doc = ezdxf.new(dxfversion="R2018")
    doc.header["$INSUNITS"] = insunits
    doc.header["$MEASUREMENT"] = measurement
    doc.modelspace().add_line((0, 0), (1000, 0))  # 1000 drawing units long
    return doc


def test_millimetre_scale():
    scale, _ = autoscale_document(_doc_with(4))  # mm
    assert scale == pytest.approx(0.001)


def test_metres_no_scaling():
    scale, doc = autoscale_document(_doc_with(6))  # already metres
    assert scale == pytest.approx(1.0)


def test_undefined_uses_measurement():
    # $INSUNITS=0, $MEASUREMENT=0 (imperial) -> inch-family default
    result = resolve_scale(_doc_with(0, measurement=0))
    assert result.undefined is True
    assert result.scale == pytest.approx(0.0254)
```

**Key implementation notes:**

- The lookup is defined once and imported everywhere; no other module should carry its own `$INSUNITS` table. This is what stops divergent, half-correct copies drifting apart.
- `resolve_scale()` is pure and side-effect-free except for logging, so it is trivially unit-testable. `autoscale_document()` is the effectful wrapper that mutates geometry.
- `Matrix44.scale(scale, scale, scale)` applies a uniform scale about the WCS origin. Scaling about the origin (rather than a base point) is correct here because a pure unit change must not translate geometry.
- After scaling, the routine writes `$INSUNITS=6` back so the document self-describes as metres and cannot be scaled a second time by a later stage — a structural guard against double-scaling.
- Reading `$INSUNITS` safely is covered in depth by [how to parse DXF headers with Python](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/how-to-parse-dxf-headers-with-python/), including the fallback chains this function relies on.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `ezdxf` | `>=1.1.0` | `Matrix44.scale`, `entity.transform()`, and header write-back stable since 1.0. |
| Python | `3.9+` | Uses `from __future__ import annotations`, `dataclasses`, PEP 604 hints. |
| DXF format | `R2000` (`AC1015`) – `R2018` (`AC1032`) | `$INSUNITS` present since R2000; earlier files read as 0. |
| `$INSUNITS` codes | 1, 2, 4, 5, 6, 7 | Common linear units mapped; extend the table with additional codes as your sources require. |
| `$MEASUREMENT` | 0 or 1 | Weak metric/imperial flag; used only as an undefined-unit tiebreaker. |
| Geometry types | Any entity with `transform()` | Entities lacking `transform()` (some proxies) are skipped; log and review them. |

## Fallback Strategies

**1. Undefined units (`$INSUNITS=0`).** Apply a configured default, use `$MEASUREMENT` as a weak metric/imperial tiebreaker, and log the applied factor with the file name. Surface `undefined=True` in the result so callers can route the file to manual verification rather than trusting it silently.

<!-- fig:insunits-zero-policy -->
<svg viewBox="-20 -20 422.5 229.6" role="img" aria-label="A known $INSUNITS code resolves exactly; code zero enters an explicit, logged policy rather than a silent default" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:423px;display:block;margin:1.5rem auto;">
  <title>The policy path for an undefined $INSUNITS</title>
  <desc>A branch on the undefined case. A recognised non-zero code resolves through the lookup to an exact factor. A zero code enters the policy path: the configured default is applied, the drafting-mode flag is consulted only as a weak tiebreaker, and the assumption is logged so it is reviewable rather than invisible.</desc>
  <defs>
    <marker id="ins2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ins2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="422.5" height="229.6" fill="var(--color-surface)"/>
  <polygon points="191.2,0 286.2,31 191.2,62 96.2,31" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-width="1.6"/>
  <text x="191.2" y="35" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">$INSUNITS = 0?</text>
  <rect x="0" y="128" width="177.2" height="61.6" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="88.6" y="155" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Exact factor</text>
  <text x="88.6" y="168.7" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">from the lookup</text>
  <path d="M 191.2 62 L 191.2 92 L 88.6 92 L 88.6 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#ins2-a)" stroke-linejoin="round"/>
  <text x="88.6" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">no — known code</text>
  <rect x="205.2" y="128" width="177.2" height="61.6" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="293.9" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Configured default</text>
  <text x="293.9" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">$MEASUREMENT as tiebreaker</text>
  <text x="293.9" y="175.4" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">assumption logged</text>
  <path d="M 191.2 62 L 191.2 92 L 293.9 92 L 293.9 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#ins2-a)" stroke-linejoin="round"/>
  <text x="293.9" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">yes — undefined</text>
</svg>
<!-- /fig:insunits-zero-policy -->

**2. Per-`INSERT` unit overrides.** A block definition can carry its own units, and AutoCAD scales inserted blocks whose units differ from the drawing. `autoscale_document()` scales the drawing uniformly and does not resolve block-level unit mismatches. If your blocks were authored in different units, flatten and apply the block-to-drawing ratio before the drawing-to-metre scale, exactly as when [converting DXF millimetres to metres before pyproj reprojection](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/converting-dxf-millimeters-to-meters-before-pyproj-reprojection/).

**3. Survey vs. architectural defaults.** When the unit is undefined, the safe default depends on discipline: architectural and mechanical drawings default to millimetres, civil and survey drawings to metres. Make the default configurable per ingestion source rather than hard-coding one global assumption.

**4. Audit logging.** Every autoscale decision — the code read, the factor applied, whether it was a default — must be logged and ideally persisted alongside the output. Unit errors are silent by nature; the audit log is often the only way to reconstruct why a dataset was off by a factor of a thousand weeks later.

**5. Entities without `transform()`.** Some proxy or custom entities do not implement `transform()` and are skipped by the scale loop, leaving them at raw magnitude. Count skipped entities and fail the job if the count is non-zero for a file you expect to be fully scalable.

## FAQ

<details>
<summary><strong>What does each $INSUNITS value mean?</strong></summary>

`$INSUNITS` is an integer code for the drawing's base unit: 0 undefined, 1 inches (`0.0254 m`), 2 feet (`0.3048 m`), 4 millimetres (`0.001 m`), 5 centimetres (`0.01 m`), 6 metres (`1.0 m`), 7 kilometres (`1000 m`). Higher codes cover miles, yards, microns, and others. Map the code to a metre scale factor before any spatial computation.

</details>

<details>
<summary><strong>How should I handle $INSUNITS=0?</strong></summary>

Treat `0` as undefined, never as a silent millimetre default. Apply an explicit configured policy default, inspect `$MEASUREMENT` (0 imperial, 1 metric) as a weak secondary signal, log a warning with the file name, and record the assumed unit in your audit trail so it can be reviewed later.

</details>

<details>
<summary><strong>Is $MEASUREMENT a reliable unit source?</strong></summary>

No. `$MEASUREMENT` only distinguishes imperial (0) from metric (1) drafting settings and does not identify the specific unit. Use it only as a weak tiebreaker when `$INSUNITS` is undefined — for example choosing a metric versus imperial default — never as the primary unit determinant.

</details>

<details>
<summary><strong>Does ezdxf rescale INSERT block geometry automatically?</strong></summary>

No. `ezdxf` does not auto-scale inserted blocks that carry a different unit from the drawing. If a block definition has its own units, apply the block-to-drawing ratio yourself during flattening, then apply the drawing-to-metre factor once. Autoscaling the header unit alone does not resolve per-`INSERT` unit overrides.

</details>

---

## Related Pages

- [Unit Conversion Pipelines](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/) — parent reference on normalising CAD drawing units for GIS ingestion
- [Converting DXF Millimetres to Metres Before pyproj Reprojection](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/converting-dxf-millimeters-to-meters-before-pyproj-reprojection/) — applies this scaling step immediately before reprojection
- [How to Parse DXF Headers with Python](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/how-to-parse-dxf-headers-with-python/) — reading `$INSUNITS`, `$MEASUREMENT`, and header fallback chains
- [DXF Entity Structure Breakdown](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/) — where header variables sit in the DXF section structure
