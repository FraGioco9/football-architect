import {describe,it,expect} from 'vitest';
import {simulateTemporaryMatch} from '../src/temporary-simulation.ts';
import type {Fixture} from '../src/initial-schedule.ts';
const fixture:Fixture={id:'season:1:IT-1:N01:IT-1:IT-2',competitionId:'IT-1',marker:'N01',round:1,day:13,homeClubId:'IT-1',awayClubId:'IT-2'};
const seed='temporary-synthetic-seed-0001';
describe('temporary score simulation, separate from the future full engine',()=>{
 it('reproduces persisted final scores from source seed, fixture and context, with no fabricated player data',async()=>{
  const a=await simulateTemporaryMatch(fixture,seed,{mode:'regulation'});
  expect(await simulateTemporaryMatch(fixture,seed,{mode:'regulation'})).toEqual(a);
  expect(a).toMatchObject({fixtureId:fixture.id,algorithmVersion:'temporary-score-v1',provenance:'temporary-simulation',extraTime:null,penalties:null,resolution:'regulation'});
  expect(a.homeGoals).toBe(a.regulation.home);expect(a.awayGoals).toBe(a.regulation.away);
  expect(Number.isInteger(a.homeGoals)&&a.homeGoals>=0&&a.homeGoals<=4).toBe(true);
  expect(a.sourceSeedHash).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(a)).not.toMatch(/player|scorer|assist|injury|rating|lineup/);
 });
 it('resolves single knockout and second-leg aggregate ties with extra time then penalties, never away goals',async()=>{
  const seen=new Set<string>();
  for(let i=0;i<128;i++){
   const result=await simulateTemporaryMatch(fixture,seed+i,{mode:'single-knockout'});
   expect([fixture.homeClubId,fixture.awayClubId]).toContain(result.winnerClubId);seen.add(result.resolution);
   if(result.extraTime){expect(result.homeGoals).toBe(result.regulation.home+result.extraTime.home);expect(result.awayGoals).toBe(result.regulation.away+result.extraTime.away);}
   if(result.penalties){expect(result.penalties.home).not.toBe(result.penalties.away);expect(result.penalties.home>result.penalties.away?fixture.homeClubId:fixture.awayClubId).toBe(result.winnerClubId)}
   const regulation=await simulateTemporaryMatch(fixture,seed+i,{mode:'regulation'});
   // Pick first-leg scores so the current return-leg aggregate is tied, with
   // unequal away-goals counts whenever the regulation score is unequal.
   const second=await simulateTemporaryMatch(fixture,seed+i,{mode:'second-leg',firstLegHomeGoals:regulation.regulation.home,firstLegAwayGoals:regulation.regulation.away});
   expect(second.extraTime).not.toBeNull();expect(second.winnerClubId).not.toBeNull();
  }
  expect([...seen].sort()).toEqual(['extra-time','penalties','regulation']);
 });
 it('leaves first legs/league draws unresolved and rejects unsupported or malformed inputs',async()=>{
  let draw=false;
  for(let i=0;i<64;i++){const a=await simulateTemporaryMatch(fixture,seed+i,{mode:'regulation'});if(a.homeGoals===a.awayGoals){expect(a.winnerClubId).toBeNull();draw=true}}
  expect(draw).toBe(true);
  for(const context of [null,{}, {mode:'second-leg'},{mode:'regulation',winner:'IT-1'},{mode:'second-leg',firstLegHomeGoals:-1,firstLegAwayGoals:0}])await expect(simulateTemporaryMatch(fixture,seed,context as any)).rejects.toMatchObject({status:422});
  for(const invalid of [{...fixture,awayClubId:fixture.homeClubId},{...fixture,score:'1-0'},{...fixture,day:0},{...fixture,id:'forged'}])await expect(simulateTemporaryMatch(invalid,seed,{mode:'regulation'})).rejects.toMatchObject({status:422});
  await expect(simulateTemporaryMatch(fixture,'short',{mode:'regulation'})).rejects.toMatchObject({status:422});
 });
});

it('uses feasible terminal shootout pairs, including the regression seed that previously yielded6-4',async()=>{
 const result=await simulateTemporaryMatch(fixture,seed+'14',{mode:'single-knockout'});
 expect(result.resolution).toBe('penalties');
 expect(Math.abs(result.penalties!.home-result.penalties!.away)).toBe(1);
});
