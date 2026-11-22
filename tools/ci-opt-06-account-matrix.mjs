// The Account matrices share one local preview listener on port 2000.
// Parallelize only isolated browser contexts inside that listener; do not
// launch separate account scripts concurrently (they would contend on :2000).
// One language is completed before advancing, and a theme's variants stay in
// order. Chromium may overlap two contexts; WebKit is serial after its measured
// regression. Await both themes on failure so no context outlives cleanup.
import {performance} from 'node:perf_hooks';

export async function runIndependentAccountMatrix(languages,themes,variants,visit,{maxConcurrent=2}={}){
 if(!languages.length||themes.length!==2||!variants.length||typeof visit!=='function'||![1,2].includes(maxConcurrent))
  throw Error('Account matrix must retain languages, two themes, variants and a visitor');
 for(const language of languages){
  const started=performance.now();
  const runTheme=async theme=>{
   for(const variant of variants)await visit({language,theme,variant});
  };
  const outcomes=[];
  if(maxConcurrent===1){
   // Still visit both themes and surface BOTH failures, not just the first.
   for(const theme of themes){
    const [outcome]=await Promise.allSettled([runTheme(theme)]);
    outcomes.push(outcome);
   }
  }else{
   outcomes.push(...await Promise.allSettled(themes.map(runTheme)));
  }
  const failures=outcomes.flatMap((outcome,index)=>outcome.status==='rejected'
   ?[new Error('Account '+language+'/'+themes[index]+': '+String(outcome.reason?.message||outcome.reason),{cause:outcome.reason})]
   :[]);
  console.log('CI_OPT_06_ACCOUNT_MATRIX|'+JSON.stringify({
   language,maxConcurrent,elapsedMs:Math.round(performance.now()-started),
   covered:failures.length===0?themes.length*variants.length:null,failures:failures.length
  }));
  if(failures.length)throw new AggregateError(failures,'Account independent theme matrix failed');
 }
}
