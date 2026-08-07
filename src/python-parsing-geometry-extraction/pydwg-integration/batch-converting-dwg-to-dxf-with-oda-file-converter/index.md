---
title: "Batch Converting DWG to DXF with the ODA File Converter"
description: "Wrap the ODA File Converter CLI in Python subprocess with xvfb-run to batch-convert DWG folders to DXF headlessly, then load each result with ezdxf and return a success/failure manifest."
slug: "batch-converting-dwg-to-dxf-with-oda-file-converter"
breadcrumb:
  - label: "Python Parsing & Geometry Extraction"
    url: "/python-parsing-geometry-extraction/"
  - label: "DWG-to-Python Integration"
    url: "/python-parsing-geometry-extraction/pydwg-integration/"
  - label: "Batch Converting DWG to DXF with the ODA File Converter"
    url: "/python-parsing-geometry-extraction/pydwg-integration/batch-converting-dwg-to-dxf-with-oda-file-converter/"
datePublished: "2026-07-11"
dateModified: "2026-07-11"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Batch Converting DWG to DXF with the ODA File Converter",
      "description": "Wrap the ODA File Converter CLI in Python subprocess with xvfb-run to batch-convert DWG folders to DXF headlessly, then load each result with ezdxf and return a success/failure manifest.",
      "datePublished": "2026-07-11",
      "dateModified": "2026-07-11",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Python Parsing & Geometry Extraction", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/"},
        {"@type": "ListItem", "position": 2, "name": "DWG-to-Python Integration", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/"},
        {"@type": "ListItem", "position": 3, "name": "Batch Converting DWG to DXF with the ODA File Converter", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/batch-converting-dwg-to-dxf-with-oda-file-converter/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Batch Converting DWG to DXF with the ODA File Converter",
      "description": "Convert a directory of DWG files to DXF with the ODA File Converter run headlessly under xvfb, then load each DXF with ezdxf.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Assemble the CLI arguments", "text": "Build the seven positional arguments the ODA File Converter expects: input folder, output folder, output version, output format, recurse flag, audit flag, and input filter."},
        {"@type": "HowToStep", "position": 2, "name": "Run headless under xvfb", "text": "Invoke the converter through xvfb-run -a so its Qt GUI has a virtual display, wrapped in subprocess.run with a timeout."},
        {"@type": "HowToStep", "position": 3, "name": "Verify each output DXF", "text": "Confirm a DXF exists for every input DWG; a missing output signals a per-file conversion failure the CLI does not surface in its exit code."},
        {"@type": "HowToStep", "position": 4, "name": "Load with ezdxf", "text": "Open each converted DXF with ezdxf.readfile(), falling back to ezdxf.recover.readfile() when a structure error is raised."},
        {"@type": "HowToStep", "position": 5, "name": "Return a manifest", "text": "Record each file as a success or failure with its reason so the batch produces a machine-readable report instead of a silent partial result."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Why does the ODA File Converter need xvfb on a server?",
          "acceptedAnswer": {"@type": "Answer", "text": "The ODA File Converter is a Qt GUI application even in command-line mode, so it requires an X display to initialize. On a headless Linux server there is no display, and the process exits immediately or hangs. Running it under xvfb-run -a provides a virtual framebuffer so it starts without a physical screen."}
        },
        {
          "@type": "Question",
          "name": "Should I target ACAD2018 or ACAD2013 as the output version?",
          "acceptedAnswer": {"@type": "Answer", "text": "Target ACAD2018 (AC1032) for the widest ezdxf support and modern entity coverage. Drop to ACAD2013 (AC1027) only when a downstream tool cannot read AC1032, or when proxy entities from a vertical product survive more cleanly in the older schema. Both are stable ezdxf read targets."}
        },
        {
          "@type": "Question",
          "name": "Does the converter report per-file failures in its exit code?",
          "acceptedAnswer": {"@type": "Answer", "text": "Not reliably. The ODA File Converter often returns exit code 0 even when individual files fail to convert. The robust check is to verify that an output DXF exists and opens for every input DWG, treating a missing or unreadable output as a failure regardless of the process exit code."}
        },
        {
          "@type": "Question",
          "name": "How do I stop a hung conversion from blocking the batch?",
          "acceptedAnswer": {"@type": "Answer", "text": "Wrap the subprocess call with a timeout and catch subprocess.TimeoutExpired. A single corrupt DWG can make the converter spin indefinitely, so a per-batch timeout — or per-file conversion by pointing the input folder at one file at a time — keeps one bad drawing from stalling the whole run."}
        }
      ]
    }
  ]
}
</script>

# Batch Converting DWG to DXF with the ODA File Converter

DWG is Autodesk's closed, version-fragmented binary format, and no pure-Python reader parses it reliably across releases — so the production route into `ezdxf` is to convert DWG to DXF first with the free ODA File Converter, then parse the DXF. The converter is a Qt GUI application driven through a seven-argument command line, so on a headless server you run it under `xvfb-run -a`, wrap it in `subprocess` with a timeout, and verify every output before loading it. This page is part of the [DWG-to-Python Integration](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/) workflow within the broader [Python Parsing & Geometry Extraction](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/) pipeline, and it feeds directly into [Parsing DWG Layers with Python Scripts](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/parsing-dwg-layers-with-python-scripts/), which consumes the DXF this conversion produces.

## How the ODA File Converter Handles DWG Batches

The ODA File Converter is a command-line-capable desktop application. Its CLI takes seven positional arguments, all quoted:

```
ODAFileConverter "<inDir>" "<outDir>" "<outVer>" "<outFormat>" "<recurse>" "<audit>" "<filter>"
```

<!-- fig:oda-cli-arguments -->
<svg viewBox="-20 -20 368.9 213.1" role="img" aria-label="Input path, output path, version, file type, recurse, audit and filter — the seven positional ODA converter arguments" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>The seven positional arguments, in order</title>
  <desc>The converter takes seven positional arguments and no named flags, so their order is the interface. Input and output directories, the output version and file type, a recursion flag and an audit flag, and finally an optional filter. Because they are positional, a wrapper that builds the list dynamically must never omit a middle argument — everything after it shifts by one and the converter fails in a way that reads as a bad file.</desc>
  <defs>
    <marker id="oda1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="oda1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="368.9" height="213.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="159.1" height="149" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.5"/>
  <text x="14" y="16" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">1  input directory</text>
  <line x1="165.1" y1="12.9" x2="197.1" y2="12.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="205.1" y="16" font-size="9.5" fill="currentColor" fill-opacity="0.78">a directory, never a file</text>
  <text x="14" y="35" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">2  output directory</text>
  <line x1="165.1" y1="31.9" x2="197.1" y2="31.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="205.1" y="35" font-size="9.5" fill="currentColor" fill-opacity="0.78">must already exist</text>
  <text x="14" y="54" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">3  output version</text>
  <line x1="165.1" y1="50.9" x2="197.1" y2="50.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="205.1" y="54" font-size="9.5" fill="currentColor" fill-opacity="0.78">e.g. ACAD2018</text>
  <text x="14" y="73" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">4  output file type</text>
  <line x1="165.1" y1="69.9" x2="197.1" y2="69.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="205.1" y="73" font-size="9.5" fill="currentColor" fill-opacity="0.78">DXF or DWG</text>
  <text x="14" y="92" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">5  recurse</text>
  <line x1="165.1" y1="88.9" x2="197.1" y2="88.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="205.1" y="92" font-size="9.5" fill="currentColor" fill-opacity="0.78">0 or 1</text>
  <text x="14" y="111" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">6  audit</text>
  <line x1="165.1" y1="107.9" x2="197.1" y2="107.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="205.1" y="111" font-size="9.5" fill="currentColor" fill-opacity="0.78">1 repairs on the way through</text>
  <text x="14" y="130" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">7  input filter</text>
  <line x1="165.1" y1="126.9" x2="197.1" y2="126.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="205.1" y="130" font-size="9.5" fill="currentColor" fill-opacity="0.78">optional, e.g. *.DWG</text>
  <text x="0" y="171" font-size="9.5" fill="currentColor" fill-opacity="0.7">Positional and unnamed — omitting one shifts every argument after it.</text>
</svg>
<!-- /fig:oda-cli-arguments -->

- **`inDir`** — the folder containing source drawings (the converter works on folders, not single files).
- **`outDir`** — the destination folder for converted output.
- **`outVer`** — the output version string, for example `ACAD2018` or `ACAD2013`.
- **`outFormat`** — `DXF` or `DWG` (or `DXB`).
- **`recurse`** — `1` to descend into subfolders, `0` for the top level only.
- **`audit`** — `1` to run the recover/audit pass on each file, `0` to skip it.
- **`filter`** — an input glob such as `*.DWG`.

Because it drives a Qt interface, the process needs an X display even when it produces no visible window. On a headless Linux worker there is no display, so the converter either exits immediately or blocks. `xvfb-run -a` allocates a throwaway virtual framebuffer and picks a free display number, letting the tool initialize normally. What the converter does **not** do well is report per-file failures: it frequently returns exit code `0` even when a specific drawing failed. Treat the process exit code as advisory only, and verify output existence yourself.

<svg viewBox="-6 68 712 184" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Headless DWG to DXF batch pipeline: a DWG folder is passed to xvfb-run wrapping ODAFileConverter, which writes a DXF folder that is verified and loaded per file with ezdxf, producing a success and failure manifest" style="width:100%;max-width:700px;display:block;margin:1.5rem auto;">
  <title>Headless DWG to DXF Batch Conversion</title>
  <desc>A DWG source folder is handed to xvfb-run wrapping the ODA File Converter, which writes a DXF output folder; each DXF is verified to exist and loaded with ezdxf, and the run returns a manifest splitting successes from failures.</desc>
  <defs>
    <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="currentColor"/>
    </marker>
  </defs>
  <rect x="-6" y="68" width="712" height="184" fill="var(--color-surface)"/>
  <rect x="10" y="92" width="118" height="60" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="69" y="118" text-anchor="middle" font-size="12" fill="currentColor" font-weight="600">DWG folder</text>
  <text x="69" y="138" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.75">*.DWG</text>
  <line x1="130" y1="122" x2="166" y2="122" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <rect x="168" y="84" width="164" height="76" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="250" y="108" text-anchor="middle" font-size="12" fill="currentColor" font-weight="600">xvfb-run -a</text>
  <text x="250" y="128" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.8">ODAFileConverter</text>
  <text x="250" y="146" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.75">subprocess + timeout</text>
  <line x1="334" y1="122" x2="370" y2="122" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <rect x="372" y="92" width="118" height="60" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="431" y="118" text-anchor="middle" font-size="12" fill="currentColor" font-weight="600">DXF folder</text>
  <text x="431" y="138" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.75">ACAD2018</text>
  <line x1="492" y1="122" x2="528" y2="122" stroke="currentColor" stroke-width="1.5" marker-end="url(#arr)"/>
  <rect x="530" y="84" width="160" height="76" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="610" y="108" text-anchor="middle" font-size="12" fill="currentColor" font-weight="600">ezdxf verify</text>
  <text x="610" y="128" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.8">readfile / recover</text>
  <text x="610" y="146" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.75">ok / failed manifest</text>
  <rect x="230" y="196" width="240" height="40" rx="6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="4 3"/>
  <text x="350" y="220" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.8">exit code 0 is not proof of success</text>
</svg>

The two-step DWG to DXF to `ezdxf` path also absorbs version differences. The converter reads everything from R14 through the latest AutoCAD release and writes a single normalized DXF version you choose, so your parser only ever sees one schema. That normalization is the entire reason this indirection exists — parsing DWG directly would mean tracking every AC10xx binary revision yourself.

## Production-Ready Script

The wrapper converts a directory of DWG files, runs the converter headlessly with a timeout, then verifies and loads each DXF, returning a structured manifest.

```python
# ezdxf>=1.1.0, Python 3.9+ ; requires ODA File Converter + xvfb on the host
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import ezdxf
from ezdxf import recover


def batch_dwg_to_dxf(
    in_dir: str,
    out_dir: str,
    out_version: str = "ACAD2018",
    audit: bool = True,
    recurse: bool = False,
    timeout_s: int = 900,
    oda_binary: str = "ODAFileConverter",
) -> dict:
    """Batch-convert a folder of DWG files to DXF, then validate each with ezdxf.

    Runs the ODA File Converter headlessly under xvfb-run. Returns a manifest
    dict with 'succeeded' and 'failed' lists. Raises RuntimeError if the
    converter binary or xvfb-run is missing, or if the process times out.
    """
    in_path = Path(in_dir).resolve()
    out_path = Path(out_dir).resolve()
    out_path.mkdir(parents=True, exist_ok=True)

    if shutil.which(oda_binary) is None:
        raise RuntimeError(f"{oda_binary} not found on PATH.")
    if shutil.which("xvfb-run") is None:
        raise RuntimeError("xvfb-run not found; install xvfb for headless runs.")

    # ODA CLI positional args:
    # inDir outDir outVer outFormat recurse(0|1) audit(1|0) filter
    cmd = [
        "xvfb-run", "-a",
        oda_binary,
        str(in_path),
        str(out_path),
        out_version,
        "DXF",
        "1" if recurse else "0",
        "1" if audit else "0",
        "*.DWG",
    ]

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_s,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(
            f"Conversion timed out after {timeout_s}s — likely a corrupt DWG."
        ) from exc

    # Exit code is unreliable; verify outputs per file instead.
    pattern = "**/*.DWG" if recurse else "*.DWG"
    dwg_files = sorted(
        p for p in in_path.glob(pattern) if p.suffix.lower() == ".dwg"
    )

    manifest: dict = {
        "returncode": proc.returncode,
        "succeeded": [],
        "failed": [],
    }

    for dwg in dwg_files:
        dxf = out_path / (dwg.stem + ".dxf")
        if not dxf.exists():
            manifest["failed"].append(
                {"source": dwg.name, "reason": "no DXF produced"}
            )
            continue
        try:
            # Fast path; fall back to recover for structurally damaged output.
            try:
                doc = ezdxf.readfile(str(dxf))
            except ezdxf.DXFStructureError:
                doc, auditor = recover.readfile(str(dxf))
                if auditor.has_errors:
                    raise ezdxf.DXFStructureError(
                        f"{len(auditor.errors)} unrecovered errors"
                    )
            entity_count = sum(1 for _ in doc.modelspace())
            manifest["succeeded"].append(
                {"source": dwg.name, "dxf": dxf.name, "entities": entity_count}
            )
        except Exception as exc:  # noqa: BLE001 — record any load failure
            manifest["failed"].append(
                {"source": dwg.name, "reason": f"ezdxf load failed: {exc}"}
            )

    return manifest


if __name__ == "__main__":
    import json
    import sys

    if len(sys.argv) < 3:
        print("Usage: python batch_dwg_to_dxf.py <in_dir> <out_dir> [version]")
        sys.exit(1)
    version = sys.argv[3] if len(sys.argv) > 3 else "ACAD2018"
    result = batch_dwg_to_dxf(sys.argv[1], sys.argv[2], out_version=version)
    print(json.dumps(result, indent=2))
    if result["failed"]:
        sys.exit(2)  # non-zero exit so CI catches partial batches
```

Key implementation notes:

- **`xvfb-run -a` is mandatory on headless hosts.** The `-a` flag auto-selects a free display number, avoiding collisions when several conversion workers run concurrently. Without it the Qt front end fails to initialize and the process exits before writing anything.
- **Verify outputs, never trust the exit code.** The converter returns `0` on partial failures, so the script enumerates source DWGs and checks that a matching DXF exists and opens. A missing or unreadable DXF is recorded as a failure with a reason.
- **`ezdxf.recover.readfile()` is the fallback loader.** When `readfile()` raises `DXFStructureError` on an audited-but-imperfect output, `recover.readfile()` returns the document plus an `auditor`; inspect `auditor.has_errors` before trusting the geometry.
- **The timeout protects the batch.** A single corrupt DWG can make the converter spin forever. `subprocess.run(..., timeout=...)` bounds the whole run; for large folders, convert in smaller batches so one timeout does not discard hours of work.
- **A non-zero process exit on failures** lets CI treat a partial batch as a build failure rather than silently ingesting incomplete data downstream.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| Python | 3.9 – 3.12 | Uses `subprocess`, `pathlib`, `shutil.which`; no version-specific syntax beyond type hints. |
| ODA File Converter | 2023+ | Use 2024 for R2021/R2024 sources; the seven-argument CLI signature is stable across recent releases. |
| Output version | `ACAD2013` (AC1027) – `ACAD2018` (AC1032) | `ACAD2018` recommended for widest `ezdxf` support; drop to `ACAD2013` for proxy/legacy consumers. |
| `ezdxf` | ≥ 1.1.0 | `recover.readfile()` returns `(doc, auditor)`; `DXFStructureError` guards the fast path. |
| `xvfb` | any recent | Provides the virtual display the Qt-based converter needs on headless Linux. |
| OS | Linux (server), Windows, macOS | `xvfb-run` is Linux-only; on Windows/macOS the GUI display already exists and `xvfb-run` is omitted. |

The converter is a free download from the [Open Design Alliance](https://www.opendesign.com/guestfiles/oda_file_converter); its version support governs which DWG revisions you can ingest.

## Fallback Strategies

DWG batch conversion fails in five recurring ways. Handle them in order.

<!-- fig:oda-verify-output -->
<svg viewBox="-20 -20 321.4 216.2" role="img" aria-label="Verify the ODA converter by opening the output and counting entities, not by trusting its exit code" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>Why the exit code is not the verification</title>
  <desc>A branch taken after the converter returns. A zero exit code with a readable DXF carrying entities is a success. A zero exit code with a missing or empty output is a routine failure mode of a GUI application driven headlessly, and treating the exit code as the verification is what lets an empty batch reach downstream processing.</desc>
  <defs>
    <marker id="oda2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="oda2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="321.4" height="216.2" fill="var(--color-surface)"/>
  <polygon points="140.7,0 254.5,31 140.7,62 26.9,31" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-width="1.6"/>
  <text x="140.7" y="35" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">Exit code was zero — now what?</text>
  <rect x="0" y="128" width="126.7" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="63.3" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Accept</text>
  <text x="63.3" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">record the counts</text>
  <path d="M 140.7 62 L 140.7 92 L 63.3 92 L 63.3 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#oda2-a)" stroke-linejoin="round"/>
  <text x="63.3" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">output opens, entities &gt; 0</text>
  <rect x="154.7" y="128" width="126.7" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="218" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Fail the file</text>
  <text x="218" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">retry, then quarantine</text>
  <path d="M 140.7 62 L 140.7 92 L 218 92 L 218 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#oda2-a)" stroke-linejoin="round"/>
  <text x="218" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">missing or empty output</text>
</svg>
<!-- /fig:oda-verify-output -->

**1. Output version target.** Default to `ACAD2018` (AC1032) for the broadest `ezdxf` coverage. Choose `ACAD2013` (AC1027) when a downstream tool rejects AC1032, or when proxy entities from a vertical product round-trip more cleanly through the older schema. The version fragmentation behind these codes is documented in [Understanding DWG Version Compatibility](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/understanding-dwg-version-compatibility/).

**2. Audit repair.** Set `audit=True` so the converter runs its recover pass on each drawing, fixing broken handles and dangling references that would otherwise crash `ezdxf`. Auditing is slower, so for known-clean exports you can disable it — but keep it on for any drawings of unknown provenance.

**3. Proxy entities.** Custom objects from Civil 3D, Plant 3D, or third-party applications convert to `ACAD_PROXY_ENTITY` placeholders that carry a cached graphic but no editable geometry. `ezdxf` reads them without error, yet their true geometry is unavailable. Detect them with `msp.query("ACAD_PROXY_ENTITY")` and route them per [Handling DWG Proxy Entities During Conversion](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/handling-dwg-proxy-entities-during-conversion/) rather than assuming the DXF is complete.

**4. XREF resolution.** External references are not embedded by the converter; a drawing that relies on XREFs converts to a DXF whose referenced geometry is missing. Bind XREFs at the CAD authoring stage before conversion, or ensure the referenced DWGs sit in the same input folder so their content is available.

**5. Headless display errors.** Messages like `could not connect to display` or `QXcbConnection` mean the process ran without `xvfb-run`, or `xvfb` is not installed. Confirm `xvfb-run` is on `PATH` and prefix the command with `xvfb-run -a`; the script's `shutil.which` guard fails fast with a clear message when it is absent.

## FAQ

<details>
<summary><strong>Why does the ODA File Converter need xvfb on a server?</strong></summary>

The ODA File Converter is a Qt GUI application even in command-line mode, so it requires an X display to initialize. On a headless Linux server there is no display, and the process exits immediately or hangs. Running it under `xvfb-run -a` provides a virtual framebuffer so it starts without a physical screen, and `-a` auto-picks a free display so parallel workers do not collide.

</details>

<details>
<summary><strong>Should I target ACAD2018 or ACAD2013 as the output version?</strong></summary>

Target `ACAD2018` (AC1032) for the widest `ezdxf` support and modern entity coverage. Drop to `ACAD2013` (AC1027) only when a downstream tool cannot read AC1032, or when proxy entities from a vertical product survive more cleanly in the older schema. Both are stable `ezdxf` read targets.

</details>

<details>
<summary><strong>Does the converter report per-file failures in its exit code?</strong></summary>

Not reliably. The ODA File Converter often returns exit code `0` even when individual files fail to convert. The robust check is to verify that an output DXF exists and opens for every input DWG, treating a missing or unreadable output as a failure regardless of the process exit code — which is exactly what the manifest loop in the script does.

</details>

<details>
<summary><strong>How do I stop a hung conversion from blocking the batch?</strong></summary>

Wrap the subprocess call with a timeout and catch `subprocess.TimeoutExpired`. A single corrupt DWG can make the converter spin indefinitely, so a per-batch timeout — or converting one file at a time by pointing the input folder at a single drawing — keeps one bad file from stalling the whole run.

</details>

---

## Related Pages

- [DWG-to-Python Integration](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/) — parent workflow covering version detection, headless conversion, and the full DWG parsing landscape
- [Parsing DWG Layers with Python Scripts](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/parsing-dwg-layers-with-python-scripts/) — sibling guide that reads the LAYER table from the DXF this conversion produces
- [Python Parsing & Geometry Extraction](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/) — top-level pipeline covering ingestion, extraction, and serialization across CAD, BIM, and GIS
- [Understanding DWG Version Compatibility](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/understanding-dwg-version-compatibility/) — cross-topic reference for the AC10xx version codes that decide your output target
- [Handling DWG Proxy Entities During Conversion](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/handling-dwg-proxy-entities-during-conversion/) — cross-topic guide for the proxy placeholders that survive DWG to DXF conversion
