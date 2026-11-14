// ME-PB-37 — conditional, ownerless loose-ball pursuit after an observed
// physical opponent shoe START. This is a tactical AIM, not an official
// interception, possession, tackle, kick, event, or ball-force source.
// The 22-player movement engine alone applies the existing bounded 60Hz
// acceleration, speed, turn, and real player-separation constraints.
import {INITIAL_PLAYERS,PLAYER_PITCH} from './player-movement.mjs';
import {OPPOSITION_FLIGHT_VERSION,OPPOSITION_FLIGHT_CONFIRM_TICKS,
 OPPOSITION_FLIGHT_MAX_FOLLOWUP_TICKS}
 from './player-ball-opposition-flight.mjs';
export const LOOSE_RESPONSE_VERSION='me-pb-37-ownerless-reaction-v1';
export const LOOSE_RESPONSE_MAX_TICKS=90;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const xy=p=>p&&finite(p.x)&&finite(p.y);
// Lazy read avoids evaluating the movement module's roster while the
// circular ESM module graph is still initializing.
const eligible=()=>INITIAL_PLAYERS.filter(p=>p.role!=='goalkeeper')
 .map(p=>p.id);
const terminal=new Set(['confirmed-changed-flight',
 'contact-only-no-confirmed-change','insufficient-incoming-flight']);
function validateAudit(a){
 return a&&a.version===OPPOSITION_FLIGHT_VERSION&&
  a.contactShoeStartProven===true&&
  Number.isSafeInteger(a.contactTick)&&a.contactTick>=1&&
  Number.isSafeInteger(a.precedingPassTick)&&
  a.precedingPassTick<a.contactTick&&
  Number.isSafeInteger(a.tick)&&a.tick>=a.contactTick&&
  Number.isSafeInteger(a.followupTicks)&&a.followupTicks>=0&&
  a.tick===a.contactTick+a.followupTicks&&
  terminal.has(a.status)&&
  (a.status==='confirmed-changed-flight'?
    a.followupTicks>=OPPOSITION_FLIGHT_CONFIRM_TICKS:
   a.status==='contact-only-no-confirmed-change'?
    a.followupTicks===OPPOSITION_FLIGHT_MAX_FOLLOWUP_TICKS:
    a.followupTicks===0)&&
  a.solverAttribution==='aggregate-not-individual-foot'&&
  a.officialPossession===false&&a.interceptionProven===false&&
  a.passCreated===false&&a.physicalCauseExclusivelyProven===false;
}
function validatePlayers(players){
 if(!Array.isArray(players)||players.length!==INITIAL_PLAYERS.length)
  throw new TypeError('Canonical actual 22-player XY required');
 const ids=new Set();
 for(let i=0;i<INITIAL_PLAYERS.length;i++){
  const p=players[i],baseline=INITIAL_PLAYERS[i];
  if(!p||p.id!==baseline.id||p.team!==baseline.team||
     p.role!==baseline.role||!xy(p)||ids.has(p.id)||
     Math.abs(p.x)>PLAYER_PITCH.lengthM/2||
     Math.abs(p.y)>PLAYER_PITCH.widthM/2)
   throw new TypeError('Canonical measured player identity and pitch XY required');
  ids.add(p.id);
 }
}
function measuredBall(ball){
 if(!xy(ball)||Math.abs(ball.x)>PLAYER_PITCH.lengthM/2||
     Math.abs(ball.y)>PLAYER_PITCH.widthM/2)
  throw new TypeError('Real Rapier ball XY within pitch required');
 return Object.freeze({x:ball.x,y:ball.y});
}
function choose(players,ball,team){
 const choices=players.filter(p=>p.team===team&&eligible().includes(p.id))
  .map(p=>({id:p.id,d:Math.hypot(p.x-ball.x,p.y-ball.y)}))
  .sort((a,b)=>a.d-b.d||(a.id<b.id?-1:a.id>b.id?1:0));
 if(choices.length!==10)throw new TypeError('Ten real outfielders per team required');
 return choices[0].id;
}
export function beginObservedLooseBallResponse({
 audit,players,ballPosition,movementTick
}){
 if(!validateAudit(audit)||!Number.isSafeInteger(movementTick)||
    movementTick!==audit.tick+1)
  throw new TypeError('Terminal real opponent flight and next 60Hz step required');
 validatePlayers(players);
 const ball=measuredBall(ballPosition);
 const responders=Object.freeze({
  home:choose(players,ball,'home'),
  away:choose(players,ball,'away')
 });
 if(responders.home===responders.away)
  throw new TypeError('Independent real team responders required');
 return Object.freeze({
  version:LOOSE_RESPONSE_VERSION,
  contactTick:audit.contactTick,precedingPassTick:audit.precedingPassTick,
  observedFlightStatus:audit.status,
  observedFlightClassification:audit.classification,
  initiatedAtMovementTick:movementTick,
  lastMovementTick:movementTick,
  phase:'responding',responseTicks:1,
  responders,observedBall:ball,
  reason:'respond-to-measured-ownerless-ball',
  officialPossession:false,interceptionProven:false,
  passCreated:false,contactInferred:false,ballForceApplied:false
 });
}
export function advanceObservedLooseBallResponse({
 plan,audit,players,ballPosition,movementTick
}){
 if(!plan||plan.version!==LOOSE_RESPONSE_VERSION||
    !['responding','completed'].includes(plan.phase)||
    !Number.isSafeInteger(plan.contactTick)||plan.contactTick<1||
    !Number.isSafeInteger(plan.lastMovementTick)||
    !Number.isSafeInteger(plan.initiatedAtMovementTick)||
    !Number.isSafeInteger(plan.responseTicks)||
    plan.responseTicks<1||plan.responseTicks>LOOSE_RESPONSE_MAX_TICKS||
    !plan.responders||!eligible().includes(plan.responders.home)||
    !eligible().includes(plan.responders.away)||
    !plan.responders.home.startsWith('home-')||
    !plan.responders.away.startsWith('away-')||
    !validateAudit(audit)||audit.contactTick!==plan.contactTick||
    audit.precedingPassTick!==plan.precedingPassTick||
    !Number.isSafeInteger(movementTick)||
    movementTick!==plan.lastMovementTick+1)
  throw new TypeError('Next genuine ownerless ball response movement tick required');
 if(plan.phase==='completed')return plan;
 validatePlayers(players);
 const ball=measuredBall(ballPosition);
 const ticks=plan.responseTicks+1;
 return Object.freeze({...plan,lastMovementTick:movementTick,
  responseTicks:Math.min(ticks,LOOSE_RESPONSE_MAX_TICKS),
  observedBall:ball,
  phase:ticks>=LOOSE_RESPONSE_MAX_TICKS?'completed':'responding',
  completionReason:ticks>=LOOSE_RESPONSE_MAX_TICKS?
   'bounded-recovery-window':null,
  officialPossession:false,interceptionProven:false,
  passCreated:false,contactInferred:false,ballForceApplied:false
 });
}
