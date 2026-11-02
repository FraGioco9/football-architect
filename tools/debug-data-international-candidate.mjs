// DEBUG-DATA-01: isolated translation of approved backend initial-schedule.ts
// INT24 constructive fixture algorithm. Never imported by public runtime.
import {hash,DEBUG_COUNTRIES} from "./debug-data-schema.mjs";
import {buildInternationalPots,validateInternationalPotDraw} from "./debug-data-international-pots.mjs";
const DAYS=[16,19,22,25,28,31];
const score=(seed,id)=>parseInt(hash(seed+":"+id).slice(0,8),16)%5;
const shuffle=(items,key)=>{
 const arr=[...items];
 // Seeded Fisher-Yates: deterministic and independent of platform RNG.
 for(let i=arr.length-1;i>0;i--){const j=parseInt(hash(key+":"+i).slice(0,12),16)%(i+1);[arr[i],arr[j]]=[arr[j],arr[i]];}
 return arr;
};
export function deriveInternationalParticipants(placements,cupId){
 if(!["int-1","int-2"].includes(cupId))throw Error("invalid cup ID");
 const offset=cupId==="int-1"?0:3,clubs=[];
 for(const country of DEBUG_COUNTRIES){const ranks=placements[country];if(!Array.isArray(ranks)||ranks.length!==16||new Set(ranks).size!==16)throw Error("invalid placement "+country);clubs.push(...ranks.slice(offset,offset+3));}
 if(new Set(clubs).size!==24)throw Error("duplicate qualified clubs");
 return clubs;
}
export function buildInternationalLeagueCandidate({seasonNumber,cupId,participants,seed,datasetId}){
 if(!Number.isInteger(seasonNumber)||seasonNumber<1||seasonNumber>5||!["int-1","int-2"].includes(cupId))throw Error("invalid cup identity");
 if(!Array.isArray(participants)||participants.length!==24||!seed||!datasetId)throw Error("invalid draw inputs");
 const order=shuffle(DEBUG_COUNTRIES,seed+":"+seasonNumber+":"+cupId+":countries");
 const pots=buildInternationalPots(participants,order);
 const rounds=shuffle([0,1,2,3,4,5],seed+":"+seasonNumber+":"+cupId+":rounds");
 const layouts=[[0,1,2],[0,2,1],[1,2,0],[1,0,2],[2,0,1],[2,1,0]];
 const events=[];
 for(let r=0;r<6;r++){
  const [intra,homePot,awayPot]=layouts[r],round=rounds[r]+1;
  const add=(homeId,awayId,slot)=>{
   const eventId=[datasetId,seasonNumber,cupId,"I"+String(round).padStart(2,"0"),slot,homeId,awayId].join(":");
   events.push({eventId,competitionId:cupId,phaseId:"league",roundId:String(round),day:DAYS[round-1],order:100+slot,homeId,awayId,result:{homeGoals:score(seed,eventId+":h"),awayGoals:score(seed,eventId+":a")}});
  };
  for(let i=r%2;i<8;i+=2)add(pots[intra][i],pots[intra][(i+1)%8],Math.floor(i/2));
  for(let i=0;i<8;i++)add(pots[homePot][i],pots[awayPot][(i+1)%8],4+i);
 }
 events.sort((a,b)=>a.day-b.day||a.order-b.order||a.eventId.localeCompare(b.eventId));
 if(events.length!==72||new Set(events.map(e=>e.eventId)).size!==72)throw Error("wrong INT24 fixture count");
 validateInternationalPotDraw({participants,pots,events});
 return {schemaVersion:1,kind:"unsealed-international-league-candidate",source:{kind:"debug",namespace:"local-debug",datasetId},seasonNumber,competitionId:cupId,participants:[...participants],pots,events,drawAlgorithm:"backend-initial-leagues-v1-constructive"};
}
