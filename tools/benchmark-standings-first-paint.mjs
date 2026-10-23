// Read-only RENDER-01 Chromium benchmark: two local directories, no external deployment.
import {createServer} from "node:http";
import {readFile,writeFile,mkdtemp,rm} from "node:fs/promises";
import {spawn} from "node:child_process";
import {tmpdir} from "node:os";
import {join,resolve,extname,sep} from "node:path";
import {once} from "node:events";
import {setTimeout as delay} from "node:timers/promises";
const [baseDir,prDir,output]=process.argv.slice(2);
if(!baseDir||!prDir||!output||!process.env.CHROME_BIN)throw Error("Missing directories, output or CHROME_BIN");
const mimes={html:"text/html",js:"text/javascript",json:"application/json",css:"text/css",svg:"image/svg+xml"};
async function serve(dir){
 const root=resolve(dir);
 const server=createServer(async(req,res)=>{
  try{
   let p=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
   if(/^\/competitions\/[a-z0-9-]+\/standings\/?$/.test(p))p=p.replace(/\/standings\/?$/,"/index.html");
   else if(p.endsWith("/"))p+="index.html";
   else if(!extname(p))p+="/index.html";
   const file=resolve(root,"."+p);
   if(!file.startsWith(root+sep))throw Error("outside checkout");
   const bytes=await readFile(file);
   res.writeHead(200,{"content-type":mimes[extname(file).slice(1)]||"application/octet-stream","cache-control":"public, max-age=3600"});res.end(bytes);
  }catch(error){res.writeHead(404);res.end(String(error.message))}
 });
 server.listen(0,"127.0.0.1");await once(server,"listening");
 return {server,origin:"http://127.0.0.1:"+server.address().port};
}
const servers=[await serve(baseDir),await serve(prDir)];
const dir=await mkdtemp(join(tmpdir(),"fa-perf-"));
const proc=spawn(process.env.CHROME_BIN,["--headless=new","--no-sandbox","--disable-dev-shm-usage","--disable-gpu","--no-first-run","--no-proxy-server","--remote-debugging-port=0","--user-data-dir="+dir,"about:blank"],{stdio:["ignore","ignore","pipe"]});
let stderr="",ws;
proc.stderr.on("data",v=>stderr+=v.toString());
const report={schemaVersion:1,baseline:process.env.BASELINE_SHA,candidate:process.env.CANDIDATE_SHA,method:"Chromium CDP Performance paint entries; DOM row timestamps via early MutationObserver; 5 samples per cache/viewport/revision",samples:[],summary:[]};
try{
 let endpoint;
 for(let n=0;n<150&&!endpoint;n++){endpoint=stderr.match(/DevTools listening on (ws:\/\/\S+)/)?.[1];if(proc.exitCode!==null)throw Error(stderr);if(!endpoint)await delay(100)}
 if(!endpoint)throw Error("CDP unavailable: "+stderr.slice(-500));
 const host=new URL(endpoint).host;
 let page;
 for(let n=0;n<40&&!page;n++){try{page=(await(await fetch("http://"+host+"/json/list")).json()).find(x=>x.type==="page")}catch{}if(!page)await delay(100)}
 if(!page)throw Error("Chrome page unavailable");
 ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((ok,fail)=>{ws.addEventListener("open",ok,{once:true});ws.addEventListener("error",fail,{once:true})});
 let serial=0;const waiting=new Map();
 ws.addEventListener("message",e=>{const v=JSON.parse(e.data),p=waiting.get(v.id);if(!p)return;clearTimeout(p.timer);waiting.delete(v.id);v.error?p.fail(Error(v.error.message)):p.ok(v.result)});
 const cmd=(method,params={})=>new Promise((ok,fail)=>{const id=++serial,timer=setTimeout(()=>{waiting.delete(id);fail(Error("CDP timeout: "+method))},30000);waiting.set(id,{ok,fail,timer});ws.send(JSON.stringify({id,method,params}))});
 const evaluate=async expression=>{const r=await cmd("Runtime.evaluate",{expression,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value};
 await cmd("Page.enable");await cmd("Runtime.enable");await cmd("Network.enable");
 const preload='(()=>{window.__faPerf={first:null,complete:null,mobile:null};const watch=()=>{const p=window.__faPerf,n=document.querySelectorAll("#app-standings-body tr[data-world-club]").length,m=document.querySelectorAll("#app-standings-compact-list li").length;if(n&&!p.first)p.first=performance.now();if(n===16&&!p.complete)p.complete=performance.now();if(m===16&&!p.mobile)p.mobile=performance.now()};const obs=new MutationObserver(watch);document.addEventListener("DOMContentLoaded",()=>{obs.observe(document.body,{childList:true,subtree:true});watch()},{once:true})})()';
 await cmd("Page.addScriptToEvaluateOnNewDocument",{source:preload});
 for(const [viewport,width,height,mobile] of [["desktop",1440,900,false],["mobile390",390,844,true],["mobile320",320,700,true]]){
  await cmd("Emulation.setDeviceMetricsOverride",{width,height,screenWidth:width,screenHeight:height,deviceScaleFactor:1,mobile});
  for(const [revision,site] of [["baseline",servers[0]],["candidate",servers[1]]]){
   for(let i=1;i<=5;i++)for(const cache of ["cold","warm"]){
    if(cache==="cold")await cmd("Network.clearBrowserCache");
    await cmd("Page.navigate",{url:site.origin+"/competitions/de-1/standings"});
    let value;
    for(let attempt=0;attempt<180;attempt++){
     value=await evaluate('(()=>({ready:document.readyState,count:document.querySelectorAll("#app-standings-body tr[data-world-club]").length,mobileCount:document.querySelectorAll("#app-standings-compact-list li").length,perf:window.__faPerf,paint:performance.getEntriesByType("paint").find(x=>x.name==="first-contentful-paint")?.startTime??null}))()');
     if(value?.ready==="complete"&&value.count===16&&value.mobileCount===16&&value.paint!==null)break;
     await delay(100);
    }
    if(value?.ready!=="complete"||value.count!==16||value.mobileCount!==16||value.paint===null||!value.perf?.complete||!value.perf?.mobile)throw Error("Incomplete render: "+JSON.stringify({viewport,revision,cache,value}));
    const sample={viewport,revision,cache,iteration:i,fcpMs:value.paint,firstRowMs:value.perf.first,allRowsMs:value.perf.complete,mobileRowsMs:value.perf.mobile};
    report.samples.push(sample);console.log("FA_PERF "+JSON.stringify(sample));
   }
  }
 }
 const median=values=>{const a=[...values].sort((x,y)=>x-y);return a[2]};
 for(const viewport of ["desktop","mobile390","mobile320"])for(const cache of ["cold","warm"])for(const revision of ["baseline","candidate"]){
  const xs=report.samples.filter(x=>x.viewport===viewport&&x.cache===cache&&x.revision===revision);
  report.summary.push({viewport,cache,revision,n:xs.length,fcpMedianMs:median(xs.map(x=>x.fcpMs)),allRowsMedianMs:median(xs.map(x=>x.allRowsMs)),mobileRowsMedianMs:median(xs.map(x=>x.mobileRowsMs))});
 }
 console.log("FA_PERF_SUMMARY "+JSON.stringify(report.summary));
}finally{
 ws?.close();proc.kill();for(const x of servers)await new Promise(done=>x.server.close(done));await rm(dir,{recursive:true,force:true});await writeFile(output,JSON.stringify(report,null,2)+"\n");
}
