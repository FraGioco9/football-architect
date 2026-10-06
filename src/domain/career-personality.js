/** PLY02: optional, authoritative personality and dressing-room bridge.
 * Mutations are performed only inside the ordinary transactional career clone.
 * An inactive/legacy career has no personality state or gameplay differences.
 */
import {clubPlayers} from './selectors.js';
import {toAddonPosition} from '../addons/career-bridge.mjs';
import {addMessage} from './history.js';
import {generatePersonality,readPersonality,validatePersonality,TRAITS,describeTrait} from '../addons/domain/player-personality.mjs';
import {initialPlayerDynamics,applyPlayerEvent,validateDynamics,inspectLockerRoom} from '../addons/domain/player-locker-room.mjs';
import {evaluatePersonalityEffects,PERSONALITY_EVENTS} from '../addons/domain/player-personality-effects.mjs';
import {scoutPersonality} from '../addons/domain/player-personality-scouting.mjs';

const fail=code=>{throw Error(`PLY02_${code}`);};
const cap=(n,low,high)=>Math.max(low,Math.min(high,n));
const state=w=>w?.advancedV1?.personalityV1;
export const personalityEnabled=w=>w?.advancedV1?.enabled===true&&state(w)?.schemaVersion===1&&state(w).enabled===true;
const own=w=>clubPlayers(w,w.clubId);
const identity=p=>p.globalId??p.id;
const origin=(w,p)=>p.globalId?.split(':')[0]??(typeof p.id==='string'&&p.id.includes(':')?p.id.split(':')[0]:w.countryId);
const stableProfile=(w,p)=>readPersonality({...p,id:identity(p)},{seed:w.seed,countryId:origin(w,p)});
function enroll(w,p){
  const s=state(w),id=String(p.id);
  if(!p.personalityProfile)p.personalityProfile=generatePersonality({...p,id:identity(p)},{seed:w.seed,countryId:origin(w,p)});
  if(!s.playerStates[id])s.playerStates[id]=initialPlayerDynamics({...p,position:toAddonPosition(p.position)},{seed:w.seed,countryId:w.countryId});
  return s.playerStates[id];
}
/** This opt-in initializes only the managed squad; newly acquired youth and transfers enroll lazily. */
export function enableCareerPersonality(w){
  if(!w?.clubId||w.advancedV1?.enabled!==true)fail('REQUIRES_ADVANCED');
  if(personalityEnabled(w))return w;
  if(state(w)!==undefined)fail('UNKNOWN_VERSION');
  w.advancedV1.personalityV1={schemaVersion:1,enabled:true,revision:0,clubId:w.clubId,season:w.season,lastDay:w.advancedV1.clockDay,playerStates:{},events:[]};
  own(w).forEach(p=>enroll(w,p));
  if(!validateCareerPersonality(w))fail('INIT_INVALID');
  return w;
}
/** Reconcile club appointments and incoming players without changing their personality. */
export function syncCareerPersonality(w){
  if(!personalityEnabled(w))return;
  const s=state(w);s.clubId=w.clubId;s.season=w.season;s.lastDay=w.advancedV1.clockDay;
  const live=new Set(w.players.map(p=>String(p.id)));
  for(const id of Object.keys(s.playerStates))if(!live.has(id))delete s.playerStates[id];
  for(const p of own(w))enroll(w,p);
}
export function validateCareerPersonality(w){
  const s=state(w);
  if(s===undefined)return true;
  if(!w?.advancedV1?.enabled||s.schemaVersion!==1||s.enabled!==true||!Number.isSafeInteger(s.revision)||s.revision<0||s.clubId!==w.clubId||s.season!==w.season||s.lastDay!==w.advancedV1.clockDay||!s.playerStates||Array.isArray(s.playerStates)||!Array.isArray(s.events)||s.events.length>80)return false;
  try{
    const ids=new Set(w.players.map(p=>String(p.id)));
    if(Object.keys(s.playerStates).length>w.players.length||Object.keys(s.playerStates).some(id=>!ids.has(id)))return false;
    for(const p of w.players)if(p.personalityProfile)validatePersonality(p.personalityProfile);
    for(const [id,st] of Object.entries(s.playerStates)){
      validateDynamics(st);if(st.playerId!==id)return false;
    }
    for(const e of s.events)if(!e||!Number.isSafeInteger(e.season)||!Number.isSafeInteger(e.round)||typeof e.playerId!=='string'||typeof e.type!=='string'||!PERSONALITY_EVENTS.includes(e.type)||!Number.isFinite(e.delta))return false;
    return true;
  }catch{return false;}
}
export function personalityPlayerView(w,p,{lang='it',report=null,owned=null}={}){
  if(!personalityEnabled(w))return null;
  const en=lang==='en',mine=owned??(p.clubId===w.clubId);
  if(!mine){
    const knowledge=Number(report?.confidence??0);
    // Unknown players never reveal exact traits. Scouting confidence maxes out at 88.
    return {...scoutPersonality(stableProfile(w,p),{knowledge:cap(Math.floor(knowledge),0,88),seed:w.seed,viewerId:String(p.globalId??p.id),lang}),owned:false};
  }
  const profile=stableProfile(w,p),st=state(w).playerStates[String(p.id)];
  if(!st)return {owned:true,traits:[],morale:p.morale,coachRelationship:50};
  // Only qualitative insight: ambition, loyalty, temperament and adaptability stay private.
  return {owned:true,morale:st.morale,coachRelationship:st.coachRelationship,influence:st.influence,
    traits:TRAITS.map(t=>({key:t.key,label:t.label[en?'en':'it'],visibility:['professionalism','determination'].includes(t.key)?'descriptive':'hidden',description:['professionalism','determination'].includes(t.key)?describeTrait(t.key,profile.traits[t.key],lang):null})),
    history:st.history.slice(-6).map(x=>({type:x.type,delta:x.moraleDelta,drivers:x.drivers}))};
}
/** Per-player effects are bounded: gameplay multiplier ±3%, training impact ±3%. */
export function personalityMatchMultiplier(w,teamId){
  if(!personalityEnabled(w)||teamId!==w.clubId)return 1;
  const entries=own(w).filter(p=>w.lineup.includes(p.id));
  if(!entries.length)return 1;
  const average=entries.reduce((sum,p)=>{
    const st=state(w).playerStates[String(p.id)],profile=stableProfile(w,p);
    const consistency=evaluatePersonalityEffects(profile,{morale:st?.morale??p.morale}).factors.consistency;
    return sum+((st?.morale??50)-50)*0.00025+(consistency-1)*0.12;
  },0)/entries.length;
  return cap(1+average,0.97,1.03);
}
export function personalityTrainingMultiplier(w,p){
  if(!personalityEnabled(w)||p.clubId!==w.clubId)return 1;
  const f=evaluatePersonalityEffects(stableProfile(w,p),{morale:state(w).playerStates[String(p.id)]?.morale??p.morale}).factors.training;
  return cap(1+(f-1)*.2,.97,1.03);
}
export function personalityBoardShift(w){
  if(!personalityEnabled(w))return 0;
  const cohesion=lockerRoomView(w).cohesion;
  return cohesion>=75?1:cohesion<=35?-1:0;
}
export function personalityContractInterest(w,p,{offeredRaise=0}={}){
  if(!personalityEnabled(w))return null;
  const st=state(w).playerStates[String(p.id)];
  return evaluatePersonalityEffects(stableProfile(w,p),{morale:st?.morale??p.morale,offeredRaise}).contractInterest;
}
/** Called once after the official fixture, before MGT01 evaluates team results. */
export function settleCareerPersonalityRound(w,{result,playedIds=[]}={}){
  if(!personalityEnabled(w))return false;
  syncCareerPersonality(w);
  const s=state(w),ours=own(w);
  const outcome=result==='win'?'win':result==='loss'?'loss':null;
  let biggest=null;
  for(const p of ours){
    const profile=stableProfile(w,p),before=s.playerStates[String(p.id)];
    const type=outcome??(playedIds.includes(p.id)?'played':'bench');
    const id=`ply02:${w.season}:${w.round}:${p.id}:${type}`;
    let after=applyPlayerEvent(before,profile,{id,type,importance:0.75});
    if(playedIds.includes(p.id))after=applyPlayerEvent(after,profile,{id:`ply02:${w.season}:${w.round}:${p.id}:played`,type:'played',importance:0.5});
    else after=applyPlayerEvent(after,profile,{id:`ply02:${w.season}:${w.round}:${p.id}:bench`,type:'bench',importance:0.5});
    s.playerStates[String(p.id)]=after;
    const delta=Math.round((after.morale-before.morale)*100)/100;
    p.morale=cap(Math.round(after.morale),0,100);
    const event={season:w.season,round:w.round,playerId:String(p.id),type,delta};
    s.events.push(event);
    if(!biggest||Math.abs(delta)>Math.abs(biggest.delta))biggest={...event,name:p.name};
  }
  s.events=s.events.slice(-80);s.lastDay=w.advancedV1.clockDay;s.revision++;
  if(biggest&&w.round%4===0)addMessage(w,'Relazioni nello spogliatoio',`${biggest.name}: variazione del morale ${biggest.delta}.`,'training',{type:'personality.weekly',params:{player:biggest.name,change:Math.round(biggest.delta)}});
  return true;
}
export function settleCareerPersonalitySeason(w){
  if(!personalityEnabled(w))return;
  syncCareerPersonality(w);
  for(const p of own(w)){
    const st=state(w).playerStates[String(p.id)];
    // Follow the authoritative morale reset, do not apply another seasonal bonus.
    st.morale=p.morale;
  }
  state(w).revision++;
}
export function lockerRoomView(w){
  if(!personalityEnabled(w))return null;
  return inspectLockerRoom(own(w).map(p=>({...p,position:toAddonPosition(p.position)})),{states:state(w).playerStates,seed:w.seed,countryId:w.countryId});
}
