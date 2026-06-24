# Phase plan — cad-gis-bim-interop.org

> The schedule to grow this site phase-by-phase, generated from the Django `Site` model. **No OpenRouter / no API** — you (Claude Code) do the work, grounded in the real markdown under `content/`.

- **Niche:** Python for CAD/GIS & BIM Interoperability Pipelines
- **Audience:** AEC tech engineers, GIS/CAD integrators, Python automation builders, infrastructure platform teams
- **Live now:** 25 pages, 29,731 words
- **Current phase:** foundation
- **Next phase to build:** expansion

## How to upgrade a phase

Work through every step in order. **Do not skip the uplift, the term cleanup, the SVG render check, or the finish/deploy steps** — those were the gaps in earlier runs.

1. **Read & orient.** Read this whole file, then skim `content/` to learn what exists and the writing tone.
2. **Uplift EVERY existing page (not just new ones).** Bring all current pages — from earlier phases — up to the Page blueprint below: its page anatomy, frontmatter, JSON-LD schema, the custom SVG visuals, and the mandatory wiki-style interlinking. Old pages must reach the *current* standard, not be left as they were. Two presentation fixes that apply site-wide:
   - **Convert any Mermaid diagrams to hand-authored inline SVGs** (in the "Custom visuals" style). No `mermaid` code fences, `.mermaid` containers, or mermaid runtime may remain — the `mermaid_check` gate enforces this.
   - **Restyle inline `<code>` to blend with the prose** — no background box or border, body-text colour, and not coloured like a link (this is a CSS change in the site's stylesheet; block code in `<pre>` keeps its box). The `inline_code_check` gate enforces this.
3. **Build the next phase.** Add this phase's page mix (see schedule), slotting pages into the existing hierarchy, each built to the same blueprint standard.
4. **Upgrade the homepage AND site navigation to reflect the new content.** This is mandatory every phase — new pages must not be left orphaned or unreachable:
   - **Navigation:** update the primary/header nav, footer, and any nav data/menu files (e.g. `_data/nav.*`, `_data/menu.*`, layout includes). Every section/topic area must be reachable from the nav; remove links to pages that no longer exist.
   - **Homepage:** refresh the hero, the section/topic cards, any "featured", "start here", "popular" or "latest" lists, and any counts/overview copy — surface the newly added sections and the strongest new pages.
   - **Site-wide:** ensure breadcrumbs and `sitemap.xml` include the new URLs, and wire the new pages in with the same wiki-style interlinking standard.
5. **Keep it niche-specific.** Section topics must be drawn from this niche, not generic placeholders.
6. **Remove internal IA/SEO terms from visible copy.** The words *pillar*, *cluster*, *long-tail* (and "hub and spoke", "supporting page", etc.) are internal labels — they must not appear in reader-facing prose. Scan and fix:

   ```bash
   python3 /home/martin/WebstormProjects/_qa/term_lint.py cad-gis-bim-interop.org
   ```
   (Legit domain uses of "cluster" — e.g. a Kafka/DB cluster — are fine; rewrite only the information-architecture sense.)
7. **Author custom SVG visuals** per the "Custom visuals" section, then **build the site and verify the SVGs render correctly ON THE PAGE** — the page's CSS/typography must not leak in and break them. Fix and rebuild until clean:

   ```bash
   cd /home/martin/WebstormProjects/cad-gis-bim-interop.org && npm run build
   python3 /home/martin/WebstormProjects/_qa/qa_gates.py cad-gis-bim-interop.org
   ```
   `qa_gates.py` runs every shared deterministic gate against the BUILT site and must report `ALL PASS`: term_lint (IA/SEO term leaks), svg_check (inline-SVG validity + hidden/overlapping/clipped/low-contrast labels), mermaid_check (no Mermaid left un-converted to SVG), inline_code_check (inline <code> blends with prose — no box/border, body colour, not link-like), a11y_check (FULL-PAGE WCAG 2 A/AA via axe-core — contrast, alt text, link names, lang, duplicate ids, heading order, keyboard-scrollable regions), links_check (internal links + anchors resolve), jsonld_check (structured-data validity), seo_meta_check (title/description/canonical/og/one-h1 + cross-page duplicates), render_check (no uncaught JS errors / broken same-origin assets), markup_lint (no unrendered markdown or template leakage), sitemap_check (sitemap ↔ built pages), dup_content_check (no near-duplicate article prose), and perf_check (Lighthouse mobile performance budget over a sampled set). Fix the site until every gate passes.
8. **Record completion** (re-runs `qa_gates` and will NOT advance the phase unless they all pass; then updates page/word count, advances current→next phase, and rewrites this plan ready for the next phase). From the Django project (`/home/martin/PycharmProjects/Django-Pillar-Cluster-Long-Tail`):

   ```bash
   .venv/bin/python manage.py finish_phase cad-gis-bim-interop.org --completed expansion \
       --blueprint "/home/martin/WebstormProjects/cad-gis-bim-interop.org/_plan/blueprint.json"
   ```
9. **Commit & deploy.** Build, deploy to Cloudflare, and push to GitHub:

   ```bash
   cd /home/martin/WebstormProjects/cad-gis-bim-interop.org
   npm run deploy          # build + wrangler deploy (auth from the site .env)
   git add -A && git commit -m "Upgrade to expansion phase" && git push
   ```

## QA refresh (uplift to standard — NO new phase)

Use this when you want to bring the site **fully up to the current standard and pass every gate, without building the next phase** — the site stays on its current phase (`foundation`).

### Automated (recommended)

Run **`/qa-refresh`** (or just say *"do a QA refresh"*) — it runs the `qa_refresh` workflow for this site, which performs everything below automatically: rewrites every page to standard (incl. hand-authored SVGs and Mermaid→SVG), restyles inline code + homepage + navigation, then builds, fixes until every gate passes, records the uplift and deploys. Direct call:

   ```
   Workflow({scriptPath: "/home/martin/WebstormProjects/_qa/qa_refresh_workflow.js", args: "cad-gis-bim-interop.org"})
   ```

### Manual (what the workflow does, step by step)

**`refresh_site` does NOT do the uplift for you — YOU must do the actual work first.** It is only the bookkeeping/verification step: it re-syncs counts, re-detects the phase (no advance), re-exports this plan, and runs `qa_gates`. It will **refuse to record the uplift unless every gate passes**, so you cannot mark a site "uplifted" without having genuinely rewritten the pages and fixed the SVGs.

Do the checklist above **but SKIP step 3 (Build the next phase)** — i.e. actually rewrite EVERY existing page to the blueprint (2: anatomy, frontmatter, schema, wiki interlinking, hand-authored SVGs, no Mermaid, blended inline code), update homepage & navigation (4), keep it niche-specific (5), term cleanup (6), and pass the SVG + `qa_gates` checks (7). Then record the refresh and deploy:

   ```bash
   .venv/bin/python manage.py refresh_site cad-gis-bim-interop.org \
       --blueprint "/home/martin/WebstormProjects/cad-gis-bim-interop.org/_plan/blueprint.json"
   cd /home/martin/WebstormProjects/cad-gis-bim-interop.org
   npm run deploy
   git add -A && git commit -m "QA refresh (foundation)" && git push
   ```

## Phase schedule

| # | Phase | Status | Adds | Target total | Focus |
|---|-------|--------|------|--------------|-------|
| 1 | 1. Foundation | ✅ done | 2-3 pillars + 10-14 clusters + 8-12 long-tails | ~22 | Establish core authority: the main pillars and their primary clusters, with enough long-tails to validate demand. Get a consistent page skeleton in place. |
| 2 | 2. Expansion | ➡️ NEXT | 1-2 pillars + 7-10 clusters + 18-25 long-tails | ~50 | Broaden coverage: fill out each pillar's clusters and add the high-intent long-tails around them. Strengthen interlinking between siblings. |
| 3 | 3. Maturity | … future | 4-6 clusters + 28-40 long-tails | ~82 | Deepen the long tail: comprehensive how-tos, comparisons and edge-case pages under existing clusters. Ensure FAQ blocks and schema on every page. |
| 4 | 4. Authority | … future | 2-3 clusters + 20-30 long-tails | ~105 | Complete topical authority: remaining gaps, advanced/expert pages, and a tight internal link graph so every page is 1-2 clicks from its pillar. |

## Priorities for the next phase (expansion)

- The python-parsing-geometry-extraction pillar has only 2 long-tail pages so far (reading-3d-solids-with-ezdxf-python, converting-cad-local-coordinates-to-epsg4326); each cluster (ezdxf-deep-dive, ifcopenshell-workflow, geometry-mesh-conversion, pydwg-integration) needs at least 3–4 long-tail how-to pages covering specific API tasks (e.g. 'Extracting LWPOLYLINE vertices with ezdxf', 'Batch converting IFC to GeoJSON with ifcopenshell')
- coordinate-transformation-spatial-alignment clusters (crs-normalization-workflows, unit-conversion-pipelines, scale-and-rotation-synchronization, layer-mapping-logic) each lack long-tail pages — add task-specific pages like 'Applying Helmert 7-parameter transform in Python' and 'Converting DXF millimeters to meters before pyproj reprojection'
- core-format-fundamentals-schema-mapping has ifc4x3-schema-mapping and metadata-extraction-strategies clusters with no visible long-tail pages — add format-specific long-tails covering IFC property set extraction, DXF XDATA parsing, and DWG-to-DXF batch conversion gotchas
- Add cross-pillar comparison/decision pages (cluster-level) covering 'Choosing between ezdxf, pydwg, and ODA for production pipelines' and 'DXF vs IFC as interchange format for GIS ingestion' — these serve high-intent navigational queries and link across all three pillars

## Page blueprint

_(tailored to this site)_

- **Frontmatter (every page):** title, description, slug, type, breadcrumb, datePublished, dateModified
- **Schema (JSON-LD):** Article, BreadcrumbList, HowTo, FAQPage
- **Interlinking:** Wiki-style inline cross-linking is mandatory. Rules: (1) Pillar pages — every named cluster topic (e.g. 'CRS Normalization Workflows', 'Layer Mapping Logic') becomes an inline hyperlink at its first mention in the prose, using anchor text that matches the cluster page title exactly; add 3–6 such inline links per pillar. (2) Cluster pages — link up to the parent pillar in the opening paragraph with phrasing such as 'as part of the [Coordinate Transformation & Spatial Alignment](/coordinate-transformation-spatial-alignment/) pipeline'; link sideways to sibling clusters and down to long-tail children at first mention. (3) Long-tail pages — link up to the parent cluster in the opening paragraph (e.g. 'consult the [ezdxf Deep Dive](/python-parsing-geometry-extraction/ezdxf-deep-dive/) for context'); link to at least one sibling long-tail and one pillar concept inline. (4) Every page ends with a 'Related' block (3–5 items, titled 'Related Pages') listing the parent, relevant siblings, and one cross-pillar link. No bare URL links; all anchors must use descriptive noun-phrase text drawn from the niche (library names, format names, workflow names).

### pillar pages  (~4500 words)
- H1: Full topic title — positions the domain problem (CAD/GIS/BIM context, why misalignment or parsing failures occur without this knowledge)
- Problem framing paragraph — concrete cost of getting this wrong (misaligned assets, corrupt spatial queries, CI/CD failures)
- ## Foundations — core concepts, standards bodies, format specs, or library ecosystem relevant to this pillar (with inline links to clusters)
- ## Pipeline Architecture — how this pillar fits as a stage in a broader Python interoperability pipeline; data-flow diagram (Mermaid) showing ingestion → transformation → validation → export
- ## Core Workflows — subsections (H3) for each major cluster topic, each subsection briefly characterizes the workflow and links to its cluster page
- ## Implementation Patterns & Code Safety — cross-cutting patterns: geometry validation, error isolation, memory management, vectorized ops; short runnable code snippet per pattern
- ## Validation, Tolerance & Troubleshooting — precision loss, tolerance configuration, common failure modes with root-cause table (format: symptom | cause | fix)
- ## Production Deployment Considerations — CI/CD integration, performance tuning, audit/compliance logging, fallback strategies
- ## Conclusion — synthesis paragraph reinforcing the pillar's role in reliable interoperability
- Related Pages block — 4–6 links (clusters within this pillar + one cross-pillar link)

### cluster pages  (~3500 words)
- H1: Cluster title — 1-sentence definition anchoring concept to parent pillar domain
- Context paragraph — explains where this cluster fits in the pipeline, up-link to parent pillar
- ## Prerequisites — bulleted checklist: Python version, library versions (pip install lines), assumed knowledge of CRS/entity types/format specifics
- ## Architectural Overview — how the cluster's mechanism works internally (e.g. group code taxonomy, affine matrix math, schema binding rules); compatibility/version table where applicable
- ## Step-by-Step Implementation — numbered procedural steps, each with a minimal runnable Python code block; mermaid flow diagram where logical branches exist
- ## Edge Cases & Gotchas — 3–6 named failure modes specific to this format/library/workflow (e.g. axis flip, ACIS encryption, missing $INSUNITS, datum ambiguity); each with a short fix snippet
- ## Validation & Testing — how to verify correctness (assertions, control-point checks, schema diff logging); example test function
- ## Performance & Scale — chunked processing, memory budgets, vectorization tips relevant to this specific cluster topic
- ## FAQ — 3–5 questions rendered as accordions; questions drawn from real format/library ambiguities (e.g. 'Does ezdxf reconstruct B-Rep topology?', 'What does $INSUNITS=2 mean?')
- Related Pages block — parent pillar up-link + 3–4 sibling/long-tail links

### long_tail pages  (~2000 words)
- H1: Specific task title phrased as an engineering action (e.g. 'Reading 3D Solids with ezdxf Python')
- TL;DR answer paragraph — 2–4 sentences giving the direct answer/solution upfront before any preamble; up-link to parent cluster
- ## How [Library/Format] Handles [Feature] — mechanism explanation (what happens internally, what the API does and does not do)
- ## Production-Ready Script — complete, copy-pasteable Python script with inline comments; key implementation notes bulleted below the block
- ## Compatibility Matrix — table: component | supported range | notes (Python version, library version, format version, OS, known limitations)
- ## Fallback Strategies / Troubleshooting — 3–5 ordered fallback steps or named error scenarios with concrete fixes; no generic advice
- Related Pages block — parent cluster up-link + 2–3 sibling long-tail or cluster links

> All code blocks must be Python 3.9+ compatible and use explicit library versions in comments (e.g. # ezdxf>=1.1.0). Mermaid diagrams should be used for pipeline data-flow and format-version branching logic. KaTeX should be used for any affine/Helmert matrix equations. FAQ sections must be rendered as HTML detail/summary accordions per the site requirements. Inline code spans (library names, variable names, file extensions) must not use borders — blend with prose per site requirements. Every long-tail page title should be phrased as a specific engineering action or question to maximize long-tail SEO capture. JSON-LD HowTo schema should be applied to all long-tail and cluster pages that contain step-by-step procedures. FAQPage schema applies only to pages with a genuine FAQ section.

## Custom visuals (SVG)

When upgrading or building any page, add a custom, hand-authored inline SVG wherever a visual would genuinely raise quality (architecture/data-flow diagrams, sequence or state diagrams, comparison matrices, timelines, annotated illustrations). Do NOT add decorative or generic stock-style images. Each SVG must: be original and specific to the page's content; match the site's existing design system (colours, fonts, stroke weight); be responsive (viewBox, no fixed pixel width) and accessible (<title>/<desc>, role="img", aria-label); and use currentColor / CSS variables so it adapts to light/dark themes. Prefer one strong diagram that explains the hardest concept on the page over many small ones. Pillar pages should almost always carry a top-level overview diagram. If the site has any Mermaid diagrams (```mermaid blocks, .mermaid containers, or a mermaid runtime), convert each one to a hand-authored inline SVG in this same style — no Mermaid should remain.
