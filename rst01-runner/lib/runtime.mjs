import {chromium} from 'playwright-core';
import axe from 'axe-core';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const baseURL=process.env.FA_BASE_URL||'http://127.0.0.1:2000';
export const artifactDir=process.env.FA_ARTIFACT_DIR||path.resolve('artifacts');
export const navPagesCore=['dashboard','calendar','inbox','club','squad','tactics','training','youth','league','world','advanced','market','finance','board','manager','settings'];

const browserCandidates={
  chrome:['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'],
  edge:['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe']
};

const existing=arr=>arr.find(p=>fssync.existsSync(p));
export const executables={
  chrome:existing(browserCandidates.chrome),
  edge:existing(browserCandidates.edge)
};

export function assert(ok,message,details=null){
  if(ok)return;
  const e=new Error(message);
  e.details=details;
  throw e;
}

export function median(values){
  const a=values.filter(Number.isFinite).sort((x,y)=>x-y);
  if(!a.length)return null;
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}

export async function ensureArtifactDir(){
  await fs.mkdir(artifactDir,{recursive:true});
}

export async function writeEvidence(name,value){
  await ensureArtifactDir();
  const file=path.join(artifactDir,name);
  await fs.writeFile(file,typeof value==='string'?value:JSON.stringify(value,null,2));
  return file;
}

export async function launchPersistent(browserName,{viewport={width:1440,height:900},suffix='rst01',headless=true}={}){
  const exe=executables[browserName];
  if(!exe)throw new Error(`${browserName} executable unavailable`);
  const userData=await fs.mkdtemp(path.join(os.tmpdir(),`fa-rst01-${browserName}-${suffix}-`));
  const context=await chromium.launchPersistentContext(userData,{
    executablePath:exe,
    headless,
    viewport,
    acceptDownloads:true,
    args:['--no-first-run','--no-default-browser-check']
  });
  context.setDefaultTimeout(10000);
  context.setDefaultNavigationTimeout(45000);
  return {context,userData};
}

export async function ensureCareer(page,name='RST01 Test Manager'){
  await page.goto(baseURL,{waitUntil:'domcontentloaded'});
  const dashboard=page.locator('.dashboard-hero').first();
  if(await dashboard.isVisible().catch(()=>false))return {existing:true};

  const seeded=await page.evaluate(async managerName=>{
    const [{makeWorld},{startCareer,validateSave},{createFreshCareerSlot}]=await Promise.all([
      import('/src/data.js'),
      import('/src/engine.js'),
      import('/src/career-management.js')
    ]);
    const career=makeWorld();
    startCareer(career,1,managerName);
    createFreshCareerSlot(window.localStorage,career,validateSave);
    return {clubId:career.clubId,season:career.season,round:career.round,keys:Object.keys(localStorage)};
  },name);

  await page.evaluate(()=>new Promise((resolve,reject)=>{
    const req=indexedDB.deleteDatabase('football-architect-primary-careers');
    req.onsuccess=()=>resolve(true);
    req.onerror=()=>reject(req.error||new Error('primary IndexedDB delete failed'));
    req.onblocked=()=>reject(new Error('primary IndexedDB delete blocked'));
  }));

  await page.reload({waitUntil:'domcontentloaded'});
  const continueButton=page.locator('[data-action="menu-continue"]').first();
  await continueButton.waitFor({state:'visible',timeout:20000});
  await continueButton.click();
  await dashboard.waitFor({state:'visible',timeout:30000});
  return {existing:false,seeded};
}

export async function navigateCore(page,id){
  const b=page.locator(`[data-action="nav"][data-page="${id}"]`).first();
  if(!(await b.count()))throw new Error(`navigation target missing: ${id}`);
  await b.evaluate(el=>el.click());
  await page.waitForTimeout(150);
}

export async function openCareers(page){
  if(await page.locator('.career-hub-main').isVisible().catch(()=>false))return;
  let b=page.locator('[data-action="open-careers"]').first();
  if(!(await b.count())){
    await navigateCore(page,'settings');
    b=page.locator('[data-action="open-careers"]').first();
  }
  if(!(await b.count()))throw new Error('open-careers action missing');
  await b.evaluate(el=>el.click());
  await page.locator('.career-hub-main').waitFor({state:'visible',timeout:15000});
}

export async function readPrimary(page){
  return page.evaluate(async()=>{
    const rec=await new Promise((resolve,reject)=>{
      const r=indexedDB.open('football-architect-primary-careers',1);
      r.onsuccess=()=>{
        const db=r.result;
        const tx=db.transaction('snapshots','readonly');
        const q=tx.objectStore('snapshots').get('primary');
        q.onsuccess=()=>resolve(q.result);
        q.onerror=()=>reject(q.error);
      };
      r.onerror=()=>reject(r.error);
    });
    if(!rec?.raw)return {rawLength:0,slotCount:0,careers:[]};
    const rows=JSON.parse(rec.raw);
    const entries=new Map(rows);
    const slotRows=[...entries].filter(([key])=>/^football-architect:career:slot:/.test(key));
    const computed=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(rec.raw)))].map(x=>x.toString(16).padStart(2,'0')).join('');
    const careers=slotRows.map(([key,raw])=>{
      try{return {key,career:JSON.parse(raw)};}catch{return {key,career:null};}
    });
    let activeSlotId=null,activeStorageKey=null,career=null;
    const catalogRaw=entries.get('football-architect:career:catalog:v1');
    if(catalogRaw){
      try{
        const catalog=JSON.parse(catalogRaw);
        activeSlotId=catalog?.activeSlotId??null;
        activeStorageKey=catalog?.slots?.find(x=>x.id===activeSlotId)?.storageKey??null;
      }catch{}
    }
    if(activeStorageKey){
      career=careers.find(x=>x.key===activeStorageKey)?.career??null;
    }else if(careers.length===1){
      career=careers[0].career;
    }
    return {
      rawLength:rec.raw.length,
      schemaVersion:rec.schemaVersion,
      revision:rec.revision,
      sha256:rec.sha256,
      computed,
      checksumValid:computed===rec.sha256,
      slotCount:slotRows.length,
      activeSlotId,
      activeStorageKey,
      careers,
      career
    };
  });
}

export async function primarySummary(page){
  const p=await readPrimary(page);
  const c=p.career||{};
  return {
    rawLength:p.rawLength,
    schemaVersion:p.schemaVersion,
    revision:p.revision,
    sha256:p.sha256,
    computed:p.computed,
    checksumValid:p.checksumValid,
    slotCount:p.slotCount,
    season:c.season,
    round:c.round,
    clubId:c.clubId,
    countryId:c.countryId,
    teamCount:Array.isArray(c.teams)?c.teams.length:null,
    playerCount:Array.isArray(c.players)?c.players.length:null
  };
}

export function attachErrorCapture(page){
  const errors=[];
  const warnings=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));
  page.on('console',m=>{
    const message=m.text();
    if(m.type()==='error'){
      if(/Failed to load resource: the server responded with a status of 404/i.test(message))warnings.push(`benign-resource-404: ${message}`);
      else errors.push(message);
    }
    if(m.type()==='warning')warnings.push(message);
  });
  return {errors,warnings};
}

export async function axeScan(page){
  await page.addScriptTag({content:axe.source});
  return page.evaluate(async()=>{
    const result=await axe.run(document,{resultTypes:['violations']});
    return result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length,help:v.help}));
  });
}

export async function geometry(page){
  return page.evaluate(()=>({
    sw:document.documentElement.scrollWidth,
    cw:document.documentElement.clientWidth,
    sh:document.documentElement.scrollHeight,
    ch:document.documentElement.clientHeight,
    iw:innerWidth,
    ih:innerHeight,
    dpr:devicePixelRatio
  }));
}

export async function uiProbe(page){
  return page.evaluate(()=>({
    title:document.title,
    lang:document.documentElement.lang||'',
    actions:[...document.querySelectorAll('[data-action]')].map(el=>el.getAttribute('data-action')).filter(Boolean),
    pages:[...document.querySelectorAll('[data-page]')].map(el=>el.getAttribute('data-page')).filter(Boolean),
    buttons:[...document.querySelectorAll('button')].filter(el=>getComputedStyle(el).display!=='none').slice(0,80).map(el=>({
      action:el.getAttribute('data-action'),
      text:(el.textContent||'').trim().slice(0,100),
      disabled:el.disabled
    })),
    text:(document.body?.innerText||'').slice(0,4000)
  }));
}

export async function probeModules(page,candidates){
  return page.evaluate(async paths=>{
    const out={};
    for(const p of paths){
      try{
        const r=await fetch(p,{cache:'no-store'});
        if(!r.ok){out[p]={exists:false,status:r.status};continue;}
        const m=await import(p);
        out[p]={exists:true,exports:Object.keys(m).sort()};
      }catch(error){
        out[p]={exists:false,error:String(error?.message||error)};
      }
    }
    return out;
  },candidates);
}

export const domainCandidates=[
  '/src/engine.js',
  '/src/data.js',
  '/src/career-management.js',
  '/src/primary-career-storage.js',
  '/src/domain/advanced-career.js',
  '/src/domain/career-world.js',
  '/src/domain/career-divisions.js',
  '/src/domain/domestic-cups.js',
  '/src/domain/continental-cups.js',
  '/src/domain/world-history.js',
  '/src/domain/tactics.js',
  '/src/domain/match-substitutions.js',
  '/src/domain/fitness-injuries.js',
  '/src/domain/player-development.js',
  '/src/domain/player-dynamics.js',
  '/src/domain/player-contracts.js',
  '/src/domain/youth-academy.js',
  '/src/domain/transfer-market.js',
  '/src/domain/market-windows.js',
  '/src/domain/scouting.js',
  '/src/domain/market-ai.js',
  '/src/domain/board.js',
  '/src/domain/finance.js',
  '/src/domain/staff-facilities.js',
  '/src/domain/manager-career.js'
];

export async function exportProbe(page,patterns){
  return page.evaluate(async({paths,patterns})=>{
    const rx=patterns.map(x=>new RegExp(x,'i'));
    const hits=[];
    for(const p of paths){
      try{
        const response=await fetch(p,{cache:'no-store'});
        if(!response.ok)continue;
        const mod=await import(p);
        for(const [name,value] of Object.entries(mod)){
          if(typeof value==='function'&&rx.some(r=>r.test(name)))hits.push({module:p,name});
        }
      }catch{}
    }
    return hits;
  },{paths:domainCandidates,patterns});
}

export function pass(details={}){return {state:'PASS',...details};}
export function nonExecuted(reason,details={}){return {state:'NON_ESEGUITO',reason,...details};}
export function fail(reason,details={}){return {state:'FAIL',reason,...details};}
