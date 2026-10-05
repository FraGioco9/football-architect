import {chromium} from 'playwright-core';
import axe from 'axe-core';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execFileAsync=promisify(execFile);

const baseURL=process.env.FA_BASE_URL||'http://127.0.0.1:2000';
const artifactDir=process.env.FA_ARTIFACT_DIR||path.resolve('artifacts');
await fs.mkdir(artifactDir,{recursive:true});
const startedAt=new Date().toISOString();
const results={startedAt,platform:process.platform,release:'2.0.0',checks:{},findings:[],browsers:{}};
const navPages=['dashboard','calendar','inbox','club','squad','tactics','training','youth','league','world','advanced','market','finances','board','manager','settings','careers'];
const browserCandidates={
  chrome:[
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
  ],
  edge:[
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
  ]
};
const existing=(arr)=>arr.find(p=>fssync.existsSync(p));
const executable={chrome:existing(browserCandidates.chrome),edge:existing(browserCandidates.edge)};
results.browsers.executable=executable;

function status(code,state,details={}){results.checks[code]={state,...details};}
function finding(id,severity,message,details={}){results.findings.push({id,severity,message,...details});}
async function shot(page,name){await page.screenshot({path:path.join(artifactDir,name),fullPage:true}).catch(()=>{});}
async function createContext(browserName,{headless=true,viewport={width:1440,height:1000},suffix=''}={}){
  const exe=executable[browserName];
  if(!exe)throw Object.assign(new Error(`${browserName} executable unavailable`),{code:'BROWSER_UNAVAILABLE'});
  const userData=await fs.mkdtemp(path.join(os.tmpdir(),`fa-rst00-${browserName}-${suffix}-`));
  const context=await chromium.launchPersistentContext(userData,{executablePath:exe,headless,viewport,acceptDownloads:true,args:['--no-first-run','--no-default-browser-check']});
  return {context,userData};
}
async function ensureCareer(page){
  await page.goto(baseURL,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(250);
  const menuNew=page.locator('[data-action="menu-new"]');
  if(await menuNew.count()&&await menuNew.first().isVisible())await menuNew.first().click();
  const manager=page.locator('#manager-name');
  if(await manager.count()&&await manager.isVisible()){
    await manager.fill('RST00 Test Manager');
    await page.locator('[data-action="start-career"]').click();
  }
  await page.locator('[data-action="nav"][data-page="dashboard"]').first().waitFor({state:'visible',timeout:15000});
}
async function navigate(page,id){
  if(id==='careers'){
    const b=page.locator('[data-action="open-careers"]').first();
    await b.click();
  }else{
    const b=page.locator(`[data-action="nav"][data-page="${id}"]`).first();
    await b.scrollIntoViewIfNeeded(); await b.click();
  }
  await page.waitForTimeout(80);
}
async function globalGeometry(page){return page.evaluate(()=>({
  sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,
  sh:document.documentElement.scrollHeight,ch:document.documentElement.clientHeight,
  dpr:devicePixelRatio,iw:innerWidth,ih:innerHeight,
  active:document.activeElement?.outerHTML?.slice(0,180)||''
}));}
async function injectAxe(page){await page.addScriptTag({content:axe.source});}

async function runB04(){
  const detail={browserRuns:{}}; let nativeZoomVerified=false;
  for(const browserName of ['chrome','edge']){
    try{
      const {context}=await createContext(browserName,{headless:false,viewport:{width:1440,height:900},suffix:'b04'});
      const page=context.pages()[0]||await context.newPage();
      await ensureCareer(page);
      await page.evaluate(()=>{document.title='FA-RST00-B04';});
      const before=await globalGeometry(page);
      let sendKeysError=null;
      try{
        const ps=`Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName Microsoft.VisualBasic; $ok=[Microsoft.VisualBasic.Interaction]::AppActivate('FA-RST00-B04'); Start-Sleep -Milliseconds 700; if(-not $ok){throw 'window-not-found'}; 1..5 | ForEach-Object { [System.Windows.Forms.SendKeys]::SendWait('^{+}'); Start-Sleep -Milliseconds 180 }`;
        await execFileAsync('powershell.exe',['-NoProfile','-Command',ps],{timeout:15000});
      }catch(err){sendKeysError=String(err?.message||err);}
      await page.waitForTimeout(900);
      const after=await globalGeometry(page);
      const ratio=before.iw/Math.max(1,after.iw);
      const changed=ratio>=1.70&&ratio<=2.35;
      detail.browserRuns[browserName]={before,after,effectiveRatio:ratio,nativeZoomObserved:changed,sendKeysError,pages:[]};
      if(changed){
        nativeZoomVerified=true;
        for(const id of navPages){
          await navigate(page,id); const g=await globalGeometry(page);
          const overflow=g.sw>g.cw+2; detail.browserRuns[browserName].pages.push({id,...g,overflow});
          if(overflow)finding(`B04-OVERFLOW-${browserName}-${id}`,'baseline',`Global overflow at native zoom on ${id}`,g);
        }
        await shot(page,`b04-${browserName}-zoom.png`);
        try{
          const reset=`Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.Interaction]::AppActivate('FA-RST00-B04') | Out-Null; Start-Sleep -Milliseconds 300; [System.Windows.Forms.SendKeys]::SendWait('^0')`;
          await execFileAsync('powershell.exe',['-NoProfile','-Command',reset],{timeout:8000});
        }catch{}
      }
      await context.close();
    }catch(err){detail.browserRuns[browserName]={error:String(err?.message||err)};}
  }
  if(nativeZoomVerified)status('B04','PASS',{...detail,note:'Native Windows browser zoom was empirically observed. Any overflow is recorded as a baseline finding, not silently corrected.'});
  else status('B04','NON_ESEGUITO',{...detail,reason:'No verifiable native browser zoom was observed on the hosted Windows desktop; no CSS/CDP substitute was used.'});
}
async function runB05(){
  const detail={};
  try{
    const {context}=await createContext('chrome',{headless:true,viewport:{width:1280,height:900},suffix:'b05'});
    const page=context.pages()[0]||await context.newPage(); await ensureCareer(page); await injectAxe(page);
    const pages=[]; let critical=0;
    for(const id of navPages){
      await navigate(page,id);
      const scan=await page.evaluate(async()=>{const r=await axe.run(document,{resultTypes:['violations']});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length,help:v.help}));});
      const severe=scan.filter(v=>v.impact==='critical'||v.impact==='serious'); critical+=severe.length;
      pages.push({id,violations:scan});
    }
    await page.setViewportSize({width:375,height:812}); await navigate(page,'dashboard');
    const trigger=page.locator('[data-action="toggle-sidebar"]'); await trigger.click();
    const sidebar=page.locator('#club-sidebar'); const tabSequence=[];
    for(let i=0;i<20;i++){await page.keyboard.press('Tab');tabSequence.push(await page.evaluate(()=>({tag:document.activeElement?.tagName,id:document.activeElement?.id,cls:document.activeElement?.className})));}
    const focusInside=await page.evaluate(()=>Boolean(document.activeElement?.closest?.('#club-sidebar')));
    await page.keyboard.press('Escape');
    const returned=await page.evaluate(()=>document.activeElement?.matches?.('[data-action="toggle-sidebar"]')||false);
    await page.emulateMedia({reducedMotion:'reduce',forcedColors:'active'}).catch(()=>{});
    const ctaVisible=await page.locator('[data-action="toggle-sidebar"]').isVisible();
    detail.pages=pages;detail.keyboard={focusInside,returned,tabSequence};detail.forced={ctaVisible};
    await fs.writeFile(path.join(artifactDir,'b05-axe.json'),JSON.stringify(pages,null,2));
    await context.close();
    if(!focusInside||!returned)status('B05','FAIL',{...detail,reason:'Keyboard focus containment/return did not meet the existing contract.'});
    else status('B05','PASS',{...detail,baselineAccessibilityFindings:critical,note:'Accessibility violations are recorded as baseline findings; PASS means the automated evidence suite completed.'});
  }catch(err){status('B05','NON_ESEGUITO',{reason:String(err?.message||err),...detail});}
}

async function runC03(){
  const detail={};
  try{
    for(const browserName of ['chrome','edge']){
      const {context}=await createContext(browserName,{headless:true,viewport:{width:1280,height:900},suffix:'c03'});
      let page=context.pages()[0]||await context.newPage(); await page.goto(baseURL,{waitUntil:'domcontentloaded'});
      await page.evaluate(async()=>{await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase('football-architect-primary-careers');r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('blocked'));});localStorage.clear();});
      await page.reload({waitUntil:'domcontentloaded'}); await ensureCareer(page); await page.waitForTimeout(400);
      const first=await page.evaluate(async()=>{
        const read=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('football-architect-primary-careers',1);r.onsuccess=()=>{const db=r.result;const tx=db.transaction('snapshots','readonly');const q=tx.objectStore('snapshots').get('primary');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);};r.onerror=()=>reject(r.error);});
        const rec=await read(); const hash=async raw=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(x=>x.toString(16).padStart(2,'0')).join('');
        return {schemaVersion:rec?.schemaVersion,revision:rec?.revision,sha256:rec?.sha256,computed:rec?.raw?await hash(rec.raw):null,rawLength:rec?.raw?.length||0};
      });
      if(!first.rawLength||first.sha256!==first.computed)throw Error(`${browserName}: primary IndexedDB SHA mismatch`);
      await page.close(); page=await context.newPage(); await page.goto(baseURL,{waitUntil:'domcontentloaded'}); await page.waitForTimeout(300);
      const reopened=await page.evaluate(async()=>new Promise((resolve,reject)=>{const r=indexedDB.open('football-architect-primary-careers',1);r.onsuccess=()=>{const db=r.result;const tx=db.transaction('snapshots','readonly');const q=tx.objectStore('snapshots').get('primary');q.onsuccess=()=>resolve({revision:q.result?.revision,sha256:q.result?.sha256,rawLength:q.result?.raw?.length||0});q.onerror=()=>reject(q.error);};r.onerror=()=>reject(r.error);}));
      detail[browserName]={first,reopened,persistent:first.sha256===reopened.sha256&&reopened.rawLength>0};
      await context.close();
    }
    const pass=Object.values(detail).every(x=>x.persistent);
    status('C03',pass?'PASS':'FAIL',{...detail,note:'Real browser IndexedDB persisted across page/browser-context page reopen in disposable profiles; no personal data used.'});
  }catch(err){status('C03','NON_ESEGUITO',{...detail,reason:String(err?.message||err)});}
}

async function installPerfObservers(page){
  await page.addInitScript(()=>{
    window.__rst00Perf={cls:0,lcp:null};
    try{new PerformanceObserver(list=>{for(const e of list.getEntries()){if(!e.hadRecentInput)window.__rst00Perf.cls+=e.value;}}).observe({type:'layout-shift',buffered:true});}catch{}
    try{new PerformanceObserver(list=>{for(const e of list.getEntries())window.__rst00Perf.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});}catch{}
  });
}
async function collectPerf(page,label){
  await page.waitForTimeout(900);
  return page.evaluate(label=>{
    const nav=performance.getEntriesByType('navigation')[0];
    return {label,domContentLoaded:nav?.domContentLoadedEventEnd??null,load:nav?.loadEventEnd??null,transferSize:nav?.transferSize??null,lcp:window.__rst00Perf?.lcp??null,cls:window.__rst00Perf?.cls??null};
  },label);
}
async function runD02(){
  const detail={};
  try{
    const {context}=await createContext('chrome',{headless:true,viewport:{width:1440,height:900},suffix:'d02'});
    let page=context.pages()[0]||await context.newPage();
    await installPerfObservers(page);
    const cdp=await context.newCDPSession(page);
    const cold=[];
    for(let i=0;i<5;i++){
      await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
      await page.goto(baseURL,{waitUntil:'load'}); cold.push(await collectPerf(page,`cold-${i+1}`));
      if(i===0)await ensureCareer(page);
    }
    await cdp.send('Network.setCacheDisabled',{cacheDisabled:false});
    const warm=[];
    for(let i=0;i<5;i++){await page.reload({waitUntil:'load'});warm.push(await collectPerf(page,`warm-${i+1}`));}
    const nav=[];
    for(let round=0;round<2;round++)for(const id of navPages){const t=performance.now();await navigate(page,id);nav.push({round,id,ms:performance.now()-t,geom:await globalGeometry(page)});}
    const returns=[];
    for(const [a,b] of [['dashboard','squad'],['market','club'],['tactics','calendar']]){await navigate(page,a);const t1=performance.now();await navigate(page,b);const t2=performance.now();await navigate(page,a);returns.push({a,b,toB:t2-t1,back:performance.now()-t2});}
    detail.cold=cold;detail.warm=warm;detail.navigation=nav;detail.returns=returns;
    await fs.writeFile(path.join(artifactDir,'d02-performance.json'),JSON.stringify(detail,null,2));
    await context.close();
    const metricsComplete=[...cold,...warm].every(x=>Number.isFinite(x.load)&&x.cls!==null);
    status('D02',metricsComplete?'PASS':'NON_ESEGUITO',{...detail,...(!metricsComplete?{reason:'Required navigation/CLS metrics were not available from the hosted browser.'}:{note:'Cold, warm and in-app SPA return baselines collected. No improvement threshold is applied in RST-00.'})});
  }catch(err){status('D02','NON_ESEGUITO',{...detail,reason:String(err?.message||err)});}
}

for(const [name,fn] of [['B04',runB04],['B05',runB05],['C03',runC03],['D02',runD02]]){
  try{await fn();}catch(err){status(name,'NON_ESEGUITO',{reason:String(err?.message||err)});}
  await fs.writeFile(path.join(artifactDir,'partial-results.json'),JSON.stringify(results,null,2));
}
results.finishedAt=new Date().toISOString();
results.summary=Object.fromEntries(['PASS','FAIL','NON_ESEGUITO'].map(s=>[s,Object.values(results.checks).filter(x=>x.state===s).length]));
await fs.writeFile(path.join(artifactDir,'RST00-WIN-RESULTS.json'),JSON.stringify(results,null,2));
const md=[
  '# Football Architect — RST-00 Windows addendum',
  '',`Generated: ${results.finishedAt}`,'',
  '| Check | Result |','|---|---|',
  ...Object.entries(results.checks).map(([k,v])=>`| ${k} | **${v.state}** |`),
  '',`Summary: ${results.summary.PASS} PASS · ${results.summary.FAIL} FAIL · ${results.summary.NON_ESEGUITO} NON ESEGUITO`,
  '', 'This addendum does not rewrite the original 16 PASS / 4 NON ESEGUITO baseline. It records the separate Windows rerun only.',
  'RST-01 was not started. WRD02.05 remains non-certified.'
].join('\n');
await fs.writeFile(path.join(artifactDir,'RST00-WIN-ADDENDUM.md'),md);
console.log(JSON.stringify(results.summary));
