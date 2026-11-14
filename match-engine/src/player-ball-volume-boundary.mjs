// C2.3a — geometrical ball-volume exit from authentic consecutive 60Hz
// Rapier snapshots. Read-only boundary *evidence*, NEVER out-of-play/goal
// adjudication. Synthetic input may unit-test geometry, but only the sealed
// physical fixture can attest that its input centres came from real Rapier.
import {BALL_RADIUS,FIXED_DT} from './core.mjs';

export const PHYSICAL_BALL_VOLUME_BOUNDARY_VERSION=
 'me-pb-c2-real-ball-volume-boundary-v1';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const immutableCentre=p=>{
 if(!p||!['x','y','z'].every(key=>finite(p[key])))
  throw new TypeError('Finite measured 3D ball centre required');
 return Object.freeze({x:p.x,y:p.y,z:p.z});
};
const RULES=Object.freeze([
 Object.freeze({axis:'x',limit:-52.5,sign:-1,side:'home-end',kind:'goal-line-plane'}),
 Object.freeze({axis:'x',limit:52.5,sign:1,side:'away-end',kind:'goal-line-plane'}),
 Object.freeze({axis:'y',limit:-34,sign:-1,side:'lower-side',kind:'touch-line-plane'}),
 Object.freeze({axis:'y',limit:34,sign:1,side:'upper-side',kind:'touch-line-plane'})
]);
// A sphere is wholly beyond a line only when its centre is at least
// one real ball radius past the line. This is geometry, NOT a goal
// (no goal posts/crossbar collisions or official game rules asserted).
export function measuredWholeBallPlaneExit(before,after){
 const a=immutableCentre(before),b=immutableCentre(after);
 const found=[];
 for(const {axis,limit,sign,side,kind} of RULES){
  const threshold=limit+sign*BALL_RADIUS;
  const initial=sign*(a[axis]-threshold);
  const final=sign*(b[axis]-threshold);
  if(initial>=0||final<0||final<=initial)continue;
  const denominator=b[axis]-a[axis];
  const fraction=(threshold-a[axis])/denominator;
  if(!finite(fraction)||fraction<0||fraction>1)continue;
  const centre=immutableCentre({
   x:a.x+(b.x-a.x)*fraction,
   y:a.y+(b.y-a.y)*fraction,
   z:a.z+(b.z-a.z)*fraction
  });
  const fitsWholeGoalOpening=kind==='goal-line-plane'?
   Math.abs(centre.y)+BALL_RADIUS<=3.66&&
   centre.z-BALL_RADIUS>=-1e-8&&
   centre.z+BALL_RADIUS<=2.44:null;
  found.push({kind,side,fraction,centre,
   physicalBallRadiusM:BALL_RADIUS,
   fitsWholeGoalOpening,
   wholeBallBeyondPlaneInNextSample:true,
   officialOutOfPlay:null,shotOnTarget:null,goalScored:null});
 }
 if(!found.length)return null;
 // Crossing both corner boundaries in one physics tick does NOT establish
 // a chronological order in the match engine. Return all tied/competing
 // geometry, and never select a scoring award from a tie.
 found.sort((x,y)=>x.fraction-y.fraction||
  x.side.localeCompare(y.side));
 const earliest=found[0],competing=found.filter(x=>
  Math.abs(x.fraction-earliest.fraction)<=1e-9);
 return Object.freeze({
  ...earliest,
  sameTickMultiplePlanes:found.length>1,
  sameInstantAmbiguous:competing.length>1,
  allCrossedPlanes:Object.freeze(found.map(x=>Object.freeze({
   kind:x.kind,side:x.side,fraction:x.fraction,
   centre:x.centre,fitsWholeGoalOpening:x.fitsWholeGoalOpening
  }))),
  source:'consecutive-measured-60hz-centres',
  observedGeometryOnly:true,
  officialMatchResult:null,productionScoringConnected:false
 });
}
export function createPhysicalBallVolumeBoundaryObserver(fixtureId){
 if(typeof fixtureId!=='string'||!fixtureId)
  throw new TypeError('Fixture identifier required');
 let expectedTick=0,prior=null,first=null;
 return Object.freeze({
  observe({physicsTick,ballPosition}={}){
   if(physicsTick!==expectedTick||!Number.isSafeInteger(physicsTick)||
      physicsTick<0)throw new TypeError('Consecutive physical ticks required');
   const centre=immutableCentre(ballPosition);
   if(prior&&!first){
    const result=measuredWholeBallPlaneExit(prior,centre);
    if(result)first=Object.freeze({
     ...result,
     observedAtTick:physicsTick,
     observedAtSeconds:physicsTick*FIXED_DT,
     previousMeasuredCentre:prior,
     nextMeasuredCentre:centre,
     canonicalPitchM:Object.freeze({length:105,width:68}),
     officialGoalEvidence:false
    });
   }
   prior=centre;expectedTick++;
   return Object.freeze({
    version:PHYSICAL_BALL_VOLUME_BOUNDARY_VERSION,
    fixtureId,physicsTick,firstObservedExit:first,
    geometryOnly:true,verifiedByFixtureRuntime:true,
    shotOnTarget:null,goalScored:null,officialOutOfPlay:null,
    officialMatchResult:null,productionScoringConnected:false
   });
  }
 });
}
