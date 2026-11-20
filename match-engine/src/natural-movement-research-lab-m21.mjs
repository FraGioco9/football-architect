// #628 M21: playable original M14-M20 native movement scenarios.
// Unchanged 22 player sources, one genuine shared Rapier body/shoe queue.
import {createEngine,FIXED_DT} from './core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS,PLAYER_MAX_SPEED_MPS,
 PLAYER_MIN_SEPARATION_M} from './player-movement.mjs';
import {validateFootContactFrame,initialFootPositions}
 from './player-foot-contact.mjs';

const freeze=Object.freeze,known=new Set(INITIAL_PLAYERS.map(p=>p.id));
export function createNaturalMovementResearchLab(R,scene){
 if(!R||typeof R.World!=='function'||scene?.spec?.naturalSource!==true||
    !['home','away'].includes(scene.side)||!scene.initial||
    ![scene.initial.x,scene.initial.y,scene.initial.vx,
      scene.initial.vy].every(Number.isFinite)||
    Math.hypot(scene.initial.vx,scene.initial.vy)<0.25||
    Math.hypot(scene.initial.vx,scene.initial.vy)>8)
  throw new TypeError('M21 LAB original rolling-ball source required');
 const feedback=scene.spec.feedback===true;
 const secondary=scene.spec.secondary===true;
 const engine=createEngine(R,scene.initial,{
  diagnosticPlayerBodyCollidersEnabled:true,
  diagnosticPlayerFootContactsEnabled:true,
  diagnosticSharedContactEventsEnabled:true,
  diagnosticInitialRollFraction:1,
  ...(feedback?{diagnosticUnstagedBodyFeedbackEnabled:true}:{})
 });
 const mover=createPlayerMovement({
  researchOpposingPressConvergence:true,
  ...(feedback?{researchUnstagedNativeBodyFeedback:true,
    researchShoeBodyHandoff:true}:{}),
  ...(secondary?{researchSecondaryPressSupport:true}:{})
 });
 let disposed=false,latest=null,lastFoot=initialFootPositions();
 let starts=0,ends=0,shoes=0,responses=0,firstGenuineMultiPair=null;
 const active=new Set();
 function record(physical,frame,native,queue){
  if(physical.tick!==frame.tick||native.tick!==frame.tick||
     queue.tick!==frame.tick||frame.players.length!==22||
     native.physicalActors.length!==22||
     native.sameOriginalRapierBallWorld!==true||
     native.controlledEncounter!==false||
     native.unstagedFeedbackEnabled!==feedback||
     native.collisionColliderRadiusM!==PLAYER_MIN_SEPARATION_M/2||
     !queue.oneNativeRapierWorld||!queue.oneNativeEventQueue||
     queue.genuineBodyStarts!==native.currentTickStarts||
     queue.officialMatchAction!==false||
     native.physicallyAuthoritativeMatchWorld!==false||
     (feedback&&frame.shoeBodyHandoff?.preSolverNativeShoes!==true)||
     (secondary&&!frame.secondaryPressSupport))
   throw new Error('M21 only original shared 22-body Rapier source');
  let minGap=Infinity;
  for(let i=0;i<22;i++){
   const p=frame.players[i],q=native.physicalActors[i],original=INITIAL_PLAYERS[i];
   if(p.id!==original.id||p.team!==original.team||q.id!==p.id||
      Math.hypot(p.vx,p.vy)>PLAYER_MAX_SPEED_MPS+1e-7)
    throw new Error('M21 canonical player identity or speed');
   for(let j=i+1;j<22;j++)
    minGap=Math.min(minGap,Math.hypot(
     p.x-frame.players[j].x,p.y-frame.players[j].y));
  }
  if(minGap<PLAYER_MIN_SEPARATION_M-1e-8)
   throw new Error('M21 original 0.98m clearance violated');
  const transitions=native.events.filter(e=>e.tick===frame.tick&&
   ['rapier-body-start','rapier-body-end'].includes(e.type));
  let s=0,e=0;
  for(const event of transitions){
   const ids=event.pair?.split('|')??[];
   if(event.source!=='native-rapier-collision-event'||ids.length!==2||
      ids[0]>=ids[1]||!ids.every(id=>known.has(id)))
    throw new Error('M21 cannot fake native pair');
   if(event.type==='rapier-body-start'){
    if(active.has(event.pair))throw new Error('M21 duplicate native START');
    active.add(event.pair);s++;
   }else{
    if(!active.delete(event.pair))throw new Error('M21 unknown native END');
    e++;
   }
  }
  starts+=s;ends+=e;
  if(s!==native.currentTickStarts||e!==native.currentTickEnds||
     starts!==native.actualNativeStarts||ends!==native.actualNativeEnds||
     JSON.stringify([...active].sort())!==JSON.stringify(native.activePairs))
   throw new Error('M21 actual native START/END ledger mismatch');
  if(active.size>=2&&!firstGenuineMultiPair)
   firstGenuineMultiPair=freeze({tick:frame.tick,
    pairs:freeze([...active].sort())});
  const support=secondary?frame.secondaryPressSupport[scene.side]:null;
  const focusId=support?.playerId??frame.pressers[scene.side]??scene.focusId;
  latest=freeze({
   scenarioId:scene.spec.id,side:scene.side,focusId,
   tick:frame.tick,timeS:frame.tick*FIXED_DT,
   ball:physical.ball,players:frame.players,
   readout:freeze({
    naturalSource:true,feedbackEnabled:feedback,secondaryEnabled:secondary,
    primaryPressId:frame.pressers[scene.side],
    secondaryPlayerId:support?.playerId??null,
    secondaryOpponentId:support?.opponentId??null,
    currentOpposingContest:Boolean(frame.originalOpposingPressConvergence?.active),
    nativeBodyStarts:starts,nativeBodyEnds:ends,
    activeNativeBodyPairs:freeze([...active].sort()),
    nativeShoeStarts:shoes,nativeFeedbackResponses:responses,
    minimumCanonicalGapM:minGap,firstGenuineMultiPair
   }),
   readOnly:true,verifiedFootContact:false,officialMatchAction:false,
   officialPossession:false,officialMatchResult:null
  });
  return latest;
 }
 function snapshot(){
  if(disposed)throw new Error('M21 disposed');
  return latest;
 }
 function step(){
  if(disposed)throw new Error('M21 disposed');
  const before=mover.snapshot();
  const frame=mover.step(engine.snapshot().ball.position);
  for(let i=0;i<22;i++){
   const p=frame.players[i],prev=before.players[i];
   if(Math.abs(p.x-prev.x-p.vx*FIXED_DT)>1e-6||
      Math.abs(p.y-prev.y-p.vy*FIXED_DT)>1e-6)
    throw new Error('M21 original mover displacement mismatch');
  }
  const nextFoot=validateFootContactFrame(frame,frame.tick,lastFoot);
  const physical=engine.step(frame);
  lastFoot=nextFoot;
  const native=engine.nativePlayerBodySnapshot();
  const queue=engine.sharedNativeContactSnapshot();
  shoes+=queue.genuineFootStarts.length;
  let observed=frame;
  if(feedback){
   const accepted=mover.reconcileUnstagedNativeBodyResponse(native);
   observed=mover.snapshot();
   const acknowledge=engine.acknowledgeNativePlayerResponse(observed);
   if(acknowledge.tick!==physical.tick||
      acknowledge.appliedMoverResponses!==observed.actualNativeResponseCount)
    throw new Error('M21 only same-tick original Rapier correction');
   if(accepted.accepted)responses++;
  }else if(observed.actualNativeResponseCount!==undefined)
   throw new Error('M21 observer may not apply feedback');
  return record(physical,observed,native,queue);
 }
 function dispose(){if(!disposed){disposed=true;engine.dispose();}}
 try{record(engine.snapshot(),mover.snapshot(),
  engine.nativePlayerBodySnapshot(),engine.sharedNativeContactSnapshot());}
 catch(err){dispose();throw err;}
 return freeze({scene,snapshot,step,dispose});
}
