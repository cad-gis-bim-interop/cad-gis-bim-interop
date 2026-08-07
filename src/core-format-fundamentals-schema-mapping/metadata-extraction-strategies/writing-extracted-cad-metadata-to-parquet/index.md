---
title: "Writing Extracted CAD Metadata to Parquet"
description: "Persist extracted CAD and BIM attributes as Parquet: a typed core plus a map column for the tail, partitioned by source, with provenance a later query needs."
slug: "writing-extracted-cad-metadata-to-parquet"
breadcrumb:
  - label: "Core Format Fundamentals & Schema Mapping"
    url: "/core-format-fundamentals-schema-mapping/"
  - label: "Metadata Extraction Strategies"
    url: "/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/"
  - label: "Writing Extracted CAD Metadata to Parquet"
    url: "/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/writing-extracted-cad-metadata-to-parquet/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Writing Extracted CAD Metadata to Parquet",
      "description": "Persist extracted CAD and BIM attributes as Parquet: a typed core plus a map column for the tail, partitioned by source, with provenance a later query needs.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/writing-extracted-cad-metadata-to-parquet/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Core Format Fundamentals & Schema Mapping", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/"},
        {"@type": "ListItem", "position": 2, "name": "Metadata Extraction Strategies", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/"},
        {"@type": "ListItem", "position": 3, "name": "Writing Extracted CAD Metadata to Parquet", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/writing-extracted-cad-metadata-to-parquet/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Write extracted CAD metadata to Parquet",
      "description": "Define a stable core schema, coerce attribute types deliberately, keep the unmapped tail as a map column, partition by source, and write provenance alongside.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Define a stable core schema", "text": "Fix the columns every source can supply — identifier, source file, entity type, layer and geometry reference — as an explicit schema."},
        {"@type": "HowToStep", "position": 2, "name": "Coerce types deliberately", "text": "Decide what a non-conforming value becomes rather than letting the writer infer a type from the first chunk."},
        {"@type": "HowToStep", "position": 3, "name": "Keep the tail as a map column", "text": "Store source-specific attributes in a string-to-string map so a new attribute does not need a schema migration."},
        {"@type": "HowToStep", "position": 4, "name": "Partition by source", "text": "Write partitioned by source file or delivery so a re-extraction replaces one partition rather than the dataset."},
        {"@type": "HowToStep", "position": 5, "name": "Write provenance alongside", "text": "Record the extractor version, the source modification time and the row counts so a later query can be reconciled with a delivery."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Why Parquet rather than CSV?",
          "acceptedAnswer": {"@type": "Answer", "text": "Because CAD metadata is heterogeneous and CSV has no types. Parquet carries a schema, so a column that is numeric stays numeric across a re-read, and it stores columns separately, so a query reading two attributes out of forty reads two columns off disk. On a dataset of millions of extracted entities that difference is the whole query budget."}
        },
        {
          "@type": "Question",
          "name": "How do I handle attributes that only some sources have?",
          "acceptedAnswer": {"@type": "Answer", "text": "Put them in a map column rather than adding a column per attribute. A map<string, string> holds an arbitrary attribute bag per row without a schema change, and promoting a frequently used key to a typed column later is a migration you do deliberately when the value justifies it."}
        },
        {
          "@type": "Question",
          "name": "Should the geometry go in the same file?",
          "acceptedAnswer": {"@type": "Answer", "text": "Usually not. Metadata and geometry have different access patterns — attributes are queried and aggregated, geometry is fetched by identifier — and different natural stores. Keep a stable identifier in both and let the metadata table reference the geometry store rather than embedding well-known binary in a column nobody filters on."}
        }
      ]
    }
  ]
}
</script>

# Writing Extracted CAD Metadata to Parquet

Extracted CAD and BIM attributes are heterogeneous by nature — a block attribute, an XDATA value and an IFC property set have nothing structurally in common — so the table that holds them needs a small stable core of typed columns plus a map column for everything else. Partition by source so a re-extraction replaces one partition, and write provenance alongside so a query result can be traced to a delivery. This page is part of [Metadata Extraction Strategies](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/).

## Why the Schema Is Mostly a Map

The three extraction mechanisms produce different shapes. A block attribute is a tag and a string. XDATA is a nested tree under an application identifier. An IFC property set is a named bag of typed values. Any schema wide enough to hold all of them as columns is mostly nulls, and any schema narrow enough to be useful excludes most of what was extracted.

<!-- fig:pq-core-and-tail -->
<svg viewBox="-20 -20 580 142" role="img" aria-label="A small typed core of queryable columns plus a string map for the source-specific attribute tail" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:580px;display:block;margin:1.5rem auto;">
  <title>A small typed core and an untyped tail</title>
  <desc>The table shape that survives heterogeneous sources. The core columns are the ones a query filters or joins on and every source can supply them; the map column absorbs everything else without a migration. Promoting a key from the map into a typed column later is a deliberate decision made when the value justifies it.</desc>
  <defs>
    <marker id="pq1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="pq1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="580" height="142" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="540" height="46" rx="6" fill="currentColor" fill-opacity="0.14" stroke="currentColor" stroke-width="2"/>
  <text x="16" y="21" font-size="11.5" font-weight="600" fill="currentColor">Core columns</text>
  <text x="16" y="35" font-size="9.5" fill="currentColor" fill-opacity="0.72">identifier, source, type, class, geometry reference</text>
  <text x="524" y="26.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">typed, queried</text>
  <rect x="0" y="56" width="540" height="46" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="16" y="77" font-size="11.5" font-weight="600" fill="currentColor">attributes map</text>
  <text x="16" y="91" font-size="9.5" fill="currentColor" fill-opacity="0.72">everything source-specific</text>
  <text x="524" y="82.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">no migration</text>
</svg>
<!-- /fig:pq-core-and-tail -->

The design that survives is the same one that works for property sets in a database: a handful of columns every source can supply, and a map for the rest.

The core columns are the ones a query filters or joins on — a stable identifier, the source file, the entity type, the layer or class, and a reference to where the geometry lives. Everything else goes in a `map<string, string>`, which Parquet stores efficiently and which needs no migration when a new delivery brings a new attribute.

Types in the map are a deliberate loss. A value that matters enough to be filtered numerically should be promoted to a typed column; a value that is read and displayed does not need to be. Deciding that per attribute, rather than trying to infer types across sources, is what keeps the table stable.

## Production-Ready Script

{% raw %}
```python
# pyarrow>=14.0, Python 3.9+
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
import json

import pyarrow as pa
import pyarrow.parquet as pq

# The core is explicit and small. Everything else lives in the attributes map.
SCHEMA = pa.schema([
    pa.field("entity_id", pa.string(), nullable=False),      # stable, per source
    pa.field("source_file", pa.string(), nullable=False),
    pa.field("source_format", pa.string(), nullable=False),  # dxf | ifc | gml
    pa.field("entity_type", pa.string(), nullable=False),
    pa.field("layer_or_class", pa.string()),
    pa.field("geometry_ref", pa.string()),                   # key into the geometry store
    pa.field("attributes", pa.map_(pa.string(), pa.string())),
])


@dataclass(frozen=True)
class WriteProvenance:
    extractor_version: str
    source_file: str
    source_mtime: float
    rows: int
    written_at: str


def _as_map(d: dict) -> list[tuple[str, str]]:
    """Coerce deliberately: None becomes an absent key, everything else a string."""
    return [(str(k), str(v)) for k, v in d.items() if v is not None]


def write_partition(
    records: list[dict],
    root: Path,
    *,
    source_file: str,
    source_format: str,
    extractor_version: str,
) -> WriteProvenance:
    """One partition per source file — a re-extraction replaces it, not the dataset."""
    if not records:
        raise ValueError(f"{source_file}: nothing to write")

    table = pa.Table.from_pydict({
        "entity_id": [r["entity_id"] for r in records],
        "source_file": [source_file] * len(records),
        "source_format": [source_format] * len(records),
        "entity_type": [r["entity_type"] for r in records],
        "layer_or_class": [r.get("layer_or_class") for r in records],
        "geometry_ref": [r.get("geometry_ref") for r in records],
        "attributes": [_as_map(r.get("attributes") or {}) for r in records],
    }, schema=SCHEMA)

    partition = root / f"source_format={source_format}" / f"source={Path(source_file).stem}"
    partition.mkdir(parents=True, exist_ok=True)
    pq.write_table(table, partition / "part-0.parquet", compression="zstd")

    prov = WriteProvenance(
        extractor_version=extractor_version,
        source_file=source_file,
        source_mtime=Path(source_file).stat().st_mtime,
        rows=len(records),
        written_at=datetime.now(timezone.utc).isoformat(),
    )
    (partition / "_provenance.json").write_text(json.dumps(asdict(prov), indent=2))
    return prov


def read_dataset(root: Path, *, columns: list[str] | None = None) -> pa.Table:
    """Column projection is the reason this is Parquet and not CSV."""
    return pq.read_table(root, columns=columns)


if __name__ == "__main__":
    prov = write_partition(
        [{"entity_id": "3vB2YO", "entity_type": "IfcWall",
          "layer_or_class": "IfcWall", "geometry_ref": "geom/3vB2YO",
          "attributes": {"FireRating": "EI60", "LoadBearing": "True"}}],
        Path("./metadata"), source_file="model.ifc", source_format="ifc",
        extractor_version="1.4.0",
    )
    print(prov)
```
{% endraw %}

<!-- fig:pq-partition -->
<svg viewBox="-20 -20 570 194.1" role="img" aria-label="Partitioning by source file confines a re-extraction and a failure to one directory instead of the dataset" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:570px;display:block;margin:1.5rem auto;">
  <title>What partitioning by source buys</title>
  <desc>Two dataset layouts. Written as one table, re-extracting a single drawing means rewriting everything and a failure part-way leaves the dataset inconsistent. Partitioned by source, a re-extraction replaces one directory, a failure is confined to it, and readers discover the partitioning automatically.</desc>
  <defs>
    <marker id="pq2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="pq2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="570" height="194.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="250" height="130" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4" stroke-dasharray="5 4"/>
  <text x="125" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">One table</text>
  <line x1="14" y1="33" x2="236" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="16" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— re-extraction rewrites everything</text>
  <text x="16" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— a failure leaves it inconsistent</text>
  <text x="16" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— no pruning on source</text>
  <text x="16" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— simplest to write once</text>
  <rect x="280" y="0" width="250" height="130" rx="6" fill="currentColor" fill-opacity="0.11" stroke="currentColor" stroke-width="1.9"/>
  <text x="405" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Partitioned by source</text>
  <line x1="294" y1="33" x2="516" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="296" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— re-extraction replaces one directory</text>
  <text x="296" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— failure confined to it</text>
  <text x="296" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— readers prune by partition</text>
  <text x="296" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— provenance per partition</text>
  <text x="265" y="152" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">Group by delivery rather than by file where per-file re-extraction is not needed.</text>
</svg>
<!-- /fig:pq-partition -->

**Key implementation notes:**

- The schema is declared, not inferred. Inference from the first chunk is how a column becomes a string because one early row had a stray value.
- `_as_map` drops `None` rather than storing an empty string, so absence and emptiness stay distinguishable — a distinction that matters in this domain more than most.
- Partitioning on source format and source file means a re-extraction of one drawing rewrites one directory. Rewriting the whole dataset for one changed input is the failure mode this avoids.
- Provenance is written per partition, so a query result can be traced to the extractor version and the source file's state at extraction time.
- `zstd` compression is a good default for this data: string-heavy, highly repetitive, and read far more often than written.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `pyarrow` | `>=14.0` | map type, dataset partitioning, zstd |
| Parquet readers | any modern | map columns widely supported; check older engines |
| Partition scheme | Hive-style | discovered automatically by most readers |
| Compression | `zstd` | `snappy` where a reader lacks zstd |
| Geometry | referenced, not embedded | keep in a spatial store |

## Fallback Strategies

**1. A reader cannot handle the map column.** Some older engines do not. Explode the map into key-value rows in a companion table, or promote the keys that matter into typed columns.

<!-- fig:pq-why-not-csv -->
<svg viewBox="-20 -20 429 184.1" role="img" aria-label="CSV, JSON lines and Parquet compared on type retention, column projection and schema evolution" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:429px;display:block;margin:1.5rem auto;">
  <title>What the format has to provide for this data</title>
  <desc>Three storage options against the properties extracted CAD metadata needs. Types have to survive a round trip because a numeric attribute read back as text breaks every aggregation. A column projection matters because queries touch a few attributes out of dozens. And the schema has to absorb new attributes without a migration.</desc>
  <defs>
    <marker id="pq3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="pq3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="429" height="184.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="389" height="122" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="389" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">Format</text>
  <text x="127.3" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Types survive</text>
  <line x1="175.5" y1="0" x2="175.5" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="233.2" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Column projection</text>
  <line x1="290.9" y1="0" x2="290.9" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="339.9" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">New attributes</text>
  <line x1="79.2" y1="0" x2="79.2" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="389" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">CSV</text>
  <text x="127.3" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.5">—</text>
  <text x="233.2" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.5">—</text>
  <text x="339.9" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">a new column</text>
  <line x1="0" y1="62" x2="389" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">JSON lines</text>
  <text x="127.3" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">partly</text>
  <text x="233.2" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.5">—</text>
  <text x="339.9" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">free</text>
  <line x1="0" y1="92" x2="389" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">Parquet</text>
  <text x="127.3" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">yes</text>
  <text x="233.2" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">yes</text>
  <text x="339.9" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">map column</text>
  <text x="0" y="142" font-size="9.5" fill="currentColor" fill-opacity="0.7">The middle column is the query budget on a dataset of millions of entities.</text>
</svg>
<!-- /fig:pq-why-not-csv -->

**2. Attribute names collide across sources.** Prefix by source format or by property set, as with the [IFC property set flattening](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/mapping-ifc-properties-to-geojson-attributes/). Collisions in a map are silent overwrites.

**3. Partitions proliferate.** One partition per drawing on a delivery of thousands produces many small files. Group by delivery rather than by file where individual re-extraction is not needed.

**4. A value should have been numeric.** Promote it to a typed column in the core schema and backfill. This is a migration and should be a deliberate one; the map exists so it can be deferred until the value is worth it.

**5. Provenance drifts from the data.** Write it in the same operation as the table, as above, so a partition without provenance means an interrupted write and can be re-run.

## FAQ

<details>
<summary><strong>Why Parquet rather than CSV?</strong></summary>

Because CAD metadata is heterogeneous and CSV has no types. Parquet carries a schema, so a column that is numeric stays numeric across a re-read, and it stores columns separately, so a query reading two attributes out of forty reads two columns off disk. On a dataset of millions of extracted entities that difference is the whole query budget.

</details>

<details>
<summary><strong>How do I handle attributes that only some sources have?</strong></summary>

Put them in a map column rather than adding a column per attribute. A `map<string, string>` holds an arbitrary attribute bag per row without a schema change, and promoting a frequently used key to a typed column later is a migration you do deliberately when the value justifies it.

</details>

<details>
<summary><strong>Should the geometry go in the same file?</strong></summary>

Usually not. Metadata and geometry have different access patterns — attributes are queried and aggregated, geometry is fetched by identifier — and different natural stores. Keep a stable identifier in both and let the metadata table reference the geometry store rather than embedding well-known binary in a column nobody filters on.

</details>

---

## Related Pages

- [Metadata Extraction Strategies](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/) — parent reference on the three metadata mechanisms this table normalises
- [Extracting Block Attributes from CAD Files with ezdxf](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/extracting-block-attributes-from-cad-files/) — one of the extractors that feeds this table
- [Mapping IFC Property Sets to PostGIS Columns](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/ifc4x3-schema-mapping/mapping-ifc-property-sets-to-postgis-columns/) — the same typed-core-plus-tail design in a database
