---
title: "Converting IFC Length Units to Metres in Python"
description: "Read the IFC unit assignment and normalise model geometry to metres: SI units with prefixes, conversion-based units for imperial models, why the geometry kernel may or may not apply it, and the extent check that catches a missed conversion."
slug: "converting-ifc-length-units-to-metres-in-python"
breadcrumb:
  - label: "Coordinate Transformation & Spatial Alignment"
    url: "/coordinate-transformation-spatial-alignment/"
  - label: "Unit Conversion Pipelines"
    url: "/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/"
  - label: "Converting IFC Length Units to Metres in Python"
    url: "/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/converting-ifc-length-units-to-metres-in-python/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Converting IFC Length Units to Metres in Python",
      "description": "Read the IFC unit assignment and normalise model geometry to metres: SI units with prefixes, conversion-based units for imperial models, why the geometry kernel may or may not apply it, and the extent check that catches a missed conversion.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/converting-ifc-length-units-to-metres-in-python/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Coordinate Transformation & Spatial Alignment", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/"},
        {"@type": "ListItem", "position": 2, "name": "Unit Conversion Pipelines", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/"},
        {"@type": "ListItem", "position": 3, "name": "Converting IFC Length Units to Metres in Python", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/converting-ifc-length-units-to-metres-in-python/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Normalise IFC model geometry to metres",
      "description": "Read the project unit assignment, resolve the length unit including any prefix or conversion factor, determine whether the geometry kernel already applied it, and verify with an extent check.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Read the unit assignment", "text": "Find the project unit assignment and select the length unit from it rather than assuming metres."},
        {"@type": "HowToStep", "position": 2, "name": "Resolve prefixes and conversion factors", "text": "Handle SI units with a prefix such as milli, and conversion-based units that carry an explicit factor against an SI unit."},
        {"@type": "HowToStep", "position": 3, "name": "Determine what the kernel already applied", "text": "Establish whether the geometry settings caused the kernel to return metres, because applying the factor again is a thousandfold error."},
        {"@type": "HowToStep", "position": 4, "name": "Apply the factor once", "text": "Scale the coordinates by the resolved factor exactly once, at the normalisation boundary."},
        {"@type": "HowToStep", "position": 5, "name": "Verify with an extent check", "text": "Assert that the resulting model extents are physically plausible before any downstream stage consumes the geometry."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Does ifcopenshell apply the unit for me?",
          "acceptedAnswer": {"@type": "Answer", "text": "It depends on the geometry settings, which is exactly why this has to be checked rather than assumed. The kernel can return coordinates already in metres or in the model's authored unit. Establish which your settings produce, once, with a test against a model of known size, and then rely on it — but do not rely on it without having checked."}
        },
        {
          "@type": "Question",
          "name": "How do I handle an imperial IFC model?",
          "acceptedAnswer": {"@type": "Answer", "text": "Through the conversion-based unit. A model authored in feet declares a unit whose conversion factor relates it to the SI metre, and reading that factor gives you the same single multiplier as a metric model. There is no separate imperial code path; there is one code path that reads whatever factor the file declares."}
        },
        {
          "@type": "Question",
          "name": "What extent range should the check use?",
          "acceptedAnswer": {"@type": "Answer", "text": "Whatever is plausible for the content, stated explicitly. A building is metres to hundreds of metres; an infrastructure alignment is kilometres. The check is not trying to validate the design, only to catch the thousandfold errors — so a wide range that rejects 0.01 m and 40 000 m buildings does the job."}
        }
      ]
    }
  ]
}
</script>

# Converting IFC Length Units to Metres in Python

An IFC model declares its length unit on the project, and unlike a DXF header that declaration is binding on every length in the file. Read it, resolve any prefix or conversion factor into a single multiplier, establish once whether your geometry settings already applied it, and verify the result with an extent check. The failure this prevents is the classic thousandfold error, which produces a structurally perfect model at one-thousandth of its size. This page is part of [Unit Conversion Pipelines](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/).

## How IFC Declares a Length Unit

The project carries a unit assignment listing the units in force for each measure type. The length entry takes one of two forms.

<!-- fig:ifcu-two-forms -->
<svg viewBox="-20 -20 570 194.1" role="img" aria-label="SI units with a prefix and conversion-based units with an explicit factor both resolve to one multiplier" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:570px;display:block;margin:1.5rem auto;">
  <title>The two forms a length unit takes</title>
  <desc>Both forms resolve to a single multiplier, which is why an imperial model needs no separate code path. An SI unit names a base unit and an enumerated prefix; a conversion-based unit names a unit and gives its relationship to an SI unit as an explicit factor. One traversal reads whichever the file declares.</desc>
  <defs>
    <marker id="iu1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="iu1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="570" height="194.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="250" height="130" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="125" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">IfcSIUnit</text>
  <line x1="14" y1="33" x2="236" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="16" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— base unit plus a prefix</text>
  <text x="16" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— prefix is a name, not a number</text>
  <text x="16" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— MILLI + METRE → 0.001</text>
  <text x="16" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— the metric case</text>
  <rect x="280" y="0" width="250" height="130" rx="6" fill="currentColor" fill-opacity="0.11" stroke="currentColor" stroke-width="1.9"/>
  <text x="405" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">IfcConversionBasedUnit</text>
  <line x1="294" y1="33" x2="516" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="296" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— a named unit</text>
  <text x="296" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— explicit factor to an SI unit</text>
  <text x="296" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— FOOT → 0.3048</text>
  <text x="296" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— the imperial case</text>
  <text x="265" y="152" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">One code path — read the factor the file declares.</text>
</svg>
<!-- /fig:ifcu-two-forms -->

An **SI unit** names a base unit and optionally a prefix — metre with the prefix `MILLI` is a millimetre. The prefix is an enumerated name, not a number, so resolving it means a lookup table rather than arithmetic on a string.

A **conversion-based unit** names a unit and gives its relationship to an SI unit as an explicit factor: a foot as 0.3048 metres. This is how imperial models declare themselves, and it means an imperial model needs no special handling — it declares a factor and the factor is used.

The complication is that the geometry kernel may already have applied the factor by the time you see coordinates, depending on the geometry settings in force. Applying it again is the error this page exists to prevent, and it is not detectable from the numbers alone: coordinates scaled twice look exactly like coordinates in a different unit.

## Production-Ready Script

{% raw %}
```python
# ifcopenshell>=0.7.0, numpy>=1.24, Python 3.9+
from __future__ import annotations

from dataclasses import dataclass
import numpy as np
import ifcopenshell

SI_PREFIX = {
    "EXA": 1e18, "PETA": 1e15, "TERA": 1e12, "GIGA": 1e9, "MEGA": 1e6, "KILO": 1e3,
    "HECTO": 1e2, "DECA": 1e1, "DECI": 1e-1, "CENTI": 1e-2, "MILLI": 1e-3,
    "MICRO": 1e-6, "NANO": 1e-9,
}


class UnitError(ValueError):
    pass


@dataclass(frozen=True)
class LengthUnit:
    name: str
    metres_per_unit: float
    source: str            # "SI" | "conversion-based"


def read_length_unit(model) -> LengthUnit:
    """The declared length unit, resolved to a single multiplier."""
    assignments = model.by_type("IfcUnitAssignment")
    if not assignments:
        raise UnitError("model declares no unit assignment — geometry is unscaled")

    for unit in assignments[0].Units:
        if getattr(unit, "UnitType", None) != "LENGTHUNIT":
            continue
        if unit.is_a("IfcSIUnit"):
            factor = SI_PREFIX.get(unit.Prefix, 1.0) if unit.Prefix else 1.0
            label = f"{(unit.Prefix or '').lower()}{unit.Name.lower()}"
            return LengthUnit(label, factor, "SI")
        if unit.is_a("IfcConversionBasedUnit"):
            measure = unit.ConversionFactor            # IfcMeasureWithUnit
            value = float(measure.ValueComponent.wrappedValue)
            base = measure.UnitComponent
            base_factor = SI_PREFIX.get(getattr(base, "Prefix", None), 1.0) \
                if getattr(base, "Prefix", None) else 1.0
            return LengthUnit(unit.Name, value * base_factor, "conversion-based")
    raise UnitError("unit assignment declares no LENGTHUNIT")


def to_metres(coords: np.ndarray, unit: LengthUnit, *, already_applied: bool) -> np.ndarray:
    """Scale exactly once. already_applied describes what the KERNEL did."""
    if already_applied:
        return np.asarray(coords, dtype=float)
    return np.asarray(coords, dtype=float) * unit.metres_per_unit


def assert_plausible_extents(coords_m: np.ndarray, *, min_span=0.5, max_span=50_000.0):
    span = float(np.ptp(np.asarray(coords_m)[:, :2], axis=0).max())
    if not (min_span <= span <= max_span):
        raise UnitError(
            f"model span is {span:.4g} m — the length unit was applied twice or not at all"
        )
    return span


if __name__ == "__main__":
    model = ifcopenshell.open("model.ifc")
    unit = read_length_unit(model)
    print(f"{unit.name}: {unit.metres_per_unit} m per unit ({unit.source})")
```
{% endraw %}

<!-- fig:ifcu-who-applied-it -->
<svg viewBox="-20 -20 324.3 216.2" role="img" aria-label="Whether the geometry kernel already applied the unit cannot be detected from the coordinates and must be stated" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>Who applied the factor decides whether you should</title>
  <desc>A branch that cannot be resolved from the coordinates, because coordinates scaled twice look exactly like coordinates in a different unit. The geometry settings decide whether the kernel already applied the declared unit. Establish which your settings produce once, with a model of known size, and then state it explicitly at every call site.</desc>
  <defs>
    <marker id="iu2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="iu2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="324.3" height="216.2" fill="var(--color-surface)"/>
  <polygon points="142.2,0 267.3,31 142.2,62 17,31" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-width="1.6"/>
  <text x="142.2" y="35" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">Did the kernel already apply the unit?</text>
  <rect x="0" y="128" width="128.2" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="64.1" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Do not scale</text>
  <text x="64.1" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">already metres</text>
  <path d="M 142.2 62 L 142.2 92 L 64.1 92 L 64.1 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#iu2-a)" stroke-linejoin="round"/>
  <text x="64.1" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">yes</text>
  <rect x="156.2" y="128" width="128.2" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="220.3" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Scale once</text>
  <text x="220.3" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">by the declared factor</text>
  <path d="M 142.2 62 L 142.2 92 L 220.3 92 L 220.3 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#iu2-a)" stroke-linejoin="round"/>
  <text x="220.3" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">no</text>
</svg>
<!-- /fig:ifcu-who-applied-it -->

**Key implementation notes:**

- `already_applied` is an explicit argument rather than something the function tries to detect. Detection is not possible from the coordinates, so the caller has to state what its geometry settings do — and stating it is what makes the assumption reviewable.
- Conversion-based units multiply the declared factor by any prefix on the base unit. A factor given against millimetres rather than metres is unusual and legal.
- The extent assertion is a separate function so it can be called at the boundary regardless of how the coordinates were produced. It catches both directions of the error with one range.
- `np.ptp` on the horizontal ordinates gives the span without materialising a bounding box object.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `ifcopenshell` | `>=0.7.0` | `by_type`, `is_a` |
| IFC schema | IFC2X3, IFC4, IFC4X3 | unit assignment unchanged across these |
| SI prefixes | full enumeration | table above covers the length-relevant range |
| Conversion units | any declared factor | imperial models need no special path |
| `numpy` | `>=1.24` | scaling and span |

## Fallback Strategies

**1. No unit assignment.** Raises. A model without one has unscaled geometry and no way to interpret it; obtain a corrected export rather than assuming metres.

<!-- fig:ifcu-extent-gate -->
<svg viewBox="-20 -20 486.3 154.1" role="img" aria-label="A model span of 0.03 m or 30 000 m rejects a double or missing unit application; 30 m is a building" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:486px;display:block;margin:1.5rem auto;">
  <title>What the extent assertion actually rejects</title>
  <desc>The horizontal span of one building under three interpretations. Applied twice, the model is a hundredth of a metre across; not applied at all, it is hundreds of kilometres; applied once, it is a building. A single plausibility range rejects both failure directions without needing to know anything about the design.</desc>
  <defs>
    <marker id="iu3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="iu3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="486.3" height="154.1" fill="var(--color-surface)"/>
  <text x="96.4" y="11.5" text-anchor="end" font-size="10.5" fill="currentColor" fill-opacity="0.9">factor applied twice</text>
  <rect x="106.4" y="0" width="2" height="16" rx="3" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <text x="116.4" y="11.5" font-size="10" fill="currentColor" fill-opacity="0.85">0.03 m</text>
  <text x="96.4" y="41.5" text-anchor="end" font-size="10.5" fill="currentColor" fill-opacity="0.9">factor applied once</text>
  <rect x="106.4" y="30" width="2" height="16" rx="3" fill="currentColor" fill-opacity="0.42" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.9"/>
  <text x="116.4" y="41.5" font-size="10" font-weight="600" fill="currentColor" fill-opacity="0.85">30 m</text>
  <text x="96.4" y="71.5" text-anchor="end" font-size="10.5" fill="currentColor" fill-opacity="0.9">factor not applied</text>
  <rect x="106.4" y="60" width="290" height="16" rx="3" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <text x="404.4" y="71.5" font-size="10" fill="currentColor" fill-opacity="0.85">30,000 m</text>
  <line x1="106.4" y1="78" x2="396.4" y2="78" stroke="currentColor" stroke-width="1" stroke-opacity="0.35"/>
  <text x="106.4" y="93" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.6">0</text>
  <text x="396.4" y="93" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.6">30,000</text>
  <text x="0" y="112" font-size="9.5" fill="currentColor" fill-opacity="0.7">One range catches both directions — no knowledge of the design required.</text>
</svg>
<!-- /fig:ifcu-extent-gate -->

**2. Coordinates a thousand times too small.** The factor was applied twice — once by the kernel and once by you. Correct `already_applied` rather than dividing by a thousand somewhere downstream.

**3. Several unit assignments.** A federated file can carry more than one. Selecting the first is a guess; fail on ambiguity and resolve which project context applies.

**4. Angle and area units differ from the length unit.** They are declared separately and a pipeline that reads areas or angles needs to resolve those too. The same traversal serves, filtered on a different unit type.

**5. Extents plausible but the model is wrong.** The check is a floor, not a proof. It catches thousandfold errors, not a model authored in centimetres and declared in millimetres — that needs a known dimension, which is what the survey verification on the parent section provides.

## FAQ

<details>
<summary><strong>Does ifcopenshell apply the unit for me?</strong></summary>

It depends on the geometry settings, which is exactly why this has to be checked rather than assumed. The kernel can return coordinates already in metres or in the model's authored unit. Establish which your settings produce, once, with a test against a model of known size, and then rely on it — but do not rely on it without having checked.

</details>

<details>
<summary><strong>How do I handle an imperial IFC model?</strong></summary>

Through the conversion-based unit. A model authored in feet declares a unit whose conversion factor relates it to the SI metre, and reading that factor gives you the same single multiplier as a metric model. There is no separate imperial code path; there is one code path that reads whatever factor the file declares.

</details>

<details>
<summary><strong>What extent range should the check use?</strong></summary>

Whatever is plausible for the content, stated explicitly. A building is metres to hundreds of metres; an infrastructure alignment is kilometres. The check is not trying to validate the design, only to catch the thousandfold errors — so a wide range that rejects 0.01 m and 40 000 m buildings does the job.

</details>

---

## Related Pages

- [Unit Conversion Pipelines](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/) — parent reference on where each format records its unit
- [ifcopenshell Workflow](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/) — the geometry settings that decide what the kernel returns
- [Detecting Drawing Units When $INSUNITS Is Missing](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/detecting-drawing-units-when-insunits-is-missing/) — the DXF equivalent, where no declaration exists at all
