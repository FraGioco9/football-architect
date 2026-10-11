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
  const formLabels = {
    W:["standingsDemoFormWin","Win","standingsDemoWinLetter"],
    D:["standingsDemoFormDraw","Draw","standingsDemoDrawLetter"],
    L:["standingsDemoFormLoss","Loss","standingsDemoLossLetter"]
  };
  const demoFormTriggers = [];


  // The shared HTML is a checked-in generated artifact; inject mobile shell only in memory.
  function withMobileShell(html) {
    const open = '<div class="app-world-standings">';
    const close = '</table>\n            </div>\n          </div>';
    if (html.split(open).length !== 2 || html.split(close).length !== 2)
      throw Error("Unexpected shared standings markup");
    const controls = [
      '<div class="app-world-layout-switch" id="app-standings-layout-switch" role="group"',
      ' aria-label="Standings view" data-app-aria="standingsMobileMode" hidden>',
      '<button type="button" id="app-standings-show-compact"',
      ' data-app-i18n="standingsMobileCompact" aria-pressed="true">Compact</button>',
      '<button type="button" id="app-standings-show-full"',
      ' data-app-i18n="standingsMobileFull" aria-pressed="false">Full table</button>',
      '</div>'
    ].join("");
    const compact = [
      '<div class="app-world-compact" id="app-standings-compact" hidden>',
      '<ol class="app-world-mobile-list" id="app-standings-compact-list"></ol>',
      '</div>'
    ].join("");
    return html.replace(open,open+controls)
      .replace('<div class="app-world-standing-scroll" role="region"',
        '<div class="app-world-standing-scroll" id="app-standings-full" role="region"')
      .replace(close,'</table>\n            </div>'+compact+'\n          </div>');
  }

  // Both presentations receive the same validated row model, never parsed table text.
  function createMobileStandings() {
    const list = document.getElementById("app-standings-compact-list");
    const compact = document.getElementById("app-standings-compact");
    const full = document.getElementById("app-standings-full");
    const switcher = document.getElementById("app-standings-layout-switch");
    const compactButton = document.getElementById("app-standings-show-compact");
    const fullButton = document.getElementById("app-standings-show-full");
    if (![list,compact,full,switcher,compactButton,fullButton].every(Boolean))
      throw Error("Incomplete mobile standings layout");
    const fields = [
      ["played","standingsPlayed","P"],["won","standingsWon","W"],
      ["drawn","standingsDrawn","D"],["lost","standingsLost","L"],
      ["gf","standingsFor","GF"],["ga","standingsAgainst","GA"],
      ["gd","standingsDifference","GD"],["pts","standingsPoints","Pts"]
    ];
    const formKeys = {W:"standingsDemoFormWin",D:"standingsDemoFormDraw",L:"standingsDemoFormLoss"};
    const element = (tag, cls = "", value = "") => {
      const el = document.createElement(tag);
      el.className = cls;
      el.textContent = String(value);
      return el;
    };
    const translation = (key, fallback, cls = "sr-only") => {
      const el = element("span",cls,fallback);
      el.dataset.appI18n = key;
      return el;
    };
    let mode = "compact";
    const breakpoint = window.matchMedia?.("(max-width: 620px)");
    function updateVisibility() {
      const mobile = breakpoint ? breakpoint.matches : window.innerWidth <= 620;
      const showCompact = mobile && mode === "compact";
      switcher.hidden = !mobile;
      compact.hidden = !showCompact;
      full.hidden = showCompact;
      compactButton.setAttribute("aria-pressed", String(showCompact));
      fullButton.setAttribute("aria-pressed", String(!showCompact));
    }
    compactButton.addEventListener("click", () => { mode = "compact"; updateVisibility(); });
    fullButton.addEventListener("click", () => { mode = "full"; updateVisibility(); });
    if (breakpoint?.addEventListener) breakpoint.addEventListener("change", updateVisibility);
    window.addEventListener("resize", updateVisibility);
    function prepare(rows) {
      if (!Array.isArray(rows) || rows.length !== 20)
        throw Error("Incomplete mobile standings model");
      const identities = new Set();
      const clubs = new Map(rows.map(row => [row.club?.clubId,row.club]));
      const items = rows.map((row,index) => {
        const club = row.club;
        const id = club?.countryId + "-" + club?.clubId;
        if (!club || !(club.primaryName || club.abbr) || !Number.isInteger(club.clubId) ||
            identities.has(id) || !club.countryId || !Array.isArray(row.recent) ||
            (row.recent.length !== 0 && row.recent.length !== 5))
          throw Error("Invalid mobile standings identity or form");
        identities.add(id);
        const li = element("li","app-world-mobile-item");
        li.dataset.worldClub = id;
        const details = element("details","app-world-mobile-details");
        const summary = element("summary","app-world-mobile-summary");
        const pos = element("span","app-world-mobile-position",
          row.position == null ? (row.played == null ? "—" : String(index + 1)) :
            String(row.position));
        const name = element("span","app-world-mobile-name",club.primaryName || club.abbr);
        const points = element("span","app-world-mobile-points",
          row.pts == null ? "—" : String(row.pts));
        const form = element("span","app-world-mobile-form");
        form.appendChild(translation("standingsMobileRecent","Recent form"));
        if (!row.recent.length) {
          form.appendChild(element("span","app-world-mobile-no-form","—"));
        } else {
          for (const game of row.recent) {
            if (!Object.hasOwn(formKeys,game.result) ||
                !Number.isInteger(game.round) || !clubs.has(game.homeId) ||
                !clubs.has(game.awayId)) throw Error("Invalid mobile fixture metadata");
            const mark = element("span","app-world-form-dot app-world-form-" +
              game.result.toLowerCase(),game.result);
            mark.setAttribute("aria-hidden","true");
            form.append(mark,translation(formKeys[game.result],
              game.result === "W" ? "Win" : game.result === "D" ? "Draw" : "Loss"));
          }
        }
        const ptsLabel = translation("standingsPoints","Pts ");
        points.appendChild(ptsLabel);
        summary.append(pos,name,points,form,
          translation("standingsMobileDetails","Club statistics"));
        const stats = element("dl","app-world-mobile-stats");
        for (const [field,key,fallback] of fields) {
          const item = element("div","app-world-mobile-stat");
          const label = element("dt","",fallback);
          label.dataset.appI18n = key;
          const value = row[field];
          if (value != null && (!Number.isInteger(value) || (field !== "gd" && value < 0)))
            throw Error("Invalid mobile standings statistic");
          const formatted = value == null ? "—" :
            field === "gd" && value > 0 ? "+"+value : String(value);
          item.append(label,element("dd","",formatted));
          stats.appendChild(item);
        }
        const panel = element("div","app-world-mobile-panel");
        panel.appendChild(stats);
        if (row.recent.length) {
          const title = element("h3","app-world-mobile-matches-title","Recent matches");
          title.dataset.appI18n = "standingsMobileMatches";
          const matches = element("ol","app-world-mobile-matches");
          for (const game of row.recent) {
            const opponent = clubs.get(game.isHome ? game.awayId : game.homeId);
            if (!opponent || !Number.isInteger(game.homeGoals) ||
                !Number.isInteger(game.awayGoals)) throw Error("Invalid mobile match");
            const match = element("li","app-world-mobile-match");
            const round = element("span","","Matchday");
            round.dataset.appI18n = "standingsTooltipRound";
            const venue = element("span","",game.isHome ? "Home" : "Away");
            venue.dataset.appI18n = game.isHome ? "standingsTooltipHome" : "standingsTooltipAway";
            match.append(round,element("span","",String(game.round)),
              element("span","",opponent.primaryName),
              element("strong","",game.homeGoals+" – "+game.awayGoals),venue);
            matches.appendChild(match);
          }
          panel.append(title,matches);
        }
        details.append(summary,panel);
        li.appendChild(details);
        return li;
      });
      if (identities.size !== 20) throw Error("Invalid mobile standings size");
      return () => {
        list.replaceChildren(...items);
        updateVisibility();
        window.faAppRenderLanguage?.();
      };
    }
    updateVisibility();
    return Object.freeze({prepare});
  }

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

  // Form tooltips are regression-tested against isolated Node fixtures.
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
    const round = item("span","app-world-form-tooltip-round","");
    const roundLabel = item("span","","Matchday","standingsTooltipRound");
    const number = item("strong","","");
    round.append(roundLabel,number);
    header.appendChild(round);
    const match = item("div","app-world-form-tooltip-scoreline","");
    const homeName = item("span","app-world-form-tooltip-team","");
    const score = item("strong","app-world-form-tooltip-score","");
    const awayName = item("span","app-world-form-tooltip-team","");
    match.append(homeName,score,awayName);
    const footer = item("div","app-world-form-tooltip-context","");
    const home = item("span","","Home","standingsTooltipHome");
    const away = item("span","","Away","standingsTooltipAway");
    footer.append(home,away);
    tooltip.append(header,match,footer);
    document.body.appendChild(tooltip);
    const opponents = [...clubs.values()];
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    let active = null, wasOpenOnPress = false;
    tooltip.addEventListener("animationend",event => {
      if (event.target === tooltip && event.animationName === "app-world-tooltip-out" && !active) {
        tooltip.hidden = true;
        tooltip.className = "app-world-form-tooltip";
      }
    });
    function close() {
      if (active) active.removeAttribute("aria-describedby");
      active = null;
      tooltip.setAttribute("aria-hidden","true");
      if (tooltip.hidden || reduceMotion) {
        tooltip.hidden = true;
        tooltip.className = "app-world-form-tooltip";
      } else {
        tooltip.className = "app-world-form-tooltip is-closing";
      }
    }
    function place() {
      if (!active || tooltip.hidden) return;
      const rect = active.getBoundingClientRect();
      const width = window.innerWidth, height = window.innerHeight;
      // Measure the shared, responsive topbar on every reposition. A tooltip
      // must never cross its lower edge, including while the page scrolls.
      const topbarBottom = Math.max(0,document.querySelector(".fa-shell-topbar")
        ?.getBoundingClientRect().bottom ?? 0);
      const topLimit = Math.max(8,topbarBottom+8), bottomLimit = height-8;
      const w = tooltip.offsetWidth || 300, h = tooltip.offsetHeight || 124;
      if (rect.bottom <= topbarBottom || rect.top >= height || rect.right <= 0 ||
          rect.left >= width || bottomLimit-topLimit < h) {
        close();
        return;
      }
      const left = Math.max(8,Math.min(rect.left + rect.width / 2 - w / 2,width-w-8));
      const above = rect.top-h-8;
      const below = rect.bottom+8;
      // Prefer a fully clear side; if neither fits, constrain the tooltip
      // within the usable content viewport without covering the topbar.
      const top = above >= topLimit ? above :
        below+h <= bottomLimit ? below :
        (rect.top-topLimit >= bottomLimit-rect.bottom ? topLimit : bottomLimit-h);
      tooltip.style.left = Math.round(left)+"px";
      tooltip.style.top = Math.round(Math.max(topLimit,Math.min(top,bottomLimit-h)))+"px";
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
      tooltip.removeAttribute("aria-hidden");
      tooltip.className = "app-world-form-tooltip";
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
      "app-competition-level","app-standings-body",
      "app-standings-caption","app-search-dialog"];
    if (required.some(id => !parsed.getElementById(id))) throw Error("Incomplete shared page");
    // Inert parsed scripts are discarded; load shared scripts only after content is ready.
    parsed.querySelectorAll("script").forEach(script => script.remove());
    document.body.innerHTML = withMobileShell(parsed.body.innerHTML);
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
    const mobile = createMobileStandings();
    const provisional = division.clubs.map(club => ({
      club,position:null,played:null,won:null,drawn:null,lost:null,
      gf:null,ga:null,gd:null,pts:null,recent:[]
    }));
    const commitMobile = mobile.prepare(provisional);
    // Public statistics remain unknown in both presentations.
    tbody.replaceChildren(...division.clubs.map(club => createStandingsRow(club)));
    commitMobile();
    window.faStandingsMobile = mobile;
    for (const script of ["landing.js","app.js","app-search.js","competition-tabs.js"])
      await loadScript(script);
  }
  start().catch(fail);
})();
