import test from 'node:test';
import assert from 'node:assert/strict';
import {comparePerfSamples} from '../tools/perf-api-01-compare.mjs';
import {PERF_CAPTURE_SCHEMA_VERSION} from '../tools/perf-api-01-requests.mjs';

const baseline=()=>({label:'before',captureSchemaVersion:PERF_CAPTURE_SCHEMA_VERSION,
 head:'before-sha',base:'http://app.localhost:2000',runs:1,records:[]});
const sample=(scenario='direct-load',extra={})=>({
 route:'/clubs/it/1/fixtures',attempt:0,scenario,error:null,incomplete:false,
 requestCount:3,apiRequestCount:1,catalogRequestCount:1,moduleRequestCount:1,
 transferBytes:900,
 endpoints:[{method:'GET',resourceKind:'api',path:'/api/world',count:1}],
 ...extra
});

test('PERF-API comparison pairs route/scenario and measures API, module, wire and world deltas',()=>{
 const before=baseline();
 before.records=[sample()];
 const after={...before,label:'after',head:'after-sha',records:[
  sample('direct-load',{requestCount:2,apiRequestCount:0,catalogRequestCount:1,
   moduleRequestCount:1,transferBytes:600,endpoints:[]})
 ]};
 const report=comparePerfSamples(before,after);
 assert.deepEqual(report.pairs,{paired:1,countComparable:1,wireComparable:1,
  skippedOrIncomplete:0,unmatchedBefore:0,unmatchedAfter:0});
 const row=report.rows[0];
 assert.equal(row.status,'wire-comparable');
 assert.deepEqual(row.transferBytes,{before:900,after:600,delta:-300});
 assert.equal(row.apiRequestCount.delta,-1);
 assert.equal(row.catalogRequestCount.delta,0);
 assert.equal(row.moduleRequestCount.delta,0);
 assert.deepEqual(row.worldReads,{before:1,after:0,delta:-1});
 assert.equal(report.beforeHead,'before-sha');
 assert.equal(report.afterHead,'after-sha');
});

test('PERF-API comparison never turns missing timing or failed pages into zero-byte savings',()=>{
 const before=baseline();before.records=[sample('refresh',{transferBytes:null})];
 const after={...before,label:'after',records:[sample('refresh',{transferBytes:0})]};
 const countsOnly=comparePerfSamples(before,after);
 assert.equal(countsOnly.rows[0].status,'counts-only');
 assert.equal(countsOnly.rows[0].transferBytes.delta,null);
 assert.equal(countsOnly.pairs.wireComparable,0);
 before.records=[sample('refresh',{incomplete:true,transferBytes:null})];
 const incomplete=comparePerfSamples(before,after);
 assert.equal(incomplete.rows[0].status,'incomplete');
 assert.equal(incomplete.rows[0].requestCount.delta,null);
 assert.equal(incomplete.rows[0].worldReads.delta,null);
 before.records=[sample('refresh',{skipped:true,requestCount:null})];
 assert.equal(comparePerfSamples(before,after).rows[0].status,'incomplete');
});

test('PERF-API comparison reports missing pairs and rejects incompatible sample schemas',()=>{
 const before=baseline();before.records=[sample('direct-load')];
 const after={...before,label:'after',records:[sample('refresh')]};
 assert.deepEqual(comparePerfSamples(before,after).pairs,{
  paired:0,countComparable:0,wireComparable:0,
  skippedOrIncomplete:0,unmatchedBefore:1,unmatchedAfter:1});
 assert.throws(()=>comparePerfSamples({...before,captureSchemaVersion:1},after),/capture schema/);
 assert.throws(()=>comparePerfSamples(before,{...after,base:'http://localhost:2000'}),/local origin/);
 assert.throws(()=>comparePerfSamples({...before,records:[sample(),sample()]},after),/Duplicate/);
});

test('PERF-API comparison keeps private filters out of written results',()=>{
 const before=baseline(),after={...before,label:'after'};
 const record=sample('direct-load',{route:'/players?name=private-secret&season=1'});
 before.records=[record];after.records=[{...record,transferBytes:800}];
 const report=comparePerfSamples(before,after);
 assert.equal(report.rows[0].route,'/players?season=1');
 assert.equal(JSON.stringify(report).includes('private-secret'),false);
});
