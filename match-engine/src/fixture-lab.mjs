// Browser-native Match Engine LAB. The user selects the drop point BEFORE
// a new real-Rapier physics world is created; all subsequent reactions use
// the same 60Hz autonomous 22-player fixture. No injected contact or score.
import {initializeRapier,FIXED_DT} from '/__fa_match_engine__/core.mjs';
import {drawPitchMarkings,pitchProjection} from '/__fa_match_engine__/pitch-markings.mjs';
import {createPhysicalFixtureStepRuntime} from '/__fa_match_engine__/physical-fixture-step-runtime.mjs';

const FIXTURE=Object.freeze({
 id:'season:1:ENG-1:N01:ENG-1:ENG-2',
 competitionId:'ENG-1',marker:'N01',day:1,round:1,
 homeClubId:'ENG-1',awayClubId:'ENG-2'
});
const $=id=>document.getElementById(id);
const pitch=$('fixture-pitch'),ctx=pitch.getContext('2d');
const projection=pitchProjection(pitch.width,pitch.height);
const historyLimit=1200;
const point={x:0,y:0};
let R=null,session=null,current=null,initialPlayers=null;
let playing=false,lastTime=0,accumulator=0;
let history=[],viewTick=0,passes=0,shots=0,clearances=0,contacts=0;
let lastAction='None';
const scene=()=>Object.freeze({
 preset:'drop',seed:'me-pb-situation-lab',
 x:point.x,y:point.y,z:Number($('fixture-drop-height').value),
 vx:0,vy:0,vz:0
});
const setStatus=(message,error=false)=>{
 $('fixture-status').textContent=message;
 $('fixture-status').classList.toggle('error',error);
};
const displayPoint=()=>{
 $('fixture-point').textContent='X '+point.x.toFixed(1)+' · Y '+point.y.toFixed(1);
};
function stop(){
 playing=false;lastTime=0;accumulator=0;
 $('fixture-play').textContent='Play';
}
function trajectory(shot){
 const episode=shot?.active??shot?.lastResolved;
 const positions=episode?.measuredBallCentres3D;
 if(!positions||positions.length<2)return;
 ctx.save();ctx.strokeStyle='#f4fff3';ctx.lineWidth=2;
 ctx.globalAlpha=0.8;ctx.setLineDash([4,4]);ctx.beginPath();
 for(let i=0;i<positions.length;i++){
  const p=positions[i];
  if(i===0)ctx.moveTo(projection.X(p.x),projection.Y(p.y));
  else ctx.lineTo(projection.X(p.x),projection.Y(p.y));
 }
 ctx.stroke();ctx.restore();
}
function draw(frame){
 drawPitchMarkings(ctx,pitch.width,pitch.height);
 // Selection marker is always a requested drop position, never a physics
 // correction or a claim about where a moving/deflected ball must settle.
 const selectedX=projection.X(point.x),selectedY=projection.Y(point.y);
 ctx.save();ctx.strokeStyle='#b8ffdf';ctx.lineWidth=2;
 ctx.setLineDash([4,4]);ctx.beginPath();
 ctx.arc(selectedX,selectedY,12,0,2*Math.PI);ctx.stroke();
 ctx.setLineDash([]);ctx.beginPath();
 ctx.moveTo(selectedX-17,selectedY);ctx.lineTo(selectedX-12,selectedY);
 ctx.moveTo(selectedX+12,selectedY);ctx.lineTo(selectedX+17,selectedY);
 ctx.moveTo(selectedX,selectedY-17);ctx.lineTo(selectedX,selectedY-12);
 ctx.moveTo(selectedX,selectedY+12);ctx.lineTo(selectedX,selectedY+17);
 ctx.stroke();ctx.restore();
 if(!frame)return;
 if(frame.physicalRapierStep!==true||
    frame.officialMatchResult!==null||
    frame.productionScoringConnected!==false||
    frame.physicalPlayerPositions.length!==22)
  throw Error('Untrusted match physics frame');
 trajectory(frame.physicalShotBoundary);
 const starts=new Set(frame.physicalContactFeed.started.map(p=>p.engineId));
 for(const player of frame.physicalPlayerPositions){
  const x=projection.X(player.x),y=projection.Y(player.y);
  ctx.fillStyle=player.team==='home'?'#53cfde':'#ffc77d';
  ctx.beginPath();ctx.arc(x,y,8,0,2*Math.PI);ctx.fill();
  if(starts.has(player.engineId)){
   ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();
  }
  ctx.font='bold 9px system-ui';ctx.textAlign='center';
  ctx.textBaseline='middle';ctx.fillStyle='#17292c';
  ctx.fillText(player.engineId.split('-')[1],x,y);
 }
 const b=frame.ball.position,bx=projection.X(b.x),by=projection.Y(b.y);
 if(![b.x,b.y,b.z].every(Number.isFinite))
  throw Error('Invalid real ball coordinates');
 if(b.z>0.25){
  ctx.fillStyle='#08140a80';ctx.beginPath();
  ctx.arc(bx+4,by+5,6.5,0,2*Math.PI);ctx.fill();
 }
 ctx.fillStyle='#fff';ctx.strokeStyle='#142b2f';ctx.lineWidth=1;
 ctx.beginPath();ctx.arc(bx,by,6.4,0,2*Math.PI);ctx.fill();ctx.stroke();
 const responding=initialPlayers?frame.physicalPlayerPositions.filter((p,i)=>{
  const origin=initialPlayers[i];
  return p.engineId===origin.engineId&&
   Math.hypot(p.x-origin.x,p.y-origin.y)>0.03;
 }).length:0;
 $('fixture-reacting').textContent=responding+' / 22';
 $('fixture-time').textContent=(frame.physicsTick*FIXED_DT).toFixed(2)+' s';
 $('fixture-tick').textContent=String(frame.physicsTick);
 const shot=frame.physicalShotBoundary;
 const observed=shot.active??shot.lastResolved;
 $('fixture-shot-path').textContent=observed?
  observed.observedPath3DM.toFixed(2)+' m':'—';
 $('fixture-shot-height').textContent=observed?
  observed.maximumBallCentreHeightM.toFixed(2)+' m':'—';
 const volume=frame.physicalBallVolumeBoundary?.firstObservedExit;
 $('fixture-boundary').textContent=volume?
  volume.side+' · entire ball (unofficial)':
  shot.lastResolved?.firstPitchPlaneCrossing?.side??'—';
 $('fixture-shot-follow-up').textContent=shot.lastResolved?.firstLaterShoeContact?.contacts
  .map(c=>c.engineId).join(', ')??'—';
}
function counters(){
 $('fixture-contacts').textContent=String(contacts);
 $('fixture-passes').textContent=String(passes);
 $('fixture-shots').textContent=String(shots);
 $('fixture-clearances').textContent=String(clearances);
 $('fixture-last-action').textContent=lastAction;
 $('fixture-ticks').textContent=String(current?.physicsTick??0);
 const slider=$('fixture-history');
 slider.min=String(history[0]?.physicsTick??0);
 slider.max=String(history.at(-1)?.physicsTick??0);
 slider.value=String(current?.physicsTick??0);
 slider.disabled=history.length<2;
 $('fixture-verify').disabled=history.length<155||history[0].physicsTick!==1;
}
function restart(){
 if(!R)return;
 stop();session?.dispose();
 session=createPhysicalFixtureStepRuntime(R,FIXTURE,scene(),{
  globalResponse:1,autonomousActions:true
 });
 current=session.snapshot();
 initialPlayers=current.physicalPlayerPositions;
 history=[];viewTick=0;passes=shots=clearances=contacts=0;
 lastAction='None';counters();draw(current);
 $('fixture-verify-result').textContent='';
 setStatus('Ready');
}
function advance(){
 const f=session.step(),foot=f.physicalContactFeed,shot=f.physicalShotBoundary;
 if(f.physicsTick!==current.physicsTick+1||
    foot.physicsTick!==f.physicsTick||shot.physicsTick!==f.physicsTick||
    f.officialMatchResult!==null||f.generatedPlayersUsed!==false||
    f.officialGoalEvidence!==false||
    shot.goalScored!==null||shot.shotOnTarget!==null)
  throw Error('Untrusted physics step');
 current=f;
 contacts+=foot.started.length;
 const action=f.localAutonomousAction;
 if(action){
  if(foot.started.length!==1||
     foot.started[0].engineId!==action.playerId||
     action.appliedByRapier!==true||action.officialMatchAction!==false)
   throw Error('Action requires genuine Rapier shoe START');
  if(action.action==='pass')passes++;
  else if(action.action==='shot')shots++;
  else if(action.action==='clearance')clearances++;
  else throw Error('Unexpected physical action');
  lastAction=action.action[0].toUpperCase()+action.action.slice(1);
 }else if(foot.started.length)lastAction='Contact';
 if(shot.active?.physicalSampleCount>181||
    shot.lastResolved?.physicalSampleCount>181)
  throw Error('Shot physics evidence exceeded bound');
 history.push(f);if(history.length>historyLimit)history.shift();
 viewTick=f.physicsTick;counters();draw(f);
}
function safely(callback){
 try{callback();}catch(error){
  console.error('Match Engine LAB:',error);
  stop();setStatus('Physics error',true);
  for(const id of ['fixture-play','fixture-step','fixture-reset','fixture-verify'])
   $(id).disabled=true;
 }
}
function setLanding(x,y){
 if(!Number.isFinite(x)||!Number.isFinite(y)||
    Math.abs(x)>52.5||Math.abs(y)>34)return;
 point.x=Math.round(x*10)/10;point.y=Math.round(y*10)/10;
 displayPoint();
 if(R)safely(restart);
 else draw(null);
}
function chooseByClient(clientX,clientY){
 const rect=pitch.getBoundingClientRect();
 if(!rect.width||!rect.height)return;
 const px=(clientX-rect.left)*pitch.width/rect.width;
 const py=(clientY-rect.top)*pitch.height/rect.height;
 setLanding((px-pitch.width/2)/projection.scale,
  (py-pitch.height/2)/projection.scale);
}
pitch.addEventListener('click',event=>chooseByClient(event.clientX,event.clientY));
pitch.addEventListener('keydown',event=>{
 const arrow={ArrowLeft:[-1,0],ArrowRight:[1,0],
  ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
 if(arrow){
  event.preventDefault();
  setLanding(Math.max(-52.5,Math.min(52.5,point.x+arrow[0])),
   Math.max(-34,Math.min(34,point.y+arrow[1])));
 }else if(event.key==='Home'){
  event.preventDefault();setLanding(0,0);
 }
});
$('fixture-drop-height').addEventListener('change',()=>safely(restart));
$('fixture-play').addEventListener('click',()=>{
 if(!session)return;
 if(playing){stop();setStatus('Paused');return;}
 if(history.length&&viewTick!==history.at(-1).physicsTick)draw(current);
 playing=true;lastTime=0;accumulator=0;
 $('fixture-play').textContent='Pause';setStatus('Playing');
});
$('fixture-step').addEventListener('click',()=>{
 if(!session)return;stop();safely(advance);setStatus('Paused');
});
$('fixture-reset').addEventListener('click',()=>safely(restart));
$('fixture-history').addEventListener('input',()=>{
 if(playing)stop();
 const tick=Number($('fixture-history').value);
 const found=history.find(f=>f.physicsTick===tick);
 if(found){viewTick=tick;draw(found);setStatus('Paused');}
});
$('fixture-verify').addEventListener('click',()=>{
 if(!R||history[0]?.physicsTick!==1||history.length<155)return;
 safely(()=>{
  const check=createPhysicalFixtureStepRuntime(R,FIXTURE,scene(),{
   globalResponse:1,autonomousActions:true
  });
  let equal=true;
  try{
   for(let i=0;i<155;i++){
    const a=check.step(),b=history[i];
    if(a.canonicalBall!==b.canonicalBall||
       JSON.stringify(a.physicalPlayerPositions)!==JSON.stringify(b.physicalPlayerPositions)||
       JSON.stringify(a.physicalContactFeed.started)!==JSON.stringify(b.physicalContactFeed.started)||
       JSON.stringify(a.physicalShotBoundary)!==JSON.stringify(b.physicalShotBoundary)){
     equal=false;break;
    }
   }
  }finally{check.dispose();}
  $('fixture-verify-result').textContent=equal?'Replay OK':'Replay differs';
 });
});
function animate(now){
 if(playing&&session){
  if(!lastTime)lastTime=now;
  accumulator+=Math.min(100,now-lastTime)*
   Number($('fixture-speed').value);
  lastTime=now;
  let count=Math.min(8,Math.floor(accumulator/(1000/60)));
  if(count){
   accumulator-=count*(1000/60);
   safely(()=>{while(count-->0)advance();});
  }
 }else lastTime=0;
 requestAnimationFrame(animate);
}
displayPoint();drawPitchMarkings(ctx,pitch.width,pitch.height);
requestAnimationFrame(animate);
(async()=>{
 try{
  const moduleNamespace=await import('/__fa_match_engine__/rapier.es.js');
  R=await initializeRapier(moduleNamespace);
  for(const id of ['fixture-play','fixture-step','fixture-reset'])
   $(id).disabled=false;
  restart();
 }catch(error){
  console.error('Match Engine LAB failed:',error);
  setStatus('Physics unavailable',true);
 }
})();
