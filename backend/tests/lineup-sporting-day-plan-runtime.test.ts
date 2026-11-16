import {describe,it,expect} from 'vitest';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {buildInitialSchedule,type Fixture} from '../src/initial-schedule.ts';
import {createProgression,processSportingDayWithResolver} from '../src/knockout-progression.ts';
import {simulateMatchV1} from '../src/temporary-lineup-v1.mjs';
import {canonicalHash} from '../src/catalogue-snapshot.ts';
import {planLineupSportingDayV1,type LineupSportingScoreV1} from '../src/lineup-sporting-day-plan.ts';
import type {WorldV1} from '../src/types.ts';

const generation='11111111-1111-4111-8111-111111111111';
const sourceHash='b'.repeat(64),seed='lineup-daily-planner-synthetic-seed-01';

async function testSeason(){
 const snapshot=await loadApprovedSnapshot();
 const schedule=await buildInitialSchedule(snapshot,seed);
 const firstDay=Math.min(...schedule.fixtures.map(f=>f.day));
 const state=createProgression<LineupSportingScoreV1>(snapshot,schedule);
 for(let day=1;day<firstDay;day++){
  await processSportingDayWithResolver(state,day,async(f,context)=>adapt(
   f,await simulateMatchV1({homeRoster:[],awayRoster:[],
    homeClubId:f.homeClubId,awayClubId:f.awayClubId,
    matchKey:f.id,seed,context})
  ));
 }
 const phase:WorldV1['phase']=firstDay===1?'preparing':'active';
 const world:WorldV1={schemaVersion:1,generation,revision:7,
  seasonNumber:1,day:firstDay-1,phase};
 const fixtures=schedule.fixtures.filter(f=>f.day===firstDay);
 return {schedule,state,world,fixtures,calendarHash:await canonicalHash(schedule)};
}
function adapt(f:Fixture,r:Awaited<ReturnType<typeof simulateMatchV1>>):LineupSportingScoreV1 {
 return {fixtureId:f.id,algorithmVersion:r.algorithmVersion,
  context:r.context,regulation:r.regulation,extraTime:r.extraTime,penalties:r.penalties,
  homeGoals:r.homeGoals,awayGoals:r.awayGoals,winnerClubId:r.winnerClubId,resolution:r.resolution};
}
function database(fixtures:Fixture[],world:WorldV1,{missing=false}={}){
 const byFixture=new Map(fixtures.map((f,i)=>[f.id,{
  fixture:f,id:i+1,slot:'m1_'+(i+1).toString(16).padStart(32,'0')
 }]));
 const byNumber=new Map([...byFixture.values()].map(row=>[row.id,row]));
 const bySlot=new Map([...byFixture.values()].map(row=>[row.slot,row]));
 const calls:{sql:string;args:unknown[]}[]=[];
 let batchCalled=false;
 const db={
  batch(){batchCalled=true;throw Error('NO LIVE D1 BATCH');},
  prepare(sql:string){
   const q={sql,args:[] as unknown[],bind(...args:unknown[]){this.args=args;return this},
    async first(){
     if(sql.startsWith('SELECT generation,revision,season_number'))
      return {generation:world.generation,revision:world.revision,
       seasonNumber:world.seasonNumber,day:world.day,phase:world.phase};
     if(sql.includes('FROM season_match_slots s JOIN public_match_numbers p')){
      const row=byFixture.get(String(this.args[0]));
      return missing?null:row?{public_id:row.id,source_hash:sourceHash}:null;
     }
     if(sql.includes('FROM public_match_numbers WHERE id=?')){
      const row=byNumber.get(Number(this.args[0]));
      return row?{id:row.id,slot_match_id:row.slot,
       generation:world.generation,season_number:1}:null;
     }
     if(sql.includes('FROM season_match_slots WHERE match_id=?')){
      const row=bySlot.get(String(this.args[0]));
      const f=row?.fixture;
      return f?{source_fixture_id:f.id,competition_id:f.competitionId,
       scheduled_day:f.day,home_club_id:f.homeClubId,
       away_club_id:f.awayClubId,source_hash:sourceHash}:null;
     }
     throw Error('unexpected first: '+sql);
    },
    async all(){
     if(sql.includes('FROM player_club_affiliations a JOIN generated_players p'))
      return {results:[]};
     throw Error('unexpected all: '+sql);
    }};
   calls.push(q);return q;
  }
 };
 return {db:db as any,calls,get batchCalled(){return batchCalled}};
}
describe('#613 guarded new engine V2 one-day writer plan',()=>{
 it('plans genuine due fixtures, every receipt and one V2 day without executing a DB batch',async()=>{
  const {state,world,fixtures,calendarHash}=await testSeason();
  expect(fixtures.length).toBeGreaterThan(0);
  const before=state.results.size;
  const stub=database(fixtures,world);
  const plan=await planLineupSportingDayV1(stub.db,world,state,calendarHash,123456);
  expect(plan.day).toBe(world.day+1);
  expect(plan.matchCount).toBe(fixtures.length);
  expect(plan.dayEvidence.payload.simulationVersion).toBe('temporary-lineup-v1');
  expect(plan.dayEvidence.payload.results).toHaveLength(fixtures.length);
  expect(plan.writes).toHaveLength(fixtures.length+1);
  expect(plan.newTies).toBeDefined();
  expect(plan.nextProgression.lastDay).toBe(plan.day);
  expect(plan.nextProgression.results.size).toBe(before+fixtures.length);
  expect(state.results.size).toBe(before);
  expect(state.lastDay).toBe(world.day);
  expect(stub.batchCalled).toBe(false);
  const inserted=stub.calls.filter(q=>q.sql.startsWith('INSERT INTO match_lineup_result_receipts'));
  expect(inserted).toHaveLength(fixtures.length);
  const dayWrite=stub.calls.find(q=>q.sql.includes('INSERT INTO season_lineup_day_outcomes'));
  expect(dayWrite).toBeDefined();
  expect(JSON.parse(String(dayWrite!.args[6])).results).toEqual(plan.dayEvidence.payload.results);
 },30000);

 it('missing public fixture or an incorrect calendar hash fails closed without mutating canonical state',async()=>{
  const {state,world,fixtures,calendarHash}=await testSeason();
  const before=state.results.size;
  const stub=database(fixtures,world,{missing:true});
  await expect(planLineupSportingDayV1(stub.db,world,state,calendarHash,123456))
   .rejects.toMatchObject({status:422});
  expect(state.results.size).toBe(before);
  expect(state.lastDay).toBe(world.day);
  await expect(planLineupSportingDayV1(stub.db,world,state,'f'.repeat(64),123456))
   .rejects.toMatchObject({status:422});
  expect(stub.batchCalled).toBe(false);
 },30000);
});
