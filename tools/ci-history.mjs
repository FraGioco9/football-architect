// Offline analysis of downloaded ci-artifacts JSON; never retries a test.
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
export function analyzeHistory(records){
 const signatures=new Map(),outcomes=new Map();
 for(const r of records){
  if(!r.head||!r.reproduce||!['FAIL','PASS'].includes(r.status))continue;
  const key=r.head+'\n'+(r.suiteReproduce??r.reproduce);
  if(!outcomes.has(key))outcomes.set(key,new Set());outcomes.get(key).add(r.status);
  if(r.status==='FAIL'){
   const key=r.signature;signatures.set(key,(signatures.get(key)||0)+1);
  }
 }
 return {repeatedFailures:[...signatures].filter(([,n])=>n>1).map(([signature,count])=>({signature,count})),
  flakyCandidates:[...outcomes].filter(([,states])=>states.size>1).map(([key])=>({head:key.split('\n')[0],command:key.split('\n').slice(1).join('\n'),classification:'requires investigation'}))};
}
function records(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?records(join(dir,e.name)):e.name.endsWith('.json')?[JSON.parse(readFileSync(join(dir,e.name),'utf8'))]:[])}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(!process.argv[2])throw Error('Usage: node tools/ci-history.mjs DOWNLOADED_ARTIFACT_DIRECTORY');
 console.log(JSON.stringify(analyzeHistory(records(process.argv[2])),null,2));
}
