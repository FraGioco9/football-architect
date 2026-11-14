// ME-PB-54 / A1.3b.1: only D1-backed current approved schedule
// can attest a due-day fixture. Affiliation storage exists, but the
// temporary physical fixture does not bind actual player-club contracts.
import {it,expect,beforeAll,beforeEach} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {clearTestWorld} from './fixtures/test-world.ts';
import {prepareSeason} from '../src/commands.ts';
import {generateSeasonCalendar} from '../src/calendar-command.ts';
import {executeLifecycle} from '../src/lifecycle-command.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {loadSeasonSportingEvidence} from '../src/season-sporting-evidence.ts';
import {readWorld} from '../src/world-repository.ts';
import {digestOpaqueToken} from '../src/session-tokens.ts';
import type {AdminSession} from '../src/auth.ts';
import type {Database} from '../src/database.ts';
import {readDuePhysicalFixture,runDuePhysicalFixtureWindow,
 PHYSICAL_FIXTURE_CALENDAR_BRIDGE_VERSION}
 from '../src/physical-fixture-calendar-bridge.ts';

const bindings=env as any,db:Database=bindings.DB;
const now=1731000000,token='c'.repeat(64);
let world:Awaited<ReturnType<typeof readWorld>>;
let session:AdminSession;
const expected=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});

beforeAll(async()=>{await applyD1Migrations(bindings.DB,bindings.TEST_MIGRATIONS)});
beforeEach(async()=>{
 await clearTestWorld(db);
 session={
  actor:{id:'fixture-calendar-operator',email:'fixture-calendar@example.invalid'},
  digest:await digestOpaqueToken(token),
  credentialVersion:1,
  csrfDigest:await digestOpaqueToken('e'.repeat(64)),
  unified:{
   playerId:'fixture-calendar-player',sessionDigest:await digestOpaqueToken(token),
   csrfDigest:await digestOpaqueToken('e'.repeat(64))
  }
 };
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)')
  .bind(session.actor.id,session.actor.email,'fixture-only',now-100).run();
 await db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
  .bind('fixture-calendar-player',session.actor.email,'fixture-only',1,now-100,'active',now-100,now-100).run();
 await db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)')
  .bind('fixture-calendar-player',session.actor.id,now-100).run();
 await db.prepare('INSERT INTO player_sessions(token_digest,account_id,credential_version,csrf_digest,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?)')
  .bind(session.digest,'fixture-calendar-player',1,session.csrfDigest,now-100,now-10,now+1000).run();
 await db.batch(['admin.access','admin.world.read','admin.world.write'].map(permission=>
  db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES(?,?,?)')
   .bind('fixture-calendar-player',permission,now-100)));
 world=await readWorld(db);
 world=(await prepareSeason(db,session,expected(),'physical-fixture-prep-0001',
  await loadApprovedSnapshot(),now)).world;
 world=(await generateSeasonCalendar(db,session,expected(),
  'physical-fixture-cal-0001',now)).world;
});

it('A1.3b.1 fail-closed current-world D1 due fixture attest, never invents roster or game score',async()=>{
 const before=await loadSeasonSportingEvidence(db,world);
 const day13=before.schedule.fixtures.find(f=>f.day===13)!;
 const day14=before.schedule.fixtures.find(f=>f.day===14)!;
 expect(day13).toBeTruthy();expect(day14).toBeTruthy();
 await expect(readDuePhysicalFixture(db,day13.id,world.revision))
  .rejects.toMatchObject({code:'physical_fixture_unavailable'});
 world=(await executeLifecycle(db,session,'start',expected(),
  'physical-fixture-start-0001',now)).world;
 expect(world.phase).toBe('active');
 await expect(readDuePhysicalFixture(db,day13.id,world.revision))
  .rejects.toMatchObject({code:'physical_fixture_unavailable'});
 while(world.day<12){
  world=(await executeLifecycle(db,session,'advance',expected(),
   'physical-fixture-advance-'+(world.day+1),now)).world;
 }
 expect(world.day).toBe(12);
 const receipt=await readDuePhysicalFixture(db,day13.id,world.revision);
 const again=await readDuePhysicalFixture(db,day13.id,world.revision);
 expect(receipt).toEqual(again);
 expect(Object.isFrozen(receipt)).toBe(true);
 expect(Object.isFrozen(receipt.fixture)).toBe(true);
 expect(Object.isFrozen(receipt.evidence)).toBe(true);
 expect(receipt).toMatchObject({
  version:PHYSICAL_FIXTURE_CALENDAR_BRIDGE_VERSION,
  source:'server-reconstructed-owner-approved-persisted-season-calendar',
  fixture:day13,worldGeneration:world.generation,worldRevision:world.revision,
  currentDay:12,dueDay:13,seasonNumber:1,
  fixtureCalendarVerifiedAtRevision:true,
  rosterBound:false,rosterSource:'homogeneous-temporary-actors',
  provisionalSquadOnly:true,provisionalAttributeValue:50,
  generatedPlayersUsed:false,
  matchResultsAuthorized:false,officialMatchResult:null,
  scoreAuthority:'external-temporary-score-v1',remotePersistence:false
 });
 expect(receipt.evidence.calendarHash).toMatch(/^[a-f0-9]{64}$/);
 for(const bad of [
  day14.id,
  day13.id.replace(':N01:',':N02:'),
  'season:2:ENG-1:N01:ENG-1:ENG-2',
  'season:1:ENG-1:N01:ENG-1:ENG-999',
  '',undefined
 ]){
  await expect(readDuePhysicalFixture(db,bad as string,world.revision))
   .rejects.toMatchObject({code:'physical_fixture_unavailable'});
 }
 await expect(readDuePhysicalFixture(db,day13.id,world.revision-1))
  .rejects.toMatchObject({code:'stale_world'});
 for(const ticks of [0,601,-1,1.5]){
  await expect(runDuePhysicalFixtureWindow(
   db,{},day13.id,world.revision,{preset:'roll'},ticks
  )).rejects.toMatchObject({code:'physical_fixture_unavailable'});
 }
 await expect(runDuePhysicalFixtureWindow(db,{},day13.id,world.revision,
  {preset:'roll'},2,{globalResponse:1,score:{home:3}} as any
 )).rejects.toMatchObject({code:'physical_fixture_unavailable'});
 // Correct D1 proof was obtained first; invalid Rapier dependency cannot
 // fabricate a physical result or affect persisted temporary-score receipts.
 await expect(runDuePhysicalFixtureWindow(
  db,{},day13.id,world.revision,{preset:'roll'},2
 )).rejects.toThrow();
 expect(await readWorld(db)).toEqual(world);
 const receiptCount=await db.prepare('SELECT count(*) AS n FROM season_day_outcomes').first<{n:number}>();
 expect(receiptCount?.n).toBe(12);
 // Migration #509 now supplies this table. The real fixture
 // calendar bridge still must not invent player contracts or rosters.
 const affiliationExists=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='player_club_affiliations'")
  .first<{name:string}>();
 expect(affiliationExists?.name).toBe('player_club_affiliations');
 const assignments=await db.prepare('SELECT count(*) AS n FROM player_club_affiliations')
  .first<{n:number}>();
 expect(assignments?.n).toBe(0);
},60000);
