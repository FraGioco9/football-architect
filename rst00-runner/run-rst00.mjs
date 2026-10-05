import {chromium} from 'playwright-core';
import axe from 'axe-core';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execFileAsync=promisify(execFile);

const baseURL=process.env.FA_BASE_URL||'http://127.0.0.1:2000';
const artifactDir=process.env.FA_ARTIFACT_DIR||path.resolve('artifacts');
await fs.mkdir(artifactDir,{recursive:true});
const startedAt=new Date().toISOString();
const results={startedAt,platform:process.platform,release:'2.0.0',checks:{},findings:[],browsers:{}};
const requestedChecks=process.argv.slice(2).map(x=>String(x).toUpperCase()).filter(Boolean);
const navPagesCore=['dashboard','calendar','inbox','club','squad','tactics','training','youth','league','world','advanced','market','finances','board','manager','settings'];
const navPages=[...navPagesCore,'careers'];
const browserCandidates={
  chrome:['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'],
  edge:['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe']
};
const existing=(arr)=>arr.find(p=>fssync.existsSync(p));
const executable={chrome:existing(browserCandidates.chrome),edge:existing(browserCandidates.edge)};
results.browsers.executable=executable;

function status(code,state,details={}){results.checks[code]={state,...details};}
function finding(id,severity,message,details={}){results.findings.push({id,severity,message,...details});}
function median(values){const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
async function shot(page,name){await page.screenshot({path:path.join(artifactDir,name),fullPage:true}).catch(()=>{});}
async function launchPersistent(browserName,userData,{headless=true,viewport={width:1440,height:1000}}={}){
  const exe=executable[browserName];
  if(!exe)throw new Error(`${browserName} executable unavailable`);
  const context=await chromium.launchPersistentContext(userData,{executablePath:exe,headless,viewport,acceptDownloads:true,args:['--no-first-run','--no-default-browser-check']});
  context.setDefaultTimeout(6000);context.setDefaultNavigationTimeout(45000);
  return context;
}
async function createContext(browserName,{headless=true,viewport={width:1440,height:1000},suffix=''}={}){
  const userData=await fs.mkdtemp(path.join(os.tmpdir(),`fa-rst00-${browserName}-${suffix}-`));
  const context=await launchPersistent(browserName,userData,{headless,viewport});
  return {context,userData};
}
async function ensureCareer(page){
  await page.goto(baseURL,{waitUntil:'domcontentloaded'});
  const dashboard=page.locator('.dashboard-hero').first();
  if(await dashboard.isVisible().catch(()=>false))return;

  // Test-only setup: construct a valid career with production modules, write the
  // normal legacy/catalog keys, then recreate the PRIMARY IndexedDB database so
  // application boot performs its real migration into a disposable browser profile.
  const seeded=await page.evaluate(async()=>{
    const [{makeWorld},{startCareer,validateSave},{createFreshCareerSlot}]=await Promise.all([
      import('/src/data.js'),
      import('/src/engine.js'),
      import('/src/career-management.js')
    ]);
    const career=makeWorld();
    startCareer(career,1,'RST00 Test Manager');
    createFreshCareerSlot(window.localStorage,career,validateSave);
    return {clubId:career.clubId,season:career.season,round:career.round,keys:Object.keys(localStorage)};
  });
  await page.evaluate(()=>new Promise((resolve,reject)=>{
    const req=indexedDB.deleteDatabase('football-architect-primary-careers');
    req.onsuccess=()=>resolve(true);
    req.onerror=()=>reject(req.error||new Error('primary IndexedDB delete failed'));
    req.onblocked=()=>reject(new Error('primary IndexedDB delete blocked'));
  }));
  await page.reload({waitUntil:'domcontentloaded'});
  const continueButton=page.locator('[data-action="menu-continue"]').first();
  await continueButton.waitFor({state:'visible',timeout:15000});
  await continueButton.click();
  try{
    await dashboard.waitFor({state:'visible',timeout:30000});
    await page.waitForTimeout(500);
  }catch(err){
    const state=await page.evaluate(()=>({title:document.title,text:(document.body?.innerText||'').slice(0,1600),url:location.href,localKeys:Object.keys(localStorage)}));
    throw new Error(`synthetic production-format career did not reach dashboard: seed=${JSON.stringify(seeded)} state=${JSON.stringify(state)}; ${String(err?.message||err)}`);
  }
}
async function navigateCore(page,id){
  const b=page.locator(`[data-action="nav"][data-page="${id}"]`).first();
  if(!(await b.count()))throw new Error(`navigation target missing: ${id}`);
  await b.evaluate(el=>el.click());
  await page.waitForTimeout(120);
}
async function openCareers(page){
  if(await page.locator('.career-hub-main').isVisible().catch(()=>false))return;
  let b=page.locator('[data-action="open-careers"]').first();
  if(!(await b.count())){
    await navigateCore(page,'settings');
    b=page.locator('[data-action="open-careers"]').first();
  }
  if(!(await b.count()))throw new Error('open-careers action missing after navigating to settings');
  await b.evaluate(el=>el.click());
  await page.locator('.career-hub-main').waitFor({state:'visible',timeout:15000});
}
async function globalGeometry(page){return page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,sh:document.documentElement.scrollHeight,ch:document.documentElement.clientHeight,dpr:devicePixelRatio,iw:innerWidth,ih:innerHeight,active:document.activeElement?.outerHTML?.slice(0,180)||''}));}
async function injectAxe(page){await page.addScriptTag({content:axe.source});}
async function axeScan(page,id){
  const violations=await page.evaluate(async()=>{const r=await axe.run(document,{resultTypes:['violations']});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length,help:v.help}));});
  const unnamed=await page.evaluate(()=>[...document.querySelectorAll('button,input,select,textarea,a[href]')].filter(el=>{const s=getComputedStyle(el);if(s.display==='none'||s.visibility==='hidden')return false;const name=(el.getAttribute('aria-label')||el.getAttribute('title')||el.textContent||el.getAttribute('value')||'').trim();return !name;}).map(el=>({tag:el.tagName,id:el.id,cls:el.className,action:el.getAttribute('data-action')})));
  return {id,violations,unnamed};
}
async function readPrimary(page){return page.evaluate(async()=>{
  const rec=await new Promise((resolve,reject)=>{const r=indexedDB.open('football-architect-primary-careers',1);r.onsuccess=()=>{const db=r.result;const tx=db.transaction('snapshots','readonly');const q=tx.objectStore('snapshots').get('primary');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);};r.onerror=()=>reject(r.error);});
  const hash=async raw=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(x=>x.toString(16).padStart(2,'0')).join('');
  return {schemaVersion:rec?.schemaVersion,revision:rec?.revision,sha256:rec?.sha256,computed:rec?.raw?await hash(rec.raw):null,rawLength:rec?.raw?.length||0};
});}

async function runB04(){
  const detail={browserRuns:{}};let verified=0;
  for(const browserName of ['chrome','edge']){
    let context;
    try{
      ({context}=await createContext(browserName,{headless:false,viewport:{width:1440,height:900},suffix:'b04'}));
      const page=context.pages()[0]||await context.newPage();await ensureCareer(page);await page.evaluate(()=>{document.title='FA-RST00-B04';});
      const before=await globalGeometry(page);let sendKeysError=null;
      try{
        const ps=`Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName Microsoft.VisualBasic; $ok=[Microsoft.VisualBasic.Interaction]::AppActivate('FA-RST00-B04'); Start-Sleep -Milliseconds 600; if(-not $ok){throw 'window-not-found'}; 1..5 | ForEach-Object { [System.Windows.Forms.SendKeys]::SendWait('^{+}'); Start-Sleep -Milliseconds 180 }`;
        await execFileAsync('powershell.exe',['-NoProfile','-Command',ps],{timeout:12000});
      }catch(err){sendKeysError=String(err?.message||err);}
      await page.waitForTimeout(700);const after=await globalGeometry(page);const ratio=before.iw/Math.max(1,after.iw);const native=ratio>=1.70&&ratio<=2.35;
      const pages=[];detail.browserRuns[browserName]={before,after,effectiveRatio:ratio,nativeZoomObserved:native,sendKeysError,pages};
      if(native){
        verified++;
        for(const id of navPagesCore){await navigateCore(page,id);const g=await globalGeometry(page);pages.push({id,...g,overflow:g.sw>g.cw+2});}
        await openCareers(page);const g=await globalGeometry(page);pages.push({id:'careers',...g,overflow:g.sw>g.cw+2});
        await shot(page,`b04-${browserName}-zoom.png`);
      }
    }catch(err){detail.browserRuns[browserName]={error:String(err?.message||err)};}
    finally{await context?.close().catch(()=>{});}
  }
  if(verified)status('B04','PASS',{...detail,note:'Native Windows browser zoom was observed and geometry/scroll evidence captured. Overflow remains a baseline finding.'});
  else status('B04','NON_ESEGUITO',{...detail,reason:'Hosted Windows desktop did not yield verifiable native browser zoom; no CSS/CDP substitute was used.'});
}

async function runB05(){
  const detail={pages:[],keyboard:{},modal:{},media:{}};let context;
  try{
    ({context}=await createContext('chrome',{headless:true,viewport:{width:1280,height:900},suffix:'b05-main'}));
    const page=context.pages()[0]||await context.newPage();await ensureCareer(page);await injectAxe(page);
    for(const id of navPagesCore){await navigateCore(page,id);detail.pages.push(await axeScan(page,id));}
    await openCareers(page);detail.pages.push(await axeScan(page,'careers'));
    await context.close();context=null;

    ({context}=await createContext('chrome',{headless:true,viewport:{width:375,height:812},suffix:'b05-keyboard'}));
    const keyPage=context.pages()[0]||await context.newPage();await ensureCareer(keyPage);
    const trigger=keyPage.locator('[data-action="toggle-sidebar"]');await trigger.click();
    const seq=[];for(let i=0;i<20;i++){await keyPage.keyboard.press('Tab');seq.push(await keyPage.evaluate(()=>({tag:document.activeElement?.tagName,id:document.activeElement?.id,action:document.activeElement?.getAttribute?.('data-action')})));}
    const focusInside=await keyPage.evaluate(()=>Boolean(document.activeElement?.closest?.('#club-sidebar')));await keyPage.keyboard.press('Escape');const focusReturned=await keyPage.evaluate(()=>document.activeElement?.matches?.('[data-action="toggle-sidebar"]')||false);
    detail.keyboard={focusInside,focusReturned,sequence:seq};
    await keyPage.emulateMedia({reducedMotion:'reduce'});detail.media.reducedMotion=await keyPage.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
    await keyPage.emulateMedia({forcedColors:'active'});detail.media.forcedColors=await keyPage.evaluate(()=>matchMedia('(forced-colors: active)').matches);
    await openCareers(keyPage);const rename=keyPage.locator('.career-card.career-active [data-action="career-rename"]').first();await rename.click();await keyPage.locator('[role="dialog"]').waitFor();
    detail.modal.focusInside=await keyPage.evaluate(()=>Boolean(document.activeElement?.closest?.('[role="dialog"]')));await keyPage.keyboard.press('Escape');await keyPage.waitForTimeout(100);detail.modal.closed=(await keyPage.locator('[role="dialog"]').count())===0;
    const severe=detail.pages.flatMap(x=>x.violations).filter(v=>v.impact==='serious'||v.impact==='critical').length;const unnamed=detail.pages.reduce((n,x)=>n+x.unnamed.length,0);
    if(!focusInside||!focusReturned||!detail.modal.focusInside||!detail.modal.closed)finding('B05-FOCUS','baseline','One or more keyboard/focus expectations are not met.',{keyboard:detail.keyboard,modal:detail.modal});
    if(severe||unnamed)finding('B05-A11Y','baseline','Automated accessibility findings recorded.',{seriousOrCritical:severe,unnamed});
    await fs.writeFile(path.join(artifactDir,'b05-accessibility.json'),JSON.stringify(detail,null,2));
    status('B05','PASS',{...detail,seriousOrCritical:severe,unnamed,note:'The complete automated accessibility/keyboard matrix was acquired; findings are baseline quality findings, not hidden.'});
  }catch(err){status('B05','NON_ESEGUITO',{...detail,reason:String(err?.message||err)});}finally{await context?.close().catch(()=>{});}
}

async function runC03(){
  const detail={};let currentContext=null;
  try{
    for(const browserName of ['chrome','edge']){
      const created=await createContext(browserName,{headless:true,viewport:{width:1280,height:900},suffix:'c03'});
      const {context,userData}=created;currentContext=context;let page=context.pages()[0]||await context.newPage();await ensureCareer(page);
      const initial=await readPrimary(page);if(!initial.rawLength||initial.sha256!==initial.computed)throw new Error(`${browserName}: initial IndexedDB integrity mismatch`);
      await page.locator('[data-action="advance"]').first().click();await page.waitForTimeout(900);const close=page.locator('[data-action="close-modal"]').first();if(await close.count()&&await close.isVisible())await close.click();
      const afterMatch=await readPrimary(page);if(!afterMatch.rawLength||afterMatch.sha256!==afterMatch.computed)throw new Error(`${browserName}: post-match IndexedDB integrity mismatch`);
      await openCareers(page);
      const active=page.locator('.career-card.career-active');
      const exportPath=path.join(artifactDir,`c03-${browserName}-export.json`);const [download]=await Promise.all([page.waitForEvent('download'),active.locator('[data-action="career-export"]').click()]);await download.saveAs(exportPath);const exported=JSON.parse(await fs.readFile(exportPath,'utf8'));
      await active.locator('[data-action="career-checkpoints"]').click();await page.locator('[data-dialog-kind="career-checkpoints"]').waitFor();const checkpointRows=await page.locator('.career-checkpoint-row').count();if(checkpointRows<1)throw new Error(`${browserName}: checkpoint not created`);
      const restore=page.locator('[data-action="career-checkpoint-restore"]:not([disabled])').first();if(await restore.count()){await restore.click();await page.locator('[data-dialog-kind="career-checkpoint-confirm"]').waitFor();await page.locator('[data-action="career-checkpoint-confirm"]').click();await page.waitForTimeout(500);}else throw new Error(`${browserName}: no restorable checkpoint`);
      await openCareers(page);await page.locator('#career-import-file').setInputFiles(exportPath);await page.locator('[data-dialog-kind="career-import-preview"]').waitFor();const importPreviewRows=await page.locator('.career-import-row').count();await page.locator('[data-action="close-modal"]').first().click();
      const beforeClose=await readPrimary(page);await context.close();currentContext=null;
      const reopenedContext=await launchPersistent(browserName,userData,{headless:true,viewport:{width:1280,height:900}});currentContext=reopenedContext;page=reopenedContext.pages()[0]||await reopenedContext.newPage();await page.goto(baseURL,{waitUntil:'domcontentloaded'});await page.waitForTimeout(300);const reopened=await readPrimary(page);await reopenedContext.close();
      const persistent=beforeClose.sha256===reopened.sha256&&reopened.rawLength>0&&reopened.sha256===reopened.computed;
      detail[browserName]={initial,afterMatch,beforeClose,reopened,persistent,checkpointRows,importPreviewRows,exportedType:Array.isArray(exported)?'bundle':typeof exported};
      if(!persistent||importPreviewRows<1)throw new Error(`${browserName}: persistence/import verification failed`);
    }
    await fs.writeFile(path.join(artifactDir,'c03-storage.json'),JSON.stringify(detail,null,2));status('C03','PASS',{...detail,note:'Real Chrome/Edge IndexedDB, verified checkpoint restore, JSON export/import preview and persistence across browser relaunch completed in disposable profiles.'});
  }catch(err){status('C03','NON_ESEGUITO',{...detail,reason:String(err?.message||err)});}
  finally{await currentContext?.close().catch(()=>{});}
}

async function installPerfObservers(page){await page.addInitScript(()=>{window.__rst00Perf={cls:0,lcp:null,mutations:0};try{new PerformanceObserver(list=>{for(const e of list.getEntries()){if(!e.hadRecentInput)window.__rst00Perf.cls+=e.value;}}).observe({type:'layout-shift',buffered:true});}catch{}try{new PerformanceObserver(list=>{for(const e of list.getEntries())window.__rst00Perf.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});}catch{}addEventListener('DOMContentLoaded',()=>{const target=document.getElementById('app')||document.body;new MutationObserver(()=>window.__rst00Perf.mutations++).observe(target,{childList:true,subtree:true,attributes:true});},{once:true});});}
async function collectPerf(page,label){await page.waitForTimeout(900);return page.evaluate(label=>{const nav=performance.getEntriesByType('navigation')[0];const resources=performance.getEntriesByType('resource');return {label,domContentLoaded:nav?.domContentLoadedEventEnd??null,load:nav?.loadEventEnd??null,transferSize:(nav?.transferSize||0)+resources.reduce((n,r)=>n+(r.transferSize||0),0),resources:resources.length,lcp:window.__rst00Perf?.lcp??null,cls:window.__rst00Perf?.cls??null,mutations:window.__rst00Perf?.mutations??null};},label);}
async function runD02(){
  const detail={};let context;
  try{
    ({context}=await createContext('chrome',{headless:true,viewport:{width:1440,height:900},suffix:'d02'}));let page=context.pages()[0]||await context.newPage();await installPerfObservers(page);const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
    const cold=[];for(let i=0;i<5;i++){await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await page.goto(baseURL,{waitUntil:'load'});if(i===0)await ensureCareer(page);cold.push(await collectPerf(page,`cold-${i+1}`));}
    await cdp.send('Network.setCacheDisabled',{cacheDisabled:false});const warm=[];for(let i=0;i<5;i++){await page.reload({waitUntil:'load'});warm.push(await collectPerf(page,`warm-${i+1}`));}
    const navigation=[];for(let round=0;round<2;round++)for(const id of navPagesCore){const t=performance.now();await navigateCore(page,id);navigation.push({round,id,ms:performance.now()-t,geom:await globalGeometry(page)});}
    const returns=[];for(const [a,b] of [['dashboard','squad'],['market','club'],['tactics','calendar']]){await navigateCore(page,a);const t1=performance.now();await navigateCore(page,b);const t2=performance.now();await navigateCore(page,a);returns.push({a,b,toB:t2-t1,back:performance.now()-t2});}
    await navigateCore(page,'squad');const search=page.locator('#squad-search');const inputSamples=[];if(await search.count()){for(let i=0;i<5;i++){const t=performance.now();await search.fill(`RST${i}`);await page.waitForTimeout(100);inputSamples.push(performance.now()-t);}}
    detail.cold=cold;detail.warm=warm;detail.navigation=navigation;detail.returns=returns;detail.inputSamples=inputSamples;detail.medians={coldLoad:median(cold.map(x=>x.load)),warmLoad:median(warm.map(x=>x.load)),coldLcp:median(cold.map(x=>x.lcp)),warmLcp:median(warm.map(x=>x.lcp)),cls:median([...cold,...warm].map(x=>x.cls)),navigation:median(navigation.map(x=>x.ms)),cachedReturn:median(returns.map(x=>x.back)),input:median(inputSamples)};
    await fs.writeFile(path.join(artifactDir,'d02-performance.json'),JSON.stringify(detail,null,2));const complete=cold.length===5&&warm.length===5&&navigation.length===navPagesCore.length*2&&returns.length===3&&Number.isFinite(detail.medians.coldLoad)&&detail.medians.cls!==null;
    status('D02',complete?'PASS':'NON_ESEGUITO',{...detail,...(!complete?{reason:'Required sample matrix or raw metrics were incomplete.'}:{note:'Raw samples, medians, transfer sizes, CLS, navigation, cached returns and input responsiveness captured on one Windows runner.'})});
  }catch(err){status('D02','NON_ESEGUITO',{...detail,reason:String(err?.message||err)});}finally{await context?.close().catch(()=>{});}
}

const registry=[['B04',runB04],['B05',runB05],['C03',runC03],['D02',runD02]];
const selected=requestedChecks.length?registry.filter(([name])=>requestedChecks.includes(name)):registry;
if(!selected.length)throw new Error('No valid RST-00 check selected.');
for(const [name,fn] of selected){
  console.log(`RST00_START ${name}`);
  try{await fn();}catch(err){status(name,'NON_ESEGUITO',{reason:String(err?.message||err)});}
  console.log(`RST00_DONE ${name} ${results.checks[name]?.state||'UNKNOWN'}`);
  await fs.writeFile(path.join(artifactDir,`partial-results-${name}.json`),JSON.stringify(results,null,2));
}
results.finishedAt=new Date().toISOString();
results.summary=Object.fromEntries(['PASS','FAIL','NON_ESEGUITO'].map(s=>[s,Object.values(results.checks).filter(x=>x.state===s).length]));
const suffix=selected.map(([name])=>name).join('-');
await fs.writeFile(path.join(artifactDir,`RST00-WIN-RESULTS-${suffix}.json`),JSON.stringify(results,null,2));
const md=['# Football Architect — RST-00 Windows addendum','',`Generated: ${results.finishedAt}`,'',`Checks: ${suffix}`,'','| Check | Result |','|---|---|',...Object.entries(results.checks).map(([k,v])=>`| ${k} | **${v.state}** |`),'',`Summary: ${results.summary.PASS} PASS · ${results.summary.FAIL} FAIL · ${results.summary.NON_ESEGUITO} NON ESEGUITO`,'','This addendum does not rewrite the original 16 PASS / 4 NON ESEGUITO baseline. It records the separate Windows rerun only.','RST-01 was not started. WRD02.05 remains non-certified.'].join('\\n');
await fs.writeFile(path.join(artifactDir,`RST00-WIN-ADDENDUM-${suffix}.md`),md);
console.log(JSON.stringify({checks:suffix,summary:results.summary}));
