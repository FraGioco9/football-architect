// #620 true Chromium user journey: primary DEV LAB -> five controlled
// Action LABs -> real Rapier event feedback -> restore original LAB.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {createPreviewServer} from '../../tools/dev-standings-preview.mjs';

const chromeBinary=()=>{
 const choices=[process.env.CHROME_BIN,'google-chrome','google-chrome-stable',
  'chromium','chromium-browser'].filter(Boolean);
 for(const name of choices)
  if(spawnSync(name,['--version'],{timeout:4000,stdio:'ignore'}).status===0)
   return name;
 throw Error('Real Chrome required to accept controlled-action LAB');
};
function fromPortFile(text){
 const a=typeof text==='string'?text.trim().split(/\r?\n/):[];
 return /^[0-9]{2,5}$/.test(a[0]??'')&&
  /^\/devtools\/browser\/[\w-]+$/.test(a[1]??'')?
  'ws://127.0.0.1:'+a[0]+a[1]:null;
}
test('clean-stack Action LABs load all five options in real DEV Chrome',
 {timeout:120000},async()=>{
 const chrome=chromeBinary(),temp=await mkdtemp(join(tmpdir(),'fa-action-labs-'));
 const server=createPreviewServer({subdomains:true});
 let proc=null,socket=null;
 try{
  server.listen(2000,'127.0.0.1');
  await once(server,'listening');
  proc=spawn(chrome,[
   '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
   '--no-proxy-server','--disable-extensions','--disable-background-networking',
   '--no-first-run','--no-default-browser-check','--remote-debugging-port=0',
   '--host-resolver-rules=MAP app.localhost 127.0.0.1',
   '--user-data-dir='+temp,'about:blank'
  ],{stdio:['ignore','ignore','pipe']});
  let stderr='';
  proc.stderr.on('data',c=>stderr+=c.toString());
  let endpoint=null;
  for(let i=0;i<220&&!endpoint;i++){
   endpoint=stderr.match(/DevTools listening on (ws:\/\/\S+)/)?.[1]??
    fromPortFile(await readFile(join(temp,'DevToolsActivePort'),'utf8')
     .catch(()=>null));
   if(proc.exitCode!==null||proc.signalCode!==null)
    throw Error('Chrome died: '+stderr.slice(-500));
   if(!endpoint)await delay(100);
  }
  assert.ok(endpoint,'Chrome debugger did not start: '+stderr.slice(-500));
  const host=new URL(endpoint).host;
  let tab=null;
  for(let i=0;i<40&&!tab;i++){
   try{tab=(await(await fetch('http://'+host+'/json/list')).json())
    .find(x=>x.type==='page');}catch{}
   if(!tab)await delay(100);
  }
  assert.ok(tab?.webSocketDebuggerUrl,'Chrome page missing');
  socket=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
   socket.addEventListener('open',resolve,{once:true});
   socket.addEventListener('error',reject,{once:true});
  });
  let id=0;const pending=new Map();
  socket.addEventListener('message',e=>{
   const msg=JSON.parse(e.data),p=pending.get(msg.id);
   if(!p)return;
   clearTimeout(p.timeout);pending.delete(msg.id);
   msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result);
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{
   const num=++id;const timeout=setTimeout(()=>{
    pending.delete(num);reject(Error('CDP timeout '+method));
   },15000);
   pending.set(num,{resolve,reject,timeout});
   socket.send(JSON.stringify({id:num,method,params}));
  });
  const evalJs=async expression=>{
   const v=await send('Runtime.evaluate',{
    expression,returnByValue:true,awaitPromise:true
   });
   if(v.exceptionDetails)
    throw Error(v.exceptionDetails.exception?.description||
     v.exceptionDetails.text);
   return v.result.value;
  };
  const wait=async expression=>{
   for(let i=0;i<120;i++){
    try{if(await evalJs(expression))return;}catch{}
    await delay(100);
   }
   throw Error('Timed out waiting for '+expression+
    ', page state '+JSON.stringify(await evalJs(
     "({location:location.href,status:document.querySelector('#status')?.textContent,modal:document.querySelector('#action-labs-dialog')?.open,actions:document.querySelector('#action-labs-status')?.textContent})"
    )));
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate',{
   url:'http://app.localhost:2000/dev/match-engine#actions'
  });
  await wait("document.querySelector('#action-labs-dialog')?.open===true");
  await wait("document.querySelector('#action-labs-status')?.textContent?.startsWith('Ready')");
  // Actual requestAnimationFrame transport, not a mock clock or forged ticks.
  const ready=await evalJs("(()=>{const play=document.getElementById('action-labs-play');"+
   "const pause=document.getElementById('action-labs-pause');"+
   "return {playDisabled:play.disabled,pauseDisabled:pause.disabled,"+
   "readout:document.getElementById('action-labs-readout').textContent};})()");
  assert.equal(ready.playDisabled,false);
  assert.equal(ready.pauseDisabled,true);
  assert.match(ready.readout,/Tick 0/);
  const launched=await evalJs("(()=>{document.getElementById('action-labs-play').click();"+
   "return {playing:document.getElementById('action-labs-play').disabled,"+
   "pauseEnabled:!document.getElementById('action-labs-pause').disabled};})()");
  assert.equal(launched.playing,true);
  assert.equal(launched.pauseEnabled,true);
  await wait("Number(document.getElementById('action-labs-readout').textContent.split(' ')[1])>=5");
  const paused=await evalJs("(()=>{document.getElementById('action-labs-pause').click();"+
   "const r=document.getElementById('action-labs-readout').textContent;"+
   "return {tick:Number(r.split(' ')[1]),playDisabled:document.getElementById('action-labs-play').disabled,"+
   "pauseDisabled:document.getElementById('action-labs-pause').disabled};})()");
  assert.ok(paused.tick>=5);
  assert.equal(paused.playDisabled,false);
  assert.equal(paused.pauseDisabled,true);
  await delay(220);
  const held=await evalJs("Number(document.getElementById('action-labs-readout').textContent.split(' ')[1])");
  assert.equal(held,paused.tick,'Pause must freeze genuine animation ticks');
  const stepped=await evalJs("(()=>{document.getElementById('action-labs-step').click();"+
   "const r=document.getElementById('action-labs-readout').textContent;"+
   "return {tick:Number(r.split(' ')[1]),paused:document.getElementById('action-labs-pause').disabled};})()");
  assert.equal(stepped.tick,paused.tick+1,'Step advances exactly one 60Hz world tick');
  assert.equal(stepped.paused,true);
  const resetState=await evalJs("(()=>{document.getElementById('action-labs-reset').click();"+
   "return {readout:document.getElementById('action-labs-readout').textContent,"+
   "playEnabled:!document.getElementById('action-labs-play').disabled,"+
   "pauseDisabled:document.getElementById('action-labs-pause').disabled};})()");
  assert.match(resetState.readout,/^Tick 0 /);
  assert.equal(resetState.playEnabled,true);
  assert.equal(resetState.pauseDisabled,true);
  process.stdout.write('ACTION_LAB_CHROME_TRANSPORT '+
   JSON.stringify({pausedTick:paused.tick,stepTick:stepped.tick,reset:resetState.readout})+'\\n');
  // Check genuine PASS, mirrored SHOT and separate receiver shoe CONTACT.
  // These are physical events only, never completed possession or dribble.
  for(const [choice,ticks,marker] of [
   ['pass',1,'genuine Rapier shoe START + PASS impulse'],
   ['shot',35,'Verified HOME SHOT'],
   ['challenge',12,null],
   ['control',90,'Observed: separate teammate shoe-ball contact after real pass'],
   ['carry',35,'Verified HOME CARRY:']
  ]){
   const result=await evalJs(
    "(()=>{const s=document.getElementById('action-labs-choice');"+
    "const btn=document.getElementById('action-labs-step');"+
    "s.value="+JSON.stringify(choice)+";"+
    "s.dispatchEvent(new Event('change',{bubbles:true}));"+
    "for(let i=0;i<"+ticks+";i++)btn.click();"+
    "return {selected:s.value,status:document.getElementById('action-labs-status').textContent,"+
    "readout:document.getElementById('action-labs-readout').textContent,"+
    "open:document.getElementById('action-labs-dialog').open};})()"
   );
   assert.equal(result.open,true);
   assert.equal(result.selected,choice);
   if(marker)assert.ok(result.status.includes(marker),
    choice+' missing real Rapier evidence: '+JSON.stringify(result));
   else assert.match(result.status,
    /No .* witness yet|genuine Rapier shoe START|Observed: actual|Observed: separate/,
    'A pending action must not become a fabricated positive');
   assert.match(result.readout,/Tick [0-9]+/);
   if(choice==='control'){
    assert.match(result.readout,/Physical PASS tick 1.*intended Home #9/);
    assert.match(result.readout,/Witnesses 1/);
    assert.doesNotMatch(result.status,/completed pass|possession confirmed/i);
   }
   if(choice==='carry'){
    assert.match(result.readout,/CARRY HOME · observed ground path [0-9.]+ m/);
    assert.match(result.readout,/Witnesses 1/);
    assert.doesNotMatch(result.status,/confirmed dribble|possession awarded/i);
   }
   // Explicit negative wording ('No official possession') is correct;
   // only a false positive AWARDED outcome must fail this test.
   assert.doesNotMatch(result.status,/goal scored|tackle successful|official possession (confirmed|awarded)/i);
   process.stdout.write('ACTION_LAB_CHROME_PASS '+JSON.stringify({
    choice,status:result.status,readout:result.readout
   })+'\n');
  }
  const challengeHome=await evalJs(
   "(()=>{const choice=document.getElementById('action-labs-choice');"+
   "choice.value='challenge';choice.dispatchEvent(new Event('change',{bubbles:true}));"+
   "const side=document.getElementById('action-labs-shot-side');"+
   "side.value='home';side.dispatchEvent(new Event('change',{bubbles:true}));"+
   "const scene=document.getElementById('action-labs-challenge-scene');"+
   "scene.value='contact';scene.dispatchEvent(new Event('change',{bubbles:true}));"+
   "for(let i=0;i<12;i++)document.getElementById('action-labs-step').click();"+
   "return {side:side.value,scene:scene.value,"+
   "sideVisible:!document.getElementById('action-labs-shot-side-label').hidden,"+
   "sceneVisible:!document.getElementById('action-labs-challenge-scene-label').hidden,"+
   "status:document.getElementById('action-labs-status').textContent,"+
   "readout:document.getElementById('action-labs-readout').textContent};})()"
  );
  assert.equal(challengeHome.side,'home');
  assert.equal(challengeHome.scene,'contact');
  assert.equal(challengeHome.sideVisible,true);
  assert.equal(challengeHome.sceneVisible,true);
  assert.match(challengeHome.status,/Observed: actual HOME shoe-ball START/);
  assert.match(challengeHome.readout,/Witnesses 1/);
  assert.doesNotMatch(challengeHome.status,/tackle successful|interception confirmed/i);
  process.stdout.write('ACTION_LAB_CHROME_CHALLENGE_HOME '+
   JSON.stringify(challengeHome)+'\\n');
  const challengeNone=await evalJs(
   "(()=>{const scene=document.getElementById('action-labs-challenge-scene');"+
   "scene.value='no-contact';scene.dispatchEvent(new Event('change',{bubbles:true}));"+
   "for(let i=0;i<90;i++)document.getElementById('action-labs-step').click();"+
   "const before={status:document.getElementById('action-labs-status').textContent,"+
   "readout:document.getElementById('action-labs-readout').textContent};"+
   "document.getElementById('action-labs-reset').click();"+
   "return {...before,reset:document.getElementById('action-labs-readout').textContent};})()"
  );
  assert.match(challengeNone.status,/No opponent-contact witness yet/);
  assert.match(challengeNone.readout,/Tick 90/);
  assert.match(challengeNone.readout,/Witnesses 0/);
  assert.match(challengeNone.reset,/Tick 0/);
  process.stdout.write('ACTION_LAB_CHROME_CHALLENGE_NO_CONTACT '+
   JSON.stringify(challengeNone)+'\\n');
  const challengeAway=await evalJs(
   "(()=>{const side=document.getElementById('action-labs-shot-side');"+
   "side.value='away';side.dispatchEvent(new Event('change',{bubbles:true}));"+
   "const scene=document.getElementById('action-labs-challenge-scene');"+
   "scene.value='contact';scene.dispatchEvent(new Event('change',{bubbles:true}));"+
   "for(let i=0;i<12;i++)document.getElementById('action-labs-step').click();"+
   "return {status:document.getElementById('action-labs-status').textContent,"+
   "readout:document.getElementById('action-labs-readout').textContent};})()"
  );
  assert.match(challengeAway.status,/Observed: actual AWAY shoe-ball START/);
  assert.match(challengeAway.readout,/Witnesses 1/);
  process.stdout.write('ACTION_LAB_CHROME_CHALLENGE_AWAY '+
   JSON.stringify(challengeAway)+'\\n');
  const carryAway=await evalJs(
   "(()=>{const choice=document.getElementById('action-labs-choice');"+
   "choice.value='carry';choice.dispatchEvent(new Event('change',{bubbles:true}));"+
   "const side=document.getElementById('action-labs-shot-side');"+
   "side.value='away';side.dispatchEvent(new Event('change',{bubbles:true}));"+
   "for(let i=0;i<35;i++)document.getElementById('action-labs-step').click();"+
   "return {side:side.value,visible:!document.getElementById('action-labs-shot-side-label').hidden,"+
   "status:document.getElementById('action-labs-status').textContent,"+
   "readout:document.getElementById('action-labs-readout').textContent};})()"
  );
  assert.equal(carryAway.side,'away');
  assert.equal(carryAway.visible,true);
  assert.match(carryAway.status,/Verified AWAY CARRY: exclusive real Rapier shoe START/);
  assert.match(carryAway.readout,/CARRY AWAY · observed ground path/);
  assert.doesNotMatch(carryAway.status,/confirmed dribble|possession awarded/i);
  process.stdout.write('ACTION_LAB_CHROME_AWAY_CARRY '+
   JSON.stringify(carryAway)+'\\n');
  const negativeControl=await evalJs(
   "(()=>{const action=document.getElementById('action-labs-choice');"+
   "action.value='control';action.dispatchEvent(new Event('change',{bubbles:true}));"+
   "const scene=document.getElementById('action-labs-control-scene');"+
   "scene.value='opponent-first';scene.dispatchEvent(new Event('change',{bubbles:true}));"+
   "for(let i=0;i<220;i++)document.getElementById('action-labs-step').click();"+
   "return {scene:scene.value,visible:!document.getElementById('action-labs-control-scene-label').hidden,"+
   "status:document.getElementById('action-labs-status').textContent,"+
   "readout:document.getElementById('action-labs-readout').textContent};})()"
  );
  assert.equal(negativeControl.scene,'opponent-first');
  assert.equal(negativeControl.visible,true);
  assert.match(negativeControl.status,
   /Observed: genuine Away #7 shoe-ball START before intended Home #9/);
  assert.match(negativeControl.status,/No verified reception, tackle or interception/);
  assert.match(negativeControl.readout,/Opposing shoe START tick 91/);
  assert.match(negativeControl.readout,/Witnesses 0/);
  assert.doesNotMatch(negativeControl.status,/successful tackle|confirmed interception|pass completed/i);
  process.stdout.write('ACTION_LAB_CHROME_OPPONENT_FIRST '+
   JSON.stringify(negativeControl)+'\\n');
  const away=await evalJs(
   "(()=>{const choice=document.getElementById('action-labs-choice');"+
   "choice.value='shot';choice.dispatchEvent(new Event('change',{bubbles:true}));"+
   "const side=document.getElementById('action-labs-shot-side');"+
   "const btn=document.getElementById('action-labs-step');"+
   "side.value='away';side.dispatchEvent(new Event('change',{bubbles:true}));"+
   "for(let i=0;i<35;i++)btn.click();"+
   "return {side:side.value,sideVisible:!document.getElementById('action-labs-shot-side-label').hidden,"+
   "status:document.getElementById('action-labs-status').textContent,"+
   "readout:document.getElementById('action-labs-readout').textContent};})()"
  );
  assert.equal(away.side,'away');
  assert.equal(away.sideVisible,true);
  assert.match(away.status,/Verified AWAY SHOT: exclusive shoe START.*observed 3D flight/);
  assert.match(away.readout,/SHOT AWAY · 3D path/);
  assert.doesNotMatch(away.status,/goal scored|official possession confirmed/i);
  process.stdout.write('ACTION_LAB_CHROME_AWAY_SHOT '+JSON.stringify(away)+'\\n');
  for(const side of ['home','away']){
   const blocked=await evalJs(
    "(()=>{const s=document.getElementById('action-labs-choice');"+
    "s.value='shot';s.dispatchEvent(new Event('change',{bubbles:true}));"+
    "const team=document.getElementById('action-labs-shot-side');"+
    "team.value="+JSON.stringify(side)+";team.dispatchEvent(new Event('change',{bubbles:true}));"+
    "const lanes=document.getElementById('action-labs-shot-lane');"+
    "lanes.value='blocked';lanes.dispatchEvent(new Event('change',{bubbles:true}));"+
    "document.getElementById('action-labs-step').click();"+
    "return {status:document.getElementById('action-labs-status').textContent,"+
    "readout:document.getElementById('action-labs-readout').textContent,"+
    "visible:!document.getElementById('action-labs-shot-lane-label').hidden,"+
    "lane:lanes.value,side:team.value};})()"
   );
   assert.equal(blocked.visible,true);
   assert.equal(blocked.lane,'blocked');
   assert.equal(blocked.side,side);
   assert.match(blocked.status,/Observed: genuine (HOME|AWAY) shoe START; original policy finds no open SHOT lane/);
   assert.match(blocked.readout,/All three SHOT lanes blocked/);
   assert.doesNotMatch(blocked.status,/Verified .*SHOT|goal scored/i);
   process.stdout.write('ACTION_LAB_CHROME_BLOCKED_'+side.toUpperCase()+
    ' '+JSON.stringify(blocked)+'\\n');
  }
  // Desktop-only LAB acceptance (owner scope, #620). No Safari/touch QA.
  for(const [width,height] of [[1280,720],[1440,900]]){
   await send('Emulation.setDeviceMetricsOverride',{
    width,height,deviceScaleFactor:1,mobile:false
   });
   const desktop=await evalJs("(()=>{"+
    "const d=document.getElementById('action-labs-dialog');"+
    "const r=d.getBoundingClientRect();"+
    "const pitch=document.getElementById('action-labs-pitch').getBoundingClientRect();"+
    "const toolbar=document.querySelector('.me-action-labs-toolbar');"+
    "const buttons=[...document.querySelectorAll('#action-labs-dialog button')].filter(el=>el.getBoundingClientRect().width>0);"+
    "return {viewport:innerWidth,dialogLeft:r.left,dialogRight:r.right,"+
    "dialogScrollWidth:d.scrollWidth,dialogClientWidth:d.clientWidth,"+
    "toolbarScrollWidth:toolbar.scrollWidth,toolbarClientWidth:toolbar.clientWidth,"+
    "pitchLeft:pitch.left,pitchRight:pitch.right,"+
    "buttonsVisible:buttons.every(el=>el.getBoundingClientRect().width>30),"+
    "opened:d.open};})()");
   assert.equal(desktop.viewport,width);
   assert.equal(desktop.opened,true);
   assert.ok(desktop.dialogLeft>=-2&&desktop.dialogRight<=width+2,
    'Action LAB dialog exceeds desktop viewport '+JSON.stringify(desktop));
   assert.ok(desktop.dialogScrollWidth<=desktop.dialogClientWidth+3,
    'Action LAB horizontal overflow '+JSON.stringify(desktop));
   assert.ok(desktop.toolbarScrollWidth<=desktop.toolbarClientWidth+3,
    'Action LAB toolbar overflow '+JSON.stringify(desktop));
   assert.ok(desktop.pitchLeft>=desktop.dialogLeft-2&&
    desktop.pitchRight<=desktop.dialogRight+2,
    'Action pitch exceeds dialog '+JSON.stringify(desktop));
   assert.equal(desktop.buttonsVisible,true);
   process.stdout.write('ACTION_LAB_CHROME_DESKTOP_VIEWPORT '+
    JSON.stringify({width,height,...desktop})+'\\n');
  }
  const close=await evalJs("(()=>{"+
   "document.getElementById('action-labs-close').click();"+
   "return !document.getElementById('action-labs-dialog').open;})()");
  assert.equal(close,true);
  await wait("document.querySelector('#status')?.textContent?.startsWith('Ready')");
 }finally{
  try{socket?.close();}catch{}
  if(proc)proc.kill();
  if(server.listening)await new Promise(ok=>server.close(ok));
  await rm(temp,{recursive:true,force:true,maxRetries:3,retryDelay:300});
 }
});
