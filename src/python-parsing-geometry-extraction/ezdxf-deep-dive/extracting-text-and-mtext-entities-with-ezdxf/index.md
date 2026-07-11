---
title: "Extracting TEXT and MTEXT Entities with ezdxf"
description: "How to extract TEXT and MTEXT with ezdxf in Python: read position, height and rotation, strip MTEXT formatting codes, and emit GeoJSON label features."
slug: "extracting-text-and-mtext-entities-with-ezdxf"
type: "long_tail"
breadcrumb:
  - label: "Python Parsing & Geometry Extraction"
    url: "/python-parsing-geometry-extraction/"
  - label: "ezdxf Deep Dive"
    url: "/python-parsing-geometry-extraction/ezdxf-deep-dive/"
  - label: "Extracting TEXT and MTEXT Entities with ezdxf"
    url: "/python-parsing-geometry-extraction/ezdxf-deep-dive/extracting-text-and-mtext-entities-with-ezdxf/"
datePublished: "2026-07-11"
dateModified: "2026-07-11"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Extracting TEXT and MTEXT Entities with ezdxf",
      "description": "How to extract TEXT and MTEXT with ezdxf in Python: read position, height and rotation, strip MTEXT formatting codes, and emit GeoJSON label features.",
      "datePublished": "2026-07-11",
      "dateModified": "2026-07-11",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "/python-parsing-geometry-extraction/ezdxf-deep-dive/extracting-text-and-mtext-entities-with-ezdxf/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Python Parsing & Geometry Extraction", "item": "https://cad-gis-bim-interop.org/python-parsing-geometry-extraction/"},
        {"@type": "ListItem", "position": 2, "name": "ezdxf Deep Dive", "item": "https://cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/"},
        {"@type": "ListItem", "position": 3, "name": "Extracting TEXT and MTEXT Entities with ezdxf", "item": "https://cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/extracting-text-and-mtext-entities-with-ezdxf/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Extracting TEXT and MTEXT Entities with ezdxf",
      "description": "Harvest TEXT and MTEXT entities from a DXF file with position, height and rotation, cleaning MTEXT formatting codes into plain strings.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Query TEXT and MTEXT", "text": "Open the DXF with ezdxf.readfile() and query 'TEXT MTEXT' to collect both single-line and multiline text entities."},
        {"@type": "HowToStep", "position": 2, "name": "Read TEXT attributes", "text": "For TEXT read dxf.text, dxf.insert, dxf.height, dxf.rotation and dxf.style directly from the dxf namespace."},
        {"@type": "HowToStep", "position": 3, "name": "Clean MTEXT content", "text": "For MTEXT call plain_text() to strip inline formatting codes such as \\P, \\f and brace groups into a readable string."},
        {"@type": "HowToStep", "position": 4, "name": "Emit label features", "text": "Assemble position, height, rotation and cleaned text into dicts or GeoJSON point features for GIS labelling."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How do I strip formatting codes from MTEXT?",
          "acceptedAnswer": {"@type": "Answer", "text": "Call mtext.plain_text() to return the human-readable string with inline codes removed: paragraph breaks (\\P), font switches (\\f...;), colour and height changes, and brace grouping are stripped or converted. The raw formatted content is still available as mtext.text if you need the original markup."}
        },
        {
          "@type": "Question",
          "name": "What is the difference between TEXT and MTEXT height attributes?",
          "acceptedAnswer": {"@type": "Answer", "text": "TEXT stores its cap height in dxf.height. MTEXT stores its initial character height in dxf.char_height instead, and also carries dxf.width for the wrap box. Reading dxf.height on an MTEXT entity raises DXFAttributeError, so branch on the entity type before reading the height attribute."}
        },
        {
          "@type": "Question",
          "name": "Why does extracted text show garbled non-ASCII characters?",
          "acceptedAnswer": {"@type": "Answer", "text": "Older DXF files saved by non-Unicode AutoCAD versions store text in a code page rather than UTF-8. Open the file with ezdxf.readfile(path) and let ezdxf resolve the header code page, then normalise the result with unicodedata.normalize('NFC', text). MTEXT may also embed unicode as \\U+XXXX escapes, which plain_text() decodes."}
        },
        {
          "@type": "Question",
          "name": "Should I read ATTRIB entities the same way as TEXT?",
          "acceptedAnswer": {"@type": "Answer", "text": "ATTRIB and ATTDEF entities carry text but belong to block inserts and hold a tag/value pair, so they represent structured metadata rather than free labels. Extract them through the block attribute workflow instead of the free-text harvester to keep tag semantics intact."}
        }
      ]
    }
  ]
}
</script>

# Extracting TEXT and MTEXT Entities with ezdxf

To extract text with `ezdxf`, query both `TEXT` and `MTEXT` entities, read the string from `dxf.text` (single-line) or `plain_text()` (multiline, with formatting codes stripped), and pull position, height, and rotation from the `dxf` namespace. `TEXT` is a single-line entity with a straightforward set of attributes; `MTEXT` is a formatted multiline block whose content is peppered with inline control codes such as `\P` for paragraph breaks and `\f...;` for font switches, so its raw string is rarely what you want in an attribute table. Getting clean, positioned labels out of a drawing — the kind you attach to GIS features — means handling both entity types and their differing height attributes correctly. This page is part of the [ezdxf Deep Dive](/python-parsing-geometry-extraction/ezdxf-deep-dive/) reference on production-grade DXF parsing.

## How ezdxf Handles TEXT and MTEXT

`ezdxf` models the two DXF text entities separately because their storage differs. A `TEXT` entity holds its content in `entity.dxf.text`, its insertion point in `entity.dxf.insert` (a `Vec3`), its cap height in `entity.dxf.height`, its rotation in degrees in `entity.dxf.rotation`, and its named text style in `entity.dxf.style`. Everything you need is a plain attribute read.

`MTEXT` is richer and trickier. Its content is a single string that carries inline formatting: `\P` marks a paragraph break, `\f<font>;` switches font, `{ }` groups a formatted run, and sequences like `\H2x;` or `\C1;` change height and colour mid-string. Reading `entity.text` gives you this raw markup verbatim — useful only if you intend to preserve formatting. For a clean attribute value you call `entity.plain_text()`, which strips the control codes and returns readable text with paragraph breaks converted to newlines. `MTEXT` also stores its insertion point in `dxf.insert`, but its height lives in `dxf.char_height` (not `dxf.height`), and its anchor corner is `dxf.attachment_point` (an integer 1–9 mapping top-left through bottom-right).

<svg viewBox="0 0 700 250" role="img" aria-label="TEXT entities read dxf.text and dxf.height directly, while MTEXT entities are cleaned with plain_text and read char_height, both merging into positioned label records" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:700px;display:block;margin:1.5rem auto;">
  <title>TEXT and MTEXT Extraction to Label Records</title>
  <desc>Diagram showing two branches. TEXT entities provide dxf.text, dxf.height and dxf.rotation directly. MTEXT entities are passed through plain_text to strip formatting codes and read dxf.char_height. Both branches merge into a positioned label record with cleaned string, height and rotation.</desc>
  <defs>
    <marker id="txar" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" opacity="0.7"/>
    </marker>
  </defs>
  <rect x="30" y="24" width="180" height="60" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="120" y="46" text-anchor="middle" font-size="12" fill="currentColor">TEXT</text>
  <text x="120" y="64" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">dxf.text, dxf.height</text>
  <text x="120" y="78" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">dxf.rotation, dxf.insert</text>
  <rect x="30" y="164" width="180" height="60" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="120" y="186" text-anchor="middle" font-size="12" fill="currentColor">MTEXT</text>
  <text x="120" y="204" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">plain_text() cleanup</text>
  <text x="120" y="218" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">dxf.char_height</text>
  <line x1="210" y1="54" x2="326" y2="104" stroke="currentColor" stroke-width="1.5" marker-end="url(#txar)"/>
  <line x1="210" y1="194" x2="326" y2="144" stroke="currentColor" stroke-width="1.5" marker-end="url(#txar)"/>
  <rect x="330" y="96" width="176" height="56" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.85"/>
  <text x="418" y="118" text-anchor="middle" font-size="11" fill="currentColor">normalise + merge</text>
  <text x="418" y="136" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">NFC unicode, WCS point</text>
  <line x1="506" y1="124" x2="562" y2="124" stroke="currentColor" stroke-width="1.5" marker-end="url(#txar)"/>
  <rect x="564" y="94" width="120" height="60" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
  <text x="624" y="116" text-anchor="middle" font-size="10" fill="currentColor">label record</text>
  <text x="624" y="132" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">text, x, y,</text>
  <text x="624" y="146" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">height, angle</text>
</svg>

What `ezdxf` does *not* do is unify the two entities for you. There is no shared `.height` — reading `dxf.height` on an `MTEXT` raises `DXFAttributeError`, and reading `dxf.char_height` on a `TEXT` does the same in reverse. Nor does it decide that block attribute text (`ATTRIB`/`ATTDEF`) belongs in your label set; those carry a `tag` and `text` pair and represent structured metadata, better handled through the [block attribute extraction](/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/extracting-block-attributes-from-cad-files/) workflow so their tag semantics survive.

## Production-Ready Script

The script harvests every `TEXT` and `MTEXT` entity into a list of dicts and, optionally, GeoJSON point features keyed on the insertion point — ready to become labels on the [CAD polylines converted to GeoJSON](/python-parsing-geometry-extraction/geometry-mesh-conversion/converting-cad-polylines-to-geojson/) in the same pipeline.

```python
# ezdxf>=1.1.0, Python 3.9+
import ezdxf
import json
import unicodedata
from typing import List, Dict, Any

def harvest_text(dxf_path: str) -> List[Dict[str, Any]]:
    """Harvest TEXT and MTEXT entities as positioned, cleaned label records."""
    doc = ezdxf.readfile(dxf_path)   # ezdxf resolves the header code page
    msp = doc.modelspace()

    records: List[Dict[str, Any]] = []
    # Query both entity types in one pass.
    for e in msp.query("TEXT MTEXT"):
        etype = e.dxftype()
        if etype == "MTEXT":
            # plain_text() strips inline codes: \P, \f...;, {}, height/colour.
            content = e.plain_text()
            height = e.dxf.char_height          # MTEXT uses char_height
        else:  # TEXT
            content = e.dxf.text
            height = e.dxf.height               # TEXT uses height

        content = unicodedata.normalize("NFC", content).strip()
        if not content:
            continue                            # skip empty labels

        insert = e.dxf.insert                   # Vec3 insertion point
        records.append({
            "handle": e.dxf.handle,
            "type": etype,
            "layer": e.dxf.layer,
            "text": content,
            "x": float(insert.x),
            "y": float(insert.y),
            "z": float(insert.z),
            "height": float(height),
            # rotation is degrees; MTEXT stores it as dxf.rotation too.
            "rotation": float(e.dxf.get("rotation", 0.0)),
            "style": e.dxf.get("style", "Standard"),
        })

    return records

def records_to_geojson(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Convert label records to a GeoJSON FeatureCollection of points."""
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [r["x"], r["y"]]},
                "properties": {
                    "text": r["text"],
                    "height": r["height"],
                    "rotation": r["rotation"],
                    "layer": r["layer"],
                    "source_type": r["type"],
                },
            }
            for r in records
        ],
    }

if __name__ == "__main__":
    recs = harvest_text("input.dxf")
    print(f"Harvested {len(recs)} text labels")
    with open("labels.geojson", "w", encoding="utf-8") as fh:
        json.dump(records_to_geojson(recs), fh, ensure_ascii=False, indent=2)
```

**Key implementation notes:**

- `msp.query("TEXT MTEXT")` matches both entity types in a single traversal; the space-separated string is a type union, not two queries.
- Branch on `e.dxftype()` before reading height: `TEXT` exposes `dxf.height`, `MTEXT` exposes `dxf.char_height`. Crossing them raises `DXFAttributeError`.
- `mtext.plain_text()` is the correct cleaner. Do not regex-strip `entity.text` by hand — you will miss nested brace groups and `\U+XXXX` unicode escapes that `plain_text()` decodes.
- `unicodedata.normalize("NFC", ...)` collapses combining sequences so accented characters compare and store consistently downstream.
- `json.dump(..., ensure_ascii=False)` preserves non-ASCII characters directly in the GeoJSON rather than escaping them, which keeps the output readable and smaller.

## Compatibility Matrix

| Component | Supported Range | Notes |
|---|---|---|
| `ezdxf` version | `>=1.0.0` | `MTEXT.plain_text()` stable since 0.16; `>=1.1.0` recommended. |
| Python | `3.9+` | Uses `typing` generics and f-strings only. |
| DXF format | `R2000` (`AC1015`) — `R2018` (`AC1032`) | `TEXT` and `MTEXT` supported across the full range. |
| Height attribute | Type-specific | `TEXT` -> `dxf.height`; `MTEXT` -> `dxf.char_height`. Never shared. |
| Encoding | Code page + UTF-8 | `ezdxf` resolves the header code page on read; normalise with `unicodedata`. |
| ATTRIB / ATTDEF | Separate workflow | Structured tag/value metadata, not free labels; extract via block attributes. |

For the group-code anatomy of a `TEXT` entity (`1` for the string, `10`/`20` for the insertion point, `40` for height, `50` for rotation), see the [DXF Entity Structure Breakdown](/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/).

## Fallback Strategies

**1. MTEXT formatting artifacts after cleanup**

`plain_text()` handles the common codes, but drawings authored in specialised tools sometimes carry stacked fractions (`\S1/2;`), field codes, or vendor extensions that leave residual markers. After cleaning, run a lightweight sanitiser that collapses runs of whitespace and drops any remaining control characters so an odd fraction does not poison a label:

```python
import re

def tidy(text: str) -> str:
    text = re.sub(r"\s+", " ", text)              # collapse whitespace
    return "".join(ch for ch in text if ch.isprintable()).strip()
```

**2. Non-ASCII and legacy code-page text**

Files from older non-Unicode AutoCAD builds store text in a code page named in the header (`$DWGCODEPAGE`). Let `ezdxf.readfile()` resolve it rather than forcing an encoding, then apply `unicodedata.normalize("NFC", ...)`. If a specific file still garbles, log its handle and code page instead of dropping the record silently — a wrong label is worse than a flagged one.

**3. ATTRIB and ATTDEF confused with free text**

Block titles, room numbers, and asset tags usually live in `ATTRIB` entities attached to an `INSERT`, not in free `TEXT`. If your label harvest is missing obvious annotations, they are probably block attributes. Route those through the [block attribute extraction](/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/extracting-block-attributes-from-cad-files/) workflow so the tag/value structure is preserved and used as feature attributes for the GIS labels produced here.

**4. Stacked fractions and inline height changes**

Stacked fractions and mid-string height changes are legitimate MTEXT formatting but can distort a plain label. Decide policy explicitly: either flatten `1/2`-style stacks to a slash form (as `plain_text()` does) or, when the numeric value matters, parse the fraction into a real number in a post-step. Document the choice so downstream consumers know whether a label is display text or a parseable value.

**5. Rotation reference frame for placement**

Both entities store `rotation` in degrees, but placement conventions differ: `MTEXT` rotation combines with its `attachment_point` anchor, so a label may appear offset from its `insert` point unless you account for the anchor corner. When labels look shifted in the map, verify the `attachment_point` (1 = top-left through 9 = bottom-right) before adjusting coordinates.

## FAQ

<details>
<summary><strong>How do I strip formatting codes from MTEXT?</strong></summary>

Call `mtext.plain_text()` to return the human-readable string with inline codes removed: paragraph breaks (`\P`), font switches (`\f...;`), colour and height changes, and brace grouping are stripped or converted. The raw formatted content is still available as `mtext.text` if you need the original markup.

</details>

<details>
<summary><strong>What is the difference between TEXT and MTEXT height attributes?</strong></summary>

`TEXT` stores its cap height in `dxf.height`. `MTEXT` stores its initial character height in `dxf.char_height` instead, and also carries `dxf.width` for the wrap box. Reading `dxf.height` on an `MTEXT` entity raises `DXFAttributeError`, so branch on the entity type before reading the height attribute.

</details>

<details>
<summary><strong>Why does extracted text show garbled non-ASCII characters?</strong></summary>

Older DXF files saved by non-Unicode AutoCAD versions store text in a code page rather than UTF-8. Open the file with `ezdxf.readfile(path)` and let `ezdxf` resolve the header code page, then normalise the result with `unicodedata.normalize("NFC", text)`. MTEXT may also embed unicode as `\U+XXXX` escapes, which `plain_text()` decodes.

</details>

<details>
<summary><strong>Should I read ATTRIB entities the same way as TEXT?</strong></summary>

`ATTRIB` and `ATTDEF` entities carry text but belong to block inserts and hold a tag/value pair, so they represent structured metadata rather than free labels. Extract them through the block attribute workflow instead of the free-text harvester to keep tag semantics intact.

</details>

---

## Related Pages

- [ezdxf Deep Dive: Production-Grade DXF Parsing](/python-parsing-geometry-extraction/ezdxf-deep-dive/) — parent reference covering entity traversal and geometry extraction
- [Extracting LWPOLYLINE Vertices with ezdxf](/python-parsing-geometry-extraction/ezdxf-deep-dive/extracting-lwpolyline-vertices-with-ezdxf/) — sibling workflow for the polyline geometry these labels annotate
- [Reading 3D Solids with ezdxf Python](/python-parsing-geometry-extraction/ezdxf-deep-dive/reading-3d-solids-with-ezdxf-python/) — sibling workflow for `3DSOLID` ACIS payloads
- [Extracting Block Attributes from CAD Files](/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/extracting-block-attributes-from-cad-files/) — structured `ATTRIB` tag/value metadata that complements free text
- [Converting CAD Polylines to GeoJSON](/python-parsing-geometry-extraction/geometry-mesh-conversion/converting-cad-polylines-to-geojson/) — the GeoJSON pipeline these text labels attach to as feature properties
