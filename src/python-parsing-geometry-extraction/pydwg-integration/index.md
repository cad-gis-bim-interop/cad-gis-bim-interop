---
title: "DWG-to-Python Integration: Building Reliable CAD Extraction Pipelines"
description: "How to parse DWG files in Python using ODA File Converter, libredwg, and ezdxf — covering version detection, headless conversion, XREF handling, and production scaling patterns."
slug: "pydwg-integration"
breadcrumb:
  - label: "Python Parsing & Geometry Extraction"
    url: "/python-parsing-geometry-extraction/"
  - label: "DWG-to-Python Integration"
    url: "/python-parsing-geometry-extraction/pydwg-integration/"
datePublished: "2024-03-01"
dateModified: "2026-06-24"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "DWG-to-Python Integration: Building Reliable CAD Extraction Pipelines",
      "description": "How to parse DWG files in Python using ODA File Converter, libredwg, and ezdxf — covering version detection, headless conversion, XREF handling, and production scaling patterns.",
      "datePublished": "2024-03-01",
      "dateModified": "2026-06-24",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Python Parsing & Geometry Extraction", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/"},
        {"@type": "ListItem", "position": 2, "name": "DWG-to-Python Integration", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Integrate DWG files into a Python parsing pipeline",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Detect the DWG version from the file header"},
        {"@type": "HowToStep", "position": 2, "name": "Convert DWG to DXF using ODA File Converter or libredwg"},
        {"@type": "HowToStep", "position": 3, "name": "Parse the resulting DXF with ezdxf"},
        {"@type": "HowToStep", "position": 4, "name": "Resolve INSERT entities and block definitions"},
        {"@type": "HowToStep", "position": 5, "name": "Route extracted geometry to downstream BIM or GIS pipelines"}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Is there a pip-installable pydwg package for parsing DWG geometry?",
          "acceptedAnswer": {"@type": "Answer", "text": "No. There is no distributable `pydwg` package on PyPI. References to it in older documentation refer to internal wrappers built on top of ODA or RealDWG libraries. Any tutorial claiming `pip install pydwg` followed by direct DWG geometry access describes a fabricated workflow. Production pipelines either convert DWG to DXF first, or wrap a licensed C++ SDK via subprocess."}
        },
        {
          "@type": "Question",
          "name": "Does libredwg support the current DWG format (AC1032)?",
          "acceptedAnswer": {"@type": "Answer", "text": "libredwg lags behind the official DWG schema by one to two major releases. As of 2026, AC1032 (used by AutoCAD 2019–2026) has partial support, but entity coverage is incomplete compared with the ODA File Converter. For maximum compatibility in production, prefer ODA for AC1032 files and use libredwg only where GPL licensing permits and file vintage is R2013 or earlier."}
        },
        {
          "@type": "Question",
          "name": "Why does the ODA File Converter work on directories, not individual files?",
          "acceptedAnswer": {"@type": "Answer", "text": "The ODA CLI batch-converts all matching files in the source directory in a single pass. To convert a single file, place it in a temporary directory and pass that directory as the input argument. The output directory receives one DXF per DWG found. This design enables bulk conversion without repeated process-start overhead, which matters at scale."}
        },
        {
          "@type": "Question",
          "name": "What happens to XREFs during headless DWG-to-DXF conversion?",
          "acceptedAnswer": {"@type": "Answer", "text": "Headless converters typically drop unbound XREFs or convert them to empty INSERT entities. To preserve referenced geometry, bind all XREFs into the host drawing before conversion using AutoCAD's XBIND command, or automate the binding step via the AutoCAD COM API or a Civil 3D script. After conversion, inspect INSERT entities in the DXF whose block definition has no geometry — those are unresolved XREFs."}
        },
        {
          "@type": "Question",
          "name": "Should I target ACAD2013 or ACAD2018 when converting to DXF?",
          "acceptedAnswer": {"@type": "Answer", "text": "Target ACAD2018 (AC1032) for maximum entity fidelity, including 3D solids, mesh objects, and surface entities. Target ACAD2013 only if a downstream tool has known issues with R2018 DXF. Using ACAD2010 or earlier forces lossy downgrade of newer entities. Always log the target version alongside the source DWG version in your audit record so conversion-introduced regressions are traceable."}
        }
      ]
    }
  ]
}
</script>

# DWG-to-Python Integration: Building Reliable CAD Extraction Pipelines

DWG is the de facto delivery format for AEC projects, yet its proprietary binary structure makes direct Python access non-trivial. No general-purpose pure-Python DWG parser covers the full modern schema. As part of the broader [Python Parsing & Geometry Extraction](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/) pipeline, DWG integration sits at the ingestion boundary: your code must negotiate format version, invoke an external converter, and hand a clean DXF to the rest of the stack before any geometry or attribute work can begin.

Getting this wrong has real costs. A pipeline that silently skips unrecognised DWG versions or drops XREF-bound geometry delivers incomplete spatial data to downstream [Geometry & Mesh Conversion](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/) stages and produces alignment errors when the output feeds GIS validation or IFC assembly workflows.

## Prerequisites

- **Python 3.9+** — type annotations and `pathlib` used throughout.
- **ezdxf ≥ 1.1.0** — `pip install "ezdxf>=1.1.0"` — handles DXF R12 through R2018 after conversion.
- **ODA File Converter** (binary install, free for non-commercial use) or **libredwg ≥ 0.12** (`libredwg` GPL v3) — for DWG-to-DXF conversion; neither is a Python package.
- Familiarity with [DXF entity structure](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/) — group codes, entity handles, and block tables are assumed knowledge.
- Understanding of [DWG version codes and their compatibility constraints](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/understanding-dwg-version-compatibility/) — AC1009 through AC1032 behave differently under every converter.

## Architectural Overview

Production pipelines take one of two approaches. The first — and most widely applicable — converts DWG to DXF offline using the ODA File Converter or `libredwg`, then parses the result with `ezdxf`. The second wraps a licensed SDK (ODA Teigha, RealDWG) through subprocess calls or compiled C-extension bindings, preserving full native access at the cost of licence management and build complexity.

<!-- fig:dwg-two-approaches -->
<svg viewBox="-20 -20 586 194.1" role="img" aria-label="Converting DWG to DXF offline versus reading the binary directly — coverage against deployment cost" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:586px;display:block;margin:1.5rem auto;">
  <title>Convert offline, or read the binary directly</title>
  <desc>The two production approaches to DWG. Converting to DXF first adds a process boundary and a licensed binary to the deployment but gives full, well-understood version coverage and a pure-Python parse afterwards. Reading the binary directly removes the external dependency at the cost of partial and release-dependent coverage. The first is what most pipelines can actually operate.</desc>
  <defs>
    <marker id="pdw1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="pdw1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="586" height="194.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="258" height="130" rx="6" fill="currentColor" fill-opacity="0.11" stroke="currentColor" stroke-width="1.9"/>
  <text x="129" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Convert to DXF first</text>
  <line x1="14" y1="33" x2="244" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="16" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— full version coverage</text>
  <text x="16" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— pure-Python parse afterwards</text>
  <text x="16" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— a licensed binary in the image</text>
  <text x="16" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— a subprocess to supervise</text>
  <rect x="288" y="0" width="258" height="130" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="417" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Read the binary directly</text>
  <line x1="302" y1="33" x2="532" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="304" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— no external dependency</text>
  <text x="304" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— no subprocess</text>
  <text x="304" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— partial version coverage</text>
  <text x="304" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— coverage varies by release</text>
  <text x="273" y="152" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">Coverage is what decides it — a pipeline cannot choose which DWG releases arrive.</text>
</svg>
<!-- /fig:dwg-two-approaches -->

The table below summarises the trade-offs:

| Approach | Tool | Licence | Trade-offs |
|---|---|---|---|
| DWG→DXF | ODA File Converter CLI | Commercial (free non-commercial) | Best compatibility; headless; batch-capable |
| DWG→DXF | `libredwg` CLI | GPL v3 | Open-source; lags on AC1032 entity coverage |
| Native SDK | ODA Teigha (C++) | Commercial | Full entity access; compiled bindings required |
| Header probe only | Python `struct` | None | Version detection only; no geometry extracted |

There is no `pydwg` package on PyPI. References to it in older documentation describe internal wrappers built on top of ODA libraries — not a distributable package. Any pipeline claiming `pip install pydwg` for direct DWG geometry access is fabricated.

The diagram below shows the recommended conversion-first architecture:

<svg viewBox="0 0 640 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="DWG-to-Python pipeline: version probe feeds converter selection, converter produces DXF, ezdxf parses entities, then geometry routes to BIM or GIS" style="width:100%;max-width:640px;display:block;margin:1.5rem auto">
  <title>DWG-to-Python Integration Pipeline</title>
  <desc>Flowchart showing DWG files entering a version probe step, branching to ODA Converter or libredwg based on version, producing a DXF file, parsed by ezdxf, then routing geometry to BIM validation or GIS transformation stages.</desc>
  <rect x="0" y="0" width="640" height="320" fill="var(--color-surface)"/>
  <!-- Stage boxes -->
  <rect x="8" y="130" width="100" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="58" y="149" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">DWG Files</text>
  <text x="58" y="164" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif">(.dwg)</text>
  <rect x="152" y="130" width="120" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="212" y="149" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">Version Probe</text>
  <text x="212" y="164" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif">AC1009 – AC1032</text>
  <!-- Converter branch boxes -->
  <rect x="152" y="30" width="120" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="212" y="49" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">ODA Converter</text>
  <text x="212" y="64" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif">AC1032 / latest</text>
  <rect x="152" y="240" width="120" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="212" y="259" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">libredwg</text>
  <text x="212" y="274" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif">R2013 and earlier</text>
  <rect x="332" y="130" width="100" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="382" y="149" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">DXF Output</text>
  <text x="382" y="164" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif">ezdxf parse</text>
  <rect x="492" y="90" width="110" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="547" y="109" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">BIM Validation</text>
  <text x="547" y="124" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif">IFC assembly</text>
  <rect x="492" y="180" width="110" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="547" y="199" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">GIS Transform</text>
  <text x="547" y="214" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif">CRS alignment</text>
  <!-- Arrows: DWG → Version Probe -->
  <line x1="108" y1="152" x2="150" y2="152" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <!-- Version Probe → ODA (up) -->
  <line x1="212" y1="130" x2="212" y2="76" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <!-- Version Probe → libredwg (down) -->
  <line x1="212" y1="174" x2="212" y2="238" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <!-- ODA → DXF -->
  <path d="M272 52 Q382 52 382 128" fill="none" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <!-- libredwg → DXF -->
  <path d="M272 262 Q382 262 382 176" fill="none" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <!-- DXF → BIM -->
  <line x1="432" y1="145" x2="490" y2="120" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <!-- DXF → GIS -->
  <line x1="432" y1="160" x2="490" y2="195" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <defs>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor"/>
    </marker>
  </defs>
</svg>

## Step-by-Step Implementation

### Step 1: Detect the DWG Version

Read the 6-byte header before invoking any converter. This routes unsupported files immediately, before wasting converter I/O time.

```python
# ezdxf>=1.1.0 not required here; this uses only the stdlib
from pathlib import Path
from typing import Optional

DWG_VERSION_MAP: dict[bytes, str] = {
    b"AC1009": "R12",
    b"AC1012": "R13",
    b"AC1014": "R14",
    b"AC1015": "2000",
    b"AC1018": "2004",
    b"AC1021": "2007",
    b"AC1024": "2010",
    b"AC1027": "2013",
    b"AC1032": "2018",  # AutoCAD 2019–2026 all write the AC1032 schema
}

def detect_dwg_version(file_path: Path) -> Optional[str]:
    """Return the AutoCAD release string or None for unrecognised headers."""
    try:
        with open(file_path, "rb") as fh:
            header = fh.read(6)
        return DWG_VERSION_MAP.get(header)
    except OSError:
        return None
```

Route the result: send AC1032 files to the ODA File Converter, R2013-or-earlier files to `libredwg` if ODA is unavailable, and log any `None` returns as unsupported format errors.

### Step 2: Convert DWG to DXF with ODA File Converter

The ODA File Converter is a binary CLI tool, not a Python library. Invoke it via `subprocess`. The converter operates on directories, not individual files — place each source file in a dedicated temporary directory.

```python
# Requires: ODA File Converter binary installed and on PATH (or provide full path)
import subprocess
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

def convert_dwg_to_dxf(
    dwg_path: Path,
    output_dir: Path,
    dxf_version: str = "ACAD2018",
    converter_exe: str = "ODAFileConverter",
) -> Path:
    """
    Convert a single DWG file to DXF using ODA File Converter.

    ODAFileConverter CLI signature:
        ODAFileConverter <input_dir> <output_dir> <format> <version> <recurse> <audit>

    Args:
        dwg_path:      Path to the .dwg file (must be the sole .dwg in its parent dir,
                       or use a dedicated temp dir to avoid batch collisions).
        output_dir:    Destination directory for the converted .dxf.
        dxf_version:   ODA version string — "ACAD2018" for R2018, "ACAD2013" for R2013.
        converter_exe: Name or absolute path of the ODA CLI binary.

    Returns:
        Path to the generated .dxf file.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        converter_exe,
        str(dwg_path.parent),  # input directory
        str(output_dir),        # output directory
        "DXF",                  # output format
        dxf_version,            # DXF version target
        "0",                    # recurse: 0 = no
        "1",                    # audit: 1 = yes
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        logger.error("ODA conversion failed for %s: %s", dwg_path.name, result.stderr)
        raise RuntimeError(
            f"ODA converter exited with code {result.returncode} for {dwg_path.name}"
        )
    out_path = output_dir / f"{dwg_path.stem}.dxf"
    if not out_path.exists():
        raise FileNotFoundError(f"Expected DXF not found at {out_path}")
    return out_path
```

For `libredwg`, replace the subprocess call with `dwg2dxf <input.dwg> -o <output.dxf>`. The Python wrapper logic around error checking and output path verification remains identical.

### Step 3: Parse the DXF with ezdxf

Once converted, pass the DXF path to `ezdxf`. The full entity and layer APIs are available, identical to parsing a natively authored DXF file. For entity-level detail, consult the [ezdxf Deep Dive](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/).

```python
# ezdxf>=1.1.0
import ezdxf
from typing import Any

def extract_layer_geometry(dxf_path: Path) -> list[dict[str, Any]]:
    """Return entity metadata (layer, type, handle) from the model space."""
    doc = ezdxf.readfile(str(dxf_path))
    msp = doc.modelspace()
    return [
        {
            "layer": entity.dxf.get("layer", "0"),
            "type": entity.dxftype(),
            "handle": entity.dxf.handle,
        }
        for entity in msp
    ]
```

For files exceeding 100 MB, iterate `msp` as a generator (it already is one) rather than wrapping the comprehension in `list()`. This keeps peak memory bounded to entity-batch size rather than total entity count.

### Step 4: Resolve INSERT Entities and Block Definitions

DWG files use blocks extensively. After conversion the DXF's `INSERT` entities reference block definitions in `doc.blocks`. Flatten nested blocks when your downstream stage requires flat geometry:

```python
# ezdxf>=1.1.0
from ezdxf.document import Drawing

def iter_block_geometry(doc: Drawing) -> list[dict[str, Any]]:
    """Yield entity metadata from all named blocks (excludes *Model_Space)."""
    results: list[dict[str, Any]] = []
    for block in doc.blocks:
        if block.name.startswith("*"):  # skip internal layout blocks
            continue
        for entity in block:
            results.append({
                "block": block.name,
                "type": entity.dxftype(),
                "handle": entity.dxf.handle,
            })
    return results
```

## Edge Cases and Gotchas

### Unresolved XREFs Produce Empty INSERT Entities

Headless converters drop unbound external references or write them as empty `INSERT` entities. Detect this before downstream processing:

```python
# ezdxf>=1.1.0
def find_empty_inserts(dxf_path: Path) -> list[str]:
    """Return handles of INSERT entities whose block has no geometry."""
    doc = ezdxf.readfile(str(dxf_path))
    empty = []
    for entity in doc.modelspace().query("INSERT"):
        block_name = entity.dxf.name
        if block_name in doc.blocks:
            if sum(1 for _ in doc.blocks[block_name]) == 0:
                empty.append(entity.dxf.handle)
    return empty
```

Enforce pre-ingestion XRef binding at the CAD authoring stage, or automate `XBIND` via the AutoCAD COM API before conversion.

### $INSUNITS Carries Through to the DXF

The DWG `$INSUNITS` header variable survives conversion. If the source drawing omits it, the DXF will inherit `$INSUNITS=0` (unitless), which causes silent scale errors when [converting CAD local coordinates to EPSG:4326](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/converting-cad-local-coordinates-to-epsg4326/). Always read this header group code after conversion:

```python
# ezdxf>=1.1.0
INSUNITS_MAP = {0: "unitless", 1: "inches", 2: "feet", 4: "mm", 5: "cm", 6: "m"}

def get_drawing_units(dxf_path: Path) -> str:
    doc = ezdxf.readfile(str(dxf_path))
    code = doc.header.get("$INSUNITS", 0)
    return INSUNITS_MAP.get(code, f"unknown ({code})")
```

### AC1032 Files from AutoCAD 2024+ May Use Newer Entity Sub-types

AutoCAD 2024 introduced sub-type changes to `ACDBASSOCNETWORK` and related constraint entities. The ODA converter faithfully translates these, but `ezdxf` may return them as `UNKNOWN` entity types. Filter them before passing to geometry extraction:

```python
UNSUPPORTED_TYPES = {"ACDBASSOCNETWORK", "ACDBPERSSUBENTMANAGER", "ACDBBODYITEM"}

def filter_supported_entities(entities):
    return [e for e in entities if e.dxftype() not in UNSUPPORTED_TYPES]
```

### libredwg Silently Truncates Arc Definitions on R2004 Files

`libredwg` 0.12–0.13 incorrectly reads some `ARC` entities in AC1018 (R2004) files, writing zero-radius arcs to the output DXF. Validate arc radius after parsing and route affected files to ODA conversion as a fallback:

```python
# ezdxf>=1.1.0
def validate_arcs(dxf_path: Path) -> list[str]:
    """Return handles of zero-radius ARC entities (libredwg truncation indicator)."""
    doc = ezdxf.readfile(str(dxf_path))
    return [
        e.dxf.handle
        for e in doc.modelspace().query("ARC")
        if e.dxf.radius == 0.0
    ]
```

### Batch Directory Collisions When Converting Multiple Files

The ODA converter processes all `.dwg` files in the input directory in one pass. Running concurrent converter invocations against the same input directory causes output file collisions. Assign each file a unique temporary subdirectory:

```python
import tempfile

def safe_convert(dwg_path: Path, output_root: Path) -> Path:
    with tempfile.TemporaryDirectory(dir=output_root) as tmp_in:
        import shutil
        tmp_dwg = Path(tmp_in) / dwg_path.name
        shutil.copy2(dwg_path, tmp_dwg)
        return convert_dwg_to_dxf(tmp_dwg, output_root / dwg_path.stem)
```

## Validation and Testing

After conversion and parsing, verify round-trip fidelity at three levels:

<!-- fig:dwg-roundtrip-checks -->
<svg viewBox="-45 -20 493.8 236.6" role="img" aria-label="Entity counts per type, drawing extents and the layer table — three round-trip checks after a DWG conversion" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:494px;display:block;margin:1.5rem auto;">
  <title>Three levels of round-trip verification</title>
  <desc>Three checks after a conversion, in increasing strength. Counting entities per type catches a converter that dropped a class. Comparing drawing extents catches a unit or placement change. Comparing the layer table catches a conversion that flattened or renamed layers. Each is cheap, and together they turn a converter's exit code into an actual claim about the output.</desc>
  <defs>
    <marker id="pdw2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="pdw2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-45" y="-20" width="493.8" height="236.6" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="268" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="134" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Entity counts per type</text>
  <text x="134" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">in versus out</text>
  <circle cx="-14" cy="24.1" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="27.6" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">1</text>
  <text x="286" y="27.6" font-size="9.5" fill="currentColor" fill-opacity="0.75">catches a dropped class</text>
  <rect x="0" y="74.2" width="268" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="134" y="94.5" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Drawing extents</text>
  <text x="134" y="108.2" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">$EXTMIN / $EXTMAX</text>
  <circle cx="-14" cy="98.3" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="101.8" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">2</text>
  <text x="286" y="101.8" font-size="9.5" fill="currentColor" fill-opacity="0.75">catches a unit or placement shift</text>
  <rect x="0" y="148.4" width="268" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="134" y="168.7" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Layer table</text>
  <text x="134" y="182.4" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">names, colours, states</text>
  <circle cx="-14" cy="172.5" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="176" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">3</text>
  <text x="286" y="176" font-size="9.5" fill="currentColor" fill-opacity="0.75">catches flattening and renaming</text>
  <line x1="134" y1="48.2" x2="134" y2="74.2" stroke="currentColor" stroke-width="1.4" marker-end="url(#pdw2-a)"/>
  <line x1="134" y1="122.4" x2="134" y2="148.4" stroke="currentColor" stroke-width="1.4" marker-end="url(#pdw2-a)"/>
</svg>
<!-- /fig:dwg-roundtrip-checks -->

1. **Entity count parity** — compare entity counts between the DWG version reported by your CAD authoring tool and the parsed DXF. A significant drop (>5%) indicates converter coverage gaps.
2. **Bounding box sanity** — compute the model space bounding box using `ezdxf`'s `bbox` utility and confirm it matches the design extents stored in `$EXTMIN`/`$EXTMAX`.
3. **Layer inventory** — assert that every layer name in `doc.layers` appears at least once in the entity layer attributes. Orphaned layers indicate dropped entities.

```python
# ezdxf>=1.1.0
from ezdxf import bbox as ezdxf_bbox

def validate_conversion(dxf_path: Path) -> dict[str, Any]:
    doc = ezdxf.readfile(str(dxf_path))
    msp = doc.modelspace()
    entities = list(msp)
    extents = ezdxf_bbox.extents(msp, fast=True)
    return {
        "entity_count": len(entities),
        "layer_count": len(doc.layers),
        "extents_valid": extents is not None,
        "insunits": doc.header.get("$INSUNITS", 0),
    }
```

Run this function as part of a pytest fixture for every file in your test corpus:

```python
# ezdxf>=1.1.0; pytest>=7.0
import pytest

@pytest.mark.parametrize("dxf_file", list(Path("tests/fixtures/dxf").glob("*.dxf")))
def test_conversion_validity(dxf_file: Path) -> None:
    result = validate_conversion(dxf_file)
    assert result["entity_count"] > 0, f"No entities in {dxf_file.name}"
    assert result["extents_valid"], f"Invalid bounding box in {dxf_file.name}"
```

## Performance and Scale

High-volume DWG conversion introduces predictable bottlenecks. Address them systematically:

**Parallelised conversion.** Each ODA CLI invocation is a separate OS process with no shared memory. Run one converter process per CPU core using `concurrent.futures.ProcessPoolExecutor`. Assign each file its own temporary input directory (see the `safe_convert` pattern above).

**Idempotent output caching.** Hash the DWG file path and target DXF version string to produce a cache key. Skip conversion entirely if the output DXF already exists under that key. This eliminates redundant work during pipeline retries after partial failures.

**Memory-bounded entity iteration.** For DXF files exceeding 100 MB, iterate the model space generator directly rather than materialising the full entity list. `ezdxf` yields entities lazily from its internal structure.

**Error budgeting.** Set a per-batch failure threshold — for example, 5%. If the converter fails on more than that fraction of files, halt and emit a diagnostic report rather than silently dropping data. Record `dwg_version`, `conversion_duration_ms`, `entity_count`, `layer_count`, and `converter_exit_code` for every file in structured logs. Non-zero failure rates on specific version codes indicate a converter binary upgrade is needed.

**Downstream routing.** Once geometry is extracted, route it according to target system requirements. For openBIM workflows via the [ifcopenshell Workflow](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/), align the extraction schema with IFC property sets before ingestion. For GIS pipelines applying [CRS Normalization Workflows](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/), apply affine transformations and record the original insertion point, scale factor, and rotation angle in a companion metadata table to enable reversible georeferencing.

## FAQ

<details>
<summary>Is there a pip-installable pydwg package for parsing DWG geometry?</summary>

No. There is no distributable `pydwg` package on PyPI. References to it in older documentation describe internal wrappers built on top of ODA or RealDWG libraries. Production pipelines either convert DWG to DXF first, or wrap a licensed C++ SDK via subprocess.

</details>

<details>
<summary>Does libredwg support the current DWG format (AC1032)?</summary>

`libredwg` lags behind the official DWG schema by one to two major releases. As of 2026, AC1032 has partial support, but entity coverage is incomplete compared with the ODA File Converter. For maximum compatibility, prefer ODA for AC1032 files and use `libredwg` only where GPL licensing is acceptable and file vintage is R2013 or earlier.

</details>

<details>
<summary>Why does the ODA File Converter work on directories, not individual files?</summary>

The ODA CLI batch-converts all matching files in a source directory in one pass. To convert a single file, place it in a temporary directory and pass that directory as the input argument. This design enables bulk conversion without repeated process-start overhead, which matters at scale.

</details>

<details>
<summary>What happens to XREFs during headless DWG-to-DXF conversion?</summary>

Headless converters typically drop unbound XREFs or write them as empty INSERT entities. Bind all XREFs into the host drawing before conversion using AutoCAD's `XBIND` command or COM automation. After conversion, inspect INSERT entities whose block definition contains no geometry — those are unresolved XREFs.

</details>

<details>
<summary>Should I target ACAD2013 or ACAD2018 when converting to DXF?</summary>

Target ACAD2018 (AC1032) for maximum entity fidelity, including 3D solids, mesh objects, and surface entities. Use ACAD2013 only if a downstream tool has documented issues with R2018 DXF. Using ACAD2010 or earlier forces lossy downgrade of newer entities. Always log the target version alongside the source DWG version in your audit record.

</details>

## Related Pages

- [Python Parsing & Geometry Extraction](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/) — parent pipeline overview
- [ezdxf Deep Dive](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/) — full entity and layer API reference for the DXF files this workflow produces
- [Parsing DWG Layers with Python Scripts](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/parsing-dwg-layers-with-python-scripts/) — layer-scoped extraction after conversion
- [Understanding DWG Version Compatibility](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/understanding-dwg-version-compatibility/) — DWG schema evolution and AC-code reference
- [CRS Normalization Workflows](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/) — georeferencing the geometry this pipeline extracts
- [Running the ODA File Converter in Docker](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/running-the-oda-file-converter-in-docker/) — packaging a desktop converter for a headless container, with a health check that actually converts
