// #628 Phase M2 — read-only evidence from the one canonical 22-player
// kinematic mover and the one accepted Rapier ball world. The movement
// runner explicitly disables foot colliders, physical action authority and
// official match mutations. Do not infer a tackle/touch from proximity.
import {createEngine,FIXED_DT} from './core.mjs';
import {createPlayerMovement,PLAYER_MIN_SEPARATION_M} from './player-movement.mjs';
import {drawPitchMarkings} from './pitch-markings.mjs';
import {MOVEMENT_LAB_SCENARIOS,movementLabScenario} from './movement-lab-scenarios.mjs';
const two=n=>n.toFixed(2);
const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

export function createControlledMovementLab(RAPIER,id,{side='home'}={}){
 if(!RAPIER||typeof RAPIER.World!=='function')
  throw new TypeError('Rapier required for movement LAB');
 const scene=movementLabScenario(id,side);
 const engine=createEngine(RAPIER,scene.initial);
 const mover=createPlayerMovement();
 let disposed=false,latest=null,origin=null,previous=null;
 let pathM=0,maxSpeedMps=0,maxBrakeMps2=0,totalTurnRad=0;
 function record(physics,frame){
  if(physics.tick!==frame.tick)throw new Error('Canonical 60 Hz movement and Rapier tick mismatch');
  const p=frame.players.find(x=>x.id===scene.focusId);
  if(!p)throw new Error('Missing canonical movement focus');
  const ball=physics.ball.position;
  const gapM=Math.hypot(p.x-ball.x,p.y-ball.y);
  if(origin===null)origin=Object.freeze({x:p.x,y:p.y,gapM});
  const speedMps=Math.hypot(p.vx,p.vy);
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
  const witnessed=scene.spec.id==='approach'?
   origin.gapM-gapM>0.25&&pathM>0.3:
   scene.spec.id==='brake'?
    !p.blockedBy&&maxSpeedMps>0.75&&
    maxSpeedMps-speedMps>0.35&&maxBrakeMps2>0:
   scene.spec.id==='turn'?totalTurnRad>0.4:recoveryObserved;
  previous=Object.freeze({
   x:p.x,y:p.y,speedMps,facingRad:p.facingRad,blockedBy:p.blockedBy
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
    minSpacingM,recoveryObserved,witnessed
   }),
   readOnly:true,verifiedFootContact:false,
   officialMatchAction:false,officialPossession:false,
   officialMatchResult:null
  });
  return latest;
 }
 record(engine.snapshot(),mover.snapshot());
 function snapshot(){if(disposed)throw new Error('Movement LAB disposed');return latest;}
 function step(){
  if(disposed)throw new Error('Movement LAB disposed');
  const prior=engine.snapshot();
  const frame=mover.step(prior.ball.position);
  const after=engine.step(); // no physical shoe bridge or autonomous action
  if(after.tick!==prior.tick+1||frame.tick!==after.tick)
   throw new Error('Only current, synchronized real physical ticks');
  return record(after,frame);
 }
 function dispose(){if(!disposed){disposed=true;engine.dispose();}}
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
   ctx.beginPath();ctx.arc(X(p.x),Y(p.y),selected?8:4,0,2*Math.PI);
   ctx.fillStyle=p.team==='home'?'#a8dfff':'#ffb39a';ctx.fill();
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
   ' m/s² · min 22-body gap '+two(m.minSpacingM)+' m';
  status.textContent=(m.witnessed?'Observed: ':'No movement witness yet: ')+
   (f.scenarioId==='approach'?'actual player approach':
    f.scenarioId==='brake'?'actual measured deceleration':
    f.scenarioId==='turn'?'actual gradual heading rotation':
    'actual current-opponent recovery assignment')+
   '. Motion-only: no shoe collider, touch, possession or result.';
 }
 function resetSession(){
  stop();session?.dispose();
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
