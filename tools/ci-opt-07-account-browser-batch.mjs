// TEST-SUITE-02 (#738): share one pinned browser process across sequential
// Account suites. Each suite independently starts/stops its preview listener
// and creates/disposes its own contexts; never overlap port 2000 or test state.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export const isDirectExecution=url=>Boolean(process.argv[1])&&resolve(process.argv[1])===fileURLToPath(url);

export async function launchAccountBrowser(){
 const playwright=await import(process.env.FA_ACCOUNT_PLAYWRIGHT||'playwright');
 const engine=process.env.FA_AUTH_BROWSER||'chromium';
 const browser=await playwright[engine].launch({
  headless:true,
  ...(process.env.FA_ACCOUNT_CHROME&&engine==='chromium'
   ?{executablePath:process.env.FA_ACCOUNT_CHROME,args:['--no-sandbox']}:{})
 });
 return {browser,engine};
}

export async function runAccountBrowserBatch(suites,{
 launch=launchAccountBrowser,
 report=event=>console.log('TEST_SUITE_02_ACCOUNT_BATCH|'+JSON.stringify(event))
}={}){
 if(!Array.isArray(suites)||!suites.length||suites.some(({name,expected,run})=>
  typeof name!=='string'||!name||!Number.isSafeInteger(expected)||expected<1||typeof run!=='function'))
  throw Error('Account batch must name suites, assert positive case counts and supply executable runners');
 const {browser,engine}=await launch();
 const failures=[],results=[];
 try{
  // Run each suite even when an earlier one fails, preserving diagnostics
  // without ever starting two listeners on port 2000 simultaneously.
  for(const {name,expected,run} of suites){
   const start=performance.now();
   try{
    const actual=await run({browser,engine});
    assert.equal(actual,expected,name+' lost required scenario coverage');
    const event={name,engine,expected,actual,status:'PASS',elapsedMs:Math.round(performance.now()-start)};
    results.push(event);report(event);
   }catch(error){
    const event={name,engine,expected,status:'FAIL',elapsedMs:Math.round(performance.now()-start),
     error:String(error?.message||error)};
    report(event);
    failures.push(new Error(name+': '+event.error,{cause:error}));
   }
  }
 }finally{
  try{await browser.close()}catch(error){
   failures.push(new Error('Shared browser shutdown failed: '+String(error?.message||error),{cause:error}));
  }
 }
 if(failures.length)throw new AggregateError(failures,'Account browser batch failed');
 return results;
}
