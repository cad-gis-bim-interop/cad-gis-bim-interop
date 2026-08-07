---
title: "Choosing ezdxf, pydwg, or ODA for Production CAD Pipelines"
description: "How to choose between pure-Python ezdxf, community DWG readers, and the licensed ODA converter for reading CAD files, scored on coverage, fidelity, licensing, and CI suitability."
slug: "choosing-ezdxf-pydwg-or-oda-for-production"
breadcrumb:
  - label: "Interoperability Decision Guides"
    url: "/interoperability-decision-guides/"
  - label: "Choosing ezdxf, pydwg, or ODA for Production"
    url: "/interoperability-decision-guides/choosing-ezdxf-pydwg-or-oda-for-production/"
datePublished: "2026-07-11"
dateModified: "2026-07-11"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Choosing ezdxf, pydwg, or ODA for Production CAD Pipelines",
      "description": "How to choose between pure-Python ezdxf, community DWG readers, and the licensed ODA converter for reading CAD files, scored on coverage, fidelity, licensing, and CI suitability.",
      "datePublished": "2026-07-11",
      "dateModified": "2026-07-11",
      "author": {"@type": "Organization", "name": "CAD GIS BIM Interop"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Interoperability Decision Guides", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/"},
        {"@type": "ListItem", "position": 2, "name": "Choosing ezdxf, pydwg, or ODA for Production", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-ezdxf-pydwg-or-oda-for-production/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Choose a CAD Reading Strategy for Production",
      "description": "A decision procedure for selecting ezdxf, a community DWG reader, or the ODA File Converter based on source format, fidelity needs, and deployment constraints.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Classify the source format", "text": "Determine whether inputs are DXF or DWG by suffix and magic bytes; DXF can be read directly, DWG cannot."},
        {"@type": "HowToStep", "position": 2, "name": "Read DXF directly with ezdxf", "text": "For DXF sources, open the file with ezdxf.readfile() and validate the version header before traversal."},
        {"@type": "HowToStep", "position": 3, "name": "Convert DWG with the ODA File Converter", "text": "For DWG sources in production, drive the ODA File Converter headlessly under xvfb-run to produce DXF, then parse with ezdxf."},
        {"@type": "HowToStep", "position": 4, "name": "Assess fidelity requirements", "text": "Confirm the chosen route preserves proxy objects and ACIS solids to the degree the downstream consumer requires."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Can ezdxf read DWG files directly?",
          "acceptedAnswer": {"@type": "Answer", "text": "No. ezdxf reads and writes DXF only; it has no DWG parser. DWG is Autodesk's closed binary format, and reading it requires either a community reverse-engineered library such as LibreDWG or a licensed converter such as the ODA File Converter, which produces DXF that ezdxf can then read."}
        },
        {
          "@type": "Question",
          "name": "Is the ODA File Converter free to use in production?",
          "acceptedAnswer": {"@type": "Answer", "text": "The ODA File Converter is distributed free of charge under a registration and redistribution agreement, but it is not open source and its licence terms govern redistribution. The underlying Teigha/ODA SDK for embedding DWG support in your own application is a paid commercial licence. Settle licensing at design time, not deployment."}
        },
        {
          "@type": "Question",
          "name": "Why not just use LibreDWG or pydwg for DWG in production?",
          "acceptedAnswer": {"@type": "Answer", "text": "Community DWG readers such as LibreDWG and the pydwg bindings cover only a subset of DWG versions and entity types, and coverage varies by release. They are viable for exploratory work or where inputs are constrained to known-good versions, but for unattended production across the full R12-to-2018 range the ODA converter is materially more reliable."}
        },
        {
          "@type": "Question",
          "name": "How do I run the ODA File Converter on a headless server?",
          "acceptedAnswer": {"@type": "Answer", "text": "The ODA File Converter is a Qt GUI application, so it needs a display. On a headless server, wrap the invocation in xvfb-run to supply a virtual framebuffer, pass input and output directories and the target DXF version as arguments, and check the process return code. The converter writes DXF files that ezdxf then parses."}
        }
      ]
    }
  ]
}
</script>

# Choosing ezdxf, pydwg, or ODA for Production CAD Pipelines

Choosing how to read CAD files reliably is the first decision in any pipeline that ingests Autodesk formats, and the answer depends far more on whether your inputs are DXF or DWG than on any single tool's feature list. This guide compares three approaches within the [Interoperability Decision Guides](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/) framework: pure-Python `ezdxf`, community DWG readers such as LibreDWG and the `pydwg` bindings, and the licensed ODA File Converter and Teigha/ODA SDK.

The decision matters because the three tools are not substitutes. `ezdxf` reads DXF perfectly and cannot open DWG at all; community readers open some DWG but carry coverage and stability risk; the ODA converter opens DWG reliably across the full version range but adds a licence and a binary dependency. Picking the wrong one does not fail at import — it fails weeks later when a production DWG lands on a headless runner that has no way to read it. As with every decision in the [Interoperability Decision Guides](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/) section, the goal is to score the real options against coverage, fidelity, licensing, and operational fit before the choice is baked in.

<svg viewBox="0 0 720 372" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Decision tree for choosing a CAD reader: DXF inputs go to ezdxf; DWG inputs go to the ODA converter when headless CI reliability and full version support are required, or to a community reader for constrained experimental use" style="width:100%;max-width:720px;display:block;margin:1.5rem auto;">
  <title>CAD Reader Decision Tree</title>
  <desc>A decision tree. The CAD source is tested for DWG. If it is not DWG it is read directly by ezdxf. If it is DWG, a second test asks whether headless CI operation and full version support are required; if yes the ODA File Converter produces DXF for ezdxf, if no a community reader such as LibreDWG or pydwg may be used for constrained experimental work.</desc>
  <defs>
    <marker id="cez-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor" opacity="0.6"/>
    </marker>
  </defs>
  <rect x="0" y="0" width="720" height="372" fill="var(--color-surface)"/>
  <!-- source box -->
  <rect x="290" y="12" width="140" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.45"/>
  <text x="360" y="32" text-anchor="middle" font-size="11" fill="currentColor" font-weight="600">CAD source file</text>
  <text x="360" y="48" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.65">.dwg or .dxf</text>
  <line x1="360" y1="56" x2="360" y2="84" stroke="currentColor" stroke-width="1.5" opacity="0.5" marker-end="url(#cez-arr)"/>
  <!-- diamond 1: is DWG? -->
  <polygon points="360,86 424,120 360,154 296,120" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.55"/>
  <text x="360" y="124" text-anchor="middle" font-size="11" fill="currentColor">DWG?</text>
  <!-- left branch: no -> ezdxf -->
  <line x1="296" y1="120" x2="162" y2="120" stroke="currentColor" stroke-width="1.5" opacity="0.5" marker-end="url(#cez-arr)"/>
  <text x="228" y="112" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.6">no — DXF</text>
  <rect x="40" y="96" width="120" height="48" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.55"/>
  <text x="100" y="117" text-anchor="middle" font-size="11" fill="currentColor" font-weight="600">ezdxf</text>
  <text x="100" y="133" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.65">pure Python</text>
  <!-- down branch: yes -->
  <line x1="360" y1="154" x2="360" y2="188" stroke="currentColor" stroke-width="1.5" opacity="0.5" marker-end="url(#cez-arr)"/>
  <text x="392" y="176" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.6">yes</text>
  <!-- diamond 2 -->
  <polygon points="360,188 456,228 360,268 264,228" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.55"/>
  <text x="360" y="224" text-anchor="middle" font-size="10" fill="currentColor">Headless CI +</text>
  <text x="360" y="238" text-anchor="middle" font-size="10" fill="currentColor">all versions?</text>
  <!-- right branch: yes -> ODA -->
  <line x1="456" y1="228" x2="556" y2="228" stroke="currentColor" stroke-width="1.5" opacity="0.5" marker-end="url(#cez-arr)"/>
  <text x="506" y="220" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.6">yes</text>
  <rect x="558" y="198" width="150" height="60" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.55"/>
  <text x="633" y="222" text-anchor="middle" font-size="11" fill="currentColor" font-weight="600">ODA Converter</text>
  <text x="633" y="240" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.65">DWG to DXF to ezdxf</text>
  <!-- down branch: no -> community -->
  <line x1="360" y1="268" x2="360" y2="300" stroke="currentColor" stroke-width="1.5" opacity="0.5" marker-end="url(#cez-arr)"/>
  <text x="360" y="288" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.6">no / experimental</text>
  <rect x="268" y="302" width="184" height="56" rx="6" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
  <text x="360" y="325" text-anchor="middle" font-size="11" fill="currentColor" font-weight="600">LibreDWG / pydwg</text>
  <text x="360" y="343" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.65">partial, higher risk</text>
</svg>

## Prerequisites

Before working through the decision, confirm your environment and assumptions:

- **Python 3.9+** — the snippets use `pathlib`, type hints, and f-strings. `# python>=3.9`
- **ezdxf ≥ 1.1.0** — install with `pip install "ezdxf>=1.1.0"`. This is the reader for all DXF, whether the DXF was authored directly or produced by conversion from DWG.
- **ODA File Converter** — a free-to-register desktop binary from the Open Design Alliance, needed only for the DWG route. On a server it requires a virtual display (`xvfb`). Confirm it is on `PATH` as `ODAFileConverter`.
- **xvfb** (headless only) — `apt-get install -y xvfb` provides `xvfb-run` for driving the GUI converter without a display.
- **Knowledge of the DXF entity model** — you should already be comfortable traversing model space and querying entities, as covered in the [ezdxf Deep Dive](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/). This guide is about *reaching* readable geometry, not about extracting it once you have it.
- **Awareness of DWG's constraints** — the reasons DWG cannot be read in pure Python are documented in [pydwg Integration](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/) and the [DWG Proprietary Limitations](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/) reference.

## Architectural Overview

The three approaches differ along a small number of measurable dimensions. The table below scores each on the variables that actually decide production suitability.

| Dimension | ezdxf | LibreDWG / pydwg | ODA File Converter / Teigha SDK |
|---|---|---|---|
| Reads DXF | Yes (R12–R2018) | Via conversion only | Writes DXF for ezdxf to read |
| Reads DWG | No | Partial, version-dependent | Yes, reliably |
| DWG version range | — | Subset, varies by release | R12 through AutoCAD 2018 (AC1032) and later |
| Proxy object handling | Exposes if present in DXF | Often dropped | Preserved through conversion (as proxies) |
| ACIS solid fidelity | Raw payload exposed | Frequently incomplete | Preserved as ACIS in the DXF |
| Licensing | Open source (MIT) | Open source (GPL, LibreDWG) | Free-to-register binary; SDK is commercial |
| Headless / CI | Native, trivial | Native (CLI/bindings) | Needs `xvfb`; GUI-derived binary |
| Throughput | High (pure parse) | Moderate, variable | Conversion adds a subprocess per file |
| Failure mode | Clear exception on non-DXF | Silent partial reads | Non-zero exit / empty output |

<!-- fig:choose-route-decision -->
<svg viewBox="-20 -20 379.7 229.6" role="img" aria-label="DXF input is a pure Python parse; DWG input forces a conversion step with a licensed binary in the deployment" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>The decision the source format actually forces</title>
  <desc>A branch on what the input really is, established from the file magic rather than the extension. A DXF is a pure parse in Python with no external dependency. A DWG needs a conversion step first, which brings a redistributable licence, an installed binary and a subprocess into the deployment. The library question is downstream of this branch, not upstream of it.</desc>
  <defs>
    <marker id="chz1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="chz1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="379.7" height="229.6" fill="var(--color-surface)"/>
  <polygon points="169.8,0 264.8,31 169.8,62 74.8,31" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-width="1.6"/>
  <text x="169.8" y="35" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">What are the first bytes?</text>
  <rect x="0" y="128" width="155.8" height="61.6" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="77.9" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">DXF</text>
  <text x="77.9" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">ezdxf, pure Python</text>
  <text x="77.9" y="175.4" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">no external binary</text>
  <path d="M 169.8 62 L 169.8 92 L 77.9 92 L 77.9 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#chz1-a)" stroke-linejoin="round"/>
  <text x="77.9" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">tagged text</text>
  <rect x="183.8" y="128" width="155.8" height="61.6" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="261.8" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">DWG</text>
  <text x="261.8" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">convert, then parse</text>
  <text x="261.8" y="175.4" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">licensed binary in the image</text>
  <path d="M 169.8 62 L 169.8 92 L 261.8 92 L 261.8 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#chz1-a)" stroke-linejoin="round"/>
  <text x="261.8" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">&quot;AC10xx&quot;</text>
</svg>
<!-- /fig:choose-route-decision -->

Two conclusions fall out of the table. First, `ezdxf` is not in competition with the DWG tools; it is the DXF reader that sits *after* whichever DWG strategy you pick. Second, the real contest is between community readers and the ODA converter, and it turns almost entirely on how much you value guaranteed version coverage and clear failure behaviour versus avoiding a licensed binary.

**DWG version codes**, for reference when validating what a converter must handle:

| `$ACADVER` code | AutoCAD release | Notes |
|---|---|---|
| AC1009 | R12 | Oldest DWG the ODA converter targets as DXF output |
| AC1015 | 2000–2002 | Widely present in legacy archives |
| AC1018 | 2004–2006 | Common in municipal datasets |
| AC1021 | 2007–2009 | Unicode layer names appear here |
| AC1024 | 2010–2012 | — |
| AC1027 | 2013–2017 | — |
| AC1032 | 2018+ | Current production DWG version |

## Step-by-Step Implementation

### 1. Classify the source format

Never assume the extension is honest, but do start with it. A cheap suffix check routes the file; a magic-bytes check confirms it. DXF ASCII files begin with a `0\nSECTION` group pair, and DWG files begin with an `AC10xx` version tag in their first six bytes.

```python
# python>=3.9
from pathlib import Path


def classify_cad(path: Path) -> str:
    """Return 'dxf', 'dwg', or raise for anything unrecognised."""
    head = path.read_bytes()[:6]
    if head[:2] == b"AC" and head[2:6].isdigit():
        return "dwg"                      # e.g. b"AC1032"
    suffix = path.suffix.lower()
    if suffix == ".dxf":
        return "dxf"
    if suffix == ".dwg":
        return "dwg"
    raise ValueError(f"Not a recognised CAD source: {path.name}")
```

### 2. Read DXF directly with ezdxf

If the source is DXF, there is no decision left — `ezdxf` is the answer, and no conversion or licence is involved. Validate the version header before traversing so unsupported revisions fail early.

```python
# ezdxf>=1.1.0 | python>=3.9
import ezdxf

SUPPORTED = {"AC1009", "AC1015", "AC1018", "AC1021", "AC1024", "AC1027", "AC1032"}


def read_dxf(path: str) -> ezdxf.document.Drawing:
    doc = ezdxf.readfile(path)
    ver = doc.header.get("$ACADVER", "UNKNOWN")
    if ver not in SUPPORTED:
        raise ValueError(f"Unsupported DXF revision: {ver}")
    return doc
```

### 3. Convert DWG with the ODA File Converter (production route)

If the source is DWG and the pipeline must run unattended across arbitrary versions, drive the ODA File Converter to produce DXF, then read that DXF with the function above. The converter is a GUI binary, so on a server it must be wrapped in `xvfb-run`. Its positional arguments are input directory, output directory, output version, output format, recurse flag, audit flag, and an optional filename filter.

```python
# python>=3.9  (external: ODAFileConverter, xvfb-run)
import shutil
import subprocess
from pathlib import Path


def convert_dwg_to_dxf(dwg_path: Path, out_dir: Path, version: str = "ACAD2018") -> Path:
    """Convert a single DWG to DXF headlessly via the ODA File Converter."""
    if shutil.which("ODAFileConverter") is None:
        raise RuntimeError("ODAFileConverter not on PATH; DWG cannot be read.")
    out_dir.mkdir(parents=True, exist_ok=True)

    # args: in_dir out_dir out_version out_format recurse(0/1) audit(0/1) filter
    result = subprocess.run(
        [
            "xvfb-run", "-a", "ODAFileConverter",
            str(dwg_path.parent), str(out_dir),
            version, "DXF", "0", "1", dwg_path.name,
        ],
        capture_output=True,
        text=True,
        timeout=300,
    )
    dxf_path = out_dir / (dwg_path.stem + ".dxf")
    if result.returncode != 0 or not dxf_path.exists():
        raise RuntimeError(
            f"ODA conversion failed for {dwg_path.name}: "
            f"rc={result.returncode} stderr={result.stderr.strip()!r}"
        )
    return dxf_path
```

The audit flag (`1`) tells the converter to repair recoverable errors during conversion; leave it on for untrusted inputs. Because a hung GUI process would otherwise block a worker forever, the `timeout` is mandatory in production.

### 4. Compose the route

With classification, direct reading, and conversion in place, a single entry point implements the whole decision tree. This is the function the rest of a pipeline calls; it never has to know which strategy was used.

```python
# ezdxf>=1.1.0 | python>=3.9
from pathlib import Path

import ezdxf


def open_cad(path: Path, work_dir: Path) -> ezdxf.document.Drawing:
    kind = classify_cad(path)
    if kind == "dxf":
        return read_dxf(str(path))
    # kind == "dwg": convert then read
    dxf_path = convert_dwg_to_dxf(path, work_dir / "_dxf")
    return read_dxf(str(dxf_path))
```

### 5. Assess fidelity before trusting the output

Reaching a readable document is necessary but not sufficient. Confirm the route preserved what the consumer needs. Proxy entities from vertical products and ACIS solids are the two things most often lost, so probe for them and log rather than assume.

```python
# ezdxf>=1.1.0 | python>=3.9
import logging


def audit_fidelity(doc: ezdxf.document.Drawing) -> dict:
    msp = doc.modelspace()
    proxies = sum(1 for e in msp if e.dxftype() == "ACAD_PROXY_ENTITY")
    solids = sum(1 for e in msp if e.dxftype() == "3DSOLID")
    if proxies:
        logging.warning("%d proxy entities present; geometry may be opaque", proxies)
    return {"proxy_entities": proxies, "solids_3d": solids}
```

## Edge Cases & Gotchas

### DWG passed to ezdxf.readfile()

<!-- fig:choose-capability-matrix -->
<svg viewBox="-20 -20 582 184.1" role="img" aria-label="ezdxf on DXF, ODA conversion and pure-Python DWG readers compared on input, external binary, headless operation and version coverage" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:582px;display:block;margin:1.5rem auto;">
  <title>The three routes on the dimensions that decide deployment</title>
  <desc>Reading DXF directly, converting DWG with the ODA File Converter, and the pure-Python DWG readers compared on the properties that decide whether a route can be deployed: what input it accepts, whether it needs a binary in the container image, whether it runs unattended, and how far its version coverage reaches.</desc>
  <defs>
    <marker id="chz2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="chz2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="582" height="184.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="542" height="122" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="542" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">Route</text>
  <text x="202.7" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Accepts</text>
  <line x1="247.7" y1="0" x2="247.7" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="304.5" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">External binary</text>
  <line x1="361.3" y1="0" x2="361.3" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="396.8" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Headless</text>
  <line x1="432.3" y1="0" x2="432.3" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="487.2" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Version reach</text>
  <line x1="157.7" y1="0" x2="157.7" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="542" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">ezdxf on DXF</text>
  <text x="202.7" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">DXF only</text>
  <text x="304.5" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">none</text>
  <text x="396.8" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">yes</text>
  <text x="487.2" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">R12 → R2018</text>
  <line x1="0" y1="62" x2="542" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">ODA converter → ezdxf</text>
  <text x="202.7" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">DWG and DXF</text>
  <text x="304.5" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">ODA File Converter</text>
  <text x="396.8" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">yes</text>
  <text x="487.2" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">R2000 → current</text>
  <line x1="0" y1="92" x2="542" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">Pure-Python DWG readers</text>
  <text x="202.7" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">some DWG</text>
  <text x="304.5" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">none</text>
  <text x="396.8" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">yes</text>
  <text x="487.2" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">partial, per release</text>
  <text x="0" y="142" font-size="9.5" fill="currentColor" fill-opacity="0.7">The middle row is the only one that reads arbitrary DWG unattended — and the only one with a licence to read.</text>
</svg>
<!-- /fig:choose-capability-matrix -->

`ezdxf.readfile()` on a DWG raises, but the message is not always obvious to a caller who expected it to "just read CAD." Classify first (Step 1) so the failure is a deliberate route decision, not an unhandled exception deep in a worker.

```python
try:
    doc = ezdxf.readfile(str(path))
except (ezdxf.DXFStructureError, IOError):
    logging.error("Not readable as DXF; route through ODA if DWG: %s", path.name)
    raise
```

### ODA converter silently produces no output

The converter can exit `0` yet write nothing when the target version is incompatible or the input is corrupt. Always assert the expected output file exists, as Step 3 does; never trust the return code alone.

### Proxy objects survive conversion but stay opaque

The ODA converter preserves proxy entities as proxies — it does not decode the custom objects that Civil 3D or Plant 3D wrote. If the consumer needs that geometry, no reader here will supply it; the fix is upstream, by exploding proxies in the authoring application. This is the same constraint documented under [DWG Proprietary Limitations](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/).

### Community readers report partial success

LibreDWG and `pydwg` may open a file and return a subset of entities without signalling that the rest were skipped. This silent partiality is the core production risk. If you use them, compare an entity count against a known-good ODA conversion of the same file before trusting the result, and confine them to input sets whose versions you have verified.

### Encoding of layer names in older DWG

DWG written before the 2007 (AC1021) Unicode transition may carry code-page-encoded layer names that surface as mojibake after conversion. Normalise names on read and keep the original bytes in your audit log so a mis-decode is recoverable.

### xvfb collisions under parallelism

Running many `xvfb-run` invocations concurrently can collide on display numbers. The `-a` flag selects a free display automatically; keep it, and give each worker its own output directory to avoid two conversions racing on the same DXF path.

## Validation & Testing

Encode the decision as a test so it cannot silently regress when a library or the converter is upgraded. The test below asserts that both routes reach a readable document and that a DWG conversion yields at least as many entities as a stored baseline.

```python
# ezdxf>=1.1.0 | python>=3.9
from pathlib import Path

import ezdxf


def test_dxf_route_reads_baseline():
    doc = ezdxf.readfile("tests/fixtures/plan_R2018.dxf")
    assert doc.header.get("$ACADVER") == "AC1032"
    assert sum(1 for _ in doc.modelspace()) >= 500


def test_dwg_route_matches_reference(tmp_path: Path):
    # convert_dwg_to_dxf / classify_cad imported from the pipeline module
    dxf_path = convert_dwg_to_dxf(Path("tests/fixtures/plan_R2018.dwg"), tmp_path)
    doc = ezdxf.readfile(str(dxf_path))
    count = sum(1 for _ in doc.modelspace())
    # Baseline captured from a known-good conversion; guards against silent loss.
    assert count >= 500, f"Conversion dropped entities: {count} < 500"
```

Keep one fixture per DWG version you support (R12 through AC1032) so a coverage regression in the converter or a reader shows up as a failing test rather than as missing geometry in production.

## Performance & Scale

The DXF route is a pure parse and scales the way `ezdxf` does — bounded by entity count and I/O, comfortably thousands of entities per millisecond of iteration for typical drawings. The DWG route pays a fixed subprocess cost per file for conversion, which dominates for small files and amortises for large ones. Two levers matter at scale:

- **Batch conversions per converter invocation.** The ODA converter accepts a directory and a recurse flag; converting a directory in one call amortises process startup across many files far better than one subprocess per file. Trade this against the coarser error granularity of a batch.
- **Separate the CPU-bound parse from the subprocess-bound conversion.** Run conversions in a bounded pool sized to your CPU count and keep parsing in a separate stage, so a slow conversion does not starve parsing workers.

To choose a batch size, thread count, and regression threshold on evidence rather than guesswork, measure the parse stage directly. The [benchmarking DXF parsing throughput in Python](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-ezdxf-pydwg-or-oda-for-production/benchmarking-dxf-parsing-throughput-in-python/) walkthrough gives a reusable harness for entities-per-second, megabytes-per-second, and peak memory, and shows how to turn those numbers into a CI regression gate.

## FAQ

<details>
<summary><strong>Can ezdxf read DWG files directly?</strong></summary>

No. `ezdxf` reads and writes DXF only; it has no DWG parser. DWG is Autodesk's closed binary format, and reading it requires either a community reverse-engineered library such as LibreDWG or a licensed converter such as the ODA File Converter, which produces DXF that `ezdxf` can then read. The [pydwg Integration](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/) workflow covers the community-reader path in detail.

</details>

<details>
<summary><strong>Is the ODA File Converter free to use in production?</strong></summary>

The ODA File Converter is distributed free of charge under a registration and redistribution agreement, but it is not open source, and its licence terms govern redistribution. The underlying Teigha/ODA SDK, for embedding DWG support directly in your own application, is a paid commercial licence. Settle licensing at design time, not deployment, because it determines whether your workers can be licence-free containers.

</details>

<details>
<summary><strong>Why not just use LibreDWG or pydwg for DWG in production?</strong></summary>

Community DWG readers such as LibreDWG and the `pydwg` bindings cover only a subset of DWG versions and entity types, and coverage varies by release. They are viable for exploratory work or where inputs are constrained to known-good versions, but for unattended production across the full R12-to-2018 range the ODA converter is materially more reliable and, critically, fails loudly rather than returning partial reads.

</details>

<details>
<summary><strong>How do I run the ODA File Converter on a headless server?</strong></summary>

The ODA File Converter is a Qt GUI application, so it needs a display. On a headless server, wrap the invocation in `xvfb-run -a` to supply a virtual framebuffer, pass the input and output directories and the target DXF version as positional arguments, and check both the return code and that the expected output file exists. The converter writes DXF files that `ezdxf` then parses.

</details>

---

## Related Pages

- [Interoperability Decision Guides](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/) — the decision framework this guide belongs to, covering library, format, and storage choices end to end
- [Benchmarking DXF Parsing Throughput in Python](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-ezdxf-pydwg-or-oda-for-production/benchmarking-dxf-parsing-throughput-in-python/) — measure entities-per-second, megabytes-per-second, and peak memory to size the parse stage and set CI gates
- [DXF vs IFC for GIS Ingestion](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/dxf-vs-ifc-for-gis-ingestion/) — the next decision once the source is readable: which interchange format carries the data GIS needs
- [GeoPackage vs PostGIS for CAD Output](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/geopackage-vs-postgis-for-cad-output/) — where the parsed geometry lands, scored on concurrency and query needs
- [ezdxf Deep Dive](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/) — the entity model and traversal patterns for the DXF you reach through either route
- [pydwg Integration](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/) — the community DWG reader path and its proxy-object and version constraints
