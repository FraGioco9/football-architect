import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine,canonicalSnapshot,ENGINE_VERSION,
  BALL_MASS_KG,BALL_RADIUS,GRASS_ROLL_DECELERATION,GROUND_RESTITUTION,BALL_RESTITUTION,
  AIR_DENSITY_KG_M3,BALL_FRONTAL_AREA_M2,DRAG_EXPERIMENT_CD}
  from '../src/core.mjs';
import {measureBounceSequence,measureRollSequence,runPhysicsDiagnostics,
  ROLL_CHECKPOINT_SECONDS,ROLL_LAUNCH_SPEEDS_M_S,
  BOUNCE_OBSERVATION_SECONDS,ROLL_OBSERVATION_SECONDS,
  SPIN_FRACTIONS,SPIN_CHECKPOINT_SECONDS,SPIN_OBSERVATION_SECONDS,
  SLIP_TRANSITION_THRESHOLD_MPS,measureSpinTransition,
  NATURAL_GRASS_OBSERVED_DECEL_MPS2,TURF_SENSITIVITY_COEFFICIENTS,
  TURF_SENSITIVITY_CHECKPOINTS_SECONDS,TURF_SENSITIVITY_SECONDS,
  measureNaturalGrassSensitivity,
  FLIGHT_OBSERVATION_SECONDS,FLIGHT_CHECKPOINT_SECONDS,measureAirborneFlight,
  SPEED_DRAG_LAUNCH_VX_MPS,SPEED_DRAG_CHECKPOINT_SECONDS,runSpeedDependentDragDiagnostics,
  MAGNUS_SPIN_CASES,MAGNUS_SPIN_RPS,MAGNUS_CHECKPOINT_SECONDS,runMagnusDiagnostics,
  COMBINED_FLIGHT_LAUNCH_VX_MPS,COMBINED_FLIGHT_SPIN_CASES,
  COMBINED_FLIGHT_FORCE_MODES,COMBINED_FLIGHT_CHECKPOINT_SECONDS,
  runCombinedFlightDiagnostics}
  from '../src/physics-diagnostics.mjs';

import {SPEED_DRAG_NODES,SPEED_DRAG_SOURCE,speedDependentDragCd} from '../src/aerodynamics.mjs';
import {magnusLift,MAGNUS_SPIN_RAD_S,MAGNUS_SPIN_LIMIT_RAD_S,MAGNUS_CL_SLOPE,MAGNUS_CL_CAP} from '../src/magnus.mjs';
import {CD_PUBLICATION,CS_PUBLICATION,CD_EURO2024_ANCHORS,CS_CURVE_KICK_AVERAGES,
 currentMagnusProxyAtSp,readAerodynamicCalibrationEvidence} from '../src/calibration-evidence.mjs';
import {SINGLE_BALL_SPEC,SINGLE_BALL_SOURCES,TRIONDA_ORIENTATION_COMPARISON,
 UNIVERSAL_CALIBRATION_GATES,assessUniversalBallReadiness} from '../src/universal-ball-readiness.mjs';
import {CALIBRATION_DATASET_CANDIDATES,CALIBRATION_INTAKE_FIELDS,
 inspectCalibrationDataset,inspectCalibrationBundle,describeCalibrationIntake}
 from '../src/calibration-dataset-intake.mjs';
import {parseBall3dCsvExcerpt,adaptBall3dGroundTruthExcerpt}
 from '../src/ball3d-trajectory-adapter.mjs';
import {evaluateFlightTrajectory,generateDisposableBallPrediction}
 from '../src/trajectory-validation.mjs';
import {literatureCandidateForces,LITERATURE_MODEL_ID,LITERATURE_AERO_SOURCE,
  LITERATURE_CL_LIMIT,LITERATURE_CL_EXP_RATE_PER_RPS,LITERATURE_SPIN_DRAG_PER_RPS,
  LITERATURE_SPIN_DRAG_MAX,LITERATURE_MODEL_LIMITATIONS}
  from '../src/literature-aero-candidate.mjs';
import {runLiteratureCandidateDiagnostics,LITERATURE_CANDIDATE_VX_MPS,
  LITERATURE_CANDIDATE_SPINS} from '../src/physics-diagnostics.mjs';
import {prepareFlightPlaybackPair,sampleFlightPlaybackPair,flightPlaybackWallTime} from '../src/flight-playback.mjs';

const RAPIER=await initializeRapier(wasm);

test('ME-PHYS-03 full bounce sequence records decaying peaks, contact timing and honest settling',()=>{
 const report=runPhysicsDiagnostics(RAPIER);
 const b=report.bounce;
 assert.equal(report.version,ENGINE_VERSION);
 assert.equal(report.physics.massKg,BALL_MASS_KG);
 assert.equal(report.physics.radiusM,BALL_RADIUS);
 assert.equal(report.physics.grassRollingDecelerationMps2,GRASS_ROLL_DECELERATION);
 assert.equal(report.physics.groundRestitution,GROUND_RESTITUTION);
 assert.equal(report.physics.ballRestitution,BALL_RESTITUTION);
 assert.equal(b.observationSeconds,BOUNCE_OBSERVATION_SECONDS);
 assert.ok(b.impactCount>=3,'full sequence must capture repeated ground impacts');
 assert.equal(b.impactCount,b.impacts.length);
 const peaks=b.impacts.filter(x=>x.apexHeightM!==null);
 assert.ok(peaks.length>=2,'at least two complete rebound apexes required');
 assert.ok(peaks[0].apexHeightM>0.6&&peaks[0].apexHeightM<0.85,
   'first rebound should match previously observed ~0.748m');
 assert.ok(peaks[0].energyRetainedFraction>0&&peaks[0].energyRetainedFraction<1);
 for(const [i,p] of b.impacts.entries()){
   assert.equal(p.number,i+1);
   assert.ok(p.impactTimeS>0&&p.impactTimeS<=BOUNCE_OBSERVATION_SECONDS);
   if(i>0){
     assert.ok(p.impactTimeS>b.impacts[i-1].impactTimeS);
     assert.ok(p.intervalSincePreviousS>0);
   }else assert.equal(p.intervalSincePreviousS,null);
 }
 for(let i=1;i<peaks.length;i++){
   if(peaks[i-1].apexHeightM<0.025)break; // low-amplitude solver tolerance
   assert.ok(peaks[i].apexHeightM<peaks[i-1].apexHeightM+0.005,
     'resolvable rebound must not gain potential energy');
 }
 assert.equal(b.settleObserved,b.settledAtS!==null);
 if(b.settledAtS!==null)
   assert.ok(b.settledAtS>0&&b.settledAtS<BOUNCE_OBSERVATION_SECONDS);
 process.stdout.write('ME03_BOUNCE_SERIES '+JSON.stringify(b)+'\n');
});

test('ME-PHYS-03 2/4/6 m/s ground roll checkpoints, stop time, distance and A/B order',()=>{
 const report=runPhysicsDiagnostics(RAPIER);
 assert.equal(report.rolling.length,3);
 assert.deepEqual(report.rolling.map(r=>r.launchSpeedMps),ROLL_LAUNCH_SPEEDS_M_S);
 for(const run of report.rolling){
   assert.equal(run.observationSeconds,ROLL_OBSERVATION_SECONDS);
   assert.deepEqual(run.checkpoints.map(p=>p.timeS),ROLL_CHECKPOINT_SECONDS);
   assert.ok(Math.abs(run.checkpoints[0].speedMps-run.launchSpeedMps)<1e-6);
   assert.equal(run.checkpoints[0].distanceM,0);
   assert.ok(Math.abs(run.checkpoints[0].slipMps-run.launchSpeedMps)<1e-5,
     'ball starts without spin, so initial ground slip equals launch speed');
   assert.ok(run.checkpoints.every(p=>p.slipMps!==null&&Number.isFinite(p.slipMps)&&p.slipMps>=0),
     'every roll checkpoint must report contact slip using actual angular velocity');
   assert.ok(Number.isFinite(run.finalPositionM.x)&&Number.isFinite(run.finalPositionM.y));
   assert.ok(run.finalPositionM.x>0,'final position must be on the forward pitch axis');
   assert.ok(run.checkpoints[1].speedMps<run.checkpoints[0].speedMps-0.3,
     'rolling velocity must decelerate at grass contact');
   assert.ok(run.finalSpeedMps<0.06,'stop must occur within 12s');
   assert.ok(run.stoppedAtS!==null&&run.stoppedAtS>0);
   assert.ok(run.distanceToStopM>0&&run.distanceToStopM<=run.finalDistanceM+1e-8);
   for(let i=1;i<run.checkpoints.length;i++){
     assert.ok(run.checkpoints[i].distanceM>=run.checkpoints[i-1].distanceM-1e-9,
       'distance traveled cannot shrink over time');
   }
 }
 for(let i=1;i<report.rolling.length;i++){
   const slower=report.rolling[i-1],faster=report.rolling[i];
   assert.ok(faster.stoppedAtS>slower.stoppedAtS,
     'greater initial speed must take longer to stop');
   assert.ok(faster.distanceToStopM>slower.distanceToStopM,
     'greater initial speed must travel further');
 }
 process.stdout.write('ME03_ROLL_SERIES '+JSON.stringify(report.rolling)+'\n');
});

test('ME-PHYS-03 measurements are deterministic and never mutate the active world',()=>{
 const active=createEngine(RAPIER,{preset:'launch',seed:'metrics-preserve',vx:11});
 try{
   for(let i=0;i<75;i++)active.step();
   const before=canonicalSnapshot(active.snapshot());
   const a=runPhysicsDiagnostics(RAPIER);
   const b=runPhysicsDiagnostics(RAPIER);
   assert.equal(JSON.stringify(a),JSON.stringify(b),'same WASM build and inputs must replay identically');
   assert.equal(canonicalSnapshot(active.snapshot()),before,
     'diagnostic experiments must not advance the lab world');
   assert.ok(Object.isFrozen(a.rolling)&&Object.isFrozen(a.bounce.impacts));
 }finally{active.dispose();}
});

test('ME-PHYS-03 short observation windows report unknown rest, not invented zero',()=>{
 const sample=(tick,z,vx,vz,nearGround=false)=>({
   tick,time:tick/60,nearGround,
   ball:{position:{x:tick*vx/60,y:0,z:BALL_RADIUS+z},velocity:{x:vx,y:0,z:vz}}
 });
 const bounce=measureBounceSequence([sample(0,2,0,0),sample(1,1.99,0,-0.16)]);
 assert.equal(bounce.settledAtS,null);
 assert.equal(bounce.settleObserved,false);
 assert.equal(bounce.impactCount,0);
 const roll=measureRollSequence([sample(0,0,3,0,true),sample(1,0,2.9,0,true)]);
 assert.equal(roll.stoppedAtS,null);
 assert.equal(roll.distanceToStopM,null);
 assert.equal(roll.checkpoints.length,1);
 assert.equal(roll.checkpoints[0].slipMps,null,'absent angular data must be unknown, not fabricated');
 assert.ok(Number.isFinite(roll.finalPositionM.x)&&Number.isFinite(roll.finalPositionM.y));
 assert.throws(()=>measureBounceSequence([]),/required/);
 assert.throws(()=>measureRollSequence([]),/required/);
});


test('ME-PHYS-04 diagnostic spin is isolated, correctly signed and resettable without changing default physics',()=>{
 assert.equal(ENGINE_VERSION,'me-01-physics-v4','no retuning or physics version bump');
 for(const bad of [-0.1,1.01,Infinity,NaN,'0.5'])
   assert.throws(()=>createEngine(RAPIER,{preset:'roll'},{diagnosticInitialRollFraction:bad}),
     /Invalid diagnostic initial roll fraction/);
 assert.throws(()=>createEngine(RAPIER,{preset:'drop'},{diagnosticInitialRollFraction:1}),
   /grounded roll diagnostics/);
 const engines=[0,0.5,1].map(f=>createEngine(RAPIER,{
   preset:'roll',seed:'spin-signed',vx:4,vy:0,vz:0,z:0
 },{diagnosticInitialRollFraction:f}));
 try{
   const [none,half,matched]=engines;
   const angular=engines.map(e=>e.angularVelocity());
   for(const [i,f] of [0,0.5,1].entries()){
     assert.ok(Math.abs(angular[i].y-4/BALL_RADIUS*f)<1e-3);
     assert.ok(Math.abs(angular[i].x)<1e-8&&Math.abs(angular[i].z)<1e-8);
   }
   assert.ok(Math.abs(4-BALL_RADIUS*angular[0].y-4)<1e-6);
   assert.ok(Math.abs(4-BALL_RADIUS*angular[1].y-2)<1e-3);
   assert.ok(Math.abs(4-BALL_RADIUS*angular[2].y)<1e-3,
     'rolling-compatible +Y spin must cancel bottom contact-point slip');
   assert.equal(canonicalSnapshot(none.snapshot()),canonicalSnapshot(matched.snapshot()),
     'initial world position/translation unchanged by experimental spin');
   for(const e of engines)e.step();
   assert.notEqual(canonicalSnapshot(none.snapshot()),canonicalSnapshot(matched.snapshot()),
     'spin changes the trajectory after contact, not physics constants');
   const reset=matched.reset();
   try{
     assert.ok(Math.abs(reset.angularVelocity().y-4/BALL_RADIUS)<1e-3,
       'reset must preserve diagnostic initial angular velocity');
   }finally{reset.dispose();}
 }finally{for(const e of engines)e.dispose();}
});

test('ME-PHYS-04 same-speed spin trials expose real transient slip, motion and energy',()=>{
 const report=runPhysicsDiagnostics(RAPIER);
 assert.deepEqual(report.spinTrials.map(s=>s.spinFraction),SPIN_FRACTIONS);
 assert.equal(report.spinTrials.length,3);
 assert.equal(SPIN_OBSERVATION_SECONDS,7);
 const [none,half,matched]=report.spinTrials;
 for(const trial of report.spinTrials){
   assert.deepEqual(trial.checkpoints.map(c=>c.timeS),SPIN_CHECKPOINT_SECONDS);
   const initial=trial.checkpoints[0];
   assert.ok(Math.abs(initial.speedMps-4)<1e-6);
   assert.equal(initial.distanceM,0);
   assert.ok(trial.initialKineticJ>0);
   assert.ok(Math.abs(initial.totalKineticJ-trial.initialKineticJ)<1e-7);
   assert.ok(Math.abs(initial.angularSpeedRadS-
     Math.hypot(...Object.values(trial.initialAngularVelocityRadS)))<1e-5);
   assert.ok(Math.abs(initial.energyRetainedFraction-1)<1e-10);
   assert.ok(Math.abs(initial.totalKineticJ-
     initial.translationKineticJ-initial.rotationKineticJ)<1e-7);
   assert.ok(trial.checkpoints.every(c=>Object.values(c).every(v=>v===null||Number.isFinite(v))));
   const atOne=trial.checkpoints.find(c=>c.timeS===1);
   assert.ok(atOne.energyRetainedFraction>0&&atOne.energyRetainedFraction<1.01,
     'energy should have dissipated within 1s: '+JSON.stringify(atOne));
   assert.ok(trial.stoppedAtS!==null&&trial.stoppedAtS>0);
   assert.ok(trial.distanceToStopM>0&&trial.distanceToStopM<=trial.finalDistanceM+1e-5);
   assert.ok(trial.transitionTimeS!==null,
     'sliding-to-rolling should be observable at 4 m/s: '+JSON.stringify(trial));
   assert.ok(trial.transitionTimeS<2,'contact transition should happen before 2s');
 }
 assert.ok(Math.abs(none.checkpoints[0].slipMps-4)<0.001);
 assert.ok(Math.abs(half.checkpoints[0].slipMps-2)<0.001);
 assert.ok(matched.checkpoints[0].slipMps<0.001);
 const s1=report.spinTrials.map(r=>r.checkpoints.find(p=>p.timeS===1).speedMps);
 assert.ok(s1[0]<s1[1]&&s1[1]<s1[2],'more matched initial spin should preserve greater 1s speed: '+s1);
 assert.ok(none.distanceToStopM<half.distanceToStopM &&
   half.distanceToStopM<matched.distanceToStopM,
   'equal launch speeds but more matched spin should travel further');
 assert.ok(matched.transitionTimeS<=half.transitionTimeS &&
   half.transitionTimeS<=none.transitionTimeS,
   'slip transition should not be slower with matched spin');
 assert.ok(SLIP_TRANSITION_THRESHOLD_MPS>0&&SLIP_TRANSITION_THRESHOLD_MPS<0.2);
 process.stdout.write('ME04_SLIP_SPIN_SERIES '+JSON.stringify(report.spinTrials)+'\n');
});

test('ME-PHYS-04 zero spin trial agrees with accepted LAB-04 4m/s baseline',()=>{
 const report=runPhysicsDiagnostics(RAPIER);
 const base=report.rolling.find(r=>r.launchSpeedMps===4),sliding=report.spinTrials[0];
 assert.ok(Math.abs(base.stoppedAtS-sliding.stoppedAtS)<1e-6);
 assert.ok(Math.abs(base.distanceToStopM-sliding.distanceToStopM)<1e-5);
 assert.equal(base.checkpoints.find(c=>c.timeS===1).speedMps,
   sliding.checkpoints.find(c=>c.timeS===1).speedMps);
 assert.throws(()=>measureSpinTransition([],0),/Spin diagnostics require/);
 assert.throws(()=>measureSpinTransition([{},{}],0),/angular velocity/);
});


test('ME-PHYS-05 only alters grass deceleration in grounded diagnostic roll worlds',()=>{
  assert.equal(ENGINE_VERSION,'me-01-physics-v4','same official replay parameters');
  assert.equal(GRASS_ROLL_DECELERATION,0.8);
  for(const invalid of [0,0.29,2.01,Infinity,NaN,'0.8'])
    assert.throws(()=>createEngine(RAPIER,{preset:'roll'},{
      diagnosticGrassRollDecelerationMps2:invalid
    }),/Invalid diagnostic grass rolling deceleration/);
  assert.throws(()=>createEngine(RAPIER,{preset:'drop'},{
    diagnosticGrassRollDecelerationMps2:1.5
  }),/grounded roll diagnostics/);
  assert.throws(()=>createEngine(RAPIER,{preset:'launch'},{
    diagnosticGrassRollDecelerationMps2:0.45
  }),/grounded roll diagnostics/);
  assert.throws(()=>createEngine(RAPIER,{preset:'roll',z:1},{
    diagnosticGrassRollDecelerationMps2:0.45
  }),/grounded roll diagnostics/);
  const defaults=createEngine(RAPIER,{preset:'roll',vx:4});
  const explicit=createEngine(RAPIER,{preset:'roll',vx:4},{
    diagnosticGrassRollDecelerationMps2:0.8
  });
  const alternative=createEngine(RAPIER,{preset:'roll',vx:4},{
    diagnosticGrassRollDecelerationMps2:0.45
  });
  try{
    for(let i=0;i<150;i++){
      const a=defaults.step(),b=explicit.step();
      assert.equal(canonicalSnapshot(a),canonicalSnapshot(b),
        'default source physics must be identical to explicitly specified 0.8 at tick '+(i+1));
      alternative.step();
    }
    assert.notEqual(canonicalSnapshot(defaults.snapshot()),
      canonicalSnapshot(alternative.snapshot()),'alternative resistance must change motion');
    const replay=alternative.reset();
    try{
      const original=createEngine(RAPIER,{preset:'roll',vx:4},{
        diagnosticGrassRollDecelerationMps2:0.45
      });
      try{
        for(let i=0;i<150;i++){replay.step();original.step();}
        assert.equal(canonicalSnapshot(replay.snapshot()),canonicalSnapshot(original.snapshot()),
          'sensitivity reset must preserve the one chosen coefficient');
      }finally{original.dispose();}
    }finally{replay.dispose();}
  }finally{defaults.dispose();explicit.dispose();alternative.dispose();}
});

test('ME-PHYS-05 natural-grass rolling sensitivity is measured, not inferred from configured parameter',()=>{
  const report=runPhysicsDiagnostics(RAPIER);
  assert.deepEqual(TURF_SENSITIVITY_COEFFICIENTS,[0.45,0.8,1.5]);
  assert.deepEqual(NATURAL_GRASS_OBSERVED_DECEL_MPS2,{min:0.45,max:1.5});
  assert.equal(report.naturalGrass.selectedDefaultDecelerationMps2,0.8);
  assert.match(report.naturalGrass.reference.source,/Baker/);
  assert.match(report.naturalGrass.recommendation,/Retain default/);
  const trials=report.naturalGrass.trials;
  assert.deepEqual(trials.map(t=>t.configuredDecelerationMps2),[0.45,0.8,1.5]);
  assert.deepEqual(trials.map(t=>t.isDefault),[false,true,false]);
  for(const trial of trials){
    assert.deepEqual(trial.checkpoints.map(c=>c.timeS),TURF_SENSITIVITY_CHECKPOINTS_SECONDS);
    assert.ok(Math.abs(trial.startSpeedMps-4)<1e-6);
    assert.ok(trial.startContactSlipMps<1e-3,'pure roll starts with zero ground slip');
    assert.ok(Math.abs(trial.checkpoints[0].speedMps-4)<1e-6);
    assert.ok(trial.stoppedAtS!==null&&trial.stoppedAtS<TURF_SENSITIVITY_SECONDS-1,
      'all candidate resistances should come to rest before measurement window ends');
    assert.ok(trial.distanceToStopM>0);
    assert.ok(trial.lastObservedDistanceM>=trial.distanceToStopM);
    assert.ok(trial.steadyWindowMaxSlipMps>=0&&
      Number.isFinite(trial.steadyWindowMaxSlipMps));
    assert.ok(trial.observedDecelerationMps2>0);
    assert.ok(Math.abs(trial.observedDecelerationMps2-trial.configuredDecelerationMps2)<0.15,
      'observed steady speed slope must be close to—but not invented from—coefficient: '+JSON.stringify(trial));
    for(let i=1;i<trial.checkpoints.length;i++){
      assert.ok(trial.checkpoints[i].distanceM>=trial.checkpoints[i-1].distanceM-1e-8);
    }
  }
  for(let i=1;i<trials.length;i++){
    assert.ok(trials[i-1].stoppedAtS>trials[i].stoppedAtS,
      'more resistance must stop sooner');
    assert.ok(trials[i-1].distanceToStopM>trials[i].distanceToStopM,
      'more resistance must shorten the distance');
    assert.ok(trials[i-1].checkpoints.find(c=>c.timeS===1).speedMps >
      trials[i].checkpoints.find(c=>c.timeS===1).speedMps);
  }
  const nominal=trials[1],matched=report.spinTrials.find(t=>t.spinFraction===1);
  assert.ok(Math.abs(nominal.stoppedAtS-matched.stoppedAtS)<1e-6);
  assert.ok(Math.abs(nominal.distanceToStopM-matched.distanceToStopM)<1e-5,
    '100% spin, 0.8m/s² default must reproduce accepted ME-PHYS-04 baseline');
  assert.ok(Math.abs(nominal.observedDecelerationMps2-0.8)<0.09);
  assert.throws(()=>measureNaturalGrassSensitivity([],0.8),/Invalid/);
  assert.throws(()=>measureNaturalGrassSensitivity([{},{}],0.8),/angular velocity/);
  process.stdout.write('ME05_NATURAL_GRASS_SERIES '+JSON.stringify(trials)+'\n');
});


test('ME-PHYS-06 LAB-02 flight uses fixed-step ballistics with no invented air forces',()=>{
 const report=runPhysicsDiagnostics(RAPIER);
 const f=report.flight;
 process.stdout.write('ME06_FLIGHT_BASELINE '+JSON.stringify(f)+'\n');
 assert.equal(ENGINE_VERSION,'me-01-physics-v4');
 assert.equal(f.aerodynamicDragEnabled,false);
 assert.equal(f.magnusEnabled,false);
 assert.equal(f.observationSeconds,FLIGHT_OBSERVATION_SECONDS);
 assert.ok(Math.abs(f.launch.clearanceM-0.8)<1e-5,'Rapier stores physical positions in float32');
 assert.equal(f.launch.vx,11);
 assert.equal(f.launch.vy,2);
 assert.equal(f.launch.vz,10);
 assert.deepEqual(f.checkpoints.map(x=>x.timeS),FLIGHT_CHECKPOINT_SECONDS);
 assert.ok(f.observedFirstContactTimeS!==null&&
   f.observedFirstContactTimeS>2.0&&f.observedFirstContactTimeS<2.3,
   'first contact must be detected before rebound: '+JSON.stringify(f));
 assert.ok(f.idealFirstContactTimeS>2.0&&f.idealFirstContactTimeS<2.3);
 assert.ok(Math.abs(f.observedFirstContactTimeS-f.idealFirstContactTimeS)<0.10,
   'fixed-step solver should be close to continuous ideal flight');
 assert.ok(f.observedApex.heightM>5.4&&f.observedApex.heightM<6.1);
 assert.ok(Math.abs(f.observedApex.heightM-f.idealApex.heightM)<0.15);
 assert.ok(f.observedApex.timeS>0.85&&f.observedApex.timeS<1.2);
 assert.ok(f.maxHorizontalDeviationM<0.01,
   'no drag must preserve horizontal speed while airborne');
 assert.ok(f.maxVerticalDeviationM<0.25,
   'semi-implicit solver error should be bounded');
 assert.ok(Math.abs(f.observedFirstContactDistanceM-f.idealFirstContactDistanceM)<1.5);
 for(const check of f.checkpoints){
   assert.ok(check.observedClearanceM>=0);
   assert.ok(check.idealClearanceM>=0);
   assert.ok(check.horizontalDifferenceM<0.01);
   assert.ok(Math.abs(check.verticalDifferenceM)<0.25);
 }
 assert.equal(f.checkpoints[0].horizontalDistanceM,0);
});

test('ME-PHYS-06 flight baseline remains read-only and deterministic with one universal field',()=>{
 const active=createEngine(RAPIER,{preset:'roll',vx:4,seed:'universal-one-turf'});
 try{
   for(let n=0;n<80;n++)active.step();
   const before=canonicalSnapshot(active.snapshot());
   const a=runPhysicsDiagnostics(RAPIER);
   const b=runPhysicsDiagnostics(RAPIER);
   assert.equal(JSON.stringify(a.flight),JSON.stringify(b.flight));
   assert.equal(canonicalSnapshot(active.snapshot()),before);
   assert.equal(a.physics.grassRollingDecelerationMps2,0.8);
   assert.equal(a.naturalGrass.selectedDefaultDecelerationMps2,0.8);
   assert.ok(Math.abs(a.flight.launch.clearanceM-0.8)<1e-5);
   assert.equal(a.flight.aerodynamicDragEnabled,false);
 }finally{active.dispose();}
 assert.throws(()=>measureAirborneFlight([]),/snapshots required/);
 assert.throws(()=>measureAirborneFlight([{
   ball:{position:{x:0,y:0,z:0.11},velocity:{x:0,y:0,z:0}}
 },{
   ball:{position:{x:0,y:0,z:0.11},velocity:{x:0,y:0,z:0}}
 }]),/upward launch/);
});


test('ME-PHYS-07 quadratic air drag is experimental, bounded and inert by default',()=>{
 assert.equal(ENGINE_VERSION,'me-01-physics-v4');
 assert.equal(DRAG_EXPERIMENT_CD,0.24);
 assert.equal(AIR_DENSITY_KG_M3,1.225);
 assert.ok(Math.abs(BALL_FRONTAL_AREA_M2-Math.PI*BALL_RADIUS**2)<1e-12);
 for(const bad of [-0.01,0.61,Infinity,NaN,'0.24'])
   assert.throws(()=>createEngine(RAPIER,{preset:'launch'},{diagnosticAirDragCd:bad}),
     /Invalid diagnostic air drag coefficient/);
 assert.throws(()=>createEngine(RAPIER,{preset:'roll'},{diagnosticAirDragCd:0.24}),
   /only available for launch diagnostics/);
 assert.throws(()=>createEngine(RAPIER,{preset:'bounce'},{diagnosticAirDragCd:0.24}),
   /only available for launch diagnostics/);
 const defaultLaunch=createEngine(RAPIER,{preset:'launch',seed:'drag-default-same'});
 const explicitZero=createEngine(RAPIER,{preset:'launch',seed:'drag-default-same'},
   {diagnosticAirDragCd:0});
 const dragged=createEngine(RAPIER,{preset:'launch',seed:'drag-default-same'},
   {diagnosticAirDragCd:0.24});
 try{
   for(let tick=1;tick<=180;tick++){
     const a=defaultLaunch.step(),b=explicitZero.step(),c=dragged.step();
     assert.equal(canonicalSnapshot(a),canonicalSnapshot(b),
       'default launch must exactly match explicit zero Cd at tick '+tick);
     for(const n of [...Object.values(c.ball.position),...Object.values(c.ball.velocity)])
       assert.ok(Number.isFinite(n));
   }
   assert.notEqual(canonicalSnapshot(dragged.snapshot()),
     canonicalSnapshot(defaultLaunch.snapshot()),
     'air resistance must alter only the diagnostic flight');
   const restarted=dragged.reset();
   const fresh=createEngine(RAPIER,{preset:'launch',seed:'drag-default-same'},
     {diagnosticAirDragCd:0.24});
   try{
     for(let n=0;n<180;n++){restarted.step();fresh.step();}
     assert.equal(canonicalSnapshot(restarted.snapshot()),canonicalSnapshot(fresh.snapshot()),
       'reset must preserve the candidate drag parameter without stacking forces');
   }finally{restarted.dispose();fresh.dispose();}
 }finally{defaultLaunch.dispose();explicitZero.dispose();dragged.dispose();}
});

test('ME-PHYS-07 A/B measures shorter first flight from drag, without Magnus or wind',()=>{
 const report=runPhysicsDiagnostics(RAPIER);
 const cmp=report.dragComparison;
 assert.equal(cmp.candidateCd,DRAG_EXPERIMENT_CD);
 assert.equal(cmp.airDensityKgM3,AIR_DENSITY_KG_M3);
 assert.equal(cmp.projectedAreaM2,BALL_FRONTAL_AREA_M2);
 assert.equal(cmp.ballMassKg,BALL_MASS_KG);
 assert.match(cmp.caveat,/illustrative/);
 assert.equal(cmp.gameplayDragEnabled,false);
 assert.equal(cmp.magnusEnabled,false);
 assert.equal(cmp.windEnabled,false);
 assert.equal(cmp.baseline.aerodynamicDragEnabled,false);
 assert.equal(cmp.dragOnly.aerodynamicDragEnabled,true);
 assert.equal(cmp.dragOnly.dragCoefficient,DRAG_EXPERIMENT_CD);
 assert.equal(cmp.baseline.dragCoefficient,0);
 assert.deepEqual(cmp.baseline,report.flight,'existing LAB-02 baseline must remain byte-for-byte');
 assert.deepEqual(cmp.dragOnly.launch,cmp.baseline.launch);
 assert.ok(cmp.dragOnly.observedFirstContactTimeS!==null);
 assert.ok(cmp.dragOnly.observedFirstContactDistanceM!==null);
 assert.ok(cmp.dragOnly.observedFirstContactDistanceM<cmp.baseline.observedFirstContactDistanceM-0.5,
   'quadratic drag must shorten first flight: '+JSON.stringify(cmp));
 assert.ok(cmp.dragOnly.observedApex.heightM<cmp.baseline.observedApex.heightM-0.1);
 assert.ok(cmp.distanceDeltaM<0);
 assert.ok(cmp.apexDeltaM<0);
 const a=cmp.baseline.checkpoints.find(v=>v.timeS===1);
 const b=cmp.dragOnly.checkpoints.find(v=>v.timeS===1);
 assert.ok(a&&b&&b.horizontalDistanceM<a.horizontalDistanceM-0.1,
   'drag must reduce forward travel before first impact');
 assert.ok(cmp.dragOnly.maxHorizontalDeviationM>0.1,
   'diagnostic should measure real drag divergence, not label a baseline');
 assert.ok(cmp.dragOnly.observedFirstContactTimeS<3.5);
 for(const point of cmp.dragOnly.checkpoints){
   assert.ok(point.timeS<=cmp.dragOnly.observedFirstContactTimeS);
   assert.ok(Number.isFinite(point.observedClearanceM));
 }
 process.stdout.write('ME07_AIR_DRAG_AB '+JSON.stringify({
   dragCd:cmp.candidateCd,zero:{
     time:cmp.baseline.observedFirstContactTimeS,
     range:cmp.baseline.observedFirstContactDistanceM,
     apex:cmp.baseline.observedApex.heightM
   },drag:{
     time:cmp.dragOnly.observedFirstContactTimeS,
     range:cmp.dragOnly.observedFirstContactDistanceM,
     apex:cmp.dragOnly.observedApex.heightM
   },rangeDelta:cmp.distanceDeltaM,apexDelta:cmp.apexDeltaM
 })+'\n');
});

test('ME-PHYS-07 diagnostic drag remains reproducible and cannot mutate active LAB-04',()=>{
 const active=createEngine(RAPIER,{preset:'roll',vx:4,seed:'universal-field-default'});
 try{
   for(let i=0;i<75;i++)active.step();
   const snapshot=canonicalSnapshot(active.snapshot());
   const first=runPhysicsDiagnostics(RAPIER);
   const repeat=runPhysicsDiagnostics(RAPIER);
   assert.equal(JSON.stringify(first.dragComparison),JSON.stringify(repeat.dragComparison));
   assert.equal(canonicalSnapshot(active.snapshot()),snapshot);
   assert.equal(first.physics.grassRollingDecelerationMps2,0.8);
   assert.equal(first.naturalGrass.selectedDefaultDecelerationMps2,0.8);
   assert.equal(first.flight.aerodynamicDragEnabled,false);
 }finally{active.dispose();}
 assert.throws(()=>measureAirborneFlight([], {dragCoefficient:0.24}),/snapshots required/);
 const samples=[{ball:{position:{x:0,y:0,z:1},velocity:{x:1,y:0,z:1}}},
                {ball:{position:{x:0.1,y:0,z:1.1},velocity:{x:1,y:0,z:0.5}}}];
 assert.throws(()=>measureAirborneFlight(samples,{dragCoefficient:2}),/Invalid experimental flight drag coefficient/);
});

test('ME-PHYS-08 Cd(v) is a continuous bounded proxy with clearly labelled evidence',()=>{
 assert.match(SPEED_DRAG_SOURCE,/kjss.sports.re.kr/);
 assert.deepEqual(SPEED_DRAG_NODES.filter(k=>k.evidence.startsWith('Euro')).map(k=>
   [k.speedMps,k.cd]),[[19,0.21],[32,0.24]]);
 assert.ok(SPEED_DRAG_NODES.filter(k=>k.evidence.includes('hypothesis')).length>=3,
   'low-speed knots are explicit hypotheses, not invented measurements');
 for(const bad of [-1,Infinity,NaN,'15'])
   assert.throws(()=>speedDependentDragCd(bad),/Invalid speed/);
 for(let s=0;s<=100;s+=0.125){
   const cd=speedDependentDragCd(s);
   assert.ok(Number.isFinite(cd)&&cd>=0&&cd<=0.6);
 }
 for(const knot of SPEED_DRAG_NODES){
   assert.ok(Math.abs(speedDependentDragCd(knot.speedMps)-knot.cd)<1e-12);
   if(knot.speedMps>0){
     assert.ok(Math.abs(speedDependentDragCd(knot.speedMps-1e-6)-knot.cd)<1e-5);
     assert.ok(Math.abs(speedDependentDragCd(knot.speedMps+1e-6)-knot.cd)<1e-5);
   }
 }
 assert.equal(speedDependentDragCd(1000),0.24);
 assert.ok(speedDependentDragCd(7)>speedDependentDragCd(12),'proxy must model drag-crisis drop');
});

test('ME-PHYS-08 mode is restricted to disposable launch worlds and preserves default v4',()=>{
 assert.equal(ENGINE_VERSION,'me-01-physics-v4');
 for(const value of [undefined,null,'dynamic','constant',42]){
   if(value===undefined)continue;
   assert.throws(()=>createEngine(RAPIER,{preset:'launch'},
     {diagnosticAirDragModel:value}),/Invalid diagnostic air drag model/);
 }
 assert.throws(()=>createEngine(RAPIER,{preset:'roll'},
   {diagnosticAirDragModel:'speed-dependent'}),/only available for launch/);
 assert.throws(()=>createEngine(RAPIER,{preset:'launch'},
   {diagnosticAirDragModel:'speed-dependent',diagnosticAirDragCd:0.24}),
   /mutually exclusive/);
 const input={preset:'launch',seed:'me08-deterministic',vx:15};
 const active=createEngine(RAPIER,input);
 const explicitZero=createEngine(RAPIER,input,{diagnosticAirDragModel:'none'});
 const variable=createEngine(RAPIER,input,{diagnosticAirDragModel:'speed-dependent'});
 try{
   for(let i=0;i<120;i++){
     const a=active.step(),b=explicitZero.step(),c=variable.step();
     assert.equal(canonicalSnapshot(a),canonicalSnapshot(b));
     for(const n of [...Object.values(c.ball.position),...Object.values(c.ball.velocity)])
       assert.ok(Number.isFinite(n));
   }
   assert.notEqual(canonicalSnapshot(variable.snapshot()),canonicalSnapshot(active.snapshot()));
   const reset=variable.reset(),fresh=createEngine(RAPIER,input,
     {diagnosticAirDragModel:'speed-dependent'});
   try{
     for(let i=0;i<120;i++){reset.step();fresh.step();}
     assert.equal(canonicalSnapshot(reset.snapshot()),canonicalSnapshot(fresh.snapshot()));
   }finally{reset.dispose();fresh.dispose();}
 }finally{active.dispose();explicitZero.dispose();variable.dispose();}
});

test('ME-PHYS-08 independently measures 3-speed Cd(v)/fixed/zero flights without mutation',()=>{
 assert.deepEqual(SPEED_DRAG_LAUNCH_VX_MPS,[7,15,30]);
 assert.deepEqual(SPEED_DRAG_CHECKPOINT_SECONDS,[0,0.5,1,1.5]);
 const active=createEngine(RAPIER,{preset:'roll',seed:'me08-grass-isolation'});
 try{
   for(let i=0;i<42;i++)active.step();
   const before=canonicalSnapshot(active.snapshot());
   const report=runSpeedDependentDragDiagnostics(RAPIER);
   assert.equal(report.normalGameplayCd,0);
   assert.equal(report.oneUniversalPitch,true);
   assert.equal(report.windEnabled,false);
   assert.equal(report.magnusEnabled,false);
   assert.match(report.caveat,/hypotheses/);
   assert.equal(report.trials.length,3);
   for(const trial of report.trials){
     assert.equal(trial.zero.aerodynamicDragEnabled,false);
     assert.equal(trial.fixed.dragCoefficient,0.24);
     assert.equal(trial.variable.dragModel,'speed-dependent');
     assert.equal(trial.variable.aerodynamicDragEnabled,true);
     assert.deepEqual(trial.zero.launch,trial.fixed.launch);
     assert.deepEqual(trial.zero.launch,trial.variable.launch);
     assert.ok(Math.abs(trial.zero.launch.vx-trial.launchVxMps)<1e-5);
     for(const mode of ['zero','fixed','variable']){
       const run=trial[mode];
       assert.equal(run.checkpoints.length,4);
       for(const p of run.checkpoints){
         assert.ok(Number.isFinite(p.clearanceM)&&Number.isFinite(p.distanceM));
       }
       assert.ok(Number.isFinite(run.mechanicalEnergyLostAtOneSecondJ));
       assert.ok(Number.isFinite(run.observedFirstContactTimeS));
       assert.ok(Number.isFinite(run.observedFirstContactDistanceM));
       assert.ok(Number.isFinite(run.observedApex.heightM));
       assert.ok(run.cdAtOneSecond>=0&&run.cdAtOneSecond<=0.6);
       assert.ok(run.observedFirstContactTimeS>1.5&&run.observedFirstContactTimeS<3.5);
     }
     assert.ok(trial.fixed.observedFirstContactDistanceM<
       trial.zero.observedFirstContactDistanceM);
     assert.ok(trial.variable.observedFirstContactDistanceM<
       trial.zero.observedFirstContactDistanceM);
     assert.ok(trial.fixed.mechanicalEnergyLostAtOneSecondJ>
       trial.zero.mechanicalEnergyLostAtOneSecondJ+0.01);
     assert.ok(trial.variable.mechanicalEnergyLostAtOneSecondJ>
       trial.zero.mechanicalEnergyLostAtOneSecondJ+0.01);
   }
   assert.equal(canonicalSnapshot(active.snapshot()),before);
   assert.equal(JSON.stringify(report),JSON.stringify(runSpeedDependentDragDiagnostics(RAPIER)),
     'fixed seed and model must reproduce exactly');
   const full=runPhysicsDiagnostics(RAPIER);
   assert.deepEqual(full.speedDragComparison,report);
   assert.equal(full.physics.grassRollingDecelerationMps2,GRASS_ROLL_DECELERATION);
   assert.deepEqual(full.dragComparison.baseline,full.flight);
   assert.equal(canonicalSnapshot(active.snapshot()),before);
   process.stdout.write('ME08_SPEED_DRAG '+JSON.stringify(report.trials.map(t=>({
     vx:t.launchVxMps,
     rangeM:[t.zero,t.fixed,t.variable].map(r=>r.observedFirstContactDistanceM),
     energyLossAt1sJ:[t.zero,t.fixed,t.variable].map(r=>r.mechanicalEnergyLostAtOneSecondJ),
     cdAt1s:t.variable.cdAtOneSecond
   })))+'\\n');
 }finally{active.dispose();}
 assert.throws(()=>measureAirborneFlight(
  [{ball:{}},{ball:{}}],{dragModel:'speed-dependent',dragCoefficient:0.24}),
  /Invalid experimental flight drag model/);
});

test('ME-PHYS-09 Magnus force is perpendicular to velocity and spin with correct sign',()=>{
 assert.equal(ENGINE_VERSION,'me-01-physics-v4');
 assert.equal(MAGNUS_SPIN_RPS,6);
 assert.ok(Math.abs(MAGNUS_SPIN_RAD_S/(2*Math.PI)-6)<1e-12);
 assert.equal(MAGNUS_SPIN_LIMIT_RAD_S,80);
 assert.equal(MAGNUS_CL_SLOPE,0.6);
 assert.equal(MAGNUS_CL_CAP,0.25);
 const v={x:11,y:0,z:10},omega={x:0,y:0,z:MAGNUS_SPIN_RAD_S};
 const side=magnusLift(v,omega),reverse=magnusLift(v,{x:0,y:0,z:-MAGNUS_SPIN_RAD_S});
 assert.ok(side.force.y>0&&reverse.force.y<0,'positive +Z spin curves to +Y');
 assert.ok(Math.abs(side.force.y+reverse.force.y)<1e-10);
 assert.ok(Math.abs(side.force.x+reverse.force.x)<1e-10);
 assert.ok(side.spinParameter>0&&side.liftCoefficient>0&&side.liftCoefficient<=MAGNUS_CL_CAP);
 const top=magnusLift(v,{x:0,y:MAGNUS_SPIN_RAD_S,z:0});
 const back=magnusLift(v,{x:0,y:-MAGNUS_SPIN_RAD_S,z:0});
 assert.ok(top.force.z<0&&back.force.z>0,'topspin dives, backspin lofts');
 for(const force of [side,reverse,top,back]){
   assert.ok(Number.isFinite(force.magnitudeN)&&force.magnitudeN>0);
   const dot=force.force.x*v.x+force.force.y*v.y+force.force.z*v.z;
   assert.ok(Math.abs(dot)<1e-9,'lift must be perpendicular; no direct work on v');
 }
 assert.equal(magnusLift(v,{x:0,y:0,z:0}).magnitudeN,0);
 assert.equal(magnusLift({x:0,y:0,z:0},omega).magnitudeN,0);
 assert.equal(magnusLift({x:10,y:0,z:0},{x:5,y:0,z:0}).magnitudeN,0);
 assert.throws(()=>magnusLift(v,{x:NaN,y:0,z:0}),/Invalid Magnus velocity vector/);
});

test('ME-PHYS-09 launch-only spin validation and reset keep default replay unchanged',()=>{
 const valid={x:0,y:0,z:MAGNUS_SPIN_RAD_S};
 const invalid=[{},[],null,{x:0,y:0},{x:0,y:0,z:Infinity},
   {x:0,y:0,z:NaN},{x:0,y:0,z:'6'},
   {x:MAGNUS_SPIN_LIMIT_RAD_S+0.001,y:0,z:0},{x:0,y:0,z:3,extra:1}];
 for(const value of invalid){
   if(value===null)continue; // null explicitly means feature disabled
   assert.throws(()=>createEngine(RAPIER,{preset:'launch'},
     {diagnosticMagnusSpinRadS:value}),/Invalid diagnostic Magnus spin vector/);
 }
 assert.throws(()=>createEngine(RAPIER,{preset:'roll'},
   {diagnosticMagnusSpinRadS:valid}),/only available for launch/);
 assert.throws(()=>createEngine(RAPIER,{preset:'bounce'},
   {diagnosticMagnusSpinRadS:valid}),/only available for launch/);
 // ME-PHYS-10: combination is now permitted ONLY as a disposable launch
 // diagnostic. It must not change the legacy fixed-Cd Magnus experiment.
 const joined=createEngine(RAPIER,{preset:'launch'},
   {diagnosticMagnusSpinRadS:valid,diagnosticAirDragModel:'speed-dependent'});
 try{assert.ok(Number.isFinite(joined.step().ball.position.z));}
 finally{joined.dispose();}
 assert.throws(()=>createEngine(RAPIER,{preset:'launch'},
   {diagnosticMagnusLiftEnabled:false}),/requires a diagnostic spin vector/);
 assert.throws(()=>createEngine(RAPIER,{preset:'launch'},
   {diagnosticMagnusSpinRadS:valid,diagnosticMagnusLiftEnabled:'no'}),
   /Invalid diagnostic Magnus lift switch/);
 const input={preset:'launch',seed:'me09-lift-replay',vx:11,vy:0,vz:10};
 const a=createEngine(RAPIER,input);
 const b=createEngine(RAPIER,input,{diagnosticMagnusSpinRadS:null});
 const c=createEngine(RAPIER,input,{diagnosticMagnusSpinRadS:valid,diagnosticAirDragCd:DRAG_EXPERIMENT_CD});
 try{
   assert.ok(Math.abs(c.angularVelocity().z-valid.z)<1e-4);
   for(let i=0;i<150;i++){
     const sa=a.step(),sb=b.step(),sc=c.step();
     assert.equal(canonicalSnapshot(sa),canonicalSnapshot(sb),
       'null Magnus option must be exact-default parity');
     assert.ok(Object.values(sc.ball.velocity).every(Number.isFinite));
   }
   assert.notEqual(canonicalSnapshot(a.snapshot()),canonicalSnapshot(c.snapshot()));
   const reset=c.reset(),fresh=createEngine(RAPIER,input,{
     diagnosticMagnusSpinRadS:valid,diagnosticAirDragCd:DRAG_EXPERIMENT_CD
   });
   try{
     for(let i=0;i<150;i++){reset.step();fresh.step();}
     assert.equal(canonicalSnapshot(reset.snapshot()),canonicalSnapshot(fresh.snapshot()));
     assert.deepEqual(reset.angularVelocity(),fresh.angularVelocity());
   }finally{reset.dispose();fresh.dispose();}
 }finally{a.dispose();b.dispose();c.dispose();}
});

test('ME-PHYS-09 five independent spin worlds give signed bend and height ordering',()=>{
 assert.deepEqual(MAGNUS_SPIN_CASES.map(x=>x.key),
   ['none','side-positive','side-negative','topspin','backspin']);
 assert.deepEqual(MAGNUS_CHECKPOINT_SECONDS,[0,0.5,1,1.5,2]);
 const active=createEngine(RAPIER,{preset:'roll',seed:'me09-active-safe'});
 try{
   for(let i=0;i<80;i++)active.step();
   const before=canonicalSnapshot(active.snapshot());
   const report=runMagnusDiagnostics(RAPIER);
   assert.equal(report.runs.length,5);
   assert.equal(report.defaultCd,0);
   assert.equal(report.dragCd,0.24);
   assert.equal(report.universalPitchDecelerationMps2,0.8);
   assert.equal(report.windEnabled,false);
   assert.equal(report.gameplayMagnusEnabled,false);
   assert.match(report.coefficientMeaning,/uncalibrated/);
   const byKey=k=>report.runs.find(r=>r.key===k);
   const zero=byKey('none'),plus=byKey('side-positive'),
     minus=byKey('side-negative'),top=byKey('topspin'),back=byKey('backspin');
   assert.equal(zero.initialSpinRps,0);
   for(const spun of [plus,minus,top,back])
     assert.ok(Math.abs(spun.initialSpinRps-6)<1e-4);
   assert.ok(plus.lateralAtOneM>0.1 && minus.lateralAtOneM< -0.1,
     'equal side spin must bend to opposite Y sides');
   assert.ok(Math.abs(report.measuredSignSymmetryAtOneM)<0.1,
     'mirror trajectories must cancel: '+report.measuredSignSymmetryAtOneM);
   assert.ok(top.heightAtOneM<zero.heightAtOneM-0.1,
     'topspin must make ball dive');
   assert.ok(back.heightAtOneM>zero.heightAtOneM+0.1,
     'backspin must create extra loft');
   assert.ok(top.flight.observedApex.heightM<zero.flight.observedApex.heightM);
   assert.ok(back.flight.observedApex.heightM>zero.flight.observedApex.heightM);
   for(const run of report.runs){
     assert.equal(run.flight.dragCoefficient,DRAG_EXPERIMENT_CD);
     assert.equal(run.flight.aerodynamicDragEnabled,true);
     assert.equal(run.flight.magnusEnabled,run.key!=='none');
     assert.deepEqual(run.flight.launch,zero.flight.launch);
     assert.ok(run.flight.observedFirstContactTimeS!==null);
     assert.ok(run.flight.observedFirstContactDistanceM!==null);
     assert.ok(Number.isFinite(run.translationPotentialEnergyDeltaAtOneJ));
     assert.ok(run.liftClAtOne>=0&&run.liftClAtOne<=MAGNUS_CL_CAP);
     assert.ok(run.checkpoints.length===MAGNUS_CHECKPOINT_SECONDS.length);
     assert.ok(run.trail.length>10);
     for(const p of run.checkpoints){
       if(p.observed){
         assert.ok(p.timeS<run.flight.observedFirstContactTimeS);
         assert.ok(Number.isFinite(p.lateralM)&&Number.isFinite(p.heightM));
       }else{
         assert.ok(p.timeS>=run.flight.observedFirstContactTimeS);
       }
     }
   }
   assert.equal(canonicalSnapshot(active.snapshot()),before);
   assert.equal(JSON.stringify(report),JSON.stringify(runMagnusDiagnostics(RAPIER)));
   const full=runPhysicsDiagnostics(RAPIER);
   assert.deepEqual(full.magnusComparison,report);
   assert.deepEqual(full.dragComparison.baseline,full.flight);
   assert.equal(full.physics.grassRollingDecelerationMps2,0.8);
   assert.equal(canonicalSnapshot(active.snapshot()),before);
   process.stdout.write('ME09_MAGNUS_AB '+JSON.stringify(report.runs.map(r=>({
     key:r.key,spinRps:r.initialSpinRps,clAt1:r.liftClAtOne,
     yAt1:r.lateralAtOneM,apex:r.flight.observedApex.heightM,
     distance:r.flight.observedFirstContactDistanceM,contact:r.flight.observedFirstContactTimeS
   })))+'\n');
 }finally{active.dispose();}
});

test('ME-PHYS-10 matched initial spin, combined Cd(v) + Magnus and mode controls',()=>{
 assert.equal(ENGINE_VERSION,'me-01-physics-v4');
 assert.deepEqual(COMBINED_FLIGHT_LAUNCH_VX_MPS,[7,15,30]);
 assert.deepEqual(COMBINED_FLIGHT_SPIN_CASES.map(s=>s.key),['none','positive','negative']);
 assert.deepEqual(COMBINED_FLIGHT_FORCE_MODES.map(m=>m.key),
   ['baseline','drag','magnus','combined']);
 assert.deepEqual(COMBINED_FLIGHT_CHECKPOINT_SECONDS,[0,0.5,1,1.5,2]);
 for(const mode of COMBINED_FLIGHT_FORCE_MODES)
   assert.equal(typeof mode.drag,'boolean');
 const scenario={preset:'launch',seed:'me-phys10-default-parity',vx:15,vy:0,vz:10};
 const baseline=createEngine(RAPIER,scenario);
 const spin={x:0,y:0,z:MAGNUS_SPIN_RAD_S};
 const spinOnly=createEngine(RAPIER,scenario,{
   diagnosticMagnusSpinRadS:spin,diagnosticMagnusLiftEnabled:false
 });
 const variable=createEngine(RAPIER,scenario,{diagnosticAirDragModel:'speed-dependent'});
 const combo=createEngine(RAPIER,scenario,{
   diagnosticAirDragModel:'speed-dependent',diagnosticMagnusSpinRadS:spin
 });
 const comboMinus=createEngine(RAPIER,scenario,{
   diagnosticAirDragModel:'speed-dependent',
   diagnosticMagnusSpinRadS:{x:0,y:0,z:-MAGNUS_SPIN_RAD_S}
 });
 try{
   assert.ok(Math.abs(spinOnly.angularVelocity().z-MAGNUS_SPIN_RAD_S)<1e-4);
   assert.ok(Math.abs(combo.angularVelocity().z-MAGNUS_SPIN_RAD_S)<1e-4);
   for(let tick=0;tick<90;tick++){
     const b=baseline.step(),s=spinOnly.step(),v=variable.step();
     const c=combo.step(),m=comboMinus.step();
     assert.equal(canonicalSnapshot(b),canonicalSnapshot(s),
       'real initial spin with lift OFF cannot alter pre-contact default flight');
     assert.ok(Math.abs(c.ball.position.y+m.ball.position.y-2*baseline.scenario.y)<0.002,
       'sign symmetry around original launch Y, not world Y=0');
     assert.ok(Object.values(c.ball.velocity).every(Number.isFinite));
     if(tick>15)assert.notEqual(canonicalSnapshot(c),canonicalSnapshot(v),
       'combined flight must differ from Cd(v) without lift');
   }
   const reset=combo.reset(),fresh=createEngine(RAPIER,scenario,{
     diagnosticAirDragModel:'speed-dependent',diagnosticMagnusSpinRadS:spin
   });
   try{
     for(let tick=0;tick<100;tick++){
       reset.step();fresh.step();
     }
     assert.equal(canonicalSnapshot(reset.snapshot()),canonicalSnapshot(fresh.snapshot()));
     assert.deepEqual(reset.angularVelocity(),fresh.angularVelocity());
   }finally{reset.dispose();fresh.dispose();}
 }finally{baseline.dispose();spinOnly.dispose();variable.dispose();
   combo.dispose();comboMinus.dispose();}
});

test('ME-PHYS-10 isolated 36-run matrix measures ground contact, symmetry and work bounds',()=>{
 const active=createEngine(RAPIER,{preset:'roll',seed:'me10-world-isolation'});
 try{
   for(let i=0;i<52;i++)active.step();
   const before=canonicalSnapshot(active.snapshot());
   const matrix=runCombinedFlightDiagnostics(RAPIER);
   assert.equal(matrix.caseCount,9);
   assert.equal(matrix.totalRuns,36);
   assert.equal(matrix.trials.length,9);
   assert.equal(matrix.defaultCd,0);
   assert.equal(matrix.defaultMagnus,false);
   assert.equal(matrix.fieldCount,1);
   assert.equal(matrix.universalGrassDecelerationMps2,0.8);
   assert.equal(matrix.wind,false);
   assert.equal(matrix.negativeMagnus,false);
   assert.match(matrix.notes,/hypotheses/);
   for(const trial of matrix.trials){
     const modes=['baseline','drag','magnus','combined'].map(k=>trial[k]);
     assert.ok(modes.every(m=>m.initialLaunch&&m.checkpoints.length===5));
     for(const mode of modes){
       assert.deepEqual(mode.initialLaunch,trial.baseline.initialLaunch);
       assert.ok(Math.abs(mode.initialActualSpinRps-trial.spinRps)<1e-4,
         'all modes preserve physically identical initial spin');
       assert.ok(Number.isFinite(mode.firstContactTimeS)&&
         mode.firstContactTimeS>1.5&&mode.firstContactTimeS<3.5);
       assert.ok(Number.isFinite(mode.firstFlightDistanceM)&&
         mode.firstFlightDistanceM>0);
       assert.ok(Number.isFinite(mode.apexHeightM)&&mode.apexHeightM>0);
       assert.ok(Number.isFinite(mode.lateralAtOneM));
       assert.ok(Number.isFinite(mode.mechanicalEnergyDeltaAtOneJ));
       assert.ok(Number.isFinite(mode.actualSpinAtOneRps));
       assert.ok(Number.isFinite(mode.cdAtOne)&&mode.cdAtOne>=0&&mode.cdAtOne<=0.6);
       assert.ok(Number.isFinite(mode.clAtOne)&&mode.clAtOne>=0&&mode.clAtOne<=0.25);
       assert.ok(Math.abs(mode.liftPowerAtOneW)<1e-9,
         'perpendicular lift cannot directly do work on instantaneous velocity');
       assert.ok(mode.trail.length>10);
       for(const cp of mode.checkpoints){
         assert.ok(Number.isFinite(cp.timeS));
         if(cp.observed){
           assert.ok(cp.timeS<mode.firstContactTimeS);
           assert.ok(Number.isFinite(cp.heightM)&&Number.isFinite(cp.lateralM));
         }else{
           assert.ok(cp.timeS>=mode.firstContactTimeS);
         }
       }
     }
     assert.equal(trial.baseline.dragApplied,false);
     assert.equal(trial.drag.dragApplied,true);
     assert.equal(trial.magnus.dragApplied,false);
     assert.equal(trial.combined.dragApplied,true);
     assert.equal(trial.baseline.magnusApplied,false);
     assert.equal(trial.drag.magnusApplied,false);
     assert.equal(trial.magnus.magnusApplied,trial.spinKey!=='none');
     assert.equal(trial.combined.magnusApplied,trial.spinKey!=='none');
     assert.ok(trial.drag.cdAtOne>0&&trial.combined.cdAtOne>0);
     assert.equal(trial.baseline.cdAtOne,0);
     assert.equal(trial.magnus.cdAtOne,0);
     assert.ok(trial.drag.mechanicalEnergyDeltaAtOneJ<
       trial.baseline.mechanicalEnergyDeltaAtOneJ-0.01);
     assert.ok(trial.combined.mechanicalEnergyDeltaAtOneJ<
       trial.magnus.mechanicalEnergyDeltaAtOneJ-0.01);
     if(trial.spinKey==='none'){
       assert.equal(trial.magnus.lateralAtOneM,trial.baseline.lateralAtOneM);
       assert.equal(trial.magnus.heightAtOneM,trial.baseline.heightAtOneM);
       assert.equal(trial.combined.lateralAtOneM,trial.drag.lateralAtOneM);
       assert.equal(trial.combined.heightAtOneM,trial.drag.heightAtOneM);
     }else{
       assert.ok(trial.magnus.clAtOne>0&&trial.combined.clAtOne>0);
       assert.equal(trial.drag.clAtOne,0);
       assert.ok(Math.abs(trial.magnus.mechanicalEnergyDeltaAtOneJ-
         trial.baseline.mechanicalEnergyDeltaAtOneJ)<0.5,
         'perpendicular lift may incur solver error but cannot inject large energy');
     }
   }
   for(const vx of COMBINED_FLIGHT_LAUNCH_VX_MPS){
     const at=key=>matrix.trials.find(t=>t.vxMps===vx&&t.spinKey===key);
     const zero=at('none'),plus=at('positive'),minus=at('negative');
     for(const mode of ['baseline','drag','magnus','combined']){
       assert.ok(Math.abs(plus[mode].lateralAtOneM+minus[mode].lateralAtOneM-
         2*zero[mode].lateralAtOneM)<0.1,
         'opposing spin must exhibit mirrored Y at '+vx+'m/s / '+mode);
     }
     assert.ok(plus.magnus.lateralAtOneM>0.01&&minus.magnus.lateralAtOneM< -0.01);
     assert.ok(plus.combined.lateralAtOneM>0.01&&minus.combined.lateralAtOneM< -0.01);
     assert.ok(Math.abs(plus.drag.lateralAtOneM)<0.01);
     assert.ok(Math.abs(plus.baseline.lateralAtOneM)<0.01);
   }
   const second=runCombinedFlightDiagnostics(RAPIER);
   assert.equal(JSON.stringify(matrix),JSON.stringify(second),
     '36-run aggregate must reproduce bit-identical numerical evidence');
   const full=runPhysicsDiagnostics(RAPIER);
   assert.deepEqual(full.combinedFlightComparison,matrix);
   assert.equal(full.version,'me-01-physics-v4');
   assert.equal(full.physics.grassRollingDecelerationMps2,0.8);
   assert.equal(canonicalSnapshot(active.snapshot()),before);
   process.stdout.write('ME10_COMBINED_AB '+JSON.stringify(
     matrix.trials.filter(t=>t.spinKey==='positive').map(t=>({
       vx:t.vxMps,yAtOne:[t.baseline,t.drag,t.magnus,t.combined].map(m=>m.lateralAtOneM),
       range:[t.baseline,t.drag,t.magnus,t.combined].map(m=>m.firstFlightDistanceM),
       energyAtOne:[t.baseline,t.drag,t.magnus,t.combined]
         .map(m=>m.mechanicalEnergyDeltaAtOneJ)
     })))+'\n');
 }finally{active.dispose();}
});

test('ME-PHYS-11 published drag and spin anchors stay separate and explicitly non-calibrated',()=>{
 assert.match(CD_PUBLICATION,/kjss.sports.re.kr/);
 assert.match(CS_PUBLICATION,/mdpi.com/);
 assert.deepEqual(CD_EURO2024_ANCHORS.map(p=>[p.airspeedMps,p.measuredCd]),
   [[19,0.21],[32,0.24]]);
 assert.deepEqual(CS_CURVE_KICK_AVERAGES.map(p=>[p.meanSpinParameter,p.measuredMeanCs]),
   [[0.18,0.21],[0.22,0.24],[0.34,0.29]]);
 for(const bad of [-1,NaN,Infinity,null,'0.22',{}])
   assert.throws(()=>currentMagnusProxyAtSp(bad),/Invalid nonnegative spin parameter/);
 assert.equal(currentMagnusProxyAtSp(0),0);
 assert.equal(currentMagnusProxyAtSp(10),0.25);
 const report=readAerodynamicCalibrationEvidence();
 assert.equal(report.stage,'RESEARCH AUDIT — NOT CALIBRATED');
 assert.equal(report.dragAnchors.length,2);
 assert.equal(report.sideAnchors.length,3);
 for(const anchor of report.dragAnchors){
   assert.equal(anchor.prototypeCd,speedDependentDragCd(anchor.airspeedMps));
   assert.ok(Math.abs(anchor.signedDifference)<1e-12);
 }
 const predicted=[0.108,0.132,0.204];
 const residual=[-0.102,-0.108,-0.086];
 report.sideAnchors.forEach((anchor,i)=>{
   assert.ok(Math.abs(anchor.currentProxyCl-predicted[i])<1e-12);
   assert.ok(Math.abs(anchor.signedDifference-residual[i])<1e-12);
   assert.ok(anchor.currentProxyCl<anchor.measuredMeanCs);
 });
 assert.ok(Math.abs(report.meanAbsSideDifference-(0.102+0.108+0.086)/3)<1e-12);
 assert.match(report.keyFinding,/different types of quantities/);
 assert.match(report.referenceBall,/not a matched/);
 assert.ok(report.blockers.length>=4);
 assert.match(report.suggestedGate,/one ball/);
 assert.equal(report.unchanged.gameplayAerodynamics,false);
 assert.equal(report.unchanged.defaultCd,0);
 assert.equal(report.unchanged.defaultMagnus,false);
 assert.equal(report.unchanged.oneUniversalGrassDecelerationMps2,0.8);
 assert.ok(Object.isFrozen(report));
 assert.ok(Object.isFrozen(report.dragAnchors)&&Object.isFrozen(report.sideAnchors));
 assert.equal(JSON.stringify(report),JSON.stringify(readAerodynamicCalibrationEvidence()));
});

test('ME-PHYS-11 evidence integration is read-only and leaves v4 active world untouched',()=>{
 const active=createEngine(RAPIER,{preset:'launch',seed:'me11-active-world'});
 try{
   for(let i=0;i<60;i++)active.step();
   const before=canonicalSnapshot(active.snapshot());
   const full=runPhysicsDiagnostics(RAPIER);
   assert.deepEqual(full.calibrationEvidence,readAerodynamicCalibrationEvidence());
   assert.equal(full.version,'me-01-physics-v4');
   assert.equal(full.physics.grassRollingDecelerationMps2,0.8);
   assert.equal(canonicalSnapshot(active.snapshot()),before);
   const second=runPhysicsDiagnostics(RAPIER);
   assert.deepEqual(second.calibrationEvidence,full.calibrationEvidence);
   assert.equal(canonicalSnapshot(active.snapshot()),before);
   process.stdout.write('ME11_EVIDENCE_AUDIT '+JSON.stringify({
     drag:full.calibrationEvidence.dragAnchors.map(p=>p.signedDifference),
     spin:full.calibrationEvidence.sideAnchors.map(p=>p.signedDifference),
     meanAbsSideDifference:full.calibrationEvidence.meanAbsSideDifference,
     stage:full.calibrationEvidence.stage
   })+'\n');
 }finally{active.dispose();}
});

test('ME-PHYS-12 one universal ball readiness uses only published same-specimen orientation figures',()=>{
 const report=assessUniversalBallReadiness();
 assert.equal(report.stage,'CALIBRATION HOLD — EVIDENCE INCOMPLETE');
 assert.deepEqual(report.ball,SINGLE_BALL_SPEC);
 assert.equal(report.ball.massKg,0.43);
 assert.equal(report.ball.radiusM,0.11);
 assert.equal(report.ball.physicsVersion,'me-01-physics-v4');
 assert.equal(report.ball.standardGrassDecelerationMps2,0.8);
 assert.equal(report.ball.environmentProfiles,1);
 assert.equal(report.approvedForGameplay,false);
 assert.equal(report.scientificallyCalibrated,false);
 assert.equal(report.sourceStudies.length,3);
 assert.deepEqual(report.sourceStudies,SINGLE_BALL_SOURCES);
 assert.equal(report.specimenCoverage.physicallyMatched,false,
   'Euro 2024/Trionda wind-tunnel results are NOT the curve-kick specimen');
 assert.deepEqual(report.specimenCoverage.windSpecimens,
   ['euro2024-reference','trionda-one-specimen']);
 assert.deepEqual(report.specimenCoverage.spinSpecimens,['curvekick-other']);
 assert.deepEqual(report.summary,{available:1,partial:1,missing:5});
 assert.deepEqual(report.gates,UNIVERSAL_CALIBRATION_GATES);
 assert.deepEqual(report.orientationEvidence,TRIONDA_ORIENTATION_COMPARISON);
 const [a,b]=report.orientationEvidence.orientations;
 assert.deepEqual([a.key,a.rangeM,a.subcriticalMeanCd,a.supercriticalMeanCd,
  a.fullRangeMeanCd],['A-90',48.65,0.348,0.241,0.266]);
 assert.deepEqual([b.key,b.rangeM,b.subcriticalMeanCd,b.supercriticalMeanCd,
  b.fullRangeMeanCd],['B-90',51.68,0.330,0.201,0.231]);
 assert.ok(Math.abs(report.orientationSpanM-3.03)<1e-12);
 assert.ok(Math.abs(report.orientationSpanPercentOfMean-
   100*3.03/((48.65+51.68)/2))<1e-10);
 assert.equal(report.orientationEvidence.measuredTrajectories,false,
   'published modeled ranges are NOT ground-truth landings');
 assert.match(report.researchObservation,/NOT real measured ranges/);
 assert.match(report.note,/not.*claim|NOT a claim/);
 assert.match(report.nextEvidenceRequest,/independent high-speed-camera 3D/);
 assert.ok(Object.isFrozen(report)&&Object.isFrozen(report.gates));
 assert.ok(Object.isFrozen(report.orientationEvidence.orientations));
 assert.deepEqual(assessUniversalBallReadiness(),report);
});

test('ME-PHYS-12 prevents cross-ball label spoofing from approving global physics',()=>{
 for(const invalid of [null,{},[],[{specimen:'only',kind:'wind-tunnel'}],
   [{specimen:'',kind:'wind-tunnel'},{specimen:'a',kind:'free-flight'}],
   [{specimen:'a'},{specimen:'a',kind:'free-flight'}]])
   assert.throws(()=>assessUniversalBallReadiness(invalid),/Invalid calibration evidence sources/);
 const superficiallyMatched=SINGLE_BALL_SOURCES.map(s=>({
   ...s,specimen:'unverified-common-label'
 }));
 const report=assessUniversalBallReadiness(superficiallyMatched);
 assert.equal(report.specimenCoverage.physicallyMatched,true);
 assert.equal(report.approvedForGameplay,false,
   'changing specimen labels must not approve calibration');
 assert.equal(report.scientificallyCalibrated,false);
 assert.ok(report.gates.some(g=>g.key==='single-specimen'&&g.state==='missing'),
   'matching free-form specimen labels are not scientific provenance');
 assert.ok(report.summary.missing>=5);
 assert.equal(report.ball.gameplayDragEnabled,false);
 assert.equal(report.ball.gameplayMagnusEnabled,false);
});

test('ME-PHYS-12 readiness gate does not alter Rapier state or existing diagnostics',()=>{
 const active=createEngine(RAPIER,{preset:'launch',seed:'me12-isolated'});
 try{
   for(let i=0;i<95;i++)active.step();
   const before=canonicalSnapshot(active.snapshot());
   const full=runPhysicsDiagnostics(RAPIER);
   assert.deepEqual(full.universalBallReadiness,assessUniversalBallReadiness());
   assert.deepEqual(full.calibrationEvidence,readAerodynamicCalibrationEvidence());
   assert.equal(full.version,'me-01-physics-v4');
   assert.equal(full.physics.grassRollingDecelerationMps2,0.8);
   assert.equal(full.dragComparison.baseline.aerodynamicDragEnabled,false);
   assert.equal(canonicalSnapshot(active.snapshot()),before);
   assert.deepEqual(runPhysicsDiagnostics(RAPIER).universalBallReadiness,
     full.universalBallReadiness);
   assert.equal(canonicalSnapshot(active.snapshot()),before);
   process.stdout.write('ME12_UNIVERSAL_READINESS '+JSON.stringify({
     gates:full.universalBallReadiness.summary,
     rangesM:full.universalBallReadiness.orientationEvidence.orientations.map(o=>o.rangeM),
     rangeSpanM:full.universalBallReadiness.orientationSpanM,
     approved:full.universalBallReadiness.approvedForGameplay
   })+'\n');
 }finally{active.dispose();}
});

test('ME-PHYS-13 source inventory respects original ball identity and dataset license',()=>{
 const report=describeCalibrationIntake();
 assert.equal(report.stage,'ME-PHYS-13 — NO VERIFIED MATCHED DATASET');
 assert.equal(report.sourceCount,4);
 assert.equal(report.verifiedMatchedBundles,0);
 assert.equal(report.eligibleForGameplay,false);
 assert.equal(report.sources,CALIBRATION_DATASET_CANDIDATES);
 assert.ok(Object.isFrozen(report)&&Object.isFrozen(report.sources));
 assert.deepEqual(CALIBRATION_DATASET_CANDIDATES.map(s=>s.id),
   ['trionda-2026','ball3d-2026','ward2023-geometry','curve-kick-2020']);
 assert.match(report.sources[0].access,/no authenticated downloadable raw/i);
 assert.equal(report.sources[1].holdoutRole,'candidate-only');
 assert.match(report.sources[1].access,/not imported/);
 assert.match(report.sources[1].use,/non-commercial/);
 assert.match(report.rightsBlocker,/CC BY-NC-SA-4.0/);
 assert.equal(report.sources[2].calibrationRole,'partial');
 assert.equal(report.sources[2].holdoutRole,'none');
 assert.match(report.sources[2].source,/s12283-023-00409-5/);
 assert.match(report.sources[2].evidence,/100–400 rpm/);
 assert.match(report.sources[2].access,/no verified downloadable raw/);
 assert.match(report.sources[2].use,/CC BY 4.0/);
 assert.match(report.sources[2].specimen,/not selected universal match ball/);
 assert.equal(report.verifiedMatchedBundles,0);
 assert.deepEqual(CALIBRATION_INTAKE_FIELDS.identity,
   ['datasetId','specimenId','sourceUrl','sourceGroup','measurementKind','usageRights']);
 assert.deepEqual(describeCalibrationIntake(),report);
});
test('ME-PHYS-13 rejects corrupted timestamps, duplicate rows, units and invalid coefficients',()=>{
 const basis={datasetId:'synthetic-test',specimenId:'FAKE-TEST-NOT-A-MEASUREMENT',
   sourceUrl:'https://example.invalid/testing',sourceGroup:'synthetic-test',
   usageRights:'SYNTHETIC FIXTURE ONLY'};
 const drag={...basis,measurementKind:'drag',rows:[{
   sampleId:'d0',speedMps:19,spinRadS:0,coefficient:0.23,
   uncertainty:0.02,spinAxis:'z'
 }]};
 assert.equal(inspectCalibrationDataset(drag).formatValid,true);
 const invalid=[
   {...drag,sourceUrl:'http://example.invalid/unsafe'},
   {...drag,rows:[{...drag.rows[0],coefficient:NaN}]},
   {...drag,rows:[{...drag.rows[0],coefficient:-0.01}]},
   {...drag,rows:[{...drag.rows[0],speedMps:-1}]},
   {...drag,rows:[{...drag.rows[0],uncertainty:0}]},
   {...drag,rows:[{...drag.rows[0],spinAxis:'north'}]},
   {...drag,rows:[drag.rows[0],{...drag.rows[0]}]},
   {...drag,rows:[]}
 ];
 for(const sample of invalid)
   assert.equal(inspectCalibrationDataset(sample).formatValid,false);
 const flight={...basis,sourceGroup:'independent-synthetic-test',
   measurementKind:'trajectory',rows:[
     {sampleId:'f0',trackId:'t0',timeS:0,xM:0,yM:0,zM:1},
     {sampleId:'f1',trackId:'t0',timeS:0.02,xM:0.1,yM:0,zM:1.1}
   ]};
 assert.equal(inspectCalibrationDataset(flight).formatValid,true);
 assert.equal(inspectCalibrationDataset({...flight,rows:[
   flight.rows[0],{...flight.rows[1],timeS:0}]}).formatValid,false);
 assert.equal(inspectCalibrationDataset({...flight,rows:[
   flight.rows[0]]}).formatValid,false);
 assert.equal(inspectCalibrationDataset({...flight,rows:[
   flight.rows[0],{...flight.rows[1],zM:Infinity}]}).formatValid,false);
 assert.equal(inspectCalibrationDataset(null).formatValid,false);
});
test('ME-PHYS-13 structurally matching synthetic sources NEVER approve gameplay physics',()=>{
 const basis={specimenId:'FAKE-SYNTHETIC-SPECIMEN',
   sourceUrl:'https://example.invalid/test-only',usageRights:'SYNTHETIC TEST RIGHTS'};
 const d={...basis,datasetId:'d',sourceGroup:'synthetic-lab',
   measurementKind:'drag',rows:[{
     sampleId:'d0',speedMps:19,spinRadS:0,
     coefficient:0.23,uncertainty:0.02,spinAxis:'z'
   }]};
 const spin={...basis,datasetId:'s',sourceGroup:'synthetic-lab',
   measurementKind:'spin',rows:[{
     sampleId:'s0',speedMps:19,spinRadS:30,
     coefficient:0.19,uncertainty:0.04,spinAxis:'z'
   }]};
 const holdout={...basis,datasetId:'h',sourceGroup:'synthetic-independent',
   measurementKind:'trajectory',rows:[
     {sampleId:'f0',trackId:'t0',timeS:0,xM:0,yM:0,zM:1},
     {sampleId:'f1',trackId:'t0',timeS:0.02,xM:0.2,yM:0,zM:1.1}
   ]};
 const valid=inspectCalibrationBundle({drag:d,spin,holdout});
 assert.equal(valid.structuralCandidate,true);
 assert.equal(valid.scientificVerificationComplete,false);
 assert.equal(valid.approvedForGameplay,false);
 assert.equal(valid.licensePermissionVerified,false);
 assert.match(valid.stage,/EXTERNAL REVIEW REQUIRED/);
 assert.deepEqual(valid.issues,[]);
 const wrong=inspectCalibrationBundle({drag:d,spin,
   holdout:{...holdout,specimenId:'totally-other-ball'}});
 assert.equal(wrong.structuralCandidate,false);
 assert.ok(wrong.issues.some(i=>i.code==='SPECIMEN'));
 const leaked=inspectCalibrationBundle({drag:d,spin,
   holdout:{...holdout,sourceGroup:'synthetic-lab'}});
 assert.equal(leaked.structuralCandidate,false);
 assert.ok(leaked.issues.some(i=>i.code==='LEAKAGE'));
 const rogue=inspectCalibrationBundle({drag:d,spin:{...spin,rows:[
   {...spin.rows[0],coefficient:Infinity}]},holdout});
 assert.equal(rogue.structuralCandidate,false);
 assert.equal(rogue.approvedForGameplay,false);
});
test('ME-PHYS-13 read-only intake does not touch active v4 ball or diagnostics',()=>{
 const active=createEngine(RAPIER,{preset:'launch',seed:'me13-read-only'});
 try{
   for(let i=0;i<64;i++)active.step();
   const before=canonicalSnapshot(active.snapshot());
   const full=runPhysicsDiagnostics(RAPIER);
   assert.deepEqual(full.calibrationDataIntake,describeCalibrationIntake());
   assert.equal(full.version,'me-01-physics-v4');
   assert.equal(full.physics.grassRollingDecelerationMps2,0.8);
   assert.equal(full.calibrationDataIntake.eligibleForGameplay,false);
   assert.equal(canonicalSnapshot(active.snapshot()),before);
 }finally{active.dispose();}
});

test('ME-PHYS-14 converts synthetic 3D ball positions from dm and frame/fps to metres/seconds',()=>{
 const csv='file_name,track_id,x,y,z,x_velocity\n'+
   '0,4,10,0,12,30\n1,4,15,-5,14,30\n2,4,20,-8,16,30\n';
 const converted=adaptBall3dGroundTruthExcerpt({
   csv,metadata:{fps:'30000/1001'},
   clipId:'fake-sequence',sourceGroup:'synthetic-session'
 });
 assert.equal(converted.stage,'UNLICENSED RESEARCH CONVERSION — NO GAME USE');
 assert.equal(converted.format.formatValid,true);
 assert.equal(converted.frames,3);
 assert.equal(converted.tracks,1);
 assert.ok(Math.abs(converted.fps-29.97002997)<1e-8);
 assert.deepEqual(converted.candidate.rows.map(r=>[r.trackId,r.xM,r.yM,r.zM]),
   [['fake-sequence:4',1,0,1.2],
    ['fake-sequence:4',1.5,-0.5,1.4],
    ['fake-sequence:4',2,-0.8,1.6]]);
 assert.ok(Math.abs(converted.candidate.rows[1].timeS-(1001/30000))<1e-12);
 assert.equal(converted.candidate.rows[0].sampleId,'fake-sequence:4:0');
 assert.equal(converted.candidate.measurementKind,'trajectory');
 assert.equal(converted.units.originalPosition,'dm');
 assert.equal(converted.units.convertedPosition,'m');
 assert.equal(converted.units.spin,'not measured');
 assert.equal(converted.sourceAuthenticityVerified,false);
 assert.equal(converted.licensePermissionVerified,false);
 assert.equal(converted.sameSpecimenAerodynamicsVerified,false);
 assert.equal(converted.approvedForGameplay,false);
 assert.ok(Object.isFrozen(converted)&&Object.isFrozen(converted.candidate.rows));
 assert.deepEqual(adaptBall3dGroundTruthExcerpt({
   csv,metadata:{fps:'30000/1001'},clipId:'fake-sequence',
   sourceGroup:'synthetic-session'
 }),converted);
});
test('ME-PHYS-14 detects malformed or contaminated clip coordinates and frame timing',()=>{
 const run=(csv,metadata={fps:25})=>adaptBall3dGroundTruthExcerpt({
   csv,metadata,clipId:'synthetic',sourceGroup:'synthetic-source'
 });
 const good='file_name,track_id,x,y,z\n0,1,12,3,20\n1,1,15,6,22';
 assert.equal(run(good).format.formatValid,true);
 assert.equal(run('"file_name","track_id","x","y","z"\n0,1,12,3,20\n1,1,15,6,22').format.formatValid,true);
 assert.equal(run(good,{fps:60}).candidate.rows[1].timeS,1/60);
 for(const fps of [0,-1,NaN,Infinity,300,'30000/0',null,'not-a-number'])
   assert.throws(()=>run(good,{fps}),/fps/);
 for(const bad of [
   'track_id,x,y,z\n1,1,2,3\n1,1,2,3',
   'file_name,track_id,x,y,z\n0,1,12,3,20\n0,1,15,6,22',
   'file_name,track_id,x,y,z\n1,1,12,3,20\n0,1,15,6,22',
   'file_name,track_id,x,y,z\n-1,1,12,3,20\n1,1,15,6,22',
   'file_name,track_id,x,y,z\n0,1,NaN,3,20\n1,1,15,6,22',
   'file_name,track_id,x,y,z\n0,1,12,3,20\n1,1,15,6',
   'file_name,track_id,x,y,z\n"0,1,12,3,20\n1,1,15,6,22'
 ])assert.throws(()=>run(bad));
 assert.throws(()=>run(good.replace('20','20,extra')),/column count/);
 assert.throws(()=>run(good,{fps:'1/0'}),/fps/);
 assert.throws(()=>adaptBall3dGroundTruthExcerpt({
   csv:good,metadata:{fps:25},clipId:'bad/id',sourceGroup:'original'
 }),/clip/);
 assert.throws(()=>parseBall3dCsvExcerpt(''),/bounded/);
 const oneFrame=run('file_name,track_id,x,y,z\n0,1,10,0,15\n0,2,10,0,15');
 assert.equal(oneFrame.format.formatValid,false,'two distinct one-frame tracks are not complete flights');
});
test('ME-PHYS-14 remains a non-commercial candidate, not a calibration or observed spin',()=>{
 const converted=adaptBall3dGroundTruthExcerpt({
   csv:'file_name,track_id,x,y,z\n0,5,10,0,10\n1,5,12,1,13',
   metadata:{fps:50},clipId:'synthetic',sourceGroup:'acquisition-A',
   specimenId:'UNVERIFIED-BALL',usageRights:'CLAIMED PERMISSION'
 });
 assert.match(converted.candidate.usageRights,/CLAIMED/);
 assert.equal(converted.licensePermissionVerified,false);
 assert.equal(converted.sameSpecimenAerodynamicsVerified,false);
 assert.equal(converted.approvedForGameplay,false);
 assert.match(converted.note,/do not infer angular velocity/);
 const active=createEngine(RAPIER,{preset:'launch',seed:'me14-world-isolation'});
 try{
   for(let i=0;i<42;i++)active.step();
   const before=canonicalSnapshot(active.snapshot());
   assert.equal(converted.candidate.rows.length,2);
   assert.equal(canonicalSnapshot(active.snapshot()),before);
   assert.equal(runPhysicsDiagnostics(RAPIER).version,'me-01-physics-v4');
   assert.equal(canonicalSnapshot(active.snapshot()),before);
 }finally{active.dispose();}
});

test('ME-PHYS-15 sampled Rapier vs identical synthetic observation has 0m error',()=>{
 const scenario={preset:'launch',seed:'me15-fake-holdout',vx:11,vy:0,vz:10};
 const prediction=generateDisposableBallPrediction(RAPIER,createEngine,{scenario,seconds:2});
 assert.equal(prediction.length,121);
 const observation=prediction.filter((_,index)=>index%6===0).map(p=>({
   ...p,trackId:'synthetic-kick:0'
 }));
 const score=evaluateFlightTrajectory({observed:observation,predicted:prediction});
 assert.equal(score.count,21);
 assert.ok(score.rmse3dM<1e-9);
 assert.ok(score.mae3dM<1e-9);
 assert.ok(score.endpointErrorM<1e-9);
 assert.ok(score.relativeDisplacementRmseM<1e-9);
 assert.equal(score.observedTrack,'synthetic-kick:0');
 assert.equal(score.coordinateConventionClaim,'unverified');
 assert.equal(score.approvedForGameplay,false);
 assert.equal(score.scientificVerificationComplete,false);
 assert.equal(score.licensePermissionVerified,false);
 assert.ok(Object.isFrozen(score)&&Object.isFrozen(score.checkpoints));
 const again=evaluateFlightTrajectory({observed:observation,predicted:prediction});
 assert.deepEqual(again,score,'synthetic numerical metrics must be deterministic');
 process.stdout.write('ME15_SYNTHETIC_ZERO '+JSON.stringify({
   samples:score.count,rmseM:score.rmse3dM,
   approved:score.approvedForGameplay
 })+'\n');
});

test('ME-PHYS-15 relative displacement isolates constant translation without concealing absolute offset',()=>{
 const predicted=[0,0.025,0.05,0.075,0.1].map(t=>({
   timeS:t,xM:2*t,yM:-t,zM:1+2*t
 }));
 const observed=[0.025,0.075].map(t=>({
   timeS:t,xM:2*t+3,yM:-t-4,zM:1+2*t
 }));
 const score=evaluateFlightTrajectory({
   observed,predicted,maxGapS:0.025,
   coordinateConvention:'externally-confirmed-same-xyz-meters'
 });
 assert.ok(Math.abs(score.mae3dM-5)<1e-10);
 assert.ok(Math.abs(score.rmse3dM-5)<1e-10);
 assert.ok(Math.abs(score.endpointErrorM-5)<1e-10);
 assert.ok(score.relativeDisplacementRmseM<1e-10);
 assert.equal(score.rmseZ_M,0);
 assert.ok(Math.abs(score.rmseX_M-3)<1e-10);
 assert.ok(Math.abs(score.rmseY_M-4)<1e-10);
 assert.equal(score.approvedForGameplay,false);
 assert.equal(score.scientificVerificationComplete,false,
   'even an externally-confirmed string is not verifiable scientific evidence');
 assert.match(score.limitations,/origin, units and clock/);
 const shifted=predicted.map(p=>({...p,xM:p.xM+p.timeS*0.2}));
 const drift=evaluateFlightTrajectory({observed:predicted,predicted:shifted,
   maxGapS:0.025});
 assert.ok(drift.rmse3dM>0);
 assert.ok(drift.relativeDisplacementRmseM>0);
 assert.ok(drift.endpointErrorM>drift.checkpoints[0].absoluteErrorM);
});

test('ME-PHYS-15 forbids interpolation outside observed domain, missing frames and mixed tracks',()=>{
 const good=[0,0.025,0.05,0.075,0.1].map(t=>({
   timeS:t,xM:t,yM:0,zM:2
 }));
 const obs=[good[1],good[3]];
 const fail=(observed,predicted,options={})=>assert.throws(()=>
   evaluateFlightTrajectory({observed,predicted,...options}));
 fail(obs,good,{maxGapS:0});
 fail(obs,good,{maxGapS:NaN});
 fail(obs,[good[0],good[4]],{maxGapS:0.05});
 fail([good[0],{...good[1],timeS:-1}],good);
 fail([good[0],{...good[1],timeS:0}],good);
 fail([{...good[0],xM:Infinity},good[1]],good);
 fail([{...good[0],trackId:'kick-A'},{...good[1],trackId:'kick-B'}],good);
 fail([{...good[0],trackId:'kick-A'},good[1]],good);
 fail([good[0],{...good[1],trackId:'kick-A'}],good);
 fail([{...good[0],xM:1001},good[1]],good);
 fail([good[0],{...good[4],timeS:0.2}],good);
 fail(obs,good,{coordinateConvention:'rotate-to-fit'});
 fail([good[0]],good);
 fail(obs,[good[0]]);
 assert.equal(evaluateFlightTrajectory({observed:obs,predicted:good}).count,2);
});

test('ME-PHYS-15 disposable 60Hz prediction cannot perturb the running LAB world',()=>{
 const active=createEngine(RAPIER,{preset:'roll',seed:'me15-active-state'});
 try{
   for(let i=0;i<60;i++)active.step();
   const before=canonicalSnapshot(active.snapshot());
   const fake=generateDisposableBallPrediction(RAPIER,createEngine,{
     scenario:{preset:'launch',seed:'me15-independent',vx:13,vy:0,vz:10},
     options:{diagnosticAirDragModel:'speed-dependent'},seconds:1.5
   });
   assert.equal(fake.length,91);
   assert.ok(fake.every(p=>Object.values(p).every(Number.isFinite)));
   assert.equal(canonicalSnapshot(active.snapshot()),before);
   assert.deepEqual(fake,generateDisposableBallPrediction(RAPIER,createEngine,{
     scenario:{preset:'launch',seed:'me15-independent',vx:13,vy:0,vz:10},
     options:{diagnosticAirDragModel:'speed-dependent'},seconds:1.5
   }));
   assert.equal(canonicalSnapshot(active.snapshot()),before);
   assert.throws(()=>generateDisposableBallPrediction(RAPIER,createEngine,{
     scenario:{preset:'launch'},seconds:5
   }),/duration/);
 }finally{active.dispose();}
});

test('ME-PHYS-18 real pre-impact XY/XZ paths are scaled in metres, never mixed with bounce',()=>{
 const report=runLiteratureCandidateDiagnostics(RAPIER);
 for(const row of report.cases){
   for(const mode of ['current','literature']){
     const run=row[mode],points=run.preContactTrail;
     assert.ok(Object.isFrozen(points)&&points.length>=10);
     assert.ok(points.every(p=>Object.isFrozen(p)));
     assert.equal(points[0].timeS,0);
     assert.ok(Math.abs(points[0].forwardM)<1e-8);
     assert.ok(Math.abs(points[0].lateralM)<1e-8);
     assert.ok(points[0].undersideM>0);
     assert.ok(points.every(p=>[p.timeS,p.forwardM,p.lateralM,p.undersideM].every(Number.isFinite)));
     for(let i=1;i<points.length;i++){
       assert.ok(points[i].timeS>points[i-1].timeS);
       assert.ok(points[i].forwardM>points[i-1].forwardM,
         'front-of-launch x must increase before contact');
     }
     const last=points.at(-1);
     assert.ok(last.timeS<run.firstContactTimeS,
       'only precontact samples allowed in the trajectory');
     assert.ok(run.firstContactPoint!==null);
     assert.ok(Object.isFrozen(run.firstContactPoint));
     assert.ok(Math.abs(run.firstContactPoint.timeS-run.firstContactTimeS)<1e-9);
     assert.ok(run.firstContactPoint.undersideM<0.3);
     assert.ok(run.firstContactPoint.forwardM>=last.forwardM);
     assert.ok(run.oneSecondPoint!==null);
     assert.ok(Math.abs(run.oneSecondPoint.timeS-1)<1e-9);
     assert.ok(Math.abs(run.oneSecondPoint.lateralM-run.lateralAtOneM)<1e-8);
     const atOne=points.find(p=>Math.abs(p.timeS-1)<1e-9);
     assert.ok(atOne);
     assert.deepEqual(atOne,run.oneSecondPoint);
   }
   if(row.spinKey==='none')
     assert.deepEqual(row.current.preContactTrail,row.literature.preContactTrail,
       'zero-spin trajectories must be the same physical Cd(v) flight');
 }
 for(const speed of report.speeds){
   const plus=report.cases.find(c=>c.vxMps===speed&&c.spinKey==='plus');
   const minus=report.cases.find(c=>c.vxMps===speed&&c.spinKey==='minus');
   const zero=report.cases.find(c=>c.vxMps===speed&&c.spinKey==='none');
   for(const mode of ['current','literature']){
     const a=plus[mode],b=minus[mode],n=zero[mode];
     assert.equal(a.preContactTrail.length,b.preContactTrail.length);
     for(let i=0;i<Math.min(a.preContactTrail.length,b.preContactTrail.length,n.preContactTrail.length);i++){
       const q=a.preContactTrail[i],p=b.preContactTrail[i];
       assert.ok(Math.abs(q.lateralM+p.lateralM-2*n.preContactTrail[i].lateralM)<0.15);
       assert.ok(Math.abs(q.forwardM-p.forwardM)<0.15);
     }
   }
 }
 assert.ok(report.cases.find(c=>c.vxMps===30&&c.spinKey==='plus')
   .literature.oneSecondPoint.lateralM>3,
   'strong high-speed deflection must be visible as a review item, not hidden by filtering');
 const active=createEngine(RAPIER,{preset:'roll',seed:'me18-paths-dont-mutate'});
 try{
   for(let i=0;i<35;i++)active.step();
   const canonical=canonicalSnapshot(active.snapshot());
   assert.deepEqual(runLiteratureCandidateDiagnostics(RAPIER),report);
   assert.equal(canonicalSnapshot(active.snapshot()),canonical);
 }finally{active.dispose();}
});

test('ME-PHYS-17 bounded candidate has saturating lift, spin drag and proper force orthogonality',()=>{
 assert.equal(LITERATURE_MODEL_ID,'literature-2011-hybrid-diagnostic');
 assert.match(LITERATURE_AERO_SOURCE,/pmc\.ncbi\.nlm\.nih\.gov/);
 assert.equal(LITERATURE_CL_LIMIT,0.25);
 assert.equal(LITERATURE_CL_EXP_RATE_PER_RPS,0.5);
 assert.equal(LITERATURE_SPIN_DRAG_PER_RPS,0.014);
 assert.equal(LITERATURE_SPIN_DRAG_MAX,0.12);
 assert.match(LITERATURE_MODEL_LIMITATIONS,/no.*same-specimen experimental validation/i);
 const v={x:20,y:0,z:0},z={x:0,y:0,z:2*Math.PI*6},negative={x:0,y:0,z:-2*Math.PI*6};
 const zero=literatureCandidateForces(v,{x:0,y:0,z:0});
 const positive=literatureCandidateForces(v,z);
 const mirrored=literatureCandidateForces(v,negative);
 assert.equal(zero.cd,speedDependentDragCd(20));
 assert.equal(zero.cl,0);
 assert.deepEqual(zero.lift,{x:0,y:0,z:0});
 assert.ok(Math.abs(positive.cdSpinIncrement-0.084)<1e-12);
 assert.ok(Math.abs(positive.cl-0.25*(1-Math.exp(-3)))<1e-12);
 assert.equal(positive.cd,mirrored.cd);
 assert.equal(positive.cl,mirrored.cl);
 assert.ok(positive.lift.y>0&&mirrored.lift.y<0);
 assert.ok(Math.abs(positive.forceLiftDotVelocityW)<1e-9);
 assert.ok(positive.dragDotVelocityW<0);
 assert.ok(Math.abs(mirrored.lift.y+positive.lift.y)<1e-11);
 const aligned=literatureCandidateForces(v,{x:2*Math.PI*6,y:0,z:0});
 assert.equal(aligned.cl,0);
 assert.equal(aligned.lift.y,0);
 assert.ok(aligned.cd>zero.cd);
 const stopped=literatureCandidateForces({x:0,y:0,z:0},z);
 assert.equal(stopped.cl,0);
 assert.deepEqual(stopped.force,{x:0,y:0,z:0});
 for(const invalid of [null,{}, {x:NaN,y:0,z:0},{x:1,y:0,z:Infinity}])
   assert.throws(()=>literatureCandidateForces(invalid,z),/Invalid literature/);
 assert.throws(()=>literatureCandidateForces(v,z,{densityKgM3:0}),/Invalid literature/);
 assert.ok(Object.isFrozen(positive)&&Object.isFrozen(positive.lift));
 assert.equal(positive.qualifiedForGameplay,false);
});

test('ME-PHYS-17 launch-only diagnostic mode does not leak into gameplay or other air-force switches',()=>{
 const scenario={preset:'launch',seed:'me17-single-model',vx:15,vy:0,vz:10};
 const spin={x:0,y:0,z:MAGNUS_SPIN_RAD_S};
 const options={diagnosticAerodynamicProfile:'literature-2011',
   diagnosticMagnusSpinRadS:spin};
 const candidate=createEngine(RAPIER,scenario,options);
 const old=createEngine(RAPIER,scenario,{
   diagnosticAirDragModel:'speed-dependent',diagnosticMagnusSpinRadS:spin});
 const defaultWorld=createEngine(RAPIER,scenario);
 const zeroProfile=createEngine(RAPIER,scenario,{
   diagnosticAerodynamicProfile:'literature-2011',
   diagnosticMagnusSpinRadS:{x:0,y:0,z:0}});
 const oldZero=createEngine(RAPIER,scenario,{diagnosticAirDragModel:'speed-dependent'});
 try{
   assert.ok(Math.abs(candidate.angularVelocity().z-MAGNUS_SPIN_RAD_S)<1e-4);
   for(let tick=0;tick<85;tick++){
     const c=candidate.step(),o=old.step(),d=defaultWorld.step();
     const zero=zeroProfile.step(),oldZ=oldZero.step();
     assert.equal(canonicalSnapshot(zero),canonicalSnapshot(oldZ),
       'zero-spin new candidate must agree with existing Cd(v) control');
     if(tick>15)assert.notEqual(canonicalSnapshot(c),canonicalSnapshot(o),
       'candidate differs from the old proxy for spinning flight');
     if(tick>15)assert.notEqual(canonicalSnapshot(c),canonicalSnapshot(d),
       'candidate remains opt-in, not default');
     assert.ok(Object.values(c.ball.velocity).every(Number.isFinite));
   }
   const reset=candidate.reset(),fresh=createEngine(RAPIER,scenario,options);
   try{
     for(let n=0;n<90;n++){reset.step();fresh.step();}
     assert.equal(canonicalSnapshot(reset.snapshot()),canonicalSnapshot(fresh.snapshot()));
     assert.deepEqual(reset.angularVelocity(),fresh.angularVelocity());
   }finally{reset.dispose();fresh.dispose();}
 }finally{candidate.dispose();old.dispose();defaultWorld.dispose();zeroProfile.dispose();oldZero.dispose();}
 const invalid=[
   {diagnosticAerodynamicProfile:'unmeasured'},
   {diagnosticAerodynamicProfile:'literature-2011'},
   {diagnosticAerodynamicProfile:'literature-2011',
     diagnosticMagnusSpinRadS:spin,diagnosticAirDragModel:'speed-dependent'},
   {diagnosticAerodynamicProfile:'literature-2011',
     diagnosticMagnusSpinRadS:spin,diagnosticAirDragCd:0.24},
   {diagnosticAerodynamicProfile:'literature-2011',
     diagnosticMagnusSpinRadS:spin,diagnosticMagnusLiftEnabled:false}
 ];
 for(const opt of invalid)
   assert.throws(()=>createEngine(RAPIER,scenario,opt),/diagnostic|Literature|Invalid/);
 assert.throws(()=>createEngine(RAPIER,{preset:'roll'},options),/launch/);
});

test('ME-PHYS-17 real Rapier 18-world A/B is deterministic, bounded and side-spin symmetric',()=>{
 const active=createEngine(RAPIER,{preset:'roll',seed:'me17-active'});
 try{
   for(let i=0;i<40;i++)active.step();
   const before=canonicalSnapshot(active.snapshot());
   const report=runLiteratureCandidateDiagnostics(RAPIER);
   assert.equal(report.independentWorlds,18);
   assert.deepEqual(report.speeds,[7,15,30]);
   assert.deepEqual(LITERATURE_CANDIDATE_VX_MPS,[7,15,30]);
   assert.equal(LITERATURE_CANDIDATE_SPINS.length,3);
   assert.equal(report.cases.length,9);
   assert.equal(report.gameplayApproved,false);
   assert.equal(report.modelCalibrated,false);
   assert.equal(report.gameplayCd,0);
   assert.equal(report.gameplayMagnus,false);
   assert.equal(report.singlePitchDecelerationMps2,0.8);
   assert.match(report.note,/not fitted measurements/);
   assert.ok(Object.isFrozen(report)&&Object.isFrozen(report.cases));
   for(const entry of report.cases){
     for(const name of ['current','literature']){
       const m=entry[name];
       assert.ok(m.cdAtOne>=0&&m.cdAtOne<0.6);
       assert.ok(m.clAtOne>=0&&m.clAtOne<=0.25);
       assert.ok(Number.isFinite(m.firstFlightDistanceM)&&m.firstFlightDistanceM>0);
       assert.ok(Number.isFinite(m.firstContactTimeS)&&m.firstContactTimeS>1);
       assert.ok(Number.isFinite(m.apexHeightM)&&m.apexHeightM>0);
       assert.ok(Number.isFinite(m.lateralAtOneM));
       assert.ok(Math.abs(m.liftPowerAtOneW)<1e-8);
     }
     assert.ok(Number.isFinite(entry.flightRangeDeltaM));
     assert.ok(Number.isFinite(entry.lateralDeltaAtOneM));
     assert.ok(Math.abs(entry.current.initialSpinRps-entry.literature.initialSpinRps)<1e-5);
     assert.ok(Math.abs(entry.current.actualSpinRpsAtOne-entry.literature.actualSpinRpsAtOne)<1e-4);
     if(entry.spinKey==='none'){
       assert.ok(Math.abs(entry.current.cdAtOne-entry.literature.cdAtOne)<1e-9);
       assert.ok(Math.abs(entry.current.lateralAtOneM-entry.literature.lateralAtOneM)<1e-7);
       assert.ok(Math.abs(entry.flightRangeDeltaM)<1e-5);
     }else{
       assert.ok(entry.literature.cdAtOne>entry.current.cdAtOne,
         'spinning drag must increase Cd at the same model state');
     }
   }
   for(const vx of report.speeds){
     const forSpin=k=>report.cases.find(c=>c.vxMps===vx&&c.spinKey===k);
     const plus=forSpin('plus'),minus=forSpin('minus'),zero=forSpin('none');
     for(const model of ['current','literature']){
       assert.ok(plus[model].lateralAtOneM>0.01);
       assert.ok(minus[model].lateralAtOneM< -0.01);
       assert.ok(Math.abs(plus[model].lateralAtOneM+minus[model].lateralAtOneM-
         2*zero[model].lateralAtOneM)<0.1);
     }
   }
   assert.deepEqual(runLiteratureCandidateDiagnostics(RAPIER),report);
   assert.deepEqual(runPhysicsDiagnostics(RAPIER).literatureCandidateComparison,report);
   assert.equal(canonicalSnapshot(active.snapshot()),before);
   process.stdout.write('ME17_LITERATURE_AB '+JSON.stringify(report.cases.filter(x=>x.spinKey==='plus').map(x=>({
     vx:x.vxMps,oldCd:x.current.cdAtOne,candidateCd:x.literature.cdAtOne,
     oldCl:x.current.clAtOne,candidateCl:x.literature.clAtOne,
     oldLateral:x.current.lateralAtOneM,candidateLateral:x.literature.lateralAtOneM,
     oldRange:x.current.firstFlightDistanceM,candidateRange:x.literature.firstFlightDistanceM
   })))+'\n');
 }finally{active.dispose();}
});

test('ME-PHYS-19 bounded playback uses only precontact snapshots and freezes each ball independently',()=>{
 const p=(timeS,forwardM,lateralM,undersideM)=>({
   timeS,forwardM,lateralM,undersideM
 });
 const previous={
   preContactTrail:[p(0,0,0,1),p(0.5,5,1,2)],
   firstContactPoint:p(1,10,2,0)
 };
 const candidate={
   preContactTrail:[p(0,0,0,1),p(0.5,6,2,2),p(1,11,3,1)],
   firstContactPoint:p(1.5,15,4,0)
 };
 const row={vxMps:15,spinKey:'plus',current:previous,literature:candidate};
 const pair=prepareFlightPlaybackPair(row);
 assert.ok(Object.isFrozen(pair)&&Object.isFrozen(pair.previous.points));
 assert.equal(pair.durationS,1.5);
 const start=sampleFlightPlaybackPair(pair,0);
 assert.equal(start.previous.phase,'airborne');
 assert.equal(start.candidate.phase,'airborne');
 assert.equal(start.previous.forwardM,0);
 assert.equal(start.finished,false);
 const at25=sampleFlightPlaybackPair(pair,0.25);
 assert.equal(at25.previous.forwardM,2.5);
 assert.equal(at25.previous.lateralM,0.5);
 assert.equal(at25.previous.undersideM,1.5);
 assert.equal(at25.candidate.forwardM,3);
 assert.equal(at25.previous.interpolated,true);
 assert.equal(at25.candidate.interpolated,true);
 const at05=sampleFlightPlaybackPair(pair,0.5);
 assert.equal(at05.previous.interpolated,false);
 assert.equal(at05.candidate.interpolated,false);
 const at125=sampleFlightPlaybackPair(pair,1.25);
 assert.equal(at125.previous.phase,'contact');
 assert.equal(at125.previous.forwardM,10);
 assert.equal(at125.previous.timeS,1);
 assert.equal(at125.candidate.phase,'airborne');
 assert.equal(at125.candidate.forwardM,13);
 assert.equal(at125.candidate.undersideM,0.5);
 const ended=sampleFlightPlaybackPair(pair,100);
 assert.equal(ended.finished,true);
 assert.equal(ended.timeS,1.5);
 assert.equal(ended.previous.forwardM,10);
 assert.equal(ended.candidate.forwardM,15);
 assert.equal(ended.candidate.phase,'contact');
 assert.deepEqual(sampleFlightPlaybackPair(pair,100),ended);
 assert.ok(Object.isFrozen(ended)&&Object.isFrozen(ended.candidate));
 assert.equal(row.current.preContactTrail.length,2,'no mutation of fixed-step evidence');
 for(const bad of [NaN,-1,Infinity,-Infinity])
   assert.throws(()=>sampleFlightPlaybackPair(pair,bad),/timestamp/);
 assert.throws(()=>prepareFlightPlaybackPair({...row,spinKey:'none'}),/spinning/);
 assert.throws(()=>prepareFlightPlaybackPair({...row,current:{
   ...previous,firstContactPoint:p(0.5,10,2,0)
 }}),/nonmonotonic/);
 assert.throws(()=>prepareFlightPlaybackPair({...row,literature:{
   ...candidate,preContactTrail:[p(0,0,0,1),p(0.5,NaN,2,2)]
 }}),/pre-contact/);
});

test('ME-PHYS-19 all real Rapier model pairs are scrubbable, mirrored and unchanged',()=>{
 const report=runLiteratureCandidateDiagnostics(RAPIER);
 const active=createEngine(RAPIER,{preset:'roll',seed:'me19-isolation'});
 try{
   for(let n=0;n<65;n++)active.step();
   const before=canonicalSnapshot(active.snapshot());
   for(const speed of [7,15,30]){
     const zero=report.cases.find(c=>c.vxMps===speed&&c.spinKey==='none');
     for(const spinKey of ['plus','minus']){
       const entry=report.cases.find(c=>c.vxMps===speed&&c.spinKey===spinKey);
       const pair=prepareFlightPlaybackPair(entry);
       assert.ok(pair.durationS>1&&pair.durationS<=3.5);
       const mid=sampleFlightPlaybackPair(pair,1);
       assert.equal(mid.previous.phase,'airborne');
       assert.equal(mid.candidate.phase,'airborne');
       assert.ok(Math.abs(mid.previous.lateralM-entry.current.lateralAtOneM)<1e-8);
       assert.ok(Math.abs(mid.candidate.lateralM-entry.literature.lateralAtOneM)<1e-8);
       const atEnd=sampleFlightPlaybackPair(pair,pair.durationS);
       assert.equal(atEnd.finished,true);
       assert.equal(atEnd.previous.phase,'contact');
       assert.equal(atEnd.candidate.phase,'contact');
       const after=sampleFlightPlaybackPair(pair,pair.durationS+1000);
       assert.deepEqual(after,atEnd,'never animate the bounce');
       assert.ok(Math.abs(after.previous.undersideM)<0.3);
       assert.ok(Math.abs(after.candidate.undersideM)<0.3);
       assert.equal(pair.previous.points.length,entry.current.preContactTrail.length+1);
       assert.equal(pair.candidate.points.length,entry.literature.preContactTrail.length+1);
       assert.ok(zero.current.preContactTrail.length>=10);
       assert.deepEqual(prepareFlightPlaybackPair(entry),pair);
     }
   }
   assert.equal(canonicalSnapshot(active.snapshot()),before);
 }finally{active.dispose();}
});

test('ME-PHYS-20 wall-clock animation is frame-rate independent and pauses without physics mutation',()=>{
 const clock=(startedAtMs,nowMs,offsetS=0,durationS=3)=>
   flightPlaybackWallTime({startedAtMs,nowMs,offsetS,durationS});
 assert.equal(clock(100,100),0);
 assert.equal(clock(100,116),0.016);
 assert.equal(clock(100,350),0.25);
 assert.equal(clock(100,1100),1);
 assert.equal(clock(100,1100,0.4),1.4);
 assert.equal(clock(100,1200,1.5),2.6);
 assert.equal(clock(100,5000),3,'presentation is clamped at last actual contact');
 assert.equal(clock(2000,2000,1.25),1.25,'pause/resume offsets stay frozen');
 assert.equal(clock(3000,3230,1.25),1.48,'resume never starts from old wall time');
 const sparse=clock(100,500,0,3);
 assert.equal(sparse,0.4,'a 400ms dropped frame must not be truncated to 80ms');
 const arbitraryFrames=[100,116,132,147,251,500,651,1100];
 const steps=arbitraryFrames.map(t=>clock(100,t));
 assert.ok(steps.every((v,i)=>i===0||v>=steps[i-1]));
 assert.equal(steps.at(-1),1);
 for(const bad of [
   {startedAtMs:NaN,nowMs:100,offsetS:0,durationS:2},
   {startedAtMs:100,nowMs:Infinity,offsetS:0,durationS:2},
   {startedAtMs:100,nowMs:90,offsetS:0,durationS:2},
   {startedAtMs:100,nowMs:101,offsetS:-1,durationS:2},
   {startedAtMs:100,nowMs:101,offsetS:3,durationS:2},
   {startedAtMs:100,nowMs:101,offsetS:0,durationS:0}
 ])assert.throws(()=>flightPlaybackWallTime(bad),/monotonic/);
 const active=createEngine(RAPIER,{preset:'roll',seed:'me20-visual-timing-isolation'});
 try{
   for(let i=0;i<50;i++)active.step();
   const before=canonicalSnapshot(active.snapshot());
   assert.equal(clock(100,3000),2.9);
   assert.equal(canonicalSnapshot(active.snapshot()),before);
 }finally{active.dispose();}
});
