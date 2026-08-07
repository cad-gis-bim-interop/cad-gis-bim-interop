---
title: "Benchmarking DXF Parsing Throughput in Python"
description: "Measure ezdxf parsing throughput fairly — entities per second, MB/sec and peak memory — with warm runs, median timing and a reusable CI regression harness."
slug: "benchmarking-dxf-parsing-throughput-in-python"
breadcrumb:
  - label: "Interoperability Decision Guides"
    url: "/interoperability-decision-guides/"
  - label: "Choosing ezdxf, pydwg, or ODA for Production"
    url: "/interoperability-decision-guides/choosing-ezdxf-pydwg-or-oda-for-production/"
  - label: "Benchmarking DXF Parsing Throughput in Python"
    url: "/interoperability-decision-guides/choosing-ezdxf-pydwg-or-oda-for-production/benchmarking-dxf-parsing-throughput-in-python/"
datePublished: "2026-07-11"
dateModified: "2026-07-11"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Benchmarking DXF Parsing Throughput in Python",
      "description": "Measure ezdxf parsing throughput fairly — entities per second, MB/sec and peak memory — with warm runs, median timing and a reusable CI regression harness.",
      "datePublished": "2026-07-11",
      "dateModified": "2026-07-11",
      "author": {"@type": "Organization", "name": "CAD GIS BIM Interop"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-ezdxf-pydwg-or-oda-for-production/benchmarking-dxf-parsing-throughput-in-python/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Interoperability Decision Guides", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/"},
        {"@type": "ListItem", "position": 2, "name": "Choosing ezdxf, pydwg, or ODA for Production", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-ezdxf-pydwg-or-oda-for-production/"},
        {"@type": "ListItem", "position": 3, "name": "Benchmarking DXF Parsing Throughput in Python", "item": "https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-ezdxf-pydwg-or-oda-for-production/benchmarking-dxf-parsing-throughput-in-python/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Benchmark DXF Parsing Throughput in Python",
      "description": "Measure ezdxf parsing throughput fairly using warm runs, perf_counter, and memory instrumentation.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Warm the cache", "text": "Run one or more untimed parses first so the OS page cache is warm and you measure parsing, not first-touch disk I/O."},
        {"@type": "HowToStep", "position": 2, "name": "Time with perf_counter", "text": "Wrap the readfile-and-iterate region in time.perf_counter and take the median over several runs to resist outliers."},
        {"@type": "HowToStep", "position": 3, "name": "Measure memory", "text": "Use tracemalloc for peak Python allocations and resource.getrusage for peak process RSS."},
        {"@type": "HowToStep", "position": 4, "name": "Set a regression threshold", "text": "Store a baseline entities-per-second figure and fail CI when a run drops below a tolerance band."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Should I include file I/O in a DXF parsing benchmark?",
          "acceptedAnswer": {"@type": "Answer", "text": "It depends what you are optimising. To measure the parser, warm the OS page cache first so I/O is near-zero and the timed region reflects parsing and iteration. To model real cold-start production behaviour, measure a cold run separately and report both; do not blend them into one number."}
        },
        {
          "@type": "Question",
          "name": "Why does peak RSS not go back down between files?",
          "acceptedAnswer": {"@type": "Answer", "text": "resource.getrusage reports ru_maxrss, a high-water mark that never decreases for the life of the process. For per-file peak allocation use tracemalloc, which measures Python-tracked memory for a specific region and can be reset. Use RSS for the process ceiling and tracemalloc for per-file cost."}
        },
        {
          "@type": "Question",
          "name": "Does iterating with a generator change the measured throughput?",
          "acceptedAnswer": {"@type": "Answer", "text": "Generator iteration versus building a list changes memory more than raw throughput, but if your benchmark stops at readfile() without iterating, you under-measure because ezdxf does work lazily. Force a full pass over modelspace so the number reflects the work your pipeline actually does."}
        }
      ]
    }
  ]
}
</script>

# Benchmarking DXF Parsing Throughput in Python

To benchmark DXF parsing throughput fairly, warm the OS page cache with an untimed run, time the `ezdxf.readfile()` and full model-space iteration together with `time.perf_counter`, take the median across several runs, and measure memory separately with `tracemalloc` (per-file peak) and `resource.getrusage` (process ceiling). Report entities per second, megabytes per second, and peak resident memory — not a single wall-clock number, which conflates disk I/O, parsing, and garbage collection. This measurement is what turns the throughput claims in the [Choosing ezdxf, pydwg, or ODA for Production](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-ezdxf-pydwg-or-oda-for-production/) guide into evidence you can size a pipeline and gate a CI build on.

## How `ezdxf` Parsing Timing Breaks Down

A naive benchmark wraps `ezdxf.readfile()` in a timer and reports the result. That number is almost always wrong, because it silently includes first-touch disk I/O on a cold cache, and because `ezdxf` does some work lazily — if you never iterate the entities, you have not measured the parse your pipeline actually performs. A fair benchmark isolates the parse-and-iterate work from the I/O that happens to precede it, and reports both rather than blending them.

The diagram below contrasts a cold run, where disk I/O dominates the timed region, with a warm run, where the same file is served from the page cache and the timed region reflects parsing. The warm-run parse segment is the number you compare across code changes.

<!-- fig:bench-what-a-timer-catches -->
<svg viewBox="-20 -20 560 254" role="img" aria-label="Import, cold file read, parse and object allocation all fall inside a naive timer, but only the last two are parsing throughput" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:560px;display:block;margin:1.5rem auto;">
  <title>What a naive timer around readfile actually measures</title>
  <desc>Four costs that fall inside a timer wrapped around the first readfile call. Interpreter import of the library, the operating system reading the file from cold storage, the parse itself, and the allocation of the entity objects. Only the last two belong to parsing throughput; the first two are one-off and dominate a single cold measurement.</desc>
  <defs>
    <marker id="bch1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="bch1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="560" height="254" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="520" height="46" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="16" y="21" font-size="11.5" font-weight="600" fill="currentColor">Library import</text>
  <text x="16" y="35" font-size="9.5" fill="currentColor" fill-opacity="0.72">once per process, not per file</text>
  <text x="504" y="26.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">exclude</text>
  <rect x="0" y="56" width="520" height="46" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="16" y="77" font-size="11.5" font-weight="600" fill="currentColor">Cold page-cache read</text>
  <text x="16" y="91" font-size="9.5" fill="currentColor" fill-opacity="0.72">disk, not CPU — varies with the machine</text>
  <text x="504" y="82.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">exclude</text>
  <rect x="0" y="112" width="520" height="46" rx="6" fill="currentColor" fill-opacity="0.14" stroke="currentColor" stroke-width="2"/>
  <text x="16" y="133" font-size="11.5" font-weight="600" fill="currentColor">Tag parse</text>
  <text x="16" y="147" font-size="9.5" fill="currentColor" fill-opacity="0.72">the work being measured</text>
  <text x="504" y="138.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">measure</text>
  <rect x="0" y="168" width="520" height="46" rx="6" fill="currentColor" fill-opacity="0.14" stroke="currentColor" stroke-width="2"/>
  <text x="16" y="189" font-size="11.5" font-weight="600" fill="currentColor">Entity allocation</text>
  <text x="16" y="203" font-size="9.5" fill="currentColor" fill-opacity="0.72">the work being measured</text>
  <text x="504" y="194.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">measure</text>
</svg>
<!-- /fig:bench-what-a-timer-catches -->

<svg viewBox="0 0 640 236" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Timing breakdown for a cold versus warm DXF parse: on a cold run disk I/O is a large share of the timed region, on a warm run I/O shrinks to a cache hit and parsing dominates" style="width:100%;max-width:640px;display:block;margin:1.5rem auto;">
  <title>Cold vs Warm DXF Parse Timing</title>
  <desc>Two horizontal timelines between t0 and t1. The cold run splits into a wide disk-read segment and a parse-and-iterate segment. The warm run has a small cache-hit segment and a much larger parse-and-iterate segment, which is the region to isolate and compare.</desc>
  <rect x="0" y="0" width="640" height="236" fill="var(--color-surface)"/>
  <text x="20" y="34" font-size="11" fill="currentColor" opacity="0.6" font-weight="600">perf_counter timed region</text>
  <!-- cold run -->
  <text x="18" y="88" font-size="11" fill="currentColor">cold run</text>
  <rect x="130" y="66" width="228" height="34" rx="4" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
  <text x="244" y="87" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.8">disk read (I/O)</text>
  <rect x="358" y="66" width="252" height="34" rx="4" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.7"/>
  <text x="484" y="87" text-anchor="middle" font-size="10" fill="currentColor">parse + iterate</text>
  <!-- warm run -->
  <text x="18" y="158" font-size="11" fill="currentColor">warm run</text>
  <rect x="130" y="136" width="70" height="34" rx="4" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
  <text x="165" y="157" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.75">cache</text>
  <rect x="200" y="136" width="410" height="34" rx="4" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.75"/>
  <text x="405" y="157" text-anchor="middle" font-size="10" fill="currentColor">parse + iterate — compare this</text>
  <!-- markers -->
  <line x1="130" y1="56" x2="130" y2="196" stroke="currentColor" stroke-width="1" stroke-dasharray="4 3" opacity="0.5"/>
  <text x="130" y="212" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">t0</text>
  <line x1="610" y1="56" x2="610" y2="196" stroke="currentColor" stroke-width="1" stroke-dasharray="4 3" opacity="0.5"/>
  <text x="610" y="212" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">t1</text>
</svg>

Three metrics describe throughput completely. **Entities per second** normalises for drawing complexity and is the most stable figure across files of different sizes. **Megabytes per second** normalises for raw file size and exposes I/O-bound behaviour. **Peak resident memory** is the ceiling that decides how many parallel workers a machine can host. Reporting all three prevents the common mistake of optimising wall-clock time on one file and regressing memory on another. For the entity model these numbers describe, the [ezdxf Deep Dive](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/) is the reference.

## Production-Ready Script

The harness below measures one file with a warm cache, median-of-runs timing, GC disabled inside the timed region, and both memory instruments. It scales to a directory so you can chart throughput against file size.

```python
# ezdxf>=1.1.0 | python>=3.9
import gc
import resource
import statistics
import time
import tracemalloc
from dataclasses import dataclass, asdict
from pathlib import Path

import ezdxf


@dataclass
class BenchResult:
    path: str
    file_mb: float
    entities: int
    parse_s: float
    entities_per_s: float
    mb_per_s: float
    alloc_peak_mb: float
    proc_rss_mb: float


def _proc_rss_mb() -> float:
    # ru_maxrss is KiB on Linux and bytes on macOS. This assumes Linux.
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024.0


def benchmark_file(path: Path, warmup: int = 1, runs: int = 5) -> BenchResult:
    """Measure warm-cache parse throughput and memory for one DXF file."""
    file_mb = path.stat().st_size / (1024 * 1024)

    # 1. Warm the OS page cache: measure parsing, not first-touch disk I/O.
    for _ in range(warmup):
        ezdxf.readfile(str(path))

    # 2. Timed runs. Disable GC inside the region so collection pauses
    #    do not contaminate the parse timing; re-enable immediately after.
    durations, entity_count = [], 0
    for _ in range(runs):
        gc.collect()
        gc.disable()
        start = time.perf_counter()
        doc = ezdxf.readfile(str(path))
        entity_count = sum(1 for _ in doc.modelspace())  # force the full parse
        elapsed = time.perf_counter() - start
        gc.enable()
        durations.append(elapsed)
        del doc

    parse_s = statistics.median(durations)  # median resists warm-up outliers

    # 3. Peak Python allocation for a single parse, measured in isolation.
    gc.collect()
    tracemalloc.start()
    doc = ezdxf.readfile(str(path))
    _ = sum(1 for _ in doc.modelspace())
    _, alloc_peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    del doc

    return BenchResult(
        path=str(path),
        file_mb=round(file_mb, 3),
        entities=entity_count,
        parse_s=round(parse_s, 4),
        entities_per_s=round(entity_count / parse_s, 1) if parse_s else 0.0,
        mb_per_s=round(file_mb / parse_s, 2) if parse_s else 0.0,
        alloc_peak_mb=round(alloc_peak / (1024 * 1024), 1),
        proc_rss_mb=round(_proc_rss_mb(), 1),
    )


def benchmark_dir(directory: Path) -> list[BenchResult]:
    """Benchmark every DXF in a directory, smallest first for a clean curve."""
    files = sorted(directory.glob("*.dxf"), key=lambda p: p.stat().st_size)
    results = [benchmark_file(p) for p in files]
    for r in results:
        print(
            f"{Path(r.path).name:32} {r.file_mb:7.2f} MB  "
            f"{r.entities_per_s:12,.0f} ent/s  "
            f"{r.mb_per_s:7.2f} MB/s  peak {r.alloc_peak_mb:6.1f} MB"
        )
    return results


if __name__ == "__main__":
    import json, sys
    out = [asdict(r) for r in benchmark_dir(Path(sys.argv[1]))]
    Path("dxf_bench.json").write_text(json.dumps(out, indent=2))
```

**Key implementation notes:**

- **Warm the cache first.** Without the untimed warmup, the first timed run pays first-touch disk I/O and skews the median. The warmup call is discarded deliberately.
- **Force iteration.** `sum(1 for _ in doc.modelspace())` makes `ezdxf` do the full parse work; timing `readfile()` alone under-measures because some work is deferred.
- **Disable GC in the timed region only.** A collection cycle firing mid-parse adds a pause unrelated to parsing. Disable it around the measurement and re-enable straight after so the process is never left with GC off.
- **Median, not mean.** The median across runs resists the residual warm-up outlier and transient scheduler noise better than the mean.
- **Two memory instruments.** `tracemalloc` gives per-file peak Python allocation you can reset; `ru_maxrss` gives the process high-water mark that sizes worker counts. They answer different questions.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| Python | `3.9+` | `dataclasses`, `pathlib`, and `statistics.median` are stdlib; `tracemalloc` and `resource` are stdlib. |
| ezdxf | `>=1.1.0` | Iterator protocol on `modelspace()` is stable; earlier versions differ in lazy-load behaviour. |
| `resource.getrusage` | Linux, macOS, BSD | `ru_maxrss` is **KiB on Linux**, **bytes on macOS** — adjust the divisor per platform. Not available on Windows. |
| `tracemalloc` | All platforms | Measures Python-tracked allocations only; C-extension memory outside Python is not counted. |
| File source | `.dxf` (ASCII or binary) | For DWG, convert to DXF first — see [Choosing ezdxf, pydwg, or ODA for Production](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-ezdxf-pydwg-or-oda-for-production/). |
| OS page cache | Any | Warm-run figures assume a cache large enough to hold the file; very large files may not stay resident. |

## Fallback Strategies & Pitfalls

**1. OS cache warmth is the biggest confound.** A benchmark run right after boot, or after processing files larger than RAM, hits cold cache and reports throughput several times lower than steady state. Always warm the cache, and when you need cold-start numbers, measure them in a clearly separate pass — never average a cold run into a warm series.

<!-- fig:bench-harness-controls -->
<svg viewBox="-20 -20 516.6 244.1" role="img" aria-label="Warm-up run, median of runs, disabled GC, a fixed fixture and separate memory instruments — the controls a parsing benchmark needs" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:517px;display:block;margin:1.5rem auto;">
  <title>The five controls that make a parsing benchmark reproducible</title>
  <desc>Each control, the confound it removes, and what the number means without it. None of them make parsing faster; they make the measurement mean the same thing on a second machine, which is the only property that makes a benchmark usable in a library decision.</desc>
  <defs>
    <marker id="bch2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="bch2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="516.6" height="244.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="476.6" height="182" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="476.6" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">Control</text>
  <text x="226.6" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Confound removed</text>
  <line x1="293.2" y1="0" x2="293.2" y2="182" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="384.9" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Without it</text>
  <line x1="159.9" y1="0" x2="159.9" y2="182" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="476.6" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">Untimed warm-up run</text>
  <text x="226.6" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">cold page cache, import</text>
  <text x="384.9" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">measures the disk, not the parser</text>
  <line x1="0" y1="62" x2="476.6" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">Median of N runs</text>
  <text x="226.6" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">scheduler noise</text>
  <text x="384.9" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">one outlier sets the result</text>
  <line x1="0" y1="92" x2="476.6" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">GC disabled in the region</text>
  <text x="226.6" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">collection pauses</text>
  <text x="384.9" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">variance swamps the signal</text>
  <line x1="0" y1="122" x2="476.6" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="140.5" font-size="10.5" font-weight="600" fill="currentColor">Fixed fixture file</text>
  <text x="226.6" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">entity-mix differences</text>
  <text x="384.9" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">compares files, not libraries</text>
  <line x1="0" y1="152" x2="476.6" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="170.5" font-size="10.5" font-weight="600" fill="currentColor">Peak and resident memory</text>
  <text x="226.6" y="170.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.5">—</text>
  <text x="384.9" y="170.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">a fast parser that swaps looks fast</text>
  <text x="0" y="202" font-size="9.5" fill="currentColor" fill-opacity="0.7">A benchmark that is not reproducible on a second machine cannot settle a library choice.</text>
</svg>
<!-- /fig:bench-harness-controls -->

**2. Garbage collection injects phantom pauses.** Python's cyclic collector can fire during a parse and add milliseconds unrelated to `ezdxf`. The harness disables GC inside the timed region; if you remove that, expect noisier medians. Never leave GC disabled outside the measurement in a long-running process — it leaks reference cycles.

**3. I/O and parse time are different measurements.** Reporting one blended number hides which stage regressed. If a change slows the pipeline, the warm parse figure tells you whether the parser or the I/O path is responsible. Keep them separate in the output.

**4. `ru_maxrss` units and monotonicity trip people up.** It is KiB on Linux but bytes on macOS, and it only ever rises. Use it for the process ceiling, not for per-file cost; for per-file peak, reset and read `tracemalloc`.

**5. Single-file benchmarks mislead on mixed workloads.** One large drawing does not predict throughput on a directory of thousands of small ones, where per-file `readfile()` overhead dominates. Benchmark against a corpus that mirrors production file-size distribution, smallest to largest, and read the curve rather than a single point.

**6. Setting the CI regression threshold.** Store the baseline `entities_per_s` for each reference file and fail the build when a run drops below a tolerance band — 15% is a practical starting point that absorbs runner variance without missing real regressions. Run the gate on a dedicated runner, warm the cache, and take the median of at least five runs so noise does not flap the build.

## FAQ

<details>
<summary><strong>Should I include file I/O in a DXF parsing benchmark?</strong></summary>

It depends what you are optimising. To measure the parser, warm the OS page cache first so I/O is near-zero and the timed region reflects parsing and iteration. To model real cold-start production behaviour, measure a cold run separately and report both. Do not blend them into a single number, because a change in disk speed would then masquerade as a parser regression.

</details>

<details>
<summary><strong>Why does peak RSS not go back down between files?</strong></summary>

`resource.getrusage` reports `ru_maxrss`, a high-water mark that never decreases for the life of the process. For per-file peak allocation use `tracemalloc`, which measures Python-tracked memory for a specific region and can be reset between files. Use RSS for the process ceiling that sizes worker counts, and `tracemalloc` for the per-file cost.

</details>

<details>
<summary><strong>Does iterating with a generator change the measured throughput?</strong></summary>

Generator iteration versus building a list changes memory more than raw throughput, but if your benchmark stops at `readfile()` without iterating, you under-measure because `ezdxf` defers some work. Force a full pass over `modelspace()` so the number reflects the work your pipeline actually does, and keep the iteration style identical to production.

</details>

---

## Related Pages

- [Choosing ezdxf, pydwg, or ODA for Production](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/choosing-ezdxf-pydwg-or-oda-for-production/) — the reader decision these throughput numbers inform, with the ODA conversion route for DWG inputs
- [Interoperability Decision Guides](https://www.cad-gis-bim-interop.org/interoperability-decision-guides/) — the wider framework for choosing libraries, formats, and storage targets across CAD, GIS, and BIM
- [ezdxf Deep Dive](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/) — the entity traversal and memory-aware iteration patterns the harness exercises
