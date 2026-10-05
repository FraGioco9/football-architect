import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const baseURL=process.env.FA_BASE_URL||'http://127.0.0.1:2000';
const artifactDir=process.env.FA_ARTIFACT_DIR||path.resolve('artifacts');
await fs.mkdir(artifactDir,{recursive:true});

const candidates={
  chrome:['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'],
  edge:['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe']
};
const existing=arr=>arr.find(p=>fssync.existsSync(p));
const executables={chrome:existing(candidates.chrome),edge:existing(candidates.edge)};
const report={startedAt:new Date().toISOString(),checks:{},browsers:{},release:'2.0.0'};

function assert(ok,message,details){if(!ok){const e=new Error(message);e.details=details;throw e;}}
async function launch(browserName,userData){
  const exe=executables[browserName];
  if(!exe)throw new Error(`${browserName} executable unavailable`);
  const context=await chromium.launchPersistentContext(userData,{executablePath:exe,headless:true,viewport:{width:1440,height:900},acceptDownloads:true,args:['--no-first-run','--no-default-browser-check']});
  context.setDefaultTimeout(10000);
  context.setDefaultNavigationTimeout(45000);
  return context;
}
async function deletePrimary(page){
  await page.evaluate(()=>new Promise((resolve,reject)=>{
    const req=indexedDB.deleteDatabase('football-architect-primary-careers');
    req.onsuccess=()=>resolve(true);
    req.onerror=()=>reject(req.error||new Error('primary IndexedDB delete failed'));
    req.onblocked=()=>reject(new Error('primary IndexedDB delete blocked'));
  }));
}
async function readPrimary(page){
  return page.evaluate(async()=>{
    const rec=await new Promise((resolve,reject)=>{
      const r=indexedDB.open('football-architect-primary-careers',1);
      r.onsuccess=()=>{
        const db=r.result,tx=db.transaction('snapshots','readonly'),q=tx.objectStore('snapshots').get('primary');
        q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);
      };
      r.onerror=()=>reject(r.error);
    });
    if(!rec?.raw)return {rawLength:0};
    const career=JSON.parse(rec.raw);
    const [{validateSave},{validateCareerDivisions,divisionArchive}]=await Promise.all([
      import('/src/engine.js'),
      import('/src/domain/career-divisions.js')
    ]);
    const history=Object.fromEntries(Object.keys(career.advancedV1?.divisionsV1?.countries||{}).map(country=>[country,divisionArchive(career,country).length]));
    return {
      rawLength:rec.raw.length,
      schemaVersion:rec.schemaVersion,
      revision:rec.revision,
      sha256:rec.sha256,
      season:career.season,
      round:career.round,
      clubId:career.clubId,
      managedTier:career.advancedV1?.divisionsV1?.managedTier,
      movements:career.advancedV1?.divisionsV1?.movements?.length||0,
      history,
      saveValid:validateSave(career),
      divisionsValid:validateCareerDivisions(career)
    };
  });
}

async function exercise(browserName){
  const userData=await fs.mkdtemp(path.join(os.tmpdir(),`fa-wrd0205-${browserName}-`));
  let context;
  try{
    context=await launch(browserName,userData);
    const page=context.pages()[0]||await context.newPage();
    await page.goto(baseURL,{waitUntil:'domcontentloaded'});

    const memory=await page.evaluate(async()=>{
      localStorage.clear();
      const [
        {makeWorld},
        {startCareer,simulateRound,newSeason,validateSave,autoLineup},
        {enableCareerWorld,careerWorldLeague,OFFICIAL_WORLD_COUNTRIES,validateCareerWorld},
        {enableCareerDivisions,captureDivisionSeason,divisionLeague,divisionArchive,validateCareerDivisions},
        {createFreshCareerSlot}
      ]=await Promise.all([
        import('/src/data.js'),
        import('/src/engine.js'),
        import('/src/domain/career-world.js'),
        import('/src/domain/career-divisions.js'),
        import('/src/career-management.js')
      ]);

      const fail=(ok,message,details)=>{if(!ok)throw new Error(`${message} :: ${JSON.stringify(details||{})}`);};
      const w=makeWorld();
      startCareer(w,1,'WRD02.05 Windows Test');
      enableCareerWorld(w);
      enableCareerDivisions(w);

      const countries=[...OFFICIAL_WORLD_COUNTRIES];
      fail(countries.length===8,'expected eight countries',{countries});
      fail(validateCareerWorld(w),'initial career world invalid');
      fail(validateCareerDivisions(w),'initial divisions invalid');
      fail(validateSave(w),'initial save invalid');

      const tiers=()=>{
        const s=w.advancedV1.divisionsV1;
        return Object.fromEntries(countries.map(country=>{
          const world=careerWorldLeague(w,country);
          const top=(country===w.countryId&&s.managedTier===1)?w.teams:world.clubs;
          const lower=divisionLeague(w,country).clubs;
          return [country,{top:top.map(c=>c.id),lower:lower.map(c=>c.id)}];
        }));
      };
      const checkPlan=plan=>{
        fail(plan?.season===w.season,'plan season mismatch',{planSeason:plan?.season,season:w.season});
        for(const country of countries){
          const e=plan.countries[country];
          fail(e.top.length===20&&e.bottom.length===20,'plan table size invalid',{country,top:e.top.length,bottom:e.bottom.length});
          fail(new Set(e.promoted).size===3&&new Set(e.relegated).size===3,'movement cardinality invalid',{country,e});
          fail(e.playoff?.matches?.length===3,'playoff matrix invalid',{country,playoff:e.playoff});
        }
      };
      const checkApplied=(before,after,plan,label)=>{
        for(const country of countries){
          const b=before[country],a=after[country],e=plan.countries[country];
          fail(a.top.length===20&&a.lower.length===20,label+' tier sizes invalid',{country,a});
          fail(new Set(a.top).size===20&&new Set(a.lower).size===20,label+' duplicate club in tier',{country,a});
          fail(!a.top.some(id=>a.lower.includes(id)),label+' tiers overlap',{country});
          for(const id of e.promoted){
            fail(b.lower.includes(id)&&a.top.includes(id)&&!a.lower.includes(id),label+' promoted club not moved',{country,id});
          }
          for(const id of e.relegated){
            fail(b.top.includes(id)&&a.lower.includes(id)&&!a.top.includes(id),label+' relegated club not moved',{country,id});
          }
        }
      };
      const simulateSeason=()=>{
        const target=w.fixtures.length;
        while(w.round<target)simulateRound(w);
        fail(w.round===target,'season did not complete',{round:w.round,target});
        fail(validateCareerWorld(w),'career world invalid at season end',{season:w.season});
        fail(validateCareerDivisions(w),'divisions invalid at season end',{season:w.season});
      };

      // Season 1: complete real fixtures, then select an actually relegated top-flight
      // club as the managed fixture so the tier-switch path is exercised deterministically.
      simulateSeason();
      const plan1=captureDivisionSeason(w);checkPlan(plan1);
      const before1=tiers();
      const relegatedTarget=plan1.countries[w.countryId].relegated[0];
      w.clubId=relegatedTarget;autoLineup(w);
      newSeason(w);
      const after1=tiers();
      checkApplied(before1,after1,plan1,'season1');
      fail(w.advancedV1.divisionsV1.managedTier===2,'managed relegation did not occur',{clubId:w.clubId,tier:w.advancedV1.divisionsV1.managedTier,relegatedTarget});
      fail(w.teams.some(c=>c.id===relegatedTarget),'relegated managed club missing from playable league',{relegatedTarget});
      fail(validateCareerWorld(w)&&validateCareerDivisions(w)&&validateSave(w),'post-relegation validation failed');

      // Season 2: complete the second-tier campaign, then select an actually promoted
      // lower-tier club to force and verify the return-to-top-flight path.
      simulateSeason();
      const plan2=captureDivisionSeason(w);checkPlan(plan2);
      const before2=tiers();
      const promotedTarget=plan2.countries[w.countryId].promoted[0];
      w.clubId=promotedTarget;autoLineup(w);
      newSeason(w);
      const after2=tiers();
      checkApplied(before2,after2,plan2,'season2');
      fail(w.advancedV1.divisionsV1.managedTier===1,'managed promotion did not occur',{clubId:w.clubId,tier:w.advancedV1.divisionsV1.managedTier,promotedTarget});
      fail(w.teams.some(c=>c.id===promotedTarget),'promoted managed club missing from playable league',{promotedTarget});
      fail(validateCareerWorld(w)&&validateCareerDivisions(w)&&validateSave(w),'post-promotion validation failed');

      const histories=Object.fromEntries(countries.map(country=>[country,divisionArchive(w,country).length]));
      fail(Object.values(histories).every(n=>n===2),'expected two history records per country',{histories});
      fail(w.advancedV1.divisionsV1.movements.length===2,'expected two movement batches',{movements:w.advancedV1.divisionsV1.movements.length});

      createFreshCareerSlot(window.localStorage,w,validateSave);
      return {
        season:w.season,
        round:w.round,
        clubId:w.clubId,
        managedTier:w.advancedV1.divisionsV1.managedTier,
        relegatedTarget,
        promotedTarget,
        histories,
        movements:w.advancedV1.divisionsV1.movements.length,
        season1:Object.fromEntries(countries.map(c=>[c,{promoted:plan1.countries[c].promoted,relegated:plan1.countries[c].relegated,playoffWinner:plan1.countries[c].playoff.winnerId}])),
        season2:Object.fromEntries(countries.map(c=>[c,{promoted:plan2.countries[c].promoted,relegated:plan2.countries[c].relegated,playoffWinner:plan2.countries[c].playoff.winnerId}]))
      };
    });

    await deletePrimary(page);
    await page.reload({waitUntil:'domcontentloaded'});
    const continueButton=page.locator('[data-action="menu-continue"]').first();
    await continueButton.waitFor({state:'visible',timeout:20000});
    await continueButton.click();
    await page.locator('.dashboard-hero').first().waitFor({state:'visible',timeout:30000});
    await page.waitForTimeout(500);

    const persisted=await readPrimary(page);
    assert(persisted.rawLength>0,'IndexedDB primary snapshot missing',{browserName,persisted});
    assert(persisted.saveValid===true,'persisted save failed validation',{browserName,persisted});
    assert(persisted.divisionsValid===true,'persisted divisions failed validation',{browserName,persisted});
    assert(persisted.season===memory.season&&persisted.round===0,'persisted season/round mismatch',{memory,persisted});
    assert(persisted.clubId===memory.clubId&&persisted.managedTier===1,'persisted managed club/tier mismatch',{memory,persisted});
    assert(persisted.movements===2,'persisted movements mismatch',{memory,persisted});
    assert(Object.values(persisted.history).every(n=>n===2),'persisted movement history mismatch',{persisted});

    return {state:'PASS',memory,persisted,userData};
  }finally{
    await context?.close().catch(()=>{});
  }
}

for(const browserName of ['chrome','edge']){
  try{
    report.browsers[browserName]=await exercise(browserName);
  }catch(error){
    report.browsers[browserName]={state:'FAIL',error:String(error?.message||error),details:error?.details||null};
  }
}
const passed=Object.values(report.browsers).filter(x=>x.state==='PASS').length;
report.checks.WRD0205={state:passed===2?'PASS':'FAIL',passedBrowsers:passed,totalBrowsers:2};
report.finishedAt=new Date().toISOString();
await fs.writeFile(path.join(artifactDir,'WRD02-05-WINDOWS-INDEXEDDB.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(artifactDir,'WRD02-05-WINDOWS-INDEXEDDB.md'),[
  '# Football Architect — WRD02.05 Windows/IndexedDB certification',
  '',
  `Result: **${report.checks.WRD0205.state}**`,
  '',
  `Chrome: **${report.browsers.chrome?.state||'UNKNOWN'}**`,
  `Edge: **${report.browsers.edge?.state||'UNKNOWN'}**`,
  '',
  'Scope: two complete league rollovers, eight-country promotion/relegation swaps, managed-club relegation and promotion paths, playoff records, save validation, and IndexedDB persistence after browser reload.',
  '',
  'RST-01 was not started. No deployment is performed by this runner.'
].join('\n'));
console.log(JSON.stringify({check:report.checks.WRD0205,browsers:Object.fromEntries(Object.entries(report.browsers).map(([k,v])=>[k,v.state]))}));
if(report.checks.WRD0205.state!=='PASS')process.exitCode=1;
