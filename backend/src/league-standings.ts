import type {Fixture} from './initial-schedule.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {ApiError} from './errors.ts';
export interface LeagueRow {
 clubId:string;rank:number;played:number;won:number;drawn:number;lost:number;
 goalsFor:number;goalsAgainst:number;goalDifference:number;points:number;awayGoals:number;awayWins:number;
 opponentsPoints:number;opponentsGoalDifference:number;opponentsGoalsFor:number;drawKey:string;
}
export interface FinalScore {homeGoals:number;awayGoals:number}
const fail=():never=>{throw new ApiError(422,'standings_incomplete')};
const textCompare=(a:string,b:string)=>a<b?-1:a>b?1:0;
function numericCompare(a:number[],b:number[]):number{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return b[i]-a[i];return 0}
function partition(rows:LeagueRow[],value:(r:LeagueRow)=>number[]):LeagueRow[][]{
 const sorted=[...rows].sort((a,b)=>numericCompare(value(a),value(b))),groups:LeagueRow[][]=[];
 for(const row of sorted){const last=groups[groups.length-1];if(last&&numericCompare(value(last[0]),value(row))===0)last.push(row);else groups.push([row])}
 return groups;
}
/** Complete sporting league evidence only. Caller supplies independently validated
 * seasonal memberships/fixtures. Scores from knockouts never enter these tables. */
export async function rankLeagueTable(competitionId:string,clubIds:readonly string[],fixtures:readonly Fixture[],scores:ReadonlyMap<string,FinalScore>,seed:string):Promise<readonly Readonly<LeagueRow>[]>{
 const cup=competitionId.startsWith('int-');
 if(!/^(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])$/.test(competitionId)||!Array.isArray(clubIds)||clubIds.length<2||new Set(clubIds).size!==clubIds.length||typeof seed!=='string'||seed.length<16||
  fixtures.length!==(cup?72:clubIds.length*(clubIds.length-1))||new Set(fixtures.map(f=>f.id)).size!==fixtures.length||(cup&&clubIds.length!==24))return fail();
 const rows=new Map<string,LeagueRow>(),opponents=new Map<string,string[]>(),pairs=new Set<string>();
 for(const clubId of clubIds){
  rows.set(clubId,{clubId,rank:0,played:0,won:0,drawn:0,lost:0,goalsFor:0,goalsAgainst:0,goalDifference:0,points:0,awayGoals:0,awayWins:0,opponentsPoints:0,opponentsGoalDifference:0,opponentsGoalsFor:0,
   drawKey:cup?clubId:await canonicalHash({policy:'domestic-reproducible-draw-v1',competitionId,seed,clubId})});opponents.set(clubId,[]);
 }
 for(const f of fixtures){
  const score=scores.get(f.id),home=rows.get(f.homeClubId),away=rows.get(f.awayClubId),pair=f.homeClubId+':'+f.awayClubId;
  if(f.competitionId!==competitionId||!home||!away||home===away||pairs.has(pair)||!score||![score.homeGoals,score.awayGoals].every(x=>Number.isSafeInteger(x)&&x>=0&&x<=100))return fail();
  pairs.add(pair);opponents.get(home.clubId)!.push(away.clubId);opponents.get(away.clubId)!.push(home.clubId);
  home.played++;away.played++;home.goalsFor+=score.homeGoals;home.goalsAgainst+=score.awayGoals;away.goalsFor+=score.awayGoals;away.goalsAgainst+=score.homeGoals;away.awayGoals+=score.awayGoals;
  if(score.homeGoals===score.awayGoals){home.drawn++;away.drawn++;home.points++;away.points++}
  else if(score.homeGoals>score.awayGoals){home.won++;away.lost++;home.points+=3}
  else{away.won++;home.lost++;away.points+=3;away.awayWins++}
 }
 for(const row of rows.values()){
  if(row.played!==(cup?6:2*(clubIds.length-1))||new Set(opponents.get(row.clubId)).size!==(cup?6:clubIds.length-1))return fail();
  row.goalDifference=row.goalsFor-row.goalsAgainst;
 }
 for(const row of rows.values())for(const opponent of opponents.get(row.clubId)!){const r=rows.get(opponent)!;row.opponentsPoints+=r.points;row.opponentsGoalDifference+=r.goalDifference;row.opponentsGoalsFor+=r.goalsFor}
 const fallback=(group:LeagueRow[])=>[...group].sort((a,b)=>numericCompare([a.goalDifference,a.goalsFor,a.won],[b.goalDifference,b.goalsFor,b.won])||textCompare(a.drawKey,b.drawKey)||textCompare(a.clubId,b.clubId));
 const headToHead=(group:LeagueRow[]):LeagueRow[]=>{
  if(group.length<2)return group;
  const mini=new Map(group.map(r=>[r.clubId,[0,0,0]]));
  for(const f of fixtures){const h=mini.get(f.homeClubId),a=mini.get(f.awayClubId);if(!h||!a)continue;const s=scores.get(f.id)!;
   h[0]+=s.homeGoals>s.awayGoals?3:s.homeGoals===s.awayGoals?1:0;a[0]+=s.awayGoals>s.homeGoals?3:s.homeGoals===s.awayGoals?1:0;
   h[1]+=s.homeGoals-s.awayGoals;a[1]+=s.awayGoals-s.homeGoals;h[2]+=s.homeGoals;a[2]+=s.awayGoals;
  }
  const groups=partition(group,r=>mini.get(r.clubId)!);
  // Reapply the same head-to-head criteria to any remaining subset. If no club
  // separates, progress to global criteria rather than recursing indefinitely.
  return groups.length===1?fallback(group):groups.flatMap(headToHead);
 };
 const sorted=cup?[...rows.values()].sort((a,b)=>numericCompare(
  [a.points,a.goalDifference,a.goalsFor,a.won,a.awayGoals,a.awayWins,a.opponentsPoints,a.opponentsGoalDifference,a.opponentsGoalsFor],
  [b.points,b.goalDifference,b.goalsFor,b.won,b.awayGoals,b.awayWins,b.opponentsPoints,b.opponentsGoalDifference,b.opponentsGoalsFor])||textCompare(a.clubId,b.clubId)):
  partition([...rows.values()],r=>[r.points]).flatMap(headToHead);
 return Object.freeze(sorted.map((r,i)=>Object.freeze({...r,rank:i+1})));
}
