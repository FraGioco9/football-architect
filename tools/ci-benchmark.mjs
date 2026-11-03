// Controlled before/after experiment. Does not dispatch GitHub Actions.
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {writeFileSync,mkdirSync} from 'node:fs';
import {essential,selectTests} from './ci-selected.mjs';
import {classifyImpact} from './ci-opt-01-impact.mjs';
const area=['tests/admin-settings.test.mjs','tests/season-two-controls.test.mjs','tests/dev-admin-api-proxy.test.mjs']; // former reviewed baseline selection
const selected=selectTests(classifyImpact(['assets/admin-settings.js']).tests);
const before=[essential,area],after=[selected];
if(JSON.stringify([...new Set(before.flat())].sort())!==JSON.stringify([...selected].sort()))throw Error('Unique test coverage differs');
function run(lanes){
 const start=performance.now();let count=0;
 for(const files of lanes){
  const r=spawnSync(process.execPath,['--test','--test-reporter=tap','--test-concurrency=1',...files],{encoding:'utf8',maxBuffer:64*1024*1024});
  if(r.status!==0)throw Error('Benchmark suite failed: '+r.stderr+'\n'+r.stdout.slice(-6000));
  count+=Number(r.stdout.match(/^# tests (\d+)$/m)?.[1]||0);
 }
 return {milliseconds:Math.round(performance.now()-start),fileExecutions:lanes.flat().length,tests:count};
}
const trials=[];
for(let i=0;i<3;i++){
 const trial={};for(const kind of (i%2?['after','before']:['before','after']))trial[kind]=run(kind==='before'?before:after);
 trials.push(trial);
}
const result={scenario:'Draft Admin bounded selection: identical checkout, Node, fixtures and unique test files; before uses former essential + area subprocesses, after unique union',node:process.version,platform:process.platform,trials,uniqueFiles:selected.length,duplicateFilesRemoved:before.flat().length-selected.length,
 limitations:'Local warm-cache samples, alternating order, n=3. Not a GitHub runner SLA or a measured human repair-time reduction. Historical detection/repair time is not reconstructible from workflow duration alone.'};
mkdirSync('docs/ci',{recursive:true});writeFileSync('docs/ci/ci-opt-04-05-benchmark.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
