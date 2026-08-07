---
title: "Applying a Geoid Model with pyproj"
description: "Install, pin and verify a geoid grid for pyproj: projsync and data packages, PROJ_NETWORK behaviour, and checking which grid an operation actually used."
slug: "applying-a-geoid-model-with-pyproj"
breadcrumb:
  - label: "Coordinate Transformation & Spatial Alignment"
    url: "/coordinate-transformation-spatial-alignment/"
  - label: "Vertical Datums and Height Systems"
    url: "/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/"
  - label: "Applying a Geoid Model with pyproj"
    url: "/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/applying-a-geoid-model-with-pyproj/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Applying a Geoid Model with pyproj",
      "description": "Install, pin and verify a geoid grid for pyproj: projsync and data packages, PROJ_NETWORK behaviour, and checking which grid an operation actually used.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/applying-a-geoid-model-with-pyproj/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Coordinate Transformation & Spatial Alignment", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/"},
        {"@type": "ListItem", "position": 2, "name": "Vertical Datums and Height Systems", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/"},
        {"@type": "ListItem", "position": 3, "name": "Applying a Geoid Model with pyproj", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/applying-a-geoid-model-with-pyproj/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Install and verify a geoid model for pyproj",
      "description": "Fetch the grid at image build time, disable network fetching at run time, confirm which grid an operation selected, and record the grid version with the output.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Fetch the grid at build time", "text": "Run projsync for the project bounding box during the container build so the grid is baked into the image rather than fetched on first use."},
        {"@type": "HowToStep", "position": 2, "name": "Disable network fetching at run time", "text": "Set PROJ_NETWORK to off in the runtime environment so a missing grid raises instead of silently downloading or falling back."},
        {"@type": "HowToStep", "position": 3, "name": "Confirm the selected operation", "text": "Inspect the transformer operation and its grid list to confirm the intended national grid was used rather than a global approximation."},
        {"@type": "HowToStep", "position": 4, "name": "Record the grid version", "text": "Write the PROJ version and grid identifiers alongside the output so a later re-run can be compared rather than merely repeated."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is the difference between projsync and a data package?",
          "acceptedAnswer": {"@type": "Answer", "text": "projsync fetches individual grids from the PROJ CDN into the local data directory on demand or by bounding box. A data package such as proj-data is a single archive of everything, installed by a package manager. projsync gives a small image; the package gives a reproducible one without network access at build time. Both are fine; mixing them is what causes confusion about which grid is actually present."}
        },
        {
          "@type": "Question",
          "name": "Why does the same code give different answers on two machines?",
          "acceptedAnswer": {"@type": "Answer", "text": "Almost always a different grid. PROJ resolves the best available operation, and \"best available\" depends on what is installed. One machine with a national grid and one without produce answers differing by decimetres to metres, with no code difference. Pin the grid set and assert it at start-up."}
        },
        {
          "@type": "Question",
          "name": "Should PROJ_NETWORK be on in production?",
          "acceptedAnswer": {"@type": "Answer", "text": "No. Leaving it on makes every transformation potentially dependent on a network service, and the failure mode is not an error — it is a fallback to a coarser model. Fetch at build time, turn it off at run time, and let a missing grid fail loudly."}
        }
      ]
    }
  ]
}
</script>

# Applying a Geoid Model with pyproj

A geoid model is a raster of separation values that PROJ interpolates to convert between ellipsoidal and orthometric heights, and getting a reproducible result means controlling which one is installed rather than trusting the default. Fetch the grid at image build time, set `PROJ_NETWORK=OFF` at run time, and assert the intended grid was actually used. This page sits under [Vertical Datums and Height Systems](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/) and supplies the grid that the [ellipsoidal-to-orthometric conversion](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/converting-ellipsoidal-to-orthometric-heights-in-python/) depends on.

## How PROJ Resolves a Grid

PROJ does not have one geoid model; it has an operation search. Given a source and a target coordinate reference system it enumerates the transformations it knows about, scores them by accuracy and availability, and picks the best one it can actually perform. Availability is the operative word: an operation requiring a grid that is not installed is either skipped in favour of a less accurate one, or — with network access enabled — triggers a download.

<!-- fig:geoid-selection -->
<svg viewBox="-20 -20 507.2 216.2" role="img" aria-label="A missing geoid grid makes PROJ silently fall back to a coarser global model rather than fail" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:507px;display:block;margin:1.5rem auto;">
  <title>How availability decides which operation runs</title>
  <desc>A branch on whether the grid a candidate operation needs is installed. With the grid present PROJ selects the accurate operation and interpolates it. Without it, and with network access enabled, PROJ may fetch it; with the network disabled it falls back to a coarser model and returns a result anyway. Only the last branch is silent, and it is the default in a container nobody configured.</desc>
  <defs>
    <marker id="gd1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="gd1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="507.2" height="216.2" fill="var(--color-surface)"/>
  <polygon points="233.6,0 336.6,31 233.6,62 130.5,31" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-width="1.6"/>
  <text x="233.6" y="35" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">Is the national grid installed?</text>
  <rect x="0" y="128" width="137.1" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="68.5" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Accurate operation</text>
  <text x="68.5" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">centimetre level</text>
  <path d="M 233.6 62 L 233.6 92 L 68.5 92 L 68.5 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#gd1-a)" stroke-linejoin="round"/>
  <text x="68.5" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">yes</text>
  <rect x="165.1" y="128" width="137.1" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="233.6" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Fetched at run time</text>
  <text x="233.6" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">depends on a service</text>
  <path d="M 233.6 62 L 233.6 92 L 233.6 92 L 233.6 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#gd1-a)" stroke-linejoin="round"/>
  <text x="233.6" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">no, network on</text>
  <rect x="330.1" y="128" width="137.1" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="398.6" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Coarse fallback</text>
  <text x="398.6" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">silent, metre level</text>
  <path d="M 233.6 62 L 233.6 92 L 398.6 92 L 398.6 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#gd1-a)" stroke-linejoin="round"/>
  <text x="398.6" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">no, network off</text>
</svg>
<!-- /fig:geoid-selection -->

This is a sensible design and a reproducibility hazard. The same code on two machines can select two different operations, return answers differing by metres, and report success in both cases. Nothing in the API forces you to notice.

The resolution has three parts. Install the grids deliberately, disable the network at run time so absence is an error, and inspect the operation the transformer selected rather than assuming.

## Production-Ready Script

{% raw %}
```python
# pyproj>=3.5.0 (PROJ 9.x), Python 3.9+
from __future__ import annotations

import os
from dataclasses import dataclass, asdict

import pyproj
from pyproj import CRS, Transformer


@dataclass(frozen=True)
class GridProvenance:
    """What actually performed the transformation — written next to the output."""
    proj_version: str
    pyproj_version: str
    operation: str
    grids: tuple[str, ...]
    network_enabled: bool


def assert_offline() -> None:
    """A production run must not depend on the PROJ CDN."""
    if pyproj.network.is_network_enabled():
        raise RuntimeError(
            "PROJ network access is enabled — set PROJ_NETWORK=OFF so a missing "
            "grid fails loudly instead of silently falling back"
        )


def transformer_with_provenance(
    src: CRS, dst: CRS, probe: tuple[float, float, float]
) -> tuple[Transformer, GridProvenance]:
    """Build a transformer and record exactly which operation and grids it used."""
    t = Transformer.from_crs(src, dst, always_xy=True)
    t.transform(*probe)                     # resolve the operation
    op = t.get_last_used_operation()

    missing = [g.short_name for g in op.grids if not g.available]
    if missing:
        raise RuntimeError(f"grid(s) not installed: {', '.join(missing)}")

    prov = GridProvenance(
        proj_version=pyproj.proj_version_str,
        pyproj_version=pyproj.__version__,
        operation=op.name,
        grids=tuple(g.short_name for g in op.grids),
        network_enabled=pyproj.network.is_network_enabled(),
    )
    return t, prov


if __name__ == "__main__":
    assert_offline()
    src = CRS.from_epsg(4937)                        # ETRS89, ellipsoidal height
    dst = CRS.from_string("EPSG:27700+5701")         # BNG + ODN
    t, prov = transformer_with_provenance(src, dst, probe=(-1.5, 53.8, 100.0))
    print(asdict(prov))
```
{% endraw %}

<!-- fig:geoid-provenance -->
<svg viewBox="-20 -20 557.4 175.1" role="img" aria-label="PROJ version, pyproj version, operation name, grids used and network state — the provenance a transformed dataset carries" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:557px;display:block;margin:1.5rem auto;">
  <title>The provenance record written next to the output</title>
  <desc>The five facts that make a transformed dataset reproducible: the PROJ and pyproj versions, the operation actually selected, the grids it used, and whether network fetching was enabled. Two datasets that disagree are then resolved by comparing two records rather than by re-deriving what each environment happened to have installed.</desc>
  <defs>
    <marker id="gd2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="gd2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="557.4" height="175.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="276.4" height="111" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.5"/>
  <text x="14" y="16" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">proj_version    9.3.1</text>
  <line x1="282.4" y1="12.9" x2="314.4" y2="12.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="322.4" y="16" font-size="9.5" fill="currentColor" fill-opacity="0.78">grid behaviour changes between releases</text>
  <text x="14" y="35" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">pyproj_version  3.6.1</text>
  <text x="14" y="54" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">operation       OSGB36 to ETRS89 (2)</text>
  <line x1="282.4" y1="50.9" x2="314.4" y2="50.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="322.4" y="54" font-size="9.5" fill="currentColor" fill-opacity="0.78">which of several candidates ran</text>
  <text x="14" y="73" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">grids           uk_os_OSGM15_GB.tif</text>
  <line x1="282.4" y1="69.9" x2="314.4" y2="69.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="322.4" y="73" font-size="9.5" fill="currentColor" fill-opacity="0.78">the file that supplied the separation</text>
  <text x="14" y="92" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">network         false</text>
  <line x1="282.4" y1="88.9" x2="314.4" y2="88.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="322.4" y="92" font-size="9.5" fill="currentColor" fill-opacity="0.78">a missing grid raised rather than downloaded</text>
  <text x="0" y="133" font-size="9.5" fill="currentColor" fill-opacity="0.7">A difference between two runs is a diff between two of these, not an investigation.</text>
</svg>
<!-- /fig:geoid-provenance -->

**Key implementation notes:**

- `assert_offline` is called before anything else. A run that can reach the CDN is a run whose results depend on a service, and the point of the exercise is to remove that dependency.
- The probe transform exists to force operation resolution. PROJ selects lazily, so an unused transformer has no operation to inspect.
- `GridProvenance` is written next to the output. Six months later, a discrepancy between two datasets is answerable by comparing two provenance records instead of guessing.
- The grid availability check raises rather than warns, because a warning in a batch log is a warning nobody read.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `pyproj` | `>=3.5.0` | `pyproj.network` and operation grid reporting |
| PROJ | `9.x` | grid availability flags on the operation object |
| Grid source | `projsync` or `proj-data` | pick one per image; mixing obscures what is installed |
| `PROJ_NETWORK` | `OFF` in production | `ON` only for a deliberate build-time fetch |
| `PROJ_DATA` | explicit path | set it rather than relying on the discovered default |

## Fallback Strategies

**1. Grid missing in the image.** The build stage did not fetch it, or fetched a different bounding box. Widen the `projsync` bounding box to cover the project extent with margin, and assert at start-up rather than at first transform.

<!-- fig:geoid-lifecycle -->
<svg viewBox="-45 -20 502.8 310.8" role="img" aria-label="Fetch the geoid grid at image build, disable network at run time, assert at start-up, and record per run" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:503px;display:block;margin:1.5rem auto;">
  <title>Where the grid enters the container lifecycle</title>
  <desc>Four stages. The grid is fetched during the image build, where the network is available and the result becomes part of the artefact. At run time network fetching is disabled so absence is an error. Start-up asserts the grid is present, and each run records which one was used. Fetching at run time instead makes every transformation depend on an external service.</desc>
  <defs>
    <marker id="gd3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="gd3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-45" y="-20" width="502.8" height="310.8" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="258" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="129" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Build: fetch the grid</text>
  <text x="129" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">projsync by bounding box</text>
  <circle cx="-14" cy="24.1" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="27.6" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">1</text>
  <text x="276" y="27.6" font-size="9.5" fill="currentColor" fill-opacity="0.75">network available here, and only here</text>
  <rect x="0" y="74.2" width="258" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="129" y="94.5" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Run: network off</text>
  <text x="129" y="108.2" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">PROJ_NETWORK=OFF</text>
  <circle cx="-14" cy="98.3" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="101.8" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">2</text>
  <text x="276" y="101.8" font-size="9.5" fill="currentColor" fill-opacity="0.75">absence becomes an error</text>
  <rect x="0" y="148.4" width="258" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="129" y="168.7" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Start-up: assert</text>
  <text x="129" y="182.4" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">grid available</text>
  <circle cx="-14" cy="172.5" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="176" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">3</text>
  <text x="276" y="176" font-size="9.5" fill="currentColor" fill-opacity="0.75">fail before accepting work</text>
  <rect x="0" y="222.6" width="258" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="129" y="242.9" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Per run: record</text>
  <text x="129" y="256.6" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">operation and grids</text>
  <circle cx="-14" cy="246.7" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="250.2" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">4</text>
  <text x="276" y="250.2" font-size="9.5" fill="currentColor" fill-opacity="0.75">reproducible, not merely repeatable</text>
  <line x1="129" y1="48.2" x2="129" y2="74.2" stroke="currentColor" stroke-width="1.4" marker-end="url(#gd3-a)"/>
  <line x1="129" y1="122.4" x2="129" y2="148.4" stroke="currentColor" stroke-width="1.4" marker-end="url(#gd3-a)"/>
  <line x1="129" y1="196.6" x2="129" y2="222.6" stroke="currentColor" stroke-width="1.4" marker-end="url(#gd3-a)"/>
</svg>
<!-- /fig:geoid-lifecycle -->

**2. Two images disagree.** Compare the provenance records. A difference in `operation` or `grids` explains a difference in results without any further investigation, which is the whole reason for recording them.

**3. The build machine has no network.** Use a data package installed from the same artefact repository as the rest of the dependencies. It is larger, and it is reproducible without any network at build time.

**4. A grid update changes results.** This is expected — grids are revised — and it is why the version is recorded. Treat a grid update as a change requiring re-validation against benchmarks, not as an invisible dependency bump.

**5. `PROJ_DATA` pointing somewhere unexpected.** A conda environment, a system PROJ and a wheel-bundled PROJ can all be present at once, and the discovered data directory may not be the one you populated. Set `PROJ_DATA` explicitly and print `pyproj.datadir.get_data_dir()` at start-up.

## FAQ

<details>
<summary><strong>What is the difference between projsync and a data package?</strong></summary>

`projsync` fetches individual grids from the PROJ CDN into the local data directory on demand or by bounding box. A data package such as `proj-data` is a single archive of everything, installed by a package manager. `projsync` gives a small image; the package gives a reproducible one without network access at build time. Both are fine; mixing them is what causes confusion about which grid is actually present.

</details>

<details>
<summary><strong>Why does the same code give different answers on two machines?</strong></summary>

Almost always a different grid. PROJ resolves the best available operation, and "best available" depends on what is installed. One machine with a national grid and one without produce answers differing by decimetres to metres, with no code difference. Pin the grid set and assert it at start-up.

</details>

<details>
<summary><strong>Should PROJ_NETWORK be on in production?</strong></summary>

No. Leaving it on makes every transformation potentially dependent on a network service, and the failure mode is not an error — it is a fallback to a coarser model. Fetch at build time, turn it off at run time, and let a missing grid fail loudly.

</details>

---

## Related Pages

- [Vertical Datums and Height Systems](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/) — parent reference on why the separation matters at all
- [Converting Ellipsoidal to Orthometric Heights in Python](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/vertical-datums-and-height-systems/converting-ellipsoidal-to-orthometric-heights-in-python/) — sibling guide performing the conversion this grid enables
- [CRS Normalization Workflows](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/crs-normalization-workflows/) — the horizontal pipeline with the same reproducibility requirements
