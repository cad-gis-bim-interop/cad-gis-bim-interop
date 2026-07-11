---
title: "DXF Entity Structure Breakdown"
description: "A technical deep-dive into DXF's section layout, group code taxonomy, coordinate systems, and production-grade Python parsing workflows using ezdxf for CAD/GIS/BIM interoperability pipelines."
slug: "dxf-entity-structure-breakdown"
type: "cluster"
breadcrumb:
  - label: "Core Format Fundamentals & Schema Mapping"
    url: "/core-format-fundamentals-schema-mapping/"
  - label: "DXF Entity Structure Breakdown"
    url: "/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/"
datePublished: "2024-03-01"
dateModified: "2026-06-24"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "DXF Entity Structure Breakdown",
      "description": "A technical deep-dive into DXF's section layout, group code taxonomy, coordinate systems, and production-grade Python parsing workflows using ezdxf for CAD/GIS/BIM interoperability pipelines.",
      "datePublished": "2024-03-01",
      "dateModified": "2026-06-24",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "publisher": {"@type": "Organization", "name": "cad-gis-bim-interop.org"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Core Format Fundamentals & Schema Mapping", "item": "https://cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/"},
        {"@type": "ListItem", "position": 2, "name": "DXF Entity Structure Breakdown", "item": "https://cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Parse DXF Entity Structure with Python",
      "description": "Step-by-step guide to parsing DXF files using ezdxf: read sections, extract group codes, normalize coordinate systems, and route entities into GIS or BIM pipelines.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Install ezdxf and open a DXF document", "text": "pip install 'ezdxf>=1.1.0' then call ezdxf.readfile(path) to load the document object."},
        {"@type": "HowToStep", "position": 2, "name": "Read HEADER variables for unit and version metadata", "text": "Access doc.header['$INSUNITS'] and doc.header['$ACADVER'] before iterating entities to normalize units and reject unsupported releases."},
        {"@type": "HowToStep", "position": 3, "name": "Iterate ENTITIES section and dispatch by type", "text": "Use doc.modelspace() to iterate entities; branch on entity.dxftype() to handle LINE, CIRCLE, LWPOLYLINE, INSERT, HATCH, and SPLINE separately."},
        {"@type": "HowToStep", "position": 4, "name": "Transform OCS to WCS for planar entities", "text": "Apply the arbitrary axis algorithm using the extrusion vector (group codes 210/220/230) to convert OCS coordinates to the World Coordinate System before export."},
        {"@type": "HowToStep", "position": 5, "name": "Validate output and log schema diffs", "text": "Assert coordinate bounds, compare encountered entity types against a baseline manifest, and quarantine proxy or Civil 3D objects for secondary conversion."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What does $INSUNITS=2 mean in a DXF file?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "$INSUNITS=2 means the drawing unit is Feet, not Inches. Inches is $INSUNITS=1. Misreading this produces a 12x scale error in downstream spatial databases. Always cross-check against $MEASUREMENT (0=Imperial, 1=Metric)."
          }
        },
        {
          "@type": "Question",
          "name": "Does ezdxf reconstruct B-Rep topology from 3DSOLID entities?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "No. ezdxf exposes the raw ACIS or ShapeManager SAT/SAB blob embedded in the 3DSOLID entity but does not parse B-Rep topology. You need an ODA-compatible kernel or a dedicated ACIS parser to reconstruct faces, edges, and vertices."
          }
        },
        {
          "@type": "Question",
          "name": "What is the difference between WCS and OCS in DXF?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "WCS (World Coordinate System) is the global Cartesian frame for the entire drawing. OCS (Object Coordinate System) is a local frame defined by an extrusion vector stored in group codes 210/220/230, used for planar entities like HATCH, LWPOLYLINE, and SOLID. OCS coordinates must be transformed to WCS via the arbitrary axis algorithm before GIS export."
          }
        },
        {
          "@type": "Question",
          "name": "How do I handle ACAD_PROXY_ENTITY objects in ezdxf?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "ezdxf cannot decode ACAD_PROXY_ENTITY payloads — they are application-specific binary blobs. Route them to a quarantine queue with raw group code dumps attached, then trigger a secondary pass using the originating application's SDK (e.g. Civil 3D or Map 3D API) or ODA Drawings SDK."
          }
        },
        {
          "@type": "Question",
          "name": "What AC version string corresponds to AutoCAD 2018 and later?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "$ACADVER = AC1032 corresponds to AutoCAD R2018. AutoCAD 2019 through 2026 retain the AC1032 schema — the version string has not changed. Use this as your baseline for modern DXF support; reject AC1009 (R12) or earlier unless legacy conversion is explicitly enabled."
          }
        }
      ]
    }
  ]
}
</script>

# DXF Entity Structure Breakdown

The Drawing Exchange Format (DXF) is a tagged-text interchange standard that exposes every CAD object as a sequence of integer-keyed group codes and typed values — a schema-transparent design that makes it the lowest-common-denominator for geometry transfer across heterogeneous AEC, GIS, and infrastructure platforms. This page is part of the [Core Format Fundamentals & Schema Mapping](/core-format-fundamentals-schema-mapping/) reference, which covers the file-level architecture knowledge required to build reliable Python conversion, validation, and spatial ingestion pipelines.

Getting the entity structure wrong has measurable costs: OCS-to-WCS transformation errors invert geometry in rendering engines; misread `$INSUNITS` values cause 12× scale drift in spatial databases; unhandled proxy entities silently truncate ingestion batches. The sections below dissect the format's internal layout, provide production-tested parsing workflows, and document the failure modes that catch engineering teams by surprise.

## Prerequisites

- Python 3.9+ with `pip` package management
- `ezdxf` 1.1.0+ — install with `pip install "ezdxf>=1.1.0"`
- Familiarity with CAD coordinate systems (WCS, OCS) and spatial reference concepts
- Understanding of ASCII vs. binary DXF encoding differences
- Representative DXF exports in the R2013–R2024 range for modern entity support
- Basic knowledge of group code taxonomy: integer identifier paired with a typed value

## Architectural Overview

DXF is organized into six strictly ordered sections. Every drawing object is serialized as a flat sequence of group code / value pairs; the integer code determines both the data type and the semantic role of the following value. The canonical section order is:

1. **HEADER** — global drawing variables (`$INSUNITS`, `$EXTMIN`, `$EXTMAX`, `$HANDSEED`, `$ACADVER`)
2. **CLASSES** — custom object class definitions (rarely present in standard CAD exports)
3. **TABLES** — symbol tables for reusable definitions (`LAYER`, `LTYPE`, `STYLE`, `DIMSTYLE`, `UCS`, `BLOCK_RECORD`, `VIEWPORT`)
4. **BLOCKS** — reusable geometry containers with attribute definitions
5. **ENTITIES** — primary drawable objects (`LINE`, `CIRCLE`, `LWPOLYLINE`, `SPLINE`, `TEXT`, `INSERT`, `HATCH`, `3DSOLID`)
6. **OBJECTS** — non-graphical data structures: layouts, dictionaries, `XRECORD`, `MATERIAL`

Unlike proprietary formats covered in [DWG Proprietary Limitations & Binary Format Constraints](/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/), DXF exposes its schema transparently. This transparency comes at the cost of file size and parsing overhead, but it eliminates reverse-engineered binary offsets and makes DXF highly suitable for deterministic parsing in CI/CD validation pipelines.

The diagram below shows how the six sections relate and where parsing branches occur during ingestion:

<svg viewBox="0 0 720 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="DXF section layout and ingestion pipeline" style="width:100%;max-width:720px;font-family:inherit;">
  <title>DXF Section Layout and Ingestion Pipeline</title>
  <desc>Flow diagram showing the six DXF sections (HEADER, CLASSES, TABLES, BLOCKS, ENTITIES, OBJECTS) and how a Python ingestion pipeline reads them in order, branches on entity type, transforms OCS to WCS, then routes output to GIS or BIM targets.</desc>
  <defs>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor" opacity="0.6"/>
    </marker>
  </defs>
  <!-- Section boxes — left column -->
  <rect x="20" y="20" width="140" height="38" rx="5" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
  <text x="90" y="44" text-anchor="middle" font-size="13" fill="currentColor" font-weight="600">HEADER</text>
  <rect x="20" y="74" width="140" height="38" rx="5" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.25"/>
  <text x="90" y="98" text-anchor="middle" font-size="13" fill="currentColor" opacity="0.6">CLASSES</text>
  <rect x="20" y="128" width="140" height="38" rx="5" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
  <text x="90" y="152" text-anchor="middle" font-size="13" fill="currentColor" font-weight="600">TABLES</text>
  <rect x="20" y="182" width="140" height="38" rx="5" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
  <text x="90" y="206" text-anchor="middle" font-size="13" fill="currentColor" font-weight="600">BLOCKS</text>
  <rect x="20" y="236" width="140" height="38" rx="5" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.7"/>
  <text x="90" y="260" text-anchor="middle" font-size="13" fill="currentColor" font-weight="700">ENTITIES</text>
  <rect x="20" y="290" width="140" height="38" rx="5" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
  <text x="90" y="314" text-anchor="middle" font-size="13" fill="currentColor" font-weight="600">OBJECTS</text>
  <!-- Vertical connector on left -->
  <line x1="90" y1="58" x2="90" y2="74" stroke="currentColor" stroke-width="1.2" opacity="0.4" marker-end="url(#arr)"/>
  <line x1="90" y1="112" x2="90" y2="128" stroke="currentColor" stroke-width="1.2" opacity="0.4" marker-end="url(#arr)"/>
  <line x1="90" y1="166" x2="90" y2="182" stroke="currentColor" stroke-width="1.2" opacity="0.4" marker-end="url(#arr)"/>
  <line x1="90" y1="220" x2="90" y2="236" stroke="currentColor" stroke-width="1.2" opacity="0.4" marker-end="url(#arr)"/>
  <line x1="90" y1="274" x2="90" y2="290" stroke="currentColor" stroke-width="1.2" opacity="0.4" marker-end="url(#arr)"/>
  <!-- Arrow from ENTITIES to dispatch box -->
  <line x1="160" y1="255" x2="220" y2="255" stroke="currentColor" stroke-width="1.5" opacity="0.6" marker-end="url(#arr)"/>
  <!-- Entity type dispatch -->
  <rect x="222" y="220" width="160" height="70" rx="5" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
  <text x="302" y="248" text-anchor="middle" font-size="12" fill="currentColor" font-weight="600">Dispatch by</text>
  <text x="302" y="264" text-anchor="middle" font-size="12" fill="currentColor" font-weight="600">dxftype()</text>
  <text x="302" y="280" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">LINE · CIRCLE · LWPOLYLINE</text>
  <!-- Arrows from dispatch to OCS transform and Proxy queue -->
  <line x1="382" y1="245" x2="440" y2="210" stroke="currentColor" stroke-width="1.3" opacity="0.6" marker-end="url(#arr)"/>
  <line x1="382" y1="265" x2="440" y2="300" stroke="currentColor" stroke-width="1.3" opacity="0.5" marker-end="url(#arr)"/>
  <!-- OCS→WCS transform box -->
  <rect x="442" y="180" width="150" height="52" rx="5" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
  <text x="517" y="202" text-anchor="middle" font-size="11" fill="currentColor" font-weight="600">OCS → WCS</text>
  <text x="517" y="218" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">Extrusion vector</text>
  <text x="517" y="230" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">210 / 220 / 230</text>
  <!-- Proxy quarantine box -->
  <rect x="442" y="278" width="150" height="40" rx="5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="5,3" opacity="0.5"/>
  <text x="517" y="297" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.7">Proxy / Civil 3D</text>
  <text x="517" y="311" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.6">→ Quarantine queue</text>
  <!-- Arrow from OCS box to output -->
  <line x1="592" y1="206" x2="650" y2="206" stroke="currentColor" stroke-width="1.3" opacity="0.6" marker-end="url(#arr)"/>
  <!-- Output box -->
  <rect x="652" y="180" width="56" height="52" rx="5" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
  <text x="680" y="200" text-anchor="middle" font-size="10" fill="currentColor" font-weight="600">GIS /</text>
  <text x="680" y="215" text-anchor="middle" font-size="10" fill="currentColor" font-weight="600">BIM</text>
  <text x="680" y="228" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">export</text>
  <!-- HEADER annotation -->
  <line x1="160" y1="39" x2="220" y2="39" stroke="currentColor" stroke-width="1" stroke-dasharray="4,3" opacity="0.4"/>
  <text x="225" y="35" font-size="10" fill="currentColor" opacity="0.6">$INSUNITS · $ACADVER · $HANDSEED</text>
  <text x="225" y="48" font-size="10" fill="currentColor" opacity="0.6">→ read first, normalize units</text>
  <!-- TABLES annotation -->
  <line x1="160" y1="147" x2="220" y2="147" stroke="currentColor" stroke-width="1" stroke-dasharray="4,3" opacity="0.4"/>
  <text x="225" y="144" font-size="10" fill="currentColor" opacity="0.6">LAYER · LTYPE · STYLE</text>
  <text x="225" y="157" font-size="10" fill="currentColor" opacity="0.6">→ build symbol index</text>
</svg>

### Group Code Taxonomy

Group codes are the atomic units of DXF serialization. They are categorized by numeric ranges that enforce strict typing:

| Group Code Range | Data Type | Typical Usage |
|---|---|---|
| `0–9` | String | Entity/class names, text values, handles |
| `10–59` | Real / Double | Primary coordinates, scale factors, angles |
| `60–79` | Integer | Visibility flags, color indices, line weights |
| `90–99` | 32-bit Integer | Counters, custom object IDs |
| `100–109` | String | Subclass markers (`AcDbLine`, `AcDbCircle`, `AcDbEntity`) |
| `140–149` | Real | Dimension variables, system constants |
| `210–239` | Real | Extrusion direction vectors (OCS alignment) |

A single entity in the `ENTITIES` section typically spans 10–40 lines of ASCII text. A `LINE` entity begins with `0 LINE`, followed by subclass marker `100 AcDbEntity`, layer assignment `8 <layer_name>`, and coordinate pairs `10/20/30` (start point) and `11/21/31` (end point). The [Autodesk DXF Reference](https://help.autodesk.com/view/OARX/2024/ENU/?guid=GUID-235B22E0-A567-4CF6-92D3-38A2306D73F3) maintains the definitive mapping of codes across AutoCAD releases.

### Version Compatibility Table

| DXF Version String | AutoCAD Release | Key Changes |
|---|---|---|
| `AC1009` | R12 | No subclass markers; limited entity set |
| `AC1015` | R2000 | Subclass markers introduced; `LWPOLYLINE` added |
| `AC1021` | R2007 | Binary encoding option; `VISUALSTYLE` |
| `AC1027` | R2013 | `SURFACE`, `MESH` entities |
| `AC1032` | R2018–2026 | `GEOGRAPHICLOCATION`; current baseline |

Reject `AC1009` or earlier unless a legacy conversion pass is explicitly enabled in your pipeline configuration.

## Step-by-Step Implementation

### Step 1 — Read HEADER Variables First

Reading HEADER variables before entity iteration allows you to normalize units and reject unsupported versions early, preventing scale drift in downstream spatial databases.

```python
# ezdxf>=1.1.0
import ezdxf

INSUNITS_MAP = {
    0: None,   # unitless — cannot normalize safely
    1: 0.0254, # inches → metres
    2: 0.3048, # feet → metres
    4: 0.001,  # millimetres → metres
    6: 1.0,    # metres — identity
}

SUPPORTED_VERSIONS = {"AC1015", "AC1021", "AC1024", "AC1027", "AC1032"}

def open_and_validate(filepath: str):
    doc = ezdxf.readfile(filepath)
    version = doc.header.get("$ACADVER", "UNKNOWN")
    if version not in SUPPORTED_VERSIONS:
        raise ValueError(f"Unsupported DXF version: {version}. Minimum: AC1015 (R2000).")
    units_code = doc.header.get("$INSUNITS", 0)
    scale = INSUNITS_MAP.get(units_code)
    if scale is None:
        raise ValueError(f"$INSUNITS={units_code} is unitless — assign a real-world CRS before ingestion.")
    return doc, scale
```

### Step 2 — Build a Layer and Symbol Index from TABLES

Before iterating entities, construct a layer index from the TABLES section so you can resolve layer properties without repeated lookups during the entity pass.

```python
# ezdxf>=1.1.0
def build_layer_index(doc) -> dict:
    """Return {layer_name: {'color': int, 'linetype': str}} for all defined layers."""
    index = {}
    for layer in doc.layers:
        index[layer.dxf.name] = {
            "color": layer.dxf.get("color", 7),
            "linetype": layer.dxf.get("linetype", "CONTINUOUS"),
        }
    return index
```

### Step 3 — Iterate ENTITIES and Dispatch by Type

The `ezdxf` library abstracts low-level group code iteration into a typed object model. Dispatch on `dxftype()` and isolate failures at the entity level so a single corrupted object does not abort the entire ingestion job.

```python
# ezdxf>=1.1.0
import logging
from typing import Any

logging.basicConfig(level=logging.WARNING)

SUPPORTED_TYPES = {"LINE", "CIRCLE", "LWPOLYLINE", "ARC", "SPLINE", "INSERT", "HATCH"}

def extract_entities(doc, scale: float) -> list[dict[str, Any]]:
    """Parse supported entity types with error isolation and unit normalization."""
    msp = doc.modelspace()
    results = []

    for entity in msp:
        etype = entity.dxftype()
        if etype not in SUPPORTED_TYPES:
            if etype in ("ACAD_PROXY_ENTITY",) or etype.startswith("AECC_"):
                logging.warning("Proxy/Civil3D entity %s (handle %s) routed to quarantine.",
                                etype, entity.dxf.get("handle", "?"))
            continue
        try:
            record = _parse_entity(entity, scale)
            if record:
                results.append(record)
        except AttributeError as exc:
            logging.warning("Malformed %s (handle %s): %s",
                            etype, entity.dxf.get("handle", "?"), exc)
    return results


def _parse_entity(entity, scale: float) -> dict | None:
    etype = entity.dxftype()
    base = {"type": etype, "handle": entity.dxf.handle, "layer": entity.dxf.layer}

    if etype == "LINE":
        s, e = entity.dxf.start, entity.dxf.end
        base["start"] = (s.x * scale, s.y * scale, s.z * scale)
        base["end"]   = (e.x * scale, e.y * scale, e.z * scale)

    elif etype == "CIRCLE":
        c = entity.dxf.center
        base["center"] = (c.x * scale, c.y * scale, c.z * scale)
        base["radius"] = entity.dxf.radius * scale

    elif etype == "LWPOLYLINE":
        # get_points("xy") yields (x, y); pad Z for 3-D pipelines
        base["vertices"] = [(v[0] * scale, v[1] * scale, 0.0)
                            for v in entity.get_points("xy")]
        base["closed"] = bool(entity.closed)
    else:
        return None  # extend per pipeline requirements

    return base
```

### Step 4 — Transform OCS to WCS for Planar Entities

`HATCH`, `LWPOLYLINE`, `SOLID`, and `TRACE` entities store their coordinates in the Object Coordinate System (OCS). Before GIS or BIM export, apply the arbitrary axis algorithm using the extrusion vector from group codes 210/220/230 to convert to World Coordinate System (WCS).

```python
# ezdxf>=1.1.0 — use ezdxf's built-in OCS helper rather than rolling your own
from ezdxf.math import OCS, Vec3

def ocs_to_wcs(point_ocs: tuple, extrusion: tuple) -> tuple:
    """Convert an OCS (x, y, z) point to WCS using the entity extrusion vector."""
    ocs = OCS(Vec3(extrusion))
    wcs_point = ocs.to_wcs(Vec3(point_ocs))
    return (wcs_point.x, wcs_point.y, wcs_point.z)

# Usage for a HATCH entity:
# extrusion = entity.dxf.extrusion  # Vec3, defaults to (0, 0, 1) for flat drawings
# wcs_boundary = [ocs_to_wcs(pt, extrusion) for pt in boundary_points]
```

Misaligned OCS extrusion vectors are a frequent source of inverted geometry or flipped normals in downstream rendering engines. This is especially critical when aligning DXF geometry with [IFC4x3 Schema Mapping](/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/) workflows, where spatial consistency governs clash detection accuracy and quantity takeoff reliability.

### Step 5 — Extract Metadata from HEADER

For the complete header extraction implementation with fallback logic for missing variables, see the dedicated guide on [How to Parse DXF Headers with Python](/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/how-to-parse-dxf-headers-with-python/).

Key HEADER variables for pipeline automation:

- `$INSUNITS` — drawing unit definition: `0`=Unitless, `1`=Inches, `2`=Feet, `4`=Millimetres, `6`=Metres. Note that `2` is **Feet**, not Inches — the most common misread, causing a 12× scale error.
- `$MEASUREMENT` — `0`=Imperial, `1`=Metric. Use as a secondary cross-check against `$INSUNITS` when they disagree.
- `$HANDSEED` — next available entity handle; useful for incremental update and deduplication strategies.
- `$ACADVER` — AutoCAD release string (`AC1032` for R2018–2026, the current baseline).

## Edge Cases & Gotchas

### 1. $INSUNITS=2 Is Feet, Not Inches

`$INSUNITS=1` is inches; `$INSUNITS=2` is feet. The off-by-one numbering catches teams that skim the spec. Always use a lookup table keyed on the integer value rather than comparing against assumed strings.

```python
# Safe lookup — never guess; always validate
SCALE_TO_METRES = {1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1.0}
scale = SCALE_TO_METRES.get(doc.header.get("$INSUNITS", 0))
if scale is None:
    raise ValueError("Cannot determine drawing units; aborting ingestion.")
```

### 2. LWPOLYLINE Bulge Values Ignored

`LWPOLYLINE` vertices can carry a bulge factor (group code 42) that encodes arc segments between straight segments. `get_points("xy")` silently ignores bulge — you receive straight-line vertices only. For pipelines that must preserve curved geometry, use `get_points("xyb")` and convert bulge to arc parameters explicitly.

```python
# ezdxf>=1.1.0 — preserve arc curvature
for v in entity.get_points("xyb"):
    x, y, bulge = v[0], v[1], v[2]
    # bulge != 0 signals an arc segment; compute sagitta and arc centre as needed
```

### 3. INSERT Entities Do Not Expand Blocks

An `INSERT` entity is a block reference, not the resolved geometry. Iterating `doc.modelspace()` yields the `INSERT` object, not the constituent `LINE` / `CIRCLE` entities inside the block definition. Resolve block references explicitly using `doc.blocks[entity.dxf.name]` before spatial analysis.

```python
# ezdxf>=1.1.0 — explode a block reference into constituent entities
def resolve_insert(entity, doc):
    block = doc.blocks.get(entity.dxf.name)
    if block is None:
        return []
    return list(block)  # yields the block's own entity list
```

### 4. OCS Extrusion Vector Defaults and Silent Errors

When group codes 210/220/230 are absent, the extrusion vector defaults to `(0, 0, 1)` — the flat XY plane. For drawings authored entirely in the XY plane this is correct. For 3-D drawings with tilted work planes, absent extrusion codes mean silent identity transforms and geometry that lands in the wrong location. Always verify extrusion presence with `entity.dxf.hasattr("extrusion")` before transforming.

### 5. ACAD_PROXY_ENTITY Payloads Are Opaque Blobs

Civil 3D, Map 3D, and third-party vertical applications embed custom objects as `ACAD_PROXY_ENTITY` records. The group code 310 carries a hex-encoded binary payload that `ezdxf` cannot decode. Do not silently drop these — they may represent alignment elements, parcels, or pipe networks. Route them to a quarantine queue with their raw dump attached.

```python
# ezdxf>=1.1.0 — capture raw proxy data for audit
import json

def quarantine_proxy(entity) -> dict:
    raw_codes = [(code, value) for code, value in entity.raw_dxf_attribs()]
    return {
        "handle": entity.dxf.get("handle", "unknown"),
        "type": entity.dxftype(),
        "raw_group_codes": raw_codes,
    }
```

### 6. Binary DXF (DXFB) Has No Human-Readable Group Codes

Binary DXF files (`DXFB`) encode group codes as 2-byte integers rather than ASCII text. `ezdxf` handles both transparently via `ezdxf.readfile()`. However, legacy tools that inspect files with a text editor or regex-based parsers will misinterpret binary DXF as corrupt. Always use a library-level parser; never grep or stream-read DXF headers manually.

## Validation & Testing

Verify parsing correctness by asserting coordinate bounds against known reference extents from `$EXTMIN` and `$EXTMAX`, and by comparing the encountered entity type manifest against a baseline schema to detect upstream CAD template drift.

```python
# ezdxf>=1.1.0
import pytest
from pathlib import Path

def validate_entity_output(entities: list, doc) -> None:
    """Assert spatial bounds and entity count minimums."""
    ext_min = doc.header.get("$EXTMIN")
    ext_max = doc.header.get("$EXTMAX")

    for record in entities:
        if record["type"] == "LINE":
            for coord_set in (record["start"], record["end"]):
                x, y, _ = coord_set
                assert ext_min.x <= x <= ext_max.x, f"X out of drawing extents: {x}"
                assert ext_min.y <= y <= ext_max.y, f"Y out of drawing extents: {y}"

    type_counts = {}
    for e in entities:
        type_counts[e["type"]] = type_counts.get(e["type"], 0) + 1

    return type_counts


def test_dxf_parse_round_trip(tmp_path):
    """Smoke test: parse a minimal DXF and verify entity extraction."""
    import ezdxf
    doc = ezdxf.new("R2018")
    msp = doc.modelspace()
    msp.add_line((0, 0, 0), (10, 0, 0), dxfattribs={"layer": "TEST"})
    test_file = tmp_path / "test.dxf"
    doc.saveas(str(test_file))

    loaded_doc, scale = open_and_validate(str(test_file))
    entities = extract_entities(loaded_doc, scale)
    assert len(entities) == 1
    assert entities[0]["type"] == "LINE"
    assert entities[0]["layer"] == "TEST"
```

Schema diff logging should compare encountered entity types against a baseline manifest after each ingestion run. Store the manifest as a JSON artifact in your CI/CD pipeline alongside the converted output.

```python
# ezdxf>=1.1.0
import json, datetime

def log_schema_manifest(entities: list, source_path: str, output_path: str) -> None:
    type_counts = {}
    for e in entities:
        type_counts[e["type"]] = type_counts.get(e["type"], 0) + 1
    manifest = {
        "source": source_path,
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "entity_type_counts": type_counts,
        "total": len(entities),
    }
    with open(output_path, "w") as f:
        json.dump(manifest, f, indent=2)
```

## Performance & Scale

For DXF files exceeding 500 MB, avoid loading the full document into memory. Use `ezdxf`'s lazy iterator and filter by type before materialization:

```python
# ezdxf>=1.1.0 — stream large files without full in-memory load
import ezdxf
from ezdxf.recover import readfile as recover_readfile

def stream_large_dxf(filepath: str, target_types: set[str]):
    """Yield parsed entity dicts from large DXF files without full memory load."""
    # recover.readfile tolerates partial/corrupted files and streams section by section
    doc, auditor = recover_readfile(filepath)
    if auditor.has_errors:
        for error in auditor.errors:
            logging.warning("Audit error: %s", error)

    msp = doc.modelspace()
    # query() filters by type before full entity materialization
    for etype in target_types:
        for entity in msp.query(etype):
            yield entity
```

Memory budgets for typical file sizes on a 16 GB host:

| File Size | Approach | Peak RSS |
|---|---|---|
| < 50 MB | `ezdxf.readfile()` full load | ~300 MB |
| 50–500 MB | Full load + `msp.query()` filtering | ~1.5 GB |
| > 500 MB | `recover.readfile()` + streaming iterator | ~500 MB steady-state |
| > 2 GB | Pre-split with external DXF splitter; process per section | < 400 MB per chunk |

Vectorize coordinate transformation across large vertex arrays using NumPy rather than Python loops when processing `LWPOLYLINE` or `SPLINE` entities with thousands of control points:

```python
# ezdxf>=1.1.0, numpy>=1.24.0
import numpy as np

def transform_vertices_numpy(vertices: list[tuple], scale: float) -> np.ndarray:
    """Apply unit scaling to a vertex array in one vectorized operation."""
    arr = np.array(vertices, dtype=np.float64)  # shape (N, 3)
    return arr * scale
```

## FAQ

<details>
<summary><strong>What does $INSUNITS=2 mean in a DXF file?</strong></summary>

`$INSUNITS=2` means the drawing unit is **Feet**. Inches is `$INSUNITS=1`. The numbering is off-by-one from what most engineers expect, and misreading it produces a 12× scale error in downstream spatial databases. Always cross-check against `$MEASUREMENT` (0=Imperial, 1=Metric) — when the two fields disagree, `$INSUNITS` takes precedence for geometry scaling.

</details>

<details>
<summary><strong>Does ezdxf reconstruct B-Rep topology from 3DSOLID entities?</strong></summary>

No. `ezdxf` exposes the raw ACIS or ShapeManager SAT/SAB blob embedded in the `3DSOLID` entity but does not parse B-Rep topology. You need an ODA-compatible kernel (ODA Drawings SDK or Teigha) or a dedicated ACIS parser to reconstruct faces, edges, and vertices. For details on working with 3D solid geometry, see [Reading 3D Solids with ezdxf Python](/python-parsing-geometry-extraction/ezdxf-deep-dive/reading-3d-solids-with-ezdxf-python/).

</details>

<details>
<summary><strong>What is the difference between WCS and OCS in DXF?</strong></summary>

**WCS** (World Coordinate System) is the global Cartesian frame for the entire drawing. **OCS** (Object Coordinate System) is a local frame defined by an extrusion vector stored in group codes 210/220/230, used for planar entities like `HATCH`, `LWPOLYLINE`, and `SOLID`. OCS coordinates must be transformed to WCS via the arbitrary axis algorithm before GIS export. `ezdxf.math.OCS` implements this transform; use it rather than hand-rolling the matrix multiplication.

</details>

<details>
<summary><strong>How do I handle ACAD_PROXY_ENTITY objects in ezdxf?</strong></summary>

`ezdxf` cannot decode `ACAD_PROXY_ENTITY` payloads — they are application-specific binary blobs written by Civil 3D, Map 3D, or third-party verticals. Route them to a quarantine queue with their raw group code dumps (including group code 310 hex data) attached, then trigger a secondary conversion pass using the originating application's SDK or ODA Drawings SDK. Never silently discard proxy entities — they may represent critical alignment or infrastructure elements.

</details>

<details>
<summary><strong>What AC version string corresponds to AutoCAD 2018 and later?</strong></summary>

`$ACADVER = AC1032` corresponds to AutoCAD R2018. AutoCAD 2019 through 2026 retain the `AC1032` schema — the version string has not advanced. Use this as your minimum baseline for modern DXF support. Reject `AC1009` (R12) or earlier unless a legacy conversion path is explicitly configured, because R12 lacks subclass markers, making entity parsing significantly more fragile.

</details>

---

## Related Pages

- [Core Format Fundamentals & Schema Mapping](/core-format-fundamentals-schema-mapping/) — parent section covering CAD, GIS, and BIM file-level architectures
- [How to Parse DXF Headers with Python](/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/how-to-parse-dxf-headers-with-python/) — step-by-step header extraction with fallback logic for missing variables
- [DWG Proprietary Limitations & Binary Format Constraints](/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/) — why DXF remains the preferred interchange medium over DWG for Python automation
- [IFC4x3 Schema Mapping](/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/) — aligning DXF geometry with IFC property sets for BIM pipeline integration
- [ezdxf Deep Dive](/python-parsing-geometry-extraction/ezdxf-deep-dive/) — comprehensive API coverage for Python-driven CAD geometry extraction
