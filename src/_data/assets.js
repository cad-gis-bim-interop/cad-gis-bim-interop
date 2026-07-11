const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

// Content-hash first-party assets so their URLs change when the bytes change.
// This defeats the service worker's stale cache after deploys (no more hard-refresh).
function hash(rels) {
  try {
    const h = createHash("sha1");
    for (const rel of [].concat(rels)) {
      h.update(readFileSync(join(__dirname, "..", rel)));
    }
    return h.digest("hex").slice(0, 10);
  } catch {
    return String(Date.now());
  }
}

module.exports = {
  // main.css @imports tokens/base/layout/components — hash all so any change busts the URL.
  css: hash([
    "assets/css/main.css",
    "assets/css/tokens.css",
    "assets/css/base.css",
    "assets/css/layout.css",
    "assets/css/components.css"
  ]),
  js: hash("assets/js/site.js")
};
