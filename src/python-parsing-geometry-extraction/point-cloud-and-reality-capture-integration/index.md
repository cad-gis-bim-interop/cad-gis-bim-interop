---
title: "Point Cloud and Reality Capture Integration"
description: "Bring LAS, LAZ and E57 survey data into a CAD/GIS/BIM pipeline with Python: scaled integer storage, coordinate reference metadata, classification codes, and registering a scan against a design model."
slug: "point-cloud-and-reality-capture-integration"
breadcrumb:
  - label: "Python Parsing & Geometry Extraction"
    url: "/python-parsing-geometry-extraction/"
  - label: "Point Cloud and Reality Capture Integration"
    url: "/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Point Cloud and Reality Capture Integration",
      "description": "Bring LAS, LAZ and E57 survey data into a CAD/GIS/BIM pipeline with Python: scaled integer storage, coordinate reference metadata, classification codes, and registering a scan against a design model.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Python Parsing & Geometry Extraction", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/"},
        {"@type": "ListItem", "position": 2, "name": "Point Cloud and Reality Capture Integration", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/point-cloud-and-reality-capture-integration/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Integrate reality-capture point clouds with CAD and BIM data in Python",
      "description": "Read the header before the points, resolve the coordinate reference system, decimate to a workable density, register against the design model, and report the residual.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Read the header first", "text": "Open the file and read its header for point count, scale and offset, coordinate reference metadata and point format before allocating memory for any points."},
        {"@type": "HowToStep", "position": 2, "name": "Resolve the coordinate reference system", "text": "Extract the CRS from the LAS variable-length records or the E57 metadata, and refuse to proceed when the file declares none rather than assuming the project system."},
        {"@type": "HowToStep", "position": 3, "name": "Decimate to a workable density", "text": "Reduce the cloud to the density the task actually needs, using a spatial subsample rather than every nth point so coverage stays even."},
        {"@type": "HowToStep", "position": 4, "name": "Register against the design model", "text": "Align the cloud to the model with a coarse feature match followed by an iterative closest-point refinement, solving for a rigid transform only."},
        {"@type": "HowToStep", "position": 5, "name": "Report the residual", "text": "Measure the fit against surfaces excluded from the registration and fail the run when the residual exceeds the survey tolerance."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Why do LAS coordinates come back as integers?",
          "acceptedAnswer": {"@type": "Answer", "text": "Because that is how the format stores them. LAS records each ordinate as a 32-bit signed integer plus a per-file scale and offset, so the real coordinate is raw * scale + offset. Reading the raw arrays without applying the header scale and offset produces numbers with the right shape and the wrong magnitude and origin. Libraries expose both views; make sure the one you are reading is the scaled one."}
        },
        {
          "@type": "Question",
          "name": "Should I use ICP to georeference a scan?",
          "acceptedAnswer": {"@type": "Answer", "text": "No. Iterative closest point refines an alignment that is already approximately correct; it has no notion of a coordinate reference system and will happily converge on a locally optimal but globally wrong fit. Georeference from survey control or from the scanner's own positioning, then use ICP only to take up the residual between the scan and the design model."}
        },
        {
          "@type": "Question",
          "name": "What does a classification code mean in a LAS file?",
          "acceptedAnswer": {"@type": "Answer", "text": "It is a per-point label from the ASPRS classification table — ground, low vegetation, building, water and so on — assigned by whatever software processed the scan. It is a producer's claim rather than a guarantee, and its reliability varies enormously between deliveries. Filter on it, but validate the result before treating it as authoritative, particularly for the ground class that terrain models depend on."}
        },
        {
          "@type": "Question",
          "name": "Is E57 or LAS the better interchange format?",
          "acceptedAnswer": {"@type": "Answer", "text": "They answer different questions. LAS and its compressed form LAZ are point-oriented, well supported across GIS tooling, and carry per-point attributes efficiently — the natural choice for airborne survey feeding a GIS. E57 is scan-oriented: it preserves individual scan positions, their registration transforms and associated imagery, which matters for terrestrial scanning where knowing where each scan was taken from is part of the data."}
        },
        {
          "@type": "Question",
          "name": "How much decimation is safe?",
          "acceptedAnswer": {"@type": "Answer", "text": "It depends entirely on the feature size you need to resolve, not on file size. A cloud reduced to one point per 50 mm still resolves a kerb; the same cloud cannot resolve a 10 mm construction tolerance. Decide the density from the smallest feature the task must detect, apply a spatial subsample so coverage stays even, and record the applied density with the output so a later user knows what the data can and cannot answer."}
        }
      ]
    }
  ]
}
</script>

# Point Cloud and Reality Capture Integration

A reality-capture deliverable — a laser scan, a photogrammetric reconstruction, an airborne survey — is measured evidence of what exists, and integrating it is the part of the [Python Parsing & Geometry Extraction](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/) pipeline where design intent meets the site as built.

That contrast is what makes the work distinctive. Everywhere else in this section the input is authored: someone decided what a wall is and drew it. A point cloud has no such structure. It is tens or hundreds of millions of measurements, each with a position and some attributes, and any structure at all — this is the ground, that is a facade, these points are the deck of a bridge — is something the pipeline asserts rather than reads. The three problems that follow are density, coordinate metadata and registration, and each of them has a well-defined answer that is easy to skip.

## Prerequisites

- **Python 3.9+**, and enough memory to hold at least a decimated cloud. Point clouds are the one workload in this section where memory planning comes before code.
- **`laspy>=2.5`** with the `lazrs` or `laszip` backend for compressed LAZ files. Without a backend, `laspy` reads LAS and refuses LAZ.
- **`numpy>=1.24`** — every operation here is array work.
- **`open3d>=0.17`** for voxel downsampling and the iterative closest point implementation, where registration is in scope.
- **`pyproj>=3.5`** for coordinate reference system handling.

{% raw %}
```bash
# laspy>=2.5 with LAZ support, numpy>=1.24, open3d>=0.17, pyproj>=3.5
pip install "laspy[lazrs]>=2.5" "numpy>=1.24" "open3d>=0.17" "pyproj>=3.5"
```
{% endraw %}

## Architectural Overview

**Points are stored as scaled integers.** LAS records each ordinate as a 32-bit signed integer together with a per-file scale and offset held in the header, so the real coordinate is `raw * scale + offset`. This is why a file covering a 2 km site can hold millimetre resolution in 32 bits, and why reading the raw arrays without the header transformation yields coordinates that are numerically fine and geographically nowhere.

<!-- fig:pc-scaled-integers -->
<svg viewBox="-20 -20 515.2 156.1" role="img" aria-label="A LAS ordinate is a 32-bit integer interpreted by the header scale and offset to give the real coordinate" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:515px;display:block;margin:1.5rem auto;">
  <title>How a LAS record stores a coordinate</title>
  <desc>One point record and the header values that interpret it. The ordinate is a 32-bit signed integer; the header carries a scale and an offset per axis, and the real coordinate is the integer multiplied by the scale plus the offset. This is what lets a file spanning kilometres carry millimetre resolution, and why reading the raw arrays relocates the survey.</desc>
  <defs>
    <marker id="pc1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="pc1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="515.2" height="156.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="324.7" height="92" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.5"/>
  <text x="14" y="16" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">header.scales   = (0.001, 0.001, 0.001)</text>
  <line x1="330.7" y1="12.9" x2="362.7" y2="12.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="370.7" y="16" font-size="9.5" fill="currentColor" fill-opacity="0.78">millimetre resolution</text>
  <text x="14" y="35" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">header.offsets  = (432000.0, 512000.0, 0.0)</text>
  <line x1="330.7" y1="31.9" x2="362.7" y2="31.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="370.7" y="35" font-size="9.5" fill="currentColor" fill-opacity="0.78">the site origin</text>
  <text x="14" y="54" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">record.X        = 187552</text>
  <line x1="330.7" y1="50.9" x2="362.7" y2="50.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="370.7" y="54" font-size="9.5" fill="currentColor" fill-opacity="0.78">the stored 32-bit integer</text>
  <text x="14" y="73" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">real x          = 432187.552</text>
  <line x1="330.7" y1="69.9" x2="362.7" y2="69.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="370.7" y="73" font-size="9.5" fill="currentColor" fill-opacity="0.78">X * scale + offset</text>
  <text x="0" y="114" font-size="9.5" fill="currentColor" fill-opacity="0.7">las.x applies this; las.X does not — the difference is a thousandfold and a relocation.</text>
</svg>
<!-- /fig:pc-scaled-integers -->

**The header carries the metadata that decides everything else.** Point count, point format, scale and offset, bounding box, and — in the variable-length records — the coordinate reference system. All of it is cheap to read and all of it changes how the points must be interpreted, so the header read is unconditional and the point read is not.

**Attributes vary by point format.** Intensity, return number, classification, GPS time, colour and scan angle are present or absent depending on the point data record format the file declares. Code that assumes colour exists fails on a format that has none, and code that assumes classification is meaningful fails on a file where nothing assigned it.

| Format family | Carries | Typical source | Notes |
|---|---|---|---|
| LAS 1.2–1.4 | position, intensity, return, class | airborne and mobile survey | widest GIS support |
| LAZ | as LAS, compressed | delivery and archive | needs a compression backend |
| E57 | position, colour, per-scan pose | terrestrial scanning | preserves scan positions |
| PLY / PCD | position, colour, normals | processing intermediates | no coordinate metadata |

The last row is worth noting: the processing formats carry no coordinate reference metadata at all. A cloud that passes through one of them loses its georeferencing unless the pipeline carries it alongside, which is a recurring way for a correctly georeferenced survey to arrive at the end of a pipeline unlabelled.

## Step-by-Step Implementation

### 1. Read the header before the points

<!-- fig:pc-decimation -->
<svg viewBox="-20 -20 570 194.1" role="img" aria-label="Taking every nth point preserves uneven scan density; voxel downsampling produces the even density algorithms assume" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:570px;display:block;margin:1.5rem auto;">
  <title>Index decimation against spatial decimation</title>
  <desc>Two ways of reducing a cloud. Taking every nth point preserves the density variation the scan already had, thinning near and far field by the same factor and leaving the far field as sparse as it was. A voxel subsample keeps one point per cell, which produces the even density every downstream algorithm assumes.</desc>
  <defs>
    <marker id="pc2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="pc2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="570" height="194.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="250" height="130" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4" stroke-dasharray="5 4"/>
  <text x="125" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Every nth point</text>
  <line x1="14" y1="33" x2="236" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="16" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— fast, one slice</text>
  <text x="16" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— density variation preserved</text>
  <text x="16" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— far field stays sparse</text>
  <text x="16" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— nearest-neighbour work skews</text>
  <rect x="280" y="0" width="250" height="130" rx="6" fill="currentColor" fill-opacity="0.11" stroke="currentColor" stroke-width="1.9"/>
  <text x="405" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Voxel subsample</text>
  <line x1="294" y1="33" x2="516" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="296" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— one point per cell</text>
  <text x="296" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— even density everywhere</text>
  <text x="296" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— cell size is the stated resolution</text>
  <text x="296" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— what registration expects</text>
  <text x="265" y="152" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">Scan density falls off with range — index decimation keeps that, voxel decimation removes it.</text>
</svg>
<!-- /fig:pc-decimation -->

{% raw %}
```python
# laspy>=2.5
import laspy

def inspect(path: str) -> dict:
    """Header-only read: costs one seek, decides everything downstream."""
    with laspy.open(path) as reader:
        h = reader.header
        return {
            "count": h.point_count,
            "format": h.point_format.id,
            "scales": tuple(h.scales),
            "offsets": tuple(h.offsets),
            "mins": tuple(h.mins),
            "maxs": tuple(h.maxs),
            "crs": h.parse_crs(),          # None when the file declares none
        }
```
{% endraw %}

The point count alone routinely changes the plan: a 400-million-point file is not going to be loaded, and knowing that before allocating is the difference between a decimation strategy and an out-of-memory kill.

### 2. Resolve the coordinate reference system, or stop

{% raw %}
```python
# laspy>=2.5, pyproj>=3.5
def require_crs(path: str):
    meta = inspect(path)
    if meta["crs"] is None:
        raise ValueError(
            f"{path}: no CRS in the LAS variable-length records — "
            "obtain it from the survey report rather than assuming the project system"
        )
    return meta["crs"]
```
{% endraw %}

Assuming the project coordinate system for an unlabelled cloud is the point-cloud equivalent of assuming millimetres for a DXF with no `$INSUNITS`, and it fails the same way: silently, and only where the assumption happens to be wrong.

### 3. Decimate spatially, not by index

{% raw %}
```python
# laspy>=2.5, numpy>=1.24, open3d>=0.17
import numpy as np
import open3d as o3d

def load_decimated(path: str, voxel_m: float = 0.05) -> np.ndarray:
    """Read scaled XYZ and reduce to one point per voxel."""
    las = laspy.read(path)
    xyz = np.vstack((las.x, las.y, las.z)).T      # .x/.y/.z apply scale and offset
    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(xyz)
    return np.asarray(pcd.voxel_down_sample(voxel_m).points)
```
{% endraw %}

Taking every nth point is faster and wrong: sampling density in a scan is a function of range and incidence angle, so index decimation thins the far field and the near field by the same factor and leaves the density variation intact. Voxel downsampling gives an even density, which is what every downstream algorithm assumes.

Note `las.x` rather than `las.X`: the lower-case accessors apply the header scale and offset, the upper-case ones return raw integers.

### 4. Register the cloud against the design model

{% raw %}
```python
# open3d>=0.17, numpy>=1.24
def refine_alignment(scan_xyz, model_xyz, max_corr_m=0.25):
    """Rigid ICP refinement of an already approximately-correct alignment."""
    scan = o3d.geometry.PointCloud(o3d.utility.Vector3dVector(scan_xyz))
    model = o3d.geometry.PointCloud(o3d.utility.Vector3dVector(model_xyz))
    result = o3d.pipelines.registration.registration_icp(
        scan, model, max_corr_m, np.eye(4),
        o3d.pipelines.registration.TransformationEstimationPointToPoint(
            with_scaling=False),          # scale is survey truth, never a free parameter
    )
    return result.transformation, result.inlier_rmse
```
{% endraw %}

`with_scaling=False` is the important argument. A scan and a design model are both metric; allowing the fit to scale lets it absorb a genuine dimensional discrepancy — the thing you are usually looking for — into a scale factor and report an excellent fit.

### 5. Report the residual against surfaces the fit did not see

Registration quality measured on the points used to register is optimistic for the same reason a transform's residual on its own control points is. Hold back a surface — a facade, a slab — and measure against that.

{% raw %}
```python
# numpy>=1.24
def residual_stats(transformed_xyz, reference_xyz, tree) -> dict:
    d, _ = tree.query(transformed_xyz)          # scipy.spatial.cKDTree on the reference
    return {"rmse": float(np.sqrt((d ** 2).mean())),
            "p95": float(np.percentile(d, 95)),
            "max": float(d.max())}
```
{% endraw %}

## Edge Cases and Gotchas

**Raw versus scaled accessors.** Reading `las.X` instead of `las.x` returns unscaled integers. The cloud has the right shape, sits at the wrong origin, and is out by the scale factor — usually a thousand. It looks like a unit error because it is one.

<!-- fig:pc-metadata-loss -->
<svg viewBox="-20 -20 493.4 214.1" role="img" aria-label="LAS, LAZ, E57 and the processing formats compared on CRS, classification and per-scan pose" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:493px;display:block;margin:1.5rem auto;">
  <title>What each point-cloud format carries besides positions</title>
  <desc>Four formats compared on the metadata that decides whether a cloud is usable in a spatial pipeline: whether it records a coordinate reference system, per-point classification, and the scan positions a terrestrial survey was taken from. The processing formats at the bottom carry none of it, which is how a correctly georeferenced survey arrives unlabelled.</desc>
  <defs>
    <marker id="pc3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="pc3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="493.4" height="214.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="331.7" height="152" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="331.7" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">Format</text>
  <text x="120.6" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">CRS</text>
  <line x1="161.4" y1="0" x2="161.4" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="207.9" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Classification</text>
  <line x1="254.4" y1="0" x2="254.4" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="293" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Scan pose</text>
  <line x1="79.9" y1="0" x2="79.9" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="331.7" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">LAS 1.4</text>
  <text x="120.6" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">WKT in VLR</text>
  <text x="207.9" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">yes</text>
  <text x="293" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.5">—</text>
  <line x1="0" y1="62" x2="331.7" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">LAZ</text>
  <text x="120.6" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">as LAS</text>
  <text x="207.9" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">yes</text>
  <text x="293" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.5">—</text>
  <line x1="0" y1="92" x2="331.7" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">E57</text>
  <text x="120.6" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">yes</text>
  <text x="207.9" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">limited</text>
  <text x="293" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">yes</text>
  <line x1="0" y1="122" x2="331.7" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="140.5" font-size="10.5" font-weight="600" fill="currentColor">PLY / PCD</text>
  <text x="120.6" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.5">—</text>
  <text x="207.9" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.5">—</text>
  <text x="293" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.5">—</text>
  <text x="0" y="172" font-size="9.5" fill="currentColor" fill-opacity="0.7">A cloud that passes through a processing format loses its georeferencing unless you carry it separately.</text>
</svg>
<!-- /fig:pc-metadata-loss -->

**Heights are ellipsoidal unless corrected.** A GNSS-positioned scan carries ellipsoidal height, and comparing it against a model on a national orthometric datum produces a uniform vertical offset of tens of metres that ICP will cheerfully absorb into the translation, hiding the fact that the two datasets are on different vertical datums. Resolve the height system explicitly — see [Vertical Datums and Height Systems](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/) — before registering.

**Classification is a claim, not a fact.** Ground classification quality varies between deliveries and is frequently poor under dense vegetation or on steep slopes. A terrain model built on unvalidated ground classification inherits every misclassification as topography.

**Coordinates are large and processing libraries are single precision.** Many point-processing routines work in `float32`. At a projected easting of `5.1e5` the representable spacing in single precision is already coarser than a centimetre, so a cloud used at full projected coordinates loses the precision it was captured at. Shift to a local origin before processing and restore the offset afterwards.

**E57 scan poses are part of the data.** Flattening an E57 into a single merged cloud discards which scan each point came from, and with it the ability to diagnose a registration problem in one scan position. Preserve the per-scan grouping if there is any chance the registration will be questioned.

**Intensity is not comparable between scans.** Return intensity depends on range, incidence angle and surface, and is not normalised between instruments or even between scans from one instrument. Using it as a material or condition signal across a merged cloud compares numbers that were never on the same scale.

## Validation and Testing

The assertions that pay for themselves are about density, extent and fit — the three properties a downstream consumer will assume and none of which the file guarantees.

{% raw %}
```python
# pytest, numpy>=1.24
def test_cloud_is_georeferenced_and_plausible(las_path, site_bounds):
    meta = inspect(las_path)
    assert meta["crs"] is not None, "cloud carries no CRS"
    minx, miny, maxx, maxy = site_bounds
    assert minx <= meta["mins"][0] and meta["maxs"][0] <= maxx, "outside the site in X"
    assert miny <= meta["mins"][1] and meta["maxs"][1] <= maxy, "outside the site in Y"

def test_decimation_preserves_coverage(las_path):
    full = inspect(las_path)
    reduced = load_decimated(las_path, voxel_m=0.05)
    span_full = full["maxs"][0] - full["mins"][0]
    span_reduced = reduced[:, 0].max() - reduced[:, 0].min()
    assert span_reduced > 0.98 * span_full, "decimation lost coverage, not just density"
```
{% endraw %}

The second test catches the failure mode that index decimation and a badly chosen voxel size share: a cloud that is smaller in every sense, including its extent.

## Performance and Scale

Point clouds are the workload in this section where memory, not CPU, sets the ceiling. Three practices keep a pipeline inside it.

**Chunk the read.** `laspy` exposes a chunked iterator that yields fixed-size blocks rather than materialising the file. Filtering — by classification, by bounding box, by return number — inside the chunk loop means peak memory is the chunk size rather than the file size:

{% raw %}
```python
# laspy>=2.5
with laspy.open(path) as reader:
    for chunk in reader.chunk_iterator(2_000_000):
        ground = chunk[chunk.classification == 2]
        yield np.vstack((ground.x, ground.y, ground.z)).T
```
{% endraw %}

**Decimate before you do anything else.** Every subsequent operation — registration, meshing, nearest-neighbour queries — is at best linear and often worse in point count. Deciding the working density first, from the smallest feature that must be resolved, is the single largest performance decision in the pipeline.

**Tile, and process tiles independently.** Airborne deliveries usually arrive tiled already, and terrestrial data can be tiled on a grid. Tiles are independent, so the work parallelises across processes cleanly, and a per-tile failure isolates to one tile rather than one run. Keep an overlap of at least the largest feature size so features spanning a boundary are complete in one tile.

## FAQ

<details>
<summary><strong>Why do LAS coordinates come back as integers?</strong></summary>

Because that is how the format stores them. LAS records each ordinate as a 32-bit signed integer plus a per-file scale and offset, so the real coordinate is `raw * scale + offset`. Reading the raw arrays without applying the header scale and offset produces numbers with the right shape and the wrong magnitude and origin. Libraries expose both views; make sure the one you are reading is the scaled one.

</details>

<details>
<summary><strong>Should I use ICP to georeference a scan?</strong></summary>

No. Iterative closest point refines an alignment that is already approximately correct; it has no notion of a coordinate reference system and will happily converge on a locally optimal but globally wrong fit. Georeference from survey control or from the scanner's own positioning, then use ICP only to take up the residual between the scan and the design model.

</details>

<details>
<summary><strong>What does a classification code mean in a LAS file?</strong></summary>

It is a per-point label from the ASPRS classification table — ground, low vegetation, building, water and so on — assigned by whatever software processed the scan. It is a producer's claim rather than a guarantee, and its reliability varies enormously between deliveries. Filter on it, but validate the result before treating it as authoritative, particularly for the ground class that terrain models depend on.

</details>

<details>
<summary><strong>Is E57 or LAS the better interchange format?</strong></summary>

They answer different questions. LAS and its compressed form LAZ are point-oriented, well supported across GIS tooling, and carry per-point attributes efficiently — the natural choice for airborne survey feeding a GIS. E57 is scan-oriented: it preserves individual scan positions, their registration transforms and associated imagery, which matters for terrestrial scanning where knowing where each scan was taken from is part of the data.

</details>

<details>
<summary><strong>How much decimation is safe?</strong></summary>

It depends entirely on the feature size you need to resolve, not on file size. A cloud reduced to one point per 50 mm still resolves a kerb; the same cloud cannot resolve a 10 mm construction tolerance. Decide the density from the smallest feature the task must detect, apply a spatial subsample so coverage stays even, and record the applied density with the output so a later user knows what the data can and cannot answer.

</details>

---

## Related Pages

- [Python Parsing & Geometry Extraction](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/) — the parent section on reading design and survey data into clean primitives
- [Geometry Mesh Conversion](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/geometry-mesh-conversion/) — turning the registered cloud or its surfaces into meshes
- [Scale and Rotation Synchronization](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/) — the similarity-transform mathematics registration depends on
- [Vertical Datums and Height Systems](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/) — scan heights are ellipsoidal until something says otherwise
- [Aligning BIM Models with GIS Survey Data](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/scale-and-rotation-synchronization/aligning-bim-models-with-gis-survey-data/) — the control-point route to the same alignment
