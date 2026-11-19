import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateFrozenPlayerSeasonStats} from '../backend/src/player-season-statistics.mjs';
import {collectFrozenPlayerMatches} from '../backend/src/player-match-history.mjs';
const a=(id,r=7.1)=>({playerId:id,role:'ST',started:true,minutes:90,goals:0,rating:r});
function fixture(matchId,club='IT-1',competitionId='IT-1',mvp='winner'){
 const result={homeClubId:club,awayClubId:'IT-40',homeGoals:0,awayGoals:0,
  resolution:'regulation',penalties:null,extraTime:null,ratingVersion:'test-rating-v1',
  home:{kind:'real_xi',starters:[{playerId:42,role:'ST'},{playerId:43,role:'ST'}],appearances:[a(42),a(43,mvp==='other'?7.6:6.8)]},
  away:{kind:'team_fallback',appearances:[]},events:[]};
 if(mvp!=='legacy'){result.mvpVersion='match-mvp-v1';result.mvp=
  mvp==='winner'?{status:'awarded',playerId:42,clubId:club,side:'home',rating:7.1}:
  mvp==='none'?{status:'none'}:{status:'awarded',playerId:43,clubId:club,side:'home',rating:7.6};}
 const info={season:1,fixtureId:'match-'+matchId,homeClubId:club,awayClubId:'IT-40',
  day:matchId,competitionId};
 return {matchId,receipt:{fixture:info,result},meta:{kind:'league',phaseId:'league',neutral:false,leg:null,round:matchId,marker:'D'+matchId}};
}
test('#719 player seasons keep awards and frozen club attribution',()=>{
 const x=fixture(1),y=fixture(2,'IT-3','int-1');
 const data=aggregateFrozenPlayerSeasonStats(42,[x,y]);
 assert.equal(data.total.mvpAwards,2);assert.equal(data.total.mvpCoveredAppearances,2);
 assert.deepEqual(data.competitions.map(c=>[c.clubId,c.mvpAwards]),[['IT-1',1],['IT-3',1]]);
});
test('#719 legacy coverage never becomes zero; non-winner is zero',()=>{
 const a=fixture(3,'IT-1','IT-1','legacy'),b=fixture(4,'IT-1','IT-1','other');
 const data=aggregateFrozenPlayerSeasonStats(42,[a,b]);
 assert.equal(data.total.mvpAwards,null);assert.equal(data.total.mvpCoveredAppearances,1);
 assert.equal(aggregateFrozenPlayerSeasonStats(42,[b]).total.mvpAwards,0);
});
test('#719 player Matches flags are true, false, null across transfers',()=>{
 const items=[fixture(1),fixture(2,'IT-3','int-1','other'),fixture(3,'IT-4','IT-2','legacy')];
 const map=new Map(items.map(f=>[f.receipt.fixture.fixtureId,f.meta]));
 const rows=collectFrozenPlayerMatches(42,1,items,map);
 assert.deepEqual(rows.map(row=>[row.clubId,row.performance.mvp]),[['IT-4',null],['IT-3',false],['IT-1',true]]);
});
