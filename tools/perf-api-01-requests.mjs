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
 '/account','/account/login','/admin','/admin/calendar','/admin/players','/admin/contracts',
 '/players/44','/matches/1','/competitions/it-1/postseason?season=1'
]);

// Tested in-page transitions are separate from document reloads. An absent
// control is reported as SKIPPED, never as evidence of zero network requests.
export const IN_PAGE_SCENARIOS=Object.freeze([
 Object.freeze({routePattern:/^\/clubs\/[^/]+\/[^/]+\/roster(?:\?|$)/,
  name:'roster-info-to-technical',selector:'a[data-club-roster-view="technical"]',
  expectedView:'technical'})
]);
// Local read-only Club transitions: do not assume a second season exists.
// Missing selectors or unavailable historical data are explicitly inconclusive.
export const CLUB_READ_AUDIT=Object.freeze({
 overviewRoute:/^\/clubs\/[^/]+\/[^/]+\/overview(?:\?|$)/,
 fixturesRoute:/^\/clubs\/[^/]+\/[^/]+\/fixtures(?:\?|$)/,
 historyLink:'.club-tabs a[href$="/history"]',
 overviewLink:'.club-tabs a[href$="/overview"]',
 seasonTrigger:'[data-club-fixture-control="season"] button[role="combobox"]',
 seasonOptions:'[data-club-fixture-control="season"] [role="option"][data-menu-value]',
 fixtureState:'.club-fixtures[data-club-fixtures-state]'
});
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
// Public static data is also a meaningful page payload; tracking CSS/crests
// would confound the read-contract audit with rendering assets.
export const PERF_CAPTURE_SCHEMA_VERSION=2;
// Read-contract modules only: count the incremental JS transport with the JSON.
// Arbitrary CSS, images, fonts and other bundles are outside this inventory.
export const TRACKED_STATIC_MODULES=Object.freeze([
 '/assets/competition-model.js','/assets/club-competition-catalogue.mjs',
 '/assets/club-fixtures-controller.mjs','/assets/club-fixtures-source.mjs',
 '/assets/club-history-source.mjs','/assets/club-public-read-cache.mjs',
 '/assets/competition-rules-view.js','/assets/competition-tabs.js'
]);
export const TRACKED_STATIC_DATA=Object.freeze([
 '/clubs/_shared/manifest.json','/clubs/_shared/identity.json',
 '/competitions/_shared/manifest.json','/competitions/_shared/compact.json',
 '/data/divisions.json','/assets/match-public-context.mjs'
]);
const SCOPED_CLUB_PROFILE=/^\/clubs\/_profiles\/(?:BR|DE|ENG|ES|FR|IT|NL|PT)-(?:[1-9]|[1-3][0-9]|40)\.json$/;
export function describeDataUrl(input){
 const api=describeApiUrl(input);
 if(api)return {...api,resourceKind:'api'};
 let url;try{url=new URL(input)}catch{return null}
 if(TRACKED_STATIC_MODULES.includes(url.pathname))
  return {...safeDescription(url),resourceKind:'module'};
 if(!TRACKED_STATIC_DATA.includes(url.pathname)&&!SCOPED_CLUB_PROFILE.test(url.pathname))return null;
 return {...safeDescription(url),resourceKind:'catalog'};
}
export function describePageUrl(input){
 try{return safeDescription(new URL(input,'http://app.localhost:2000'))}catch{return null}
}
// Match Resource Timing against the exact URL in ephemeral memory only. Taking
// the last N entries prevents a prior in-page visit from being counted again.
// Never persist or fingerprint private query values or unresolved transfer sizes.
export function attachResourceTransferTimings(entries,timings,urlOf){
 if(typeof urlOf!=='function')throw TypeError('Missing ephemeral request URL lookup');
 const byUrl=new Map(),requests=new Map();
 for(const timing of timings){
  if(typeof timing?.url!=='string')continue;
  const list=byUrl.get(timing.url)||[];
  list.push(timing);byUrl.set(timing.url,list);
 }
 for(const entry of entries){
  const url=urlOf(entry);if(typeof url!=='string')continue;
  const list=requests.get(url)||[];list.push(entry);requests.set(url,list);
 }
 for(const [url,list] of requests){
  const matches=byUrl.get(url)||[];
  if(matches.length<list.length)continue;
  for(const [index,entry] of list.entries()){
   const timing=matches[matches.length-list.length+index];
   for(const key of ['transferBytes','encodedBodyBytes','decodedBodyBytes']){
    if(Number.isFinite(timing[key])&&timing[key]>=0)entry[key]=timing[key];
   }
  }
 }
}

export function summarizeRequests(requests){
 const grouped=new Map();
 for(const request of requests){
  // A per-context, ephemeral URL variant distinguishes different search values
  // without recording the values or a reversible/unsalted fingerprint.
  const key=(request.resourceKind||'api')+' '+request.method+' '+request.comparisonKey+' ['+(request.queryKeys||[]).join(',')+']'+
   (request.urlVariant==null?'':' #'+request.urlVariant);
  let row=grouped.get(key);
  if(!row){row={method:request.method,resourceKind:request.resourceKind||'api',path:request.path,comparisonKey:request.comparisonKey,
   queryKeys:request.queryKeys||[],count:0,statuses:[],initiators:[],cacheControls:[],
   responseBytes:0,measuredResponses:0,observedTransferBytes:0,measuredTransferResponses:0};grouped.set(key,row)}
  row.count++;
  if(Number.isInteger(request.status)&&!row.statuses.includes(request.status))row.statuses.push(request.status);
  if(request.initiator&&!row.initiators.includes(request.initiator))row.initiators.push(request.initiator);
  if(request.cacheControl&&!row.cacheControls.includes(request.cacheControl))row.cacheControls.push(request.cacheControl);
  if(Number.isFinite(request.responseBytes)){
   row.responseBytes+=request.responseBytes;row.measuredResponses++;
  }
  if(Number.isFinite(request.transferBytes)&&request.transferBytes>=0){
   row.observedTransferBytes+=request.transferBytes;row.measuredTransferResponses++;
  }
 }
 const endpoints=[...grouped.values()].sort((a,b)=>a.path.localeCompare(b.path)||a.method.localeCompare(b.method));
 for(const row of endpoints)row.transferBytes=row.measuredTransferResponses===row.count?row.observedTransferBytes:null;
 const transferReads=requests.filter(r=>Number.isFinite(r.transferBytes)&&r.transferBytes>=0);
 const observedTransferBytes=transferReads.reduce((sum,r)=>sum+r.transferBytes,0);
 return {requestCount:requests.length,
  apiRequestCount:requests.filter(r=>!r.resourceKind||r.resourceKind==='api').length,
  catalogRequestCount:requests.filter(r=>r.resourceKind==='catalog').length,
  moduleRequestCount:requests.filter(r=>r.resourceKind==='module').length,
  transferBytes:transferReads.length===requests.length?observedTransferBytes:null,
  observedTransferBytes,measuredTransferResponses:transferReads.length,
  uniqueRequestShapes:endpoints.length,repeatedRequestCandidates:requests.length-endpoints.length,
  errorResponses:requests.filter(r=>Number.isInteger(r.status)&&r.status>=400).length,
  endpoints};
}
// A failed/unfinished navigation is not evidence of zero API requests.
// Keep partial observations for diagnosis, but exclude them from valid totals.
// Any failed tracked read makes a purported wire saving inconclusive.
// Only documented anonymous authorization and published-collection absences
// can return 4xx without invalidating the sampled page.
const OPTIONAL_PUBLISHED_MATCHES=/^\/api\/matches\/seasons\/[1-9]\d*\/competitions\/(?:(?:it|eng|es|de|fr|pt|nl|br)-[12]|int-[12])$/;
export function hasFailedTrackedRead(requests){
 return requests.some(row=>{
  if(row?.failed===true||row?.settled===false||
   !Number.isInteger(row?.status)||row.status<100)return true;
  if(row.status<400)return false;
  if(row.resourceKind!=='api'||row.method!=='GET')return true;
  if(row.status===401&&['/api/player/permissions','/api/admin/session'].includes(row.path))return false;
  if(row.status===404&&OPTIONAL_PUBLISHED_MATCHES.test(row.path))return false;
  return true;
 });
}
export function summarizeVisit(requests,{complete=true}={}){
 if(!complete)return {requestCount:null,apiRequestCount:null,catalogRequestCount:null,moduleRequestCount:null,
  transferBytes:null,observedTransferBytes:null,measuredTransferResponses:null,uniqueRequestShapes:null,
  repeatedRequestCandidates:null,errorResponses:null,endpoints:[],
  observedRequestCount:requests.length,incomplete:true};
 return {...summarizeRequests(requests),observedRequestCount:requests.length,incomplete:false};
}
// Track public API and allowlisted static data, not every CSS/image/font. Global page networkidle
// can time out while all relevant GETs have already settled (e.g. static assets).
// Require a short quiet period after the last API start/finish and fail closed
// when an API request remains pending beyond the deadline.
export async function waitForApiCompletion(readEntries,{timeoutMs=7000,quietMs=600,now=()=>Date.now(),delay=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const started=now();let previous='',quietSince=started;
 while(now()-started<timeoutMs){
  const entries=readEntries();
  const settled=entries.filter(entry=>entry.settled===true).length;
  const marker=entries.length+':'+settled;
  if(marker!==previous){previous=marker;quietSince=now();}
  if(settled===entries.length&&now()-quietSince>=quietMs)return true;
  await delay(50);
 }
 return false;
}
// A static UI-only preview answers /api/player/permissions with 404. That is
// not the app's anonymous API contract and must not become a performance baseline.
export function validateSamplerBackend({worldStatus,permissionsStatus}){
 if(worldStatus!==200)return 'Public world API did not return 200 (received '+worldStatus+')';
 if(permissionsStatus!==200&&permissionsStatus!==401)
  return 'Account permissions API did not return 200/401 (received '+permissionsStatus+')';
 return null;
}
export async function preflightAnonymousLocalApi(base){
 let world,permissions;
 try{
  [world,permissions]=await Promise.all(['/api/world','/api/player/permissions'].map(async path=>{
   const response=await fetch(base+path,{redirect:'error',signal:AbortSignal.timeout(5000),
    headers:{Accept:'application/json'}});
   return response;
  }));
 }catch{throw Error('Local APIs unavailable; start node tools/dev.mjs --local (Worker + isolated D1)');}
 const issue=validateSamplerBackend({worldStatus:world.status,permissionsStatus:permissions.status});
 if(issue)throw Error(issue+'; run node tools/dev.mjs --local, not the static-only preview');
 if(!world.headers.get('content-type')?.includes('application/json'))
  throw Error('Public world API response is not JSON; local Worker is unavailable');
}
export function parseArgs(args){
 const [label,...flags]=args;
 if(!['before','after'].includes(label))throw Error('Usage: node tools/perf-api-01-requests.mjs before|after [--runs=1] [--routes=/dashboard,/players] [--base-url=http://app.localhost:2000] [--served-head=<40-char-sha>]');
 const option=name=>flags.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3);
 const runs=Number(option('runs')||1);
 if(!Number.isInteger(runs)||runs<1||runs>10)throw Error('runs must be 1..10');
 const base=new URL(option('base-url')||'http://app.localhost:2000');
 if(base.protocol!=='http:'||!['localhost','app.localhost','127.0.0.1'].includes(base.hostname)||base.username||base.password)
  throw Error('Only local HTTP DEV origins are allowed');
 const routes=option('routes')?option('routes').split(','):DEFAULT_ROUTES;
 if(!routes.length||routes.some(route=>!route.startsWith('/')||route.startsWith('//')||route.includes('#')))
  throw Error('Routes must be local absolute paths');
 // A sampler checkout is not necessarily the checkout served by the Worker.
 const servedHead=option('served-head')||null;
 if(servedHead!==null&&!/^[0-9a-f]{40}$/i.test(servedHead))
  throw Error('served-head must be a full 40-character commit SHA');
 return {label,runs,base:base.origin,routes,servedHead};
}
// Collect anonymous read-only samples with an existing local Chromium instance.
// The production CLI and the disposable CI Worker share the exact same recorder.
export async function collectAnonymousBrowser(browser,options){
 const records=[];
  for(const route of options.routes)for(let attempt=0;attempt<options.runs;attempt++){
   const context=await browser.newContext({serviceWorkers:'block'});
   try{
    const page=await context.newPage();
    const captured=[],byRequest=new Map(),resourceUrls=new Map(),jobs=[];
    const urlVariants=new Map();
    page.on('request',request=>{
     const actual=new URL(request.url());if(actual.origin!==options.base)return;
     const parsed=describeDataUrl(actual.href);if(!parsed)return;
     let initiator=null;try{initiator=describePageUrl(request.frame().url())?.comparisonKey??null}catch{}
     if(!initiator||initiator==='blank')initiator=describePageUrl(route)?.comparisonKey??null;
     // Equality keys stay in process memory; the output contains only a local ID.
     const identity=actual.pathname+'?'+[...actual.searchParams].sort(([a,av],[b,bv])=>a.localeCompare(b)||av.localeCompare(bv)).map(([key,value])=>JSON.stringify([key,value])).join('&');
     if(!urlVariants.has(identity))urlVariants.set(identity,urlVariants.size+1);
     const entry={method:request.method(),...parsed,urlVariant:urlVariants.get(identity),initiator,status:null,
      cacheControl:null,responseBytes:null,transferBytes:null,encodedBodyBytes:null,decodedBodyBytes:null,
      durationMs:null,failed:false,settled:false};
     captured.push(entry);byRequest.set(request,entry);resourceUrls.set(entry,actual.href);
    });
    page.on('response',response=>{
     const entry=byRequest.get(response.request());if(!entry)return;
     entry.status=response.status();entry.cacheControl=response.headers()['cache-control']||null;
    });
    page.on('requestfailed',request=>{const entry=byRequest.get(request);if(entry){entry.failed=true;entry.settled=true}});
    page.on('requestfinished',request=>{
     const entry=byRequest.get(request);if(!entry)return;
     entry.settled=true;
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
     let error=null,status=null,apiQuiet=false;
     try{
      const response=await action();status=response?.status()??null;
      apiQuiet=await waitForApiCompletion(()=>captured.slice(start));
     }catch(e){error=typeof e?.name==='string'&&/^[A-Za-z][A-Za-z0-9]{0,60}$/.test(e.name)?e.name:'Error'}
     await Promise.allSettled(jobs);
     const sample=captured.slice(start);
     // ResourceTiming.transferSize is a browser measurement of bytes transferred
     // (headers included); the body size from request.sizes() is NOT a wire total.
     const timings=await page.evaluate(()=>performance.getEntriesByType('resource').map(entry=>({
      url:entry.name,transferBytes:entry.transferSize,
      encodedBodyBytes:entry.encodedBodySize,decodedBodyBytes:entry.decodedBodySize
     }))).catch(()=>[]);
     attachResourceTransferTimings(sample,timings,entry=>resourceUrls.get(entry));
     const observed=sample.map(entry=>({...entry}));
     const readFailed=hasFailedTrackedRead(observed);
     const complete=error===null&&apiQuiet&&(status===null||status<400)&&!readFailed;
     records.push({route:safeRoute,attempt,scenario,pageStatus:status,
      error:error??(!apiQuiet?'ApiRequestsUnsettled':status>=400?'PageHttpError':readFailed?'TrackedReadFailed':null),
      ...summarizeVisit(observed,{complete}),requests:observed});
     return complete;
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
    // Overview -> History -> Overview -> History measures the *same-document*
    // verified aggregate cache, not a new tab or a manufactured history payload.
    if(CLUB_READ_AUDIT.overviewRoute.test(route)){
     const historyTab=page.locator(CLUB_READ_AUDIT.historyLink).first();
     const overviewTab=page.locator(CLUB_READ_AUDIT.overviewLink).first();
     if(await historyTab.isVisible().catch(()=>false)&&await overviewTab.isVisible().catch(()=>false)){
      const change=async (tab,path)=>{
       await tab.click({timeout:5000});
       await page.waitForURL(url=>url.pathname.endsWith('/'+path),{timeout:7000});
       if(path==='history')await page.locator('.club-history[aria-busy="false"]').waitFor({timeout:7000});
      };
      if(await visit('club-overview-to-history',()=>change(historyTab,'history'))){
       if(await visit('club-history-to-overview',()=>change(overviewTab,'overview')))
        await visit('club-history-same-world-revisit',()=>change(historyTab,'history'));
      }
     }else records.push({route:safeRoute,attempt,scenario:'club-history-navigation',skipped:true,
      reason:'club-tabs-unavailable',requestCount:null});
    }
    // A season selector is only sampled if the authoritative UI actually
    // exposes 1 and 2. The last step restores the initial season for refresh.
    if(CLUB_READ_AUDIT.fixturesRoute.test(route)){
     const trigger=page.locator(CLUB_READ_AUDIT.seasonTrigger).first();
     const values=await page.locator(CLUB_READ_AUDIT.seasonOptions).evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-menu-value'))).catch(()=>[]);
     const state=await page.locator(CLUB_READ_AUDIT.fixtureState).first().getAttribute('data-club-fixtures-state').catch(()=>null);
     const startSeason=await page.locator('[data-club-fixture-control="season"] [data-club-fixture-value]').first().textContent().catch(()=>null);
     const initial=Number(startSeason?.match(/\b(\d+)\s*$/)?.[1]);
     if(await trigger.isVisible().catch(()=>false)&&!await trigger.isDisabled().catch(()=>true)&&
        ['complete','partial','unpublished'].includes(state)&&[1,2].includes(initial)&&
        values.includes('1')&&values.includes('2')){
      const alternate=initial===1?2:1;
      const cycle=[alternate,initial,alternate,initial];
      for(let step=0;step<cycle.length;step++){
       const chosen=cycle[step];
       const ok=await visit('club-fixtures-season-'+chosen+(step===2?'-revisit':step===3?'-restore':''),async()=>{
        await trigger.click({timeout:5000});
        await page.locator(CLUB_READ_AUDIT.seasonOptions+'[data-menu-value="'+chosen+'"]').click({timeout:5000});
        await page.waitForFunction(value=>{
         const text=document.querySelector('[data-club-fixture-control="season"] [data-club-fixture-value]')?.textContent?.trim()||'';
         const state=document.querySelector('.club-fixtures')?.getAttribute('data-club-fixtures-state');
         return text.endsWith(' '+value)&&['complete','partial','unpublished'].includes(state);
        },String(chosen),{timeout:10000});
       });
       if(!ok)break;
      }
     }else records.push({route:safeRoute,attempt,scenario:'club-fixtures-season-revisit',skipped:true,
      reason:'two-authoritative-seasons-unavailable',requestCount:null});
    }
    // Refresh samples must target the original route, even if a transition
    // failed after a pushState. A navigation failure is not a zero-byte sample.
    if(new URL(page.url()).pathname+new URL(page.url()).search!==new URL(target).pathname+new URL(target).search){
     await visit('restore-original-route',()=>page.goto(target,{waitUntil:'load',timeout:25000}));
    }
    await visit('refresh',()=>page.reload({waitUntil:'load',timeout:25000}));
    // A full route change within one tab should reuse only correctly scoped state.
    if(route!=='/dashboard'){
     const transitionStart=captured.length;
     await page.goto(options.base+'/dashboard',{waitUntil:'load',timeout:25000}).catch(()=>{});
     await waitForApiCompletion(()=>captured.slice(transitionStart)).catch(()=>false);
     await visit('same-tab-return',()=>page.goto(target,{waitUntil:'load',timeout:25000}));
    }
   }finally{await context.close()}
  }
 return records;
}

async function main(args){
 const options=parseArgs(args);
 await preflightAnonymousLocalApi(options.base);
 const {chromium}=await import(process.env.FA_ACCOUNT_PLAYWRIGHT||'playwright');
 const browser=await chromium.launch({headless:true,
  ...(process.env.FA_ACCOUNT_CHROME?{executablePath:process.env.FA_ACCOUNT_CHROME,args:['--no-sandbox']}: {})});
 let records;
 try{records=await collectAnonymousBrowser(browser,options)}finally{await browser.close()}
 const samplerHead=(()=>{try{return execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()}catch{return 'UNKNOWN'}})();
 const head=options.servedHead??samplerHead;
 const result={label:options.label,captureSchemaVersion:PERF_CAPTURE_SCHEMA_VERSION,
  head,samplerHead,headSource:options.servedHead?'operator-declared-served-checkout':'sampler-checkout',
  base:options.base,runs:options.runs,
  environment:'Local isolated DEV recommended; anonymous fresh browser context per route/run',
  caveats:'Counts include public APIs, scoped/shared catalogues and allowlisted Club/Competition read-contract JS modules, not arbitrary CSS, crests or fonts. Candidate repeats do not prove redundant work. API/page query values except public numeric season/day/week/offset/limit are redacted; private URL values remain ephemeral. Resource Timing transferSize includes response headers and can be zero for cached reads; missing timing means null totals, not zero traffic. Playwright responseBodySize is separate from wire size. Some sample player/match IDs may be unpublished and are never counted as successful page data. No real login, post-write, physical iPhone Safari or hosted Preview coverage.',
  records};
 mkdirSync('int24-browser-artifacts',{recursive:true});
 const output='int24-browser-artifacts/perf-api-01-'+options.label+'.json';
 writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 console.log('PERF-API-01: '+records.length+' route/scenario samples at '+head+'; '+output);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1});
}
