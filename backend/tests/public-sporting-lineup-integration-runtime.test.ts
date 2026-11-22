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
 readPublicClubOverviewLineupV1,readPublicClubFixturesLineupV1,readPublicRosterStats,
 readPublicClubHistoryLineupV1,lineupTeamStatisticsV1
} from '../src/public-sporting-read-lineup-v1.ts';
import {readPublicMatchLineupV1,
 readPublishedCompetitionMatchesLineupV1} from '../src/public-match-read-lineup-v1.ts';
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
 world=(await prepareSeason(db,session,cmd(),'lp-prepare-00001-v2',await loadApprovedSnapshot(),now)).world;
 world=(await initializeAdministrativeEvents(db,session,cmd(),'lp-init-00001-v2',now)).world;
 world=(await advanceAdministrativeClockLineupV1(db,session,'start',cmd(),'lp-start-00001-v2',now)).world;
 for(const eventId of ['domestic:entrants','international:entrants'])
  world=(await completeConfirmationEvent(db,session,{...cmd(),eventId},
   'lp-confirm-v2-'+eventId,now)).world;
 world=(await advanceAdministrativeClockLineupV1(db,session,'advance',cmd(),'lp-day2-00001-v2',now)).world;
 world=(await stageDomesticCalendar(db,session,cmd(),'lp-domestic-00001-v2',now)).world;
 world=(await advanceAdministrativeClockLineupV1(db,session,'advance',cmd(),'lp-day3-00001-v2',now)).world;
 world=(await executeInternationalDraw(db,session,cmd(),'lp-draw-00001-v2',now)).world;
 world=(await publishInternationalCalendarLineupV1(db,session,cmd(),'lp-publish-00001-v2',now)).world;
}
describe('#613 new V2 public competition, club, calendar projections (unrouted)',()=>{
 it('shows confirmed entrants before calendar, independently for domestic and international tables',async()=>{
  world=(await prepareSeason(db,session,cmd(),'lp-entrants-prepare-0001',await loadApprovedSnapshot(),now)).world;
  const preparing=await readPublicSportingSeasonLineupV1(db,'IT-1',1);
  expect(preparing).toMatchObject({status:'empty',reason:'calendar-unpublished',data:null});
  world=(await initializeAdministrativeEvents(db,session,cmd(),'lp-entrants-init-0001',now)).world;
  world=(await advanceAdministrativeClockLineupV1(db,session,'start',cmd(),'lp-entrants-start-0001',now)).world;
  expect((await readPublicSportingSeasonLineupV1(db,'int-1',1)).status).toBe('empty');
  world=(await completeConfirmationEvent(db,session,{...cmd(),eventId:'domestic:entrants'},
   'lp-entrants-confirm-domestic-0001',now)).world;
  const domestic=await readPublicSportingSeasonLineupV1(db,'IT-1',1) as any;
  expect(domestic).toMatchObject({status:'partial',reason:null,
   provenance:{kind:'authoritative',resultAuthority:'confirmed-entrants-v1'},
   data:{season:1,entrantsOnly:true,seasonState:{day:1,phase:'active'}}});
  expect(domestic.data.participants).toHaveLength(16);
  expect(Object.keys(domestic.data).sort()).toEqual(['entrantsOnly','participants','rulesVersion','season','seasonState']);
  expect((await readPublicSportingSeasonLineupV1(db,'int-1',1)).status).toBe('empty');
  world=(await completeConfirmationEvent(db,session,{...cmd(),eventId:'international:entrants'},
   'lp-entrants-confirm-international-0001',now)).world;
  const international=await readPublicSportingSeasonLineupV1(db,'int-1',1) as any;
  expect(international).toMatchObject({status:'partial',data:{entrantsOnly:true},
   provenance:{resultAuthority:'confirmed-entrants-v1'}});
  expect(international.data.participants).toHaveLength(24);
  expect(international.data.participants.every((id:string)=>typeof id==='string')).toBe(true);
  world=(await advanceAdministrativeClockLineupV1(db,session,'advance',cmd(),'lp-entrants-day2-0001',now)).world;
  world=(await stageDomesticCalendar(db,session,cmd(),'lp-entrants-domestic-draw-0001',now)).world;
  const still=await readPublicSportingSeasonLineupV1(db,'IT-1',1) as any;
  expect(still.data).toMatchObject({entrantsOnly:true,seasonState:{day:2}});
  expect(still.data.fixtures).toBeUndefined();
  const calendars=(await db.prepare('SELECT COUNT(*) AS n FROM season_calendars').first()) as {n:number}|null;
  expect(calendars?.n).toBe(0);
 },60000);
 it('reads published V2-only days and next day without scoring future fixtures',async()=>{
  await prepareAndPublish();
  expect(world.day).toBe(3);
  // The same published numeric match IDs are now readable with V2-only
  // result authority. Future league and reserved knockout games have no score.
  const league=(await db.prepare(
   "SELECT p.id AS public_id,s.source_fixture_id AS fixture_id,s.scheduled_day AS day FROM public_match_numbers p JOIN season_match_slots s ON s.match_id=p.slot_match_id WHERE s.season_number=1 AND s.competition_id='IT-1' ORDER BY p.id LIMIT 1"
  ).first()) as {public_id:number;fixture_id:string;day:number};
  expect(league.day).toBeGreaterThan(world.day);
  const upcoming=await readPublicMatchLineupV1(db,String(league.public_id)) as any;
  expect(upcoming).toMatchObject({
   matchId:String(league.public_id),status:'scheduled',result:null,
   provenance:{kind:'authoritative',receiptHash:null}
  });
  expect(upcoming).not.toHaveProperty('events');
  expect(upcoming).not.toHaveProperty('slotId');
  expect(upcoming).not.toHaveProperty('marker');
  expect(upcoming).toHaveProperty('kickoff',null);
  expect(Object.keys(upcoming.provenance).sort()).toEqual(['kind','receiptHash']);
  const knockout=(await db.prepare(
   "SELECT p.id AS public_id FROM public_match_numbers p JOIN season_knockout_match_slots k ON k.match_id=p.slot_match_id WHERE k.season_number=1 ORDER BY p.id LIMIT 1"
  ).first()) as {public_id:number};
  const reserved=await readPublicMatchLineupV1(db,String(knockout.public_id)) as any;
  expect(reserved).toMatchObject({
   status:'awaiting_participants',result:null,
   provenance:{kind:'authoritative',receiptHash:null}
  });
  expect(reserved).not.toHaveProperty('events');
  expect(reserved).not.toHaveProperty('homePolicy');
  expect(reserved).not.toHaveProperty('slotId');
  expect(reserved).toHaveProperty('kickoff',null);
  const list=await readPublishedCompetitionMatchesLineupV1(db,1,'IT-1');
  expect(list.fixtures).toHaveLength(242);
  await expect(readPublicMatchLineupV1(db,'invalid')).rejects.toMatchObject({status:404});
  const old=(await db.prepare('SELECT COUNT(*) AS n FROM season_day_outcomes').first()) as {n:number};
  expect(old.n).toBe(0);
  const before=await readPublicSportingSeasonLineupV1(db,'IT-1',1) as any;
  expect(before).toMatchObject({status:'partial',selectedSeason:1,
   provenance:{kind:'authoritative',resultAuthority:'temporary-lineup-v1'},
   data:{season:1,standings:{complete:false},statistics:{matchesPlayed:0,playerStatus:'available',players:[]}}});
  expect(before.data?.fixtures).toHaveLength(240);
  expect(before.data?.fixtures.every((f:any)=>f.result===null)).toBe(true);
  world=(await executeLineupLifecycleV1(db,session,'advance',cmd(),'lp-day4-00001-v2',now)).world;
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
  const roster=await readPublicRosterStats(db,'IT-1',1);
  expect(roster.competitions.slice().sort()).toEqual(clubFixtures.data.competitions.slice().sort());
  expect(roster.competitions).toHaveLength(2);
  const history=await readPublicClubHistoryLineupV1(db,'IT-1') as any;
  expect(history.data?.overviews).toHaveLength(1);
  const recordSeason=history.data.overviews[0].data;
  expect(recordSeason.matches).toEqual([]);
  expect(recordSeason.players).toEqual([]);
  expect(recordSeason.memberships.find((m:any)=>m.category==='domestic').leagueGoalsAgainst).toBe(0);
  expect(history.provenance.resultAuthority).toBe('temporary-lineup-v1');
  const after=await readWorld(db);
  expect(after).toEqual(world); // public GET projections must be read-only
  expect((await db.prepare('SELECT COUNT(*) AS n FROM match_lineup_result_receipts')
   .first())!.n).toBe(0);
 },120000);
});
