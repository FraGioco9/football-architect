// TEST-SUITE-01 (#508): read-only candidate discovery, not coverage certification.
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=path=>readFileSync(join(root,path),'utf8');
const walk=dir=>readdirSync(join(root,dir),{withFileTypes:true})
  .flatMap(entry=>entry.name==='__pycache__'?[]:entry.isDirectory()?walk(dir+'/'+entry.name):[dir+'/'+entry.name]);
const manifest=JSON.parse(read('tools/ci-test-ownership.json'));
const tracked=[...walk('tests'),...walk('backend/tests')].sort();
const expected=Object.keys(manifest.tests).sort();
const missing=tracked.filter(path=>!Object.hasOwn(manifest.tests,path));
const stale=expected.filter(path=>!tracked.includes(path));
if(missing.length||stale.length){
 throw Error('Test ownership drift: untracked='+(missing.join(',')||'none')+'; stale='+(stale.join(',')||'none'));
}
const engine=walk('match-engine/tests').filter(path=>/\.test\.[cm]?[jt]s$/.test(path)).sort();
// The separately scheduled Match Engine suite is outside the usual ownership
// manifest. Prove each discovered test has a real workflow execution path.
const engineScript=JSON.parse(read('match-engine/package.json')).scripts?.test;
if(typeof engineScript!=='string')throw Error('Match Engine test script missing');
const engineWorkflow=read('.github/workflows/match-engine-01.yml');
const runCommands=[...engineWorkflow.matchAll(/^\s+run:\s*(.+)$/gm)].map(m=>m[1].trim());
if(!runCommands.includes('npm --prefix match-engine test')){
 throw Error('Match Engine targeted workflow does not run its Node test script');
}
const configuredNode=new Set(engineScript.split(/\s+/)
 .filter(token=>/^tests\/.+\.test\.[cm]?[jt]s$/.test(token))
 .map(path=>'match-engine/'+path));
const configuredBrowser=new Set(runCommands
 .filter(command=>command.startsWith('node --test '))
 .flatMap(command=>command.split(/\s+/).filter(token=>token.startsWith('match-engine/tests/'))));
const nodeFiles=engine.filter(path=>!path.includes('browser'));
const browserFiles=engine.filter(path=>path.includes('browser'));
const missingNode=nodeFiles.filter(path=>!configuredNode.has(path));
const missingBrowser=browserFiles.filter(path=>!configuredBrowser.has(path));
const staleNode=[...configuredNode].filter(path=>!nodeFiles.includes(path));
const staleBrowser=[...configuredBrowser].filter(path=>!browserFiles.includes(path));
if(!engine.length||missingNode.length||missingBrowser.length||staleNode.length||staleBrowser.length){
 throw Error('Match Engine test execution drift: missing-node='+missingNode.join(',')+
  '; missing-browser='+missingBrowser.join(',')+'; stale-node='+staleNode.join(',')+
  '; stale-browser='+staleBrowser.join(','));
}
const engineExecution={workflow:'match-engine-01.yml',
 nodeScript:'match-engine/package.json#scripts.test',
 nodeFiles,browserFiles};
const clubs=JSON.parse(read('data/clubs.json'));
const canonicalNames=[...new Set(clubs.flatMap(club=>[club.primaryName,club.fullName])
  .filter(name=>typeof name==='string'&&name.trim().length>=8))].sort();
const riskPatterns={
 fixedClubIds:/\b(?:ENG|WAL|IT|ES|DE|FR|PT|NL|BR)-\d{1,3}\b/g,
 globalState:/\b(?:process\.env|process\.chdir|globalThis)\b/g,
 nondeterminism:/\b(?:Math\.random|Date\.now|randomUUID)\s*\(/g,
 externalIO:/\b(?:fetch|createServer|execSync|execFileSync|spawn)\s*\(/g,
 // Review signals only. Calls in a file are not a proof of duplicated
 // scenarios, and setup cost depends on the actual runner and fixture.
 disabledOrFocused:/\b(?:test|it|describe)\.(?:skip|only|todo)\s*\(/g,
 sportingReplays:/\b(?:await\s+through\s*\(\s*\d+|await\s+executeLifecycle\s*\(|await\s+generateSeasonCalendar\s*\()/g,
 d1Rebuilds:/\b(?:applyD1Migrations|clearTestWorld|restoreTestWorld)\s*\(/g,
 explicitWaits:/\b(?:waitForTimeout|setTimeout)\s*\(/g,
 // Cost/reproducibility signals. Report loops and setup scope separately:
 // one full-season replay in beforeAll is different from one per test case.
 fullSeasonLoops:/\bwhile\s*\(\s*[A-Za-z_$][\w$]*\.day\s*<\s*56\s*\)/g,
 beforeAllHooks:/\bbeforeAll\s*\(/g,
 beforeEachHooks:/\bbeforeEach\s*\(/g,
 testWorldRestores:/\brestoreTestWorld\s*\(/g,
 testWorldClears:/\bclearTestWorld\s*\(/g
};
const rows=[...tracked.map(path=>({path,owner:manifest.tests[path]})),
 ...engine.map(path=>({path,owner:path.includes('browser')?'match-engine-browser':'match-engine-node'}))]
 .map(({path,owner})=>{
  const source=read(path);
  const flags=Object.fromEntries(Object.entries(riskPatterns).map(([key,re])=>[key,[...source.matchAll(re)].length]));
  const catalogNames=canonicalNames.filter(name=>source.includes(name));
  return {path,owner,staticTestCalls:[...source.matchAll(/\b(?:test|it)\s*\(/g)].length,
   staticAssertCalls:[...source.matchAll(/\bassert(?:\.[a-zA-Z]+)+\s*\(/g)].length,
   catalogNames,flags};
 });
const byOwner={};
for(const {owner} of rows)byOwner[owner]=(byOwner[owner]||0)+1;
const candidates=rows.filter(row=>row.catalogNames.length||row.flags.fixedClubIds)
 .map(row=>({path:row.path,owner:row.owner,catalogNames:row.catalogNames.slice(0,8),fixedClubIds:row.flags.fixedClubIds}));
// Do not rank by keyword count alone: a long-lived integration case can
// protect a real transaction boundary, so these are manual inspection queues.
const replayReview=rows.filter(row=>row.flags.sportingReplays>0)
 .map(({path,owner,staticTestCalls,flags})=>({path,owner,staticTestCalls,
  sportingReplays:flags.sportingReplays,d1Rebuilds:flags.d1Rebuilds}))
 .sort((a,b)=>b.sportingReplays-a.sportingReplays||a.path.localeCompare(b.path));
const disabledReview=rows.filter(row=>row.flags.disabledOrFocused>0)
 .map(({path,owner,flags})=>({path,owner,count:flags.disabledOrFocused}))
 .sort((a,b)=>a.path.localeCompare(b.path));
// A lifecycle/rollback suite may legitimately be expensive. This separate
// review queue exposes setup/isolation signals without conflating source calls
// with executed test counts, timing, or duplication.
const lifecycleReview=rows.filter(row=>row.owner==='backend-runtime'&&
 (row.flags.fullSeasonLoops>0||row.flags.sportingReplays>0||row.flags.testWorldRestores>0))
 .map(({path,staticTestCalls,flags})=>({path,staticTestCalls,
  fullSeasonLoops:flags.fullSeasonLoops,
  sportingReplays:flags.sportingReplays,
  beforeAllHooks:flags.beforeAllHooks,beforeEachHooks:flags.beforeEachHooks,
  testWorldRestores:flags.testWorldRestores,testWorldClears:flags.testWorldClears}))
 .sort((a,b)=>b.fullSeasonLoops-a.fullSeasonLoops||
  b.sportingReplays-a.sportingReplays||a.path.localeCompare(b.path));
const report={scope:'TEST-SUITE-01 static inventory; signals require human review',
 scannedFiles:rows.length,ownedFiles:tracked.length,matchEngineFiles:engine.length,
 engineExecution,
 byOwner:Object.fromEntries(Object.entries(byOwner).sort(([a],[b])=>a.localeCompare(b))),
 staticTestCalls:rows.reduce((n,row)=>n+row.staticTestCalls,0),
 staticAssertCalls:rows.reduce((n,row)=>n+row.staticAssertCalls,0),
 candidateFiles:candidates.length,candidates,
 replayReview,lifecycleReview,disabledReview,rows};
if(process.argv.includes('--json'))process.stdout.write(JSON.stringify(report,null,2)+'\n');
else {
 console.log('TEST-SUITE-01: '+report.scannedFiles+' source files ('+report.ownedFiles+' ownership-tracked, '+report.matchEngineFiles+' Match Engine).');
 console.log('Owner groups:',JSON.stringify(report.byOwner));
 console.log('Match Engine execution: '+engineExecution.nodeFiles.length+' Node test files via npm; '+engineExecution.browserFiles.length+' browser test files via targeted workflow.');
 console.log('Static calls (not executed test/coverage counts): '+report.staticTestCalls+' test/it, '+report.staticAssertCalls+' assert.');
 console.log(report.candidateFiles+' files contain a canonical club name or fixed club ID: review candidates, not defects.');
 console.log(report.replayReview.length+' files contain explicit sporting replay/setup signals; '+report.lifecycleReview.length+' Worker files merit lifecycle/setup review; '+report.disabledReview.length+' files contain skip/only/todo markers.');
 console.log('Use --json for source-file details, replay/setup/isolation review queues and evidence.');
}
