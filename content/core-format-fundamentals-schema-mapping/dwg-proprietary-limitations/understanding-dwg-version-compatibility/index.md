Understanding DWG version compatibility requires mapping AutoCAD release codes (`ACADxxxx`) to binary schema revisions, as each major release introduces proprietary object extensions, header structure changes, and compression algorithms that break naive parsers. For Python-based CAD/GIS and BIM interoperability pipelines, compatibility is never guaranteed by the `.dwg` extension alone. You must inspect the 6-byte version header, route files through version-aware converters, and implement strict fallbacks for unsupported codes. Direct binary parsing without licensed SDKs violates Autodesk’s intellectual property, which is why production teams rely on [DWG Proprietary Limitations](/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/) workarounds like DXF intermediate conversion or ODA-based translation layers.

## How the 6-Byte Header Dictates Parsing
Every DWG file begins with a 6-byte ASCII version identifier at file offset `0x00`. This string dictates which parser or converter can safely read the file. The format has evolved through multiple binary schema shifts, with Autodesk introducing LZ77 compression in 2004, 64-bit object IDs in 2013, and cloud metadata in 2018. Because the specification remains proprietary, reverse-engineered parsers often fail on newer releases or silently drop custom entities. The [Core Format Fundamentals & Schema Mapping](/core-format-fundamentals-schema-mapping/) layer in your pipeline should normalize these versions before downstream GIS/BIM ingestion.

## ACAD Version Matrix
The table below maps critical `ACAD` codes to their release years, compatibility tiers, and architectural changes. Infrastructure platform teams use this registry to route files safely.

| ACAD Code | Release Year | Compatibility Tier | Key Architectural Changes |
|-----------|--------------|-------------------|---------------------------|
| `AC1009` | R11/R12 | Legacy | Early binary/ASCII hybrid; universally supported |
| `AC1012` | R13 | Stable | First true binary DWG; baseline for legacy GIS |
| `AC1014` | R14 | Stable | Standardized entity dictionaries |
| `AC1015` | 2000 | High | Introduced Object Enablers and proxy objects |
| `AC1018` | 2004 | High | LZ77 compression, 3D solid improvements |
| `AC1021` | 2007 | Moderate | ACIS 7.0 kernel, extended XREF handling |
| `AC1024` | 2010 | Moderate | Dynamic blocks, parametric constraints |
| `AC1027` | 2013 | Low | 64-bit object IDs, new hash tables |
| `AC1032` | 2018–2025 | Low | Enhanced PDF underlay, cloud sync metadata; still the current DWG schema — AutoCAD 2019–2025 retained the R2018 format |
| `AC1035` | — | Reserved | No public DWG format beyond R2018 (`AC1032`) has shipped as of 2026; treat newer codes as unconfirmed |

Files newer than your converter’s maximum supported version will either raise parsing exceptions or silently drop entities. To prevent data loss, implement a three-tier routing strategy:
1. **Header Inspection:** Read the first 6 bytes synchronously before loading the full file into memory.
2. **Version Routing:** Match the header against a known `ACAD` code registry.
3. **Safe Conversion:** Downgrade unsupported versions to a stable baseline (typically `AC1015` or `AC1018`) using an authorized CLI tool. For official reference on supported formats and CLI flags, consult the [Open Design Alliance File Converter documentation](https://www.opendesign.com/guestfiles/oda_file_converter).

## Production Python Implementation
The following module detects DWG versions, routes them to a CLI-based converter, and enforces compatibility boundaries. It assumes `odafileconverter` is installed and available in `$PATH`.

```python
import os
import subprocess
import logging
from pathlib import Path
from typing import Optional, Dict

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# ACAD code to target export version mapping
VERSION_MAP: Dict[bytes, str] = {
    b"AC1009": "R12",
    b"AC1012": "R13",
    b"AC1014": "R14",
    b"AC1015": "2000",
    b"AC1018": "2004",
    b"AC1021": "2007",
    b"AC1024": "2010",
    b"AC1027": "2013",
    b"AC1032": "2018",  # R2018 remains the current DWG format (AutoCAD 2019–2025)
}

# Fallback target for unsupported/newer versions
DEFAULT_EXPORT_VERSION = "2018"

def read_dwg_version(file_path: Path) -> Optional[bytes]:
    """Extract the 6-byte ACAD version header from a DWG file."""
    if not file_path.exists():
        logger.error("File not found: %s", file_path)
        return None
    try:
        with open(file_path, "rb") as f:
            return f.read(6)
    except IOError as e:
        logger.error("Failed to read header: %s", e)
        return None

def convert_dwg(input_path: Path, output_dir: Path, target_version: str = DEFAULT_EXPORT_VERSION) -> Path:
    """Route a DWG file through ODA File Converter for version normalization."""
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / f"{input_path.stem}_v{target_version.replace(' ', '')}.dxf"

    cmd = [
        "odafileconverter",
        str(input_path),
        str(output_dir),
        "DXF",
        target_version
    ]

    logger.info("Converting %s to %s using %s", input_path.name, target_version, cmd[0])
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=120)
        logger.info("Conversion successful: %s", output_file)
        return output_file
    except subprocess.CalledProcessError as e:
        logger.error("Conversion failed: %s", e.stderr)
        raise RuntimeError(f"ODA converter exited with code {e.returncode}") from e
    except FileNotFoundError:
        logger.error("odafileconverter not found in PATH. Install from Open Design Alliance.")
        raise
    except subprocess.TimeoutExpired:
        logger.error("Conversion timed out after 120s")
        raise

def process_dwg_pipeline(file_path: Path, output_dir: Path) -> Path:
    """End-to-end DWG version detection and conversion pipeline."""
    header = read_dwg_version(file_path)
    if not header:
        raise ValueError("Invalid or unreadable DWG file")

    if header not in VERSION_MAP:
        logger.warning("Unknown ACAD code %s. Falling back to %s.", header.decode("ascii", errors="ignore"), DEFAULT_EXPORT_VERSION)
        target = DEFAULT_EXPORT_VERSION
    else:
        target = VERSION_MAP[header]
        logger.info("Detected DWG version %s (AutoCAD %s)", header.decode("ascii"), target)

    return convert_dwg(file_path, output_dir, target)
```

## Fallbacks & Schema Normalization
When a file cannot be converted natively, route it to an intermediate format. DXF remains the most reliable interchange layer because Autodesk publishes the full ASCII specification. Refer to the [Autodesk DXF Reference](https://help.autodesk.com/view/OARX/2024/ENU/?guid=GUID-235B22E0-A567-4CF6-92D3-38A2306D73F3) for entity mapping rules and coordinate system transformations. 

For high-throughput pipelines, implement these safeguards:
- **Pre-flight validation:** Reject files smaller than 1 KB or missing the `ACAD` prefix before invoking subprocesses.
- **Idempotent routing:** Cache converted DXF outputs using a hash of the original file path + target version to avoid redundant conversions.
- **Graceful degradation:** If the CLI converter fails, fall back to a read-only metadata extraction pass that logs the version, layer count, and bounding box without attempting full geometry parsing.
- **Schema normalization:** Strip proxy objects and custom dictionaries during conversion. GIS/BIM engines typically require clean, standardized geometry; retaining proprietary extensions will corrupt spatial joins and coordinate transformations.

By enforcing strict header inspection, version-aware routing, and licensed conversion layers, your interoperability pipeline will maintain deterministic behavior across AutoCAD releases while remaining compliant with Autodesk’s licensing boundaries.