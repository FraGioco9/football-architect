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
.fa-dev-stats-nav{display:flex;justify-content:center;gap:8px;margin-bottom:16px}
.fa-dev-stats-nav button{display:flex;align-items:center;justify-content:center;flex:0 1 132px;min-width:0;width:132px;max-width:33%;padding:11px 8px;border:1px solid rgba(128,145,145,.25);border-radius:8px;background:transparent;color:inherit;text-align:center}
.fa-dev-stats-nav button[aria-pressed=true]{background:#176d61;color:#fff;font-weight:700}
.fa-dev-stats-nav button:focus:not(:focus-visible){outline:none;box-shadow:none}
.fa-dev-stats-nav button:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.fa-dev-stats-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.fa-dev-stats-card{display:flex;flex-direction:column;gap:8px;min-width:0;padding:14px;border:1px solid rgba(128,145,145,.14);border-radius:12px}
.fa-dev-stats-card span{font-size:.85rem;opacity:.75}
.fa-dev-stats-card strong{display:block;font-size:clamp(1.25rem,2.5vw,1.8rem);overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
.fa-dev-stats-section{margin:0 0 20px}
.fa-dev-stats-leader-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.fa-dev-stats-leader-card{min-width:0;border:1px solid rgba(128,145,145,.14);border-radius:12px;padding:16px;background:transparent}
.fa-dev-stats-leader-title{margin:0 0 12px;font-size:.95rem;font-weight:700}
.fa-dev-stats-top{list-style:none;margin:0;padding:0}
.fa-dev-stats-top li{display:grid;grid-template-columns:24px minmax(0,1fr) minmax(38px,auto);align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(128,145,145,.2)}
.fa-dev-stats-top li:last-child{border-bottom:0}
.fa-dev-stats-top li>strong{justify-self:end;min-width:38px;text-align:right;font-variant-numeric:tabular-nums}
.fa-dev-stats-empty{font-size:.85rem;opacity:.65}
.fa-dev-stats-player-empty{display:block!important;font-size:.85rem;opacity:.65;text-align:center;padding:18px 8px!important}
.fa-dev-stats-rank{font-size:.85rem;opacity:.6;font-variant-numeric:tabular-nums}
.fa-dev-stats-top .app-world-club-identity{min-width:0}
.fa-dev-stats-top .app-world-club-identity>span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fa-dev-stats-expand{display:flex;align-items:center;justify-content:center;gap:6px;margin:10px auto 0;padding:5px 9px;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;font-size:.82rem;opacity:.75;cursor:pointer;transition:opacity .15s}
.fa-dev-stats-expand:hover{opacity:1;text-decoration:underline}
.fa-dev-stats-expand:focus,.fa-dev-stats-expand:focus-visible{outline:none;box-shadow:none}
.fa-dev-stats-dialog{width:min(520px,calc(100vw - 32px));max-height:min(80vh,760px);overflow:auto;padding:20px;border:1px solid rgba(128,145,145,.3);border-radius:12px;background:var(--surface,#20292a);color:inherit;box-shadow:0 16px 48px rgba(0,0,0,.35)}
.fa-dev-stats-dialog[open]{animation:fa-stats-dialog-in .2s ease-out both}
.fa-dev-stats-dialog.fa-dev-stats-closing{animation:fa-stats-dialog-out .16s ease-in both}
.fa-dev-stats-dialog::backdrop{background:rgba(0,0,0,.65);animation:fa-stats-backdrop-in .2s ease-out both}
.fa-dev-stats-dialog.fa-dev-stats-closing::backdrop{animation:fa-stats-backdrop-out .16s ease-in both}
@keyframes fa-stats-dialog-in{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes fa-stats-dialog-out{from{opacity:1;transform:translateY(0) scale(1)}to{opacity:0;transform:translateY(8px) scale(.98)}}
@keyframes fa-stats-backdrop-in{from{background:rgba(0,0,0,0)}to{background:rgba(0,0,0,.65)}}
@keyframes fa-stats-backdrop-out{from{background:rgba(0,0,0,.65)}to{background:rgba(0,0,0,0)}}
@media(prefers-reduced-motion:reduce){.fa-dev-stats-dialog[open],.fa-dev-stats-dialog.fa-dev-stats-closing,.fa-dev-stats-dialog::backdrop{animation:none!important}}
.fa-dev-stats-dialog-header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:12px}
.fa-dev-stats-dialog-header h3{margin:0;font-size:1rem}
.fa-dev-stats-dialog-close{border:0;background:transparent;color:inherit;font:inherit;font-size:1.5rem;cursor:pointer;padding:0 6px}
.fa-dev-stats-dialog-close:focus,.fa-dev-stats-dialog-close:focus-visible{outline:none;box-shadow:none;background:transparent}
@media(max-width:760px){.fa-dev-stats-leader-grid{grid-template-columns:1fr}}
@media(max-width:650px){.fa-dev-stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.fa-dev-stats-card{padding:12px}}
@media(max-width:420px){.fa-dev-stats-nav button{width:auto;flex:1;padding:10px 5px}}
@media(max-width:360px){.fa-dev-stats-grid{grid-template-columns:1fr}}
`;
  document.head.append(style);
  const root = create("div");
  root.id = "fa-dev-stats";
  panel.replaceChildren(root);
  let manifest = null;
  let view = "overview";
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
      const categories=["Goals","Assists","Average rating","Clean sheets"];
      for(const label of categories){
        const card=create("section",undefined,"fa-dev-stats-leader-card");
        card.append(create("h4",label,"fa-dev-stats-leader-title"));
        const list=create("ol",undefined,"fa-dev-stats-top");
        const empty=create("li",hasMatches?"No player statistics available yet.":"No statistics available yet.","fa-dev-stats-player-empty");
        list.append(empty);
        card.append(list);
        grid.append(card);
      }
      section.append(grid);root.append(section);
      return;
    }
    const ranked = (key, ascending=false) => [...stats.teams].filter(t=>t.mp>0).sort((a,b)=>(ascending?a[key]-b[key]:b[key]-a[key])||a.clubName.localeCompare(b.clubName));
    if (view === "overview") {
      const o = stats.overview;
      const grid=create("div",undefined,"fa-dev-stats-grid");
      for(const [label,value] of [["Matches played",o.matchesPlayed],["Total goals",o.totalGoals],["Goals per match",number(o.goalsPerMatch)]]){
        const card=create("div",undefined,"fa-dev-stats-card");
        card.append(create("span",label),hasMatches?create("strong",value):create("span","No statistics available yet.","fa-dev-stats-empty"));
        grid.append(card);
      }
      root.append(grid);
      return;
    }
    const leaders=create("section",undefined,"fa-dev-stats-section");
    const leaderGrid=create("div",undefined,"fa-dev-stats-leader-grid");
    const categories=[["gf","Goals scored",false],["ga","Fewest conceded",true],["w","Wins",false],["cs","Clean sheets",false],["ppg","Points per match",false],["gd","Goal difference",false],["unbeatenStreak","Unbeaten streak",false]];
    for(const [key,label,ascending] of categories){
      const card=create("section",undefined,"fa-dev-stats-leader-card");
      card.append(create("h4",label,"fa-dev-stats-leader-title"));
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
        identity.append(crest,create("span",team.clubName));
        li.append(position,identity,create("strong",key==="ppg"?team[key].toFixed(2):number(team[key])));
        return li;
      };
      if(hasMatches)teams.slice(0,5).forEach((team,index)=>top.append(buildRow(team,index)));
      else top.append(create("li","No statistics available yet.","fa-dev-stats-player-empty"));
      card.append(top);
      if(hasMatches&&teams.length>5){
        const expand=create("button","Show all","fa-dev-stats-expand");
        expand.type="button";
        expand.addEventListener("click",()=>{
          const dialog=create("dialog",undefined,"fa-dev-stats-dialog");
          const header=create("div",undefined,"fa-dev-stats-dialog-header");
          const title=create("h3",label);
          const close=create("button","×","fa-dev-stats-dialog-close");
          close.type="button";close.setAttribute("aria-label","Close");
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
          close.focus();
        });
        card.append(expand);
      }
      leaderGrid.append(card);
    }
    leaders.append(leaderGrid);root.append(leaders);

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
  window.addEventListener("fa:fictional-standings-change",render);
  const standings = document.getElementById("app-standings-body");
  if (standings) new MutationObserver(()=>{if(manifest)render();}).observe(standings,{childList:true});
}
