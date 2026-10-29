import {describe,it,expect} from 'vitest';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {buildInitialSchedule} from '../src/initial-schedule.ts';
import {createProgression,processSportingDay} from '../src/knockout-progression.ts';
const seed='knockout-synthetic-seed-0001';
const setup=async()=>{const snapshot=await loadApprovedSnapshot(),schedule=await buildInitialSchedule(snapshot,seed);return {snapshot,schedule,state:createProgression(snapshot,schedule)}};
describe('canonical knockout qualification and complete sporting days',()=>{
 it('resolves all18 competitions through day56 with4082 final matches,54 immutable ties and stable original-rank venues',async()=>{
  const {state}=await setup(),allNew:any[]=[];
  for(let day=1;day<=56;day++){
   const result=await processSportingDay(state,day);allNew.push(...result.newTies);
   if(day===36){expect(result.results).toHaveLength(8);expect(result.newTies).toHaveLength(8)}
   if(day===52){expect(result.results).toHaveLength(24);expect(result.newTies).toHaveLength(24)}
   if(day===53)expect(result.results).toHaveLength(25);
   if(day===54)expect(result.results).toHaveLength(9);
   if(day===55||day===56)expect(result.results).toHaveLength(0);
  }
  expect(state.results.size).toBe(4082);expect(state.ties.size).toBe(54);expect(allNew).toHaveLength(54);
  const plans=[...state.ties.values()];
  expect(plans.reduce((n,t)=>n+t.fixtures.length,0)).toBe(98);
  for(const plan of plans){
   const final=plan.fixtures[plan.fixtures.length-1],result=state.results.get(final.fixture.id)!;
   expect([final.fixture.homeClubId,final.fixture.awayClubId]).toContain(result.winnerClubId);
   if(plan.fixtures.length===2){
    const first=plan.fixtures[0],a=plan.originalRanks.find(r=>r.clubId===final.fixture.homeClubId)!,b=plan.originalRanks.find(r=>r.clubId===final.fixture.awayClubId)!;
    expect(a.rank).toBeLessThan(b.rank);expect(first.fixture.homeClubId).toBe(final.fixture.awayClubId);
    expect(result.context).toMatchObject({mode:'second-leg',firstLegHomeGoals:state.results.get(first.fixture.id)!.homeGoals,firstLegAwayGoals:state.results.get(first.fixture.id)!.awayGoals});
   }else if(plan.competitionId.startsWith('int-')){
    expect(final.neutral).toBe(true);expect(result.context).toEqual({mode:'single-knockout',neutral:true});
   }else{expect(final.neutral).toBe(false);expect(plan.originalRanks.find(r=>r.clubId===final.fixture.homeClubId)!.rank).toBeLessThan(plan.originalRanks.find(r=>r.clubId===final.fixture.awayClubId)!.rank)}
  }
  for(const cup of ['int-1','int-2']){
   const table=state.tables.get(cup)!,rank=(n:number)=>table[n-1].clubId;
   const tie=(id:string)=>plans.find(p=>p.competitionId===cup&&p.tieId===id)!;
   expect(tie('p512').originalRanks.map(r=>r.clubId)).toEqual([rank(5),rank(12)]);
   expect(tie('p89').originalRanks.map(r=>r.clubId)).toEqual([rank(8),rank(9)]);
   expect(tie('q1').originalRanks[0].clubId).toBe(rank(1));
   expect(tie('q1').originalRanks[1].clubId).toBe(state.results.get(tie('p89').fixtures[1].fixture.id)!.winnerClubId);
  }
 },30000);
 it('does not create unqualified future ties or mutate progression on absent dependency evidence',async()=>{
  const {state}=await setup();for(let day=1;day<=35;day++)await processSportingDay(state,day);
  expect(state.ties.size).toBe(0);const before=state.results.size;
  const key=[...state.results.keys()].find(id=>id.includes(':int-1:I01:'))!,saved=state.results.get(key)!;state.results.delete(key);
  await expect(processSportingDay(state,36)).rejects.toMatchObject({status:422});expect(state.ties.size).toBe(0);expect(state.lastDay).toBe(35);
  state.results.set(key,saved);await processSportingDay(state,36);expect(state.results.size).toBe(before+8);
  await expect(processSportingDay(state,38)).rejects.toMatchObject({status:422});
 });
});

it('refuses a return leg without the actual first-leg score and keeps the day unchanged',async()=>{
 const {state}=await setup();for(let day=1;day<=37;day++)await processSportingDay(state,day);
 const plan=[...state.ties.values()][0],id=plan.fixtures[0].fixture.id;state.results.delete(id);
 await expect(processSportingDay(state,38)).rejects.toMatchObject({status:422});expect(state.lastDay).toBe(37);
});
