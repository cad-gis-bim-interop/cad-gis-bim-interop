---
title: "Interoperability Decision Guides for CAD, GIS & BIM Pipelines"
description: "An engineering decision framework for choosing the right Python library, interchange format, and storage target when moving geometry between CAD, GIS, and BIM systems."
slug: "interoperability-decision-guides"
breadcrumb: "Interoperability Decision Guides"
datePublished: "2026-07-11"
dateModified: "2026-07-11"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Interoperability Decision Guides for CAD, GIS & BIM Pipelines",
      "description": "An engineering decision framework for choosing the right Python library, interchange format, and storage target when moving geometry between CAD, GIS, and BIM systems.",
      "datePublished": "2026-07-11",
      "dateModified": "2026-07-11",
      "author": {"@type": "Organization", "name": "CAD GIS BIM Interop"},
      "publisher": {"@type": "Organization", "name": "CAD GIS BIM Interop", "url": "https://www.cad-gis-bim-interop.org"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.cad-gis-bim-interop.org/"},
        {"@type": "ListItem", "position": 2, "name": "Interoperability Decision Guides", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/"}
      ]
    }
  ]
}
</script>

# Interoperability Decision Guides for CAD, GIS & BIM Pipelines

Choosing the wrong library or interchange format at the start of a CAD/GIS/BIM integration does not fail loudly on day one. It fails three weeks later, in production, when a licensing clause blocks a headless CI runner from converting DWG; when a DXF-first ingestion route silently discards the wall thicknesses and storey relationships a downstream digital twin needed; when a team that standardised on a single-file GeoPackage discovers that their nightly CAD export now has forty concurrent writers and a locked database. These are not exotic failures. They are the predictable consequence of a decision made once, informally, before anyone measured fidelity, throughput, or operational cost. The purpose of this section is to make those decisions explicit, comparable, and reversible before they are baked into a pipeline.

Every interoperability project answers the same three questions in sequence: *which parsing library reads my source reliably*, *which interchange format preserves the data I actually need*, and *which storage target serves the consumers downstream*. Each question has more than one defensible answer, and the right answer depends on measurable properties — format coverage, geometric fidelity, licensing constraints, headless suitability, throughput, and concurrency — not on which tool a team happened to know first. The diagram below traces that decision path from a raw source file through to a queryable store.

<svg viewBox="0 0 760 470" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Interoperability decision flow: a source format is routed to a parsing library, then to an interchange format, then to a storage target, with the decision criteria that govern each hop" style="width:100%;max-width:760px;display:block;margin:2rem auto;">
  <title>CAD/GIS/BIM Interoperability Decision Flow</title>
  <desc>A four-stage decision flow. A raw source file (DWG, DXF, IFC, Shapefile, GeoPackage) is routed to a parsing library chosen on coverage and licensing, then to an interchange format chosen on fidelity, then to a storage target chosen on concurrency and query needs. A side column lists the decision criterion applied at each hop.</desc>
  <defs>
    <marker id="idg-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor" opacity="0.6"/>
    </marker>
  </defs>
  <rect x="0" y="0" width="760" height="470" fill="var(--color-surface)"/>
  <!-- Stage 1: source format -->
  <rect x="20" y="20" width="530" height="58" rx="8" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.2"/>
  <text x="285" y="44" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.6" font-weight="600">SOURCE FORMAT</text>
  <text x="285" y="63" text-anchor="middle" font-size="10.5" fill="currentColor" opacity="0.45">.dwg  ·  .dxf  ·  .ifc  ·  .shp  ·  .gpkg</text>
  <!-- criterion callout 1 -->
  <text x="670" y="45" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.5">coverage +</text>
  <text x="670" y="60" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.5">licensing</text>
  <line x1="285" y1="78" x2="285" y2="108" stroke="currentColor" stroke-width="1.5" opacity="0.4" marker-end="url(#idg-arr)"/>
  <!-- Stage 2: parsing library -->
  <rect x="20" y="110" width="530" height="66" rx="8" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.25"/>
  <text x="285" y="134" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.6" font-weight="600">STAGE 1 — WHICH PARSING LIBRARY</text>
  <text x="285" y="153" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.45">ezdxf  ·  LibreDWG / pydwg  ·  ODA File Converter</text>
  <text x="285" y="169" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.45">ifcopenshell  ·  GDAL / OGR</text>
  <line x1="670" y1="110" x2="670" y2="176" stroke="currentColor" stroke-width="1" opacity="0.25" stroke-dasharray="3 3"/>
  <line x1="285" y1="176" x2="285" y2="206" stroke="currentColor" stroke-width="1.5" opacity="0.4" marker-end="url(#idg-arr)"/>
  <!-- Stage 3: interchange format -->
  <rect x="20" y="208" width="530" height="66" rx="8" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.25"/>
  <text x="285" y="232" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.6" font-weight="600">STAGE 2 — WHICH INTERCHANGE FORMAT</text>
  <text x="285" y="251" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.45">DXF (geometry)  ·  IFC (semantics)</text>
  <text x="285" y="267" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.45">GeoJSON / WKB (GIS features)</text>
  <text x="670" y="238" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.5">geometric</text>
  <text x="670" y="253" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.5">fidelity</text>
  <line x1="285" y1="274" x2="285" y2="304" stroke="currentColor" stroke-width="1.5" opacity="0.4" marker-end="url(#idg-arr)"/>
  <!-- Stage 4: storage target -->
  <rect x="20" y="306" width="530" height="66" rx="8" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.25"/>
  <text x="285" y="330" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.6" font-weight="600">STAGE 3 — WHICH STORAGE TARGET</text>
  <text x="285" y="349" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.45">GeoPackage (single-file, embedded)</text>
  <text x="285" y="365" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.45">PostGIS (server, concurrent writers)</text>
  <text x="670" y="336" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.5">concurrency</text>
  <text x="670" y="351" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.5">+ queries</text>
  <line x1="285" y1="372" x2="285" y2="402" stroke="currentColor" stroke-width="1.5" opacity="0.4" marker-end="url(#idg-arr)"/>
  <!-- Consumers -->
  <rect x="20" y="404" width="530" height="50" rx="8" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.18"/>
  <text x="285" y="426" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.55" font-weight="600">DOWNSTREAM CONSUMERS</text>
  <text x="285" y="444" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.45">digital twin  ·  QGIS / ArcGIS  ·  web viewer  ·  analytics</text>
</svg>

## Foundations

Interoperability decisions are cross-cutting: a single choice at one stage constrains the options at every stage after it. Reading DWG through a licensed converter, for example, forces DXF as the intermediate geometry format, which in turn shapes how much building semantics survive into a GIS store. To make those decisions well, you need working knowledge of the three subject areas this section draws on, each of which is documented in depth elsewhere on the site.

The first is parsing and geometry extraction. Every decision guide here assumes you can already open a file and pull structured geometry out of it — iterating a DXF model space, evaluating an IFC representation tree into a mesh, or reading a GIS feature layer. The [Python Parsing & Geometry Extraction](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/) reference establishes the five-stage pipeline model — ingestion, parser dispatch, geometry extraction, coordinate normalisation, serialisation — that the decisions below slot into. When a guide says "ezdxf reads this reliably but ODA does not," it is a statement about parser dispatch, and the underlying mechanics live in that reference and its [ezdxf Deep Dive](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/) and [pydwg Integration](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/) workflows.

<!-- fig:decisions-sequence -->
<svg viewBox="-45 -20 475.3 236.6" role="img" aria-label="Read the source, choose the interchange representation, then choose storage — the order that keeps each decision reversible" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:475px;display:block;margin:1.5rem auto;">
  <title>Three decisions, and the order that keeps them independent</title>
  <desc>The three interoperability decisions in the order that keeps each one from foreclosing the next. How the source is read is settled by the input format. What the interchange representation is follows from what the deliverable means. Where the output lands follows from who reads it. Taken in this order each is reversible; taken out of order, a storage choice made first quietly dictates the other two.</desc>
  <defs>
    <marker id="idg1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="idg1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-45" y="-20" width="475.3" height="236.6" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="272" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="136" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">How is the source read?</text>
  <text x="136" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">decided by the input format</text>
  <circle cx="-14" cy="24.1" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="27.6" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">1</text>
  <text x="290" y="27.6" font-size="9.5" fill="currentColor" fill-opacity="0.75">DXF parses, DWG converts</text>
  <rect x="0" y="74.2" width="272" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="136" y="94.5" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">What is the interchange?</text>
  <text x="136" y="108.2" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">decided by the deliverable</text>
  <circle cx="-14" cy="98.3" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="101.8" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">2</text>
  <text x="290" y="101.8" font-size="9.5" fill="currentColor" fill-opacity="0.75">linework or typed products</text>
  <rect x="0" y="148.4" width="272" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="136" y="168.7" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Where does output land?</text>
  <text x="136" y="182.4" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">decided by who reads it</text>
  <circle cx="-14" cy="172.5" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="176" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">3</text>
  <text x="290" y="176" font-size="9.5" fill="currentColor" fill-opacity="0.75">a file or a server</text>
  <line x1="136" y1="48.2" x2="136" y2="74.2" stroke="currentColor" stroke-width="1.4" marker-end="url(#idg1-a)"/>
  <line x1="136" y1="122.4" x2="136" y2="148.4" stroke="currentColor" stroke-width="1.4" marker-end="url(#idg1-a)"/>
</svg>
<!-- /fig:decisions-sequence -->

The second is coordinate handling. A library choice that reads geometry perfectly is still worthless if the coordinates land in the wrong place. CAD files store local drawing units with no coordinate reference system; GIS stores demand an explicit CRS. Choosing an interchange format therefore implies a coordinate strategy: DXF carries no georeferencing of its own, IFC has an optional `IfcMapConversion`, and GeoJSON mandates WGS84. The [Coordinate Transformation & Spatial Alignment](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/) reference covers the unit conversion and reprojection that must happen between parsing and storage, and it is the reason the interchange-format decision can never be made on geometry alone.

The third is the format and schema layer itself. Deciding between DXF and IFC for a given ingestion route requires understanding what each format can represent — DXF's flat entity model versus IFC's typed, related object graph — and where each one loses information. The [Core Format Fundamentals & Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/) reference documents the group-code taxonomy of DXF, the entity hierarchy of IFC4X3, and the specific constraints of proprietary DWG. Those constraints, especially the ones described under [DWG Proprietary Limitations](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/), are what force the library decision that opens this section.

The recurring decision variables across all three guides are consistent, and it is worth naming them once:

- **Format coverage** — which source and target formats a tool can actually read and write, and at which versions.
- **Fidelity** — whether geometry, attributes, and relationships survive the conversion, or whether solids collapse to wireframes and property sets vanish.
- **Licensing and cost** — whether a tool can be deployed in a headless server or CI runner without a per-seat licence or interactive activation.
- **Operational suitability** — throughput in entities or megabytes per second, memory ceiling, and how the tool behaves under concurrency.

Every guide below scores its options against these variables so that the choice is defensible in a design review rather than a matter of habit.

## Decision Architecture

The decision flow in the diagram above is deliberately staged, because collapsing the stages is where projects go wrong. Teams frequently pick a storage target first — "we use PostGIS, so everything goes to PostGIS" — and only later discover that the source DWG cannot be read on the headless box that runs the loader. The correct order is source-outward: establish what you can read, then what you can faithfully carry, then where it can live.

Stage one is bounded by what your runtime can execute. A pure-Python route that runs anywhere is worth a great deal of operational simplicity, but it caps you at DXF and forfeits native DWG. A licensed converter unlocks DWG at the cost of a binary dependency and a licence audit. Stage two is bounded by fidelity: the interchange format is the narrowest point in the pipe, and anything the format cannot express is lost there permanently, regardless of how good the parser or the database is. Stage three is bounded by operational shape: how many writers, how many readers, whether the output is a deliverable file or a live service.

Because each stage constrains the next, the three guides in this section are ordered to match the flow. The library decision comes first because it determines whether you have geometry to work with at all. The format decision comes second because it determines what that geometry means once it reaches GIS. The storage decision comes last because it determines who can use the result and how fast. Read in that order, they compose into an end-to-end interoperability design.

## Core Decision Guides

### Choosing ezdxf, pydwg, or ODA for Production

The first decision most CAD ingestion projects hit is how to read the source at all, and it is sharper than it looks because the common case is DWG, not DXF. The [Choosing ezdxf, pydwg, or ODA for Production](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-ezdxf-pydwg-or-oda-for-production/) guide compares three approaches: pure-Python `ezdxf`, which reads and writes DXF flawlessly but cannot open DWG at all; community DWG readers such as LibreDWG and the `pydwg` bindings, which read some DWG versions but carry real coverage and stability risk; and the ODA File Converter or the licensed Teigha/ODA SDK, which convert DWG to DXF reliably across the full R12-to-2018 version range but introduce a licence and a binary dependency.

The trap here is assuming these tools are interchangeable. They are not: they occupy different points on a fidelity-versus-freedom curve. `ezdxf` is the right answer when your inputs are genuinely DXF or when you control the export step and can request DXF. A DWG-native pipeline that must run unattended in CI almost always ends up routing DWG through ODA to DXF and then parsing the DXF with `ezdxf` — two tools composed, not one chosen. The guide scores each option on DWG version support, handling of proxy objects and ACIS solids, headless and CI suitability, and throughput, and it gives the subprocess pattern for driving the ODA converter under `xvfb` on a server with no display.

### DXF vs IFC for GIS Ingestion

Once you can read the source, the next decision is what to carry into GIS, and the two dominant routes encode fundamentally different world models. The [DXF vs IFC for GIS Ingestion](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/dxf-vs-ifc-for-gis-ingestion/) guide addresses the choice directly. DXF is geometry-first: fast to parse, universally supported, and a natural fit when you need footprints, linework, and layers as GIS features. IFC is semantics-first: it carries the building's object graph — walls, spaces, storeys, systems, and their relationships and property sets — which is exactly what a digital twin or asset register needs and exactly what DXF throws away.

Choosing DXF when the downstream consumer needs storey membership or fire-rating property sets produces a technically valid ingestion that is functionally useless, because the attributes never made it through the interchange format. Choosing IFC when all anyone wanted was 2D building outlines burdens the pipeline with a heavier parse and a geometry-evaluation step for no benefit. The guide maps the two formats against what GIS actually consumes, covers the georeferencing gap on both sides, and links to the fallback route — [converting IFC to DXF as a GIS fallback](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/dxf-vs-ifc-for-gis-ingestion/converting-ifc-to-dxf-as-a-gis-fallback/) — for when a GIS toolchain refuses IFC entirely.

### Choosing a Geometry Engine for Python Pipelines

The three decisions above settle how data enters and leaves a pipeline; [Choosing a Geometry Engine for Python Pipelines](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/) settles what happens in the middle. Shapely, trimesh and OpenCASCADE answer different questions, and the one that decides between them — planar, mesh or exact solid — is worth asking before the first import rather than after the code is written.

### GeoPackage vs PostGIS for CAD Output

The final decision is where the converted geometry lives, and it is an operational decision more than a geometric one. The [GeoPackage vs PostGIS for CAD Output](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/geopackage-vs-postgis-for-cad-output/) guide compares an embedded, single-file SQLite-based GeoPackage against a client-server PostGIS database. GeoPackage is the right target for a deliverable: one file, no server, opens directly in QGIS and ArcGIS, ideal for handoff, versioned artifacts, and single-writer batch jobs. PostGIS is the right target for a platform: concurrent writers, spatial indexing at scale, row-level access control, and SQL-driven analytics that a file cannot provide.

The failure mode is scale mismatch in both directions. Standardising on GeoPackage and then pointing forty concurrent conversion workers at one file produces `database is locked` errors, because SQLite serialises writers. Standardising on PostGIS for a job that produces one file a week that a client needs to open on a laptop adds a server dependency to a problem that never had one. The guide scores both on concurrency, indexing, deployment footprint, and query capability, and links to the [writing CAD geometry to PostGIS with GeoAlchemy2](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/geopackage-vs-postgis-for-cad-output/writing-cad-geometry-to-postgis-with-geoalchemy2/) walkthrough for the server-backed path.

## Implementation Patterns

The decisions above are easier to make when you can see the capability differences in code rather than in prose. The pattern that recurs across all three guides is a *capability probe*: before committing a file to a route, ask the candidate tools what they can actually do with it, and route on the answer. The following comparison illustrates the coverage gap that drives the library decision. `ezdxf` opens DXF directly; DWG must go through a converter first.

```python
# ezdxf>=1.1.0 | python>=3.9
import shutil
import subprocess
from pathlib import Path

import ezdxf


def read_cad(path: Path) -> ezdxf.document.Drawing:
    """Open a CAD file, converting DWG to DXF first when needed.

    Demonstrates the coverage boundary: ezdxf handles .dxf natively,
    but .dwg requires an external converter (ODA File Converter here).
    """
    suffix = path.suffix.lower()
    if suffix == ".dxf":
        return ezdxf.readfile(str(path))
    if suffix == ".dwg":
        dxf_path = _convert_dwg_to_dxf(path)
        return ezdxf.readfile(str(dxf_path))
    raise ValueError(f"Unsupported CAD source: {suffix!r}")


def _convert_dwg_to_dxf(dwg_path: Path) -> Path:
    """Drive ODAFileConverter headlessly; falls back with a clear error."""
    if shutil.which("ODAFileConverter") is None:
        raise RuntimeError(
            "DWG input requires the ODA File Converter on PATH. "
            "ezdxf cannot read DWG directly."
        )
    out_dir = dwg_path.parent / "_dxf"
    out_dir.mkdir(exist_ok=True)
    # xvfb-run supplies a virtual display for the Qt-based GUI binary.
    subprocess.run(
        [
            "xvfb-run", "-a", "ODAFileConverter",
            str(dwg_path.parent), str(out_dir),
            "ACAD2018", "DXF", "0", "1", dwg_path.name,
        ],
        check=True,
    )
    return out_dir / (dwg_path.stem + ".dxf")
```

The same probe-then-route pattern applies to the format decision. Before assuming an IFC-to-GIS route can carry the attributes a consumer needs, check that the property sets are present; before assuming DXF is enough, confirm the consumer only needs geometry. A short capability comparison across the three routes clarifies where each one earns its place:

| Capability | ezdxf (DXF) | ifcopenshell (IFC) | GDAL/OGR (GIS) |
|---|---|---|---|
| Pure-Python, no binary dep | Yes | No (C++ kernel) | No (C++ lib) |
| Reads DWG natively | No | No | No |
| Carries building semantics | No | Yes (object graph) | Partial (attributes) |
| Native CRS / georeferencing | No | Optional (`IfcMapConversion`) | Yes (per-layer CRS) |
| Writes GeoPackage / PostGIS | No (via conversion) | No (via conversion) | Yes (native driver) |
| Typical role in the flow | geometry interchange | semantic source | storage + reprojection |

Read across the rows and the division of labour is obvious: no single tool spans the whole flow, which is precisely why these are decisions and not defaults. `ezdxf` owns geometry interchange, `ifcopenshell` owns semantics, and GDAL/OGR owns the storage boundary and reprojection. A production pipeline composes all three, and the guides in this section tell you which one to reach for at each hop.

## Decision Matrix & Troubleshooting

When a route is already chosen and misbehaving, the symptom usually points back to a decision made a stage earlier. The table below maps the common production symptoms to the decision that caused them and the corrective route.

<!-- fig:decisions-cost-of-lateness -->
<svg viewBox="-20 -20 671.1 144.4" role="img" aria-label="Unreadable files, lost property sets, slow spatial queries and misplaced assets each trace back to an earlier interoperability decision" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:671px;display:block;margin:1.5rem auto;">
  <title>Symptoms that point back to an earlier decision</title>
  <desc>Four production symptoms and the decision each one actually traces to. None of them announce themselves at the stage where they appear: an unreadable file is a read-route decision, a lost property set is an interchange decision, a slow spatial query is a storage decision, and a misplaced asset is a coordinate decision made before any of them.</desc>
  <defs>
    <marker id="idg2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="idg2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="671.1" height="144.4" fill="var(--color-surface)"/>
  <rect x="230.6" y="17.4" width="170" height="69.6" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="315.6" y="41.7" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">The symptom</text>
  <text x="315.6" y="55.4" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">is never where</text>
  <text x="315.6" y="68.8" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">the decision was</text>
  <rect x="0" y="0" width="160.6" height="44.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="80.3" y="18.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Cannot read the file</text>
  <text x="80.3" y="32" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">→ read route</text>
  <path d="M 160.6 22.1 L 208.6 22.1 L 208.6 52.2 L 230.6 52.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.7" marker-end="url(#idg2-a)" stroke-linejoin="round"/>
  <rect x="0" y="60.2" width="160.6" height="44.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="80.3" y="78.5" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Property sets missing</text>
  <text x="80.3" y="92.2" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">→ interchange</text>
  <path d="M 160.6 82.3 L 208.6 82.3 L 208.6 52.2 L 230.6 52.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.7" marker-end="url(#idg2-a)" stroke-linejoin="round"/>
  <rect x="470.6" y="0" width="160.6" height="44.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="550.9" y="18.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Spatial query is slow</text>
  <text x="550.9" y="32" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">→ storage target</text>
  <path d="M 400.6 52.2 L 448.6 52.2 L 448.6 22.1 L 470.6 22.1" fill="none" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.7" marker-end="url(#idg2-a)" stroke-linejoin="round"/>
  <rect x="470.6" y="60.2" width="160.6" height="44.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="550.9" y="78.5" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Asset in the wrong place</text>
  <text x="550.9" y="92.2" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">→ CRS handling</text>
  <path d="M 400.6 52.2 L 448.6 52.2 L 448.6 82.3 L 470.6 82.3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.7" marker-end="url(#idg2-a)" stroke-linejoin="round"/>
</svg>
<!-- /fig:decisions-cost-of-lateness -->

| Symptom | Root Cause | Fix |
|---|---|---|
| `ezdxf.readfile()` raises on a `.dwg` input | ezdxf has no DWG reader; wrong library for the source | Route DWG through a converter first — see [Choosing ezdxf, pydwg, or ODA for Production](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-ezdxf-pydwg-or-oda-for-production/) |
| DWG converts but proxy entities are empty | Custom objects from vertical products are not decodable | Request native export or explode proxies; handle per [DWG Proprietary Limitations](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/) |
| GIS features have geometry but no storey / property data | DXF chosen as interchange; semantics never carried | Switch the route to IFC — see [DXF vs IFC for GIS Ingestion](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/dxf-vs-ifc-for-gis-ingestion/) |
| Features land at 0,0 or in the ocean | No CRS applied; interchange format carried no georeferencing | Apply unit scale then reproject — see [CRS Normalization Workflows](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/) |
| `database is locked` under batch load | Concurrent writers against a single-file GeoPackage | Move to a server target — see [GeoPackage vs PostGIS for CAD Output](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/geopackage-vs-postgis-for-cad-output/) |
| ODA converter hangs on a headless runner | GUI binary has no display available | Wrap the call in `xvfb-run -a` as shown above |
| IFC parse is far slower than expected | Geometry kernel evaluating solids you never use | Read attributes only, or fall back to a DXF route for 2D needs |

The pattern across every row is the same: the fix is rarely a patch to the failing stage. It is a reconsideration of a decision made upstream. A locked database is not a database bug; it is a storage-target decision that did not account for concurrency. Missing property data is not a parser bug; it is an interchange-format decision that discarded semantics. Treating symptoms as decision feedback is what keeps a pipeline from accumulating workarounds.

## Production Deployment Considerations

### Licensing as an architecture constraint

The single most consequential deployment fact in this domain is that reliable DWG reading is not free. The ODA File Converter is redistributable under a registration agreement, and the Teigha/ODA SDK is a commercial licence. That constraint has to be settled at design time, not discovered at deployment, because it determines whether your pipeline can be a pure-Python container that scales horizontally with no per-node cost, or whether every worker node carries a licensed binary and its activation. When DWG is unavoidable, budget for the licence and isolate the conversion step so the rest of the pipeline stays licence-free.

### Headless and CI suitability

Interoperability jobs increasingly run in containers and CI, where there is no display, no interactive activation, and a hard time budget. Pure-Python tools like `ezdxf` and the `ifcopenshell` and GDAL wheels install cleanly and run headless. GUI-derived binaries such as the ODA converter need a virtual framebuffer (`xvfb-run`) and a writable working directory. Validate that every tool in a chosen route runs unattended before committing to it — a route that only works on a developer's desktop is not a production route.

### Regression-testing the decision

A decision that was correct at selection can rot as inputs change. Encode the assumptions as tests: assert that the parser opens a corpus of real files, that the interchange format still carries the attributes a consumer contracts for, and that the storage target ingests within its throughput budget. Commit reference files for each supported source format and version, and fail the build when coverage or fidelity regresses. This turns an informal decision into an enforced contract, which is the only form of decision that survives a library upgrade six months later.

### The cost of changing each decision later

The three decisions are not equally expensive to revisit, and knowing the ordering is what makes it reasonable to defer one and unreasonable to defer another.

Changing the **storage target** is the cheapest. The converted geometry already exists in a normalised in-memory form; a second writer is a new function against the same records, and the two targets can run side by side during a migration. Teams routinely move from GeoPackage to PostGIS when a second consumer appears, and the change touches the last stage only.

Changing the **interchange representation** is moderately expensive, because it changes what the pipeline is able to say. Moving from a linework route to a typed-product route is not a swap of parsers; it is a different extraction, a different attribute model, and usually a different source deliverable requested from the design team. Budget weeks, not hours, and expect the request to the design team to be the long pole.

Changing the **read route** is the expensive one, and it is expensive for reasons that are not technical. Introducing a licensed converter into a pipeline that assumed pure Python adds a binary to every container image, a licence to whatever governs redistribution, a subprocess to supervise, and a failure mode — the converter that exits zero having written nothing — that the rest of the pipeline was not built to notice. This asymmetry is the reason the read route is settled first: it is the decision least amenable to being revisited under time pressure, and the one whose constraints the other two have to live within.

### Deciding once, and recording why

A decision that is not written down is remade, usually by someone who was not in the room, usually under deadline. Each of the three deserves a short record: what was chosen, what the alternative was, and — the part that actually pays for itself — the observation that would justify revisiting it. "PostGIS, because a second team needs concurrent read access; revisit if that team goes away and the artefact becomes a handover" is a decision a successor can evaluate. "PostGIS" is not.

The revisit conditions are usually concrete and worth naming explicitly: a delivery arriving in a DWG release the current converter does not cover, a consumer appearing who needs property sets the linework route never carried, a query pattern that a single-file store cannot serve. Each of those is a signal that a specific decision has expired, rather than a general sense that the pipeline is struggling — and a signal attached to a decision is what turns a rewrite into an amendment.

### Reversibility

Favour routes that are cheap to change. Writing an intermediate DXF or GeoJSON artifact between stages costs disk but buys the ability to re-run the storage step without re-reading the source, to swap PostGIS for GeoPackage without touching the parser, or to add an IFC route alongside a DXF one. The staged architecture in the diagram above is not just conceptual; materialising the boundaries as files is what makes a decision reversible instead of load-bearing.

## Conclusion

Interoperability is a sequence of three decisions — which library, which interchange format, which storage target — and the cost of getting each one wrong is measured in weeks of rework and, worse, in silently corrupted data that no exception ever flagged. The decisions are not matters of taste. Each has a small set of measurable variables — coverage, fidelity, licensing, and operational fit — and a defensible answer once those variables are named for a specific project. Read the source-outward: establish what you can read, then what you can faithfully carry, then where it can live, and materialise the boundaries between those stages so the whole chain stays reversible. The guides in this section take each decision in turn, score the real options against real constraints, and give the runnable code that turns a design-review argument into a tested pipeline.

---

## Related Pages

- [Choosing ezdxf, pydwg, or ODA for Production](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-ezdxf-pydwg-or-oda-for-production/) — the library decision: pure-Python DXF, community DWG readers, and licensed ODA conversion compared
- [DXF vs IFC for GIS Ingestion](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/dxf-vs-ifc-for-gis-ingestion/) — the interchange-format decision: geometry-first DXF versus semantics-first IFC for GIS consumers
- [GeoPackage vs PostGIS for CAD Output](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/geopackage-vs-postgis-for-cad-output/) — the storage decision: single-file GeoPackage versus a concurrent PostGIS server
- [Python Parsing & Geometry Extraction](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/) — the extraction mechanics every route in this section depends on
- [Coordinate Transformation & Spatial Alignment](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/) — the unit conversion and reprojection between parsing and storage
- [Core Format Fundamentals & Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/) — what DXF, IFC, and DWG can and cannot represent
- [Choosing a Geometry Engine for Python Pipelines](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-a-geometry-engine-for-python-pipelines/) — Shapely, trimesh or OpenCASCADE — the decision that governs everything between read and write
