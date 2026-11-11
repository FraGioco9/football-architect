import {beforeAll,beforeEach,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {clearTestWorld} from './fixtures/test-world.ts';
import {seedUnifiedAdminHttp} from './fixtures/unified-admin-http.ts';
import {handleAdmin} from '../src/http-admin.ts';
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
 expect(preview.candidates[0].id).toMatch(/^[0-9a-f-]{36}$/);
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
 for(const row of actual){
  const item=preview.candidates.find((candidate:any)=>candidate.id===row.id);
  expect(item).toBeTruthy();
  expect(row).toMatchObject({id:item.id,first_name:item.first_name,last_name:item.last_name,
   age:item.initial_age,career_status:'active',primary_position:'ST',nationality:'ITA'});
  expect('preview_id' in row).toBe(false);
 }
 expect(records.every(row=>row.world_generation===oldWorld.generation&&row.entry_season===oldWorld.seasonNumber)).toBe(true);
 const read=await (await request('')).json() as any;
 expect(read.count).toBe(2);
 expect(read.players.map((p:any)=>p.id).sort()).toEqual(actual.map((p:any)=>p.id).sort());
 expect(await readWorld(db)).toEqual(oldWorld);
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
