---
title: "Handling DWG Proxy Entities During Conversion"
description: "Detect and mitigate ACAD_PROXY_ENTITY objects during DWG to DXF conversion: log by handle, use PROXYGRAPHICS, and treat cached graphics as approximate."
slug: "handling-dwg-proxy-entities-during-conversion"
breadcrumb:
  - label: "Core Format Fundamentals & Schema Mapping"
    url: "/core-format-fundamentals-schema-mapping/"
  - label: "DWG Proprietary Limitations"
    url: "/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/"
  - label: "Handling DWG Proxy Entities During Conversion"
    url: "/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/handling-dwg-proxy-entities-during-conversion/"
datePublished: "2026-07-11"
dateModified: "2026-07-11"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Handling DWG Proxy Entities During Conversion",
      "description": "Detect and mitigate ACAD_PROXY_ENTITY objects during DWG to DXF conversion: log by handle, use PROXYGRAPHICS, and treat cached graphics as approximate.",
      "datePublished": "2026-07-11",
      "dateModified": "2026-07-11",
      "author": {"@type": "Organization", "name": "CAD GIS BIM Interop"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/handling-dwg-proxy-entities-during-conversion/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Core Format Fundamentals & Schema Mapping", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/"},
        {"@type": "ListItem", "position": 2, "name": "DWG Proprietary Limitations", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/"},
        {"@type": "ListItem", "position": 3, "name": "Handling DWG Proxy Entities During Conversion", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/handling-dwg-proxy-entities-during-conversion/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Handling DWG Proxy Entities During Conversion",
      "description": "Scan a converted DXF for ACAD_PROXY_ENTITY objects, classify proxy versus native geometry, and emit a report of unrenderable objects with mitigation guidance.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Open the converted DXF", "text": "Open the DXF produced from the DWG conversion with ezdxf and iterate modelspace entities."},
        {"@type": "HowToStep", "position": 2, "name": "Classify each entity", "text": "Check entity.dxftype(); ACAD_PROXY_ENTITY marks an object whose real class the reader lacks and whose geometry cannot be decoded."},
        {"@type": "HowToStep", "position": 3, "name": "Log proxies by handle", "text": "Record the handle, layer, and any cached graphical extent of every proxy so the loss is auditable."},
        {"@type": "HowToStep", "position": 4, "name": "Report unrenderable objects", "text": "Emit a report separating native decodable geometry from proxy objects that retain only cached graphics or nothing."},
        {"@type": "HowToStep", "position": 5, "name": "Mitigate at the source", "text": "Re-export from the authoring tool with PROXYGRAPHICS=1, explode proxies at source, or request a native geometry export."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is an ACAD_PROXY_ENTITY in a DWG file?",
          "acceptedAnswer": {"@type": "Answer", "text": "An ACAD_PROXY_ENTITY is a stand-in that AutoCAD writes for a custom object created by a vertical product such as Civil 3D or Plant 3D when the reading application lacks the object enabler that defines that class. It may carry a cached graphical representation but not the parametric geometry, so ezdxf cannot decode its true shape."}
        },
        {
          "@type": "Question",
          "name": "Can ezdxf recover geometry from a proxy entity?",
          "acceptedAnswer": {"@type": "Answer", "text": "No. ezdxf sees entity.dxftype() == 'ACAD_PROXY_ENTITY' and can read only whatever cached proxy graphics were stored at save time. It cannot reconstruct the original custom object's parametric geometry. Treat any recovered cached graphics as an approximate visual snapshot, not authoritative geometry."}
        },
        {
          "@type": "Question",
          "name": "What does PROXYGRAPHICS control?",
          "acceptedAnswer": {"@type": "Answer", "text": "The PROXYGRAPHICS system variable controls whether AutoCAD saves cached graphics for custom objects into the file. With PROXYGRAPHICS=1 the DWG stores a graphical snapshot that survives conversion; with PROXYGRAPHICS=0 proxies may carry no recoverable geometry at all after conversion."}
        }
      ]
    }
  ]
}
</script>

# Handling DWG Proxy Entities During Conversion

Proxy entities — `ACAD_PROXY_ENTITY` objects — are placeholders that AutoCAD writes for custom objects created by vertical products such as Civil 3D and Plant 3D, standing in for classes the reading application does not understand. During DWG-to-DXF conversion they either keep only a cached graphical snapshot or are dropped entirely, so `ezdxf` reports `entity.dxftype() == "ACAD_PROXY_ENTITY"` and cannot decode any parametric geometry beyond those cached graphics. The correct handling is detection, logging by handle, and mitigation at the source rather than pretending the proxy is real geometry. This page is part of the [DWG Proprietary Limitations](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/) reference and assumes you already have a converted DXF to inspect.

## How ezdxf Handles Proxy Entities

Autodesk vertical products define their own object classes — a Civil 3D corridor, a Plant 3D pipe, an alignment — through *object enablers*, runtime modules that teach AutoCAD how to draw and edit those objects. When a drawing containing such objects is opened by software that lacks the matching enabler, AutoCAD substitutes a proxy: an `ACAD_PROXY_ENTITY` that preserves the object's handle and, optionally, a cached graphical representation captured at save time, but not the parametric definition. The custom object's real geometry lives in code the reader does not have.

`ezdxf` is exactly such a reader. It never had the object enabler, so a proxy stays a proxy: `entity.dxftype()` returns `"ACAD_PROXY_ENTITY"`, and there is no property that reconstructs the original corridor or pipe. At best, if the file was saved with cached proxy graphics, a downstream tool can recover a frozen visual snapshot of lines and arcs — an approximation with no editable topology and no attributes. Treating that snapshot as authoritative geometry is the central mistake this page exists to prevent. Because DWG is a closed format, this limitation compounds the general reasons `ezdxf` cannot read DWG directly, detailed in the [pydwg Integration](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/) reference.

<!-- fig:proxy-enabler-chain -->
<svg viewBox="-20 -33.5 684.2 125.8" role="img" aria-label="A custom object becomes a proxy record on save and, without the object enabler, converts to a DXF shell carrying only cached graphics" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:684px;display:block;margin:1.5rem auto;">
  <title>What a proxy entity is left holding after conversion</title>
  <desc>A four-stage chain. A vertical product authors a custom object through its own object enabler. Saved to DWG, the object is written with a proxy record and, optionally, cached display graphics. Converted to DXF without the enabler present, only the proxy record survives. A reader then sees a shell that knows its class name and its cached outline but not the geometry that produced them.</desc>
  <defs>
    <marker id="pxy1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="pxy1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-33.5" width="684.2" height="125.8" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="108.4" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="54.2" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Custom object</text>
  <text x="54.2" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">Civil 3D corridor</text>
  <rect x="142.4" y="0" width="129.1" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="206.9" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">DWG proxy record</text>
  <text x="206.9" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">+ cached graphics</text>
  <rect x="305.5" y="0" width="162.7" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="386.8" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">ACAD_PROXY_ENTITY</text>
  <text x="386.8" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">in the DXF</text>
  <rect x="502.1" y="0" width="142" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="573.2" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Class name + extent</text>
  <text x="573.2" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">no true geometry</text>
  <line x1="108.4" y1="24.1" x2="142.4" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#pxy1-a)"/>
  <text x="125.4" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">save</text>
  <line x1="271.5" y1="24.1" x2="305.5" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#pxy1-a)"/>
  <text x="288.5" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">no enabler</text>
  <line x1="468.1" y1="24.1" x2="502.1" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#pxy1-a)"/>
  <text x="485.1" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">read</text>
  <text x="0" y="70.2" font-size="9.5" fill="currentColor" fill-opacity="0.7">The enabler is what turns the record back into geometry, and it is not in the file.</text>
</svg>
<!-- /fig:proxy-enabler-chain -->

<svg viewBox="4 48 714 248" role="img" aria-label="Decision flow for a converted DXF entity: native types decode to real geometry while ACAD_PROXY_ENTITY objects split into cached-graphics approximation or total loss and are logged" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:720px;display:block;margin:1.5rem auto;">
  <title>Classifying Native Geometry versus Proxy Entities After Conversion</title>
  <desc>Decision diagram: each converted DXF entity is tested; native types such as LINE and LWPOLYLINE decode to real geometry, while ACAD_PROXY_ENTITY objects branch into a cached-graphics approximation when PROXYGRAPHICS was on, or total loss when it was off, and both proxy outcomes are logged by handle.</desc>
  <defs>
    <marker id="pa" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor"/>
    </marker>
  </defs>
  <rect x="4" y="48" width="714" height="248" fill="var(--color-surface)"/>
  <rect x="20" y="126" width="130" height="56" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="85" y="150" text-anchor="middle" font-size="11" fill="currentColor">DXF entity</text>
  <text x="85" y="168" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">dxftype()?</text>
  <line x1="150" y1="154" x2="196" y2="90" stroke="currentColor" stroke-width="1.5" marker-end="url(#pa)"/>
  <line x1="150" y1="154" x2="196" y2="218" stroke="currentColor" stroke-width="1.5" marker-end="url(#pa)"/>
  <text x="150" y="104" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.75">native</text>
  <text x="152" y="212" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.75">proxy</text>
  <rect x="198" y="64" width="180" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.85"/>
  <text x="288" y="86" text-anchor="middle" font-size="11" fill="currentColor">Real geometry</text>
  <text x="288" y="104" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">LINE, LWPOLYLINE...</text>
  <rect x="198" y="196" width="180" height="56" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="288" y="219" text-anchor="middle" font-size="11" fill="currentColor">ACAD_PROXY_ENTITY</text>
  <text x="288" y="237" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">PROXYGRAPHICS?</text>
  <line x1="378" y1="212" x2="424" y2="150" stroke="currentColor" stroke-width="1.5" marker-end="url(#pa)"/>
  <line x1="378" y1="230" x2="424" y2="256" stroke="currentColor" stroke-width="1.5" marker-end="url(#pa)"/>
  <rect x="426" y="124" width="176" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="4 3" opacity="0.8"/>
  <text x="514" y="146" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.8">cached graphics</text>
  <text x="514" y="163" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.8">= approximate only</text>
  <rect x="426" y="234" width="176" height="46" rx="6" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="4 3" opacity="0.8"/>
  <text x="514" y="262" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.8">total loss</text>
  <line x1="602" y1="150" x2="644" y2="180" stroke="currentColor" stroke-width="1.2" marker-end="url(#pa)"/>
  <line x1="602" y1="257" x2="644" y2="196" stroke="currentColor" stroke-width="1.2" marker-end="url(#pa)"/>
  <rect x="646" y="164" width="56" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="674" y="188" text-anchor="middle" font-size="10" fill="currentColor">Log by</text>
  <text x="674" y="204" text-anchor="middle" font-size="10" fill="currentColor">handle</text>
</svg>

Proxy handling belongs to the same family of closed-format problems as version incompatibility; when a converted drawing is missing objects you expected, checking [DWG version compatibility](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/understanding-dwg-version-compatibility/) and scanning for proxies are the two first diagnostics to run.

## Production-Ready Script

This script scans a converted DXF, classifies every entity as native or proxy, records the handle and any cached-graphics extent of each proxy, and emits a report of unrenderable objects that a pipeline can gate on.

```python
# ezdxf>=1.1.0 | python>=3.9
import ezdxf
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

PROXY_TYPES = {"ACAD_PROXY_ENTITY", "ACAD_PROXY_OBJECT", "PROXY_ENTITY"}


def proxy_extent(entity) -> dict[str, Any] | None:
    """
    Try to read a cached bounding box for a proxy entity.

    Proxy graphics, when present, let ezdxf compute an approximate extent.
    Returns None when no cached graphics survived the conversion.
    """
    try:
        # bbox.extents works when cached proxy graphics are present.
        from ezdxf import bbox
        box = bbox.extents([entity])
        if box.has_data:
            return {
                "min": [float(c) for c in box.extmin],
                "max": [float(c) for c in box.extmax],
            }
    except Exception:
        pass
    return None


def scan_proxies(dxf_path: str, output_json: str) -> None:
    try:
        doc = ezdxf.readfile(dxf_path)
    except (IOError, ezdxf.DXFStructureError) as exc:
        sys.exit(f"Failed to load converted DXF: {exc}")

    msp = doc.modelspace()
    proxies: list[dict[str, Any]] = []
    native_count = 0
    type_histogram: Counter[str] = Counter()

    for entity in msp:
        dxftype = entity.dxftype()
        type_histogram[dxftype] += 1
        if dxftype in PROXY_TYPES:
            extent = proxy_extent(entity)
            proxies.append({
                "handle": entity.dxf.handle,
                "dxftype": dxftype,
                "layer": entity.dxf.get("layer", "0"),
                "cached_graphics": extent is not None,
                "approx_extent": extent,  # approximate only; never authoritative
            })
        else:
            native_count += 1

    total = native_count + len(proxies)
    report = {
        "source": dxf_path,
        "total_entities": total,
        "native_entities": native_count,
        "proxy_entities": len(proxies),
        "proxy_ratio": round(len(proxies) / total, 4) if total else 0.0,
        "type_histogram": dict(type_histogram.most_common()),
        "unrenderable": proxies,
    }

    Path(output_json).write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(
        f"{len(proxies)} proxy / {native_count} native entities "
        f"({report['proxy_ratio']:.1%} proxy) -> {output_json}"
    )
    # Gate: fail loudly if a meaningful fraction is unrenderable.
    if report["proxy_ratio"] > 0.05:
        print("WARNING: >5% of entities are proxies; re-export from source.")


if __name__ == "__main__":
    scan_proxies("converted.dxf", "proxy_report.json")
```

**Key implementation notes:**

- Match on `entity.dxftype()` against the proxy type names. Different AutoCAD releases and converters emit `ACAD_PROXY_ENTITY`, and older files may surface `PROXY_ENTITY`; check for the whole set.
- `proxy_extent()` returns an approximate bounding box only when cached proxy graphics survived conversion. A `None` extent means the object came through with no recoverable geometry — a total loss that must be reported, not silently skipped.
- The `approx_extent` field is labelled approximate deliberately. Cached graphics are a save-time snapshot; never feed them into spatial indexing or measurement as if they were true geometry.
- The `proxy_ratio` gate turns a silent data-loss problem into a loud pipeline signal. A drawing that is 30% proxies is not usable geometry data regardless of how cleanly it converted.
- The `type_histogram` helps triage which vertical product produced the file — a concentration of proxies on Civil 3D corridor layers points straight at the missing object enabler.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `ezdxf` | `>=1.1.0` | `dxftype()`, `dxf.handle`, and `ezdxf.bbox.extents` are stable in 1.1.0+. |
| Python | `3.9+` | Uses `pathlib`, `collections.Counter`, and typing. |
| DXF format | R2000 (`AC1015`) – R2018 (`AC1032`) | Proxy entities are stored consistently across these revisions. |
| Proxy types | ACAD_PROXY_ENTITY, PROXY_ENTITY | Emitted for Civil 3D, Plant 3D, Map 3D custom objects. |
| Cached graphics | PROXYGRAPHICS=1 | Only recoverable when the source saved proxy graphics. |
| Object enablers | Source-side | The only path to true geometry is the originating application. |

## Fallback Strategies

**1. Re-export with PROXYGRAPHICS=1**

<!-- fig:proxy-recovery-routes -->
<svg viewBox="-20 -20 577.8 214.1" role="img" aria-label="Proxy graphics, exploding in the authoring app, installing the object enabler and quarantining compared on geometry recovered, semantics kept and headless suitability" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:578px;display:block;margin:1.5rem auto;">
  <title>What each proxy recovery route actually returns</title>
  <desc>Four recovery routes compared on what geometry they return, whether the object keeps its semantic identity, and whether the route can run unattended. Re-exporting with proxy graphics enabled and exploding in the authoring application both recover drawable geometry; only the authoring application preserves the meaning of the object, and neither the enabler route nor the explode route runs headlessly.</desc>
  <defs>
    <marker id="pxy2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="pxy2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="577.8" height="214.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="537.8" height="152" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="537.8" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">Route</text>
  <text x="245.3" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Geometry recovered</text>
  <line x1="309" y1="0" x2="309" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="360.7" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Semantics kept</text>
  <line x1="412.4" y1="0" x2="412.4" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="475.1" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Headless</text>
  <line x1="181.7" y1="0" x2="181.7" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="537.8" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">PROXYGRAPHICS=1 re-export</text>
  <text x="245.3" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">cached display only</text>
  <text x="360.7" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">no</text>
  <text x="475.1" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">no — needs the author</text>
  <line x1="0" y1="62" x2="537.8" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">Explode in the vertical product</text>
  <text x="245.3" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">full, as primitives</text>
  <text x="360.7" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">no</text>
  <text x="475.1" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">no</text>
  <line x1="0" y1="92" x2="537.8" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">Install the object enabler</text>
  <text x="245.3" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">full, parametric</text>
  <text x="360.7" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">yes</text>
  <text x="475.1" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">no — desktop only</text>
  <line x1="0" y1="122" x2="537.8" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="140.5" font-size="10.5" font-weight="600" fill="currentColor">Quarantine and report</text>
  <text x="245.3" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">none</text>
  <text x="360.7" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">name and extent</text>
  <text x="475.1" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">yes</text>
  <text x="0" y="172" font-size="9.5" fill="currentColor" fill-opacity="0.7">A pipeline that must run unattended has exactly one honest option: count them and report.</text>
</svg>
<!-- /fig:proxy-recovery-routes -->

The `PROXYGRAPHICS` system variable governs whether AutoCAD stores cached graphics for custom objects. If it was `0` at save time, proxies may carry no recoverable geometry after conversion. Ask the source team to set `PROXYGRAPHICS=1` and re-save, which at least preserves a visual approximation you can log and, where acceptable, use for footprint extraction.

**2. Explode custom objects at the source**

The most reliable fix is to convert custom objects to plain AutoCAD primitives *before* export. In Civil 3D or Plant 3D, exploding corridors, alignments, or pipe runs to lines, arcs, and polylines produces native entities `ezdxf` decodes fully. This trades editability for portability — acceptable when the downstream consumer only needs geometry, not the parametric model.

**3. Install the object enabler where the workflow allows**

Autodesk publishes free object enablers for many verticals. In a workflow that still runs through an AutoCAD-family reader before the Python stage, installing the matching enabler lets the true geometry survive into the exported DXF. This does not help pure-`ezdxf` pipelines, which have no enabler mechanism, but it is worth flagging to the source team.

**4. Request a native geometry export (IFC, DGN, or LandXML)**

For infrastructure objects, a format built for the data often beats DXF entirely: LandXML for alignments and surfaces, IFC for building objects. Requesting a purpose-built export sidesteps the proxy problem, because the custom object is serialized as first-class geometry rather than an opaque proxy.

**5. Treat cached graphics as approximate only**

When you must use recovered cached graphics, quarantine them. Tag every derived feature as approximate, exclude it from measurement and clash analysis, and record the proxy handle so the provenance is auditable. Never let a proxy-derived footprint enter a dataset that downstream users assume is survey-grade.

## FAQ

<details>
<summary><strong>What is an ACAD_PROXY_ENTITY in a DWG file?</strong></summary>

An `ACAD_PROXY_ENTITY` is a stand-in that AutoCAD writes for a custom object created by a vertical product such as Civil 3D or Plant 3D when the reading application lacks the object enabler that defines that class. It may carry a cached graphical representation but not the parametric geometry, so `ezdxf` cannot decode its true shape.

</details>

<details>
<summary><strong>Can ezdxf recover geometry from a proxy entity?</strong></summary>

No. `ezdxf` sees `entity.dxftype() == "ACAD_PROXY_ENTITY"` and can read only whatever cached proxy graphics were stored at save time. It cannot reconstruct the original custom object's parametric geometry. Treat any recovered cached graphics as an approximate visual snapshot, not authoritative geometry.

</details>

<details>
<summary><strong>What does PROXYGRAPHICS control?</strong></summary>

The `PROXYGRAPHICS` system variable controls whether AutoCAD saves cached graphics for custom objects into the file. With `PROXYGRAPHICS=1` the DWG stores a graphical snapshot that survives conversion; with `PROXYGRAPHICS=0` proxies may carry no recoverable geometry at all after conversion.

</details>

<details>
<summary><strong>How much proxy content is acceptable in a converted drawing?</strong></summary>

There is no universal threshold, but a pipeline should gate on the proxy ratio. A drawing that is a few percent proxies on annotation layers may be usable; one that is tens of percent proxies on the layers carrying your target geometry is not, and should be sent back for a native re-export before any downstream processing.

</details>

---

## Related Pages

- [DWG Proprietary Limitations](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/) — parent reference on the closed-format constraints that make DWG hard to process in Python
- [Understanding DWG Version Compatibility](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/understanding-dwg-version-compatibility/) — sibling workflow on the release-dependent binary changes that also cause conversion loss
- [pydwg Integration](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/) — related reference on reading proprietary `.dwg` files and the conversion tooling around them
- [DXF Entity Structure Breakdown](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/) — how native entity types differ from opaque proxy objects at the group-code level
