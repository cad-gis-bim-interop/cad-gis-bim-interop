---
title: "Reading 3D Solids with ezdxf Python: Extract ACIS Payloads from DXF Files"
description: "How to read 3DSOLID entities with ezdxf in Python: access ACIS/SAT payloads, validate headers, handle encrypted blobs, and route geometry to OpenCASCADE or STEP for production AEC pipelines."
slug: "reading-3d-solids-with-ezdxf-python"
breadcrumb:
  - label: "Python Parsing & Geometry Extraction"
    url: "/python-parsing-geometry-extraction/"
  - label: "ezdxf Deep Dive"
    url: "/python-parsing-geometry-extraction/ezdxf-deep-dive/"
  - label: "Reading 3D Solids with ezdxf Python"
    url: "/python-parsing-geometry-extraction/ezdxf-deep-dive/reading-3d-solids-with-ezdxf-python/"
datePublished: "2025-01-15"
dateModified: "2026-06-24"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Reading 3D Solids with ezdxf Python: Extract ACIS Payloads from DXF Files",
      "description": "How to read 3DSOLID entities with ezdxf in Python: access ACIS/SAT payloads, validate headers, handle encrypted blobs, and route geometry to OpenCASCADE or STEP for production AEC pipelines.",
      "datePublished": "2025-01-15",
      "dateModified": "2026-06-24",
      "author": {"@type": "Organization", "name": "CAD GIS BIM Interop"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/reading-3d-solids-with-ezdxf-python/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Python Parsing & Geometry Extraction", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/"},
        {"@type": "ListItem", "position": 2, "name": "ezdxf Deep Dive", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/"},
        {"@type": "ListItem", "position": 3, "name": "Reading 3D Solids with ezdxf Python", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/reading-3d-solids-with-ezdxf-python/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Reading 3D Solids with ezdxf Python",
      "description": "Extract ACIS/SAT payloads from DXF 3DSOLID entities using ezdxf, validate headers, and route geometry to downstream kernels.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Open DXF and query modelspace", "text": "Load the DXF file with ezdxf.readfile() and call doc.modelspace().query('3DSOLID') to collect all solid entities."},
        {"@type": "HowToStep", "position": 2, "name": "Access the ACIS payload", "text": "Read solid.acis, which returns a list of strings — one per SAT line — representing the raw Boundary Representation blob."},
        {"@type": "HowToStep", "position": 3, "name": "Validate the ACIS header", "text": "Check that the first line starts with 'ACIS' or 'ASM'. Payloads that fail this check are encrypted or proprietary and should be logged for separate handling."},
        {"@type": "HowToStep", "position": 4, "name": "Serialize for downstream processing", "text": "Join lines and write structured JSON containing entity handle, layer, ACIS version, and raw payload for routing to OpenCASCADE, python-occ, or a STEP conversion service."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Does ezdxf reconstruct B-Rep topology from 3DSOLID entities?",
          "acceptedAnswer": {"@type": "Answer", "text": "No. ezdxf exposes the raw ACIS/SAT text blob stored in DXF group codes 1 and 3. It does not parse ACIS geometry, generate meshes, or rebuild topology. A separate geometry kernel such as OpenCASCADE (via python-occ) is required for mesh reconstruction."}
        },
        {
          "@type": "Question",
          "name": "Why does solid.acis return an empty list?",
          "acceptedAnswer": {"@type": "Answer", "text": "AutoCAD 2021 and later can store ACIS data as an encrypted binary blob. When encryption is applied, ezdxf cannot read the payload and solid.acis returns an empty list. The entity handle should be logged and the file flagged for processing with a licensed Spatial ACIS SDK."}
        },
        {
          "@type": "Question",
          "name": "What is the difference between 3DSOLID and MESH in DXF?",
          "acceptedAnswer": {"@type": "Answer", "text": "3DSOLID stores a parametric Boundary Representation (B-Rep) encoded as an ACIS/SAT string. MESH and 3DFACE store explicit polygonal facets. ezdxf can extract vertex data from MESH and 3DFACE directly; 3DSOLID requires ACIS parsing for full geometry access."}
        },
        {
          "@type": "Question",
          "name": "Can I convert a 3DSOLID payload to STEP without a commercial CAD tool?",
          "acceptedAnswer": {"@type": "Answer", "text": "Yes, using python-occ (pythonOCC), which wraps OpenCASCADE. Load the ACIS string with BRepTools and export with STEPControl_Writer. The conversion preserves B-Rep topology. cadquery also provides a higher-level interface to OpenCASCADE for STEP export."}
        }
      ]
    }
  ]
}
</script>

# Reading 3D Solids with ezdxf Python: Extract ACIS Payloads from DXF Files

To read 3D solids with `ezdxf` in Python, query `3DSOLID` entities from the DXF modelspace and access their embedded ACIS/SAT payload via the `.acis` property. `ezdxf` does not reconstruct B-Rep topology, generate meshes, or convert parametric geometry to standard triangle formats — it exposes the raw ACIS string exactly as stored in the DXF file. For production AEC/GIS pipelines, pair this extraction with a dedicated ACIS parser or geometry kernel (`python-occ`, OpenCASCADE, or `cadquery`) to convert the payload into usable vertices, faces, or STEP/IGES outputs. For broader entity traversal and memory-efficient DXF processing, see the [ezdxf Deep Dive](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/).

## How `ezdxf` Handles 3D Solids in DXF Files

AutoCAD stores parametric 3D geometry as `3DSOLID` entities. Unlike basic `3DFACE` or `MESH` objects, `3DSOLID` entities encapsulate a complete Boundary Representation (B-Rep) inside a proprietary ACIS/SAT text blob. When you parse a DXF file, `ezdxf` reads this blob directly from DXF group codes `1` and `3`, making it accessible through the `.acis` property as a list of strings — one string per ACIS line.

The diagram below shows where `3DSOLID` fits in a DXF entity pipeline and why ACIS payloads must be routed separately from faceted geometry.

<!-- fig:solids-acis-boundary -->
<svg viewBox="-20 -33.5 427.6 125.8" role="img" aria-label="ezdxf returns the ACIS payload of a 3DSOLID verbatim; evaluating the boundary representation needs a separate modelling kernel" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:428px;display:block;margin:1.5rem auto;">
  <title>Where the library stops and the ACIS payload begins</title>
  <desc>Three stages and the boundary between them. The library reads the entity and hands back its embedded ACIS payload verbatim as text or binary. It does not evaluate that payload — the boundary representation inside it is a separate modelling kernel's format. Turning it into faces requires a kernel; without one, what you have is a blob with a version header.</desc>
  <defs>
    <marker id="sol1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="sol1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-33.5" width="427.6" height="125.8" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="115.3" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="57.6" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">3DSOLID entity</text>
  <text x="57.6" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">msp.query()</text>
  <rect x="149.3" y="0" width="109.7" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="204.2" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">ACIS payload</text>
  <text x="204.2" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">returned verbatim</text>
  <rect x="293" y="0" width="94.6" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 4"/>
  <text x="340.3" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">B-rep faces</text>
  <text x="340.3" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">not from ezdxf</text>
  <line x1="115.3" y1="24.1" x2="149.3" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#sol1-a)"/>
  <text x="132.3" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">.acis</text>
  <line x1="259" y1="24.1" x2="293" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#sol1-a)"/>
  <text x="276" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">needs a kernel</text>
  <text x="0" y="70.2" font-size="9.5" fill="currentColor" fill-opacity="0.7">The library is a reader, not a modeller — it never claims to evaluate the payload.</text>
</svg>
<!-- /fig:solids-acis-boundary -->

<svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="DXF entity routing diagram: faceted geometry flows directly to mesh output; 3DSOLID routes through ACIS validation to a geometry kernel" style="width:100%;max-width:640px;display:block;margin:1.5rem auto;">
  <title>3DSOLID Entity Routing in a DXF Parsing Pipeline</title>
  <desc>Diagram showing DXF modelspace entities split into two routes: 3DFACE and MESH flow directly to polygonal mesh output, while 3DSOLID entities are validated for ACIS headers then routed to a geometry kernel (OpenCASCADE / python-occ) for B-Rep to mesh conversion.</desc>
  <!-- Background -->
  <rect x="0" y="0" width="640" height="260" fill="var(--color-surface)"/>
  <!-- Modelspace box -->
  <rect x="220" y="10" width="200" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="320" y="28" text-anchor="middle" font-size="13" fill="currentColor" font-family="sans-serif">DXF Modelspace</text>
  <text x="320" y="46" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">msp.query()</text>
  <!-- Arrow down from modelspace -->
  <line x1="320" y1="54" x2="320" y2="80" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <!-- Decision diamond -->
  <polygon points="320,80 390,115 320,150 250,115" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="320" y="110" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">Entity</text>
  <text x="320" y="127" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">type?</text>
  <!-- Left branch: faceted -->
  <line x1="250" y1="115" x2="100" y2="115" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="175" y="108" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif">3DFACE / MESH</text>
  <rect x="20" y="95" width="80" height="40" rx="5" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="60" y="113" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">Polygonal</text>
  <text x="60" y="128" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">Mesh Output</text>
  <!-- Right branch: 3DSOLID -->
  <line x1="390" y1="115" x2="530" y2="115" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="462" y="108" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif">3DSOLID</text>
  <!-- ACIS validate box -->
  <rect x="530" y="95" width="96" height="40" rx="5" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="578" y="113" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">Validate</text>
  <text x="578" y="128" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">ACIS header</text>
  <!-- Arrow down from ACIS validate -->
  <line x1="578" y1="135" x2="578" y2="175" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <!-- Encrypted path -->
  <line x1="578" y1="175" x2="490" y2="210" stroke="currentColor" stroke-width="1" stroke-dasharray="4 3" marker-end="url(#arrd)"/>
  <text x="520" y="197" text-anchor="middle" font-size="9" fill="currentColor" font-family="sans-serif">encrypted/empty</text>
  <rect x="390" y="210" width="100" height="36" rx="5" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="4 3"/>
  <text x="440" y="228" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif">Log &amp; flag</text>
  <text x="440" y="242" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif">for ACIS SDK</text>
  <!-- Valid path -->
  <line x1="578" y1="175" x2="578" y2="215" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <rect x="530" y="215" width="96" height="36" rx="5" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="578" y="233" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">Geometry</text>
  <text x="578" y="247" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">Kernel (OCC)</text>
  <!-- Arrow defs -->
  <defs>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor"/>
    </marker>
    <marker id="arrd" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor"/>
    </marker>
  </defs>
</svg>

In automated interoperability workflows, treating `3DSOLID` as a raw payload — rather than a ready-to-render mesh — prevents topology corruption. DXF files frequently mix faceted approximations (`MESH`, `3DFACE`) with true parametric solids. Routing ACIS payloads to a downstream conversion service preserves precision and avoids silent data loss that occurs when forcing solids into polygonal formats prematurely.

This distinction also matters for [Geometry & Mesh Conversion](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/) workflows: attempting to pass an unprocessed `3DSOLID` entity directly into `trimesh` or a GeoJSON serializer will silently drop the geometry.

## Production-Ready Script

The following script safely extracts ACIS payloads from all `3DSOLID` entities in a DXF file, handles multi-line ACIS data, validates the payload header, and writes structured JSON for downstream processing.

```python
# ezdxf>=1.1.0, Python 3.9+
import ezdxf
import json
import sys
from pathlib import Path
from typing import List, Dict, Any

def extract_3dsolid_acis(dxf_path: str, output_json: str) -> None:
    """Extract ACIS/SAT payloads from 3DSOLID entities in a DXF file."""
    try:
        doc = ezdxf.readfile(dxf_path)
        msp = doc.modelspace()
    except ezdxf.DXFError as e:
        sys.exit(f"Failed to load DXF: {e}")

    # The correct DXF entity type string is "3DSOLID" — not "SOLID3D"
    solids = msp.query("3DSOLID")
    if not solids:
        print("No 3DSOLID entities found in modelspace.")
        return

    extracted: List[Dict[str, Any]] = []
    for solid in solids:
        # .acis returns list[str] — one entry per SAT line
        acis_lines: List[str] = solid.acis
        if not acis_lines:
            # Likely encrypted; log the handle for licensed ACIS SDK processing
            print(f"Warning: Handle {solid.dxf.handle} has empty ACIS payload (possibly encrypted).")
            continue

        acis_str = "\n".join(acis_lines)

        # Validate ACIS header: first line must start with "ACIS" or "ASM"
        first_line = acis_lines[0].strip()
        if not (first_line.startswith("ACIS") or first_line.startswith("ASM")):
            print(f"Warning: Handle {solid.dxf.handle} has unrecognized ACIS header: {first_line!r}")
            continue

        extracted.append({
            "entity_handle": solid.dxf.handle,
            "layer": solid.dxf.layer,
            "acis_version": first_line,
            "line_count": len(acis_lines),
            "payload_length_bytes": len(acis_str.encode("utf-8")),
            "raw_acis": acis_str,
        })

    Path(output_json).write_text(json.dumps(extracted, indent=2), encoding="utf-8")
    print(f"Extracted {len(extracted)} 3DSOLID payloads → {output_json}")

if __name__ == "__main__":
    extract_3dsolid_acis("input.dxf", "solids_acis.json")
```

**Key implementation notes:**

- `msp.query("3DSOLID")` uses the correct DXF type string. The variant `SOLID3D` does not exist in the DXF specification and will return no results silently.
- `solid.acis` returns `list[str]`, one entry per SAT line. Do not attempt `solid.dxf.acis_data` — that attribute does not exist on the `dxf` namespace object and will raise `DXFAttributeError`.
- Some AutoCAD 2021+ versions store ACIS data as an encrypted binary blob. These payloads will appear as an empty list and must be handled separately (see fallback strategies below).
- Separating metadata (`entity_handle`, `layer`, `acis_version`) from the raw payload in the output JSON lets downstream batch routers filter and dispatch without loading full ACIS strings unnecessarily.
- The `DXFError` guard around `ezdxf.readfile()` catches malformed headers and version mismatches before any entity iteration begins — especially important when processing bulk DXF exports from [DXF entity structure breakdown](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/) pipelines.

## Compatibility Matrix

| Component | Supported Range | Notes |
|---|---|---|
| `ezdxf` version | `>=1.0.0` | Earlier versions may handle ACIS line joining differently; `>=1.1.0` recommended. |
| Python | `3.9+` | Uses `typing`, `pathlib`, and walrus-free list comprehensions. |
| DXF format | `R2000` (`AC1015`) — `R2018` (`AC1032`) | `3DSOLID` stabilized in R2000. Newer versions may encrypt ACIS. |
| ACIS/SAT format | `v1.0` — `v7.x` | Proprietary Spatial format. Full parsing requires OpenCASCADE, `python-occ`, or a licensed ACIS SDK. |
| OS | Cross-platform | ACIS parsing binaries from OpenCASCADE often require platform-native builds. |
| Encrypted payloads | AutoCAD 2021+ | `solid.acis` returns `[]`; requires Spatial ACIS SDK or AutoCAD batch export as STEP before processing. |
| Custom entity types | Civil 3D, Plant 3D | May use subclass extensions that lack standard ACIS headers; validate before routing. |

For the official entity specification, see the [Autodesk DXF Reference for 3DSOLID](https://help.autodesk.com/view/OARX/2024/ENU/?guid=GUID-235B22E0-A567-4CF6-92D3-38A2306D73F3). For geometry kernel integration, consult the [OpenCASCADE documentation](https://dev.opencascade.org/doc/overview/html/).

## Fallback Strategies When ACIS Extraction Fails

ACIS payloads fail in automated pipelines for three main reasons: encryption (AutoCAD 2021+), ACIS version mismatches, or proprietary subclass extensions from vertical products. Implement these fallbacks in priority order to maintain pipeline continuity.

<!-- fig:solids-failure-modes -->
<svg viewBox="-20 -20 511.8 184.1" role="img" aria-label="Encrypted payloads, ACIS version mismatch and proprietary subclasses — why a 3DSOLID payload will not open" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:512px;display:block;margin:1.5rem auto;">
  <title>Three reasons an ACIS payload will not open</title>
  <desc>The three recurring extraction failures, what each looks like when you inspect the payload, and what can be done about it. Encryption in particular is not a bug to work around: from AutoCAD 2021 the payload is deliberately obscured, and the honest response is to re-export from the authoring application in a mesh format rather than to attempt recovery.</desc>
  <defs>
    <marker id="sol2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="sol2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="511.8" height="184.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="471.8" height="122" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="471.8" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">Cause</text>
  <text x="212.1" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">What you see</text>
  <line x1="290.8" y1="0" x2="290.8" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="381.3" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">What actually works</text>
  <line x1="133.4" y1="0" x2="133.4" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="471.8" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">Encrypted (2021+)</text>
  <text x="212.1" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">payload will not parse</text>
  <text x="381.3" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">re-export as mesh from the author</text>
  <line x1="0" y1="62" x2="471.8" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">ACIS version too new</text>
  <text x="212.1" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">header reads, body does not</text>
  <text x="381.3" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">export to an older release</text>
  <line x1="0" y1="92" x2="471.8" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">Proprietary subclass</text>
  <text x="212.1" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">parses, geometry incomplete</text>
  <text x="381.3" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">request a neutral format</text>
  <text x="0" y="142" font-size="9.5" fill="currentColor" fill-opacity="0.7">Detect and report per entity — a run that drops solids silently reads as a successful run.</text>
</svg>
<!-- /fig:solids-failure-modes -->

**1. Pre-process to mesh before DXF export**

Run a batch AutoLISP or .NET script inside AutoCAD or Civil 3D to convert `3DSOLID` entities to `MESH` entities before the DXF is written. `ezdxf` then resolves faceted geometry via `MESH` or `3DFACE` queries, bypassing ACIS entirely. This is the most reliable fallback for pipelines where you control the export step.

**2. Export as STEP or IGES from the source application**

Convert solids to `*.step` or `*.iges` using AutoCAD's export dialog or a command-line batch script. STEP preserves full B-Rep topology and is natively importable by `python-occ` (`pythonOCC`) and `cadquery`. This is the recommended path when parametric accuracy must be preserved for spatial analysis or BIM-to-GIS coordinate transformation — for example, before running [CAD local coordinate to EPSG:4326 conversion](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/converting-cad-local-coordinates-to-epsg4326/).

```python
# python-occ STEP import example (pythonOCC>=7.7.0)
from OCC.Core.STEPControl import STEPControl_Reader
from OCC.Core.IFSelect import IFSelect_RetDone

reader = STEPControl_Reader()
status = reader.ReadFile("model.step")
if status == IFSelect_RetDone:
    reader.TransferRoots()
    shape = reader.OneShape()
```

**3. Use `trimesh` for polygonal approximations**

If the DXF contains embedded mesh approximations alongside the solids, extract facets from `MESH` and `3DFACE` entities and pass them to `trimesh` for lightweight analysis. This bypasses B-Rep reconstruction but sacrifices parametric precision — acceptable for visual validation or GIS footprint extraction but not for engineering tolerances.

**4. Handle encrypted payloads explicitly**

When `solid.acis` returns `[]` or the first line does not start with `ACIS`/`ASM`, log the entity handle and skip conversion. Batch-log affected files for manual review or for routing to a licensed Spatial ACIS SDK. Never let a silent empty-list result pass through as valid geometry — this is a common source of corrupt spatial indexes downstream.

**5. Validate ACIS headers in CI gates**

Add a pre-processing assertion that counts entities where `solid.acis` is non-empty versus total `3DSOLID` count. If more than 20% of solids have empty payloads, fail the pipeline early and raise an alert rather than silently producing an incomplete geometry dataset. This is particularly important in batch DXF processing pipelines that feed into GIS ingestion or BIM coordination workflows.

<details>
<summary>Does ezdxf reconstruct B-Rep topology from 3DSOLID entities?</summary>

No. `ezdxf` exposes only the raw ACIS/SAT text blob stored in DXF group codes `1` and `3`. It does not parse ACIS geometry, generate triangle meshes, or rebuild B-Rep topology. A separate geometry kernel — such as OpenCASCADE via `python-occ` — is required for any mesh reconstruction or solid analysis.

</details>

<details>
<summary>Why does solid.acis return an empty list?</summary>

AutoCAD 2021 and later versions can store ACIS data as an encrypted binary blob when the drawing contains licensed geometry or DRM-protected content. When encryption is applied, `ezdxf` cannot decode the payload and `.acis` returns `[]`. Log the entity handle and route the file to a licensed Spatial ACIS SDK or export as STEP from within AutoCAD.

</details>

<details>
<summary>What is the difference between 3DSOLID and MESH in DXF?</summary>

`3DSOLID` stores a parametric Boundary Representation encoded as an ACIS/SAT string — it carries exact topology, curved surfaces, and feature history. `MESH` and `3DFACE` store explicit polygonal facets: a list of vertices and face indices with no parametric information. `ezdxf` can extract vertex coordinates from `MESH` and `3DFACE` directly; `3DSOLID` requires ACIS parsing for full geometry access.

</details>

<details>
<summary>Can I convert a 3DSOLID ACIS payload to STEP without AutoCAD?</summary>

Yes. `python-occ` (pythonOCC) wraps OpenCASCADE and can import ACIS strings via `BRepTools` then export using `STEPControl_Writer`. `cadquery` provides a higher-level interface to the same OpenCASCADE backend. Both approaches preserve B-Rep topology and produce standards-conformant STEP files suitable for downstream GIS or structural analysis.

</details>

---

## Related Pages

- [ezdxf Deep Dive: Production-Grade DXF Parsing](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/) — parent reference covering entity traversal, block references, and memory-efficient DXF processing
- [Python Parsing & Geometry Extraction](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/) — overview of the full extraction pipeline from DXF and IFC ingestion through to GIS-ready outputs
- [Geometry & Mesh Conversion](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/) — converting extracted geometry (including solid approximations) to GeoJSON, trimesh, and other polygonal formats
- [Converting CAD Local Coordinates to EPSG:4326](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/converting-cad-local-coordinates-to-epsg4326/) — georeferencing the vertex data produced after ACIS-to-mesh conversion
- [DXF Entity Structure Breakdown](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/) — group code taxonomy and section structure that governs how `3DSOLID` payloads are stored and read
