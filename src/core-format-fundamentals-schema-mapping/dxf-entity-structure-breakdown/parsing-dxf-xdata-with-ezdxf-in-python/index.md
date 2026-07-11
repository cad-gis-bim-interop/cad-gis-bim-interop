---
title: "Parsing DXF XDATA with ezdxf in Python"
description: "How to read application-defined XDATA from DXF entities with ezdxf: APPID namespaces, group-code typing, nested 1002 control lists, and JSON export for AEC pipelines."
slug: "parsing-dxf-xdata-with-ezdxf-in-python"
breadcrumb:
  - label: "Core Format Fundamentals & Schema Mapping"
    url: "/core-format-fundamentals-schema-mapping/"
  - label: "DXF Entity Structure Breakdown"
    url: "/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/"
  - label: "Parsing DXF XDATA with ezdxf in Python"
    url: "/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/parsing-dxf-xdata-with-ezdxf-in-python/"
datePublished: "2026-07-11"
dateModified: "2026-07-11"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Parsing DXF XDATA with ezdxf in Python",
      "description": "How to read application-defined XDATA from DXF entities with ezdxf: APPID namespaces, group-code typing, nested 1002 control lists, and JSON export for AEC pipelines.",
      "datePublished": "2026-07-11",
      "dateModified": "2026-07-11",
      "author": {"@type": "Organization", "name": "CAD GIS BIM Interop"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/parsing-dxf-xdata-with-ezdxf-in-python/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Core Format Fundamentals & Schema Mapping", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/"},
        {"@type": "ListItem", "position": 2, "name": "DXF Entity Structure Breakdown", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/"},
        {"@type": "ListItem", "position": 3, "name": "Parsing DXF XDATA with ezdxf in Python", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/parsing-dxf-xdata-with-ezdxf-in-python/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Parsing DXF XDATA with ezdxf in Python",
      "description": "Read application-defined extended data from DXF entities with ezdxf, decode group-code types, resolve nested 1002 control lists, and export structured JSON.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Enumerate registered APPIDs", "text": "Read doc.appids to learn which application names may own XDATA in the drawing before iterating entities."},
        {"@type": "HowToStep", "position": 2, "name": "Test each entity for XDATA", "text": "Call entity.has_xdata(appid) to check whether an entity carries extended data for a given registered application id."},
        {"@type": "HowToStep", "position": 3, "name": "Read the tag list", "text": "Call entity.get_xdata(appid), which returns a list of (group_code, value) tuples ordered exactly as stored in the file."},
        {"@type": "HowToStep", "position": 4, "name": "Decode types and nesting", "text": "Map group codes to Python types (1000 string, 1010 point, 1040 real, 1070 int16, 1071 int32) and fold 1002 brace controls into nested lists."},
        {"@type": "HowToStep", "position": 5, "name": "Export structured JSON", "text": "Serialize the decoded, per-APPID XDATA into a JSON document keyed by entity handle for downstream schema mapping."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is the difference between XDATA and an extension dictionary in DXF?",
          "acceptedAnswer": {"@type": "Answer", "text": "XDATA is a flat, APPID-namespaced list of typed (group code, value) tuples appended to an entity and read with entity.get_xdata(appid). An extension dictionary is a separate DICTIONARY object referenced by the entity that can hold arbitrary child objects such as XRECORDs. They are distinct storage mechanisms; ezdxf exposes XDATA via get_xdata() and extension dictionaries via entity.get_extension_dict()."}
        },
        {
          "@type": "Question",
          "name": "Why does get_xdata raise DXFValueError?",
          "acceptedAnswer": {"@type": "Answer", "text": "entity.get_xdata(appid) raises DXFValueError when the entity has no XDATA for that APPID. Guard every call with entity.has_xdata(appid) first, or catch DXFValueError, because most entities in a drawing carry XDATA for only a subset of registered applications."}
        },
        {
          "@type": "Question",
          "name": "How are nested XDATA lists represented?",
          "acceptedAnswer": {"@type": "Answer", "text": "Group code 1002 carries the string '{' to open a list and '}' to close it. Braces can nest. ezdxf returns these control tuples inline in the (group code, value) list; you must fold them into a tree yourself by pushing on '{' and popping on '}'."}
        },
        {
          "@type": "Question",
          "name": "Can ezdxf read binary XDATA (group code 1004)?",
          "acceptedAnswer": {"@type": "Answer", "text": "Yes. Group code 1004 carries binary data, which ezdxf returns as a Python bytes object. It is not JSON-serializable directly, so encode it as hex or base64 before writing it into a JSON export."}
        }
      ]
    }
  ]
}
</script>

# Parsing DXF XDATA with ezdxf in Python

To parse DXF XDATA with `ezdxf`, test an entity with `entity.has_xdata(appid)` and read it with `entity.get_xdata(appid)`, which returns an ordered list of `(group_code, value)` tuples scoped to one registered application id. XDATA is application-defined extended data that any entity can carry — asset tags, GIS keys, revision markers written by AutoCAD verticals or custom plugins — and every block of it is namespaced by an APPID registered in `doc.appids`. `ezdxf` decodes the primitive group-code types for you but leaves the `1002` brace-control nesting for you to fold into a tree. This page is part of the [DXF Entity Structure Breakdown](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/) reference; it assumes you can already open a document and reach its entities.

## How ezdxf Handles XDATA

Every DXF entity — `LINE`, `LWPOLYLINE`, `INSERT`, `CIRCLE`, anything derived from the base entity — can carry one independent XDATA block per registered application. The application name is an APPID: a short symbolic key such as `ACAD`, `AcadAnnotative`, or a vendor string like `MYFIRM_ASSET`. APPIDs live in the `APPID` symbol table, exposed as `doc.appids`; an entity may only store XDATA under an APPID that is registered there, and reading unregistered names is undefined.

`entity.get_xdata(appid)` returns a `list[tuple[int, Any]]` — one tuple per stored value, in file order, starting with the mandatory `(1001, appid)` sentinel that opens every block. The group code in each tuple tells you the Python type `ezdxf` has already decoded the value into:

- **1000** — ASCII string (`str`)
- **1002** — list control: the string `'{'` opens a nested list, `'}'` closes it
- **1004** — binary data (`bytes`)
- **1010 / 1011 / 1012 / 1013** — 3D point or vector, returned as a `(x, y, z)` tuple
- **1040** — real / double (`float`)
- **1041 / 1042** — distance and scale-factor reals (`float`)
- **1070** — signed 16-bit integer (`int`)
- **1071** — signed 32-bit integer (`int`)

`ezdxf` does the primitive typing but does nothing semantic: it will not merge the `1002` braces into a structure, will not interpret what a `1000` string "means", and will not validate that a producer's schema is internally consistent. What you get back is the raw tuple stream, faithfully typed. The nesting is the one piece of structure you must reconstruct yourself, by treating `1002` as a stack instruction.

<svg viewBox="0 0 720 300" role="img" aria-label="XDATA decoding flow: an entity's tuple stream is split by APPID, group codes are typed, and 1002 braces are folded into a nested tree" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:720px;display:block;margin:1.5rem auto;">
  <title>Decoding an XDATA Tuple Stream into a Nested Tree</title>
  <desc>Flow diagram: a DXF entity yields a flat list of group-code and value tuples for a given APPID; a decoder maps each group code to a Python type; 1002 open and close braces are folded onto a stack to build a nested list, which is emitted as structured JSON.</desc>
  <defs>
    <marker id="ax" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor"/>
    </marker>
  </defs>
  <rect x="16" y="118" width="150" height="64" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="91" y="142" text-anchor="middle" font-size="12" fill="currentColor">DXF Entity</text>
  <text x="91" y="160" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">has_xdata(appid)</text>
  <line x1="166" y1="150" x2="204" y2="150" stroke="currentColor" stroke-width="1.5" marker-end="url(#ax)"/>
  <rect x="206" y="110" width="168" height="80" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="290" y="134" text-anchor="middle" font-size="12" fill="currentColor">get_xdata(appid)</text>
  <text x="290" y="152" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">flat list of</text>
  <text x="290" y="167" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">(code, value) tuples</text>
  <line x1="374" y1="150" x2="412" y2="150" stroke="currentColor" stroke-width="1.5" marker-end="url(#ax)"/>
  <rect x="414" y="110" width="168" height="80" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="498" y="134" text-anchor="middle" font-size="12" fill="currentColor">Type + fold</text>
  <text x="498" y="152" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">1000/1040/1070 typed</text>
  <text x="498" y="167" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">1002 push / pop</text>
  <line x1="582" y1="150" x2="620" y2="150" stroke="currentColor" stroke-width="1.5" marker-end="url(#ax)"/>
  <rect x="622" y="118" width="84" height="64" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="664" y="146" text-anchor="middle" font-size="12" fill="currentColor">Nested</text>
  <text x="664" y="164" text-anchor="middle" font-size="12" fill="currentColor">JSON</text>
  <rect x="206" y="228" width="376" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>
  <text x="394" y="250" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">1001 sentinel = APPID name; opens every block</text>
  <text x="394" y="267" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">1004 binary returned as bytes (hex-encode for JSON)</text>
  <line x1="290" y1="190" x2="290" y2="226" stroke="currentColor" stroke-width="1" stroke-dasharray="4 3" opacity="0.6" marker-end="url(#ax)"/>
</svg>

Because XDATA is where third-party tools stash their asset identifiers and classification codes, it is a primary source for [metadata extraction strategies](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/) — the values you recover here frequently become the join keys that bind CAD geometry to a GIS or asset-management database.

## Production-Ready Script

The following script iterates every entity across all layouts, reads XDATA for every registered APPID, folds `1002` control braces into nested Python lists, converts binary `1004` payloads to hex, and writes a structured JSON document keyed by entity handle.

```python
# ezdxf>=1.1.0 | python>=3.9
import ezdxf
from ezdxf.lldxf.const import DXFValueError
import json
import sys
from pathlib import Path
from typing import Any, Iterator

# DXF group codes that carry point/vector triples inside XDATA.
POINT_CODES = {1010, 1011, 1012, 1013}


def _typed_value(code: int, value: Any) -> Any:
    """Normalise a decoded XDATA value into a JSON-safe Python object."""
    if code in POINT_CODES:
        # ezdxf yields a Vec3 / tuple; store as a plain list of floats.
        return [float(c) for c in value]
    if code == 1004 and isinstance(value, (bytes, bytearray)):
        # Binary payload is not JSON-serialisable; hex-encode it.
        return value.hex()
    return value


def fold_xdata(tags: list[tuple[int, Any]]) -> list[Any]:
    """
    Fold a flat (code, value) XDATA tuple list into a nested structure.

    Group code 1002 is a list control: '{' opens a child list, '}' closes it.
    The leading (1001, appid) sentinel is skipped by the caller.
    """
    root: list[Any] = []
    stack: list[list[Any]] = [root]
    for code, value in tags:
        if code == 1002 and value == "{":
            child: list[Any] = []
            stack[-1].append(child)
            stack.append(child)
        elif code == 1002 and value == "}":
            if len(stack) > 1:
                stack.pop()
            # An unbalanced '}' is ignored rather than crashing the parse.
        else:
            stack[-1].append({"code": code, "value": _typed_value(code, value)})
    return root


def entity_xdata(entity, appids: list[str]) -> dict[str, list[Any]]:
    """Return {appid: nested_xdata} for every APPID this entity carries."""
    result: dict[str, list[Any]] = {}
    for appid in appids:
        if not entity.has_xdata(appid):
            continue
        try:
            tags = entity.get_xdata(appid)
        except DXFValueError:
            # Race between has_xdata and get_xdata is unlikely, but be safe.
            continue
        # Drop the mandatory (1001, appid) sentinel before folding.
        payload = [(c, v) for c, v in tags if c != 1001]
        result[appid] = fold_xdata(payload)
    return result


def iter_all_entities(doc) -> Iterator[Any]:
    """Yield entities from modelspace and every paper space layout."""
    for layout in doc.layouts:
        yield from layout


def dump_xdata(dxf_path: str, output_json: str) -> None:
    try:
        doc = ezdxf.readfile(dxf_path)
    except (IOError, ezdxf.DXFStructureError) as exc:
        sys.exit(f"Failed to load DXF: {exc}")

    # Registered application ids that may own XDATA in this document.
    appids = [appid.dxf.name for appid in doc.appids]
    if not appids:
        print("No APPIDs registered; drawing carries no XDATA.")

    records: list[dict[str, Any]] = []
    for entity in iter_all_entities(doc):
        xdata = entity_xdata(entity, appids)
        if not xdata:
            continue
        records.append({
            "handle": entity.dxf.handle,
            "dxftype": entity.dxftype(),
            "layer": entity.dxf.get("layer", "0"),
            "xdata": xdata,
        })

    Path(output_json).write_text(json.dumps(records, indent=2), encoding="utf-8")
    print(f"Extracted XDATA from {len(records)} entities -> {output_json}")


if __name__ == "__main__":
    dump_xdata("input.dxf", "xdata.json")
```

**Key implementation notes:**

- Read `doc.appids` once, up front. Each `appid.dxf.name` is the string you pass to `has_xdata()` / `get_xdata()`; iterating registered APPIDs is far cheaper than guessing names.
- Always gate `get_xdata()` with `has_xdata()`. Calling `get_xdata()` on an entity that lacks data for that APPID raises `DXFValueError`, not a `None` return.
- The `(1001, appid)` sentinel opens every block and is not data — strip it before folding, or it pollutes the top level of your tree.
- `fold_xdata()` uses an explicit stack rather than recursion, so arbitrarily deep `1002` nesting cannot blow the Python call stack, and an unbalanced closing brace degrades gracefully instead of raising.
- Point codes (`1010`–`1013`) come back as vector objects; coerce to plain float lists so `json.dumps` succeeds. Binary `1004` payloads are hex-encoded for the same reason.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `ezdxf` | `>=1.1.0` | `has_xdata` / `get_xdata` and `doc.appids` are stable from 1.0; 1.1.0+ recommended for consistent tuple typing. |
| Python | `3.9+` | Uses `pathlib`, `typing`, and dict-ordering guarantees. |
| DXF format | R2000 (`AC1015`) – R2018 (`AC1032`) | XDATA is defined from R12, but APPID handling is most reliable on R2000+. |
| Group codes | 1000–1071 | 1000 str, 1002 control, 1004 bytes, 1010–1013 point, 1040–1042 real, 1070 int16, 1071 int32. |
| Binary XDATA (1004) | All | Returned as `bytes`; hex- or base64-encode before JSON serialisation. |
| APPID registration | Required | Reading XDATA for an unregistered APPID is undefined; enumerate `doc.appids`. |

For the authoritative group-code definitions, consult the `ezdxf` XDATA documentation and the Autodesk DXF Reference section on extended entity data.

## Fallback Strategies

XDATA parsing fails in predictable ways. Handle these named scenarios in order.

**1. Missing or unregistered APPID**

If a producer wrote XDATA but the `APPID` table entry was stripped during a lossy export, `has_xdata()` returns `False` for a name you expect. Do not hard-code APPID strings; enumerate `doc.appids` and, when a critical vendor name is absent, log the drawing for re-export from the source application rather than silently emitting empty metadata.

**2. Unbalanced 1002 control strings**

Malformed or hand-edited files can contain a `'{'` with no matching `'}'`, or the reverse. Recursion-based folders crash on this. The stack-based `fold_xdata()` above tolerates it: an extra `'}'` is ignored, and any lists left open at end-of-stream simply remain open. Assert `len(stack) == 1` after folding in a CI gate if you need to flag such files.

**3. Binary 1004 payloads**

Group code `1004` carries raw bytes — often a serialized struct from a vendor plugin. It is opaque to `ezdxf` and not JSON-serializable. Hex-encode or base64-encode it for transport, and record its byte length; never `str()` a bytes object into your output, which produces the lossy `b'...'` repr.

**4. Distinguishing XDATA from reactors and extension dictionaries**

XDATA is not the only "extra" data on an entity. App reactors (persistent object handles) and extension dictionaries (a referenced `DICTIONARY` of child objects such as `XRECORD`s) are separate mechanisms. Reach XDATA only through `get_xdata()`; reach the extension dictionary through `entity.get_extension_dict()`. Conflating them causes you to miss data or double-count it. When the metadata you need is not in XDATA, check the extension dictionary before concluding the entity is bare.

**5. Oversized or per-entity-limited XDATA**

DXF historically capped XDATA at roughly 16 KB per entity per APPID. Producers that hit the ceiling split payloads across APPIDs or truncate them. If a decoded value looks clipped, check the raw byte length against that limit and treat the record as partial rather than authoritative.

## FAQ

<details>
<summary><strong>What is the difference between XDATA and an extension dictionary in DXF?</strong></summary>

XDATA is a flat, APPID-namespaced list of typed `(group code, value)` tuples appended directly to an entity and read with `entity.get_xdata(appid)`. An extension dictionary is a separate `DICTIONARY` object referenced by the entity that can hold arbitrary child objects such as `XRECORD`s. They are distinct storage mechanisms: `ezdxf` exposes XDATA via `get_xdata()` and the extension dictionary via `entity.get_extension_dict()`. Check both when hunting for producer metadata.

</details>

<details>
<summary><strong>Why does get_xdata raise DXFValueError?</strong></summary>

`entity.get_xdata(appid)` raises `DXFValueError` when the entity carries no XDATA for that APPID. Most entities store data for only a subset of the registered applications, so guard every call with `entity.has_xdata(appid)` first, or wrap it in a `try/except DXFValueError`. Never assume `get_xdata` returns `None` on a miss.

</details>

<details>
<summary><strong>How are nested XDATA lists represented?</strong></summary>

Group code `1002` is a list control. The value `'{'` opens a nested list and `'}'` closes it, and braces can nest to arbitrary depth. `ezdxf` returns these control tuples inline in the `(group code, value)` stream; you fold them into a tree yourself by pushing a new list on `'{'` and popping on `'}'`. Use an explicit stack rather than recursion so deep nesting and unbalanced braces cannot crash the parse.

</details>

<details>
<summary><strong>Can ezdxf read binary XDATA (group code 1004)?</strong></summary>

Yes. Group code `1004` carries binary data, which `ezdxf` returns as a Python `bytes` object. Because `bytes` is not JSON-serializable, encode it as hex or base64 before writing it into a JSON export, and store the byte length alongside it so downstream consumers can detect truncation.

</details>

---

## Related Pages

- [DXF Entity Structure Breakdown](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/) — parent reference covering group-code taxonomy and section structure that governs how XDATA is stored
- [How to Parse DXF Headers with Python](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/how-to-parse-dxf-headers-with-python/) — sibling workflow for reading document-level `HEADER` variables before entity traversal
- [Metadata Extraction Strategies](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/) — where recovered XDATA becomes the join key that binds CAD geometry to GIS and asset databases
- [ezdxf Deep Dive](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/) — related reference on document ingestion, entity traversal, and memory-efficient DXF processing
