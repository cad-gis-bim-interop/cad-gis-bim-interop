---
title: "Extracting DWG Block Attributes with Python"
description: "Harvest title-block and equipment-tag attributes from DWG files: convert DWG to DXF with ODA, then read INSERT attribs with ezdxf into tag-to-value tables keyed by block and handle."
slug: "extracting-dwg-block-attributes-with-python"
type: "long_tail"
breadcrumb:
  - label: "Core Format Fundamentals & Schema Mapping"
    url: "/core-format-fundamentals-schema-mapping/"
  - label: "Metadata Extraction Strategies"
    url: "/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/"
  - label: "Extracting DWG Block Attributes with Python"
    url: "/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/extracting-dwg-block-attributes-with-python/"
datePublished: "2026-07-11"
dateModified: "2026-07-11"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Extracting DWG Block Attributes with Python",
      "description": "Harvest title-block and equipment-tag attributes from DWG files: convert DWG to DXF with ODA, then read INSERT attribs with ezdxf into tag-to-value tables keyed by block and handle.",
      "datePublished": "2026-07-11",
      "dateModified": "2026-07-11",
      "author": {"@type": "Organization", "name": "CAD GIS BIM Interop"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/extracting-dwg-block-attributes-with-python/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Core Format Fundamentals & Schema Mapping", "item": "https://cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/"},
        {"@type": "ListItem", "position": 2, "name": "Metadata Extraction Strategies", "item": "https://cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/"},
        {"@type": "ListItem", "position": 3, "name": "Extracting DWG Block Attributes with Python", "item": "https://cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/extracting-dwg-block-attributes-with-python/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Extracting DWG Block Attributes with Python",
      "description": "Convert DWG to DXF with the ODA File Converter, then read INSERT ATTRIB attributes with ezdxf into a table keyed by block name, handle, and insertion point.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Convert DWG to DXF", "text": "Run the ODA File Converter to produce a DXF, since DWG is a closed binary format ezdxf cannot read directly."},
        {"@type": "HowToStep", "position": 2, "name": "Query INSERT entities", "text": "Open the DXF with ezdxf and query modelspace for INSERT entities, which are the block references that carry attributes."},
        {"@type": "HowToStep", "position": 3, "name": "Read ATTRIB sub-entities", "text": "Iterate insert.attribs and read att.dxf.tag and att.dxf.text for each visible attribute on the block reference."},
        {"@type": "HowToStep", "position": 4, "name": "Recover constant attributes", "text": "For constant attributes defined on the block's ATTDEF templates, read them from the block definition since they are not repeated on each INSERT."},
        {"@type": "HowToStep", "position": 5, "name": "Build the attribute table", "text": "Emit one record per block reference keyed by block name, entity handle, and insertion point with a tag-to-value dictionary."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Why can't ezdxf read DWG files directly?",
          "acceptedAnswer": {"@type": "Answer", "text": "DWG is Autodesk's closed, version-dependent binary format with no public specification. ezdxf reads and writes only DXF. Convert the DWG to DXF first with the ODA File Converter or another licensed converter, then parse the resulting DXF with ezdxf."}
        },
        {
          "@type": "Question",
          "name": "Where do constant block attributes live?",
          "acceptedAnswer": {"@type": "Answer", "text": "Constant attributes are defined once on the ATTDEF in the block definition and are not written as ATTRIB sub-entities on each INSERT. To recover them you must read the ATTDEF entities in doc.blocks[block_name] and merge their tag/text with the variable ATTRIBs from the reference."}
        },
        {
          "@type": "Question",
          "name": "How do I read multiline (MTEXT) block attributes?",
          "acceptedAnswer": {"@type": "Answer", "text": "Multiline attributes store their content as embedded MTEXT. Reading att.dxf.text returns raw text with MTEXT formatting codes. Use att.plain_text() (or ezdxf's MTEXT plain-text helper) to strip formatting and get the clean string value."}
        },
        {
          "@type": "Question",
          "name": "Why did my ATTRIBs disappear after exploding a block?",
          "acceptedAnswer": {"@type": "Answer", "text": "Exploding an INSERT converts constant attributes to TEXT and can drop the tag association of variable attributes entirely. Extract attributes from intact INSERT entities before any explode step; once exploded, the tag-to-value mapping is gone."}
        }
      ]
    }
  ]
}
</script>

# Extracting DWG Block Attributes with Python

To extract block attributes from a DWG file with Python, first convert the DWG to DXF with the ODA File Converter, then open the DXF with `ezdxf`, query `INSERT` entities, and read each attached `ATTRIB` sub-entity through `insert.attribs` — pulling `att.dxf.tag` and `att.dxf.text` into a tag-to-value dictionary per block reference. Title blocks, equipment tags, and drawing-register fields all live as attributes on block references, which makes them one of the richest metadata sources in a CAD drawing. This page is part of the [Metadata Extraction Strategies](/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/) reference and assumes you can run a conversion step and open a DXF document.

## How ezdxf Handles Block Attributes

A block reference in DXF is an `INSERT` entity: a placement (insertion point, scale, rotation) of a named block definition. When that block was authored with attribute definitions (`ATTDEF`), each placed reference carries matching attribute instances (`ATTRIB`) that hold the actual values a drafter typed. `ezdxf` exposes those instances through the iterable `insert.attribs`; each `ATTRIB` has a `dxf.tag` (the fixed field name, e.g. `DWG_NUMBER`) and a `dxf.text` (the typed value, e.g. `A-101`).

The critical prerequisite is format: DWG is Autodesk's closed binary format with no public specification, and `ezdxf` cannot read it. You must convert DWG to DXF first — the [ODA File Converter batch workflow](/python-parsing-geometry-extraction/pydwg-integration/batch-converting-dwg-to-dxf-with-oda-file-converter/) is the standard route — and then parse the DXF. Once you have DXF, attribute traversal is straightforward, with two subtleties: the block *definition* holds `ATTDEF` templates (including constant attributes that never appear on the reference), and attribute visibility flags distinguish shown fields from hidden ones.

<svg viewBox="0 0 720 300" role="img" aria-label="DWG to DXF conversion then attribute harvest: an INSERT reference carries visible ATTRIB values while the block definition holds ATTDEF templates including constant attributes" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:720px;display:block;margin:1.5rem auto;">
  <title>Harvesting Block Attributes from a Converted DWG</title>
  <desc>Diagram: a DWG file is converted by the ODA File Converter into DXF. ezdxf reads INSERT entities whose attribs list gives visible tag and text pairs, while the block definition supplies ATTDEF templates including constant attributes that are merged into the final attribute record.</desc>
  <defs>
    <marker id="da" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor"/>
    </marker>
  </defs>
  <rect x="16" y="122" width="120" height="56" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="76" y="146" text-anchor="middle" font-size="12" fill="currentColor">DWG file</text>
  <text x="76" y="164" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">closed binary</text>
  <line x1="136" y1="150" x2="176" y2="150" stroke="currentColor" stroke-width="1.5" marker-end="url(#da)"/>
  <rect x="178" y="122" width="120" height="56" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="238" y="146" text-anchor="middle" font-size="11" fill="currentColor">ODA convert</text>
  <text x="238" y="164" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">-&gt; DXF</text>
  <line x1="298" y1="150" x2="338" y2="150" stroke="currentColor" stroke-width="1.5" marker-end="url(#da)"/>
  <rect x="340" y="30" width="200" height="86" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="440" y="54" text-anchor="middle" font-size="11" fill="currentColor">INSERT reference</text>
  <text x="440" y="74" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">insert.attribs</text>
  <text x="440" y="90" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">tag + text (visible)</text>
  <rect x="340" y="184" width="200" height="86" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.85"/>
  <text x="440" y="208" text-anchor="middle" font-size="11" fill="currentColor">Block definition</text>
  <text x="440" y="228" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">ATTDEF templates</text>
  <text x="440" y="244" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">constant attribs</text>
  <line x1="368" y1="150" x2="368" y2="112" stroke="currentColor" stroke-width="1.2" marker-end="url(#da)"/>
  <line x1="368" y1="150" x2="368" y2="182" stroke="currentColor" stroke-width="1.2" marker-end="url(#da)"/>
  <line x1="540" y1="116" x2="590" y2="150" stroke="currentColor" stroke-width="1.5" marker-end="url(#da)"/>
  <line x1="540" y1="184" x2="590" y2="150" stroke="currentColor" stroke-width="1.5" marker-end="url(#da)"/>
  <rect x="592" y="122" width="112" height="56" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="648" y="146" text-anchor="middle" font-size="11" fill="currentColor">Merged tag</text>
  <text x="648" y="164" text-anchor="middle" font-size="11" fill="currentColor">-&gt; value map</text>
</svg>

The output of this harvest — a `DWG_NUMBER`, `REVISION`, or `EQUIP_TAG` mapped to a value and an insertion point — is exactly the structured attribute data that feeds [block-attribute extraction across CAD files](/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/extracting-block-attributes-from-cad-files/), where the same tag-to-value model is applied format-agnostically.

## Production-Ready Script

This script assumes a DXF already produced by the ODA File Converter (the conversion command is shown in the notes). It walks every `INSERT`, reads its visible `ATTRIB`s, merges constant attributes from the block definition, and emits one record per block reference keyed by block name, handle, and insertion point.

```python
# ezdxf>=1.1.0 (+ ODA File Converter for the DWG->DXF step) | python>=3.9
import ezdxf
import json
import sys
from pathlib import Path
from typing import Any


def constant_attribs(doc, block_name: str) -> dict[str, str]:
    """
    Collect constant attributes from a block definition's ATTDEFs.

    Constant attributes are defined once on the ATTDEF (dxf.tag with the
    'Constant' flag) and are NOT repeated as ATTRIB on each INSERT.
    """
    result: dict[str, str] = {}
    if block_name not in doc.blocks:
        return result
    for entity in doc.blocks[block_name]:
        if entity.dxftype() != "ATTDEF":
            continue
        # is_const is True when the ATTDEF flags mark the attribute constant.
        if getattr(entity, "is_const", False):
            result[entity.dxf.tag] = entity.dxf.text
    return result


def attrib_value(att) -> str:
    """Return clean text for an ATTRIB, stripping MTEXT formatting if present."""
    # Multiline attributes embed MTEXT; plain_text() removes formatting codes.
    if hasattr(att, "plain_text"):
        try:
            return att.plain_text()
        except Exception:
            pass
    return att.dxf.get("text", "")


def harvest_block_attributes(dxf_path: str, output_json: str) -> None:
    try:
        doc = ezdxf.readfile(dxf_path)
    except (IOError, ezdxf.DXFStructureError) as exc:
        sys.exit(f"Failed to load DXF (did the ODA conversion succeed?): {exc}")

    msp = doc.modelspace()
    records: list[dict[str, Any]] = []

    for insert in msp.query("INSERT"):
        block_name = insert.dxf.name

        # Start from constant attributes defined on the block's ATTDEFs...
        tags: dict[str, str] = constant_attribs(doc, block_name)

        # ...then overlay the variable ATTRIB values on this reference.
        # insert.attribs is empty when the block carries no attributes.
        for att in insert.attribs:
            tag = att.dxf.tag
            # Track visibility: flag bit 1 on ATTRIB means "invisible".
            invisible = bool(att.dxf.get("flags", 0) & 1)
            value = attrib_value(att)
            if tag in tags:
                # Duplicate tag on one reference: keep first, note the clash.
                tags[f"{tag}#dup@{att.dxf.handle}"] = value
            else:
                tags[tag] = value
            if invisible:
                tags.setdefault("_invisible_tags", "")
                tags["_invisible_tags"] += (tag + " ")

        if not tags:
            continue  # plain block reference with no attributes

        ip = insert.dxf.insert  # insertion point (Vec3)
        records.append({
            "block": block_name,
            "handle": insert.dxf.handle,
            "layer": insert.dxf.get("layer", "0"),
            "insert_point": [float(ip[0]), float(ip[1]), float(ip[2])],
            "attributes": tags,
        })

    Path(output_json).write_text(json.dumps(records, indent=2), encoding="utf-8")
    print(f"Harvested attributes from {len(records)} block references -> {output_json}")


if __name__ == "__main__":
    # DWG -> DXF first, e.g. via the ODA File Converter CLI:
    #   ODAFileConverter <in_dir> <out_dir> ACAD2018 DXF 0 1 "*.DWG"
    harvest_block_attributes("converted.dxf", "block_attributes.json")
```

**Key implementation notes:**

- `insert.attribs` yields only the *variable* `ATTRIB` instances present on the reference. Constant attributes never appear here — read them from the `ATTDEF`s in `doc.blocks[block_name]` and merge, as `constant_attribs()` does.
- `att.dxf.tag` is the fixed field name; `att.dxf.text` is the value. Tags are not guaranteed unique on a single reference, so detect duplicates rather than letting one silently overwrite another.
- Attribute visibility is a flag bit, not a separate attribute. Bit `1` of `ATTRIB.dxf.flags` marks the attribute invisible; a title block often hides internal bookkeeping fields that you still want to harvest.
- Keying each record by block name, handle, and insertion point lets you disambiguate many placements of the same title block or equipment symbol across a sheet set.
- Run the ODA File Converter before this script. It is a separate executable, not a Python library; drive it from `subprocess` in a batch step, as covered in the DWG-to-DXF conversion workflow.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `ezdxf` | `>=1.1.0` | `insert.attribs`, `ATTDEF.is_const`, and `plain_text()` are stable in 1.1.0+. |
| ODA File Converter | 2024+ | Required for the DWG→DXF step; DWG is closed and unreadable by `ezdxf`. |
| Python | `3.9+` | Uses `pathlib`, typing, and f-strings. |
| DXF format | R2000 (`AC1015`) – R2018 (`AC1032`) | Convert DWG to an `ezdxf`-supported DXF revision (ACAD2018 is safe). |
| Attribute types | ATTRIB, ATTDEF | Variable values on `ATTRIB`; constant/template values on `ATTDEF`. |
| Multiline attributes | MTEXT-backed | Use `plain_text()` to strip MTEXT formatting codes. |

## Fallback Strategies

**1. Constant attributes are missing from the reference**

If an expected tag (a fixed sheet-size or discipline code) never shows up in `insert.attribs`, it is almost certainly a constant attribute defined only on the `ATTDEF`. Read `doc.blocks[block_name]`, collect `ATTDEF` entities where `is_const` is true, and merge their `tag`/`text` into the record. Skipping this step drops fields that appear on every printed sheet.

**2. Multiline (MTEXT) attribute values**

Newer drawings store long attribute values as multiline attributes backed by MTEXT. Reading `att.dxf.text` returns raw text laced with MTEXT control codes (`\P`, font runs). Call `att.plain_text()` to get the clean human-readable string; falling back to raw `.text` leaves formatting garbage in your metadata.

**3. Duplicate tags on one reference**

Nothing in DXF forbids two `ATTRIB`s with the same tag on a single `INSERT`. A naive `dict[tag] = value` silently loses one. Detect the collision (as the script does with a `#dup@handle` suffix) and decide policy explicitly — keep first, keep last, or concatenate — rather than dropping data unknowingly.

**4. Attributes lost after exploding a block**

If an upstream step exploded block references, the tag-to-value association is gone: constant attributes become plain `TEXT` and variable attributes lose their tag linkage. Always harvest attributes from intact `INSERT` entities before any explode operation. If you only have an exploded drawing, the tags cannot be reliably reconstructed.

**5. Conversion artifacts from the ODA step**

A failed or partial DWG→DXF conversion can yield a DXF with no `INSERT` entities or with proxy stand-ins for custom blocks. Verify the converted DXF opens and contains the expected block names before trusting an empty attribute harvest; an empty result usually means a bad conversion, not an attribute-free drawing.

## FAQ

<details>
<summary><strong>Why can't ezdxf read DWG files directly?</strong></summary>

DWG is Autodesk's closed, version-dependent binary format with no public specification. `ezdxf` reads and writes only DXF. Convert the DWG to DXF first with the ODA File Converter or another licensed converter, then parse the resulting DXF with `ezdxf`. The batch DWG-to-DXF conversion workflow covers automating that step.

</details>

<details>
<summary><strong>Where do constant block attributes live?</strong></summary>

Constant attributes are defined once on the `ATTDEF` in the block definition and are not written as `ATTRIB` sub-entities on each `INSERT`. To recover them, read the `ATTDEF` entities in `doc.blocks[block_name]`, filter for `is_const`, and merge their tag and text with the variable `ATTRIB`s from the reference.

</details>

<details>
<summary><strong>How do I read multiline (MTEXT) block attributes?</strong></summary>

Multiline attributes store their content as embedded MTEXT. Reading `att.dxf.text` returns raw text with MTEXT formatting codes. Call `att.plain_text()` to strip the formatting and get the clean string value before writing it to your attribute table.

</details>

<details>
<summary><strong>Why did my ATTRIBs disappear after exploding a block?</strong></summary>

Exploding an `INSERT` converts constant attributes to plain `TEXT` and drops the tag association of variable attributes. Extract attributes from intact `INSERT` entities before any explode step; once exploded, the tag-to-value mapping cannot be reliably reconstructed.

</details>

---

## Related Pages

- [Metadata Extraction Strategies](/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/) — parent reference on turning embedded CAD, GIS, and BIM metadata into structured attributes
- [Extracting Block Attributes from CAD Files](/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/extracting-block-attributes-from-cad-files/) — sibling workflow applying the same tag-to-value model across formats
- [Batch Converting DWG to DXF with ODA File Converter](/python-parsing-geometry-extraction/pydwg-integration/batch-converting-dwg-to-dxf-with-oda-file-converter/) — cross-pillar prerequisite that produces the DXF this harvest reads
- [pydwg Integration](/python-parsing-geometry-extraction/pydwg-integration/) — cross-pillar reference on handling proprietary `.dwg` files in Python pipelines
