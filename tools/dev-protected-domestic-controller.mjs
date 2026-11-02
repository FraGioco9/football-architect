// I03 opt-in controller. Not injected, and the separate renderer gate stays off.
import {prepareSharedDomesticUpdate} from "./dev-protected-domestic-presenter.mjs";
let restore=null,latest=0;
const active=()=>document.documentElement.dataset.faI03Renderer==="1";
const clear=()=>{const previous=restore;restore=null;previous?.rollback()};
window.addEventListener("fa:protected-debug-domestic-presentation",event=>{
 if(!active())return;
 const {revision,competitionId,season,presentation}=event.detail??{};
 if(!Number.isInteger(revision)||revision<=latest||!presentation||!/^(IT|ENG|ES|DE|FR|PT|NL|BR)-[12]$/.test(competitionId))return;
 if(!new RegExp('^/competitions/'+competitionId.toLowerCase()+'(?:/|$)').test(location.pathname.toLowerCase()))return;
 if(Number(window.faCompetitionRoute?.get?.().season)!==season)return;
 // Release before preparing: a new transaction must snapshot the restored base,
 // rather than keep references/listeners owned by the outgoing transaction.
 latest=revision;
 let next;
 try{clear();next=prepareSharedDomesticUpdate(presentation)}catch(error){
  window.dispatchEvent(new CustomEvent("fa:protected-debug-render-failed",{detail:{revision,reason:"prepare"}}));return;
 }
 try{next.commit();restore=next;
  window.dispatchEvent(new CustomEvent("fa:protected-debug-render-committed",{detail:{revision,competitionId,season}}));
 }catch(error){try{next.rollback()}catch{}window.dispatchEvent(new CustomEvent("fa:protected-debug-render-failed",{detail:{revision,reason:"commit"}}))}
});
for(const name of ["fa:debug-mode-change","fa:competition-route-change","fa:protected-debug-source-unavailable","fa:dev-progress-change","fa:dev-world-day-change"]){
 window.addEventListener(name,()=>{if(restore)clear()});
}
window.addEventListener('fa:protected-debug-source-change',event=>{
 if(event.detail?.kind!=="protected-debug"&&restore)clear();
});
