---
title: "Reading 3D Solids with ezdxf in Python"
description: "To read 3D solids with ezdxf in Python, target SOLID3D entities in the DXF database and extract their embedded ACIS/SAT payload via the .acis_data attribute…"
---
# Reading 3D Solids with ezdxf Python: Extraction & Pipeline Integration

To read 3D solids with `ezdxf` in Python, target `SOLID3D` entities in the DXF database and extract their embedded ACIS/SAT payload via the `.acis_data` attribute. `ezdxf` does not natively reconstruct B-Rep topology, generate meshes, or convert parametric geometry to standard formats. It strictly exposes the raw ACIS string stored in the DXF file. For production AEC/GIS pipelines, you must pair this extraction with a dedicated ACIS parser or a geometry kernel (e.g., OpenCASCADE, `trimesh`, or commercial CAD APIs) to convert the payload into usable vertices, faces, or STEP/IGES outputs.

## How `ezdxf` Handles 3D Solids in DXF Files

AutoCAD stores parametric 3D geometry as `SOLID3D` entities. Unlike basic `3DFACE` or `POLYLINE` objects, `SOLID3D` entities encapsulate a complete Boundary Representation (B-Rep) inside a proprietary ACIS/SAT text blob. When you parse a DXF file, `ezdxf` reads this blob directly from DXF group codes `1` and `3`, concatenating them into a single string or list of strings. 

In automated interoperability workflows, treating `SOLID3D` as a raw payload rather than a ready-to-render mesh prevents topology corruption. As outlined in our [Python Parsing & Geometry Extraction](/python-parsing-geometry-extraction/) guide, DXF files frequently mix faceted approximations with true parametric solids. Routing ACIS payloads to a downstream conversion service preserves precision and avoids the silent data loss that occurs when forcing solids into polygonal formats prematurely. For deeper architectural patterns around entity traversal and memory-efficient DXF processing, consult the [ezdxf Deep Dive](/python-parsing-geometry-extraction/ezdxf-deep-dive/).

## Production-Ready Extraction Script

The following script safely extracts ACIS payloads, handles multi-line DXF group codes, and outputs structured JSON for downstream processing. It includes explicit error handling for missing attributes and malformed DXF headers.

```python
import ezdxf
import json
import sys
from pathlib import Path
from typing import List, Dict, Any

def extract_solid3d_acis(dxf_path: str, output_json: str) -> None:
    """Extracts ACIS/SAT payloads from SOLID3D entities in a DXF file."""
    try:
        doc = ezdxf.readfile(dxf_path)
        msp = doc.modelspace()
    except ezdxf.DXFError as e:
        sys.exit(f"Failed to load DXF: {e}")

    solids = msp.query("SOLID3D")
    if not solids:
        print("No SOLID3D entities found in modelspace.")
        return

    extracted: List[Dict[str, Any]] = []
    for solid in solids:
        # ACIS data may be stored as a string or a list of strings
        acis_payload = getattr(solid.dxf, "acis_data", None)
        if not acis_payload:
            continue

        if isinstance(acis_payload, (list, tuple)):
            acis_str = "\n".join(str(line) for line in acis_payload)
        else:
            acis_str = str(acis_payload)

        # Basic ACIS header validation
        if not acis_str.strip().startswith("ACIS"):
            print(f"Warning: Handle {solid.dxf.handle} contains malformed ACIS data.")
            continue

        extracted.append({
            "entity_handle": solid.dxf.handle,
            "layer": solid.dxf.layer,
            "acis_version": acis_str.split("\n")[0].strip(),
            "payload_length_bytes": len(acis_str.encode("utf-8")),
            "raw_acis": acis_str
        })

    Path(output_json).write_text(json.dumps(extracted, indent=2), encoding="utf-8")
    print(f"Successfully extracted {len(extracted)} SOLID3D payloads to {output_json}")

if __name__ == "__main__":
    extract_solid3d_acis("input.dxf", "solids_acis.json")
```

**Key Implementation Notes:**
- `msp.query("SOLID3D")` filters only true parametric solids, ignoring `3DSOLID` legacy variants.
- The script validates the `ACIS` header string to skip corrupted or encrypted payloads.
- Output JSON separates metadata from the raw payload, enabling batch routing to geometry kernels without loading full strings into memory.

## Compatibility Matrix & Constraints

| Component | Supported Range | Notes |
|-----------|----------------|-------|
| `ezdxf` Version | `>=1.0.0` | Earlier versions inconsistently join ACIS group codes. |
| Python | `3.8+` | Requires `typing` and `pathlib` standard libraries. |
| DXF Format | `R2000` to `R2018` | `SOLID3D` stabilized in R2000. Newer DXF versions may use encrypted ACIS. |
| ACIS/SAT Format | `v1.0` – `v7.x` | Proprietary Spatial format. Parsing requires licensed or open-source kernels. |
| OS | Cross-platform | ACIS parsing binaries often require Windows/Linux native builds. |
| Known Limitations | Encrypted payloads, custom solids | AutoCAD 2021+ may apply DRM to ACIS data. Custom solids may lack standard headers. |

For official DXF entity specifications, reference the [Autodesk DXF Reference](https://help.autodesk.com/view/OARX/2024/ENU/?guid=AutoCAD_DXF_Reference). When integrating with open-source geometry kernels, consult the [OpenCASCADE Documentation](https://dev.opencascade.org/doc/overview/html/) for SAT import workflows.

## Fallback Strategies When ACIS Extraction Fails

ACIS payloads frequently fail in automated pipelines due to encryption, version mismatches, or proprietary extensions. Implement these fallbacks to maintain pipeline continuity:

1. **Pre-Process to Mesh in AutoCAD/Civil 3D:** Run a batch script using AutoLISP or .NET API to convert `SOLID3D` to `MESH` entities before DXF export. `ezdxf` can then parse faceted geometry directly via `MESH` or `3DFACE` queries, bypassing ACIS entirely.
2. **Use `trimesh` for Polygonal Conversion:** If the DXF contains embedded mesh approximations, export vertices/faces to `trimesh` for lightweight analysis. This avoids B-Rep reconstruction but sacrifices parametric precision.
3. **Route to STEP/IGES Export:** Convert solids to STEP (`*.step`) or IGES (`*.iges`) using a CAD intermediary. STEP preserves topology and is natively supported by `cadquery` and `pythonocc-core`.
4. **Handle Encrypted ACIS Gracefully:** If `acis_data` starts with `Acis` but contains unreadable characters, the payload is likely encrypted. Log the entity handle, skip conversion, and flag the file for manual review or licensed ACIS SDK processing.

When building infrastructure platform integrations, always validate ACIS headers before routing to geometry kernels. Failing fast on malformed payloads prevents downstream crashes in mesh generation or spatial indexing services. Combine `ezdxf` extraction with strict schema validation to ensure consistent output across heterogeneous CAD sources.