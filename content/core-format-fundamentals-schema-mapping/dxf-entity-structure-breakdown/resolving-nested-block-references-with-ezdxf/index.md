---
title: "Resolving Nested Block References with ezdxf"
description: "Flatten nested INSERT entities to world coordinates with ezdxf: how placement transforms compose, why virtual entities stop at one level, and guarding cycles."
slug: "resolving-nested-block-references-with-ezdxf"
breadcrumb:
  - label: "Core Format Fundamentals & Schema Mapping"
    url: "/core-format-fundamentals-schema-mapping/"
  - label: "DXF Entity Structure Breakdown"
    url: "/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/"
  - label: "Resolving Nested Block References with ezdxf"
    url: "/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/resolving-nested-block-references-with-ezdxf/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Resolving Nested Block References with ezdxf",
      "description": "Flatten nested INSERT entities to world coordinates with ezdxf: how placement transforms compose, why virtual entities stop at one level, and guarding cycles.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/resolving-nested-block-references-with-ezdxf/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Core Format Fundamentals & Schema Mapping", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/"},
        {"@type": "ListItem", "position": 2, "name": "DXF Entity Structure Breakdown", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/"},
        {"@type": "ListItem", "position": 3, "name": "Resolving Nested Block References with ezdxf", "item": "https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/resolving-nested-block-references-with-ezdxf/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Resolve nested DXF block references to world coordinates",
      "description": "Walk INSERT entities recursively, compose the placement transforms, guard against circular definitions, and record the block path with each resolved entity.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Compose the placement transform", "text": "Build a matrix from the insertion point, scales and rotation of each INSERT and multiply it into the accumulated transform."},
        {"@type": "HowToStep", "position": 2, "name": "Recurse into nested inserts", "text": "Expand block definitions that themselves contain INSERT entities, since a single-level expansion leaves nested geometry unplaced."},
        {"@type": "HowToStep", "position": 3, "name": "Guard against cycles", "text": "Track the block names on the current path and refuse to re-enter one, because a circular definition otherwise recurses until the process is killed."},
        {"@type": "HowToStep", "position": 4, "name": "Record the block path", "text": "Carry the chain of block names with each resolved entity so its origin remains traceable."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Does virtual_entities handle nesting?",
          "acceptedAnswer": {"@type": "Answer", "text": "It expands one level. A block containing another block reference yields that nested INSERT as one of its virtual entities, already transformed, but not the geometry inside it. For a fully flattened result you have to recurse on any INSERT that comes back, composing the transform as you go."}
        },
        {
          "@type": "Question",
          "name": "What order do the placement components apply in?",
          "acceptedAnswer": {"@type": "Answer", "text": "Scale, then rotation, then translation — and the scales are applied about the block base point rather than about the world origin. Composing them in a different order produces geometry that is the right shape in the wrong place, which looks like a coordinate system problem rather than a matrix one."}
        },
        {
          "@type": "Question",
          "name": "How do I detect a circular block definition?",
          "acceptedAnswer": {"@type": "Answer", "text": "Track the block names on the current recursion path in a set and refuse to enter one already on it. A depth limit alone is a blunter instrument: it stops the runaway but reports a depth error rather than naming the cycle, and legitimate deep nesting then looks like corruption."}
        }
      ]
    }
  ]
}
</script>

# Resolving Nested Block References with ezdxf

An INSERT entity places a named block definition with a scale, a rotation and an insertion point, and blocks routinely contain further INSERTs. Flattening them means recursing, composing the placement transforms as you descend, guarding against circular definitions, and keeping the chain of block names so a resolved entity can be traced back. A single-level expansion leaves the nested geometry sitting at the wrong place, at the wrong size, silently. This page is part of [DXF Entity Structure Breakdown](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/).

## How Placement Composes

Each INSERT carries four things that place its block: an insertion point, X, Y and Z scale factors, a rotation about the Z axis, and an extrusion vector defining the plane it all happens in. Together they form a transform from the block's own coordinate space into the space of whatever contains the INSERT.

<!-- fig:nb-composition -->
<svg viewBox="-20 -33.5 493.5 101.7" role="img" aria-label="The world position of nested geometry is the product of every insert transform on the path from modelspace" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:494px;display:block;margin:1.5rem auto;">
  <title>Each level multiplies into the placement</title>
  <desc>The chain from modelspace down to a piece of geometry three blocks deep. Each insert contributes a transform from its block space into its container space, and the geometry world position is the product of every transform on the path. Expanding one level leaves the deeper geometry placed in the wrong space, at the wrong size, without any error.</desc>
  <defs>
    <marker id="nb1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="nb1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-33.5" width="493.5" height="101.7" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="94.8" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="47.4" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Modelspace</text>
  <text x="47.4" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">world space</text>
  <rect x="128.8" y="0" width="71.3" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="164.4" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Block A</text>
  <text x="164.4" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">A-space</text>
  <rect x="234.1" y="0" width="71.3" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="269.7" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Block B</text>
  <text x="269.7" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">B-space</text>
  <rect x="339.3" y="0" width="114.2" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="396.4" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Placed entity</text>
  <text x="396.4" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">product of all three</text>
  <line x1="94.8" y1="24.1" x2="128.8" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#nb1-a)"/>
  <text x="111.8" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">INSERT</text>
  <line x1="200.1" y1="24.1" x2="234.1" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#nb1-a)"/>
  <text x="217.1" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">INSERT</text>
  <line x1="305.3" y1="24.1" x2="339.3" y2="24.1" stroke="currentColor" stroke-width="1.4" marker-end="url(#nb1-a)"/>
  <text x="322.3" y="-7" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">geometry</text>
</svg>
<!-- /fig:nb-composition -->

For an INSERT in modelspace, that containing space is the world. For an INSERT inside a block definition, it is the parent block's space — so the geometry's world position is the product of the transforms of every INSERT on the path from modelspace down to it. The order matters: composing parent-then-child gives a different result from child-then-parent, and both produce geometry that looks plausible.

The library's virtual-entity expansion does one level of this correctly. Ask a modelspace INSERT for its virtual entities and you get its block's contents transformed into world space — including any nested INSERT, itself correctly placed, still unexpanded. Recursion is the caller's job, and so is the cycle guard: a block that references itself, directly or through a chain, is invalid and does occur in files that have been through several rounds of editing.

## Production-Ready Script

{% raw %}
```python
# ezdxf>=1.1.0, Python 3.9+
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterator

import ezdxf
from ezdxf.entities import Insert


class CircularBlockError(ValueError):
    pass


@dataclass(frozen=True)
class PlacedEntity:
    entity: object                  # the transformed DXF entity
    block_path: tuple[str, ...]     # outermost block first; empty for modelspace
    depth: int


def flatten(layout, *, max_depth: int = 64) -> Iterator[PlacedEntity]:
    """Yield every entity in world coordinates, expanding nested INSERTs."""
    yield from _walk(layout, path=(), depth=0, max_depth=max_depth)


def _walk(container, *, path: tuple[str, ...], depth: int, max_depth: int
          ) -> Iterator[PlacedEntity]:
    if depth > max_depth:
        raise CircularBlockError(
            f"block nesting exceeded {max_depth} via {' > '.join(path)}"
        )
    for entity in container:
        if isinstance(entity, Insert):
            name = entity.dxf.name
            if name in path:
                raise CircularBlockError(
                    f"block {name!r} references itself via {' > '.join(path)}"
                )
            # virtual_entities() applies THIS insert's transform to the block
            # contents; nested inserts come back placed but unexpanded.
            yield from _walk(entity.virtual_entities(),
                             path=path + (name,), depth=depth + 1, max_depth=max_depth)
        else:
            yield PlacedEntity(entity=entity, block_path=path, depth=depth)


def flatten_document(dxf_path: str) -> list[PlacedEntity]:
    doc = ezdxf.readfile(dxf_path)
    return list(flatten(doc.modelspace()))


def summarise(placed: list[PlacedEntity]) -> dict:
    from collections import Counter
    by_depth = Counter(p.depth for p in placed)
    by_type = Counter(p.entity.dxftype() for p in placed)
    return {
        "entities": len(placed),
        "max_depth": max(by_depth) if by_depth else 0,
        "at_each_depth": dict(sorted(by_depth.items())),
        "top_types": dict(by_type.most_common(5)),
    }


if __name__ == "__main__":
    placed = flatten_document("federated.dxf")
    print(summarise(placed))
    deep = [p for p in placed if p.depth >= 2]
    if deep:
        print("example nested:", deep[0].entity.dxftype(), "via", " > ".join(deep[0].block_path))
```
{% endraw %}

<!-- fig:nb-cycle-guard -->
<svg viewBox="-20 -20 276.2 216.2" role="img" aria-label="Testing membership in the current recursion path distinguishes legitimate reuse from a circular block definition" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>The path test, not a visited set</title>
  <desc>A branch on whether a block name already appears on the current recursion path. A block legitimately used twice in different branches must be expanded twice, so a global visited set would silently drop the second use. Only membership in the current path distinguishes reuse from a genuine cycle.</desc>
  <defs>
    <marker id="nb2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="nb2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="276.2" height="216.2" fill="var(--color-surface)"/>
  <polygon points="118.1,0 233.2,31 118.1,62 3,31" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-width="1.6"/>
  <text x="118.1" y="35" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">Block name already on this path?</text>
  <rect x="0" y="128" width="104.1" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="52.1" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Descend</text>
  <text x="52.1" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">expand it</text>
  <path d="M 118.1 62 L 118.1 92 L 52.1 92 L 52.1 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#nb2-a)" stroke-linejoin="round"/>
  <text x="52.1" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">no</text>
  <rect x="132.1" y="128" width="104.1" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="184.2" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Circular</text>
  <text x="184.2" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">name it and stop</text>
  <path d="M 118.1 62 L 118.1 92 L 184.2 92 L 184.2 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#nb2-a)" stroke-linejoin="round"/>
  <text x="184.2" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">yes</text>
</svg>
<!-- /fig:nb-cycle-guard -->

**Key implementation notes:**

- The cycle guard tests membership in the current *path*, not in a global visited set. A block legitimately used twice in different branches is fine; a block that contains itself is not, and only the path distinguishes them.
- The depth limit is a second backstop with a different message, so an unusual-but-legal deep nesting is distinguishable from a cycle.
- `virtual_entities()` does the transform composition, which is why none appears explicitly here — reimplementing the matrix arithmetic is a common and unnecessary source of placement bugs.
- `block_path` travels with every entity. When a feature turns out to be in the wrong place, the path names the block to look at.
- The summary reports entities per depth. A drawing where everything sits at depth 0 has no nesting, and one where most entities are at depth 3 explains why a single-level expansion looked empty.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `ezdxf` | `>=1.1.0` | `virtual_entities` on INSERT |
| DXF revision | R12 – R2018 | block table present throughout |
| Nesting depth | bounded by `max_depth` | 64 is generous for real drawings |
| Non-uniform scale | supported | mirrored inserts have a negative scale |
| External references | expanded when bound | unbound references have empty definitions |

## Fallback Strategies

**1. Nothing comes back for a block.** Its definition is empty, which is what an unresolved external reference looks like. Check whether the reference was bound before treating it as a data problem.

<!-- fig:nb-depth-profile -->
<svg viewBox="-20 -20 528.4 184.1" role="img" aria-label="Most entities in a federated drawing sit two levels of block nesting deep, so single-level expansion looks empty" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:528px;display:block;margin:1.5rem auto;">
  <title>Entity count by nesting depth on a federated drawing</title>
  <desc>How many entities sit at each level of block nesting in one federated drawing. Most of the geometry is two levels down, which is why a single-level expansion returned almost nothing and looked like an empty drawing. The profile is worth reporting because it explains the result before anyone starts debugging the query.</desc>
  <defs>
    <marker id="nb3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="nb3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="528.4" height="184.1" fill="var(--color-surface)"/>
  <text x="109.7" y="11.5" text-anchor="end" font-size="10.5" fill="currentColor" fill-opacity="0.9">depth 0 — modelspace</text>
  <rect x="119.7" y="0" width="5.6" height="16" rx="3" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <text x="133.3" y="11.5" font-size="10" fill="currentColor" fill-opacity="0.85">412 entities</text>
  <text x="109.7" y="41.5" text-anchor="end" font-size="10.5" fill="currentColor" fill-opacity="0.9">depth 1</text>
  <rect x="119.7" y="30" width="43" height="16" rx="3" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <text x="170.7" y="41.5" font-size="10" fill="currentColor" fill-opacity="0.85">3,180 entities</text>
  <text x="109.7" y="71.5" text-anchor="end" font-size="10.5" fill="currentColor" fill-opacity="0.9">depth 2</text>
  <rect x="119.7" y="60" width="290" height="16" rx="3" fill="currentColor" fill-opacity="0.42" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.9"/>
  <text x="417.7" y="71.5" font-size="10" font-weight="600" fill="currentColor" fill-opacity="0.85">21,470 entities</text>
  <text x="109.7" y="101.5" text-anchor="end" font-size="10.5" fill="currentColor" fill-opacity="0.9">depth 3</text>
  <rect x="119.7" y="90" width="8.6" height="16" rx="3" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.5"/>
  <text x="136.4" y="101.5" font-size="10" fill="currentColor" fill-opacity="0.85">640 entities</text>
  <line x1="119.7" y1="108" x2="409.7" y2="108" stroke="currentColor" stroke-width="1" stroke-opacity="0.35"/>
  <text x="119.7" y="123" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.6">0</text>
  <text x="409.7" y="123" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.6">21,470</text>
  <text x="0" y="142" font-size="9.5" fill="currentColor" fill-opacity="0.7">A one-level expansion here returns under two per cent of the geometry.</text>
</svg>
<!-- /fig:nb-depth-profile -->

**2. Geometry is mirrored.** A negative scale factor on an INSERT is a legitimate mirror. It propagates correctly through the transform; what it also does is reverse ring winding, so downstream polygon orientation needs normalising.

**3. Runaway recursion.** The cycle guard names the block. Repair the drawing rather than raising the depth limit.

**4. Attributes are missing after flattening.** Flattening yields geometry; attribute values live on the INSERT itself, which the walk descends past. Collect attributes at the INSERT before recursing, as the [block attribute extraction guide](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/extracting-block-attributes-from-cad-files/) describes.

**5. Memory grows on a large drawing.** `flatten` is a generator; the list materialisation in `flatten_document` is what allocates. Consume the generator directly for a large file.

## FAQ

<details>
<summary><strong>Does virtual_entities handle nesting?</strong></summary>

It expands one level. A block containing another block reference yields that nested INSERT as one of its virtual entities, already transformed, but not the geometry inside it. For a fully flattened result you have to recurse on any INSERT that comes back, composing the transform as you go.

</details>

<details>
<summary><strong>What order do the placement components apply in?</strong></summary>

Scale, then rotation, then translation — and the scales are applied about the block base point rather than about the world origin. Composing them in a different order produces geometry that is the right shape in the wrong place, which looks like a coordinate system problem rather than a matrix one.

</details>

<details>
<summary><strong>How do I detect a circular block definition?</strong></summary>

Track the block names on the current recursion path in a set and refuse to enter one already on it. A depth limit alone is a blunter instrument: it stops the runaway but reports a depth error rather than naming the cycle, and legitimate deep nesting then looks like corruption.

</details>

---

## Related Pages

- [DXF Entity Structure Breakdown](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/dxf-entity-structure-breakdown/) — parent reference on sections, group codes and the block table
- [Extracting Block Attributes from CAD Files with ezdxf](https://www.cad-gis-bim-interop.org/core-format-fundamentals-schema-mapping/metadata-extraction-strategies/extracting-block-attributes-from-cad-files/) — the attribute side of the same INSERT traversal
- [Extracting LWPOLYLINE Vertices with ezdxf](https://www.cad-gis-bim-interop.org/python-parsing-geometry-extraction/ezdxf-deep-dive/extracting-lwpolyline-vertices-with-ezdxf/) — what to do with the geometry once it is placed
