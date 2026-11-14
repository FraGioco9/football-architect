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
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
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
 assert.equal(mime['.mjs'],'text/javascript','Club public ES modules must be served with a JavaScript MIME type');
 assert.ok(allowed.has('assets/club-public-read-cache.mjs'),'shared Club HTTP cache module must be published');
 let refuseCrests=false,holdDeferred=false,manifestMode='ok',mockEmptyRoster=false,mockReadyRoster=false,holdRosterResponse=false;const deferredResponses=[],blockedRosterResponses=[];
 const server=createServer((req,res)=>{
  try{
   const path=new URL(req.url,'http://localhost').pathname;
   if(path==='/api/clubs/IT-1/roster'&&holdRosterResponse){blockedRosterResponses.push(res);return;}
   if(path==='/api/clubs/IT-1/roster'&&mockEmptyRoster){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({schemaVersion:1,clubKey:'IT-1',count:0,players:[]}));return;}
   if(path==='/api/clubs/IT-1/roster'&&mockReadyRoster){
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({schemaVersion:1,clubKey:'IT-1',count:1,players:[{id:1001,display_name:'Fixture Player',nationality:'ITA',primary_position:'CM',secondary_positions:[],age:20,height_cm:180,preferred_foot:'right',attributes:{}}]}));return;
   }
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
    // Fixture uses explicit DEV choice; an existing OFF remains unchanged.
    await cmd('Page.addScriptToEvaluateOnNewDocument',{source:"if(location.origin==="+JSON.stringify(devOrigin)+"&&sessionStorage.getItem('football-architect:debug-enabled')===null)sessionStorage.setItem('football-architect:debug-enabled','on')"});
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
     const expectedPath=new URL(base+path).pathname;
     const overview=/\/overview(?:[?#]|$)/.test(path);
     await cmd('Page.navigate',{url:base+path});
     // A previous Club document may still expose clubReady during navigation.
     // The route, readiness and hydrated Overview must match in one read.
     await wait("location.pathname==="+JSON.stringify(expectedPath)+
      "&&document.readyState==='complete'&&document.documentElement.dataset.clubReady==='true'"+
      (overview?"&&document.querySelector('.club-description')!==null":""));
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
       // First-paint pixel geometry, not just HTML presence: each Clubs tile
       // must have exactly one painted crest, plus three visible metadata bars.
       let firstPaintClubs=null;
       if(path==='/clubs'&&mode==='cold'&&lang==='it'){
        const tiles=await run(`(()=>{
         const boxes=[...document.querySelectorAll('.nav01-grid>.nav01-skeleton-card')];
         return boxes.map(card=>{
          const crest=card.querySelector('.nav01-skeleton-crest');
          const disc=crest?.querySelectorAll('.nav01-skeleton-crest-disc');
          const read=selector=>{
           const element=selector===':self'?card:card.querySelector(selector),r=element?.getBoundingClientRect(),style=element?getComputedStyle(element):null;
           return {width:r?.width||0,height:r?.height||0,x:r?.x||0,y:r?.y||0,display:style?.display,visibility:style?.visibility,background:style?.backgroundColor};
          };
          return {card:read(':self'),discCount:disc?.length||0,
           pseudoBefore:crest?getComputedStyle(crest,'::before').content:null,
           pseudoAfter:crest?getComputedStyle(crest,'::after').content:null,
           circle:read('.nav01-skeleton-crest-disc'),name:read('.nav01-skeleton-name-bar'),nameSlot:read('.nav01-skeleton-name'),
           flag:read('.nav01-skeleton-flag'),city:read('.nav01-skeleton-city')};
         });
        })()`);
        firstPaintClubs=tiles;
        assert.equal(tiles.length,16,'16 anonymous cards must be present at first paint');
        for(const [index,tile] of tiles.entries()){
         assert.equal(tile.discCount,1,'single crest circle for card '+index);
         assert.equal(tile.pseudoBefore,'none','no additional shield on crest '+index);
         assert.equal(tile.pseudoAfter,'none','no additional overlay on crest '+index);
         for(const id of ['circle','name','flag','city']){
          const b=tile[id];
          assert.ok(b.width>=10&&b.height>=10&&b.display!=='none'&&b.visibility==='visible',
           'Visible '+id+' first-paint skeleton at card '+index+': '+JSON.stringify(b));
          assert.ok(b.background!=='transparent'&&b.background!=='rgba(0, 0, 0, 0)',
           'Painted '+id+' first-paint skeleton at card '+index+': '+JSON.stringify(b));
         }
         assert.ok(tile.city.width<=72.5,'City skeleton must not exceed 72px at card '+index);
         assert.equal(tile.flag.width,20,'Flag skeleton exactly matches the 20px real flag slot at card '+index);
         assert.ok(tile.name.width<=180.5,'Name skeleton is a compact bar at card '+index);
         assert.ok(tile.flag.x+tile.flag.width<=tile.city.x,'Flag precedes city at card '+index);
         assert.ok(Math.abs(tile.flag.y+tile.flag.height/2-tile.city.y-tile.city.height/2)<6,
          'Flag and city share a line at card '+index);
        }
       }
       if(capture)await captureNav('before');
       holdDeferred=false;deferredResponses.splice(0).forEach(send=>send());
       await wait("document.readyState==='complete'");await delay(50);
       const after=await run(navSnapshot);assert.deepEqual(after,before,'Sidebar remains stable: '+JSON.stringify({width,theme,lang,path,mode,before,after}));
       if(capture)await captureNav('after');
       if(firstPaintClubs){
        await wait("document.querySelectorAll('.nav01-grid>a.nav01-card').length===320&&document.querySelector('.nav01-grid')?.getAttribute('aria-busy')==='false'");
        const loaded=await run(`(()=>{
         const cards=[...document.querySelectorAll('.nav01-grid>a.nav01-card')];
         const coords=(node,card)=>{const a=node.getBoundingClientRect(),b=card.getBoundingClientRect();return {x:a.x-b.x,y:a.y-b.y,width:a.width,height:a.height}};
         const candidate=cards.find(card=>{
          const name=card.querySelector('strong'),city=card.querySelector('.nav01-club-city');
          return name&&city&&name.getBoundingClientRect().height<=parseFloat(getComputedStyle(name).lineHeight)+1&&
           city.getBoundingClientRect().height<=parseFloat(getComputedStyle(city).lineHeight)+1;
         });
         if(!candidate)return null;
         return {card:coords(candidate,candidate),
          nameSlot:coords(candidate.querySelector('strong'),candidate),
          flag:coords(candidate.querySelector('.nav01-country-flag'),candidate),
          city:coords(candidate.querySelector('.nav01-club-city'),candidate)};
        })()`);
        assert.ok(loaded,'At least one hydrated club has single-line name and city');
        const skeleton=firstPaintClubs[0];
        const relative=(part,axis)=>skeleton[part][axis]-skeleton.card[axis];
        for(const axis of ['x','y']){
         assert.ok(Math.abs(relative('flag',axis)-loaded.flag[axis])<2.5,
          'Flag skeleton '+axis+' matches final country flag at '+width+'px: '+JSON.stringify({skeleton:skeleton.flag,actual:loaded.flag}));
         if(axis==='x')assert.ok(Math.abs(relative('city','x')-loaded.city.x)<2.5,
          'City skeleton horizontal origin matches final text at '+width+'px: '+JSON.stringify({skeleton:skeleton.city,actual:loaded.city}));
        }
        assert.ok(Math.abs(relative('city','y')+skeleton.city.height/2-(loaded.city.y+loaded.city.height/2))<3,
         'City skeleton aligns with real text line center at '+width+'px: '+JSON.stringify({skeleton:skeleton.city,actual:loaded.city}));
        assert.ok(Math.abs(relative('nameSlot','y')-loaded.nameSlot.y)<3,
         'Name line skeleton sits at the real strong line at '+width+'px: '+JSON.stringify({skeleton:skeleton.nameSlot,actual:loaded.nameSlot}));
       }

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
     assert.equal(await run("(()=>{const colors=document.querySelector('.club-colors'),label=colors.closest('dd').previousElementSibling.getBoundingClientRect(),group=colors.getBoundingClientRect();return (innerWidth<=360||Math.abs((group.top+group.bottom)-(label.top+label.bottom))<2)&&colors.querySelectorAll('.club-color-value').length===2&&[...colors.querySelectorAll('.club-color-value')].every(pair=>{const square=pair.firstElementChild.getBoundingClientRect(),value=pair.lastElementChild.getBoundingClientRect();return Math.abs((square.top+square.bottom)-(value.top+value.bottom))<2&&square.right<=value.left&&Math.abs(square.top-value.top)<3})})()"),true,'Color squares remain paired and vertically centered with their HEX values; the group aligns with its label');
     assert.equal(await run("(()=>{const row=document.querySelector('.club-fact-description').getBoundingClientRect(),label=document.querySelector('.club-fact-description dt').getBoundingClientRect(),text=document.querySelector('.club-fact-description dd').getBoundingClientRect();return Math.abs(text.left-row.left)<1&&Math.abs(text.width-row.width)<1&&text.top>=label.bottom+7})()"),true,'Description spans the identity width beneath its label: '+JSON.stringify({width,theme,lang}));
     assert.equal(await run("document.querySelectorAll('.fa-shell-nav [aria-current=\"page\"]').length===1&&document.querySelector('[data-nav01-clubs][aria-current=\"page\"]')?.getAttribute('href')==='/clubs'&&!document.querySelector('#app-nav-divisions').hasAttribute('aria-current')"),true,'Club pages select only the NAV-01 Clubs sidebar destination');
     assert.equal(await run("!!document.querySelector('.club-country-flag')"),true);const flags=await run("Array.from(document.querySelectorAll('.club-country-flag,.club-country-value img')).map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,fit:getComputedStyle(el).objectFit}))");for(const [index,flag] of flags.entries())assert.deepEqual(flag,index===0?{width:25,height:20,fit:'contain'}:{width:20,height:16,fit:'contain'},'Header and Club Identity flags must use their approved 5:4 sizes');assert.equal(await run("document.querySelectorAll('.club-country-flag').length"),2);assert.equal(await run("Array.from(document.querySelectorAll('.club-country-flag')).every(el=>el.tagName.toLowerCase()==='svg'&&el.getAttribute('viewBox')==='0 0 5 4')"),true,'Both flags use the competition 5:4 vector viewport');assert.equal(await run("Array.from(document.querySelectorAll('.club-country-flag')).every(el=>getComputedStyle(el).borderRadius==='0px')"),true,'Club flag artwork must not be double-clipped');assert.equal(measured.title,manifest.clubs.find(c=>c.countryId==='IT'&&c.clubId===1).fullName);assert.ok(measured.description.length>50);
     assert.equal(await run("document.querySelectorAll('.club-overview-layout .app-panel').length"),3,'Identity, competition and reserved kits panels');
     // Public QA has no source: do not assert a fabricated league/fixture card.
     const verifiedCard=await run("!!document.querySelector('.club-competition-entry[data-club-competition-id] .club-competition-logo')");
     if(verifiedCard){
      assert.equal(await run("document.querySelector('.club-competition-metrics dt').textContent"),{en:'Status',de:'Status',es:'Estado',fr:'Statut',it:'Stato'}[lang]);
      const cardLayout=await run("(()=>{const panel=document.querySelector('.club-competition'),layout=document.querySelector('.club-overview-layout'),identity=document.querySelector('.club-competition-identity').getBoundingClientRect(),status=document.querySelector('.club-competition-metrics').getBoundingClientRect(),next=document.querySelector('.club-competition-next').getBoundingClientRect();return {full:Math.abs(panel.getBoundingClientRect().width-layout.getBoundingClientRect().width)<2,sideBySide:status.left>=identity.right-1&&next.left>=status.right-2,stacked:status.top>=identity.bottom-2&&next.top>=identity.bottom-2&&next.left>=status.right-2}})()");
      assert.equal(cardLayout.full,true,'Competition spans the Overview width');
      const valueSelectors=['[data-club-position]','.club-competition-next-empty'];
      const valueBaselines=await run(`(${measureBaselines.toString()})(${JSON.stringify(valueSelectors)})`);
      assert.ok(valueBaselines.every(Number.isFinite),'Competition status and Next Match retain measurable visible values: '+JSON.stringify({width,theme,lang,valueBaselines}));
      assert.equal(await run("(()=>{const logo=document.querySelector('.club-competition-logo').getBoundingClientRect(),identity=document.querySelector('.club-competition-identity').getBoundingClientRect();return Math.abs((logo.top+logo.bottom)-(identity.top+identity.bottom))<2})()"),true,'Competition logo is centered within its row');
      if(width===1440)assert.equal(await run("(()=>{const layout=document.querySelector('.club-competition-layout').getBoundingClientRect(),league=document.querySelector('.club-competition-identity').getBoundingClientRect(),status=document.querySelector('.club-competition-metrics').getBoundingClientRect(),next=document.querySelector('.club-competition-next').getBoundingClientRect();return league.left>=layout.left-2&&league.right<=status.left+2&&status.right<=next.left+2&&next.right<=layout.right+2&&[league,status,next].every(r=>r.top>=layout.top-2&&r.bottom<=layout.bottom+2)})()"),true,'Competition league, status and next match occupy ordered non-overlapping columns inside the full-width band');
      assert.equal(await run("getComputedStyle(document.querySelector('.club-competition-name a')).fontSize"),width>760?'17px':width>480?'14px':'14px','League link uses the compact responsive font size');
      assert.equal(await run("(()=>{const status=document.querySelector('.club-competition-metrics').getBoundingClientRect(),next=document.querySelector('.club-competition-next').getBoundingClientRect(),layout=document.querySelector('.club-competition-layout').getBoundingClientRect(),mid=r=>(r.top+r.bottom)/2;return status.width>0&&next.width>0&&Math.abs(mid(status)-mid(next))<1.5&&[status,next].every(r=>r.top>=layout.top-2&&r.bottom<=layout.bottom+2)})()"),true,'Status and Next Match blocks are vertically centered within the competition row at '+width);
      assert.equal(await run("document.querySelector('.club-competition-context')"),null,'No provisional allocation label');
      const availablePanelWidth=await run("(()=>{const panel=document.querySelector('.club-competition'),css=getComputedStyle(panel);return panel.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight)})()");
       assert.equal(availablePanelWidth>800?cardLayout.sideBySide:cardLayout.stacked,true,
        'Competitions uses the same panel-width responsive breakpoint for Debug ON and OFF');
     }else{
      assert.equal(await run("document.querySelectorAll('.club-competition-entry[data-club-competition-id]').length"),0,'unverified membership must not be rendered');
      assert.equal(await run("Boolean(document.querySelector('.club-competition .club-fp-bar,.club-competition .club-competition-empty'))"),true,'pending or unavailable data is explicit');
     }
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
     await wait("document.querySelectorAll('.nav01-card').length===320&&document.querySelector('.nav01-grid')?.getAttribute('aria-busy')==='false'");
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
    await wait("document.querySelectorAll('.nav01-card').length===320&&document.querySelector('.nav01-grid')?.getAttribute('aria-busy')==='false'");
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
    await cmd('Page.reload');await wait("document.querySelectorAll('.nav01-card').length===128&&document.querySelector('.nav01-grid')?.getAttribute('aria-busy')==='false'");
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
    await wait("document.querySelectorAll('.nav01-card').length===320&&document.querySelector('.nav01-grid')?.getAttribute('aria-busy')==='false'");
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
    await wait("document.querySelectorAll('.nav01-card').length===320&&document.querySelector('.nav01-grid')?.getAttribute('aria-busy')==='false'");
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
    await wait("document.querySelectorAll('.nav01-card').length===320&&document.querySelector('.nav01-grid')?.getAttribute('aria-busy')==='false'");
    for(const language of ['en','de','es','fr','it']){
      await run("document.documentElement.lang="+JSON.stringify(language));
      assert.equal(await run("document.querySelectorAll('.nav01-card').length"),320);
    }
    console.log('CLUBS_03A_QA02: real accented manifest values, duplicate/invalid URLs and five languages passed');
    await cmd('Page.navigate',{url:origin+'/clubs'});
    await wait("document.querySelectorAll('.nav01-card').length===320&&document.querySelector('.nav01-grid')?.getAttribute('aria-busy')==='false'");
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
    await wait("document.querySelectorAll('.nav01-card').length===320&&document.querySelector('.nav01-grid')?.getAttribute('aria-busy')==='false'");
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
    await wait("document.querySelectorAll('.nav01-card').length===320&&document.querySelector('.nav01-grid')?.getAttribute('aria-busy')==='false'");
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
    assert.equal(await run("document.querySelectorAll('.club-history').length"),1);
    // Regression: a spare part of the History competition cell must not behave
    // like the text link (hover underline OR click). Test the actual browser
    // hit areas, not only stylesheet selector strings.
    const historyHitBoxes=await run(`(()=>{
      const probe=document.createElement('div');
      probe.id='club-history-link-hitbox-probe';
      const width=Math.min(380,window.innerWidth-24);
      probe.style.cssText='position:fixed;top:96px;left:12px;z-index:2147483647;background:var(--surface);width:'+width+'px';
      probe.innerHTML='<table class="club-history-table" style="width:100%;min-width:0"><colgroup><col style="width:44px"><col></colgroup><tbody><tr class="club-history-competition-row"><td></td><th scope="row" class="club-history-competition-value"><a class="club-history-competition-link" href="/competitions/it-1/standings"><span class="club-history-competition-text">League A</span></a></th></tr></tbody></table>';
      document.body.append(probe);
      const link=probe.querySelector('a'),cell=probe.querySelector('th'),label=probe.querySelector('.club-history-competition-text');
      window.__historyProbeClickCount=0;
      link.addEventListener('click',e=>{e.preventDefault();window.__historyProbeClickCount++});
      const a=link.getBoundingClientRect(),c=cell.getBoundingClientRect(),t=label.getBoundingClientRect();
      if(c.right-a.right<24)throw Error('History competition link unexpectedly occupies its empty cell');
      return {
        blank:{x:Math.floor((a.right+c.right)/2),y:Math.floor((a.top+a.bottom)/2)},
        label:{x:Math.floor((t.left+t.right)/2),y:Math.floor((t.top+t.bottom)/2)}
      };
    })()`);
    const moveToHistory=async({x,y})=>cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x,y,button:'none'});
    const clickHistory=async({x,y})=>{
      await cmd('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
      await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
    };
    await moveToHistory(historyHitBoxes.blank);
    assert.equal(await run("getComputedStyle(document.querySelector('#club-history-link-hitbox-probe .club-history-competition-text')).textDecorationLine"),'none',
      'the empty cell must not underline competition text');
    await clickHistory(historyHitBoxes.blank);
    assert.equal(await run('window.__historyProbeClickCount'),0,'the empty cell is not clickable');
    await moveToHistory(historyHitBoxes.label);
    assert.equal(await run("getComputedStyle(document.querySelector('#club-history-link-hitbox-probe .club-history-competition-text')).textDecorationLine"),'underline',
      'hovering the actual name underlines only that name');
    await clickHistory(historyHitBoxes.label);
    assert.equal(await run('window.__historyProbeClickCount'),1,'clicking the actual text activates the link');
    await run("document.getElementById('club-history-link-hitbox-probe').remove()");
    for(const view of ['roster','fixtures','stats','history']){
     await visit('/clubs/br/40/'+view+'?season=2&matchday=7');
     assert.equal(await run("!!document.querySelector('"+(view==='history'?'.club-history':view==='fixtures'?'.club-fixtures':view==='roster'?'.club-roster':'.club-empty')+"')"),true);
     assert.equal(await run('location.search'),['history','roster'].includes(view)?'':'?season=2&matchday=7');
    }
    // A failed API response must not invent a selected subview or mutate /roster.
    await visit('/clubs/it/1/roster?view=mental');
    await wait("document.querySelector('.club-roster[aria-busy=false] .app-players-empty-row')!==null");
    assert.equal(await run('location.search'),'','failed roster read stays at /roster');
    assert.equal(await run("document.querySelectorAll('.club-roster-tabs [aria-disabled=true]').length"),5);
    assert.equal(await run("document.querySelector('.club-load-error')"),null,'roster read failure is not a club identity failure');
    mockReadyRoster=true;
    await visit('/clubs/it/1/roster?view=info');
    await wait("location.search==='?view=info'&&document.querySelector('.club-roster[aria-busy=false]')!==null");
    assert.equal(await run("document.querySelector('.club-roster-tabs [aria-selected=true]')?.textContent"),'Info');
    assert.equal(await run("document.querySelector('.club-roster-tabs [data-club-roster-view=info]')?.getAttribute('href')"),'/clubs/it/1/roster?view=info');
    assert.equal(await run("document.querySelector('.club-roster-toolbar,.club-roster-groups')"),null,
      'Roster has five peer views and no Attributes sub-navigation');
    assert.deepEqual(await run("[...document.querySelectorAll('.club-roster-tabs [data-club-roster-view]')].map(el=>el.dataset.clubRosterView)"),
      ['info','technical','mental','physical','goalkeeping']);
    // Roster mobile: exactly 2.5 tabs before player count and edge-aware fade.
    for(const width of [320,390]){
     await cmd('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:true});
     await wait("document.querySelector('.club-roster-tabs')?.dataset.canScrollRight==='true'");
     const measured=await run("(()=>{const nav=document.querySelector('.club-roster-tabs'),count=document.querySelector('.club-roster-count'),row=document.querySelector('.club-roster-view-row'),buttons=[...nav.querySelectorAll('a')],n=nav.getBoundingClientRect(),third=buttons[2].getBoundingClientRect(),style=getComputedStyle(nav),item=buttons[0].getBoundingClientRect();return {rowHeight:row.getBoundingClientRect().height,navWidth:n.width,tabWidth:item.width,gap:parseFloat(style.columnGap),thirdVisible:Math.min(n.right,third.right)-Math.max(n.left,third.left),countAfter:count.getBoundingClientRect().left>=n.right,overflows:nav.scrollWidth>nav.clientWidth,fade:style.maskImage,right:nav.dataset.canScrollRight,left:nav.dataset.canScrollLeft}})()");
     // The main View strip restores scrollLeft from sessionStorage on navigation.
     // Exercise the left edge explicitly rather than assuming a fresh position.
     await run("document.querySelector('.club-tabs').scrollLeft=0;window.dispatchEvent(new Event('resize'))");
     await wait("(()=>{const nav=document.querySelector('.club-tabs');if(!nav)return false;const max=Math.max(0,nav.scrollWidth-nav.clientWidth);return nav.scrollLeft<1&&nav.dataset.canScrollLeft==='false'&&nav.dataset.canScrollRight===String(max>1)})()");
     const primary=await run("(()=>{const nav=document.querySelector('.club-tabs'),style=getComputedStyle(nav),scrollbar=getComputedStyle(nav,'::-webkit-scrollbar');return {width:style.scrollbarWidth,webkitDisplay:scrollbar.display,right:nav.dataset.canScrollRight,left:nav.dataset.canScrollLeft,overflow:nav.scrollWidth>nav.clientWidth}})()");
     assert.equal(primary.width,'none','primary Club View scrollbar is hidden at '+width);
     assert.equal(primary.webkitDisplay,'none','WebKit primary View scrollbar is hidden at '+width);
     assert.equal(primary.right,String(primary.overflow),'right fade matches actual mobile View overflow at '+width);
     assert.equal(primary.left,'false','no left fade at start at '+width);
     assert.equal(measured.rowHeight,42,'42px row at '+width);
     assert.ok(Math.abs(measured.navWidth-(2.5*measured.tabWidth+2*measured.gap))<2,'2.5 mobile tabs: '+JSON.stringify(measured));
     assert.ok(Math.abs(measured.thirdVisible/measured.tabWidth-0.5)<0.06,'half third tab: '+JSON.stringify(measured));
     assert.ok(measured.countAfter&&measured.overflows&&measured.fade!=='none'&&measured.right==='true'&&measured.left==='false','player count and right fade at '+width);
     await run("document.querySelector('.club-roster-tabs').scrollLeft=9999");
     await wait("document.querySelector('.club-roster-tabs')?.dataset.canScrollRight==='false'&&document.querySelector('.club-roster-tabs')?.dataset.canScrollLeft==='true'");
     await run("document.querySelector('.club-roster-tabs').scrollLeft=0");
     await wait("document.querySelector('.club-roster-tabs')?.dataset.canScrollLeft==='false'&&document.querySelector('.club-roster-tabs')?.dataset.canScrollRight==='true'");
    }
    await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await run("document.querySelector('[data-club-roster-view=technical]').click()");
    await wait("location.search==='?view=technical'");
    assert.equal(await run("document.querySelector('.club-roster')?.dataset.rosterMode"),'attributes');
    await run("document.querySelector('[data-club-roster-view=mental]').click()");
    await wait("location.search==='?view=mental'");
    assert.equal(await run("document.querySelector('.club-roster-table')?.dataset.rosterGroup"),'mental');
    await run("history.back()");
    await wait("location.search==='?view=technical'");
    assert.equal(await run("document.querySelector('.club-roster-table')?.dataset.rosterGroup"),'technical');
    await run("document.querySelector('[data-club-roster-sort=passing]').click()");
    await wait("location.search==='?view=technical&sort=passing&order=desc'");
    assert.equal(await run("document.querySelector('[data-club-roster-sort=passing]').closest('th').getAttribute('aria-sort')"),'descending');
    await run("document.querySelector('[data-club-roster-sort=passing]').click()");
    await wait("location.search==='?view=technical&sort=passing&order=asc'");
    assert.equal(await run("document.querySelector('[data-club-roster-sort=passing]').closest('th').getAttribute('aria-sort')"),'ascending');
    await run("document.querySelector('[data-club-roster-sort=passing]').click()");
    await wait("location.search==='?view=technical'");
    assert.equal(await run("document.querySelector('[data-club-roster-sort=passing]').closest('th').getAttribute('aria-sort')"),'none');
    await run("document.querySelector('[data-club-roster-view=info]').click()");
    await wait("location.search==='?view=info'");
    await run("document.querySelector('[data-club-roster-sort=positions]').click()");
    await wait("location.search==='?view=info&sort=positions&order=desc'");
    assert.equal(await run("document.querySelector('[data-club-roster-sort=positions]').closest('th').getAttribute('aria-sort')"),'descending');
    // Real browser: pending View controls are grey, have no href/focus target,
    // cannot navigate, and become enabled when the API delivers valid players.
    mockReadyRoster=false;
    holdRosterResponse=true;
    await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true});
    await visit('/clubs/it/1/roster?view=technical');
    await wait("document.querySelector('.club-roster[aria-busy=true] .club-roster-tabs [aria-disabled=true]')!==null");
    const pendingTabs=await run("(()=>{const root=document.querySelector('.club-roster'),tabs=[...root.querySelectorAll('[data-club-roster-view]')],style=getComputedStyle(tabs[0]);return {count:tabs.length,disabled:tabs.filter(a=>a.getAttribute('aria-disabled')==='true').length,hrefs:tabs.filter(a=>a.hasAttribute('href')).length,focus:tabs.map(a=>a.tabIndex),opacity:style.opacity,cursor:style.cursor}})()");
    assert.equal(pendingTabs.count,5);
    assert.equal(pendingTabs.disabled,5);
    assert.equal(pendingTabs.hrefs,0);
    assert.deepEqual(pendingTabs.focus,[-1,-1,-1,-1,-1]);
    assert.ok(Number(pendingTabs.opacity)<0.6&&pendingTabs.cursor==='default','loading subviews look disabled');
    assert.equal(await run("document.querySelector('.club-load-error')"),null,'loading roster must not show the generic Club info error');
    assert.equal(await run("document.documentElement.dataset.clubIdentityReady"),'true','club identity loads while the roster waits');
    // Pending views are grey and non-interactive on desktop, including the active tab.
    await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    const desktopPending=await run("(()=>{const tabs=[...document.querySelectorAll('.club-roster-tabs [data-club-roster-view]')];return tabs.map(el=>{const css=getComputedStyle(el);return {opacity:css.opacity,background:css.backgroundColor,pointer:css.pointerEvents,disabled:el.getAttribute('aria-disabled'),href:el.getAttribute('href')}})})()");
    assert.equal(desktopPending.length,5);
    for(const [index,tab] of desktopPending.entries()){
     assert.ok(Math.abs(Number(tab.opacity)-0.45)<0.02,'desktop disabled opacity: '+index);
     assert.ok(tab.background==='rgba(0, 0, 0, 0)'||tab.background==='transparent','desktop disabled background: '+index+' '+tab.background);
     assert.equal(tab.pointer,'none','desktop disabled pointer events '+index);
     assert.equal(tab.disabled,'true','desktop aria-disabled '+index);
     assert.equal(tab.href,null,'desktop must not expose nonfunctional URLs');
    }
    await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true});
    await run("document.querySelector('[data-club-roster-view=mental]').click()");
    assert.equal(await run('location.search'),'','loading subviews cannot navigate; stay at /roster');
    for(let i=0;i<100&&!blockedRosterResponses.length;i++)await delay(20);
    assert.ok(blockedRosterResponses.length>=1,'club roster request held until assertions complete');
    holdRosterResponse=false;
    const loadedRoster={schemaVersion:1,clubKey:'IT-1',count:1,players:[{id:1001,display_name:'Test Player',nationality:'ITA',primary_position:'CM',secondary_positions:[],age:20,height_cm:180,preferred_foot:'right',attributes:{}}]};
    blockedRosterResponses.splice(0).forEach(res=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(loadedRoster))});
    await wait("location.search==='?view=info'&&document.querySelector('.club-roster[aria-busy=false] [data-club-roster-view=mental][href]')?.getAttribute('aria-disabled')===null");
    assert.equal(await run("document.querySelector('.club-roster [aria-selected=true]')?.dataset.clubRosterView"),'info','successful response activates Info');
    assert.equal(await run("document.querySelector('.club-roster-tabs [aria-disabled=true]')"),null);
    await run("document.querySelector('[data-club-roster-view=mental]').click()");
    await wait("location.search==='?view=mental'");
    await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    // Verified API count=0: desktop and mobile render only a localized paragraph,
    // with no subviews, player count, sort buttons, or table.
    mockEmptyRoster=true;
    for(const [width,view] of [[1440,'info'],[390,'technical'],[320,'goalkeeping']]){
     await cmd('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<620});
     await visit('/clubs/it/1/roster?view='+view);
     await wait("document.querySelector('.club-roster[data-roster-mode=empty] .club-roster-empty')!==null");
     assert.equal(await run('location.search'),'','empty verified squad stays /roster');
     const emptyState=await run("(()=>{const root=document.querySelector('.club-roster'),p=root?.querySelector('p');return {text:root?.textContent.trim(),lang:document.documentElement.lang,children:root?.children.length,paragraph:p?.className,status:p?.getAttribute('role'),extras:root?.querySelector('nav,table,button,.club-roster-count,.club-roster-table-scroll'),overflow:document.documentElement.scrollWidth>innerWidth+1}})()");
     const emptyWords={en:'No players are currently assigned to this club.',de:'Diesem Verein sind derzeit keine Spieler zugeordnet.',es:'Actualmente no hay jugadores asignados a este club.',fr:'Aucun joueur n’est actuellement affecté à ce club.',it:'Nessun giocatore è attualmente assegnato a questo club.'};
     assert.equal(emptyState.text,emptyWords[emptyState.lang]||emptyWords.en,'empty roster copy at '+width);
     assert.equal(emptyState.children,1,'empty roster has one paragraph at '+width);
     assert.equal(emptyState.paragraph,'club-roster-empty');
     assert.equal(emptyState.status,'status');
     assert.equal(emptyState.extras,null,'no table, subviews, count or sort at '+width);
     assert.equal(emptyState.overflow,false,'empty roster cannot overflow viewport at '+width);
    }
    mockEmptyRoster=false;
    await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await visit('/clubs/it/1/overview?season=4');assert.equal(await run('location.search'),'');
    const publicLink=await run("document.querySelector('.club-competition a')?.getAttribute('href')??null");
    assert.ok(publicLink===null||publicLink==='/competitions/it-1/standings','Only verified source may replace initial season link');
    // QA-02: opening a club from the directory must reuse the crest URL and show no placeholder once loaded.
    await cmd('Page.navigate',{url:origin+'/clubs'});
    await wait("document.querySelectorAll('.nav01-card').length===320&&document.querySelector('.nav01-grid')?.getAttribute('aria-busy')==='false'");
    const sourceCrest=await run("(()=>{const card=[...document.querySelectorAll('.nav01-card')].find(a=>a.getAttribute('href')==='/clubs/it/1/overview');return card?.querySelector('img.nav01-crest-image')?.getAttribute('src')||null})()");
    assert.equal(sourceCrest,'/assets/clubs/IT/1/crest.svg');
    // UI-409: the shield occupies the same fixed box as the decoded transparent SVG.
    const sourceSlot="const card=[...document.querySelectorAll('.nav01-card')].find(a=>a.getAttribute('href')==='/clubs/it/1/overview');return card?.querySelector('.nav01-crest')";
    await run("(()=>{"+sourceSlot+"?.scrollIntoView({block:'center'})})()");
    await wait("(()=>{"+sourceSlot+"?.dataset.clubCrestLoaded==='true'})()");
    const shieldGeometry=await run("(()=>{"+sourceSlot.replace("return card?.querySelector('.nav01-crest')","const slot=card?.querySelector('.nav01-crest')")+
       ";const img=slot?.querySelector('img'),a=slot?.getBoundingClientRect(),b=img?.getBoundingClientRect();return {border:getComputedStyle(slot).borderTopWidth,shield:getComputedStyle(slot,'::before').display,width:a.width,height:a.height,imageWidth:b.width,imageHeight:b.height}})()");
    assert.equal(shieldGeometry.border,'0px');
    assert.equal(shieldGeometry.shield,'none','successful SVG decode must hide the shield');
    assert.equal(shieldGeometry.width,shieldGeometry.imageWidth);
    assert.equal(shieldGeometry.height,shieldGeometry.imageHeight);
    await run("document.querySelector('.nav01-card[href=\"/clubs/it/1/overview\"]').click()");
    // A decoded/cached image can have complete=true before the passive crest
    // manager observes its load event. Wait for the settled host, not only the image.
    await wait("location.pathname==='/clubs/it/1/overview'&&(()=>{const image=document.querySelector('.club-header .app-club-crest-image');return image?.complete&&image.naturalWidth>0&&image.closest('[data-club-crest]')?.dataset.clubCrestLoaded==='true'})()");
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
    await visit('/clubs/br/40/overview');
    await wait("document.querySelector('.club-competition .club-competition-empty,.club-competition .club-fp-bar')!==null");
    assert.equal(await run("document.querySelector('.club-competition a')"),null);
    assert.equal(await run("document.querySelectorAll('.club-competition .club-competition-empty,.club-competition .club-fp-competition').length"),1);
    assert.equal(await run("document.querySelector('.club-competition img,.club-competition .club-competition-status')"),null);
    await visit('/clubs/it/1/overview',devOrigin);
    await wait("document.querySelector('.fa-dev-widget')!==null");
    assert.equal(await run("document.querySelectorAll('.fa-dev-widget').length"),1);
    const division=JSON.parse(readFileSync(join(artifact,'competitions/_shared/manifest.json'),'utf8')).divisions.find(d=>d.id==='IT-1');
    const current=createPreviewStandings(division,15,2),index=current.rows.findIndex(r=>r.club.clubId===1);
    const upcoming=createPreviewStandings(division,30,2).fixtures.find(f=>f.round===16&&(f.homeId===1||f.awayId===1));
    const englishOrdinal=n=>String(n)+(n%100>=11&&n%100<=13?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th'));
    for(const width of [1440,768,390,320]){
     await cmd('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<620});
     devManifestDelay=150;
     await run("sessionStorage.setItem('football-architect:standings-dev-preview','on');sessionStorage.setItem('football-architect:standings-dev-season','2');sessionStorage.setItem('football-architect:standings-dev-matchdays','15');sessionStorage.removeItem('football-architect:calendar-dev-world-day');window.dispatchEvent(new Event('fa:fictional-standings-change'))");
     await run("document.querySelector('.club-tabs a[href$=\"/roster\"]').click();document.querySelector('.club-tabs a[href$=\"/overview\"]').click();window.__summaryTab=document.activeElement");
     await wait("document.querySelector('[data-club-position]')?.textContent==="+JSON.stringify(englishOrdinal(index+1)));
     devManifestDelay=0;
     assert.equal(await run("document.activeElement===window.__summaryTab"),true,'Delayed summary preserves the selected club tab and keyboard focus');
     assert.equal(await run("document.querySelector('[data-club-position]').textContent"),englishOrdinal(index+1));
     assert.equal(await run("getComputedStyle(document.querySelector('[data-club-position]')).fontSize"),width>760?'24px':'19px','Status value uses the approved compact responsive size');
     assert.equal(await run("document.querySelector('[data-club-position] a,[data-club-position] [tabindex]')"),null,'Status is plain text without navigation');
     assert.equal(await run("document.querySelector('[data-club-points]')"),null,'Points are not shown');
     // Presentation probes only: do not introduce fictional sporting results.
     for(const status of ['Semifinals','Eliminated in the quarter-finals','Ausgeschieden in der Qualifikationsrunde','Eliminado en la ronda de clasificación','Éliminé au tour de qualification','Eliminato al turno di qualificazione']){
      assert.equal(await run(`(()=>{const value=document.querySelector('[data-club-position]'),previous=value.textContent;value.textContent=${JSON.stringify(status)};const box=value,style=getComputedStyle(box),shell=document.querySelector('.fa-shell-content-scroll');const baselines=(${measureBaselines.toString()})(${JSON.stringify(['[data-club-position]','.club-competition-next a'])});const match=document.querySelector('.club-competition-next a').getBoundingClientRect(),round=document.querySelector('.club-competition-next small').getBoundingClientRect(),name=document.querySelector('.club-competition-name').getBoundingClientRect(),tier=document.querySelector('.club-competition-tier').getBoundingClientRect();const fits=box.scrollWidth<=box.clientWidth+1&&box.scrollHeight<=box.clientHeight+1&&shell.scrollWidth<=shell.clientWidth+1&&style.whiteSpace!=='nowrap'&&style.textOverflow!=='ellipsis'&&baselines.every(Number.isFinite)&&Math.abs(round.top-match.bottom-3)<1.5&&Math.abs(tier.top-name.bottom-3)<1.5;value.textContent=previous;return fits})()`),true,'Long localized status stays fully visible at '+width+': '+status);
     }
     assert.equal(await run("document.querySelector('.club-competition-next a').getAttribute('href')"),'/competitions/it-1/fixtures?matchday=16');

     // A later competition row with a wrapping status and no next fixture must
     // keep the same columns and share the vertical label/value tracks.
     const twoRowAlignment=await run(`(()=>{
      const list=document.querySelector('.club-competition-list'),first=list.querySelector('.club-competition-entry');
      const second=first.cloneNode(true);
      second.dataset.clubCompetitionId='qa-second-row';
      second.querySelector('.club-competition-name').textContent='Sovereign International Champions Championship '.repeat(12);
      second.querySelector('[data-club-position]').textContent='Eliminated in the quarter-finals';
      const empty=document.createElement('span');
      empty.className='club-competition-next-empty';empty.textContent='No upcoming match.';
      second.querySelector('.club-competition-next-content').replaceChildren(empty);
      list.append(second);
      const boxes=[first,second].map(row=>{
       const at=selector=>row.querySelector(selector).getBoundingClientRect();
       return {summary:at('.club-competition-summary'),statusLabel:at('.club-competition-metrics dt'),matchLabel:at('.club-competition-next > .club-competition-label'),
        statusValue:at('.club-competition-metrics dd'),matchValue:at('.club-competition-next-content')};
      }).map(({summary,statusLabel,matchLabel,statusValue,matchValue})=>({
        labelSummaryDelta:Math.abs(statusLabel.top-summary.top),
       statusCenterDelta:Math.abs((statusLabel.left+statusLabel.right-statusValue.left-statusValue.right)/2),
       nextXDelta:Math.abs(matchLabel.left-matchValue.left),
       labelDelta:Math.abs(statusLabel.top-matchLabel.top),
       valueDelta:Math.abs(statusValue.top-matchValue.top),
       statusX:statusLabel.left,matchX:matchLabel.left
      }));
      second.remove();
      return boxes;
     })()`);
     assert.ok(twoRowAlignment.length===2&&twoRowAlignment.every(row=>row.labelSummaryDelta<1.5&&row.labelDelta<1.5&&row.valueDelta<1.5&&row.statusCenterDelta<1.5&&row.nextXDelta<1.5)
      &&Math.abs(twoRowAlignment[0].statusX-twoRowAlignment[1].statusX)<1.5
      &&Math.abs(twoRowAlignment[0].matchX-twoRowAlignment[1].matchX)<1.5,
      'Both competition rows align Status and Next match at '+width+': '+JSON.stringify(twoRowAlignment));

     // Compare actual hydrated slots to the exact pending/first-paint skeleton
     // classes. Normalize per-row y so the independent panels are comparable.
     const skeletonParity=await run(`(()=>{
      const panel=document.querySelector('.club-competition'),hydrated=panel.querySelector('.club-competition-entry');
      const pendingList=panel.querySelector('.club-competition-list').cloneNode(true);
      pendingList.classList.add('club-fp-competition');
      const pending=pendingList.querySelector('.club-competition-entry');
      pendingList.querySelectorAll('.club-competition-entry').forEach((row,index)=>{if(index)row.remove()});
      pending.querySelector('.club-competition-logo').outerHTML='<span class="club-competition-logo club-fp-competition-logo" aria-hidden="true"></span>';
      pending.querySelector('.club-competition-name').innerHTML='<span class="club-fp-bar club-fp-competition-name"></span>';
      pending.querySelector('.club-competition-tier').innerHTML='<span class="club-fp-bar club-fp-competition-tier"></span>';
      pending.querySelector('.club-competition-metrics dd').innerHTML='<span class="club-fp-bar club-fp-competition-position"></span>';
      pending.querySelector('.club-competition-next-content').innerHTML='<span class="club-fp-bar club-fp-competition-fixture"></span><span class="club-fp-bar club-fp-competition-round"></span>';
      panel.classList.add('club-first-paint-panel');
      panel.querySelector('.club-competition-list').after(pendingList);
      const measure=(row,selector)=>{const r=row.querySelector(selector).getBoundingClientRect(),base=row.getBoundingClientRect();return {x:r.x-base.x,y:r.y-base.y,h:r.height}};
      const check=selectors=>selectors.map(selector=>({selector,hydrated:measure(hydrated,selector),pending:measure(pending,selector)}));
      const positions=check(['.club-competition-identity','.club-competition-name','.club-competition-tier',
       '.club-competition-metrics dt',
       '.club-competition-next > .club-competition-label','.club-competition-next-content']);
      const skeletonBar=measure(pending,'.club-fp-competition-position');
      const statusLabelBox=pending.querySelector('.club-competition-metrics dt').getBoundingClientRect();
      const statusBarBox=pending.querySelector('.club-fp-competition-position').getBoundingClientRect();
      const statusBarCenterDelta=Math.abs((statusLabelBox.left+statusLabelBox.right-statusBarBox.left-statusBarBox.right)/2);
      const hydratedStatusBox=hydrated.querySelector('.club-competition-metrics dd').getBoundingClientRect();
      const hydratedStatusCenterDelta=Math.abs((hydratedStatusBox.left+hydratedStatusBox.right-statusBarBox.left-statusBarBox.right)/2);
      const statusValueYDelta=Math.abs(measure(hydrated,'.club-competition-metrics dd').y-measure(pending,'.club-competition-metrics dd').y);
      const expectedBar=(parseFloat(getComputedStyle(hydrated.querySelector('.club-competition-metrics dd')).lineHeight)-12)/2;
      const fixture=measure(pending,'.club-fp-competition-fixture');
      const round=measure(pending,'.club-fp-competition-round');
      const realFixtureLine=parseFloat(getComputedStyle(hydrated.querySelector('.club-competition-next a')).lineHeight);
      const realRoundLine=parseFloat(getComputedStyle(hydrated.querySelector('.club-competition-next small')).lineHeight);
      pendingList.remove();panel.classList.remove('club-first-paint-panel');
      return {positions,statusBarCenterDelta,hydratedStatusCenterDelta,statusValueYDelta,barDelta:skeletonBar.y-measure(hydrated,'.club-competition-metrics dd').y,
       expectedBar,fixtureHeight:fixture.h,roundHeight:round.h,
       expectedFixtureHeight:realFixtureLine,expectedRoundHeight:realRoundLine,
       fixtureRoundGap:round.y-fixture.y-fixture.h};
     })()`);
     assert.ok(skeletonParity.positions.every(p=>Math.abs(p.hydrated.x-p.pending.x)<1.5&&Math.abs(p.hydrated.y-p.pending.y)<1.5)
      &&skeletonParity.statusBarCenterDelta<1.5
      &&skeletonParity.hydratedStatusCenterDelta<1.5&&skeletonParity.statusValueYDelta<1.5
      &&Math.abs(skeletonParity.barDelta-skeletonParity.expectedBar)<1.5
      &&Math.abs(skeletonParity.fixtureHeight-skeletonParity.expectedFixtureHeight)<1.5
      &&Math.abs(skeletonParity.roundHeight-skeletonParity.expectedRoundHeight)<1.5
      &&Math.abs(skeletonParity.fixtureRoundGap-3)<1.5,
      'Skeletons retain hydrated name, tier, Status and Next match slots at '+width+': '+JSON.stringify(skeletonParity));
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

     assert.equal(await run("getComputedStyle(document.querySelector('.club-competition-next a')).fontSize"),width>760?'14px':'13px','Next match uses the approved compact responsive size');
     await run("document.querySelector('.club-competition-next a').scrollIntoView({block:'center',behavior:'instant'});document.querySelector('.club-competition-next a').blur()");
     await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});
     const fixtureDecoration="getComputedStyle(document.querySelector('.club-competition-match-name')).textDecorationLine";
     assert.equal(await run(fixtureDecoration),'none','Fixture has no underline before hover');
     const fixtureTarget=await run("(()=>{const r=document.querySelector('.club-competition-match-name').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()");
     await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',...fixtureTarget});
     assert.equal(await run(fixtureDecoration),'underline','Actual pointer hover underlines the fixture text');
     assert.equal(await run("getComputedStyle(document.querySelector('.club-competition-match-name')).textUnderlineOffset"),'1px','Underline stays inside the clipped line box');
     assert.equal(await run("getComputedStyle(document.querySelector('.club-competition-next a')).textDecorationLine"),'none','Underline belongs to match text rather than the link box');
     await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});
     assert.equal(await run(fixtureDecoration),'none','Pointer leave clears the underline');
     await key('Tab',9);await run("document.querySelector('.club-competition-next a').focus()");
     assert.equal(await run("document.querySelector('.club-competition-next a').matches(':focus-visible')"),true);
     assert.equal(await run(fixtureDecoration),'underline','Keyboard focus underlines the fixture text');
     await run("document.querySelector('.club-competition-next a').blur()");
     assert.equal(await run(fixtureDecoration),'none','Blur clears the keyboard underline');
     const fixtureText=await run("document.querySelector('.club-competition-next a').textContent");
     for(const id of [upcoming.homeId,upcoming.awayId])assert.ok(fixtureText.includes(division.clubs.find(c=>c.clubId===id).primaryName));
     assert.equal(await run("(()=>{const root=document.querySelector('.fa-shell-content-scroll');return root.scrollWidth<=root.clientWidth+1})()"),true,'Live Competition summary fits at '+width);
     await run("document.querySelector('.club-competition-match-name').textContent='Ausgeschieden in der Qualifikationsrunde gegen Sportgemeinschaft Reinickendorf'");
     const beforeTransition=await run("(()=>{const panel=document.querySelector('.club-competition').getBoundingClientRect(),layout=document.querySelector('.club-overview-layout').getBoundingClientRect();return {height:panel.height,offset:panel.top-layout.top}})()");
     await run("document.querySelector('.club-competition-next a').focus();sessionStorage.setItem('football-architect:standings-dev-preview','off');window.dispatchEvent(new Event('fa:fictional-standings-change'))");
     await wait("document.querySelector('[data-club-position]')?.textContent==='—'");
     assert.equal(await run("document.querySelector('.club-competition-next a')"),null,'Disabling DEV removes future fixtures');
     const afterTransition=await run("(()=>{const panel=document.querySelector('.club-competition').getBoundingClientRect(),layout=document.querySelector('.club-overview-layout').getBoundingClientRect();return {height:panel.height,offset:panel.top-layout.top}})()");
     assert.ok(Math.abs(afterTransition.offset-beforeTransition.offset)<2,
      'Next Match keeps the panel anchored while switching Debug source at '+width);
     assert.ok(afterTransition.height>0&&afterTransition.height<=beforeTransition.height+1,
      'The panel may shrink after a deliberately long fixture disappears, but never collapses or grows at '+width);
     assert.equal(await run("document.activeElement.classList.contains('club-competition')"),true,'Removing a focused summary link retains focus in its panel');
    }
    // FR-1 regression: hover the exact match-name node on the reported route.
    for(const width of [1440,768,390,320]){
     await cmd('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<620});
     await visit('/clubs/fr/1/overview',devOrigin);
     await run("sessionStorage.setItem('football-architect:standings-dev-preview','on');sessionStorage.setItem('football-architect:standings-dev-season','1');sessionStorage.setItem('football-architect:standings-dev-matchdays','0');sessionStorage.removeItem('football-architect:calendar-dev-world-day');window.dispatchEvent(new Event('fa:fictional-standings-change'))");
     await wait("document.querySelector('.club-competition-match-name')!==null");
     await run("document.querySelector('.club-competition-match-name').scrollIntoView({block:'center',behavior:'instant'})");
     await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});
     assert.equal(await run("getComputedStyle(document.querySelector('.club-competition-match-name')).textDecorationLine"),'none');
     const target=await run("(()=>{const el=document.querySelector('.club-competition-match-name'),range=document.createRange();range.selectNodeContents(el);const r=range.getClientRects()[0];return {x:r.left+r.width/2,y:r.top+r.height/2}})()");
     await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',...target});
     assert.equal(await run("document.querySelector('.club-competition-match-name').matches(':hover')&&getComputedStyle(document.querySelector('.club-competition-match-name')).textDecorationLine==='underline'"),true,'FR-1 match-name hover at '+width);
     await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});
    }
    // Drive the actual shared widget rather than changing storage directly.
    await visit('/clubs/it/1/overview',devOrigin);
    await wait("document.querySelector('[data-dev-control=season-number]')!==null");
    await run("document.querySelector('.fa-dev-widget-button').click()");
    await run("(()=>{const control=document.querySelector('[data-dev-control=season-number]');control.value='3';control.dispatchEvent(new Event('change',{bubbles:true}))})()");
    await wait("document.querySelector('.club-competition-next a')?.getAttribute('href').includes('matchday=')");
    assert.equal(await run("document.querySelector('.club-competition-context')"),null,'No Season/Preview caption in DEV');
    await run("(()=>{const control=document.querySelector('[data-dev-control=world-day-number]');control.value='28';control.dispatchEvent(new Event('change',{bubbles:true}))})()");
    const advanced=createPreviewStandings(division,16,3),advancedIndex=advanced.rows.findIndex(r=>r.club.clubId===1);
    await wait("document.querySelector('.club-competition-next a')?.getAttribute('href')==='/competitions/it-1/fixtures?matchday=17'");
    assert.equal(await run("document.querySelector('[data-club-position]').textContent"),englishOrdinal(advancedIndex+1));
    assert.equal(await run("document.querySelector('.club-competition-next a').getAttribute('href')"),'/competitions/it-1/fixtures?matchday=17');
    assert.equal(await run("document.querySelector('.club-competition-name a').getAttribute('href')"),'/competitions/it-1/standings');
    await run("document.querySelector('.club-competition-name a').click()");
    await wait("location.pathname==='/competitions/it-1/standings'&&window.faCompetitionContext?.selectedSeason===3&&window.faCompetitionContext?.seasonData?.season===3&&document.documentElement.dataset.faStandingsLoading==='false'");
    assert.deepEqual(await run("[...document.querySelectorAll('#app-standings-body tr[data-world-club]')].map(row=>[row.dataset.worldClub,Number(row.children[9].textContent)])"),advanced.rows.map(row=>[row.club.countryId+'-'+row.club.clubId,row.pts]),'Club -> Standings preserves the displayed season and full table');
    await visit('/clubs/it/1/overview',devOrigin);
    await wait("document.querySelector('.club-competition-name a')?.getAttribute('href')==='/competitions/it-1/standings'");
    await run("document.querySelector('[data-dev-control=reset-global]').click()");
    await wait("document.querySelector('.club-competition-next a')===null&&[...document.querySelectorAll('[data-club-position]')].every(el=>el.textContent==='—')");
    assert.equal(await run("[...document.querySelectorAll('[data-club-position]')].every(el=>el.textContent==='—')"),true,'Reset cannot leave a fabricated club position');
    assert.equal(await run("document.querySelector('.club-competition-next a')"),null,'Reset cannot leave a fictional next fixture');
    await visit('/clubs/br/40/history',devOrigin);
    await wait("document.querySelector('.fa-dev-widget')!==null");
    await visit('/clubs/it/1/overview');
    await run("sessionStorage.setItem('football-architect:standings-dev-preview','on');window.dispatchEvent(new Event('fa:fictional-standings-change'))");
    const publicSummary=await run("(()=>{const panel=document.querySelector('.club-competition');return {positions:[...panel.querySelectorAll('[data-club-position]')].map(el=>el.textContent.trim()),nextLinks:panel.querySelectorAll('.club-competition-next a').length,verifiedEntries:panel.querySelectorAll('.club-competition-entry[data-club-competition-id]').length,seasonOneLink:!!panel.querySelector('a[href^=\"/competitions/it-1/standings?season=1\"]'),loading:!!panel.querySelector('.club-fp-bar'),unavailable:!!panel.querySelector('.club-competition-empty')}})()");
    assert.deepEqual(publicSummary.positions.filter(value=>value!=='—'),[],'Public club cannot reuse fictional standings');
    assert.equal(publicSummary.nextLinks,0,'Public club must not leak a fictional next fixture');
    assert.equal(publicSummary.verifiedEntries,0,'No verified public world means no fabricated membership');
    assert.equal(publicSummary.seasonOneLink,false,'Do not fall back to Season 1 division in a public read');
    assert.ok(publicSummary.loading||publicSummary.unavailable,'Keep a truthful public loading/unavailable state');
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
      // Legacy leg URLs are accepted, but public Fixtures links are now phase-only.
      const groupedLeg=row.matchday==='quarterfinals:2';
      if(groupedLeg)await wait("!!window.faFixtures&&window.faCompetitionRoute.get().matchday==='quarterfinals:1'");
      const expected=new URL(groupedLeg?row.expected.replace('quarterfinals%3A2','quarterfinals'):row.expected,origin);
      const incoming=new URL(row.input,origin);
      // #531: preserve unrelated query parameters and fragments across legacy redirects.
      for(const [key,value] of incoming.searchParams)if(!['view','season','matchday','calendarReturn'].includes(key))expected.searchParams.append(key,value);
      if(incoming.hash)expected.hash=incoming.hash;
      assert.equal(await currentUrl(),expected.pathname+expected.search+expected.hash,'A03-04C direct '+width+' '+row.input);
      assert.deepEqual(await run('window.__faRoutesBootstrap'),{clubModel:false,competitionRoute:false},'Core precedes deferred consumers');
      assert.equal(await run('Object.isFrozen(window.faRoutesRegistry)&&Object.isFrozen(window.faRoutesRegistry.countries)'),true);
      assert.equal(await run("window.faRoutesRegistry.buildRoute({kind:'club',country:'br',id:40,view:'history'})"),'/clubs/br/40/history');

      assert.equal(await run('window.faCompetitionRoute.get().view'),row.view);
      assert.equal(await run('window.faCompetitionRoute.get().matchday'),groupedLeg?'quarterfinals:1':row.matchday);
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

test('CLUB-FIXTURES browser: canonical reads, delayed tabs, controls, responsive and history',{timeout:120000},async()=>{
 const {published}=await import('./canonical-state-browser.mjs');
 const browser=chrome(),dir=await mkdtemp(join(tmpdir(),'fa-club-fixtures-'));
 let world={schemaVersion:1,generation:'550e8400-e29b-41d4-a716-446655440000',revision:4,seasonNumber:1,day:16,phase:'active'};
 let hold=false,failHistory=false,failCompetition=false,failFixtures=false,useDev=false;const held=[];let fixtureReads=0,competitionReads=0;
 const payloadFor=season=>{
  const closed=season<world.seasonNumber||world.phase==='closed';
  const raw=published('IT-1',season,closed?{...world,day:56}:world);
  return {...raw,world,status:closed?'available':'partial',data:{...raw.data,
   seasonState:{day:closed?56:world.day,phase:closed?'closed':world.phase},
   standings:{...raw.data.standings,complete:closed},
   history:closed?{season,archiveHash:'a'.repeat(64),closedAt:1,championClubId:'IT-1'}:null}};
 };
 const router=createPreviewServer({devPreview:false}),devRouter=createPreviewServer();
 const server=createServer((req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  const json=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
  if(path==='/api/world')return json(200,{world});
  const clubFixtureRoute=/^\/api\/clubs\/IT-1\/seasons\/([12])\/fixtures$/.exec(path);
  if(clubFixtureRoute){
   fixtureReads++;const season=Number(clubFixtureRoute[1]),raw=payloadFor(season);
   const packet={schemaVersion:1,providerId:'authoritative-world',clubKey:'IT-1',selectedSeason:season,world,
    status:raw.status,reason:null,
    provenance:{kind:'authoritative',resultAuthority:'temporary-score-v1',sourceRef:'club-fixtures:'+world.generation+':season:'+season+':'+('a'.repeat(64))},
    data:{season,seasonState:raw.data.seasonState,competitions:['IT-1'],
     fixtures:raw.data.fixtures.filter(f=>[f.homeClubId,f.awayClubId].includes('IT-1'))}};
   const send=()=>{
    if(failFixtures)return json(503,{error:{code:'sporting_data_unavailable'}});
    if(failCompetition)return json(200,{...packet,status:'unavailable',reason:'unsupported-season',
     provenance:{kind:'none',resultAuthority:null,sourceRef:null},data:null});
    return json(200,packet);
   };
   if(hold)held.push(send);else send();return;
  }
  if(path==='/api/clubs/IT-1/history'){
   if(failHistory)return json(503,{});
   const overviews=Array.from({length:world.seasonNumber},(_,i)=>{
    const season=i+1,raw=payloadFor(season),{clubId,...stats}=raw.data.statistics.teams.find(t=>t.clubId==='IT-1');
    return {schemaVersion:1,providerId:'authoritative-world',clubKey:'IT-1',selectedSeason:season,world,status:raw.status,reason:null,
     provenance:{kind:'authoritative',resultAuthority:'temporary-score-v1',sourceRef:'club:'+world.generation+':season:'+season+':x'},
     data:{season,memberships:[{competitionId:'IT-1',season,category:'domestic',position:stats.played?1:null,points:stats.played,cupStatus:null,nextMatch:null,stats}]}};
   });
   return json(200,{schemaVersion:1,providerId:'authoritative-world',clubKey:'IT-1',world,status:'available',reason:null,
    provenance:{kind:'authoritative',resultAuthority:'temporary-score-v1',sourceRef:'club-history:'+world.generation+':revision:'+world.revision},data:{overviews}});
  }
  const competition=/^\/api\/competitions\/IT-1\/seasons\/([12])$/.exec(path);
  if(competition){
   competitionReads++;
   const data=payloadFor(Number(competition[1])),send=()=>json(failCompetition?503:200,data);
   if(hold)held.push(send);else send();return;
  }
  req.headers.host='127.0.0.1:2000';(useDev?devRouter:router).emit('request',req,res);
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
 const proc=spawn(browser,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-proxy-server','--no-first-run','--remote-debugging-port=0','--user-data-dir='+dir,'about:blank'],{stdio:['ignore','ignore','pipe']});
 let stderr='',socket;proc.stderr.on('data',d=>stderr+=d);
 try{
  let endpoint;for(let i=0;i<100&&!endpoint;i++){endpoint=stderr.match(/DevTools listening on (ws:\/\/\S+)/)?.[1];if(!endpoint)await delay(50);}
  assert.ok(endpoint,'Chromium starts');const address=new URL(endpoint).host;
  const tab=(await(await fetch('http://'+address+'/json/list')).json()).find(t=>t.type==='page');
  socket=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((ok,fail)=>{socket.addEventListener('open',ok,{once:true});socket.addEventListener('error',fail,{once:true});});
  let seq=0;const pending=new Map();socket.addEventListener('message',e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);});
  const cmd=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},10000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
  const run=async expression=>{const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  const wait=async expr=>{for(let i=0;i<100;i++){if(await run(expr).catch(()=>false))return;await delay(50);}throw Error('Timed out '+expr+'; '+await run("JSON.stringify({url:location.href,state:document.querySelector('.club-fixtures')?.dataset.clubFixturesState,text:document.querySelector('.club-fixtures')?.textContent,errors:window.__errors,active:document.activeElement?.outerHTML?.slice(0,250)})"));};
  await cmd('Page.enable');await cmd('Emulation.setFocusEmulationEnabled',{enabled:true});await cmd('Page.addScriptToEvaluateOnNewDocument',{source:"window.__errors=[];window.addEventListener('error',e=>__errors.push(e.message));window.addEventListener('unhandledrejection',e=>__errors.push(String(e.reason?.stack||e.reason)));"});
  const visit=async()=>{await cmd('Page.navigate',{url:origin+'/clubs/it/1/fixtures?season=1'});await wait("document.documentElement.dataset.clubReady==='true'&&document.querySelector('.club-fixtures-controls')");};
  hold=true;await visit();await wait("document.querySelectorAll('.club-fixture-loading').length===6");
  const before=await run("[...document.querySelectorAll('.club-fixture-select button')].map(n=>({x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y,w:n.getBoundingClientRect().width}))");
  await wait('true');for(let i=0;i<100&&!held.length;i++)await delay(20);assert.ok(held.length,'canonical season request is pending');
  await run("document.querySelector('.club-tabs a[href$=\"/roster\"]').click()");held.splice(0).forEach(send=>send());hold=false;
  await delay(50);assert.equal(await run("document.querySelector('.club-fixtures')===null"),true,'late fixtures cannot replace Roster');
  await run("document.querySelector('.club-tabs a[href*=\"/fixtures\"]').click()");await wait("document.querySelectorAll('[data-club-fixture-id]').length===30");
  const after=await run("[...document.querySelectorAll('.club-fixture-select button')].map(n=>({x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y,w:n.getBoundingClientRect().width}))");assert.deepEqual(after,before,'controls keep first-paint geometry');
  assert.ok(fixtureReads>=1,'verified club fixture endpoint serves the public view, including cache reuse');
  assert.equal(competitionReads,0,'Club Fixtures never calls the per-competition season APIs');
  assert.deepEqual(await run("[...document.querySelectorAll('[data-club-fixture-control=season] [data-menu-value]')].map(n=>n.dataset.menuValue)"),['1'],'Season 1 offers only Season 1');
  assert.equal(await run("document.querySelector('.club-fixtures-notice')"),null);

  await run("window.__fixtureFocus=document.querySelector('[data-club-fixture-control=season] button');__fixtureFocus.focus();document.documentElement.lang='it'");await delay(80);assert.equal(await run('document.activeElement===window.__fixtureFocus'),true,'locale redraw retains focused combobox');
  await run("document.documentElement.lang='en'");await delay(60);
  assert.equal(await run("[...document.querySelectorAll('.club-fixture-opponent')].every(n=>!n.href.includes('/it/1/'))"),true);
  assert.equal(await run("document.querySelectorAll('.club-fixture-opponent [data-club-crest]').length"),30,'each repeated opponent retains its own crest host');
  assert.equal(await run("[...document.querySelectorAll('[data-club-fixture-id]')].filter(n=>Number(n.querySelector('.club-fixture-meta span').textContent.replace(/\\D/g,''))>16).every(n=>n.querySelector('strong').textContent==='—')"),true);
  await run("document.querySelector('[data-club-venue]').focus()");await wait("!document.getElementById('club-fixture-venue-tooltip').hidden");
  assert.equal(await run("document.activeElement.getAttribute('aria-describedby')"),'club-fixture-venue-tooltip');
  await run("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");assert.equal(await run("document.getElementById('club-fixture-venue-tooltip').hidden"),true);
  // MOBILE-QA #527: cover intermediate real-device widths beyond the 320/390 baselines.
  for(const [width,lang,theme] of [[320,'it','dark'],[375,'en','dark'],[390,'de','light'],[430,'fr','light'],[768,'es','dark'],[1440,'fr','light'],[390,'en','light']]){
   await cmd('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
   await run(`document.documentElement.lang=${JSON.stringify(lang)};document.documentElement.dataset.theme=${JSON.stringify(theme)}`);await delay(60);
   const controls=await run("(()=>{const box=n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}};return {tabs:box(document.querySelector('.club-tabs')),toolbar:box(document.querySelector('.club-fixtures-controls')),next:box(document.querySelector('[data-club-fixtures-next]')),competition:box(document.querySelector('[data-club-fixture-control=competition]')),season:box(document.querySelector('[data-club-fixture-control=season]'))}})()");
   assert.ok(Math.abs(controls.toolbar.top-controls.tabs.bottom-14)<1,'controls sit 14px below view separator at '+width);
   if(width<=620){
    assert.ok(controls.competition.right<=controls.season.left,'mobile competition precedes season at '+width);
    assert.ok(Math.abs(controls.competition.left-controls.toolbar.left)<1&&Math.abs(controls.season.right-controls.toolbar.right)<1,'mobile selectors fill first row at '+width);
    assert.ok(controls.next.top>=Math.max(controls.competition.bottom,controls.season.bottom)+7,'mobile next match sits below selectors at '+width);
    assert.ok(Math.abs((controls.next.left+controls.next.right)-(controls.toolbar.left+controls.toolbar.right))<=2,'mobile next match is centered at '+width);
   }else{
    assert.ok(Math.abs(controls.next.left-controls.toolbar.left)<1,'desktop next command stays at left at '+width);
    assert.ok(controls.competition.right<=controls.season.left,'desktop competition precedes season at '+width);
    assert.ok(Math.abs(controls.season.right-controls.toolbar.right)<1,'desktop selectors align right at '+width);
   }
   assert.equal(await run("document.documentElement.scrollWidth<=innerWidth&&document.querySelector('.fa-shell-content-scroll').scrollWidth<=document.querySelector('.fa-shell-content-scroll').clientWidth+1&&document.querySelector('.club-fixtures').scrollWidth<=document.querySelector('.club-fixtures').clientWidth"),true,'no shell/page/fixtures overflow '+width+' '+lang);
   assert.equal(await run("[...document.querySelectorAll('.club-fixture-result')].every(n=>n.getBoundingClientRect().width>=64)"),true);
   if(process.env.CLUB_FIXTURES_QA_DIR&&[320,375,430,1440].includes(width)){
    mkdirSync(process.env.CLUB_FIXTURES_QA_DIR,{recursive:true});
    const capture=await cmd('Page.captureScreenshot',{format:'png'});
    writeFileSync(join(process.env.CLUB_FIXTURES_QA_DIR,'club-fixtures-'+width+'-'+lang+'-'+theme+'.png'),Buffer.from(capture.data,'base64'));
   }
   await run("document.querySelector('[data-club-venue]').focus()");assert.equal(await run("document.getElementById('club-fixture-venue-tooltip').textContent===document.activeElement.getAttribute('aria-label')"),true);
   assert.equal(await run("(()=>{const n=document.querySelector('[data-club-fixtures-next]'),r=n.getBoundingClientRect();return r.height>=44&&n.scrollWidth<=n.clientWidth+1&&r.left>=0&&r.right<=innerWidth&&n.textContent.trim().length>5})()"),true,'next command remains visible and legible');
  }
  // V01: compare pending-row skeleton slots against actual hydrated text.
  const fixtureGeometry=()=>run(`(()=>{
   const row=document.querySelector('.club-fixture-row');
   if(!row)return null;
   const loading=row.classList.contains('club-fixture-loading');
   const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,cx:r.x+r.width/2,cy:r.y+r.height/2,width:r.width,height:r.height};};
   const measure=selector=>{const n=row.querySelector(selector);if(!n)throw Error('Missing fixture geometry '+selector);return rect(n);};
   const selectors={
    day:loading?'.club-fixture-skeleton-line:first-child':'.club-fixture-meta > span:first-child',
    league:loading?'.club-fixture-skeleton-line:nth-child(2)':'.club-fixture-meta a',
    name:loading?'.club-fixture-skeleton-name-slot':'.club-fixture-opponent > span:last-child',
    venue:'.club-fixture-venue',score:'.club-fixture-result strong',status:'.club-fixture-result small'
   };
   const bars={day:'.club-fixture-skeleton-day',league:'.club-fixture-skeleton-league',
    name:'.club-fixture-skeleton-name',venue:'.club-fixture-skeleton-venue',
    score:'.club-fixture-skeleton-score',status:'.club-fixture-skeleton-status'};
   return {loading,row:rect(row),meta:rect(row.querySelector('.club-fixture-meta')),opponent:rect(row.querySelector('.club-fixture-opponent')),parts:Object.fromEntries(Object.entries(selectors).map(([key,selector])=>[key,measure(selector)])),
    bars:loading?Object.fromEntries(Object.entries(bars).map(([key,selector])=>[key,measure(selector)])):null,
    season:document.querySelector('[data-club-fixture-control=season] [data-club-fixture-value]')?.textContent.trim(),
    selectorSkeleton:!!document.querySelector('[data-club-fixture-control=season] .club-fp-bar')};
  })()`);
  for(const width of [320,375,390,430,768,1440]){
   await cmd('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<500});
   hold=true;await cmd('Page.navigate',{url:origin+'/clubs/it/1/fixtures?season=1'});
   await wait("document.querySelectorAll('.club-fixture-loading').length===6");
   const pendingLayout=await fixtureGeometry();
   assert.equal(pendingLayout.loading,true,'row skeletons exist at '+width);
   assert.ok(pendingLayout.season.endsWith(' 1'),'URL season shown while loading at '+width);
   assert.equal(pendingLayout.selectorSkeleton,false,'season control has no skeleton at '+width);
   for(const [part,bar] of Object.entries(pendingLayout.bars)){
    const slot=pendingLayout.parts[part];
    assert.ok(bar.width>0&&bar.height>0,'visible '+part+' skeleton at '+width);
    assert.ok(Math.abs(bar.cy-slot.cy)<=6,'center '+part+' skeleton in text slot at '+width);
   }
   for(let i=0;i<100&&!held.length;i++)await delay(20);
   assert.ok(held.length,'canonical API held for geometry at '+width);
   hold=false;held.splice(0).forEach(send=>send());
   await wait("document.querySelectorAll('[data-club-fixture-id]').length===30");
   const loadedLayout=await fixtureGeometry();
   assert.equal(loadedLayout.loading,false);
   assert.equal(loadedLayout.selectorSkeleton,false,'no season bar after hydration at '+width);
   assert.ok(Math.abs(pendingLayout.row.y-loadedLayout.row.y)<=2,'first row stays anchored at '+width);
   if(width<=620){
    assert.ok(pendingLayout.opponent.height>=44&&loadedLayout.opponent.height>=44,'reserve three lines and a 44px opponent touch target at '+width);
    assert.ok(Math.abs(pendingLayout.opponent.height-loadedLayout.opponent.height)<=2,'opponent height stays fixed across hydration at '+width+': '+pendingLayout.opponent.height+' / '+loadedLayout.opponent.height);
    const metaReserved=width<=360?36:24;
    assert.ok(pendingLayout.meta.height>=metaReserved&&loadedLayout.meta.height>=metaReserved,'reserve the appropriate two or three metadata lines at '+width);
    assert.ok(Math.abs(pendingLayout.meta.height-loadedLayout.meta.height)<=2,'fixture metadata height stays fixed across hydration at '+width+': '+pendingLayout.meta.height+' / '+loadedLayout.meta.height);
    const maximumHeight=width<=360?95:85;
    assert.ok(pendingLayout.row.height<=maximumHeight&&loadedLayout.row.height<=maximumHeight,'compact fixture first row stays within '+maximumHeight+'px at '+width+': '+pendingLayout.row.height+' / '+loadedLayout.row.height);
    assert.ok(Math.abs(pendingLayout.row.height-loadedLayout.row.height)<=2,'row footprint remains fixed through hydration at '+width+': '+pendingLayout.row.height+' / '+loadedLayout.row.height);
    const rowHeights=await run("[...document.querySelectorAll('[data-club-fixture-id]')].map(n=>n.getBoundingClientRect().height).sort((a,b)=>a-b)");
    assert.equal(rowHeights.length,30,'all club fixture rows render at '+width);
    assert.ok(rowHeights[14]<=(width<=360?95:85),'median of 30 club fixture rows stays compact at '+width+': '+rowHeights[14]);
    assert.ok(rowHeights.at(-1)<=130,'even the longest translated fixture row remains usable at '+width+': '+rowHeights.at(-1));
   }
   for(const [part,beforeSlot] of Object.entries(pendingLayout.parts)){
    const afterSlot=loadedLayout.parts[part];
    // Preserve the strict first-paint geometry check, even at 320px.
    assert.ok(Math.abs(beforeSlot.cy-afterSlot.cy)<=8,
     part+' vertical center matches loaded text at '+width+': '+beforeSlot.cy+' / '+afterSlot.cy);
    // Content can introduce a vertical scrollbar; tolerate its grid width change.
    const beforeX=beforeSlot.cx-pendingLayout.row.x,afterX=afterSlot.cx-loadedLayout.row.x;
    if(['venue','score','status'].includes(part))
     assert.ok(Math.abs(beforeX-afterX)<=20,part+' stays in its grid column at '+width);
    else if(part==='name'||part==='day')
     assert.ok(Math.abs(beforeSlot.x-pendingLayout.row.x-(afterSlot.x-loadedLayout.row.x))<=6,
      part+' text begins at reserved slot at '+width);
    else if(part==='league')
     assert.ok(Math.abs(beforeSlot.x-pendingLayout.row.x-(afterSlot.x-loadedLayout.row.x))<=(width<=620?20:3),
      'league text starts at reserved slot at '+width);
   }
  }
  console.log('CLUB-FIXTURES geometry PASS: pending/hydrated text slots at 320/375/390/430/768/1440; no Season selector skeleton.');
  await run("document.querySelector('[data-club-fixture-control=competition] button').click();document.querySelector('[data-menu-value=\"IT-1\"]').click()");await wait("location.search.includes('competition=IT-1')");
  assert.equal(await run("document.querySelector('[data-club-fixtures-next]').disabled"),false,'current season has a next-match action');
  assert.equal(await run("getComputedStyle(document.querySelector('[data-club-fixtures-next]')).opacity"),'1','enabled next-match control is not muted');
  await run("document.querySelector('[data-club-fixtures-next]').click()");await wait("document.activeElement.hasAttribute('data-club-fixture-next')");
  world={...world,revision:5,seasonNumber:2};
  await cmd('Page.navigate',{url:origin+'/clubs/it/1/fixtures?season=999'});
  await wait("location.search===''&&document.querySelectorAll('[data-club-fixture-id]').length===30");
  assert.deepEqual(await run("[...document.querySelectorAll('[data-club-fixture-control=season] [data-menu-value]')].map(n=>n.dataset.menuValue)"),['2','1'],'Season 2 offers exactly 2 and 1, like Standings');
  await run("document.querySelector('[data-club-fixture-control=season] button').click();document.querySelector('[data-club-fixture-control=season] [data-menu-value=\"1\"]').click()");
  await wait("location.search==='?season=1'&&document.querySelectorAll('[data-club-fixture-id]').length===30");
  assert.equal(await run("[...document.querySelectorAll('.club-fixture-result strong')].every(n=>n.textContent!=='—')"),true,'closed Season 1 has verified results');
  assert.equal(await run("document.querySelector('[data-club-fixtures-next]').disabled"),true,'historical season must disable next-match action');
  const mutedNext=await run("(()=>{const n=document.querySelector('[data-club-fixtures-next]'),s=getComputedStyle(n);return {opacity:s.opacity,cursor:s.cursor,pointerEvents:s.pointerEvents,background:s.backgroundColor,border:s.borderColor}})()");
  assert.equal(mutedNext.opacity,'0.45','historical next-match uses the Matchday muted opacity');
  assert.equal(mutedNext.cursor,'default','disabled next-match does not show a click cursor');
  assert.equal(mutedNext.pointerEvents,'none','disabled next-match has no hover/touch interaction');
  assert.ok(mutedNext.background&&mutedNext.border,'disabled control retains its button geometry');
  assert.equal(await run("document.querySelector('.club-fixture-row.is-next')"),null,'historical season must not highlight a next match');
  await run("document.querySelector('[data-club-fixtures-next]').click()");
  assert.equal(await run("document.querySelector('[data-club-fixture-next]')"),null,'disabled action must not select any match');
  await run('history.back()');await wait("location.search===''&&document.querySelectorAll('[data-club-fixture-id]').length===30");
  await run('history.forward()');await wait("location.search==='?season=1'&&document.querySelectorAll('[data-club-fixture-id]').length===30");
  await cmd('Page.navigate',{url:origin+'/clubs/it/1/fixtures'});await wait("location.search===''&&document.querySelectorAll('[data-club-fixture-id]').length===30");
  await cmd('Page.navigate',{url:origin+'/clubs/it/1/fixtures?season=0'});await wait("location.search===''&&document.querySelectorAll('[data-club-fixture-id]').length===30");
  await cmd('Page.reload');await wait("document.querySelectorAll('[data-club-fixture-id]').length===30");
  await run("document.querySelector('.club-tabs a[href$=\"/history\"]').click()");await wait("document.querySelector('.club-history [data-club-history-toggle]')");
  await run("document.querySelector('.club-history [data-club-history-toggle]').click()");
  assert.equal(await run("document.querySelector('.club-history [data-club-history-toggle]').getAttribute('aria-expanded')"),'true','public History stays interactive after Fixtures');
  await run("document.querySelector('.club-tabs a[href*=\"/fixtures\"]').click()");await wait("location.search===''&&document.querySelectorAll('[data-club-fixture-id]').length===30");
  failCompetition=true;await cmd('Page.reload');await wait("document.querySelector('.club-fixtures')?.dataset.clubFixturesState==='unavailable'");assert.equal(await run("document.querySelectorAll('[data-club-fixture-id]').length"),0);
  failCompetition=false;failHistory=true;await cmd('Page.reload');await wait("document.querySelectorAll('[data-club-fixture-id]').length===30");
  assert.equal(competitionReads,0,'History outage cannot trigger competition fan-out');
  failHistory=false;failFixtures=true;await cmd('Page.reload');await wait("document.querySelector('.club-fixtures')?.dataset.clubFixturesState==='error'");
  assert.equal(await run("document.querySelector('.club-fixtures-notice')"),null,'errors add no notice');
  failFixtures=false;world={...world,revision:0,seasonNumber:0,day:0,phase:'unstarted'};
  await cmd('Page.navigate',{url:origin+'/clubs/it/1/fixtures?season=0'});await wait("location.search===''&&document.querySelector('.club-fixtures')?.dataset.clubFixturesState==='unstarted'");
  assert.deepEqual(await run("[...document.querySelectorAll('[data-club-fixture-control=season] [data-menu-value]')].map(n=>n.dataset.menuValue)"),['1'],'world Season 0 still offers only viewed Season 1');
  assert.equal(await run("document.querySelector('[data-club-fixtures-next]').disabled"),true,'Season 0 disables next match');
  assert.deepEqual(await run('window.__errors'),[]);
  useDev=true;
  const devSetup=season=>"sessionStorage.setItem('football-architect:debug-enabled','on');sessionStorage.setItem('football-architect:standings-dev-preview','on');sessionStorage.setItem('football-architect:standings-dev-season','"+season+"');sessionStorage.setItem('football-architect:standings-dev-matchdays','4');sessionStorage.setItem('football-architect:calendar-dev-world-day','16');";
  let devBootstrap=await cmd('Page.addScriptToEvaluateOnNewDocument',{source:devSetup(1)});
  await visit();await wait("window.faWorldState?.get?.().source==='dev'&&document.querySelectorAll('[data-club-fixture-id]').length===30");
  assert.equal(await run("document.querySelector('.club-fixtures').dataset.clubFixturesSource"),'dev');
  // Bound the old feedback loop so the regression fails without hanging Chrome.
  await run("window.__fixtureRequests=0;window.__nativeDispatch=window.dispatchEvent.bind(window);window.dispatchEvent=e=>{if(e.type==='fa:club-fixtures-selection'&&++window.__fixtureRequests>8)return true;return window.__nativeDispatch(e)};document.querySelector('.club-tabs a[href$=\"/history\"]').click()");
  await delay(150);
  assert.equal(await run('window.__fixtureRequests<=1'),true,'History redraw must not request Fixtures repeatedly');
  await run("document.querySelector('.club-tabs a[href*=\"/fixtures\"]').click()");await wait("document.querySelectorAll('[data-club-fixture-id]').length===30");
  await cmd('Page.navigate',{url:origin+'/clubs/it/1/history'});await wait("document.documentElement.dataset.clubReady==='true'&&document.querySelector('.club-history [data-club-history-toggle]')");
  await run("document.querySelector('.club-history [data-club-history-toggle]').click()");
  assert.equal(await run("document.querySelector('.club-history [data-club-history-toggle]').getAttribute('aria-expanded')"),'true','cold History remains interactive');
  await run("document.querySelector('.club-tabs a[href*=\"/fixtures\"]').click()");await wait("document.querySelectorAll('[data-club-fixture-id]').length===30");
  await cmd('Page.removeScriptToEvaluateOnNewDocument',{identifier:devBootstrap.identifier});
  devBootstrap=await cmd('Page.addScriptToEvaluateOnNewDocument',{source:devSetup(2)});
  await cmd('Page.navigate',{url:origin+'/clubs/it/1/fixtures?season=999'});
  await wait("location.search===''&&document.querySelectorAll('[data-club-fixture-id]').length===30&&window.faWorldState.get().source==='dev'");
  assert.deepEqual(await run("[...document.querySelectorAll('[data-club-fixture-control=season] [data-menu-value]')].map(n=>n.dataset.menuValue)"),['2','1'],'DEV shares positive season policy');
  await run("document.querySelector('[data-club-fixture-control=season] button').click();document.querySelector('[data-club-fixture-control=season] [data-menu-value=\"1\"]').click()");
  await wait("location.search==='?season=1'&&document.querySelectorAll('[data-club-fixture-id]').length>=30");
  assert.equal(await run("[...document.querySelectorAll('.club-fixture-result strong')].every(n=>n.textContent!=='—')"),true,'DEV historical season uses its own completed progress');
  await cmd('Page.removeScriptToEvaluateOnNewDocument',{identifier:devBootstrap.identifier});
  devBootstrap=await cmd('Page.addScriptToEvaluateOnNewDocument',{source:devSetup(0)});
  await cmd('Page.navigate',{url:origin+'/clubs/it/1/fixtures?season=2'});
  await wait("location.search===''&&document.querySelector('.club-fixtures')?.dataset.clubFixturesState==='unstarted'&&window.faWorldState.get().current?.season===0");
  assert.deepEqual(await run("[...document.querySelectorAll('[data-club-fixture-control=season] [data-menu-value]')].map(n=>n.dataset.menuValue)"),['1'],'DEV Reset to 0 clamps viewed season to 1');
  await run("window.faDebugEnabled=false;sessionStorage.setItem('football-architect:debug-enabled','off');window.faWorldState.setSource({kind:'authoritative'});window.dispatchEvent(new Event('fa:source-change'))");
  await wait("document.querySelectorAll('[data-club-fixture-id]').length===0&&document.querySelector('.club-fixtures')?.dataset.clubFixturesSource==='authoritative'");
  assert.deepEqual(await run('window.__errors'),[]);
  console.log('CLUB-FIXTURES Chromium PASS: canonical API, late response/tab fence, 30 club-only rows, no future scores, stable controls, focus tooltip, five locales/themes at 320/390/768/1440, season/filter/next, canonical Season 0/1/2 URL normalization, refresh/Back/Forward, no notices, 14px toolbar alignment and nonblocking History. Physical Safari remains UNKNOWN.');
 }finally{socket?.close();proc.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true,maxRetries:8,retryDelay:100});}
});
