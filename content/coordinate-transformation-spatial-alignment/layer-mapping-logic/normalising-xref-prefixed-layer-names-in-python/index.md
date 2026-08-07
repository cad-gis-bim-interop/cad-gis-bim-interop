---
title: "Normalising XREF-Prefixed Layer Names in Python"
description: "Strip external-reference prefixes from CAD layer names before mapping: how bound XREFs stack prefixes, and why the original name has to be kept alongside."
slug: "normalising-xref-prefixed-layer-names-in-python"
breadcrumb:
  - label: "Coordinate Transformation & Spatial Alignment"
    url: "/coordinate-transformation-spatial-alignment/"
  - label: "Layer Mapping Logic"
    url: "/coordinate-transformation-spatial-alignment/layer-mapping-logic/"
  - label: "Normalising XREF-Prefixed Layer Names in Python"
    url: "/coordinate-transformation-spatial-alignment/layer-mapping-logic/normalising-xref-prefixed-layer-names-in-python/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Normalising XREF-Prefixed Layer Names in Python",
      "description": "Strip external-reference prefixes from CAD layer names before mapping: how bound XREFs stack prefixes, and why the original name has to be kept alongside.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/normalising-xref-prefixed-layer-names-in-python/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Coordinate Transformation & Spatial Alignment", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/"},
        {"@type": "ListItem", "position": 2, "name": "Layer Mapping Logic", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/"},
        {"@type": "ListItem", "position": 3, "name": "Normalising XREF-Prefixed Layer Names in Python", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/normalising-xref-prefixed-layer-names-in-python/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Normalise XREF-prefixed CAD layer names before mapping",
      "description": "Detect the binding separator, strip prefixes iteratively to handle nesting, upper-case the result, and keep the original name for traceability.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Detect the binding separator", "text": "Identify the separator the binding process used, which differs between insert-bound and bind-bound external references."},
        {"@type": "HowToStep", "position": 2, "name": "Strip prefixes iteratively", "text": "Remove prefixes repeatedly rather than once, because nested external references produce several layers of prefix."},
        {"@type": "HowToStep", "position": 3, "name": "Normalise case", "text": "Upper-case the result so a case-insensitive rule table needs only one form of each rule."},
        {"@type": "HowToStep", "position": 4, "name": "Keep the original name", "text": "Carry the unmodified layer name alongside the normalised one so a mapping decision can be traced back to the drawing."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Why do bound XREF layers have prefixes at all?",
          "acceptedAnswer": {"@type": "Answer", "text": "To keep them unique. When an external reference is bound into a host drawing its layers have to coexist with the host layers, so the binding process prefixes each one with the reference name. Without the prefix, a layer called A-WALL in the reference would silently merge with the host layer of the same name."}
        },
        {
          "@type": "Question",
          "name": "Is the separator always the same?",
          "acceptedAnswer": {"@type": "Answer", "text": "No, and that is the practical problem. Insert-binding uses one separator and full binding uses another, and reference names themselves can contain characters that look like separators. Detect the separator from the set of names present rather than hard-coding one, and handle both forms."}
        },
        {
          "@type": "Question",
          "name": "Should I strip the prefix at all?",
          "acceptedAnswer": {"@type": "Answer", "text": "For classification, yes — the geometry means the same thing whichever drawing it came from. For provenance, no: which reference a layer came from is often exactly what an audit needs. Keep both, which is why the normaliser returns a record rather than a string."}
        }
      ]
    }
  ]
}
</script>

# Normalising XREF-Prefixed Layer Names in Python

A layer that arrived through a bound external reference carries a prefix naming the reference it came from, so `A-WALL` becomes something like `SITE-PLAN$0$A-WALL`. Strip the prefix iteratively — nesting produces several — upper-case the result, and keep the original name alongside it, because classification wants the stripped form and provenance wants the original. This page is part of [Layer Mapping Logic](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/).

## How Binding Mangles a Layer Name

An external reference brings its own layer table with it. While the reference is merely attached, those layers live in the reference and cannot collide with the host's. Binding brings them into the host drawing, and to keep them distinct the binding process rewrites each name with a prefix derived from the reference.

<!-- fig:xref-stacking -->
<svg viewBox="-20 -20 415.1 156.1" role="img" aria-label="Binding a nested external reference stacks prefixes, so a single strip leaves the name still prefixed" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>How prefixes stack through nested references</title>
  <desc>One layer name at three depths of federation. Unbound, it is the drafted name. Bound once, it carries the reference name and a separator. Bound inside a reference that was itself bound, it carries both prefixes stacked. A normaliser that strips once handles the middle case and leaves the last one still prefixed.</desc>
  <defs>
    <marker id="xr1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="xr1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="415.1" height="156.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="193.6" height="92" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.3" stroke-opacity="0.5"/>
  <text x="14" y="16" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">A-WALL</text>
  <line x1="199.6" y1="12.9" x2="231.6" y2="12.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="239.6" y="16" font-size="9.5" fill="currentColor" fill-opacity="0.78">as drafted, in the reference</text>
  <text x="14" y="35" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">SITE$0$A-WALL</text>
  <line x1="199.6" y1="31.9" x2="231.6" y2="31.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="239.6" y="35" font-size="9.5" fill="currentColor" fill-opacity="0.78">bound once</text>
  <text x="14" y="54" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">SITE$0$SERVICES$0$M-DUCT</text>
  <line x1="199.6" y1="50.9" x2="231.6" y2="50.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="239.6" y="54" font-size="9.5" fill="currentColor" fill-opacity="0.78">bound inside a bound reference</text>
  <text x="14" y="73" font-size="10.5" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.95">SITE|C-ROAD-CNTR</text>
  <line x1="199.6" y1="69.9" x2="231.6" y2="69.9" stroke="currentColor" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="3 3"/>
  <text x="239.6" y="73" font-size="9.5" fill="currentColor" fill-opacity="0.78">the other binding convention</text>
  <text x="0" y="114" font-size="9.5" fill="currentColor" fill-opacity="0.7">Strip in a loop, not once — the third line is what a single strip misses.</text>
</svg>
<!-- /fig:xref-stacking -->

There are two binding styles and they produce different results. One inserts the reference's contents and prefixes with the reference name and a separator; the other binds and produces a different separator with an index. A drawing that has been through several rounds of federation can carry both forms, and a reference bound inside a reference produces a name with two prefixes stacked.

The consequence for a mapping pipeline is that a rule table written against clean layer names matches nothing on a federated drawing, and the layers all land in the unmapped bucket. The volume makes it obvious; the cause does not, because the layer names look plausible.

## Production-Ready Script

{% raw %}
```python
# ezdxf>=1.1.0, Python 3.9+
from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass

import ezdxf

# Both binding conventions, plus the nested-reference form.
XREF_PREFIX = re.compile(r"^[^|$]+(?:\$\d+\$|\|)")


@dataclass(frozen=True)
class LayerName:
    original: str          # exactly as stored — provenance
    normalised: str        # prefix-free, upper case — classification
    xref_chain: tuple[str, ...]   # outermost first

    @property
    def from_xref(self) -> bool:
        return bool(self.xref_chain)


def normalise(name: str) -> LayerName:
    """Strip stacked external-reference prefixes and upper-case the remainder."""
    remainder = name
    chain: list[str] = []
    while True:
        match = XREF_PREFIX.match(remainder)
        if not match:
            break
        prefix = match.group(0)
        chain.append(prefix.rstrip("$|0123456789"))
        remainder = remainder[len(prefix):]
        if not remainder:                  # a name that was ONLY a prefix
            remainder = name
            chain.clear()
            break
    return LayerName(original=name, normalised=remainder.upper(),
                     xref_chain=tuple(chain))


def normalise_document(dxf_path: str) -> dict[str, LayerName]:
    doc = ezdxf.readfile(dxf_path)
    return {layer.dxf.name: normalise(layer.dxf.name) for layer in doc.layers}


def summarise(names: dict[str, LayerName]) -> dict:
    depth = Counter(len(n.xref_chain) for n in names.values())
    collisions = Counter(n.normalised for n in names.values())
    return {
        "layers": len(names),
        "from_xref": sum(1 for n in names.values() if n.from_xref),
        "max_nesting": max(depth) if depth else 0,
        "normalised_collisions": {k: v for k, v in collisions.items() if v > 1},
    }


if __name__ == "__main__":
    names = normalise_document("federated.dxf")
    print(summarise(names))
```
{% endraw %}

<!-- fig:xref-two-outputs -->
<svg viewBox="-20 -20 566 194.1" role="img" aria-label="Classification needs the stripped name; provenance needs the original and the reference chain" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:566px;display:block;margin:1.5rem auto;">
  <title>Two things the caller needs from one name</title>
  <desc>The normaliser returns a record rather than a string because two different consumers want two different answers. Classification wants the prefix-free upper-case form, since geometry means the same thing whichever drawing supplied it. Provenance wants the original and the reference chain, since which drawing supplied it is exactly what an audit asks.</desc>
  <defs>
    <marker id="xr2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="xr2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="566" height="194.1" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="248" height="130" rx="6" fill="currentColor" fill-opacity="0.11" stroke="currentColor" stroke-width="1.9"/>
  <text x="124" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">For classification</text>
  <line x1="14" y1="33" x2="234" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="16" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— prefix-free</text>
  <text x="16" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— upper-cased</text>
  <text x="16" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— matched against the rule table</text>
  <text x="16" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— one rule per convention</text>
  <rect x="278" y="0" width="248" height="130" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="402" y="24" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">For provenance</text>
  <line x1="292" y1="33" x2="512" y2="33" stroke="currentColor" stroke-width="1" stroke-opacity="0.3"/>
  <text x="294" y="52" font-size="10" fill="currentColor" fill-opacity="0.8">— the original string</text>
  <text x="294" y="70" font-size="10" fill="currentColor" fill-opacity="0.8">— the reference chain</text>
  <text x="294" y="88" font-size="10" fill="currentColor" fill-opacity="0.8">— answers &quot;which drawing?&quot;</text>
  <text x="294" y="106" font-size="10" fill="currentColor" fill-opacity="0.8">— never reconstructable later</text>
  <text x="263" y="152" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">Return both, or the audit question becomes a re-read of every file.</text>
</svg>
<!-- /fig:xref-two-outputs -->

**Key implementation notes:**

- The loop strips repeatedly. A single strip handles one level and leaves a nested reference still prefixed, which is the bug this page is really about.
- A name consisting only of a prefix restores the original rather than returning an empty string, so a malformed name never becomes a blank classification key.
- `normalised_collisions` is reported because stripping prefixes deliberately merges layers that binding deliberately separated. Two references each contributing `A-WALL` collapse to one classification key, which is usually correct and occasionally not — either way it should be visible.
- The original name is kept on every record. An audit asking which drawing a feature came from is answered from `xref_chain` without re-reading the file.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `ezdxf` | `>=1.1.0` | `doc.layers` iteration |
| DXF revision | R2000 – R2018 | binding conventions unchanged across this range |
| Separator forms | `$n$` and `|` | both handled; extend the pattern for others |
| Nesting depth | unbounded | the loop handles stacked prefixes |
| Case | upper-cased output | match rule tables in one form only |

## Fallback Strategies

**1. Everything lands unmapped on a federated drawing.** The signature of unstripped prefixes. Check `from_xref` counts before suspecting the rule table.

<!-- fig:xref-collision -->
<svg viewBox="-20 -20 355.2 216.2" role="img" aria-label="Stripping prefixes merges layers binding separated; decide whether that merge is intended" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:420px;display:block;margin:1.5rem auto;">
  <title>What to do when stripping merges two layers</title>
  <desc>A branch on what a normalised collision means. Binding deliberately separated two layers that were drafted with the same name, and stripping the prefix merges them again. Usually that is right — the same convention meant the same thing in both drawings. Where it is not, the classification key becomes the pair of reference chain and name rather than the name alone.</desc>
  <defs>
    <marker id="xr3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="xr3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="355.2" height="216.2" fill="var(--color-surface)"/>
  <polygon points="157.6,0 291,31 157.6,62 24.1,31" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-width="1.6"/>
  <text x="157.6" y="35" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">Two references, same normalised name</text>
  <rect x="0" y="128" width="143.6" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="71.8" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Merge</text>
  <text x="71.8" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">usually correct</text>
  <path d="M 157.6 62 L 157.6 92 L 71.8 92 L 71.8 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#xr3-a)" stroke-linejoin="round"/>
  <text x="71.8" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">same meaning</text>
  <rect x="171.6" y="128" width="143.6" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="243.4" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Key on chain + name</text>
  <text x="243.4" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">keep them apart</text>
  <path d="M 157.6 62 L 157.6 92 L 243.4 92 L 243.4 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#xr3-a)" stroke-linejoin="round"/>
  <text x="243.4" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">different meaning</text>
</svg>
<!-- /fig:xref-collision -->

**2. A reference name contains the separator.** The pattern strips too much. Constrain it with the set of reference names actually present in the document rather than by pattern alone.

**3. Normalised names collide.** Two references contributed the same layer name. Decide whether they should merge; where they should not, key the classification on the pair of chain and name rather than on the name alone.

**4. Layer 0 inside a reference.** Entities on layer 0 inherit properties from the reference placement, so a normalised `0` is not the same thing as a host `0`. Handle it as a distinct case rather than mapping it.

**5. Names differing only in case.** CAD layer names are case-insensitive but stored with case, so `A-Wall` and `A-WALL` are one layer conceptually and two strings. Upper-casing before matching, as above, is what makes the rule table small.

**6. Non-ASCII characters in reference names.** Project directories in languages other than English produce reference names with accented or non-Latin characters, and those survive into the bound layer name. The pattern above is character-class based rather than alphabet based, so it handles them, but a rule table written with the unaccented spelling will not match. Normalise Unicode to a single composition form before comparing, or two visually identical names remain two distinct strings.

## Validating the Normaliser

Because the normaliser is a pure function from string to record, it is unusually cheap to test, and the cases worth committing are the ones a real federation produced:

{% raw %}
```python
# pytest
CASES = [
    ("A-WALL",                     "A-WALL",      0),
    ("SITE$0$A-WALL",              "A-WALL",      1),
    ("SITE$0$SERVICES$0$M-DUCT",   "M-DUCT",      2),
    ("SITE|C-ROAD-CNTR",           "C-ROAD-CNTR", 1),
    ("a-wall",                     "A-WALL",      0),
]

def test_normalise():
    for raw, expected, depth in CASES:
        result = normalise(raw)
        assert result.normalised == expected, raw
        assert len(result.xref_chain) == depth, raw
        assert result.original == raw          # provenance is never lost
```
{% endraw %}

Add a case each time an unexpected layer name appears in a delivery, whatever the outcome. Over a few projects the list becomes a description of what the offices you work with actually produce, which is more useful than the pattern itself when a convention changes.

## FAQ

<details>
<summary><strong>Why do bound XREF layers have prefixes at all?</strong></summary>

To keep them unique. When an external reference is bound into a host drawing its layers have to coexist with the host layers, so the binding process prefixes each one with the reference name. Without the prefix, a layer called `A-WALL` in the reference would silently merge with the host layer of the same name.

</details>

<details>
<summary><strong>Is the separator always the same?</strong></summary>

No, and that is the practical problem. Insert-binding uses one separator and full binding uses another, and reference names themselves can contain characters that look like separators. Detect the separator from the set of names present rather than hard-coding one, and handle both forms.

</details>

<details>
<summary><strong>Should I strip the prefix at all?</strong></summary>

For classification, yes — the geometry means the same thing whichever drawing it came from. For provenance, no: which reference a layer came from is often exactly what an audit needs. Keep both, which is why the normaliser returns a record rather than a string.

</details>

---

## Related Pages

- [Layer Mapping Logic](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/) — parent reference on rule routing and the unmapped bucket
- [Mapping CAD Layers to GIS Feature Classes in Python](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/mapping-cad-layers-to-gis-feature-classes-in-python/) — the rule engine this normaliser feeds
- [Loading Layer Mapping Rules from YAML in Python](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/loading-layer-mapping-rules-from-yaml-in-python/) — where the rules the normalised name is matched against live
