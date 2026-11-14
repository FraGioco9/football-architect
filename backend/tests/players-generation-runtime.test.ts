import {beforeAll,beforeEach,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {clearTestWorld} from './fixtures/test-world.ts';
import {seedUnifiedAdminHttp} from './fixtures/unified-admin-http.ts';
import {handleAdmin} from '../src/http-admin.ts';
import worker from '../src/index.ts';
import {readWorld} from '../src/world-repository.ts';
import {commitPlayerGeneration} from '../src/players-generation-command.ts';
import hostedPreview from '../src/preview.ts';
import {pruneExpiredPlayerPreviews} from '../src/player-preview-retention.ts';
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
 const fetched=await request('/draft',{draftId:preview.draftId});
 expect(fetched.status).toBe(200);
 const refreshed=await fetched.json() as any;
 expect(refreshed.candidates).toHaveLength(preview.summary.count);
 expect(refreshed.candidates[0]).toMatchObject({display_name:preview.candidates[0].display_name,age:preview.candidates[0].age,attributes:preview.candidates[0].attributes,preview_id:preview.candidates[0].preview_id});
 expect(refreshed.status).toBe('preview');
 expect(refreshed.candidates[0].id).toBeUndefined();
 expect(refreshed.summary.seed).toBe(preview.summary.seed);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM generated_players').first<{n:number}>())?.n).toBe(0);
 expect((await request('/draft',{draftId:preview.draftId,unexpected:1})).status).toBe(422);
 const confirm={draftId:preview.draftId,confirmation:'GENERATE PLAYERS'};
 const success=await request('/commit',confirm);
 expect(success.status).toBe(200);
 const result=await success.json() as any;
 expect(result.count).toBe(2);expect(result.alreadyCommitted).toBe(false);
 const committedRead=await request('/draft',{draftId:preview.draftId});
 expect(committedRead.status).toBe(200);
 const committedSnapshot=await committedRead.json() as any;
 expect(committedSnapshot.status).toBe('committed');
 expect(committedSnapshot.candidates).toEqual(refreshed.candidates);
 expect(committedSnapshot.options.seed).toBe(preview.summary.seed);
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
it('creation prunes expired drafts, but preserves active previews, committed parents and player records',async()=>{
 const committed=await createPreview({count:1,seed:'ttl-committed'});
 expect((await request('/commit',{draftId:committed.draftId,confirmation:'GENERATE PLAYERS'})).status).toBe(200);
 const expired=await createPreview({count:1,seed:'ttl-expired'});
 const active=await createPreview({count:1,seed:'ttl-active'});
 await db.prepare('UPDATE player_generation_drafts SET created_at=created_at-7200,expires_at=expires_at-7200 WHERE id IN (?,?)')
  .bind(expired.draftId,committed.draftId).run();
 await createPreview({count:1,seed:'ttl-trigger'});
 expect(await db.prepare('SELECT id FROM player_generation_drafts WHERE id=?').bind(expired.draftId).first()).toBeNull();
 expect((await db.prepare('SELECT status FROM player_generation_drafts WHERE id=?').bind(active.draftId).first())?.status).toBe('preview');
 expect((await db.prepare('SELECT status FROM player_generation_drafts WHERE id=?').bind(committed.draftId).first())?.status).toBe('committed');
 expect((await db.prepare('SELECT COUNT(*) AS n FROM generated_players').first<{n:number}>())?.n).toBe(1);
 expect((await request('/commit',{draftId:expired.draftId,confirmation:'GENERATE PLAYERS'})).status).toBe(404);
});

it('scheduled Preview cleanup is bounded, idempotent and rejects non-preview deployments',async()=>{
 const expired=await createPreview({count:1,seed:'ttl-cron-expired'});
 const fresh=await createPreview({count:1,seed:'ttl-cron-fresh'});
 await db.prepare('UPDATE player_generation_drafts SET created_at=created_at-7200,expires_at=expires_at-7200 WHERE id=?')
  .bind(expired.draftId).run();
 expect(await pruneExpiredPlayerPreviews(db,Math.floor(Date.now()/1000),1)).toBe(1);
 expect(await pruneExpiredPlayerPreviews(db,Math.floor(Date.now()/1000))).toBe(0);
 expect((await db.prepare('SELECT status FROM player_generation_drafts WHERE id=?').bind(fresh.draftId).first())?.status).toBe('preview');
 await db.prepare('UPDATE player_generation_drafts SET created_at=created_at-7200,expires_at=expires_at-7200 WHERE id=?')
  .bind(fresh.draftId).run();
 const pool=await db.prepare('SELECT pool FROM account_environment_pool WHERE id=1').first<{pool:string}>();
 if(!pool)await db.prepare("INSERT INTO account_environment_pool(id,pool,initialized_at) VALUES(1,'dev-preview',?)").bind(Math.floor(Date.now()/1000)).run();
 const cronEnv={DB:db,PLAYER_MODE:'preview',PLAYER_TRUSTED_SOURCE:'cloudflare',
  PLAYER_ORIGIN:'https://preview.football-architect.workers.dev',
  ASSETS:{fetch:async()=>new Response('unused')}};
 const ctl={cron:'15 * * * *'};
 await expect(hostedPreview.scheduled(ctl,{...cronEnv,PLAYER_MODE:'production'})).rejects.toThrow('preview_retention_unavailable');
 await expect(hostedPreview.scheduled({cron:'0 * * * *'},cronEnv)).rejects.toThrow('preview_retention_unavailable');
 expect((await db.prepare("SELECT COUNT(*) AS n FROM player_generation_drafts WHERE status='preview'").first<{n:number}>())?.n).toBe(1);
 await hostedPreview.scheduled(ctl,cronEnv);
 expect((await db.prepare("SELECT COUNT(*) AS n FROM player_generation_drafts WHERE status='preview'").first<{n:number}>())?.n).toBe(0);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM generated_players').first<{n:number}>())?.n).toBe(0);
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
 expect((await request('/draft',{draftId:preview.draftId})).status).toBe(403);
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
 // Created by the HTTP handler using its current wall clock; the module-level
 // fixture clock may be older when the full CI suite is under load.
 const liveRow=await db.prepare('SELECT created_at FROM player_generation_drafts WHERE id=?').bind(live.draftId).first<{created_at:number}>();
 expect(liveRow).not.toBeNull();
 await expect(commitPlayerGeneration(db,session as any,{draftId:live.draftId,confirmation:'GENERATE PLAYERS'},liveRow!.created_at+2)).rejects.toMatchObject({status:409});
 expect((await db.prepare('SELECT COUNT(*) AS n FROM generated_players').first<{n:number}>())?.n).toBe(0);
});

it('anonymous /api/players lists approved records only, with safe fields and pagination',async()=>{
 const empty=await worker.fetch(new Request(origin+'/api/players?offset=0'),service);
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
 const second=await worker.fetch(new Request(origin+'/api/players?offset=50'),service);
 expect(second.status).toBe(200);
 const b=await second.json() as any;
 expect(b).toMatchObject({count:51,page:2,pageSize:50,totalPages:2});
 expect(b.players).toHaveLength(1);
 const offsetSecond=await worker.fetch(new Request(origin+'/api/players?offset=50'),service);
 expect(offsetSecond.status).toBe(200);
 expect((await offsetSecond.json() as any).players.map((p:any)=>p.id)).toEqual(b.players.map((p:any)=>p.id));
 const offsetFirst=await worker.fetch(new Request(origin+'/api/players?offset=0'),service);
 expect(offsetFirst.status).toBe(200);
 expect((await offsetFirst.json() as any).players.map((p:any)=>p.id)).toEqual(a.players.map((p:any)=>p.id));
 const firstExplicit=await worker.fetch(new Request(origin+'/api/players?offset=0'),service);
 expect(firstExplicit.status).toBe(200);
 expect((await firstExplicit.json() as any).players).toHaveLength(50);
 const matched=await worker.fetch(new Request(origin+'/api/players?position=ST&nationality=ITA&ageMin=0&ageMax=120'),service);
 expect(matched.status).toBe(200);
 expect(await matched.json()).toMatchObject({count:51,page:1,pageSize:50,totalPages:2});
 const missed=await worker.fetch(new Request(origin+'/api/players?nationality=ENG&position=GK'),service);
 expect(missed.status).toBe(200);
 expect(await missed.json()).toMatchObject({count:0,page:1,totalPages:1,players:[]});
 const overflow=await worker.fetch(new Request(origin+'/api/players?offset=100&nationality=ITA&position=ST'),service);
 expect(overflow.status).toBe(200);
 expect(await overflow.json()).toMatchObject({count:51,page:3,totalPages:2,players:[]});
 // The first-click DESC order puts GK first, then right-to-left positions.
 const sortedIds=await db.prepare('SELECT id FROM generated_players ORDER BY id LIMIT 3').all<{id:number}>();
 for(const [index,position] of ['GK','RB','LW'].entries()){
  await db.prepare("UPDATE generated_players SET payload_json=json_set(payload_json,'$.primary_position',?) WHERE id=?")
   .bind(position,sortedIds.results[index].id).run();
 }
 const pitched=await worker.fetch(new Request(origin+'/api/players?sort=positions&order=desc'),service);
 expect(pitched.status).toBe(200);
 expect(((await pitched.json()) as any).players.slice(0,3).map((player:any)=>player.primary_position)).toEqual(['GK','RB','LW']);
 const reverse=await worker.fetch(new Request(origin+'/api/players?sort=positions&order=asc'),service);
 expect(reverse.status).toBe(200);
 expect(((await reverse.json()) as any).players[0].primary_position).toBe('ST');
 // Invalid, unknown, duplicate, reversed and ambiguous values all return 422.
 for(const invalidQuery of ['?offset=1','?offset=01','?offset=51','?offset=-50','?offset=500000','?offset=50&page=2','?page=2&offset=50','?offset=50&offset=100','?page=1','?page=2','?page=9999','?page=0','?page=-1','?page=01','?page=1.5','?page=10000','?page=','?page=2&page=3','?page=2&sort=unknown','?view=overview','?ageMin=25&ageMax=20','?position=CF','?nationality=%49TA']){
  const invalid=await worker.fetch(new Request(origin+'/api/players'+invalidQuery),service);
  expect(invalid.status,invalidQuery).toBe(422);
  expect(await invalid.json()).toMatchObject({error:{code:'invalid_public_request'}});
 }
 const legacy=await worker.fetch(new Request(origin+'/api/players/page/2'),service);
 expect(legacy.status).toBe(404);
 const post=await worker.fetch(new Request(origin+'/api/players',{method:'POST'}),service);
 expect(post.status).toBe(405);
});


it('public Players filters support multiselect and opt-in secondary matches across full generations',async()=>{
 const preview=await createPreview({count:51,seed:'multiselect-secondary-51',primaryNationality:'ITA',primaryPosition:'ST'});
 expect((await request('/commit',{draftId:preview.draftId,confirmation:'GENERATE PLAYERS'})).status).toBe(200);
 // Controlled stored fixtures: only the earliest ID has ENG and RW as secondary values.
 await db.prepare("UPDATE generated_players SET payload_json=json_set(payload_json,'$.secondary_nationality',NULL,'$.secondary_positions',json('[]'))").run();
 const first=await db.prepare('SELECT MIN(id) AS id FROM generated_players').first<{id:number}>();
 expect(first?.id).toEqual(expect.any(Number));
 await db.prepare("UPDATE generated_players SET payload_json=json_set(payload_json,'$.secondary_nationality','ENG','$.secondary_positions',json('[\"RW\",\"LW\"]')) WHERE id=?")
  .bind(first!.id).run();
 const get=async(query:string)=>{
  const response=await worker.fetch(new Request(origin+'/api/players'+query),service);
  return {status:response.status,data:await response.json() as any};
 };
 const primaryN=await get('?nationality=ENG');
 expect(primaryN).toMatchObject({status:200,data:{count:0,players:[]}});
 const anyN=await get('?nationality=ENG&nationalityScope=any');
 expect(anyN).toMatchObject({status:200,data:{count:1,page:1,totalPages:1}});
 expect(anyN.data.players[0].id).toBe(first!.id);
 const primaryP=await get('?position=RW');
 expect(primaryP).toMatchObject({status:200,data:{count:0}});
 const anyP=await get('?position=RW&positionScope=any');
 expect(anyP).toMatchObject({status:200,data:{count:1}});
 expect(anyP.data.players[0].id).toBe(first!.id);
 const combined=await get('?nationality=ENG&nationalityScope=any&position=LW&positionScope=any');
 expect(combined).toMatchObject({status:200,data:{count:1}});
 expect(combined.data.players[0].id).toBe(first!.id);
 const noCrossMatch=await get('?nationality=ENG&position=RW&positionScope=any');
 expect(noCrossMatch).toMatchObject({status:200,data:{count:0}});
 const twoNationalities=await get('?nationality=ITA%2CENG&offset=50');
 expect(twoNationalities).toMatchObject({status:200,data:{count:51,page:2,totalPages:2}});
 expect(twoNationalities.data.players).toHaveLength(1);
 const twoPositions=await get('?position=ST%2CRW&positionScope=any');
 expect(twoPositions).toMatchObject({status:200,data:{count:51,page:1,totalPages:2}});
 const heights=await get('?heightMin=100&heightMax=250');
 expect(heights).toMatchObject({status:200,data:{count:51,page:1,totalPages:2}});
 const tall=await get('?heightMin=250');
 expect(tall).toMatchObject({status:200,data:{count:0}});
 for(const query of [
  '?nationalityScope=any','?positionScope=any',
  '?nationality=ITA%2CITA','?position=ST%2CST',
  '?nationality=ITA%2CXYZ','?position=RW%2CXX',
  '?nationality=%49TA','?nationality=ITA%2cENG',
  '?heightMin=99','?heightMax=251','?heightMin=200&heightMax=190',
  '?nationality=ENG&nationalityScope=primary','?position=RW&positionScope=secondary',
  '?nationality=ITA&nationality=ENG'
 ]){
  const invalid=await get(query);
  expect(invalid.status,query).toBe(422);
  expect(invalid.data).toMatchObject({error:{code:'invalid_public_request'}});
 }
});


it('public name substring and multiple attribute ranges filter the active generation before COUNT/page',async()=>{
 const preview=await createPreview({count:51,seed:'directory-name-attrs-51',primaryNationality:'ITA',primaryPosition:'ST'});
 expect((await request('/commit',{draftId:preview.draftId,confirmation:'GENERATE PLAYERS'})).status).toBe(200);
 // Isolate the test criteria so both filtered count and pages have deterministic membership.
 await db.prepare("UPDATE generated_players SET payload_json=json_set(payload_json,'$.attributes.passing',1,'$.attributes.vision',1)").run();
 const first=await db.prepare('SELECT MIN(id) AS id FROM generated_players').first<{id:number}>();
 expect(first?.id).toEqual(expect.any(Number));
 await db.prepare("UPDATE generated_players SET payload_json=json_set(payload_json,'$.first_name','Andrea','$.last_name','Filterprobe','$.display_name','Andrea Filterprobe','$.attributes.passing',87,'$.attributes.vision',93) WHERE id=?")
  .bind(first!.id).run();
 const get=async(query:string)=>{
  const response=await worker.fetch(new Request(origin+'/api/players'+query),service);
  return {status:response.status,data:await response.json() as any};
 };
 const name=await get('?name=filterprobe');
 expect(name).toMatchObject({status:200,data:{count:1,page:1,totalPages:1}});
 expect(name.data.players[0].id).toBe(first!.id);
 const combined=await get('?name=Andrea+Filterprobe&attributes=passing_87_87%2Cvision_90_x');
 expect(combined).toMatchObject({status:200,data:{count:1,totalPages:1}});
 expect(combined.data.players[0].id).toBe(first!.id);
 const low=await get('?attributes=passing_1_1&offset=50');
 expect(low).toMatchObject({status:200,data:{count:50,page:2,totalPages:1,players:[]}});
 const high=await get('?attributes=passing_88_99');
 expect(high).toMatchObject({status:200,data:{count:0,players:[]}});
 const xOnly=await get('?attributes=vision_x_92');
 expect(xOnly).toMatchObject({status:200,data:{count:50}});
 const oneLower=await get('?attributes=gk_reflexes_1_x');
 expect(oneLower.status).toBe(200);
 const nameMiss=await get('?name=NoSuchFilterprobe');
 expect(nameMiss).toMatchObject({status:200,data:{count:0}});
 for(const invalid of [
  '?name=%25','?name=Andrea%20Filterprobe','?name=%20Andrea',
  '?attributes=passing_x_x','?attributes=vision_0_90','?attributes=vision_60_100',
  '?attributes=vision_80_60','?attributes=unknown_30_x',
  '?attributes=passing_50_x%2Cpassing_60_x',
  '?attributes=vision_60_x%2Cvision_70_x',
  '?attributes=vision_60_x&attributes=passing_20_x',
  '?attributes=vision_60_x%2cpassing_20_x'
 ]){
  const resp=await get(invalid);
  expect(resp.status,invalid).toBe(422);
  expect(resp.data).toMatchObject({error:{code:'invalid_public_request'}});
 }
});


it('sorting all generated Players is stable across pages, not limited to the 50 visible rows',async()=>{
 const preview=await createPreview({count:51,seed:'players-global-sort-51',primaryNationality:'ITA',primaryPosition:'ST'});
 expect((await request('/commit',{draftId:preview.draftId,confirmation:'GENERATE PLAYERS'})).status).toBe(200);
 const first=await db.prepare('SELECT MIN(id) AS id FROM generated_players').first<{id:number}>();
 expect(first?.id).toEqual(expect.any(Number));
 await db.prepare("UPDATE generated_players SET payload_json=json_set(payload_json,'$.age',22,'$.attributes.passing',1,'$.display_name','AAA Sortprobe')").run();
 await db.prepare("UPDATE generated_players SET payload_json=json_set(payload_json,'$.age',80,'$.attributes.passing',99,'$.display_name','ZZZ Sortprobe') WHERE id=?")
  .bind(first!.id).run();
 const get=async(query:string)=>{
  const response=await worker.fetch(new Request(origin+'/api/players'+query),service);
  return {status:response.status,data:await response.json() as any};
 };
 const maxAge=await get('?sort=age&order=desc&offset=0');
 expect(maxAge).toMatchObject({status:200,data:{count:51,totalPages:2,page:1}});
 expect(maxAge.data.players[0].id).toBe(first!.id);
 const ascendingLast=await get('?sort=age&order=asc&offset=50');
 expect(ascendingLast).toMatchObject({status:200,data:{count:51,totalPages:2,page:2}});
 expect(ascendingLast.data.players).toHaveLength(1);
 expect(ascendingLast.data.players[0].id).toBe(first!.id);
 const passing=await get('?sort=passing&order=desc');
 expect(passing).toMatchObject({status:200,data:{count:51,totalPages:2}});
 expect(passing.data.players[0].id).toBe(first!.id);
 const names=await get('?sort=name&order=desc');
 expect(names).toMatchObject({status:200,data:{count:51,totalPages:2}});
 expect(names.data.players[0].id).toBe(first!.id);
 for(const invalid of ['?order=asc','?sort=age&order=up','?sort=unknown','?sort=passing%20','?sort=name&sort=age']){
  const response=await get(invalid);
  expect(response.status,invalid).toBe(422);
  expect(response.data).toMatchObject({error:{code:'invalid_public_request'}});
 }
});
