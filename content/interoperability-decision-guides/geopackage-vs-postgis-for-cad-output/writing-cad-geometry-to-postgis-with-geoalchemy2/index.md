---
title: "Writing CAD Geometry to PostGIS with GeoAlchemy2"
description: "Write converted CAD geometry to PostGIS with SQLAlchemy and GeoAlchemy2: define a Geometry column, convert shapely geoms, bulk insert, and build a GiST index."
slug: "writing-cad-geometry-to-postgis-with-geoalchemy2"
breadcrumb:
  - label: "Interoperability Decision Guides"
    url: "/interoperability-decision-guides/"
  - label: "GeoPackage vs PostGIS for CAD Output"
    url: "/interoperability-decision-guides/geopackage-vs-postgis-for-cad-output/"
  - label: "Writing CAD Geometry to PostGIS with GeoAlchemy2"
    url: "/interoperability-decision-guides/geopackage-vs-postgis-for-cad-output/writing-cad-geometry-to-postgis-with-geoalchemy2/"
datePublished: "2026-07-11"
dateModified: "2026-07-11"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Writing CAD Geometry to PostGIS with GeoAlchemy2",
      "description": "Write converted CAD geometry to PostGIS with SQLAlchemy and GeoAlchemy2: define a Geometry column, convert shapely geoms, bulk insert, and build a GiST index.",
      "datePublished": "2026-07-11",
      "dateModified": "2026-07-11",
      "author": {"@type": "Organization", "name": "CAD GIS BIM Interop"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/geopackage-vs-postgis-for-cad-output/writing-cad-geometry-to-postgis-with-geoalchemy2/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Interoperability Decision Guides", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/"},
        {"@type": "ListItem", "position": 2, "name": "GeoPackage vs PostGIS for CAD Output", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/geopackage-vs-postgis-for-cad-output/"},
        {"@type": "ListItem", "position": 3, "name": "Writing CAD Geometry to PostGIS with GeoAlchemy2", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/geopackage-vs-postgis-for-cad-output/writing-cad-geometry-to-postgis-with-geoalchemy2/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Write CAD Geometry to PostGIS with GeoAlchemy2",
      "description": "Define a SQLAlchemy model with a GeoAlchemy2 Geometry column, convert shapely geometries with from_shape, bulk insert, and create a GiST index.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Create the engine", "text": "Build a SQLAlchemy 2.0 engine pointing at the PostGIS database."},
        {"@type": "HowToStep", "position": 2, "name": "Define the model", "text": "Declare an ORM model whose geometry column is Geometry('GEOMETRYZ', srid=...) with the correct type and SRID."},
        {"@type": "HowToStep", "position": 3, "name": "Convert and bulk insert", "text": "Convert each shapely geometry with geoalchemy2.shape.from_shape(geom, srid=...) and insert rows in batches within a transaction."},
        {"@type": "HowToStep", "position": 4, "name": "Create the GiST index", "text": "After the bulk load, create a GiST index on the geometry column and run ANALYZE."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Why must I pass the SRID to from_shape?",
          "acceptedAnswer": {"@type": "Answer", "text": "Shapely geometries carry no SRID — they are pure coordinates. PostGIS geometry columns are typed with an SRID, and inserting a geometry whose SRID is 0 into an SRID-27700 column raises a constraint error. from_shape(geom, srid=27700) stamps the SRID onto the WKB element so it matches the column definition."}
        },
        {
          "@type": "Question",
          "name": "When should I use to_postgis instead of a GeoAlchemy2 model?",
          "acceptedAnswer": {"@type": "Answer", "text": "Use GeoDataFrame.to_postgis for a quick load when you do not need explicit column typing or custom batching. Use an explicit GeoAlchemy2 model when you need a declared GEOMETRYZ column, control over batch size and transactions, upsert semantics, or integration with an existing ORM schema."}
        },
        {
          "@type": "Question",
          "name": "How do I store 3D CAD geometry in PostGIS?",
          "acceptedAnswer": {"@type": "Answer", "text": "Declare the column as Geometry('GEOMETRYZ', srid=..., dimension=3) and pass shapely geometries that carry Z coordinates. Inserting 3D geometry into a 2D column drops the Z ordinate. Confirm with ST_NDims on a sample row that the stored geometry reports three dimensions."}
        }
      ]
    }
  ]
}
</script>

# Writing CAD Geometry to PostGIS with GeoAlchemy2

To write converted CAD geometry to PostGIS with GeoAlchemy2, define a SQLAlchemy model whose geometry column is `Geometry('GEOMETRYZ', srid=...)`, convert each shapely geometry to a database value with `geoalchemy2.shape.from_shape(geom, srid=...)`, bulk-insert the rows inside a transaction, and create a GiST spatial index after the load. This gives you explicit control over geometry type, SRID, and batching that the one-line `GeoDataFrame.to_postgis` shortcut does not. This page is the detailed server-write path for the [GeoPackage vs PostGIS for CAD Output](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/geopackage-vs-postgis-for-cad-output/) decision guide, which covers when PostGIS is the right target in the first place.

## How GeoAlchemy2 Handles PostGIS Geometry

GeoAlchemy2 extends SQLAlchemy with a `Geometry` column type that maps to a PostGIS geometry column. When you declare `Geometry("GEOMETRYZ", srid=27700)`, the emitted DDL creates a column constrained to 3D geometry in the British National Grid SRID, and PostGIS enforces both the geometry type and the SRID on every insert.

The bridge from shapely to the database is `geoalchemy2.shape.from_shape(geom, srid=...)`. Shapely geometries are pure coordinate objects with no SRID; `from_shape` serialises the geometry to Extended Well-Known Binary and stamps the SRID onto it, producing a `WKBElement` that SQLAlchemy binds as the column value. The reverse — `to_shape` — turns a queried `WKBElement` back into a shapely geometry. GeoAlchemy2 does not reproject, validate, or repair geometry; it is a faithful type bridge, so the geometry and SRID you hand it must already be correct.

Crucially, GeoAlchemy2 creates a GiST spatial index automatically when it emits `CREATE TABLE` for a model — but only when the table is created through `metadata.create_all()`. If the table already exists, or you load with `to_postgis`, you must create the index yourself. Building it after the bulk load rather than before is materially faster, because maintaining a spatial index during a large insert is far more expensive than building it once at the end. The upstream conversion that produces these shapely geometries is covered in [Geometry Mesh Conversion](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/) — this page assumes you already hold valid, reprojected shapely geometries.

## Production-Ready Script

The following script defines a model with a 3D geometry column, bulk-inserts converted CAD features in batches, and ensures a GiST index exists. It uses the SQLAlchemy 2.0 declarative and Core APIs.

```python
# geoalchemy2>=0.14 | SQLAlchemy>=2.0 | shapely>=2.0 | psycopg2 | python>=3.9
from sqlalchemy import create_engine, Integer, String, text
from sqlalchemy.orm import DeclarativeBase, Session, mapped_column, Mapped
from geoalchemy2 import Geometry
from geoalchemy2.shape import from_shape
from shapely.geometry import LineString

SRID = 27700  # British National Grid; match your converted geometry's CRS

class Base(DeclarativeBase):
    pass

class CadFeature(Base):
    __tablename__ = "cad_features"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    layer: Mapped[str] = mapped_column(String(128))
    # GEOMETRYZ + explicit SRID; GeoAlchemy2 emits a GiST index on create_all()
    geom: Mapped[object] = mapped_column(
        Geometry(geometry_type="GEOMETRYZ", srid=SRID, dimension=3)
    )

def write_features(dsn: str, features: list[tuple[str, LineString]], batch: int = 2000) -> int:
    """Bulk-insert (layer, shapely_geometry) pairs into PostGIS.
    Returns the number of rows written."""
    engine = create_engine(dsn)
    Base.metadata.create_all(engine)  # creates table + GiST index if absent

    written = 0
    with Session(engine) as session:
        rows: list[CadFeature] = []
        for layer, geom in features:
            rows.append(CadFeature(
                layer=layer,
                geom=from_shape(geom, srid=SRID),  # stamps SRID onto the WKB
            ))
            if len(rows) >= batch:
                session.add_all(rows)
                session.commit()          # one transaction per batch
                written += len(rows)
                rows.clear()
        if rows:
            session.add_all(rows)
            session.commit()
            written += len(rows)

    # Belt-and-braces: ensure the GiST index exists even if the table pre-existed
    with engine.begin() as conn:
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS cad_features_geom_gix "
            "ON cad_features USING GIST (geom)"
        ))
        conn.execute(text("ANALYZE cad_features"))
    return written

if __name__ == "__main__":
    dsn = "postgresql+psycopg2://gis:secret@db.internal:5432/cadgis"
    demo = [
        ("BOUNDARY", LineString([(0, 0, 0), (10, 0, 0), (10, 10, 2)])),
        ("BUILDING", LineString([(2, 2, 0), (4, 2, 0), (4, 4, 3)])),
    ]
    print(f"Wrote {write_features(dsn, demo)} rows")
```

**Key implementation notes:**

- `from_shape(geom, srid=SRID)` is mandatory: shapely carries no SRID, and an SRID-0 geometry inserted into an SRID-27700 column raises a PostGIS constraint error.
- `Geometry("GEOMETRYZ", srid=SRID, dimension=3)` stores true 3D geometry; the shapely inputs must carry Z coordinates or the third ordinate is lost.
- Committing once per batch of ~2000 rows bounds transaction size and WAL growth; a single giant transaction risks bloating the write-ahead log on large loads.
- `create_all()` builds the GiST index at table-creation time, but the explicit `CREATE INDEX IF NOT EXISTS` covers the case where the table already existed from a prior run.
- `ANALYZE` after loading refreshes planner statistics so spatial queries choose the GiST index instead of a sequential scan.
- The one-line alternative, `GeoDataFrame.to_postgis(engine)`, is fine when you do not need explicit typing or batching — but it creates no index, so add one afterward.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `geoalchemy2` | `>=0.14` | `Geometry` type, `from_shape`/`to_shape`. |
| `SQLAlchemy` | `>=2.0` | Declarative `Mapped` / `mapped_column` API used here. |
| `shapely` | `>=2.0` | Source geometry objects. |
| PostGIS | `3.x` | Server extension; `GEOMETRYZ` and GiST supported. |
| PostgreSQL | `12+` | Any version PostGIS 3.x supports. |
| Driver | `psycopg2` or `psycopg` 3 | DSN prefix `postgresql+psycopg2` or `postgresql+psycopg`. |

## Fallback Strategies

Bulk loads into PostGIS fail in a handful of recurring ways. Handle them in this order.

**1. Declare the SRID explicitly and consistently**

The SRID on the column, the SRID passed to `from_shape`, and the CRS of the source geometry must all agree. A mismatch either raises a constraint error or, worse, stores geometry that never matches spatial joins. Reproject to the target CRS before writing — the pyproj-based reprojection is covered in [Reprojecting CAD Coordinates with pyproj Transformer](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/reprojecting-cad-coordinates-with-pyproj-transformer/).

**2. Handle mixed geometry types**

A `GEOMETRYZ` column typed for one geometry kind rejects rows of another. If your converted CAD output mixes lines and polygons, either split into separate tables per type or declare a generic `Geometry("GEOMETRY", srid=SRID)` column that accepts any type. Generic columns cost some planner precision, so prefer typed columns when the data is homogeneous.

**3. Keep 2D and 3D consistent**

Do not mix 2D and 3D geometry in one column. Inserting a 2D geometry into a `GEOMETRYZ` column, or vice versa, either errors or silently pads/drops the Z ordinate. Normalise dimensionality before the load, and verify with `SELECT DISTINCT ST_NDims(geom) FROM cad_features`.

**4. Tune batch size and transactions**

Very small batches pay per-transaction overhead; a single enormous transaction bloats the WAL and holds locks. A few thousand rows per commit is a good default. For the largest loads, drop the GiST index, `COPY` the rows, then rebuild the index once at the end.

**5. Use upsert for idempotent reloads**

When a pipeline may re-run on the same source, a plain insert duplicates rows. Use PostgreSQL `INSERT ... ON CONFLICT` on a natural key (for example a stable feature id) so re-runs update rather than duplicate:

```python
# SQLAlchemy>=2.0 — upsert on a unique key
from sqlalchemy.dialects.postgresql import insert as pg_insert

stmt = pg_insert(CadFeature).values(rows_as_dicts)
stmt = stmt.on_conflict_do_update(
    index_elements=["id"],
    set_={"geom": stmt.excluded.geom, "layer": stmt.excluded.layer},
)
with engine.begin() as conn:
    conn.execute(stmt)
```

If the attributes you are loading originate from IFC property sets, the column-mapping strategy is covered in [Mapping IFC Property Sets to PostGIS Columns](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/mapping-ifc-property-sets-to-postgis-columns/).

## FAQ

<details>
<summary><strong>Why must I pass the SRID to from_shape?</strong></summary>

Shapely geometries carry no SRID — they are pure coordinates. PostGIS geometry columns are typed with an SRID, and inserting a geometry whose SRID is 0 into an SRID-27700 column raises a constraint error. `from_shape(geom, srid=27700)` stamps the SRID onto the WKB element so it matches the column definition.

</details>

<details>
<summary><strong>When should I use to_postgis instead of a GeoAlchemy2 model?</strong></summary>

Use `GeoDataFrame.to_postgis` for a quick load when you do not need explicit column typing or custom batching. Use an explicit GeoAlchemy2 model when you need a declared `GEOMETRYZ` column, control over batch size and transactions, upsert semantics, or integration with an existing ORM schema.

</details>

<details>
<summary><strong>How do I store 3D CAD geometry in PostGIS?</strong></summary>

Declare the column as `Geometry('GEOMETRYZ', srid=..., dimension=3)` and pass shapely geometries that carry Z coordinates. Inserting 3D geometry into a 2D column drops the Z ordinate. Confirm with `ST_NDims` on a sample row that the stored geometry reports three dimensions.

</details>

---

## Related Pages

- [GeoPackage vs PostGIS for CAD Output](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/geopackage-vs-postgis-for-cad-output/) — the decision guide covering when PostGIS is the right storage target
- [Mapping IFC Property Sets to PostGIS Columns](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/mapping-ifc-property-sets-to-postgis-columns/) — turning IFC property sets into the attribute columns loaded alongside geometry
- [Reprojecting CAD Coordinates with pyproj Transformer](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/reprojecting-cad-coordinates-with-pyproj-transformer/) — aligning geometry to the target SRID before the PostGIS write
