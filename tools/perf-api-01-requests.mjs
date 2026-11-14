// PERF-API-01 (#550) — local, read-only browser network inventory.
// No credentials, response bodies, headers (other than cache-control), or query values are persisted.
import {mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export const DEFAULT_ROUTES=Object.freeze([
 '/dashboard','/clubs','/clubs/it/1/overview','/clubs/it/1/roster',
 '/clubs/it/1/fixtures','/clubs/it/1/stats','/clubs/it/1/history',
 '/competitions/it-1/standings?season=1','/competitions/it-1/fixtures?season=1',
 '/competitions/it-1/stats?season=1','/competitions/it-1/history?season=1',
 '/competitions/int-1/fixtures?season=1','/calendar','/players',
 '/account','/account/login','/admin','/admin/calendar','/admin/players','/admin/contracts'
]);

// Tested in-page transitions are separate from document reloads. An absent
// control is reported as SKIPPED, never as evidence of zero network requests.
export const IN_PAGE_SCENARIOS=Object.freeze([
 Object.freeze({routePattern:/^\/clubs\/[^/]+\/[^/]+\/roster(?:\?|$)/,
  name:'roster-info-to-technical',selector:'a[data-club-roster-view="technical"]',
  expectedView:'technical'})
]);
const VISIBLE_PARAMS=new Set(['season','day','week','offset','limit']);
// Raw query values are never persisted. Only short numeric selectors are public.
// Long opaque path segments (including 32-character tokens) are redacted too.
function safeDescription(url){
 const path=url.pathname.replace(/\/[A-Za-z0-9_%+-]{24,}(?=\/|$)/g,'/:redacted');
 const queryKeys=[...new Set(url.searchParams.keys())].sort();
 const allowed=[...url.searchParams].filter(([key,value])=>VISIBLE_PARAMS.has(key)&&/^\d{1,5}$/.test(value))
  .sort(([a,av],[b,bv])=>a.localeCompare(b)||av.localeCompare(bv));
 const normalized=new URLSearchParams(allowed).toString();
 return {path,queryKeys,comparisonKey:path+(normalized?'?'+normalized:'')};
}
export function describeApiUrl(input){
 let url;
 try{url=new URL(input)}catch{return null}
 if(!url.pathname.startsWith('/api/'))return null;
 return safeDescription(url);
}
export function describePageUrl(input){
 try{return safeDescription(new URL(input,'http://app.localhost:2000'))}catch{return null}
}

export function summarizeRequests(requests){
 const grouped=new Map();
 for(const request of requests){
  // A per-context, ephemeral URL variant distinguishes different search values
  // without recording the values or a reversible/unsalted fingerprint.
  const key=request.method+' '+request.comparisonKey+' ['+(request.queryKeys||[]).join(',')+']'+
   (request.urlVariant==null?'':' #'+request.urlVariant);
  let row=grouped.get(key);
  if(!row){row={method:request.method,path:request.path,comparisonKey:request.comparisonKey,
   queryKeys:request.queryKeys||[],count:0,statuses:[],initiators:[],cacheControls:[],
   responseBytes:0,measuredResponses:0};grouped.set(key,row)}
  row.count++;
  if(Number.isInteger(request.status)&&!row.statuses.includes(request.status))row.statuses.push(request.status);
  if(request.initiator&&!row.initiators.includes(request.initiator))row.initiators.push(request.initiator);
  if(request.cacheControl&&!row.cacheControls.includes(request.cacheControl))row.cacheControls.push(request.cacheControl);
  if(Number.isFinite(request.responseBytes)){
   row.responseBytes+=request.responseBytes;row.measuredResponses++;
  }
 }
 const endpoints=[...grouped.values()].sort((a,b)=>a.path.localeCompare(b.path)||a.method.localeCompare(b.method));
 return {requestCount:requests.length,uniqueRequestShapes:endpoints.length,
  repeatedRequestCandidates:requests.length-endpoints.length,
  errorResponses:requests.filter(r=>Number.isInteger(r.status)&&r.status>=400).length,
  endpoints};
}
// A failed/unfinished navigation is not evidence of zero API requests.
// Keep partial observations for diagnosis, but exclude them from valid totals.
export function summarizeVisit(requests,{complete=true}={}){
 if(!complete)return {requestCount:null,uniqueRequestShapes:null,
  repeatedRequestCandidates:null,errorResponses:null,endpoints:[],
  observedRequestCount:requests.length,incomplete:true};
 return {...summarizeRequests(requests),observedRequestCount:requests.length,incomplete:false};
}
function parseArgs(args){
 const [label,...flags]=args;
 if(!['before','after'].includes(label))throw Error('Usage: node tools/perf-api-01-requests.mjs before|after [--runs=1] [--routes=/dashboard,/players] [--base-url=http://app.localhost:2000]');
 const option=name=>flags.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3);
 const runs=Number(option('runs')||1);
 if(!Number.isInteger(runs)||runs<1||runs>10)throw Error('runs must be 1..10');
 const base=new URL(option('base-url')||'http://app.localhost:2000');
 if(base.protocol!=='http:'||!['localhost','app.localhost','127.0.0.1'].includes(base.hostname)||base.username||base.password)
  throw Error('Only local HTTP DEV origins are allowed');
 const routes=option('routes')?option('routes').split(','):DEFAULT_ROUTES;
 if(!routes.length||routes.some(route=>!route.startsWith('/')||route.startsWith('//')||route.includes('#')))
  throw Error('Routes must be local absolute paths');
 return {label,runs,base:base.origin,routes};
}
async function main(args){
 const options=parseArgs(args);
 const {chromium}=await import(process.env.FA_ACCOUNT_PLAYWRIGHT||'playwright');
 const browser=await chromium.launch({headless:true,
  ...(process.env.FA_ACCOUNT_CHROME?{executablePath:process.env.FA_ACCOUNT_CHROME,args:['--no-sandbox']}: {})});
 const records=[];
 try{
  for(const route of options.routes)for(let attempt=0;attempt<options.runs;attempt++){
   const context=await browser.newContext({serviceWorkers:'block'});
   try{
    const page=await context.newPage();
    const captured=[],byRequest=new Map(),jobs=[];
    const urlVariants=new Map();
    page.on('request',request=>{
     const parsed=describeApiUrl(request.url());if(!parsed)return;
     let initiator=null;try{initiator=describePageUrl(request.frame().url())?.comparisonKey??null}catch{}
     if(!initiator||initiator==='blank')initiator=describePageUrl(route)?.comparisonKey??null;
     const actual=new URL(request.url());
     // Equality keys stay in process memory; the output contains only a local ID.
     const identity=actual.pathname+'?'+[...actual.searchParams].sort(([a,av],[b,bv])=>a.localeCompare(b)||av.localeCompare(bv)).map(([key,value])=>JSON.stringify([key,value])).join('&');
     if(!urlVariants.has(identity))urlVariants.set(identity,urlVariants.size+1);
     const entry={method:request.method(),...parsed,urlVariant:urlVariants.get(identity),initiator,status:null,
      cacheControl:null,responseBytes:null,durationMs:null,failed:false};
     captured.push(entry);byRequest.set(request,entry);
    });
    page.on('response',response=>{
     const entry=byRequest.get(response.request());if(!entry)return;
     entry.status=response.status();entry.cacheControl=response.headers()['cache-control']||null;
    });
    page.on('requestfailed',request=>{const entry=byRequest.get(request);if(entry)entry.failed=true});
    page.on('requestfinished',request=>{
     const entry=byRequest.get(request);if(!entry)return;
     jobs.push((async()=>{
      try{const sizes=await request.sizes();entry.responseBytes=sizes.responseBodySize}catch{}
      try{const timing=request.timing();if(timing.responseEnd>=0&&timing.startTime>=0)
       entry.durationMs=timing.responseEnd}catch{}
     })());
    });
    // Guard against accidental state-changing API requests from instrumentation.
    await page.route('**/api/**',req=>['GET','HEAD'].includes(req.request().method())?req.continue():req.abort('blockedbyclient'));
    const visit=async (scenario,action)=>{
     const start=captured.length;
     let error=null,status=null,networkIdle=false;
     try{
      const response=await action();status=response?.status()??null;
      try{await page.waitForLoadState('networkidle',{timeout:7000});networkIdle=true}catch{}
     }catch(e){error=typeof e?.name==='string'&&/^[A-Za-z][A-Za-z0-9]{0,60}$/.test(e.name)?e.name:'Error'}
     await Promise.allSettled(jobs);
     const observed=captured.slice(start).map(entry=>({...entry}));
     const complete=error===null&&networkIdle&&(status===null||status<400);
     records.push({route:safeRoute,attempt,scenario,pageStatus:status,
      error:error??(!networkIdle?'NetworkIdleTimeout':status>=400?'PageHttpError':null),
      ...summarizeVisit(observed,{complete}),requests:observed});
    };
    // The navigation target remains exact; only recorded metadata is redacted.
    const safeRoute=describePageUrl(route)?.comparisonKey??'unavailable';
    const target=options.base+route;
    await visit('direct-load',()=>page.goto(target,{waitUntil:'load',timeout:25000}));
    // Measure genuine in-document route transitions, not only page.goto.
    // Club Roster is a verified pushState subview. A skeleton/empty/error page
    // without an actionable control is explicitly inconclusive.
    for(const scenario of IN_PAGE_SCENARIOS.filter(item=>item.routePattern.test(route))){
     const control=page.locator(scenario.selector).first();
     const visible=await control.isVisible().catch(()=>false);
     const disabled=visible&&await control.getAttribute('aria-disabled')==='true';
     if(!visible||disabled){
      records.push({route:safeRoute,attempt,scenario:scenario.name,skipped:true,
       reason:visible?'control-disabled':'control-unavailable',requestCount:null});
      continue;
     }
     await visit(scenario.name,async()=>{
      await control.click({timeout:5000});
      if(new URL(page.url()).searchParams.get('view')!==scenario.expectedView)
       throw Error('Roster subview did not reach expected URL');
     });
     await visit('roster-history-back',async()=>{
      await page.goBack({waitUntil:'domcontentloaded',timeout:7000});
      if(new URL(page.url()).searchParams.get('view')===scenario.expectedView)
       throw Error('Roster Back did not restore prior view');
     });
    }
    await visit('refresh',()=>page.reload({waitUntil:'load',timeout:25000}));
    // A full route change within one tab should reuse only correctly scoped state.
    if(route!=='/dashboard'){
     await page.goto(options.base+'/dashboard',{waitUntil:'load',timeout:25000}).catch(()=>{});
     await page.waitForLoadState('networkidle',{timeout:7000}).catch(()=>{});
     await visit('same-tab-return',()=>page.goto(target,{waitUntil:'load',timeout:25000}));
    }
   }finally{await context.close()}
  }
 }finally{await browser.close()}
 const head=(()=>{try{return execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()}catch{return 'UNKNOWN'}})();
 const result={label:options.label,head,base:options.base,runs:options.runs,
  environment:'Local isolated DEV recommended; anonymous fresh browser context per route/run',
  caveats:'Counts are observations, not proof of redundant calls. API/page query values except numeric season/day/week/offset/limit are redacted; per-context URL variant IDs distinguish different hidden values. The Roster in-page subview is sampled when actionable, with explicit skips otherwise. No real login, post-write, physical iPhone Safari or hosted Preview coverage.',
  records};
 mkdirSync('int24-browser-artifacts',{recursive:true});
 const output='int24-browser-artifacts/perf-api-01-'+options.label+'.json';
 writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 console.log('PERF-API-01: '+records.length+' route/scenario samples at '+head+'; '+output);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1});
}
