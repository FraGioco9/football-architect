import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePublishedKnockoutV1} from '../backend/src/match-knockout-binding-v1.mjs';

const generation='11111111-1111-4111-8111-111111111111';
const world={generation,seasonNumber:1,day:53};
const hashString=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',
 new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');
const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value)
 :Array.isArray(value)?'['+value.map(canonical).join(',')+']'
 :'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
const canonicalHash=value=>hashString(canonical(value));
const fixture=(marker,day,home,away)=>({
 id:'season:1:int-1:'+marker+':'+home+':'+away,
 competitionId:'int-1',marker,day,round:13,homeClubId:home,awayClubId:away
});
async function proof({leg=1,twoLegs=false,neutral=false}={}){
 const one=twoLegs?fixture('I10',20,'IT-2','IT-1')
  :fixture('SOVEREIGN-FINAL',54,'IT-1','IT-2');
 const second=fixture('I11',54,'IT-1','IT-2');
 const f=leg===2?second:one,match={
  matchId:201,season:1,day:f.day,fixtureId:f.id,competitionId:'int-1',
  homeClubId:f.homeClubId,awayClubId:f.awayClubId,sourceHash:'a'.repeat(64)
 };
 const slotId='tie:F1:leg:'+leg,phaseId='final',tieId='F1';
 const key=['football-architect-match-slot-v1',generation,1,'int-1',phaseId,slotId];
 const matchId='m1_'+(await hashString(JSON.stringify(key))).slice(0,32);
 const plan={schemaVersion:1,season:1,competitionId:'int-1',phaseId,tieId,
  rulesVersion:'int-rules-v1',sourceCalendarHash:'b'.repeat(64),
  homePolicy:neutral?'neutral':'higherOriginalTableRank',
  fixtures:twoLegs?[{fixture:one,leg:1,neutral:false},{fixture:second,leg:2,neutral:false}]
    :[{fixture:one,leg:1,neutral}],originalRanks:[],dependencyResultIds:[],leagueTableHash:'c'.repeat(64)};
 const slot={match_id:matchId,generation,season_number:1,competition_id:'int-1',
  phase_id:phaseId,tie_id:tieId,leg,slot_id:slotId,marker:f.marker,scheduled_day:f.day,
  round_number:f.round,home_policy:plan.homePolicy,rules_version:plan.rulesVersion,
  source_hash:match.sourceHash};
 const tie={generation,plan_hash:await canonicalHash(plan),plan_json:JSON.stringify(plan)};
 const frozenFixture={matchId:200,season:1,day:20,generation,competitionId:'int-1',
  fixtureId:one.id,homeClubId:one.homeClubId,awayClubId:one.awayClubId,sourceHash:'a'.repeat(64)};
 const priorReceipt={schemaVersion:1,authority:'official',algorithmVersion:'temporary-lineup-v1',
  rosterSourceDigest:'c'.repeat(64),sourceCandidateDigest:'d'.repeat(64),
  fixture:frozenFixture,result:{matchKey:one.id,algorithmVersion:'temporary-lineup-v1',
   context:{mode:'regulation'},resolution:'regulation',homeGoals:2,awayGoals:1}};
 const firstKey=['football-architect-match-slot-v1',generation,1,'int-1',phaseId,'tie:'+tieId+':leg:1'];
 const priorSlotId='m1_'+(await hashString(JSON.stringify(firstKey))).slice(0,32);
 const frozen={public_match_id:200,slot_match_id:priorSlotId,generation,season_number:1,day:20,
  fixture_id:one.id,algorithm_version:'temporary-lineup-v1',
  receipt_hash:await hashString(JSON.stringify(priorReceipt)),receipt_json:JSON.stringify(priorReceipt)};
 const calendarJson=JSON.stringify({calendarHash:plan.sourceCalendarHash});
 const calendar={calendar_hash:await canonicalHash(JSON.parse(calendarJson)),
  calendar_json:calendarJson};
 const dayPayload={schemaVersion:2,season:1,generation,day:20,calendarHash:calendar.calendar_hash,
  simulationVersion:'temporary-lineup-v1',results:[{fixtureId:one.id,matchId:200,
    receiptHash:frozen.receipt_hash,homeGoals:2,awayGoals:1}]};
 const prior={generation,day:20,calendar_hash:calendar.calendar_hash,simulation_version:'temporary-lineup-v1',
  outcome_hash:await canonicalHash(dayPayload),outcome_json:JSON.stringify(dayPayload)};
 let tiePresent=true;
 const calls=[];
 const db={prepare(sql){
  const st={sql,args:[],bind(...args){this.args=args;return this},async first(){
   if(sql.includes('FROM season_knockout_match_slots'))return slot;
   if(sql.includes('FROM season_knockout_ties'))return tiePresent?tie:null;
   if(sql.includes('FROM match_lineup_result_receipts'))return frozen;
   if(sql.includes('FROM season_calendars'))return calendar;
   if(sql.includes('FROM season_lineup_day_outcomes'))return prior;
   throw Error('Unexpected query '+sql);
  }};
  calls.push(st);return st;
 }};
 return {db,match,slot,tie,prior,calendar,frozen,published:{slot_match_id:matchId},world,calls,
  dropTie:()=>{tiePresent=false;}};
}
test('neutral knockout final verifies hashed reservation and actual resolved clubs',async()=>{
 const p=await proof({neutral:true});
 const result=await resolvePublishedKnockoutV1(p.db,{match:p.match,world:p.world,
  published:p.published,context:{mode:'single-knockout',neutral:true}});
 assert.deepEqual(result.context,{mode:'single-knockout',neutral:true});
 assert.equal(result.leg,1);
 assert.equal(result.guards.length,2);
 assert.equal(result.planHash,p.tie.plan_hash);
 assert.ok(p.calls.some(c=>c.sql.includes('FROM season_knockout_ties')));
});
test('forged context, teams, fixture, slot digest or plan hash are rejected',async()=>{
 const p=await proof({neutral:true});
 const verify=(patch={})=>resolvePublishedKnockoutV1(p.db,{
  match:{...p.match,...(patch.match??{})},
  world:p.world,published:{...p.published,...(patch.published??{})},
  context:patch.context??{mode:'single-knockout',neutral:true}});
 await assert.rejects(()=>verify({context:{mode:'regulation'}}),/untrusted context/);
 await assert.rejects(()=>verify({match:{awayClubId:'IT-8'}}),/fixture binding/);
 await assert.rejects(()=>verify({published:{slot_match_id:'m1_'+'c'.repeat(32)}}),/published reservation/);
 p.tie.plan_hash='f'.repeat(64);
 await assert.rejects(()=>verify(),/source integrity/);
});
test('first leg is regulation only, second leg reads and guards prior finalized score',async()=>{
 const first=await proof({twoLegs:true,leg:1});
 const a=await resolvePublishedKnockoutV1(first.db,{match:first.match,
  world:first.world,published:first.published,context:{mode:'regulation'}});
 assert.equal(a.leg,1);
 assert.deepEqual(a.context,{mode:'regulation'});
 const second=await proof({twoLegs:true,leg:2});
 const ctx={mode:'second-leg',firstLegHomeGoals:2,firstLegAwayGoals:1};
 const b=await resolvePublishedKnockoutV1(second.db,{match:second.match,
  world:second.world,published:second.published,context:ctx});
 assert.deepEqual(b.context,ctx);
 assert.equal(b.guards.length,5);
 assert.ok(b.guards.some(g=>g.sql.includes('FROM season_calendars')));
 assert.ok(second.calls.some(c=>c.sql.includes('FROM season_lineup_day_outcomes')));
 await assert.rejects(()=>resolvePublishedKnockoutV1(second.db,{match:second.match,
  world:second.world,published:second.published,context:{...ctx,firstLegHomeGoals:9}}),/untrusted context/);
 second.prior.outcome_hash='f'.repeat(64);
 await assert.rejects(()=>resolvePublishedKnockoutV1(second.db,{match:second.match,
  world:second.world,published:second.published,context:ctx}),/first leg day receipt/);
 second.prior.outcome_hash=await canonicalHash(JSON.parse(second.prior.outcome_json));
 second.calendar.calendar_hash='f'.repeat(64);
 await assert.rejects(()=>resolvePublishedKnockoutV1(second.db,{match:second.match,
  world:second.world,published:second.published,context:ctx}),/first leg calendar/);
});

test('new same-day first-leg plan is accepted only when canonically supplied and guarded',async()=>{
 const p=await proof({twoLegs:true,leg:1});
 p.dropTie();
 const context={mode:'regulation'};
 await assert.rejects(()=>resolvePublishedKnockoutV1(p.db,{match:p.match,world:p.world,
  published:p.published,context}),/resolved tie/);
 const pendingTie=JSON.parse(p.tie.plan_json);
 const result=await resolvePublishedKnockoutV1(p.db,{match:p.match,world:p.world,
  published:p.published,context,pendingTie});
 assert.equal(result.planHash,p.tie.plan_hash);
 assert.equal(result.leg,1);
 assert.ok(result.guards.some(g=>g.sql.includes('NOT EXISTS(SELECT 1 FROM season_knockout_ties')));
 await assert.rejects(()=>resolvePublishedKnockoutV1(p.db,{match:p.match,world:p.world,
  published:p.published,context,pendingTie:{...pendingTie,homePolicy:'neutral'}}),/tie source integrity|fixture binding/);
 // Prevent an authenticated plan from being inserted over an existing one.
 const published=await proof({twoLegs:true,leg:1});
 await assert.rejects(()=>resolvePublishedKnockoutV1(published.db,{
  match:published.match,world:published.world,published:published.published,
  context,pendingTie:JSON.parse(published.tie.plan_json)
 }),/tie already published/);
});
