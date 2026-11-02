// DEBUG-DATA-01 I03: validate and normalize protected domestic projection
// into the competition context's shared, non-rendering season-data shape.
// Never reassign participant IDs based on row position: seasons can promote/relegate.
const domestic=/^(IT|ENG|ES|DE|FR|PT|NL|BR)-[12]$/;
const ensure=(ok,msg)=>{if(!ok)throw Error("DEBUG-DATA-01 context bridge: "+msg)};
export function prepareProtectedDomesticContext(view,{competitionId,season,day,knownClubIds}){
 ensure(domestic.test(competitionId),"domestic competitions only");
 ensure(view?.kind==="protected-debug-projection"&&view.competitionId===competitionId&&view.seasonNumber===season&&view.worldDay===day,"stale or mismatched projection");
 ensure(Array.isArray(view.participants)&&view.participants.length===16&&new Set(view.participants).size===16,"invalid participants");
 const participants=view.participants;
 ensure(Array.isArray(view.clubs)&&view.clubs.length===16,"missing season-aware club identities");
 const identities=new Map();
 for(const club of view.clubs){
  const id=club?.canonicalId;
  ensure(participants.includes(id)&&!identities.has(id)&&club.countryId+"-"+club.clubId===id&&typeof club.primaryName==="string"&&club.primaryName.trim(),"unresolvable club identity");
  identities.set(id,{...club});
 }
 ensure(identities.size===16,"incomplete seasonal club registry");
 if(knownClubIds){
  const known=new Set(knownClubIds);
  ensure(known.size===16&&participants.every(id=>known.has(id)),"club identity catalog mismatch; requires full-season registry integration");
 }
 ensure(Array.isArray(view.events)&&view.events.length===(competitionId.endsWith("-1")?242:245),"incomplete domestic schedule");
 const league=view.events.filter(e=>e.phaseId==="league");
 ensure(league.length===240,"incomplete regular season");
 const days=[...new Set(league.map(e=>e.day))].sort((a,b)=>a-b);
 ensure(days.length===30&&days.every(d=>Number.isInteger(d)&&d>=1&&d<=56),"invalid round calendar");
 const roundByDay=new Map(days.map((d,i)=>[d,i+1]));
 const fixtures=league.map(game=>{
  ensure(participants.includes(game.homeId)&&participants.includes(game.awayId)&&game.homeId!==game.awayId,"fixture club mismatch");
  ensure(game.result===null||Number.isInteger(game.result?.homeGoals)&&Number.isInteger(game.result?.awayGoals)&&game.result.homeGoals>=0&&game.result.awayGoals>=0,"invalid score");
  ensure(game.day<=day||game.result===null,"future result leakage");
  return {round:roundByDay.get(game.day),homeId:game.homeId,awayId:game.awayId,
    homeGoals:game.result?.homeGoals??null,awayGoals:game.result?.awayGoals??null,
    kickoff:null,worldDay:game.day};
 });
 ensure(Array.isArray(view.standings)&&view.standings.length===16&&new Set(view.standings.map(x=>x.clubId)).size===16,"invalid standings");
 ensure(view.standings.every(r=>participants.includes(r.clubId)),"foreign club in standings");
 const results=fixtures.filter(g=>g.homeGoals!==null);
 const expected=results.length*2;
 ensure(view.standings.reduce((n,r)=>n+r.played,0)===expected,"standings/results mismatch");
 const postseason=view.events.filter(e=>e.phaseId!=="league").map(e=>({
  eventId:e.eventId,roundId:e.roundId,day:e.day,homeId:e.homeId,awayId:e.awayId,
  homeGoals:e.result?.homeGoals??null,awayGoals:e.result?.awayGoals??null,
  tiebreak:e.tiebreak??null
 }));
 ensure(postseason.every(e=>e.day<=day||e.homeGoals===null&&e.awayGoals===null),"future postseason leakage");
 return {season,worldDay:day,rulesVersion:null,participants:[...participants],clubs:participants.map(id=>identities.get(id)),fixtures,results,statistics:null,
  status:view.completed?"complete":"partial",standings:view.standings.map(r=>({...r})),postseason};
}
