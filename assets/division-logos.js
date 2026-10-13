// DIV-LOGOS: render approved compact division identities from the canonical manifest.
// Adding a division logo requires updating the manifest and assets only; this page stays unchanged.
(() => {
  "use strict";

  const manifestUrl = "./_shared/manifest.json";
  const assetUrl = path => "../../" + path;

  function renderLogo(card, division) {
    const asset = division.visualAsset;
    if (!asset?.compact?.webp || !asset?.compact?.png ||
        !asset?.["compact-dark"]?.webp || !asset?.["compact-dark"]?.png) return;

    const frame = card.querySelector(".app-competition-logo-placeholder");
    if (!frame) return;

    const picture = document.createElement("picture");
    const source = document.createElement("source");
    const img = document.createElement("img");
    const lightWebp = assetUrl(asset.compact.webp);
    const darkWebp = assetUrl(asset["compact-dark"].webp);
    const lightPng = assetUrl(asset.compact.png);
    const darkPng = assetUrl(asset["compact-dark"].png);
    const isLight = document.documentElement.dataset.theme === "light";

    picture.dataset.divisionLogo = "";
    picture.dataset.lightWebp = lightWebp;
    picture.dataset.darkWebp = darkWebp;
    picture.dataset.lightPng = lightPng;
    picture.dataset.darkPng = darkPng;
    source.type = "image/webp";
    source.srcset = isLight ? lightWebp : darkWebp;
    img.src = isLight ? lightPng : darkPng;
    img.width = 36;
    img.height = 36;
    img.alt = "";
    img.decoding = "async";
    picture.append(source, img);

    frame.replaceChildren(picture);
    frame.classList.add("app-competition-logo-approved");
  }

  async function init() {
    const cards = [...document.querySelectorAll(".app-division-card[href]")];
    if (!cards.length) return;

    try {
      const response = await fetch(manifestUrl, { cache: "no-cache" });
      if (!response.ok) throw new Error("Division manifest request failed");
      const manifest = await response.json();
      if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.divisions)) return;

      const divisions = new Map(
        manifest.divisions
          .filter(division => division && typeof division.id === "string")
          .map(division => [division.id.toLowerCase(), division])
      );

      for (const card of cards) {
        const match = card.getAttribute("href")?.match(/^\.\/([a-z]{2,3}-[12])\/$/i);
        if (!match) continue;
        const division = divisions.get(match[1].toLowerCase());
        if (division) renderLogo(card, division);
      }
    } catch (error) {
      // Keep the existing division-code placeholders when the manifest is unavailable.
      console.warn("Division logos could not be loaded from the manifest.", error);
    }
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else
    init();
})();
