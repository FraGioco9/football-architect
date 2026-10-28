// Exercise production TARGETED selection and actual suites on this checked-out HEAD.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {classifyImpact} from './ci-opt-01-impact.mjs';
const paths={calendar:'calendar/index.html',clubs:'clubs/it/1/overview/index.html',competitions:'competitions/it-1/standings/index.html',guide:'guide/index.html'};
assert.equal(classifyImpact(['docs/example.md']).mode,'fast');
assert.equal(classifyImpact(Object.values(paths)).mode,'full');
assert.equal(classifyImpact(['unknown.file']).mode,'full');
for(const [area,path] of Object.entries(paths)){
 const start=performance.now();
 const selected=classifyImpact([path]);
 assert.equal(selected.mode,'targeted');assert.equal(selected.area,area);
 const args=process.argv.includes('--node')?['--test','--test-concurrency=1',...selected.tests]:['tests/ci-opt-01-browser-smoke.mjs'];
 const result=spawnSync(process.execPath,args,{stdio:'inherit',env:{...process.env,FA_TARGET_AREA:selected.area}});
 if(result.error||result.status!==0)throw Error('TARGETED scenario failed: '+area);
 console.log('CI-OPT-01 scenario '+area+' '+JSON.stringify({kind:process.argv.includes('--node')?'node':'browser',milliseconds:Math.round(performance.now()-start),files:selected.tests.length}));
}
