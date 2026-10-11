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
  const demoFormTriggers = [];
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
      // Latest result is displayed first (left); keep sample records unchanged.
      for (let i = form.length - 1; i >= 0; i--) {
        const result = form[i];
        const isLatest = i === form.length - 1;
        const [ariaKey,english,letterKey] = formLabels[result];
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "app-world-form-dot app-world-form-" + result.toLowerCase() +
          (isLatest ? " app-world-form-last" : "");
        dot.dataset.appAria = isLatest ? ariaKey + "Latest" : ariaKey;
        dot.dataset.appI18n = letterKey;
        dot.setAttribute("aria-label",isLatest ? english + " — latest match" : english);
        dot.textContent = result;
        demoFormTriggers.push({button:dot,club,result,round:15+i});
        strip.appendChild(dot);
      }
      formCell.appendChild(strip);
      tr.appendChild(formCell);
    } else {
      for (let i = 0; i < 9; i++) tr.appendChild(unknown());
    }
    return tr;
  }

  // Temporary IT-1 fixture details are never written to the canonical manifest.
  // A fixed, document-level tooltip stays visible above both nested scroll regions.
  function attachFormTooltips(clubs) {
    if (!demoFormTriggers.length) return;
    const tooltip = document.createElement("div");
    tooltip.id = "app-world-form-tooltip";
    tooltip.className = "app-world-form-tooltip";
    tooltip.setAttribute("role","tooltip");
    tooltip.hidden = true;
    const item = (tag,cls,value,key) => {
      const el = document.createElement(tag);
      el.className = cls;
      el.textContent = value;
      if (key) el.dataset.appI18n = key;
      return el;
    };
    const header = item("div","app-world-form-tooltip-meta","");
    const demo = item("span","app-world-form-tooltip-demo","DEMO · Fictional fixture","standingsTooltipDemo");
    const round = item("span","app-world-form-tooltip-round","");
    const roundLabel = item("span","","Matchday","standingsTooltipRound");
    const number = item("strong","","");
    round.append(roundLabel,number);
    header.append(demo,round);
    const match = item("div","app-world-form-tooltip-scoreline","");
    const homeName = item("span","app-world-form-tooltip-team","");
    const score = item("strong","app-world-form-tooltip-score","");
    const awayName = item("span","app-world-form-tooltip-team","");
    match.append(homeName,score,awayName);
    const footer = item("div","app-world-form-tooltip-context","");
    const home = item("span","","Home","standingsTooltipHome");
    const away = item("span","","Away","standingsTooltipAway");
    const disclaimer = item("span","","Illustrative score · Not a real match","standingsTooltipDisclaimer");
    footer.append(home,away,disclaimer);
    tooltip.append(header,match,footer);
    document.body.appendChild(tooltip);
    const opponents = [...clubs.values()];
    let active = null, wasOpenOnPress = false;
    function close() {
      if (active) active.removeAttribute("aria-describedby");
      active = null;
      tooltip.hidden = true;
    }
    function place() {
      if (!active || tooltip.hidden) return;
      const rect = active.getBoundingClientRect();
      const width = window.innerWidth, height = window.innerHeight;
      if (rect.bottom < 0 || rect.top > height || rect.right < 0 || rect.left > width) {
        close();
        return;
      }
      const w = tooltip.offsetWidth || 300, h = tooltip.offsetHeight || 124;
      const left = Math.max(8,Math.min(rect.left + rect.width / 2 - w / 2,width-w-8));
      const top = rect.top >= h + 12 ? rect.top-h-8 : rect.bottom+8;
      tooltip.style.left = Math.round(left)+"px";
      tooltip.style.top = Math.round(Math.max(8,Math.min(top,height-h-8)))+"px";
    }
    function open(entry) {
      if (active && active !== entry.button) active.removeAttribute("aria-describedby");
      const others = opponents.filter(c => c.clubId !== entry.club.clubId);
      const opponent = others[(entry.club.clubId + entry.round*3) % others.length];
      const isHome = (entry.club.clubId + entry.round) % 2 === 0;
      const own = entry.result === "W" ? 2 : entry.result === "D" ? 1 : 0;
      const against = entry.result === "W" ? 1 : entry.result === "D" ? 1 : 2;
      homeName.textContent = (isHome ? entry.club : opponent).primaryName;
      awayName.textContent = (isHome ? opponent : entry.club).primaryName;
      score.textContent = (isHome ? own : against)+" – "+(isHome ? against : own);
      number.textContent = String(entry.round);
      home.hidden = !isHome;
      away.hidden = isHome;
      active = entry.button;
      active.setAttribute("aria-describedby",tooltip.id);
      tooltip.hidden = false;
      place();
    }
    for (const entry of demoFormTriggers) {
      const button = entry.button;
      button.addEventListener("pointerenter",event => {
        if (event.pointerType === "mouse" || event.pointerType === "pen") open(entry);
      });
      button.addEventListener("pointerleave",event => {
        if ((event.pointerType === "mouse" || event.pointerType === "pen") &&
            active === button && document.activeElement !== button) close();
      });
      button.addEventListener("focus",() => open(entry));
      button.addEventListener("blur",() => { if (active === button) close(); });
      button.addEventListener("pointerdown",event => {
        wasOpenOnPress = (event.pointerType === "touch" || event.pointerType === "pen") && active === button;
      });
      button.addEventListener("click",() => {
        if (wasOpenOnPress && active === button) close();
        else open(entry);
        wasOpenOnPress = false;
      });
    }
    document.addEventListener("pointerdown",event => {
      if (active && event.target !== active) close();
    });
    document.addEventListener("keydown",event => {
      if (event.key === "Escape" && active) {
        close();
        event.stopPropagation();
      }
    });
    window.addEventListener("resize",place);
    window.addEventListener("scroll",place,{passive:true});
    document.querySelector(".fa-shell-content-scroll")?.addEventListener("scroll",place,{passive:true});
    document.querySelector(".app-world-standing-scroll")?.addEventListener("scroll",place,{passive:true});
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
      attachFormTooltips(clubs);
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
