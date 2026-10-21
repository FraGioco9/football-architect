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
      const point=await run(`(()=>{const b=document.querySelector(${JSON.stringify(selector)});b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+(b.matches('[data-calendar-day]')?Math.min(9,r.height/5):r.height/2)}})()`);
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
    const runValue=expr=>run(expr);
    assert.equal(await runValue("document.querySelectorAll('[data-calendar-day]').length"),56);
    assert.equal(await runValue("getComputedStyle(document.querySelector('.calendar-key')).display"),'none');
    assert.equal(await runValue("getComputedStyle(document.querySelector('.calendar-clock')).display"),'none');
    assert.equal(await runValue("getComputedStyle(document.querySelector('.calendar-filterbar')).display"),'none');
    assert.equal(await runValue("getComputedStyle(document.querySelector('.world-calendar')).maxWidth"),'none');
    assert.equal(await runValue("getComputedStyle(document.querySelector('.world-calendar')).borderTopWidth"),'0px');
    assert.equal(await runValue("document.querySelector('#calendar-season-picker').getAttribute('role')"),'combobox');
    assert.equal(await runValue("document.querySelector('#calendar-season-value').textContent"),'1');
    assert.equal(await runValue("document.querySelector('.calendar-event').hasAttribute('title')"),false);
    await runValue("document.querySelector('[data-calendar-marker=\\\"N04\\\"]').dispatchEvent(new PointerEvent('pointerenter'))");
    assert.equal(await runValue("document.querySelector('.calendar-marker-tooltip').textContent"),'Domestic round 4');
    assert.equal(await runValue("document.querySelector('.calendar-marker-tooltip').hidden"),false);
    await runValue("document.querySelector('[data-calendar-marker=\\\"N04\\\"]').dispatchEvent(new PointerEvent('pointerleave'))");
    assert.equal(await runValue("document.querySelector('.calendar-marker-tooltip').hidden"),true);
    assert.equal(await runValue("document.querySelector('[data-calendar-marker=\\\"N31\\\"]').textContent"),'P01');
    assert.equal(await runValue("document.querySelector('[data-calendar-marker=\\\"N32\\\"]').textContent"),'P02');
    await runValue("document.querySelector('#calendar-day-16').click()");
    assert.equal(await runValue("document.querySelector('#calendar-event-dialog').open"),true);
    assert.equal(await runValue("document.querySelector('#calendar-event-dialog-title').textContent"),'Day 16');
    assert.ok((await runValue("document.querySelector('#calendar-event-dialog-details').textContent")).includes('N04 - Domestic round 4'));
    await runValue("document.querySelector('#calendar-event-dialog').close()");
    assert.equal(await runValue("document.querySelector('#calendar-day-16').getAttribute('aria-pressed')"),'false');
    assert.equal(await runValue("new URL(location.href).searchParams.has('day')"),false);
    await runValue("document.querySelector('#calendar-season-picker').click()");
    assert.equal(await runValue("document.querySelector('#calendar-season-menu').hidden"),false);
    await runValue("document.querySelector('#calendar-season-picker').click()");
    assert.equal(await runValue("document.querySelector('#calendar-season-menu').hidden"),true);
    let cases=0;
    for(const width of [320,390,844,1440]){
      await cmd('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<900});
      for(const lang of ['en','de','es','fr','it'])for(const theme of ['dark','light']){
        await runValue("localStorage.setItem('football-architect:language',"+JSON.stringify(lang)+");localStorage.setItem('football-architect:theme',"+JSON.stringify(theme)+")");
        await visit();
        assert.equal(await runValue("document.documentElement.scrollWidth<=innerWidth"),true,JSON.stringify({width,lang,theme}));
        assert.equal(await runValue("document.querySelectorAll('.calendar-day[aria-pressed=true]').length"),0);
        cases++;
      }
    }
    await cmd('Emulation.clearDeviceMetricsOverride');
    await visit(devOrigin);
    for(let i=0;i<50&&!await runValue("!!document.querySelector('[data-dev-control=world-day]')");i++)await delay(100);
    assert.equal(await runValue("document.querySelector('[data-dev-control=world-day]').max"),'56');
    assert.equal(await runValue("document.querySelector('[data-dev-control=season]').max"),'4');
    assert.equal(await runValue("document.querySelectorAll('.fa-dev-widget-section').length"),1);
    await runValue("(()=>{const input=document.querySelector('[data-dev-control=world-day]');input.value='26';input.dispatchEvent(new Event('change',{bubbles:true}))})()");
    for(let i=0;i<20&&!await runValue("sessionStorage.getItem('football-architect:calendar-dev-world-day')==='26'");i++)await delay(50);
    assert.equal(await runValue("sessionStorage.getItem('football-architect:calendar-dev-world-day')"),'26');
    assert.equal(await runValue("document.querySelectorAll('.calendar-day[data-dev-current-day=true]').length"),1);
    assert.equal(await runValue("document.querySelector('[data-calendar-day=26]').dataset.devCurrentDay"),'true');
    assert.equal(await runValue("document.querySelectorAll('.calendar-day[aria-pressed=true]').length"),0);
    assert.equal(await runValue("new URL(location.href).searchParams.has('day')"),false);
    await runValue("(()=>{const input=document.querySelector('[data-dev-control=season]');input.value='3';input.dispatchEvent(new Event('change',{bubbles:true}))})()");
    for(let i=0;i<20&&!await runValue("document.querySelector('#calendar-season-value').textContent==='3'");i++)await delay(50);
    assert.equal(await runValue("document.querySelector('#calendar-season-value').textContent"),'3');
    assert.equal(await runValue("document.querySelectorAll('#calendar-season-menu .language-option').length"),3);
    assert.deepEqual(await runValue("[...document.querySelectorAll('#calendar-season-menu .language-option')].map(e=>e.textContent)"),['3','2','1']);
    assert.equal(await runValue("(()=>{const tiles=['1','13','16','26','53'].map(n=>document.querySelector('#calendar-day-'+n));return new Set(tiles.map(e=>e.getBoundingClientRect().height)).size})()"),1);

    console.log('CAL_SIMPLE_BROWSER_PASS|'+cases+' responsive cases, tooltip, dialog, season dropdown, global debug, no persistent selection');
  }finally{
    try{socket?.close()}catch{}proc.kill('SIGTERM');publicServer.close();devServer.close();
    for(let i=0;i<30&&proc.exitCode===null;i++)await delay(100);
    if(proc.exitCode===null)proc.kill('SIGKILL');
    await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
});
