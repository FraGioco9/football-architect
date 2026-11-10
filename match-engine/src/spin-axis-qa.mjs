// ME-PHYS-22 — measured 3D spin-axis diagnostics, never gameplay physics.
// Ten isolated 60Hz Rapier worlds, unchanged previous and candidate models.
import {createEngine,FIXED_DT,ENGINE_VERSION,GRASS_ROLL_DECELERATION,BALL_RADIUS,toGroundClearance} from './core.mjs';
import {measureAirborneFlight} from './physics-diagnostics.mjs';
import {magnusLift,MAGNUS_SPIN_RAD_S} from './magnus.mjs';
import {literatureCandidateForces} from './literature-aero-candidate.mjs';
const spin=x=>Object.freeze(x);
export const SPIN_AXIS_CASES=Object.freeze([
 Object.freeze({key:'none',label:'No spin',spin:spin({x:0,y:0,z:0})}),
 Object.freeze({key:'side-plus',label:'+Z sidespin',spin:spin({x:0,y:0,z:MAGNUS_SPIN_RAD_S})}),
 Object.freeze({key:'side-minus',label:'−Z sidespin',spin:spin({x:0,y:0,z:-MAGNUS_SPIN_RAD_S})}),
 Object.freeze({key:'topspin',label:'+Y topspin',spin:spin({x:0,y:MAGNUS_SPIN_RAD_S,z:0})}),
 Object.freeze({key:'backspin',label:'−Y backspin',spin:spin({x:0,y:-MAGNUS_SPIN_RAD_S,z:0})})
]);
export const SPIN_AXIS_LAUNCH=Object.freeze({
 preset:'launch',seed:'me-phys22-spin-axes',x:0,y:0,z:0.8,vx:15,vy:0,vz:10
});
export const SPIN_AXIS_DURATION_S=3.5;
const point=(s,first)=>Object.freeze({timeS:s.time,
 forwardM:s.ball.position.x-first.ball.position.x,
 lateralM:s.ball.position.y-first.ball.position.y,
 clearanceM:toGroundClearance(s.ball.position.z)});
export function runSpinAxisDiagnostics(RAPIER){
 const cases=[];
 for(const spec of SPIN_AXIS_CASES){
  const modes={};
  for(const mode of ['previous','candidate']){
   const options=mode==='previous'?
    {diagnosticAirDragModel:'speed-dependent',diagnosticMagnusSpinRadS:spec.spin}:
    {diagnosticAerodynamicProfile:'literature-2011',diagnosticMagnusSpinRadS:spec.spin};
   const engine=createEngine(RAPIER,SPIN_AXIS_LAUNCH,options);
   try{
    const first=engine.snapshot(),omega=engine.angularVelocity();
    const lift=mode==='previous'?
     magnusLift(first.ball.velocity,omega,{radiusM:BALL_RADIUS}).force:
     literatureCandidateForces(first.ball.velocity,omega,{radiusM:BALL_RADIUS}).lift;
    const samples=[first];
    for(let t=0;t<Math.round(SPIN_AXIS_DURATION_S/FIXED_DT);t++)samples.push(engine.step());
    const flight=measureAirborneFlight(samples,{dragModel:'speed-dependent'});
    const contact=flight.observedFirstContactTimeS;
    const airborne=samples.filter(s=>contact===null||s.time<contact-1e-8);
    const atOne=contact===null||contact>1?samples[Math.round(1/FIXED_DT)]:null;
    const impact=contact===null?null:point(samples[Math.round(contact/FIXED_DT)],first);
    modes[mode]=Object.freeze({
     initialOmega:Object.freeze({...omega}),initialLiftN:Object.freeze({...lift}),
     atOne:atOne?point(atOne,first):null,
     apexHeightM:flight.observedApex.heightM,
     firstContactTimeS:contact,firstFlightDistanceM:flight.observedFirstContactDistanceM,
     trajectory:Object.freeze(airborne.filter((_,i)=>i%6===0).map(s=>point(s,first))),
     impact
    });
   }finally{engine.dispose();}
  }
  cases.push(Object.freeze({key:spec.key,label:spec.label,spin:spec.spin,
   previous:modes.previous,candidate:modes.candidate}));
 }
 return Object.freeze({
  label:'ME-PHYS-22 — three-dimensional spin-axis A/B (pre-impact only)',
  cases:Object.freeze(cases),independentWorlds:cases.length*2,
  launch:SPIN_AXIS_LAUNCH,observationS:SPIN_AXIS_DURATION_S,
  initialSpinRevS:MAGNUS_SPIN_RAD_S/(2*Math.PI),
  physicsVersion:ENGINE_VERSION,grassDecelerationMps2:GRASS_ROLL_DECELERATION,
  assumption:'ω × v points toward +Y for +Z, and downward for +Y at the +X launch. '+
   'Topspin/backspin extension of published 2D side-force data is unverified. '+
   'Both models remain provisional. These are synthetic Rapier measurements, not real shots.',
  realTrajectoryValidation:false,coefficientFitPerformed:false,
  scientificallyCalibrated:false,gameplayApproved:false
 });
}
