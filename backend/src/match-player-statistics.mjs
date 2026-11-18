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
 // The public stats contract contains aggregates only. Event provenance stays
 // in the verified immutable receipt and is never serialized in this projection.
 return {ratingVersion:result.ratingVersion??null,
  home:side(result.home,result.awayGoals),away:side(result.away,result.homeGoals)};

}
