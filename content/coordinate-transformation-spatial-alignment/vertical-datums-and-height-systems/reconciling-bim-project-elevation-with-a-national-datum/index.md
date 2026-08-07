---
title: "Reconciling BIM Project Elevation with a National Datum"
description: "Resolve the constant offset between a BIM project elevation and a national height datum: read IfcMapConversion, apply it as a step, and prove it on a level."
slug: "reconciling-bim-project-elevation-with-a-national-datum"
breadcrumb:
  - label: "Coordinate Transformation & Spatial Alignment"
    url: "/coordinate-transformation-spatial-alignment/"
  - label: "Vertical Datums and Height Systems"
    url: "/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/"
  - label: "Reconciling BIM Project Elevation with a National Datum"
    url: "/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/reconciling-bim-project-elevation-with-a-national-datum/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Reconciling BIM Project Elevation with a National Datum",
      "description": "Resolve the constant offset between a BIM project elevation and a national height datum: read IfcMapConversion, apply it as a step, and prove it on a level.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/reconciling-bim-project-elevation-with-a-national-datum/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Coordinate Transformation & Spatial Alignment", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/"},
        {"@type": "ListItem", "position": 2, "name": "Vertical Datums and Height Systems", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/"},
        {"@type": "ListItem", "position": 3, "name": "Reconciling BIM Project Elevation with a National Datum", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/reconciling-bim-project-elevation-with-a-national-datum/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Reconcile a BIM project elevation with a national height datum",
      "description": "Read the model orthogonal height offset, treat it as an additive constant, apply it as a named pipeline step, and verify against an independently levelled point.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Read the declared offset", "text": "Read OrthogonalHeight from IfcMapConversion, which records the height of the model origin above the projected coordinate reference system."},
        {"@type": "HowToStep", "position": 2, "name": "Establish the offset when it is absent", "text": "Where the model carries no map conversion, obtain the project datum offset from the project setup documentation rather than inferring it from an element."},
        {"@type": "HowToStep", "position": 3, "name": "Apply the offset as a named step", "text": "Add the constant to every model Z as an explicit stage, so the pipeline records that project heights became national-datum heights."},
        {"@type": "HowToStep", "position": 4, "name": "Verify against a levelled point", "text": "Compare the resulting height of a known point, such as a finished floor level, against its surveyed value."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Is OrthogonalHeight the height of the building?",
          "acceptedAnswer": {"@type": "Answer", "text": "No. It is the height of the model origin above the projected coordinate reference system, so it is added to each element Z rather than replacing it. Treating it as an absolute height places the whole model at that single elevation, which is a mistake that produces a geometrically intact model at completely the wrong level."}
        },
        {
          "@type": "Question",
          "name": "What if the model has no IfcMapConversion?",
          "acceptedAnswer": {"@type": "Answer", "text": "Then the model is not georeferenced and the offset does not exist in the file. It exists in the project setup — a survey point, a specified base level, a note on a drawing — and must be obtained from there. Do not infer it from a single element level; a floor slab whose top is at project 0.000 may be at any national height at all."}
        },
        {
          "@type": "Question",
          "name": "Is the relationship always a constant?",
          "acceptedAnswer": {"@type": "Answer", "text": "Vertically, yes. A project elevation and a national datum differ by a constant because both are measured along the same vertical direction; only the origin differs. That is why the vertical part of the reconciliation is a single addition, whereas the horizontal part is a full similarity transform."}
        }
      ]
    }
  ]
}
</script>

# Reconciling BIM Project Elevation with a National Datum

A BIM model's Z values are measured from a project origin chosen for drafting convenience, and reconciling them with a national datum is a single additive constant — read it from `IfcMapConversion.OrthogonalHeight` where the model is georeferenced, and obtain it from the project setup where it is not. The arithmetic is trivial; getting the number from the right place is not. This page belongs to [Vertical Datums and Height Systems](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/).

## How IFC Records the Offset

A georeferenced IFC model relates its own engineering coordinate system to a projected coordinate reference system through a map conversion. That record carries eastings and northings for the horizontal placement, a rotation expressed as a direction vector, a scale, and `OrthogonalHeight` for the vertical placement.

<!-- fig:bimz-offset -->
<svg viewBox="-20 -20 540 198" role="img" aria-label="Element elevation plus the recorded orthogonal height gives the national datum height" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:540px;display:block;margin:1.5rem auto;">
  <title>Model zero against the national datum</title>
  <desc>Three levels stacked. The national vertical datum is the reference; the model origin sits a recorded distance above it; element elevations are measured from the model origin. A national-datum height is therefore the element elevation plus the recorded offset — the offset is additive, not a height in its own right.</desc>
  <defs>
    <marker id="bz1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="bz1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="540" height="198" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="500" height="46" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="16" y="21" font-size="11.5" font-weight="600" fill="currentColor">Element elevation</text>
  <text x="16" y="35" font-size="9.5" fill="currentColor" fill-opacity="0.72">measured from the model origin</text>
  <text x="484" y="26.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">model Z</text>
  <rect x="0" y="56" width="500" height="46" rx="6" fill="currentColor" fill-opacity="0.14" stroke="currentColor" stroke-width="2"/>
  <text x="16" y="77" font-size="11.5" font-weight="600" fill="currentColor">Model origin</text>
  <text x="16" y="91" font-size="9.5" fill="currentColor" fill-opacity="0.72">sits above the datum by a recorded constant</text>
  <text x="484" y="82.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">OrthogonalHeight</text>
  <rect x="0" y="112" width="500" height="46" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="16" y="133" font-size="11.5" font-weight="600" fill="currentColor">National vertical datum</text>
  <text x="16" y="147" font-size="9.5" fill="currentColor" fill-opacity="0.72">the reference surface</text>
  <text x="484" y="138.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">H = 0</text>
</svg>
<!-- /fig:bimz-offset -->

`OrthogonalHeight` is an *offset*, not a height. It says where the model's zero level sits in the target vertical datum, so a national-datum height is `model_z + OrthogonalHeight`. Reading it as the height of anything in particular collapses the model onto one level.

Where the record is absent — an IFC2X3 export, or an IFC4 model that was never georeferenced — the offset is not in the file. It is in the project setup: a survey point with a specified elevation, a stated relationship between a floor level and a datum, a note from the surveyor. That is a document lookup, not a computation, and inventing a value from a single element's level is how a model ends up a storey out.

## Production-Ready Script

{% raw %}
```python
# ifcopenshell>=0.7.0, numpy>=1.24, Python 3.9+
from __future__ import annotations

from dataclasses import dataclass
import numpy as np
import ifcopenshell


@dataclass(frozen=True)
class VerticalReference:
    """How this model's Z relates to a national vertical datum."""
    offset_m: float
    source: str            # "IfcMapConversion" | "project setup"
    vertical_datum: str    # e.g. "ODN" — never inferred

    def to_national(self, model_z: np.ndarray) -> np.ndarray:
        return np.asarray(model_z, dtype=float) + self.offset_m


def read_vertical_reference(
    ifc_path: str, *, documented_offset_m: float | None = None,
    documented_datum: str | None = None,
) -> VerticalReference:
    """Prefer the model's own record; fall back only to a DOCUMENTED value."""
    model = ifcopenshell.open(ifc_path)
    conversions = model.by_type("IfcMapConversion")

    if conversions:
        mc = conversions[0]
        height = mc.OrthogonalHeight
        if height is None:
            raise ValueError(
                f"{ifc_path}: IfcMapConversion present but OrthogonalHeight is unset"
            )
        crs = mc.TargetCRS
        datum = getattr(crs, "VerticalDatum", None) or "declared in TargetCRS"
        return VerticalReference(float(height), "IfcMapConversion", str(datum))

    if documented_offset_m is None or documented_datum is None:
        raise ValueError(
            f"{ifc_path}: no IfcMapConversion and no documented offset supplied — "
            "obtain the project datum relationship from the project setup"
        )
    return VerticalReference(documented_offset_m, "project setup", documented_datum)


def verify_against_level(
    ref: VerticalReference, model_z: float, surveyed_H: float, tol_m: float = 0.02
) -> float:
    """Check one known point before trusting the offset for the whole model."""
    computed = float(ref.to_national(np.array([model_z]))[0])
    residual = abs(computed - surveyed_H)
    if residual > tol_m:
        raise AssertionError(
            f"vertical residual {residual:.3f} m exceeds {tol_m} m — "
            f"offset {ref.offset_m:.3f} m from {ref.source} is not consistent "
            "with the surveyed level"
        )
    return residual


if __name__ == "__main__":
    ref = read_vertical_reference("model.ifc")
    print(f"offset {ref.offset_m:.3f} m from {ref.source} ({ref.vertical_datum})")
    print("residual:", verify_against_level(ref, model_z=0.000, surveyed_H=42.310))
```
{% endraw %}

<!-- fig:bimz-source -->
<svg viewBox="-20 -20 489.1 216.2" role="img" aria-label="A map conversion with an orthogonal height is authoritative; otherwise the offset comes from the project setup, never from an element" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:489px;display:block;margin:1.5rem auto;">
  <title>Where the offset comes from</title>
  <desc>A three-way branch on what the model actually declares. A map conversion with an orthogonal height is authoritative. A map conversion without one carries horizontal georeferencing only and the vertical relationship must come from the project setup. A model with neither has no offset in the file at all, and inventing one from a single element level is how a model ends up a storey out.</desc>
  <defs>
    <marker id="bz2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="bz2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="489.1" height="216.2" fill="var(--color-surface)"/>
  <polygon points="224.5,0 331.4,31 224.5,62 117.7,31" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-width="1.6"/>
  <text x="224.5" y="35" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">What does the model declare?</text>
  <rect x="0" y="128" width="131" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="65.5" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Authoritative</text>
  <text x="65.5" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">read it</text>
  <path d="M 224.5 62 L 224.5 92 L 65.5 92 L 65.5 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#bz2-a)" stroke-linejoin="round"/>
  <text x="65.5" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">height set</text>
  <rect x="159" y="128" width="131" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="224.5" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Project setup</text>
  <text x="224.5" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">documented value</text>
  <path d="M 224.5 62 L 224.5 92 L 224.5 92 L 224.5 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#bz2-a)" stroke-linejoin="round"/>
  <text x="224.5" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">height unset</text>
  <rect x="318.1" y="128" width="131" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="383.6" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Project setup</text>
  <text x="383.6" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">never from an element</text>
  <path d="M 224.5 62 L 224.5 92 L 383.6 92 L 383.6 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#bz2-a)" stroke-linejoin="round"/>
  <text x="383.6" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">no conversion</text>
</svg>
<!-- /fig:bimz-source -->

**Key implementation notes:**

- The function refuses to invent an offset. A model with no map conversion and no documented value raises, which is correct: there is no number to compute, only one to look up.
- `vertical_datum` is carried alongside the offset. An offset without a datum name is only half a statement, and the half that is missing is the one that makes it checkable.
- `to_national` operates on arrays, so the same reference applies to a single level or to every vertex in a mesh.
- Verification is against one independently known point. That single check catches a sign error, a units error and a wrong lookup at once.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `ifcopenshell` | `>=0.7.0` | `by_type("IfcMapConversion")` stable across this range |
| IFC schema | IFC4, IFC4X3 | IFC2X3 has no map conversion — use the documented route |
| `numpy` | `>=1.24` | array application of the offset |
| Model units | any declared length unit | resolve units first; the offset is in the target CRS unit |
| Vertical datum | any named datum | recorded, never inferred |

## Fallback Strategies

**1. `IfcMapConversion` present but `OrthogonalHeight` unset.** The exporter wrote horizontal georeferencing only. Treat this as the no-record case and use the documented offset; do not default it to zero, which asserts that the project origin sits exactly on the national datum.

<!-- fig:bimz-level-ambiguity -->
<svg viewBox="-20 -20 374.7 184.1" role="img" aria-label="Structural slab, screed and finish levels differ by tens of millimetres and are all called the floor level" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>Why a stubborn 50 to 150 mm residual is usually not the datum</title>
  <desc>Three plausible meanings of a floor level in a model and in a survey, with the typical difference between them. A residual in this range that will not resolve with datum adjustments is very often the two datasets describing different physical surfaces of the same floor rather than a vertical reference problem.</desc>
  <defs>
    <marker id="bz3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="bz3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="374.7" height="184.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="334.7" height="122" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="334.7" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">What is called &quot;floor level&quot;</text>
  <text x="187.3" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Surface</text>
  <line x1="219.4" y1="0" x2="219.4" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="277" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Typical difference</text>
  <line x1="155.1" y1="0" x2="155.1" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="334.7" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">Structural slab top</text>
  <text x="187.3" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">concrete</text>
  <text x="277" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">reference</text>
  <line x1="0" y1="62" x2="334.7" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">Screed top</text>
  <text x="187.3" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">screed</text>
  <text x="277" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">50 – 80 mm above</text>
  <line x1="0" y1="92" x2="334.7" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">Finished floor</text>
  <text x="187.3" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">finish</text>
  <text x="277" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">65 – 150 mm above</text>
  <text x="0" y="142" font-size="9.5" fill="currentColor" fill-opacity="0.7">Confirm which surface each dataset measured before adjusting a datum.</text>
</svg>
<!-- /fig:bimz-level-ambiguity -->

**2. Model units are not metres.** The offset is expressed in the target coordinate reference system's unit, and model Z in the model's unit. Resolve the model unit assignment and convert before adding, or the offset is added to numbers a thousand times too large.

**3. Several map conversions in one file.** Federated exports can carry more than one. Selecting the first is a guess. Fail on ambiguity and resolve which context applies, because the contexts may genuinely differ.

**4. The verification point is not what you think.** A "finished floor level" in a model may be the structural slab top, the screed top or the finish, and a surveyed level may be any of the three. A 50–150 mm residual that will not resolve is usually this rather than a datum problem.

**5. The model was moved after the offset was recorded.** If elements have been shifted vertically since georeferencing was set up, the recorded offset no longer describes the geometry. The verification step catches it; without that step, nothing does.

## FAQ

<details>
<summary><strong>Is OrthogonalHeight the height of the building?</strong></summary>

No. It is the height of the model origin above the projected coordinate reference system, so it is added to each element Z rather than replacing it. Treating it as an absolute height places the whole model at that single elevation, which is a mistake that produces a geometrically intact model at completely the wrong level.

</details>

<details>
<summary><strong>What if the model has no IfcMapConversion?</strong></summary>

Then the model is not georeferenced and the offset does not exist in the file. It exists in the project setup — a survey point, a specified base level, a note on a drawing — and must be obtained from there. Do not infer it from a single element level; a floor slab whose top is at project 0.000 may be at any national height at all.

</details>

<details>
<summary><strong>Is the relationship always a constant?</strong></summary>

Vertically, yes. A project elevation and a national datum differ by a constant because both are measured along the same vertical direction; only the origin differs. That is why the vertical part of the reconciliation is a single addition, whereas the horizontal part is a full similarity transform.

</details>

---

## Related Pages

- [Vertical Datums and Height Systems](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/) — parent reference covering the three height surfaces this offset connects
- [Reading IFC Georeferencing with ifcopenshell](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/reading-ifc-georeferencing-with-ifcopenshell/) — the full map conversion record this guide reads one field from
- [Aligning BIM Models with GIS Survey Data](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/aligning-bim-models-with-gis-survey-data/) — the horizontal half of the same reconciliation
