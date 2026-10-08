/** PLYR-06.2: deterministic player dynamics and replay-safe event ledger.
 * Official player.morale is the sole source of truth in the career bridge.
 * These snapshots are immutable projections; no other player is mutated.
 */
import {clamp,validatePersonality,readPersonality} from './player-personality.mjs';
import {eventResponse,evaluatePersonalityEffects,PERSONALITY_EVENTS} from './player-personality-effects.mjs';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const score=(n,min=0,max=100)=>Number.isFinite(n)?clamp(n,min,max):50;
const round=n=>Math.round(n*100)/100;
export const PLAYER_DYNAMICS_VERSION=2;
export function playerInfluence(player,personality){
 validatePersonality(personality);
 if(!object(player))throw new Error('PLY02_PLAYER');
 const traits=personality.traits;
 const experience=clamp((score(player.age??24,15,45)-15)/30*100,0,100);
 const appearances=clamp(score(player.apps??0,0,100)/30*100,0,100);
 // Actual leadership is decisive; experience and participation are secondary.
 return Math.round(clamp(traits.leadership*.62+traits.determination*.18+experience*.12+appearances*.08,1,100));
}
export function initialPlayerDynamics(player,{seed=0,countryId=''}={}){
 if(!object(player))throw new Error('PLY02_PLAYER');
 const id=String(player.id??'');if(!id)throw new Error('PLY02_PLAYER_ID');
 const personality=readPersonality(player,{seed,countryId});
 return {schemaVersion:PLAYER_DYNAMICS_VERSION,playerId:id,revision:0,
  morale:round(score(player.morale??50)),coachRelationship:50,
  influence:playerInfluence(player,personality),history:[],processedIds:[]};
}
export function validateDynamics(state){
 if(!object(state)||state.schemaVersion!==PLAYER_DYNAMICS_VERSION||typeof state.playerId!=='string'||!state.playerId||!Number.isSafeInteger(state.revision)||state.revision<0)throw new Error('PLY02_DYNAMICS_SCHEMA');
 for(const k of ['morale','coachRelationship','influence'])if(!Number.isFinite(state[k])||state[k]<0||state[k]>100)throw new Error('PLY02_DYNAMICS_RANGE');
 if(!Array.isArray(state.history)||state.history.length>100||state.history.some(h=>!object(h)||typeof h.id!=='string'||!h.id||!PERSONALITY_EVENTS.includes(h.type)||!Number.isFinite(h.moraleDelta)||!Number.isFinite(h.relationshipDelta)||!Array.isArray(h.drivers)))throw new Error('PLY02_DYNAMICS_HISTORY');
 if(new Set(state.history.map(h=>h.id)).size!==state.history.length)throw new Error('PLY02_DYNAMICS_DUPLICATE');
 if(!Array.isArray(state.processedIds)||state.processedIds.length>10000||state.processedIds.some(id=>typeof id!=='string'||!id)||new Set(state.processedIds).size!==state.processedIds.length)throw new Error('PLY02_PROCESSED_IDS');
 if(state.history.some(h=>!state.processedIds.includes(h.id)))throw new Error('PLY02_HISTORY_NOT_PROCESSED');
 return true;
}
export function applyPlayerEvent(state,profile,event){
 validateDynamics(state);validatePersonality(profile);
 if(!object(event)||typeof event.id!=='string'||!event.id||!PERSONALITY_EVENTS.includes(event.type))throw new Error('PLY02_EVENT');
 if(state.processedIds.includes(event.id))return structuredClone(state);
 if(state.processedIds.length>=10000)throw new Error('PLY02_EVENT_CAP');
 if(event.type==='contract_promise'){
  if(!Number.isFinite(event.moraleDelta)||Math.abs(event.moraleDelta)>8)throw new Error('PLY02_EVENT_DELTA');
 }else if(event.moraleDelta!==undefined)throw new Error('PLY02_EVENT_DELTA');
 if(event.type==='coach_change'&&event.importance!==undefined)throw new Error('PLY02_EVENT_IMPORTANCE');
 const effect=event.type==='coach_change'||event.type==='contract_promise'
  ?{moraleDelta:round(event.moraleDelta??0),drivers:event.type==='coach_change'?['coach_change']:['contract_promise']}
  :eventResponse(profile,event.type,{importance:event.importance??1});
 const relationBase={coach_praise:2.5,coach_criticism:-3,bench:-.8,played:.5,transfer_rejected:-.7}[event.type]??0;
 const relationshipDelta=event.type==='coach_change'?round(50-state.coachRelationship):relationBase;
 const next={...state,revision:state.revision+1,
  morale:round(clamp(state.morale+effect.moraleDelta,0,100)),
  coachRelationship:round(clamp(state.coachRelationship+relationshipDelta,0,100)),
  history:[...state.history,{id:event.id,type:event.type,moraleDelta:round(effect.moraleDelta),relationshipDelta,drivers:[...effect.drivers]}].slice(-100),
  processedIds:[...state.processedIds,event.id]};
 validateDynamics(next);return next;
}
/** Pure snapshot: influence weighs cohesion, never grants a second morale bonus. */
export function inspectLockerRoom(players,{states={},seed=0,countryId=''}={}){
 if(!Array.isArray(players)||!object(states))throw new Error('PLY02_SQUAD');
 if(new Set(players.map(p=>String(p.id))).size!==players.length)throw new Error('PLY02_DUPLICATE_PLAYER');
 const items=players.map(p=>{
  const personality=readPersonality(p,{seed,countryId});
  const state=states[String(p.id)]??initialPlayerDynamics(p,{seed,countryId});validateDynamics(state);
  if(state.playerId!==String(p.id))throw new Error('PLY02_STATE_PLAYER_MISMATCH');
  const {factors}=evaluatePersonalityEffects(personality,{morale:state.morale});
  return {id:String(p.id),influence:state.influence,morale:state.morale,relationship:state.coachRelationship,consistency:factors.consistency};
 });
 const weighted=field=>items.length?round(items.reduce((s,i)=>s+i[field]*(0.5+i.influence/100),0)/items.reduce((s,i)=>s+0.5+i.influence/100,0)):50;
 return {count:items.length,averageMorale:weighted('morale'),coachTrust:weighted('relationship'),cohesion:items.length?round(.55*weighted('morale')+.45*weighted('relationship')):50,
  leaders:[...items].sort((a,b)=>b.influence-a.influence||a.id.localeCompare(b.id)).slice(0,3),members:items};
}
