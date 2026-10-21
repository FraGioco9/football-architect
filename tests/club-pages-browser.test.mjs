// CLUB-01 real browser checks against staged public bytes and the DEV router.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,extname} from 'node:path';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {repositoryRoot,stagePublicArtifact,publicRequestFile} from '../tools/publication-guard.mjs';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const chrome=()=>{
  const windows=process.platform==="win32"?[
    process.env.ProgramFiles&&join(process.env.ProgramFiles,"Google","Chrome","Application","chrome.exe"),
    process.env["PROGRAMFILES(X86)"]&&join(process.env["PROGRAMFILES(X86)"],"Google","Chrome","Application","chrome.exe"),
    process.env.LOCALAPPDATA&&join(process.env.LOCALAPPDATA,"Google","Chrome","Application","chrome.exe")
  ]:[];
  for(const binary of [process.env.CHROME_BIN,...windows,"google-chrome","google-chrome-stable","chromium","chromium-browser"].filter(Boolean))
    if(spawnSync(binary,["--version"],{timeout:4000,stdio:"ignore"}).status===0)return binary;
  throw Error("Chrome is required for visual QA; set CHROME_BIN to its executable path");
};
test('CLUB-01 browser: desktop/mobile, themes, five languages, keyboard, refresh and crest fallback',{timeout:180000},async()=>{
 const browser=chrome();
 const dir=await mkdtemp(join(tmpdir(),'fa-club-browser-'));
 const artifact=join(dir,'public');const allowed=new Set(stagePublicArtifact(repositoryRoot,artifact));
 let refuseCrests=false;
 const server=createServer((req,res)=>{
  try{
   const path=new URL(req.url,'http://localhost').pathname;
   const file=publicRequestFile(path);
   if(!allowed.has(file)||(refuseCrests&&file.startsWith('assets/clubs/')))throw Error('Not public');
   res.writeHead(200,{'Content-Type':mime[extname(file)]});res.end(readFileSync(join(artifact,file)));
  }catch{res.writeHead(404);res.end()}
 });
 const router=createPreviewServer();
 const devServer=createServer((req,res)=>{req.headers.host='127.0.0.1:2000';router.emit('request',req,res)});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 devServer.listen(0,'127.0.0.1');await once(devServer,'listening');
 const origin='http://127.0.0.1:'+server.address().port;
 const devOrigin='http://127.0.0.1:'+devServer.address().port;
  const proc=spawn(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
    "--no-proxy-server","--disable-background-networking","--disable-extensions","--disable-sync",
    "--no-first-run","--no-default-browser-check","--remote-debugging-port=0",
    "--user-data-dir="+dir,"about:blank"],{stdio:["ignore","ignore","pipe"]});
  let stderr="";proc.stderr.on("data",x=>stderr+=x.toString());
  let socket;let screenshots=0;
  try{
    let endpoint;
    for(let i=0;i<120&&!endpoint;i++){
      endpoint=stderr.match(/DevTools listening on (ws:\/\/\S+)/)?.[1];
      if(proc.exitCode!==null)throw Error("Chrome exited: "+stderr.slice(-900));
      if(!endpoint)await delay(100);
    }
    assert.ok(endpoint,"Chrome DevTools must start: "+stderr.slice(-900));
    const host=new URL(endpoint).host;let tab;
    for(let i=0;i<40&&!tab;i++){
      try{tab=(await (await fetch("http://"+host+"/json/list")).json()).find(x=>x.type==="page");}catch{}
      if(!tab)await delay(100);
    }
    assert.ok(tab?.webSocketDebuggerUrl);
    socket=new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((ok,fail)=>{socket.addEventListener("open",ok,{once:true});socket.addEventListener("error",fail,{once:true});});
    let seq=0;const pending=new Map();
    socket.addEventListener("message",e=>{
      const m=JSON.parse(e.data),p=pending.get(m.id);if(!p)return;
      clearTimeout(p.timer);pending.delete(m.id);m.error?p.fail(Error(m.error.message)):p.ok(m.result);
    });
    const cmd=(method,params={})=>new Promise((ok,fail)=>{
      const id=++seq,timer=setTimeout(()=>{pending.delete(id);fail(Error("CDP timeout "+method));},15000);
      pending.set(id,{ok,fail,timer});socket.send(JSON.stringify({id,method,params}));
    });
    await cmd("Page.addScriptToEvaluateOnNewDocument",{source:`window.__faRuntimeErrors=[];window.addEventListener('error',e=>window.__faRuntimeErrors.push(String(e.message||e.error||'window error')));window.addEventListener('unhandledrejection',e=>window.__faRuntimeErrors.push(String(e.reason?.stack||e.reason||'unhandled rejection')));`});
    const run=async expression=>{
      const out=await cmd("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
      if(out.exceptionDetails)throw Error(out.exceptionDetails.exception?.description||out.exceptionDetails.text);
      return out.result.value;
    };
    const wait=async expr=>{
      for(let i=0;i<100;i++){try{if(await run(expr))return;}catch{}await delay(100);}
      throw Error("Timed out: "+expr+"; "+await run("document.body.textContent.slice(0,500)"));
    };

    const visit=async(path,base=origin)=>{
     await cmd('Page.navigate',{url:base+path});
     await wait("document.readyState==='complete'&&document.documentElement.dataset.clubReady==='true'");
    };
    await cmd('Runtime.enable');
    const errors=[];socket.addEventListener('message',event=>{
     const message=JSON.parse(event.data);
     if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);
    });
    const manifest=JSON.parse(readFileSync(join(artifact,'clubs/_shared/manifest.json'),'utf8'));
    const known=Object.keys(manifest.clubCrests)[0];assert.ok(known);
    const [country,id]=known.split('-');
    const knownPath='/clubs/'+country.toLowerCase()+'/'+id.toString()+'/overview';
    await visit('/clubs/it/1/overview');
    for(const width of [1440,390,320])for(const theme of ['dark','light'])for(const lang of ['en','de','es','fr','it']){
     await cmd('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<620});
     await run(`localStorage.setItem('football-architect:theme',${JSON.stringify(theme)});localStorage.setItem('football-architect:language',${JSON.stringify(lang)});`);
     await visit('/clubs/it/1/overview');
     assert.equal(await run('document.documentElement.lang'),lang);
     assert.equal(await run('document.documentElement.dataset.theme'),theme);
     const measured=await run(`(()=>{const main=document.querySelector('.fa-shell-content-scroll');return {overflow:document.documentElement.scrollWidth>innerWidth+1||main.scrollWidth>main.clientWidth+1,nav:document.querySelectorAll('.club-tabs a').length,title:document.querySelector('#club-title').textContent,description:document.querySelector('.club-description').textContent,selected:document.querySelector('[aria-current="page"].app-competition-tab')?.textContent}})()`);
     assert.equal(measured.overflow,false,JSON.stringify({width,theme,lang,measured}));
     assert.equal(measured.nav,5);
     assert.equal(await run("document.querySelector('.fa-shell-nav [aria-current=\"page\"]')===null"),true,'Club pages must not select a sidebar destination');
     assert.equal(await run("!!document.querySelector('.club-country-flag')"),true);const flags=await run("Array.from(document.querySelectorAll('.club-country-flag,.club-country-value img')).map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,fit:getComputedStyle(el).objectFit}))");for(const flag of flags)assert.deepEqual(flag,{width:25,height:20,fit:'contain'},'Club flag must fit in shared 5:4 slot');assert.equal(await run("document.querySelectorAll('.club-country-flag').length"),2);assert.equal(await run("Array.from(document.querySelectorAll('.club-country-flag')).every(el=>el.tagName.toLowerCase()==='svg'&&el.getAttribute('viewBox')==='0 0 5 4')"),true,'Both flags use the competition 5:4 vector viewport');assert.equal(await run("Array.from(document.querySelectorAll('.club-country-flag')).every(el=>getComputedStyle(el).borderRadius==='0px')"),true,'Club flag artwork must not be double-clipped');assert.equal(measured.title,manifest.clubs.find(c=>c.countryId==='IT'&&c.clubId===1).fullName);assert.ok(measured.description.length>50);
     assert.equal(await run("document.querySelectorAll('.club-overview-layout .app-panel').length"),3,'Identity, competition and reserved kits panels');
     assert.equal(await run("document.querySelector('.club-description').textContent===document.querySelector('.club-description').dataset.originalDescription"),true);
     assert.equal(await run("document.querySelector('.club-kits').textContent.trim().length>0"),true);
     if(lang!=='it'){
      assert.equal(await run("document.querySelector('[data-translate-club]')!==null"),true);
      await run("document.querySelector('[data-translate-club]').click()");
      assert.equal(await run("document.querySelector('.club-description').textContent===document.querySelector('.club-description').dataset.translatedDescription"),true);
      await run("document.querySelector('[data-translate-club]').click()");
      assert.equal(await run("document.querySelector('.club-description').textContent===document.querySelector('.club-description').dataset.originalDescription"),true);
     }else assert.equal(await run("document.querySelector('[data-translate-club]')===null"),true);
     assert.equal(await run("document.querySelectorAll('.app-world-country').length"),0,'No competition index leaked into club shell');
     if(lang==='en'){
      const shot=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      const bytes=Buffer.from(shot.data,'base64');assert.equal(bytes.readUInt32BE(16),width);
      if(process.env.FA_CLUB_QA_DIR){mkdirSync(process.env.FA_CLUB_QA_DIR,{recursive:true});writeFileSync(join(process.env.FA_CLUB_QA_DIR,`club-${width}-${theme}.png`),bytes)}
     }
    }
    await run("document.querySelector('.club-tabs a').focus()");
    await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',windowsVirtualKeyCode:9});await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',windowsVirtualKeyCode:9});
    assert.equal(await run("document.activeElement.getAttribute('href')"),'/clubs/it/1/roster');
    await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'Home'});await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'Home'});
    assert.equal(await run("document.activeElement.getAttribute('href')"),'/clubs/it/1/overview');
    await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight'});await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight'});
    assert.equal(await run("document.activeElement.getAttribute('href')"),'/clubs/it/1/roster');
    assert.notEqual(await run("getComputedStyle(document.activeElement).outlineStyle"),'none');
    await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'End'});await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'End'});
    assert.equal(await run("document.activeElement.getAttribute('href')"),'/clubs/it/1/history');
    await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await wait("location.pathname==='/clubs/it/1/history'&&document.documentElement.dataset.clubReady==='true'");
    assert.equal(await run("document.activeElement===document.querySelector('.club-tabs [aria-current=\"page\"]')"),true,'Keyboard activation retains focus on the active tab');
    await cmd('Page.reload');await wait("document.readyState==='complete'&&document.documentElement.dataset.clubReady==='true'");
    assert.equal(await run("document.querySelectorAll('.club-empty').length"),1);
    for(const view of ['roster','fixtures','stats','history']){
     await visit('/clubs/br/40/'+view+'?season=2&matchday=7');
     assert.equal(await run("!!document.querySelector('.club-empty')"),true);
     assert.equal(await run('location.search'),view==='history'?'':'?season=2&matchday=7');
    }
    await visit('/clubs/it/1/overview?season=4');assert.equal(await run('location.search'),'');
    assert.equal(await run("document.querySelector('.club-competition a').getAttribute('href')"),'/competitions/it-1/overview');
    await visit(knownPath);await wait("document.querySelector('[data-club-crest-loaded]')!==null");
    await run("window.__clubHeaderCrest=document.querySelector('.club-header .app-club-crest-image')");
    await run('document.querySelector(".club-tabs a[href$=\'/roster\']").click()');
    assert.equal(await run("location.pathname.endsWith('/roster')"),true);
    assert.equal(await run("document.activeElement===document.querySelector('.club-tabs [aria-current=\"page\"]')"),true,'Click retains focus on the replacement active tab');
    assert.equal(await run("document.querySelector('.club-header .app-club-crest-image')===window.__clubHeaderCrest"),true,'Tab navigation must preserve the loaded header crest');
    await run("history.back()");
    await wait("location.pathname.endsWith('/overview')");
    assert.equal(await run("document.activeElement===document.querySelector('.club-tabs [aria-current=\"page\"]')"),true,'Back restores active club tab focus');
    assert.equal(await run("document.querySelector('.club-header .app-club-crest-image')===window.__clubHeaderCrest"),true,'Back navigation must preserve the same crest node');
    await run("history.forward()");
    await wait("location.pathname.endsWith('/roster')");
    assert.equal(await run("document.activeElement===document.querySelector('.club-tabs [aria-current=\"page\"]')"),true,'Forward restores active club tab focus');
    refuseCrests=true;await cmd('Network.setCacheDisabled',{cacheDisabled:true});await visit(knownPath);
    await wait("document.querySelectorAll('.app-club-crest-image').length===0&&document.querySelector('[data-club-crest-pending]')===null");
    assert.equal(await run("getComputedStyle(document.querySelector('.club-crest'),'::before').display"),'block');
    refuseCrests=false;
    await visit('/clubs/br/40/overview');assert.equal(await run("document.querySelector('.club-competition a')"),null);
    await visit('/clubs/it/1/overview',devOrigin);
    assert.equal(await run("document.querySelector('[data-fa-dev-preview]')"),null);
    await cmd('Page.navigate',{url:origin+'/competitions/it-1/overview'});
    await wait("document.querySelector('#division-detail-name')?.textContent==='Lega Federale'");
    assert.equal(errors.length,0,errors.join('; '));
  }finally{
    socket?.close();proc.kill('SIGTERM');
    await new Promise(resolve=>server.close(resolve));await new Promise(resolve=>devServer.close(resolve));
    await rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});
  }
});
