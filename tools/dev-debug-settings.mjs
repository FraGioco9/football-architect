// DEV-only settings UI. Injected only by the strict loopback preview server.
// Never include this module in public artifacts or shared app source.
const FLAG = "football-architect:standings-dev-preview";
const PATH = /^\/app\/settings\/(?:index\.html)?$/;
const ID = /^(IT|ENG|ES|DE|FR|PT|NL|BR)-[12]$/;
const COPY = {
  en:["Debug Settings","DEV ONLY · fictional, deterministic results; not a live season.","Fictional standings","Enabled for this tab","Disabled","Preview division","Open preview","Loading divisions…","Debug preview unavailable"],
  de:["Debug-Einstellungen","NUR DEV · fiktive, deterministische Ergebnisse; keine aktive Saison.","Fiktive Tabellen","Für diesen Tab aktiviert","Deaktiviert","Liga auswählen","Vorschau öffnen","Ligen werden geladen…","Debug-Vorschau nicht verfügbar"],
  es:["Ajustes de depuración","SOLO DEV · resultados ficticios deterministas; no es una temporada activa.","Clasificaciones ficticias","Activadas en esta pestaña","Desactivadas","División de vista previa","Abrir vista previa","Cargando divisiones…","Vista de depuración no disponible"],
  fr:["Paramètres de débogage","DEV UNIQUEMENT · résultats fictifs déterministes, pas de saison active.","Classements fictifs","Activés dans cet onglet","Désactivés","Division à prévisualiser","Ouvrir l’aperçu","Chargement des divisions…","Aperçu de débogage indisponible"],
  it:["Impostazioni di debug","SOLO DEV · risultati fittizi deterministici, nessuna stagione attiva.","Classifiche fittizie","Attivate in questa scheda","Disattivate","Divisione da visualizzare","Apri anteprima","Caricamento divisioni…","Anteprima debug non disponibile"]
};
export function validateDebugManifest(data) {
  if (!data || data.schemaVersion !== 1 || data.approved !== false ||
      !Array.isArray(data.divisions) || data.divisions.length !== 16) {
    throw Error("Invalid DEV manifest");
  }
  const ids = new Set();
  const divisions = data.divisions.map(d => {
    if (!d || !ID.test(d.id) || ids.has(d.id) ||
        d.id !== d.countryId + "-" + d.tier || ![1,2].includes(d.tier) ||
        d.capacity !== 16 || !Array.isArray(d.clubs) || d.clubs.length !== 16 ||
        typeof d.name !== "string" || !d.name.trim()) {
      throw Error("Invalid DEV division");
    }
    const start = d.tier === 1 ? 1 : 17;
    for (let i = 0; i < 16; i++) {
      const club = d.clubs[i];
      if (club?.clubId !== start + i || club?.countryId !== d.countryId ||
          typeof club?.primaryName !== "string" || !club.primaryName.trim()) {
        throw Error("Invalid DEV club");
      }
    }
    ids.add(d.id);
    return Object.freeze({ id:d.id, name:d.name });
  });
  if (ids.size !== 16) throw Error("Incomplete DEV divisions");
  return Object.freeze(divisions);
}
function make(tag, cls = "", value = "") {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  el.textContent = value;
  return el;
}
async function init() {
  // Defense in depth: only a local, explicit DEV route may mount controls.
  if (!PATH.test(location.pathname) || location.hostname !== "127.0.0.1" ||
      location.port !== "2000") return;
  const grid = document.querySelector("#app-settings .app-settings-grid");
  if (!grid || document.getElementById("fa-dev-debug-settings")) return;
  const panel = make("section","app-panel app-settings-panel fa-dev-debug-settings");
  panel.id = "fa-dev-debug-settings";
  panel.dataset.devOnly = "true";
  const heading = make("h2");
  heading.id = "fa-dev-debug-heading";
  panel.setAttribute("aria-labelledby", heading.id);
  const content = make("div","app-settings-panel-content");
  const description = make("p","app-settings-hint");
  const controls = make("div","fa-dev-debug-controls");
  const toggle = make("button","app-theme-choice fa-dev-debug-toggle");
  toggle.id = "fa-dev-debug-toggle";
  toggle.type = "button";
  toggle.disabled = true;
  toggle.setAttribute("aria-pressed","false");
  const status = make("span","fa-dev-debug-status");
  status.setAttribute("role","status");
  const label = make("label","fa-dev-debug-label");
  const select = make("select","fa-dev-debug-select");
  select.id = "fa-dev-debug-division";
  select.disabled = true;
  label.htmlFor = select.id;
  const link = make("a","app-link app-link-secondary fa-dev-debug-open");
  link.id = "fa-dev-debug-open";
  link.hidden = true;
  controls.append(toggle,status);
  content.append(description,controls,label,select,link);
  panel.append(heading,content);
  grid.append(panel);
  const style = make("style");
  style.textContent = [
    ".fa-dev-debug-controls{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:12px 0}",
    ".fa-dev-debug-status{color:var(--muted);font-size:12px}",
    ".fa-dev-debug-label{display:block;margin:12px 0 6px;font-size:12px;font-weight:700}",
    ".fa-dev-debug-select{display:block;max-width:100%;width:100%;min-height:40px;padding:7px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font:inherit}",
    ".fa-dev-debug-select:focus-visible{outline:2px solid var(--focus);outline-offset:2px}",
    ".fa-dev-debug-open{display:inline-flex;margin-top:12px}",
    ".fa-dev-debug-open[hidden]{display:none}"
  ].join("\n");
  document.head.append(style);
  let divisions = null;
  let storageOK = true;
  function isEnabled() {
    try { return sessionStorage.getItem(FLAG) === "on"; }
    catch { storageOK = false; return false; }
  }
  function render() {
    const lang = document.documentElement.lang?.toLowerCase().split("-")[0] || "en";
    const [title,info,action,on,off,choose,go,loading,error] = COPY[lang] || COPY.en;
    const active = storageOK && isEnabled();
    heading.textContent = title;
    description.textContent = info;
    toggle.textContent = action;
    toggle.setAttribute("aria-pressed",String(active));
    toggle.disabled = !storageOK || !divisions;
    status.textContent = !storageOK || divisions === false ? error :
      !divisions ? loading : active ? on : off;
    label.textContent = choose;
    select.setAttribute("aria-label",choose);
    select.disabled = !storageOK || !divisions;
    link.textContent = go;
    const selected = divisions && divisions.find(d => d.id === select.value);
    link.hidden = !active || !selected;
    if (selected) link.href = "/app/competitions/" + selected.id.toLowerCase() + "/";
    else link.removeAttribute("href");
  }
  toggle.addEventListener("click",() => {
    if (!storageOK || !divisions) return;
    try {
      if (isEnabled()) sessionStorage.removeItem(FLAG);
      else sessionStorage.setItem(FLAG,"on");
    } catch { storageOK = false; }
    render();
  });
  select.addEventListener("change",render);
  new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
  render();
  try {
    const response = await fetch("/app/competitions/_shared/manifest.json",{
      cache:"no-store",credentials:"same-origin"
    });
    if (!response.ok) throw Error("Missing DEV manifest");
    divisions = validateDebugManifest(await response.json());
    for (const division of divisions) {
      const option = make("option","",division.id + " — " + division.name);
      option.value = division.id;
      select.append(option);
    }
  } catch {
    divisions = false;
    try { sessionStorage.removeItem(FLAG); } catch { storageOK = false; }
  }
  render();
}
if (typeof document !== "undefined" && typeof location !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded",init,{once:true});
  } else init();
}
