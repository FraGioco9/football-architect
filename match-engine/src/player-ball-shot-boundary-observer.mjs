// C2.1/C2.2: read-only actual Rapier shot / 3D post-contact trajectory.
// Not a goal, out-of-play, save, shot-on-target or possession adjudicator.
export const SHOT_BOUNDARY_VERSION='me-pb-c2-shot-field-plane-v2';
export const SHOT_BOUNDARY_WINDOW_TICKS=180;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const ballCentre=p=>{
 if(!p||!['x','y','z'].every(axis=>finite(p[axis])))
  throw new TypeError('Finite actual 3D Rapier ball position required');
 return Object.freeze({x:p.x,y:p.y,z:p.z});
};
const distance3=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const distance2=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const officialNull=Object.freeze({
 shotOnTarget:null,goalScored:null,officialMatchResult:null
});
export function measuredPitchCentreCrossing(before,after){
 const a=ballCentre(before),b=ballCentre(after),hits=[];
 for(const [axis,limit,side,kind] of [
  ['x',-52.5,'home-end','goal-line-plane'],
  ['x',52.5,'away-end','goal-line-plane'],
  ['y',-34,'lower-side','touch-line-plane'],
  ['y',34,'upper-side','touch-line-plane']
 ]){
  const direction=limit>0?1:-1;
  if(a[axis]*direction>limit*direction||
     b[axis]*direction<limit*direction||
     (b[axis]-a[axis])*direction<=0)continue;
  const fraction=(limit-a[axis])/(b[axis]-a[axis]);
  if(!finite(fraction)||fraction<0||fraction>1)continue;
  const centre=Object.freeze({
   x:a.x+(b.x-a.x)*fraction,
   y:a.y+(b.y-a.y)*fraction,
   z:a.z+(b.z-a.z)*fraction
  });
  hits.push({kind,side,fraction,centre,
   withinGoalOpeningCentre:kind==='goal-line-plane'
    ?Math.abs(centre.y)<=3.66-0.11&&centre.z>=0.11&&centre.z<=2.44-0.11:null
  });
 }
 if(!hits.length)return null;
 hits.sort((a,b)=>a.fraction-b.fraction||
  (a.kind==='touch-line-plane'?-1:1));
 return Object.freeze({
  ...hits[0],source:'consecutive-real-rapier-ball-centre-frames',
  fullBallCrossingProven:false,...officialNull
 });
}
const immutableEpisode=(episode,throughTick)=>Object.freeze({
 ...episode,observedThroughTick:throughTick,
 elapsedPhysicsTicks:throughTick-episode.shotTick,
 // The immutable series is measured after the physical shot, not predicted.
 measuredBallCentres3D:episode.measuredBallCentres3D,
 physicalSampleCount:episode.measuredBallCentres3D.length,
 readOnly:true,physicallyObservedOnly:true,
 fullBallCrossingProven:false,...officialNull
});
const stopped=(episode,throughTick,status,crossing,contacts)=>Object.freeze({
 ...immutableEpisode(episode,throughTick),
 status,firstPitchPlaneCrossing:crossing,
 firstLaterShoeContact:contacts.length?Object.freeze({
  physicsTick:throughTick,
  contacts:Object.freeze(contacts.map(foot=>Object.freeze({
   engineId:foot.engineId,team:foot.team,
   contactKind:foot.engineId===episode.shooterId?'shooter-recontact':
    foot.team===episode.team?'teammate-shoe':'opponent-shoe'
  }))),
  simultaneousShoeStartsAmbiguous:contacts.length>1,
  temporalOrderWithPlaneCrossing:crossing?'unknown-within-same-physics-step':null,
  goalScored:null,shotOnTarget:null
 }):null
});
export function createPhysicalShotBoundaryObserver(fixtureId){
 if(typeof fixtureId!=='string'||!fixtureId)
  throw new TypeError('Fixture identity required');
 let expected=0,previous=null,active=null,lastResolved=null;
 return Object.freeze({observe({physicsTick,ballPosition,localAutonomousAction,physicalContactFeed}){
  if(physicsTick!==expected||!Number.isSafeInteger(physicsTick)||
     physicalContactFeed?.physicsTick!==physicsTick||
     physicalContactFeed?.realFootEventsOnly!==true||
     physicalContactFeed?.officialGoalEvidence!==false||
     !Array.isArray(physicalContactFeed.started)||
     !Array.isArray(physicalContactFeed.active))
   throw new Error('Untrusted physics tick/contact feed for shot boundary');
  const p=ballCentre(ballPosition),action=localAutonomousAction;
  if(action&&(
    !['shot','pass','clearance','carry'].includes(action.action)||
    action.tick!==physicsTick||action.appliedByRapier!==true||
    action.officialMatchAction!==false||
    physicalContactFeed.started.length!==1||
    physicalContactFeed.active.length!==1||
    physicalContactFeed.started[0].engineId!==action.playerId||
    physicalContactFeed.active[0].engineId!==action.playerId||
    !['home','away'].includes(action.team)||
    physicalContactFeed.started[0].team!==action.team))
   throw new Error('Shot/action requires genuine exclusive Rapier shoe contact');
  if(active&&previous){
   const crossing=measuredPitchCentreCrossing(previous,p);
   const elapsed=physicsTick-active.shotTick;
   const length3=distance3(previous,p),length2=distance2(previous,p);
   const observed=Object.freeze({
    ...active,measuredBallCentres3D:Object.freeze([
     ...active.measuredBallCentres3D,p
    ]),
    observedPath3DM:active.observedPath3DM+length3,
    observedGroundPathM:active.observedGroundPathM+length2,
    maximumBallCentreHeightM:Math.max(active.maximumBallCentreHeightM,p.z)
   });
   const contacts=physicalContactFeed.started;
   if(crossing||contacts.length||elapsed>=SHOT_BOUNDARY_WINDOW_TICKS){
    const status=crossing&&contacts.length?
     'plane-and-shoe-same-tick-order-unknown':
     crossing?'centre-plane-observed':
     contacts.length?'later-shoe-start-observed':
     'expired-without-plane-or-contact';
    lastResolved=stopped(observed,physicsTick,status,crossing,contacts);
    active=null;
   }else active=observed;
  }
  if(action?.action==='shot'){
   // Distinct genuine shot replaces a prior episode only after its
   // actual intervening 60Hz ball movement has been observed.
   if(active){
    lastResolved=stopped(active,physicsTick,'superseded-by-new-shot',null,[]);
    active=null;
   }
   active=Object.freeze({
    shotTick:physicsTick,shooterId:action.playerId,team:action.team,
    initialBallCentre:p,source:'authentic-exclusive-rapier-shoe-impulse',
    measuredBallCentres3D:Object.freeze([p]),
    observedPath3DM:0,observedGroundPathM:0,
    maximumBallCentreHeightM:p.z
   });
  }
  previous=p;expected++;
  return Object.freeze({
   version:SHOT_BOUNDARY_VERSION,physicsTick,fixtureId,
   active:active?immutableEpisode(active,physicsTick):null,
   lastResolved,readOnly:true,realRapierBallFramesOnly:true,
   ...officialNull,productionScoringConnected:false
  });
 }});
}
