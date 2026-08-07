---
title: "Mapping IFC Properties to GeoJSON Attributes with Python"
description: "Step-by-step guide to extracting IfcPropertySet and IfcElementQuantity data, flattening BIM metadata into JSON-safe key-value pairs, and serializing valid GeoJSON FeatureCollection output using ifcopenshell and pyproj."
slug: "mapping-ifc-properties-to-geojson-attributes"
breadcrumb:
  - label: "Core Format Fundamentals & Schema Mapping"
    url: "/core-format-fundamentals-schema-mapping/"
  - label: "IFC4x3 Schema Mapping"
    url: "/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/"
  - label: "Mapping IFC Properties to GeoJSON Attributes"
    url: "/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/mapping-ifc-properties-to-geojson-attributes/"
datePublished: "2025-06-10"
dateModified: "2026-06-24"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Mapping IFC Properties to GeoJSON Attributes with Python",
      "description": "Step-by-step guide to extracting IfcPropertySet and IfcElementQuantity data, flattening BIM metadata into JSON-safe key-value pairs, and serializing valid GeoJSON FeatureCollection output using ifcopenshell and pyproj.",
      "datePublished": "2025-06-10",
      "dateModified": "2026-06-24",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Core Format Fundamentals & Schema Mapping", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/"},
        {"@type": "ListItem", "position": 2, "name": "IFC4x3 Schema Mapping", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/"},
        {"@type": "ListItem", "position": 3, "name": "Mapping IFC Properties to GeoJSON Attributes", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/mapping-ifc-properties-to-geojson-attributes/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Mapping IFC Properties to GeoJSON Attributes with Python",
      "description": "Extract IfcPropertySet and IfcElementQuantity data, flatten BIM metadata, transform coordinates, and serialize GeoJSON FeatureCollection output.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Filter target elements", "text": "Query ifcopenshell for IfcBuildingElement, IfcCivilElement, IfcTransportElement using ifc.by_type()."},
        {"@type": "HowToStep", "position": 2, "name": "Traverse IsDefinedBy relationships", "text": "Iterate each element's IsDefinedBy inverse attribute to locate attached IfcPropertySet and IfcElementQuantity definitions."},
        {"@type": "HowToStep", "position": 3, "name": "Flatten and normalize property values", "text": "Extract Name/NominalValue pairs, unwrap EXPRESS typed wrappers (IfcLabel, IfcReal, IfcBoolean) to Python primitives, and prefix quantity keys."},
        {"@type": "HowToStep", "position": 4, "name": "Transform coordinates to EPSG:4326", "text": "Read IfcGeometricRepresentationContext to identify the source CRS, then apply pyproj.Transformer to reproject geometry before GeoJSON assembly."},
        {"@type": "HowToStep", "position": 5, "name": "Serialize as GeoJSON FeatureCollection", "text": "Assemble Feature objects with geometry, properties, and id fields, then write the FeatureCollection to disk as UTF-8 JSON."}
      ]
    }
  ]
}
</script>

# Mapping IFC Properties to GeoJSON Attributes with Python

To map IFC properties to GeoJSON attributes, extract `IfcPropertySet` and `IfcElementQuantity` data via `ifcopenshell`, flatten the hierarchical BIM metadata into a deterministic key-value dictionary, reproject geometry from the IFC local coordinate system to WGS84 (EPSG:4326) with `pyproj`, and serialize each element as a GeoJSON `Feature`. The complete pipeline is five steps: element filtering, `IsDefinedBy` traversal, EXPRESS type normalization, coordinate transformation, and `FeatureCollection` serialization. For the broader context of IFC entity structures and infrastructure-specific property sets, see the [IFC4x3 Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/) reference.

---

## How ifcopenshell Handles Property Extraction

IFC stores metadata in a graph of relationship entities rather than as direct element attributes. The key relationships are:

- **`IfcRelDefinesByProperties`** — connects an element to an `IfcPropertySet` (free-form name/value pairs) or an `IfcElementQuantity` (typed physical measurements).
- **`IfcPropertySingleValue`** — the most common property node; holds a `Name` string and a `NominalValue` typed as an EXPRESS wrapper such as `IfcLabel`, `IfcReal`, or `IfcBoolean`.
- **`IfcPropertyEnumeratedValue`** — a list-valued property where `EnumerationValues` returns a tuple of EXPRESS-typed entries.
- **`IfcQuantityLength` / `IfcQuantityArea` / `IfcQuantityVolume`** — quantity subtypes that expose typed numeric accessors (`LengthValue`, `AreaValue`, `VolumeValue`).

`ifcopenshell` exposes `element.IsDefinedBy` as a Python list that you iterate directly. Each entry may be `IfcRelDefinesByProperties` or an unrelated relationship type, so you must guard with `rel.is_a("IfcRelDefinesByProperties")` before casting. EXPRESS wrapper values carry a `.wrappedValue` attribute; calling `hasattr(val, "wrappedValue")` and unwrapping recursively handles arbitrarily nested type chains without hard-coding every IFC type name.

GeoJSON's `properties` object must be a flat JSON object — no nested dicts, no non-JSON types. IFC's hierarchical model means multiple property sets on a single element can contain properties with identical names. The safe pattern prefixes each value key with its parent property set name (e.g., `WallAssembly__FireRating`) so downstream ingestion into PostGIS, QGIS, or a web mapping API never silently overwrites data.

The diagram below shows the relationship traversal path from an `IfcElement` to a serialized GeoJSON `Feature`:

<svg viewBox="4 24 717 257" role="img" aria-label="Data flow from IfcElement through property-set relationships to a GeoJSON Feature" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;display:block;margin:1.5rem auto;">
  <title>IFC to GeoJSON property mapping data flow</title>
  <desc>Diagram showing how an IfcElement's IsDefinedBy relationships connect to IfcPropertySet and IfcElementQuantity nodes, whose values are normalized and assembled into a GeoJSON Feature properties object.</desc>
  <!-- Background -->
  <rect x="4" y="24" width="717" height="257" fill="var(--color-surface)"/>
  <!-- IfcElement box -->
  <rect x="20" y="130" width="140" height="50" rx="6" fill="currentColor" opacity="0.08" stroke="currentColor" stroke-width="1.5"/>
  <text x="90" y="151" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor">IfcElement</text>
  <text x="90" y="168" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">(GlobalId, Name, …)</text>
  <!-- Arrow: IfcElement → IsDefinedBy -->
  <line x1="160" y1="155" x2="200" y2="155" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrowhead)"/>
  <text x="180" y="123" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.65">IsDefinedBy</text>
  <!-- IfcRelDefinesByProperties box -->
  <rect x="200" y="130" width="160" height="50" rx="6" fill="currentColor" opacity="0.08" stroke="currentColor" stroke-width="1.5"/>
  <text x="280" y="151" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">IfcRelDefines</text>
  <text x="280" y="166" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">ByProperties</text>
  <!-- Arrow up to PropertySet -->
  <line x1="280" y1="130" x2="280" y2="95" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrowhead)"/>
  <text x="295" y="115" font-size="9" fill="currentColor" opacity="0.65">RelatingPropertyDefinition</text>
  <!-- IfcPropertySet box -->
  <rect x="195" y="40" width="170" height="50" rx="6" fill="currentColor" opacity="0.08" stroke="currentColor" stroke-width="1.5"/>
  <text x="280" y="61" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">IfcPropertySet</text>
  <text x="280" y="76" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">HasProperties [ … ]</text>
  <!-- Arrow to IfcPropertySingleValue -->
  <line x1="365" y1="65" x2="405" y2="65" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrowhead)"/>
  <!-- IfcPropertySingleValue -->
  <rect x="405" y="40" width="155" height="50" rx="6" fill="currentColor" opacity="0.08" stroke="currentColor" stroke-width="1.5"/>
  <text x="482" y="61" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">IfcPropertySingle</text>
  <text x="482" y="76" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">Value → NominalValue</text>
  <!-- Arrow down to IfcElementQuantity -->
  <line x1="280" y1="180" x2="280" y2="215" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrowhead)"/>
  <!-- IfcElementQuantity box -->
  <rect x="195" y="215" width="170" height="50" rx="6" fill="currentColor" opacity="0.08" stroke="currentColor" stroke-width="1.5"/>
  <text x="280" y="236" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">IfcElementQuantity</text>
  <text x="280" y="251" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">Quantities [ … ]</text>
  <!-- Arrow to IfcQuantityLength etc -->
  <line x1="365" y1="240" x2="405" y2="240" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrowhead)"/>
  <!-- IfcQuantity* box -->
  <rect x="405" y="215" width="155" height="50" rx="6" fill="currentColor" opacity="0.08" stroke="currentColor" stroke-width="1.5"/>
  <text x="482" y="236" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">IfcQuantityLength</text>
  <text x="482" y="251" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">/ Area / Volume / Count</text>
  <!-- Normalize arrow -->
  <line x1="560" y1="155" x2="600" y2="155" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#arrowhead)"/>
  <text x="575" y="108" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.65">normalize</text>
  <!-- GeoJSON Feature box -->
  <rect x="600" y="115" width="105" height="80" rx="6" fill="currentColor" opacity="0.08" stroke="currentColor" stroke-width="2"/>
  <text x="652" y="140" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">GeoJSON</text>
  <text x="652" y="155" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">Feature</text>
  <text x="652" y="170" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">{ geometry,</text>
  <text x="652" y="183" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.75">properties }</text>
  <!-- Connect property boxes to normalize arrow -->
  <line x1="560" y1="65" x2="580" y2="65" stroke="currentColor" stroke-width="1" stroke-dasharray="3 3"/>
  <line x1="580" y1="65" x2="580" y2="155" stroke="currentColor" stroke-width="1" stroke-dasharray="3 3"/>
  <line x1="560" y1="240" x2="580" y2="240" stroke="currentColor" stroke-width="1" stroke-dasharray="3 3"/>
  <line x1="580" y1="240" x2="580" y2="155" stroke="currentColor" stroke-width="1" stroke-dasharray="3 3"/>
  <!-- Arrowhead marker -->
  <defs>
    <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" opacity="0.7"/>
    </marker>
  </defs>
</svg>

---

## Production-Ready Script

The script below is a complete, copy-pasteable extraction routine. It handles nested property sets, `IfcElementQuantity` with four quantity subtypes, collision-safe key prefixing, and WGS84 coordinate output. Replace the geometry stub with your actual `pyproj` transformation for production use.

```python
# Requires: ifcopenshell>=0.8.0, pyproj>=3.0, geojson>=3.0
import ifcopenshell
import json
from typing import Any, Dict, List
from pathlib import Path


def normalize_ifc_value(val: Any) -> Any:
    """Recursively unwrap IFC EXPRESS typed wrappers to JSON-safe primitives."""
    if val is None:
        return None
    # Unwrap single-level and nested EXPRESS typed values (IfcLabel, IfcReal, etc.)
    if hasattr(val, "wrappedValue"):
        return normalize_ifc_value(val.wrappedValue)
    if isinstance(val, (str, int, float, bool)):
        return val
    # IfcPropertyEnumeratedValue returns a tuple — flatten to list
    if hasattr(val, "__iter__") and not isinstance(val, str):
        return [normalize_ifc_value(v) for v in val]
    return str(val)


def extract_properties(element) -> Dict[str, Any]:
    """
    Flatten all IfcPropertySet and IfcElementQuantity data attached to an element.
    Keys are prefixed with their parent set name to prevent cross-set collisions:
    e.g., 'Pset_WallCommon__FireRating' rather than a bare 'FireRating'.
    """
    props: Dict[str, Any] = {
        "ifc_guid": element.GlobalId,
        "ifc_type": element.is_a(),
        "ifc_name": getattr(element, "Name", None),
    }

    if not hasattr(element, "IsDefinedBy"):
        return props

    for rel in element.IsDefinedBy:
        if not rel.is_a("IfcRelDefinesByProperties"):
            continue

        pset_def = rel.RelatingPropertyDefinition
        pset_name = getattr(pset_def, "Name", "Unknown")

        if pset_def.is_a("IfcPropertySet"):
            for prop in pset_def.HasProperties:
                if prop.is_a("IfcPropertySingleValue"):
                    key = f"{pset_name}__{prop.Name}"
                    props[key] = normalize_ifc_value(prop.NominalValue)
                elif prop.is_a("IfcPropertyEnumeratedValue"):
                    key = f"{pset_name}__{prop.Name}"
                    props[key] = normalize_ifc_value(prop.EnumerationValues)

        elif pset_def.is_a("IfcElementQuantity"):
            for qty in pset_def.Quantities:
                if qty.is_a("IfcQuantityLength"):
                    props[f"QTY_{pset_name}__{qty.Name}"] = normalize_ifc_value(
                        qty.LengthValue
                    )
                elif qty.is_a("IfcQuantityArea"):
                    props[f"QTY_{pset_name}__{qty.Name}"] = normalize_ifc_value(
                        qty.AreaValue
                    )
                elif qty.is_a("IfcQuantityVolume"):
                    props[f"QTY_{pset_name}__{qty.Name}"] = normalize_ifc_value(
                        qty.VolumeValue
                    )
                elif qty.is_a("IfcQuantityCount"):
                    props[f"QTY_{pset_name}__{qty.Name}"] = normalize_ifc_value(
                        qty.CountValue
                    )

    return props


def get_element_centroid_wgs84(element, transformer) -> list | None:
    """
    Return [longitude, latitude] for the element's local placement origin,
    reprojected to EPSG:4326 via pyproj.Transformer.

    In a full pipeline, replace this stub with triangulated geometry extraction
    using ifcopenshell.geom.create_shape() or ifcopenshell.util.placement.
    """
    try:
        import ifcopenshell.util.placement
        m = ifcopenshell.util.placement.get_local_placement(element.ObjectPlacement)
        # m is a 4x4 numpy array; column 3 holds the translation vector
        local_x, local_y, local_z = float(m[0][3]), float(m[1][3]), float(m[2][3])
        lon, lat = transformer.transform(local_x, local_y)
        return [lon, lat]
    except Exception:
        return None


def build_feature_collection(
    ifc_path: str,
    source_epsg: int,
    output_path: str,
    element_types: list[str] | None = None,
) -> None:
    """
    Parse an IFC file, map properties for each spatial element,
    reproject geometry to EPSG:4326, and write a GeoJSON FeatureCollection.

    Args:
        ifc_path:     Path to the .ifc file.
        source_epsg:  EPSG code of the IFC project's coordinate system.
        output_path:  Destination .geojson file path.
        element_types: IFC entity type names to include; defaults to common types.
    """
    from pyproj import Transformer  # pyproj>=3.0

    if element_types is None:
        element_types = [
            "IfcBuildingElement",
            "IfcCivilElement",
            "IfcTransportElement",
            "IfcFacilitiesPart",
        ]

    ifc_file = ifcopenshell.open(ifc_path)
    transformer = Transformer.from_crs(
        f"EPSG:{source_epsg}", "EPSG:4326", always_xy=True
    )

    features: List[Dict] = []

    for elem_type in element_types:
        for element in ifc_file.by_type(elem_type):
            props = extract_properties(element)

            coords = None
            if hasattr(element, "ObjectPlacement") and element.ObjectPlacement:
                coords = get_element_centroid_wgs84(element, transformer)

            geometry = (
                {"type": "Point", "coordinates": coords} if coords else None
            )

            features.append(
                {
                    "type": "Feature",
                    "id": element.GlobalId,
                    "geometry": geometry,
                    "properties": props,
                }
            )

    fc = {"type": "FeatureCollection", "features": features}
    Path(output_path).write_text(
        json.dumps(fc, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"Wrote {len(features)} features to {output_path}")


# --- Entry point ---
# build_feature_collection(
#     ifc_path="infrastructure_model.ifc",
#     source_epsg=27700,          # e.g. British National Grid
#     output_path="output.geojson"
# )
```

<!-- fig:ifc-geojson-flatten -->
<svg viewBox="-20 -20 590 194.1" role="img" aria-label="Bare property names let two property sets collide silently; prefixing each key with its property set keeps both" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:590px;display:block;margin:1.5rem auto;">
  <title>Why property keys are prefixed with their property set</title>
  <desc>Two flattening strategies for the same element. Writing bare property names lets two property sets that both define a fire rating overwrite one another, and which one survives depends on iteration order. Prefixing each key with its parent property set name keeps both, and makes the origin of every attribute visible in the GeoJSON.</desc>
  <defs>
    <marker id="g2j1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="g2j1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="590" height="194.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="260" height="130" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4" stroke-dasharray="5 4"/>
  <text x="130" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Bare property names</text>
  <line x1="14" y1="33" x2="246" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="16" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— FireRating from two psets</text>
  <text x="16" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— last write wins</text>
  <text x="16" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— result depends on iteration order</text>
  <text x="16" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— origin of the value is lost</text>
  <rect x="290" y="0" width="260" height="130" rx="6" fill="currentColor" fill-opacity="0.11" stroke="currentColor" stroke-width="1.9"/>
  <text x="420" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Prefixed with the pset</text>
  <line x1="304" y1="33" x2="536" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="306" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— WallAssembly__FireRating</text>
  <text x="306" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— FireProtection__FireRating</text>
  <text x="306" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— both survive</text>
  <text x="306" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— origin is readable in the output</text>
  <text x="275" y="152" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">GeoJSON properties must be flat — flattening is where BIM data quietly loses records.</text>
</svg>
<!-- /fig:ifc-geojson-flatten -->

**Key implementation notes:**

- `normalize_ifc_value` recurses on `.wrappedValue` to handle multi-level EXPRESS nesting (e.g., `IfcMeasureWithUnit` wrapping `IfcReal`). Never hard-code a list of IFC type names — the recursive check is format-version agnostic.
- Key prefixing with `pset_name__` prevents data loss when two property sets both define a property called `FireRating` or `Description`. Downstream PostGIS columns and QGIS attribute tables receive unique field names automatically.
- `ifcopenshell.util.placement.get_local_placement` returns a 4×4 numpy array; the translation component is in column index 3, rows 0–2. This is the element origin in the IFC project coordinate system — apply `pyproj.Transformer` immediately before appending to `properties`.
- Pass `always_xy=True` to `Transformer.from_crs` to guarantee longitude-first coordinate order in EPSG:4326 output, matching the GeoJSON RFC 7946 convention.
- When only metadata mapping is required (no geometry), omit the `ifcopenshell.geom` import entirely and skip `get_element_centroid_wgs84`. Geometry parsing is the dominant CPU cost in large IFC files.

---

## Compatibility Matrix

| Component | Supported Range | Notes |
|-----------|----------------|-------|
| `ifcopenshell` | `>=0.7.0` | IFC4x3 EXPRESS schema requires `>=0.8.0`; `IsDefinedBy` traversal works across IFC2x3, IFC4, IFC4x3 |
| `pyproj` | `>=3.0` | `always_xy` parameter introduced in 3.0; earlier versions silently swap axes |
| `geojson` (optional) | `>=3.0` | Used here via plain `dict`/`json`; the `geojson` package validates Feature structure if installed |
| Python | `3.9+` | Uses `list[str] | None` union type hint (PEP 604); remove the hint for 3.8 compat |
| IFC Schema Version | IFC2x3, IFC4, IFC4x3 | `IsDefinedBy` and `IfcPropertySet` exist across all three; IFC4x3 adds `Pset_Alignment*`, `Pset_Railway*` |
| OS | Linux, macOS, Windows | `ifcopenshell` wheels available for all three on PyPI for Python 3.9–3.12 |
| Known limitations | `IfcPropertyTableValue`, `IfcPropertyListValue` | These subtypes are not handled above; add explicit branches if your models use them |

---

## Fallback Strategies and Troubleshooting

### 1. `IsDefinedBy` is empty or returns no `IfcRelDefinesByProperties` entries

<!-- fig:ifc-express-unwrap -->
<svg viewBox="-20 -33.5 462 101.7" role="img" aria-label="An EXPRESS wrapper is unwrapped recursively to a Python primitive before it can be serialised into GeoJSON" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:462px;display:block;margin:1.5rem auto;">
  <title>Unwrapping an EXPRESS typed value to a JSON primitive</title>
  <desc>Three stages. A nominal value arrives as an EXPRESS wrapper naming its measure type. Testing for a wrapped value and unwrapping recursively reaches the underlying Python primitive without hard-coding every IFC type name. The primitive is what GeoJSON can serialise; the wrapper is not.</desc>
  <defs>
    <marker id="g2j2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="g2j2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-33.5" width="462" height="101.7" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="116.8" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="58.4" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">IfcLabel(&quot;EI60&quot;)</text>
  <text x="58.4" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">EXPRESS wrapper</text>
  <rect x="150.8" y="0" width="127.6" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="214.6" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Recursive unwrap</text>
  <text x="214.6" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">no type table needed</text>
  <rect x="312.4" y="0" width="109.6" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="367.2" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">&quot;EI60&quot;</text>
  <text x="367.2" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">JSON-serialisable</text>
  <line x1="116.8" y1="24.1" x2="150.8" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#g2j2-a)"/>
  <text x="133.8" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">wrappedValue</text>
  <line x1="278.4" y1="24.1" x2="312.4" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#g2j2-a)"/>
  <text x="295.4" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">primitive</text>
</svg>
<!-- /fig:ifc-express-unwrap -->

This occurs when the IFC file stores type-level properties on `IfcTypeObject` rather than on instance elements. Use `ifcopenshell.util.element.get_psets(element, psets_only=False)` as a drop-in replacement — it merges instance and type-level property sets automatically:

```python
import ifcopenshell.util.element

def extract_properties_merged(element) -> dict:
    # Returns {pset_name: {prop_name: value, ...}, ...} merged from instance + type
    raw = ifcopenshell.util.element.get_psets(element, psets_only=False)
    flat = {"ifc_guid": element.GlobalId, "ifc_type": element.is_a()}
    for pset_name, prop_dict in raw.items():
        for prop_name, val in prop_dict.items():
            flat[f"{pset_name}__{prop_name}"] = val
    return flat
```

### 2. `pyproj.Transformer` raises `CRSError: Invalid projection`

The IFC file's `IfcProjectedCRS` may store an authority-specific name (e.g., `"OSGB 1936 / British National Grid"`) rather than an `EPSG:` string. Resolve it with `pyproj.CRS.from_user_input()` before building the transformer:

```python
from pyproj import CRS, Transformer

source_crs = CRS.from_user_input("OSGB 1936 / British National Grid")
transformer = Transformer.from_crs(source_crs, "EPSG:4326", always_xy=True)
```

### 3. Feature `geometry` is `null` for every element

Most often the IFC file stores geometry in a project's local coordinate system with no `ObjectPlacement` on leaf elements — only on their container (`IfcBuildingStorey`, `IfcSite`). Use `ifcopenshell.util.placement.get_local_placement` on the containing spatial structure, then offset leaf element positions relative to it.

### 4. Output GeoJSON fails validation in QGIS or Mapbox

RFC 7946 requires all coordinates to be decimal degrees in WGS84, longitude first. If output values exceed ±180 for longitude or ±90 for latitude, `pyproj` transformed into a projected output CRS. Verify `always_xy=True` is set and that the destination CRS argument is `"EPSG:4326"` not `"EPSG:3857"`.

### 5. Memory exhaustion on large infrastructure models (>500 MB)

Replace `ifc_file.by_type(elem_type)` list iteration with a generator and stream features directly to a file rather than accumulating a Python list:

```python
import ijson  # pip install ijson — for streaming large JSON; here used for output only

def stream_feature_collection(ifc_path: str, elem_types: list, transformer, out_path: str):
    ifc_file = ifcopenshell.open(ifc_path)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write('{"type":"FeatureCollection","features":[\n')
        first = True
        for etype in elem_types:
            for element in ifc_file.by_type(etype):
                props = extract_properties(element)
                feature = {"type": "Feature", "id": element.GlobalId,
                           "geometry": None, "properties": props}
                if not first:
                    f.write(",\n")
                json.dump(feature, f, ensure_ascii=False)
                first = False
        f.write("\n]}")
```

For infrastructure models where geometry is the bottleneck, open the IFC file with geometry disabled — pass `settings` that skip shape creation and call `get_psets` directly. Parsing geometry for a 300,000-element rail alignment model can consume 8–12 GB RAM; metadata-only extraction typically stays under 1 GB.

---

## Related Pages

- [IFC4x3 Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/) — parent reference covering entity hierarchy traversal, CRS extraction, and the full IFC4x3 property model
- [Core Format Fundamentals & Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/) — the broader format interoperability context including DXF, DWG, and IFC schema translation patterns
- [Metadata Extraction Strategies](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/) — parallel extraction patterns for DXF XDATA and block attributes alongside IFC property sets
- [DXF Entity Structure Breakdown](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/) — contrast with IFC: how DXF encodes properties as group codes and extended data rather than typed relationship graphs
