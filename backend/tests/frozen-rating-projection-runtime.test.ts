import {describe,it,expect} from 'vitest';
import {ATTRIBUTES} from '../src/players-generator-core.mjs';
import {simulateMatchV1} from '../src/temporary-lineup-v1.mjs';
import {frozenLineupMatchDetailV1} from '../src/frozen-lineup-match-detail.ts';
import type {LineupSeasonReplayV1} from '../src/lineup-season-replay.ts';

const roles=['GK','RB','CB','CB','LB','CM','DM','CM','RW','ST','LW'];
const roster=(offset:number)=>roles.map((role,i)=>({
 id:offset+i+1,career_status:'active' as const,primary_position:role,
 secondary_positions:[],attributes:Object.fromEntries(ATTRIBUTES.map(a=>[a,61]))
}));
const fixtureId='season:1:IT-1:N01:IT-1:IT-2';
const seed='rating-projection-verified-test-seed';
async function play(home:number,away:number){
 return simulateMatchV1({homeRoster:home?roster(0):[],awayRoster:away?roster(100):[],
  matchKey:fixtureId,seed,homeClubId:'IT-1',awayClubId:'IT-2',context:{mode:'regulation'}});
}
function detail(result:Awaited<ReturnType<typeof play>>){
 const fake={frozenMatches:new Map([[fixtureId,{
  matchId:17,fixtureId,receiptHash:'a'.repeat(64),
  receipt:{fixture:{matchId:17,season:1,competitionId:'IT-1',
   day:13,homeClubId:'IT-1',awayClubId:'IT-2'},result}
 }]])} as unknown as LineupSeasonReplayV1;
 return frozenLineupMatchDetailV1(fake,17);
}
describe('#650 frozen Match Detail rating projection',()=>{
 it('projects all verified XI ratings with no lookup from live players',async()=>{
  const result=await play(11,11),frozen=detail(result);
  expect(frozen?.players.ratingVersion).toBe('test-rating-v1');
  expect(frozen?.players.home.appearances).toHaveLength(11);
  expect(frozen?.players.away.appearances).toHaveLength(11);
  for(const side of ['home','away'] as const){
   const rated=frozen!.players[side].appearances;
   expect(rated.every(p=>p.rating!==null&&p.rating>=4&&p.rating<=10)).toBe(true);
   expect(rated.every(p=>Number.isSafeInteger(p.playerId))).toBe(true);
  }
 });
 it('does not invent fallback players or backfill pre-rating results',async()=>{
  const mixed=detail(await play(11,0));
  expect(mixed?.players.home.appearances).toHaveLength(11);
  expect(mixed?.players.away.appearances).toEqual([]);
  const empty=detail(await play(0,0));
  expect(empty?.players.home.appearances).toEqual([]);
  expect(empty?.players.away.appearances).toEqual([]);
  const legacy=await play(11,0);
  delete legacy.ratingVersion;
  for(const p of legacy.home.appearances)delete p.rating;
  const old=detail(legacy);
  expect(old?.players.ratingVersion).toBeNull();
  expect(old?.players.home.appearances).toHaveLength(11);
  expect(old?.players.home.appearances.every(p=>p.rating===null)).toBe(true);
 });
});
