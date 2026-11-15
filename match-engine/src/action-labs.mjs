// #620 — controlled actions on the CLEAN canonical same-world Rapier core.
// No legacy universal match session, opponent-lane tactical simulator or fake
// action event. Exactly one core engine and one existing 22-player mover.
import {createEngine,FIXED_DT} from './core.mjs';
import {createPlayerMovement} from './player-movement.mjs';
import {drawPitchMarkings} from './pitch-markings.mjs';
import {ACTION_LAB_SCENARIOS,getActionLabScenario,
 classifyActionLabEvidence} from './action-lab-scenarios.mjs';

export function createControlledActionLab(RAPIER,id){
 if(!RAPIER||typeof RAPIER.World!=='function')
  throw new TypeError('Rapier required for real Action LAB');
 const spec=getActionLabScenario(id);
 // The same physical authority produces shoe START and applies the original
 // action impulse; diagnostic flags remain explicit and DEV-local.
 const engine=createEngine(RAPIER,spec.initial,{
  diagnosticPlayerFootContactsEnabled:true,
  diagnosticAutonomousFixtureActionEnabled:true,
  ...(spec.mode==='carry'?{diagnosticAutonomousCarryEnabled:true}:{})
 });
 const mover=createPlayerMovement();
 let disposed=false,firstRealPass=null,count=0,history=Object.freeze([]);
 function record(physics,playerFrame){
  const foot=engine.footContactSnapshot();
  const starts=Object.freeze([...foot.started]);
  if(foot.tick!==physics.tick||playerFrame.tick!==physics.tick)
   throw new Error('Only genuine same-tick Rapier and canonical mover allowed');
  const raw=engine.uniformAutonomousActionSnapshot();
  const action=raw?.tick===physics.tick?raw:null;
  const evidence=classifyActionLabEvidence(spec,{
   tick:physics.tick,action,starts,priorPass:firstRealPass
  });
  if(evidence.witnessed){
   count++;
   history=Object.freeze([...history,Object.freeze({
    tick:physics.tick,kind:spec.goal,
    actorId:action?.playerId??starts[0]??null
   })].slice(-12));
  }
  if(action?.action==='pass'&&!firstRealPass){
   firstRealPass=Object.freeze({
    tick:physics.tick,playerId:action.playerId,
    team:action.playerId.split('-')[0]
   });
  }
  return Object.freeze({
   scenarioId:id,physicsTick:physics.tick,timeS:physics.tick*FIXED_DT,
   ball:physics.ball,
   players:Object.freeze(playerFrame.players.map(p=>Object.freeze({
    id:p.id,team:p.team,x:p.x,y:p.y
   }))),
   starts,action,evidence,eventCount:count,events:history,
   officialMatchResult:null,officialMatchPossession:false,
   scoreChanged:false,readOnlyEvidence:true
  });
 }
 let latest=record(engine.snapshot(),mover.snapshot());
 function snapshot(){if(disposed)throw new Error('Action LAB disposed');return latest;}
 function step(){
  if(disposed)throw new Error('Action LAB disposed');
  const prior=engine.snapshot();
  const frame=mover.step(prior.ball.position);
  const after=engine.step(frame);
  if(after.tick!==prior.tick+1||frame.tick!==after.tick)
   throw new Error('Action LAB must preserve real canonical 60Hz ticks');
  latest=record(after,frame);
  return latest;
 }
 function dispose(){if(!disposed){disposed=true;engine.dispose();}}
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
    'Verified: genuine Rapier shoe START + SHOT impulse. No goal awarded.':
    kind==='pass'?
     'Verified: genuine Rapier shoe START + PASS impulse. Reception not assumed.':
    kind==='carry'?
     'Verified: genuine Rapier shoe START + CARRY impulse. Dribble unconfirmed.':
    kind==='control'?
     'Observed: separate teammate shoe-ball contact after real pass. No official possession.':
     'Observed: actual AWAY shoe-ball contact; no successful tackle claimed.';
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
