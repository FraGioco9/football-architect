// #748 SH-03 diagnostics must never log credentials, query strings or payloads.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSh03NetworkEvidence} from './sh03-network-evidence.mjs';

const make=options=>createSh03NetworkEvidence({
 publicOrigin:'http://127.0.0.1:2001',
 debugOrigin:'http://127.0.0.1:2002',
 ...options
});
const request=(url,failure='')=>({url:()=>url,method:()=> 'GET',failure:()=>failure});

test('#748 records the origin, phase, status and failure type without leaking a query or header',()=>{
 let now=100;
 const evidence=make({now:()=>now});
 evidence.setStage('historical-season-race-complete');
 const req=request('http://127.0.0.1:2001/api/competitions/IT-1/seasons/2?secret=PRIVATE',
  'request cancelled');
 evidence.request('started',req);
 now=125;evidence.request('failed',req,{failure:req.failure()});
 evidence.pageError('/127.0.0.1:2001/api/competitions/IT-1/seasons/2 due to access control checks.');
 const rows=evidence.snapshot();
 assert.deepEqual(rows.map(x=>x.event),['started','failed','pageerror']);
 assert.equal(rows[0].id,rows[1].id);
 assert.equal(rows[1].failureCategory,'aborted');
 assert.equal(rows[2].errorCategory,'access-control');
 assert.equal(rows[2].path,'/api/competitions/IT-1/seasons/2');
 assert.equal(rows[0].origin,'public');
 assert.equal(rows[1].stage,'historical-season-race-complete');
 assert.equal(rows[1].ms,25);
 assert.ok(!JSON.stringify(rows).includes('PRIVATE'));
});

test('#748 preserves statuses, cross-origin isolation and bounded event history',()=>{
 const evidence=make({limit:2});
 const req=request('http://127.0.0.1:2002/api/matches/seasons/1/competitions/IT-1?token=SECRET');
 evidence.request('started',req);
 evidence.request('response',req,{status:404});
 evidence.request('finished',req);
 evidence.request('started',request('https://untrusted.test/api/world?token=SECRET'));
 evidence.request('started',request('http://127.0.0.1:2001/api/player/permissions'));
 const rows=evidence.snapshot();
 assert.equal(rows.length,2);
 assert.deepEqual(rows.map(x=>x.event),['response','finished']);
 assert.equal(rows[0].status,404);
 assert.equal(rows[0].origin,'debug');
 assert.ok(!JSON.stringify(rows).includes('SECRET'));
});

test('#748 pageerror classification keeps unknown JS failures observable',()=>{
 const evidence=make({});
 evidence.pageError('Uncaught TypeError: unavailable');
 evidence.navigation('http://127.0.0.1:2001/competitions/it-1/standings?session=PRIVATE');
 assert.equal(evidence.snapshot()[0].errorCategory,'other');
 assert.equal(evidence.snapshot()[1].path,'/competitions/it-1/standings');
 assert.ok(!JSON.stringify(evidence.snapshot()).includes('PRIVATE'));
 assert.throws(()=>make({limit:300}),/Invalid SH-03 evidence limit/);
});
