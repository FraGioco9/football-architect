import test from 'node:test';
import assert from 'node:assert/strict';
import {describeApiUrl,describeDataUrl,TRACKED_STATIC_DATA,describePageUrl,attachResourceTransferTimings,summarizeRequests,summarizeVisit,waitForApiCompletion,validateSamplerBackend,DEFAULT_ROUTES,IN_PAGE_SCENARIOS,CLUB_READ_AUDIT} from '../tools/perf-api-01-requests.mjs';

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

test('API baseline only accepts a reachable world and correctly routed anonymous session',()=>{
 assert.equal(validateSamplerBackend({worldStatus:200,permissionsStatus:401}),null);
 assert.equal(validateSamplerBackend({worldStatus:200,permissionsStatus:200}),null);
 for(const sample of [{worldStatus:404,permissionsStatus:401},
  {worldStatus:200,permissionsStatus:404},{worldStatus:503,permissionsStatus:503}])
  assert.equal(typeof validateSamplerBackend(sample),'string');
});

test('API audit finishes when tracked API reads settle, independently of unrelated page assets',async()=>{
 let clock=0,records=[{settled:false}];
 const delay=async ms=>{clock+=ms;if(clock===200)records[0].settled=true;};
 assert.equal(await waitForApiCompletion(()=>records,{timeoutMs:1000,quietMs:150,now:()=>clock,delay}),true);
 assert.equal(await waitForApiCompletion(()=>[],{timeoutMs:800,quietMs:150,now:()=>clock,delay}),true,
  'a complete in-page action with no API calls is valid after the quiet period');
 records=[{settled:false}];clock=0;
 assert.equal(await waitForApiCompletion(()=>records,{timeoutMs:350,quietMs:100,now:()=>clock,delay:async ms=>{clock+=ms}}),false,
  'a pending API request cannot be counted as zero or complete');
});

test('cross-page inventory includes expensive public data catalogues without CSS/image noise',()=>{
 for(const path of TRACKED_STATIC_DATA){
  const parsed=describeDataUrl('http://app.localhost:2000'+path);
  assert.equal(parsed?.path,path);
  assert.equal(parsed?.resourceKind,'catalog');
 }
 assert.equal(describeDataUrl('http://app.localhost:2000/api/world')?.resourceKind,'api');
 assert.equal(describeDataUrl('http://app.localhost:2000/assets/app.css'),null);
 assert.equal(describeDataUrl('http://app.localhost:2000/assets/clubs/IT/1/crest.svg'),null);
 assert.ok(DEFAULT_ROUTES.includes('/matches/1'));
 assert.ok(DEFAULT_ROUTES.includes('/players/44'));
});

test('PERF-API-657 records compact and scoped identity catalogues, never arbitrary assets',()=>{
 for(const path of ['/clubs/_shared/identity.json','/competitions/_shared/compact.json',
  '/clubs/_profiles/BR-1.json','/clubs/_profiles/ENG-40.json']){
  const data=describeDataUrl('http://app.localhost:2000'+path);
  assert.equal(data?.resourceKind,'catalog',path);assert.equal(data?.path,path);
 }
 for(const path of ['/clubs/_profiles/ENG-0.json','/clubs/_profiles/IT-41.json',
  '/clubs/_profiles/IT-3.js','/clubs/_profiles/IT-3.json/extra','/assets/app.css']){
  assert.equal(describeDataUrl('http://app.localhost:2000'+path),null,path);
 }
});

test('PERF-API-657 preserves Resource Timing wire sizes without private query leakage or fake zeroes',()=>{
 const api=describeDataUrl('http://app.localhost:2000/api/world?token=secret-value');
 const catalog=describeDataUrl('http://app.localhost:2000/clubs/_shared/identity.json');
 const first={...api,method:'GET',status:200,transferBytes:null,responseBytes:100};
 const second={...catalog,method:'GET',status:200,transferBytes:null,responseBytes:250};
 const ephemeral=new Map([[first,'http://app.localhost:2000/api/world?token=secret-value'],
  [second,'http://app.localhost:2000/clubs/_shared/identity.json']]);
 attachResourceTransferTimings([first,second],[
  {url:ephemeral.get(first),transferBytes:900,encodedBodyBytes:700,decodedBodyBytes:1400},
  {url:ephemeral.get(first),transferBytes:90,encodedBodyBytes:60,decodedBodyBytes:1400}
 ],entry=>ephemeral.get(entry));
 assert.equal(first.transferBytes,90,'a later in-page request uses its most recent timing');
 assert.equal(first.encodedBodyBytes,60);
 assert.equal(second.transferBytes,null,'a missing Resource Timing entry is unknown, never free');
 const partial=summarizeRequests([first,second]);
 assert.equal(partial.apiRequestCount,1);assert.equal(partial.catalogRequestCount,1);
 assert.equal(partial.transferBytes,null);assert.equal(partial.measuredTransferResponses,1);
 assert.equal(partial.observedTransferBytes,90);
 assert.equal(partial.endpoints.find(x=>x.resourceKind==='catalog').transferBytes,null);
 assert.equal(JSON.stringify([first,second,partial]).includes('secret-value'),false);
 second.transferBytes=0;
 const completed=summarizeRequests([first,second]);
 assert.equal(completed.transferBytes,90,'an explicit cached zero is distinct from missing timing');
 assert.equal(completed.measuredTransferResponses,2);
 assert.equal(summarizeVisit([first,second],{complete:false}).transferBytes,null);
});


test('PERF-API-657 Club audit uses actual tab links and season options, without assuming a future season',()=>{
 assert.equal(CLUB_READ_AUDIT.overviewRoute.test('/clubs/it/1/overview'),true);
 assert.equal(CLUB_READ_AUDIT.overviewRoute.test('/clubs/it/1/history'),false);
 assert.equal(CLUB_READ_AUDIT.fixturesRoute.test('/clubs/it/1/fixtures?season=1'),true);
 assert.equal(CLUB_READ_AUDIT.fixturesRoute.test('/clubs/it/1/stats'),false);
 assert.equal(CLUB_READ_AUDIT.historyLink,'.club-tabs a[href$="/history"]');
 assert.equal(CLUB_READ_AUDIT.overviewLink,'.club-tabs a[href$="/overview"]');
 assert.match(CLUB_READ_AUDIT.seasonOptions,/data-menu-value/);
 for(const route of ['/clubs/it/1/overview','/clubs/it/1/fixtures','/clubs/it/1/history'])
  assert.ok(DEFAULT_ROUTES.includes(route),route);
});
