import {canonicalHash,type ApprovedSnapshot} from './catalogue-snapshot.ts';
import {requireGeneratedSchedule,type InitialSchedule} from './initial-schedule.ts';
import {qualificationPots,internationalCountries} from './season-qualification-pots.ts';
/** Exact server-owned draw payload shared by persistence and lifecycle validation. */
export async function initialDrawOutcomes(schedule:InitialSchedule,snapshot:ApprovedSnapshot){
 requireGeneratedSchedule(schedule,snapshot);
 return Promise.all(['int-1','int-2'].map(async competitionId=>{
  const clubs=snapshot.bindings.find(b=>b.competitionId===competitionId)!.clubIds;
  const outcome={schemaVersion:1,season:schedule.season,competitionId,stageId:'league',algorithmVersion:schedule.algorithmVersion,seed:schedule.seed,
   participantsHash:snapshot.participantsHash,rulesHash:snapshot.rulesHash,calendarHash:schedule.calendarHash,
   pots:qualificationPots(clubs,internationalCountries),fixtures:schedule.fixtures.filter(g=>g.competitionId===competitionId)};
  return {competitionId,json:JSON.stringify(outcome),hash:await canonicalHash(outcome)};
 }));
}
