// DEV-only statistics derived from the same fictional match results as standings.
// Not publication-allowlisted. Never substitute for canonical match/player events.
import {createPreviewStandings,PREVIEW_RULES,comparePreviewRows} from "./dev-standings-preview-data.mjs";

export function aggregatePreviewStats(division, matchdays=15, season=1) {
  const preview=createPreviewStandings(division,matchdays,season);
  const matches=preview.fixtures;
  const byId=new Map(preview.clubs.map(club=>[club.clubId,{
    clubId:club.clubId,clubName:club.primaryName,mp:0,w:0,d:0,l:0,
    gf:0,ga:0,gd:0,points:0,ppg:0,cs:0,fts:0,unbeatenStreak:0,
    homePlayed:0,homeWins:0,homeWinPct:0,awayPlayed:0,awayWins:0,awayWinPct:0
  }]));
  let homeWins=0,draws=0,awayWins=0,totalGoals=0,cleanSheets=0;
  const scores=new Map();
  const unbeaten=new Map(preview.clubs.map(club=>[club.clubId,0]));
  let maxGoals=-1;
  const highestScoringMatches=[];
  for(const game of matches){
    const h=byId.get(game.homeId),a=byId.get(game.awayId);
    if(!h||!a||!Number.isSafeInteger(game.homeGoals)||!Number.isSafeInteger(game.awayGoals))
      throw Error("Invalid DEV match");
    const hg=game.homeGoals,ag=game.awayGoals,goals=hg+ag;
    h.mp++;a.mp++;h.homePlayed++;a.awayPlayed++;
    h.gf+=hg;h.ga+=ag;a.gf+=ag;a.ga+=hg;
    if(ag===0){h.cs++;cleanSheets++}
    if(hg===0){a.cs++;cleanSheets++}
    if(hg===0)h.fts++;
    if(ag===0)a.fts++;
    if(hg>ag){h.w++;a.l++;h.homeWins++;homeWins++}
    else if(hg<ag){a.w++;h.l++;a.awayWins++;awayWins++}
    else{h.d++;a.d++;draws++}
    unbeaten.set(h.clubId,hg>=ag?unbeaten.get(h.clubId)+1:0);
    unbeaten.set(a.clubId,ag>=hg?unbeaten.get(a.clubId)+1:0);
    totalGoals+=goals;
    const score=hg+"-"+ag;scores.set(score,(scores.get(score)||0)+1);
    if(goals>maxGoals){maxGoals=goals;highestScoringMatches.length=0}
    if(goals===maxGoals)highestScoringMatches.push({...game});
  }
  const teams=[...byId.values()].map(row=>{
    row.unbeatenStreak=unbeaten.get(row.clubId);
    row.gd=row.gf-row.ga;row.points=PREVIEW_RULES.win*row.w+PREVIEW_RULES.draw*row.d+PREVIEW_RULES.loss*row.l;
    row.ppg=row.mp?row.points/row.mp:0;
    row.homeWinPct=row.homePlayed?100*row.homeWins/row.homePlayed:0;
    row.awayWinPct=row.awayPlayed?100*row.awayWins/row.awayPlayed:0;
    return row;
  }).sort((a,b)=>comparePreviewRows({pts:a.points,gd:a.gd,gf:a.gf,club:a},{pts:b.points,gd:b.gd,gf:b.gf,club:b}));
  const count=matches.length;
  const mostFrequentScoreline=[...scores].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]||null;
  if(teams.reduce((n,t)=>n+t.gf,0)!==totalGoals||
     teams.reduce((n,t)=>n+t.ga,0)!==totalGoals||
     homeWins+draws+awayWins!==count||
     teams.reduce((n,t)=>n+t.mp,0)!==count*2)
    throw Error("DEV statistics reconciliation failed");
  return {
    divisionId:division.id,season,matchdays,debug:true,
    overview:{matchesPlayed:count,totalGoals,goalsPerMatch:count?totalGoals/count:0,
      homeWins,draws,awayWins,homeWinPct:count?100*homeWins/count:0,
      drawPct:count?100*draws/count:0,awayWinPct:count?100*awayWins/count:0,
      cleanSheets,highestScoringMatches,mostFrequentScoreline:
        mostFrequentScoreline?{score:mostFrequentScoreline[0],count:mostFrequentScoreline[1]}:null},
    teams,
    players:[],playerStatsAvailable:false
  };
}
