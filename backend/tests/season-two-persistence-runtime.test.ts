import {captureTestWorld,restoreTestWorld} from './fixtures/test-world.ts';
import {beforeAll,beforeEach,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {prepareSeason} from '../src/commands.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {generateSeasonCalendar} from '../src/calendar-command.ts';
import {executeLifecycle} from '../src/lifecycle-command.ts';
import {closeSeason} from '../src/season-close-command.ts';
import {archiveSeason} from '../src/season-archive-command.ts';
import {proposeEndSeasonMilestones} from '../src/admin-calendar-policy.ts';
import {approveSeasonTwoSnapshot} from '../src/season-two-approval-command.ts';
import {readSeasonTwoCandidate} from '../src/season-two-candidate-read.ts';
import {prepareSeasonTwo} from '../src/season-two-prepare-command.ts';
import {readSeasonArchives} from '../src/season-archive-read.ts';
import {readWorld} from '../src/world-repository.ts';
import {type AdminSession} from '../src/auth.ts';
import {digestOpaqueToken} from '../src/session-tokens.ts';
const bindings=env as any,db=bindings.DB,now=Math.floor(Date.now()/1000);
let baseline:Awaited<ReturnType<typeof captureTestWorld>>;
let session:AdminSession,world:Awaited<ReturnType<typeof readWorld>>;
const meta=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});
const count=async(table:string,season=2)=>(await db.prepare(`SELECT count(*) n FROM ${table} WHERE season_number=?`).bind(season).first()).n;
async function enrollTerminalEvents(season:number){for(const e of proposeEndSeasonMilestones())await db.prepare('INSERT INTO season_admin_events(season_number,event_id,kind,scope,scheduled_day,event_order,created_at) VALUES(?,?,?,?,?,?,?)').bind(season,e.id,e.kind,e.scope,e.day,e.order,now).run()}
beforeAll(async()=>{
 await applyD1Migrations(db,bindings.TEST_MIGRATIONS);
 session={actor:{id:'two-persistence',email:'two-persistence@example.invalid'},digest:await digestOpaqueToken('two-persistence-test-player-token'),credentialVersion:1,csrfDigest:await digestOpaqueToken('two-persistence-test-player-csrf'),unified:{playerId:'two-persistence-player',sessionDigest:await digestOpaqueToken('two-persistence-test-player-token'),csrfDigest:await digestOpaqueToken('two-persistence-test-player-csrf')}};
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind(session.actor.id,session.actor.email,'synthetic',now-10).run();
 await db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
  .bind('two-persistence-player',session.actor.email,'synthetic',1,now-10,'active',now-10,now-10).run();
 await db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)')
  .bind('two-persistence-player',session.actor.id,now-10).run();
 await db.prepare('INSERT INTO player_sessions(token_digest,account_id,credential_version,csrf_digest,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?)')
  .bind(session.digest,'two-persistence-player',1,session.csrfDigest,now-10,now-5,now+1000).run();
 await db.batch(['admin.access','admin.world.read','admin.world.write'].map(permission=>
  db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES(?,?,?)').bind('two-persistence-player',permission,now-10)));
 world=await readWorld(db);
 world=(await prepareSeason(db,session,meta(),'two-baseline-prepare',await loadApprovedSnapshot(),now)).world;
 world=(await generateSeasonCalendar(db,session,meta(),'two-baseline-calendar',now)).world;
 world=(await executeLifecycle(db,session,'start',meta(),'two-baseline-start',now)).world;
 while(world.day<56)world=(await executeLifecycle(db,session,'advance',meta(),'two-baseline-day-'+(world.day+1),now)).world;
 await enrollTerminalEvents(world.seasonNumber);
 world=(await archiveSeason(db,session,meta(),'two-baseline-close-archive',now)).world;
 world=(await closeSeason(db,session,meta(),'two-baseline-close',now)).world;
 baseline=await captureTestWorld(db);
},120000);
beforeEach(async()=>{await restoreTestWorld(db,baseline);world=await readWorld(db)});
async function approve(){const c=await readSeasonTwoCandidate(db);world=(await approveSeasonTwoSnapshot(db,session,{...meta(),snapshotHash:c.snapshot.snapshotHash},'two-owner-approve',now)).world}
it('requires actual durable membership approval and a closed source season',async()=>{
 const before=world;
 await expect(prepareSeasonTwo(db,session,meta(),'two-without-approval',now)).rejects.toMatchObject({status:422});
 expect(await readWorld(db)).toEqual(before);expect(await count('seasons')).toBe(0);
});
it('persists the full Season1→2 transition, all56 Season2 receipts and a separate archive',async()=>{
 const firstArchive=await db.prepare('SELECT * FROM season_archives WHERE season_number=1').first();
 const firstDays=(await db.prepare('SELECT outcome_hash FROM season_day_outcomes WHERE season_number=1 ORDER BY day').all()).results;
 await approve();const command=meta(),r=await prepareSeasonTwo(db,session,command,'two-prepare-once',now);world=r.world;
 expect(world).toMatchObject({seasonNumber:2,day:0,phase:'preparing',revision:command.expectedRevision+1});
 expect(await prepareSeasonTwo(db,session,command,'two-prepare-once',now)).toEqual(r);
 await expect(prepareSeasonTwo(db,session,command,'two-prepare-competing',now)).rejects.toMatchObject({status:409});
 world=(await generateSeasonCalendar(db,session,meta(),'two-calendar-once',now)).world;
 expect(await count('season_draws')).toBe(2);
 expect(JSON.parse((await db.prepare('SELECT calendar_json FROM season_calendars WHERE season_number=2').first()).calendar_json).fixtures.every((f:any)=>f.id.startsWith('season:2:'))).toBe(true);
 world=(await executeLifecycle(db,session,'start',meta(),'two-start-once-command',now)).world;
 while(world.day<56)world=(await executeLifecycle(db,session,'advance',meta(),'two-day-'+(world.day+1)+'-command',now)).world;
 await enrollTerminalEvents(world.seasonNumber);
 world=(await archiveSeason(db,session,meta(),'two-close-once-command-archive',now)).world;
 world=(await closeSeason(db,session,meta(),'two-close-once-command',now)).world;
 expect(world).toMatchObject({seasonNumber:2,day:56,phase:'closed'});
 expect(await count('season_day_outcomes')).toBe(56);expect(await count('season_knockout_ties')).toBe(54);
 const second=await db.prepare('SELECT * FROM season_archives WHERE season_number=2').first();expect(second.results_count).toBe(4082);expect(second.archive_hash).not.toBe(firstArchive.archive_hash);
 expect(await db.prepare('SELECT * FROM season_archives WHERE season_number=1').first()).toEqual(firstArchive);
 expect((await db.prepare('SELECT outcome_hash FROM season_day_outcomes WHERE season_number=1 ORDER BY day').all()).results).toEqual(firstDays);
 expect((await readSeasonArchives(db)).archives.map(a=>a.seasonNumber)).toEqual([2,1]);
 await expect(prepareSeasonTwo(db,session,meta(),'two-not-season-three',now)).rejects.toMatchObject({status:409});
},180000);
it('rolls back the new snapshot/world/audit after a late prepare audit failure',async()=>{
 await approve();const before=world;
 await db.prepare("CREATE TRIGGER fail_next_prepare BEFORE INSERT ON admin_operations WHEN NEW.command='prepare-season-two-v2' BEGIN SELECT RAISE(ABORT,'late failure'); END").run();
 try{await expect(prepareSeasonTwo(db,session,meta(),'two-failed-prepare',now)).rejects.toMatchObject({status:503})}
 finally{await db.prepare('DROP TRIGGER fail_next_prepare').run()}
 expect(await readWorld(db)).toEqual(before);expect(await count('seasons')).toBe(0);
 expect(await count('season_archives',1)).toBe(1);
 world=(await prepareSeasonTwo(db,session,meta(),'two-retried-prepare',now)).world;expect(world.seasonNumber).toBe(2);
});
it('pins approval at transaction time and rejects source deletion before preparing Season2',async()=>{
 await approve();const before=world;
 const racing={prepare:db.prepare.bind(db),batch:async(statements:any[])=>{if(statements.length>1)await db.prepare('DELETE FROM season_two_approvals').run();return db.batch(statements)}};
 await expect(prepareSeasonTwo(racing,session,meta(),'two-approval-lost',now)).rejects.toMatchObject({status:503});
 expect(await readWorld(db)).toEqual(before);expect(await count('seasons')).toBe(0);
});
it('pins the archived source receipts during a Season2 start transaction',async()=>{
 await approve();world=(await prepareSeasonTwo(db,session,meta(),'two-source-prepare',now)).world;
 world=(await generateSeasonCalendar(db,session,meta(),'two-source-calendar',now)).world;const before=world;
 const racing={prepare:db.prepare.bind(db),batch:async(statements:any[])=>{if(statements.length>1)await db.prepare('DELETE FROM season_day_outcomes WHERE season_number=1 AND day=1').run();return db.batch(statements)}};
 await expect(executeLifecycle(racing,session,'start',meta(),'two-source-start-rejected',now)).rejects.toMatchObject({status:503});
 expect(await readWorld(db)).toEqual(before);expect(await count('season_day_outcomes')).toBe(0);expect(await count('season_calendars')).toBe(1);
});
it('allows exactly one snapshot/revision for competing prepare requests',async()=>{
 await approve();const command=meta(),before=world;
 let arrivals=0,release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve});
 const racing={prepare:db.prepare.bind(db),batch:async(statements:any[])=>{if(statements.length>1){if(++arrivals===2)release();await gate}return db.batch(statements)}};
 const results=await Promise.allSettled(['a','b'].map(k=>prepareSeasonTwo(racing,session,command,'two-race-prepare-'+k,now)));
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 expect(results.find(r=>r.status==='rejected')).toMatchObject({reason:{status:409}});
 expect(await count('seasons')).toBe(1);expect(await readWorld(db)).toMatchObject({seasonNumber:2,revision:before.revision+1});
});
it('rechecks operator authorization at the prepare commit boundary',async()=>{
 await approve();const before=world;
 const racing={prepare:db.prepare.bind(db),batch:async(statements:any[])=>{if(statements.length>1)await db.prepare('UPDATE admin_accounts SET enabled=0 WHERE id=?').bind(session.actor.id).run();return db.batch(statements)}};
 await expect(prepareSeasonTwo(racing,session,meta(),'two-revoked-before-prepare',now)).rejects.toMatchObject({status:401});
 expect(await readWorld(db)).toEqual(before);expect(await count('seasons')).toBe(0);
});

it('refuses a preexisting target snapshot rather than overwriting partial Season2 data',async()=>{
 await approve();const before=world;
 await db.prepare('INSERT INTO seasons VALUES(?,?,?,?,?,?)').bind(2,world.generation,'0'.repeat(64),'0'.repeat(64),'{}',now).run();
 const old=await db.prepare('SELECT * FROM seasons WHERE season_number=2').first();
 await expect(prepareSeasonTwo(db,session,meta(),'two-contaminated-target',now)).rejects.toMatchObject({status:503});
 expect(await db.prepare('SELECT * FROM seasons WHERE season_number=2').first()).toEqual(old);expect(await readWorld(db)).toEqual(before);
});
it('rejects equivalent-content approval bytes replaced after validation',async()=>{
 await approve();const before=world;
 const original=await db.prepare('SELECT snapshot_json FROM season_two_approvals WHERE target_season=2').first();
 const trigger=await db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='season_two_approvals_immutable'").first();
 const racing={prepare:db.prepare.bind(db),batch:async(statements:any[])=>{
  if(statements.length>1){await db.prepare('DROP TRIGGER season_two_approvals_immutable').run();
   try{await db.prepare('UPDATE season_two_approvals SET snapshot_json=? WHERE target_season=2').bind(JSON.stringify(JSON.parse(original.snapshot_json),null,2)).run()}
   finally{await db.prepare(trigger.sql).run()}
  }return db.batch(statements);
 }};
 await expect(prepareSeasonTwo(racing,session,meta(),'two-approval-replaced-bytes',now)).rejects.toMatchObject({status:503});
 expect(await count('seasons')).toBe(0);expect(await readWorld(db)).toEqual(before);
});
