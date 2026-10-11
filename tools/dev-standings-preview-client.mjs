// DEV-only browser enhancement injected in memory by the loopback server.
// This file must never be copied into a public artifact or loaded by public HTML.
import { createPreviewStandings } from "./standings-data.mjs";

const FLAG = "football-architect:standings-dev-preview";
const DETAIL = /^\/app\/competitions\/([a-z]{2,3}-[12])\/(?:index\.html)?$/;
const LANG = {
  en: { badge: "DEV PREVIEW — fictional results", exit: "Exit preview", round: "Matchday",
    home: "Home", away: "Away", W: "Win", D: "Draw", L: "Loss",
    recent: "latest match", caption: "Fictional local development standings and recent form." },
  de: { badge: "DEV-VORSCHAU — fiktive Ergebnisse", exit: "Vorschau beenden", round: "Spieltag",
    home: "Heim", away: "Auswärts", W: "Sieg", D: "Remis", L: "Niederlage",
    recent: "letztes Spiel", caption: "Fiktive lokale Entwicklungstabelle und Form." },
  es: { badge: "VISTA DEV — resultados ficticios", exit: "Cerrar vista previa", round: "Jornada",
    home: "Local", away: "Visitante", W: "Victoria", D: "Empate", L: "Derrota",
    recent: "último partido", caption: "Clasificación local ficticia de desarrollo y forma reciente." },
  fr: { badge: "APERÇU DEV — résultats fictifs", exit: "Quitter l'aperçu", round: "Journée",
    home: "Domicile", away: "Extérieur", W: "Victoire", D: "Nul", L: "Défaite",
    recent: "dernier match", caption: "Classement fictif de développement local et forme récente." },
  it: { badge: "ANTEPRIMA DEV — risultati fittizi", exit: "Esci dall'anteprima", round: "Giornata",
    home: "Casa", away: "Trasferta", W: "Vittoria", D: "Pareggio", L: "Sconfitta",
    recent: "ultima partita", caption: "Classifica fittizia locale di sviluppo e forma recente." }
};
const validPath = location.pathname.match(DETAIL);
const params = new URLSearchParams(location.search);
const toggle = params.get("standingsPreview");
if (validPath && (toggle === "on" || toggle === "off")) {
  try {
    if (toggle === "on") sessionStorage.setItem(FLAG, "on");
    else sessionStorage.removeItem(FLAG);
  } catch { /* Unavailable storage is fail-closed. */ }
  params.delete("standingsPreview");
  const query = params.toString();
  history.replaceState(history.state, "", location.pathname +
    (query ? "?" + query : "") + location.hash);
}
let enabled = false;
try { enabled = sessionStorage.getItem(FLAG) === "on"; } catch { /* fail closed */ }
if (validPath && enabled) boot(validPath[1].toUpperCase());

function strings() { return LANG[document.documentElement.lang] || LANG.en; }
function node(tag, className = "", value = "") {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = value;
  return el;
}
function waitForRows() {
  return new Promise((resolve, reject) => {
    let done = false;
    const table = () => {
      const tbody = document.getElementById("app-standings-body");
      if (tbody?.rows.length === 20 && document.querySelector(".app-world-standing-table")) {
        finish(null, tbody);
      }
    };
    const observer = new MutationObserver(table);
    const timer = setTimeout(() => finish(Error("Standings hydration timeout")), 7000);
    function finish(error, body) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      observer.disconnect();
      if (error) reject(error);
      else resolve(body);
    }
    observer.observe(document.documentElement, { childList: true, subtree: true });
    table();
  });
}

async function boot(routeId) {
  try {
    const response = await fetch("/app/competitions/_shared/manifest.json",
      { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) throw Error("DEV manifest unavailable");
    const manifest = await response.json();
    if (manifest.schemaVersion !== 1 || manifest.approved !== false ||
        !Array.isArray(manifest.divisions) || manifest.divisions.length !== 16 ||
        manifest.divisions.reduce((n, d) => n + d.clubs?.length, 0) !== 320) {
      throw Error("Invalid DEV manifest");
    }
    const division = manifest.divisions.find(d => d.id === routeId);
    if (!division) throw Error("Unknown DEV division");
    const { rows, clubs } = createPreviewStandings(division);
    const tbody = await waitForRows();
    const originalIds = new Set([...tbody.rows].map(x => x.dataset.worldClub));
    if (originalIds.size !== 20 || rows.some(r =>
      !originalIds.has(r.club.countryId + "-" + r.club.clubId))) {
      throw Error("DEV standings identities mismatch");
    }

    // Construct the entire table detached. Inconsistencies cannot partly alter the UI.
    const fragment = document.createDocumentFragment();
    const entries = [];
    rows.forEach((r, position) => {
      const tr = node("tr");
      tr.dataset.worldClub = r.club.countryId + "-" + r.club.clubId;
      const value = (text, cls = "app-world-stat-value") => {
        const td = node("td", cls, String(text));
        tr.appendChild(td);
        return td;
      };
      value(position + 1);
      const clubCell = node("th", "app-world-standing-club");
      clubCell.scope = "row";
      const identity = node("span", "app-world-club-identity");
      const crest = node("span", "app-world-club-crest-placeholder");
      crest.dataset.clubCrest = tr.dataset.worldClub;
      crest.setAttribute("aria-hidden", "true");
      identity.append(crest, node("span", "app-world-club-name", r.club.primaryName));
      clubCell.append(identity);
      tr.append(clubCell);
      for (const number of [r.played, r.won, r.drawn, r.lost, r.gf, r.ga,
        r.gd > 0 ? "+" + r.gd : r.gd, r.pts]) value(number);
      const formCell = node("td");
      const strip = node("span", "app-world-form-strip");
      for (const [index, game] of r.recent.entries()) {
        const button = node("button", "app-world-form-dot app-world-form-" +
          game.result.toLowerCase() + (index === 0 ? " app-world-form-last" : ""),
          game.result);
        button.type = "button";
        entries.push({ button, game, ownId: r.club.clubId, latest: index === 0 });
        strip.append(button);
      }
      formCell.append(strip);
      tr.append(formCell);
      fragment.append(tr);
    });
    if (entries.length !== 100 || fragment.childNodes.length !== 20) {
      throw Error("Incomplete DEV standings rendering");
    }

    const caption = document.getElementById("app-standings-caption");
    if (!caption) throw Error("Missing standings caption");
    const toolbar = node("div", "fa-dev-preview-toolbar");
    const badge = node("strong", "fa-dev-preview-label");
    const exit = node("button", "fa-dev-preview-exit");
    exit.type = "button";
    toolbar.append(badge, exit);
    const style = node("style");
    style.textContent = `
      .fa-dev-preview-toolbar{display:flex;gap:12px;align-items:center;justify-content:space-between;
        margin:0 0 12px;padding:9px 12px;border:1px solid #537369;border-radius:10px;
        background:#193438;color:#f2f7f4;font-size:12px}
      .fa-dev-preview-label{letter-spacing:.03em}
      .fa-dev-preview-exit{border:1px solid #759a8c;border-radius:6px;background:transparent;
        color:inherit;padding:5px 9px;font:inherit;cursor:pointer}
      .fa-dev-preview-exit:focus-visible{outline:2px solid #b9e6d5;outline-offset:2px}
    `;
    const parent = document.querySelector(".app-world-standings");
    if (!parent) throw Error("Missing standings layout");

    const tooltip = node("div", "app-world-form-tooltip");
    tooltip.setAttribute("role", "tooltip");
    tooltip.id = "fa-dev-form-tooltip";
    tooltip.hidden = true;
    const meta = node("div", "app-world-form-tooltip-meta");
    const round = node("span", "app-world-form-tooltip-round");
    const roundLabel = node("span");
    const roundNumber = node("strong");
    round.append(roundLabel, roundNumber);
    meta.append(round);
    const scoreline = node("div", "app-world-form-tooltip-scoreline");
    const homeName = node("span", "app-world-form-tooltip-team");
    const score = node("strong", "app-world-form-tooltip-score");
    const awayName = node("span", "app-world-form-tooltip-team");
    scoreline.append(homeName, score, awayName);
    const context = node("div", "app-world-form-tooltip-context");
    const perspective = node("span");
    context.append(perspective);
    tooltip.append(meta, scoreline, context);
    const lookup = new Map(clubs.map(c => [c.clubId, c]));
    let active = null;
    let selected = null;
    let pressedWhenOpen = false;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    function close() {
      active?.button.removeAttribute("aria-describedby");
      active = null;
      tooltip.setAttribute("aria-hidden", "true");
      if (reduced || tooltip.hidden) {
        tooltip.className = "app-world-form-tooltip";
        tooltip.hidden = true;
      } else {
        tooltip.className = "app-world-form-tooltip is-closing";
      }
    }
    tooltip.addEventListener("animationend", e => {
      if (e.target === tooltip && e.animationName === "app-world-tooltip-out" && !active) {
        tooltip.hidden = true;
        tooltip.className = "app-world-form-tooltip";
      }
    });
    function place() {
      if (!active || tooltip.hidden) return;
      const rect = active.button.getBoundingClientRect();
      const width = innerWidth, height = innerHeight;
      const topbarBottom = Math.max(0,
        document.querySelector(".fa-shell-topbar")?.getBoundingClientRect().bottom ?? 0);
      const topLimit = Math.max(8, topbarBottom + 8), bottomLimit = height - 8;
      const w = tooltip.offsetWidth || 300, h = tooltip.offsetHeight || 124;
      if (rect.bottom <= topbarBottom || rect.top >= height || rect.right <= 0 ||
          rect.left >= width || bottomLimit - topLimit < h) return close();
      const left = Math.max(8, Math.min(rect.left + rect.width / 2 - w / 2, width - w - 8));
      const above = rect.top - h - 8, below = rect.bottom + 8;
      const top = above >= topLimit ? above : below + h <= bottomLimit ? below :
        (rect.top - topLimit >= bottomLimit - rect.bottom ? topLimit : bottomLimit - h);
      tooltip.style.left = Math.round(left) + "px";
      tooltip.style.top = Math.round(Math.max(topLimit, Math.min(top, bottomLimit - h))) + "px";
    }
    function translate() {
      const t = strings();
      badge.textContent = t.badge;
      exit.textContent = t.exit;
      caption.textContent = t.caption;
      for (const entry of entries) {
        entry.button.setAttribute("aria-label", t[entry.game.result] +
          (entry.latest ? " — " + t.recent : ""));
      }
      if (selected) {
        roundLabel.textContent = t.round + " ";
        perspective.textContent = selected.game.isHome ? t.home : t.away;
      }
    }
    function open(entry) {
      active?.button.removeAttribute("aria-describedby");
      active = entry;
      selected = entry;
      const game = entry.game;
      homeName.textContent = lookup.get(game.homeId).primaryName;
      awayName.textContent = lookup.get(game.awayId).primaryName;
      score.textContent = game.homeGoals + " – " + game.awayGoals;
      roundNumber.textContent = String(game.round);
      tooltip.hidden = false;
      tooltip.className = "app-world-form-tooltip";
      tooltip.removeAttribute("aria-hidden");
      entry.button.setAttribute("aria-describedby", tooltip.id);
      translate();
      place();
    }
    // Commit to DOM only after all integrity checks and node construction passed.
    tbody.replaceChildren(fragment);
    parent.before(toolbar);
    document.head.appendChild(style);
    document.body.appendChild(tooltip);
    translate();
    exit.addEventListener("click", () => {
      try { sessionStorage.removeItem(FLAG); } catch { /* local only */ }
      location.reload();
    });
    new MutationObserver(translate).observe(document.documentElement, {
      attributes: true, attributeFilter: ["lang"]
    });
    for (const entry of entries) {
      const btn = entry.button;
      btn.addEventListener("pointerenter", e => {
        if (e.pointerType === "mouse" || e.pointerType === "pen") open(entry);
      });
      btn.addEventListener("pointerleave", e => {
        if ((e.pointerType === "mouse" || e.pointerType === "pen") &&
            active === entry && document.activeElement !== btn) close();
      });
      btn.addEventListener("focus", () => open(entry));
      btn.addEventListener("blur", () => { if (active === entry) close(); });
      btn.addEventListener("pointerdown", e => {
        pressedWhenOpen = (e.pointerType === "touch" || e.pointerType === "pen") &&
          active === entry;
      });
      btn.addEventListener("click", () => {
        if (pressedWhenOpen && active === entry) close();
        else open(entry);
        pressedWhenOpen = false;
      });
    }
    document.addEventListener("pointerdown", e => {
      if (active && !tooltip.contains(e.target) && e.target !== active.button) close();
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && active) { close(); e.stopPropagation(); }
    });
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { passive: true });
    document.querySelector(".fa-shell-content-scroll")?.addEventListener("scroll", place,
      { passive: true });
    document.querySelector(".app-world-standing-scroll")?.addEventListener("scroll", place,
      { passive: true });
  } catch (error) {
    // Fail closed: do not disclose partial standings or mutate canonical sources.
    console.error("Standings DEV Preview unavailable:", error);
  }
}
