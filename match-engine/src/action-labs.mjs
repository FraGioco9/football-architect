// #620 — controlled actions on the CLEAN canonical same-world Rapier core.
// No legacy universal match session, opponent-lane tactical simulator or fake
// action event. Exactly one core engine and one existing 22-player mover.
import {createEngine,FIXED_DT} from './core.mjs';
import {createPhysicalFootballDecisionObserver}
 from './physical-football-decision-evidence-m23.mjs';
import {createRealPostContactBallContinuity}
 from './real-post-contact-ball-continuity-m24.mjs';
import {createRealPressuredFirstTouchObserver}
 from './real-pressured-first-touch-m26.mjs';
import {createPlayerMovement} from './player-movement.mjs';
import {drawPitchMarkings} from './pitch-markings.mjs';
import {inspectUniformPolicyGeometry} from './player-ball-uniform-autonomous-action.mjs';
import {ACTION_LAB_SCENARIOS,SHOT_LAB_STARTS,CARRY_LAB_STARTS,
 CHALLENGE_LAB_STARTS,CONTROL_LAB_STARTS,
 getActionLabScenario,classifyActionLabEvidence} from './action-lab-scenarios.mjs';

export function createControlledActionLab(RAPIER,id,{
 shotSide='home',shotLane='open',carrySide='home',controlScene='receive',
 controlSide='home',
 challengeSide='away',challengeScene='contact'
}={}){
 if(!RAPIER||typeof RAPIER.World!=='function')
  throw new TypeError('Rapier required for real Action LAB');
 const spec=getActionLabScenario(id);
 if(!['home','away'].includes(shotSide)||
    !['home','away'].includes(carrySide)||
    !['open','blocked'].includes(shotLane)||
    !['receive','receive-cushion','receive-pressure','opponent-first'].includes(controlScene)||
    !['home','away'].includes(controlSide)||
    (id!=='control'&&controlSide!=='home')||
    (controlScene==='opponent-first'&&controlSide!=='home')||
    !['home','away'].includes(challengeSide)||
    !['contact','no-contact'].includes(challengeScene)||
    (id!=='challenge'&&(challengeSide!=='away'||challengeScene!=='contact'))||
    (id!=='shot'&&(shotSide!=='home'||shotLane!=='open'))||
    (id!=='carry'&&carrySide!=='home')||
    (id!=='control'&&controlScene!=='receive'))
  throw new TypeError('Only bounded SHOT, CARRY or CONTROL scenes supported');
 const selectedControlSide=spec.mode==='control'?controlSide:null;
 const selectedShotSide=id==='shot'?shotSide:null;
 const selectedCarrySide=id==='carry'?carrySide:null;
 const selectedChallengeSide=id==='challenge'?challengeSide:null;
 const initial=selectedShotSide?SHOT_LAB_STARTS[selectedShotSide]:
  selectedCarrySide?CARRY_LAB_STARTS[selectedCarrySide]:
  selectedControlSide?CONTROL_LAB_STARTS[selectedControlSide]:
  selectedChallengeSide?(challengeScene==='no-contact'?
   CHALLENGE_LAB_STARTS.noContact:CHALLENGE_LAB_STARTS[selectedChallengeSide]):
   spec.initial;
 const blocked=selectedShotSide!==null&&shotLane==='blocked';
 const opposingControl=id==='control'&&controlScene==='opponent-first';
 const firstTouchCushion=id==='control'&&
  ['receive-cushion','receive-pressure'].includes(controlScene);
 const closePressure=id==='control'&&controlScene==='receive-pressure';
 const focus=opposingControl?
  Object.freeze(['home-10','home-9','away-7']):
  closePressure?Object.freeze(selectedControlSide==='home'?
   ['home-10','home-9','away-7']:['away-10','away-9','home-7']):
  selectedControlSide==='away'?
   Object.freeze(['away-10','away-9','home-10']):
  selectedChallengeSide==='home'?
   Object.freeze(['home-10','home-9','away-10']):
  selectedChallengeSide==='away'?
   Object.freeze(['away-10','away-9','home-10']):
  blocked?Object.freeze(selectedShotSide==='home'?
  ['home-10','away-2','away-1']:['away-10','home-2','home-1']):
  selectedShotSide==='away'?
   Object.freeze(['away-10','home-1','home-10']):
  selectedCarrySide==='away'?
   Object.freeze(['away-10','away-9','away-11','home-9','home-11']):
   spec.focus;
 // The same physical authority produces shoe START and applies the original
 // action impulse; diagnostic flags remain explicit and DEV-local.
 const engine=createEngine(RAPIER,initial,{
  diagnosticPlayerFootContactsEnabled:true,
  diagnosticAutonomousFixtureActionEnabled:true,
  ...(selectedShotSide?{diagnosticResearchShotAttacker:selectedShotSide}:{}),
  ...(blocked?{diagnosticResearchShotBlockedLane:true}:{}),
  ...(spec.mode==='control'?{
   diagnosticResearchControlReceiver:true,
   diagnosticResearchControlSide:selectedControlSide,
   ...(firstTouchCushion?{diagnosticResearchReceivingCushionEnabled:true}:{}),
   ...(closePressure?{diagnosticResearchControlCloseDefender:true}:{})
  }:{}),
  ...(opposingControl?{diagnosticResearchControlOpponentFirst:true}:{}),
  ...(selectedCarrySide?{diagnosticResearchCarrySide:selectedCarrySide}:{}),
  ...(spec.mode==='carry'?{diagnosticAutonomousCarryEnabled:true}:{})
 });
 const mover=createPlayerMovement(selectedShotSide?{
  researchShotAttacker:selectedShotSide,researchShotBall:initial,
  ...(blocked?{researchShotBlockedLane:true}:{})
 }:spec.mode==='control'?{
  researchControlReceiver:true,researchControlBall:initial,
  researchControlSide:selectedControlSide,
  ...(opposingControl?{researchControlOpponentFirst:true}:{}),
  ...(closePressure?{researchControlCloseDefender:true}:{})
 }:selectedCarrySide?{
  researchCarrySide:selectedCarrySide,researchCarryBall:initial
 }:{});
 let firstPhysicalPassAction=null;
 let disposed=false,firstRealPass=null,count=0,history=Object.freeze([]);
 let shotTrace=null,blockedShotObservation=null,receivingContact=null;
 let firstOpposingShoe=null,carryTrace=null;
 // One read-only observer of the original closed Rapier shoe/ball source.
 const decisionObserver=createPhysicalFootballDecisionObserver();
 const continuityObserver=createRealPostContactBallContinuity();
 const pressureObserver=firstTouchCushion?
  createRealPressuredFirstTouchObserver():null;
 function record(physics,playerFrame){
  const foot=engine.footContactSnapshot();
  const starts=Object.freeze([...foot.started]);
  if(foot.tick!==physics.tick||playerFrame.tick!==physics.tick)
   throw new Error('Only genuine same-tick Rapier and canonical mover allowed');
  const raw=engine.uniformAutonomousActionSnapshot();
  const action=raw?.tick===physics.tick?raw:null;
  // Only a genuine post-pass Rapier opponent shoe START is negative evidence.
  // Neither nearby player positions nor a guessed interception suffice.
  const opposingStart=spec.mode==='control'&&firstRealPass?
   starts.find(id=>id.startsWith(
    selectedControlSide==='home'?'away-':'home-')):null;
  if(opposingStart&&!firstOpposingShoe)
   firstOpposingShoe=Object.freeze({
    tick:physics.tick,playerId:opposingStart,
    passingTick:firstRealPass.tick,realShoeStart:true,
    officialInterception:false,tackleConfirmed:null
   });
  const evidence=classifyActionLabEvidence(spec,{
   tick:physics.tick,action,starts,priorPass:firstRealPass,
   opponentEarlier:firstOpposingShoe!==null,
   challengeSide:selectedChallengeSide??'away'
  });
  // Observe the original unmodified three-lane geometry ONLY after
  // the real single Rapier shooter START on this exact physics tick.
  if(blocked&&starts.length===1&&
     starts[0]===selectedShotSide+'-10'&&physics.tick>0){
   const geometry=inspectUniformPolicyGeometry({
    tick:physics.tick,playerId:starts[0],
    ballPosition:physics.ball.position,
    physicalPlayerPositions:Object.freeze(playerFrame.players.map(p=>
     Object.freeze({engineId:p.id,team:p.team,role:p.role,x:p.x,y:p.y})))
   });
   if(geometry.shotRange&&!geometry.shotLaneFound&&
      action?.action!=='shot')
    blockedShotObservation=Object.freeze({
     tick:physics.tick,playerId:starts[0],
     policyGeometry:geometry,actionType:action?.action??null,
     realShoeStart:true,officialGoal:false
    });
  }
  if(spec.mode==='control'&&evidence.verifiedReceivingShoeContact&&
     receivingContact===null)
   receivingContact=Object.freeze({
    tick:physics.tick,recipientId:starts[0],
    passingPlayerId:firstRealPass.playerId,
    passingTick:firstRealPass.tick,
    realShoeStart:true,officialPossession:false,passCompleted:false
   });
  if(evidence.witnessed){
   count++;
   history=Object.freeze([...history,Object.freeze({
    tick:physics.tick,kind:spec.goal,
    actorId:action?.playerId??starts[0]??null
   })].slice(-12));
  }
  // Post-impulse ball centres from the single Rapier engine, not a
  // predicted trajectory or inferred official goal.
  const p=physics.ball.position;
  if(action?.action==='shot'&&evidence.verifiedShoeImpulse){
   shotTrace=Object.freeze({
    shooterId:action.playerId,team:action.team,tick:physics.tick,
    origin:Object.freeze({...p}),last:Object.freeze({...p}),
    samples:1,path3DM:0,maxCenterZM:p.z,observed3DFlight:false
   });
  }else if(shotTrace){
   const prev=shotTrace.last;
   const travelled=Math.hypot(p.x-prev.x,p.y-prev.y,p.z-prev.z);
   const maxZ=Math.max(shotTrace.maxCenterZM,p.z);
   shotTrace=Object.freeze({
    ...shotTrace,last:Object.freeze({...p}),
    samples:shotTrace.samples+1,path3DM:shotTrace.path3DM+travelled,
    maxCenterZM:maxZ,
    observed3DFlight:maxZ>shotTrace.origin.z+0.02
   });
  }
  // Carry is a single observed Rapier impulse plus ball motion after it,
  // not a trap, multi-touch success or virtual dribble.
  if(action?.action==='carry'&&evidence.verifiedShoeImpulse&&!carryTrace){
   carryTrace=Object.freeze({
    tick:physics.tick,actorId:action.playerId,team:action.team,
    origin:Object.freeze({...p}),last:Object.freeze({...p}),
    path2DM:0,samples:1,groundedSamples:p.z<=0.15?1:0,
    observedGroundMotion:false,endedByOtherAction:false,
    officialPossession:false,dribbleConfirmed:null
   });
  }else if(carryTrace&&!carryTrace.endedByOtherAction){
   if(action&&physics.tick!==carryTrace.tick){
    carryTrace=Object.freeze({...carryTrace,endedByOtherAction:true});
   }else{
    const travelled=Math.hypot(p.x-carryTrace.last.x,
     p.y-carryTrace.last.y);
    const distance=carryTrace.path2DM+travelled;
    const grounded=carryTrace.groundedSamples+(p.z<=0.15?1:0);
    carryTrace=Object.freeze({
     ...carryTrace,last:Object.freeze({...p}),
     path2DM:distance,samples:carryTrace.samples+1,
     groundedSamples:grounded,
     observedGroundMotion:distance>0.15&&grounded>=2
    });
   }
  }
  if(action?.action==='pass'&&!firstRealPass&&
     starts.length===1&&starts[0]===action.playerId&&
     action.appliedByRapier===true&&
     action.actualPhysicsImpulseApplied===true&&
     (spec.mode!=='control'||(
      action.playerId===selectedControlSide+'-10'&&
      action.team===selectedControlSide&&
      action.passTarget?.recipientId===selectedControlSide+'-9'))){
   firstRealPass=Object.freeze({
    tick:physics.tick,playerId:action.playerId,
    team:action.team,recipientId:action.passTarget?.recipientId??null,
    physicalImpulseApplied:true
   });
   firstPhysicalPassAction=action;
  }
  // Only the closed one-World Action LAB supplies these same-tick samples.
  // No new impulse, tackle, reception or possession is authorized.
  const decisionEvidence=decisionObserver.observe({
   physics,playerFrame,foot,action
  });
  const physicalFirstTouch=engine.researchReceivingCushionSnapshot();
  const pressureEvidence=pressureObserver?.observe({
   physics,playerFrame,foot,physicalFirstTouch
  })??null;
  const contactContinuity=continuityObserver.observe({
   physics,playerFrame,foot,decisionEvidence
  });
  return Object.freeze({
   scenarioId:id,shotSide:selectedShotSide,shotLane:selectedShotSide?shotLane:null,
   challengeSide:selectedChallengeSide,
   challengeScene:selectedChallengeSide?challengeScene:null,
   physicsTick:physics.tick,timeS:physics.tick*FIXED_DT,
   ball:physics.ball,
   players:Object.freeze(playerFrame.players.map(p=>Object.freeze({
    id:p.id,team:p.team,x:p.x,y:p.y
   }))),
   // M3 read-only canonical motion samples: no second mover or guessed
   // velocity and no authority outside the existing closed Action LAB.
   observedMovementPlayers:playerFrame.players,
   starts,action,evidence,decisionEvidence,contactContinuity,
   ...(firstTouchCushion?{physicalFirstTouch,pressureEvidence}:{}),
   eventCount:count,events:history,
   shotFlight:shotTrace,blockedShotObservation,
   carryTrace,carrySide:selectedCarrySide,
   priorRealPass:firstRealPass,receivingContact,
   firstOpposingShoe,controlScene:spec.mode==='control'?controlScene:null,
   controlSide:selectedControlSide,
   officialMatchResult:null,officialMatchPossession:false,
   scoreChanged:false,readOnlyEvidence:true
  });
 }
 let latest=record(engine.snapshot(),mover.snapshot());
 function snapshot(){if(disposed)throw new Error('Action LAB disposed');return latest;}
 function step(){
  if(disposed)throw new Error('Action LAB disposed');
  const prior=engine.snapshot();
  const frame=mover.step(prior.ball.position,
   spec.mode==='control'?firstPhysicalPassAction:null);
  const after=engine.step(frame);
  if(after.tick!==prior.tick+1||frame.tick!==after.tick)
   throw new Error('Action LAB must preserve real canonical 60Hz ticks');
  latest=record(after,frame);
  return latest;
 }
 function dispose(){if(!disposed){disposed=true;engine.dispose();}}
 return Object.freeze({spec,focus,shotSide:selectedShotSide,
  shotLane:selectedShotSide?shotLane:null,
  carrySide:selectedCarrySide,
  controlScene:spec.mode==='control'?controlScene:null,
  controlSide:selectedControlSide,
  challengeSide:selectedChallengeSide,
  challengeScene:selectedChallengeSide?challengeScene:null,
  snapshot,step,dispose});
}
const label=id=>id.replace('home-','Home #').replace('away-','Away #');
const number=n=>Number(n).toFixed(2);

// The UI is mounted once, no duplicated buttons or AI panels per action.
export function mountControlledActionLabs({getRapier,onOpen,onClose}){
 const by=id=>document.getElementById(id);
 const dialog=by('action-labs-dialog'),select=by('action-labs-choice');
 const shotSide=by('action-labs-shot-side'),
  shotSideLabel=by('action-labs-shot-side-label'),
  shotLaneChoice=by('action-labs-shot-lane'),
  shotLaneLabel=by('action-labs-shot-lane-label'),
  controlSceneChoice=by('action-labs-control-scene'),
  controlSceneLabel=by('action-labs-control-scene-label'),
  challengeSceneChoice=by('action-labs-challenge-scene'),
  challengeSceneLabel=by('action-labs-challenge-scene-label');
 const canvas=by('action-labs-pitch'),status=by('action-labs-status');
 const summary=by('action-labs-readout'),description=by('action-labs-description');
 const go=by('action-labs-play'),pause=by('action-labs-pause');
 const step=by('action-labs-step'),reset=by('action-labs-reset');
 if(!dialog||!select||!shotSide||!shotSideLabel||!shotLaneChoice||
    !shotLaneLabel||!controlSceneChoice||!controlSceneLabel||
    !challengeSceneChoice||!challengeSceneLabel||
    !canvas||!status||!summary||!description||
    !go||!pause||!step||!reset||
    !by('action-labs-open')||!by('action-labs-close'))
  throw new Error('Action LAB controls are missing');
 if(select.options.length!==ACTION_LAB_SCENARIOS.length||
    ACTION_LAB_SCENARIOS.some((s,i)=>select.options[i].value!==s.id))
  throw new Error('Action LAB menu must match the single scenario catalog');
 let session=null,playing=false,lastTime=0,accumulator=0;
 let trail=[];
 function stop(){playing=false;go.disabled=false;pause.disabled=true;}
 function draw(frame){
  const ctx=canvas.getContext('2d');
  const {X,Y}=drawPitchMarkings(ctx,canvas.width,canvas.height);
  ctx.beginPath();
  for(let i=0;i<trail.length;i++){
   const p=trail[i];
   if(!i)ctx.moveTo(X(p.x),Y(p.y));else ctx.lineTo(X(p.x),Y(p.y));
  }
  ctx.lineWidth=2.2;ctx.strokeStyle='#ffdf88';ctx.stroke();
  const selected=new Set(session.focus);
  for(const p of frame.players){
   if(!selected.has(p.id))continue; // keep the controlled scenario compact
   ctx.beginPath();ctx.arc(X(p.x),Y(p.y),8,0,Math.PI*2);
   ctx.fillStyle=p.team==='home'?'#a8dfff':'#ffb39a';
   ctx.fill();ctx.lineWidth=1.5;ctx.strokeStyle='#173b33';ctx.stroke();
   ctx.fillStyle='#102d2e';ctx.textAlign='center';
   ctx.textBaseline='middle';ctx.font='bold 9px system-ui';
   ctx.fillText(p.id.split('-')[1],X(p.x),Y(p.y));
  }
  const p=frame.ball.position;
  ctx.beginPath();ctx.arc(X(p.x),Y(p.y),7.5,0,Math.PI*2);
  ctx.fillStyle='#ffffff';ctx.fill();ctx.strokeStyle='#142b2a';
  ctx.lineWidth=2;ctx.stroke();
 }
 function render(){
  if(!session)return;
  const snap=session.snapshot();
  const ball=snap.ball.position;
  draw(snap);
  summary.textContent='Tick '+snap.physicsTick+' · '+
   number(snap.timeS)+' s · Ball ('+[ball.x,ball.y,ball.z].map(number).join(', ')+
   ') m · Real shoe STARTs '+snap.starts.length+' · Witnesses '+snap.eventCount+
   (snap.decisionEvidence.current.kind!=='none'?
    ' · Physical candidate '+snap.decisionEvidence.current.kind:'')+
   (snap.physicalFirstTouch?
    ' · Real first-touch cushion '+number(Math.hypot(
     snap.physicalFirstTouch.impulseNs.x,
     snap.physicalFirstTouch.impulseNs.y))+' Ns'+
    ' · pressure '+number(snap.physicalFirstTouch.measuredNearestOpponentM)+' m':'')+
   (snap.pressureEvidence?.active?
    ' · Live defender '+number(snap.pressureEvidence.active.lastRealOpponentGapM)+
    ' m · ball gap '+number(snap.pressureEvidence.active.finalBallGapM)+
    ' m · genuine recontacts '+
    snap.pressureEvidence.active.genuineSameReceiverRecontacts:
    snap.pressureEvidence?.completed?
    ' · Defended observation '+snap.pressureEvidence.completed.observedTicks+
    ' ticks · closest opponent '+
    number(snap.pressureEvidence.completed.minimumRealOpponentGapM)+' m'+
    ' · genuine recontacts '+
    snap.pressureEvidence.completed.genuineSameReceiverRecontacts:'')+
   (snap.contactContinuity.active?
    ' · Post-contact '+snap.contactContinuity.active.observedTicks+
    '/60 actual ticks · ball travel '+
    number(snap.contactContinuity.active.cumulativeBallTravelXYM)+' m':
    snap.contactContinuity.latestCompleted?
    ' · Last post-contact: '+
    snap.contactContinuity.latestCompleted.observedTicks+
    ' measured ticks · no proven control':'')+
   (snap.shotFlight?' · SHOT '+snap.shotFlight.team.toUpperCase()+
    ' · 3D path '+number(snap.shotFlight.path3DM)+' m'+
    ' · peak centre Z '+number(snap.shotFlight.maxCenterZM)+' m':'')+
   (snap.blockedShotObservation?' · All three SHOT lanes blocked':'')+
   (session.spec.goal==='control'&&snap.priorRealPass?
    ' · Physical PASS tick '+snap.priorRealPass.tick+
    ' → intended '+label(snap.priorRealPass.recipientId):'')+
   (snap.receivingContact?' · Real receiving shoe START tick '+
    snap.receivingContact.tick:'')+
   (snap.firstOpposingShoe?' · Opposing shoe START tick '+
    snap.firstOpposingShoe.tick+' · no verified reception':'')+
   (snap.carryTrace?' · CARRY '+snap.carryTrace.team.toUpperCase()+
    ' · observed ground path '+number(snap.carryTrace.path2DM)+' m':'');
  if(snap.physicalFirstTouch){
   status.textContent='Research: real receiving shoe START → bounded physical first-touch impulse; ball control and possession NOT confirmed.';
  }else if(snap.shotFlight?.observed3DFlight){
   status.textContent='Verified '+snap.shotFlight.team.toUpperCase()+
    ' SHOT: exclusive shoe START + real Rapier impulse; observed 3D flight ('+
    snap.shotFlight.samples+' physical samples). No goal awarded.';
  }else if(snap.carryTrace?.observedGroundMotion){
   status.textContent='Verified '+snap.carryTrace.team.toUpperCase()+
    ' CARRY: exclusive real Rapier shoe START and original ground-touch impulse; observed '+
    number(snap.carryTrace.path2DM)+' m ball motion. Dribble and possession unconfirmed.';
  }else if(snap.blockedShotObservation){
   status.textContent='Observed: genuine '+snap.shotSide.toUpperCase()+
    ' shoe START; original policy finds no open SHOT lane. No shot or goal awarded.';
  }else if(snap.evidence.witnessed){
   const kind=session.spec.goal;
   status.textContent=kind==='shot'?
    'Verified: genuine Rapier shoe START + SHOT impulse. No goal awarded.':
    kind==='pass'?
     'Verified: genuine Rapier shoe START + PASS impulse. Reception not assumed.':
    kind==='carry'?
     'Verified: genuine Rapier shoe START + CARRY impulse. Dribble unconfirmed.':
    kind==='control'?
     'Observed: separate teammate shoe-ball contact after real pass. No official possession.':
     'Observed: actual '+snap.challengeSide.toUpperCase()+
      ' shoe-ball START; no successful tackle or interception claimed.';
  }else if(session.spec.goal==='control'&&snap.receivingContact){
   status.textContent='Observed: separate teammate shoe-ball contact after real pass. No official possession.';
  }else if(session.spec.goal==='control'&&snap.firstOpposingShoe){
   status.textContent='Observed: genuine '+label(snap.firstOpposingShoe.playerId)+
    ' shoe-ball START before intended '+label(snap.priorRealPass.recipientId)+
    '. No verified reception, tackle or interception.';
  }else if(session.spec.goal==='control'&&snap.priorRealPass){
   status.textContent='Observed: genuine '+label(snap.priorRealPass.playerId)+
    ' PASS; awaiting authentic '+label(snap.priorRealPass.recipientId)+
    ' shoe-ball START. No possession awarded.';
  }else if(snap.eventCount===0&&snap.physicsTick>0){
   status.textContent='No '+session.spec.goal+
    ' witness yet · physical tick '+snap.physicsTick+
    '. No outcome is granted without genuine Rapier evidence.';
  }
 }
 function advance(){
  const f=session.step();const p=f.ball.position;
  trail.push({x:p.x,y:p.y});
  if(trail.length>450)trail.shift();
  render();
 }
 function resetSession(){
  stop();if(session)session.dispose();
  shotSideLabel.hidden=!['shot','carry','challenge'].includes(select.value);
  shotLaneLabel.hidden=select.value!=='shot';
  controlSceneLabel.hidden=select.value!=='control';
  challengeSceneLabel.hidden=select.value!=='challenge';
  by('action-labs-title').textContent=select.selectedOptions[0].textContent.trim();
  session=createControlledActionLab(getRapier(),select.value,{
   shotSide:select.value==='shot'?shotSide.value:'home',
   shotLane:select.value==='shot'?shotLaneChoice.value:'open',
   carrySide:select.value==='carry'?shotSide.value:'home',
   controlScene:select.value==='control'?controlSceneChoice.value:'receive',
   challengeSide:select.value==='challenge'?shotSide.value:'away',
   challengeScene:select.value==='challenge'?challengeSceneChoice.value:'contact'
  });
  trail=[{x:session.snapshot().ball.position.x,
   y:session.snapshot().ball.position.y}];
  description.textContent=session.shotLane==='blocked'?
   'An opposing defender obstructs all goal-mouth lanes before tick zero. Observe real contact, never a fabricated SHOT.':
   session.controlScene==='receive-pressure'?
   'M26 research: one pre-start real opposing midfielder presses the original receiver. Every shoe START, ball gap, and defender distance is measured from autonomous Rapier play. No fake control or possession.':
   session.controlScene==='receive-cushion'?
   'M25 genuine first-touch: compare original receiving contact with a single bounded Rapier cushioning impulse. Only native shoe START authorizes the attempt; no possession is awarded.':
   session.controlScene==='opponent-first'?
   'A true long PASS targets HOME #9. AWAY #7 approaches only after that physical PASS; observe the opposing shoe first, without awarding an interception, tackle or reception.':
   session.challengeScene==='no-contact'?
   'Ball starts far from all 22 canonical shoes. Observe a physically empty contact timeline; do not manufacture action, interception or possession.':
   session.spec.description;
  status.textContent='Ready · '+session.spec.title+
   ' · Play to observe genuine Rapier events; no result is pre-awarded.';
  accumulator=0;lastTime=0;render();
 }
 function loop(now){
  if(!dialog.open)return;
  if(playing&&session){
   if(lastTime){
    accumulator+=Math.min((now-lastTime)/1000,0.08);
    let iterations=0;
    while(accumulator>=FIXED_DT&&iterations<12){
     advance();accumulator-=FIXED_DT;iterations++;
    }
    if(iterations===12)accumulator=0;
   }
  }
  lastTime=now;requestAnimationFrame(loop);
 }
 const open=by('action-labs-open'),close=by('action-labs-close');
 open.addEventListener('click',()=>{
  if(!getRapier())return;
  onOpen();dialog.showModal();
  try{resetSession();requestAnimationFrame(loop);}
  catch(e){status.textContent='Cannot start: '+e.message;stop();}
 });
 close.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{
  stop();if(session){session.dispose();session=null;}
  trail=[];onClose();
 });
 shotSide.addEventListener('change',()=>{if(dialog.open)try{resetSession();}
  catch(e){stop();status.textContent=e.message;}});
 shotLaneChoice.addEventListener('change',()=>{if(dialog.open)try{resetSession();}
  catch(e){stop();status.textContent=e.message;}});
 controlSceneChoice.addEventListener('change',()=>{if(dialog.open)try{resetSession();}
  catch(e){stop();status.textContent=e.message;}});
 challengeSceneChoice.addEventListener('change',()=>{if(dialog.open)try{resetSession();}
  catch(e){stop();status.textContent=e.message;}});
 select.addEventListener('change',()=>{if(dialog.open)try{resetSession();}
  catch(e){stop();status.textContent=e.message;}});
 go.addEventListener('click',()=>{playing=true;go.disabled=true;pause.disabled=false;});
 pause.addEventListener('click',stop);
 step.addEventListener('click',()=>{stop();try{advance();}
  catch(e){status.textContent=e.message;}});
 reset.addEventListener('click',()=>{try{resetSession();}
  catch(e){stop();status.textContent=e.message;}});
 stop();
 return Object.freeze({isOpen:()=>dialog.open});
}
