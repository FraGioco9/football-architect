/** Football Architect PLY05.01/05: pure, opt-in contract schema. Amounts are integer EUR.
 * Season is a positive logical career season (no device clock). Contracts run THROUGH endSeason.
 */
export const CONTRACT_SCHEMA_VERSION=1;
export const CONTRACT_ROLES=Object.freeze(['starter','rotation','prospect','leader']);
export const CONTRACT_MAX_AMOUNT=1_000_000_000;
export const fail=code=>{throw new Error(`PLY05_${code}`);};
export const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export const identifier=x=>typeof x==='string'&&x.trim()!==''&&!['__proto__','prototype','constructor','toString','valueOf','hasOwnProperty'].includes(x)||Number.isSafeInteger(x)&&x>0;
export const clone=x=>structuredClone(x);
export const integer=(v,min,max,code)=>{if(!Number.isSafeInteger(v)||v<min||v>max)fail(code);return v;};
export function money(v,name='MONEY'){return integer(v,0,CONTRACT_MAX_AMOUNT,name);}
export function validateTerms(terms){
 if(!object(terms))fail('TERMS');
 integer(terms.startSeason,1,9999,'START_SEASON');integer(terms.endSeason,terms.startSeason,Math.min(9999,terms.startSeason+9),'END_SEASON');
 money(terms.annualWage,'WAGE');if(!object(terms.bonuses))fail('BONUSES');
 for(const k of ['signing','appearance','goal'])money(terms.bonuses[k],`BONUS_${k.toUpperCase()}`);
 if(!CONTRACT_ROLES.includes(terms.promisedRole))fail('ROLE');
 if(!object(terms.clauses))fail('CLAUSES');
 for(const k of ['releaseFee','extensionOptionSeason'])if(terms.clauses[k]!==null){
  if(k==='releaseFee')money(terms.clauses[k],'RELEASE_FEE');
  else integer(terms.clauses[k],terms.startSeason,terms.endSeason,'OPTION');
 }
 return true;
}
export function makeTerms({startSeason,endSeason,years,annualWage,bonuses={},promisedRole='rotation',clauses={}}){
 integer(startSeason,1,9999,'START_SEASON');
 if(!object(bonuses)||!object(clauses))fail('TERMS');
 if(years!==undefined)integer(years,1,10,'YEARS');
 const effectiveEnd=endSeason??(startSeason+(years??1)-1);
 const data={startSeason,endSeason:effectiveEnd,annualWage,bonuses:{signing:bonuses.signing??0,appearance:bonuses.appearance??0,goal:bonuses.goal??0},promisedRole,clauses:{releaseFee:clauses.releaseFee??null,extensionOptionSeason:clauses.extensionOptionSeason??null}};
 validateTerms(data);if(years!==undefined&&effectiveEnd!==startSeason+years-1)fail('YEARS_MISMATCH');return data;
}
export function validateContract(record){
 if(!object(record)||record.schemaVersion!==1||!identifier(record.playerId)||!identifier(record.clubId))fail('CONTRACT');
 validateTerms(record.terms);integer(record.revision,0,1000000,'REVISION');
 if(!Array.isArray(record.history)||record.history.some(e=>!object(e)||!identifier(e.id)||typeof e.type!=='string'))fail('HISTORY');
 return true;
}
export function makeContract({playerId,clubId,terms,history=[],revision=0}){
 const result={schemaVersion:1,playerId:String(playerId),clubId:String(clubId),terms:clone(terms),revision,history:clone(history)};
 validateContract(result);return result;
}
/** Legacy projection is lazy: no mutation, no automatic schema migration. Existing future schemas fail closed. */
export function fromLegacyContract(player,{season=1,clubId}={}){
 if(!object(player)||!identifier(player.id)||!identifier(clubId??player.clubId))fail('LEGACY_PLAYER');
 integer(season,1,9999,'SEASON');
 if(player.contractV1!=null){validateContract(player.contractV1);if(String(player.id)!==player.contractV1.playerId)fail('PLAYER_MISMATCH');return clone(player.contractV1);}
 const wage=player.wage??player.salary??0;
 // Legacy sources may encode years as `contractYears` or as a remaining `contract` integer.
 const years=player.contractYears??(Number.isInteger(player.contract)?player.contract:undefined)??1;
 const role=player.promisedRole&&CONTRACT_ROLES.includes(player.promisedRole)?player.promisedRole:'rotation';
 return makeContract({playerId:player.id,clubId:clubId??player.clubId,terms:makeTerms({startSeason:season,years,annualWage:wage,promisedRole:role})});
}
export function contractTermSummary(contract,season){validateContract(contract);integer(season,1,9999,'SEASON');return {remainingSeasons:Math.max(0,contract.terms.endSeason-season+1),expiresThisSeason:contract.terms.endSeason===season,expired:contract.terms.endSeason<season};}
