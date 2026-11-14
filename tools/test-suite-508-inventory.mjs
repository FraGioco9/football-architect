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
 explicitWaits:/\b(?:waitForTimeout|setTimeout)\s*\(/g
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
const report={scope:'TEST-SUITE-01 static inventory; signals require human review',
 scannedFiles:rows.length,ownedFiles:tracked.length,matchEngineFiles:engine.length,
 byOwner:Object.fromEntries(Object.entries(byOwner).sort(([a],[b])=>a.localeCompare(b))),
 staticTestCalls:rows.reduce((n,row)=>n+row.staticTestCalls,0),
 staticAssertCalls:rows.reduce((n,row)=>n+row.staticAssertCalls,0),
 candidateFiles:candidates.length,candidates,
 replayReview,disabledReview,rows};
if(process.argv.includes('--json'))process.stdout.write(JSON.stringify(report,null,2)+'\n');
else {
 console.log('TEST-SUITE-01: '+report.scannedFiles+' source files ('+report.ownedFiles+' ownership-tracked, '+report.matchEngineFiles+' Match Engine).');
 console.log('Owner groups:',JSON.stringify(report.byOwner));
 console.log('Static calls (not executed test/coverage counts): '+report.staticTestCalls+' test/it, '+report.staticAssertCalls+' assert.');
 console.log(report.candidateFiles+' files contain a canonical club name or fixed club ID: review candidates, not defects.');
 console.log(report.replayReview.length+' files contain explicit sporting replay/setup signals; '+report.disabledReview.length+' files contain skip/only/todo markers (check context before acting).');
 console.log('Use --json for source-file details, replay review queue and evidence.');
}
