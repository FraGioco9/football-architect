// Isolated local-only performance probe: numbers must be measured, not assumed.
import {performance} from 'node:perf_hooks';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine,PHYSICS_VERSION} from '../src/core.mjs';
const start=performance.now();
const R=await initializeRapier(wasm);
const initialized=performance.now();
const count=Number(process.argv[2]??6000);
if(!Number.isSafeInteger(count)||count<1||count>1_000_000)throw Error('Invalid tick count');
const physics=createEngine(R,{preset:'launch',seed:'bench-v1'});
const before=performance.now();
for(let i=0;i<count;i++)physics.step();
const after=performance.now();
physics.dispose();
process.stdout.write(JSON.stringify({
 version:PHYSICS_VERSION,
 node:process.version,
 ticks:count,
 initializationMs:Number((initialized-start).toFixed(2)),
 simulationMs:Number((after-before).toFixed(2)),
 millisecondsPerTick:Number(((after-before)/count).toFixed(5)),
 heapUsedBytes:process.memoryUsage().heapUsed,
 rssBytes:process.memoryUsage().rss
},null,2)+'\n');
