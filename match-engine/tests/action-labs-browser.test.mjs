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
  // Real PASS is confirmed on the clean stack. The other four physical
  // trials must remain honest when their staged positive gates are absent.
  for(const [choice,ticks,marker] of [
   ['pass',1,'genuine Rapier shoe START + PASS impulse'],
   ['shot',35,null],
   ['challenge',12,null],
   ['control',90,null],
   ['carry',35,null]
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
   // Explicit negative wording ('No official possession') is correct;
   // only a false positive AWARDED outcome must fail this test.
   assert.doesNotMatch(result.status,/goal scored|tackle successful|official possession (confirmed|awarded)/i);
   process.stdout.write('ACTION_LAB_CHROME_PASS '+JSON.stringify({
    choice,status:result.status,readout:result.readout
   })+'\n');
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
