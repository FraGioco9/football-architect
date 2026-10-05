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

function invariant(ok,message){if(!ok)throw new Error(message);}
function countBy(items,key){return items.reduce((a,x)=>{a[x[key]]=(a[x[key]]||0)+1;return a;},{});}

const codes=manifest.checks.map(x=>x.code);
const unique=new Set(codes);
const expectedAreas=['A','B','C','D','E','F','G','H','I'];
const expectedCounts={A:4,B:5,C:5,D:5,E:5,F:5,G:4,H:5,I:5};
const adapters=[...new Set(manifest.checks.map(x=>x.adapter))].sort();
const areaCounts=countBy(manifest.checks,'area');

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

const plan={
  suite:manifest.suite,
  generatedAt:new Date().toISOString(),
  mode:'PREPARATION',
  executionLock:lock.state,
  baseline:manifest.baseline,
  checksTotal:manifest.checks.length,
  mandatoryChecks:manifest.checks.filter(x=>x.mandatory).length,
  areas:areaCounts,
  adapters,
  checks:manifest.checks.map(x=>({
    code:x.code,
    area:x.area,
    adapter:x.adapter,
    mandatory:x.mandatory,
    title:x.title,
    initialState:'NON_ESEGUITO'
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
  '# Football Architect — RST-01 preparation plan',
  '',
  `State: **${lock.state}**`,
  '',
  `Checks: **${plan.checksTotal}/43 declared**`,
  `Browsers: **${manifest.baseline.browsers.join(' + ')}**`,
  `World soak target: **${manifest.baseline.seasons} seasons × ${manifest.baseline.countries} countries**`,
  '',
  'This preparation command performs no browser launch, no game simulation, no save mutation and no deployment.',
  '',
  'Execution remains locked until explicit authorization.'
].join('\n'));

if(planOnly || !execute){
  console.log(JSON.stringify({
    suite:plan.suite,
    mode:plan.mode,
    lock:lock.state,
    checks:plan.checksTotal,
    areas:plan.areas,
    adapters:plan.adapters.length
  }));
  process.exit(0);
}

if(process.env.FA_RST01_EXECUTE!=='YES'){
  throw new Error('RST-01 execution refused: FA_RST01_EXECUTE=YES is required.');
}
if(lock.state!=='READY_FOR_EXECUTION'){
  throw new Error(`RST-01 execution refused: execution lock is ${lock.state}.`);
}

throw new Error('RST-01 execution engine is intentionally unavailable on the preparation branch. Activate only after scenario adapters are reviewed and explicitly authorized.');
