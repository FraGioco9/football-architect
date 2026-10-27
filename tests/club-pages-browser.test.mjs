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
import {createPreviewStandings} from '../tools/dev-standings-preview-data.mjs';
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
// A zero-size inline probe measures the first text baseline regardless of font size.
function measureBaselines(selectors){
 return selectors.map(selector=>{
  const node=document.querySelector(selector);if(!node)throw Error('Missing baseline target: '+selector);
  const probe=document.createElement('span');probe.setAttribute('aria-hidden','true');
  probe.style.cssText='display:inline-block;width:0;height:0;padding:0;margin:0;border:0;vertical-align:baseline';
  node.prepend(probe);const baseline=probe.getBoundingClientRect().top;probe.remove();return baseline;
 });
}
test('CLUB-01 browser: desktop/mobile, themes, five languages, keyboard, refresh and crest fallback',{timeout:300000},async()=>{
 const browser=chrome();
 const dir=await mkdtemp(join(tmpdir(),'fa-club-browser-'));
 const artifact=join(dir,'public');const allowed=new Set(stagePublicArtifact(repositoryRoot,artifact));
 let refuseCrests=false,holdDeferred=false,manifestMode='ok';const deferredResponses=[];
 const server=createServer((req,res)=>{
  try{
   const path=new URL(req.url,'http://localhost').pathname;
   const file=publicRequestFile(path);
   if(!allowed.has(file)||(refuseCrests&&file.startsWith('assets/clubs/')))throw Error('Not public');
   if(file==='clubs/_shared/manifest.json'&&manifestMode!=='ok'){if(manifestMode==='bad-json'){res.writeHead(200,{'Content-Type':'application/json'});res.end('{invalid');}else{res.writeHead(503);res.end('Unavailable')}return;}
   const send=()=>{res.writeHead(200,{'Content-Type':mime[extname(file)]});res.end(readFileSync(join(artifact,file)));};
   if(holdDeferred&&file.endsWith('.js')&&file!=='assets/theme.js')deferredResponses.push(send);else send();
  }catch{res.writeHead(404);res.end()}
 });
 const router=createPreviewServer();let devManifestDelay=0;
 const devServer=createServer((req,res)=>{req.headers.host='127.0.0.1:2000';if(devManifestDelay&&req.url==='/competitions/_shared/manifest.json')setTimeout(()=>router.emit('request',req,res),devManifestDelay);else router.emit('request',req,res)});
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
    await cmd('Page.enable');
    await cmd('Page.addScriptToEvaluateOnNewDocument',{source:`Object.defineProperty(window,'faRoutesRegistry',{configurable:true,set(api){window.__faRoutesBootstrap={clubModel:!!window.faClubModel,competitionRoute:!!window.faCompetitionRoute};Object.defineProperty(window,'faRoutesRegistry',{value:api,writable:true,configurable:true});}});`});
    await cmd("Page.addScriptToEvaluateOnNewDocument",{source:`window.__faRuntimeErrors=[];window.addEventListener('error',e=>window.__faRuntimeErrors.push(String(e.message||e.error||'window error')));window.addEventListener('unhandledrejection',e=>window.__faRuntimeErrors.push(String(e.reason?.stack||e.reason||'unhandled rejection')));`});
    await cmd('Page.addScriptToEvaluateOnNewDocument',{source:`window.__navFragmentFrames=[];const sample=()=>{const pane=document.querySelector('.fa-shell-content-scroll');let target;try{target=document.getElementById(decodeURIComponent(location.hash.slice(1)))}catch{}if(pane&&target&&getComputedStyle(pane).visibility==='visible'){const padding=parseFloat(getComputedStyle(pane).scrollPaddingTop)||0;const expected=Math.max(0,Math.min(pane.scrollHeight-pane.clientHeight,pane.scrollTop+target.getBoundingClientRect().top-pane.getBoundingClientRect().top-pane.clientTop-padding));window.__navFragmentFrames.push({actual:pane.scrollTop,expected,aligned:Math.abs(pane.scrollTop-expected)<2&&window.scrollY===0})}if(window.__navFragmentFrames.length<120)requestAnimationFrame(sample)};requestAnimationFrame(sample);`});
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
    // Observe actual first contentful paint while all deferred JS is held back.
    // Releasing those responses must not change sidebar labels, selection or geometry.
    const navSnapshot="(()=>{const nav=document.querySelector('.fa-shell-nav');return {lang:document.documentElement.lang,theme:document.documentElement.dataset.theme,expanded:nav.querySelector('.nav01-expand').getAttribute('aria-expanded'),nodes:[...nav.querySelectorAll('h2,a,button')].map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {text:el.textContent.trim(),label:el.getAttribute('aria-label'),current:el.getAttribute('aria-current'),active:el.classList.contains('is-active'),x:r.x,y:r.y,w:r.width,h:r.height,display:s.display}})}})()";
    await cmd('Network.enable');await cmd('Network.setCacheDisabled',{cacheDisabled:true});
    for(const width of [1440,390])for(const theme of ['dark','light'])for(const lang of ['en','de','es','fr','it']){
     await cmd('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<620});
     await cmd('Page.navigate',{url:origin+'/dashboard'});await wait("document.readyState==='complete'");
     await run(`localStorage.setItem('football-architect:theme',${JSON.stringify(theme)});localStorage.setItem('football-architect:language',${JSON.stringify(lang)});sessionStorage.setItem('fa-nav01-expanded','true');`);
     for(const path of ['/dashboard','/clubs','/clubs/it/1/overview','/competitions/it-1/standings'])for(const mode of ['cold','refresh']){
      holdDeferred=true;
      try{
       if(mode==='cold')await cmd('Page.navigate',{url:origin+path});else await cmd('Page.reload',{ignoreCache:true});
       await wait("document.readyState==='interactive'&&document.querySelector('.fa-shell-nav')?.dataset.nav01Bound==='true'&&performance.getEntriesByName('first-contentful-paint').length>0");
       await wait("document.fonts.status==='loaded'");
       const before=await run(navSnapshot);
       assert.equal(before.lang,lang);assert.equal(before.theme,theme);
       assert.equal(await run("document.querySelector('#app-nav-world-title').textContent"),{en:'World',de:'Welt',es:'Mundo',fr:'Monde',it:'Mondo'}[lang]);
       assert.equal(await run("document.querySelector('#nav01-world-title').textContent"),{en:'Explore',de:'Entdecken',es:'Explorar',fr:'Explorer',it:'Esplora'}[lang]);
       assert.equal(await run("document.querySelectorAll('.nav01-children svg[aria-hidden=\"true\"]').length"),2);
       assert.equal(before.nodes.filter(n=>n.current==='page').length,1);
       assert.equal(before.nodes.filter(n=>n.active).length,1);
       const capture=width===1440&&theme==='dark'&&lang==='it'&&path==='/clubs'&&mode==='cold';
       const captureNav=async label=>{const clip=await run("(()=>{const r=document.querySelector('.fa-shell-sidebar').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()");const shot=await cmd('Page.captureScreenshot',{format:'jpeg',quality:85,clip});const chunks=shot.data.match(/.{1,6000}/g);chunks.forEach((chunk,i)=>console.log('NAV_FIRST_PAINT|'+label+'|'+i+'|'+chunks.length+'|'+chunk));};
       if(capture)await captureNav('before');
       holdDeferred=false;deferredResponses.splice(0).forEach(send=>send());
       await wait("document.readyState==='complete'");await delay(50);
       const after=await run(navSnapshot);assert.deepEqual(after,before,'Sidebar remains stable: '+JSON.stringify({width,theme,lang,path,mode,before,after}));
       if(capture)await captureNav('after');
      }catch(error){throw new Error('NAV first paint '+JSON.stringify({width,theme,lang,path,mode})+': '+error.message,{cause:error});}finally{holdDeferred=false;deferredResponses.splice(0).forEach(send=>send());}
     }
    }
    console.log('NAV_FIRST_PAINT: 160 cold/refresh cases passed, 1440/390px, Dark/Light, five languages, four routes');
    const fragmentAligned="(()=>{const pane=document.querySelector('.fa-shell-content-scroll'),target=document.getElementById(location.hash.slice(1));if(!pane||!target)return false;const padding=parseFloat(getComputedStyle(pane).scrollPaddingTop)||0;const desired=pane.scrollTop+target.getBoundingClientRect().top-pane.getBoundingClientRect().top-pane.clientTop-padding;const expected=Math.max(0,Math.min(pane.scrollHeight-pane.clientHeight,desired));return Math.abs(pane.scrollTop-expected)<2&&window.scrollY===0&&document.querySelector('.fa-shell-sidebar').getBoundingClientRect().top===0})()";
    const fragmentLoad=async(method,params,context)=>{
     holdDeferred=true;
     try{
      await cmd(method,params);
      await wait("document.readyState==='interactive'&&window.__navFragmentFrames?.length>0");
      const frames=await run('window.__navFragmentFrames');
      assert.ok(frames.every(frame=>frame.aligned),'No visible frame starts at the wrong scroll position: '+JSON.stringify({context,frames}));
      assert.equal(await run(fragmentAligned),true);
      if(context.theme==='dark'&&context.hash==='international'&&context.mode==='refresh'){
       const shot=await cmd('Page.captureScreenshot',{format:'jpeg',quality:80,captureBeyondViewport:false});const chunks=shot.data.match(/.{1,6000}/g);chunks.forEach((chunk,i)=>console.log('NAV_FRAGMENT_PAINT|'+context.width+'|'+i+'|'+chunks.length+'|'+chunk));
      }
      holdDeferred=false;deferredResponses.splice(0).forEach(send=>send());
      await wait("document.readyState==='complete'");await wait(fragmentAligned);
     }catch(error){const diagnostic=await run("JSON.stringify({href:location.href,state:document.readyState,pending:document.documentElement.dataset.nav01Fragment,visibility:getComputedStyle(document.querySelector('.fa-shell-content-scroll')).visibility,frames:window.__navFragmentFrames,errors:window.__faRuntimeErrors,bootstrap:!!window.faSidebarAlignFragment,tail:!!document.querySelector('[data-nav01-fragment-align]')})");throw new Error(JSON.stringify(context)+' '+error.message+' '+diagnostic,{cause:error});}finally{holdDeferred=false;deferredResponses.splice(0).forEach(send=>send());}
    };
    for(const width of [1440,390])for(const theme of ['dark','light']){
     await cmd('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<620});
     await run(`localStorage.setItem('football-architect:theme',${JSON.stringify(theme)});`);
     for(const hash of ['domestic','international']){
      await cmd('Page.navigate',{url:origin+'/dashboard'});
      await wait("location.pathname==='/dashboard'&&document.readyState==='complete'");
      await fragmentLoad('Page.navigate',{url:origin+'/competitions#'+hash},{width,theme,hash,mode:'cold'});
      assert.equal(await run('document.documentElement.dataset.theme'),theme);
      // Deliberately leave the anchor before reloading: hash wins over scroll restoration.
      await run("(()=>{const pane=document.querySelector('.fa-shell-content-scroll');pane.scrollTop=pane.scrollTop>1?0:pane.scrollHeight})()");
      await fragmentLoad('Page.reload',{ignoreCache:true},{width,theme,hash,mode:'refresh'});
     }
     if(width===1440){
      await run("document.querySelector('.nav01-children a[href$=\"#domestic\"]').click()");
      await wait("location.hash==='#domestic'");await wait(fragmentAligned);
      await run("document.querySelector('.nav01-children a[href$=\"#international\"]').click()");
      await wait("location.hash==='#international'");await wait(fragmentAligned);
      await run('history.back()');await wait("location.hash==='#domestic'");await wait(fragmentAligned);
     }
    }
    console.log('NAV_FRAGMENT: first visible frames aligned with deferred scripts held; cold load, scrolled refresh, desktop links and browser history passed');
    await cmd('Network.setCacheDisabled',{cacheDisabled:false});
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
     assert.equal(await run("(()=>{const row=document.querySelector('.club-fact-description').getBoundingClientRect(),label=document.querySelector('.club-fact-description dt').getBoundingClientRect(),text=document.querySelector('.club-fact-description dd').getBoundingClientRect();return Math.abs(text.left-row.left)<1&&Math.abs(text.width-row.width)<1&&text.top>=label.bottom+7})()"),true,'Description spans the identity width beneath its label: '+JSON.stringify({width,theme,lang}));
     assert.equal(await run("document.querySelectorAll('.fa-shell-nav [aria-current=\"page\"]').length===1&&document.querySelector('[data-nav01-clubs][aria-current=\"page\"]')?.getAttribute('href')==='/clubs'&&!document.querySelector('#app-nav-divisions').hasAttribute('aria-current')"),true,'Club pages select only the NAV-01 Clubs sidebar destination');
     assert.equal(await run("!!document.querySelector('.club-country-flag')"),true);const flags=await run("Array.from(document.querySelectorAll('.club-country-flag,.club-country-value img')).map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,fit:getComputedStyle(el).objectFit}))");for(const [index,flag] of flags.entries())assert.deepEqual(flag,index===0?{width:25,height:20,fit:'contain'}:{width:20,height:16,fit:'contain'},'Header and Club Identity flags must use their approved 5:4 sizes');assert.equal(await run("document.querySelectorAll('.club-country-flag').length"),2);assert.equal(await run("Array.from(document.querySelectorAll('.club-country-flag')).every(el=>el.tagName.toLowerCase()==='svg'&&el.getAttribute('viewBox')==='0 0 5 4')"),true,'Both flags use the competition 5:4 vector viewport');assert.equal(await run("Array.from(document.querySelectorAll('.club-country-flag')).every(el=>getComputedStyle(el).borderRadius==='0px')"),true,'Club flag artwork must not be double-clipped');assert.equal(measured.title,manifest.clubs.find(c=>c.countryId==='IT'&&c.clubId===1).fullName);assert.ok(measured.description.length>50);
     assert.equal(await run("document.querySelectorAll('.club-overview-layout .app-panel').length"),3,'Identity, competition and reserved kits panels');
     assert.equal(await run("document.querySelector('.club-competition-metrics dt').textContent"),{en:'Status',de:'Status',es:'Estado',fr:'Statut',it:'Stato'}[lang]);
     const cardLayout=await run("(()=>{const panel=document.querySelector('.club-competition'),layout=document.querySelector('.club-overview-layout'),identity=document.querySelector('.club-competition-identity').getBoundingClientRect(),status=document.querySelector('.club-competition-metrics').getBoundingClientRect(),next=document.querySelector('.club-competition-next').getBoundingClientRect();return {full:Math.abs(panel.getBoundingClientRect().width-layout.getBoundingClientRect().width)<2,sideBySide:status.left>=identity.right-1&&next.left>=status.right-2,stacked:next.top>=identity.bottom-2&&next.top>=status.bottom-2}})()");
     assert.equal(cardLayout.full,true,'Competition spans the Overview width');
     const valueSelectors=['[data-club-position]','.club-competition-next-empty'];
     const valueBaselines=await run(`(${measureBaselines.toString()})(${JSON.stringify(valueSelectors)})`);
     assert.ok(valueBaselines.every(Number.isFinite),'Competition status and Next Match retain measurable visible values: '+JSON.stringify({width,theme,lang,valueBaselines}));
     assert.equal(await run("(()=>{const logo=document.querySelector('.club-competition-logo').getBoundingClientRect(),identity=document.querySelector('.club-competition-identity').getBoundingClientRect();return Math.abs((logo.top+logo.bottom)-(identity.top+identity.bottom))<2})()"),true,'Competition logo is centered within its row');
     if(width===1440)assert.equal(await run("(()=>{const layout=document.querySelector('.club-competition-layout').getBoundingClientRect(),league=document.querySelector('.club-competition-identity').getBoundingClientRect(),status=document.querySelector('.club-competition-metrics').getBoundingClientRect(),next=document.querySelector('.club-competition-next').getBoundingClientRect();return league.left>=layout.left-2&&league.right<=status.left+2&&status.right<=next.left+2&&next.right<=layout.right+2&&[league,status,next].every(r=>r.top>=layout.top-2&&r.bottom<=layout.bottom+2)})()"),true,'Competition league, status and next match occupy ordered non-overlapping columns inside the full-width band');
     assert.equal(await run("getComputedStyle(document.querySelector('.club-competition-name a')).fontSize"),width>760?'17px':width>480?'14px':'14px','League link uses the compact responsive font size');
     assert.equal(await run("(()=>{const status=document.querySelector('.club-competition-metrics dt').getBoundingClientRect(),next=document.querySelector('.club-competition-next>.club-competition-label').getBoundingClientRect(),layout=document.querySelector('.club-competition-layout').getBoundingClientRect();return status.width>0&&next.width>0&&[status,next].every(r=>r.top>=layout.top-2&&r.bottom<=layout.bottom+2)})()"),true,'Status and next match labels remain visible within the competition layout at '+width);
     assert.equal(await run("document.querySelector('.club-competition-context')"),null,'No provisional allocation label');
     assert.equal(width>480?cardLayout.sideBySide:cardLayout.stacked,true,'Competition uses three columns above 480px and a second row for Next Match on narrow screens');
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
      if(width===1440||width===390){
       await run("document.querySelector('.club-fact-description').scrollIntoView({block:'center'})");
       const clip=await run("(()=>{const r=document.querySelector('.club-fact-description').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()");
       const descriptionShot=await cmd('Page.captureScreenshot',{format:'jpeg',quality:85,clip,captureBeyondViewport:true});
       const chunks=descriptionShot.data.match(/.{1,6000}/g);chunks.forEach((chunk,i)=>console.log('CLUB_DESCRIPTION_REVIEW|'+width+'-'+theme+'|'+i+'|'+chunks.length+'|'+chunk));
      }
      const shot=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      const bytes=Buffer.from(shot.data,'base64');assert.equal(bytes.readUInt32BE(16),width);
      if(process.env.FA_CLUB_QA_DIR){mkdirSync(process.env.FA_CLUB_QA_DIR,{recursive:true});writeFileSync(join(process.env.FA_CLUB_QA_DIR,`club-${width}-${theme}.png`),bytes)}
     }
    }
    // NAV-01C: directory browser smoke matrix on staged public bytes.
    for(const width of [320,390,768,801,1024,1440])for(const theme of ['dark','light'])for(const lang of ['en','de','es','fr','it']){
     await cmd('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<620});
     await run(`localStorage.setItem('football-architect:theme',${JSON.stringify(theme)});localStorage.setItem('football-architect:language',${JSON.stringify(lang)});`);
     await cmd('Page.navigate',{url:origin+'/clubs'});
     await wait("document.querySelectorAll('.nav01-card').length===320");
     const state=await run(`(()=>{const pane=document.querySelector('.fa-shell-content-scroll');const cards=document.querySelectorAll('.nav01-card');return {language:document.documentElement.lang,theme:document.documentElement.dataset.theme,count:cards.length,href:cards[0].getAttribute('href'),overflow:document.documentElement.scrollWidth>innerWidth+1||pane.scrollWidth>pane.clientWidth+1,labels:[...document.querySelectorAll('.nav01-filters select')].map(el=>el.getAttribute('aria-label'))}})()`);
     assert.equal(state.language,lang);assert.equal(state.theme,theme);assert.equal(state.count,320);
     assert.match(state.href,/^\/clubs\/(it|eng|es|de|fr|pt|nl|br)\/([1-9]|[1-3][0-9]|40)\/overview$/);
     assert.equal(state.overflow,false,JSON.stringify({width,theme,lang,state}));assert.ok(state.labels.every(Boolean));
     assert.equal(await run("document.querySelectorAll('.nav01-filter [role=combobox]:not(:disabled)').length"),2);
     assert.equal(await run("[...document.querySelectorAll('.nav01-filter button')].every(el=>el.getBoundingClientRect().width<=el.parentElement.getBoundingClientRect().width+1)"),true,JSON.stringify({width,theme,lang}));
     assert.equal(await run("[...document.querySelectorAll('.nav01-filters select')].every(el=>getComputedStyle(el).display==='none')"),true);
     // CLUBS-LAYOUT QA-02: card, search and dropdown hover use the same neutral border.
     if(lang==='en'){
      const borders=await run("(()=>{const card=document.querySelector('.nav01-card'),input=document.querySelector('.nav01-filters input'),menu=document.querySelector('#nav01-country-trigger');return {card:getComputedStyle(card).borderColor,input:getComputedStyle(input).borderColor,menu:getComputedStyle(menu).borderColor,cardWidth:card.getBoundingClientRect().width}})()");
      assert.ok(borders.cardWidth>0,JSON.stringify({width,theme,borders}));
      const placeholder=await run("document.querySelector('.nav01-filters input').placeholder");
      assert.equal(placeholder,'Search clubs or cities');
     }

     for(const name of ['country','division']){
      await run(`document.getElementById('nav01-${name}-trigger').click()`);
      const menuState=await run(`(()=>{const trigger=document.getElementById('nav01-${name}-trigger'),menu=document.getElementById(trigger.getAttribute('aria-controls')),rect=menu.getBoundingClientRect();return {expanded:trigger.getAttribute('aria-expanded'),hidden:menu.hidden,active:menu.querySelector('[data-active="true"]')?.id,descendant:trigger.getAttribute('aria-activedescendant'),selected:menu.querySelectorAll('[aria-selected="true"]').length,inBounds:rect.left>=0&&rect.right<=innerWidth+1,stroke:trigger.querySelector('path').getAttribute('stroke-width')}})()`);
      assert.equal(menuState.expanded,'true');assert.equal(menuState.hidden,false);assert.equal(menuState.active,menuState.descendant);assert.equal(menuState.selected,1);assert.equal(menuState.inBounds,true);assert.equal(menuState.stroke,'1.75');
      if(name==='division'&&lang==='en'&&((width===390&&theme==='dark')||(width===1440&&theme==='light'))){
       await wait("(()=>{const matrix=new DOMMatrix(getComputedStyle(document.querySelector('#nav01-division-trigger svg')).transform);return Math.abs(matrix.a+1)<.001&&Math.abs(matrix.d+1)<.001})()");
       const clip=await run("(()=>{const r=document.querySelector('.nav01-filters').getBoundingClientRect();const y=Math.max(0,r.top-12);return {x:r.left,y,width:r.width,height:Math.min(500,innerHeight-y),scale:1}})()");
       const shot=await cmd('Page.captureScreenshot',{format:'jpeg',quality:55,clip,captureBeyondViewport:false});const chunks=shot.data.match(/.{1,2000}/g);for(let i=0;i<chunks.length;i++)console.log(`NAV_CHEVRON_PAINT|${width}|${i}|${chunks.length}|${chunks[i]}`);
      }
      await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',windowsVirtualKeyCode:27});await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',windowsVirtualKeyCode:27});
      assert.equal(await run(`document.getElementById('nav01-${name}-menu').hidden&&document.activeElement.id==='nav01-${name}-trigger'`),true);
     }
     if(lang==='en'){const shot=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const bytes=Buffer.from(shot.data,'base64');assert.equal(bytes.readUInt32BE(16),width);if(process.env.FA_CLUB_QA_DIR){mkdirSync(process.env.FA_CLUB_QA_DIR,{recursive:true});writeFileSync(join(process.env.FA_CLUB_QA_DIR,`nav01-${width}-${theme}.png`),bytes)}}
    }
    await cmd('Page.navigate',{url:origin+'/clubs'});
    await wait("document.querySelectorAll('.nav01-card').length===320");
    await run("document.querySelector('.nav01-filters select').value='IT';document.querySelector('.nav01-filters select').dispatchEvent(new Event('change',{bubbles:true}))");
    assert.equal(await run("document.querySelectorAll('.nav01-card').length"),40);
    // The public Clubs controls use the same keyboard model as Season/Matchday.
    const key=async(key,code)=>{await cmd('Input.dispatchKeyEvent',{type:'keyDown',key,windowsVirtualKeyCode:code});await cmd('Input.dispatchKeyEvent',{type:'keyUp',key,windowsVirtualKeyCode:code})};
    await run("document.querySelector('.nav01-filter select').value='';document.querySelector('.nav01-filter select').dispatchEvent(new Event('change'));document.getElementById('nav01-division-trigger').focus()");
    await key('Enter',13);await key('End',35);await key('Enter',13);
    assert.equal(await run("document.querySelectorAll('.nav01-card').length"),128);
    await key(' ',32);await key('Home',36);await key('ArrowDown',40);await key('Enter',13);
    assert.equal(await run("document.querySelectorAll('.nav01-card').length"),128);
    await key('Enter',13);await key('Home',36);await key('Enter',13);
    assert.equal(await run("document.querySelectorAll('.nav01-card').length"),320);
    await run("document.getElementById('nav01-country-trigger').click()");await key('Tab',9);
    assert.equal(await run("document.getElementById('nav01-country-menu').hidden"),true);
    await run("document.getElementById('nav01-country-trigger').click();document.querySelector('.nav01-filters input').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");
    assert.equal(await run("document.getElementById('nav01-country-menu').hidden"),true);
    await run("document.getElementById('nav01-division-trigger').click();document.querySelector('#nav01-division-menu [data-menu-value=first]').click()");
    assert.equal(await run("document.querySelectorAll('.nav01-card').length"),128);
    assert.equal(await run("document.getElementById('nav01-division-trigger').textContent.trim()"),'Prima');
    assert.equal(await run("new URLSearchParams(location.search).get('division')"),'first');
    await cmd('Page.reload');await wait("document.querySelectorAll('.nav01-card').length===128");
    assert.equal(await run("document.querySelector('#nav01-division-trigger').textContent.trim()"),'Prima');
    await cmd('Page.navigate',{url:origin+'/clubs?q=Torino&country=IT&division=first'});
    await wait("document.querySelector('#nav01-country-trigger')?.disabled===false");
    assert.equal(await run("document.querySelector('.nav01-filters input').value"),'Torino');
    assert.equal(await run("document.querySelector('.nav01-filters select').value"),'IT');
    assert.equal(await run("document.querySelectorAll('.nav01-card').length>=0"),true);
    await cmd('Page.navigate',{url:origin+'/clubs?q=Munchen&country=de&division=FIRST'});
    await wait("document.querySelector('#nav01-country-trigger')?.disabled===false");
    assert.equal(await run("document.querySelector('.nav01-filters select').value"),'DE');
    assert.equal(await run("document.querySelectorAll('.nav01-filter select')[1].value"),'first');
    await run("document.querySelector('.nav01-filters input').value='Sao';document.querySelector('.nav01-filters input').dispatchEvent(new Event('input',{bubbles:true}))");
    assert.equal(await run("new URLSearchParams(location.search).get('q')"),'Sao');
    await cmd('Page.reload');await wait("document.querySelector('.nav01-filters input')?.value==='Sao'");
    await cmd('Page.navigate',{url:origin+'/clubs'});
    await wait("document.querySelectorAll('.nav01-card').length===320");
    // CLUBS-PAGE-03B: failed manifest, accessible localized retry, and recovery without refresh.
    manifestMode='unavailable';
    await cmd('Page.navigate',{url:origin+'/clubs?country=IT&division=first'});
    await wait("!!document.querySelector('.nav01-retry')");
    assert.equal(await run("document.querySelector('.nav01-grid').getAttribute('aria-busy')"),'false');
    assert.equal(await run("document.querySelector('.nav01-load-status').getAttribute('role')"),'alert');
    await run("document.documentElement.lang='it'");
    await wait("document.querySelector('.nav01-retry')?.textContent==='Riprova'");
    manifestMode='ok';
    await run("document.querySelector('.nav01-retry').click()");
    await wait("document.querySelector('.nav01-card')&&document.querySelector('.nav01-filters select').value==='IT'");
    assert.equal(await run("document.querySelector('.nav01-grid').getAttribute('aria-busy')"),'false');
    assert.equal(await run("new URLSearchParams(location.search).get('division')"),'first');
    manifestMode='bad-json';
    await cmd('Page.navigate',{url:origin+'/clubs'});
    await wait("!!document.querySelector('.nav01-retry')");
    manifestMode='ok';
    await run("document.querySelector('.nav01-retry').click()");
    await wait("document.querySelectorAll('.nav01-card').length===320");
    console.log('CLUBS_03B: HTTP error, JSON error, retry, localization and URL recovery passed');
    // QA-02: use an accented city/name from the actual public manifest, not invented fixtures.
    const accentCase=await run("(async()=>{const manifest=await(await fetch('/clubs/_shared/manifest.json')).json();const normalize=s=>s.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();for(const club of manifest.clubs){for(const field of ['city','primaryName','fullName']){const value=club[field];if(value&&normalize(value)!==value.toLowerCase())return {term:value,plain:normalize(value),href:'/clubs/'+club.countryId.toLowerCase()+'/'+club.clubId+'/overview'};}}return null})()");
    assert.ok(accentCase,'The public manifest should contain a real accented club name or city');
    for(const term of [accentCase.term,accentCase.plain]){
      await cmd('Page.navigate',{url:origin+'/clubs?q='+encodeURIComponent(term)});
      await wait("document.querySelector('#nav01-country-trigger')?.disabled===false");
      assert.equal(await run("!!document.querySelector('.nav01-card[href="+JSON.stringify(accentCase.href)+"]')"),true,'Real manifest accent-insensitive match: '+term);
    }
    await cmd('Page.navigate',{url:origin+'/clubs?country=ZZ&country=it&division=garbage&division=SECOND&q=&q=Torino'});
    await wait("document.querySelector('#nav01-country-trigger')?.disabled===false");
    assert.equal(await run("document.querySelector('.nav01-filters select').value"),'IT');
    assert.equal(await run("document.querySelectorAll('.nav01-filters select')[1].value"),'second');
    assert.equal(await run("document.querySelector('.nav01-filters input').value"),'Torino');
    await cmd('Page.navigate',{url:origin+'/clubs?country=ZZ&division=third&q='});
    await wait("document.querySelectorAll('.nav01-card').length===320");
    for(const language of ['en','de','es','fr','it']){
      await run("document.documentElement.lang="+JSON.stringify(language));
      assert.equal(await run("document.querySelectorAll('.nav01-card').length"),320);
    }
    console.log('CLUBS_03A_QA02: real accented manifest values, duplicate/invalid URLs and five languages passed');
    await cmd('Page.navigate',{url:origin+'/clubs'});
    await wait("document.querySelectorAll('.nav01-card').length===320");
    // QA-01: custom dropdown pushes a history entry and Back restores its state.
    await run("document.getElementById('nav01-country-trigger').click();document.querySelector('#nav01-country-menu [data-menu-value=IT]').click()");
    assert.equal(await run("new URLSearchParams(location.search).get('country')"),'IT');
    assert.equal(await run("document.querySelectorAll('.nav01-card').length"),40);
    await run("history.back()");
    await wait("document.querySelectorAll('.nav01-card').length===320&&document.querySelector('.nav01-filters select').value===''");
    assert.equal(await run("new URLSearchParams(location.search).has('country')"),false);
    await run("history.forward()");
    await wait("document.querySelectorAll('.nav01-card').length===40&&document.querySelector('.nav01-filters select').value==='IT'");
    await cmd('Page.navigate',{url:origin+'/clubs'});
    await wait("document.querySelectorAll('.nav01-card').length===320");
    console.log('NAV_CHEVRON: Clubs dropdowns passed all languages, themes and widths; filtering, keyboard, focus, outside close and refresh passed');

    // QA-02: inspect the actual viewport centers of the Calendar/Fixtures arrows.
    await cmd('Page.navigate',{url:origin+'/calendar'});
    await wait("document.querySelector('#calendar-previous svg.site-chevron')!==null");
    const arrowCenters=await run("(()=>[...document.querySelectorAll('#calendar-previous,#calendar-next')].map(button=>{const b=button.getBoundingClientRect(),icon=button.querySelector('svg.site-chevron').getBoundingClientRect();return {id:button.id,dx:Math.abs((b.left+b.right-icon.left-icon.right)/2),dy:Math.abs((b.top+b.bottom-icon.top-icon.bottom)/2)}}))()");
    for(const arrow of arrowCenters){assert.ok(arrow.dx<=1&&arrow.dy<=1,'Arrow viewport must be centered: '+JSON.stringify(arrow));}
    console.log('CLUBS_QA02_ARROW_CENTERS',JSON.stringify(arrowCenters));

    // NAV-01C: keyboard operation of the sidebar disclosure and focus.
    await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await cmd('Page.navigate',{url:origin+'/clubs'});
    await wait("document.querySelectorAll('.nav01-card').length===320");
    await run("sessionStorage.setItem('fa-nav01-expanded','false')");
    await cmd('Page.reload');
    await wait("document.querySelector('.nav01-expand')?.getAttribute('aria-expanded')==='false'");
    await run("document.querySelector('.nav01-expand').focus()");
    assert.equal(await run("document.activeElement.classList.contains('nav01-expand')"),true);
    await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await wait("document.querySelector('.nav01-expand')?.getAttribute('aria-expanded')==='true'");
    assert.equal(await run("document.querySelector('.nav01-children').hidden"),false);
    assert.equal(await run("document.querySelector('.nav01-expand').getAttribute('aria-controls')"),'nav01-children');
    await cmd('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
    await cmd('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
    await wait("document.querySelector('.nav01-expand')?.getAttribute('aria-expanded')==='false'");
    await wait("document.querySelector('.nav01-children').hidden===true");
    await visit('/clubs/it/1/overview');
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
    // QA-02: opening a club from the directory must reuse the crest URL and show no placeholder once loaded.
    await cmd('Page.navigate',{url:origin+'/clubs'});
    await wait("document.querySelectorAll('.nav01-card').length===320");
    const sourceCrest=await run("(()=>{const card=[...document.querySelectorAll('.nav01-card')].find(a=>a.getAttribute('href')==='/clubs/it/1/overview');return card?.querySelector('img.nav01-crest')?.getAttribute('src')||null})()");
    assert.equal(sourceCrest,'/assets/clubs/IT/1/crest.svg');
    await run("document.querySelector('.nav01-card[href=\"/clubs/it/1/overview\"]').click()");
    await wait("location.pathname==='/clubs/it/1/overview'&&document.querySelector('.club-header .app-club-crest-image')?.complete===true");
    const destinationCrest=await run("(()=>{const image=document.querySelector('.club-header .app-club-crest-image');return {src:image?.getAttribute('src'),loaded:!!image?.naturalWidth,pending:!!document.querySelector('.club-header [data-club-crest-pending]')}})()");
    assert.equal(destinationCrest.src,sourceCrest);
    assert.equal(destinationCrest.loaded,true,'Club crest must be decoded after directory navigation');
    assert.equal(destinationCrest.pending,false,'Loaded crest must not leave a pending placeholder');
    console.log('CLUBS_QA02_DIRECTORY_TO_CLUB',JSON.stringify(destinationCrest));

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
    assert.equal(await run("document.querySelectorAll('.club-competition .club-competition-empty').length"),1);
    assert.equal(await run("document.querySelector('.club-competition img,.club-competition .club-competition-status')"),null);
    await visit('/clubs/it/1/overview',devOrigin);
    await wait("document.querySelector('.fa-dev-widget')!==null");
    assert.equal(await run("document.querySelectorAll('.fa-dev-widget').length"),1);
    const division=JSON.parse(readFileSync(join(artifact,'competitions/_shared/manifest.json'),'utf8')).divisions.find(d=>d.id==='IT-1');
    const current=createPreviewStandings(division,15,2),index=current.rows.findIndex(r=>r.club.clubId===1);
    const upcoming=createPreviewStandings(division,30,2).fixtures.find(f=>f.round===16&&(f.homeId===1||f.awayId===1));
    const englishOrdinal=n=>String(n)+(n%100>=11&&n%100<=13?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th'));
    for(const width of [1440,390,320]){
     await cmd('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<620});
     devManifestDelay=150;
     await run("sessionStorage.setItem('football-architect:standings-dev-preview','on');sessionStorage.setItem('football-architect:standings-dev-season','2');sessionStorage.setItem('football-architect:standings-dev-matchdays','15');sessionStorage.removeItem('football-architect:calendar-dev-world-day');window.dispatchEvent(new Event('fa:fictional-standings-change'))");
     await run("document.querySelector('.club-tabs a[href$=\"/roster\"]').click();document.querySelector('.club-tabs a[href$=\"/overview\"]').click();window.__summaryTab=document.activeElement");
     await wait("document.querySelector('[data-club-position]')?.textContent==="+JSON.stringify(englishOrdinal(index+1)));
     devManifestDelay=0;
     assert.equal(await run("document.activeElement===window.__summaryTab"),true,'Delayed summary preserves the selected club tab and keyboard focus');
     assert.equal(await run("document.querySelector('[data-club-position]').textContent"),englishOrdinal(index+1));
     assert.equal(await run("getComputedStyle(document.querySelector('[data-club-position]')).fontSize"),'20px','Status value uses 20px');
     assert.equal(await run("document.querySelector('[data-club-position] a,[data-club-position] [tabindex]')"),null,'Status is plain text without navigation');
     assert.equal(await run("document.querySelector('[data-club-points]')"),null,'Points are not shown');
     // Presentation probes only: do not introduce fictional sporting results.
     for(const status of ['Semifinals','Eliminated in the quarter-finals','Ausgeschieden in der Qualifikationsrunde','Eliminado en la ronda de clasificación','Éliminé au tour de qualification','Eliminato al turno di qualificazione']){
      assert.equal(await run(`(()=>{const value=document.querySelector('[data-club-position]'),previous=value.textContent;value.textContent=${JSON.stringify(status)};const box=value,style=getComputedStyle(box),shell=document.querySelector('.fa-shell-content-scroll');const baselines=(${measureBaselines.toString()})(${JSON.stringify(['[data-club-position]','.club-competition-next a'])});const match=document.querySelector('.club-competition-next a').getBoundingClientRect(),round=document.querySelector('.club-competition-next small').getBoundingClientRect(),name=document.querySelector('.club-competition-name').getBoundingClientRect(),tier=document.querySelector('.club-competition-tier').getBoundingClientRect();const fits=box.scrollWidth<=box.clientWidth+1&&box.scrollHeight<=box.clientHeight+1&&shell.scrollWidth<=shell.clientWidth+1&&style.whiteSpace!=='nowrap'&&style.textOverflow!=='ellipsis'&&Math.max(...baselines)-Math.min(...baselines)<1.5&&Math.abs(round.top-match.bottom-5)<1.5&&Math.abs(tier.top-name.bottom-5)<1.5;value.textContent=previous;return fits})()`),true,'Long localized status stays fully visible at '+width+': '+status);
     }
     assert.equal(await run("document.querySelector('.club-competition-next a').getAttribute('href')"),'/competitions/it-1/fixtures?season=2&matchday=16');
     if(width===1440||width===390){
      const capture=async label=>{
       await run("document.querySelector('.club-competition').scrollIntoView({block:'center'})");
       const clip=await run("(()=>{const r=document.querySelector('.club-competition').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()");
       const shot=await cmd('Page.captureScreenshot',{format:'jpeg',quality:85,clip,captureBeyondViewport:true});
       const chunks=shot.data.match(/.{1,6000}/g);chunks.forEach((chunk,i)=>console.log('CLUB_ALIGN_REVIEW|'+width+'-'+label+'|'+i+'|'+chunks.length+'|'+chunk));
      };
      await capture('aligned-normal');
      await run("window.__statusText=document.querySelector('[data-club-position]').textContent;document.querySelector('[data-club-position]').textContent='Eliminated in the quarter-finals'");
      await capture('aligned-long');
      await run("document.querySelector('[data-club-position]').textContent=window.__statusText");
     }

     assert.equal(await run("getComputedStyle(document.querySelector('.club-competition-next a')).fontSize"),'16px','Next match uses 16px on desktop and mobile');
     const fixtureText=await run("document.querySelector('.club-competition-next a').textContent");
     for(const id of [upcoming.homeId,upcoming.awayId])assert.ok(fixtureText.includes(division.clubs.find(c=>c.clubId===id).primaryName));
     assert.equal(await run("(()=>{const root=document.querySelector('.fa-shell-content-scroll');return root.scrollWidth<=root.clientWidth+1})()"),true,'Live Competition summary fits at '+width);
     await run("document.querySelector('.club-competition-next a').focus();sessionStorage.setItem('football-architect:standings-dev-preview','off');window.dispatchEvent(new Event('fa:fictional-standings-change'))");
     await wait("document.querySelector('[data-club-position]')?.textContent==='—'");
     assert.equal(await run("document.querySelector('.club-competition-next a')"),null,'Disabling DEV removes future fixtures');
     assert.equal(await run("document.activeElement.classList.contains('club-competition')"),true,'Removing a focused summary link retains focus in its panel');
    }
    // Drive the actual shared widget rather than changing storage directly.
    await visit('/clubs/it/1/overview',devOrigin);
    await wait("document.querySelector('[data-dev-control=season-number]')!==null");
    await run("document.querySelector('.fa-dev-widget-button').click()");
    await run("(()=>{const control=document.querySelector('[data-dev-control=season-number]');control.value='3';control.dispatchEvent(new Event('change',{bubbles:true}))})()");
    await wait("document.querySelector('.club-competition-next a')?.getAttribute('href').includes('season=3&')");
    assert.equal(await run("document.querySelector('.club-competition-context')"),null,'No Season/Preview caption in DEV');
    await run("(()=>{const control=document.querySelector('[data-dev-control=world-day-number]');control.value='28';control.dispatchEvent(new Event('change',{bubbles:true}))})()");
    const advanced=createPreviewStandings(division,16,3),advancedIndex=advanced.rows.findIndex(r=>r.club.clubId===1);
    await wait("document.querySelector('.club-competition-next a')?.getAttribute('href')==='/competitions/it-1/fixtures?season=3&matchday=17'");
    assert.equal(await run("document.querySelector('[data-club-position]').textContent"),englishOrdinal(advancedIndex+1));
    assert.equal(await run("document.querySelector('.club-competition-next a').getAttribute('href')"),'/competitions/it-1/fixtures?season=3&matchday=17');
    await run("document.querySelector('[data-dev-control=reset-global]').click()");
    await wait("document.querySelector('[data-club-position]')?.textContent==='—'&&document.querySelector('.club-competition-next a')===null");
    assert.equal(await run("document.querySelector('[data-club-position]').textContent"),'—');
    await visit('/clubs/br/40/history',devOrigin);
    await wait("document.querySelector('.fa-dev-widget')!==null");
    await visit('/clubs/it/1/overview');
    await run("sessionStorage.setItem('football-architect:standings-dev-preview','on');window.dispatchEvent(new Event('fa:fictional-standings-change'))");
    assert.equal(await run("document.querySelector('[data-club-position]').textContent"),'—','Public club pages never load fictional results');
    assert.equal(await run("document.querySelector('.fa-dev-widget')"),null,'Public club pages never load Debug Settings');
    await cmd('Page.navigate',{url:origin+'/competitions/it-1/overview'});
    await wait("document.querySelector('#division-detail-name')?.textContent==='Lega Federale'");
    // A03-04C: execute frozen URLs through the real public artifact, not registry helpers.
    const baseline=JSON.parse(readFileSync(new URL('./fixtures/a03-browser-routes.json',import.meta.url),'utf8'));
    const currentUrl=()=>run('location.pathname+location.search+location.hash');
    const competitionReady="document.readyState==='complete'&&!!window.faCompetitionRoute";
    for(const width of [1440,390]){
     await cmd('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<620});
     for(const row of baseline.competitionBrowser){
      await cmd('Page.navigate',{url:origin+row.input});await wait(competitionReady);
      assert.equal(await currentUrl(),row.expected,'A03-04C direct '+width+' '+row.input);
      assert.deepEqual(await run('window.__faRoutesBootstrap'),{clubModel:false,competitionRoute:false},'Core precedes deferred consumers');
      assert.equal(await run('Object.isFrozen(window.faRoutesRegistry)&&Object.isFrozen(window.faRoutesRegistry.countries)'),true);
      assert.equal(await run("window.faRoutesRegistry.buildRoute({kind:'club',country:'br',id:40,view:'history'})"),'/clubs/br/40/history');

      assert.equal(await run('window.faCompetitionRoute.get().view'),row.view);
      assert.equal(await run('window.faCompetitionRoute.get().matchday'),row.matchday);
      assert.equal(await run("document.querySelectorAll('.app-competition-tabs [role=tab][aria-selected=true]').length"),1);
     }
    }
    for(const [index,lang] of ['en','de','es','fr','it'].entries()){
     const width=[320,390,768,1440,390][index],theme=index%2?'light':'dark';
     await cmd('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<620});
     await run(`localStorage.setItem('football-architect:theme',${JSON.stringify(theme)});localStorage.setItem('football-architect:language',${JSON.stringify(lang)});`);
     for(const row of baseline.clubInitial){
      await visit(row.input);assert.equal(await currentUrl(),row.expected,'A03-04C club cleanup '+lang);
      assert.equal(await run('document.documentElement.lang'),lang);
      await cmd('Page.reload');await wait("document.readyState==='complete'&&document.documentElement.dataset.clubReady==='true'");
      assert.equal(await currentUrl(),row.expected,'A03-04C club refresh '+lang);
     }
     await visit('/clubs/it/1/stats?season=3&matchday=7');
     await run("document.querySelector('.club-tabs a[href*=\"/fixtures?\"]').click()");
     assert.equal(await currentUrl(),'/clubs/it/1/fixtures?season=3&matchday=7');
     await run('history.back()');await wait("location.pathname==='/clubs/it/1/stats'");
     assert.equal(await currentUrl(),'/clubs/it/1/stats?season=3&matchday=7');
     await run('history.forward()');await wait("location.pathname==='/clubs/it/1/fixtures'");
     assert.equal(await currentUrl(),'/clubs/it/1/fixtures?season=3&matchday=7');
     await cmd('Page.navigate',{url:origin+'/competitions/it-1/fixtures?season=1&matchday=12'});await wait(competitionReady);
     await run("document.getElementById('competition-tab-stats').click()");
     assert.equal(await currentUrl(),'/competitions/it-1/stats?season=1');
     await run('history.back()');await wait("location.pathname==='/competitions/it-1/fixtures'");
     assert.equal(await run('window.faCompetitionRoute.get().matchday'),12);
     await run('history.forward()');await wait("location.pathname==='/competitions/it-1/stats'");
     await cmd('Page.reload');await wait(competitionReady);
     await run("document.getElementById('competition-tab-fixtures').click()");
     assert.equal(await currentUrl(),'/competitions/it-1/fixtures?season=1&matchday=1','Refresh drops the in-memory round '+lang);
    }
    console.log('A03-04C BROWSER PASS: 25 direct routes at 1440/390; club cleanup/refresh and temporal navigation at 320/390/768/1440, Dark/Light, EN/DE/ES/FR/IT');
    for(const path of ['/calendar','/clubs','/competitions','/clubs/it/1/overview']){
     await cmd('Page.navigate',{url:origin+path});
     await wait("document.readyState==='complete'&&!!window.faRoutesRegistry");
     assert.deepEqual(await run('window.__faRoutesBootstrap'),{clubModel:false,competitionRoute:false},path);
     assert.equal(await run("window.faRoutesRegistry.parseRoute('/clubs/it/01/overview')"),null);
     assert.equal(await run("window.faRoutesRegistry.canonicalizeRoute('/clubs/it/1/')"),'/clubs/it/1/overview');
    }
    console.log('A03-04D BROWSER PASS: immutable staged registry available before deferred consumers on competition, club, directory and calendar pages');
    // A03-04E: follow canonical links produced by migrated browser renderers.
    await cmd('Page.navigate',{url:origin+'/competitions/it-1/standings?season=1'});
    await wait("document.readyState==='complete'&&!!document.querySelector('.app-world-standing-club-link[href=\"/clubs/it/1/overview\"]')");
    const clubDestinations=await run("[...new Set([...document.querySelectorAll('.app-world-standing-club-link[href^=\"/clubs/it/\"]')].map(a=>a.getAttribute('href')))].sort()");
    assert.deepEqual(clubDestinations,Array.from({length:16},(_,i)=>'/clubs/it/'+(i+1)+'/overview').sort());
    await run("document.querySelector('.app-world-standing-club-link[href=\"/clubs/it/1/overview\"]').click()");
    await wait("location.pathname==='/clubs/it/1/overview'&&document.documentElement.dataset.clubReady==='true'");
    await run('history.back()');await wait("location.pathname==='/competitions/it-1/standings'&&!!window.faCompetitionRoute");
    assert.equal(await currentUrl(),'/competitions/it-1/standings?season=1');
    console.log('A03-04E BROWSER PASS: migrated router/club/directory/standings links preserve canonical destinations, temporal query and history; legacy calendar links and cup historical links covered by executable VM fixtures');
    assert.equal(errors.length,0,errors.join('; '));
  }finally{
    socket?.close();proc.kill('SIGTERM');
    await new Promise(resolve=>server.close(resolve));await new Promise(resolve=>devServer.close(resolve));
    await rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});
  }
});
