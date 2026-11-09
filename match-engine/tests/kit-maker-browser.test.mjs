// KM-03A: real Chrome smoke check for the private mannequin/jersey WebGL path.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {createPreviewServer} from '../../tools/dev-standings-preview.mjs';

function findChrome(){
  const win=process.platform==='win32'
    ? [process.env.ProgramFiles&&join(process.env.ProgramFiles,'Google','Chrome','Application','chrome.exe'),
       process.env['PROGRAMFILES(X86)']&&join(process.env['PROGRAMFILES(X86)'],'Google','Chrome','Application','chrome.exe'),
       process.env.LOCALAPPDATA&&join(process.env.LOCALAPPDATA,'Google','Chrome','Application','chrome.exe')]
    : [];
  for(const path of [process.env.CHROME_BIN,...win,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean)){
    if(spawnSync(path,['--version'],{timeout:4000,stdio:'ignore'}).status===0)return path;
  }
  throw new Error('Chrome required for Kit Maker browser QA (CHROME_BIN)');
}
test('KM-03A: real Chrome renders a white jersey on the bundled skinned mannequin',
  {timeout:90000},async()=>{
    const browser=findChrome();
    const temp=await mkdtemp(join(tmpdir(),'fa-km03-webgl-'));
    const server=createPreviewServer({subdomains:true});
    server.listen(2000,'127.0.0.1');
    await once(server,'listening');
    const chrome=spawn(browser,[
      '--headless=new','--no-sandbox','--disable-dev-shm-usage',
      '--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader',
      '--no-proxy-server','--disable-extensions',
      '--no-first-run','--no-default-browser-check',
      '--remote-debugging-port=0',
      '--host-resolver-rules=MAP app.localhost 127.0.0.1',
      '--user-data-dir='+temp,'about:blank'
    ],{stdio:['ignore','ignore','pipe']});
    let socket=null,stderr='';
    chrome.stderr.on('data',chunk=>stderr+=chunk.toString());
    try{
      let endpoint;
      for(let i=0;i<100&&!endpoint;i++){
        endpoint=stderr.match(/DevTools listening on (ws:\/\/\S+)/)?.[1];
        if(chrome.exitCode!==null)throw new Error('Chrome exited: '+stderr.slice(-700));
        if(!endpoint)await delay(120);
      }
      assert.ok(endpoint,'Chrome remote debugging unavailable: '+stderr.slice(-600));
      const remote=new URL(endpoint).host;
      let tab;
      for(let i=0;i<40&&!tab;i++){
        try{tab=(await (await fetch('http://'+remote+'/json/list')).json()).find(t=>t.type==='page');}catch{}
        if(!tab)await delay(100);
      }
      assert.ok(tab?.webSocketDebuggerUrl,'Chrome page target missing');
      socket=new WebSocket(tab.webSocketDebuggerUrl);
      await new Promise((resolve,reject)=>{
        socket.addEventListener('open',resolve,{once:true});
        socket.addEventListener('error',reject,{once:true});
      });
      let id=0;
      const pending=new Map();
      socket.addEventListener('message',event=>{
        const message=JSON.parse(event.data),waiting=pending.get(message.id);
        if(!waiting)return;
        pending.delete(message.id);
        clearTimeout(waiting.timer);
        message.error?waiting.reject(new Error(message.error.message)):waiting.resolve(message.result);
      });
      const command=(method,params={})=>new Promise((resolve,reject)=>{
        const ticket=++id;
        const timer=setTimeout(()=>{pending.delete(ticket);reject(new Error('CDP timeout '+method));},14000);
        pending.set(ticket,{resolve,reject,timer});
        socket.send(JSON.stringify({id:ticket,method,params}));
      });
      const evaluate=async(expression)=>{
        const answer=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
        if(answer.exceptionDetails)throw new Error(answer.exceptionDetails.text);
        return answer.result.value;
      };
      await command('Page.enable');
      await command('Runtime.enable');
      await command('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
      await command('Page.navigate',{url:'http://app.localhost:2000/dev/kit-maker'});
      let sample;
      for(let i=0;i<160;i++){
        sample=await evaluate(`(()=>{
          const status=document.getElementById('status')?.textContent||'';
          const canvas=document.getElementById('viewport');
          const columns=document.querySelector('.km-layout');
          const metrics=canvas?.getBoundingClientRect();
          return {
            loaded:document.readyState==='complete',
            status,
            title:document.getElementById('km-title')?.textContent,
            canvas:!!canvas,
            pixels:metrics?{width:metrics.width,height:metrics.height}:null,
            panels:document.querySelectorAll('.km-layout > .app-panel').length,
            clubText:document.getElementById('km-club-value')?.textContent,
            colorPanels:document.querySelectorAll('.km-color-option').length,
            grid:columns?getComputedStyle(columns).gridTemplateColumns:'',
            gl:!!(canvas?.getContext('webgl2')||canvas?.getContext('webgl'))
          };
        })()`);
        if(sample?.status?.includes('Neutral white short-sleeve jersey')||
          sample?.status?.includes('jersey preview unavailable'))break;
        await delay(150);
      }
      process.stdout.write('KM03_BROWSER '+JSON.stringify(sample)+'\n');
      assert.equal(sample?.loaded,true);
      assert.equal(sample?.title,'Kit Maker');
      assert.equal(sample?.panels,2);
      assert.equal(sample?.colorPanels,2);
      assert.ok(sample?.pixels?.width>300&&sample?.pixels?.height>400);
      assert.ok(sample?.gl,'GPU/software WebGL context required');
      assert.match(sample?.status||'',/Neutral white short-sleeve jersey/,
        'GLB and procedural jersey must both load: '+JSON.stringify(sample));
    }finally{
      socket?.close();
      if(chrome.exitCode===null)chrome.kill();
      await new Promise(resolve=>server.close(resolve));
      await rm(temp,{recursive:true,force:true,maxRetries:4,retryDelay:100});
    }
  }
);
