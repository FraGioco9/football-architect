// PERF-API-657: local read-only comparison of paired Worker/isolated D1 samples.
// Never infer zero-byte savings from absent Resource Timing or a failed page.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {describePageUrl,PERF_CAPTURE_SCHEMA_VERSION} from './perf-api-01-requests.mjs';

const COUNT_METRICS=Object.freeze(['requestCount','apiRequestCount','catalogRequestCount','moduleRequestCount']);
const valid=value=>Number.isSafeInteger(value)&&value>=0;
function recordKey(record){return JSON.stringify([record.route,record.attempt,record.scenario])}
function index(records){
 const map=new Map();
 for(const record of records){
  if(typeof record?.route!=='string'||!Number.isSafeInteger(record?.attempt)||record.attempt<0||
   typeof record?.scenario!=='string')throw TypeError('Invalid PERF-API route/scenario record');
  const key=recordKey(record);
  if(map.has(key))throw Error('Duplicate PERF-API route/scenario record');
  map.set(key,record);
 }
 return map;
}
function complete(record){
 return !record.skipped&&!record.incomplete&&record.error==null&&
  COUNT_METRICS.every(metric=>valid(record[metric]));
}
function worldReads(record){
 if(!Array.isArray(record.endpoints))return null;
 const rows=record.endpoints.filter(row=>row?.path==='/api/world'&&
  row.method==='GET'&&row.resourceKind==='api');
 if(!rows.every(row=>valid(row.count)))return null;
 return rows.reduce((sum,row)=>sum+row.count,0);
}
export function comparePerfSamples(before,after){
 if(before?.label!=='before'||after?.label!=='after'||
  before.captureSchemaVersion!==PERF_CAPTURE_SCHEMA_VERSION||
  after.captureSchemaVersion!==PERF_CAPTURE_SCHEMA_VERSION)
  throw Error('PERF-API samples must use the same current capture schema');
 if(typeof before.base!=='string'||before.base!==after.base||
  !Number.isSafeInteger(before.runs)||before.runs<1||before.runs!==after.runs||
  !Array.isArray(before.records)||!Array.isArray(after.records))
  throw Error('PERF-API samples must use the same local origin and run count');
 const previous=index(before.records),current=index(after.records),rows=[];
 let paired=0,countComparable=0,wireComparable=0,skippedOrIncomplete=0;
 const metric=(a,b,name,ok)=>({
  before:ok?a[name]:null,after:ok?b[name]:null,
  delta:ok?b[name]-a[name]:null
 });
 for(const [key,a] of previous){
  const b=current.get(key);
  if(!b)continue;
  paired++;
  const countsOk=complete(a)&&complete(b);
  const wireOk=countsOk&&valid(a.transferBytes)&&valid(b.transferBytes);
  if(countsOk)countComparable++;else skippedOrIncomplete++;
  if(wireOk)wireComparable++;
  const wa=countsOk?worldReads(a):null,wb=countsOk?worldReads(b):null;
  const worldOk=wa!==null&&wb!==null;
  rows.push({
   route:describePageUrl(a.route)?.comparisonKey??'unavailable',
   attempt:a.attempt,scenario:a.scenario,
   status:!countsOk?'incomplete':wireOk?'wire-comparable':'counts-only',
   requestCount:metric(a,b,'requestCount',countsOk),
   apiRequestCount:metric(a,b,'apiRequestCount',countsOk),
   catalogRequestCount:metric(a,b,'catalogRequestCount',countsOk),
   moduleRequestCount:metric(a,b,'moduleRequestCount',countsOk),
   transferBytes:metric(a,b,'transferBytes',wireOk),
   worldReads:{before:worldOk?wa:null,after:worldOk?wb:null,delta:worldOk?wb-wa:null}
  });
 }
 return {
  captureSchemaVersion:PERF_CAPTURE_SCHEMA_VERSION,
  beforeHead:typeof before.head==='string'?before.head:'UNKNOWN',
  afterHead:typeof after.head==='string'?after.head:'UNKNOWN',
  base:before.base,runs:before.runs,
  pairs:{paired,countComparable,wireComparable,skippedOrIncomplete,
   unmatchedBefore:previous.size-paired,unmatchedAfter:current.size-paired},
  caveat:'Wire deltas require complete browser Resource Timing transferSize for both observations. An observed cached zero is valid; missing timing is not zero. Allowlisted read-contract modules and JSON are included, but CSS, fonts, images and arbitrary JS are excluded. No production or latency claim.',
  rows
 };
}
function main(args){
 const [beforeFile='int24-browser-artifacts/perf-api-01-before.json',
  afterFile='int24-browser-artifacts/perf-api-01-after.json',
  outputFile='int24-browser-artifacts/perf-api-01-comparison.json']=args;
 const report=comparePerfSamples(
  JSON.parse(readFileSync(beforeFile,'utf8')),
  JSON.parse(readFileSync(afterFile,'utf8')));
 mkdirSync(dirname(outputFile),{recursive:true});
 writeFileSync(outputFile,JSON.stringify(report,null,2)+'\n');
 console.log('PERF-API-657: '+report.pairs.countComparable+'/'+report.pairs.paired+
  ' paired count samples, '+report.pairs.wireComparable+' wire-comparable; '+outputFile);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{main(process.argv.slice(2))}catch(error){console.error(error.message);process.exitCode=1}
}
