// ME-PHYS-26 — ground-contact and first rebound audit, measurement only.
// Five disposable 60Hz Rapier launches on ONE unchanged grass/collider model.
// No aerodynamic forces; the existing launch-only diagnostic spin setter
// initializes rotation, with Magnus lift explicitly OFF. No gameplay changes.
import {createEngine,FIXED_DT,ENGINE_VERSION,BALL_RADIUS,BALL_MASS_KG,
  BALL_INERTIA_KG_M2,GRASS_ROLL_DECELERATION,GRAVITY,toGroundClearance} from './core.mjs';
import {measureBounceHistory} from './rebound-metrics.mjs';

export const CONTACT_LAUNCH=Object.freeze({
 preset:'launch',seed:'me26-contact',x:0,y:0,z:2,vx:4,vy:0,vz:0
});
export const CONTACT_OBSERVATION_S=2.6;
export const CONTACT_SPIN_RPS=6;
const omega=CONTACT_SPIN_RPS*2*Math.PI;
export const CONTACT_SPIN_CASES=Object.freeze([
 Object.freeze({key:'none',label:'No spin',spin:null}),
 Object.freeze({key:'topspin',label:'+Y topspin',spin:Object.freeze({x:0,y:omega,z:0})}),
 Object.freeze({key:'backspin',label:'−Y backspin',spin:Object.freeze({x:0,y:-omega,z:0})}),
 Object.freeze({key:'side-plus',label:'+Z sidespin',spin:Object.freeze({x:0,y:0,z:omega})}),
 Object.freeze({key:'side-minus',label:'−Z sidespin',spin:Object.freeze({x:0,y:0,z:-omega})})
]);
const vector=v=>Object.freeze({x:v.x,y:v.y,z:v.z});
const sample=engine=>Object.freeze({
 ...engine.snapshot(),angularVelocity:vector(engine.angularVelocity())
});
export function contactEnergySample(s,{massKg=BALL_MASS_KG,
  inertiaKgM2=BALL_INERTIA_KG_M2}={}){
 const v=s?.ball?.velocity,w=s?.angularVelocity,p=s?.ball?.position;
 if(!v||!w||!p||![...Object.values(v),...Object.values(w),
   ...Object.values(p),massKg,inertiaKgM2].every(x=>
     typeof x==='number'&&Number.isFinite(x)) ||
   massKg<=0||inertiaKgM2<=0)
   throw new TypeError('Finite Rapier contact sample and mass/inertia required');
 const translationJ=0.5*massKg*(v.x*v.x+v.y*v.y+v.z*v.z);
 const rotationJ=0.5*inertiaKgM2*(w.x*w.x+w.y*w.y+w.z*w.z);
 const potentialJ=massKg*Math.abs(GRAVITY.z)*toGroundClearance(p.z);
 // Tangent-point velocity in the ideal bottom-contact approximation,
 // not a solver contact-impulse diagnostic or a new friction law.
 const slipX=v.x-BALL_RADIUS*w.y;
 const slipY=v.y+BALL_RADIUS*w.x;
 return Object.freeze({
  timeS:s.time,tick:s.tick,clearanceM:toGroundClearance(p.z),
  velocityMps:vector(v),angularVelocityRadS:vector(w),
  horizontalSpeedMps:Math.hypot(v.x,v.y),
  verticalSpeedMps:v.z,spinRevS:Math.hypot(w.x,w.y,w.z)/(2*Math.PI),
  contactSlipMps:Object.freeze({x:slipX,y:slipY,magnitude:Math.hypot(slipX,slipY)}),
  translationJ,rotationJ,potentialJ,totalMechanicalJ:translationJ+rotationJ+potentialJ
 });
}
export function measureContactImpact(samples,properties){
 if(!Array.isArray(samples)||samples.length<3)
   throw new TypeError('Contact trajectory requires at least 3 snapshots');
 const impacts=[];
 for(let i=1;i<samples.length;i++){
  const a=samples[i-1],b=samples[i];
  if(a.ball.velocity.z< -0.1&&b.ball.velocity.z>0.1&&
      toGroundClearance(b.ball.position.z)<0.08)impacts.push(i);
 }
 if(!impacts.length)throw new RangeError('No first ground rebound detected');
 const index=impacts[0];
 const pre=contactEnergySample(samples[index-1],properties);
 const post=contactEnergySample(samples[index],properties);
 if(pre.verticalSpeedMps>=0||post.verticalSpeedMps<=0)
   throw new RangeError('Contact impulse must cross descending and ascending states');
 const height=measureBounceHistory(samples);
 const energyChangeJ=post.totalMechanicalJ-pre.totalMechanicalJ;
 const afterInitial=post.horizontalSpeedMps-pre.horizontalSpeedMps;
 return Object.freeze({
  firstImpactTimeS:post.timeS,contactWindowS:post.timeS-pre.timeS,
  pre,post,firstReboundHeightM:height.firstReboundHeightM,
  impactCount:height.impactCount,
  effectiveStepRestitution:post.verticalSpeedMps/Math.abs(pre.verticalSpeedMps),
  deltaHorizontalSpeedMps:afterInitial,
  deltaVX:post.velocityMps.x-pre.velocityMps.x,
  deltaVY:post.velocityMps.y-pre.velocityMps.y,
  deltaSpinRevS:post.spinRevS-pre.spinRevS,
  energyChangeJ,
  energyRetainedFraction:post.totalMechanicalJ/pre.totalMechanicalJ,
  observedEnergyGainJ:Math.max(0,energyChangeJ),
  energyLossJ:Math.max(0,-energyChangeJ)
 });
}

export function runContactImpactDiagnostics(RAPIER){
 const cases=[];
 for(const c of CONTACT_SPIN_CASES){
  const options=c.spin?{diagnosticMagnusSpinRadS:c.spin,
    diagnosticMagnusLiftEnabled:false}:{};
  const engine=createEngine(RAPIER,CONTACT_LAUNCH,options);
  try{
   const samples=[sample(engine)];
   for(let n=0;n<Math.round(CONTACT_OBSERVATION_S/FIXED_DT);n++){
    engine.step();samples.push(sample(engine));
   }
   const inertia=engine.ballProperties.principalInertiaKgM2.x;
   const audit=measureContactImpact(samples,{
     massKg:engine.ballProperties.massKg,inertiaKgM2:inertia
   });
   cases.push(Object.freeze({key:c.key,label:c.label,
     initialSpinRevS:c.spin?CONTACT_SPIN_RPS:0,...audit}));
  }finally{engine.dispose();}
 }
 return Object.freeze({
  label:'ME-PHYS-26 — first-contact and rebound energy audit',
  cases:Object.freeze(cases),independentWorlds:cases.length,
  launch:CONTACT_LAUNCH,observationSeconds:CONTACT_OBSERVATION_S,
  engineVersion:ENGINE_VERSION,grassDecelerationMps2:GRASS_ROLL_DECELERATION,
  initialSpinRevS:CONTACT_SPIN_RPS,
  model:'Single existing Rapier ball/collider and 0.80 m/s² grass; no aerodynamic forces',
  limitation:'Pre and post values bracket one 1/60s physics integration step, '+
    'including gravity and contact impulse; effective step restitution is not '+
    'the configured collider restitution. Energy change compares complete '+
    'kinetic, rotational and gravitational energies at the two observed '+
    'states, not an impulse-only experimental measurement. Contact slip is '+
    'the bottom-tangent proxy; no post-contact spin law is fitted.',
  scientificallyCalibrated:false,measuredRealBounce:false,
  gameplayApproved:false,coefficientFitPerformed:false
 });
}
