/** #613 replacement-only daily evidence: do not recalculate frozen player results.
 * One version, one lineage, no score-only legacy adapter. No database effects.
 */
import {validateRecordedMatchTimelineV1} from './match-event-validation-v1.mjs';
export const LINEUP_DAY_VERSION='temporary-lineup-v1';
const invalid=reason=>{throw new TypeError('Invalid lineup day evidence: '+reason)};
const hashPattern=/^[a-f0-9]{64}$/;
const uuidPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const idPattern=/^season:[1-9][0-9]*:(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12]):[a-zA-Z0-9_-]+:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[1-9][0-9]*:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[1-9][0-9]*$/;
const validNumber=value=>Number.isSafeInteger(value)&&value>0;
function canonical(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
}
async function sha256(text){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
function checkHeader({generation,season,day,calendarHash}){
 if(!uuidPattern.test(generation)||!validNumber(season)||!Number.isInteger(day)||day<1||day>56||
  !hashPattern.test(calendarHash))invalid('source header');
}
function sourceFixtures(dueFixtures){
 if(!Array.isArray(dueFixtures))invalid('due fixtures');
 const byId=new Map(),matchIds=new Set();
 for(const fixture of dueFixtures){
  if(!fixture||!validNumber(fixture.matchId)||typeof fixture.fixtureId!=='string'||
   !idPattern.test(fixture.fixtureId)||byId.has(fixture.fixtureId)||matchIds.has(fixture.matchId))
   invalid('duplicate or invalid due fixture');
  byId.set(fixture.fixtureId,fixture.matchId);matchIds.add(fixture.matchId);
 }
 return byId;
}
function checkScorers(side,events,goals,sideName,v2){
 if(!side||!Array.isArray(side.appearances)||!Number.isSafeInteger(side.unattributedGoals)||
  side.unattributedGoals<0||!['team_fallback','real_xi'].includes(side.kind))invalid('side evidence');
 const records=events.filter(e=>e.side===sideName&&e.type==='goal');
 if(records.length+side.unattributedGoals!==goals)invalid('goal reconciliation');
 if(side.kind==='team_fallback'){
  if(side.starters!==null||side.appearances.length||side.unattributedGoals!==goals||records.length)
   invalid('fallback attribution');
 }else if(v2){
  if(!Array.isArray(side.starters)||side.starters.length!==11||
   side.unattributedGoals!==0||side.appearances.filter(p=>p.started===true).length!==11||
   side.appearances.some(p=>p.goals!==records.filter(e=>e.playerId===p.playerId).length))
   invalid('v2 XI attribution');
 }else{
  const ids=side.appearances.map(p=>p.playerId);
  if(side.unattributedGoals!==0||!Array.isArray(side.starters)||side.starters.length!==11||
   side.appearances.length!==11||new Set(ids).size!==11||
   side.starters.some(p=>!ids.includes(p.playerId))||
   side.appearances.some(p=>!validNumber(p.playerId)||p.started!==true||
    p.goals!==records.filter(e=>e.playerId===p.playerId).length))
   invalid('XI attribution');
 }
}
function summary(entry,expectedMatchId,generation,season,day){
 if(!entry||!hashPattern.test(entry.receiptHash)||!entry.receipt||
  ![1,2].includes(entry.receipt.schemaVersion)||entry.receipt.authority!=='official'||
  entry.receipt.algorithmVersion!==LINEUP_DAY_VERSION||
  !hashPattern.test(entry.receipt.rosterSourceDigest)||!hashPattern.test(entry.receipt.sourceCandidateDigest))
  invalid('receipt envelope');
 const {fixture,result}=entry.receipt;
 if(!fixture||fixture.matchId!==expectedMatchId||fixture.generation!==generation||
  fixture.season!==season||fixture.day!==day||fixture.fixtureId!==entry.fixtureId||
  !hashPattern.test(fixture.sourceHash)||!result||
  result.matchKey!==fixture.fixtureId||result.homeClubId!==fixture.homeClubId||
  result.awayClubId!==fixture.awayClubId||result.algorithmVersion!==LINEUP_DAY_VERSION)
  invalid('fixture provenance');
 if(!Number.isSafeInteger(result.homeGoals)||result.homeGoals<0||
  !Number.isSafeInteger(result.awayGoals)||result.awayGoals<0||
  !['regulation','extra-time','penalties'].includes(result.resolution)||
  !Array.isArray(result.events)||!result.regulation||
  !Number.isSafeInteger(result.regulation.home)||!Number.isSafeInteger(result.regulation.away)||
  result.homeGoals!==result.regulation.home+(result.extraTime?.home??0)||
  result.awayGoals!==result.regulation.away+(result.extraTime?.away??0))
  invalid('score evidence');
 const v2=entry.receipt.schemaVersion===2;
 if(v2){try{validateRecordedMatchTimelineV1(result)}catch{invalid('v2 event projection')}}
 for(const event of result.events)if(!event||!['goal','pass','yellow','red','substitution','role_change'].includes(event.type)||
  !v2&&event.type!=='goal'||
  !['home','away'].includes(event.side)||!Number.isInteger(event.minute)||
  event.minute<1||event.minute>120)invalid('goal event');
 checkScorers(result.home,result.events,result.homeGoals,'home',v2);
 checkScorers(result.away,result.events,result.awayGoals,'away',v2);
 return {fixtureId:fixture.fixtureId,matchId:fixture.matchId,
  homeClubId:fixture.homeClubId,awayClubId:fixture.awayClubId,
  homeGoals:result.homeGoals,awayGoals:result.awayGoals,
  winnerClubId:result.winnerClubId,resolution:result.resolution,
  extraTime:result.extraTime??null,penalties:result.penalties??null,
  receiptHash:entry.receiptHash};
}
/** Trusted dueFixtures MUST be derived from the canonical progression, never an HTTP list.
 * receipts are freshly built authoritative candidates, or reads of frozen D1 rows.
 * This pure function does not grant permission to publish or advance a world day.
 */
export async function buildLineupDayEvidenceV2({
 generation,season,day,calendarHash,dueFixtures,receipts
}){
 checkHeader({generation,season,day,calendarHash});
 const expected=sourceFixtures(dueFixtures);
 if(!Array.isArray(receipts)||receipts.length!==expected.size)invalid('due fixture count');
 const found=new Set(),results=[];
 for(const entry of receipts){
  if(!entry||typeof entry.fixtureId!=='string'||!expected.has(entry.fixtureId)||
   found.has(entry.fixtureId))invalid('unexpected or duplicate receipt');
  found.add(entry.fixtureId);
  if(await sha256(JSON.stringify(entry.receipt))!==entry.receiptHash)
   invalid('receipt fingerprint');
  results.push(summary(entry,expected.get(entry.fixtureId),generation,season,day));
 }
 results.sort((a,b)=>a.matchId-b.matchId);
 const payload={schemaVersion:2,season,generation,day,calendarHash,
  simulationVersion:LINEUP_DAY_VERSION,results};
 return {payload,hash:await sha256(canonical(payload))};
}
/** Historical replay verifies frozen receipts, not the current roster or a new simulation. */
export async function verifyLineupDayEvidenceV2({payload,hash,dueFixtures,receipts}){
 if(!payload||payload.schemaVersion!==2||payload.simulationVersion!==LINEUP_DAY_VERSION||
  !hashPattern.test(hash)||!Array.isArray(payload.results))invalid('stored payload');
 const expected=await buildLineupDayEvidenceV2({
  generation:payload.generation,season:payload.season,day:payload.day,
  calendarHash:payload.calendarHash,dueFixtures,receipts
 });
 if(expected.hash!==hash||canonical(expected.payload)!==canonical(payload))
  invalid('stored day digest or results');
 return expected;
}
