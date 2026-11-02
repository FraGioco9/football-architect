// DEBUG-DATA-01 I02 isolated INT24 league-phase draw candidate (not runtime-enabled).
import {hash,DEBUG_COUNTRIES} from "./debug-data-schema.mjs";
const DAYS=[16,19,22,25,28,31];
const country=id=>id.split("-")[0];
const score=(seed,key)=>parseInt(hash(seed+":"+key).slice(0,8),16)%5;
export function deriveInternationalParticipants(placements,cupId){
 if(!["int-1","int-2"].includes(cupId))throw Error("invalid cup ID");
 const offset=cupId==="int-1"?0:3, clubs=[];
 for(const c of DEBUG_COUNTRIES){const ranks=placements[c];if(!Array.isArray(ranks)||ranks.length!==16||new Set(ranks).size!==16)throw Error("invalid top-tier order: "+c);clubs.push(...ranks.slice(offset,offset+3));}
 if(new Set(clubs).size!==24)throw Error("duplicate qualified clubs");
 return clubs;
}
export function buildInternationalLeagueCandidate({seasonNumber,cupId,participants,seed,datasetId}){
 if(!Number.isInteger(seasonNumber)||seasonNumber<1||seasonNumber>5||!["int-1","int-2"].includes(cupId))throw Error("invalid cup");
 if(participants?.length!==24||new Set(participants).size!==24||!seed||!datasetId)throw Error("invalid participants/seed");
 const countries=DEBUG_COUNTRIES.map(c=>participants.filter(id=>country(id)===c).sort((a,b)=>hash(seed+":"+a).localeCompare(hash(seed+":"+b))));
 if(countries.some(g=>g.length!==3))throw Error("three clubs per country required");
 // First six of seven rounds in the 8-country circle method: unique country opponents.
 const wheel=[0,1,2,3,4,5,6,7],edges=[];
 for(let round=0;round<6;round++){
  for(let slot=0;slot<4;slot++)edges.push({round,slot,a:wheel[slot],b:wheel[7-slot]});
  wheel.splice(1,0,wheel.pop());
 }
 // The country graph has even degree 6. Euler orientation gives every country 3H/3A.
 const adjacency=Array.from({length:8},()=>[]);
 edges.forEach((e,i)=>{adjacency[e.a].push(i);adjacency[e.b].push(i)});
 const used=new Set(),stack=[0],edgeStack=[],directed=new Map();
 while(stack.length){
  const u=stack[stack.length-1];
  const next=adjacency[u].find(id=>!used.has(id));
  if(next===undefined){stack.pop();if(edgeStack.length){const {edgeId,from,to}=edgeStack.pop();directed.set(edgeId,{from,to});}}else{
   used.add(next);const e=edges[next],v=e.a===u?e.b:e.a;edgeStack.push({edgeId:next,from:u,to:v});stack.push(v);
  }
 }
 if(used.size!==24)throw Error("country draw graph disconnected");
 const events=[];
 for(let edgeId=0;edgeId<edges.length;edgeId++){
  const {round,slot}=edges[edgeId],{from,to}=directed.get(edgeId);
  for(let i=0;i<3;i++){
   const homeId=countries[from][i],awayId=countries[to][(i+round+slot)%3];
   const eventId=[datasetId,seasonNumber,cupId,"I"+String(round+1).padStart(2,"0"),slot,i].join(":");
   events.push({eventId,competitionId:cupId,phaseId:"league",roundId:String(round+1),day:DAYS[round],order:100+slot*3+i,homeId,awayId,result:{homeGoals:score(seed,eventId+":h"),awayGoals:score(seed,eventId+":a")}});
  }
 }
 const stat=new Map(participants.map(id=>[id,{home:0,away:0,opponents:new Set()}]));
 for(const e of events){if(country(e.homeId)===country(e.awayId))throw Error("same-country match");const h=stat.get(e.homeId),a=stat.get(e.awayId);h.home++;a.away++;h.opponents.add(e.awayId);a.opponents.add(e.homeId);}
 if(events.length!==72||[...stat.values()].some(s=>s.home!==3||s.away!==3||s.opponents.size!==6))throw Error("INT24 draw constraint violation");
 return {schemaVersion:1,kind:"unsealed-international-league-candidate",source:{kind:"debug",namespace:"local-debug",datasetId},seasonNumber,competitionId:cupId,participants:[...participants],events};
}
