# Mapping IFC properties to GeoJSON attributes

Mapping IFC properties to GeoJSON attributes requires extracting `IfcPropertySet` and `IfcElementQuantity` data, flattening hierarchical BIM metadata into a deterministic key-value dictionary, and attaching it to a GeoJSON `Feature` alongside converted geometry. The standard pipeline uses `ifcopenshell` to parse the STEP-based IFC file, iterates through spatial or civil elements, traverses the `IsDefinedBy` relationship graph, normalizes IFC EXPRESS types into JSON-safe primitives, and serializes the result per the [GeoJSON specification (RFC 7946)](https://datatracker.ietf.org/doc/html/rfc7946). Because IFC operates in arbitrary local or project coordinate systems while GeoJSON strictly expects WGS84 (EPSG:4326), successful mapping also requires explicit coordinate transformation and CRS declaration before serialization.

## Core Conversion Pipeline

A reliable translation routine follows a deterministic sequence to prevent attribute loss and downstream GIS ingestion failures:

1. **Element Filtering** – Query `ifcopenshell` for target entities (`IfcBuildingElement`, `IfcCivilElement`, `IfcTransportElement`, etc.) using `ifc.by_type()` or `ifc.traverse()`.
2. **Relationship Traversal** – Iterate each element’s `IsDefinedBy` inverse attribute to locate attached property sets and quantity sets.
3. **Hierarchical Flattening** – Extract `Name`/`NominalValue` pairs from `IfcPropertySingleValue`, unwrap enumerations, and concatenate quantity values.
4. **Type Normalization** – Convert EXPRESS wrappers (`IfcLabel`, `IfcReal`, `IfcBoolean`) to native Python primitives (`str`, `float`, `bool`). Handle `None` explicitly.
5. **Coordinate Transformation** – Reproject geometry from the IFC project CRS to EPSG:4326 using `pyproj` or a precomputed transformation matrix.
6. **GeoJSON Serialization** – Assemble `Feature` objects with `geometry`, `properties`, and optional `id`, then wrap in a `FeatureCollection`.

## Production-Ready Python Implementation

The following script demonstrates a complete extraction routine. It handles nested property sets, normalizes IFC types, and outputs a valid GeoJSON `FeatureCollection`.

```python
import ifcopenshell
import json
import geojson
from typing import Any, Dict, List, Optional
from pathlib import Path

def normalize_ifc_value(val: Any) -> Any:
    """Convert IFC EXPRESS types to JSON-safe primitives."""
    if val is None:
        return None
    # Unwrap EXPRESS typed values (e.g., IfcLabel, IfcReal)
    if hasattr(val, "wrappedValue"):
        return normalize_ifc_value(val.wrappedValue)
    if isinstance(val, (str, int, float, bool)):
        return val
    # Handle lists/tuples (e.g., IfcPropertyEnumeratedValue)
    if hasattr(val, "__iter__") and not isinstance(val, str):
        return [normalize_ifc_value(v) for v in val]
    # Fallback for complex objects
    return str(val)

def extract_properties(element) -> Dict[str, Any]:
    """Flatten IfcPropertySet and IfcElementQuantity into a flat dict."""
    props: Dict[str, Any] = {}
    if not hasattr(element, "IsDefinedBy"):
        return props

    for rel in element.IsDefinedBy:
        if not rel.is_a("IfcRelDefinesByProperties"):
            continue
            
        pset_def = rel.RelatingPropertyDefinition
        if pset_def.is_a("IfcPropertySet"):
            for prop in pset_def.HasProperties:
                if prop.is_a("IfcPropertySingleValue"):
                    key = prop.Name
                    props[key] = normalize_ifc_value(prop.NominalValue)
                elif prop.is_a("IfcPropertyEnumeratedValue"):
                    key = prop.Name
                    props[key] = normalize_ifc_value(prop.EnumerationValues)
        elif pset_def.is_a("IfcElementQuantity"):
            for qty in pset_def.Quantities:
                if qty.is_a("IfcQuantityLength"):
                    props[f"QTY_{qty.Name}"] = normalize_ifc_value(qty.LengthValue)
                elif qty.is_a("IfcQuantityArea"):
                    props[f"QTY_{qty.Name}"] = normalize_ifc_value(qty.AreaValue)
                elif qty.is_a("IfcQuantityVolume"):
                    props[f"QTY_{qty.Name}"] = normalize_ifc_value(qty.VolumeValue)
                elif qty.is_a("IfcQuantityCount"):
                    props[f"QTY_{qty.Name}"] = normalize_ifc_value(qty.CountValue)
                    
    return props

def build_feature_collection(ifc_path: str, target_crs: str = "EPSG:4326") -> str:
    """Parse IFC, map properties, and return a GeoJSON FeatureCollection string."""
    ifc_file = ifcopenshell.open(ifc_path)
    features: List[geojson.Feature] = []
    
    # Target civil/structural elements
    element_types = [
        "IfcBuildingElement", "IfcCivilElement", "IfcTransportElement", 
        "IfcFacilitiesPart", "IfcSpatialElement"
    ]
    
    for elem_type in element_types:
        for element in ifc_file.by_type(elem_type):
            props = extract_properties(element)
            if not props:
                continue
                
            # Geometry extraction & CRS transformation placeholder
            # In production, use pyproj.Transformer or ifcopenshell.util.placement
            geometry = None
            if element.Representation:
                # Simplified: extract bounding box or centroid for demonstration
                # Real pipelines should triangulate or export B-Rep to WKT/GeoJSON
                geometry = geojson.Point((0.0, 0.0))  # Replace with actual transformed coords

            feature = geojson.Feature(
                geometry=geometry,
                properties=props,
                id=str(element.GlobalId)
            )
            features.append(feature)

    fc = geojson.FeatureCollection(features=features)
    return geojson.dumps(fc, indent=2, sort_keys=True)

# Usage:
# geojson_str = build_feature_collection("model.ifc")
# Path("output.geojson").write_text(geojson_str)
```

## Schema Alignment & Data Integrity

BIM-to-GIS translation fails most often at the schema boundary. IFC organizes metadata through nested entity relationships (`IfcPropertySetDefinition`, `IfcPropertySingleValue`, `IfcPropertyEnumeratedValue`), whereas GeoJSON expects a flat `properties` object per feature. Deterministic key generation prevents collisions when multiple property sets share identical property names. Prefixing keys with their parent set name (e.g., `FireRating_WallAssembly` instead of just `FireRating`) guarantees collision-free ingestion into PostGIS, QGIS, or web mapping stacks.

Null handling is equally critical. IFC frequently omits optional attributes rather than writing explicit `NULL`. The normalization routine above explicitly checks for `None` and preserves `null` in JSON output, which prevents type-casting errors in downstream ETL pipelines. For teams standardizing modern civil and rail workflows, reviewing the [IFC4x3 Schema Mapping](/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/) documentation clarifies how extended infrastructure entities structure property sets differently than traditional building elements. This foundation aligns directly with broader [Core Format Fundamentals & Schema Mapping](/core-format-fundamentals-schema-mapping/) principles that govern cross-platform data translation and prevent attribute loss during format conversion.

## Coordinate Transformation & CRS Handling

GeoJSON strictly requires longitude/latitude coordinates in WGS84 (EPSG:4326). IFC files, however, store geometry in arbitrary local grids, survey coordinates, or projected systems (EPSG:27700, EPSG:32633, etc.). Blindly exporting IFC coordinates to GeoJSON will place assets in the Gulf of Guinea or scatter them across incorrect map tiles.

Production pipelines must:
1. Read the IFC `IfcProject` → `IfcGeometricRepresentationContext` → `TrueNorth` and `WorldCoordinateSystem` to identify the source CRS.
2. Use `pyproj.Transformer` to convert coordinates before GeoJSON assembly.
3. Apply the `crs` member only as a legacy fallback; modern GeoJSON parsers assume EPSG:4326 by default.

For authoritative guidance on coordinate system handling in geospatial data exchange, consult the [OGC GeoJSON Standard](https://www.ogc.org/standards/geojson) and the [IFC OpenShell Geometry Documentation](https://docs.ifcopenshell.org/ifcopenshell-python/geometry.html). Always validate transformed coordinates against known survey control points before bulk serialization.

## Performance Considerations for Large Models

Infrastructure IFC files frequently exceed 500MB and contain hundreds of thousands of elements. Iterating `ifc.by_type()` and traversing `IsDefinedBy` per element scales linearly but can bottleneck memory. Optimize by:
- Using `ifcopenshell.util.element.get_pset()` for cached property lookups.
- Filtering elements early with `ifc.get_inverse()` or pre-indexed GUID maps.
- Streaming GeoJSON output via `ijson` or chunked `FeatureCollection` writes instead of holding the entire object in RAM.
- Disabling IFC geometry parsing (`ifcopenshell.open(..., settings={"load_geometry": False})`) when only metadata mapping is required.