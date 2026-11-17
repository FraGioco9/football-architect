/**
 * #605 — stable match-link lookup from published public competition collections.
 * This does NOT infer identity from pairings, game results, ranks or row order.
 * All indexes are scoped to one authoritative competition and season.
 */
import {isPublicMatchId,isCompetitionId} from './match-references.mjs';
const allowedDay=n=>Number.isSafeInteger(n)&&n>=1&&n<=56;
const allowedRound=n=>Number.isSafeInteger(n)&&n>=1&&n<=56;
const slotKey=(phaseId,tieId,leg)=>[phaseId,tieId,leg].join(':');
export function indexPublishedMatchLinks(payload,season,competitionId){
 if(!Number.isSafeInteger(season)||season<=0||!isCompetitionId(competitionId)||
    payload?.schemaVersion!==1||payload.providerId!=='authoritative-world'||
    payload.status!=='published'||payload.provenance?.kind!=='authoritative'||
    payload.season!==season||payload.competitionId!==competitionId||
    !Array.isArray(payload.fixtures)||!payload.fixtures.length)
   throw new TypeError('Invalid or unpublished match-link scope');
 const bySource=Object.create(null),bySlot=Object.create(null),byId=Object.create(null);
 for(const f of payload.fixtures){
  if(!f||!isPublicMatchId(f.matchId)||Object.hasOwn(byId,f.matchId)||
     typeof f.phaseId!=='string'||!/^[a-z][a-zA-Z0-9-]*$/.test(f.phaseId)||
     typeof f.marker!=='string'||!f.marker||!allowedDay(f.day)||
     !(f.round===null||allowedRound(f.round)))
    throw new TypeError('Invalid published match-link record');
  const record=Object.freeze({matchId:f.matchId,season,competitionId,phaseId:f.phaseId,
    marker:f.marker,day:f.day,round:f.round,
    tieId:f.phaseId==='league'?null:f.tieId,leg:f.phaseId==='league'?null:f.leg});
  if(f.phaseId==='league'){
   if(typeof f.sourceFixtureId!=='string'||!f.sourceFixtureId.startsWith('season:'+season+':'+competitionId+':')||
      !allowedRound(f.round)||f.tieId!==undefined&&f.tieId!==null||f.leg!==undefined&&f.leg!==null||
      Object.hasOwn(bySource,f.sourceFixtureId))throw new TypeError('Invalid published league identity');
   bySource[f.sourceFixtureId]=record;
  }else{
   if(f.sourceFixtureId!==null||typeof f.tieId!=='string'||!f.tieId||
      !Number.isSafeInteger(f.leg)||f.leg<1||f.leg>2)
    throw new TypeError('Invalid published knockout identity');
   const key=slotKey(f.phaseId,f.tieId,f.leg);
   if(Object.hasOwn(bySlot,key))throw new TypeError('Duplicate published knockout slot');
   bySlot[key]=record;
  }
  byId[f.matchId]=record;
 }
 return Object.freeze({season,competitionId,bySource:Object.freeze(bySource),
   bySlot:Object.freeze(bySlot),byId:Object.freeze(byId)});
}
/** Resolve an existing verified fixture without constructing any new match identity. */
export function matchIdForFixture(row,index){
 if(!row||!index||row.season!==index.season||row.competitionId!==index.competitionId||
    typeof row.phaseId!=='string'||!allowedDay(row.day))return null;
 let candidate;
 if(row.phaseId==='league'){
   if(typeof row.sourceFixtureId!=='string')return null;
   candidate=index.bySource[row.sourceFixtureId];
 }else{
   if(typeof row.tieId!=='string'||!Number.isSafeInteger(row.leg))return null;
   candidate=index.bySlot[slotKey(row.phaseId,row.tieId,row.leg)];
 }
 if(!candidate||candidate.phaseId!==row.phaseId||candidate.day!==row.day||
    typeof row.marker==='string'&&row.marker!==candidate.marker||
    row.phaseId==='league'&&row.round!==candidate.round)return null;
 return candidate.matchId;
}
