// ME-PB-05 — deterministic evidence timeline for REAL Rapier collider events only.
// No geometric reach -> touch conversion, no ownership, no force attribution.
import {INITIAL_PLAYERS,PLAYER_DT} from './player-movement.mjs';
import {FOOT_CONTACT_VERSION,footProxyTransform,initialFootPositions}
 from './player-foot-contact.mjs';

export const FOOT_CONTACT_TIMELINE_VERSION='me-pb-05-contact-evidence-v1';
const empty=Object.freeze([]);
const names=INITIAL_PLAYERS.map(p=>p.id),known=new Set(names);
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const frozenArray=items=>Object.freeze(items);
const duration=(id,startTick,lastActiveTick,endTick)=>Object.freeze({
 id,startTick,endTick,
 // Rapier starts at a step boundary; active solver-step samples are
 // startTick..endTick-1. No fabricated elapsed time at tick zero.
 durationTicks:endTick-startTick,
 durationS:(endTick-startTick)*PLAYER_DT,
 kind:endTick===startTick?'zero-sample':
   endTick-startTick===1?'single-tick':'multi-tick'
});
function validateEventList(values,label){
 if(!Array.isArray(values))throw new TypeError('Rapier contact '+label+' array required');
 const seen=new Set();let last=-1;
 for(const id of values){
  const index=names.indexOf(id);
  if(!known.has(id)||seen.has(id)||index<=last)
   throw new TypeError('Canonical ordered unique Rapier '+label+' IDs required');
  seen.add(id);last=index;
 }
 return seen;
}
function validateBall(ball){
 if(!ball||!ball.position||!ball.velocity||
   ['x','y','z'].some(k=>!finite(ball.position[k])||!finite(ball.velocity[k])))
  throw new TypeError('Real finite pre-step 3D Rapier ball state required');
}
function validateFeet(feet){
 if(!Array.isArray(feet)||feet.length!==INITIAL_PLAYERS.length)
  throw new TypeError('Canonical 22-foot motion frame required');
 for(const f of feet){
  if(!f||!finite(f.x)||!finite(f.y)||!finite(f.facingRad)||
    Math.abs(f.facingRad)>Math.PI+1e-5)
   throw new TypeError('Finite real 22-foot positions/facing required');
 }
}
function projectedMotion(ball,previous,current,id){
 const index=names.indexOf(id);
 const start=footProxyTransform(previous[index]);
 const end=footProxyTransform(current[index]);
 const footVx=(end.x-start.x)/PLAYER_DT;
 const footVy=(end.y-start.y)/PLAYER_DT;
 const dx=ball.position.x-start.x,dy=ball.position.y-start.y;
 const distance=Math.hypot(dx,dy);
 const relativeVx=ball.velocity.x-footVx;
 const relativeVy=ball.velocity.y-footVy;
 const relativeSpeedMps=Math.hypot(relativeVx,relativeVy);
 if(distance<1e-8)return Object.freeze({
  id,relativeSpeedMps,closingSpeedMps:null,
  separatingSpeedMps:null,tangentialSpeedMps:null,
  geometry:'indeterminate'
 });
 const nx=dx/distance,ny=dy/distance;
 const signedRadial=relativeVx*nx+relativeVy*ny;
 return Object.freeze({
  id,relativeSpeedMps,
  closingSpeedMps:Math.max(0,-signedRadial),
  separatingSpeedMps:Math.max(0,signedRadial),
  tangentialSpeedMps:Math.abs(relativeVx*ny-relativeVy*nx),
  geometry:'planar-centerline-projection'
 });
}

// Timeline is a compact, immutable CURRENT-tick readout. No growing history.
// An event begins/ends only when Rapier reports that transition.
export function createFootContactTimeline(){
 let tick=0,previousFeet=initialFootPositions(),open=new Map();
 let current=Object.freeze({
  version:FOOT_CONTACT_TIMELINE_VERSION,tick:0,
  onsets:empty,completed:empty,ongoing:empty,simultaneous:false
 });
 function observe(events,preStepBall,feet){
  if(!events||events.version!==FOOT_CONTACT_VERSION||
    !Number.isInteger(events.tick)||events.tick!==tick+1)
   throw new RangeError('Consecutive real 60Hz Rapier collision events required');
  validateBall(preStepBall);validateFeet(feet);
  const starts=validateEventList(events.started,'started');
  const ends=validateEventList(events.ended,'ended');
  const active=validateEventList(events.active,'active');
  // Validate ALL transitions first, without mutating the observer.
  const next=new Map(open);
  for(const id of starts){
   if(next.has(id))throw new RangeError('Duplicate Rapier start without exit');
   next.set(id,Object.freeze({startTick:events.tick}));
  }
  for(const id of ends){
   if(!next.has(id))throw new RangeError('Rapier end without matching start');
   next.delete(id);
  }
  if(next.size!==active.size||[...next.keys()].some(id=>!active.has(id)))
   throw new RangeError('Rapier active IDs do not reconcile with start/end transitions');
  const onsets=frozenArray(names.filter(id=>starts.has(id)).map(id=>
   Object.freeze({id,tick:events.tick,
    ...projectedMotion(preStepBall,previousFeet,feet,id)})));
  const completed=frozenArray(names.filter(id=>ends.has(id)).map(id=>
   duration(id,(open.get(id)??{startTick:events.tick}).startTick,
    events.tick-1,events.tick)));
  const ongoing=frozenArray(names.filter(id=>active.has(id)).map(id=>{
   const startTick=next.get(id).startTick;
   return Object.freeze({id,startTick,observedTicks:events.tick-startTick+1,
    observedS:(events.tick-startTick+1)*PLAYER_DT});
  }));
  const snapshot=Object.freeze({
   version:FOOT_CONTACT_TIMELINE_VERSION,tick:events.tick,
   onsets,completed,ongoing,simultaneous:ongoing.length>=2
  });
  previousFeet=feet;open=next;tick=events.tick;current=snapshot;
  return snapshot;
 }
 return Object.freeze({observe,snapshot:()=>current});
}
