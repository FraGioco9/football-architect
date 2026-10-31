import {beforeAll,beforeEach,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import worker from '../src/index.ts';
import {prepareSeason} from '../src/commands.ts';
import {generateSeasonCalendar} from '../src/calendar-command.ts';
import {executeLifecycle} from '../src/lifecycle-command.ts';
import {closeSeason} from '../src/season-close-command.ts';
import {archiveSeason} from '../src/season-archive-command.ts';
import {proposeEndSeasonMilestones} from '../src/admin-calendar-policy.ts';
import {approveSeasonTwoSnapshot} from '../src/season-two-approval-command.ts';
import {readSeasonTwoCandidate} from '../src/season-two-candidate-read.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {readWorld} from '../src/world-repository.ts';
import {type AdminSession} from '../src/auth.ts';
import {playerCsrfFor} from '../src/player-auth.ts';
import {digestOpaqueToken} from '../src/session-tokens.ts';
const bindings=env as any,db=bindings.DB,now=Math.floor(Date.now()/1000),token='6'.repeat(64),config={DB:db,PLAYER_MODE:'local',PLAYER_ORIGIN:'http://localhost:2000'};
let world:Awaited<ReturnType<typeof readWorld>>,session:AdminSession,csrf:string;
const meta=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});
const call=(path:string,body?:unknown,headers:Record<string,string>={})=>worker.fetch(new Request('http://localhost:2000'+path,{method:body===undefined?'GET':'POST',headers:{Cookie:'fa_player_local='+token,Origin:config.PLAYER_ORIGIN,'Content-Type':'application/json','X-CSRF-Token':csrf,'Idempotency-Key':crypto.randomUUID(),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),config);
async function command(path:string){const r=await call(path,meta());expect(r.status).toBe(200);const data=await r.json() as any;world=data.world;return data}
const publicRead=(path:string)=>worker.fetch(new Request('http://localhost:2000'+path),{DB:db});
async function enrollTerminalEvents(season:number){for(const e of proposeEndSeasonMilestones())await db.prepare('INSERT INTO season_admin_events(season_number,event_id,kind,scope,scheduled_day,event_order,created_at) VALUES(?,?,?,?,?,?,?)').bind(season,e.id,e.kind,e.scope,e.day,e.order,now).run()}
beforeAll(async()=>{
 await applyD1Migrations(db,bindings.TEST_MIGRATIONS);csrf=await playerCsrfFor(token);
 session={actor:{id:'activation-operator',email:'activation@example.invalid'},digest:await digestOpaqueToken(token),credentialVersion:1,csrfDigest:await digestOpaqueToken(csrf),unified:{playerId:'activation-player',sessionDigest:await digestOpaqueToken(token),csrfDigest:await digestOpaqueToken(csrf)}};
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind(session.actor.id,session.actor.email,'synthetic',now-10).run();
 await db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
  .bind('activation-player',session.actor.email,'synthetic',1,now-10,'active',now-10,now-10).run();
 await db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)')
  .bind('activation-player',session.actor.id,now-10).run();
 await db.prepare('INSERT INTO player_sessions(token_digest,account_id,credential_version,csrf_digest,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?)')
  .bind(session.digest,'activation-player',1,session.csrfDigest,now-10,now-5,now+1000).run();
 await db.batch(['admin.access','admin.world.read','admin.world.write'].map(permission=>
  db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES(?,?,?)').bind('activation-player',permission,now-10)));
 world=await readWorld(db);world=(await prepareSeason(db,session,meta(),'activation-source-prepare',await loadApprovedSnapshot(),now)).world;
 world=(await generateSeasonCalendar(db,session,meta(),'activation-source-calendar',now)).world;world=(await executeLifecycle(db,session,'start',meta(),'activation-source-start',now)).world;
 while(world.day<56)world=(await executeLifecycle(db,session,'advance',meta(),'activation-source-day-'+(world.day+1),now)).world;
 await enrollTerminalEvents(world.seasonNumber);
 world=(await archiveSeason(db,session,meta(),'activation-source-close-archive',now)).world;
 world=(await closeSeason(db,session,meta(),'activation-source-close',now)).world;
 const proposal=await readSeasonTwoCandidate(db);world=(await approveSeasonTwoSnapshot(db,session,{...meta(),snapshotHash:proposal.snapshot.snapshotHash},'activation-source-approve',now)).world;
},120000);
beforeEach(async()=>{world=await readWorld(db)});
it('protects the activation route with login, CSRF, exact Origin and current revision',async()=>{
 expect((await call('/api/admin/seasons/next-prepare',meta(),{Cookie:''})).status).toBe(401);
 expect((await call('/api/admin/seasons/next-prepare',meta(),{'X-CSRF-Token':''})).status).toBe(403);
 expect((await call('/api/admin/seasons/next-prepare',meta(),{Origin:'http://untrusted.invalid'})).status).toBe(403);
 expect((await call('/api/admin/seasons/next-prepare',{...meta(),expectedRevision:world.revision-1})).status).toBe(409);
 expect((await readWorld(db)).seasonNumber).toBe(1);
});
it('runs approved Season2 through administrative events and sporting closure while Season1 stays readable',async()=>{
 const first=await (await publicRead('/api/competitions/IT-1/seasons/1')).json() as any;
 expect(first.data.seasonState).toEqual({phase:'closed',day:56});
 const proposal=await (await call('/api/admin/seasons/next-candidate')).json() as any;
 expect(proposal.activation).toMatchObject({ready:true,targetSeason:2});
 const old=meta(),key='activation-prepare-replay',r=await call('/api/admin/seasons/next-prepare',old,{'Idempotency-Key':key});expect(r.status).toBe(200);
 const saved=await r.json() as any;world=saved.world;expect(world).toMatchObject({seasonNumber:2,phase:'preparing',day:0});
 expect(await (await call('/api/admin/seasons/next-prepare',old,{'Idempotency-Key':key})).json()).toEqual(saved);
 await command('/api/admin/seasons/events/initialize');await command('/api/admin/seasons/events/start');
 for(let n=2;n<=4;n++)await command('/api/admin/seasons/events/advance');
 expect(world).toMatchObject({seasonNumber:2,phase:'active',day:4});
 const second=await (await publicRead('/api/competitions/IT-1/seasons/2')).json() as any;
 expect(second).toMatchObject({selectedSeason:2,world:{seasonNumber:2,day:4},data:{season:2,seasonState:{phase:'active',day:4},history:null}});
 expect(second.data.participants.some((id:string)=>Number(id.split('-')[1])>16)).toBe(true);
 expect(second.data.fixtures.every((f:any)=>f.id.startsWith('season:2:'))).toBe(true);
 const oldView=await (await publicRead('/api/competitions/IT-1/seasons/1')).json() as any;
 expect(oldView).toMatchObject({world:{seasonNumber:2,day:4},status:'available',data:{season:1,seasonState:{phase:'closed',day:56}}});
 expect(oldView.data.fixtures).toEqual(first.data.fixtures);expect(oldView.data.history).toEqual(first.data.history);
 while(world.day<56)await command('/api/admin/seasons/advance');
 const ready=await (await call('/api/admin/seasons/events')).json() as any;expect(ready.closure.ready).toBe(true);
 await command('/api/admin/seasons/archive');
 const archived=await (await call('/api/admin/seasons/events')).json() as any;
 expect(archived.events.find((event:any)=>event.id==='season:archive')?.status).toBe('completed');
 await command('/api/admin/seasons/close');
 const closed=await (await publicRead('/api/competitions/IT-1/seasons/2')).json() as any;
 expect(closed).toMatchObject({status:'available',data:{history:{season:2},seasonState:{phase:'closed',day:56}}});
 const daily=await (await publicRead('/api/calendar/seasons/1/days/13')).json() as any;expect(daily.data.fixtures).toHaveLength(128);expect(daily.data.seasonState.phase).toBe('closed');
 expect((await call('/api/admin/seasons/next-prepare',meta())).status).toBe(409);
},180000);
