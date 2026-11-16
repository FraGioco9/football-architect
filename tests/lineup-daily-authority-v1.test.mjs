import test from 'node:test';
import assert from 'node:assert/strict';
import {planLineupSeasonAuthorityPinV1,inspectLineupDayReadinessV1}
 from '../backend/src/lineup-daily-authority-v1.mjs';

const generation='11111111-1111-4111-8111-111111111111';
const preparing={generation,revision:3,seasonNumber:1,day:0,phase:'preparing'};
const active={...preparing,revision:4,day:12,phase:'active'};
function db(rows=[],pin=null,extra={}){
 const calls=[];
 const database={
  batch(){throw Error('authoritative writes prohibited in preflight')},
  prepare(sql){
   const statement={sql,params:[],bind(...params){this.params=params;return this},
    async first(){
     if(sql.includes('FROM world_state WHERE id=1')&&!sql.startsWith('INSERT'))
      return extra.changedWorld??extra.world??preparing;
     if(sql.startsWith('SELECT generation FROM seasons'))
      return extra.season??{generation};
     if(sql.startsWith('SELECT COUNT(*) AS n FROM season_day_outcomes'))
      return {n:extra.count??rows.length};
     if(sql.startsWith('SELECT COUNT(*) AS n FROM match_lineup_result_receipts'))
      return {n:extra.receipts??0};
     if(sql.startsWith('SELECT generation,season_number,simulation_version,pinned_at'))
      return pin;
     throw Error('unexpected query '+sql);
    },
    async all(){
     if(sql.startsWith('SELECT generation,day,simulation_version FROM season_day_outcomes'))
      return {results:rows};
     throw Error('unexpected query '+sql);
    }};
   calls.push(statement);
   return statement;
  }
 };
 return {database,calls};
}
test('pin proposal stages guarded insert and never commits',async()=>{
 const {database,calls}=db();
 const plan=await planLineupSeasonAuthorityPinV1(database,preparing,1234);
 assert.equal(plan.simulationVersion,'temporary-lineup-v1');
 assert.equal(plan.guards.length,5);
 assert.equal(plan.writes.length,1);
 assert.ok(calls.some(x=>x.sql.includes('INSERT INTO season_result_authorities')));
 assert.ok(plan.guards.every(s=>s.sql.startsWith('INSERT INTO world_state')));
 assert.throws(()=>database.batch(),/prohibited/);
});
test('no late/midseason pin and no existing results or receipt accepted',async()=>{
 await assert.rejects(()=>planLineupSeasonAuthorityPinV1(db().database,active,1234),/fresh preparing/);
 await assert.rejects(()=>planLineupSeasonAuthorityPinV1(db([],null,{count:1}).database,preparing,1234),/not pristine/);
 await assert.rejects(()=>planLineupSeasonAuthorityPinV1(db([],null,{receipts:1}).database,preparing,1234),/not pristine/);
 await assert.rejects(()=>planLineupSeasonAuthorityPinV1(db([],null,{season:{generation:'other'}}).database,preparing,1234),/not pristine/);
 await assert.rejects(()=>planLineupSeasonAuthorityPinV1(db([],{generation,season_number:1,simulation_version:'temporary-lineup-v1',pinned_at:12}).database,preparing,1234),/not pristine/);
});
test('old score-only daily results block mixed authority even when new pin exists',async()=>{
 const pin={generation,season_number:1,simulation_version:'temporary-lineup-v1',pinned_at:1234};
 const rows=Array.from({length:12},(_,i)=>({generation,day:i+1,simulation_version:'temporary-score-v1'}));
 const found=await inspectLineupDayReadinessV1(db(rows,pin,{world:active}).database,active);
 assert.deepEqual(found,{ready:false,reason:'missing-mixed-or-future-evidence'});
 assert.deepEqual(await inspectLineupDayReadinessV1(db(rows,null,{world:active}).database,active),
  {ready:false,reason:'unversioned-or-legacy-season'});
});
test('only contiguous, correct-generation and same-version days are eligible',async()=>{
 const pin={generation,season_number:1,simulation_version:'temporary-lineup-v1',pinned_at:1234};
 const rows=Array.from({length:12},(_,i)=>({generation,day:i+1,simulation_version:'temporary-lineup-v1'}));
 const good=await inspectLineupDayReadinessV1(db(rows,pin,{world:active}).database,active);
 assert.deepEqual(good,{ready:true,kind:'lineup-daily-preflight',simulationVersion:'temporary-lineup-v1',
  nextDay:13,priorDays:12,worldGeneration:generation});
 const bad=[...rows.slice(0,11),{...rows[11],day:13}];
 assert.deepEqual(await inspectLineupDayReadinessV1(db(bad,pin,{world:active}).database,active),
  {ready:false,reason:'missing-mixed-or-future-evidence'});
 const wrong=[...rows.slice(0,11),{...rows[11],generation:'another'}];
 assert.deepEqual(await inspectLineupDayReadinessV1(db(wrong,pin,{world:active}).database,active),
  {ready:false,reason:'missing-mixed-or-future-evidence'});
 assert.deepEqual(await inspectLineupDayReadinessV1(db(rows.slice(0,11),pin,{world:active}).database,active),
  {ready:false,reason:'missing-mixed-or-future-evidence'});
});
test('cannot advance finished season or act on stale world',async()=>{
 const pin={generation,season_number:1,simulation_version:'temporary-lineup-v1',pinned_at:1234};
 assert.deepEqual(await inspectLineupDayReadinessV1(db([],pin,{world:{...active,day:56}}).database,{...active,day:56}),
  {ready:false,reason:'not-an-advanceable-day'});
 await assert.rejects(()=>inspectLineupDayReadinessV1(db([],pin,{world:preparing}).database,active),/stale world/);
});
