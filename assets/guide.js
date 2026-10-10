// GUIDE-01–06: data-driven world atlas. No fabricated club-to-division allocations.
(() => {
  "use strict";
  const KEY = "football-architect:language";
  const languages = ["en", "de", "es", "fr", "it"];
  const copy = {
    en: {
      language:"Language",home:"Home",guide:"World guide",countries:"Countries",divisions:"Divisions",
      clubs:"Documented clubs",browse:"Browse the atlas",searchLabel:"Search",
      searchPlaceholder:"Search names, IDs or abbreviations",countryLabel:"Country",
      allCountries:"All countries",categoryLabel:"Category",allEntries:"All entries",
      scopeNote:"Clubs are listed by country, not assigned to a current division. Historical city and stadium records are unverified.",
      directory:"Directory",footer:"Work in progress",loading:"Loading the atlas…",
      results:"{count} entries found",noResults:"No entries match these filters.",
      loadError:"The catalogue could not be loaded. Run this page through a local web server and try again.",
      countryEntries:"{divisions} divisions · {clubs} clubs",tier:"Tier {number}",places:"{number} places",
      emblemPending:"Emblem pending",clubDetails:"Club details",abbreviation:"Abbreviation",
      fullName:"Documented full name",shortName:"Approved short name",
      legacyTitle:"Historical reference (not verified as current)",legacyName:"Historical name",
      legacyCity:"Historical city",legacyStadium:"Historical stadium",
      noAssignment:"No current division assignment is documented."
    },
    de: {
      language:"Sprache",home:"Startseite",guide:"Weltführer",countries:"Länder",divisions:"Ligen",
      clubs:"Dokumentierte Vereine",browse:"Atlas durchsuchen",searchLabel:"Suche",
      searchPlaceholder:"Namen, IDs oder Kürzel suchen",countryLabel:"Land",
      allCountries:"Alle Länder",categoryLabel:"Kategorie",allEntries:"Alle Einträge",
      scopeNote:"Vereine sind nach Land aufgeführt, nicht einer aktuellen Liga zugeordnet. Historische Stadt- und Stadiondaten sind ungeprüft.",
      directory:"Verzeichnis",footer:"In Entwicklung",loading:"Atlas wird geladen…",
      results:"{count} Einträge gefunden",noResults:"Keine passenden Einträge.",
      loadError:"Der Katalog konnte nicht geladen werden. Bitte einen lokalen Webserver verwenden.",
      countryEntries:"{divisions} Ligen · {clubs} Vereine",tier:"Stufe {number}",places:"{number} Plätze",
      emblemPending:"Wappen ausstehend",clubDetails:"Vereinsdetails",abbreviation:"Kürzel",
      fullName:"Dokumentierter vollständiger Name",shortName:"Bestätigter Kurzname",
      legacyTitle:"Historischer Eintrag (nicht als aktuell bestätigt)",legacyName:"Historischer Name",
      legacyCity:"Historische Stadt",legacyStadium:"Historisches Stadion",
      noAssignment:"Keine aktuelle Ligazuweisung dokumentiert."
    },
    es: {
      language:"Idioma",home:"Inicio",guide:"Guía del mundo",countries:"Países",divisions:"Divisiones",
      clubs:"Clubes documentados",browse:"Explorar el atlas",searchLabel:"Buscar",
      searchPlaceholder:"Buscar nombres, ID o siglas",countryLabel:"País",
      allCountries:"Todos los países",categoryLabel:"Categoría",allEntries:"Todas las entradas",
      scopeNote:"Los clubes se agrupan por país, sin asignación a una división actual. Las ciudades y los estadios históricos no están verificados.",
      directory:"Directorio",footer:"En desarrollo",loading:"Cargando el atlas…",
      results:"{count} entradas encontradas",noResults:"No hay entradas coincidentes.",
      loadError:"No se pudo cargar el catálogo. Utiliza un servidor web local.",
      countryEntries:"{divisions} divisiones · {clubs} clubes",tier:"Nivel {number}",places:"{number} plazas",
      emblemPending:"Escudo pendiente",clubDetails:"Detalles del club",abbreviation:"Sigla",
      fullName:"Nombre completo documentado",shortName:"Nombre corto aprobado",
      legacyTitle:"Referencia histórica (no verificada como actual)",legacyName:"Nombre histórico",
      legacyCity:"Ciudad histórica",legacyStadium:"Estadio histórico",
      noAssignment:"No hay una división actual documentada."
    },
    fr: {
      language:"Langue",home:"Accueil",guide:"Guide du monde",countries:"Pays",divisions:"Divisions",
      clubs:"Clubs répertoriés",browse:"Explorer l’atlas",searchLabel:"Rechercher",
      searchPlaceholder:"Rechercher noms, ID ou sigles",countryLabel:"Pays",
      allCountries:"Tous les pays",categoryLabel:"Catégorie",allEntries:"Toutes les entrées",
      scopeNote:"Les clubs sont classés par pays, sans affectation à une division actuelle. Les villes et stades historiques ne sont pas vérifiés.",
      directory:"Répertoire",footer:"En développement",loading:"Chargement de l’atlas…",
      results:"{count} entrées trouvées",noResults:"Aucun résultat pour ces filtres.",
      loadError:"Impossible de charger le catalogue. Utilisez un serveur web local.",
      countryEntries:"{divisions} divisions · {clubs} clubs",tier:"Niveau {number}",places:"{number} places",
      emblemPending:"Écusson à venir",clubDetails:"Détails du club",abbreviation:"Sigle",
      fullName:"Nom complet documenté",shortName:"Nom court approuvé",
      legacyTitle:"Référence historique (non vérifiée comme actuelle)",legacyName:"Ancien nom",
      legacyCity:"Ville historique",legacyStadium:"Stade historique",
      noAssignment:"Aucune division actuelle n’est documentée."
    },
    it: {
      language:"Lingua",home:"Home",guide:"Guida al mondo",countries:"Paesi",divisions:"Divisioni",
      clubs:"Club documentati",browse:"Esplora l’atlante",searchLabel:"Cerca",
      searchPlaceholder:"Cerca nomi, ID o sigle",countryLabel:"Paese",
      allCountries:"Tutti i Paesi",categoryLabel:"Categoria",allEntries:"Tutte le voci",
      scopeNote:"I club sono elencati per Paese, senza assegnazioni alle divisioni attuali. Città e stadi storici non sono verificati.",
      directory:"Catalogo",footer:"In sviluppo",loading:"Caricamento atlante…",
      results:"{count} voci trovate",noResults:"Nessuna voce corrisponde ai filtri.",
      loadError:"Impossibile caricare il catalogo. Usa un server web locale.",
      countryEntries:"{divisions} divisioni · {clubs} club",tier:"Livello {number}",places:"{number} posti",
      emblemPending:"Stemma da definire",clubDetails:"Dettagli club",abbreviation:"Sigla",
      fullName:"Nome completo documentato",shortName:"Nome breve approvato",
      legacyTitle:"Riferimento storico (non verificato come attuale)",legacyName:"Nome storico",
      legacyCity:"Città storica",legacyStadium:"Stadio storico",
      noAssignment:"Nessuna assegnazione alla divisione attuale documentata."
    }
  };
  const countryNames = {
    de:{IT:"Italien",ENG:"England",ES:"Spanien",DE:"Deutschland",FR:"Frankreich",PT:"Portugal",NL:"Niederlande",BR:"Brasilien"},
    es:{IT:"Italia",ENG:"Inglaterra",ES:"España",DE:"Alemania",FR:"Francia",PT:"Portugal",NL:"Países Bajos",BR:"Brasil"},
    fr:{IT:"Italie",ENG:"Angleterre",ES:"Espagne",DE:"Allemagne",FR:"France",PT:"Portugal",NL:"Pays-Bas",BR:"Brésil"}
  };
  const localeSelect = document.getElementById("site-language");
  const countrySelect = document.getElementById("country-filter");
  const typeSelect = document.getElementById("type-filter");
  const search = document.getElementById("catalog-search");
  const results = document.getElementById("atlas-results");
  const summary = document.getElementById("result-summary");
  const index = document.getElementById("country-index");
  const state = {language:"en", countries:[], divisions:[], clubs:[], loaded:false, error:false};
  const valid = value => languages.includes(value) ? value : "en";
  const t = (key, params={}) => (copy[state.language][key] || "").replace(/\{(\w+)\}/g, (_,name) => String(params[name] ?? ""));
  const nameFor = c => (countryNames[state.language] && countryNames[state.language][c.id]) || c.name[state.language] || c.name.en;
  const node = (tag, className, content) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content !== undefined) element.textContent = String(content);
    return element;
  };
  const searchable = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
  const matches = (query, values) => !query || searchable(values.filter(Boolean).join(" ")).includes(query);

  function addDefinition(list, label, value) {
    list.append(node("dt","",label),node("dd","",value));
  }
  function translate() {
    document.documentElement.lang = state.language;
    localeSelect.value = state.language;
    for (const el of document.querySelectorAll("[data-i18n]")) {
      if (Object.hasOwn(copy[state.language],el.dataset.i18n)) el.textContent = t(el.dataset.i18n);
    }
    search.placeholder = t("searchPlaceholder");
    search.setAttribute("aria-label",t("searchLabel"));
    document.querySelector(".breadcrumb").setAttribute("aria-label",t("guide"));
    document.querySelector(".brand-mark").setAttribute("aria-label","Football Architect — "+t("home"));
    if (!state.loaded) summary.textContent = t(state.error ? "loadError" : "loading");
  }
  function updateCountries() {
    const selected = countrySelect.value;
    countrySelect.replaceChildren(node("option","",t("allCountries")));
    countrySelect.firstChild.value = "";
    for (const c of state.countries) {
      const option = node("option","",nameFor(c));
      option.value = c.id;
      countrySelect.append(option);
    }
    countrySelect.value = selected;
  }
  function makeDivision(d) {
    const article = node("article","division-card");
    article.setAttribute("aria-label",d.name);
    const placeholder = node("span","emblem-placeholder","—");
    placeholder.setAttribute("aria-label",t("emblemPending"));
    const content = node("div","division-copy");
    content.append(node("h4","",d.name));
    const meta = node("div","division-meta");
    meta.append(node("span","",d.id),node("span","",t("tier",{number:d.tier})),node("span","",t("places",{number:d.capacity})));
    content.append(meta,node("div","division-note",t("emblemPending")));
    article.append(placeholder,content);
    return article;
  }
  function makeClub(club) {
    const details = node("details","club-details");
    const heading = node("summary");
    const placeholder = node("span","club-emblem","—");
    placeholder.setAttribute("aria-label",t("emblemPending"));
    const main = node("span","club-heading");
    main.append(node("span","club-name",club.approvedShortName || club.fullName));
    main.append(node("span","club-sub",club.countryId+"-"+String(club.clubId).padStart(2,"0")+" · "+club.abbr));
    const caret = node("span","club-caret","›");
    caret.setAttribute("aria-hidden","true");
    heading.append(placeholder,main,caret);
    const content = node("div","club-expanded");
    const data = node("dl");
    addDefinition(data,t("fullName"),club.fullName);
    if (club.approvedShortName) addDefinition(data,t("shortName"),club.approvedShortName);
    addDefinition(data,t("abbreviation"),club.abbr);
    content.append(data);
    const historical = club.firstDivisionReference;
    if (historical) {
      content.append(node("p","historical-label",t("legacyTitle")));
      const legacyData = node("dl");
      if (historical.legacyName) addDefinition(legacyData,t("legacyName"),historical.legacyName);
      if (historical.city) addDefinition(legacyData,t("legacyCity"),historical.city);
      if (historical.stadium) addDefinition(legacyData,t("legacyStadium"),historical.stadium);
      content.append(legacyData);
    }
    content.append(node("p","division-note",t("noAssignment")));
    details.append(heading,content);
    return details;
  }
  function render() {
    if (!state.loaded) return;
    results.replaceChildren();
    index.replaceChildren();
    const query = searchable(search.value.trim());
    const countryFilter = countrySelect.value;
    const category = typeSelect.value;
    let total = 0;
    for (const country of state.countries) {
      if (countryFilter && country.id !== countryFilter) continue;
      const countrySearch = [country.id,country.name.en,country.name.it,nameFor(country)];
      const divisions = category === "club" ? [] : state.divisions.filter(d =>
        d.countryId === country.id && matches(query,[...countrySearch,d.name,d.id,String(d.tier)]));
      const clubs = category === "division" ? [] : state.clubs.filter(c =>
        c.countryId === country.id && matches(query,[...countrySearch,c.fullName,c.approvedShortName,c.abbr,c.countryId+"-"+String(c.clubId).padStart(2,"0"),c.firstDivisionReference && c.firstDivisionReference.legacyName]));
      if (!divisions.length && !clubs.length) continue;
      total += divisions.length + clubs.length;
      const section = node("section","country-section");
      section.id = "country-"+country.id;
      const heading = node("div","country-heading");
      if (/^assets\/flags\/[a-z-]+\.svg$/.test(country.flagAsset)) {
        const flag = node("img");
        flag.src = "../"+country.flagAsset;
        flag.alt = "";
        flag.width = 36;
        flag.height = 27;
        flag.loading = "lazy";
        heading.append(flag);
      }
      const title = node("h3","",nameFor(country));
      title.id = section.id+"-heading";
      section.setAttribute("aria-labelledby",title.id);
      heading.append(title,node("span","country-count",t("countryEntries",{divisions:divisions.length,clubs:clubs.length})));
      section.append(heading);
      const jump = node("a","",nameFor(country));
      jump.href = "#"+section.id;
      index.append(jump);
      if (divisions.length) {
        section.append(node("h4","group-heading",t("divisions")));
        const grid = node("div","division-grid");
        divisions.forEach(d => grid.append(makeDivision(d)));
        section.append(grid);
      }
      if (clubs.length) {
        section.append(node("h4","group-heading",t("clubs")));
        const list = node("div","club-list");
        clubs.forEach(c => list.append(makeClub(c)));
        section.append(list);
      }
      results.append(section);
    }
    index.hidden = !index.childElementCount;
    if (!total) results.append(node("p","empty-state",t("noResults")));
    summary.textContent = t("results",{count:total});
  }
  function changeLanguage(value) {
    state.language = valid(value);
    translate();
    if (state.loaded) {updateCountries();render();}
    try {window.localStorage.setItem(KEY,state.language);} catch { /* Storage may be disabled. */ }
  }
  try {state.language = valid(window.localStorage.getItem(KEY));} catch { /* English fallback. */ }
  localeSelect.addEventListener("change",() => changeLanguage(localeSelect.value));
  search.addEventListener("input",render);
  countrySelect.addEventListener("change",render);
  typeSelect.addEventListener("change",render);
  translate();

  async function load() {
    try {
      const [divisionResponse,clubResponse] = await Promise.all([
        fetch("../data/divisions.json"),fetch("../data/clubs.json")
      ]);
      if (!divisionResponse.ok || !clubResponse.ok) throw new Error("Catalogues unavailable");
      const [divisionData,clubData] = await Promise.all([divisionResponse.json(),clubResponse.json()]);
      if (!Array.isArray(divisionData.countries) || divisionData.countries.length !== 8 ||
          !Array.isArray(divisionData.divisions) || divisionData.divisions.length !== 16 ||
          !Array.isArray(clubData.clubs) || clubData.clubs.length !== 320 ||
          clubData.count !== 320) throw new Error("Unexpected catalogue inventory");
      state.countries = divisionData.countries;
      state.divisions = divisionData.divisions;
      state.clubs = clubData.clubs;
      state.loaded = true;
      updateCountries();
      render();
    } catch {
      state.error = true;
      summary.textContent = t("loadError");
      results.replaceChildren(node("p","atlas-error",t("loadError")));
    }
  }
  void load();
})();
