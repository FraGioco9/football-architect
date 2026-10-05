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
    await buttons.nth(candidates[0].index).click().catch(()=>{});
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
  await page.waitForTimeout(300);
  const continueVisible=await page.locator('[data-action="menu-continue"]').first().isVisible().catch(()=>false);
  return {ok:continueVisible,chosen:found.rows[0],continueVisible};
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
    const controls=ctx.page.locator('button,[data-lang],[data-locale],[data-action]');
    const rows=await controls.evaluateAll((els,code)=>els.map((el,index)=>({
      index,
      text:(el.textContent||'').trim(),
      lang:(el.getAttribute('data-lang')||el.getAttribute('data-locale')||'').toLowerCase(),
      action:el.getAttribute('data-action')||'',
      visible:!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length)
    })).filter(x=>x.visible&&((x.lang===code)||new RegExp('^'+code+'$','i').test(x.text))),code);
    if(!rows.length)return false;
    await controls.nth(rows[0].index).click();
    await ctx.page.waitForTimeout(250);
    await navigateCore(ctx.page,'dashboard');
    return true;
  };

  if(!(await switchTo('en')))return nonExecuted('Explicit EN locale control not found');
  const english=await localeSnapshot(ctx.page);
  if(!(await switchTo('it')))return nonExecuted('Explicit IT locale control not found',{english});
  const italian=await localeSnapshot(ctx.page);

  const textChanged=english.text!==italian.text;
  const langOk=/^en/.test(english.lang)&&/^it/.test(italian.lang);
  const formatEvidence=english.dates.length&&italian.dates.length&&english.currencies.length&&italian.currencies.length&&english.numbers.length&&italian.numbers.length;
  if(!textChanged||!langOk)return {state:'FAIL',reason:'IT/EN switch did not update visible language state',english,italian};
  if(!formatEvidence)return nonExecuted('Visible date/number/currency evidence incomplete for both locales',{english,italian});
  return pass({english:{lang:english.lang,dates:english.dates,currencies:english.currencies,numbers:english.numbers},italian:{lang:italian.lang,dates:italian.dates,currencies:italian.currencies,numbers:italian.numbers}});
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
  await ensureCareer(ctx.page,'RST01 B02');
  await openCareers(ctx.page);
  const active=ctx.page.locator('.career-card.career-active');
  const button=active.locator('[data-action="career-checkpoints"]').first();
  if(!(await button.count()))return nonExecuted('Checkpoint control not found');
  await button.click();
  const dialog=ctx.page.locator('[data-dialog-kind="career-checkpoints"]');
  await dialog.waitFor({state:'visible',timeout:10000});
  const rows=await dialog.locator('.career-checkpoint-row').count();
  const restore=dialog.locator('[data-action="career-checkpoint-restore"]:not([disabled])').first();
  if(rows<1||!(await restore.count()))return nonExecuted('No restorable checkpoint',{rows});
  const before=await primarySummary(ctx.page);
  await restore.click();
  const confirm=ctx.page.locator('[data-dialog-kind="career-checkpoint-confirm"] [data-action="career-checkpoint-confirm"]').first();
  if(await confirm.count())await confirm.click();
  await ctx.page.waitForTimeout(400);
  const after=await primarySummary(ctx.page);
  assert(after.checksumValid===true,'B02 checksum invalid after checkpoint restore',after);
  return pass({rows,before,after});
}

async function B03(ctx){
  await ensureCareer(ctx.page,'RST01 B03');
  await openCareers(ctx.page);
  const active=ctx.page.locator('.career-card.career-active');
  const exportButton=active.locator('[data-action="career-export"]').first();
  if(!(await exportButton.count()))return nonExecuted('Career export control not found');
  const exportPath=path.join(artifactDir,`rst01-b03-${ctx.browserName}.json`);
  const [download]=await Promise.all([ctx.page.waitForEvent('download'),exportButton.click()]);
  await download.saveAs(exportPath);
  const payload=JSON.parse(await fs.readFile(exportPath,'utf8'));
  const before=await primarySummary(ctx.page);

  const input=ctx.page.locator('#career-import-file');
  if(!(await input.count()))return nonExecuted('Career import file control not found',{exportType:Array.isArray(payload)?'bundle':typeof payload});
  await input.setInputFiles(exportPath);
  const preview=ctx.page.locator('[data-dialog-kind="career-import-preview"]');
  await preview.waitFor({state:'visible',timeout:10000});
  const rows=await preview.locator('.career-import-row').count();
  if(rows<1)return {state:'FAIL',reason:'Import preview contains no rows',rows};

  const buttons=preview.locator('button:not([disabled]),[data-action]:not([disabled])');
  const confirms=await buttons.evaluateAll(els=>els.map((el,index)=>({
    index,action:el.getAttribute('data-action')||'',text:(el.textContent||'').trim()
  })).filter(x=>/import.*confirm|confirm.*import|career-import-confirm|importa|confirm|conferma/i.test(x.action+' '+x.text)));
  if(!confirms.length)return nonExecuted('Import preview opened but no deterministic import-confirm action was found',{rows});
  await buttons.nth(confirms[0].index).click();
  await preview.waitFor({state:'hidden',timeout:10000}).catch(()=>{});
  await ctx.page.waitForTimeout(500);

  const after=await primarySummary(ctx.page);
  const valid=await ctx.page.evaluate(async career=>{
    const {validateSave}=await import('/src/engine.js');
    return Boolean(career&&validateSave(career));
  },(await readPrimary(ctx.page)).career);
  assert(after.checksumValid===true&&valid===true,'B03 imported storage/save failed validation',{before,after,valid});
  const changed=before.sha256!==after.sha256||before.slotCount!==after.slotCount;
  if(!changed)return nonExecuted('Import completed but no persisted storage change was observable',{before,after,rows});
  return pass({rows,exportType:Array.isArray(payload)?'bundle':typeof payload,before,after,changed});
}
async function B04(ctx){
  const made=await launchPersistent(ctx.browserName,{viewport:{width:1100,height:800},suffix:'b04'});
  try{
    const page=made.context.pages()[0]||await made.context.newPage();
    await page.goto(`${ctx.baseURL}/src/data.js`,{waitUntil:'domcontentloaded'});
    const result=await page.evaluate(async()=>{
      localStorage.clear();
      const [{makeWorld},{startCareer,validateSave},{createFreshCareerSlot},{openPrimaryCareerStorage}]=await Promise.all([
        import('/src/data.js'),
        import('/src/engine.js'),
        import('/src/career-management.js'),
        import('/src/primary-career-storage.js')
      ]);
      const w=makeWorld();startCareer(w,1,'RST01 B04');
      createFreshCareerSlot(localStorage,w,validateSave);
      const first=await openPrimaryCareerStorage({legacyStorage:localStorage,validate:validateSave});
      await first.commit();

      const corrupted=await new Promise((resolve,reject)=>{
        const r=indexedDB.open('football-architect-primary-careers',1);
        r.onsuccess=()=>{
          const db=r.result,tx=db.transaction('snapshots','readwrite'),store=tx.objectStore('snapshots');
          const q=store.get('primary');
          q.onsuccess=()=>{
            const rec=q.result;
            if(!rec){reject(new Error('primary record missing'));return;}
            rec.sha256='0000000000000000000000000000000000000000000000000000000000000000';
            rec.raw=String(rec.raw||'').slice(0,Math.max(0,String(rec.raw||'').length-17));
            const put=store.put(rec);
            put.onsuccess=()=>resolve({rawLength:rec.raw.length,sha256:rec.sha256});
            put.onerror=()=>reject(put.error);
          };
          q.onerror=()=>reject(q.error);
        };
        r.onerror=()=>reject(r.error);
      });

      const recovered=await openPrimaryCareerStorage({legacyStorage:localStorage,validate:validateSave});
      const keys=[];for(let i=0;i<recovered.storage.length;i++)keys.push(recovered.storage.key(i));
      const slotKey=keys.find(k=>/^football-architect:career:slot:/.test(k));
      const career=slotKey?JSON.parse(recovered.storage.getItem(slotKey)):null;
      const valid=Boolean(career&&validateSave(career));
      const commit=await recovered.commit();
      return {corrupted,valid,recoveredFailed:String(recovered.failed||''),revision:recovered.revision,commit,slotKey};
    });
    assert(result.valid===true,'B04 did not recover a valid career from the surviving copy',result);
    assert(!result.recoveredFailed,'B04 primary recovery reported a persistent failure',result);
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
