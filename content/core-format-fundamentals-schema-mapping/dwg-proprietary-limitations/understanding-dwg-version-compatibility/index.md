---
title: "Detecting and Routing DWG Version Compatibility in Python Pipelines"
description: "Read the 6-byte ACAD header, map it to the correct AutoCAD release schema, and route DWG files through version-aware converters to prevent silent data loss in CAD/GIS/BIM interoperability pipelines."
slug: "understanding-dwg-version-compatibility"
breadcrumb:
  - label: "Core Format Fundamentals & Schema Mapping"
    url: "/core-format-fundamentals-schema-mapping/"
  - label: "DWG Proprietary Limitations"
    url: "/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/"
  - label: "Detecting and Routing DWG Version Compatibility in Python Pipelines"
    url: "/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/understanding-dwg-version-compatibility/"
datePublished: "2025-01-15"
dateModified: "2026-06-24"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Detecting and Routing DWG Version Compatibility in Python Pipelines",
      "description": "Read the 6-byte ACAD header, map it to the correct AutoCAD release schema, and route DWG files through version-aware converters to prevent silent data loss in CAD/GIS/BIM interoperability pipelines.",
      "datePublished": "2025-01-15",
      "dateModified": "2026-06-24",
      "author": {"@type": "Organization", "name": "CAD GIS BIM Interop"},
      "publisher": {"@type": "Organization", "name": "CAD GIS BIM Interop"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Core Format Fundamentals & Schema Mapping", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/"},
        {"@type": "ListItem", "position": 2, "name": "DWG Proprietary Limitations", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/"},
        {"@type": "ListItem", "position": 3, "name": "Detecting and Routing DWG Version Compatibility in Python Pipelines", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/understanding-dwg-version-compatibility/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Detecting and Routing DWG Version Compatibility in Python Pipelines",
      "description": "Inspect the DWG 6-byte ACAD version header, map it to the correct schema release, and route files through an authorised CLI converter to prevent silent data loss.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Read the 6-byte header", "text": "Open the DWG file in binary mode and read the first 6 bytes to extract the ACAD version code."},
        {"@type": "HowToStep", "position": 2, "name": "Map the code to a schema release", "text": "Look up the byte string in the VERSION_MAP dictionary to determine the AutoCAD release and the appropriate export target."},
        {"@type": "HowToStep", "position": 3, "name": "Route to version-aware converter", "text": "Pass the file and target version string to odafileconverter, capturing stderr for structured error logging."},
        {"@type": "HowToStep", "position": 4, "name": "Apply fallback on unknown codes", "text": "If the code is absent from the registry, fall back to AC1032 (R2018) and emit a structured warning before conversion."},
        {"@type": "HowToStep", "position": 5, "name": "Normalise the output schema", "text": "Strip proxy objects and custom dictionaries from the converted DXF before handing off to GIS or BIM ingestion stages."}
      ]
    }
  ]
}
</script>

# Detecting and Routing DWG Version Compatibility in Python Pipelines

Detecting DWG version compatibility requires mapping the 6-byte `ACADxxxx` binary header at file offset `0x00` to a schema revision, then routing the file through a version-aware converter before any GIS or BIM ingestion stage runs. The `.dwg` extension alone carries no schema guarantee — each major AutoCAD release introduces new compression algorithms, object-ID widths, or cloud metadata blocks that silently corrupt naive parsers. As part of the [DWG Proprietary Limitations](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/) workflow, header-first routing is the minimal safeguard that keeps interoperability pipelines deterministic.

---

## How the 6-Byte Header Controls Parsing

Every DWG file stores a 6-byte ASCII version string starting at file offset `0x00`. This code is the sole reliable signal of the binary schema in use — no reliable fallback exists once parsing has started. Autodesk introduced `LZ77` section compression at `AC1018` (2004), widened object IDs from 32-bit to 64-bit at `AC1027` (2013), and embedded cloud-sync metadata blocks at `AC1032` (2018). Each change breaks parsers that were not written against that schema.

Because the DWG specification is proprietary, reverse-engineered parsers — including the Open Design Alliance (ODA) libraries — sometimes fail silently on unsupported codes rather than raising exceptions. This means the failure mode you must guard against is not a crash but a silently truncated geometry set that passes downstream validation while missing entire layer groups or 3D solids. The [Core Format Fundamentals & Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/) layer in your pipeline is the right place to gate files by version before any geometry or attribute extraction runs.

<!-- fig:dwg-header-bytes -->
<svg viewBox="-20 -20 413.4 137.1" role="img" aria-label="The first six ASCII bytes of a DWG file carry the version code, and everything after them is schema-dependent" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>The six bytes at offset zero</title>
  <desc>The opening bytes of a DWG file. The first six ASCII characters are the version code; the bytes that follow are already schema-dependent, which is why the code has to be read before anything else is interpreted. Reading six bytes costs one seek and settles which parser, converter target and fallback path apply.</desc>
  <defs>
    <marker id="ver1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ver1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="413.4" height="137.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="186.7" height="73" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.5"/>
  <text x="14" y="16" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">0x00  41 43 31 30 33 32</text>
  <line x1="192.7" y1="12.9" x2="224.7" y2="12.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="232.7" y="16" font-size="9.5" fill="currentColor" fill-opacity="0.78">six ASCII bytes</text>
  <text x="14" y="35" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">       A  C  1  0  3  2</text>
  <line x1="192.7" y1="31.9" x2="224.7" y2="31.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="232.7" y="35" font-size="9.5" fill="currentColor" fill-opacity="0.78">&quot;AC1032&quot; → R2018</text>
  <text x="14" y="54" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.55">0x06  00 00 00 00 …</text>
  <line x1="192.7" y1="50.9" x2="224.7" y2="50.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="232.7" y="54" font-size="9.5" fill="currentColor" fill-opacity="0.78">schema-dependent from here on</text>
  <text x="0" y="95" font-size="9.5" fill="currentColor" fill-opacity="0.7">One seek, six bytes: enough to route the file without opening a converter.</text>
</svg>
<!-- /fig:dwg-header-bytes -->

<svg viewBox="4 94 750 153" role="img" aria-label="DWG version routing pipeline: header inspection, version lookup, converter routing, and schema normalisation stages" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:760px;display:block;margin:1.5rem auto;">
  <title>DWG Version Routing Pipeline</title>
  <desc>Four-stage pipeline diagram showing: 1) Read 6-byte header from DWG file, 2) Lookup ACAD code in version registry, 3) Route to ODA converter with target version, 4) Normalised DXF output for GIS/BIM ingestion.</desc>
  <defs>
    <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" opacity="0.7"/>
    </marker>
  </defs>
  <rect x="4" y="94" width="750" height="153" fill="var(--color-surface)"/>
  <!-- Stage boxes -->
  <!-- Stage 1 -->
  <rect x="20" y="110" width="140" height="70" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.8"/>
  <text x="90" y="138" text-anchor="middle" font-size="12" font-family="system-ui,sans-serif" fill="currentColor" font-weight="600">DWG File</text>
  <text x="90" y="155" text-anchor="middle" font-size="11" font-family="system-ui,sans-serif" fill="currentColor" opacity="0.75">Read 6 bytes</text>
  <text x="90" y="171" text-anchor="middle" font-size="10" font-family="monospace,monospace" fill="currentColor" opacity="0.65">offset 0x00</text>
  <!-- Arrow 1→2 -->
  <line x1="160" y1="145" x2="196" y2="145" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrowhead)" opacity="0.7"/>
  <!-- Stage 2 -->
  <rect x="200" y="110" width="150" height="70" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.8"/>
  <text x="275" y="138" text-anchor="middle" font-size="12" font-family="system-ui,sans-serif" fill="currentColor" font-weight="600">Version Registry</text>
  <text x="275" y="155" text-anchor="middle" font-size="11" font-family="system-ui,sans-serif" fill="currentColor" opacity="0.75">ACAD code lookup</text>
  <text x="275" y="171" text-anchor="middle" font-size="10" font-family="system-ui,sans-serif" fill="currentColor" opacity="0.65">→ export target</text>
  <!-- Arrow 2→3 -->
  <line x1="350" y1="145" x2="386" y2="145" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrowhead)" opacity="0.7"/>
  <!-- Stage 3 -->
  <rect x="390" y="110" width="160" height="70" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.8"/>
  <text x="470" y="138" text-anchor="middle" font-size="12" font-family="system-ui,sans-serif" fill="currentColor" font-weight="600">ODA Converter</text>
  <text x="470" y="155" text-anchor="middle" font-size="11" font-family="system-ui,sans-serif" fill="currentColor" opacity="0.75">odafileconverter</text>
  <text x="470" y="171" text-anchor="middle" font-size="10" font-family="system-ui,sans-serif" fill="currentColor" opacity="0.65">DWG → DXF</text>
  <!-- Arrow 3→4 -->
  <line x1="550" y1="145" x2="586" y2="145" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrowhead)" opacity="0.7"/>
  <!-- Stage 4 -->
  <rect x="590" y="110" width="148" height="70" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.8"/>
  <text x="664" y="138" text-anchor="middle" font-size="12" font-family="system-ui,sans-serif" fill="currentColor" font-weight="600">Normalised DXF</text>
  <text x="664" y="155" text-anchor="middle" font-size="11" font-family="system-ui,sans-serif" fill="currentColor" opacity="0.75">proxy objects stripped</text>
  <text x="664" y="171" text-anchor="middle" font-size="10" font-family="system-ui,sans-serif" fill="currentColor" opacity="0.65">GIS / BIM ingestion</text>
  <!-- Fallback path label -->
  <text x="275" y="228" text-anchor="middle" font-size="10" font-family="system-ui,sans-serif" fill="currentColor" opacity="0.6">unknown code → fall back to AC1032</text>
  <line x1="275" y1="180" x2="275" y2="215" stroke="currentColor" stroke-width="1" stroke-dasharray="4 3" opacity="0.5" marker-end="url(#arrowhead)"/>
  <!-- Labels below boxes -->
  <text x="90" y="198" text-anchor="middle" font-size="10" font-family="system-ui,sans-serif" fill="currentColor" opacity="0.55">Stage 1</text>
  <text x="275" y="198" text-anchor="middle" font-size="10" font-family="system-ui,sans-serif" fill="currentColor" opacity="0.55">Stage 2</text>
  <text x="470" y="198" text-anchor="middle" font-size="10" font-family="system-ui,sans-serif" fill="currentColor" opacity="0.55">Stage 3</text>
  <text x="664" y="198" text-anchor="middle" font-size="10" font-family="system-ui,sans-serif" fill="currentColor" opacity="0.55">Stage 4</text>
</svg>

### ACAD Version Registry

The table below maps every `ACAD` code encountered in production to its AutoCAD release year, a routing compatibility tier, and the architectural changes that affect parser behaviour.

| ACAD Code | Release | Routing Tier | Key Schema Changes |
|-----------|---------|-------------|-------------------|
| `AC1009` | R11 / R12 | Legacy — universal | Early binary/ASCII hybrid; all ODA versions accept this |
| `AC1012` | R13 | Stable | First fully binary DWG; baseline for legacy GIS ingestion |
| `AC1014` | R14 | Stable | Standardised entity dictionaries; widely interoperable |
| `AC1015` | 2000 | High | Object Enablers and proxy objects introduced |
| `AC1018` | 2004 | High | `LZ77` section compression; 3D solid kernel update |
| `AC1021` | 2007 | Moderate | ACIS 7.0 kernel; extended `XREF` handling |
| `AC1024` | 2010 | Moderate | Dynamic blocks; parametric constraints added |
| `AC1027` | 2013 | Low | 64-bit object IDs; new hash-table structures |
| `AC1032` | 2018–2026 | Low | PDF underlay enhancement; cloud-sync metadata; current schema — AutoCAD 2019–2026 all use R2018 |
| Unknown | — | Reject / warn | No public DWG schema beyond `AC1032` has shipped as of mid-2026; treat unrecognised codes as unconfirmed and apply the `AC1032` fallback |

Files whose `ACAD` code exceeds your converter's maximum supported version will either raise a parsing exception or — more dangerously — silently drop entities. The three-stage routing strategy is:

1. **Header inspection:** read the first 6 bytes synchronously before loading the full binary into memory.
2. **Code lookup:** match the header against the registry; emit a structured warning and apply the fallback version for any code not in the map.
3. **Authorised conversion:** downgrade to a stable baseline (`AC1015` or `AC1018` for most GIS consumers) using the ODA File Converter CLI — see the [Open Design Alliance File Converter documentation](https://www.opendesign.com/guestfiles/oda_file_converter) for supported flags.

---

## Production-Ready Script

The module below detects the DWG version, resolves the export target from the registry, calls `odafileconverter`, and enforces all four fallback paths. It requires Python 3.9+ and `odafileconverter` on `$PATH`.

```python
# dwg_version_router.py
# Requires: Python >= 3.9, odafileconverter installed from Open Design Alliance
import os
import subprocess
import logging
from pathlib import Path
from typing import Optional

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Maps 6-byte ACAD header bytes to the ODA File Converter target-version string.
# AC1032 is the current DWG schema; AutoCAD 2019–2026 all write this version.
VERSION_MAP: dict[bytes, str] = {
    b"AC1009": "R12",
    b"AC1012": "R13",
    b"AC1014": "R14",
    b"AC1015": "2000",
    b"AC1018": "2004",
    b"AC1021": "2007",
    b"AC1024": "2010",
    b"AC1027": "2013",
    b"AC1032": "2018",
}

# Fallback target for any unrecognised ACAD code (e.g. future releases).
FALLBACK_VERSION = "2018"

# Minimum plausible DWG file size; rejects stubs and zero-byte placeholders.
MIN_DWG_BYTES = 1024


def read_dwg_version(file_path: Path) -> Optional[bytes]:
    """
    Extract the 6-byte ACAD version header from a DWG file.

    Returns None on I/O error or if the file is smaller than MIN_DWG_BYTES.
    Does NOT raise — callers must treat None as a hard rejection signal.
    """
    if not file_path.exists():
        logger.error("File not found: %s", file_path)
        return None
    if file_path.stat().st_size < MIN_DWG_BYTES:
        logger.error(
            "File too small (%d bytes); rejecting before subprocess invocation: %s",
            file_path.stat().st_size,
            file_path,
        )
        return None
    try:
        with open(file_path, "rb") as fh:
            header = fh.read(6)
        if not header.startswith(b"AC"):
            logger.error(
                "Missing ACAD prefix in first 6 bytes of %s — not a DWG file",
                file_path,
            )
            return None
        return header
    except OSError as exc:
        logger.error("Failed to read header from %s: %s", file_path, exc)
        return None


def convert_dwg_to_dxf(
    input_path: Path,
    output_dir: Path,
    target_version: str = FALLBACK_VERSION,
    timeout_seconds: int = 120,
) -> Path:
    """
    Convert a DWG file to DXF at the given target version using odafileconverter.

    Raises RuntimeError on non-zero exit, FileNotFoundError if the CLI is absent,
    and TimeoutExpired if conversion exceeds timeout_seconds.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    safe_version = target_version.replace(" ", "")
    output_path = output_dir / f"{input_path.stem}_v{safe_version}.dxf"

    cmd = [
        "odafileconverter",
        str(input_path.parent),  # ODA takes an input directory
        str(output_dir),
        "DXF",
        target_version,
        "0",   # recurse flag (0 = no recursion)
        "1",   # audit flag (1 = audit on read)
    ]
    logger.info(
        "Converting %s → DXF (target schema: %s)", input_path.name, target_version
    )
    try:
        result = subprocess.run(
            cmd,
            check=True,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
        )
        if result.stdout:
            logger.debug("odafileconverter stdout: %s", result.stdout.strip())
        logger.info("Conversion complete: %s", output_path)
        return output_path
    except subprocess.CalledProcessError as exc:
        logger.error(
            "odafileconverter exited %d: %s", exc.returncode, exc.stderr.strip()
        )
        raise RuntimeError(
            f"ODA converter failed with exit code {exc.returncode}"
        ) from exc
    except FileNotFoundError:
        logger.error(
            "odafileconverter not found in PATH — install from Open Design Alliance"
        )
        raise
    except subprocess.TimeoutExpired:
        logger.error("Conversion timed out after %ds for %s", timeout_seconds, input_path)
        raise


def process_dwg(file_path: Path, output_dir: Path) -> Path:
    """
    End-to-end DWG version detection and DXF conversion pipeline.

    Returns the Path to the converted DXF file ready for GIS or BIM ingestion.
    """
    header = read_dwg_version(file_path)
    if header is None:
        raise ValueError(f"Cannot process {file_path}: invalid or unreadable DWG")

    if header not in VERSION_MAP:
        logger.warning(
            "Unrecognised ACAD code %r — applying fallback target %s",
            header.decode("ascii", errors="replace"),
            FALLBACK_VERSION,
        )
        target = FALLBACK_VERSION
    else:
        target = VERSION_MAP[header]
        logger.info(
            "Detected %s → AutoCAD %s",
            header.decode("ascii"),
            target,
        )

    return convert_dwg_to_dxf(file_path, output_dir, target)


# ---------------------------------------------------------------------------
# CLI usage example
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys

    if len(sys.argv) != 3:
        print("Usage: python dwg_version_router.py <input.dwg> <output_dir>")
        sys.exit(1)

    dxf_out = process_dwg(Path(sys.argv[1]), Path(sys.argv[2]))
    print(f"Output: {dxf_out}")
```

Key implementation notes:

- `odafileconverter` takes an **input directory**, not an individual file path. The script passes `input_path.parent` so only the target file is in scope; isolate files in a temporary directory if you process batches to avoid converting siblings.
- The audit flag (`1`) instructs ODA to run an internal consistency check on read, which surfaces corrupted entity references that would otherwise produce silent geometry gaps.
- `capture_output=True` prevents ODA's verbose progress output from polluting the calling process's stdout while still making stderr available for structured error logging.
- Cache converted DXF outputs by hashing `input_path` + `target_version` to avoid redundant conversions in high-throughput pipelines. A simple `{hash}.dxf` naming convention in a shared cache directory is sufficient.

---

## Compatibility Matrix

| Component | Supported Range | Notes |
|-----------|----------------|-------|
| Python | 3.9 – 3.13 | Uses `dict[bytes, str]` PEP 585 syntax; requires 3.9+ |
| odafileconverter | ODA 25.x – 26.x | Free download from Open Design Alliance; no Python binding — subprocess only |
| Input DWG schema | `AC1009` – `AC1032` | `AC1032` is the current ceiling; codes beyond it are treated as unknown |
| Output DXF target | R12 – 2018 | R2018 (`AC1032`) is the recommended target for ezdxf and most GIS consumers |
| Operating system | Linux, Windows, macOS | `odafileconverter` ships as a native binary per platform; PATH setup differs |
| [ezdxf](https://ezdxf.readthedocs.io/) downstream | ezdxf >= 1.1.0 | Use ezdxf to parse the converted DXF for geometry extraction and layer filtering |

---

## Fallback Strategies and Troubleshooting

**1. `FileNotFoundError: odafileconverter`**
The ODA binary is not on `$PATH`. On Linux, install the `.run` bundle from the Open Design Alliance and add the install directory to `~/.bashrc`. On Docker-based pipelines, bake the binary into the image and verify with `which odafileconverter` at container startup.

<!-- fig:dwg-convert-sequence -->
<svg viewBox="-20 -20 558 286" role="img" aria-label="Read the signature, resolve an export target, run the converter under a timeout, then verify by opening the DXF rather than trusting the exit code" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:558px;display:block;margin:1.5rem auto;">
  <title>The detect, convert, verify loop</title>
  <desc>A call sequence. The pipeline reads the signature itself, asks the registry for an export target, invokes the ODA File Converter under a timeout, and then verifies the produced DXF by opening it rather than trusting the converter exit code. A converter that exits zero having written nothing usable is a routine failure mode.</desc>
  <defs>
    <marker id="ver2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ver2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="558" height="286" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="158" height="34" rx="6" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-width="1.4"/>
  <text x="79" y="21" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">pipeline</text>
  <line x1="79" y1="34" x2="79" y2="246" stroke="currentColor" stroke-width="1" stroke-opacity="0.28" stroke-dasharray="4 4"/>
  <rect x="180" y="0" width="158" height="34" rx="6" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-width="1.4"/>
  <text x="259" y="21" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">ODA converter</text>
  <line x1="259" y1="34" x2="259" y2="246" stroke="currentColor" stroke-width="1" stroke-opacity="0.28" stroke-dasharray="4 4"/>
  <rect x="360" y="0" width="158" height="34" rx="6" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-width="1.4"/>
  <text x="439" y="21" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">ezdxf</text>
  <line x1="439" y1="34" x2="439" y2="246" stroke="currentColor" stroke-width="1" stroke-opacity="0.28" stroke-dasharray="4 4"/>
  <path d="M 79 52 L 105 52 L 105 66 L 82 66" fill="none" stroke="currentColor" stroke-width="1.3" marker-end="url(#ver2-a)"/>
  <text x="113" y="62" font-size="9.5" fill="currentColor" fill-opacity="0.8">read 6 bytes at 0x00</text>
  <line x1="79" y1="100" x2="259" y2="100" stroke="currentColor" stroke-width="1.3" marker-end="url(#ver2-a)"/>
  <text x="169" y="93" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.8">convert to target release</text>
  <line x1="259" y1="140" x2="79" y2="140" stroke="currentColor" stroke-width="1.3" stroke-dasharray="5 4" marker-end="url(#ver2-o)"/>
  <text x="169" y="133" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.8">exit code + DXF on disk</text>
  <line x1="79" y1="180" x2="439" y2="180" stroke="currentColor" stroke-width="1.3" marker-end="url(#ver2-a)"/>
  <text x="259" y="173" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.8">readfile() the output</text>
  <line x1="439" y1="220" x2="79" y2="220" stroke="currentColor" stroke-width="1.3" stroke-dasharray="5 4" marker-end="url(#ver2-o)"/>
  <text x="259" y="213" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.8">entity counts</text>
</svg>
<!-- /fig:dwg-convert-sequence -->

**2. Unrecognised ACAD code in the registry**
If `read_dwg_version` returns a header not in `VERSION_MAP` (e.g. a future `AC1035`), the pipeline logs a warning and attempts `AC1032` as the conversion target. If ODA also rejects that code, the only option is a read-only metadata pass: log the raw header bytes, the file size, and any layer names extractable from the ASCII sections of the DWG header, then quarantine the file for manual review.

**3. Silent entity loss after conversion**
Compare the layer count in the input DWG (readable via `odafileconverter` audit output or a lightweight binary scan for the `LAYER` section marker) against the layer count in the converted DXF parsed with [ezdxf](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/). A mismatch signals proxy objects that were silently dropped. Re-run with a lower target version (`AC1015`) to see if ODA can reconstruct the geometry without the proprietary extensions.

**4. `RuntimeError: ODA converter failed with exit code 1`**
ODA exit code 1 usually indicates an encrypted or password-protected DWG. There is no programmatic bypass — request an unprotected export from the source. Log the file hash and notify the upstream data provider.

**5. Conversion timeout on large DWG files**
Increase `timeout_seconds` in `convert_dwg_to_dxf`. For files above 500 MB, pre-split the DWG into model-space and paper-space portions using an authorised tool before invoking the converter; monolithic files with thousands of xrefs frequently exceed 120-second limits on commodity hardware.

---

## Related Pages

- [DWG Proprietary Limitations](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/) — parent: routing strategies, ODA environment setup, and licensing boundaries
- [Core Format Fundamentals & Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/) — section overview: format normalisation, schema mapping, and pipeline architecture
- [DXF Entity Structure Breakdown](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/) — sibling guide: group code taxonomy and entity parsing after DWG-to-DXF conversion
- [How to Parse DXF Headers with Python](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/how-to-parse-dxf-headers-with-python/) — downstream task: extracting `$ACADVER`, `$INSUNITS`, and variable section values from the converted DXF output
- [pydwg Integration](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/) — related: alternative DWG parsing approach using pydwg without an ODA converter dependency
