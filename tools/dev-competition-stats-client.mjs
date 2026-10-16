import {aggregatePreviewStats} from "./stats-data.mjs";

// The shared competition shell is hydrated asynchronously by competition-page.js.
const panel = await new Promise(resolve => {
  const existing = document.getElementById("competition-panel-stats");
  if (existing) return resolve(existing);
  const observer = new MutationObserver(() => {
    const found = document.getElementById("competition-panel-stats");
    if (found) { observer.disconnect(); clearTimeout(timeout); resolve(found); }
  });
  const timeout = setTimeout(() => { observer.disconnect(); resolve(null); }, 7000);
  observer.observe(document.documentElement,{childList:true,subtree:true});
});
const divisionId = document.querySelector('meta[name="fa-division"]')?.content;
const matchdayKey = "football-architect:standings-dev-matchdays";
const create = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = String(text);
  if (className) el.className = className;
  return el;
};
if (panel && divisionId) {
  const style = create("style");
  style.textContent = `
.fa-dev-stats-nav{display:flex;gap:8px;margin-bottom:16px}
.fa-dev-stats-nav button{flex:1;min-width:0}
.fa-dev-stats-nav button[aria-pressed=true]{font-weight:700;border-color:currentColor}
.fa-dev-stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.fa-dev-stats-card{padding:16px;border:1px solid currentColor;border-radius:12px}
.fa-dev-stats-card strong{display:block;font-size:1.4rem}
.fa-dev-stats-table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
.fa-dev-stats-table th,.fa-dev-stats-table td{padding:9px 7px;text-align:right;border-bottom:1px solid currentColor}
.fa-dev-stats-table th:first-child,.fa-dev-stats-table td:first-child{text-align:left}
.fa-dev-stats-table button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
.fa-dev-stats-table-wrap{overflow-x:auto}

.fa-dev-stats-section{margin:0 0 20px}
.fa-dev-stats-heading{font-size:1rem;margin:0 0 12px;font-weight:700}
.fa-dev-stats-nav{padding:5px;border-radius:12px;background:rgba(128,145,145,.08);border:1px solid rgba(128,145,145,.22)}
.fa-dev-stats-nav button{border:0;border-radius:8px;background:transparent;color:inherit;padding:11px 8px}
.fa-dev-stats-nav button[aria-pressed=true]{background:#176d61;color:#fff}
.fa-dev-stats-card{display:flex;flex-direction:column;gap:8px;min-width:0;border-color:rgba(128,145,145,.25)}
.fa-dev-stats-card span{font-size:.85rem;opacity:.75}
.fa-dev-stats-card strong{font-size:clamp(1.25rem,2.5vw,1.8rem);overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
.fa-dev-stats-subnav{display:flex;gap:8px;margin-bottom:14px}
.fa-dev-stats-subnav button{border:1px solid rgba(128,145,145,.35);border-radius:8px;background:transparent;color:inherit;padding:9px 14px;cursor:pointer}
.fa-dev-stats-subnav button[aria-pressed=true]{font-weight:700;border-color:currentColor}
@media(max-width:650px){.fa-dev-stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.fa-dev-stats-card{padding:12px}}
@media(max-width:360px){.fa-dev-stats-grid{grid-template-columns:1fr}}
`;
  style.textContent += `
.fa-dev-stats-nav{justify-content:center;gap:8px;background:transparent;border:0}
.fa-dev-stats-nav button{flex:0 1 132px;width:132px;max-width:33%;border:1px solid rgba(128,145,145,.25)}
.fa-dev-stats-categories{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.fa-dev-stats-categories button{border:1px solid rgba(128,145,145,.3);border-radius:8px;background:transparent;color:inherit;padding:8px 12px;cursor:pointer}
.fa-dev-stats-categories button[aria-pressed=true]{border-color:currentColor;font-weight:700}
.fa-dev-stats-top{list-style:decimal inside;margin:0;padding:0;max-width:680px}
.fa-dev-stats-top li{display:flex;justify-content:space-between;gap:16px;padding:12px;border-bottom:1px solid rgba(128,145,145,.2)}
.fa-dev-stats-top strong{font-variant-numeric:tabular-nums}
@media(max-width:420px){.fa-dev-stats-nav button{width:auto;flex:1;padding:10px 5px}}
`;
  style.textContent += `
.fa-dev-stats-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
.fa-dev-stats-card{border-color:rgba(128,145,145,.18);padding:14px}
.fa-dev-stats-record-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.fa-dev-stats-record{border:1px solid rgba(128,145,145,.18);border-radius:10px;padding:14px;display:grid;gap:10px;min-width:0}
.fa-dev-stats-record-label{font-size:.82rem;opacity:.7}
.fa-dev-stats-record strong{font-variant-numeric:tabular-nums;font-size:1.1rem}
.fa-dev-stats-record .app-world-club-identity,.fa-dev-stats-top .app-world-club-identity{display:flex;align-items:center;gap:9px;min-width:0}
.fa-dev-stats-record .app-world-club-crest-placeholder,.fa-dev-stats-top .app-world-club-crest-placeholder{flex:none}
@media(max-width:700px){.fa-dev-stats-record-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:420px){.fa-dev-stats-record-grid{grid-template-columns:1fr}}
`;
  document.head.append(style);
  const root = create("div");
  root.id = "fa-dev-stats";
  panel.replaceChildren(root);
  let manifest = null;
  let view = "overview";
  let teamMode = "performance";
  let teamCategory = "gf";
  let sortKey = "points";
  let descending = true;
  const columns = ["clubName","mp","w","d","l","gf","ga","gd","points","ppg","cs","fts","homeWinPct","awayWinPct"];
  const labels = ["Club","MP","W","D","L","GF","GA","GD","Pts","PPG","CS","FTS","Home W%","Away W%"];
  const pct = value => value.toFixed(1) + "%";
  const number = value => Number.isInteger(value) ? String(value) : value.toFixed(2);
  function selectedSeason() {
    const value = Number(new URLSearchParams(location.search).get("season"));
    return value === 1 || value === 2 ? value : 2;
  }
  function selectedMatchdays() {
    try {
      const raw = sessionStorage.getItem(matchdayKey);
      if (raw === null) return 15;
      const value = Number(raw);
      return Number.isInteger(value) && value >= 0 && value <= 30 ? value : 15;
    } catch { return 15; }
  }
  function render() {
    if (!manifest) return;
    const division = manifest.divisions.find(item => item.id === divisionId);
    if (!division) return;
    let stats;
    try { stats = aggregatePreviewStats(division, selectedMatchdays(), selectedSeason()); }
    catch (error) {
      console.error(error);
      root.replaceChildren(create("p","DEV statistics unavailable"));
      return;
    }
    root.replaceChildren();
    const nav = create("div", undefined, "fa-dev-stats-nav");
    for (const [id,label] of [["overview","Overview"],["teams","Teams"],["players","Players"]]) {
      const button = create("button",label,"language-trigger");
      button.type = "button";
      button.setAttribute("aria-pressed",String(view === id));
      button.addEventListener("click",()=>{view=id;render();});
      nav.append(button);
    }
    root.append(nav);
    if (stats.overview.matchesPlayed === 0) { root.append(create("p","No matches played yet.","app-competition-status")); return; }
    if (view === "players") {
      root.append(create("h3","Top 5 players","fa-dev-stats-heading"));
      root.append(create("p","No player statistics available yet.","app-competition-status"));
      return;
    }
    const ranked = (key, ascending=false) => [...stats.teams].filter(t=>t.mp>0).sort((a,b)=>(ascending?a[key]-b[key]:b[key]-a[key])||a.clubName.localeCompare(b.clubName));
    if (view === "overview") {
      const o = stats.overview;
      const groups = [
        ["General",[["Matches played",o.matchesPlayed],["Total goals",o.totalGoals],["Goals per match",number(o.goalsPerMatch)]]]
      ];
      const recordItems=[["Best attack","gf",false],["Worst attack","gf",true],["Best defence","ga",true],["Worst defence","ga",false],["Most wins","w",false],["Most clean sheets","cs",false]];
      for(const [heading,cards] of groups){
        const section=create("section",undefined,"fa-dev-stats-section");
        section.append(create("h3",heading,"fa-dev-stats-heading"));
        const grid=create("div",undefined,"fa-dev-stats-grid");
        for(const [label,value] of cards){
          const card=create("div",undefined,"fa-dev-stats-card");
          card.append(create("span",label),create("strong",value));grid.append(card);
        }
        section.append(grid);root.append(section);
      }
      const section=create("section",undefined,"fa-dev-stats-section");
      section.append(create("h3","Team records","fa-dev-stats-heading"));
      const grid=create("div",undefined,"fa-dev-stats-record-grid");
      for(const [label,key,ascending] of recordItems){
        const team=ranked(key,ascending)[0];
        const card=create("div",undefined,"fa-dev-stats-record");
        card.append(create("span",label,"fa-dev-stats-record-label"));
        if(team){
          const identity=create("div",undefined,"app-world-club-identity");
          const crest=create("span",undefined,"app-world-club-crest-placeholder");
          crest.dataset.clubCrest=division.countryId+"-"+team.clubId;
          crest.setAttribute("aria-hidden","true");
          identity.append(crest,create("span",team.clubName,"app-world-club-name"));
          card.append(identity,create("strong",number(team[key])));
        }
        grid.append(card);
      }
      section.append(grid);root.append(section);
      return;
    }
    const leaders=create("section",undefined,"fa-dev-stats-section");
    leaders.append(create("h3","Top 5 teams","fa-dev-stats-heading"));
    const categoryNav=create("div",undefined,"fa-dev-stats-categories");
    const categories=[["gf","Goals scored"],["ga","Fewest conceded"],["w","Wins"],["cs","Clean sheets"],["ppg","Points per match"]];
    for(const [key,label] of categories){const button=create("button",label);button.type="button";button.setAttribute("aria-pressed",String(teamCategory===key));button.addEventListener("click",()=>{teamCategory=key;render();});categoryNav.append(button);}
    leaders.append(categoryNav);
    const top=create("ol",undefined,"fa-dev-stats-top");
    ranked(teamCategory,teamCategory==="ga").slice(0,5).forEach(t=>{const li=create("li");const identity=create("span",undefined,"app-world-club-identity");const crest=create("span",undefined,"app-world-club-crest-placeholder");crest.dataset.clubCrest=division.countryId+"-"+t.clubId;crest.setAttribute("aria-hidden","true");identity.append(crest,create("span",t.clubName));li.append(identity,create("strong",number(t[teamCategory])));top.append(li);});
    leaders.append(top);root.append(leaders);
    const subnav=create("div",undefined,"fa-dev-stats-subnav");
    for(const [id,label] of [["performance","Performance"],["additional","Additional"]]){
      const button=create("button",label);button.type="button";button.setAttribute("aria-pressed",String(teamMode===id));
      button.addEventListener("click",()=>{teamMode=id;sortKey=id==="performance"?"points":"cs";descending=true;render();});subnav.append(button);
    }
    root.append(subnav);
    const visibleColumns=teamMode==="performance"?["clubName","mp","w","d","l","gf","ga","gd","ppg"]:["clubName","cs","fts","homeWinPct","awayWinPct"];
    const table = create("table",undefined,"fa-dev-stats-table");
    const thead = create("thead"), header = create("tr");
    visibleColumns.forEach(key=>{
      const th = create("th"), button = create("button",labels[columns.indexOf(key)]);
      th.scope = "col";
      button.type = "button";
      button.addEventListener("click",()=>{
        if (sortKey === key) descending = !descending;
        else { sortKey = key; descending = key !== "clubName"; }
        render();
      });
      th.append(button);header.append(th);
    });
    thead.append(header);table.append(thead);
    const tbody = create("tbody");
    const teams = [...stats.teams].sort((a,b)=>{
      const x = a[sortKey], y = b[sortKey];
      const difference = typeof x === "string" ? x.localeCompare(y) : x-y;
      return (descending ? -difference : difference) || a.clubId-b.clubId;
    });
    for (const team of teams) {
      const row = create("tr");
      for (const key of visibleColumns) {
        const value = key.endsWith("Pct") ? pct(team[key]) : key === "ppg" ? number(team[key]) : team[key];
        row.append(create("td",value));
      }
      tbody.append(row);
    }
    table.append(tbody);
    const wrap = create("div",undefined,"fa-dev-stats-table-wrap");
    wrap.append(table);root.append(wrap);
  }
  fetch("/competitions/_shared/manifest.json",{cache:"no-store"})
    .then(response=>{if(!response.ok)throw Error("Manifest unavailable");return response.json();})
    .then(data=>{
      if(data?.schemaVersion!==1||data.approved!==false||!Array.isArray(data.divisions)||data.divisions.length!==16)
        throw Error("Invalid DEV manifest");
      manifest=data;render();
    })
    .catch(error=>{console.error(error);root.replaceChildren(create("p","DEV statistics unavailable"));});
  window.addEventListener("fa:competition-route-change",render);
  window.addEventListener("popstate",render);
  const standings = document.getElementById("app-standings-body");
  if (standings) new MutationObserver(()=>{if(manifest)render();}).observe(standings,{childList:true});
}
