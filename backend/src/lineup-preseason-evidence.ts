/** #613 — clean-break calendar publication: PRESEASON ONLY.
 * A published calendar cannot generate even one future score. The 12 opening
 * administrative days contain no official fixture; store empty V2 receipts.
 * This planner is pure, and its inputs must be the server's approved schedule.
 */
import calendarModel from '../../assets/world-calendar-model.js';
import type {ApprovedSnapshot} from './catalogue-snapshot.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {requireGeneratedSchedule,type InitialSchedule} from './initial-schedule.ts';
import {ApiError} from './errors.ts';
import {buildLineupDayEvidenceV2,type LineupDailyEvidenceV2} from './lineup-day-evidence-v2.mjs';

export interface EmptyLineupPreseasonDayV1 {
 day:number;hash:string;json:string;payload:LineupDailyEvidenceV2['payload'];
}
const fail=():never=>{throw new ApiError(422,'lineup_preseason_evidence_invalid')};

/** No stored matches, scoring calls, affiliations, side effects or partial replay.
 * Calendar publication seals exactly days 1..world.day as empty completed days.
 */
export async function planEmptyLineupPreseasonV1(args:{
 snapshot:ApprovedSnapshot;schedule:InitialSchedule;generation:string;
 throughDay:number;calendarHash:string
}):Promise<EmptyLineupPreseasonDayV1[]>{
 const {snapshot,schedule,generation,throughDay,calendarHash}=args;
 try{requireGeneratedSchedule(schedule,snapshot)}catch{return fail()}
 if(!Number.isInteger(throughDay)||throughDay<1||throughDay>12||
  !Number.isSafeInteger(schedule.season)||schedule.season<1||
  !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(generation)||
  !/^[0-9a-f]{64}$/.test(calendarHash)||calendarHash!==await canonicalHash(schedule))
  return fail();
 const calendar=calendarModel.createSeason(schedule.season);
 if(!Array.isArray(schedule.fixtures)||!Array.isArray(calendar.days)||
  calendar.days.length!==56||calendar.days.slice(0,throughDay).some(day=>day.events.length>0)||
  schedule.fixtures.some(f=>f.day<=throughDay))
  return fail();
 const result:EmptyLineupPreseasonDayV1[]=[];
 for(let day=1;day<=throughDay;day++){
  const evidence=await buildLineupDayEvidenceV2({
   generation,season:schedule.season,day,calendarHash,dueFixtures:[],receipts:[]
  });
  if(evidence.payload.results.length!==0||evidence.payload.simulationVersion!=='temporary-lineup-v1')
   return fail();
  result.push({day,hash:evidence.hash,json:JSON.stringify(evidence.payload),
   payload:evidence.payload});
 }
 return result;
}
