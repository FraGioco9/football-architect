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

const VISIBLE_PARAMS=new Set(['season','day','week','offset','limit']);
export function describeApiUrl(input){
 let url;
 try{url=new URL(input)}catch{return null}
 if(!url.pathname.startsWith('/api/'))return null;
 const path=url.pathname.replace(/\/[A-Za-z0-9_%+-]{40,}(?=\/|$)/g,'/:redacted');
 const queryKeys=[...new Set(url.searchParams.keys())].sort();
 const allowed=[...url.searchParams].filter(([key,value])=>VISIBLE_PARAMS.has(key)&&/^\d{1,5}$/.test(value))
  .sort(([a,av],[b,bv])=>a.localeCompare(b)||av.localeCompare(bv));
 const normalized=new URLSearchParams(allowed).toString();
 return {path,queryKeys,comparisonKey:path+(normalized?'?'+normalized:'')};
}
export function summarizeRequests(requests){
 const grouped=new Map();
 for(const request of requests){
  const key=request.method+' '+request.comparisonKey+' ['+(request.queryKeys||[]).join(',')+']';
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
 const {chromium}=await import('playwright');
 const browser=await chromium.launch({headless:true});
 const records=[];
 try{
  for(const route of options.routes)for(let attempt=0;attempt<options.runs;attempt++){
   const context=await browser.newContext({serviceWorkers:'block'});
   try{
    const page=await context.newPage();
    const captured=[],byRequest=new Map(),jobs=[];
    page.on('request',request=>{
     const parsed=describeApiUrl(request.url());if(!parsed)return;
     let initiator=null;try{initiator=new URL(request.frame().url()).pathname}catch{}
     const entry={method:request.method(),...parsed,initiator,status:null,
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
     let error=null,status=null;
     try{
      const response=await action();status=response?.status()??null;
      await page.waitForLoadState('networkidle',{timeout:7000}).catch(()=>{});
     }catch(e){error=String(e).slice(0,240)}
     await Promise.allSettled(jobs);
     const observed=captured.slice(start).map(entry=>({...entry}));
     records.push({route,attempt,scenario,pageStatus:status,error,...summarizeRequests(observed),requests:observed});
    };
    const target=options.base+route;
    await visit('direct-load',()=>page.goto(target,{waitUntil:'load',timeout:25000}));
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
  caveats:'Counts are observations, not proof of redundant calls. Query values except numeric season/day/week/offset/limit are redacted. No real login, post-write, in-page tab click, iPhone Safari or hosted Preview coverage.',
  records};
 mkdirSync('int24-browser-artifacts',{recursive:true});
 const output='int24-browser-artifacts/perf-api-01-'+options.label+'.json';
 writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 console.log('PERF-API-01: '+records.length+' route/scenario samples at '+head+'; '+output);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1});
}
