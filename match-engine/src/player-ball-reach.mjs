// ME-PB-01 — strictly observational 60 Hz player/ball reach geometry.
// These are planar tactical placeholders, not Rapier player colliders.
// In range NEVER means a touch, possession, tackle, save, impulse or player command.
import {ENGINE_VERSION,FIXED_DT,BALL_RADIUS} from './core.mjs';
import {INITIAL_PLAYERS,PLAYER_VERSION,PLAYER_DT,PLAYER_PITCH,PLAYER_RADIUS_M}
  from './player-movement.mjs';

export const PLAYER_BALL_REACH_VERSION='me-pb-01-grounded-reach-v1';
// Provisional LAB-only ground-level envelope; deliberately NOT a foot/body model.
export const PLAYER_BALL_REACH_RADIUS_M=PLAYER_RADIUS_M+BALL_RADIUS+0.10;
export const PLAYER_BALL_MAX_CLEARANCE_M=0.30;
const EPS=1e-9;
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const empty=Object.freeze([]);

function validateSnapshots(physics,playerFrame){
 if(!physics||!playerFrame||physics.version!==ENGINE_VERSION||
   playerFrame.version!==PLAYER_VERSION)
  throw new TypeError('Canonical ball and player versions required');
 const tick=physics.tick;
 if(!Number.isInteger(tick)||tick<0||playerFrame.tick!==tick||
   !finite(physics.time)||!finite(playerFrame.timeS)||
   Math.abs(physics.time-tick*FIXED_DT)>EPS||
   Math.abs(playerFrame.timeS-tick*PLAYER_DT)>EPS)
  throw new RangeError('Synchronized real 60 Hz player/ball ticks required');
 const position=physics.ball?.position,velocity=physics.ball?.velocity;
 if(!position||!velocity||
   ['x','y','z'].some(key=>!finite(position[key])||!finite(velocity[key]))||
   (position.z<0&&Math.abs(position.x)<=PLAYER_PITCH.lengthM/2&&
     Math.abs(position.y)<=PLAYER_PITCH.widthM/2)||
   typeof physics.nearGround!=='boolean')
  throw new TypeError('Finite 3D Rapier ball state required');
 if(!Array.isArray(playerFrame.players)||
   playerFrame.players.length!==INITIAL_PLAYERS.length)
  throw new TypeError('Exactly 22 canonical players required');
 for(let i=0;i<INITIAL_PLAYERS.length;i++){
  const expected=INITIAL_PLAYERS[i],p=playerFrame.players[i];
  if(!p||p.id!==expected.id||p.team!==expected.team||
    p.number!==expected.number||p.role!==expected.role||
    ['x','y','vx','vy'].some(key=>!finite(p[key]))||
    Math.abs(p.x)>PLAYER_PITCH.lengthM/2+EPS||
    Math.abs(p.y)>PLAYER_PITCH.widthM/2+EPS)
   throw new TypeError('Valid canonical physical player XY required');
 }
}

// Every candidate is an actual observed geometric proximity, not an
// authoritatively verified collision or an automatically assigned possessor.
export function evaluatePlayerBallReach(physics,playerFrame){
 validateSnapshots(physics,playerFrame);
 const ball=physics.ball.position;
 const onPitch=Math.abs(ball.x)<=PLAYER_PITCH.lengthM/2 &&
   Math.abs(ball.y)<=PLAYER_PITCH.widthM/2;
 const clearanceM=Math.max(0,ball.z-BALL_RADIUS);
 const groundLevel=onPitch&&clearanceM<=PLAYER_BALL_MAX_CLEARANCE_M+EPS;
 const candidates=[];
 if(groundLevel){
  for(let i=0;i<INITIAL_PLAYERS.length;i++){
   const p=playerFrame.players[i];
   const distanceM=Math.hypot(p.x-ball.x,p.y-ball.y);
   if(distanceM<=PLAYER_BALL_REACH_RADIUS_M+EPS)
    candidates.push({id:p.id,team:p.team,distanceM,index:i});
  }
 }
 candidates.sort((a,b)=>a.distanceM-b.distanceM||a.index-b.index);
 const frozen=Object.freeze(candidates.map(({id,team,distanceM})=>
  Object.freeze({id,team,distanceM})));
 return Object.freeze({
  version:PLAYER_BALL_REACH_VERSION,tick:physics.tick,
  clearanceM,onPitch,groundLevel,
  candidates:frozen,nearest:frozen[0]??null
 });
}

// Transitions use consecutive real 60 Hz snapshots only. Tick 0 is a
// baseline, never a fabricated entrance/exit. Reset is strictly local.
export function createPlayerBallReachObserver(){
 let lastTick=null,previous=new Set();
 let latest=Object.freeze({
  version:PLAYER_BALL_REACH_VERSION,tick:null,clearanceM:null,
  onPitch:false,groundLevel:false,candidates:empty,nearest:null,
  entered:empty,exited:empty
 });
 function observe(physics,playerFrame){
  const sample=evaluatePlayerBallReach(physics,playerFrame);
  if(lastTick===null?sample.tick!==0:sample.tick!==lastTick+1)
   throw new RangeError('Reach observer requires consecutive ticks from zero');
  const next=new Set(sample.candidates.map(p=>p.id));
  const entered=sample.tick===0?empty:Object.freeze(
   sample.candidates.filter(p=>!previous.has(p.id)).map(p=>p.id));
  const exited=sample.tick===0?empty:Object.freeze(
   latest.candidates.filter(p=>!next.has(p.id)).map(p=>p.id));
  latest=Object.freeze({...sample,entered,exited});
  lastTick=sample.tick;previous=next;
  return latest;
 }
 function reset(){
  lastTick=null;previous=new Set();
  latest=Object.freeze({
   version:PLAYER_BALL_REACH_VERSION,tick:null,clearanceM:null,
   onPitch:false,groundLevel:false,candidates:empty,nearest:null,
   entered:empty,exited:empty
  });
  return latest;
 }
 return Object.freeze({observe,snapshot:()=>latest,reset});
}
