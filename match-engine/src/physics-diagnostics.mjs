// ME-PHYS-03 — reproducible, read-only ball-behaviour diagnostics.
// No physics constants or collider properties are changed by these measurements.
import {
  createEngine, FIXED_DT, BALL_MASS_KG, BALL_RADIUS, BALL_INERTIA_KG_M2,
  AIR_DENSITY_KG_M3, BALL_FRONTAL_AREA_M2, DRAG_EXPERIMENT_CD,
  ENGINE_VERSION, GROUND_RESTITUTION, BALL_RESTITUTION,
  GRASS_ROLL_DECELERATION, ROLL_STOP_SPEED, GRAVITY, toGroundClearance
} from './core.mjs';
import {magnusLift,MAGNUS_SPIN_RAD_S,MAGNUS_SPIN_RPS,MAGNUS_CL_SLOPE,MAGNUS_CL_CAP,MAGNUS_SOURCE} from './magnus.mjs';
import {speedDependentDragCd,SPEED_DRAG_NODES,SPEED_DRAG_SOURCE} from './aerodynamics.mjs';
import {readAerodynamicCalibrationEvidence} from './calibration-evidence.mjs';
import {assessUniversalBallReadiness} from './universal-ball-readiness.mjs';
import {describeCalibrationIntake} from './calibration-dataset-intake.mjs';
import {literatureCandidateForces,LITERATURE_AERO_SOURCE,LITERATURE_MODEL_LIMITATIONS,
 LITERATURE_MODEL_ID} from './literature-aero-candidate.mjs';

export const BOUNCE_OBSERVATION_SECONDS = 15;
export const ROLL_OBSERVATION_SECONDS = 12;
export const ROLL_LAUNCH_SPEEDS_M_S = Object.freeze([2, 4, 6]);
export const ROLL_CHECKPOINT_SECONDS = Object.freeze([0, 1, 2, 4, 8, 12]);
// Compare the SAME 4m/s launch with initially sliding, partial and pure roll spin.
export const SPIN_FRACTIONS = Object.freeze([0, 0.5, 1]);
export const SPIN_OBSERVATION_SECONDS = 7;
export const SPIN_CHECKPOINT_SECONDS = Object.freeze([0, 0.1, 0.25, 0.5, 1, 2, 4, 6, 7]);
export const SLIP_TRANSITION_THRESHOLD_MPS = 0.1;
// Baker (1989), six professional natural-turf pitches: ~90% of reported ball
// decelerations fell within 0.45–1.5m/s². This is an observational envelope,
// NOT a FIFA natural-grass pass/fail limit or a universal pitch calibration.
export const NATURAL_GRASS_OBSERVED_DECEL_MPS2 = Object.freeze({min:0.45,max:1.5});
export const TURF_SENSITIVITY_COEFFICIENTS = Object.freeze([0.45,GRASS_ROLL_DECELERATION,1.5]);
export const TURF_SENSITIVITY_SECONDS = 13;
export const TURF_SENSITIVITY_CHECKPOINTS_SECONDS = Object.freeze([0,0.5,1,2,4,6,8,10,12]);
export const FLIGHT_OBSERVATION_SECONDS = 3.5;
export const FLIGHT_CHECKPOINT_SECONDS = Object.freeze([0,0.25,0.5,1,1.5,2]);
export const DRAG_COMPARISON_CHECKPOINTS = FLIGHT_CHECKPOINT_SECONDS;
export const SPEED_DRAG_LAUNCH_VX_MPS = Object.freeze([7,15,30]);
export const SPEED_DRAG_CHECKPOINT_SECONDS = Object.freeze([0,0.5,1,1.5]);
export {MAGNUS_SPIN_RPS};
export const MAGNUS_OBSERVATION_SECONDS = 5;
export const MAGNUS_CHECKPOINT_SECONDS = Object.freeze([0,0.5,1,1.5,2]);
export const MAGNUS_SPIN_CASES = Object.freeze([
  Object.freeze({key:'none',name:'No spin',spin:null}),
  Object.freeze({key:'side-positive',name:'+Side spin (+Z)',spin:Object.freeze({x:0,y:0,z:MAGNUS_SPIN_RAD_S})}),
  Object.freeze({key:'side-negative',name:'−Side spin (−Z)',spin:Object.freeze({x:0,y:0,z:-MAGNUS_SPIN_RAD_S})}),
  Object.freeze({key:'topspin',name:'Topspin (+Y)',spin:Object.freeze({x:0,y:MAGNUS_SPIN_RAD_S,z:0})}),
  Object.freeze({key:'backspin',name:'Backspin (−Y)',spin:Object.freeze({x:0,y:-MAGNUS_SPIN_RAD_S,z:0})})
]);
const EPSILON = 1e-9;

function snapshotsFor(RAPIER, input, seconds, options) {
  const engine=createEngine(RAPIER, input, options);
  try {
    const observed=()=>({...engine.snapshot(),angularVelocity:engine.angularVelocity()});
    const samples=[observed()];
    for(let i=0;i<Math.round(seconds/FIXED_DT);i++){
      engine.step();
      samples.push(observed());
    }
    return samples;
  } finally {engine.dispose();}
}

function stableRestTime(samples, resting, minWindow=60) {
  if(samples.length<minWindow+1)return null;
  // The first time after which *all* remaining observations stay quiet.
  // A low-velocity instant before the next bounce is not a stop.
  let quiet=true, first=null;
  for(let i=samples.length-1;i>=0;i--){
    quiet=quiet&&resting(samples[i]);
    if(quiet && samples.length-1-i>=minWindow)first=samples[i].time;
  }
  return first;
}

export function measureBounceSequence(samples) {
  if(!Array.isArray(samples)||samples.length<2)throw new TypeError('Bounce snapshots required');
  const impacts=[];
  let current=null;
  const initialHeightM=toGroundClearance(samples[0].ball.position.z);
  for(let i=1;i<samples.length;i++){
    const prev=samples[i-1],next=samples[i];
    const beforeZ=prev.ball.velocity.z,afterZ=next.ball.velocity.z;
    const clearance=toGroundClearance(next.ball.position.z);
    if(beforeZ < -0.1 && afterZ > 0.1 && clearance < 0.08){
      current={number:impacts.length+1,impactTimeS:next.time,apexTimeS:null,
        apexHeightM:null,intervalSincePreviousS:impacts.length?
          next.time-impacts[impacts.length-1].impactTimeS:null,
        energyRetainedFraction:null};
      impacts.push(current);
    }else if(current && current.apexHeightM===null &&
      beforeZ>0 && afterZ<=0){
      // The apex lies between these two fixed-step snapshots.
      const height=Math.max(toGroundClearance(prev.ball.position.z),clearance);
      if(height>=0.015){
        current.apexHeightM=height;
        current.apexTimeS=prev.ball.position.z>=next.ball.position.z?prev.time:next.time;
      }
    }
  }
  let prior=initialHeightM;
  for(const item of impacts) {
    if(item.apexHeightM!==null){
      item.energyRetainedFraction=prior>EPSILON?item.apexHeightM/prior:null;
      prior=item.apexHeightM;
    }
    Object.freeze(item);
  }
  const settledAtS=stableRestTime(samples,s=>
    s.nearGround && toGroundClearance(s.ball.position.z)<=0.02 &&
    Math.abs(s.ball.velocity.z)<=0.12);
  return Object.freeze({
    initialHeightM,
    observationSeconds:samples[samples.length-1].time,
    impactCount:impacts.length,
    impacts:Object.freeze(impacts),
    settledAtS,
    // An absent settling time means 'not observed within the window', NOT 0.
    settleObserved:settledAtS!==null
  });
}

export function measureRollSequence(samples) {
  if(!Array.isArray(samples)||samples.length<2)throw new TypeError('Roll snapshots required');
  let traveled=0;
  const distances=[0];
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1].ball.position,b=samples[i].ball.position;
    traveled+=Math.hypot(b.x-a.x,b.y-a.y);
    distances.push(traveled);
  }
  const checkpoints=ROLL_CHECKPOINT_SECONDS.filter(s=>
    Math.round(s/FIXED_DT)<samples.length).map(seconds=>{
    const index=Math.round(seconds/FIXED_DT),s=samples[index];
    const angular=s.angularVelocity;
    const slipMps=angular?Math.hypot(
      s.ball.velocity.x-BALL_RADIUS*angular.y,
      s.ball.velocity.y+BALL_RADIUS*angular.x):null;
    return Object.freeze({
      timeS:seconds,
      speedMps:Math.hypot(s.ball.velocity.x,s.ball.velocity.y),
      distanceM:distances[index],
      slipMps
    });
  });
  const stoppedAtS=stableRestTime(samples,s=>
    s.nearGround && Math.hypot(s.ball.velocity.x,s.ball.velocity.y)<0.06);
  const stopIndex=stoppedAtS===null?null:Math.round(stoppedAtS/FIXED_DT);
  return Object.freeze({
    initialSpeedMps:Math.hypot(samples[0].ball.velocity.x,samples[0].ball.velocity.y),
    observationSeconds:samples[samples.length-1].time,
    checkpoints:Object.freeze(checkpoints),
    stoppedAtS,
    distanceToStopM:stopIndex===null?null:distances[stopIndex],
    finalDistanceM:traveled,
    finalPositionM:Object.freeze({
      x:samples[samples.length-1].ball.position.x,
      y:samples[samples.length-1].ball.position.y
    }),
    finalSpeedMps:Math.hypot(
      samples[samples.length-1].ball.velocity.x,samples[samples.length-1].ball.velocity.y)
  });
}

// The initial angular velocity is an experimental control, not a new player-facing
// scenario parameter. These observations never alter the accepted physics constants.
export function measureSpinTransition(samples, fraction) {
  if(!Array.isArray(samples)||samples.length<2 ||
     !Number.isFinite(fraction)||fraction<0||fraction>1)
    throw new TypeError('Spin diagnostics require snapshots and a valid fraction');
  if(samples.some(s=>!s.angularVelocity))
    throw new TypeError('Spin diagnostics require actual angular velocity from Rapier');
  const distance=[0];
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1].ball.position,b=samples[i].ball.position;
    distance.push(distance[i-1]+Math.hypot(b.x-a.x,b.y-a.y));
  }
  const at=s=>{
    const v=s.ball.velocity,w=s.angularVelocity;
    const speed=Math.hypot(v.x,v.y);
    const slip=Math.hypot(v.x-BALL_RADIUS*w.y,v.y+BALL_RADIUS*w.x);
    const translationalJ=0.5*BALL_MASS_KG*speed**2;
    const angularSpeedRadS=Math.hypot(w.x,w.y,w.z);
    const rotationalJ=0.5*BALL_INERTIA_KG_M2*angularSpeedRadS**2;
    return {speed,slip,angularSpeedRadS,translationalJ,rotationalJ,totalJ:translationalJ+rotationalJ};
  };
  const first=at(samples[0]);
  // A transient zero-slip instant does not qualify as settled rolling:
  // require at least 0.2s sustained near-zero slip, while still moving.
  let transitionTimeS=null;
  const window=Math.round(0.2/FIXED_DT);
  for(let i=0;i+window<samples.length;i++){
    let sustained=true;
    for(let j=i;j<=i+window;j++){
      const s=samples[j],m=at(s);
      if(!s.nearGround||m.speed<=0.15||m.slip>SLIP_TRANSITION_THRESHOLD_MPS ||
         Math.abs(s.ball.velocity.z)>0.25){sustained=false;break;}
    }
    if(sustained){transitionTimeS=samples[i].time;break;}
  }
  const checkpoints=SPIN_CHECKPOINT_SECONDS.map(seconds=>{
    const index=Math.round(seconds/FIXED_DT);
    if(index>=samples.length)throw new RangeError('Spin sample window too short');
    const m=at(samples[index]);
    return Object.freeze({
      timeS:seconds,
      speedMps:m.speed,
      slipMps:m.slip,
      angularSpeedRadS:m.angularSpeedRadS,
      distanceM:distance[index],
      translationKineticJ:m.translationalJ,
      rotationKineticJ:m.rotationalJ,
      totalKineticJ:m.totalJ,
      energyRetainedFraction:first.totalJ>EPSILON?m.totalJ/first.totalJ:null
    });
  });
  const stoppedAtS=stableRestTime(samples,s=>
    s.nearGround&&Math.hypot(s.ball.velocity.x,s.ball.velocity.y)<0.06);
  const index=stoppedAtS===null?null:Math.round(stoppedAtS/FIXED_DT);
  return Object.freeze({
    spinFraction:fraction,
    initialAngularVelocityRadS:Object.freeze({...samples[0].angularVelocity}),
    initialKineticJ:first.totalJ,
    transitionTimeS,
    stoppedAtS,
    distanceToStopM:index===null?null:distance[index],
    finalDistanceM:distance[distance.length-1],
    checkpoints:Object.freeze(checkpoints)
  });
}

// One-parameter sensitivity: all three runs begin already in rolling contact
// at 4m/s and the same 100% matching spin. Preserve 0.8 as the shipping default.
export function measureNaturalGrassSensitivity(samples, coefficientMps2) {
  if(!Array.isArray(samples)||samples.length<2 ||
      !Number.isFinite(coefficientMps2) ||
      coefficientMps2 < NATURAL_GRASS_OBSERVED_DECEL_MPS2.min-1e-8 ||
      coefficientMps2 > NATURAL_GRASS_OBSERVED_DECEL_MPS2.max+1e-8)
    throw new RangeError('Invalid natural-grass sensitivity measurements');
  if(samples.some(s=>!s.angularVelocity))
    throw new TypeError('Sensitivity measurements require real angular velocity');
  let distanceM=0;
  const cumulative=[0];
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1].ball.position,b=samples[i].ball.position;
    distanceM+=Math.hypot(b.x-a.x,b.y-a.y);
    cumulative.push(distanceM);
  }
  const metricsAt=index=>{
    const sample=samples[index],v=sample.ball.velocity,w=sample.angularVelocity;
    return {
      timeS:sample.time,
      speedMps:Math.hypot(v.x,v.y),
      contactSlipMps:Math.hypot(v.x-BALL_RADIUS*w.y,v.y+BALL_RADIUS*w.x),
      distanceM:cumulative[index]
    };
  };
  const checkpoints=TURF_SENSITIVITY_CHECKPOINTS_SECONDS.map(time=>{
    const index=Math.round(time/FIXED_DT);
    if(index>=samples.length)throw new RangeError('Insufficient sensitivity samples');
    return Object.freeze({...metricsAt(index),timeS:time});
  });
  // Linear least-squares regression of actual speed in the steady window.
  // It reports observed deceleration, which can differ slightly from the set
  // coefficient because Rapier still couples spin and contact friction.
  const iStart=Math.round(0.5/FIXED_DT),iEnd=Math.round(2/FIXED_DT);
  if(iEnd>=samples.length)throw new RangeError('Sensitivity regression window too short');
  let count=0,sx=0,sy,sxx=0,sxy=0,maxSlip=0;
  sy=0;
  for(let i=iStart;i<=iEnd;i++){
    const item=metricsAt(i),t=item.timeS;
    sx+=t;sy+=item.speedMps;sxx+=t*t;sxy+=t*item.speedMps;count++;
    maxSlip=Math.max(maxSlip,item.contactSlipMps);
  }
  const denominator=count*sxx-sx*sx;
  const effectiveMps2=denominator>0?-(count*sxy-sx*sy)/denominator:null;
  const stoppedAtS=stableRestTime(samples,s=>
    s.nearGround&&Math.hypot(s.ball.velocity.x,s.ball.velocity.y)<0.06);
  const stopIndex=stoppedAtS===null?null:Math.round(stoppedAtS/FIXED_DT);
  return Object.freeze({
    configuredDecelerationMps2:coefficientMps2,
    isDefault:coefficientMps2===GRASS_ROLL_DECELERATION,
    startSpeedMps:metricsAt(0).speedMps,
    startContactSlipMps:metricsAt(0).contactSlipMps,
    observedDecelerationMps2:effectiveMps2,
    steadyWindowMaxSlipMps:maxSlip,
    observedSettledRolling:maxSlip<=SLIP_TRANSITION_THRESHOLD_MPS,
    stoppedAtS,
    distanceToStopM:stopIndex===null?null:cumulative[stopIndex],
    lastObservedDistanceM:distanceM,
    checkpoints:Object.freeze(checkpoints)
  });
}

// ME-PHYS-06: quantify the *existing* zero-aerodynamic-force launch against
// the ideal continuous-time ballistic solution. The Rapier fixed-step solver
// uses discrete time integration; small vertical discrepancies are expected.
// Record first ground contact rather than post-contact bouncing/rolling.
export function measureAirborneFlight(samples,{dragCoefficient=0,dragModel='constant'}={}) {
  if(!Array.isArray(samples)||samples.length<2)
    throw new TypeError('Airborne flight snapshots required');
  if(typeof dragCoefficient!=='number'||!Number.isFinite(dragCoefficient)||
     dragCoefficient<0||dragCoefficient>0.6)
    throw new RangeError('Invalid experimental flight drag coefficient');
  if(!['constant','speed-dependent'].includes(dragModel)||
     (dragModel==='speed-dependent'&&dragCoefficient!==0))
    throw new RangeError('Invalid experimental flight drag model');
  const first=samples[0],position=first.ball.position,velocity=first.ball.velocity;
  const initialClearanceM=toGroundClearance(position.z);
  if(initialClearanceM<=0||velocity.z<=0||-GRAVITY.z<=0)
    throw new RangeError('Expected an airborne upward launch');
  const g=-GRAVITY.z;
  let impactIndex=null;
  for(let i=1;i<samples.length;i++){
    const prior=samples[i-1],next=samples[i];
    // The first CCD contact can reduce horizontal speed BEFORE the ball
    // rebounds vertically. Detect the onset of any contact impulse rather
    // than waiting for a positive vertical velocity; exclude that step
    // from the drag-free airborne trajectory measurements.
    const verticalChange=next.ball.velocity.z-prior.ball.velocity.z;
    const expectedFreeFallChange=GRAVITY.z*FIXED_DT;
    // CCD can correct the translation before impact velocity reflects it.
    // Compare each SINGLE integration step against its own actual velocity,
    // not against the *whole flight* drag-free analytic line. That line is
    // deliberately different for a dragged ball, even before contact.
    const horizontalContactCorrection=Math.hypot(
      next.ball.position.x-prior.ball.position.x-next.ball.velocity.x*FIXED_DT,
      next.ball.position.y-prior.ball.position.y-next.ball.velocity.y*FIXED_DT);
    const contactResponse=horizontalContactCorrection>0.003 ||
      next.nearGround ||
      (dragCoefficient===0 && dragModel==='constant' &&
        verticalChange-expectedFreeFallChange>0.5);
    if(prior.ball.velocity.z< -0.1 &&
       contactResponse &&
       toGroundClearance(next.ball.position.z)<0.3){
      impactIndex=i;
      break;
    }
  }
  const firstContact=impactIndex===null?null:samples[impactIndex];
  const preImpactEnd=impactIndex===null?samples.length:impactIndex;
  const expected=time=>{
    const heightM=initialClearanceM+velocity.z*time-0.5*g*time*time;
    return {
      x:position.x+velocity.x*time,
      y:position.y+velocity.y*time,
      clearanceM:Math.max(0,heightM)
    };
  };
  const expectedContactTimeS=(velocity.z+
    Math.sqrt(velocity.z*velocity.z+2*g*initialClearanceM))/g;
  const launchHorizontalSpeedMps=Math.hypot(velocity.x,velocity.y);
  const measuredApex=samples.slice(0,preImpactEnd)
    .reduce((best,s)=>{
      const clearance=toGroundClearance(s.ball.position.z);
      return clearance>best.heightM?{timeS:s.time,heightM:clearance}:best;
    },{timeS:0,heightM:0});
  const checkpoints=FLIGHT_CHECKPOINT_SECONDS.filter(time=>
    Math.round(time/FIXED_DT)<preImpactEnd).map(time=>{
    const sample=samples[Math.round(time/FIXED_DT)],ideal=expected(time);
    const measured=sample.ball.position;
    return Object.freeze({
      timeS:time,
      observedClearanceM:toGroundClearance(measured.z),
      idealClearanceM:ideal.clearanceM,
      horizontalDifferenceM:Math.hypot(measured.x-ideal.x,measured.y-ideal.y),
      verticalDifferenceM:toGroundClearance(measured.z)-ideal.clearanceM,
      horizontalDistanceM:Math.hypot(measured.x-position.x,measured.y-position.y)
    });
  });
  let maxHorizontalDeviationM=0,maxVerticalDeviationM=0;
  for(let i=0;i<preImpactEnd;i++){
    const sample=samples[i],ideal=expected(sample.time),measured=sample.ball.position;
    maxHorizontalDeviationM=Math.max(maxHorizontalDeviationM,
      Math.hypot(measured.x-ideal.x,measured.y-ideal.y));
    maxVerticalDeviationM=Math.max(maxVerticalDeviationM,
      Math.abs(toGroundClearance(measured.z)-ideal.clearanceM));
  }
  return Object.freeze({
    launch:Object.freeze({
      x:position.x,y:position.y,clearanceM:initialClearanceM,
      vx:velocity.x,vy:velocity.y,vz:velocity.z
    }),
    observationSeconds:samples[samples.length-1].time,
    observedFirstContactTimeS:firstContact?.time??null,
    idealFirstContactTimeS:expectedContactTimeS,
    observedFirstContactDistanceM:firstContact?
      Math.hypot(firstContact.ball.position.x-position.x,
        firstContact.ball.position.y-position.y):null,
    idealFirstContactDistanceM:launchHorizontalSpeedMps*expectedContactTimeS,
    observedApex:Object.freeze(measuredApex),
    idealApex:Object.freeze({
      timeS:velocity.z/g,
      heightM:initialClearanceM+velocity.z**2/(2*g)
    }),
    maxHorizontalDeviationM,
    maxVerticalDeviationM,
    checkpoints:Object.freeze(checkpoints),
    aerodynamicDragEnabled:dragCoefficient>0||dragModel==='speed-dependent',
    dragCoefficient:dragModel==='speed-dependent'?null:dragCoefficient,
    ...(dragModel==='speed-dependent'?{dragModel}:{}),
    magnusEnabled:false
  });
}


// ME-PHYS-08: nine separately allocated 60Hz worlds (3 launch vx × 3 drag
// modes). Same seed, XY/Z, gravity, pitch, mass and vertical launch per trio.
// Record genuine pre-contact mechanical energy, not a fabricated drag-energy
// estimate; Rapier discrete stepping introduces a small baseline discrepancy.
export function runSpeedDependentDragDiagnostics(RAPIER) {
  const observationS=FLIGHT_OBSERVATION_SECONDS;
  const trials=SPEED_DRAG_LAUNCH_VX_MPS.map(vx=>{
    const input={preset:'launch',seed:'me-phys08-speed-curve',vx};
    const modes=[
      {key:'zero',options:{},measure:{dragCoefficient:0}},
      {key:'fixed',options:{diagnosticAirDragCd:DRAG_EXPERIMENT_CD},
        measure:{dragCoefficient:DRAG_EXPERIMENT_CD}},
      {key:'variable',options:{diagnosticAirDragModel:'speed-dependent'},
        measure:{dragModel:'speed-dependent'}}
    ];
    const runs={};
    for(const mode of modes){
      const samples=snapshotsFor(RAPIER,input,observationS,mode.options);
      const flight=measureAirborneFlight(samples,mode.measure);
      const init=samples[0],point=samples[Math.round(1/FIXED_DT)];
      const mechanicalEnergy=sample=>{
        const {velocity:v,position:p}=sample.ball;
        return 0.5*BALL_MASS_KG*(v.x*v.x+v.y*v.y+v.z*v.z)+
          BALL_MASS_KG*(-GRAVITY.z)*p.z;
      };
      const speedAtOneSecondMps=Math.hypot(...Object.values(point.ball.velocity));
      const effectiveCd=mode.key==='variable'?
        speedDependentDragCd(speedAtOneSecondMps):
        mode.key==='fixed'?DRAG_EXPERIMENT_CD:0;
      runs[mode.key]=Object.freeze({
        ...flight,
        initialCd:mode.key==='variable'?
          speedDependentDragCd(Math.hypot(...Object.values(init.ball.velocity))):
          mode.key==='fixed'?DRAG_EXPERIMENT_CD:0,
        speedAtOneSecondMps,
        cdAtOneSecond:effectiveCd,
        mechanicalEnergyLostAtOneSecondJ:mechanicalEnergy(init)-mechanicalEnergy(point),
        checkpoints:SPEED_DRAG_CHECKPOINT_SECONDS.map(timeS=>{
          const sample=samples[Math.round(timeS/FIXED_DT)];
          return Object.freeze({
            timeS,
            clearanceM:toGroundClearance(sample.ball.position.z),
            distanceM:Math.hypot(sample.ball.position.x-init.ball.position.x,
              sample.ball.position.y-init.ball.position.y)
          });
        })
      });
    }
    return Object.freeze({
      launchVxMps:vx,
      initialSpeedMps:Math.hypot(vx,input.vy??2,input.vz??10),
      zero:runs.zero,fixed:runs.fixed,variable:runs.variable
    });
  });
  return Object.freeze({
    label:'ME-PHYS-08 speed-dependent Cd(v), diagnostic only',
    model:'piecewise-linear continuous proxy, not calibrated for Football Architect',
    source:SPEED_DRAG_SOURCE,
    knots:SPEED_DRAG_NODES,
    trials:Object.freeze(trials),
    fixedCd:DRAG_EXPERIMENT_CD,
    normalGameplayCd:0,
    oneUniversalPitch:true,
    windEnabled:false,magnusEnabled:false,
    caveat:'Only 19 and 32 m/s Euro 2024 Cd values and ~12 m/s critical speed are supported by the cited study; low-speed Cd knots and interpolation are hypotheses, not measured.'
  });
}


// ME-PHYS-09: five separate, seeded launch worlds. All share a single
// experimental fixed Cd=0.24 so initial spin is the only changed input.
// vy=0 isolates symmetric lateral bending about the +X trajectory; this is
// explicitly a LAB-02-derived diagnostic, not the unchanged LAB-02 preset.
export function runMagnusDiagnostics(RAPIER) {
  const scenario={preset:'launch',seed:'me-phys09-spin-lift',vx:11,vy:0,vz:10};
  const observed=MAGNUS_SPIN_CASES.map(spec=>{
    const options={diagnosticAirDragCd:DRAG_EXPERIMENT_CD};
    if(spec.spin!==null)options.diagnosticMagnusSpinRadS=spec.spin;
    const samples=snapshotsFor(RAPIER,scenario,MAGNUS_OBSERVATION_SECONDS,options);
    const first=samples[0],atOne=samples[Math.round(1/FIXED_DT)];
    const flight=measureAirborneFlight(samples,{dragCoefficient:DRAG_EXPERIMENT_CD});
    const preContact=(timeS)=>flight.observedFirstContactTimeS===null ||
      timeS<flight.observedFirstContactTimeS-1e-8;
    const energy=sample=>{
      const v=sample.ball.velocity,p=sample.ball.position;
      return BALL_MASS_KG*(0.5*(v.x*v.x+v.y*v.y+v.z*v.z)+(-GRAVITY.z)*p.z);
    };
    const point=sample=>Object.freeze({
      timeS:sample.time,
      xM:sample.ball.position.x,
      lateralM:sample.ball.position.y-first.ball.position.y,
      heightM:toGroundClearance(sample.ball.position.z),
      xyDistanceM:Math.hypot(
        sample.ball.position.x-first.ball.position.x,
        sample.ball.position.y-first.ball.position.y)
    });
    const checkpoints=MAGNUS_CHECKPOINT_SECONDS.map(timeS=>{
      if(!preContact(timeS))return Object.freeze({timeS,observed:false});
      return Object.freeze({...point(samples[Math.round(timeS/FIXED_DT)]),observed:true});
    });
    const trail=[];
    for(let n=0;n<samples.length;n+=6){
      if(!preContact(samples[n].time))break;
      trail.push(point(samples[n]));
    }
    const initialSpin=first.angularVelocity;
    const actualSpin=atOne.angularVelocity;
    const liftAtOne=magnusLift(atOne.ball.velocity,actualSpin,{
      radiusM:BALL_RADIUS,densityKgM3:AIR_DENSITY_KG_M3,
      areaM2:BALL_FRONTAL_AREA_M2
    });
    return Object.freeze({
      key:spec.key,label:spec.name,
      initialSpinRadS:Object.freeze(initialSpin),
      initialSpinRps:Math.hypot(...Object.values(initialSpin))/(2*Math.PI),
      spinAtOneRps:Math.hypot(...Object.values(actualSpin))/(2*Math.PI),
      liftClAtOne:liftAtOne.liftCoefficient,
      spinParameterAtOne:liftAtOne.spinParameter,
      liftForceAtOneN:liftAtOne.magnitudeN,
      flight:Object.freeze({...flight,magnusEnabled:spec.spin!==null}),
      lateralAtOneM:atOne.ball.position.y-first.ball.position.y,
      heightAtOneM:toGroundClearance(atOne.ball.position.z),
      translationPotentialEnergyDeltaAtOneJ:energy(atOne)-energy(first),
      checkpoints:Object.freeze(checkpoints),
      trail:Object.freeze(trail)
    });
  });
  const runs=Object.freeze(observed);
  const byKey=key=>runs.find(r=>r.key===key);
  const zero=byKey('none'),plus=byKey('side-positive'),minus=byKey('side-negative');
  return Object.freeze({
    reference:'NASA soccer-ball Magnus direction; MDPI Proceedings 2020 spinning soccer-ball trajectory measurements',
    source:MAGNUS_SOURCE,
    spinRps:MAGNUS_SPIN_RPS,
    dragCd:DRAG_EXPERIMENT_CD,
    liftSlope:MAGNUS_CL_SLOPE,
    liftCap:MAGNUS_CL_CAP,
    coefficientMeaning:'Cl=min(0.25,0.6*Sp_perp), an uncalibrated, nonnegative bounded sensitivity proxy; negative Magnus not modelled',
    launch:Object.freeze({...scenario}),
    runs,
    measuredSignSymmetryAtOneM:plus.lateralAtOneM+minus.lateralAtOneM-2*zero.lateralAtOneM,
    windEnabled:false,gameplayMagnusEnabled:false,
    defaultCd:0,universalPitchDecelerationMps2:GRASS_ROLL_DECELERATION,
    caveat:'Cd=0.24 and Magnus Cl are experimental; the cited spin measurements do not validate this numerical Cl curve for a universal ball. Translational mechanical-energy change includes Rapier integration; not isolated aerodynamic work.'
  });
}


// ME-PHYS-10: controlled force-superposition experiment. 3 speeds × 3
// physical initial spins × 4 force modes (36 separate disposable worlds).
// The same actual Rapier spin is assigned in EVERY mode for a given case;
// no-force and drag-only disable LIFT, not spin, so the comparison is matched.
export const COMBINED_FLIGHT_LAUNCH_VX_MPS=Object.freeze([7,15,30]);
export const COMBINED_FLIGHT_CHECKPOINT_SECONDS=Object.freeze([0,0.5,1,1.5,2]);
export const COMBINED_FLIGHT_SPIN_CASES=Object.freeze([
  Object.freeze({key:'none',label:'No spin',value:null}),
  Object.freeze({key:'positive',label:'+Z side',value:Object.freeze({x:0,y:0,z:MAGNUS_SPIN_RAD_S})}),
  Object.freeze({key:'negative',label:'−Z side',value:Object.freeze({x:0,y:0,z:-MAGNUS_SPIN_RAD_S})})
]);
export const COMBINED_FLIGHT_FORCE_MODES=Object.freeze([
  Object.freeze({key:'baseline',label:'No forces',drag:false,lift:false}),
  Object.freeze({key:'drag',label:'Cd(v) only',drag:true,lift:false}),
  Object.freeze({key:'magnus',label:'Magnus only',drag:false,lift:true}),
  Object.freeze({key:'combined',label:'Cd(v) + Magnus',drag:true,lift:true})
]);
export const COMBINED_FLIGHT_OBSERVATION_SECONDS=3.5;

export function runCombinedFlightDiagnostics(RAPIER) {
  const trials=[];
  for(const vx of COMBINED_FLIGHT_LAUNCH_VX_MPS){
    for(const spin of COMBINED_FLIGHT_SPIN_CASES){
      const launch={preset:'launch',seed:'me-phys10-superposition',vx,vy:0,vz:10};
      const modes={};
      for(const mode of COMBINED_FLIGHT_FORCE_MODES){
        const options=mode.drag?{diagnosticAirDragModel:'speed-dependent'}:{};
        if(spin.value!==null){
          options.diagnosticMagnusSpinRadS=spin.value;
          if(!mode.lift)options.diagnosticMagnusLiftEnabled=false;
        }
        const samples=snapshotsFor(RAPIER,launch,COMBINED_FLIGHT_OBSERVATION_SECONDS,options);
        const flight=measureAirborneFlight(samples,
          mode.drag?{dragModel:'speed-dependent'}:{dragCoefficient:0});
        const first=samples[0],second=samples[Math.round(1/FIXED_DT)];
        const energyAt=sample=>{
          const v=sample.ball.velocity,p=sample.ball.position;
          return BALL_MASS_KG*(0.5*(v.x*v.x+v.y*v.y+v.z*v.z)+(-GRAVITY.z)*p.z);
        };
        const positionAt=sample=>Object.freeze({
          timeS:sample.time,
          lateralM:sample.ball.position.y-first.ball.position.y,
          heightM:toGroundClearance(sample.ball.position.z),
          distanceM:Math.hypot(sample.ball.position.x-first.ball.position.x,
            sample.ball.position.y-first.ball.position.y)
        });
        const beforeGround=timeS=>flight.observedFirstContactTimeS===null||
          timeS<flight.observedFirstContactTimeS-1e-8;
        const checkpoints=COMBINED_FLIGHT_CHECKPOINT_SECONDS.map(timeS=>
          beforeGround(timeS)?
            Object.freeze({observed:true,...positionAt(samples[Math.round(timeS/FIXED_DT)])}):
            Object.freeze({observed:false,timeS}));
        const trail=[];
        for(let index=0;index<samples.length;index+=6){
          if(!beforeGround(samples[index].time))break;
          trail.push(positionAt(samples[index]));
        }
        const v1=second.ball.velocity;
        const cdAtOne=mode.drag?
          speedDependentDragCd(Math.hypot(v1.x,v1.y,v1.z)):0;
        const lift=mode.lift&&spin.value!==null?
          magnusLift(v1,second.angularVelocity,{
            radiusM:BALL_RADIUS,densityKgM3:AIR_DENSITY_KG_M3,
            areaM2:BALL_FRONTAL_AREA_M2
          }):null;
        const dot=lift?lift.force.x*v1.x+lift.force.y*v1.y+
          lift.force.z*v1.z:0;
        modes[mode.key]=Object.freeze({
          mode:mode.key,dragApplied:mode.drag,
          magnusApplied:mode.lift&&spin.value!==null,
          initialActualSpinRps:Math.hypot(...Object.values(first.angularVelocity))/(2*Math.PI),
          actualSpinAtOneRps:Math.hypot(...Object.values(second.angularVelocity))/(2*Math.PI),
          cdAtOne,
          clAtOne:lift?.liftCoefficient??0,
          liftPowerAtOneW:dot,
          lateralAtOneM:second.ball.position.y-first.ball.position.y,
          heightAtOneM:toGroundClearance(second.ball.position.z),
          mechanicalEnergyDeltaAtOneJ:energyAt(second)-energyAt(first),
          firstContactTimeS:flight.observedFirstContactTimeS,
          firstFlightDistanceM:flight.observedFirstContactDistanceM,
          apexHeightM:flight.observedApex.heightM,
          apexTimeS:flight.observedApex.timeS,
          initialLaunch:flight.launch,
          checkpoints:Object.freeze(checkpoints),
          trail:Object.freeze(trail)
        });
      }
      trials.push(Object.freeze({
        vxMps:vx,spinKey:spin.key,spinLabel:spin.label,
        spinRps:spin.value===null?0:MAGNUS_SPIN_RPS,
        initialSpeedMps:Math.hypot(vx,launch.vy,launch.vz),
        baseline:modes.baseline,drag:modes.drag,
        magnus:modes.magnus,combined:modes.combined,
        mirrorResidualAtOneM:null
      }));
    }
  }
  const immutable=Object.freeze(trials);
  return Object.freeze({
    label:'ME-PHYS-10 combined aerodynamic sensitivity',
    launchVxMps:COMBINED_FLIGHT_LAUNCH_VX_MPS,
    spins:COMBINED_FLIGHT_SPIN_CASES.map(s=>Object.freeze({key:s.key,label:s.label,spinRps:s.value===null?0:MAGNUS_SPIN_RPS})),
    modes:COMBINED_FLIGHT_FORCE_MODES.map(m=>Object.freeze({key:m.key,label:m.label})),
    trials:immutable,
    caseCount:immutable.length,
    totalRuns:immutable.length*COMBINED_FLIGHT_FORCE_MODES.length,
    checkpointSeconds:COMBINED_FLIGHT_CHECKPOINT_SECONDS,
    magnusSlope:MAGNUS_CL_SLOPE,magnusCap:MAGNUS_CL_CAP,
    referenceCd:SPEED_DRAG_SOURCE,
    defaultCd:0,defaultMagnus:false,
    fieldCount:1,universalGrassDecelerationMps2:GRASS_ROLL_DECELERATION,
    wind:false,negativeMagnus:false,
    notes:'Measured Rapier 60Hz trajectory; same initial spin in all four modes, lift disabled for matched no-force and drag-only controls. Cd(v) proxy and nonnegative Cl slope/cap are uncalibrated hypotheses. 1s mechanical energy excludes rotation and includes integration error; lift power is the instantaneous F_lift·v dot product. Samples after ground contact are not flight checkpoints.'
  });
}


// ME-PHYS-17: candidate vs existing combined proxy; *all* force profiles
// run in independent disposable Rapier worlds with exactly matched physical
// initial angular velocity and 60Hz stepping. No gameplay/replay changes.
export const LITERATURE_CANDIDATE_VX_MPS=Object.freeze([7,15,30]);
export const LITERATURE_CANDIDATE_SPINS=Object.freeze([
  Object.freeze({key:'none',spin:Object.freeze({x:0,y:0,z:0}),label:'0 rev/s'}),
  Object.freeze({key:'plus',spin:Object.freeze({x:0,y:0,z:MAGNUS_SPIN_RAD_S}),label:'+Z 6 rev/s'}),
  Object.freeze({key:'minus',spin:Object.freeze({x:0,y:0,z:-MAGNUS_SPIN_RAD_S}),label:'−Z 6 rev/s'})
]);
export const LITERATURE_CANDIDATE_OBSERVE_SECONDS=3.5;
export function runLiteratureCandidateDiagnostics(RAPIER){
  const comparisons=[];
  for(const vx of LITERATURE_CANDIDATE_VX_MPS){
    for(const spin of LITERATURE_CANDIDATE_SPINS){
      const launch={preset:'launch',seed:'me-phys17-literature-proxy',vx,vy:0,vz:10};
      const profiles=[
        Object.freeze({key:'current',options:{
          diagnosticAirDragModel:'speed-dependent',diagnosticMagnusSpinRadS:spin.spin
        }}),
        Object.freeze({key:'literature',options:{
          diagnosticAerodynamicProfile:'literature-2011',
          diagnosticMagnusSpinRadS:spin.spin
        }})
      ];
      const outputs={};
      for(const profile of profiles){
        const samples=snapshotsFor(RAPIER,launch,LITERATURE_CANDIDATE_OBSERVE_SECONDS,profile.options);
        const first=samples[0],atOne=samples[Math.round(1/FIXED_DT)];
        const v=atOne.ball.velocity,w=atOne.angularVelocity;
        const coefficients=profile.key==='literature'?literatureCandidateForces(v,w,{
          radiusM:BALL_RADIUS,densityKgM3:AIR_DENSITY_KG_M3,
          areaM2:BALL_FRONTAL_AREA_M2
        }):null;
        const oldLift=profile.key==='current'?magnusLift(v,w,{
          radiusM:BALL_RADIUS,densityKgM3:AIR_DENSITY_KG_M3,
          areaM2:BALL_FRONTAL_AREA_M2
        }):null;
        // Contact detector knows a variable-drag trajectory; the candidate
        // adds spin drag but should not introduce an invented flight mode.
        const flight=measureAirborneFlight(samples,{dragModel:'speed-dependent'});
        // Only pre-contact samples are plotted. The contact marker is the
        // *measured* first collision snapshot, never a fabricated post-contact arc.
        const contactTimeS=flight.observedFirstContactTimeS;
        const point=sample=>Object.freeze({
          timeS:sample.time,
          forwardM:sample.ball.position.x-first.ball.position.x,
          lateralM:sample.ball.position.y-first.ball.position.y,
          undersideM:toGroundClearance(sample.ball.position.z)
        });
        const preContactTrail=[];
        for(let frame=0;frame<samples.length;frame+=6){
          const sample=samples[frame];
          if(contactTimeS!==null&&sample.time>=contactTimeS-1e-8)break;
          preContactTrail.push(point(sample));
        }
        const impact=contactTimeS===null?null:
          point(samples[Math.round(contactTimeS/FIXED_DT)]);
        if(impact!==null && !preContactTrail.length)
          throw new Error('First-contact trajectory had no pre-contact samples');
        outputs[profile.key]=Object.freeze({
          cdAtOne:coefficients?.cd??speedDependentDragCd(Math.hypot(v.x,v.y,v.z)),
          clAtOne:coefficients?.cl??oldLift.liftCoefficient,
          initialSpinRps:Math.hypot(...Object.values(first.angularVelocity))/(2*Math.PI),
          actualSpinRpsAtOne:Math.hypot(...Object.values(w))/(2*Math.PI),
          lateralAtOneM:atOne.ball.position.y-first.ball.position.y,
          undersideAtOneM:toGroundClearance(atOne.ball.position.z),
          firstFlightDistanceM:flight.observedFirstContactDistanceM,
          firstContactTimeS:flight.observedFirstContactTimeS,
          apexHeightM:flight.observedApex.heightM,
          apexTimeS:flight.observedApex.timeS,
          liftPowerAtOneW:coefficients?.forceLiftDotVelocityW??(
            oldLift.force.x*v.x+oldLift.force.y*v.y+oldLift.force.z*v.z),
          preContactTrail:Object.freeze(preContactTrail),
          firstContactPoint:impact,
          oneSecondPoint:contactTimeS===null||contactTimeS>1?
            point(atOne):null
        });
      }
      comparisons.push(Object.freeze({
        vxMps:vx,initialSpeedMps:Math.hypot(vx,10),
        spinKey:spin.key,spinLabel:spin.label,
        current:outputs.current,literature:outputs.literature,
        lateralDeltaAtOneM:outputs.literature.lateralAtOneM-outputs.current.lateralAtOneM,
        flightRangeDeltaM:outputs.literature.firstFlightDistanceM-
          outputs.current.firstFlightDistanceM
      }));
    }
  }
  return Object.freeze({
    label:'ME-PHYS-17 same-launch literature-inspired diagnostic A/B',
    modelId:LITERATURE_MODEL_ID,
    source:LITERATURE_AERO_SOURCE,
    cases:Object.freeze(comparisons),
    independentWorlds:comparisons.length*2,
    speeds:LITERATURE_CANDIDATE_VX_MPS,
    spinCases:LITERATURE_CANDIDATE_SPINS.map(p=>Object.freeze({key:p.key,label:p.label})),
    note:LITERATURE_MODEL_LIMITATIONS,
    modelCalibrated:false,gameplayApproved:false,
    gameplayCd:0,gameplayMagnus:false,
    singlePitchDecelerationMps2:GRASS_ROLL_DECELERATION
  });
}

export function runPhysicsDiagnostics(RAPIER) {
  const bounce=measureBounceSequence(snapshotsFor(RAPIER,{
    preset:'bounce',seed:'me-phys03-bounce'},BOUNCE_OBSERVATION_SECONDS));
  const rolling=ROLL_LAUNCH_SPEEDS_M_S.map(speed=>{
    const result=measureRollSequence(snapshotsFor(RAPIER,{
      preset:'roll',seed:'me-phys03-roll',vx:speed,vy:0,z:0
    },ROLL_OBSERVATION_SECONDS));
    return Object.freeze({launchSpeedMps:speed,...result});
  });
  const spinTrials=SPIN_FRACTIONS.map(fraction=>
    measureSpinTransition(snapshotsFor(RAPIER,{
      preset:'roll',seed:'me-phys04-spin',vx:4,vy:0,vz:0,z:0
    },SPIN_OBSERVATION_SECONDS,{diagnosticInitialRollFraction:fraction}),fraction));
  const naturalGrassTrials=TURF_SENSITIVITY_COEFFICIENTS.map(coefficient=>
    measureNaturalGrassSensitivity(snapshotsFor(RAPIER,{
      preset:'roll',seed:'me-phys05-natural-grass',vx:4,vy:0,vz:0,z:0
    },TURF_SENSITIVITY_SECONDS,{
      diagnosticInitialRollFraction:1,
      diagnosticGrassRollDecelerationMps2:coefficient
    }),coefficient));
  const flight=measureAirborneFlight(snapshotsFor(RAPIER,{
    preset:'launch',seed:'me-phys06-flight'
  },FLIGHT_OBSERVATION_SECONDS));
  // Drag-only A/B: same launch, same gravity/grass/collider/seed, one force.
  const draggedFlight=measureAirborneFlight(snapshotsFor(RAPIER,{
    preset:'launch',seed:'me-phys06-flight'
  },FLIGHT_OBSERVATION_SECONDS,{diagnosticAirDragCd:DRAG_EXPERIMENT_CD}),
  {dragCoefficient:DRAG_EXPERIMENT_CD});
  const dragComparison=Object.freeze({
    candidateCd:DRAG_EXPERIMENT_CD,
    airDensityKgM3:AIR_DENSITY_KG_M3,
    projectedAreaM2:BALL_FRONTAL_AREA_M2,
    ballMassKg:BALL_MASS_KG,
    reference:'NASA D=0.5*rho*Cd*A*v²; Goff et al. (2026) Nike 0.244 in 18–35 m/s post-critical regime',
    caveat:'Constant Cd=0.24 is illustrative, not calibrated for LAB-02 speed or a universal football',
    baseline:flight,
    dragOnly:draggedFlight,
    distanceDeltaM:draggedFlight.observedFirstContactDistanceM===null||
      flight.observedFirstContactDistanceM===null?null:
      draggedFlight.observedFirstContactDistanceM-flight.observedFirstContactDistanceM,
    apexDeltaM:draggedFlight.observedApex.heightM-flight.observedApex.heightM,
    magnusEnabled:false,windEnabled:false,gameplayDragEnabled:false
  });
  return Object.freeze({
    version:ENGINE_VERSION,
    physics:Object.freeze({
      massKg:BALL_MASS_KG,radiusM:BALL_RADIUS,
      grassRollingDecelerationMps2:GRASS_ROLL_DECELERATION,
      stopThresholdMps:ROLL_STOP_SPEED,
      groundRestitution:GROUND_RESTITUTION,
      ballRestitution:BALL_RESTITUTION
    }),
    bounce,
    flight,
    dragComparison,
    speedDragComparison:runSpeedDependentDragDiagnostics(RAPIER),
    magnusComparison:runMagnusDiagnostics(RAPIER),
    combinedFlightComparison:runCombinedFlightDiagnostics(RAPIER),
    literatureCandidateComparison:runLiteratureCandidateDiagnostics(RAPIER),
    calibrationEvidence:readAerodynamicCalibrationEvidence(),
    universalBallReadiness:assessUniversalBallReadiness(),
    calibrationDataIntake:describeCalibrationIntake(),
    rolling:Object.freeze(rolling),
    spinTrials:Object.freeze(spinTrials),
    naturalGrass:Object.freeze({
      reference:Object.freeze({
        ...NATURAL_GRASS_OBSERVED_DECEL_MPS2,
        source:'Baker, S.W. (1989), ASTM STP 25348S',
        meaning:'Approx. 90% observed on six natural grass pitches; not certification'
      }),
      trials:Object.freeze(naturalGrassTrials),
      selectedDefaultDecelerationMps2:GRASS_ROLL_DECELERATION,
      recommendation:'Retain default until evidence supports revising the one universal grass coefficient'
    })
  });
}
