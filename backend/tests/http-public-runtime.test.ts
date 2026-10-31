import assert from 'node:assert/strict';
import {test} from 'vitest';
import worker from '../src/index.ts';
import type { Env } from '../src/index.ts';

const row = {schema_version:1,generation:'550e8400-e29b-41d4-a716-446655440000',revision:0,season_number:0,day:0,phase:'unstarted',password_verifier:'should-not-leak'};
const env: Env = {DB:{prepare: () => ({first: async <T>() => row as T})}};
const fetch = (path:string, opts?:RequestInit, override:Env=env) =>
  worker.fetch(new Request('https://example.invalid'+path,opts),override);

test('public endpoint returns only validated world with no-store response', async () => {
  const response=await fetch('/api/world');
  assert.equal(response.status,200);
  assert.match(response.headers.get('cache-control')??'',/no-store/);
  const body=await response.json() as Record<string,unknown>;
  assert.deepEqual(body,{world:{schemaVersion:1,generation:row.generation,revision:0,seasonNumber:0,day:0,phase:'unstarted'}});
  assert.doesNotMatch(JSON.stringify(body),/password|session|verifier/);
});
test('unavailable or invalid database fails closed and never fabricates Season 0', async () => {
  for(const missing of [{}, {DB:{prepare:()=>({first:async()=>null})}}] as Env[]){
    const response=await fetch('/api/world',undefined,missing);
    assert.equal(response.status,503);
    assert.deepEqual(await response.json(),{error:{code:'world_unavailable'}});
  }
});
test('no mutating or unauthenticated admin route is enabled', async () => {
  for(const path of ['/api/admin','/api/admin/session','/api/admin/prepare']){
    const response=await fetch(path,{method:'POST',body:'{}',headers:{'Content-Type':'application/json'}});
    assert.equal(response.status,path==='/api/admin/session'?405:404);
  }
  assert.equal((await fetch('/api/world',{method:'POST'})).status,405);
  assert.equal((await fetch('/api/random')).status,404);
});

test('anonymous public world does not depend on unified Player configuration or cookie state',async()=>{
 const plain=await fetch('/api/world');
 const withInvalidPlayerCookie=await fetch('/api/world',{headers:{Cookie:'fa_player_local=invalid-session'}});
 const withOldAdminCookie=await fetch('/api/world',{headers:{Cookie:'fa_admin_local=obsolete'}});
 assert.equal(plain.status,200);
 assert.equal(withInvalidPlayerCookie.status,200);
 assert.equal(withOldAdminCookie.status,200);
 assert.deepEqual(await plain.json(),await withInvalidPlayerCookie.json());
 assert.deepEqual(await withOldAdminCookie.json(),{world:{schemaVersion:1,generation:row.generation,revision:0,seasonNumber:0,day:0,phase:'unstarted'}});
 assert.equal((await fetch('/api/player/session')).status,503);
 assert.equal((await fetch('/api/world')).status,200);
});
