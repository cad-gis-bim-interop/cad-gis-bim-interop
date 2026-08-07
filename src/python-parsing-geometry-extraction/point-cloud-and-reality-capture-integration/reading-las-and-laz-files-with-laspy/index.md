---
title: "Reading LAS and LAZ Files with laspy"
description: "Read LAS and LAZ point clouds in Python with laspy: scaled versus raw coordinates, header-first inspection, chunked iteration for files larger than memory, classification filtering, and CRS extraction."
slug: "reading-las-and-laz-files-with-laspy"
breadcrumb:
  - label: "Python Parsing & Geometry Extraction"
    url: "/python-parsing-geometry-extraction/"
  - label: "Point Cloud and Reality Capture Integration"
    url: "/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/"
  - label: "Reading LAS and LAZ Files with laspy"
    url: "/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/reading-las-and-laz-files-with-laspy/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Reading LAS and LAZ Files with laspy",
      "description": "Read LAS and LAZ point clouds in Python with laspy: scaled versus raw coordinates, header-first inspection, chunked iteration for files larger than memory, classification filtering, and CRS extraction.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/reading-las-and-laz-files-with-laspy/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Python Parsing & Geometry Extraction", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/"},
        {"@type": "ListItem", "position": 2, "name": "Point Cloud and Reality Capture Integration", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/"},
        {"@type": "ListItem", "position": 3, "name": "Reading LAS and LAZ Files with laspy", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/reading-las-and-laz-files-with-laspy/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Read a LAS or LAZ point cloud with laspy",
      "description": "Inspect the header before allocating, extract the coordinate reference system, iterate in chunks, and apply the scale and offset that turn stored integers into real coordinates.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Inspect the header", "text": "Open the file and read point count, point format, scale, offset and bounds without reading any points."},
        {"@type": "HowToStep", "position": 2, "name": "Extract the coordinate reference system", "text": "Parse the CRS from the variable-length records and refuse to proceed when none is declared."},
        {"@type": "HowToStep", "position": 3, "name": "Iterate in chunks", "text": "Use the chunked iterator so peak memory is the chunk size rather than the file size."},
        {"@type": "HowToStep", "position": 4, "name": "Use the scaled accessors", "text": "Read the lower-case x, y and z properties, which apply the header scale and offset, rather than the raw integer arrays."},
        {"@type": "HowToStep", "position": 5, "name": "Filter inside the chunk loop", "text": "Apply classification and bounding-box filters per chunk so only the retained points accumulate."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is the difference between las.x and las.X?",
          "acceptedAnswer": {"@type": "Answer", "text": "The lower-case accessors return real coordinates: the stored integer multiplied by the header scale and added to the header offset. The upper-case accessors return the raw stored integers. Reading the raw values gives a cloud with the correct shape at the wrong origin and the wrong scale — the classic symptom is a site that appears to be thousands of kilometres across."}
        },
        {
          "@type": "Question",
          "name": "Why does laspy refuse to open my LAZ file?",
          "acceptedAnswer": {"@type": "Answer", "text": "LAZ is compressed and laspy needs a compression backend to decode it. Install laspy[lazrs] or laspy[laszip]. Without one, LAS opens and LAZ raises — which in a container is a dependency that was present in development and absent in the image."}
        },
        {
          "@type": "Question",
          "name": "How do I read only the ground points?",
          "acceptedAnswer": {"@type": "Answer", "text": "Filter on the classification field, which uses the ASPRS class numbering — 2 is ground. Do it inside the chunk loop so only ground points accumulate. Treat the classification as the producer's claim rather than as ground truth, and validate the resulting surface before building terrain from it."}
        }
      ]
    }
  ]
}
</script>

# Reading LAS and LAZ Files with laspy

To read a LAS or LAZ file in Python, open it with `laspy`, read the header before allocating anything, and iterate the points in chunks using the lower-case `x`, `y` and `z` accessors so the header scale and offset are applied. The two failures that dominate first attempts are reading the raw integer arrays, which yields coordinates at the wrong origin and scale, and reading the whole file, which for an airborne delivery is an out-of-memory kill. This page is part of [Point Cloud and Reality Capture Integration](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/).

## How LAS Stores a Point

A LAS file is a header followed by fixed-size point records. Each record stores X, Y and Z as 32-bit signed integers, and the header carries a scale and an offset per axis. The real coordinate is `raw * scale + offset`.

<!-- fig:las-accessors -->
<svg viewBox="-20 -20 562 194.1" role="img" aria-label="The upper-case LAS accessor returns raw integers; the lower-case one applies the header scale and offset" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:562px;display:block;margin:1.5rem auto;">
  <title>The two accessors and what each returns</title>
  <desc>Two ways of reading the same ordinate. The upper-case accessor returns the stored 32-bit integer, which has the right shape and neither the right origin nor the right scale. The lower-case accessor applies the header scale and offset and returns the real coordinate. Nothing distinguishes them at the call site except one character.</desc>
  <defs>
    <marker id="ls1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ls1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="562" height="194.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="246" height="130" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4" stroke-dasharray="5 4"/>
  <text x="123" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">las.X — raw</text>
  <line x1="14" y1="33" x2="232" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="16" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— the stored 32-bit integer</text>
  <text x="16" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— no scale, no offset</text>
  <text x="16" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— site appears kilometres across</text>
  <text x="16" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— looks like a unit error</text>
  <rect x="276" y="0" width="246" height="130" rx="6" fill="currentColor" fill-opacity="0.11" stroke="currentColor" stroke-width="1.9"/>
  <text x="399" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">las.x — scaled</text>
  <line x1="290" y1="33" x2="508" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="292" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— X * scale + offset</text>
  <text x="292" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— the real coordinate</text>
  <text x="292" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— sits where the survey says</text>
  <text x="292" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— what every consumer expects</text>
  <text x="261" y="152" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">One character apart, a thousandfold and a relocation apart in the result.</text>
</svg>
<!-- /fig:las-accessors -->

This is why a file spanning kilometres can carry millimetre resolution in 32 bits, and it is why the distinction between accessors matters. `las.X` gives the stored integer; `las.x` applies the transformation. The difference does not raise, it just relocates the survey.

The header also declares the *point format*, which decides what attributes exist. Intensity and return number are present in every format; GPS time, colour, and near-infrared are not. Code that reads `las.red` on a format without colour fails, and code that assumes `las.classification` is meaningful succeeds on a file where nothing assigned it.

Finally, the coordinate reference system lives in the variable-length records, either as WKT or as legacy GeoTIFF keys depending on the LAS version. `laspy` exposes both through one accessor, which returns `None` when the file declares nothing.

## Production-Ready Script

{% raw %}
```python
# laspy[lazrs]>=2.5, numpy>=1.24, Python 3.9+
from __future__ import annotations

from dataclasses import dataclass
import numpy as np
import laspy


@dataclass(frozen=True)
class CloudHeader:
    count: int
    point_format: int
    scales: tuple[float, float, float]
    offsets: tuple[float, float, float]
    mins: tuple[float, float, float]
    maxs: tuple[float, float, float]
    crs_wkt: str | None
    has_classification: bool
    has_colour: bool


def inspect(path: str) -> CloudHeader:
    """Header only — one seek, and it decides every later choice."""
    with laspy.open(path) as reader:
        h = reader.header
        dims = {d.name for d in h.point_format.dimensions}
        crs = h.parse_crs()
        return CloudHeader(
            count=h.point_count,
            point_format=h.point_format.id,
            scales=tuple(h.scales), offsets=tuple(h.offsets),
            mins=tuple(h.mins), maxs=tuple(h.maxs),
            crs_wkt=crs.to_wkt() if crs is not None else None,
            has_classification="classification" in dims,
            has_colour={"red", "green", "blue"} <= dims,
        )


def read_filtered(
    path: str,
    *,
    classes: set[int] | None = None,
    bbox: tuple[float, float, float, float] | None = None,
    chunk: int = 2_000_000,
) -> np.ndarray:
    """Chunked read returning an (n, 3) float64 array of REAL coordinates."""
    meta = inspect(path)
    if meta.crs_wkt is None:
        raise ValueError(f"{path}: no CRS in the variable-length records")
    if classes and not meta.has_classification:
        raise ValueError(f"{path}: point format {meta.point_format} has no classification")

    kept: list[np.ndarray] = []
    with laspy.open(path) as reader:
        for points in reader.chunk_iterator(chunk):
            mask = np.ones(len(points), dtype=bool)
            if classes:
                mask &= np.isin(points.classification, list(classes))
            # .x/.y/.z apply the header scale and offset; .X/.Y/.Z do not.
            x, y, z = np.asarray(points.x), np.asarray(points.y), np.asarray(points.z)
            if bbox:
                minx, miny, maxx, maxy = bbox
                mask &= (x >= minx) & (x <= maxx) & (y >= miny) & (y <= maxy)
            if mask.any():
                kept.append(np.column_stack((x[mask], y[mask], z[mask])))

    if not kept:
        return np.empty((0, 3), dtype=float)
    return np.vstack(kept)


if __name__ == "__main__":
    meta = inspect("survey.laz")
    print(f"{meta.count:,} points, format {meta.point_format}, "
          f"classification={meta.has_classification}")
    ground = read_filtered("survey.laz", classes={2})
    print(f"ground points: {len(ground):,}")
```
{% endraw %}

<!-- fig:las-chunked -->
<svg viewBox="-45 -20 490.9 310.8" role="img" aria-label="Header first, then CRS, then chunked iteration with filtering inside the loop so peak memory stays bounded" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:491px;display:block;margin:1.5rem auto;">
  <title>Reading a file larger than memory</title>
  <desc>Four stages. The header is read alone, costing one seek and settling whether the file can be handled at all. The coordinate reference system is resolved or the read is refused. Points are then iterated in fixed-size chunks, and filtering happens inside the chunk so only retained points accumulate. Peak memory is the chunk plus the result, never the file.</desc>
  <defs>
    <marker id="ls2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ls2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-45" y="-20" width="490.9" height="310.8" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="262" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="131" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Read the header</text>
  <text x="131" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">count, format, scale, bounds</text>
  <circle cx="-14" cy="24.1" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="27.6" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">1</text>
  <text x="280" y="27.6" font-size="9.5" fill="currentColor" fill-opacity="0.75">one seek, no points</text>
  <rect x="0" y="74.2" width="262" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="131" y="94.5" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Resolve the CRS</text>
  <text x="131" y="108.2" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">or refuse the file</text>
  <circle cx="-14" cy="98.3" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="101.8" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">2</text>
  <text x="280" y="101.8" font-size="9.5" fill="currentColor" fill-opacity="0.75">never assume the project system</text>
  <rect x="0" y="148.4" width="262" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="131" y="168.7" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Iterate in chunks</text>
  <text x="131" y="182.4" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">fixed size</text>
  <circle cx="-14" cy="172.5" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="176" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">3</text>
  <text x="280" y="176" font-size="9.5" fill="currentColor" fill-opacity="0.75">peak memory is the chunk</text>
  <rect x="0" y="222.6" width="262" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="131" y="242.9" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Filter inside the loop</text>
  <text x="131" y="256.6" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">class and bounding box</text>
  <circle cx="-14" cy="246.7" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="250.2" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">4</text>
  <text x="280" y="250.2" font-size="9.5" fill="currentColor" fill-opacity="0.75">only survivors accumulate</text>
  <line x1="131" y1="48.2" x2="131" y2="74.2" stroke="currentColor" stroke-width="1.4" marker-end="url(#ls2-a)"/>
  <line x1="131" y1="122.4" x2="131" y2="148.4" stroke="currentColor" stroke-width="1.4" marker-end="url(#ls2-a)"/>
  <line x1="131" y1="196.6" x2="131" y2="222.6" stroke="currentColor" stroke-width="1.4" marker-end="url(#ls2-a)"/>
</svg>
<!-- /fig:las-chunked -->

**Key implementation notes:**

- `inspect` never reads a point. On a 400-million-point file that is the difference between a decision and a memory kill.
- The CRS check raises rather than defaulting. An unlabelled cloud assumed into the project system is the point-cloud equivalent of a DXF assumed into millimetres.
- Filtering happens inside the chunk loop, so peak memory is one chunk plus the retained points rather than the whole file.
- `np.isin` handles a set of classes in one vectorised pass; a Python-level membership test per point dominates the runtime.
- The classification availability check fails early with a useful message instead of raising an attribute error deep in the loop.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `laspy` | `>=2.5` | `chunk_iterator`, `parse_crs` |
| LAZ support | `lazrs` or `laszip` backend | LAS works without one; LAZ does not |
| LAS versions | 1.2 – 1.4 | 1.4 adds WKT CRS and extended point formats |
| Point formats | 0 – 10 | attribute availability varies; check before reading |
| `numpy` | `>=1.24` | column stacking and boolean masking |

## Fallback Strategies

**1. `LaspyException` on a LAZ file.** No compression backend. Install `laspy[lazrs]`, and assert the backend at start-up so the failure surfaces at deploy rather than on the first compressed delivery.

<!-- fig:las-formats -->
<svg viewBox="-20 -20 431.6 214.1" role="img" aria-label="LAS point formats 0, 2, 3 and 7 compared on classification, GPS time and colour availability" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:432px;display:block;margin:1.5rem auto;">
  <title>What each point format actually carries</title>
  <desc>Four LAS point data record formats and the attributes each provides. Position, intensity and return number are universal; classification, GPS time and colour are not. Code that reads an attribute a format does not carry raises, and code that trusts a classification nothing assigned succeeds and returns nonsense.</desc>
  <defs>
    <marker id="ls3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ls3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="431.6" height="214.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="283.7" height="152" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="283.7" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">Format</text>
  <text x="107.9" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Classification</text>
  <line x1="154.3" y1="0" x2="154.3" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="190.6" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">GPS time</text>
  <line x1="226.8" y1="0" x2="226.8" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="255.3" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Colour</text>
  <line x1="61.4" y1="0" x2="61.4" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="283.7" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">0</text>
  <text x="107.9" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">yes</text>
  <text x="190.6" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.5">—</text>
  <text x="255.3" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.5">—</text>
  <line x1="0" y1="62" x2="283.7" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">2</text>
  <text x="107.9" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">yes</text>
  <text x="190.6" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.5">—</text>
  <text x="255.3" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">yes</text>
  <line x1="0" y1="92" x2="283.7" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">3</text>
  <text x="107.9" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">yes</text>
  <text x="190.6" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">yes</text>
  <text x="255.3" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">yes</text>
  <line x1="0" y1="122" x2="283.7" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="140.5" font-size="10.5" font-weight="600" fill="currentColor">7</text>
  <text x="107.9" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">extended</text>
  <text x="190.6" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">yes</text>
  <text x="255.3" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">yes</text>
  <text x="0" y="172" font-size="9.5" fill="currentColor" fill-opacity="0.7">Check availability from the header before reading; the failure is an attribute error mid-loop.</text>
</svg>
<!-- /fig:las-formats -->

**2. Coordinates are absurdly large.** Raw accessors. Change `las.X` to `las.x`; the magnitude of the error is the reciprocal of the header scale, typically a thousand.

**3. No CRS in the file.** Common in processing intermediates and in PLY or PCD conversions. Obtain it from the survey report and record it explicitly rather than assuming — and prefer keeping the cloud in LAS so the metadata has somewhere to live.

**4. Classification is all zeros.** The producer never ran a classifier. Filtering on class 2 then returns nothing, which looks like a bug in the filter. Check the distinct classification values before relying on them.

**5. The bounding box filter returns nothing.** The bbox is in a different coordinate system from the cloud. Compare the filter bounds against `meta.mins` and `meta.maxs` before assuming the file is empty of the area of interest.

## FAQ

<details>
<summary><strong>What is the difference between las.x and las.X?</strong></summary>

The lower-case accessors return real coordinates: the stored integer multiplied by the header scale and added to the header offset. The upper-case accessors return the raw stored integers. Reading the raw values gives a cloud with the correct shape at the wrong origin and the wrong scale — the classic symptom is a site that appears to be thousands of kilometres across.

</details>

<details>
<summary><strong>Why does laspy refuse to open my LAZ file?</strong></summary>

LAZ is compressed and `laspy` needs a compression backend to decode it. Install `laspy[lazrs]` or `laspy[laszip]`. Without one, LAS opens and LAZ raises — which in a container is a dependency that was present in development and absent in the image.

</details>

<details>
<summary><strong>How do I read only the ground points?</strong></summary>

Filter on the classification field, which uses the ASPRS class numbering — 2 is ground. Do it inside the chunk loop so only ground points accumulate. Treat the classification as the producer's claim rather than as ground truth, and validate the resulting surface before building terrain from it.

</details>

---

## Related Pages

- [Point Cloud and Reality Capture Integration](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/) — parent reference on density, coordinate metadata and registration
- [Clipping Point Clouds to CAD Boundaries in Python](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/clipping-point-clouds-to-cad-boundaries-in-python/) — the next step for most pipelines that read a cloud
- [Aligning a Point Cloud to a BIM Model with ICP](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/aligning-a-point-cloud-to-a-bim-model-with-icp/) — sibling guide on registering the cloud once it is read
