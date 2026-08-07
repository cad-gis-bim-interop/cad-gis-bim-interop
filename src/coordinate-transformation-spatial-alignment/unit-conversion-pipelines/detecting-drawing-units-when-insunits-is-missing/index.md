---
title: "Detecting Drawing Units When $INSUNITS Is Missing"
description: "Resolve the unit of a DXF that declares none: the evidence a drawing offers, an extent-magnitude heuristic, and recording the answer as a logged assumption."
slug: "detecting-drawing-units-when-insunits-is-missing"
breadcrumb:
  - label: "Coordinate Transformation & Spatial Alignment"
    url: "/coordinate-transformation-spatial-alignment/"
  - label: "Unit Conversion Pipelines"
    url: "/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/"
  - label: "Detecting Drawing Units When $INSUNITS Is Missing"
    url: "/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/detecting-drawing-units-when-insunits-is-missing/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Detecting Drawing Units When $INSUNITS Is Missing",
      "description": "Resolve the unit of a DXF that declares none: the evidence a drawing offers, an extent-magnitude heuristic, and recording the answer as a logged assumption.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/detecting-drawing-units-when-insunits-is-missing/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Coordinate Transformation & Spatial Alignment", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/"},
        {"@type": "ListItem", "position": 2, "name": "Unit Conversion Pipelines", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/"},
        {"@type": "ListItem", "position": 3, "name": "Detecting Drawing Units When $INSUNITS Is Missing", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/detecting-drawing-units-when-insunits-is-missing/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Resolve the unit of a DXF that declares none",
      "description": "Gather the evidence the drawing offers, score candidate units by extent plausibility, apply the configured default when the evidence is weak, and record the assumption.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Confirm the header really is undefined", "text": "Read the units header variable and treat zero as undefined rather than as a unit."},
        {"@type": "HowToStep", "position": 2, "name": "Gather secondary evidence", "text": "Read the drafting-mode flag, dimension style units and text heights, all of which are weak signals rather than answers."},
        {"@type": "HowToStep", "position": 3, "name": "Score candidates by extent plausibility", "text": "Convert the drawing extents under each candidate unit and score how plausible the resulting real-world size is."},
        {"@type": "HowToStep", "position": 4, "name": "Apply the configured default when scores tie", "text": "Fall back to an explicit configured default rather than to the highest score when no candidate is clearly better."},
        {"@type": "HowToStep", "position": 5, "name": "Record the assumption", "text": "Write the chosen unit, the evidence and the confidence into the pipeline output so the decision is auditable."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Can $MEASUREMENT tell me the unit?",
          "acceptedAnswer": {"@type": "Answer", "text": "No. It distinguishes imperial from metric drafting settings and nothing more — it does not name millimetres, metres or feet. It is useful only as a tiebreaker between candidates from different families, and treating it as the answer is how an inch drawing gets read as feet."}
        },
        {
          "@type": "Question",
          "name": "How reliable is the extents heuristic?",
          "acceptedAnswer": {"@type": "Answer", "text": "Reliable enough to reject the absurd, not reliable enough to decide alone. It rules out candidates that make a building 40 kilometres across, which is most of them, and it cannot distinguish a large site in metres from a small one in kilometres. Treat it as a filter that narrows the choice, with a configured default deciding what remains."}
        },
        {
          "@type": "Question",
          "name": "Should the pipeline just pick the best guess and continue?",
          "acceptedAnswer": {"@type": "Answer", "text": "It should apply an explicit policy and record what it applied. The failure mode to avoid is not being wrong — sometimes there is no way to be right — it is being wrong invisibly. A logged, reviewable assumption can be corrected later; a silent default cannot even be found."}
        }
      ]
    }
  ]
}
</script>

# Detecting Drawing Units When $INSUNITS Is Missing

A DXF with an undefined units header offers only circumstantial evidence about its unit, so the honest procedure is: gather what evidence exists, use drawing extents to reject implausible candidates, fall back to a configured default when the remaining candidates are not separable, and record the assumption in the output. The goal is an auditable decision, not a confident one. This page is part of [Unit Conversion Pipelines](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/).

## What Evidence a Drawing Actually Offers

**The drafting-mode flag** separates imperial from metric conventions. It narrows seven candidates to three or four and names none of them.

<!-- fig:du-evidence -->
<svg viewBox="-20 -20 418.5 184.1" role="img" aria-label="Drafting mode, extents and text height each narrow the candidate units without naming one" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>Three signals, none of them conclusive</title>
  <desc>The circumstantial evidence an unlabelled drawing offers, what each one narrows, and its weakness. Together they usually reduce seven candidates to two; none of them names a unit on its own, which is why the outcome has to be recorded as an assumption rather than as a fact.</desc>
  <defs>
    <marker id="du1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="du1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="418.5" height="184.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="378.5" height="122" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="378.5" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">Signal</text>
  <text x="184.6" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Narrows to</text>
  <line x1="252.4" y1="0" x2="252.4" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="315.4" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Weakness</text>
  <line x1="116.8" y1="0" x2="116.8" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="378.5" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">Drafting mode flag</text>
  <text x="184.6" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">metric or imperial family</text>
  <text x="315.4" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">names no unit</text>
  <line x1="0" y1="62" x2="378.5" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">Drawing extents</text>
  <text x="184.6" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">plausible real sizes</text>
  <text x="315.4" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">a stray entity skews it</text>
  <line x1="0" y1="92" x2="378.5" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">Text height</text>
  <text x="184.6" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">often decisive</text>
  <text x="315.4" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">no rule, only a pattern</text>
  <text x="0" y="142" font-size="9.5" fill="currentColor" fill-opacity="0.7">Two candidates usually survive — the configured default decides between them.</text>
</svg>
<!-- /fig:du-evidence -->

**Drawing extents** are the strongest signal, because a real-world object has a plausible size. A site plan whose extents are 240 000 units is a plausible millimetre drawing, an implausible metre one and an absurd kilometre one. This rejects most candidates outright.

**Text and dimension heights** are the subtlest and often the most decisive. Annotation is drawn at a legible size on a printed sheet, so a text height of 2.5 in a drawing is characteristic of millimetres and a text height of 0.0025 is not.

None of these is conclusive. Together they usually narrow the field to two candidates, and the pipeline's policy decides between them.

## Production-Ready Script

{% raw %}
```python
# ezdxf>=1.1.0, Python 3.9+
from __future__ import annotations

from dataclasses import dataclass, asdict
import math

import ezdxf

# Candidate units, their metre factors and the plausible real-world extent range
# for a drawing of a building or a site, in metres.
CANDIDATES = {
    1: ("inches", 0.0254), 2: ("feet", 0.3048), 4: ("millimetres", 0.001),
    5: ("centimetres", 0.01), 6: ("metres", 1.0), 7: ("kilometres", 1000.0),
}
PLAUSIBLE_M = (2.0, 20_000.0)          # 2 m to 20 km spans site and building work
METRIC = {4, 5, 6, 7}


@dataclass(frozen=True)
class UnitDecision:
    code: int
    name: str
    metres_per_unit: float
    confidence: str                    # "declared" | "inferred" | "default"
    evidence: dict


def decide_units(dxf_path: str, *, default_code: int = 4) -> UnitDecision:
    doc = ezdxf.readfile(dxf_path)
    declared = doc.header.get("$INSUNITS", 0)
    if declared in CANDIDATES:
        name, factor = CANDIDATES[declared]
        return UnitDecision(declared, name, factor, "declared", {"header": declared})

    measurement = doc.header.get("$MEASUREMENT", None)   # 0 imperial, 1 metric
    extmin = doc.header.get("$EXTMIN", (0, 0, 0))
    extmax = doc.header.get("$EXTMAX", (0, 0, 0))
    span = max(abs(extmax[0] - extmin[0]), abs(extmax[1] - extmin[1]))

    text_heights = sorted({round(float(e.dxf.height), 4)
                           for e in doc.modelspace().query("TEXT MTEXT")
                           if getattr(e.dxf, "height", 0)})

    scored: list[tuple[float, int]] = []
    for code, (name, factor) in CANDIDATES.items():
        if measurement is not None:
            if measurement == 1 and code not in METRIC:
                continue
            if measurement == 0 and code in METRIC:
                continue
        real = span * factor
        if not (PLAUSIBLE_M[0] <= real <= PLAUSIBLE_M[1]):
            continue
        # Prefer the candidate whose extent sits nearest the middle of the plausible
        # range on a log scale — it discriminates without pretending to be exact.
        centre = math.sqrt(PLAUSIBLE_M[0] * PLAUSIBLE_M[1])
        scored.append((abs(math.log(real / centre)), code))

    evidence = {
        "header": declared, "measurement": measurement, "extent_span": span,
        "text_heights": text_heights[:5], "candidates": [c for _, c in sorted(scored)],
    }

    if len(scored) == 1:
        code = scored[0][1]
        name, factor = CANDIDATES[code]
        return UnitDecision(code, name, factor, "inferred", evidence)

    name, factor = CANDIDATES[default_code]
    return UnitDecision(default_code, name, factor, "default", evidence)


if __name__ == "__main__":
    decision = decide_units("unlabelled.dxf")
    print(asdict(decision))
    if decision.confidence != "declared":
        print("ASSUMPTION APPLIED — record this with the output")
```
{% endraw %}

<!-- fig:du-plausibility -->
<svg viewBox="-20 -20 427.5 214.1" role="img" aria-label="A 240 000 unit extent span is plausible only in millimetres; centimetres, feet and metres give absurd site sizes" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:428px;display:block;margin:1.5rem auto;">
  <title>The same extent span under four candidate units</title>
  <desc>One drawing whose extents span 240 000 units, converted under four candidate units. Three of the four produce a real-world size that is absurd for a site plan and are rejected outright; the surviving candidate is what the heuristic reports. The rejection is the useful part — the heuristic narrows, and a stated policy decides what remains.</desc>
  <defs>
    <marker id="du2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="du2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="427.5" height="214.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="324.5" height="152" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="324.5" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">Interpreted as</text>
  <text x="147.5" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Real-world span</text>
  <line x1="200.2" y1="0" x2="200.2" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="262.4" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Plausible for a site?</text>
  <line x1="94.8" y1="0" x2="94.8" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="324.5" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">millimetres</text>
  <text x="147.5" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">240 m</text>
  <text x="262.4" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">yes</text>
  <line x1="0" y1="62" x2="324.5" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">centimetres</text>
  <text x="147.5" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">2.4 km</text>
  <text x="262.4" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">no</text>
  <line x1="0" y1="92" x2="324.5" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">feet</text>
  <text x="147.5" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">73 km</text>
  <text x="262.4" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">no</text>
  <line x1="0" y1="122" x2="324.5" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="140.5" font-size="10.5" font-weight="600" fill="currentColor">metres</text>
  <text x="147.5" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">240 km</text>
  <text x="262.4" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">no</text>
  <text x="0" y="172" font-size="9.5" fill="currentColor" fill-opacity="0.7">Three candidates are rejected by magnitude alone, before any other evidence is weighed.</text>
</svg>
<!-- /fig:du-plausibility -->

**Key implementation notes:**

- A single surviving candidate is reported as `inferred`; several surviving candidates fall through to the configured default. The heuristic narrows, the policy decides.
- The plausibility range is a stated constant rather than an implicit belief, so it can be adjusted for a domain where 20 km is not the ceiling.
- Text heights are collected and reported but not scored. They are the most useful evidence for a human reviewing an ambiguous case, and the least amenable to a rule.
- The confidence field is the point of the whole function. Downstream code and audit logs can distinguish a declared unit from an assumed one, which a bare scale factor cannot express.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `ezdxf` | `>=1.1.0` | header access, entity query |
| DXF revision | R12 – R2018 | the units header exists from R12 |
| `$MEASUREMENT` | present or absent | used only as a family filter |
| Extents | `$EXTMIN`/`$EXTMAX` | fall back to computing from geometry if absent |
| Policy default | configurable | never implicit |

## Fallback Strategies

**1. Extents are zero or absent.** Some exporters omit them. Compute the bounding box from modelspace geometry instead; it costs a pass over the entities and gives the same signal.

<!-- fig:du-confidence -->
<svg viewBox="-20 -33.5 431.2 125.8" role="img" aria-label="Declared, inferred or default — the three confidence levels a resolved drawing unit carries" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:431px;display:block;margin:1.5rem auto;">
  <title>Three confidence levels, carried downstream</title>
  <desc>The three outcomes the resolver can produce and what each licenses. A declared header value is a fact. A single surviving candidate is an inference. Anything else is the configured policy default. Carrying the level with the factor lets downstream code and an audit distinguish them, which a bare number cannot express.</desc>
  <defs>
    <marker id="du3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="du3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-33.5" width="431.2" height="125.8" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="112.2" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="56.1" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">declared</text>
  <text x="56.1" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">the header said so</text>
  <rect x="146.2" y="0" width="84.8" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="188.6" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">inferred</text>
  <text x="188.6" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">one survivor</text>
  <rect x="265" y="0" width="126.3" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="328.1" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">default</text>
  <text x="328.1" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">policy applied, logged</text>
  <line x1="112.2" y1="24.1" x2="146.2" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#du3-a)"/>
  <text x="129.2" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">no candidate</text>
  <line x1="231" y1="24.1" x2="265" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#du3-a)"/>
  <text x="248" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">several survive</text>
  <text x="0" y="70.2" font-size="9.5" fill="currentColor" fill-opacity="0.7">Being wrong is sometimes unavoidable; being wrong invisibly is not.</text>
</svg>
<!-- /fig:du-confidence -->

**2. Every candidate is implausible.** Usually the drawing contains a stray entity at a huge coordinate, dragging the extents. Compute a robust span from a coordinate percentile rather than from the absolute extremes.

**3. Two candidates survive.** Expected — the configured default takes it, and the evidence record shows what was rejected. Reviewing a sample of these is how the default gets tuned for a client.

**4. The drawing is a detail rather than a plan.** A 300 mm bracket detail has extents outside the site range and will score badly. Set the plausible range from the expected content of the pipeline's input, or route details through a separate policy.

**5. The assumption turns out wrong.** Because it was recorded, the affected outputs are identifiable and re-runnable. That is the entire benefit of preferring an auditable answer to a confident one.

## FAQ

<details>
<summary><strong>Can $MEASUREMENT tell me the unit?</strong></summary>

No. It distinguishes imperial from metric drafting settings and nothing more — it does not name millimetres, metres or feet. It is useful only as a tiebreaker between candidates from different families, and treating it as the answer is how an inch drawing gets read as feet.

</details>

<details>
<summary><strong>How reliable is the extents heuristic?</strong></summary>

Reliable enough to reject the absurd, not reliable enough to decide alone. It rules out candidates that make a building 40 kilometres across, which is most of them, and it cannot distinguish a large site in metres from a small one in kilometres. Treat it as a filter that narrows the choice, with a configured default deciding what remains.

</details>

<details>
<summary><strong>Should the pipeline just pick the best guess and continue?</strong></summary>

It should apply an explicit policy and record what it applied. The failure mode to avoid is not being wrong — sometimes there is no way to be right — it is being wrong invisibly. A logged, reviewable assumption can be corrected later; a silent default cannot even be found.

</details>

---

## Related Pages

- [Unit Conversion Pipelines](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/) — parent reference on where each format records its unit
- [Autoscaling DXF Geometry from $INSUNITS in Python](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/autoscaling-dxf-geometry-from-insunits-in-python/) — the lookup this heuristic substitutes for when the header is absent
- [Convert DXF Millimetres to Metres Before pyproj Reprojection](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/converting-dxf-millimeters-to-meters-before-pyproj-reprojection/) — what the resolved unit is used for next
