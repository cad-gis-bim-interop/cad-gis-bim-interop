---
title: "Mapping GML Geometry to PostGIS with OGR"
description: "Load GML and CityGML into PostGIS with GDAL/OGR: driver configuration, the GFS schema file, forcing an SRID, and verifying the load rather than trusting it."
slug: "mapping-gml-geometry-to-postgis-with-ogr"
breadcrumb:
  - label: "Core Format Fundamentals & Schema Mapping"
    url: "/core-format-fundamentals-schema-mapping/"
  - label: "CityGML and GML Interchange"
    url: "/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/"
  - label: "Mapping GML Geometry to PostGIS with OGR"
    url: "/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/mapping-gml-geometry-to-postgis-with-ogr/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Mapping GML Geometry to PostGIS with OGR",
      "description": "Load GML and CityGML into PostGIS with GDAL/OGR: driver configuration, the GFS schema file, forcing an SRID, and verifying the load rather than trusting it.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/mapping-gml-geometry-to-postgis-with-ogr/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Core Format Fundamentals & Schema Mapping", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/"},
        {"@type": "ListItem", "position": 2, "name": "CityGML and GML Interchange", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/"},
        {"@type": "ListItem", "position": 3, "name": "Mapping GML Geometry to PostGIS with OGR", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/mapping-gml-geometry-to-postgis-with-ogr/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Load GML into PostGIS with OGR from Python",
      "description": "Configure the GML driver, control schema inference, force the target SRID, write in a transaction, and verify counts and validity after the load.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Control schema inference", "text": "Decide whether OGR scans the whole file to infer attributes or reads a supplied GFS schema file, because the two produce different tables."},
        {"@type": "HowToStep", "position": 2, "name": "Force the target SRID", "text": "Assign the coordinate reference system explicitly on the output layer rather than relying on what the driver inferred from srsName."},
        {"@type": "HowToStep", "position": 3, "name": "Write inside one transaction", "text": "Wrap the feature loop in a transaction so a failure part-way leaves no partial table behind."},
        {"@type": "HowToStep", "position": 4, "name": "Create the spatial index after the load", "text": "Build the GiST index once the rows are present instead of maintaining it per insert."},
        {"@type": "HowToStep", "position": 5, "name": "Verify counts and validity", "text": "Compare the written row count against the source feature count and check geometry validity before the table is used."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is a .gfs file and do I need one?",
          "acceptedAnswer": {"@type": "Answer", "text": "It is the schema OGR infers from a GML file — the feature classes, their attributes and geometry types — cached next to the source. It matters because inference is based on a scan, and a scan that stops early can miss an attribute that appears only in later features. Supplying a .gfs you control makes the resulting table deterministic instead of dependent on file order."}
        },
        {
          "@type": "Question",
          "name": "Why does the loaded SRID come out as 0?",
          "acceptedAnswer": {"@type": "Answer", "text": "Because OGR could not resolve the srsName in the file to an authority code. URN-style names in particular are resolved inconsistently across GDAL versions. Assign the CRS explicitly on the output layer rather than letting it be inferred, and assert the SRID after the load."}
        },
        {
          "@type": "Question",
          "name": "Should I load with OGR or parse and insert myself?",
          "acceptedAnswer": {"@type": "Answer", "text": "Use OGR for bulk loading a well-formed file — it is faster and handles the driver detail. Parse it yourself when the mapping is not one-to-one: when nested features have to be flattened, when attributes need reshaping, or when features must be filtered on something the driver cannot express. The two coexist; loading a raw staging table with OGR and reshaping in SQL is often the shortest path."}
        }
      ]
    }
  ]
}
</script>

# Mapping GML Geometry to PostGIS with OGR

To load GML or CityGML into PostGIS from Python, open the source with GDAL's GML driver, create the target layer with an explicitly assigned coordinate reference system, copy features inside a single transaction, and build the spatial index afterwards. The driver does the parsing; what it will not do is guarantee that the schema it inferred and the SRID it resolved are the ones you wanted. This page belongs to [CityGML and GML Interchange](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/).

## How the GML Driver Builds a Schema

GML has no fixed schema — a document declares its own feature types — so OGR infers one by scanning the file and recording the feature classes it finds, their attributes and their geometry types. The result is cached as a `.gfs` file next to the source.

<!-- fig:ogr-gfs -->
<svg viewBox="-20 -20 552 286" role="img" aria-label="The GML driver infers a schema by scanning, caches it beside the source, and reuses the cache thereafter" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:552px;display:block;margin:1.5rem auto;">
  <title>Where the inferred schema comes from</title>
  <desc>A call sequence. The driver scans the document to discover feature classes and their attributes, caches the result as a schema file next to the source, and reuses that cache on subsequent opens. A schema inferred from a partial scan therefore persists — including any attribute the scan never reached — until the cache is deleted or replaced.</desc>
  <defs>
    <marker id="og1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="og1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="552" height="286" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="156" height="34" rx="6" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-width="1.4"/>
  <text x="78" y="21" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">pipeline</text>
  <line x1="78" y1="34" x2="78" y2="246" stroke="currentColor" stroke-width="1" stroke-opacity="0.28" stroke-dasharray="4 4"/>
  <rect x="178" y="0" width="156" height="34" rx="6" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-width="1.4"/>
  <text x="256" y="21" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">GML driver</text>
  <line x1="256" y1="34" x2="256" y2="246" stroke="currentColor" stroke-width="1" stroke-opacity="0.28" stroke-dasharray="4 4"/>
  <rect x="356" y="0" width="156" height="34" rx="6" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-width="1.4"/>
  <text x="434" y="21" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">the .gfs cache</text>
  <line x1="434" y1="34" x2="434" y2="246" stroke="currentColor" stroke-width="1" stroke-opacity="0.28" stroke-dasharray="4 4"/>
  <line x1="78" y1="60" x2="256" y2="60" stroke="currentColor" stroke-width="1.3" marker-end="url(#og1-a)"/>
  <text x="167" y="53" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.8">Open(gml)</text>
  <line x1="256" y1="100" x2="434" y2="100" stroke="currentColor" stroke-width="1.3" marker-end="url(#og1-a)"/>
  <text x="345" y="93" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.8">cache present?</text>
  <line x1="434" y1="140" x2="256" y2="140" stroke="currentColor" stroke-width="1.3" stroke-dasharray="5 4" marker-end="url(#og1-o)"/>
  <text x="345" y="133" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.8">no — scan the document</text>
  <line x1="256" y1="180" x2="434" y2="180" stroke="currentColor" stroke-width="1.3" marker-end="url(#og1-a)"/>
  <text x="345" y="173" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.8">write inferred schema</text>
  <line x1="256" y1="220" x2="78" y2="220" stroke="currentColor" stroke-width="1.3" stroke-dasharray="5 4" marker-end="url(#og1-o)"/>
  <text x="167" y="213" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.8">layer with fields</text>
</svg>
<!-- /fig:ogr-gfs -->

Two consequences follow. First, the inference is only as complete as the scan: an attribute that appears for the first time in a late feature may be missing from the schema, and the values with it. Second, the cached `.gfs` is reused on subsequent opens, so a schema inferred once from a partial scan persists until the file is deleted. Supplying a `.gfs` under your own control turns both from hazards into configuration.

The coordinate reference system is inferred separately, from `srsName`. Where that is a URN rather than a simple authority code, resolution varies between GDAL builds, and an unresolved system produces a layer with SRID 0 — which loads successfully and then matches nothing in a spatial join.

## Production-Ready Script

{% raw %}
```python
# GDAL>=3.6 (osgeo), Python 3.9+
from __future__ import annotations

from dataclasses import dataclass
from osgeo import gdal, ogr, osr

gdal.UseExceptions()
ogr.UseExceptions()


@dataclass(frozen=True)
class LoadReport:
    source_features: int
    written: int
    skipped_null_geometry: int
    srid: int

    def yield_rate(self) -> float:
        return self.written / self.source_features if self.source_features else 0.0


def load_gml_to_postgis(
    gml_path: str, pg_dsn: str, table: str, epsg: int, *, layer_index: int = 0,
) -> LoadReport:
    """Copy one GML layer into PostGIS with an explicitly assigned SRID."""
    gdal.SetConfigOption("GML_EXPOSE_GML_ID", "YES")   # keep the source identifier
    gdal.SetConfigOption("GML_READ_MODE", "SEQUENTIAL_LAYERS")

    src = ogr.Open(gml_path)
    if src is None:
        raise RuntimeError(f"cannot open {gml_path}")
    src_layer = src.GetLayer(layer_index)
    source_features = src_layer.GetFeatureCount()

    srs = osr.SpatialReference()
    srs.ImportFromEPSG(epsg)                           # explicit, not inferred
    srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)

    dst = ogr.Open(pg_dsn, update=1)
    if dst is None:
        raise RuntimeError("cannot open the PostGIS connection")

    dst_layer = dst.CreateLayer(
        table, srs=srs, geom_type=src_layer.GetGeomType(),
        options=["OVERWRITE=YES", "GEOMETRY_NAME=geom", "SPATIAL_INDEX=NONE"],
    )
    defn = src_layer.GetLayerDefn()
    for i in range(defn.GetFieldCount()):
        dst_layer.CreateField(defn.GetFieldDefn(i))

    written = skipped = 0
    dst_layer.StartTransaction()
    try:
        for feature in src_layer:
            geom = feature.GetGeometryRef()
            if geom is None or geom.IsEmpty():
                skipped += 1
                continue
            geom.AssignSpatialReference(srs)
            out = ogr.Feature(dst_layer.GetLayerDefn())
            out.SetFrom(feature)
            out.SetGeometry(geom)
            dst_layer.CreateFeature(out)
            written += 1
        dst_layer.CommitTransaction()
    except Exception:
        dst_layer.RollbackTransaction()
        raise

    dst.ExecuteSQL(f'CREATE INDEX ON "{table}" USING GIST (geom)')
    return LoadReport(source_features, written, skipped, epsg)


if __name__ == "__main__":
    report = load_gml_to_postgis(
        "city.gml", "PG:dbname=city user=loader", "buildings_lod1", 25832)
    print(report, f"yield {report.yield_rate():.1%}")
```
{% endraw %}

<!-- fig:ogr-load-order -->
<svg viewBox="-45 -20 495.6 310.8" role="img" aria-label="Create the layer without an index, copy inside one transaction, commit, then build the GiST index once" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:496px;display:block;margin:1.5rem auto;">
  <title>The load order that keeps the index cheap</title>
  <desc>Four stages. The target layer is created with an explicitly assigned coordinate reference system and no spatial index; features are copied inside one transaction; the transaction commits; the index is built once over the loaded rows. Creating the index first makes every insert pay index maintenance, which on a bulk load costs far more than the single build.</desc>
  <defs>
    <marker id="og2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="og2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-45" y="-20" width="495.6" height="310.8" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="264" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="132" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Create layer</text>
  <text x="132" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">explicit SRID, no index</text>
  <circle cx="-14" cy="24.1" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="27.6" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">1</text>
  <text x="282" y="27.6" font-size="9.5" fill="currentColor" fill-opacity="0.75">SPATIAL_INDEX=NONE</text>
  <rect x="0" y="74.2" width="264" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="132" y="94.5" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Copy features</text>
  <text x="132" y="108.2" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">inside a transaction</text>
  <circle cx="-14" cy="98.3" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="101.8" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">2</text>
  <text x="282" y="101.8" font-size="9.5" fill="currentColor" fill-opacity="0.75">null geometry counted, not written</text>
  <rect x="0" y="148.4" width="264" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="132" y="168.7" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Commit</text>
  <text x="132" y="182.4" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">or roll back cleanly</text>
  <circle cx="-14" cy="172.5" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="176" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">3</text>
  <text x="282" y="176" font-size="9.5" fill="currentColor" fill-opacity="0.75">no partial table survives</text>
  <rect x="0" y="222.6" width="264" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="132" y="242.9" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Build the GiST index</text>
  <text x="132" y="256.6" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">once, over the rows</text>
  <circle cx="-14" cy="246.7" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="250.2" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">4</text>
  <text x="282" y="250.2" font-size="9.5" fill="currentColor" fill-opacity="0.75">not maintained per insert</text>
  <line x1="132" y1="48.2" x2="132" y2="74.2" stroke="currentColor" stroke-width="1.4" marker-end="url(#og2-a)"/>
  <line x1="132" y1="122.4" x2="132" y2="148.4" stroke="currentColor" stroke-width="1.4" marker-end="url(#og2-a)"/>
  <line x1="132" y1="196.6" x2="132" y2="222.6" stroke="currentColor" stroke-width="1.4" marker-end="url(#og2-a)"/>
</svg>
<!-- /fig:ogr-load-order -->

**Key implementation notes:**

- `SPATIAL_INDEX=NONE` on creation and an explicit `CREATE INDEX` afterwards. Maintaining a GiST index across a bulk insert costs far more than building it once.
- `GML_EXPOSE_GML_ID` keeps the source identifier as an attribute. Without it the load produces rows that cannot be matched back to the source document.
- The SRID is assigned from an EPSG code you supply and pushed onto every geometry, rather than being whatever the driver resolved.
- `SetAxisMappingStrategy(OAMS_TRADITIONAL_GIS_ORDER)` fixes GDAL 3's axis handling to easting-northing, the equivalent of `always_xy` in `pyproj`.
- Null and empty geometries are counted separately from failures, because they mean different things and both should be visible in the report.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| GDAL / OGR | `>=3.6` | axis mapping strategy required from GDAL 3 |
| PostGIS | 3.x | GiST index, `GEOMETRY` and typed columns |
| GML driver | GML, CityGML | CityGML read through the GML driver |
| Schema inference | `.gfs` cache | delete or supply deliberately |
| Geometry types | 2D and 3D | declare a `Z` geometry type where elevation matters |

## Fallback Strategies

**1. SRID comes out as 0.** The driver did not resolve `srsName`. Assign it explicitly, as above, and assert the result with `Find_SRID` after the load rather than assuming the assignment took.

<!-- fig:ogr-srid-zero -->
<svg viewBox="-20 -33.5 432.6 125.8" role="img" aria-label="An unresolvable srsName produces an SRID of zero, and spatial joins against it silently return nothing" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:433px;display:block;margin:1.5rem auto;">
  <title>How an SRID of zero happens and what it costs</title>
  <desc>Four stages of a silent failure. The document names its coordinate system in a URN form; the driver cannot resolve that form to an authority code; the layer is created with an SRID of zero; and every spatial join against a properly referenced layer then returns no matches. The load succeeds at every stage and the data is unusable.</desc>
  <defs>
    <marker id="og3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="og3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-33.5" width="432.6" height="125.8" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="106.7" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="53.4" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">URN srsName</text>
  <text x="53.4" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">in the document</text>
  <rect x="140.7" y="0" width="81.8" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="181.6" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">SRID 0</text>
  <text x="181.6" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">on the layer</text>
  <rect x="256.6" y="0" width="94.4" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="303.8" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">No matches</text>
  <text x="303.8" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">nothing raised</text>
  <line x1="106.7" y1="24.1" x2="140.7" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#og3-a)"/>
  <text x="123.7" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">unresolved</text>
  <line x1="222.6" y1="24.1" x2="256.6" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#og3-a)"/>
  <text x="239.6" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">join</text>
  <text x="0" y="70.2" font-size="9.5" fill="currentColor" fill-opacity="0.7">Assign the SRID explicitly and assert it after the load rather than reading it back hopefully.</text>
</svg>
<!-- /fig:ogr-srid-zero -->

**2. A missing attribute column.** The `.gfs` was inferred from a partial scan. Delete the cached file, force a full scan, or — better — commit a `.gfs` you control alongside the source so the schema is not file-order dependent.

**3. Mixed geometry types in one layer.** CityGML feature classes routinely mix surfaces and solids. A strictly typed PostGIS column then rejects half the load. Declare a generic geometry column deliberately, or split the load by geometry type.

**4. The load succeeds and returns nothing useful.** Nested features — a building with boundary surfaces as children — flatten in a way the driver chooses, not the way your model needs. This is the case for parsing it yourself; see the sibling guide on [parsing CityGML with lxml and Shapely](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/parsing-citygml-with-lxml-and-shapely/).

**5. Memory growth on a large file.** `SEQUENTIAL_LAYERS` read mode keeps the driver from holding the whole document, but a single enormous feature still has to fit. Tile the source before loading if one feature does not.

## FAQ

<details>
<summary><strong>What is a .gfs file and do I need one?</strong></summary>

It is the schema OGR infers from a GML file — the feature classes, their attributes and geometry types — cached next to the source. It matters because inference is based on a scan, and a scan that stops early can miss an attribute that appears only in later features. Supplying a `.gfs` you control makes the resulting table deterministic instead of dependent on file order.

</details>

<details>
<summary><strong>Why does the loaded SRID come out as 0?</strong></summary>

Because OGR could not resolve the `srsName` in the file to an authority code. URN-style names in particular are resolved inconsistently across GDAL versions. Assign the CRS explicitly on the output layer rather than letting it be inferred, and assert the SRID after the load.

</details>

<details>
<summary><strong>Should I load with OGR or parse and insert myself?</strong></summary>

Use OGR for bulk loading a well-formed file — it is faster and handles the driver detail. Parse it yourself when the mapping is not one-to-one: when nested features have to be flattened, when attributes need reshaping, or when features must be filtered on something the driver cannot express. The two coexist; loading a raw staging table with OGR and reshaping in SQL is often the shortest path.

</details>

---

## Related Pages

- [CityGML and GML Interchange](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/) — parent reference on the geometry and schema this load consumes
- [Parsing CityGML with lxml and Shapely](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/citygml-and-gml-interchange/parsing-citygml-with-lxml-and-shapely/) — the hand-rolled alternative when the mapping is not one-to-one
- [Writing CAD Geometry to PostGIS with GeoAlchemy2](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/geopackage-vs-postgis-for-cad-output/writing-cad-geometry-to-postgis-with-geoalchemy2/) — the ORM route into the same database
