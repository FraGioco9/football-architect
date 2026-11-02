// DEBUG-DATA-01 I03: DEV-only transaction using the site's shared presenters.
// Explicit opt-in only. No rendering side effects until commit().
import {prepareProtectedDomesticTransaction} from "./protected-domestic-transaction.mjs";
import {prepareProtectedForm} from "./protected-domestic-form.mjs";
import {mapKnownDomesticPostseason} from "./protected-domestic-knockout-bridge.mjs";
const requireOk=(ok,message)=>{if(!ok)throw Error("I03 presenter: "+message)};
function createRows(model){
 const games=prepareProtectedForm(model.fixtures,model.participants);
 return model.standings.map(r=>({
  club:{...r.club},played:r.played,won:r.won,drawn:r.drawn,lost:r.lost,gf:r.gf,ga:r.ga,gd:r.gd,pts:r.pts,
  recent:games.get(r.club.canonicalId)??[]
 }));
}
export function createSharedDomesticPresenter({context=()=>window.faCompetitionContext}={}){
 return {prepare(model){
  const view=window.faStandingsView,mobile=window.faStandingsMobile,fixtures=window.faFixtures;
  const tbody=document.getElementById("app-standings-body"),list=document.getElementById("app-standings-compact-list");
  requireOk(tbody&&list&&typeof view?.createRow==="function"&&typeof mobile?.prepare==="function"&&typeof fixtures?.prepare==="function"&&typeof fixtures?.snapshot==="function","shared UI not ready");
  const rows=createRows(model);
  const built=rows.map((row,i)=>view.createRow(row,i+1));
  requireOk(built.length===16&&built.every(b=>b?.element),"incomplete standings render");
  const mobileCommit=mobile.prepare(rows);
  requireOk(typeof mobileCommit==="function","mobile renderer missing");
  const fixtureData=model.fixtures.map(g=>({round:g.round,homeId:g.home.clubId,awayId:g.away.clubId,homeGoals:g.homeGoals,awayGoals:g.awayGoals,kickoff:null}));
  const definition=context()?.definition;
  requireOk(definition,"missing shared competition definition");
  const knockout=mapKnownDomesticPostseason(model);
  // The old component cannot render an unknown entrant. Reject the transaction
  // instead of mixing real regular fixtures with invented knockout teams.
  requireOk(knockout.ready,"postseason participants are not yet renderable by shared fixtures");
  const fixtureCommit=fixtures.prepare(fixtureData,{definition,currentMatchday:null,postseason:knockout.fixtures});
  requireOk(typeof fixtureCommit==="function","fixture renderer missing");
  const oldRows=[...tbody.childNodes],oldMobile=[...list.childNodes],restoreFixtures=fixtures.snapshot();
  let committed=false;
  return {participants:model.participants,commit(){
   if(committed)throw Error("I03 presenter already committed");
   try{
    fixtureCommit();
    tbody.replaceChildren(...built.map(b=>b.element));
    mobileCommit();
    committed=true;
   }catch(error){
    restoreFixtures();
    tbody.replaceChildren(...oldRows);
    list.replaceChildren(...oldMobile);
    throw error;
   }
  },rollback(){
   if(!committed)return;
   restoreFixtures();
   tbody.replaceChildren(...oldRows);
   list.replaceChildren(...oldMobile);
   committed=false;
  }};
 }};
}
export function prepareSharedDomesticUpdate(model){
 return prepareProtectedDomesticTransaction({clubs:model.standings.map(r=>r.club),standings:model.standings,fixtures:model.fixtures},
 {prepare:()=>createSharedDomesticPresenter().prepare(model)});
}
