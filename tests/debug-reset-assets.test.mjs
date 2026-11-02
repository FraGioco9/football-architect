import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {once} from 'node:events';
import {request} from 'node:http';
import {createPreviewServer} from '../tools/dev-standings-preview.mjs';
import {clearDebugSettings} from '../tools/dev-debug-widget.mjs';

test('reset clears Debug overrides and unchecks Enable without touching user preferences',()=>{
 const values=new Map([['football-architect:local-debug-visible','1'],['football-architect:standings-dev-season','3'],['football-architect:standings-dev-matchdays','20'],['football-architect:calendar-dev-world-day','40'],['football-architect:standings-dev-preview','on'],['football-architect:theme','dark']]);
 const storage={removeItem:key=>values.delete(key)};
 const source=readFileSync(new URL('../tools/dev-debug-widget.mjs',import.meta.url),'utf8');
 const start=source.indexOf(' root.resetAllSettings=()=>{'),end=source.indexOf(' closeButton.addEventListener',start);
 const events=[],enabledSwitch={checked:true},root={resetWidgetState(){},syncVisibility(){}};
 runInNewContext(source.slice(start,end)+';root.resetAllSettings();',{root,clearDebugSettings,sessionStorage:storage,enabledSwitch,applyEnabled(){},document:{documentElement:{dataset:{}}},window:{dispatchEvent:e=>events.push([e.type,e.detail])},CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts?.detail}},controls:[],panel:{}});
 assert.equal(enabledSwitch.checked,false);assert.deepEqual([...values],[['football-architect:theme','dark']]);
 assert.deepEqual(events.map(e=>e[0]),['fa:debug-reset','fa:debug-mode-change']);assert.equal(events[1][1].enabled,false);
});
test('logo responses are reusable across pages while HTML stays uncached',async()=>{
 const server=createPreviewServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 const url='http://127.0.0.1:'+server.address().port;
 const get=(path,headers)=>new Promise((resolve,reject)=>{const req=request(url+path,{headers},res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode,headers:new Headers(res.headers),arrayBuffer:async()=>null,text:async()=>''}))});req.on('error',reject);req.end()});
 try{
  const headers={Host:'127.0.0.1:2000'};
  const image=await get('/assets/clubs/IT/1/crest.svg',headers);
  assert.equal(image.status,200);assert.match(image.headers.get('cache-control'),/max-age=[1-9]/);
  const etag=image.headers.get('etag');assert.ok(etag);await image.arrayBuffer();
  const cached=await get('/assets/clubs/IT/1/crest.svg',{...headers,'If-None-Match':etag});assert.equal(cached.status,304);
  const page=await get('/dashboard',headers);assert.equal(page.headers.get('cache-control'),'no-store');await page.text();
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('standings updates move existing crest hosts into the replacement rows',()=>{
 const source=readFileSync(new URL('../assets/competition-page.js',import.meta.url),'utf8');
 const start=source.indexOf('  function reuseCrestHosts('),end=source.indexOf('  // Presentation only:',start);
 const original={dataset:{clubCrest:'IT-1'},image:{loaded:true}},next={dataset:{clubCrest:'IT-1'},replaceWith(node){this.reused=node}};
 runInNewContext(source.slice(start,end)+';reuseCrestHosts(current,replacements);',{current:{querySelectorAll:()=>[original]},replacements:[{querySelectorAll:()=>[next]}]});
 assert.equal(next.reused,original);assert.equal(next.reused.image.loaded,true);
});

test('Reset invalidates a pending Day change before it can recreate an override',async()=>{
 const source=readFileSync(new URL('../tools/dev-standings-preview-client.mjs',import.meta.url),'utf8');
 const start=source.indexOf('onChange:async n=>{if(debugSeason===0'),end=source.indexOf('\n  },{type:',start);
 let release;const pending=new Promise(resolve=>release=resolve),writes=[];
 const context={debugSeason:1,matchdays:0,progressRevision:0,debugMode:()=>true,matchdaysForWorldDay:()=>8,setMatchdays:()=>pending,devWorldClock:{setDay:n=>writes.push(n)},syncDebugControls(){}};
 const change=runInNewContext('('+source.slice(start,end).replace('onChange:','')+')',context);
 const result=change(20);context.progressRevision++;release(true);
 assert.equal(await result,false);assert.deepEqual(writes,[]);
});
