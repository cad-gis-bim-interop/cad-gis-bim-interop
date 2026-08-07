---
title: "Layer Mapping Logic for CAD/GIS & BIM Interoperability Pipelines"
description: "Build deterministic Python layer mapping pipelines that translate CAD layer names, BIM categories, and GIS feature classes across heterogeneous format boundaries without silent data loss."
slug: "layer-mapping-logic"
breadcrumb:
  - label: "Coordinate Transformation & Spatial Alignment"
    url: "/coordinate-transformation-spatial-alignment/"
  - label: "Layer Mapping Logic"
    url: "/coordinate-transformation-spatial-alignment/layer-mapping-logic/"
datePublished: "2025-08-14"
dateModified: "2026-06-24"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Layer Mapping Logic for CAD/GIS & BIM Interoperability Pipelines",
      "description": "Build deterministic Python layer mapping pipelines that translate CAD layer names, BIM categories, and GIS feature classes across heterogeneous format boundaries without silent data loss.",
      "datePublished": "2025-08-14",
      "dateModified": "2026-06-24",
      "author": {"@type": "Organization", "name": "CAD GIS BIM Interop"},
      "publisher": {"@type": "Organization", "name": "CAD GIS BIM Interop"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Coordinate Transformation & Spatial Alignment", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/"},
        {"@type": "ListItem", "position": 2, "name": "Layer Mapping Logic", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Implement Deterministic Layer Mapping Logic in Python",
      "description": "Translate CAD, GIS, and BIM layer names across format boundaries using externalized rule schemas, priority-ranked regex routing, and full audit logging.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Ingest and normalize source metadata", "text": "Extract raw layer names, visibility states, and attributes from the source file; flatten into a consistent schema and apply a normalization pass that strips whitespace, unifies casing, and standardizes delimiters."},
        {"@type": "HowToStep", "position": 2, "name": "Build deterministic mapping rules", "text": "Load an external YAML or JSON schema into memory and compile it into exact-match, pattern-based, and fallback routing tiers with explicit priority weights."},
        {"@type": "HowToStep", "position": 3, "name": "Apply transformations and resolve ambiguity", "text": "Iterate through normalized source layers in priority order, log every routing decision, and apply a conflict-resolution strategy when multiple sources collide on the same target."},
        {"@type": "HowToStep", "position": 4, "name": "Validate and route to the target format", "text": "Check output names against destination constraints (character limits, reserved words, duplicate names), then write via the appropriate format adapter after geometric alignment is complete."}
      ]
    }
  ]
}
</script>

# Layer Mapping Logic for CAD/GIS & BIM Interoperability Pipelines

Raw geometry is only half the data. The semantic classification, visibility state, and attribute routing that travel alongside coordinates are governed by layer mapping logic — the set of translation rules that determine how `A-WALL-FULL` becomes `Building_Walls_Exterior` in GIS, or how an `IfcWall` category routes to a discipline-specific CAD layer. Without deterministic translation rules, data exported from AutoCAD DWG, ArcGIS Shapefiles, or Revit BIM models will misalign, lose metadata, or break downstream automation silently.

This topic sits at the semantic end of the [Coordinate Transformation & Spatial Alignment](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/) pipeline. Geometric transformations resolve where features are; layer mapping resolves what they mean and which schema bucket they belong to. The two concerns must stay decoupled — running semantic routing before geometric alignment prevents coordinate drift during layer reassignment, and vice versa.

## Prerequisites

Before implementing layer mapping logic, confirm your environment meets these baseline requirements:

- **Python 3.9+** — strict type hinting and `dataclasses` support (`# python>=3.9`)
- **`pandas>=1.5`** — vectorized DataFrame operations for bulk layer application
- **`re`** (stdlib) — regex compilation for pattern-based routing
- **`pyyaml>=6.0`** or `json` — loading external rule schemas
- **`pydantic>=2.0`** or `jsonschema>=4.0` — schema validation on pipeline initialization
- **Format adapters** (optional): `ezdxf>=1.1` for DXF/DWG, `geopandas>=0.13` / `fiona>=1.9` for vector GIS, `ifcopenshell>=0.7` for IFC/BIM
- **Version-controlled rule registry** — mapping schemas must live in Git, peer-reviewed, and never hardcoded into pipeline scripts
- **CRS alignment upstream** — layer mapping must receive geometrically aligned data; consult [CRS Normalization Workflows](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/) and [Unit Conversion Pipelines](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/) before this stage

## Architectural Overview

Layer naming conventions differ not only across formats but across discipline standards, company BIM templates, and national CAD standards. A production mapper must handle all three simultaneously.

<!-- fig:layermap-resolution-order -->
<svg viewBox="-20 -20 507.9 216.2" role="img" aria-label="Exact match first, then ordered regex rules, then quarantine — how a CAD layer name resolves to a GIS feature class" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:508px;display:block;margin:1.5rem auto;">
  <title>How a layer name resolves to a feature class</title>
  <desc>A three-way branch on how a source layer name is resolved. An exact match in the rule table wins outright. Failing that, the compiled regular-expression rules are tried in declaration order and the first match wins. A name that matches neither is routed to a quarantine class rather than guessed at, so unmapped layers are counted instead of silently discarded.</desc>
  <defs>
    <marker id="lml-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="lml-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="507.9" height="216.2" fill="var(--color-surface)"/>
  <polygon points="234,0 338.5,31 234,62 129.5,31" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-width="1.6"/>
  <text x="234" y="35" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">Layer name in the rule table?</text>
  <rect x="0" y="128" width="137.3" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="68.7" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Mapped class</text>
  <text x="68.7" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">deterministic</text>
  <path d="M 234 62 L 234 92 L 68.7 92 L 68.7 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#lml-a)" stroke-linejoin="round"/>
  <text x="68.7" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">exact hit</text>
  <rect x="165.3" y="128" width="137.3" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="234" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Ordered regex rules</text>
  <text x="234" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">first match wins</text>
  <path d="M 234 62 L 234 92 L 234 92 L 234 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#lml-a)" stroke-linejoin="round"/>
  <text x="234" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">no exact hit</text>
  <rect x="330.6" y="128" width="137.3" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="399.3" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">__UNMAPPED__</text>
  <text x="399.3" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">counted, not dropped</text>
  <path d="M 234 62 L 234 92 L 399.3 92 L 399.3 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#lml-a)" stroke-linejoin="round"/>
  <text x="399.3" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">no rule matches</text>
</svg>
<!-- /fig:layermap-resolution-order -->

### Naming Convention Landscape

| Source Format | Convention Example | Convention Standard |
|---|---|---|
| AutoCAD DWG/DXF | `A-WALL-FULL`, `S-COLS-EXST` | AIA Layer Guidelines, ISO 13567 |
| Revit / IFC | `IfcWall`, `IfcBeam[StructuralFraming]` | buildingSMART IFC 4.x schema |
| ArcGIS Shapefile | `BuildingFootprint`, `RoadCenterline` | ESRI feature class naming |
| OpenStreetMap GeoJSON | `building`, `highway` | OSM tagging schema |
| Civil 3D | `C-ROAD-CGRD`, `C-PROP-LINE` | NCS/ISO 13567 civil extensions |

The three structural challenges that map against every combination in this table are:

1. **Synonym collapse** — multiple source names that represent the same semantic class (e.g., `A-WALL`, `ARCH-WALL`, `Wall-Architectural`) must converge to one target.
2. **Ambiguity splitting** — one source name that could belong to two target classes depending on attributes or geometry type (e.g., `ANNO` routing to either `Annotation_Text` or `Annotation_Dimensions`).
3. **Schema mismatch** — target formats enforce naming constraints that source formats do not (Shapefiles cap field names at 10 characters; DXF allows 255).

### Rule Routing Architecture

A three-tier priority system handles the full space of cases:

<svg viewBox="184 0 458 286" role="img" aria-label="Layer mapping rule routing tiers: exact match, pattern-based regex, and fallback" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;display:block;margin:1.5rem auto;">
  <title>Three-tier layer mapping rule routing architecture</title>
  <desc>Flowchart showing a normalized source layer name passing through three routing tiers in priority order: exact-match dictionary (Tier 1), compiled regex patterns (Tier 2), and fallback default route (Tier 3), with an audit log written at every decision.</desc>
  <!-- Background -->
  <rect x="184" y="0" width="458" height="286" fill="var(--color-surface)"/>
  <!-- Source layer box -->
  <rect x="240" y="16" width="160" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="320" y="35" text-anchor="middle" font-size="12" fill="currentColor" font-family="system-ui,sans-serif">Normalized source</text>
  <text x="320" y="51" text-anchor="middle" font-size="12" fill="currentColor" font-family="system-ui,sans-serif">layer name</text>
  <!-- Arrow down -->
  <line x1="320" y1="60" x2="320" y2="86" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <!-- Tier 1 -->
  <rect x="200" y="86" width="240" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="320" y="105" text-anchor="middle" font-size="12" fill="currentColor" font-family="system-ui,sans-serif">Tier 1 — Exact match</text>
  <text x="320" y="121" text-anchor="middle" font-size="11" fill="currentColor" font-family="system-ui,sans-serif">O(1) dict lookup (highest priority)</text>
  <!-- Match arrow right from T1 -->
  <line x1="440" y1="108" x2="530" y2="108" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="462" y="101" font-size="10" fill="currentColor" font-family="system-ui,sans-serif">matched</text>
  <rect x="530" y="88" width="96" height="40" rx="4" fill="none" stroke="currentColor" stroke-width="1"/>
  <text x="578" y="112" text-anchor="middle" font-size="11" fill="currentColor" font-family="system-ui,sans-serif">Target + audit</text>
  <!-- No-match arrow down from T1 -->
  <line x1="320" y1="130" x2="320" y2="156" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="328" y="147" font-size="10" fill="currentColor" font-family="system-ui,sans-serif">no match</text>
  <!-- Tier 2 -->
  <rect x="200" y="156" width="240" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="320" y="175" text-anchor="middle" font-size="12" fill="currentColor" font-family="system-ui,sans-serif">Tier 2 — Regex patterns</text>
  <text x="320" y="191" text-anchor="middle" font-size="11" fill="currentColor" font-family="system-ui,sans-serif">Compiled, priority-ranked rules</text>
  <!-- Match arrow right from T2 -->
  <line x1="440" y1="178" x2="530" y2="178" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="462" y="171" font-size="10" fill="currentColor" font-family="system-ui,sans-serif">matched</text>
  <rect x="530" y="158" width="96" height="40" rx="4" fill="none" stroke="currentColor" stroke-width="1"/>
  <text x="578" y="182" text-anchor="middle" font-size="11" fill="currentColor" font-family="system-ui,sans-serif">Target + audit</text>
  <!-- No-match arrow down from T2 -->
  <line x1="320" y1="200" x2="320" y2="226" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="328" y="217" font-size="10" fill="currentColor" font-family="system-ui,sans-serif">no match</text>
  <!-- Tier 3 -->
  <rect x="200" y="226" width="240" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="320" y="245" text-anchor="middle" font-size="12" fill="currentColor" font-family="system-ui,sans-serif">Tier 3 — Fallback default</text>
  <text x="320" y="261" text-anchor="middle" font-size="11" fill="currentColor" font-family="system-ui,sans-serif">Routes to __UNMAPPED__ + alert</text>
  <!-- Arrow right from T3 -->
  <line x1="440" y1="248" x2="530" y2="248" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <rect x="530" y="228" width="96" height="40" rx="4" fill="none" stroke="currentColor" stroke-width="1"/>
  <text x="578" y="252" text-anchor="middle" font-size="11" fill="currentColor" font-family="system-ui,sans-serif">Target + audit</text>
  <!-- Arrowhead marker -->
  <defs>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor"/>
    </marker>
  </defs>
</svg>

Priority weights are stored with each rule. When multiple patterns could match a single source layer, the highest-priority rule wins, eliminating ambiguity across heterogeneous datasets.

## Step-by-Step Implementation

A reliable layer mapping pipeline follows a deterministic, stateless sequence. Each step isolates a specific transformation concern, enabling parallel testing, rollback, and clear audit trails.

### 1. Ingest and Normalize Source Metadata

Extract raw layer names, visibility states, color indices, and associated attributes from the source file. Normalize the extraction into a flat structure — typically a `pandas.DataFrame` or list of dicts — and apply a normalization pass before any matching occurs.

```python
# ezdxf>=1.1.0, pandas>=1.5.0
import ezdxf
import pandas as pd
from pathlib import Path

def extract_dxf_layers(dxf_path: Path) -> pd.DataFrame:
    doc = ezdxf.readfile(str(dxf_path))
    rows = []
    for layer in doc.layers:
        rows.append({
            "source_layer": layer.dxf.name,
            "is_visible": not bool(layer.dxf.flags & 1),
            "color_index": layer.dxf.color,
        })
    df = pd.DataFrame(rows)
    # Normalize: strip whitespace, uppercase, unify delimiters
    df["normalized"] = (
        df["source_layer"]
        .str.strip()
        .str.upper()
        .str.replace(r"[-.\s]", "_", regex=True)
    )
    return df
```

Normalization must happen at ingestion, not inside the mapping loop, so that regex compilation and lookup keys share the same canonical form.

### 2. Build Deterministic Mapping Rules

Externalize rules to YAML and compile them into a structured lookup on pipeline initialization. Schema validation acts as a circuit breaker — malformed rules fail fast, not silently at runtime.

```yaml
# layer_rules.yaml
mappings:
  - pattern: "A_WALL_FULL"
    target: "Building_Walls_Exterior"
    priority: 100
    is_regex: false

  - pattern: "^A_WALL.*"
    target: "Building_Walls_Exterior"
    priority: 90
    is_regex: true

  - pattern: "^MECH_DUCT.*"
    target: "HVAC_Ductwork"
    priority: 80
    is_regex: true

  - pattern: "^S_(COLS|BEAM).*"
    target: "Structural_Frame"
    priority: 75
    is_regex: true

  - pattern: ".*"
    target: "__UNMAPPED__"
    priority: 0
    is_regex: true
```

```python
# pyyaml>=6.0, pydantic>=2.0
import yaml
import re
from dataclasses import dataclass, field
from typing import Optional
from pathlib import Path

@dataclass
class MappingRule:
    pattern: str
    target: str
    priority: int = 0
    is_regex: bool = False
    compiled: Optional[re.Pattern] = field(init=False, default=None)

    def __post_init__(self) -> None:
        if self.is_regex:
            try:
                self.compiled = re.compile(self.pattern, re.IGNORECASE)
            except re.error as exc:
                raise ValueError(f"Invalid regex '{self.pattern}': {exc}") from exc

def load_rules(schema_path: Path) -> list[MappingRule]:
    with schema_path.open() as fh:
        raw = yaml.safe_load(fh)
    rules = [MappingRule(**m) for m in raw["mappings"]]
    return sorted(rules, key=lambda r: r.priority, reverse=True)
```

### 3. Apply Transformations and Resolve Ambiguity

With rules loaded and source metadata normalized, apply the routing in priority order. Log every decision — match method, source, target — to a structured audit log for downstream traceability.

```python
# stdlib logging
import logging
import pandas as pd

logger = logging.getLogger(__name__)

class LayerMapper:
    def __init__(self, rules: list[MappingRule], default: str = "__UNMAPPED__") -> None:
        self.rules = rules  # already sorted by priority descending
        self.default = default
        self.audit: list[dict] = []

    def map_one(self, normalized: str) -> str:
        for rule in self.rules:
            if rule.is_regex and rule.compiled and rule.compiled.search(normalized):
                self.audit.append({"src": normalized, "target": rule.target, "method": "regex"})
                return rule.target
            elif not rule.is_regex and normalized == rule.pattern.upper().replace("-", "_"):
                self.audit.append({"src": normalized, "target": rule.target, "method": "exact"})
                return rule.target
        self.audit.append({"src": normalized, "target": self.default, "method": "fallback"})
        logger.warning("Unmapped layer: %s -> %s", normalized, self.default)
        return self.default

    def apply(self, df: pd.DataFrame, norm_col: str = "normalized") -> pd.DataFrame:
        df = df.copy()
        df["target_layer"] = df[norm_col].apply(self.map_one)
        return df

    def export_audit(self, path: Path) -> None:
        pd.DataFrame(self.audit).to_csv(path, index=False)
        logger.info("Audit log written to %s", path)
```

When multiple source layers map to the same target name, apply one of three conflict strategies: merge attributes into a combined record, append a numeric suffix to the duplicate target, or raise a `ValueError` and halt — the right choice depends on the destination format's tolerance for duplicate names.

### 4. Validate and Route to the Target Format

Before writing, validate output names against destination constraints. Then apply geometric alignment. [Scale and Rotation Synchronization](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/) must run after semantic routing to prevent coordinate drift during layer reassignment.

```python
# geopandas>=0.13.0
import re
import geopandas as gpd

SHAPEFILE_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,9}$")  # 10-char limit

def validate_for_shapefile(target_names: list[str]) -> list[str]:
    errors = []
    for name in set(target_names):
        if name == "__UNMAPPED__":
            errors.append(f"Unmapped layers present: {name}")
        elif not SHAPEFILE_NAME_RE.match(name):
            errors.append(f"Invalid Shapefile name: '{name}' (max 10 chars, alphanumeric+underscore)")
    if errors:
        raise ValueError("Layer name validation failed:\n" + "\n".join(errors))
    return target_names

def write_to_shapefile(gdf: gpd.GeoDataFrame, out_path: Path) -> None:
    validate_for_shapefile(gdf["target_layer"].unique().tolist())
    for layer_name, group in gdf.groupby("target_layer"):
        layer_gdf = group.drop(columns=["target_layer"])
        layer_gdf.to_file(out_path / f"{layer_name}.shp")
```

## Edge Cases and Gotchas

### 1. Shapefile 10-Character Name Truncation

<!-- fig:layermap-shp-truncation -->
<svg viewBox="-20 -20 499.8 137.1" role="img" aria-label="Two distinct CAD layer names truncate to the same ten-character shapefile field name, silently colliding" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:500px;display:block;margin:1.5rem auto;">
  <title>How shapefile name truncation creates collisions</title>
  <desc>Three layer names written to a shapefile. Each is cut to the ten-character limit of the dBase field name, which leaves two distinct source layers sharing a single output name. The collision is silent: the driver writes both and one set of attributes overwrites the other.</desc>
  <defs>
    <marker id="lml2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="lml2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="499.8" height="137.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="186.7" height="73" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.5"/>
  <text x="14" y="16" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">Building_Walls_Exterior</text>
  <line x1="192.7" y1="12.9" x2="224.7" y2="12.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="232.7" y="16" font-size="9.5" fill="currentColor" fill-opacity="0.78">→ Building_W</text>
  <text x="14" y="35" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">Building_Walls_Interior</text>
  <line x1="192.7" y1="31.9" x2="224.7" y2="31.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="232.7" y="35" font-size="9.5" fill="currentColor" fill-opacity="0.78">→ Building_W   ← collision</text>
  <text x="14" y="54" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">Building_Roof</text>
  <line x1="192.7" y1="50.9" x2="224.7" y2="50.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="232.7" y="54" font-size="9.5" fill="currentColor" fill-opacity="0.78">→ Building_R</text>
  <text x="0" y="95" font-size="9.5" fill="currentColor" fill-opacity="0.7">GeoPackage and PostGIS have no ten-character limit; shapefile output needs an explicit short-name map.</text>
</svg>
<!-- /fig:layermap-shp-truncation -->

Shapefiles silently truncate layer/field names at 10 characters. `Building_Walls_Exterior` becomes `Building_W`, which may collide with `Building_W_Interior` producing data overwriting with no error raised. Always validate name length before writing and maintain an explicit truncation map in the rule schema.

### 2. DXF Layer 0 Inheritance

Layer `0` in DXF has special semantic meaning: entities on layer `0` inside blocks inherit the color, linetype, and visibility of the block insertion layer, not layer `0` itself. Routing layer-`0` entities to a target layer without unwrapping block inheritance first produces incorrect classification. Detect block membership before mapping:

```python
# ezdxf>=1.1.0
for entity in msp:
    layer = entity.dxf.layer
    if layer == "0" and hasattr(entity, "dxf") and entity.dxftype() == "INSERT":
        layer = entity.dxf.layer  # block insertion layer overrides
```

### 3. IFC Type vs. Layer Name Divergence

IFC models carry classification in `IfcType` attributes (`IfcWall`, `IfcSlab`), not in a layer name field. Extracting "layer" from `ifc_entity.get_info().get("Name")` produces the object's instance name, not its type class. Use `entity.is_a()` for type-based routing:

```python
# ifcopenshell>=0.7.0
import ifcopenshell

def ifc_layer_name(entity) -> str:
    return entity.is_a()  # e.g. "IfcWall", "IfcBeam"
```

### 4. Regex Priority Collisions

When two regex rules both match a source layer and have identical priority weights, routing is order-dependent. This is a maintenance trap: adding a new rule can silently change existing routing. Enforce unique priority values at schema load time:

```python
def assert_unique_priorities(rules: list[MappingRule]) -> None:
    weights = [r.priority for r in rules if r.is_regex]
    if len(weights) != len(set(weights)):
        raise ValueError("Duplicate priority weights in regex rules — routing will be non-deterministic")
```

### 5. Unicode and Non-ASCII Layer Names

DXF R2007+ files encoded in UTF-8 may contain non-ASCII layer names (e.g., `Straße`, `구조벽`). Python `str.upper()` handles these correctly, but normalization that replaces non-ASCII characters with underscores must apply consistently before lookup — otherwise the same name produces different normalized forms on different platforms. Use `unicodedata.normalize('NFC', name)` before any casing or delimiter pass.

### 6. Layer State Is an Editorial Signal

Frozen, off and locked are display flags, but drafters use them as an editorial vocabulary: a frozen layer is very often superseded work that was kept rather than deleted, and an off layer is frequently a working construction set that was never meant to be delivered. Mapping those layers as though they were live content imports rejected design into a live dataset, and filtering them out unconditionally discards content that a different office uses the same flags to mean something else entirely.

Neither default is safe, so the mapping should carry the state through rather than resolve it. Record `frozen`, `off` and `locked` on every mapped feature, route the feature normally, and let a downstream filter — one that can be configured per client, per project, or per delivery — decide what to include. That way the decision is visible, reviewable and reversible, instead of being a boolean buried in an extraction routine.

### 7. Rule Sets Need Their Own Regression Tests

A layer mapping rule set is code, and it drifts like code: a regex added to catch one office's naming convention quietly starts matching another's, a reordering changes which rule wins a collision, and nobody notices until a feature class starts filling with the wrong geometry. The rule set is also unusually easy to test, because its input is a string and its output is a class name.

Keep a fixture list of real layer names drawn from delivered files, with the class each should map to, and assert the mapping against it on every change:

```python
# pytest
CASES = [
    ("C-ROAD-CNTR",        "road_centreline"),
    ("C-ROAD-CNTR-EXST",   "road_centreline"),
    ("A-WALL-EXTR",        "building_wall"),
    ("V-SURV-BNDY",        "survey_boundary"),
    ("XREF$0$C-ROAD-CNTR", "road_centreline"),   # bound external reference
    ("RANDOM-JUNK",        "__UNMAPPED__"),
]

def test_layer_rules():
    for name, expected in CASES:
        assert classify(name) == expected, name
```

Add a case every time an unmapped layer is investigated, whatever the outcome — including the ones that legitimately stay unmapped. The fixture then accumulates into a record of what the office's drawings actually look like, which is worth more than the rule set itself when the convention changes.

### 8. Cascading Mapping (Multi-Hop Translation)

Some pipelines require CAD → GIS → BIM routing across two format boundaries using two separate rule schemas. Apply schemas sequentially with an intermediate validation step between them. Never merge two schemas into one — the combined rule set becomes untestable and the priority space becomes unbounded.

## Validation and Testing

```python
# pytest>=7.0.0
import pytest
from pathlib import Path

def test_exact_match_priority_over_regex(tmp_path: Path) -> None:
    rules = load_rules(Path("tests/fixtures/layer_rules.yaml"))
    mapper = LayerMapper(rules)
    # "A_WALL_FULL" should hit exact match (priority 100), not regex (priority 90)
    result = mapper.map_one("A_WALL_FULL")
    assert result == "Building_Walls_Exterior"
    assert mapper.audit[-1]["method"] == "exact"

def test_fallback_triggers_warning(caplog) -> None:
    rules = load_rules(Path("tests/fixtures/layer_rules.yaml"))
    mapper = LayerMapper(rules)
    with caplog.at_level(logging.WARNING):
        result = mapper.map_one("UNKNOWN_LAYER_XYZ")
    assert result == "__UNMAPPED__"
    assert "Unmapped layer" in caplog.text

def test_unmapped_threshold_gate() -> None:
    rules = load_rules(Path("tests/fixtures/layer_rules.yaml"))
    mapper = LayerMapper(rules)
    layers = ["A_WALL_FULL", "UNKNOWN_1", "UNKNOWN_2", "UNKNOWN_3"]
    for l in layers:
        mapper.map_one(l)
    unmapped_ratio = sum(1 for e in mapper.audit if e["target"] == "__UNMAPPED__") / len(mapper.audit)
    assert unmapped_ratio < 0.05, f"Unmapped ratio {unmapped_ratio:.1%} exceeds 5% threshold"
```

Run an unmapped-ratio gate in CI: if more than 5% of source layers route to `__UNMAPPED__`, the pipeline halts. This prevents schema drift from silently degrading output quality across project delivery cycles.

## Performance and Scale

For datasets with tens of thousands of layers, Python-level iteration in `map_one` becomes a bottleneck. Apply these strategies at scale:

- **Pre-index exact matches** into a `dict[str, str]` for O(1) lookup; only fall through to regex evaluation for unmatched entries.
- **Vectorize with `pandas.Series.map`** for exact-match-dominant datasets: build a full lookup dict from the rule schema and call `df["normalized"].map(lookup_dict).fillna(df["normalized"].map(regex_fallback))`.
- **Batch by discipline prefix** — group layers by their first token (`A_`, `S_`, `M_`, `E_`) and apply a discipline-scoped rule subset, reducing the number of regex compilations and comparisons per batch.
- **Cache compiled regex objects** at the `MappingRule` level (already done via `__post_init__`); never recompile inside a loop.
- **Limit `re.search` scope** with anchored patterns (`^`, `$`) wherever possible; unanchored patterns scan the full normalized string on every call.

For spatial datasets where attribute routing intersects with geometric joins, ensure that coordinate alignment (see [CRS Normalization Workflows](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/)) precedes semantic mapping. Mixed geometric-semantic operations in a single pass produce hard-to-debug state dependencies.

## FAQ

<details>
<summary>Should mapping rules live in the codebase or in a database?</summary>

For most AEC pipelines, a version-controlled YAML file checked into the project repository is the right default. It is diff-able, peer-reviewable, and deployable without a database dependency. Move rules into a database only when multiple teams need to edit them concurrently through a UI, or when the rule count exceeds a few thousand and query-time filtering becomes necessary. Hybrid approaches — rules in Git, synced to a read-only database table on deploy — work well for enterprise delivery environments.
</details>

<details>
<summary>What happens when the source format has no layer concept?</summary>

GeoJSON and some GeoPackage files carry type classification in feature properties rather than a layer field. In this case, derive the "source layer" from the relevant property key (e.g., `feature["properties"]["class"]` or `feature["properties"]["type"]`) during the ingestion normalization pass. The mapping engine itself is agnostic to where the string originated — it only operates on the normalized string value.
</details>

<details>
<summary>How should IFC object types map to GIS feature classes?</summary>

The most reliable approach is a two-level mapping: first from `entity.is_a()` (the IFC type class) to an intermediate semantic label, then from that label to the GIS feature class name. This isolates IFC-version differences (IFC2x3 vs IFC4 type hierarchies) from GIS schema decisions and makes each hop independently testable. Avoid direct IFC-to-GIS mappings in a single rule set; they become brittle when IFC schema versions change.
</details>

<details>
<summary>What is the correct behavior when two source layers must merge into one target?</summary>

Explicitly model merge rules as a separate concern from routing rules. After routing, detect target collision by grouping on `target_layer` and counting rows. For merges that are expected and intentional (e.g., `A-WALL-FULL` and `A-WALL-HALF` both routing to `Building_Walls_Exterior`), log the merge in the audit trail. For unexpected collisions — two layers that should have been distinct but share a target — raise a validation error before writing.
</details>

<details>
<summary>Does normalization need to run again after mapping?</summary>

No. Run normalization exactly once, during ingestion. The `target_layer` value written by the mapper is already in its final canonical form, derived from the rule schema — it does not need a second normalization pass. Applying normalization again after mapping risks altering target names that were intentionally authored in mixed case or with specific delimiters for the destination format.
</details>

## Related Pages

- [Coordinate Transformation & Spatial Alignment](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/) — parent pipeline covering datum shifts, projection, and geometric alignment
- [CRS Normalization Workflows](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/) — upstream stage that resolves coordinate reference system ambiguity before semantic routing
- [Unit Conversion Pipelines](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/) — harmonizes measurement units across CAD, GIS, and BIM before geometric processing
- [Scale and Rotation Synchronization](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/) — downstream geometric alignment step that must follow semantic routing to prevent coordinate drift
- [Normalising XREF-Prefixed Layer Names in Python](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/normalising-xref-prefixed-layer-names-in-python/) — stripping stacked external-reference prefixes before a rule table sees the name
- [Loading Layer Mapping Rules from YAML in Python](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/loading-layer-mapping-rules-from-yaml-in-python/) — moving the rule table into reviewable configuration, validated at load time
