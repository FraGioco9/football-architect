import assert from 'node:assert/strict';
import {test} from 'vitest';
import {confirmedPublication} from '../src/public-match-read-lineup-v1.ts';
import {canonicalHash} from '../src/catalogue-snapshot.ts';
import type {Database} from '../src/database.ts';

const generation='550e8400-e29b-41d4-a716-446655440000';
const publishedAt=1800000000;
const stage={generation,seed:'a-seed',fixtures_hash:'a'.repeat(64),
 participants_hash:'b'.repeat(64),rules_hash:'c'.repeat(64),created_at:publishedAt};
const domestic={generation,season_number:1,competition_id:'IT-1' as const,
 source_kind:'domestic' as const,source_hash:stage.fixtures_hash,published_at:publishedAt};

function deferredDb(){
 const reads:{sql:string;params:unknown[];resolve:(row:unknown)=>void}[]=[];
 const db={prepare(sql:string){
  const statement=(params:unknown[])=>({
   bind(...args:unknown[]){return statement(args)},
   first(){return new Promise(resolve=>reads.push({sql,params,resolve}))},
   async all(){throw Error('Unexpected collection read')},
   async run(){throw Error('Unexpected public API write')}
  });return statement([]);
 },async batch(){throw Error('Unexpected public API transaction')}} as unknown as Database;
 return {db,reads};
}

test('PERF-API-657 published domestic proof launches three independent, bound reads concurrently',async()=>{
 const {db,reads}=deferredDb();
 const promise=confirmedPublication(db,domestic);
 assert.equal(reads.length,3,'no read should await an earlier independent read');
 assert.ok(reads[0].sql.includes('season_calendars'));
 assert.ok(reads[1].sql.includes('season_domestic_stages'));
 assert.ok(reads[2].sql.includes('season_admin_events'));
 assert.deepEqual(reads.map(r=>r.params),[[1],[1],[1,'domestic:calendar']]);
 const receipt=await canonicalHash({schemaVersion:1,season:1,generation,
  eventId:'domestic:calendar',fixturesHash:stage.fixtures_hash,seed:stage.seed,
  participantsHash:stage.participants_hash,rulesHash:stage.rules_hash});
 const calendar={calendar_hash:'d'.repeat(64),created_at:publishedAt};
 // Out-of-order completion must not change proof validation or returned metadata.
 reads[2].resolve({status:'completed',receipt_hash:receipt,completed_at:publishedAt});
 reads[1].resolve(stage);
 reads[0].resolve(calendar);
 assert.deepEqual(await promise,calendar);
});

test('PERF-API-657 unpublished event remains a 404 even with concurrently read stage/calendar',async()=>{
 const {db,reads}=deferredDb();
 const promise=confirmedPublication(db,domestic);
 assert.equal(reads.length,3);
 reads[1].resolve(stage);
 reads[0].resolve(null);
 reads[2].resolve({status:'pending',receipt_hash:null,completed_at:null});
 await assert.rejects(promise,{status:404,code:'not_found'});
});

test('PERF-API-657 calendar-source proof still reads only one canonical calendar row',async()=>{
 const {db,reads}=deferredDb();
 const row={...domestic,source_kind:'calendar' as const,source_hash:'f'.repeat(64)};
 const promise=confirmedPublication(db,row);
 assert.equal(reads.length,1,'calendar proof must not fetch stage or admin event');
 assert.deepEqual(reads[0].params,[1]);
 const calendar={calendar_hash:row.source_hash,created_at:publishedAt};
 reads[0].resolve(calendar);
 assert.deepEqual(await promise,calendar);
 const invalid=deferredDb();
 const rejected=confirmedPublication(invalid.db,row);
 invalid.reads[0].resolve({...calendar,calendar_hash:'different'});
 await assert.rejects(rejected,{status:503,code:'match_unavailable'});
});
