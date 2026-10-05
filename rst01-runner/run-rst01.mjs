import fs from 'node:fs/promises';
import path from 'node:path';

const here=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/,m=>m.slice(1)));
const manifestPath=path.join(here,'manifest.json');
const lockPath=path.join(here,'execution-lock.json');
const args=new Set(process.argv.slice(2));
const planOnly=args.has('--plan');
const execute=args.has('--execute');

const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
const lock=JSON.parse(await fs.readFile(lockPath,'utf8'));
const {adapters,validateAdapterRegistry}=await import('./scenario-adapters.mjs');

function invariant(ok,message){if(!ok)throw new Error(message);}
function countBy(items,key){return items.reduce((a,x)=>{a[x[key]]=(a[x[key]]||0)+1;return a;},{});}

const codes=manifest.checks.map(x=>x.code);
const unique=new Set(codes);
const expectedAreas=['A','B','C','D','E','F','G','H','I'];
const expectedCounts={A:4,B:5,C:5,D:5,E:5,F:5,G:4,H:5,I:5};
const areaCounts=countBy(manifest.checks,'area');
const registry=validateAdapterRegistry(manifest);

invariant(manifest.schemaVersion===1,'Unsupported RST-01 manifest schema.');
invariant(manifest.suite==='RST-01','Unexpected suite id.');
invariant(manifest.checks.length===43,`RST-01 manifest must contain 43 checks, found ${manifest.checks.length}.`);
invariant(unique.size===43,'RST-01 check codes must be unique.');
for(const area of expectedAreas){
  invariant(areaCounts[area]===expectedCounts[area],`Unexpected check count for area ${area}: ${areaCounts[area]||0}`);
}
invariant(manifest.checks.every(x=>x.mandatory===true),'Every current RST-01 check must be mandatory.');
invariant(manifest.baseline.browsers.join(',')==='chrome,edge','Chrome and Edge are mandatory.');
invariant(manifest.baseline.countries===8,'RST-01 requires 8 countries.');
invariant(manifest.baseline.seasons===10,'RST-01 requires 10 seasons.');
invariant(registry.ok,`RST-01 adapter registry mismatch: ${JSON.stringify(registry)}`);

const plan={
  suite:manifest.suite,
  generatedAt:new Date().toISOString(),
  mode:'PREPARATION',
  executionLock:lock.state,
  baseline:manifest.baseline,
  checksTotal:manifest.checks.length,
  mandatoryChecks:manifest.checks.filter(x=>x.mandatory).length,
  adapterRegistry:registry,
  areas:areaCounts,
  checks:manifest.checks.map(x=>({
    code:x.code,area:x.area,adapter:x.adapter,mandatory:x.mandatory,title:x.title,initialState:'NON_ESEGUITO'
  })),
  completionGate:{
    allMandatoryPass:true,
    failAllowed:0,
    mandatoryNonExecutedAllowed:0,
    browsers:['chrome','edge'],
    indexedDbIntegrityRequired:true,
    seasonsRequired:10,
    countriesRequired:8,
    immutableZipRequired:true,
    artifactRequired:true,
    deployAllowed:false
  }
};

const artifactDir=process.env.FA_ARTIFACT_DIR||path.resolve(here,'artifacts');
await fs.mkdir(artifactDir,{recursive:true});
await fs.writeFile(path.join(artifactDir,'RST01-PREPARATION-PLAN.json'),JSON.stringify(plan,null,2));
await fs.writeFile(path.join(artifactDir,'RST01-PREPARATION-PLAN.md'),[
  '# Football Architect — RST-01 preparation plan','',
  `State: **${lock.state}**`,'',
  `Checks: **${plan.checksTotal}/43 declared**`,
  `Adapters: **${registry.implemented}/43 implemented**`,
  `Browsers: **${manifest.baseline.browsers.join(' + ')}**`,
  `World soak target: **${manifest.baseline.seasons} seasons × ${manifest.baseline.countries} countries**`,'',
  'Plan mode performs no browser launch, no game simulation, no save mutation and no deployment.','',
  'Execution remains locked until explicit authorization.'
].join('\n'));

if(planOnly || !execute){
  console.log(JSON.stringify({suite:plan.suite,mode:plan.mode,lock:lock.state,checks:plan.checksTotal,registry}));
  process.exit(0);
}

if(process.env.FA_RST01_EXECUTE!=='YES'){
  throw new Error('RST-01 execution refused: FA_RST01_EXECUTE=YES is required.');
}
if(lock.state!=='READY_FOR_EXECUTION'){
  throw new Error(`RST-01 execution refused: execution lock is ${lock.state}.`);
}

const runtime=await import('./lib/runtime.mjs');
await runtime.ensureArtifactDir();
const report={
  suite:'RST-01',
  startedAt:new Date().toISOString(),
  release:manifest.baseline.release,
  releaseSha256:manifest.baseline.releaseSha256,
  browsers:{},
  checks:{}
};

for(const browserName of manifest.baseline.browsers){
  const browserReport={checks:{},state:'PASS'};
  report.browsers[browserName]=browserReport;
  let context;
  try{
    const made=await runtime.launchPersistent(browserName,{viewport:{width:1440,height:900},suffix:'suite'});
    context=made.context;
    const page=context.pages()[0]||await context.newPage();
    const ctx={
      browserName,
      baseURL:runtime.baseURL,
      artifactDir:runtime.artifactDir,
      context,
      page,
      userData:made.userData,
      shared:{}
    };

    for(const item of manifest.checks){
      const fn=adapters[item.code];
      let result;
      try{
        result=await fn(ctx);
        if(!result||!['PASS','FAIL','NON_ESEGUITO'].includes(result.state)){
          result={state:'FAIL',reason:'Adapter returned an invalid result object'};
        }
      }catch(error){
        result={state:'FAIL',reason:String(error?.message||error),details:error?.details||null};
      }
      browserReport.checks[item.code]=result;
      if(result.state!=='PASS')browserReport.state=result.state==='FAIL'?'FAIL':browserReport.state==='PASS'?'NON_ESEGUITO':browserReport.state;
      await fs.writeFile(path.join(artifactDir,`partial-${browserName}-${item.code}.json`),JSON.stringify(result,null,2));
      console.log(`RST01 ${browserName} ${item.code} ${result.state}`);
    }
  }catch(error){
    browserReport.state='FAIL';
    browserReport.fatal=String(error?.message||error);
    for(const item of manifest.checks){
      browserReport.checks[item.code]??={state:'FAIL',reason:`Browser suite aborted: ${browserReport.fatal}`};
    }
  }finally{
    await context?.close().catch(()=>{});
  }
}

for(const item of manifest.checks){
  const perBrowser=Object.fromEntries(manifest.baseline.browsers.map(name=>[name,report.browsers[name].checks[item.code]]));
  const states=Object.values(perBrowser).map(x=>x?.state||'FAIL');
  const state=states.includes('FAIL')?'FAIL':states.includes('NON_ESEGUITO')?'NON_ESEGUITO':'PASS';
  report.checks[item.code]={state,mandatory:item.mandatory,perBrowser};
}

const values=Object.values(report.checks);
report.summary={
  pass:values.filter(x=>x.state==='PASS').length,
  fail:values.filter(x=>x.state==='FAIL').length,
  nonExecuted:values.filter(x=>x.state==='NON_ESEGUITO').length,
  mandatoryNonExecuted:values.filter(x=>x.mandatory&&x.state==='NON_ESEGUITO').length
};
report.finishedAt=new Date().toISOString();

await fs.writeFile(path.join(artifactDir,'RST01-RESULTS.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(artifactDir,'RST01-RESULTS.md'),[
  '# Football Architect — RST-01 results','',
  `Generated: ${report.finishedAt}`,'',
  '| Check | State |','|---|---|',
  ...Object.entries(report.checks).map(([code,value])=>`| ${code} | **${value.state}** |`),'',
  `Summary: ${report.summary.pass} PASS · ${report.summary.fail} FAIL · ${report.summary.nonExecuted} NON ESEGUITO`
].join('\n'));

if(report.summary.fail!==0||report.summary.mandatoryNonExecuted!==0||report.summary.pass!==43){
  process.exitCode=1;
}
