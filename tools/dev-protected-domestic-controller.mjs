// I03 opt-in controller. Never starts unless the separate renderer gate is true.
import {prepareSharedDomesticUpdate} from "./protected-domestic-presenter.mjs";
let restore=null,latest=0;
const active=()=>document.documentElement.dataset.faI03Renderer==="1";
const clear=()=>{try{restore?.rollback()}finally{restore=null}};
window.addEventListener("fa:protected-debug-domestic-presentation",event=>{
 if(!active())return;
 const {revision,competitionId,season,presentation}=event.detail??{};
 if(!Number.isInteger(revision)||revision<=latest||!presentation)return;
 if(!location.pathname.toLowerCase().startsWith("/competitions/"+competitionId.toLowerCase()+"/"))return;
 if(Number(window.faCompetitionRoute?.get?.().season)!==season)return;
 let next;
 try{next=prepareSharedDomesticUpdate(presentation)}catch(error){
  window.dispatchEvent(new CustomEvent("fa:protected-debug-render-failed",{detail:{revision,reason:"prepare"}}));return;
 }
 try{clear();next.commit();restore=next;latest=revision;
  window.dispatchEvent(new CustomEvent("fa:protected-debug-render-committed",{detail:{revision,competitionId,season}}));
 }catch(error){try{next.rollback()}catch{}window.dispatchEvent(new CustomEvent("fa:protected-debug-render-failed",{detail:{revision,reason:"commit"}}))}
});
for(const name of ["fa:debug-mode-change","fa:competition-route-change","fa:protected-debug-source-unavailable"]){
 window.addEventListener(name,()=>{if(restore)clear()});
}
