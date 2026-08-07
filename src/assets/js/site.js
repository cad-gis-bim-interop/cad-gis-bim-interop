/* Site-wide client JS:
   - Theme toggle (light/dark, persisted)
   - Mobile nav toggle
   - Copy-to-clipboard for code blocks
   - Service worker registration
*/
(function () {
  "use strict";

  // --- Theme toggle ---
  // The <head> script has already stamped data-theme before first paint; this only
  // has to flip it, label the control, and remember the choice. Once the visitor
  // chooses, their choice outranks the OS preference on every later visit.
  const themeBtn = document.querySelector("[data-theme-toggle]");
  if (themeBtn) {
    const label = (theme) => {
      const next = theme === "dark" ? "light" : "dark";
      themeBtn.setAttribute("aria-label", "Switch to " + next + " theme");
      themeBtn.setAttribute("title", "Switch to " + next + " theme");
      themeBtn.setAttribute("aria-pressed", String(theme === "dark"));
    };
    label(document.documentElement.getAttribute("data-theme") || "light");
    themeBtn.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      label(next);
      try { localStorage.setItem("theme", next); } catch (e) { /* private mode */ }
    });
  }

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

  // --- Service worker ---
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
})();
