import {it,expect} from 'vitest';
import {loadApprovedSnapshot,serverCanonicalCatalogue} from '../src/approved-season-one.ts';
import {snapshotHashes,validateApprovedSnapshot,canonicalHash} from '../src/catalogue-snapshot.ts';
import {buildInitialSchedule,buildTrustedSeasonSchedule} from '../src/initial-schedule.ts';
import {createProgression,processSportingDay} from '../src/knockout-progression.ts';
import {simulateTemporaryMatch} from '../src/temporary-simulation.ts';
import {initialDrawOutcomes} from '../src/initial-draws.ts';
import {membershipCandidateFromProgression} from '../src/next-season-membership.ts';
import {internationalCountries} from '../src/season-qualification-pots.ts';
const seed='season-aware-synthetic-seed-0001';
async function qualified(){
 const first=await loadApprovedSnapshot();
 // Pure engine fixture: synthetic qualified snapshot, not a persisted owner approval.
 const bindings=first.bindings.map(b=>({...b,clubIds:b.competitionId.startsWith('int-')?internationalCountries.flatMap(c=>(b.competitionId==='int-1'?[7,2,14]:[9,4,16]).map(n=>c+'-'+n)):[...b.clubIds]}));
 const hashes=await snapshotHashes(bindings,serverCanonicalCatalogue());
 return validateApprovedSnapshot({...first,approvalReference:'synthetic-season-two-engine-only',bindings,...hashes},serverCanonicalCatalogue());
}
it('preserves original Season1 draw pot metadata and canonical payload hashes',async()=>{
 const snapshot=await loadApprovedSnapshot(),schedule=await buildInitialSchedule(snapshot,seed),draws=await initialDrawOutcomes(schedule,snapshot);
 for(const d of draws){const cup=d.competitionId,clubs=snapshot.bindings.find(b=>b.competitionId===cup)!.clubIds,base=cup==='int-1'?1:4;
  const prior={schemaVersion:1,season:1,competitionId:cup,stageId:'league',algorithmVersion:schedule.algorithmVersion,seed:schedule.seed,participantsHash:snapshot.participantsHash,rulesHash:snapshot.rulesHash,calendarHash:schedule.calendarHash,pots:Array.from({length:3},(_,p)=>clubs.filter(id=>Number(id.split('-')[1])===base+p)),fixtures:schedule.fixtures.filter(f=>f.competitionId===cup)};
  expect(d.hash).toBe(await canonicalHash(prior));
  expect(d.json).toBe(JSON.stringify(prior));
 }
});
it('uses actual qualification order and season2 identities for nonconsecutive cup club IDs',async()=>{
 const snapshot=await qualified(),schedule=await buildTrustedSeasonSchedule(snapshot,seed,2),draws=await initialDrawOutcomes(schedule,snapshot);
 for(const draw of draws){const value=JSON.parse(draw.json),slots=draw.competitionId==='int-1'?[7,2,14]:[9,4,16];expect(value.season).toBe(2);expect(value.pots).toEqual(slots.map(n=>internationalCountries.map(c=>c+'-'+n)));}
 expect(schedule.fixtures.every(f=>f.id.startsWith('season:2:'))).toBe(true);
 const result=await simulateTemporaryMatch(schedule.fixtures[0],seed,{mode:'regulation'});expect(result.fixtureId.startsWith('season:2:')).toBe(true);
});
it('completes Season2 day1 through56 with4082 results and54 independent canonical ties',async()=>{
 const snapshot=await qualified(),schedule=await buildTrustedSeasonSchedule(snapshot,seed,2),state=createProgression(snapshot,schedule);
 for(let day=1;day<=56;day++)await processSportingDay(state,day);
 expect(state.results.size).toBe(4082);expect(state.ties.size).toBe(54);
 expect(membershipCandidateFromProgression(state).season).toBe(3);
 expect([...state.results.keys()].every(id=>id.startsWith('season:2:'))).toBe(true);
 for(const plan of state.ties.values()){expect(plan.season).toBe(2);expect(plan.fixtures.every(f=>f.fixture.id.startsWith('season:2:'))).toBe(true);}
 const again=createProgression(snapshot,schedule);for(let day=1;day<=56;day++)await processSportingDay(again,day);
 expect([...again.results.values()]).toEqual([...state.results.values()]);
},120000);
it('refuses unvalidated snapshot clones and cross-season fixture identities',async()=>{
 const snapshot=await qualified(),schedule=await buildTrustedSeasonSchedule(snapshot,seed,2);
 expect(()=>createProgression(structuredClone(snapshot),schedule)).toThrow();
 const wrong={...schedule,season:1};expect(()=>createProgression(snapshot,wrong)).toThrow();
 expect(()=>createProgression(snapshot,structuredClone(schedule))).toThrow();
 expect(()=>{schedule.fixtures[0].day=1}).toThrow();
 for(const id of ['season:0:IT-1:N01:IT-1:IT-2','season:02:IT-1:N01:IT-1:IT-2','season:-1:IT-1:N01:IT-1:IT-2','season:1000001:IT-1:N01:IT-1:IT-2'])await expect(simulateTemporaryMatch({id,competitionId:'IT-1',marker:'N01',day:13,round:1,homeClubId:'IT-1',awayClubId:'IT-2'},seed,{mode:'regulation'})).rejects.toMatchObject({status:422});
});
