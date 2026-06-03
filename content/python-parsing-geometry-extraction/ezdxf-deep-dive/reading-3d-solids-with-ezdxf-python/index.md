# Reading 3D Solids with ezdxf Python: Extraction & Pipeline Integration

To read 3D solids with `ezdxf` in Python, query `3DSOLID` entities from the DXF modelspace and access their embedded ACIS/SAT payload via the `.acis` property. `ezdxf` does not reconstruct B-Rep topology, generate meshes, or convert parametric geometry to standard triangle formats. It exposes the raw ACIS string as stored in the DXF file. For production AEC/GIS pipelines, pair this extraction with a dedicated ACIS parser or geometry kernel (OpenCASCADE, `python-occ`, or a commercial CAD API) to convert the payload into usable vertices, faces, or STEP/IGES outputs.

## How `ezdxf` Handles 3D Solids in DXF Files

AutoCAD stores parametric 3D geometry as `3DSOLID` entities. Unlike basic `3DFACE` or `MESH` objects, `3DSOLID` entities encapsulate a complete Boundary Representation (B-Rep) inside a proprietary ACIS/SAT text blob. When you parse a DXF file, `ezdxf` reads this blob directly from DXF group codes `1` and `3`, making it accessible through the `.acis` property as a list of strings (one string per ACIS line).

In automated interoperability workflows, treating `3DSOLID` as a raw payload rather than a ready-to-render mesh prevents topology corruption. DXF files frequently mix faceted approximations (`MESH`, `3DFACE`) with true parametric solids. Routing ACIS payloads to a downstream conversion service preserves precision and avoids silent data loss that occurs when forcing solids into polygonal formats prematurely. For deeper architectural patterns around entity traversal and memory-efficient DXF processing, consult the [ezdxf Deep Dive](/python-parsing-geometry-extraction/ezdxf-deep-dive/).

## Production-Ready Extraction Script

The following script safely extracts ACIS payloads from all `3DSOLID` entities in a DXF file, handles multi-line ACIS data, validates the payload header, and outputs structured JSON for downstream processing.

```python
import ezdxf
import json
import sys
from pathlib import Path
from typing import List, Dict, Any

def extract_3dsolid_acis(dxf_path: str, output_json: str) -> None:
    """Extracts ACIS/SAT payloads from 3DSOLID entities in a DXF file."""
    try:
        doc = ezdxf.readfile(dxf_path)
        msp = doc.modelspace()
    except ezdxf.DXFError as e:
        sys.exit(f"Failed to load DXF: {e}")

    # The correct DXF entity name is "3DSOLID", not "SOLID3D"
    solids = msp.query("3DSOLID")
    if not solids:
        print("No 3DSOLID entities found in modelspace.")
        return

    extracted: List[Dict[str, Any]] = []
    for solid in solids:
        # .acis returns a list of strings (one per SAT line), never a bare attribute
        acis_lines: List[str] = solid.acis
        if not acis_lines:
            continue

        acis_str = "\n".join(acis_lines)

        # Basic ACIS header validation: first line should start with "ACIS" or "ASM"
        first_line = acis_lines[0].strip()
        if not (first_line.startswith("ACIS") or first_line.startswith("ASM")):
            print(f"Warning: Handle {solid.dxf.handle} contains unrecognized ACIS header.")
            continue

        extracted.append({
            "entity_handle": solid.dxf.handle,
            "layer": solid.dxf.layer,
            "acis_version": first_line,
            "line_count": len(acis_lines),
            "payload_length_bytes": len(acis_str.encode("utf-8")),
            "raw_acis": acis_str
        })

    Path(output_json).write_text(json.dumps(extracted, indent=2), encoding="utf-8")
    print(f"Successfully extracted {len(extracted)} 3DSOLID payloads to {output_json}")

if __name__ == "__main__":
    extract_3dsolid_acis("input.dxf", "solids_acis.json")
```

**Key Implementation Notes:**
- `msp.query("3DSOLID")` is the correct entity name. AutoCAD uses `3DSOLID` as the DXF type string; `SOLID3D` does not exist in the DXF specification.
- `solid.acis` returns a `list[str]`, one entry per SAT line. This is `ezdxf`'s clean accessor; do not use `solid.dxf.acis_data` (that attribute does not exist on the `dxf` namespace object).
- Some newer AutoCAD versions store ACIS data as binary (encrypted); these payloads will appear empty or unreadable and should be logged for manual review.
- Output JSON separates metadata from the raw payload, enabling batch routing to geometry kernels without loading full strings unnecessarily.

## Compatibility Matrix & Constraints

| Component | Supported Range | Notes |
|-----------|----------------|-------|
| `ezdxf` Version | `>=1.0.0` | Earlier versions may handle ACIS line joining differently. |
| Python | `3.8+` | Requires `typing` and `pathlib` standard libraries. |
| DXF Format | `R2000` (`AC1015`) to `R2018` (`AC1032`) | `3DSOLID` stabilized in R2000. Newer versions may encrypt ACIS. |
| ACIS/SAT Format | `v1.0` – `v7.x` | Proprietary Spatial format. Full parsing requires a licensed or open-source geometry kernel. |
| OS | Cross-platform | ACIS parsing binaries often require platform-native builds. |
| Known Limitations | Encrypted payloads, custom solids | AutoCAD 2021+ may apply DRM. Custom solids from Civil 3D may lack standard ACIS headers. |

For official DXF entity specifications, reference the [Autodesk DXF Reference](https://help.autodesk.com/view/OARX/2024/ENU/?guid=GUID-235B22E0-A567-4CF6-92D3-38A2306D73F3). When integrating with open-source geometry kernels, consult the [OpenCASCADE Documentation](https://dev.opencascade.org/doc/overview/html/) for SAT import workflows.

## Fallback Strategies When ACIS Extraction Fails

ACIS payloads frequently fail in automated pipelines due to encryption, version mismatches, or proprietary extensions. Implement these fallbacks to maintain pipeline continuity:

1. **Pre-Process to Mesh in AutoCAD/Civil 3D:** Run a batch AutoLISP or .NET script to convert `3DSOLID` to `MESH` entities before DXF export. `ezdxf` can then parse faceted geometry directly via `MESH` or `3DFACE` queries, bypassing ACIS entirely.
2. **Use `trimesh` for Polygonal Conversion:** If the DXF contains embedded mesh approximations, export vertices/faces to `trimesh` for lightweight analysis. This avoids B-Rep reconstruction but sacrifices parametric precision.
3. **Route to STEP/IGES Export:** Convert solids to STEP (`*.step`) or IGES (`*.iges`) using a CAD intermediary. STEP preserves topology and is natively supported by `python-occ` (pythonOCC) and `cadquery`.
4. **Handle Encrypted ACIS Gracefully:** If `solid.acis` returns an empty list or the first line does not start with `ACIS`/`ASM`, the payload may be encrypted or otherwise inaccessible. Log the entity handle, skip conversion, and flag the file for licensed ACIS SDK processing.

When building infrastructure platform integrations, always validate ACIS headers before routing to geometry kernels. Failing fast on malformed payloads prevents downstream crashes in mesh generation or spatial indexing services.
