// Read-only timing for long Site Chromium tests. Observed spans can overlap.
import {performance} from 'node:perf_hooks';
export function createChromeProfile(suite,{clock=()=>performance.now(),log=console.log}={}){
 if(typeof suite!=='string'||!suite.trim())throw TypeError('A non-empty suite name is required');
 const started=clock(),buckets=new Map();
 const measure=async(label,operation)=>{
  const start=clock();
  try{return await operation();}
  finally{
   const entry=buckets.get(label)||{calls:0,elapsedMs:0};
   entry.calls++;
   entry.elapsedMs+=Math.max(0,clock()-start);
   buckets.set(label,entry);
  }
 };
 const measureCDP=(method,params,operation)=>{
  const label=method==='Page.captureScreenshot'
   ?'screenshot:'+((params?.format||'png').toLowerCase())
   :method==='Runtime.evaluate'?'runtime-evaluate'
   :method==='Page.navigate'?'page-navigate':'cdp-other';
  return measure(label,operation);
 };
 const emit=(details={})=>{
  const observed=Object.fromEntries([...buckets.entries()].sort(([a],[b])=>a.localeCompare(b))
   .map(([name,data])=>[name,{calls:data.calls,elapsedMs:Math.round(data.elapsedMs)}]));
  const result={suite,wallMs:Math.round(Math.max(0,clock()-started)),observed,...details};
  log('CHROME_PROFILE|'+JSON.stringify(result));
  return result;
 };
 return Object.freeze({measure,measureCDP,emit});
}
