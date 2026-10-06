/** SIM04: optional authoritative matchday configuration and validated manual plan.
 * A saved manual instruction is executed at the indicated match minute during
 * the SIM01 event stream, never retroactively over a completed result.
 */
import {clubPlayers} from './selectors.js';
import {clubMatch} from './selectors.js';
import {medicalAvailability} from '../addons/domain/player-medical.mjs';
import {makeRules} from '../addons/domain/matchday.mjs';

export const SIM04_SCHEMA=1;
const fail=reason=>{throw new Error(`SIM04_${reason}`);};
const DEFAULT_BY_TYPE={league:makeRules(),cup:makeRules(),continental:makeRules({extraTimeAdditionalSubstitutions:1,extraTimeAdditionalWindows:1})};
export const substitutionsEnabled=w=>w?.advancedV1?.matchdayV1?.schemaVersion===1&&w.advancedV1.matchdayV1.enabled===true;
export function enableCareerMatchday(w){
 if(w?.advancedV1?.enabled!==true)fail('ADVANCED_REQUIRED');
 if(substitutionsEnabled(w))return w;
 if(w.advancedV1.matchdayV1!==undefined)fail('INVALID_PREVIOUS');
 w.advancedV1.matchdayV1={schemaVersion:SIM04_SCHEMA,enabled:true,rules:structuredClone(DEFAULT_BY_TYPE),plans:[]};
 return w;
}
export const matchKind=m=>m.id?.includes('continental')?'continental':m.id?.includes('cup')?'cup':'league';
export function expectedNextMatch(w){
 const fixture=w.fixtures?.[w.round];return fixture?clubMatch(fixture,w.clubId):null;
}
export function setCareerMatchdayRules(w,{kind='league',maxSubstitutions,maxWindows}){
 if(!substitutionsEnabled(w))fail('INACTIVE');
 if(!Object.hasOwn(DEFAULT_BY_TYPE,kind))fail('KIND');
 const before=w.advancedV1.matchdayV1;
 const next=makeRules({...before.rules[kind],maxSubstitutions,maxWindows});
 if(before.plans.length>next.maxSubstitutions&&kind==='league')fail('PLAN_LIMIT');
 before.rules[kind]=next;return next;
}
export function careerMatchdayBench(w,teamId,starters){
 return clubPlayers(w,teamId).filter(p=>!starters.includes(p.id)&&!p.injury&&medicalAvailability(p.medicalV1).eligible)
 .sort((a,b)=>b.ovr-a.ovr||a.id-b.id).slice(0,12);
}
export function planCareerSubstitution(w,{minute,outgoing,incoming}){
 if(!substitutionsEnabled(w))fail('INACTIVE');
 const match=expectedNextMatch(w);if(!match)fail('NO_MATCH');
 if(!Number.isSafeInteger(minute)||![45,60,75].includes(minute))fail('MINUTE');
 if(!Number.isSafeInteger(outgoing)||!Number.isSafeInteger(incoming)||outgoing===incoming)fail('PLAYERS');
 const starters=w.lineup;const prior=w.advancedV1.matchdayV1.plans;
 const bench=careerMatchdayBench(w,w.clubId,starters);
 if(!starters.includes(outgoing)||!bench.some(p=>p.id===incoming))fail('ELIGIBILITY');
 const from=clubPlayers(w,w.clubId).find(p=>p.id===outgoing),to=bench.find(p=>p.id===incoming);
 if((from.position==='POR')!==(to.position==='POR'))fail('KEEPER');
 if(medicalAvailability(to.medicalV1).minutesLimit<90-minute)fail('MEDICAL_LIMIT');
 if(prior.length>=w.advancedV1.matchdayV1.rules.league.maxSubstitutions)fail('SUB_LIMIT');
 if(prior.some(p=>p.outgoing===outgoing||p.incoming===incoming||p.outgoing===incoming||p.incoming===outgoing))fail('DUPLICATE');
 const next=[...prior,{matchId:match.id,minute,outgoing,incoming}].sort((a,b)=>a.minute-b.minute||a.outgoing-b.outgoing);
 const windows=new Set(next.filter(p=>p.minute!==45).map(p=>p.minute));
 if(windows.size>w.advancedV1.matchdayV1.rules.league.maxWindows)fail('WINDOW_LIMIT');
 w.advancedV1.matchdayV1.plans=next;return next;
}
export function cancelCareerSubstitution(w,index){
 if(!substitutionsEnabled(w))fail('INACTIVE');
 if(!Number.isSafeInteger(index)||index<0||index>=w.advancedV1.matchdayV1.plans.length)fail('INDEX');
 w.advancedV1.matchdayV1.plans.splice(index,1);
}
export function validateCareerMatchday(w){
 if(w?.advancedV1?.matchdayV1===undefined)return true;
 const s=w.advancedV1.matchdayV1;
 if(s?.schemaVersion!==SIM04_SCHEMA||s.enabled!==true||!s.rules||!Array.isArray(s.plans)||s.plans.length>5)return false;
 try{
  for(const kind of Object.keys(DEFAULT_BY_TYPE))makeRules(s.rules[kind]);
  const allIds=new Set(w.players.map(p=>p.id));const seen=new Set();
  for(const p of s.plans){
   if(typeof p.matchId!=='string'||!p.matchId||![45,60,75].includes(p.minute)||!Number.isSafeInteger(p.outgoing)||!Number.isSafeInteger(p.incoming)||!allIds.has(p.outgoing)||!allIds.has(p.incoming)||p.outgoing===p.incoming)return false;
   if(seen.has(p.outgoing)||seen.has(p.incoming))return false;
   seen.add(p.outgoing);seen.add(p.incoming);
  }
  if(s.plans.length>s.rules.league.maxSubstitutions)return false;
  // Importing an edited JSON file must not silently forge participation time.
  for(const fixture of w.fixtures??[])for(const game of fixture.matches??[]){
    const day=game.result?.advancedV1?.matchday;if(!day)continue;
    if(day.schemaVersion!==1||!Array.isArray(day.changes)||!Array.isArray(day.minutes)||day.minutes.length!==2||!day.rules)return false;
    makeRules(day.rules);
    const ids=new Set([game.home,game.away]);
    if(new Set(day.minutes.map(x=>x.teamId)).size!==2||!day.minutes.every(x=>ids.has(x.teamId)))return false;
    for(const side of day.minutes){
      if(!Array.isArray(side.players)||side.players.length<11||side.players.length>35)return false;
      const keys=new Set();let total=0;
      for(const x of side.players){
        if(!Number.isSafeInteger(x.playerId)||keys.has(x.playerId)||!Number.isSafeInteger(x.seconds)||x.seconds<0||x.seconds>5400||
          !Number.isFinite(x.minutes)||Math.abs(x.minutes-x.seconds/60)>0.0001)return false;
        keys.add(x.playerId);total+=x.seconds;
      }
      if(total!==11*5400)return false;
    }
    const perSide=new Map();
    for(const ch of day.changes){
      if(!ids.has(ch.teamId)||!Number.isSafeInteger(ch.out)||!Number.isSafeInteger(ch.in)||![45,60,75].includes(ch.minute)||!['ai','injury','manual'].includes(ch.reason))return false;
      perSide.set(ch.teamId,(perSide.get(ch.teamId)||0)+1);
    }
    if([...perSide.values()].some(x=>x>day.rules.maxSubstitutions))return false;
  }
 }catch{return false;}
 return true;
}
export function clearCareerMatchdayPlans(w){if(substitutionsEnabled(w))w.advancedV1.matchdayV1.plans=[];}
