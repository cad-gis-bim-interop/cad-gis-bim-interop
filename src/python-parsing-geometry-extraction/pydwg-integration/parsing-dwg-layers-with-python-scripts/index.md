---
title: "Parsing DWG Layers with Python Scripts"
description: "Step-by-step guide to extracting DWG layer metadata, visibility states, and entity counts in Python using the DWG→DXF→ezdxf pipeline. Includes a production-ready script, compatibility matrix, and concrete troubleshooting steps."
slug: "parsing-dwg-layers-with-python-scripts"
breadcrumb:
  - label: "Python Parsing & Geometry Extraction"
    url: "/python-parsing-geometry-extraction/"
  - label: "DWG-to-Python Integration"
    url: "/python-parsing-geometry-extraction/pydwg-integration/"
  - label: "Parsing DWG Layers with Python Scripts"
    url: "/python-parsing-geometry-extraction/pydwg-integration/parsing-dwg-layers-with-python-scripts/"
datePublished: "2025-03-10"
dateModified: "2026-06-24"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Parsing DWG Layers with Python Scripts",
      "description": "Step-by-step guide to extracting DWG layer metadata, visibility states, and entity counts in Python using the DWG→DXF→ezdxf pipeline.",
      "datePublished": "2025-03-10",
      "dateModified": "2026-06-24",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Python Parsing & Geometry Extraction", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/"},
        {"@type": "ListItem", "position": 2, "name": "DWG-to-Python Integration", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/"},
        {"@type": "ListItem", "position": 3, "name": "Parsing DWG Layers with Python Scripts", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/parsing-dwg-layers-with-python-scripts/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Parsing DWG Layers with Python Scripts",
      "description": "Extract layer metadata, visibility states, and entity counts from DWG files using a DWG→DXF conversion stage followed by ezdxf.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Convert DWG to DXF", "text": "Run the ODA File Converter or libredwg CLI in headless mode to produce a DXF file from the source DWG."},
        {"@type": "HowToStep", "position": 2, "name": "Open the DXF with ezdxf", "text": "Load the converted DXF using ezdxf.readfile() and access doc.layers for the LAYER table."},
        {"@type": "HowToStep", "position": 3, "name": "Iterate the LAYER table", "text": "Loop over layers_db.keys(), calling is_frozen(), is_locked(), and is_off() on each Layer object."},
        {"@type": "HowToStep", "position": 4, "name": "Count entities per layer", "text": "Iterate modelspace() once in a single pass, incrementing a defaultdict counter keyed by entity.dxf.layer."},
        {"@type": "HowToStep", "position": 5, "name": "Serialize to JSON", "text": "Write the layer manifest as structured JSON sorted by entity count for downstream GIS or BIM ingestion."}
      ]
    }
  ]
}
</script>

# Parsing DWG Layers with Python Scripts

Extracting DWG layer metadata requires an intermediate normalization step. Because Autodesk's DWG format is proprietary and version-fragmented, direct binary parsing is unstable in production pipelines. The reliable approach converts DWG to DXF using the [Open Design Alliance File Converter](https://www.opendesign.com/guestfiles/oda_file_converter) or `libredwg`, then queries layer names, visibility states, color indices, and entity counts via `ezdxf`. This is covered in depth in the [DWG-to-Python Integration](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/) guide, which this page extends with a focused implementation for layer extraction.

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 160" role="img" aria-label="DWG layer extraction pipeline: DWG file → DXF converter → ezdxf layer table → JSON manifest" style="width:100%;max-width:720px;display:block;margin:1.5rem auto;">
  <title>DWG Layer Extraction Pipeline</title>
  <desc>Data flows left to right: a DWG file is converted to DXF by ODA/libredwg, parsed by ezdxf to read the LAYER table, then serialized to a JSON manifest for downstream GIS or BIM systems.</desc>
  <defs>
    <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" opacity="0.6"/>
    </marker>
  </defs>
  <!-- Stage boxes -->
  <rect x="10" y="50" width="130" height="60" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
  <text x="75" y="76" text-anchor="middle" font-size="12" fill="currentColor" font-family="sans-serif" font-weight="600">.dwg file</text>
  <text x="75" y="95" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">R13 – R2024</text>
  <rect x="190" y="50" width="150" height="60" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
  <text x="265" y="76" text-anchor="middle" font-size="12" fill="currentColor" font-family="sans-serif" font-weight="600">ODA / libredwg</text>
  <text x="265" y="95" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">DWG → DXF</text>
  <rect x="390" y="50" width="150" height="60" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
  <text x="465" y="76" text-anchor="middle" font-size="12" fill="currentColor" font-family="sans-serif" font-weight="600">ezdxf</text>
  <text x="465" y="95" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">doc.layers + modelspace()</text>
  <rect x="590" y="50" width="120" height="60" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
  <text x="650" y="76" text-anchor="middle" font-size="12" fill="currentColor" font-family="sans-serif" font-weight="600">JSON manifest</text>
  <text x="650" y="95" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">GIS / BIM ingestion</text>
  <!-- Arrows -->
  <line x1="142" y1="80" x2="186" y2="80" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrowhead)" opacity="0.6"/>
  <line x1="342" y1="80" x2="386" y2="80" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrowhead)" opacity="0.6"/>
  <line x1="542" y1="80" x2="586" y2="80" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrowhead)" opacity="0.6"/>
</svg>

## How ezdxf Handles the DWG LAYER Table

When the ODA File Converter or `libredwg` converts a DWG to DXF, it translates the DWG `LAYER` object store into a DXF `LAYER` table section. Every layer entry carries:

- **Name** — the string identifier used as `entity.dxf.layer` on all entities in that layer.
- **Color index (ACI)** — an integer 1–255 referencing AutoCAD Color Index. A value of `256` means "by layer" (inherits from the drawing default). A negative value signals the layer is turned **off**.
- **Linetype reference** — a string name pointing to a `LTYPE` table entry.
- **Lineweight** — an integer code (e.g., `25` = 0.25 mm); `-1` means "default".
- **Flags** — frozen, locked, plot-suppressed states encoded in the `70` and `290` group codes.

`ezdxf` exposes these through the `Layer` entity object. In `ezdxf >= 1.0`, the visibility state methods (`is_frozen()`, `is_locked()`, `is_off()`) are callable methods, not plain attribute properties. Calling them without parentheses always returns the bound method object (truthy), which silently masks frozen/off states — a common bug when upgrading from pre-1.0 code.

`ezdxf` does **not** reconstruct XREF-inherited layer states. When a DWG uses external references whose layers override visibility, the converted DXF usually flattens or drops those overrides. If layer inheritance matters for your pipeline, bind all XREFs before conversion at the CAD authoring stage.

## Production-Ready Script

The script below reads a converted DXF, extracts layer properties in a single modelspace pass, filters system layers, and writes a JSON manifest sorted by entity count. It handles missing attributes with safe fallbacks and logs warnings for non-standard states.

```python
# parse_layers.py — requires ezdxf>=1.1.0, Python 3.9+
import sys
import json
import logging
from pathlib import Path
from typing import Dict, List, Any
from collections import defaultdict

import ezdxf
from ezdxf.entities import Layer

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Layers present in every DWG/DXF; rarely contain meaningful geometry
SYSTEM_LAYERS = {"0", "defpoints"}


def parse_dwg_layers(
    dxf_path: str,
    output_json: str = "layer_manifest.json",
) -> Dict[str, Any]:
    """
    Extract layer metadata, states, and entity counts from a DWG-converted DXF.

    Args:
        dxf_path:    Path to the converted .dxf file.
        output_json: Destination for the JSON manifest.

    Returns:
        The manifest dict (also written to output_json).
    """
    path = Path(dxf_path)
    if not path.exists():
        raise FileNotFoundError(f"DXF not found: {path}")

    try:
        doc = ezdxf.readfile(str(path))
    except ezdxf.DXFStructureError as exc:
        logger.error("Corrupted or unsupported DXF: %s", exc)
        sys.exit(1)

    layers_db = doc.layers
    entity_counts: Dict[str, int] = defaultdict(int)

    # Single-pass entity count — avoids materialising the full modelspace list
    for entity in doc.modelspace():
        try:
            name = entity.dxf.layer
            if name:
                entity_counts[name] += 1
        except AttributeError:
            continue

    layer_manifest: List[Dict[str, Any]] = []

    for layer_name in layers_db.keys():
        layer: Layer = layers_db.get(layer_name)
        if layer is None:
            continue

        # Skip AutoCAD system and annotation-only layers
        if layer_name.startswith("*") or layer_name.lower() in SYSTEM_LAYERS:
            logger.debug("Skipping system layer: %s", layer_name)
            continue

        # is_frozen/is_locked/is_off are METHOD CALLS in ezdxf>=1.0
        try:
            is_frozen = layer.is_frozen()
            is_locked = layer.is_locked()
            is_off    = layer.is_off()
        except TypeError:
            # Fallback for ezdxf<1.0 where these are plain bool properties
            is_frozen = bool(layer.is_frozen)  # type: ignore[attr-defined]
            is_locked = bool(layer.is_locked)  # type: ignore[attr-defined]
            is_off    = bool(layer.is_off)      # type: ignore[attr-defined]
            logger.warning(
                "Layer %s: is_frozen/locked/off are properties, not methods — "
                "upgrade to ezdxf>=1.0 for reliable state detection.",
                layer_name,
            )

        props = {
            "name":         layer_name,
            "color_index":  layer.dxf.get("color", 256),
            "linetype":     layer.dxf.get("linetype", "Continuous"),
            "lineweight":   layer.dxf.get("lineweight", -1),
            "frozen":       is_frozen,
            "locked":       is_locked,
            "off":          is_off,
            "plot":         bool(layer.dxf.get("plot", True)),
            "entity_count": entity_counts.get(layer_name, 0),
        }
        layer_manifest.append(props)

    # Most-populated layers first — useful for quick visual scanning
    layer_manifest.sort(key=lambda x: x["entity_count"], reverse=True)

    manifest = {
        "source_file":  str(path),
        "total_layers": len(layer_manifest),
        "layers":       layer_manifest,
    }

    # Validation gate: warn if the manifest is empty (likely a converter failure)
    if manifest["total_layers"] == 0:
        logger.warning(
            "No user layers found in %s — verify the DWG→DXF conversion succeeded "
            "and that the file contains model-space content.",
            path,
        )

    try:
        with open(output_json, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)
        logger.info("Manifest written: %s (%d layers)", output_json, manifest["total_layers"])
    except OSError as exc:
        logger.error("Failed to write JSON: %s", exc)
        sys.exit(1)

    return manifest


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python parse_layers.py <input.dxf> [output.json]")
        sys.exit(1)
    dxf_input   = sys.argv[1]
    json_output = sys.argv[2] if len(sys.argv) > 2 else "layer_manifest.json"
    parse_dwg_layers(dxf_input, json_output)
```

**Key implementation notes:**

- `is_frozen()`, `is_locked()`, and `is_off()` are method calls in `ezdxf >= 1.0`. Pre-1.0 versions exposed them as plain boolean properties. The try/except block in the script handles both without crashing — but check the [ezdxf changelog](https://ezdxf.readthedocs.io/en/stable/changelog.html) if you see `TypeError: 'bool' object is not callable`.
- `color_index == 256` means "by layer" (inherits the drawing default). A negative ACI value (e.g., `-1`) signals the layer is turned off in some older DXF versions — normalize both before comparison.
- `lineweight == -1` is the DXF sentinel for "default lineweight". Map it to your target thickness (e.g., 0.25 mm) during downstream processing rather than passing `-1` into a GIS renderer.
- For files exceeding 500 MB, iterating `doc.modelspace()` as a generator (as done above) avoids loading all entities into memory at once. Never replace this with `list(doc.modelspace())` in production.
- The `total_layers == 0` warning catches silent converter failures. An empty manifest that proceeds silently into a GIS pipeline will produce empty feature classes with no error trace.

## Compatibility Matrix

| Component | Supported Range | Notes |
|-----------|----------------|-------|
| Python | 3.9 – 3.12 | 3.13+ may require wheel rebuilds for C-extension dependencies |
| `ezdxf` | >= 1.1.0 | `is_frozen()` / `is_locked()` / `is_off()` are methods from 1.0; `color` attribute semantics stabilised in 1.1 |
| DWG format | R13 – R2024 (AC1012 – AC1032) | R2021+ files require ODA 2023+ or `libredwg` 0.12.5+; no public spec beyond AC1032 as of mid-2026 |
| ODA File Converter | 2023+ | Use 2024 for R2021/R2024 source files; earlier versions silently omit some layer flag group codes |
| `libredwg` | >= 0.12.5 | GPL-licensed; lags 6–12 months on newest format versions; adequate for R2018 and earlier |
| OS | Windows 10/11, Ubuntu 20.04+, macOS 12+ | ODA CLI ships native Win/Linux binaries; macOS requires ARM builds or Rosetta 2 |

## Fallback Strategies and Troubleshooting

**1. Manifest is empty (`total_layers == 0`) after conversion**

The converter likely wrote an empty or structurally broken DXF. Re-run ODA with audit enabled (`audit=1` in the CLI arguments) and check its log for group-code errors. If `libredwg` was used, try the same file through ODA — newer DWG revisions often trip `libredwg`'s parser before ODA does.

**2. `DXFStructureError` on `ezdxf.readfile()`**

The DXF was written with a DXF version string the installed `ezdxf` does not recognise (e.g., a future AC103x code). Pin ODA output to `ACAD2018` (AC1032) to produce a stable target version. Pass `dxf_version="ACAD2018"` to the converter subprocess call documented in the [DWG-to-Python Integration](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/) workflow.

**3. Layer states all read as `False` (never frozen/off)**

You are running `ezdxf < 1.0` and calling `layer.is_frozen()` as a method, but in that version it is a plain `bool` property. Upgrade to `ezdxf >= 1.1.0`. Alternatively, read the raw group-code flags with `layer.dxf.get("flags", 0)` and test bit 1 (frozen = `flags & 1`), bit 4 (frozen in new viewport = `flags & 4`).

**4. `entity.dxf.layer` raises `AttributeError`**

Some non-graphic entities (e.g., `ACAD_PROXY_ENTITY`, dimension overrides) do not carry a `layer` attribute in their DXF group codes. The `try/except AttributeError` guard in the script handles these silently. If you need to audit which entity types are skipped, log `entity.dxftype()` inside the except block.

**5. Color index is negative in the output JSON**

AutoCAD encodes a layer-off state by negating the ACI color value in older DXF versions (group code 62). Wrap the color read as `abs(layer.dxf.get("color", 256))` if you only need the display color, and use `is_off()` separately to record visibility state. Do not conflate them — both signals carry independent meaning in Civil 3D files.

---

## Related Pages

- [DWG-to-Python Integration](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/) — parent guide covering version detection, headless ODA conversion, and the full DWG parsing landscape
- [Python Parsing & Geometry Extraction](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/) — the broader pipeline this page feeds into, from raw CAD files to validated spatial data
- [Reading 3D Solids with ezdxf Python](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/reading-3d-solids-with-ezdxf-python/) — sibling task page covering ACIS/B-Rep entity access with the same `ezdxf` API
- [Understanding DWG Version Compatibility](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/understanding-dwg-version-compatibility/) — cross-topic reference for the AC10xx header codes and format fragmentation this pipeline works around
