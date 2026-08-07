---
title: "Extracting Navisworks Clash Data for GIS"
description: "Turn a Navisworks clash report into mappable data with Python: parse the XML, read clash points and status, reproject into the project CRS, and aggregate clash density onto a grid for GIS analysis."
slug: "extracting-navisworks-clash-data-for-gis"
breadcrumb:
  - label: "Python Parsing & Geometry Extraction"
    url: "/python-parsing-geometry-extraction/"
  - label: "Revit and Navisworks Export Paths"
    url: "/python-parsing-geometry-extraction/revit-and-navisworks-export-paths/"
  - label: "Extracting Navisworks Clash Data for GIS"
    url: "/python-parsing-geometry-extraction/revit-and-navisworks-export-paths/extracting-navisworks-clash-data-for-gis/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Extracting Navisworks Clash Data for GIS",
      "description": "Turn a Navisworks clash report into mappable data with Python: parse the XML, read clash points and status, reproject into the project CRS, and aggregate clash density onto a grid for GIS analysis.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/revit-and-navisworks-export-paths/extracting-navisworks-clash-data-for-gis/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Python Parsing & Geometry Extraction", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/"},
        {"@type": "ListItem", "position": 2, "name": "Revit and Navisworks Export Paths", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/revit-and-navisworks-export-paths/"},
        {"@type": "ListItem", "position": 3, "name": "Extracting Navisworks Clash Data for GIS", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/revit-and-navisworks-export-paths/extracting-navisworks-clash-data-for-gis/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Turn a Navisworks clash report into GIS features",
      "description": "Parse the clash XML, extract positions and status, transform model coordinates into the project system, and aggregate density onto a grid.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Parse the clash report", "text": "Read the exported XML and extract each clash result with its name, status, distance and position."},
        {"@type": "HowToStep", "position": 2, "name": "Filter by status", "text": "Separate active clashes from those already reviewed, approved or resolved, because only some of them describe outstanding work."},
        {"@type": "HowToStep", "position": 3, "name": "Transform into the project system", "text": "Apply the model-to-project transform so clash positions share a coordinate system with everything else the pipeline produces."},
        {"@type": "HowToStep", "position": 4, "name": "Aggregate onto a grid", "text": "Bin the positions onto a regular grid so clash density becomes mappable rather than a list of points."},
        {"@type": "HowToStep", "position": 5, "name": "Write as GIS features", "text": "Emit the points and the density grid as features carrying their clash identifiers so a map can link back to the report."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What coordinate system are clash positions in?",
          "acceptedAnswer": {"@type": "Answer", "text": "Model coordinates — the coordinate system of the federated model in Navisworks, which is usually the coordinate system of whichever source model was appended first. They are not projected coordinates, and they carry the same origin and rotation as that source model, so the transform to the project system is the same one that georeferences the model itself."}
        },
        {
          "@type": "Question",
          "name": "Should I map every clash?",
          "acceptedAnswer": {"@type": "Answer", "text": "No. A clash report contains results at several statuses — new, active, reviewed, approved, resolved — and mapping all of them presents resolved work as outstanding. Filter by status first, and keep the status on the feature so a map can be re-filtered without re-extracting."}
        },
        {
          "@type": "Question",
          "name": "Why aggregate onto a grid at all?",
          "acceptedAnswer": {"@type": "Answer", "text": "Because a clash report is usually thousands of points that are individually uninformative and collectively very informative. Density on a grid shows where coordination is failing — one grid square with two hundred clashes is a design conflict, two hundred squares with one clash each is normal tolerance noise — and that distinction is invisible in a point plot."}
        }
      ]
    }
  ]
}
</script>

# Extracting Navisworks Clash Data for GIS

A Navisworks clash report exports as XML, which makes it the one thing in the Navisworks ecosystem a Python pipeline can read without the application. Parse the results, filter by status, transform the positions from model coordinates into the project system, and aggregate onto a grid so density rather than individual points becomes the finding. This page is part of [Revit and Navisworks Export Paths](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/revit-and-navisworks-export-paths/).

## What a Clash Report Contains

Each result records a name, a status, a distance of intersection, the two objects involved, and a position — the point the application computed as representative of the intersection. That position is in the federated model's coordinate system, which is inherited from whichever source model was appended first and is therefore the same system the model itself needs georeferencing from.

<!-- fig:clash-fields -->
<svg viewBox="-20 -20 426 156.1" role="img" aria-label="Name, status, distance and position — the clash result fields and the decision each drives" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:426px;display:block;margin:1.5rem auto;">
  <title>One clash result and what each field decides</title>
  <desc>The fields of a single result and the pipeline decision each one drives. Status separates outstanding work from closed; distance separates a genuine conflict from a tolerance overlap; the position is in model coordinates and inherits the model georeferencing. Mapping every result regardless of status presents resolved work as open.</desc>
  <defs>
    <marker id="nc1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="nc1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="426" height="156.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="159.1" height="92" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.5"/>
  <text x="14" y="16" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">name      Clash1247</text>
  <line x1="165.1" y1="12.9" x2="197.1" y2="12.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="205.1" y="16" font-size="9.5" fill="currentColor" fill-opacity="0.78">the report identifier, kept for linking</text>
  <text x="14" y="35" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">status    active</text>
  <line x1="165.1" y1="31.9" x2="197.1" y2="31.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="205.1" y="35" font-size="9.5" fill="currentColor" fill-opacity="0.78">separates outstanding from closed</text>
  <text x="14" y="54" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">distance  0.412</text>
  <line x1="165.1" y1="50.9" x2="197.1" y2="50.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="205.1" y="54" font-size="9.5" fill="currentColor" fill-opacity="0.78">conflict, not tolerance overlap</text>
  <text x="14" y="73" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">pos3f     x, y, z</text>
  <line x1="165.1" y1="69.9" x2="197.1" y2="69.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="205.1" y="73" font-size="9.5" fill="currentColor" fill-opacity="0.78">model coordinates — needs the transform</text>
  <text x="0" y="114" font-size="9.5" fill="currentColor" fill-opacity="0.7">Filter on status and distance before mapping, and keep both on the feature.</text>
</svg>
<!-- /fig:clash-fields -->

Status matters more than it appears to. A report exported from a live coordination process contains results at every stage of review, and treating them uniformly presents closed work as open. Status is also the field most likely to have project-specific conventions layered on top of the standard values, so it is worth carrying through rather than collapsing.

Distance is the depth of intersection, and it separates a genuine conflict from a tolerance overlap. A 2 mm intersection between a duct and a structural zone is usually noise; a 400 mm one is not. Filtering on distance before mapping removes most of the volume without removing any of the findings.

## Production-Ready Script

{% raw %}
```python
# lxml>=4.9, numpy>=1.24, shapely>=2.0, Python 3.9+
from __future__ import annotations

from dataclasses import dataclass
from collections import Counter
import numpy as np
from lxml import etree
from shapely.geometry import Point, box


@dataclass(frozen=True)
class Clash:
    name: str
    status: str
    distance_m: float
    x: float
    y: float
    z: float


def read_clashes(xml_path: str) -> list[Clash]:
    tree = etree.parse(xml_path)
    out: list[Clash] = []
    for result in tree.iter("clashresult"):
        pos = result.find("clashpoint/pos3f")
        if pos is None:
            continue                      # a grouped result with no representative point
        out.append(Clash(
            name=result.get("name", ""),
            status=(result.get("status") or "unknown").lower(),
            distance_m=abs(float(result.get("distance", "0"))),
            x=float(pos.get("x")), y=float(pos.get("y")), z=float(pos.get("z")),
        ))
    return out


def to_project(clashes: list[Clash], model_to_project: np.ndarray) -> np.ndarray:
    """Apply the 4x4 model-to-project transform to every clash position."""
    pts = np.array([[c.x, c.y, c.z, 1.0] for c in clashes], dtype=float)
    return (pts @ np.asarray(model_to_project).T)[:, :3]


def density_grid(xy: np.ndarray, cell_m: float = 5.0) -> list[tuple]:
    """Bin positions onto a regular grid; returns (polygon, count) per occupied cell."""
    if len(xy) == 0:
        return []
    origin = np.floor(xy.min(axis=0) / cell_m) * cell_m
    idx = np.floor((xy - origin) / cell_m).astype(int)
    counts = Counter(map(tuple, idx))
    cells = []
    for (i, j), n in sorted(counts.items(), key=lambda kv: -kv[1]):
        x0, y0 = origin + np.array([i, j]) * cell_m
        cells.append((box(x0, y0, x0 + cell_m, y0 + cell_m), n))
    return cells


def outstanding(clashes: list[Clash], *, min_distance_m: float = 0.01) -> list[Clash]:
    open_states = {"new", "active"}
    return [c for c in clashes
            if c.status in open_states and c.distance_m >= min_distance_m]


if __name__ == "__main__":
    all_clashes = read_clashes("clashes.xml")
    live = outstanding(all_clashes)
    print(f"{len(live)} outstanding of {len(all_clashes)} results")
    xyz = to_project(live, model_to_project=np.eye(4))
    for cell, n in density_grid(xyz[:, :2], cell_m=5.0)[:5]:
        print(f"{n:4d} clashes in cell centred {cell.centroid.x:.1f}, {cell.centroid.y:.1f}")
```
{% endraw %}

<!-- fig:clash-to-density -->
<svg viewBox="-20 -33.5 589.3 101.7" role="img" aria-label="Filter, transform, bin onto a grid, then report by cell — turning clash points into a density finding" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:589px;display:block;margin:1.5rem auto;">
  <title>From a list of points to a finding</title>
  <desc>Four stages. Results are filtered to those that are open and above the coordination tolerance, transformed from model coordinates into the project system, binned onto a regular grid, and reported by cell. The binning is what turns thousands of individually uninformative points into a statement about where coordination is failing.</desc>
  <defs>
    <marker id="nc2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="nc2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-33.5" width="589.3" height="101.7" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="128.8" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="64.4" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Filter</text>
  <text x="64.4" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">open, above tolerance</text>
  <rect x="162.8" y="0" width="122.9" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="224.2" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Project system</text>
  <text x="224.2" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">model-to-project 4×4</text>
  <rect x="319.7" y="0" width="89.9" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="364.6" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Grid cells</text>
  <text x="364.6" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">count per cell</text>
  <rect x="443.6" y="0" width="105.7" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="496.4" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">The finding</text>
  <text x="496.4" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">where it is failing</text>
  <line x1="128.8" y1="24.1" x2="162.8" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#nc2-a)"/>
  <text x="145.8" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">transform</text>
  <line x1="285.7" y1="24.1" x2="319.7" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#nc2-a)"/>
  <text x="302.7" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">bin</text>
  <line x1="409.6" y1="24.1" x2="443.6" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#nc2-a)"/>
  <text x="426.6" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">rank</text>
</svg>
<!-- /fig:clash-to-density -->

**Key implementation notes:**

- Results without a representative point are skipped rather than defaulted to the origin, which would put a phantom cluster at model zero.
- Status is lower-cased once at parse time so downstream filters do not have to care about the report's casing.
- The transform is applied to whole arrays rather than per clash, and it is the same 4×4 the model georeferencing produces — clash positions are model coordinates, not a separate system.
- `density_grid` returns cells sorted by count, so the first few rows are the finding.
- `min_distance_m` filters tolerance-level intersections. Set it from the project's coordination tolerance rather than leaving it at a default.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `lxml` | `>=4.9` | `iter` over clash results |
| Report format | Navisworks clash XML | element names stable across recent releases |
| `numpy` | `>=1.24` | transform application and binning |
| `shapely` | `>=2.0` | grid cell polygons |
| Coordinate input | model coordinates | transform supplied by the caller |

## Fallback Strategies

**1. Positions cluster at the origin.** Results without a representative point were defaulted rather than skipped, or the transform was not applied. Check the skip count first.

<!-- fig:clash-density-shape -->
<svg viewBox="-20 -20 540.2 124.1" role="img" aria-label="A concentrated clash distribution is one design conflict; a flat one is tolerance noise, and totals do not distinguish them" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:540px;display:block;margin:1.5rem auto;">
  <title>Two clash distributions that sum to the same total</title>
  <desc>The count in the busiest grid cell for two reports with similar totals. A distribution concentrated in one cell is a systematic design conflict — a service route through a structural zone — and a single fix closes most of it. A flat distribution across many cells is tolerance noise. The total alone does not distinguish them, which is the reason for binning.</desc>
  <defs>
    <marker id="nc3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="nc3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="540.2" height="124.1" fill="var(--color-surface)"/>
  <text x="134.6" y="11.5" text-anchor="end" font-size="10.5" fill="currentColor" fill-opacity="0.9">busiest cell — concentrated</text>
  <rect x="144.6" y="0" width="290" height="16" rx="3" fill="currentColor" fill-opacity="0.42" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.9"/>
  <text x="442.6" y="11.5" font-size="10" font-weight="600" fill="currentColor" fill-opacity="0.85">214 clashes</text>
  <text x="134.6" y="41.5" text-anchor="end" font-size="10.5" fill="currentColor" fill-opacity="0.9">busiest cell — dispersed</text>
  <rect x="144.6" y="30" width="8.1" height="16" rx="3" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <text x="160.7" y="41.5" font-size="10" fill="currentColor" fill-opacity="0.85">6 clashes</text>
  <line x1="144.6" y1="48" x2="434.6" y2="48" stroke="currentColor" stroke-width="1" stroke-opacity="0.35"/>
  <text x="144.6" y="63" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.6">0</text>
  <text x="434.6" y="63" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.6">214</text>
  <text x="0" y="82" font-size="9.5" fill="currentColor" fill-opacity="0.7">Both reports carry roughly 900 results; only one of them describes a single problem.</text>
</svg>
<!-- /fig:clash-density-shape -->

**2. Status values are project-specific.** Extend `open_states` from the project's own vocabulary rather than assuming the standard set, and log the distinct values found so an unexpected one is visible.

**3. Grouped clashes collapse detail.** A grouped result may represent many intersections and carries one point. Where counts matter, export ungrouped, or weight the grid by the group size where it is recorded.

**4. Density map dominated by one area.** Usually a single systematic conflict — a service route through a structural zone — producing hundreds of results. That is a finding, not a distortion; report the count and the cell rather than smoothing it away.

**5. The transform is unknown.** Clash positions are only mappable once the model's own georeferencing is resolved. Do that first; the same transform serves both.

## FAQ

<details>
<summary><strong>What coordinate system are clash positions in?</strong></summary>

Model coordinates — the coordinate system of the federated model in Navisworks, which is usually the coordinate system of whichever source model was appended first. They are not projected coordinates, and they carry the same origin and rotation as that source model, so the transform to the project system is the same one that georeferences the model itself.

</details>

<details>
<summary><strong>Should I map every clash?</strong></summary>

No. A clash report contains results at several statuses — new, active, reviewed, approved, resolved — and mapping all of them presents resolved work as outstanding. Filter by status first, and keep the status on the feature so a map can be re-filtered without re-extracting.

</details>

<details>
<summary><strong>Why aggregate onto a grid at all?</strong></summary>

Because a clash report is usually thousands of points that are individually uninformative and collectively very informative. Density on a grid shows where coordination is failing — one grid square with two hundred clashes is a design conflict, two hundred squares with one clash each is normal tolerance noise — and that distinction is invisible in a point plot.

</details>

---

## Related Pages

- [Revit and Navisworks Export Paths](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/revit-and-navisworks-export-paths/) — parent reference on which export carries what
- [Writing CAD Geometry to PostGIS with GeoAlchemy2](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/geopackage-vs-postgis-for-cad-output/writing-cad-geometry-to-postgis-with-geoalchemy2/) — storing the resulting features
- [Aligning BIM Models with GIS Survey Data](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/aligning-bim-models-with-gis-survey-data/) — the transform that takes model coordinates into the project system
