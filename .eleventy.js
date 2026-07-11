const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const markdownIt = require("markdown-it");
const mdAnchor = require("markdown-it-anchor");
const mdAttrs = require("markdown-it-attrs");
const mdFootnote = require("markdown-it-footnote");
const mdKatex = require("markdown-it-katex");
const mdTaskCheckbox = require("markdown-it-task-checkbox");

const SITE = require("./src/_data/site.js");

function looksLikeAsciiDiagram(src) {
  if (!src) return false;
  const lines = src.split("\n").filter(Boolean);
  if (lines.length < 3) return false;
  // High density of box-drawing / pipe / arrow chars and no obvious code
  const drawChars = (src.match(/[│┃|▼▲►◄→←↓↑┌┐└┘├┤┬┴┼─━╔╗╚╝═║▶◀]/g) || []).length;
  const codeyChars = (src.match(/[;{}=()]/g) || []).length;
  return drawChars >= 4 && drawChars > codeyChars;
}

function asciiToMermaid(src) {
  // Convert a vertical box/arrow ASCII diagram into a mermaid flowchart.
  // Heuristic: each bracketed/non-pipe line becomes a node, vertical bars / arrows imply edges.
  const rawLines = src.split("\n").map(l => l.trim()).filter(Boolean);
  const nodes = [];
  for (const line of rawLines) {
    if (/^[│|▼▲↓↑v^\s]+$/.test(line)) continue;
    // strip leading [n] markers; keep label
    const label = line
      .replace(/^\[?\d+\]?\s*/, "")
      .replace(/[│|]/g, "")
      .replace(/[┌┐└┘├┤┬┴┼─━╔╗╚╝═║]/g, "")
      .trim();
    if (label) nodes.push(label);
  }
  if (nodes.length < 2) return null;
  const ids = nodes.map((_, i) => `n${i}`);
  const defs = nodes.map((label, i) => `  ${ids[i]}["${label.replace(/"/g, "'")}"]`).join("\n");
  const edges = ids.slice(0, -1).map((id, i) => `  ${id} --> ${ids[i + 1]}`).join("\n");
  return `flowchart TD\n${defs}\n${edges}`;
}

module.exports = function (eleventyConfig) {
  // Plugins
  eleventyConfig.addPlugin(syntaxHighlight, {
    preAttributes: { tabindex: 0 }
  });

  // Markdown
  const md = markdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: false
  })
    .use(mdAttrs)
    .use(mdAnchor, {
      permalink: mdAnchor.permalink.headerLink({
        class: "anchor-link",
        safariReaderFix: true
      }),
      level: [2, 3, 4],
      slugify: (s) =>
        String(s)
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
    })
    .use(mdFootnote)
    .use(mdKatex, { throwOnError: false, errorColor: "#c2410c" })
    .use(mdTaskCheckbox, {
      disabled: false,
      divWrap: false,
      ulClass: "task-list",
      liClass: "task-list-item"
    });

  // Fenced code rendering. NOTE: Mermaid is intentionally NOT emitted — the site's
  // QA gate (mermaid_check) forbids any client-side Mermaid; all diagrams must be
  // hand-authored inline SVGs. So both explicit ```mermaid fences and the former
  // ASCII-diagram auto-conversion are disabled; every fence renders as a normal,
  // copy-button-wrapped code block.
  const defaultFence = md.renderer.rules.fence.bind(md.renderer.rules);
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const info = (token.info || "").trim().toLowerCase();

    // Default: pass through to syntax highlighter wrapped in a copy-button-aware container
    const rendered = defaultFence(tokens, idx, options, env, self);
    const lang = info.split(/\s+/)[0] || "text";
    return `<div class="code-block" data-lang="${md.utils.escapeHtml(lang)}"><button type="button" class="code-copy" aria-label="Copy code">Copy</button>${rendered}</div>`;
  };

  // Wrap tables in a horizontally scrollable container
  const defaultTableOpen = md.renderer.rules.table_open || ((t, i, o, e, s) => s.renderToken(t, i, o));
  const defaultTableClose = md.renderer.rules.table_close || ((t, i, o, e, s) => s.renderToken(t, i, o));
  md.renderer.rules.table_open = (tokens, idx, options, env, self) =>
    `<div class="table-wrap">${defaultTableOpen(tokens, idx, options, env, self)}`;
  md.renderer.rules.table_close = (tokens, idx, options, env, self) =>
    `${defaultTableClose(tokens, idx, options, env, self)}</div>`;

  // Render FAQ-style ## headings as accordions: a heading literally named "FAQ" or
  // "Frequently Asked Questions" turns each following ### into <details>.
  // Implemented as a postprocess step via transform below.

  eleventyConfig.setLibrary("md", md);

  // Filters
  eleventyConfig.addFilter("absoluteUrl", (path) => {
    if (!path) return SITE.url;
    if (path.startsWith("http")) return path;
    return `${SITE.url}${path.startsWith("/") ? path : "/" + path}`;
  });

  eleventyConfig.addFilter("year", () => new Date().getFullYear());

  eleventyConfig.addFilter("sitemapPriority", (url) => {
    if (!url || url === "/") return "1.0";
    const depth = url.split("/").filter(Boolean).length;
    if (depth === 1) return "0.8";
    if (depth === 2) return "0.7";
    return "0.6";
  });

  eleventyConfig.addFilter("toISODate", (d) => {
    const dt = d instanceof Date ? d : new Date(d || Date.now());
    return dt.toISOString();
  });

  eleventyConfig.addFilter("toISODateShort", (d) => {
    const dt = d instanceof Date ? d : new Date(d || Date.now());
    return dt.toISOString().slice(0, 10);
  });

  eleventyConfig.addFilter("breadcrumb", (url) => {
    if (!url || url === "/") return [];
    const parts = url.split("/").filter(Boolean);
    const crumbs = [];
    let acc = "";
    for (const p of parts) {
      acc += "/" + p;
      crumbs.push({ slug: p, url: acc + "/" });
    }
    return crumbs;
  });

  eleventyConfig.addFilter("titleize", (slug) => {
    let s = String(slug || "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    // Lowercase joining/stop words (but keep first/last word capitalised)
    const stops = new Set(["A", "An", "And", "As", "At", "For", "From", "In", "Of", "On", "Or", "The", "To", "With"]);
    s = s
      .split(" ")
      .map((w, i, arr) => (i > 0 && i < arr.length - 1 && stops.has(w) ? w.toLowerCase() : w))
      .join(" ");

    // Technical acronym fix-ups
    return s
      .replace(/\bIfc4x3\b/gi, "IFC4x3")
      .replace(/\bIfc\b/gi, "IFC")
      .replace(/\bDxf\b/gi, "DXF")
      .replace(/\bDwg\b/gi, "DWG")
      .replace(/\bGis\b/gi, "GIS")
      .replace(/\bCad\b/gi, "CAD")
      .replace(/\bBim\b/gi, "BIM")
      .replace(/\bCrs\b/gi, "CRS")
      .replace(/\b3d\b/gi, "3D")
      .replace(/\b2d\b/gi, "2D")
      .replace(/\bEzdxf\b/gi, "ezdxf")
      .replace(/\bIfcopenshell\b/gi, "IFCOpenShell")
      .replace(/\bPydwg\b/gi, "pyDWG")
      .replace(/\bPython\b/gi, "Python")
      .replace(/\bEpsg4326\b/gi, "EPSG:4326")
      .replace(/\bGeojson\b/gi, "GeoJSON");
  });

  // Sibling pages (for related links)
  eleventyConfig.addFilter("siblingsOf", (collection, currentUrl) => {
    if (!collection || !currentUrl) return [];
    const parts = currentUrl.split("/").filter(Boolean);
    if (parts.length < 1) return [];
    const parent = "/" + parts.slice(0, -1).join("/") + "/";
    return collection
      .filter((p) => p.url !== currentUrl && p.url.startsWith(parent))
      .filter((p) => {
        const rest = p.url.slice(parent.length).replace(/\/$/, "");
        return rest && !rest.includes("/");
      });
  });

  // Children of a section
  eleventyConfig.addFilter("childrenOf", (collection, sectionUrl) => {
    if (!collection || !sectionUrl) return [];
    return collection.filter((p) => {
      if (!p.url.startsWith(sectionUrl) || p.url === sectionUrl) return false;
      const rest = p.url.slice(sectionUrl.length).replace(/\/$/, "");
      return rest && !rest.includes("/");
    });
  });

  // Collections
  eleventyConfig.addCollection("allPages", (api) =>
    api.getFilteredByGlob("src/**/*.md").sort((a, b) => a.url.localeCompare(b.url))
  );

  // FAQ accordion transform — convert ## FAQ / Frequently Asked Questions blocks
  eleventyConfig.addTransform("faqAccordion", function (content) {
    if (!this.page.outputPath || !this.page.outputPath.endsWith(".html")) return content;

    return content.replace(
      /<h2([^>]*)>(\s*(?:FAQ|Frequently Asked Questions)\s*[^<]*)<\/h2>([\s\S]*?)(?=<h2[\s>]|<\/main>)/gi,
      (match, h2attrs, h2text, body) => {
        // Within body, convert <h3>Question</h3><answer until next h3> into <details>
        const accordion = body.replace(
          /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3[\s>]|$)/g,
          (m, q, a) =>
            `<details class="faq-item"><summary>${q.trim()}</summary><div class="faq-answer">${a.trim()}</div></details>`
        );
        return `<h2${h2attrs}>${h2text}</h2><div class="faq-accordion">${accordion}</div>`;
      }
    );
  });

  // Ensure hand-authored FAQ <details> get the accordion class the site CSS targets,
  // so a bare <details> written in markdown still renders as a styled disclosure widget.
  eleventyConfig.addTransform("faqDetailsClass", function (content) {
    if (!this.page.outputPath || !this.page.outputPath.endsWith(".html")) return content;
    let out = content.replace(/<details(?![^>]*\bclass=)/g, '<details class="faq-item"');
    // Wrap <summary> content in a single <span> so an inline <code>/<strong> inside the
    // question does not fragment the flex row (question left, disclosure marker right).
    out = out.replace(/<summary>([\s\S]*?)<\/summary>/g, (m, inner) =>
      /^\s*<span\b/.test(inner) ? m : `<summary><span class="faq-q">${inner.trim()}</span></summary>`
    );
    return out;
  });

  // Callout / admonition transform — convert blockquotes whose first inline
  // content begins with `**Note:**`, `**Tip:**`, `**Warning:**`, `**Important:**`,
  // or `**Caution:**` into a styled <aside class="callout callout--{kind}">.
  eleventyConfig.addTransform("calloutBlocks", function (content) {
    if (!this.page.outputPath || !this.page.outputPath.endsWith(".html")) return content;

    const KINDS = {
      note: "note",
      tip: "tip",
      info: "tip",
      warning: "warning",
      caution: "warning",
      important: "important",
      danger: "danger"
    };

    return content.replace(
      /<blockquote>\s*<p>\s*<strong>([A-Za-z]+):<\/strong>\s*([\s\S]*?)<\/blockquote>/g,
      (match, label, body) => {
        const kind = KINDS[label.toLowerCase()];
        if (!kind) return match;
        // body may end with `</p>` or `</p>\n` (most common) — strip it so we
        // can re-wrap consistently with `<p>...</p>` inside the callout body.
        const innerHtml = body.replace(/<\/p>\s*$/, "");
        return `<aside class="callout callout--${kind}" role="note"><div class="callout__label">${label}</div><div class="callout__body"><p>${innerHtml}</p></div></aside>`;
      }
    );
  });

  // On-this-page table of contents — inject a TOC right after the first <h1>
  // when the page has 3+ <h2> headings. Pulls headings + their anchor ids from
  // markdown-it-anchor's output.
  eleventyConfig.addTransform("inlineTOC", function (content) {
    if (!this.page.outputPath || !this.page.outputPath.endsWith(".html")) return content;
    if (this.page.url === "/") return content;

    const h2Re = /<h2[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g;
    const items = [];
    let m;
    while ((m = h2Re.exec(content)) !== null) {
      const id = m[1];
      // Strip nested tags from heading text (e.g. anchor link icon)
      const text = m[2].replace(/<[^>]+>/g, "").trim();
      if (text) items.push({ id, text });
    }
    if (items.length < 3) return content;

    const list = items.map((i) => `<li><a href="#${i.id}">${i.text}</a></li>`).join("");
    const toc = `<nav class="page-toc" aria-labelledby="page-toc-label"><div class="page-toc__head" id="page-toc-label">On this page</div><ol class="page-toc__list">${list}</ol></nav>`;

    return content.replace(/(<h1\b[\s\S]*?<\/h1>)/, `$1\n${toc}`);
  });

  // Passthrough
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/manifest.webmanifest": "manifest.webmanifest" });
  eleventyConfig.addPassthroughCopy({ "src/sw.js": "sw.js" });
  eleventyConfig.addPassthroughCopy({ "src/favicon.svg": "favicon.svg" });
  eleventyConfig.addPassthroughCopy({ "src/favicon.ico": "favicon.ico" });
  eleventyConfig.addPassthroughCopy({ "src/robots.txt": "robots.txt" });
  eleventyConfig.addPassthroughCopy({ "src/b0d5ef9a1b864153a4ae7cdf8901b591.txt": "b0d5ef9a1b864153a4ae7cdf8901b591.txt" });

  // Watch CSS/JS
  eleventyConfig.addWatchTarget("src/assets/");

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "md", "html"]
  };
};
