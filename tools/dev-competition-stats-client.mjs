import {aggregatePreviewStats} from "./stats-data.mjs";

const panel = document.getElementById("competition-panel-stats");
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
`;
  document.head.append(style);
  const root = create("div");
  root.id = "fa-dev-stats";
  panel.replaceChildren(root);
  let manifest = null;
  let view = "overview";
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
    root.replaceChildren(create("p", "DEV ONLY — Season " + stats.season + " — " + stats.matchdays + " matchdays"));
    const nav = create("div", undefined, "fa-dev-stats-nav");
    for (const [id,label] of [["overview","Overview"],["teams","Teams"],["players","Players"]]) {
      const button = create("button",label,"language-trigger");
      button.type = "button";
      button.setAttribute("aria-pressed",String(view === id));
      button.addEventListener("click",()=>{view=id;render();});
      nav.append(button);
    }
    root.append(nav);
    if (view === "players") {
      root.append(create("p","Individual player statistics are unavailable because DEV matches do not contain player events.","app-competition-status"));
      return;
    }
    if (view === "overview") {
      const o = stats.overview;
      const cards = [
        ["Matches played",o.matchesPlayed],["Total goals",o.totalGoals],
        ["Goals per match",number(o.goalsPerMatch)],
        ["Home wins",o.homeWins+" ("+pct(o.homeWinPct)+")"],
        ["Draws",o.draws+" ("+pct(o.drawPct)+")"],
        ["Away wins",o.awayWins+" ("+pct(o.awayWinPct)+")"],
        ["Clean sheets",o.cleanSheets],
        ["Most frequent score",o.mostFrequentScoreline ? o.mostFrequentScoreline.score+" ("+o.mostFrequentScoreline.count+")" : "—"],
        ["Highest-scoring matches",o.highestScoringMatches.length ? o.highestScoringMatches.map(g=>g.homeGoals+"–"+g.awayGoals+" (MD "+g.round+")").join(", ") : "—"]
      ];
      const grid = create("div",undefined,"fa-dev-stats-grid");
      for (const [label,value] of cards) {
        const card = create("div",undefined,"fa-dev-stats-card");
        card.append(create("span",label),create("strong",value));
        grid.append(card);
      }
      root.append(grid);
      return;
    }
    const table = create("table",undefined,"fa-dev-stats-table");
    const thead = create("thead"), header = create("tr");
    columns.forEach((key,index)=>{
      const th = create("th"), button = create("button",labels[index]);
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
      for (const key of columns) {
        const value = key.endsWith("Pct") ? pct(team[key]) : key === "ppg" ? number(team[key]) : team[key];
        row.append(create("td",value));
      }
      tbody.append(row);
    }
    table.append(tbody);
    const wrap = create("div",undefined,"fa-dev-stats-table-wrap");
    wrap.append(table);root.append(wrap);
  }
  fetch("/app/competitions/_shared/manifest.json",{cache:"no-store"})
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
