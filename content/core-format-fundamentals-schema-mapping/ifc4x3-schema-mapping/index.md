---
title: "IFC4x3 Schema Mapping for Civil Infrastructure Python Pipelines"
description: "Complete guide to IFC4x3 schema mapping with Python: entity hierarchy traversal, property set extraction, CRS alignment, and GIS export for civil engineering interoperability."
slug: "ifc4x3-schema-mapping"
breadcrumb:
  - label: "Core Format Fundamentals & Schema Mapping"
    url: "/core-format-fundamentals-schema-mapping/"
  - label: "IFC4x3 Schema Mapping"
    url: "/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/"
datePublished: "2024-03-01"
dateModified: "2026-06-24"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "IFC4x3 Schema Mapping for Civil Infrastructure Python Pipelines",
      "description": "Complete guide to IFC4x3 schema mapping with Python: entity hierarchy traversal, property set extraction, CRS alignment, and GIS export for civil engineering interoperability.",
      "datePublished": "2024-03-01",
      "dateModified": "2026-06-24",
      "url": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/"
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Core Format Fundamentals & Schema Mapping",
          "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "IFC4x3 Schema Mapping",
          "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/"
        }
      ]
    },
    {
      "@type": "HowTo",
      "name": "IFC4x3 Schema Mapping for Civil Infrastructure Python Pipelines",
      "description": "How to extract, transform, and export IFC4x3 civil entities to GIS-compatible formats using ifcopenshell and pyproj.",
      "step": [
        {
          "@type": "HowToStep",
          "position": 1,
          "name": "Validate schema header",
          "text": "Open the IFC file with ifcopenshell and assert the FILE_SCHEMA declares IFC4X3."
        },
        {
          "@type": "HowToStep",
          "position": 2,
          "name": "Traverse the spatial containment hierarchy",
          "text": "Walk IfcProject → IfcSite → IfcAlignment/IfcBridge/IfcRailway via IsDecomposedBy."
        },
        {
          "@type": "HowToStep",
          "position": 3,
          "name": "Extract property sets and quantities",
          "text": "Iterate IsDefinedBy to flatten Pset_Alignment*, Pset_Bridge*, and IfcElementQuantity into a key-value dictionary."
        },
        {
          "@type": "HowToStep",
          "position": 4,
          "name": "Resolve the projected CRS",
          "text": "Read IfcProjectedCRS from the model's IfcGeometricRepresentationContext and construct a pyproj.CRS object."
        },
        {
          "@type": "HowToStep",
          "position": 5,
          "name": "Transform geometry and serialize",
          "text": "Convert STEP shape representations to GeoJSON or Parquet, applying the CRS transformation."
        }
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What schema string should IFC4x3 files declare?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "IFC4x3 files declare FILE_SCHEMA(('IFC4X3')) in the STEP header. The string ifcopenshell exposes via model.schema is 'IFC4X3'. Files declaring 'IFC4X3_ADD2' or earlier add-ons should be treated as distinct versions and tested against the relevant buildingSMART release."
          }
        },
        {
          "@type": "Question",
          "name": "Does IfcAlignment always carry an IfcProjectedCRS?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "No. IfcProjectedCRS is optional and is attached to the model's IfcGeometricRepresentationContext via HasCoordinateOperation. If absent, coordinates are in a local engineering coordinate system. In that case fall back to the IfcMapConversion matrix or tag the output with a crs_source: local_fallback flag."
          }
        },
        {
          "@type": "Question",
          "name": "Why does ifcopenshell.geom.create_shape() skip IfcAlignment entities?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "IfcAlignment is a semantic entity without a mandatory solid shape representation. Its geometry lives in nested IfcAlignmentSegment and IfcCompositeCurve objects. Call model.by_type('IfcAlignmentSegment') and extract the Representation attribute directly rather than relying on create_shape()."
          }
        },
        {
          "@type": "Question",
          "name": "How should IfcPropertyTableValue be flattened to JSON?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "IfcPropertyTableValue holds parallel DefiningValues and DefinedValues lists. Zip them into a list of {key, value} dicts and store as a JSON array under the property name. Do not collapse to a single scalar — loss of the table structure breaks downstream asset management queries."
          }
        },
        {
          "@type": "Question",
          "name": "What is the difference between IfcBridge and IfcCivilElement in IFC4x3?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "IfcBridge is a top-level facility entity (parallel to IfcBuilding) representing the entire bridge as a spatial structure. IfcCivilElement is a generic element type for civil components that lack a dedicated entity class. Production pipelines should type-check using entity.is_a() and handle each class through its specific Pset_ definitions."
          }
        }
      ]
    }
  ]
}
</script>

# IFC4x3 Schema Mapping for Civil Infrastructure Python Pipelines

IFC4x3 is the buildingSMART schema release that promotes infrastructure — rail, road, port, and bridge — to first-class citizens alongside buildings. As part of the [Core Format Fundamentals & Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/) discipline, IFC4x3 schema mapping is the systematic translation of STEP-encoded civil entities into the property-flat, CRS-aligned structures that GIS platforms, asset registries, and digital twin pipelines actually consume.

Without a deterministic mapping layer, the gap between an IFC4x3 export from a civil authoring tool and a spatially queryable PostGIS table is filled with silent precision loss, dropped property sets, and undefined coordinate reference systems. The entities introduced in IFC4x3 — `IfcAlignment`, `IfcBridge`, `IfcRailway`, `IfcLinearPosition`, `IfcReferent` — require traversal patterns that differ substantially from the building-model conventions documented by earlier IFC releases.

This guide delivers a production-tested Python workflow: header validation, containment traversal, property extraction, CRS resolution, and GIS serialization, with named failure modes and a compatibility reference for each stage.

---

<!-- Architectural Overview SVG -->
<svg viewBox="0 0 760 340" role="img" aria-label="IFC4x3 schema mapping pipeline: from STEP file through validation, traversal, property extraction, CRS resolution to GIS export" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:760px;font-family:inherit;">
  <title>IFC4x3 Schema Mapping Pipeline</title>
  <desc>Data-flow diagram showing the five stages of an IFC4x3 schema mapping pipeline: STEP file ingestion and header validation, spatial containment traversal, property and quantity set extraction, CRS resolution and geometry transformation, and final GIS export to GeoJSON or Parquet.</desc>
  <!-- Background -->
  <rect x="0" y="0" width="760" height="340" fill="var(--color-surface)"/>
  <!-- Stage boxes -->
  <!-- Stage 1 -->
  <rect x="10" y="130" width="120" height="80" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="70" y="162" text-anchor="middle" font-size="11" fill="currentColor" font-weight="600">IFC File</text>
  <text x="70" y="178" text-anchor="middle" font-size="10" fill="currentColor">Header</text>
  <text x="70" y="192" text-anchor="middle" font-size="10" fill="currentColor">Validation</text>
  <!-- Stage 2 -->
  <rect x="165" y="130" width="120" height="80" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="225" y="162" text-anchor="middle" font-size="11" fill="currentColor" font-weight="600">Containment</text>
  <text x="225" y="178" text-anchor="middle" font-size="10" fill="currentColor">Traversal</text>
  <text x="225" y="194" text-anchor="middle" font-size="9" fill="currentColor">(IsDecomposedBy)</text>
  <!-- Stage 3 -->
  <rect x="320" y="130" width="120" height="80" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="380" y="162" text-anchor="middle" font-size="11" fill="currentColor" font-weight="600">Property</text>
  <text x="380" y="178" text-anchor="middle" font-size="10" fill="currentColor">Set Extraction</text>
  <text x="380" y="194" text-anchor="middle" font-size="9" fill="currentColor">(Pset_* / Qset_*)</text>
  <!-- Stage 4 -->
  <rect x="475" y="130" width="120" height="80" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="535" y="155" text-anchor="middle" font-size="11" fill="currentColor" font-weight="600">CRS</text>
  <text x="535" y="171" text-anchor="middle" font-size="10" fill="currentColor">Resolution &amp;</text>
  <text x="535" y="187" text-anchor="middle" font-size="10" fill="currentColor">Geometry</text>
  <text x="535" y="200" text-anchor="middle" font-size="9" fill="currentColor">Transform</text>
  <!-- Stage 5 -->
  <rect x="630" y="130" width="120" height="80" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="690" y="162" text-anchor="middle" font-size="11" fill="currentColor" font-weight="600">GIS Export</text>
  <text x="690" y="178" text-anchor="middle" font-size="10" fill="currentColor">GeoJSON /</text>
  <text x="690" y="194" text-anchor="middle" font-size="10" fill="currentColor">Parquet</text>
  <!-- Arrows -->
  <line x1="130" y1="170" x2="163" y2="170" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <line x1="285" y1="170" x2="318" y2="170" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <line x1="440" y1="170" x2="473" y2="170" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <line x1="595" y1="170" x2="628" y2="170" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <!-- Entity labels above each box -->
  <text x="70" y="122" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.7">FILE_SCHEMA</text>
  <text x="225" y="122" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.7">IfcAlignment / IfcBridge</text>
  <text x="380" y="122" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.7">IsDefinedBy</text>
  <text x="535" y="122" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.7">IfcProjectedCRS</text>
  <text x="690" y="122" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.7">EPSG-aligned</text>
  <!-- Failure callouts below stages 2 and 4 -->
  <rect x="155" y="225" width="140" height="58" rx="4" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="4 3" opacity="0.6"/>
  <text x="225" y="243" text-anchor="middle" font-size="8" fill="currentColor" opacity="0.75">Gotcha: linear</text>
  <text x="225" y="257" text-anchor="middle" font-size="8" fill="currentColor" opacity="0.75">referencing differs</text>
  <text x="225" y="271" text-anchor="middle" font-size="8" fill="currentColor" opacity="0.75">from building trees</text>
  <line x1="225" y1="210" x2="225" y2="225" stroke="currentColor" stroke-width="1" stroke-dasharray="3 2" opacity="0.5"/>
  <rect x="465" y="225" width="140" height="58" rx="4" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="4 3" opacity="0.6"/>
  <text x="535" y="243" text-anchor="middle" font-size="8" fill="currentColor" opacity="0.75">Gotcha: missing</text>
  <text x="535" y="257" text-anchor="middle" font-size="8" fill="currentColor" opacity="0.75">IfcProjectedCRS →</text>
  <text x="535" y="271" text-anchor="middle" font-size="8" fill="currentColor" opacity="0.75">fallback required</text>
  <line x1="535" y1="210" x2="535" y2="225" stroke="currentColor" stroke-width="1" stroke-dasharray="3 2" opacity="0.5"/>
  <!-- Arrow marker -->
  <defs>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor"/>
    </marker>
  </defs>
  <!-- Title -->
  <text x="380" y="26" text-anchor="middle" font-size="13" fill="currentColor" font-weight="700">IFC4x3 Schema Mapping — Five-Stage Pipeline</text>
  <text x="380" y="44" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">STEP ingestion → entity traversal → property extraction → CRS transform → GIS serialization</text>
</svg>

---

## Prerequisites

- **Python 3.9+** with a dedicated virtual environment (`venv` or `conda`)
- `ifcopenshell` ≥ 0.8.0 compiled with IFC4x3 EXPRESS schema support
- `pandas` ≥ 2.0 for tabular property assembly
- `shapely` ≥ 2.0 and `pyproj` ≥ 3.6 for geometry handling and CRS operations
- A validated IFC4x3 file: civil alignment, bridge, or railway model
- Working knowledge of EXPRESS schema inheritance, `Pset_*` naming conventions, and the difference between `IfcPropertySet` and `IfcElementQuantity`

```bash
# ifcopenshell>=0.8.0, pandas>=2.0, shapely>=2.0, pyproj>=3.6
pip install ifcopenshell pandas shapely pyproj
```

If `ifcopenshell` is not on PyPI for your platform, install from the [official conda-forge channel](https://anaconda.org/conda-forge/ifcopenshell) or build from source against the IFC4x3 EXPRESS schema bundle.

## Architectural Overview

IFC4x3 ships as an EXPRESS schema describing a directed acyclic object graph encoded as a STEP Part 21 file. Every entity instance has a numeric ID (`#12345`), a type name, and positional attributes. Relationships between entities — containment, property attachment, geometry assignment — are expressed through inverse attributes and explicit `IfcRel*` instances rather than foreign keys or embedded pointers.

<!-- fig:ifc-step-anatomy -->
<svg viewBox="-20 -20 383.1 175.1" role="img" aria-label="A STEP line carries an instance id, an upper-case entity type and positional attributes with hash references to other instances" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>An IFC entity instance as it appears in a STEP file</title>
  <desc>One line of a STEP Part 21 file. A numeric instance identifier, the entity type in upper case, and a positional attribute list in which hash references point at other instances. Because the attributes are positional rather than named, the schema version decides what each slot means — which is why the file header must be checked before the model is interpreted.</desc>
  <defs>
    <marker id="ifc1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ifc1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="383.1" height="175.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="166" height="111" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.5"/>
  <text x="14" y="16" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">#412= IFCWALL(</text>
  <line x1="172" y1="12.9" x2="204" y2="12.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="212" y="16" font-size="9.5" fill="currentColor" fill-opacity="0.78">instance id and entity type</text>
  <text x="14" y="35" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">  '3vB2YO$MX4xQ...',</text>
  <line x1="172" y1="31.9" x2="204" y2="31.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="212" y="35" font-size="9.5" fill="currentColor" fill-opacity="0.78">GlobalId — the stable key</text>
  <text x="14" y="54" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">  #7,</text>
  <line x1="172" y1="50.9" x2="204" y2="50.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="212" y="54" font-size="9.5" fill="currentColor" fill-opacity="0.78">reference to the owner history</text>
  <text x="14" y="73" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">  'Basic Wall:Ext',</text>
  <line x1="172" y1="69.9" x2="204" y2="69.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="212" y="73" font-size="9.5" fill="currentColor" fill-opacity="0.78">Name</text>
  <text x="14" y="92" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">  #398, #401);</text>
  <line x1="172" y1="88.9" x2="204" y2="88.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="212" y="92" font-size="9.5" fill="currentColor" fill-opacity="0.78">placement and representation</text>
  <text x="0" y="133" font-size="9.5" fill="currentColor" fill-opacity="0.7">Attributes are positional — the declared schema decides what slot four means.</text>
</svg>
<!-- /fig:ifc-step-anatomy -->

**What changes from IFC4 to IFC4x3**

IFC4x3 promotes infrastructure to peer status with buildings by adding:

| Entity class | Purpose |
|---|---|
| `IfcAlignment` | Horizontal + vertical alignment for linear infrastructure |
| `IfcAlignmentSegment` | Individual constant-parameter segments along an alignment |
| `IfcLinearPosition` | Position along a curve expressed as a distance measure |
| `IfcReferent` | Named kilometre point or chainage marker on an alignment |
| `IfcBridge` | Facility entity for bridges (parallel to `IfcBuilding`) |
| `IfcRailway` | Facility entity for railway infrastructure |
| `IfcMarineFacility` | Port, harbour, and waterway infrastructure |

**Schema version compatibility**

| `model.schema` value | buildingSMART release | Civil entities | Notes |
|---|---|---|---|
| `IFC4X3` | IFC4x3 RC4 / final | Full support | Use this |
| `IFC4X3_ADD2` | IFC4x3 ADD2 | Full support | Treat as distinct; test Pset_ names |
| `IFC4` | IFC 4.0 | None | `IfcAlignment` absent; pipeline must abort |
| `IFC2X3` | IFC 2x3 | None | Legacy only; hard-fail before traversal |

**The containment graph**

For buildings the spatial hierarchy runs `IfcProject → IfcSite → IfcBuilding → IfcBuildingStorey → IfcSpace`. For IFC4x3 civil models the hierarchy is flatter and alignment-centric:

```
IfcProject
  └─ IfcSite
       ├─ IfcAlignment          (road/rail centreline)
       │    └─ IfcAlignmentSegment (per-segment geometry)
       ├─ IfcBridge             (bridge as facility)
       │    └─ IfcBridgePart    (abutment, deck, pier, …)
       └─ IfcRailway
            └─ IfcFacilityPart
```

All containment links are resolved through the `IsDecomposedBy` inverse attribute. Unlike [DXF entity structure](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/), where spatial grouping is implicit in layer names, IFC makes containment relationships explicit and traversable through the object graph.

## Step-by-Step Implementation

### Step 1 — Header validation

Read the first 50 lines of the `.ifc` file as raw text before allocating `ifcopenshell` memory. The STEP header must declare `FILE_SCHEMA(('IFC4X3'))`. Catching this early avoids the ~3–8 seconds overhead of opening a multi-gigabyte IFC2x3 file only to discover it lacks `IfcAlignment` entirely.

```python
# ifcopenshell>=0.8.0
import ifcopenshell

def load_and_validate_ifc4x3(filepath: str) -> ifcopenshell.file:
    """Load an IFC file and assert IFC4X3 schema compliance."""
    # Fast pre-check: scan raw text before full parse
    with open(filepath, "r", encoding="utf-8", errors="replace") as fh:
        header_text = "".join(fh.readline() for _ in range(50))
    if "IFC4X3" not in header_text:
        raise ValueError(
            f"{filepath} does not declare IFC4X3 in FILE_SCHEMA. "
            "Check model.schema before proceeding."
        )

    model = ifcopenshell.open(filepath)
    schema = model.schema
    if not schema.startswith("IFC4X3"):
        raise ValueError(f"Expected IFC4X3, resolved schema: {schema}")
    return model
```

### Step 2 — Containment traversal for civil entities

Walk the `IsDecomposedBy` graph from `IfcProject` downwards. Collect all `IfcAlignment`, `IfcBridge`, and `IfcRailway` instances. The generator pattern keeps peak memory proportional to one entity at a time rather than the full list.

```python
# ifcopenshell>=0.8.0
from typing import Generator

CIVIL_TYPES = ("IfcAlignment", "IfcBridge", "IfcRailway", "IfcMarineFacility")

def iter_civil_entities(model: ifcopenshell.file) -> Generator:
    """Yield civil facility entities from the IFC4x3 spatial graph."""
    for type_name in CIVIL_TYPES:
        for entity in model.by_type(type_name):
            yield entity

def iter_alignment_segments(
    alignment: "ifcopenshell.entity_instance",
) -> Generator:
    """Yield IfcAlignmentSegment children of a given IfcAlignment."""
    for rel in alignment.IsDecomposedBy:
        for child in rel.RelatedObjects:
            if child.is_a("IfcAlignmentSegment"):
                yield child
            # Recurse if nested decomposition exists
            for grandchild in child.IsDecomposedBy:
                for obj in grandchild.RelatedObjects:
                    yield obj
```

### Step 3 — Property and quantity set extraction

Each entity's property sets are attached via `IsDefinedBy` → `IfcRelDefinesByProperties` → `IfcPropertySet`. Civil models use domain-specific Psets: `Pset_AlignmentCommon`, `Pset_BridgeCommon`, `Pset_RailwayCommon`. Handle `IfcPropertyEnumeratedValue` and `IfcPropertyTableValue` explicitly — collapsing them silently to a string loses structure that downstream asset management queries depend on.

```python
# ifcopenshell>=0.8.0, pandas>=2.0
import pandas as pd
from typing import Any, Dict

def extract_psets(entity) -> Dict[str, Any]:
    """Flatten all IfcPropertySet and IfcElementQuantity data to a dict."""
    props: Dict[str, Any] = {
        "ifc_guid": entity.GlobalId,
        "ifc_type": entity.is_a(),
        "name": getattr(entity, "Name", None) or "Unnamed",
    }

    for rel in getattr(entity, "IsDefinedBy", []):
        if not rel.is_a("IfcRelDefinesByProperties"):
            continue
        definition = rel.RelatingPropertyDefinition

        if definition.is_a("IfcPropertySet"):
            pset_name = definition.Name or "UnnamedPset"
            for prop in definition.HasProperties:
                key = f"{pset_name}.{prop.Name}"
                if prop.is_a("IfcPropertySingleValue"):
                    val = prop.NominalValue
                    props[key] = (
                        val.wrappedValue if hasattr(val, "wrappedValue") else str(val)
                    ) if val is not None else None
                elif prop.is_a("IfcPropertyEnumeratedValue"):
                    props[key] = [
                        v.wrappedValue if hasattr(v, "wrappedValue") else str(v)
                        for v in prop.EnumerationValues
                    ]
                elif prop.is_a("IfcPropertyTableValue"):
                    # Preserve key→value structure; do NOT collapse to scalar
                    props[key] = [
                        {
                            "k": (
                                dk.wrappedValue
                                if hasattr(dk, "wrappedValue") else str(dk)
                            ),
                            "v": (
                                dv.wrappedValue
                                if hasattr(dv, "wrappedValue") else str(dv)
                            ),
                        }
                        for dk, dv in zip(
                            prop.DefiningValues or [],
                            prop.DefinedValues or [],
                        )
                    ]

        elif definition.is_a("IfcElementQuantity"):
            qset_name = definition.Name or "UnnamedQset"
            for qty in definition.Quantities:
                key = f"{qset_name}.{qty.Name}"
                for attr in ("LengthValue", "AreaValue", "VolumeValue", "WeightValue", "CountValue"):
                    if hasattr(qty, attr) and getattr(qty, attr) is not None:
                        props[key] = getattr(qty, attr)
                        break

    return props
```

### Step 4 — CRS resolution and coordinate transformation

IFC4x3 encodes project coordinate systems through `IfcGeometricRepresentationContext` → `HasCoordinateOperation` → `IfcMapConversion` → `IfcProjectedCRS`. When this chain is present, all model coordinates are in a local engineering frame offset from the true-north / project-north datum. Apply the `IfcMapConversion` translation and rotation before using `pyproj` to reproject to EPSG:4326 or the target CRS.

```python
# pyproj>=3.6
import pyproj
from typing import Optional, Tuple
import math

def resolve_map_conversion(
    model: ifcopenshell.file,
) -> Optional[Tuple[pyproj.CRS, dict]]:
    """
    Return (target_CRS, conversion_params) if IfcMapConversion is present.
    conversion_params keys: eastings, northings, orthogonal_height,
    x_axis_abscissa, x_axis_ordinate, scale.
    """
    for ctx in model.by_type("IfcGeometricRepresentationContext"):
        if getattr(ctx, "ContextType", None) != "Model":
            continue
        for op in getattr(ctx, "HasCoordinateOperation", []):
            if not op.is_a("IfcMapConversion"):
                continue
            target = op.TargetCRS
            if target is None:
                continue
            epsg_name = getattr(target, "Name", "") or ""
            try:
                crs = pyproj.CRS.from_string(epsg_name)
            except Exception:
                continue
            params = {
                "eastings": op.Eastings or 0.0,
                "northings": op.Northings or 0.0,
                "orthogonal_height": op.OrthogonalHeight or 0.0,
                "x_axis_abscissa": op.XAxisAbscissa or 1.0,
                "x_axis_ordinate": op.XAxisOrdinate or 0.0,
                "scale": op.Scale or 1.0,
            }
            return crs, params
    return None

def apply_map_conversion(
    local_x: float,
    local_y: float,
    params: dict,
) -> Tuple[float, float]:
    """Rotate and translate a local (x,y) into the mapped CRS frame."""
    angle = math.atan2(params["x_axis_ordinate"], params["x_axis_abscissa"])
    scale = params["scale"]
    rx = local_x * math.cos(angle) - local_y * math.sin(angle)
    ry = local_x * math.sin(angle) + local_y * math.cos(angle)
    return rx * scale + params["eastings"], ry * scale + params["northings"]
```

For projects that rely on `IfcLocalPlacement` matrices without a declared `IfcProjectedCRS`, see the [CRS Normalization Workflows](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/) section for matrix decomposition and fallback reprojection patterns.

### Step 5 — GIS serialization

Assemble property dicts and transformed coordinates into GeoJSON or Apache Parquet. For infrastructure models with tens of thousands of alignment segments, write to Parquet in chunks rather than accumulating a single in-memory list.

```python
# ifcopenshell>=0.8.0, pandas>=2.0, pyproj>=3.6
import json
import warnings

def run_ifc4x3_pipeline(filepath: str, output_parquet: str) -> pd.DataFrame:
    """Execute the full IFC4x3 schema mapping pipeline."""
    model = load_and_validate_ifc4x3(filepath)

    crs_result = resolve_map_conversion(model)
    if crs_result:
        target_crs, conv_params = crs_result
        transformer = pyproj.Transformer.from_crs(
            target_crs, pyproj.CRS.from_epsg(4326), always_xy=True
        )
        print(f"CRS resolved: {target_crs.to_epsg()}")
    else:
        transformer = None
        conv_params = None
        warnings.warn(
            "No IfcProjectedCRS found. Coordinates retained in local frame. "
            "Tag output with crs_source=local_fallback."
        )

    records = []
    for entity in iter_civil_entities(model):
        record = extract_psets(entity)
        record["crs_source"] = (
            f"EPSG:{target_crs.to_epsg()}" if transformer else "local_fallback"
        )
        records.append(record)

    df = pd.DataFrame(records)
    df.to_parquet(output_parquet, index=False)
    print(f"Exported {len(df)} civil entities → {output_parquet}")
    return df
```

For detailed attribute-to-feature mapping logic — including how `IfcPropertyTableValue` maps to GeoJSON `properties` — consult [Mapping IFC Properties to GeoJSON Attributes](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/mapping-ifc-properties-to-geojson-attributes/).

## Edge Cases & Gotchas

**1. `IfcAlignment` has no solid geometry**

<!-- fig:ifc-alignment-model -->
<svg viewBox="-20 -33.5 612.6 101.7" role="img" aria-label="IfcAlignment carries horizontal and vertical business logic rather than a solid, so geometry appears only where products are placed along it" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:613px;display:block;margin:1.5rem auto;">
  <title>Why an alignment has no solid to extract</title>
  <desc>The chain that makes IfcAlignment different from a building element. The alignment carries horizontal and vertical business logic — curves, transitions and grades — rather than a solid. Geometry only appears where a product is placed along it. A pipeline that queries alignments for meshes finds nothing; it has to evaluate the referent curve instead.</desc>
  <defs>
    <marker id="ifc2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ifc2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-33.5" width="612.6" height="101.7" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="98.1" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="49.1" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">IfcAlignment</text>
  <text x="49.1" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">business logic</text>
  <rect x="132.1" y="0" width="139.7" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="202" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Horizontal + vertical</text>
  <text x="202" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">curves and grades</text>
  <rect x="305.9" y="0" width="112.2" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="362" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Referent curve</text>
  <text x="362" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">a linear placement</text>
  <rect x="452" y="0" width="120.5" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="512.3" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Placed elements</text>
  <text x="512.3" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">the only solids</text>
  <line x1="98.1" y1="24.1" x2="132.1" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#ifc2-a)"/>
  <text x="115.1" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">composed of</text>
  <line x1="271.9" y1="24.1" x2="305.9" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#ifc2-a)"/>
  <text x="288.9" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">evaluated</text>
  <line x1="418" y1="24.1" x2="452" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#ifc2-a)"/>
  <text x="435" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">products along it</text>
</svg>
<!-- /fig:ifc-alignment-model -->

`ifcopenshell.geom.create_shape()` silently skips `IfcAlignment` because the entity carries a curve representation (`IfcGradientCurve`, `IfcCompositeCurve`), not a solid. Access geometry via `model.by_type("IfcAlignmentSegment")` and extract the `Representation` attribute directly. Wrap in a `try/except RuntimeError` because some authoring tools omit the representation on degenerate zero-length segments.

**2. Duplicate GUID across file splits**

Large infrastructure projects are often split across multiple IFC files (one per discipline). When merging, `GlobalId` values may collide if the authoring tool reused GUIDs across split files. Before concatenating DataFrames, assert `df["ifc_guid"].is_unique`. If not, construct a composite key from `ifc_guid + source_file_hash`.

**3. `Pset_` name variation between authoring tools**

Revit exports `Pset_AlignmentCommon`, OpenRoads exports `Civil_Pset_AlignmentCommon`. Do not hard-code exact Pset names. Normalise by stripping known vendor prefixes with a regex and matching the canonical suffix, then log which prefix was stripped for downstream audit trails.

```python
import re

VENDOR_PREFIX_RE = re.compile(r"^(?:Civil_|Structural_|MEP_)")

def normalize_pset_name(raw_name: str) -> str:
    return VENDOR_PREFIX_RE.sub("", raw_name)
```

**4. Missing `IfcMapConversion` on federating models**

When a federation model assembles reference files, the `HasCoordinateOperation` chain may exist only on the host file's context, not on the referenced file's context. Open each `.ifc` reference file individually, resolve its local `IfcGeometricRepresentationContext`, and carry the offset matrix forward rather than assuming the federation host's CRS applies to all subfiles.

**5. `IfcLinearPosition` vs. chainage attributes in Psets**

Some authoring tools encode chainage (station) as a `Pset_AlignmentCommon.StartStation` attribute rather than through `IfcLinearPosition` and `IfcReferent`. When both are present, the `IfcLinearPosition` value is authoritative — treat the Pset attribute as a display-only label and log any discrepancy above a configurable tolerance (default: 0.1 m).

**6. Schema-version mismatch at IFC4X3_ADD2**

If `model.schema` returns `IFC4X3_ADD2`, several Pset definitions were revised. In particular, `Pset_RailwayCommon` gained additional attributes. Run a schema diff with `ifcopenshell.util.schema.compare()` if you need to support both versions in the same codebase.

## Validation & Testing

Test schema mapping correctness with three layers of assertions:

1. **Schema-level:** assert `model.schema.startswith("IFC4X3")` before any traversal.
2. **Entity-level:** verify that every `IfcAlignment` yields at least one `IfcAlignmentSegment` — a model with no segments is authored incorrectly and should be rejected.
3. **Property-level:** assert the output DataFrame has no `ifc_guid` duplicates and that key civil Pset columns (`Pset_AlignmentCommon.StartStation`, `Pset_AlignmentCommon.EndStation`) are non-null for alignment rows.

```python
# ifcopenshell>=0.8.0, pandas>=2.0
import pytest

def validate_pipeline_output(
    model: ifcopenshell.file, df: pd.DataFrame
) -> None:
    """Raise AssertionError on any structural mapping failure."""
    assert model.schema.startswith("IFC4X3"), (
        f"Wrong schema: {model.schema}"
    )

    for alignment in model.by_type("IfcAlignment"):
        segments = list(iter_alignment_segments(alignment))
        assert segments, (
            f"IfcAlignment {alignment.GlobalId} has no segments — "
            "authoring error or unsupported representation"
        )

    assert df["ifc_guid"].is_unique, (
        "Duplicate GUIDs in output — check multi-file merge logic"
    )

    alignment_rows = df[df["ifc_type"] == "IfcAlignment"]
    if not alignment_rows.empty:
        missing = alignment_rows[
            alignment_rows.get("Pset_AlignmentCommon.StartStation", pd.Series(dtype=object)).isna()
        ]
        if not missing.empty:
            import warnings
            warnings.warn(
                f"{len(missing)} alignment(s) missing StartStation — "
                "check authoring tool Pset export settings"
            )
```

The `validate_pipeline_output` function is suitable as a pytest fixture or a CI gate step in a pre-merge validation workflow.

## Performance & Scale

Large civil models — trans-national rail, multi-span motorway — can exceed 500 MB and contain 200 000+ entity instances. Three practices prevent memory exhaustion:

**Generator-based traversal.** Never call `list(model.by_type(...))` upfront. The generator approach in `iter_civil_entities()` above keeps peak memory proportional to one entity, not the full instance list.

**Batch Parquet writes.** When processing models with more than 50 000 alignment segments, write records in chunks rather than accumulating a single DataFrame:

```python
# pandas>=2.0
import pyarrow as pa
import pyarrow.parquet as pq

CHUNK_SIZE = 5_000

def write_chunked_parquet(
    entity_iter,
    output_path: str,
) -> int:
    """Write entity records to Parquet in chunks; return total row count."""
    writer = None
    total = 0
    chunk: list = []

    for entity in entity_iter:
        chunk.append(extract_psets(entity))
        if len(chunk) >= CHUNK_SIZE:
            table = pa.Table.from_pylist(chunk)
            if writer is None:
                writer = pq.ParquetWriter(output_path, table.schema)
            writer.write_table(table)
            total += len(chunk)
            chunk = []

    if chunk:
        table = pa.Table.from_pylist(chunk)
        if writer is None:
            writer = pq.ParquetWriter(output_path, table.schema)
        writer.write_table(table)
        total += len(chunk)

    if writer:
        writer.close()
    return total
```

**Skip geometry for metadata-only pipelines.** Geometry parsing via `ifcopenshell.geom.create_shape()` is the most expensive operation — often 10–50× slower than property extraction alone. If the pipeline only needs attributes and chainage data, skip all `ifcopenshell.geom` calls entirely. Open the file normally and never import `ifcopenshell.geom`.

**Avoid repeated `model.by_type()` calls in inner loops.** Cache the result of `model.by_type("IfcRelDefinesByProperties")` before the entity loop. Repeated calls trigger full schema traversal each time.

## FAQ

<details>
<summary><strong>What schema string should IFC4x3 files declare?</strong></summary>

IFC4x3 files declare `FILE_SCHEMA(('IFC4X3'))` in the STEP header. The value `ifcopenshell` exposes via `model.schema` is the string `"IFC4X3"`. Files declaring `"IFC4X3_ADD2"` are a later add-on release with revised Pset definitions — treat them as a distinct version and test property name differences. Files declaring `"IFC4"` or `"IFC2X3"` lack all civil-specific entities; abort immediately with an informative error.

</details>

<details>
<summary><strong>Does IfcAlignment always carry an IfcProjectedCRS?</strong></summary>

No. `IfcProjectedCRS` is optional and is attached via `HasCoordinateOperation` on the `IfcGeometricRepresentationContext`. Roughly 30–40% of civil IFC files exported from older authoring tool versions omit it entirely, leaving coordinates in a local engineering frame. When absent, fall back to the `IfcMapConversion` offset matrix if present, or tag the output with `crs_source: local_fallback` and document the assumption explicitly for downstream GIS teams.

</details>

<details>
<summary><strong>Why does ifcopenshell.geom.create_shape() skip IfcAlignment entities?</strong></summary>

`IfcAlignment` carries a curve representation — `IfcGradientCurve` or `IfcCompositeCurve` — not a solid or surface. `ifcopenshell.geom.create_shape()` is designed for solid mesh generation and silently returns nothing or raises a runtime error on alignment curves. Access the geometric segments directly via `model.by_type("IfcAlignmentSegment")` and read the `Representation` attribute, which points to an `IfcShapeRepresentation` containing the curve geometry.

</details>

<details>
<summary><strong>How should IfcPropertyTableValue be flattened to JSON?</strong></summary>

`IfcPropertyTableValue` holds two parallel lists: `DefiningValues` (the keys) and `DefinedValues` (the corresponding values). Zip them into a list of `{"k": ..., "v": ...}` dicts and store as a JSON array under the property name. Do not collapse to a single scalar — the table structure encodes multi-parameter relationships (e.g., load vs. deflection curves) that downstream asset management queries rely on.

</details>

<details>
<summary><strong>What is the difference between IfcBridge and IfcCivilElement in IFC4x3?</strong></summary>

`IfcBridge` is a top-level facility entity in the spatial hierarchy — analogous to `IfcBuilding` — representing the entire bridge as a decomposable spatial structure with its own site footprint and containment chain. `IfcCivilElement` is a generic component-level entity for civil parts that lack a dedicated class (e.g., retaining walls, culverts). In production, use `entity.is_a()` to branch between them and apply the relevant `Pset_Bridge*` definitions only to `IfcBridge` and its `IfcBridgePart` children.

</details>

---

## Related Pages

- [Core Format Fundamentals & Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/) — parent section covering DXF, DWG, and IFC format foundations
- [Mapping IFC Properties to GeoJSON Attributes](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/mapping-ifc-properties-to-geojson-attributes/) — detailed walkthrough of `IfcPropertySet` flattening and GeoJSON serialization
- [DXF Entity Structure Breakdown](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/) — how group code taxonomy differs from EXPRESS schema inheritance
- [CRS Normalization Workflows](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/) — pyproj-based reprojection patterns for local-to-EPSG coordinate transforms
- [ifcopenshell Workflow](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/) — geometry extraction and mesh conversion using the ifcopenshell Python API
- [Extracting IfcAlignment Geometry with ifcopenshell](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/extracting-ifcalignment-geometry-with-ifcopenshell/) — sampling the horizontal and vertical business logic that has no solid to compile
