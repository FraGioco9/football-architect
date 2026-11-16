import {beforeAll,beforeEach,describe,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {seedUnifiedOperator} from './fixtures/unified-operator.ts';
import {clearTestWorld} from './fixtures/test-world.ts';
import {prepareSeason} from '../src/commands.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {readWorld} from '../src/world-repository.ts';
import {initializeAdministrativeEvents} from '../src/admin-calendar-initialize.ts';
import {advanceAdministrativeClockLineupV1} from '../src/admin-calendar-clock-lineup-v1.ts';
import {completeConfirmationEvent} from '../src/admin-calendar-confirm.ts';
import {stageDomesticCalendar} from '../src/admin-domestic-stage.ts';
import {executeInternationalDraw} from '../src/admin-international-draw.ts';
import {publishInternationalCalendarLineupV1} from '../src/admin-calendar-publish-lineup-v1.ts';
import {executeLineupLifecycleV1} from '../src/lineup-lifecycle-command.ts';
import {
 readPublicSportingSeasonLineupV1,readPublicCalendarDayLineupV1,
 readPublicClubOverviewLineupV1,readPublicClubFixturesLineupV1,
 readPublicClubHistoryLineupV1,lineupTeamStatisticsV1
} from '../src/public-sporting-read-lineup-v1.ts';
import type {AdminSession} from '../src/auth.ts';

const bindings=env as any,db=bindings.DB,now=Math.floor(Date.now()/1000);
let world:Awaited<ReturnType<typeof readWorld>>,session:AdminSession;
const cmd=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});
beforeAll(async()=>applyD1Migrations(db,bindings.TEST_MIGRATIONS));
beforeEach(async()=>{
 await clearTestWorld(db);
 session=(await seedUnifiedOperator(db,'lineup-public-sport',
  'lineup-public-sport@example.invalid',now,'6'.repeat(64))).session;
 world=await readWorld(db);
});
async function prepareAndPublish(){
 world=(await prepareSeason(db,session,cmd(),'lp-prepare-00001',await loadApprovedSnapshot(),now)).world;
 world=(await initializeAdministrativeEvents(db,session,cmd(),'lp-init-00001',now)).world;
 world=(await advanceAdministrativeClockLineupV1(db,session,'start',cmd(),'lp-start-00001',now)).world;
 for(const eventId of ['domestic:entrants','international:entrants'])
  world=(await completeConfirmationEvent(db,session,{...cmd(),eventId},
   'lp-confirm-'+eventId,now)).world;
 world=(await advanceAdministrativeClockLineupV1(db,session,'advance',cmd(),'lp-day2-00001',now)).world;
 world=(await stageDomesticCalendar(db,session,cmd(),'lp-domestic-00001',now)).world;
 world=(await advanceAdministrativeClockLineupV1(db,session,'advance',cmd(),'lp-day3-00001',now)).world;
 world=(await executeInternationalDraw(db,session,cmd(),'lp-draw-00001',now)).world;
 world=(await publishInternationalCalendarLineupV1(db,session,cmd(),'lp-publish-00001',now)).world;
}
describe('#613 new V2 public competition, club, calendar projections (unrouted)',()=>{
 it('reads published V2-only days and next day without scoring future fixtures',async()=>{
  await prepareAndPublish();
  expect(world.day).toBe(3);
  const old=(await db.prepare('SELECT COUNT(*) AS n FROM season_day_outcomes').first()) as {n:number};
  expect(old.n).toBe(0);
  const before=await readPublicSportingSeasonLineupV1(db,'IT-1',1) as any;
  expect(before).toMatchObject({status:'partial',selectedSeason:1,
   provenance:{kind:'authoritative',resultAuthority:'temporary-lineup-v1'},
   data:{season:1,standings:{complete:false},statistics:{matchesPlayed:0,playerStatus:'available',players:[]}}});
  expect(before.data?.fixtures).toHaveLength(240);
  expect(before.data?.fixtures.every((f:any)=>f.result===null)).toBe(true);
  world=(await executeLineupLifecycleV1(db,session,'advance',cmd(),'lp-day4-00001',now)).world;
  expect(world.day).toBe(4);
  const season=await readPublicSportingSeasonLineupV1(db,'IT-1',1) as any;
  expect(season.data?.standings.rows).toHaveLength(16);
  expect(season.data?.statistics.players).toEqual([]);
  expect(season.data?.fixtures).toHaveLength(240);
  expect(season.data?.fixtures.every((f:any)=>f.result===null)).toBe(true);
  const day=await readPublicCalendarDayLineupV1(db,1,4) as any;
  expect(day).toMatchObject({status:'partial',day:4,
   provenance:{resultAuthority:'temporary-lineup-v1'},
   data:{day:4,seasonState:{day:4}}});
  expect(day.data?.fixtures).toEqual([]);
  const overview=await readPublicClubOverviewLineupV1(db,'IT-1',1) as any;
  expect(overview.data?.memberships).toHaveLength(2);
  expect(overview.data?.memberships.every((m:any)=>m.stats.played===0)).toBe(true);
  const clubFixtures=await readPublicClubFixturesLineupV1(db,'IT-1',1) as any;
  expect(clubFixtures.data?.fixtures).toHaveLength(36);
  expect(clubFixtures.data?.fixtures.every((f:any)=>f.result===null)).toBe(true);
  const history=await readPublicClubHistoryLineupV1(db,'IT-1') as any;
  expect(history.data?.overviews).toHaveLength(1);
  expect(history.provenance.resultAuthority).toBe('temporary-lineup-v1');
  const after=await readWorld(db);
  expect(after).toEqual(world); // public GET projections must be read-only
  expect((await db.prepare('SELECT COUNT(*) AS n FROM match_lineup_result_receipts')
   .first())!.n).toBe(0);
 },120000);
 it('refuses unsupported public seasons before preparing the world',async()=>{
  const empty=await readPublicSportingSeasonLineupV1(db,'IT-1',1);
  expect(empty).toMatchObject({status:'empty',reason:'season-not-prepared',data:null});
  await expect(readPublicSportingSeasonLineupV1(db,'ZZ-1',1))
   .rejects.toMatchObject({status:404});
  await expect(readPublicClubHistoryLineupV1(db,'IT-41'))
   .rejects.toMatchObject({status:404});
 },15000);
 it('derives real player stats only from verified frozen match appearances, never a player directory',()=>{
  const home='IT-1',away='IT-2',id='season:1:IT-1:N01:IT-1:IT-2';
  const f={id,homeClubId:home,awayClubId:away} as any;
  const result={homeGoals:2,awayGoals:1} as any;
  const frozen={fixtureId:id,matchId:99,receipt:{result:{
   home:{kind:'real_xi',appearances:[{playerId:7,started:true,minutes:90,goals:2}]},
   away:{kind:'team_fallback',appearances:[]}
  }}} as any;
  const out=lineupTeamStatisticsV1([home,away],[f],
   new Map([[id,result]]),new Map([[id,frozen]]));
  expect(out.matchesPlayed).toBe(1);
  expect(out.totalGoals).toBe(3);
  expect(out.players).toEqual([{playerId:7,clubId:home,appearances:1,starts:1,minutes:90,goals:2}]);
  expect(out.teams.find(t=>t.clubId===home)).toMatchObject({won:1,goalsFor:2,goalsAgainst:1});
  expect(out.teams.find(t=>t.clubId===away)).toMatchObject({lost:1});
  expect(()=>lineupTeamStatisticsV1([home,away],[f],new Map([[id,result]]),new Map()))
   .toThrow();
 },15000);
});