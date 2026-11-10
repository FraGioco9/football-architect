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
test('KM-18: real Chrome shows curved-stripe slider and retains garment settings',
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
            garmentButtons:document.querySelectorAll('[data-km-part]').length,
            styleButtons:document.querySelectorAll('[data-km-style]').length,
            stripeSlider:document.getElementById('km-stripe-width')?.type,
            stripeSliderMin:document.getElementById('km-stripe-width')?.min,
            stripeSliderMax:document.getElementById('km-stripe-width')?.max,
            stripeSliderStep:document.getElementById('km-stripe-width')?.step,
            stripeInitiallyHidden:document.getElementById('km-stripe-settings')?.hidden,
            selectedColor:document.querySelector('[data-km-color="neutral-white"]')?.getAttribute('aria-pressed'),
            grid:columns?getComputedStyle(columns).gridTemplateColumns:'',
            gl:!!(canvas?.getContext('webgl2')||canvas?.getContext('webgl'))
          };
        })()`);
        if(sample?.status?.includes('White jersey, shorts, socks and laces')||
          sample?.status?.includes('Kit loaded')||
          sample?.status?.includes('Outfit not found locally'))break;
        await delay(150);
      }
      process.stdout.write('KM03_BROWSER '+JSON.stringify(sample)+'\n');
      assert.equal(sample?.loaded,true);
      assert.equal(sample?.title,'Kit Maker');
      assert.equal(sample?.panels,2);
      assert.equal(sample?.colorPanels,6);
      assert.equal(sample?.garmentButtons,3);
      assert.equal(sample?.styleButtons,2);
      assert.equal(sample?.stripeSlider,'range');
      assert.equal(sample?.stripeSliderMin,'30');
      assert.equal(sample?.stripeSliderMax,'150');
      assert.equal(sample?.stripeSliderStep,'5');
      assert.equal(sample?.stripeInitiallyHidden,true);
      assert.equal(sample?.selectedColor,'true');
      const interactions=await evaluate(`(()=>{
        const find=key=>document.querySelector(key);
        find('[data-km-style="vertical-stripes"]').click();
        const shown=!document.getElementById('km-stripe-settings').hidden;
        const slider=find('#km-stripe-width');
        slider.value='115';
        slider.dispatchEvent(new Event('input',{bubbles:true}));
        const sliderReadout=find('#km-stripe-width-value').textContent;
        const sliderAria=slider.getAttribute('aria-valuetext');
        find('[data-km-layer="accent"]').click();
        find('[data-km-color="neutral-ivory"]').click();
        const stripeColor=find('[data-km-color="neutral-ivory"]').getAttribute('aria-pressed');
        const stripeWidth=slider.value;
        const stripeTitle=find('#km-colors-title').textContent;
        find('[data-km-part="shorts"]').click();
        const shortsSolid=find('[data-km-style="solid"]').getAttribute('aria-pressed');
        const shortsStripeHidden=document.getElementById('km-stripe-settings').hidden;
        find('[data-km-part="jersey"]').click();
        const jerseyRemembered=find('[data-km-style="vertical-stripes"]').getAttribute('aria-pressed');
        find('[data-km-style="solid"]').click();
        return {shown,stripeColor,stripeWidth,sliderReadout,sliderAria,stripeTitle,shortsSolid,
          shortsStripeHidden,jerseyRemembered,backToSolid:
          document.getElementById('km-stripe-settings').hidden};
      })()`);
      assert.deepEqual(interactions,{
        shown:true,stripeColor:'true',stripeWidth:'115',
        sliderReadout:'11.5 cm',sliderAria:'11.5 cm',
        stripeTitle:'Stripe color',shortsSolid:'true',
        shortsStripeHidden:true,jerseyRemembered:'true',backToSolid:true
      });
      assert.ok(sample?.pixels?.width>300&&sample?.pixels?.height>400);
      assert.ok(sample?.gl,'GPU/software WebGL context required');
      assert.match(sample?.status||'',
        /White jersey, shorts, socks and laces|Kit loaded|Outfit not found locally/,
        'Current owner-local GLB or safe missing-private-asset state required: '+JSON.stringify(sample));
    }finally{
      socket?.close();
      if(chrome.exitCode===null)chrome.kill();
      await new Promise(resolve=>server.close(resolve));
      await rm(temp,{recursive:true,force:true,maxRetries:4,retryDelay:100});
    }
  }
);
