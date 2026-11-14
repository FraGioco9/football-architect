import test from 'node:test';
import assert from 'node:assert/strict';
import {describeApiUrl,summarizeRequests,DEFAULT_ROUTES} from '../tools/perf-api-01-requests.mjs';

test('API audit redacts secret values and ignores static assets',()=>{
 assert.equal(describeApiUrl('http://app.localhost:2000/assets/main.js'),null);
 assert.equal(describeApiUrl('/api/player/session'),null);
 const item=describeApiUrl('http://app.localhost:2000/api/players?season=2&token=private-secret&offset=40&q=Alice');
 assert.deepEqual(item,{path:'/api/players',queryKeys:['offset','q','season','token'],comparisonKey:'/api/players?offset=40&season=2'});
 assert.equal(JSON.stringify(item).includes('private-secret'),false);
});

test('API audit groups repeated shapes without claiming a redundant request',()=>{
 const endpoint=describeApiUrl('https://app.localhost:2000/api/world');
 const a={...endpoint,method:'GET',status:200,initiator:'/dashboard',cacheControl:'no-store',responseBytes:42};
 const b={...endpoint,method:'GET',status:401,initiator:'/calendar',responseBytes:0};
 const c={...endpoint,method:'HEAD',status:200,initiator:'/calendar'};
 const result=summarizeRequests([a,b,c]);
 assert.equal(result.requestCount,3);
 assert.equal(result.uniqueRequestShapes,2);
 assert.equal(result.repeatedRequestCandidates,1);
 assert.equal(result.errorResponses,1);
 const group=result.endpoints.find(row=>row.method==='GET');
 assert.equal(group.count,2);assert.deepEqual(group.statuses,[200,401]);
 assert.deepEqual(group.initiators,['/dashboard','/calendar']);
 assert.equal(group.responseBytes,42);assert.equal(group.measuredResponses,2);
});

test('API audit has representative anonymous route coverage',()=>{
 for(const prefix of ['/dashboard','/clubs','/competitions/','/calendar','/players','/account','/admin'])
  assert.ok(DEFAULT_ROUTES.some(r=>r.startsWith(prefix)),prefix);
 assert.ok(DEFAULT_ROUTES.every(path=>path.startsWith('/')&&!path.startsWith('//')));
});
