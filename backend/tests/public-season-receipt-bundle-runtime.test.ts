import assert from 'node:assert/strict';
import {test} from 'vitest';
import {readPublicSeasonReceiptBundle} from '../src/public-sporting-read-lineup-v1.ts';
import type {Database} from '../src/database.ts';

test('PERF-API-657 starts the three independent, bound D1 season reads before any finishes',async()=>{
 const active:{sql:string;params:unknown[];complete:(rows:unknown)=>void}[]=[];
 const db={
  prepare(sql:string){
   const statement=(params:unknown[])=>({
    bind(...args:unknown[]){return statement(args)},
    all(){return new Promise(resolve=>active.push({sql,params,
     complete:rows=>resolve({results:rows,meta:{changes:0}})}))},
    first(){return new Promise(resolve=>active.push({sql,params,complete:resolve}))},
    async run(){throw Error('A public GET must never write')}
   });
   return statement([]);
  },
  async batch(){throw Error('A public GET must not create a transaction')}
 } as unknown as Database;
 const pending=readPublicSeasonReceiptBundle(db,2);
 assert.equal(active.length,3,'all three SQL statements must have started synchronously');
 assert.equal(active[0].sql,
  'SELECT day,outcome_hash FROM season_lineup_day_outcomes WHERE season_number=? ORDER BY day');
 assert.equal(active[1].sql,
  'SELECT plan_hash FROM season_knockout_ties WHERE season_number=? ORDER BY competition_id,phase_id,tie_id');
 assert.ok(active[2].sql.includes('season_archives'));
 assert.ok(!active.some(({sql})=>/outcome_json|plan_json/.test(sql)),
  'do not transfer validated heavy receipt/plan JSON a second time');
 assert.deepEqual(active.map(item=>item.params),[[2],[2],[2]]);
 assert.ok(active.every(item=>!item.sql.includes('season_number=2')),
  'no interpolated season number in a SQL statement');
 const archive={generation:'a',archive_hash:'b'};
 const ties=[{plan_hash:'t'}];
 const receipts=[{outcome_hash:'r'}];
 // Out-of-order completion still returns the same named bundle.
 active[2].complete(archive);
 active[1].complete(ties);
 active[0].complete(receipts);
 assert.deepEqual(await pending,{receipts,ties,archive});
 for(const bad of [0,-1,2.5,NaN,Number.MAX_SAFE_INTEGER+1])
  await assert.rejects(readPublicSeasonReceiptBundle(db,bad),{status:404,code:'not_found'});
 assert.equal(active.length,3,'invalid season must not issue any DB query');
});
