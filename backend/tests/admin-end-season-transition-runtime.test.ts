import {beforeAll,beforeEach,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {captureTestWorld,restoreTestWorld} from './fixtures/test-world.ts';
import {prepareSeason} from '../src/commands.ts';
import {generateSeasonCalendar} from '../src/calendar-command.ts';
import {executeLifecycle} from '../src/lifecycle-command.ts';
import {archiveSeason} from '../src/season-archive-command.ts';
import {closeSeason} from '../src/season-close-command.ts';
import {readClosedSeasonHistory} from '../src/season-archive-read.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {readWorld} from '../src/world-repository.ts';
import {type AdminSession} from '../src/auth.ts';
import {digestOpaqueToken} from '../src/session-tokens.ts';
import {proposeEndSeasonMilestones} from '../src/admin-calendar-policy.ts';
const bindings=env as any,db=bindings.DB,now=Math.floor(Date.now()/1000);
let session:AdminSession,world:Awaited<ReturnType<typeof readWorld>>,baseline:Awaited<ReturnType<typeof captureTestWorld>>;
const input=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});
const receipts=()=>db.prepare('SELECT event_id,status,receipt_hash FROM season_admin_events WHERE season_number=1 ORDER BY event_order').all();
const count=async(table:string)=>(await db.prepare('SELECT count(*) n FROM '+table).first())!.n;
beforeAll(async()=>{
 await applyD1Migrations(db,bindings.TEST_MIGRATIONS);
 session={actor:{id:'end-season-operator',email:'end-season@example.invalid'},digest:await digestOpaqueToken('end-season-test-player-token'),credentialVersion:1,csrfDigest:await digestOpaqueToken('end-season-test-player-csrf'),unified:{playerId:'end-season-player',sessionDigest:await digestOpaqueToken('end-season-test-player-token'),csrfDigest:await digestOpaqueToken('end-season-test-player-csrf')}};
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind(session.actor.id,session.actor.email,'synthetic',now-10).run();
 await db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
  .bind('end-season-player',session.actor.email,'synthetic',1,now-10,'active',now-10,now-10).run();
 await db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)')
  .bind('end-season-player',session.actor.id,now-10).run();
 await db.prepare('INSERT INTO player_sessions(token_digest,account_id,credential_version,csrf_digest,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?)')
  .bind(session.digest,'end-season-player',1,session.csrfDigest,now-10,now-5,now+1000).run();
 await db.batch(['admin.access','admin.world.read','admin.world.write'].map(permission=>
  db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES(?,?,?)').bind('end-season-player',permission,now-10)));
 world=await readWorld(db);
 world=(await prepareSeason(db,session,input(),'end-season-prepare',await loadApprovedSnapshot(),now)).world;
 world=(await generateSeasonCalendar(db,session,input(),'end-season-calendar',now)).world;
 world=(await executeLifecycle(db,session,'start',input(),'end-season-start',now)).world;
 while(world.day<56)world=(await executeLifecycle(db,session,'advance',input(),'end-season-day-'+(world.day+1),now)).world;
 for(const e of proposeEndSeasonMilestones())await db.prepare('INSERT INTO season_admin_events(season_number,event_id,kind,scope,scheduled_day,event_order,created_at) VALUES(?,?,?,?,?,?,?)').bind(1,e.id,e.kind,e.scope,e.day,e.order,now).run();
 baseline=await captureTestWorld(db);
},120000);
beforeEach(async()=>{await restoreTestWorld(db,baseline);world=await readWorld(db)});
it('rejects close without archive and preserves the sporting world',async()=>{
 const before=world;
 await expect(closeSeason(db,session,input(),'admin-end-season-no-archive-0001',now)).rejects.toMatchObject({status:409});
 expect(await readWorld(db)).toEqual(before);
 expect(await count('season_archives')).toBe(0);
});
it('archives exactly once without closure, then closes with durable receipts and immutable History',async()=>{
 const original=input(),archive=await archiveSeason(db,session,original,'admin-end-season-archive-once-0001',now);world=archive.world;
 expect(world.phase).toBe('active');
 expect(await archiveSeason(db,session,original,'admin-end-season-archive-once-0001',now)).toEqual(archive);
 expect(await count('season_archives')).toBe(1);
 expect(await count('season_archive_summaries')).toBe(1);
 await expect(readClosedSeasonHistory(db,1)).rejects.toMatchObject({status:409});
 const prev=input(),closed=await closeSeason(db,session,prev,'admin-end-season-close-once-0001',now);world=closed.world;
 expect(world.phase).toBe('closed');
 expect(await closeSeason(db,session,prev,'admin-end-season-close-once-0001',now)).toEqual(closed);
 expect((await receipts()).results.map((e:any)=>e.status)).toEqual(['completed','completed','scheduled']);
 const history=await readClosedSeasonHistory(db,1);
 expect(history.archiveHash).toMatch(/^[a-f0-9]{64}$/);
 expect(await count('season_archives')).toBe(1);
});
it('rolls back archive receipt, summary, world revision and audit on a late transaction error',async()=>{
 const before=await readWorld(db);
 await db.prepare("CREATE TRIGGER archive_late_failure BEFORE INSERT ON admin_operations WHEN NEW.command='archive-season-v2' BEGIN SELECT RAISE(ABORT,'late audit failure'); END").run();
 try{await expect(archiveSeason(db,session,input(),'admin-end-season-archive-rollback-0001',now)).rejects.toMatchObject({status:503})}
 finally{await db.prepare('DROP TRIGGER archive_late_failure').run()}
 expect(await readWorld(db)).toEqual(before);
 expect(await count('season_archives')).toBe(0);
 expect(await count('season_archive_summaries')).toBe(0);
 expect((await receipts()).results.every((e:any)=>e.status==='scheduled')).toBe(true);
});
it('rejects concurrent competing archive writes without duplicate sporting archives',async()=>{
 const command=input();
 const outcomes=await Promise.allSettled([archiveSeason(db,session,command,'admin-end-season-race-a-0001',now),archiveSeason(db,session,command,'admin-end-season-race-b-0001',now)]);
 expect(outcomes.filter(x=>x.status==='fulfilled')).toHaveLength(1);
 expect(await count('season_archives')).toBe(1);
 expect(await count('season_archive_summaries')).toBe(1);
});
