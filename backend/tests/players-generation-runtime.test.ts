import {beforeAll,beforeEach,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {clearTestWorld} from './fixtures/test-world.ts';
import {seedUnifiedAdminHttp} from './fixtures/unified-admin-http.ts';
import {handleAdmin} from '../src/http-admin.ts';
import worker from '../src/index.ts';
import {readWorld} from '../src/world-repository.ts';
import {commitPlayerGeneration} from '../src/players-generation-command.ts';
import {digestOpaqueToken} from '../src/session-tokens.ts';
import type {Database} from '../src/database.ts';
const bindings=env as any,db=bindings.DB as Database;
const origin='http://app.localhost:2000';
const actor='players-generation-operator',email='players-generation@example.invalid',token='a'.repeat(64);
const now=Math.floor(Date.now()/1000);
let csrf='',playerId='';
const service={DB:db,PLAYER_MODE:'local',PLAYER_ORIGIN:origin};
const url=(path:string)=>origin+'/api/admin/players'+path;
const request=async(path:string,payload?:unknown,headers:Record<string,string>={})=>{
 const method=payload===undefined?'GET':'POST';
 return handleAdmin(new Request(url(path),{
  method,
  headers:{Cookie:'fa_player_local='+token,Origin:origin,...(payload!==undefined?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{}),...headers},
  body:payload===undefined?undefined:JSON.stringify(payload)
 }),service);
};
const createPreview=async(options:unknown={count:2,seed:'integration-seed',primaryNationality:'ITA',primaryPosition:'ST'})=>{
 const response=await request('/preview',{options});
 expect(response.status).toBe(200);
 return response.json() as Promise<any>;
};
beforeAll(async()=>{await applyD1Migrations(db,bindings.TEST_MIGRATIONS)});
beforeEach(async()=>{
 await clearTestWorld(db);
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)')
  .bind(actor,email,'fixture-no-login',now-100).run();
 ({csrf,playerId}=await seedUnifiedAdminHttp(db,actor,email,now,token));
});
it('shows a server-generated preview but creates zero permanent players until explicit approval',async()=>{
 const oldWorld=await readWorld(db);
 const preview=await createPreview();
 expect(preview.summary.count).toBe(2);
 expect(preview.candidates).toHaveLength(2);
 expect(preview.candidates[0].nationality).toBe('ITA');
 expect(preview.candidates[0].primary_position).toBe('ST');
 expect(preview.candidates[0].id).toBeUndefined();
 expect(preview.candidates[0].preview_id).toMatch(/^trial-[0-9]{4}$/);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM generated_players').first<{n:number}>())?.n).toBe(0);
 expect((await db.prepare('SELECT status,count FROM player_generation_drafts WHERE id=?').bind(preview.draftId).first())).toMatchObject({status:'preview',count:2});
 const confirm={draftId:preview.draftId,confirmation:'GENERATE PLAYERS'};
 const success=await request('/commit',confirm);
 expect(success.status).toBe(200);
 const result=await success.json() as any;
 expect(result.count).toBe(2);expect(result.alreadyCommitted).toBe(false);
 expect((await request('/commit',confirm)).status).toBe(200);
 const replay=await (await request('/commit',confirm)).json() as any;
 expect(replay.alreadyCommitted).toBe(true);
 const records=(await db.prepare('SELECT id,payload_json,world_generation,entry_season FROM generated_players ORDER BY id').all<any>()).results;
 expect(records).toHaveLength(2);
 const actual=records.map(row=>JSON.parse(row.payload_json));
 expect(records.every(row=>Number.isSafeInteger(row.id)&&row.id>0)).toBe(true);
 expect(records[1].id).toBe(records[0].id+1);
 for(const [i,row] of actual.entries()){
  const item=preview.candidates[i];
  expect(row).toMatchObject({id:records[i].id,first_name:item.first_name,last_name:item.last_name,
   age:item.initial_age,career_status:'active',primary_position:'ST',nationality:'ITA'});
  expect(typeof row.id).toBe('number');
  expect('preview_id' in row).toBe(false);
 }
 expect(records.every(row=>row.world_generation===oldWorld.generation&&row.entry_season===oldWorld.seasonNumber)).toBe(true);
 const read=await (await request('')).json() as any;
 expect(read.count).toBe(2);
 expect(read.players.map((p:any)=>p.id).sort()).toEqual(actual.map((p:any)=>p.id).sort());
 expect(await readWorld(db)).toEqual(oldWorld);
});
it('Auto seeds are fresh per preview; manually supplied seeds remain reproducible',async()=>{
 const options={count:2,primaryNationality:'ITA',primaryPosition:'ST'};
 const first=await createPreview(options),second=await createPreview(options);
 expect(first.summary.seed).toMatch(/^fa-auto-[0-9a-f-]{36}$/);
 expect(second.summary.seed).toMatch(/^fa-auto-[0-9a-f-]{36}$/);
 expect(second.summary.seed).not.toBe(first.summary.seed);
 const saved=await db.prepare('SELECT seed,options_json FROM player_generation_drafts WHERE id=?').bind(first.draftId).first<{seed:string;options_json:string}>();
 expect(saved?.seed).toBe(first.summary.seed);
 expect(JSON.parse(saved!.options_json).seed).toBe(first.summary.seed);
 const selected={...options,seed:'repeatable-manual-seed'};
 const manual1=await createPreview(selected),manual2=await createPreview(selected);
 expect(manual1.summary.seed).toBe(selected.seed);
 expect(manual2.summary.seed).toBe(selected.seed);
 const withoutIdentifiers=(players:any[])=>players.map(({preview_id,...rest})=>rest);
 expect(withoutIdentifiers(manual1.candidates)).toEqual(withoutIdentifiers(manual2.candidates));
 expect((await db.prepare('SELECT COUNT(*) AS n FROM generated_players').first<{n:number}>())?.n).toBe(0);
});
it('fails closed on missing/invalid approval, invalid options, missing CSRF and revoked grants',async()=>{
 const bad=await request('/preview',{options:{count:2,experimentalLegacySecondaryModel:true}});
 expect(bad.status).toBe(422);
 const badCount=await request('/preview',{options:{count:1001}});
 expect(badCount.status).toBe(422);
 const noCsrf=await request('/preview',{options:{count:1}},{'X-CSRF-Token':''});
 expect(noCsrf.status).toBe(403);
 const preview=await createPreview({count:1,seed:'security-seed'});
 const before=(await db.prepare('SELECT COUNT(*) AS n FROM generated_players').first<{n:number}>())?.n;
 expect((await request('/commit',{draftId:preview.draftId,confirmation:'YES'})).status).toBe(422);
 expect((await request('/commit',{draftId:preview.draftId,confirmation:'GENERATE PLAYERS'},{'X-CSRF-Token':''})).status).toBe(403);
 await db.prepare("DELETE FROM account_permissions WHERE account_id=? AND permission='admin.world.write'").bind(playerId).run();
 expect((await request('/commit',{draftId:preview.draftId,confirmation:'GENERATE PLAYERS'})).status).toBe(403);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM generated_players').first<{n:number}>())?.n).toBe(before);
});
it('stale world and expired draft cannot create players',async()=>{
 const preview=await createPreview({count:1,seed:'stale-world'});
 await db.prepare('UPDATE world_state SET generation=? WHERE id=1').bind(crypto.randomUUID()).run();
 expect((await request('/commit',{draftId:preview.draftId,confirmation:'GENERATE PLAYERS'})).status).toBe(409);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM generated_players').first<{n:number}>())?.n).toBe(0);
 const live=await createPreview({count:1,seed:'expired-draft'});
 await db.prepare('UPDATE player_generation_drafts SET expires_at=created_at+1 WHERE id=?').bind(live.draftId).run();
 // Call the domain command with an unchanged live session but advanced clock.
 const session={actor:{id:actor,email},digest:await digestOpaqueToken(token),csrfDigest:await digestOpaqueToken(csrf),
  credentialVersion:1,unified:{playerId,sessionDigest:await digestOpaqueToken(token),csrfDigest:await digestOpaqueToken(csrf)}};
 await expect(commitPlayerGeneration(db,session as any,{draftId:live.draftId,confirmation:'GENERATE PLAYERS'},now+2)).rejects.toMatchObject({status:409});
 expect((await db.prepare('SELECT COUNT(*) AS n FROM generated_players').first<{n:number}>())?.n).toBe(0);
});

it('anonymous /api/players lists approved records only, with safe fields and pagination',async()=>{
 const empty=await worker.fetch(new Request(origin+'/api/players/page/1'),service);
 expect(empty.status).toBe(200);
 expect((await empty.json() as any).count).toBe(0);
 const preview=await createPreview({count:51,seed:'directory-public-51',primaryNationality:'ITA',primaryPosition:'ST'});
 const before=await worker.fetch(new Request(origin+'/api/players'),service);
 expect((await before.json() as any).players).toHaveLength(0);
 expect((await request('/commit',{draftId:preview.draftId,confirmation:'GENERATE PLAYERS'})).status).toBe(200);
 const first=await worker.fetch(new Request(origin+'/api/players'),service);
 expect(first.status).toBe(200);
 expect(first.headers.get('Cache-Control')).toBe('no-store');
 const a=await first.json() as any;
 expect(a).toMatchObject({count:51,page:1,pageSize:50,totalPages:2});
 expect(a.players).toHaveLength(50);
 for(const player of a.players){
  expect(Number.isSafeInteger(player.id)&&player.id>0).toBe(true);
  expect(player).toMatchObject({nationality:'ITA',primary_position:'ST',age:expect.any(Number),height_cm:expect.any(Number)});
  expect(player.display_name).toContain(' ');
  expect(player.first_name).toEqual(expect.any(String));
  expect(player.last_name).toEqual(expect.any(String));
  expect(player.secondary_nationality===null||typeof player.secondary_nationality==='string').toBe(true);
  expect(Object.keys(player.attributes)).toHaveLength(20);
  for(const value of Object.values(player.attributes) as number[])expect(Number.isInteger(value)&&value>=1&&value<=99).toBe(true);
  for(const privateField of ['initial_age','development_aptitude','batch_id','seed','preview_id','identity_sources']){
   expect(player).not.toHaveProperty(privateField);
  }
 }
 const second=await worker.fetch(new Request(origin+'/api/players/page/2'),service);
 expect((await second.json() as any).players).toHaveLength(1);
 const invalid=await worker.fetch(new Request(origin+'/api/players?page=2'),service);
 expect(invalid.status).toBe(422);
 const post=await worker.fetch(new Request(origin+'/api/players',{method:'POST'}),service);
 expect(post.status).toBe(405);
});
