import {beforeAll,beforeEach,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {clearTestWorld} from './fixtures/test-world.ts';
import {seedUnifiedAdminHttp} from './fixtures/unified-admin-http.ts';
import {handleAdmin} from '../src/http-admin.ts';
import {buildFamilyV42PortraitSnapshotForPlayer,renderFamilyV42PortraitPromptFromSnapshot} from '../src/player-portrait-family-v42.mjs';
import {resolveCatalogueNameOrigins} from '../src/player-portrait-name-origins.mjs';
import type {Database} from '../src/database.ts';

const db=(env as any).DB as Database;
const origin='http://app.localhost:2000',actor='portrait-generation-admin',email='portrait-admin@example.invalid',token='b'.repeat(64);
const now=Math.floor(Date.now()/1000);
let csrf='';
const service={DB:db,PLAYER_MODE:'local',PLAYER_ORIGIN:origin};
async function req(path:string,payload?:unknown,auth=true){
 const method=payload===undefined?'GET':'POST';
 return handleAdmin(new Request(origin+'/api/admin/players'+path,{
  method,headers:{...(auth?{Cookie:'fa_player_local='+token}:{}),Origin:origin,
   ...(payload!==undefined?{'Content-Type':'application/json','X-CSRF-Token':csrf}: {})},
  body:payload===undefined?undefined:JSON.stringify(payload)
 }),service);
}
async function draft(count=2,seed='portrait-runtime'){
 const r=await req('/preview',{options:{count,seed,primaryNationality:'ITA',primaryPosition:'ST'}});
 expect(r.status).toBe(200);
 return (await r.json()) as any;
}
async function commit(id:string){return req('/commit',{draftId:id,confirmation:'GENERATE PLAYERS'});}
async function rows(){
 return (await db.prepare('SELECT id,payload_json FROM generated_players ORDER BY id').all<any>()).results;
}
async function portraits(){
 return (await db.prepare('SELECT player_id,snapshot_json,status,asset_key FROM player_portrait_profiles ORDER BY player_id').all<any>()).results;
}
beforeAll(async()=>{await applyD1Migrations(db,(env as any).TEST_MIGRATIONS)});
beforeEach(async()=>{
 await clearTestWorld(db);
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)')
  .bind(actor,email,'test-no-real-login',now-100).run();
 ({csrf}=await seedUnifiedAdminHttp(db,actor,email,now,token));
});

it('saves an immutable appearance for every newly committed permanent ID, never for previews',async()=>{
 const pending=await draft(3);
 expect(await portraits()).toHaveLength(0);
 expect((await req('/portrait?playerId=1')).status).toBe(404);
 expect((await req('/portrait?playerId=1',undefined,false)).status).not.toBe(200);
 const ok=await commit(pending.draftId);
 expect(ok.status).toBe(200);
 const persisted=await rows(),profiles=await portraits();
 expect(profiles).toHaveLength(3);
 expect(persisted).toHaveLength(3);
 for(let i=0;i<3;i++){
  const player=JSON.parse(persisted[i].payload_json);
  const snapshot=JSON.parse(profiles[i].snapshot_json);
  expect(profiles[i].player_id).toBe(persisted[i].id);
  expect(snapshot.player_id).toBe(persisted[i].id);
  expect(snapshot.schema_version).toBe('player-portraits-v5');
  expect(snapshot.prompt_version).toBe('player-portrait-v4.2');
  expect(snapshot.body_profile).toBeDefined();
  expect(snapshot.appearance_fingerprint).toMatch(/^[a-f0-9]{16}$/);
  expect(profiles[i].status).toBe('pending');
  expect(profiles[i].asset_key).toBeNull();
  expect('portrait_prompt' in snapshot).toBe(false);
  expect('attributes' in snapshot).toBe(false);
  const expected=await buildFamilyV42PortraitSnapshotForPlayer({...player,
   name_origins:resolveCatalogueNameOrigins(player)});
  expect(snapshot).toEqual(expected);
  // The portrait prompt is rendered directly from its immutable D1 snapshot,
  // without requiring an Admin HTTP endpoint.
  const prompt=await renderFamilyV42PortraitPromptFromSnapshot(snapshot);
  expect(prompt).toContain('Plain PURE WHITE short-sleeved REGULAR-FIT football jersey');
 }
 const replay=await commit(pending.draftId);
 expect(replay.status).toBe(200);
 expect((await replay.json() as any).alreadyCommitted).toBe(true);
 expect(await portraits()).toHaveLength(3);
});

it('keeps frozen face/body/nationality after changes to gameplay records',async()=>{
 const p=await draft(1,'portrait-frozen');
 expect((await commit(p.draftId)).status).toBe(200);
 const id=(await rows())[0].id;
 const before=(await portraits())[0].snapshot_json;
 const first=await renderFamilyV42PortraitPromptFromSnapshot(JSON.parse(before));
 await db.prepare(`UPDATE generated_players
  SET payload_json=json_set(payload_json,'$.nationality','BRA','$.attributes.strength',99,'$.attributes.stamina',5)
  WHERE id=?`).bind(id).run();
 const afterSnapshot=(await portraits())[0].snapshot_json;
 expect(afterSnapshot).toBe(before);
 const after=await renderFamilyV42PortraitPromptFromSnapshot(JSON.parse(afterSnapshot));
 expect(after).toBe(first);
});

it('uses guarded AUTOINCREMENT sequence, including deleted high-water IDs, across repeated batches',async()=>{
 const one=await draft(2,'batch-one');
 const two=await draft(2,'batch-two');
 expect((await commit(two.draftId)).status).toBe(200);
 expect((await commit(one.draftId)).status).toBe(200);
 const initial=await rows();
 const allocated=initial.map(p=>p.id),high=allocated[3];
 expect(allocated).toHaveLength(4);
 expect(allocated).toEqual([high-3,high-2,high-1,high]);
 expect((await portraits()).map(p=>p.player_id)).toEqual(allocated);
 await db.prepare('DELETE FROM generated_players WHERE id=?').bind(high).run();
 expect((await portraits()).map(p=>p.player_id)).toEqual(allocated.slice(0,3));
 const three=await draft(1,'batch-after-delete');
 expect((await commit(three.draftId)).status).toBe(200);
 expect((await rows()).map(p=>p.id)).toEqual([...allocated.slice(0,3),high+1]);
 expect((await portraits()).map(p=>p.player_id)).toEqual([...allocated.slice(0,3),high+1]);
});

it('rolls back all generated_players if inserting a single portrait fails',async()=>{
 const p=await draft(2,'force-portrait-db-error');
 await db.prepare(`CREATE TRIGGER test_portrait_fail BEFORE INSERT ON player_portrait_profiles
  BEGIN SELECT RAISE(ABORT,'test_failing_portrait_insert'); END`).run();
 try{
  expect((await commit(p.draftId)).status).toBe(503);
  expect(await rows()).toHaveLength(0);
  expect(await portraits()).toHaveLength(0);
  const status=await db.prepare('SELECT status FROM player_generation_drafts WHERE id=?').bind(p.draftId).first<any>();
  expect(status?.status).toBe('preview');
 }finally{
  await db.prepare('DROP TRIGGER IF EXISTS test_portrait_fail').run();
 }
 expect((await commit(p.draftId)).status).toBe(200);
 expect(await portraits()).toHaveLength(2);
});

it('rejects invalid previews and keeps the retired portrait API unavailable',async()=>{
 const p=await draft(1,'corrupt-portrait-preview');
 await db.prepare(`UPDATE player_generation_drafts
  SET candidates_json=json_set(candidates_json,'$[0].attributes.strength',0)
  WHERE id=?`).bind(p.draftId).run();
 expect((await commit(p.draftId)).status).toBe(503);
 expect(await portraits()).toHaveLength(0);
 expect(await rows()).toHaveLength(0);
 for(const path of ['/portrait','/portrait?playerId=0','/portrait?playerId=1&extra=y','/portrait?playerId=a','/portrait?playerId=1&playerId=2'])
  expect((await req(path)).status).toBe(404);
 expect((await req('/portrait?playerId=1',undefined,false)).status).not.toBe(200);
});

it('validates the version-pinned immutable snapshot without exposing a prompt endpoint',async()=>{
 const p=await draft(1,'versioned-portrait');
 expect((await commit(p.draftId)).status).toBe(200);
 const snapshot=JSON.parse((await portraits())[0].snapshot_json);
 const prompt=await renderFamilyV42PortraitPromptFromSnapshot(snapshot);
 expect(prompt).toContain('EXACTLY ONE fictional adult male');
 await expect(renderFamilyV42PortraitPromptFromSnapshot({...snapshot,prompt_version:'player-portrait-v4'}))
  .rejects.toThrow('invalid_v42_portrait_version');
 await expect(renderFamilyV42PortraitPromptFromSnapshot({...snapshot,player_id:0}))
  .rejects.toThrow('invalid_v42_portrait_snapshot');
 await expect(renderFamilyV42PortraitPromptFromSnapshot({...snapshot,appearance_fingerprint:'0000000000000000'}))
  .rejects.toThrow('noncanonical_v42_portrait_snapshot');
 expect((await req('/portrait?playerId='+snapshot.player_id)).status).toBe(404);
});
