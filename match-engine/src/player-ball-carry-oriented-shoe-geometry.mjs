// ME-PB C3.3g: read-only geometric distance to the EXACT oriented
// rounded-cuboid shoe transform used by the same 60 Hz Rapier engine.
// A distance below zero is NOT a Rapier contact; only real shoe events count.
import {BALL_RADIUS} from './core.mjs';
import {footProxyTransform,FOOT_CONTACT_HALF_LENGTH_M,
 FOOT_CONTACT_HALF_WIDTH_M,FOOT_CONTACT_HALF_HEIGHT_M,
 FOOT_CONTACT_ROUNDING_M} from './player-foot-contact.mjs';

const finite=x=>typeof x==='number'&&Number.isFinite(x);
const EPS=1e-9;
export const CARRY_ORIENTED_SHOE_GEOMETRY_VERSION=
 'me-pb-c3-3g-trusted-moved-shoe-ball-geometry-v1';

export function measureOrientedCarryShoeBallGeometry(actor,ball){
 if(!actor||!ball||typeof actor.id!=='string'||!actor.id||
    !['home','away'].includes(actor.team)||
    ![actor.x,actor.y,actor.facingRad,ball.x,ball.y,ball.z]
     .every(finite)||ball.z<0)
  throw new TypeError('True canonical oriented shoe and real ball centers required');
 const shoe=footProxyTransform(actor);
 const dx=ball.x-shoe.x,dy=ball.y-shoe.y,dz=ball.z-shoe.z;
 const c=Math.cos(actor.facingRad),s=Math.sin(actor.facingRad);
 const forward=dx*c+dy*s,lateral=-dx*s+dy*c;
 const outsideForward=Math.max(0,Math.abs(forward)-FOOT_CONTACT_HALF_LENGTH_M);
 const outsideLateral=Math.max(0,Math.abs(lateral)-FOOT_CONTACT_HALF_WIDTH_M);
 const outsideVertical=Math.max(0,Math.abs(dz)-FOOT_CONTACT_HALF_HEIGHT_M);
 // Geometric AABB distance in shoe-local coordinates minus the existing
 // rounded-cuboid bevel AND football radius. Clamped: never a verdict
 // about swept Rapier collision or contact-force solver state.
 const estimatedSurfaceGapM=Math.max(0,Math.hypot(
  outsideForward,outsideLateral,outsideVertical)-
  FOOT_CONTACT_ROUNDING_M-BALL_RADIUS);
 if(!Number.isFinite(estimatedSurfaceGapM)||estimatedSurfaceGapM<-EPS)
  throw new Error('Invalid finite geometric shoe gap');
 return Object.freeze({
  version:CARRY_ORIENTED_SHOE_GEOMETRY_VERSION,
  engineId:actor.id,team:actor.team,
  bodyX:actor.x,bodyY:actor.y,
  shoeCenter:Object.freeze({x:shoe.x,y:shoe.y,z:shoe.z}),
  actualFacingRad:actor.facingRad,
  bodyBallXYGapM:Math.hypot(ball.x-actor.x,ball.y-actor.y),
  shoeBallCenter3DGapM:Math.hypot(dx,dy,dz),
  relativeBallForwardM:forward,relativeBallLateralM:lateral,
  relativeBallVerticalM:dz,
  estimatedStaticSurfaceClearanceM:estimatedSurfaceGapM,
  ballRadiusM:BALL_RADIUS,
  actualRapierCollisionInferred:false,
  footballTackleConfirmed:null,ballControlConfirmed:null,
  dribbleConfirmed:null,officialMatchPossession:false
 });
}
