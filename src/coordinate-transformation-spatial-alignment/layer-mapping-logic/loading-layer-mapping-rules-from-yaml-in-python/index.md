---
title: "Loading Layer Mapping Rules from YAML in Python"
description: "Move CAD layer mapping rules into configuration: a schema that survives review, patterns compiled once, deterministic precedence, and validation at load time."
slug: "loading-layer-mapping-rules-from-yaml-in-python"
breadcrumb:
  - label: "Coordinate Transformation & Spatial Alignment"
    url: "/coordinate-transformation-spatial-alignment/"
  - label: "Layer Mapping Logic"
    url: "/coordinate-transformation-spatial-alignment/layer-mapping-logic/"
  - label: "Loading Layer Mapping Rules from YAML in Python"
    url: "/coordinate-transformation-spatial-alignment/layer-mapping-logic/loading-layer-mapping-rules-from-yaml-in-python/"
datePublished: "2026-08-07"
dateModified: "2026-08-07"
---

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Loading Layer Mapping Rules from YAML in Python",
      "description": "Move CAD layer mapping rules into configuration: a schema that survives review, patterns compiled once, deterministic precedence, and validation at load time.",
      "datePublished": "2026-08-07",
      "dateModified": "2026-08-07",
      "author": {"@type": "Organization", "name": "cad-gis-bim-interop.org"},
      "mainEntityOfPage": {"@type": "WebPage", "@id": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/loading-layer-mapping-rules-from-yaml-in-python/"}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Coordinate Transformation & Spatial Alignment", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/"},
        {"@type": "ListItem", "position": 2, "name": "Layer Mapping Logic", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/"},
        {"@type": "ListItem", "position": 3, "name": "Loading Layer Mapping Rules from YAML in Python", "item": "https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/loading-layer-mapping-rules-from-yaml-in-python/"}
      ]
    },
    {
      "@type": "HowTo",
      "name": "Load and validate CAD layer mapping rules from YAML",
      "description": "Define a reviewable schema, load and validate it, compile the patterns once, and expose a classifier with deterministic precedence.",
      "step": [
        {"@type": "HowToStep", "position": 1, "name": "Define a reviewable schema", "text": "Structure the file so a non-programmer can read a rule and see which feature class it produces."},
        {"@type": "HowToStep", "position": 2, "name": "Validate on load", "text": "Reject an unparsable pattern, a duplicate exact key or an unknown target class before the pipeline runs rather than at the first matching layer."},
        {"@type": "HowToStep", "position": 3, "name": "Compile the patterns once", "text": "Compile every regular expression at load time so the per-entity path does no compilation."},
        {"@type": "HowToStep", "position": 4, "name": "Apply deterministic precedence", "text": "Try exact matches first, then patterns in declaration order, so the result never depends on dictionary ordering."},
        {"@type": "HowToStep", "position": 5, "name": "Expose the unmatched set", "text": "Return the layers that matched nothing so a run can report them rather than discarding them."}
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Why YAML rather than code?",
          "acceptedAnswer": {"@type": "Answer", "text": "Because the people who know what a layer means are usually not the people who maintain the pipeline. A rule table in configuration can be reviewed, diffed and amended by a CAD manager without a release, and the pipeline can validate it before accepting it. Rules embedded in code make every convention change a code change."}
        },
        {
          "@type": "Question",
          "name": "How is precedence decided between two matching patterns?",
          "acceptedAnswer": {"@type": "Answer", "text": "Declaration order, deliberately. Sorting by specificity sounds better and is impossible to define unambiguously for regular expressions; declaration order is arbitrary but visible and reviewable. Whichever rule is written first wins, and the file is the documentation of that decision."}
        },
        {
          "@type": "Question",
          "name": "What should happen to a layer that matches nothing?",
          "acceptedAnswer": {"@type": "Answer", "text": "It should be counted and reported, never dropped and never guessed at. An unmatched layer is either a new convention worth a rule or a layer that genuinely should not be imported, and both are decisions for a person. A pipeline that silently discards them loses data with no record that it did."}
        }
      ]
    }
  ]
}
</script>

# Loading Layer Mapping Rules from YAML in Python

A layer mapping rule table belongs in configuration rather than in code, because the people who know what `C-ROAD-CNTR` means are rarely the people who deploy the pipeline. Define a schema a CAD manager can read, validate it on load so a bad rule fails at start-up rather than at the first matching entity, compile the patterns once, and apply exact matches before patterns in declaration order. This page is part of [Layer Mapping Logic](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/).

## What the Schema Has to Support

Three things, and no more than three, or the file stops being reviewable.

<!-- fig:yaml-three-parts -->
<svg viewBox="-20 -20 560 198" role="img" aria-label="Declared classes, an exact table and an ordered pattern list — the whole layer rule schema" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:560px;display:block;margin:1.5rem auto;">
  <title>Three parts, and deliberately no more</title>
  <desc>The whole schema. A declared class list makes a typo in a target a load-time error; an exact table covers the common case fastest and clearest; a pattern list covers the families where drafting conventions vary in the tail. Everything else — precedence, case handling, the unmapped bucket — is loader behaviour, because options that change how matching works turn a reviewable table into a small programming language.</desc>
  <defs>
    <marker id="ym1-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ym1-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="560" height="198" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="520" height="46" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="16" y="21" font-size="11.5" font-weight="600" fill="currentColor">classes</text>
  <text x="16" y="35" font-size="9.5" fill="currentColor" fill-opacity="0.72">every valid target, declared once</text>
  <text x="504" y="26.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">typos become load errors</text>
  <rect x="0" y="56" width="520" height="46" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-width="1.4"/>
  <text x="16" y="77" font-size="11.5" font-weight="600" fill="currentColor">exact</text>
  <text x="16" y="91" font-size="9.5" fill="currentColor" fill-opacity="0.72">the common case, fastest and clearest</text>
  <text x="504" y="82.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">name → class</text>
  <rect x="0" y="112" width="520" height="46" rx="6" fill="currentColor" fill-opacity="0.14" stroke="currentColor" stroke-width="2"/>
  <text x="16" y="133" font-size="11.5" font-weight="600" fill="currentColor">patterns</text>
  <text x="16" y="147" font-size="9.5" fill="currentColor" fill-opacity="0.72">families whose tails vary</text>
  <text x="504" y="138.5" text-anchor="end" font-size="10" font-family="var(--font-mono, monospace)" xml:space="preserve" fill="currentColor" fill-opacity="0.8">ordered</text>
</svg>
<!-- /fig:yaml-three-parts -->

**Exact names**, because most rules are exact and an exact table is the fastest and clearest form. **Patterns**, because drafting conventions vary in their tails and a prefix rule covers a family of layers. **A declared target class**, because a rule that produces an arbitrary string invites typos that only surface as an empty feature class.

Everything else — precedence, case handling, the unmapped bucket — should be behaviour of the loader rather than options in the file. Options that change how matching works turn a reviewable table into a small programming language.

## Production-Ready Script

{% raw %}
```python
# PyYAML>=6.0, Python 3.9+
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import yaml

UNMAPPED = "__UNMAPPED__"


class RuleFileError(ValueError):
    pass


@dataclass(frozen=True)
class PatternRule:
    pattern: re.Pattern
    target: str
    source: str            # the raw pattern, for error messages and reports


@dataclass
class RuleSet:
    exact: dict[str, str] = field(default_factory=dict)
    patterns: list[PatternRule] = field(default_factory=list)
    classes: frozenset[str] = frozenset()
    unmatched: set[str] = field(default_factory=set)

    def classify(self, normalised_layer: str) -> str:
        """Exact first, then patterns in declaration order. Deterministic."""
        hit = self.exact.get(normalised_layer)
        if hit is not None:
            return hit
        for rule in self.patterns:
            if rule.pattern.match(normalised_layer):
                return rule.target
        self.unmatched.add(normalised_layer)
        return UNMAPPED


def load_rules(path: str | Path) -> RuleSet:
    """Load and fully validate the rule file before anything uses it."""
    data = yaml.safe_load(Path(path).read_text()) or {}

    declared = data.get("classes")
    if not isinstance(declared, list) or not declared:
        raise RuleFileError("'classes' must be a non-empty list of target class names")
    classes = frozenset(str(c) for c in declared)

    exact: dict[str, str] = {}
    for key, target in (data.get("exact") or {}).items():
        upper = str(key).upper()
        if upper in exact:
            raise RuleFileError(f"duplicate exact rule for {upper!r}")
        if target not in classes:
            raise RuleFileError(f"exact rule {upper!r} targets undeclared class {target!r}")
        exact[upper] = target

    patterns: list[PatternRule] = []
    for entry in (data.get("patterns") or []):
        raw, target = entry.get("match"), entry.get("target")
        if not raw or not target:
            raise RuleFileError(f"pattern rule missing 'match' or 'target': {entry!r}")
        if target not in classes:
            raise RuleFileError(f"pattern {raw!r} targets undeclared class {target!r}")
        try:
            compiled = re.compile(raw, re.IGNORECASE)
        except re.error as exc:
            raise RuleFileError(f"pattern {raw!r} does not compile: {exc}") from exc
        patterns.append(PatternRule(compiled, target, raw))

    if not exact and not patterns:
        raise RuleFileError("rule file declares no rules")
    return RuleSet(exact=exact, patterns=patterns, classes=classes)


if __name__ == "__main__":
    rules = load_rules("layer-rules.yaml")
    for layer in ("C-ROAD-CNTR", "A-WALL-EXTR", "RANDOM"):
        print(layer, "->", rules.classify(layer))
    print("unmatched:", sorted(rules.unmatched))
```
{% endraw %}

<!-- fig:yaml-validate-first -->
<svg viewBox="-45 -20 479.5 310.8" role="img" aria-label="Declared classes, duplicate keys, uncompilable patterns and an empty rule set — all validated at load time" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:480px;display:block;margin:1.5rem auto;">
  <title>Everything that can be wrong is wrong at load time</title>
  <desc>Four validations run when the file is read rather than when a layer matches. An undeclared target, a duplicate exact key and an uncompilable pattern are all detectable without seeing a single drawing, and each of them otherwise surfaces as an empty feature class or a silent misroute much later.</desc>
  <defs>
    <marker id="ym2-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ym2-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-45" y="-20" width="479.5" height="310.8" fill="var(--color-surface)"/>
  <rect x="0" y="0" width="262" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="131" y="20.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Targets are declared</text>
  <text x="131" y="34" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">against the class list</text>
  <circle cx="-14" cy="24.1" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="27.6" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">1</text>
  <text x="280" y="27.6" font-size="9.5" fill="currentColor" fill-opacity="0.75">a typo is not an empty class</text>
  <rect x="0" y="74.2" width="262" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="131" y="94.5" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">No duplicate exact keys</text>
  <text x="131" y="108.2" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">one rule per name</text>
  <circle cx="-14" cy="98.3" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="101.8" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">2</text>
  <text x="280" y="101.8" font-size="9.5" fill="currentColor" fill-opacity="0.75">later would silently win</text>
  <rect x="0" y="148.4" width="262" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="131" y="168.7" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Every pattern compiles</text>
  <text x="131" y="182.4" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">named in the error</text>
  <circle cx="-14" cy="172.5" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="176" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">3</text>
  <text x="280" y="176" font-size="9.5" fill="currentColor" fill-opacity="0.75">not at the first match</text>
  <rect x="0" y="222.6" width="262" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="131" y="242.9" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">The set is non-empty</text>
  <text x="131" y="256.6" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">refuse a no-op file</text>
  <circle cx="-14" cy="246.7" r="11" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-width="1.2"/>
  <text x="-14" y="250.2" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor">4</text>
  <text x="280" y="250.2" font-size="9.5" fill="currentColor" fill-opacity="0.75">everything would go unmapped</text>
  <line x1="131" y1="48.2" x2="131" y2="74.2" stroke="currentColor" stroke-width="1.4" marker-end="url(#ym2-a)"/>
  <line x1="131" y1="122.4" x2="131" y2="148.4" stroke="currentColor" stroke-width="1.4" marker-end="url(#ym2-a)"/>
  <line x1="131" y1="196.6" x2="131" y2="222.6" stroke="currentColor" stroke-width="1.4" marker-end="url(#ym2-a)"/>
</svg>
<!-- /fig:yaml-validate-first -->

A rule file for the loader above:

{% raw %}
```yaml
# layer-rules.yaml — reviewed by the CAD manager, consumed by the pipeline
classes:
  - road_centreline
  - building_wall
  - survey_boundary

exact:
  C-ROAD-CNTR: road_centreline
  V-SURV-BNDY: survey_boundary

patterns:
  - match: "^C-ROAD-CNTR(-.+)?$"      # any status or modifier suffix
    target: road_centreline
  - match: "^A-WALL"
    target: building_wall
```
{% endraw %}

**Key implementation notes:**

- Every target is checked against a declared class list. A typo in a target becomes a load-time error instead of an empty feature class nobody notices.
- Patterns are compiled at load. The per-entity path does lookups only, which matters when it runs per entity on a drawing with hundreds of thousands.
- `unmatched` accumulates on the rule set, so a run reports what it could not classify without a second pass.
- `classify` takes the *normalised* name; the stripping and upper-casing belong to the [XREF normaliser](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/normalising-xref-prefixed-layer-names-in-python/), which keeps each piece testable alone.
- `yaml.safe_load` rather than `load`. A rule file is input, and input should not be able to construct arbitrary objects.

## Compatibility Matrix

| Component | Supported range | Notes |
|---|---|---|
| `PyYAML` | `>=6.0` | `safe_load` |
| Python | 3.9+ | dataclasses, typing |
| Pattern syntax | Python `re` | compiled case-insensitively |
| Precedence | exact, then declaration order | not configurable, by design |
| Rule file | UTF-8 | non-ASCII layer names supported |

## Fallback Strategies

**1. A pattern that does not compile.** Caught at load with the offending pattern named. This is why validation is separate from use.

<!-- fig:yaml-precedence -->
<svg viewBox="-20 -20 456.9 216.2" role="img" aria-label="Exact match first, then patterns in file order, then the unmapped bucket — precedence that is visible in the file" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:457px;display:block;margin:1.5rem auto;">
  <title>Precedence is declaration order, on purpose</title>
  <desc>A three-way resolution. An exact match wins outright because it is unambiguous. Failing that, patterns are tried in the order they appear in the file and the first match wins. A name matching nothing is counted rather than guessed at. Sorting patterns by specificity sounds better and cannot be defined unambiguously for regular expressions.</desc>
  <defs>
    <marker id="ym3-a" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.8"/>
    </marker>
    <marker id="ym3-o" markerWidth="8" markerHeight="6" refX="7.2" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="currentColor" fill-opacity="0.4"/>
    </marker>
  </defs>
  <rect x="-20" y="-20" width="456.9" height="216.2" fill="var(--color-surface)"/>
  <polygon points="208.4,0 306.6,31 208.4,62 110.2,31" fill="currentColor" fill-opacity="0.07" stroke="currentColor" stroke-width="1.6"/>
  <text x="208.4" y="35" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">How does a name resolve?</text>
  <rect x="0" y="128" width="120.3" height="48.2" rx="6" fill="currentColor" fill-opacity="0.13" stroke="currentColor" stroke-width="2"/>
  <text x="60.1" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">That class</text>
  <text x="60.1" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">unambiguous</text>
  <path d="M 208.4 62 L 208.4 92 L 60.1 92 L 60.1 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#ym3-a)" stroke-linejoin="round"/>
  <text x="60.1" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">exact hit</text>
  <rect x="148.3" y="128" width="120.3" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="208.4" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">First in file order</text>
  <text x="208.4" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">reorder to change</text>
  <path d="M 208.4 62 L 208.4 92 L 208.4 92 L 208.4 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#ym3-a)" stroke-linejoin="round"/>
  <text x="208.4" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">pattern hit</text>
  <rect x="296.6" y="128" width="120.3" height="48.2" rx="6" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-width="1.5"/>
  <text x="356.7" y="148.3" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">Counted</text>
  <text x="356.7" y="162" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">never guessed</text>
  <path d="M 208.4 62 L 208.4 92 L 356.7 92 L 356.7 128" fill="none" stroke="currentColor" stroke-width="1.4" marker-end="url(#ym3-a)" stroke-linejoin="round"/>
  <text x="356.7" y="85" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.72">no hit</text>
</svg>
<!-- /fig:yaml-precedence -->

**2. Two patterns both match.** The first declared wins. Where that is wrong, reorder the file — which is a reviewable diff rather than a code change.

**3. A large unmatched set.** Either a new drafting convention or unnormalised names. Check the XREF prefix counts first; a federated drawing with unstripped prefixes produces exactly this.

**4. Rules drift from the drawings.** Keep a fixture list of real layer names with their expected classes and assert it in CI, as described on the parent page. The rule file and the fixture list should change together.

**5. One target class swallows everything.** A pattern anchored too loosely — `A-` rather than `^A-WALL`. Anchor patterns at the start, and report per-class counts after a run so a dominant class is visible.

## FAQ

<details>
<summary><strong>Why YAML rather than code?</strong></summary>

Because the people who know what a layer means are usually not the people who maintain the pipeline. A rule table in configuration can be reviewed, diffed and amended by a CAD manager without a release, and the pipeline can validate it before accepting it. Rules embedded in code make every convention change a code change.

</details>

<details>
<summary><strong>How is precedence decided between two matching patterns?</strong></summary>

Declaration order, deliberately. Sorting by specificity sounds better and is impossible to define unambiguously for regular expressions; declaration order is arbitrary but visible and reviewable. Whichever rule is written first wins, and the file is the documentation of that decision.

</details>

<details>
<summary><strong>What should happen to a layer that matches nothing?</strong></summary>

It should be counted and reported, never dropped and never guessed at. An unmatched layer is either a new convention worth a rule or a layer that genuinely should not be imported, and both are decisions for a person. A pipeline that silently discards them loses data with no record that it did.

</details>

---

## Related Pages

- [Layer Mapping Logic](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/) — parent reference on rule routing and the unmapped bucket
- [Normalising XREF-Prefixed Layer Names in Python](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/normalising-xref-prefixed-layer-names-in-python/) — the normalisation these rules are matched against
- [Mapping CAD Layers to GIS Feature Classes in Python](https://www.cad-gis-bim-interop.org/coordinate-transformation-spatial-alignment/layer-mapping-logic/mapping-cad-layers-to-gis-feature-classes-in-python/) — the classification pipeline this configuration drives
