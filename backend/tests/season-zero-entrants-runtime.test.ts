import {beforeAll,beforeEach,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {seedUnifiedOperator} from './fixtures/unified-operator.ts';
import {clearTestWorld} from './fixtures/test-world.ts';
import {confirmSeasonZeroEntrants,readSeasonZeroAuthority} from '../src/season-zero-entrants.ts';
import {readAdministrativeCalendar} from '../src/admin-calendar-read.ts';
import {readPublicSportingSeasonLineupV1,readPublicClubHistoryLineupV1} from '../src/public-sporting-read-lineup-v1.ts';
import {readWorld} from '../src/world-repository.ts';
import {prepareSeason} from '../src/commands.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {initializeAdministrativeEvents} from '../src/admin-calendar-initialize.ts';
import {advanceAdministrativeClockLineupV1} from '../src/admin-calendar-clock-lineup-v1.ts';
import {resetWorld} from '../src/reset-world-command.ts';
import {completeConfirmationEvent} from '../src/admin-calendar-confirm.ts';
import type {AdminSession} from '../src/auth.ts';

const context=env as any,db=context.DB,now=Math.floor(Date.now()/1000);
let world:Awaited<ReturnType<typeof readWorld>>,session:AdminSession,hash:string;
const meta=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});
const body=(scope:'domestic'|'international')=>({...meta(),scope,snapshotHash:hash});
const approve=async (scope:'domestic'|'international',key:string)=>{
 const outcome=await confirmSeasonZeroEntrants(db,session,body(scope),key,now);
 world=outcome.world;return outcome;
};
beforeAll(async()=>applyD1Migrations(db,context.TEST_MIGRATIONS));
beforeEach(async()=>{
 await clearTestWorld(db);
 session=(await seedUnifiedOperator(db,'zero-test-operator','zero-test-operator@example.invalid',now,'a'.repeat(64))).session;
 world=await readWorld(db);
 hash=(await readSeasonZeroAuthority(db,world)).snapshotHash;
});
it('holds both scopes private until independent authenticated receipt and shows no staged sporting information',async()=>{
 expect((await readPublicSportingSeasonLineupV1(db,'IT-1',1)).status).toBe('empty');
 expect((await readPublicSportingSeasonLineupV1(db,'int-1',1)).status).toBe('empty');
 const club=(await loadApprovedSnapshot()).bindings.find(b=>b.competitionId==='IT-1')!.clubIds[0]!;
 expect(((await readPublicClubHistoryLineupV1(db,club)) as any).data.inaugural).toMatchObject({
  status:'empty',reason:'season-not-prepared',data:null
 });
 expect((await readAdministrativeCalendar(db)).mode).toBe('season-zero');
 expect((await readAdministrativeCalendar(db)).events).toHaveLength(2);
 const domestic=await approve('domestic','zero-approve-domestic-0001');
 const fresh=await readWorld(db);
 expect(fresh).toEqual(domestic.world);
 expect(fresh).toMatchObject({seasonNumber:0,day:0,phase:'unstarted',revision:1});
 const national=await readPublicSportingSeasonLineupV1(db,'IT-1',1) as any;
 expect(national).toMatchObject({status:'partial',reason:null,
  provenance:{kind:'authoritative',resultAuthority:'confirmed-entrants-v1'},
  data:{entrantsOnly:true,season:1,seasonState:{phase:'unstarted',day:0}}});
 expect(national.data.participants).toHaveLength(16);
 expect(Object.keys(national.data).sort()).toEqual(['entrantsOnly','participants','rulesVersion','season','seasonState']);
 expect(national.data.fixtures).toBeUndefined();
 const confirmedClub=((await readPublicClubHistoryLineupV1(db,club)) as any).data.inaugural;
 expect(confirmedClub).toMatchObject({status:'partial',data:{entrantsOnly:true,
  memberships:[{competitionId:'IT-1',category:'domestic',position:null,points:0,nextMatch:null}]
 }});
 expect(confirmedClub.data.memberships).toHaveLength(1);
 expect((await readPublicSportingSeasonLineupV1(db,'int-1',1)).status).toBe('empty');
 const midway=await readAdministrativeCalendar(db);
 expect(midway.events.find(e=>e.scope==='domestic')?.status).toBe('completed');
 expect(midway.events.find(e=>e.scope==='international')?.status).toBe('scheduled');
 await approve('international','zero-approve-international-0001');
 const international=await readPublicSportingSeasonLineupV1(db,'int-1',1) as any;
 expect(international.status).toBe('partial');
 expect(international.data.participants).toHaveLength(24);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM seasons').first())?.n).toBe(0);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM season_calendars').first())?.n).toBe(0);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM season_draws').first())?.n).toBe(0);
});
it('enforces CAS, idempotent replay, hash binding, immutable receipts and stale authority',async()=>{
 await expect(confirmSeasonZeroEntrants(db,session,{...body('domestic'),snapshotHash:'c'.repeat(64)},'zero-wrong-hash-0001',now)).rejects.toMatchObject({status:409});
 const input=body('domestic'),key='zero-idempotent-domestic-0001';
 const first=await confirmSeasonZeroEntrants(db,session,input,key,now);
 world=first.world;
 expect(await confirmSeasonZeroEntrants(db,session,input,key,now)).toEqual(first);
 expect((await readWorld(db)).revision).toBe(1);
 await expect(confirmSeasonZeroEntrants(db,session,input,'zero-second-domestic-0001',now)).rejects.toMatchObject({status:409});
 await expect(confirmSeasonZeroEntrants(db,session,{...input,scope:'international'},'zero-stale-international-0001',now)).rejects.toMatchObject({status:409});
 await expect(confirmSeasonZeroEntrants(db,session,{...input,scope:'international'},key,now)).rejects.toMatchObject({status:409});
 await expect(db.prepare("UPDATE season_zero_approvals SET receipt_hash=? WHERE scope='domestic'").bind('f'.repeat(64)).run()).rejects.toThrow();
 await expect(db.prepare("DELETE FROM season_zero_approvals WHERE scope='domestic'").run()).rejects.toThrow();
 const rows=(await db.prepare('SELECT scope,approved_by,approved_revision FROM season_zero_approvals').all()).results;
 expect(rows).toMatchObject([{scope:'domestic',approved_by:session.actor.id,approved_revision:1}]);
});
it('hands off confirmed scopes into Season 1 official receipts without duplicate confirmation',async()=>{
 await approve('domestic','zero-handoff-domestic-0001');
 const prepared=await prepareSeason(db,session,meta(),'zero-handoff-prepare-0001',await loadApprovedSnapshot(),now);
 world=prepared.world;
 expect((await readPublicSportingSeasonLineupV1(db,'IT-1',1)).status).toBe('empty');
 world=(await initializeAdministrativeEvents(db,session,meta(),'zero-handoff-initialize-0001',now)).world;
 const calendar=await readAdministrativeCalendar(db);
 expect(calendar.mode).toBe('administrative');
 expect(calendar.events.find(e=>e.id==='domestic:entrants')?.status).toBe('completed');
 expect(calendar.events.find(e=>e.id==='domestic:entrants')?.hasReceipt).toBe(true);
 expect(calendar.events.find(e=>e.id==='international:entrants')?.status).toBe('scheduled');
 world=(await advanceAdministrativeClockLineupV1(db,session,'start',meta(),'zero-handoff-start-0001',now)).world;
 expect((await readPublicSportingSeasonLineupV1(db,'IT-1',1)).status).toBe('partial');
 const club=(await loadApprovedSnapshot()).bindings.find(b=>b.competitionId==='IT-1')!.clubIds[0]!;
 const handoffClub=((await readPublicClubHistoryLineupV1(db,club)) as any).data.overviews[0];
 expect(handoffClub).toMatchObject({status:'partial',data:{entrantsOnly:true,
  memberships:[{competitionId:'IT-1',category:'domestic',position:null,points:0,nextMatch:null}]
 }});
 expect((await readPublicSportingSeasonLineupV1(db,'int-1',1)).status).toBe('empty');
 await expect(completeConfirmationEvent(db,session,{...meta(),eventId:'domestic:entrants'},'zero-handoff-repeat-0001',now)).rejects.toMatchObject({status:409});
 world=(await completeConfirmationEvent(db,session,{...meta(),eventId:'international:entrants'},'zero-handoff-international-0001',now)).world;
 expect((await readPublicSportingSeasonLineupV1(db,'int-1',1)).status).toBe('partial');
 world=(await advanceAdministrativeClockLineupV1(db,session,'advance',meta(),'zero-handoff-advance-0001',now)).world;
 expect(world.day).toBe(2);
});
it('rejects forged pre-start completed milestones without a corresponding Season 0 approval',async()=>{
 world=(await prepareSeason(db,session,meta(),'zero-no-approval-prepare-0001',await loadApprovedSnapshot(),now)).world;
 world=(await initializeAdministrativeEvents(db,session,meta(),'zero-no-approval-initialize-0001',now)).world;
 await db.prepare("UPDATE season_admin_events SET status='completed',completed_at=?,receipt_hash=? WHERE season_number=1 AND event_id='domestic:entrants'")
  .bind(now,'f'.repeat(64)).run();
 await expect(advanceAdministrativeClockLineupV1(db,session,'start',meta(),
  'zero-forged-prestart-0001',now)).rejects.toMatchObject({status:422});
 expect((await readWorld(db)).phase).toBe('preparing');
});
it('resets approved but unstarted Season 0 and rotates generation, without leaking old receipts',async()=>{
 const prior=world.generation;
 await approve('international','zero-reset-international-0001');
 world=(await resetWorld(db,session,{...meta(),confirmation:'RESET SEASON 0'},'zero-reset-only-0001',now)).world;
 expect(world).toMatchObject({seasonNumber:0,day:0,phase:'unstarted',revision:0});
 expect(world.generation).not.toBe(prior);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM season_zero_approvals').first())?.n).toBe(0);
 expect((await readPublicSportingSeasonLineupV1(db,'int-1',1)).status).toBe('empty');
 await expect(confirmSeasonZeroEntrants(db,session,{expectedGeneration:prior,expectedRevision:1,scope:'international',snapshotHash:hash},'zero-old-generation-0001',now)).rejects.toMatchObject({status:409});
 await approve('domestic','zero-new-generation-0001');
 expect((await readPublicSportingSeasonLineupV1(db,'IT-1',1)).status).toBe('partial');
});
