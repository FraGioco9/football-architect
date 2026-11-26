// Current DEV shot profiles. All share one native-contact executor and
// original Rapier world. Power is the default; other profiles are
// provisional. No automatic goal, post-launch steering or velocity setters.
import {magnusLift} from './magnus.mjs';
export const LAB_SHOT_CALIBRATION_VERSION='lab-shot-profiles-v4';
export const LAB_SHOT_PROFILES=Object.freeze(['power','low','placed','chip','curled','tap-in']);
export const LAB_SHOT_LABELS=Object.freeze({power:'Power',low:'Low',placed:'Placed',chip:'Chip',curled:'Curled','tap-in':'Tap-in'});
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
// Predict only an INITIAL aim for a curled shot using the same provisional
// Magnus function as the live solver. Actual flight is never corrected.
function curvedAim({dx,dy,speed,spin,massKg,radiusM}){
 const t0=Math.hypot(dx,dy)/speed;
 let angle=Math.atan2(dy,dx),timeS=t0;
 for(let attempt=0;attempt<7;attempt++){
  let x=0,y=0,vx=speed*Math.cos(angle),vy=speed*Math.sin(angle);
  const dt=1/60,dir=Math.sign(dx);
  for(let i=0;i<240;i++){
   const prevX=x,prevY=y;
   if(i>0){
    const f=magnusLift({x:vx,y:vy,z:0},{x:0,y:0,z:spin},{radiusM}).force;
    vx+=f.x/massKg*dt;vy+=f.y/massKg*dt;
   }
   x+=vx*dt;y+=vy*dt;
   if(dir*x>=dir*dx){
    const q=(dx-prevX)/(x-prevX);
    timeS=(i+q)*dt;
    const error=dy-(prevY+q*(y-prevY));
    angle+=dir*Math.atan2(error,Math.abs(dx))*0.85;
    break;
   }
  }
 }
 return {vx:speed*Math.cos(angle),vy:speed*Math.sin(angle),timeS};
}
export function calculateCurrentLabShotCalibration({target,position,velocity,massKg,ballRadiusM,originalImpulseNs,profile='power'}={}){
 if(!target||!position||!velocity||!originalImpulseNs||!LAB_SHOT_PROFILES.includes(profile)||
    ![target.targetX,target.targetY,position.x,position.y,position.z,velocity.x,velocity.y,velocity.z,
      massKg,ballRadiusM,originalImpulseNs.x,originalImpulseNs.y,originalImpulseNs.z].every(Number.isFinite)||
    massKg<=0||ballRadiusM<=0)throw new TypeError('Shot calibration requires measured original motion, profile and goal lane');
 const dx=target.targetX-position.x,dir=Math.sign(dx);
 if(Math.abs(dx)<0.25)return null;
 // Placed aims for the far corner in the empty-goal profile. Power
 // and the remaining profiles retain the real selector's goal lane.
 const targetY=profile==='placed'?(position.y>=0?-2.65:2.65):target.targetY;
 const dy=targetY-position.y,distanceM=Math.hypot(dx,dy);
 const fullDx=dx+dir*ballRadiusM,fullDistance=Math.hypot(fullDx,dy);
 if(profile==='tap-in'&&(distanceM>6.05||position.z>ballRadiusM+0.15))return null;
 const groundShot=profile==='low'||profile==='tap-in';
 let speed=clamp(18+0.30*distanceM,20,28),targetCentreZM=0.90;
 if(profile==='low'){speed=clamp(19+0.14*distanceM,20,24);targetCentreZM=ballRadiusM;}
 if(profile==='power'){speed=29;targetCentreZM=0.65;}
 // Decisive close finish, not necessarily a gentle touch. Retain centre
 // lane and ground trajectory. Future player attributes should introduce
 // low directional/power dispersion for open-goal Tap-in, not an imposed
 // scoring probability. No attribute model or automatic goal yet.
 if(profile==='tap-in'){speed=clamp(4.0+0.90*fullDistance,4.2,9.7);targetCentreZM=ballRadiusM;}
 if(profile==='placed'){speed=clamp(15+0.22*distanceM,17,23);targetCentreZM=0.80;}
 if(profile==='chip'){speed=fullDistance/clamp(1.40+distanceM*0.024,1.60,2.25);targetCentreZM=1.35;}
 if(profile==='curled'){speed=clamp(18+0.16*distanceM,20,24);targetCentreZM=1.00;}
 let timeS=fullDistance/speed,vx=fullDx/fullDistance*speed,vy=dy/fullDistance*speed;
 let spinZ=0;
 if(profile==='curled'){
  spinZ=dir*(position.y>=0?1:-1)*38;
  const aim=curvedAim({dx:fullDx,dy,speed,spin:spinZ,massKg,radiusM:ballRadiusM});
  ({vx,vy,timeS}=aim);
 }
 const targetV={x:vx,y:vy,z:groundShot?0:
  (targetCentreZM-position.z)/timeS+0.5*9.81*timeS};
 const impulse={x:massKg*(targetV.x-velocity.x),y:massKg*(targetV.y-velocity.y),z:massKg*(targetV.z-velocity.z)};
 const norm=Math.hypot(...Object.values(impulse)),cap=profile==='tap-in'?6.5:13,scale=norm>cap?cap/norm:1;
 const impulseNs=Object.freeze({x:impulse.x*scale,y:impulse.y*scale,z:impulse.z*scale});
 // Low shot starts rolling; curled shot receives real vertical-axis spin.
 // Match existing spin to the actual post-impulse translation, not a setter.
 const outgoingX=velocity.x+impulseNs.x/massKg,outgoingY=velocity.y+impulseNs.y/massKg;
 const targetAngularVelocity=groundShot?Object.freeze({x:-outgoingY/ballRadiusM,y:outgoingX/ballRadiusM,z:0}):
  profile==='curled'?Object.freeze({x:0,y:0,z:spinZ}):null;
 return Object.freeze({source:LAB_SHOT_CALIBRATION_VERSION,profile,distanceM,targetY,targetCentreZM,
  plannedHorizontalSpeedMps:speed,plannedFlightTimeS:timeS,originalImpulseNs,impulseNs,
  targetAngularVelocity,provisional:true,officialMatchAction:false});
}
