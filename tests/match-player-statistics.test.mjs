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
 assert.equal(stats.home.players[1].assists,null);assert.equal(stats.home.players[1].yellowCards,null);assert.equal(stats.home.players[1].redCards,null);
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

test('v2 clean sheets follow the deployed GK role, not the natural position',()=>{
 const input=result();input.eventModelVersion='lineup-events-v1';
 // The naturally GK player is deployed at RB; the naturally RB player is in goal.
 input.home.starters=[{playerId:1,role:'RB',primaryPosition:'GK'},
  {playerId:2,role:'GK',primaryPosition:'RB'}];
 input.home.appearances=[
  {...player(1,'RB'),gkMinutes:0,assists:0,redCards:0},
  {...player(2,'GK',1),gkMinutes:90,assists:0,redCards:0}
 ];
 let stats=frozenMatchPlayerStatistics(input);
 assert.equal(stats.home.players[0].cleanSheets,null,'natural keeper at RB does not earn a clean sheet');
 assert.equal(stats.home.players[1].cleanSheets,1,'outfield specialist playing full match at GK does earn one');
 // Never trust an inconsistent goalkeeper-minute counter when the frozen role is outfield.
 input.home.appearances[0].gkMinutes=90;
 assert.equal(frozenMatchPlayerStatistics(input).home.players[0].cleanSheets,null);
 input.home.appearances[1].gkMinutes=75;
 assert.equal(frozenMatchPlayerStatistics(input).home.players[1].cleanSheets,null,'partial GK coverage is ineligible');
 input.home.appearances[1].gkMinutes=90;input.awayGoals=1;
 assert.equal(frozenMatchPlayerStatistics(input).home.players[1].cleanSheets,0,'conceding in goal is a recorded zero');
});
test('legacy clean sheets likewise follow the frozen match role',()=>{
 const input=result();
 input.home.starters=[{playerId:1,role:'LB',primaryPosition:'GK'},
  {playerId:2,role:'GK',primaryPosition:'LB'}];
 const stats=frozenMatchPlayerStatistics(input);
 assert.equal(stats.home.players[0].cleanSheets,null);
 assert.equal(stats.home.players[1].cleanSheets,1);
});

// Disciplinary counts come from verified v2 yellow events, not the public
// event timeline or an inferred suspension; second yellow counts twice.
test('yellow card counters are recorded for v2, including second-yellow red',()=>{
 const match=result();
 match.eventModelVersion='lineup-events-v1';
 match.home.appearances[0]={...match.home.appearances[0],role:'GK',gkMinutes:90,assists:0,redCards:0};
 match.home.appearances[1]={...match.home.appearances[1],role:'ST',gkMinutes:0,assists:0,redCards:1};
 match.events=[
  {type:'yellow',side:'home',playerId:2,minute:20},
  {type:'yellow',side:'home',playerId:2,minute:67,secondYellowSequence:true},
  {type:'red',side:'home',playerId:2,minute:67,reason:'second_yellow'}
 ];
 const stats=frozenMatchPlayerStatistics(match);
 assert.equal(stats.home.players.find(p=>p.playerId===2).yellowCards,2);
 assert.equal(stats.home.players.find(p=>p.playerId===2).redCards,1);
 assert.equal(stats.home.players.find(p=>p.playerId===1).yellowCards,0);
 assert.deepEqual(Object.keys(stats).sort(),['away','home','ratingVersion']);
 const direct=structuredClone(match);
 direct.events=[{type:'red',side:'home',playerId:2,minute:67,reason:'direct'}];
 assert.equal(frozenMatchPlayerStatistics(direct).home.players[1].yellowCards,0);
});
