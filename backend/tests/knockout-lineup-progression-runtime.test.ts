import {describe,it,expect} from 'vitest';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {buildInitialSchedule} from '../src/initial-schedule.ts';
import {
 createProgression,processSportingDayWithResolver,type FinalizedSportingMatch
} from '../src/knockout-progression.ts';
import {simulateMatchV1} from '../src/temporary-lineup-v1.mjs';

const seed='knockout-lineup-resolver-test-0001';
type NewScore=FinalizedSportingMatch & {algorithmVersion:'temporary-lineup-v1'};
const setup=async()=>{
 const snapshot=await loadApprovedSnapshot();
 const schedule=await buildInitialSchedule(snapshot,seed);
 return createProgression<NewScore>(snapshot,schedule);
};
const resolver=async(fixture:Parameters<Parameters<typeof processSportingDayWithResolver<NewScore>>[2]>[0],
 context:Parameters<Parameters<typeof processSportingDayWithResolver<NewScore>>[2]>[1]):Promise<NewScore>=>{
 const result=await simulateMatchV1({
  homeRoster:[],awayRoster:[],matchKey:fixture.id,seed,
  homeClubId:fixture.homeClubId,awayClubId:fixture.awayClubId,context
 });
 return {fixtureId:fixture.id,algorithmVersion:result.algorithmVersion,
  context:result.context,regulation:result.regulation,extraTime:result.extraTime,
  penalties:result.penalties,homeGoals:result.homeGoals,awayGoals:result.awayGoals,
  winnerClubId:result.winnerClubId,resolution:result.resolution};
};

describe('#613 single-engine canonical sporting progression',()=>{
 it('uses one new scorer on each due fixture, no caller-supplied schedules or legacy score delegation',async()=>{
  const state=await setup(),calls:string[]=[];
  let played=0;
  for(let day=1;day<=14;day++){
   const out=await processSportingDayWithResolver(state,day,async(f,context)=>{
    calls.push(f.id);
    return resolver(f,context);
   });
   expect(out.results.every(r=>r.algorithmVersion==='temporary-lineup-v1')).toBe(true);
   expect(out.results.every(r=>r.fixtureId.startsWith('season:1:'))).toBe(true);
   played+=out.results.length;
  }
  expect(state.lastDay).toBe(14);
  expect(state.results.size).toBe(played);
  expect(new Set(calls).size).toBe(played);
  expect(played).toBeGreaterThan(0);
  // Frozen score replay must not depend on today's player roster.
  const restored=await setup();
  for(let day=1;day<=14;day++){
   await processSportingDayWithResolver(restored,day,async(f,context)=>{
    const stored=state.results.get(f.id);
    if(!stored||JSON.stringify(stored.context)!==JSON.stringify(context))throw Error('missing frozen receipt');
    return stored;
   });
  }
  expect([...restored.results]).toEqual([...state.results]);
 },30000);

 it('rejects forged, missing or impossible result and preserves world progression draft',async()=>{
  const state=await setup();
  for(let d=1;d<=12;d++)await processSportingDayWithResolver(state,d,resolver);
  const dayBefore=state.lastDay,sizeBefore=state.results.size;
  await expect(processSportingDayWithResolver(state,13,async(f,context)=>{
   const r=await resolver(f,context);
   return {...r,fixtureId:f.id+':forged'};
  })).rejects.toMatchObject({status:422});
  expect(state.lastDay).toBe(dayBefore);
  expect(state.results.size).toBe(sizeBefore);
  await expect(processSportingDayWithResolver(state,13,async(f,context)=>{
   const r=await resolver(f,context);
   return {...r,context:{mode:'single-knockout'} as any};
  })).rejects.toMatchObject({status:422});
  expect(state.lastDay).toBe(dayBefore);
  await expect(processSportingDayWithResolver(state,13,async(f,context)=>{
   const r=await resolver(f,context);
   return {...r,homeGoals:r.homeGoals+1};
  })).rejects.toMatchObject({status:422});
  expect(state.lastDay).toBe(dayBefore);
 },30000);
});
