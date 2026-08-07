---
title: "DWG Proprietary Limitations for Python Interoperability Pipelines"
description: "DWG's closed binary architecture, version-lock constraints and proxy object hazards — and a resilient Python ingestion pipeline that routes around them."
slug: "dwg-proprietary-limitations"
breadcrumb:
  - label: "Core Format Fundamentals & Schema Mapping"
    url: "/core-format-fundamentals-schema-mapping/"
  - label: "DWG Proprietary Limitations"
    url: "/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/"
datePublished: "2024-03-15"
dateModified: "2026-06-24"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "DWG Proprietary Limitations for Python Interoperability Pipelines",
      "description": "DWG's closed binary architecture, version-lock constraints and proxy object hazards — and a resilient Python ingestion pipeline that routes around them.",
      "datePublished": "2024-03-15",
      "dateModified": "2026-06-24",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Core Format Fundamentals & Schema Mapping", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/"},
        {"@type": "ListItem", "position": 2, "name": "DWG Proprietary Limitations", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Build a Python DWG Ingestion Pipeline",
      "description": "Route DWG files safely through version detection, headless conversion, DXF parsing, and spatial validation.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Detect binary header and DWG version", "text": "Read the 6-byte magic bytes and map them to an AutoCAD release before attempting any conversion."},
        {"@type": "HowToStep", "position": 2, "name": "Route through headless ODA conversion", "text": "Use the ODA File Converter CLI to produce a stable DXF artefact; never attempt direct binary parsing in Python."},
        {"@type": "HowToStep", "position": 3, "name": "Parse and normalise DXF entities", "text": "Use ezdxf to traverse model-space entities, extract typed coordinates, and build pydantic-validated records."},
        {"@type": "HowToStep", "position": 4, "name": "Validate geometry and map to target schema", "text": "Apply shapely topology checks, CRS reprojection, and attribute mapping before committing to a GIS or BIM target store."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Can Python parse DWG files directly without a proprietary SDK?",
          "acceptedAnswer": {"@type": "Answer", "text": "Not reliably. The DWG binary format is undocumented and version-specific. Reverse-engineered libraries exist but are incomplete and legally ambiguous for commercial use. The production-safe path is always ODA File Converter → DXF → ezdxf."}
        },
        {
          "@type": "Question",
          "name": "What causes proxy object corruption when converting DWG to DXF?",
          "acceptedAnswer": {"@type": "Answer", "text": "Proxy objects are placeholder records written by third-party ObjectARX applications (e.g. civil design add-ins). When the originating application is absent, converters cannot deserialise the object and emit a ACAD_PROXY_ENTITY stub. Bind or explode these before export at the authoring stage."}
        },
        {
          "@type": "Question",
          "name": "Which DWG versions does the ODA File Converter support?",
          "acceptedAnswer": {"@type": "Answer", "text": "ODA covers AC1.x through AC1032 (AutoCAD 2018). Files beyond AC1032 require an updated ODA build. Always check the ODA release notes against your incoming file version map."}
        },
        {
          "@type": "Question",
          "name": "Does converting DWG to DXF lose layer structure or block definitions?",
          "acceptedAnswer": {"@type": "Answer", "text": "Layer table entries, block definitions, and XDATA attributes are preserved under correctly configured ODA CLI flags. Xref attachments are flattened unless you bind them in AutoCAD before handoff."}
        },
        {
          "@type": "Question",
          "name": "What is $INSUNITS and why does it matter for GIS ingestion?",
          "acceptedAnswer": {"@type": "Answer", "text": "$INSUNITS is the DXF header variable that declares the drawing unit (0=unitless, 1=inches, 4=mm, 6=metres, etc.). If it is absent or set to 0, all coordinates are dimensionless numbers and unit conversion before CRS reprojection is undefined. Always extract and validate $INSUNITS as the first step in spatial normalisation."}
        }
      ]
    }
  ]
}
</script>

# DWG Proprietary Limitations for Python Interoperability Pipelines

DWG is the de-facto exchange format across architecture, engineering, and construction workflows — yet its closed binary architecture makes it the most friction-prone format in any automated Python pipeline. The specification is undocumented and version-specific, its object model includes proprietary proxy entities that no open-source library can fully deserialise, and direct binary parsing carries genuine legal exposure for commercial deployments. This page explains the internal mechanics behind those constraints and shows how to route around them reliably. It sits within the [Core Format Fundamentals & Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/) section, which covers format normalisation, schema binding, and metadata extraction across the DWG/DXF/IFC triad.

## Prerequisites

Before implementing any pattern on this page, confirm your environment satisfies the following:

- **Python 3.9+** — f-strings with `=`, `struct.unpack_from`, and `pathlib` all used below
- **`ezdxf>=1.1.0`** — `pip install "ezdxf>=1.1.0"` — for post-conversion DXF traversal
- **`shapely>=2.0`** — `pip install "shapely>=2.0"` — for topology validation and `make_valid`
- **`geopandas>=0.14`** — `pip install "geopandas>=0.14"` — for CRS reprojection and GeoDataFrame output
- **`pydantic>=2.0`** — `pip install "pydantic>=2.0"` — for strict entity schema validation
- **ODA File Converter CLI** (v25.x or later) — download from [opendesign.com/guestfiles/oda_file_converter](https://www.opendesign.com/guestfiles/oda_file_converter); a commercial ODA licence is required for production use
- **Assumed knowledge:** familiarity with [DXF Entity Structure Breakdown](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/) (group codes, entity model, HEADER variables); basic understanding of EPSG CRS codes and `pyproj` transforms

## Architectural Overview

### Why DWG Cannot Be Parsed Directly

<!-- fig:dwg-release-signatures -->
<svg viewBox="-46.8 -61.8 753.3 128.9" role="img" aria-label="AC1015 through AC1032 — the DWG magic signatures still in circulation and the release each one covers" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:753px;display:block;margin:1.5rem auto;">
  <title>DWG release signatures a converter has to recognise</title>
  <desc>The magic signatures written at file offset zero across the DWG releases still in circulation. Each covers several product years, so the signature identifies the binary schema rather than the version of AutoCAD that wrote the file. A signature outside this set is a file the converter has never seen and should quarantine rather than attempt.</desc>
  <defs>
    <marker id="dwg1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="dwg1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-46.8" y="-61.8" width="753.3" height="128.9" fill="var(--color-surface)"/>
  <line x1="0" y1="0" x2="656" y2="0" stroke="currentColor" stroke-width="1.4" stroke-opacity="0.5" marker-end="url(#dwg1-a)"/>
  <line x1="0" y1="0" x2="0" y2="-14" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.45"/>
  <circle cx="0" cy="0" r="3.5" fill="currentColor" fill-opacity="0.85"/>
  <text x="0" y="-22" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">AC1015</text>
  <text x="0" y="-35" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">R2000–2002</text>
  <line x1="126" y1="0" x2="126" y2="14" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.45"/>
  <circle cx="126" cy="0" r="3.5" fill="currentColor" fill-opacity="0.85"/>
  <text x="126" y="32" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">AC1018</text>
  <text x="126" y="45" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">R2004–2006</text>
  <line x1="252" y1="0" x2="252" y2="-14" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.45"/>
  <circle cx="252" cy="0" r="3.5" fill="currentColor" fill-opacity="0.85"/>
  <text x="252" y="-22" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">AC1021</text>
  <text x="252" y="-35" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">R2007–2009</text>
  <line x1="378" y1="0" x2="378" y2="14" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.45"/>
  <circle cx="378" cy="0" r="3.5" fill="currentColor" fill-opacity="0.85"/>
  <text x="378" y="32" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">AC1024</text>
  <text x="378" y="45" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">R2010–2012</text>
  <line x1="504" y1="0" x2="504" y2="-14" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.45"/>
  <circle cx="504" cy="0" r="3.5" fill="currentColor" fill-opacity="0.85"/>
  <text x="504" y="-22" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">AC1027</text>
  <text x="504" y="-35" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">R2013–2017</text>
  <line x1="630" y1="0" x2="630" y2="14" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.45"/>
  <circle cx="630" cy="0" r="3.5" fill="currentColor" fill-opacity="0.85"/>
  <text x="630" y="32" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">AC1032</text>
  <text x="630" y="45" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">R2018+</text>
  <text x="660" y="4" font-size="9.5" fill="currentColor" fill-opacity="0.65">newer</text>
</svg>
<!-- /fig:dwg-release-signatures -->

The DWG binary specification has never been formally published by Autodesk. Each major release — identified by a 6-byte magic signature at byte offset 0 — introduces a different object serialisation strategy, a different section layout, and a different compressed encoding for object handles. The Open Design Alliance reverse-engineered the format over many years and maintains the closest public approximation, but even the ODA implementation diverges from AutoCAD behaviour on ACIS 3D solid encryption, certain proxy object payloads, and application-defined dictionary entries.

For Python automation builders, this creates three hard constraints:

1. **No stable pure-Python parser exists** for the full DWG object model. Libraries that claim to read DWG natively either rely on the ODA SDK under the hood or cover only a subset of entity types with no guarantees across versions.
2. **Version lock is strict.** A file saved in AC1032 format (AutoCAD 2018) uses a fundamentally different section encoding than AC1021 (AutoCAD 2007). A parser built against one cannot reliably read another.
3. **Proprietary object classes (proxy objects)** are written by third-party ObjectARX applications and are opaque to any host that does not have the originating DLL loaded. Converters emit `ACAD_PROXY_ENTITY` stubs in their place, silently dropping geometry.

The production-safe architecture therefore always treats DWG as an **opaque container** that must be unlocked through a licensed converter before any Python code touches the data.

### DWG Version Signature Map

Each AutoCAD release writes a distinct 6-byte ASCII header. Detecting this signature before any processing step prevents misrouted conversions and silent data loss.

| Magic bytes | AutoCAD release | ODA support |
|---|---|---|
| `AC1032` | 2018 (R22) | Full |
| `AC1027` | 2013 (R19) | Full |
| `AC1024` | 2010 (R18) | Full |
| `AC1021` | 2007 (R17) | Full |
| `AC1018` | 2004 (R16) | Full |
| `AC1015` | 2000 (R15) | Full |
| `AC1014` | R14 | Full |
| `AC1009` | R12 | Partial (no objects section) |
| `AC103x` (>AC1032) | 2019+ | Requires ODA 25.x+ |

For a deep breakdown of how these version tokens map to internal section layouts and serialisation rules, see [Understanding DWG Version Compatibility](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/understanding-dwg-version-compatibility/).

### Pipeline Data-Flow

The diagram below shows the complete routing logic from raw `.dwg` intake to validated spatial output. Each branch represents a distinct failure surface.

<svg viewBox="0 0 760 420" role="img" aria-label="DWG ingestion pipeline data-flow diagram" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;display:block;margin:2rem auto;">
  <title>DWG Ingestion Pipeline Data-Flow</title>
  <desc>Flow diagram showing DWG file routing through header detection, ODA conversion, DXF parsing, spatial validation, and schema export, with quarantine and retry branches for failure states.</desc>
  <defs>
    <marker id="arr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor"/>
    </marker>
  </defs>
  <rect x="0" y="0" width="760" height="420" fill="var(--color-surface)"/>
  <!-- Background lanes -->
  <rect x="10" y="10" width="740" height="400" rx="8" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="4 4" opacity="0.2"/>
  <!-- Step boxes -->
  <!-- 1: Intake -->
  <rect x="30" y="30" width="140" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="100" y="53" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="currentColor" font-weight="600">DWG File Intake</text>
  <text x="100" y="71" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="currentColor" opacity="0.75">raw .dwg from source</text>
  <!-- 2: Header detection -->
  <rect x="30" y="130" width="140" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="100" y="153" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="currentColor" font-weight="600">Header Detection</text>
  <text x="100" y="171" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="currentColor" opacity="0.75">read 6-byte magic bytes</text>
  <!-- Arrow 1→2 -->
  <line x1="100" y1="82" x2="100" y2="127" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <!-- Quarantine box -->
  <rect x="220" y="130" width="120" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
  <text x="280" y="153" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="currentColor" font-weight="600">Quarantine</text>
  <text x="280" y="171" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="currentColor" opacity="0.75">unknown signature</text>
  <!-- Arrow header → quarantine (fail) -->
  <line x1="170" y1="156" x2="217" y2="156" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="193" y="149" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="currentColor" opacity="0.75">fail</text>
  <!-- 3: ODA Conversion -->
  <rect x="30" y="230" width="140" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="100" y="253" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="currentColor" font-weight="600">ODA Conversion</text>
  <text x="100" y="271" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="currentColor" opacity="0.75">DWG → DXF (headless)</text>
  <!-- Arrow header → ODA (ok) -->
  <line x1="100" y1="182" x2="100" y2="227" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="113" y="208" font-family="system-ui,sans-serif" font-size="10" fill="currentColor" opacity="0.75">ok</text>
  <!-- Retry box -->
  <rect x="220" y="230" width="120" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 3"/>
  <text x="280" y="253" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="currentColor" font-weight="600">Retry / Fallback</text>
  <text x="280" y="271" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="currentColor" opacity="0.75">older DXF target</text>
  <!-- Arrow ODA → retry (fail) -->
  <line x1="170" y1="256" x2="217" y2="256" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="193" y="249" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="currentColor" opacity="0.75">fail</text>
  <!-- 4: DXF Parse -->
  <rect x="30" y="330" width="140" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="100" y="353" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="currentColor" font-weight="600">DXF Parse</text>
  <text x="100" y="371" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="currentColor" opacity="0.75">ezdxf entity traversal</text>
  <!-- Arrow ODA → DXF parse -->
  <line x1="100" y1="282" x2="100" y2="327" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <!-- 5: Validate + Export -->
  <rect x="560" y="330" width="160" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="640" y="353" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="currentColor" font-weight="600">Validate + Export</text>
  <text x="640" y="371" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="currentColor" opacity="0.75">shapely / GeoDataFrame</text>
  <!-- Arrow DXF → validate -->
  <line x1="170" y1="356" x2="557" y2="356" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <!-- connector label -->
  <text x="360" y="349" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="currentColor" opacity="0.75">normalised entities</text>
</svg>

## Step-by-Step Implementation

### Step 1 — Binary Header Inspection and Version Detection

<!-- fig:dwg-quarantine-gate -->
<svg viewBox="-20 -20 376.1 216.2" role="img" aria-label="A recognised six-byte DWG signature routes to conversion; anything else is quarantined with the bytes recorded" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>Routing on the six-byte signature before any conversion</title>
  <desc>A branch taken on six bytes read at offset zero, before the converter is invoked at all. A recognised signature routes to the conversion queue with its target release chosen from a registry. An unrecognised one is quarantined with the bytes recorded. Guessing at an unknown signature costs a converter invocation and produces output nobody can trust.</desc>
  <defs>
    <marker id="dwg2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="dwg2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="376.1" height="216.2" fill="var(--color-surface)"/>
  <polygon points="168,0 263,31 168,62 73,31" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-width="1.6"/>
  <text x="168" y="35" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">Signature in the registry?</text>
  <rect x="0" y="128" width="154" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="77" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Convert</text>
  <text x="77" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">target release from registry</text>
  <path d="M 168 62 L 168 92 L 77 92 L 77 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#dwg2-a)" stroke-linejoin="round"/>
  <text x="77" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">recognised</text>
  <rect x="182" y="128" width="154" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="259.1" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Quarantine</text>
  <text x="259.1" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">record the signature</text>
  <path d="M 168 62 L 168 92 L 259.1 92 L 259.1 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#dwg2-a)" stroke-linejoin="round"/>
  <text x="259.1" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">unknown bytes</text>
</svg>
<!-- /fig:dwg-quarantine-gate -->

Read exactly 6 bytes at offset 0 before touching any conversion tooling. An unrecognised signature should trigger an immediate quarantine, not a fallback attempt — attempting conversion on a corrupt or mis-named binary can crash the converter and fill your error queue with misleading exit codes.

```python
# ezdxf>=1.1.0  shapely>=2.0  geopandas>=0.14  pydantic>=2.0
import struct
from pathlib import Path

DWG_VERSION_MAP = {
    b"AC1032": "2018",
    b"AC1027": "2013",
    b"AC1024": "2010",
    b"AC1021": "2007",
    b"AC1018": "2004",
    b"AC1015": "2000",
    b"AC1014": "R14",
    b"AC1009": "R12",
}

def detect_dwg_version(file_path: Path) -> str:
    """Return the AutoCAD release string or raise ValueError for unknown signatures."""
    with open(file_path, "rb") as fh:
        magic = fh.read(6)
    version = DWG_VERSION_MAP.get(magic)
    if version is None:
        raise ValueError(
            f"Unrecognised DWG signature {magic.hex()!r} in {file_path.name} — "
            "quarantine and do not attempt conversion."
        )
    return version
```

Only use Python's built-in `struct` module or raw byte slicing at this stage. Loading `ezdxf` or any heavy CAD library before the version gate has passed wastes memory and can produce misleading parse errors.

### Step 2 — Headless ODA Conversion to DXF

The ODA File Converter CLI (`ODAFileConverter`) accepts a source directory and a target directory as positional arguments. It processes every `.dwg` it finds in the source directory and writes a matching `.dxf`. Always pin the output format to a fixed DXF release (e.g., `ACAD2018`) rather than trying to match the source version — a consistent output target eliminates `ezdxf` version fragmentation downstream.

```python
import subprocess
import logging
from pathlib import Path

log = logging.getLogger(__name__)

def convert_dwg_to_dxf(
    dwg_path: Path,
    output_dir: Path,
    cli_path: str = "ODAFileConverter",
    dxf_version: str = "ACAD2018",
) -> Path:
    """
    Convert a single DWG file to DXF via ODA CLI.
    ODA processes the parent directory; isolate one file per call
    using a temporary staging directory when batch isolation is needed.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        cli_path,
        str(dwg_path.parent),   # source dir
        str(output_dir),         # target dir
        "DXF",                   # output format
        dxf_version,             # DXF version string
        "0",                     # recurse: 0=no, 1=yes
        "1",                     # audit on conversion: 1=yes
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        log.error("ODA conversion failed for %s: %s", dwg_path.name, result.stderr.strip())
        raise RuntimeError(f"ODA conversion exited {result.returncode} for {dwg_path.name}")
    dxf_output = output_dir / f"{dwg_path.stem}.dxf"
    if not dxf_output.exists():
        raise FileNotFoundError(
            f"ODA ran successfully but produced no output for {dwg_path.name}"
        )
    return dxf_output
```

The `audit=1` flag tells ODA to run its internal drawing repair pass before writing. This recovers a significant fraction of files that have minor structural corruption without manual intervention.

### Step 3 — DXF Entity Parsing and Schema Normalisation

Once converted, the DXF file is safe to traverse with `ezdxf`. The key discipline here is building a strongly-typed record per entity rather than working with raw `ezdxf` attribute bags downstream. Using `pydantic` models as the normalisation boundary means any schema violation surfaces immediately at parse time rather than silently propagating through spatial joins.

For a detailed reference on group code semantics, `LWPOLYLINE` vertex access, and block reference traversal, see the [DXF Entity Structure Breakdown](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/).

```python
import ezdxf                                 # ezdxf>=1.1.0
from pydantic import BaseModel, Field
from typing import List, Optional

class NormalisedEntity(BaseModel):
    layer: str
    entity_type: str
    coordinates: List[tuple[float, float, float]]
    metadata: dict = Field(default_factory=dict)

def parse_dxf_entities(dxf_path: Path) -> List[NormalisedEntity]:
    """
    Traverse model-space entities and return typed, validated records.
    Entity types not handled explicitly are skipped (logged at DEBUG level).
    """
    doc = ezdxf.readfile(str(dxf_path))
    msp = doc.modelspace()
    results: List[NormalisedEntity] = []

    for entity in msp:
        etype = entity.dxftype()
        coords: List[tuple[float, float, float]] = []

        if etype == "LINE":
            coords = [
                (entity.dxf.start.x, entity.dxf.start.y, entity.dxf.start.z),
                (entity.dxf.end.x, entity.dxf.end.y, entity.dxf.end.z),
            ]
        elif etype == "CIRCLE":
            coords = [(entity.dxf.center.x, entity.dxf.center.y, entity.dxf.center.z)]
        elif etype == "LWPOLYLINE":
            # Use get_points("xy") — there is no .vertices attribute on LWPOLYLINE
            coords = [(p[0], p[1], 0.0) for p in entity.get_points("xy")]
        elif etype == "INSERT":
            coords = [(entity.dxf.insert.x, entity.dxf.insert.y, entity.dxf.insert.z)]
        else:
            log.debug("Skipping unhandled entity type %s", etype)
            continue

        results.append(NormalisedEntity(
            layer=entity.dxf.get("layer", "0"),
            entity_type=etype,
            coordinates=coords,
        ))

    return results
```

### Step 4 — Spatial Validation and CRS Reprojection

Raw DWG/DXF coordinates are almost never in a real-world CRS. They live in an engineering drawing coordinate system (often millimetres or feet from a project origin). Before mapping to a GIS store, you must extract `$INSUNITS` from the DXF header, convert to metres, apply a known translation/rotation to real-world coordinates, and reproject. The [CRS Normalisation Workflows](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/) page covers the full Helmert and affine transform sequences for this step.

```python
import geopandas as gpd                      # geopandas>=0.14
from shapely.geometry import Point, LineString, Polygon
from shapely.validation import make_valid

# $INSUNITS scale factors to metres
INSUNITS_TO_METRES = {
    1: 0.0254,      # inches
    2: 0.3048,      # feet
    4: 0.001,       # millimetres
    5: 0.01,        # centimetres
    6: 1.0,         # metres
    7: 1000.0,      # kilometres
}

def build_geodataframe(
    entities: List[NormalisedEntity],
    insunits: int = 4,             # default: millimetres (DWG mechanical drawings)
    target_crs: str = "EPSG:4326",
    source_crs: str = "EPSG:32633",
) -> gpd.GeoDataFrame:
    """
    Convert normalised entities to a GeoDataFrame.
    Applies $INSUNITS unit scaling, shapely make_valid(), and CRS reprojection.
    """
    scale = INSUNITS_TO_METRES.get(insunits, 1.0)
    geometries = []
    attributes = []

    for ent in entities:
        if not ent.coordinates:
            continue
        scaled = [(x * scale, y * scale, z * scale) for x, y, z in ent.coordinates]
        try:
            if len(scaled) == 1:
                geom = Point(scaled[0])
            elif len(scaled) == 2:
                geom = LineString(scaled)
            else:
                geom = Polygon(scaled)
            geom = make_valid(geom)
        except Exception as exc:
            log.warning("Invalid geometry skipped (layer=%s): %s", ent.layer, exc)
            continue
        geometries.append(geom)
        attributes.append({"layer": ent.layer, "type": ent.entity_type})

    gdf = gpd.GeoDataFrame(attributes, geometry=geometries, crs=source_crs)
    return gdf.to_crs(target_crs)
```

When targeting BIM output rather than GIS, map normalised layer names to IFC class equivalents. The [IFC4x3 Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/) reference provides exact class-to-attribute translation rules for AEC data pipelines.

## Edge Cases & Gotchas

### 1. Proxy Object Silencing

ObjectARX applications (AutoCAD Civil 3D corridors, Revit-exported grading objects, Plant 3D components) write proxy entity records that no converter outside the originating application can read. ODA emits an `ACAD_PROXY_ENTITY` with zero geometry. The only reliable mitigation is a pre-ingestion policy: require CAD authors to bind or explode all proxy objects in AutoCAD before delivery.

```python
def count_proxy_entities(dxf_path: Path) -> int:
    """Return the number of proxy stubs; nonzero means geometry was silently dropped."""
    doc = ezdxf.readfile(str(dxf_path))
    return sum(1 for e in doc.modelspace() if e.dxftype() == "ACAD_PROXY_ENTITY")
```

Emit a structured warning when `count_proxy_entities` returns nonzero. Do not proceed silently.

### 2. Missing or Zero `$INSUNITS`

`$INSUNITS=0` means the drawing unit is explicitly undefined. This is common in legacy architectural drawings where the modelling unit was millimetres but the variable was never set. Without a unit, all CRS reprojection produces nonsense coordinates. Implement a unit negotiation step: extract `$INSUNITS`, and if it is 0 or absent, reject the file and request clarification from the source team.

```python
def extract_insunits(dxf_path: Path) -> int:
    doc = ezdxf.readfile(str(dxf_path))
    insunits = doc.header.get("$INSUNITS", 0)
    if insunits == 0:
        raise ValueError(
            f"$INSUNITS is 0 (undefined) in {dxf_path.name}. "
            "Unit conversion is ambiguous — request a re-export with explicit units."
        )
    return insunits
```

### 3. Xref Geometry Omission

DWG files frequently attach external drawings as Xrefs (`XATTACH`). The ODA CLI by default flattens Xrefs to empty block references — the Xref file is not loaded unless it is present in the same directory. In practice this means spatially critical geometry (site boundaries, existing infrastructure) can disappear silently. Enforce an Xref binding policy at the CAD authoring stage (`XBIND` in AutoCAD before handoff) and add a post-conversion check that compares entity counts between source and converted files.

### 4. ACIS 3D Solid Encryption

`3DSOLID` and `BODY` entities in DWG store geometry as encrypted ACIS (SAT) data. ODA decrypts this correctly when using a licensed build. Pure reverse-engineered readers cannot. If your pipeline ingests 3D solid geometry, verify ODA's ACIS output by opening a sample converted DXF in `ezdxf` and checking that `3DSOLID` entities have non-empty `acis_data` properties.

```python
def check_acis_data(dxf_path: Path) -> dict:
    doc = ezdxf.readfile(str(dxf_path))
    total = encrypted = 0
    for e in doc.modelspace():
        if e.dxftype() in ("3DSOLID", "BODY"):
            total += 1
            if not e.acis_data:
                encrypted += 1
    return {"total_solids": total, "empty_acis": encrypted}
```

For deeper reading on 3D solid extraction strategies, see [Reading 3D Solids with ezdxf Python](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/reading-3d-solids-with-ezdxf-python/).

### 5. Version Downgrade Rounding

When ODA converts AC1032 geometry to an older DXF target (e.g., `ACAD2010`) to work around downstream parser limits, extended precision attributes and certain object class metadata are rounded or dropped. Always confirm your DXF target version against `ezdxf`'s compatibility matrix before setting `dxf_version` in the converter call.

### 6. Xdata and APPID Loss

Extended entity data (`XDATA`) attached by third-party applications is silently dropped during certain ODA conversion configurations. If your pipeline relies on XDATA for BIM property extraction or GIS attribute mapping, verify with `entity.xdata` in `ezdxf` on a known test file immediately after conversion. The [Metadata Extraction Strategies](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/) page covers XDATA parsing and application ID enumeration in detail.

## Validation & Testing

A thorough conversion validation suite compares the pre-conversion DWG (via a minimal header read) with the post-conversion DXF to catch silent data loss. The following test function checks that entity count, layer count, and proxy stub count are within expected bounds.

```python
import pytest                                # pytest>=7.0

def validate_conversion_output(
    dwg_path: Path,
    dxf_path: Path,
    max_proxy_ratio: float = 0.05,
) -> dict:
    """
    Return a validation report dict.
    Raises AssertionError if proxy ratio exceeds threshold.
    """
    doc = ezdxf.readfile(str(dxf_path))
    msp_entities = list(doc.modelspace())
    proxy_count = sum(1 for e in msp_entities if e.dxftype() == "ACAD_PROXY_ENTITY")
    total_count = len(msp_entities)
    layers = {e.dxf.get("layer", "0") for e in msp_entities}

    proxy_ratio = proxy_count / total_count if total_count else 0.0
    assert proxy_ratio <= max_proxy_ratio, (
        f"Proxy entity ratio {proxy_ratio:.1%} exceeds threshold {max_proxy_ratio:.1%} "
        f"— source file likely contains unbound ObjectARX objects"
    )

    return {
        "source": dwg_path.name,
        "dxf": dxf_path.name,
        "entity_count": total_count,
        "proxy_count": proxy_count,
        "layer_count": len(layers),
        "insunits": doc.header.get("$INSUNITS", 0),
    }

def test_conversion_smoke(tmp_path):
    # Supply a known-good DWG fixture in your test data directory
    dwg = Path("tests/fixtures/sample_ac1027.dwg")
    dxf = convert_dwg_to_dxf(dwg, tmp_path)
    report = validate_conversion_output(dwg, dxf)
    assert report["entity_count"] > 0
    assert report["insunits"] != 0, "$INSUNITS must be defined in test fixture"
```

Run this test in CI after every ODA CLI version upgrade. Converter updates occasionally change proxy handling behaviour and XDATA retention in ways that break established pipelines silently.

## Performance & Scale

DWG files in infrastructure and civil engineering contexts routinely exceed 200 MB, and a single project delivery may contain hundreds of files. The following approaches keep throughput high without exhausting memory or file handles.

**Parallel conversion with process pools.** ODA CLI is CPU-bound and does not share state between invocations. Use `concurrent.futures.ProcessPoolExecutor` to saturate cores without the GIL constraint. Limit workers to `os.cpu_count() - 1` to leave headroom for the OS and prevent I/O starvation.

```python
import os
from concurrent.futures import ProcessPoolExecutor, as_completed

def batch_convert(dwg_paths: list[Path], output_dir: Path) -> list[Path]:
    max_workers = max(1, (os.cpu_count() or 2) - 1)
    results = []
    with ProcessPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(convert_dwg_to_dxf, p, output_dir): p for p in dwg_paths}
        for future in as_completed(futures):
            try:
                results.append(future.result())
            except Exception as exc:
                log.error("Conversion failed for %s: %s", futures[future].name, exc)
    return results
```

**Streaming DXF entity traversal.** For very large DXF files (>50 MB), avoid loading the entire document into memory with `ezdxf.readfile`. Use `ezdxf.recover.readfile` with `audit=False` and process entities in chunks.

**Temporary artefact cleanup.** DXF output from ODA can be 3–5× larger than the source DWG due to uncompressed ASCII encoding. Delete converted DXF files immediately after parsing to prevent disk saturation in long-running batch jobs.

```python
from contextlib import contextmanager

@contextmanager
def temporary_dxf(dwg_path: Path, output_dir: Path):
    """Yield the converted DXF path and delete it on exit."""
    dxf_path = convert_dwg_to_dxf(dwg_path, output_dir)
    try:
        yield dxf_path
    finally:
        dxf_path.unlink(missing_ok=True)
```

For parsing patterns specific to DXF layer hierarchies and block decomposition, see the [ezdxf Deep Dive](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/) and the [pydwg Integration](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/) reference.

## FAQ

<details>
<summary>Can Python parse DWG files directly without a proprietary SDK?</summary>

Not reliably for production use. The DWG binary format is undocumented and changes between major AutoCAD releases. Reverse-engineered libraries cover a subset of entity types but have no guarantees on proxy objects, encrypted ACIS solids, or custom object classes. The production-safe path is always: detect version via magic bytes → ODA File Converter → DXF → `ezdxf`. This approach is legally unambiguous and handles the full AutoCAD entity model.

</details>

<details>
<summary>What causes proxy object corruption when converting DWG to DXF?</summary>

Proxy objects are records written by third-party ObjectARX applications (AutoCAD Civil 3D, Plant 3D, Map 3D, Revit links). When the originating application DLL is not loaded, any converter — including ODA — cannot deserialise the object payload and emits an `ACAD_PROXY_ENTITY` stub with no geometry. The fix is upstream: require CAD authors to explode or bind all custom objects before delivery using `EXPORTTOAUTOCAD` or `XBIND` in the source application.

</details>

<details>
<summary>Which DWG versions does the ODA File Converter support?</summary>

ODA 25.x covers AC1.x through AC1032 (AutoCAD 2018). Files written by AutoCAD 2019 and later (AC1033+) require an updated ODA build. Always validate incoming file versions against your deployed ODA build's release notes. For version-specific behavioural differences in section layouts and object serialisation, see [Understanding DWG Version Compatibility](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/understanding-dwg-version-compatibility/).

</details>

<details>
<summary>What is $INSUNITS and why does it matter for GIS ingestion?</summary>

`$INSUNITS` is the DXF header variable (group code 70 in the `$INSUNITS` entry) that declares the drawing unit. Key values: 0=undefined, 1=inches, 2=feet, 4=mm, 6=metres. If it is absent or 0, all coordinates are dimensionless numbers and any CRS reprojection will produce coordinates that are orders of magnitude wrong. Always extract and validate `$INSUNITS` as the first step in spatial normalisation. If the value is 0, reject the file and request a re-export with an explicit unit setting from the originating CAD system.

</details>

<details>
<summary>Does converting DWG to DXF lose layer structure or block definitions?</summary>

Layer table entries, block definitions, and extended entity data (XDATA) are preserved under correctly configured ODA CLI flags with `audit=1`. The main losses are: Xref attachments (flattened to empty references unless the Xref `.dwg` files are co-located), proxy object geometry (replaced with stubs), and encrypted ACIS data on unlicensed ODA builds. Dictionary-based custom properties tied to AEC objects are also at risk if the originating ObjectARX DLL is absent.

</details>

---

## Related Pages

- [Core Format Fundamentals & Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/) — parent section covering DXF, IFC, and DWG format normalisation
- [Understanding DWG Version Compatibility](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/understanding-dwg-version-compatibility/) — version-specific section layouts, magic byte registry, and ODA compatibility matrix
- [DXF Entity Structure Breakdown](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/) — group code taxonomy, entity model, and HEADER variable reference
- [Metadata Extraction Strategies](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/) — XDATA parsing, block attribute extraction, and application ID enumeration
- [IFC4x3 Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/) — IFC class equivalencies and property set translation for BIM pipeline targets
- [pydwg Integration](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/) — related comparison of pydwg vs ODA approaches for DWG layer extraction
- [Auditing and Repairing DXF Files with ezdxf](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/auditing-and-repairing-dxf-files-with-ezdxf/) — the structural gate a converted file should pass before anything parses it
