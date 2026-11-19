import {beforeAll,beforeEach,describe,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {clearTestWorld} from './fixtures/test-world.ts';
import {readPublicSportingSeasonLineupV1,readPublicClubHistoryLineupV1,
 clubRosterTotals,lineupTeamStatisticsV1} from '../src/public-sporting-read-lineup-v1.ts';

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
  const previous={...f,id:'previous-club',homeClubId:'IT-3',awayClubId:away};
  const future={...f,id:'future'};
  const fixtures=[f,previous,future];
  const scores=new Map([[id,result],[previous.id,result]]);
  const receipts=new Map([[id,frozen],[previous.id,{...frozen,fixtureId:previous.id}]]);
  expect(clubRosterTotals(home,fixtures,scores,receipts)).toMatchObject({complete:true,totals:[{playerId:7,appearances:1,starts:1,minutes:90,goals:2}]});
  expect(clubRosterTotals(away,fixtures,scores,receipts)).toEqual({complete:false,totals:[]});
  expect(out.matchesPlayed).toBe(1);
  expect(out.totalGoals).toBe(3);
  expect(out.players).toMatchObject([{playerId:7,clubId:home,appearances:1,starts:1,subAppearances:null,minutes:90,goals:2,cleanSheets:null,assists:null,yellowCards:null,redCards:null,averageRating:null,ratedAppearances:0}]);
  expect(out.teams.find(t=>t.clubId===home)).toMatchObject({won:1,goalsFor:2,goalsAgainst:1});
  expect(out.teams.find(t=>t.clubId===away)).toMatchObject({lost:1});
  expect(()=>lineupTeamStatisticsV1([home,away],[f],new Map([[id,result]]),new Map()))
   .toThrow();
 },15000);
 it('aggregates recorded domestic and international matches without including future fixtures',()=>{
  for(const [competition,home,away] of [
   ['IT-1','IT-1','IT-2'],['int-1','IT-1','ENG-1'],['int-2','IT-3','ENG-3']
  ]){
   const ids=[1,2,3].map(n=>`season:1:${competition}:N0${n}:${home}:${away}`);
   const fixtures=ids.map(id=>({id,homeClubId:home,awayClubId:away}) as any);
   const scores=new Map<string,any>([[ids[0],{homeGoals:2,awayGoals:1}],[ids[1],{homeGoals:0,awayGoals:1}]]);
   const frozen=new Map(ids.slice(0,2).map((id,i)=>{
    const score=scores.get(id) as any;
    return [id,{fixtureId:id,matchId:i+1,receipt:{result:{
     eventModelVersion:'lineup-events-v1',extraTime:null,
     homeGoals:score.homeGoals,awayGoals:score.awayGoals,
     home:{kind:'real_xi',starters:[{playerId:7,role:'ST'}],
      appearances:[{playerId:7,started:true,role:'ST',minutes:90,goals:i===0?1:0,
       assists:i===0?1:0,redCards:0,gkMinutes:0}]},
     away:{kind:'team_fallback',unattributedGoals:score.awayGoals,appearances:[]},
     events:i===0?[{type:'yellow',side:'home',playerId:7,minute:12}]:[]
    }}} as any] as const;
   }));
   const out=lineupTeamStatisticsV1([home,away],fixtures,scores,frozen);
   expect(out).toMatchObject({matchesPlayed:2,totalGoals:4,goalsPerMatch:2});
   expect(out.teams.find(t=>t.clubId===home)).toMatchObject({
    played:2,won:1,lost:1,goalsFor:2,goalsAgainst:2,cleanSheets:0
   });
   expect(out.players).toMatchObject([{
    clubId:home,playerId:7,appearances:2,starts:2,subAppearances:0,
    minutes:180,goals:1,assists:1,yellowCards:1,redCards:0,
    cleanSheets:null,averageRating:null
   }]);
   expect(out.players).toHaveLength(1);
  }
 },15000);

});

describe('#690 per-season yellow-card coverage',()=>{
 it('counts recorded v2 bookings but treats mixed v1 history as unavailable',()=>{
  const home='IT-1',away='IT-2';
  const one='season:1:IT-1:N01:IT-1:IT-2',
   two='season:1:IT-1:N02:IT-1:IT-2';
  const fixture=(id:string)=>({id,homeClubId:home,awayClubId:away}) as any;
  const score={homeGoals:0,awayGoals:0} as any;
  const person={playerId:7,started:true,role:'ST',minutes:67,goals:0,
   assists:0,redCards:1,gkMinutes:0,intervals:[]};
  const verified={fixtureId:one,matchId:91,receipt:{result:{
   eventModelVersion:'lineup-events-v1',extraTime:null,homeGoals:0,awayGoals:0,
   home:{kind:'real_xi',starters:[{playerId:7,role:'ST'}],appearances:[person]},
   away:{kind:'team_fallback',unattributedGoals:0,appearances:[]},
   events:[{type:'yellow',side:'home',playerId:7,minute:12},
    {type:'yellow',side:'home',playerId:7,minute:67,secondYellowSequence:true},
    {type:'red',side:'home',playerId:7,minute:67,reason:'second_yellow'}]
  }}} as any;
  const first=lineupTeamStatisticsV1([home,away],[fixture(one)],
   new Map([[one,score]]),new Map([[one,verified]]));
  expect(first.players).toMatchObject([{playerId:7,yellowCards:2,redCards:1,assists:0}]);
  const legacy={fixtureId:two,matchId:92,receipt:{result:{
   home:{kind:'real_xi',starters:[{playerId:7,role:'ST'}],
    appearances:[{playerId:7,started:true,minutes:90,goals:0}]},
   away:{kind:'team_fallback',unattributedGoals:0,appearances:[]},events:[],extraTime:null
  }}} as any;
  const mixed=lineupTeamStatisticsV1([home,away],[fixture(one),fixture(two)],
   new Map([[one,score],[two,score]]),new Map([[one,verified],[two,legacy]]));
  expect(mixed.players).toMatchObject([{playerId:7,appearances:2,
   yellowCards:null,redCards:null,assists:null}]);
 });
});
