---
title: "Mapping IFC Property Sets to PostGIS Columns"
description: "Flatten IFC property sets into a PostGIS model: stable core columns, a JSONB pset column, a 3D geometry column, and inserts with GIN and GiST indexes."
slug: "mapping-ifc-property-sets-to-postgis-columns"
breadcrumb:
  - label: "Core Format Fundamentals & Schema Mapping"
    url: "/core-format-fundamentals-schema-mapping/"
  - label: "IFC4x3 Schema Mapping"
    url: "/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/"
  - label: "Mapping IFC Property Sets to PostGIS Columns"
    url: "/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/mapping-ifc-property-sets-to-postgis-columns/"
datePublished: "2026-07-11"
dateModified: "2026-07-11"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Mapping IFC Property Sets to PostGIS Columns",
      "description": "Flatten IFC property sets into a PostGIS model: stable core columns, a JSONB pset column, a 3D geometry column, and inserts with GIN and GiST indexes.",
      "datePublished": "2026-07-11",
      "dateModified": "2026-07-11",
      "author": {"@type": "Organization", "name": "CAD GIS BIM Interop"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/mapping-ifc-property-sets-to-postgis-columns/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Core Format Fundamentals & Schema Mapping", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/"},
        {"@type": "ListItem", "position": 2, "name": "IFC4x3 Schema Mapping", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/"},
        {"@type": "ListItem", "position": 3, "name": "Mapping IFC Property Sets to PostGIS Columns", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/mapping-ifc-property-sets-to-postgis-columns/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Mapping IFC Property Sets to PostGIS Columns",
      "description": "Flatten ifcopenshell property sets into a PostGIS table with stable core columns, a JSONB pset column, and a projected geometry column.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Read property sets", "text": "Call ifcopenshell.util.element.get_psets(element) to flatten every attached property set and quantity set into nested Python dicts."},
        {"@type": "HowToStep", "position": 2, "name": "Design the relational shape", "text": "Define a stable core-columns table (GlobalId, IfcClass, Name) plus a JSONB column for variable property sets or one typed column per whitelisted property."},
        {"@type": "HowToStep", "position": 3, "name": "Declare the geometry column", "text": "Create a geometry(GeometryZ, srid) column so the projected 3D footprint is stored with an explicit SRID."},
        {"@type": "HowToStep", "position": 4, "name": "Insert with psycopg2", "text": "Insert rows with psycopg2, passing the JSONB payload via Json() and the geometry via ST_GeomFromWKB on the element's WKB."},
        {"@type": "HowToStep", "position": 5, "name": "Index for query", "text": "Add a GIN index on the JSONB column and a GiST index on the geometry column so property and spatial filters both stay fast."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Should IFC property sets go into JSONB or typed columns in PostGIS?",
          "acceptedAnswer": {"@type": "Answer", "text": "Use JSONB for the wide, variable set of producer-specific property sets, and promote a small whitelist of frequently-queried properties into typed columns. This hybrid keeps the schema stable against pset drift while letting hot filters use B-tree indexes. A GIN index on the JSONB column keeps containment queries fast."}
        },
        {
          "@type": "Question",
          "name": "How do I preserve units when flattening IFC properties?",
          "acceptedAnswer": {"@type": "Answer", "text": "IFC property values are unit-bearing: a length is expressed in the model's project unit, not necessarily metres. Read the unit assignment from the IFC file and either normalise every value to SI before insert or store the unit string alongside the value in JSONB. Storing a bare number without its unit corrupts any downstream aggregation."}
        },
        {
          "@type": "Question",
          "name": "What SRID should the PostGIS geometry column use?",
          "acceptedAnswer": {"@type": "Answer", "text": "Use the projected CRS you reprojected the IFC coordinates into, not a placeholder. IFC geometry is in a local engineering coordinate system; you must georeference and reproject it first, then declare the resulting EPSG code as the column SRID so ST_Transform and spatial joins behave correctly."}
        }
      ]
    }
  ]
}
</script>

# Mapping IFC Property Sets to PostGIS Columns

To map IFC property sets into PostGIS, flatten each element's property sets with `ifcopenshell.util.element.get_psets()`, then load them into a table that pairs a small set of stable core columns (`global_id`, `ifc_class`, `name`) with a single `JSONB` column holding the variable property sets — plus a `geometry(GeometryZ, <srid>)` column for the projected footprint. This hybrid layout survives the schema drift that makes one-column-per-property designs brittle, while still letting you promote a whitelist of hot properties into typed columns. This page extends the [IFC4x3 Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/) reference into the persistence layer, where flattened building data becomes a queryable spatial database.

## How ifcopenshell Handles Property Sets

An IFC element carries its descriptive data in property sets (`IfcPropertySet`) and quantity sets (`IfcElementQuantity`), each a named bag of key/value properties attached through inverse relationships. Traversing those relationships by hand is verbose, so `ifcopenshell.util.element.get_psets(element)` does it for you: it returns a dict keyed by pset name, whose values are dicts of property name to value. A wall might return `{"Pset_WallCommon": {"IsExternal": True, "FireRating": "REI 60"}, "Qto_WallBaseQuantities": {"NetVolume": 4.2}}`.

The problem is that this shape is unbounded and producer-dependent. Revit, ArchiCAD, Civil 3D, and infrastructure authoring tools each emit different pset names, and IFC4x3 adds infrastructure-specific sets that never appear in a building model. A relational schema with one column per property would need hundreds of nullable columns and would break every time a new authoring tool appeared. The durable answer is to keep a stable spine — the handful of columns every element has — and store the variable remainder as `JSONB`, which PostGIS/PostgreSQL can index and query with containment operators.

<!-- fig:pset-column-strategy -->
<svg viewBox="-20 -20 570 194.1" role="img" aria-label="Typed columns give constraints but need migrations; JSONB absorbs schema drift — a stable typed core plus JSONB carries both" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:570px;display:block;margin:1.5rem auto;">
  <title>Typed columns versus a JSONB payload for property sets</title>
  <desc>Two table designs for the same data. Typed columns give constraints, indexes and query plans a planner can reason about, but every new property set is a migration. A JSONB payload absorbs schema drift without migrations at the cost of weaker typing. The pattern that survives contact with real models is both: a small stable core of typed columns plus JSONB for the long tail.</desc>
  <defs>
    <marker id="pg1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="pg1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="570" height="194.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="250" height="130" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="125" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Typed columns</text>
  <line x1="14" y1="33" x2="236" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="16" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— constraints and defaults</text>
  <text x="16" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— plannable, indexable</text>
  <text x="16" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— every new pset is a migration</text>
  <text x="16" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— breaks on model variety</text>
  <rect x="280" y="0" width="250" height="130" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="405" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">JSONB payload</text>
  <line x1="294" y1="33" x2="516" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="296" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— absorbs unknown psets</text>
  <text x="296" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— GIN index for containment</text>
  <text x="296" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— no type guarantees</text>
  <text x="296" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— no migration on drift</text>
  <text x="265" y="152" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">Ship both: a typed core for what every model has, JSONB for the tail.</text>
</svg>
<!-- /fig:pset-column-strategy -->

<svg viewBox="0 0 720 320" role="img" aria-label="IFC element mapped into a PostGIS row: core attributes become typed columns, property sets become a JSONB column, and reprojected geometry becomes a geometry column" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:720px;display:block;margin:1.5rem auto;">
  <title>Flattening an IFC Element into a Hybrid PostGIS Row</title>
  <desc>Diagram: an IFC element on the left fans out into three targets. Its GlobalId, class, and name become stable typed columns; its property sets are flattened by get_psets into a JSONB column indexed with GIN; its reprojected shape becomes a geometry column indexed with GiST.</desc>
  <defs>
    <marker id="ip" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor"/>
    </marker>
  </defs>
  <rect x="0" y="0" width="720" height="320" fill="var(--color-surface)"/>
  <rect x="16" y="126" width="150" height="68" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="91" y="152" text-anchor="middle" font-size="12" fill="currentColor">IFC Element</text>
  <text x="91" y="170" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">IfcWall, IfcSlab...</text>
  <line x1="166" y1="160" x2="238" y2="60" stroke="currentColor" stroke-width="1.5" marker-end="url(#ip)"/>
  <line x1="166" y1="160" x2="238" y2="160" stroke="currentColor" stroke-width="1.5" marker-end="url(#ip)"/>
  <line x1="166" y1="160" x2="238" y2="260" stroke="currentColor" stroke-width="1.5" marker-end="url(#ip)"/>
  <rect x="240" y="30" width="270" height="60" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.85"/>
  <text x="375" y="54" text-anchor="middle" font-size="11" fill="currentColor">Core typed columns</text>
  <text x="375" y="72" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">global_id, ifc_class, name</text>
  <rect x="240" y="130" width="270" height="60" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.85"/>
  <text x="375" y="154" text-anchor="middle" font-size="11" fill="currentColor">JSONB psets column</text>
  <text x="375" y="172" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">get_psets(element)</text>
  <rect x="240" y="230" width="270" height="60" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.85"/>
  <text x="375" y="254" text-anchor="middle" font-size="11" fill="currentColor">geometry(GeometryZ, srid)</text>
  <text x="375" y="272" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">reprojected WKB</text>
  <line x1="510" y1="160" x2="576" y2="160" stroke="currentColor" stroke-width="1.5" marker-end="url(#ip)"/>
  <rect x="578" y="126" width="126" height="68" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="641" y="150" text-anchor="middle" font-size="12" fill="currentColor">PostGIS</text>
  <text x="641" y="168" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">GIN + GiST</text>
  <text x="641" y="182" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">indexes</text>
</svg>

The geometry side is separate but equally important: IFC coordinates live in a local engineering system, so the shape must be georeferenced and reprojected before it lands in a `geometry(GeometryZ, <srid>)` column. That reprojection is a full workflow of its own, covered by the [ifcopenshell Workflow](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/) extraction pipeline; here we assume you already have a WKB payload in the target CRS and focus on the relational load.

## Production-Ready Script

This script reads elements from an IFC model, flattens their property sets, builds a stable core row plus a `JSONB` pset payload, and inserts into a PostGIS table with a projected geometry column. It uses `psycopg2` with `execute_values` for batched inserts and passes geometry as WKB through `ST_GeomFromWKB`.

```python
# ifcopenshell>=0.8.0 | psycopg2>=2.9 | PostGIS 3.x | python>=3.9
import ifcopenshell
import ifcopenshell.geom
import ifcopenshell.util.element as ue
import psycopg2
from psycopg2.extras import Json, execute_values
from typing import Any, Iterator

TARGET_SRID = 27700  # projected CRS you reprojected IFC coords into; not a placeholder

DDL = """
CREATE TABLE IF NOT EXISTS ifc_elements (
    id          BIGSERIAL PRIMARY KEY,
    global_id   TEXT UNIQUE NOT NULL,
    ifc_class   TEXT NOT NULL,
    name        TEXT,
    psets       JSONB NOT NULL DEFAULT '{}'::jsonb,
    geom        geometry(GeometryZ, %(srid)s)
);
CREATE INDEX IF NOT EXISTS ifc_elements_psets_gin ON ifc_elements USING GIN (psets);
CREATE INDEX IF NOT EXISTS ifc_elements_geom_gist ON ifc_elements USING GIST (geom);
"""

INSERT_SQL = """
INSERT INTO ifc_elements (global_id, ifc_class, name, psets, geom)
VALUES %s
ON CONFLICT (global_id) DO UPDATE
    SET psets = EXCLUDED.psets, geom = EXCLUDED.geom
"""

# execute_values template: geometry passed as WKB bytes -> ST_GeomFromWKB.
TEMPLATE = "(%s, %s, %s, %s, ST_SetSRID(ST_GeomFromWKB(%s), %s))"


def build_rows(ifc_path: str) -> Iterator[tuple[Any, ...]]:
    """Yield insert-ready rows (global_id, ifc_class, name, Json(psets), wkb)."""
    model = ifcopenshell.open(ifc_path)
    settings = ifcopenshell.geom.settings()
    # Emit geometry in world coordinates so the WKB is placement-resolved.
    settings.set(settings.USE_WORLD_COORDS, True)

    for element in model.by_type("IfcProduct"):
        if element.Representation is None:
            continue  # spatial containers without shape are skipped

        # Flatten every property/quantity set into nested dicts.
        psets = ue.get_psets(element)

        # Try to build WKB; some elements have no valid body representation.
        wkb: bytes | None = None
        try:
            shape = ifcopenshell.geom.create_shape(settings, element)
            wkb = shape.geometry.brep_data  # placeholder; see note on WKB below
        except RuntimeError:
            wkb = None

        yield (
            element.GlobalId,
            element.is_a(),
            getattr(element, "Name", None),
            Json(psets),
            psycopg2.Binary(wkb) if wkb is not None else None,
        )


def load_to_postgis(ifc_path: str, dsn: str) -> None:
    conn = psycopg2.connect(dsn)
    try:
        with conn, conn.cursor() as cur:
            cur.execute(DDL, {"srid": TARGET_SRID})
            rows = list(build_rows(ifc_path))
            # Append the SRID to each row for the ST_SetSRID call in TEMPLATE.
            values = [(gid, cls, name, js, wkb, TARGET_SRID)
                      for (gid, cls, name, js, wkb) in rows]
            execute_values(cur, INSERT_SQL, values, template=TEMPLATE, page_size=500)
        print(f"Loaded {len(rows)} IFC elements into PostGIS (SRID {TARGET_SRID}).")
    finally:
        conn.close()


if __name__ == "__main__":
    load_to_postgis(
        "model.ifc",
        "dbname=gis user=gis password=gis host=localhost port=5432",
    )
```

**Key implementation notes:**

- `get_psets(element)` returns nested dicts that map cleanly to `JSONB` — pass them through `psycopg2.extras.Json` so quoting and escaping are handled by the driver, never by string formatting.
- `ON CONFLICT (global_id) DO UPDATE` makes the load idempotent: re-running an updated model refreshes existing rows instead of raising a unique-violation, which matters for incremental digital-twin syncs.
- The geometry is passed as WKB bytes and wrapped in `ST_SetSRID(ST_GeomFromWKB(...))`. Producing correct 3D WKB from an IFC shape is the extraction step's job; the `brep_data` line above is a placeholder for whatever WKB serializer your pipeline uses (for example, building a Shapely/`geoalchemy2` geometry from the triangulated verts and exporting `wkb`).
- Create the GIN index on `psets` and the GiST index on `geom` up front. Without the GIN index, `psets @> '{"Pset_WallCommon": {"IsExternal": true}}'` degrades to a full scan on large models.
- `execute_values` with `page_size=500` batches inserts into few round-trips; for models with hundreds of thousands of elements, prefer `COPY` into a staging table then `INSERT ... SELECT`.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `ifcopenshell` | `>=0.8.0` | `ifcopenshell.util.element.get_psets` is stable; 0.8+ has the current `geom.settings` API. |
| `psycopg2` | `>=2.9` | `Json` and `execute_values` live in `psycopg2.extras`; 2.9+ for modern PostgreSQL. |
| PostGIS | `3.x` | `geometry(GeometryZ, srid)`, `ST_GeomFromWKB`, GIN/GiST indexing all present. |
| PostgreSQL | `12+` | `JSONB` and GIN operator classes; 12+ for generated columns if you promote properties. |
| Python | `3.9+` | Uses typing and dict-ordering guarantees. |
| IFC schema | IFC2x3, IFC4, IFC4x3 | `get_psets` works across schemas; IFC4x3 adds infrastructure-specific psets. |

## Fallback Strategies

**1. Schema drift: JSONB versus typed columns**

<!-- fig:pset-load-path -->
<svg viewBox="-45 -20 475.9 310.8" role="img" aria-label="Read elements, flatten property sets, split into typed core and JSONB, then insert in batches within one transaction" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:476px;display:block;margin:1.5rem auto;">
  <title>The load path from an IFC element to a PostGIS row</title>
  <desc>Four stages. Elements are read from the model, their property sets are flattened into one record each, the record is split into the stable core columns and a JSONB remainder, and rows are inserted in batches inside one transaction. Batching matters because a per-element insert spends its time on round trips rather than on the database.</desc>
  <defs>
    <marker id="pg2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="pg2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-45" y="-20" width="475.9" height="310.8" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="258" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="129" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Read elements</text>
  <text x="129" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">by_type(&quot;IfcElement&quot;)</text>
  <circle cx="-14" cy="24.1" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="27.6" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">1</text>
  <text x="276" y="27.6" font-size="9.5" fill="currentColor" fill-opacity="0.75">one pass over the model</text>
  <rect x="0" y="74.2" width="258" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="129" y="94.5" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Flatten psets</text>
  <text x="129" y="108.2" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">get_psets(element)</text>
  <circle cx="-14" cy="98.3" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="101.8" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">2</text>
  <text x="276" y="101.8" font-size="9.5" fill="currentColor" fill-opacity="0.75">one record per GlobalId</text>
  <rect x="0" y="148.4" width="258" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="129" y="168.7" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Split core / JSONB</text>
  <text x="129" y="182.4" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">stable columns first</text>
  <circle cx="-14" cy="172.5" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="176" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">3</text>
  <text x="276" y="176" font-size="9.5" fill="currentColor" fill-opacity="0.75">GlobalId is the key</text>
  <rect x="0" y="222.6" width="258" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="129" y="242.9" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Batch insert</text>
  <text x="129" y="256.6" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">one transaction</text>
  <circle cx="-14" cy="246.7" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="250.2" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">4</text>
  <text x="276" y="250.2" font-size="9.5" fill="currentColor" fill-opacity="0.75">round trips dominate otherwise</text>
  <line x1="129" y1="48.2" x2="129" y2="74.2" stroke="currentColor" stroke-width="1.4" marker-end="url(#pg2-a)"/>
  <line x1="129" y1="122.4" x2="129" y2="148.4" stroke="currentColor" stroke-width="1.4" marker-end="url(#pg2-a)"/>
  <line x1="129" y1="196.6" x2="129" y2="222.6" stroke="currentColor" stroke-width="1.4" marker-end="url(#pg2-a)"/>
</svg>
<!-- /fig:pset-load-path -->

New authoring tools introduce new pset names on every project. Keep the variable remainder in `JSONB` so a new pset never requires a migration, and promote only a stable whitelist of hot properties (for example `IsExternal`, `FireRating`, `LoadBearing`) into typed columns via generated columns or an ETL step. This hybrid gives B-tree speed on hot filters and drift-tolerance everywhere else.

**2. Unit-bearing values**

An IFC length or area is expressed in the project's declared unit, which is not always metres. Read the `IfcUnitAssignment` and either normalise every quantity to SI before insert or store the unit string next to the value inside `JSONB`. A bare number with no unit silently corrupts every downstream `SUM` and comparison.

**3. Type coercion into JSONB**

IFC property values arrive as booleans, enumerations, measures, and occasionally lists. `JSONB` preserves booleans and numbers natively, but IFC enum tokens and `ifcopenshell` measure wrappers must be coerced to plain Python scalars first, or `Json()` will serialize an opaque repr. Normalise values in a small helper before building the payload.

**4. SRID declaration and reprojection**

Declaring the column as `geometry(GeometryZ, <srid>)` does not reproject anything — it only asserts the CRS of the bytes you insert. IFC geometry is local; georeference and reproject it into the target EPSG code first, then insert. Mismatched SRIDs make `ST_Transform` and spatial joins fail silently or raise. See the georeferencing steps in the extraction workflow before loading.

**5. Elements without geometry**

Spatial-structure elements (`IfcBuildingStorey`, `IfcSpace` boundaries) and abstract products may have no body representation. Insert them with a `NULL` geometry rather than skipping them, so property queries still find them, and let the GiST index simply omit the null rows.

## FAQ

<details>
<summary><strong>Should IFC property sets go into JSONB or typed columns in PostGIS?</strong></summary>

Use `JSONB` for the wide, variable set of producer-specific property sets, and promote a small whitelist of frequently-queried properties into typed columns. This hybrid keeps the schema stable against pset drift while letting hot filters use B-tree indexes. A GIN index on the `JSONB` column keeps containment queries such as `psets @> '{...}'` fast without a migration every time a new authoring tool appears.

</details>

<details>
<summary><strong>How do I preserve units when flattening IFC properties?</strong></summary>

IFC property values are unit-bearing: a length is expressed in the model's declared project unit, not necessarily metres. Read the `IfcUnitAssignment` from the file and either normalise every value to SI before insert or store the unit string alongside the value in `JSONB`. Storing a bare number without its unit corrupts any downstream aggregation or comparison.

</details>

<details>
<summary><strong>What SRID should the PostGIS geometry column use?</strong></summary>

Use the projected CRS you reprojected the IFC coordinates into, never a placeholder like 0 or 4326-by-default. IFC geometry is in a local engineering coordinate system; georeference and reproject it first, then declare the resulting EPSG code as the column SRID so `ST_Transform`, distance queries, and spatial joins all behave correctly.

</details>

---

## Related Pages

- [IFC4x3 Schema Mapping](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/) — parent reference on the IFC4x3 data model and how classes and property sets are structured
- [Mapping IFC Properties to GeoJSON Attributes](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/mapping-ifc-properties-to-geojson-attributes/) — sibling workflow that flattens the same property sets into a flat-file GIS target instead of a database
- [ifcopenshell Workflow](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/) — related reference covering IFC geometry extraction and georeferencing that produces the WKB loaded here
- [Metadata Extraction Strategies](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/) — broader patterns for turning embedded model metadata into queryable attributes
