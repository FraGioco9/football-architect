/** #719 — one immutable Player of the Match award per new official result.
 * Existing unversioned receipts are never re-evaluated on a public read.
 */
export const MATCH_MVP_VERSION='match-mvp-v1';
const validId=id=>Number.isSafeInteger(id)&&id>0;
const validRating=rating=>typeof rating==='number'&&Number.isFinite(rating)&&rating>=4&&rating<=10&&Math.abs(rating*10-Math.round(rating*10))<1e-9;
const fail=()=>{throw new TypeError('Invalid frozen match MVP evidence')};
function candidates(result){
 if(result?.ratingVersion!=='test-rating-v1')return [];
 const players=[],seen=new Set();
 for(const side of ['home','away']){
  const team=result[side];
  if(!team||!['real_xi','team_fallback'].includes(team.kind))fail();
  if(team.kind==='team_fallback')continue;
  const clubId=side==='home'?result.homeClubId:result.awayClubId;
  if(typeof clubId!=='string'||!clubId||!Array.isArray(team.appearances))fail();
  for(const p of team.appearances){
   if(!validId(p?.playerId)||seen.has(p.playerId))fail();
   seen.add(p.playerId);
   if(!Number.isSafeInteger(p.minutes)||p.minutes<1||p.minutes>120||
      !Number.isSafeInteger(p.goals)||p.goals<0)fail();
   if(!validRating(p.rating))continue;
   players.push({playerId:p.playerId,clubId,side,rating:p.rating,
    minutes:p.minutes,goals:p.goals,assists:p.assists});
  }
 }
 return players;
}
export function deriveMatchMvpV1(result){
 const eligible=candidates(result);
 if(!eligible.length)return {status:'none'};
 // Assists count in tie-break only when every rated candidate has recorded
 // assists, avoiding non-transitive comparisons from incomplete evidence.
 const completeAssists=eligible.every(p=>Number.isSafeInteger(p.assists)&&p.assists>=0);
 eligible.sort((a,b)=>b.rating-a.rating||b.minutes-a.minutes||b.goals-a.goals||
  (completeAssists?b.assists-a.assists:0)||a.playerId-b.playerId);
 const {playerId,clubId,side,rating}=eligible[0];
 return {status:'awarded',playerId,clubId,side,rating};
}
export function sealMatchMvpV1(result){
 if(!result||typeof result!=='object'||Object.hasOwn(result,'mvp')||Object.hasOwn(result,'mvpVersion'))fail();
 result.mvpVersion=MATCH_MVP_VERSION;
 result.mvp=deriveMatchMvpV1(result);
 return result;
}
export function validateMatchMvpV1(result){
 if(result?.mvpVersion===undefined&&result?.mvp===undefined)return;
 if(result?.mvpVersion!==MATCH_MVP_VERSION||!result.mvp||
    typeof result.mvp!=='object'||Array.isArray(result.mvp)||result.ratingVersion!=='test-rating-v1')fail();
 const expected=deriveMatchMvpV1(result),actual=result.mvp;
 const expectedKeys=Object.keys(expected).sort(),actualKeys=Object.keys(actual).sort();
 if(JSON.stringify(expectedKeys)!==JSON.stringify(actualKeys)||
    expectedKeys.some(key=>actual[key]!==expected[key]))fail();
}
/** Missing historical proof is unavailable, not an official no-award state. */
export function frozenMatchMvpV1(result){
 if(result?.mvpVersion===undefined&&result?.mvp===undefined)return {status:'unavailable'};
 validateMatchMvpV1(result);
 return result.mvp;
}
