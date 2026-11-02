// DEBUG-DATA-01 I03: opt-in, reversible transaction over the shared presenters.
import {prepareProtectedDomesticTransaction} from "./dev-protected-domestic-transaction.mjs";
import {prepareProtectedForm} from "./dev-protected-domestic-form.mjs";
import {mapKnownDomesticPostseason,prepareProtectedBracket} from "./dev-protected-domestic-knockout-bridge.mjs";
const requireOk=(ok,message)=>{if(!ok)throw Error("I03 presenter: "+message)};
function createRows(model){
 const games=prepareProtectedForm(model.fixtures,model.participants);
 const clubs=new Map(model.standings.map(row=>[row.club.canonicalId,row.club]));
 return model.standings.map(r=>({
  club:{...r.club},played:r.played,won:r.won,drawn:r.drawn,lost:r.lost,gf:r.gf,ga:r.ga,gd:r.gd,pts:r.pts,
  recent:(games.get(r.club.canonicalId)??[]).map(game=>({...game,
   homeId:clubs.get(game.homeId).clubId,awayId:clubs.get(game.awayId).clubId}))
 }));
}
export function createSharedDomesticPresenter({context=()=>window.faCompetitionContext}={}){
 return {prepare(model){
  const view=window.faStandingsView,mobile=window.faStandingsMobile,fixtures=window.faFixtures,postseason=window.faPostseason;
  const tbody=document.getElementById("app-standings-body"),list=document.getElementById("app-standings-compact-list");
  requireOk(tbody&&list&&typeof view?.createRow==="function"&&typeof view?.attachFormTooltips==="function"&&typeof view?.suspendFormTooltips==="function"&&typeof mobile?.prepare==="function"&&typeof fixtures?.prepare==="function"&&typeof fixtures?.snapshot==="function"&&typeof postseason?.prepare==="function"&&typeof postseason?.snapshot==="function","shared UI not ready");
  const previousContext=context(),definition=previousContext?.definition;
  requireOk(definition?.id===model.competitionId,"missing or mismatched competition definition");
  const rows=createRows(model),participants=rows.map(row=>row.club);
  const built=rows.map((row,i)=>view.createRow(row,i+1));
  requireOk(built.length===16&&built.every(b=>b?.element),"incomplete standings render");
  const mobileCommit=mobile.prepare(rows);
  requireOk(typeof mobileCommit==="function","mobile renderer missing");
  const fixtureData=model.fixtures.map(g=>({round:g.round,homeId:g.home.clubId,awayId:g.away.clubId,homeGoals:g.homeGoals,awayGoals:g.awayGoals,kickoff:null}));
  const knockout=mapKnownDomesticPostseason(model);
  const bracket=prepareProtectedBracket(model,definition,rows);
  const current=bracket.matchday>=30?window.faCompetitionRules.fixtureChoices(definition).find(choice=>typeof choice.value==='string')?.value??null:Math.max(1,bracket.matchday);
  const fixtureCommit=fixtures.prepare(fixtureData,{definition,participants,currentMatchday:current,postseason:knockout.fixtures});
  const postCommit=postseason.prepare(rows,bracket,definition,{participants});
  requireOk(typeof fixtureCommit==="function"&&typeof postCommit==="function","fixture or bracket renderer missing");
  const seasonData={season:model.season,competitionId:model.competitionId,rulesVersion:definition.rules.version,rulesSnapshot:definition.rules,
   participants,fixtures:fixtureData,results:fixtureData.filter(g=>g.homeGoals!==null),postseason:knockout.fixtures,
   statistics:{standings:rows},status:model.status==='complete'?'available':'partial',provenance:{...model.source},worldDay:model.worldDay};
  const contextUpdate=window.faCompetitionContextApi?.prepareProtectedSeasonData(seasonData,previousContext.revision);
  requireOk(contextUpdate,"shared context transaction unavailable");
  const oldRows=[...tbody.childNodes],oldMobile=[...list.childNodes],restoreFixtures=fixtures.snapshot(),restorePostseason=postseason.snapshot();
  const focused=document.activeElement;
  // Find the corresponding control after a data-row replacement, without moving
  // focus into a row the user wasn't interacting with.
  const formOwner=focused?.closest?.('[data-world-club]');
  const formIndex=formOwner?[...formOwner.querySelectorAll('.app-world-form-dot')].indexOf(focused):-1;
  const detailsId=focused?.closest?.('li[data-world-club]')?.dataset.worldClub;
  const expanded=new Set([...list.querySelectorAll('details[open]')].map(el=>el.closest('[data-world-club]')?.dataset.worldClub));
  const scrollHosts=[document.scrollingElement,document.querySelector(".fa-shell-content-scroll"),document.querySelector(".app-world-standing-scroll")].filter(Boolean);
  const scroll=scrollHosts.map(el=>({el,top:el.scrollTop,left:el.scrollLeft}));
  const restorePosition=()=>{
   let target=focused?.isConnected?focused:null;
   if(!target&&formOwner&&formIndex>=0){const host=formOwner.tagName==='TR'?tbody:list;
    target=[...host.querySelectorAll('[data-world-club]')].find(el=>el.dataset.worldClub===formOwner.dataset.worldClub)?.querySelectorAll('.app-world-form-dot')[formIndex];}
   if(!target&&detailsId)target=[...list.children].find(el=>el.dataset.worldClub===detailsId)?.querySelector('summary');
   if(target&&document.activeElement!==target)target.focus({preventScroll:true});
   for(const {el,top,left} of scroll){el.scrollTop=top;el.scrollLeft=left;}
  };
  let committed=false,cleanupForm=()=>{},resumeForm=()=>{};
  const restore=()=>{
   cleanupForm();cleanupForm=()=>{};
   contextUpdate.rollback();restoreFixtures();restorePostseason();
   tbody.replaceChildren(...oldRows);list.replaceChildren(...oldMobile);resumeForm();resumeForm=()=>{};restorePosition();
  };
  return {participants:model.participants,commit(){
   if(committed)throw Error("I03 presenter already committed");
   try{
    resumeForm=view.suspendFormTooltips();
    contextUpdate.commit();fixtureCommit();postCommit();
    tbody.replaceChildren(...built.map(b=>b.element));mobileCommit(false,{reuseCrests:false});
    for(const item of list.children)if(expanded.has(item.dataset.worldClub))item.querySelector('details')?.setAttribute('open','');
    const entries=[...built.flatMap(row=>row.entries),...(mobileCommit.entries??[])];
    cleanupForm=view.attachFormTooltips(new Map(participants.map(club=>[club.clubId,club])),entries)??(()=>{});
    window.faAppRenderLanguage?.();restorePosition();committed=true;
    contextUpdate.publish();
   }catch(error){restore();committed=false;throw error;}
  },rollback(){
   if(!committed)return;
   // A newer official/route context owns the DOM now. Only dispose our listeners.
   if(contextUpdate.isCurrent()){
    const position=scrollHosts.map(el=>({el,top:el.scrollTop,left:el.scrollLeft}));
    const active=document.activeElement,owner=active?.closest?.('[data-world-club]');
    const index=owner?[...owner.querySelectorAll('.app-world-form-dot')].indexOf(active):-1;
    const open=new Set([...list.querySelectorAll('details[open]')].map(el=>el.closest('[data-world-club]')?.dataset.worldClub));
    restore();
    for(const item of list.children){const details=item.querySelector('details');if(details)details.open=open.has(item.dataset.worldClub);}
    if(owner){const host=owner.tagName==='TR'?tbody:list;
     const replacement=[...host.querySelectorAll('[data-world-club]')].find(el=>el.dataset.worldClub===owner.dataset.worldClub);
     const target=index>=0?replacement?.querySelectorAll('.app-world-form-dot')[index]:replacement?.querySelector('summary');
     target?.focus({preventScroll:true});}
    for(const {el,top,left} of position){el.scrollTop=top;el.scrollLeft=left;}
   }else{cleanupForm();cleanupForm=()=>{};resumeForm();resumeForm=()=>{};}
   committed=false;
  }};
 }};
}
export function prepareSharedDomesticUpdate(model){
 return prepareProtectedDomesticTransaction({clubs:model.standings.map(r=>r.club),standings:model.standings,fixtures:model.fixtures},
 {prepare:()=>createSharedDomesticPresenter().prepare(model)});
}
