// #657 — real browser request inventory, static first paint and refresh.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';

const origin='http://app.localhost:2000';
const compact='/competitions/_shared/compact.json';
const old='/competitions/_shared/manifest.json';
const routes=[
 {url:'/competitions/it-1/standings?season=1',id:'IT-1',view:'standings'},
 {url:'/competitions/it-1/fixtures?season=1&matchday=12',id:'IT-1',view:'fixtures'},
 {url:'/competitions/int-1/postseason?season=1',id:'int-1',view:'postseason'}
];
function summary(requests){
 const counts={};
 for(const r of requests.filter(x=>x.path.startsWith('/api/'))){
  const key=r.path+r.query;counts[key]=(counts[key]||0)+1;
 }
 return {requestCount:requests.length,
  compactRequests:requests.filter(x=>x.path===compact).length,
  obsoleteManifestRequests:requests.filter(x=>x.path===old).length,
  apiRequests:Object.values(counts).reduce((a,b)=>a+b,0),
  apiByEndpoint:counts,
  duplicateApiReads:Object.fromEntries(Object.entries(counts).filter(([,n])=>n>1)),
  requests};
}
// Global 'networkidle' times out on unresolved /api/world in this loopback
// fixture. Catalogue reads must finish; public API requests are inventoried
// at request start but are not a prerequisite for static first-paint QA.
// Keep a quiet observation window to catch late request starts.
export function createAuditedRequestSettler(page,{
 now=()=>performance.now(),
 pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
 quietMs=250,
 timeoutMs=6000
}={}){
 const pending=new Map();
 let lastActivity=now();
 page.on('request',request=>{
  const url=new URL(request.url());
  if(url.origin!==origin)return;
  const catalogue=url.pathname===compact||url.pathname===old;
  if(!catalogue&&!url.pathname.startsWith('/api/'))return;
  if(catalogue)pending.set(request,request.url());
  // Public-world and competition API reads may intentionally remain pending
  // on the standalone preview. Record their starts, not their completion.
  lastActivity=now();
 });
 const completed=request=>{
  if(pending.delete(request))lastActivity=now();
 };
 page.on('requestfinished',completed);
 page.on('requestfailed',completed);
 return {
  async settle(label){
   const deadline=now()+timeoutMs;
   while(now()<deadline){
    if(pending.size===0&&now()-lastActivity>=quietMs)return;
    await pause(Math.min(25,Math.max(1,deadline-now())));
   }
   throw Error('PERF-API-657 catalogue requests did not settle: '+label+
    ' '+JSON.stringify([...pending.values()]));
  }
 };
}

export async function verifyCompetitionCompactNetwork(browser,{engine='chromium'}={}){
 const report={name:'PERF-API-657',engine,origin,scope:'isolated loopback browser; no DB mutations',runs:[]};
 let checks=0;
 try{
  for(const spec of routes){
   const context=await browser.newContext({viewport:{width:390,height:844},
    reducedMotion:'reduce',serviceWorkers:'block'});
   const page=await context.newPage();
   const auditRequests=createAuditedRequestSettler(page);
   let phase='direct';
   const collected={direct:[],refresh:[],season:[]},errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',req=>{
    const url=new URL(req.url());if(url.origin!==origin)return;
    collected[phase].push({path:url.pathname,query:url.search,
      method:req.method(),type:req.resourceType()});
   });
   try{
    for(const mode of ['direct','refresh']){
     phase=mode;
     let release;
     const gate=new Promise(resolve=>release=resolve);
     const hold=async route=>{await gate;
      try{await route.continue()}catch(e){
       if(!page.isClosed()&&!/Route is already handled|Target closed/i.test(String(e)))throw e;
      }};
     await page.route('**'+compact,hold);
     try{
      const response=mode==='direct'
       ?await page.goto(origin+spec.url,{waitUntil:'domcontentloaded'})
       :await page.reload({waitUntil:'domcontentloaded'});
      assert.equal(response?.status(),200,'document '+mode+' '+spec.url);
      // DOMContentLoaded is earlier than the browser's first painted frame,
      // especially when CSS was restored from the browser cache on reload.
      // Observe the actual next frame while the catalogue request is held.
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
      const pending=await page.evaluate(view=>{
       const visible=n=>{
        if(!n||n.getClientRects().length===0)return false;
        for(let el=n;el;el=el.parentElement){
         const style=getComputedStyle(el);
         if(style.display==='none'||style.visibility==='hidden'||style.opacity==='0')return false;
        }
        return true;
       };
       return {
        shell:visible(document.querySelector('.fa-shell-content-scroll')),
        header:visible(document.querySelector('.app-competition-header')),
        tabs:visible(document.querySelector('.app-competition-tabs')),
        panel:visible(document.getElementById('competition-panel-'+view)),
        selected:document.getElementById('competition-tab-'+view)?.getAttribute('aria-selected'),
        hydrated:!!window.faCompetitionContext,
        empty:view==='fixtures'&&visible(document.getElementById('app-fixtures-empty'))
       };
      },spec.view);
      if(!pending.header){
       const details=await page.evaluate(()=>{
        const el=document.querySelector('.app-competition-header');
        const ancestry=[];for(let current=el;current;current=current.parentElement){
         const style=getComputedStyle(current);
         ancestry.push({tag:current.tagName,id:current.id,className:typeof current.className==='string'?current.className:null,
          inline:current.getAttribute('style'),hidden:current.hidden,
          display:style.display,visibility:style.visibility,opacity:style.opacity,
          rects:current.getClientRects().length});
        }
        const visibilityRules=[];
        for(const sheet of document.styleSheets){
         let rules;try{rules=sheet.cssRules}catch{continue}
         for(const rule of rules||[]){
          if(!rule.selectorText||!rule.style?.visibility)continue;
          const targets=ancestry.map(x=>x.id).filter(Boolean);
          try{
           const matching=el?.matches(rule.selectorText)||
            [...document.querySelectorAll(rule.selectorText)].some(n=>n.contains(el));
           if(matching)visibilityRules.push({selector:rule.selectorText,value:rule.style.visibility,
            stylesheet:sheet.href||'inline'});
          }catch{}
         }
        }
        return {exists:!!el,hidden:el?.hidden,display:el?getComputedStyle(el).display:null,
         visibility:el?getComputedStyle(el).visibility:null,rects:el?.getClientRects().length,
         ancestry,visibilityRules,
         attrs:[...document.documentElement.attributes].filter(x=>x.name.startsWith('data-'))
          .map(x=>[x.name,x.value])};
       });
       console.log('PERF-API-657 delayed header diagnostic '+JSON.stringify({mode,route:spec.url,details}));
      }
      assert.deepEqual(pending,
       {shell:true,header:true,tabs:true,panel:true,selected:'true',hydrated:false,empty:false},
       'stable first paint while compact catalogue delayed '+mode+' '+spec.url);
      release();
      await page.waitForFunction(id=>window.faCompetitionContext?.definition?.id===id,spec.id);
      assert.equal(await page.evaluate(async()=>window.faCompetitionModel.validManifest(
       await window.faCompetitionManifestPromise)),true,'canonical validation after hydration');
      await auditRequests.settle(mode+' '+spec.url);
      const requests=summary(collected[mode]);
      assert.equal(requests.compactRequests,1,'one compact read '+mode+' '+spec.url);
      assert.equal(requests.obsoleteManifestRequests,0,'no full manifest '+mode+' '+spec.url);
      const timings=await page.evaluate(()=>performance.getEntriesByType('resource')
       .filter(e=>e.name.includes('/competitions/_shared/compact.json'))
       .map(e=>({transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,
        decodedBodySize:e.decodedBodySize,durationMs:e.duration})));
      report.runs.push({route:spec.url,phase:mode,pending,requested:requests,resourceTiming:timings});
      checks++;
     }finally{release();await page.unroute('**'+compact,hold)}
    }
    phase='season';
    assert.equal(await page.evaluate(()=>window.faCompetitionContextApi.selectSeason(2)),true);
    await page.waitForFunction(()=>window.faCompetitionContext?.selectedSeason===2);
    await auditRequests.settle('season '+spec.url);
    const switched=await page.evaluate(()=>({
     selectedSeason:window.faCompetitionContext?.selectedSeason,
     retainedPriorData:window.faCompetitionContext?.seasonData!==null,
     retainedKnownIdentity:document.documentElement.dataset.faStandingsKnownIdentity==='true'
    }));
    assert.deepEqual(switched,{selectedSeason:2,retainedPriorData:false,retainedKnownIdentity:false});
    const requests=summary(collected.season);
    assert.equal(requests.compactRequests,0,'season switch reuses shared catalogue '+spec.url);
    assert.equal(requests.obsoleteManifestRequests,0,'season switch never loads legacy manifest');
    report.runs.push({route:spec.url,phase:'season',switched,requested:requests});
    assert.deepEqual(errors,[],'no JS exceptions '+spec.url);
    checks++;
   }finally{await context.close()}
  }
 }finally{
  mkdirSync('int24-browser-artifacts',{recursive:true});
  writeFileSync('int24-browser-artifacts/competition-657-network-'+engine+'.json',
   JSON.stringify(report,null,2)+'\n');
 }
 console.log('PERF-API-657 '+engine+' network audit PASS: '+checks+
  ' checks, detailed API-by-endpoint counts recorded');
 return checks;
}
