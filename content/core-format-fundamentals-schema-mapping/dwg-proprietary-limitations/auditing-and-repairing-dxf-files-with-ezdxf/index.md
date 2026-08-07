---
title: "Auditing and Repairing DXF Files with ezdxf"
description: "Run an audit on a converted DXF before parsing it: what the auditor fixes and what it only reports, distinguishing structural damage from content problems, and gating a batch on the result."
slug: "auditing-and-repairing-dxf-files-with-ezdxf"
breadcrumb:
  - label: "Core Format Fundamentals & Schema Mapping"
    url: "/core-format-fundamentals-schema-mapping/"
  - label: "DWG Proprietary Limitations"
    url: "/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/"
  - label: "Auditing and Repairing DXF Files with ezdxf"
    url: "/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/auditing-and-repairing-dxf-files-with-ezdxf/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Auditing and Repairing DXF Files with ezdxf",
      "description": "Run an audit on a converted DXF before parsing it: what the auditor fixes and what it only reports, distinguishing structural damage from content problems, and gating a batch on the result.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/auditing-and-repairing-dxf-files-with-ezdxf/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Core Format Fundamentals & Schema Mapping", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/"},
        {"@type": "ListItem", "position": 2, "name": "DWG Proprietary Limitations", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/"},
        {"@type": "ListItem", "position": 3, "name": "Auditing and Repairing DXF Files with ezdxf", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/auditing-and-repairing-dxf-files-with-ezdxf/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Audit and repair a converted DXF before parsing it",
      "description": "Read the file in recovery mode, run the auditor, separate fixed errors from unrecoverable ones, and gate the batch on what remains.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Read in recovery mode", "text": "Open the file with the recovery reader so a structurally damaged document is loaded as far as it can be rather than raising immediately."},
        {"@type": "HowToStep", "position": 2, "name": "Run the auditor", "text": "Audit the loaded document to collect both the errors that were repaired and those that were not."},
        {"@type": "HowToStep", "position": 3, "name": "Separate fixed from unrecoverable", "text": "Classify the audit output, because a repaired error is information and an unrecoverable one is a gate."},
        {"@type": "HowToStep", "position": 4, "name": "Gate the batch", "text": "Reject files with unrecoverable errors into a quarantine rather than letting partial geometry into the pipeline."},
        {"@type": "HowToStep", "position": 5, "name": "Record what was repaired", "text": "Log the repairs applied so a later discrepancy can be attributed to the audit rather than investigated from scratch."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What does the auditor actually fix?",
          "acceptedAnswer": {"@type": "Answer", "text": "Structural problems: invalid handles, entities pointing at tables that do not exist, malformed table entries, entities on layers that were never defined. It repairs the document graph so the file can be traversed. It does not fix content — a wrong coordinate, a missing units header or geometry that was lost during conversion are all perfectly valid structurally."}
        },
        {
          "@type": "Question",
          "name": "Should I audit every file or only failing ones?",
          "acceptedAnswer": {"@type": "Answer", "text": "Every file that came through a conversion. The audit is cheap relative to parsing, and its value is that it tells you a file needed repair — which is a signal about the conversion, not just about the file. A batch where the repair rate suddenly rises is a converter problem worth catching early."}
        },
        {
          "@type": "Question",
          "name": "Is a repaired file safe to use?",
          "acceptedAnswer": {"@type": "Answer", "text": "Structurally, yes: it can be traversed without raising. Whether its content is complete is a separate question the audit cannot answer. Pair the audit with the round-trip checks — entity counts, extents, layer table — described on the parent page, because those measure content and the audit measures structure."}
        }
      ]
    }
  ]
}
</script>

# Auditing and Repairing DXF Files with ezdxf

A DXF produced by a converter is not guaranteed to be structurally sound, and the failures it carries are the kind that raise deep inside a traversal rather than on open. Read it in recovery mode, audit it, separate the errors that were repaired from those that were not, and quarantine on the latter. The audit fixes structure; it says nothing about whether the content survived the conversion. This page is part of [DWG Proprietary Limitations](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/).

## What Structural Damage Looks Like

A DXF document is a graph. Entities reference layers, linetypes and text styles by name; blocks reference their definitions; everything carries a handle that other objects use to point at it. A converter that stumbles can leave that graph inconsistent in ways the file format cannot express as an error: an entity on a layer that has no table entry, a handle that duplicates another, a block reference naming a definition that is not there.

<!-- fig:audit-graph -->
<svg viewBox="-20 -20 590.5 117.6" role="img" aria-label="Entities reference layers, linetypes, styles, block definitions and handles — any of which a conversion can leave dangling" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:591px;display:block;margin:1.5rem auto;">
  <title>The references that make a document a graph</title>
  <desc>An entity does not stand alone: it names a layer, a linetype and a text style by name, may name a block definition, and carries a handle other objects point at. A converter that stumbles can leave any of these dangling, and none of it prevents the file being read as text — it surfaces later, deep inside a traversal.</desc>
  <defs>
    <marker id="ad1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ad1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="590.5" height="117.6" fill="var(--color-surface)"/>
  <rect x="190.3" y="4" width="170" height="69.6" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="275.3" y="28.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">An entity</text>
  <text x="275.3" y="42" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">references by name</text>
  <text x="275.3" y="55.4" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">and by handle</text>
  <rect x="0" y="0" width="120.3" height="30.8" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="60.1" y="18.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">LAYER table</text>
  <path d="M 120.3 15.4 L 168.3 15.4 L 168.3 38.8 L 190.3 38.8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.7" marker-end="url(#ad1-a)" stroke-linejoin="round"/>
  <rect x="0" y="46.8" width="120.3" height="30.8" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="60.1" y="65.1" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">LTYPE table</text>
  <path d="M 120.3 62.2 L 168.3 62.2 L 168.3 38.8 L 190.3 38.8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.7" marker-end="url(#ad1-a)" stroke-linejoin="round"/>
  <rect x="430.3" y="0" width="120.3" height="30.8" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="490.4" y="18.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">BLOCK definition</text>
  <path d="M 360.3 38.8 L 408.3 38.8 L 408.3 15.4 L 430.3 15.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.7" marker-end="url(#ad1-a)" stroke-linejoin="round"/>
  <rect x="430.3" y="46.8" width="120.3" height="30.8" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="490.4" y="65.1" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Handle targets</text>
  <path d="M 360.3 38.8 L 408.3 38.8 L 408.3 62.2 L 430.3 62.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.7" marker-end="url(#ad1-a)" stroke-linejoin="round"/>
</svg>
<!-- /fig:audit-graph -->

None of these prevent the file from being read as text. They surface when something traverses the graph — an attribute lookup that finds nothing, an iteration that raises on a dangling reference — which is usually several stages into a pipeline and far from the cause.

The recovery reader and the auditor exist for exactly this. Recovery loads a damaged document as far as it can rather than refusing; the auditor then walks the graph, repairs what it can, and reports what it cannot. The distinction between those two outputs is the whole basis of the gate.

## Production-Ready Script

{% raw %}
```python
# ezdxf>=1.1.0, Python 3.9+
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import ezdxf
from ezdxf import recover


class UnrecoverableDXF(RuntimeError):
    pass


@dataclass
class AuditResult:
    path: str
    loaded: bool
    fixed: list[str] = field(default_factory=list)
    unrecoverable: list[str] = field(default_factory=list)
    entities: int = 0
    layers: int = 0

    @property
    def clean(self) -> bool:
        return self.loaded and not self.unrecoverable


def audit(path: str | Path) -> AuditResult:
    """Load defensively, audit, and separate repairs from unrecoverable errors."""
    path = str(path)
    result = AuditResult(path=path, loaded=False)
    try:
        # recover.readfile tolerates structural damage that readfile refuses.
        doc, auditor = recover.readfile(path)
    except ezdxf.DXFStructureError as exc:
        result.unrecoverable.append(f"unreadable: {exc}")
        return result

    result.loaded = True
    result.fixed = [str(e) for e in auditor.fixed_errors]
    result.unrecoverable = [str(e) for e in auditor.errors]

    # A second audit on the recovered document catches problems the recovery
    # reader introduced or could not see on the first pass.
    second = doc.audit()
    result.fixed.extend(str(e) for e in second.fixed_errors)
    result.unrecoverable.extend(str(e) for e in second.errors)

    result.entities = sum(1 for _ in doc.modelspace())
    result.layers = len(doc.layers)
    return result


def gate_batch(paths: list[str], quarantine: Path) -> tuple[list[str], list[AuditResult]]:
    """Accept clean files; quarantine the rest with their audit record."""
    quarantine.mkdir(parents=True, exist_ok=True)
    accepted: list[str] = []
    rejected: list[AuditResult] = []
    for p in paths:
        r = audit(p)
        if r.clean:
            accepted.append(p)
        else:
            rejected.append(r)
            (quarantine / (Path(p).stem + ".audit.txt")).write_text(
                "\n".join(["UNRECOVERABLE:", *r.unrecoverable, "", "FIXED:", *r.fixed])
            )
    return accepted, rejected


if __name__ == "__main__":
    accepted, rejected = gate_batch(["a.dxf", "b.dxf"], Path("./quarantine"))
    print(f"{len(accepted)} accepted, {len(rejected)} quarantined")
    for r in rejected:
        print(f"  {r.path}: {len(r.unrecoverable)} unrecoverable")
```
{% endraw %}

<!-- fig:audit-two-outputs -->
<svg viewBox="-20 -20 570 194.1" role="img" aria-label="Repaired errors are information about the converter; unrecoverable errors are a quarantine gate" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:570px;display:block;margin:1.5rem auto;">
  <title>Two audit outputs with two different meanings</title>
  <desc>The auditor produces two lists and they call for different responses. A repaired error is information: the document is now traversable and the repair rate across a batch is a signal about the converter. An unrecoverable error is a gate: the file goes to quarantine with its record rather than into the pipeline.</desc>
  <defs>
    <marker id="ad2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ad2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="570" height="194.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="250" height="130" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="125" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Fixed errors</text>
  <line x1="14" y1="33" x2="236" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="16" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— document is now traversable</text>
  <text x="16" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— record the count</text>
  <text x="16" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— a rising rate is a converter signal</text>
  <text x="16" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— not a rejection</text>
  <rect x="280" y="0" width="250" height="130" rx="6" fill="currentColor" fill-opacity="0.11" stroke="currentColor" stroke-width="1.9"/>
  <text x="405" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Unrecoverable errors</text>
  <line x1="294" y1="33" x2="516" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="296" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— quarantine the file</text>
  <text x="296" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— write the record beside it</text>
  <text x="296" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— no partial geometry downstream</text>
  <text x="296" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— a rejection</text>
  <text x="265" y="152" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">Structure only — content survival is a separate question.</text>
</svg>
<!-- /fig:audit-two-outputs -->

**Key implementation notes:**

- `recover.readfile` rather than `readfile`. The latter raises on damage the former loads through, and on converted files that difference is the whole point.
- Two audit passes. The recovery reader repairs as it loads, and a second audit on the resulting document catches what the first pass could not see.
- Repairs are recorded rather than discarded. A rising repair rate across a batch is a converter signal, and it is only visible if the repairs are counted.
- Quarantine writes the audit record next to the file, so the rejection is self-explanatory without re-running anything.
- Entity and layer counts are captured for the round-trip comparison against the source — structure and content are separate questions and both need answering.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `ezdxf` | `>=1.1.0` | `recover.readfile`, `Auditor` |
| DXF revision | R12 – R2018 | recovery works across the range |
| Input | converted or hand-edited DXF | native exports rarely need it |
| Output | audit record per rejected file | written to quarantine |
| Cost | small next to a full parse | run on every converted file |

## Fallback Strategies

**1. Recovery raises too.** The file is not a DXF, or is truncated. Check the magic bytes and the file size before assuming a conversion problem.

<!-- fig:audit-vs-content -->
<svg viewBox="-20 -20 426.3 214.1" role="img" aria-label="The auditor answers structural questions; content survival needs a round-trip comparison against the source" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:426px;display:block;margin:1.5rem auto;">
  <title>What the audit answers and what it cannot</title>
  <desc>Four questions about a converted file and which check answers each. The auditor speaks only to structure; whether the geometry, the units and the layer table survived the conversion are content questions answered by comparing against the source. A file can pass the audit perfectly and have lost most of its content.</desc>
  <defs>
    <marker id="ad3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ad3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="426.3" height="214.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="386.3" height="152" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="0" y="0" width="386.3" height="32" fill="currentColor" fill-opacity="0.09"/>
  <text x="12" y="19.5" font-size="10.5" font-weight="600" fill="currentColor">Question</text>
  <text x="221.7" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Kind</text>
  <line x1="254.6" y1="0" x2="254.6" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <text x="320.5" y="19.5" text-anchor="middle" font-size="10.5" font-weight="600" fill="currentColor">Answered by</text>
  <line x1="188.7" y1="0" x2="188.7" y2="152" stroke="currentColor" stroke-width="1" stroke-opacity="0.28"/>
  <line x1="0" y1="32" x2="386.3" y2="32" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.4"/>
  <text x="12" y="50.5" font-size="10.5" font-weight="600" fill="currentColor">Can the document be traversed?</text>
  <text x="221.7" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">structure</text>
  <text x="320.5" y="50.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">the auditor</text>
  <line x1="0" y1="62" x2="386.3" y2="62" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="80.5" font-size="10.5" font-weight="600" fill="currentColor">Did the geometry survive?</text>
  <text x="221.7" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">content</text>
  <text x="320.5" y="80.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">entity counts vs source</text>
  <line x1="0" y1="92" x2="386.3" y2="92" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="110.5" font-size="10.5" font-weight="600" fill="currentColor">Did the units survive?</text>
  <text x="221.7" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">content</text>
  <text x="320.5" y="110.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">header comparison</text>
  <line x1="0" y1="122" x2="386.3" y2="122" stroke="currentColor" stroke-width="1" stroke-opacity="0.22"/>
  <text x="12" y="140.5" font-size="10.5" font-weight="600" fill="currentColor">Did the layers survive?</text>
  <text x="221.7" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">content</text>
  <text x="320.5" y="140.5" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.85">layer table comparison</text>
  <text x="0" y="172" font-size="9.5" fill="currentColor" fill-opacity="0.7">Three of the four need the source; run both kinds of check.</text>
</svg>
<!-- /fig:audit-vs-content -->

**2. Repaired but empty.** Structurally sound with no entities. The conversion lost the content; the audit cannot tell you that, which is why the entity count is captured alongside.

**3. Errors that repeat across a batch.** A converter behaviour rather than a file defect. Aggregate the audit messages across the batch — one recurring message across fifty files is a configuration to change.

**4. Auditor fixes something you needed.** Rare, but a repaired reference to a missing layer creates a layer that was not in the source. The repair log is what makes that visible.

**5. Quarantine grows steadily.** Treat the rate as a metric. A stable low rate is normal; a step change means something upstream changed, usually the converter version or a new source of files.

## FAQ

<details>
<summary><strong>What does the auditor actually fix?</strong></summary>

Structural problems: invalid handles, entities pointing at tables that do not exist, malformed table entries, entities on layers that were never defined. It repairs the document graph so the file can be traversed. It does not fix content — a wrong coordinate, a missing units header or geometry that was lost during conversion are all perfectly valid structurally.

</details>

<details>
<summary><strong>Should I audit every file or only failing ones?</strong></summary>

Every file that came through a conversion. The audit is cheap relative to parsing, and its value is that it tells you a file needed repair — which is a signal about the conversion, not just about the file. A batch where the repair rate suddenly rises is a converter problem worth catching early.

</details>

<details>
<summary><strong>Is a repaired file safe to use?</strong></summary>

Structurally, yes: it can be traversed without raising. Whether its content is complete is a separate question the audit cannot answer. Pair the audit with the round-trip checks — entity counts, extents, layer table — described on the parent page, because those measure content and the audit measures structure.

</details>

---

## Related Pages

- [DWG Proprietary Limitations](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/) — parent reference on why converted files need auditing at all
- [Detecting and Routing DWG Version Compatibility in Python Pipelines](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dwg-proprietary-limitations/understanding-dwg-version-compatibility/) — the routing step that precedes this audit
- [Batch Converting DWG to DXF with the ODA File Converter](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/pydwg-integration/batch-converting-dwg-to-dxf-with-oda-file-converter/) — the conversion whose output this audit gates
