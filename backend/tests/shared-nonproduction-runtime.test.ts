import {beforeAll,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import worker from '../src/index.ts';
import {hashPassword} from '../src/passwords.ts';
import type {Database} from '../src/database.ts';
const binding=env as any,db=binding.DB as Database,origin='https://preview.example.invalid';
const config={...binding,PLAYER_MODE:'preview',PLAYER_ORIGIN:origin,PLAYER_TRUSTED_SOURCE:'cloudflare'};
const password='synthetic-shared-player-password-2026';
const call=(path:string,body?:unknown,headers:Record<string,string>={},configuration:any=config)=>worker.fetch(new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{'CF-Connecting-IP':'192.0.2.10',Origin:origin,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),configuration);
const cookie=(r:Response)=>r.headers.get('set-cookie')!.split(';')[0];
beforeAll(async()=>{
 await applyD1Migrations(db,binding.TEST_MIGRATIONS);
 await db.prepare("INSERT INTO account_environment_pool VALUES(1,'dev-preview',1)").run();
 const now=Math.floor(Date.now()/1000),verifier=await hashPassword(password);
 await db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind('shared-player','shared@example.invalid',verifier,now,'active',now,now).run();
});
it('advertises only the correctly stamped Preview backend without secrets or world payloads',async()=>{
 const r=await call('/api/environment');expect(r.status).toBe(200);
 expect(await r.json()).toEqual({schemaVersion:1,pool:'dev-preview',origin,sharedWorld:true,separateSignIn:true});
 expect(r.headers.get('cache-control')).toContain('no-store');
 expect((await call('/api/environment',undefined,{}, {...config,PLAYER_MODE:'production'})).status).toBe(503);
});
it('two frontend sign-ins share identity and world while logout affects only one session',async()=>{
 const payload={email:'shared@example.invalid',password};
 const dev=await call('/api/player/login',payload,{'X-FA-Expected-Pool':'dev-preview'});
 const preview=await call('/api/player/login',payload);
 expect(dev.status).toBe(200);expect(preview.status).toBe(200);
 expect(dev.headers.get('set-cookie')).toContain('__Host-fa_player=');expect(dev.headers.get('set-cookie')).toContain('Secure; HttpOnly; SameSite=Strict; Path=/');
 const devCookie=cookie(dev),previewCookie=cookie(preview);expect(devCookie).not.toBe(previewCookie);
 const devData=await dev.json() as any,previewData=await preview.json() as any;
 expect(devData.actor).toEqual(previewData.actor);
 expect(await (await call('/api/world',undefined,{Cookie:devCookie})).json()).toEqual(await (await call('/api/world',undefined,{Cookie:previewCookie})).json());
 const signedOut=await call('/api/player/logout',{}, {Cookie:devCookie,'X-CSRF-Token':devData.csrfToken});expect(signedOut.status).toBe(200);
 expect((await call('/api/player/session',undefined,{Cookie:devCookie})).status).toBe(401);
 expect((await call('/api/player/session',undefined,{Cookie:previewCookie})).status).toBe(200);
 expect((await call('/api/admin/world',undefined,{Cookie:previewCookie})).status).toBe(403);
});
it('expected nonproduction requests cannot dispatch to Production or accept unsupported pool claims',async()=>{
 const before=(await db.prepare('SELECT COUNT(*) AS n FROM player_sessions').first<{n:number}>())!.n;
 expect((await call('/api/player/login',{email:'shared@example.invalid',password},{'X-FA-Expected-Pool':'dev-preview'},{...config,PLAYER_MODE:'production'})).status).toBe(503);
 expect((await call('/api/world',undefined,{'X-FA-Expected-Pool':'production'})).status).toBe(503);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM player_sessions').first<{n:number}>())!.n).toBe(before);
});
it('Preview retains exact Origin, Cloudflare transport, CSRF and private-cookie boundaries',async()=>{
 expect((await call('/api/player/login',{email:'shared@example.invalid',password},{Origin:'https://evil.invalid'})).status).toBe(403);
 expect((await call('/api/player/session',undefined,{'CF-Connecting-IP':''})).status).toBe(503);
 expect((await call('/api/player/session',undefined,{}, {...config,PLAYER_TRUSTED_SOURCE:undefined})).status).toBe(503);
 const signed=await call('/api/player/login',{email:'shared@example.invalid',password});const session=cookie(signed);
 expect((await call('/api/player/logout',{}, {Cookie:session,'X-CSRF-Token':'wrong'})).status).toBe(403);
});
it('Preview cannot activate the native real-mail adapter even with opt-in and a binding',async()=>{
 let sends=0;
 const r=await call('/api/player/register',{email:'new@example.invalid',password,username:'new_shared_user'}, {},{...config,PLAYER_EMAIL_DELIVERY_ENABLED:'cloudflare',PLAYER_EMAIL_FROM:'noreply@example.invalid',EMAIL:{send:async()=>{sends++}}});
 expect(r.status).toBe(503);expect(sends).toBe(0);
});
it('Dev commands immediately update the Preview world and revoked Admin writes cannot change it',async()=>{
 const {seedUnifiedOperator}=await import('./fixtures/unified-operator.ts');
 const {seedUnifiedAdminHttp}=await import('./fixtures/unified-admin-http.ts');
 const now=Math.floor(Date.now()/1000),a=await seedUnifiedOperator(db,'shared-admin','shared-admin@example.invalid',now,'b'.repeat(64));
 const b=await seedUnifiedAdminHttp(db,'shared-admin','shared-admin@example.invalid',now,'c'.repeat(64));
 const devHeaders={Cookie:a.cookie.replace('fa_player_local=','__Host-fa_player='),'X-CSRF-Token':a.csrf,'X-FA-Expected-Pool':'dev-preview','Idempotency-Key':'shared-prepare-command-0001'};
 const previewHeaders={Cookie:b.cookie.replace('fa_player_local=','__Host-fa_player=')};
 const initial=(await (await call('/api/admin/world',undefined,devHeaders)).json() as any).world;
 const prepared=await call('/api/admin/seasons/prepare',{expectedGeneration:initial.generation,expectedRevision:initial.revision},devHeaders);expect(prepared.status).toBe(200);
 const world=(await prepared.json() as any).world;
 expect(world.revision).toBe(initial.revision+1);
 expect((await (await call('/api/admin/world',undefined,previewHeaders)).json() as any).world).toEqual(world);
 expect((await (await call('/api/world')).json() as any).world.revision).toBe(world.revision);
 await db.prepare("DELETE FROM account_permissions WHERE account_id=? AND permission='admin.world.write'").bind(a.playerId).run();
 const denied=await call('/api/admin/seasons/calendar',{expectedGeneration:world.generation,expectedRevision:world.revision},{...devHeaders,'Idempotency-Key':'shared-denied-command-0001'});
 expect(denied.status).toBe(403);
 expect((await (await call('/api/admin/world',undefined,previewHeaders)).json() as any).world).toEqual(world);
});
