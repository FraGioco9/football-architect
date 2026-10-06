/** PLY05.02: explainable non-binding AI recommendation. Never auto-signs. */
import {fail,integer,money,validateContract,validateTerms} from './player-contract.mjs';
import {assessPromise,validatePromise} from './player-contract-promises.mjs';
import {evaluatePersonalityEffects} from './player-personality-effects.mjs';
export function reviewPlayerOffer(contract,terms,{personality=null,promiseRecord=null,morale=50,playingTime=50,clubLevel=50}={}){
 validateContract(contract);validateTerms(terms);
 integer(morale,0,100,'MORALE');integer(playingTime,0,100,'PLAY_TIME');integer(clubLevel,0,100,'CLUB_LEVEL');
 const previous=contract.terms.annualWage,raise=previous===0?(terms.annualWage>0?100:0):(terms.annualWage/previous-1)*100;
 const roleChange=contract.terms.promisedRole===terms.promisedRole?0:terms.promisedRole==='starter'||terms.promisedRole==='leader'?6:-6;
 const termsChange=terms.endSeason-contract.terms.endSeason;
 let score=50+Math.min(20,Math.max(-20,raise*0.24))+roleChange+Math.min(8,Math.max(-8,termsChange*2));
 const reasons=['salary','contract_duration','promised_role'];
 if(personality){const interest=evaluatePersonalityEffects(personality,{morale,playingTime,clubLevel,offeredRaise:Math.max(-100,Math.min(300,raise))});score+=(interest.contractInterest-50)*0.5;reasons.push('personality');}
 if(promiseRecord){validatePromise(promiseRecord);if(promiseRecord.playerId!==contract.playerId)fail('PROMISE_PLAYER');const promise=assessPromise(promiseRecord);if(promise.met===false){score-=10;reasons.push('broken_promise');}else if(promise.met===true){score+=3;reasons.push('fulfilled_promise');}}
 score=Math.max(0,Math.min(100,Math.round(score)));
 return {interestScore:score,advisory:score>=65?'inclined':score<=35?'reluctant':'undecided',reasons};
}
