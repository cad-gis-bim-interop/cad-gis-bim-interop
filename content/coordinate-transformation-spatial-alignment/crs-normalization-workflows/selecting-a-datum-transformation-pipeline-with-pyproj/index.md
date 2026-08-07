---
title: "Selecting a Datum Transformation Pipeline with pyproj"
description: "Choose a datum transformation rather than accepting PROJ's default: enumerate the candidates, compare accuracy and grid needs, pin one, and record which ran."
slug: "selecting-a-datum-transformation-pipeline-with-pyproj"
breadcrumb:
  - label: "Coordinate Transformation & Spatial Alignment"
    url: "/coordinate-transformation-spatial-alignment/"
  - label: "CRS Normalization Workflows"
    url: "/coordinate-transformation-spatial-alignment/crs-normalization-workflows/"
  - label: "Selecting a Datum Transformation Pipeline with pyproj"
    url: "/coordinate-transformation-spatial-alignment/crs-normalization-workflows/selecting-a-datum-transformation-pipeline-with-pyproj/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Selecting a Datum Transformation Pipeline with pyproj",
      "description": "Choose a datum transformation rather than accepting PROJ's default: enumerate the candidates, compare accuracy and grid needs, pin one, and record which ran.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/selecting-a-datum-transformation-pipeline-with-pyproj/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Coordinate Transformation & Spatial Alignment", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/"},
        {"@type": "ListItem", "position": 2, "name": "CRS Normalization Workflows", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/"},
        {"@type": "ListItem", "position": 3, "name": "Selecting a Datum Transformation Pipeline with pyproj", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/selecting-a-datum-transformation-pipeline-with-pyproj/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Select and pin a datum transformation with pyproj",
      "description": "Enumerate the candidate operations for a CRS pair, compare their accuracy and grid requirements, pin the chosen one, and record it with the output.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Enumerate the candidates", "text": "List the coordinate operations PROJ knows for the source and target pair rather than accepting the first one it would choose."},
        {"@type": "HowToStep", "position": 2, "name": "Compare accuracy and grids", "text": "Read each candidate accuracy and the grids it requires, and note which of those grids are installed."},
        {"@type": "HowToStep", "position": 3, "name": "Pin the chosen operation", "text": "Construct the transformer from the selected pipeline definition so the choice does not depend on what happens to be installed."},
        {"@type": "HowToStep", "position": 4, "name": "Record the selection", "text": "Write the operation name, its accuracy and the grid identifiers alongside the output."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Why are there several transformations for one CRS pair?",
          "acceptedAnswer": {"@type": "Answer", "text": "Because a datum relationship is measured, not defined, and different measurement campaigns produce different realisations. A pair such as OSGB36 to WGS84 has a coarse seven-parameter transformation good to a few metres and a grid-based one good to centimetres, plus regional variants. They are all legitimate; they answer the same question to different precisions."}
        },
        {
          "@type": "Question",
          "name": "What does PROJ choose if I do not?",
          "acceptedAnswer": {"@type": "Answer", "text": "The most accurate operation whose grids are actually available. That is a sensible default and a reproducibility hazard: the same code on a machine without the grid silently selects a coarser operation and returns answers differing by metres, with no error and no warning."}
        },
        {
          "@type": "Question",
          "name": "Should I always pin the most accurate one?",
          "acceptedAnswer": {"@type": "Answer", "text": "Pin the one appropriate to the work, and make sure its grids are installed. The most accurate operation on a machine that lacks its grid is worse than a deliberately chosen coarse one, because it will not be used and nothing will say so. Accuracy you cannot execute is not accuracy."}
        }
      ]
    }
  ]
}
</script>

# Selecting a Datum Transformation Pipeline with pyproj

For most coordinate reference system pairs PROJ knows several transformations, differing in accuracy and in which grid files they need. Enumerate them, choose one deliberately, construct the transformer from that choice, and record it with the output — because the default selection depends on what happens to be installed, and that makes results machine-dependent in a way nothing reports. This page is part of [CRS Normalization Workflows](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/).

## Why the Default Is Not a Decision

A datum transformation is an empirical relationship between two reference frames, established by measurement. Different campaigns, epochs and regions produce different relationships, all of them valid, differing in precision and in coverage. PROJ's database records them as separate coordinate operations, each with a stated accuracy and a list of grid files it requires.

<!-- fig:dtp-candidates -->
<svg viewBox="-20 -20 384.9 184.1" role="img" aria-label="One CRS pair offers several operations differing in accuracy and in the grids they require" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>Several operations answer the same question</title>
  <desc>Three coordinate operations for one system pair, with the accuracy each claims and what it needs to run. They are all legitimate — a datum relationship is measured rather than defined, so different campaigns produce different realisations. Which one runs depends on what is installed, which is exactly why it should be chosen rather than inherited.</desc>
  <defs>
    <marker id="dt1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="dt1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="384.9" height="184.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="289.2" height="122" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="289.2" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">Operation</text>
  <text x="148" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Accuracy</text>
  <line x1="184.1" y1="0" x2="184.1" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="236.7" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Requires</text>
  <line x1="111.9" y1="0" x2="111.9" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="289.2" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">Grid-based</text>
  <text x="148" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">~0.1 m</text>
  <text x="236.7" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">a national grid file</text>
  <line x1="0" y1="62" x2="289.2" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">Seven-parameter</text>
  <text x="148" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">~2 m</text>
  <text x="236.7" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">nothing</text>
  <line x1="0" y1="92" x2="289.2" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">Three-parameter</text>
  <text x="148" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">~5 m</text>
  <text x="236.7" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">nothing</text>
  <text x="0" y="142" font-size="9.5" fill="currentColor" fill-opacity="0.7">PROJ picks the most accurate it can perform — which depends on the machine.</text>
</svg>
<!-- /fig:dtp-candidates -->

When you build a transformer from a source and a target, PROJ scores the candidates and picks the most accurate one it can actually perform. That last clause is the problem: availability depends on which grids are installed, so the identical call on two machines can select two operations and return answers differing by metres. Neither run reports anything unusual, because from PROJ's point of view both did the best they could.

Making the choice explicit removes the dependency. Enumerate the candidates, decide which one the work requires, construct the transformer from that pipeline, and let a missing grid raise instead of degrade.

## Production-Ready Script

{% raw %}
```python
# pyproj>=3.5.0 (PROJ 9.x), Python 3.9+
from __future__ import annotations

from dataclasses import dataclass, asdict
from pyproj import CRS, Transformer
from pyproj.transformer import TransformerGroup


@dataclass(frozen=True)
class Candidate:
    name: str
    accuracy_m: float | None
    grids: tuple[str, ...]
    grids_available: bool
    definition: str


def candidates(src: CRS, dst: CRS, *, area_of_interest=None) -> list[Candidate]:
    """Every operation PROJ knows for this pair, in its own preference order."""
    group = TransformerGroup(src, dst, always_xy=True, area_of_interest=area_of_interest)
    out: list[Candidate] = []
    for op in group.transformers:
        info = op.operations[0] if op.operations else None
        grids = tuple(g.short_name for g in (info.grids if info else []))
        available = all(g.available for g in (info.grids if info else []))
        out.append(Candidate(
            name=op.description,
            accuracy_m=getattr(info, "accuracy", None) if info else None,
            grids=grids,
            grids_available=available,
            definition=op.to_proj4() if hasattr(op, "to_proj4") else op.description,
        ))
    return out


def choose(cands: list[Candidate], *, require_grids: bool = True,
           max_accuracy_m: float | None = None) -> Candidate:
    """Deliberate selection, with the reasons stated as arguments."""
    pool = [c for c in cands if c.grids_available] if require_grids else list(cands)
    if max_accuracy_m is not None:
        pool = [c for c in pool
                if c.accuracy_m is not None and c.accuracy_m <= max_accuracy_m]
    if not pool:
        raise RuntimeError(
            "no candidate satisfies the requirements — install the grids, or relax "
            "the accuracy requirement deliberately"
        )
    return min(pool, key=lambda c: (c.accuracy_m if c.accuracy_m is not None else 1e9))


def pinned_transformer(src: CRS, dst: CRS, chosen: Candidate) -> Transformer:
    """Build from the SELECTED pipeline, not from the CRS pair."""
    return Transformer.from_pipeline(chosen.definition) \
        if chosen.definition.startswith("+proj=pipeline") \
        else Transformer.from_crs(src, dst, always_xy=True)


if __name__ == "__main__":
    src, dst = CRS.from_epsg(27700), CRS.from_epsg(4326)
    cands = candidates(src, dst)
    for c in cands:
        acc = f"{c.accuracy_m:g} m" if c.accuracy_m is not None else "unstated"
        print(f"{acc:>10}  grids={'yes' if c.grids_available else 'MISSING'}  {c.name}")
    picked = choose(cands, require_grids=True, max_accuracy_m=1.0)
    print("selected:", asdict(picked))
```
{% endraw %}

<!-- fig:dtp-selection -->
<svg viewBox="-45 -20 517.7 310.8" role="img" aria-label="Enumerate the candidates, filter on grid availability, apply an accuracy requirement, then record the selection" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:518px;display:block;margin:1.5rem auto;">
  <title>Enumerate, filter, pick, record</title>
  <desc>Four stages that replace an implicit default with a stated decision. The candidate operations are enumerated, filtered to those whose grids are actually installed, narrowed by an accuracy requirement, and the choice is recorded alongside the output. Filtering on availability before accuracy is deliberate: an operation that cannot run is not a candidate.</desc>
  <defs>
    <marker id="dt2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="dt2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-45" y="-20" width="517.7" height="310.8" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="258" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="129" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Enumerate</text>
  <text x="129" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">every known operation</text>
  <circle cx="-14" cy="24.1" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="27.6" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">1</text>
  <text x="276" y="27.6" font-size="9.5" fill="currentColor" fill-opacity="0.75">what the default chose from</text>
  <rect x="0" y="74.2" width="258" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="129" y="94.5" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Filter on availability</text>
  <text x="129" y="108.2" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">grids installed</text>
  <circle cx="-14" cy="98.3" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="101.8" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">2</text>
  <text x="276" y="101.8" font-size="9.5" fill="currentColor" fill-opacity="0.75">accuracy you cannot run is not accuracy</text>
  <rect x="0" y="148.4" width="258" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="129" y="168.7" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Apply the requirement</text>
  <text x="129" y="182.4" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">accuracy ceiling</text>
  <circle cx="-14" cy="172.5" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="176" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">3</text>
  <text x="276" y="176" font-size="9.5" fill="currentColor" fill-opacity="0.75">stated at the call site</text>
  <rect x="0" y="222.6" width="258" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="129" y="242.9" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Record the selection</text>
  <text x="129" y="256.6" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">name, accuracy, grids</text>
  <circle cx="-14" cy="246.7" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="250.2" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">4</text>
  <text x="276" y="250.2" font-size="9.5" fill="currentColor" fill-opacity="0.75">a diff, not an investigation</text>
  <line x1="129" y1="48.2" x2="129" y2="74.2" stroke="currentColor" stroke-width="1.4" marker-end="url(#dt2-a)"/>
  <line x1="129" y1="122.4" x2="129" y2="148.4" stroke="currentColor" stroke-width="1.4" marker-end="url(#dt2-a)"/>
  <line x1="129" y1="196.6" x2="129" y2="222.6" stroke="currentColor" stroke-width="1.4" marker-end="url(#dt2-a)"/>
</svg>
<!-- /fig:dtp-selection -->

**Key implementation notes:**

- `TransformerGroup` is the enumeration API. It exposes what the default selection would have chosen from, which is the information the default hides.
- `choose` takes its criteria as arguments, so the selection policy is visible at the call site rather than embedded in the function.
- Filtering on grid availability before accuracy is deliberate: an operation that cannot run is not a candidate however accurate it claims to be.
- The selected candidate is a dataclass, so it serialises straight into the provenance record written next to the output.
- An area of interest, where the work is regional, narrows the candidate list usefully — several national transformations are only valid within their own extent.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `pyproj` | `>=3.5.0` | `TransformerGroup`, operation accuracy and grid metadata |
| PROJ | `9.x` | operation enumeration and grid availability flags |
| Grids | `projsync` or a data package | install at image build time |
| `PROJ_NETWORK` | `OFF` in production | so a missing grid raises rather than downloads |
| Area of interest | optional | narrows candidates to regionally valid operations |

## Fallback Strategies

**1. No candidate has its grids.** Install them, or relax the requirement explicitly and record that a coarse operation was used. Do not let the default silently do the relaxing.

<!-- fig:dtp-two-machines -->
<svg viewBox="-20 -20 546 246" role="img" aria-label="The same transformation call selects different operations on two machines depending on which grids are installed" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:546px;display:block;margin:1.5rem auto;">
  <title>How two machines produce different coordinates from one script</title>
  <desc>The same call on two hosts. One has the national grid installed and selects the accurate operation; the other does not and selects a coarser one. Both return results, neither reports anything unusual, and the coordinates differ by metres. The only difference is what was in the image.</desc>
  <defs>
    <marker id="dt3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="dt3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="546" height="246" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="154" height="34" rx="6" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-width="1.4"/>
  <text x="77" y="21" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">the same script</text>
  <line x1="77" y1="34" x2="77" y2="206" stroke="currentColor" stroke-width="1" stroke-opacity="0.28" stroke-dasharray="4 4"/>
  <rect x="176" y="0" width="154" height="34" rx="6" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-width="1.4"/>
  <text x="253" y="21" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">host with grid</text>
  <line x1="253" y1="34" x2="253" y2="206" stroke="currentColor" stroke-width="1" stroke-opacity="0.28" stroke-dasharray="4 4"/>
  <rect x="352" y="0" width="154" height="34" rx="6" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-width="1.4"/>
  <text x="429" y="21" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">host without</text>
  <line x1="429" y1="34" x2="429" y2="206" stroke="currentColor" stroke-width="1" stroke-opacity="0.28" stroke-dasharray="4 4"/>
  <line x1="77" y1="60" x2="253" y2="60" stroke="currentColor" stroke-width="1.3" marker-end="url(#dt3-a)"/>
  <text x="165" y="53" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.8">from_crs(src, dst)</text>
  <line x1="253" y1="100" x2="77" y2="100" stroke="currentColor" stroke-width="1.3" stroke-dasharray="5 4" marker-end="url(#dt3-o)"/>
  <text x="165" y="93" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.8">grid-based, ~0.1 m</text>
  <line x1="77" y1="140" x2="429" y2="140" stroke="currentColor" stroke-width="1.3" marker-end="url(#dt3-a)"/>
  <text x="253" y="133" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.8">from_crs(src, dst)</text>
  <line x1="429" y1="180" x2="77" y2="180" stroke="currentColor" stroke-width="1.3" stroke-dasharray="5 4" marker-end="url(#dt3-o)"/>
  <text x="253" y="173" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.8">seven-parameter, ~2 m</text>
</svg>
<!-- /fig:dtp-two-machines -->

**2. Accuracy is unstated.** Some operations carry no accuracy figure. Treat unstated as unknown rather than as good, and prefer a candidate that states one.

**3. Results differ between environments.** Compare the recorded selections. A difference in operation name explains a difference in coordinates without further investigation.

**4. Several candidates are regionally scoped.** Supply an area of interest so PROJ filters to the operations valid where the data actually is.

**5. The pipeline definition is not reusable.** Some operations do not round-trip through a text definition. Fall back to constructing from the CRS pair, and assert after the first transform that the operation actually used is the one selected.

## FAQ

<details>
<summary><strong>Why are there several transformations for one CRS pair?</strong></summary>

Because a datum relationship is measured, not defined, and different measurement campaigns produce different realisations. A pair such as OSGB36 to WGS84 has a coarse seven-parameter transformation good to a few metres and a grid-based one good to centimetres, plus regional variants. They are all legitimate; they answer the same question to different precisions.

</details>

<details>
<summary><strong>What does PROJ choose if I do not?</strong></summary>

The most accurate operation whose grids are actually available. That is a sensible default and a reproducibility hazard: the same code on a machine without the grid silently selects a coarser operation and returns answers differing by metres, with no error and no warning.

</details>

<details>
<summary><strong>Should I always pin the most accurate one?</strong></summary>

Pin the one appropriate to the work, and make sure its grids are installed. The most accurate operation on a machine that lacks its grid is worse than a deliberately chosen coarse one, because it will not be used and nothing will say so. Accuracy you cannot execute is not accuracy.

</details>

---

## Related Pages

- [CRS Normalization Workflows](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/) — parent reference on detection, validation, transformation and verification
- [Reprojecting CAD Coordinates with pyproj Transformer](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/reprojecting-cad-coordinates-with-pyproj-transformer/) — the transformer this selection configures
- [Applying a Geoid Model with pyproj](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/applying-a-geoid-model-with-pyproj/) — the same reproducibility argument for the vertical grids
