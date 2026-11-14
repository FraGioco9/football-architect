// ME-PB-55 / A4.2b.2 — read-only observed physical aftermath of a
// provisional autonomous Rapier action. NO pass/shot/goal adjudication.
export const PROVISIONAL_ACTION_OUTCOME_VERSION=
 'me-pb-55-genuine-rapier-post-action-observation-v1';
export const PROVISIONAL_ACTION_OBSERVATION_TICKS=12;
// C1.2a: independent bounded pass-contact trail. It is longer than the
// 12-tick ball-flight sample because a genuine teammate touch may occur
// later. It is NOT official reception, interception or possession.
export const PROVISIONAL_PASS_CONTACT_MAX_TICKS=300;
export const PROVISIONAL_PASS_CONTACT_VERSION=
 'me-pb-c1-local-real-shoe-pass-follow-through-v1';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const point=p=>Object.freeze({x:p.x,y:p.y,z:p.z});
const freezeIds=ids=>Object.freeze([...new Set(ids)]);
const observeDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
// C1.2c: consecutive measured Rapier states, never a solved impact
// impulse or an official interception/pass-success classification.
const observedBallKinematics=(prior,current,tick)=>
 !prior||!current?null:Object.freeze({
  priorPhysicsTick:tick-1,contactPhysicsTick:tick,
  ballPositionPriorTick:prior.position,
  ballPositionAtContact:current.position,
  ballVelocityPriorTick:prior.velocity,
  ballVelocityAtContact:current.velocity,
  observedVelocityDeltaMps:Math.hypot(
   current.velocity.x-prior.velocity.x,
   current.velocity.y-prior.velocity.y,
   current.velocity.z-prior.velocity.z),
  solverImpulseInferred:false,passCompleted:null,
  source:'consecutive-real-rapier-ball-state-frames'
 });

export function createProvisionalActionOutcomeObserver(fixtureId){
 if(typeof fixtureId!=='string'||!fixtureId)
  throw new TypeError('Canonical fixture identity required');
 let expectedTick=0,active=null,lastCompleted=null;
 let pendingPass=null,lastPassContact=null,lastVerifiedBallFrame=null;
 let pendingOppositionPass=null,lastOppositionPass=null;
 // C4.1b: closed same-60Hz physical defender continuation, not gameplay.
 let defenderFlights=[],lastDefenderFlight=null,completedDefenderFlights=0;
 const defenderFlightTicks=6;
 const physicalPassProjection=pass=>pass===null?null:Object.freeze({
  version:PROVISIONAL_PASS_CONTACT_VERSION,fixtureId,
  actionTick:pass.actionTick,observedThroughTick:pass.observedThroughTick,
  elapsedPhysicsTicks:pass.observedThroughTick-pass.actionTick,
  playerId:pass.playerId,team:pass.team,
  intendedRecipientId:pass.intendedRecipientId,
  target:pass.target,status:pass.status,
  firstSubsequentContact:pass.firstContact,
  passCompleted:null,interceptionConfirmed:null,
  officialMatchPossession:false,officialMatchResult:null,
  physicalContactEvidenceOnly:true
 });
 const opponentProjection=episode=>episode===null?null:Object.freeze({
  version:PROVISIONAL_PASS_CONTACT_VERSION,fixtureId,
  actionTick:episode.actionTick,playerId:episode.playerId,
  passerTeam:episode.team,
  intendedRecipientId:episode.intendedRecipientId,
  observedThroughTick:episode.observedThroughTick,
  elapsedPhysicsTicks:episode.observedThroughTick-episode.actionTick,
  status:episode.status,firstOpponentContact:episode.firstOpponentContact,
  physicalOpponentShoeEvidenceOnly:true,readOnly:true,
  passCompleted:null,interceptionConfirmed:null,tackleConfirmed:null,
  officialMatchPossession:false,officialMatchResult:null
 });
 const projected=episode=>episode===null?null:Object.freeze({
  actionTick:episode.actionTick,playerId:episode.playerId,
  team:episode.team,action:episode.action,
  intendedRecipientId:episode.intendedRecipientId,
  intendedRule:episode.intendedRule,
  observedThroughTick:episode.observedThroughTick,
  elapsedPhysicsTicks:episode.observedThroughTick-episode.actionTick,
  ballTravelSinceImpulseM:episode.ballTravelSinceImpulseM,
  opponentShoeStarts:freezeIds(episode.opponentStarts),
  intendedRecipientShoeStartObserved:episode.recipientStart,
  oppositionContactObserved:episode.opponentStarts.length>0,
  terminal:episode.observedThroughTick-episode.actionTick>=
   PROVISIONAL_ACTION_OBSERVATION_TICKS,
  physicalImpulseApplied:true,
  physicalPassAttempt:episode.action==='pass'?Object.freeze({
   source:'real-rapier-impulse-and-same-tick-live-target',
   actionTick:episode.actionTick,playerId:episode.playerId,
   recipientId:episode.intendedRecipientId,
   target:episode.passTarget,
   observedThroughTick:episode.observedThroughTick,
   physicalBallTravelM:episode.ballTravelSinceImpulseM,
   intendedRecipientShoeStartObserved:episode.recipientStart,
   passCompleted:null,officialMatchAction:false
  }):null,
  shotOnTarget:null,passCompleted:null,interceptionConfirmed:null,
  tackleConfirmed:null,goalScored:null,officialMatchPossession:false,
  officialMatchAction:false,officialMatchResult:null
 });
 return Object.freeze({
  observe({physicsTick,ballSnapshot,physicalContactFeed,localAutonomousAction,
   autonomousActionMode}){
   const ball=ballSnapshot?.ball?.position;
   const velocity=ballSnapshot?.ball?.velocity;
   const frameKinematics=velocity&&
    ['x','y','z'].every(k=>finite(velocity[k]))?
     Object.freeze({position:point(ball),velocity:point(velocity)}):null;
   if(velocity!==undefined&&!frameKinematics)
    throw new TypeError('Nonfinite Rapier ball velocity');
   const feed=physicalContactFeed;
   if(!Number.isSafeInteger(physicsTick)||physicsTick!==expectedTick||
      !ball||!['x','y','z'].every(k=>finite(ball[k]))||
      feed?.physicsTick!==physicsTick||feed.fixtureId!==fixtureId||
      !Array.isArray(feed.started)||typeof autonomousActionMode!=='boolean'||
      (!autonomousActionMode&&localAutonomousAction!==null))
    throw new TypeError('Trusted sequential Rapier fixture action evidence required');
   const action=localAutonomousAction;
   const target=action?.passTarget;
   if(action?.action==='pass'&&(
      !target||target.physicalPassAttemptOnly!==true||
      target.passCompleted!==false||target.physicsTick!==physicsTick||
      target.originPlayerId!==action.playerId||
      target.recipientId!==action.recipientId||
      target.team!==action.team||
      !['originX','originY','recipientX','recipientY','distanceM','forwardM']
       .every(k=>finite(target[k]))||
      target.distanceM<3||target.distanceM>25.000001||
      Math.abs(target.distanceM-Math.hypot(
       target.recipientX-target.originX,
       target.recipientY-target.originY))>1e-6||
      !action.impulseNs||!finite(action.impulseNs.x)||
      !finite(action.impulseNs.y)||
      (target.recipientX-target.originX)*action.impulseNs.x+
       (target.recipientY-target.originY)*action.impulseNs.y<=0
     ))throw new TypeError('Untrusted or fabricated physical pass target');
   if(action?.action!=='pass'&&target!==null&&target!==undefined)
    throw new TypeError('Non-pass action cannot advertise pass completion');
   if(action&&(
     !autonomousActionMode||action.tick!==physicsTick||
     !feed.started.some(p=>p.engineId===action.playerId&&p.team===action.team)||
     feed.started.length!==1||feed.active?.length!==1||
     feed.active[0].engineId!==action.playerId||
     feed.active[0].team!==action.team||
     action.appliedByRapier!==true||
     action.actualPhysicsImpulseApplied!==true||
     action.officialMatchAction!==false||
     !action.decisionContext||action.decisionContext.outcomeNotYetObserved!==true))
    throw new TypeError('Untrusted non-Rapier or inferred autonomous action');
   // Both physical traces use the SAME closed, authentic Rapier
   // feed. The opponent audit remains active after the first teammate
   // contact, so that a later genuine defending shoe START is visible.
   let verifiedShoeStarts=null;
   if(pendingPass||pendingOppositionPass){
    const passEpoch=pendingPass??pendingOppositionPass;
    if(physicsTick<=passEpoch.actionTick||
       feed.realFootEventsOnly!==true||
       feed.contactSource!=='same-step-real-rapier-shoe-ball-collider')
     throw new Error('Pass follow-through requires authentic later Rapier shoe starts');
    const seen=new Set();
    verifiedShoeStarts=Object.freeze(feed.started.map(foot=>{
     const validId=/^(home|away)-(?:[1-9]|10|11)$/.exec(foot?.engineId);
     if(!validId||foot.team!==validId[1]||seen.has(foot.engineId))
      throw new TypeError('Malformed or ambiguous Rapier shoe identity');
     seen.add(foot.engineId);
     return Object.freeze({physicsTick,engineId:foot.engineId,team:foot.team});
    }));
   }
   // C1.2a: first post-pass shoe START, regardless of team.
   if(pendingPass){
    const contacts=Object.freeze(verifiedShoeStarts.map(foot=>{
     const contactKind=foot.engineId===pendingPass.playerId?'passer-recontact':
       foot.team!==pendingPass.team?'opponent-shoe':
       foot.engineId===pendingPass.intendedRecipientId?
        'intended-recipient-shoe':'other-teammate-shoe';
     return Object.freeze({...foot,contactKind});
    }));
    const elapsed=physicsTick-pendingPass.actionTick;
    if(contacts.length){
     // The velocity snapshots are consecutive observed Rapier states,
     // NOT an isolated causal collision impulse or a pass-success signal.
     const ballKinematics=observedBallKinematics(
      lastVerifiedBallFrame,frameKinematics,physicsTick);
     const firstContact=Object.freeze({
      physicsTick,contacts,ballKinematics,
      kind:contacts.length===1?contacts[0].contactKind:
       'simultaneous-shoes-ambiguous',
      hasIntendedRecipient:contacts.some(c=>
       c.contactKind==='intended-recipient-shoe'),
      hasOpponent:contacts.some(c=>c.contactKind==='opponent-shoe'),
      passCompleted:null,officialMatchPossession:false
     });
     lastPassContact=physicalPassProjection({
      ...pendingPass,observedThroughTick:physicsTick,
      status:'contact-observed',firstContact
     });
     pendingPass=null;
    }else if(elapsed>=PROVISIONAL_PASS_CONTACT_MAX_TICKS){
     lastPassContact=physicalPassProjection({
      ...pendingPass,observedThroughTick:physicsTick,
      status:'expired-without-contact',firstContact:null
     });
     pendingPass=null;
    }else pendingPass={
     ...pendingPass,observedThroughTick:physicsTick
    };
   }
   // C4.1b: genuine next six real 60Hz ball samples after a rival shoe.
   // Neither a velocity change nor proximity proves a recovered ball.
   if(defenderFlights.length){
    if(!frameKinematics||feed.realFootEventsOnly!==true||
       feed.contactSource!=='same-step-real-rapier-shoe-ball-collider')
     throw new TypeError('Untrusted real physical defender flight');
    const nextFlights=[];
    for(const p of defenderFlights){
     if(physicsTick!==p.lastTick+1||p.samples.length>=defenderFlightTicks)
      throw new Error('Nonconsecutive real defender flight');
     const sample=Object.freeze({
      physicsTick,position:frameKinematics.position,
      velocity:frameKinematics.velocity,
      realShoeStarts:freezeIds(feed.started.map(x=>x.engineId))
     });
     const q={...p,lastTick:physicsTick,
      path3DM:p.path3DM+
       observeDistance(frameKinematics.position,p.previousPosition),
      velocityDeltaSumMps:p.velocityDeltaSumMps+
       observeDistance(frameKinematics.velocity,p.previousVelocity),
      previousPosition:frameKinematics.position,
      previousVelocity:frameKinematics.velocity,
      samples:[...p.samples,sample]};
     if(q.samples.length===defenderFlightTicks){
      completedDefenderFlights++;
      lastDefenderFlight=Object.freeze({
       fixtureId,sourcePassTick:q.sourcePassTick,
       passerTeam:q.passerTeam,contactTick:q.contactTick,
       defenderIds:q.defenderIds,
       observedThroughTick:physicsTick,
       samples:Object.freeze(q.samples),sampledFrames:defenderFlightTicks,
       path3DM:q.path3DM,velocityDeltaSumMps:q.velocityDeltaSumMps,
       physicalEvidenceOnly:true,isolatedShoeImpulseProven:false,
       interceptionConfirmed:null,tackleConfirmed:null,
       passCompleted:null,officialMatchPossession:false,
       officialMatchResult:null
      });
     }else nextFlights.push(q);
    }
    defenderFlights=nextFlights;
   }
   // C1.2c: independent later opponent shoe START, even if a genuine
   // teammate already reached the ball first. No claimed interception.
   if(pendingOppositionPass){
    const opponents=Object.freeze(verifiedShoeStarts.filter(
     foot=>foot.team!==pendingOppositionPass.team).map(foot=>
     Object.freeze({...foot,contactKind:'opponent-shoe'})));
    const elapsed=physicsTick-pendingOppositionPass.actionTick;
    if(opponents.length){
     lastOppositionPass={
      ...pendingOppositionPass,observedThroughTick:physicsTick,
      status:'opponent-contact-observed',
      firstOpponentContact:Object.freeze({
       physicsTick,contacts:opponents,
       ballKinematics:observedBallKinematics(
        lastVerifiedBallFrame,frameKinematics,physicsTick),
       simultaneousShoesAmbiguous:verifiedShoeStarts.length>1,
       interceptionConfirmed:null,tackleConfirmed:null,
       passCompleted:null,officialMatchPossession:false
      })
     };
     pendingOppositionPass=null;
     // C1 synthetic contract vectors omit measured ball velocity, so
     // they may describe a *contact kind* but must NEVER open C4.1b
     // real post-defender physical flight. The sealed real fixture does
     // provide both 3D ball velocity and same-tick shoe START+ACTIVE.
     if(frameKinematics&&feed.realFootEventsOnly===true&&
        feed.contactSource==='same-step-real-rapier-shoe-ball-collider'&&
        Array.isArray(feed.active)&&
        opponents.every(shoe=>feed.active.some(x=>
         x.engineId===shoe.engineId&&x.team===shoe.team))){
      defenderFlights.push({
       sourcePassTick:lastOppositionPass.actionTick,
       passerTeam:lastOppositionPass.team,
       contactTick:physicsTick,lastTick:physicsTick,
       defenderIds:freezeIds(opponents.map(x=>x.engineId)),
       previousPosition:frameKinematics.position,
       previousVelocity:frameKinematics.velocity,
       samples:[],path3DM:0,velocityDeltaSumMps:0
      });
      if(defenderFlights.length>32)
       throw new Error('Too many overlapping genuine defender flights');
     }
    }else if(elapsed>=PROVISIONAL_PASS_CONTACT_MAX_TICKS){
     lastOppositionPass={
      ...pendingOppositionPass,observedThroughTick:physicsTick,
      status:'expired-without-opponent-contact',firstOpponentContact:null
     };
     pendingOppositionPass=null;
    }else pendingOppositionPass={
     ...pendingOppositionPass,observedThroughTick:physicsTick
    };
   }
   if(active){
    if(physicsTick<=active.actionTick)
     throw new Error('Action aftermath must follow the actual impulse tick');
    active.observedThroughTick=physicsTick;
    active.ballTravelSinceImpulseM=observeDistance(active.ballAtAction,ball);
    for(const foot of feed.started){
     if(foot.team!==active.team)active.opponentStarts.push(foot.engineId);
     if(foot.engineId===active.intendedRecipientId)active.recipientStart=true;
    }
    if(physicsTick-active.actionTick>=PROVISIONAL_ACTION_OBSERVATION_TICKS){
     lastCompleted=projected(active);active=null;
    }
   }
   if(action){
    if(active)throw new Error('Overlapping real action observation windows');
    active={
     actionTick:physicsTick,playerId:action.playerId,
     team:action.team,action:action.action,
     intendedRecipientId:action.recipientId,
     intendedRule:action.decisionContext.rule,
     passTarget:target??null,
     ballAtAction:point(ball),observedThroughTick:physicsTick,
     ballTravelSinceImpulseM:0,opponentStarts:[],recipientStart:false
    };
   }
   if(action?.action==='pass'){
    // The target was frozen at the exact on-ball Rapier impulse tick.
    // Track only a future shoe START, never force the recipient to touch.
    pendingPass={
     actionTick:physicsTick,observedThroughTick:physicsTick,
     playerId:action.playerId,team:action.team,
     intendedRecipientId:action.recipientId,target:action.passTarget,
     status:'observing',firstContact:null
    };
    pendingOppositionPass={
     actionTick:physicsTick,observedThroughTick:physicsTick,
     playerId:action.playerId,team:action.team,
     intendedRecipientId:action.recipientId,
     status:'observing',firstOpponentContact:null
    };
   }
   // Keep only observed frame data; never use future velocity or
   // force a contact on a particular player.
   lastVerifiedBallFrame=frameKinematics;
   expectedTick++;
   return Object.freeze({
    version:PROVISIONAL_ACTION_OUTCOME_VERSION,physicsTick,fixtureId,
    source:'observed-rapier-ball-positions-and-real-shoe-starts',
    observationWindowTicks:PROVISIONAL_ACTION_OBSERVATION_TICKS,
    latestExecutedAction:action,
    active:projected(active),lastCompleted,
    physicalPassFollowThrough:Object.freeze({
     version:PROVISIONAL_PASS_CONTACT_VERSION,
     fixtureId,physicsTick,
     maxObservationTicks:PROVISIONAL_PASS_CONTACT_MAX_TICKS,
     active:physicalPassProjection(pendingPass),
     lastResolved:lastPassContact,
     opponentChallenge:Object.freeze({
      active:opponentProjection(pendingOppositionPass),
      lastResolved:opponentProjection(lastOppositionPass),
      defenderFlight:Object.freeze({
       observationTicks:defenderFlightTicks,
       pendingCount:defenderFlights.length,
       completedCount:completedDefenderFlights,
       lastCompleted:lastDefenderFlight,
       readOnly:true,physicalEvidenceOnly:true,
       isolatedShoeImpulseProven:false,
       interceptionConfirmed:null,tackleConfirmed:null,
       passCompleted:null,officialMatchPossession:false,
       officialMatchResult:null
      }),
      readOnly:true,authenticShoeStartsOnly:true,
      interceptionConfirmed:null,tackleConfirmed:null,
      passCompleted:null,officialMatchPossession:false,
      officialMatchResult:null
     }),
     readOnly:true,authenticShoeStartsOnly:true,
     passCompleted:null,officialMatchPossession:false,
     officialMatchResult:null
    }),
    ballMotionObserved:active!==null||lastCompleted!==null,
    authenticContactsOnly:true,readOnly:true,
    physicalActionExecutionProven:action!==null,
    actionSuccessAdjudicated:false,
    officialMatchPossession:false,officialMatchAction:false,
    officialGoalEvidence:false,officialMatchResult:null,
    productionScoringConnected:false
   });
  }
 });
}
