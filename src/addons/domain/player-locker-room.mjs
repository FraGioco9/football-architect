/** PLY02.03: explainable dressing-room snapshots and bounded immutable event log. */
import {clamp,validatePersonality,readPersonality} from './player-personality.mjs';
import {eventResponse,evaluatePersonalityEffects,PERSONALITY_EVENTS} from './player-personality-effects.mjs';
import {readPlayerAttributes} from './player-generator.mjs';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const score=(n,min=0,max=100)=>Number.isFinite(n)?clamp(n,min,max):50;
export function initialPlayerDynamics(player,{seed=0,countryId=''}={}){
 if(!object(player))throw new Error('PLY02_PLAYER');
 const id=String(player.id??'');if(!id)throw new Error('PLY02_PLAYER_ID');
 const attributes=readPlayerAttributes(player,{seed,countryId});
 const personality=readPersonality(player,{seed,countryId});
 const leading=personality.traits.leadership??personality.traits.determination;
 const influence=clamp(Math.round(0.55*leading+0.25*personality.traits.determination+0.2*score(player.age??24,15,45)/45*100),1,100);
 return {schemaVersion:1,playerId:id,revision:0,morale:score(player.morale??50),coachRelationship:50,influence,history:[],processedIds:[]};
}
export function validateDynamics(state){
 if(!object(state)||state.schemaVersion!==1||typeof state.playerId!=='string'||!state.playerId||!Number.isSafeInteger(state.revision)||state.revision<0)throw new Error('PLY02_DYNAMICS_SCHEMA');
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
 if(state.processedIds.includes(event.id))return structuredClone(state); // replay safe even beyond visible 100-event history
 if(state.processedIds.length>=10000)throw new Error('PLY02_EVENT_CAP');
 const effect=eventResponse(profile,event.type,{importance:event.importance??1});
 const relationshipFactor={coach_praise:2.5,coach_criticism:-3,bench:-0.8,played:0.5,transfer_rejected:-0.7}[event.type]??0;
 const relationshipDelta=Math.round(relationshipFactor*100)/100;
 const next={...state,revision:state.revision+1,morale:clamp(Math.round((state.morale+effect.moraleDelta)*100)/100,0,100),coachRelationship:clamp(Math.round((state.coachRelationship+relationshipDelta)*100)/100,0,100),history:[...state.history,{id:event.id,type:event.type,moraleDelta:effect.moraleDelta,relationshipDelta,drivers:[...effect.drivers]}].slice(-100),processedIds:[...state.processedIds,event.id]};
 validateDynamics(next);return next;
}
/** Snapshot only. Never changes other players' morale on its own. */
export function inspectLockerRoom(players,{states={},seed=0,countryId=''}={}){
 if(!Array.isArray(players)||!object(states))throw new Error('PLY02_SQUAD');
 if(new Set(players.map(p=>String(p.id))).size!==players.length)throw new Error('PLY02_DUPLICATE_PLAYER');
 const items=players.map(p=>{
  const personality=readPersonality(p,{seed,countryId});const state=states[String(p.id)]??initialPlayerDynamics(p,{seed,countryId});validateDynamics(state);
  if(state.playerId!==String(p.id))throw new Error('PLY02_STATE_PLAYER_MISMATCH');
  const {factors}=evaluatePersonalityEffects(personality,{morale:state.morale});
  return {id:String(p.id),influence:state.influence,morale:state.morale,relationship:state.coachRelationship,consistency:factors.consistency};
 });
 const weighted=(field)=>items.length?Math.round(items.reduce((s,i)=>s+i[field]*(0.5+i.influence/100),0)/items.reduce((s,i)=>s+0.5+i.influence/100,0)*100)/100:50;
 return {count:items.length,averageMorale:weighted('morale'),coachTrust:weighted('relationship'),cohesion:items.length?Math.round((0.55*weighted('morale')+0.45*weighted('relationship'))*100)/100:50,leaders:[...items].sort((a,b)=>b.influence-a.influence||a.id.localeCompare(b.id)).slice(0,3),members:items};
}
