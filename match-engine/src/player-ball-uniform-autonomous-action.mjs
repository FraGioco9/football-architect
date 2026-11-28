import {attackDirection,validateAttackPolarity} from './match-directions.mjs';
// ME-PB-55 / A4.2b.1: self-contained, uniform 22-player football action
// policy, called ONLY after an INTERNAL genuine Rapier shoe START.
// Pure decision: never applies impulses, never accepts an authenticated
// match command or produces official possession, shots/goals/results.
import {INITIAL_PLAYERS,PLAYER_PITCH,PLAYER_VERSION} from './player-movement.mjs';
import {chooseBasicDefensiveAttempt}
 from './basic-defensive-physical-actions-b03.mjs';
import {chooseSmallSidedContextAction,chooseNativeFootballAction}
 from './small-sided-context-choice.mjs';


import {chooseIsolatedDribbleTouch,chooseSharedDuelTouch,chooseDirectedDribbleTouch,chooseCollectiveDefensiveTouch,isNativeRecoveryLocked,planNativeCarryTouch,chooseNativePassInterceptionTouch} from './isolated-dribble-touches.mjs';
export const UNIFORM_AUTONOMOUS_ACTION_VERSION=
 'me-pb-55-closed-real-contact-uniform-action-v1';
export const UNIFORM_AUTONOMOUS_ACTION_COOLDOWN_TICKS=12;
const ACTION_IMPULSE_NS=Object.freeze({pass:2.4,shot:3.0,cross:2.7,save:2.6,tackle:1.9,interception:2.1,clearance:2.7,carry:0.42});
export const PROVISIONAL_PHYSICAL_CARRY_IMPULSE_NS=0.42;
// C3.2a: a small GROUND touch is a real Rapier impulse, NOT a virtual
// dribble or privileged possession. Only isolated autonomousCarry fixtures.
const MAX_GAP_M=0.85;
const MAX_HEIGHT_M=0.12;
const PASS_LANE_MIN_CLEARANCE_M=1.9;
const SHOT_LANE_MIN_CLEARANCE_M=2.4;
// Functional-only provisional CROSS: winger with an actually observed
// goal-area teammate; do not treat a cross attempt as pass completion.
export const CROSS_WING_MIN_ABS_Y_M=20;
export const CROSS_WING_MAX_ABS_Y_M=32;
export const CROSS_ATTACK_MIN_X_M=24;
export const CROSS_ATTACK_MAX_X_M=45;
export const CROSS_LANE_MIN_CLEARANCE_M=1.4;

// C2.3b: realistic medium-range attempts, with near-post lanes selected
// only from LIVE opponent positions; this is tactical geometry, not scoring.
export const SHOT_MAX_RANGE_M=35;
export const SHOT_HALF_GOAL_AIM_Y_M=3.1;
const IMMEDIATE_PRESSURE_M=3.0;
export const BASIC_KEEPER_SAVE_VERSION='actions-b02-authentic-keeper-foot-parry-v1';
// No catch, gloves or airborne body simulated yet: one native shoe parry
// of an ACTUAL incoming ball is an attempt, never an official save.
export function eligibleLiveKeeperSave(player,ballPosition,ballVelocity,attackPolarity=1){
 if(player.role!=='goalkeeper')return false;
 const attack=attackDirection(player.team,attackPolarity);
 const ownGoalX=-attack*PLAYER_PITCH.lengthM/2;
 return Math.abs(ownGoalX-ballPosition.x)<=12&&
  Math.abs(ballPosition.y)<=4.5&&
  ballVelocity.x*attack<=-0.5;
}
export const UNIFORM_ACTION_CONTEXT_VERSION='me-pb-55-contextual-lane-observation-v1';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const ids=Object.freeze(INITIAL_PLAYERS.map(p=>p.id));

// Pure geometry: opponent presence is a risk indicator, NEVER proof that
// an interception, tackle or goal occurred. Shared for both teams.
// No opponents means an unobstructed pitch, not invalid infinite geometry.
// 150 m exceeds the pitch diagonal and matches the bounded scorer contract.
// A malformed live coordinate still produces NaN and fails validation.
const OPEN_PITCH_CLEARANCE_M=150;
const nearOpponent=(point,team,players)=>Math.min(
 OPEN_PITCH_CLEARANCE_M,...players.filter(p=>p.team!==team)
  .map(p=>Math.hypot(p.x-point.x,p.y-point.y))
);
function lineClearance(from,to,team,players){
 const dx=to.x-from.x,dy=to.y-from.y,den=dx*dx+dy*dy;
 if(den<=1e-8)return 0;
 return Math.min(OPEN_PITCH_CLEARANCE_M,...players.filter(p=>p.team!==team).map(p=>{
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
// Active goalkeeper duel: scoring intent instead of a seeded shot/carry
// lottery. A goalkeeper is a potential blocker, not an impenetrable
// 2.4m exclusion zone. Rank real goal-mouth lanes; allow a contested
// attempt near goal. All contacts and shot outcomes stay physical.
export function chooseKeeperDuelAttackIntent(ball,velocity,team,keeper){
 const dir=team==='home'?1:-1,goalX=dir*52.5,distance=(goalX-ball.x)*dir;
 if(!keeper||!['home','away'].includes(team)||![ball.x,ball.y,velocity.x,velocity.y,keeper.x,keeper.y].every(finite))return null;
 if(distance<=0.25||Math.abs(ball.y)>20)return null;
 const candidates=[-3.1,-2.2,-1.1,0,1.1,2.2,3.1].map(y=>{
  const target=Object.freeze({x:goalX,y});
  return Object.freeze({target,clearance:lineClearance(ball,target,team,[keeper])});
 });
 candidates.sort((a,b)=>b.clearance-a.clearance||Math.abs(a.target.y)-Math.abs(b.target.y)||a.target.y-b.target.y);
 const best=candidates[0];
 const minimum=distance<=7?0:distance<=15?0.40:1.0;
 if(distance<=26&&best.clearance>=minimum)
  return Object.freeze({action:'shot',lane:best,minimum});
 // When the opening is poor, move toward a better shooting position,
 // not repeatedly push the ball in an arbitrary absolute direction.
 const aimY=Math.max(-8,Math.min(8,best.target.y));
 const angle=Math.atan2(aimY-ball.y,Math.max(distance,3));
 const vx=dir*3.0*Math.cos(angle),vy=3.0*Math.sin(angle);
 const dx=vx-velocity.x,dy=vy-velocity.y;
 const correction=Math.hypot(dx,dy);
 if(correction<0.08)return null;
 return Object.freeze({action:'carry',dx,dy,magnitude:Math.min(0.42,0.43*correction),
  lane:best,minimum});
}
// Distinct high/wide CROSS uses a LIVE same-team penalty-area option.
// Never stages a teammate, creates a contact, or awards a header/goal.
function chooseLiveCrossRecipient(actor,ball,players,attackPolarity=1){
 const attack=attackDirection(actor.team,attackPolarity);
 if(actor.role==='goalkeeper'||
    attack*ball.x<CROSS_ATTACK_MIN_X_M||
    attack*ball.x>CROSS_ATTACK_MAX_X_M||
    Math.abs(ball.y)<CROSS_WING_MIN_ABS_Y_M||
    Math.abs(ball.y)>CROSS_WING_MAX_ABS_Y_M)return null;
 const choices=players.filter(p=>p.team===actor.team&&
  p.id!==actor.id&&p.role!=='goalkeeper'&&
  attack*p.x>=35&&attack*p.x<=49&&Math.abs(p.y)<=12)
  .map(p=>{
   const distanceM=Math.hypot(p.x-ball.x,p.y-ball.y);
   return {player:p,distanceM,
    laneClearanceM:lineClearance(ball,p,actor.team,players),
    defenderGapM:nearOpponent(p,actor.team,players)};
  }).filter(p=>p.distanceM>=8&&p.distanceM<=40&&
   p.laneClearanceM>=CROSS_LANE_MIN_CLEARANCE_M&&
   p.defenderGapM>=1.6)
  .sort((a,b)=>b.laneClearanceM-a.laneClearanceM||
   a.distanceM-b.distanceM||
   ids.indexOf(a.player.id)-ids.indexOf(b.player.id));
 return choices[0]??null;
}
// AERIAL-05: a long pass is a pass subtype, never a disguised cross.
// A distant forward teammate with a safe receiving area is preferred only
// when the ordinary short ground pass or a viable shot is not available.
export function chooseNativeLoftedRecipient(actor,ball,players,attackPolarity=1){
 if(!actor||actor.role==='goalkeeper'||!Array.isArray(players)||![actor.x,actor.y,ball?.x,ball?.y].every(finite))return null;
 const dir=attackDirection(actor.team,attackPolarity);
 return players.filter(p=>p.team===actor.team&&p.id!==actor.id&&p.role!=='goalkeeper')
  .map(p=>{
   const distanceM=Math.hypot(p.x-ball.x,p.y-ball.y),forwardM=dir*(p.x-ball.x),gapM=nearOpponent(p,actor.team,players);
   const laneClearanceM=lineClearance(ball,p,actor.team,players);
   const switchLane=ball.y*p.y<0&&Math.abs(ball.y)>=12&&Math.abs(p.y)>=12&&Math.abs(ball.y-p.y)>=26&&forwardM>=-8;
   const profile=distanceM>=26&&distanceM<=48&&switchLane?'switch':
    distanceM>=26&&distanceM<=48&&forwardM>=8?'long':
    distanceM>=8&&distanceM<=25&&forwardM>=3&&laneClearanceM<PASS_LANE_MIN_CLEARANCE_M?'short':null;
   // A short loft must actually clear a middle-lane obstruction, not an
   // opponent standing on the ball or at the receiving point.
   const middleBlock=profile==='short'&&players.some(q=>{
    if(q.team===actor.team)return false;
    const dx=p.x-ball.x,dy=p.y-ball.y;
    const u=((q.x-ball.x)*dx+(q.y-ball.y)*dy)/(distanceM*distanceM);
    return u>=0.28&&u<=0.72&&Math.hypot(q.x-ball.x-u*dx,q.y-ball.y-u*dy)<1.65;
   });
   return {player:p,distanceM,forwardM,gapM,laneClearanceM,profile:profile==='short'&&!middleBlock?null:profile};
  })
  .filter(p=>p.profile&&p.gapM>=2.2)
  .sort((a,b)=>(Math.min(b.gapM,12)+b.forwardM*0.2-b.distanceM*0.1)-(Math.min(a.gapM,12)+a.forwardM*0.2-a.distanceM*0.1)||a.player.id.localeCompare(b.player.id))[0]??null;
}
export function chooseRecipient(actor,ball,players,attackPolarity=1){
 const attack=attackDirection(actor.team,attackPolarity);
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


// AERIAL-02: shared live shot lane and recipient decisions, with a
// provisional bounded redirect after a genuine native head contact.
// No scripted heading outcome, no LAB-specific action selection.
// AERIAL-06: a real raised-foot receiving contact may become a first-time
// shot if live geometry permits. This is only a decision; the private
// executor is the sole authority for the same-tick physical impulse.
export function chooseNativeVolleyIntent(actor,ball,incoming,players,attackPolarity=1){
 validateAttackPolarity(attackPolarity);
 if(!actor||actor.role==='goalkeeper'||!Array.isArray(players)||!players.some(p=>p.id===actor.id&&p.team===actor.team)||
    ![actor.x,actor.y,ball?.x,ball?.y,ball?.z,incoming?.x,incoming?.y,incoming?.z].every(finite)||
    ball.z<0.55||ball.z>1.15||incoming.z>=-0.15||Math.hypot(incoming.x,incoming.y,incoming.z)>27)return null;
 const dir=attackDirection(actor.team,attackPolarity),goalX=dir*52.5;
 const distance=Math.hypot(goalX-ball.x,ball.y);
 if(dir*(goalX-ball.x)<3||distance>22||nearOpponent(ball,actor.team,players)<1.25)return null;
 const lane=chooseLiveShotLane(ball,goalX,actor.team,players);
 if(!lane)return null;
 const dx=goalX-ball.x,dy=lane.target.y-ball.y;
 const flightS=Math.max(0.25,Math.min(1.05,distance/23));
 const targetZ=0.95;
 return Object.freeze({action:'shot',target:Object.freeze({...lane.target,z:targetZ}),
  desiredVelocity:Object.freeze({x:dx/flightS,y:dy/flightS,z:(targetZ-ball.z)/flightS+4.905*flightS}),
  distanceM:distance,decisionOnly:true});
}
export function chooseNativeHeaderIntent(actor,ball,velocity,players,attackPolarity=1){
 validateAttackPolarity(attackPolarity);
 if(!actor||actor.role==='goalkeeper'||!Array.isArray(players)||!players.some(p=>p.id===actor.id&&p.team===actor.team)||
    ![actor.x,actor.y,ball?.x,ball?.y,ball?.z,velocity?.x,velocity?.y,velocity?.z].every(finite)||
    ball.z<1.45||ball.z>2.55)return null;
 const dir=attackDirection(actor.team,attackPolarity),goalX=dir*52.5;
 const goalDistance=Math.hypot(goalX-ball.x,ball.y);
 const lane=goalDistance<=16?chooseLiveShotLane(ball,goalX,actor.team,players):null;
 const recipient=chooseRecipient(actor,ball,players.filter(p=>p.role!=='goalkeeper'),attackPolarity);
 let action,target,recipientId=null,speed,vz;
 if(lane){action='shot';target=lane.target;speed=11;vz=-1.5;}
 else if(dir*ball.x<-32&&nearOpponent(ball,actor.team,players)<4){
  action='clearance';target={x:ball.x+dir*16,y:ball.y*.5};speed=10;vz=1.4;
 }else if(recipient){
  action='pass';target={x:recipient.player.x,y:recipient.player.y};recipientId=recipient.player.id;
  speed=Math.min(9,4+recipient.ballDistance*.28);vz=-1.6;
 }else{
  action='clearance';target={x:ball.x+dir*14,y:ball.y*.5};speed=9;vz=0.6;
 }
 const dx=target.x-ball.x,dy=target.y-ball.y,distance=Math.hypot(dx,dy);
 if(distance<1e-8)return null;
 return Object.freeze({action,recipientId,target:Object.freeze({...target}),
  desiredVelocity:Object.freeze({x:speed*dx/distance,y:speed*dy/distance,z:vz}),decisionOnly:true});
}

// P0 ONLY: read-only replay of the EXISTING shot-lane and recipient geometry
// helpers on a completed fixture observation. This is not a second policy:
// neither physical shoe START, action cooldown, ball height/velocity nor
// applied impulses are tested here. Never use to authorize an action.
export const UNIFORM_POLICY_GEOMETRY_VERSION=
 'me-p0-uniform-action-geometry-observation-v1';
export function inspectUniformPolicyGeometry({
 tick,playerId,ballPosition,physicalPlayerPositions
}={}){
 if(!Number.isSafeInteger(tick)||tick<1||
    !ids.includes(playerId)||
    !ballPosition||!finite(ballPosition.x)||!finite(ballPosition.y)||
    !finite(ballPosition.z)||!Array.isArray(physicalPlayerPositions)||
    !Object.isFrozen(physicalPlayerPositions)||
    physicalPlayerPositions.length!==ids.length)
  throw new TypeError('Same-tick physical observation shape required');
 const players=Object.freeze(physicalPlayerPositions.map((p,i)=>{
  const expected=INITIAL_PLAYERS[i];
  if(!p||!Object.isFrozen(p)||p.engineId!==expected.id||
     p.team!==expected.team||p.role!==expected.role||
     !finite(p.x)||!finite(p.y))
   throw new TypeError('Canonical observed 22-player geometry required');
  return Object.freeze({id:p.engineId,team:p.team,role:p.role,x:p.x,y:p.y});
 }));
 const actor=players.find(p=>p.id===playerId);
 const goalX=(actor.team==='home'?1:-1)*PLAYER_PITCH.lengthM/2;
 const toGoal=goalX-ballPosition.x;
 const lateralShotWindow=Math.abs(ballPosition.y)<=20;
 const shotRange=Math.abs(toGoal)<=SHOT_MAX_RANGE_M&&lateralShotWindow;
 const lane=shotRange?chooseLiveShotLane(
  ballPosition,goalX,actor.team,players):null;
 const recipient=chooseRecipient(actor,ballPosition,players);
 return Object.freeze({
  version:UNIFORM_POLICY_GEOMETRY_VERSION,physicsTick:tick,
  playerId,team:actor.team,readOnly:true,
  distanceToGoalLineM:Math.abs(toGoal),
  shotRangeShortfallM:Math.max(0,Math.abs(toGoal)-SHOT_MAX_RANGE_M),
  lateralShotWindow,
  shotRange,shotLaneFound:lane!==null,
  shotLaneTarget:lane?Object.freeze({...lane.target}):null,
  shotLaneCenterlineClearanceM:lane?.clearance??null,
  passGeometryRecipientId:recipient?.player.id??null,
  passGeometryRecipientTarget:recipient?Object.freeze({
   x:recipient.player.x,y:recipient.player.y}):null,
  passGeometryLaneClearanceM:recipient?.laneClearanceM??null,
  passGeometryOpponentGapM:recipient?.nearestOpponentM??null,
  // Geometric candidates are NOT verified physical affordances.
  actualShoeContactVerified:null,physicalActionAuthorized:false,
  physicalActionExecuted:false,officialMatchAction:false,
  authorizedAffordances:Object.freeze([])
 });
}

// P0: structural analysis of the ORIGINAL pre-impulse physical input gates.
// Read-only; a caller-supplied object cannot authenticate genuine Rapier START.
// Not a replacement for the action selector or an executable P1 affordance.
export const PHYSICAL_REJECTION_REASONS_VERSION=
 'me-p0-physical-rejection-reasons-pure-v1';
export function inspectPhysicalActionRejection({
 tick,contactStarted,contactActive,playerFrame,ballPosition,ballVelocity,
 lastActionTick=-UNIFORM_AUTONOMOUS_ACTION_COOLDOWN_TICKS,ballRadiusM,
 allowPhysicalCarry=false,isolatedDribbleContext=null
}={}){
 if(!Number.isSafeInteger(tick)||tick<1||
    !Array.isArray(contactStarted)||!Array.isArray(contactActive)||
    new Set(contactStarted).size!==contactStarted.length||
    new Set(contactActive).size!==contactActive.length||
    contactStarted.some(id=>!ids.includes(id)||!contactActive.includes(id))||
    contactActive.some(id=>!ids.includes(id))||
    !playerFrame||playerFrame.version!==PLAYER_VERSION||
    playerFrame.tick!==tick||!Array.isArray(playerFrame.players)||
    playerFrame.players.length!==ids.length||
    !ballPosition||!ballVelocity||
    !['x','y','z'].every(k=>finite(ballPosition[k])&&finite(ballVelocity[k]))||
    !Number.isSafeInteger(lastActionTick)||lastActionTick>tick||
    !finite(ballRadiusM)||ballRadiusM<0.05||ballRadiusM>0.2||
    typeof allowPhysicalCarry!=='boolean')
  throw new TypeError('Same-tick canonical input required');
 const players=playerFrame.players;
 if(players.some((p,i)=>!p||p.id!==ids[i]||
    p.team!==INITIAL_PLAYERS[i].team||!finite(p.x)||!finite(p.y)))
  throw new TypeError('Ordered finite 22-player movement required');
 const exclusive=contactStarted.length===1&&contactActive.length===1&&
  contactStarted[0]===contactActive[0];
 const actor=exclusive?players.find(p=>p.id===contactStarted[0]):null;
 const gap=actor?Math.hypot(actor.x-ballPosition.x,actor.y-ballPosition.y):null;
 const requiredCooldown=['dribble-1v1','carry-solo'].includes(isolatedDribbleContext?.situationId)?
  4:UNIFORM_AUTONOMOUS_ACTION_COOLDOWN_TICKS;
 const firstFailedGate=!exclusive?'no-exclusive-shoe-start':
  tick-lastActionTick<requiredCooldown?'cooldown':
  ballPosition.z<ballRadiusM-0.015||
   ballPosition.z>ballRadiusM+MAX_HEIGHT_M?'ball-height':
  Math.hypot(ballVelocity.x,ballVelocity.y)>14?'ball-speed':
  !Number.isFinite(gap)||gap>MAX_GAP_M?'shoe-ball-gap':null;
 return Object.freeze({
  version:PHYSICAL_REJECTION_REASONS_VERSION,physicsTick:tick,
  actorId:actor?.id??null,exclusiveShoeStart:exclusive,
  firstFailedGate,passedInputGates:firstFailedGate===null,
  sourceAuthenticatedByShape:false,authorizesPhysicalAction:false,
  physicalActionExecuted:false,readOnly:true,
  authorizedAffordances:Object.freeze([])
 });
}

export function selectUniformAutonomousContactAction({
 tick,contactStarted,contactActive,playerFrame,ballPosition,ballVelocity,
 lastActionTick=-UNIFORM_AUTONOMOUS_ACTION_COOLDOWN_TICKS,ballRadiusM,
 allowPhysicalCarry=false,activePlayerIds=null,smallSidedDecisionContext=null,
 isolatedDribbleContext=null,keeperSingleShotSide=null,duelTransition=null,interceptionContext=null,blockContext=null,collectiveControl=null,nativeActionPolicy=false,attackPolarity=1
}){
 validateAttackPolarity(attackPolarity);
 if(attackPolarity!==1&&(!nativeActionPolicy||activePlayerIds?.length!==22))
  throw new TypeError('Reversed actions require all original native full-field participants');
 if(typeof nativeActionPolicy!=='boolean'||(nativeActionPolicy&&(!allowPhysicalCarry||!Array.isArray(activePlayerIds)||smallSidedDecisionContext!==null||isolatedDribbleContext!==null||keeperSingleShotSide!==null||blockContext!==null||interceptionContext!==null)))throw new TypeError('Native action policy requires explicit physical participants and no isolated action override');
 if(collectiveControl!==null&&(!nativeActionPolicy||collectiveControl.tick!==tick-1||collectiveControl.officialPossession!==false||!['controlled','loose'].includes(collectiveControl.kind)|| (collectiveControl.kind==='controlled'&&!activePlayerIds?.includes(collectiveControl.playerId))))throw new TypeError('Prior native collective control required');
 if(nativeActionPolicy&&collectiveControl===null)throw new TypeError('Collective action needs live control observation');
 if(blockContext!==null&&(!['home','away'].includes(blockContext.side)||typeof blockContext.shotTaken!=='boolean'||activePlayerIds?.length!==3||!activePlayerIds.includes(blockContext.side+'-10')||!activePlayerIds.includes((blockContext.side==='home'?'away':'home')+'-2')||!activePlayerIds.includes((blockContext.side==='home'?'away':'home')+'-1')||interceptionContext!==null||isolatedDribbleContext!==null||smallSidedDecisionContext!==null||keeperSingleShotSide!==null))throw new TypeError('Bounded three-player shot block context required');
 if(interceptionContext!==null&&(!['home','away'].includes(interceptionContext.side)||!['ready','flight','intercepted','collected','received'].includes(interceptionContext.phase)||activePlayerIds?.length!==3||!activePlayerIds.includes(interceptionContext.side+'-10')||!activePlayerIds.includes(interceptionContext.side+'-9')||!activePlayerIds.includes((interceptionContext.side==='home'?'away':'home')+'-2')||isolatedDribbleContext!==null||smallSidedDecisionContext!==null))throw new TypeError('Bounded three-player pass interception context required');
 if(duelTransition!==null&&(isolatedDribbleContext?.directed!==true||duelTransition.tick!==tick-1||!['attack','recover','counter'].includes(duelTransition.phase)))
  throw new TypeError('Prior real directed duel transition required');
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
    typeof allowPhysicalCarry!=='boolean'||
    (keeperSingleShotSide!==null&&(!['home','away'].includes(keeperSingleShotSide)||
     activePlayerIds?.length!==2||!activePlayerIds.includes(keeperSingleShotSide+'-10')||
     !activePlayerIds.includes((keeperSingleShotSide==='home'?'away':'home')+'-1')))||
    (activePlayerIds!==null&&(!Array.isArray(activePlayerIds)||
      activePlayerIds.length<1||activePlayerIds.length>(nativeActionPolicy?22:7)||
      new Set(activePlayerIds).size!==activePlayerIds.length||
      activePlayerIds.some(id=>!ids.includes(id))))||
    (isolatedDribbleContext!==null&&(
      !['dribble-1v1','carry-solo'].includes(isolatedDribbleContext?.situationId)||
      !['home','away'].includes(isolatedDribbleContext?.attackingSide)||
      !Number.isSafeInteger(isolatedDribbleContext?.variantIndex)||
      isolatedDribbleContext.variantIndex<0||isolatedDribbleContext.variantIndex>29||
      activePlayerIds===null||activePlayerIds.length!==(isolatedDribbleContext.situationId==='carry-solo'?1:2)||
      !activePlayerIds.includes(isolatedDribbleContext.attackingSide+'-10')||
      (isolatedDribbleContext.situationId==='dribble-1v1'&&!activePlayerIds.includes((isolatedDribbleContext.attackingSide==='home'?'away':'home')+'-2'))||
      allowPhysicalCarry!==true))||
    (smallSidedDecisionContext!==null&&(
      activePlayerIds===null||allowPhysicalCarry!==true||
      typeof smallSidedDecisionContext!=='object'||
      !['home','away'].includes(smallSidedDecisionContext.attackingSide)||
      typeof smallSidedDecisionContext.situationId!=='string'||
      !Number.isSafeInteger(smallSidedDecisionContext.variantIndex)||
      smallSidedDecisionContext.variantIndex<1||smallSidedDecisionContext.collective!==undefined||
      smallSidedDecisionContext.variantIndex>29)))
  throw new TypeError('Verified same-tick movement, ball and real Rapier shoe starts required');
 // A4.2b.3: an ambiguous START/ACTIVE contact cannot confer a right
 // to kick the ball. Require one genuine START and no other active shoe.
 // Multi-contact remains real physics evidence, never a possession award.
 if(contactStarted.length!==1||contactActive.length!==1||
    contactActive[0]!==contactStarted[0])return null;
 const requiredCooldown=isolatedDribbleContext!==null?
  4:UNIFORM_AUTONOMOUS_ACTION_COOLDOWN_TICKS;
 if(tick-lastActionTick<requiredCooldown||
    ballPosition.z<ballRadiusM-0.015||
    ballPosition.z>ballRadiusM+MAX_HEIGHT_M||
    Math.hypot(ballVelocity.x,ballVelocity.y)>14)
  return null;
 // All 22 original identities remain validated; only truly collider-enabled
 // participants enter small-sided tactical choices, never hidden 11v11 actors.
 const allActors=playerFrame.players;
 const actors=activePlayerIds===null?allActors:
  allActors.filter(p=>activePlayerIds.includes(p.id));
 // Canonical frame is validated separately by createEngine before mutation.
 for(let i=0;i<allActors.length;i++)
  if(allActors[i]?.id!==ids[i]||allActors[i].team!==INITIAL_PLAYERS[i].team)
   throw new TypeError('Trusted ordered 22-person movement required');
 for(const id of contactStarted){
  if(activePlayerIds!==null&&!activePlayerIds.includes(id))
   throw new TypeError('Inactive player has no authenticated Rapier shoe');
  const player=actors.find(p=>p.id===id);
  if(!player)continue;
  if(blockContext&&!(blockContext.shotTaken?player.role==='goalkeeper'&&player.team!==blockContext.side&&eligibleLiveKeeperSave(player,ballPosition,ballVelocity):id===blockContext.side+'-10'))continue;
  const sharedDuel=isolatedDribbleContext?.directed===true&&isolatedDribbleContext.situationId==='dribble-1v1';
  if(isolatedDribbleContext!==null&&id!==isolatedDribbleContext.attackingSide+'-10'&&!sharedDuel)
   continue;
  const gap=Math.hypot(player.x-ballPosition.x,player.y-ballPosition.y);
  if(!finite(gap)||gap>MAX_GAP_M)continue;
  const attack=attackDirection(player.team,attackPolarity);
  const goalX=attack*PLAYER_PITCH.lengthM/2;
  const toGoal=goalX-ballPosition.x;
  const nearestOpponentM=nearOpponent(player,player.team,actors);
  const goalTarget=Object.freeze({x:goalX,y:0});
  const shotRange=Math.abs(toGoal)<=SHOT_MAX_RANGE_M&&
   Math.abs(ballPosition.y)<=20;
  const activeKeeperAttacker=keeperSingleShotSide===player.team&&id===player.team+'-10';
  const duelIntent=activeKeeperAttacker?chooseKeeperDuelAttackIntent(ballPosition,ballVelocity,player.team,
   actors.find(p=>p.team!==player.team&&p.role==='goalkeeper')):null;
  const chosenShotLane=activeKeeperAttacker?(duelIntent?.action==='shot'?duelIntent.lane:null):
   shotRange?chooseLiveShotLane(ballPosition,goalX,player.team,actors):null;
  const shotLaneM=chosenShotLane?.clearance??
   lineClearance(ballPosition,goalTarget,player.team,actors);
  const collective=nativeActionPolicy;
  const owner=collectiveControl?.kind==='controlled'?actors.find(p=>p.id===collectiveControl.playerId):null;
  const opponentControl=!!owner&&owner.team!==player.team&&Math.hypot(owner.x-ballPosition.x,owner.y-ballPosition.y)<=1.15;
  const nativeSlide=collective?playerFrame.nativeSlides?.[id]??null:null;
  if(collective&&(isNativeRecoveryLocked(collectiveControl,id,tick)||nativeSlide?.phase==='recovery'))continue;
  const collectiveTouch=collective?chooseCollectiveDefensiveTouch({player,players:actors,ballPosition,ballVelocity,control:collectiveControl,tick,slide:nativeSlide,ballRadiusM,attackPolarity}):null;
  if(nativeSlide?.phase==='slide'&&!collectiveTouch)continue;
  const defensiveAttempt=collective?null:chooseBasicDefensiveAttempt({actor:player,players:actors,ball:ballPosition,velocity:ballVelocity});
  // LAB-VAR-02 only: AFTER verified genuine exclusive Rapier shoe START,
  // examine live legitimate affordances. Normal 22-player policy, keeper
  // and defensive priority, and archival V01 remain byte-identical.
  const contextualAttacker=!activeKeeperAttacker&&isolatedDribbleContext===null&&
   (collective?!opponentControl:smallSidedDecisionContext!==null&&player.team===smallSidedDecisionContext.attackingSide)&&
   player.role!=='goalkeeper'&&!defensiveAttempt&&!collectiveTouch;
  const contextualRecipient=contextualAttacker?
   chooseRecipient(player,ballPosition,actors,attackPolarity):null;
  const carryPossible=contextualAttacker&&allowPhysicalCarry&&
   Math.abs(ballPosition.y)<=20&&
   (collective||attack*ballPosition.x>=-30)&&attack*ballPosition.x<=45&&
   Math.abs(toGoal)>5&&
   Math.hypot(ballVelocity.x,ballVelocity.y)<=8;
  const contextualChoice=contextualAttacker?
   (collective?chooseNativeFootballAction:chooseSmallSidedContextAction)({
    ...(!collective?{situationId:smallSidedDecisionContext.situationId,variantIndex:smallSidedDecisionContext.variantIndex,tick,actorId:id,team:player.team,attackingSide:smallSidedDecisionContext.attackingSide}:{}),
    goalDistanceM:Math.abs(toGoal),nearestOpponentM,
    shotLaneClearanceM:chosenShotLane?.clearance??null,
    passLaneClearanceM:contextualRecipient?.laneClearanceM??null,
    recipientOpponentGapM:contextualRecipient?.nearestOpponentM??null,
    passForwardM:contextualRecipient?.forward??null,
    canShoot:chosenShotLane!==null,
    canPass:contextualRecipient!==null,
    canCarry:carryPossible
   }):null;
  const slide=sharedDuel&&playerFrame.duelSlide?.actorId===id&&playerFrame.duelSlide.tick===tick?playerFrame.duelSlide:null;
  const opponent=sharedDuel?actors.find(p=>p.team!==player.team):null;
  const sharedTouch=sharedDuel?chooseSharedDuelTouch({player,opponent,ballPosition,ballVelocity,transition:duelTransition,
   slide,defensiveDecision:playerFrame.defensiveDecision?.actorId===id?playerFrame.defensiveDecision:null,variantIndex:isolatedDribbleContext.variantIndex,tick}):null;
  if(sharedDuel&&!sharedTouch)continue;
  const ic=interceptionContext;
  const defending=ic&&player.team!==ic.side;
  if(ic&&!(ic.phase==='ready'&&id===ic.side+'-10')&&!(defending&&['flight','intercepted','collected'].includes(ic.phase)))continue;
  let interceptionTouch=null;
  if(defending&&ic.phase==='flight'){
   const recipient=actors.find(p=>p.id===ic.side+'-9');
   const passer=actors.find(p=>p.id===ic.side+'-10');
   interceptionTouch=chooseNativePassInterceptionTouch({passer,recipient,defender:player,ballPosition,ballVelocity,ballRadiusM});
   if(!interceptionTouch)continue;
  }
  const duelDefensiveTouch=collectiveTouch??interceptionTouch??sharedTouch?.defensive??null;
  const dribbleTouch=defending&&['intercepted','collected'].includes(ic.phase)?chooseDirectedDribbleTouch({attackingSide:player.team,attacker:player,defender:actors.find(p=>p.id===ic.side+'-9'),ballPosition,ballVelocity,variantIndex:0,tick}):sharedDuel?sharedTouch.carry:isolatedDribbleContext===null?null:
   chooseIsolatedDribbleTouch({
    variantIndex:isolatedDribbleContext.variantIndex,tick,
    attackingSide:isolatedDribbleContext.attackingSide,
    ballPosition,ballVelocity,attacker:player,
    solo:isolatedDribbleContext.situationId==='carry-solo',
    defender:isolatedDribbleContext.situationId==='carry-solo'?null:actors.find(p=>p.team!==player.team)
   });
  let action,recipient=null,recipientInfo=null,crossInfo=null,loftedInfo=null,dx,dy,vertical=0,rule;
  if(blockContext&&!blockContext.shotTaken){
   action='shot';dx=toGoal;dy=(ballPosition.y>=0?2.65:-2.65)-ballPosition.y;vertical=0;
   rule='isolated-block-lab-single-ground-shot';
  }else if(ic?.phase==='ready'){
   recipient=actors.find(p=>p.id===ic.side+'-9');
   action='pass';dx=recipient.x-ballPosition.x;dy=recipient.y-ballPosition.y;
   rule='isolated-interception-lab-original-ground-pass';
  }else if(duelDefensiveTouch){
   action=duelDefensiveTouch.kind;dx=duelDefensiveTouch.dx;dy=duelDefensiveTouch.dy;
   rule=collectiveTouch?'collective-native-defensive-ground-touch':'directed-duel-native-defensive-ground-touch';
  }else if(dribbleTouch!==null){
   if(dribbleTouch.magnitudeNs<0.025)continue;
   action='carry';dx=dribbleTouch.dx;dy=dribbleTouch.dy;
   rule=ic?'interception-recovery-native-carry':isolatedDribbleContext?.directed===true?'directed-live-opponent-ground-touch':'isolated-dribble-real-shoe-variable-ground-touch';
  }else if(eligibleLiveKeeperSave(player,ballPosition,ballVelocity,attackPolarity)){
   action='save';dx=attack*7;
   dy=ballPosition.y>=0?9:-9;vertical=0.24;
   rule='incoming-goalward-keeper-physical-parry-attempt';
  }else if(activeKeeperAttacker){
   if(!duelIntent)continue;
   action=duelIntent.action;
   if(action==='shot'){dx=toGoal;dy=chosenShotLane.target.y-ballPosition.y;vertical=0.24;
    rule='keeper-duel-best-live-goal-lane';}
   else{dx=duelIntent.dx;dy=duelIntent.dy;rule='keeper-duel-bounded-directed-carry';}
  }else if(defensiveAttempt){
   action=defensiveAttempt.kind;
   dx=defensiveAttempt.targetX-ballPosition.x;
   dy=defensiveAttempt.targetY-ballPosition.y;
   vertical=0.16;
   rule=action==='tackle'?
    'observed-near-opponent-ground-ball-poke-attempt':
    'observed-inbound-ball-line-block-attempt';
  }else if(collective&&opponentControl&&player.role!=='goalkeeper'){
   // An opponent's controlled ball cannot become a pass/shot just because
   // the challenger reached the shoe gate. A feasible defensive action
   // has already been handled above.
   continue;
  }else if(collective&&(crossInfo=chooseLiveCrossRecipient(player,ballPosition,actors,attackPolarity))){
   // A genuine wide delivery opportunity takes precedence over the
   // generic ground-pass fallback; use the same existing cross profile.
   recipient=crossInfo.player;action='cross';dx=recipient.x-ballPosition.x;
   dy=recipient.y-ballPosition.y;vertical=0.42;rule='wide-live-teammate-lofted-cross';
  }else if(collective&&contextualAttacker&&!contextualRecipient&&!chosenShotLane&&
    (loftedInfo=chooseNativeLoftedRecipient(player,ballPosition,actors,attackPolarity))){
   recipient=loftedInfo.player;action='pass';dx=recipient.x-ballPosition.x;dy=recipient.y-ballPosition.y;
   vertical=0.65;rule='live-'+loftedInfo.profile+'-teammate-lofted-pass';
  }else if(contextualChoice?.selected==='pass'){
   recipientInfo=contextualRecipient;
   recipient=recipientInfo.player;
   action='pass';dx=recipient.x-ballPosition.x;
   dy=recipient.y-ballPosition.y;
   rule='small-sided-live-context-safe-pass';
  }else if(contextualChoice?.selected==='carry'){
   action='carry';dx=attack*8;dy=-ballPosition.y*0.12;
   rule='small-sided-live-context-short-physical-touch';
  }else if(chosenShotLane){
   action='shot';dx=toGoal;
   dy=chosenShotLane.target.y-ballPosition.y;vertical=0.24;
   rule=chosenShotLane.target.y===0?
    'unblocked-goal-lane':'unblocked-near-post-lane';
  }else{
   crossInfo=chooseLiveCrossRecipient(player,ballPosition,actors,attackPolarity);
   recipientInfo=crossInfo?null:chooseRecipient(player,ballPosition,actors,attackPolarity);
   if(crossInfo){
    recipient=crossInfo.player;
    action='cross';dx=recipient.x-ballPosition.x;
    dy=recipient.y-ballPosition.y;
    vertical=0.42;
    rule='wide-live-teammate-lofted-cross';
   }else 
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
  // Only a selected native carry gets the common live opponent geometry.
  // No shirt/fixture selection, and no extra impulse for an already
  // satisfactory rolling ball. Other action kinds remain untouched.
  let nativeCarryTouch=null;
  if(collective&&action==='carry'){
   const nearest=actors.filter(p=>p.team!==player.team).sort((a,b)=>Math.hypot(a.x-ballPosition.x,a.y-ballPosition.y)-Math.hypot(b.x-ballPosition.x,b.y-ballPosition.y)||a.id.localeCompare(b.id))[0]??null;
   nativeCarryTouch=planNativeCarryTouch({attacker:player,attackingSide:player.team,defender:nearest,ballPosition,ballVelocity,tieSide:ballPosition.y>0?-1:1,attackPolarity});
   if(nativeCarryTouch.magnitudeNs<0.025)continue;
   dx=nativeCarryTouch.dx;dy=nativeCarryTouch.dy;
   rule='native-live-opponent-ground-touch';
  }
  const length=Math.hypot(dx,dy);
  if(length<1e-5)continue;
  const magnitude=duelDefensiveTouch?.magnitudeNs??dribbleTouch?.magnitudeNs??nativeCarryTouch?.magnitudeNs??(activeKeeperAttacker&&action==='carry'?duelIntent.magnitude:ACTION_IMPULSE_NS[action]),factor=magnitude/
   Math.hypot(dx,dy,vertical*length);
  const impulseNs=Object.freeze({x:dx*factor,y:dy*factor,
   z:vertical*length*factor});
  // C1.1: the live teammate and ball geometry at THIS movement tick,
  // frozen before Rapier applies the impulse. A target is only intent,
  // never evidence of reception or a completed football pass.
  const defensiveTarget=duelDefensiveTouch?Object.freeze({...duelDefensiveTouch,physicsTick:tick,
   ...(action==='tackle'?{intervention:(slide?.phase==='slide'||nativeSlide?.phase==='slide'&&duelDefensiveTouch.slidingStrike===true)?'sliding-tackle':'standing-tackle'}:{})}):defensiveAttempt&&
   ['tackle','interception'].includes(action)?
   Object.freeze({...defensiveAttempt,physicsTick:tick}):null;
  const saveTarget=action==='save'?Object.freeze({
   source:BASIC_KEEPER_SAVE_VERSION,
   actorId:id,team:player.team,physicsTick:tick,
   incomingVelocityX:ballVelocity.x,incomingVelocityY:ballVelocity.y,
   originX:ballPosition.x,originY:ballPosition.y,
   ownGoalX:-attack*PLAYER_PITCH.lengthM/2,
   nativeExclusiveShoeRequired:true,
   physicalSaveAttemptOnly:true,saveConfirmed:false,officialSave:false,
   officialGoal:false,officialPossession:false
  }):null;
  const shotTarget=action==='shot'?Object.freeze({
   source:'same-tick-closed-goal-lane-from-live-22-players',
   shooterId:id,team:player.team,physicsTick:tick,
   originX:ballPosition.x,originY:ballPosition.y,
   targetX:blockContext?goalX:chosenShotLane.target.x,targetY:blockContext?ballPosition.y+dy:chosenShotLane.target.y,
   laneClearanceM:blockContext?lineClearance(ballPosition,{x:goalX,y:ballPosition.y+dy},player.team,actors):chosenShotLane.clearance,
   ...(activeKeeperAttacker?{keeperDuelMinimumLaneClearanceM:duelIntent.minimum}:{}),
   attemptOnly:true,shotOnTarget:null,goalScored:null
  }):null;
  const carryTarget=action==='carry'?Object.freeze({
   source:nativeCarryTouch?'native-live-opponent-ground-touch':dribbleTouch?'isolated-dribble-real-rapier-shoe-touch':
    'same-tick-exclusive-rapier-shoe-short-ground-touch',
   actorId:id,team:player.team,physicsTick:tick,
   originX:ballPosition.x,originY:ballPosition.y,
   impulseMagnitudeNs:magnitude,
   shortGroundTouchOnly:true,physicalRecontactObserved:false,
   dribbleConfirmed:null,officialMatchResult:null
  }):null;
  const crossTarget=action==='cross'?Object.freeze({
   source:'same-tick-canonical-wing-and-live-goal-area-teammate',
   originPlayerId:id,recipientId:recipient.id,
   originX:ballPosition.x,originY:ballPosition.y,
   targetX:recipient.x,targetY:recipient.y,
   distanceM:Math.hypot(dx,dy),
   laneClearanceM:crossInfo.laneClearanceM,
   team:player.team,physicsTick:tick,
   physicalCrossAttemptOnly:true,crossCompleted:false,
   officialMatchAction:false,officialGoal:false
  }):null;
  const passTarget=action==='pass'?Object.freeze({
   source:'same-tick-canonical-22-player-positions',
   originPlayerId:id,recipientId:recipient.id,
   originX:ballPosition.x,originY:ballPosition.y,
   recipientX:recipient.x,recipientY:recipient.y,
   distanceM:Math.hypot(dx,dy),
   forwardM:(recipient.x-player.x)*attack,
   team:player.team,physicsTick:tick,
   ...(loftedInfo?{deliveryProfile:'lofted',loftedProfile:loftedInfo.profile,recipientOpponentGapM:loftedInfo.gapM}:{}),
   physicalPassAttemptOnly:true,passCompleted:false
  }):null;
  return Object.freeze({
   version:UNIFORM_AUTONOMOUS_ACTION_VERSION,tick,
   playerId:id,team:player.team,
   action,recipientId:recipient?.id??null,
   passTarget,shotTarget,crossTarget,saveTarget,defensiveTarget,
    carryTarget,measuredGapM:gap,
   // Same-tick PRE-impulse values from the only existing contact selector.
   // No new eligibility policy or source authentication for caller input.
   physicalPrerequisites:Object.freeze({
    physicsTick:tick,actorId:id,source:'real-selector-inputs-pre-impulse',
    exclusiveShoeStart:true,
    cooldownElapsedTicks:tick-lastActionTick,
    cooldownMinimumTicks:requiredCooldown,
    shoeBallGapM:gap,ballHeightM:ballPosition.z,
    ballRadiusM,ballHorizontalSpeedMps:Math.hypot(ballVelocity.x,ballVelocity.y),
    originalPhysicalGuardsPassed:true,
    authorizesOfficialAction:false,contactAuthenticatedByShape:false
   }),
   physicalTrigger:'same-tick-real-rapier-shoe-start',
   movementSource:'canonical-22-player-autonomous-mover',
   impulseNs,appliedByRapier:false,
   decisionContext:Object.freeze({
    version:UNIFORM_ACTION_CONTEXT_VERSION,
    rule,nearestOpponentM,
    underImmediatePressure:nearestOpponentM<IMMEDIATE_PRESSURE_M,
    shotLaneClearanceM:shotLaneM,shotRange,
    passLaneClearanceM:recipientInfo?.laneClearanceM??null,
    chosenRecipientOpponentGapM:recipientInfo?.nearestOpponentM??
     crossInfo?.defenderGapM??null,
    outcomeNotYetObserved:true,
    opponentTackleProven:false,interceptionProven:false,
    passCompleted:false,goalScored:false,
    ...(contextualChoice?{smallSidedChoice:contextualChoice}:{}),
    ...(dribbleTouch?{isolatedDribbleTouch:dribbleTouch}:{}),
    ...(nativeCarryTouch?{nativeCarryTouch}:{})
   }),
   temporaryPlayersOnly:true,uniformPlayerStats:true,
   officialMatchAction:false,officialMatchPossession:false,
   officialGoalEvidence:false,officialMatchResult:null
  });
 }
 return null;
}
