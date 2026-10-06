import fs from 'node:fs/promises';
import path from 'node:path';
import {
  artifactDir,assert,attachErrorCapture,ensureCareer,launchPersistent,navigateCore,
  navPagesCore,openCareers,pass,nonExecuted,primarySummary,readPrimary,uiProbe
} from '../lib/runtime.mjs';

async function startCareerThroughUi(page,baseURL){
  await page.goto(baseURL,{waitUntil:'domcontentloaded'});
  const fresh=await page.evaluate(async()=>({
    localCareerKeys:Object.keys(localStorage).filter(k=>/football-architect:career:/i.test(k)),
    dbs:typeof indexedDB.databases==='function'?(await indexedDB.databases()).map(x=>x.name).filter(Boolean):[]
  }));
  const menuCandidates=page.locator('button,[data-action],a');
  const rows=await menuCandidates.evaluateAll(els=>els.map((el,index)=>({
    index,
    action:el.getAttribute('data-action')||'',
    text:(el.textContent||'').trim(),
    visible:!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length),
    disabled:Boolean(el.disabled)
  })).filter(x=>x.visible&&!x.disabled&&/menu-new|new.*career|career.*new|nuova.*carriera|new game|nuova partita/i.test(x.action+' '+x.text)));
  if(!rows.length)return {ok:false,reason:'new-career control not found',fresh};
  await menuCandidates.nth(rows[0].index).click();

  const steps=[];
  for(let step=0;step<8;step++){
    if(await page.locator('.dashboard-hero').first().isVisible().catch(()=>false)){
      return {ok:true,fresh,steps};
    }
    const visibleTextInputs=page.locator('input:not([type="hidden"]):not([type="file"]):not([disabled]):visible');
    for(let i=0;i<await visibleTextInputs.count();i++){
      const el=visibleTextInputs.nth(i);
      const type=((await el.getAttribute('type'))||'text').toLowerCase();
      if(['checkbox','radio','range','color','date'].includes(type))continue;
      const value=await el.inputValue().catch(()=> '');
      if(!value)await el.fill(type==='number'?'1':'RST01 Manager').catch(()=>{});
    }
    const selects=page.locator('select:not([disabled]):visible');
    for(let i=0;i<await selects.count();i++){
      const el=selects.nth(i);
      const options=await el.locator('option:not([disabled])').evaluateAll(opts=>opts.map((o,index)=>({index,value:o.value,text:(o.textContent||'').trim()})));
      const candidate=options.find(x=>x.index>0&&x.value!=='')||options.find(x=>x.value!=='');
      if(candidate)await el.selectOption(candidate.value).catch(()=>{});
    }
    const radios=page.locator('input[type="radio"]:not([disabled]):visible');
    if(await radios.count() && !(await page.locator('input[type="radio"]:checked').count()))await radios.first().check().catch(()=>{});
    const buttons=page.locator('button:not([disabled]):visible,[data-action]:not([disabled]):visible');
    const candidates=await buttons.evaluateAll(els=>els.map((el,index)=>({
      index,action:el.getAttribute('data-action')||'',text:(el.textContent||'').trim()
    })).filter(x=>/next|continue|start|create|begin|confirm|avanti|continua|inizia|crea|conferma/i.test(x.action+' '+x.text)&&!/menu-continue/i.test(x.action)));
    steps.push({step,candidates:candidates.slice(0,12)});
    if(!candidates.length)break;
    const chosen=candidates[0];
    await buttons.nth(chosen.index).click().catch(()=>{});
    if(chosen.action==='start-career'){
      await page.locator('.dashboard-hero').first().waitFor({state:'visible',timeout:5000}).catch(()=>{});
      const dashboardVisible=await page.locator('.dashboard-hero').first().isVisible().catch(()=>false);
      if(!dashboardVisible)return {ok:false,reason:'dashboard did not appear immediately after start-career without refresh or second action',fresh,steps};
      return {ok:true,fresh,steps};
    }
    await page.waitForTimeout(250);
  }
  return {ok:await page.locator('.dashboard-hero').first().isVisible().catch(()=>false),fresh,steps};
}

async function returnToMenuThroughUi(page){
  const find=async()=>{
    const controls=page.locator('button:not([disabled]):visible,[data-action]:not([disabled]):visible,a:visible');
    const rows=await controls.evaluateAll(els=>els.map((el,index)=>({
      index,action:el.getAttribute('data-action')||'',text:(el.textContent||'').trim()
    })).filter(x=>/return.*menu|back.*menu|menu-home|career-exit|main menu|menu principale|torna.*menu|esci/i.test(x.action+' '+x.text)));
    return {controls,rows};
  };
  let found=await find();
  if(!found.rows.length){
    await navigateCore(page,'settings').catch(()=>{});
    found=await find();
  }
  if(!found.rows.length)return {ok:false,reason:'return-to-menu control not found'};
  await found.controls.nth(found.rows[0].index).click().catch(()=>{});
  await page.locator('.fa-main-menu').waitFor({state:'visible',timeout:10000}).catch(()=>{});
  if(!(await page.locator('.fa-main-menu').isVisible().catch(()=>false))){
    await page.reload({waitUntil:'domcontentloaded'}).catch(()=>{});
    await page.locator('.fa-main-menu').waitFor({state:'visible',timeout:10000}).catch(()=>{});
  }
  const continueButton=page.locator('[data-action="menu-continue"]').first();
  const continueVisible=await continueButton.isVisible().catch(()=>false);
  const continueDisabled=continueVisible?await continueButton.isDisabled().catch(()=>true):true;
  return {ok:continueVisible&&!continueDisabled,chosen:found.rows[0],continueVisible,continueDisabled,menuVisible:await page.locator('.fa-main-menu').isVisible().catch(()=>false)};
}

async function localeSnapshot(page){
  return page.evaluate(()=>{
    const text=(document.body?.innerText||'').replace(/\s+/g,' ').trim();
    const dates=[
      ...(text.match(/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/g)||[]),
      ...(text.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Gen|Feb|Mar|Apr|Mag|Giu|Lug|Ago|Set|Ott|Nov|Dic)[a-zà-ù]*\s+\d{1,2}(?:,\s*\d{4})?/gi)||[])
    ].slice(0,20);
    const currencies=(text.match(/(?:€\s?\d[\d.,]*|\d[\d.,]*\s?€|EUR\s?\d[\d.,]*)/g)||[]).slice(0,20);
    const numbers=(text.match(/\b\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?\b|\b\d+[.,]\d{1,2}\b/g)||[]).slice(0,20);
    return {lang:(document.documentElement.lang||'').toLowerCase(),text:text.slice(0,5000),dates,currencies,numbers};
  });
}

async function A01(ctx){
  const cap=attachErrorCapture(ctx.page);
  await ctx.page.goto(ctx.baseURL,{waitUntil:'domcontentloaded'});
  await ctx.page.waitForTimeout(250);
  const probe=await uiProbe(ctx.page);
  const storage=await ctx.page.evaluate(async()=>{
    const localCareerKeys=Object.keys(localStorage).filter(k=>/football-architect:career:/i.test(k));
    const dbs=typeof indexedDB.databases==='function'?(await indexedDB.databases()).map(x=>x.name).filter(Boolean):[];
    let primary=null;
    if(dbs.includes('football-architect-primary-careers')){
      primary=await new Promise(resolve=>{
        const r=indexedDB.open('football-architect-primary-careers',1);
        r.onsuccess=()=>{
          const db=r.result;
          if(!db.objectStoreNames.contains('snapshots')){resolve(null);return;}
          const tx=db.transaction('snapshots','readonly'),q=tx.objectStore('snapshots').get('primary');
          q.onsuccess=()=>resolve(q.result??null);q.onerror=()=>resolve(null);
        };
        r.onerror=()=>resolve(null);
      });
    }
    let primaryCareerSlots=0;
    if(primary?.raw){
      try{
        const entries=JSON.parse(primary.raw);
        primaryCareerSlots=entries.filter(([key])=>/^football-architect:career:slot:/.test(key)).length;
      }catch{primaryCareerSlots=-1;}
    }
    return {localCareerKeys,dbs,primaryExists:Boolean(primary),primaryCareerSlots};
  });
  const continueButton=ctx.page.locator('[data-action="menu-continue"]').first();
  const continueVisible=await continueButton.isVisible().catch(()=>false);
  const continueDisabled=continueVisible?await continueButton.isDisabled().catch(()=>false):true;
  if(storage.localCareerKeys.length||storage.primaryCareerSlots!==0){
    return {state:'FAIL',reason:'A01 browser profile contained an existing career payload',storage};
  }
  if(!(probe.text||'').trim())return nonExecuted('Empty first paint',{probe,storage});
  if(continueVisible&&!continueDisabled)return {state:'FAIL',reason:'Continue action enabled on clean install',probe,storage};
  if(cap.errors.length)return {state:'FAIL',reason:'Blocking console/page errors on clean first paint',errors:cap.errors,probe,storage};
  return pass({probe,storage,continueVisible,continueDisabled,warnings:cap.warnings});
}
async function A02(ctx){
  const created=await startCareerThroughUi(ctx.page,ctx.baseURL);
  if(!created.ok)return nonExecuted('A02 could not drive the real new-career UI',created);
  const first=await primarySummary(ctx.page);
  assert(first.checksumValid===true,'A02 primary checksum invalid after UI career creation',first);
  assert(first.slotCount===1,'A02 expected one active career slot after UI creation',first);

  const returned=await returnToMenuThroughUi(ctx.page);
  if(!returned.ok)return nonExecuted('A02 career created but return-to-menu UI could not be verified',{created,first,returned});

  const continueButton=ctx.page.locator('[data-action="menu-continue"]').first();
  assert(await continueButton.isVisible(),'A02 continue control missing after return to menu',{returned});
  await continueButton.click();
  await ctx.page.locator('.dashboard-hero').first().waitFor({state:'visible',timeout:20000});
  const second=await primarySummary(ctx.page);
  assert(second.checksumValid===true,'A02 checksum invalid after continue',second);
  assert(second.sha256===first.sha256,'A02 continue loaded a different career snapshot',{first,second});
  return pass({created,first,returned,second});
}
async function A03(ctx){
  await ensureCareer(ctx.page,'RST01 A03');
  const cap=attachErrorCapture(ctx.page);
  const pages=[];
  for(const id of navPagesCore){
    await navigateCore(ctx.page,id);
    const p=await uiProbe(ctx.page);
    pages.push({id,title:p.title,actions:p.actions.length,textLength:p.text.length});
  }
  if(cap.errors.length)return {state:'FAIL',reason:'Navigation emitted blocking errors',errors:cap.errors,pages};
  return pass({pages,warnings:cap.warnings});
}

async function A04(ctx){
  await ensureCareer(ctx.page,'RST01 A04');
  const switchTo=async(code)=>{
    await navigateCore(ctx.page,'settings');
    const all=ctx.page.locator('select[data-language-switch], select[id^="ui-language-"]');
    let select=null;
    for(let i=0;i<await all.count();i++){
      const candidate=all.nth(i);
      if(await candidate.isVisible().catch(()=>false)){select=candidate;break;}
    }
    if(!select)return false;
    const values=await select.locator('option').evaluateAll(opts=>opts.map(o=>o.value));
    if(!values.includes(code))return false;
    await select.selectOption(code);
    await ctx.page.waitForTimeout(250);
    return true;
  };
  const capture=async code=>{
    if(!(await switchTo(code)))return null;
    const pages=[];
    for(const id of ['dashboard','calendar','finance']){
      await navigateCore(ctx.page,id);
      pages.push({id,...await localeSnapshot(ctx.page)});
    }
    return {
      lang:(pages.find(x=>x.lang.startsWith(code))?.lang||pages[0]?.lang||''),
      text:pages.map(x=>x.text).join(' '),
      dates:pages.flatMap(x=>x.dates),
      currencies:pages.flatMap(x=>x.currencies),
      numbers:pages.flatMap(x=>x.numbers)
    };
  };
  const english=await capture('en');
  if(!english)return nonExecuted('Explicit EN locale select not found');
  const italian=await capture('it');
  if(!italian)return nonExecuted('Explicit IT locale select not found',{english});
  const textChanged=english.text!==italian.text;
  const langOk=/^en/.test(english.lang)&&/^it/.test(italian.lang);
  const formatEvidence=english.dates.length&&italian.dates.length&&english.currencies.length&&italian.currencies.length&&english.numbers.length&&italian.numbers.length;
  if(!textChanged||!langOk)return {state:'FAIL',reason:'IT/EN switch did not update visible language state',english,italian};
  if(!formatEvidence)return nonExecuted('Visible date/number/currency evidence incomplete for both locales',{english,italian});
  return pass({english:{lang:english.lang,dates:english.dates.slice(0,20),currencies:english.currencies.slice(0,20),numbers:english.numbers.slice(0,20)},italian:{lang:italian.lang,dates:italian.dates.slice(0,20),currencies:italian.currencies.slice(0,20),numbers:italian.numbers.slice(0,20)}});
}
async function B01(ctx){
  const made=await launchPersistent(ctx.browserName,{viewport:{width:1280,height:900},suffix:'b01'});
  let context=made.context;
  try{
    let page=context.pages()[0]||await context.newPage();
    await ensureCareer(page,'RST01 B01');
    const before=await primarySummary(page);
    assert(before.checksumValid===true,'B01 initial checksum invalid',before);
    await context.close();
    context=null;
    const reopened=await launchPersistent(ctx.browserName,{viewport:{width:1280,height:900},suffix:'b01-reopen'});
    // launchPersistent creates a new profile; use the original profile explicitly for persistence proof.
    await reopened.context.close();
    const exe=(await import('../lib/runtime.mjs')).executables[ctx.browserName];
    const {chromium}=await import('playwright-core');
    context=await chromium.launchPersistentContext(made.userData,{executablePath:exe,headless:true,viewport:{width:1280,height:900},args:['--no-first-run','--no-default-browser-check']});
    page=context.pages()[0]||await context.newPage();
    await page.goto(ctx.baseURL,{waitUntil:'domcontentloaded'});
    const after=await primarySummary(page);
    assert(after.checksumValid===true,'B01 reopened checksum invalid',after);
    assert(before.sha256===after.sha256,'B01 primary snapshot changed across browser restart',{before,after});
    return pass({before,after});
  }finally{
    await context?.close().catch(()=>{});
  }
}

async function B02(ctx){
  const made=await launchPersistent(ctx.browserName,{viewport:{width:1100,height:800},suffix:'b02'});
  try{
    const page=made.context.pages()[0]||await made.context.newPage();
    await page.goto(`${ctx.baseURL}/src/data.js`,{waitUntil:'domcontentloaded'});
    const result=await page.evaluate(async()=>{
      localStorage.clear();
      const [{makeWorld},{startCareer,simulateRound,validateSave},{createFreshCareerSlot},{readCareerCatalog},{saveCareerToSlot},{createCareerCheckpoint,listCareerCheckpoints,restoreCareerCheckpoint},{openPrimaryCareerStorage}]=await Promise.all([
        import('/src/data.js'),import('/src/engine.js'),import('/src/career-management.js'),import('/src/career-catalog.js'),import('/src/career-slots.js'),import('/src/career-checkpoints.js'),import('/src/primary-career-storage.js')
      ]);
      const primary=await openPrimaryCareerStorage({legacyStorage:localStorage,validate:validateSave});
      const w=makeWorld();startCareer(w,1,'RST01 B02');
      createFreshCareerSlot(primary.storage,w,validateSave);await primary.commit();
      const catalog=readCareerCatalog(primary.storage),slotId=catalog.activeSlotId,record=catalog.slots.find(x=>x.id===slotId);
      if(!slotId||!record)throw new Error('active slot missing');
      const checkpoint=createCareerCheckpoint(primary.storage,slotId,'before-match',validateSave);await primary.commit();
      const listed=listCareerCheckpoints(primary.storage,slotId,validateSave);
      const mutated=JSON.parse(primary.storage.getItem(record.storageKey)),beforeRound=mutated.round;
      simulateRound(mutated);saveCareerToSlot(primary.storage,mutated,validateSave);await primary.commit();
      const mutatedRound=JSON.parse(primary.storage.getItem(record.storageKey)).round;
      const restored=restoreCareerCheckpoint(primary.storage,slotId,checkpoint.key,validateSave);await primary.commit();
      const after=JSON.parse(primary.storage.getItem(record.storageKey));
      return {slotId,checkpoint,listed,beforeRound,mutatedRound,restoredRound:after.round,valid:validateSave(after),revision:primary.revision,restoreResult:restored};
    });
    assert(result.listed.some(x=>x.key===result.checkpoint.key&&x.status==='ok'),'B02 created checkpoint is not restorable',result);
    assert(result.mutatedRound>result.beforeRound,'B02 fixture mutation did not advance round',result);
    assert(result.restoredRound===result.beforeRound,'B02 restore did not return to checkpoint round',result);
    assert(result.valid===true,'B02 restored career invalid',result);
    return pass(result);
  }finally{await made.context.close().catch(()=>{});}
}
async function B03(ctx){
  const made=await launchPersistent(ctx.browserName,{viewport:{width:1280,height:900},suffix:'b03'});
  try{
    const page=made.context.pages()[0]||await made.context.newPage();
    await ensureCareer(page,'RST01 B03');await openCareers(page);
    const active=page.locator('.career-card.career-active'),exportButton=active.locator('[data-action="career-export"]').first();
    if(!(await exportButton.count()))return nonExecuted('Career export control not found');
    const exportPath=path.join(artifactDir,`rst01-b03-${ctx.browserName}.json`);
    const [download]=await Promise.all([page.waitForEvent('download'),exportButton.click()]);await download.saveAs(exportPath);
    const payload=JSON.parse(await fs.readFile(exportPath,'utf8')),before=await primarySummary(page);
    const input=page.locator('#career-import-file');
    if(!(await input.count()))return nonExecuted('Career import file control not found',{exportType:Array.isArray(payload)?'bundle':typeof payload});
    await input.setInputFiles(exportPath);
    const preview=page.locator('[data-dialog-kind="career-import-preview"]');await preview.waitFor({state:'visible',timeout:10000});
    const rows=await preview.locator('.career-import-row').count();if(rows<1)return {state:'FAIL',reason:'Import preview contains no rows',rows};
    const buttons=preview.locator('button:not([disabled]),[data-action]:not([disabled])');
    const confirms=await buttons.evaluateAll(els=>els.map((el,index)=>({index,action:el.getAttribute('data-action')||'',text:(el.textContent||'').trim()})).filter(x=>/import.*confirm|confirm.*import|career-import-confirm|importa|confirm|conferma/i.test(x.action+' '+x.text)));
    if(!confirms.length)return nonExecuted('Import preview opened but no deterministic import-confirm action was found',{rows});
    await buttons.nth(confirms[0].index).click();await preview.waitFor({state:'hidden',timeout:10000}).catch(()=>{});await page.waitForTimeout(500);
    const after=await primarySummary(page);
    const validation=await page.evaluate(async()=>{
      const {validateSave}=await import('/src/engine.js');
      const rec=await new Promise((resolve,reject)=>{const r=indexedDB.open('football-architect-primary-careers',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('snapshots','readonly'),q=tx.objectStore('snapshots').get('primary');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);};r.onerror=()=>reject(r.error);});
      const entries=new Map(JSON.parse(rec.raw));
      const slots=[...entries].filter(([key])=>/^football-architect:career:slot:/.test(key)).map(([key,raw])=>{try{const career=JSON.parse(raw);return {key,valid:validateSave(career),season:career.season,round:career.round};}catch(error){return {key,valid:false,error:String(error?.message||error)};}});
      return {slots,allValid:slots.length>0&&slots.every(x=>x.valid)};
    });
    assert(after.checksumValid===true&&validation.allValid===true,'B03 imported slot set failed validation',{before,after,validation});
    assert(after.slotCount>before.slotCount,'B03 import did not create/persist an additional slot',{before,after,validation});
    return pass({rows,exportType:Array.isArray(payload)?'bundle':typeof payload,before,after,validation});
  }finally{await made.context.close().catch(()=>{});}
}
async function B04(ctx){
  const made=await launchPersistent(ctx.browserName,{viewport:{width:1100,height:800},suffix:'b04'});
  try{
    const page=made.context.pages()[0]||await made.context.newPage();
    await page.goto(`${ctx.baseURL}/src/data.js`,{waitUntil:'domcontentloaded'});
    const result=await page.evaluate(async()=>{
      localStorage.clear();
      const [{makeWorld},{startCareer,simulateRound,validateSave},{createFreshCareerSlot},{readCareerCatalog},{saveCareerToSlot},{openPrimaryCareerStorage}]=await Promise.all([
        import('/src/data.js'),import('/src/engine.js'),import('/src/career-management.js'),import('/src/career-catalog.js'),import('/src/career-slots.js'),import('/src/primary-career-storage.js')
      ]);
      let record=null,failNext=false;
      const driver={read:async()=>record?structuredClone(record):null,compareAndPut:async(expectedRevision,next)=>{
        if((record?.revision??0)!==expectedRevision)throw Object.assign(new Error('simulated conflict'),{code:'primary_conflict'});
        if(failNext){failNext=false;throw Object.assign(new Error('simulated interrupted atomic commit'),{code:'simulated_interrupt'});}
        record=structuredClone(next);
      }};
      const primary=await openPrimaryCareerStorage({driver,legacyStorage:localStorage,validate:validateSave});
      const w=makeWorld();startCareer(w,1,'RST01 B04');createFreshCareerSlot(primary.storage,w,validateSave);await primary.commit();
      const committedBefore=structuredClone(record),catalog=readCareerCatalog(primary.storage),active=catalog.slots.find(x=>x.id===catalog.activeSlotId);
      const current=JSON.parse(primary.storage.getItem(active.storageKey)),beforeRound=current.round;
      simulateRound(current);saveCareerToSlot(primary.storage,current,validateSave);failNext=true;
      let interrupted=null;try{await primary.commit();}catch(error){interrupted={message:String(error?.message||error),code:error?.code||null};}
      const afterFailedCommit=structuredClone(record),reopened=await openPrimaryCareerStorage({driver,legacyStorage:localStorage,validate:validateSave});
      const rc=readCareerCatalog(reopened.storage),ra=rc.slots.find(x=>x.id===rc.activeSlotId),recovered=JSON.parse(reopened.storage.getItem(ra.storageKey));
      return {beforeRound,attemptedRound:current.round,recoveredRound:recovered.round,interrupted,previousPreserved:JSON.stringify(afterFailedCommit)===JSON.stringify(committedBefore),valid:validateSave(recovered),reopenedRevision:reopened.revision,committedRevision:committedBefore.revision};
    });
    assert(result.interrupted?.code==='simulated_interrupt','B04 simulated atomic interruption did not occur',result);
    assert(result.previousPreserved===true,'B04 interrupted commit modified the last committed primary record',result);
    assert(result.recoveredRound===result.beforeRound&&result.attemptedRound>result.beforeRound,'B04 did not recover the previous committed career',result);
    assert(result.valid===true&&result.reopenedRevision===result.committedRevision,'B04 reopened previous primary record is invalid',result);
    return pass(result);
  }finally{await made.context.close().catch(()=>{});}
}
async function B05(ctx){
  const made=await launchPersistent(ctx.browserName,{viewport:{width:1100,height:800},suffix:'b05'});
  try{
    const page=made.context.pages()[0]||await made.context.newPage();
    await page.goto(`${ctx.baseURL}/src/data.js`,{waitUntil:'domcontentloaded'});
    const result=await page.evaluate(async()=>{
      localStorage.clear();
      const [{makeWorld},{startCareer,simulateRound,validateSave},{createFreshCareerSlot},{openPrimaryCareerStorage}]=await Promise.all([
        import('/src/data.js'),
        import('/src/engine.js'),
        import('/src/career-management.js'),
        import('/src/primary-career-storage.js')
      ]);
      const primary=await openPrimaryCareerStorage({legacyStorage:localStorage,validate:validateSave});
      const a=makeWorld();startCareer(a,1,'RST01 Slot A');
      const b=makeWorld();startCareer(b,2,'RST01 Slot B');
      createFreshCareerSlot(primary.storage,a,validateSave);
      createFreshCareerSlot(primary.storage,b,validateSave);
      await primary.commit();

      const keys=[];for(let i=0;i<primary.storage.length;i++){
        const k=primary.storage.key(i);if(/^football-architect:career:slot:/.test(k))keys.push(k);
      }
      if(keys.length!==2)throw new Error('expected exactly two career slot keys');
      const entries=keys.map(k=>({key:k,raw:primary.storage.getItem(k),career:JSON.parse(primary.storage.getItem(k))}));
      const aEntry=entries.find(x=>JSON.stringify(x.career).includes('RST01 Slot A'))||entries[0];
      const bEntry=entries.find(x=>x.key!==aEntry.key);
      const bBefore=bEntry.raw;

      simulateRound(aEntry.career);
      if(!validateSave(aEntry.career))throw new Error('slot A invalid after isolated mutation');
      primary.storage.setItem(aEntry.key,JSON.stringify(aEntry.career));
      await primary.commit();

      const reopened=await openPrimaryCareerStorage({legacyStorage:localStorage,validate:validateSave});
      const aAfter=reopened.storage.getItem(aEntry.key);
      const bAfter=reopened.storage.getItem(bEntry.key);
      const aCareer=JSON.parse(aAfter),bCareer=JSON.parse(bAfter);
      return {
        keys,
        aChanged:aAfter!==aEntry.raw,
        bUnchanged:bAfter===bBefore,
        aValid:validateSave(aCareer),
        bValid:validateSave(bCareer),
        aRound:aCareer.round,
        bRound:bCareer.round,
        revision:reopened.revision
      };
    });
    assert(result.aChanged===true,'B05 slot A did not persist its isolated mutation',result);
    assert(result.bUnchanged===true,'B05 slot B changed while mutating slot A',result);
    assert(result.aValid===true&&result.bValid===true,'B05 one or both slots failed validation after reopen',result);
    return pass(result);
  }finally{await made.context.close().catch(()=>{});}
}
export const adapters={A01,A02,A03,A04,B01,B02,B03,B04,B05};
