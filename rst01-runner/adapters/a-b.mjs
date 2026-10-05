import fs from 'node:fs/promises';
import path from 'node:path';
import {
  artifactDir,assert,attachErrorCapture,ensureCareer,launchPersistent,navigateCore,
  navPagesCore,openCareers,pass,nonExecuted,primarySummary,readPrimary,uiProbe
} from '../lib/runtime.mjs';

async function A01(ctx){
  const cap=attachErrorCapture(ctx.page);
  await ctx.page.goto(ctx.baseURL,{waitUntil:'domcontentloaded'});
  await ctx.page.waitForTimeout(250);
  const probe=await uiProbe(ctx.page);
  const bodyText=(probe.text||'').trim();
  if(!bodyText)return nonExecuted('Empty first paint',{probe});
  if(cap.errors.length)return {state:'FAIL',reason:'Blocking console/page errors on first paint',errors:cap.errors,probe};
  return pass({probe,warnings:cap.warnings});
}

async function A02(ctx){
  const seeded=await ensureCareer(ctx.page,'RST01 A02');
  const first=await primarySummary(ctx.page);
  assert(first.checksumValid===true,'A02 primary checksum invalid',first);
  assert(first.slotCount===1,'A02 expected one active career slot',first);
  await ctx.page.reload({waitUntil:'domcontentloaded'});
  await ctx.page.waitForTimeout(200);
  const dashboard=await ctx.page.locator('.dashboard-hero').first().isVisible().catch(()=>false);
  const continueVisible=await ctx.page.locator('[data-action="menu-continue"]').first().isVisible().catch(()=>false);
  if(!dashboard&&continueVisible){
    await ctx.page.locator('[data-action="menu-continue"]').first().click();
    await ctx.page.locator('.dashboard-hero').first().waitFor({state:'visible',timeout:20000});
  }
  const second=await primarySummary(ctx.page);
  assert(second.checksumValid===true,'A02 checksum invalid after reload',second);
  return pass({seeded,first,second});
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
  await navigateCore(ctx.page,'settings');
  const candidates=await ctx.page.evaluate(()=>[...document.querySelectorAll('button,[data-lang],[data-locale],[data-action]')].map((el,index)=>({
    index,
    text:(el.textContent||'').trim(),
    lang:el.getAttribute('data-lang')||el.getAttribute('data-locale')||'',
    action:el.getAttribute('data-action')||'',
    visible:!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length)
  })).filter(x=>x.visible&&(/^(IT|EN)$/i.test(x.text)||/^(it|en)$/i.test(x.lang)||/lang|locale/i.test(x.action))));
  const it=candidates.find(x=>/^it$/i.test(x.text)||/^it$/i.test(x.lang));
  const en=candidates.find(x=>/^en$/i.test(x.text)||/^en$/i.test(x.lang));
  if(!it||!en)return nonExecuted('Explicit IT/EN controls not found',{candidates});
  const clickable=ctx.page.locator('button,[data-lang],[data-locale],[data-action]');
  const before=await uiProbe(ctx.page);
  await clickable.nth(en.index).click();
  await ctx.page.waitForTimeout(250);
  const english=await uiProbe(ctx.page);
  await clickable.nth(it.index).click();
  await ctx.page.waitForTimeout(250);
  const italian=await uiProbe(ctx.page);
  const changed=english.text!==italian.text||english.lang!==italian.lang;
  if(!changed)return {state:'FAIL',reason:'IT/EN controls did not change locale-visible state',{before,english,italian,candidates}};
  return pass({before:{lang:before.lang},english:{lang:english.lang,text:english.text.slice(0,500)},italian:{lang:italian.lang,text:italian.text.slice(0,500)}});
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
  const input=ctx.page.locator('#career-import-file');
  if(!(await input.count()))return nonExecuted('Career import file control not found',{exportType:Array.isArray(payload)?'bundle':typeof payload});
  await input.setInputFiles(exportPath);
  const preview=ctx.page.locator('[data-dialog-kind="career-import-preview"]');
  await preview.waitFor({state:'visible',timeout:10000});
  const rows=await preview.locator('.career-import-row').count();
  if(rows<1)return {state:'FAIL',reason:'Import preview contains no rows',{rows}};
  return pass({rows,exportType:Array.isArray(payload)?'bundle':typeof payload});
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
      const primary=await openPrimaryCareerStorage({legacyStorage:localStorage,validate:validateSave});
      createFreshCareerSlot(primary.storage,w,validateSave);
      const first=await primary.commit();
      const snap=primary.snapshot();
      const keys=[];for(let i=0;i<primary.storage.length;i++)keys.push(primary.storage.key(i));
      const slotKey=keys.find(k=>/^football-architect:career:slot:/.test(k));
      if(!slotKey)throw new Error('No career slot after initial commit');
      primary.storage.setItem(slotKey,'{"corrupt":true}');
      let corruptCommitError=null;
      try{await primary.commit();}catch(e){corruptCommitError=String(e?.message||e);}
      await primary.rollback(snap);
      const restored=JSON.parse(primary.storage.getItem(slotKey));
      return {first,corruptCommitError,restoredValid:validateSave(restored),revision:primary.revision,failed:String(primary.failed||'')};
    });
    assert(result.restoredValid===true,'B04 rollback did not restore a valid save',result);
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
      const [{makeWorld},{startCareer,validateSave},{createFreshCareerSlot,listCareerSlots}]=await Promise.all([
        import('/src/data.js'),
        import('/src/engine.js'),
        import('/src/career-management.js')
      ]);
      const a=makeWorld();startCareer(a,1,'RST01 Slot A');
      const b=makeWorld();startCareer(b,2,'RST01 Slot B');
      const sa=createFreshCareerSlot(localStorage,a,validateSave);
      const sb=createFreshCareerSlot(localStorage,b,validateSave);
      const slots=listCareerSlots(localStorage);
      return {
        a:sa.entry?.id,
        b:sb.entry?.id,
        slots:slots.map(x=>({id:x.id,name:x.name||x.managerName||'',clubId:x.clubId})),
        keys:Object.keys(localStorage)
      };
    });
    assert(result.a&&result.b&&result.a!==result.b,'B05 slot ids are not distinct',result);
    assert(result.slots.length>=2,'B05 expected at least two slots',result);
    return pass(result);
  }finally{await made.context.close().catch(()=>{});}
}

export const adapters={A01,A02,A03,A04,B01,B02,B03,B04,B05};
