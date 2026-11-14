import test from 'node:test';
import assert from 'node:assert/strict';
import {describeApiUrl,describePageUrl,summarizeRequests,summarizeVisit,DEFAULT_ROUTES,IN_PAGE_SCENARIOS} from '../tools/perf-api-01-requests.mjs';

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

test('Roster in-page audit distinguishes pushState navigation from document reload',()=>{
 const scenario=IN_PAGE_SCENARIOS.find(s=>s.name==='roster-info-to-technical');
 assert.ok(scenario);
 assert.equal(scenario.routePattern.test('/clubs/it/1/roster'),true);
 assert.equal(scenario.routePattern.test('/clubs/it/1/roster?view=info'),true);
 assert.equal(scenario.routePattern.test('/clubs/it/1/overview'),false);
 assert.equal(scenario.selector,'a[data-club-roster-view="technical"]');
 assert.equal(scenario.expectedView,'technical');
});

test('saved route metadata hides filter values and opaque path identifiers',()=>{
 const info=describePageUrl('/players?season=2&offset=40&name=Alice&token=private-secret');
 assert.deepEqual(info,{path:'/players',queryKeys:['name','offset','season','token'],comparisonKey:'/players?offset=40&season=2'});
 const opaque='abc123abc123abc123abc123abc123ab';
 assert.equal(describePageUrl('/account/recover/'+opaque+'?code=private-secret').path,'/account/recover/:redacted');
 assert.equal(describeApiUrl('http://app.localhost:2000/api/players/'+opaque).path,'/api/players/:redacted');
 assert.ok(!JSON.stringify(info).includes('Alice'));
});

test('distinct private filters cannot be mistaken for duplicate API calls',()=>{
 const url=describeApiUrl('http://app.localhost:2000/api/players?name=redacted');
 const row={...url,method:'GET',status:200};
 const result=summarizeRequests([{...row,urlVariant:1},{...row,urlVariant:2},{...row,urlVariant:1}]);
 assert.equal(result.requestCount,3);
 assert.equal(result.uniqueRequestShapes,2);
 assert.equal(result.repeatedRequestCandidates,1);
 assert.equal(JSON.stringify(result).includes('redacted'),false);
});

test('failed or unfinished navigations never count as zero network requests',()=>{
 const attempted=[{method:'GET',path:'/api/world',comparisonKey:'/api/world',status:200}];
 for(const sample of [[],attempted]){
  const result=summarizeVisit(sample,{complete:false});
  assert.equal(result.requestCount,null);
  assert.equal(result.incomplete,true);
  assert.equal(result.observedRequestCount,sample.length);
  assert.equal(result.repeatedRequestCandidates,null);
 }
 assert.equal(summarizeVisit([],{complete:true}).requestCount,0);
});
