---
title: "Extracting Block Attributes from CAD Files with ezdxf"
description: "Step-by-step guide to extracting ATTRIB entities from DXF INSERT blocks using Python ezdxf, covering DWG conversion, attribute mapping, coordinate export, and production error handling."
slug: "extracting-block-attributes-from-cad-files"
breadcrumb:
  - label: "Core Format Fundamentals & Schema Mapping"
    url: "/core-format-fundamentals-schema-mapping/"
  - label: "Metadata Extraction Strategies"
    url: "/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/"
  - label: "Extracting Block Attributes from CAD Files"
    url: "/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/extracting-block-attributes-from-cad-files/"
datePublished: "2025-03-10"
dateModified: "2026-06-24"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Extracting Block Attributes from CAD Files with ezdxf",
      "description": "Step-by-step guide to extracting ATTRIB entities from DXF INSERT blocks using Python ezdxf, covering DWG conversion, attribute mapping, coordinate export, and production error handling.",
      "datePublished": "2025-03-10",
      "dateModified": "2026-06-24",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Core Format Fundamentals & Schema Mapping", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/"},
        {"@type": "ListItem", "position": 2, "name": "Metadata Extraction Strategies", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/"},
        {"@type": "ListItem", "position": 3, "name": "Extracting Block Attributes from CAD Files", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/extracting-block-attributes-from-cad-files/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Extracting Block Attributes from CAD Files with ezdxf",
      "description": "Extract ATTRIB metadata from DXF/DWG INSERT entities using Python ezdxf and export to structured JSON.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Convert DWG to DXF", "text": "Run ODA File Converter or LibreDWG to produce a DXF R2018 file from binary DWG input."},
        {"@type": "HowToStep", "position": 2, "name": "Open the DXF document", "text": "Use ezdxf.readfile() to load the document and iterate all layouts."},
        {"@type": "HowToStep", "position": 3, "name": "Query INSERT entities", "text": "Call layout.query('INSERT') and call insert.get_attribs() on each result."},
        {"@type": "HowToStep", "position": 4, "name": "Build attribute dictionaries", "text": "Map each ATTRIB tag/text pair into a Python dict alongside insertion point and rotation."},
        {"@type": "HowToStep", "position": 5, "name": "Validate and serialize", "text": "Apply pydantic schema validation and write output to JSON or GeoJSON."}
      ]
    }
  ]
}
</script>

# Extracting Block Attributes from CAD Files with ezdxf

Use Python's `ezdxf` library to iterate every layout in a DXF document, query `INSERT` entities, and call `insert.get_attribs()` to retrieve the `ATTRIB` children that carry metadata like equipment tags, part numbers, and installation dates. For binary DWG files — which `ezdxf` cannot parse directly — first convert them to DXF R2018 using the ODA File Converter or `LibreDWG`. The result is a list of dictionaries ready for GIS feature creation, BIM property-set ingestion, or infrastructure asset registry import. This page is a companion to the [Metadata Extraction Strategies](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/) guide, which covers routing logic, schema normalization, and validation patterns for the broader pipeline.

## How ezdxf Handles Block Attributes

Understanding the internal data model prevents silent data loss before you write a single line of extraction code.

<svg viewBox="0 0 640 320" role="img" aria-label="DXF block attribute entity hierarchy showing BLOCK definition containing ATTDEF templates, and INSERT references containing ATTRIB value entities" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;display:block;margin:1.5rem auto;">
  <title>DXF Block Attribute Entity Hierarchy</title>
  <desc>BLOCK definition holds ATTDEF template records; each INSERT placed in a layout carries corresponding ATTRIB value entities as children.</desc>
  <!-- Background -->
  <rect width="640" height="320" rx="8" fill="none"/>
  <!-- BLOCK box -->
  <rect x="20" y="30" width="180" height="80" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="110" y="56" text-anchor="middle" font-size="13" font-weight="bold" fill="currentColor">BLOCK Definition</text>
  <text x="110" y="76" text-anchor="middle" font-size="11" fill="currentColor">(BLOCKS section)</text>
  <rect x="40" y="84" width="140" height="20" rx="4" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="4 2"/>
  <text x="110" y="98" text-anchor="middle" font-size="11" fill="currentColor">ATTDEF template</text>
  <!-- Arrow BLOCK → INSERT -->
  <line x1="200" y1="70" x2="260" y2="70" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="230" y="62" text-anchor="middle" font-size="10" fill="currentColor">placed as</text>
  <!-- INSERT box -->
  <rect x="260" y="30" width="180" height="80" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="350" y="56" text-anchor="middle" font-size="13" font-weight="bold" fill="currentColor">INSERT Entity</text>
  <text x="350" y="76" text-anchor="middle" font-size="11" fill="currentColor">ModelSpace / PaperSpace</text>
  <text x="350" y="96" text-anchor="middle" font-size="10" fill="currentColor">dxf.insert (x,y,z) · rotation · scale</text>
  <!-- Arrow INSERT → ATTRIB -->
  <line x1="350" y1="110" x2="350" y2="160" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="370" y="142" font-size="10" fill="currentColor">get_attribs()</text>
  <!-- ATTRIB box -->
  <rect x="240" y="160" width="220" height="100" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="350" y="182" text-anchor="middle" font-size="13" font-weight="bold" fill="currentColor">ATTRIB Entities</text>
  <text x="350" y="200" text-anchor="middle" font-size="11" fill="currentColor">dxf.tag  →  key (case-sensitive)</text>
  <text x="350" y="218" text-anchor="middle" font-size="11" fill="currentColor">dxf.text →  value (Unicode string)</text>
  <text x="350" y="238" text-anchor="middle" font-size="11" fill="currentColor">dxf.invisible  (visible/hidden flag)</text>
  <!-- XDATA note -->
  <rect x="480" y="160" width="145" height="70" rx="6" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="5 3"/>
  <text x="552" y="182" text-anchor="middle" font-size="12" font-weight="bold" fill="currentColor">XDATA / ExtDict</text>
  <text x="552" y="200" text-anchor="middle" font-size="10" fill="currentColor">vendor group code 1001</text>
  <text x="552" y="218" text-anchor="middle" font-size="10" fill="currentColor">dynamic block params</text>
  <line x1="460" y1="200" x2="480" y2="200" stroke="currentColor" stroke-width="1" stroke-dasharray="4 2"/>
  <!-- Dynamic blocks note -->
  <rect x="20" y="180" width="200" height="60" rx="6" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="5 3"/>
  <text x="120" y="200" text-anchor="middle" font-size="12" font-weight="bold" fill="currentColor">Dynamic Blocks</text>
  <text x="120" y="218" text-anchor="middle" font-size="10" fill="currentColor">ACAD_ENHANCEDBLOCK dict</text>
  <text x="120" y="234" text-anchor="middle" font-size="10" fill="currentColor">not exposed by get_attribs()</text>
  <!-- Arrow dyn -->
  <line x1="220" y1="200" x2="240" y2="200" stroke="currentColor" stroke-width="1" stroke-dasharray="4 2"/>
  <!-- arrowhead marker -->
  <defs>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 Z" fill="currentColor"/>
    </marker>
  </defs>
  <!-- Layout label -->
  <text x="320" y="314" text-anchor="middle" font-size="10" fill="currentColor">Solid borders = standard API path · Dashed borders = vendor-specific paths requiring separate handling</text>
</svg>

**`BLOCK` vs `INSERT`:** A `BLOCK` record lives in the `BLOCKS` section and holds geometry plus `ATTDEF` template entries that declare attribute tags, prompt strings, and default values. An `INSERT` entity is a placed instance of that block inside a layout; it carries its own `ATTRIB` children with the actual runtime values. Deleting or exploding an `INSERT` removes those `ATTRIB` children permanently.

**Tag vs value:** Each `ATTRIB` stores a `TAG` (the key, case-sensitive) and a `text` property (the value). Tags are set at block-definition time and cannot be changed per-instance. Values are editable text strings; they may be empty, whitespace, or absent when the drafter did not fill in the attribute.

**Layout traversal:** Attributes live inside layouts, not at the document root. `doc.layouts` yields `ModelSpace` and all `PaperSpace` layouts. Querying only `doc.modelspace()` misses sheet-level blocks that carry title-block metadata like revision numbers and drawing dates — a common source of incomplete asset records.

**Dynamic block parameters:** AutoCAD's dynamic blocks store parametric data in `ACAD_ENHANCEDBLOCK` extension dictionaries on the `BLOCKRECORD` entity. The standard `get_attribs()` call does not surface these values; they require reading the extension dictionary separately via `insert.get_extension_dict()`.

**`ezdxf` version note:** `get_attribs()` was renamed from `get_attrib_handles()` in `ezdxf` 0.17. Ensure your environment meets the version range in the compatibility table below. See the [DXF Entity Structure Breakdown](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/) for a full taxonomy of group codes and entity types.

## Production-Ready Script

The script below handles layout iteration, optional block name filtering, missing or invisible attributes, XDATA fallback detection, coordinate capture, and structured JSON output. Requires `ezdxf>=1.1.0`.

```python
# ezdxf>=1.1.0  pydantic>=2.0.0
import json
import logging
from pathlib import Path
from typing import Optional

import ezdxf
from ezdxf.document import Drawing

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)


def _safe_scalar(val, default=0.0) -> float:
    """Return float or default when dxf attribute is missing."""
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def extract_block_attributes(
    dxf_path: str,
    target_blocks: Optional[list[str]] = None,
    include_invisible: bool = False,
) -> list[dict]:
    """
    Extract INSERT block attributes from every layout in a DXF file.

    Args:
        dxf_path:         Absolute path to a DXF file (R2004–R2018).
        target_blocks:    Optional allowlist of block names; None means all.
        include_invisible: Include ATTRIBs whose dxf.invisible flag is set.

    Returns:
        List of dicts: layout, block_name, insertion_point, rotation,
        scale, attributes {tag: value}, xdata_present.
    """
    path = Path(dxf_path)
    if not path.exists():
        raise FileNotFoundError(f"DXF file not found: {path}")

    try:
        doc: Drawing = ezdxf.readfile(str(path))
    except ezdxf.DXFError as exc:
        raise RuntimeError(f"ezdxf could not open '{path}': {exc}") from exc

    results: list[dict] = []

    for layout in doc.layouts:
        layout_name = layout.dxf.name

        # layout.query() returns only INSERT entities in this layout
        for insert in layout.query("INSERT"):
            block_name = insert.dxf.get("name", "<unnamed>")

            if target_blocks and block_name not in target_blocks:
                continue

            # --- Collect ATTRIB children ---
            attr_dict: dict[str, str] = {}
            for attrib in insert.get_attribs():
                if not include_invisible and attrib.dxf.get("invisible", 0):
                    continue
                tag = attrib.dxf.get("tag", "").strip()
                value = str(attrib.dxf.get("text", "")).strip()
                if tag:
                    attr_dict[tag] = value

            # --- Detect XDATA presence (vendor metadata, dynamic params) ---
            xdata_apps: list[str] = []
            try:
                xdata_apps = list(insert.xdata.keys()) if insert.xdata else []
            except AttributeError:
                pass

            # --- Insertion geometry ---
            ins_pt = insert.dxf.get("insert", None)
            insertion_point = (
                (_safe_scalar(ins_pt.x), _safe_scalar(ins_pt.y), _safe_scalar(ins_pt.z))
                if ins_pt is not None
                else (0.0, 0.0, 0.0)
            )

            results.append({
                "layout": layout_name,
                "block_name": block_name,
                "insertion_point": insertion_point,
                "rotation": _safe_scalar(insert.dxf.get("rotation", 0.0)),
                "scale": (
                    _safe_scalar(insert.dxf.get("xscale", 1.0)),
                    _safe_scalar(insert.dxf.get("yscale", 1.0)),
                    _safe_scalar(insert.dxf.get("zscale", 1.0)),
                ),
                "attributes": attr_dict,
                "xdata_apps": xdata_apps,
            })

    log.info("Extracted %d INSERT records from '%s'", len(results), path.name)
    return results


if __name__ == "__main__":
    import sys

    dxf_file = sys.argv[1] if len(sys.argv) > 1 else "site_plan.dxf"
    filter_names = ["VALVE", "PUMP", "METER"]  # set to None to extract all

    records = extract_block_attributes(dxf_file, target_blocks=filter_names)
    print(json.dumps(records[:5], indent=2))
    print(f"\nTotal records: {len(records)}")
```

Key implementation notes:

- `insert.dxf.get("name", ...)` is used instead of `insert.dxf.name` throughout because `ezdxf` raises `DXFAttributeError` on missing attributes rather than returning `None`.
- Invisible attributes (`dxf.invisible == 1`) are skipped by default; set `include_invisible=True` when harvesting hidden reference tags that vendor plugins write as non-display metadata.
- The `xdata_apps` list flags inserts that carry vendor XDATA without blocking the main attribute harvest. Inspect those blocks separately if downstream schemas require XDATA values.
- `doc.layouts` iterates `Model` then all paper-space layouts in document order. This guarantees title-block attributes from `Layout1`, `Layout2`, etc. are captured alongside model-space equipment tags.

## Handling Proprietary DWG Files

`ezdxf` parses DXF only. Binary DWG files require conversion before this script can run. Two production-ready paths exist.

**ODA File Converter (Windows/macOS/Linux):** The free ODA tool performs a round-trip-safe conversion and preserves XDATA, Unicode strings, and custom object dictionaries:

```bash
# Convert all DWG files in /input to DXF R2018 in /output
ODAFileConverter /input /output DXF 2018 0 1
```

Always target DXF R2018 or newer (`2018`). Older targets (R12, R2000) truncate Unicode attribute values to single-byte Windows-1252, silently corrupting international project data.

**LibreDWG + dwg2dxf (Linux/macOS, open-source):** Suitable for CI/CD pipelines where license-free operation is required. Coverage gaps exist for advanced AutoCAD objects (`ACIS`, `REGION`, proxy objects), but `ATTRIB` extraction is reliable for standard drawings:

```bash
dwg2dxf --as r2018 -o output.dxf input.dwg
```

For the broader context of working around closed-binary constraints, see [DWG Proprietary Limitations](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/).

## Compatibility Matrix

| Component | Supported Range | Notes |
|---|---|---|
| Python | 3.9 – 3.13 | 3.9+ required for `list[str]` type hints without `from __future__ import annotations` |
| ezdxf | 1.1.0 – 1.3.x | `get_attribs()` API stable since 0.17; `xdata` dict API stable since 1.0 |
| DXF version | R2004 – R2018 | R12 files lack Unicode; R2000–R2010 may omit extension dictionaries |
| DWG (via ODA) | 2004 – 2025 | ODA converter preserves ATTRIB and XDATA across all versions |
| DWG (via LibreDWG) | 2004 – 2018 | 2023+ DWG may have conversion gaps for proxy objects |
| Operating system | Linux, macOS, Windows | ODA converter requires a display server or `Xvfb` on headless Linux |
| pydantic (validation) | 2.0+ | v1 API not compatible with `@field_validator(mode="before")` |

## Fallback Strategies and Troubleshooting

**1. `get_attribs()` returns an empty list despite visible attributes in the drawing.**
The block was exploded before saving — `INSERT` entities with attributes become standalone `TEXT` or `MTEXT` entities at the insertion point. Query `layout.query("TEXT MTEXT")` and filter by proximity to known equipment insertion coordinates. Cross-reference [How to Parse DXF Headers with Python](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/how-to-parse-dxf-headers-with-python/) for spatial-filter patterns.

**2. `UnicodeDecodeError` during `ezdxf.readfile()`.**
The source file mixes Windows-1252 and UTF-8 encoding (common on drawings opened and re-saved across regional AutoCAD installs). Force the encoding at startup:

```python
import ezdxf.options
ezdxf.options.default_encoding = "utf-8"
# or, for purely Windows-origin files:
ezdxf.options.default_encoding = "cp1252"
```

**3. Attribute values contain `None` or empty strings for tags you know are populated.**
The drafter entered only spaces, or the attribute value was set by a script that wrote a zero-width character. In the `attr_dict` build loop, add `.strip()` to both `tag` and `value`, then replace empty strings with a sentinel such as `"<blank>"` for downstream null-detection.

**4. Scale values read as `1.0` even though the block is visually scaled differently.**
Non-uniform scaling applied via `INSERT`'s `dxf.xscale` / `dxf.yscale` is only written when explicitly set; AutoCAD sometimes stores the default `1.0` implicitly and omits the DXF group codes entirely. The `_safe_scalar(..., default=1.0)` pattern handles the missing-attribute case, but always verify scale against a known reference dimension in the drawing.

**5. XDATA-only attributes (no standard `ATTRIB` children).**
Some equipment symbol libraries — particularly those targeting plant design workflows — write all semantic metadata into vendor XDATA under application ID `ACAD` or a proprietary namespace instead of using `ATTDEF`/`ATTRIB`. After confirming `xdata_apps` is non-empty, read the raw data:

```python
if insert.xdata:
    for app_id, xdata_tags in insert.xdata.items():
        for code, value in xdata_tags:
            print(f"  [{app_id}] group {code}: {value}")
```

Map group codes 1000–1079 (strings, reals, ints, points) to your target schema manually; there is no universal XDATA ontology.

---

## Related Pages

- [Metadata Extraction Strategies](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/) — parent guide covering format routing, schema normalization, and validation patterns
- [DXF Entity Structure Breakdown](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/) — group code taxonomy, section structure, and entity hierarchy reference
- [DWG Proprietary Limitations](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/) — ODA converter setup, version compatibility gaps, and proxy-object handling
- [How to Parse DXF Headers with Python](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/how-to-parse-dxf-headers-with-python/) — extracting `$INSUNITS`, `$ACADVER`, and drawing-level metadata from the HEADER section
- [Core Format Fundamentals & Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/) — section overview linking all format-specific guides
