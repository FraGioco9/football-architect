// G10-PUBLIC-02: actual staged Debug bytes served from loopback only, never Vercel.
import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {spawn,spawnSync} from "node:child_process";
import {mkdtempSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,extname} from "node:path";
import {setTimeout as delay} from "node:timers/promises";
import {stageProtectedDebugArtifact} from "../tools/dev-preview-artifact.mjs";
import {createPreviewStandings,createPreviewPostseason} from "../tools/dev-standings-preview-data.mjs";
import {aggregatePreviewStats} from "../tools/dev-competition-stats-data.mjs";
import {repositoryRoot,publicRequestFile} from "../tools/publication-guard.mjs";

const mime={".html":"text/html",".mjs":"text/javascript",".js":"text/javascript",
 ".css":"text/css",".json":"application/json",".svg":"image/svg+xml",
 ".png":"image/png",".webp":"image/webp",".ico":"image/x-icon"};
const chrome=()=>{
 const windows=process.platform==="win32"?[
  process.env.ProgramFiles&&join(process.env.ProgramFiles,"Google","Chrome","Application","chrome.exe"),
  process.env["PROGRAMFILES(X86)"]&&join(process.env["PROGRAMFILES(X86)"],"Google","Chrome","Application","chrome.exe"),
  process.env.LOCALAPPDATA&&join(process.env.LOCALAPPDATA,"Google","Chrome","Application","chrome.exe")]:[];
 for(const bin of [process.env.CHROME_BIN,...windows,"google-chrome","google-chrome-stable","chromium","chromium-browser"].filter(Boolean))
  if(spawnSync(bin,["--version"],{timeout:4000,stdio:"ignore"}).status===0)return bin;
 throw Error("Chrome required for isolated G10-PUBLIC-02 browser audit");
};
const stopServer=server=>new Promise(resolve=>server.close(resolve));

test("G10-PUBLIC-02 browser: Debug controls operate without outgoing mutations",{timeout:120000},async()=>{
 const binary=chrome();
 const temp=mkdtempSync(join(tmpdir(),"fa-g10-browser-"));
 const artifact=join(temp,"artifact");
 const allow=new Set(stageProtectedDebugArtifact(repositoryRoot,artifact));
 const refused=[];
 const server=createServer((req,res)=>{
  try{
   if(!["GET","HEAD"].includes(req.method))throw Error("non-read method");
   const pathname=new URL(req.url,"http://127.0.0.1").pathname;
   if(pathname.includes("%")||pathname.includes("\\")||pathname.includes("\0"))throw Error("encoded path");
   const route=pathname;
   const file=publicRequestFile(route);
   if(!allow.has(file))throw Error("path not in artifact");
   const type=mime[extname(file)];
   if(!type)throw Error("mime not allowed");
   res.writeHead(200,{"Content-Type":type,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});
   res.end(req.method==="HEAD"?undefined:readFileSync(join(artifact,file)));
  }catch(error){
   refused.push({path:(req.url||"").split("?")[0],method:req.method});
   res.writeHead(404);res.end();
  }
 });
 let proc,socket,chromeClosed;
 try{
  await new Promise((ok,fail)=>{server.once("error",fail);server.listen(0,"127.0.0.1",ok)});
  const origin="http://127.0.0.1:"+server.address().port;
  proc=spawn(binary,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
   "--no-proxy-server","--disable-background-networking","--disable-extensions","--disable-sync",
   "--no-first-run","--no-default-browser-check","--remote-debugging-port=0",
   "--user-data-dir="+join(temp,"chrome"),"about:blank"],{stdio:["ignore","ignore","pipe"]});
  chromeClosed=new Promise(resolve=>proc.once("close",resolve));
  let stderr="";proc.stderr.on("data",x=>stderr+=x.toString());
  let endpoint;
  for(let i=0;i<150&&!endpoint;i++){
   endpoint=stderr.match(/DevTools listening on (ws:\/\/\S+)/)?.[1];
   if(proc.exitCode!==null)throw Error("Chrome exited before CDP startup");
   if(!endpoint)await delay(100);
  }
  assert.ok(endpoint,"Chrome DevTools socket should start");
  const host=new URL(endpoint).host;
  let tab;
  for(let i=0;i<50&&!tab;i++){
   try{tab=(await (await fetch("http://"+host+"/json/list")).json()).find(x=>x.type==="page")}catch{}
   if(!tab)await delay(100);
  }
  assert.ok(tab?.webSocketDebuggerUrl);
  socket=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((ok,fail)=>{socket.addEventListener("open",ok,{once:true});socket.addEventListener("error",fail,{once:true})});
  const pending=new Map(),requests=[],sockets=[],streams=[],errors=[];let seq=0;
  socket.addEventListener("message",event=>{
   const m=JSON.parse(event.data);
   // Keep errors in the Node process: page globals are discarded on navigation.
   if(m.method==="Runtime.exceptionThrown")
    errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
   if(m.method==="Runtime.consoleAPICalled"&&m.params.type==="error")
    errors.push(m.params.args.map(arg=>arg.value??arg.description??arg.type).join(" "));
   if(m.method==="Network.requestWillBeSent"&&m.params?.request)
    requests.push({method:m.params.request.method,url:m.params.request.url});
   if(m.method==="Network.webSocketCreated"||m.method==="Network.webTransportCreated")
    sockets.push({kind:m.method,url:m.params?.url||""});
   if(m.method==="Network.eventSourceMessageReceived")
    streams.push(m.params?.requestId||"unknown");
   const p=pending.get(m.id);
   if(!p)return;
   clearTimeout(p.timer);pending.delete(m.id);
   m.error?p.fail(Error(m.error.message)):p.ok(m.result);
  });
  const cmd=(method,params={})=>new Promise((ok,fail)=>{
   const id=++seq,timer=setTimeout(()=>{pending.delete(id);fail(Error("CDP timeout: "+method))},15000);
   pending.set(id,{ok,fail,timer});
   socket.send(JSON.stringify({id,method,params}));
  });
  const run=async expression=>{
   const result=await cmd("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
   if(result.exceptionDetails)throw Error(result.exceptionDetails.text);
   return result.result.value;
  };
  const until=async expression=>{
   for(let i=0;i<100;i++){
    if(await run(expression))return;
    await delay(100);
   }
   throw Error("Browser state timeout: "+expression);
  };
  await cmd("Page.enable");
  await cmd("Network.enable");
  await cmd("Runtime.enable");
  // Headless CDP can update activeElement without dispatching focus while the
  // document's window is inactive. Keyboard assertions need an active document.
  await cmd("Emulation.setFocusEmulationEnabled",{enabled:true});
  // CAL-AUDIT: the public-intended DEV widget now exposes only global Season and Day.
  await cmd("Page.navigate",{url:origin+"/competitions/it-1?season=1&view=standings"});
  await until("document.readyState==='complete'&&!!document.querySelector('.fa-dev-widget-button')&&document.querySelectorAll('#app-standings-body tr').length===16");
  await run("document.querySelector('.fa-dev-widget-button').click()");
  await until("!!document.querySelector('[data-dev-control=season]')&&!!document.querySelector('[data-dev-control=world-day]')");
  assert.equal(await run("document.querySelector('[data-dev-control=season]').value"),"1");
  assert.equal(await run("document.querySelector('[data-dev-control=world-day]').value"),"1");
  assert.equal(await run("document.querySelector('[data-dev-control=world-day]').max"),"56");
  assert.equal(await run("document.querySelector('[data-dev-control=matchdays]')"),null);
  assert.equal(await run("document.querySelectorAll('.fa-dev-widget-section').length"),1);
  await run("(()=>{const input=document.querySelector('[data-dev-control=world-day]');input.value='26';input.dispatchEvent(new Event('change',{bubbles:true}))})()");
  await until("sessionStorage.getItem('football-architect:calendar-dev-world-day')==='26'&&document.querySelector('[data-dev-control=world-day]').value==='26'");
  assert.equal(await run("document.querySelectorAll('#app-standings-body tr').length"),16);
  await run("document.querySelector('[data-dev-control=reset-global]').click()");
  await until("sessionStorage.getItem('football-architect:calendar-dev-world-day')===null&&document.querySelector('[data-dev-control=world-day]').value==='1'");
  assert.equal(await run("document.querySelector('[data-dev-control=season]').value"),"0");
  await cmd("Page.navigate",{url:origin+"/calendar?season=1&calendarView=week"});
  await until("document.readyState==='complete'&&document.documentElement.dataset.calendarReady==='true'");
  assert.equal(await run("document.querySelectorAll('.calendar-day[data-calendar-day]').length"),56);
  assert.equal(await run("document.querySelector('#calendar-week-trigger').getAttribute('role')"),"combobox");
  assert.equal(await run("new URL(location.href).searchParams.has('day')"),false);
  const status=await run("({scriptCount:performance.getEntriesByType('resource').filter(x=>x.name.includes('/__fa_dev__/')).length})");
  assert.ok(status.scriptCount>=5,"Debug module assets should load on the second division");
  assert.deepEqual(errors,[],"Browser errors across every document and navigation");
  assert.deepEqual(refused,[],"No missing/unapproved artifact requests");
  assert.deepEqual(sockets,[],"No WebSocket or WebTransport connections");
  assert.deepEqual(streams,[],"No EventSource messages");
  assert.ok(requests.length>0,"CDP should observe browser network traffic");
  for(const req of requests){
   if(/^https?:/.test(req.url)){
    assert.equal(new URL(req.url).origin,origin,"No third-party traffic");
    assert.equal(req.method,"GET","No browser network writes");
   }else{
    assert.ok(req.url.startsWith("data:")||req.url==="about:blank","Unexpected request scheme");
   }
  }
 }finally{
  try{socket?.close()}catch{}
  if(proc){
   // Await process/pipe closure instead of racing profile writes with a fixed delay.
   const forceKill=setTimeout(()=>proc.kill("SIGKILL"),5000);
   try{proc.kill();await chromeClosed}finally{clearTimeout(forceKill)}
  }
  if(server.listening)await stopServer(server);
  rmSync(temp,{recursive:true,force:true,maxRetries:5,retryDelay:100});
 }
});
