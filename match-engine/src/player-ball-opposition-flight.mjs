// ME-PB-36: read-only follow-up after a GENUINE Rapier Away shoe START.
// A physical touch is not, by itself, proof of interception or possession.
// Observed velocity belongs to the entire Rapier solver (gravity/grass/
// multiple colliders included), not exclusively to the contacting player.
import {FOOT_CONTACT_VERSION} from './player-foot-contact.mjs';
import {LOCAL_EXCHANGE_VERSION} from './player-ball-local-exchange.mjs';
export const OPPOSITION_FLIGHT_VERSION='me-pb-36-observed-opposition-flight-v1';
export const OPPOSITION_FLIGHT_CONFIRM_TICKS=3;
export const OPPOSITION_FLIGHT_MAX_FOLLOWUP_TICKS=6;
export const OPPOSITION_FLIGHT_MIN_INCOMING_MPS=1.5;
export const OPPOSITION_FLIGHT_SLOW_RATIO=0.4;
export const OPPOSITION_FLIGHT_REDIRECT_DEG=30;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const vector=v=>v&&['x','y','z'].every(k=>finite(v[k]));
const speed=v=>Math.hypot(v.x,v.y);
const frozenVector=v=>Object.freeze({x:v.x,y:v.y,z:v.z});
const passStage=s=>s==='pass'||s==='return-pass';
export function beginObservedOppositionFlight({
 contact,contactFrame,passEvent,preSolverVelocity,postSolverVelocity,tick
}){
 if(!Number.isSafeInteger(tick)||tick<1||
    !contact||contact.version!==LOCAL_EXCHANGE_VERSION||
    contact.stage!=='opponent-contact'||
    contact.physicalTrigger!=='real-rapier-foot-contact-start'||
    contact.actualShoeStart!==true||
    contact.tick!==tick||contact.playerId!=='away-10'&&
      !/^(?:away)-(?:[1-9]|11)$/.test(contact.playerId??'')||
    contact.officialMatchAction!==false||
    !contactFrame||contactFrame.version!==FOOT_CONTACT_VERSION||
    contactFrame.tick!==tick||!Array.isArray(contactFrame.started)||
    new Set(contactFrame.started).size!==contactFrame.started.length||
    !contactFrame.started.includes(contact.playerId)||
    !passEvent||!passStage(passEvent.stage)||
    passEvent.appliedByRealRapier!==true||
    passEvent.officialMatchAction!==false||
    !Number.isSafeInteger(passEvent.tick)||passEvent.tick>=tick||
    !vector(preSolverVelocity)||!vector(postSolverVelocity))
   throw new TypeError('Actual synchronized Rapier opponent START and preceding applied pass required');
 const incomingGroundSpeedMps=speed(preSolverVelocity);
 const afterSolverGroundSpeedMps=speed(postSolverVelocity);
 const solverPlanarDeltaMps=Math.hypot(
  postSolverVelocity.x-preSolverVelocity.x,
  postSolverVelocity.y-preSolverVelocity.y
 );
 const hasDirectionalReference=incomingGroundSpeedMps>=
   OPPOSITION_FLIGHT_MIN_INCOMING_MPS;
 return Object.freeze({
  version:OPPOSITION_FLIGHT_VERSION,
  contactTick:tick,tick,playerId:contact.playerId,
  precedingPassTick:passEvent.tick,
  contactShoeStartProven:true,
  incomingVelocity:frozenVector(preSolverVelocity),
  afterSolverVelocity:frozenVector(postSolverVelocity),
  incomingGroundSpeedMps,afterSolverGroundSpeedMps,
  solverPlanarDeltaMps,
  solverAttribution:'aggregate-not-individual-foot',
  status:hasDirectionalReference?'observing':'insufficient-incoming-flight',
  classification:'contact-only-not-interception',
  followupTicks:0,consistentChangeTicks:0,
  lastChangeKind:null,projectedSpeedMps:null,
  officialPossession:false,interceptionProven:false,
  passCreated:false,physicalCauseExclusivelyProven:false
 });
}
export function advanceObservedOppositionFlight({audit,velocity,tick}){
 if(!audit||audit.version!==OPPOSITION_FLIGHT_VERSION||
    audit.contactShoeStartProven!==true||
    !Number.isSafeInteger(audit.contactTick)||audit.contactTick<1||
    !Number.isSafeInteger(audit.tick)||audit.tick<audit.contactTick||
    !Number.isSafeInteger(audit.followupTicks)||audit.followupTicks<0||
    audit.followupTicks>OPPOSITION_FLIGHT_MAX_FOLLOWUP_TICKS||
    !vector(audit.incomingVelocity)||
    !finite(audit.incomingGroundSpeedMps)||
    !['observing','insufficient-incoming-flight',
      'confirmed-changed-flight','contact-only-no-confirmed-change']
       .includes(audit.status)||
    !Number.isSafeInteger(tick)||tick!==audit.tick+1||!vector(velocity))
   throw new TypeError('Consecutive measured post-contact Rapier flight required');
 if(audit.status!=='observing')return audit;
 const ux=audit.incomingVelocity.x/audit.incomingGroundSpeedMps;
 const uy=audit.incomingVelocity.y/audit.incomingGroundSpeedMps;
 const projected=velocity.x*ux+velocity.y*uy;
 const lateral=Math.abs(velocity.y*ux-velocity.x*uy);
 const currentSpeed=speed(velocity);
 const angleDeg=currentSpeed>0.01?
  Math.atan2(lateral,projected)*180/Math.PI:0;
 const kind=projected<=-0.25?'reversed':
   projected<audit.incomingGroundSpeedMps*OPPOSITION_FLIGHT_SLOW_RATIO?
    'slowed':
    angleDeg>=OPPOSITION_FLIGHT_REDIRECT_DEG?'redirected':null;
 const streak=kind===null?0:
  kind===audit.lastChangeKind?audit.consistentChangeTicks+1:1;
 const count=audit.followupTicks+1;
 const confirmed=streak>=OPPOSITION_FLIGHT_CONFIRM_TICKS;
 const finished=count>=OPPOSITION_FLIGHT_MAX_FOLLOWUP_TICKS;
 return Object.freeze({...audit,tick,followupTicks:count,
  status:confirmed?'confirmed-changed-flight':
    finished?'contact-only-no-confirmed-change':'observing',
  classification:confirmed?kind:
    finished?'contact-only-no-confirmed-change':
    'contact-only-not-interception',
  consistentChangeTicks:streak,lastChangeKind:kind,
  projectedSpeedMps:projected,observedAngleDeg:angleDeg,
  observedGroundSpeedMps:currentSpeed,
  officialPossession:false,interceptionProven:false,
  passCreated:false,physicalCauseExclusivelyProven:false
 });
}
