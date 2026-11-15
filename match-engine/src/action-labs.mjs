// #620 - isolated, controlled action experiments on genuine private Rapier.
// This module never changes a sporting result, official possession or score.
// The main physics LAB owns its own separate lifecycle; it is closed when
// this dialog runs so there are never competing running Rapier worlds.
import {createEngine,createUniformAutonomousBallCoreEngine,FIXED_DT}
 from './core.mjs';
import {createPlayerMovement} from './player-movement.mjs';
import {drawPitchMarkings} from './pitch-markings.mjs';
import {ACTION_LAB_SCENARIOS,getActionLabScenario,
 classifyActionLabEvidence} from './action-lab-scenarios.mjs';

const invalid=()=>{throw new TypeError('Action LAB requires one genuine Rapier session');};
export function createControlledActionLab(RAPIER,id){
 if(!RAPIER||typeof RAPIER.World!=='function')invalid();
 const spec=getActionLabScenario(id),s=spec.initial;
 const uniform=['uniform','shot','carry'].includes(spec.mode);
 const carry=spec.mode==='carry',researchShot=spec.mode==='shot'?'home':null;
 const engine=uniform?createUniformAutonomousBallCoreEngine(
  RAPIER,s,1,researchShot,carry):createEngine(RAPIER,s,{
   diagnosticPlayerFootContactsEnabled:true,
   diagnosticLocalAiPassReceiveEnabled:spec.mode==='control',
   diagnosticLocalAiExchangeEnabled:spec.mode==='challenge',
   diagnosticLocalAiOpponentLaneEnabled:spec.mode==='challenge'
  });
 const mover=createPlayerMovement(uniform?{
  experimentalAiKickApproach:true,
  experimentalAutonomousFixtureContactChase:true,
  ...(carry?{
   experimentalAutonomousFixtureCarry:true,
   experimentalAutonomousFixtureCarrySupport:true
  }:{}),
  ...(researchShot?{researchShotAttacker:researchShot,researchShotBall:s}:{})
 }:{
  ...(spec.mode==='control'?{experimentalAiPassReceiveApproach:true}:{}),
  ...(spec.mode==='challenge'?{
   experimentalAiExchangeApproach:true,experimentalAiOpponentLane:true
  }:{})
 });
 let closed=false,eventsSeen=Object.freeze([]),evidenceCount=0;
 function current(physics,players){
  const foot=engine.footContactSnapshot();
  const starts=Object.freeze([...foot.started]);
  const action=uniform?engine.uniformAutonomousActionSnapshot():null;
  const actual=action?.tick===physics.tick?action:null;
  const localEvents=spec.mode==='control'?
   engine.localAiPassReceiveSnapshot().events:
   spec.mode==='challenge'?engine.localAiExchangeSnapshot().events:[];
  const event=classifyActionLabEvidence(spec,{
   tick:physics.tick,action:actual,starts,events:localEvents
  });
  if(event.witnessed){
   evidenceCount+=1;
   eventsSeen=Object.freeze([...eventsSeen,
    Object.freeze({tick:physics.tick,kind:spec.goal,
     actorId:actual?.playerId??starts[0]??null})].slice(-12));
  }
  return Object.freeze({
   scenarioId:id,physicsTick:physics.tick,timeS:physics.tick*FIXED_DT,
   ball:physics.ball,players:Object.freeze(players.players.map(p=>
    Object.freeze({id:p.id,team:p.team,x:p.x,y:p.y}))),
   starts,action:actual,evidence:event,
   eventCount:evidenceCount,events:eventsSeen,
   officialMatchResult:null,officialMatchPossession:false,
   scoreChanged:false,readOnlyEvidence:true
  });
 }
 let latest=current(engine.snapshot(),mover.snapshot());
 function snapshot(){if(closed)throw new Error('Action LAB disposed');return latest;}
 function step(){
  if(closed)throw new Error('Action LAB disposed');
  const before=engine.snapshot();
  const players=uniform?mover.step(before.ball.position):
   mover.step(before.ball.position,{
    velocity:before.ball.velocity,footContact:engine.footContactSnapshot()
   });
  const physics=engine.step(players);
  if(physics.tick!==before.tick+1||players.tick!==physics.tick)
   throw new Error('Action LAB must preserve same 60Hz physical tick');
  latest=current(physics,players);
  return latest;
 }
 function dispose(){if(!closed){closed=true;engine.dispose();}}
 return Object.freeze({spec,snapshot,step,dispose});
}
const label=id=>id.replace('home-','Home #').replace('away-','Away #');
const number=n=>Number(n).toFixed(2);

// The UI is mounted once, no duplicated buttons or AI panels per action.
export function mountControlledActionLabs({getRapier,onOpen,onClose}){
 const by=id=>document.getElementById(id);
 const dialog=by('action-labs-dialog'),select=by('action-labs-choice');
 const canvas=by('action-labs-pitch'),status=by('action-labs-status');
 const summary=by('action-labs-readout'),description=by('action-labs-description');
 const go=by('action-labs-play'),pause=by('action-labs-pause');
 const step=by('action-labs-step'),reset=by('action-labs-reset');
 if(!dialog||!select||!canvas||!status||!summary||!description)invalid();
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
  const selected=new Set(session.spec.focus);
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
   ') m · Real shoe STARTs '+snap.starts.length+' · Witnesses '+snap.eventCount;
  if(snap.evidence.witnessed){
   const kind=session.spec.goal;
   status.textContent=kind==='shot'?
    'Verified: real shoe START + physical SHOT impulse. No goal awarded.':
    kind==='pass'?
     'Verified: real shoe START + physical PASS impulse. Reception not assumed.':
    kind==='carry'?
     'Verified: real shoe START + short CARRY impulse. Dribble unconfirmed.':
    kind==='control'?
     'Verified: separate real receiving shoe contact. No official possession.':
     'Observed: opposing physical shoe contact. Tackle/interception unconfirmed.';
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
  session=createControlledActionLab(getRapier(),select.value);
  trail=[{x:session.snapshot().ball.position.x,
   y:session.snapshot().ball.position.y}];
  description.textContent=session.spec.description;
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
