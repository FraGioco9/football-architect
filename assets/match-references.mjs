/**
 * #577 — Canonical, read-only public match references.
 * Only official published-match contracts may produce references. This module
 * never creates fixtures, results, participant assignments or future outcomes.
 */
const competitionIdPattern=/^(?:(?:IT|ENG|ES|DE|FR|PT|NL|BR)-[12]|int-[12])$/;
const phaseIdPattern=/^[a-z][a-z0-9-]*$/;
export function isPublicMatchId(id){
 return typeof id==='string'&&/^[1-9][0-9]*$/.test(id)&&Number.isSafeInteger(Number(id));
}
export function isCompetitionId(id){
 return typeof id==='string'&&competitionIdPattern.test(id);
}
function isSeason(season){return Number.isSafeInteger(season)&&season>0}
function isDay(day){return Number.isSafeInteger(day)&&day>=1&&day<=56}
function isRound(round){return Number.isSafeInteger(round)&&round>=1&&round<=56}
function entry(matchId,season,competitionId,phaseId,round,day){
 if(!isPublicMatchId(matchId)||!isSeason(season)||!isCompetitionId(competitionId)||
    typeof phaseId!=='string'||!phaseIdPattern.test(phaseId)||
    !isRound(round)||!isDay(day))return null;
 return Object.freeze({matchId,season,competitionId,phaseId,round,day});
}
/** Project the already-validated single match response to identity only. */
export function referenceFromPublicMatch(payload,expectedId){
 if(!payload||payload.schemaVersion!==1||payload.providerId!=='authoritative-world'||
    payload.provenance?.kind!=='authoritative'||
    !isPublicMatchId(payload.matchId)||
    expectedId!==undefined&&payload.matchId!==expectedId)return null;
 return entry(payload.matchId,payload.season,payload.competitionId,
  payload.stageId,payload.round,payload.day);
}
/**
 * Index the canonical GET /api/matches/seasons/:n/competitions/:id response.
 * Objects are frozen; the byMatchId lookup is a null-prototype dictionary.
 * Callers must not derive results/status from a reference.
 */
export function indexPublishedCompetitionMatches(payload){
 if(!payload||payload.schemaVersion!==1||payload.providerId!=='authoritative-world'||
    payload.status!=='published'||payload.provenance?.kind!=='authoritative'||
    !isSeason(payload.season)||!isCompetitionId(payload.competitionId)||
    !Array.isArray(payload.fixtures)||payload.fixtures.length===0)
  throw new TypeError('Unpublished or invalid match collection');
 const references=[],byMatchId=Object.create(null);
 for(const fixture of payload.fixtures){
  const ref=fixture&&entry(fixture.matchId,payload.season,payload.competitionId,
   fixture.phaseId,fixture.round,fixture.day);
  if(!ref||Object.hasOwn(byMatchId,ref.matchId))throw new TypeError('Invalid or duplicate match reference');
  references.push(ref);byMatchId[ref.matchId]=ref;
 }
 return Object.freeze({season:payload.season,competitionId:payload.competitionId,
  references:Object.freeze(references),byMatchId:Object.freeze(byMatchId)});
}
