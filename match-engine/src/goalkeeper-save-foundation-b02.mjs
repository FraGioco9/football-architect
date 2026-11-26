// #628 ACTIONS-B02: one original goalkeeper, one original ball.
// A lateral dive APPROACH target is only an intent for the canonical
// 60Hz mover; a foot parry is separately authorized by real Rapier START.
import {PLAYER_MIN_SEPARATION_M,PLAYER_PITCH}
 from './player-movement.mjs';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const sideSign=team=>team==='home'?1:-1;
export const GOALKEEPER_DIVE_APPROACH_VERSION='actions-b02-goalkeeper-live-shot-approach-v1';
export const GOALKEEPER_PARRY_MAX_GOAL_DISTANCE_M=12;
export const GOALKEEPER_PARRY_HALF_WIDTH_M=4.5;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

export function initialResearchGoalkeeperSaveLineup(players,side,ball){
 if(!Array.isArray(players)||players.length!==22||
    !['home','away'].includes(side)||!ball||
    !['x','y','z','vx','vy','vz'].every(k=>finite(ball[k]))||
    ball.z!==0||ball.vz!==0)
  throw new TypeError('Original 22 players and grounded incoming ball required');
 const attack=sideSign(side),goalX=-attack*PLAYER_PITCH.lengthM/2;
 if(Math.abs(ball.x-goalX)>9||
    Math.abs(ball.y)>3||ball.vx*attack>=-0.5||
    Math.hypot(ball.vx,ball.vy)>12)
  throw new RangeError('Goalward ball must approach the original keeper');
 const id=side+'-1';
 if(players.filter(p=>p.id===id&&p.role==='goalkeeper'&&p.team===side).length!==1)
  throw new TypeError('Original named goalkeeper required');
 // Stage only the actual goalkeeper before tick ZERO, with his original
 // forward-facing shoe 0.28m behind the goalward moving ball.
 const x=ball.x-attack*0.28,y=ball.y;
 const staged=players.map(p=>p.id===id?
  Object.freeze({...p,x,y,baseX:x,baseY:y,vx:0,vy:0,blockedBy:null}):p);
 for(let i=0;i<staged.length;i++)for(let j=i+1;j<staged.length;j++)
  if(Math.hypot(staged[i].x-staged[j].x,
   staged[i].y-staged[j].y)<PLAYER_MIN_SEPARATION_M-1e-8)
   throw new RangeError('Canonical 0.98m separation must survive staging');
 return Object.freeze(staged);
}

export function chooseBasicGoalkeeperDiveTarget({
 keeper,ballPosition,ballVelocity
}={}){
 if(!keeper||keeper.role!=='goalkeeper'||
    !['home','away'].includes(keeper.team)||!ballPosition||!ballVelocity||
    !['x','y'].every(k=>finite(keeper[k]))||
    !['x','y','z'].every(k=>finite(ballPosition[k])&&finite(ballVelocity[k])))
  throw new TypeError('Only measured original goalkeeper and ball states allowed');
 const attack=sideSign(keeper.team);
 const goalX=-attack*PLAYER_PITCH.lengthM/2;
 const goalDist=Math.abs(goalX-ballPosition.x);
 if(goalDist>GOALKEEPER_PARRY_MAX_GOAL_DISTANCE_M||
    goalDist<0.1||ballVelocity.x*attack>=-0.5||
    Math.abs(ballPosition.y)>8||
    ballPosition.z>0.5)return null;
 const travelSeconds=(goalX-ballPosition.x)/ballVelocity.x;
 if(!finite(travelSeconds)||travelSeconds<=0||travelSeconds>3)
  return null;
 const predictedY=ballPosition.y+ballVelocity.y*travelSeconds;
 if(Math.abs(predictedY)>GOALKEEPER_PARRY_HALF_WIDTH_M)return null;
 return Object.freeze({
  version:GOALKEEPER_DIVE_APPROACH_VERSION,
  x:goalX+attack*2.6,y:clamp(predictedY,-3.4,3.4),
  observedBallX:ballPosition.x,observedBallY:ballPosition.y,
  observedBallVx:ballVelocity.x,observedBallVy:ballVelocity.y,
  flightToGoalS:travelSeconds,
  attemptOnly:true,physicalFootContactConfirmed:false,
  savedShot:false,officialSave:false,officialPossession:false
 });
}

// GK-04: classify a measurable response at a real glove solver contact.
// The velocity samples bracket the same world.step; concurrent contacts
// may contribute, so this is evidence of response, not isolated glove force.
// Small observational tolerances reject numerical noise and normal drag.
export function observeKeeperDeflection(side,dive){
 if(!['home','away'].includes(side)||dive?.contact!==true||
    dive.source!=='native-rapier-solver-manifold')return null;
 const {before,after}=dive.contactMotion??{};
 if(!['x','y','z'].every(k=>finite(before?.[k])&&finite(after?.[k])))return null;
 const dir=sideSign(side),incoming=dir*before.x,outgoing=dir*after.x;
 if(incoming<0.5)return null;
 const lateralChange=Math.abs(after.y-before.y);
 const speedDrop=Math.hypot(before.x,before.y)-Math.hypot(after.x,after.y);
 const kind=outgoing<=-0.5?'reversed':
  lateralChange>=0.5?'redirected':
  speedDrop>=0.75?'slowed':null;
 return kind?Object.freeze({tick:dive.tick,kind,before:Object.freeze({...before}),
  after:Object.freeze({...after}),officialSave:false}):null;
}

// SHOT-06 baseline: read-only witness of the latest real shot against the
// original opponent goalkeeper. Contact/parry is NOT proof of a saved shot.
// No movement, impulse, attribute or scoring authority belongs here.
export function createKeeperShotObserver(side){
 if(!['home','away'].includes(side))throw new TypeError('Attacking side required');
 const keeperId=(side==='home'?'away':'home')+'-1',shooterId=side+'-10';
 let state=Object.freeze({keeperId,shooterId,shots:0,shotTick:null,
  launchSpeedMps:null,keeperContactTick:null,parryTick:null,
  crossing:null,diveTick:null,gloveContactTick:null,deflection:null,reboundTick:null,
  secondShots:0,secondShotTick:null,reboundRecoveryTick:null,reboundReleaseTick:null,
  catchTick:null,officialSave:false,officialGoal:false});
 return Object.freeze({observe({tick,ball,starts,action,event,keeperDive=null}){
  const real=action?.tick===tick&&action.appliedByRapier===true&&
   action.actualPhysicsImpulseApplied===true&&starts.length===1&&starts[0]===action.playerId;
  if(real&&action.playerId===shooterId&&action.action==='shot'){
   const followUp=state.reboundTick!==null&&!state.crossing&&!keeperDive?.catchState?.active;
   state=Object.freeze({...state,shots:state.shots+1,shotTick:tick,
    launchSpeedMps:Math.hypot(ball.velocity.x,ball.velocity.y,ball.velocity.z),
    secondShots:state.secondShots+(followUp?1:0),secondShotTick:followUp?tick:null,
    keeperContactTick:null,parryTick:null,crossing:null,diveTick:null,gloveContactTick:null,
    deflection:null,reboundTick:null,catchTick:null,reboundRecoveryTick:null,reboundReleaseTick:null});
  }
  if(state.shotTick!==null&&tick>state.shotTick&&!state.crossing){
   const dive=keeperDive?.keeperId===keeperId&&keeperDive.tick===tick;
   const glove=dive&&keeperDive.contactStarted===true;
   const contact=starts.includes(keeperId)||glove;
   const parry=real&&action.playerId===keeperId&&action.action==='save';
   const crossing=event?.tick===tick&&event.crossing?.fullBallCrossed===true?
    Object.freeze({tick,kind:event.kind,scoringTeam:event.scoringTeam??null,
     fullBallCrossed:true}):null;
   const catchTick=dive&&keeperDive.catchState?.active===true?keeperDive.catchState.confirmedTick:null;
   const response=dive?observeKeeperDeflection(side,keeperDive):null;
   const deflection=state.deflection??response;
   // A loose ball can be reversed, lateral, slowed or lost from a grip.
   // Wait for a later native in-field sample; never turn a goal or a held
   // ball into a rebound. A still fast goalward trajectory is unresolved.
   const p=ball.position,v=ball.velocity,dir=sideSign(side);
   const gripLost=dive&&keeperDive.catchState?.released===true;
   const releaseTick=gripLost?tick:state.reboundReleaseTick;
   const sourceTick=releaseTick??deflection?.tick??state.parryTick;
   const free=!keeperDive?.catchState?.active;
   const rebound=sourceTick!=null&&tick>sourceTick&&!crossing&&free&&
    [p?.x,p?.y,p?.z,v?.x,v?.y,v?.z].every(finite)&&Math.abs(p.x)<52.39&&Math.abs(p.y)<33.89&&
    (dir*v.x< -0.5||Math.abs(v.y)>Math.max(0.5,dir*v.x)||Math.hypot(v.x,v.y,v.z)<=2);
   const recovery=state.reboundTick!==null&&free&&!crossing&&tick>state.reboundTick&&
    starts.length===1&&starts[0]===shooterId;
   if(contact||parry||crossing||response||rebound||recovery||gripLost||catchTick!=null||dive&&keeperDive.started)state=Object.freeze({...state,
    catchTick:state.catchTick??catchTick,reboundReleaseTick:releaseTick,
    reboundRecoveryTick:state.reboundRecoveryTick??(recovery?tick:null),
    deflection,reboundTick:catchTick!=null?null:state.reboundTick??(rebound?tick:null),
    diveTick:state.diveTick??(dive&&keeperDive.started?tick:null),
    gloveContactTick:state.gloveContactTick??(glove?tick:null),
    keeperContactTick:state.keeperContactTick??(contact?tick:null),
    parryTick:state.parryTick??(parry?tick:null),crossing});
  }
  return state;
 }});
}
