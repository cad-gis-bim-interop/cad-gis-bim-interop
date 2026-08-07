---
title: "Extracting IFC Property Sets with ifcopenshell"
description: "Read IFC property sets and quantity sets with ifcopenshell.util.element.get_psets, flatten them per element by GlobalId, and serialize to JSON or Parquet for GIS and database ingestion."
slug: "extracting-ifc-property-sets-with-ifcopenshell"
breadcrumb:
  - label: "Python Parsing & Geometry Extraction"
    url: "/python-parsing-geometry-extraction/"
  - label: "ifcopenshell Workflow"
    url: "/python-parsing-geometry-extraction/ifcopenshell-workflow/"
  - label: "Extracting IFC Property Sets with ifcopenshell"
    url: "/python-parsing-geometry-extraction/ifcopenshell-workflow/extracting-ifc-property-sets-with-ifcopenshell/"
datePublished: "2026-07-11"
dateModified: "2026-07-11"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Extracting IFC Property Sets with ifcopenshell",
      "description": "Read IFC property sets and quantity sets with ifcopenshell.util.element.get_psets, flatten them per element by GlobalId, and serialize to JSON or Parquet for GIS and database ingestion.",
      "datePublished": "2026-07-11",
      "dateModified": "2026-07-11",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/extracting-ifc-property-sets-with-ifcopenshell/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Python Parsing & Geometry Extraction", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/"},
        {"@type": "ListItem", "position": 2, "name": "ifcopenshell Workflow", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/"},
        {"@type": "ListItem", "position": 3, "name": "Extracting IFC Property Sets with ifcopenshell", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/extracting-ifc-property-sets-with-ifcopenshell/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Extracting IFC Property Sets with ifcopenshell",
      "description": "Read and flatten IFC property sets and quantity sets per element, keyed by GlobalId, and serialize the result.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Open the IFC model and enumerate elements", "text": "Open the file with ifcopenshell.open() and query the element classes you need, typically subtypes of IfcElement."},
        {"@type": "HowToStep", "position": 2, "name": "Read property sets with get_psets", "text": "Call ifcopenshell.util.element.get_psets(element) to obtain a nested dict of {pset_name: {property: value}}, including inherited type-level property sets."},
        {"@type": "HowToStep", "position": 3, "name": "Read quantity sets separately", "text": "Call get_psets(element, qtos_only=True) to isolate Qto_ quantity sets from descriptive Psets."},
        {"@type": "HowToStep", "position": 4, "name": "Flatten to a wide record", "text": "Drop the internal id key, prefix each property with its set name, and build one flat dict per element keyed by GlobalId."},
        {"@type": "HowToStep", "position": 5, "name": "Serialize to JSON or Parquet", "text": "Write the flattened records to newline-delimited JSON or, with pandas and pyarrow, to a columnar Parquet table for database ingestion."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Why does each property set dict contain an id key?",
          "acceptedAnswer": {"@type": "Answer", "text": "get_psets injects an id key holding the STEP line number of the IfcPropertySet or IfcElementQuantity itself. It is metadata, not a property. Drop keys named id before flattening, or you will emit a spurious integer column per set."}
        },
        {
          "@type": "Question",
          "name": "Does get_psets include type-level property sets?",
          "acceptedAnswer": {"@type": "Answer", "text": "Yes. With should_inherit left at its default of True, get_psets merges property sets attached to the element's IfcTypeObject with those attached to the instance. Instance values override type values on key collisions. Pass should_inherit=False to read only instance-level sets."}
        },
        {
          "@type": "Question",
          "name": "How do I separate quantities from descriptive properties?",
          "acceptedAnswer": {"@type": "Answer", "text": "Call get_psets(element, psets_only=True) for IfcPropertySet data and get_psets(element, qtos_only=True) for IfcElementQuantity data. Quantity sets are conventionally named with a Qto_ prefix and carry lengths, areas, and volumes in the project's base units."}
        },
        {
          "@type": "Question",
          "name": "What units do quantity values use?",
          "acceptedAnswer": {"@type": "Answer", "text": "get_psets returns the raw stored magnitude, not a unit. Read ifcopenshell.util.unit.calculate_unit_scale(model) to convert length quantities to meters, and remember area and volume scale by the square and cube of that factor respectively."}
        }
      ]
    }
  ]
}
</script>

# Extracting IFC Property Sets with ifcopenshell

The direct answer: call `ifcopenshell.util.element.get_psets(element)` on any element and you receive a nested dictionary of the shape `{pset_name: {property_name: value}}`, with descriptive property sets and `Qto_` quantity sets both resolved into plain Python types. This helper walks the `IsDefinedBy` relationship chain for you, unwraps typed IFC values, and — with its default settings — merges property sets inherited from the element's type definition. It replaces dozens of lines of brittle manual traversal. For the wider set of parsing and geometry tasks this fits into, see the [ifcopenshell Workflow](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/) guide.

---

## How ifcopenshell Handles Property Sets

In the IFC schema, properties are not stored on an element as ordinary attributes. They hang off it through an objectified relationship. An `IfcElement` carries an inverse attribute `IsDefinedBy`, which points to one or more `IfcRelDefinesByProperties` relationships; each of those references an `IfcPropertySet` (for descriptive data) or an `IfcElementQuantity` (for measured quantities). The property set, in turn, holds a list of `HasProperties`, and each property is itself a typed entity.

Traversing that chain by hand is where most extraction code goes wrong. `ifcopenshell.util.element.get_psets(element)` does the traversal and returns a dictionary. A single external wall might resolve to:

<!-- fig:pset-relationship-graph -->
<svg viewBox="-20 -33.5 548.7 101.7" role="img" aria-label="An element links to a property set through an objectified relationship, and the set holds the individual properties" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:549px;display:block;margin:1.5rem auto;">
  <title>Properties hang off an element through a relationship</title>
  <desc>The traversal from an element to a value. Properties are not attributes of the element: an objectified relationship links the element to a property set, and the set holds the individual properties. The utility that returns a nested dictionary walks this chain for you, which is why it also picks up type-level sets that a hand-written traversal of the instance usually misses.</desc>
  <defs>
    <marker id="ips1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ips1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-33.5" width="548.7" height="101.7" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="88.4" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="44.2" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">IfcElement</text>
  <text x="44.2" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">the product</text>
  <rect x="122.4" y="0" width="102.5" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="173.7" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">IfcRelDefines</text>
  <text x="173.7" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">ByProperties</text>
  <rect x="258.9" y="0" width="109.8" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="313.8" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">IfcPropertySet</text>
  <text x="313.8" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">HasProperties</text>
  <rect x="402.7" y="0" width="106" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="455.7" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Name / value</text>
  <text x="455.7" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">EXPRESS-typed</text>
  <line x1="88.4" y1="24.1" x2="122.4" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#ips1-a)"/>
  <text x="105.4" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">IsDefinedBy</text>
  <line x1="224.9" y1="24.1" x2="258.9" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#ips1-a)"/>
  <text x="241.9" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">RelatingPropertyDefinition</text>
  <line x1="368.7" y1="24.1" x2="402.7" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#ips1-a)"/>
  <text x="385.7" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">per property</text>
</svg>
<!-- /fig:pset-relationship-graph -->

```python
{
    "Pset_WallCommon": {"id": 1423, "FireRating": "REI60", "IsExternal": True},
    "Qto_WallBaseQuantities": {"id": 1487, "Length": 5400.0, "NetVolume": 1.62},
}
```

Two things about that result surprise people. First, every inner dict contains an `id` key holding the STEP line number of the `IfcPropertySet` or `IfcElementQuantity` — useful for round-tripping, but noise when you flatten. Second, the values are already native Python types: the helper unwraps the `IfcLabel`, `IfcBoolean`, and `IfcVolumeMeasure` wrappers so you never touch `.wrappedValue`.

What the API does **not** do:

- It does not attach units. `NetVolume` above is a bare `1.62` — a magnitude in the file's native unit, not a `pint`-style quantity.
- It does not, by default, separate quantities from descriptive properties. Pass `psets_only=True` or `qtos_only=True` to split them.
- It does not fully flatten every exotic property type. `IfcPropertyTableValue` and deeply nested `IfcComplexProperty` structures need the `verbose=True` mode or a manual fallback (covered below).

The property types you will meet, in rough order of frequency:

- **`IfcPropertySingleValue`** — one `NominalValue`. The common case; flattens to a scalar.
- **`IfcPropertyEnumeratedValue`** — a chosen set of values from an enumeration; flattens to a list.
- **`IfcPropertyListValue`** — an ordered list of values; flattens to a list.
- **`IfcPropertyTableValue`** — paired `DefiningValues`/`DefinedValues` arrays (a lookup curve); best kept as parallel arrays.
- **`IfcComplexProperty`** — a named group of nested sub-properties; flattens to a nested dict.

The diagram traces the relationship path the helper resolves, including the type-level inheritance branch.

<svg viewBox="0 0 720 250" role="img" aria-label="Relationship path from IfcElement through IsDefinedBy to IfcPropertySet, with an inherited branch through the element type" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:720px;display:block;margin:1.5rem auto;">
  <title>IFC property set resolution path</title>
  <desc>An IfcElement links through IsDefinedBy and IfcRelDefinesByProperties to an IfcPropertySet holding single, enumerated, and table properties; a parallel branch inherits property sets from the element's IfcTypeObject via IsTypedBy.</desc>
  <defs>
    <marker id="ps-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" opacity="0.6"/>
    </marker>
  </defs>
  <rect x="0" y="0" width="720" height="250" fill="var(--color-surface)"/>
  <rect x="8" y="98" width="150" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
  <text x="83" y="120" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor">IfcElement</text>
  <text x="83" y="137" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.65">the instance</text>
  <rect x="212" y="98" width="176" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
  <text x="300" y="120" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">IfcRelDefinesByProperties</text>
  <text x="300" y="137" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.65">via IsDefinedBy</text>
  <rect x="446" y="98" width="150" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
  <text x="521" y="120" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor">IfcPropertySet</text>
  <text x="521" y="137" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.65">HasProperties</text>
  <line x1="158" y1="124" x2="208" y2="124" stroke="currentColor" stroke-width="1.5" opacity="0.55" marker-end="url(#ps-arrow)"/>
  <line x1="388" y1="124" x2="442" y2="124" stroke="currentColor" stroke-width="1.5" opacity="0.55" marker-end="url(#ps-arrow)"/>
  <rect x="628" y="70" width="84" height="34" rx="5" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.35"/>
  <text x="670" y="91" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.75">SingleValue</text>
  <rect x="628" y="112" width="84" height="34" rx="5" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.35"/>
  <text x="670" y="133" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.75">Enumerated</text>
  <rect x="628" y="154" width="84" height="34" rx="5" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.35"/>
  <text x="670" y="175" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.75">TableValue</text>
  <line x1="596" y1="120" x2="624" y2="90"  stroke="currentColor" stroke-width="1" opacity="0.4" marker-end="url(#ps-arrow)"/>
  <line x1="596" y1="124" x2="624" y2="128" stroke="currentColor" stroke-width="1" opacity="0.4" marker-end="url(#ps-arrow)"/>
  <line x1="596" y1="128" x2="624" y2="168" stroke="currentColor" stroke-width="1" opacity="0.4" marker-end="url(#ps-arrow)"/>
  <rect x="212" y="14" width="176" height="48" rx="6" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="5,4" opacity="0.4"/>
  <text x="300" y="34" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor" opacity="0.8">IfcTypeObject</text>
  <text x="300" y="51" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.6">inherited via IsTypedBy</text>
  <line x1="83" y1="98" x2="83" y2="38" stroke="currentColor" stroke-width="1" stroke-dasharray="4,3" opacity="0.45"/>
  <line x1="83" y1="38" x2="208" y2="38" stroke="currentColor" stroke-width="1" stroke-dasharray="4,3" opacity="0.45" marker-end="url(#ps-arrow)"/>
  <line x1="388" y1="38" x2="521" y2="38" stroke="currentColor" stroke-width="1" stroke-dasharray="4,3" opacity="0.45"/>
  <line x1="521" y1="38" x2="521" y2="94" stroke="currentColor" stroke-width="1" stroke-dasharray="4,3" opacity="0.45" marker-end="url(#ps-arrow)"/>
  <text x="360" y="238" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.5">get_psets(element) resolves both the solid instance path and the dashed inherited type path</text>
</svg>

## Production-Ready Script

The script below reads every `IfcElement`, merges descriptive and quantity sets into one wide record per element keyed by `GlobalId`, and writes newline-delimited JSON. If `pandas` and `pyarrow` are present it also writes a columnar Parquet file, which is the better target for a warehouse or PostGIS staging table.

```python
# ifcopenshell>=0.8.0, Python 3.9+
import ifcopenshell
import ifcopenshell.util.element
import ifcopenshell.util.unit
import json
from pathlib import Path
from typing import Any


def _clean_set(props: dict) -> dict:
    """Drop the internal 'id' key that get_psets injects per set."""
    return {k: v for k, v in props.items() if k != "id"}


def _flatten(psets: dict, qtos: dict) -> dict[str, Any]:
    """
    Merge property sets and quantity sets into one flat dict.
    Keys are 'SetName.PropertyName' so collisions across sets stay distinct.
    List/array values (enumerations, table columns) are preserved as-is.
    """
    flat: dict[str, Any] = {}
    for set_name, props in {**psets, **qtos}.items():
        for prop_name, value in _clean_set(props).items():
            flat[f"{set_name}.{prop_name}"] = value
    return flat


def extract_property_sets(ifc_path: str, element_query: str = "IfcElement") -> list[dict]:
    """
    Extract all property sets and quantity sets for the queried elements.

    Returns one record per element:
        GlobalId (str), IfcType (str), Name (str | None), plus one key
        per flattened 'PsetName.Property' entry.
    """
    model = ifcopenshell.open(ifc_path)

    # Length unit scale: multiply length-type quantities to reach meters.
    # Areas scale by scale**2 and volumes by scale**3 (applied downstream).
    length_scale = ifcopenshell.util.unit.calculate_unit_scale(model)

    records: list[dict] = []
    for element in model.by_type(element_query):
        # psets_only / qtos_only split descriptive data from measured quantities.
        # should_inherit=True (default) folds in the element type's property sets.
        psets = ifcopenshell.util.element.get_psets(element, psets_only=True)
        qtos = ifcopenshell.util.element.get_psets(element, qtos_only=True)

        record: dict[str, Any] = {
            "GlobalId": element.GlobalId,
            "IfcType": element.is_a(),
            "Name": getattr(element, "Name", None),
            "_length_unit_scale": length_scale,
        }
        record.update(_flatten(psets, qtos))
        records.append(record)

    return records


def write_ndjson(records: list[dict], path: str) -> None:
    with open(path, "w", encoding="utf-8") as fh:
        for rec in records:
            fh.write(json.dumps(rec, ensure_ascii=False, default=str) + "\n")


def write_parquet(records: list[dict], path: str) -> bool:
    """Write a columnar Parquet table. Returns False if pandas is unavailable."""
    try:
        import pandas as pd  # pandas>=2.0.0, pyarrow>=14.0.0
    except ImportError:
        return False
    # A sparse, wide schema: every distinct 'Pset.Property' becomes a column.
    # pandas fills absent keys with NaN, which is the correct sparse semantics.
    pd.DataFrame(records).to_parquet(path, engine="pyarrow", index=False)
    return True


if __name__ == "__main__":
    recs = extract_property_sets("model.ifc", element_query="IfcElement")
    print(f"Extracted property data for {len(recs)} elements")

    write_ndjson(recs, "psets.ndjson")
    if write_parquet(recs, "psets.parquet"):
        print("Wrote psets.parquet (columnar)")
    else:
        print("pandas/pyarrow not installed — NDJSON only")
```

Key implementation notes:

- The `_clean_set` helper strips the `id` key. Skip it and every element emits a meaningless integer column such as `Pset_WallCommon.id`, which pollutes both the JSON and the Parquet schema.
- Descriptive and quantity data are read in two calls (`psets_only` and `qtos_only`) rather than one. That keeps a `Qto_` length from silently sharing a column name with a same-named descriptive property, and it lets you apply unit scaling to quantities alone later.
- `default=str` on `json.dumps` is a safety net for the rare property value that resolves to a non-JSON-native type (for example a nested tuple from an `IfcPropertyTableValue`). It serializes deterministically instead of raising.
- The wide, sparse schema is deliberate. Different element classes carry different property sets, so most cells are empty. Parquet stores that sparsity efficiently; a normalized long table (`GlobalId, key, value`) is the alternative when you feed a relational store — see [Mapping IFC Property Sets to PostGIS Columns](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/mapping-ifc-property-sets-to-postgis-columns/) for that shape.

To carry these attributes onto geometry rather than a flat table, pair this extraction with [Batch Converting IFC to GeoJSON with ifcopenshell](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/batch-converting-ifc-to-geojson-with-ifcopenshell/), which attaches the same flattened records as feature properties.

## Compatibility Matrix

| Component | Supported Range | Notes |
|-----------|-----------------|-------|
| Python | 3.9 – 3.12 | Uses PEP 585 builtin generics (`list[dict]`); 3.9 needs `from __future__ import annotations` only for runtime-evaluated hints |
| ifcopenshell | ≥ 0.8.0 | `get_psets` / `get_pset` are stable since 0.7.0; the `verbose`, `psets_only`, `qtos_only`, and `should_inherit` keyword arguments require ≥ 0.7.0 |
| ifcopenshell (0.7.x) | Works | Same `util.element` API; the 0.8 packaging renamed some geometry settings but left `util.element` unchanged |
| pandas | ≥ 2.0.0 | Optional; only needed for the Parquet path |
| pyarrow | ≥ 14.0.0 | Parquet engine; `fastparquet` also works but handles sparse wide frames less predictably |
| IFC schema | IFC2x3, IFC4, IFC4x3 | Property set mechanism is schema-stable; IFC4 adds `IfcElementQuantity` sub-quantity types like `IfcPhysicalComplexQuantity` |

## Fallback Strategies

**1. `IfcPropertyTableValue` collapses to a single value or `None`**

<!-- fig:pset-value-shapes -->
<svg viewBox="-20 -20 453.5 214.1" role="img" aria-label="Single values, enumerated values, list values and table values — the property shapes a flattener must handle" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:454px;display:block;margin:1.5rem auto;">
  <title>The property value shapes a flattener has to survive</title>
  <desc>Four property node types, the shape each returns, and what a flattener that assumes a single scalar does with it. Only the first is a plain value; the other three are lists or tables, and collapsing them to a scalar is a silent data loss that leaves a well-formed record behind.</desc>
  <defs>
    <marker id="ips2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ips2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="453.5" height="214.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="413.5" height="152" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="413.5" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">Property type</text>
  <text x="222.2" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Shape returned</text>
  <line x1="273" y1="0" x2="273" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="343.2" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">If assumed scalar</text>
  <line x1="171.5" y1="0" x2="171.5" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="413.5" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">IfcPropertySingleValue</text>
  <text x="222.2" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">one typed value</text>
  <text x="343.2" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">correct</text>
  <line x1="0" y1="62" x2="413.5" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">IfcPropertyEnumeratedValue</text>
  <text x="222.2" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">a tuple</text>
  <text x="343.2" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">keeps one, drops the rest</text>
  <line x1="0" y1="92" x2="413.5" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">IfcPropertyListValue</text>
  <text x="222.2" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">a list</text>
  <text x="343.2" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">keeps one, drops the rest</text>
  <line x1="0" y1="122" x2="413.5" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="140.5" font-size="10.5" font-weight="600" fill="currentColor">IfcPropertyTableValue</text>
  <text x="222.2" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">paired columns</text>
  <text x="343.2" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">collapses to None</text>
  <text x="0" y="172" font-size="9.5" fill="currentColor" fill-opacity="0.7">Three of the four leave a well-formed record with the data missing.</text>
</svg>
<!-- /fig:pset-value-shapes -->

Table properties store two parallel arrays — `DefiningValues` and `DefinedValues` — that describe a lookup curve (for example, a thermal transmittance against temperature). The flat helper cannot represent both columns as one scalar. Read them directly and keep them as arrays:

```python
# ifcopenshell>=0.8.0
def read_table_properties(element) -> dict[str, dict]:
    tables: dict[str, dict] = {}
    for rel in getattr(element, "IsDefinedBy", []):
        if not rel.is_a("IfcRelDefinesByProperties"):
            continue
        pset = rel.RelatingPropertyDefinition
        if not pset.is_a("IfcPropertySet"):
            continue
        for prop in pset.HasProperties or []:
            if prop.is_a("IfcPropertyTableValue"):
                tables[prop.Name] = {
                    "defining": [v.wrappedValue for v in prop.DefiningValues or []],
                    "defined": [v.wrappedValue for v in prop.DefinedValues or []],
                }
    return tables
```

**2. Nested `IfcComplexProperty` structures flatten ambiguously**

A complex property groups sub-properties under one name. Enable verbose mode so the helper returns nested dicts you can descend into, then decide whether to dot-join the nested keys:

```python
# ifcopenshell>=0.8.0 — verbose returns richer structures for nested properties
psets = ifcopenshell.util.element.get_psets(element, verbose=True)
```

**3. You need only instance properties, not inherited type properties**

By default the helper folds in property sets defined on the element's `IfcTypeObject`. When you are auditing what an author set on the instance itself, disable inheritance:

```python
instance_only = ifcopenshell.util.element.get_psets(element, should_inherit=False)
```

**4. Unit-bearing quantities look thousands of times too large**

`Qto_` lengths are raw magnitudes in the file's native unit. A model authored in millimeters reports a `Length` of `5400.0` for a 5.4 m wall. Apply the scale factor, remembering the exponent for areas and volumes:

```python
# ifcopenshell>=0.8.0
scale = ifcopenshell.util.unit.calculate_unit_scale(model)  # 0.001 for mm
length_m = raw_length * scale
area_m2 = raw_area * scale ** 2
volume_m3 = raw_volume * scale ** 3
```

**5. Fetching one known property is faster than reading every set**

When you need a single value — say `IsExternal` — do not flatten the whole element. Use `get_pset` with the `prop` argument, which returns just that value or `None`:

```python
# ifcopenshell>=0.8.0
is_external = ifcopenshell.util.element.get_pset(
    element, "Pset_WallCommon", prop="IsExternal"
)
```

## FAQ

<details>
<summary><strong>Why does each property set dict contain an id key?</strong></summary>

`get_psets` injects an `id` key holding the STEP line number of the `IfcPropertySet` or `IfcElementQuantity` itself. It is metadata, not a property. Drop keys named `id` before flattening, or you will emit a spurious integer column per set.

</details>

<details>
<summary><strong>Does get_psets include type-level property sets?</strong></summary>

Yes. With `should_inherit` left at its default of `True`, `get_psets` merges property sets attached to the element's `IfcTypeObject` with those attached to the instance. Instance values override type values on key collisions. Pass `should_inherit=False` to read only instance-level sets.

</details>

<details>
<summary><strong>How do I separate quantities from descriptive properties?</strong></summary>

Call `get_psets(element, psets_only=True)` for `IfcPropertySet` data and `get_psets(element, qtos_only=True)` for `IfcElementQuantity` data. Quantity sets are conventionally named with a `Qto_` prefix and carry lengths, areas, and volumes in the project's base units.

</details>

<details>
<summary><strong>What units do quantity values use?</strong></summary>

`get_psets` returns the raw stored magnitude, not a unit. Read `ifcopenshell.util.unit.calculate_unit_scale(model)` to convert length quantities to meters, and remember area and volume scale by the square and cube of that factor respectively.

</details>

---

## Related Pages

- [ifcopenshell Workflow](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/) — parent guide covering the full ifcopenshell API surface for IFC parsing, geometry, and attributes
- [Batch Converting IFC to GeoJSON with ifcopenshell](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/batch-converting-ifc-to-geojson-with-ifcopenshell/) — attach these flattened property records to element footprints as GeoJSON feature properties
- [Extracting IFC Wall Geometries to Shapely](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/extracting-ifc-wall-geometries-to-shapely/) — sibling workflow that produces the geometry these attributes describe
- [Mapping IFC Property Sets to PostGIS Columns](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/mapping-ifc-property-sets-to-postgis-columns/) — turning the wide extract into a normalized relational schema for spatial queries
