/** PERF-MATCH-API #702: direct verified fixture lookup, no season-wide scan. */
import assert from 'node:assert/strict';
import {test} from 'vitest';
import {frozenLineupMatchDetailV1} from '../src/frozen-lineup-match-detail.ts';
import type {LineupSeasonReplayV1} from '../src/lineup-season-replay.ts';

const fixtureId='season:1:IT-1:N01:IT-1:IT-2';
const result={algorithmVersion:'temporary-lineup-v1',ratingVersion:null,
 home:{kind:'team_fallback',unattributedGoals:0},
 away:{kind:'team_fallback',unattributedGoals:0},
 homeGoals:0,awayGoals:0,regulation:{home:0,away:0},extraTime:null,penalties:null,
 winnerClubId:null,resolution:'regulation'};
const record={fixtureId,matchId:73,receiptHash:'a'.repeat(64),
 receipt:{fixture:{fixtureId,matchId:73,season:1,competitionId:'IT-1',day:13,
  homeClubId:'IT-1',awayClubId:'IT-2'},result}};

test('indexed match header resolves one fixture without scanning season and omits statistics',()=>{
 let gets=0;
 const replay={frozenMatches:{
  get(id:string){gets++;assert.equal(id,fixtureId);return record},
  values(){throw Error('Unexpected full-season match scan')}
 }} as unknown as LineupSeasonReplayV1;
 const header=frozenLineupMatchDetailV1(replay,73,fixtureId,false);
 assert.equal(gets,1);
 assert.equal(header?.result.homeGoals,0);
 assert.equal(header?.statistics,null);
 assert.equal(header?.provenance.receiptHash,'a'.repeat(64));
 assert.equal(header?.fixtureId,fixtureId);
 const detail=frozenLineupMatchDetailV1(replay,73,fixtureId);
 assert.deepEqual(detail?.statistics,{mvp:{status:'unavailable'},ratingVersion:null,
  home:{kind:'team_fallback',unattributedGoals:0,players:[]},
  away:{kind:'team_fallback',unattributedGoals:0,players:[]}});
 assert.deepEqual(header?.result,detail?.result);
 assert.deepEqual(header?.provenance,detail?.provenance);
});

test('indexed lookup rejects wrong public match identity; missing future fixture stays absent',()=>{
 const replay={frozenMatches:new Map([[fixtureId,record]])} as unknown as LineupSeasonReplayV1;
 assert.throws(()=>frozenLineupMatchDetailV1(replay,74,fixtureId,false),/Invalid frozen match detail/);
 assert.equal(frozenLineupMatchDetailV1(replay,74,'future-fixture',false),null);
});

test('legacy ID-only lookup still rejects ambiguous public IDs',()=>{
 const other={...record,fixtureId:'different-fixture',receipt:{...record.receipt,fixture:{
  ...record.receipt.fixture,fixtureId:'different-fixture'}}};
 const replay={frozenMatches:new Map([[fixtureId,record],['different-fixture',other]])} as unknown as LineupSeasonReplayV1;
 assert.throws(()=>frozenLineupMatchDetailV1(replay,73),/Invalid frozen match detail/);
});
