// DEBUG-DATA-01 I02 partial: fresh seeded domestic league results, never legacy Debug outcomes.
import {hash,validateSeasonFragment} from "./debug-data-schema.mjs";
const NATIONAL_DAYS=[13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,34,35,37,39,40,42,44,45,47,49,50,52,53,54];
const score=(seed,id)=>parseInt(hash(seed+":"+id).slice(0,8),16)%5;
export function buildDomesticLeague({datasetId,seasonNumber,competitionId,participants,seed}){
 if(!Array.isArray(participants)||participants.length!==16||new Set(participants).size!==16)throw Error("16 distinct clubs required");
 if(!/^(IT|ENG|ES|DE|FR|PT|NL|BR)-[12]$/.test(competitionId)||!Number.isInteger(seasonNumber)||seasonNumber<1||seasonNumber>5)throw Error("invalid identity");
 if(typeof datasetId!=="string"||!datasetId||typeof seed!=="string"||!seed)throw Error("versioned seed required");
 const teams=[...participants];const events=[];const rotating=[...teams.slice(1)];
 for(let round=0;round<15;round++){
   const seats=[teams[0],...rotating];
   for(let slot=0;slot<8;slot++){
     const a=seats[slot],b=seats[15-slot];
     for(let leg=0;leg<2;leg++){
       const roundNumber=round+1+15*leg;
       const firstHome=(round+slot)%2===0?a:b;
       const homeId=leg===0?firstHome:firstHome===a?b:a,awayId=homeId===a?b:a;
       const eventId=datasetId+":"+seasonNumber+":"+competitionId+":league:"+roundNumber+":"+slot;
       events.push({eventId,competitionId,phaseId:"league",roundId:String(roundNumber),day:NATIONAL_DAYS[roundNumber-1],order:100+slot,homeId,awayId,result:{homeGoals:score(seed,eventId+":h"),awayGoals:score(seed,eventId+":a")}});
     }
   }
   rotating.unshift(rotating.pop());
 }
 events.sort((a,b)=>a.day-b.day||a.order-b.order||a.eventId.localeCompare(b.eventId));
 const fragment={schemaVersion:1,source:{kind:"debug",namespace:"local-debug",datasetId},seasonNumber,competitionId,participants:[...participants],events};
 validateSeasonFragment(fragment);
 if(events.length!==240||new Set(events.map(e=>e.eventId)).size!==240)throw Error("invalid league size");
 const pairs=new Map();for(const e of events){const ids=[e.homeId,e.awayId].sort().join("|");const list=pairs.get(ids)??[];list.push(e);pairs.set(ids,list);}
 if(pairs.size!==120||[...pairs.values()].some(g=>g.length!==2||g[0].homeId!==g[1].awayId||g[0].awayId!==g[1].homeId))throw Error("home/away round-robin parity violated");
 return fragment;
}
export function projectDomesticLeague(fragment,worldDay){
 validateSeasonFragment(fragment);
 if(!Number.isInteger(worldDay)||worldDay<1||worldDay>56)throw Error("invalid world day");
 const played=fragment.events.filter(e=>e.day<=worldDay);
 const table=new Map(fragment.participants.map(id=>[id,{clubId:id,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0}]));
 for(const g of played){const h=table.get(g.homeId),a=table.get(g.awayId);h.played++;a.played++;h.gf+=g.result.homeGoals;h.ga+=g.result.awayGoals;a.gf+=g.result.awayGoals;a.ga+=g.result.homeGoals;if(g.result.homeGoals>g.result.awayGoals){h.won++;a.lost++;h.pts+=3;}else if(g.result.homeGoals<g.result.awayGoals){a.won++;h.lost++;a.pts+=3;}else{h.drawn++;a.drawn++;h.pts++;a.pts++;}}
 // Provisional order only: official head-to-head tiebreakers must replace this in I02 completion.
 return {fixtures:fragment.events.map(e=>e.day<=worldDay?e:{...e,result:null}),standings:[...table.values()].sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||a.clubId.localeCompare(b.clubId))};
}
