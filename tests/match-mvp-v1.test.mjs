import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveMatchMvpV1,sealMatchMvpV1,frozenMatchMvpV1,validateMatchMvpV1} from '../backend/src/match-mvp-v1.mjs';
const p=(id,rating,minutes=90,goals=0,assists=0)=>({playerId:id,rating,minutes,goals,assists,started:true});
const side=appearances=>({kind:'real_xi',appearances});
const match=(home,away)=>({ratingVersion:'test-rating-v1',homeClubId:'IT-1',awayClubId:'IT-2',
 home:home===null?{kind:'team_fallback',appearances:[]}:side(home),
 away:away===null?{kind:'team_fallback',appearances:[]}:side(away),
 homeGoals:0,awayGoals:0,penalties:null,resolution:'regulation'});
test('#719 deterministic rating/minutes/goals/assists/ID tie-break',()=>{
 const m=match([p(7,8),p(8,8,91),p(9,8,91,1),p(10,8,91,1,2),p(11,8,91,1,2)],[p(4,7.9)]);
 assert.deepEqual(deriveMatchMvpV1(m),{status:'awarded',playerId:10,clubId:'IT-1',side:'home',rating:8});
 sealMatchMvpV1(m);assert.doesNotThrow(()=>validateMatchMvpV1(m));
 assert.deepEqual(frozenMatchMvpV1(m),m.mvp);
 assert.throws(()=>sealMatchMvpV1(m),/Invalid frozen/);
});
test('#719 real XI/fallback and fallback/fallback have honest provenance',()=>{
 const m=match(null,[p(24,6.3)]);sealMatchMvpV1(m);
 assert.equal(m.mvp.playerId,24);assert.equal(m.mvp.clubId,'IT-2');
 const fallback=match(null,null);sealMatchMvpV1(fallback);
 assert.deepEqual(fallback.mvp,{status:'none'});
});
test('#719 historical unknown != official no-award',()=>{
 const old=match([p(7,8.2)],null);
 assert.deepEqual(frozenMatchMvpV1(old),{status:'unavailable'});
 const noRatings=match([p(7,null)],null);sealMatchMvpV1(noRatings);
 assert.deepEqual(noRatings.mvp,{status:'none'});
});
test('#719 forged frozen winner/rating/club/keys or changed tie-break rejected',()=>{
 const m=match([p(7,7),p(8,8)],null);sealMatchMvpV1(m);
 for(const forged of [
  {...m,mvp:{...m.mvp,playerId:7}},
  {...m,mvp:{...m.mvp,clubId:'IT-3'}},
  {...m,mvp:{...m.mvp,rating:9.5}},
  {...m,mvp:{...m.mvp,unknown:true}},
  {...m,mvpVersion:'invalid'},
  {...m,home:{...m.home,appearances:[p(7,9.5),p(8,8)]}}
 ])assert.throws(()=>validateMatchMvpV1(forged),/Invalid frozen/);
});
test('#719 missing assist provenance is skipped consistently',()=>{
 const m=match([p(7,8,90,0,undefined),p(8,8,90,0,2)],null);
 delete m.home.appearances[0].assists;
 assert.equal(deriveMatchMvpV1(m).playerId,7);
 m.home.appearances[0].rating=undefined;
 assert.equal(deriveMatchMvpV1(m).playerId,8);
});
test('#719 draws, ET and shootouts preserve scored goals',()=>{
 const m=match([p(7,8.2,120)],[p(8,8.3,120)]);
 m.resolution='penalties';m.penalties={home:4,away:3};m.homeGoals=1;m.awayGoals=1;
 const before=[m.homeGoals,m.awayGoals,JSON.stringify(m.penalties)];
 sealMatchMvpV1(m);assert.equal(m.mvp.playerId,8);
 assert.deepEqual([m.homeGoals,m.awayGoals,JSON.stringify(m.penalties)],before);
});
