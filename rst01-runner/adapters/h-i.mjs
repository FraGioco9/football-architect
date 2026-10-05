import {
  assert,attachErrorCapture,axeScan,geometry,launchPersistent,median,navigateCore,
  navPagesCore,openCareers,pass,nonExecuted,primarySummary,readPrimary,uiProbe
} from '../lib/runtime.mjs';
import {careerShape,referenceAudit} from '../lib/audit.mjs';

async function H01(ctx){
  await (await import('../lib/runtime.mjs')).ensureCareer(ctx.page,'RST01 H01');
  const viewports=[
    {name:'desktop',width:1440,height:900},
    {name:'tablet',width:1024,height:768},
    {name:'mobile',width:390,height:844}
  ];
  const rows=[];
  for(const viewport of viewports){
    await ctx.page.setViewportSize({width:viewport.width,height:viewport.height});
    for(const id of navPagesCore){
      await navigateCore(ctx.page,id);
      const g=await geometry(ctx.page);
      rows.push({viewport:viewport.name,id,...g,overflow:g.sw>g.cw+2});
    }
  }
  const bad=rows.filter(x=>x.overflow);
  if(bad.length)return {state:'FAIL',reason:'Critical horizontal overflow detected',bad,rows};
  return pass({rows});
}

async function H02(ctx){
  await (await import('../lib/runtime.mjs')).ensureCareer(ctx.page,'RST01 H02');
  await ctx.page.setViewportSize({width:390,height:844});
  const trigger=ctx.page.locator('[data-action="toggle-sidebar"]').first();
  if(!(await trigger.count()))return nonExecuted('Sidebar keyboard target unavailable');
  await trigger.click();
  const sequence=[];
  for(let i=0;i<18;i++){
    await ctx.page.keyboard.press('Tab');
    sequence.push(await ctx.page.evaluate(()=>({
      tag:document.activeElement?.tagName||'',
      action:document.activeElement?.getAttribute?.('data-action')||'',
      insideSidebar:Boolean(document.activeElement?.closest?.('#club-sidebar'))
    })));
  }
  const focusInside=sequence.some(x=>x.insideSidebar);
  await ctx.page.keyboard.press('Escape');
  const focusReturned=await ctx.page.evaluate(()=>document.activeElement?.matches?.('[data-action="toggle-sidebar"]')||false);
  await openCareers(ctx.page);
  const rename=ctx.page.locator('.career-card.career-active [data-action="career-rename"]').first();
  let modal={available:false};
  if(await rename.count()){
    await rename.click();
    const dialog=ctx.page.locator('[role="dialog"]').last();
    await dialog.waitFor({state:'visible',timeout:5000});
    modal={
      available:true,
      focusInside:await ctx.page.evaluate(()=>Boolean(document.activeElement?.closest?.('[role="dialog"]')))
    };
    await ctx.page.keyboard.press('Escape');
    modal.closed=(await ctx.page.locator('[role="dialog"]:visible').count())===0;
  }
  if(!focusInside||!focusReturned||(modal.available&&(!modal.focusInside||!modal.closed))){
    return {state:'FAIL',reason:'Keyboard/focus contract failed',focusInside,focusReturned,sequence,modal};
  }
  return pass({focusInside,focusReturned,sequence,modal});
}

async function H03(ctx){
  await (await import('../lib/runtime.mjs')).ensureCareer(ctx.page,'RST01 H03');
  const scans=[];
  for(const id of navPagesCore){
    await navigateCore(ctx.page,id);
    scans.push({id,violations:await axeScan(ctx.page)});
  }
  const critical=scans.flatMap(x=>x.violations.map(v=>({...v,page:x.id}))).filter(v=>v.impact==='critical');
  const serious=scans.flatMap(x=>x.violations.map(v=>({...v,page:x.id}))).filter(v=>v.impact==='serious');
  if(critical.length)return {state:'FAIL',reason:'Critical axe violations detected',critical,seriousCount:serious.length,scans};
  return pass({critical:0,seriousCount:serious.length,scans,note:'Serious/non-critical findings are retained as baseline evidence and are not silently discarded.'});
}

async function H04(ctx){
  await (await import('../lib/runtime.mjs')).ensureCareer(ctx.page,'RST01 H04');
  const samples={cold:[],warm:[],navigation:[],memory:[]};
  for(let i=0;i<3;i++){
    const t=performance.now();
    await ctx.page.goto(ctx.baseURL,{waitUntil:'load'});
    samples.cold.push(performance.now()-t);
  }
  for(let i=0;i<3;i++){
    const t=performance.now();
    await ctx.page.reload({waitUntil:'load'});
    samples.warm.push(performance.now()-t);
  }
  await (await import('../lib/runtime.mjs')).ensureCareer(ctx.page,'RST01 H04');
  for(const id of navPagesCore){
    const t=performance.now();
    await navigateCore(ctx.page,id);
    samples.navigation.push({id,ms:performance.now()-t});
    samples.memory.push(await ctx.page.evaluate(()=>performance.memory?({
      used:performance.memory.usedJSHeapSize,
      total:performance.memory.totalJSHeapSize,
      limit:performance.memory.jsHeapSizeLimit
    }):null));
  }
  const metrics={
    coldMedian:median(samples.cold),
    warmMedian:median(samples.warm),
    navMedian:median(samples.navigation.map(x=>x.ms)),
    memoryAvailable:samples.memory.some(Boolean)
  };
  if(!Number.isFinite(metrics.coldMedian)||!Number.isFinite(metrics.warmMedian)||!Number.isFinite(metrics.navMedian))return nonExecuted('Performance matrix incomplete',{samples,metrics});
  return pass({samples,metrics});
}

async function H05(ctx){
  const soak=ctx.shared.worldSoak;
  if(!soak)return nonExecuted('Ten-season soak evidence unavailable');
  assert(soak.cycles?.length===10,'H05 ten-season soak incomplete',soak);
  assert(soak.final?.uniquePlayers===soak.final?.playerCount,'H05 duplicate player IDs after soak',soak.final);
  return pass({cycles:soak.cycles.length,final:soak.final,playerChurn:soak.playerChurn});
}

async function I01(ctx){
  const p=await readPrimary(ctx.page);
  if(!p.career)return nonExecuted('No career available for I01');
  const result=await ctx.page.evaluate(async career=>{
    const {simulateRound,newSeason,validateSave}=await import('/src/engine.js');
    const footprint=root=>{
      const out={contract:0,market:0,finance:0};const seen=new WeakSet();
      const walk=(v,d=0)=>{if(!v||typeof v!=='object'||d>7||seen.has(v))return;seen.add(v);for(const [k,x] of Object.entries(v)){if(/contract|wage|salary|expiry/i.test(k))out.contract++;if(/transfer|market|loan|shortlist|scout/i.test(k))out.market++;if(/budget|balance|cash|revenue|expense/i.test(k))out.finance++;if(x&&typeof x==='object')walk(x,d+1);}};
      walk(root);return out;
    };
    const rows=[];
    for(let cycle=1;cycle<=2;cycle++){
      const target=career.fixtures?.length||0;
      while(career.round<target)simulateRound(career);
      newSeason(career);
      rows.push({cycle,valid:validateSave(career),season:career.season,footprint:footprint(career)});
    }
    return rows;
  },p.career);
  assert(result.every(x=>x.valid),'I01 save invalid after cross-domain rollover',result);
  if(result.some(x=>x.footprint.contract===0||x.footprint.market===0||x.footprint.finance===0))return nonExecuted('Cross-domain contract/market/finance footprint incomplete',{result});
  return pass({result});
}

async function I02(ctx){
  const soak=ctx.shared.worldSoak;
  if(!soak)return nonExecuted('World soak unavailable for I02');
  const firstTwo=soak.cycles.slice(0,2);
  const leagueOk=firstTwo.length===2&&firstTwo.every(row=>Object.values(row.countries).every(x=>x.promoted.length===3&&x.relegated.length===3));
  assert(leagueOk,'I02 league/division rollover invalid',firstTwo);
  const cups=firstTwo.map(x=>x.cupFootprint.length);
  if(!cups.some(n=>n>0))return nonExecuted('Domestic/continental cup footprint unavailable during same rollover cycles',{cups});
  return pass({cycles:firstTwo.map(x=>x.cycle),cupFootprint:cups});
}

async function I03(ctx){
  const p=await readPrimary(ctx.page);
  if(!p.career)return nonExecuted('No career available for I03');
  const shape=await careerShape(ctx.page);
  const result=await ctx.page.evaluate(async career=>{
    const {simulateRound,validateSave}=await import('/src/engine.js');
    for(let i=0;i<Math.min(12,Math.max(1,(career.fixtures?.length||1)-career.round));i++)simulateRound(career);
    return {valid:validateSave(career)};
  },p.career);
  assert(result.valid===true,'I03 simulated cross-domain state invalidated save',result);
  const required={
    injury:shape.injury.length,
    contract:shape.contract.length,
    market:shape.market.length
  };
  if(Object.values(required).some(n=>n===0))return nonExecuted('I03 cross-domain state footprint incomplete',{required});
  const ref=await referenceAudit(ctx.page);
  assert(ref.duplicateClubIds===0&&ref.duplicatePlayerIds===0,'I03 reference integrity failed',ref);
  return pass({required,referenceAudit:ref});
}

async function I04(ctx){
  const made=await launchPersistent(ctx.browserName,{viewport:{width:1200,height:800},suffix:'i04'});
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
      const w=makeWorld();startCareer(w,1,'RST01 I04');
      const primary=await openPrimaryCareerStorage({legacyStorage:localStorage,validate:validateSave});
      createFreshCareerSlot(primary.storage,w,validateSave);
      const target=w.fixtures.length;
      const mid=Math.max(1,Math.floor(target/2));
      while(w.round<mid)simulateRound(w);
      primary.storage.clear();
      createFreshCareerSlot(primary.storage,w,validateSave);
      const midCommit=await primary.commit();
      const midRound=w.round;
      while(w.round<Math.max(midRound,target-1))simulateRound(w);
      primary.storage.clear();
      createFreshCareerSlot(primary.storage,w,validateSave);
      const boundaryCommit=await primary.commit();
      return {valid:validateSave(w),midRound,boundaryRound:w.round,target,midCommit,boundaryCommit,revision:primary.revision,failed:String(primary.failed||'')};
    });
    assert(result.valid===true,'I04 boundary saves invalid',result);
    assert(result.midCommit.changed===true&&result.boundaryCommit.changed===true,'I04 primary commits did not persist both boundaries',result);
    return pass(result);
  }finally{await made.context.close().catch(()=>{});}
}

async function I05(ctx){
  await (await import('../lib/runtime.mjs')).ensureCareer(ctx.page,'RST01 I05');
  const before=await primarySummary(ctx.page);
  await ctx.page.setViewportSize({width:390,height:844});
  await navigateCore(ctx.page,'settings');
  const controls=await ctx.page.evaluate(()=>[...document.querySelectorAll('button,[data-lang],[data-locale]')].map((el,index)=>({
    index,text:(el.textContent||'').trim(),lang:el.getAttribute('data-lang')||el.getAttribute('data-locale')||'',
    visible:!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length)
  })).filter(x=>x.visible&&(/^(IT|EN)$/i.test(x.text)||/^(it|en)$/i.test(x.lang))));
  if(controls.length>=2){
    const loc=ctx.page.locator('button,[data-lang],[data-locale]');
    await loc.nth(controls[0].index).click().catch(()=>{});
    await ctx.page.waitForTimeout(100);
    await loc.nth(controls[1].index).click().catch(()=>{});
  }
  await ctx.page.setViewportSize({width:1440,height:900});
  await navigateCore(ctx.page,'dashboard');
  const after=await primarySummary(ctx.page);
  const g=await geometry(ctx.page);
  assert(after.checksumValid===true,'I05 primary checksum invalid after language/viewport changes',{before,after,controls,g});
  assert(before.sha256===after.sha256,'I05 UI-only language/viewport changes mutated career snapshot',{before,after,controls,g});
  if(controls.length<2)return nonExecuted('IT/EN controls unavailable for I05',{before,after,controls,g});
  return pass({before,after,controls,g});
}

export const adapters={H01,H02,H03,H04,H05,I01,I02,I03,I04,I05};
