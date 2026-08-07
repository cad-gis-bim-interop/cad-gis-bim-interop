---
title: "Exporting Revit Models to IFC for Python Pipelines"
description: "Configure a Revit IFC export a pipeline can rely on: schema and model view, property set mapping, shared coordinates, and checks that catch a bad export."
slug: "exporting-revit-models-to-ifc-for-python-pipelines"
breadcrumb:
  - label: "Python Parsing & Geometry Extraction"
    url: "/python-parsing-geometry-extraction/"
  - label: "Revit and Navisworks Export Paths"
    url: "/python-parsing-geometry-extraction/revit-and-navisworks-export-paths/"
  - label: "Exporting Revit Models to IFC for Python Pipelines"
    url: "/python-parsing-geometry-extraction/revit-and-navisworks-export-paths/exporting-revit-models-to-ifc-for-python-pipelines/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Exporting Revit Models to IFC for Python Pipelines",
      "description": "Configure a Revit IFC export a pipeline can rely on: schema and model view, property set mapping, shared coordinates, and checks that catch a bad export.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/revit-and-navisworks-export-paths/exporting-revit-models-to-ifc-for-python-pipelines/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Python Parsing & Geometry Extraction", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/"},
        {"@type": "ListItem", "position": 2, "name": "Revit and Navisworks Export Paths", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/revit-and-navisworks-export-paths/"},
        {"@type": "ListItem", "position": 3, "name": "Exporting Revit Models to IFC for Python Pipelines", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/revit-and-navisworks-export-paths/exporting-revit-models-to-ifc-for-python-pipelines/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Produce a Revit IFC export a Python pipeline can rely on",
      "description": "Pin the schema and model view, map the property sets the pipeline reads, enable shared coordinates, version the configuration, and accept the export only after automated checks.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Pin the schema and model view", "text": "Fix the IFC schema release and the model view definition so downstream mapping code has a stable target."},
        {"@type": "HowToStep", "position": 2, "name": "Map the property sets the pipeline reads", "text": "Add an explicit property set mapping for every parameter the pipeline consumes, since family parameters are not exported by default."},
        {"@type": "HowToStep", "position": 3, "name": "Enable shared coordinates", "text": "Export using the project shared coordinates so the model carries georeferencing rather than sitting at its internal origin."},
        {"@type": "HowToStep", "position": 4, "name": "Version the configuration", "text": "Commit the exported configuration file alongside the pipeline so every export is reproducible."},
        {"@type": "HowToStep", "position": 5, "name": "Run acceptance checks", "text": "Verify schema, element counts, unit assignment, georeferencing and proxy ratio before the pipeline consumes the file."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Which IFC schema should I export?",
          "acceptedAnswer": {"@type": "Answer", "text": "Whichever your consuming code is written against, pinned. IFC4 is the common production target and IFC2X3 remains widespread in coordination workflows; IFC4X3 matters when infrastructure entities such as alignments are in scope. The wrong answer is \"whatever the exporter defaults to\", because that changes with the exporter version and takes your attribute paths with it."}
        },
        {
          "@type": "Question",
          "name": "Why are my shared parameters missing from the export?",
          "acceptedAnswer": {"@type": "Answer", "text": "Because parameters are not property sets. Revit exports a standard set of property sets by default, and anything else — shared parameters, project parameters, family parameters — needs an explicit mapping file that names the parameter and the property set it should be written into. Without it the geometry arrives complete and the field the pipeline reads is absent."}
        },
        {
          "@type": "Question",
          "name": "How do I know the export was georeferenced?",
          "acceptedAnswer": {"@type": "Answer", "text": "Check for a map conversion in the output rather than checking the export dialog. If the model has no defined survey point and specified coordinate base there is nothing to export, and no exporter setting will invent one — the fix is in the model. The acceptance check below fails the export rather than letting an unreferenced model into the pipeline."}
        }
      ]
    }
  ]
}
</script>

# Exporting Revit Models to IFC for Python Pipelines

An IFC export is the only route out of Revit that preserves typed products and property sets, and making it dependable for a Python pipeline is a configuration problem: pin the schema and model view, map every property the pipeline reads, export with shared coordinates, keep the configuration in version control, and accept the file only after automated checks. This page belongs to [Revit and Navisworks Export Paths](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/revit-and-navisworks-export-paths/).

## What the Exporter Decides on Your Behalf

The exporter makes four decisions that a downstream pipeline inherits, and all four are configurable.

<!-- fig:rvifc-four-decisions -->
<svg viewBox="-20 -20 580 254" role="img" aria-label="Schema, model view, property set mapping and coordinate base — what each export setting fixes downstream" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:580px;display:block;margin:1.5rem auto;">
  <title>What each export setting fixes for the consumer</title>
  <desc>Four settings and the downstream consequence of each. The schema fixes where attributes live, the model view decides which elements exist at all, the property set mapping decides which parameters survive, and the coordinate base decides whether the model has a position in the world. None of them is visible in the resulting file.</desc>
  <defs>
    <marker id="ri1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ri1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="580" height="254" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="540" height="46" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="16" y="21" font-size="11.5" font-weight="600" fill="currentColor">Schema release</text>
  <text x="16" y="35" font-size="9.5" fill="currentColor" fill-opacity="0.72">where every attribute lives</text>
  <text x="524" y="26.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">IFC4</text>
  <rect x="0" y="56" width="540" height="46" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="16" y="77" font-size="11.5" font-weight="600" fill="currentColor">Model view</text>
  <text x="16" y="91" font-size="9.5" fill="currentColor" fill-opacity="0.72">which elements are present at all</text>
  <text x="524" y="82.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">coordination</text>
  <rect x="0" y="112" width="540" height="46" rx="6" fill="currentColor" fill-opacity="0.14" stroke="currentColor" stroke-width="2"/>
  <text x="16" y="133" font-size="11.5" font-weight="600" fill="currentColor">Pset mapping</text>
  <text x="16" y="147" font-size="9.5" fill="currentColor" fill-opacity="0.72">which parameters become properties</text>
  <text x="524" y="138.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">mapping file</text>
  <rect x="0" y="168" width="540" height="46" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="16" y="189" font-size="11.5" font-weight="600" fill="currentColor">Coordinate base</text>
  <text x="16" y="203" font-size="9.5" fill="currentColor" fill-opacity="0.72">georeferenced, or at the origin</text>
  <text x="524" y="194.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">shared coords</text>
</svg>
<!-- /fig:rvifc-four-decisions -->

**The schema release** fixes what entities exist and where attributes live. Code written against one release does not degrade gracefully against another; it stops matching. This is the same argument made for asserting the schema on read in [IFC4x3 Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/), applied one stage earlier.

**The model view definition** determines which elements and representations are included. A coordination view and a reference view produce visibly different files from one model, and an element absent because of the view looks identical to an element that failed to export.

**The property set mapping** decides which parameters become properties. The default set covers the standard property sets and nothing else — every project-specific parameter needs naming.

**The coordinate base** decides whether the file carries georeferencing. Exporting on internal coordinates produces a model at the origin, which is geometrically intact and spatially meaningless.

## Production-Ready Script

The export itself runs inside Revit; what a pipeline owns is acceptance. This script is the gate the export must pass before anything downstream reads it.

<!-- fig:rvifc-acceptance -->
<svg viewBox="-45 -20 478.2 385" role="img" aria-label="Schema, element count, unit assignment, georeferencing and proxy ratio — the export acceptance checks in order" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:478px;display:block;margin:1.5rem auto;">
  <title>The acceptance gate, in the order it fails cheapest</title>
  <desc>Five checks run at the boundary before any downstream stage reads the file, ordered so the cheapest diagnosis comes first. The schema is one attribute read; element counts are a query; unit assignment and georeferencing are presence tests; the proxy ratio needs two counts. Each raises rather than warns, because a warning in a nightly log is a warning nobody read.</desc>
  <defs>
    <marker id="ri2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ri2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-45" y="-20" width="478.2" height="385" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="254" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="127" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Schema matches</text>
  <text x="127" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">one attribute</text>
  <circle cx="-14" cy="24.1" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="27.6" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">1</text>
  <text x="272" y="27.6" font-size="9.5" fill="currentColor" fill-opacity="0.75">a changed default is caught here</text>
  <rect x="0" y="74.2" width="254" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="127" y="94.5" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Element count</text>
  <text x="127" y="108.2" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">against a baseline</text>
  <circle cx="-14" cy="98.3" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="101.8" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">2</text>
  <text x="272" y="101.8" font-size="9.5" fill="currentColor" fill-opacity="0.75">catches a truncated export</text>
  <rect x="0" y="148.4" width="254" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="127" y="168.7" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Units declared</text>
  <text x="127" y="182.4" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">presence test</text>
  <circle cx="-14" cy="172.5" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="176" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">3</text>
  <text x="272" y="176" font-size="9.5" fill="currentColor" fill-opacity="0.75">geometry is unscaled without it</text>
  <rect x="0" y="222.6" width="254" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="127" y="242.9" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Georeferenced</text>
  <text x="127" y="256.6" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">map conversion present</text>
  <circle cx="-14" cy="246.7" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="250.2" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">4</text>
  <text x="272" y="250.2" font-size="9.5" fill="currentColor" fill-opacity="0.75">a model fix, not an export fix</text>
  <rect x="0" y="296.8" width="254" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="127" y="317.1" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Proxy ratio bounded</text>
  <text x="127" y="330.8" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">two counts</text>
  <circle cx="-14" cy="320.9" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="324.4" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">5</text>
  <text x="272" y="324.4" font-size="9.5" fill="currentColor" fill-opacity="0.75">the category mapping changed</text>
  <line x1="127" y1="48.2" x2="127" y2="74.2" stroke="currentColor" stroke-width="1.4" marker-end="url(#ri2-a)"/>
  <line x1="127" y1="122.4" x2="127" y2="148.4" stroke="currentColor" stroke-width="1.4" marker-end="url(#ri2-a)"/>
  <line x1="127" y1="196.6" x2="127" y2="222.6" stroke="currentColor" stroke-width="1.4" marker-end="url(#ri2-a)"/>
  <line x1="127" y1="270.8" x2="127" y2="296.8" stroke="currentColor" stroke-width="1.4" marker-end="url(#ri2-a)"/>
</svg>
<!-- /fig:rvifc-acceptance -->

{% raw %}
```python
# ifcopenshell>=0.7.0, Python 3.9+
from __future__ import annotations

from dataclasses import dataclass, asdict
import ifcopenshell


@dataclass(frozen=True)
class ExportAcceptance:
    schema: str
    elements: int
    proxies: int
    has_units: bool
    has_georeferencing: bool
    missing_psets: tuple[str, ...]

    @property
    def proxy_ratio(self) -> float:
        return self.proxies / self.elements if self.elements else 0.0


def accept_export(
    path: str,
    *,
    expect_schema: str,
    min_elements: int,
    required_psets: tuple[str, ...] = (),
    max_proxy_ratio: float = 0.05,
) -> ExportAcceptance:
    """Fail the export at the boundary, where the diagnosis is still cheap."""
    model = ifcopenshell.open(path)

    if model.schema != expect_schema:
        raise ValueError(f"{path}: schema {model.schema}, expected {expect_schema}")

    elements = model.by_type("IfcElement")
    proxies = model.by_type("IfcBuildingElementProxy")

    present: set[str] = set()
    for rel in model.by_type("IfcRelDefinesByProperties"):
        definition = rel.RelatingPropertyDefinition
        name = getattr(definition, "Name", None)
        if name:
            present.add(name)
    missing = tuple(p for p in required_psets if p not in present)

    result = ExportAcceptance(
        schema=model.schema,
        elements=len(elements),
        proxies=len(proxies),
        has_units=bool(model.by_type("IfcUnitAssignment")),
        has_georeferencing=bool(model.by_type("IfcMapConversion")),
        missing_psets=missing,
    )

    if result.elements < min_elements:
        raise ValueError(f"{path}: {result.elements} elements — export looks truncated")
    if not result.has_units:
        raise ValueError(f"{path}: no unit assignment — geometry is unscaled")
    if not result.has_georeferencing:
        raise ValueError(f"{path}: no map conversion — exported on internal coordinates")
    if missing:
        raise ValueError(f"{path}: property sets not exported: {', '.join(missing)}")
    if result.proxy_ratio > max_proxy_ratio:
        raise ValueError(
            f"{path}: {result.proxy_ratio:.1%} of elements exported as proxies — "
            "check the category mapping"
        )
    return result


if __name__ == "__main__":
    print(asdict(accept_export(
        "export.ifc", expect_schema="IFC4", min_elements=500,
        required_psets=("Pset_WallCommon", "AssetRegister"),
    )))
```
{% endraw %}

**Key implementation notes:**

- Every check raises rather than warns. A warning in a nightly log is a warning nobody read, and the whole value of the gate is that a bad export never reaches the pipeline.
- The required property sets are named by the pipeline, not by the exporter. That inverts the usual dependency: the consumer states what it needs and the export is measured against it.
- The proxy ratio is a stability signal. Element counts drift as a model develops; the proportion exported as generic proxies should not, so a change in it means the category mapping changed.
- Georeferencing is treated as required. Where a project genuinely has none, relax it deliberately with a comment rather than by omission.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `ifcopenshell` | `>=0.7.0` | schema attribute and `by_type` |
| IFC schema | IFC2X3, IFC4, IFC4X3 | pin one; assert it here |
| Model view | coordination, reference | changes which elements are present |
| Exporter | any version | behaviour varies; version the configuration |
| Coordinate base | shared coordinates | required for the georeferencing check |

## Fallback Strategies

**1. Schema mismatch after an exporter upgrade.** The default changed. Pin the schema in the configuration file rather than relying on the dialog default, and let this check catch the drift.

<!-- fig:rvifc-proxy-signal -->
<svg viewBox="-20 -20 574 194.1" role="img" aria-label="Element counts drift as a design develops; the proxy ratio should not, so it is the more stable export signal" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:574px;display:block;margin:1.5rem auto;">
  <title>Why the proxy ratio is a better signal than the element count</title>
  <desc>Two acceptance metrics compared on how they behave as a project develops. An element count drifts upward as design progresses, so its baseline needs constant maintenance and a genuine truncation hides inside normal growth. The proportion exported as generic proxies should not drift at all, so any movement in it is a change in the export rather than in the design.</desc>
  <defs>
    <marker id="ri3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ri3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="574" height="194.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="252" height="130" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="126" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Element count</text>
  <line x1="14" y1="33" x2="238" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="16" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— grows as the design develops</text>
  <text x="16" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— baseline needs maintaining</text>
  <text x="16" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— truncation hides inside growth</text>
  <text x="16" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— still worth checking</text>
  <rect x="282" y="0" width="252" height="130" rx="6" fill="currentColor" fill-opacity="0.11" stroke="currentColor" stroke-width="1.9"/>
  <text x="408" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Proxy ratio</text>
  <line x1="296" y1="33" x2="520" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="298" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— stable across a project</text>
  <text x="298" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— no baseline maintenance</text>
  <text x="298" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— movement means the mapping changed</text>
  <text x="298" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— the stronger signal</text>
  <text x="267" y="152" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">Check both; act on the ratio.</text>
</svg>
<!-- /fig:rvifc-proxy-signal -->

**2. Missing property sets.** The mapping file was not applied, or the parameter name changed. The check names exactly which sets are absent, which turns a downstream `None` into an export-side fix.

**3. High proxy ratio.** Categories with no natural IFC class. Extend the category mapping where a real class exists, and where none does, accept the proxies deliberately by raising the threshold with a note.

**4. No map conversion.** The model has no survey point or specified coordinate base. This is a model fix, not an export fix; route it to whoever owns the model rather than working around it downstream.

**5. Element count far below baseline.** Usually a view or phase filter, or linked models excluded from the export scope. Compare against the previous accepted export rather than against an absolute number, since a model legitimately grows.

## FAQ

<details>
<summary><strong>Which IFC schema should I export?</strong></summary>

Whichever your consuming code is written against, pinned. IFC4 is the common production target and IFC2X3 remains widespread in coordination workflows; IFC4X3 matters when infrastructure entities such as alignments are in scope. The wrong answer is "whatever the exporter defaults to", because that changes with the exporter version and takes your attribute paths with it.

</details>

<details>
<summary><strong>Why are my shared parameters missing from the export?</strong></summary>

Because parameters are not property sets. Revit exports a standard set of property sets by default, and anything else — shared parameters, project parameters, family parameters — needs an explicit mapping file that names the parameter and the property set it should be written into. Without it the geometry arrives complete and the field the pipeline reads is absent.

</details>

<details>
<summary><strong>How do I know the export was georeferenced?</strong></summary>

Check for a map conversion in the output rather than checking the export dialog. If the model has no defined survey point and specified coordinate base there is nothing to export, and no exporter setting will invent one — the fix is in the model. The acceptance check below fails the export rather than letting an unreferenced model into the pipeline.

</details>

---

## Related Pages

- [Revit and Navisworks Export Paths](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/revit-and-navisworks-export-paths/) — parent reference comparing the three export routes
- [ifcopenshell Workflow](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/) — reading the export this guide produces
- [Reading IFC Georeferencing with ifcopenshell](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/reading-ifc-georeferencing-with-ifcopenshell/) — confirming the shared coordinates actually made it into the file
