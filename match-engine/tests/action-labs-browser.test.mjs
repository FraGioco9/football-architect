// #628 actual Chrome user journey: five small-sided situations are visible
// first; all seventeen original isolated Action LABs remain internal QA.
// Original Rapier source and Play/Pause/Step/Reset must remain functional.
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
test('small-sided 1v1–3v3 menu and archived 17 Action LABs retain real DEV Chrome behavior',
 {timeout:120000},async()=>{
 const chrome=chromeBinary(),temp=await mkdtemp(join(tmpdir(),'fa-action-labs-'));
 const server=createPreviewServer({subdomains:true});
 let proc=null,socket=null;
 try{
  server.listen(2000,'127.0.0.1');
  await once(server,'listening');
  proc=spawn(chrome,[
   '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
   '--window-size=1280,800',
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
   url:'http://app.localhost:2000/dev/match-engine'
  });
  await wait("document.querySelector('#status')?.textContent?.startsWith('Ready')&&document.querySelectorAll('#preset-options [role=option][data-value]').length===10");
  // Verify the visible small-sided scenario runs IN the main 105x68 field.
  const inline=await evalJs("(()=>{"+
   "document.getElementById('preset-trigger').click();"+
   "document.querySelector('#preset-options [data-value=\"action:keeper-1v1\"]').click();"+
   "return {popup:document.getElementById('action-labs-dialog').open,"+
   "movementPopup:document.getElementById('movement-labs-dialog').open,"+
   "selected:document.getElementById('preset-value').textContent,"+
   "tick:document.getElementById('tick').textContent,"+
   "physical:document.getElementById('me-inline-observation').textContent,"+
   "mainPitch:document.getElementById('pitch').getBoundingClientRect().width,"+
   "sideVisible:!document.getElementById('me-inline-side-control').hidden,"+
   "bodyControlAbsent:document.getElementById('me-inline-bodyguard')===null,"+
   "advancedHidden:document.getElementById('advanced-settings').hidden};})()");
  assert.equal(inline.popup,false);
  assert.equal(inline.movementPopup,false);
  assert.equal(inline.selected,'1v1 · goalkeeper');
  assert.match(inline.tick,/^Tick 0/);
  assert.match(inline.physical,/2 real physical players/);
  assert.ok(inline.mainPitch>300);
  assert.equal(inline.sideVisible,true);
  assert.equal(inline.bodyControlAbsent,true);
  assert.equal(inline.advancedHidden,true);
  // Replay/Next: VAR-01 changes genuine initial geometry only before tick
  // zero. Reset replays the exact same seed and HOME/AWAY keeps the index.
  const variation=await evalJs("(()=>{"+
   "const d=()=>document.getElementById('me-inline-variant-display').textContent;"+
   "const pos=()=>document.getElementById('position').textContent;"+
   "const visible=()=>!document.getElementById('me-inline-variant-control').hidden;"+
   "const first={name:d(),position:pos(),visible:visible()};"+
   "document.getElementById('me-inline-variant-next').click();"+
   "const second={name:d(),position:pos(),tick:document.getElementById('tick').textContent};"+
   "document.getElementById('step').click();"+
   "document.getElementById('reset').click();"+
   "const replay={name:d(),position:pos(),tick:document.getElementById('tick').textContent};"+
   "document.getElementById('me-inline-variant-prev').click();"+
   "const back={name:d(),position:pos()};"+
   "return {first,second,replay,back};})()");
  assert.equal(variation.first.visible,true);
  assert.equal(variation.first.name,'01 / 30');
  assert.equal(variation.second.name,'02 / 30');
  assert.equal(variation.replay.name,'02 / 30');
  assert.equal(variation.replay.tick,'Tick 0 · 0.00 s');
  assert.equal(variation.second.position,variation.replay.position);
  assert.notEqual(variation.first.position,variation.second.position);
  assert.deepEqual(variation.back, {name:'01 / 30',
   position:variation.first.position});
  process.stdout.write('ME_628_REPLAY_VARIATION_CHROME '+
   JSON.stringify(variation)+'\\n');
  // Visible LAB always includes real physical bodies, with no A/B toggle.
  const physicalBodies=await evalJs("(()=>{"+
   "const absent=()=>document.getElementById('me-inline-bodyguard')===null;"+
   "const initial=absent();"+
   "document.getElementById('me-inline-variant-next').click();"+
   "const v02={absent:absent(),variation:document.getElementById('me-inline-variant-display').textContent};"+
   "document.getElementById('step').click();document.getElementById('reset').click();"+
   "const reset={absent:absent(),tick:document.getElementById('tick').textContent};"+
   "document.getElementById('me-inline-variant-next').click();"+
   "const v03={absent:absent(),variation:document.getElementById('me-inline-variant-display').textContent};"+
   "document.getElementById('preset-trigger').click();"+
   "([...document.querySelectorAll('#preset-options [data-value]')].find(e=>e.dataset.value==='action:overload-2v1')).click();"+
   "const newScene={absent:absent(),variation:document.getElementById('me-inline-variant-display').textContent};"+
   "return {initial,v02,reset,v03,newScene,popup:document.getElementById('action-labs-dialog').open};})()");
  assert.equal(physicalBodies.initial,true);
  assert.deepEqual(physicalBodies.v02,{absent:true,variation:'02 / 30'});
  assert.deepEqual(physicalBodies.reset,{absent:true,tick:'Tick 0 · 0.00 s'});
  assert.deepEqual(physicalBodies.v03,{absent:true,variation:'03 / 30'});
  assert.deepEqual(physicalBodies.newScene,{absent:true,variation:'01 / 30'});
  assert.equal(physicalBodies.popup,false);
  process.stdout.write('ME_628_NATIVE_BODIES_ALWAYS_ON_CHROME '+
   JSON.stringify(physicalBodies)+'\\n');
  // Every visible Carry option has its own fixed phase, including both
  // mirrored sides and Reset. Real Rapier ball impulses are counted, not
  // imaginary native shoe starts or automatically awarded possession.
  for(const phase of ['control','moderate','sprint'])for(const side of ['home','away']){
   const key='action:carry-solo:'+phase;
   const chosen=await evalJs("(()=>{"+
    "document.getElementById('preset-trigger').click();"+
    "document.querySelector('#preset-options [data-value=\""+key+"\"]').click();"+
    "document.getElementById('me-inline-side-trigger').click();"+
    "document.querySelector('#me-inline-side-options [data-value=\""+side+"\"]').click();"+
    "for(let n=0;n<120;n++)document.getElementById('step').click();"+
    "const el=id=>document.getElementById(id);"+
    "const before={label:el('preset-value').textContent,tick:el('tick').textContent,"+
     "side:el('me-inline-side').value,readout:el('me-inline-observation').textContent,"+
     "rows:[...el('me-decisions-panel').querySelectorAll('.me-decision-row')].map(x=>x.textContent),"+
     "variation:el('me-inline-variant-display').textContent,"+
     "popup:el('action-labs-dialog').open};"+
    "el('reset').click();"+
    "el('step').click();"+
    "return {before,after:{tick:el('tick').textContent,"+
     "readout:el('me-inline-observation').textContent,"+
     "rows:[...el('me-decisions-panel').querySelectorAll('.me-decision-row')].map(x=>x.textContent)}};})()");
   assert.equal(chosen.before.label,'Carry · '+phase[0].toUpperCase()+phase.slice(1));
   assert.equal(chosen.before.side,side);
   assert.match(chosen.before.tick,/^Tick 120 /);
   assert.equal(chosen.before.variation,'01 / 30');
   assert.equal(chosen.before.popup,false);
   assert.match(chosen.before.readout,/1 real physical player/);
   assert.match(chosen.before.readout,/source events \d+\b/);
   assert.match(chosen.before.readout,new RegExp('phase '+phase.toUpperCase()+' \\(locked\\)'));
   assert.match(chosen.before.readout,/native shoe-confirmed Rapier impulses \d+/);
   assert.match(chosen.before.readout,/Native Carry · real two-shoe Rapier START required/);
   assert.doesNotMatch(chosen.before.readout,/Sprint long native stride/,
    'rejected A/B remains hidden from the visible LAB');
   if(phase==='sprint'){
    assert.match(chosen.before.readout,/native active-foot release 6 cm \(DEV Sprint only\)/);
    assert.match(chosen.after.readout,/native active-foot release 6 cm \(DEV Sprint only\)/);
    assert.match(chosen.before.readout,/adaptive ball-gap pursuit \(DEV Sprint only\)/);
    assert.match(chosen.after.readout,/adaptive ball-gap pursuit \(DEV Sprint only\)/);
   }else{
    assert.doesNotMatch(chosen.before.readout,/native active-foot release/);
    assert.doesNotMatch(chosen.before.readout,/adaptive ball-gap pursuit/);
   }
   assert.doesNotMatch(chosen.before.readout,/Solo Carry intent/);
   assert.match(chosen.before.readout,/no official result/);
   assert.equal(chosen.before.rows.length,1);
   assert.match(chosen.before.rows[0],new RegExp('Carry the ball · '+phase[0].toUpperCase()+phase.slice(1)));
   assert.match(chosen.after.tick,/^Tick 1 /);
   assert.match(chosen.after.readout,new RegExp('phase '+phase.toUpperCase()+' \\(locked\\)'));
   assert.match(chosen.after.rows[0],new RegExp('Carry the ball · '+phase[0].toUpperCase()+phase.slice(1)));
   process.stdout.write('ME_628_FIXED_PHASE_CHROME '+
    JSON.stringify({phase,side,...chosen})+'\n');
  }
  // Rated Carry profiles are real selection controls, not decorative data.
  // They reset the *same* Rapier player+ball LAB with the generated model's
  // four relevant source attributes at a uniform 90 or 25.
  const rated=await evalJs("(()=>{"+
   "const el=id=>document.getElementById(id);"+
   "el('preset-trigger').click();"+
   "document.querySelector('#preset-options [data-value=\\\"action:carry-solo:sprint\\\"]').click();"+
   "const visible=!el('me-inline-rating-control').hidden;"+
   "el('me-inline-rating-trigger').click();"+
   "document.querySelector('#me-inline-rating-options [data-value=\\\"90\\\"]').click();"+
   "for(let i=0;i<120;i++)el('step').click();"+
   "const ninety={rating:el('me-inline-rating').value,"+
    "readout:el('me-inline-observation').textContent,"+
    "tick:el('tick').textContent,visible:!el('me-inline-rating-control').hidden};"+
   "el('me-inline-rating-trigger').click();"+
   "document.querySelector('#me-inline-rating-options [data-value=\\\"25\\\"]').click();"+
   "const twentyFive={rating:el('me-inline-rating').value,"+
    "tick:el('tick').textContent,readout:el('me-inline-observation').textContent};"+
   "el('preset-trigger').click();"+
   "document.querySelector('#preset-options [data-value=\\\"action:keeper-1v1\\\"]').click();"+
   "return {visible,ninety,twentyFive,otherHidden:el('me-inline-rating-control').hidden};"+
   "})()");
  assert.equal(rated.visible,true);
  assert.equal(rated.ninety.rating,'90');
  assert.equal(rated.ninety.visible,true);
  assert.match(rated.ninety.tick,/^Tick 120 /);
  assert.match(rated.ninety.readout,/attributes 90\/99/);
  assert.match(rated.ninety.readout,/ball forward [0-9.]+ m/);
  assert.match(rated.ninety.readout,/peak player [0-9.]+ km\/h/);
  assert.match(rated.ninety.readout,/mean gap [0-9.]+ m/);
  assert.equal(rated.twentyFive.rating,'25');
  assert.equal(rated.twentyFive.tick,'Tick 0 · 0.00 s');
  assert.match(rated.twentyFive.readout,/attributes 25\/99/);
  assert.equal(rated.otherHidden,true);
  process.stdout.write('ME_628_RATED_CARRY_CHROME '+JSON.stringify(rated)+'\\n');
  // Preserve native Rapier assertions for the other visible situations.
  for(const [scene,actors] of [
   ['keeper-1v1',2],['overload-2v1',4],['duel-3v3',7]
  ])for(const side of ['home','away']){
   const x=await evalJs("(()=>{"+
    "document.getElementById('preset-trigger').click();"+
    "document.querySelector('#preset-options [data-value=\"action:"+scene+"\"]').click();"+
    "document.getElementById('me-inline-side-trigger').click();"+
    "document.querySelector('#me-inline-side-options [data-value=\""+side+"\"]').click();"+
    "for(let n=0;n<10;n++)document.getElementById('step').click();"+
    "return {side:document.getElementById('me-inline-side').value,"+
    "tick:document.getElementById('tick').textContent,"+
    "observation:document.getElementById('me-inline-observation').textContent,"+
    "bodyControlAbsent:document.getElementById('me-inline-bodyguard')===null,"+
    "popup:document.getElementById('action-labs-dialog').open};})()");
   assert.equal(x.side,side);
   assert.equal(x.bodyControlAbsent,true,'visible LAB must not expose a body toggle');
   assert.equal(x.popup,false);
   assert.match(x.tick,/^Tick 10/);
   assert.match(x.observation,new RegExp(actors+' real physical '+(actors===1?'player':'players')));
   assert.match(x.observation,/source events [1-9]/);
   assert.match(x.observation,/provisional 0–0/);
   assert.match(x.observation,/no official result/);
   process.stdout.write('ME_628_INLINE_CHROME '+JSON.stringify({scene,side,...x})+'\n');
  }
  // Play, Pause, Step, Reset on the ACTUAL main toolbar, not the modal.
  await evalJs("(()=>{document.getElementById('preset-trigger').click();"+
   "document.querySelector('#preset-options [data-value=\"action:keeper-1v1\"]').click();"+
   "document.getElementById('play').click();})()");
  await wait("Number(document.getElementById('tick').textContent.match(/^Tick (\\d+)/)?.[1])>=5");
  const pauseTick=await evalJs("(()=>{document.getElementById('pause').click();"+
   "return Number(document.getElementById('tick').textContent.match(/^Tick (\\d+)/)?.[1]);})()");
  await delay(220);
  const still=await evalJs("Number(document.getElementById('tick').textContent.match(/^Tick (\\d+)/)?.[1])");
  assert.equal(still,pauseTick);
  const inlineStepped=await evalJs("(()=>{document.getElementById('step').click();"+
   "return Number(document.getElementById('tick').textContent.match(/^Tick (\\d+)/)?.[1]);})()");
  assert.equal(inlineStepped,pauseTick+1);
  const reset=await evalJs("(()=>{document.getElementById('reset').click();"+
   "return {tick:document.getElementById('tick').textContent,"+
   "popup:document.getElementById('action-labs-dialog').open};})()");
  assert.equal(reset.tick,'Tick 0 · 0.00 s');
  assert.equal(reset.popup,false);
  process.stdout.write('ME_628_INLINE_MAIN_TRANSPORT '+
   JSON.stringify({pauseTick,inlineStepped,reset})+'\n');
  // Real current-tick decisions for all on-field participants; never
  // manufacture a carry, completed pass, possession or defender action.
  const carryDecisions=await evalJs("(()=>{"+
   "document.getElementById('preset-trigger').click();"+
   "document.querySelector('#preset-options [data-value=\\\"action:carry-solo:moderate\\\"]').click();"+
   "document.getElementById('me-inline-side-trigger').click();"+
   "document.querySelector('#me-inline-side-options [data-value=\\\"home\\\"]').click();"+
   "for(let n=0;n<60;n++)document.getElementById('step').click();"+
   "const el=id=>document.getElementById(id),panel=el('me-decisions-panel');"+
   "return {visible:!panel.hidden,rows:[...panel.querySelectorAll('.me-decision-row')].map(x=>x.textContent),"+
   "count:el('me-decisions-count').textContent,ballChartHidden:el('me-elevation-panel').hidden,"+
   "log:el('me-decisions-event-count').textContent};})()");
  assert.equal(carryDecisions.visible,true);
  assert.equal(carryDecisions.count,'1 on field');
  assert.equal(carryDecisions.rows.length,1);
  assert.equal(carryDecisions.ballChartHidden,true);
  assert.ok(carryDecisions.rows.some(x=>/HOME #10.*Carry the ball · (Control|Moderate|Sprint).*Target:/s.test(x)));
  assert.ok(carryDecisions.rows.every(x=>!x.includes('AWAY #')),
   'Carry has no defending player visible');
  assert.ok(carryDecisions.rows.some(x=>/Last verified action: carry/.test(x)),
   'Carry must reflect a real Rapier ball impulse without asserting shoe contact');
  await evalJs("document.getElementById('reset').click()");
  const resetDecisions=await evalJs("(()=>{const p=document.getElementById('me-decisions-panel');"+
   "return {players:p.querySelectorAll('.me-decision-row').length,events:document.getElementById('me-decisions-event-count').textContent};})()");
  assert.equal(resetDecisions.players,1);
  assert.equal(resetDecisions.events,'0 changes/actions');
  process.stdout.write('ME_628_CARRY_CURRENT_DECISIONS '+JSON.stringify({carryDecisions,resetDecisions})+'\\n');
  // Only the *hidden* DEV fixture launcher is allowed to open the old
  // one-action regression dialog; visible Scenario never does this.
  await evalJs("document.getElementById('action-labs-open').click()");
  await wait("document.getElementById('action-labs-dialog').open&&document.getElementById('action-labs-status').textContent.startsWith('Ready')");
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
  // Exercise each VISIBLE small-sided situation in real Chrome on HOME/AWAY.
  // The 2–7 authentic native shoe colliders are separately verified by
  // the real-physics Node tests, never just a visual filter here.
  for(const [choice,players] of [
   ['dribble-1v1',2],['keeper-1v1',2],['defender-1v1',3],['overload-2v1',4],
   ['duel-2v2',5],['duel-3v3',7]
  ])for(const side of ['home','away']){
   const state=await evalJs("(()=>{"+
    "const choice=document.getElementById('action-labs-choice');"+
    "choice.value="+JSON.stringify(choice)+";"+
    "choice.dispatchEvent(new Event('change',{bubbles:true}));"+
    "const team=document.getElementById('action-labs-shot-side');"+
    "team.value="+JSON.stringify(side)+";"+
    "team.dispatchEvent(new Event('change',{bubbles:true}));"+
    "for(let i=0;i<10;i++)document.getElementById('action-labs-step').click();"+
    "return {choice:choice.value,team:team.value,"+
    "title:document.getElementById('action-labs-title').textContent,"+
    "readout:document.getElementById('action-labs-readout').textContent,"+
    "status:document.getElementById('action-labs-status').textContent,"+
    "sideVisible:!document.getElementById('action-labs-shot-side-label').hidden};})()"
   );
   assert.equal(state.choice,choice);
   assert.equal(state.team,side);
   assert.equal(state.sideVisible,true);
   assert.match(state.readout,/Tick 10 /);
   assert.match(state.readout,/Witnesses [1-9]/,
    'Visible '+choice+'/'+side+' needs an original Rapier action');
   assert.match(state.readout,/B06 00:00 · LAB 0–0/);
   assert.doesNotMatch(state.status,/goal scored|possession awarded|tackle successful/i);
   process.stdout.write('ME_628_SMALL_CHROME '+JSON.stringify({
    choice,side,players,readout:state.readout})+'\\n');
  }
  await evalJs("(()=>{const team=document.getElementById('action-labs-shot-side');"+
   "team.value='home';team.dispatchEvent(new Event('change',{bubbles:true}));})()");
  // Keep all 17 original contact scenes executable by the hidden catalog
  // to preserve the earlier physical and negative regression coverage.
  // Check genuine PASS, mirrored SHOT and separate receiver shoe CONTACT.
  // These are physical events only, never completed possession or dribble.
  for(const [choice,ticks,marker] of [
   ['pass',1,'genuine Rapier shoe START + PASS impulse'],
   ['shot',35,'Verified HOME SHOT'],
    ['cross',35,'Verified HOME CROSS'],
    ['save',35,'Verified HOME SAVE'],
    ['tackle',35,'Verified HOME TACKLE'],
    ['interception',35,'Verified HOME INTERCEPTION'],
    ['trap',55,'Verified HOME TRAP physical attempt'],
    ['dribble',150,'Verified DRIBBLE physical sequence'],
    ['goal',35,'Observed genuine full-ball GOAL crossing'],
    ['touchline',35,'Observed genuine full-ball touchline exit'],
    ['goal-line-out',35,'Observed genuine full-ball goal-line exit'],
    ['throw-in',55,'B05b provisional THROW-IN'],
    ['corner',55,'B05b physical CORNER'],
    ['goal-kick',55,'B05b physical GOAL-KICK'],
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
   if(['goal','touchline','goal-line-out','throw-in','corner','goal-kick'].includes(choice)){
    assert.match(result.readout,/B06 00:00 · LAB [0-9]+–[0-9]+ · match events [1-3]/,
     'B06 must display source-measured clock and provisional goals in same Scenario menu');
    if(choice==='goal')assert.match(result.readout,/B06 00:00 · LAB 1–0 · match events 2/);
    else assert.match(result.readout,/B06 00:00 · LAB 0–0/);
    assert.match(result.readout,/unofficial/);
   }
   if(choice==='touchline'||choice==='goal-line-out'){
    assert.match(result.readout,/^Tick (?:11|12) /,
     'unresolved dead ball freezes at its actual full-ball boundary tick');
   }
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
  const cushionMode=await evalJs(
   "(()=>{const action=document.getElementById('action-labs-choice');"+
   "action.value='control';action.dispatchEvent(new Event('change',{bubbles:true}));"+
   "const scene=document.getElementById('action-labs-control-scene');"+
   "scene.value='receive-cushion';scene.dispatchEvent(new Event('change',{bubbles:true}));"+
   "for(let i=0;i<35;i++)document.getElementById('action-labs-step').click();"+
   "return {scene:scene.value,visible:!document.getElementById('action-labs-control-scene-label').hidden,"+
   "status:document.getElementById('action-labs-status').textContent,"+
   "readout:document.getElementById('action-labs-readout').textContent};})()"
  );
  assert.equal(cushionMode.scene,'receive-cushion');
  assert.equal(cushionMode.visible,true);
  assert.match(cushionMode.status,/bounded physical first-touch impulse/);
  assert.match(cushionMode.readout,/Real first-touch cushion/);
  assert.match(cushionMode.readout,/pressure [0-9.]+ m/);
  assert.doesNotMatch(cushionMode.status,/possession confirmed|reception granted/i);
  process.stdout.write('ACTION_LAB_M25_GENUINE_CUSHION_CHROME '+
   JSON.stringify(cushionMode)+'\\n');
  const livePressure=await evalJs(
   "(()=>{const action=document.getElementById('action-labs-choice');"+
   "action.value='control';action.dispatchEvent(new Event('change',{bubbles:true}));"+
   "const scene=document.getElementById('action-labs-control-scene');"+
   "scene.value='receive-pressure';scene.dispatchEvent(new Event('change',{bubbles:true}));"+
   "for(let i=0;i<95;i++)document.getElementById('action-labs-step').click();"+
   "return {scene:scene.value,visible:!document.getElementById('action-labs-control-scene-label').hidden,"+
   "status:document.getElementById('action-labs-status').textContent,"+
   "readout:document.getElementById('action-labs-readout').textContent};})()"
  );
  assert.equal(livePressure.scene,'receive-pressure');
  assert.equal(livePressure.visible,true);
  assert.match(livePressure.readout,/closest opponent|Live defender/);
  assert.doesNotMatch(livePressure.status,/possession awarded|confirmed control|tackle won/i);
  process.stdout.write('ACTION_LAB_M26_REAL_LIVE_PRESSURE_CHROME '+
   JSON.stringify(livePressure)+'\\n');
  const tacticalChoice=await evalJs(
   "(()=>{const action=document.getElementById('action-labs-choice');"+
   "action.value='control';action.dispatchEvent(new Event('change',{bubbles:true}));"+
   "const scene=document.getElementById('action-labs-control-scene');"+
   "scene.value='receive-pressure-decide';scene.dispatchEvent(new Event('change',{bubbles:true}));"+
   "for(let i=0;i<67;i++)document.getElementById('action-labs-step').click();"+
   "return {scene:scene.value,visible:!document.getElementById('action-labs-control-scene-label').hidden,"+
   "status:document.getElementById('action-labs-status').textContent,"+
   "readout:document.getElementById('action-labs-readout').textContent};})()"
  );
  assert.equal(tacticalChoice.scene,'receive-pressure-decide');
  assert.equal(tacticalChoice.visible,true);
  assert.match(tacticalChoice.status,/original clearance applied under observed pressure/);
  assert.match(tacticalChoice.readout,/Native choice release existing clearance/);
  assert.doesNotMatch(tacticalChoice.status,/possession granted|verified control|tackle won/i);
  process.stdout.write('ACTION_LAB_M27_PHYSICAL_TACTICS_CHROME '+
   JSON.stringify(tacticalChoice)+'\\n');
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
  // Three fixed Carry LABs plus three other real small-sided exercises
  // and four physics presets. The automatic phase fixture stays archived.
  // Research and negative-control fixtures are still available internally.
  const nav=await evalJs("(()=>{const menu=document.getElementById('preset-options');"+
   "const trigger=document.getElementById('preset-trigger');"+
   "return {items:menu.querySelectorAll('[role=option][data-value]').length,"+
   "groups:[...menu.querySelectorAll('.me-scenario-group-label')].map(x=>x.textContent),"+
   "hiddenLaunches:['action-labs-open','movement-labs-open'].every(id=>"+
    "getComputedStyle(document.getElementById(id)).display==='none'),"+
   "hiddenChoices:['action-labs-choice','movement-labs-choice'].every(id=>"+
    "getComputedStyle(document.getElementById(id)).display==='none'),"+
   "unique:document.querySelectorAll('[data-me-dropdown=preset]').length===1,"+
   "noSecondSelector:document.getElementById('lab-all-situations')===null,"+
   "current:trigger.textContent.trim()};})()");
  assert.equal(nav.items,10);
  assert.deepEqual(nav.groups,['Carry phases','Small-sided situations','Ball physics']);
  for(const key of ['hiddenLaunches','hiddenChoices','unique','noSecondSelector'])
   assert.equal(nav[key],true,key);
  const ballNav=await evalJs("(()=>{const t=document.getElementById('preset-trigger');"+
   "t.click();document.getElementById('preset-opt-roll').click();"+
   "return {preset:document.getElementById('preset').value,"+
   "selected:document.getElementById('preset-value').textContent};})()");
  assert.deepEqual(ballNav,{
   preset:'roll',selected:'LAB-04 · Ball Roll (Grass)'
  });
  await evalJs("(()=>{document.getElementById('preset-trigger').click();"+
   "document.getElementById('preset-opt-drop').click();})()");
  // Visible scene switching keeps the same field, no popup.
  const actionNav=await evalJs("(()=>{document.getElementById('preset-trigger').click();"+
   "document.querySelector('#preset-options [data-value=\"action:duel-3v3\"]').click();"+
   "return {open:document.getElementById('action-labs-dialog').open,"+
   "choice:document.getElementById('preset-value').textContent,"+
   "tick:document.getElementById('tick').textContent};})()");
  assert.deepEqual(actionNav,{open:false,choice:'3v3 · team decisions',tick:'Tick 0 · 0.00 s'});
  await evalJs("(()=>{document.getElementById('preset-trigger').click();"+
   "document.getElementById('preset-opt-drop').click();})()");
  await wait("document.getElementById('preset-value').textContent==='LAB-01 · Ball Drop'");
  const visibleMovement=await evalJs("[...document.querySelectorAll('#preset-options [data-value^=\"movement:\"]')].map(x=>x.dataset.value).sort()");
  assert.deepEqual(visibleMovement,[],
   'movement-only research stays hidden from the fixed Carry LAB menu');
  process.stdout.write('ME_628_SINGLE_INLINE_SCENARIO_NAV '+
   JSON.stringify({nav,ball:ballNav,action:actionNav,visibleMovement})+'\n');
  // #628 M2: actual desktop movement dialog on the same DEV page.
  // It has no Rapier shoe colliders; do not confuse measured motion with
  // the seventeen real same-world ball/feet Action LABs above.
  // Archive-only movement fixture through hidden QA launcher, never the
  // visible Scenario picker.
  const movementOpened=await evalJs("(()=>{"+
   "document.getElementById('movement-labs-open').click();"+
   "return document.getElementById('movement-labs-dialog').open;})()");
  assert.equal(movementOpened,true);
  await wait("document.getElementById('movement-labs-readout').textContent.startsWith('Tick 0')");
  const movedFirst=await evalJs("(()=>{"+
   "document.getElementById('movement-labs-play').click();"+
   "return document.getElementById('movement-labs-play').disabled;})()");
  assert.equal(movedFirst,true);
  await wait("Number(document.getElementById('movement-labs-readout').textContent.split(' ')[1])>=3");
  const movementPause=await evalJs("(()=>{"+
   "document.getElementById('movement-labs-pause').click();"+
   "return {tick:Number(document.getElementById('movement-labs-readout').textContent.split(' ')[1]),"+
   "play:document.getElementById('movement-labs-play').disabled,"+
   "pause:document.getElementById('movement-labs-pause').disabled};})()");
  assert.equal(movementPause.play,false);assert.equal(movementPause.pause,true);
  const moveStep=await evalJs("(()=>{"+
   "document.getElementById('movement-labs-step').click();"+
   "return Number(document.getElementById('movement-labs-readout').textContent.split(' ')[1]);})()");
  assert.equal(moveStep,movementPause.tick+1);
  for(const [choice,side] of [
   ['approach','home'],['approach','away'],
   ['brake','home'],['brake','away'],
   ['turn','home'],['turn','away'],
   ['recovery','home'],['recovery','away']
  ]){
   const read=await evalJs(
    "(()=>{const c=document.getElementById('movement-labs-choice');"+
    "const s=document.getElementById('movement-labs-side');"+
    "c.value="+JSON.stringify(choice)+";c.dispatchEvent(new Event('change',{bubbles:true}));"+
    "s.value="+JSON.stringify(side)+";s.dispatchEvent(new Event('change',{bubbles:true}));"+
    "for(let i=0;i<18;i++)document.getElementById('movement-labs-step').click();"+
    "return {choice:c.value,side:s.value,readout:document.getElementById('movement-labs-readout').textContent,"+
    "status:document.getElementById('movement-labs-status').textContent};})()");
   assert.equal(read.choice,choice);
   assert.equal(read.side,side);
   assert.match(read.readout,/^Tick 18 /);
   assert.match(read.readout,/min 22-body gap [0-9.]+ m/);
   assert.match(read.status,/no shoe collider, touch, possession or result/);
   assert.doesNotMatch(read.status,/scored goal|successful tackle|pass completed/i);
   process.stdout.write('MOVEMENT_LAB_CHROME_SOURCE '+JSON.stringify(read)+'\n');
  }
  // #628 M3: authenticated HOME PASS must PRECEDE actual HOME #9 motion.
  const afterPass=await evalJs("(()=>{"+
   "const c=document.getElementById('movement-labs-choice');"+
   "const side=document.getElementById('movement-labs-side');"+
   "side.value='home';side.dispatchEvent(new Event('change',{bubbles:true}));"+
   "c.value='post-pass';c.dispatchEvent(new Event('change',{bubbles:true}));"+
   "for(let i=0;i<100;i++)document.getElementById('movement-labs-step').click();"+
   "return {status:document.getElementById('movement-labs-status').textContent,"+
   "readout:document.getElementById('movement-labs-readout').textContent,"+
   "side:side.value,sideDisabled:side.disabled};})()");
  assert.equal(afterPass.side,'home');
  assert.equal(afterPass.sideDisabled,false);
  assert.match(afterPass.readout,/Physical PASS tick 1 · post-pass path [0-9.]+ m/);
  assert.match(afterPass.status,/actual receiver movement after authentic Rapier PASS/);
  assert.doesNotMatch(afterPass.status,/completed pass|possession awarded|goal scored/i);
  process.stdout.write('MOVEMENT_LAB_M3_POSTPASS '+JSON.stringify(afterPass)+'\n');

  // M4: independent genuine AWAY #10 Rapier PASS precedes AWAY #9
  // observed motion. A UI-side mirror is not source authentication.
  const awayPostPass=await evalJs("(()=>{"+
   "const side=document.getElementById('movement-labs-side');"+
   "side.value='away';side.dispatchEvent(new Event('change',{bubbles:true}));"+
   "for(let i=0;i<100;i++)document.getElementById('movement-labs-step').click();"+
   "return {side:side.value,disabled:side.disabled,"+
   "readout:document.getElementById('movement-labs-readout').textContent,"+
   "status:document.getElementById('movement-labs-status').textContent};})()");
  assert.equal(awayPostPass.side,'away');
  assert.equal(awayPostPass.disabled,false);
  assert.match(awayPostPass.readout,/away #9/);
  assert.match(awayPostPass.readout,/Physical PASS tick 1 · post-pass path [0-9.]+ m/);
  assert.match(awayPostPass.status,/Observed: actual receiver movement after authentic Rapier PASS/);
  assert.doesNotMatch(awayPostPass.status,/completed pass|possession awarded|goal scored/i);
  process.stdout.write('MOVEMENT_LAB_M4_AWAY_POSTPASS '+JSON.stringify(awayPostPass)+'\n');

  for(const [choice,side] of [
   ['recovery-response','home'],['recovery-response','away'],
   ['recovery-empty','home'],['recovery-empty','away']
  ]){
   const response=await evalJs(
    "(()=>{const c=document.getElementById('movement-labs-choice');"+
    "const side=document.getElementById('movement-labs-side');"+
    "c.value="+JSON.stringify(choice)+";c.dispatchEvent(new Event('change',{bubbles:true}));"+
    "side.value="+JSON.stringify(side)+";side.dispatchEvent(new Event('change',{bubbles:true}));"+
    "for(let i=0;i<180;i++)document.getElementById('movement-labs-step').click();"+
    "return {status:document.getElementById('movement-labs-status').textContent,"+
    "readout:document.getElementById('movement-labs-readout').textContent,"+
    "side:side.value,sideDisabled:side.disabled};})()");
   assert.equal(response.side,side);assert.equal(response.sideDisabled,false);
   assert.match(response.readout,/^Tick 180 /);
   if(choice==='recovery-response'){
    assert.match(response.readout,/goal-side path [0-9.]+ m · opponent/);
    assert.match(response.status,/goal-side recovery witness|real assigned goal-side movement/);
   }else{
    assert.match(response.status,/Negative control: no current-opponent recovery witness yet/);
   }
   assert.doesNotMatch(response.status,/interception confirmed|tackle successful|possession awarded/i);
   process.stdout.write('MOVEMENT_LAB_M3_RECOVERY '+JSON.stringify({choice,side,...response})+'\n');
  }
  // M5: the accepted original opponent-first CONTROL must produce real shoe
  // START after physical PASS, with genuine opponent XY movement.
  const contest=await evalJs("(()=>{"+
   "const c=document.getElementById('movement-labs-choice');"+
   "const s=document.getElementById('movement-labs-side');"+
   "c.value='opponent-contact';c.dispatchEvent(new Event('change',{bubbles:true}));"+
   "for(let i=0;i<110;i++)document.getElementById('movement-labs-step').click();"+
   "return {scene:c.value,side:s.value,disabled:s.disabled,"+
   "readout:document.getElementById('movement-labs-readout').textContent,"+
   "status:document.getElementById('movement-labs-status').textContent};})()");
  assert.equal(contest.scene,'opponent-contact');
  assert.equal(contest.side,'home');
  assert.equal(contest.disabled,true,'only source-accepted HOME opposition scene');
  assert.match(contest.readout,/^Tick 110 /);
  assert.match(contest.readout,/real opponent away-7 · observed path [0-9.]+ m/);
  assert.match(contest.readout,/opponent shoe START 91/);
  assert.match(contest.readout,/closest player gap [0-9.]+ m/);
  assert.match(contest.status,/Observed: original opposing Rapier shoe-ball START/);
  assert.match(contest.status,/Body collision, tackle, interception, possession and completed pass NOT verified/);
  process.stdout.write('MOVEMENT_LAB_M5_OPPOSITION '+JSON.stringify(contest)+'\n');
  // Reset must erase physical evidence; merely selecting a scene does not
  // create contact. The ordinary post-PASS choice unlocks HOME/AWAY again.
  const resetContest=await evalJs("(()=>{"+
   "document.getElementById('movement-labs-reset').click();"+
   "return {readout:document.getElementById('movement-labs-readout').textContent,"+
   "status:document.getElementById('movement-labs-status').textContent};})()");
  assert.match(resetContest.readout,/^Tick 0 /);
  assert.match(resetContest.readout,/opponent shoe START none/);
  assert.match(resetContest.status,/No opponent physical shoe witness yet/);
  const unlocked=await evalJs("(()=>{"+
   "const c=document.getElementById('movement-labs-choice');"+
   "c.value='post-pass';c.dispatchEvent(new Event('change',{bubbles:true}));"+
   "return !document.getElementById('movement-labs-side').disabled;})()");
  assert.equal(unlocked,true);
  // M6: real free runner and original support clearance HOME/AWAY
  // from one canonical 22-player mover, never a fake pass completion.
  for(const [kind,team] of [
   ['support-lane','home'],['support-lane','away'],
   ['support-neutral','home'],['support-neutral','away']
  ]){
   const data=await evalJs(
    "(()=>{const c=document.getElementById('movement-labs-choice');"+
    "const s=document.getElementById('movement-labs-side');"+
    "c.value="+JSON.stringify(kind)+";c.dispatchEvent(new Event('change',{bubbles:true}));"+
    "s.value="+JSON.stringify(team)+";s.dispatchEvent(new Event('change',{bubbles:true}));"+
    "for(let t=0;t<220;t++)document.getElementById('movement-labs-step').click();"+
    "return {choice:c.value,side:s.value,tick:document.getElementById('movement-labs-readout').textContent,"+
    "status:document.getElementById('movement-labs-status').textContent};})()");
   assert.equal(data.choice,kind);assert.equal(data.side,team);
   assert.match(data.tick,/^Tick 220 /);
   if(kind==='support-lane'){
    assert.match(data.tick,/support (home|away)-[0-9]+ · lane (positive-y|negative-y)/);
    assert.match(data.tick,/target advance [0-9.]+ m/);
    assert.match(data.status,/Observed: real original support-runner progress/);
   }else{
    assert.match(data.tick,/support none · lane none · observed path 0.00 m/);
    assert.match(data.status,/No current support movement witness/);
   }
   assert.doesNotMatch(data.status,/completed pass|official possession|goal awarded/i);
   process.stdout.write('MOVEMENT_LAB_M6_SUPPORT '+JSON.stringify(data)+'\n');
  }
  // M7: real Rapier 22-body dynamic colliders share original ball World,
  // but their solver XY is research-only, not canonically reconciled.
  for(const [choice,side] of [
   ['body-world','home'],['body-world','away'],
   ['body-off','home'],['body-off','away']
  ]){
   const native=await evalJs(
    "(()=>{const c=document.getElementById('movement-labs-choice');"+
    "const s=document.getElementById('movement-labs-side');"+
    "c.value="+JSON.stringify(choice)+";c.dispatchEvent(new Event('change',{bubbles:true}));"+
    "s.value="+JSON.stringify(side)+";s.dispatchEvent(new Event('change',{bubbles:true}));"+
    "for(let t=0;t<110;t++)document.getElementById('movement-labs-step').click();"+
    "return {choice:c.value,side:s.value,readout:document.getElementById('movement-labs-readout').textContent,"+
    "status:document.getElementById('movement-labs-status').textContent};})()");
   assert.equal(native.choice,choice);assert.equal(native.side,side);
   assert.match(native.readout,/^Tick 110 /);
   if(choice==='body-world'){
    assert.match(native.readout,/Rapier native bodies 22 · genuine starts [0-9]+/);
    assert.match(native.readout,/min physical gap [0-9.]+ m · max mover difference [0-9.]+ m/);
    assert.match(native.status,/22 native Rapier body colliders active|original-world native Rapier body collider START/);
   }else{
    assert.match(native.readout,/Rapier native bodies 0 · genuine starts 0 · min physical gap none/);
    assert.match(native.status,/Negative control: native body colliders OFF/);
   }
   assert.match(native.status,/Physical XY is not reconciled to canonical mover/);
   assert.doesNotMatch(native.status,/tackle confirmed|interception successful|possession awarded/i);
   process.stdout.write('MOVEMENT_LAB_M7_NATIVE_BODIES '+JSON.stringify(native)+'\n');
  }
  // M8: real native collision START in the same Rapier World and bounded
  // canonical mover feedback, never an official football event.
  for(const [choice,side] of [
   ['body-encounter','home'],['body-encounter','away'],
   ['body-encounter-off','home'],['body-encounter-off','away']
  ]){
   const witnessed=await evalJs(
    "(()=>{const c=document.getElementById('movement-labs-choice');"+
    "const s=document.getElementById('movement-labs-side');"+
    "c.value="+JSON.stringify(choice)+";c.dispatchEvent(new Event('change',{bubbles:true}));"+
    "s.value="+JSON.stringify(side)+";s.dispatchEvent(new Event('change',{bubbles:true}));"+
    "for(let t=0;t<90;t++)document.getElementById('movement-labs-step').click();"+
    "return {choice:c.value,side:s.value,readout:document.getElementById('movement-labs-readout').textContent,"+
    "status:document.getElementById('movement-labs-status').textContent};})()");
   assert.equal(witnessed.choice,choice);assert.equal(witnessed.side,side);
   assert.match(witnessed.readout,/^Tick 90 /);
   if(choice==='body-encounter'){
    assert.match(witnessed.readout,/Rapier native bodies 22 · genuine starts [1-9][0-9]*/);
    assert.match(witnessed.readout,/actual mover responses [1-9][0-9]*/);
    assert.match(witnessed.status,/Observed: real original-world Rapier collision START/);
   }else{
    assert.match(witnessed.readout,/Rapier native bodies 0 · genuine starts 0/);
    assert.match(witnessed.readout,/actual mover responses 0/);
    assert.match(witnessed.status,/Negative: the same 22-player approach has native bodies OFF/);
   }
   assert.match(witnessed.status,/Research only: no simultaneous foot contact, official tackle or possession/);
   process.stdout.write('MOVEMENT_LAB_M8_RECONCILED '+JSON.stringify(witnessed)+'\n');
  }
  // M9: one genuine Rapier event queue, physical shoe/body sources
  // independently reported; no synthetic pass/tackle/possession.
  for(const [scene,side] of [
   ['shared-contacts','home'],['shared-contacts','away'],
   ['shared-contacts-off','home'],['shared-contacts-off','away']
  ]){
   const observed=await evalJs(
    "(()=>{const c=document.getElementById('movement-labs-choice');"+
    "const s=document.getElementById('movement-labs-side');"+
    "c.value="+JSON.stringify(scene)+";c.dispatchEvent(new Event('change',{bubbles:true}));"+
    "s.value="+JSON.stringify(side)+";s.dispatchEvent(new Event('change',{bubbles:true}));"+
    "for(let t=0;t<95;t++)document.getElementById('movement-labs-step').click();"+
    "return {choice:c.value,side:s.value,readout:document.getElementById('movement-labs-readout').textContent,"+
    "status:document.getElementById('movement-labs-status').textContent};})()");
   assert.equal(observed.choice,scene);assert.equal(observed.side,side);
   assert.match(observed.readout,/^Tick 95 /);
   if(scene==='shared-contacts'){
    assert.match(observed.readout,/Rapier native bodies 22 · genuine starts [1-9][0-9]*/);
    assert.match(observed.readout,/actual mover responses [1-9][0-9]*/);
    assert.match(observed.readout,/single native queue true · genuine shoe STARTs [1-9][0-9]*/);
    assert.match(observed.status,/Verified: native body START and canonical feedback in one shared Rapier queue/);
   }else{
    assert.match(observed.readout,/Rapier native bodies 0 · genuine starts 0/);
    assert.match(observed.readout,/single native queue false · genuine shoe STARTs 0/);
    assert.match(observed.status,/Negative: shared physics OFF/);
   }
   assert.match(observed.status,/No official pass, tackle or possession/);
   process.stdout.write('MOVEMENT_LAB_M9_SHARED_NATIVE_EVENTS '+JSON.stringify(observed)+'\n');
  }
  // M10: original unchanged 22-player autonomous pressing / support,
  // both same-world native observers live but no scripted encounter.
  for(const [scene,side] of [
   ['pressure-support','home'],['pressure-support','away'],
   ['pressure-neutral','home'],['pressure-neutral','away']
  ]){
   const measured=await evalJs(
    "(()=>{const c=document.getElementById('movement-labs-choice');"+
    "const s=document.getElementById('movement-labs-side');"+
    "c.value="+JSON.stringify(scene)+";c.dispatchEvent(new Event('change',{bubbles:true}));"+
    "s.value="+JSON.stringify(side)+";s.dispatchEvent(new Event('change',{bubbles:true}));"+
    "for(let t=0;t<180;t++)document.getElementById('movement-labs-step').click();"+
    "return {choice:c.value,side:s.value,readout:document.getElementById('movement-labs-readout').textContent,"+
    "status:document.getElementById('movement-labs-status').textContent};})()");
   assert.equal(measured.choice,scene);assert.equal(measured.side,side);
   assert.match(measured.readout,/^Tick 180 /);
   assert.match(measured.readout,/Rapier native bodies 22/);
   assert.match(measured.readout,/single native queue true/);
   if(scene==='pressure-support'){
    assert.match(measured.readout,/support (?:home|away)-[0-9]+ · lane (?:positive-y|negative-y)/);
    assert.match(measured.readout,/real opposing presser (?:home|away)-[0-9]+/);
    assert.match(measured.readout,/actual presser path [0-9.]+ m/);
    assert.match(measured.status,/Verified: original unstaged support run with actual moving opposing presser/);
   }else{
    assert.match(measured.readout,/support none · lane none/);
    assert.match(measured.status,/No original support assignment/);
   }
   assert.match(measured.status,/Neither proximity nor presser motion certifies a tackle, possession or pass/);
   process.stdout.write('MOVEMENT_LAB_M10_UNSTAGED '+JSON.stringify(measured)+'\n');
  }
  // M12 genuine unstaged original opposing press convergence.
  // One shared native Rapier queue, normal player formation and 0.49m
  // bodies. Positive is native START of the original press pair ONLY.
  for(const [choice,side] of [
   ['opposing-convergence','home'],['opposing-convergence','away'],
   ['opposing-convergence-off','home'],['opposing-convergence-off','away']
  ]){
   const measured=await evalJs(
    "(()=>{const c=document.getElementById('movement-labs-choice');"+
    "const s=document.getElementById('movement-labs-side');"+
    "c.value="+JSON.stringify(choice)+";c.dispatchEvent(new Event('change',{bubbles:true}));"+
    "s.value="+JSON.stringify(side)+";s.dispatchEvent(new Event('change',{bubbles:true}));"+
    "for(let t=0;t<100;t++)document.getElementById('movement-labs-step').click();"+
    "return {choice:c.value,side:s.value,readout:document.getElementById('movement-labs-readout').textContent,"+
    "status:document.getElementById('movement-labs-status').textContent};})()");
   assert.equal(measured.choice,choice);
   assert.equal(measured.side,side);
   assert.match(measured.readout,/^Tick 100 /);
   assert.match(measured.readout,/Rapier native bodies 22/);
   assert.match(measured.readout,/single native queue true/);
   if(choice==='opposing-convergence'){
    assert.match(measured.readout,/original convergence active true/);
    assert.match(measured.readout,/native opposing STARTs [1-9][0-9]*/);
    assert.match(measured.readout,/closest observed opposing pair 0\.98 m/);
    assert.match(measured.status,/Verified: two original opposing pressers converged naturally on actual ball/);
   }else{
    assert.match(measured.readout,/original convergence active false/);
    assert.match(measured.readout,/native opposing STARTs 0/);
    assert.match(measured.status,/Negative: source-grounded press-to-ball convergence OFF/);
   }
   assert.match(measured.status,/no tackle, official possession or body feedback/);
   process.stdout.write('MOVEMENT_LAB_M12_NATIVE_PRESS '+JSON.stringify(measured)+'\n');
  }
  // M13: real original-source M12 contested press, actual native
  // solver-to-22-player movement acknowledgment versus the exact same
  // unstaged native contact with feedback DISABLED.
  for(const [choice,side] of [
   ['opposing-feedback','home'],['opposing-feedback','away'],
   ['opposing-feedback-off','home'],['opposing-feedback-off','away']
  ]){
   const measured=await evalJs(
    "(()=>{const c=document.getElementById('movement-labs-choice');"+
    "const s=document.getElementById('movement-labs-side');"+
    "c.value="+JSON.stringify(choice)+";c.dispatchEvent(new Event('change',{bubbles:true}));"+
    "s.value="+JSON.stringify(side)+";s.dispatchEvent(new Event('change',{bubbles:true}));"+
    "for(let t=0;t<110;t++)document.getElementById('movement-labs-step').click();"+
    "return {choice:c.value,side:s.value,readout:document.getElementById('movement-labs-readout').textContent,"+
    "status:document.getElementById('movement-labs-status').textContent};})()");
   assert.equal(measured.choice,choice);
   assert.equal(measured.side,side);
   assert.match(measured.readout,/^Tick 110 /);
   assert.match(measured.readout,/Rapier native bodies 22/);
   assert.match(measured.readout,/single native queue true/);
   assert.match(measured.readout,/genuine starts [1-9]/);
   if(choice==='opposing-feedback'){
    assert.match(measured.readout,/accepted native corrections [1-9][0-9]*/);
    assert.match(measured.readout,/corrected mover true/);
    assert.match(measured.status,/Verified: source-authenticated unstaged Rapier body START/);
   }else{
    assert.match(measured.readout,/accepted native corrections 0/);
    assert.match(measured.readout,/corrected mover false/);
    assert.match(measured.status,/Negative: same original spontaneous Rapier body contact/);
   }
   assert.match(measured.status,/no official tackle, possession or pass/);
   process.stdout.write('MOVEMENT_LAB_M13_ACTUAL_FEEDBACK '+JSON.stringify(measured)+'\n');
  }
  // M21: the previously audit-only M14–M20 situations are NOW live,
  // selectable physical 22-player scenes in the actual Chrome Movement LAB.
  // Show TRUE Rapier events and actual HOME/AWAY source; never imply a
  // successful tackle or possession from proximity alone.
  const naturalIds=[
   'native-roll-observe','native-roll-feedback','native-roll-control',
   'native-flank-left','native-flank-right','secondary-pressure-off',
   'secondary-pressure','secondary-pressure-observe'
  ];
  for(const choice of naturalIds)for(const side of ['home','away']){
   const sample=await evalJs(
    "(()=>{const c=document.getElementById('movement-labs-choice');"+
    "const s=document.getElementById('movement-labs-side');"+
    "c.value="+JSON.stringify(choice)+";c.dispatchEvent(new Event('change',{bubbles:true}));"+
    "s.value="+JSON.stringify(side)+";s.dispatchEvent(new Event('change',{bubbles:true}));"+
    "for(let t=0;t<35;t++)document.getElementById('movement-labs-step').click();"+
    "return {choice:c.value,side:s.value,total:c.options.length,"+
    "status:document.getElementById('movement-labs-status').textContent,"+
    "readout:document.getElementById('movement-labs-readout').textContent};})()");
   assert.equal(sample.total,30,'all implemented original scenes visible');
   assert.equal(sample.choice,choice);
   assert.equal(sample.side,side);
   assert.match(sample.readout,/^Tick 35 /);
   assert.match(sample.readout,/real 22-player Rapier/);
   assert.match(sample.readout,/genuine body STARTs [0-9]+/);
   assert.match(sample.readout,/shoe STARTs [0-9]+/);
   assert.match(sample.readout,/minimum canonical spacing [0-9.]+ m/);
   if(choice==='secondary-pressure'||choice==='secondary-pressure-observe')
    assert.match(sample.status,/second defensive marker assigned|no eligible second marker this tick/);
   else assert.match(sample.status,/secondary marking OFF/);
   assert.match(sample.status,/Proximity is NOT a verified collision/);
   assert.match(sample.status,/No official tackle, possession or score/);
   if(choice.endsWith('-observe')||choice==='native-roll-control')
    assert.match(sample.readout,/applied solver responses 0/);
   process.stdout.write('MOVEMENT_LAB_M21_CHROME_ALL_SCENES '+
    JSON.stringify(sample)+'\\n');
  }
  for(const [width,height] of [[1280,720],[1440,900]]){
   await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
   const size=await evalJs("(()=>{const d=document.getElementById('movement-labs-dialog');"+
    "const box=d.getBoundingClientRect();"+
    "const field=document.getElementById('movement-labs-pitch').getBoundingClientRect();"+
    "return {open:d.open,left:box.left,right:box.right,scroll:d.scrollWidth,client:d.clientWidth,"+
    "fieldLeft:field.left,fieldRight:field.right,width:innerWidth};})()");
   assert.equal(size.open,true);assert.equal(size.width,width);
   assert.ok(size.left>=-2&&size.right<=width+2,JSON.stringify(size));
   assert.ok(size.scroll<=size.client+3,JSON.stringify(size));
   assert.ok(size.fieldLeft>=size.left-2&&size.fieldRight<=size.right+2,JSON.stringify(size));
  }
  const motionReset=await evalJs("(()=>{document.getElementById('movement-labs-reset').click();"+
   "return document.getElementById('movement-labs-readout').textContent;})()");
  assert.match(motionReset,/^Tick 0 /);
  await evalJs("document.getElementById('movement-labs-close').click()");
  await wait("document.getElementById('movement-labs-dialog').open===false");
  await wait("document.querySelector('#status')?.textContent?.startsWith('Ready')");
 }finally{
  try{socket?.close();}catch{}
  if(proc)proc.kill();
  if(server.listening)await new Promise(ok=>server.close(ok));
  await rm(temp,{recursive:true,force:true,maxRetries:3,retryDelay:300});
 }
});
