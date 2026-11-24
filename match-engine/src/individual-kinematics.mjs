// #628 Phase M1: deterministic source-only kinematics at canonical fixed 60 Hz.
// The caller chooses targets, owns collisions, and is the ONLY source of actual
// player XY. No ball contact, Rapier shoe event or match action is created here.
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
function validateLimits(limits){
 if(!limits||typeof limits!=='object'||![
  limits.dt,limits.maxSpeed,limits.acceleration,limits.braking,
  limits.turnRate,limits.maxX,limits.maxY
 ].every(n=>finite(n)&&n>0))
  throw new TypeError('Finite positive canonical kinematic limits required');
}
// Equivalent to the previously inline free-space velocity and pitch-bound step.
// The canonical mover performs 22-player collision rejection AFTER this result.
export function advanceFreePlayerKinematics(player,target,limits){
 validateLimits(limits);
 if(!player||!target||![
  player.x,player.y,player.vx,player.vy,target.x,target.y
 ].every(finite))throw new TypeError('Finite current player and target XY required');
 const dx=target.x-player.x,dy=target.y-player.y,dist=Math.hypot(dx,dy);
 const previousSpeed=Math.hypot(player.vx,player.vy);
 const speedLimit=Math.min(limits.maxSpeed,Math.sqrt(2*limits.braking*dist));
 const targetVx=dist>1e-8?dx/dist*speedLimit:0;
 const targetVy=dist>1e-8?dy/dist*speedLimit:0;
 const dvx=targetVx-player.vx,dvy=targetVy-player.vy,dv=Math.hypot(dvx,dvy);
 const maxDelta=(speedLimit<previousSpeed?limits.braking:limits.acceleration)*limits.dt;
 const ratio=dv>maxDelta?maxDelta/dv:1;
 let vx=player.vx+dvx*ratio,vy=player.vy+dvy*ratio;
 if(Math.hypot(vx,vy)<1e-9){vx=0;vy=0;}
 const x=clamp(player.x+vx*limits.dt,-limits.maxX,limits.maxX);
 const y=clamp(player.y+vy*limits.dt,-limits.maxY,limits.maxY);
 // M14 real physical-border correction: when a 60Hz substep is clipped
 // at the actual pitch boundary, its measured displacement may be smaller
 // than the free predicted velocity * dt. Preserve the ORIGINAL source
 // identity vx=(newX-oldX)/dt; otherwise the native Rapier body bridge
 // correctly refuses an internally inconsistent player motion frame.
 // This cannot increase speed: the actual distance was clipped inwards.
 if(Math.abs(x-(player.x+vx*limits.dt))>1e-9)
  vx=(x-player.x)/limits.dt;
 if(Math.abs(y-(player.y+vy*limits.dt))>1e-9)
  vy=(y-player.y)/limits.dt;
 return Object.freeze({x,y,vx,vy});
}
// Turn toward ACTUAL velocity only after any canonical collision rejection.
// When stopped, previous heading remains unchanged.
export function advancePlayerOrientation(facingRad,vx,vy,limits){
 validateLimits(limits);
 if(![facingRad,vx,vy].every(finite))
  throw new TypeError('Finite observed heading and velocity required');
 if(Math.hypot(vx,vy)<=0.05)return facingRad;
 const desired=Math.atan2(vy,vx),angle=wrap(desired-facingRad);
 return wrap(facingRad+clamp(angle,
  -limits.turnRate*limits.dt,limits.turnRate*limits.dt));
}
