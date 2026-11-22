// Read-only test timing. Never changes assertion outcomes or concurrency.
import {performance} from 'node:perf_hooks';

export function createBrowserTiming(suite,engine,{now=()=>performance.now(),emit=console.log}={}){
 const start=now(),phases=[['start',0]],samples=new Map();
 let reported=false;
 const integer=n=>Math.max(0,Math.round(n));
 function mark(phase){if(!reported)phases.push([phase,Math.max(0,now()-start)]);}
 function sample(label,value){
  if(reported||!Number.isFinite(value)||value<0)return;
  if(!samples.has(label))samples.set(label,[]);
  samples.get(label).push(value);
 }
 function report(){
  if(reported)return;
  reported=true;
  try{
   const totalMs=integer(now()-start),boundaries=[...phases,['end',totalMs]],phasesMs={},groups={};
   for(let i=1;i<boundaries.length;i++)phasesMs[boundaries[i-1][0]+' -> '+boundaries[i][0]]=integer(boundaries[i][1]-boundaries[i-1][1]);
   for(const [key,values] of samples){
    const ordered=[...values].sort((a,b)=>a-b),n=ordered.length;
    groups[key]={count:n,totalMs:integer(ordered.reduce((s,v)=>s+v,0)),medianMs:integer(n%2?ordered[(n-1)/2]:(ordered[n/2-1]+ordered[n/2])/2),p95Ms:integer(ordered[Math.ceil(.95*n)-1])};
   }
   emit('CI_BROWSER_TIMING '+JSON.stringify({schema:1,suite,engine,totalMs,phasesMs,samples:groups}));
  }catch(e){try{process.stderr.write('CI_BROWSER_TIMING unavailable: '+String(e)+'\n');}catch{}}
 }
 return {now,mark,sample,report};
}
