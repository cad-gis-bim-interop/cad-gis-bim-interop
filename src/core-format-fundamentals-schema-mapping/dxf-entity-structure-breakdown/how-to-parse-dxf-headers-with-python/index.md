---
title: "How to Parse DXF Headers with Python"
description: "Extract and normalize DXF HEADER section variables using ezdxf in Python. Covers $INSUNITS, $ACADVER, $EXTMIN/$EXTMAX, unit mapping, version routing, and defensive parsing for AEC/GIS ingestion pipelines."
slug: "how-to-parse-dxf-headers-with-python"
breadcrumb:
  - label: "Core Format Fundamentals & Schema Mapping"
    url: "/core-format-fundamentals-schema-mapping/"
  - label: "DXF Entity Structure Breakdown"
    url: "/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/"
  - label: "How to Parse DXF Headers with Python"
    url: "/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/how-to-parse-dxf-headers-with-python/"
datePublished: "2024-11-01"
dateModified: "2026-06-24"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "How to Parse DXF Headers with Python",
      "description": "Extract and normalize DXF HEADER section variables using ezdxf in Python. Covers $INSUNITS, $ACADVER, $EXTMIN/$EXTMAX, unit mapping, version routing, and defensive parsing for AEC/GIS ingestion pipelines.",
      "datePublished": "2024-11-01",
      "dateModified": "2026-06-24",
      "author": {"@type": "Organization", "name": "CAD GIS BIM Interop"},
      "publisher": {"@type": "Organization", "name": "CAD GIS BIM Interop", "url": "https://www.cad-gis-bim-interop.org"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Core Format Fundamentals & Schema Mapping", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/"},
        {"@type": "ListItem", "position": 2, "name": "DXF Entity Structure Breakdown", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/"},
        {"@type": "ListItem", "position": 3, "name": "How to Parse DXF Headers with Python", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/how-to-parse-dxf-headers-with-python/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "How to Parse DXF Headers with Python",
      "description": "Step-by-step guide to extracting DXF HEADER variables with ezdxf, mapping $INSUNITS and $ACADVER codes, and integrating results into an AEC/GIS pipeline.",
      "tool": [{"@type": "HowToTool", "name": "ezdxf>=1.1.0"}, {"@type": "HowToTool", "name": "Python 3.9+"}],
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Install ezdxf", "text": "Run `pip install ezdxf>=1.1.0` and verify with `python -c 'import ezdxf; print(ezdxf.version)'`."},
        {"@type": "HowToStep", "position": 2, "name": "Open the DXF file", "text": "Use `ezdxf.readfile(path)` inside a try/except DXFError block to obtain the document object."},
        {"@type": "HowToStep", "position": 3, "name": "Extract critical header variables", "text": "Read `doc.header.get('$ACADVER')`, `$INSUNITS`, `$EXTMIN`, and `$EXTMAX`."},
        {"@type": "HowToStep", "position": 4, "name": "Map raw codes to pipeline values", "text": "Translate integer unit codes and version strings using lookup dictionaries before downstream routing."},
        {"@type": "HowToStep", "position": 5, "name": "Validate and normalize", "text": "Check for unitless files, empty extents, and version strings that require legacy shim routing."}
      ]
    }
  ]
}
</script>

# How to Parse DXF Headers with Python

To parse DXF headers with Python, use `ezdxf` (>=1.1.0) and its `doc.header` dictionary interface. This interface resolves raw DXF group codes into named variables automatically, eliminating manual string parsing. The HEADER section functions as the drawing-wide configuration block, storing coordinate bounds, unit definitions, version identifiers, and layer defaults. For a complete map of how the HEADER fits inside the full format layout, see the [DXF Entity Structure Breakdown](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/). For AEC and GIS pipelines, extracting these values before geometry ingestion prevents unit mismatches, coordinate drift, and schema validation failures that are otherwise extremely difficult to trace.

## How ezdxf Handles the HEADER Section

The DXF HEADER section is a flat list of variable definitions, each expressed as a pair of group codes: a string name (e.g., `$INSUNITS`) followed by one or more typed value codes. `ezdxf` indexes these pairs at parse time and exposes them through `doc.header`, a dictionary-like object. You call `header.get("$VARNAME", default)` and receive the decoded Python type — integers, floats, or `Vec3` objects — rather than raw text lines.

The diagram below shows how a DXF file's sections relate to each other and where the HEADER sits in relation to the geometry you ultimately want.

<!-- fig:header-pair-encoding -->
<svg viewBox="-20 -20 312.2 208" role="img" aria-label="Group code 9 names a DXF header variable and the following code carries both its value and its type" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>How a HEADER variable is encoded as group-code pairs</title>
  <desc>Three header variables as they appear in the tagged text. Code 9 names the variable; the code that follows carries its value and also declares its type — 70 for a signed integer, 10 with 20 and 30 for a point. The type code is the reason a header value comes back from the library as an integer or a vector rather than as a string.</desc>
  <defs>
    <marker id="hdr1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="hdr1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="312.2" height="208" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="90.1" height="168" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.5"/>
  <text x="14" y="16" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">  9</text>
  <line x1="96.1" y1="12.9" x2="128.1" y2="12.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="136.1" y="16" font-size="9.5" fill="currentColor" fill-opacity="0.78">names the variable that follows</text>
  <text x="14" y="35" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">$INSUNITS</text>
  <text x="14" y="54" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95"> 70</text>
  <line x1="96.1" y1="50.9" x2="128.1" y2="50.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="136.1" y="54" font-size="9.5" fill="currentColor" fill-opacity="0.78">type 70 = signed integer</text>
  <text x="14" y="73" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">  4</text>
  <line x1="96.1" y1="69.9" x2="128.1" y2="69.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="136.1" y="73" font-size="9.5" fill="currentColor" fill-opacity="0.78">millimetres</text>
  <text x="14" y="92" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">  9</text>
  <text x="14" y="111" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">$EXTMIN</text>
  <text x="14" y="130" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95"> 10</text>
  <line x1="96.1" y1="126.9" x2="128.1" y2="126.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="136.1" y="130" font-size="9.5" fill="currentColor" fill-opacity="0.78">type 10/20/30 = a point</text>
  <text x="14" y="149" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.55">0.0</text>
</svg>
<!-- /fig:header-pair-encoding -->

<svg viewBox="-6 64 554 194" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="DXF section layout showing HEADER feeding into pipeline routing before geometry extraction" style="width:100%;max-width:640px;display:block;margin:1.5rem auto;">
  <title>DXF Section Layout and Pipeline Entry Point</title>
  <desc>A diagram showing the five DXF sections (HEADER, CLASSES, TABLES, BLOCKS, ENTITIES) arranged left to right, with an arrow from the HEADER section to a pipeline routing box, which then feeds into geometry extraction.</desc>
  <rect x="-6" y="64" width="554" height="194" fill="var(--color-surface)"/>
  <!-- Section boxes -->
  <rect x="10" y="80" width="90" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="55" y="97" text-anchor="middle" font-size="12" fill="currentColor" font-family="monospace">HEADER</text>
  <text x="55" y="113" text-anchor="middle" font-size="10" fill="currentColor" opacity=".7">variables</text>
  <rect x="118" y="80" width="90" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".5"/>
  <text x="163" y="97" text-anchor="middle" font-size="12" fill="currentColor" opacity=".6" font-family="monospace">CLASSES</text>
  <text x="163" y="113" text-anchor="middle" font-size="10" fill="currentColor" opacity=".5">custom objs</text>
  <rect x="226" y="80" width="90" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".5"/>
  <text x="271" y="97" text-anchor="middle" font-size="12" fill="currentColor" opacity=".6" font-family="monospace">TABLES</text>
  <text x="271" y="113" text-anchor="middle" font-size="10" fill="currentColor" opacity=".5">layers/styles</text>
  <rect x="334" y="80" width="90" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".5"/>
  <text x="379" y="97" text-anchor="middle" font-size="12" fill="currentColor" opacity=".6" font-family="monospace">BLOCKS</text>
  <text x="379" y="113" text-anchor="middle" font-size="10" fill="currentColor" opacity=".5">definitions</text>
  <rect x="442" y="80" width="90" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".5"/>
  <text x="487" y="97" text-anchor="middle" font-size="12" fill="currentColor" opacity=".6" font-family="monospace">ENTITIES</text>
  <text x="487" y="113" text-anchor="middle" font-size="10" fill="currentColor" opacity=".5">geometry</text>
  <!-- Arrow: HEADER → pipeline box -->
  <line x1="55" y1="124" x2="55" y2="164" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <!-- Pipeline routing box -->
  <rect x="10" y="164" width="200" height="48" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="110" y="183" text-anchor="middle" font-size="12" fill="currentColor">Pipeline Routing</text>
  <text x="110" y="199" text-anchor="middle" font-size="10" fill="currentColor" opacity=".75">unit norm · version gate · extent check</text>
  <!-- Arrow: pipeline → ENTITIES -->
  <line x1="210" y1="188" x2="430" y2="130" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5,3" marker-end="url(#arr)"/>
  <defs>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor"/>
    </marker>
  </defs>
  <!-- Legend note -->
  <text x="320" y="240" text-anchor="middle" font-size="10" fill="currentColor" opacity=".6">Parse HEADER first — it controls how all subsequent geometry is interpreted</text>
</svg>

DXF files carry no embedded coordinate reference system. They depend on implicit drawing units, version-specific entity behaviors, and origin offsets. When CAD exports enter automated ingestion workflows, unvalidated headers cause silent spatial distortions. A file drawn in architectural units (1 unit = 1 inch) imported into a metric GIS pipeline will scale incorrectly by a factor of 25.4. No error is thrown; the geometry simply arrives at the wrong coordinates.

Reading the header before any geometry gives your pipeline three things:

- a unit multiplier to apply before coordinate transformation
- a version identifier to route legacy files to compatibility shims
- a bounding box for spatial indexing and sanity-checking extent validity

This connects directly to the [Core Format Fundamentals & Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/) framework: consistent field naming, type coercion, and validation rules across CAD, GIS, and BIM endpoints all depend on an agreed unit and version baseline set at ingestion.

## Production-Ready Script

The script below demonstrates a defensive, pipeline-ready approach. It handles missing files, malformed DXF structures, and `Vec3` serialization while mapping raw codes to human-readable pipeline values. Install the dependency first:

```
pip install "ezdxf>=1.1.0"
```

```python
# ezdxf>=1.1.0  |  Python 3.9+
import json
import ezdxf
from pathlib import Path
from typing import Any, Dict, Optional

# $ACADVER string → AutoCAD release label
# Source: Autodesk DXF Reference + Open Design Alliance version matrix
ACAD_VERSION_MAP: Dict[str, str] = {
    "AC1009": "R12",
    "AC1012": "R13",
    "AC1014": "R14",
    "AC1015": "2000",
    "AC1018": "2004",
    "AC1021": "2007",
    "AC1024": "2010",
    "AC1027": "2013",
    "AC1032": "2018",  # current on-disk format as of AutoCAD 2019–2026
}

# $INSUNITS integer code → unit name
# Full list: DXF spec §HEADER Variables, group code 70 for $INSUNITS
UNIT_MAP: Dict[int, str] = {
    0: "Unitless",       1: "Inches",          2: "Feet",
    3: "Miles",          4: "Millimeters",      5: "Centimeters",
    6: "Meters",         7: "Kilometers",       8: "Microinches",
    9: "Mils",          10: "Yards",           11: "Angstroms",
   12: "Nanometers",    13: "Microns",         14: "Decimeters",
   15: "Decameters",    16: "Hectometers",     17: "Gigameters",
   18: "Astronomical Units",                   19: "Light Years",
   20: "Parsecs",
}

# Conversion factor to metres for each $INSUNITS code (0 = unknown, handle separately)
TO_METRES: Dict[int, float] = {
    1: 0.0254,    2: 0.3048,     3: 1609.344,   4: 0.001,
    5: 0.01,      6: 1.0,        7: 1000.0,     8: 2.54e-8,
    9: 2.54e-5,  10: 0.9144,    11: 1e-10,      12: 1e-9,
   13: 1e-6,     14: 0.1,       15: 10.0,       16: 100.0,
   17: 1e9,      18: 1.496e11,  19: 9.461e15,   20: 3.086e16,
}


def parse_dxf_header(filepath: str) -> Dict[str, Any]:
    """Extract and normalise critical DXF header variables for pipeline routing.

    Returns a dict with typed, serialisable values ready for JSON output or
    downstream schema validation. Raises FileNotFoundError or RuntimeError on
    unrecoverable failures; never returns partial data silently.
    """
    path = Path(filepath)
    if not path.exists():
        raise FileNotFoundError(f"DXF file not found: {filepath}")

    try:
        doc = ezdxf.readfile(str(path))
    except ezdxf.DXFError as exc:
        raise RuntimeError(f"Failed to parse DXF structure: {exc}") from exc

    header = doc.header
    acad_ver: str = header.get("$ACADVER", "Unknown")
    ins_units: int = header.get("$INSUNITS", 0)

    # ezdxf returns Vec3 objects for point variables — convert to plain lists
    # before JSON serialisation; Vec3 is not JSON-serialisable by default.
    ext_min: Optional[Any] = header.get("$EXTMIN", None)
    ext_max: Optional[Any] = header.get("$EXTMAX", None)

    extents_min = list(ext_min) if ext_min is not None else None
    extents_max = list(ext_max) if ext_max is not None else None

    # Flag suspiciously degenerate extents (empty or corrupted drawing)
    degenerate_extents = (
        extents_min is not None
        and extents_max is not None
        and extents_min == extents_max
    )

    return {
        "source_file": str(path),
        "acad_version_raw": acad_ver,
        "acad_version_label": ACAD_VERSION_MAP.get(acad_ver, "Unknown"),
        "units_code": ins_units,
        "units_label": UNIT_MAP.get(ins_units, "Unknown"),
        "units_to_metres": TO_METRES.get(ins_units),   # None when unitless
        "extents_min": extents_min,
        "extents_max": extents_max,
        "degenerate_extents": degenerate_extents,
        # Linear unit display format (2 = decimal, 4 = architectural, etc.)
        "lunits": header.get("$LUNITS", 2),
        # Angular precision (decimal places); important for survey exports
        "auprec": header.get("$AUPREC", 4),
        # $MEASUREMENT is the older fallback: 0 = Imperial, 1 = Metric
        "measurement_fallback": header.get("$MEASUREMENT", None),
    }


if __name__ == "__main__":
    import sys
    target = sys.argv[1] if len(sys.argv) > 1 else "sample.dxf"
    try:
        result = parse_dxf_header(target)
        print(json.dumps(result, indent=2))
    except (FileNotFoundError, RuntimeError) as exc:
        print(f"Pipeline ingestion failed: {exc}", file=sys.stderr)
        sys.exit(1)
```

Key implementation notes:

- `doc.header.get()` never raises `KeyError`; it returns the supplied default, so every `get()` call is safe even on minimal or incomplete DXF exports.
- `Vec3` objects from `$EXTMIN`/`$EXTMAX` are not JSON-serialisable. Always call `list()` on them before storing or transmitting.
- `units_to_metres` is `None` when `$INSUNITS` is `0` (Unitless). Treat `None` as a hard gate: reject the file, apply a config-driven default, or cross-reference external metadata — but never assume metric.
- `$MEASUREMENT` (the older Imperial/Metric flag) is read as a fallback only. Prefer `$INSUNITS` when both are present, because `$MEASUREMENT` does not distinguish between millimetres and metres.

## Compatibility Matrix

| Component | Supported Range | Notes |
|---|---|---|
| Python | 3.9 – 3.13 | `dict` type hints require 3.9+; no walrus operator used |
| ezdxf | 1.1.0 – 1.3.x | `doc.header` API stable since 0.18; `Vec3` always returned for point vars |
| DXF version | AC1009 (R12) – AC1032 (R2018) | AC1009 files may lack `$INSUNITS`; default to `0` (Unitless) |
| OS | Linux, macOS, Windows | `pathlib.Path` normalises separators; no platform-specific code |
| Binary DXF | Supported with caveats | `ezdxf.readfile()` detects binary encoding automatically; R12 binary files occasionally omit extended header vars |

Files saved by non-Autodesk CAD tools (BricsCAD, DraftSight, LibreCAD) generally conform to the specification but may set `$ACADVER` to values not in `ACAD_VERSION_MAP`. Use `.startswith("AC1")` as a guard before treating an unknown string as a fatal error.

## Fallback Strategies and Troubleshooting

**1. `$INSUNITS` is 0 (Unitless)**

<!-- fig:header-defensive-reads -->
<svg viewBox="-20 -20 489.1 214.1" role="img" aria-label="ACADVER, INSUNITS, EXTMIN/EXTMAX and MEASUREMENT — what each header variable governs and what to do when it is absent" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:489px;display:block;margin:1.5rem auto;">
  <title>The header variables worth reading before any geometry</title>
  <desc>Four header variables, what each one is for, and what a pipeline should do when it is missing. All four are cheap to read and all four change how the geometry that follows must be interpreted, so reading them first turns a class of silent scale and version errors into an early, attributable failure.</desc>
  <defs>
    <marker id="hdr2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="hdr2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="489.1" height="214.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="449.1" height="152" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="449.1" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">Variable</text>
  <text x="216.8" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Governs</text>
  <line x1="295.3" y1="0" x2="295.3" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="372.2" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">If missing</text>
  <line x1="138.3" y1="0" x2="138.3" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="449.1" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">$ACADVER</text>
  <text x="216.8" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">DXF revision</text>
  <text x="372.2" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">reject — version unknown</text>
  <line x1="0" y1="62" x2="449.1" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">$INSUNITS</text>
  <text x="216.8" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">base unit of every coordinate</text>
  <text x="372.2" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">apply a logged policy default</text>
  <line x1="0" y1="92" x2="449.1" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">$EXTMIN / $EXTMAX</text>
  <text x="216.8" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">drawing extents</text>
  <text x="372.2" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">compute from geometry</text>
  <line x1="0" y1="122" x2="449.1" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="140.5" font-size="10.5" font-weight="600" fill="currentColor">$MEASUREMENT</text>
  <text x="216.8" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">imperial or metric drafting</text>
  <text x="372.2" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">weak tiebreaker only</text>
  <text x="0" y="172" font-size="9.5" fill="currentColor" fill-opacity="0.7">All four are read before the first entity, because all four change what the entities mean.</text>
</svg>
<!-- /fig:header-defensive-reads -->

The file was exported without a declared unit. Possible recoveries in priority order: (a) check a sidecar metadata file if your ingest workflow supports one; (b) read `$MEASUREMENT` — if it equals `1`, metric is likely, but you still need to guess between mm/cm/m; (c) apply the unit declared in a pipeline config for that project or data source; (d) reject the file and log it for manual review. Never silently assume metres.

**2. `$EXTMIN` equals `$EXTMAX` or both are `None`**

The drawing is either empty or the exporting application did not regenerate extents before saving (`REGEN` / `REGEN ALL` in AutoCAD). Compute extents dynamically by iterating `doc.modelspace()` entity coordinates. Flag the file for verification before triggering expensive spatial transforms. The [Metadata Extraction Strategies](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/) page covers programmatic extent computation in more detail.

**3. Unknown `$ACADVER` string**

Third-party CAD tools sometimes append build suffixes (e.g., `"AC1032_BETA"`). Fall back to prefix matching:

```python
known = next(
    (label for ver, label in ACAD_VERSION_MAP.items() if acad_ver.startswith(ver)),
    "Unknown"
)
```

**4. `ezdxf.DXFError` on `readfile()`**

The file is malformed, truncated, or uses a version newer than ezdxf supports. Log the exception message, move the file to a quarantine path, and continue processing the batch. Do not let a single bad file halt the pipeline.

**5. `$ACADVER` predates `AC1015` (R2000)**

Files older than R2000 lack modern XDATA, `ACAD_PROXY_ENTITY`, and extended block attribute support. Route them through a legacy compatibility shim that strips or transforms unsupported entity types before passing geometry to the main parser. Connecting this routing decision to version-aware branching in your [DXF Entity Structure Breakdown](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/) parser prevents runtime errors on downstream entity reads.

---

## Related Pages

- [DXF Entity Structure Breakdown](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/) — parent page covering the full group-code taxonomy, section layout, and entity hierarchy
- [Core Format Fundamentals & Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/) — the broader framework for unit normalization, schema alignment, and format-version routing across CAD, GIS, and BIM pipelines
- [Metadata Extraction Strategies](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/) — covers block attribute extraction, XDATA parsing, and dynamic extent computation
- [Converting CAD Local Coordinates to EPSG:4326](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/converting-cad-local-coordinates-to-epsg4326/) — applies the unit and extent values extracted here to full coordinate reprojection with pyproj
- [Understanding DWG Version Compatibility](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/understanding-dwg-version-compatibility/) — sibling reference for version-routing decisions when your pipeline handles both DXF and DWG inputs
