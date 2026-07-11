---
title: "Mapping CAD Layers to GIS Feature Classes in Python"
description: "Classify CAD layer names into GIS feature classes with a Python rule engine of exact, regex, and prefix rules, then build a geopandas GeoDataFrame per class."
slug: "mapping-cad-layers-to-gis-feature-classes-in-python"
breadcrumb:
  - label: "Coordinate Transformation & Spatial Alignment"
    url: "/coordinate-transformation-spatial-alignment/"
  - label: "Layer Mapping Logic"
    url: "/coordinate-transformation-spatial-alignment/layer-mapping-logic/"
  - label: "Mapping CAD Layers to GIS Feature Classes"
    url: "/coordinate-transformation-spatial-alignment/layer-mapping-logic/mapping-cad-layers-to-gis-feature-classes-in-python/"
datePublished: "2026-07-11"
dateModified: "2026-07-11"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Mapping CAD Layers to GIS Feature Classes in Python",
      "description": "Classify CAD layer names into GIS feature classes with a Python rule engine of exact, regex, and prefix rules, then build a geopandas GeoDataFrame per class.",
      "datePublished": "2026-07-11",
      "dateModified": "2026-07-11",
      "author": {"@type": "Organization", "name": "CAD GIS BIM Interop"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/mapping-cad-layers-to-gis-feature-classes-in-python/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Coordinate Transformation & Spatial Alignment", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/"},
        {"@type": "ListItem", "position": 2, "name": "Layer Mapping Logic", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/"},
        {"@type": "ListItem", "position": 3, "name": "Mapping CAD Layers to GIS Feature Classes", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/mapping-cad-layers-to-gis-feature-classes-in-python/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Map CAD Layers to GIS Feature Classes in Python",
      "description": "Define a rule table of exact, regex, and prefix rules, classify ezdxf entities by layer name into feature classes, and build a geopandas GeoDataFrame per class.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Define the rule table", "text": "Author a config of exact, regex, and prefix rules mapping layer names to target feature classes and attributes, with a default bucket for the unmapped case."},
        {"@type": "HowToStep", "position": 2, "name": "Compile the rules", "text": "Compile the regex rules once and order the rule types so exact matches win over regex, and regex over prefix."},
        {"@type": "HowToStep", "position": 3, "name": "Classify entities", "text": "Read each ezdxf entity's layer, normalise case, and resolve it to a feature class through the rule cascade, logging any layer that reaches the unmapped bucket."},
        {"@type": "HowToStep", "position": 4, "name": "Build GeoDataFrames", "text": "Group classified geometries by feature class and build one geopandas GeoDataFrame per class for GIS output."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How do I handle case sensitivity in CAD layer names?",
          "acceptedAnswer": {"@type": "Answer", "text": "Normalise layer names to a single case before matching, because AutoCAD layer names are case-insensitive but stored with mixed case. Uppercase both the layer name and the rule keys, or compile regex rules with re.IGNORECASE, so A-Wall, A-WALL, and a-wall all resolve to the same feature class."}
        },
        {
          "@type": "Question",
          "name": "What should happen to unmapped layers?",
          "acceptedAnswer": {"@type": "Answer", "text": "Route unmapped layers to an explicit default feature class and log every distinct unmapped layer name with its entity count. Never drop them silently. The log becomes the worklist for extending the rule table, and the default bucket keeps the geometry recoverable rather than lost."}
        },
        {
          "@type": "Question",
          "name": "How do I resolve two layers that must merge into one feature class?",
          "acceptedAnswer": {"@type": "Answer", "text": "Map both layer names to the same feature class in the rule table; the rule engine naturally merges them because it groups by target class, not by layer. Add a source_layer attribute to each feature so the original layer is preserved for provenance even after the merge."}
        },
        {
          "@type": "Question",
          "name": "Should frozen or off layers be included?",
          "acceptedAnswer": {"@type": "Answer", "text": "Decide by policy and make it explicit. Frozen and off layers are still present in the DXF and readable by ezdxf, but they were hidden by the drafter for a reason. Check the layer table flags and either skip hidden layers or tag their features with a visibility attribute so downstream consumers can filter."}
        }
      ]
    }
  ]
}
</script>

# Mapping CAD Layers to GIS Feature Classes in Python

CAD drawings organise geometry by **layer name** — often terse, coded strings such as `A-WALL` or `C-ROAD-CNTR` — while GIS organises by **feature class**. To bridge the two in Python, drive a rule engine from a configuration table that combines exact, regex, and prefix rules, resolve each `ezdxf` entity's layer to a target feature class through that cascade, send anything unmatched to an explicit default bucket, and build one `geopandas` `GeoDataFrame` per feature class. This page is part of the [Layer Mapping Logic](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/) workflow, and the feature classes it produces are the ingest units for downstream steps such as [converting CAD polylines to GeoJSON](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/converting-cad-polylines-to-geojson/). A declarative rule table keeps the mapping auditable and reviewable instead of scattered through conditional code.

## How Layer-to-Feature-Class Mapping Works

CAD layer naming follows conventions like the AIA or the US National CAD Standard, where a discipline prefix, a major group, and modifiers are concatenated: `A-WALL-FULL`, `C-ROAD-CNTR`, `V-SURV-BNDY`. These strings encode intent, but they are strings — a GIS target needs a named feature class (`building_walls`, `road_centrelines`, `survey_boundaries`) with a defined geometry type and attribute schema.

A single match type is never enough. Some layers map one-to-one and are best handled by an **exact** rule. Families of layers with a shared stem (`A-WALL`, `A-WALL-FULL`, `A-WALL-PRHT`) are captured by a **regex** rule. Broad discipline buckets (everything starting `C-`) are handled by a **prefix** rule. The rule engine evaluates these in priority order — exact, then regex, then prefix — so specific rules win over general ones, and only a layer that matches nothing reaches the default bucket.

`ezdxf` supplies the raw material: each entity exposes its layer via `entity.dxf.layer`, and the layer table (`doc.layers`) carries per-layer flags for frozen and off states. The rule engine never mutates geometry; it only classifies. Grouping the classified entities by their resolved feature class, then constructing a `geopandas` `GeoDataFrame` per group, yields GIS-ready outputs with consistent schemas.

<svg viewBox="0 0 700 350" role="img" aria-label="Rule cascade: a CAD entity's layer name is tested against exact rules, then regex rules, then prefix rules; a match routes it to a feature class GeoDataFrame, and a miss falls through to the unmapped bucket which is logged" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:700px;display:block;margin:1.5rem auto;">
  <title>Layer-Name Rule Cascade to Feature Classes</title>
  <desc>A CAD entity enters at the top. Its layer name is tested first against exact rules, then regex rules, then prefix rules. Each stage that matches routes the entity rightward into a feature-class GeoDataFrame collection. A miss falls through downward to the next stage, and a final miss lands in the logged unmapped bucket.</desc>
  <defs>
    <marker id="fa" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor" opacity="0.75"/>
    </marker>
  </defs>
  <!-- Input -->
  <rect x="30" y="18" width="220" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="140" y="45" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">CAD entities grouped by layer</text>
  <line x1="140" y1="62" x2="140" y2="84" stroke="currentColor" stroke-width="1.5" marker-end="url(#fa)"/>
  <!-- Exact -->
  <rect x="30" y="86" width="220" height="46" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="140" y="106" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">Exact rules</text>
  <text x="140" y="120" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">layer == "A-WALL"</text>
  <line x1="140" y1="132" x2="140" y2="152" stroke="currentColor" stroke-width="1.2" opacity="0.7" marker-end="url(#fa)"/>
  <text x="164" y="146" font-size="9" fill="currentColor" font-family="sans-serif" opacity="0.6">miss</text>
  <!-- Regex -->
  <rect x="30" y="154" width="220" height="46" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="140" y="174" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">Regex rules</text>
  <text x="140" y="188" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">^A-WALL(-.+)?$</text>
  <line x1="140" y1="200" x2="140" y2="220" stroke="currentColor" stroke-width="1.2" opacity="0.7" marker-end="url(#fa)"/>
  <text x="164" y="214" font-size="9" fill="currentColor" font-family="sans-serif" opacity="0.6">miss</text>
  <!-- Prefix -->
  <rect x="30" y="222" width="220" height="46" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="140" y="242" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">Prefix rules</text>
  <text x="140" y="256" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">startswith("C-")</text>
  <line x1="140" y1="268" x2="140" y2="288" stroke="currentColor" stroke-width="1.2" opacity="0.7" marker-end="url(#fa)"/>
  <text x="164" y="282" font-size="9" fill="currentColor" font-family="sans-serif" opacity="0.6">miss</text>
  <!-- Unmapped -->
  <rect x="30" y="290" width="220" height="46" rx="6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="5 4" opacity="0.7"/>
  <text x="140" y="310" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif" opacity="0.85">Unmapped bucket</text>
  <text x="140" y="324" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.6">default + logged</text>
  <!-- Hit arrows to feature classes -->
  <line x1="250" y1="109" x2="452" y2="150" stroke="currentColor" stroke-width="1.3" opacity="0.7" marker-end="url(#fa)"/>
  <line x1="250" y1="177" x2="452" y2="178" stroke="currentColor" stroke-width="1.3" opacity="0.7" marker-end="url(#fa)"/>
  <line x1="250" y1="245" x2="452" y2="206" stroke="currentColor" stroke-width="1.3" opacity="0.7" marker-end="url(#fa)"/>
  <text x="330" y="150" text-anchor="middle" font-size="9" fill="currentColor" font-family="sans-serif" opacity="0.6">hit</text>
  <!-- Feature class collection -->
  <rect x="454" y="120" width="216" height="120" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="562" y="142" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif" font-weight="600">Feature class GeoDataFrames</text>
  <text x="562" y="166" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.75">building_walls</text>
  <text x="562" y="186" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.75">road_centrelines</text>
  <text x="562" y="206" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.75">survey_boundaries</text>
  <text x="562" y="226" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.6">unmapped</text>
</svg>

## Production-Ready Script

The script defines rules as a plain `dict` (equally loadable from YAML), compiles the regex rules once, classifies `ezdxf` entities through the exact-then-regex-then-prefix cascade, and builds one `geopandas` `GeoDataFrame` per feature class. Unmapped layers are counted and logged.

```python
# ezdxf>=1.1.0 | geopandas>=0.14 | shapely>=2.0 | python>=3.9
from __future__ import annotations

import logging
import re
from collections import Counter, defaultdict

import ezdxf
import geopandas as gpd
from shapely.geometry import LineString, Point

log = logging.getLogger("layer_mapping")

# Loadable from YAML/JSON; keys are match types, values map patterns -> feature class.
RULES = {
    "exact": {
        "A-WALL": "building_walls",
        "V-SURV-BNDY": "survey_boundaries",
    },
    "regex": {
        r"^A-WALL(-.+)?$": "building_walls",       # A-WALL, A-WALL-FULL, A-WALL-PRHT
        r"^C-ROAD-CNTR(-.+)?$": "road_centrelines",
    },
    "prefix": {
        "C-ROAD": "roads",
        "C-": "civil_other",
    },
    "default": "unmapped",
}


class LayerClassifier:
    """Resolve a normalised layer name to a feature class via an ordered cascade."""

    def __init__(self, rules: dict) -> None:
        self.exact = {k.upper(): v for k, v in rules.get("exact", {}).items()}
        # Compile regex once; IGNORECASE covers CAD's case-insensitive layer names.
        self.regex = [(re.compile(p, re.IGNORECASE), fc)
                      for p, fc in rules.get("regex", {}).items()]
        # Longest prefix first so "C-ROAD" wins over "C-".
        self.prefix = sorted(
            ((k.upper(), v) for k, v in rules.get("prefix", {}).items()),
            key=lambda kv: len(kv[0]), reverse=True,
        )
        self.default = rules.get("default", "unmapped")

    def classify(self, layer: str) -> str:
        name = layer.upper()
        if name in self.exact:            # 1. exact
            return self.exact[name]
        for pattern, fc in self.regex:     # 2. regex
            if pattern.match(layer):
                return fc
        for prefix, fc in self.prefix:     # 3. prefix
            if name.startswith(prefix):
                return fc
        return self.default                # 4. default bucket


def _entity_geometry(e) -> LineString | Point | None:
    """Convert a supported ezdxf entity to a shapely geometry (2D)."""
    t = e.dxftype()
    if t == "POINT":
        return Point(e.dxf.location.x, e.dxf.location.y)
    if t == "LINE":
        return LineString([(e.dxf.start.x, e.dxf.start.y),
                           (e.dxf.end.x, e.dxf.end.y)])
    if t == "LWPOLYLINE":
        pts = [(x, y) for x, y, *_ in e.vertices()]
        return LineString(pts) if len(pts) >= 2 else None
    return None  # other types handled by dedicated converters


def map_layers_to_feature_classes(
    dxf_path: str,
    rules: dict = RULES,
    include_hidden: bool = False,
    crs: str = "EPSG:4326",
) -> dict[str, gpd.GeoDataFrame]:
    """Classify DXF entities by layer and return one GeoDataFrame per feature class."""
    doc = ezdxf.readfile(dxf_path)
    classifier = LayerClassifier(rules)

    # Layer table flags for frozen/off handling.
    hidden = {
        lyr.dxf.name.upper()
        for lyr in doc.layers
        if lyr.is_frozen() or lyr.is_off()
    }

    buckets: dict[str, list[dict]] = defaultdict(list)
    unmapped: Counter = Counter()

    for e in doc.modelspace():
        layer = e.dxf.get("layer", "0")
        if not include_hidden and layer.upper() in hidden:
            continue
        geom = _entity_geometry(e)
        if geom is None:
            continue
        fc = classifier.classify(layer)
        if fc == classifier.default:
            unmapped[layer] += 1
        buckets[fc].append({
            "geometry": geom,
            "source_layer": layer,       # provenance survives layer merges
            "dxftype": e.dxftype(),
            "handle": e.dxf.handle,
        })

    for layer, count in unmapped.most_common():
        log.warning("Unmapped layer %r -> default bucket (%d entities).", layer, count)

    return {
        fc: gpd.GeoDataFrame(rows, geometry="geometry", crs=crs)
        for fc, rows in buckets.items()
    }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    gdfs = map_layers_to_feature_classes("plan.dxf")
    for feature_class, gdf in gdfs.items():
        print(f"{feature_class}: {len(gdf)} features")
```

**Key implementation notes:**

- The cascade order — exact, regex, prefix — is enforced by the `classify()` method structure, so a specific `A-WALL` rule always beats a broad `C-` prefix. Ordering is the whole point of the design.
- Regex rules are compiled once in `__init__`, not per entity. On drawings with hundreds of thousands of entities this is the difference between a scan that finishes and one that crawls.
- Prefix rules are sorted longest-first so `C-ROAD` wins over `C-`, mirroring how a human reads the more specific rule as more authoritative.
- `re.IGNORECASE` plus uppercasing the layer name handles CAD's case-insensitive layer semantics uniformly, so `A-Wall` and `a-wall` classify identically.
- Each feature carries `source_layer`, preserving provenance even when several layers merge into one feature class — essential for auditing and for the [metadata extraction strategies](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/) that attach further attributes downstream.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `ezdxf` | `>=1.1.0` | `entity.dxf.layer`, `doc.layers`, `Layer.is_frozen()`/`is_off()` stable since 1.0. |
| `geopandas` | `>=0.14` | `GeoDataFrame(rows, geometry=..., crs=...)` constructor; pulls in `shapely>=2.0`. |
| `shapely` | `>=2.0` | 2.x geometry objects; required transitively by geopandas 0.14+. |
| Python | `3.9+` | Uses `from __future__ import annotations`, `defaultdict`, `Counter`. |
| Config source | dict / YAML / JSON | `RULES` is a plain dict; load from YAML with `yaml.safe_load` for external config. |
| Geometry types | POINT, LINE, LWPOLYLINE | Extend `_entity_geometry` for POLYLINE, CIRCLE, ARC, HATCH as needed. |

## Fallback Strategies

**1. Case sensitivity.** AutoCAD layer names are case-insensitive but stored with mixed case. Uppercase both layer names and rule keys, and compile regex with `re.IGNORECASE`, so `A-WALL`, `A-Wall`, and `a-wall` resolve identically. The classifier above does this centrally; never compare raw layer strings.

**2. Layer name collisions and merges.** When two distinct layers must become one feature class, map both to the same target — the engine groups by feature class, so the merge is automatic. Retain `source_layer` on every feature so the original layer is recoverable after the merge for provenance and QA.

**3. Unmapped layers policy.** Route unmatched layers to an explicit default feature class and log each distinct name with its entity count. The log is the worklist for extending the rule table; the default bucket keeps geometry recoverable rather than silently dropped. Fail the job if unmapped counts exceed a configured threshold.

**4. Frozen and off layers.** Frozen and off layers remain in the DXF and are readable, but the drafter hid them deliberately. Read the layer table flags (`is_frozen()`, `is_off()`) and either skip them or tag their features with a visibility attribute so downstream consumers can filter. Make the choice explicit via `include_hidden`.

**5. Mixed geometry types per layer.** A single layer can hold points, lines, and polygons at once, but a GIS feature class usually expects one geometry type. Either split a mixed layer into type-specific feature classes (`walls_line`, `walls_poly`) or emit separate GeoDataFrames per geometry type, because most GIS targets and formats like GeoPackage reject mixed-geometry tables.

## FAQ

<details>
<summary><strong>How do I handle case sensitivity in CAD layer names?</strong></summary>

Normalise layer names to a single case before matching, because AutoCAD layer names are case-insensitive but stored with mixed case. Uppercase both the layer name and the rule keys, or compile regex rules with `re.IGNORECASE`, so `A-Wall`, `A-WALL`, and `a-wall` all resolve to the same feature class.

</details>

<details>
<summary><strong>What should happen to unmapped layers?</strong></summary>

Route unmapped layers to an explicit default feature class and log every distinct unmapped layer name with its entity count. Never drop them silently. The log becomes the worklist for extending the rule table, and the default bucket keeps the geometry recoverable rather than lost.

</details>

<details>
<summary><strong>How do I resolve two layers that must merge into one feature class?</strong></summary>

Map both layer names to the same feature class in the rule table; the rule engine merges them because it groups by target class, not by layer. Add a `source_layer` attribute to each feature so the original layer is preserved for provenance even after the merge.

</details>

<details>
<summary><strong>Should frozen or off layers be included?</strong></summary>

Decide by policy and make it explicit. Frozen and off layers are still present in the DXF and readable by `ezdxf`, but they were hidden by the drafter for a reason. Check the layer table flags and either skip hidden layers or tag their features with a visibility attribute so downstream consumers can filter.

</details>

---

## Related Pages

- [Layer Mapping Logic](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/) — parent reference on translating CAD layer conventions into GIS schemas
- [Metadata Extraction Strategies](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/) — attaching block attributes and properties to the classified features
- [Converting CAD Polylines to GeoJSON](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/converting-cad-polylines-to-geojson/) — serialising the per-feature-class GeoDataFrames to GeoJSON
- [CRS Normalization Workflows](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/) — assigning and reprojecting the CRS of the resulting feature classes
