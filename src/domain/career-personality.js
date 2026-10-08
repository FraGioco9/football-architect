/** PLYR-06.2 — official morale is authoritative; dynamics reflect it.
 * Mutation is performed inside existing career transactions/checkpoints.
 * Activation policy and gameplay balancing are deferred to PLYR-06.3.
 */
import {clubPlayers} from './selectors.js';
import {toAddonPosition} from '../addons/career-bridge.mjs';
import {addMessage} from './history.js';
import {generatePersonality,readPersonality,validatePersonality,TRAITS} from '../addons/domain/player-personality.mjs';
import {initialPlayerDynamics,applyPlayerEvent,validateDynamics,inspectLockerRoom,playerInfluence} from '../addons/domain/player-locker-room.mjs';
import {evaluatePersonalityEffects,matchPerformanceFactor,PERSONALITY_EVENTS} from '../addons/domain/player-personality-effects.mjs';
import {scoutPersonality,emptyTraitEvidence,advanceTraitEvidence,validateTraitEvidence} from '../addons/domain/player-personality-scouting.mjs';

const fail=code=>{throw Error(`PLY02_${code}`);};
const cap=(n,low,high)=>Math.max(low,Math.min(high,n));
const state=w=>w?.advancedV1?.personalityV1;
export const personalityEnabled=w=>w?.advancedV1?.enabled===true&&state(w)?.schemaVersion===2&&state(w).enabled===true;
const own=w=>clubPlayers(w,w.clubId);
const identity=p=>p.globalId??p.id;
const origin=(w,p)=>p.globalId?.split(':')[0]??(typeof p.id==='string'&&p.id.includes(':')?p.id.split(':')[0]:w.countryId);
const stableProfile=(w,p)=>readPersonality({...p,id:identity(p)},{seed:w.seed,countryId:origin(w,p)});
const coachKey=w=>`${w.countryId}:${w.clubId}:${String(w.manager??'')}`;
const matchKey=(w,id)=>`fixture:${w.countryId}:${w.season}:${String(id)}`;
const exactMorale=p=>Number.isFinite(p.morale)?cap(Math.round(p.morale*100)/100,0,100):50;
function enroll(w,p){
 const s=state(w),id=String(p.id);
 if(!p.personalityProfile)p.personalityProfile=generatePersonality({...p,id:identity(p)},{seed:w.seed,countryId:origin(w,p)});
 let st=s.playerStates[id];
 if(!st){
  st={...initialPlayerDynamics({...p,position:toAddonPosition(p.position)},{seed:w.seed,countryId:origin(w,p)}),traitEvidence:emptyTraitEvidence()};
  s.playerStates[id]=st;
 }else{
  if(!st.traitEvidence){st={...st,traitEvidence:emptyTraitEvidence(),revision:st.revision+1};s.playerStates[id]=st;}
  else validateTraitEvidence(st.traitEvidence);
  const morale=exactMorale(p),influence=playerInfluence(p,stableProfile(w,p));
  if(st.morale!==morale||st.influence!==influence){st={...st,morale,influence,revision:st.revision+1};s.playerStates[id]=st;}
 }
 return s.playerStates[id];
}
export function enableCareerPersonality(w){
 if(!w?.clubId||w.advancedV1?.enabled!==true)fail('REQUIRES_ADVANCED');
 if(personalityEnabled(w))return w;
 if(state(w)!==undefined)fail('UNKNOWN_VERSION');
 w.advancedV1.personalityV1={schemaVersion:2,enabled:true,revision:0,clubId:w.clubId,
  coachKey:coachKey(w),season:w.season,lastDay:w.advancedV1.clockDay,playerStates:{},events:[],processedMatches:[]};
 own(w).forEach(p=>enroll(w,p));
 if(!validateCareerPersonality(w))fail('INIT_INVALID');
 return w;
}
/** Sync only; a clock tick does not create morale or trust bonuses. */
export function syncCareerPersonality(w){
 if(!personalityEnabled(w))return false;
 const s=state(w),previousCoach=s.coachKey,nextCoach=coachKey(w);
 const previousWeek=Math.floor(s.lastDay/7),currentWeek=Math.floor(w.advancedV1.clockDay/7);
 let changed=false;
 const managed=own(w),live=new Set(managed.map(p=>String(p.id)));
 for(const id of Object.keys(s.playerStates))if(!live.has(id)){delete s.playerStates[id];changed=true;}
 for(const p of managed){const key=String(p.id),before=s.playerStates[key],st=enroll(w,p);
  if(!before||before!==st)changed=true;
  if(currentWeek>previousWeek){
   let evidence=s.playerStates[key].traitEvidence;
   for(let week=previousWeek+1;week<=currentWeek;week++){
    evidence=advanceTraitEvidence(evidence,{observationId:`club-week:${w.countryId}:${w.clubId}:${identity(p)}:${week}`,count:2});
   }
   s.playerStates[key]={...s.playerStates[key],traitEvidence:evidence,revision:s.playerStates[key].revision+1};
   changed=true;
  }
  if(previousCoach!==nextCoach&&before){
   const reset=applyPlayerEvent(st,stableProfile(w,p),{id:`coach-change:${nextCoach}:${identity(p)}:${w.season}:${w.round}`,type:'coach_change'});
   s.playerStates[key]=reset;changed=changed||reset.revision!==st.revision;
  }
 }
 if(s.clubId!==w.clubId||s.season!==w.season||s.lastDay!==w.advancedV1.clockDay||s.coachKey!==nextCoach)changed=true;
 s.clubId=w.clubId;s.season=w.season;s.lastDay=w.advancedV1.clockDay;s.coachKey=nextCoach;
 if(changed)s.revision++;
 return changed;
}
export function validateCareerPersonality(w){
 const s=state(w);
 if(s===undefined)return true;
 if(!w?.advancedV1?.enabled||s.schemaVersion!==2||s.enabled!==true||!Number.isSafeInteger(s.revision)||s.revision<0||s.clubId!==w.clubId||s.coachKey!==coachKey(w)||s.season!==w.season||s.lastDay!==w.advancedV1.clockDay||!s.playerStates||Array.isArray(s.playerStates)||!Array.isArray(s.events)||s.events.length>80||!Array.isArray(s.processedMatches)||s.processedMatches.length>10000)return false;
 try{
  const owned=new Map(own(w).map(p=>[String(p.id),p]));
  if(new Set(s.processedMatches).size!==s.processedMatches.length||s.processedMatches.some(k=>typeof k!=='string'||!k))return false;
  if(Object.keys(s.playerStates).some(id=>!owned.has(id)))return false;
  for(const p of w.players)if(p.personalityProfile)validatePersonality(p.personalityProfile);
  for(const [id,st] of Object.entries(s.playerStates)){
   validateDynamics(st);if(st.traitEvidence!==undefined)validateTraitEvidence(st.traitEvidence);
   if(st.playerId!==id||st.morale!==exactMorale(owned.get(id)))return false;
  }
  for(const e of s.events)if(!e||!Number.isSafeInteger(e.season)||!Number.isSafeInteger(e.round)||typeof e.playerId!=='string'||typeof e.id!=='string'||typeof e.type!=='string'||!PERSONALITY_EVENTS.includes(e.type)||!Number.isFinite(e.delta))return false;
  return true;
 }catch{return false;}
}
/** Allowlisted, read-only UI DTO. Evidence is per club/observer and per trait.
 * The report must be recorded by this club; caller-controlled confidence is
 * never a substitute for actual scouting evidence.
 */
export function personalityPlayerView(w,p,{lang='it',owned=null}={}){
 if(!personalityEnabled(w))return null;
 const mine=owned??(p.clubId===w.clubId);
 let evidence=emptyTraitEvidence();
 if(mine){
  const st=state(w).playerStates[String(p.id)];
  if(st?.traitEvidence){validateTraitEvidence(st.traitEvidence);evidence=st.traitEvidence;}
 }else{
  const id=String(identity(p)),observer=`${w.countryId}:club:${w.clubId}`;
  const report=w.advancedV1?.scoutingV1?.reports?.[id];
  if(report?.personalityObserver===observer&&report.personalityEvidence){
   validateTraitEvidence(report.personalityEvidence);evidence=report.personalityEvidence;
  }
 }
 return {owned:mine,...scoutPersonality(stableProfile(w,p),{evidence,lang})};
}
/** Symmetric capped modifier on actual selected XI, never the underlying OVR. */
export function personalityMatchMultiplier(w,teamId,playerIds=null){
 if(!personalityEnabled(w))return 1;
 const selected=playerIds??(teamId===w.clubId?w.lineup:null);
 const ids=selected?new Set(selected.map(String)):null;
 const entries=clubPlayers(w,teamId).filter(p=>!ids||ids.has(String(p.id)));
 if(!entries.length)return 1;
 const value=entries.reduce((sum,p)=>sum+matchPerformanceFactor(stableProfile(w,p),{morale:exactMorale(p)}),0)/entries.length;
 return cap(Math.round(value*1000)/1000,.98,1.02);
}
/** Training factor is capped once in developmentContext, not multiplied into workload. */
export function personalityTrainingMultiplier(w,p){
 if(!personalityEnabled(w))return 1;
 return evaluatePersonalityEffects(stableProfile(w,p),{morale:exactMorale(p)}).factors.training;
}
export function personalityBoardShift(w){if(!personalityEnabled(w))return 0;const cohesion=lockerRoomView(w).cohesion;return cohesion>=75?1:cohesion<=35?-1:0;}
/** Shared PLY05/MKT01/MKT04 willingness evaluator, never sent directly to UI. */
export function personalityContractInterest(w,p,{offeredRaise=0,playingTime=null,clubLevel=50,international=false}={}){
 if(!personalityEnabled(w))return null;
 const participation=playingTime??cap(Math.round((p.apps??0)/Math.max(1,w.round)*100),0,100);
 return evaluatePersonalityEffects(stableProfile(w,p),{morale:exactMorale(p),offeredRaise,
  playingTime:participation,clubLevel:cap(Math.round(clubLevel),0,100),international}).contractInterest;
}
/** Apply a uniquely identified decision event exactly once; never leak a raw trait. */
export function recordCareerPersonalityEvent(w,{playerId,eventId,type,importance=1}={}){
 if(!personalityEnabled(w))return false;
 if(typeof eventId!=='string'||!eventId||eventId.length>256||!PERSONALITY_EVENTS.includes(type)||['coach_change','contract_promise'].includes(type))fail('EVENT');
 syncCareerPersonality(w);
 const p=own(w).find(x=>String(x.id)===String(playerId));if(!p)fail('PLAYER');
 const s=state(w),key=String(p.id),before=s.playerStates[key];
 const after=applyPlayerEvent(before,stableProfile(w,p),{id:eventId,type,importance});
 if(after.revision===before.revision)return false;
 if(['played','bench','training','coach_praise','coach_criticism'].includes(type)){
  after.traitEvidence=advanceTraitEvidence(after.traitEvidence??emptyTraitEvidence(),
   {observationId:`club-event:${eventId}:${type}`,count:type==='played'?2:1});
 }
 s.playerStates[key]=after;p.morale=after.morale;
 s.events.push({id:eventId,season:w.season,round:w.round,playerId:key,type,delta:after.morale-before.morale});
 s.events=s.events.slice(-80);s.revision++;return true;
}
/** Existing contract promise settles through the same authoritative writer. */
export function applyCareerMoraleAdjustment(w,{playerId,eventId,delta}={}){
 if(!personalityEnabled(w))return false;
 if(typeof eventId!=='string'||!eventId||eventId.length>256)fail('EVENT_ID');
 syncCareerPersonality(w);
 const p=own(w).find(x=>String(x.id)===String(playerId));if(!p)fail('PLAYER');
 const s=state(w),key=String(p.id),before=s.playerStates[key];
 const after=applyPlayerEvent(before,stableProfile(w,p),{id:eventId,type:'contract_promise',moraleDelta:delta});
 if(after.revision===before.revision)return false;
 s.playerStates[key]=after;p.morale=after.morale;
 s.events.push({id:eventId,season:w.season,round:w.round,playerId:key,type:'contract_promise',delta:after.morale-before.morale});
 s.events=s.events.slice(-80);s.revision++;return true;
}
/** Round settlement is keyed by the real fixture id, not only round number. */
export function settleCareerPersonalityRound(w,{result,playedIds=[],matchId=null}={}){
 if(!personalityEnabled(w))return false;
 if(!['win','draw','loss'].includes(result)||!Array.isArray(playedIds))fail('ROUND');
 const key=matchKey(w,matchId??w.lastMatchId??w.round),s=state(w);
 if(s.processedMatches.includes(key))return false;
 if(s.processedMatches.length>=10000)fail('MATCH_CAP');
 syncCareerPersonality(w);
 let biggest=null,changed=false;
 const playing=new Set(playedIds.map(String));
 for(const p of own(w)){
  const id=String(p.id),baseline=state(w).playerStates[id];
  const occurrence=id+':'+String(identity(p));
  const outcome=result==='draw'?null:result,participation=playing.has(id)?'played':'bench';
  if(outcome)recordCareerPersonalityEvent(w,{playerId:id,eventId:`${key}:${occurrence}:${outcome}`,type:outcome,importance:.75});
  recordCareerPersonalityEvent(w,{playerId:id,eventId:`${key}:${occurrence}:${participation}`,type:participation,importance:.5});
  const delta=Math.round((p.morale-baseline.morale)*100)/100;
  if(!biggest||Math.abs(delta)>Math.abs(biggest.delta))biggest={delta,name:p.name};
  changed=true;
 }
 s.processedMatches.push(key);s.events=s.events.slice(-80);s.revision++;
 if(changed&&biggest&&w.round%4===0)addMessage(w,'Relazioni nello spogliatoio',`${biggest.name}: variazione del morale ${biggest.delta}.`,'training',{type:'personality.weekly',params:{player:biggest.name,change:Math.round(biggest.delta)}});
 return true;
}
export function settleCareerPersonalitySeason(w){
 if(!personalityEnabled(w))return;
 syncCareerPersonality(w);
 // The official seasonal morale reset is already applied by career.js.
 // Never add another seasonal morale or relation modifier here.
}
export function lockerRoomView(w){
 if(!personalityEnabled(w))return null;
 const players=own(w).map(p=>({...p,position:toAddonPosition(p.position)}));
 return inspectLockerRoom(players,{states:state(w).playerStates,seed:w.seed,countryId:w.countryId});
}
