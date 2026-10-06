/** PLY05.03: auditable promises, without mutating official morale/personality. */
import {clone,fail,identifier,integer,object,CONTRACT_ROLES,validateContract} from './player-contract.mjs';
import {evaluatePersonalityEffects} from './player-personality-effects.mjs';
const thresholds=Object.freeze({starter:0.60,rotation:0.30,prospect:0.10,leader:0.35});
export function initialPromiseRecord(contract){
 validateContract(contract);
 return {schemaVersion:1,playerId:contract.playerId,promisedRole:contract.terms.promisedRole,eligibleMatches:0,starts:0,minutes:0,captainMatches:0,seenMatches:[],events:[]};
}
export function validatePromise(record){
 if(!object(record)||record.schemaVersion!==1||!identifier(record.playerId)||!CONTRACT_ROLES.includes(record.promisedRole))fail('PROMISE');
 for(const x of ['eligibleMatches','starts','minutes','captainMatches'])integer(record[x],0,1000000,'PROMISE_COUNT');
 if(record.starts>record.eligibleMatches||record.captainMatches>record.starts||record.minutes>record.eligibleMatches*130)fail('PROMISE_COUNTS');
 if(!Array.isArray(record.seenMatches)||record.seenMatches.length!==record.eligibleMatches||new Set(record.seenMatches).size!==record.seenMatches.length||record.seenMatches.some(x=>!identifier(x))||!Array.isArray(record.events))fail('PROMISE_HISTORY');
 return true;
}
/** Eligible means available for selection: match IDs supplied by the caller, not guessed from fixture data. */
export function recordPromiseMatch(record,{matchId,started=false,minutes=0,captain=false}={}){
 validatePromise(record);if(!identifier(matchId)||typeof started!=='boolean'||typeof captain!=='boolean')fail('PROMISE_MATCH');
 integer(minutes,0,130,'PROMISE_MINUTES');if(!started&&captain||captain&&minutes===0||started&&minutes===0)fail('PROMISE_START');
 const key=String(matchId);if(record.seenMatches.includes(key))fail('PROMISE_DUPLICATE_MATCH');
 const out=clone(record);out.eligibleMatches++;out.starts+=Number(started);out.minutes+=minutes;out.captainMatches+=Number(captain);out.seenMatches.push(key);
 out.events.push({matchId:key,started,minutes,captain});validatePromise(out);return out;
}
export function assessPromise(record,{personality=null,morale=50,playingTime=50,clubLevel=50}={}){
 validatePromise(record);
 const sample=record.eligibleMatches,ratio=sample?record.starts/sample:0,needed=thresholds[record.promisedRole];
 const leaderShare=record.starts?record.captainMatches/record.starts:0;
 const met=sample<5?null:record.promisedRole==='leader'?ratio>=needed&&leaderShare>=0.4:ratio>=needed;
 let modifier=met===null?0:met?5:-12;
 let reasons=met===null?['insufficient_sample']:met?['promise_met']:['promise_broken'];
 if(met===false&&record.promisedRole==='leader'&&leaderShare<0.4)reasons=[...reasons,'captaincy'];
 // Personality contributes to willingness to renew but never rewrites hidden traits or legacy morale.
 const interest=personality?evaluatePersonalityEffects(personality,{morale,playingTime,clubLevel}).contractInterest:null;
 const willingness=interest===null?null:Math.max(0,Math.min(100,Math.round(interest+modifier)));
 return {playerId:record.playerId,promisedRole:record.promisedRole,eligibleMatches:sample,starts:record.starts,startsShare:Math.round(ratio*1000)/1000,captainShare:Math.round(leaderShare*1000)/1000,met,moraleDelta:modifier===5?2:modifier===-12?-4:0,renewalInterest:willingness,reasons};
}
