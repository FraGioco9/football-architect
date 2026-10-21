// Real Chrome QA on isolated loopback public/DEV servers. No deployment.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {join,extname} from 'node:path';
import {tmpdir} from 'node:os';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';
import {isAllowlistedPublicPath,publicRequestFile} from '../tools/publication-guard.mjs';

function chrome(){
  const windows=process.platform==='win32'?[
    process.env.ProgramFiles&&join(process.env.ProgramFiles,'Google/Chrome/Application/chrome.exe'),
    process.env['PROGRAMFILES(X86)']&&join(process.env['PROGRAMFILES(X86)'],'Google/Chrome/Application/chrome.exe'),
    process.env.LOCALAPPDATA&&join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe')]:[];
  for(const bin of [process.env.CHROME_BIN,...windows,'google-chrome','google-chrome-stable','chromium','chromium-browser'].filter(Boolean))
    if(spawnSync(bin,['--version'],{stdio:'ignore',timeout:4000}).status===0)return bin;
  throw Error('Chrome required for CAL-IMP-02 browser QA; set CHROME_BIN');
}

test('CAL-IMP-02 real browser: Season/Week, 5 languages, Dark/Light, 320/390/844/1440, restoration and keyboard',{timeout:150000},async()=>{
  const binary=chrome(); // Fail before opening any server if Chrome is unavailable.
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
  const publicServer=createServer(async(req,res)=>{
    try{
      const path=publicRequestFile(new URL(req.url,'http://localhost').pathname);
      if(!isAllowlistedPublicPath(path))throw Error('Not public');
      const bytes=await readFile(new URL('../'+path,import.meta.url));
      res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
    }catch{res.writeHead(404);res.end('Not found')}
  });
  const router=createPreviewServer(),devServer=createServer((req,res)=>{req.headers.host='127.0.0.1:2000';router.emit('request',req,res)});
  publicServer.listen(0,'127.0.0.1');devServer.listen(0,'127.0.0.1');
  await Promise.all([once(publicServer,'listening'),once(devServer,'listening')]);
  const origin='http://127.0.0.1:'+publicServer.address().port,devOrigin='http://127.0.0.1:'+devServer.address().port;
  const profile=await mkdtemp(join(tmpdir(),'fa-calendar-browser-'));
  const proc=spawn(binary,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-proxy-server','--disable-background-networking','--disable-extensions','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
  let stderr='',socket;proc.stderr.on('data',b=>stderr+=b.toString());
  try{
    let endpoint;
    for(let i=0;i<100&&!endpoint;i++){endpoint=stderr.match(/DevTools listening on (ws:\/\/\S+)/)?.[1];if(!endpoint)await delay(100)}
    assert.ok(endpoint,'Calendar Chrome DevTools: '+stderr.slice(-500));
    const tabs=await (await fetch('http://'+new URL(endpoint).host+'/json/list')).json();
    socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});
    let sequence=0;const pending=new Map();
    socket.addEventListener('message',e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)});
    const cmd=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('Calendar CDP timeout: '+method))},12000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}))});
    const run=async expression=>{const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value};
    async function click(selector){
      const point=await run(`(()=>{const b=document.querySelector(${JSON.stringify(selector)});b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
      await cmd('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
      await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
    }
    async function visit(base=origin){
      await cmd('Page.navigate',{url:base+'/calendar'});
      for(let i=0;i<100;i++){if(await run("location.href.startsWith("+JSON.stringify(base)+")&&document.readyState==='complete'&&document.documentElement.dataset.calendarReady==='true'"))return;await delay(100)}
      throw Error('Calendar did not initialize: '+JSON.stringify(await run('({url:location.href,errors:window.__calendarErrors})')));
    }
    const measure=()=>run(`(()=>{const root=document.getElementById('world-calendar'),visible=[...root.querySelectorAll('[data-calendar-day]')].filter(b=>b.getClientRects().length),rows=[...root.querySelectorAll('[data-week]')].filter(r=>r.getClientRects().length);return {view:document.documentElement.dataset.calendarView,selection:window.faWorldCalendar.getSelection(),rows:rows.length,visible:visible.length,scroll:root.scrollWidth,width:root.clientWidth,body:document.documentElement.scrollWidth,viewport:innerWidth,clipped:[...root.querySelectorAll('button,.calendar-event,.calendar-day-kind,.calendar-note,.calendar-selected')].filter(n=>n.getClientRects().length&&n.scrollWidth>n.clientWidth+1).map(n=>n.className+':'+n.textContent),errors:window.__calendarErrors}})()`);
    await cmd('Page.enable');await cmd('Runtime.enable');
    await cmd('Page.addScriptToEvaluateOnNewDocument',{source:"window.__calendarErrors=[];addEventListener('error',e=>window.__calendarErrors.push(e.message));addEventListener('unhandledrejection',e=>window.__calendarErrors.push(String(e.reason)));"});
    await visit();
    let cases=0;
    for(const [width,height,mobile] of [[1440,1050,false],[390,1000,true],[320,1000,true],[844,390,true]]){
      await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
      await cmd('Emulation.setTouchEmulationEnabled',{enabled:mobile});
      for(const theme of ['dark','light'])for(const lang of ['en','de','es','fr','it']){
        await run(`sessionStorage.removeItem('football-architect:calendar-selection');localStorage.setItem('football-architect:theme',${JSON.stringify(theme)});localStorage.setItem('football-architect:language',${JSON.stringify(lang)})`);
        await visit();
        let state=await measure();assert.equal(state.view,mobile?'week':'season',JSON.stringify({width,theme,lang,state}));
        assert.equal(await run('document.documentElement.lang'),lang);
        if(lang!=='en')assert.notEqual(await run("document.getElementById('calendar-note').textContent"),'Season structure only. No live fixtures or results are available.');
        for(const view of ['season','week']){
          // Select a visible day with real pointer input, then switch to the requested view.
          await click('#calendar-season');await click('#calendar-day-16');await click('#calendar-'+view);
          state=await measure();
          assert.equal(state.visible,view==='season'?56:7);assert.equal(state.rows,view==='season'?8:1);
          assert.equal(state.selection.day,16);assert.equal(state.selection.view,view);
          assert.ok(state.scroll<=state.width+1&&state.body<=state.viewport+1,JSON.stringify({width,theme,lang,view,state}));
          assert.deepEqual(state.clipped,[],JSON.stringify({width,theme,lang,view,state}));assert.deepEqual(state.errors,[]);
          assert.equal(await run("[...document.querySelector('#calendar-day-16').querySelectorAll('[data-calendar-marker]')].map(n=>n.textContent).join('|')"),'I01|N04');
          if(lang==='en'&&((width===1440&&theme==='dark'&&view==='season')||(width===390&&theme==='dark')||(width===320&&theme==='light'&&view==='season'))){
            const shot=await cmd('Page.captureScreenshot',{format:'jpeg',quality:70,captureBeyondViewport:false});
            const label='CALENDAR '+width+' '+theme+' '+view,chunks=shot.data.match(/.{1,4096}/g)||[];
            chunks.forEach((part,i)=>console.log('FA_VISUAL_FRAME|'+label+'|'+i+'|'+chunks.length+'|'+part));
          }
          cases++;
        }
      }
    }
    // Native keyboard navigation, week boundaries and persisted reload across resize.
    await run("document.getElementById('calendar-season').click();document.getElementById('calendar-day-16').focus()");
    await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
    assert.equal(await run('window.faWorldCalendar.getSelection().day'),23);
    assert.equal(await run('document.activeElement.id'),'calendar-day-23');
    await run("document.getElementById('calendar-week').click()");
    await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
    assert.equal((await measure()).selection.day,23);assert.equal((await measure()).view,'week');
    await visit();assert.equal((await measure()).selection.day,23);assert.equal((await measure()).view,'week');
    for(let i=0;i<3;i++)await click('#calendar-next');
    await run("document.getElementById('calendar-next').focus()");
    await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',windowsVirtualKeyCode:13});
    await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    assert.equal(await run('document.documentElement.dataset.calendarWeek'),'8');
    assert.equal(await run("document.getElementById('calendar-next').disabled"),true);
    assert.equal(await run('document.activeElement.id'),'calendar-day-51');
    await run("document.getElementById('calendar-day-56').click()");
    assert.equal((await measure()).selection.day,56);
    assert.equal(await run("document.querySelectorAll('#world-calendar [aria-current]').length"),0);
    // DEV serves exactly the same public calendar and never turns it into simulated live time.
    await visit(devOrigin);assert.ok(await run("!!window.faWorldCalendar&&document.getElementById('calendar-note').textContent.length>20"));
    assert.deepEqual((await measure()).errors,[]);
    // Storage-denied browsers still retain working in-page controls.
    const blocked=await cmd('Page.addScriptToEvaluateOnNewDocument',{source:"Object.defineProperty(window,'sessionStorage',{get(){throw Error('Storage denied for QA')}})"});
    await visit();await run("document.getElementById('calendar-season').click();document.getElementById('calendar-day-54').click()");
    assert.equal((await measure()).selection.day,54);assert.deepEqual((await measure()).errors,[]);
    await cmd('Page.removeScriptToEvaluateOnNewDocument',{identifier:blocked.identifier});
    // Without script execution all 56 static plan days remain readable.
    await cmd('Emulation.setScriptExecutionDisabled',{value:true});
    await cmd('Page.navigate',{url:origin+'/calendar'});
    for(let i=0;i<100;i++){if(await run("document.readyState==='complete'&&!!document.getElementById('world-calendar')"))break;await delay(50)}
    assert.equal(await run("[...document.querySelectorAll('[data-calendar-day]')].filter(b=>b.getClientRects().length).length"),56);
    assert.equal(await run("document.querySelectorAll('[data-calendar-day]:not(:disabled)').length"),0);
    await cmd('Emulation.setScriptExecutionDisabled',{value:false});
    console.log('CALENDAR_BROWSER_PASS|'+cases+' viewport/theme/language/view cases; public/DEV; native keyboard; restore/resize; storage denied; no overflow; no invented current day');
  }finally{
    try{socket?.close()}catch{}proc.kill('SIGTERM');publicServer.close();devServer.close();
    for(let i=0;i<30&&proc.exitCode===null;i++)await delay(100);
    if(proc.exitCode===null)proc.kill('SIGKILL');
    await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
});
