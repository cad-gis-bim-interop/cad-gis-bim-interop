# Build Checklist — cad-gis-bim-interop.org

A staged checklist for generating the **Python for CAD/GIS & BIM Interoperability Pipelines** static site with 11ty. Each step is small, verifiable, and unblocks the next.

## Step 1 — Project scaffolding & tooling

- [x] Create `package.json` with 11ty + needed markdown-it plugins (anchor, attrs, footnote, katex, task-lists) and syntax highlighting.
- [x] Add npm scripts (`start`, `build`, `clean`).
- [x] Create `.gitignore` (node_modules, _site, build artifacts, OS noise, editor files).
- [x] Create `.eleventy.js` configuration: input `src`, output `_site`, copy passthroughs for assets, configure markdown-it with the plugins above, register filters (date, titleize, breadcrumbs, siblingsOf, childrenOf), and a transform that detects ASCII diagrams in fenced code blocks and converts them to mermaid blocks.
- [x] Create directory layout: `src/`, `src/_includes/layouts`, `src/_includes/partials`, `src/_data`, `src/assets/css`, `src/assets/js`, `src/assets/icons`.

## Step 2 — Design system (color, typography, layout)

- [x] Pick a light AEC-themed palette (deep slate-blue primary, terracotta accent, teal highlight, warm off-white surface, dark slate text).
- [x] Create `src/assets/css/tokens.css` with CSS custom properties for colors, spacing scale, radii, shadows, typography.
- [x] Create `src/assets/css/base.css` with resets, base typography, link styles + hover, scroll-padding-top equal to header height for in-page anchors.
- [x] Create `src/assets/css/layout.css` with widescreen-friendly container (max-width wide, fluid padding), grid utilities, responsive breakpoints (mobile ≤640, tablet ≤1024, desktop ≥1280, ultrawide ≥1600).
- [x] Create `src/assets/css/components.css` with header, hero, cards, breadcrumbs, code, tables, accordion (FAQ), checkboxes (rendered task-list w/ line-through and no dot), inline-code chip.

## Step 3 — Brand assets (logo, favicons, manifest)

- [x] Design custom SVG logo (CAD/GIS/BIM motif: layered grid + node + curve), colorful, scalable, suitable as both logo and favicon.
- [x] Generate favicons: `favicon.svg`, `favicon.ico` (via `magick` from PNGs), `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable.png`.
- [x] Write `manifest.webmanifest` (name, short_name, theme/background colors, icons, display=standalone, start_url=/, scope=/).
- [x] Add Apple PWA meta tags and Web App Manifest link in base layout `<head>`.

## Step 4 — Service worker & PWA

- [x] Create `src/sw.js` with cache-first for static assets, network-first for HTML, versioned cache name.
- [x] Register the service worker from `assets/js/site.js` (only when served over HTTPS).
- [x] Service worker pre-caches the home shell so the header, footer, and core CSS work offline.

## Step 5 — Base layout & partials

- [x] Create `src/_includes/layouts/base.njk`: `<head>` (SEO meta, OG, canonical, theme-color, manifest, favicons, KaTeX CSS), sticky header, main, footer, JSON-LD, scripts (copy-button, mermaid, sw register).
- [x] Create `src/_includes/partials/header.njk`: logo + site name, nav links with icons (Home, sections), `aria-current` for active page, hamburger for mobile, sticky behavior.
- [x] Create `src/_includes/partials/footer.njk`: section + child links, copyright; sticks to viewport bottom on short pages via flex layout on `<body>`.
- [x] Create `src/_includes/partials/breadcrumbs.njk`: builds chain from URL segments and applies `titleize`.
- [x] Create `src/_includes/partials/related.njk`: shows sibling pages within current section.
- [x] Create `src/_includes/layouts/content.njk`: wraps `base.njk`, adds breadcrumbs + prose container + related links.

## Step 6 — Content pipeline

- [x] Copy `content/**` into `src/` preserving structure so 11ty emits clean URLs.
- [x] Add a directory JSON data file per section to set `layout` and `tags`.
- [x] Configure markdown rendering:
  - [x] Anchor headers with offset-aware in-page links (`scroll-margin-top` + `scroll-padding-top` on `html`).
  - [x] Task-list checkboxes rendered as toggleable controls (no `<li>` bullet, line-through when checked).
  - [x] Inline code styled subtle (no border, soft tint matching code-block background).
  - [x] Fenced code blocks: syntax-highlighted (Prism via 11ty plugin), copy-to-clipboard button, light background matching palette.
  - [x] Tables wrapped in a horizontally scrollable container, styled.
  - [x] FAQ / Frequently Asked Questions sections converted to `<details>` accordions via a post-render transform.
  - [x] KaTeX rendering enabled for `$...$` / `$$...$$` math.
  - [x] Mermaid: fences labeled `mermaid` (and ASCII diagrams transformed in step 1) render client-side with a palette-matched theme (lazy-loaded only when needed).

## Step 7 — Front page

- [x] Build `src/index.njk` with:
  - [x] Big standalone SVG logo on its own line.
  - [x] Hero eyebrow, gradient headline, 2–3 paragraph lede.
  - [x] CTA button row with colorful icons linking to the three top-level sections.
  - [x] "Browse the content" card grid summarizing each section + child pages with hover lift.
  - [x] SEO meta (description, keywords, og:image = icon-512.png).

## Step 8 — Content pages QA

- [x] Verify every code block is syntactically valid for its language (Python, bash, JSON). Source content already validated indentation.
- [x] Verify all internal links resolve to a built page; external links left intact (already in source content per spec).
- [x] Spot-check ASCII diagram on `/python-parsing-geometry-extraction/` → renders as a mermaid `<pre class="mermaid">flowchart TD …</pre>`.
- [x] Spot-check syntax highlighting, copy button container, breadcrumbs, related links, table-wrap, page titles with acronyms (`IFC`, `EPSG:4326`, `3D`, `ezdxf`).
- [x] Verify breadcrumbs + related links on a depth-4 leaf page (`/python-parsing-geometry-extraction/ezdxf-deep-dive/reading-3d-solids-with-ezdxf-python/`).

## Step 9 — Build, smoke-test, finalize

- [x] Run `npm install` (233 packages) and `npm run build` (`npx @11ty/eleventy --quiet`). Writes 26 HTML files + 19 passthrough assets.
- [x] Confirm `_site` contains: every content URL, `manifest.webmanifest`, `sw.js`, favicons, CSS chain (main → tokens/base/layout/components), JS.
- [x] Smoke-test dev server (`--serve --port=8181`): `/`, leaf page, `/assets/css/main.css`, `/manifest.webmanifest`, `/sw.js`, `/favicon.svg` all return HTTP 200.
- [x] Mark each checkbox above as complete.
