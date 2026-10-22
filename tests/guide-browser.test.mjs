// GUIDE-02 FINAL-QA-02: genuine Chromium checks against staged, fail-closed public files.
import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {spawn,spawnSync} from "node:child_process";
import {mkdtempSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,extname} from "node:path";
import {once} from "node:events";
import {setTimeout as delay} from "node:timers/promises";
import {repositoryRoot,stagePublicArtifact,publicRequestFile} from "../tools/publication-guard.mjs";
const chapters=["","world","divisions","clubs","movement","calendar","cups","records","explore"];
const languages=["en","de","es","fr","it"];
const mime={".html":"text/html",".css":"text/css",".js":"text/javascript",".svg":"image/svg+xml",".png":"image/png",".ico":"image/x-icon",".json":"application/json"};
const binary=()=>{for(const x of [process.env.CHROME_BIN,"google-chrome","chromium","chromium-browser"].filter(Boolean))if(spawnSync(x,["--version"],{stdio:"ignore",timeout:4000}).status===0)return x;throw Error("Chromium required for GUIDE-02 visual QA");};
test("GUIDE-02 Chromium: 9 pages x 1440/390/320 x dark/light x 5 languages, routes, assets and accessibility",{timeout:240000},async()=>{
 const chrome=binary(),dir=mkdtempSync(join(tmpdir(),"fa-guide-browser-")),allowed=new Set(stagePublicArtifact(repositoryRoot,join(dir,"public"))),errors=[];
 const server=createServer((req,res)=>{try{const name=publicRequestFile(new URL(req.url,"http://127.0.0.1").pathname);if(!allowed.has(name))throw Error("not allowlisted");res.writeHead(200,{"Content-Type":mime[extname(name)]||"application/octet-stream"});res.end(readFileSync(join(dir,"public",name)));}catch{res.writeHead(404);res.end("Not found");}});
 server.listen(0,"127.0.0.1");await once(server,"listening");
 const origin="http://127.0.0.1:"+server.address().port;
 const proc=spawn(chrome,["--headless=new","--no-sandbox","--disable-dev-shm-usage","--disable-background-networking","--no-first-run","--no-default-browser-check","--remote-debugging-port=0","--user-data-dir="+join(dir,"profile"),"about:blank"],{stdio:["ignore","ignore","pipe"]});
 let stderr="";proc.stderr.on("data",d=>stderr+=d.toString());let ws,seq=0;const pending=new Map();
 try{
  let endpoint;for(let i=0;i<100&&!endpoint;i++){endpoint=stderr.match(/DevTools listening on (ws:\/\/\S+)/)?.[1];if(!endpoint)await delay(100);}assert.ok(endpoint,stderr.slice(-500));
  let tab;for(let i=0;i<50&&!tab;i++){try{tab=(await (await fetch("http://"+new URL(endpoint).host+"/json/list")).json()).find(t=>t.type==="page");}catch{}if(!tab)await delay(100);}assert.ok(tab);
  ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((ok,fail)=>{ws.addEventListener("open",ok,{once:true});ws.addEventListener("error",fail,{once:true});});
  ws.addEventListener("message",e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.fail(Error(m.error.message)):p.ok(m.result);});
  const cmd=(method,params={})=>new Promise((ok,fail)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);fail(Error("CDP timeout "+method));},12000);pending.set(id,{ok,fail,timer});ws.send(JSON.stringify({id,method,params}));});
  const run=async expression=>{const result=await cmd("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.text);return result.result.value;};
  await cmd("Page.enable");await cmd("Runtime.enable");
  await cmd("Page.addScriptToEvaluateOnNewDocument",{source:"try{localStorage.setItem('football-architect:language','en')}catch{}"});
  for(const [width,height] of [[1440,900],[390,844],[320,700]]){
   await cmd("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:width<700});
   for(const mode of ["dark","light"]){
    // The site initializes its theme from this shared preference.
    for(const chapter of chapters){
     const route="/guide"+(chapter?"/"+chapter:"");
     await cmd("Page.navigate",{url:origin+route});
     for(let i=0;i<50;i++){if(await run("document.readyState==='complete'"))break;await delay(50);}
     await run("localStorage.setItem('football-architect:theme',"+JSON.stringify(mode)+")");
     await cmd("Page.reload",{ignoreCache:true});
     let ready=false;for(let i=0;i<75;i++){ready=await run("document.readyState==='complete'&&!!document.querySelector('main h1')");if(ready)break;await delay(60);}assert.ok(ready,route+" did not load");
     for(const lang of languages){
      const state=await run(`(()=>{const lang=${JSON.stringify(lang)};const trigger=document.querySelector('#site-language');if(trigger){trigger.click();document.querySelector('[data-language="'+lang+'"]')?.click();}const images=[...document.images];const links=[...document.querySelectorAll('a[href]')];const focus=[...document.querySelectorAll('a,button,[role="option"]')];return {lang:document.documentElement.lang,title:document.querySelector('main h1')?.textContent?.trim(),theme:document.documentElement.getAttribute("data-theme"),overflow:document.documentElement.scrollWidth-innerWidth,broken:images.filter(x=>!x.complete||x.naturalWidth===0).map(x=>x.src),links:links.filter(x=>x.getAttribute('href')==='#'||x.getAttribute('href')?.includes('undefined')).map(x=>x.href),missingNames:focus.filter(x=>!((x.getAttribute('aria-label')||x.textContent||'').trim())&&!x.querySelector('img[alt]')).length,sections:document.querySelectorAll('.guide-section').length}})()`);
      assert.equal(state.lang,lang,route+" language "+lang);assert.equal(state.theme,mode,route+" theme "+mode);
      assert.ok(state.title&&!/undefined/i.test(state.title),route+" title");
      assert.ok(state.overflow<=1,route+" horizontal overflow "+width+" "+mode+" "+lang+": "+state.overflow);
      assert.deepEqual(state.broken,[],route+" broken image");
      assert.deepEqual(state.links,[],route+" invalid link");
      assert.equal(state.missingNames,0,route+" accessible names");
     }
     const shot=await cmd("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});const png=Buffer.from(shot.data,"base64");assert.equal(png.readUInt32BE(16),width);assert.ok(png.length>1200);
    }
   }
  }
  console.log("GUIDE-02 CHROMIUM PASS: 270 language/viewport/theme/page checks; 54 screenshots; staged artifact only");
 }finally{ws?.close();proc.kill();await new Promise(ok=>server.close(ok));rmSync(dir,{recursive:true,force:true});}
});
