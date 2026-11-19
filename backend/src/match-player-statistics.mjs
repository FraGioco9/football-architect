/** One read-only projection of already verified immutable match evidence.
 * New event counters come ONLY from frozen v2 receipts; legacy events remain null.
 */
import {frozenMatchMvpV1} from './match-mvp-v1.mjs';

// The temporary-lineup-v1 simulator declares one fixed initial XI:
// GK / RB CB CB LB / CM DM CM / RW ST LW.
// Historic receipts contain these ordered, frozen starting roles rather than
// an explicit formation label. Expose the only proven shape, never infer a
// tactical system from appearances, substitutions or a later role change.
// A future simulator with alternative tactics must record its own versioned
// formation authority instead of interpreting new XI shapes as 4-3-3.
const V1_STARTING_SLOTS=['GK','RB','CB','CB','LB','CM','DM','CM','RW','ST','LW'];
function verifiedStartingFormation(result,team){
 if(result?.algorithmVersion!=='temporary-lineup-v1'||team?.kind!=='real_xi'||
    !Array.isArray(team.starters)||team.starters.length!==V1_STARTING_SLOTS.length||
    !Array.isArray(team.appearances))return null;
 const starters=team.appearances.filter(p=>p?.started===true);
 if(starters.length!==11)return null;
 const confirmedIds=new Set(starters.map(p=>p.playerId));
 if(confirmedIds.size!==11)return null;
 const seen=new Set();
 for(let i=0;i<V1_STARTING_SLOTS.length;i++){
  const p=team.starters[i];
  if(!Number.isSafeInteger(p?.playerId)||p.playerId<1||
     seen.has(p.playerId)||!confirmedIds.has(p.playerId)||
     p.role!==V1_STARTING_SLOTS[i])return null;
  seen.add(p.playerId);
 }
 return '4-3-3';
}

export function frozenMatchPlayerStatistics(result){
 const identities=new Map((result.playerIdentityVersion==='player-identity-v1'?result.playerIdentities:[]).map(p=>[p.playerId,p]));
 const duration=result.extraTime?120:90,hasEvents=result.eventModelVersion==='lineup-events-v1';
 // A booking is counted from its verified frozen yellow event. In particular
 // a second-yellow dismissal contributes TWO yellows plus ONE red.
 // Legacy receipts did not record yellows and must continue to return null.
 const yellowTotals={home:new Map(),away:new Map()};
 if(hasEvents)for(const event of result.events){
  if(event.type!=='yellow')continue;
  const totals=yellowTotals[event.side];
  totals.set(event.playerId,(totals.get(event.playerId)??0)+1);
 }
 const side=(team,conceded,name)=>{
  if(team.kind==='team_fallback')return {kind:team.kind,formation:null,unattributedGoals:team.unattributedGoals,players:[]};
  const starters=new Map(team.starters.map(p=>[p.playerId,p]));
  return {kind:team.kind,formation:verifiedStartingFormation(result,team),unattributedGoals:0,players:team.appearances.map(p=>{
   const starter=starters.get(p.playerId),identity=identities.get(p.playerId);
   if(!starter&&!hasEvents)throw TypeError('Unidentified frozen appearance');
   const role=hasEvents?p.role:starter.role;
   if(typeof role!=='string')throw TypeError('Missing frozen player role');
   const rating=result.ratingVersion==='test-rating-v1'?p.rating:null;
   // Require at least 60 verified minutes playing GK, regardless of the player's
   // natural/initial role. V2 records role-change minutes; legacy only has the
   // frozen starting role and played minutes, so never infer missing GK minutes.
   const eligibleGk=hasEvents
    ?Number.isSafeInteger(p.gkMinutes)&&p.gkMinutes>=60&&p.gkMinutes<=p.minutes
    :role==='GK'&&p.minutes>=60;
   return {playerId:p.playerId,name:identity?.name??null,nationality:identity?.nationality??null,
    role,started:p.started,subAppearances:hasEvents?(p.started?0:1):null,
    minutes:p.minutes,goals:p.goals,
    assists:hasEvents?p.assists:null,
    yellowCards:hasEvents?(yellowTotals[name].get(p.playerId)??0):null,
    redCards:hasEvents?p.redCards:null,
    cleanSheets:eligibleGk?(conceded===0?1:0):null,
    rating:typeof rating==='number'?rating:null};
  })};
 };
 // The public stats contract contains aggregates only. Event provenance stays
 // in the verified immutable receipt and is never serialized in this projection.
 return {mvp:frozenMatchMvpV1(result),ratingVersion:result.ratingVersion??null,
  home:side(result.home,result.awayGoals,'home'),away:side(result.away,result.homeGoals,'away')};

}
