// UI-THEME #96 — shared, dark-default preference loaded before CSS.
(() => {
  "use strict";
  const KEY = "football-architect:theme";
  const valid = value => value === "light" ? "light" : "dark";
  let theme = "dark";
  try { theme = valid(window.localStorage.getItem(KEY)); }
  catch { /* Storage can be unavailable in private browsing. */ }
  function paint(value) {
    theme = valid(value);
    document.documentElement.setAttribute("data-theme", theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#F4F7F4" : "#101A1D");
    for (const button of document.querySelectorAll("[data-theme-choice]"))
      button.setAttribute("aria-pressed", String(button.dataset.themeChoice === theme));
    for (const img of document.querySelectorAll(".brand-image, .app-brand-symbol")) {
      const src = img.getAttribute("src");
      if (src && /-(?:dark|light)\.svg$/.test(src))
        img.setAttribute("src", src.replace(/-(?:dark|light)\.svg$/, "-" + theme + ".svg"));
    }
  }
  // Parser-blocking in <head>: theme is set before stylesheets are parsed.
  paint(theme);
  function ready() {
    paint(theme);
    for (const button of document.querySelectorAll("[data-theme-choice]"))
      button.addEventListener("click", () => {
        paint(button.dataset.themeChoice);
        try { window.localStorage.setItem(KEY, theme); }
        catch { /* Theme remains active in the current document. */ }
      });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready, {once:true});
  else ready();
  window.addEventListener("storage", event => {
    if (event.key === KEY) paint(event.newValue);
  });
})();
