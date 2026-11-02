// DEBUG-DATA-01: deterministic postseason and cross-season domestic membership.
// DEV-only offline exporter domain module; no network, official APIs or D1 writes.
import {hash,DEBUG_COUNTRIES} from "./debug-data-schema.mjs";
import {rankDomesticLeague} from "./debug-data-domestic-ranking.mjs";
const requireRule=(ok,message)=>{if(!ok)throw new Error("DEBUG-DATA-01: "+message);};
const score=(seed,id)=>parseInt(hash(seed+":"+id).slice(0,8),16)%5;
const choose=(seed,id,first,second)=>parseInt(hash(seed+":decision:"+id).slice(0,8),16)%2?first:second;
export function tableForClosure(fragment,rules,seed){
 const table=rankDomesticLeague(fragment,rules,seed);
 requireRule(table.length===16&&table.every(x=>x.played===30),"incomplete league");
 // This provisional ranking is NOT the complete approved head-to-head tiebreak rule.
 return table;
}
export function resolveTie({seasonNumber,competitionId,tieId,participants,legs,seed,day=55}){
 requireRule(participants?.length===2&&participants[0]!==participants[1],"tie participants");
 requireRule(legs===1||legs===2,"tie legs");
 const [first,second]=participants;
 const fixtures=Array.from({length:legs},(_,index)=>{
  const homeId=legs===1?first:index===0?second:first;
  const awayId=homeId===first?second:first;
  const eventId=[seasonNumber,competitionId,tieId,index+1].join(":");
  return {eventId,competitionId,phaseId:tieId,roundId:tieId,day:legs===2?day-1+index:day,order:200+index,homeId,awayId,result:{homeGoals:score(seed,eventId+":home"),awayGoals:score(seed,eventId+":away")}};
 });
 const aggregate=new Map(participants.map(id=>[id,0]));
 for(const fixture of fixtures){aggregate.set(fixture.homeId,aggregate.get(fixture.homeId)+fixture.result.homeGoals);aggregate.set(fixture.awayId,aggregate.get(fixture.awayId)+fixture.result.awayGoals);}
 const winner=aggregate.get(first)===aggregate.get(second)?choose(seed,tieId,first,second):aggregate.get(first)>aggregate.get(second)?first:second;
 return {tieId,participants:[...participants],legs,fixtures,winner,loser:winner===first?second:first,aggregate:Object.fromEntries(aggregate),resolution:aggregate.get(first)===aggregate.get(second)?"deterministic-tiebreak-placeholder":"aggregate"};
}
export function resolveDomesticPostseason({seasonNumber,competitionId,fragment,seed}){
 const order=tableForClosure(fragment,arguments[0].rules,seed).map(x=>x.clubId);
 const tier=Number(competitionId.split("-")[1]);
 requireRule(tier===1||tier===2,"invalid tier");
 if(tier===1){
  const playout=resolveTie({seasonNumber,competitionId,tieId:"playout",participants:[order[12],order[13]],legs:2,seed,day:55});
  return {competitionId,rankedClubs:order,ties:[playout],promoted:[],relegated:[order[14],order[15],playout.loser],champion:order[0]};
 }
 const semi36=resolveTie({seasonNumber,competitionId,tieId:"semi36",participants:[order[2],order[5]],legs:2,seed,day:55});
 const semi45=resolveTie({seasonNumber,competitionId,tieId:"semi45",participants:[order[3],order[4]],legs:2,seed,day:55});
 const final=resolveTie({seasonNumber,competitionId,tieId:"final",participants:[semi36.winner,semi45.winner],legs:1,seed,day:56});
 return {competitionId,rankedClubs:order,ties:[semi36,semi45,final],promoted:[order[0],order[1],final.winner],relegated:[],champion:order[0]};
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
