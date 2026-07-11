---
title: "GeoPackage vs PostGIS for CAD Output: Choosing a Storage Target"
description: "A decision guide comparing GeoPackage and PostGIS as the storage target for converted CAD/BIM geometry — concurrency, scale, portability, indexing, tooling, and ops cost."
slug: "geopackage-vs-postgis-for-cad-output"
breadcrumb:
  - label: "Interoperability Decision Guides"
    url: "/interoperability-decision-guides/"
  - label: "GeoPackage vs PostGIS for CAD Output"
    url: "/interoperability-decision-guides/geopackage-vs-postgis-for-cad-output/"
datePublished: "2026-07-11"
dateModified: "2026-07-11"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "GeoPackage vs PostGIS for CAD Output: Choosing a Storage Target",
      "description": "A decision guide comparing GeoPackage and PostGIS as the storage target for converted CAD/BIM geometry — concurrency, scale, portability, indexing, tooling, and ops cost.",
      "datePublished": "2026-07-11",
      "dateModified": "2026-07-11",
      "author": {"@type": "Organization", "name": "CAD GIS BIM Interop"},
      "publisher": {"@type": "Organization", "name": "CAD GIS BIM Interop", "url": "https://www.cad-gis-bim-interop.org"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Interoperability Decision Guides", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/"},
        {"@type": "ListItem", "position": 2, "name": "GeoPackage vs PostGIS for CAD Output", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/geopackage-vs-postgis-for-cad-output/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Write Converted CAD Geometry to GeoPackage or PostGIS",
      "description": "Choose between GeoPackage and PostGIS as the storage target for converted CAD/BIM geometry, then write features with geopandas.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Assemble a GeoDataFrame", "text": "Build a GeoDataFrame of the converted CAD/BIM features with a declared CRS and a single geometry type."},
        {"@type": "HowToStep", "position": 2, "name": "Decide the target", "text": "Choose GeoPackage for single-file portability and desktop handoff, or PostGIS for concurrent multi-user access and large-scale spatial SQL."},
        {"@type": "HowToStep", "position": 3, "name": "Write to GeoPackage", "text": "Call GeoDataFrame.to_file with driver='GPKG' to produce a single-file SQLite database."},
        {"@type": "HowToStep", "position": 4, "name": "Write to PostGIS", "text": "Call GeoDataFrame.to_postgis with a SQLAlchemy engine, then create a GiST spatial index on the geometry column."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Is GeoPackage safe for concurrent writes?",
          "acceptedAnswer": {"@type": "Answer", "text": "No. GeoPackage is a single SQLite file and SQLite serialises writes with a file lock, so only one writer can proceed at a time. It is excellent for single-process conversion jobs and read-heavy desktop use, but concurrent multi-worker writes contend on the lock and fail or serialise. Use PostGIS when many processes must write at once."}
        },
        {
          "@type": "Question",
          "name": "When is PostGIS overkill for CAD output?",
          "acceptedAnswer": {"@type": "Answer", "text": "PostGIS is overkill when the output is a one-off deliverable handed to a single GIS analyst, or when the dataset is small and portability matters more than concurrency. Standing up and operating a database server, managing credentials, and backing it up costs more than a GeoPackage file is worth for a desktop handoff."}
        },
        {
          "@type": "Question",
          "name": "Do both formats support 3D (Z) geometry?",
          "acceptedAnswer": {"@type": "Answer", "text": "Yes. GeoPackage stores Z and M coordinates when the geometry column is declared with them, and PostGIS supports Z through the GEOMETRYZ type. In both cases you must declare the dimensionality up front; appending 3D geometry to a 2D column drops the Z ordinate silently in some drivers."}
        },
        {
          "@type": "Question",
          "name": "Can I move data from GeoPackage to PostGIS later?",
          "acceptedAnswer": {"@type": "Answer", "text": "Yes. Both are OGC-standard vector stores readable by GDAL/OGR and geopandas, so a GeoPackage produced for handoff can be read back into a GeoDataFrame and written to PostGIS with to_postgis. Starting with GeoPackage does not lock you out of a server-based target later."}
        }
      ]
    }
  ]
}
</script>

# GeoPackage vs PostGIS for CAD Output: Choosing a Storage Target

Choosing between GeoPackage and PostGIS as the storage target for converted CAD/BIM geometry decides whether your output is a portable single file or a concurrent, server-hosted spatial database — and that choice shapes everything from handoff logistics to CI cost.

This guide sits within the [Interoperability Decision Guides](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/) section and treats the two as complementary endpoints of the same conversion pipeline rather than competitors. GeoPackage is a single SQLite file implementing the OGC standard: portable, zero-server, and ideal for handing a dataset to a desktop GIS user or shipping it alongside a report. PostGIS is a spatial extension to PostgreSQL: a server that offers concurrent multi-user access, rich spatial SQL, mature indexing, and the scale to hold billions of features — at the operational cost of running a database. When the output is a deliverable for one analyst, GeoPackage almost always wins. When the output is a shared platform that many jobs write to and many users query, PostGIS wins.

Both are the destination the earlier stages of a CAD-to-GIS pipeline converge on, after geometry has been extracted and reprojected. The decision is about the operational shape of the destination, not the correctness of the geometry.

<svg viewBox="0 0 760 272" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Decision diagram routing converted CAD geometry from a GeoDataFrame through a handoff-or-platform decision to either a GeoPackage single file or a PostGIS server" style="width:100%;max-width:760px;display:block;margin:1.5rem auto;">
  <title>Routing Converted CAD Geometry to GeoPackage or PostGIS</title>
  <desc>Decision diagram. Converted CAD geometry held in a GeoDataFrame flows into a decision node asking whether the output is a handoff or a platform. A handoff routes to a GeoPackage single-file SQLite target for portable desktop use; a platform routes to a PostGIS server offering concurrent access, spatial SQL, and indexing.</desc>
  <defs>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor" opacity="0.6"/>
    </marker>
  </defs>
  <!-- Source -->
  <rect x="24" y="118" width="160" height="64" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
  <text x="104" y="146" text-anchor="middle" font-size="12" fill="currentColor" font-family="sans-serif" font-weight="600">Converted geometry</text>
  <text x="104" y="166" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">GeoDataFrame</text>
  <!-- Decision diamond -->
  <polygon points="320,96 400,150 320,204 240,150" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.55"/>
  <text x="320" y="146" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">Handoff</text>
  <text x="320" y="163" text-anchor="middle" font-size="11" fill="currentColor" font-family="sans-serif">or platform?</text>
  <!-- Targets -->
  <rect x="520" y="34" width="216" height="86" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.55"/>
  <text x="628" y="62" text-anchor="middle" font-size="12" fill="currentColor" font-family="sans-serif" font-weight="600">GeoPackage</text>
  <text x="628" y="82" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">single-file SQLite</text>
  <text x="628" y="100" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">portable handoff</text>
  <rect x="520" y="176" width="216" height="86" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.55"/>
  <text x="628" y="204" text-anchor="middle" font-size="12" fill="currentColor" font-family="sans-serif" font-weight="600">PostGIS</text>
  <text x="628" y="224" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">server + spatial SQL</text>
  <text x="628" y="242" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.7">concurrent, indexed</text>
  <!-- Arrows -->
  <line x1="184" y1="150" x2="236" y2="150" stroke="currentColor" stroke-width="1.5" opacity="0.5" marker-end="url(#arr)"/>
  <line x1="400" y1="150" x2="516" y2="82" stroke="currentColor" stroke-width="1.5" opacity="0.5" marker-end="url(#arr)"/>
  <line x1="400" y1="150" x2="516" y2="216" stroke="currentColor" stroke-width="1.5" opacity="0.5" marker-end="url(#arr)"/>
  <text x="452" y="104" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.6">desktop</text>
  <text x="452" y="196" text-anchor="middle" font-size="10" fill="currentColor" font-family="sans-serif" opacity="0.6">at scale</text>
</svg>

## Prerequisites

Before writing converted geometry to either target, confirm the following:

- **Python 3.9+** — `# python>=3.9`
- **geopandas ≥ 0.14** — install with `pip install "geopandas>=0.14"`; provides `to_file` and `to_postgis`.
- **shapely ≥ 2.0** — the geometry backing every GeoDataFrame feature.
- **GDAL/OGR ≥ 3.6** — the driver layer behind GeoPackage writes.
- **SQLAlchemy ≥ 2.0 and psycopg (2 or 3)** — required for the PostGIS engine; `pip install "SQLAlchemy>=2.0" psycopg2-binary`.
- **A PostGIS 3.x server** — only for the PostGIS route; the `postgis` extension must be enabled in the target database.
- **Converted, reprojected geometry** — this guide assumes geometry has already been extracted and normalised. Extraction is covered in [Geometry Mesh Conversion](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/) and CRS handling in [CRS Normalization Workflows](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/).

## Architectural Overview

The two targets differ in one foundational way: GeoPackage is an embedded database (a file your process opens directly) while PostGIS is a client-server database (a service your process connects to over a socket). Every operational difference flows from that.

| Dimension | GeoPackage | PostGIS |
|-----------|-----------|---------|
| Deployment | Single `.gpkg` file, no server | PostgreSQL server + PostGIS extension |
| Concurrency | Single writer (SQLite file lock) | Many concurrent readers and writers (MVCC) |
| Scale | Comfortable to tens of millions of features | Billions of features; partitioning available |
| Portability | Copy the file — done | Requires connection details and credentials |
| Indexing | R-tree spatial index | GiST / SP-GiST, BRIN, partial and functional indexes |
| Spatial SQL | SQLite functions (GDAL RTree) | Full PostGIS function library, joins, window functions |
| Tooling | Opens directly in QGIS, GDAL, ArcGIS | QGIS, `psql`, ORMs, BI tools over the network |
| Ops cost | Effectively zero | Provisioning, backups, credentials, monitoring |
| CI friendliness | Trivial — a file artifact | Needs a service container in the pipeline |

**Version compatibility:**

| Component | Supported range | Notes |
|---|---|---|
| `geopandas` | `>=0.14` | `to_file(driver="GPKG")` and `to_postgis`. |
| `shapely` | `>=2.0` | Geometry engine for GeoDataFrames. |
| GDAL/OGR | `>=3.6` | GeoPackage driver; R-tree index support. |
| PostGIS | `3.x` | Server extension for the PostGIS route. |
| SQLAlchemy | `>=2.0` | Engine for `to_postgis`; 2.0 API assumed. |

Both formats are OGC-standard and GDAL-readable, so the choice is not permanent: a GeoPackage produced for handoff can be read back and loaded into PostGIS later without a lossy conversion.

## Step-by-Step Implementation

### 1. Assemble a GeoDataFrame with a declared CRS

Both targets start from the same in-memory representation: a GeoDataFrame whose geometry column has an explicit CRS and, ideally, a single geometry type. Converted CAD geometry frequently lacks a CRS at this point — set it explicitly.

```python
# geopandas>=0.14 | shapely>=2.0 | python>=3.9
import geopandas as gpd
from shapely.geometry import LineString

records = [
    {"layer": "BOUNDARY", "geometry": LineString([(0, 0), (10, 0), (10, 10)])},
    {"layer": "BUILDING", "geometry": LineString([(2, 2), (4, 2), (4, 4)])},
]
gdf = gpd.GeoDataFrame(records, geometry="geometry", crs="EPSG:27700")
assert gdf.crs is not None, "Declare the CRS before writing to any GIS store"
```

### 2. Write to GeoPackage for portable handoff

For a single-file deliverable, `to_file` with the `GPKG` driver writes a self-contained SQLite database. The `layer` argument names the table inside the file; a single GeoPackage can hold many layers.

```python
# geopandas>=0.14 | python>=3.9
gdf.to_file("cad_output.gpkg", layer="parcels", driver="GPKG")
# Append a second layer to the same file:
gdf.to_file("cad_output.gpkg", layer="buildings", driver="GPKG")
```

The result is one portable file that opens directly in QGIS or any GDAL-based tool with no connection setup. GDAL builds an R-tree spatial index for the layer automatically.

### 3. Write to PostGIS for concurrent, indexed storage

For a server target, create a SQLAlchemy engine and call `to_postgis`. Then add a GiST spatial index — `to_postgis` writes the table but does not index it, and unindexed spatial queries table-scan.

```python
# geopandas>=0.14 | SQLAlchemy>=2.0 | psycopg2 | python>=3.9
from sqlalchemy import create_engine, text

engine = create_engine("postgresql+psycopg2://gis:secret@db.internal:5432/cadgis")

gdf.to_postgis("parcels", engine, if_exists="replace", index=False)

with engine.begin() as conn:
    conn.execute(text(
        "CREATE INDEX IF NOT EXISTS parcels_geom_gix "
        "ON parcels USING GIST (geometry)"
    ))
```

`to_postgis` is the convenience path; when you need explicit control over column types, batch sizes, and 3D geometry, define the table with SQLAlchemy and GeoAlchemy2 and bulk-insert — the full pattern is in [Writing CAD Geometry to PostGIS with GeoAlchemy2](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/geopackage-vs-postgis-for-cad-output/writing-cad-geometry-to-postgis-with-geoalchemy2/).

### 4. Verify the written store

Read the data back and confirm the feature count and CRS survived the round-trip, whichever target you wrote:

```python
# geopandas>=0.14
back = gpd.read_file("cad_output.gpkg", layer="parcels")
assert len(back) == len(gdf)
assert back.crs == gdf.crs
```

## Edge Cases & Gotchas

### SRID must match the declared CRS

PostGIS stores an SRID per geometry column; if the GeoDataFrame CRS and the column SRID disagree, spatial joins against other layers silently return no matches. Set the CRS on the GeoDataFrame before `to_postgis`, and verify the SRID after:

```python
with engine.connect() as conn:
    srid = conn.execute(text("SELECT Find_SRID('public','parcels','geometry')")).scalar()
    assert srid == 27700
```

### Mixed geometry types break strict columns

A GeoDataFrame that mixes `LineString` and `Polygon` writes cleanly to GeoPackage (which tolerates a `GEOMETRY` column) but fails against a PostGIS column typed for a single geometry type. Split by geometry type into separate layers/tables, or declare a generic `GEOMETRY` column deliberately.

### Z coordinates require an explicit 3D column

Appending 3D geometry to a 2D column drops the Z ordinate. Declare dimensionality up front — `GEOMETRYZ` in PostGIS, and let the GeoPackage driver detect Z from the first feature. The 3D column declaration for PostGIS is covered in the child page below.

### The GeoPackage file lock serialises writers

Two processes writing the same `.gpkg` contend on the SQLite file lock; the second blocks or errors with "database is locked". Never point parallel conversion workers at one GeoPackage — give each worker its own file and merge afterwards, or use PostGIS.

### to_postgis does not create an index

`to_postgis` writes rows but no spatial index. Every subsequent `ST_Intersects` or bounding-box query table-scans until you add a GiST index. Make index creation part of the write step, not an afterthought.

## Validation & Testing

Test the write path for both targets against a small fixture, asserting round-trip fidelity and that the spatial index exists:

```python
# geopandas>=0.14 | SQLAlchemy>=2.0 | python>=3.9
from sqlalchemy import create_engine, text

def test_geopackage_roundtrip(tmp_path):
    import geopandas as gpd
    from shapely.geometry import Point
    gdf = gpd.GeoDataFrame(
        {"id": [1, 2]}, geometry=[Point(0, 0), Point(1, 1)], crs="EPSG:4326"
    )
    path = tmp_path / "t.gpkg"
    gdf.to_file(path, layer="pts", driver="GPKG")
    back = gpd.read_file(path, layer="pts")
    assert len(back) == 2 and back.crs.to_epsg() == 4326

def test_postgis_has_spatial_index(engine):
    with engine.connect() as conn:
        idx = conn.execute(text(
            "SELECT indexname FROM pg_indexes "
            "WHERE tablename = 'parcels' AND indexdef ILIKE '%GIST%'"
        )).fetchall()
    assert idx, "Expected a GiST spatial index on parcels"
```

## Performance & Scale

**GeoPackage** performs best as a write-once, read-many artifact. Wrap a bulk load in a single transaction (`to_file` does this per call) and avoid many small appends — each `to_file` call reopens the file and rebuilds indexes. For datasets beyond tens of millions of features, or where query concurrency matters, the single-writer SQLite model becomes the ceiling; move to PostGIS.

**PostGIS** scales through indexing and batching. After bulk loading, `VACUUM ANALYZE` the table so the planner has fresh statistics, and create the GiST index *after* the bulk insert rather than before — maintaining an index during a large load is far slower than building it once at the end. For very large loads, insert in batches of a few thousand rows per transaction to bound WAL growth, and consider `COPY`-based ingestion for the largest jobs. Partition by region or by capture date when a single table grows past hundreds of millions of rows.

For CI pipelines, GeoPackage is the cheaper target: the output is a file artifact with no service dependency. Testing the PostGIS path requires a PostGIS service container in the pipeline, which is worth it only when the production target is PostGIS. The detailed bulk-insert, engine, and index mechanics for the server path are covered in [Writing CAD Geometry to PostGIS with GeoAlchemy2](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/geopackage-vs-postgis-for-cad-output/writing-cad-geometry-to-postgis-with-geoalchemy2/).

## FAQ

<details>
<summary><strong>Is GeoPackage safe for concurrent writes?</strong></summary>

No. GeoPackage is a single SQLite file and SQLite serialises writes with a file lock, so only one writer can proceed at a time. It is excellent for single-process conversion jobs and read-heavy desktop use, but concurrent multi-worker writes contend on the lock and fail or serialise. Use PostGIS when many processes must write at once.

</details>

<details>
<summary><strong>When is PostGIS overkill for CAD output?</strong></summary>

PostGIS is overkill when the output is a one-off deliverable handed to a single GIS analyst, or when the dataset is small and portability matters more than concurrency. Standing up and operating a database server, managing credentials, and backing it up costs more than a GeoPackage file is worth for a desktop handoff.

</details>

<details>
<summary><strong>Do both formats support 3D (Z) geometry?</strong></summary>

Yes. GeoPackage stores Z and M coordinates when the geometry column is declared with them, and PostGIS supports Z through the `GEOMETRYZ` type. In both cases you must declare the dimensionality up front; appending 3D geometry to a 2D column drops the Z ordinate silently in some drivers.

</details>

<details>
<summary><strong>Can I move data from GeoPackage to PostGIS later?</strong></summary>

Yes. Both are OGC-standard vector stores readable by GDAL/OGR and geopandas, so a GeoPackage produced for handoff can be read back into a GeoDataFrame and written to PostGIS with `to_postgis`. Starting with GeoPackage does not lock you out of a server-based target later.

</details>

---

## Related Pages

- [Interoperability Decision Guides](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/) — the section overview framing storage and format trade-offs for CAD/BIM-to-GIS pipelines
- [Writing CAD Geometry to PostGIS with GeoAlchemy2](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/geopackage-vs-postgis-for-cad-output/writing-cad-geometry-to-postgis-with-geoalchemy2/) — the detailed engine, model, bulk-insert, and GiST-index pattern for the PostGIS route
- [DXF vs IFC for GIS Ingestion](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/dxf-vs-ifc-for-gis-ingestion/) — choosing the interchange format that feeds this storage stage
- [Choosing ezdxf, pydwg, or ODA for Production](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-ezdxf-pydwg-or-oda-for-production/) — selecting the parsing stack upstream of storage
- [CRS Normalization Workflows](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/) — aligning coordinate reference systems before writing to a GIS store
- [Geometry Mesh Conversion](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/) — producing the converted geometry that lands in GeoPackage or PostGIS
