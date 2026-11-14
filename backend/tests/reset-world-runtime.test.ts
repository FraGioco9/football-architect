import {seedUnifiedOperator} from './fixtures/unified-operator.ts';
import {clearTestWorld} from './fixtures/test-world.ts';
import {beforeAll,beforeEach,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {initializeAdministrativeEvents} from '../src/admin-calendar-initialize.ts';
import {resetWorld} from '../src/reset-world-command.ts';
import {previewPlayerGeneration,commitPlayerGeneration,listGeneratedPlayers} from '../src/players-generation-command.ts';
import {readPublicPlayers} from '../src/public-players-read.ts';
import {generateSeasonCalendar} from '../src/calendar-command.ts';
import {prepareSeason} from '../src/commands.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {readWorld} from '../src/world-repository.ts';
import {type AdminSession} from '../src/auth.ts';

const bindings=env as any,db=bindings.DB,now=Math.floor(Date.now()/1000),token='e'.repeat(64);
let session:AdminSession,world:Awaited<ReturnType<typeof readWorld>>;
beforeAll(async()=>{await applyD1Migrations(db,bindings.TEST_MIGRATIONS)});
beforeEach(async()=>{
 await clearTestWorld(db);
 session=(await seedUnifiedOperator(db,'initialize-operator','initialize@example.invalid',now,token)).session;
 world=await readWorld(db);
 world=(await prepareSeason(db,session,{expectedGeneration:world.generation,expectedRevision:world.revision},'initialize-prepare-synthetic-0001',await loadApprovedSnapshot(),now)).world;
});
const cmd=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});

it('purges all season state and retains admin access plus historical operation log in a single batch',async()=>{
 const before=cmd();
 world=(await initializeAdministrativeEvents(db,session,before,'reset-event-init-00001',now)).world;
 const previousGeneration=world.generation;
 const originalAudit=(await db.prepare('SELECT count(*) n FROM admin_operations').first()).n;
 const resetRequest={...cmd(),confirmation:'RESET SEASON 0'};
 const outcome=await resetWorld(db,session,resetRequest,'reset-full-command-00001',now);
 expect(outcome.world).toMatchObject({phase:'unstarted',seasonNumber:0,day:0,revision:0});
 expect(outcome.world.generation).not.toEqual(previousGeneration);
 expect(await readWorld(db)).toEqual(outcome.world);
 await expect(resetWorld(db,session,resetRequest,'reset-full-command-00001',now)).rejects.toMatchObject({status:409});
 await expect(resetWorld(db,session,resetRequest,'reset-other-command-00001',now)).rejects.toMatchObject({status:409});
 const audit=await db.prepare("SELECT generation,expected_revision,resulting_revision FROM admin_operations WHERE command='reset-world-v1'").first();
 expect(audit).toMatchObject({generation:previousGeneration,expected_revision:resetRequest.expectedRevision,resulting_revision:resetRequest.expectedRevision+1});
 for(const table of ['seasons','season_admin_events','season_domestic_stages','season_calendars','season_draws','season_match_slots','season_day_outcomes','season_knockout_ties','season_archives'])
  expect((await db.prepare('SELECT count(*) n FROM '+table).first()).n).toBe(0);
 expect((await db.prepare('SELECT count(*) n FROM admin_accounts').first()).n).toBe(1);
 expect((await db.prepare('SELECT count(*) n FROM player_sessions').first()).n).toBe(1);
 expect((await db.prepare('SELECT count(*) n FROM admin_operations').first()).n).toBe(originalAudit+1);
 await expect(initializeAdministrativeEvents(db,session,{expectedGeneration:previousGeneration,expectedRevision:world.revision},'stale-event-command-00001',now)).rejects.toMatchObject({status:409});
 const prepared=await prepareSeason(db,session,{expectedGeneration:outcome.world.generation,expectedRevision:0},'new-generation-prepare-00001',await loadApprovedSnapshot(),now);
 expect(prepared.world).toMatchObject({seasonNumber:1,phase:'preparing',revision:1});
});

it('preserves committed generated players and their FK draft parents across Season 0 reset',async()=>{
 const options={count:2,seed:'preserve-players-reset',primaryNationality:'ITA',primaryPosition:'ST'};
 const batch=await previewPlayerGeneration(db,session,{options},now);
 await commitPlayerGeneration(db,session,{draftId:batch.draftId,confirmation:'GENERATE PLAYERS'},now);
 const abandoned=await previewPlayerGeneration(db,session,{options:{...options,count:1,seed:'stale-preview-before-reset'}},now);
 const saved=(await db.prepare('SELECT id,batch_id,world_generation,entry_season,payload_json,created_at FROM generated_players ORDER BY id').all()).results;
 // Two affiliation rows reference preserved footballers; uncommitted drafts never do.
 await db.prepare('INSERT INTO player_club_affiliations(player_id,club_key) VALUES(?,?)').bind(saved[0].id,'IT-1').run();
 await db.prepare('INSERT INTO player_club_affiliations(player_id,club_key) VALUES(?,?)').bind(saved[1].id,'BR-40').run();
 const savedAffiliations=(await db.prepare('SELECT player_id,club_key FROM player_club_affiliations ORDER BY player_id').all()).results;
 const committedDraft=await db.prepare('SELECT * FROM player_generation_drafts WHERE id=?').bind(batch.draftId).first();
 expect(saved).toHaveLength(2);
 expect(committedDraft).toMatchObject({id:batch.draftId,status:'committed'});
 const beforePublic=await readPublicPlayers(db,1);
 const beforeAdmin=await listGeneratedPlayers(db);
 expect(beforePublic.count).toBe(2);
 expect(beforeAdmin.count).toBe(2);

 const previousGeneration=world.generation;
 const result=await resetWorld(db,session,{...cmd(),confirmation:'RESET SEASON 0'},'reset-preserve-generated-00001',now);
 expect(result.world.generation).not.toBe(previousGeneration);
 expect((await db.prepare('SELECT id,batch_id,world_generation,entry_season,payload_json,created_at FROM generated_players ORDER BY id').all()).results).toEqual(saved);
 expect(await db.prepare('SELECT * FROM player_generation_drafts WHERE id=?').bind(batch.draftId).first()).toEqual(committedDraft);
 expect((await db.prepare('SELECT player_id,club_key FROM player_club_affiliations ORDER BY player_id').all()).results).toEqual(savedAffiliations);
 expect(await db.prepare('SELECT id FROM player_generation_drafts WHERE id=?').bind(abandoned.draftId).first()).toBeNull();
 expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
 await expect(commitPlayerGeneration(db,session,{draftId:abandoned.draftId,confirmation:'GENERATE PLAYERS'},now)).rejects.toMatchObject({status:404});

 const afterPublic=await readPublicPlayers(db,1);
 const afterAdmin=await listGeneratedPlayers(db);
 expect(afterPublic).toEqual(beforePublic);
 expect(afterAdmin.players).toEqual(beforeAdmin.players);
 expect(afterAdmin.count).toBe(2);
 expect(afterAdmin.worldGeneration).toBe(result.world.generation);

 const next=await previewPlayerGeneration(db,session,{options:{...options,count:1,seed:'players-after-world-reset'}},now);
 await commitPlayerGeneration(db,session,{draftId:next.draftId,confirmation:'GENERATE PLAYERS'},now);
 const all=(await db.prepare('SELECT id,world_generation FROM generated_players ORDER BY id').all()).results as {id:number;world_generation:string}[];
 expect(all).toHaveLength(3);
 expect(all.slice(0,2).map(row=>row.id)).toEqual(saved.map((row:any)=>row.id));
 expect(all.slice(0,2).every(row=>row.world_generation===previousGeneration)).toBe(true);
 expect(all[2].id).toBeGreaterThan(all[1].id);
 expect(all[2].world_generation).toBe(result.world.generation);
 expect((await db.prepare('SELECT player_id,club_key FROM player_club_affiliations ORDER BY player_id').all()).results).toEqual(savedAffiliations);
 expect((await readPublicPlayers(db,1)).count).toBe(3);
 expect((await listGeneratedPlayers(db)).count).toBe(3);
});

it('refuses missing confirmation and atomically rolls back failed reset audit',async()=>{
 await expect(resetWorld(db,session,{...cmd(),confirmation:'RESET'},'invalid-reset-00001',now)).rejects.toMatchObject({status:422});
 world=(await initializeAdministrativeEvents(db,session,cmd(),'reset-fail-events-00001',now)).world;
 await db.prepare("CREATE TRIGGER prevent_reset_audit BEFORE INSERT ON admin_operations WHEN NEW.command='reset-world-v1' BEGIN SELECT RAISE(ABORT,'audit failure'); END").run();
 try{await expect(resetWorld(db,session,{...cmd(),confirmation:'RESET SEASON 0'},'reset-rollback-00001',now)).rejects.toMatchObject({status:503})}
 finally{await db.prepare('DROP TRIGGER prevent_reset_audit').run()}
 expect(await readWorld(db)).toEqual(world);
 expect((await db.prepare('SELECT count(*) n FROM seasons').first()).n).toBe(1);
 expect((await db.prepare('SELECT count(*) n FROM season_admin_events').first()).n).toBe(8);
});

it('invalidates old-generation commands and operation replays after successful reset',async()=>{
 const generation=world.generation,revision=world.revision;
 const first=await resetWorld(db,session,{...cmd(),confirmation:'RESET SEASON 0'},'reset-invalidation-00001',now);
 const newWorld=await readWorld(db);
 expect(newWorld.generation).not.toBe(generation);
 expect(newWorld.revision).toBe(0);
 await expect(prepareSeason(db,session,{expectedGeneration:generation,expectedRevision:revision},'old-generation-prepare-00001',await loadApprovedSnapshot(),now)).rejects.toMatchObject({status:409});
 await expect(resetWorld(db,session,{expectedGeneration:generation,expectedRevision:revision,confirmation:'RESET SEASON 0'},'reset-invalidation-00001',now)).rejects.toMatchObject({status:409});
 const saved=await db.prepare("SELECT generation,request_hash,account_id,outcome_json FROM admin_operations WHERE command='reset-world-v1'").first();
 expect(saved.generation).toBe(generation);
 expect(saved.account_id).toBe(session.actor.id);
 expect(JSON.parse(saved.outcome_json).world).toEqual(first.world);
 expect(saved.outcome_json).not.toContain('fixtures');
 expect(saved.outcome_json).not.toContain('results');
 const second=await prepareSeason(db,session,{expectedGeneration:newWorld.generation,expectedRevision:0},'post-reset-prepare-00001',await loadApprovedSnapshot(),now);
 expect(second.world.generation).toBe(newWorld.generation);
 await expect(prepareSeason(db,session,{expectedGeneration:generation,expectedRevision:revision},'old-generation-prepare-00002',await loadApprovedSnapshot(),now)).rejects.toMatchObject({status:409});
});

it.each([
 {phase:'active' as const,day:12},
 {phase:'closed' as const,day:56},
])('reset safely erases an $phase world and permits fresh preparation',async({phase,day})=>{
 // A local D1 state fixture isolates the destructive reset contract from the
 // separate full sporting-season acceptance suite.
 await db.prepare("UPDATE world_state SET phase=?,day=?,revision=revision+1 WHERE id=1").bind(phase,day).run();
 world=await readWorld(db);
 if(phase==='closed'){
  await db.prepare("INSERT INTO season_archives(season_number,generation,calendar_hash,results_hash,knockout_hash,archive_hash,results_count,days_count,ties_count,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
   .bind(1,world.generation,'a'.repeat(64),'b'.repeat(64),'c'.repeat(64),'d'.repeat(64),4082,56,54,now).run();
 }
 const command={...cmd(),confirmation:'RESET SEASON 0'};
 const outcome=await resetWorld(db,session,command,'reset-from-'+phase+'-00001',now);
 expect(outcome.world).toMatchObject({phase:'unstarted',seasonNumber:0,day:0,revision:0});
 expect(outcome.world.generation).not.toBe(world.generation);
 expect((await db.prepare('SELECT count(*) n FROM seasons').first()).n).toBe(0);
 expect((await db.prepare('SELECT count(*) n FROM season_archives').first()).n).toBe(0);
 expect((await db.prepare('SELECT count(*) n FROM admin_accounts').first()).n).toBe(1);
 await expect(resetWorld(db,session,command,'reset-repeated-'+phase+'-00001',now)).rejects.toMatchObject({status:409});
 const prepared=await prepareSeason(db,session,{expectedGeneration:outcome.world.generation,expectedRevision:0},'reset-reprepare-'+phase+'-00001',await loadApprovedSnapshot(),now);
 expect(prepared.world).toMatchObject({phase:'preparing',seasonNumber:1,day:0,revision:1});
});
it('rejects reset of an already empty Season 0, even with a fresh idempotency key',async()=>{
 const first=await resetWorld(db,session,{...cmd(),confirmation:'RESET SEASON 0'},'reset-once-00001',now);
 await expect(resetWorld(db,session,{expectedGeneration:first.world.generation,expectedRevision:0,confirmation:'RESET SEASON 0'},'reset-empty-00001',now)).rejects.toMatchObject({status:409});
 expect(await readWorld(db)).toEqual(first.world);
});
