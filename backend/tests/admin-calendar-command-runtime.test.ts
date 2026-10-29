import {beforeAll,beforeEach,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {prepareSeason} from '../src/commands.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {readWorld} from '../src/world-repository.ts';
import {hashText,csrfFor,type AdminSession} from '../src/auth.ts';
import {digestOpaqueToken} from '../src/session-tokens.ts';
import {rescheduleSeasonEvent} from '../src/admin-calendar-command.ts';
import {proposeAdministrativeMilestones} from '../src/admin-calendar-policy.ts';
import {handleAdmin} from '../src/http-admin.ts';
import type {Database} from '../src/database.ts';
const bindings=env as any,db=bindings.DB,now=Math.floor(Date.now()/1000),token='d'.repeat(64);
let session:AdminSession,world:Awaited<ReturnType<typeof readWorld>>,csrf:string;
const command=()=>({expectedGeneration:world.generation,expectedRevision:world.revision,eventId:'international:draw',day:2,order:2});
const run=(key='event-reschedule-synthetic-0001',input:unknown=command(),database:Database=db)=>rescheduleSeasonEvent(database,session,input,key,now);
beforeAll(async()=>{await applyD1Migrations(db,bindings.TEST_MIGRATIONS)});
beforeEach(async()=>{
 await db.batch(['DELETE FROM season_domestic_stages','DELETE FROM season_admin_events','DELETE FROM season_knockout_ties','DELETE FROM season_day_outcomes','DELETE FROM season_draws','DELETE FROM season_calendars','DELETE FROM admin_operations','DELETE FROM seasons','DELETE FROM admin_sessions','DELETE FROM admin_accounts',"UPDATE world_state SET revision=0,season_number=0,day=0,phase='unstarted'"].map(q=>db.prepare(q)));
 csrf=await csrfFor(token);
 session={actor:{id:'event-operator',email:'event@example.invalid'},digest:await digestOpaqueToken(token),credentialVersion:1,csrfDigest:await hashText(csrf)};
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind(session.actor.id,session.actor.email,'synthetic-not-login',now-100).run();
 await db.prepare('INSERT INTO admin_sessions VALUES(?,?,?,?,?,?,?)').bind(session.digest,session.actor.id,1,session.csrfDigest,now-100,now-10,now+1000).run();
 world=await readWorld(db);
 world=(await prepareSeason(db,session,{expectedGeneration:world.generation,expectedRevision:world.revision},'event-prepare-synthetic-0001',await loadApprovedSnapshot(),now)).world;
 // Explicitly stage the proposal in disposable D1. The production prepare
 // path deliberately does not yet seed or execute these milestones.
 for(const e of proposeAdministrativeMilestones())await db.prepare('INSERT INTO season_admin_events(season_number,event_id,kind,scope,scheduled_day,event_order,created_at) VALUES(?,?,?,?,?,?,?)').bind(1,e.id,e.kind,e.scope,e.day,e.order,now).run();
});
it('commits one future move, revision and audit with durable replay',async()=>{
 const result=await run();
 expect(result.world.revision).toBe(2);
 expect((await db.prepare("SELECT scheduled_day,event_order FROM season_admin_events WHERE event_id='international:draw'").first())).toMatchObject({scheduled_day:2,event_order:2});
 expect(await run()).toEqual(result);
 expect((await db.prepare("SELECT count(*) n FROM admin_operations WHERE command='reschedule-admin-event-v1'").first()).n).toBe(1);
});
it('enforces dependency, stale revision, conflicting replay, competing writers and completed event protection',async()=>{
 await expect(run('blocked-move-synthetic',{...command(),day:1,order:3})).rejects.toMatchObject({status:409});
 const original=command(),race=await Promise.allSettled([run('event-race-key-00001',original),run('event-race-key-00002',original)]);
 expect(race.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 expect(race.filter(r=>r.status==='rejected').map((r:any)=>r.reason.status)).toEqual([409]);
 await expect(run('event-race-key-00003',original)).rejects.toMatchObject({status:409});
 await expect(run('event-race-key-00001',{...original,day:3})).rejects.toMatchObject({status:409});
});
it('rolls back placement and revision on late audit failure; rejects revoked session',async()=>{
 await db.prepare("CREATE TRIGGER admin_event_late_fail BEFORE INSERT ON admin_operations WHEN NEW.command='reschedule-admin-event-v1' BEGIN SELECT RAISE(ABORT,'late failure'); END").run();
 try{await expect(run()).rejects.toMatchObject({status:503})}finally{await db.prepare('DROP TRIGGER admin_event_late_fail').run()}
 expect(await readWorld(db)).toEqual(world);
 expect((await db.prepare("SELECT scheduled_day FROM season_admin_events WHERE event_id='international:draw'").first()).scheduled_day).toBe(3);
 await db.prepare('DELETE FROM admin_sessions').run();
 await expect(run()).rejects.toMatchObject({status:401});
});
it('HTTP enforces origin, CSRF and strict authenticated admin input',async()=>{
 const env={DB:db,ADMIN_MODE:'local',ADMIN_ORIGIN:'http://localhost:2000'};
 const req=(headers:Record<string,string>={},value:unknown=command())=>new Request('http://localhost:2000/api/admin/seasons/events/reschedule',{method:'POST',headers:{'Content-Type':'application/json',Origin:env.ADMIN_ORIGIN,Cookie:'fa_admin_local='+token,'X-CSRF-Token':csrf,'Idempotency-Key':'event-http-reschedule-0001',...headers},body:JSON.stringify(value)});
 for(const headers of [{Cookie:''},{Origin:'https://evil.example'},{'X-CSRF-Token':''}] as Record<string,string>[])expect((await handleAdmin(req(headers),env)).status).toBeGreaterThanOrEqual(400);
 expect((await handleAdmin(req({}, {...command(),clientApproval:true}),env)).status).toBe(422);
 const res=await handleAdmin(req({},command()),env);expect(res.status).toBe(200);
});
