/* Site-wide client JS:
   - Mobile nav toggle
   - Copy-to-clipboard for code blocks
   - Lazy mermaid initialization (only if a mermaid block is present)
   - Service worker registration
*/
(function () {
  "use strict";

  // --- Mobile nav toggle ---
  const toggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("[data-nav]");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", (e) => {
      if (!nav.contains(e.target) && !toggle.contains(e.target)) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  // --- Copy buttons ---
  document.querySelectorAll(".code-copy").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const block = btn.closest(".code-block");
      if (!block) return;
      const code = block.querySelector("pre code") || block.querySelector("pre");
      if (!code) return;
      const text = code.innerText.replace(/\s+$/g, "");
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = "Copied";
        btn.classList.add("is-copied");
        setTimeout(() => {
          btn.textContent = "Copy";
          btn.classList.remove("is-copied");
        }, 1600);
      } catch (err) {
        btn.textContent = "Press Ctrl+C";
        setTimeout(() => (btn.textContent = "Copy"), 1600);
      }
    });
  });

  // --- Toggleable task list checkboxes (markdown task lists) ---
  // markdown-it-task-checkbox emits non-disabled inputs already; just persist toggling visually
  document.querySelectorAll(".task-list-item input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const li = cb.closest(".task-list-item");
      if (!li) return;
      li.classList.toggle("is-checked", cb.checked);
    });
  });

  // --- Mermaid (lazy load only if needed) ---
  if (document.querySelector("pre.mermaid")) {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
    s.onload = () => {
      if (!window.mermaid) return;
      window.mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        themeVariables: {
          background: "#fbf8f3",
          primaryColor: "#e2ecf6",
          primaryTextColor: "#14202e",
          primaryBorderColor: "#1e3a5f",
          lineColor: "#2c5282",
          secondaryColor: "#d1f4ee",
          tertiaryColor: "#fdecd3",
          fontFamily: "Inter, system-ui, sans-serif"
        }
      });
      window.mermaid.run({ querySelector: "pre.mermaid" }).catch(() => {});
    };
    document.head.appendChild(s);
  }

  // --- Service worker ---
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
})();
