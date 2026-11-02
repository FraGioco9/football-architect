// DEBUG-DATA-01 I02: complete INT24 ranking including opponents' records.
const cmp=(a,b)=>a===b?0:a>b?-1:1;
export function rankInternationalLeague(participants,events,tiebreakers){
 const expected=["points","goalDifference","goalsFor","wins","awayGoals","awayWins","opponentsPoints","opponentsGoalDifference","opponentsGoalsFor","compositeClubId"];
 if(JSON.stringify(tiebreakers)!==JSON.stringify(expected))throw Error("unsupported INT24 ranking policy");
 if(participants?.length!==24||events?.length!==72)throw Error("invalid league phase");
 const table=new Map(participants.map(clubId=>[clubId,{clubId,played:0,points:0,goalDifference:0,goalsFor:0,goalsAgainst:0,wins:0,awayGoals:0,awayWins:0,opponentsPoints:0,opponentsGoalDifference:0,opponentsGoalsFor:0,opponents:[]}]));
 for(const e of events){
  const h=table.get(e.homeId),a=table.get(e.awayId);
  if(!h||!a||!Number.isInteger(e.result?.homeGoals)||!Number.isInteger(e.result?.awayGoals))throw Error("unrecorded match");
  h.played++;a.played++;h.goalsFor+=e.result.homeGoals;h.goalsAgainst+=e.result.awayGoals;a.goalsFor+=e.result.awayGoals;a.goalsAgainst+=e.result.homeGoals;
  a.awayGoals+=e.result.awayGoals;h.opponents.push(a.clubId);a.opponents.push(h.clubId);
  if(e.result.homeGoals>e.result.awayGoals){h.wins++;h.points+=3}
  else if(e.result.homeGoals<e.result.awayGoals){a.wins++;a.awayWins++;a.points+=3}
  else {h.points++;a.points++}
 }
 for(const r of table.values()){
  if(r.played!==6||new Set(r.opponents).size!==6)throw Error("wrong league opponent count");
  r.goalDifference=r.goalsFor-r.goalsAgainst;
 }
 for(const r of table.values())for(const opponent of r.opponents){
  const o=table.get(opponent);
  r.opponentsPoints+=o.points;r.opponentsGoalDifference+=o.goalDifference;r.opponentsGoalsFor+=o.goalsFor;
 }
 const rows=[...table.values()];
 rows.sort((a,b)=>{for(const key of expected){const value=key==="compositeClubId"?a.clubId.localeCompare(b.clubId):cmp(a[key],b[key]);if(value)return value;}return 0});
 return rows.map(({opponents,...rest})=>rest);
}
