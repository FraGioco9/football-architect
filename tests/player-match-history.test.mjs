import test from 'node:test';
import assert from 'node:assert/strict';
import {collectFrozenPlayerMatches,paginateVerifiedPlayerMatches} from '../backend/src/player-match-history.mjs';
const world={generation:'test-generation',revision:7};
const match=(id,season,day,club,opponent,{sub=false,old=false,neutral=false,gk=false}={})=>{
 const player={playerId:7,started:!sub,role:gk?'GK':'ST',minutes:sub?45:90,goals:gk?0:1,rating:6.8,
  ...(old?{}:{gkMinutes:gk?(sub?45:90):0,assists:0,redCards:0,intervals:[{from:0,to:sub?45:90,role:gk?'GK':'ST'}]})};
 const result={homeGoals:1,awayGoals:0,resolution:'regulation',penalties:null,
  ratingVersion:'test-rating-v1',events:[],...(old?{}:{eventModelVersion:'lineup-events-v1'}),
  home:{kind:'real_xi',starters:[{playerId:7,role:gk?'GK':'ST'}],appearances:[player]},
  away:{kind:'team_fallback',appearances:[]}};
 return {receipt:{fixture:{season,fixtureId:'fixture-'+id,competitionId:'IT-1',day,
  homeClubId:club,awayClubId:opponent},result},matchId:id,meta:{kind:neutral?'knockout':'league',
   phaseId:neutral?'final':'league',neutral,round:day,marker:'D'+day,leg:neutral?1:null}};
};
const project=(values)=>collectFrozenPlayerMatches(7,1,values, new Map(values.map(v=>[v.receipt.fixture.fixtureId,v.meta])));
test('verified appearance belongs to match club, not current affiliation',()=>{
 const a=match(42,1,4,'IT-1','IT-2'),b=match(43,1,5,'IT-3','IT-4',{sub:true});
 const data=project([a,b]);
 assert.deepEqual(data.map(x=>x.clubId),['IT-3','IT-1']);
 assert.equal(data[0].performance.started,false);
 assert.equal(data[0].performance.minutes,45);
 assert.equal(data[1].matchId,'42');
});
test('historical unknown metrics are not converted to zero',()=>{
 const x=project([match(12,1,2,'IT-1','IT-2',{old:true})])[0];
 assert.equal(x.performance.assists,null);
 assert.equal(x.performance.yellowCards,null);
 assert.equal(x.performance.redCards,null);
});
test('GK CS requires at least 60 verified GK minutes, not natural position',()=>{
 const x=project([match(2,1,2,'IT-1','IT-2',{gk:true,sub:true}),
  match(3,1,3,'IT-1','IT-2',{gk:true})]);
 assert.equal(x[0].performance.cleanSheets,1);
 assert.equal(x[1].performance.cleanSheets,null);
});
test('neutral provenance and penalty resolution remain distinct from result score',()=>{
 const x=project([match(2,1,2,'IT-1','IT-2',{neutral:true})])[0];
 assert.equal(x.venue,'neutral');assert.equal(x.phaseId,'final');
 assert.equal(x.result.homeGoals,1);
});
test('missing participation excluded, duplicated appearance rejected',()=>{
 const x=match(2,1,2,'IT-1','IT-2');
 const none=structuredClone(x);none.receipt.result.home.appearances=[];
 assert.equal(project([none]).length,0);
 assert.throws(()=>project([x,x]),/Duplicate/);
});
test('cursor cannot cross world revisions or filters',()=>{
 const a=project([match(2,1,2,'IT-1','IT-2'),match(3,1,3,'IT-1','IT-2')]);
 const first=paginateVerifiedPlayerMatches(a,world,{limit:1});
 assert.equal(first.items.length,1);
 assert.equal(paginateVerifiedPlayerMatches(a,world,{limit:1,cursor:first.nextCursor}).items[0].matchId,'2');
 assert.throws(()=>paginateVerifiedPlayerMatches(a,{...world,revision:8},{limit:1,cursor:first.nextCursor}),RangeError);
 assert.throws(()=>paginateVerifiedPlayerMatches(a,world,{limit:1,season:1,cursor:first.nextCursor}),TypeError);
});

test('role changes use verified interval positions and goalkeeper time',()=>{
 const source=match(9,1,9,'IT-1','IT-2');
 const p=source.receipt.result.home.appearances[0];
 p.intervals=[{from:0,to:30,role:'ST'},{from:30,to:90,role:'GK'}];
 p.gkMinutes=60;
 const projected=project([source])[0];
 assert.deepEqual(projected.performance.positions,['ST','GK']);
 assert.equal(projected.performance.cleanSheets,1,'60 verified GK minutes qualify after a role change');
 p.intervals=[{from:0,to:31,role:'ST'},{from:31,to:90,role:'GK'}];p.gkMinutes=59;
 assert.equal(project([source])[0].performance.cleanSheets,null,'59 GK minutes do not qualify');
 p.intervals=[{from:0,to:90,role:'GK'}];p.gkMinutes=90;
 const completed=project([source])[0];
 assert.deepEqual(completed.performance.positions,['GK']);
 assert.equal(completed.performance.cleanSheets,1,'90 verified GK minutes also qualify');
});
test('penalty shootouts never inflate recorded match goals',()=>{
 const source=match(8,1,8,'IT-1','IT-2',{neutral:true});
 source.receipt.result.homeGoals=1;source.receipt.result.awayGoals=1;
 source.receipt.result.extraTime={home:0,away:0};
 source.receipt.result.resolution='penalties';
 source.receipt.result.penalties={home:5,away:4};
 const projected=project([source])[0];
 assert.deepEqual(projected.result.penalties,{home:5,away:4});
 assert.equal(projected.result.homeGoals,1);
 assert.equal(projected.result.awayGoals,1);
});

test('neutral away player retains true side for player-oriented match and penalties',()=>{
 const source=match(16,1,16,'IT-1','IT-2',{neutral:true});
 source.receipt.result.away=source.receipt.result.home;
 source.receipt.result.home={kind:'team_fallback',appearances:[]};
 source.receipt.result.homeGoals=0;source.receipt.result.awayGoals=1;
 const shown=project([source])[0];
 assert.equal(shown.venue,'neutral');
 assert.equal(shown.side,'away');
 assert.equal(shown.clubId,'IT-2');
 assert.equal(shown.opponentId,'IT-1');
 assert.equal(shown.result.awayGoals,1);
});


test('#734 player appearance batch returns up to 100 items in one verified page',()=>{
 const matches=Array.from({length:73},(_,i)=>({matchId:String(i+1),season:i<39?2:1,day:(i%39)+1,competitionId:'IT-1'}));
 const single=paginateVerifiedPlayerMatches(matches,world,{limit:100});
 assert.equal(single.total,73);
 assert.equal(single.items.length,73);
 assert.equal(single.nextCursor,null,'two-season history can be loaded in one request');
 const larger=Array.from({length:103},(_,i)=>({matchId:String(i+1),season:2,day:(i%56)+1,competitionId:'IT-1'}));
 const first=paginateVerifiedPlayerMatches(larger,world,{limit:100});
 const next=paginateVerifiedPlayerMatches(larger,world,{limit:100,cursor:first.nextCursor});
 assert.equal(first.items.length,100);
 assert.equal(next.items.length,3);
 assert.equal(next.nextCursor,null,'cursor fallback remains available for long histories');
 assert.equal(new Set([...first.items,...next.items].map(item=>item.matchId)).size,103);
 for(const limit of [0,101,-1,1.5,Number.NaN])
  assert.throws(()=>paginateVerifiedPlayerMatches(matches,world,{limit}),TypeError);
});
