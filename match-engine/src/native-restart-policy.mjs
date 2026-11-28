import {attackDirection} from './match-directions.mjs';
// Dead-ball permissions are separate from open-play action capabilities.
export const NATIVE_RESTART_TYPES=Object.freeze(['kickoff','throw-in','corner','goal-kick']);
export function createNativeRestartMask({fullField=false,boundaryEnabled=false,boundaryType=null,kickoffEnabled=false}={}){
 if(![fullField,boundaryEnabled,kickoffEnabled].every(v=>typeof v==='boolean')||
    boundaryType!==null&&(!boundaryEnabled||!NATIVE_RESTART_TYPES.includes(boundaryType)||boundaryType==='kickoff'))throw new TypeError('Known restart configuration required');
 return Object.freeze(NATIVE_RESTART_TYPES.filter(kind=>fullField||kind==='kickoff'&&kickoffEnabled||boundaryEnabled&&(boundaryType===null||kind===boundaryType)));
}
export function nativeRestartAllowed(mask,kind){
 return NATIVE_RESTART_TYPES.includes(kind)&&Array.isArray(mask)&&mask.includes(kind);
}
// Pure direction/geometry policy. Only the original executor can apply
// this impulse after an authenticated ticket and real shoe manifold.
export function planNativeGroundRestartImpulse({mask,kind,team,spot,attackPolarity=1}={}){
 if(!nativeRestartAllowed(mask,kind)||kind==='throw-in'||!['home','away'].includes(team)||
    ![spot?.x,spot?.y,spot?.z].every(Number.isFinite))return null;
 const dir=attackDirection(team,attackPolarity);
 if(kind==='kickoff'){
  if(spot.x!==0||spot.y!==0)return null;
  return Object.freeze({x:dir*0.65,y:0,z:0.04});
 }
 if(kind==='corner'){
  if(Math.sign(spot.y)===0)return null;
  return Object.freeze({x:-dir*1.85,y:-Math.sign(spot.y)*1.15,z:0.42});
 }
 return Object.freeze({x:dir*2.5,y:0,z:0.30});
}
export function nativeGroundRestartContactReady({mask,kind,tick,takerId,foot,solver,exclusive=false,otherBody=false}={}){
 return nativeRestartAllowed(mask,kind)&&kind!=='throw-in'&&Number.isSafeInteger(tick)&&tick>=1&&
  typeof takerId==='string'&&exclusive===true&&otherBody===false&&foot?.tick===tick&&solver?.tick===tick&&
  Array.isArray(foot.started)&&Array.isArray(foot.active)&&foot.started.length===1&&foot.active.length===1&&
  foot.started[0]===takerId&&foot.active[0]===takerId&&Array.isArray(solver.pairs)&&
  solver.pairs.some(pair=>pair.id===takerId&&pair.beganThisTick===true&&pair.collisionActive===true&&pair.manifolds?.some(m=>m.geometricContacts>0));
}
