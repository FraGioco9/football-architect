import {
  assert,attachErrorCapture,axeScan,geometry,launchPersistent,median,navigateCore,
  navPagesCore,openCareers,pass,nonExecuted,primarySummary,readPrimary,uiProbe
} from '../lib/runtime.mjs';
import {careerShape,referenceAudit} from '../lib/audit.mjs';
import {runCrossRolloverBehavior,runCrossInjuryTransferBehavior} from '../lib/behavioral-management-cross.mjs';

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

  // Structural accessibility belongs to the game page, before entering the separate career hub.
  const structuralRuleIds=new Set(['landmark-one-main','region','button-name','link-name','label','select-name','input-button-name','aria-command-name']);
  const structural=(await axeScan(ctx.page)).filter(v=>structuralRuleIds.has(v.id));
  const landmarks=await ctx.page.locator('main,[role="main"],nav,[role="navigation"]').count();

  await openCareers(ctx.page);
  const rename=ctx.page.locator('.career-card.career-active [data-action="career-rename"]').first();
  let modal={available:false};
  if(await rename.count()){
    await rename.click();
    const dialog=ctx.page.locator('[role="dialog"]').last();
    await dialog.waitFor({state:'visible',timeout:5000});
    modal={available:true,focusInside:await ctx.page.evaluate(()=>Boolean(document.activeElement?.closest?.('[role="dialog"]')))};
    await ctx.page.keyboard.press('Escape');
    modal.closed=(await ctx.page.locator('[role="dialog"]:visible').count())===0;
  }

  if(!focusInside||!focusReturned||(modal.available&&(!modal.focusInside||!modal.closed))){
    return {state:'FAIL',reason:'Keyboard/focus contract failed',focusInside,focusReturned,sequence,modal,landmarks,structural};
  }
  if(landmarks<2)return {state:'FAIL',reason:'Expected main/navigation landmarks were not both present',landmarks,structural};
  if(structural.length)return {state:'FAIL',reason:'Accessible landmark/control-name rules failed',landmarks,structural};
  return pass({focusInside,focusReturned,sequence,modal,landmarks,structuralViolations:0});
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
  await ctx.page.addInitScript(()=>{
    window.__rst01Perf={cls:0,lcp:null};
    try{new PerformanceObserver(list=>{for(const e of list.getEntries()){if(!e.hadRecentInput)window.__rst01Perf.cls+=e.value;}}).observe({type:'layout-shift',buffered:true});}catch{}
    try{new PerformanceObserver(list=>{for(const e of list.getEntries())window.__rst01Perf.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});}catch{}
  });
  const collect=async label=>{
    await ctx.page.waitForTimeout(900);
    return ctx.page.evaluate(label=>{
      const nav=performance.getEntriesByType('navigation')[0];
      return {label,load:nav?.loadEventEnd??null,lcp:window.__rst01Perf?.lcp??null,cls:window.__rst01Perf?.cls??null};
    },label);
  };
  const cdp=await ctx.context.newCDPSession(ctx.page);
  await cdp.send('Network.enable');
  await cdp.send('Performance.enable');
  const heapSample=async label=>{
    await cdp.send('HeapProfiler.collectGarbage').catch(()=>{});
    const snapshot=await cdp.send('Performance.getMetrics');
    const metric=name=>snapshot.metrics.find(x=>x.name===name)?.value??null;
    return {label,usedBytes:metric('JSHeapUsedSize'),totalBytes:metric('JSHeapTotalSize')};
  };

  const cold=[];
  for(let i=0;i<5;i++){
    await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
    await ctx.page.goto(ctx.baseURL,{waitUntil:'load'});
    if(i===0)await (await import('../lib/runtime.mjs')).ensureCareer(ctx.page,'RST01 H04');
    cold.push(await collect(`cold-${i+1}`));
  }
  await cdp.send('Network.setCacheDisabled',{cacheDisabled:false});
  const warm=[];
  for(let i=0;i<5;i++){await ctx.page.reload({waitUntil:'load'});warm.push(await collect(`warm-${i+1}`));}

  const memorySamples=[await heapSample('before-navigation')];
  const navigation=[];
  for(let round=0;round<2;round++){
    for(const id of navPagesCore){
      const t=performance.now();await navigateCore(ctx.page,id);navigation.push({round,id,ms:performance.now()-t});
    }
    memorySamples.push(await heapSample(`after-navigation-round-${round+1}`));
  }
  await navigateCore(ctx.page,'squad');
  const inputSamples=[];
  const search=ctx.page.locator('#squad-search');
  if(await search.count()){
    for(let i=0;i<5;i++){const t=performance.now();await search.fill(`RST${i}`);await ctx.page.waitForTimeout(100);inputSamples.push(performance.now()-t);}
  }
  memorySamples.push(await heapSample('after-input'));

  const usedMB=memorySamples.map(x=>Number.isFinite(x.usedBytes)?x.usedBytes/1048576:null).filter(Number.isFinite);
  const metrics={
    coldLoad:median(cold.map(x=>x.load)),
    warmLoad:median(warm.map(x=>x.load)),
    coldLcp:median(cold.map(x=>x.lcp)),
    warmLcp:median(warm.map(x=>x.lcp)),
    cls:median([...cold,...warm].map(x=>x.cls)),
    navigation:median(navigation.map(x=>x.ms)),
    input:median(inputSamples),
    heapMaxMB:usedMB.length?Math.max(...usedMB):null,
    heapGrowthMB:usedMB.length>=2?usedMB.at(-1)-usedMB[0]:null
  };
  const baseline={
    timingSource:'RST-00 Windows D02 certified evidence',
    coldLoad:274,warmLoad:275.1,coldLcp:368,warmLcp:380,cls:0,navigation:148.9,input:110.1,
    memorySource:'RST-01 conservative post-GC JS heap guardrail; RST-00 D02 did not record heap memory'
  };
  const thresholds={coldLoad:550,warmLoad:550,coldLcp:800,warmLcp:800,cls:0.10,navigation:320,input:250,heapMaxMB:256,heapGrowthMB:64};
  const required=['coldLoad','warmLoad','coldLcp','warmLcp','cls','navigation','input','heapMaxMB','heapGrowthMB'];
  if(required.some(k=>!Number.isFinite(metrics[k])))return nonExecuted('H04 required performance/memory matrix is incomplete',{metrics,baseline,thresholds,cold,warm,navigation,inputSamples,memorySamples});
  const exceeded=required.filter(k=>metrics[k]>thresholds[k]);
  if(exceeded.length)return {state:'FAIL',reason:'Performance or memory threshold exceeded',exceeded,metrics,baseline,thresholds,cold,warm,navigation,inputSamples,memorySamples};
  return pass({metrics,baseline,thresholds,cold,warm,navigation,inputSamples,memorySamples,note:'Timing limits derive from certified RST-00 medians; memory uses an explicit RST-01 post-GC guardrail because RST-00 did not capture heap metrics.'});
}
async function H05(ctx){
  const soak=ctx.shared.worldSoak;
  if(!soak)return nonExecuted('Ten-season soak evidence unavailable');
  assert(soak.cycles?.length===10,'H05 ten-season soak incomplete',soak);
  assert(soak.final?.uniquePlayers===soak.final?.playerCount,'H05 duplicate player IDs after soak',soak.final);
  if(soak.runtime?.errors?.length)return {state:'FAIL',reason:'Browser/page errors were captured during the ten-season soak',runtime:soak.runtime};
  if(!Number.isFinite(soak.runtime?.elapsedMs)||soak.runtime.elapsedMs<=0)return nonExecuted('Soak runtime/termination evidence missing',{runtime:soak.runtime});
  return pass({cycles:soak.cycles.length,final:soak.final,playerChurn:soak.playerChurn,runtime:soak.runtime});
}
async function I01(ctx){
  const result=await runCrossRolloverBehavior(ctx.page,ctx.baseURL);
  if(result?.ok)return pass(result);
  const reason=String(result?.reason||'I01 cross-rollover driver failed');
  if(/^no |insufficient/i.test(reason))return nonExecuted(reason,result||{});
  return {state:'FAIL',reason,details:result||{}};
}
async function I02(ctx){
  const soak=ctx.shared.worldSoak;
  if(!soak)return nonExecuted('World soak unavailable for I02');
  const firstTwo=soak.cycles.slice(0,2);
  const leagueOk=firstTwo.length===2&&firstTwo.every(row=>Object.values(row.countries).every(x=>x.promoted.length===3&&x.relegated.length===3&&x.playoffWinner!=null));
  assert(leagueOk,'I02 league/division rollover invalid',firstTwo);

  const national=firstTwo.map(row=>({
    cycle:row.cycle,
    countries:Object.fromEntries(Object.entries(row.countries).map(([country,x])=>[country,{
      champion:x.cupChampionId,
      rounds:x.cupRounds,
      honours:x.cupHonours,
      valid:x.cupChampionId!=null&&x.cupRounds>0&&x.cupHonours===row.cycle
    }]))
  }));
  const nationalOk=national.every(row=>Object.values(row.countries).every(x=>x.valid));
  assert(nationalOk,'I02 national cup/league cycle coherence invalid',national);

  const second=firstTwo[1];
  const continental={
    champion:second?.continentalEnd?.championKey??null,
    entrants:second?.continentalEnd?.entrants??0,
    groupRounds:second?.continentalEnd?.groupRounds??0,
    knockoutRounds:second?.continentalEnd?.knockoutRounds??0,
    honours:second?.continentalHonours??0
  };
  if(!continental.champion||continental.entrants!==32||continental.groupRounds<1||continental.knockoutRounds<1||continental.honours!==1){
    return {state:'FAIL',reason:'I02 continental competition is not coherent with the second league rollover',details:{continental,firstTwo}};
  }
  return pass({cycles:[1,2],movementCountries:8,national,continental});
}
async function I03(ctx){
  const result=await runCrossInjuryTransferBehavior(ctx.page,ctx.baseURL);
  if(result?.ok)return pass(result);
  const reason=String(result?.reason||'I03 cross-domain driver failed');
  if(/^no |insufficient/i.test(reason))return nonExecuted(reason,result||{});
  return {state:'FAIL',reason,details:result||{}};
}
async function I04(ctx){
  const made=await launchPersistent(ctx.browserName,{viewport:{width:1200,height:800},suffix:'i04'});
  try{
    const page=made.context.pages()[0]||await made.context.newPage();
    await page.goto(`${ctx.baseURL}/src/data.js`,{waitUntil:'domcontentloaded'});
    const mid=await page.evaluate(async()=>{
      localStorage.clear();
      const [{makeWorld},{startCareer,simulateRound,validateSave},{createFreshCareerSlot},{openPrimaryCareerStorage}]=await Promise.all([
        import('/src/data.js'),import('/src/engine.js'),import('/src/career-management.js'),import('/src/primary-career-storage.js')
      ]);
      const w=makeWorld();startCareer(w,1,'RST01 I04');
      const primary=await openPrimaryCareerStorage({legacyStorage:localStorage,validate:validateSave});
      createFreshCareerSlot(primary.storage,w,validateSave);
      const target=w.fixtures.length,midRound=Math.max(1,Math.floor(target/2));
      while(w.round<midRound)simulateRound(w);
      primary.storage.clear();createFreshCareerSlot(primary.storage,w,validateSave);
      await primary.commit();
      return {target,midRound,valid:validateSave(w)};
    });
    assert(mid.valid===true,'I04 mid-season source save invalid',mid);

    await page.reload({waitUntil:'domcontentloaded'});
    const boundary=await page.evaluate(async expected=>{
      const [{simulateRound,validateSave},{openPrimaryCareerStorage}]=await Promise.all([
        import('/src/engine.js'),import('/src/primary-career-storage.js')
      ]);
      const primary=await openPrimaryCareerStorage({legacyStorage:localStorage,validate:validateSave});
      const keys=[];for(let i=0;i<primary.storage.length;i++){const k=primary.storage.key(i);if(/^football-architect:career:slot:/.test(k))keys.push(k);}
      if(keys.length!==1)throw new Error('expected one career slot after mid-season reload');
      const key=keys[0],career=JSON.parse(primary.storage.getItem(key));
      if(!validateSave(career)||career.round!==expected.midRound)throw new Error('mid-season load mismatch');
      while(career.round<Math.max(expected.midRound,expected.target-1))simulateRound(career);
      if(!validateSave(career))throw new Error('boundary save invalid before commit');
      primary.storage.setItem(key,JSON.stringify(career));
      await primary.commit();
      return {key,boundaryRound:career.round,valid:true};
    },mid);

    await page.reload({waitUntil:'domcontentloaded'});
    const loaded=await page.evaluate(async expected=>{
      const {validateSave}=await import('/src/engine.js');
      const rec=await new Promise((resolve,reject)=>{
        const r=indexedDB.open('football-architect-primary-careers',1);
        r.onsuccess=()=>{const db=r.result,tx=db.transaction('snapshots','readonly'),q=tx.objectStore('snapshots').get('primary');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);};
        r.onerror=()=>reject(r.error);
      });
      const rows=JSON.parse(rec.raw),entries=new Map(rows),slot=[...entries].find(([k])=>/^football-architect:career:slot:/.test(k));
      const career=JSON.parse(slot[1]);
      return {round:career.round,valid:validateSave(career),sha256:rec.sha256,rawLength:rec.raw.length,expected:expected.boundaryRound};
    },boundary);
    assert(loaded.valid===true&&loaded.round===boundary.boundaryRound,'I04 boundary reload mismatch',{mid,boundary,loaded});
    return pass({mid,boundary,loaded});
  }finally{await made.context.close().catch(()=>{});}
}
async function I05(ctx){
  const made=await launchPersistent(ctx.browserName,{viewport:{width:390,height:844},suffix:'i05'});
  try{
    const page=made.context.pages()[0]||await made.context.newPage();
    await (await import('../lib/runtime.mjs')).ensureCareer(page,'RST01 I05');
    const advanced=await page.evaluate(async()=>{
      const [{validateSave},{openPrimaryCareerStorage},advancedCareer]=await Promise.all([
        import('/src/engine.js'),import('/src/primary-career-storage.js'),import('/src/domain/advanced-career.js')
      ]);
      const primary=await openPrimaryCareerStorage({legacyStorage:localStorage,validate:validateSave});
      const keys=[];for(let i=0;i<primary.storage.length;i++){const k=primary.storage.key(i);if(/^football-architect:career:slot:/.test(k))keys.push(k);}
      if(keys.length!==1)return {ok:false,reason:'isolated I05 profile did not contain exactly one slot',keys};
      const key=keys[0],career=JSON.parse(primary.storage.getItem(key));
      const enable=advancedCareer.enableAdvancedCareer||Object.entries(advancedCareer).find(([name,value])=>/^enable/i.test(name)&&typeof value==='function')?.[1];
      if(!career.advancedV1&&typeof enable==='function'){enable(career);primary.storage.setItem(key,JSON.stringify(career));await primary.commit();}
      return {ok:Boolean(career.advancedV1),valid:validateSave(career)};
    });
    if(!advanced.ok||!advanced.valid)return nonExecuted('Could not establish a valid isolated advanced career before I05',advanced);

    const dashboard=page.locator('.dashboard-hero').first();
    if(!(await dashboard.isVisible().catch(()=>false))){
      return nonExecuted('I05 isolated career dashboard was no longer visible after primary advanced-state update',{advanced});
    }
    const before=await primarySummary(page);
    const switchLanguage=async code=>{
      await navigateCore(page,'settings');
      const all=page.locator('select[data-language-switch], select[id^="ui-language-"]');
      let select=null;
      for(let i=0;i<await all.count();i++){const c=all.nth(i);if(await c.isVisible().catch(()=>false)){select=c;break;}}
      if(!select)return false;
      await select.selectOption(code);await page.waitForTimeout(150);return true;
    };
    if(!(await switchLanguage('en')))return nonExecuted('I05 EN language select unavailable',{advanced});
    const enText=(await uiProbe(page)).text;
    if(!(await switchLanguage('it')))return nonExecuted('I05 IT language select unavailable',{advanced});
    const itText=(await uiProbe(page)).text;
    if(enText===itText)return {state:'FAIL',reason:'I05 language switch did not change visible text',advanced};

    await navigateCore(page,'dashboard');
    const mobile=await geometry(page);
    await page.setViewportSize({width:1440,height:900});
    await navigateCore(page,'dashboard');
    const desktop=await geometry(page);
    const after=await primarySummary(page);
    assert(after.checksumValid===true,'I05 primary checksum invalid after language/viewport changes',{before,after,mobile,desktop});
    assert(before.sha256===after.sha256,'I05 UI-only language/viewport changes mutated advanced career snapshot',{before,after,mobile,desktop});
    if(mobile.sw>mobile.cw+2||desktop.sw>desktop.cw+2)return {state:'FAIL',reason:'I05 viewport switch introduced horizontal overflow',mobile,desktop};
    return pass({advanced,mobile,desktop,before,after,languageChanged:true});
  }finally{await made.context.close().catch(()=>{});}
}
export const adapters={H01,H02,H03,H04,H05,I01,I02,I03,I04,I05};
