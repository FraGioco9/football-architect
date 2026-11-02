// DEBUG-DATA-01: INT24 pots from current season's approved participant order.
// Exactly mirrors 3 pots x 8 country ordering contract; no club-ID ranking inference.
import {DEBUG_COUNTRIES} from "./debug-data-schema.mjs";
export function buildInternationalPots(participants,countryOrder=DEBUG_COUNTRIES){
 if(!Array.isArray(participants)||participants.length!==24||new Set(participants).size!==24)throw Error("24 participants required");
 if(countryOrder?.length!==8||new Set(countryOrder).size!==8||DEBUG_COUNTRIES.some(c=>!countryOrder.includes(c)))throw Error("eight countries required");
 const byCountry=new Map(countryOrder.map(c=>[c,participants.filter(id=>id.startsWith(c+"-"))]));
 if([...byCountry.values()].some(ids=>ids.length!==3))throw Error("three qualifiers per country required");
 return Object.freeze([0,1,2].map(index=>Object.freeze(countryOrder.map(c=>byCountry.get(c)[index]))));
}
export function validateInternationalPotDraw({participants,pots,events}){
 if(pots?.length!==3||pots.some(p=>p.length!==8))throw Error("three pots required");
 const all=pots.flat();
 if(new Set(all).size!==24||new Set(participants).size!==24||participants.some(c=>!all.includes(c)))throw Error("pots mismatch");
 const potOf=new Map(all.map((clubId,index)=>[clubId,Math.floor(index/8)])),stat=new Map(participants.map(c=>[c,{opponents:new Set(),home:0,away:0,byPot:[[0,0],[0,0],[0,0]]}]));
 for(const match of events){
  const h=stat.get(match.homeId),a=stat.get(match.awayId);
  if(!h||!a||match.homeId.split("-")[0]===match.awayId.split("-")[0])throw Error("invalid opponent");
  if(h.opponents.has(match.awayId)||a.opponents.has(match.homeId))throw Error("repeated opponent");
  h.opponents.add(match.awayId);a.opponents.add(match.homeId);h.home++;a.away++;
  h.byPot[potOf.get(match.awayId)][0]++;a.byPot[potOf.get(match.homeId)][1]++;
 }
 const valid=[...stat.values()].every(x=>x.home===3&&x.away===3&&x.opponents.size===6&&x.byPot.every(([home,away])=>home===1&&away===1));
 if(!valid)throw Error("INT24 two opponents per pot (1 home/1 away) violated");
 return true;
}
