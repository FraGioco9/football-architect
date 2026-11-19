import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateFrozenPlayerSeasonStats as aggregate} from '../backend/src/player-season-statistics.mjs';
const appearance=(playerId,started=true)=>({playerId,role:'ST',started,minutes:started?90:30,goals:1,rating:7.2,
 assists:1,redCards:0});
function match(id,competitionId='IT-1',clubId='IT-1',v2=true,options={}){
 const player=appearance(42,options.started??true);
 if(v2){Object.assign(player,{assists:options.assists??1,redCards:options.redCards??0,gkMinutes:0});
  player.role=options.role??'ST';if(options.role==='GK')player.gkMinutes=90;}
 const result={homeGoals:1,awayGoals:0,extraTime:null,ratingVersion:'test-rating-v1',
  home:{kind:'real_xi',starters:[{playerId:42,role:options.role??'ST'}],
    appearances:[player]},away:{kind:'team_fallback',unattributedGoals:0,appearances:[]},
  events:[],playerIdentityVersion:null};
 if(v2){result.eventModelVersion='lineup-events-v1';player.subAppearances=options.started===false?1:0;
  result.events=Array.from({length:options.yellow??0},()=>({type:'yellow',playerId:42,side:'home'}));}
 return {matchId:id,receipt:{fixture:{competitionId,homeClubId:clubId,awayClubId:'IT-2'},
  result}};
}
test('#578 grouped season statistics keep frozen club and weighted ratings',()=>{
 const v=aggregate(42,[match(1),match(2,'int-1','IT-2'),match(3,'IT-1','IT-1',true,{started:false})]);
 assert.equal(v.total.appearances,3);assert.equal(v.total.starts,2);
 assert.equal(v.total.subAppearances,1);assert.equal(v.total.goals,3);
 assert.equal(v.total.assists,3);assert.equal(v.total.minutes,210);
 assert.equal(v.total.averageRating,7.2);assert.equal(v.total.ratedAppearances,3);
 assert.equal(v.competitions.length,2);
 assert.deepEqual(v.competitions.map(p=>p.clubId),['IT-1','IT-2']);
 assert.deepEqual(v.competitions.map(p=>p.competitionId),['IT-1','int-1'],
  'domestic first, international second, regardless of localeCompare casing');
 const reordered=aggregate(42,[match(4,'int-1','IT-2'),match(5,'IT-1','IT-1')]);
 assert.deepEqual(reordered.competitions.map(p=>p.competitionId),['IT-1','int-1'],
  'sorting does not depend on replay order');
});
test('#578 mixed new/legacy receipts show unrecorded counters as null',()=>{
 const legacy=match(4,'IT-1','IT-1',false);
 const current=match(5,'IT-1','IT-1',true,{yellow:2});
 const v=aggregate(42,[legacy,current]);
 assert.equal(v.total.appearances,2);assert.equal(v.total.goals,2);
 assert.equal(v.total.assists,null);assert.equal(v.total.yellowCards,null);
 assert.equal(v.total.subAppearances,null);assert.equal(v.total.redCards,null);
 assert.equal(aggregate(42,[current]).total.yellowCards,2);
 assert.equal(aggregate(42,[]).total.appearances,0);
});
test('#578 GK-only full match clean sheets are not confused with outfield stats',()=>{
 const full=match(1,'IT-1','IT-1',true,{role:'GK'});
 const keeper=aggregate(42,[full]);
 assert.equal(keeper.total.cleanSheets,1);assert.equal(keeper.total.gkAppearances,1);
 assert.equal(aggregate(42,[match(2)]).total.cleanSheets,null);
});
test('#578 duplicate attribution fails closed',()=>{
 const duplicate=match(6);
 assert.throws(()=>aggregate(42,[duplicate,duplicate]),/Duplicate player/);
});
