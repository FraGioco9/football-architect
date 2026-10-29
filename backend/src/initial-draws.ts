import {canonicalHash,type ApprovedSnapshot} from './catalogue-snapshot.ts';
import type {InitialSchedule} from './initial-schedule.ts';
/** Exact server-owned draw payload shared by persistence and lifecycle validation. */
export async function initialDrawOutcomes(schedule:InitialSchedule,snapshot:ApprovedSnapshot){
 return Promise.all(['int-1','int-2'].map(async competitionId=>{
  const base=competitionId==='int-1'?1:4,clubs=snapshot.bindings.find(b=>b.competitionId===competitionId)!.clubIds;
  const outcome={schemaVersion:1,season:1,competitionId,stageId:'league',algorithmVersion:schedule.algorithmVersion,seed:schedule.seed,
   participantsHash:snapshot.participantsHash,rulesHash:snapshot.rulesHash,calendarHash:schedule.calendarHash,
   pots:Array.from({length:3},(_,p)=>clubs.filter(id=>Number(id.split('-')[1])===base+p)),fixtures:schedule.fixtures.filter(g=>g.competitionId===competitionId)};
  return {competitionId,json:JSON.stringify(outcome),hash:await canonicalHash(outcome)};
 }));
}
