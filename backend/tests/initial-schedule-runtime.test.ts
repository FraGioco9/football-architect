import {describe,it,expect} from 'vitest';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {buildInitialSchedule,validateInitialSchedule} from '../src/initial-schedule.ts';
const seed='0123456789abcdef0123456789abcdef';
describe('canonical initial sporting schedules',()=>{
 it('creates 3984 scoreless fixtures on canonical days, preserving all domestic pairings and cup pot constraints',async()=>{
  const snapshot=await loadApprovedSnapshot(),schedule=await buildInitialSchedule(snapshot,seed);
  expect(schedule.fixtures).toHaveLength(3984);
  for(const binding of snapshot.bindings){
   const games=schedule.fixtures.filter(g=>g.competitionId===binding.competitionId),cup=binding.competitionId.startsWith('int-');
   expect(games).toHaveLength(cup?72:240);
   for(let round=1;round<=(cup?6:30);round++){
    const matches=games.filter(g=>g.round===round);
    expect(matches).toHaveLength(cup?12:8);
    expect(new Set(matches.flatMap(g=>[g.homeClubId,g.awayClubId])).size).toBe(cup?24:16);
    expect(matches.every(g=>g.day===(cup?[16,19,22,25,28,31]:[13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,34,35,37,39,40,42,44,45,47,49,50])[round-1])).toBe(true);
   }
   for(const club of binding.clubIds){
    const home=games.filter(g=>g.homeClubId===club),away=games.filter(g=>g.awayClubId===club);
    expect(home).toHaveLength(cup?3:15);expect(away).toHaveLength(cup?3:15);
    const opponents=[...home.map(g=>g.awayClubId),...away.map(g=>g.homeClubId)];
    expect(new Set(opponents).size).toBe(cup?6:15);
    if(cup){
     expect(opponents.every(id=>id.split('-')[0]!==club.split('-')[0])).toBe(true);
     const base=binding.competitionId==='int-1'?1:4;
     for(let p=base;p<base+3;p++){
      expect(home.filter(g=>Number(g.awayClubId.split('-')[1])===p)).toHaveLength(1);
      expect(away.filter(g=>Number(g.homeClubId.split('-')[1])===p)).toHaveLength(1);
     }
    }else for(const opponent of binding.clubIds.filter(id=>id!==club)){
     expect(home.filter(g=>g.awayClubId===opponent)).toHaveLength(1);
     expect(away.filter(g=>g.homeClubId===opponent)).toHaveLength(1);
    }
   }
  }
  expect(JSON.stringify(schedule)).not.toMatch(/"score"|"winner"|"homeGoals"/);
  expect(schedule.pendingPhases).toHaveLength(18);
  await expect(validateInitialSchedule(schedule,snapshot)).resolves.toBeUndefined();
 });
 it('places international matches before domestic matches on every approved double matchday',async()=>{
  const schedule=await buildInitialSchedule(await loadApprovedSnapshot(),seed);
  for(const day of [16,19,22,25,28,31]){
   const fixtures=schedule.fixtures.filter(g=>g.day===day);
   expect(fixtures.slice(0,24).every(g=>g.marker.startsWith('I'))).toBe(true);
   expect(fixtures.slice(24).every(g=>g.marker.startsWith('N'))).toBe(true);
  }
 });
 it('reproduces complete schedules for 32 seeds and varies the saved outcome',async()=>{
  const snapshot=await loadApprovedSnapshot(),hashes=new Set<string>();
  for(let i=0;i<32;i++){
   const key=seed+i,a=await buildInitialSchedule(snapshot,key),b=await buildInitialSchedule(snapshot,key);
   expect(a).toEqual(b);await validateInitialSchedule(a,snapshot);hashes.add(a.fixtures[0].homeClubId+':'+a.fixtures[0].awayClubId);
  }
  expect(hashes.size).toBeGreaterThan(10);
 });
 it('rejects corrupt membership, seed, day, score, pair and source bindings',async()=>{
  const snapshot=await loadApprovedSnapshot();
  for(const key of ['', 'short','x'.repeat(257)])await expect(buildInitialSchedule(snapshot,key)).rejects.toMatchObject({status:422});
  await expect(buildInitialSchedule(structuredClone(snapshot),seed)).rejects.toMatchObject({status:422});
  const original=await buildInitialSchedule(snapshot,seed);
  for(const mutate of [
   (s:any)=>s.fixtures[0].day=1,(s:any)=>s.fixtures[0].awayClubId=s.fixtures[0].homeClubId,
   (s:any)=>s.fixtures[0].score='0-0',(s:any)=>s.fixtures.pop(),(s:any)=>s.participantsHash='a'.repeat(64),
   (s:any)=>s.seed='invalid',(s:any)=>s.pendingPhases=[],(s:any)=>s.fixtures.reverse(),
  ]){const value=structuredClone(original);mutate(value);await expect(validateInitialSchedule(value,snapshot)).rejects.toMatchObject({status:422});}
 });
});
