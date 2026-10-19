import {readPreviewProgress,previewSeasonMatchdays} from "./dev-standings-preview-data.mjs";
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
const create = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = String(text);
  if (className) el.className = className;
  return el;
};
// DEV content participates in the app's existing data-app-i18n system.
const localized = (tag, key, english, className) => {
  const el = create(tag, english, className);
  el.dataset.appI18n = key;
  return el;
};
const syncLanguage = () => window.faAppRenderLanguage?.();
if (panel && divisionId) {
  const style = create("style");
  style.textContent = `
.fa-dev-stats-nav{display:flex;justify-content:center;gap:8px;margin-bottom:16px}
.fa-dev-stats-nav button{display:flex;align-items:center;justify-content:center;flex:0 1 132px;min-width:0;width:132px;max-width:33%;padding:11px 8px;border:1px solid rgba(128,145,145,.25);border-radius:8px;background:transparent;color:inherit;text-align:center}
.fa-dev-stats-nav button[aria-pressed=true]{background:#176d61;color:#fff;font-weight:700}
.fa-dev-stats-nav button:focus:not(:focus-visible){outline:none;box-shadow:none}
.fa-dev-stats-nav button:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.fa-dev-stats-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.fa-dev-stats-card.app-competition-stat-card--compact{display:grid;grid-template-rows:var(--fa-record-heading) minmax(0,1fr);gap:4px;min-width:0;padding:10px 12px;border:1px solid rgba(128,145,145,.14);border-radius:12px}
.fa-dev-stats-card strong{display:block;font-size:clamp(1.25rem,2.5vw,1.8rem);overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
.fa-dev-stats-section{margin:0 0 20px}
.fa-dev-stats-leader-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.fa-dev-stats-leader-card{min-width:0;border:1px solid rgba(128,145,145,.14);border-radius:12px;padding:10px 12px;background:transparent}
.fa-dev-stats-leader-card.app-competition-stat-card--compact{padding:10px 12px;grid-template-rows:var(--fa-record-heading) minmax(0,1fr)}
.fa-dev-stats-top{list-style:none;min-width:0;margin:0;padding:0}
.fa-dev-stats-top li{display:grid;grid-template-columns:24px minmax(0,1fr) minmax(3.5ch,auto);align-items:center;column-gap:8px;min-width:0;min-height:38px;padding:5px 0;border-bottom:1px solid rgba(128,145,145,.2)}
.fa-dev-stats-top li:last-child{border-bottom:0}
.fa-dev-stats-top li>strong{justify-self:end;min-width:3.5ch;max-width:100%;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;font-size:.84rem;line-height:1.3}
.fa-dev-stats-empty{font-size:.85rem;opacity:.65}
.fa-dev-stats-player-empty{display:block!important;font-size:.85rem;opacity:.65;text-align:center;padding:18px 8px!important}
.fa-dev-stats-rank{justify-self:center;min-width:0;font-size:.82rem;opacity:.7;font-variant-numeric:tabular-nums;text-align:center}
.fa-dev-stats-top .app-world-club-identity{display:flex;align-items:center;min-width:0;gap:7px}
.fa-dev-stats-expand{display:flex;align-items:center;justify-content:center;gap:6px;margin:10px auto 0;padding:5px 9px;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;font-size:.82rem;opacity:.75;cursor:pointer;transition:opacity .15s}
.fa-dev-stats-expand:hover{opacity:1;text-decoration:underline}
.fa-dev-stats-expand:focus,.fa-dev-stats-expand:focus-visible{outline:none;box-shadow:none}
.fa-dev-stats-dialog{width:min(520px,calc(100vw - 32px));max-height:min(80vh,760px);overflow:auto;padding:12px 20px 20px;border:1px solid rgba(128,145,145,.3);border-radius:12px;background:var(--surface,#20292a);color:inherit;box-shadow:0 16px 48px rgba(0,0,0,.35)}
.fa-dev-stats-dialog[open]{animation:fa-stats-dialog-in .2s ease-out both}
.fa-dev-stats-dialog.fa-dev-stats-closing{animation:fa-stats-dialog-out .16s ease-in both}
.fa-dev-stats-dialog::backdrop{background:rgba(0,0,0,.65);animation:fa-stats-backdrop-in .2s ease-out both}
.fa-dev-stats-dialog.fa-dev-stats-closing::backdrop{animation:fa-stats-backdrop-out .16s ease-in both}
@keyframes fa-stats-dialog-in{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes fa-stats-dialog-out{from{opacity:1;transform:translateY(0) scale(1)}to{opacity:0;transform:translateY(8px) scale(.98)}}
@keyframes fa-stats-backdrop-in{from{background:rgba(0,0,0,0)}to{background:rgba(0,0,0,.65)}}
@keyframes fa-stats-backdrop-out{from{background:rgba(0,0,0,.65)}to{background:rgba(0,0,0,0)}}
@media(prefers-reduced-motion:reduce){.fa-dev-stats-dialog[open],.fa-dev-stats-dialog.fa-dev-stats-closing,.fa-dev-stats-dialog::backdrop{animation:none!important}}
.fa-dev-stats-dialog-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;min-height:40px}
.fa-dev-stats-dialog-header h3{margin:0;font-size:1rem}
.fa-dev-stats-dialog-close{border:0;background:transparent;color:inherit;font:inherit;font-size:1.5rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex:0 0 40px;width:40px;height:40px;padding:0}
.fa-dev-stats-dialog-close:focus,.fa-dev-stats-dialog-close:focus-visible{outline:none;box-shadow:none;background:transparent}
@media(max-width:760px){.fa-dev-stats-leader-grid{grid-template-columns:1fr}}
@media(max-width:650px){.fa-dev-stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.fa-dev-stats-card{padding:12px}}
@media(max-width:420px){.fa-dev-stats-nav button{width:auto;flex:1;padding:10px 5px}}
@media(max-width:360px){.fa-dev-stats-grid{grid-template-columns:1fr}}

.fa-dev-stats-top .app-world-club-crest-placeholder{flex-shrink:0}
.fa-dev-stats-top .fa-dev-stats-team-name{display:block;min-width:0;white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;line-height:1.3;font-size:.82rem;font-weight:650}
@media(max-width:420px){.fa-dev-stats-top li{grid-template-columns:20px minmax(0,1fr) minmax(3ch,auto);column-gap:6px}}`;
  document.head.append(style);
  const root = create("div");
  root.id = "fa-dev-stats";
  panel.replaceChildren(root);
  let manifest = null;
  let view = "overview";
  const number = value => Number.isInteger(value) ? String(value) : value.toFixed(2);
  function selectedSeason() {
    const seasons=(document.documentElement.dataset.faDevSeasons||"1").split(",")
      .map(Number).filter(season=>Number.isInteger(season)&&season>=1&&season<=4);
    const available=seasons.length?seasons:[1];
    const requested=Number(new URLSearchParams(location.search).get("season"));
    if(available.includes(requested))return requested;
    const routed=Number(window.faCompetitionRoute?.get?.().season);
    return available.includes(routed)?routed:available[0];
  }
  function selectedMatchdays() {
    let progress;
    try{progress=readPreviewProgress(sessionStorage)}catch{progress={season:1,matchdays:0}}
    return previewSeasonMatchdays(selectedSeason(),progress);
  }
  function render() {
    if (!manifest) return;
    const division = manifest.divisions.find(item => item.id === divisionId);
    if (!division) return;
    let stats;
    try { stats = aggregatePreviewStats(division, selectedMatchdays(), selectedSeason()); }
    catch (error) {
      console.error(error);
      root.replaceChildren(localized("p","statsDevUnavailable","DEV statistics unavailable"));
      syncLanguage();
      return;
    }
    root.replaceChildren();
    const nav = create("div", undefined, "fa-dev-stats-nav");
    for (const [id,key,label] of [["overview","statsDevOverview","Overview"],["teams","statsDevTeams","Teams"],["players","statsDevPlayers","Players"]]) {
      const button = localized("button",key,label,"language-trigger");
      button.type = "button";
      button.setAttribute("aria-pressed",String(view === id));
      button.addEventListener("click",()=>{const keyboardFocus=button.matches(":focus-visible");view=id;render();if(keyboardFocus){const selected=nav.querySelector('button[aria-pressed="true"]');selected?.focus();}});
      nav.append(button);
    }
    root.append(nav);
    let fictionalEnabled = false;
    try { fictionalEnabled = sessionStorage.getItem("football-architect:standings-dev-preview") === "on"; } catch {}
    const hasMatches=fictionalEnabled&&stats.overview.matchesPlayed>0;
    if (view === "players") {
      const section=create("section",undefined,"fa-dev-stats-section");
      const grid=create("div",undefined,"fa-dev-stats-leader-grid");
      const categories=[["statsDevGoals","Goals"],["statsDevAssists","Assists"],["statsDevAverageRating","Average rating"],["statsDevCleanSheets","Clean sheets"]];
      for(const [key,label] of categories){
        const card=create("section",undefined,"app-competition-stat-card app-competition-stat-card--compact fa-dev-stats-leader-card");
        card.append(localized("h4",key,label,"app-competition-stat-label fa-dev-stats-leader-title"));
        // No player-level records exist in this preview, so use a shared
        // empty-state element instead of an oversized padded list row.
        card.append(localized("p",hasMatches?"statsDevNoPlayerData":"statsDevNoData",
          hasMatches?"No player statistics yet.":"No statistics yet.","fa-dev-stats-empty"));
        grid.append(card);
      }
      section.append(grid);root.append(section);
      syncLanguage();
      return;
    }
    const ranked = (key, ascending=false) => [...stats.teams].filter(t=>t.mp>0).sort((a,b)=>(ascending?a[key]-b[key]:b[key]-a[key])||a.clubName.localeCompare(b.clubName));
    if (view === "overview") {
      const o = stats.overview;
      const grid=create("div",undefined,"app-competition-stat-grid fa-dev-stats-grid");
      for(const [key,label,value] of [["statsDevMatchesPlayed","Matches played",o.matchesPlayed],["statsDevTotalGoals","Total goals",o.totalGoals],["statsDevGoalsPerMatch","Goals per match",number(o.goalsPerMatch)]]){
        const card=create("div",undefined,"app-competition-stat-card app-competition-stat-card--compact fa-dev-stats-card");
        card.append(localized("span",key,label,"app-competition-stat-label"),
          hasMatches?create("strong",value,"app-competition-stat-value"):localized("p","statsDevNoData","No statistics yet.","fa-dev-stats-empty"));
        grid.append(card);
      }
      root.append(grid);
      syncLanguage();
      return;
    }
    const leaders=create("section",undefined,"fa-dev-stats-section");
    const leaderGrid=create("div",undefined,"fa-dev-stats-leader-grid");
    const categories=[["gf","statsDevGoalsScored","Goals scored",false],["ga","statsDevFewestConceded","Fewest conceded",true],["w","statsDevWins","Wins",false],["cs","statsDevCleanSheets","Clean sheets",false],["ppg","statsDevPointsPerMatch","Points per match",false],["gd","statsDevGoalDifference","Goal difference",false],["unbeatenStreak","statsDevUnbeatenStreak","Unbeaten streak",false]];
    for(const [key,labelKey,label,ascending] of categories){
      const card=create("section",undefined,"app-competition-stat-card app-competition-stat-card--fluid fa-dev-stats-leader-card fa-dev-stats-team-card");
      card.append(localized("h4",labelKey,label,"app-competition-stat-label fa-dev-stats-leader-title"));
      const top=create("ol",undefined,"fa-dev-stats-top");
      const teams=ranked(key,ascending);
      const buildRow=(team,index)=>{
        const li=create("li");
        const rank=teams.findIndex(candidate=>candidate[key]===team[key])+1;
        const position=create("span",String(rank),"fa-dev-stats-rank");
        const identity=create("span",undefined,"app-world-club-identity");
        const crest=create("span",undefined,"app-world-club-crest-placeholder");
        crest.dataset.clubCrest=division.countryId+"-"+team.clubId;
        crest.setAttribute("aria-hidden","true");
        identity.append(crest,create("span",team.clubName,"fa-dev-stats-team-name"));
        li.append(position,identity,create("strong",key==="ppg"?team[key].toFixed(2):number(team[key])));
        return li;
      };
      if(hasMatches){
        teams.slice(0,5).forEach((team,index)=>top.append(buildRow(team,index)));
        card.append(top);
      }else{
        card.append(localized("p","statsDevNoData","No statistics yet.","fa-dev-stats-empty"));
      }
      if(hasMatches&&teams.length>5){
        const expand=localized("button","statsDevShowAll","Show all","fa-dev-stats-expand");
        expand.type="button";
        expand.addEventListener("click",()=>{
          const dialog=create("dialog",undefined,"fa-dev-stats-dialog");
          const header=create("div",undefined,"fa-dev-stats-dialog-header");
          const title=localized("h3",labelKey,label);
          title.id="fa-dev-stats-dialog-title";
          dialog.setAttribute("aria-labelledby",title.id);
          const close=create("button","×","fa-dev-stats-dialog-close");
          close.type="button";close.dataset.appAria="statsDevClose";
          close.setAttribute("aria-label","Close");
          let closing=false;
          let pointerDismiss=false;
          let fallbackClose;
          let neutralFocus=null;
          close.addEventListener("pointerdown",()=>{pointerDismiss=true});
          const finishClose=()=>{
            if(!dialog.open)return;
            clearTimeout(fallbackClose);
            // Safari restores focus to the modal opener when close() runs.
            // Redirect touch dismissal focus to a neutral, non-visible target.
            if(pointerDismiss){
              neutralFocus=document.createElement("span");
              neutralFocus.tabIndex=-1;
              neutralFocus.style.cssText="position:fixed;width:0;height:0;overflow:hidden";
              document.body.append(neutralFocus);
              neutralFocus.focus({preventScroll:true});
              dialog.close();
            }else dialog.close();
          };
          const dismiss=()=>{
            if(closing||!dialog.open)return;
            closing=true;
            if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){
              finishClose();return;
            }
            dialog.classList.add("fa-dev-stats-closing");
            dialog.addEventListener("animationend",event=>{
              if(event.target===dialog&&event.animationName==="fa-stats-dialog-out")finishClose();
            });
            fallbackClose=setTimeout(finishClose,250);
          };
          close.addEventListener("click",dismiss);
          dialog.addEventListener("cancel",event=>{event.preventDefault();dismiss();});
          const outside=(event)=>{
            if(event.target!==dialog)return false;
            const bounds=dialog.getBoundingClientRect();
            return event.clientX<bounds.left||event.clientX>bounds.right||
                   event.clientY<bounds.top||event.clientY>bounds.bottom;
          };
          let pressedOutside=false;
          dialog.addEventListener("pointerdown",event=>{pressedOutside=outside(event);});
          dialog.addEventListener("pointercancel",()=>{pressedOutside=false;});
          dialog.addEventListener("click",event=>{
            if(event.detail===0||event.button!==0){pressedOutside=false;return;}
            if(pressedOutside&&outside(event)){pointerDismiss=true;dismiss();}
            pressedOutside=false;
          });
          dialog.addEventListener("keydown",event=>{
            if(event.altKey||event.ctrlKey||event.metaKey)return;
            if(event.key==="ArrowDown"||event.key==="ArrowUp"){
              event.preventDefault();
              dialog.scrollBy({top:event.key==="ArrowDown"?64:-64,behavior:"smooth"});
            }else if(event.key==="Home"||event.key==="End"){
              event.preventDefault();
              dialog.scrollTo({top:event.key==="Home"?0:dialog.scrollHeight,behavior:"smooth"});
            }
          });
          header.append(title,close);
          const all=create("ol",undefined,"fa-dev-stats-top");
          teams.forEach((team,index)=>all.append(buildRow(team,index)));
          dialog.append(header,all);
          dialog.addEventListener("close",()=>{
            clearTimeout(fallbackClose);
            dialog.remove();
            if(pointerDismiss)requestAnimationFrame(()=>{
              if(document.activeElement===expand)expand.blur();
              neutralFocus?.remove();
            });
          });
          window.dispatchEvent(new Event("fa:stats-dialog-open"));
          document.body.append(dialog);
          dialog.showModal();
          syncLanguage();
          close.focus();
        });
        card.append(expand);
      }
      leaderGrid.append(card);
    }
    leaders.append(leaderGrid);root.append(leaders);
    syncLanguage();

  }
  fetch("/competitions/_shared/manifest.json",{cache:"no-store"})
    .then(response=>{if(!response.ok)throw Error("Manifest unavailable");return response.json();})
    .then(data=>{
      if(data?.schemaVersion!==1||data.approved!==false||!Array.isArray(data.divisions)||data.divisions.length!==16)
        throw Error("Invalid DEV manifest");
      manifest=data;render();
    })
    .catch(error=>{console.error(error);root.replaceChildren(localized("p","statsDevUnavailable","DEV statistics unavailable"));syncLanguage();});
  window.addEventListener("fa:competition-route-change",()=>{
    document.querySelector("dialog.fa-dev-stats-dialog[open]")?.close();
    render();
  });
  window.addEventListener("popstate",render);
  window.addEventListener("fa:dev-progress-change",render);
  window.addEventListener("fa:fictional-standings-change",render);
  const standings = document.getElementById("app-standings-body");
  if (standings) new MutationObserver(()=>{if(manifest)render();}).observe(standings,{childList:true});
}
