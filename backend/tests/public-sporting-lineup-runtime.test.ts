import {beforeAll,beforeEach,describe,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {clearTestWorld} from './fixtures/test-world.ts';
import {readPublicSportingSeasonLineupV1,readPublicClubHistoryLineupV1,
 lineupTeamStatisticsV1} from '../src/public-sporting-read-lineup-v1.ts';

const bindings=env as any,db=bindings.DB;
beforeAll(async()=>applyD1Migrations(db,bindings.TEST_MIGRATIONS));
beforeEach(async()=>clearTestWorld(db));
describe('#613 V2 public read validation and frozen-player statistics',()=>{
 it('refuses unsupported public seasons before preparing the world',async()=>{
  const empty=await readPublicSportingSeasonLineupV1(db,'IT-1',1);
  expect(empty).toMatchObject({status:'empty',reason:'season-not-prepared',data:null});
  expect(()=>readPublicSportingSeasonLineupV1(db,'ZZ-1',1))
   .toThrowError(/not_found/);
  await expect(readPublicClubHistoryLineupV1(db,'IT-41'))
   .rejects.toMatchObject({status:404});
 },15000);
 it('derives real player stats only from verified frozen match appearances, never a player directory',()=>{
  const home='IT-1',away='IT-2',id='season:1:IT-1:N01:IT-1:IT-2';
  const f={id,homeClubId:home,awayClubId:away} as any;
  const result={homeGoals:2,awayGoals:1} as any;
  const frozen={fixtureId:id,matchId:99,receipt:{result:{
   home:{kind:'real_xi',starters:[{playerId:7,role:'ST'}],appearances:[{playerId:7,started:true,minutes:90,goals:2}]},
   away:{kind:'team_fallback',unattributedGoals:1,appearances:[]},events:[],extraTime:null
  }}} as any;
  const out=lineupTeamStatisticsV1([home,away],[f],
   new Map([[id,result]]),new Map([[id,frozen]]));
  expect(out.matchesPlayed).toBe(1);
  expect(out.totalGoals).toBe(3);
  expect(out.players).toMatchObject([{playerId:7,clubId:home,appearances:1,starts:1,subAppearances:0,minutes:90,goals:2,cleanSheets:null,assists:null,redCards:null,averageRating:null,ratedAppearances:0}]);
  expect(out.teams.find(t=>t.clubId===home)).toMatchObject({won:1,goalsFor:2,goalsAgainst:1});
  expect(out.teams.find(t=>t.clubId===away)).toMatchObject({lost:1});
  expect(()=>lineupTeamStatisticsV1([home,away],[f],new Map([[id,result]]),new Map()))
   .toThrow();
 },15000);
});
