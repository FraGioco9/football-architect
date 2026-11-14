// ME-PB-55 / A4.2b.1: self-contained, uniform 22-player football action
// policy, called ONLY after an INTERNAL genuine Rapier shoe START.
// Pure decision: never applies impulses, never accepts an authenticated
// match command or produces official possession, shots/goals/results.
import {INITIAL_PLAYERS,PLAYER_PITCH,PLAYER_VERSION} from './player-movement.mjs';


export const UNIFORM_AUTONOMOUS_ACTION_VERSION=
 'me-pb-55-closed-real-contact-uniform-action-v1';
export const UNIFORM_AUTONOMOUS_ACTION_COOLDOWN_TICKS=12;
const ACTION_IMPULSE_NS=Object.freeze({pass:2.4,shot:3.0,clearance:2.7,carry:0.42});
export const PROVISIONAL_PHYSICAL_CARRY_IMPULSE_NS=0.42;
// C3.2a: a small GROUND touch is a real Rapier impulse, NOT a virtual
// dribble or privileged possession. Only isolated autonomousCarry fixtures.
const MAX_GAP_M=0.85;
const MAX_HEIGHT_M=0.12;
const PASS_LANE_MIN_CLEARANCE_M=1.9;
const SHOT_LANE_MIN_CLEARANCE_M=2.4;
// C2.3b: realistic medium-range attempts, with near-post lanes selected
// only from LIVE opponent positions; this is tactical geometry, not scoring.
export const SHOT_MAX_RANGE_M=35;
export const SHOT_HALF_GOAL_AIM_Y_M=3.1;
const IMMEDIATE_PRESSURE_M=3.0;
export const UNIFORM_ACTION_CONTEXT_VERSION='me-pb-55-contextual-lane-observation-v1';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const ids=Object.freeze(INITIAL_PLAYERS.map(p=>p.id));

// Pure geometry: opponent presence is a risk indicator, NEVER proof that
// an interception, tackle or goal occurred. Shared for both teams.
const nearOpponent=(point,team,players)=>Math.min(
 ...players.filter(p=>p.team!==team)
  .map(p=>Math.hypot(p.x-point.x,p.y-point.y))
);
function lineClearance(from,to,team,players){
 const dx=to.x-from.x,dy=to.y-from.y,den=dx*dx+dy*dy;
 if(den<=1e-8)return 0;
 return Math.min(...players.filter(p=>p.team!==team).map(p=>{
  const projection=Math.max(0,Math.min(1,
   ((p.x-from.x)*dx+(p.y-from.y)*dy)/den));
  return Math.hypot(p.x-(from.x+dx*projection),
   p.y-(from.y+dy*projection));
 }));
}
function chooseLiveShotLane(ball,goalX,team,players){
 // Centre first, then the two open goal-mouth lanes. Each aim point
 // fits inside 7.32m goal width with the canonical 0.11m ball radius.
 // Ball contact/impulse is still authorized ONLY by Rapier shoe START.
 const candidates=[0,-SHOT_HALF_GOAL_AIM_Y_M,SHOT_HALF_GOAL_AIM_Y_M];
 for(const targetY of candidates){
  const target=Object.freeze({x:goalX,y:targetY});
  const clearance=lineClearance(ball,target,team,players);
  if(clearance>=SHOT_LANE_MIN_CLEARANCE_M)
   return Object.freeze({target,clearance});
 }
 return null;
}
function chooseRecipient(actor,ball,players){
 const attack=actor.team==='home'?1:-1;
 const choices=players.filter(p=>p.team===actor.team&&
  p.id!==actor.id).map(p=>{
   const d=Math.hypot(p.x-actor.x,p.y-actor.y);
   // A physical pass starts at the REAL current ball, which can be
   // 0.85m from the authentic shoe actor. The sealed observer requires
   // a 3..25m *ball-origin* target, not merely an actor-origin target.
   const ballDistance=Math.hypot(p.x-ball.x,p.y-ball.y);
   const forward=(p.x-actor.x)*attack;
   const nearestOpponentM=nearOpponent(p,actor.team,players);
   const laneClearanceM=lineClearance(ball,p,actor.team,players);
   return {player:p,d,ballDistance,forward,nearestOpponentM,laneClearanceM,
    score:forward*0.35+Math.min(nearestOpponentM,12)*0.28-
     d*0.12+Math.min(laneClearanceM,8)*0.42};
  }).filter(x=>x.d>=3&&x.d<=25&&
    x.ballDistance>=3&&x.ballDistance<=25&&x.forward>=-3&&
    x.laneClearanceM>=PASS_LANE_MIN_CLEARANCE_M&&
    x.nearestOpponentM>=1.6)
  .sort((a,b)=>b.score-a.score||
   ids.indexOf(a.player.id)-ids.indexOf(b.player.id));
 return choices[0]??null;
}

export function selectUniformAutonomousContactAction({
 tick,contactStarted,contactActive,playerFrame,ballPosition,ballVelocity,
 lastActionTick=-UNIFORM_AUTONOMOUS_ACTION_COOLDOWN_TICKS,ballRadiusM,
 allowPhysicalCarry=false
}){
 if(!Number.isSafeInteger(tick)||tick<1||
    !Array.isArray(contactStarted)||new Set(contactStarted).size!==contactStarted.length||
    contactStarted.some(id=>!ids.includes(id))||
    !Array.isArray(contactActive)||
    new Set(contactActive).size!==contactActive.length||
    contactActive.some(id=>!ids.includes(id))||
    contactStarted.some(id=>!contactActive.includes(id))||
    !playerFrame||playerFrame.version!==PLAYER_VERSION||
    playerFrame.tick!==tick||!Array.isArray(playerFrame.players)||
    playerFrame.players.length!==22||
    !ballPosition||!ballVelocity||
    !['x','y','z'].every(k=>finite(ballPosition[k])&&finite(ballVelocity[k]))||
    !Number.isSafeInteger(lastActionTick)||lastActionTick>tick||
    !finite(ballRadiusM)||ballRadiusM<0.05||ballRadiusM>0.2||
    typeof allowPhysicalCarry!=='boolean')
  throw new TypeError('Verified same-tick movement, ball and real Rapier shoe starts required');
 // A4.2b.3: an ambiguous START/ACTIVE contact cannot confer a right
 // to kick the ball. Require one genuine START and no other active shoe.
 // Multi-contact remains real physics evidence, never a possession award.
 if(contactStarted.length!==1||contactActive.length!==1||
    contactActive[0]!==contactStarted[0])return null;
 if(tick-lastActionTick<UNIFORM_AUTONOMOUS_ACTION_COOLDOWN_TICKS||
    ballPosition.z<ballRadiusM-0.015||
    ballPosition.z>ballRadiusM+MAX_HEIGHT_M||
    Math.hypot(ballVelocity.x,ballVelocity.y)>14)
  return null;
 const actors=playerFrame.players;
 // Canonical frame is validated separately by createEngine before mutation.
 for(let i=0;i<actors.length;i++)
  if(actors[i]?.id!==ids[i]||actors[i].team!==INITIAL_PLAYERS[i].team)
   throw new TypeError('Trusted ordered 22-person movement required');
 for(const id of contactStarted){
  const player=actors.find(p=>p.id===id);
  if(!player)continue;
  const gap=Math.hypot(player.x-ballPosition.x,player.y-ballPosition.y);
  if(!finite(gap)||gap>MAX_GAP_M)continue;
  const attack=player.team==='home'?1:-1;
  const goalX=attack*PLAYER_PITCH.lengthM/2;
  const toGoal=goalX-ballPosition.x;
  const nearestOpponentM=nearOpponent(player,player.team,actors);
  const goalTarget=Object.freeze({x:goalX,y:0});
  const shotRange=Math.abs(toGoal)<=SHOT_MAX_RANGE_M&&
   Math.abs(ballPosition.y)<=20;
  const chosenShotLane=shotRange?
   chooseLiveShotLane(ballPosition,goalX,player.team,actors):null;
  const shotLaneM=chosenShotLane?.clearance??
   lineClearance(ballPosition,goalTarget,player.team,actors);
  let action,recipient=null,recipientInfo=null,dx,dy,vertical=0,rule;
  if(chosenShotLane){
   action='shot';dx=toGoal;
   dy=chosenShotLane.target.y-ballPosition.y;vertical=0.24;
   rule=chosenShotLane.target.y===0?
    'unblocked-goal-lane':'unblocked-near-post-lane';
  }else{
   recipientInfo=chooseRecipient(player,ballPosition,actors);
   if(recipientInfo){
    recipient=recipientInfo.player;
    action='pass';dx=recipient.x-ballPosition.x;
    dy=recipient.y-ballPosition.y;
    rule=shotRange?'blocked-shot-safe-pass':
     nearestOpponentM<IMMEDIATE_PRESSURE_M?'pressured-safe-pass':
     'open-safe-pass';
   }else if(allowPhysicalCarry&&!shotRange&&
    player.role!=='goalkeeper'&&
    Math.abs(ballPosition.y)<=20&&
    attack*ballPosition.x>=-30&&
    attack*ballPosition.x<=30){
    // In this isolated research mode, an outfielder MAY attempt a
    // short controlled touch even under pressure if there is NO safe
    // pass or shot and the Rapier shoe is physically EXCLUSIVE.
    // A pressured attempt is not a confirmed dribble or possession.
    action='carry';dx=attack*8;dy=-ballPosition.y*0.12;
    rule=nearestOpponentM<IMMEDIATE_PRESSURE_M?
     'pressured-short-ground-touch':'open-lane-short-ground-touch';
   }else{
    action='clearance';dx=attack*25;
    dy=-ballPosition.y*0.45;vertical=0.32;
    rule=shotRange?'blocked-shot-no-safe-pass':
     nearestOpponentM<IMMEDIATE_PRESSURE_M?'pressured-no-safe-pass':
     'no-safe-pass';
   }
  }
  const length=Math.hypot(dx,dy);
  if(length<1e-5)continue;
  const magnitude=ACTION_IMPULSE_NS[action],factor=magnitude/
   Math.hypot(dx,dy,vertical*length);
  const impulseNs=Object.freeze({x:dx*factor,y:dy*factor,
   z:vertical*length*factor});
  // C1.1: the live teammate and ball geometry at THIS movement tick,
  // frozen before Rapier applies the impulse. A target is only intent,
  // never evidence of reception or a completed football pass.
  const shotTarget=action==='shot'?Object.freeze({
   source:'same-tick-closed-goal-lane-from-live-22-players',
   shooterId:id,team:player.team,physicsTick:tick,
   originX:ballPosition.x,originY:ballPosition.y,
   targetX:chosenShotLane.target.x,targetY:chosenShotLane.target.y,
   laneClearanceM:chosenShotLane.clearance,
   attemptOnly:true,shotOnTarget:null,goalScored:null
  }):null;
  const carryTarget=action==='carry'?Object.freeze({
   source:'same-tick-exclusive-rapier-shoe-short-ground-touch',
   actorId:id,team:player.team,physicsTick:tick,
   originX:ballPosition.x,originY:ballPosition.y,
   impulseMagnitudeNs:PROVISIONAL_PHYSICAL_CARRY_IMPULSE_NS,
   shortGroundTouchOnly:true,physicalRecontactObserved:false,
   dribbleConfirmed:null,officialMatchResult:null
  }):null;
  const passTarget=action==='pass'?Object.freeze({
   source:'same-tick-canonical-22-player-positions',
   originPlayerId:id,recipientId:recipient.id,
   originX:ballPosition.x,originY:ballPosition.y,
   recipientX:recipient.x,recipientY:recipient.y,
   distanceM:Math.hypot(dx,dy),
   forwardM:(recipient.x-player.x)*attack,
   team:player.team,physicsTick:tick,
   physicalPassAttemptOnly:true,passCompleted:false
  }):null;
  return Object.freeze({
   version:UNIFORM_AUTONOMOUS_ACTION_VERSION,tick,
   playerId:id,team:player.team,
   action,recipientId:recipient?.id??null,
   passTarget,shotTarget,carryTarget,measuredGapM:gap,
   physicalTrigger:'same-tick-real-rapier-shoe-start',
   movementSource:'canonical-22-player-autonomous-mover',
   impulseNs,appliedByRapier:false,
   decisionContext:Object.freeze({
    version:UNIFORM_ACTION_CONTEXT_VERSION,
    rule,nearestOpponentM,
    underImmediatePressure:nearestOpponentM<IMMEDIATE_PRESSURE_M,
    shotLaneClearanceM:shotLaneM,shotRange,
    passLaneClearanceM:recipientInfo?.laneClearanceM??null,
    chosenRecipientOpponentGapM:recipientInfo?.nearestOpponentM??null,
    outcomeNotYetObserved:true,
    opponentTackleProven:false,interceptionProven:false,
    passCompleted:false,goalScored:false
   }),
   temporaryPlayersOnly:true,uniformPlayerStats:true,
   officialMatchAction:false,officialMatchPossession:false,
   officialGoalEvidence:false,officialMatchResult:null
  });
 }
 return null;
}
