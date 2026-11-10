// QA-16: one public club overview read, validated against the shared world.
// All memberships come from one server-verified season snapshot; no speculative
// division, qualification, opponent, score, or DEV data is accepted.
import {validPublicWorld} from './authoritative-season.mjs';

const clubPattern=/^(IT|ENG|ES|DE|FR|PT|NL|BR)-([1-9]|[1-3][0-9]|40)$/;
const isObject=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const sameWorld=(a,b)=>['generation','revision','seasonNumber','day','phase'].every(k=>a?.[k]===b?.[k]);
const names=Object.freeze({'int-1':'Sovereign Cup','int-2':'Federation Cup'});

export function competitionIdsForClub(clubKey){
 const match=clubPattern.exec(clubKey||'');
 if(!match)throw TypeError('Invalid club key');
 return Object.freeze([match[1]+'-1',match[1]+'-2','int-1','int-2']);
}

export function projectClubMemberships(payload,clubKey,season,world){
 const allowed=competitionIdsForClub(clubKey);
 // Every response, including an unpublished calendar, must refer to the exact
 // authoritative world revision and requested club/season.
 if(!validPublicWorld(world)||!Number.isInteger(season)||season<1||season>world.seasonNumber||
   !isObject(payload)||payload.schemaVersion!==1||payload.providerId!=='authoritative-world'||
   payload.clubKey!==clubKey||payload.selectedSeason!==season||!sameWorld(payload.world,world))
  throw TypeError('Invalid authoritative club overview');
 // A calendar not yet published is an explicit, verified empty state, not an
 // HTTP error or an inactive club. No competition is inferred in this state.
 if(payload.status==='empty'){
  if(!['season-not-prepared','calendar-unpublished'].includes(payload.reason)||
    payload.data!==null||!isObject(payload.provenance)||payload.provenance.kind!=='none'||
    payload.provenance.resultAuthority!==null||payload.provenance.sourceRef!==null)
   throw TypeError('Invalid unpublished club overview');
  return Object.freeze({source:'authoritative',clubKey,season,world,coverage:'unpublished',memberships:Object.freeze([])});
 }
 if(!['partial','available'].includes(payload.status)||payload.reason!==null||
   !isObject(payload.provenance)||payload.provenance.kind!=='authoritative'||
   payload.provenance.resultAuthority!=='temporary-score-v1'||typeof payload.provenance.sourceRef!=='string'||
   !payload.provenance.sourceRef.startsWith('club:'+world.generation+':season:'+season+':')||
   !isObject(payload.data)||payload.data.season!==season||!Array.isArray(payload.data.memberships))
  throw TypeError('Invalid authoritative club overview');
 const memberships=payload.data.memberships;
 const seen=new Set(),out=[];
 let domesticCount=0;
 for(const m of memberships){
  if(!isObject(m)||!allowed.includes(m.competitionId)||seen.has(m.competitionId)||m.season!==season||
    m.category!==(m.competitionId.startsWith('int-')?'international':'domestic')||
    m.position!==null&&(!Number.isSafeInteger(m.position)||m.position<1||m.position>(m.category==='domestic'?16:24))||
    !Number.isSafeInteger(m.points)||m.points<0||m.points>120||
    !(m.cupStatus===null||m.category==='international'&&
      ['groupStage','playoffs','quarterfinals','semifinals','final','winner','runnerUp'].includes(m.cupStatus)))
   throw TypeError('Unverified membership');
  seen.add(m.competitionId);
  if(m.category==='domestic')domesticCount++;
  const next=m.nextMatch;
  if(next!==null&&(!isObject(next)||!Number.isSafeInteger(next.day)||next.day<1||next.day>56||
    next.day<=(season===world.seasonNumber?world.day:56)||
    !Number.isSafeInteger(next.round)||next.round<1||next.round>60||
    !/^(?:league|playout|promotionPlayoffs|playoffs|quarterfinals|semifinals|final)$/.test(next.phaseId)||
    typeof next.homeId!=='string'||typeof next.awayId!=='string'||
    next.homeId===next.awayId||![next.homeId,next.awayId].includes(clubKey)||
    !clubPattern.test(next.homeId)||!clubPattern.test(next.awayId)))
   throw TypeError('Unverified upcoming fixture');
  out.push(Object.freeze({
   competitionId:m.competitionId,category:m.category,season,position:m.position,points:m.points,
   name:names[m.competitionId]||m.competitionId,cupStatus:m.cupStatus,
   nextMatch:next===null?null:Object.freeze({...next})
  }));
 }
 if((out.length>0&&domesticCount!==1)||out.length>2)throw TypeError('Incomplete or duplicate domestic membership');
 return Object.freeze({source:'authoritative',clubKey,season,world,coverage:'complete',memberships:Object.freeze(out)});
}

export async function readClubMemberships({clubKey,world,fetchJson,signal}){
 competitionIdsForClub(clubKey);
 if(!validPublicWorld(world)||typeof fetchJson!=='function')throw TypeError('Invalid canonical club read');
 if(world.seasonNumber===0)
  return Object.freeze({source:'authoritative',clubKey,season:0,world,coverage:'unstarted',memberships:Object.freeze([])});
 const season=world.seasonNumber;
 if(season>2)throw TypeError('Unsupported public season');
 const payload=await fetchJson('/api/clubs/'+clubKey+'/seasons/'+season+'/overview',{signal});
 if(signal?.aborted)throw Error('Club read cancelled');
 return projectClubMemberships(payload,clubKey,season,world);
}
