// DEV-only consistency checks for competition statistics, seasons 1 and 2.
import assert from "node:assert/strict";
import {aggregatePreviewStats} from "./dev-competition-stats-data.mjs";
import {createPreviewStandings} from "./dev-standings-preview-data.mjs";

for (const tier of [1,2]) {
  const clubs=Array.from({length:16},(_,i)=>({
    clubId:i+1+(tier-1)*16,countryId:"IT",primaryName:"Test Club "+(i+1)
  }));
  const division={id:"IT-"+tier,countryId:"IT",tier,capacity:16,clubs};
  for(const season of [1,2]) {
    for(const matchdays of [0,1,15,30]) {
      const stats=aggregatePreviewStats(division,matchdays,season);
      const fixtures=createPreviewStandings(division,matchdays,season).fixtures;
      assert.equal(stats.overview.matchesPlayed,matchdays*8);
      assert.equal(stats.overview.matchesPlayed,fixtures.length);
      assert.equal(stats.overview.totalGoals,fixtures.reduce((n,g)=>n+g.homeGoals+g.awayGoals,0));
      assert.equal(stats.overview.homeWins+stats.overview.draws+stats.overview.awayWins,fixtures.length);
      assert.equal(stats.teams.reduce((n,t)=>n+t.mp,0),fixtures.length*2);
      assert.equal(stats.teams.reduce((n,t)=>n+t.gf,0),stats.overview.totalGoals);
      assert.equal(stats.teams.reduce((n,t)=>n+t.ga,0),stats.overview.totalGoals);
      assert.equal(stats.teams.reduce((n,t)=>n+t.w,0),stats.teams.reduce((n,t)=>n+t.l,0));
      assert.equal(stats.players.length,0);
      assert.equal(stats.playerStatsAvailable,false);
      assert.deepEqual(stats,aggregatePreviewStats(division,matchdays,season));
      const streaks=new Map(clubs.map(club=>[club.clubId,0]));
      for(const game of fixtures){
        streaks.set(game.homeId,game.homeGoals>=game.awayGoals?streaks.get(game.homeId)+1:0);
        streaks.set(game.awayId,game.awayGoals>=game.homeGoals?streaks.get(game.awayId)+1:0);
      }
      for(const team of stats.teams){
        assert.equal(team.unbeatenStreak,streaks.get(team.clubId));
        assert.ok(team.unbeatenStreak>=0&&team.unbeatenStreak<=team.mp);
      }
      for(const team of stats.teams) {
        assert.equal(team.mp,team.w+team.d+team.l);
        assert.equal(team.gd,team.gf-team.ga);
        assert.equal(team.points,3*team.w+team.d);
        assert.ok(team.cs<=team.mp&&team.fts<=team.mp);
      }
    }
  }
}
console.log("DEV competition Stats consistency: 16 scenarios PASS");
