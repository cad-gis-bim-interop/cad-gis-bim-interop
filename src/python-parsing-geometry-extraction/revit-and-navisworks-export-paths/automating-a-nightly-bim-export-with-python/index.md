---
title: "Automating a Nightly BIM Export with Python"
description: "Run an unattended BIM export on a schedule: driving the authoring application headlessly, timeouts and stale-output detection, atomic publishing, and a manifest that tells the pipeline what it is consuming."
slug: "automating-a-nightly-bim-export-with-python"
breadcrumb:
  - label: "Python Parsing & Geometry Extraction"
    url: "/python-parsing-geometry-extraction/"
  - label: "Revit and Navisworks Export Paths"
    url: "/python-parsing-geometry-extraction/revit-and-navisworks-export-paths/"
  - label: "Automating a Nightly BIM Export with Python"
    url: "/python-parsing-geometry-extraction/revit-and-navisworks-export-paths/automating-a-nightly-bim-export-with-python/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Automating a Nightly BIM Export with Python",
      "description": "Run an unattended BIM export on a schedule: driving the authoring application headlessly, timeouts and stale-output detection, atomic publishing, and a manifest that tells the pipeline what it is consuming.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/revit-and-navisworks-export-paths/automating-a-nightly-bim-export-with-python/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Python Parsing & Geometry Extraction", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/"},
        {"@type": "ListItem", "position": 2, "name": "Revit and Navisworks Export Paths", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/revit-and-navisworks-export-paths/"},
        {"@type": "ListItem", "position": 3, "name": "Automating a Nightly BIM Export with Python", "item": "https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/revit-and-navisworks-export-paths/automating-a-nightly-bim-export-with-python/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Automate an unattended nightly BIM export",
      "description": "Drive the export under a timeout, detect stale output, publish atomically, and write a manifest recording what was produced and from what.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Drive the export under a timeout", "text": "Run the export as a subprocess with a wall-clock timeout, because a GUI application driven headlessly can hang indefinitely."},
        {"@type": "HowToStep", "position": 2, "name": "Detect stale output", "text": "Compare the output modification time against the start of the run, since an application can exit zero having written nothing."},
        {"@type": "HowToStep", "position": 3, "name": "Publish atomically", "text": "Write to a temporary path and rename into place so a consumer never reads a partially written file."},
        {"@type": "HowToStep", "position": 4, "name": "Write a manifest", "text": "Record the source model, its modification time, the configuration used and the export result so a consumer knows what it has."},
        {"@type": "HowToStep", "position": 5, "name": "Retain previous exports", "text": "Keep the last known-good export so a failed run degrades to yesterday rather than to nothing."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Why not trigger the export from the pipeline?",
          "acceptedAnswer": {"@type": "Answer", "text": "Because it couples the pipeline's latency to an application that takes minutes and its availability to a licence. A scheduled export publishes an artefact; the pipeline consumes whatever is current. That decoupling also means several consumers share one export instead of each triggering their own."}
        },
        {
          "@type": "Question",
          "name": "How do I detect a hung export?",
          "acceptedAnswer": {"@type": "Answer", "text": "A wall-clock timeout on the subprocess, set generously from observed durations rather than optimistically. A GUI application waiting on a modal dialog will wait forever, and without a timeout the scheduled job simply never finishes and the next night's run finds the lock still held."}
        },
        {
          "@type": "Question",
          "name": "What belongs in the manifest?",
          "acceptedAnswer": {"@type": "Answer", "text": "Whatever a consumer would otherwise have to guess: the source model path and its modification time, the export configuration identifier, the schema produced, the element counts, and the timestamp. That turns \"the data looks wrong\" into a comparison between two manifests."}
        }
      ]
    }
  ]
}
</script>

# Automating a Nightly BIM Export with Python

An unattended export has three failure modes that a manual one does not: it can hang, it can exit successfully having written nothing, and it can be read half-written by a consumer. The scheduler below handles all three — a wall-clock timeout, a stale-output check, and an atomic publish — and writes a manifest so the pipeline knows what it is consuming. This page belongs to [Revit and Navisworks Export Paths](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/revit-and-navisworks-export-paths/).

## What Goes Wrong Unattended

A desktop application driven headlessly behaves differently from one driven by a person, and the differences are all about waiting. A modal dialog that a person would dismiss blocks forever. A licence check that fails returns a non-zero exit that looks like any other error. A partially written file exists on disk and is perfectly readable, just incomplete.

<!-- fig:nightly-three-faults -->
<svg viewBox="-20 -20 419 184.1" role="img" aria-label="Hang, stale output and partial read — the three unattended export failures and the checks that catch them" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>Three unattended failures and what actually detects them</title>
  <desc>Three ways an automated export fails that a manual one does not, with the evidence that identifies each. None is detected by the exit code: a hang produces no exit at all, a stale output produces a successful one, and a partial file is readable. The checks that work are a timeout, a modification-time comparison and an atomic publish.</desc>
  <defs>
    <marker id="nb1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="nb1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="419" height="184.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="379" height="122" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="379" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">Failure</text>
  <text x="177.4" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Exit code says</text>
  <line x1="238.5" y1="0" x2="238.5" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="308.7" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">What detects it</text>
  <line x1="116.3" y1="0" x2="116.3" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="379" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">Hangs on a dialog</text>
  <text x="177.4" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">nothing — never exits</text>
  <text x="308.7" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">wall-clock timeout</text>
  <line x1="0" y1="62" x2="379" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">Writes nothing</text>
  <text x="177.4" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">success</text>
  <text x="308.7" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">output mtime vs run start</text>
  <line x1="0" y1="92" x2="379" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">Read while writing</text>
  <text x="177.4" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">success</text>
  <text x="308.7" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">stage then rename</text>
  <text x="0" y="142" font-size="9.5" fill="currentColor" fill-opacity="0.7">The exit code is evidence of none of the three.</text>
</svg>
<!-- /fig:nightly-three-faults -->

The consequence is that neither the exit code nor the existence of an output file is sufficient evidence of success. What is sufficient is: the process finished within a bounded time, the output file is newer than the start of the run, and the file passes the acceptance checks for its format. The first two are the scheduler's job and the third belongs to the format — for IFC it is described in the sibling guide on [exporting Revit models to IFC](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/revit-and-navisworks-export-paths/exporting-revit-models-to-ifc-for-python-pipelines/).

Publishing is the fourth concern. A consumer polling a directory will happily read a file that is still being written. Writing to a temporary name and renaming into place makes the appearance atomic on any POSIX filesystem, so a consumer sees either the previous export or the new one, never a partial one.

## Production-Ready Script

{% raw %}
```python
# Python 3.9+ — standard library only, so it runs on the export host unchanged
from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import time
from dataclasses import dataclass, asdict
from pathlib import Path


class ExportFailed(RuntimeError):
    pass


@dataclass(frozen=True)
class Manifest:
    source: str
    source_mtime: float
    config: str
    output: str
    output_bytes: int
    started_at: float
    duration_s: float


def run_export(
    command: list[str],
    *,
    workdir: Path,
    timeout_s: int,
) -> None:
    """Drive the authoring application, bounded in time."""
    try:
        proc = subprocess.run(command, cwd=workdir, timeout=timeout_s,
                              capture_output=True, text=True)
    except subprocess.TimeoutExpired as exc:
        raise ExportFailed(
            f"export exceeded {timeout_s}s — likely waiting on a dialog"
        ) from exc
    if proc.returncode != 0:
        tail = (proc.stderr or proc.stdout or "").strip().splitlines()[-5:]
        raise ExportFailed(f"exporter exited {proc.returncode}: {' | '.join(tail)}")


def publish_atomically(staged: Path, destination: Path) -> None:
    """Rename into place so a consumer never sees a partial file."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    tmp = destination.with_suffix(destination.suffix + ".incoming")
    shutil.copy2(staged, tmp)
    os.replace(tmp, destination)          # atomic within one filesystem


def nightly_export(
    source_model: Path,
    config: Path,
    destination: Path,
    command_template: list[str],
    *,
    timeout_s: int = 5400,
) -> Manifest:
    started = time.time()
    with tempfile.TemporaryDirectory() as tmpdir:
        staged = Path(tmpdir) / destination.name
        command = [c.format(model=source_model, out=staged, config=config)
                   for c in command_template]
        run_export(command, workdir=Path(tmpdir), timeout_s=timeout_s)

        if not staged.exists():
            raise ExportFailed("exporter reported success but wrote no file")
        if staged.stat().st_mtime < started:
            raise ExportFailed("output predates the run — a stale file was left in place")
        if staged.stat().st_size == 0:
            raise ExportFailed("output is empty")

        publish_atomically(staged, destination)
        manifest = Manifest(
            source=str(source_model),
            source_mtime=source_model.stat().st_mtime,
            config=str(config),
            output=str(destination),
            output_bytes=destination.stat().st_size,
            started_at=started,
            duration_s=time.time() - started,
        )
    destination.with_suffix(".manifest.json").write_text(
        json.dumps(asdict(manifest), indent=2))
    return manifest


if __name__ == "__main__":
    print(nightly_export(
        Path("//models/project.rvt"),
        Path("./export-config.json"),
        Path("//published/project.ifc"),
        command_template=["ExportRunner.exe", "{model}", "{out}", "{config}"],
    ))
```
{% endraw %}

<!-- fig:nightly-atomic -->
<svg viewBox="-20 -20 546 286" role="img" aria-label="Export to staging, verify there, then rename into place so a consumer never sees a partial file" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:546px;display:block;margin:1.5rem auto;">
  <title>Staging and the atomic publish</title>
  <desc>A sequence across the scheduler, a staging directory and the published location. The export writes into staging, the checks run there, and only a passing artefact is renamed into place. A consumer polling the published location therefore sees either the previous export or the new one, and a failed run leaves yesterday untouched.</desc>
  <defs>
    <marker id="nb2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="nb2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="546" height="286" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="154" height="34" rx="6" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-width="1.4"/>
  <text x="77" y="21" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">scheduler</text>
  <line x1="77" y1="34" x2="77" y2="246" stroke="currentColor" stroke-width="1" stroke-opacity="0.28" stroke-dasharray="4 4"/>
  <rect x="176" y="0" width="154" height="34" rx="6" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-width="1.4"/>
  <text x="253" y="21" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">staging</text>
  <line x1="253" y1="34" x2="253" y2="246" stroke="currentColor" stroke-width="1" stroke-opacity="0.28" stroke-dasharray="4 4"/>
  <rect x="352" y="0" width="154" height="34" rx="6" fill="currentColor" fill-opacity="0.08" stroke="currentColor" stroke-width="1.4"/>
  <text x="429" y="21" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">published</text>
  <line x1="429" y1="34" x2="429" y2="246" stroke="currentColor" stroke-width="1" stroke-opacity="0.28" stroke-dasharray="4 4"/>
  <line x1="77" y1="60" x2="253" y2="60" stroke="currentColor" stroke-width="1.3" marker-end="url(#nb2-a)"/>
  <text x="165" y="53" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.8">export under a timeout</text>
  <line x1="253" y1="100" x2="77" y2="100" stroke="currentColor" stroke-width="1.3" stroke-dasharray="5 4" marker-end="url(#nb2-o)"/>
  <text x="165" y="93" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.8">file + mtime</text>
  <path d="M 77 132 L 103 132 L 103 146 L 80 146" fill="none" stroke="currentColor" stroke-width="1.3" marker-end="url(#nb2-a)"/>
  <text x="111" y="142" font-size="9.5" fill="currentColor" fill-opacity="0.8">verify: newer, non-empty</text>
  <line x1="77" y1="180" x2="429" y2="180" stroke="currentColor" stroke-width="1.3" marker-end="url(#nb2-a)"/>
  <text x="253" y="173" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.8">rename into place</text>
  <line x1="429" y1="220" x2="77" y2="220" stroke="currentColor" stroke-width="1.3" stroke-dasharray="5 4" marker-end="url(#nb2-o)"/>
  <text x="253" y="213" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.8">atomic — no partial read</text>
</svg>
<!-- /fig:nightly-atomic -->

**Key implementation notes:**

- The export writes into a temporary directory and is copied into place only after the checks pass, so a failed run leaves the previous published export untouched.
- `os.replace` is atomic within a filesystem; the staging directory must therefore be on the same volume as the destination for the guarantee to hold. Where it is not, stage inside the destination directory instead.
- The stale-output check compares against the run start time rather than against a stored previous time, so it works on the first run.
- Standard library only, deliberately. The export host is a licensed desktop machine, and every dependency added there is one that has to be maintained on a machine nobody wants to touch.
- The manifest is written after the publish, so its presence means the export completed.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| Python | 3.9+ | `subprocess.run` with timeout |
| Host | the licensed authoring machine | exports cannot run elsewhere |
| Filesystem | staging and destination on one volume | required for atomic rename |
| Scheduler | any | cron, Task Scheduler, CI runner |
| Consumers | any | read the manifest, not the directory listing |

## Fallback Strategies

**1. Timeout on a model that legitimately grew.** Raise the timeout from observed durations, and record the duration in the manifest so the trend is visible before it becomes a failure.

<!-- fig:nightly-manifest -->
<svg viewBox="-20 -20 512.7 175.1" role="img" aria-label="Source path, source mtime, configuration, row count, duration and timestamp — the export manifest fields" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:513px;display:block;margin:1.5rem auto;">
  <title>The manifest a consumer reads instead of a directory listing</title>
  <desc>The facts a consumer would otherwise have to guess. The source model and its modification time say what was exported, the configuration identifies which export produced it, the duration reveals a trend before it becomes a timeout, and the timestamp lets a consumer warn when the artefact is older than expected.</desc>
  <defs>
    <marker id="nb3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="nb3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="512.7" height="175.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="283.3" height="111" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.5"/>
  <text x="14" y="16" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">source        //models/project.rvt</text>
  <line x1="289.3" y1="12.9" x2="321.3" y2="12.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="329.3" y="16" font-size="9.5" fill="currentColor" fill-opacity="0.78">what was exported</text>
  <text x="14" y="35" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">source_mtime  2026-08-06T21:14:02Z</text>
  <line x1="289.3" y1="31.9" x2="321.3" y2="31.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="329.3" y="35" font-size="9.5" fill="currentColor" fill-opacity="0.78">the model state at export time</text>
  <text x="14" y="54" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">config        export-config.json@a41f</text>
  <line x1="289.3" y1="50.9" x2="321.3" y2="50.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="329.3" y="54" font-size="9.5" fill="currentColor" fill-opacity="0.78">which configuration produced it</text>
  <text x="14" y="73" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">duration_s    1284</text>
  <line x1="289.3" y1="69.9" x2="321.3" y2="69.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="329.3" y="73" font-size="9.5" fill="currentColor" fill-opacity="0.78">a rising trend precedes a timeout</text>
  <text x="14" y="92" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">written_at    2026-08-07T02:31:44Z</text>
  <line x1="289.3" y1="88.9" x2="321.3" y2="88.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="329.3" y="92" font-size="9.5" fill="currentColor" fill-opacity="0.78">stale-but-valid is visible</text>
  <text x="0" y="133" font-size="9.5" fill="currentColor" fill-opacity="0.7">Written after the publish, so its presence means the export completed.</text>
</svg>
<!-- /fig:nightly-manifest -->

**2. Licence unavailable.** The exporter exits non-zero. Retry once after a delay — contention is common at fixed schedule times — and stagger the schedules of several exports rather than running them together.

**3. Rename across filesystems.** `os.replace` raises. Stage inside the destination directory so the rename is within one volume.

**4. Consumers reading during publish.** Should be impossible with the rename, but a consumer that opens by glob may still pick up the `.incoming` file. Publish under a suffix consumers do not match, as above.

**5. A failed run leaves nothing fresh.** By design: the previous export stays published. Make the consumer read the manifest timestamp and warn when the artefact is older than expected, so stale-but-valid is visible rather than invisible.

## FAQ

<details>
<summary><strong>Why not trigger the export from the pipeline?</strong></summary>

Because it couples the pipeline's latency to an application that takes minutes and its availability to a licence. A scheduled export publishes an artefact; the pipeline consumes whatever is current. That decoupling also means several consumers share one export instead of each triggering their own.

</details>

<details>
<summary><strong>How do I detect a hung export?</strong></summary>

A wall-clock timeout on the subprocess, set generously from observed durations rather than optimistically. A GUI application waiting on a modal dialog will wait forever, and without a timeout the scheduled job simply never finishes and the next night's run finds the lock still held.

</details>

<details>
<summary><strong>What belongs in the manifest?</strong></summary>

Whatever a consumer would otherwise have to guess: the source model path and its modification time, the export configuration identifier, the schema produced, the element counts, and the timestamp. That turns "the data looks wrong" into a comparison between two manifests.

</details>

---

## Related Pages

- [Revit and Navisworks Export Paths](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/revit-and-navisworks-export-paths/) — parent reference on which route to automate
- [Exporting Revit Models to IFC for Python Pipelines](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/revit-and-navisworks-export-paths/exporting-revit-models-to-ifc-for-python-pipelines/) — the acceptance checks this scheduler runs
- [Batch Converting DWG to DXF with the ODA File Converter](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/batch-converting-dwg-to-dxf-with-oda-file-converter/) — the same supervision pattern for a different converter
