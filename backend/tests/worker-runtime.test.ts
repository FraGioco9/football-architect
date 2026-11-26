import { describe, expect, it } from 'vitest';
import worker from '../src/index.ts';

// Real workerd execution via @cloudflare/vitest-plugin, not a Node-only mock.
describe('Worker local runtime', () => {
  it('fails closed when the D1 binding is not configured', async () => {
    const response = await worker.fetch(new Request('https://local.invalid/api/world'), {});
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: 'world_unavailable' } });
  });
  it('never exposes an unprotected Admin route', async () => {
    const response = await worker.fetch(new Request('https://local.invalid/api/admin/prepare', {method:'POST'}), {});
    expect(response.status).toBe(404);
  });
});

// Shared entry is a Worker module, including the production Argon2id WASM loader.
// Do not import this entry into node:test: Node ESM resolves Wasm env imports differently.
import assert from 'node:assert/strict';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import type {Database} from '../src/database.ts';
import sharedWorker from '../src/shared-dev-worker.ts';
import {seedUnifiedOperator} from './fixtures/unified-operator.ts';
import {hashPassword} from '../src/passwords.ts';

it('#791 shared DEV Worker gates real authenticated HTTP requests on isolated D1',async()=>{
 const binding=env as {DB:Database;TEST_MIGRATIONS:readonly unknown[]};
 const db=binding.DB;
 await applyD1Migrations(db,binding.TEST_MIGRATIONS);
 const now=Math.floor(Date.now()/1000),token='f'.repeat(64);
  const operator=await seedUnifiedOperator(db,'dev-http-fixture','dev-http@example.invalid',now,token);
  const origin='http://app.localhost:2000',url=origin+'/api/admin/dev-operator';
  const config={DB:db,PLAYER_MODE:'local',PLAYER_ORIGIN:origin,DEV_OPERATOR_ENABLED:'true',DEV_OPERATOR_SOURCE:'a'.repeat(40)};
  const headers={Cookie:operator.cookie,Origin:origin};
  assert.equal((await worker.fetch(new Request(url,{headers}),config)).status,404);
  assert.equal((await sharedWorker.fetch(new Request(url,{headers}),{...config,DEV_OPERATOR_ENABLED:'false'})).status,404);
  assert.equal((await sharedWorker.fetch(new Request(url,{headers}),config)).status,503);
  await db.prepare("INSERT INTO account_environment_pool(id,pool,initialized_at) VALUES(1,'dev-preview',?)").bind(now).run();
  assert.equal((await sharedWorker.fetch(new Request(url),config)).status,401);
  assert.notEqual((await sharedWorker.fetch(new Request(url,{headers}),config)).status,200);
  await db.prepare('INSERT INTO economic_finance_permissions VALUES(?,?,?,?)').bind(operator.playerId,'read','fixture',now).run();
  // Exercise the real password service inside workerd, not a test-only replacement.
  const password='synthetic-dev-operator-password-2026',verifier=await hashPassword(password);
  await db.prepare('UPDATE player_accounts SET password_verifier=? WHERE id=?').bind(verifier,operator.playerId).run();
  const login=await sharedWorker.fetch(new Request(origin+'/api/player/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'dev-http@example.invalid',password})}),config);
  assert.equal(login.status,200,await login.clone().text());
  const auth=await login.json() as {csrfToken:string};
  assert.ok(auth.csrfToken);
  const loginCookie=login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(loginCookie?.startsWith('fa_player_local='));
  const loginHeaders={Origin:origin,Cookie:loginCookie!};
  const response=await sharedWorker.fetch(new Request(url,{headers:loginHeaders}),config);
  assert.equal(response.status,200,await response.clone().text());
  const status=await response.json() as any;
  assert.equal(status.schema.ready,true);assert.equal(status.pool,'dev-preview');assert.equal(status.source,config.DEV_OPERATOR_SOURCE);
  assert.equal(status.counts.generated_players,0);
  const body=JSON.stringify({action:'settle',expectedGeneration:status.world.generation,expectedSeason:0,expectedDay:0,confirmation:'DEV settle '+status.world.generation+' 0:0',data:{}});
  assert.equal((await sharedWorker.fetch(new Request(url,{method:'POST',headers:{...loginHeaders,'Content-Type':'application/json'},body}),config)).status,403);
  const rejected=await sharedWorker.fetch(new Request(url,{method:'POST',headers:{...loginHeaders,'Content-Type':'application/json','X-CSRF-Token':auth.csrfToken},body}),config);
  assert.equal(rejected.status,409);
  // Registry drift alone must prevent all writes; never auto-apply a migration.
  await db.prepare("DELETE FROM d1_migrations WHERE name='0046_player_lifecycle_season_two.sql'").run();
  const missing=await sharedWorker.fetch(new Request(url,{method:'POST',headers:{...loginHeaders,'Content-Type':'application/json','X-CSRF-Token':auth.csrfToken},body}),config);
  assert.equal(missing.status,409);
  assert.equal((await missing.json() as any).error.code,'dev_operator_schema_not_ready');
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM economic_transactions').first())!.n,0);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM generated_players').first())!.n,0);
});

