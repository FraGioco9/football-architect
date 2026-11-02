// I05 DEV-only Stats controller. Do not inject into public HTML.
// Requires both the existing protected renderer opt-in and a separate Stats gate.
import {attachProtectedStatsPresenter} from "./dev-protected-stats-presenter.mjs";
let detach=null;
function enabled(){
 return document.documentElement.dataset.faI03Renderer==="1"&&
  document.documentElement.dataset.faI05Stats==="1";
}
function reset(){if(detach){const dispose=detach;detach=null;dispose()}}
export function syncProtectedStatsController(){
 if(!enabled()){reset();return false}
 if(detach)return true;
 const panel=document.getElementById("competition-panel-stats");
 const context=window.faCompetitionContext;
 const definition=context?.currentDefinition||context?.definition;
 if(!panel||!definition||window.faCompetitionStats?.mount===undefined)return false;
 detach=attachProtectedStatsPresenter({panel,definition,baseContext:()=>window.faCompetitionContext});
 return true;
}
for(const name of ["fa:competition-route-change","fa:debug-mode-change","pageshow"]){
 window.addEventListener(name,()=>{reset();syncProtectedStatsController()});
}
window.addEventListener("fa:protected-debug-source-pending",()=>{
 if(!enabled())reset();
});
syncProtectedStatsController();
