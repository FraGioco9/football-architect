// #628 M6 — isolated, non-match native Rapier player-body impact probe.
// This experimental pair has NO ball, no canonical 22-player control and
// no football authority. It validates real Rapier body events/response only.
import {FIXED_DT} from './core.mjs';
import {PLAYER_RADIUS_M} from './player-movement.mjs';
const v3=p=>Object.freeze({x:p.x,y:p.y,z:p.z});
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function createIsolatedRapierBodyPairProbe(RAPIER,{scenario='impact',side='home'}={}){
 if(!RAPIER||typeof RAPIER.World!=='function'||
    typeof RAPIER.EventQueue!=='function')
  throw new TypeError('Rapier physics and event queue required');
 if(!['impact','no-contact'].includes(scenario)||
    !['home','away'].includes(side))
  throw new TypeError('Bounded native player-body physics probe required');
 const world=new RAPIER.World({x:0,y:0,z:0});
 world.timestep=FIXED_DT;
 const queue=new RAPIER.EventQueue(true);
 const toward=scenario==='impact';
 const sign=side==='home'?1:-1;
 // Symmetric *disposable physics bodies*, not teleported canonical players.
 // Zero gravity prevents vertical drift in this XY-only experiment.
 const actors=[
  {id:side+'-body-a',x:-2.5,vx:(toward?2:-2)*sign},
  {id:side+'-body-b',x:2.5,vx:(toward?-2:2)*sign}
 ];
 const bodies=actors.map(a=>{
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
   .setTranslation(a.x*sign,0,1.0)
   .setLinvel(a.vx,0,0).setCcdEnabled(true));
  return body;
 });
 const colliders=bodies.map(body=>world.createCollider(
  RAPIER.ColliderDesc.ball(PLAYER_RADIUS_M)
   .setDensity(60).setFriction(0.6).setRestitution(0)
   .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),body));
 const handles=new Set(colliders.map(c=>c.handle));
 let tick=0,disposed=false,firstStart=null,firstEnd=null,minGapM=Infinity;
 function snapshot(){
  if(disposed)throw new Error('Body-pair physics probe disposed');
  const actual=bodies.map((body,i)=>Object.freeze({
   id:actors[i].id,
   position:v3(body.translation()),velocity:v3(body.linvel())
  }));
  const gap=Math.hypot(
   actual[0].position.x-actual[1].position.x,
   actual[0].position.y-actual[1].position.y,
   actual[0].position.z-actual[1].position.z);
  minGapM=Math.min(minGapM,gap);
  const relativeSpeedMps=Math.hypot(
   actual[0].velocity.x-actual[1].velocity.x,
   actual[0].velocity.y-actual[1].velocity.y);
  return Object.freeze({
   tick,timeS:tick*FIXED_DT,
   scenario,side,actors:Object.freeze(actual),
   gapM:gap,minGapM,relativeSpeedMps,
   firstBodyContactStart:firstStart,firstBodyContactEnd:firstEnd,
   authenticatedRapierBodyContact:firstStart!==null,
   isOriginalMatchWorld:false,isCanonical22PlayerMovement:false,
   playerBodyMatchAuthority:false,officialTackle:false,
   officialPossession:false,officialResult:null
  });
 }
 const initial=snapshot();
 function step(){
  if(disposed)throw new Error('Body-pair physics probe disposed');
  world.step(queue);tick++;
  queue.drainCollisionEvents((a,b,started)=>{
   if(!handles.has(a)||!handles.has(b)||a===b)
    throw new Error('Unexpected Rapier pair event');
   if(started&&!firstStart)firstStart=Object.freeze({tick,source:'rapier-collision-start'});
   if(!started&&!firstEnd)firstEnd=Object.freeze({tick,source:'rapier-collision-end'});
  });
  return snapshot();
 }
 function dispose(){
  if(!disposed){
   disposed=true;queue.free();world.free();
  }
 }
 return Object.freeze({initial,snapshot,step,dispose});
}
