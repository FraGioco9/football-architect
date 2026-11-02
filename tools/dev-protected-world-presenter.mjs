// I05 DEV-only Calendar/Club candidate renderer. Explicit import; no public DOM mutation.
// Shows only redacted, already played fixtures in a small reversible outlet.
import {currentProtectedWorld} from "./dev-protected-world-source.mjs";
let outlet=null,restore=null,latest=0;
const active=()=>document.documentElement.dataset.faI03Renderer==="1"&&document.documentElement.dataset.faI05World==="1";
const parent=kind=>kind==="calendar"?document.getElementById("world-calendar"):document.querySelector("[data-club-overview], #club-overview, #club-panel-fixtures");
const clear=()=>{outlet?.remove();outlet=null;restore=null};
const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;return e};
function commit(detail){
 if(!active())return clear();
 if(detail.revision<latest||currentProtectedWorld()?.revision!==detail.revision)return;
 const target=parent(detail.kind);if(!target)return;
 clear();
 const section=document.createElement("section");
 section.dataset.faI05WorldCandidate="";section.hidden=true;
 section.setAttribute("aria-label","Unsealed local Debug candidate");
 const list=document.createElement("ol");
 for(const fixture of detail.events){
  if(!fixture.result)continue;
  const score=fixture.result;
  if(!Number.isInteger(score.homeGoals)||!Number.isInteger(score.awayGoals))continue;
  list.append(text("li",fixture.homeId+" "+score.homeGoals+" – "+score.awayGoals+" "+fixture.awayId));
 }
 if(list.childElementCount){section.append(list);section.hidden=false;}
 target.append(section);outlet=section;restore=detail.revision;latest=detail.revision;
}
window.addEventListener("fa:protected-world-ready",event=>commit(event.detail));
window.addEventListener("fa:protected-world-reset",event=>{latest=Math.max(latest,event.detail?.revision??0);clear()});
window.addEventListener("fa:protected-world-unavailable",()=>clear());
window.addEventListener("fa:debug-mode-change",()=>{if(!active())clear()});
