// DEBUG-DATA-01: isolated deterministic knockout resolver driven by canonical catalog rules.
// Draft only: no official DB, no runtime, no published corpus.
import {hash} from "./debug-data-schema.mjs";
const assert=(c,m)=>{if(!c)throw new Error("DEBUG-DATA-01 knockout: "+m)};
const number=(seed,key,max)=>parseInt(hash(seed+":"+key).slice(0,10),16)%max;
export function resolveKnockoutTie({seasonNumber,competitionId,tie,participants,ranking,days,seed}){
 assert(tie&&typeof tie.id==="string"&&(tie.legs===1||tie.legs===2),"tie format");
 assert(Array.isArray(participants)&&participants.length===2&&participants[0]!==participants[1],"participants");
 assert(days?.length===tie.legs&&days.every(d=>Number.isInteger(d)&&d>=1&&d<=56),"event days");
 assert(tie.resolution==="aggregateExtraTimePenalties"||tie.resolution==="singleExtraTimePenalties","resolution");
 const [a,b]=participants;
 const higher=ranking?.get(a)<=ranking?.get(b)?a:b;
 const neutral=tie.homePolicy==="neutral";
 assert(neutral||tie.homePolicy==="higherOriginalTableRank","home policy");
 assert(neutral||ranking?.has(a)&&ranking?.has(b),"missing original ranking for knockout home assignment");
 const fixtures=days.map((day,i)=>{
  const homeId=neutral?a:tie.legs===2?(i===0?(higher===a?b:a):higher):higher;
  const awayId=homeId===a?b:a;
  const eventId=[seasonNumber,competitionId,tie.id,i+1].join(":");
  return {eventId,competitionId,phaseId:tie.id,roundId:tie.id,day,order:200+i,neutral,homeId,awayId,result:{homeGoals:number(seed,eventId+":home",5),awayGoals:number(seed,eventId+":away",5)}};
 });
 const aggregate=new Map([[a,0],[b,0]]);
 for(const match of fixtures){aggregate.set(match.homeId,aggregate.get(match.homeId)+match.result.homeGoals);aggregate.set(match.awayId,aggregate.get(match.awayId)+match.result.awayGoals);}
 let winner=aggregate.get(a)>aggregate.get(b)?a:aggregate.get(a)<aggregate.get(b)?b:null;
 let extraTime=null,penalties=null;
 if(!winner){
  extraTime={homeGoals:number(seed,competitionId+":"+tie.id+":extra:home",3),awayGoals:number(seed,competitionId+":"+tie.id+":extra:away",3)};
  const final=fixtures.at(-1);
  const extraA=final.homeId===a?extraTime.homeGoals:extraTime.awayGoals,extraB=final.homeId===b?extraTime.homeGoals:extraTime.awayGoals;
  if(extraA!==extraB)winner=extraA>extraB?a:b;
  else{
   // Deterministic shootout with decisive kicks, not an arbitrary winner coin flip.
   const homePen=4+number(seed,competitionId+":"+tie.id+":pen:h",3),awayPen=4+number(seed,competitionId+":"+tie.id+":pen:a",3);
   const decidedHome=homePen===awayPen?homePen+1:homePen,decidedAway=awayPen;
   penalties={homeGoals:decidedHome,awayGoals:decidedAway};
   winner=decidedHome>decidedAway?final.homeId:final.awayId;
  }
 }
 const decider=fixtures.at(-1);
 decider.tiebreak={extraTime,penalties,winner,method:penalties?"penalties":extraTime?"extraTime":"aggregate"};
 return {tieId:tie.id,participants:[...participants],fixtures,aggregate:Object.fromEntries(aggregate),extraTime,penalties,winner,loser:winner===a?b:a,resolution:penalties?"penalties":extraTime?"extraTime":"aggregate"};
}
export function resolveCatalogKnockout({seasonNumber,competitionId,rules,rankedClubs,seed}){
 assert(rules?.phases?.length>1&&Array.isArray(rankedClubs)&&new Set(rankedClubs).size===rankedClubs.length,"input");
 const ranking=new Map(rankedClubs.map((id,i)=>[id,i+1]));
 const resolved=new Map(),ties=[],events=[];
 const daysByPhase={playoffs:[36,38],quarterfinals:[41,43],semifinals:[46,48],final:[competitionId==="int-1"?54:53],playout:[54,55],promotionPlayoffs:[54,55,56]};
 for(const phase of rules.phases.filter(p=>p.type==="knockout")){
  for(const tie of phase.ties){
   const participants=tie.participants.map(p=>p.phaseId==="league"?rankedClubs[p.rank-1]:resolved.get(p.tieId)?.winner);
   assert(participants.every(Boolean),"unresolved bracket "+tie.id);
   let days=daysByPhase[phase.id];
   if(phase.id==="promotionPlayoffs")days=tie.id==="final"?[56]:[54,55];
   assert(days?.length>=tie.legs,"missing calendar days");
   const outcome=resolveKnockoutTie({seasonNumber,competitionId,tie,participants,ranking,days:days.slice(0,tie.legs),seed});
   resolved.set(tie.id,outcome);ties.push({...outcome,phaseId:phase.id});events.push(...outcome.fixtures);
  }
 }
 return {ties,events,winner:ties.at(-1)?.winner??null};
}
