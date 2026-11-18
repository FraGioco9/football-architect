/** One read-only projection of already verified immutable match evidence.
 * New event counters come ONLY from frozen v2 receipts; legacy events remain null.
 */
export function frozenMatchPlayerStatistics(result){
 const identities=new Map((result.playerIdentityVersion==='player-identity-v1'?result.playerIdentities:[]).map(p=>[p.playerId,p]));
 const duration=result.extraTime?120:90,hasEvents=result.eventModelVersion==='lineup-events-v1';
 const side=(team,conceded)=>{
  if(team.kind==='team_fallback')return {kind:team.kind,unattributedGoals:team.unattributedGoals,players:[]};
  const starters=new Map(team.starters.map(p=>[p.playerId,p]));
  return {kind:team.kind,unattributedGoals:0,players:team.appearances.map(p=>{
   const starter=starters.get(p.playerId),identity=identities.get(p.playerId);
   if(!starter&&!hasEvents)throw TypeError('Unidentified frozen appearance');
   const role=hasEvents?p.role:starter.role;
   if(typeof role!=='string')throw TypeError('Missing frozen player role');
   const rating=result.ratingVersion==='test-rating-v1'?p.rating:null;
   const fullTimeGk=hasEvents?p.gkMinutes===duration:role==='GK'&&p.minutes===duration;
   return {playerId:p.playerId,name:identity?.name??null,nationality:identity?.nationality??null,
    role,started:p.started,subAppearances:hasEvents?(p.started?0:1):null,
    minutes:p.minutes,goals:p.goals,
    assists:hasEvents?p.assists:null,redCards:hasEvents?p.redCards:null,
    cleanSheets:fullTimeGk?(conceded===0?1:0):null,
    rating:typeof rating==='number'?rating:null};
  })};
 };
 return {eventModelVersion:hasEvents?'lineup-events-v1':null,ratingVersion:result.ratingVersion??null,
  home:side(result.home,result.awayGoals),away:side(result.away,result.homeGoals),
  events:result.events.map(event=>{
   const person=identities.get(event.playerId);
   return {type:event.type,minute:event.minute,period:event.period,side:event.side,
    playerId:event.playerId,name:person?.name??null,nationality:person?.nationality??null,
    ...(hasEvents?{
     ordinal:event.ordinal,goalId:event.goalId??null,
     assistingPlayerId:event.assistingPlayerId??null,
     assistingName:event.assistingPlayerId?identities.get(event.assistingPlayerId)?.name??null:null,
     creation:event.creation??null,reason:event.reason??null,
     fromPlayerId:event.fromPlayerId??null,toPlayerId:event.toPlayerId??null,
     outPlayerId:event.outPlayerId??null,inPlayerId:event.inPlayerId??null,
     fromRole:event.fromRole??null,toRole:event.toRole??null,
     outRole:event.outRole??null,inRole:event.inRole??null
    }: {})};
  })};
}
