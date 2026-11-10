// ME-PHYS-25 — exact two-input decomposition of existing diagnostic lift.
// No new Rapier worlds, force laws, coefficients, or real-trajectory fit.
// A symmetric 2-order (Shapley) decomposition of instantaneous SIDE lift
// separates changes in the full velocity VECTOR (speed + flight angle) from
// changes in the angular-velocity VECTOR (spin). It cannot infer causal
// physical mechanisms or validate a universal football model.
import {magnusLift} from './magnus.mjs';
import {literatureCandidateForces} from './literature-aero-candidate.mjs';
import {SPIN_DECAY_RATES_PER_S} from './spin-decay-qa.mjs';

export const LIFT_INPUT_TIME_S=0.8;
export const LIFT_INPUT_DECISION='RETAIN BOTH DIAGNOSTIC MODELS — NO GAMEPLAY CALIBRATION';
const speed=v=>Math.hypot(v.x,v.y,v.z);
const valid=v=>v&&['x','y','z'].every(k=>typeof v[k]==='number'&&Number.isFinite(v[k]));
const liftY=(model,v,w)=>model==='previous'
 ? magnusLift(v,w).force.y
 : literatureCandidateForces(v,w).lift.y;

export function reviewLiftInputContributions(spinDecayReport){
 if(!spinDecayReport||!Array.isArray(spinDecayReport.cases))
   throw new TypeError('Rapier spin-decay report required');
 const rows=[];
 for(const ratePerS of SPIN_DECAY_RATES_PER_S){
   const trial=spinDecayReport.cases.find(c=>
     c.axis==='side-plus'&&c.decayRatePerS===ratePerS);
   if(!trial)throw new RangeError('Missing measured +Z spin-decay case');
   for(const model of ['previous','candidate']){
     const flight=trial[model];
     const first=flight?.checkpoints?.find(p=>p!==null&&p.timeS===0);
     const later=flight?.checkpoints?.find(p=>p!==null&&
       Math.abs(p.timeS-LIFT_INPUT_TIME_S)<1e-9);
     if(!first||!later||!(flight.firstContactTimeS>LIFT_INPUT_TIME_S))
       throw new RangeError('Missing airborne 0.8s velocity/spin state');
     const v0=first.velocityMps,v1=later.velocityMps;
     const w0=first.angularVelocityRadS,w1=later.angularVelocityRadS;
     if(!valid(v0)||!valid(v1)||!valid(w0)||!valid(w1))
       throw new TypeError('Invalid measured Rapier velocity or spin vector');
     // Counterfactual force evaluations of the SAME existing pure formulas.
     // F00=initial input pair; F10=new velocity, old spin;
     // F01=old velocity, new spin; F11=both observed at 0.8s.
     const f00=liftY(model,v0,w0);
     const f10=liftY(model,v1,w0);
     const f01=liftY(model,v0,w1);
     const f11=liftY(model,v1,w1);
     const velocityContributionN=0.5*((f10-f00)+(f11-f01));
     const spinContributionN=0.5*((f01-f00)+(f11-f10));
     const totalDeltaN=f11-f00;
     const closureResidualN=totalDeltaN-velocityContributionN-spinContributionN;
     if(![f00,f10,f01,f11,velocityContributionN,spinContributionN]
       .every(Number.isFinite))
       throw new RangeError('Nonfinite modeled lift decomposition');
     rows.push(Object.freeze({
       model,ratePerS,timeS:LIFT_INPUT_TIME_S,
       initialSpeedMps:speed(v0),observedSpeedMps:speed(v1),
       initialSpinRevS:speed(w0)/(2*Math.PI),
       observedSpinRevS:speed(w1)/(2*Math.PI),
       initialSideLiftN:f00,
       velocityOnlySideLiftN:f10,spinOnlySideLiftN:f01,
       observedSideLiftN:f11,
       velocityContributionN,spinContributionN,totalDeltaN,closureResidualN,
       dominantInput:Math.abs(velocityContributionN)>=Math.abs(spinContributionN)
         ?'velocity vector':'spin vector'
     }));
   }
 }
 return Object.freeze({
   label:'ME-PHYS-25 — signed lateral lift input decomposition',
   rows:Object.freeze(rows),modelEvaluations:rows.length*4,
   newRapierWorlds:0,timeS:LIFT_INPUT_TIME_S,
   method:'symmetric two-order (Shapley) decomposition of signed instantaneous '+ 
     'Y lift: 1/2[(F(v1,ω0)-F(v0,ω0))+(F(v1,ω1)-F(v0,ω1))] from the velocity '+ 
     'vector, plus the symmetric angular-velocity contribution. Values sum '+ 
     'algebraically to F(v1,ω1)-F(v0,ω0).',
   caveat:'Velocity-vector contribution INCLUDES flight direction AND speed. '+
     'It cannot be labelled speed-only or assigned physical causality. '+
     'Spin contribution uses measured angular velocity, not an independent '+ 
     'measured aerodynamic torque. This is model-internal force bookkeeping, '+ 
     'NOT real ball validation, an error benchmark or a trajectory contribution.',
   decision:LIFT_INPUT_DECISION,scientificallyCalibrated:false,
   coefficientFitPerformed:false,gameplayApproved:false
 });
}
