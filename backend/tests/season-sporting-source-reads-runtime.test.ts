import assert from 'node:assert/strict';
import {test} from 'vitest';
import {readSeasonSportingSourceRows} from '../src/season-sporting-evidence.ts';
import type {Database} from '../src/database.ts';

test('PERF-API-657 starts three independent canonical season source reads before any settles',async()=>{
 const pending:{sql:string;params:unknown[];complete:(result:unknown)=>void}[]=[];
 const db={
  prepare(sql:string){
   const statement=(params:unknown[])=>({
    bind(...args:unknown[]){return statement(args)},
    first(){return new Promise(resolve=>pending.push({sql,params,complete:resolve}))},
    all(){return new Promise(resolve=>pending.push({sql,params,
     complete:rows=>resolve({results:rows,meta:{changes:0}})}))},
    async run(){throw Error('An evidence read must not write')}
   });
   return statement([]);
  },
  async batch(){throw Error('An evidence read must not write a transaction')}
 } as unknown as Database;
 const promise=readSeasonSportingSourceRows(db,2);
 assert.equal(pending.length,3,'all source reads must start before awaiting the result');
 assert.equal(pending[0].sql,'SELECT generation,participants_hash,rules_hash,snapshot_json FROM seasons WHERE season_number=?');
 assert.equal(pending[1].sql,'SELECT calendar_version,calendar_hash,calendar_json FROM season_calendars WHERE season_number=?');
 assert.equal(pending[2].sql,'SELECT competition_id,stage_id,algorithm_version,seed,outcome_hash,outcome_json FROM season_draws WHERE season_number=? ORDER BY competition_id');
 assert.deepEqual(pending.map(item=>item.params),[[2],[2],[2]],'season number must be bound');
 const season={generation:'valid',participants_hash:'p',rules_hash:'r',snapshot_json:'{}'};
 const calendar={calendar_version:'s1',calendar_hash:'c',calendar_json:'{}'};
 const draws=[{competition_id:'int-1'},{competition_id:'int-2'}];
 pending[2].complete(draws);
 pending[1].complete(calendar);
 pending[0].complete(season);
 assert.deepEqual(await promise,{season,calendar,draws},'out-of-order reads must preserve source mapping and ordered draws');
});
