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
test('legacy frozen GK role needs 60 minutes, including extra time',()=>{
 const input=result();delete input.ratingVersion;input.home.appearances[0].minutes=59;
 const stats=frozenMatchPlayerStatistics(input);
 assert.ok(stats.home.players.every(p=>p.name===null&&p.nationality===null&&p.rating===null));
 assert.equal(stats.home.players[0].cleanSheets,null,'59 minutes are not enough');
 input.home.appearances[0].minutes=60;
 assert.equal(frozenMatchPlayerStatistics(input).home.players[0].cleanSheets,1,'60 minutes qualify');
 const conceded=result();conceded.awayGoals=1;
 assert.equal(frozenMatchPlayerStatistics(conceded).home.players[0].cleanSheets,0);
 const extra=result();extra.extraTime={home:0,away:0};extra.home.appearances[0].minutes=60;
 assert.equal(frozenMatchPlayerStatistics(extra).home.players[0].cleanSheets,1,'60 of 120 minutes qualify');
});

test('v2 credits 60 actual GK minutes, regardless of natural or starting position',()=>{
 const input=result();input.eventModelVersion='lineup-events-v1';
 // The natural goalkeeper plays at right back and earns no clean sheet.
 // A natural right back starts in goal and earns one.
 input.home.starters=[{playerId:1,role:'RB',primaryPosition:'GK'},
  {playerId:2,role:'GK',primaryPosition:'RB'}];
 input.home.appearances=[
  {...player(1,'RB'),gkMinutes:0,assists:0,redCards:0},
  {...player(2,'GK',1),gkMinutes:90,assists:0,redCards:0}
 ];
 let stats=frozenMatchPlayerStatistics(input);
 assert.equal(stats.home.players[0].cleanSheets,null,'natural GK playing RB does not qualify');
 assert.equal(stats.home.players[1].cleanSheets,1,'outfield specialist playing GK qualifies');
 // At minute 30, both switch: initial RB plays GK for exactly 60 minutes.
 const switched=structuredClone(input);
 switched.home.appearances[0].gkMinutes=60;
 switched.home.appearances[1].gkMinutes=30;
 switched.home.appearances[0].intervals=[{from:0,to:30,role:'RB'},{from:30,to:90,role:'GK'}];
 switched.home.appearances[1].intervals=[{from:0,to:30,role:'GK'},{from:30,to:90,role:'RB'}];
 stats=frozenMatchPlayerStatistics(switched);
 assert.equal(stats.home.players[0].cleanSheets,1,'role-change keeper gets one at 60 GK minutes');
 assert.equal(stats.home.players[1].cleanSheets,null,'30 GK minutes do not qualify');
 // The opponent's ordinary and extra-time goals, not penalties, decide the result.
 switched.awayGoals=1;
 assert.equal(frozenMatchPlayerStatistics(switched).home.players[0].cleanSheets,0);
});
test('v2 59 versus 60 GK minutes applies to substitutes and extra time',()=>{
 const input=result();input.eventModelVersion='lineup-events-v1';
 input.home.appearances[0]={...player(1,'GK'),started:false,minutes:60,gkMinutes:59,assists:0,redCards:0};
 assert.equal(frozenMatchPlayerStatistics(input).home.players[0].cleanSheets,null);
 input.home.appearances[0].gkMinutes=60;
 assert.equal(frozenMatchPlayerStatistics(input).home.players[0].cleanSheets,1,'substitute GK qualifies after 60 minutes');
 input.extraTime={home:0,away:0};
 assert.equal(frozenMatchPlayerStatistics(input).home.players[0].cleanSheets,1,'60 GK minutes also qualify in 120-minute match');
 input.home.appearances[0].gkMinutes=61;
 assert.equal(frozenMatchPlayerStatistics(input).home.players[0].cleanSheets,null,'GK minutes must not exceed played minutes');
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
