import test from 'node:test';
import assert from 'node:assert/strict';
import {browserCases,areaRoutes} from './ci-opt-01-browser-cases.mjs';
test('bounded browser matrix includes all locales in both themes and all four widths',()=>{
 const cases=browserCases();
 assert.deepEqual([...new Set(cases.map(x=>x.width))].sort((a,b)=>a-b),[320,390,768,1440]);
 for(const language of ['en','de','es','fr','it'])for(const theme of ['dark','light']){
  assert.ok(cases.some(x=>x.language===language&&x.theme===theme));
 }
 assert.deepEqual(Object.keys(areaRoutes),['calendar','clubs','competitions','guide','admin']);
 assert.ok(cases.some(x=>x.touch)&&cases.some(x=>!x.touch));
});

test('all pairs of width, locale and theme are actually exercised',()=>{
 const cases=browserCases();
 const dimensions={width:[320,390,768,1440],language:['en','de','es','fr','it'],theme:['dark','light']};
 const keys=Object.keys(dimensions);
 for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++){
  const a=keys[i],b=keys[j];
  for(const x of dimensions[a])for(const y of dimensions[b]){
   assert.ok(cases.some(c=>c[a]===x&&c[b]===y),a+'='+x+', '+b+'='+y);
  }
 }
});
