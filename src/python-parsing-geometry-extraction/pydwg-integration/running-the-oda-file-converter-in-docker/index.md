---
title: "Running the ODA File Converter in Docker"
description: "Package the ODA File Converter for a headless container: the virtual display it still expects, licensing and redistribution, a health check that proves it converts, and supervising it from Python."
slug: "running-the-oda-file-converter-in-docker"
breadcrumb:
  - label: "Python Parsing & Geometry Extraction"
    url: "/python-parsing-geometry-extraction/"
  - label: "DWG-to-Python Integration"
    url: "/python-parsing-geometry-extraction/pydwg-integration/"
  - label: "Running the ODA File Converter in Docker"
    url: "/python-parsing-geometry-extraction/pydwg-integration/running-the-oda-file-converter-in-docker/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Running the ODA File Converter in Docker",
      "description": "Package the ODA File Converter for a headless container: the virtual display it still expects, licensing and redistribution, a health check that proves it converts, and supervising it from Python.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/running-the-oda-file-converter-in-docker/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Python Parsing & Geometry Extraction", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/"},
        {"@type": "ListItem", "position": 2, "name": "DWG-to-Python Integration", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/"},
        {"@type": "ListItem", "position": 3, "name": "Running the ODA File Converter in Docker", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/running-the-oda-file-converter-in-docker/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Run the ODA File Converter inside a container",
      "description": "Install the converter and its display dependencies, provide a virtual framebuffer, add a health check that converts a fixture, and supervise the process from Python.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Install the converter and its dependencies", "text": "Add the converter package and the shared libraries it links against to the image, since it is a desktop application rather than a command-line tool."},
        {"@type": "HowToStep", "position": 2, "name": "Provide a virtual display", "text": "Run a virtual framebuffer, because the converter initialises a graphical toolkit even when driven with command-line arguments."},
        {"@type": "HowToStep", "position": 3, "name": "Add a converting health check", "text": "Convert a small committed fixture at container start so a broken image fails immediately rather than on the first real delivery."},
        {"@type": "HowToStep", "position": 4, "name": "Supervise from Python", "text": "Run each conversion under a timeout and verify the output file rather than trusting the exit code."},
        {"@type": "HowToStep", "position": 5, "name": "Handle licensing deliberately", "text": "Confirm the redistribution terms for the converter before baking it into an image that will be pushed to a registry."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Why does the converter need a display in headless mode?",
          "acceptedAnswer": {"@type": "Answer", "text": "Because it is a desktop application with a command-line invocation, not a command-line tool. It initialises its graphical toolkit during start-up regardless of how it was invoked, and without a display that initialisation fails — usually with an error that does not mention displays at all. A virtual framebuffer satisfies it and costs almost nothing."}
        },
        {
          "@type": "Question",
          "name": "Can I redistribute the converter in a container image?",
          "acceptedAnswer": {"@type": "Answer", "text": "That is a licensing question, not a technical one, and it has to be answered before the image is pushed anywhere. The converter is free to use and its redistribution terms are specific. Read them for the version you are packaging, and treat an image pushed to a shared registry as distribution."}
        },
        {
          "@type": "Question",
          "name": "What should the health check actually do?",
          "acceptedAnswer": {"@type": "Answer", "text": "Convert. Checking that the binary exists proves nothing — the failures in this setup are missing shared libraries and an unavailable display, both of which pass an existence check and fail on first use. Convert a tiny committed DWG fixture and assert the output opens, at container start, so a broken image never accepts work."}
        }
      ]
    }
  ]
}
</script>

# Running the ODA File Converter in Docker

The converter is the only dependable route from arbitrary DWG into a Python pipeline, and it is a desktop application. Containerising it means installing the shared libraries it links against, giving it a virtual framebuffer because it initialises a graphical toolkit whatever the invocation, proving at container start that it actually converts, and supervising each run under a timeout. This page is part of [DWG-to-Python Integration](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/).

## What Makes This Different From a CLI Tool

Three properties of the converter shape the image.

<!-- fig:oda-desktop-app -->
<svg viewBox="-20 -20 419 184.1" role="img" aria-label="A graphical toolkit, a desktop library stack and redistribution terms — what containerising the converter requires" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>Three properties that shape the image</title>
  <desc>Three characteristics of the converter and what each one requires of a container. It is a graphical application that initialises a toolkit whatever the invocation, it links against a desktop library stack, and it carries specific redistribution terms. The first two produce unhelpful failures; the third is not a technical question at all.</desc>
  <defs>
    <marker id="od1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="od1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="419" height="184.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="379" height="122" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="379" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">Property</text>
  <text x="191.7" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Requires</text>
  <line x1="251.1" y1="0" x2="251.1" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="315" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Failure if absent</text>
  <line x1="132.2" y1="0" x2="132.2" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="379" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">Graphical toolkit</text>
  <text x="191.7" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">a virtual framebuffer</text>
  <text x="315" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">unrelated-looking error</text>
  <line x1="0" y1="62" x2="379" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">Desktop library stack</text>
  <text x="191.7" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">glibc base + libraries</text>
  <text x="315" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">library load failure</text>
  <line x1="0" y1="92" x2="379" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">Licensed</text>
  <text x="191.7" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">reading the terms</text>
  <text x="315" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">not a technical failure</text>
  <text x="0" y="142" font-size="9.5" fill="currentColor" fill-opacity="0.7">The first two pass an &quot;is the binary there?&quot; check and fail on first use.</text>
</svg>
<!-- /fig:oda-desktop-app -->

**It is a graphical application.** The command-line invocation drives the same binary a person would use interactively, and the binary initialises its toolkit during start-up. In a container with no display that initialisation fails, and the failure message is rarely about displays — it is a library load error or a silent non-zero exit. A virtual framebuffer resolves it.

**It links against a desktop library stack.** The package pulls in more than a headless base image carries, and a missing shared library produces the same class of unhelpful failure. This is why the health check has to convert rather than merely check that a file exists.

**It is licensed.** Free to use, with specific redistribution terms. An image containing it, pushed to a registry, is a distribution decision that belongs to whoever owns licensing rather than to whoever writes the Dockerfile.

## Production-Ready Script

The container definition:

<!-- fig:oda-healthcheck -->
<svg viewBox="-20 -20 578 194.1" role="img" aria-label="Checking the binary exists passes a broken image; converting a fixture exercises display, libraries and licence" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:578px;display:block;margin:1.5rem auto;">
  <title>Why the health check converts a fixture</title>
  <desc>Two candidate health checks. Testing that the binary exists passes in an image with no display and no shared libraries, which are exactly the two ways this setup fails. Converting a small committed fixture exercises the display, the libraries and the licence together, and fails at container start rather than on the first real delivery.</desc>
  <defs>
    <marker id="od2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="od2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="578" height="194.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="254" height="130" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4" stroke-dasharray="5 4"/>
  <text x="127" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Binary exists</text>
  <line x1="14" y1="33" x2="240" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="16" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— passes with no display</text>
  <text x="16" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— passes with missing libraries</text>
  <text x="16" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— passes without a licence</text>
  <text x="16" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— proves nothing</text>
  <rect x="284" y="0" width="254" height="130" rx="6" fill="currentColor" fill-opacity="0.11" stroke="currentColor" stroke-width="1.9"/>
  <text x="411" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Convert a fixture</text>
  <line x1="298" y1="33" x2="524" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="300" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— exercises the framebuffer</text>
  <text x="300" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— exercises every library</text>
  <text x="300" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— exercises the licence</text>
  <text x="300" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— fails at start, not at work</text>
  <text x="269" y="152" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">A broken image should never accept a job.</text>
</svg>
<!-- /fig:oda-healthcheck -->

{% raw %}
```dockerfile
# A Debian base rather than Alpine: the converter links against glibc.
FROM debian:12-slim

ENV DEBIAN_FRONTEND=noninteractive \
    DISPLAY=:99 \
    ODA_BIN=/usr/bin/ODAFileConverter

RUN apt-get update && apt-get install -y --no-install-recommends \
      xvfb libxcb-xinerama0 libxcb-icccm4 libxcb-image0 libxcb-keysyms1 \
      libxcb-render-util0 libxkbcommon-x11-0 libglu1-mesa libfontconfig1 \
      ca-certificates python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install the converter package obtained under your own licence terms.
COPY vendor/ODAFileConverter.deb /tmp/
RUN dpkg -i /tmp/ODAFileConverter.deb || apt-get -fy install \
    && rm /tmp/ODAFileConverter.deb

COPY fixtures/minimal.dwg /opt/fixtures/minimal.dwg
COPY convert.py /opt/convert.py

# Fail the container at start if it cannot actually convert.
HEALTHCHECK --interval=60s --timeout=120s --start-period=30s --retries=2 \
  CMD python3 /opt/convert.py --selftest || exit 1

ENTRYPOINT ["python3", "/opt/convert.py"]
```
{% endraw %}

And the supervisor it runs:

{% raw %}
```python
# Python 3.9+, ezdxf>=1.1.0 — /opt/convert.py
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import ezdxf

ODA = os.environ.get("ODA_BIN", "/usr/bin/ODAFileConverter")
FIXTURE = Path("/opt/fixtures/minimal.dwg")


class ConversionError(RuntimeError):
    pass


def _run(indir: Path, outdir: Path, *, version: str, timeout_s: int) -> None:
    """The seven positional arguments, under a virtual display and a timeout."""
    cmd = [
        "xvfb-run", "-a", "--server-args=-screen 0 1024x768x24",
        ODA, str(indir), str(outdir), version, "DXF", "0", "1",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_s)
    except subprocess.TimeoutExpired as exc:
        raise ConversionError(f"converter exceeded {timeout_s}s") from exc
    if proc.returncode != 0:
        tail = (proc.stderr or proc.stdout or "").strip().splitlines()[-3:]
        raise ConversionError(f"converter exited {proc.returncode}: {' | '.join(tail)}")


def convert(dwg: Path, out_dxf: Path, *, version: str = "ACAD2018",
            timeout_s: int = 600) -> Path:
    """Convert one file and VERIFY the output — the exit code proves nothing."""
    with tempfile.TemporaryDirectory() as tmp:
        indir, outdir = Path(tmp) / "in", Path(tmp) / "out"
        indir.mkdir(); outdir.mkdir()
        shutil.copy2(dwg, indir / dwg.name)

        _run(indir, outdir, version=version, timeout_s=timeout_s)

        produced = list(outdir.glob("*.dxf"))
        if not produced:
            raise ConversionError(f"{dwg.name}: converter wrote no DXF")
        doc = ezdxf.readfile(str(produced[0]))       # opening it IS the verification
        if sum(1 for _ in doc.modelspace()) == 0:
            raise ConversionError(f"{dwg.name}: converted DXF has no modelspace entities")

        out_dxf.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(produced[0], out_dxf)
    return out_dxf


def selftest() -> int:
    """Convert a committed fixture. A binary that exists is not a binary that works."""
    try:
        with tempfile.TemporaryDirectory() as tmp:
            convert(FIXTURE, Path(tmp) / "out.dxf", timeout_s=180)
    except Exception as exc:
        print(f"selftest FAILED: {exc}", file=sys.stderr)
        return 1
    print("selftest ok")
    return 0


if __name__ == "__main__":
    sys.exit(selftest() if "--selftest" in sys.argv else 0)
```
{% endraw %}

**Key implementation notes:**

- `xvfb-run -a` picks a free display number, so several conversions can run on one host without colliding on `:99`.
- The conversion is verified by opening the output and counting entities. A converter that exits zero having written an empty or missing file is a routine occurrence, not an edge case.
- The health check converts a fixture. It is the only check that exercises the display, the shared libraries and the licence together.
- Input and output directories are per-conversion temporaries. The converter takes directories, not files, and sharing one output directory across concurrent conversions is a race.
- The recovery-mode audit described in the [DXF audit guide](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/auditing-and-repairing-dxf-files-with-ezdxf/) belongs immediately after this step, not inside it — conversion and structural repair are separate concerns.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| Base image | glibc-based (Debian, Ubuntu) | musl bases do not run the binary |
| Display | `xvfb` | required even for command-line use |
| Converter | current releases | argument order stable; verify per version |
| `ezdxf` | `>=1.1.0` | output verification |
| Concurrency | one directory pair per conversion | shared output directories race |

## Fallback Strategies

**1. A library load error at start-up.** A missing shared library. Run `ldd` on the binary inside the image and add what is reported missing; the list varies by converter release.

<!-- fig:oda-supervision -->
<svg viewBox="-45 -20 477.3 310.8" role="img" aria-label="Per-conversion temporary directories, a timeout, an entity-count verification, then publish" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:477px;display:block;margin:1.5rem auto;">
  <title>Supervising one conversion</title>
  <desc>Four stages per file. Fresh input and output directories are created because the converter takes directories rather than files and a shared output directory races. The converter runs under a virtual display and a timeout. The output is opened and its entities counted — the verification — and only then copied to the destination.</desc>
  <defs>
    <marker id="od3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="od3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-45" y="-20" width="477.3" height="310.8" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="260" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="130" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Fresh directories</text>
  <text x="130" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">per conversion</text>
  <circle cx="-14" cy="24.1" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="27.6" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">1</text>
  <text x="278" y="27.6" font-size="9.5" fill="currentColor" fill-opacity="0.75">the converter takes directories</text>
  <rect x="0" y="74.2" width="260" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="130" y="94.5" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Run under xvfb</text>
  <text x="130" y="108.2" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">and a timeout</text>
  <circle cx="-14" cy="98.3" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="101.8" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">2</text>
  <text x="278" y="101.8" font-size="9.5" fill="currentColor" fill-opacity="0.75">a hang otherwise never ends</text>
  <rect x="0" y="148.4" width="260" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="130" y="168.7" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Open the output</text>
  <text x="130" y="182.4" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">count entities</text>
  <circle cx="-14" cy="172.5" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="176" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">3</text>
  <text x="278" y="176" font-size="9.5" fill="currentColor" fill-opacity="0.75">the exit code proves nothing</text>
  <rect x="0" y="222.6" width="260" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="130" y="242.9" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Publish</text>
  <text x="130" y="256.6" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">only if verified</text>
  <circle cx="-14" cy="246.7" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="250.2" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">4</text>
  <text x="278" y="250.2" font-size="9.5" fill="currentColor" fill-opacity="0.75">audit comes next, separately</text>
  <line x1="130" y1="48.2" x2="130" y2="74.2" stroke="currentColor" stroke-width="1.4" marker-end="url(#od3-a)"/>
  <line x1="130" y1="122.4" x2="130" y2="148.4" stroke="currentColor" stroke-width="1.4" marker-end="url(#od3-a)"/>
  <line x1="130" y1="196.6" x2="130" y2="222.6" stroke="currentColor" stroke-width="1.4" marker-end="url(#od3-a)"/>
</svg>
<!-- /fig:oda-supervision -->

**2. Converter exits zero, no output.** The verification catches it. The usual causes are an unsupported source version and an output directory that does not exist — the converter creates neither.

**3. Hangs on a specific file.** The timeout catches it; quarantine that file and continue. A file that hangs the converter reliably is a support case, not a retry case.

**4. Concurrency problems.** Per-conversion temporary directories and `xvfb-run -a` handle most of it. Beyond a handful of parallel conversions per host, the converter itself becomes the bottleneck — scale across hosts rather than processes.

**5. Licensing blocks the image.** Mount the converter from a host path or a private volume instead of baking it into the image, so the image itself carries no redistributable component.

## FAQ

<details>
<summary><strong>Why does the converter need a display in headless mode?</strong></summary>

Because it is a desktop application with a command-line invocation, not a command-line tool. It initialises its graphical toolkit during start-up regardless of how it was invoked, and without a display that initialisation fails — usually with an error that does not mention displays at all. A virtual framebuffer satisfies it and costs almost nothing.

</details>

<details>
<summary><strong>Can I redistribute the converter in a container image?</strong></summary>

That is a licensing question, not a technical one, and it has to be answered before the image is pushed anywhere. The converter is free to use and its redistribution terms are specific. Read them for the version you are packaging, and treat an image pushed to a shared registry as distribution.

</details>

<details>
<summary><strong>What should the health check actually do?</strong></summary>

Convert. Checking that the binary exists proves nothing — the failures in this setup are missing shared libraries and an unavailable display, both of which pass an existence check and fail on first use. Convert a tiny committed DWG fixture and assert the output opens, at container start, so a broken image never accepts work.

</details>

---

## Related Pages

- [DWG-to-Python Integration](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/) — parent workflow on the conversion hop and its alternatives
- [Batch Converting DWG to DXF with the ODA File Converter](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/batch-converting-dwg-to-dxf-with-oda-file-converter/) — the seven positional arguments this container runs
- [Auditing and Repairing DXF Files with ezdxf](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/auditing-and-repairing-dxf-files-with-ezdxf/) — the gate the converted output should pass next
