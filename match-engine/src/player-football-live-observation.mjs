// P2: READ-ONLY observation of the ALREADY completed internal Rapier tick.
// A declared football intention is NOT a physical shoe event, executable
// action, pass, possession, or score. Do not accept this adapter from an API.
import {projectObservedFootballContext}
 from './player-football-observation.mjs';
import {chooseObservedFootballIntent}
 from './player-football-intent.mjs';
import {measureObservedPassingCorridors}
 from './player-football-corridors.mjs';
import {PHYSICAL_FIXTURE_CONTACT_FEED_VERSION}
 from './physical-fixture-step-runtime.mjs';

export const LIVE_FOOTBALL_OBSERVATION_VERSION=
 'me-p2-internal-genuine-shoe-readonly-observation-v1';

// This observes completed SAME-tick physics. It must never be used to
// retroactively authorize the action that preceded the final frame.
// The real shoe feed is sealed by createPhysicalFixtureStepRuntime first;
// these structural checks alone cannot attest arbitrary caller objects.
export function observeLiveFixtureFootballContext(frame,contactFeed,fixtureId){
 const tick=frame?.physicsTick;
 if(!Number.isSafeInteger(tick)||tick<0||
    typeof fixtureId!=='string'||!fixtureId||
    !contactFeed||!Object.isFrozen(contactFeed)||
    contactFeed.version!==PHYSICAL_FIXTURE_CONTACT_FEED_VERSION||
    contactFeed.physicsTick!==tick||
    contactFeed.fixtureId!==fixtureId||
    contactFeed.contactSource!=='same-step-real-rapier-shoe-ball-collider'||
    contactFeed.realFootEventsOnly!==true||
    contactFeed.independentContactInjection!==false||
    !Array.isArray(contactFeed.started)||!Array.isArray(contactFeed.active)||
    !Object.isFrozen(contactFeed.started)||!Object.isFrozen(contactFeed.active)||
    frame.footContact?.tick!==tick||
    frame.localAutonomousAction?.tick>tick)
  throw new TypeError('Canonical completed Rapier contact frame required');
 const soleStart=contactFeed.started.length===1&&
  contactFeed.active.length===1&&
  contactFeed.started[0].engineId===contactFeed.active[0].engineId;
 if(tick===0&&(contactFeed.started.length||contactFeed.active.length))
  throw new TypeError('No tick-zero real contact');
 const actorId=soleStart?contactFeed.started[0].engineId:null;
 // Zero affordances are intentional: P1 QUALITATIVE priorities remain
 // unapproved. Neither a geometric opening nor real START implies PASS/SHOT.
 const context=actorId?
  projectObservedFootballContext(frame,{
   playerId:actorId,phase:'ball-opportunity'
  }):null;
 const corridors=context?measureObservedPassingCorridors(context):null;
 const declaredIntent=context?chooseObservedFootballIntent(context):null;
 if(declaredIntent!==null||corridors?.authorizedAffordances.length)
  throw new Error('Unapproved football intent or pass eligibility');
 return Object.freeze({
  version:LIVE_FOOTBALL_OBSERVATION_VERSION,
  fixtureId,physicsTick:tick,readOnly:true,
  source:'internal-completed-rapier-fixture-tick',
  soleRealShoeStartObserved:soleStart,
  observedActorId:actorId,
  observedContext:context,
  passingCorridorGeometry:corridors,
  // No tactical candidate before an explicit P1 qualitative decision.
  proposedIntent:null,authorizedAffordances:Object.freeze([]),
  physicalActionExecuted:false,officialMatchAction:false,
  officialMatchPossession:false,officialMatchResult:null
 });
}
