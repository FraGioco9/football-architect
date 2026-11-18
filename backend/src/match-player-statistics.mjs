/** One read-only projection of already verified immutable match evidence. */
export function frozenMatchPlayerStatistics(result){
 const identities=new Map((result.playerIdentityVersion==='player-identity-v1'?result.playerIdentities:[]).map(p=>[p.playerId,p]));
 const duration=result.extraTime?120:90;
 const side=(team,conceded)=>{
  if(team.kind==='team_fallback')return {kind:team.kind,unattributedGoals:team.unattributedGoals,players:[]};
  const starters=new Map(team.starters.map(p=>[p.playerId,p]));
  return {kind:team.kind,unattributedGoals:0,players:team.appearances.map(p=>{
   const starter=starters.get(p.playerId),identity=identities.get(p.playerId);
   if(!starter)throw TypeError('Unidentified frozen appearance');
   const rating=result.ratingVersion==='test-rating-v1'?p.rating:null;
   return {playerId:p.playerId,name:identity?.name??null,nationality:identity?.nationality??null,
    role:starter.role,started:p.started,minutes:p.minutes,goals:p.goals,
    assists:null,redCards:null,
    cleanSheets:starter.role==='GK'&&p.minutes===duration?(conceded===0?1:0):null,
    rating:typeof rating==='number'?rating:null};
  })};
 };
 return {ratingVersion:result.ratingVersion??null,
  home:side(result.home,result.awayGoals),away:side(result.away,result.homeGoals),
  events:result.events.map(event=>({type:event.type,minute:event.minute,period:event.period,side:event.side,
   playerId:event.playerId,name:identities.get(event.playerId)?.name??null,
   nationality:identities.get(event.playerId)?.nationality??null}))};
}
