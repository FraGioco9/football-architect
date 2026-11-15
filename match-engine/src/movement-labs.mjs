// #628 Phase M2 — read-only evidence from the one canonical 22-player
// kinematic mover and the one accepted Rapier ball world. The movement
// runner explicitly disables foot colliders, physical action authority and
// official match mutations. Do not infer a tackle/touch from proximity.
import {createEngine,FIXED_DT} from './core.mjs';
import {createControlledActionLab} from './action-labs.mjs';
import {createPlayerMovement,PLAYER_MIN_SEPARATION_M} from './player-movement.mjs';
import {drawPitchMarkings} from './pitch-markings.mjs';
import {MOVEMENT_LAB_SCENARIOS,movementLabScenario} from './movement-lab-scenarios.mjs';
const two=n=>n.toFixed(2);
const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

export function createControlledMovementLab(RAPIER,id,{side='home'}={}){
 if(!RAPIER||typeof RAPIER.World!=='function')
  throw new TypeError('Rapier required for movement LAB');
 const scene=movementLabScenario(id,side);
 const postPass=scene.spec.id==='post-pass';
 const physicalContest=scene.spec.id==='opponent-contact';
 const usesOriginalControl=postPass||physicalContest;
 // Both controlled options delegate to the exact original authentic
 // Rapier CONTROL world. No duplicate shoe bridge or autonomous policy.
 const actionSession=usesOriginalControl?
  createControlledActionLab(RAPIER,'control',{
   controlSide:side,
   ...(physicalContest?{controlScene:'opponent-first'}:{})
  }):null;
 const engine=usesOriginalControl?null:createEngine(RAPIER,scene.initial);
 const mover=usesOriginalControl?null:createPlayerMovement();
 let disposed=false,latest=null,origin=null,previous=null;
 let pathM=0,maxSpeedMps=0,maxBrakeMps2=0,totalTurnRad=0;
 let postPassDistanceM=0,goalSideTravelM=0;
 let measuredOpponentPathM=0,minContestedPlayerGapM=Infinity;
 const contestedOpponentId=physicalContest?'away-7':null;
 const toPhysical=(f)=>Object.freeze({tick:f.physicsTick,ball:f.ball});
 const toMovement=(f)=>Object.freeze({
  tick:f.physicsTick,players:f.observedMovementPlayers,
  recoveries:Object.freeze({home:null,away:null}),
  screens:Object.freeze({home:null,away:null})
 });
 function record(physics,frame,pass=null,receivingContact=null,
  opposingShoe=null){
  if(physics.tick!==frame.tick)throw new Error('Canonical 60 Hz movement and Rapier tick mismatch');
  const p=frame.players.find(x=>x.id===scene.focusId);
  if(!p)throw new Error('Missing canonical movement focus');
  const ball=physics.ball.position;
  const gapM=Math.hypot(p.x-ball.x,p.y-ball.y);
  if(origin===null)origin=Object.freeze({x:p.x,y:p.y,gapM});
  const contestedOpponent=physicalContest?
   frame.players.find(other=>other.id===contestedOpponentId&&
    other.team!==scene.side):null;
  if(physicalContest&&!contestedOpponent)
   throw new Error('Actual canonical opposing player missing');
  if(physicalContest&&opposingShoe&&(
     opposingShoe.realShoeStart!==true||
     opposingShoe.playerId!==contestedOpponentId||
     opposingShoe.passingTick!==pass?.tick||
     !Number.isSafeInteger(opposingShoe.tick)||
     opposingShoe.tick<=pass.tick||
     opposingShoe.tick>physics.tick||
     opposingShoe.officialInterception!==false))
   throw new Error('Only original later authentic opponent Rapier shoe START is accepted');
  if(physicalContest&&previous?.opponentXY&&
     physics.tick===previous.tick+1&&pass&&
     physics.tick>pass.tick&&
     (!opposingShoe||physics.tick<=opposingShoe.tick)){
   measuredOpponentPathM+=Math.hypot(
    contestedOpponent.x-previous.opponentXY.x,
    contestedOpponent.y-previous.opponentXY.y);
  }
  const contestedGapM=contestedOpponent?
   Math.hypot(p.x-contestedOpponent.x,p.y-contestedOpponent.y):null;
  if(contestedGapM!==null)
   minContestedPlayerGapM=Math.min(minContestedPlayerGapM,contestedGapM);
  const speedMps=Math.hypot(p.vx,p.vy);
  if(pass&&(pass.physicalImpulseApplied!==true||
     pass.recipientId!==scene.focusId||pass.team!==scene.side||
     !Number.isSafeInteger(pass.tick)||pass.tick>=physics.tick+1))
   throw new Error('Only authenticated original physical PASS is admissible');
  if(previous&&postPass&&pass&&
     previous.tick>=pass.tick&&physics.tick>pass.tick)
   postPassDistanceM+=Math.hypot(p.x-previous.x,p.y-previous.y);
  if(previous){
   pathM+=Math.hypot(p.x-previous.x,p.y-previous.y);
   if(!p.blockedBy&&!previous.blockedBy)
    maxBrakeMps2=Math.max(maxBrakeMps2,
     (previous.speedMps-speedMps)/FIXED_DT);
   totalTurnRad+=Math.abs(delta(p.facingRad,previous.facingRad));
  }
  maxSpeedMps=Math.max(maxSpeedMps,speedMps);
  const pairs=frame.players;
  let minSpacingM=Infinity;
  for(let i=0;i<pairs.length;i++)for(let j=i+1;j<pairs.length;j++)
   minSpacingM=Math.min(minSpacingM,Math.hypot(
    pairs[i].x-pairs[j].x,pairs[i].y-pairs[j].y));
  if(minSpacingM<PLAYER_MIN_SEPARATION_M-1e-8)
   throw new Error('Canonical 0.98 m separation violated');
  // Recovery observation requires the ORIGINAL screen and recovery
  // assignment resulting from current actual opponent XY, never ball
  // territory or a guessed opponent.
  const recovery=frame.recoveries[scene.side];
  const screen=frame.screens[scene.side];
  const recoveryObserved=Boolean(screen&&recovery&&
    recovery.opponentId===screen.opponentId&&
    recovery.playerIds.length>0);
  const currentOpponent=recoveryObserved?
   frame.players.find(other=>other.id===screen.opponentId&&
    other.team!==scene.side&&other.role!=='goalkeeper'):null;
  const assigned=Boolean(currentOpponent&&recovery.playerIds.includes(p.id));
  // Count only consecutive, source-confirmed goalward movement of the
  // SAME assigned player against the SAME currently sampled opponent.
  if(assigned&&previous?.assignedOpponentId===currentOpponent.id&&
    physics.tick===previous.tick+1&&!p.blockedBy){
   const actualGoalSide=(p.x-previous.x)*(scene.side==='home'?-1:1);
   if(actualGoalSide>0)goalSideTravelM+=actualGoalSide;
  }
  const witnessed=scene.spec.id==='approach'?
   origin.gapM-gapM>0.25&&pathM>0.3:
   scene.spec.id==='brake'?
    !p.blockedBy&&maxSpeedMps>0.75&&
    maxSpeedMps-speedMps>0.35&&maxBrakeMps2>0:
   scene.spec.id==='turn'?totalTurnRad>0.4:
   scene.spec.id==='recovery'?recoveryObserved:
   scene.spec.id==='recovery-response'?assigned&&goalSideTravelM>0.15:
   scene.spec.id==='post-pass'?Boolean(pass&&postPassDistanceM>0.25):
   physicalContest?Boolean(pass&&opposingShoe&&
    measuredOpponentPathM>0.25):false;
  previous=Object.freeze({
   tick:physics.tick,x:p.x,y:p.y,speedMps,facingRad:p.facingRad,
   blockedBy:p.blockedBy,assignedOpponentId:assigned?currentOpponent.id:null,
   opponentXY:contestedOpponent?Object.freeze({
    x:contestedOpponent.x,y:contestedOpponent.y
   }):null
  });
  latest=Object.freeze({
   scenarioId:scene.spec.id,side:scene.side,focusId:p.id,
   tick:physics.tick,timeS:physics.tick*FIXED_DT,
   ball:physics.ball,
   players:frame.players,
   readout:Object.freeze({
    focusSpeedMps:speedMps,maxSpeedMps,pathM,
    distanceToBallM:gapM,distanceClosedM:origin.gapM-gapM,
    maxObservedBrakeMps2:maxBrakeMps2,totalTurnRad,
    minSpacingM,recoveryObserved,witnessed,
    observedOpponentId:currentOpponent?.id??null,
    assignedRecoveryPlayer:assigned,goalSideTravelM,
    postPassDistanceM,authenticPassTick:pass?.tick??null,
    observedReceivingShoeContact:Boolean(receivingContact),
    contestedOpponentId,measuredOpponentPathM,
    contestedPlayerGapM:contestedGapM,
    minContestedPlayerGapM:physicalContest?minContestedPlayerGapM:null,
    actualOpposingShoeTick:opposingShoe?.tick??null,
    verifiedRapierOpponentShoeStart:Boolean(opposingShoe),
    verifiedRapierPlayerBodyContact:false
   }),
   readOnly:true,verifiedFootContact:Boolean(pass),
   officialMatchAction:false,officialPossession:false,
   officialMatchResult:null
  });
  return latest;
 }
 if(usesOriginalControl){
  const f=actionSession.snapshot();
  record(toPhysical(f),toMovement(f),f.priorRealPass,f.receivingContact,
   f.firstOpposingShoe);
 }else record(engine.snapshot(),mover.snapshot());
 function snapshot(){if(disposed)throw new Error('Movement LAB disposed');return latest;}
 function step(){
  if(disposed)throw new Error('Movement LAB disposed');
  if(usesOriginalControl){
   const previousTick=latest.tick;
   const f=actionSession.step();
   if(f.physicsTick!==previousTick+1)
    throw new Error('Original CONTROL Rapier and mover ticks must align');
   return record(toPhysical(f),toMovement(f),f.priorRealPass,
    f.receivingContact,f.firstOpposingShoe);
  }
  const prior=engine.snapshot();
  const frame=mover.step(prior.ball.position);
  const after=engine.step(); // original position-only lab: shoe source OFF
  if(after.tick!==prior.tick+1||frame.tick!==after.tick)
   throw new Error('Only current, synchronized real physical ticks');
  return record(after,frame);
 }
 function dispose(){if(!disposed){
  disposed=true;engine?.dispose();actionSession?.dispose();
 }}
 return Object.freeze({scene,snapshot,step,dispose});
}

export function mountControlledMovementLabs({getRapier,onOpen,onClose}){
 const by=id=>document.getElementById(id);
 const dialog=by('movement-labs-dialog'),
  open=by('movement-labs-open'),close=by('movement-labs-close'),
  choice=by('movement-labs-choice'),side=by('movement-labs-side'),
  canvas=by('movement-labs-pitch'),status=by('movement-labs-status'),
  readout=by('movement-labs-readout'),description=by('movement-labs-description'),
  play=by('movement-labs-play'),pause=by('movement-labs-pause'),
  step=by('movement-labs-step'),reset=by('movement-labs-reset');
 if([dialog,open,close,choice,side,canvas,status,readout,description,
  play,pause,step,reset].some(x=>!x))
  throw new Error('Movement LAB controls are missing');
 if(choice.options.length!==MOVEMENT_LAB_SCENARIOS.length||
    MOVEMENT_LAB_SCENARIOS.some((s,i)=>choice.options[i].value!==s.id))
  throw new Error('Movement menu must match the source catalog');
 let session=null,playing=false,lastTime=0,accumulator=0;
 function stop(){playing=false;play.disabled=false;pause.disabled=true;}
 function draw(frame){
  const ctx=canvas.getContext('2d');
  const {X,Y}=drawPitchMarkings(ctx,canvas.width,canvas.height);
  for(const p of frame.players){
   const selected=p.id===frame.focusId;
   const actualOpponent=frame.scenarioId==='opponent-contact'&&
    p.id===frame.readout.contestedOpponentId;
   ctx.beginPath();ctx.arc(X(p.x),Y(p.y),selected?8:4,0,2*Math.PI);
   ctx.fillStyle=p.team==='home'?'#a8dfff':'#ffb39a';ctx.fill();
   if(actualOpponent){
    ctx.lineWidth=2;ctx.strokeStyle='#ffffff';ctx.stroke();
    ctx.beginPath();ctx.arc(X(p.x),Y(p.y),11,0,Math.PI*2);
    ctx.strokeStyle='#ffb39a';ctx.stroke();
   }
   if(selected){
    ctx.lineWidth=2;ctx.strokeStyle='#162e29';ctx.stroke();
    const fx=X(p.x)+Math.cos(p.facingRad)*16;
    const fy=Y(p.y)+Math.sin(p.facingRad)*16;
    ctx.beginPath();ctx.moveTo(X(p.x),Y(p.y));ctx.lineTo(fx,fy);
    ctx.lineWidth=2;ctx.strokeStyle='#ffffff';ctx.stroke();
   }
  }
  const p=frame.ball.position;
  ctx.beginPath();ctx.arc(X(p.x),Y(p.y),6,0,2*Math.PI);
  ctx.fillStyle='#fff';ctx.fill();ctx.lineWidth=1.5;
  ctx.strokeStyle='#102d2e';ctx.stroke();
 }
 function render(){
  if(!session)return;
  const f=session.snapshot(),m=f.readout;
  draw(f);
  readout.textContent='Tick '+f.tick+' · '+two(f.timeS)+'s · '+
   f.focusId.replace('-', ' #')+' · speed '+two(m.focusSpeedMps)+' m/s'+
   ' · path '+two(m.pathM)+' m · heading change '+
   two(m.totalTurnRad)+' rad · brake peak '+two(m.maxObservedBrakeMps2)+
   ' m/s² · min 22-body gap '+two(m.minSpacingM)+' m'+
   (f.scenarioId==='post-pass'?' · Physical PASS tick '+
    (m.authenticPassTick??'none')+' · post-pass path '+
    two(m.postPassDistanceM)+' m':'')+
   (f.scenarioId==='recovery-response'?' · goal-side path '+
    two(m.goalSideTravelM)+' m · opponent '+
    (m.observedOpponentId??'none'):'')+
   (f.scenarioId==='opponent-contact'?' · real opponent '+m.contestedOpponentId+
    ' · observed path '+two(m.measuredOpponentPathM)+' m'+
    ' · opponent shoe START '+(m.actualOpposingShoeTick??'none')+
    ' · closest player gap '+two(m.minContestedPlayerGapM)+' m':'');
  if(f.scenarioId==='opponent-contact'){
   status.textContent=(m.witnessed?
    'Observed: original opposing Rapier shoe-ball START after genuine PASS and actual opponent motion.':
    'No opponent physical shoe witness yet.')+
    ' Body collision, tackle, interception, possession and completed pass NOT verified.';
   return;
  }
  if(f.scenarioId==='post-pass'){
   status.textContent=(m.witnessed?
    'Observed: actual receiver movement after authentic Rapier PASS.':
    'No post-PASS movement witness yet.')+
    ' No official pass completion, possession or goal.';
   return;
  }
  if(f.scenarioId==='recovery-response'){
   status.textContent=(m.witnessed?
    'Observed: real assigned goal-side movement against a currently sampled opponent.':
    'No goal-side recovery witness yet.')+
    ' No certified interception, tackle or possession.';
   return;
  }
  if(f.scenarioId==='recovery-empty'){
   status.textContent='Negative control: no current-opponent recovery witness yet. No tackle or possession.';
   return;
  }
  status.textContent=(m.witnessed?'Observed: ':'No movement witness yet: ')+
   (f.scenarioId==='approach'?'actual player approach':
    f.scenarioId==='brake'?'actual measured deceleration':
    f.scenarioId==='turn'?'actual gradual heading rotation':
    'actual current-opponent recovery assignment')+
   '. Motion-only: no shoe collider, touch, possession or result.';
 }
 function resetSession(){
  stop();session?.dispose();
  if(choice.value==='opponent-contact')side.value='home';
  side.disabled=choice.value==='opponent-contact';
  session=createControlledMovementLab(getRapier(),choice.value,{
   side:side.value});
  description.textContent=session.scene.spec.description;
  accumulator=0;lastTime=0;render();
 }
 function advance(){session.step();render();}
 function loop(now){
  if(!dialog.open)return;
  if(playing&&session&&lastTime){
   accumulator+=Math.min((now-lastTime)/1000,0.08);
   let count=0;
   while(accumulator>=FIXED_DT&&count<12){
    advance();accumulator-=FIXED_DT;count++;
   }
   if(count===12)accumulator=0;
  }
  lastTime=now;requestAnimationFrame(loop);
 }
 open.addEventListener('click',()=>{
  if(!getRapier())return;
  onOpen();dialog.showModal();
  try{resetSession();requestAnimationFrame(loop);}
  catch(e){stop();status.textContent='Cannot start: '+e.message;}
 });
 close.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{
  stop();session?.dispose();session=null;onClose();
 });
 for(const control of [choice,side])
  control.addEventListener('change',()=>{if(dialog.open)try{resetSession();}
   catch(e){stop();status.textContent=e.message;}});
 play.addEventListener('click',()=>{playing=true;play.disabled=true;pause.disabled=false;});
 pause.addEventListener('click',stop);
 step.addEventListener('click',()=>{stop();try{advance();}
  catch(e){status.textContent=e.message;}});
 reset.addEventListener('click',()=>{try{resetSession();}
  catch(e){stop();status.textContent=e.message;}});
 stop();
 return Object.freeze({isOpen:()=>dialog.open});
}
