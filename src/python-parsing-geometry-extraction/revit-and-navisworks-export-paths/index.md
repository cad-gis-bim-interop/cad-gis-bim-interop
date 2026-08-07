---
title: "Revit and Navisworks Export Paths"
description: "Get Revit and Navisworks data into Python: which export route preserves what, why RVT and NWD are closed, and how to automate an export unattended."
slug: "revit-and-navisworks-export-paths"
breadcrumb:
  - label: "Python Parsing & Geometry Extraction"
    url: "/python-parsing-geometry-extraction/"
  - label: "Revit and Navisworks Export Paths"
    url: "/python-parsing-geometry-extraction/revit-and-navisworks-export-paths/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Revit and Navisworks Export Paths",
      "description": "Get Revit and Navisworks data into Python: which export route preserves what, why RVT and NWD are closed, and how to automate an export unattended.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/revit-and-navisworks-export-paths/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Python Parsing & Geometry Extraction", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/"},
        {"@type": "ListItem", "position": 2, "name": "Revit and Navisworks Export Paths", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/revit-and-navisworks-export-paths/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Choose and automate an export route out of Revit or Navisworks",
      "description": "Decide what the downstream pipeline needs, pick the export route that preserves it, fix the export configuration in a stored mapping, automate the export, and verify the result before the pipeline consumes it.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "State what the pipeline needs", "text": "Decide whether the downstream work needs typed products and property sets, geometry with layer-encoded classification, or a coordination view, because each points at a different export."},
        {"@type": "HowToStep", "position": 2, "name": "Pick the route that preserves it", "text": "Route to IFC for typed products, to DXF or DWG for linework, and to a coordination export where clash and appearance data are the subject."},
        {"@type": "HowToStep", "position": 3, "name": "Fix the export configuration", "text": "Store the IFC export setup or the DWG layer mapping in version control so every export is reproducible rather than reflecting whoever last touched the dialog."},
        {"@type": "HowToStep", "position": 4, "name": "Automate the export", "text": "Drive the export from a scheduled task on a machine that has the authoring application, since neither native format can be read outside it."},
        {"@type": "HowToStep", "position": 5, "name": "Verify before consuming", "text": "Check the exported file against element counts, declared units and georeferencing before any downstream stage treats it as input."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Can Python read an RVT file directly?",
          "acceptedAnswer": {"@type": "Answer", "text": "Not usefully. RVT is a closed, undocumented, version-specific format, and while its structured-storage container can be opened enough to read the version and some basic metadata, the model content is not accessible without the Revit API. Every production route out of Revit therefore involves an export performed by Revit itself. Plan for that dependency rather than looking for a parser."}
        },
        {
          "@type": "Question",
          "name": "Which export route preserves property sets?",
          "acceptedAnswer": {"@type": "Answer", "text": "IFC, and only IFC. A DWG or DXF export from Revit produces geometry organised by layer with the semantic model discarded, so property sets, type relationships and the spatial hierarchy do not survive. If the downstream pipeline reads properties — quantities, fire ratings, asset identifiers — the route is IFC and the export configuration decides which property sets are included."}
        },
        {
          "@type": "Question",
          "name": "Why do two exports of the same model differ?",
          "acceptedAnswer": {"@type": "Answer", "text": "Because the export configuration is part of the output and it usually lives in a dialog rather than in version control. IFC exports differ by mapping table, by which property sets are included and by the model view definition; DWG exports differ by layer mapping. Store the configuration file alongside the pipeline and reference it explicitly, and the exports become reproducible."}
        },
        {
          "@type": "Question",
          "name": "Does an export carry the project georeferencing?",
          "acceptedAnswer": {"@type": "Answer", "text": "Only if the model has it and the export is configured to include it. A Revit model that has a defined survey point and a specified coordinate base can export shared coordinates into IFC georeferencing, but a model set up with an internal origin only has nothing to export. Check the model rather than the exporter when georeferencing is missing."}
        },
        {
          "@type": "Question",
          "name": "Is Navisworks worth exporting from at all?",
          "acceptedAnswer": {"@type": "Answer", "text": "For geometry, rarely — the federated model it holds is assembled from source models that are better read directly. For clash results and the appearance and selection metadata that Navisworks itself produces, it is the only source, and those export as XML that a Python pipeline can read without the application. Treat it as a source of results rather than a source of models."}
        }
      ]
    }
  ]
}
</script>

# Revit and Navisworks Export Paths

Getting design data out of Revit and Navisworks is an export problem rather than a parsing problem, and it is the stage of the [Python Parsing & Geometry Extraction](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/) pipeline that most often determines what the rest of the pipeline is capable of.

The reason is structural. Both native formats are closed, version-specific and readable only by the applications that write them, so a Python pipeline never touches them; it consumes an export. That export is where the model's semantics are either preserved or thrown away, and the decision is made by whoever configured the exporter — often in a dialog, often once, often years ago. A pipeline that treats the export as a given inherits those decisions without knowing what they were.

## Prerequisites

- **A machine that has the authoring application installed**, if exports are to be automated. There is no way around this: the export must be performed by the application.
- **Python 3.9+** on the consuming side, which does *not* need to be the same machine.
- **`ifcopenshell>=0.7.0`** for the IFC route, **`ezdxf>=1.1.0`** for the DXF route, and the conversion tooling described in [DWG-to-Python Integration](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/) for DWG output.
- **`lxml>=4.9`** for reading Navisworks clash reports, which are XML.
- Agreement with whoever owns the model about the export configuration. This is a project-governance prerequisite and it is the one most often skipped.

## Architectural Overview

Three export routes exist, and they preserve different things.

<!-- fig:rv-routes -->
<svg viewBox="-20 -20 496.4 216.2" role="img" aria-label="Properties point at IFC, drawings at DXF or DWG, clash results at the coordination export" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:496px;display:block;margin:1.5rem auto;">
  <title>The export route follows from what the pipeline reads</title>
  <desc>A three-way branch on what the consuming pipeline actually needs. Anything beyond geometry — classification, quantities, property sets — points at the IFC route, the only one that preserves semantics. Drawings point at the CAD route. Clash results point at the coordination export, which carries the analysis and almost nothing of the model.</desc>
  <defs>
    <marker id="rv1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="rv1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="496.4" height="216.2" fill="var(--color-surface)"/>
  <polygon points="228.2,0 331.5,31 228.2,62 124.9,31" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-width="1.6"/>
  <text x="228.2" y="35" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">What does the pipeline read?</text>
  <rect x="0" y="128" width="133.5" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="66.7" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">IFC</text>
  <text x="66.7" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">typed products + psets</text>
  <path d="M 228.2 62 L 228.2 92 L 66.7 92 L 66.7 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#rv1-a)" stroke-linejoin="round"/>
  <text x="66.7" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">properties</text>
  <rect x="161.5" y="128" width="133.5" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="228.2" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">DXF / DWG</text>
  <text x="228.2" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">layer names only</text>
  <path d="M 228.2 62 L 228.2 92 L 228.2 92 L 228.2 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#rv1-a)" stroke-linejoin="round"/>
  <text x="228.2" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">linework</text>
  <rect x="322.9" y="128" width="133.5" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="389.7" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Clash XML</text>
  <text x="389.7" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">analysis, not model</text>
  <path d="M 228.2 62 L 228.2 92 L 389.7 92 L 389.7 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#rv1-a)" stroke-linejoin="round"/>
  <text x="389.7" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">clash results</text>
</svg>
<!-- /fig:rv-routes -->

**The IFC route** produces a typed product model: elements with classes, property sets, quantity sets, a spatial hierarchy and — when the model is set up for it — georeferencing. It is the only route that preserves semantics, and it is the route a pipeline should default to whenever the downstream work reads anything other than geometry.

**The DXF or DWG route** produces linework and solids organised by layer. Everything semantic is discarded; classification survives only as a layer-naming convention, which puts the downstream pipeline back in the position described in [Layer Mapping Logic](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/). It is the right route when the deliverable genuinely is drawings, and the wrong one whenever a property is needed later.

**The coordination route** — Navisworks exports and the formats around them — carries clash results, viewpoints and appearance overrides. It preserves almost nothing about the model itself, and everything about the analysis performed on it.

| Route | Preserves | Loses | Automatable |
|---|---|---|---|
| IFC | typed products, psets, hierarchy, georeferencing | native parametrics, families | yes |
| DXF / DWG | geometry, layer names | all semantics | yes |
| Clash XML | clash results, viewpoints | the model | yes |
| Native RVT / NWD | everything | — | not readable outside the application |

The fourth row is included because it is the assumption people arrive with. It is worth stating plainly: there is no supported route that reads a native file in Python, and building a pipeline on a partial reverse-engineered reader is a decision to be surprised by a version upgrade.

## Step-by-Step Implementation

### 1. Decide what the downstream pipeline actually reads

<!-- fig:rv-config-is-output -->
<svg viewBox="-20 -20 635.4 144.4" role="img" aria-label="Schema, model view, property set mapping and coordinate base — the export settings a pipeline inherits invisibly" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:635px;display:block;margin:1.5rem auto;">
  <title>Four export settings the downstream pipeline inherits</title>
  <desc>Four configuration decisions made in the exporter that the consuming pipeline lives with and cannot see in the file. The schema release fixes where attributes live; the model view decides which elements are present; the property set mapping decides which parameters survive; the coordinate base decides whether the model is georeferenced at all.</desc>
  <defs>
    <marker id="rv2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="rv2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="635.4" height="144.4" fill="var(--color-surface)"/>
  <rect x="212.7" y="17.4" width="170" height="69.6" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="297.7" y="41.7" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">The export</text>
  <text x="297.7" y="55.4" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">configuration</text>
  <text x="297.7" y="68.8" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">is part of the output</text>
  <rect x="0" y="0" width="142.7" height="44.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="71.4" y="18.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Schema release</text>
  <text x="71.4" y="32" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">where attributes live</text>
  <path d="M 142.7 22.1 L 190.7 22.1 L 190.7 52.2 L 212.7 52.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.7" marker-end="url(#rv2-a)" stroke-linejoin="round"/>
  <rect x="0" y="60.2" width="142.7" height="44.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="71.4" y="78.5" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Model view</text>
  <text x="71.4" y="92.2" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">which elements exist</text>
  <path d="M 142.7 82.3 L 190.7 82.3 L 190.7 52.2 L 212.7 52.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.7" marker-end="url(#rv2-a)" stroke-linejoin="round"/>
  <rect x="452.7" y="0" width="142.7" height="44.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="524.1" y="18.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Pset mapping</text>
  <text x="524.1" y="32" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">which parameters survive</text>
  <path d="M 382.7 52.2 L 430.7 52.2 L 430.7 22.1 L 452.7 22.1" fill="none" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.7" marker-end="url(#rv2-a)" stroke-linejoin="round"/>
  <rect x="452.7" y="60.2" width="142.7" height="44.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="524.1" y="78.5" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Coordinate base</text>
  <text x="524.1" y="92.2" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">georeferenced or not</text>
  <path d="M 382.7 52.2 L 430.7 52.2 L 430.7 82.3 L 452.7 82.3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.7" marker-end="url(#rv2-a)" stroke-linejoin="round"/>
</svg>
<!-- /fig:rv-config-is-output -->

This sounds procedural and is the step that saves the most work. Write down what the consuming stages need — geometry only, geometry plus classification, geometry plus quantities, clash results — and the route follows without further argument.

{% raw %}
```python
# Python 3.9+
ROUTE_FOR = {
    frozenset({"geometry"}):                       "dxf",
    frozenset({"geometry", "classification"}):     "ifc",
    frozenset({"geometry", "properties"}):         "ifc",
    frozenset({"clash"}):                          "clash_xml",
}

def choose_route(needs: set[str]) -> str:
    try:
        return ROUTE_FOR[frozenset(needs)]
    except KeyError:
        raise ValueError(f"no single export route covers {sorted(needs)} — split the pipeline")
```
{% endraw %}

The exception matters more than the lookup. A requirement set that no single route covers is a real finding, and the honest response is two exports rather than one export and a workaround.

### 2. Put the export configuration under version control

An IFC export is governed by a setup that decides the schema version, the model view definition, which property sets are written and how Revit categories map to IFC classes. A DWG export is governed by a layer mapping table. Both are files, both are exportable from the application, and neither is usually stored anywhere durable.

Commit them next to the pipeline, reference them by path in the automation, and record in the pipeline's output which configuration produced the input. Two exports of one model that differ are then a diff rather than a mystery.

### 3. Automate the export

Automation runs on the machine with the application, triggered on a schedule or by a model check-in, and drops its output where the pipeline collects it. The details are application-specific, but the shape is the same and the failure modes are the shape's:

{% raw %}
```python
# Python 3.9+ — the collector side, running anywhere
import subprocess, pathlib

def run_export(script: pathlib.Path, model: pathlib.Path, out: pathlib.Path,
               timeout_s: int = 3600) -> pathlib.Path:
    """Drive an export and verify a file actually appeared."""
    out.parent.mkdir(parents=True, exist_ok=True)
    before = out.stat().st_mtime if out.exists() else 0
    subprocess.run([str(script), str(model), str(out)], check=True, timeout=timeout_s)
    if not out.exists() or out.stat().st_mtime <= before:
        raise RuntimeError(f"export reported success but {out} was not written")
    return out
```
{% endraw %}

The mtime check is not defensive programming for its own sake. A GUI application driven headlessly exiting zero without writing anything is a routine occurrence, and it is the same failure the ODA converter exhibits — covered in [Batch Converting DWG to DXF with the ODA File Converter](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/batch-converting-dwg-to-dxf-with-oda-file-converter/).

### 4. Verify the export before consuming it

{% raw %}
```python
# ifcopenshell>=0.7.0
import ifcopenshell

def verify_ifc_export(path: str, expected_min_elements: int = 1) -> dict:
    model = ifcopenshell.open(path)
    elements = model.by_type("IfcElement")
    units = model.by_type("IfcUnitAssignment")
    report = {
        "schema": model.schema,
        "elements": len(elements),
        "has_units": bool(units),
        "has_georeferencing": bool(model.by_type("IfcMapConversion")),
    }
    if report["elements"] < expected_min_elements:
        raise ValueError(f"{path}: {report['elements']} elements — export looks truncated")
    if not report["has_units"]:
        raise ValueError(f"{path}: no unit assignment — geometry is unscaled")
    return report
```
{% endraw %}

Run this at the boundary, before any downstream stage. An export that is empty, unscaled or on an unexpected schema is a problem with the export, and diagnosing it three stages later costs an order of magnitude more.

### 5. Read clash results as data, not as a report

{% raw %}
```python
# lxml>=4.9
from lxml import etree

def clashes(xml_path: str):
    tree = etree.parse(xml_path)
    for result in tree.findall(".//clashresult"):
        yield {
            "name": result.get("name"),
            "status": result.get("status"),
            "distance": float(result.get("distance", "0")),
            "position": tuple(
                float(result.find(f"clashpoint/pos3f").get(a)) for a in ("x", "y", "z")
            ),
        }
```
{% endraw %}

Clash positions are model coordinates, so they inherit the model's coordinate system and its origin. Reprojecting them into the project's spatial system makes clash density mappable alongside everything else the pipeline produces, which is usually the reason the results were wanted in the first place.

## Edge Cases and Gotchas

**The export configuration is invisible in the output.** An IFC file does not record which mapping table produced it. Two files from the same model with different configurations are indistinguishable except by their content, so a pipeline that consumes exports from more than one source needs the configuration recorded upstream — the file cannot tell you.

<!-- fig:rv-silent-scope -->
<svg viewBox="-20 -20 452.8 214.1" role="img" aria-label="Missing psets, excluded links, proxy fallback and internal coordinates — export faults and the checks that catch them" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:453px;display:block;margin:1.5rem auto;">
  <title>Export faults and what each one looks like downstream</title>
  <desc>Four export configuration faults, the symptom each produces in the consuming pipeline, and the check that attributes it to the export rather than to the parser. All four produce a file that opens cleanly, which is why the acceptance checks compare counts and ratios rather than testing for exceptions.</desc>
  <defs>
    <marker id="rv3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="rv3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="452.8" height="214.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="412.8" height="152" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="412.8" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">Fault</text>
  <text x="201.8" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Looks like</text>
  <line x1="278.4" y1="0" x2="278.4" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="345.6" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Check that catches it</text>
  <line x1="125.2" y1="0" x2="125.2" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="412.8" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">Pset not mapped</text>
  <text x="201.8" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">a field that is always None</text>
  <text x="345.6" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">required pset list</text>
  <line x1="0" y1="62" x2="412.8" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">Links excluded</text>
  <text x="201.8" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">a whole discipline missing</text>
  <text x="345.6" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">element count per class</text>
  <line x1="0" y1="92" x2="412.8" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">Category unmapped</text>
  <text x="201.8" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">elements as generic proxies</text>
  <text x="345.6" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">proxy ratio</text>
  <line x1="0" y1="122" x2="412.8" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="140.5" font-size="10.5" font-weight="600" fill="currentColor">Internal coordinates</text>
  <text x="201.8" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">model at the origin</text>
  <text x="345.6" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">map conversion present</text>
  <text x="0" y="172" font-size="9.5" fill="currentColor" fill-opacity="0.7">Every one of these opens cleanly — the exit status of an export proves nothing.</text>
</svg>
<!-- /fig:rv-silent-scope -->

**Shared coordinates have to exist before they can be exported.** A model authored around an internal origin has no georeferencing to write, and no exporter setting will invent one. The fix is in the model, not in the export, and it is usually a conversation rather than a setting.

**Linked models may or may not be included.** An export can cover the host model only, or the host plus its links, and the setting is easy to overlook. The symptom is a coherent-looking model missing an entire discipline — a building with no services — which reads as an extraction failure rather than as an export scope.

**Category-to-class mapping is lossy and configurable.** Elements whose category has no natural IFC class land on a generic class such as a building element proxy. A pipeline filtering on specific classes then silently omits them. Count proxies in the verification step; a rising proxy count is the signal that a mapping needs attention.

**Family parameters are not property sets by default.** Parameters that a modelling team relies on may not be exported unless they are explicitly mapped to property sets. The elements arrive, the geometry is right, and the field the pipeline needs is absent — a failure that looks like a parsing bug and is an export configuration.

**Navisworks appearance overrides are not model data.** Colour and transparency applied in a federated view describe the view, not the elements. Reading them as element attributes attributes a reviewer's highlighting to the design.

## Validation and Testing

The tests worth automating compare an export against the model it came from, at the level of counts rather than geometry.

{% raw %}
```python
# pytest, ifcopenshell>=0.7.0
BASELINE = {"IfcWall": 812, "IfcSlab": 96, "IfcDoor": 214}

def test_export_matches_baseline_counts(exported_ifc):
    model = ifcopenshell.open(exported_ifc)
    for cls, expected in BASELINE.items():
        actual = len(model.by_type(cls))
        assert actual >= expected * 0.95, f"{cls}: {actual} vs baseline {expected}"

def test_proxy_ratio_is_bounded(exported_ifc):
    model = ifcopenshell.open(exported_ifc)
    total = len(model.by_type("IfcElement"))
    proxies = len(model.by_type("IfcBuildingElementProxy"))
    assert proxies / total < 0.05, (
        f"{proxies}/{total} elements exported as proxies — check the category mapping"
    )
```
{% endraw %}

The proxy ratio is the more informative of the two over time. Element counts drift as a model develops and the baseline needs maintaining; the proxy ratio should not drift at all, so a change in it is a change in the export rather than in the design.

## Performance and Scale

Export is slow — minutes to tens of minutes for a large federated model — and it is slow on a licensed machine that cannot be scaled horizontally the way a container fleet can. That single fact shapes the architecture.

**Export on a schedule, not on demand.** A pipeline stage that triggers an export and waits couples its latency to the authoring application and its availability to a licence. Export nightly, publish the result to shared storage, and let the pipeline consume whatever is current. Where freshness matters, trigger on model check-in rather than on pipeline start.

**Export once, consume many times.** The expensive artefact is the export; the cheap artefacts are everything derived from it. A single IFC export feeding a footprint extraction, a quantity extraction and a clash overlay costs one export, whereas three pipelines each triggering their own costs three.

**Split large federations by discipline.** A federated model exported whole produces a file large enough to be awkward everywhere downstream. Per-discipline exports are faster to produce, faster to parse, independently re-runnable when one discipline changes, and they fail in isolation — one broken structural export does not deprive the pipeline of the architectural model.

## FAQ

<details>
<summary><strong>Can Python read an RVT file directly?</strong></summary>

Not usefully. RVT is a closed, undocumented, version-specific format, and while its structured-storage container can be opened enough to read the version and some basic metadata, the model content is not accessible without the Revit API. Every production route out of Revit therefore involves an export performed by Revit itself. Plan for that dependency rather than looking for a parser.

</details>

<details>
<summary><strong>Which export route preserves property sets?</strong></summary>

IFC, and only IFC. A DWG or DXF export from Revit produces geometry organised by layer with the semantic model discarded, so property sets, type relationships and the spatial hierarchy do not survive. If the downstream pipeline reads properties — quantities, fire ratings, asset identifiers — the route is IFC and the export configuration decides which property sets are included.

</details>

<details>
<summary><strong>Why do two exports of the same model differ?</strong></summary>

Because the export configuration is part of the output and it usually lives in a dialog rather than in version control. IFC exports differ by mapping table, by which property sets are included and by the model view definition; DWG exports differ by layer mapping. Store the configuration file alongside the pipeline and reference it explicitly, and the exports become reproducible.

</details>

<details>
<summary><strong>Does an export carry the project georeferencing?</strong></summary>

Only if the model has it and the export is configured to include it. A Revit model that has a defined survey point and a specified coordinate base can export shared coordinates into IFC georeferencing, but a model set up with an internal origin only has nothing to export. Check the model rather than the exporter when georeferencing is missing.

</details>

<details>
<summary><strong>Is Navisworks worth exporting from at all?</strong></summary>

For geometry, rarely — the federated model it holds is assembled from source models that are better read directly. For clash results and the appearance and selection metadata that Navisworks itself produces, it is the only source, and those export as XML that a Python pipeline can read without the application. Treat it as a source of results rather than a source of models.

</details>

---

## Related Pages

- [Python Parsing & Geometry Extraction](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/) — the parent section covering what happens after the export lands
- [ifcopenshell Workflow](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/) — reading the IFC that the recommended route produces
- [DWG-to-Python Integration](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/) — the conversion hop a DWG export still needs
- [DXF vs IFC for GIS Ingestion](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/dxf-vs-ifc-for-gis-ingestion/) — the decision this page implements at the authoring end
- [IFC4x3 Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/) — the schema an export is written against
