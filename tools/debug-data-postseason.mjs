// DEBUG-DATA-01: domestic results and membership from canonical rules.
// Uses the same tie resolver as international cups; no arbitrary tie winners.
import {DEBUG_COUNTRIES} from "./debug-data-schema.mjs";
import {rankDomesticLeague} from "./debug-data-domestic-ranking.mjs";
import {resolveKnockoutTie} from "./debug-data-knockout.mjs";
const requireRule=(ok,message)=>{if(!ok)throw new Error("DEBUG-DATA-01: "+message)};
export function tableForClosure(fragment,rules,seed){
 const table=rankDomesticLeague(fragment,rules,seed);
 requireRule(table.length===16&&table.every(row=>row.played===30),"incomplete domestic league");
 return table;
}
export function resolveDomesticPostseason({seasonNumber,competitionId,fragment,rules,seed}){
 const table=tableForClosure(fragment,rules,seed),order=table.map(x=>x.clubId);
 const tier=Number(competitionId.split("-")[1]),phase=rules?.phases?.find(p=>p.type==="knockout");
 requireRule([1,2].includes(tier)&&phase?.ties?.length===(tier===1?1:3),"canonical domestic knockout phase missing");
 const ranking=new Map(order.map((club,i)=>[club,i+1])),resolved=new Map(),ties=[];
 // N31/N32/N33: world days 52/53/54 (final N33 only for Tier 2).
 const markers={semi36:["N31","N32"],semi45:["N31","N32"],playout:["N31","N32"],final:["N33"]};
 const markerDay={N31:52,N32:53,N33:54};
 for(const tie of phase.ties){
  const participants=tie.participants.map(ref=>ref.phaseId==="league"?order[ref.rank-1]:resolved.get(ref.tieId)?.winner);
  requireRule(participants.length===2&&participants.every(Boolean),"invalid domestic bracket "+tie.id);
  const tieMarkers=markers[tie.id];
  requireRule(tieMarkers?.length===tie.legs,"invalid domestic leg mapping "+tie.id);
  const result=resolveKnockoutTie({seasonNumber,competitionId,tie,participants,ranking,days:tieMarkers.map(m=>markerDay[m]),seed});
  const enriched={...result,phaseId:phase.id,markers:tieMarkers};
  resolved.set(tie.id,enriched);ties.push(enriched);
 }
 if(tier===1){
  const playout=resolved.get("playout");
  requireRule(Boolean(playout),"missing playout");
  return {competitionId,rankedClubs:order,ties,promoted:[],relegated:[order[14],order[15],playout.loser],champion:order[0]};
 }
 const final=resolved.get("final");
 requireRule(Boolean(final),"missing promotion final");
 return {competitionId,rankedClubs:order,ties,promoted:[order[0],order[1],final.winner],relegated:[],champion:order[0]};
}
export function nextDomesticMembership(memberships,outcomes){
 const current=new Map(memberships);
 const result=new Map();
 for(const country of DEBUG_COUNTRIES){
  const top=country+"-1",second=country+"-2";
  const a=outcomes.get(top),b=outcomes.get(second);
  requireRule(a&&b&&a.relegated.length===3&&b.promoted.length===3,"incomplete postseason "+country);
  const topMembers=current.get(top),secondMembers=current.get(second);
  requireRule(topMembers?.length===16&&secondMembers?.length===16,"missing division membership "+country);
  const topNext=[...topMembers.filter(id=>!a.relegated.includes(id)),...b.promoted];
  const secondNext=[...secondMembers.filter(id=>!b.promoted.includes(id)),...a.relegated];
  requireRule(topNext.length===16&&secondNext.length===16&&new Set([...topNext,...secondNext]).size===32,"invalid promotion/relegation "+country);
  result.set(top,topNext);result.set(second,secondNext);
 }
 return result;
}
