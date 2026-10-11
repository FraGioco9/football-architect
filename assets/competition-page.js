/* One shared competition renderer for all sixteen static deep-link routes. */
(() => {
  "use strict";
  const sourceUrl = document.currentScript?.src;
  const routeId = document.querySelector('meta[name="fa-division"]')?.content;
  const root = new URL("../_shared/", window.location.href);
  const status = document.getElementById("main-content");

  function fail() {
    if (!status || !document.body) return;
    document.body.replaceChildren();
    const main = document.createElement("main");
    main.className = "app-main";
    main.setAttribute("role", "alert");
    main.textContent = "Competition unavailable. ";
    const back = document.createElement("a");
    back.href = "../";
    back.textContent = "Back to Competitions";
    main.appendChild(back);
    document.body.appendChild(main);
  }
  function validManifest(data) {
    if (data?.schemaVersion !== 1 || data.approved !== false ||
        !Array.isArray(data.divisions) || data.divisions.length !== 16) return false;
    const ids = new Set(), clubs = new Set();
    for (const d of data.divisions) {
      if (!/^(IT|ENG|ES|DE|FR|PT|NL|BR)-[12]$/.test(d.id) || ids.has(d.id) ||
          !d.id.startsWith(d.countryId + "-") || typeof d.name !== "string" || !d.name ||
          typeof d.countryName !== "string" || !d.countryName ||
          !/^assets\/flags\/[a-z0-9-]+\.svg$/.test(d.flagAsset) ||
          ![1,2].includes(d.tier) || d.capacity !== 20 ||
          !Array.isArray(d.clubs) || d.clubs.length !== d.capacity) return false;
      ids.add(d.id);
      let previous = 0;
      for (const club of d.clubs) {
        const key = club.countryId + ":" + club.clubId;
        if (club.countryId !== d.countryId || !Number.isInteger(club.clubId) ||
            club.clubId <= previous || clubs.has(key) ||
            typeof club.fullName !== "string" || !club.fullName ||
            typeof club.abbr !== "string" || !club.abbr ||
            !(club.primaryName === null || (typeof club.primaryName === "string" && !!club.primaryName.trim()))) return false;
        clubs.add(key);
        previous = club.clubId;
      }
    }
    return ids.size === 16 && clubs.size === 320;
  }
  // Visual-only, deterministic 19-match demo for IT-1; NEVER part of the canonical manifest.
  // Order is a fictional league ranking, not the source club registry order.
  const it1Demo = [
    [4,14,2,3,33,13,"WWWDW"],
    [7,12,2,5,40,16,"LWWLW"],
    [2,10,6,3,32,18,"WLDDL"],
    [13,9,7,3,31,19,"WDWWD"],
    [5,10,2,7,30,23,"WWWWW"],
    [11,8,7,4,24,14,"DLWLW"],
    [15,8,6,5,28,20,"WWWLD"],
    [1,9,2,8,26,24,"WLLDW"],
    [9,8,4,7,28,28,"LLDWL"],
    [14,8,4,7,24,27,"LLLWW"],
    [17,8,3,8,35,32,"WDLWW"],
    [8,7,6,6,21,21,"LWWLD"],
    [6,7,5,7,26,22,"LLDWL"],
    [20,6,7,6,30,26,"DWLLD"],
    [3,6,4,9,24,31,"WLLDD"],
    [10,5,2,12,21,39,"LWWWD"],
    [16,4,5,10,19,40,"LDLLL"],
    [18,4,4,11,13,21,"LWDWL"],
    [12,2,5,12,17,38,"DDLLL"],
    [19,2,3,14,16,46,"DLLLL"]
  ];
  const formLabels = {
    W:["standingsDemoFormWin","Win","standingsDemoWinLetter"],
    D:["standingsDemoFormDraw","Draw","standingsDemoDrawLetter"],
    L:["standingsDemoFormLoss","Loss","standingsDemoLossLetter"]
  };
  function createStandingsRow(club, sample = null, position = null) {
    const tr = document.createElement("tr");
    tr.dataset.worldClub = club.countryId + "-" + club.clubId;
    const unknown = () => {
      const td = document.createElement("td");
      td.className = "app-world-stat-unknown";
      td.textContent = "—";
      return td;
    };
    const stat = value => {
      const td = document.createElement("td");
      td.className = "app-world-stat-value";
      td.textContent = String(value);
      return td;
    };
    tr.appendChild(sample ? stat(position) : unknown());
    const th = document.createElement("th");
    th.scope = "row";
    th.className = "app-world-standing-club";
    const identity = document.createElement("span");
    identity.className = "app-world-club-identity";
    const crest = document.createElement("span");
    crest.className = "app-world-club-crest-placeholder";
    crest.dataset.clubCrest = tr.dataset.worldClub;
    crest.setAttribute("aria-hidden", "true");
    const name = document.createElement("span");
    name.className = "app-world-club-name";
    name.textContent = club.primaryName || club.abbr;
    identity.append(crest, name);
    th.appendChild(identity);
    tr.appendChild(th);
    if (sample) {
      const [id,w,d,l,gf,ga,form] = sample;
      const diff = gf - ga;
      const values = [19,w,d,l,gf,ga,diff > 0 ? "+" + diff : diff,3*w+d];
      values.forEach(value => tr.appendChild(stat(value)));
      const formCell = document.createElement("td");
      const strip = document.createElement("span");
      strip.className = "app-world-form-strip";
      // Form runs from oldest on the left to the latest match on the right.
      for (let i = 0; i < form.length; i++) {
        const result = form[i];
        const isLatest = i === form.length - 1;
        const [ariaKey,english,letterKey] = formLabels[result];
        const dot = document.createElement("span");
        dot.className = "app-world-form-dot app-world-form-" + result.toLowerCase() +
          (isLatest ? " app-world-form-last" : "");
        dot.dataset.appAria = isLatest ? ariaKey + "Latest" : ariaKey;
        dot.dataset.appI18n = letterKey;
        dot.setAttribute("role","img");
        dot.setAttribute("aria-label",isLatest ? english + " — latest match" : english);
        dot.textContent = result;
        strip.appendChild(dot);
      }
      formCell.appendChild(strip);
      tr.appendChild(formCell);
    } else {
      for (let i = 0; i < 9; i++) tr.appendChild(unknown());
    }
    return tr;
  }
  function loadScript(url) {
    return new Promise((resolve,reject) => {
      const script = document.createElement("script");
      script.src = new URL(url,sourceUrl).href;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Missing shared app script"));
      document.head.appendChild(script);
    });
  }
  async function start() {
    if (!sourceUrl || !/^(IT|ENG|ES|DE|FR|PT|NL|BR)-[12]$/.test(routeId)) throw Error("Invalid route identity");
    const path = window.location.pathname.replace(/\/index\.html$/,"").replace(/\/+$/,"");
    if (path.split("/").pop() !== routeId.toLowerCase()) throw Error("Route identity mismatch");
    const [shellResponse, dataResponse] = await Promise.all([
      fetch(new URL("index.html",root),{credentials:"same-origin"}),
      fetch(new URL("manifest.json",root),{credentials:"same-origin"})
    ]);
    if (!shellResponse.ok || !dataResponse.ok) throw Error("Shared competition content unavailable");
    const [shellMarkup,manifest] = await Promise.all([shellResponse.text(),dataResponse.json()]);
    if (!validManifest(manifest)) throw Error("Invalid or approved competition manifest");
    const division = manifest.divisions.find(d => d.id === routeId);
    if (!division) throw Error("Unknown division");
    const parsed = new DOMParser().parseFromString(shellMarkup,"text/html");
    const required = ["app-divisions","app-competition-badge","app-competition-flag",
      "app-competition-country","app-competition-tier","app-competition-capacity",
      "app-competition-level","app-standings-body","app-standings-demo",
      "app-standings-caption","app-search-dialog"];
    if (required.some(id => !parsed.getElementById(id))) throw Error("Incomplete shared page");
    // Inert parsed scripts are discarded; load shared scripts only after content is ready.
    parsed.querySelectorAll("script").forEach(script => script.remove());
    document.body.innerHTML = parsed.body.innerHTML;
    document.body.className = parsed.body.className;
    document.getElementById("division-detail-name").textContent = division.name;
    document.getElementById("app-competition-badge").textContent = division.id;
    document.getElementById("app-competition-flag").src = "../../../" + division.flagAsset;
    const country = document.getElementById("app-competition-country");
    country.dataset.worldCountry = division.countryId;
    country.textContent = division.countryName;
    const tier = document.getElementById("app-competition-tier");
    tier.dataset.appI18n = division.tier === 1 ? "divisionTier1" : "divisionTier2";
    tier.textContent = division.tier === 1 ? "First division" : "Second division";
    document.getElementById("app-competition-capacity").textContent = String(division.capacity);
    document.getElementById("app-competition-level").textContent = String(division.tier);
    const tbody = document.getElementById("app-standings-body");
    if (routeId === "IT-1") {
      const clubs = new Map(division.clubs.map(club => [club.clubId,club]));
      if (clubs.size !== 20 || it1Demo.length !== 20 ||
          it1Demo.some(([id,w,d,l,gf,ga,form]) => !clubs.has(id) || w+d+l !== 19 ||
            gf < 0 || ga < 0 || !/^[WDL]{5}$/.test(form)))
        throw Error("Invalid IT-1 visual demo");
      tbody.replaceChildren(...it1Demo.map((sample,i) =>
        createStandingsRow(clubs.get(sample[0]),sample,i+1)));
      document.getElementById("app-standings-demo").hidden = false;
      const caption = document.getElementById("app-standings-caption");
      caption.dataset.appI18n = "standingsDemoCaption";
      caption.textContent = "Demonstration standings only; no matches have been played.";
    } else {
      tbody.replaceChildren(...division.clubs.map(club => createStandingsRow(club)));
    }
    for (const script of ["landing.js","app.js","app-search.js","competition-tabs.js"])
      await loadScript(script);
  }
  start().catch(fail);
})();
