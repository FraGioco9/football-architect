// ME-PHYS-17: ONE bounded literature-inspired *diagnostic* aerodynamic
// candidate, independent of field, weather or match-ball brand. This is a
// hybrid across publications, NOT a same-specimen fit nor replay/gameplay law.
// Linthorne & Patel (2011), citing a Linthorne & Everett (2006) empirical fit: CL≈0.25*(1-exp(-0.5*spinRps)); spinning drag
// increment roughly 0.014 per rev/s. Drag's underlying Cd(v) is the existing
// Euro 2024-inspired proxy with explicitly hypothetical low-speed knots.
// https://pmc.ncbi.nlm.nih.gov/articles/PMC3737918/
// https://kjss.sports.re.kr/v.35/2/392/21
import {speedDependentDragCd} from './aerodynamics.mjs';

export const LITERATURE_AERO_SOURCE='https://pmc.ncbi.nlm.nih.gov/articles/PMC3737918/';
export const LITERATURE_CL_LIMIT=0.25;
export const LITERATURE_CL_EXP_RATE_PER_RPS=0.5;
export const LITERATURE_SPIN_DRAG_PER_RPS=0.014;
export const LITERATURE_SPIN_DRAG_MAX=0.12; // explicit test-only bound
export const LITERATURE_MODEL_ID='literature-2011-hybrid-diagnostic';
export const LITERATURE_MODEL_LIMITATIONS=
 'Study equations are literature-informed approximations for a different football; '+
 'the shared low-speed Cd(v) knots are hypotheses, not fitted measurements. '+
 'No negative Magnus, aerodynamic torque, spin decay fit, wind, variable pitch or '+
 'same-specimen experimental validation. Never activate in normal gameplay.';

const vector=v=>v&&['x','y','z'].every(k=>typeof v[k]==='number'&&Number.isFinite(v[k]));

export function literatureCandidateForces(velocity,spin,{
  radiusM=0.11,densityKgM3=1.225,areaM2=Math.PI*radiusM*radiusM
}={}){
  if(!vector(velocity)||!vector(spin))
    throw new TypeError('Invalid literature candidate velocity/spin vector');
  if(!Number.isFinite(radiusM)||radiusM<=0||
     !Number.isFinite(densityKgM3)||densityKgM3<=0||
     !Number.isFinite(areaM2)||areaM2<=0)
    throw new RangeError('Invalid literature candidate ball/air constants');
  const speed=Math.hypot(velocity.x,velocity.y,velocity.z);
  const spinSpeed=Math.hypot(spin.x,spin.y,spin.z);
  const spinRps=spinSpeed/(2*Math.PI);
  const baseCd=speedDependentDragCd(speed);
  const increment=Math.min(LITERATURE_SPIN_DRAG_MAX,
    LITERATURE_SPIN_DRAG_PER_RPS*spinRps);
  const cd=baseCd+increment;
  const cross={
    x:spin.y*velocity.z-spin.z*velocity.y,
    y:spin.z*velocity.x-spin.x*velocity.z,
    z:spin.x*velocity.y-spin.y*velocity.x
  };
  const norm=Math.hypot(cross.x,cross.y,cross.z);
  const perpendicularSpinRps=speed>1e-8?norm/speed/(2*Math.PI):0;
  const cl=speed>1e-8?
    LITERATURE_CL_LIMIT*(1-Math.exp(-LITERATURE_CL_EXP_RATE_PER_RPS*perpendicularSpinRps)):0;
  const k=0.5*densityKgM3*areaM2*speed;
  const drag=Object.freeze({
    x:-k*cd*velocity.x,y:-k*cd*velocity.y,z:-k*cd*velocity.z
  });
  const magnitude=0.5*densityKgM3*areaM2*cl*speed*speed;
  const lift=Object.freeze(norm>1e-8?{
    x:magnitude*cross.x/norm,
    y:magnitude*cross.y/norm,
    z:magnitude*cross.z/norm
  }:{x:0,y:0,z:0});
  const force=Object.freeze({
    x:drag.x+lift.x,y:drag.y+lift.y,z:drag.z+lift.z
  });
  return Object.freeze({
    model:LITERATURE_MODEL_ID,cdBase:baseCd,cdSpinIncrement:increment,
    cd,cl,spinRps,perpendicularSpinRps,
    drag,lift,force,
    forceLiftDotVelocityW:lift.x*velocity.x+lift.y*velocity.y+lift.z*velocity.z,
    dragDotVelocityW:drag.x*velocity.x+drag.y*velocity.y+drag.z*velocity.z,
    qualifiedForGameplay:false
  });
}
