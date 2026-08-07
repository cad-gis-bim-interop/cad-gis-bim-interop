---
title: "Vertical Datums and Height Systems"
description: "Reconcile ellipsoidal, orthometric and project heights in Python: geoid separation, compound CRS definitions in pyproj, and the checks that catch a shift."
slug: "vertical-datums-and-height-systems"
breadcrumb:
  - label: "Coordinate Transformation & Spatial Alignment"
    url: "/coordinate-transformation-spatial-alignment/"
  - label: "Vertical Datums and Height Systems"
    url: "/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Vertical Datums and Height Systems",
      "description": "Reconcile ellipsoidal, orthometric and project heights in Python: geoid separation, compound CRS definitions in pyproj, and the checks that catch a shift.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Coordinate Transformation & Spatial Alignment", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/"},
        {"@type": "ListItem", "position": 2, "name": "Vertical Datums and Height Systems", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Reconcile vertical datums in a Python interoperability pipeline",
      "description": "Identify the height system each source uses, define a compound CRS, apply the geoid separation with pyproj, and verify against a levelled benchmark.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Identify the height system per source", "text": "Establish for every input whether its Z values are ellipsoidal, orthometric on a named vertical datum, or a project datum with an arbitrary origin."},
        {"@type": "HowToStep", "position": 2, "name": "Define a compound CRS", "text": "Build a compound CRS in pyproj that pairs the horizontal CRS with an explicit vertical CRS, so PROJ can select a geoid model rather than passing Z through unchanged."},
        {"@type": "HowToStep", "position": 3, "name": "Apply the transformation in 3D", "text": "Transform with a Transformer built from the compound CRSs and pass the z argument, since a 2D transformer silently returns the input height."},
        {"@type": "HowToStep", "position": 4, "name": "Resolve the project height datum", "text": "Apply the constant offset that relates the BIM or CAD project elevation to the national datum, taken from the project setup rather than inferred."},
        {"@type": "HowToStep", "position": 5, "name": "Verify against a benchmark", "text": "Transform the coordinates of a levelled benchmark and compare the resulting height against its published value before accepting the run."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is the difference between ellipsoidal and orthometric height?",
          "acceptedAnswer": {"@type": "Answer", "text": "An ellipsoidal height is the distance from the reference ellipsoid, which is what GNSS measures directly. An orthometric height is the distance from the geoid — the equipotential surface that approximates mean sea level — which is what levelling measures and what drainage, flood and building-height regulations are written against. The two differ by the geoid separation N, related by h = H + N. Across a single country N typically varies by tens of metres, so the two are never interchangeable."}
        },
        {
          "@type": "Question",
          "name": "Why does pyproj return my Z value unchanged?",
          "acceptedAnswer": {"@type": "Answer", "text": "Because the transformation you built is horizontal. A Transformer created from two 2D CRS definitions has nothing to say about height, so it passes z through untouched and raises nothing. Build both sides as compound CRS definitions — a horizontal CRS paired with a vertical CRS — and pass z to transform(); only then does PROJ select a vertical transformation and apply a geoid model."}
        },
        {
          "@type": "Question",
          "name": "Do I need to download a geoid grid?",
          "acceptedAnswer": {"@type": "Answer", "text": "For a metre-level result, no: PROJ ships approximate global models. For anything survey-grade, yes. National geoid grids are distributed through the PROJ CDN and can be fetched with projsync, or installed as a data package. A pipeline that must be reproducible should pin the grid package and record its version alongside the output, because a grid revision changes results without changing any code."}
        },
        {
          "@type": "Question",
          "name": "What height does an IFC model use?",
          "acceptedAnswer": {"@type": "Answer", "text": "By default, a project-local one. Model Z values are measured from the project base point, and the relationship between that point and any national datum lives in IfcMapConversion.OrthogonalHeight when the model is georeferenced, or in the project setup documentation when it is not. Never assume model Z is orthometric height; read the offset or obtain it, and record which of the two you did."}
        },
        {
          "@type": "Question",
          "name": "Can I ignore vertical datums for a 2D deliverable?",
          "acceptedAnswer": {"@type": "Answer", "text": "Only if the deliverable is genuinely two-dimensional and stays that way. The moment a Z ordinate is carried — a 3D GeoPackage column, a GEOMETRYZ PostGIS column, a glTF export — it acquires a datum whether or not anyone chose one, and an unlabelled height is indistinguishable from a wrong one. If Z travels, its datum should travel with it."}
        }
      ]
    }
  ]
}
</script>

# Vertical Datums and Height Systems

A vertical datum is the surface a Z value is measured from, and reconciling the several that arrive in one project is the part of the [Coordinate Transformation & Spatial Alignment](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/) pipeline that most often survives review unnoticed and fails on site.

Horizontal misalignment is visible: an asset drawn in the wrong field is obvious on a map. A vertical error is not. A pipe invert 2.4 m below where the model says it is looks entirely reasonable in plan, in section, and in every automated check that does not know what surface the height was measured from. The datasets that meet in an infrastructure project routinely carry three different height systems at once — GNSS survey in ellipsoidal height, levelled data on a national orthometric datum, and a BIM model on a project datum whose origin was chosen for drafting convenience — and none of the three formats involved compels anyone to say which is which.

## Prerequisites

- **Python 3.9+** with type hints and `pathlib`.
- **`pyproj>=3.5.0`**, built against **PROJ 9.x**. Earlier PROJ releases handle compound coordinate reference systems less consistently, and the grid-fetching behaviour differs.
- **Network access or a pinned grid package** for geoid models, if survey-grade results are required.
- Working knowledge of your project's horizontal CRS and, critically, of which vertical datum each incoming dataset was observed on — this is a question for the surveyor, not something to infer.

{% raw %}
```bash
# pyproj>=3.5.0 (PROJ 9.x)
pip install "pyproj>=3.5.0"

# Fetch the geoid grids for a bounding box, once, at image build time
projsync --bbox -8,49,2,61 --file uk_os_OSGM15_GB.tif
```
{% endraw %}

Verify the installation resolves a vertical transformation before writing pipeline code:

{% raw %}
```python
# pyproj>=3.5.0
from pyproj import CRS, Transformer

compound = CRS.from_epsg(7405)      # OSGB36 / British National Grid + ODN height
print(compound.is_compound)          # True
print([sub.name for sub in compound.sub_crs_list])
```
{% endraw %}

If `is_compound` is `False`, the code you write against it will move X and Y and leave Z alone.

## Architectural Overview

Three surfaces are involved, and every height in a project is measured from one of them.

<!-- fig:vd-three-surfaces -->
<svg viewBox="-20 -20 697 198" role="img" aria-label="Ellipsoid, geoid and project datum — the three surfaces a height in a CAD, GIS or BIM project can be measured from" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:697px;display:block;margin:1.5rem auto;">
  <title>The three surfaces a height can be measured from</title>
  <desc>Three reference surfaces stacked from the smooth mathematical ellipsoid at the bottom, through the undulating geoid that water responds to, to the arbitrary project datum a drawing is authored against. Every height in a project is measured from exactly one of them, and the differences between them are tens of metres rather than centimetres.</desc>
  <defs>
    <marker id="vd1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="vd1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="697" height="198" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="520" height="46" rx="6" fill="currentColor" fill-opacity="0.14" stroke="currentColor" stroke-width="2"/>
  <text x="16" y="21" font-size="11.5" font-weight="600" fill="currentColor">Project datum</text>
  <text x="16" y="35" font-size="9.5" fill="currentColor" fill-opacity="0.72">origin chosen for drafting convenience</text>
  <text x="504" y="26.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">per project</text>
  <rect x="0" y="56" width="520" height="46" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="16" y="77" font-size="11.5" font-weight="600" fill="currentColor">Geoid</text>
  <text x="16" y="91" font-size="9.5" fill="currentColor" fill-opacity="0.72">equipotential surface — what water responds to</text>
  <text x="504" y="82.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">orthometric H</text>
  <rect x="0" y="112" width="520" height="46" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="16" y="133" font-size="11.5" font-weight="600" fill="currentColor">Reference ellipsoid</text>
  <text x="16" y="147" font-size="9.5" fill="currentColor" fill-opacity="0.72">smooth mathematical figure</text>
  <text x="504" y="138.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">ellipsoidal h</text>
  <line x1="546" y1="2" x2="546" y2="156" stroke="currentColor" stroke-width="1.4" stroke-opacity="0.6" marker-end="url(#vd1-a)"/>
  <text x="554" y="79" font-size="9.5" fill="currentColor" fill-opacity="0.7">increasing arbitrariness</text>
</svg>
<!-- /fig:vd-three-surfaces -->

The **reference ellipsoid** is a smooth mathematical figure fitted to the Earth. It is what a horizontal CRS is defined against, and a GNSS receiver reports position relative to it. Heights measured from it are *ellipsoidal heights*, conventionally written `h`.

The **geoid** is the equipotential surface of the Earth's gravity field that best approximates mean sea level. It is not smooth — it undulates with the distribution of mass beneath it — and it is what water responds to. Heights measured from it are *orthometric heights*, written `H`, and every drainage gradient, flood level and building-height limit is defined against a national realisation of it.

The **geoid separation** `N` is the difference between the two at a given horizontal position, so `h = H + N`. `N` is not a constant. Over a country it varies by tens of metres and over a large site it can vary by tens of centimetres, which is why applying a single average separation across a project is a defensible approximation for planning and an indefensible one for setting out.

On top of these sits the **project datum** used inside CAD and BIM: an arbitrary origin, often chosen so that a floor level is a round number. Its relationship to a national datum is a single constant offset, and that constant lives in the project setup rather than in the geometry.

| Height system | Measured from | Produced by | Typical use |
|---|---|---|---|
| Ellipsoidal `h` | reference ellipsoid | GNSS, photogrammetry | raw survey, point clouds |
| Orthometric `H` | geoid (national realisation) | levelling, geoid-corrected GNSS | drainage, flood, regulation |
| Project datum | arbitrary project origin | CAD/BIM authoring | drafting, setting out |

The mechanism that matters in code is the **compound CRS**: a coordinate reference system that pairs a horizontal CRS with an explicit vertical CRS. PROJ selects a vertical transformation only when both sides of a transformation declare one. Given two plain 2D definitions it has nothing to work with, so it moves X and Y and returns Z unchanged — correctly, quietly, and usually wrongly.

## Step-by-Step Implementation

### 1. Establish what each source is actually measured from

<!-- fig:vd-separation-varies -->
<svg viewBox="-39.2 -16 446.6 276.1" role="img" aria-label="Geoid separation changes by metres along a 200 kilometre alignment, so a single averaged correction is not survey-grade" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:447px;display:block;margin:1.5rem auto;">
  <title>Geoid separation varies across a site</title>
  <desc>Two profiles along 200 kilometres of a linear asset. The upper line is ellipsoidal height as a GNSS receiver reports it; the lower line is the geoid separation at the same positions. The separation is not a constant — it changes by more than six metres over this distance — which is why a single averaged correction is defensible for planning and not for setting out.</desc>
  <defs>
    <marker id="vd2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="vd2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-39.2" y="-16" width="446.6" height="276.1" fill="var(--color-surface)"/>
  <rect x="34" y="12" width="350" height="184" rx="4" fill="none" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="34" y1="196" x2="384" y2="196" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <line x1="34" y1="12" x2="34" y2="196" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <text x="209" y="218" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.7">Chainage (km)</text>
  <text x="26" y="104" text-anchor="end" font-size="9.5" fill="currentColor" fill-opacity="0.7">Height (m)</text>
  <polyline points="34,42.3 104,35.4 174,26.9 244,20.9 314,17.6 384,16" fill="none" stroke="currentColor" stroke-width="2" stroke-opacity="0.95"/>
  <circle cx="34" cy="42.3" r="3.4" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="104" cy="35.4" r="3.4" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="174" cy="26.9" r="3.4" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="244" cy="20.9" r="3.4" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="314" cy="17.6" r="3.4" fill="currentColor" fill-opacity="0.95"/>
  <circle cx="384" cy="16" r="3.4" fill="currentColor" fill-opacity="0.95"/>
  <text x="237" y="10.9" text-anchor="end" font-size="9.5" fill="currentColor" fill-opacity="0.85">ellipsoidal h</text>
  <polyline points="34,196 104,189.1 174,180.6 244,174.6 314,171.3 384,169.7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-opacity="0.6" stroke-dasharray="5 4"/>
  <circle cx="34" cy="196" r="2.8" fill="currentColor" fill-opacity="0.55"/>
  <circle cx="104" cy="189.1" r="2.8" fill="currentColor" fill-opacity="0.55"/>
  <circle cx="174" cy="180.6" r="2.8" fill="currentColor" fill-opacity="0.55"/>
  <circle cx="244" cy="174.6" r="2.8" fill="currentColor" fill-opacity="0.55"/>
  <circle cx="314" cy="171.3" r="2.8" fill="currentColor" fill-opacity="0.55"/>
  <circle cx="384" cy="169.7" r="2.8" fill="currentColor" fill-opacity="0.55"/>
  <text x="251" y="164.6" font-size="9.5" fill="currentColor" fill-opacity="0.85">separation N</text>
  <text x="34" y="238" font-size="9.5" fill="currentColor" fill-opacity="0.7">Orthometric height is the gap between them — and the gap moves.</text>
</svg>
<!-- /fig:vd-separation-varies -->

Before any code, record for every input: horizontal CRS, vertical datum, and whether the Z values have already had a geoid correction applied. A GNSS deliverable that has been "corrected to ODN" by the surveyor's software is already orthometric, and applying the correction again shifts it by twice the separation.

{% raw %}
```python
# Python 3.9+
from dataclasses import dataclass

@dataclass(frozen=True)
class HeightSource:
    name: str
    horizontal_epsg: int
    vertical: str          # "ellipsoidal" | "orthometric" | "project"
    vertical_epsg: int | None = None   # required when vertical == "orthometric"
    project_offset_m: float | None = None  # required when vertical == "project"

    def __post_init__(self):
        if self.vertical == "orthometric" and self.vertical_epsg is None:
            raise ValueError(f"{self.name}: orthometric height needs a named vertical datum")
        if self.vertical == "project" and self.project_offset_m is None:
            raise ValueError(f"{self.name}: project height needs a documented offset")
```
{% endraw %}

The class refuses to describe a source ambiguously. That refusal is the point: an unlabelled height is the failure this whole page exists to prevent, and it is much cheaper to be stopped here than to be corrected on site.

### 2. Build compound coordinate reference systems

{% raw %}
```python
# pyproj>=3.5.0
from pyproj import CRS

def compound(horizontal_epsg: int, vertical_epsg: int) -> CRS:
    """A horizontal CRS paired with an explicit vertical CRS."""
    crs = CRS.from_string(f"EPSG:{horizontal_epsg}+{vertical_epsg}")
    assert crs.is_compound, "expected a compound CRS"
    return crs

# ETRS89 geographic 3D (ellipsoidal height) -> British National Grid + ODN
SRC = CRS.from_epsg(4937)                 # ETRS89, ellipsoidal height
DST = compound(27700, 5701)               # OSGB36 / BNG + ODN orthometric height
```
{% endraw %}

### 3. Transform in three dimensions

{% raw %}
```python
# pyproj>=3.5.0, numpy>=1.24
import numpy as np
from pyproj import Transformer

transformer = Transformer.from_crs(SRC, DST, always_xy=True)

def to_orthometric(lon, lat, h_ellipsoidal):
    """Returns easting, northing and ORTHOMETRIC height."""
    e, n, H = transformer.transform(lon, lat, h_ellipsoidal)
    return np.asarray(e), np.asarray(n), np.asarray(H)
```
{% endraw %}

Two details decide whether this is correct. The `z` argument must actually be passed — omit it and the transformer has no height to operate on. And the separation applied is the one PROJ found for that horizontal position, which means the transformation is only as good as the grid installed; see the validation section for how to confirm which grid was used.

### 4. Fold in the project datum offset

A CAD or BIM project height is related to a national datum by one constant, established at project setup. Apply it as a named step rather than folding it into the CRS, because it is a project fact and not a geodetic one:

{% raw %}
```python
# Python 3.9+
def project_to_national(z_project: "np.ndarray", offset_m: float) -> "np.ndarray":
    """Project elevation -> national orthometric datum.

    offset_m is the height of the project's zero level above the national datum,
    taken from the project setup document — never inferred from a single element.
    """
    return z_project + offset_m
```
{% endraw %}

### 5. Verify against a levelled benchmark

The transformation is only verified by a point whose height is independently known. Transform the benchmark's coordinates and compare.

{% raw %}
```python
# pyproj>=3.5.0
def verify_benchmark(lon, lat, h_ellipsoidal, published_H, tol=0.02):
    _, _, H = transformer.transform(lon, lat, h_ellipsoidal)
    residual = abs(H - published_H)
    if residual > tol:
        raise AssertionError(
            f"vertical residual {residual:.3f} m exceeds {tol} m — "
            "check the geoid grid and the source height system"
        )
    return residual
```
{% endraw %}

## Edge Cases and Gotchas

**A 2D transformer silently passes height through.** This is the dominant failure and it produces output that is entirely plausible: X and Y are correct, Z is unchanged, and no exception is raised. Assert `crs.is_compound` on both sides of every transformation that carries height, and treat a transformer built from two 2D definitions as a bug when `z` is in play.

<!-- fig:vd-two-d-trap -->
<svg viewBox="-20 -20 578 194.1" role="img" aria-label="A transformer built from 2D systems returns the height unchanged; one built from compound systems applies a geoid separation" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:578px;display:block;margin:1.5rem auto;">
  <title>What a two-dimensional transformer does with a height</title>
  <desc>Two transformer constructions and their effect on the third ordinate. Built from two plain horizontal systems, the transformer has no vertical operation to apply, so it moves the horizontal position and returns the height exactly as supplied — silently. Built from compound systems, PROJ selects a vertical transformation and applies a geoid separation.</desc>
  <defs>
    <marker id="vd3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="vd3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="578" height="194.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="254" height="130" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4" stroke-dasharray="5 4"/>
  <text x="127" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Two horizontal systems</text>
  <line x1="14" y1="33" x2="240" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="16" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— no vertical operation exists</text>
  <text x="16" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— z returned exactly as supplied</text>
  <text x="16" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— nothing is raised</text>
  <text x="16" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— X and Y are perfectly correct</text>
  <rect x="284" y="0" width="254" height="130" rx="6" fill="currentColor" fill-opacity="0.11" stroke="currentColor" stroke-width="1.9"/>
  <text x="411" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Two compound systems</text>
  <line x1="298" y1="33" x2="524" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="300" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— PROJ selects a vertical operation</text>
  <text x="300" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— geoid grid interpolated</text>
  <text x="300" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— z genuinely transformed</text>
  <text x="300" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— assert is_compound to be sure</text>
  <text x="269" y="152" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">The failing case looks identical to the working one except in the numbers.</text>
</svg>
<!-- /fig:vd-two-d-trap -->

**Double-correcting an already-corrected survey.** GNSS post-processing software frequently outputs orthometric height directly. Applying the geoid separation to that output shifts it by `2N`, which in the UK is roughly 100 m and therefore obvious, and in a region where `N` is near zero is roughly nothing and therefore invisible. Record per source whether the correction has been applied, as in step 1.

**Sign conventions on the separation.** `h = H + N` is the standard relation, but published separation values are occasionally tabulated as `H - h`. A sign error is exactly `2N`, which looks like the double-correction above. Confirm against a benchmark rather than against the documentation.

**Missing grids fall back silently.** Where a national grid is not installed, PROJ may fall back to a coarser global model and still return a result. The result is a metre-level approximation presented with the same confidence as a centimetre-level one. Check which operation was actually used:

{% raw %}
```python
# pyproj>=3.5.0
print(transformer.description)
for grid in transformer.get_last_used_operation().grids:
    print(grid.name, "available:", grid.available)
```
{% endraw %}

**Tunnel and bridge deliverables mixing systems within one model.** Long linear assets can span enough of a country for `N` to vary measurably along their length. A single applied separation is then wrong at both ends in opposite directions. Transform per coordinate rather than applying a project-wide constant.

**IFC `OrthogonalHeight` is an offset, not a height.** It records where the model origin sits relative to the projected coordinate reference system, so it is added to model Z rather than replacing it. Reading it as an absolute height puts the whole model at that elevation.

## Validation and Testing

Vertical correctness needs two tests: one that the transformation is three-dimensional at all, and one that it lands where an independent measurement says it should.

{% raw %}
```python
# pytest, pyproj>=3.5.0
import pytest
from pyproj import CRS, Transformer

def test_transformer_is_three_dimensional():
    src = CRS.from_epsg(4937)                       # ETRS89 3D
    dst = CRS.from_string("EPSG:27700+5701")        # BNG + ODN
    assert src.is_geographic and dst.is_compound
    t = Transformer.from_crs(src, dst, always_xy=True)
    _, _, z_out = t.transform(-1.5, 52.0, 100.0)
    # A 2D pipeline would return the input height unchanged.
    assert abs(z_out - 100.0) > 1.0, "height passed through — the transform is horizontal"

@pytest.mark.parametrize("lon,lat,h,published_H", [
    (-1.54785, 53.80139, 96.412, 47.31),   # a levelled benchmark, ellipsoidal h -> ODN H
])
def test_benchmark_within_tolerance(lon, lat, h, published_H):
    t = Transformer.from_crs(CRS.from_epsg(4937),
                             CRS.from_string("EPSG:27700+5701"), always_xy=True)
    _, _, H = t.transform(lon, lat, h)
    assert abs(H - published_H) < 0.05
```
{% endraw %}

The first test is the more valuable of the two, because it fails loudly on the mistake that otherwise never announces itself. Substitute benchmarks and datums for your own region; the shape of both tests is unchanged.

Beyond unit tests, assert plausibility on every run. Ground level in a project has a known range; a transformed dataset whose heights sit 45 m from where the site is known to be has usually had a separation applied twice or not at all, and a single range assertion catches both.

## Performance and Scale

Vertical transformation costs essentially nothing beyond the horizontal one — the geoid lookup is an interpolation in a raster the transformer has already opened — so the performance considerations are about the grids rather than the arithmetic.

Fetch grids at image build time, never at run time. A container that calls out to the PROJ CDN on first use has a cold-start dependency on a network service, and a worker that cannot reach it falls back to a coarser model rather than failing, which converts an outage into a silent accuracy regression. Pin the grid package, install it in the image, and set `PROJ_NETWORK=OFF` so a missing grid is an error rather than a download.

Build the transformer once and reuse it, as with any PROJ pipeline; the reasoning is identical to that in [Reprojecting CAD Coordinates with pyproj Transformer](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/reprojecting-cad-coordinates-with-pyproj-transformer/) and the saving is larger here because the grid is opened during construction. For large arrays, pass whole numpy arrays to `transform()` rather than iterating; the interpolation is vectorised internally and per-point calls spend their time in Python.

## FAQ

<details>
<summary><strong>What is the difference between ellipsoidal and orthometric height?</strong></summary>

An ellipsoidal height is the distance from the reference ellipsoid, which is what GNSS measures directly. An orthometric height is the distance from the geoid — the equipotential surface that approximates mean sea level — which is what levelling measures and what drainage, flood and building-height regulations are written against. The two differ by the geoid separation `N`, related by `h = H + N`. Across a single country `N` typically varies by tens of metres, so the two are never interchangeable.

</details>

<details>
<summary><strong>Why does pyproj return my Z value unchanged?</strong></summary>

Because the transformation you built is horizontal. A `Transformer` created from two 2D CRS definitions has nothing to say about height, so it passes `z` through untouched and raises nothing. Build both sides as compound CRS definitions — a horizontal CRS paired with a vertical CRS — and pass `z` to `transform()`; only then does PROJ select a vertical transformation and apply a geoid model.

</details>

<details>
<summary><strong>Do I need to download a geoid grid?</strong></summary>

For a metre-level result, no: PROJ ships approximate global models. For anything survey-grade, yes. National geoid grids are distributed through the PROJ CDN and can be fetched with `projsync`, or installed as a data package. A pipeline that must be reproducible should pin the grid package and record its version alongside the output, because a grid revision changes results without changing any code.

</details>

<details>
<summary><strong>What height does an IFC model use?</strong></summary>

By default, a project-local one. Model Z values are measured from the project base point, and the relationship between that point and any national datum lives in `IfcMapConversion.OrthogonalHeight` when the model is georeferenced, or in the project setup documentation when it is not. Never assume model Z is orthometric height; read the offset or obtain it, and record which of the two you did.

</details>

<details>
<summary><strong>Can I ignore vertical datums for a 2D deliverable?</strong></summary>

Only if the deliverable is genuinely two-dimensional and stays that way. The moment a Z ordinate is carried — a 3D GeoPackage column, a `GEOMETRYZ` PostGIS column, a glTF export — it acquires a datum whether or not anyone chose one, and an unlabelled height is indistinguishable from a wrong one. If Z travels, its datum should travel with it.

</details>

---

## Related Pages

- [Coordinate Transformation & Spatial Alignment](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/) — the parent pipeline this height work is a stage of
- [CRS Normalization Workflows](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/) — the horizontal counterpart — detection, validation and one cached transformation
- [Unit Conversion Pipelines](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/unit-conversion-pipelines/) — height is a length, and inherits every unit trap on that page
- [Reading IFC Georeferencing with ifcopenshell](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ifcopenshell-workflow/reading-ifc-georeferencing-with-ifcopenshell/) — where a BIM model records its orthogonal height offset
- [Scale and Rotation Synchronization](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/) — the horizontal alignment that a vertical shift is often mistaken for
