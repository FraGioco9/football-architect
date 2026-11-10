// ME-PHYS-23 — airborne angular-velocity decay sensitivity, measured by Rapier.
// λ values are illustrative, NOT measured from the same football specimen.
import {createEngine,FIXED_DT,ENGINE_VERSION,GRASS_ROLL_DECELERATION,
  BALL_INERTIA_KG_M2,toGroundClearance} from './core.mjs';
import {measureAirborneFlight} from './physics-diagnostics.mjs';
import {SPIN_AXIS_LAUNCH,SPIN_AXIS_CASES} from './spin-axis-qa.mjs';

export const SPIN_DECAY_RATES_PER_S=Object.freeze([0,0.2,0.5]);
export const SPIN_DECAY_AXES=Object.freeze(SPIN_AXIS_CASES.filter(c=>c.key!=='none'));
export const SPIN_DECAY_CHECKPOINTS_S=Object.freeze([0,0.25,0.5,0.75,0.8,1,1.25,1.5]);
export const SPIN_DECAY_OBSERVATION_S=3.5;
const spinSpeed=omega=>Math.hypot(omega.x,omega.y,omega.z)/(2*Math.PI);
const point=(s,first)=>Object.freeze({
  timeS:s.time,
  spinRevS:spinSpeed(s.angularVelocity),
  // Read-only 3D Rapier vectors at the same tick. Required to distinguish
  // changes in velocity input from changes in spin without another flight.
  velocityMps:Object.freeze({...s.ball.velocity}),
  angularVelocityRadS:Object.freeze({...s.angularVelocity}),
  lateralM:s.ball.position.y-first.ball.position.y,
  undersideM:toGroundClearance(s.ball.position.z),
  rotationalEnergyJ:0.5*BALL_INERTIA_KG_M2*
    (s.angularVelocity.x**2+s.angularVelocity.y**2+s.angularVelocity.z**2)
});
export function runSpinDecayDiagnostics(RAPIER){
  const cases=[];
  for(const axis of SPIN_DECAY_AXES){
    for(const decayRatePerS of SPIN_DECAY_RATES_PER_S){
      const readings={};
      for(const model of ['previous','candidate']){
        const diagnosticMagnusSpinRadS=axis.spin;
        const options=model==='previous'?
          {diagnosticMagnusSpinRadS,diagnosticAirDragModel:'speed-dependent',
            diagnosticSpinDecayRatePerS:decayRatePerS}:
          {diagnosticMagnusSpinRadS,diagnosticAerodynamicProfile:'literature-2011',
            diagnosticSpinDecayRatePerS:decayRatePerS};
        const engine=createEngine(RAPIER,SPIN_AXIS_LAUNCH,options);
        try{
          const observed=()=>({...engine.snapshot(),angularVelocity:engine.angularVelocity()});
          const samples=[observed()];
          for(let tick=0;tick<Math.round(SPIN_DECAY_OBSERVATION_S/FIXED_DT);tick++){
            engine.step();samples.push(observed());
          }
          const first=samples[0];
          const flight=measureAirborneFlight(samples,{dragModel:'speed-dependent'});
          const contact=flight.observedFirstContactTimeS;
          const checkpoints=SPIN_DECAY_CHECKPOINTS_S.map(t=>{
            if(contact!==null&&t>=contact-1e-8)return null;
            return point(samples[Math.round(t/FIXED_DT)],first);
          });
          const atOne=contact===null||contact>1?
            point(samples[Math.round(1/FIXED_DT)],first):null;
          readings[model]=Object.freeze({
            initialSpinRevS:spinSpeed(first.angularVelocity),
            atOne,firstContactTimeS:contact,
            firstFlightDistanceM:flight.observedFirstContactDistanceM,
            checkpoints:Object.freeze(checkpoints)
          });
        }finally{engine.dispose();}
      }
      cases.push(Object.freeze({axis:axis.key,label:axis.label,decayRatePerS,
        previous:readings.previous,candidate:readings.candidate}));
    }
  }
  return Object.freeze({
    label:'ME-PHYS-23 — in-flight spin-decay sensitivity (not calibrated)',
    cases:Object.freeze(cases),independentWorlds:cases.length*2,
    rates:SPIN_DECAY_RATES_PER_S,
    axes:Object.freeze(SPIN_DECAY_AXES.map(x=>Object.freeze({key:x.key,label:x.label}))),
    checkpoints:SPIN_DECAY_CHECKPOINTS_S,
    launch:SPIN_AXIS_LAUNCH,physicsVersion:ENGINE_VERSION,
    grassDecelerationMps2:GRASS_ROLL_DECELERATION,
    disclaimer:'ω(t)=ω0 exp(−λt) is an illustrative airborne-only exponential '+
      'sensitivity, not measured rotational aerodynamic torque. λ=0 is the '+
      'unchanged model; 0.20 and 0.50 per second are NOT fitted to a real ball. '+
      'All observations are simulated before first contact.',
    scientificallyCalibrated:false,measuredRealSpin:false,
    coefficientFitPerformed:false,gameplayApproved:false
  });
}
