// FE-03: opt-in local performance diagnostic, no CI or snapshot registration.
import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';

const [label,...options]=process.argv.slice(2);
if(!['before','after'].includes(label))throw Error('Usage: node tools/fe-03-browser-profile.mjs before|after [--runs=20]');
const runs=Number(options.find(x=>x.startsWith('--runs='))?.slice(7)??'3');
if(!Number.isInteger(runs)||runs<1||runs>30)throw Error('runs must be 1..30');
const origin='http://app.localhost:2000',siteOrigin='http://localhost:2000';
const routes=[
 {path:'/',site:true},{path:'/dashboard'},{path:'/calendar'},
 {path:'/competitions'},{path:'/competitions/it-1/standings?season=1'},
 {path:'/competitions/int-1/fixtures?season=1'},{path:'/clubs'},
 {path:'/clubs/it/1/overview'},{path:'/account/login/'}
];
const profiles=[
 {width:320,language:'en',theme:'dark'},
 {width:390,language:'de',theme:'light'},
 {width:768,language:'es',theme:'dark'},
 {width:1440,language:'fr',theme:'light'},
 {width:390,language:'it',theme:'dark'}
];
const browser=await chromium.launch({headless:true});
const records=[];
const beginScript=()=>{
 const perf={lcp:[],shifts:[],tasks:[]};
 Object.defineProperty(window,'__faFe03',{value:perf});
 const watch=(type,key)=>{try{new PerformanceObserver(entries=>{
  for(const entry of entries.getEntries()){
   if(type==='layout-shift'&&entry.hadRecentInput)continue;
   perf[key].push(type==='longtask'?entry.duration:type==='layout-shift'?entry.value:entry.startTime);
  }
 }).observe({type,buffered:true})}catch{/* Unsupported entry types stay unknown. */}};
 watch('largest-contentful-paint','lcp');
 watch('layout-shift','shifts');
 watch('longtask','tasks');
};
try{
 for(const route of routes)for(const profile of profiles)for(let attempt=0;attempt<runs;attempt++){
  const context=await browser.newContext({
   viewport:{width:profile.width,height:900},
   colorScheme:profile.theme,reducedMotion:'reduce',serviceWorkers:'block'
  });
  try{
   await context.addInitScript(v=>{
    try{localStorage.setItem('football-architect:theme',v.theme);
     localStorage.setItem('football-architect:language',v.language)}catch{}
   },profile);
   await context.addInitScript(beginScript);
   if(route.path.startsWith('/account/'))await context.route('**/api/player/session',req=>
    req.fulfill({status:401,contentType:'application/json',body:'{}'}));
   const page=await context.newPage(),responses=[];
   page.on('response',r=>responses.push({status:r.status(),url:r.url(),type:r.request().resourceType()}));
   const url=(route.site?siteOrigin:origin)+route.path;
   const response=await page.goto(url,{waitUntil:'load',timeout:30000});
   await page.waitForLoadState('networkidle',{timeout:12000}).catch(()=>{});
   await page.waitForTimeout(300);
   const metrics=await page.evaluate(()=>{
    const p=window.__faFe03,n=performance.getEntriesByType('navigation')[0];
    const resources=performance.getEntriesByType('resource');
    const fcp=performance.getEntriesByName('first-contentful-paint')[0]?.startTime??null;
    const sized=resources.filter(r=>r.transferSize>0||r.decodedBodySize>0);
    return{
     fcp,lcp:p?.lcp?.at(-1)??null,
     cls:p?.shifts?.length?p.shifts.reduce((a,b)=>a+b,0):0,
     longTaskCount:p?.tasks?.length??null,
     longTaskMs:p?.tasks?.length?p.tasks.reduce((a,b)=>a+b,0):0,
     domContentLoaded:n?.domContentLoadedEventEnd??null,
     loadEnd:n?.loadEventEnd??null,
     requestTimingCount:resources.length,
     observedTransferBytes:resources.reduce((sum,r)=>sum+r.transferSize,0),
     observedDecodedBytes:resources.reduce((sum,r)=>sum+r.decodedBodySize,0),
     unknownTransferEntries:sized.filter(r=>r.transferSize===0).length,
     competitionTabs:document.querySelectorAll('.app-competition-tab').length,
     standingsRows:document.querySelectorAll('#app-standings-body tr').length,
     clubsCards:document.querySelectorAll('.nav01-card').length,
     bodyScrollWidth:document.documentElement.scrollWidth,
     readyState:document.readyState
    };
   });
   records.push({route:route.path,profile,attempt,status:response?.status()??null,
    ...metrics,requests:responses.length,httpErrors:responses.filter(r=>r.status>=400)});
  }finally{await context.close()}
 }
}finally{await browser.close()}
const quantile=(values,q)=>{
 const ordered=values.filter(Number.isFinite).sort((a,b)=>a-b);
 if(!ordered.length)return null;
 return ordered[Math.ceil(q*ordered.length)-1];
};
const metrics=['fcp','lcp','cls','longTaskMs','domContentLoaded','loadEnd',
 'observedTransferBytes','observedDecodedBytes','requests'];
const summary=[];
for(const route of routes)for(const profile of profiles){
 const subset=records.filter(r=>r.route===route.path&&r.profile.width===profile.width&&
  r.profile.language===profile.language&&r.profile.theme===profile.theme);
 const result={route:route.path,profile,statuses:[...new Set(subset.map(r=>r.status))],
  errors:subset.reduce((n,r)=>n+r.httpErrors.length,0)};
 for(const key of metrics)result[key]={median:quantile(subset.map(r=>r[key]),.5),
  p75:quantile(subset.map(r=>r[key]),.75),p95:quantile(subset.map(r=>r[key]),.95)};
 summary.push(result);
}
const directory='int24-browser-artifacts',output=directory+'/fe-03-'+label+'.json';
mkdirSync(directory,{recursive:true});
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const result={label,head,runs,environment:'Chromium local DEV; no-store caching; cold browser context per sample',
 caveats:'FCP/LCP/CLS/long tasks are lab observations; unknown transfer sizes are not zero network cost',summary,records};
writeFileSync(output,JSON.stringify(result,null,2));
console.log('FE-03 lab report: '+output+' @ '+head+' ('+records.length+' page visits)');
if(label==='after'&&existsSync(directory+'/fe-03-before.json')){
 const before=JSON.parse(readFileSync(directory+'/fe-03-before.json','utf8'));
 if(before.runs!==runs)console.log('Warning: unequal run counts, do not call results equivalent');
 for(const afterRow of summary){
  const first=before.summary?.find(row=>row.route===afterRow.route&&
   JSON.stringify(row.profile)===JSON.stringify(afterRow.profile));
  if(!first)continue;
  const fcpBefore=first.fcp?.median,fcpAfter=afterRow.fcp?.median;
  const delta=Number.isFinite(fcpBefore)&&fcpBefore>0&&Number.isFinite(fcpAfter)
   ?((fcpAfter/fcpBefore-1)*100).toFixed(1)+'%':'UNKNOWN';
  console.log(afterRow.route+' '+afterRow.profile.width+' '+afterRow.profile.language+
   '/'+afterRow.profile.theme+' FCP delta: '+delta);
 }
}
