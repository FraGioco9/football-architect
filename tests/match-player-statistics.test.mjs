import test from 'node:test';
import assert from 'node:assert/strict';
import {frozenMatchPlayerStatistics} from '../backend/src/match-player-statistics.mjs';
const player=(id,role,goals=0)=>({playerId:id,role,started:true,minutes:90,goals,rating:6.7});
const result=()=>({ratingVersion:'test-rating-v1',homeGoals:1,awayGoals:0,extraTime:null,
 home:{kind:'real_xi',starters:[{playerId:1,role:'GK'},{playerId:2,role:'ST'}],appearances:[player(1,'GK'),player(2,'ST',1)]},
 away:{kind:'team_fallback',unattributedGoals:0,appearances:[]},
 events:[{type:'goal',playerId:2,side:'home',minute:50,period:'regulation'}]});
test('one frozen projection provides real identities, roles, minutes, goals and GK-only clean sheets',()=>{
 const input=result();input.playerIdentityVersion='player-identity-v1';
 input.playerIdentities=[{playerId:1,name:'Frozen Keeper',nationality:'ITA'},{playerId:2,name:'Frozen Scorer',nationality:'FRA'}];
 const stats=frozenMatchPlayerStatistics(input);
 assert.equal(stats.home.players[0].cleanSheets,1);
 assert.equal(stats.home.players[1].cleanSheets,null);
 assert.equal(stats.home.players[1].name,'Frozen Scorer');
 assert.equal(stats.home.players[1].nationality,'FRA');
 assert.equal(stats.home.players[1].goals,1);
 assert.equal(stats.home.players[1].assists,null);assert.equal(stats.home.players[1].redCards,null);
 assert.equal(stats.home.players[1].rating,6.7);
 assert.deepEqual(Object.keys(stats).sort(),['away','home','ratingVersion']);
 assert.equal(Object.hasOwn(stats,'events'),false);
 assert.equal(Object.hasOwn(stats,'eventModelVersion'),false);
 assert.deepEqual(stats.away.players,[]);
 assert.ok(stats.home.players.every(p=>!('attributes' in p)&&!('suitability' in p)));
});
test('old identities/ratings and partial-keeper evidence remain explicitly unavailable',()=>{
 const input=result();delete input.ratingVersion;input.home.appearances[0].minutes=75;
 const stats=frozenMatchPlayerStatistics(input);
 assert.ok(stats.home.players.every(p=>p.name===null&&p.nationality===null&&p.rating===null));
 assert.equal(stats.home.players[0].cleanSheets,null);
 const conceded=result();conceded.awayGoals=1;
 assert.equal(frozenMatchPlayerStatistics(conceded).home.players[0].cleanSheets,0);
 const extra=result();extra.extraTime={home:0,away:0};extra.home.appearances[0].minutes=120;
 assert.equal(frozenMatchPlayerStatistics(extra).home.players[0].cleanSheets,1);
});
