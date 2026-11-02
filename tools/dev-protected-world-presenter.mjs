// I05 DEV-only Calendar data presenter. Explicit local import, source-revision gated.
// Reuses the existing Calendar details host; never remounts the grid or toolbar.
import {currentProtectedWorld} from "./dev-protected-world-source.mjs";
let outlet=null,restore=[],latest=0,namesPromise=null;
const active=()=>document.documentElement.dataset.faI03Renderer==="1"&&
 document.documentElement.dataset.faI05World==="1"&&location.pathname==="/calendar";
const clear=()=>{
 outlet?.remove();outlet=null;
 for(const [el,hidden] of restore)if(el.isConnected)el.hidden=hidden;
 restore=[];
};
const element=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;return e};
const names=()=>namesPromise??=fetch("/competitions/_shared/manifest.json",{credentials:"same-origin",cache:"force-cache"})
 .then(r=>{if(!r.ok)throw Error("Club catalog unavailable");return r.json()})
 .then(manifest=>new Map((manifest.divisions||[]).flatMap(d=>(d.clubs||[]).map(c=>
  [c.countryId+"-"+c.clubId,c.primaryName]))));
async function commit(detail){
 if(!active())return clear();
 if(detail.revision<latest||currentProtectedWorld()?.revision!==detail.revision)return;
 const selectedDay=detail.selectedDay||detail.day;
 const target=document.getElementById("calendar-details-content");if(!target)return;
 let catalog;try{catalog=await names()}catch{return}
 const current=currentProtectedWorld();
 if(!active()||current?.revision!==detail.revision||current.selectedDay!==selectedDay)return;
 clear();
 const section=document.createElement("section");section.dataset.faI05WorldCandidate="";
 section.setAttribute("aria-label","Local Debug competition fixtures");
 const list=document.createElement("ol");
 const fixtures=[...detail.events].sort((a,b)=>a.order-b.order||a.competitionId.localeCompare(b.competitionId));
 for(const game of fixtures){
  const home=game.homeId?catalog.get(game.homeId)||game.homeId:null;
  const away=game.awayId?catalog.get(game.awayId)||game.awayId:null;
  const score=game.result;
  if(score&&(!Number.isSafeInteger(score.homeGoals)||!Number.isSafeInteger(score.awayGoals)))continue;
  const label=game.competitionId+" · "+(home||"TBD")+" — "+(away||"TBD")+
   (score?" · "+score.homeGoals+"–"+score.awayGoals:"");
  list.append(element("li",label));
 }
 if(!list.childElementCount){section.hidden=true}
 else section.append(list);
 // Hide only source-dependent empty/authoritative details, not the page layout.
 const dynamic=[...target.querySelectorAll("[data-authoritative-calendar], .calendar-detail-more p")];
 restore=dynamic.map(el=>[el,el.hidden]);
 for(const el of dynamic)el.hidden=true;
 target.append(section);outlet=section;latest=detail.revision;
}
window.addEventListener("fa:protected-world-ready",event=>{void commit(event.detail)});
window.addEventListener("fa:protected-world-reset",event=>{latest=Math.max(latest,event.detail?.revision??0);clear()});
window.addEventListener("fa:protected-world-unavailable",clear);
window.addEventListener("fa:debug-mode-change",()=>{if(!active())clear()});
window.addEventListener("fa:calendar-selection-change",clear);
