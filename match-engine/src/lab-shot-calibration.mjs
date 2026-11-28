// Current DEV shot profiles. All share one native-contact executor and
// original Rapier world. Power is the default; other profiles are
// provisional. No automatic goal, post-launch steering or velocity setters.
import {magnusLift} from './magnus.mjs';
export const LAB_SHOT_CALIBRATION_VERSION='lab-shot-profiles-v5';
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
// SHOT-04: select a goal-mouth point independently of launch calibration.
// This is a deterministic geometric ranking, not a probability of scoring.
// Keeper reach/height are provisional planning proxies, never body contacts.
const TARGET_HEIGHTS=Object.freeze({power:[0.65,1.15],low:null,placed:[0.80,1.15],chip:[1.35,1.75],curled:[1.00,1.30],'tap-in':null});
export function selectLabShotTarget({target,position,profile='power',ballRadiusM,opponents=[],minimumPowerLaneClearanceM=2.4}={}){
 if(!target||!position||!LAB_SHOT_PROFILES.includes(profile)||
   ![target.targetX,target.targetY,position.x,position.y,position.z,ballRadiusM].every(Number.isFinite)||
   ballRadiusM<=0||!Number.isFinite(minimumPowerLaneClearanceM)||minimumPowerLaneClearanceM<0||minimumPowerLaneClearanceM>2.4||!Array.isArray(opponents)||opponents.some(p=>!p||
    ![p.x,p.y].every(Number.isFinite)))throw new TypeError('Shot target selection requires live goal and opponent geometry');
 const dx=target.targetX-position.x,dir=Math.sign(dx);
 const half=3.66-ballRadiusM,bar=2.44-ballRadiusM;
 // Safe margins are intentionally fixed for this un-attributed LAB.
 // Later attributes can supply calibrated dispersion/decision confidence.
 const safeY=Math.max(0,half-0.70);
 const nearestY=clamp(position.y,-safeY,safeY);
 const nearSign=position.y < -0.02?-1:1;
 const preferredSign=['placed','curled'].includes(profile)?-nearSign:nearSign;
 const isTap=profile==='tap-in',ground=profile==='low'||isTap;
 const preferredY=isTap?nearestY:preferredSign*Math.min(safeY,2.65);
 const heights=ground?[ballRadiusM]:TARGET_HEIGHTS[profile].map(z=>Math.min(z,bar-0.25));
 const ys=[preferredY,...(isTap?[0,-safeY,safeY]:[-safeY,safeY,-1.35,1.35,0]),clamp(target.targetY,-half+0.01,half-0.01)];
 const candidates=[];
 for(const y of [...new Set(ys)])for(const z of [...new Set(heights)]){
  const dy=y-position.y,distanceM=Math.hypot(dx,dy);
  if(distanceM<1e-8||!dir)continue;
  let lane=Infinity,clearance=Infinity,fieldLane=Infinity;
  for(const p of opponents){
   const q=clamp(((p.x-position.x)*dx+(p.y-position.y)*dy)/(distanceM*distanceM),0,1);
   const horizontal=Math.hypot(p.x-position.x-q*dx,p.y-position.y-q*dy);
   lane=Math.min(lane,horizontal);
   if(p.role!=='goalkeeper')fieldLane=Math.min(fieldLane,horizontal);
   // Provisional arc estimate for ranking only. Actual shot uses native
   // spin/impulse and real flight; this cannot create an outcome.
   const arc=ground?0:profile==='chip'?4.5:profile==='power'?0.65:1.1;
   const height=ground?ballRadiusM:position.z+(z-position.z)*q+4*arc*q*(1-q);
   const reach=p.role==='goalkeeper'?2.1:1.8;
   clearance=Math.min(clearance,Math.hypot(horizontal,Math.max(0,height-reach)));
  }
  const postMargin=half-Math.abs(y),barMargin=bar-z;
  // Preserve the existing conservative original straight-lane gate in
  // contested Power scenarios. This ranking cannot authorize a blocked shot.
  if(profile==='power'&&opponents.length&&(lane<minimumPowerLaneClearanceM-1e-8||fieldLane<2.4-1e-8))continue;
  if(isTap&&(distanceM>6.05||postMargin<0.60))continue;
  const score=isTap?-distanceM+Math.min(clearance,6)*2:
   Math.min(clearance,8)*3-Math.abs(y-preferredY)*0.32-
   (z-heights[0])*0.30-distanceM*0.015+Math.min(postMargin,0.70)*0.15;
  candidates.push({targetY:y,targetCentreZM:z,distanceM,score,
    laneClearanceM:Number.isFinite(lane)?lane:null,
    estimatedClearanceM:Number.isFinite(clearance)?clearance:null,postMarginM:postMargin,barMarginM:barMargin});
 }
 // In an empty goal the shortest safe tap-in is exact orthogonal
 // projection. In opposed play rank clearance before the side preference.
 candidates.sort((a,b)=>b.score-a.score);
 const best=candidates[0];
 if(!best)return null;
 return Object.freeze({...best,source:'lab-goal-mouth-target-v1',candidateCount:candidates.length,
  opponentCount:opponents.length,policy:isTap?'nearest-safe-goal-mouth':'open-lane-and-corner',
  originalTargetY:target.targetY,officialGoal:false});
}
export function calculateCurrentLabShotCalibration({target,position,velocity,massKg,ballRadiusM,originalImpulseNs,profile='power',opponents=[],minimumPowerLaneClearanceM=2.4}={}){
 if(!target||!position||!velocity||!originalImpulseNs||!LAB_SHOT_PROFILES.includes(profile)||
    ![target.targetX,target.targetY,position.x,position.y,position.z,velocity.x,velocity.y,velocity.z,
      massKg,ballRadiusM,originalImpulseNs.x,originalImpulseNs.y,originalImpulseNs.z].every(Number.isFinite)||
    massKg<=0||ballRadiusM<=0)throw new TypeError('Shot calibration requires measured original motion, profile and goal lane');
 const dx=target.targetX-position.x,dir=Math.sign(dx);
 if(Math.abs(dx)<0.25)return null;
 const targetSelection=selectLabShotTarget({target,position,profile,ballRadiusM,opponents,minimumPowerLaneClearanceM});
 if(!targetSelection)return null;
 const {targetY}=targetSelection;
 const dy=targetY-position.y,distanceM=Math.hypot(dx,dy);
 const fullDx=dx+dir*ballRadiusM,fullDistance=Math.hypot(fullDx,dy);
 if(profile==='tap-in'&&(distanceM>6.05||position.z>ballRadiusM+0.15))return null;
 const groundShot=profile==='low'||profile==='tap-in';
 let speed=clamp(18+0.30*distanceM,20,28),targetCentreZM=0.90;
 if(profile==='low'){speed=clamp(19+0.14*distanceM,20,24);targetCentreZM=ballRadiusM;}
 if(profile==='power'){speed=29;targetCentreZM=0.65;}
 // Decisive close finish, not necessarily a gentle touch. Retain the
 // nearest safe goal-mouth lane and ground trajectory. Future player attributes should introduce
 // low directional/power dispersion for open-goal Tap-in, not an imposed
 // scoring probability. No attribute model or automatic goal yet.
 if(profile==='tap-in'){speed=clamp(4.0+0.90*fullDistance,4.2,9.7);targetCentreZM=ballRadiusM;}
 if(profile==='placed'){speed=clamp(15+0.22*distanceM,17,23);targetCentreZM=0.80;}
 if(profile==='chip'){speed=fullDistance/clamp(1.40+distanceM*0.024,1.60,2.25);targetCentreZM=1.35;}
 if(profile==='curled'){speed=clamp(18+0.16*distanceM,20,24);targetCentreZM=1.00;}
 targetCentreZM=targetSelection.targetCentreZM;
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
 return Object.freeze({source:LAB_SHOT_CALIBRATION_VERSION,profile,distanceM,targetY,targetCentreZM,targetSelection,
  plannedHorizontalSpeedMps:speed,plannedFlightTimeS:timeS,originalImpulseNs,impulseNs,
  targetAngularVelocity,preImpulseVelocity:Object.freeze({...velocity}),
   provisional:true,officialMatchAction:false});
}
