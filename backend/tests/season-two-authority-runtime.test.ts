import {beforeAll,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {prepareSeason} from '../src/commands.ts';
import {generateSeasonCalendar} from '../src/calendar-command.ts';
import {executeLifecycle} from '../src/lifecycle-command.ts';
import {closeSeason} from '../src/season-close-command.ts';
import {archiveSeason} from '../src/season-archive-command.ts';
import {readSeasonTwoCandidate} from '../src/season-two-candidate-read.ts';
import {approveSeasonTwoSnapshot} from '../src/season-two-approval-command.ts';
import {loadApprovedSeasonTwoAuthority,buildApprovedSeasonTwoInitialSchedule} from '../src/season-two-initial-schedule.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {readWorld} from '../src/world-repository.ts';
import {hashText,type AdminSession} from '../src/auth.ts';
import {createProgression,processSportingDay} from '../src/knockout-progression.ts';
const bindings=env as any,db=bindings.DB;
beforeAll(async()=>{await applyD1Migrations(db,bindings.TEST_MIGRATIONS)});
it('loads only durable approved Season2 authority and leaves the actual world closed in Season1',async()=>{
 const now=Math.floor(Date.now()/1000),session:AdminSession={actor:{id:'next-engine-operator',email:'next-engine@example.invalid'},digest:await hashText('next-engine-session'),credentialVersion:1,csrfDigest:await hashText('next-engine-csrf')};
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind(session.actor.id,session.actor.email,'synthetic',now-10).run();
 await db.prepare('INSERT INTO admin_sessions VALUES(?,?,?,?,?,?,?)').bind(session.digest,session.actor.id,1,session.csrfDigest,now-10,now-5,now+1000).run();
 let world=await readWorld(db);const meta=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});
 world=(await prepareSeason(db,session,meta(),'next-engine-prepare-0001',await loadApprovedSnapshot(),now)).world;
 world=(await generateSeasonCalendar(db,session,meta(),'next-engine-calendar-0001',now)).world;
 world=(await executeLifecycle(db,session,'start',meta(),'next-engine-start-0001',now)).world;
 while(world.day<56)world=(await executeLifecycle(db,session,'advance',meta(),'next-engine-day-'+(world.day+1),now)).world;
 world=(await archiveSeason(db,session,meta(),'next-engine-archive-0001',now)).world;
 world=(await closeSeason(db,session,meta(),'next-engine-close-0001',now)).world;
 await expect(loadApprovedSeasonTwoAuthority(db)).rejects.toMatchObject({status:422});
 const review=await readSeasonTwoCandidate(db);
 world=(await approveSeasonTwoSnapshot(db,session,{...meta(),snapshotHash:review.snapshot.snapshotHash},'next-engine-approve-0001',now)).world;
 const approvedWorld=world,authority=await loadApprovedSeasonTwoAuthority(db);
 expect(authority.snapshotHash).toBe(review.snapshot.snapshotHash);
 expect(authority.sourceArchiveHash).toBe(review.sourceArchiveHash);
 const schedule=await buildApprovedSeasonTwoInitialSchedule(db,'next-engine-approved-seed-0001');
 const state=createProgression(authority.snapshot,schedule);
 for(let day=1;day<=38;day++)await processSportingDay(state,day);
 expect(state.ties.size).toBe(8);expect([...state.results.keys()].every(id=>id.startsWith('season:2:'))).toBe(true);
 expect(await readWorld(db)).toEqual(approvedWorld);
 expect((await db.prepare('SELECT count(*) n FROM seasons WHERE season_number=2').first()).n).toBe(0);
 expect((await db.prepare('SELECT count(*) n FROM season_day_outcomes WHERE season_number=2').first()).n).toBe(0);
 // Detect concurrent world change after the source review and approval read.
 let reads=0;
 const changing={prepare(sql:string){const statement=db.prepare(sql);if(sql.includes('FROM world_state WHERE id = 1'))return {first:async()=>{const row=await statement.first();return ++reads===2?{...row,revision:row.revision+1}:row}};return statement},batch:db.batch.bind(db)};
 await expect(loadApprovedSeasonTwoAuthority(changing)).rejects.toMatchObject({status:409,code:'stale_world'});
 // Simulate out-of-band corruption, while restoring the production immutability trigger.
 const trigger=await db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='season_two_approvals_immutable'").first();
 const row=await db.prepare('SELECT snapshot_json FROM season_two_approvals WHERE target_season=2').first();
 const corrupted=JSON.parse(row.snapshot_json);corrupted.bindings[0].clubIds.reverse();
 await db.prepare('DROP TRIGGER season_two_approvals_immutable').run();
 try{await db.prepare('UPDATE season_two_approvals SET snapshot_json=? WHERE target_season=2').bind(JSON.stringify(corrupted)).run()}
 finally{await db.prepare(trigger.sql).run()}
 await expect(loadApprovedSeasonTwoAuthority(db)).rejects.toMatchObject({status:422});
 expect(await readWorld(db)).toEqual(approvedWorld);
},120000);
